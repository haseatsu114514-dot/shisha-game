const REPEAT_TAP_MS = 350;
const REPEAT_TAP_PX = 30;

export function trackCompletionTaps() {
  let lastTouch = null;
  let repeated = false;
  const near = event => event?.pointerType === "touch" && lastTouch
    && event.timeStamp - lastTouch.time < REPEAT_TAP_MS
    && Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) < REPEAT_TAP_PX;

  return {
    record(event) {
      repeated = Boolean(near(event));
      lastTouch = event?.pointerType === "touch"
        ? { time: event.timeStamp, x: event.clientX, y: event.clientY } : null;
    },
    suppress(event) {
      // 同じ場所の連打だけを引き継ぐ。指が別の場所に移るか、間が空けば通常どおり押せる。
      repeated = repeated && Boolean(near(event));
      if (repeated) lastTouch.time = event.timeStamp;
      return repeated;
    },
  };
}

// 会話の pointerup で旧画面を閉じても、同じタップの click が新しいボタンへ届くことがある。
// クリアカードで新しく押したボタンだけを画面操作に使う。キーボード・支援技術の click はそのまま。
export function guardCompletionCardInput(card, taps) {
  let pressed = null;
  card.addEventListener("pointerdown", event => {
    pressed = taps?.suppress(event) ? null : event.target.closest?.("button") || null;
  }, true);
  card.addEventListener("pointercancel", () => { pressed = null; }, true);
  card.addEventListener("click", event => {
    const button = event.target.closest?.("button"), eligible = pressed === button;
    pressed = null;
    if (!button || event.detail === 0 || eligible) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  return card;
}
