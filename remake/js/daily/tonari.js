import { staffFlavors, staffStock } from "../core/flavor-mastery.js";
// tonari（バイト先）: 客として一服／シフトに入る（接客→シフト後にスミさん）。
// シーシャ作りの練習は店の練習イベントで行う（#783）。chooseDrill は第1章の準備イベントで使う。
import { el, pick } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, retire, modal } from "../core/ui.js";
import { state, timeOfDay } from "../core/state.js";
import { addMoney, addStamina, applyStats, star, currentCondition } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { play, dialogueSequence } from "../vn/engine.js";
import { visitChar, hasNewStory } from "./spots.js";
import { hearFortuneRumor } from "./fortune-rumor.js";
import { DRILLS } from "../craft/session.js";
import { isRainy, RAIN_BAITO, RAIN_BAITO_BONUS } from "./weather.js";
import { shiftClose } from "../core/scene-motions.js";
import { meetHiyoriAtTonari } from "./hiyori.js";
import { hiyoriAxeReady, hiyoriAxeAffordable, hiyoriAxePrereqsMet, axeThrowExposed } from "./hiyori-axe.js";
import { spotFollowupDue } from "./spot-encounters.js";
import { canStudyAttack, studyAttack } from "./attack-lesson.js";
import { canStudyCubeCoals, studyCubeCoals } from "./coal-lesson.js";
import { tsumugiAtTonari } from "./tsumugi-schedule.js";

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
      el("p.sub-lead", { text: state.slot === 0 ? "昼のtonari。窓際でスミさんが道具を整えている。今日はどうする？" : "夜のtonari。客席から常連の笑い声が聞こえる。今日はどうする？" }),
      el("div.sub-choices", [
        opt("お客さんとして一服", !tsumugiAtTonari(state) ? "客席でゆっくり一服する"
          : tsumugiKnown ? "客席でゆっくり。常連席にはつむぎがいる" : "客席でゆっくり。常連席にはいつもの子がいる", "customer", "tonari-customer"),
        opt("まかないで練習", `体力を使う・1行動。今日の葉：${staffFlavors(state).map(id => `${DB.flavorById[id]?.short_name || id} ${staffStock(state, id)}g`).join("、")}。私物も使える`, "practice", "tonari-practice"),
        opt("シフトに入る（バイト）", "接客で稼ぐ。上がったあとはスミさんと話せる", "baito", "tonari-baito"),
        hiyoriAxeReady() && axeThrowExposed() ? opt("ひよりと斧投げへ", hiyoriAxeAffordable()
          ? "夜の寄り道。参加3000円・体力を使う・行動1回。3投を一緒に楽しむ"
          : "参加には3000円と体力が必要。先にLIMEの約束を済ませよう", "hiyori_axe", "tonari-hiyori-axe") : null,
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
    await meetHiyoriAtTonari();
    if (!live()) return false;
    if (tsumugiAtTonari(state)) {
      if (!await visitChar("tsumugi") || !live()) return false;
      if (!await hearFortuneRumor({ signal }) || !live()) return false;
    }
    return live();
  } finally { customerVisits.delete(owner); }
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
    await play("ch1_reviewer_cameo", { bg: TONARI_BG });
    rememberBaito("ch1_reviewer_cameo", ["reviewer"]);
  } else if (state.chapter === 1 && n >= 4 && state.day >= 6 && !state.flags._ev_maezono_cameo) {
    state.flags._ev_maezono_cameo = true;
    await play("ch1_maezono_cameo", { bg: TONARI_BG });
    rememberBaito("ch1_maezono_cameo", ["maezono"]);
  } else {
    await customerEvent(condition);
  }
  await serveShiftOrder();
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
  if ((customerFamilies(event).includes("tsumugi") || event.id.startsWith("baito_tsumugi_"))
    && !tsumugiAtTonari(state)) return false;
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
  // 初来店や誕生日などの一度だけの話は、接客済みの記録（usedBaito）で再抽選を防ぐ。
  if ((event.once || event.set_flag) && (state.usedBaito || []).includes(event.id)) return false;
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
  if (ev.set_flag) state.flags[ev.set_flag] = true;
  if (ev.mark_flag) state.flags[ev.mark_flag] = (Number(state.flags[ev.mark_flag]) || 0) + 1; // 繰り返し来る常連の接客回数（大会の回想分岐用。set_flag と違い一度きり化しない）
  rememberBaito(ev.id, customerFamilies(ev));
}

/** シフト後: スミ会話（必須）のあと、任意の特訓・授業だけを選ぶ。練習は店の固定イベントで（#783） */
function afterShiftMenu() {
  return new Promise((resolve) => {
    const opt = (title, desc, value, test) =>
      el("button.big-choice", { dataset: { test }, onclick: () => { SE.select(); retire(root); resolve(value); } }, [el("b", { text: title }), el("small", { text: desc })]);
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: "シフト上がり" }),
      el("p.sub-lead", { text: "スミさんと話し終えて、まだ少しだけ時間がある。" }),
      el("div.sub-choices", [
        canStudyAttack() ? opt("雑念を切る特訓を受ける", "スミさん♥3・アタックを習得する", "attack", "after-attack") : null,
        canStudyCubeCoals() ? opt("キューブ炭の授業を受ける", "スミさんと火の違いを確かめる", "cube_coals", "after-cube-coals") : null,
        opt("まっすぐ上がる", "今日はここまで", "none", "after-none"),
      ]),
    ]));
  });
}

async function afterShift() {
  await afterShiftSumiTalk();
  const pickAfter = await afterShiftMenu();
  if (pickAfter === "attack") await studyAttack();
  if (pickAfter === "cube_coals") await studyCubeCoals();
}

/**
 * #1081 B05: シフト上がりのスミ会話は選択式でなく必ず流れる。
 * 固有会話（次の段階会話・節目・店側の続き）がある日はそれ、無い日は定型の一言。
 * 固有会話は visitChar 側の既読管理で進むため、旧・任意会話が二重再生されることはない。
 * #1081 B06: ひより前提を満たした後の最初のバイト上がりでは、このスミ会話の中で
 * 斧投げが露出する（露出フラグのみ。ひより前提チェーンは現状維持）。
 */
async function afterShiftSumiTalk() {
  if (hasNewStory("sumi") || spotFollowupDue("sumi", state, DB.dialogues)) {
    await visitChar("sumi");
  } else {
    await play("remake_sumi_after_shift", { bg: TONARI_BG });
  }
  if (!axeThrowExposed() && hiyoriAxePrereqsMet()) {
    await play("remake_sumi_axe_hint", { bg: TONARI_BG });
    state.flags._axe_throw_unlocked = true;
  }
}

export function chooseDrill({ title = "自主練", lead = "苦手な工程を反復しよう。能力値は増えません。", recommended = null } = {}) {
  return new Promise((resolve) => {
    const root = showScreen("tonari", el("div.sub-menu", [
      el("h2.sub-title", { text: title }),
      el("p.sub-lead", { text: lead }),
      el("div.sub-choices.grid", Object.entries(DRILLS).map(([id, d]) =>
        el("button.big-choice", { dataset: { test: `drill-${id}` }, onclick: () => { SE.select(); retire(root); resolve(id); } }, [
          el("b", { text: `${d.label}${id === recommended ? "（おすすめ）" : ""}` }),
          el("small", { text: `${d.desc}（自己ベスト ${"★".repeat(Math.max(0, state.best[id] ?? 0)) || "なし"}）` }),
        ])
      )),
    ]));
  });
}

const SHIFT_ORDERS = [
  { id: "citrus", text: "甘すぎない、柑橘のさっぱりしたものを", mixes: [{ lemon: 9, mint: 3 }, { orange: 9, lemon: 3 }], labels: ["レモン＋ミント", "オレンジ＋レモン"],
    reactions: ["shift_flavor_citrus_lemon_mint", "shift_flavor_citrus_orange_lemon"] },
  { id: "fruit_mint_free", text: "果物の甘さで、ミントは抜きにして", mixes: [{ blueberry: 9, peach: 3 }, { grape: 8, orange: 4 }], labels: ["ブルーベリー＋ピーチ", "グレープ＋オレンジ"],
    reactions: ["shift_flavor_fruit_blueberry_peach", "shift_flavor_fruit_grape_orange"] },
  { id: "sweet_round", text: "お菓子みたいに、甘くて丸い味がいいな", mixes: [{ vanilla: 8, coconut: 4 }, { peach: 8, vanilla: 4 }], labels: ["バニラ＋ココナッツ", "ピーチ＋バニラ"],
    reactions: ["shift_flavor_sweet_vanilla_coconut", "shift_flavor_sweet_peach_vanilla"] },
  { id: "double_apple", text: "ダブルアップルを。清涼感は少しだけ", mixes: [{ double_apple: 10, mint: 2 }, { double_apple: 12 }], labels: ["ダブルアップル＋ミント少量", "ダブルアップル単体"],
    reactions: ["shift_flavor_double_apple_mint", "shift_flavor_double_apple_solo"] },
];
async function serveShiftOrder() {
  const owner = state;
  const key = `_shift_order_${state.chapter}:${state.day}`;
  if (state.flags[key]) return;
  const seed = (state.weatherSeed || 0) ^ Math.imul(state.day + state.chapter * 31, 0x45d9f3b);
  const order = SHIFT_ORDERS[((seed ^ (seed >>> 16)) >>> 0) % SHIFT_ORDERS.length];
  const index = await modal({ title: "今日の注文", body: `前のお客さんを見送って、次の卓につく。<br>「${order.text}」 店の葉で一台を作る。`,
    options: order.labels.map((label, i) => ({ label, value: i, test: `shift-order-${i}` })) });
  if (state !== owner || !Number.isInteger(index) || !order.mixes[index]) return;
  // 注文と配合に対応した客の反応を返す（#1073）。給料・行動消費は従来どおり後続のcalendarで確定。
  // 同じ注文が前にもあったら、反応の前にはじめが前回の配合を思い出す（前回と同じか違うかで一行を変える・#1415）。
  const prev = state.flags[`_shift_mix_${order.id}`];
  const recall = Number.isInteger(prev) && order.mixes[prev] ? DB.dialogues[`shift_recall_${order.id}_${prev === index ? "same" : "diff"}`] : null;
  const scene = DB.dialogues[order.reactions[index]];
  const result = await play(recall && scene ? { ...scene, lines: [...recall.lines, ...scene.lines] } : order.reactions[index], { bg: TONARI_BG });
  if (state !== owner || result?.cancelled) return;
  // お客さんへの提供は業務。自分の熟練度を稼ぐ対象にはしない。
  state.flags[key] = true; // シフトの給料・行動消費と一緒にcalendarで保存する。
  state.flags[`_shift_mix_${order.id}`] = index;
}
