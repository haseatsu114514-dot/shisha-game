// ダブルタップ拡大の JS 保険（#2852）。touch-action: manipulation が効かない場合に備え、
// 300ms 以内・30px 以内の2回目の touchend だけ preventDefault する（拡大は止まるが合成 click も消える）。
// 連打入力を落とさないよう、止めた2回目の click は自前で送り直す。1回目・縦スクロール・入力欄は触らない。
// PR #2872 の core/no-zoom.js が入っている場合は同じ役目なので何もしない（二重送信を避ける）。
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;
const NATIVE_INPUT = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function installDoubleTapGuard(doc = document) {
  const win = doc.defaultView;
  if (!win || win.__suienNoZoom || win.__suienDoubleTapGuard) return;
  win.__suienDoubleTapGuard = true;
  let last = null;
  doc.addEventListener("touchend", event => {
    const touch = event.changedTouches?.[0];
    if (!touch || event.touches.length || event.target?.closest?.(NATIVE_INPUT)) return;
    const near = last && event.timeStamp - last.time <= DOUBLE_TAP_MS
      && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) <= DOUBLE_TAP_PX;
    last = near ? null : { time: event.timeStamp, x: touch.clientX, y: touch.clientY };
    if (!near || !event.cancelable) return;
    event.preventDefault();
    const target = doc.elementFromPoint(touch.clientX, touch.clientY) || event.target;
    target.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: win, detail: 1,
      clientX: touch.clientX, clientY: touch.clientY, screenX: touch.screenX, screenY: touch.screenY,
    }));
  }, { passive: false });
}
