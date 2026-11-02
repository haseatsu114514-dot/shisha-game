// 効果・獲得・表示で共有する切替。stateやUIを読まない。
// 2026-11-02 オーナー「観音やモスクで割り振れるように実装して」→ 心得の盤を通常プレイで有効にした（SBD97）。
// 開発・検査で旧しくみ（能力の直接成長）を見る時だけ、URL の ?growth=0（または __remake.dev.growth(false)）でこの端末を戻せる。
export const GROWTH_BOARD = true;
export const PREVIEW_KEY = "suien_growth_preview";
export function growthEnabled() {
  try {
    const value = globalThis.localStorage?.getItem(PREVIEW_KEY);
    if (value === "0") return false;
    if (value === "1") return true;
  } catch { /* 読めない環境は既定どおり */ }
  return GROWTH_BOARD;
}
