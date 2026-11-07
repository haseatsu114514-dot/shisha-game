// ダブルタップ／ピンチによるページ拡大を止める（#2826）。
// iOS Safari は viewport の user-scalable=no を無視し、touch-action だけでも拡大が残ることがある。
// そこで「連続タップの2回目」と gesture 系イベントだけを JS で止める。縦スクロールと1回のタップは触らない。
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 40;
const NATIVE_INPUT = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function installNoZoom(doc = document) {
  if (doc.defaultView?.__suienNoZoom) return;
  if (doc.defaultView) doc.defaultView.__suienNoZoom = true;
  let last = null;
  // 2回目の touchend を止めると合成 click も消えるため、連打入力を落とさないよう click だけ自前で送り直す。
  doc.addEventListener("touchend", event => {
    const touch = event.changedTouches?.[0];
    if (!touch || event.touches.length || event.target?.closest?.(NATIVE_INPUT)) return;
    const now = event.timeStamp;
    const near = last && now - last.time < DOUBLE_TAP_MS
      && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < DOUBLE_TAP_PX;
    last = near ? null : { time: now, x: touch.clientX, y: touch.clientY };
    if (!near || !event.cancelable) return;
    event.preventDefault();
    const target = doc.elementFromPoint(touch.clientX, touch.clientY) || event.target;
    target.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: doc.defaultView, detail: 1,
      clientX: touch.clientX, clientY: touch.clientY, screenX: touch.screenX, screenY: touch.screenY,
    }));
  }, { passive: false });
  // iOS Safari のピンチ・ダブルタップ拡大は gesture 系イベントとして届く。
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    doc.addEventListener(type, event => event.preventDefault(), { passive: false });
  }
  doc.addEventListener("dblclick", event => {
    if (!event.target?.closest?.(NATIVE_INPUT)) event.preventDefault();
  }, { passive: false });
}
