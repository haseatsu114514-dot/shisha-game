// 第5章・機械仕掛けの神。帰郷後のプロローグ→自由行動→日程→試合当日→後日談→フィナーレまでを、場面単位で保存する。
// 状態遷移は ch5-progress.js。ここは表示と再生だけを持つ。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play, hooks } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { selectStoryEnding } from "../core/story-routes.js";
import { readDialogues } from "./ch2-city-data.js";
import { CH5_SCENE_BG, CH5_PROLOGUE, CH5_MATCH_SCENES, CH5_AFTERMATH, CH5_SCENE_FILES, CH5_PREP_TRIALS,
  chapterFivePrepScene, chapterFivePreparation, chapterFivePrepPending, chapterFivePrepEcho,
  recordChapterFivePrepTrial, recordChapterFivePrepAdjustment, canAdvanceToChapterFive, advanceToChapterFive, chapterFiveProgress, chapterFiveRead,
  chapterFiveFreeRemaining, chapterFiveTimeoutPending, recordChapterFiveScheduleDecision,
  beginChapterFiveMatch, chapterFiveMatchOutcome, beginChapterFiveFinale, completeChapterFiveScene } from "./ch5-progress.js";

let session = null;
const current = owner => session === owner && owner.active && owner.state === state;
const test = name => `ch5-${name}`;

// 試合当日の場面カード文案（到着→一杯目→二杯目の前の順）。
const MATCH_CARDS = {
  arrival: { title: "試合当日", description: "会場に着いた。あとは、二本の煙だけ。" },
  firstCup: { title: "一杯目", description: "一本目は、9000が、はじめの待ち方を再現する。" },
  beforeSecond: { title: "二杯目の前に", description: "ここまでの日々が、二杯目を作る。" },
};
const MATCH_ORDER = ["arrival", "firstCup", "beforeSecond"];

function button(owner, text, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
    dataset: { test: test(name) }, onclick: () => perform(owner, action) });
}

async function perform(owner, action) {
  if (!current(owner) || owner.busy) return;
  owner.busy = true;
  try { await action(); }
  catch (error) {
    if (current(owner)) { console.error("[ch5]", error); renderError(owner); }
  } finally { owner.busy = false; }
}

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

function card(owner, name, title, description, actions = [], note = "", sceneId = "") {
  hud();
  showScreen("ch5", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第五章 ／ 機械仕掛けの神" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
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
    el("p", { role: "status", text: "大須の場面を準備しています…" }),
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
    playBgm("tonari"); // 仮置き: 第5章専用BGMが無いので既存曲を流用（#1177 で差し替え）
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
  // 試作の返り（#1666）は同じ場面の末尾に続けて読み、読了の確定も親場面と一緒にする。
  const echo = chapterFivePrepEcho(state, id).map(echoId => {
    if (!DB.dialogues[echoId]) throw new Error(`台本がありません: ${echoId}`);
    return DB.dialogues[echoId].lines;
  });
  const dialogue = { ...source, lines: [...source.lines, ...echo.flat()], metadata: { ...source.metadata, bg: "" } };
  showScreen("none", null);
  hud();
  await setBg(bgUrl(CH5_SCENE_BG[id]), { instant: true });
  if (!current(owner)) return false;
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

/** 読了 → 確定 → 保存。確定できなければ（別partの場面など）保存せず false。 */
async function readAndCommit(owner, id) {
  if (!await readScene(owner, id)) return false;
  if (!completeChapterFiveScene(state, id)) return false;
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
  if (progress.part === "aftermath") return renderScene(owner, CH5_AFTERMATH[progress.aftermath], "");
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
  const remaining = chapterFiveFreeRemaining(state);
  const actions = [];
  if (remaining.length) {
    actions.push(button(owner, `tonari で過ごす（${remaining[0].label}）`, "spend-tonari", async () => {
      const [next] = chapterFiveFreeRemaining(state);
      if (!next || !await readAndCommit(owner, next.id)) return;
      await renderStage(owner);
    }));
  }
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
  if (!current(owner)) return;
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
  // 二杯目: 勝敗は chapterFiveMatchOutcome の接続点1つで決まる。骨格では勝ち固定。
  const sequence = chapterFiveMatchOutcome(state) === "win"
    ? [CH5_MATCH_SCENES.win, CH5_MATCH_SCENES.afterglow] : [CH5_MATCH_SCENES.loss];
  const first = sequence.find(id => !chapterFiveRead(state, id)) ?? sequence[0];
  await setBg(bgUrl(CH5_SCENE_BG[first]), { instant: true });
  if (!current(owner)) return;
  card(owner, "match", "二杯目", "二本の合計で決まる。", [
    button(owner, "二杯目を出す", "continue", async () => {
      for (const id of sequence) {
        if (chapterFiveRead(state, id)) continue;
        if (!await readAndCommit(owner, id)) return;
      }
      await renderStage(owner);
    }, true),
  ], "", first);
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
