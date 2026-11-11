// DS風を出してよい状態かどうかの見分け。現行の DOM を読むだけで、何も書き換えない。
// 「確実に対応済みの場面（タイトル・会話・地図）」と判定できた時だけ場面名を返し、それ以外は null（＝現行の画面をそのまま見せる）。
const byId = (id) => document.getElementById(id);
const media = (query) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;

// 場面ごとに、現行ステージの一番上に来ていてよい層（#stage の直下の id）。
const EXPECTED_LAYERS = { vn: ["vn", "bg"], map: ["screen", "hud"], title: ["screen"] };
// 場面ごとの確認点（ステージの幅・高さに対する割合）。HUD のボタンがある隅は避ける。
const PROBES = {
  vn: [[0.5, 0.42], [0.3, 0.5], [0.7, 0.5], [0.5, 0.86]],
  map: [[0.5, 0.5], [0.3, 0.74], [0.62, 0.34]],
  title: [[0.5, 0.5], [0.2, 0.62], [0.8, 0.4]],
};
// 演出の層（#fx）にあっても場面を止めない、短い効果。
const FX_HARMLESS = ".flash, .stat-flight";
// 会話の層（#vn）に元からある部品。これ以外（図解など）が足されている間は未対応として扱う。
const VN_PARTS = ".vn-effect, .vn-cg, .vn-portraits, .vn-cutin-layer, .vn-box, .vn-choices, .vn-controls, .vn-log";

/**
 * DS風を使える端末・向きか。
 * "on": 縦長の画面、またはタッチ端末でない（PC）。"off": 横持ちのタッチ端末（現行のまま）。
 * "old": 古い2画面表示（表示設定の「DS風」）が有効。そちらを通常版へ戻すまで外枠は出さない。
 */
export function engageState() {
  const body = document.body;
  if (body.classList.contains("game-ds") || body.dataset.gameLayout === "ds" || document.querySelector('#screen .title[data-layout="ds"]')) return "old";
  const touch = media("(hover: none) and (pointer: coarse)");
  return media("(orientation: portrait)") || !touch ? "on" : "off";
}

export const isPortrait = () => media("(orientation: portrait)");

/** 読み込み・起動の画面（自前の縦長の配置を持つ）。この間は「横向きにすると…」の一言も出さない。 */
export const isLoading = () => !!(byId("boot") || document.querySelector(".loading-gate"));

function layerOf(node, stage) {
  if (!stage.contains(node)) return "outside";
  for (let at = node; at && at !== stage; at = at.parentElement) if (at.parentElement === stage) return at.id || "unknown";
  return "stage";
}

// MOKUMOKUパッキー（地図の上のスロット）が回っている・しゃべっている間は、現行の画面で見せる。
let reelSig = "", reelChangedAt = 0;
function reelBusy(map, now) {
  const widget = map.querySelector(".reel-widget");
  if (!widget) { reelSig = ""; return false; }
  const bubble = widget.querySelector(".rw-bubble");
  const sig = `${widget.className}|${[...widget.querySelectorAll(".rw-strip")].map((s) => s.className + s.style.transform).join("|")}|${bubble?.className}${bubble?.textContent}`;
  if (sig !== reelSig) {
    if (reelSig) reelChangedAt = now;
    reelSig = sig;
  }
  return !!widget.querySelector(".rw-strip.spinning, .rw-bubble.show") || now - reelChangedAt < 1500;
}

/**
 * いまの場面。"title" | "vn" | "map" | null。own は自分の外枠の要素（重なりの確認から除く）。
 */
export function detectScene(own = []) {
  const body = document.body, stage = byId("stage");
  if (!stage || byId("boot")) return null;
  if (byId("modal")?.classList.contains("show")) return null;
  if (document.querySelector(".loading-gate, .vn-loading, .cutin")) return null;
  const wipe = byId("wipe");
  if (wipe && (wipe.classList.contains("black") || wipe.classList.contains("cover"))) return null;
  for (const child of byId("fx")?.children || []) if (!child.matches(FX_HARMLESS)) return null;

  const vn = byId("vn"), screen = byId("screen");
  const inVn = body.classList.contains("in-vn"), vnOpen = body.classList.contains("vn-open");
  let scene = null;
  if (inVn && vn?.classList.contains("active")) {
    if (vn.classList.contains("intro-morph-dialog-hidden")) return null;
    if (vn.querySelector(".vn-log.show") || vn.querySelector(".vn-cutin-layer")?.childElementCount) return null;
    for (const child of vn.children) if (!child.matches(VN_PARTS)) return null;
    scene = "vn";
  } else if (inVn || vnOpen) {
    return null; // 会話の素材待ちの間
  } else if (body.dataset.screen === "map") {
    const map = screen?.querySelector(":scope > .map:not(.done)");
    if (!map || map.dataset.revealing === "true" || map.querySelector(".map-info button")) return null;
    if (reelBusy(map, performance.now())) return null;
    scene = "map";
  } else if (body.dataset.screen === "title") {
    if (!screen?.querySelector(":scope > .title .title-menu")) return null;
    scene = "title";
  }
  if (!scene) return null;

  // 安全網: ステージの数点で一番上の要素を取り、その場面で想定する層でなければ未対応とする。
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  for (const [px, py] of PROBES[scene]) {
    const x = rect.left + rect.width * px, y = rect.top + rect.height * py;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
    const top = document.elementsFromPoint(x, y).find((node) => !own.some((mine) => mine.contains(node)));
    if (!top) continue;
    if (!EXPECTED_LAYERS[scene].includes(layerOf(top, stage))) return null;
  }
  return scene;
}
