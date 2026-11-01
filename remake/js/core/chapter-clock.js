// day は経過日数を保つ。章内の日付だけを分け、記念日や交流の日時を巻き戻さない。
import { TOURNAMENT_DAY } from "./rules.js";
export function chapterDay(value) {
  const day = value?.day || 1;
  const start = value?.chapter === 2 ? value.flags?._ch2_day1?.startDay
    : value?.chapter === 3 ? value.flags?._ch3_intro?.startDay
    : value?.chapter === 5 ? value.flags?._ch5?.startDay : null;
  return Number.isInteger(start) && start > 0 ? Math.max(1, day - start + 1) : day;
}

export const chapterDaysLeft = value => Math.max(0, TOURNAMENT_DAY - chapterDay(value));

/** 新しい本編は通算日。章内日を保存していた旧手動データの記念日計算も保つ。 */
export function relationshipElapsedDay(value) {
  const elapsed = value?.flags?._elapsed_calendar || value?.flags?._ch2_day1?.startDay > TOURNAMENT_DAY;
  return elapsed ? value.day : ((value?.chapter || 1) - 1) * TOURNAMENT_DAY + value.day;
}
