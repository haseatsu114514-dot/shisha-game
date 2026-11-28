// 縦持ちの回転ガード（#rotate-hint）が出ている間を、ゲーム全体へ知らせる（#2941）。
// ガードの表示は CSS のメディアクエリ（base.css）が決めるので、ここでは実際に出ているかを見るだけにする。
// 出ている間は <html data-rotate-guard="true">。切り替わるたびに document へ "rotateguardchange" を送る。
// 制作の時計（craft/clock.js）と音（core/audio.js）はこの印を読んで止まる（import なしで読めるように DOM で渡す）。
const EVENT = "rotateguardchange";
let installed = false, guarded = false;

export function rotateHintVisible() {
  const hint = document.getElementById("rotate-hint");
  return !!hint && getComputedStyle(hint).display !== "none";
}

export function syncRotateGuard() {
  const next = rotateHintVisible();
  if (next === guarded) return;
  guarded = next;
  if (guarded) document.documentElement.dataset.rotateGuard = "true";
  else delete document.documentElement.dataset.rotateGuard;
  document.dispatchEvent(new Event(EVENT));
}

/** 今ガードが出ているか。 */
export const rotateGuarded = () => guarded;

/** 向き・大きさの変化を見張る（一度だけ）。ページの起動で呼ぶ。 */
export function installRotateGuard() {
  if (installed) return;
  installed = true;
  window.addEventListener("resize", syncRotateGuard);
  window.addEventListener("orientationchange", syncRotateGuard);
  window.visualViewport?.addEventListener("resize", syncRotateGuard);
  window.matchMedia?.("(orientation: portrait)").addEventListener?.("change", syncRotateGuard);
  // 横持ちの案内で、フォーカス済みのボタン・キー送り・背後の dialog も止める。
  const blockLandscapeInput = event => {
    if (document.documentElement.dataset.look !== "vertical" || !window.matchMedia("(orientation: landscape)").matches ||
        !rotateHintVisible()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of ["keydown", "keyup", "click", "pointerdown", "pointerup", "touchstart", "touchend", "cancel"]) {
    window.addEventListener(type, blockLandscapeInput, { capture: true, passive: false });
  }
  syncRotateGuard();
}
