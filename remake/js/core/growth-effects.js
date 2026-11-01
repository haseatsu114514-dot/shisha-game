// 通常のマス・色の台座の実効値。仮置きは含めず、確定した有効なIDを一度だけ数える。
import { growthEnabled } from "./growth-mode.js";
import { NODE_BY_ID } from "./growth-board-layout.js";
import { SQUARE_PERKS, PERK_TIERS, GATE_TIER, NOTABLES } from "./growth-board-data.js";

/** 表示と処理が共有する帯・要の倍率。 */
export const perkMultiplier = node => (node.kind === "gate" ? GATE_TIER.mult : PERK_TIERS[node.band]?.mult || 1)
  * (node.notable ? NOTABLES[node.notable]?.bonus || 1 : 1);

export function boardPerks(nodes = []) {
  const sums = { stamina: 0, sleep: 0, charm: 0, stage: 0, heat: 0, pull: 0,
    dodge: 0, breath: 0, gauge: 0, leaf: 0, tongue: 0, coal: 0 };
  for (const id of new Set(Array.isArray(nodes) ? nodes : [])) {
    const node = NODE_BY_ID[id];
    if (!node || !["stat", "gate"].includes(node.kind)) continue;
    const def = SQUARE_PERKS[node.board], perk = !node.peak && def.perks[node.perk];
    if (perk) {
      const unit = Number(/\{([\d.]+)\}/.exec(perk.text)?.[1] || 0);
      if (Object.hasOwn(sums, node.perk)) sums[node.perk] += unit * perkMultiplier(node);
    } else if (node.kind === "stat") {
      // 極みの「基礎」。通常マスとは別の複合効果（盤データの base）。
      const base = { body: { stamina: 1, sleep: 1 }, sense: { dodge: 1, heat: .5, pull: .5 },
        wisdom: { gauge: .5, leaf: 1 } }[node.board];
      for (const [key, value] of Object.entries(base)) sums[key] += value * perkMultiplier(node);
    }
  }
  return sums;
}

/** 旧能力の値は互換用に保持する。既存の効き目との比較は各使用箇所で行う。 */
export const growthPerks = s => growthEnabled() ? boardPerks(s?.growth?.nodes) : null;
