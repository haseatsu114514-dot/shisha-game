// 第5章・機械仕掛けの神。帰郷後のプロローグ→自由行動→日程→試合当日→後日談→フィナーレまでを、場面単位で保存する。
// 状態遷移は ch5-progress.js。ここは表示と再生だけを持つ。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { createChapterActions } from "../core/chapter-actions.js";
import { awardChapterClearExp, awardTournamentExp } from "../core/growth.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play, hooks } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { selectStoryEnding } from "../core/story-routes.js";
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
  chapterFivePrepScene, chapterFivePreparation, chapterFivePrepPending, chapterFivePrepEcho,
  recordChapterFivePrepTrial, recordChapterFivePrepAdjustment,
  canAdvanceToChapterFive, advanceToChapterFive, chapterFiveProgress, chapterFiveRead,
  chapterFiveFreeRemaining, chapterFiveTimeoutPending, recordChapterFiveScheduleDecision,
  beginChapterFiveMatch, chapterFiveMatchOutcome, chapterFiveVoteTally, CH5_FIRST_CUP_VOTES, recordChapterFiveSecondCup,
  beginChapterFiveFinale, completeChapterFiveScene, CH5_LIME_MILESTONES, chapterFiveLimeDue } from "./ch5-progress.js";

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

async function openMenu(owner) {
  if (!current(owner) || owner.menuBusy) return;
  owner.menuBusy = true;
  try {
    const choice = await modal({ title: "第五章 MENU", body: "読み終えた場面から再開できます。", options: [
      { label: "セーブ", value: "save", test: test("save") },
      { label: "ロード", value: "load", test: test("load") },
      { label: "設定", value: "config", test: test("config") },
      { label: "タイトルへ戻る", value: "title", test: test("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!current(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "config") await (await import("../scenes/title.js")).openConfig();
    if (choice === "load") {
      const key = await loadFlow({ inGame: true });
      if (key && loadFromSlot(key)) {
        owner.active = false;
        owner.controller?.abort();
        requestResumeOnBoot();
        location.reload();
      }
    }
    if (choice === "title") {
      save();
      owner.active = false;
      owner.controller?.abort();
      location.reload();
    }
  } finally { owner.menuBusy = false; }
}

function hud() {
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
}

function card(owner, name, title, description, actions = [], note = "", sceneId = "", extra = []) {
  hud();
  showScreen("ch5", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第五章 ／ 機械仕掛けの神" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
    ...extra,
    el("div.ch2-contest-actions", actions),
  ]));
}

/** 必要な台本をすべて確認してから DB に公開する。欠けていれば状態を進めない。 */
async function loadDialogues() {
  const groups = await Promise.all(Object.entries(CH5_SCENE_FILES).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
  for (const [ids, dialogues] of groups) {
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

let routesTask = null;
/** 正本 data/story_routes.json（フィナーレの振り分けにだけ使う）。失敗したら次回また取りに行く。 */
function loadEndingRoutes() {
  routesTask ||= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("../data/story_routes.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`story_routes: HTTP ${response.status}`);
      const routes = await response.json();
      if (typeof routes.ending?.start !== "string" || typeof routes.ending?.normal !== "string"
        || typeof routes.ending?.daily !== "string" || !Array.isArray(routes.heroine_ids)
        || !routes.romance || typeof routes.romance !== "object") {
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
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null };
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
      await chapterTitle(CHAPTER_TITLE_ART.find(entry => entry.chapter === 5));
      if (!current(owner)) return;
      progress.titleSeen = true;
      save();
    }
    await renderStage(owner);
  });
}

async function readScene(owner, id) {
  if (!current(owner)) return false;
  const source = DB.dialogues[id];
  if (!source) throw new Error(`台本がありません: ${id}`);
  // 台本の metadata.bg は持ち込まず、ch5-progress.js の対応表（仮置き）で背景を決める。
  // 二本目の調整の行は、制作の後で実績に合わせて読む（ここでは外す）。
  const lines = id === CH5_MATCH_SCENES.beforeSecond ? source.lines.filter(line => line.cue !== ADJUST_CUE) : source.lines;
  // 試作の返り（#1666）は同じ場面の末尾に続けて読み、読了の確定も親場面と一緒にする。
  const echo = chapterFivePrepEcho(state, id).map(echoId => {
    if (!DB.dialogues[echoId]) throw new Error(`台本がありません: ${echoId}`);
    return DB.dialogues[echoId].lines;
  });
  const dialogue = { ...source, lines: [...lines, ...echo.flat()], metadata: { ...source.metadata, bg: "" } };
  showScreen("none", null);
  hud();
  await setBg(bgUrl(CH5_SCENE_BG[id]), { instant: true });
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
async function readAndCommit(owner, id) {
  if (!await readScene(owner, id)) return false;
  if (!completeChapterFiveScene(state, id)) return false;
  if (state.flags._ch5_cleared) awardChapterClearExp();
  save();
  return true;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  const progress = chapterFiveProgress(state);
  if (progress.part === "prologue") return renderScene(owner, CH5_PROLOGUE[progress.stage], "");
  if (progress.part === "free") {
    if (chapterFiveTimeoutPending(state)) return renderTimeoutCard(owner);
    return chapterFivePrepPending(state) ? renderPrep(owner) : renderFree(owner);
  }
  if (progress.part === "scheduled") return renderScheduled(owner);
  if (progress.part === "match") return renderMatch(owner);
  if (progress.part === "aftermath") {
    if (!await deliverLime(owner, CH5_LIME_MILESTONES.afterMatch)) return;
    return renderScene(owner, CH5_AFTERMATH[progress.aftermath], "");
  }
  if (progress.part === "finale") return renderFinale(owner);
  return renderComplete(owner);
}

async function renderScene(owner, scene, dayLabel) {
  await setBg(bgUrl(CH5_SCENE_BG[scene.id]), { instant: true });
  if (!current(owner)) return;
  card(owner, "scene", `${dayLabel ? `${dayLabel}・` : ""}${scene.label}`, `${scene.location}で、次の話を読む。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }, true),
  ], "", scene.id);
}

/** 先送りを選んだ直後の復帰先。timeout を読むまで自由行動のカードは出さない。 */
async function renderTimeoutCard(owner) {
  await setBg(bgUrl(CH5_SCENE_BG.ch5_timeout), { instant: true });
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
  await setBg(bgUrl(CH5_SCENE_BG.ch5_free_tonari_practice), { instant: true });
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

async function renderFree(owner) {
  await setBg(bgUrl(CH5_SCENE_BG.ch5_free), { instant: true });
  if (!current(owner)) return;
  playBgm(CH5_DEFAULT_BGM);
  const unread = chapterFiveFreeRemaining(state);
  const remaining = unread.filter(scene => scene.location === "tonari");
  const actions = [];
  if (remaining.length) {
    actions.push(button(owner, `tonari で過ごす（${remaining[0].label}）`, "spend-tonari", async () => {
      const [next] = chapterFiveFreeRemaining(state).filter(scene => scene.location === "tonari");
      if (!next || !await readAndCommit(owner, next.id)) return;
      await renderStage(owner);
    }));
  }
  // tonari の外の任意場面（#1588 EDEN）は、それぞれ別の入口から1回だけ。
  for (const scene of unread.filter(entry => entry.location !== "tonari")) {
    actions.push(button(owner, `${scene.location} に寄る（${scene.label}）`, `visit-${scene.location.toLowerCase()}`, async () => {
      if (!chapterFiveFreeRemaining(state).some(entry => entry.id === scene.id)
        || !await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }));
  }
  // 恋人からのLIME（#2024）。第1・2章と同じ処理（lover-entry.js → daily/romance.js）。
  // 第5章は恋人と過ごす場面（節目）を描かないので、LIMEだけ。
  const lover = await import("./lover-entry.js");
  if (!current(owner)) return;
  if (lover.pendingLoverLime().length) actions.push(button(owner, "恋人からのLIMEを読む", "lover-lime", async () => {
    showScreen("none", null);
    hud();
    await lover.readLoverLime();
    if (current(owner)) await renderStage(owner);
  }));
  // 友人からのたまのLIME（#2022）。
  const friend = await import("./friend-entry.js");
  if (!current(owner)) return;
  if (friend.pendingFriendLime().length) actions.push(button(owner, "友人・知り合いのLIMEを読む", "friend-lime", async () => {
    showScreen("none", null);
    hud();
    await friend.readFriendLime();
    if (current(owner)) await renderStage(owner);
  }));
  actions.push(button(owner, "博士に連絡する", "contact", async () => {
    // Q12: 「記録に残らない一日」が未読なら、先にそちらを読んでから連絡の場面へ。
    if (!chapterFiveRead(state, "ch5_unrecorded_day")
      && !await readAndCommit(owner, "ch5_unrecorded_day")) return;
    if (!await readAndCommit(owner, "ch5_schedule_contact")) return;
    await renderStage(owner);
  }, true));
  const description = remaining.length
    ? "勝負の前に、tonari で済ませておきたいことが残っている。博士との日程は、まだ決まっていない。"
    : "tonari での準備は済んだ。博士に連絡して、勝負の日を決める。";
  const note = remaining.length
    ? `次は「${remaining[0].label}」。残り${remaining.length}件は任意で、博士への連絡はいつでもできる。`
    : "tonari の用事は済んだ。あとは日程だけ。";
  card(owner, "free", "自由行動", description, actions, note);
}

async function renderScheduled(owner) {
  await setBg(bgUrl(CH5_SCENE_BG.ch5_schedule_contact), { instant: true });
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
    await setBg(bgUrl(CH5_SCENE_BG[id]), { instant: true });
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
  // 二本目: はじめが同じダブルアップル12gで実際に作り、その出来で観客の挙手が動く。
  const outcome = chapterFiveMatchOutcome(state);
  if (outcome === null) return renderSecondCupReady(owner);
  const sequence = outcome === "win"
    ? [CH5_MATCH_SCENES.win, CH5_MATCH_SCENES.afterglow] : [CH5_MATCH_SCENES.loss];
  const first = sequence.find(id => !chapterFiveRead(state, id)) ?? sequence[0];
  await setBg(bgUrl(CH5_SCENE_BG[first]), { instant: true });
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
  await setBg(bgUrl(CH5_SCENE_BG[CH5_MATCH_SCENES.beforeSecond]), { instant: true });
  if (!current(owner)) return;
  const tally = `一台目の挙手は はじめ ${CH5_FIRST_CUP_VOTES.hajime}／9000 ${CH5_FIRST_CUP_VOTES.machine}。`;
  card(owner, "second-cup", "二台目", "同じダブルアップル12g。今度は、目の前の客を待つ一台を作る。", [
    button(owner, "二台目を作る", "second-cup-start", () => craftSecondCup(owner), true),
  ], `${tally}二台目は提供のあと、同じ一台を二度調整する。`, CH5_MATCH_SCENES.beforeSecond);
}

/** 二本目の制作。作り終えるまで保存しない（途中で離れたら二本目の作り直しから）。 */
async function craftSecondCup(owner) {
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
  await setBg(bgUrl(CH5_SCENE_BG[CH5_MATCH_SCENES.beforeSecond]), { instant: true });
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
    // ※仮置き（#517）: 恋人の所在・約束の供給元が未整備のため、捏造せず present/accepted は空で渡す。
    // 中間は ending_normal になり、供給元ができたらこの呼び出しだけ差し替える。
    // スタッフロール後段（Q20）は接続しない。
    const routes = await loadEndingRoutes();
    if (!current(owner)) return;
    const scenes = selectStoryEnding(routes, state, { present: [], accepted: [] });
    if (!beginChapterFiveFinale(state, scenes)) throw new Error("フィナーレを開始できません");
    save();
    progress = chapterFiveProgress(state);
  }
  const scene = { id: progress.finaleScenes[progress.finale], label: "フィナーレ", location: "tonari" };
  await setBg(bgUrl(CH5_SCENE_BG[scene.id]), { instant: true });
  if (!current(owner)) return;
  card(owner, "scene", scene.label, "物語の締めくくりを読む。", [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }, true),
  ], "", scene.id);
}

function renderComplete(owner) {
  card(owner, "complete", "第五章・完", "SHISHA-9000 の勝負は終わった。店の明かりが、いつもの夜に戻っていく。", [
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], "ここまでが、この物語の終わりです。");
}

function renderError(owner) {
  card(owner, "error", "第5章を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "retry", () => state.chapter === 5 ? resumeChapterFive() : beginChapterFive(), true),
  ]);
}
