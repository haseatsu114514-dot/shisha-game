// 第5章・機械仕掛けの神。帰郷後のプロローグ→自由行動→日程→試合当日→後日談→フィナーレまでを、場面単位で保存する。
// 状態遷移は ch5-progress.js。ここは表示と再生だけを持つ。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { createChapterActions } from "../core/chapter-actions.js";
import { createChapterCard } from "../core/chapter-card.js";
import { createChapterMenu } from "../core/chapter-menu.js";
import { chapterGrowthNight } from "../core/chapter-growth.js";
import { awardChapterClearExp, awardTournamentExp, awardSceneExp, presentNight, reflectAtSpot, consultLessons } from "../core/growth.js";
import { canReflect } from "../daily/reflection.js";
import { loverMilestonesDue, readLoverMilestone } from "./lover-entry.js";
import { state, save } from "../core/state.js";
import { layers, showScreen, setBg, enterScene, chapterTitle, modal } from "../core/ui.js";
import { sceneMoment } from "../core/scene-motions.js";
import { saveFlow } from "../scenes/saves.js";
import { play, hooks, vnTest } from "../vn/engine.js";
import { playChapterPoem } from "../scenes/chapter-poem.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { selectStoryEnding } from "../core/story-routes.js";
import { playStaffRoll } from "../scenes/staff-roll.js";
import { playResult } from "../scenes/result.js";
import { chapterGrowthChart } from "../daily/status.js";
import { readDialogues } from "../core/chapter-data.js";
import { newSession, openBench, waitBenchReady } from "../craft/session.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { stepWater } from "../craft/water-view.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull, runCare } from "../craft/pull.js";
import { finalize } from "../craft/score.js";
import { CRAFT_STEPS } from "../craft/practice.js";
import { servedEvaluationLines } from "../craft/served-eval.js";
import { craftReviewLines } from "../craft/advice.js";
import { craftReviewBlock } from "../craft/tournament-graphics.js";
import { naruTastingCategory } from "../craft/naru-tasting.js";
import { CH5_SCENE_BG, CH5_SCENE_BGM, CH5_DEFAULT_BGM, CH5_PROLOGUE, CH5_MATCH_SCENES, CH5_AFTERMATH, CH5_SCENE_FILES, CH5_PREP_TRIALS,
  chapterFivePrepScene, chapterFivePreparation, chapterFivePrepPending, chapterFivePrepEcho, chapterFiveLoverEcho,
  recordChapterFivePrepTrial, recordChapterFivePrepAdjustment,
  canAdvanceToChapterFive, advanceToChapterFive, chapterFiveProgress, chapterFiveRead,
  chapterFiveTimeoutPending, recordChapterFiveScheduleDecision,
  beginChapterFiveMatch, chapterFiveMatchOutcome, chapterFiveVoteTally, CH5_FIRST_CUP_VOTES, recordChapterFiveSecondCup,
  chapterFiveEndingContext, beginChapterFiveFinale, completeChapterFiveScene, CH5_LIME_MILESTONES, chapterFiveLimeDue,
  chapterFiveCreditsPending, recordChapterFiveCredits, chapterFiveTrueEndReached, chapterFiveFreeRemaining,
  chapterFivePostEndingPlan, chapterFivePostEndingUndecided, beginChapterFivePostEnding, chapterFivePostEndingNext,
  completeChapterFivePostEnding } from "./ch5-progress.js";
import { readCycleMeta, recordTrueEndForRun } from "../core/cycle-meta.js";

let session = null;
const current = owner => session === owner && owner.active && owner.state === state;
const test = name => `ch5-${name}`;

// 試合当日の場面カード文案（到着→一杯目→二杯目の前の順）。
const MATCH_CARDS = {
  arrival: { title: "試合当日", description: "会場に着いた。あとは、二台の煙だけ。" },
  firstCup: { title: "一台目", description: "一台目は、9000が、はじめの待ち方を再現する。" },
  beforeSecond: { title: "二台目の前に", description: "ここまでの日々が、二台目を作る。" },
};
const MATCH_ORDER = ["arrival", "firstCup", "beforeSecond"];
// 二本目の前の場面のうち、この cue の行は制作後に回し、実際の調整実績で差し替える。
const ADJUST_CUE = "second_cup_adjust";
// 調整の区分（naruTastingCategory と同じ土台）→ 制作直後の地の文。steady / unknown は台本の本文のまま。
const ADJUST_LINES = {
  recovered: "一度、熱が揺れた。炭を一つ離して、戻す。客がもう一度ホースを持つまで、待った。",
  offband: "炭を動かした。それでも最後まで、熱は落ち着ききらなかった。客は黙って、ホースを持った。",
  failed: "煙が、途中で荒れた。客は一口だけ吸って、ホースを置いた。",
};

const { button, perform } = createChapterActions({ current, test, logName: "[ch5]", renderError });

function menuButton(owner) {
  return el("button.btn", { type: "button", text: "MENU", dataset: { test: test("menu") },
    onclick: () => openMenu(owner) });
}

const openMenu = createChapterMenu({ current, test, title: "第五章 MENU" });

function hud() {
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
}

const card = createChapterCard({ hud, screen: "ch5", test, heading: "第五章 ／ 機械仕掛けの神", menuButton });

/** 必要な台本をすべて確認してから DB に公開する。欠けていれば状態を進めない。 */
async function loadDialogues() {
  const groups = await Promise.all(Object.entries(CH5_SCENE_FILES).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
  for (const [ids, dialogues] of groups) {
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

let routesTask = null;
/** 正本 data/story_routes.json（フィナーレとスタッフロールの後の振り分けにだけ使う）。失敗したら次回また取りに行く。 */
function loadEndingRoutes() {
  routesTask ||= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("../data/story_routes.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`story_routes: HTTP ${response.status}`);
      const routes = await response.json();
      if (typeof routes.ending?.start !== "string" || typeof routes.ending?.normal !== "string"
        || typeof routes.ending?.daily !== "string" || typeof routes.ending?.salaryman_name !== "string"
        || !Array.isArray(routes.heroine_ids)
        || !routes.romance || typeof routes.romance !== "object"
        || typeof routes.conflict?.open !== "string" || typeof routes.conflict?.pending_ending !== "string") {
        throw new Error("story_routes: 形式を確認してください");
      }
      return routes;
    } finally { clearTimeout(timer); }
  })().catch(error => { routesTask = null; throw error; });
  return routesTask;
}

/** 第4章の完了カードからの入口。 */
export function beginChapterFive() {
  if (!canAdvanceToChapterFive(state)) return false;
  return openChapter(true);
}

export function resumeChapterFive() {
  if (state?.chapter !== 5) return false;
  return openChapter(false);
}

async function openChapter(advance) {
  if (session) { session.active = false; session.controller?.abort(); }
  const owner = session = { state, growthDay: state.day, active: true, busy: false, menuBusy: false, controller: null };
  document.body.classList.remove("ch2-city", "ch2-main", "ch2-tournament", "ch3-intro", "ch3-aftermath", "ch3-tournament", "ch4-intro");
  document.body.classList.add("ch5-intro");
  hud();
  showScreen("ch5-loading", el("main.ch2-contest", [
    el("h1", { text: "第五章・機械仕掛けの神" }),
    el("p", { role: "status", text: "橙須の場面を準備しています…" }),
  ]));
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); }, { once: true });
  await perform(owner, async () => {
    // 台本不足のまま第4章のクリアセーブを進めない。
    await loadDialogues();
    if (!current(owner)) return;
    if (advance) {
      if (!advanceToChapterFive(state)) return;
      stopBgm();
      save();
    }
    if (!current(owner)) return;
    const progress = chapterFiveProgress(state);
    playBgm(CH5_DEFAULT_BGM); // 仮置き: 第5章専用BGMが無いので既存曲を流用（#1177 で差し替え）
    if (progress.part === "prologue" && !progress.titleSeen) {
      await setBg(bgUrl(CH5_SCENE_BG[CH5_PROLOGUE[0].id]), { instant: true });
      if (!current(owner)) return;
      if (!await playChapterPoem(5, { owner, current })) return; // 章タイトルの前の巻頭ポエム
      await chapterTitle(CHAPTER_TITLE_ART.find(entry => entry.chapter === 5));
      if (!current(owner)) return;
      progress.titleSeen = true;
      save();
    }
    await renderStage(owner);
  });
}

async function readScene(owner, id, { keepHud = false } = {}) {
  if (!current(owner)) return false;
  const source = DB.dialogues[id];
  if (!source) throw new Error(`台本がありません: ${id}`);
  // 台本の metadata.bg は持ち込まず、ch5-progress.js の対応表（仮置き）で背景を決める。
  // 二本目の調整の行は、制作の後で実績に合わせて読む（ここでは外す）。
  const lines = id === CH5_MATCH_SCENES.beforeSecond ? source.lines.filter(line => line.cue !== ADJUST_CUE) : source.lines;
  // 試作の返り（#1666）は同じ場面の末尾に続けて読み、読了の確定も親場面と一緒にする。
  // 恋人のましろの訪問（#2024 A2）も同じく末尾に続け、親場面と一緒に確定する。
  const loverEcho = chapterFiveLoverEcho(state, id, { milestoneDue: loverMilestonesDue(["mashiro"]).length > 0 });
  const echo = [...chapterFivePrepEcho(state, id), ...loverEcho].map(echoId => {
    if (!DB.dialogues[echoId]) throw new Error(`台本がありません: ${echoId}`);
    return DB.dialogues[echoId].lines;
  });
  const dialogue = { ...source, lines: [...lines, ...echo.flat()], metadata: { ...source.metadata, bg: "" } };
  showScreen("none", null);
  if (!keepHud) hud(); // 日常ループ（#2033）の途中では、日常のHUDを消さない
  await setBg(bgUrl(CH5_SCENE_BG[id]));
  // 挑戦状と9000の登場は、第1章の優勝の夜の「???」と同じ横線のノイズで見出しが置き換わる（#2688 A6）。初めて読むときだけ
  const scan = SCAN_SCENES[id];
  if (scan && !chapterFiveRead(state, id)) { await sceneMoment("scanGlitch", scan); if (!current(owner)) return false; }
  if (!current(owner)) return false;
  // 節目だけ既存曲へ切り替える（#1668 2-7）。表に無い場面は tonari。
  playBgm(CH5_SCENE_BGM[id] || CH5_DEFAULT_BGM);
  // 読了のcheckpointまで保存を出さない。会話中のMENUは置かない。
  const controller = new AbortController();
  owner.controller = controller;
  let scheduleChoice = null;
  const previousOnChoice = hooks.onChoice;
  const choiceHook = id === "ch5_schedule_contact" ? (...args) => {
    previousOnChoice?.(...args);
    if (args[0] === "ch5_schedule_contact" && args[1] === "ch5_schedule_contact_choice") scheduleChoice = args[2];
  } : null;
  if (choiceHook) hooks.onChoice = choiceHook;
  try {
    const result = await play(dialogue, { signal: controller.signal });
    const finished = current(owner) && !controller.signal.aborted && !!result && !result.cancelled;
    if (finished && id === "ch5_schedule_contact") {
      // ※捕捉できなかった場合は安全側（先送り）に倒す。日程を誤って確定させない。
      recordChapterFiveScheduleDecision(state, scheduleChoice ?? "defer");
    }
    return finished;
  } finally {
    if (choiceHook && hooks.onChoice === choiceHook) hooks.onChoice = previousOnChoice;
    if (owner.controller === controller) owner.controller = null;
  }
}

/**
 * 会えた恋人の未読の節目（lover_events.json）を一つだけ読む（#2024 A2。第3章の readLoverMilestoneAt と同じ形）。
 * 読了と既読の保存は romance.js が持つ。中断すれば未読のまま残る。
 */
async function readLoverMilestoneAt(owner, id) {
  if (!current(owner) || !loverMilestonesDue([id]).length) return false;
  const controller = owner.controller = new AbortController();
  try { return await readLoverMilestone(id, { signal: controller.signal }); }
  finally { if (owner.controller === controller) owner.controller = null; }
}

// 節目の LIME の画面表記（#1668 2-8）。
const LIME_SCREEN = {
  [CH5_LIME_MILESTONES.prep]: { title: "日程が決まった夜", time: "夜" },
  [CH5_LIME_MILESTONES.afterMatch]: { title: "勝負のあと", time: "夜" },
};

/**
 * 節目の LIME を既存の受信箱（openPhone）で読む。第5章で会った相手からだけ届き、読み終えたら保存する。
 * 読み終える前に離れた分は受信箱から外し、次にこのカードへ戻ったときに届け直す（第5章には LIME 一覧の入口が無い）。
 */
async function deliverLime(owner, milestone) {
  const { hasContact } = await import("../daily/spots.js");
  if (!current(owner)) return false;
  const due = chapterFiveLimeDue(state, milestone, DB.lime, hasContact);
  if (!due.length) return true;
  const { openPhone } = await import("../daily/phone.js");
  if (!current(owner)) return false;
  const ids = new Set(due.map(m => m.id));
  state.inbox = state.inbox.filter(item => !ids.has(item.originId || item.id));
  showScreen("none", null);
  hud();
  await openPhone(due, LIME_SCREEN[milestone]);
  if (!current(owner)) return false;
  state.inbox = state.inbox.filter(item => item.done || !ids.has(item.originId || item.id));
  save();
  return true;
}

/** 読了 → 確定 → 保存。確定できなければ（別partの場面など）保存せず false。 */
async function readAndCommit(owner, id, options = {}) {
  const optional = chapterFiveFreeRemaining(state).some(scene => scene.id === id);
  if (!await readScene(owner, id, options)) return false;
  if (!completeChapterFiveScene(state, id)) return false;
  if (optional) awardSceneExp(id);
  if (state.flags._ch5_cleared) {
    awardChapterClearExp();
    // 最終場面は「数日後のtonari」。残る経験をここで精算する。日数・体力は新設しない。
    await presentNight();
    if (!current(owner)) return false;
  }
  save();
  return true;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  if (!await chapterGrowthNight(owner, () => current(owner))) return;
  const progress = chapterFiveProgress(state);
  if (progress.part === "prologue") return renderScene(owner, CH5_PROLOGUE[progress.stage], "");
  if (progress.part === "free") {
    if (chapterFiveTimeoutPending(state)) return renderTimeoutCard(owner);
    return chapterFivePrepPending(state) ? renderPrep(owner) : renderFree(owner);
  }
  // 日を決めた夜の途中の保存は、日常ループで翌朝（勝負の日）まで進めてからカードへ。
  if (progress.part === "scheduled" && Number.isInteger(progress.matchDay) && state.day < progress.matchDay) return renderFree(owner);
  if (progress.part === "scheduled") return renderScheduled(owner);
  if (progress.part === "match") return renderMatch(owner);
  if (progress.part === "aftermath") {
    if (!await deliverLime(owner, CH5_LIME_MILESTONES.afterMatch)) return;
    return renderScene(owner, CH5_AFTERMATH[progress.aftermath], "");
  }
  if (progress.part === "finale") return renderFinale(owner);
  // スタッフロールを流し終えた後、恋人が2人以上なら修羅場と話し直し（IR32）。済んでいれば完了カード。
  if (!chapterFiveCreditsPending(state)) {
    const due = await preparePostEnding(owner);
    if (!current(owner)) return;
    if (due) return renderPostEnding(owner);
  }
  return renderComplete(owner);
}

/** 読んだ後にその場にいる人へ、心得の盤で灯した授業を相談できる場面（SBD91。灯していなければ何も起きない） */
const LESSON_AFTER_SCENE = Object.freeze({ ch5_doctor_after_match: "dr_kemuri" });

async function renderScene(owner, scene, dayLabel) {
  await enterScene(bgUrl(CH5_SCENE_BG[scene.id]));
  if (!current(owner)) return;
  card(owner, "scene", `${dayLabel ? `${dayLabel}・` : ""}${scene.label}`, `${scene.location}で、次の話を読む。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      // 勝負のあと、一緒に一台作った博士に相談する
      const teacher = LESSON_AFTER_SCENE[scene.id];
      if (teacher) await consultLessons(teacher, { bg: bgUrl(CH5_SCENE_BG[scene.id]) });
      if (!current(owner)) return;
      await renderStage(owner);
    }, true),
  ], "", scene.id);
}

// 走査の見出し（#2688 A6）
const SCAN_SCENES = Object.freeze({ ch5_opening: { from: "???", to: "挑戦状" }, [CH5_MATCH_SCENES.arrival]: { from: "???", to: "SHISHA-9000" } });

/** これまでに会った人の登場カットインの色（スタッフロール前の煙・#2688 A8）。主な人から最大8色 */
function metColors() {
  const art = DB.manifest?.introArt || {};
  const order = ["sumi", "naru", "tsumugi", "minto", "adam", "ageha", "mashiro", "saku", "hiyori", "samechan", "noor", "sheikh", "dr_kemuri"];
  return order.filter(id => state.met?.[id] && art[id]?.color).map(id => art[id].color).slice(0, 8);
}

/** 先送りを選んだ直後の復帰先。timeout を読むまで自由行動のカードは出さない。 */
async function renderTimeoutCard(owner) {
  await enterScene(bgUrl(CH5_SCENE_BG.ch5_timeout));
  if (!current(owner)) return;
  card(owner, "scene", "日程は先送り", "tonariで、次の話を読む。", [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, "ch5_timeout")) return;
      await renderStage(owner);
    }, true),
  ], "", "ch5_timeout");
}

/** 閉店後の試作（#1666）: 何を試すか → スミさんが吸って返す → 直すか、そのまま覚えるか。 */
async function renderPrep(owner) {
  await enterScene(bgUrl(CH5_SCENE_BG.ch5_free_tonari_practice));
  if (!current(owner)) return;
  const prep = chapterFivePreparation(state);
  if (!prep) {
    card(owner, "prep", "閉店後の試作", "ダブルアップル12グラム。今夜は、何を試す？",
      CH5_PREP_TRIALS.map(trial => button(owner, trial.label, `prep-${trial.id}`, async () => {
        if (!await readScene(owner, chapterFivePrepScene("trial", trial.id))) return;
        if (!recordChapterFivePrepTrial(state, trial.id)) return;
        save();
        await renderStage(owner);
      })), "できた一台は、スミさんが吸って返してくれる。");
    return;
  }
  const trial = CH5_PREP_TRIALS.find(entry => entry.id === prep.trial);
  const settle = (adjusted, sceneId) => async () => {
    if (!await readScene(owner, sceneId)) return;
    if (!recordChapterFivePrepAdjustment(state, adjusted)) return;
    save();
    await renderStage(owner);
  };
  card(owner, "prep", "もう一台か、このままか", `スミさんの返答: ${trial.point}`, [
    button(owner, trial.adjust, "prep-adjust", settle(true, chapterFivePrepScene("adjust", trial.id)), true),
    button(owner, "このまま、手に覚えさせる", "prep-keep", settle(false, chapterFivePrepScene("keep"))),
  ], `試したこと: ${trial.label}`);
}

/**
 * 自由行動（#2033）: 第1・2章と同じ日常ループ（daily/calendar.js）で、地図・日付・昼夜・体力・育成（上限100）。
 * tonari の3場面・閉店後の試作・EDEN・博士への連絡は chapters/ch5-daily.js が行き先に差し込む。
 * 博士と日を決めると翌朝が勝負の日になり、ループが終わってここへ戻る（日程のカードへ）。
 */
async function renderFree(owner) {
  const { runChapterFiveDaily } = await import("./ch5-daily.js");
  if (!current(owner)) return;
  showScreen("none", null);
  playBgm(CH5_DEFAULT_BGM);
  // 帰国後の tonari の打ち上げ（一度だけ。誰の隣に座るか・恋人が2人以上なら修羅場）。中断なら次の入場でやり直す。
  const { runAfterParty } = await import("./ch5-party.js");
  if (!current(owner)) return;
  await runAfterParty();
  if (!current(owner)) return;
  const io = { readAndCommit: id => readAndCommit(owner, id, { keepHud: true }), readScene: id => readScene(owner, id, { keepHud: true }),
    readLoverMilestone: id => readLoverMilestoneAt(owner, id) };
  await runChapterFiveDaily(io);
  if (!current(owner)) return;
  hud();
  await renderStage(owner);
}

async function renderScheduled(owner) {
  await enterScene(bgUrl(CH5_SCENE_BG.ch5_schedule_contact));
  if (!current(owner) || !await deliverLime(owner, CH5_LIME_MILESTONES.prep)) return;
  card(owner, "scheduled", "勝負の日程が決まった", "店の休業日。博士との勝負は、その日になった。", [
    button(owner, "会場へ行く", "go-venue", async () => {
      // Q15: 会場入りの確認。本文は台本コメントの指定どおり一字も変えない。
      const choice = await modal({ title: "会場へ行く", body: "この先、勝負の終わりまで自由行動に戻れません。会場へ向かいますか", options: [
        { label: "向かう", value: "go", test: test("venue-go"), primary: true },
        { label: "まだ行かない", value: "stay", test: test("venue-stay") },
      ] });
      if (!current(owner)) return;
      // 「まだ行かない」は保留だけ。日程はそのままで、このカードに留まる（取り消しは別ボタン）。
      if (choice === "go") {
        if (!beginChapterFiveMatch(state)) throw new Error("試合を開始できません");
        save();
        await renderStage(owner);
      }
    }, true),
    button(owner, "日程を取り消す", "cancel-schedule", async () => {
      // 取り消しは ch5_timeout を読んで自由行動へ戻る（日程は白紙）。
      if (!await readAndCommit(owner, "ch5_timeout")) return;
      await renderStage(owner);
    }),
  ], "会場へ向かう準備ができたら「会場へ行く」。日程を変えたいときは取り消せる。");
}

async function renderMatch(owner) {
  const key = MATCH_ORDER.find(name => !chapterFiveRead(state, CH5_MATCH_SCENES[name]));
  if (key) {
    const id = CH5_MATCH_SCENES[key];
    const text = MATCH_CARDS[key];
    await enterScene(bgUrl(CH5_SCENE_BG[id]));
    if (!current(owner)) return;
    card(owner, "match", text.title, text.description, [
      button(owner, "続きを読む", "continue", async () => {
        // 到着→一杯目→二杯目の前は短い連続場面なので、カードを挟まず続けて読む。各場面の読了ごとに保存する。
        for (const name of MATCH_ORDER) {
          const sceneId = CH5_MATCH_SCENES[name];
          if (chapterFiveRead(state, sceneId)) continue;
          if (!await readAndCommit(owner, sceneId)) return;
        }
        await renderStage(owner);
      }, true),
    ], "", id);
    return;
  }
  // 一本目は台本の固定票。二本目だけ実制作し、確定後は保存済みの挙手と結果を表示する。
  const outcome = chapterFiveMatchOutcome(state);
  if (outcome === null) return renderSecondCupReady(owner);
  const sequence = outcome === "win"
    ? [CH5_MATCH_SCENES.win, CH5_MATCH_SCENES.afterglow] : [CH5_MATCH_SCENES.loss];
  const first = sequence.find(id => !chapterFiveRead(state, id)) ?? sequence[0];
  await enterScene(bgUrl(CH5_SCENE_BG[first]));
  if (!current(owner)) return;
  const tally = chapterFiveVoteTally(state);
  card(owner, "match", "二台分の挙手", "同じ観客が、二台とも吸った。合計で決まる。", [
    button(owner, "結果を聞く", "continue", async () => {
      for (const id of sequence) {
        if (chapterFiveRead(state, id)) continue;
        if (!await readAndCommit(owner, id)) return;
      }
      await renderStage(owner);
    }, true),
  ], tally ? voteNote(tally) : "", first,
  [craftReviewBlock(chapterFiveProgress(state).secondCup?.review, test("craft-review"))]);
}

// 挙手の数だけを並べる。審査員の採点表や恋愛の加点は出さない（第5章は観客投票）。
function voteNote(tally) {
  return `一台目 はじめ ${tally.first.hajime}／9000 ${tally.first.machine}　`
    + `二台目 はじめ ${tally.second.hajime}／9000 ${tally.second.machine}　`
    + `合計 はじめ ${tally.total.hajime}／9000 ${tally.total.machine}`;
}

async function renderSecondCupReady(owner) {
  await enterScene(bgUrl(CH5_SCENE_BG[CH5_MATCH_SCENES.beforeSecond]));
  if (!current(owner)) return;
  const tally = `一台目の挙手は はじめ ${CH5_FIRST_CUP_VOTES.hajime}／9000 ${CH5_FIRST_CUP_VOTES.machine}。`;
  card(owner, "second-cup", "二台目", "同じダブルアップル12g。今度は、目の前の客を待つ一台を作る。", [
    button(owner, "二台目を作る", "second-cup-start", () => craftSecondCup(owner), true),
  ], `${tally}二台目は提供のあと、同じ一台を二度調整する。`, CH5_MATCH_SCENES.beforeSecond);
}

/** U1 の制作開始境界。入場後、二本目だけ実制作する。U5: セッション途中は保存・工程 rollback しない。 */
async function craftSecondCup(owner) {
  // 途中離脱・再読込では secondCup が null のままなので、二本目の前から丸ごと作り直す。
  const cs = newSession("tournament");
  cs.eventTitle = "EXHIBITION MATCH";
  cs.eventNote = "SHISHA-9000 戦・二台目";
  cs.orderFlavorIds = ["double_apple"]; // 課題はダブルアップル単体。ほかの葉は混ぜない。
  hud();
  openBench(cs, { steps: CRAFT_STEPS });
  await waitBenchReady(cs);
  if (!current(owner)) return;
  for (const step of [stepSetup, stepWater, stepMix, stepPack, runHoles, stepPlace, runHeat, stepSteamTime, runSteamDodge]) {
    await step(cs);
    if (!current(owner)) return;
    if (cs.failed) break;
  }
  // 吸い出しの画面離脱は負けにしない。記録を残さず二本目の前へ戻す。
  if (!cs.failed && await runPull(cs) === false) { if (current(owner)) await renderStage(owner); return; }
  if (!current(owner)) return;
  if (!cs.failed) {
    // 提供直後のひと口。実配合と提供時の温度から（第1章と同じ部品）。
    if (!await playLines(owner, "ch5_second_cup_served", servedEvaluationLines(cs))) return;
    for (const round of [1, 2]) {
      openBench(cs, { steps: CRAFT_STEPS });
      await waitBenchReady(cs);
      if (!current(owner)) return;
      await runCare(cs, { round });
      if (!current(owner) || cs.failed) break;
    }
  }
  if (!current(owner)) return;
  const failed = !!cs.failed;
  if (!failed) finalize(cs);
  const category = failed ? "failed" : naruTastingCategory(cs);
  // 完成した実績から観客票を一度だけ確定。再表示・再読込では保存済みの secondCup を読む。
  if (!recordChapterFiveSecondCup(state, { total: cs.total, category, failed, review: craftReviewLines(cs) })) throw new Error("二本目の記録を確定できません");
  // 報酬表への対応（仮）: 一対一の勝利側は1位、既存の敗北側（同数を含む）は2位相当。挙手・勝敗は変えない。
  awardTournamentExp(chapterFiveMatchOutcome(state) === "win" ? 1 : 2, cs);
  save();
  const source = DB.dialogues[CH5_MATCH_SCENES.beforeSecond]?.lines.find(line => line.cue === ADJUST_CUE);
  const text = ADJUST_LINES[category] || source?.text;
  if (text && !await playLines(owner, "ch5_second_cup_adjust", [{ speaker: "", face: "", text }])) return;
  await renderStage(owner);
}

/** 場面として保存しない短い地の文（制作の合間）を読む。 */
async function playLines(owner, id, lines) {
  if (!current(owner)) return false;
  showScreen("none", null);
  hud();
  await setBg(bgUrl(CH5_SCENE_BG[CH5_MATCH_SCENES.beforeSecond]));
  if (!current(owner)) return false;
  const controller = new AbortController();
  owner.controller = controller;
  try {
    const result = await play({ dialogue_id: id, lines }, { signal: controller.signal });
    return current(owner) && !controller.signal.aborted && !!result && !result.cancelled;
  } finally { if (owner.controller === controller) owner.controller = null; }
}

async function renderFinale(owner) {
  let progress = chapterFiveProgress(state);
  if (!progress.finaleScenes) {
    // 恋人がちょうど1人なら中間がその人の後日談（epilogue_*）、それ以外は ending_normal（#517）。
    // 読み終えたらスタッフロール（renderStaffRoll）。恋人が2人以上なら、その後に修羅場と話し直し（renderPostEnding）。
    const routes = await loadEndingRoutes();
    if (!current(owner)) return;
    const scenes = [...selectStoryEnding(routes, state, chapterFiveEndingContext(routes, state)), routes.ending.salaryman_name];
    if (!beginChapterFiveFinale(state, scenes)) throw new Error("フィナーレを開始できません");
    save();
    progress = chapterFiveProgress(state);
  }
  const scene = { id: progress.finaleScenes[progress.finale], label: "フィナーレ", location: "tonari" };
  await enterScene(bgUrl(CH5_SCENE_BG[scene.id]));
  if (!current(owner)) return;
  card(owner, "scene", scene.label, "物語の締めくくりを読む。", [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }, true),
  ], "", scene.id);
}

/** タイトル画面へ戻る（起動し直してタイトルを出す）。 */
function backToTitle() {
  save();
  location.reload();
}

/**
 * スタッフロールの後のリザルト（#2902）。初回の締め（そのままか、話し直しを全部読んだ後）はタイトルへ、
 * 完了カードからの見直しはカードへ戻る。勝負の結果は保存済みの won と挙手だけを読む。
 */
async function showResult(owner, { toTitle = true } = {}) {
  hud();
  const progress = chapterFiveProgress(state);
  const tally = chapterFiveVoteTally(state);
  await playResult(state, { match: { won: progress.won, tally: tally?.total || null }, next: toTitle ? "タイトルへ" : "もどる" });
  if (!current(owner)) return;
  if (toTitle) return backToTitle();
  return renderComplete(owner);
}

/**
 * フィナーレの後のスタッフロール（#517）。初めて流し終えたら記録し、リザルト（#2902）を見せてタイトルへ戻る。
 * 途中で閉じたら、次に再開したとき完了カードから流し直す（一度も最後まで見ていない端末では飛ばせない）。
 * 見終えた保存からの見直しはいつでも飛ばせて、リザルトの後に完了カードへ戻る。
 */
async function renderStaffRoll(owner) {
  const first = chapterFiveCreditsPending(state);
  hud();
  // 出会った人の色の煙が絡んで一本になり、スタッフロールへ（#2688 A8）。初めて流すときだけ
  if (first) { await sceneMoment("mixedSmoke", metColors()); if (!current(owner)) return; }
  await playStaffRoll({ ...(first ? {} : { skippable: true }), ...(vnTest.turbo ? { durationMs: 1500 } : {}) });
  if (!current(owner)) return;
  if (!first) return showResult(owner, { toTitle: false });
  if (!recordChapterFiveCredits(state)) throw new Error("スタッフロールの記録を確定できません");
  noteTrueEnd({ justFinished: true }); // 戻った先のタイトルに NEXT CYCLE が出る
  save();
  // 恋人が2人以上なら、タイトルの前にスタッフロールの後の修羅場と話し直し（IR32）。読み終えたらタイトルへ。
  const due = await preparePostEnding(owner);
  if (!current(owner)) return;
  if (due) return renderPostEnding(owner);
  await showResult(owner);
}

/**
 * スタッフロールの後の並びを、まだなら一度だけ決めて保存する（IR32）。読む場面が残っていれば true。
 * この接続より前にスタッフロールまで見終えた保存も、次に開いた時にここで決まる。
 */
async function preparePostEnding(owner) {
  if (chapterFivePostEndingUndecided(state)) {
    const routes = await loadEndingRoutes();
    if (!current(owner)) return false;
    if (!beginChapterFivePostEnding(state, chapterFivePostEndingPlan(routes, state))) {
      throw new Error("スタッフロールの後の場面を決められません");
    }
    save();
  }
  return !!chapterFivePostEndingNext(state);
}

/**
 * スタッフロールの後（IR32）。修羅場（開始→恋人ごとの反応→謝罪→話し直しの決意）は続けて読み、
 * 話し直しは本人が決めた日に一人ずつ、カードから読む。場面ごとに確定・保存するので、途中のLOADは読みかけの場面から。
 * 報酬・経験は付けない。全部読み終えたらタイトルへ（以後の再開は完了カード）。
 */
async function renderPostEnding(owner) {
  const next = chapterFivePostEndingNext(state);
  if (!next) return renderComplete(owner);
  await enterScene(bgUrl(CH5_SCENE_BG[next.id]));
  if (!current(owner)) return;
  const [title, description, note] = next.talk
    ? ["話し直し", "本人が決めた日に、一人ずつ会って話す。", `${next.index}人目／${next.total}人`]
    : ["後日のtonari", "閉店後のtonariで、次の話を読む。", ""];
  card(owner, "scene", title, description, [
    button(owner, "続きを読む", "continue", async () => {
      for (;;) {
        const scene = chapterFivePostEndingNext(state);
        if (!scene || !await readScene(owner, scene.id)) return;
        if (!completeChapterFivePostEnding(state, scene.id)) return;
        save();
        const following = chapterFivePostEndingNext(state);
        if (!following) return showResult(owner); // 話し直しまで読み終えたら、締めのリザルトからタイトルへ
        if (following.talk) break;
      }
      await renderStage(owner);
    }, true),
  ], note, next.id);
}

/**
 * スタッフロールまで見終えていれば、真エンドとして周回を解放する（#1228。条件は chapterFiveTrueEndReached）。
 * 初回のスタッフロール直後は、この周回を引き継ぎ元にする。完了カードからの再通知は、同じ周回ならパッケージの
 * 最新化だけで、別の周回のパッケージは巻き戻さない（recordTrueEndForRun）。
 * 記録できなくても締めの表示は止めない（次の完了カードで再通知）。
 * 解放済みなら、タイトルで始められる周回数を返す（それ以外は 0）。
 */
function noteTrueEnd({ justFinished = false } = {}) {
  try {
    if (!chapterFiveTrueEndReached(state)) return 0;
    recordTrueEndForRun(state, { justFinished });
    const meta = readCycleMeta();
    return meta.unlocked && meta.carryPackage ? meta.carryPackage.fromCycle + 1 : 0;
  } catch {
    return 0; // 締めの表示を止めない
  }
}

/**
 * 第五章・完。フィナーレの直後に一度出し、章の伸びをレーダーで見せてからスタッフロールへ進む（Refs #2033）。
 * スタッフロールを流し終えるまではタイトルへ抜ける操作を出さない（初回は飛ばせない）。
 */
function renderComplete(owner) {
  // 見終えた保存を開いたとき・盤を使って戻ったときも通知する（接続前に見終えた保存の解放と、パッケージの最新化）。
  const nextCycle = noteTrueEnd();
  const pending = chapterFiveCreditsPending(state);
  const actions = pending ? [
    button(owner, "スタッフロールへ", "complete-credits", () => renderStaffRoll(owner), true),
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow()),
    ...reflectionActions(owner), // 時間を使わない盤の入口はスタッフロールの前後どちらでも出す
  ] : [
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "スタッフロールを見る", "complete-credits", () => renderStaffRoll(owner)),
    button(owner, "タイトルへ", "complete-title", () => backToTitle()),
    ...reflectionActions(owner),
  ];
  card(owner, "complete", "第五章・完", "SHISHA-9000 の勝負は終わった。店の明かりが、いつもの夜に戻っていく。", actions,
    `ここまでが、この物語の終わりです。${nextCycle ? `タイトルの NEXT CYCLE から、${nextCycle}周目をはじめられます。` : ""}`, "",
    // 他の章と同じ比較。淡い面が第5章のはじめ、明るい面がいま。
    [el("div.end-radar", { dataset: { test: test("growth") } }, [
      chapterGrowthChart(state, 300),
      el("p", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
    ])]);
}

function reflectionActions(owner) {
  return canReflect() ? [button(owner, "観音堂で盤を開く（時間は進まない）", "reflect", async () => {
    await reflectAtSpot("kannon", { boardOnly: true });
    if (current(owner)) await renderStage(owner);
  })] : [];
}

function renderError(owner) {
  card(owner, "error", "第5章を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "retry", () => state.chapter === 5 ? resumeChapterFive() : beginChapterFive(), true),
  ]);
}

