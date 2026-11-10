// セーブ枠専用の読み取り。表示のために ensureGrowth / growthView / migrate を呼ばない。
import { BOARD_KEYS, BOARD_JA, HIDANE_NAME, statCount, statTotal } from "./growth-board.js";
import { BOARD_VERSION, MAX_LEVEL } from "./growth.js";
import { growthEnabled } from "./growth-mode.js";

const count = value => Number.isSafeInteger(value) ? Math.max(0, value) : 0;

/** 保存済みの Lv・未使用火種・能力マスだけを要約。旧方式や盤を持たない保存は従来表示。 */
export function saveGrowthSummary(data, enabled = growthEnabled()) {
  const g = data?.growth;
  if (!enabled || !g || typeof g !== "object" || Array.isArray(g)) return null;
  const level = Math.min(MAX_LEVEL, Math.max(1, count(g.level)));
  const hidane = ["any", ...BOARD_KEYS].map(key => ({ name: HIDANE_NAME[key], value: count(g.hidane?.[key]) }));
  // 旧型の ID を現在の盤として数えない。読み込み時の返金・移行にもここでは触れない。
  const current = g.boardVersion === BOARD_VERSION;
  const unlocked = new Set(Array.isArray(g.nodes) ? g.nodes.filter(id => typeof id === "string") : []);
  return {
    level,
    hidane: hidane.reduce((sum, entry) => sum + entry.value, 0),
    hidaneText: hidane.map(entry => `${entry.name} ${entry.value}`).join("・"),
    boards: current ? BOARD_KEYS.map(key => ({ key, name: BOARD_JA[key], count: statCount(key, unlocked), total: statTotal(key) })) : null,
    note: current ? null : "別の版の盤（読込時に更新）",
  };
}
