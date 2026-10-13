// day は経過日数を保つ。章内の日付だけを分け、記念日や交流の日時を巻き戻さない。
import { TOURNAMENT_DAY } from "./rules.js";
export function chapterDay(value) {
  const day = value?.day || 1;
  const start = value?.chapter === 2 ? value.flags?._ch2_day1?.startDay : null;
  return Number.isInteger(start) && start > 0 ? Math.max(1, day - start + 1) : day;
}

export const chapterDaysLeft = value => Math.max(0, TOURNAMENT_DAY - chapterDay(value));
