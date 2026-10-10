// 穴の数・天候は採点の直減点ではなく、実際の温度の動きへつなぐ。
import { clamp } from "../core/util.js";
import { steamSecondsOf, steamHeatFor } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";
import { steamClimate } from "./steam-climate.js";

// TH83: 適温（緑）を約1.5倍の0.42〜0.66へ広げる。中心0.54は維持。
export const IDEAL = [0.42, 0.66];
// TH66・TH84: 狙いたくなる広い虹色（約1.7倍）。見た目と最適温の判定に同じ範囲を使う。
export const OPTIMAL = [0.49, 0.59];
// 蒸らしは適温の入口まで。虹へは吸い出しで仕上げる（SF05）。
export const STEAM_LIMIT = OPTIMAL[0] - .025;
export const isOptimalTemperature = (temp) => temp >= OPTIMAL[0] && temp <= OPTIMAL[1];
/** 温度計の一番上に届くと爆発して焦げる。蒸らしだけでは最適温にも届かない。 */
export const BURST_TEMP = 1;
export const isBurnt = (temp) => temp >= BURST_TEMP - 1e-6;
/** ここから上は「焦げる寸前」。温度計の約10%を危険帯にする。爆発は1、蒸らしはSTEAM_LIMITで止まる。 */
export const DANGER_TEMP = 0.90;
/** 提供後（熱管理）にここまで冷えると、シーシャがダメになる（TH19）。 */
export const COLD_OUT = 0.06;
export const isColdOut = (temp) => temp <= COLD_OUT + 1e-6;

/** 温まり方は経過時間・気候・その一台の熱の入り方で決まる。雑念のミスは入れない。 */
export function temperatureAfterSteam(cs, seconds, variation = 0) {
  const climate = steamClimate(cs.environment);
  const jitter = typeof variation === "number" ? variation : variation.offset ?? 0;
  const transfer = typeof variation === "number" ? 1 : variation.transfer ?? 1;
  let t = 0.22 + ((cs.heat?.heatPower ?? 50) - 50) / 100 * 0.35;
  if (cs.place === "four") t += 0.12;
  t += climate.offset;
  t += cs.holes?.minimumComplete ? 0.012 : ((cs.holes?.total ?? 22) - 22) * 0.006;
  if (cs.pack === "fluffy") t += 0.03;
  if (cs.pack === "firm") t -= 0.04;
  const chosen = steamSecondsOf(cs), elapsed = clamp(seconds ?? chosen, 0, chosen);
  const { warmup } = foilHeatProfile(cs.holes);
  const warmth = (at) => {
    const heat = steamHeatFor(at);
    return heat * (heat > 0 ? warmup * climate.transfer * transfer : 1);
  };
  const cold = warmth(0), hot = warmth(chosen);
  const start = clamp(t + jitter + cold, 0.04, STEAM_LIMIT - .03);
  const finish = clamp(t + jitter + hot, 0.12, STEAM_LIMIT);
  // 最終温度のバランスを保ち、下限付近でも蒸らし始めから上昇を見せる。
  const progress = hot === cold ? 0 : (warmth(elapsed) - cold) / (hot - cold);
  return start + (finish - start) * progress;
}

/** 洞察で部分的に読んだ炭の状態から粗い範囲を描く。実温度をこの範囲へ制限しない。 */
export function steamTemperatureRange(cs, seconds) {
  if (!seconds) return null;
  const selected = { ...cs, steamSeconds: seconds };
  const prediction = cs.steamPrediction ?? { precision: 0, offset: 0, transfer: 1 };
  const precision = clamp(prediction.precision ?? 0, 0, 1);
  const nominal = temperatureAfterSteam(selected, seconds, prediction);
  const margin = (steamClimate(cs.environment).rainy ? .085 : .075) - precision * .04;
  const step = .05 - .025 * precision;
  // 端で片側だけを切ると、予測の中心が移る際に上位の洞察ほど幅が広く見えてしまう。
  // 範囲を丸ごと物理的な上限・下限へ収め、どの温度でも洞察による幅の縮小を保つ。
  const center = clamp(Math.round(nominal / step) * step, .08 + margin, STEAM_LIMIT - margin);
  return {
    low: center - margin,
    high: center + margin,
  };
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
