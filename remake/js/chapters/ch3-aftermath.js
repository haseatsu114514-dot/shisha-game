// 全国大会の勝利後。結果発表は大会ランナーが読了・保存し、ここでは再生しない。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { chapterDay } from "../core/chapter-clock.js";
import { layers, showScreen, setBg, modal, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";
import { playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "./ch2-city-data.js";
import { playChapterPreview } from "./chapter-preview.js";
import { shinkansenRide } from "../core/scene-motions.js";
import { CH3_AFTERMATH_SCENES, canRunChapterThreeAftermath, beginChapterThreeAftermath,
  chapterThreeAftermathProgress, completeChapterThreeAftermathScene } from "./ch3-aftermath-progress.js";

const IDS = CH3_AFTERMATH_SCENES.map(scene => scene.id);
const test = name => `ch3-aftermath-${name}`;
let session = null;
const live = owner => session === owner && owner.active && owner.state === state;

function button(owner, label, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text: label,
    dataset: { test: test(name) }, onclick: () => perform(owner, action) });
}

async function perform(owner, action) {
  if (!live(owner) || owner.busy) return false;
  owner.busy = true;
  try { await action(); return live(owner); }
  catch (error) {
    if (live(owner)) { console.error("[ch3 aftermath]", error); renderError(owner); }
    return false;
  } finally { owner.busy = false; }
}

async function openMenu(owner) {
  if (!live(owner) || owner.menuBusy) return;
  owner.menuBusy = true;
  try {
    const choice = await modal({ title: "第三章 MENU", body: "読み終えた場面から再開できます。", options: [
      { label: "セーブ", value: "save", test: test("save") },
      { label: "ロード", value: "load", test: test("load") },
      { label: "設定", value: "config", test: test("config") },
      { label: "用語集", value: "glossary", test: test("glossary") },
      { label: "タイトルへ戻る", value: "title", test: test("title") },
      { label: "閉じる", value: null, primary: true },
    ] });
    if (!live(owner)) return;
    if (choice === "save") await saveFlow();
    if (choice === "config") await (await import("../scenes/title.js")).openConfig();
    if (choice === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
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

function menuButton(owner) {
  return el("button.btn", { type: "button", text: "MENU", dataset: { test: test("menu") },
    onclick: () => openMenu(owner) });
}

function card(owner, name, title, description, actions = [], note = "", sceneId = "") {
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  showScreen("ch3-aftermath", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第三章 ／ 嘘つきたちの夜" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
    el("div.ch2-contest-actions", [...actions, ...(name !== "error" ? [
      button(owner, "LIME・恋人との連絡", "lime", async () => {
        const social = await import("./ch3-social.js");
        if (!live(owner)) return;
        const controller = owner.controller = new AbortController();
        try { await social.openTokyoLime({ signal: controller.signal }); }
        finally { if (owner.controller === controller) owner.controller = null; }
        if (live(owner)) await renderStage(owner);
      }),
    ] : [])]),
  ]));
}

/** 勝利確定済み保存から再開できる。敗北・審査途中では状態を一切変更しない。 */
export async function runChapterThreeAftermath() {
  if (!canRunChapterThreeAftermath(state)) return false;
  if (session) { session.active = false; session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null };
  document.body.classList.remove("ch2-city", "ch2-main", "ch2-tournament", "ch3-tournament");
  document.body.classList.add("ch3-intro", "ch3-aftermath");
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  showScreen("ch3-aftermath-loading", el("main.ch2-contest", [
    el("h1", { text: "第三章・大会のあと" }),
    el("p", { role: "status", text: "帰り道の場面を準備しています…" }),
  ]));
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); }, { once: true });
  return perform(owner, async () => {
    if (!state.flags._ch3_cleared) {
      // 欠損台本で後日談の日付やstageを進めない。全場面を揃えてから公開する。
      const dialogues = await readDialogues("ch3_main", IDS);
      if (!live(owner)) return;
      Object.assign(DB.dialogues, Object.fromEntries(IDS.map(id => [id, dialogues[id]])));
    }
    if (!live(owner)) return;
    if (!state.flags._ch3_aftermath) {
      beginChapterThreeAftermath(state);
      save();
    } else chapterThreeAftermathProgress(state);
    // 通し進行で勝利時から続く曲を、タイトルのLOADからも復元する。
    playBgm("bgm_aftermath");
    await renderStage(owner);
  });
}

async function readScene(owner, scene) {
  const source = DB.dialogues[scene.id];
  if (!source) throw new Error(`台本がありません: ${scene.id}`);
  if (scene.id === "ch3_home_customer") {
    // 東京→地元の復路。帰郷した夜の場面へ入る直前だけ新幹線の車窓を見せる（#1059）。
    await shinkansenRide(async () => { await setBg(scene.bg ? bgUrl(scene.bg) : null, { instant: true }); },
      { from: "tokyo", to: "home" });
  } else {
    await setBg(scene.bg ? bgUrl(scene.bg) : null, { instant: true });
  }
  if (!live(owner)) return false;
  showScreen("none", null);
  // 制御行とカットインは読了後のcheckpointまで未確定。会話中の保存は出さない。
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  const controller = new AbortController();
  owner.controller = controller;
  const result = await play({ ...source, metadata: { ...source.metadata, bg: "" } }, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  return live(owner) && !!result && !result.cancelled;
}

async function renderStage(owner) {
  if (!live(owner)) return;
  const progress = chapterThreeAftermathProgress(state);
  const scene = CH3_AFTERMATH_SCENES[progress.stage];
  if (!scene) {
    await setBg(bgUrl("bg_ageha_shop"), { instant: true });
    if (!live(owner)) return;
    // 第3章側の第4章への接続点はここ1か所（状態遷移は ch4-progress.js の advanceToChapterFour）。
    const next = button(owner, "第4章へ進む", "chapter-four", async () => {
      const mod = await withLoadingNotice(import("./ch4.js"), loadingNotice("第4章のドバイへ向かっています…"));
      await mod.beginChapterFour();
    }, true);
    const replay = button(owner, "次回予告をもう一度", "complete-preview", () => preview(false));
    // 外側の busy(false) は data-locked を見て disabled を再設定するため、両方を連動させる。
    const lock = (btn, locked) => { if (btn.dataset) btn.dataset.locked = String(locked); btn.disabled = locked; };
    lock(next, !state.flags._ch3_preview_seen);
    // 予告2（第3章末→第4章）。第1章と同じ挙動: 再生中は第4章ボタンを押せず、
    // 完走/明示スキップのときだけ既読を保存し、中断・別画面への遷移では何も残さない。
    const preview = async (first) => {
      const controller = new AbortController();
      // MutationObserver の無い環境（Node VM の単体テスト等）では監視なしで再生だけを試みる。
      let observer;
      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => { if (!next.isConnected) controller.abort(); });
        observer.observe(layers.screen, { childList: true });
      }
      lock(next, true); lock(replay, true);
      try {
        const result = await playChapterPreview("ch4", { signal: controller.signal });
        if (first && (result === "completed" || result === "skipped") && live(owner)) {
          state.flags._ch3_preview_seen = true;
          save();
        }
      } catch { /* 次回予告は任意演出。失敗しても完了画面はそのまま使える。 */ }
      finally {
        observer?.disconnect();
        lock(next, !state.flags._ch3_preview_seen); lock(replay, false);
        if (next.isConnected) {
          playBgm("bgm_aftermath");
          replay.focus();
        }
      }
    };
    card(owner, "complete", "第三章・完", "全国大会を終え、帰る場所にも新しい約束ができた。", [
      next,
      replay,
      button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
      button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
    ], "第四章・ドバイ編へ進めます。");
    if (!state.flags._ch3_preview_seen) void preview(true);
    return;
  }
  // 帰郷の夜(#1059)は、新幹線の車窓が覆うまで東京側の背景のままにし、tonariを先見せしない。
  const preBg = scene.id === "ch3_home_customer" ? "bg_mukai_shop" : scene.bg;
  await setBg(preBg ? bgUrl(preBg) : null, { instant: true });
  if (!live(owner)) return;
  card(owner, "scene", `DAY ${chapterDay(state)}・${scene.slot ? "夜" : "昼"} ／ ${scene.label}`,
    `${scene.location}で、次の話を聞く。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readScene(owner, scene)) return;
      if (!completeChapterThreeAftermathScene(state, scene.id)) return;
      save();
      await renderStage(owner);
    }, true),
  ], scene.dayAfterWin === 0 ? "全国大会の夜" : scene.dayAfterWin === 1 ? "全国大会の翌日" : "帰郷してから", scene.id);
}

function renderError(owner) {
  card(owner, "error", "第3章の後日談を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。", [
    button(owner, "もう一度読み込む", "retry", () => runChapterThreeAftermath(), true),
  ]);
}
