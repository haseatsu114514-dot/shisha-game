// 穴の数・天候は採点の直減点ではなく、実際の温度の動きへつなぐ。
import { clamp } from "../core/util.js";
import { steamSecondsOf, steamHeatFor } from "./steam-time.js";

export const IDEAL = [0.46, 0.62];

/** 温まり方は経過時間で決まる。雑念のミスはこの温度へ入れない。 */
export function temperatureAfterSteam(cs, seconds, jitter = 0) {
  let t = 0.22 + ((cs.heat?.heatPower ?? 50) - 50) / 100 * 0.35;
  if (cs.place === "four") t += 0.12;
  const { rainy } = craftConditions(cs);
  if (rainy) t -= 0.025;
  t += cs.holes?.minimumComplete ? 0.012 : ((cs.holes?.total ?? 22) - 22) * 0.006;
  if (cs.pack === "fluffy") t += 0.03;
  if (cs.pack === "firm") t -= 0.04;
  const chosen = steamSecondsOf(cs), elapsed = clamp(seconds ?? chosen, 0, chosen);
  const warmth = (at) => {
    const heat = steamHeatFor(at);
    return heat * (rainy && heat > 0 ? 0.85 : 1);
  };
  const cold = warmth(0), hot = warmth(chosen);
  const start = clamp(t + jitter + cold, 0.04, 0.88);
  const finish = clamp(t + jitter + hot, 0.12, 0.88);
  // 最終温度のバランスを保ち、下限付近でも蒸らし始めから上昇を見せる。
  const progress = (warmth(elapsed) - cold) / (hot - cold);
  return start + (finish - start) * progress;
}

/** 集中できたほど針はゆっくり、成功帯は広くなる。温度とは独立した操作難易度。 */
export function pullFocusFromSteam(cs) {
  if (!Number.isFinite(cs.steam?.score)) return { slow: 1, window: 1 };
  const focus = clamp(cs.steam.score / 100, 0, 1);
  return { slow: 0.82 + focus * 0.28, window: 0.8 + focus * 0.35 };
}

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
