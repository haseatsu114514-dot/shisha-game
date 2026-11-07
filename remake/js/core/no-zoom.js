// ダブルタップによるページ拡大だけを止める（#2826）。ピンチ拡大は禁止しない。
// touch-action だけでは iOS Safari にダブルタップ拡大が残ることがあるため、
// 「連続タップの2回目」だけを JS で止める。縦スクロール・1回のタップ・ピンチは触らない。
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
  doc.addEventListener("dblclick", event => {
    if (!event.target?.closest?.(NATIVE_INPUT)) event.preventDefault();
  }, { passive: false });
}
