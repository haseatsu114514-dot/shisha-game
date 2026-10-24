// 路上占い師の出店日（#780）。画面や保存に依存しない判定だけを置く。
/** 出現の前提：自主的な客席訪問で、つむぎの噂を最後まで聞いたこと。旧LIME履歴は残すが解放根拠にしない。 */
export const FORTUNE_RUMOR_ID = "lime_tsumugi_fortune_rumor";
export const FORTUNE_RUMOR = "_fortune_rumor_heard";
export const fortuneRumorHeard = (s) => !!s?.flags?.[FORTUNE_RUMOR];
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
