// 章の最終日（大会・勝負の日）の判定（#2033）。第1〜4章は DAY14 のまま、第5章は日程が決まるまで未定。
import assert from "node:assert/strict";
import { chapterDay, chapterFinalDay, chapterDaysLeft, atChapterFinalDay, chapterGoalLabel } from "../js/core/chapter-clock.js";
import { TOURNAMENT_DAY } from "../js/core/rules.js";

// 第1章: 通算日がそのまま章内日。大会は DAY14。
for (const day of [1, 7, 13, 14]) {
  const save = { chapter: 1, day, flags: {} };
  assert.equal(chapterFinalDay(save), TOURNAMENT_DAY);
  assert.equal(chapterDaysLeft(save), TOURNAMENT_DAY - day);
  assert.equal(atChapterFinalDay(save), day >= TOURNAMENT_DAY);
  assert.equal(chapterGoalLabel(save), "次の大会まで");
}

// 第2章: 章内日は開始日から数える。残り日数・最終日の判定は今までと同じ（14 − 章内日）。
const ch2 = (day) => ({ chapter: 2, day, flags: { _ch2_day1: { startDay: 15 } } });
assert.equal(chapterDay(ch2(15)), 1);
assert.equal(chapterDaysLeft(ch2(15)), 13);
assert.equal(chapterDaysLeft(ch2(28)), 0);
assert.equal(atChapterFinalDay(ch2(27)), false);
assert.equal(atChapterFinalDay(ch2(28)), true);

// 第5章: 博士と日程を決めるまでは最終日が無い（あと何日も出さない・前夜にもならない）。
const ch5 = (day, matchDay) => ({ chapter: 5, day, flags: { _ch5: { startDay: 60, ...(matchDay === undefined ? {} : { matchDay }) } } });
for (const day of [60, 61, 80, 200]) {
  assert.equal(chapterFinalDay(ch5(day)), null);
  assert.equal(chapterDaysLeft(ch5(day)), null);
  assert.equal(atChapterFinalDay(ch5(day)), false);
}
assert.equal(chapterGoalLabel(ch5(60)), "勝負の日まで");
// 日程が決まったら、その日が最終日（通算日 → 章内日）。
assert.equal(chapterFinalDay(ch5(63, 64)), 5);
assert.equal(chapterDaysLeft(ch5(63, 64)), 1);
assert.equal(atChapterFinalDay(ch5(63, 64)), false);
assert.equal(atChapterFinalDay(ch5(64, 64)), true);
// 壊れた値は「未定」として読む（数字でない日付で最終日扱いにしない）。
assert.equal(chapterFinalDay(ch5(63, "64")), null);
assert.equal(chapterFinalDay({ chapter: 5, day: 63, flags: {} }), null);

console.log("chapter_final_day: ok");
