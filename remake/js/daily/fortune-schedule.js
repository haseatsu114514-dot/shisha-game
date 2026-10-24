// 路上占い師の出店日（#780）。画面や保存に依存しない判定だけを置く。
/** 出現の前提：つむぎから占い師の噂（LIME）を実際に読んだこと。既読記録だけを根拠にする。 */
export const FORTUNE_RUMOR_ID = "lime_tsumugi_fortune_rumor";
export const fortuneRumorHeard = (s) => !!s?.limeRead?.includes(FORTUNE_RUMOR_ID);
/** 本来の出店日（7日周期の3・6日目） */
export const fortuneScheduled = (day) => day % 7 === 3 || day % 7 === 6;
/**
 * 出店日が雨なら休み、晴れる日まで繰り越す。天気はセーブ固有の種と日付で決まるので、
 * 保存値を増やさずにSAVE/LOAD後も同じ日になる。繰り越し先が本来の出店日でも、開くのは1日1回。
 * @param rainy (day) => boolean
 */
export function fortuneOpenOn(day, rainy) {
  if (!(day >= 1) || rainy(day)) return false;
  if (fortuneScheduled(day)) return true;
  for (let k = day - 1; k >= 1 && day - k <= 7 && rainy(k); k--) if (fortuneScheduled(k)) return true;
  return false;
}
