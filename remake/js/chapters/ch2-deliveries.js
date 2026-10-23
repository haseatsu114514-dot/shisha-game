// 初日の配達だけを管理する。通常訪問の料金・成長・交流回数には触れない。
export const DELIVERY_STOPS = ["ageha", "kumicho", "rei"];

export function acceptChapterTwoDeliveries(value) {
  if (value.chapter !== 2 || value.flags._ch2_deliveries) return false;
  value.flags._ch2_deliveries = { accepted: true, done: {} };
  return true;
}

export function deliveryPending(value, id) {
  return DELIVERY_STOPS.includes(id) && value.flags?._ch2_deliveries?.accepted === true
    && !value.flags._ch2_deliveries.done?.[id];
}

export function finishChapterTwoDelivery(value, id) {
  if (!deliveryPending(value, id)) return false;
  (value.flags._ch2_deliveries.done ||= {})[id] = true;
  return true;
}

export function chapterTwoDeliveriesDone(value) {
  return !value.flags?._ch2_deliveries?.accepted
    || DELIVERY_STOPS.every(id => !deliveryPending(value, id));
}
