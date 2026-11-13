import { notifyMastery } from "../core/mastery-notice.js";
import { learnFlavorStory } from "../core/flavor-mastery.js";
import { awardLoverSceneExp } from "../core/lover-rewards.js";
import { growthChoiceIndex } from "../core/growth-effects.js";
import { tournamentFinished } from "../core/story-context.js";
import { basicsExperienced } from "../craft/practice-history.js";
import { romanceIntent, createRomanceHesitation } from "../core/romance-hesitation.js";
// 会話エンジン。data/dialogue/*.json のスキーマをそのまま解釈する。
//   play(idOrDialogue, opts) → Promise（会話が終わると解決）
// 分岐（condition / choice）の行は「残りの行の前」に差し込む（旧版・Godot版と同じ挙動）。
import { createNameFit } from "./name-fit.js";
import { conversationCutinCue, conversationCutinAllowed, createConversationCutin } from "./conversation-cutin.js";
import { uiThemeFrame } from "../core/ui-theme.js";
import { fortuneChoiceIndex } from "../core/fortune-effects.js";
import { el, sleep, fitOneLine, nextFrame } from "../core/util.js";
import { DB, displayName, portraitInfo, sceneBg, cgUrl, preload } from "../core/data.js";
import { loadVnFonts } from "../core/vn-fonts.js";
import { state, markMet, STAT_EN, timeOfDay, config } from "../core/state.js";
import { applyStats, gainAffinity, addMoney, affinityLevel, earnSceneCompletion } from "../core/stats.js";
import { setBg, layers, toast, flash, shake, modal, dropRetired, imageReady } from "../core/ui.js";
import { SE, playSe, playBgm, preloadBgm, currentBgm, duckBgm } from "../core/audio.js";
import { formatHtml, visibleLength, stripTags, pausePoints } from "./text.js";
import { playerInner } from "./inner.js";
import { dialoguePages } from "./layout.js";
import { glossaryPanel } from "./glossary.js";
import { createTypedHtml } from "./typed-html.js";
import { rememberRelationship, relationshipReflectionLines } from "../core/relationships.js";
import { needsIntro, playIntro, markIntroSeen, introSeenKey } from "./intro.js";
import { buyKeepsake } from "../core/keepsakes.js";
import { chekiShot, tarotFlip, limeExchange, purikuraShot, sceneMoment, gazeCutin } from "../core/scene-motions.js";
import { showShishaDiagram, hideShishaDiagram } from "./shisha-diagram.js";
import { reducedMotion } from "../core/transition-kit.js";
import { attachLoadingComic } from "../core/loading-comic-notice.js";
import { vnBreath } from "./breath.js";

// 立ち絵を出さない話者（主人公は一人称視点）
const NO_PORTRAIT = new Set(["hajime", "hazime", "", "everyone", "customer", "shop_clerk", "old_man", "traveler"]);
// 主人公も台本が明示した立ち絵だけは出す。通常の発話では一人称視点を保つ。
const canShowPortrait = (speaker, explicit = false) => !NO_PORTRAIT.has(speaker || "") || (speaker === "hajime" && (explicit || running?.previewProtagonist));
// 会話の寄り。1280×720の参考プレビュー（本体約1085px、頭頂y52px）を
// 新版つむぎの身長倍率0.9で再現する。画像の余白・個々の身長は frame() で保つ。
// てつこ（猫）は人と同じ高さに引き伸ばさず、会話の枠の上に座っている大きさで出す（catLift＝下から持ち上げる割合）
const FRAMING = { target: 1.675, sink: 0.58, pakkiTarget: 0.94, pakkiSink: 0.08, catTarget: 0.34, catLift: 0.3 };

/** 章の台本側が差し込むフック（特定の会話の選択肢で状態を変える等） */
export const hooks = {
  onChoice: null,      // (dialogueId, choiceId, branchKey, nextId, choice, line) => void（dialogueId は jump 先を含む表示中の台本。choice=選んだ項目・line=選択肢の行）
  interpolate: null,   // (text) => text（{daysLeft} など）
  evalCondition: null, // (line) => boolean | undefined（未知の条件タイプ）
  contextChar: null,   // 「【好感度】が上がった」の宛先（いま会っている相手）
  onEnter: null,       // (dialogueId, dlg) => void … 会話に入った瞬間（jump 先も含む）。metadata.set_romance 等を拾う
  onCg: null,          // (cgId) => void … CG を見た（ギャラリーの解放）
  onLine: null,        // (dialogueId, line) => void … 台詞を1行出すたび（場面演出を台詞に合わせる用）
};

// エンジンが握りつぶしていた失敗の集約（#1362）。同じ内容は重複させず、記録と console.warn を1回だけにする。
// ゲームの進行は変えず、テスト・開発時に getVnWarnings() で検出できるようにするためのもの。
const vnWarnings = [];
export function getVnWarnings() { return vnWarnings.slice(); }
export function clearVnWarnings() { vnWarnings.length = 0; }
function warnVn(kind, detail) {
  const entry = { kind, detail: String(detail ?? "") };
  if (vnWarnings.some((w) => w.kind === entry.kind && w.detail === entry.detail)) return;
  vnWarnings.push(entry);
  console.warn(`[vn] ${kind}:`, entry.detail);
}

const log = [];
let dom = null;
let nameFit = null;
let cutin = null; // 会話カットイン（立ち絵版・#2990）
let settingsReady = null;
let openVnConfig = null;
let running = null;     // 再生中の会話の状態
let autoMode = false;
let skipMode = false;
let autoFxGap = 0;
let sequenceDepth = 0;
let sequenceMetBefore = null;
const SEEN_LINES_KEY = "suien_remake_seen_dialogue_lines";
const SEEN_LINES_LIMIT = 20000;
// 既読の保存は1行ごとには書かない（全件の JSON 化と同期書き込みが、既読が増えるほど1行送りを重くするため。#3500 C-1）。
// 最後の書き込みから10秒たつか、会話の終わり・タブを隠した時・ページを離れる時にまとめて書く。
// 強制終了で失うのは、最後の10秒ほどに初めて読んだ行の既読印だけ（既読SKIPの対象から漏れるだけで、進行は失わない）。
const SEEN_LINES_FLUSH_MS = 10000;
let seenLines;
let seenLinesDirty = false;
let seenLinesTimer = 0;
function readSeenLines() {
  if (seenLines) return seenLines;
  try { seenLines = new Set(JSON.parse(localStorage.getItem(SEEN_LINES_KEY) || "[]")); }
  catch { seenLines = new Set(); }
  trimSeenLines();
  return seenLines;
}
/** 保存と同じ上限（新しい方から2万件）を、手元の記録にも当てる。古い方から捨てる。 */
function trimSeenLines() {
  for (const key of seenLines) {
    if (seenLines.size <= SEEN_LINES_LIMIT) break;
    seenLines.delete(key);
  }
}
// 既読の記録を端末へ書くのは本編（index.html → main.js）だけ。会話UI・第2章などの試遊ページは本編の保存を変えない。
let seenLinePersistence = false;
export function enableSeenLinePersistence() {
  if (seenLinePersistence) return;
  seenLinePersistence = true;
  globalThis.addEventListener?.("pagehide", flushSeenLines);
  globalThis.document?.addEventListener?.("visibilitychange", () => { if (document.hidden) flushSeenLines(); });
}
/** 読んだ行の既読印を今すぐ保存する（ふだんは10秒ごと・会話の終わり・タブを隠した時にまとめて書く）。保存の中身を比べる検査からも呼ぶ。 */
export function flushSeenLines() {
  clearTimeout(seenLinesTimer);
  seenLinesTimer = 0;
  if (!seenLinesDirty || !seenLinePersistence) return;
  seenLinesDirty = false;
  try { localStorage.setItem(SEEN_LINES_KEY, JSON.stringify([...seenLines])); }
  catch { /* 端末の容量制限時も会話は続ける */ }
}
function markSeenLine(key) {
  if (!key || readSeenLines().has(key)) return;
  seenLines.add(key);
  if (seenLines.size > SEEN_LINES_LIMIT) trimSeenLines();
  if (!seenLinePersistence) return;
  seenLinesDirty = true;
  if (!seenLinesTimer) seenLinesTimer = setTimeout(flushSeenLines, SEEN_LINES_FLUSH_MS);
}
function queuedLines(id, lines, branch = "main") {
  return (lines || []).map((line, index) => ({ ...line, _seenKey: id ? JSON.stringify([id, branch, index]) : null }));
}
function insertBranch(r, key) {
  r.queue.unshift(...queuedLines(r.currentId, r.branches[key], key));
}

/** 一続きの会話（バイト開始→接客→終了）の間だけSKIPを維持。選択肢は自分で選び、行動の終わりに解除する。 */
export async function dialogueSequence(run) {
  if (!sequenceDepth) sequenceMetBefore = { owner: state, met: affinityMetBefore() };
  sequenceDepth++;
  try { return await run(); }
  finally { if (--sequenceDepth === 0) { sequenceMetBefore = null; setSkip(false); } }
}

export const vnTest = { turbo: false, choose: null }; // テスト用: 瞬時表示＋自動送り・選択肢の方針

function buildDom() {
  // 設定のコードは会話の準備中に読み、タップ時は同じイベント内でモーダルを開く。
  // クリック後の遅延importで、本文を送るタップの上にモーダルを遅れて重ねない。
  settingsReady = import("../scenes/title.js").then(module => { openVnConfig = module.openConfig; });
  const host = layers.vn;
  dom = {
    effect: el("div.vn-effect"),
    cg: el("div.vn-cg"),
    portraits: el("div.vn-portraits"),
    cutin: el("div.vn-cutin-layer", { "aria-hidden": "true" }),
    name: el("div.vn-name"),
    text: el("div.vn-text", { "aria-live": "polite" }),
    inner: el("div.vn-inner", { hidden: true, "aria-live": "polite", "aria-label": "ひよりの本心（はじめには聞こえない）" }),
    next: el("div.vn-next", { text: "▼" }),
    choices: el("div.vn-choices"),
    log: el("div.vn-log"),
    controls: el("div.vn-controls"),
  };
  dom.box = el("div.vn-box", [dom.name, dom.text, dom.inner, dom.next]);
  const ctl = (label, fn, test) => el("button.vn-ctl", { text: label, dataset: { test }, onclick: (e) => { e.stopPropagation(); fn(); } });
  dom.autoBtn = ctl("AUTO", () => setAuto(!autoMode), "vn-auto");
  dom.skipBtn = ctl("SKIP", () => setSkip(!skipMode), "vn-skip");
  dom.autoBtn.setAttribute("aria-pressed", "false");
  dom.skipBtn.setAttribute("aria-pressed", "false");
  dom.controls.append(dom.autoBtn, dom.skipBtn, ctl("LOG", openLog, "vn-log"), ctl("用語", openGlossary, "vn-glossary"), ctl("設定", openSettings, "vn-config"));
  host.replaceChildren(dom.effect, dom.cg, dom.portraits, dom.cutin, dom.box, dom.choices, dom.controls, dom.log);
  cutin = createConversationCutin(dom.cutin);
  nameFit = createNameFit(dom.name);
  host.addEventListener("pointerup", (e) => {
    if (!running || e.target.closest(".vn-ctl, .vn-choices, .vn-log")) return;
    if (performance.now() < running.openLockUntil) return;
    if (autoMode || skipMode) { setAuto(false); setSkip(false); }
    advance();
  });
  window.addEventListener("keydown", (e) => {
    if (!running || !layers.vn.classList.contains("active")) return;
    if (layers.modal.classList.contains("show")) return;
    if (dom.log.classList.contains("show")) {
      if (e.key === "Escape") { e.preventDefault(); closeLog(); }
      return;
    }
    if (e.key === "Control") { setSkip(true); return; }
    if (running.waitingChoice) {
      const choices = [...dom.choices.querySelectorAll('.vn-choice:not([aria-disabled="true"])')];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const current = choices.indexOf(document.activeElement);
        choices[(current + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length]?.focus();
      } else if (/^[1-3]$/.test(e.key) && !e.repeat && !e.target?.closest?.("input, select, textarea, [contenteditable]")) {
        const choice = dom.choices.querySelectorAll(".vn-choice")[Number(e.key) - 1];
        if (choice && choice.getAttribute("aria-disabled") !== "true") { e.preventDefault(); choice.click(); }
      } else if (e.key === "Enter" && !e.target?.closest?.("button, a[href], input, select, textarea, [contenteditable]")) {
        e.preventDefault(); (choices.includes(document.activeElement) ? document.activeElement : choices[0])?.click();
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      // フォーカス中のボタン・入力欄はブラウザ本来のキー操作に任せる。
      if (e.target?.closest?.("button, a[href], input, select, textarea, [contenteditable]")) return;
      e.preventDefault(); advance();
    }
    if (e.key === "Control") setSkip(true);
  });
  window.addEventListener("keyup", (e) => { if (e.key === "Control") setSkip(false); });
}

/**
 * 左右の余白の「次へ」（core/side-area.js・YHK）。会話の面を押した時と同じ送りをする。送れたら true。
 * 面を押せない間（用語・設定などのモーダル、LOG、会話を開いた直後の誤送り防止の間）は何もしない。
 */
export function tapAdvance() {
  if (!running || !dom || !layers.vn.classList.contains("active")) return false;
  if (layers.modal.classList.contains("show") || dom.log.classList.contains("show")) return false;
  if (performance.now() < running.openLockUntil) return false;
  if (autoMode || skipMode) { setAuto(false); setSkip(false); }
  advance();
  return true;
}

function setAuto(v) {
  if (v) setSkip(false);
  autoMode = v;
  dom?.autoBtn.classList.toggle("on", v);
  dom?.autoBtn.setAttribute("aria-pressed", String(v));
  clearTimeout(autoTimer);
  if (v) kickAuto();
}
function setSkip(v) {
  if (v && running?.cancelOnSkip) return finish(true);
  if (v && config.skipSeenOnly && running?.activeSeenKey && !readSeenLines().has(running.activeSeenKey)) return;
  if (v) { cutin?.clear(); setAuto(false); }
  skipMode = v;
  document.body.classList.toggle("vn-skip", v);
  dom?.skipBtn.classList.toggle("on", v);
  dom?.skipBtn.setAttribute("aria-pressed", String(v));
  clearTimeout(autoTimer);
  if (v && running?.typing) completeTyping();
  if (v || autoMode) kickAuto();
}

let autoTimer = 0;
// 会話の操作バーから開いた用語集・設定の表示中だけ自動送りを止める（他の画面のモーダルでは止めない）
let vnModalOpen = 0;
function kickAuto() {
  clearTimeout(autoTimer);
  if (!running || !running.ready) return;
  if (dom.log.classList.contains("show") || vnModalOpen) return;
  const fast = vnTest.turbo || skipMode;
  if (!fast && !autoMode) return;
  if (running.waitingChoice) {
    if (vnTest.turbo) autoTimer = setTimeout(() => autoChoose(), 10);
    return;
  }
  const autoFactor = ({ 1: 1.5, 2: 1, 3: 0.6 })[config.autoSpeed] || 1;
  const delay = vnTest.turbo ? 5 : skipMode ? 25 : running.typing ? 200 : (1200 + visibleLength((running.fullHtml || "") + (running.fullInnerHtml || "")) * 45) * autoFactor;
  autoTimer = setTimeout(() => {
    if (!running || dom.log.classList.contains("show") || vnModalOpen) return;
    if (running.typing && !vnTest.turbo && !skipMode) return kickAuto();
    advance();
  }, delay);
}

// ---------------------------------------------------------------- 再生

/** 同じ背景へ続く会話でも、長い素材待ちには案内を出す。既存のreadyガードで操作を保護する。 */
function waitSceneAssets(task, owner = running, assets = task.assetsReady || task) {
  let notice = null, hideComic;
  const timer = setTimeout(() => {
    if (running !== owner) return;
    notice = el("div.vn-loading", { role: "status", "aria-live": "polite",
      text: "場面を準備しています…", dataset: { test: "vn-loading" } });
    layers.fx.append(notice);
    if (typeof attachLoadingComic === "function") hideComic = attachLoadingComic(notice);
  }, 500);
  const loaded = Promise.resolve(assets).finally(() => { clearTimeout(timer); hideComic?.(); notice?.remove(); });
  // 場面転換の演出は最後まで待つが、取得・デコード済みなら読み込み表示を延長しない。
  return Promise.all([task, loaded]).then(([value]) => value);
}

/**
 * 会話を再生する。
 * @param idOrDlg dialogue_id か dialogue オブジェクト
 * @param opts.bg  背景の上書き（res:// パス可）
 * @param opts.signal 呼出し元が場面を破棄したとき、読了・末尾報酬なしで閉じる
 * @param opts.cancelOnSkip SKIPを中断として扱い、呼出し元で次回の再読を可能にする
 * @param opts.fromLine 主列の開始位置（含む）。既読キーは元の行位置を保つ
 * @param opts.toLine 主列の終了位置（含まない）。分岐は通常どおり再生する
 * @param opts.growthScene 自分で選んだ固有場面。全編の正常完読を自由行動の経験値候補にする
 * @param opts.previewProtagonist 比較プレビューでだけ主人公の立ち絵も表示する（本編は非表示）
 * 範囲指定でも各playの終了時に台本の報酬を処理する。報酬つき台本を分割する用途には使わない。
 */
function affinityMetBefore(known = [], before = state?.met) {
  const met = { ...before };
  // タイトル画面の検査・プレビューなどセーブの無い再生では保留も無い
  const flags = state?.flags || {};
  for (const key of Object.keys(flags)) if (key.startsWith("_affinity_first_meeting_pending_") && flags[key]) delete met[key.slice("_affinity_first_meeting_pending_".length)];
  for (const id of known) met[id] = true;
  return met;
}

export function play(idOrDlg, opts = {}) {
  if (!dom) buildDom();
  const dlg = typeof idOrDlg === "string" ? DB.dialogues[idOrDlg] : idOrDlg;
  if (opts.signal?.aborted) return Promise.resolve({ id: dlg?.dialogue_id || "", visited: [], cancelled: true });
  if (!dlg) {
    warnVn("dialogue-not-found", idOrDlg);
    return Promise.resolve();
  }
  if (!(dlg.lines || []).length) warnVn("dialogue-empty", dlg.dialogue_id || "");
  // 章側が保証する既知の相手。表示・台詞の分岐を変えず、面識欠損の修復を初対面報酬へ混ぜない。
  const affinityKnown = new Set(opts.affinityKnown || []);
  if (state) for (const id of affinityKnown) delete state.flags[`_affinity_first_meeting_pending_${id}`];
  return new Promise((resolve) => {
    layers.fx.querySelector(".vn-loading")?.remove();
    running = {
      owner: state,
      romanceWarningGuilt: opts.romanceWarningGuilt === true, // 夜の告白の旧警告goと同じ罪悪感。承認読了後だけ
      metAtStart: { ...state?.met },
      encountered: new Set(),
      affinityKnown,
      metBefore: affinityMetBefore(affinityKnown, sequenceMetBefore?.owner === state ? sequenceMetBefore.met : state?.met),
      firstAffinity: new Set(),
      id: dlg.dialogue_id || "", // 開始台本。finish() の報酬と play() の解決値はこの台本に属する（仕様・#1362）
      currentId: dlg.dialogue_id || "", // 表示中の台本。jumpTo で jump 先へ進む
      dlg,
      growthScene: opts.growthScene === true && opts.fromLine == null && opts.toLine == null && !!dlg.lines?.length,
      queue: queuedLines(dlg.dialogue_id, dlg.lines).slice(opts.fromLine ?? 0, opts.toLine),
      branches: dlg.branches || {},
      resolve,
      cancelOnSkip: !!opts.cancelOnSkip,
      cast: Array.isArray(opts.cast) ? opts.cast : null, // motion "gaze" に出す人（その場にいる恋人）
      previewProtagonist: opts.previewProtagonist === true,
      waitingChoice: false,
      typing: false,
      pages: null,
      pageIdx: 0,
      fullHtml: "",
      slots: {},
      speaker: "",
      openLockUntil: performance.now() + 320,
      visited: [dlg.dialogue_id || ""],
      ready: false, // 背景・立ち絵の読み込み待ちの間は送らない
      context: sceneContext(dlg), // 公私の文脈（名前欄・ログの呼び名）。jump 先の metadata で切り替わる
      bgmBefore: currentBgm(), // metadata.bgm で曲を替えた会話は、終わったらこの曲へ戻す
      bgmSwitched: false,
      bgmOnSpeaker: null,
      pendingIntros: [], // 立ち絵と実際の発話を読んだ後に出す初登場カットイン
      spoken: new Set(),
    };
    autoFxGap = 0;
    cutin?.clear();
    dom.portraits.replaceChildren();
    dom.choices.replaceChildren();
    dom.text.innerHTML = "";
    dom.next.classList.remove("show");
    dom.inner.replaceChildren();
    dom.inner.hidden = true;
    dom.box.classList.remove("has-inner");
    hideShishaDiagram(); // 前の場面やLOAD前の図解を残さない（#1128）
    dom.name.textContent = "";
    dom.name.classList.remove("show");
    const meta = dlg.metadata || {};
    const bg = opts.bg || meta.bg;
    const portraitsReady = firstPortraits(dlg);
    const bgReady = bg ? sceneSetBg(bg, portraitsReady) : Promise.resolve();
    dom.effect.dataset.effect = meta.effect || "";
    // #2447 item10: metadata.lift_scene_props の場面だけ、背景の台（卓上・床）を本文ボックスの
    // 上辺まで持ち上げて、下半分が会話ウィンドウに隠れないようにする。既定の家の場面には付けない。
    document.body.classList.toggle("vn-lift-props", !!meta.lift_scene_props);
    const bgmReady = preloadBgm(meta.bgm || currentBgm());
    if (hooks.onEnter) hooks.onEnter(dlg.dialogue_id || "", dlg);
    dropRetired(); // 選び終えた前の画面（マップ等）を会話の後ろに残さない
    // 会話の間は、まだ片付いていない画面（大会の作業台・結果表など）も後ろに見せない（会話が終われば戻る）
    document.body.classList.add("vn-open");
    const me = running;
    if (me.cancelOnSkip && skipMode) { setSkip(false); finish(true); return; }
    if (opts.signal) {
      const cancel = () => { if (running === me) finish(true); };
      me.removeAbort = () => opts.signal.removeEventListener("abort", cancel);
      opts.signal.addEventListener("abort", cancel, { once: true });
      if (opts.signal.aborted) { cancel(); return; }
    }
    prefetch(dlg);
    // 画像の待ち時間は場面転換の幕で覆う。短い固定待ちで読み込みを打ち切らない。
    // 最初の行を出す前に名前欄と本文の明朝を待つ。失敗時は代替書体で続ける。
    const fontsReady = loadVnFonts().catch(() => []);
    const assetsReady = Promise.all([settingsReady, fontsReady, bgReady.assetsReady || bgReady, bgmReady, ...portraitsReady.map((u) => imageReady(u, 15000))]);
    waitSceneAssets(bgReady, me, assetsReady).then(() => {
      if (running !== me) return;
      sceneBgm(meta);
      me.ready = true;
      layers.vn.classList.add("active");
      document.body.classList.add("in-vn");
      next();
    });
  });
}

/** metadata.bgm: その会話の間だけ鳴らす曲（jump 先でも切り替わる。会話が終われば元の曲へ） */
function sceneBgm(meta) {
  if (!meta?.bgm) return;
  running.bgmOnSpeaker = meta.bgm_on_speaker ? { id: meta.bgm_on_speaker, key: meta.bgm } : null;
  if (running.bgmOnSpeaker) return;
  running.bgmSwitched = true;
  playBgm(meta.bgm);
}

function speakerBgm(id) {
  const cue = running?.bgmOnSpeaker;
  if (!cue || cue.id !== id) return;
  running.bgmOnSpeaker = null;
  running.bgmSwitched = true;
  playBgm(cue.key);
}

/** 仕事を離れた私的な場面か（metadata.private_scene）。名前欄の呼び名に使う */
const sceneContext = (dlg) => (dlg?.metadata?.private_scene ? "private" : null);

/** 連絡の種類は明示された現在の場面だけに表示し、公私の呼び名・声の区別は保つ。 */
function lineDisplayName(line, r) {
  const speaker = String(line.speaker || "");
  const name = speaker === "samechan" && line.voice === "korochan" ? "コロちゃん"
    : speaker ? displayName(speaker, state, { context: r.context }) : "";
  const scene = r.currentId && r.currentId !== r.id ? DB.dialogues[r.currentId] : r.dlg;
  return name && scene?.metadata?.contact_channel === "lime" ? `${name}（LIME）` : name;
}

/** 実際にこの行に出す立ち絵。無言の同席者と話者が別なら両方待つ。 */
function linePortraits(line) {
  return [...new Set([
    line.portrait !== false && canShowPortrait(line.speaker) ? portraitInfo(line.speaker, line.face)?.src : null,
    line.portrait ? portraitInfo(line.portrait, line.portrait_face || "normal")?.src : null,
  ].filter(Boolean))];
}

/** 最初の表示行に必要な絵だけを幕の内側で準備する。後続の表情は先読みへ任せる。 */
function firstPortraits(dlg) {
  for (const l of dlg?.lines || []) {
    if (!l.type) return linePortraits(l);
    // 分岐・別場面・演出を越えた行を、今の場面の開始条件にしない。
    if (["choice", "condition", "jump", "bg", "show_cg", "hide_cg", "motion", "reflection", "game_over"].includes(l.type)) break;
  }
  return [];
}

/** 会話の背景（昼夜の差分・夜の色調補正つき） */
function sceneSetBg(ref, ready = []) {
  const { url, tint } = sceneBg(ref, timeOfDay());
  return url ? setBg(url, { tint, ready }) : Promise.resolve();
}

const PREFETCH_FIRST = 16; // 会話の入口（開始・jump）で先に読む枚数
const PREFETCH_AHEAD = 16; // 送りに合わせて、この先の何行ぶんを先に読むか（#3500 C-8）
function collectArt(lines, urls) {
  for (const l of lines || []) {
    const character = l.portrait === false ? null : l.portrait || l.speaker;
    if (character && canShowPortrait(character, !!l.portrait)) {
      const p = portraitInfo(character, l.portrait_face || l.face);
      if (p) urls.add(p.src);
    }
    if (l.type === "show_cg") urls.add(cgUrl(l.cg_id));
  }
  return urls;
}
/** 同じ会話の中で一度頼んだ絵は頼み直さない（jump のたびの再発行もしない）。 */
function requestArt(urls, r = running) {
  const asked = r ? (r.prefetched ??= new Set()) : new Set();
  const fresh = [...urls].filter((u) => u && !asked.has(u));
  fresh.forEach((u) => asked.add(u));
  if (fresh.length) preload(fresh, 0);
}
function prefetch(dlg) {
  if (!dlg) return;
  const urls = collectArt(dlg.lines, new Set());
  Object.values(dlg.branches || {}).forEach((lines) => collectArt(lines, urls));
  requestArt([...urls].slice(0, PREFETCH_FIRST));
}
/** 入口の16枚より後ろの表情・CGも、読み進めるのに合わせて先の行のぶんを頼む（分岐は選ばれて差し込まれた時点で入る）。 */
function prefetchAhead(r) {
  requestArt(collectArt(r.queue.slice(0, PREFETCH_AHEAD), new Set()), r);
}

// 仕様（#1362）: 報酬（metadata / growth_stats）と解決値の id は開始台本（running.id / running.dlg）に属し、
// jump 先の台本へは差し替えない。表示中の台本 ID は running.currentId が持つ。
function dialogueAffinity(r, id, pts, remote = (r.currentId && r.currentId !== r.id ? DB.dialogues[r.currentId] : r.dlg)?.metadata?.contact_channel === "lime") {
  if (!id || !(pts > 0)) return;
  // 強制イベント（前夜祭など）では好感度を上げない（2026-11-06 オーナー決定）。
  if (r.dlg?.metadata?.forced_event) return;
  if (remote) { gainAffinity(id, pts, { remote: true }); return; }
  // 初対面の行・選択肢の報酬は読了まで保留。中断では♥1の保証も確定しない。
  if (!r.metBefore[id] && !(state.lovers || []).includes(id)) { r.firstAffinity.add(id); return; }
  gainAffinity(id, pts);
}

function completeDialogueAffinity(r) {
  if (!state || state !== r.owner) return;
  const meta = r.dlg.metadata || {};
  // 強制イベントでの出会いは、初対面の♥1も付けない。面識の保留はそのまま残し、次の通常の出会いで♥1にする。
  if (meta.forced_event) { r.firstAffinity.clear(); return; }
  if (meta.add_affinity) for (const [id, n] of Object.entries(meta.add_affinity)) dialogueAffinity(r, id, n * 6, meta.contact_channel === "lime");
  if (meta.contact_channel !== "lime") {
    for (const id of Object.keys(state.met || {})) if (state.met[id] && !r.metBefore[id] && id !== "hajime"
      && (!r.metAtStart[id] || r.encountered.has(id))) r.firstAffinity.add(id);
    for (const id of r.firstAffinity) gainAffinity(id, 1, { firstMeeting: true });
  }
}

function finish(cancelled = false) {
  const r = running;
  running = null;
  clearTimeout(autoTimer);
  stopTyping(r);
  r.removeAbort?.();
  flushSeenLines(); // 会話の終わりに、この会話で初めて読んだ行の既読印をまとめて保存する
  const meta = r.dlg.metadata || {};
  // metadata / growth_stats の報酬（会話の最後にまとめて付く）
  if (!cancelled && meta.add_stat) applyStats(meta.add_stat);
  if (!cancelled) completeDialogueAffinity(r);
  if (!cancelled && r.dlg.growth_stats) applyStats(r.dlg.growth_stats);
  if (!cancelled && meta.flavor_lesson) notifyMastery(learnFlavorStory(state, r.dlg, DB.flavorById));
  if (!cancelled) awardLoverSceneExp(r.id, r.owner);
  if (!cancelled && r.growthScene) earnSceneCompletion(r.id, r.owner);
  layers.vn.classList.remove("active");
  document.body.classList.remove("in-vn", "vn-open", "vn-lift-props");
  dom.cg.classList.remove("show");
  releaseCg();
  dom.portraits.replaceChildren();
  cutin?.clear();
  hideShishaDiagram(); // 会話終了（SKIP/キャンセル含む）で図解を片付ける（#1128）
  dom.effect.dataset.effect = "";
  layers.vn.classList.remove("sepia", "flashback");
  if (!sequenceDepth) setSkip(false);
  releaseDuck(r);
  if (r.bgmSwitched) playBgm(r.bgmBefore);
  r.resolve({ id: r.id, visited: r.visited, ...(cancelled ? { cancelled: true } : {}) });
}

function advance() {
  if (!running || !running.ready || running.waitingChoice) return;
  if (running.typing) return completeTyping();
  if (running.pages && running.pageIdx < running.pages.length - 1) {
    running.pageIdx++;
    renderPage();
    return;
  }
  next();
}

function next() {
  const r = running;
  if (!r) return;
  if (r.hesitation && !r.hesitation.model.current(state)) return finish(true);
  if (!skipMode && !vnTest.turbo) markSeenLine(r.activeSeenKey);
  r.activeSeenKey = null;
  cutin?.leave({ still: reducedMotion() });
  if (!skipMode && !vnTest.turbo) prefetchAhead(r);
  // BGMの息継ぎは、その行を読み終えて次へ進むところで戻す。すぐ次の台詞行も duck なら下げたまま渡す（戻して下げ直すと音量が波打つ）。
  if (!r.queue[0]?.duck || r.queue[0].type) releaseDuck(r);
  // 読み終えた行の合図を、次の行の画像待ち・制御行へ持ち越さない。
  dom.next.classList.remove("show");
  r.pages = null;
  // 制御行はまとめて処理し、表示する台詞行に着いたら止まる
  for (;;) {
    const line = r.queue.shift();
    if (line === undefined) return introThenShow();
    const type = line.type || "";
    if (type === "romance_hesitation") { resumeRomanceHesitation(line.action); return; }
    if (type === "romance_memory") {
      dom.portraits.replaceChildren(); r.slots = {};
      continue;
    }
    if (!type) return introThenShow(line);
    if (type === "choice") return introThenShow(line, showChoices);
    if (type === "game_over") return finish();
    if (type === "condition") { if (handleCondition(line)) return; continue; }
    if (type === "jump") { if (!line.next_id) warnVn("jump-missing-next-id", r.currentId || r.id); else if (jumpTo(line.next_id)) return; continue; }
    if (type === "set_flag") {
      const contact = /^_lime_contact_(.+)$/.exec(line.flag || "");
      const alreadyConnected = contact && (state.flags[line.flag] || state.contacts.includes(contact[1]));
      state.flags[line.flag] = true;
      const m = /^_met_(.+)$/.exec(line.flag || "");
      if (m) {
        markMet(m[1], { known: r.affinityKnown.has(m[1]) });
        if (needsIntro(m[1])) queueIntro({ id: m[1] });
      }
      if (contact && !alreadyConnected && !vnTest.turbo) {
        const id = contact[1];
        const key = `_lime_exchange_shown_${id}`;
        if (!state.flags[key]) {
          state.flags[key] = true;
          r.ready = false;
          limeExchange(id).then(() => { if (running === r) { r.ready = true; next(); } });
          return;
        }
      }
      continue;
    }
    if (type === "show_cg") {
      r.ready = false;
      showCg(line.cg_id, line.effect).then(() => { if (running === r) { r.ready = true; next(); } });
      return;
    }
    // 一度きりのモーショングラフィックス（core/scene-motions.js）。終わるまで次の行へ進まない
    if (type === "motion") {
      if (vnTest.turbo) continue;
      const run = { tarot: () => tarotFlip(), lime: () => limeExchange(line.char_id, line.context), purikura: () => purikuraShot(),
        dragon: () => sceneMoment("dragonSmoke"), // dragon: 第4章 前夜祭の龍の煙（#2688 A5）
        // gaze: 修羅場で恋人たちの視線が刺さる。その場にいる恋人は呼び出し側が play の cast で渡す（無ければ会ったことのある恋人全員）。
        // "brief": true はプチ修羅場の短い版
        gaze: () => gazeCutin(r.cast || (state.lovers || []).filter((id) => state.met?.[id]), { brief: line.brief === true }) }[line.id];
      if (!run) continue;
      if (line.id === "lime") {
        const key = `_lime_exchange_shown_${line.char_id}_${line.context || "work"}`;
        if (state.flags[key]) continue;
        state.flags[key] = true;
      }
      r.ready = false;
      run().then(() => { if (running === r) { r.ready = true; next(); } });
      return;
    }
    if (type === "intro") {
      const id = line.char_id;
      const variant = line.variant || "";
      if (state.flags[introSeenKey(id, variant)]) continue;
      // はじめの指定紹介以外は、本人が立ち絵で話すまで予約しておく。
      if (id !== "hajime") { queueIntro({ id, variant, override: line.intro || {} }); continue; }
      if (vnTest.turbo) { markIntroSeen(id, variant); continue; }
      r.ready = false;
      playIntro(id, { variant, override: line.intro || {} }).then(() => { if (running === r) { r.ready = true; next(); } });
      return;
    }
    if (type === "hide_portrait") {
      dom.portraits.querySelector(`img[data-speaker="${line.char_id}"]`)?.remove();
      delete r.slots[line.char_id];
      layoutPortraits();
      continue;
    }
    if (type === "buy_keepsake") {
      const branch = buyKeepsake(line.item_id) ? line.next_success : line.next_failure;
      if (branch && r.branches[branch]) insertBranch(r, branch);
      continue;
    }
    if (type === "hide_cg") {
      r.ready = false;
      dom.cg.classList.remove("show", "cg-focus-window", "cg-focus-sketch-cat", "cg-focus-sketch-blank");
      visualSettled(dom.cg).then(() => { releaseCg(); if (running === r) { r.ready = true; next(); } });
      return;
    }
    if (type === "apply") { applyLine(line); continue; }
    if (type === "note") { onNote(line); continue; }
    if (type === "remember") { rememberRelationship(line.memory_id); continue; }
    if (type === "reflection") { r.queue.unshift(...relationshipReflectionLines(line)); continue; }
    if (type === "bg") {
      if (!line.bg) continue;
      r.ready = false;
      waitSceneAssets(sceneSetBg(line.bg), r).then(() => {
        if (running !== r) return;
        r.ready = true;
        next();
      });
      return;
    }
    if (type === "sfx") { playSe(line.id); continue; }
    // 一服の「間」（KMR11）: 口元から煙を吐き、煙が顔の前に広がるまで短く待ってから次の行へ（晴れると表情が変わっている）。
    // 早送り中は煙も間も出さない
    if (type === "fx" && line.id === "exhale") {
      const hold = skipMode || vnTest.turbo ? 0 : vnBreath(line, { host: layers.vn, portraits: dom.portraits });
      if (!hold) continue;
      r.ready = false;
      sleep(hold).then(() => { if (running === r) { r.ready = true; next(); } });
      return;
    }
    if (type === "fx") { runFx(line); continue; }
    // 未知の行タイプは黙って飛ばす（データ先行で書けるように）
  }
}

function jumpTo(id) {
  const target = DB.dialogues[id];
  if (!target) { warnVn("jump-target-missing", id); return; }
  // 表示中の台本として currentId を引き継ぐ。id / dlg は開始台本のまま（finish() の仕様・#1362）
  running.currentId = id;
  running.queue = queuedLines(id, target.lines);
  running.branches = target.branches || {};
  running.context = sceneContext(target);
  if (target.metadata?.clear_portraits) {
    dom.portraits.replaceChildren();
    running.slots = {};
  }
  running.visited.push(id);
  const bgmReady = target.metadata?.bgm ? preloadBgm(target.metadata.bgm) : Promise.resolve();
  if (hooks.onEnter) hooks.onEnter(id, target);
  prefetch(target);
  if (target.metadata?.bg || target.metadata?.bgm) {
    const r = running;
    r.ready = false;
    waitSceneAssets(Promise.all([sceneSetBg(target.metadata.bg, firstPortraits(target)), bgmReady]), r).then(() => { if (running === r) { sceneBgm(target.metadata); r.ready = true; next(); } });
    return true;
  }
  return false;
}

function handleCondition(line) {
  const kind = line.condition_type || "stat";
  let ok;
  if (kind === "stat") {
    const key = STAT_EN[line.stat] || line.stat;
    ok = (state.stats[key] || 0) >= Number(line.threshold || 0);
  } else if (kind === "tournament_finished") {
    ok = tournamentFinished(state, line.tournament_chapter);
  } else if (kind === "craft_basics_experienced") {
    ok = basicsExperienced();
  } else if (kind === "money") {
    ok = state.money >= Number(line.threshold || 0);
  } else if (kind === "flag") {
    ok = !!state.flags[line.flag];
  } else if (kind === "flag_count") {
    ok = (Number(state.flags[line.flag]) || 0) >= Number(line.threshold === 0 ? 0 : (line.threshold || 1)); // 数値0だけ既定1に化かさない（文字列 "0" と結果をそろえる。#1362）
  } else if (kind === "met") {
    ok = !!state.met[line.char_id];
  } else if (kind === "contact") {
    // 連絡先を交換済みか。spots.js の hasContact と同じ判定を、保存値を書き換えずに読むだけ（旧セーブ互換）。
    // threshold は LIME_EXCHANGE と同じ「固有会話の消化数」。
    const id = line.char_id;
    ok = (state.contacts || []).includes(id) || !!state.flags[`_lime_contact_${id}`]
      || (!!line.threshold && (state.story?.[id] || 0) >= Number(line.threshold));
  } else if (kind === "affinity") {
    ok = affinityLevel(line.char_id) >= Number(line.threshold || 0);
  } else {
    const v = hooks.evalCondition ? hooks.evalCondition(line) : undefined;
    if (v === undefined) { warnVn("condition-unknown", kind); ok = false; }
    else ok = !!v;
  }
  const key = String((ok ? line.next_true : line.next_false) || "");
  // 単独で条件関数を使うデータ検証では currentId が無い。実再生時だけ既読キーを付ける。
  if (key && running.branches[key]) running.queue.unshift(...(running.currentId ? queuedLines(running.currentId, running.branches[key], key) : running.branches[key]));
  else if (key && DB.dialogues[key]) return jumpTo(key);
  else if (key) warnVn("branch-unresolved", key);
}

function applyLine(line) {
  if (line.stats) applyStats(line.stats);
  if (line.money) addMoney(line.money);
  if (line.affinity) for (const [id, n] of Object.entries(line.affinity)) dialogueAffinity(running, id, n * 6);
}

function onNote(line) {
  state.flags[`_note_${line.note_id}`] = true;
  toast(`📝 メモした ──「${line.label || "話の要点"}」`, { kind: "good" });
}

function runFx(line) {
  const id = line.id;
  // 早送りでは一瞬の装飾を積まない。セピア等の場面状態と解除は通常どおり適用する。
  if ((skipMode || vnTest.turbo) && ["shake", "flash", "imp", "gold", "cutin", "scent"].includes(id)) return;
  autoFxGap = 6;
  if (id === "shake") { shake(); SE.hit(); }
  else if (id === "flash" || id === "imp") flash(id === "imp" ? "gold" : "white");
  // 金の閃光＋決めの音。旧名 cutin は登場カットインと紛らわしいので gold に改めた（#2688 F8。古い台本の cutin も同じ動き）
  else if (id === "gold" || id === "cutin") { flash("gold"); SE.just(); }
  else if (id === "sepia") layers.vn.classList.add("sepia");
  else if (id === "sepia_off") layers.vn.classList.remove("sepia");
  else if (id === "flashback") layers.vn.classList.add("flashback");
  else if (id === "flashback_off") layers.vn.classList.remove("flashback");
  else if (id === "scent") scent(line.color || "#e8c27a", line.color2 || line.color || "#b8743a");
  // #1076: 完成CGの窓辺へ短く視線を寄せる／全景へ戻す。SKIP中・低減モーションではカメラを動かさない。
  else if (id === "cg_focus_window") { if (!skipMode && !reducedMotion()) dom.cg.classList.add("cg-focus-window"); }
  else if (id === "cg_focus_reset") dom.cg.classList.remove("cg-focus-window");
  // #1076 DAY3: 下描きCGの回答部分（猫の顔／未着色の右側）へ一度だけ短く寄せる。SKIP中・低減モーションでは全景のまま。
  else if (id === "cg_focus_sketch_cat") { if (!skipMode && !reducedMotion()) { dom.cg.classList.remove("cg-focus-sketch-blank"); dom.cg.classList.add("cg-focus-sketch-cat"); } }
  else if (id === "cg_focus_sketch_blank") { if (!skipMode && !reducedMotion()) { dom.cg.classList.remove("cg-focus-sketch-cat"); dom.cg.classList.add("cg-focus-sketch-blank"); } }
  else if (id === "cg_focus_sketch_reset") dom.cg.classList.remove("cg-focus-sketch-cat", "cg-focus-sketch-blank");
}

function scent(c1, c2) {
  const puff = el("div.vn-scent", { style: { "--c1": c1, "--c2": c2 } });
  layers.vn.append(puff);
  setTimeout(() => puff.remove(), 4200);
}

async function showCg(id, effect = "") {
  const r = running;
  const url = cgUrl(id);
  if (!url) return; // 素材待ちのCGは黙って飛ばす
  const loaded = await waitSceneAssets(imageReady(url, 15000), r);
  if (running !== r || !loaded) return;
  // effect:"cheki": シャッター→フラッシュ→フィルムが出てきて現像されたところで、同じ位置にCGを置く
  const place = (instant) => {
    if (running !== r) return;
    dom.cg.dataset.cg = id;
    dom.cg.style.backgroundImage = `url("${url}")`;
    if (instant) dom.cg.style.transition = "none";
    dom.cg.classList.add("show");
    if (instant) { void dom.cg.offsetWidth; dom.cg.style.transition = ""; }
  };
  if (effect === "cheki" && !vnTest.turbo) await chekiShot(url, () => place(true));
  if (running !== r) return;
  if (!dom.cg.classList.contains("show") || dom.cg.dataset.cg !== id) place(false);
  if (!vnTest.turbo) await visualSettled(dom.cg);
  if (running !== r) return;
  if (hooks.onCg) hooks.onCg(id);
}

/**
 * 退場し終えたCGの絵を手放す（#3500 C-12）。消えた後も background-image が残ると、会話が終わっても
 * 最後のCGのデコード済みの絵を抱えたままになりうるため。退場の途中で外すとフェードが切れるので、動きが終わってから外す。
 * その間に次のCGが出ていれば（show が付いていれば）触らない。
 */
function releaseCg() {
  const cg = dom.cg;
  if (!cg || cg.classList.contains("show")) return;
  visualSettled(cg).then(() => { if (!cg.classList.contains("show")) cg.style.backgroundImage = ""; }, () => {});
}

/** CSSの表示・退場が終わるまで待つ。SKIPでも途中の透明な絵を次の行で消さない。 */
async function visualSettled(node) {
  await nextFrame();
  await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})));
}

// ---------------------------------------------------------------- 台詞行

function queueIntro(cue) {
  if (!running.pendingIntros.some((pending) => pending.id === cue.id && (pending.variant || "") === (cue.variant || ""))) {
    running.pendingIntros.push(cue);
  }
}

// 読み進めた時点で、本人の立ち絵と発話を見た紹介だけを出す。
function introThenShow(line, show = showLine) {
  const r = running;
  // 回想は面識・紹介・相手の発話を発生させない。
  if (line?._romanceTransient) return show(line);
  const due = r.pendingIntros.filter(({ id, variant }) => r.spoken.has(id) && !state.flags[introSeenKey(id, variant || "")]);
  r.pendingIntros = r.pendingIntros.filter((cue) => !due.includes(cue));
  if (!due.length) return line ? show(line) : finish();
  if (vnTest.turbo) {
    due.forEach(({ id, variant }) => markIntroSeen(id, variant || ""));
    return line ? show(line) : finish();
  }
  r.ready = false;
  (async () => {
    for (const { id, variant, override } of due) await playIntro(id, { variant, override, onAppear: () => speakerBgm(id) });
    if (running !== r) return;
    r.ready = true;
    if (line) show(line); else finish();
  })();
}

async function showLine(line) {
  const r = running;
  if (!r) return;
  r.ready = false;
  clearTimeout(autoTimer);
  const images = linePortraits(line);
  const cutinCue = line._romanceTransient || skipMode || vnTest.turbo ? null : conversationCutinCue(r.currentId || r.id, line);
  const cutinSrc = cutinCue ? portraitInfo("hajime", cutinCue.face, "new")?.src : null;
  if (cutinSrc) images.push(cutinSrc);
  // 選択したUIの書体で折り返す。初回だけ代替フォントでページを決めない。
  const fontReady = Promise.all([dom.text, dom.name].map(node => {
    const type = getComputedStyle(node);
    const font = `${type.fontStyle} ${type.fontWeight} ${type.fontSize} ${type.fontFamily}`;
    return document.fonts.load(font, node === dom.text ? String(line.text || "あ") : "あ").catch(() => []);
  }));
  // 先読み16枚の外にある表情も、実際に使う行でデコードを待つ。
  const frameReady = imageReady(uiThemeFrame(document.documentElement.dataset.uiTheme), 15000, { keep:true });
  await waitSceneAssets(Promise.all([fontReady, frameReady, ...images.map((url) => imageReady(url, 15000))]), r);
  if (running !== r) return;
  if (line._romanceTransient && !r.hesitation?.model.current(state)) return finish(true);
  if (!line._romanceTransient && hooks.onLine) hooks.onLine(r.currentId || r.id, line);
  const speaker = String(line.speaker || "");
  const face = String(line.face || "");
  r.speaker = speaker;
  const scene = r.currentId && r.currentId !== r.id ? DB.dialogues[r.currentId] : r.dlg;
  if (speaker && speaker !== "hajime" && scene?.metadata?.contact_channel !== "lime") r.encountered.add(speaker);
  const name = lineDisplayName(line, r);
  // A line can retain its speaker/voice while using a dedicated cut instead of a portrait.
  const entrances = [updatePortraits(line.portrait === false ? "" : speaker, face)];
  // 無言の常連も会釈だけで場面に参加できる。名乗り・好感度の処理は発話と独立。
  if (line.portrait) {
    entrances.push(updatePortraits(line.portrait, line.portrait_face || "normal", true));
  }
  if (!vnTest.turbo) await Promise.all(entrances);
  if (running !== r) return;
  r.ready = true;
  if (!line._romanceTransient) speakerBgm(speaker);
  // 行付き演出（"fx":"shake" 等）／自動の軽演出（驚き・叫び）
  if (line.fx) runFx({ id: line.fx });
  else autoFx(line);
  // BGMの息継ぎ（#2828 採用29）: duck の行だけ今の曲を約 −6dB へ落とす。SKIP中・高速送りでは省く。
  if (line.duck && !skipMode && !vnTest.turbo) { r.ducked = true; duckBgm(DUCK_LEVEL, DUCK_IN_MS); }
  else releaseDuck(r);
  r.beat = beatMs(line.beat);
  // シーシャの仕組み解説の図解（#1128）。段階は絶対指定なのでSKIP・連打・LOADでも重ならない。
  if (line.diagram) showShishaDiagram(line.diagram, { still: reducedMotion() || skipMode || vnTest.turbo });
  let text = String(line.text || "");
  if (hooks.interpolate) text = hooks.interpolate(text);
  const cue = parseCue(text);
  dom.box.classList.toggle("reward", !!cue);
  if (cue) {
    applyCue(cue);
    const clauses = text.slice(2).split("。").filter(Boolean).flatMap((clause) => {
      if (!/【(技術|センス|根性|魅力|洞察)】/.test(clause) || !clause.includes("上がった")) return [clause];
      if (clause.includes("【好感度】")) {
        const word = CUE_AMOUNT.find(([w]) => clause.includes(w))?.[0] || "上がった";
        return [`【好感度】が${word}`];
      }
      return [];
    });
    text = clauses.length ? `……${clauses.join("。")}。` : "";
    if (!text) return next();
  }
  // 未読に到達した時点でSKIPを止める。最後まで送った行だけを既読にする。
  r.activeSeenKey = line._seenKey;
  if (skipMode && config.skipSeenOnly && !readSeenLines().has(r.activeSeenKey)) setSkip(false);
  let inner = playerInner(line);
  if (inner && hooks.interpolate) inner = hooks.interpolate(inner);
  log.push({ name, text: stripTags(text), ...(inner ? { inner: stripTags(inner) } : {}) });
  if (log.length > 300) log.shift();
  // 入場待ちの間は前の名札と本文をそろえて残す。以降はawaitを挟まず一緒に切り替える。
  if (speaker) {
    dom.name.textContent = name;
    dom.name.style.setProperty("--vn-name-length", String([...name].length));
    dom.name.title = name;
    dom.name.classList.add("show");
    nameFit.fit();
  } else {
    dom.name.classList.remove("show");
  }
  dom.box.classList.toggle("narration", !speaker);
  dom.box.classList.toggle("thought", speaker === "hajime" && /^（/.test(line.text || ""));
  // 心の声の薄墨（#2828 採用7）: 「（」で始まる行は誰の行でも薄墨・少し小さく出し、文字送りの音を鳴らさない。
  r.innerVoice = /^（/.test(stripTags(text));
  dom.box.classList.toggle("has-inner", !!inner);
  r.pages = dialoguePages(text, inner, dom.text, dom.inner);
  r.pageIdx = 0;
  if (!NO_PORTRAIT.has(speaker) && Object.hasOwn(r.slots, speaker)) {
    r.spoken.add(speaker);
    if (needsIntro(speaker)) queueIntro({ id: speaker });
  }
  if (line.intro_on_portrait && line.portrait && Object.hasOwn(r.slots, line.portrait)) {
    markMet(line.portrait);
    r.spoken.add(line.portrait);
    if (needsIntro(line.portrait)) queueIntro({ id: line.portrait });
  }
  if (cutinSrc) showCutin(r, cutinCue, cutinSrc);
  renderPage();
}

/** 会話カットイン（#2990）。台本で決めた行だけ、出せる条件（1会話1回・相手の立ち絵の枚数）を満たす時に出す */
function showCutin(r, cue, src) {
  const shown = [...dom.portraits.querySelectorAll("img")];
  const ok = conversationCutinAllowed(cue, {
    shown: r.cutinShown, skip: skipMode, turbo: vnTest.turbo,
    cg: dom.cg.classList.contains("show"), log: dom.log.classList.contains("show"), choices: !!r.waitingChoice,
    intro: r.pendingIntros.some(({ id, variant }) => r.spoken.has(id) && !state.flags[introSeenKey(id, variant || "")]),
    protagonistVisible: shown.some((img) => img.dataset.speaker === "hajime"),
    portraits: shown.length, portraitSpeakers: shown.map((img) => img.dataset.speaker),
  });
  if (!ok) return;
  r.cutinShown = true;
  cutin?.show(cue, src, { still: reducedMotion() });
}

// 報酬キュー: 「……【技術】と【センス】が少し上がった。」の規定フレーズを読んで加算する
// （1〜2=少し／3〜4=無印／5〜7=かなり／8〜=大きく）。台詞側の書式は CLAUDE.md が正本
const CUE_AMOUNT = [["大きく上がった", 8], ["かなり上がった", 6], ["少し上がった", 2], ["上がった", 3]];
const CUE_STAT = { 技術: "technique", センス: "sense", 根性: "guts", 魅力: "charm", 洞察: "insight" };
function parseCue(text) {
  if (!text.startsWith("……") || !text.includes("上がった")) return null;
  const gains = {};
  for (const clause of text.slice(2).split("。")) {
    const names = [...clause.matchAll(/【(技術|センス|根性|魅力|洞察|好感度)】/g)].map((m) => m[1]);
    const amt = (CUE_AMOUNT.find(([w]) => clause.includes(w)) || [null, 0])[1];
    for (const n of names) if (amt) gains[n] = (gains[n] || 0) + amt;
  }
  return Object.keys(gains).length ? gains : null;
}
function applyCue(gains) {
  for (const [ja, amt] of Object.entries(gains)) {
    if (CUE_STAT[ja]) applyStats({ [CUE_STAT[ja]]: amt });
    else if (ja === "好感度" && hooks.contextChar) dialogueAffinity(running, hooks.contextChar, amt * 3);
  }
}

function autoFx(line) {
  if (skipMode || vnTest.turbo) return;
  if (autoFxGap > 0) { autoFxGap--; return; }
  const t = String(line.text || "");
  let id = null;
  if (/[！!][！!]|[！!][？?]|[？?][！!]/.test(t)) id = "shake-soft";
  else if (line.face === "surprise" || /[…—][！!]/.test(t)) id = "imp";
  if (!id) return;
  autoFxGap = 6;
  if (id === "imp") flash("gold");
  else shake(document.getElementById("stage"), 300);
}

// 会話演出（#2828。#2732 の選別で採用）。どれも台本の印がある行だけで動き、SKIP・高速送り・瞬間表示では省く。
const PAUSE_MS = 400;                                  // [pause] で止まる長さ
const DUCK_LEVEL = 0.5, DUCK_IN_MS = 150, DUCK_OUT_MS = 400; // duck: 約 −6dB へ0.15秒で落とし、0.4秒で戻す
/** beat: true は0.5秒。数値（ms）は0.3〜0.8秒に収める */
function beatMs(beat) {
  if (beat === true) return 500;
  const ms = Number(beat);
  return Number.isFinite(ms) && ms > 0 ? Math.min(800, Math.max(300, ms)) : 0;
}
function releaseDuck(r) {
  if (!r?.ducked) return;
  r.ducked = false;
  duckBgm(1, DUCK_OUT_MS);
}

function renderPage() {
  const r = running;
  const page = r.pages[r.pageIdx];
  const raw = page.text;
  r.fullHtml = r.innerVoice ? `<span class="tx-voice">${formatHtml(raw)}</span>` : formatHtml(raw);
  r.fullInnerHtml = page.inner ? formatHtml(page.inner) : "";
  r.spokenLength = visibleLength(r.fullHtml);
  const total = r.spokenLength + visibleLength(r.fullInnerHtml);
  r.totalLength = total;
  // 文中ポーズ（#2828 採用3）: [pause] の位置で文字送りを止める。続きのページは発言を出し終えた所から始まる。
  r.pauses = page.continuation ? [] : pausePoints(raw).filter((at) => at > 0 && at < r.spokenLength);
  stopTyping(r);
  dom.next.classList.remove("show");
  const speed = vnTest.turbo ? 4 : config.textSpeed;
  if (speed >= 4 || skipMode) {
    r.typing = false;
    r.shown = total;
    renderTyped(total);
    dom.next.classList.add("show");
    kickAuto();
    return;
  }
  // 重要行（[imp]）は一拍の「溜め」を置いてから出す。beat の行（#2828 採用1）は台詞欄を空けたまま長めに溜める。
  const hold = r.pageIdx === 0 ? Math.max(raw.includes("[imp]") ? 380 : 0, r.beat || 0) : 0;
  r.typing = true;
  r.shown = page.continuation ? r.spokenLength : 0;
  renderTyped(r.shown);
  if (hold) r.typeTimer = setTimeout(() => startTypingInterval(r), hold);
  else startTypingInterval(r);
  kickAuto();
}

// 文字送りは描画のフレームに合わせて進める（#3500 C-22）。速度1〜3は従来どおり「46／26／12ms ごとに step 文字」で、
// その送りの回数を経過時間から数え、そのフレームまでに来た送りをまとめて当てて、描画は1フレームに1回にする。
// 1秒あたりの文字数・[pause] の位置と長さ（0.4秒）・送り音の間隔は従来と同じ。負荷で間隔が乱れても文字数が時間に追いつく。
const nextTypeFrame = (fn) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);
const cancelTypeFrame = (id) => typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id);
function stopTyping(r) {
  if (!r) return;
  clearInterval(r.typeTimer);
  clearTimeout(r.typeTimer);
  if (r.typeFrame) cancelTypeFrame(r.typeFrame);
  r.typeFrame = 0;
}

function startTypingInterval(r = running) {
  if (!r || !r.typing) return;
  stopTyping(r);
  const speed = vnTest.turbo ? 4 : config.textSpeed;
  if (speed >= 4 || skipMode) {
    completeTyping();
    return;
  }
  const interval = { 1: 46, 2: 26, 3: 12 }[speed] || 26;
  const total = r.totalLength ?? (r.spokenLength + visibleLength(r.fullInnerHtml));
  const step = Math.max(1, Math.round(total / 90));
  const started = performance.now();
  let ticks = 0;
  const frame = () => {
    r.typeFrame = 0;
    if (running !== r || !r.typing) return;
    // フレームの時刻ではなく今の時刻で数える（重い時はフレームが遅れて呼ばれるため）
    const due = Math.floor((performance.now() - started) / interval);
    const before = r.shown;
    let pause, blip = false;
    while (ticks < due) {
      ticks++;
      const from = r.shown || 0;
      pause = r.pauses?.find((at) => at > from && at <= from + step);
      r.shown = pause ?? from + step;
      if (r.shown <= r.spokenLength && r.shown % 3 < step && !r.innerVoice) blip = true;
      if (r.shown >= total || pause !== undefined) break;
    }
    if (r.shown !== before) renderTyped(r.shown);
    if (blip) SE.blip(r.speaker);
    if (r.shown >= total) return completeTyping();
    // ▼は出さずに一拍止まり、続きを送る。止まっている間のクリックは本文を最後まで出す（typing のまま）。
    if (pause !== undefined) {
      r.typeTimer = setTimeout(() => startTypingInterval(r), PAUSE_MS);
      return;
    }
    r.typeFrame = nextTypeFrame(frame);
  };
  r.typeFrame = nextTypeFrame(frame);
}

// 本文・心の声は、前回の続きから増えた文字だけを足す（#3500 C-21。作られる DOM は sliceHtml を innerHTML に入れた時と同じ）。
const typedWriters = new WeakMap();
function typedInto(node) {
  let write = typedWriters.get(node);
  if (!write) typedWriters.set(node, write = createTypedHtml(node));
  return write;
}

function renderTyped(shown) {
  const r = running;
  typedInto(dom.text)(r.fullHtml, Math.min(shown, r.spokenLength));
  const innerShown = Math.max(0, shown - r.spokenLength);
  const hideInner = !r.fullInnerHtml || innerShown === 0;
  if (dom.inner.hidden !== hideInner) dom.inner.hidden = hideInner;
  typedInto(dom.inner)(r.fullInnerHtml, innerShown);
}

function completeTyping() {
  const r = running;
  if (!r) return;
  stopTyping(r);
  r.typing = false;
  const total = r.totalLength ?? (r.spokenLength + visibleLength(r.fullInnerHtml));
  r.shown = total;
  renderTyped(total);
  dom.next.classList.add("show");
  kickAuto();
}

// ---------------------------------------------------------------- 立ち絵

function updatePortraits(speaker, face, explicit = false) {
  const r = running;
  let entrance = Promise.resolve();
  const info = speaker && canShowPortrait(speaker, explicit) ? portraitInfo(speaker, face) : null;
  if (info) {
    let img = dom.portraits.querySelector(`img[data-speaker="${speaker}"]`);
    if (!img) {
      const used = Object.values(r.slots);
      let slot = [0, 1].find((s) => !used.includes(s));
      if (slot === undefined) {
        const oldest = Object.keys(r.slots)[0];
        slot = r.slots[oldest];
        delete r.slots[oldest];
        dom.portraits.querySelector(`img[data-speaker="${oldest}"]`)?.remove();
      }
      r.slots[speaker] = slot;
      img = el(skipMode || vnTest.turbo ? "img.portrait" : "img.portrait.enter", { alt: "", dataset: { speaker, slot: String(slot) }, draggable: "false" });
      img.onerror = () => { img.remove(); delete r.slots[speaker]; layoutPortraits(); };
      dom.portraits.append(img);
      // SKIP中は入場のためのフレーム待ちとアニメーションを作らず、名前・本文と一緒に出す。
      if (!skipMode && !vnTest.turbo) entrance = (async () => {
        await nextFrame(); await nextFrame();
        if (running !== r || !img.isConnected) return;
        img.classList.remove("enter");
        await visualSettled(img);
      })();
    }
    img.dataset.face = face || "normal";
    if (img.getAttribute("src") !== info.src) img.src = info.src;
    frame(img, info);
  }
  for (const img of dom.portraits.querySelectorAll("img")) img.classList.toggle("active", img.dataset.speaker === speaker);
  layoutPortraits();
  return entrance;
}

/** 透過余白の差を補正し、本体の高さ・足元位置をキャラ間でそろえる */
function frame(img, p) {
  const pakki = p.folder === "pakki", cat = p.folder === "tetsuko";
  const target = (cat ? FRAMING.catTarget : pakki ? FRAMING.pakkiTarget : FRAMING.target) * p.scale;
  const sink = cat ? -FRAMING.catLift : pakki ? FRAMING.pakkiSink : FRAMING.sink;
  const hPct = Math.min(target / p.h, 2.4) * 100;             // 画像の高さ（ステージ高さ比 %）
  const contentTop = (p.h + (p.topOverhang || 0)) * hPct - sink * 100; // 小物も含む上端。人物の倍率は通常基準。
  const extra = Math.max(0, contentTop - 97);                // 頭が見切れないように沈める
  img.style.height = `${hPct}%`;
  img.style.bottom = `${-(p.b * hPct + sink * 100 + extra)}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

function layoutPortraits() {
  const imgs = [...dom.portraits.querySelectorAll("img")];
  dom.portraits.dataset.count = String(imgs.length);
  for (const img of imgs) {
    const pos = imgs.length <= 1 ? "center" : img.dataset.slot === "0" ? "left" : "right";
    img.dataset.pos = pos;
  }
}

// ---------------------------------------------------------------- 選択肢

function showChoices(line) {
  const r = running;
  r.waitingChoice = true;
  r.choiceLine = line;
  // 実回答の記録はpickChoiceのフックへ。占いは対象/期限/台詞照合済みの2択だけ示す。
  const fortuneHint = fortuneChoiceIndex(state, r.id, line, DB.fortuneHints);
  const growthHint = growthChoiceIndex(state, r.currentId || r.id, line, DB.fortuneHints, r.growthScene);
  const reasons = [];
  const buttons = (line.choices || []).map((c, i) => {
    const shortfall = c.condition_type === "money" ? Number(c.threshold || 0) - state.money : 0;
    const hint = i === fortuneHint ? "占いの予感" : i === growthHint ? "会話の気配" : null;
    const reasonId = `vn-choice-money-reason-${i}`;
    const button = el(`button.vn-choice${i === fortuneHint ? ".fortune-hint" : ""}${i === growthHint ? ".growth-hint" : ""}`, {
      html: formatHtml(c.text || "……"),
      "aria-label": shortfall > 0 ? `${c.text || "……"}${hint ? `（${hint}）` : ""}` : hint ? `${c.text}（${hint}）` : null,
      "aria-describedby": shortfall > 0 ? reasonId : null,
      "aria-disabled": shortfall > 0 ? "true" : null,
      style: { animationDelay: `${i * 80}ms` },
      dataset: { test: `choice-${i}` },
      onclick: (e) => { e.stopPropagation(); if (shortfall <= 0) pickChoice(line, c); },
    });
    reasons.push(shortfall > 0 ? el("span.vn-choice-reason", { id: reasonId, text: `所持金不足（あと${shortfall.toLocaleString("ja-JP")}円）` }) : null);
    return button;
  });
  dom.choices.replaceChildren(...buttons);
  dom.choices.classList.add("show");
  buttons.find((button) => button.getAttribute("aria-disabled") !== "true")?.focus();
  // 選択肢は1行（GUI22）。文言は全角26字以内で書く。差し込みで長くなったときだけ字を縮める
  buttons.forEach((b, i) => {
    // 本文だけ従来の下限で測り、補足によって本文の字が縮まないようにする。
    fitOneLine(b, 18);
    if (reasons[i]) b.append(reasons[i]);
  });
  kickAuto();
}

function autoChoose() {
  const r = running;
  if (!r || !r.waitingChoice) return;
  const btns = [...dom.choices.querySelectorAll(".vn-choice")];
  const idx = vnTest.choose ? vnTest.choose(r.id, btns.map((b) => b.textContent)) : 0;
  btns[Math.max(0, Math.min(btns.length - 1, idx | 0))]?.click();
}

function pickChoice(line, c) {
  const r = running;
  // 取り外したボタンの二度押しも、LOAD前の選択も適用しない。
  if (!r || !r.waitingChoice || r.choiceLine !== line || !line.choices?.includes(c)) return;
  if (r.owner !== state) return finish(true);
  SE.select();
  r.waitingChoice = false;
  dom.choices.classList.remove("show");
  dom.choices.replaceChildren();
  if (line._romanceTransient) return resumeRomanceHesitation(c.action);
  const model = createRomanceHesitation(state, romanceIntent(state, r.currentId || r.id, line, c, DB.dialogues));
  if (model) {
    setAuto(false); setSkip(false);
    r.hesitation = {
      model, line, choice: c, queue: r.queue,
      slots: { ...r.slots }, portraits: [...dom.portraits.childNodes],
      boxClass: dom.box.className,
      display: [dom.name, dom.text, dom.inner, dom.next].map(node => ({
        node, html: node.innerHTML, className: node.className, style: node.style.cssText, title: node.title,
      })),
    };
    // 元の立ち絵ノードは退避したまま保ち、回想中のactive/表情更新を当てない。
    dom.portraits.replaceChildren(); r.slots = {};
    return showRomanceHesitation();
  }
  applyChoice(line, c);
}

// 同じ running の中に一時的な行だけを差し込む。play() をネストせず、保存も会話フックも呼ばない。
function showRomanceHesitation() {
  const r = running;
  const view = r.hesitation.model.view();
  const transient = line => ({ ...line, _romanceTransient: true });
  r.queue = [
    ...view.lines.map(transient),
    ...(view.memories || []).flatMap(memory => [
      { type: "romance_memory" },
      transient({ ...memory.line, ...(memory.portrait ? { portrait: memory.portrait.id, portrait_face: memory.portrait.face } : {}) }),
    ]),
    transient({ type: "choice", choices: view.choices }),
  ];
  next();
}

function restoreRomanceHesitation() {
  const r = running, saved = r.hesitation;
  r.queue = saved.queue;
  r.slots = saved.slots;
  dom.portraits.replaceChildren(...saved.portraits);
  refreshPortraits(); // 回想中に画風を変えていたら、元の相手も現在の設定へ合わせる。
  layoutPortraits();
  dom.box.className = saved.boxClass;
  for (const { node, html, className, style, title } of saved.display) {
    node.innerHTML = html; node.className = className; node.style.cssText = style; node.title = title;
  }
  r.hesitation = null;
  return saved;
}

function resumeRomanceHesitation(action) {
  const r = running, saved = r?.hesitation;
  if (!saved) return;
  if (r.owner !== state || !saved.model.current(state)) return finish(true);
  if (action === "apply") {
    restoreRomanceHesitation();
    if (saved.model.kind === "commit" && r.romanceWarningGuilt && !r.romanceWarningGuiltPaid) {
      state.guilt = (state.guilt || 0) + 1;
      r.romanceWarningGuiltPaid = true;
    }
    return applyChoice(saved.line, saved.choice);
  }
  const result = saved.model.choose(action, state);
  if (result.status === "pending") return showRomanceHesitation();
  if (result.status === "accepted") {
    r.queue = [...result.apology.map(line => ({ ...line, _romanceTransient: true })), { type: "romance_hesitation", action: "apply" }];
    return next();
  }
  restoreRomanceHesitation();
  showChoices(saved.line);
}

function applyChoice(line, c) {
  const r = running;
  const key = String(c.next || "");
  let waitForScene = false;
  if (key && r.branches[key]) insertBranch(r, key);
  else if (c.next_id) waitForScene = jumpTo(String(c.next_id));
  else if (key) warnVn("branch-unresolved", key);
  log.push({ name: "▶", text: stripTags(c.text || "") });
  if (hooks.onChoice) hooks.onChoice(r.currentId || r.id, String(line.id || ""), key, String(c.next_id || ""), c, line);
  if (!waitForScene) next();
}

// ---------------------------------------------------------------- ログ・用語

function closeLog() {
  dom.log.classList.remove("show");
  dom.controls.querySelector('[data-test="vn-log"]')?.focus();
  kickAuto();
}

function openLog() {
  cutin?.clear();
  SE.select();
  clearTimeout(autoTimer);
  const list = el("div.log-list", log.slice(-120).map((l) => el("div.log-row", [
    l.name ? el("b", { text: l.name }) : null,
    el("span", { text: l.text }),
    l.inner ? el("div.log-inner", { text: l.inner, "aria-label": "ひよりの本心（はじめには聞こえない）" }) : null,
  ])));
  dom.log.replaceChildren(
    el("div.log-head", [el("span", { text: "LOG" }), el("button.btn.small", { text: "閉じる", onclick: (e) => { e.stopPropagation(); closeLog(); } })]),
    list,
  );
  dom.log.classList.add("show");
  dom.log.querySelector(".log-head button")?.focus();
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
}

async function openGlossary() {
  SE.select();
  clearTimeout(autoTimer);
  vnModalOpen++;
  try {
    await modal({ title: "用語集", body: glossaryPanel(), options: [{ label: "閉じる", value: true, primary: true }], className: "glossary-modal" });
  } finally { vnModalOpen--; }
  if (document.activeElement?.closest?.(".vn-controls")) document.activeElement.blur();
  kickAuto();
}

async function openSettings() {
  SE.select();
  clearTimeout(autoTimer);
  if (running?.typing) {
    stopTyping(running);
  }
  vnModalOpen++;
  try {
    await openVnConfig({
      onChange(key) {
        if (key === "portraitStyle") refreshPortraits();
        if (key === "uiTheme") nameFit?.fit();
        if (key === "textSpeed" && running?.typing && config.textSpeed >= 4) completeTyping();
      },
    });
  } finally { vnModalOpen--; }
  if (document.activeElement?.closest?.(".vn-controls")) document.activeElement.blur();
  if (running?.typing) startTypingInterval(running);
  kickAuto();
}

/** 設定とDBG共通。会話の進行・LOG・人物の並びは変えず、表示中の画風だけ更新する。 */
function refreshPortraits() {
  if (!running) return;
  for (const image of dom.portraits.querySelectorAll("img")) {
    const info = portraitInfo(image.dataset.speaker, image.dataset.face);
    if (!info) continue;
    image.src = info.src;
    frame(image, info);
  }
}

export const isPlaying = () => !!running;
export { refreshPortraits };
export const backlog = () => log;
/** タイトルからの「はじめから」「LOAD」で前の周の会話LOGを消す（#1912）。 */
export function clearLog() { log.length = 0; }



