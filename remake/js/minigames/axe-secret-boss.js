// 独立した斧投げページ専用の解放記録。本編のセーブや好感度には触れない。
const KEY = "shisha_axe_adam_unlocked";
export const adamUnlocked = (storage = localStorage) => storage.getItem(KEY) === "1";
export function recordAdamUnlock(result, storage = localStorage) {
  const won = result?.completed && result.opponent === "hiyori" && result.match?.difficulty === "hard"
    && (result.series?.winner || result.match.winner) === "player";
  if (won && !adamUnlocked(storage)) storage.setItem(KEY, "1");
  return won;
}
