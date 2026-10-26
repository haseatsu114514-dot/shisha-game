// 街名の表示。既存の保存ID home / widehanga と過去の素材パスは維持する。
export const HOME_CITY_NAME = "橙須";
export const HOME_CITY_READING = "とうす";
export const HOME_CITY_EN = "TOSU";
export const CH2_CITY_NAME = "柚ヶ谷";
export const CH2_CITY_EN = "YUZUGAYA";
// Story-only locations (#563/#929). Closed shop lighting is not a normal night visit.
export const CH2_SCENE_BACKGROUNDS = {
  agehaClosed: "res://assets/backgrounds/bg_ch2_ageha_closed_night.png",
  naruWindow: "res://assets/backgrounds/bg_kemurikusa_outside_night.png",
  venueBench: "res://assets/backgrounds/bg_ch2_venue_bench_night.png",
};
export const CITY_BACKGROUNDS = Object.fromEntries(["trpg", "aquarium", "sento", "shop", "kumicho", "c_station", "c_station_night"]
  .map(id => [id, `../assets/backgrounds/bg_yuzugaya_${id}.webp`]));
