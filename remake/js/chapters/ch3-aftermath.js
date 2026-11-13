// 全国大会の勝利後。結果発表は大会ランナーが読了・保存し、ここでは再生しない。
import { DB, bgUrl, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { chapterDay } from "../core/chapter-clock.js";
import { layers, showScreen, setBg, enterScene, modal, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";
import { playBgm } from "../core/audio.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { onDialogueEnter } from "../daily/romance.js";
import { AGEHA_CONFESSION_SCENES, agehaConfessionDue, beginAgehaConfessionDay, confessionAnswer } from "./ch3-romance-entry.js";
import { chapterGrowthChart } from "../daily/status.js";
import { shinkansenRide } from "../core/scene-motions.js";
import { syncTokyoVisits } from "../core/tokyo-visits.js";
import { growthLesson } from "../core/growth-effects.js";
import { awardChapterClearExp, readyLessons, consultLessons } from "../core/growth.js";
import { chapterGrowthNight } from "../core/chapter-growth.js";
import { chapterThreePartyGuests } from "./ch3-party-progress.js";
import { finaleDue, playFinale } from "../daily/bonds.js";
import { CH3_AFTERMATH_SCENES, CH3_AFTERMATH_DETOURS, CH3_AFTERMATH_FINALES, canRunChapterThreeAftermath, beginChapterThreeAftermath,
  chapterThreeAftermathProgress, completeChapterThreeAftermathScene, availableAftermathDetours,
  completeAftermathDetour, availableAftermathLessons, availableAftermathFinales } from "./ch3-aftermath-progress.js";

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

function card(owner, name, title, description, actions = [], note = "", sceneId = "", extra = []) {
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  showScreen("ch3-aftermath", el("main.ch2-contest", { dataset: { test: test(name), scene: sceneId } }, [
    el("header.ch2-contest-header", [
      el("div", [el("p", { text: "第三章 ／ 嘘つきたちの夜" }), el("h1", { text: title })]),
      menuButton(owner),
    ]),
    el("p.ch2-contest-description", { text: description }),
    note ? el("p.ch2-contest-note", { text: note }) : null,
    ...extra,
    el("div.ch2-contest-actions", [...actions, ...(name !== "error" ? [
      button(owner, "LIME・地元との連絡", "lime", async () => {
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
  const owner = session = { state, growthDay: state.day, active: true, busy: false, menuBusy: false, controller: null };
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
    if (!state.flags._ch3_cleared || agehaConfessionDue(state)) {
      // 再会の後の帰り際（#1930）。返事の場面まで揃えてから入口を出す。
      const confession = await readDialogues("confession", AGEHA_CONFESSION_SCENES);
      if (!live(owner)) return;
      Object.assign(DB.dialogues, Object.fromEntries(AGEHA_CONFESSION_SCENES.map(id => [id, confession[id]])));
    }
    if (!live(owner)) return;
    if (!state.flags._ch3_cleared) await loadDetours(owner);
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

/** 大会後の寄り道と締めくくり（IR22）の台本（#2028 残件3）。ファイルごとに読み、欠けていれば後日談の再開を止める。 */
async function loadDetours(owner) {
  const scripts = [...CH3_AFTERMATH_DETOURS, ...CH3_AFTERMATH_FINALES.map(entry => ({ id: entry.dialogue, file: entry.file }))];
  const files = [...new Set(scripts.map(scene => scene.file))];
  for (const file of files) {
    const ids = scripts.filter(scene => scene.file === file).map(scene => scene.id);
    if (ids.every(id => DB.dialogues[id]?.lines?.length)) continue;
    const dialogues = await readDialogues(file, ids);
    if (!live(owner)) return;
    Object.assign(DB.dialogues, Object.fromEntries(ids.map(id => [id, dialogues[id]])));
  }
}

/** 東京にいる間の場面カードに、大会後の寄り道の入口を出す。読んでも日時は進まない。 */
function detourActions(owner) {
  const count = availableAftermathDetours(state).length + availableAftermathLessons(state, readyLessons).length
    + availableAftermathFinales(state, finaleDue).length;
  return count ? [button(owner, `寄り道をする（${count}）`, "detour-open", () => renderDetours(owner))] : [];
}

async function renderDetours(owner) {
  if (!live(owner)) return;
  const scenes = availableAftermathDetours(state);
  const lessons = availableAftermathLessons(state, readyLessons);
  const finales = availableAftermathFinales(state, finaleDue);
  if (!scenes.length && !lessons.length && !finales.length) { await renderStage(owner); return; }
  card(owner, "detour", "寄り道", "帰る前に、立ち寄れる場所がある。読んでも、予定は進まない。", [
    // ♥5の締めくくり（IR22）。大会前の来店で読めなかった時だけ、帰る前に一度
    ...finales.map(entry => button(owner, `${entry.label}（${entry.place}）`, `finale-${entry.who}`,
      () => readAftermathFinale(owner, entry.who))),
    ...scenes.map(scene => button(owner, `${scene.label}（${scene.location}）`, `detour-${scene.id}`,
      () => readDetour(owner, scene.id))),
    // 心得の盤で灯した授業を、東京にいるうちにその人へ相談する（SPEC 2.6・SBD61）
    ...lessons.map(entry => button(owner,
      `${entry.place}で${displayName(entry.who, state)}に相談する（${entry.lessons.map(lesson => lesson.name).join("・")}）`,
      `lesson-${entry.who}`, async () => {
        await consultAftermathLesson(owner, entry.who);
        if (live(owner)) await renderStage(owner);
      })),
    button(owner, "戻る", "detour-back", () => renderStage(owner)),
  ], "読んだ場面は、あとから読み返せません。");
}

async function readDetour(owner, id) {
  // 押した時点で条件を引き直す。古い画面・二重クリックで再読しない。
  const scene = availableAftermathDetours(state).find(item => item.id === id);
  if (scene && !await readScene(owner, scene)) return;
  if (scene && completeAftermathDetour(state, id)) save();
  // 鉄の煙の寄り道を読んだその場で、灯した授業をヴォルクに相談する（大会前の寄り道の鉄の煙と同じ）
  if (scene?.location === "鉄の煙" && live(owner)) await consultAftermathLesson(owner, "volk");
  await renderStage(owner);
}

/**
 * 大会後の締めくくり（IR22）。条件・記録・贈り物は daily/bonds.js（一度だけ。中断・LOADでは何も残さない）。
 * 寄り道と同じく stage・日時は進めない。
 */
async function readAftermathFinale(owner, who) {
  // 押した時点で条件を引き直す。古い画面・二重クリックで再読しない。
  const entry = availableAftermathFinales(state, finaleDue).find(item => item.who === who);
  if (!entry || !live(owner)) return;
  const scene = CH3_AFTERMATH_SCENES[chapterThreeAftermathProgress(state).stage];
  const background = bgUrl(entry.bg, scene?.slot ? "night" : "day");
  await enterScene(background);
  if (!live(owner)) return;
  showScreen("none", null);
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  const controller = owner.controller = new AbortController();
  try { await playFinale(who, { bg: background, signal: controller.signal }); }
  finally { if (owner.controller === controller) owner.controller = null; }
  if (live(owner)) await renderStage(owner);
}

/**
 * 大会後の東京で、灯した授業をその場にいる人に相談する（無料・寄り道と同じく stage・日時は進めない）。
 * 会話中は場面と同じく HUD を隠す。LOAD・ページ離脱で owner.controller を止めると相談も止まる（習得は完読した時だけ）。
 */
async function consultAftermathLesson(owner, who) {
  // 押した時点で条件を引き直す。古い画面・二重クリック・相談済みでは何もしない。
  const entry = availableAftermathLessons(state, readyLessons).find(item => item.who === who);
  if (!entry || !live(owner)) return;
  const scene = CH3_AFTERMATH_SCENES[chapterThreeAftermathProgress(state).stage];
  const background = bgUrl(entry.bg, scene?.slot ? "night" : "day");
  await enterScene(background);
  if (!live(owner)) return;
  showScreen("none", null);
  layers.hud.replaceChildren();
  layers.hud.classList.remove("show");
  const controller = owner.controller = new AbortController();
  try { await consultLessons(who, { bg: background, signal: controller.signal }); }
  finally { if (owner.controller === controller) owner.controller = null; }
}

async function readScene(owner, scene) {
  const result = await playScene(owner, scene);
  return live(owner) && !!result && !result.cancelled;
}

/**
 * 新幹線で帰る場面か。帰郷の夜を読みかけの版3の保存（読み終えた場面が skip にある）は、もう地元にいるので出さない。
 * 告白の場面などの後日談の外の場面には homecoming が無い。
 */
function homecomingRide(scene) {
  return !!scene.homecoming && !chapterThreeAftermathProgress(state).skip?.length;
}

async function playScene(owner, scene) {
  const source = DB.dialogues[scene.id];
  if (!source) throw new Error(`台本がありません: ${scene.id}`);
  if (homecomingRide(scene)) {
    // 東京→地元の復路。帰郷した夜の最初の場面へ入る直前だけ新幹線の車窓を見せる（#1059）。
    await shinkansenRide(async () => { await setBg(scene.bg ? bgUrl(scene.bg) : null, { instant: true }); },
      { from: "tokyo", to: "home" });
  } else {
    await enterScene(scene.bg ? bgUrl(scene.bg) : null);
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
  return result;
}

/**
 * あげはの告白（#1930・#1988・台本は IR20 の正式原稿。条件は ch3-romance-entry.js: ♥3の分岐で恋愛寄り・♥5の保存だけ）。
 * 再会の翌日、もう一度店を訪ねた帰り際に、あげはから言葉にする（台本の「練習の続き」が再会の「言う練習中」を受ける）。
 * 返事（付き合う／友達のまま）を読み終えた時だけ関係を確定し、中断したらこの場面からやり直す。着地するまで第4章へは進めない。
 * 昼に寄って暗くなるまでいた帰り際なので、時計は昼のまま、背景は店の裏の夜の通り（台本の地の文と一枚絵 cg_ageha_confession に合わせる）。
 */
function renderAgehaConfession(owner) {
  if (beginAgehaConfessionDay(state)) { syncTokyoVisits(state); save(); }
  card(owner, "ageha-confession", `DAY ${chapterDay(state)}・昼 ／ 帰り際`, "翌日、もう一度MELTY PUFFに寄った。帰り際、あげはに呼び止められた。", [
    button(owner, "続きを読む", "ageha-confession-continue", async () => {
      const result = await playScene(owner, { id: "confession_ageha", bg: "bg_street_night" });
      if (!live(owner) || !result || result.cancelled) return;
      const answer = confessionAnswer(result.visited, "ageha");
      if (!answer) return;
      onDialogueEnter(answer, DB.dialogues[answer]);
      save();
      await renderStage(owner);
    }, true),
  ], "帰郷してから", "confession_ageha");
}

async function renderStage(owner) {
  if (!live(owner)) return;
  if (!await chapterGrowthNight(owner, () => live(owner))) return;
  const progress = chapterThreeAftermathProgress(state);
  const scene = CH3_AFTERMATH_SCENES[progress.stage];
  if (scene?.id === "ch3_naru_reconcile" && state.flags._ch3_naru_party_ready) {
    const actions = [];
    if (chapterThreePartyGuests(state).length >= 2) actions.push(button(owner, "ピザとシーシャの夜を開く", "party", async () => {
      const { openChapterThreeParty } = await import("./ch3-party.js");
      if (!live(owner)) return;
      const controller = owner.controller = new AbortController();
      try { await openChapterThreeParty({ signal: controller.signal, isCurrent: () => live(owner) }); }
      finally { if (owner.controller === controller) owner.controller = null; }
      if (live(owner)) await renderStage(owner);
    }, true));
    actions.push(button(owner, "翌朝へ進む", "party-next", async () => {
      if (!completeChapterThreeAftermathScene(state, scene.id)) return;
      save(); await renderStage(owner);
    }, !actions.length));
    await enterScene(bgUrl("bg_mukai_shop", "night"));
    if (!live(owner)) return;
    card(owner, "party-night", `DAY ${chapterDay(state)}・夜 ／ 帰郷の前に`,
      state.flags._ch3_pizza_party ? "仲間と過ごした夜の話を胸に、明日の帰り支度をする。"
        : "なるへの報告は終わった。スティーブに教わった夜を、東京にいる仲間と開ける。",
      actions, "開催できるのは、この夜に予定が重ならない、前回と違う仲間が2人以上いる時です。");
    return;
  }
  if (!scene) {
    // 第3章の最後は帰郷の客の場面（tonari・STK23）。あげはの告白は翌日の場面カードから。
    await enterScene(bgUrl("bg_tonari_inside_night"));
    if (!live(owner)) return;
    // 恋愛ルート（♥3で恋愛寄り・♥5）だけ、再会の翌日に告白へ。それ以外は再会のまま第3章完（#1988）。
    if (agehaConfessionDue(state)) { renderAgehaConfession(owner); return; }
    // 第3章側の第4章への接続点はここ1か所（状態遷移は ch4-progress.js の advanceToChapterFour）。
    const next = button(owner, "第4章へ進む", "chapter-four", async () => {
      const mod = await withLoadingNotice(import("./ch4.js"), loadingNotice("第4章のドバイへ向かっています…"));
      await mod.beginChapterFour();
    }, true);
    card(owner, "complete", "第三章・完", "全国大会を終え、帰る場所にも新しい約束ができた。", [
      next,
      button(owner, "ここまでをセーブ", "complete-save", () => saveFlow(), true),
      button(owner, "タイトルへ", "complete-title", () => { save(); location.reload(); }),
    ], "第四章・ドバイ編へ進めます。", "", [
      // 第1・2章のクリア画面と同じ成長レーダー（#1658 ⑫）。淡い面が章のはじめ、明るい面がいま。
      el("div.ch2-contest-growth", { dataset: { test: test("growth") } }, [
        chapterGrowthChart(state, 220),
        el("p.ch2-contest-note", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
      ]),
    ]);
    return;
  }
  // 帰郷の夜(#1059)は、新幹線の車窓が覆うまで東京側の背景のままにし、地元の店を先見せしない。
  const preBg = homecomingRide(scene) ? "bg_mukai_shop" : scene.bg;
  await enterScene(preBg ? bgUrl(preBg) : null);
  if (!live(owner)) return;
  card(owner, "scene", `DAY ${chapterDay(state)}・${scene.slot ? "夜" : "昼"} ／ ${scene.label}`,
    `${scene.location}で、次の話を聞く。`, [
    button(owner, "続きを読む", "continue", async () => {
      if (!await readScene(owner, scene)) return;
      if (scene.id === "ch3_naru_reconcile" && growthLesson(state, "M-S5")) {
        state.flags._ch3_naru_party_ready = true;
        save(); await renderStage(owner); return;
      }
      if (!completeChapterThreeAftermathScene(state, scene.id)) return;
      if (state.flags._ch3_cleared) awardChapterClearExp();
      save();
      await renderStage(owner);
    }, true),
    ...detourActions(owner),
  ], scene.dayAfterWin === 0 ? "全国大会の夜" : scene.dayAfterWin === 1 ? "全国大会の翌日" : "帰郷してから", scene.id);
}

function renderError(owner) {
  card(owner, "error", "第3章の後日談を再開できませんでした", "通信を確認してください。ページを読み直し、直前のオートセーブから再開します。", [
    button(owner, "もう一度読み込む", "retry", () => {
      // importの失敗は文書内でキャッシュされる。同じURLの再importでは復帰できない。
      // 途中のstateは保存せず、最後に正常完了したcheckpointから新しい文書で再開する。
      owner.active = false;
      owner.controller?.abort();
      requestResumeOnBoot();
      location.reload();
    }, true),
  ]);
}
