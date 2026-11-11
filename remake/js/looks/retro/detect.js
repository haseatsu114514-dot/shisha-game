// DS風を出してよい状態かどうかの見分け。現行の DOM を読むだけで、何も書き換えない。
// 戻り値の kind:
//   "scene" … 対応済みの場面（name: "title" | "vn" | "map" | "menu"）。外枠に写す。
//   "cover" … 見るだけの覆い（場面転換・日付の札・章タイトル・詩・登場カットイン・読み込みの一言）。外枠のまま暗くして、
//             見えている文字と絵だけを写す（retro/cover.js）。pressable は、覆いがステージ中央でタップを受ける状態かどうか。
//   "gap"   … 場面と場面のあいだの、何も出ていない短い間。外枠のまま少し待つ。
//   "none"  … 未対応（MENU・LIME・設定・ロード画面・シーシャ作り・店など）。現行の画面をそのまま見せる。
const byId = (id) => document.getElementById(id);
const media = (query) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;

// 場面ごとに、現行ステージの一番上に来ていてよい層（#stage の直下の id）。
const EXPECTED_LAYERS = { vn: ["vn", "bg"], map: ["screen", "hud"], title: ["screen"], menu: ["screen", "hud"] };
// 場面ごとの確認点（ステージの幅・高さに対する割合）。HUD のボタンがある隅は避ける。
const PROBES = {
  vn: [[0.5, 0.42], [0.3, 0.5], [0.7, 0.5], [0.5, 0.86]],
  map: [[0.5, 0.5], [0.3, 0.74], [0.62, 0.34]],
  title: [[0.5, 0.5], [0.2, 0.62], [0.8, 0.4]],
  menu: [[0.5, 0.5], [0.3, 0.6], [0.7, 0.4]],
};
// 演出の層（#fx）にあっても場面を止めない、短い効果。
const FX_HARMLESS = ".flash, .stat-flight";
// 演出の層にあって、自分で操作する画面（心得の盤・レベルアップ・スロットの説明・LIME の案内・くじ）。現行の画面で見せる。
const FX_INTERACTIVE = ".gboard, .levelup-backdrop, .reel-intro, .lime-coach, .kuji-overlay";
const CONTROLS = "button, input, select, textarea, a[href]";
// 会話の層（#vn）に元からある部品。これ以外（図解など）が足されている間は未対応として扱う。
const VN_PARTS = ".vn-effect, .vn-cg, .vn-portraits, .vn-cutin-layer, .vn-box, .vn-choices, .vn-controls, .vn-log";

const NONE = Object.freeze({ kind: "none" }), GAP = Object.freeze({ kind: "gap" });

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
/** ステージの (px, py)（割合）で一番上にある要素の層。own（自分の外枠）は除く。 */
function topLayer(stage, rect, px, py, own) {
  const x = rect.left + rect.width * px, y = rect.top + rect.height * py;
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return null;
  const top = document.elementsFromPoint(x, y).find((node) => !own.some((mine) => mine.contains(node)));
  return top ? layerOf(top, stage) : null;
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

/** いまの状態。own は自分の外枠の要素（重なりの確認から除く）。 */
export function detectState(own = []) {
  const body = document.body, stage = byId("stage");
  if (!stage || byId("boot")) return NONE;
  if (byId("modal")?.classList.contains("show") || document.querySelector(".loading-gate")) return NONE;
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return NONE;

  // 覆い: 演出の層に何か出ている・煙や暗転で覆っている・読み込みの一言が出ている
  const overlays = [...(byId("fx")?.children || [])].filter((node) => !node.matches(FX_HARMLESS));
  if (overlays.some((node) => node.matches(FX_INTERACTIVE) || node.querySelector(CONTROLS))) return NONE;
  const wipe = byId("wipe");
  if (overlays.length || (wipe && (wipe.classList.contains("black") || wipe.classList.contains("cover")))) {
    const layer = topLayer(stage, rect, 0.5, 0.5, own);
    return { kind: "cover", pressable: layer === "fx" || layer === "wipe" || layer === "unknown" };
  }

  const vn = byId("vn"), screen = byId("screen");
  const inVn = body.classList.contains("in-vn"), vnOpen = body.classList.contains("vn-open");
  let scene = null;
  if (inVn && vn?.classList.contains("active")) {
    if (vn.classList.contains("intro-morph-dialog-hidden")) return { kind: "cover", pressable: false };
    if (vn.querySelector(".vn-log.show")) return NONE;
    for (const child of vn.children) if (!child.matches(VN_PARTS)) return NONE;
    scene = "vn";
  } else if (inVn || vnOpen) {
    return GAP; // 会話の素材待ちの間
  } else {
    const live = screen?.querySelector(":scope > :not(.done)");
    if (!live || !live.childElementCount && !live.textContent.trim()) return GAP; // 前の画面を片付けて、次が出るまでの間
    if (body.dataset.screen === "map" && live.matches(".map")) {
      if (live.dataset.revealing === "true" || live.querySelector(".map-info button") || reelBusy(live, performance.now())) return NONE;
      scene = "map";
    } else if (body.dataset.screen === "title" && live.matches(".title") && live.querySelector(".title-menu")) {
      scene = "title";
    } else if (live.matches(".sub-menu") && live.querySelector(".sub-choices .big-choice")) {
      scene = "menu"; // tonari の行動選びなど、ボタンが並ぶだけの画面（daily/tonari.js の .sub-menu）
    }
  }
  if (!scene) return NONE;

  // 安全網: ステージの数点で一番上の要素を取り、その場面で想定する層でなければ未対応とする。
  for (const [px, py] of PROBES[scene]) {
    const layer = topLayer(stage, rect, px, py, own);
    if (layer && !EXPECTED_LAYERS[scene].includes(layer)) return NONE;
  }
  return { kind: "scene", name: scene };
}
