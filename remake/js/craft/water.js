// 実水量だけを扱う。波・入力・温度・得点は保存値に含めない。
export const WATER = Object.freeze({ neutral: .50, low: .45, high: .55, pour: .12, drain: .03 });
export const STEM_TIP = .30;
export const DEEP_WATER_LIMIT = .85;

/** 水由来の吸い心地。未設定の古い台は減点しない（保存された0は水なし）。 */
export function waterComfort(q) {
  if (typeof q !== "number" || !Number.isFinite(q)) return { band: "ideal", drawW: 0, bubble: 1 };
  // ステムに届かない区分の固定減点は、§3.2の指定どおり先端で段差を持つ。
  if (q < STEM_TIP) return { band: "none", drawW: -10, bubble: 0 };
  if (q < WATER.low) return { band: "shallow", drawW: -5 * (WATER.low - q) / (WATER.low - STEM_TIP), bubble: .75 };
  if (q <= WATER.high) return { band: "ideal", drawW: 0, bubble: 1 };
  return { band: "deep", drawW: -8 * Math.min(1, (q - WATER.high) / (DEEP_WATER_LIMIT - WATER.high)), bubble: 1 };
}

export function waterQuantity(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : WATER.neutral;
}

export function changeWater(q, direction, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return waterQuantity(q);
  const rate = direction === "pour" ? WATER.pour : direction === "drain" ? -WATER.drain : 0;
  return waterQuantity(waterQuantity(q) + rate * seconds);
}

export function waterBand(q) {
  const value = waterQuantity(q);
  return value < WATER.low ? "low" : value > WATER.high ? "high" : "ideal";
}
