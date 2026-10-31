import { playEntrance } from "./tournament-entrance.js";
// HAZE: NATIONAL TOKYO。四人同時の一試合を、確定した制作工程と票から再開する。
import { difficultyForRun } from "../core/ngplus-difficulty.js";
import { difficultyEvidence } from "../core/cycle-start.js";
import { DB, bgUrl, displayName, faceIconUrl, portraitInfo, loadTournamentCraftDialogue } from "../core/data.js";
import { el, yen } from "../core/util.js";
import { state, save, markMet, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, modal, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { chapterDay } from "../core/chapter-clock.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";
import { maxStamina } from "../core/stats.js";
import { recordTournamentLoss, chooseRetryAssist } from "./retry-assist.js";
import { buildGameOver, warmGameOver } from "./gameover.js";
import { craftContinueContext, recordContinueContext, clearContinueHistory } from "./continue-context.js";
import { applyAssistRecovery } from "./tournament-resources.js";
import { play } from "../vn/engine.js";
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
import { CRAFT_STEPS } from "../craft/practice.js";
import * as broadcast from "../craft/broadcast.js";
import { voteStack, judgePanel, judgeLegend, craftReviewBlock } from "../craft/tournament-graphics.js";
import { craftReviewLines } from "../craft/advice.js";
import { playTournamentEvent } from "../craft/tournament-story.js";
import { TOURNAMENT_STORY_STEPS } from "../craft/tournament-story-data.js";
import { readDialogues } from "../core/chapter-data.js";
import { adjustmentLines, resultLines, defeatLines } from "./ch3-verdict.js";
import { chapterThreeScenes, chapterThreeProgress } from "./ch3-progress.js";
import { JUDGES, CONTESTANTS, tournamentProgress, restoreResources,
  startAttempt, recoverStep, beginStep, finishStep, castVotes, standings, recordResult, CH3_PRIZE } from "./ch3-tournament-state.js";

const REQUIRED = ["tournament_day", "national_craft", "national_adjustment", "national_result", "national_defeat"]
  .map(id => `ch3_${id}`);
const setupWithWater = async cs => { await stepSetup(cs); await stepWater(cs); };
const STEPS = [setupWithWater, stepMix, stepPack, runHoles, stepPlace, runHeat,
  stepSteamTime, runSteamDodge, runPull, cs => runCare(cs, { round: 1 }), cs => runCare(cs, { round: 2 })];
const STEP_IDS = ["setup", "mix", "pack", "foil", "place", "coalfire", "steam", "steam", "pull", "adjust", "adjust"];
const MILESTONES = new Map([[8, 0], [9, 1], [10, 2], [11, 3]]);
const PART_LABELS = ["アルミ穴あけ", "炭の温度", "蒸らしと吸い出し", "一度目の調整", "二度目の調整"];
const clone = value => JSON.parse(JSON.stringify(value));
const id = name => `ch3-tournament-${name}`;
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
  catch (error) { if (live(owner)) { console.error("[ch3 tournament]", error); renderError(owner); } }
  finally { owner.busy = false; }
}

function menuButton(owner) {
  return el("button.btn.ch2-tournament-menu", { type: "button", text: "MENU",
    dataset: { test: id("menu") }, onclick: () => openMenu(owner) });
}

async function openMenu(owner) {
  if (!live(owner) || owner.menuBusy) return;
  owner.menuBusy = true;
  try {
    const choice = await modal({ title: "全国大会 MENU", body: "途中の工程は、その工程の始めから再開できます。", options: [
      { label: "セーブ", value: "save", test: id("save") },
      { label: "ロード", value: "load", test: id("load") },
      { label: "設定", value: "config", test: id("config") },
      { label: "用語集", value: "glossary", test: id("glossary") },
      { label: "大会の規則", value: "rules", test: id("rules") },
      { label: "タイトルへ戻る", value: "title", test: id("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!live(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "config") await (await import("../scenes/title.js")).openConfig();
    if (choice === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
    if (choice === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
    if (choice === "load") {
      const key = await loadFlow({ inGame: true });
      if (key && loadFromSlot(key)) {
        owner.active = false;
        owner.continueRoot?.cleanupContinue();
        owner.controller?.abort();
        requestResumeOnBoot();
        location.reload();
      }
    }
    if (choice === "title") {
      save();
      owner.active = false;
      owner.continueRoot?.cleanupContinue();
      owner.controller?.abort();
      location.reload();
    }
  } finally { owner.menuBusy = false; }
}

function hud(owner, visible = false) {
  layers.hud.replaceChildren(...(visible ? [el("div.ch2-tournament-vn-menu", [menuButton(owner)])] : []));
  layers.hud.classList.toggle("show", visible);
}

function card(owner, name, title, description, actions = [], extra = []) {
  hud(owner);
  showScreen("ch3-tournament", el("main.ch2-contest", { dataset: { test: id(name) } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第三章・DAY14 ／ HAZE: NATIONAL TOKYO" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    ...extra,
    el("div.ch2-contest-actions", actions),
  ]));
}

// 台本は元の正本を変えず、プレイヤーの調整や実際の順位に反する固定文だけ実戦中に置き換える。
function matchDialogue(name) {
  const source = DB.dialogues[`ch3_${name}`];
  if (!source) throw new Error(`台本がありません: ch3_${name}`);
  const craft = progress().craft;
  if (name === "national_result") return { ...source, lines: resultLines(source.lines, craft, state.flags._ch3_strategy) };
  if (name === "national_defeat") return { ...source, lines: defeatLines(source.lines, craft) };
  if (name !== "national_adjustment") return source;
  const lines = source.lines.map((line, index) => {
    if (index === 0) return { ...line, text: "一度目の調整を終えた。まだ、全員に持ち点が残っている。" };
    if (index === source.lines.length - 1) return { ...line, text: "二度目の調整へ。残りの葉と温度を確かめる。" };
    return line;
  });
  return { ...source, lines: adjustmentLines(lines, craft) };
}

async function read(owner, name) {
  if (!live(owner)) return false;
  showScreen("none", null);
  // 大会場面内で初めて名乗る人物の表示名を解禁する。未読で中断したら戻す。
  const reveals = name === "tournament_day" ? ["kuze", "steve", "volk", ...JUDGES] : [];
  const newlyMet = reveals.filter(who => !state.met[who]);
  const newMetFlags = reveals.filter(who => !state.flags[`_met_${who}`]);
  for (const who of reveals.filter(who => who !== "emil")) markMet(who);
  hud(owner);
  const controller = new AbortController();
  owner.controller = controller;
  let completed = false;
  try {
    const result = await play(matchDialogue(name), { signal: controller.signal });
    completed = live(owner) && !!result && !result.cancelled;
    if (completed && name === "tournament_day") markMet("emil");
    return completed;
  } finally {
    if (owner.controller === controller) owner.controller = null;
    if (!completed && live(owner)) {
      for (const who of newlyMet) delete state.met[who];
      for (const who of newMetFlags) delete state.flags[`_met_${who}`];
    }
  }
}

function checkpoint(stage) { progress().stage = stage; save(); }

async function commentary(owner, event) {
  hud(owner);
  const controller = new AbortController(); owner.controller = controller;
  const result = await playTournamentEvent(owner.cs, event, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  if (!live(owner) || !result) return false;
  progress().craft = clone(owner.cs);
  save();
  return true;
}

// 課題フレーバー（第3章＝ドバジ チョコレート）は大会が supply で無制限に支給するので、
// 私物を1gも持たずに来てもミックスで課題量を満たせる。0g到着の詰みは steps.js の supply 扱いで解消済み。
// 支給分は在庫を増やさず持ち越さないので、ここで在庫を補填しない（オーナー決定 2026-10-28 13:29）。

export async function runChapterThreeTournament() {
  if (state?.chapter !== 3 || (!state.flags._ch3_tournament &&
    (chapterDay(state) < 14 || chapterThreeProgress(state).stage < chapterThreeScenes(state).length))) return false;
  if (session) { session.active = false; session.continueRoot?.cleanupContinue(); session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null, cs: null };
  document.body.classList.remove("ch3-intro", "ch2-city", "ch2-main");
  document.body.classList.add("ch2-tournament", "ch3-tournament");
  window.addEventListener("pagehide", () => { owner.active = false; owner.continueRoot?.cleanupContinue(); owner.controller?.abort(); }, { once: true });
  await perform(owner, async () => {
    await loadTournamentCraftDialogue();
    // 必要な場面が揃うまで、保存・日付・大会の試行回数を変更しない。
    const dialogues = await readDialogues("ch3_main", REQUIRED);
    if (!live(owner)) return;
    Object.assign(DB.dialogues, Object.fromEntries(REQUIRED.map(key => [key, dialogues[key]])));
    recoverStep(state);
    save();
    await setBg(bgUrl("bg_tournament_stage", "day"), { instant: true });
    if (live(owner)) await drive(owner);
  });
}

function renderEntry(owner) {
  card(owner, "entry", "全国大会の朝。", "はじめ・久世・スティーブ・ヴォルク。四人が同時に一台を仕上げる。", [
    button(owner, "会場へ向かう", "start", async () => { checkpoint("opening"); await drive(owner); }, true),
  ], [el("p.ch2-contest-note", { text: "審査員は南雲・チャコール博士・エミル。各10点を四回に分けて投じる。" })]);
}

function renderReady(owner) {
  card(owner, "ready", "一台で、最後まで。", "四人一斉の一発勝負。提供後も同じ一台を二度調整し、審査員の持ち点で順位を決める。", [
    button(owner, "制作を始める", "craft-start", async () => {
      const p = progress();
      void warmGameOver();
      if (p.entry) restoreResources(state, p.entry);
      const assisted = p.retryAssist === true;
      startAttempt(state, null);
      applyAssistRecovery(state, assisted, maxStamina());
      owner.cs = newSession("tournament");
      owner.cs.eventTitle = "HAZE: NATIONAL TOKYO";
      owner.cs.retryAssist = assisted;
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

function partScores(cs, round) {
  if (!cs) return [];
  const parts = [cs.holes?.score, cs.heat?.score];
  if (round >= 1) parts.push(computeShisha(cs).craftQuality);
  if (round >= 2) parts.push(cs.careHistory?.[0]?.score);
  if (round >= 3) parts.push(cs.careHistory?.[1]?.score);
  return parts.map((score, index) => ({ label: PART_LABELS[index], score }))
    .filter(part => Number.isFinite(part.score));
}

function contestantAvatar(who) {
  const icon = faceIconUrl(who), portrait = portraitInfo(who, "normal");
  if (!icon && !portrait) {
    return el("span.ch2-contest-avatar", { style: { display: "grid", placeItems: "center", background: "#393044",
      color: "#f7e7c2", fontSize: "13px", fontWeight: "800" }, "aria-hidden": "true",
    text: displayName(who, state).slice(0, 2) });
  }
  const image = el("img", { src: icon || portrait?.src, alt: "" });
  if (!icon && portrait) Object.assign(image.style, { width: "171px", height: "auto",
    left: `${18 - portrait.ax * 171}px`, top: `${2.7 - (1 - portrait.h - portrait.b) * 171 / portrait.aspect}px`, position: "absolute" });
  return el("span.ch2-contest-avatar", [image]);
}

function voteReason(p, cs, final = false) {
  const last = p.lastVotes;
  if (!last) return null;
  const got = JUDGES.reduce((sum, judge) => sum + (last[judge]?.points?.hajime || 0), 0);
  const names = ids => ids.map(judge => displayName(judge, state)).join("・");
  const first = JUDGES.filter(judge => last[judge]?.first === "hajime");
  const second = JUDGES.filter(judge => last[judge]?.second === "hajime");
  const who = [first.length ? `${names(first)}が一番に` : "", second.length ? `${names(second)}が二番手に` : ""]
    .filter(Boolean).join("、");
  const lines = [got > 0 ? `今回 +${got}点。${who}推した。` : "今回は、どの審査員の上位2人にも入らなかった。"];
  const parts = partScores(cs, p.voted - 1);
  if (parts.length) {
    const weakest = parts.reduce((low, part) => part.score < low.score ? part : low);
    const step = weakest.label === "アルミ穴あけ" ? "holes" : weakest.label === "炭の温度" ? "heat" : weakest.label.includes("調整") ? "care" : "pull";
    const judge = step === "pull" ? "emil" : "dr_kemuri";
    lines.push(`${weakest.label}：${evaluationOf(weakest.score).mark}　${displayName(judge, state)}「${feedbackLine(judge, step, evaluationOf(weakest.score))}」`);
  }
  const affected = JUDGES.filter(judge => last[judge]?.tactic?.affected);
  if (affected.length) {
    const judge = affected.find(who => last[who].tactic.affected === "hajime") || affected[0];
    const tactic = last[judge].tactic;
    const target = displayName(tactic.affected, state);
    const contrast = tactic.delta > 0 ? "香りが強く映った" : "香りが薄く映った";
    const others = affected.filter(who => who !== judge);
    lines.push(`南雲は水を飲んだ。${names([judge])}は水を挟まず、久世の直後に${target}を試喫。鋭い苦みの余韻で${contrast}（比較${tactic.delta > 0 ? "+" : ""}${tactic.delta}）。${others.length ? `${names(others)}にも残った。` : ""}`);
  } else if (JUDGES.some(judge => last[judge]?.tactic)) {
    lines.push("南雲は水を飲んだ。ほかの席も試喫順と給水が噛み合わず、久世の鋭い苦みは直後の比較に残らなかった。");
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
  const row = value => el(`li.ch2-contest-rival${value.id === "hajime" ? ".me" : ""}`, {
    dataset: { contestant: value.id, rank: String(value.rank) },
  }, [
    el("b.rank-medal", { text: String(value.rank) }), contestantAvatar(value.id),
    el("span", { text: displayName(value.id, state) }), voteStack(p.votes, value.id, "ch2-contest-stack", JUDGES),
    el("strong", [String(value.points), el("small", { text: "pt" })]),
  ]);
  const judgeFace = judge => { const face = contestantAvatar(judge); face.classList.add("judge-face"); return face; };
  const judges = judgePanel(p.votes, JUDGES, { cls: ".ch2-contest-judges", face: judgeFace });
  card(owner, final ? "result" : "votes", final ? "全国大会の結果" : "いま、動いた持ち点。",
    final ? `はじめは${p.result.rank}位。審査員三人、それぞれの10点が出揃いました。`
      : ["制作が終わり、次は吸い出しと提供。", "提供を終えた一台。次は客席での調整。",
        "一度目の調整を終え、同じ一台をもう一度確かめます。"][p.voted - 1], [
      button(owner, final ? "結果を受け止める" : "続きを作る", "continue", async () => {
        if (final && p.result.rank === 1) clearContinueHistory(state);
        checkpoint(final ? p.result.rank === 1 ? "victory" : "defeat" : "craft");
        await drive(owner);
      }, true),
    ], [
      reason ? el("div.ch2-contest-reason", { dataset: { test: id("vote-reason") } }, [
        el("b.ch2-contest-reason-tag", { text: "解説" }), ...reason.map(text => el("p", { text })),
      ]) : null,
      review,
      el("section.ch2-contest-board", [judgeLegend(JUDGES), el("ol.ch2-contest-ranking", rows.map(row))]),
      judges,
      el("p.ch2-contest-note", { text: "一度入れた点は戻らない。同点なら一台の出来栄えで順位を決める。" }),
    ]);
}

async function renderDefeat(owner, variant = null) {
  const p = progress();
  broadcast.clearComments();
  if (p.result && !p.defeatRead) {
    if (!await read(owner, "national_defeat")) return;
    p.defeatRead = true;
    save();
  }
  // 同じ敗北の再表示では数え直さない。第1・2章と同じ20秒のCONTINUE画面へ（#1909）。
  recordTournamentLoss(p);
  save();
  owner.continueRoot?.cleanupContinue();
  const context = recordContinueContext(owner.state, p, p.attempts,
    craftContinueContext(p.craft, { chapter: 3, reason: p.failure || "rank", rank: p.result?.rank }));
  await warmGameOver();
  if (!live(owner)) return;
  hud(owner, true); // MENU は SAVE/LOAD を残す。モーダル中は共通の時計と音が止まる。
  const root = buildGameOver({ context, variant,
    onRetry: () => perform(owner, async () => {
      const assisted = await chooseRetryAssist(p, () => live(owner) && root.isConnected && progress() === p);
      if (!live(owner) || !root.isConnected || progress() !== p) return;
      if (assisted === null) { await renderDefeat(owner, root.continueVariant); return; }
      owner.cs = null;
      checkpoint("ready");
      renderReady(owner);
    }),
    onTitle: () => { if (live(owner)) { owner.active = false; owner.controller?.abort(); location.reload(); } },
  });
  owner.continueRoot = root;
  root.dataset.test = id("defeat");
  root.querySelector(".go-retry").dataset.test = id("retry");
  showScreen("end", root);
}

function renderComplete(owner) {
  const p = progress();
  if (p.result?.rank !== 1 || !state.flags._ch3_tournament_won)
    throw new Error("全国大会の勝利記録を確認できません");
  playBgm("bgm_aftermath");
  card(owner, "complete", "全国大会・優勝／日本第一代表", "四人の一試合で、はじめが日本の第一代表になった。東京で伝えることが、まだ残っている。", [
    button(owner, "第三章の続きへ", "aftermath", async () => {
      const mod = await withLoadingNotice(import("./ch3-aftermath.js"), loadingNotice("第三章の続きを準備しています…"));
      await mod.runChapterThreeAftermath();
    }, true),
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow()),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], [
    // 賞金は recordResult で優勝確定時に一度だけ加算済み。ここでは受け取ったことだけを見せる（#1658 ⑦）。
    p.prizePaid ? el("p.ch2-contest-note", { dataset: { test: id("prize") }, text: `優勝賞金 ${yen(CH3_PRIZE)} を受け取った。` }) : null,
  ]);
}

function renderError(owner) {
  broadcast.clearComments();
  card(owner, "error", "全国大会を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。確定した工程から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => runChapterThreeTournament(), true),
  ]);
}

async function drive(owner) {
  while (live(owner)) {
    const p = progress();
    if (p.stage === "entry") { renderEntry(owner); return; }
    if (p.stage === "opening") {
      if (!await read(owner, "tournament_day")) return;
      await playEntrance(3);
      if (!live(owner)) return;
      checkpoint("ready");
    } else if (p.stage === "ready") { renderReady(owner); return; }
    else if (p.stage === "craft") {
      owner.cs ||= clone(p.craft);
      const cs = owner.cs;
      playBgm("bgm_tournament_craft");
      // 投票の後、調整に入る合間の掛け合い（#1290）。見た目は commentary と同じ経路で一度だけ。
      const interlude = p.step === 9 ? "interlude1" : p.step === 10 ? "interlude2" : null;
      if (interlude && !await commentary(owner, interlude)) return;
      const event = TOURNAMENT_STORY_STEPS.get(p.step);
      if (event && !await commentary(owner, event)) return;
      hud(owner);
      openBench(cs, { steps: CRAFT_STEPS });
      await waitBenchReady(cs);
      if (!live(owner)) return;
      const top = benchRoot(cs)?.querySelector(".bench-top");
      if (!top?.querySelector(`[data-test="${id("menu")}"]`)) top?.append(menuButton(owner));
      beginStep(state);
      save();
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
        p.craft = clone(cs);
        if (p.step === 9) p.stage = "national_craft";
        else if (p.step === 10) p.stage = "national_adjustment";
        else {
          const round = MILESTONES.get(p.step), quality = partialQuality(cs, round);
          if (!castVotes(p, round, quality, null, difficultyForRun(state, difficultyEvidence(state)))) throw new Error("全国大会の投票地点を確認できません");
          p.stage = p.step === STEPS.length ? "tasting" : "votes";
          if (p.stage === "tasting") recordResult(state, cs.total);
        }
      }
      save();
    } else if (p.stage === "national_craft") {
      if (!await read(owner, "national_craft")) return;
      if (!castVotes(p, 1, partialQuality(p.craft, 1), null, difficultyForRun(state, difficultyEvidence(state)))) throw new Error("全国大会の提供後の投票地点を確認できません");
      checkpoint("votes");
    } else if (p.stage === "national_adjustment") {
      if (!await read(owner, "national_adjustment")) return;
      if (!castVotes(p, 2, partialQuality(p.craft, 2), null, difficultyForRun(state, difficultyEvidence(state)))) throw new Error("全国大会の調整後の投票地点を確認できません");
      checkpoint("votes");
    } else if (p.stage === "tasting") {
      owner.cs ||= clone(p.craft);
      playBgm("bgm_judging");
      if (!await commentary(owner, "tasting")) return;
      checkpoint("result");
    } else if (p.stage === "votes") { renderVotes(owner); return; }
    else if (p.stage === "result") { playBgm("bgm_judging"); renderVotes(owner, true); return; }
    else if (p.stage === "defeat") { await renderDefeat(owner); return; }
    else if (p.stage === "victory") {
      if (p.result?.rank !== 1) throw new Error("全国大会の結果と勝利場面が一致しません");
      playBgm("bgm_aftermath");
      if (!await read(owner, "national_result")) return;
      state.flags._ch3_tournament_won = true;
      state.flags._ch3_japan_first_representative = true;
      state.phase = "aftermath";
      checkpoint("complete");
    } else if (p.stage === "complete") { renderComplete(owner); return; }
    else throw new Error(`不明な全国大会の保存地点: ${p.stage}`);
  }
}
