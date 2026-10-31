import { statCap } from "./stats.js";
import { state } from "./state.js";

export const stepOfValue = value => Math.max(1, Math.min(10, Math.ceil((Number(value) || 0) / 10)));

/** 次段の境目は現在段×10+1。上限中は灰色の満タンを表示する。 */
export function nextStepProgress(key, value = state.stats[key]) {
  const current = Math.max(0, Math.min(100, Number(value) || 0));
  const step = stepOfValue(current);
  const capped = current >= statCap(key) || step === 10;
  const remaining = Math.max(0, step * 10 + 1 - current);
  return { step, capped, remaining, fill: capped ? 100 : Math.max(0, Math.min(100, ((current - (step - 1) * 10) / 10) * 100)),
    label: capped ? "この章はここまで" : `次の段まで あと${remaining}P` };
}
