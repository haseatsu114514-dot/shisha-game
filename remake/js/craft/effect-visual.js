import { el } from "../core/util.js";
import { config } from "../core/state.js";
import { step } from "../core/stats.js";

export const effectVisible = key => config.statEffectColors !== false && step(key) > 1;
export const effectTier = key => (step(key) - 1) / 9;
export const effectBadge = (key, text, className = "") => effectVisible(key)
  ? el(`span.effect-badge.effect-${key}${className ? `.${className}` : ""}`, { text, "aria-label": `${key === "sense" ? "センス" : key === "technique" ? "技術" : key === "insight" ? "洞察" : key === "guts" ? "根性" : "魅力"}の効果` })
  : null;
/** センスによる拡張率。素の成功幅を入力すると拡張部分の幅を返す。 */
export const senseExtra = baseWidth => effectVisible("sense") ? baseWidth * 0.45 * effectTier("sense") : 0;
export function senseBand(baseWidth, scale = 1, exactExtra = senseExtra(baseWidth)) {
  if (!effectVisible("sense")) return null;
  const extra = exactExtra;
  return el("div.craft-sense-band", { dataset: { base: String(baseWidth), extra: String(extra) }, "aria-label": "センスで広がった成功帯" }, [
    effectBadge("sense", "感"), el("i.craft-sense-base", { style: { width: `${baseWidth * scale}px` } }),
    el("i.craft-sense-extra", { style: { width: `${extra * scale}px` } }),
  ]);
}
export const effectLine = (key, badge, text) => effectVisible(key)
  ? el(`span.effect-line.effect-${key}`, [effectBadge(key, badge), el("span", { text })]) : null;
