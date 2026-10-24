// 所持金自体は変えず、柚ヶ谷で使える金額から帰宅の片道分を外す。
export const CITY_TRAIN_FARE = 200;
export const returnFareReserve = value => value?.chapter === 2 && value.flags?._ch2_preparation_started
  && value.flags?._ch2_region === "widehanga" ? CITY_TRAIN_FARE : 0;
export const spendableMoney = value => Math.max(0, (value?.money || 0) - returnFareReserve(value));
