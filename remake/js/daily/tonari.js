import { floorShiftBasePay, floorShiftPay, FLOOR_COMMISSION_PERCENT } from "../core/shift-pay.js";
import { CHARM_BONUS } from "../core/stat-step-tables.js";
import { chapterFeatureEnabled } from "../core/chapter-features.js";
import { callingSalesBonus, growthSkill, SKILL_TUNING } from "../core/growth-effects.js";
import { on } from "../core/bus.js";
import { staffFlavors, staffStock } from "../core/flavor-mastery.js";
// tonari（バイト先）: 客として一服／シフトに入る（昼から夜まで店番＝フロア営業→シフト後にスミさん）。
// シーシャ作りの練習は店の練習イベントで行う（#783）。chooseDrill は第1章の準備イベントで使う。
import { el } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, retire } from "../core/ui.js";
import { state, timeOfDay, config } from "../core/state.js";
import { addMoney, addStamina, applyStats, step, currentCondition, affinityLevel } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { play, dialogueSequence } from "../vn/engine.js";
import { visitChar, hasNewStory } from "./spots.js";
import { hearFortuneRumor } from "./fortune-rumor.js";
import { DRILLS } from "../craft/session.js";
import { isRainy } from "./weather.js";
import { shiftClose } from "../core/scene-motions.js";
import { meetHiyoriAtTonari } from "./hiyori.js";
import { hiyoriAxeReady, hiyoriAxeAffordable, hiyoriAxePrereqsMet, axeThrowExposed } from "./hiyori-axe.js";
import { spotFollowupDue } from "./spot-encounters.js";
import { canStudyAttack, studyAttack } from "./attack-lesson.js";
import { readyLessons, consultLessons } from "../core/growth.js";
import { canStudyCubeCoals, studyCubeCoals } from "./coal-lesson.js";
import { tsumugiAtTonari } from "./tsumugi-schedule.js";
import { bondAfterNext, markBondAfterRead, loadBondAfterScenes } from "../core/bond-after.js";

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";
// カードゲーム「一台勝負」の入口の切替（ICG12）。入・切は daily/ichidai-table.js が起動時に端末へ書き、ここは読むだけにする
// （このメニューの取り込みを増やさない。既定で出すと決まったら、この2つの関数ごと外す）。
const ichidaiOn = () => { try { return globalThis.localStorage?.getItem("suien_ichidai") === "1"; } catch { return false; } };
const ichidaiNote = () => {
  const r = state.ichidai, n = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  return n(r?.plays) ? `スミさんと卓を囲む。時間は進まない。${n(r.wins)}勝${n(r.losses)}敗` : "スミさんと卓を囲む。時間は進まない";
};

/** tonari に入ったときのサブメニュー。戻るなら null */
// ch2-story-data.js の strawberryTrialReady と同じ条件。日常の共通画面へ第2章の台本データを読み込ませない。
const strawberryTrialOpen = () => state.chapter === 2 && !!state.flags._ch2_read_remake_ch2_ageha_tasting
  && !state.flags._ch2_strawberry_trial && !!DB.dialogues.ch2_strawberry_trial_intro?.lines?.length;

// バイト（2026-11-25 オーナー「最近追加した接客ゲームを本編に組み込んで　バイトに出るとあれが始まる形にする　ちなみにあれは昼から始めて2コマ使う」
// 「既存のバイトシステムは廃止」・TFL62・63）: シフトに入ると、昼から夜まで店番（フロア営業・tonari-floor-*.js）で、注文（気分に合うミックスを選ぶ）・
// 炭の調整・ケア・会計を一人で回す。入れるのは昼だけで、昼と夜の2コマを使う（calendar.js）。日当は章ごとの基本給に売上歩合と手当が付く。
// はじめての店番の前に、スミさんの前振りとチュートリアル（TFL64）。いつものシフト（抽選の接客と「今日の注文」）は無くした。
/** 店番が使う行動の枠（昼と夜）。 */
export const SHIFT_SLOTS = 2;
/** 店番の体力（昼から夜まで立つ）。 */
export const SHIFT_STAMINA = 40;
/** シフトに入れるか（昼からだけ。夜からは入れない）。 */
export const shiftOpen = (s = state) => s.slot === 0;
const shiftPayText = () => `基本給${floorShiftBasePay(state.chapter).toLocaleString("ja-JP")}円＋売上の${FLOOR_COMMISSION_PERCENT}%`;
function shiftNote(forecast = "", stamp = "") {
  const manager = state.chapter >= 5;
  const what = manager ? "昼から夜まで、今日の営業を引き受ける（2コマ）。仕事終わりにはスミさんと話せる"
    : "昼から夜まで、五つの卓を一人で回す（2コマ）。上がったあとはスミさんと話せる";
  const head = floorProgress().nights ? (forecast ? `今日の予報：${forecast}。` : "") : "【はじめての店番】";
  return `${head}${what}。${shiftPayText()}${stamp ? `（これまでの最高：${stamp}）` : ""}`;
}
// シフト上がりのスミさんの話は、夜の店で読む（店番は昼から夜まで）。勤務札の「新しい話」も、夜に読めるかで見る（照会だけ。時間帯は戻す）
function sumiStoryAfterShift() {
  const slot = state.slot;
  try { state.slot = Math.max(slot, 1); return hasNewStory("sumi"); } finally { state.slot = slot; }
}
/** 勤務札の予報と最高の評価は、フロアの台本を読めてから足す（このメニューの取り込みは増やさない。読めなければ出さないだけ）。 */
async function fillFloorForecast(card, prefix = "") {
  const owner = state;
  const { nights, best } = floorProgress();
  if (!card || !nights) return;
  try {
    const [{ pickNight }, { RANKS }] = await Promise.all([import("./tonari-floor-model.js"), import("./tonari-floor-data.js")]);
    if (state !== owner) return; // 入店の幕の間はまだ画面に載っていないので、載っているかは見ない
    const night = pickNight(nights, shiftSeed(), { rainy: isRainy(), daytime: true });
    const note = card.querySelector("small");
    if (note && !card.disabled) note.textContent = `${prefix}${shiftNote(night.forecast, RANKS.find((r) => r.id === best)?.stamp || "")}`;
  } catch { /* 予報なしの札のまま */ }
}

export function tonariMenu({ talks = [] } = {}) {
  return new Promise((resolve) => {
    setBg(bgUrl(TONARI_BG, timeOfDay()), { fast: true });
    playBgm("tonari");
    const tsumugiKnown = !!(state.met.tsumugi || state.flags._met_tsumugi || (state.story.tsumugi || 0) > 0);
    const tsumugiPresent = tsumugiAtTonari(state);
    const manager = state.chapter >= 5;
    const customerStory = state.visitedDay.tonari_customer !== state.day && tsumugiPresent && hasNewStory("tsumugi");
    const shiftStory = state.visitedDay.tonari_baito !== state.day && sumiStoryAfterShift();
    const pickIt = (value) => { retire(root); resolve(value); };
    // 今日もう済ませた行動は押せない札にして理由を見せる（押すとメニューが閉じて地図へ戻っていた・#3555）。
    // 体力の消費は数字で見せない（ゲージでなんとなく把握するゲーム性・MAP04）。
    const today = state.visitedDay;
    const makanaiDone = today.tonari_practice === state.day || today.tonari_strawberry === state.day;
    const DONE = {
      customer: today.tonari_customer === state.day ? "今日はもう客席で一服した" : null,
      // シフトは昼から夜まで（2コマ）。夜からは入れない（TFL62）
      baito: today.tonari_baito === state.day ? "今日のシフトはもう終わった" : !shiftOpen() ? "シフトは昼から入る。夜からは入れない" : null,
      strawberry: makanaiDone ? "今日はもうまかないで練習した" : null,
    };
    const opt = (title, desc, value, test) => {
      const done = DONE[value] || null;
      return el(`button.big-choice${done ? ".done" : ""}`, { dataset: { test }, disabled: !!done || (value === "hiyori_axe" && !hiyoriAxeAffordable()),
        onclick: () => { SE.select(); pickIt(value); } }, [
        // 済んだ行動も、店の様子（つむぎがいる 等）の説明は残し、その後ろに理由を添える。
        el("b", { text: title }), el("small", { text: done ? `${desc} ── ${done}` : desc }),
      ]);
    };
    const shiftNew = shiftStory ? "【新しい話（シフト後）】" : "";
    const shiftCard = opt(manager ? "店長として店に立つ" : "シフトに入る（バイト）", `${shiftNew}${shiftNote()}`, "baito", "tonari-baito");
    fillFloorForecast(shiftCard, shiftNew);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "tonari" }),
      el("p.sub-lead", { text: manager ? "店長として任されたtonari。出かける時は、人手に合わせてスミさんが店に立ってくれる。今日はどうする？" : state.slot === 0 ? "昼のtonari。窓際でスミさんが道具を整えている。今日はどうする？" : "夜のtonari。客席から常連の笑い声が聞こえる。今日はどうする？" }),
      el("div.sub-choices", [
        opt("お客さんとして一服", `${customerStory ? "【新しい話】" : ""}${!tsumugiPresent ? "客席でゆっくり一服する"
          : manager ? "客席でゆっくり。つむぎが接客をしている" : tsumugiKnown ? "客席でゆっくり。常連席にはつむぎがいる" : "客席でゆっくり。常連席にはいつもの子がいる"}`, "customer", "tonari-customer"),
        // #2213 B04: 「まかないで練習」はシフト上がりのメニューへ移した（独立の行動にしない）
        // #1650: 第2章の試煙会のあと、一度だけ。試供品の苺で熱を確かめ、スミさんに吸ってもらう
        strawberryTrialOpen() ? opt("苺を試す（まかない）", "体力を使う・1行動。試煙会の苺で一台。確かめるのは熱だけ", "strawberry", "tonari-strawberry") : null,
        shiftCard,
        ...talks.map(({ id, label }) => opt(label, "1行動。体力は使わない", id, id)),
        hiyoriAxeReady() && axeThrowExposed() ? opt("ひよりと斧投げへ", hiyoriAxeAffordable()
          ? "夜の寄り道。参加3000円・体力を使う・行動1回。3投を一緒に楽しむ"
          : "参加には3000円と体力が必要。先にLIMEの約束を済ませよう", "hiyori_axe", "tonari-hiyori-axe") : null,
        // カードゲーム「一台勝負」（ICG12）。時間・お金・体力を使わない。?ichidai=1 で入れた端末にだけ出す
        ichidaiOn() ? opt("カードで一勝負（一台勝負）", ichidaiNote(), "ichidai", "tonari-ichidai") : null,
      ]),
      el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "sub-back" }, onclick: () => { SE.cancel(); pickIt(null); } }),
    ]));
  });
}

const customerVisits = new WeakSet();
export async function tonariCustomer({ signal = null } = {}) {
  const owner = state;
  if (customerVisits.has(owner) || signal?.aborted) return false;
  customerVisits.add(owner);
  try {
    const live = () => state === owner && !signal?.aborted;
    addStamina(-16);
    const greeting = await play(state.slot === 0 ? "venue_tonari_day" : "venue_tonari_night", { bg: TONARI_BG, signal });
    if (!live() || !greeting || greeting.cancelled) return false;
    // 出発前のひよりの送り出し（#3097 PR-I）は、つむぎの新しい話を読む来店では次の対面へ残す（一来店に一本）
    await meetHiyoriAtTonari({ prepTalk: !(tsumugiAtTonari(state) && hasNewStory("tsumugi")) });
    if (!live()) return false;
    if (tsumugiAtTonari(state)) {
      if (!await visitChar("tsumugi") || !live()) return false;
      await consultLessons("tsumugi", { bg: TONARI_BG }); // 心得の盤で灯した授業があれば相談する（SBD50）
      if (!live()) return false;
      if (!await hearFortuneRumor({ signal }) || !live()) return false;
    }
    return live();
  } finally { customerVisits.delete(owner); }
}

// ---------------------------------------------------------------- バイト

const CALLED_BONUS = 5000; // スミさんに急に呼ばれた日の上乗せ（店からの給料。チップではない）
const activeShifts = new WeakSet();

/** @param opts.called スミさんのLIMEで急に呼ばれたシフト（給料に上乗せ）
 *  @param opts.story 開店前に読む本編の場面（常連さんの話）。読んだらその場面IDを返す */
export async function doBaito({ called = false, story = null } = {}) {
  const owner = state;
  if (activeShifts.has(owner)) return false;
  activeShifts.add(owner);
  const controller = new AbortController();
  const off = on("hud", () => { if (state !== owner) controller.abort(); });
  const slot = owner.slot;
  let done = false;
  try {
    done = await dialogueSequence(() => baitoShift({ called, story, owner, signal: controller.signal }));
    return done;
  } finally {
    // 店番の後は夜（上がりの会話・スミさんとの話は夜の店）。途中で止まった時は、出勤前の時間帯に戻す
    if (!done && state === owner) owner.slot = slot;
    off(); controller.abort(); activeShifts.delete(owner);
  }
}

async function baitoShift({ called, story, owner, signal }) {
  const current = () => state === owner && !signal.aborted;
  const read = async (scene, opts) => {
    const result = await play(scene, { ...opts, signal });
    return current() && !result?.cancelled;
  };
  // 体力は昼の分と夜の分に分けて減る。仕上げの調子（好調・不調）は、昼の分を引いた時の体力で決め、そのシフト中は固定
  addStamina(-SHIFT_STAMINA / 2);
  const condition = currentCondition();
  const shiftKey = `${owner.chapter}:${owner.day}:${owner.slot}`;
  const callingBonus = owner.flags._minto_calling_paid === shiftKey ? 0 : callingSalesBonus(owner, condition);
  playBgm("tonari");
  state.baitoCount = (state.baitoCount || 0) + 1;
  state.lastBaitoDay = state.day;
  if (!await read("remake_baito_start", { bg: TONARI_BG })) return false;
  // はじめての店番: スミさんの前振り（老舗で混む店・大会とは別の競技）と、横についてのチュートリアル（TFL64）。
  // 店長として立つ第5章は前振りを読まない（チュートリアルは開店前の札から選べる）。
  const first = !floorProgress(owner).nights;
  const manager = owner.chapter >= 5;
  if (!manager && !await read(first ? "tonari_floor_first" : "tonari_floor_start", { bg: TONARI_BG })) return false;
  if (first && !manager && !owner.flags._tonari_floor_tutorial) {
    if (!await floorTutorial(owner, signal) || !current()) return false;
  }
  await meetHiyoriAtTonari();
  if (!current()) return false;
  // 本編の常連の話（#2213 B02）を開店前に読んだ日は、カメオを重ねない
  const storyId = story ? await story() : null;
  if (!current()) return false; // 本編の場面の途中で LOAD した時は、ここで止める
  const n = state.baitoCount;
  // 正体を伏せた客が一度だけ混ざる（後の章・大会当日で回収される伏線）
  if (!storyId && chapterFeatureEnabled(state.chapter, "baitoCameos")) {
    if (n >= 2 && !state.flags._ev_kuraudo_cameo) {
      if (!await read("ch1_kuraudo_cameo", { bg: TONARI_BG })) return false;
      state.flags._ev_kuraudo_cameo = true;
    } else if (n >= 3 && state.day >= 4 && !state.flags._ev_reviewer_cameo) {
      if (!await read("ch1_reviewer_cameo", { bg: TONARI_BG })) return false;
      state.flags._ev_reviewer_cameo = true;
    } else if (n >= 4 && state.day >= 6 && !state.flags._ev_uezono_cameo) {
      if (!await read("ch1_uezono_cameo", { bg: TONARI_BG })) return false;
      state.flags._ev_uezono_cameo = true;
    }
  }
  if (!current()) return false;
  const extra = called ? CALLED_BONUS : 0;
  let shiftAllowances;
  const getAllowances = () => {
    if (shiftAllowances) return shiftAllowances;
    const bonus = Math.round(CHARM_BONUS[step("charm") - 1] * condition.bonusRate);
    const basePay = floorShiftBasePay(owner.chapter);
    // 仕事が早い（心得の盤のスキル K27。SBD154）: 基本の日当の1割を上乗せ
    const quickPay = growthSkill(owner, "K27") ? Math.round(basePay * SKILL_TUNING.baitoPay) : 0;
    shiftAllowances = { bonus, quickPay, total: bonus + extra + condition.shiftBonus + callingBonus + quickPay };
    return shiftAllowances;
  };
  // 精算までに取得したスキルを手当に反映し、画面と入金で同じ手当を使う。
  const floorNight = await serveFloor(owner, signal, () => getAllowances().total);
  if (!floorNight || !current()) return false;
  owner.slot = Math.max(owner.slot, 1); // 日が暮れた。ここからの場面（上がり・スミさん・授業）は夜の店
  addStamina(-SHIFT_STAMINA / 2); // 夜の分
  await setBg(bgUrl(TONARI_BG, timeOfDay()), { fast: true });
  if (!current()) return false;
  if (callingBonus && !await read("baito_minto_calling", { bg: TONARI_BG })) return false;
  const { bonus, quickPay, total: allowances } = getAllowances();
  const pay = floorShiftPay(owner.chapter, floorNight.sales, allowances);
  await shiftClose();
  const closing = state.chapter >= 5 ? { lines: [
    { speaker: "", face: "", text: "今日の仕事を終えて、手取りを帳面に記した。" },
    { speaker: "", face: "", text: "片付けの手伝いに来たスミさんが、カウンターの内側へ回る。" },
  ] } : "remake_baito_end";
  if (!current() || !await read(closing, { bg: TONARI_BG })) return false;
  if (called && !await read("remake_sumi_call_thanks", { bg: TONARI_BG })) return false;
  addMoney(pay.total);
  const allowanceNote = pay.allowances ? `＋手当${pay.allowances.toLocaleString("ja-JP")}円` : "";
  toast(`シフトの日当 +${pay.total.toLocaleString("ja-JP")}円（基本給${pay.base.toLocaleString("ja-JP")}円＋歩合${pay.commission.toLocaleString("ja-JP")}円${allowanceNote}）`, { kind: "good" });
  if (callingBonus) owner.flags._minto_calling_paid = shiftKey; // 同じ行動枠の再開・再入力で上乗せを重ねない。
  if (callingBonus) toast(`呼び込みの手当 +${callingBonus.toLocaleString("ja-JP")}円`, { kind: "good" });
  if (bonus) toast(`指名ボーナス（魅力）+${bonus.toLocaleString("ja-JP")}円`, { kind: config.statEffectColors !== false ? "charm-bonus" : "good" });
  if (extra) toast(`急なシフトの上乗せ +${extra.toLocaleString("ja-JP")}円`, { kind: "good" });
  if (condition.shiftBonus) toast(`仕上げは好調。手当 +${condition.shiftBonus.toLocaleString("ja-JP")}円`, { kind: "good" });
  if (quickPay) toast(`仕事が早い。基本の日当の上乗せ +${quickPay.toLocaleString("ja-JP")}円`, { kind: "good" });
  if (condition.health === "red" && (bonus > 0 || callingBonus > 0)) {
    toast("疲れで仕上げが不安定。指名・呼び込みのボーナスは半額", { kind: "warn" });
  }
  // 基礎成長は訪問と同じ4。接客・片付けの両方を経験する。
  applyStats({ technique: 2, charm: 2 });
  if (!await afterShiftErrand(owner, signal) || !current()) return false;
  return await afterShift(owner, signal) && current();
}

/** 店の受け取りは実際のシフト後だけ。旧DAY4の既読記録もそのまま使う。 */
async function afterShiftErrand(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  if (!current()) return false;
  if (!chapterFeatureEnabled(state.chapter, "baitoCameos") || state.day < 4 || state.flags._ev_ageha_cameo
    || !DB.dialogues.ch1_ageha_encounter) return true;
  const result = await play("ch1_ageha_encounter", { signal });
  if (!current() || result?.cancelled) return false;
  owner.flags._ev_ageha_cameo = true;
  await setBg(bgUrl(TONARI_BG, timeOfDay()), { fast: true });
  return current();
}

/** シフト後: スミ会話（必須）のあと、授業か練習を一つ選ぶ。 */
function afterShiftMenu(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  if (!current()) return false;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      settled = true;
      signal.removeEventListener("abort", abort);
      if (value === false) root.remove();
      else retire(root);
      resolve(value);
    };
    const abort = () => finish(false);
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, onclick: () => { if (!settled && current()) { SE.select(); finish(value); } } }, [el("b", { text: title }), el("small", { text: desc })]);
    const choices = [
      canStudyAttack() ? opt("蒸らしアタックの授業を受ける", "スミさんと蒸らしアタックを練習する", "attack", "after-attack") : null,
      canStudyCubeCoals() ? opt("キューブ炭の授業を受ける", "スミさんと火の違いを確かめる", "cube_coals", "after-cube-coals") : null,
      // 心得の盤で灯した授業: スミさんに相談して話を聞く（SBD50）
      ...readyLessons("sumi").map((l) => opt(`スミさんに相談する（${l.name}）`, "授業。話を聞いて習得する", `lesson:${l.id}`, `after-lesson-${l.id}`)),
      makanaiOpen() ? opt("まかないで練習", `空いた台で一台作る。今日の葉：${staffFlavors(state).map(id => `${DB.flavorById?.[id]?.short_name || id} ${staffStock(state, id)}g`).join("、")}。私物も使える`, "makanai", "after-makanai") : null,
    ].filter(Boolean);
    if (!choices.length) { resolve("none"); return; }
    const root = el("div.sub-menu", [
      el("h2.sub-title", { text: "シフト上がり" }),
      el("p.sub-lead", { text: "シフト上がりにできるのは1つだけ。" }),
      el("div.sub-choices", [
        ...choices,
        opt("まっすぐ上がる", "今日はここまで", "none", "after-none"),
      ]),
    ]);
    signal.addEventListener("abort", abort, { once: true });
    showScreen("tonari", root);
  });
}

// 旧セーブの苺専用記録も、同じ日のまかないとして扱う。
const makanaiOpen = () => state.visitedDay?.tonari_practice !== state.day && state.visitedDay?.tonari_strawberry !== state.day;

/** #2213 B04: まかないの練習はシフトの中で選んだ日だけ。熟練度は旧・独立コマンドと同じ runner で育つ。
 * 行動枠・行動の体力・行動の学びはシフトの分だけで、旧・独立コマンドの分を重ねない。 */
async function makanaiPractice(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  if (!current()) return false;
  owner.visitedDay.tonari_practice = owner.day;
  const result = await play("remake_staff_practice", { bg: TONARI_BG, signal });
  if (!current() || result?.cancelled) return false;
  const { runFullPractice } = await import("../craft/practice.js");
  if (!current()) return false;
  // LOAD で作業台が外れたとき、操作待ちの工程が残ってもシフトの待機は解く。
  let abort;
  const interrupted = new Promise((resolve) => {
    abort = () => resolve(false);
    signal.addEventListener("abort", abort, { once: true });
  });
  let cs;
  try {
    cs = await Promise.race([interrupted, runFullPractice({ kind: "self", staffPractice: true, isCurrent: current })]);
  }
  catch (error) {
    if (!current() && error?.name === "AbortError") return false;
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
  if (!current()) return false;
  if (cs?.masteryGained) toast("使ったフレーバーの熟練度が育った。持ち物で確認できる", { kind: "good" });
  return true;
}

async function afterShift(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  if (!await afterShiftSumiTalk(owner, signal) || !current()) return false;
  const pickAfter = await afterShiftMenu(owner, signal);
  if (!pickAfter || !current()) return false;
  let result;
  if (pickAfter === "makanai") result = await makanaiPractice(owner, signal);
  else if (pickAfter === "attack") result = await studyAttack({ signal });
  else if (pickAfter === "cube_coals") result = await studyCubeCoals({ signal });
  else if (pickAfter.startsWith("lesson:")) result = await consultLessons("sumi", { only: pickAfter.slice(7), bg: TONARI_BG, signal });
  return current() && result !== false;
}

// #3097 第1弾: 第2章のシフト上がりの会話（data/dialogue/ch2_tonari_talks.json・第2章の準備期間に読み込む）。
// 固有会話も♥5後の場面も無い日に、定型の一言の代わりに未読を先頭から一本ずつ・一度だけ（既読 _talk_seen_<ID>）。
// 報酬はいつものバイト上がりと同じ。条件は章・章内日・面識・本編の既読だけで、ルート・恋人・♥段階は見ない。
// 章内日は保存の通算日と _ch2_day1.startDay（DAY1）から数える（core/chapter-clock.js と同じ起点）。
const ch2DayOf = (s) => { const start = s?.flags?._ch2_day1?.startDay; return Number.isInteger(start) ? s.day - start + 1 : null; };
export const CH2_SHIFT_TALKS = Object.freeze([
  // 柚ヶ谷へ通い始めた後（DAY2以降）
  { id: "ch2_shift_talk_fare", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  // DAY1の配達で三軒に入り、三人と面識がある時
  { id: "ch2_shift_talk_three_shops", when: (s) => !!(s.met?.ageha && s.met?.kumicho && s.met?.kuraudo) },
  // DAY6の「しばらく飯はうちで食ってけ」の後
  { id: "ch2_shift_talk_supper", when: (s) => !!s.flags?._ch2_read_ch2_lingering_smell },
  // #3097 PR-I: 鉄仮面さんの「炭、きれいだった」（DAY6の二人の炭替え）の続き。顔に出ない客の息を見る
  { id: "ch2_shift_talk_salaryman", when: (s) => !!s.flags?._ch2_read_ch2_coal_together },
  { id: "ch2_shift_talk_receipts", when: (s) => (ch2DayOf(s) ?? 3) >= 3 },
  { id: "ch2_shift_talk_student", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  // つむぎが店にいる時だけ。DAY13（つむぎの色の夜）とは別の日
  { id: "ch2_shift_talk_tsumugi_board", when: (s, { tsumugiHere }) => !!s.met?.tsumugi && tsumugiHere && ch2DayOf(s) !== 13 },
  // #3097 計画 2-7（PR-D）: つむぎの普段の会話3本（灰の猫・背中の絵・洗う手）。黒板の回と同じく、つむぎが店にいる日だけ・DAY13とは別の日。
  // つむぎのいる日は限られるので、黒板の回のすぐ後に置く（いない日は飛ばして、下のスミさんの回を読む）。恋愛を進めない
  { id: "ch2_shift_talk_tsumugi_ash", when: (s, { tsumugiHere }) => !!s.met?.tsumugi && tsumugiHere && ch2DayOf(s) !== 13 },
  { id: "ch2_shift_talk_tsumugi_backs", when: (s, { tsumugiHere }) => !!s.met?.tsumugi && tsumugiHere && ch2DayOf(s) !== 13 },
  { id: "ch2_shift_talk_tsumugi_hands", when: (s, { tsumugiHere }) => !!s.met?.tsumugi && tsumugiHere && ch2DayOf(s) !== 13 },
  { id: "ch2_shift_talk_one_hose", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  // #3097（RLS03）第2弾: 忘れ物の箱・初めての客・古いCDラジカセ・いつもの席・指の火傷。どれも柚ヶ谷へ通い始めた後
  { id: "ch2_shift_talk_lost_box", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_first_timer", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_cd_player", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_same_seat", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_burnt_finger", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  // #3097 計画 2-8（PR-D）第3弾: 瓶の水の高さ・忘れたマウスピース・閉店前の短い一台・先に起こす炭・引っ越す常連。スミさんの手仕事と客の話
  { id: "ch2_shift_talk_water_line", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_my_mouthpiece", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_short_one", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_early_coal", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
  { id: "ch2_shift_talk_last_visit", when: (s) => (ch2DayOf(s) ?? 2) >= 2 },
]);
/** 今日のシフト上がりに読む第2章の会話（無ければ null）。台本が読み込まれていない時は出さない。 */
export function ch2ShiftTalkDue(s, dialogues, context = {}) {
  if (s?.chapter !== 2) return null;
  return CH2_SHIFT_TALKS.find(talk => !s.flags?.[`_talk_seen_${talk.id}`] && dialogues?.[talk.id]?.lines?.length
    && talk.when(s, context))?.id || null;
}

/**
 * #1081 B05: シフト上がりのスミ会話は選択式でなく必ず流れる。
 * 固有会話（次の段階会話・節目・店側の続き）がある日はそれ、無い日は定型の一言。
 * 固有会話は visitChar 側の既読管理で進むため、旧・任意会話が二重再生されることはない。
 * #1081 B06: ひより前提を満たした後の最初のバイト上がりでは、このスミ会話の中で
 * 斧投げが露出する（露出フラグのみ。ひより前提チェーンは現状維持）。
 */
async function afterShiftSumiTalk(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  if (!current()) return false;
  if (hasNewStory("sumi") || spotFollowupDue("sumi", state, DB.dialogues)) {
    if (await visitChar("sumi", { signal }) === false || !current()) return false;
  } else {
    // ♥5の締めくくりの後（#3693）: 定型の一言の代わりに、スミさんの♥5後の場面を一度ずつ。読み終えたら短い汎用（core/bond-after.js）。
    // 報酬はいつものバイト上がりと同じ（増やさない）。台本を読めなければ定型の一言へ戻す。中断したら既読にせず、次の上がりで読み直す。
    let after = bondAfterNext(state, "sumi");
    if (after) { try { await loadBondAfterScenes(DB); } catch { after = null; } }
    if (!current()) return false;
    const ch2Talk = after ? null : ch2ShiftTalkDue(state, DB.dialogues, { tsumugiHere: tsumugiAtTonari(state) });
    const result = await play(after?.scene || ch2Talk || "remake_sumi_after_shift", { bg: TONARI_BG, signal });
    if (!current() || result?.cancelled) return false;
    if (result) {
      markBondAfterRead(state, "sumi", after);
      if (ch2Talk) state.flags[`_talk_seen_${ch2Talk}`] = true;
    }
  }
  if (!axeThrowExposed() && hiyoriAxePrereqsMet()) {
    const result = await play("remake_sumi_axe_hint", { bg: TONARI_BG, signal });
    if (!current() || result?.cancelled) return false;
    owner.flags._axe_throw_unlocked = true;
  }
  return true;
}

export function chooseDrill({ title = "自主練", lead = "苦手な工程を反復しよう。能力値は増えません。", recommended = null, allowBack = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const pick = value => {
      if (settled) return;
      settled = true;
      if (value === null) SE.cancel(); else SE.select();
      retire(root); resolve(value);
    };
    const root = showScreen("tonari", el("div.sub-menu.drill-menu", [
      el("h2.sub-title", { text: title }),
      el("p.sub-lead", { text: lead }),
      el("div.sub-choices.grid", Object.entries(DRILLS).map(([id, d]) =>
        el("button.big-choice", { dataset: { test: `drill-${id}` }, onclick: () => pick(id) }, [
          el("b", { text: `${d.label}${id === recommended ? "（おすすめ）" : ""}` }),
          el("small", { text: `${d.desc}（自己ベスト ${"★".repeat(Math.max(0, state.best[id] ?? 0)) || "なし"}）` }),
        ])
      )),
      allowBack ? el("button.btn.ghost.small.sub-back", { text: "← 戻る", dataset: { test: "drill-back" }, onclick: () => pick(null) }) : null,
    ]));
  });
}

// 店番の一日。店の売上は画面の中だけで、はじめの財布・能力・私物は共通の勤務処理からだけ動く。
// 店番の日の種（客の並び・営業の種類・来店の人）。同じ日なら、勤務札の予報と本番で同じ答え。
const shiftSeed = (s = state) => (s.weatherSeed || 0) ^ Math.imul(s.day + s.chapter * 31, 0x45d9f3b);
// 返り値は営業の結果（中断・LOAD は null）。画面を読み込めない時は、歩合なしで勤務だけ済ませる。
const FLOOR_RANK_ORDER = ["C", "B", "A", "S"];
/** これまでフロアを回した回数・いちばん良かった評価・店のファンの合計・売上の最高（保存は flags._tonari_floor）。 */
function floorProgress(s = state) {
  const saved = s.flags?._tonari_floor;
  return {
    nights: Number.isInteger(saved?.nights) && saved.nights > 0 ? saved.nights : 0, best: saved?.best || null,
    fans: Number.isInteger(saved?.fans) && saved.fans > 0 ? saved.fans : 0,
    top: Number.isInteger(saved?.top) && saved.top > 0 ? saved.top : 0, // 売上の最高（超えると、精算に「自己ベスト」が出る）
  };
}
/**
 * フロアにたまに遊びに来る、本編の人物（5回に1回ほど）。顔見知りで、好感度1以上、その章に来られる人だけ。
 * 面識だけ・好感度だけでは来ない（交流の時系列ルール）。はじめての営業には来ない。来ても好感度は動かさない。
 */
function floorVisitor(owner, seed, nights, visitors) {
  if (nights < 1 || !visitors) return null;
  const able = Object.values(visitors).filter((v) => v.chapters.includes(owner.chapter) && owner.met?.[v.id] && affinityLevel(v.id) >= 1);
  const roll = ((seed >>> 5) ^ Math.imul((owner.day || 0) + 1, 0x9e3779b1)) >>> 0;
  return able.length && roll % 5 === 0 ? able[(roll >>> 8) % able.length].id : null;
}
const loadFloorView = () => import("./tonari-floor-view.js");
/** チュートリアル（スミさんが横について一通りやらせる・TFL64）。飛ばしても済んだことにする。中断・LOAD は false。 */
async function floorTutorial(owner, signal) {
  const current = () => state === owner && !signal.aborted;
  let view;
  try { view = await loadFloorView(); } catch { return current(); } // 読めない時は、チュートリアルなしで進める
  if (!current()) return false;
  const result = await view.runTonariFloor({ tutorial: true, chapter: owner.chapter, art: bgUrl(TONARI_BG, "day"), isCurrent: current, signal });
  if (!current() || !result) return false;
  owner.flags._tonari_floor_tutorial = true; // シフトの給料・行動消費と一緒に calendar で保存する
  return true;
}
async function serveFloor(owner, signal, getAllowances) {
  const current = () => state === owner && !signal.aborted;
  if (!current()) return null;
  const seed = shiftSeed(owner);
  const progress = floorProgress(owner);
  let view;
  try { view = await loadFloorView(); }
  catch {
    if (!current()) return null;
    toast("店番の画面を読み込めなかった。今日は歩合なしで勤務を終える", { kind: "warn" });
    return { sales: 0, fallback: true };
  }
  if (!current()) return null;
  const visitor = floorVisitor(owner, seed, progress.nights, view.FLOOR_VISITORS);
  let result;
  // 開店前の札から「遊び方（チュートリアル）」を選んだら、チュートリアルを開いてから、同じ一日を始め直す
  for (;;) {
    result = await view.runTonariFloor({
      seed, level: progress.nights, chapter: owner.chapter, fans: progress.fans, topSales: progress.top, getAllowances,
      visitor, rainy: isRainy(), night: false, dusk: true, art: bgUrl(TONARI_BG, "day"), artNight: bgUrl(TONARI_BG, "night"),
      offerTutorial: true, isCurrent: current, signal,
    });
    if (!current() || !result) return null;
    if (result.again !== "tutorial") break;
    if (!await floorTutorial(owner, signal)) return null;
  }
  const best = FLOOR_RANK_ORDER.indexOf(result.rank) > FLOOR_RANK_ORDER.indexOf(progress.best) ? result.rank : progress.best;
  // 進み具合と店のファンの合計は、シフトの給料・行動消費と一緒に calendar で保存する。
  owner.flags._tonari_floor = { nights: progress.nights + 1, best, fans: Math.max(0, progress.fans + result.fans),
    top: Math.max(progress.top, Number.isInteger(result.sales) ? result.sales : 0) };
  return current() ? result : null;
}
