// 表示候補のキャラは core/title-art-unlock.js の対応表で決まる（#1243）。
// 絵はそのキャラの登録済みタイトル原画（manifest）から、キャラごとに同じ確率で選ぶ。
// 最新のセーブを読むだけで書き込まない。セーブがあれば「出会ったキャラ」の絵だけに絞る（#1243）。
import { DB, assetUrl } from "../core/data.js";
import { pick } from "../core/util.js";
import { imageReady } from "../core/ui.js";
import { peekLatestSave } from "../core/state.js";
import { titleArtDisplayCharacters } from "../core/title-art-unlock.js";

let previousCharacter = null;
const fallback = () => ({ character: "keyvisual", file: "title_art_keyvisual_01.png", url: assetUrl("ui/title_arts/title_art_keyvisual_01.png") });

function latestSave() {
  try { return peekLatestSave(); } catch { return null; }
}

export function pickTitleArt() {
  const pool = DB.manifest.titleArts || [];
  const characters = titleArtDisplayCharacters(latestSave())
    .filter((id) => pool.some((art) => art.character === id));
  if (!characters.length) return fallback();
  const fresh = characters.filter((id) => id !== previousCharacter);
  const character = pick(fresh.length ? fresh : characters);
  const art = pick(pool.filter((entry) => entry.character === character));
  previousCharacter = character;
  return { ...art, url: assetUrl(`ui/title_arts/${art.file}`) };
}

export async function prepareTitleArt(art = pickTitleArt()) {
  if (await imageReady(art.url, 15000)) return { ...art, ready: true };
  const backup = fallback();
  await imageReady(backup.url, 15000);
  return { ...backup, ready: true };
}
