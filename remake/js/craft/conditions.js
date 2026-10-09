// 穴の数・天候は採点の直減点ではなく、実際の温度の動きへつなぐ。
import { clamp } from "../core/util.js";
import { steamSecondsOf, steamHeatFor } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";

export const IDEAL = [0.46, 0.62];
export const OPTIMAL = [0.532, 0.548];
export const isOptimalTemperature = (temp) => temp >= OPTIMAL[0] && temp <= OPTIMAL[1];
/** 温度計の一番上に届くと爆発して焦げる（2026-10-09 オーナー指定 TH06）。蒸らしは0.88で頭打ちのため届かない。 */
export const BURST_TEMP = 1;
export const isBurnt = (temp) => temp >= BURST_TEMP - 1e-6;
/** ここから上は「焦げる寸前」。温度計に危険帯として描き、背景も灼熱になる。 */
export const DANGER_TEMP = 0.9;
/** 提供後（熱管理）にここまで冷えると、シーシャがダメになる（TH19）。 */
export const COLD_OUT = 0.12;
export const isColdOut = (temp) => temp <= COLD_OUT + 1e-6;

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
  const { warmup } = foilHeatProfile(cs.holes);
  const warmth = (at) => {
    const heat = steamHeatFor(at);
    return heat * (heat > 0 ? warmup : 1) * (rainy && heat > 0 ? 0.85 : 1);
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
  const { sparsity } = foilHeatProfile(cs.holes);
  return { rainy: !!cs.environment?.rainy, sparsity };
}

/** 時刻に連続した振れ。フレームごとに乱数を引かず、見える動きへ合わせられる。 */
export function temperatureWave(cs, seconds) {
  return craftConditions(cs).sparsity * 0.09 * Math.sin(seconds * Math.PI * 2 / 2.6);
}

/** 少穴は上下の調整が大きく、雨は熱が入る側だけ少し鈍い。 */
export function heatDelta(cs, delta) {
  const { rainy } = craftConditions(cs);
  return delta * foilHeatProfile(cs.holes).response * (rainy && delta > 0 ? 0.9 : 1);
}

/** 吸い方の判定数ではなく、提供した温度が最適温にどれだけ近いかを評価する。 */
export function pullResult(temp, pulls, _justs, ideal = IDEAL, safePulls = 3) {
  const center = (ideal[0] + ideal[1]) / 2;
  const inZone = temp >= ideal[0] && temp <= ideal[1];
  const optimal = isOptimalTemperature(temp);
  const distance = Math.abs(temp - center), narrow = (OPTIMAL[1] - OPTIMAL[0]) / 2;
  const safe = (ideal[1] - ideal[0]) / 2;
  const leafPenalty = Math.max(0, pulls - safePulls) * 8;
  const thermal = optimal ? 96 + 4 * (1 - distance / narrow)
    : inZone ? 65 + 24 * (1 - (distance - narrow) / (safe - narrow)) : 65 - (distance - safe) * 360;
  return { score: Math.round(clamp(thermal - leafPenalty, 0, 100)), inZone, optimal };
}
