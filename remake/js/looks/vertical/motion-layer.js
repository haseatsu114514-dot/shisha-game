// 縦画面の演出の舞台（#vt-motion・VPO02）。縦持ちで縦画面を使っている間だけ <body> に置く。
// 論理の幅 720 × 高さ H（画面の縦横比から。最低 1100）の箱を、画面に収まる倍率で真ん中に当てる。
// 演出（motions/*）は core/motion-frame.js の mountMotion() でここへ置かれる。空の間は触れない（pointer-events: none）。
// 演出の途中で画面の大きさが変わった時（アドレスバーの出入りなど）は、組み直さずに倍率だけ当て直す（H は演出が終わるまで変えない）。
import { el } from "../../core/util.js";
import { PORTRAIT_W, PORTRAIT_MIN_H } from "../../core/motion-frame.js";

export function createMotionLayer() {
  const layer = el("div.vt-motion#vt-motion", { dataset: { test: "vt-motion" } });
  let height = 0;

  function fit() {
    const view = window.visualViewport;
    const vw = Math.max(1, view?.width || window.innerWidth), vh = Math.max(1, view?.height || window.innerHeight);
    if (!layer.childElementCount || !height) height = Math.max(PORTRAIT_MIN_H, Math.round((PORTRAIT_W * vh) / vw));
    const k = Math.min(vw / PORTRAIT_W, vh / height);
    layer.dataset.h = String(height);
    layer.style.height = `${height}px`;
    layer.style.transform = `translate(${(vw - PORTRAIT_W * k) / 2}px, ${(vh - height * k) / 2}px) scale(${k})`;
  }
  // 演出が置かれた・片付いた時（置かれた時の大きさで組むので、片付いた後に次の大きさを測り直す）
  const watch = new MutationObserver(() => { if (!layer.childElementCount) fit(); });
  watch.observe(layer, { childList: true });

  return {
    root: layer,
    mount() { document.body.append(layer); fit(); },
    relayout: fit,
    unmount() {
      watch.disconnect();
      // 日付の途中で横に戻しても同じ札と終了タイマーを使う。
      const fx = document.getElementById("fx");
      for (const card of layer.querySelectorAll(":scope > :is(.day-card, .tr-dawn)")) {
        card.classList.remove("mo-portrait");
        fx?.append(card);
      }
      layer.remove();
    },
  };
}
