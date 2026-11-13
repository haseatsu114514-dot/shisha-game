// DAY7 中間準備の、なるとの一台勝負（#1089）。スミさんが二人の煙を吸い比べて講評する。
//   はじめの一台は実制作の値（穴あけ・熱管理・仕上がり・2回の調整）だけで点を出す。
//   なるの一台は操作しないので、「基礎が異常に堅い」を数値にした固定の基準点と比べる。
// 費用・在庫・好感度・本大会の審査員と票には触れない。結果は講評の分かれ道にだけ使う。
import { temperatureBands, isIdealTemperature } from "../craft/temperature-model.js";

// なる側の基準点。total はリハーサルの good 境界（68）より少し上、heat は堅い熱の芯。
export const NARU_MATCH_BASELINE = Object.freeze({ total: 74, heat: 80 });
// 基準点からこの幅の内側は引分け。
export const NARU_MATCH_DRAW_MARGIN = 4;

const avg = (...values) => { const f = values.filter(Number.isFinite); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; };

// 実制作から勝敗と講評の材料を決める。保存してLOAD後も同じ講評を出すため、純粋な値だけ返す。
// shisha は呼び出し側の computeShisha(cs)（仕上がりの点）。
export function judgeNaruMatch(cs, shisha = null) {
  if (!cs || cs.failed) return { result: "lose", score: 0, heat: "failed", served: "unknown", failed: true };
  const quality = shisha?.craftQuality;
  const score = Math.round(avg(cs.holes?.score, cs.heat?.score, quality, cs.careHistory?.[0]?.score, cs.careHistory?.[1]?.score));
  const diff = score - NARU_MATCH_BASELINE.total;
  const result = diff >= NARU_MATCH_DRAW_MARGIN ? "win" : diff <= -NARU_MATCH_DRAW_MARGIN ? "lose" : "draw";
  const heat = Number.isFinite(cs.heat?.score) && cs.heat.score >= NARU_MATCH_BASELINE.heat ? "hajime" : "naru";
  let served = "unknown";
  const temp = cs.pull?.temp;
  if (Number.isFinite(temp)) {
    const bands = temperatureBands(cs);
    served = isIdealTemperature(temp, bands) ? "ideal" : temp > bands.ideal[1] ? "hot" : "cold";
  }
  return { result, score, heat, served, failed: false };
}

// 講評の組み立て。共通の頭 → 勝敗 → 熱 → 提供 → なるの反応と退店 → スミの締め。
export function naruMatchReviewLines(dialogue, match) {
  const b = dialogue?.branches || {};
  const pick = (key) => b[key] || [];
  return [
    ...pick(match.failed ? "open_failed" : "open"),
    ...pick(`heat_${match.heat}`),
    ...(match.failed ? [] : pick(`served_${match.served}`)),
    ...pick(`result_${match.result}`),
    ...pick(`naru_${match.result}`),
    ...(dialogue?.lines || []),
  ];
}
