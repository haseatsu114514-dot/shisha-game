// 本筋の場面と重ならない東京の自由時間。dayは章内日、保存は通算日。
export const TOKYO_FREE_TIMES = Object.freeze([
  { id: "d5-noon", before: "ch3_taste_return", day: 5, slot: 0 },
  { id: "d6-night", before: "ch3_naru_contact_before_tournament", day: 6, slot: 1 },
  { id: "d8-night", before: "ch3_kuze_advice", day: 8, slot: 1 },
  { id: "d9-noon", before: "ch3_kuze_advice", day: 9, slot: 0 },
  { id: "d9-night", before: "ch3_kuze_advice", day: 9, slot: 1 },
  { id: "d10-noon", before: "ch3_kuze_advice", day: 10, slot: 0 },
  { id: "d10-night", before: "ch3_kuze_advice", day: 10, slot: 1 },
  { id: "d12-noon", before: "ch3_volk_first", day: 12, slot: 0 },
  { id: "d13-night", before: "tournament", day: 13, slot: 1 },
]);

export function tokyoTime(value, window) {
  return { ...window, day: value.flags._ch3_intro.startDay + window.day - 1 };
}
export const timeNumber = time => time.day * 2 + time.slot;

/** 古い保存の過ぎた空き時間を再演しない。本筋のstageは増やさない。 */
export function nextTokyoFreeTime(value, before) {
  if (!value.flags?._ch3_intro) return null;
  const closed = value.tokyoVisits?.closedSlots || [];
  return TOKYO_FREE_TIMES.filter(window => window.before === before && !closed.includes(window.id)
      && value.tokyoVisits?.plans.some(plan => plan.status !== "returned"
        && (plan.meetup.id === window.id || plan.date.id === window.id)))
    .map(window => tokyoTime(value, window)).find(window => timeNumber(window) >= timeNumber(value)) || null;
}
