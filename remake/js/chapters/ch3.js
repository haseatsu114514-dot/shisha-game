// 第3章・東京導入。第2章の優勝後から久世との再訪までを、場面単位で保存する。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { readDialogues } from "./ch2-city-data.js";
import { CH3_INTRO_SCENES, canAdvanceToChapterThree, advanceToChapterThree, chapterThreeProgress,
  completeChapterThreeScene } from "./ch3-progress.js";

const FILES = {
  ch3_main: ["ch3_opening", "ch3_individuality_doubt", "ch3_tokyo_shop_gap", "ch3_abyss_recovery",
    "ch3_naru_contact_before_tournament", "ch3_naru_work"],
  ch3_double_apple: ["ch3_mukai_arrival", "ch3_double_apple_incident", "ch3_rest_before_recovery",
    "ch3_daily_cup_1", "ch3_taste_return"],
  ch3_mukai: ["ch3_mukai_intro"],
  ch3_rivals: ["ch3_kuze_first", "ch3_kuze_advice"],
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
    note ? el("p.ch2-contest-note", { text: note }) : null,
    el("div.ch2-contest-actions", actions),
  ]));
}

/** 必要な四ファイルをすべて確認してから DB に公開する。 */
async function loadIntroDialogues() {
  const groups = await Promise.all(Object.entries(FILES).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
  for (const [ids, dialogues] of groups) {
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

export function beginChapterThree() {
  if (!canAdvanceToChapterThree(state)) return false;
  return openChapter(true);
}

export function resumeChapterThree() {
  if (state?.chapter !== 3) return false;
  return openChapter(false);
}

async function openChapter(advance) {
  if (session) { session.active = false; session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null };
  document.body.classList.remove("ch2-city", "ch2-main", "ch2-tournament");
  document.body.classList.add("ch3-intro");
  hud(owner);
  showScreen("ch3-loading", el("main.ch2-contest", [
    el("h1", { text: "第三章・嘘つきたちの夜" }),
    el("p", { role: "status", text: "東京の場面を準備しています…" }),
  ]));
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); }, { once: true });
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
  const background = bgUrl(scene.bg);
  await setBg(background, { instant: true });
  if (!current(owner)) return false;
  showScreen("none", null);
  hud(owner, true);
  const controller = new AbortController();
  owner.controller = controller;
  const result = await play(dialogue, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  return current(owner) && !!result && !result.cancelled;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  const progress = chapterThreeProgress(state);
  const scene = CH3_INTRO_SCENES[progress.stage];
  if (!scene) {
    card(owner, "complete", "余白での約束", "久世は助言の答えを決めなかった。自分の一台を、もう一度確かめよう。", [
      button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
      button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
    ], "全国大会へ続く場面は、今後の更新で追加されます。");
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
  ], scene.day === 11 ? "余白を初めて訪ねた日から、数日が過ぎた。" : "", scene.id);
}

function renderError(owner) {
  hud(owner);
  card(owner, "error", "東京編を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "reload", () => state.chapter === 3 ? resumeChapterThree() : beginChapterThree(), true),
  ]);
}
