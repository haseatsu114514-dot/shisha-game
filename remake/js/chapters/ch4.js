// 第4章・ドバイ。プロローグ→自由行動→前夜→大会→勝ち側の本線までを、場面単位で保存する。
// 状態遷移は ch4-progress.js、行き先の計算は ch4-map-model.js。ここは表示と再生だけを持つ。
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { hasStoreLogo, storeLogo } from "../core/store-logos.js";
import { createChapterActions } from "../core/chapter-actions.js";
import { createChapterCard } from "../core/chapter-card.js";
import { createChapterMenu } from "../core/chapter-menu.js";
import { chapterGrowthNight } from "../core/chapter-growth.js";
import { state, save } from "../core/state.js";
import { layers, showScreen, setBg, enterScene, chapterTitle, modal, toast } from "../core/ui.js";
import { saveFlow } from "../scenes/saves.js";
import { planeRide } from "../core/scene-motions.js";
import { defeatFade } from "../core/transitions.js";
import { play, hooks } from "../vn/engine.js";
import { playChapterPoem } from "../scenes/chapter-poem.js";
import { chapterGrowthChart } from "../daily/status.js";
import { paidAction } from "../core/stats.js";
import { awardChapterClearExp, awardSceneExp, presentNight, consultLessons } from "../core/growth.js";
import { stopBgm, playBgm } from "../core/audio.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { CH4_PROLOGUE, CH4_RESOLUTION, CH4_SCENE_BG, CH4_SCENE_BGM, CH4_DEFAULT_BGM, CH4_SCENE_FILES, CH4_TOURNAMENT_SCENES,
  CH4_VISITOR_SCENE_FILES, canAdvanceToChapterFour, advanceToChapterFour, chapterFourProgress, completeChapterFourScene,
  endChapterFourDay, finishChapterFourEve, chapterFourMandatory, revealChapterFourSheikh,
  chapterFourTournamentOutcome, chapterFourAfterDefeat, recordChapterFourStrategy, CH4_PRIZE,
  CH4_PREP_SCENES, chapterFourPrepPending, departChapterFour, chapterFourRead,
  chapterFourDaily, enterChapterFourEve, chapterFourEveDay, chapterFourTournamentDay, chapterFourArrivalsDue,
  CH4_ARRIVAL_SCENES, CH4_FRIEND_ARRIVAL_SCENES, chapterFourArrivalEveningsDue } from "./ch4-progress.js";

const CH4_SPOT_SCENES = CH4_SCENE_FILES.ch4_spots;
import { chapterFourMapModel } from "./ch4-map-model.js";
import { openShop } from "../daily/shop.js";
import { canReflect, reflectAt } from "../daily/reflection.js";
import { canChooseOverseasCompanion, chooseOverseasCompanion, overseasCompanionCandidates, overseasCompanion } from "../core/overseas-companion.js";
import { chapterFourFinalDialogue, chapterFourDefeatDialogue, chapterFourPlanReview } from "./ch4-verdict.js";
import { craftReviewLines } from "../craft/advice.js";
import { buildGameOver, warmGameOver } from "./gameover.js";
import { craftContinueContext, recordContinueContext, clearContinueHistory } from "./continue-context.js";
import { TOKYO_RESIDENT_IDS } from "./ch3-story-wiring.js";
import { readDialogues, loadStoryRoutes } from "../core/chapter-data.js";
import { CH4_EVENING_DIALOGUE_FILES, CH4_EVENING_BG, selectChapterFourEvening, chapterFourEveningPartner,
  chapterFourEveningRecord } from "./ch4-story-wiring.js";
import { CH4_CAMEL_SCENE_FILES, camelSceneBg, visitCamelRace } from "./ch4-camel-race.js";
import { readChapterFourStaffCheckpoint } from "./ch4-staff-work.js";
import { CH4_STAFF_IDS } from "./ch4-staff-work-progress.js";

let session = null;
const current = owner => session === owner && owner.active && owner.state === state;
const test = name => `ch4-${name}`;

const { button, perform } = createChapterActions({ current, test, logName: "[ch4]", renderError });

function menuButton(owner) {
  return el("button.btn", { type: "button", text: "MENU", dataset: { test: test("menu") },
    onclick: () => openMenu(owner) });
}

const openMenu = createChapterMenu({ current, test, title: "第四章 MENU" });

function hud() {
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
}

const renderCard = createChapterCard({ hud, screen: "ch4", test, heading: "第四章 ／ 継承の煙", menuButton });
function card(owner, name, title, description, actions = [], note = "", sceneId = "", content = null) {
  renderCard(owner, name, title, description, actions, note, sceneId, [content]);
}

/** 必要な台本をすべて確認してから DB に公開する。欠けていれば状態を進めない。 */
async function loadDialogues() {
  const files = { ...CH4_SCENE_FILES, ...CH4_VISITOR_SCENE_FILES, ...CH4_EVENING_DIALOGUE_FILES, ...CH4_CAMEL_SCENE_FILES };
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
  const owner = session = { state, growthDay: state.day, active: true, busy: false, menuBusy: false, controller: null };
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
    // 到着前（日本のプロローグ）は店の曲。到着済み・本編はドバイの仮曲（CH4_DEFAULT_BGM）。
    playBgm((progress.part !== "prologue" || chapterFourRead(state, "ch4_opening")) ? CH4_DEFAULT_BGM : "tonari");
    if (progress.part === "prologue" && !progress.titleSeen) {
      await setBg(bgUrl(CH4_SCENE_BG[CH4_PROLOGUE[0].id]), { instant: true });
      if (!current(owner)) return;
      if (!await playChapterPoem(4, { owner, current })) return; // 章タイトルの前の巻頭ポエム
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
  // ドバイ→日本の帰国は、機窓で夕方から日本の夜の街の灯へ（#2688 A4）。読み直し（既読）では乗らない
  if (id === "ch4_sumi_return" && !chapterFourRead(state, id)) {
    await planeRide(() => setBg(bgUrl(CH4_SCENE_BG[id]), { instant: true }), { to: "home" });
    if (!current(owner)) return false;
  }
  await setBg(bgUrl(CH4_SCENE_BG[id] || camelSceneBg(id) || CH4_EVENING_BG));
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
  if (progress.part === "free" && CH4_SPOT_SCENES.includes(id)) awardSceneExp(id);
  if (state.flags._ch4_cleared) awardChapterClearExp();
  save();
  if (unlockRevisit) toast("路地裏のカフェに再訪できるようになった", { kind: "good" });
  return true;
}

async function renderStage(owner) {
  if (!current(owner)) return;
  if (!await chapterGrowthNight(owner, () => current(owner))) return;
  const progress = chapterFourProgress(state);
  if (canChooseOverseasCompanion(state)) return renderCompanionChoice(owner);
  if (chapterFourPrepPending(state)) return renderPrep(owner);
  if (progress.part === "prologue") return renderScene(owner, CH4_PROLOGUE[progress.stage], `DAY ${progress.day}`);
  if (progress.part === "free") return chapterFourDaily(state) ? renderDubaiDaily(owner) : renderFree(owner);
  if (progress.part === "eve") return renderEve(owner);
  if (progress.part === "tournament") return renderTournament(owner);
  if (progress.part === "resolution") {
    // 店仕事の片づけ（借りた道具を返す）は、勝敗の台本で決勝を描いた後、結果発表の前に一度だけ読む。
    // 片づけの前で中断した保存も、ここで読んでから結果発表へ進む。読めない保存（旧保存など）は何もしない。
    if (progress.resolution === 0
      && !await readChapterFourStaffCheckpoint(CH4_STAFF_IDS.cleanup, { isCurrent: () => current(owner) })) return;
    if (!current(owner)) return;
    return renderScene(owner, CH4_RESOLUTION[progress.resolution], "");
  }
  return renderComplete(owner);
}

/**
 * 出発前の準備3日（VOL02）: 地元・柚ヶ谷の日常ループ（1日目の昼に特訓、夜に持っていく配合）→ 出発の朝にドバイDAY1。
 * 進み具合は flags._ch4_prep.step（0＝準備中、1＝出発の朝）。中断・LOADは同じ段から。
 */
async function renderPrep(owner) {
  if (!current(owner)) return;
  const prep = state.flags._ch4_prep;
  if (prep.step === 0) {
    const [{ runDeparturePrep, departureMorningReached }, { chapterFourPrepEvents }] = await Promise.all([
      import("./departure-prep.js"), import("./ch4-prep.js")]);
    if (!current(owner)) return;
    showScreen("none", null);
    await runDeparturePrep({ destination: "ドバイ", ...chapterFourPrepEvents(prep) });
    // 出発の朝まで来た時だけ先へ。LOAD・タイトルへ戻った場合はここで止める。
    if (!current(owner) || !departureMorningReached(state)) return;
    hud();
    prep.step = 1;
    save();
  }
  // 出発前のtonari2場面が残っていれば（寝込んだ日など）、出発の朝に読んでから発つ。
  for (const id of CH4_PREP_SCENES) {
    if (chapterFourRead(state, id)) continue;
    if (!await readAndCommit(owner, id)) return;
  }
  if (!departChapterFour(state)) throw new Error("ドバイへ出発できません");
  save();
  // 日本→ドバイ。機窓の外が夜から朝焼けへ移り、砂の地平線が見えたところで空港に着く（#2688 A4）
  await planeRide(() => setBg(bgUrl(CH4_SCENE_BG.ch4_opening), { instant: true }), { to: "dubai" });
  if (!current(owner)) return;
  await renderStage(owner);
}

/** 出発前の同行選択。恋人1名か「同行なし」。選ぶと保存し、他の恋人は別便の応援として扱う（好感度は変えない）。 */
async function renderCompanionChoice(owner) {
  await enterScene(bgUrl(CH4_SCENE_BG[CH4_PROLOGUE[0].id]));
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

/** 読んだ後にその場にいる人へ、心得の盤で灯した授業を相談できる場面（SBD91。灯していなければ何も起きない） */
const LESSON_AFTER_SCENE = Object.freeze({ ch4_result: "master_hookah" });

async function renderScene(owner, scene, dayLabel) {
  await enterScene(bgUrl(CH4_SCENE_BG[scene.id]));
  const lover = scene.location === "tonari" ? await loverActions(owner, { home: true }) : [];
  if (!current(owner)) return;
  card(owner, "scene", `${dayLabel ? `${dayLabel}・` : ""}${scene.label}`, `${scene.location}で、次の話を読む。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readAndCommit(owner, scene.id)) return;
      // 結果発表の後、会場の片づけで王煙楼に相談する
      const teacher = LESSON_AFTER_SCENE[scene.id];
      if (teacher) await consultLessons(teacher, { bg: bgUrl(CH4_SCENE_BG[scene.id]) });
      if (!current(owner)) return;
      await renderStage(owner);
    }, true),
    ...lover,
  ], "", scene.id);
}

/**
 * 恋人の入口（#2024）。第1・2章と同じ処理（lover-entry.js → daily/romance.js）を使う。
 * 日本にいる間（出発前・帰国後のtonari）は恋人LIMEと節目。ドバイ滞在中は遠くの恋人からのLIMEだけで、
 * 節目は進めない（IR17）。到着した恋人・ましろと過ごす夕方（dubai_evening 系）は、前夜祭の日の renderEve で読む（IR18・#3097）。
 * 同行した恋人は一緒にいるのでLIMEを送ってこない。東京在住のましろとは地元では会えない。
 * 地元にいるかは home で渡す（帰国後のtonariでも現在地の印はドバイのまま。離れている間は地元前提の文面を送ってこない・#2024）。
 */
async function loverActions(owner, { home = false } = {}) {
  const lover = await import("./lover-entry.js");
  const exclude = home ? [] : [overseasCompanion(state).companion].filter(Boolean);
  const actions = [];
  if (lover.pendingLoverLime({ exclude, home }).length) actions.push(button(owner, "恋人からのLIMEを読む", "lover-lime", async () => {
    showScreen("none", null);
    hud();
    await lover.readLoverLime({ exclude, home });
    if (current(owner)) await renderStage(owner);
  }));
  // 友人からのたまのLIME（#2022）。同行者は一緒にいるので送ってこない。
  const friend = await import("./friend-entry.js");
  if (friend.pendingFriendLime({ exclude }).length) actions.push(button(owner, "友人・知り合いのLIMEを読む", "friend-lime", async () => {
    showScreen("none", null);
    hud();
    await friend.readFriendLime({ exclude });
    if (current(owner)) await renderStage(owner);
  }));
  const [id] = home ? lover.loverMilestonesDue((state.lovers || []).filter(who => !TOKYO_RESIDENT_IDS.includes(who)), { home }) : [];
  if (id) actions.push(button(owner, `${displayName(id, state, { context: "private" })}と過ごす`, "lover-milestone", async () => {
    showScreen("none", null);
    hud();
    const controller = owner.controller = new AbortController();
    try { await lover.readLoverMilestone(id, { signal: controller.signal, home }); }
    finally { if (owner.controller === controller) owner.controller = null; }
    if (current(owner)) await renderStage(owner);
  }));
  return actions;
}

async function renderFree(owner) {
  const model = chapterFourMapModel(state, { canReflect: canReflect() });
  await enterScene(bgUrl(model.background));
  const lover = await loverActions(owner);
  if (!current(owner)) return;
  card(owner, "free", `DAY ${model.day}・自由行動`, `ドバイの街を歩く。大会まであと${model.daysLeft}日。`,
    [...model.destinations.map(destination => el("div.ch4-destination", [
      ...(hasStoreLogo(`ch4_${destination.id}`) ? [storeLogo(`ch4_${destination.id}`, { width: 180, height: 104 })] : []),
      destination.ok === false
        ? el("button.btn", { type: "button", text: destination.label, disabled: true, dataset: { test: test(`go-${destination.id}`) } })
        : button(owner, destination.label, `go-${destination.id}`, () => visit(owner, destination.id), destination.kind === "end_day"),
      el("p.ch4-destination-purpose", { text: `${destination.purpose}${destination.unreadCount > 0 ? "（未読あり）" : ""}` }),
    ])), ...lover],
    [model.guide, model.hint, model.note].filter(Boolean).join(" "));
}

/**
 * ドバイの日常（版2・VOL04）: DAY1〜12は第1・2章と同じ日常ループ（chapters/ch4-dubai-daily.js）。
 * 前夜祭の日（DAY13）の朝に戻り、今までの「前夜」の流れ（必須の場面・前夜の過ごし方）へ入る。
 */
async function renderDubaiDaily(owner) {
  const dubai = await import("./ch4-dubai-daily.js");
  if (!current(owner)) return;
  showScreen("none", null);
  await dubai.runChapterFourDubai({ readAndCommit: id => readAndCommit(owner, id) });
  if (!current(owner) || state.day < dubai.dubaiEveDay(state)) return;
  if (!enterChapterFourEve(state)) throw new Error("前夜へ進めません");
  save();
  hud();
  await renderStage(owner);
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
  if (destination.kind === "camel") {
    // ラクダレース（任意）。会話→レース→結果の会話と保存は ch4-camel-race.js が進める。レース中の中断は controller で止める。
    const controller = new AbortController();
    try {
      await visitCamelRace({ read: id => readScene(owner, id), signal: controller.signal, isCurrent: () => current(owner),
        beforeRace: () => { showScreen("none", null); hud(); owner.controller = controller; } });
    } finally { if (owner.controller === controller) owner.controller = null; }
    if (!current(owner)) return;
    playBgm(CH4_DEFAULT_BGM);
    await renderStage(owner);
    return;
  }
  if (destination.kind === "shop") {
    await openShop({ branch: "dubai" });
    if (!current(owner)) return;
    playBgm(CH4_DEFAULT_BGM); // 店のBGMを街の曲へ戻す
    await renderStage(owner);
    return;
  }
  if (destination.kind === "desert_talk" || destination.kind === "desert") {
    // 砂漠ツアーのデスク／砂丘のサンドボード（ch4-desert.js）。読了・外出・記録の確定と保存はあちらで行う。
    const { visitDesert } = await import("./ch4-desert.js");
    const controller = owner.controller = new AbortController();
    try { await visitDesert(destination, { day: chapterFourProgress(state).day, isCurrent: () => current(owner), signal: controller.signal }); }
    finally { if (owner.controller === controller) owner.controller = null; }
    if (!current(owner)) return;
    playBgm(CH4_DEFAULT_BGM);
    await renderStage(owner);
    return;
  }
  for (const sceneId of destination.scenes) {
    if (CH4_SPOT_SCENES.includes(sceneId)) {
      // スポット初回は「……【センス】が少し上がった。」の台詞報酬を実際に加算する（通常の自由行動と同じ最大2能力各1P）。
      // 最後まで読んだ時だけ精算し、中断では何も付けない。
      const { value: done } = await paidAction(() => readAndCommit(owner, sceneId), {
        consumed: ok => ok, exp: { key: `dubai:${destination.id}`, place: `dubai:${destination.id}` },
      });
      if (!done) return;
      save();
    } else if (!await readAndCommit(owner, sceneId)) return;
  }
  if (destination.id === "festa" && current(owner)) {
    const controller = owner.controller = new AbortController();
    try { await consultLessons("da_silva", { bg: bgUrl(destination.background), signal: controller.signal }); }
    finally { if (owner.controller === controller) owner.controller = null; }
    if (!current(owner)) return;
  }
  if (destination.kind === "end_day") {
    if (!endChapterFourDay(state)) return;
    save();
  }
  await renderStage(owner);
}

/**
 * 前夜: 別便で来た応援の到着を1人ずつ読んでから、未読の必須場面を story_routes の順に強制消化する。
 * 繋ぎ場面があれば先に再生。到着を読み終えた恋人だけが、前夜の過ごし方で「その場にいる」人になる。
 */
async function renderEve(owner) {
  const [arrival] = chapterFourArrivalsDue(state);
  if (arrival) { await renderArrival(owner, arrival); return; }
  const [next] = chapterFourMandatory(state);
  if (!next) {
    // 必須場面の後、大会日へ進む前に、前夜の過ごし方を一度だけ確定する（#1895）。
    if (!state.flags._ch4_evening) { await renderEvening(owner); return; }
    // 夜の会話も経験に含め、精算してから内省する。既読の前夜をLOADしてもXPは積み増さない。
    await presentNight({ evePlace: "dubai_waterside" });
    if (!current(owner)) return;
    if (!finishChapterFourEve(state)) throw new Error("前夜を終えられません");
    owner.growthDay = state.day;
    save();
    await renderStage(owner);
    return;
  }
  // 到着した恋人・ましろと過ごす夕方（任意で一度・IR18・#3097）。前夜祭が始まると、もう出ない。
  // ましろはほかの章の入口と同じく「ましろちゃん」と呼ぶ（恋人版・友人版とも）。
  const evenings = chapterFourArrivalEveningsDue(state);
  const eveningName = id => id === "mashiro" ? "ましろちゃん" : displayName(id, state, { context: "private" });
  await enterScene(bgUrl(CH4_SCENE_BG[next.lead || next.id]));
  if (!current(owner)) return;
  card(owner, "eve", `DAY ${chapterFourEveDay(state)}・${evenings.length ? "前夜祭の日" : "前夜"}`,
    evenings.length ? "夕方になった。前夜祭の前に、少し時間がある。" : "夜になった。大会の前に、済ませておくことが残っている。", [
      button(owner, "続きを読む", "continue", async () => {
        for (const id of [next.lead, next.id].filter(Boolean)) {
          if (!await readAndCommit(owner, id)) return;
        }
        await renderStage(owner);
      }, true),
      ...evenings.map(evening => button(owner, `${eveningName(evening.id)}と夕方を過ごす`,
        `arrival-evening-${evening.id}`, async () => {
          // 最後まで読んだ時だけ確定・保存する。読んだ後は同じカードに戻り、前夜祭へ進む。
          if (!await readAndCommit(owner, evening.scene)) return;
          await renderStage(owner);
        })),
    ], evenings.length ? "夕方を過ごしても、明日の大会には影響しません。前夜祭が始まると、夕方の時間は終わります。" : "", next.id);
}

/**
 * 前夜祭の日、別便の応援の到着（台本の冒頭が出迎え）。名前はカードに出さない（ましろちゃん等の呼び方は台本に任せる）。
 * 2人目からは「もう一人」の文にして、同じカードが繰り返されたように見せない。
 */
async function renderArrival(owner, arrival) {
  await enterScene(bgUrl(CH4_SCENE_BG[arrival.scene]));
  if (!current(owner)) return;
  const another = [...Object.values(CH4_ARRIVAL_SCENES), ...Object.values(CH4_FRIEND_ARRIVAL_SCENES)]
    .some(id => chapterFourRead(state, id));
  const text = another ? "別の便で応援に来てくれる人が、もう一人着いたらしい。" : "別の便で応援に来てくれる人が、ドバイに着いたらしい。";
  card(owner, "arrival", `DAY ${chapterFourEveDay(state)}・前夜祭の日`, text, [
    button(owner, "続きを読む", "continue", async () => {
      // 最後まで読んだ時だけ確定・保存する。中断・LOADでは同じ到着からやり直す。
      if (!await readAndCommit(owner, arrival.scene)) return;
      await renderStage(owner);
    }, true),
  ], "", arrival.scene);
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
  await enterScene(bgUrl(CH4_EVENING_BG));
  if (!current(owner)) return;
  card(owner, "evening", `DAY ${chapterFourEveDay(state)}・前夜`, `大会前夜。${name}と過ごす時間がある。`, [
    button(owner, `${name}と過ごす`, "evening-date",
      () => settle(selectChapterFourEvening(routes, state, partner)), true),
    button(owner, "ひとりで休む", "evening-rest", () => settle(selectChapterFourEvening(routes, state))),
  ], "どちらを選んでも、明日の大会には影響しません。");
}

async function renderTournament(owner) {
  const progress = chapterFourProgress(state);
  // 敗北の場面を読み終え、まだ再挑戦を選んでいない保存はCONTINUE画面から再開する（第2・3章と同じ）。
  if (chapterFourTournamentOutcome(state) === "loss" && progress.read[CH4_TOURNAMENT_SCENES.loss]) return renderDefeat(owner);
  await enterScene(bgUrl(CH4_SCENE_BG[CH4_TOURNAMENT_SCENES.start]));
  if (!current(owner)) return;
  card(owner, "tournament", `DAY ${chapterFourTournamentDay(state)}・大会当日`, "会場へ向かう。",
    [button(owner, "大会へ", "start", () => runTournament(owner), true)],
    progress.attempts ? "同じ大会に、もう一度挑む。" : "", CH4_TOURNAMENT_SCENES.start);
}

/** 確定済み result の票と順位だけを再表示する。再開時も投票・報酬には触れない。 */
async function showChapterFourCommittedResult(result) {
  const parts = Object.entries(result.parts).map(([key, score]) =>
    `${({ holes: "穴", heat: "炭", shisha: "完成品", care1: "調整1", care2: "調整2" })[key]} ${score.toFixed(1)}`).join(" ／ ");
  const match = chapterFourProgress(state).match;
  const notes = [result.failure ? "完了した工程から振り返ろう。" : `はじめは${result.rank}位。審査員三人、それぞれの10点が出揃った。`,
    ...(result.failure ? [] : [`総合 ${result.total.toFixed(1)} ／ ${parts}`]),
    ...craftReviewLines(match?.craft)];
  const { chapterFourStandingsView } = await import("./ch4-standings.js");
  await modal({ title: result.failure ? "制作を完了できなかった" : `世界大会 ${result.rank}位`,
    body: match?.votes ? chapterFourStandingsView({ ...match, votes: result.votes || match.votes }, { rows: result.rows, notes, test: "ch4-result", final: true })
      : notes.join("\n"),
    options: [{ label: "講評へ", primary: true, test: "ch4-verdict-continue" }] });
}

async function runTournament(owner) {
  const { start, win, loss } = CH4_TOURNAMENT_SCENES;
  if (!chapterFourProgress(state).read[start]) {
    // 読み始める時点でシェイクの正体を明かす（DRAFT §3）。
    revealChapterFourSheikh(state);
    if (!await readAndCommit(owner, start)) return;
  }
  const [{ runChapterFourCraft }, { playEntrance }] = await Promise.all([import("./ch4-tournament.js"), import("./tournament-entrance.js")]);
  if (!current(owner)) return;
  // 入場カットインは一度だけ（制作の途中から再開したときは出さない）。
  if (!chapterFourProgress(state).match?.craft) { await playEntrance(4); if (!current(owner)) return; }
  const result = await runChapterFourCraft({ isCurrent: () => current(owner), menuButton: () => menuButton(owner) });
  if (!current(owner)) return;
  if (!result) { await renderTournament(owner); return; }
  // 最終票は result.rows / result.votes から表示する。勝敗の台本はこの後に読む。
  await showChapterFourCommittedResult(result);
  if (!current(owner)) return;
  if (chapterFourTournamentOutcome(state) === "win") {
    clearContinueHistory(state);
    if (!await readAndCommit(owner, win)) return;
    toast(`大会の賞金 ${CH4_PRIZE.toLocaleString("ja-JP")}円を受け取った`, { kind: "good" });
  } else {
    if (!await readAndCommit(owner, loss)) return;
    // 2026-11-02 オーナー決定: 第1〜3章と同じ20秒のCONTINUE画面を出す（#1909）。再挑戦は大会の最初から（Q5）。
    await renderDefeat(owner, null, { fresh: true });
    return;
  }
  await renderStage(owner);
}

/** 世界大会の敗北後のCONTINUE画面。「もう一度」で大会の最初へ戻し、タイトルへは保存してから戻る。 */
async function renderDefeat(owner, variant = null, { fresh = false } = {}) {
  if (!current(owner)) return;
  const progress = chapterFourProgress(state);
  const result = progress.match?.result;
  owner.continueRoot?.cleanupContinue();
  const context = recordContinueContext(state, progress, progress.attempts,
    craftContinueContext(progress.match?.craft, { chapter: 4, reason: result?.failure || "rank", rank: result?.rank }));
  await warmGameOver();
  if (!current(owner)) return;
  hud();
  const root = buildGameOver({ context, variant,
    onRetry: () => perform(owner, async () => {
      if (!root.isConnected || chapterFourTournamentOutcome(state) !== "loss") return;
      if (!chapterFourAfterDefeat(state)) return;
      save();
      await renderStage(owner);
    }),
    onTitle: () => {
      if (!current(owner)) return;
      save();
      owner.active = false;
      owner.controller?.abort();
      location.reload();
    },
  });
  owner.continueRoot = root;
  root.dataset.test = test("defeat");
  root.querySelector(".go-retry").dataset.test = test("continue-retry");
  // 世界大会の負けを読んだ直後だけ、色が抜けて煙が途切れる入り（#2688 A19）
  const fade = (fresh && await defeatFade()) || (async () => {});
  if (!current(owner)) { await fade(); return; }
  showScreen("end", root);
  await fade();
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
  card(owner, "complete", "第四章・完", chapterFourRecap(state), [
    next,
    button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
    button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
  ], "第五章・機械仕掛けの神へ進めます。", "",
  // 第1章と同じ比較。固定の祝福では能力を足さず、実際に伸びた分だけを重ねる。
  el("div.end-radar", { dataset: { test: test("growth") } }, [
    chapterGrowthChart(state, 300),
    el("p", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
  ]));
}

function renderError(owner) {
  card(owner, "error", "第4章を再開できませんでした", "通信と保存地点を確認して、もう一度お試しください。読み終えた場面から再開できます。", [
    button(owner, "もう一度読み込む", "retry", () => state.chapter === 4 ? resumeChapterFour() : beginChapterFour(), true),
  ]);
}

