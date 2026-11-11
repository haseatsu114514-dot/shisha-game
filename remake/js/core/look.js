// 見た目の様式（現行／新版／DS風）。2026-11-11 オーナー依頼（docs/owner_requests.md の LK）。
// 配色のテーマ（ui-theme.js）とは別の切り替えで、進行・判定・報酬・セーブには触れない。
// 既定は現行。新版とDS風は試作で、対応済みの章（LOOK_CHAPTERS）にいる間だけ効く。それ以外の章では現行で表示する。
// 効いている様式は <html data-look="…">、選んだ様式は <html data-look-choice="…">。切り替わるたびに document へ "lookchange" を送る。
export const LOOKS = Object.freeze([
  { id: "classic", label: "現行" },
  { id: "neo", label: "新版" },
  { id: "retro", label: "DS風" },
]);
export const DEFAULT_LOOK = "classic";
export const LOOK_CHAPTERS = Object.freeze([1]);
export const LOOK_EVENT = "lookchange";

export function normalizeLook(value) {
  return LOOKS.some((look) => look.id === value) ? value : DEFAULT_LOOK;
}

/** 選んだ様式と今の章から、実際に効かせる様式を決める。章が分からない場面（タイトルなど）は第1章として扱う。 */
export function effectiveLook(value, chapter) {
  const id = normalizeLook(value);
  if (id === DEFAULT_LOOK) return id;
  return LOOK_CHAPTERS.includes(chapter ?? 1) ? id : DEFAULT_LOOK;
}

let chosen = DEFAULT_LOOK;
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
  return typeof document === "undefined" ? DEFAULT_LOOK : normalizeLook(document.documentElement.dataset.look);
}

/** いま選んでいる様式（対応していない章では、効いている様式と違うことがある）。 */
export const chosenLook = () => chosen;
