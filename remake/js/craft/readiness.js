// 会話のSKIPとは独立して、操作開始前に制作素材のデコードを待つ。
import { DB, makingUrl, portraitInfo, bgUrl, faceIconUrl } from "../core/data.js";
import { imageReady } from "../core/ui.js";

export function craftAssetUrls(mode = "tournament") {
  const people = mode === "tournament" ? ["hajime", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"] : ["hajime", "sumi"];
  return [...new Set([
    ...(DB.manifest.making || []).map(makingUrl),
    "img/ui/continue/backdrop_stage.webp",
    bgUrl(mode === "tournament" ? "bg_tournament_stage" : "bg_tonari_inside"),
    ...people.flatMap(id => [faceIconUrl(id), ...(DB.manifest.portraits[id]?.faces || []).map(face => portraitInfo(id, face)?.src)]),
  ].filter(Boolean))];
}

export function warmCraftAssets(mode = "tournament") {
  return Promise.all(craftAssetUrls(mode).map(url => imageReady(url, 15000, { keep: true })));
}
