import { playEntrance } from "./tournament-entrance.js";
import { buildGameOver, warmGameOver } from "./gameover.js";
import { craftContinueContext, recordContinueContext, clearContinueHistory } from "./continue-context.js";
// HAZE: OPEN CLOUD。一試合の制作と、各工程の確定済み状態だけを保存する。
import { DB, bgUrl, displayName, faceIconUrl, portraitInfo, CHAPTER_DIALOGUE_FILES, loadTournamentCraftDialogue } from "../core/data.js";
import { el, yen } from "../core/util.js";
import { state, save, markMet, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, modal, imageReady, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { maxStamina } from "../core/stats.js";
import { recordTournamentLoss, chooseRetryAssist } from "./retry-assist.js";
import { applyAssistRecovery } from "./tournament-resources.js";
import { play } from "../vn/engine.js";
import { openPhone, openLime } from "../daily/phone.js";
import { playBgm } from "../core/audio.js";
import { newSession, openBench, waitBenchReady, benchRoot } from "../craft/session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { stepWater } from "../craft/water-view.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull, runCare } from "../craft/pull.js";
import { computeShisha, finalize } from "../craft/score.js";
import { evaluationOf, feedbackLine } from "../craft/feedback.js";
import { craftRecognition } from "../craft/recognition.js";
import { radar } from "../daily/status.js";
import { CRAFT_STEPS } from "../craft/practice.js";
import * as broadcast from "../craft/broadcast.js";
import { voteStack, judgePanel, judgeLegend, craftReviewBlock } from "../craft/tournament-graphics.js";
import { craftReviewLines } from "../craft/advice.js";
import { playTournamentEvent } from "../craft/tournament-story.js";
import { TOURNAMENT_STORY_STEPS } from "../craft/tournament-story-data.js";
import { readDialogues } from "./ch2-city-data.js";
import { chapterTwoCheers, chapterTwoCongratulations, recordSentLime } from "./ch2-lime.js";
import { playChapterPreview } from "./chapter-preview.js";
import { CH2_SCENE_BACKGROUNDS } from "../core/city-locations.js";
import { JUDGES, CONTESTANTS, tournamentProgress, restoreResources,
  startAttempt, recoverStep, beginStep, finishStep, castVotes, standings, recordResult, CH2_PRIZE } from "./ch2-tournament-state.js";

const REQUIRED = ["lobby", "entrance", "stations", "rules", "verdict", "farewell", "tasteless", "ageha_heart"].map(id => `ch2_tournament_${id}`);
// SETUPの確定境界に水を含める。途中LOADはSETUP先頭から、確定後はMIXから。
const setupWithWater = async cs => { await stepSetup(cs); await stepWater(cs); };
const STEPS = [setupWithWater, stepMix, stepPack, runHoles, stepPlace, runHeat,
  stepSteamTime, runSteamDodge, runPull, cs => runCare(cs, { round: 1 }), cs => runCare(cs, { round: 2 })];
const STEP_IDS = ["setup", "mix", "pack", "foil", "place", "coalfire", "steam", "steam", "pull", "adjust", "adjust"];
const MILESTONES = new Map([[8, 0], [9, 1], [10, 2], [11, 3]]);
const clone = value => JSON.parse(JSON.stringify(value));
const id = name => `ch2-tournament-${name}`;
let session;
const live = owner => session === owner && owner.active && owner.state === state;
const progress = () => tournamentProgress(state);

function button(owner, text, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
    dataset: { test: id(name) }, onclick: () => perform(owner, action) });
}
async function perform(owner, action) {
  if (!live(owner) || owner.busy) return;
  owner.busy = true;
  try { await action(); }
  catch (error) { if (live(owner)) { console.error("[ch2 tournament]", error); renderError(owner); } }
  finally { owner.busy = false; }
}
function menuButton(owner) {
  return el("button.btn.ch2-tournament-menu", { type: "button", text: "MENU", dataset: { test: id("menu") }, onclick: () => openMenu(owner) });
}
async function openMenu(owner) {
  if (!live(owner) || owner.menuBusy) return;
  owner.menuBusy = true;
  try {
    const choice = await modal({ title: "県大会 MENU", body: "途中の工程は、その工程の始めから再開できます。", options: [
      { label: "セーブ", value: "save", test: id("save") },
      { label: "ロード", value: "load", test: id("load") },
      { label: "大会の規則", value: "rules", test: id("rules") },
      { label: "タイトルへ戻る", value: "title", test: id("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!live(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
    if (choice === "load") {
      const key = await loadFlow({ inGame: true });
      if (key && loadFromSlot(key)) { owner.active = false; owner.continueRoot?.cleanupContinue(); owner.controller?.abort(); requestResumeOnBoot(); location.reload(); }
    }
    if (choice === "title") { save(); owner.active = false; owner.continueRoot?.cleanupContinue(); owner.controller?.abort(); location.reload(); }
  } finally { owner.menuBusy = false; }
}
function hud(owner, visible = false) {
  layers.hud.replaceChildren(...(visible ? [el("div.ch2-tournament-vn-menu", [menuButton(owner)])] : []));
  layers.hud.classList.toggle("show", visible);
}
function card(owner, name, title, description, actions = [], extra = []) {
  hud(owner);
  showScreen("ch2-tournament", el("main.ch2-contest", { dataset: { test: id(name) } }, [
    el("header.ch2-contest-header", [el("div", [el("p", { text: "第二章・DAY14 ／ HAZE: OPEN CLOUD" }), el("h1", { text: title })]), menuButton(owner)]),
    el("p.ch2-contest-description", { text: description }), ...extra,
    el("div.ch2-contest-actions", actions),
  ]));
}
async function read(owner, name) {
  if (!live(owner)) return false;
  const key = `ch2_tournament_${name}`;
  if (!DB.dialogues[key]) throw new Error(`台本がありません: ${key}`);
  showScreen("none", null); hud(owner, true);
  const controller = new AbortController(); owner.controller = controller;
  const result = await play(key, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  return live(owner) && !!result && !result.cancelled;
}
// others: スミさんの連絡より先に読む、ほかの相手のLIME。届け直しで重ねないよう開く直前に集める。
async function message(owner, suffix, lines, others = () => []) {
  hud(owner);
  const key = `ch2_tournament_sumi_${suffix}`;
  const old = state.inbox.find(item => item.id === key);
  if (old?.done) return true;
  if (old) await openLime({ sender: "sumi" });
  else {
    const before = others();
    await openPhone([...before, { id: key, sender: "sumi", type: "message", messages: lines, afterClose: [] }],
      { title: before.length ? null : "スミさん", time: suffix === "morning" ? "大会当日の朝" : "大会の夜" });
  }
  if (!live(owner)) return false;
  save();
  return !!state.inbox.find(item => item.id === key)?.done;
}
function checkpoint(stage) { progress().stage = stage; save(); }

async function commentary(owner, event) {
  hud(owner, true);
  const controller = new AbortController(); owner.controller = controller;
  // 掛け合いは保存済みの実際の票を読んで台詞を選ぶ（#1649）。
  const result = await playTournamentEvent(owner.cs, event, { signal: controller.signal, context: { progress: clone(progress()) } });
  if (owner.controller === controller) owner.controller = null;
  if (!live(owner) || !result) return false;
  progress().craft = clone(owner.cs); save();
  return true;
}

export async function runChapterTwoTournament() {
  if (session) { session.active = false; session.continueRoot?.cleanupContinue(); session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, cs: null };
  document.body.classList.remove("ch2-city");
  document.body.classList.add("ch2-tournament");
  window.addEventListener("pagehide", () => { owner.active = false; owner.continueRoot?.cleanupContinue(); owner.controller?.abort(); }, { once: true });
  await perform(owner, async () => {
    await loadTournamentCraftDialogue();
    // 全場面が揃うまでDAY14の保存や在庫を変更しない。
    const dialogues = await readDialogues(CHAPTER_DIALOGUE_FILES.ch2Tournament, REQUIRED);
    if (!live(owner)) return;
    Object.assign(DB.dialogues, Object.fromEntries(REQUIRED.map(key => [key, dialogues[key]])));
    recoverStep(state);
    save();
    await setBg(bgUrl("bg_tournament_stage", "day"), { instant: true });
    if (live(owner)) await drive(owner);
  });
}

function renderEntry(owner) {
  card(owner, "entry", "県大会の朝。", "はじめ・あげは・神崎竜二・REI。4人一斉、一台を仕上げる一発勝負。", [
    button(owner, "LIMEを読んで会場へ", "start", async () => { checkpoint("morning"); await drive(owner); }, true),
  ], [el("p.ch2-contest-note", { text: "課題はストロベリー。アフサールの新作を主催者が支給。制作から提供、その後の調整まで同じ一台で行います。" })]);
}
function renderReady(owner) {
  card(owner, "ready", "一台で、最後まで。", "予選・準決勝はありません。提供後も、客席で吸われた一台を2回調整します。", [
    button(owner, "制作を始める", "craft-start", async () => {
      const p = progress();
      void warmGameOver();
      if (p.entry) restoreResources(state, p.entry);
      const assisted = p.retryAssist === true;
      startAttempt(state, null);
      applyAssistRecovery(state, assisted, maxStamina());
      owner.cs = newSession("tournament");
      owner.cs.eventTitle = "HAZE: OPEN CLOUD";
      owner.cs.retryAssist = assisted; // 救済は次の一台だけ（#590）
      p.craft = clone(owner.cs);
      save();
      await drive(owner);
    }, true),
  ]);
}
function partialQuality(cs, round) {
  if (round === 3) return finalize(cs).total;
  // アルミを飛ばした一台は穴あけの点が無いので、ある工程だけで平均する。
  const parts = [cs.holes?.score, cs.heat?.score].filter(Number.isFinite);
  if (round >= 1) parts.push(computeShisha(cs).craftQuality);
  if (round >= 2) parts.push(cs.careHistory[0].score);
  return parts.reduce((sum, value) => sum + value, 0) / (parts.length || 1);
}
function contestantAvatar(who) {
  const icon = faceIconUrl(who), portrait = portraitInfo(who, "normal");
  const image = el("img", { src: icon || portrait?.src, alt: "" });
  // 顔アイコン未制作の2人も、既存立ち絵の頭部を同じ枠に収める。
  if (!icon && portrait) Object.assign(image.style, { width: "171px", height: "auto",
    left: `${18 - portrait.ax * 171}px`, top: `${2.7 - (1 - portrait.h - portrait.b) * 171 / portrait.aspect}px`, position: "absolute" });
  return el("span.ch2-contest-avatar", [image]);
}
/** 工程の得点。partialQuality と同じ順・同じ値（表示用の名前だけ足す）。 */
const PART_LABELS = ["アルミ穴あけ", "炭の温度", "蒸らしと吸い出し", "一度目の調整", "二度目の調整"];
function partScores(cs, round) {
  if (!cs) return [];
  const parts = [cs.holes?.score, cs.heat?.score];
  if (round >= 1) parts.push(computeShisha(cs).craftQuality);
  if (round >= 2) parts.push(cs.careHistory?.[0]?.score);
  if (round >= 3) parts.push(cs.careHistory?.[1]?.score);
  return parts.map((score, i) => ({ label: PART_LABELS[i], score })).filter(part => Number.isFinite(part.score));
}
/** #909: 票が動いた理由を、実際の票と工程の得点だけから2行で。記録の無い旧保存では出さない。 */
export function voteReason(p, cs, final = false) {
  const last = p.lastVotes;
  if (!last) return null;
  const got = JUDGES.reduce((sum, j) => sum + (last[j]?.points?.hajime || 0), 0);
  const names = list => list.map(j => displayName(j, state)).join("・");
  const firsts = JUDGES.filter(j => last[j]?.first === "hajime"), seconds = JUDGES.filter(j => last[j]?.second === "hajime");
  const who = [firsts.length ? `${names(firsts)}が一番に` : "", seconds.length ? `${names(seconds)}が二番手に` : ""].filter(Boolean).join("、");
  const lines = [got > 0 ? `今回 +${got}点。${who}推した。` : "今回は、どの審査員の上位2人にも入らなかった。"];
  const parts = partScores(cs, p.voted - 1);
  if (parts.length) {
    const weakest = parts.reduce((low, part) => part.score < low.score ? part : low);
    const step = weakest.label === "アルミ穴あけ" ? "holes" : weakest.label === "炭の温度" ? "heat" : weakest.label.includes("調整") ? "care" : "pull";
    const judge = step === "pull" ? "maezono" : "dr_kemuri";
    lines.push(`${weakest.label}：${evaluationOf(weakest.score).mark}　${displayName(judge, state)}「${feedbackLine(judge, step, evaluationOf(weakest.score))}」`);
  }
  return lines;
}
function renderVotes(owner, final = false) {
  playBgm("bgm_judging");
  const p = progress(), rows = final ? p.result.rows : standings(p);
  const craft = owner.cs || (p.craft ? clone(p.craft) : null);
  const reason = voteReason(p, craft, final);
  // 最終結果だけに、実際の記録から2行を添える（第1章の結果表と同じ判定）。
  const review = final ? craftReviewBlock(craftReviewLines(craft), id("craft-review")) : null;
  const row = value => el(`li.ch2-contest-rival${value.id === "hajime" ? ".me" : ""}`, { dataset: { contestant: value.id, rank: String(value.rank) } }, [
    el("b.rank-medal", { text: String(value.rank) }), contestantAvatar(value.id),
    el("span", { text: displayName(value.id, state) }), voteStack(p.votes, value.id, "ch2-contest-stack", JUDGES),
    el("strong", [String(value.points), el("small", { text: "pt" })]),
  ]);
  const judgeFace = judge => { const face = contestantAvatar(judge); face.classList.add("judge-face"); return face; };
  const judges = judgePanel(p.votes, JUDGES, { cls: ".ch2-contest-judges", face: judgeFace });
  card(owner, final ? "result" : "votes", final ? "県大会の結果" : "いま、動いた持ち点。",
    final ? `はじめは${p.result.rank}位。審査員3人、それぞれの10点が出揃いました。` : ["制作が終わり、次は吸い出しと提供。", "提供を終えた一台。次は客席での調整。", "一度目の調整を終え、同じ一台をもう一度確かめます。"][p.voted - 1], [
      button(owner, final ? "結果を受け止める" : "続きを作る", "continue", async () => {
        if (final && p.result.rank === 1) clearContinueHistory(state);
        checkpoint(final ? p.result.rank === 1 ? "farewell" : "defeat" : "craft"); await drive(owner);
      }, true),
    ], [reason ? el("div.ch2-contest-reason", { dataset: { test: id("vote-reason") } }, [el("b.ch2-contest-reason-tag", { text: "解説" }), ...reason.map(text => el("p", { text }))]) : null, review,
      el("section.ch2-contest-board", [judgeLegend(JUDGES), el("ol.ch2-contest-ranking", rows.map(row))]), judges,
      el("p.ch2-contest-note", { text: "投入された点は戻りません。同点の場合は一台の出来栄えで順位を決めます。" })]);
}
async function renderDefeat(owner, variant = null) {
  const p = progress(); broadcast.clearComments();
  // 同じ敗北の再表示では数え直さない。3敗目から第1章と同じ救済を選べる（#590）。
  recordTournamentLoss(p); save();
  owner.continueRoot?.cleanupContinue();
  const context = recordContinueContext(owner.state, p, p.attempts,
    craftContinueContext(p.craft, { chapter: 2, reason: p.failure || "rank", rank: p.result?.rank }));
  await warmGameOver();
  if (!live(owner)) return;
  hud(owner, true); // MENU retains SAVE/LOAD; its modal pauses the shared clock/audio.
  const root = buildGameOver({ context, variant,
    onRetry: () => perform(owner, async () => {
      const assisted = await chooseRetryAssist(p, () => live(owner) && root.isConnected && progress() === p);
      if (!live(owner) || !root.isConnected || progress() !== p) return;
      if (assisted === null) { await renderDefeat(owner, root.continueVariant); return; }
      owner.cs = null;
      checkpoint("ready"); renderReady(owner);
    }),
    onTitle: () => { if (live(owner)) { owner.active = false; location.reload(); } },
  });
  owner.continueRoot = root;
  root.dataset.test = id("defeat");
  root.querySelector(".go-retry").dataset.test = id("retry");
  showScreen("end", root);
}
function renderComplete(owner) {
  // 第2章の外側の perform() は終了時に画面内ボタンを再設定する。
  // その処理にも予告中の操作禁止を伝えるため、disabled と locked を一緒に更新する。
  const lock = (button, locked) => {
    if (button.dataset) button.dataset.locked = String(locked);
    button.disabled = locked;
  };
  const next = button(owner, "第三章・東京へ", "chapter-three", async () => {
    if (owner.previewing) return;
    const mod = await withLoadingNotice(import("./ch3.js"), loadingNotice("第3章の東京へ向かっています…"));
    await mod.beginChapterThree();
  }, true);
  // 初回の予告が終わるまで、完了カードの導線を最初から無効にしておく。
  lock(next, !state.flags._ch2_preview_seen);
  const replay = button(owner, "次回予告をもう一度", "complete-preview", () => preview(false));
  card(owner, "complete", "第二章・完", "優勝トロフィーと、東京行きの切符。味のしない舌は、そのままだった。", [
    next,
    replay,
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow()),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], [
    // 賞金は recordResult で優勝確定時に一度だけ加算済み。ここでは受け取ったことだけを見せる。
    state.flags._ch2_tournament?.prizePaid ? el("p.ch2-contest-note", { dataset: { test: id("prize") }, text: `優勝賞金 ${yen(CH2_PRIZE)} を受け取った。` }) : null,
    // 第1章のクリア画面と同じ成長レーダー。淡い面が章のはじめ、明るい面がいま。
    el("div.ch2-contest-growth", { dataset: { test: id("growth") } }, [
      radar(state.stats, state.statsAtChapterStart, 220),
      el("p.ch2-contest-note", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
    ]),
    el("p.ch2-contest-note", { text: "出会い、約束、恋人と過ごした日々は、記録に残っています。" }),
  ]);
  // 第1章と同じ挙動: 未視聴なら完了カードで自動再生し、再生中は「次章へ」を押せない。
  // 完走/明示スキップのときだけ既読（_ch2_preview_seen）を保存する（DESIGN 7-4）。
  async function preview(first = false) {
    if (!live(owner) || owner.previewing) return;
    owner.previewing = true;
    lock(next, true); lock(replay, true);
    const controller = new AbortController();
    // MutationObserver の無い環境（Node VM の単体テスト等）では監視なしで再生だけを試みる。
    let observer;
    if (typeof MutationObserver !== "undefined") {
      // showScreen は幕の切替中、カードの DOM への接続を遅らせることがある。
      // 初回の未接続を離脱と誤認せず、一度表示されたカードが外れたときだけ中断する。
      let mounted = next.isConnected;
      observer = new MutationObserver(() => {
        if (next.isConnected) mounted = true;
        else if (mounted) controller.abort();
      });
      observer.observe(layers.screen, { childList: true });
    }
    let result;
    try { result = await playChapterPreview("ch3", { signal: controller.signal }); }
    catch { /* 次回予告は任意演出。失敗しても完了画面はそのまま使える。 */ }
    finally { observer?.disconnect(); }
    if (first && ["completed", "skipped"].includes(result) && live(owner) && state.phase === "cleared") {
      state.flags._ch2_preview_seen = true;
      save();
    }
    owner.previewing = false;
    lock(next, !state.flags._ch2_preview_seen);
    lock(replay, false);
    if (live(owner) && next.isConnected) {
      playBgm("bgm_aftermath");
      replay.focus({ preventScroll: true });
    }
  }
  if (!state.flags._ch2_preview_seen) preview(true);
}
function renderError(owner) {
  broadcast.clearComments();
  card(owner, "error", "県大会を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。確定した工程から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => runChapterTwoTournament(), true),
  ]);
}
async function drive(owner) {
  while (live(owner)) {
    const p = progress();
    if (p.stage === "entry") { renderEntry(owner); return; }
    if (p.stage === "morning") {
      if (!await message(owner, "morning", [
        state.flags._ch2_no_audience ? "今日は来ないでくれ、って話は聞いた。店で見てる" : "応援は届いてる。返事は終わってからでいい",
        "手順を確かめろ。無理なら止めていい。帰ったら飯にするぞ",
      ], chapterTwoCheers)) { if (live(owner)) renderEntry(owner); return; }
      checkpoint("lobby");
    } else if (p.stage === "lobby") {
      playBgm("bgm_tournament_wait");
      if (!await read(owner, "lobby")) return;
      markMet("ageha"); checkpoint("entrance");
    } else if (p.stage === "entrance") {
      playBgm("bgm_tournament_edm");
      if (!await read(owner, "entrance")) return;
      await playEntrance(2);
      if (!live(owner)) return;
      for (const who of ["kumicho", "rei", ...JUDGES]) markMet(who);
      state.flags._ch2_kumicho_public_reveal = true;
      checkpoint("stations");
    } else if (p.stage === "stations") {
      // 4台の前で開始を待つ掛け合い。追加前に "rules" 以降へ進んだ保存では読まない。
      if (!await read(owner, "stations")) return;
      checkpoint("rules");
    } else if (p.stage === "rules") {
      if (!await read(owner, "rules")) return;
      checkpoint("ready");
    } else if (p.stage === "ready") { renderReady(owner); return; }
    else if (p.stage === "craft") {
      owner.cs ||= clone(p.craft);
      const cs = owner.cs;
      playBgm("bgm_tournament_craft");
      // 投票の後の合間の掛け合い（#1290）。見た目は commentary と同じ経路で一度だけ。
      // 1回目の票の後は、提供前の4人の心の声（第2章だけ）。
      const interlude = p.step === 8 ? "interlude_pull" : p.step === 9 ? "interlude1" : p.step === 10 ? "interlude2" : null;
      if (interlude && !await commentary(owner, interlude)) return;
      const event = TOURNAMENT_STORY_STEPS.get(p.step);
      if (event && !await commentary(owner, event)) return;
      hud(owner); openBench(cs, { steps: CRAFT_STEPS }); await waitBenchReady(cs);
      if (!live(owner)) return;
      const top = benchRoot(cs)?.querySelector(".bench-top");
      if (!top?.querySelector(`[data-test="${id("menu")}"]`)) top?.append(menuButton(owner));
      beginStep(state); save();
      broadcast.block(cs, STEP_IDS[p.step]);
      const completed = await STEPS[p.step](cs);
      if (!live(owner)) return;
      if (completed === false) {
        // 吸い出しの画面離脱は敗北ではない。工程前の資源と制作保存地点へ戻す。
        recoverStep(state);
        owner.cs = null;
        save();
        renderError(owner);
        return;
      }
      if (p.step === 8 && !cs.failed) {
        cs.tournamentStory ||= { seen: [] };
        cs.tournamentStory.servedAroma = computeShisha(cs).aroma;
      }
      finishStep(state, cs);
      if (cs.failed) { save(); continue; }
      if (MILESTONES.has(p.step)) {
        broadcast.clearComments();
        const round = MILESTONES.get(p.step), quality = partialQuality(cs, round);
        // finalizeの完成品と2回のcareを同じcsに残し、追加投票だけを確定する。
        p.craft = clone(cs); castVotes(p, round, quality);
        p.stage = p.step === STEPS.length ? "tasting" : "votes";
        if (p.stage === "tasting") recordResult(state, cs.total);
      }
      save();
    } else if (p.stage === "tasting") {
      owner.cs ||= clone(p.craft);
      playBgm("bgm_judging");
      // 講評の前に、手を離した4人の待ち時間（第1章の interlude3 に対応）。
      if (!await commentary(owner, "interlude3")) return;
      if (!await commentary(owner, "tasting")) return;
      // 優勝のときだけ、結果カードの前に決着の間を置く。歓声より先に、口の中の空白を見せる。
      if (p.result?.rank === 1 && !await read(owner, "verdict")) return;
      checkpoint("result");
    } else if (p.stage === "votes") { renderVotes(owner); return; }
    else if (p.stage === "result") { playBgm("bgm_judging"); renderVotes(owner, true); return; }
    else if (p.stage === "defeat") { await renderDefeat(owner); return; }
    else if (p.stage === "farewell") {
      playBgm("bgm_aftermath");
      state.phase = "aftermath"; state.slot = 1; save();
      if (!await read(owner, "farewell")) return;
      checkpoint("tasteless");
    } else if (p.stage === "tasteless") {
      if (!await read(owner, "tasteless")) return;
      state.flags._ch2_taste_distant = true;
      recordSentLime(state, "tasteless");
      checkpoint("tokyo");
    } else if (p.stage === "tokyo") {
      // 第1章と同じく、実際の制作から一つだけ認める（票・順位には触れない）。
      const recognition = craftRecognition(p.craft)?.comment;
      if (!await message(owner, "tokyo", [...(recognition ? [recognition] : []), "東京に行ったら、mukaiのムカイさんを頼れ", "──それと、飯はちゃんと食え"], chapterTwoCongratulations)) { if (live(owner)) card(owner, "tokyo", "東京への連絡", "スミさんからのLIMEを読んで、次の行き先を確かめよう。", [button(owner, "LIMEを開く", "tokyo-message", () => drive(owner), true)]); return; }
      state.flags._ch2_cleared = true; state.flags._ch2_tokyo_invitation = true;
      state.phase = "cleared"; checkpoint("complete");
    } else if (p.stage === "complete") {
      // 章の最後に、はじめのいない店であげはの心の声（#929）。読了時だけ記録し、クリア済みの旧セーブにも一度だけ出す。
      // 完了カードも閉店後のMELTY PUFFのまま出す（昼の大会ステージへ戻さない）。
      const closedRoom = bgUrl(CH2_SCENE_BACKGROUNDS.agehaClosed);
      if (!await imageReady(closedRoom, 15000)) throw new Error("閉店後のMELTY PUFFを読み込めませんでした");
      await setBg(closedRoom, { instant: true });
      if (!state.flags._ch2_read_ch2_tournament_ageha_heart) {
        if (!await read(owner, "ageha_heart")) return;
        state.flags._ch2_read_ch2_tournament_ageha_heart = true; save();
      }
      renderComplete(owner); return;
    }
    else throw new Error(`不明な県大会の保存地点: ${p.stage}`);
  }
}

