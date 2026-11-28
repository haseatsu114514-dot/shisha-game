// 画面の当て方（共通部品）: 1280×720 の固定ステージを画面に収まる倍率で拡大縮小し、
// 余った分は場面背景のぼかしで埋める（2026-11-09 オーナー決定・#3035、ブラウザアドベンチャー式）。
// 本編（main.js）と試遊ページ（camel-race／axe-throw／desert-ride／craft-preview・#3076）は
// 全てこの部品を使い、ページごとに別の当て方を作らない。
const PHONE_DENSITY_K = 0.62;

// 当て直しの通知。左右の余白の層（core/side-area.js・YHK）が、余白の幅と倍率を知るのに使う。
const fitListeners = new Set();
/** 画面を当て直すたびに fn({ stage, k, region }) を呼ぶ。戻り値は解除の関数。 */
export function onStageFit(fn) {
  fitListeners.add(fn);
  return () => fitListeners.delete(fn);
}

/** ステージ（#stage）へ --k を入れる。region を渡すと、その要素の内側（例: 試遊ページの
 *  ナビの下の #viewport）を画面の代わりに使う。戻り値は倍率 k。 */
export function fitStage(stage, region = null) {
  if (!stage) return 1;
  const viewport = window.visualViewport;
  // URL バーなどを除いた実表示領域を使う。scale を掛け戻すと、ブラウザ側の
  // 拡大やツールバーの変化を打ち消し、実際に見えている範囲からはみ出す。
  let w, h;
  if (region) { w = region.clientWidth; h = region.clientHeight; }
  else if (viewport?.width > 0 && viewport?.height > 0) { w = viewport.width; h = viewport.height; }
  else { w = window.innerWidth; h = window.innerHeight; }
  const portrait = !!stage.dataset.portraitScene;
  const k = portrait ? w / 640 : Math.min(w / 1280, h / 720);
  if (portrait) stage.style.setProperty("--stage-h", Math.round(h / k) + "px");
  else stage.style.removeProperty("--stage-h");
  stage.style.setProperty("--k", String(k));
  // スマホ規格（#2851）: 横持ちスマホ（Plus/Pro Max の 0.60 も含む）で共通部品の文字・タップ部品を大きくする。css/phone-density.css
  // 横長の画面だけ（PC の縦長ウィンドウや縦持ちは対象外。縦持ちのスマホは横向きの案内になる）
  if (portrait || (k < PHONE_DENSITY_K && w > h)) document.documentElement.dataset.density = "phone";
  else delete document.documentElement.dataset.density;
  // ワイド拡張（#2861: ステージを最大1600まで広げる方式）は廃止した（#3035）。
  stage.style.removeProperty("--stage-w");
  stage.style.removeProperty("--stage-bar");
  delete stage.dataset.wide;
  for (const fn of fitListeners) fn({ stage, k, region });
  return k;
}

/** fitStage を呼び、画面の変化（リサイズ・回転・ブラウザchrome の出し入れ）へ追随させる。 */
export function initStageFit(stage, region = null) {
  const fit = () => fitStage(stage, region);
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 200));
  window.visualViewport?.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("scroll", fit);
  // iOS のブラウザ chrome は起動直後、イベントより遅れて表示領域が確定することがある。
  for (const delay of [100, 500, 1000]) setTimeout(fit, delay);
  return fit;
}

// 余白のぼかし（#3035）: ステージ外の余白には、その場面の背景をぼかして敷く（#backdrop・base.css）。
// 背景の差し替えが確定した所で同じ絵へ替える。ぼかし＋減光なので、ステージ側の
// クロスフェードと厳密に同期しなくても境目は見えない。setBg（core/ui.js）から呼ぶ。
let backdropUrl = null;
let backdropTimer = null;
let backdropRevision = 0;
let backdropRaster;

function paintBackdrop(bd, raster, image = null) {
  const { canvas, ctx, source, sourceCtx } = raster;
  if (image) {
    // リサイズや色調変更には、元画像の代わりに小さな写しを再利用する。
    const shrink = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    source.width = Math.max(1, Math.round(image.naturalWidth * shrink));
    source.height = Math.max(1, Math.round(image.naturalHeight * shrink));
    sourceCtx.drawImage(image, 0, 0, source.width, source.height);
    canvas.dataset.source = image.src;
  } else if (!canvas.dataset.source) return;

  const width = Math.max(1, bd.clientWidth), height = Math.max(1, bd.clientHeight);
  const filter = getComputedStyle(bd).getPropertyValue("--backdrop-filter").trim();
  if (!image && canvas.width === width && canvas.height === height && raster.filter === filter) return;
  canvas.width = width;
  canvas.height = height;
  // center / cover と同じ切り抜きを、小さな描画面の中でぼかしてから拡大する。
  const scale = Math.max(width / source.width, height / source.height);
  const sw = width / scale, sh = height / scale;
  ctx.filter = filter;
  ctx.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, 0, 0, width, height);
  raster.filter = filter;
}

// 描画は次のフレームへ回す。ui.setBg が新しい背景の層を置いてから .show を付けるまでの間に
// レイアウトやスタイルを読む（clientWidth や getComputedStyle）と、その強制再計算が
// 即時切り替えのはずの層のクロスフェードを始めてしまう（#3203 で検出）。
// 読み取りを含む paintBackdrop は、フレーム境界の向こう側か ResizeObserver の中だけで呼ぶ。
function queueBackdropPaint(bd, raster, image = null) {
  const revision = backdropRevision;
  requestAnimationFrame(() => {
    if (revision !== backdropRevision) return;
    paintBackdrop(bd, raster, image);
    if (image) {
      if (!raster.canvas.isConnected) bd.append(raster.canvas);
      bd.classList.add("backdrop-raster");
    }
  });
}

function createBackdropRaster(bd) {
  if (typeof ResizeObserver !== "function" || typeof Image !== "function") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !("filter" in ctx)) return null;
  const source = document.createElement("canvas");
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx) return null;
  const raster = { canvas, ctx, source, sourceCtx, filter: "" };
  new ResizeObserver(() => paintBackdrop(bd, raster)).observe(bd);
  return raster;
}

export function syncBackdrop(url, tint, instant) {
  const bd = typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById("backdrop") : null;
  if (!bd) return;
  const tone = tint || "";
  if (bd.dataset.tint !== tone) {
    bd.dataset.tint = tone;
    if (backdropRaster) queueBackdropPaint(bd, backdropRaster);
  }
  if (backdropUrl === (url || "")) return;
  backdropUrl = url || "";
  clearTimeout(backdropTimer);
  const revision = ++backdropRevision;
  if (backdropRaster === undefined && url) backdropRaster = createBackdropRaster(bd);
  const raster = backdropRaster;
  const commit = (image) => {
    if (revision !== backdropRevision) return;
    if (image) {
      bd.style.backgroundImage = "none";
      queueBackdropPaint(bd, raster, image);
    } else {
      if (raster?.canvas.isConnected) {
        delete raster.canvas.dataset.source;
        raster.source.width = 0;
        raster.canvas.width = 0;
        raster.canvas.remove();
        bd.classList.remove("backdrop-raster");
      }
      bd.style.backgroundImage = url ? `url("${url}")` : "none";
    }
    bd.style.opacity = "";
  };
  const showImage = () => {
    backdropTimer = null;
    if (!url || !raster) { commit(null); return; }
    const image = new Image();
    image.src = url;
    if (image.complete && image.naturalWidth) { commit(image); return; }
    image.onload = () => commit(image);
    image.onerror = () => commit(null);
  };
  if (instant) { showImage(); return; }
  bd.style.opacity = "0";
  backdropTimer = setTimeout(showImage, 260);
}
