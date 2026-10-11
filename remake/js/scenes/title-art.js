// 採用したタイトル原画だけを、キャラごとに同じ確率で選ぶ。ゲームのセーブには触れない。
import { DB, assetUrl } from "../core/data.js";
import { pick } from "../core/util.js";
import { imageReady } from "../core/ui.js";

let previousCharacter = null;
const fallback = () => ({ character: "keyvisual", file: "title_art_keyvisual_01.png", url: assetUrl("ui/title_arts/title_art_keyvisual_01.png") });

export function pickTitleArt() {
  const pool = DB.manifest.titleArts || [];
  if (!pool.length) return fallback();
  const characters = [...new Set(pool.map((art) => art.character))];
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
