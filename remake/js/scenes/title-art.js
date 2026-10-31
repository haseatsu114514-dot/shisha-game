// 表示候補のキャラは core/title-art-unlock.js の対応表で決まる（#1243）。
// 2026-10-31 オーナー指示「タイトルアートは1キャラ1枚」: キャラを同じ確率で選び、絵はそのキャラの
// 専用キービジュアル（TITLE_KEY_VISUALS）だけを出す。manifest の titleArts は資料として残す。
// 最新のセーブを読むだけで書き込まない。セーブがあれば「出会ったキャラ」の絵だけに絞る（#1243）。
import { DB, assetUrl } from "../core/data.js";
import { pick } from "../core/util.js";
import { imageReady } from "../core/ui.js";
import { peekLatestSave } from "../core/state.js";
import { titleArtDisplayCharacters, TITLE_KEY_VISUALS } from "../core/title-art-unlock.js";

let previousCharacter = null;
const fallback = () => ({ character: "keyvisual", file: "title_art_keyvisual_01.png", url: assetUrl("ui/title_arts/title_art_keyvisual_01.png") });

function latestSave() {
  try { return peekLatestSave(); } catch { return null; }
}

export function pickTitleArt() {
  const pool = DB.manifest.titleArts || [];
  const keyArt = (id) => pool.find((art) => art.character === id && art.file === TITLE_KEY_VISUALS[id]);
  const characters = titleArtDisplayCharacters(latestSave()).filter((id) => keyArt(id));
  if (!characters.length) return fallback();
  const fresh = characters.filter((id) => id !== previousCharacter);
  const character = pick(fresh.length ? fresh : characters);
  const art = keyArt(character);
  previousCharacter = character;
  return { ...art, url: assetUrl(`ui/title_arts/${art.file}`) };
}

export async function prepareTitleArt(art = pickTitleArt()) {
  if (await imageReady(art.url, 15000)) return { ...art, ready: true };
  const backup = fallback();
  await imageReady(backup.url, 15000);
  return { ...backup, ready: true };
}
