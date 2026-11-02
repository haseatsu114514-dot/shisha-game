// 所持金自体は変えず、柚ヶ谷で使える金額から帰宅の片道分を外す。
export const CITY_TRAIN_FARE = 200;
/** 地元と柚ヶ谷を電車で行き来する章（第2章・第5章の日常ループ。#2033）。現在地は flags._ch2_region。 */
export const CITY_TRAVEL_CHAPTERS = Object.freeze([2, 5]);
export const travelsBetweenCities = value => CITY_TRAVEL_CHAPTERS.includes(value?.chapter);
export const returnFareReserve = value => travelsBetweenCities(value) && value.flags?._ch2_preparation_started
  && value.flags?._ch2_region === "widehanga" ? CITY_TRAIN_FARE : 0;
export const spendableMoney = value => Math.max(0, (value?.money || 0) - returnFareReserve(value));
