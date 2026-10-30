import { notifyMastery } from "../core/mastery-notice.js";
import { learnFlavorStory } from "../core/flavor-mastery.js";
import { awardLoverSceneExp } from "../core/lover-rewards.js";
import { tournamentFinished } from "../core/story-context.js";
import { basicsExperienced } from "../craft/practice-history.js";
// 会話エンジン。data/dialogue/*.json のスキーマをそのまま解釈する。
//   play(idOrDialogue, opts) → Promise（会話が終わると解決）
// 分岐（condition / choice）の行は「残りの行の前」に差し込む（旧版・Godot版と同じ挙動）。
import { createNameFit } from "./name-fit.js";
import { uiThemeFrame } from "../core/ui-theme.js";
import { fortuneChoiceIndex } from "../core/fortune-effects.js";
import { el, sleep, fitOneLine, nextFrame } from "../core/util.js";
import { DB, displayName, portraitInfo, sceneBg, cgUrl, preload } from "../core/data.js";
import { loadVnFonts } from "../core/vn-fonts.js";
import { state, markMet, STAT_EN, timeOfDay, config } from "../core/state.js";
import { applyStats, gainAffinity, addMoney, affinityLevel } from "../core/stats.js";
import { setBg, layers, toast, flash, shake, modal, dropRetired, imageReady } from "../core/ui.js";
import { SE, playSe, playBgm, currentBgm } from "../core/audio.js";
import { formatHtml, sliceHtml, visibleLength, stripTags } from "./text.js";
import { playerInner } from "./inner.js";
import { dialoguePages } from "./layout.js";
import { glossaryPanel } from "./glossary.js";
import { rememberRelationship, relationshipReflectionLines } from "../core/relationships.js";
import { needsIntro, playIntro, markIntroSeen, introSeenKey } from "./intro.js";
import { buyKeepsake } from "../core/keepsakes.js";
import { chekiShot, tarotFlip, limeExchange, purikuraShot } from "../core/scene-motions.js";
import { showShishaDiagram, hideShishaDiagram } from "./shisha-diagram.js";
import { reducedMotion } from "../core/transition-kit.js";

// 立ち絵を出さない話者（主人公は一人称視点）
const NO_PORTRAIT = new Set(["hajime", "hazime", "", "everyone", "customer", "shop_clerk", "old_man", "traveler"]);
// 立ち絵の枠（ステージ高さに対する本体の高さ・足元の沈み込み）
const FRAMING = { target: 1.36, sink: 0.4, pakkiTarget: 0.94, pakkiSink: 0.08 };

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
let settingsReady = null;
let openVnConfig = null;
let running = null;     // 再生中の会話の状態
let autoMode = false;
let skipMode = false;
let autoFxGap = 0;
let sequenceDepth = 0;

/** 一続きの会話（バイト開始→接客→終了）の間だけSKIPを維持。選択肢は自分で選び、行動の終わりに解除する。 */
export async function dialogueSequence(run) {
  sequenceDepth++;
  try { return await run(); }
  finally { if (--sequenceDepth === 0) setSkip(false); }
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
  host.replaceChildren(dom.effect, dom.cg, dom.portraits, dom.box, dom.choices, dom.controls, dom.log);
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
    if (dom.log.classList.contains("show")) return;
    if (e.key === "Enter" || e.key === " ") {
      // フォーカス中のボタン・入力欄はブラウザ本来のキー操作に任せる。
      if (e.target?.closest?.("button, a[href], input, select, textarea, [contenteditable]")) return;
      e.preventDefault(); advance();
    }
    if (e.key === "Control") setSkip(true);
  });
  window.addEventListener("keyup", (e) => { if (e.key === "Control") setSkip(false); });
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
  if (v) setAuto(false);
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
  const delay = vnTest.turbo ? 5 : skipMode ? 25 : running.typing ? 200 : 1200 + visibleLength((running.fullHtml || "") + (running.fullInnerHtml || "")) * 45;
  autoTimer = setTimeout(() => {
    if (!running || dom.log.classList.contains("show") || vnModalOpen) return;
    if (running.typing && !vnTest.turbo && !skipMode) return kickAuto();
    advance();
  }, delay);
}

// ---------------------------------------------------------------- 再生

/** 同じ背景へ続く会話でも、長い素材待ちには案内を出す。既存のreadyガードで操作を保護する。 */
function waitSceneAssets(task, owner = running, assets = task.assetsReady || task) {
  let notice = null;
  const timer = setTimeout(() => {
    if (running !== owner) return;
    notice = el("div.vn-loading", { role: "status", "aria-live": "polite",
      text: "場面を準備しています…", dataset: { test: "vn-loading" } });
    layers.fx.append(notice);
  }, 500);
  const loaded = Promise.resolve(assets).finally(() => { clearTimeout(timer); notice?.remove(); });
  // 場面転換の演出は最後まで待つが、取得・デコード済みなら読み込み表示を延長しない。
  return Promise.all([task, loaded]).then(([value]) => value);
}

/**
 * 会話を再生する。
 * @param idOrDlg dialogue_id か dialogue オブジェクト
 * @param opts.bg  背景の上書き（res:// パス可）
 * @param opts.signal 呼出し元が場面を破棄したとき、読了・末尾報酬なしで閉じる
 * @param opts.cancelOnSkip SKIPを中断として扱い、呼出し元で次回の再読を可能にする
 */
export function play(idOrDlg, opts = {}) {
  if (!dom) buildDom();
  const dlg = typeof idOrDlg === "string" ? DB.dialogues[idOrDlg] : idOrDlg;
  if (opts.signal?.aborted) return Promise.resolve({ id: dlg?.dialogue_id || "", visited: [], cancelled: true });
  if (!dlg) {
    warnVn("dialogue-not-found", idOrDlg);
    return Promise.resolve();
  }
  if (!(dlg.lines || []).length) warnVn("dialogue-empty", dlg.dialogue_id || "");
  return new Promise((resolve) => {
    layers.fx.querySelector(".vn-loading")?.remove();
    running = {
      owner: state,
      id: dlg.dialogue_id || "", // 開始台本。finish() の報酬と play() の解決値はこの台本に属する（仕様・#1362）
      currentId: dlg.dialogue_id || "", // 表示中の台本。jumpTo で jump 先へ進む
      dlg,
      queue: (dlg.lines || []).slice(),
      branches: dlg.branches || {},
      resolve,
      cancelOnSkip: !!opts.cancelOnSkip,
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
    sceneBgm(meta);
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
    const assetsReady = Promise.all([settingsReady, fontsReady, bgReady.assetsReady || bgReady, ...portraitsReady.map((u) => imageReady(u, 15000))]);
    waitSceneAssets(bgReady, me, assetsReady).then(() => {
      if (running !== me) return;
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

/** 実際にこの行に出す立ち絵。無言の同席者と話者が別なら両方待つ。 */
function linePortraits(line) {
  return [...new Set([
    line.portrait !== false && !NO_PORTRAIT.has(line.speaker || "") ? portraitInfo(line.speaker, line.face)?.src : null,
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

function prefetch(dlg) {
  if (!dlg) return;
  const urls = new Set();
  const collect = (lines) => {
    for (const l of lines || []) {
      const character = l.portrait === false ? null : l.portrait || l.speaker;
      if (character && !NO_PORTRAIT.has(character)) {
        const p = portraitInfo(character, l.portrait_face || l.face);
        if (p) urls.add(p.src);
      }
      if (l.type === "show_cg") urls.add(cgUrl(l.cg_id));
    }
  };
  collect(dlg.lines);
  Object.values(dlg.branches || {}).forEach(collect);
  preload([...urls].slice(0, 16), 0);
}

// 仕様（#1362）: 報酬（metadata / growth_stats）と解決値の id は開始台本（running.id / running.dlg）に属し、
// jump 先の台本へは差し替えない。表示中の台本 ID は running.currentId が持つ。
function finish(cancelled = false) {
  const r = running;
  running = null;
  clearTimeout(autoTimer);
  clearInterval(r.typeTimer); clearTimeout(r.typeTimer);
  r.removeAbort?.();
  const meta = r.dlg.metadata || {};
  // metadata / growth_stats の報酬（会話の最後にまとめて付く）
  if (!cancelled && meta.add_stat) applyStats(meta.add_stat);
  if (!cancelled && meta.add_affinity) for (const [id, n] of Object.entries(meta.add_affinity)) gainAffinity(id, n * 6);
  if (!cancelled && r.dlg.growth_stats) applyStats(r.dlg.growth_stats);
  if (!cancelled && meta.flavor_lesson) notifyMastery(learnFlavorStory(state, r.dlg, DB.flavorById));
  if (!cancelled) awardLoverSceneExp(r.id, r.owner);
  layers.vn.classList.remove("active");
  document.body.classList.remove("in-vn", "vn-open");
  dom.cg.classList.remove("show");
  dom.portraits.replaceChildren();
  hideShishaDiagram(); // 会話終了（SKIP/キャンセル含む）で図解を片付ける（#1128）
  dom.effect.dataset.effect = "";
  layers.vn.classList.remove("sepia", "flashback");
  if (!sequenceDepth) setSkip(false);
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
  // 読み終えた行の合図を、次の行の画像待ち・制御行へ持ち越さない。
  dom.next.classList.remove("show");
  r.pages = null;
  // 制御行はまとめて処理し、表示する台詞行に着いたら止まる
  for (;;) {
    const line = r.queue.shift();
    if (line === undefined) return introThenShow();
    const type = line.type || "";
    if (!type) return introThenShow(line);
    if (type === "choice") return showChoices(line);
    if (type === "game_over") return finish();
    if (type === "condition") { if (handleCondition(line)) return; continue; }
    if (type === "jump") { if (!line.next_id) warnVn("jump-missing-next-id", r.currentId || r.id); else if (jumpTo(line.next_id)) return; continue; }
    if (type === "set_flag") {
      const contact = /^_lime_contact_(.+)$/.exec(line.flag || "");
      const alreadyConnected = contact && (state.flags[line.flag] || state.contacts.includes(contact[1]));
      state.flags[line.flag] = true;
      const m = /^_met_(.+)$/.exec(line.flag || "");
      if (m) {
        markMet(m[1]);
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
      const run = { tarot: () => tarotFlip(), lime: () => limeExchange(line.char_id, line.context), purikura: () => purikuraShot() }[line.id];
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
      if (branch && r.branches[branch]) r.queue.unshift(...r.branches[branch]);
      continue;
    }
    if (type === "hide_cg") {
      r.ready = false;
      dom.cg.classList.remove("show", "cg-focus-window", "cg-focus-sketch-cat", "cg-focus-sketch-blank");
      visualSettled(dom.cg).then(() => { if (running === r) { r.ready = true; next(); } });
      return;
    }
    if (type === "apply") { applyLine(line); continue; }
    if (type === "note") { onNote(line); continue; }
    if (type === "remember") { rememberRelationship(line.memory_id); continue; }
    if (type === "reflection") { r.queue.unshift(...relationshipReflectionLines()); continue; }
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
    if (type === "fx") { runFx(line); continue; }
    // 未知の行タイプは黙って飛ばす（データ先行で書けるように）
  }
}

function jumpTo(id) {
  const target = DB.dialogues[id];
  if (!target) { warnVn("jump-target-missing", id); return; }
  // 表示中の台本として currentId を引き継ぐ。id / dlg は開始台本のまま（finish() の仕様・#1362）
  running.currentId = id;
  running.queue = (target.lines || []).slice();
  running.branches = target.branches || {};
  running.context = sceneContext(target);
  if (target.metadata?.clear_portraits) {
    dom.portraits.replaceChildren();
    running.slots = {};
  }
  running.visited.push(id);
  sceneBgm(target.metadata);
  if (hooks.onEnter) hooks.onEnter(id, target);
  prefetch(target);
  if (target.metadata?.bg) {
    const r = running;
    r.ready = false;
    waitSceneAssets(sceneSetBg(target.metadata.bg, firstPortraits(target)), r).then(() => { if (running === r) { r.ready = true; next(); } });
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
  } else if (kind === "affinity") {
    ok = affinityLevel(line.char_id) >= Number(line.threshold || 0);
  } else {
    const v = hooks.evalCondition ? hooks.evalCondition(line) : undefined;
    if (v === undefined) { warnVn("condition-unknown", kind); ok = false; }
    else ok = !!v;
  }
  const key = String((ok ? line.next_true : line.next_false) || "");
  if (key && running.branches[key]) running.queue.unshift(...running.branches[key]);
  else if (key && DB.dialogues[key]) return jumpTo(key);
  else if (key) warnVn("branch-unresolved", key);
}

function applyLine(line) {
  if (line.stats) applyStats(line.stats);
  if (line.money) addMoney(line.money);
  if (line.affinity) for (const [id, n] of Object.entries(line.affinity)) gainAffinity(id, n * 6);
}

function onNote(line) {
  state.flags[`_note_${line.note_id}`] = true;
  toast(`📝 メモした ──「${line.label || "話の要点"}」`, { kind: "good" });
}

function runFx(line) {
  const id = line.id;
  autoFxGap = 6;
  if (id === "shake") { shake(); SE.hit(); }
  else if (id === "flash" || id === "imp") flash(id === "imp" ? "gold" : "white");
  else if (id === "cutin") { flash("gold"); SE.just(); }
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
function introThenShow(line) {
  const r = running;
  const due = r.pendingIntros.filter(({ id, variant }) => r.spoken.has(id) && !state.flags[introSeenKey(id, variant || "")]);
  r.pendingIntros = r.pendingIntros.filter((cue) => !due.includes(cue));
  if (!due.length) return line ? showLine(line) : finish();
  if (vnTest.turbo) {
    due.forEach(({ id, variant }) => markIntroSeen(id, variant || ""));
    return line ? showLine(line) : finish();
  }
  r.ready = false;
  (async () => {
    for (const { id, variant, override } of due) await playIntro(id, { variant, override, onAppear: () => speakerBgm(id) });
    if (running !== r) return;
    r.ready = true;
    if (line) showLine(line); else finish();
  })();
}

async function showLine(line) {
  const r = running;
  if (!r) return;
  r.ready = false;
  clearTimeout(autoTimer);
  const images = linePortraits(line);
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
  if (hooks.onLine) hooks.onLine(r.currentId || r.id, line);
  const speaker = String(line.speaker || "");
  const face = String(line.face || "");
  r.speaker = speaker;
  const name = speaker === "samechan" && line.voice === "korochan" ? "コロちゃん"
    : speaker ? displayName(speaker, state, { context: r.context }) : "";
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
  // A line can retain its speaker/voice while using a dedicated cut instead of a portrait.
  const entrances = [updatePortraits(line.portrait === false ? "" : speaker, face)];
  // 無言の常連も会釈だけで場面に参加できる。名乗り・好感度の処理は発話と独立。
  if (line.portrait) {
    entrances.push(updatePortraits(line.portrait, line.portrait_face || "normal"));
  }
  if (!vnTest.turbo) await Promise.all(entrances);
  if (running !== r) return;
  r.ready = true;
  speakerBgm(speaker);
  // 行付き演出（"fx":"shake" 等）／自動の軽演出（驚き・叫び）
  if (line.fx) runFx({ id: line.fx });
  else autoFx(line);
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
  let inner = playerInner(line);
  if (inner && hooks.interpolate) inner = hooks.interpolate(inner);
  log.push({ name, text: stripTags(text), ...(inner ? { inner: stripTags(inner) } : {}) });
  if (log.length > 300) log.shift();
  dom.box.classList.toggle("has-inner", !!inner);
  r.pages = dialoguePages(text, inner, dom.text, dom.inner);
  r.pageIdx = 0;
  if (!NO_PORTRAIT.has(speaker) && Object.hasOwn(r.slots, speaker)) {
    r.spoken.add(speaker);
    if (needsIntro(speaker)) queueIntro({ id: speaker });
  }
  renderPage();
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
    else if (ja === "好感度" && hooks.contextChar) gainAffinity(hooks.contextChar, amt * 3);
  }
}

function autoFx(line) {
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

function renderPage() {
  const r = running;
  const page = r.pages[r.pageIdx];
  const raw = page.text;
  r.fullHtml = formatHtml(raw);
  r.fullInnerHtml = page.inner ? formatHtml(page.inner) : "";
  r.spokenLength = visibleLength(r.fullHtml);
  const total = r.spokenLength + visibleLength(r.fullInnerHtml);
  r.totalLength = total;
  clearInterval(r.typeTimer);
  clearTimeout(r.typeTimer);
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
  // 重要行（[imp]）は一拍の「溜め」を置いてから出す
  const hold = raw.includes("[imp]") && r.pageIdx === 0 ? 380 : 0;
  r.typing = true;
  r.shown = page.continuation ? r.spokenLength : 0;
  renderTyped(r.shown);
  if (hold) r.typeTimer = setTimeout(() => startTypingInterval(r), hold);
  else startTypingInterval(r);
  kickAuto();
}

function startTypingInterval(r = running) {
  if (!r || !r.typing) return;
  clearInterval(r.typeTimer);
  clearTimeout(r.typeTimer);
  const speed = vnTest.turbo ? 4 : config.textSpeed;
  if (speed >= 4 || skipMode) {
    completeTyping();
    return;
  }
  const interval = { 1: 46, 2: 26, 3: 12 }[speed] || 26;
  const total = r.totalLength ?? (r.spokenLength + visibleLength(r.fullInnerHtml));
  const step = Math.max(1, Math.round(total / 90));
  r.typeTimer = setInterval(() => {
    r.shown = (r.shown || 0) + step;
    renderTyped(r.shown);
    if (r.shown <= r.spokenLength && r.shown % 3 < step) SE.blip(r.speaker);
    if (r.shown >= total) completeTyping();
  }, interval);
}

function renderTyped(shown) {
  const r = running;
  dom.text.innerHTML = sliceHtml(r.fullHtml, Math.min(shown, r.spokenLength));
  const innerShown = Math.max(0, shown - r.spokenLength);
  dom.inner.hidden = !r.fullInnerHtml || innerShown === 0;
  dom.inner.innerHTML = innerShown ? sliceHtml(r.fullInnerHtml, innerShown) : "";
}

function completeTyping() {
  const r = running;
  if (!r) return;
  clearInterval(r.typeTimer);
  clearTimeout(r.typeTimer);
  r.typing = false;
  const total = r.totalLength ?? (r.spokenLength + visibleLength(r.fullInnerHtml));
  r.shown = total;
  renderTyped(total);
  dom.next.classList.add("show");
  kickAuto();
}

// ---------------------------------------------------------------- 立ち絵

function updatePortraits(speaker, face) {
  const r = running;
  let entrance = Promise.resolve();
  const info = speaker && !NO_PORTRAIT.has(speaker) ? portraitInfo(speaker, face) : null;
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
      img = el("img.portrait.enter", { alt: "", dataset: { speaker, slot: String(slot) }, draggable: "false" });
      img.onerror = () => { img.remove(); delete r.slots[speaker]; layoutPortraits(); };
      dom.portraits.append(img);
      entrance = (async () => {
        await nextFrame(); await nextFrame();
        if (running !== r || !img.isConnected) return;
        img.classList.remove("enter");
        await visualSettled(img);
      })();
    }
    if (img.getAttribute("src") !== info.src) img.src = info.src;
    frame(img, info);
  }
  for (const img of dom.portraits.querySelectorAll("img")) img.classList.toggle("active", img.dataset.speaker === speaker);
  layoutPortraits();
  return entrance;
}

/** 透過余白の差を補正し、本体の高さ・足元位置をキャラ間でそろえる */
function frame(img, p) {
  const pakki = p.folder === "pakki";
  const target = (pakki ? FRAMING.pakkiTarget : FRAMING.target) * p.scale;
  const sink = pakki ? FRAMING.pakkiSink : FRAMING.sink;
  const hPct = Math.min(target / p.h, 2.4) * 100;             // 画像の高さ（ステージ高さ比 %）
  const contentTop = p.h * hPct - sink * 100;                // 本体上端（下からの %）
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
  // 実回答の記録はpickChoiceのフックへ。占いは対象/期限/台詞照合済みの2択だけ示す。
  const fortuneHint = fortuneChoiceIndex(state, r.id, line, DB.fortuneHints);
  const buttons = (line.choices || []).map((c, i) => el(`button.vn-choice${i === fortuneHint ? ".fortune-hint" : ""}`, {
    html: formatHtml(c.text || "……"),
    "aria-label": i === fortuneHint ? `${c.text}（占いの予感）` : null,
    disabled: c.condition_type === "money" && state.money < Number(c.threshold || 0),
    style: { animationDelay: `${i * 80}ms` },
    dataset: { test: `choice-${i}` },
    onclick: (e) => { e.stopPropagation(); pickChoice(line, c); },
  }));
  dom.choices.replaceChildren(...buttons);
  dom.choices.classList.add("show");
  // 選択肢は1行（GUI22）。文言は全角26字以内で書く。差し込みで長くなったときだけ字を縮める
  buttons.forEach((b) => fitOneLine(b, 18));
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
  SE.select();
  r.waitingChoice = false;
  dom.choices.classList.remove("show");
  dom.choices.replaceChildren();
  const key = String(c.next || "");
  let waitForScene = false;
  if (key && r.branches[key]) r.queue.unshift(...r.branches[key]);
  else if (c.next_id) waitForScene = jumpTo(String(c.next_id));
  else if (key) warnVn("branch-unresolved", key);
  log.push({ name: "▶", text: stripTags(c.text || "") });
  if (hooks.onChoice) hooks.onChoice(r.currentId || r.id, String(line.id || ""), key, String(c.next_id || ""), c, line);
  if (!waitForScene) next();
}

// ---------------------------------------------------------------- ログ・用語

function openLog() {
  SE.select();
  clearTimeout(autoTimer);
  const list = el("div.log-list", log.slice(-120).map((l) => el("div.log-row", [
    l.name ? el("b", { text: l.name }) : null,
    el("span", { text: l.text }),
    l.inner ? el("div.log-inner", { text: l.inner, "aria-label": "ひよりの本心（はじめには聞こえない）" }) : null,
  ])));
  dom.log.replaceChildren(
    el("div.log-head", [el("span", { text: "LOG" }), el("button.btn.small", { text: "閉じる", onclick: (e) => { e.stopPropagation(); dom.log.classList.remove("show"); kickAuto(); } })]),
    list,
  );
  dom.log.classList.add("show");
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
    clearInterval(running.typeTimer);
    clearTimeout(running.typeTimer);
  }
  vnModalOpen++;
  try {
    await openVnConfig({
      onChange(key) {
        if (key === "uiTheme") nameFit?.fit();
        if (key === "textSpeed" && running?.typing && config.textSpeed >= 4) completeTyping();
      },
    });
  } finally { vnModalOpen--; }
  if (document.activeElement?.closest?.(".vn-controls")) document.activeElement.blur();
  if (running?.typing) startTypingInterval(running);
  kickAuto();
}

export const isPlaying = () => !!running;
export const backlog = () => log;
