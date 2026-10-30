// 10段の離散効果。SPEC 3.4〜3.5 の値をそのまま保持する。
export const GUTS_STAMINA_BONUS = Object.freeze([0, 5, 10, 18, 25, 32, 40, 48, 54, 60]);
export const REFRESH_RADII = Object.freeze([90, 120, 150, 185, 220, 265, 310, 360, 420, Infinity]);
export const REFRESH_LABELS = Object.freeze([
  "小さな範囲", "小さな範囲", "少し広い範囲", "少し広い範囲", "広い範囲", "広い範囲",
  "かなり広い範囲", "かなり広い範囲", "とても広い範囲", "画面全体",
]);
export const CHARM_BONUS = Object.freeze([0, 250, 500, 850, 1200, 1600, 2000, 2400, 2700, 3000]);
export const refreshRestoresMental = (level) => level >= 5;
export const canSeeMixHint = (level) => level >= 3;
export const canSeeGoldenShort = (level) => level >= 5;
