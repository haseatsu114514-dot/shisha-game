// 第3章・東京到着から全国大会前夜までを、場面単位で保存する。
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play, hooks } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { readDialogues } from "./ch2-city-data.js";
import { CH3_INTRO_SCENES, canAdvanceToChapterThree, advanceToChapterThree, chapterThreeProgress,
  completeChapterThreeScene, chapterThreeFreeTime, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { syncTokyoVisits, dueTokyoVisit, completeTokyoVisitAction, visitContacts } from "../core/tokyo-visits.js";

import { createChapterThreeWayfinding } from "./ch3-wayfinding.js";

const FILES = {
  ch3_main: ["ch3_opening", "ch3_individuality_doubt", "ch3_tokyo_shop_gap", "ch3_abyss_recovery",
    "ch3_naru_contact_before_tournament", "ch3_naru_work", "ch3_strategy", "ch3_tournament_eve"],
  ch3_double_apple: ["ch3_mukai_arrival", "ch3_double_apple_incident", "ch3_rest_before_recovery",
    "ch3_daily_cup_1", "ch3_taste_return"],
  ch3_mukai: ["ch3_mukai_intro"],
  ch3_rivals: ["ch3_kuze_first", "ch3_kuze_advice", "ch3_steve_low_heat"],
  ch3_volk: ["ch3_volk_first"],
};

let session = null;
const current = owner => session === owner && owner.active && owner.state === state;
const test = name => `ch3-intro-${name}`;

function button(owner, text, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
    dataset: { test: test(name) }, onclick: () => perform(owner, action) });
}

async function perform(owner, action) {
  if (!current(owner) || owner.busy) return;
  owner.busy = true;
  try { await action(); }
  catch (error) {
    if (current(owner)) { console.error("[ch3 intro]", error); renderError(owner); }
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
    const choice = await modal({ title: "東京編 MENU", body: "読み終えた場面から再開できます。", options: [
      { label: "セーブ", value: "save", test: test("save") },
      { label: "ロード", value: "load", test: test("load") },
      { label: "タイトルへ戻る", value: "title", test: test("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!current(owner)) return;
    if (choice === "save") await saveFlow();
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

function hud(owner, visible = false) {
  layers.hud.replaceChildren(...(visible ? [el("div.ch2-tournament-vn-menu", [menuButton(owner)])] : []));
  layers.hud.classList.toggle("show", visible);
}

function card(owner, name, title, description, actions = [], note = "", sceneId = "") {
  hud(owner);
  showScreen("ch3-intro", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第三章 ／ 嘘つきたちの夜" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    sceneId ? createChapterThreeWayfinding(state, CH3_INTRO_SCENES, sceneId) : null,
    note ? el("p.ch2-contest-note", { text: note }) : null,
    el("div.ch2-contest-actions", [...actions, ...(["scene", "free", "ready"].includes(name) ? [
      button(owner, "LIME・恋人との連絡", "lime", async () => {
        const social = await import("./ch3-social.js");
        if (!current(owner)) return;
        const controller = owner.controller = new AbortController();
        try { await social.openTokyoLime({ signal: controller.signal }); }
        finally { if (owner.controller === controller) owner.controller = null; }
        if (current(owner)) await renderStage(owner);
      }),
    ] : [])]),
  ]));
}

/** 必要な四ファイルをすべて確認してから DB に公開する。 */
async function loadIntroDialogues() {
  const groups = await Promise.all(Object.entries(FILES).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
  for (const [ids, dialogues] of groups) {
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

// VNの名乗りと初登場カットインは読了前に書かれる。未完時はこの場面で名乗る人物の
// identityだけ戻し、選択・好感度など別の成果には触れない。
function meetingCheckpoint(dialogue) {
  const metIds = new Set(), introIds = new Set();
  const collect = lines => {
    for (const line of lines || []) {
      const id = /^_met_(.+)$/.exec(line.flag || "")?.[1];
      if (line.type === "set_flag" && id) { metIds.add(id); introIds.add(id); }
      if (typeof line.speaker === "string" && line.speaker) introIds.add(line.speaker);
      if (typeof line.portrait === "string" && line.portrait) introIds.add(line.portrait);
      if (line.type === "intro" && line.char_id) introIds.add(line.char_id);
    }
  };
  collect(dialogue.lines);
  for (const lines of Object.values(dialogue.branches || {})) collect(lines);
  const metNames = [...metIds], introNames = [...introIds];
  const trackedFlag = key => metNames.some(id => key === `_met_${id}`)
    || introNames.some(id => key === `_intro_${id}` || key.startsWith(`_intro_${id}_`));
  const met = Object.fromEntries([...metIds].filter(id => Object.hasOwn(state.met, id)).map(id => [id, state.met[id]]));
  const flags = Object.fromEntries(Object.entries(state.flags).filter(([key]) => trackedFlag(key)));
  return () => {
    for (const id of metIds) {
      if (Object.hasOwn(met, id)) state.met[id] = met[id];
      else delete state.met[id];
    }
    for (const key of Object.keys(state.flags)) if (trackedFlag(key)) delete state.flags[key];
    Object.assign(state.flags, flags);
  };
}

export function beginChapterThree() {
  if (!canAdvanceToChapterThree(state)) return false;
  return openChapter(true);
}

export function resumeChapterThree() {
  if (state?.chapter !== 3) return false;
  if (state.flags?._ch3_tournament_won || state.flags?._ch3_aftermath || state.flags?._ch3_cleared) {
    import("./ch3-aftermath.js").then(module => module.runChapterThreeAftermath());
    return true;
  }
  if (state.flags?._ch3_tournament && chapterThreeProgress(state).stage === CH3_INTRO_SCENES.length) {
    import("./ch3-tournament.js").then(module => module.runChapterThreeTournament());
    return true;
  }
  return openChapter(false);
}

async function openChapter(advance) {
  if (session) { session.active = false; session.controller?.abort(); session.rollbackMeeting?.(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null, rollbackMeeting: null };
  document.body.classList.remove("ch2-city", "ch2-main", "ch2-tournament");
  document.body.classList.add("ch3-intro");
  hud(owner);
  showScreen("ch3-loading", el("main.ch2-contest", [
    el("h1", { text: "第三章・嘘つきたちの夜" }),
    el("p", { role: "status", text: "東京の場面を準備しています…" }),
  ]));
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); owner.rollbackMeeting?.(); }, { once: true });
  await perform(owner, async () => {
    // 台本不足のまま第2章のクリアセーブを進めない。
    await loadIntroDialogues();
    if (!current(owner)) return;
    if (advance) {
      if (!advanceToChapterThree(state)) return;
      stopBgm();
      save();
    }
    if (!current(owner)) return;
    playBgm("tonari");
    const progress = chapterThreeProgress(state);
    if (!progress.titleSeen) {
      await setBg(bgUrl("bg_street_day"), { instant: true });
      if (!current(owner)) return;
      await chapterTitle({ no: "第三章", name: "嘘つきたちの夜", read: "SMOKE AND MIRRORS",
        sub: "HAZE: NATIONAL TOKYO 編" });
      if (!current(owner)) return;
      progress.titleSeen = true;
      save();
    }
    await renderStage(owner);
  });
}

async function readScene(owner, scene) {
  if (!current(owner)) return false;
  const source = DB.dialogues[scene.id];
  if (!source) throw new Error(`台本がありません: ${scene.id}`);
  // 旧台本に仮置きされた tonari 等の metadata.bg は、東京の場面へ持ち込まない。
  const dialogue = { ...source, metadata: { ...source.metadata, bg: "" } };
  const restoreMeeting = meetingCheckpoint(dialogue);
  const background = bgUrl(scene.bg);
  await setBg(background, { instant: true });
  if (!current(owner)) return false;
  showScreen("none", null);
  // 名乗りの制御行などは読了時のcheckpointまで未確定。会話中の保存を避ける。
  hud(owner);
  const controller = new AbortController();
  owner.controller = controller;
  const startStage = state.flags?._ch3_intro?.stage;
  let finished = false, restored = false;
  const rollbackMeeting = () => {
    if (restored || finished || owner.state !== state || state.flags?._ch3_intro?.stage !== startStage) return;
    restoreMeeting();
    restored = true;
  };
  owner.rollbackMeeting = rollbackMeeting;
  let strategyChoice = null;
  const previousOnChoice = hooks.onChoice;
  const choiceHook = scene.id === "ch3_strategy" ? (...args) => {
    previousOnChoice?.(...args);
    if (args[0] === "ch3_strategy" && args[1] === "ch3_strategy_choice") strategyChoice = args[2];
  } : null;
  if (choiceHook) hooks.onChoice = choiceHook;
  try {
    const result = await play(dialogue, { signal: controller.signal });
    finished = current(owner) && !!result && !result.cancelled;
    if (finished && strategyChoice) state.flags._ch3_strategy = strategyChoice;
    return finished;
  } finally {
    if (choiceHook && hooks.onChoice === choiceHook) hooks.onChoice = previousOnChoice;
    if (owner.controller === controller) owner.controller = null;
    rollbackMeeting();
    if (owner.rollbackMeeting === rollbackMeeting) owner.rollbackMeeting = null;
  }
}

async function renderStage(owner) {
  if (!current(owner)) return;
  syncTokyoVisits(state);
  const progress = chapterThreeProgress(state);
  const scene = CH3_INTRO_SCENES[progress.stage];
  const free = chapterThreeFreeTime(state);
  if (free) { await renderFreeTime(owner, free); return; }
  if (!scene) {
    card(owner, "ready", "全国大会の朝", "久世、スティーブ、ヴォルクと同じ舞台へ。手順と、昨日決めた一台を確かめる。", [
      button(owner, "HAZE: NATIONAL TOKYOへ", "tournament", async () => {
        await (await import("./ch3-tournament.js")).runChapterThreeTournament();
      }, true),
      button(owner, "ここまでをセーブ", "complete-save", () => saveFlow()),
    ], "四人一斉に制作し、客席への提供と二度の調整まで競います。");
    return;
  }
  const background = bgUrl(scene.bg);
  await setBg(background, { instant: true });
  if (!current(owner)) return;
  card(owner, "scene", `DAY ${scene.day}・${scene.label}`, `${scene.location}へ向かう。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readScene(owner, scene)) return;
      if (!completeChapterThreeScene(state, scene.id)) return;
      save();
      await renderStage(owner);
    }, true),
  ], scene.day === 11 ? "煙幕を初めて訪ねた日から、数日が過ぎた。" : "", scene.id);
}

async function renderFreeTime(owner, window) {
  const social = await import("./ch3-social.js");
  const definitions = await social.loadTokyoSocial();
  if (!current(owner)) return;
  const plan = dueTokyoVisit(state, window);
  const id = plan?.characterId;
  const eligible = id && visitContacts(state, definitions).includes(id)
    && (!plan.met || !state.flags._story_shuraba_unresolved);
  const name = id ? displayName(id, state, { context: "private" }) : "";
  await setBg(bgUrl(window.slot ? "bg_street_night" : "bg_street_day"), { instant: true });
  if (!current(owner)) return;
  card(owner, "free", `DAY ${window.day - state.flags._ch3_intro.startDay + 1}・${window.slot ? "夜" : "昼"}の約束`,
    eligible ? `${name}と${plan.met ? "東京の街を散歩する" : "東京駅で合流する"}時間になった。`
      : "この時間は静かに過ごそう。会えなくても、二人の関係は変わらない。", [
    ...(eligible ? [button(owner, plan.met ? "二人で散歩する" : "東京駅へ迎えに行く", "visit", async () => {
      const kind = plan.met ? "date" : "meetup";
      if (dueTokyoVisit(state, window)?.id !== plan.id) return;
      if (!await readScene(owner, { id: `ch3_visit_${id}_${kind}`, bg: window.slot ? "bg_street_night" : "bg_street_day" })) return;
      if (!completeTokyoVisitAction(state, definitions, plan.id, window)) return;
      completeChapterThreeFreeTime(state, window.id);
      save();
      await renderStage(owner);
    }, true)] : []),
    button(owner, "この時間は休む", "visit-rest", async () => {
      if (!completeChapterThreeFreeTime(state, window.id)) return;
      save();
      await renderStage(owner);
    }),
  ], "合流と散歩は、それぞれ一回の自由時間を使います。", "");
}

function renderError(owner) {
  hud(owner);
  card(owner, "error", "東京編を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => state.chapter === 3 ? resumeChapterThree() : beginChapterThree(), true),
  ]);
}
