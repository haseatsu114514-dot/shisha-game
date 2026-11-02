// 第2章の大会準備で、実際に一台作る場面（VOL13）。第1章の DAY3「基礎の確認」・前日リハーサル・工程別の練習を流用する。
// tonari を選んだ時、期間中で未読なら「スミさんに見てもらう／いつものtonari」を先に聞く（任意。地図の tonari に「！」）。
// 基礎の確認（DAY2〜4）は店の葉（まかない）で一台、調整なし。課題の苺は当日に主催が出すので、まだ使わない。
// 最後の通し（DAY11〜12）は本番と同じ一台（苺4g以上・主催支給の苺・調整2回）。工程を選んだ練習も選べる。
// どちらも1行動・体力16。葉の在庫は減らさず、能力値・大会の加点は付けない（第1章の練習と同じ）。熟練度だけ育つ。
// tonari で夜の本編がある日（DAY4・10・13）は calendar が tonari を塞ぐので、実際に選べるのはその前後の日。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { addStamina } from "../core/stats.js";
import { modal } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { chooseDrill } from "../daily/tonari.js";

export const CH2_CRAFT_PREP = Object.freeze([
  Object.freeze({ id: "basics", from: 2, until: 4, label: "基礎の確認", intro: "ch2_prep_basics_intro",
    body: "スミさんが、県大会の前にいまの手を一台見たいと言っている。<br>店の葉で一台、調整なし。1行動・体力を使う。能力値は増えない。" }),
  Object.freeze({ id: "rehearsal", from: 11, until: 12, label: "最後の通し", intro: "ch2_prep_rehearsal_intro",
    body: "本番と同じ一台（苺4g以上・主催支給の苺・調整2回まで）を、最後に通しておける。<br>1行動・体力を使う。葉は減らず、能力値は増えない。" }),
]);
const RESULTS = { basics: ["end", "failed"], rehearsal: ["great", "good", "rough", "burnt", "drill"] };
export const CH2_CRAFT_PREP_IDS = Object.freeze(CH2_CRAFT_PREP.flatMap(prep =>
  [prep.intro, ...RESULTS[prep.id].map(result => `ch2_prep_${prep.id}_${result}`)]));
export const craftPrepDoneKey = id => `_ch2_prep_${id}_done`;

/** いま tonari で受けられる大会準備（第2章の準備期間・期間内・未完了・台本あり）。 */
export function craftPrepDue(value = state) {
  if (!value || value.chapter !== 2 || value.phase !== "daily") return null;
  const startDay = value.flags?._ch2_day1?.startDay;
  if (!Number.isInteger(startDay)) return null;
  const day = value.day - startDay + 1;
  return CH2_CRAFT_PREP.find(prep => day >= prep.from && day <= prep.until && !value.flags[craftPrepDoneKey(prep.id)]
    && CH2_CRAFT_PREP_IDS.filter(id => id.startsWith(`ch2_prep_${prep.id}_`)).every(id => DB.dialogues[id]?.lines?.length)) || null;
}

const average = (...values) => { const f = values.filter(Number.isFinite); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; };
/** 第1章の前日リハーサルと同じ物差し（穴・炭・完成品・調整2回の平均）。 */
export function rehearsalGrade(cs, computeShisha) {
  if (!cs || cs.failed) return "burnt";
  const score = average(cs.holes?.score, cs.heat?.score, computeShisha(cs).craftQuality, cs.careHistory?.[0]?.score, cs.careHistory?.[1]?.score);
  return score >= 85 ? "great" : score >= 68 ? "good" : "rough";
}

/**
 * tonari を選んだ時に呼ぶ。null なら通常の tonari メニューへ（「いつものtonari」）。
 * 練習は提供まで終えて初めて完了にする（中断・LOADでは既読も体力も残さない）。保存は calendar の行動の精算に任せる。
 */
export async function offerCraftPrep(prep, { staminaGuard, bg }) {
  const owner = state;
  const options = prep.id === "basics"
    ? [{ label: "スミさんに一台見てもらう", value: "full", primary: true, test: "ch2-prep-full" }]
    : [{ label: "通しで一台（本番と同じ）", value: "full", primary: true, test: "ch2-prep-full" },
      { label: "工程を選んで練習する", value: "drill", test: "ch2-prep-drill" }];
  options.push({ label: "いつものtonariへ", value: "usual", test: "ch2-prep-usual" }, { label: "やめておく", value: "cancel", test: "ch2-prep-cancel" });
  const pick = await modal({ title: `大会準備：${prep.label}`, body: prep.body, options });
  if (state !== owner || !pick || pick === "cancel") return { used: false, exerted: false };
  if (pick === "usual") return null;
  let drill = null;
  if (pick === "drill") {
    drill = await chooseDrill({ title: "最後の部分練習", lead: "本番の前に、気になる工程だけ確かめる。能力値は増えません。", allowBack: true });
    if (state !== owner || !drill) return { used: false, exerted: false };
  }
  if (!(await staminaGuard(-16)) || state !== owner) return { used: false, exerted: false };
  const read = async id => {
    const result = await play(id, { bg });
    return state === owner && !!result && !result.cancelled;
  };
  const isCurrent = () => state === owner;
  let result;
  if (drill) {
    // 体力は作業の前に引く（作業中の疲れの表情に出す・まかない練習と同じ）。中断なら保存せず行動にもしない。
    addStamina(-16);
    const { runDrill } = await import("../craft/session.js");
    const tier = await runDrill(drill);
    if (state !== owner) return { used: false, exerted: false };
    owner.best[drill] = Math.max(owner.best[drill] ?? -1, tier);
    result = "drill";
  } else {
    if (!await read(prep.intro)) return { used: false, exerted: false };
    addStamina(-16);
    const { runFullPractice } = await import("../craft/practice.js");
    const basics = prep.id === "basics";
    const cs = await runFullPractice({ kind: basics ? "early" : "rehearsal", adjustments: !basics, staffPractice: basics, isCurrent });
    if (state !== owner || !cs || cs.cancelled || !cs.pullDone && !cs.failed) return { used: false, exerted: false };
    if (basics) result = cs.failed ? "failed" : "end";
    else result = rehearsalGrade(cs, (await import("../craft/score.js")).computeShisha);
  }
  if (!await read(`ch2_prep_${prep.id}_${result}`)) return { used: false, exerted: false };
  owner.visitedDay.tonari_practice = owner.day;
  owner.flags[craftPrepDoneKey(prep.id)] = true;
  if (prep.id === "rehearsal") owner.flags._ch2_prep_rehearsal_result = result;
  return { used: true, exerted: true, exp: { key: "tonari_practice", place: "tonari_practice" } };
}
