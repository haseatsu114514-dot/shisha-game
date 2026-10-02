// 穴の数・天候は採点の直減点ではなく、実際の温度の動きへつなぐ。
import { clamp } from "../core/util.js";

export function craftConditions(cs) {
  const count = Number.isFinite(cs.holes?.total) ? cs.holes.total : 24;
  const sparsity = cs.holes ? clamp((24 - count) / 12, 0, 1) : 0;
  return { rainy: !!cs.environment?.rainy, sparsity };
}

/** 時刻に連続した振れ。フレームごとに乱数を引かず、見える動きへ合わせられる。 */
export function temperatureWave(cs, seconds) {
  return craftConditions(cs).sparsity * 0.09 * Math.sin(seconds * Math.PI * 2 / 2.6);
}

/** 少穴は上下の調整が大きく、雨は熱が入る側だけ少し鈍い。 */
export function heatDelta(cs, delta) {
  const { rainy, sparsity } = craftConditions(cs);
  return delta * (1 + sparsity * 0.25) * (rainy && delta > 0 ? 0.9 : 1);
}

export const EDGE_WIDTH = 0.012;
export function isTemperatureEdge(temp, ideal) {
  return temp >= ideal[0] && temp <= ideal[1]
    && (temp <= ideal[0] + EDGE_WIDTH + 1e-9 || temp >= ideal[1] - EDGE_WIDTH - 1e-9);
}

/** 中央の安全な提供もSに届く。細い端は同条件ならさらに2〜6点高い。 */
export function pullResult(temp, pulls, justs, ideal) {
  const center = (ideal[0] + ideal[1]) / 2;
  const inZone = temp >= ideal[0] && temp <= ideal[1];
  const edge = isTemperatureEdge(temp, ideal);
  const leafPenalty = Math.max(0, pulls - 3) * 8;
  let score = inZone
    ? (edge ? 96 + Math.min(4, justs * 3) : Math.min(94, 100 - Math.abs(temp - center) * 260 + justs * 3)) - leafPenalty
    : 100 - Math.abs(temp - center) * 260 + justs * 3 - leafPenalty - 10;
  return { score: Math.round(clamp(score, 0, 100)), inZone, edge };
}
