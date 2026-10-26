// 東京の自由時間の活動条件。読むだけでは保存・訪問・時計を更新しない。
import { chapterThreeFreeTime, completeChapterThreeFreeTime } from "./ch3-progress.js";
import { tokyoWindowReserved, tokyoGymWindowAllowed, timeNumber } from "../core/tokyo-clock.js";

export const TOKYO_GYM = Object.freeze({ id: "choizap", stat: "charm", stamina: -8 });
export const TOKYO_REST_STAMINA = 55;

/** 閉じた枠、過去の枠、別セーブから来た古い操作は使えない。 */
export function chapterThreeActivityWindow(value, windowId) {
  if (value?.chapter !== 3 || value.phase !== "daily" || !value.flags?._ch3_intro
    || value.flags._ch3_aftermath || value.flags._ch3_tournament || value.flags._ch3_cleared) return null;
  try {
    const window = chapterThreeFreeTime(value);
    return window && window.id === windowId && timeNumber(window) === timeNumber(value) ? window : null;
  } catch { return null; }
}

export function chapterThreeGymAvailability(value, windowId) {
  if (!value?.flags?._gym_member) return { ok: false, reason: "member", window: null };
  const window = chapterThreeActivityWindow(value, windowId);
  if (!window) return { ok: false, reason: "window", window: null };
  if (tokyoWindowReserved(value, window)) return { ok: false, reason: "reserved", window };
  if (!tokyoGymWindowAllowed(value, window)) return { ok: false, reason: "story", window };
  if (value.visitedDay?.choizap === window.day) return { ok: false, reason: "used-today", window };
  if (!(value.stamina > 0)) return { ok: false, reason: "tired", window };
  return { ok: true, reason: null, window };
}

/** 読了後の同期的な確定境界。主筋stageは進めず、既存の一枠だけを閉じる。 */
export function claimChapterThreeGym(value, windowId) {
  const { ok, window } = chapterThreeGymAvailability(value, windowId);
  if (!ok || !completeChapterThreeFreeTime(value, windowId)) return null;
  value.visitedDay ||= {};
  value.visitedDay.choizap = window.day;
  value.spotVisits ||= {};
  value.spotVisits.choizap = (value.spotVisits.choizap || 0) + 1;
  value.flags._fit_since = { chapter: 3, day: window.day };
  return window;
}

export function claimChapterThreeRest(value, windowId) {
  const window = chapterThreeActivityWindow(value, windowId);
  return window && completeChapterThreeFreeTime(value, windowId) ? window : null;
}
