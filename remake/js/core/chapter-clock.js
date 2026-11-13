// day は経過日数を保つ。章内の日付だけを分け、記念日や交流の日時を巻き戻さない。
import { TOURNAMENT_DAY } from "./rules.js";
/** 遠出する章（第3章の東京・第4章のドバイ）の、出発前に地元で過ごす準備期間の日数（VOL02・2026-11-02）。 */
export const DEPARTURE_PREP_DAYS = 3;

/**
 * 出発前の準備期間なら、その記録 { startDay, days } を返す（出発の朝＝準備の startDay + days）。
 * 出発後・準備期間の無い旧保存・他の章は null。保存は flags._ch3_prep / flags._ch4_prep。
 */
export function departurePrep(value) {
  const prep = value?.chapter === 3 ? value.flags?._ch3_prep : value?.chapter === 4 ? value.flags?._ch4_prep : null;
  return prep && !prep.departed && Number.isInteger(prep.startDay) && prep.startDay > 0
    && Number.isInteger(prep.days) && prep.days > 0 ? prep : null;
}

/** 出発の朝の通算日（準備期間でなければ null）。 */
export const departureDay = value => {
  const prep = departurePrep(value);
  return prep ? prep.startDay + prep.days : null;
};

export function chapterDay(value) {
  const day = value?.day || 1;
  // 出発前の準備期間は準備の1日目から数える。着いてからの14日を DAY1〜14 とする（物語の正本の日付を変えない）。
  const prep = departurePrep(value);
  if (prep) return Math.max(1, day - prep.startDay + 1);
  const start = value?.chapter === 2 ? value.flags?._ch2_day1?.startDay
    : value?.chapter === 3 ? value.flags?._ch3_intro?.startDay
    : value?.chapter === 4 ? value.flags?._ch4?.startDay
    : value?.chapter === 5 ? value.flags?._ch5?.startDay : null;
  return Number.isInteger(start) && start > 0 ? Math.max(1, day - start + 1) : day;
}

/**
 * 章の最終日（大会・勝負の日）を章内日で返す。日常ループの「あと◯日」・最終日の前夜・当日の判定はここを読む。
 * 第1〜4章は DAY14 の大会。第5章は博士と日程を決めるまで決まっていない（null）。決まると `_ch5.matchDay`（通算日）。
 */
export function chapterFinalDay(value) {
  // 準備期間は準備の日数（HUD の「1/3」）。出発の朝は準備の日数＋1日目なので、残り日数・到達の判定は下で分ける。
  const prep = departurePrep(value);
  if (prep) return prep.days;
  if (value?.chapter !== 5) return TOURNAMENT_DAY;
  const { matchDay, startDay } = value.flags?._ch5 || {};
  return Number.isInteger(matchDay) && Number.isInteger(startDay) ? Math.max(1, matchDay - startDay + 1) : null;
}

/** 最終日まであと何日か。最終日が決まっていなければ null。 */
export function chapterDaysLeft(value) {
  // 準備期間は出発の朝まで（準備1日目＝あと3日、3日目＝あと1日）。
  const prep = departurePrep(value);
  if (prep) return Math.max(0, prep.days + 1 - chapterDay(value));
  const final = chapterFinalDay(value);
  return final === null ? null : Math.max(0, final - chapterDay(value));
}

/** 章内日が最終日に達したか（最終日が決まっていなければ false）。 */
export function atChapterFinalDay(value) {
  // 準備期間の最後の日（出発の前の日）の夜の予定は通常どおり。出発の朝で到達。
  const prep = departurePrep(value);
  if (prep) return chapterDay(value) > prep.days;
  const final = chapterFinalDay(value);
  return final !== null && chapterDay(value) >= final;
}

/** HUD の「◯◯まで」の言葉。 */
export const chapterGoalLabel = value => departurePrep(value) ? "出発まで"
  : value?.chapter === 5 ? "勝負の日まで" : "次の大会まで";

/** 朝のカード・セーブ一覧などの日付の見出し。準備期間は「出発前 N日目」、それ以外は「DAY N」。 */
export const chapterDayTitle = value => departurePrep(value) ? `出発前 ${chapterDay(value)}日目` : `DAY ${chapterDay(value)}`;

/** 新しい本編は通算日。章内日を保存していた旧手動データの記念日計算も保つ。 */
export function relationshipElapsedDay(value) {
  const elapsed = value?.flags?._elapsed_calendar || value?.flags?._ch2_day1?.startDay > TOURNAMENT_DAY;
  return elapsed ? value.day : ((value?.chapter || 1) - 1) * TOURNAMENT_DAY + value.day;
}
