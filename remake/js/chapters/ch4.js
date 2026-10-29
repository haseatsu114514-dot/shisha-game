// 第4章・ドバイ。プロローグ→自由行動→前夜→大会→勝ち側の本線までを、場面単位で保存する。
// 状態遷移は ch4-progress.js、行き先の計算は ch4-map-model.js。ここは表示と再生だけを持つ。
import { DB, bgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play, hooks } from "../vn/engine.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { readDialogues } from "./ch2-city-data.js";
import { CH4_PROLOGUE, CH4_RESOLUTION, CH4_SCENE_BG, CH4_SCENE_FILES, CH4_TOURNAMENT_SCENES,
  canAdvanceToChapterFour, advanceToChapterFour, chapterFourProgress, completeChapterFourScene,
  endChapterFourDay, finishChapterFourEve, chapterFourMandatory, revealChapterFourSheikh,
  chapterFourTournamentOutcome, chapterFourAfterDefeat, recordChapterFourStrategy } from "./ch4-progress.js";
import { chapterFourMapModel } from "./ch4-map-model.js";
import { playChapterPreview } from "./chapter-preview.js";

let session = null;
const current = owner => session === owner && owner.active && owner.state === state;
const test = name => `ch4-${name}`;

function button(owner, text, name, action, primary = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text,
    dataset: { test: test(name) }, onclick: () => perform(owner, action) });
}

async function perform(owner, action) {
  if (!current(owner) || owner.busy) return;
  owner.busy = true;
  try { await action(); }
  catch (error) {
    if (current(owner)) { console.error("[ch4]", error); renderError(owner); }
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
    const choice = await modal({ title: "第四章 MENU", body: "読み終えた場面から再開できます。", options: [
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
  showScreen("ch4", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第四章 ／ 継承の煙" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
    el("div.ch2-contest-actions", actions),
  ]));
}

/** 必要な台本をすべて確認してから DB に公開する。欠けていれば状態を進めない。 */
async function loadDialogues() {
  const groups = await Promise.all(Object.entries(CH4_SCENE_FILES).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
  for (const [ids, dialogues] of groups) {
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

/** 第3章の完了カードからの入口。 */
export function beginChapterFour() {
  if (!canAdvanceToChapterFour(state)) return false;
  return openChapter(true);
}

export function resumeChapterFour() {
  if (state?.chapter !== 4) return false;
  return openChapter(false);
}

async function openChapter(advance) {
  if (session) { session.active = false; session.controller?.abort(); }
  const owner = session = { state, active: true, busy: false, menuBusy: false, controller: null };
  document.body.classList.remove("ch2-city", "ch2-main", "ch2-tournament", "ch3-intro", "ch3-aftermath", "ch3-tournament");
  document.body.classList.add("ch4-intro");
  hud();
  showScreen("ch4-loading", el("main.ch2-contest", [
    el("h1", { text: "第四章・継承の煙" }),
    el("p", { role: "status", text: "ドバイの場面を準備しています…" }),
  ]));
  window.addEventListener("pagehide", () => { owner.active = false; owner.controller?.abort(); }, { once: true });
  await perform(owner, async () => {
    // 台本不足のまま第3章のクリアセーブを進めない。
    await loadDialogues();
    if (!current(owner)) return;
    if (advance) {
      if (!advanceToChapterFour(state)) return;
      stopBgm();
      save();
    }
    if (!current(owner)) return;
    const progress = chapterFourProgress(state);
    playBgm("tonari"); // 仮置き: ドバイ専用BGMが無いので既存曲を流用（#1177 で差し替え）
    if (progress.part === "prologue" && !progress.titleSeen) {
      await setBg(bgUrl(CH4_SCENE_BG[CH4_PROLOGUE[0].id]), { instant: true });
      if (!current(owner)) return;
      await chapterTitle(CHAPTER_TITLE_ART.find(entry => entry.chapter === 4));
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
  // 台本の metadata.bg は持ち込まず、ch4-progress.js の対応表（仮置き）で背景を決める。
  const dialogue = { ...source, metadata: { ...source.metadata, bg: "" } };
  showScreen("none", null);
  hud();
  await setBg(bgUrl(CH4_SCENE_BG[id]), { instant: true });
  if (!current(owner)) return false;
  // 読了のcheckpointまで保存を出さない。会話中のMENUは置かない。
  const controller = new AbortController();
  owner.controller = controller;
  let strategyChoice = null;
  const previousOnChoice = hooks.onChoice;
  const choiceHook = id === "ch4_strategy" ? (...args) => {
    previousOnChoice?.(...args);
    if (args[0] === "ch4_strategy" && args[1] === "ch4_strategy_choice") strategyChoice = args[2];
  } : null;
  if (choiceHook) hooks.onChoice = choiceHook;
  try {
    const result = await play(dialogue, { signal: controller.signal });
    const finished = current(owner) && !controller.signal.aborted && !!result && !result.cancelled;
    if (finished && strategyChoice) recordChapterFourStrategy(state, strategyChoice);
    return finished;
  } finally {
    if (choiceHook && hooks.onChoice === choiceHook) hooks.onChoice = previousOnChoice;
    if (owner.controller === controller) owner.controller = null;
  }
}

/** 読了 → 確定 → 保存。確定できなければ（別partの場面など）保存せず false。 */
async function readAndCommit(owner, id) {
  if (!await readScene(owner, id)) return false;
  if (!completeChapterFourScene(state, id)) return false;
  save();
  return true;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  const progress = chapterFourProgress(state);
  if (progress.part === "prologue") return renderScene(owner, CH4_PROLOGUE[progress.stage], `DAY ${progress.day}`);
  if (progress.part === "free") return renderFree(owner);
  if (progress.part === "eve") return renderEve(owner);
  if (progress.part === "tournament") return renderTournament(owner);
  if (progress.part === "resolution") return renderScene(owner, CH4_RESOLUTION[progress.resolution], "");
  return renderComplete(owner);
}

async function renderScene(owner, scene, dayLabel) {
  await setBg(bgUrl(CH4_SCENE_BG[scene.id]), { instant: true });
  if (!current(owner)) return;
  card(owner, "scene", `${dayLabel ? `${dayLabel}・` : ""}${scene.label}`, `${scene.location}で、次の話を読む。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }, true),
  ], "", scene.id);
}

async function renderFree(owner) {
  const model = chapterFourMapModel(state);
  await setBg(bgUrl(model.background), { instant: true });
  if (!current(owner)) return;
  card(owner, "free", `DAY ${model.day}・自由行動`, `ドバイの街を歩く。大会まであと${model.daysLeft}日。`,
    model.destinations.map(destination => button(owner, destination.label, `go-${destination.id}`,
      () => visit(owner, destination.id), destination.kind === "end_day")),
    model.note);
}

/** 行き先の場面を順に再生してマップへ戻る。日が進むのは「その日を終える」だけ。 */
async function visit(owner, id) {
  const destination = chapterFourMapModel(state)?.destinations.find(item => item.id === id);
  if (!destination) return;
  for (const sceneId of destination.scenes) {
    if (!await readAndCommit(owner, sceneId)) return;
  }
  if (destination.kind === "end_day") {
    if (!endChapterFourDay(state)) return;
    save();
  }
  await renderStage(owner);
}

/** 前夜: 未読の必須場面を story_routes の順に強制消化する。繋ぎ場面があれば先に再生。 */
async function renderEve(owner) {
  const [next] = chapterFourMandatory(state);
  if (!next) {
    if (!finishChapterFourEve(state)) throw new Error("前夜を終えられません");
    save();
    await renderStage(owner);
    return;
  }
  await setBg(bgUrl(CH4_SCENE_BG[next.lead || next.id]), { instant: true });
  if (!current(owner)) return;
  card(owner, "eve", "DAY 4・前夜", "夜になった。大会の前に、済ませておくことが残っている。", [
    button(owner, "続きを読む", "continue", async () => {
      for (const id of [next.lead, next.id].filter(Boolean)) {
        if (!await readAndCommit(owner, id)) return;
      }
      await renderStage(owner);
    }, true),
  ], "", next.id);
}

async function renderTournament(owner) {
  const progress = chapterFourProgress(state);
  await setBg(bgUrl(CH4_SCENE_BG[CH4_TOURNAMENT_SCENES.start]), { instant: true });
  if (!current(owner)) return;
  card(owner, "tournament", "DAY 5・大会当日", "会場へ向かう。",
    [button(owner, "大会へ", "start", () => runTournament(owner), true)],
    progress.attempts ? "同じ大会に、もう一度挑む。" : "", CH4_TOURNAMENT_SCENES.start);
}

async function runTournament(owner) {
  const { start, win, loss } = CH4_TOURNAMENT_SCENES;
  if (!chapterFourProgress(state).read[start]) {
    // 読み始める時点でシェイクの正体を明かす（DRAFT §3）。
    revealChapterFourSheikh(state);
    if (!await readAndCommit(owner, start)) return;
  }
  // 骨格では台本どおり勝ち固定。実試合を接続するときは chapterFourTournamentOutcome の中身を差し替える。
  if (chapterFourTournamentOutcome(state) === "win") {
    if (!await readAndCommit(owner, win)) return;
  } else {
    if (!await readAndCommit(owner, loss)) return;
    // ※仮置き（Q5・Q7 未決）: 大会の最初へ戻す暫定形。
    if (!chapterFourAfterDefeat(state)) return;
    save();
  }
  await renderStage(owner);
}

function renderComplete(owner) {
  // 第4章側の第5章への接続点はここ1か所（状態遷移は ch5-progress.js の advanceToChapterFive）。
  const next = button(owner, "第5章へ進む", "chapter-five", async () => {
    const mod = await import("./ch5.js");
    await mod.beginChapterFive();
  }, true);
  const replay = button(owner, "次回予告をもう一度", "complete-preview", () => preview(false));
  // 外側の busy(false) は data-locked を見て disabled を再設定するため、両方を連動させる。
  const lock = (btn, locked) => { if (btn.dataset) btn.dataset.locked = String(locked); btn.disabled = locked; };
  lock(next, !state.flags._ch4_preview_seen);
  // 予告3（第4章末→第5章）。設計 7-4: 「第5章へ進む」は予告の終了後にだけ押せる。
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
      const result = await playChapterPreview("ch5", { signal: controller.signal });
      if (first && (result === "completed" || result === "skipped") && current(owner) && state.phase === "cleared") {
        state.flags._ch4_preview_seen = true;
        save();
      }
    } catch { /* 次回予告は任意演出。失敗しても完了画面はそのまま使える。 */ }
    finally {
      observer?.disconnect();
      lock(next, !state.flags._ch4_preview_seen); lock(replay, false);
      if (next.isConnected) {
        playBgm("tonari");
        replay.focus();
      }
    }
  };
  card(owner, "complete", "第四章・完", "世界大会を終え、日本へ戻った。", [
    next,
    replay,
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], "第五章・機械仕掛けの神へ進めます。");
  if (!state.flags._ch4_preview_seen) void preview(true);
}

function renderError(owner) {
  card(owner, "error", "第4章を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "retry", () => state.chapter === 4 ? resumeChapterFour() : beginChapterFour(), true),
  ]);
}
