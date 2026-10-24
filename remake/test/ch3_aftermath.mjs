import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { chapterDay } from "../js/core/chapter-clock.js";
import { CH3_AFTERMATH_SCENES, canRunChapterThreeAftermath, beginChapterThreeAftermath,
  chapterThreeAftermathProgress, completeChapterThreeAftermathScene } from "../js/chapters/ch3-aftermath-progress.js";

const ids = ["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile", "ch3_home_customer", "ch3_ageha_reunion"];
assert.deepEqual(CH3_AFTERMATH_SCENES.map(scene => scene.id), ids);
const dialogues = JSON.parse(readFileSync(new URL("../../data/dialogue/ch3_main.json", import.meta.url))).dialogues;
for (const id of ids) assert(dialogues.some(dialogue => dialogue.dialogue_id === id && dialogue.lines?.length), id);

function winningSave() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "tournament", day: 42, slot: 0, money: 23456,
    stamina: 41, flavorStock: { mint: 8.5, double_apple: 4 } });
  value.flags = {
    _ch3_intro: { startDay: 29, stage: 18, titleSeen: true },
    _ch3_tournament: { result: { rank: 1, votes: { nagumo: { hajime: 10 } } } },
    _ch3_tournament_won: true,
  };
  value.lovers = ["minto"];
  value.relationshipMemories = ["volk_measure"];
  return value;
}

for (const change of [
  value => { value.chapter = 2; },
  value => { delete value.flags._ch3_tournament_won; },
  value => { value.flags._ch3_tournament_won = false; },
]) {
  const invalid = winningSave(); change(invalid);
  const prior = structuredClone(invalid);
  assert.equal(canRunChapterThreeAftermath(invalid), false);
  assert.equal(beginChapterThreeAftermath(invalid), false);
  assert.deepEqual(invalid, prior, "A non-winning save entered the aftermath");
}

const value = winningSave(), before = structuredClone(value);
assert.equal(canRunChapterThreeAftermath(value), true);
assert.deepEqual(beginChapterThreeAftermath(value), { version: 1, winDay: 42, stage: 0 });
assert.equal(value.phase, "aftermath");
assert.equal(value.slot, 1);
assert.equal(value.day, 42);
assert.equal(chapterDay(value), 14);
assert(!value.flags._ch3_cleared);
for (const key of ["money", "stamina", "stats", "statXp", "flavorStock", "owned", "equip",
  "lovers", "loverSince", "relationshipMemories", "contacts", "inbox", "tournament"])
  assert.deepEqual(value[key], before[key], `Aftermath changed ${key}`);
assert.deepEqual(value.flags._ch3_tournament, before.flags._ch3_tournament);

const dates = [[42, 1], [43, 0], [43, 1], [44, 1], [45, 0]];
for (let index = 0; index < ids.length; index++) {
  assert.deepEqual([value.day, value.slot], dates[index], `Wrong date before ${ids[index]}`);
  assert.equal(chapterThreeAftermathProgress(value).stage, index);
  const wrong = structuredClone(value);
  assert.equal(completeChapterThreeAftermathScene(value, "ch3_national_result"), false);
  assert.deepEqual(value, wrong, "The victory announcement advanced the aftermath");
  assert.equal(completeChapterThreeAftermathScene(value, ids[index]), true);
  const checkpoint = structuredClone(value);
  assert.equal(completeChapterThreeAftermathScene(value, ids[index]), false);
  assert.deepEqual(value, checkpoint, "A scene committed twice");
  // A JSON save/load round trip keeps the exact next scene and elapsed date.
  const reloaded = JSON.parse(JSON.stringify(value));
  assert.deepEqual(beginChapterThreeAftermath(reloaded), reloaded.flags._ch3_aftermath);
  assert.deepEqual(reloaded, value, "Reopening the aftermath reset its checkpoint");
}
assert.equal(value.flags._ch3_aftermath.stage, ids.length);
assert.equal(value.flags._ch3_cleared, true);
assert.equal(value.phase, "cleared");
assert.equal(value.chapter, 3);
assert.equal(value.day, 45);
assert.equal(chapterDay(value), 17);
assert.equal(value.flags._ch3_tournament_won, true);
assert.deepEqual(value.flags._ch3_tournament, before.flags._ch3_tournament);
assert(!value.flags._ch4_intro);
assert.throws(() => chapterThreeAftermathProgress({ ...value, flags: { ...value.flags, _ch3_aftermath: { ...value.flags._ch3_aftermath, stage: 4 } } }));
console.log("PASS: Chapter 3 victory aftermath saves five scenes once, crosses Tokyo and home dates, and never repeats the tournament");
