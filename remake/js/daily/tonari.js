// tonari（バイト先）: 客として一服／シフトに入る（接客→シフト後にスミさん・自主練）。
import { el, pick } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, modal, retire } from "../core/ui.js";
import { state, timeOfDay } from "../core/state.js";
import { addMoney, addStamina, applyStats, star, currentCondition } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { play, dialogueSequence } from "../vn/engine.js";
import { visitChar, hasNewStory } from "./spots.js";
import { runDrill, DRILLS } from "../craft/session.js";
import { runFullPractice } from "../craft/practice.js";
import { isRainy, RAIN_BAITO, RAIN_BAITO_BONUS } from "./weather.js";
import { shiftClose } from "../core/scene-motions.js";
import { meetHiyoriAtTonari } from "./hiyori.js";
import { hiyoriAxeReady, hiyoriAxeAffordable } from "./hiyori-axe.js";

const TONARI_BG = "res://assets/backgrounds/bg_tonari_inside.png";

/** tonari に入ったときのサブメニュー。戻るなら null */
export function tonariMenu() {
  return new Promise((resolve) => {
    setBg(bgUrl(TONARI_BG, timeOfDay()), { fast: true });
    playBgm("tonari");
    const tsumugiKnown = !!(state.met.tsumugi || state.flags._met_tsumugi || (state.story.tsumugi || 0) > 0);
    const pickIt = (value) => { retire(root); resolve(value); };
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, disabled: value === "hiyori_axe" && !hiyoriAxeAffordable(), onclick: () => { SE.select(); pickIt(value); } }, [
        el("b", { text: title }), el("small", { text: desc }),
      ]);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "tonari" }),
      el("p.sub-lead", { text: "カウンターの奥で、スミさんが炭を切っている。今日はどうする？" }),
      el("div.sub-choices", [
        opt("お客さんとして一服", tsumugiKnown ? "客席でゆっくり。常連席にはつむぎがいる" : "客席でゆっくり。常連席にはいつもの子がいる", "customer", "tonari-customer"),
        opt("一台を通して練習", "配合から提供・2回の調整まで。材料は店の葉を使う", "practice", "tonari-practice"),
        opt("シフトに入る（バイト）", "接客で稼ぐ。上がったあとはスミさんと話すか、裏で自主練もできる", "baito", "tonari-baito"),
        hiyoriAxeReady() ? opt("ひよりと斧投げへ", hiyoriAxeAffordable()
          ? "夜の寄り道。参加3000円・体力10・行動1回。3投を一緒に楽しむ"
          : "参加には3000円と体力が必要。先にLIMEの約束を済ませよう", "hiyori_axe", "tonari-hiyori-axe") : null,
      ]),
      el("button.btn.ghost.small.sub-back", { text: "← マップに戻る", dataset: { test: "sub-back" }, onclick: () => { SE.cancel(); pickIt(null); } }),
    ]));
  });
}

export async function tonariCustomer() {
  addStamina(-10);
  await meetHiyoriAtTonari();
  await visitChar("tsumugi");
}

export async function tonariPractice() {
  addStamina(-12);
  await runFullPractice();
}

// ---------------------------------------------------------------- バイト

const CHARM_BONUS = [0, 500, 1200, 2000, 3000]; // 魅力★で指名・リピートが増える
const CALLED_BONUS = 5000; // スミさんに急に呼ばれた日の上乗せ（店からの給料。チップではない）

/** @param opts.called スミさんのLIMEで急に呼ばれたシフト（給料に上乗せ） */
export async function doBaito({ called = false } = {}) {
  return dialogueSequence(() => baitoShift({ called }));
}

async function baitoShift({ called }) {
  addStamina(-24);
  const condition = currentCondition(); // 消耗を反映した制作時の体力で、そのシフト中は固定
  playBgm("tonari");
  state.baitoCount = (state.baitoCount || 0) + 1;
  state.lastBaitoDay = state.day;
  await play("remake_baito_start", { bg: TONARI_BG });
  await meetHiyoriAtTonari();
  const rainy = isRainy();
  if (rainy) await play("remake_baito_rain", { bg: TONARI_BG });
  const n = state.baitoCount;
  // 正体を伏せた客が一度だけ混ざる（後の章・大会当日で回収される伏線）
  if (state.chapter === 1 && n === 2 && !state.flags._ev_rei_cameo) {
    state.flags._ev_rei_cameo = true;
    await play("ch1_rei_cameo", { bg: TONARI_BG });
    rememberBaito("ch1_rei_cameo", ["rei"]);
  } else if (state.chapter === 1 && n >= 3 && state.day >= 4 && !state.flags._ev_reviewer_cameo) {
    state.flags._ev_reviewer_cameo = true;
    state.notes.baito_incognito_reviewer = (state.notes.baito_incognito_reviewer || 0) + 1; // 常連ノート（C.STATIONで回収）
    await play("ch1_reviewer_cameo", { bg: TONARI_BG });
    rememberBaito("ch1_reviewer_cameo", ["reviewer"]);
  } else if (state.chapter === 1 && n >= 4 && state.day >= 6 && !state.flags._ev_maezono_cameo) {
    state.flags._ev_maezono_cameo = true;
    state.notes.baito_incognito_maezono = (state.notes.baito_incognito_maezono || 0) + 1; // 常連ノート（大会当日に回収）
    await play("ch1_maezono_cameo", { bg: TONARI_BG });
    rememberBaito("ch1_maezono_cameo", ["maezono"]);
  } else {
    await customerEvent(condition);
  }
  const bonus = Math.round(CHARM_BONUS[star("charm") - 1] * condition.bonusRate);
  const extra = called ? CALLED_BONUS : 0;
  const rainPay = rainy ? RAIN_BAITO_BONUS : 0; // 雨の日は長居客の追加注文ぶん
  const pay = 8000 + bonus + extra + rainPay + condition.shiftBonus;
  await shiftClose();
  await play("remake_baito_end", { bg: TONARI_BG });
  if (called) await play("remake_sumi_call_thanks", { bg: TONARI_BG });
  addMoney(pay);
  if (bonus) toast(`常連さんの指名が増えてきた。売上ボーナス +${bonus.toLocaleString()}円`, { kind: "good" });
  if (extra) toast(`急なシフトの上乗せ +${extra.toLocaleString()}円`, { kind: "good" });
  if (rainPay) toast(`雨の日の追加注文 +${rainPay.toLocaleString()}円`, { kind: "good" });
  if (condition.shiftBonus) toast(`仕上げは好調。売上ボーナス +${condition.shiftBonus.toLocaleString()}円`, { kind: "good" });
  if (condition.health === "red") toast("疲れで仕上げが不安定。売上ボーナスが半分になった", { kind: "warn" });
  // 基礎成長は訪問と同じ4。接客・片付けの両方を経験する。
  applyStats({ technique: 2, charm: 2 });
  await afterShiftErrand();
  await afterShift();
}

/** 店の受け取りは実際のシフト後だけ。旧DAY4の既読記録もそのまま使う。 */
async function afterShiftErrand() {
  if (state.chapter !== 1 || state.day < 4 || state.flags._ev_ageha_cameo
    || !DB.dialogues.ch1_ageha_encounter) return;
  await play("ch1_ageha_encounter");
  state.flags._ev_ageha_cameo = true;
  await setBg(bgUrl(TONARI_BG, timeOfDay()), { fast: true });
}

/** 台本の条件は、初回でも再来店でも守る。名前を知る条件には旧セーブの進行も使う */
function customerEligible(event, rainy) {
  if (event.chapter && event.chapter !== state.chapter) return false;
  const flagKnown = (flag) => flag === "ch1_tsumugi_regular"
    ? !!(state.met.tsumugi || state.flags._met_tsumugi || (state.story.tsumugi || 0) > 0)
    : !!state.flags[flag];
  if (event.trigger_flag) {
    const negative = event.trigger_flag.startsWith("!");
    const flag = negative ? event.trigger_flag.slice(1) : event.trigger_flag;
    if (negative ? flagKnown(flag) : !flagKnown(flag)) return false;
  }
  if ((RAIN_BAITO.includes(event.id) || event.trigger_day_weather === "rainy") && !rainy) return false;
  if (event.trigger_day_weather === "sunny" && rainy) return false;
  if (event.time_slot && event.time_slot !== (timeOfDay() === "night" ? "night" : "noon")) return false;
  // 初来店や誕生日などの一度だけの話は、旧セーブの既読記録でも再抽選を防ぐ。
  if ((event.once || event.set_flag) && ((state.usedBaito || []).includes(event.id) || (state.notes[event.id] || 0) > 0)) return false;
  return true;
}

const customerFamilies = (event) => Array.isArray(event.customers) ? event.customers : [event.id];
function rememberBaito(id, customers = []) {
  const record = { id, chapter: state.chapter, day: state.day, customers: [...new Set(customers)] };
  state.baitoRecent = [...(state.baitoRecent || []), record].slice(-4);
}

/** 条件と直近の顔ぶれを先に絞り、初めて読む回を優先。候補不足でも条件は緩めない */
function chooseCustomerEvent(rainy) {
  const recent = (state.baitoRecent || []).filter((record) => record.chapter === state.chapter
    && record.day >= state.day - 1 && record.day <= state.day);
  const ids = new Set(recent.map((record) => record.id));
  const faces = new Set(recent.flatMap((record) => record.customers));
  const eligible = DB.baito.filter((event) => customerEligible(event, rainy) && !ids.has(event.id)
    && !customerFamilies(event).some((customer) => faces.has(customer)));
  const fresh = eligible.filter((event) => !(state.usedBaito || []).includes(event.id));
  const available = fresh.length ? fresh : eligible;
  const rainPool = available.filter((event) => RAIN_BAITO.includes(event.id) || event.trigger_day_weather === "rainy");
  return pick(rainy && rainPool.length ? rainPool : available);
}

/** baito_events.json の接客イベントを会話に変換して再生 */
async function customerEvent(condition) {
  const used = (state.usedBaito = state.usedBaito || []);
  const ev = chooseCustomerEvent(isRainy());
  if (!ev) {
    // 条件を満たす客がいないときも、未対面の名前や一度限りの出来事は再生しない。
    await play({ dialogue_id: "remake_baito_routine", lines: [
      { speaker: "", face: "", text: "注文を聞いて、炭を替え、グラスを下げる。今日のシフトも、一つずつ対応を重ねた。" },
    ] }, { bg: TONARI_BG });
    return;
  }
  const narr = (t) => String(t || "").split("\n").filter(Boolean).map((text) => ({ speaker: "", face: "", text }));
  const branches = {};
  const choices = (ev.choices || []).map((c, i) => {
    // 選んだ対応の売上ボーナス（店から）もここで乗せる。チップ文化は無い（CLAUDE.md）
    branches[`c${i}`] = [...narr(c.result), { type: "apply", stats: c.stats || {}, money: Math.round((c.money_bonus || 0) * condition.bonusRate) }];
    return { text: c.text, next: `c${i}` };
  });
  const dlg = {
    dialogue_id: `baito_${ev.id}`,
    lines: [...narr(ev.text), ...(choices.length ? [{ type: "choice", id: "baito", choices }] : [])],
    branches,
  };
  await play(dlg, { bg: TONARI_BG });
  if (!used.includes(ev.id)) used.push(ev.id);
  state.notes[ev.id] = (state.notes[ev.id] || 0) + 1;
  if (ev.set_flag) state.flags[ev.set_flag] = true;
  rememberBaito(ev.id, customerFamilies(ev));
}

/** シフト後: スミさんと話す（固有会話）／裏で自主練（ドリル）／そのまま上がる */
function afterShiftMenu() {
  return new Promise((resolve) => {
    const sumiNew = hasNewStory("sumi");
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, onclick: () => { SE.select(); retire(root); resolve(value); } }, [el("b", { text: title }), el("small", { text: desc })]);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "シフト上がり" }),
      el("p.sub-lead", { text: "シフトの片付けを終えて、まだ少しだけ時間がある。" }),
      el("div.sub-choices", [
        opt("スミさんと話す", sumiNew ? "今日は何か教えてもらえそうだ" : "落ち着いた一台を分けてもらう", "sumi", "after-sumi"),
        opt("一台を通して練習", "本番と同じ制作と2回の調整（体力を少し使う）", "full", "after-full"),
        opt("裏の作業台で自主練", "工程をひとつ選んで反復する（体力を少し使う）", "drill", "after-drill"),
        opt("まっすぐ上がる", "今日はここまで", "none", "after-none"),
      ]),
    ]));
  });
}

async function afterShift() {
  const pickAfter = await afterShiftMenu();
  if (pickAfter === "sumi") {
    await visitChar("sumi");
  } else if (pickAfter === "full") {
    addStamina(-8);
    await runFullPractice();
  } else if (pickAfter === "drill") {
    const kind = await chooseDrill();
    addStamina(-8);
    let again;
    do {
      const tier = await runDrill(kind);
      state.best[kind] = Math.max(state.best[kind] ?? -1, tier);
      again = await modal({ title: "もう一回練習しますか？",
        body: "同じ工程を繰り返せます。能力値は増えません。",
        options: [
          { label: "もう一回練習する", value: true, test: "drill-again" },
          { label: "練習を終える", value: false, primary: true, test: "drill-finish" },
        ] });
    } while (again);
  }
}

export function chooseDrill() {
  return new Promise((resolve) => {
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "自主練" }),
      el("p.sub-lead", { text: "苦手な工程を反復しよう。能力値は増えません。" }),
      el("div.sub-choices.grid", Object.entries(DRILLS).map(([id, d]) =>
        el("button.big-choice", { dataset: { test: `drill-${id}` }, onclick: () => { SE.select(); retire(root); resolve(id); } }, [
          el("b", { text: d.label }),
          el("small", { text: `${d.desc}（自己ベスト ${"★".repeat(Math.max(0, state.best[id] ?? 0)) || "なし"}）` }),
        ])
      )),
    ]));
  });
}
