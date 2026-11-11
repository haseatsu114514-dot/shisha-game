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
const EXPECTED_LAYERS = { vn: ["vn", "bg"], map: ["screen", "hud"], title: ["screen"], menu: ["screen", "hud"], dialog: ["modal"] };
// 場面ごとの確認点（ステージの幅・高さに対する割合）。HUD のボタンがある隅は避ける。
const PROBES = {
  vn: [[0.5, 0.42], [0.3, 0.5], [0.7, 0.5], [0.5, 0.86]],
  map: [[0.5, 0.5], [0.3, 0.74], [0.62, 0.34]],
  title: [[0.5, 0.5], [0.2, 0.62], [0.8, 0.4]],
  menu: [[0.5, 0.5], [0.3, 0.6], [0.7, 0.4]],
  dialog: [[0.5, 0.5]],
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
 * 外枠を使える端末・向きか。mode は "retro"（様式 DS風）か "portrait"（新版の縦持ち）。
 * "on": DS風は縦長の画面、またはタッチ端末でない（PC）。新版の縦持ちは縦長の画面だけ（タッチかどうかは問わない）。
 * "off": それ以外（現行のまま）。
 * "old": 古い2画面表示（表示設定の「DS風」）が有効。そちらを通常版へ戻すまで外枠は出さない。
 */
export function engageState(mode = "retro") {
  const body = document.body;
  if (body.classList.contains("game-ds") || body.dataset.gameLayout === "ds" || document.querySelector('#screen .title[data-layout="ds"]')) return "old";
  if (mode === "portrait") return media("(orientation: portrait)") ? "on" : "off";
  const touch = media("(hover: none) and (pointer: coarse)");
  return media("(orientation: portrait)") || !touch ? "on" : "off";
}

export const isPortrait = () => media("(orientation: portrait)");

/** 画面の一番上の層（top layer）に開いた <dialog>（第3章の東京の地図など）。自分の作りで縦持ちにも並ぶので、そのまま見せる。 */
export function topDialogOpen() {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    try { if (dialog.matches(":modal")) return true; } catch { return true; }
  }
  return false;
}

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
  // 回転案内（新版の縦持ちでは、外枠を出すまで全面を覆っている）も、自分の外枠と同じく確認から除く
  const hint = byId("rotate-hint");
  const top = document.elementsFromPoint(x, y).find((node) => !own.some((mine) => mine.contains(node)) && !hint?.contains(node));
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

// 新版の縦持ち（extended）で写せる、ボタンが並ぶだけの画面。中にこれ以外の物（順位表・図・入力欄など）があれば写さない。
// 第3〜5章の場面カード・大会の案内カード（main.ch2-contest）と、第2章の店頭カード（main.ch2-stop）。
const CARD_PARTS = ".ch2-contest-header, .ch2-contest-description, .ch2-contest-note, .ch2-contest-reason, .ch3-wayfinding, .ch2-contest-actions";
const STOP_PARTS = ".ch2-kicker, .store-logo, h1, p, .ch2-room-warning, .ch2-actions";
const simpleCard = (live) => {
  if (live.matches("main.ch2-contest")) {
    return !!live.querySelector(":scope > .ch2-contest-actions button") && [...live.children].every((node) => node.matches(CARD_PARTS));
  }
  if (live.matches("main.ch2-stop")) {
    const card = live.querySelector(":scope > .ch2-stop-card");
    return !!card && live.children.length === 1 && !!card.querySelector(":scope > .ch2-actions button")
      && [...card.children].every((node) => node.matches(STOP_PARTS));
  }
  return false;
};
/**
 * 確かめの小窓（core/ui.js の modal）のうち、文と選択肢のボタンだけのもの（第2章の朝の行き先・第4章のスークの屋台など）。
 * 本文に入力欄・ボタン・絵がある小窓（設定・保存の枠など）と、modal-box でない画面（LIME・MENU）は写さない。
 */
function simpleDialog(modal) {
  const box = modal.querySelector(":scope > .modal-box");
  if (!box || modal.children.length !== 2 || !modal.querySelector(":scope > .modal-backdrop")) return false;
  const body = box.querySelector(":scope > .modal-body"), actions = box.querySelectorAll(":scope > .modal-actions > button");
  if (!actions.length || actions.length > 6) return false;
  // 読み物（規則の紙・一覧・表・見出しのある文）は一言に縮められないので写さない
  if (body && body.querySelector("button, input, select, textarea, canvas, img, svg, video, iframe, [contenteditable], article, section, ul, ol, table, h1, h2, h3, h4, h5, h6")) return false;
  return [...box.children].every((node) => node.matches("h3, .modal-body, .modal-actions"));
}

/** 覆いの下の画面が、外枠に写せる種類か（会話・地図・タイトル・ボタンの画面・何も無い間）。 */
function knownBase(extended) {
  const body = document.body;
  if (body.classList.contains("in-vn") || body.classList.contains("vn-open")) return true;
  const live = byId("screen")?.querySelector(":scope > :not(.done)");
  if (!live || !live.childElementCount && !live.textContent.trim()) return true;
  return live.matches(".map, .title, .sub-menu") || (extended && simpleCard(live));
}

/**
 * いまの状態。own は自分の外枠の要素（重なりの確認から除く）。
 * extended（新版の縦持ち）: 第2〜5章の地図の案内の箱のボタン、場面カード、確かめの小窓も写せる場面として扱う。
 */
export function detectState(own = [], { extended = false } = {}) {
  const body = document.body, stage = byId("stage");
  if (!stage || byId("boot")) return NONE;
  if (document.querySelector(".loading-gate")) return NONE;
  const modal = byId("modal");
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return NONE;
  if (modal?.classList.contains("show")) {
    if (!extended || !simpleDialog(modal)) return NONE;
    const layer = topLayer(stage, rect, 0.5, 0.5, own);
    return !layer || EXPECTED_LAYERS.dialog.includes(layer) ? { kind: "scene", name: "menu", variant: "dialog" } : NONE;
  }

  // 覆い: 演出の層に何か出ている・煙や暗転で覆っている・読み込みの一言が出ている
  const overlays = [...(byId("fx")?.children || [])].filter((node) => !node.matches(FX_HARMLESS));
  if (overlays.some((node) => node.matches(FX_INTERACTIVE) || node.querySelector(CONTROLS))) return NONE;
  const wipe = byId("wipe");
  if (overlays.length || (wipe && (wipe.classList.contains("black") || wipe.classList.contains("cover")))) {
    const layer = topLayer(stage, rect, 0.5, 0.5, own);
    // base: 覆いの下が写せる場面（会話・地図・タイトル・ボタンの画面・空き）か。新版の縦持ちは、回転案内から外枠へ戻すかをこれで決める
    return { kind: "cover", pressable: layer === "fx" || layer === "wipe" || layer === "unknown", base: knownBase(extended) };
  }

  const vn = byId("vn"), screen = byId("screen");
  const inVn = body.classList.contains("in-vn"), vnOpen = body.classList.contains("vn-open");
  let scene = null, variant = "";
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
      // 案内の箱のボタン（駅の行き先・第2章の配達メモなど）は、新版の縦持ちでは一覧に写す（DS風は第1章だけで、出てこない）
      if (live.dataset.revealing === "true" || (!extended && live.querySelector(".map-info button")) || reelBusy(live, performance.now())) return NONE;
      if (!live.querySelector(".map-pins > .spot-pin")) return NONE; // ピンの無い作りの地図は写さない
      scene = "map";
    } else if (body.dataset.screen === "title" && live.matches(".title") && live.querySelector(".title-menu")) {
      scene = "title";
    } else if (live.matches(".sub-menu") && live.querySelector(".sub-choices .big-choice")) {
      scene = "menu"; // tonari の行動選びなど、ボタンが並ぶだけの画面（daily/tonari.js の .sub-menu）
    } else if (extended && simpleCard(live)) {
      scene = "menu"; variant = live.matches("main.ch2-stop") ? "stop" : "card";
    }
  }
  if (!scene) return NONE;

  // 安全網: ステージの数点で一番上の要素を取り、その場面で想定する層でなければ未対応とする。
  for (const [px, py] of PROBES[scene]) {
    const layer = topLayer(stage, rect, px, py, own);
    if (layer && !EXPECTED_LAYERS[scene].includes(layer)) return NONE;
  }
  return { kind: "scene", name: scene, variant };
}
