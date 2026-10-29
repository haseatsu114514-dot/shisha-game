// 章境界で所持品・関係・日時の記録が失われないことを検証する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { chapterDay, chapterDaysLeft, relationshipElapsedDay } from "../js/core/chapter-clock.js";
import { advanceToChapterTwo } from "../js/chapters/ch2-progress.js";
import { CH3_INTRO_SCENES, chapterThreeScenes, advanceToChapterThree, chapterThreeProgress,
  completeChapterThreeScene, chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";

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

// 第2章優勝後だけ東京へ進める。能力・所持品・恋人・旧章の記録を巻き戻さない。
function chapterTwoWin() {
  const value = newState();
  Object.assign(value, { chapter: 2, phase: "cleared", day: 28, slot: 1,
    money: 67890, stamina: 41, flavorStock: { double_apple: 17.5, mint: 4 } });
  value.flags = { _ch1_cleared: true, _elapsed_calendar: true, _ch2_cleared: true,
    _ch2_read_ch2_tournament_ageha_heart: true,
    _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
    _ch2_tournament: { stage: "complete" }, savedMemory: "keep" };
  value.lovers = ["minto"];
  value.loverSince = { minto: 25 };
  value.relationshipMemories = ["old_memory"];
  value.reel.count = 19;
  return value;
}
for (const change of [
  value => { value.chapter = 1; },
  value => { value.phase = "aftermath"; },
  value => { delete value.flags._ch2_cleared; },
  value => { delete value.flags._ch2_read_ch2_tournament_ageha_heart; },
  value => { value.flags._ch2_tournament.stage = "result"; },
]) {
  const invalid = chapterTwoWin(); change(invalid);
  const prior = structuredClone(invalid);
  assert.equal(advanceToChapterThree(invalid), false);
  assert.deepEqual(invalid, prior, "Invalid Chapter 3 entry changed the save");
}
const tokyo = chapterTwoWin();
const saved = structuredClone(tokyo);
assert.equal(advanceToChapterThree(tokyo), true);
assert.equal(tokyo.chapter, 3);
assert.equal(tokyo.phase, "opening");
assert.equal(tokyo.day, 29);
assert.equal(tokyo.slot, 0);
assert.equal(chapterDay(tokyo), 1);
assert.equal(tokyo.flags.savedMemory, "keep");
for (const key of ["money", "stamina", "stats", "statXp", "flavorStock", "owned", "equip",
  "reel", "lovers", "loverSince", "relationshipMemories", "contacts", "inbox", "tournament"])
  assert.deepEqual(tokyo[key], saved[key], `Chapter 3 transition changed ${key}`);
assert.deepEqual(tokyo.statsAtChapterStart, saved.stats);
assert.deepEqual(chapterThreeProgress(tokyo), { startDay: 29, stage: 0, titleSeen: false, prologueStep: 0, routeVersion: 2 });
const entered = structuredClone(tokyo);
assert.equal(advanceToChapterThree(tokyo), false);
assert.deepEqual(tokyo, entered, "Repeated Chapter 3 entry reset progress or date");

const ids = CH3_INTRO_SCENES.map(scene => scene.id);
const legacy = structuredClone(entered);
delete legacy.flags._ch3_intro.routeVersion;
legacy.flags._ch3_intro.stage = 9;
legacy.day = 34;
assert.equal(chapterThreeScenes(legacy).length, 18);
assert.equal(chapterThreeScenes(legacy)[legacy.flags._ch3_intro.stage].id, "ch3_abyss_recovery",
  "An existing save must resume its unread scene without replaying the revised route");
assert(completeChapterThreeScene(legacy, "ch3_abyss_recovery"));
assert.equal(chapterThreeScenes(legacy)[legacy.flags._ch3_intro.stage].id, "ch3_naru_contact_before_tournament");
assert.deepEqual(ids, [
  "ch3_opening", "ch3_mukai_arrival", "ch3_mukai_intro", "ch3_individuality_doubt",
  "ch3_tokyo_shop_gap", "ch3_double_apple_incident", "ch3_rest_before_recovery",
  "ch3_daily_cup_1", "ch3_work_without_taste", "ch3_naru_contact_before_tournament",
  "ch3_naru_work", "ch3_kuze_first", "ch3_kuze_mukai_visit", "ch3_taste_return",
  "ch3_abyss_recovery", "ch3_kuze_advice",
  "ch3_steve_low_heat", "ch3_volk_first", "ch3_strategy", "ch3_tournament_eve",
], "Chapter 3 introduction must keep the canonical scene order through the tournament eve");
const availableScenes = new Set(["ch3_main", "ch3_double_apple", "ch3_mukai", "ch3_rivals", "ch3_volk"].flatMap(name =>
  JSON.parse(readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))).dialogues.map(scene => scene.dialogue_id)));
assert(ids.every(id => availableScenes.has(id)), "A Chapter 3 scene is absent from dialogue data");
assert.equal(CH3_INTRO_SCENES.find(scene => scene.id === "ch3_kuze_first").day, 8);
assert.equal(CH3_INTRO_SCENES.find(scene => scene.id === "ch3_kuze_advice").day, 11,
  "Kuze must have several days between first meeting and return visit");
for (let i = 0; i < ids.length; i++) {
  const scene = CH3_INTRO_SCENES[i];
  // 東京の空き時間（#1655）は休んで閉じる。場面の日付はその後に確かめる。
  for (let window; (window = chapterThreeFreeTime(tokyo));) assert(completeChapterThreeFreeTime(tokyo, window.id));
  assert.equal(chapterThreeProgress(tokyo).stage, i);
  assert.equal(chapterDay(tokyo), scene.day, `Wrong local day before ${scene.id}`);
  const prior = structuredClone(tokyo);
  completeChapterThreeScene(tokyo, "unrelated_scene");
  assert.deepEqual(tokyo, prior, "Wrong scene advanced the checkpoint");
  completeChapterThreeScene(tokyo, scene.id);
  assert.equal(chapterThreeProgress(tokyo).stage, i + 1, `Scene did not commit: ${scene.id}`);
  const completed = structuredClone(tokyo);
  completeChapterThreeScene(tokyo, scene.id);
  assert.deepEqual(tokyo, completed, `Scene committed twice: ${scene.id}`);
}
assert.equal(tokyo.day, 42);
assert.equal(chapterDay(tokyo), 14, "The national match must begin on DAY14");
assert.equal(tokyo.chapter, 3);
assert.equal(tokyo.phase, "tournament");
assert.equal(tokyo.flags._ch3_cleared, undefined);
console.log("PASS: Chapter 3 entrance preserves the save, rival visits reach DAY14, and scenes checkpoint once");
await import("./ch3_aftermath.mjs");
