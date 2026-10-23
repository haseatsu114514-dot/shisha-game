// 地名の表示だけを改名する。既存の保存ID widehanga と過去の素材パスは維持する。
export const CH2_CITY_NAME = "柚ヶ谷";
export const CH2_CITY_EN = "YUZUGAYA";
export const CITY_BACKGROUNDS = Object.fromEntries(["trpg", "aquarium", "sento", "shop", "kumicho", "c_station"]
  .map(id => [id, `../assets/backgrounds/bg_yuzugaya_${id}.webp`]));
