// 第4章DAY12の前日リハーサル。制作結果と講評の進行を宿試作とは別に記録する。

export const REHEARSAL_FLAG = "_ch4_rehearsal";
export const REHEARSAL_IDS = Object.freeze([
  "ch4_rehearsal_intro", "ch4_rehearsal_great", "ch4_rehearsal_good", "ch4_rehearsal_rough", "ch4_rehearsal_burnt",
]);

/** 制作開始はDAY12だけ。完成後の講評は日付を越えても読める。 */
export function rehearsalDue(value) {
  if (value?.chapter !== 4 || value.phase !== "daily" || value.flags?._ch4?.part !== "free") return false;
  const progress = value.flags[REHEARSAL_FLAG];
  if (progress?.result) return progress.feedbackRead !== true;
  const startDay = value.flags._ch4.startDay;
  return Number.isInteger(startDay) && value.day - startDay + 1 === 12;
}

/** 第1章・第2章と同じ五項目の平均と境界を使う。 */
export function rehearsalResult(cs, computeShisha) {
  if (!cs || cs.failed) return "burnt";
  const scores = [cs.holes?.score, cs.heat?.score, computeShisha(cs).craftQuality,
    cs.careHistory?.[0]?.score, cs.careHistory?.[1]?.score].filter(Number.isFinite);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  return average >= 85 ? "great" : average >= 68 ? "good" : "rough";
}
