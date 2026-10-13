// 章境界で所持品・関係・日時の記録が失われないことを検証する。
import assert from "node:assert/strict";
import { newState } from "../js/core/state.js";
import { chapterDay, chapterDaysLeft, relationshipElapsedDay } from "../js/core/chapter-clock.js";
import { advanceToChapterTwo } from "../js/chapters/ch2-progress.js";

const value = newState();
Object.assign(value, { phase: "cleared", day: 14, slot: 2, money: 67890, stamina: 41 });
value.flags.savedMemory = "keep";
value.lovers = ["tsumugi", "minto"];
value.loverSince = { tsumugi: 10, minto: 13 };
value.relationshipMemories = ["tsumugi_creature"];
value.flavorStock = { mint: 12.5, double_apple: 4 };
value.reel.count = 19;
const before = structuredClone(value);
assert(advanceToChapterTwo(value));
for (const key of Object.keys(before)) {
  if (!["chapter", "phase", "day", "slot", "flags", "statsAtChapterStart"].includes(key)) assert.deepEqual(value[key], before[key], `Chapter transition changed ${key}`);
}
assert.equal(value.flags.savedMemory, "keep");
assert.equal(value.day, 15, "Elapsed dates must not rewind to 1");
assert.equal(chapterDay(value), 1);
assert.equal(chapterDaysLeft(value), 13);
assert.equal(value.day - value.loverSince.minto, 2, "Anniversary duration must remain meaningful");
assert.equal(relationshipElapsedDay(value), 15, "Chapter changes must not add 14 days to an elapsed relationship clock");
assert.equal(relationshipElapsedDay({ chapter: 2, day: 2, flags: {} }), 16, "Legacy chapter-local dates retain their old relationship clock");
assert.equal(relationshipElapsedDay({ chapter: 2, day: 16, flags: { _ch2_day1: { startDay: 15 } } }), 16, "Previously saved DAY1 builds need no date reset");
const once = structuredClone(value);
assert.equal(advanceToChapterTwo(value), false);
assert.deepEqual(value, once, "Repeated starts advanced or reset the chapter twice");
value.day = 24;
assert.equal(chapterDay(value), 10);
assert.equal(chapterDaysLeft(value), 4);
for (const phase of ["opening", "daily", "tournament", "aftermath"]) {
  const unfinished = newState(); unfinished.phase = phase;
  assert.equal(advanceToChapterTwo(unfinished), false);
  assert.equal(unfinished.chapter, 1);
}
console.log("PASS: chapter boundary preserves assets and relationships, elapsed dates, local day and single transition");
