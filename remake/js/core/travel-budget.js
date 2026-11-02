// 所持金自体は変えず、柚ヶ谷で使える金額から帰宅の片道分を外す。
export const CITY_TRAIN_FARE = 200;
/** 地元と柚ヶ谷を電車で行き来する章（第2章・第5章の日常ループ。#2033）。現在地は flags._ch2_region。 */
export const CITY_TRAVEL_CHAPTERS = Object.freeze([2, 5]);
export const travelsBetweenCities = value => CITY_TRAVEL_CHAPTERS.includes(value?.chapter);
/** 第5章の東京への新幹線（片道）。橙須（名古屋の大須が元）から東京の実際の運賃に合わせる（#2033・2026-11-02）。 */
export const TOKYO_TRAIN_FARE = 11000;
export const returnFareReserve = value => {
  if (!travelsBetweenCities(value)) return 0;
  const region = value.flags?._ch2_region;
  if (region === "widehanga" && value.flags?._ch2_preparation_started) return CITY_TRAIN_FARE;
  if (region === "tokyo" && value.chapter === 5) return TOKYO_TRAIN_FARE;
  return 0;
};
export const spendableMoney = value => Math.max(0, (value?.money || 0) - returnFareReserve(value));
