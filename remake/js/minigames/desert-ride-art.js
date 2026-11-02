// DESERT RIDE の絵（Codex 生成・PR #2306 で採用）。原画・採否・加工の手順は asset_sources/desert-ride-2306/（build.py・adoption.json）。
// 寸法と基準点は adoption.json と同じ値（remake/test/desert_ride.mjs が照合する）。
// 読み込みは非同期で、届くまで・失敗した時は desert-ride.js が Canvas の図形で描く（遊びは止めない）。
import { imgFileUrl } from "../core/img-file.js";

export const DESERT_ART = Object.freeze({
  // 遠景（Codex B）。空と陸を分け、沈む太陽を陸の後ろに描く。horizon は平らな砂が始まる行、duneTop は稜線のいちばん上
  sky: Object.freeze({ file: "ui/desert_ride/backdrop_day_sky.webp", size: Object.freeze([1800, 412]) }),
  land: Object.freeze({ file: "ui/desert_ride/backdrop_day_land.webp", size: Object.freeze([1800, 451]), top: 269 }),
  backdrop: Object.freeze({ width: 1800, height: 720, horizon: 404, duneTop: 281 }),
  // 主人公の背面（Codex B）。anchor は板の重心（足元の基準点・画像に対する比率）
  rider: Object.freeze({ file: "ui/desert_ride/rider_ride.webp", size: Object.freeze([489, 768]), anchor: Object.freeze({ x: 0.6125, y: 0.833 }) }),
  rockLarge: Object.freeze({ file: "ui/desert_ride/rock_large.webp", size: Object.freeze([512, 280]) }),
  rockSmall: Object.freeze({ file: "ui/desert_ride/rock_small.webp", size: Object.freeze([384, 211]) }),
  // 旗竿（Codex A）。foot は竿の足（画像に対する比率）
  flag: Object.freeze({ file: "ui/desert_ride/flag_pole.webp", size: Object.freeze([110, 512]), foot: Object.freeze({ x: 0.0591, y: 1 }) }),
  goal: Object.freeze({ file: "ui/desert_ride/goal_banner.webp", size: Object.freeze([1024, 132]) }),
  puff: Object.freeze({ file: "ui/desert_ride/sand_puff.webp", size: Object.freeze([256, 141]) }),
});
// 会話の背景（Codex C を 1280×720 に）。夕方は同じ絵に CSS の data-tint="dusk"（css/desert-ride.css）
export const DESERT_BG = "bg_dubai_dunes_day";
export const DESERT_DUSK_TINT = "dusk";

let images = null;
/** 絵を読み始め、{ get(name) } を返す。get は読み終えた画像か null。何度呼んでも同じものを使い回す。 */
export function loadDesertArt() {
  if (!images) {
    images = new Map();
    if (typeof Image !== "undefined") {
      for (const [name, def] of Object.entries(DESERT_ART)) {
        if (!def.file) continue;
        const image = new Image();
        image.decoding = "async";
        const entry = { image, ready: false };
        image.onload = () => { (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => { entry.ready = true; }); };
        image.onerror = () => { entry.ready = false; };
        image.src = imgFileUrl(def.file);
        images.set(name, entry);
      }
    }
  }
  return { get: name => { const entry = images.get(name); return entry?.ready ? entry.image : null; } };
}
