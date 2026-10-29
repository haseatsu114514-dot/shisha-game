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
const TOKYO_FREE_TIMES_V2 = Object.freeze(TOKYO_FREE_TIMES.map(window => ({ ...window, before: ({
  "d5-noon": "ch3_work_without_taste",
  "d8-night": "ch3_kuze_mukai_visit",
  "d9-noon": "ch3_taste_return",
  "d9-night": "ch3_taste_return",
  "d10-noon": "ch3_taste_return",
  "d10-night": "ch3_taste_return",
})[window.id] || window.before })));

export function tokyoTime(value, window) {
  return { ...window, day: value.flags._ch3_intro.startDay + window.day - 1 };
}
export const timeNumber = time => time.day * 2 + time.slot;

// 訪問の旧予約は保持するが、新しいジム利用は必須場面と重ならない時間だけ。
const LEGACY_GYM_CONFLICTS = new Set(["d13-night"]);
const V2_GYM_CONFLICTS = new Set(["d9-noon", "d10-night", "d13-night"]);
export function tokyoGymWindowAllowed(value, window) {
  return !(value.flags?._ch3_intro?.routeVersion === 2 ? V2_GYM_CONFLICTS : LEGACY_GYM_CONFLICTS).has(window.id);
}

/** 既存の約束を別の自由行動で上書きしない。読取のみで訪問の所在は更新しない。 */
export function tokyoWindowReserved(value, window) {
  const pending = value.pendingInvite;
  if (pending && (pending.day ?? value.day) === window.day && pending.slot === window.slot) return true;
  return !!value.tokyoVisits?.plans.some(plan => plan.status !== "returned"
    && [plan.meetup, plan.date].some(time => time?.id === window.id && timeNumber(time) === timeNumber(window)));
}

/**
 * 予約のない空き時間を開く条件。新ルートは地図の行き先（#1655）があるので会員でなくても開く。
 * 旧ルートの保存は従来どおりジム会員だけ。
 */
export const tokyoOpenWindow = value => value.flags?._ch3_intro?.routeVersion === 2 || !!value.flags?._gym_member;

/** 古い保存の過ぎた空き時間を再演しない。本筋のstageは増やさない。 */
export function nextTokyoFreeTime(value, before) {
  if (!value.flags?._ch3_intro) return null;
  const closed = value.tokyoVisits?.closedSlots || [];
  const windows = value.flags._ch3_intro.routeVersion === 2 ? TOKYO_FREE_TIMES_V2 : TOKYO_FREE_TIMES;
  return windows.filter(window => window.before === before && !closed.includes(window.id))
    .map(window => tokyoTime(value, window))
    .filter(window => value.tokyoVisits?.plans.some(plan => plan.status !== "returned"
        && (plan.meetup.id === window.id || plan.date.id === window.id))
      || (tokyoOpenWindow(value) && tokyoGymWindowAllowed(value, window) && !tokyoWindowReserved(value, window)))
    .find(window => timeNumber(window) >= timeNumber(value)) || null;
}
