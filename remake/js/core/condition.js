// 体力の色と制作コンディション。HUD・大会・バイトが同じ境界を参照する。
export const STAMINA_CONDITIONS = Object.freeze({
  green: Object.freeze({ health: "green", label: "好調", hint: "手元が冴え、タイミングを合わせやすい", slow: 1.08, window: 1.15, focus: 1.1, bonusRate: 1.15, shiftBonus: 1000 }),
  yellow: Object.freeze({ health: "yellow", label: "通常", hint: "いつもの調子で作れる", slow: 1, window: 1, focus: 1, bonusRate: 1, shiftBonus: 0 }),
  red: Object.freeze({ health: "red", label: "不調", hint: "疲れで手元がぶれ、タイミングがシビア", slow: 0.82, window: 0.65, focus: 0.75, bonusRate: 0.5, shiftBonus: 0 }),
});

export function conditionForRatio(ratio) {
  return STAMINA_CONDITIONS[ratio > 0.5 ? "green" : ratio > 0.25 ? "yellow" : "red"];
}

// レッスンは操作を覚える場。状態を持たない古い工程呼び出しも通常扱いにする。
export const craftCondition = (cs) => cs?.mode === "tutorial" ? STAMINA_CONDITIONS.yellow : cs?.condition || STAMINA_CONDITIONS.yellow;
