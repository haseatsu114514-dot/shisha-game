// 制作の時計。説明と非表示タブの時間を、判定・温度・入力から除く。
export function createCraftClock(panel) {
  const guide = panel.closest(".bench")?.querySelector(".bench-guide");
  let last = performance.now(), elapsed = 0;
  const isPaused = () => !!guide?.open || document.hidden;
  let wasPaused = isPaused();
  const now = () => {
    const current = performance.now(), paused = isPaused();
    if (!wasPaused && !paused) elapsed += Math.max(0, current - last);
    last = current; wasPaused = paused;
    return elapsed;
  };
  guide?.addEventListener("toggle", now);
  document.addEventListener("visibilitychange", now);
  return { now, get paused() { return isPaused(); }, dispose() {
    guide?.removeEventListener("toggle", now);
    document.removeEventListener("visibilitychange", now);
  } };
}
