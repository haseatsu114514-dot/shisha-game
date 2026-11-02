// day は経過日数を保つ。章内の日付だけを分け、記念日や交流の日時を巻き戻さない。
import { TOURNAMENT_DAY } from "./rules.js";
export function chapterDay(value) {
  const day = value?.day || 1;
  const start = value?.chapter === 2 ? value.flags?._ch2_day1?.startDay
    : value?.chapter === 3 ? value.flags?._ch3_intro?.startDay
    : value?.chapter === 5 ? value.flags?._ch5?.startDay : null;
  return Number.isInteger(start) && start > 0 ? Math.max(1, day - start + 1) : day;
}

/**
 * 章の最終日（大会・勝負の日）を章内日で返す。日常ループの「あと◯日」・最終日の前夜・当日の判定はここを読む。
 * 第1〜4章は DAY14 の大会。第5章は博士と日程を決めるまで決まっていない（null）。決まると `_ch5.matchDay`（通算日）。
 */
export function chapterFinalDay(value) {
  if (value?.chapter !== 5) return TOURNAMENT_DAY;
  const { matchDay, startDay } = value.flags?._ch5 || {};
  return Number.isInteger(matchDay) && Number.isInteger(startDay) ? Math.max(1, matchDay - startDay + 1) : null;
}

/** 最終日まであと何日か。最終日が決まっていなければ null。 */
export function chapterDaysLeft(value) {
  const final = chapterFinalDay(value);
  return final === null ? null : Math.max(0, final - chapterDay(value));
}

/** 章内日が最終日に達したか（最終日が決まっていなければ false）。 */
export function atChapterFinalDay(value) {
  const final = chapterFinalDay(value);
  return final !== null && chapterDay(value) >= final;
}

/** HUD の「◯◯まで」の言葉。 */
export const chapterGoalLabel = value => value?.chapter === 5 ? "勝負の日まで" : "次の大会まで";

/** 新しい本編は通算日。章内日を保存していた旧手動データの記念日計算も保つ。 */
export function relationshipElapsedDay(value) {
  const elapsed = value?.flags?._elapsed_calendar || value?.flags?._ch2_day1?.startDay > TOURNAMENT_DAY;
  return elapsed ? value.day : ((value?.chapter || 1) - 1) * TOURNAMENT_DAY + value.day;
}
