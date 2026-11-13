// ロード画面の2コマ漫画の「読んだ」記録。セーブ枠とは別に残す（コレクションの記録と同じ扱い）。
// 読んだ = 作業台のロード画面で漫画を見て、自分で先へ進めた話。未読の話を先に出すのと、
// ギャラリーの棚に使う。場面の準備の案内に一瞬出ただけの話は、読んだことにしない。
export const LOADING_COMICS_READ_KEY = "suien_remake_loading_comics_read";

const validId = id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);

/** 保存値を正規化する（文字列の id だけ・重複なし・順序は読んだ順）。 */
export function normalizeLoadingComicsRead(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(validId))];
}

let cacheRaw, cacheIds = null;
/** 読んだ話の id（読んだ順）。保存できない環境では空として扱う。 */
export function readLoadingComicsRead() {
  let raw = null;
  try { raw = localStorage.getItem(LOADING_COMICS_READ_KEY); } catch { /* 保存不可 */ }
  if (cacheIds && cacheRaw === raw) return cacheIds;
  let value;
  try { value = JSON.parse(raw || "[]"); } catch { /* 壊れた記録は空として読む */ }
  cacheRaw = raw; cacheIds = normalizeLoadingComicsRead(value);
  return cacheIds;
}

export const hasReadLoadingComic = id => readLoadingComicsRead().includes(id);

/** 読んだ話を1つ記録する。記録できなくても遊べる。 */
export function recordLoadingComicRead(id) {
  if (!validId(id)) return;
  const before = readLoadingComicsRead();
  if (before.includes(id)) return;
  try { localStorage.setItem(LOADING_COMICS_READ_KEY, JSON.stringify([...before, id])); } catch { /* 記録できなくても遊べる */ }
  cacheIds = null;
}
