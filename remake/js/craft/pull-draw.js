// 針を止めた一口を最後まで吸ってから、次の操作へ戻す（TH49・51）。
// 時間差と温度の進み方は吸い出し・熱管理で共通。実時間は画面が動いている分だけ進む。
export const DRAW_MS = { up: 1400, keep: 1900, down: 3200 };

export function drawProgress(elapsed, duration) {
  const p = Math.max(0, Math.min(1, elapsed / duration));
  return p * p * (3 - 2 * p);
}

export function animateDraw({ duration, update, active = () => true }) {
  return new Promise((resolve) => {
    let elapsed = 0, last = performance.now();
    const frame = (now) => {
      if (!active()) { resolve(false); return; }
      elapsed += Math.min(50, Math.max(0, now - last));
      last = now;
      update(drawProgress(elapsed, duration), elapsed / duration);
      if (elapsed >= duration || !active()) resolve(elapsed >= duration);
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
