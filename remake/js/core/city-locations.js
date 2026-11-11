// 街名の表示。既存の保存ID home / widehanga と過去の素材パスは維持する。
import { travelsBetweenCities } from "./travel-budget.js";
export const HOME_CITY_NAME = "橙須";
export const HOME_CITY_READING = "とうす";
export const HOME_CITY_EN = "TOSU";
export const CH2_CITY_NAME = "柚ヶ谷";
export const CH2_CITY_EN = "YUZUGAYA";

/**
 * 今いる街。HUD の街の札（daily/hud.js）と、左右の余白の縦書きの帯（core/side-area.js）が同じものを出す。
 * 第2章・第5章と出発前の準備期間は flags._ch2_region。第5章は東京にも泊まれる（#2033）。第3章の東京・第4章のドバイも同じ印（VOL03）。
 */
export function currentCity(value) {
  const region = travelsBetweenCities(value) || [3, 4].includes(value?.chapter) ? value?.flags?._ch2_region : "home";
  if (region === "widehanga") return { id: "widehanga", en: CH2_CITY_EN, name: CH2_CITY_NAME };
  if (region === "tokyo" && [3, 5].includes(value.chapter)) return { id: "tokyo", en: "TOKYO", name: "東京" };
  if (region === "dubai" && [4, 5].includes(value.chapter)) return { id: "dubai", en: "DUBAI", name: "ドバイ" };
  return { id: "sakae", en: HOME_CITY_EN, name: HOME_CITY_NAME };
}
// Story-only locations (#563/#929). Closed shop lighting is not a normal night visit.
export const CH2_SCENE_BACKGROUNDS = {
  agehaClosed: "res://assets/backgrounds/bg_ch2_ageha_closed_night.png",
  naruWindow: "res://assets/backgrounds/bg_kemurikusa_outside_night.png",
  venueBench: "res://assets/backgrounds/bg_ch2_venue_bench_night.png",
};
// 神崎の室内は採用済みの bg_ch2_kumicho_entry.webp を ch2-city-data.js の ROOMS で使う。
// 街の店舗画像 bg_yuzugaya_kumicho.webp は内装として採用しない（#1081 A02 / #1044 A04）。
export const CITY_BACKGROUNDS = Object.fromEntries(["trpg", "aquarium", "sento", "shop", "c_station", "c_station_night"]
  .map(id => [id, `../assets/backgrounds/bg_yuzugaya_${id}.webp`]));
