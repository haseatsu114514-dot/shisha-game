// 赤い残量で無理した時だけ抽選する。低くなるほど危険だが、0でも必ず寝込むわけではない。
import { conditionForRatio } from "./condition.js";

// チョコザップで体を整えた数日は、同じ無理でも風邪をひきにくい（#621 オーナー依頼）
export const FIT_DAYS = 3;
export const FIT_RISK = 0.35;

export function coldRisk(ratio, { fit = false } = {}) {
  if (!Number.isFinite(ratio) || conditionForRatio(ratio).health !== "red") return 0;
  const strain = 1 - Math.max(0, ratio) / 0.25;
  return (0.04 + 0.81 * Math.pow(strain, 1.35)) * (fit ? FIT_RISK : 1);
}

export const catchesCold = (ratio, random = Math.random, opts = {}) => {
  const chance = coldRisk(ratio, opts);
  return chance > 0 && random() < chance;
};

/** チョコザップに通った日から FIT_DAYS 日（その日を含む）。章が変わったら切れる */
export function fitActive(save) {
  const fit = save?.flags?._fit_since;
  return !!fit && fit.chapter === save.chapter && save.day - fit.day < FIT_DAYS && save.day >= fit.day;
}
