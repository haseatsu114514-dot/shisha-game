// 実水量だけを扱う。波・入力・温度・得点は保存値に含めない。
export const WATER = Object.freeze({ neutral: .50, low: .45, high: .55, pour: .12, drain: .03 });

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
