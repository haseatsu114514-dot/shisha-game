// 演出（モーショングラフィックス）を置く舞台（VPO02・2026-11-28 オーナー「モーショングラフィックスも縦画面に最適化して」）。
// 横の本編: ステージ（1280×720）の演出の層 #fx。
// 縦画面（looks/vertical.js）を縦持ちで使っている間: 画面いっぱいの縦長の舞台 #vt-motion（論理の幅 720 × 高さ H。H は画面の縦横比から）。
//   縦の構図を持つ演出（portrait: true で置いたもの）は frameOf(node) で舞台の大きさを読み、縦の並べ方で組む。
//   まだ縦の構図を持たない演出は、横の 1280×720 のまま縦の舞台の真ん中に幅いっぱいで収めて見せる（.vt-mo-wide。上下は暗い幕）。
//   どちらも本編の画面（見えなくしてある）の上ではなく縦の外枠の上に出るので、演出の間は外枠を触れない。
// 縦の舞台の作りと大きさは looks/vertical.js（motionLayer）、見た目は css/look-vertical.css。
import { el } from "./util.js";

export const LAND = Object.freeze({ W: 1280, H: 720, portrait: false });
/** 縦の舞台の論理の幅。高さは画面の縦横比で決まり、最低 PORTRAIT_MIN_H（タブレットの縦持ちなど）。 */
export const PORTRAIT_W = 720;
export const PORTRAIT_MIN_H = 1100;

/** 縦の舞台（縦画面を縦持ちで使っている間だけある）。 */
const portraitLayer = () => (typeof document !== "undefined" && document.documentElement?.dataset?.vt === "on" && document.getElementById?.("vt-motion")) || null;

/** いま演出を縦の舞台で見せるか。 */
export const portraitMotion = () => !!portraitLayer();

function layerFrame(layer) {
  return Object.freeze({ W: PORTRAIT_W, H: Number(layer.dataset.h) || 1280, portrait: true });
}

/** いま演出を置くと使う舞台の大きさ。縦の構図を持たない演出は LAND のまま（真ん中に収める）。 */
export function motionFrame({ portrait = true } = {}) {
  const layer = portraitLayer();
  return layer && portrait ? layerFrame(layer) : LAND;
}

/** node が置かれている舞台の大きさ（縦の構図で置いた演出なら縦の舞台、それ以外は横の 1280×720）。 */
export function frameOf(node) {
  const layer = node?.closest?.("#vt-motion");
  return layer && !node.closest(".vt-mo-wide") ? layerFrame(layer) : LAND;
}

/**
 * 演出の部品を舞台へ置く。portrait: その演出が縦の構図を持つか。
 * 戻り値: { frame（舞台の大きさ）, remove()（置いた物を片付ける） }。横の本編では今までどおり #fx に置く。
 */
export function mountMotion(node, { portrait = false, host = null } = {}) {
  const layer = portraitLayer();
  if (!layer) {
    (host || document.getElementById("fx")).append(node);
    return { frame: LAND, remove: () => node.remove() };
  }
  if (portrait) {
    node.classList.add("mo-portrait");
    layer.append(node);
    return { frame: layerFrame(layer), remove: () => node.remove() };
  }
  // 縦の構図がまだ無い演出: 横の舞台（1280×720）をそのまま、縦の舞台の真ん中に幅いっぱいで置く
  const wide = el("div.vt-mo-wide", { "aria-hidden": "true" }, [el("div.vt-mo-wide-box", [node])]);
  layer.append(wide);
  return { frame: LAND, remove: () => wide.remove() };
}
