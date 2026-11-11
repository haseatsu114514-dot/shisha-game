// 画面の当て方（共通部品）: 1280×720 の固定ステージを画面に収まる倍率で拡大縮小し、
// 余った分は場面背景のぼかしで埋める（2026-11-09 オーナー決定・#3035、ブラウザアドベンチャー式）。
// 本編（main.js）と試遊ページ（camel-race／axe-throw／desert-ride／craft-preview・#3076）は
// 全てこの部品を使い、ページごとに別の当て方を作らない。
const PHONE_DENSITY_K = 0.62;

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
  const k = Math.min(w / 1280, h / 720);
  stage.style.setProperty("--k", String(k));
  // スマホ規格（#2851）: 横持ちスマホ（Plus/Pro Max の 0.60 も含む）で共通部品の文字・タップ部品を大きくする。css/phone-density.css
  // 横長の画面だけ（PC の縦長ウィンドウや縦持ちは対象外。縦持ちのスマホは横向きの案内になる）
  if (k < PHONE_DENSITY_K && w > h) document.documentElement.dataset.density = "phone";
  else delete document.documentElement.dataset.density;
  // ワイド拡張（#2861: ステージを最大1600まで広げる方式）は廃止した（#3035）。
  stage.style.removeProperty("--stage-w");
  stage.style.removeProperty("--stage-bar");
  delete stage.dataset.wide;
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
export function syncBackdrop(url, tint, instant) {
  const bd = typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById("backdrop") : null;
  if (!bd) return;
  bd.dataset.tint = tint || "";
  if (backdropUrl === (url || "")) return;
  backdropUrl = url || "";
  const image = url ? `url("${url}")` : "none";
  if (instant) { bd.style.backgroundImage = image; return; }
  bd.style.opacity = "0";
  setTimeout(() => { bd.style.backgroundImage = image; bd.style.opacity = ""; }, 260);
}
