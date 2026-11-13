// 辻占のオババの出方（2026-11-02 オーナー指定・台帳 URA）。保存の書き込み以外の判定と記録をここに置く。
// - 章ごとに1〜2回。予定（夜の固定の予定・約束・休養の日）と重ならない昼か夜に、街のどこかへふらっと現れる（神出鬼没）。
//   その時間帯に寄らなければ、いなくなる。予定の時間帯がふさがっていたら、次に空いた時間帯へずれる。
// - 第1章だけ、つむぎから噂を聞いた後。第2章以降は条件なし。
// - 第3章は出発前の準備（地元）と東京、第5章は地元と東京（理由は語らない）に現れる。第4章は出発前の準備（地元）だけで、ドバイには出ない。
// - 遠出する章（第3・4章）の日は、出発前の準備の1日目から通しで数える（準備3日＋滞在。VOL15）。
// 記録は flags._fortune_wander = { chapter, shown: [{ key, where } | null], used: [bool] }（現れた時間帯と、占ってもらったか）。
// 旧版の「週2日・昼だけ・アーケード脇・雨は休み」（#780）は廃止した。
import { chapterDay } from "../core/chapter-clock.js";

/** 出現の前提（第1章のみ）：自主的な客席訪問で、つむぎの噂を最後まで聞いたこと。 */
export const FORTUNE_RUMOR_ID = "lime_tsumugi_fortune_rumor";
export const FORTUNE_RUMOR = "_fortune_rumor_heard";
export const fortuneRumorHeard = (s) => !!s?.flags?.[FORTUNE_RUMOR];

/** 日常ループで現れる章。 */
export const FORTUNE_CHAPTERS = Object.freeze([1, 2, 3, 4, 5]);
const KEY = "_fortune_wander";
// 現れうる章内日（第1・2章は DAY14 の大会より前。第5章は期限が無いので最初の12日）
// 第3章は準備3日＋東京 DAY1〜13（通しの1〜16日目）。第4章は準備の3日だけ（ドバイでは現れない）。
const RANGE = Object.freeze({ 1: [2, 13], 2: [2, 13], 3: [1, 16], 4: [1, 3], 5: [1, 12] });
// 出発前の準備の記録（chapters/departure-prep.js）。あれば、その1日目から通しで数える。
const PREP_KEYS = Object.freeze({ 3: "_ch3_prep", 4: "_ch4_prep" });
const fortuneDay = (save) => {
  const prep = save?.flags?.[PREP_KEYS[save?.chapter]];
  return Number.isInteger(prep?.startDay) ? save.day - prep.startDay + 1 : chapterDay(save);
};
/** 東京にも現れる章。 */
const TOKYO_CHAPTERS = Object.freeze([3, 5]);

// 現れる場所（地図に対する百分率）。ほかの店のピンと重ならない所を選んだ。area は地図の説明に出す。
// 古町の路地は左下のスロット筐体（css/reel.css）の右に置く（x: 8 では筐体にラベルが隠れた・#3555）。
const POSITIONS = Object.freeze({
  home: [
    { x: 64, y: 74, area: "アーケード脇" },
    { x: 78, y: 74, area: "商店街の裏道" },
    { x: 24, y: 74, area: "古町の路地" },
  ],
  // 第5章の地元には「博士に連絡する」（64, 66）があるので、アーケード脇の代わりに右下の角を使う。
  homeChapter5: [
    { x: 78, y: 66, area: "駅へ向かう角" },
    { x: 58, y: 34, area: "商店街の裏道" },
    { x: 24, y: 74, area: "古町の路地" },
  ],
  tokyo: [
    { x: 84, y: 28, area: "高架の向こう" },
    { x: 60, y: 84, area: "池の手前の路地" },
  ],
});

const mix = (n) => {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
};
const seedOf = (save) => mix((Math.abs(Math.trunc(save?.seed || 0)) * 31) + (save?.chapter || 0) * 977);

/**
 * その章で現れる予定。半日の通し番号（(章内日-1)*2 + 昼0／夜1）で1回か2回。保存の種と章だけで決まる。
 * 2回のときは前半と後半に1回ずつ。
 */
export function fortunePlan(save) {
  const range = RANGE[save?.chapter];
  if (!FORTUNE_CHAPTERS.includes(save?.chapter) || !range) return [];
  const seed = seedOf(save);
  const count = 1 + (seed % 2);
  const [lo, hi] = range;
  const part = Math.floor(((hi - lo + 1) * 2) / count);
  return Array.from({ length: count }, (_, i) => (lo - 1) * 2 + i * part + (mix(seed + (i + 1) * 7919) % part));
}

const halfDay = (save) => (fortuneDay(save) - 1) * 2 + (save.slot >= 1 ? 1 : 0);
const stampOf = (save) => `${save.chapter}:${save.day}:${save.slot >= 1 ? 1 : 0}`;

function record(save) {
  const plan = fortunePlan(save);
  const r = save.flags[KEY];
  if (!r || r.chapter !== save.chapter || !Array.isArray(r.shown) || !Array.isArray(r.used)
    || r.shown.length !== plan.length || r.used.length !== plan.length) {
    save.flags[KEY] = { chapter: save.chapter, shown: plan.map(() => null), used: plan.map(() => false) };
  }
  return save.flags[KEY];
}

/**
 * 時間帯の初めに一度呼ぶ（日常ループの行き先選び）。予定の時間帯が来ていて、今が空いていれば、ここに現れる。
 * 戻り値＝この時間帯に現れているか。記録は書き換えるが、ここで保存しなくてよい（次の行動の精算で保存される。
 * 保存前に読み直しても、同じ時間帯に同じく現れる）。
 * @param busy 今の時間帯に予定があるか（夜の固定の予定・約束・休養）。あれば次の空いた時間帯へずれる
 * @param where 今いる地域（"home" | "tokyo"）。それ以外（柚ヶ谷・ドバイ）にいる間は現れず、ずれる
 */
export function syncFortune(save, { busy = false, where = "home" } = {}) {
  if (!save?.flags || !FORTUNE_CHAPTERS.includes(save.chapter)) return false;
  if (save.chapter === 1 && !fortuneRumorHeard(save)) return false;
  if (where === "tokyo" && !TOKYO_CHAPTERS.includes(save.chapter)) return false;
  const plan = fortunePlan(save);
  const r = record(save);
  const now = halfDay(save), key = stampOf(save);
  if (r.shown.some((entry, i) => entry?.key === key && !r.used[i])) return true; // 同じ時間帯にもう現れている
  for (let i = 0; i < plan.length; i++) {
    if (r.used[i] || r.shown[i]) continue;
    if (plan[i] > now) return false;
    if (busy || !["home", "tokyo"].includes(where)) return false;
    r.shown[i] = { key, where };
    return true;
  }
  return false;
}

/** 今の時間帯（と地域）に現れている予定の番号（いなければ -1）。 */
export function fortuneIndexHere(save, where = null) {
  const r = save?.flags?.[KEY];
  if (!r || r.chapter !== save.chapter || !Array.isArray(r.shown)) return -1;
  const key = stampOf(save);
  return r.shown.findIndex((entry, i) => entry?.key === key && !r.used?.[i] && (where === null || entry.where === where));
}
export const fortuneHere = (save, where = null) => fortuneIndexHere(save, where) >= 0;

/** 占ってもらった（その出現は終わり。また会うのは次の予定）。 */
export function markFortuneUsed(save) {
  const i = fortuneIndexHere(save);
  if (i < 0) return false;
  save.flags[KEY].used[i] = true;
  return true;
}

/** 今の出現の場所（地図のピンの位置と説明）。 */
export function fortunePosition(save) {
  const i = fortuneIndexHere(save);
  const where = i >= 0 ? save.flags[KEY].shown[i].where : "home";
  const list = where === "tokyo" ? POSITIONS.tokyo : save?.chapter === 5 ? POSITIONS.homeChapter5 : POSITIONS.home;
  return list[(seedOf(save) + Math.max(0, i)) % list.length];
}

/** 開発・テスト用: 今の時間帯・地域に占い師を出す（まだ使っていない予定を1つ使う）。 */
export function placeFortuneNow(save, where = "home") {
  if (!save?.flags || !FORTUNE_CHAPTERS.includes(save.chapter)) return false;
  const r = record(save);
  let k = r.used.findIndex((used, i) => !used && !r.shown[i]);
  if (k < 0) k = r.used.findIndex(used => !used);
  if (k < 0) return false;
  r.shown[k] = { key: stampOf(save), where };
  return true;
}
