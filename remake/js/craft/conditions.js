// 穴の数・天候は採点の直減点ではなく、実際の温度の動きへつなぐ。
import { clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { mixMasteryProfile } from "../core/flavor-mastery.js";
import { steamSecondsOf, steamHeatFor } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";
import { steamClimate } from "./steam-climate.js";
import { coalWarmth } from "./coals.js";
import { temperatureBands, temperatureFitness, isIdealTemperature, isOptimalTemperature } from "./temperature-model.js";
import { BURST_TEMP, COLD_OUT } from "./temperature-model.js";

export { IDEAL, OPTIMAL, DANGER_TEMP, BURST_TEMP, COLD_OUT, temperatureBands, isIdealTemperature, isOptimalTemperature, visualTemperature } from "./temperature-model.js";
// 熱い構成・長い蒸らしは過熱する。吸い出しで実温度を見て調整する。
export const STEAM_LIMIT = .88;
/** 温度計の一番上に届くと爆発して焦げる。 */
export const isBurnt = (temp) => temp >= BURST_TEMP - 1e-6;
/** 提供後（熱管理）にここまで冷えると、シーシャがダメになる（TH19）。 */
export const isColdOut = (temp) => temp <= COLD_OUT + 1e-6;

/** 温まり方は経過時間・気候・その一台の熱の入り方で決まる。雑念のミスは入れない。 */
export function temperatureAfterSteam(cs, seconds, variation = 0) {
  const climate = steamClimate(cs.environment);
  const jitter = typeof variation === "number" ? variation : variation.offset ?? 0;
  const transfer = typeof variation === "number" ? 1 : variation.transfer ?? 1;
  const chosen = steamSecondsOf(cs), elapsed = clamp(seconds ?? chosen, 0, chosen);
  const { warmup } = foilHeatProfile(cs.holes);
  const power = coalWarmth(cs).power;
  const burn = clamp(.7 + (cs.heat?.heatPower ?? 50) / 100 * .6, .65, 1.3);
  const pack = cs.pack === "firm" ? .85 : cs.pack === "fluffy" ? 1.08 : 1;
  const grams = cs.mixInfo?.total || Object.values(cs.mix || {}).reduce((a, b) => a + b, 0) || 12;
  const load = clamp(12 / grams, .65, 1.1);
  const start = clamp(.055 + climate.offset * .3 + jitter * .25, .04, .12);
  // タイマーの選択によって途中の曲線を書き換えない。同じ構成の5分時点は10分設定でも同じ。
  const gain = (steamHeatFor(elapsed) + .14) * 1.6 * power * burn * pack * load * warmup * climate.transfer * transfer;
  // 上限は漸近的に近づけ、4個や10分でも途中で温度が張り付かない。
  const available = STEAM_LIMIT - start;
  return clamp(start + available * (1 - Math.exp(-Math.max(0, gain + jitter * elapsed / 600) / available)), .04, STEAM_LIMIT);
}

/** 洞察で部分的に読んだ炭の状態から粗い範囲を描く。実温度をこの範囲へ制限しない。 */
export function steamTemperatureRange(cs, seconds) {
  if (!seconds) return null;
  const selected = { ...cs, steamSeconds: seconds };
  const prediction = cs.steamPrediction ?? { precision: 0, offset: 0, transfer: 1 };
  const basePrecision = clamp(prediction.precision ?? 0, 0, 1);
  const mastery = mixMasteryProfile(cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state, cs.mix, DB.flavorById);
  const precision = basePrecision + (1 - basePrecision) * mastery.forecastGain;
  const readBonus = clamp(prediction.readBonus || 0, 0, .3), observedRead = Math.min(.9, precision * .6 + readBonus);
  // 洞察と慣れで読み取れる分だけ予測へ反映。実温度や許容帯そのものは変えない。
  const observed = cs.steamVariation ? {
    offset: cs.steamVariation.offset * observedRead,
    transfer: 1 + (cs.steamVariation.transfer - 1) * observedRead,
  } : prediction;
  const nominal = temperatureAfterSteam(selected, seconds, observed);
  const margin = (steamClimate(cs.environment).rainy ? .085 : .075) - precision * .04 - readBonus * .05;
  const step = .05 - .025 * precision - readBonus * .025;
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

/** 少穴は上下の調整が大きく、雨は熱が入る側だけ少し鈍い。 */
export function heatDelta(cs, delta) {
  const { rainy } = craftConditions(cs);
  return delta * foilHeatProfile(cs.holes).response * (rainy && delta > 0 ? 0.9 : 1)
    * (delta > 0 ? coalWarmth(cs).pullResponse : 1);
}

/** 提供時の温度で評価。表情を作り分けられる葉は適温帯内の低め・高めも成功。 */
export function pullResult(temp, pulls, _justs, bands = temperatureBands(), safePulls = 3) {
  const inZone = isIdealTemperature(temp, bands);
  const optimal = isOptimalTemperature(temp, bands);
  const leafPenalty = Math.max(0, pulls - safePulls) * 8;
  const thermal = temperatureFitness(temp, bands);
  return { score: Math.round(clamp(thermal - leafPenalty, 0, 100)), thermal, inZone, optimal };
}
