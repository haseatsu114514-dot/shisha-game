// 見た目の様式（新版／旧版／縦画面）。2026-11-11 オーナー依頼（docs/owner_requests.md の LK）。
// 配色のテーマ（ui-theme.js）とは別の切り替えで、進行・判定・報酬・セーブには触れない。
// 本編は縦画面。旧版・新版の描画は未対応場面と表示の検査に使う。
// 章を限る様式を足す時は LOOK_CHAPTERS に書く（その章の外では旧版で表示する）。
// 効いている様式は <html data-look="…">、選んだ様式は <html data-look-choice="…">。切り替わるたびに document へ "lookchange" を送る。
export const LOOKS = Object.freeze([
  { id: "neo", label: "新版" },
  { id: "classic", label: "旧版" },
  { id: "vertical", label: "縦画面" },
]);
/** 何も重ねない素の様式（旧版）。対応していない章の表示と、様式の部品を読む前の状態。 */
export const BASE_LOOK = "classic";
/** 本編は全章で縦対応の場面を優先する。 */
export const PLAYER_DEFAULT_LOOK = "vertical";
export const LOOK_VERSION = 4;
/** 様式ごとに効く章。null はすべての章。新版は LK13（2026-11-11「新版を広げる」）で全章。
 * 縦画面（煙の舞台・VPN01）は第1章から作り、VPN17（2026-11-27 オーナー「マップとか会話とか日常パートは良い感じなのでその辺の二章以降を進めといて」）で全章に広げた。
 * まだ縦にしていない場面（シーシャ作り・大会・店番・ミニゲーム）は、どの章でも回転案内のまま。 */
export const LOOK_CHAPTERS = Object.freeze({ neo: null, vertical: null });
export const LOOK_EVENT = "lookchange";

/**
 * 何も選んでいない端末の既定（LK09→LK23→LK24）。プレイヤーは縦画面。
 * 自動操作のブラウザ（navigator.webdriver。ブラウザテスト）も旧版を既定にする。既存の検査は旧版の画面の寸法を
 * 測っていて、ほかの作業で足される検査も旧版を前提に書かれるため。新版の検査は ?look= で明示して選ぶ
 * （look_neo.mjs）。プレイヤーの既定そのものは look_default.mjs が自動操作の印を外して確かめる。
 */
export function defaultLook() {
  return typeof navigator !== "undefined" && navigator.webdriver === true ? BASE_LOOK : PLAYER_DEFAULT_LOOK;
}

const known = (value) => LOOKS.some((look) => look.id === value);

export function normalizeLook(value) {
  return known(value) ? value : defaultLook();
}

/** 選んだ様式と今の章から、実際に効かせる様式を決める。章が分からない場面（タイトルなど）は第1章として扱う。 */
export function effectiveLook(value, chapter) {
  const id = normalizeLook(value);
  if (id === BASE_LOOK) return id;
  const chapters = LOOK_CHAPTERS[id];
  return !chapters || chapters.includes(chapter ?? 1) ? id : BASE_LOOK;
}

/** 以前の様式を選んでいた端末も縦版へ移す。ほかの設定やプレイ記録には触れない。 */
export function migrateLook(config) {
  config.look = config.look === PLAYER_DEFAULT_LOOK ? PLAYER_DEFAULT_LOOK : defaultLook();
  config.lookVersion = LOOK_VERSION;
  return config.look;
}

let chosen = BASE_LOOK;
let chapterSource = () => 1;
let timer = null;

function sync() {
  if (typeof document === "undefined") return effectiveLook(chosen, chapterSource());
  const root = document.documentElement;
  const next = effectiveLook(chosen, chapterSource());
  root.dataset.lookChoice = chosen;
  delete root.dataset.lookBoot; // 様式が決まった（起動中は回転案内を出さない・css/base.css）
  if (root.dataset.look === next) return next;
  root.dataset.look = next;
  document.dispatchEvent(new CustomEvent(LOOK_EVENT, { detail: { look: next, choice: chosen } }));
  return next;
}

/**
 * 起動時に一度呼ぶ。chapter は今の章を返す関数（タイトルでは 1 を返す）。
 * 章の切り替わり（次の章へ・ロード・タイトルへ戻る）は進行側に手を入れず、ここで定期的に見て追随する。
 */
export function initLook({ look, chapter } = {}) {
  chosen = normalizeLook(look);
  if (typeof chapter === "function") chapterSource = chapter;
  if (timer === null && typeof window !== "undefined") timer = window.setInterval(sync, 500);
  return sync();
}

/** 設定から様式を選び直す。戻り値は実際に効いた様式。 */
export function setLook(look) {
  chosen = normalizeLook(look);
  return sync();
}

/** 章が変わった直後など、すぐに反映したい時に呼ぶ。 */
export const refreshLook = () => sync();

/** いま効いている様式。 */
export function currentLook() {
  const value = typeof document === "undefined" ? BASE_LOOK : document.documentElement.dataset.look;
  return known(value) ? value : BASE_LOOK;
}

/** いま選んでいる様式（対応していない章では、効いている様式と違うことがある）。 */
export const chosenLook = () => chosen;
