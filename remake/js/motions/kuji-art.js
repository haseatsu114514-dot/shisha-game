// シーシャくじの演出の「絵の差し込み口」。
// 舞台の道具（抽選器の胴・脚・台・ハンドル・受け皿・玉・カウンター・黒板・鐘）と賞の札の地は、
// 採用済みの描いた絵（Codex 生成・asset_sources/ui/kuji-gacha-20261111/）があればそれを使い、無いあいだはコードで描いた下絵を出す。
// 絵を採用したら、下の KUJI_ART に「名前: { url }」を1行足す（置き場所と大きさは部品ごとに決まっていて、絵は枠に収めて表示する）。
// 依頼文と部品ごとの決まりは asset_sources/ui/kuji-gacha-20261111/prompts.md と README.md。
import { el } from "../core/util.js";

/**
 * 採用済みの絵。名前は部品の名前（drum・frame・base・handle・tray・counter・sign・rail・bell・ball-s・ball-a・ball-b・ball-c・ball-last）。
 * 例: drum: { url: new URL("../../img/ui/kuji/garagara-drum.webp", import.meta.url).href }
 * 絵は部品の枠（css/motions/garagara.css の .kj-<部品>）いっぱいに表示する。枠を変えたいときだけ box: [left, top, width, height]（px）を添える。
 */
export const KUJI_ART = {};

/** 部品を1つ作る。採用済みの絵があれば <img>、無ければ sketch()（コードで描いた下絵）を入れる */
export function artPart(name, className, sketch) {
  const art = KUJI_ART[name];
  const node = el(`div.kj-part.${className}`, { "aria-hidden": "true", dataset: { part: name, art: art ? "painted" : "sketch" } });
  if (art?.box) Object.assign(node.style, { left: `${art.box[0]}px`, top: `${art.box[1]}px`, width: `${art.box[2]}px`, height: `${art.box[3]}px` });
  node.append(art ? el("img", { src: art.url, alt: "", draggable: "false", decoding: "async" }) : sketch());
  return node;
}
