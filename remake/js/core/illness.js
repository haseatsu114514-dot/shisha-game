// 赤い残量で無理した時だけ抽選する。低くなるほど危険だが、0でも必ず寝込むわけではない。
import { conditionForRatio } from "./condition.js";

export function coldRisk(ratio) {
  if (!Number.isFinite(ratio) || conditionForRatio(ratio).health !== "red") return 0;
  const strain = 1 - Math.max(0, ratio) / 0.25;
  return 0.04 + 0.81 * Math.pow(strain, 1.35);
}

export const catchesCold = (ratio, random = Math.random) => {
  const chance = coldRisk(ratio);
  return chance > 0 && random() < chance;
};
