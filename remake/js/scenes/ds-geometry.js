// DS風表示の画面寸法。上が「見る画面」、ヒンジを挟んで下が「触る画面」。
// 縦持ちでは上下を同じ高さにする（オーナー指定 2026-10-24「上画面も下画面も半々ぐらい」）。
// タイトルと本編で同じ値を使い、CSS変数（--ds-*）として :root に置く。

const PAD = 8;
const HINGE = 22;
// 1画面の横幅は高さの4:3まで（PCの縦長ウィンドウで横に間延びさせない）。
const MAX_WIDE = 4 / 3;

/**
 * 縦長（スマホ縦・PCの横長ウィンドウも含む）では上下に並べ、端末を縦に持った形にする。
 * 横長で背の低い画面（スマホ横持ち）だけは、上下に並べると小さすぎるので左右に並べる。
 */
export function dsGeometry(width, height, safe = { top: 0, bottom: 0 }) {
  const w = Math.max(0, width), h = Math.max(0, height);
  const top = PAD + (safe.top || 0), bottom = PAD + (safe.bottom || 0);
  const each = Math.floor(Math.max(0, h - top - bottom - HINGE) / 2);
  const columnWidth = Math.floor(Math.min(w - PAD * 2, each * MAX_WIDE));
  if (columnWidth >= 300 && each >= 200) {
    const vw = columnWidth, vh = each;
    const vx = Math.round((w - vw) / 2), vy = top;
    const cy = vy + vh + HINGE;
    return { layout: "stacked", vx, vy, vw, vh, cx: vx, cy, cw: vw, ch: each, hinge: HINGE };
  }
  // 横持ち: 左に4:3の見る画面、右に触る画面。
  const gap = HINGE;
  const vh = h - top - bottom, vw = Math.min(Math.round(vh * 4 / 3), Math.floor((w - PAD * 2 - gap) / 2));
  const vx = PAD, vy = top, cx = vx + vw + gap;
  return { layout: "side", vx, vy, vw, vh, cx, cy: vy, cw: Math.max(0, w - PAD - cx), ch: vh, hinge: gap };
}

// env(safe-area-inset-*) はCSS変数経由では数値にならないため、見えない要素の余白で読む。
let probe = null;
const safeInsets = () => {
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", width: "0", height: "0",
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" });
    document.body.append(probe);
  }
  const style = getComputedStyle(probe);
  return { top: Number.parseFloat(style.paddingTop) || 0, bottom: Number.parseFloat(style.paddingBottom) || 0 };
};

/** 画面サイズの変化に合わせて :root の --ds-* を更新する。何度呼んでも監視は1つ。 */
let installed = false;
export function installDsGeometry() {
  if (installed) return applyDsGeometry();
  installed = true;
  window.addEventListener("resize", applyDsGeometry);
  window.visualViewport?.addEventListener("resize", applyDsGeometry);
  return applyDsGeometry();
}

export function applyDsGeometry() {
  const width = window.visualViewport?.width || innerWidth, height = window.visualViewport?.height || innerHeight;
  const g = dsGeometry(width, height, safeInsets());
  const root = document.documentElement;
  for (const key of ["vx", "vy", "vw", "vh", "cx", "cy", "cw", "ch", "hinge"]) root.style.setProperty(`--ds-${key}`, `${g[key]}px`);
  root.dataset.dsLayout = g.layout;
  return g;
}
