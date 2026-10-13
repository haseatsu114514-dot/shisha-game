// #401: ゲーム内の温度帯。実測温度ではなく、既存 heat_tolerance だけを使う。
import { DB } from "../core/data.js";

// 基準帯は互換用の読み取り専用定数。一台の配合で上書きしない。
export const IDEAL = Object.freeze([0.42, 0.66]);
export const OPTIMAL = Object.freeze([0.49, 0.59]);
export const DANGER_TEMP = 0.90;
export const BURST_TEMP = 1;
export const COLD_OUT = 0.06;

/** 正の有限なgだけを重みにする。未知の葉・未定義/不正な耐熱性はその葉の倍率1。 */
export function temperatureBands(cs, flavorById = DB.flavorById) {
  const entries = Object.entries(cs?.mix ?? {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  // 重みを正規化して、旧/不正データの極端なgでも合計や積をオーバーフローさせない。
  const largest = entries.reduce((max, [, g]) => Math.max(max, g), 0);
  const weight = entries.reduce((sum, [, g]) => sum + g / largest, 0);
  let t = entries.reduce((sum, [id, g]) => {
    const value = flavorById?.[id]?.heat_tolerance;
    const tolerance = Number.isFinite(value) && value > 0 ? value : 1;
    return sum + tolerance * (g / largest / weight);
  }, 0);
  const validBand = (base) => Number.isFinite(base[1] * t) && base[0] * t > 0 && base[1] * t > base[0] * t;
  if (!Number.isFinite(t) || t <= 0 || !validBand(IDEAL) || !validBand(OPTIMAL)) t = 1;
  return Object.freeze({
    t,
    ideal: Object.freeze(IDEAL.map(value => value * t)),
    optimal: Object.freeze(OPTIMAL.map(value => value * t)),
    center: ((OPTIMAL[0] + OPTIMAL[1]) / 2) * t,
  });
}

export const isIdealTemperature = (temp, bands = temperatureBands()) => temp >= bands.ideal[0] && temp <= bands.ideal[1];
export const isOptimalTemperature = (temp, bands = temperatureBands()) => temp >= bands.optimal[0] && temp <= bands.optimal[1];

/** 基準の演出位置を一台の帯へ移す。緑より上は危険.90までの相対位置、危険以降は絶対値。 */
export function visualTemperature(at, bands = temperatureBands()) {
  if (at <= IDEAL[1]) return at * bands.t;
  if (at >= DANGER_TEMP) return at;
  return bands.ideal[1] + (DANGER_TEMP - bands.ideal[1]) * ((at - IDEAL[1]) / (DANGER_TEMP - IDEAL[1]));
}
