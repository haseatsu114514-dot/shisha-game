// 見た目の様式（新版／旧版／DS風）。2026-11-11 オーナー依頼（docs/owner_requests.md の LK）。
// 配色のテーマ（ui-theme.js）とは別の切り替えで、進行・判定・報酬・セーブには触れない。
// 既定は新版（LK09）。旧版（これまでの様式）は設定で選べる。新版とDS風は対応済みの章（LOOK_CHAPTERS）にいる間だけ効き、
// それ以外の章では旧版で表示する。
// 効いている様式は <html data-look="…">、選んだ様式は <html data-look-choice="…">。切り替わるたびに document へ "lookchange" を送る。
export const LOOKS = Object.freeze([
  { id: "neo", label: "新版" },
  { id: "classic", label: "旧版" },
  { id: "retro", label: "DS風" },
]);
/** 何も重ねない素の様式（旧版）。対応していない章の表示と、様式の部品を読む前の状態。 */
export const BASE_LOOK = "classic";
/** プレイヤーの端末で、何も選んでいない時の様式。 */
export const PLAYER_DEFAULT_LOOK = "neo";
export const LOOK_CHAPTERS = Object.freeze([1]);
export const LOOK_EVENT = "lookchange";

/**
 * 何も選んでいない端末の既定（LK09）。プレイヤーは新版。
 * 自動操作のブラウザ（navigator.webdriver。ブラウザテスト）だけは旧版を既定にする。既存の検査は旧版の画面の寸法を
 * 測っていて、ほかの作業で足される検査も旧版を前提に書かれるため。新版・DS風の検査は ?look= か設定で明示して選ぶ
 * （look_neo.mjs・look_retro.mjs）。プレイヤーの既定そのものは look_default.mjs が自動操作の印を外して確かめる。
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
  return LOOK_CHAPTERS.includes(chapter ?? 1) ? id : BASE_LOOK;
}

/**
 * 保存された設定から、起動時の様式を決める（main.js が一度だけ呼ぶ）。
 * 選んだことが分かる端末（lookVersion が 1）はそのまま。まだ選んでいない端末と、#3256 の頃に当時の既定として
 * 保存された旧版（選んだものと区別できない）は、一度だけ既定へ移す。新版・DS風を選んでいた端末は変えない。
 */
export function migrateLook(config) {
  if (config.lookVersion !== 1) {
    if (!known(config.look) || config.look === BASE_LOOK) config.look = defaultLook();
    config.lookVersion = 1;
  }
  config.look = normalizeLook(config.look);
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
