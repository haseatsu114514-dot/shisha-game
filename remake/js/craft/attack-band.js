// 桜井式の「攻めの帯」（第1章の大会・試作。docs/owner_requests.md の SKR04）。
// 適温帯の上の端。ここで提供・調整を終えると、その回の審査に上積みが乗る（craft/ch1-votes.js の SAKURAI）。
// 帯を越えると適温を外れ、点は今までどおり下がる（崖のそばに宝を置く。桜井氏の動画 #006・#065）。
// いままでの審査（vote-style の classic）・練習・ほかの章では出さない。帯の中の温度の点は最適温と同じ満点として扱う。

/** from: 最適温の上端から適温の上端までのうち、帯が始まる位置（0＝最適温の上端・1＝適温の上端）。bonus: その回の審査の上積み */
export const ATTACK_BAND = Object.freeze({ from: .45, bonus: 4 });

/** この一台で攻めの帯を出すか。大会で、桜井式の試合のときだけ。 */
export const attackGuide = (cs) => cs?.mode === "tournament" && cs?.voteStyle === "sakurai";

/** 帯の範囲。葉が傷んで適温帯が細くなると、帯も一緒に細くなる。 */
export function attackRange(bands) {
  const top = bands?.ideal?.[1], edge = bands?.optimal?.[1];
  if (!Number.isFinite(top) || !Number.isFinite(edge) || top <= edge) return null;
  return { low: edge + (top - edge) * ATTACK_BAND.from, high: top };
}

export const inAttackRange = (temp, range) =>
  Number.isFinite(temp) && !!range && temp >= range.low - 1e-9 && temp <= range.high + 1e-9;

/** 帯の中で出した一台の点。温度は満点として扱い、吸いすぎの減点（1口ごとに8）は残す。 */
export function attackScore(pulls, safePulls) {
  const extra = Math.max(0, (Number(pulls) || 0) - (Number(safePulls) || 0));
  return Math.round(Math.max(0, Math.min(100, 100 - extra * 8)));
}
