// タイトルの EXTRA（あそびば）。本編で遊んだミニゲームを、タイトルからいつでも遊び直せる（要望台帳 EXT01〜）。
// 2026-11-27 オーナー「エクストラにしよう　斧投げを初めて体験したら解禁　それまでは？？？」「ミニゲームがいくつかあるのがわかるように
// まだやってないのはロックしといたり」「店番とてつこと一台勝負はミニゲーム扱いにしない」。
// 記録は端末に残す（ギャラリーと同じく、セーブを消しても・はじめから遊び直しても消えない）。本編の入口で遊び始めた時に recordExtraPlay を呼ぶ。
// この部品より前に遊んだ分は、セーブに残る記録から拾う（extraPlayedInSave。記録の形が分かる遊びだけ）。
// EXTRA で遊んだ結果は本編のセーブに残さない（scenes/extra.js が使い捨ての状態で開く）。

export const EXTRA_KEY = "suien_remake_extra_played";
/** この遊びを初めて遊ぶと、タイトルに EXTRA が出る（それまでは「？？？」）。 */
export const EXTRA_UNLOCK_GAME = "axe";

/** 並びは本編で出会う順。店番（tonari のフロア営業）・てつこ・一台勝負はミニゲームとして扱わない（2026-11-27 オーナー）。 */
export const EXTRA_GAMES = Object.freeze([
  { id: "axe", label: "斧投げ" },
  { id: "trpg", label: "ボドゲカフェ" },
  { id: "dj", label: "DJ" },
  { id: "camel", label: "ラクダレース" },
  { id: "desert", label: "砂丘のサンドボード" },
]);
const KNOWN = new Set(EXTRA_GAMES.map((game) => game.id));

/** 端末に残した記録（遊んだ遊びの id）。読めない・壊れている時は空。 */
export function readExtraPlayed() {
  try {
    const value = JSON.parse(localStorage.getItem(EXTRA_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => KNOWN.has(id)) : []);
  } catch { return new Set(); }
}

/** 本編でこの遊びを遊び始めた時に呼ぶ。保存できない環境でもゲームは止めない。 */
export function recordExtraPlay(id) {
  if (!KNOWN.has(id)) return;
  const played = readExtraPlayed();
  if (played.has(id)) return;
  played.add(id);
  try { localStorage.setItem(EXTRA_KEY, JSON.stringify(EXTRA_GAMES.map((game) => game.id).filter((known) => played.has(known)))); }
  catch { /* 保存できない環境は記録しない */ }
}

const count = (value) => Number.isFinite(value) && value > 0;

/** セーブ（state の形）に残る記録から、遊んだ遊びを拾う（この部品より前に遊んだ分・端末の記録を消した後も開くように）。 */
export function extraPlayedInSave(save) {
  const found = new Set();
  const flags = save?.flags || {};
  if (flags._axe_lesson_done || (flags._axe_bar_records && Object.keys(flags._axe_bar_records).length)) found.add("axe");
  if (Object.values(save?.dj?.sets || {}).some((set) => count(set?.plays))) found.add("dj");
  // ボドゲカフェは、物語を1つ遊び終えた記録。ラクダは走った回数（chapters/ch4-camel-progress.js の CAMEL_FLAG）。砂丘は完走の数
  if (Object.keys(save?.trpg?.cleared || {}).length) found.add("trpg");
  if (count(flags._ch4_camel?.plays)) found.add("camel");
  if (count(save?.desert?.runs)) found.add("desert");
  return found;
}

/** 端末の記録と、渡したセーブ（オートセーブ・手動の枠）から拾った分を合わせる。拾った分は端末の記録にも書き足す（後でセーブを消しても残る）。 */
export function extraPlayed(saves = []) {
  const played = readExtraPlayed();
  for (const save of saves) for (const id of extraPlayedInSave(save)) {
    if (!played.has(id)) recordExtraPlay(id);
    played.add(id);
  }
  return played;
}

export const extraUnlocked = (played) => played.has(EXTRA_UNLOCK_GAME);
