// 第3章・東京到着から全国大会前夜までを、場面単位で保存する。
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal, withScenePreparation, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";
import { play, hooks } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { shinkansenRide } from "../core/scene-motions.js";
import { readDialogues } from "./ch2-city-data.js";
import { onDialogueEnter } from "../daily/romance.js";
import { questionVisitDue, playQuestionVisit, finaleAtVisit, playFinale, recordRomanceChoice, bondCondition } from "../daily/bonds.js";
import { CH3_CONFESSION_IDS, confessionAnswer } from "./ch3-romance-entry.js";
import { MUKAI_DELIVERY_STEPS, runMukaiDeliveryWork } from "./ch3-deliveries.js";
import { chapterThreeScenes, canAdvanceToChapterThree, advanceToChapterThree, chapterThreeProgress,
  completeChapterThreeScene, chapterThreeFreeTime, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { syncTokyoVisits, dueTokyoVisit, completeTokyoVisitAction, visitContacts } from "../core/tokyo-visits.js";

import { createChapterThreeWayfinding } from "./ch3-wayfinding.js";
import { availableChapterThreeTrials } from "./ch3-trial-progress.js";
import { openShop } from "../daily/shop.js";
import { canReflect, reflectAt } from "../daily/reflection.js";
import { chapterThreeGymAvailability, visitChapterThreeGym, restChapterThreeFreeTime } from "./ch3-activities.js";
import { chapterThreeOutings, visitChapterThreeOuting } from "./ch3-outings.js";
import { CH3_STORY_DIALOGUE_FILES, EVENING_WINDOW, loadStoryRoutes, availableOptionalScenes, commitOptionalRead,
  selectChapterThreeEvening, eveningRecord } from "./ch3-story-wiring.js";

const FILES = {
  ch3_prologue: ["ch3_childhood_opening", "ch3_kuze_research", "ch3_train_arrival"],
  ch3_main: ["ch3_opening", "ch3_registration", "ch3_individuality_doubt", "ch3_tokyo_shop_gap", "ch3_abyss_recovery",
    "ch3_naru_contact_before_tournament", "ch3_naru_work", "ch3_strategy", "ch3_tournament_eve"],
  ch3_double_apple: ["ch3_mukai_arrival", "ch3_double_apple_incident", "ch3_rest_before_recovery",
    "ch3_daily_cup_1", "ch3_work_without_taste", "ch3_taste_return"],
  ch3_mukai: ["ch3_mukai_intro"],
  ch3_deliveries: MUKAI_DELIVERY_STEPS.filter(step => step.id !== "ch3_mukai_intro").map(step => step.id),
  ch3_rivals: ["ch3_kuze_first", "ch3_kuze_mukai_visit", "ch3_kuze_advice", "ch3_steve_low_heat"],
  ch3_volk: ["ch3_volk_first"],
};
// 任意8場面・前夜デート・前夜の修羅場未遂（#1176 GAP 3-B）。既存ファイルの配列へ足し、新しいファイルはそのまま加える。
for (const [file, ids] of Object.entries(CH3_STORY_DIALOGUE_FILES)) FILES[file] = [...(FILES[file] || []), ...ids];

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
      { label: "設定", value: "config", test: test("config") },
      { label: "用語集", value: "glossary", test: test("glossary") },
      { label: "大会の規則", value: "rules", test: test("rules") },
      { label: "タイトルへ戻る", value: "title", test: test("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!current(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "config") await (await import("../scenes/title.js")).openConfig();
    if (choice === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
    if (choice === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
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
    sceneId ? createChapterThreeWayfinding(state, chapterThreeScenes(state), sceneId) : null,
    note ? el("p.ch2-contest-note", { text: note }) : null,
    el("div.ch2-contest-actions", [...actions,
      ...(["free", "ready"].includes(name) ? [button(owner, name === "free" && freeTimeChoices(state).length
        ? "東京の地図で行き先を選ぶ" : "東京の地図", "map", () => openTokyoMap(owner), name === "free")] : []),
      ...(["scene", "free", "ready"].includes(name) ? [
      button(owner, "東京の店で葉を買う", "shop", async () => {
        await openShop({ branch: "tokyo" });
        if (current(owner)) await renderStage(owner);
      }),
      button(owner, "LIME・地元との連絡", "lime", async () => {
        const social = await withLoadingNotice(import("./ch3-social.js"), loadingNotice("LIMEを準備しています…"));
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
  await loadStoryRoutes();
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

export async function resumeChapterThree() {
  if (state?.chapter !== 3) return false;
  if (state.flags?._ch3_tournament_won || state.flags?._ch3_aftermath || state.flags?._ch3_cleared) {
    await (await import("./ch3-aftermath.js")).runChapterThreeAftermath();
    return true;
  }
  if (state.flags?._ch3_tournament && chapterThreeProgress(state).stage === chapterThreeScenes(state).length) {
    await (await import("./ch3-tournament.js")).runChapterThreeTournament();
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
    const progress = chapterThreeProgress(state);
    if (progress.prologueStep !== undefined && progress.prologueStep < 4) {
      await renderPrologue(owner);
      return;
    }
    playBgm("tonari");
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

async function readPrologue(owner, id, bg, ride = null) {
  if (ride) await ride();
  else await setBg(bg ? bgUrl(bg) : null, { instant: true });
  if (!current(owner)) return false;
  showScreen("none", null);
  hud(owner);
  const controller = owner.controller = new AbortController();
  try {
    const result = await play(DB.dialogues[id], { signal: controller.signal });
    return current(owner) && !!result && !result.cancelled;
  } finally {
    if (owner.controller === controller) owner.controller = null;
  }
}

async function renderPrologue(owner) {
  if (!current(owner)) return;
  const progress = chapterThreeProgress(state);
  if (progress.prologueStep === 0) {
    if (!await readPrologue(owner, "ch3_childhood_opening", null)) return;
    progress.prologueStep = 1;
    save();
  }
  if (progress.prologueStep === 1) {
    if (!await readPrologue(owner, "ch3_kuze_research", "bg_ch3_kuze_video")) return;
    progress.prologueStep = 2;
    save();
  }
  if (progress.prologueStep === 2) {
    await chapterTitle({ no: "第三章", name: "嘘つきたちの夜", read: "SMOKE AND MIRRORS",
      sub: "HAZE: NATIONAL TOKYO 編" });
    if (!current(owner)) return;
    progress.titleSeen = true;
    progress.prologueStep = 3;
    save();
  }
  if (progress.prologueStep === 3) {
    playBgm("tonari");
    // 地元→東京の往路。車窓が覆っている間に新幹線到着時の背景へ替える（#1059）。
    const ride = () => shinkansenRide(async () => { await setBg(bgUrl("bg_ch3_train_arrival"), { instant: true }); },
      { from: "home", to: "tokyo" });
    if (!await readPrologue(owner, "ch3_train_arrival", "bg_ch3_train_arrival", ride)) return;
    progress.prologueStep = 4;
    save();
  }
  await renderStage(owner);
}

async function readScene(owner, scene) {
  if (!current(owner)) return false;
  const source = DB.dialogues[scene.id];
  if (!source) throw new Error(`台本がありません: ${scene.id}`);
  // 旧台本に仮置きされた tonari 等の metadata.bg は、東京の場面へ持ち込まない。
  const dialogue = { ...source, metadata: { ...source.metadata, bg: "" } };
  const restoreMeeting = meetingCheckpoint(dialogue);
  const background = bgUrl(scene.bg);
  // 行き先を決めた時点で前のカードを外し、背景待ちを同じ自由時間と誤認させない。
  showScreen("none", null);
  hud(owner);
  await withScenePreparation(setBg(background, { instant: true }));
  if (!current(owner)) return false;
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
    finished = current(owner) && !controller.signal.aborted && !!result && !result.cancelled;
    if (finished && strategyChoice) state.flags._ch3_strategy = strategyChoice;
    // 告白の返事（#1930）。第3章から読み込んだ保存では hooks.onEnter が無いことがあるため、読了後に入った返事で確定する。
    if (finished) for (const id of CH3_CONFESSION_IDS) {
      const answer = confessionAnswer(result.visited, id);
      if (answer) onDialogueEnter(answer, DB.dialogues[answer]);
    }
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
  const scene = chapterThreeScenes(state)[progress.stage];
  const free = chapterThreeFreeTime(state);
  if (free) { await renderFreeTime(owner, free); return; }
  if (!scene) {
    // 前夜の自由時間を通らなかった夜（約束がない・休んだ）は、ここで一度だけ「過ごさなかった」と確定する。
    if (!state.flags._ch3_evening && !await settleEveningAtReady(owner)) return;
    if (!current(owner)) return;
    card(owner, "ready", "全国大会の朝", "久世、スティーブ、ヴォルクと同じ舞台へ。手順と、昨日決めた一台を確かめる。", [
      button(owner, "HAZE: NATIONAL TOKYOへ", "tournament", async () => {
        const mod = await withLoadingNotice(import("./ch3-tournament.js"), loadingNotice("全国大会を準備しています…"));
        await mod.runChapterThreeTournament();
      }, true),
      button(owner, "ここまでをセーブ", "complete-save", () => saveFlow()),
    ], "四人一斉に制作し、客席への提供と二度の調整まで競います。");
    return;
  }
  if (scene.id === "ch3_opening" && state.flags._ch3_opening_read) {
    await withScenePreparation(setBg(bgUrl("bg_tournament_stage"), { instant: true }));
    if (!current(owner)) return;
    card(owner, "scene", "DAY 1・全国大会の参加登録", "東京駅から会場へ。受付で出場手続きを済ませ、競技規則を受け取る。", [
      button(owner, state.flags._ch3_rules_read ? "mukaiへ向かう"
        : state.flags._ch3_registration_read ? "競技規則を確認する" : "参加登録をする", "continue", async () => {
        if (!state.flags._ch3_registration_read) {
          if (!await readScene(owner, { id: "ch3_registration", bg: "bg_tournament_stage" })) return;
          state.flags._ch3_registration_read = true;
          save();
        }
        if (!state.flags._ch3_rules_read) {
          await (await import("../scenes/rule-sheet.js")).openRuleSheet();
          if (!current(owner)) return;
          state.flags._ch3_rules_read = true;
          save();
        }
        if (!completeChapterThreeScene(state, "ch3_opening")) return;
        save();
        await renderStage(owner);
      }, true),
    ], "受付で受け取った規則は、あとからMENUでも読み返せる。", "ch3_registration");
    return;
  }
  const background = bgUrl(scene.bg);
  await withScenePreparation(setBg(background, { instant: true }));
  if (!current(owner)) return;
  card(owner, "scene", `DAY ${scene.day}・${scene.label}`, `${scene.location}へ向かう。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (scene.id === "ch3_mukai_intro") {
        if (!await runMukaiDeliveryWork(owner.state, { read: step => readScene(owner, step), save,
          isCurrent: () => current(owner) })) {
          if (current(owner)) await renderStage(owner);
          return;
        }
      } else if (!await readScene(owner, scene)) return;
      if (scene.id === "ch3_opening") {
        state.flags._ch3_opening_read = true;
        save();
        await renderStage(owner);
        return;
      }
      if (!completeChapterThreeScene(state, scene.id)) return;
      save();
      await renderStage(owner);
    }, true),
    ...trialActions(owner),
    ...bondActions(owner),
    ...await optionalActions(owner),
  ], scene.id === "ch3_kuze_advice" ? "煙幕を初めて訪ねた日から、数日が過ぎた。" : "", scene.id);
}

/**
 * 任意場面の入口は、毎日必ず出る場面カードに置く。自由時間のカードは約束かジム会員の時だけ開く
 * ため、そこに置くと任意場面の多くに届かない。読んでも自由時間ウィンドウは消費しない（仮置き。
 * 差し替えは ch3-story-wiring.js の commitOptionalRead だけ）。
 */
async function optionalActions(owner) {
  const scenes = availableOptionalScenes(await loadStoryRoutes(), state);
  return scenes.length ? [button(owner, `寄り道をする（${scenes.length}）`, "optional-open", () => renderOptional(owner))] : [];
}

/**
 * 回復後の試作（#1654）。久世・スティーブの場面を読んだあと、大会前の場面カードに一度ずつ出す。
 * 寄り道と同じく本筋の予定は進めない。完了と講評の既読は ch3-trials.js が保存する。
 */
function trialActions(owner) {
  const trials = availableChapterThreeTrials(state);
  return trials.length ? [button(owner, `mukaiで試作する（${trials.length}）`, "trial-open", () => renderTrials(owner))] : [];
}

/**
 * ましろの♥3の質問と締めくくり（#2022）。条件は第1章と同じ daily/bonds.js（質問は練習の後・♥3、締めくくりは
 * 寄り道の全段階と質問の後・♥5）。寄り道と同じく本筋の予定は進めず、既読・回答・贈り物は bonds.js が保存する。
 */
function bondActions(owner) {
  const kind = questionVisitDue("mashiro") ? "question" : finaleAtVisit("mashiro") ? "finale" : null;
  return kind ? [button(owner, kind === "question" ? "ましろちゃんと話す（mukai）" : "ましろちゃんに呼ばれる（mukai）",
    `bond-${kind}`, () => readBond(owner, kind))] : [];
}

async function readBond(owner, kind) {
  if (!current(owner)) return;
  const background = bgUrl("bg_mukai_shop");
  showScreen("none", null);
  hud(owner);
  await withScenePreparation(setBg(background, { instant: true }));
  if (!current(owner)) return;
  const controller = owner.controller = new AbortController();
  // 第3章から読み込んだ保存でも、恋愛／友情の実回答と lover・romance_open の分岐を読めるようにする。
  const previousChoice = hooks.onChoice, previousCondition = hooks.evalCondition;
  const choiceHook = (...args) => { previousChoice ? previousChoice(...args) : recordRomanceChoice(args[5], args[4]); };
  const conditionHook = line => previousCondition?.(line) ?? bondCondition(line);
  hooks.onChoice = choiceHook;
  hooks.evalCondition = conditionHook;
  try {
    const options = { bg: background, signal: controller.signal };
    if (kind === "question") await playQuestionVisit("mashiro", options);
    else if (finaleAtVisit("mashiro")) await playFinale("mashiro", options);
  } finally {
    if (hooks.onChoice === choiceHook) hooks.onChoice = previousChoice;
    if (hooks.evalCondition === conditionHook) hooks.evalCondition = previousCondition;
    if (owner.controller === controller) owner.controller = null;
  }
  if (current(owner)) await renderStage(owner);
}

async function renderTrials(owner) {
  if (!current(owner)) return;
  const trials = availableChapterThreeTrials(state);
  if (!trials.length) { await renderStage(owner); return; }
  await withScenePreparation(setBg(bgUrl("bg_mukai_shop"), { instant: true }));
  if (!current(owner)) return;
  card(owner, "trial", "mukaiの作業台", "聞いたことを、自分の一台で確かめる。作っても、予定は進まない。", [
    ...trials.map(trial => button(owner, trial.label, `trial-${trial.id}`, () => runTrial(owner, trial.id))),
    button(owner, "戻る", "trial-back", () => renderStage(owner)),
  ], "ましろちゃんと客席の反応まで見て、一度ずつ試せる。");
}

async function runTrial(owner, id) {
  const trials = await withLoadingNotice(import("./ch3-trials.js"), loadingNotice("作業台を準備しています…"));
  if (!current(owner)) return;
  const controller = owner.controller = new AbortController();
  try { await trials.runChapterThreeTrial(id, { signal: controller.signal, isCurrent: () => current(owner) }); }
  finally { if (owner.controller === controller) owner.controller = null; }
  if (current(owner)) await renderStage(owner);
}

async function renderOptional(owner) {
  if (!current(owner)) return;
  const scenes = availableOptionalScenes(await loadStoryRoutes(), state);
  if (!scenes.length) { await renderStage(owner); return; }
  card(owner, "optional", "寄り道", "本筋の合間に、立ち寄れる場面がある。読んでも、予定は進まない。", [
    ...scenes.map(scene => button(owner, `${scene.label}（${scene.location}）`, `optional-${scene.id}`,
      () => readOptional(owner, scene.id))),
    button(owner, "戻る", "optional-back", () => renderStage(owner)),
  ], "読んだ場面は、あとから読み返せません。");
}

async function readOptional(owner, id) {
  // 押した時点で条件を引き直す。古い画面・二重クリックで再読や条件外の場面を読まない。
  const scene = availableOptionalScenes(await loadStoryRoutes(), state).find(item => item.id === id);
  if (scene && !await readScene(owner, scene)) return;
  if (scene) {
    commitOptionalRead(state, id);
    save();
  }
  await renderStage(owner);
}

/** 前夜の再生と確定。ウィンドウを通る場合は訪問の完了・自由時間の消費も同じ一回で行う。 */
async function playEvening(owner, result, { plan = null, window = null, definitions = null } = {}) {
  for (const id of result.scenes) {
    if (!await readScene(owner, { id, bg: "bg_street_night" })) return false;
  }
  // 前夜デートは訪問デートと同じ一回の行動。ch3_visit_*_date は再生せず、完了だけを訪問の記録へ渡す。
  if (result.kind === "date" && !completeTokyoVisitAction(state, definitions, plan.id, window)) return false;
  if (window && !completeChapterThreeFreeTime(state, window.id)) return false;
  state.flags._ch3_evening = eveningRecord(result);
  save();
  return true;
}

async function settleEveningAtReady(owner) {
  const [routes, social] = await Promise.all([loadStoryRoutes(), import("./ch3-social.js")]);
  const definitions = await social.loadTokyoSocial();
  if (!current(owner)) return false;
  const result = selectChapterThreeEvening(routes, state, definitions);
  if (result.kind !== "rest") return playEvening(owner, result, { definitions });
  state.flags._ch3_evening = eveningRecord(result);
  save();
  return true;
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
  // 前夜に会う約束がある時は、訪問デート（ch3_visit_*_date）の代わりに前夜の場面を一度だけ再生する。
  const routes = await loadStoryRoutes();
  const evening = eligible && plan.met && window.id === EVENING_WINDOW
    ? selectChapterThreeEvening(routes, state, definitions, window) : null;
  const eveningNow = evening?.kind === "rest" ? null : evening;
  const gym = chapterThreeGymAvailability(state, window.id);
  await setBg(bgUrl(window.slot ? "bg_tokyo_map_night" : "bg_tokyo_map_day"), { instant: true });
  if (!current(owner)) return;
  card(owner, "free", `DAY ${window.day - state.flags._ch3_intro.startDay + 1}・${window.slot ? "夜" : "昼"}${plan ? "の約束" : "の自由時間"}`,
    eveningNow ? eveningNow.kind === "date" ? `大会前夜。${name}と過ごす時間になった。`
      : "大会前夜。誰と過ごすか、決めきれないまま夜になった。"
      : eligible ? `${name}と${plan.met ? "東京の街を散歩する" : "東京駅で合流する"}時間になった。`
      : plan ? "この時間は静かに過ごそう。会えなくても、二人の関係は変わらない。"
        : "次の予定まで、少し時間がある。地図で行き先を選ぶか、休んで過ごそう。", [
    ...(eligible ? [button(owner, eveningNow ? "前夜を過ごす" : plan.met ? "二人で散歩する" : "東京駅へ迎えに行く", "visit", async () => {
      const kind = plan.met ? "date" : "meetup";
      if (dueTokyoVisit(state, window)?.id !== plan.id) return;
      if (eveningNow) {
        const result = selectChapterThreeEvening(routes, state, definitions, window);
        if (result.kind !== "rest" && !await playEvening(owner, result, { plan, window, definitions })) return;
        await renderStage(owner);
        return;
      }
      if (!await readScene(owner, { id: `ch3_visit_${id}_${kind}`, bg: window.slot ? "bg_street_night" : "bg_street_day" })) return;
      if (!completeTokyoVisitAction(state, definitions, plan.id, window)) return;
      completeChapterThreeFreeTime(state, window.id);
      save();
      await renderStage(owner);
    }, true)] : []),
    ...(gym.ok ? [button(owner, "CHOI-ZAPで体を動かす", "gym", async () => {
      await trainInTokyo(owner, window.id);
      if (current(owner)) await renderStage(owner);
    }, true)] : []),
    button(owner, "この時間は休む", "visit-rest", async () => {
      if (!restChapterThreeFreeTime(window.id, { isCurrent: () => current(owner) })) return;
      await renderStage(owner);
    }),
  ], eveningNow ? "前夜の過ごし方は、一回の自由時間を使います。"
    : plan ? "合流と散歩は、それぞれ一回の自由時間を使います。"
    : freeTimeHint(window), "");
}

/** 「今日は誰に何を聞きに行くか」「大会までに何を試すか」を、行ける行き先の理由から短く示す。 */
function freeTimeHint(window) {
  const outings = chapterThreeOutings(state, window.id).filter(item => !item.repeat);
  const trials = availableChapterThreeTrials(state);
  const parts = [
    ...outings.map(item => `${item.label.replace(/\s*に(顔を出す|寄る)$/, "")}：${item.reasonText}`),
    ...(trials.length ? [`mukaiの作業台：${trials.map(trial => trial.label).join("、")}`] : []),
  ];
  return parts.length ? `今日の候補 ― ${parts.slice(0, 2).join(" ／ ")}`
    : "mukaiの手伝いや公園の散歩も、一回の自由時間を使います。";
}

/** 今の自由時間に地図から選べる行き先。試作は予定を進めないので、自由時間を消費しない。 */
function freeTimeChoices(value) {
  const window = chapterThreeFreeTime(value);
  if (!window) return [];
  return [
    ...chapterThreeOutings(value, window.id),
    // 心得の盤: 路地裏の神社で内省して火種を灯す（時間を使わない。SPEC 2.8・#1788）
    ...(canReflect(value) ? [{ id: "reflect", place: "shrine", label: "路地裏の神社で振り返る", reasonText: "学んだことを火にして、心得の盤に灯す", ok: true, consumes: false, reflect: true }] : []),
    ...availableChapterThreeTrials(value).map(trial => ({ id: `trial-${trial.id}`, trialId: trial.id, place: "mukai",
      label: `作業台で${trial.label}`, reasonText: "聞いたことを、自分の一台で確かめる", ok: true, consumes: false })),
  ];
}

async function openTokyoMap(owner) {
  const { openChapterThreeMap } = await withLoadingNotice(import("./ch3-map.js"), loadingNotice("東京の地図を準備しています…"));
  if (!current(owner)) return;
  const window = chapterThreeFreeTime(state);
  const actions = freeTimeChoices(state);
  const selection = await openChapterThreeMap(state, chapterThreeScenes(state), {
    freeTime: !!window, allowGym: !!window && chapterThreeGymAvailability(state, window.id).ok, actions,
  });
  if (!current(owner) || !selection || !window) return;
  if (selection === "gym") await trainInTokyo(owner, window.id);
  else {
    const action = actions.find(item => item.id === selection.action);
    if (action?.trialId) { await runTrial(owner, action.trialId); return; }
    if (action?.reflect) { await reflectAt("tokyo_shrine"); if (current(owner)) await renderStage(owner); return; }
    if (action) await goOuting(owner, window.id, action.id);
  }
  if (current(owner)) await renderStage(owner);
}

async function goOuting(owner, windowId, id) {
  if (!current(owner)) return false;
  showScreen("none", null);
  hud(owner);
  const controller = owner.controller = new AbortController();
  try { return await visitChapterThreeOuting(windowId, id, { signal: controller.signal, isCurrent: () => current(owner) }); }
  finally { if (owner.controller === controller) owner.controller = null; }
}

async function trainInTokyo(owner, windowId) {
  if (!current(owner) || !chapterThreeGymAvailability(state, windowId).ok) return false;
  showScreen("none", null);
  hud(owner);
  const controller = owner.controller = new AbortController();
  try { return await visitChapterThreeGym(windowId, { signal: controller.signal, isCurrent: () => current(owner) }); }
  finally { if (owner.controller === controller) owner.controller = null; }
}

function renderError(owner) {
  hud(owner);
  card(owner, "error", "東京編を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => state.chapter === 3 ? resumeChapterThree() : beginChapterThree(), true),
  ]);
}
