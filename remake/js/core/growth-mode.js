// 効果・獲得・表示で共有する切替。stateやUIを読まない。
export const GROWTH_BOARD = false;
export const PREVIEW_KEY = "suien_growth_preview";
export function growthEnabled() {
  if (GROWTH_BOARD) return true;
  try { return globalThis.localStorage?.getItem(PREVIEW_KEY) === "1"; } catch { return false; }
}
