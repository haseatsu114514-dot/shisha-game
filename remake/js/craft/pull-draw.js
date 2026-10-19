// 針を止めた一口を最後まで吸ってから、次の操作へ戻す（TH49・51）。
// 時間差と温度の進み方は吸い出し・熱管理で共通。画面が見えている時間で進む。
export const DRAW_MS = { up: 1400, keep: 1900, down: 3200 };

export function drawProgress(elapsed, duration) {
  const p = Math.max(0, Math.min(1, elapsed / duration));
  return p * p * (3 - 2 * p);
}

export function animateDraw({ duration, update, active = () => true, paused = () => false }) {
  return new Promise((resolve) => {
    let elapsed = 0, last = performance.now();
    // 描画が重くても短い一口を長引かせない。タブを隠した時間は数えない。
    const visibility = () => { last = performance.now(); };
    document.addEventListener("visibilitychange", visibility);
    const finish = (complete) => { document.removeEventListener("visibilitychange", visibility); resolve(complete); };
    const frame = (now) => {
      if (!active()) { finish(false); return; }
      if (!document.hidden && !paused()) elapsed += Math.max(0, now - last);
      last = now;
      update(drawProgress(elapsed, duration), elapsed / duration);
      if (elapsed >= duration || !active()) finish(elapsed >= duration);
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
