// 縦画面の試作: ミニゲームを縦の画面で動かすページの共通部品（frame/*.html の各ゲームの起動スクリプトが読む）。
// 本編のゲームをそのまま呼び、画面の並べ方だけ縦用の CSS で替える。本編の進行・保存には触れない（記録はこのページの間だけ覚える）。

/** 縦のステージの幅（ステージ上のpx）。スマホの幅 390px でおよそ 0.61 倍になる。 */
export const STAGE_W = 640;
// 縦横比は、縦試作の枠（index.html の fit）と同じ 39:66〜39:92 の範囲に収める
const MIN_H = STAGE_W * 66 / 39, MAX_H = STAGE_W * 92 / 39;

/** ステージ（#stage）を画面の幅に合わせる。--k（倍率）と --stage-h（ステージの高さ）を入れ、画面の変化に追随する。
 *  onFit({ k, width, height }) は、当て直すたびに呼ぶ。 */
export function initPortraitFit(stage, onFit = null) {
  const fit = () => {
    const view = window.visualViewport;
    const w = view?.width > 0 ? view.width : window.innerWidth, h = view?.height > 0 ? view.height : window.innerHeight;
    if (!(w > 0 && h > 0)) return;
    const k = Math.min(w / STAGE_W, h / MIN_H), height = Math.round(Math.min(h / k, MAX_H));
    stage.style.setProperty("--k", String(k));
    stage.style.setProperty("--stage-h", `${height}px`);
    onFit?.({ k, width: STAGE_W, height }); // ゲームごとの寸法（絵の倍率など）は、ここで決めて CSS へ渡す
  };
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 200));
  window.visualViewport?.addEventListener("resize", fit);
  for (const delay of [100, 500, 1000]) setTimeout(fit, delay);
  return fit;
}

const params = new URLSearchParams(location.search);
/** 一覧（PC）に並べる止め絵の名前（?shot=）。無ければ null＝ふつうに遊ぶ。 */
export const shot = params.get("shot");
if (shot) document.documentElement.dataset.fixed = "";
export const param = name => params.get(name);

/** 縦試作の枠（親のページ）へ知らせる。単体で開いている時は何もしない。 */
export function tellParent(type, detail = {}) {
  if (window.parent !== window) window.parent.postMessage({ source: "portrait-frame", type, ...detail }, location.origin);
}

/** 条件が真になるまで待つ（止め絵の場面を作る時に使う）。 */
export function until(test, { every = 50, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const from = performance.now();
    const tick = () => {
      let value = null;
      try { value = test(); } catch { /* まだ用意できていない */ }
      if (value) resolve(value);
      else if (performance.now() - from > timeout) reject(new Error("止め絵の場面を作れなかった"));
      else setTimeout(tick, every);
    };
    tick();
  });
}
