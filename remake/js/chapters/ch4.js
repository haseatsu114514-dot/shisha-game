// 第4章・ドバイ。プロローグ→自由行動→前夜→大会→勝ち側の本線までを、場面単位で保存する。
// 状態遷移は ch4-progress.js、行き先の計算は ch4-map-model.js。ここは表示と再生だけを持つ。
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { layers, showScreen, setBg, chapterTitle, modal, toast } from "../core/ui.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play, hooks } from "../vn/engine.js";
import { radar } from "../daily/status.js";
import { paidAction } from "../core/stats.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { CH4_PROLOGUE, CH4_RESOLUTION, CH4_SCENE_BG, CH4_SCENE_BGM, CH4_DEFAULT_BGM, CH4_SCENE_FILES, CH4_TOURNAMENT_SCENES,
  CH4_VISITOR_SCENE_FILES, canAdvanceToChapterFour, advanceToChapterFour, chapterFourProgress, completeChapterFourScene,
  endChapterFourDay, finishChapterFourEve, chapterFourMandatory, revealChapterFourSheikh,
  chapterFourTournamentOutcome, chapterFourAfterDefeat, recordChapterFourStrategy, CH4_PRIZE } from "./ch4-progress.js";

const CH4_SPOT_SCENES = CH4_SCENE_FILES.ch4_spots;
import { chapterFourMapModel } from "./ch4-map-model.js";
import { canReflect, reflectAt, eveReflection } from "../daily/reflection.js";
import { canChooseOverseasCompanion, chooseOverseasCompanion, overseasCompanionCandidates, overseasCompanion } from "../core/overseas-companion.js";
import { playChapterPreview } from "./chapter-preview.js";
import { chapterFourFinalDialogue, chapterFourDefeatDialogue, chapterFourPlanReview } from "./ch4-verdict.js";
import { craftReviewLines } from "../craft/advice.js";
import { TOKYO_RESIDENT_IDS } from "./ch3-story-wiring.js";
import { readDialogues, loadStoryRoutes } from "../core/chapter-data.js";
import { CH4_EVENING_DIALOGUE_FILES, CH4_EVENING_BG, selectChapterFourEvening, chapterFourEveningPartner,
  chapterFourEveningRecord } from "./ch4-story-wiring.js";

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

function card(owner, name, title, description, actions = [], note = "", sceneId = "", content = null) {
  hud();
  showScreen("ch4", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第四章 ／ 継承の煙" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
    content,
    el("div.ch2-contest-actions", actions),
  ]));
}

/** 必要な台本をすべて確認してから DB に公開する。欠けていれば状態を進めない。 */
async function loadDialogues() {
  const files = { ...CH4_SCENE_FILES, ...CH4_VISITOR_SCENE_FILES, ...CH4_EVENING_DIALOGUE_FILES };
  const groups = await Promise.all(Object.entries(files).map(async ([file, ids]) => [ids, await readDialogues(file, ids)]));
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
  const craft = chapterFourProgress(state).match?.craft;
  const actual = id === "ch4_final" && craft ? chapterFourFinalDialogue(source, state, craft)
    : id === "ch4_defeat" && craft ? chapterFourDefeatDialogue(source, state, craft) : source;
  const dialogue = { ...actual, metadata: { ...source.metadata, bg: "" } };
  showScreen("none", null);
  hud();
  await setBg(bgUrl(CH4_SCENE_BG[id] || CH4_EVENING_BG), { instant: true });
  if (!current(owner)) return false;
  playBgm(CH4_SCENE_BGM[id] || CH4_DEFAULT_BGM);
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
  const progress = chapterFourProgress(state);
  // AI仮判断（#1660）: 既存の再訪解放を行動の報酬として知らせる。前夜の強制読了後には自由行動がない。
  const unlockRevisit = id === "ch4_stranger_second" && progress.part === "free" && !progress.read[id];
  if (!await readScene(owner, id)) return false;
  if (!completeChapterFourScene(state, id)) return false;
  save();
  if (unlockRevisit) toast("路地裏のカフェに再訪できるようになった", { kind: "good" });
  return true;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  const progress = chapterFourProgress(state);
  if (canChooseOverseasCompanion(state)) return renderCompanionChoice(owner);
  if (progress.part === "prologue") return renderScene(owner, CH4_PROLOGUE[progress.stage], `DAY ${progress.day}`);
  if (progress.part === "free") return renderFree(owner);
  if (progress.part === "eve") return renderEve(owner);
  if (progress.part === "tournament") return renderTournament(owner);
  if (progress.part === "resolution") return renderScene(owner, CH4_RESOLUTION[progress.resolution], "");
  return renderComplete(owner);
}

/** 出発前の同行選択。恋人1名か「同行なし」。選ぶと保存し、他の恋人は別便の応援として扱う（好感度は変えない）。 */
async function renderCompanionChoice(owner) {
  await setBg(bgUrl(CH4_SCENE_BG[CH4_PROLOGUE[0].id]), { instant: true });
  if (!current(owner)) return;
  const choose = id => async () => {
    if (!chooseOverseasCompanion(state, id)) return;
    save();
    await renderStage(owner);
  };
  const lovers = overseasCompanionCandidates(state);
  card(owner, "companion", "出発前・同行の選択",
    lovers.length ? "ドバイへ一緒に行く恋人を、1人まで選べる。選ばなかった恋人も、別の便で応援に来られる。"
      : "今回は、一緒に行く恋人はいない。",
    [...lovers.map(id => button(owner, DB.characters[id]?.name || id, `companion-${id}`, choose(id))),
      button(owner, "同行なし", "companion-none", choose(null), !lovers.length)]);
}

async function renderScene(owner, scene, dayLabel) {
  await setBg(bgUrl(CH4_SCENE_BG[scene.id]), { instant: true });
  const lover = scene.location === "tonari" ? await loverActions(owner, { home: true }) : [];
  if (!current(owner)) return;
  card(owner, "scene", `${dayLabel ? `${dayLabel}・` : ""}${scene.label}`, `${scene.location}で、次の話を読む。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      await renderStage(owner);
    }, true),
    ...lover,
  ], "", scene.id);
}

/**
 * 恋人の入口（#2024）。第1・2章と同じ処理（lover-entry.js → daily/romance.js）を使う。
 * 日本にいる間（出発前・帰国後のtonari）は恋人LIMEと節目。ドバイ滞在中は遠くの恋人からのLIMEだけで、
 * 恋人と過ごす場面（節目・dubai_evening 系）はつながない（ch4-progress.js の FREE_SCENES の方針）。
 * 同行した恋人は一緒にいるのでLIMEを送ってこない。東京在住のましろとは地元では会えない。
 */
async function loverActions(owner, { home = false } = {}) {
  const lover = await import("./lover-entry.js");
  const exclude = home ? [] : [overseasCompanion(state).companion].filter(Boolean);
  const actions = [];
  if (lover.pendingLoverLime({ exclude }).length) actions.push(button(owner, "恋人からのLIMEを読む", "lover-lime", async () => {
    showScreen("none", null);
    hud();
    await lover.readLoverLime({ exclude });
    if (current(owner)) await renderStage(owner);
  }));
  const [id] = home ? lover.loverMilestonesDue((state.lovers || []).filter(who => !TOKYO_RESIDENT_IDS.includes(who))) : [];
  if (id) actions.push(button(owner, `${displayName(id, state, { context: "private" })}と過ごす`, "lover-milestone", async () => {
    showScreen("none", null);
    hud();
    const controller = owner.controller = new AbortController();
    try { await lover.readLoverMilestone(id, { signal: controller.signal }); }
    finally { if (owner.controller === controller) owner.controller = null; }
    if (current(owner)) await renderStage(owner);
  }));
  return actions;
}

async function renderFree(owner) {
  const model = chapterFourMapModel(state, { canReflect: canReflect() });
  await setBg(bgUrl(model.background), { instant: true });
  const lover = await loverActions(owner);
  if (!current(owner)) return;
  card(owner, "free", `DAY ${model.day}・自由行動`, `ドバイの街を歩く。大会まであと${model.daysLeft}日。`,
    [...model.destinations.map(destination => el("div.ch4-destination", [
      destination.ok === false
        ? el("button.btn", { type: "button", text: destination.label, disabled: true, dataset: { test: test(`go-${destination.id}`) } })
        : button(owner, destination.label, `go-${destination.id}`, () => visit(owner, destination.id), destination.kind === "end_day"),
      el("p.ch4-destination-purpose", { text: `${destination.purpose}${destination.unreadCount > 0 ? "（未読あり）" : ""}` }),
    ])), ...lover],
    [model.guide, model.hint, model.note].filter(Boolean).join(" "));
}

/** 行き先の場面を順に再生してマップへ戻る。日が進むのは「その日を終える」だけ。 */
async function visit(owner, id) {
  const destination = chapterFourMapModel(state, { canReflect: canReflect() })?.destinations.find(item => item.id === id);
  if (!current(owner) || !destination || destination.ok === false) return;
  if (destination.kind === "reflect") {
    await reflectAt("dubai_mosque");
    if (current(owner)) await renderStage(owner);
    return;
  }
  for (const sceneId of destination.scenes) {
    if (CH4_SPOT_SCENES.includes(sceneId)) {
      // スポット初回は「……【センス】が少し上がった。」の台詞報酬を実際に加算する（通常の自由行動と同じ最大2能力各1P）。
      // 最後まで読んだ時だけ精算し、中断では何も付けない。
      const { value: done } = await paidAction(() => readAndCommit(owner, sceneId), { consumed: ok => ok });
      if (!done) return;
      save();
    } else if (!await readAndCommit(owner, sceneId)) return;
  }
  if (destination.kind === "end_day") {
    if (!endChapterFourDay(state)) return;
    save();
  }
  await renderStage(owner);
}

/** 前夜: 未読の必須場面を story_routes の順に強制消化する。繋ぎ場面があれば先に再生。 */
async function renderEve(owner) {
  // 前夜に火種が残っていれば、モスクの見える水辺でひとり内省する（SPEC 2.8・#1690）
  if (await eveReflection("dubai_waterside")) { if (current(owner)) await renderStage(owner); return; }
  const [next] = chapterFourMandatory(state);
  if (!next) {
    // 必須場面の後、大会日へ進む前に、前夜の過ごし方を一度だけ確定する（#1895）。
    if (!state.flags._ch4_evening) { await renderEvening(owner); return; }
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

/**
 * 前夜の過ごし方。同じ場所の恋人が2人以上なら重なった予定を保留する場面を再生し、1人なら誘うか選ぶ。
 * 恋人がいない・到着していない夜は、場面を出さずに「過ごさなかった」と記録する。
 */
async function renderEvening(owner) {
  const routes = await loadStoryRoutes();
  if (!current(owner)) return;
  const settle = async result => {
    for (const id of result.scenes) {
      if (!await readScene(owner, id)) return;
    }
    // 再生を最後まで読んだ時だけ記録する。中断・LOAD後は同じ前夜からやり直す。
    if (state.flags._ch4_evening || chapterFourMandatory(state).length) return;
    state.flags._ch4_evening = chapterFourEveningRecord(result);
    save();
    await renderStage(owner);
  };
  const result = selectChapterFourEvening(routes, state);
  const partner = chapterFourEveningPartner(routes, state);
  if (result.kind !== "rest" || !partner) { await settle(result); return; }
  const name = displayName(partner, state, { context: "private" });
  await setBg(bgUrl(CH4_EVENING_BG), { instant: true });
  if (!current(owner)) return;
  card(owner, "evening", "DAY 4・前夜", `大会前夜。${name}と過ごす時間がある。`, [
    button(owner, `${name}と過ごす`, "evening-date",
      () => settle(selectChapterFourEvening(routes, state, partner)), true),
    button(owner, "ひとりで休む", "evening-rest", () => settle(selectChapterFourEvening(routes, state))),
  ], "どちらを選んでも、明日の大会には影響しません。");
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
  const { runChapterFourCraft } = await import("./ch4-tournament.js");
  if (!current(owner)) return;
  const result = await runChapterFourCraft({ isCurrent: () => current(owner), menuButton: () => menuButton(owner) });
  if (!current(owner)) return;
  if (!result) { await renderTournament(owner); return; }
  // 順位・二度の調整・5工程の実成績を、勝敗の台本へ進む前に確認する。
  const parts = Object.entries(result.parts).map(([key, score]) =>
    `${({ holes: "穴", heat: "炭", shisha: "完成品", care1: "調整1", care2: "調整2" })[key]} ${score.toFixed(1)}`).join(" ／ ");
  await modal({ title: result.failure ? "制作を完了できなかった" : `世界大会 ${result.rank}位`,
    body: `${result.failure ? "完了した工程から振り返ろう。" : `総合 ${result.total.toFixed(1)} ／ ${parts}`}\n` +
      result.rows.map(row => `${({ hajime: "はじめ", naru: "なる", wang: "王煙楼", sheikh: "シェイク" })[row.id]} ${row.points}票`).join(" ／ ") +
      // 第1〜3章の結果と同じ2行（#1909）。記録の無い工程は推測しない。
      craftReviewLines(chapterFourProgress(state).match?.craft).map(text => `\n${text}`).join(""),
    options: [{ label: "講評へ", primary: true, test: "ch4-verdict-continue" }] });
  if (!current(owner)) return;
  if (chapterFourTournamentOutcome(state) === "win") {
    if (!await readAndCommit(owner, win)) return;
    toast(`大会の賞金 ${CH4_PRIZE.toLocaleString("ja-JP")}円を受け取った`, { kind: "good" });
  } else {
    if (!await readAndCommit(owner, loss)) return;
    // ※仮置き（Q5・Q7 未決）: 大会の最初へ戻す暫定形。
    if (!chapterFourAfterDefeat(state)) return;
    save();
  }
  await renderStage(owner);
}

const RECAP_STRATEGY = Object.freeze({
  sakura: "桜を軸にした配合で、世界の卓に立った。",
  peach: "桃を軸にした配合で、世界の卓に立った。",
  tea: "茶を軸にした配合で、世界の卓に立った。",
});

/** 完了カードの振り返り。選んだ配合と、ドバイで足を運んだ場所だけを短く添える。 */
function chapterFourRecap(value) {
  const { read } = chapterFourProgress(value);
  const lines = ["世界大会を終え、日本へ戻った。"];
  const craft = chapterFourProgress(value).match?.craft;
  const strategy = craft ? chapterFourPlanReview(value, craft) : RECAP_STRATEGY[value.flags._ch4_strategy];
  if (strategy) lines.push(strategy);
  const visited = [];
  if (read.ch4_dubai_souq) visited.push("スーク");
  if (read.ch4_festa) visited.push("FESTA");
  if (read.ch4_dubai_cafe) visited.push("カフェ");
  if (visited.length) lines.push(`ドバイでは${visited.join("・")}に足を運んだ。`);
  if (read.ch4_alley_cafe_quiet) lines.push("路地のカフェで、静かな夜も過ごした。");
  return lines.join("");
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
  card(owner, "complete", "第四章・完", chapterFourRecap(state), [
    next,
    replay,
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], "第五章・機械仕掛けの神へ進めます。", "",
  // 第1章と同じ比較。固定の祝福では能力を足さず、実際に伸びた分だけを重ねる。
  el("div.end-radar", { dataset: { test: test("growth") } }, [
    radar(state.stats, state.statsAtChapterStart || state.stats, 300),
    el("p", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
  ]));
  if (!state.flags._ch4_preview_seen) void preview(true);
}

function renderError(owner) {
  card(owner, "error", "第4章を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "retry", () => state.chapter === 4 ? resumeChapterFour() : beginChapterFour(), true),
  ]);
}
