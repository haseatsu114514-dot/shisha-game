// 制作の時計。説明と非表示タブ、縦持ちの回転ガード（#2941・core/rotate-guard.js）の時間を、判定・温度・入力から除く。
export function createCraftClock(panel, doc = globalThis.document) {
  const bench = panel.closest?.(".bench");
  const guide = bench?.querySelector(".bench-guide");
  let last = performance.now(), elapsed = 0;
  const isPaused = () => !!guide?.open || bench?.dataset.demoPaused === "true" || !!doc?.hidden
    || doc?.documentElement?.dataset?.rotateGuard === "true";
  let wasPaused = isPaused();
  const listeners = [];
  const sync = () => {
    const current = performance.now(), paused = isPaused();
    if (!wasPaused && !paused) elapsed += current - last;
    last = current;
    if (paused !== wasPaused) {
      wasPaused = paused;
      for (let i = 0; i < listeners.length; i++) listeners[i](paused);
    }
    return elapsed;
  };
  const now = () => sync();
  guide?.addEventListener("toggle", sync);
  doc?.addEventListener("visibilitychange", sync);
  doc?.addEventListener("rotateguardchange", sync);
  const demoObserver = bench && typeof MutationObserver === "function"
    ? new MutationObserver(sync) : null;
  demoObserver?.observe(bench, { attributes: true, attributeFilter: ["data-demo-paused"] });
  return {
    now,
    get paused() { return isPaused(); },
    onPauseChange(fn) {
      listeners.push(fn);
      return () => {
        const index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    dispose() {
      guide?.removeEventListener("toggle", sync);
      doc?.removeEventListener("visibilitychange", sync);
      doc?.removeEventListener("rotateguardchange", sync);
      demoObserver?.disconnect();
      listeners.length = 0;
    },
  };
}
