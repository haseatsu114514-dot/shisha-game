// node --experimental-vm-modules remake/test/chapter_save_recovery.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const files = new Map();
let failAutoSave = false;
const context = vm.createContext({ structuredClone, console, localStorage: {
  getItem(key) { return files.get(key) ?? null; },
  setItem(key, value) {
    if (failAutoSave && key === "suien_remake_save") throw new Error("保存失敗を注入");
    files.set(key, String(value));
  },
} });
const modules = new Map();
function moduleAt(url) {
  if (!modules.has(url.href)) {
    modules.set(url.href, new vm.SourceTextModule(readFileSync(url, "utf8"), { context, identifier: url.href }));
  }
  return modules.get(url.href);
}
const url = new URL(import.meta.url);
const entry = new vm.SourceTextModule(`
  export * as core from "../js/core/state.js";
  export { on } from "../js/core/bus.js";
  export { ChapterSaveError, isChapterStart } from "../js/core/chapter-save.js";
  export { advanceToChapterTwo } from "../js/chapters/ch2-progress.js";
  export { tournamentProgress as ch2Tournament } from "../js/chapters/ch2-tournament-state.js";
  export { advanceToChapterThree, chapterThreeProgress } from "../js/chapters/ch3-progress.js";
  export { tournamentProgress as ch3Tournament } from "../js/chapters/ch3-tournament-state.js";
  export { advanceToChapterFour } from "../js/chapters/ch4-progress.js";
  export { chapterFourMatch } from "../js/chapters/ch4-tournament-state.js";
  export { advanceToChapterFive, chapterFiveProgress } from "../js/chapters/ch5-progress.js";
`, { context, identifier: url.href });
await entry.link((path, importer) => moduleAt(new URL(path, importer.identifier)));
await entry.evaluate();
const { core, on, ChapterSaveError, isChapterStart, advanceToChapterTwo, ch2Tournament, advanceToChapterThree,
  chapterThreeProgress, ch3Tournament, advanceToChapterFour, chapterFourMatch, advanceToChapterFive,
  chapterFiveProgress } = entry.namespace;

const checkpointFlag = "_chapter_start_checkpoint";
const copy = value => JSON.parse(JSON.stringify(value));
const auto = () => files.get(core.SAVE_KEY);
function progressState(value) {
  const result = copy(value);
  delete result.flags[checkpointFlag];
  delete result.savedAt;
  delete result.playMs;
  return result;
}
function assertSaveError(value, validate, condition) {
  assert.throws(() => validate(value), error => error instanceof ChapterSaveError
    && error.chapter === value.chapter && error.condition.includes(condition), condition);
}
function clearPreviousChapter(value, chapter) {
  Object.assign(value, { phase: "cleared", day: chapter * 14, slot: 1, money: 56000 + chapter, stamina: 70 + chapter });
  if (chapter === 3) {
    value.flags._ch2_cleared = true;
    value.flags._ch2_read_ch2_tournament_ageha_heart = true;
    ch2Tournament(value).stage = "complete";
  }
  if (chapter === 4) value.flags._ch3_cleared = true;
  if (chapter === 5) value.flags._ch4_cleared = true;
}
const published = [];
on("hud", () => published.push({ state: core.state, auto: auto() }));
core.newGame();

for (const [chapter, advance, corrupt, validate, condition] of [
  [2, advanceToChapterTwo, value => { ch2Tournament(value).step = -1; }, ch2Tournament, "_ch2_tournament.step"],
  [3, advanceToChapterThree, value => { value.flags._ch3_intro.stage = -1; }, chapterThreeProgress, "_ch3_intro.stage"],
  [4, advanceToChapterFour, value => { chapterFourMatch(value).history = null; }, chapterFourMatch, "_ch4.match.history"],
  [5, advanceToChapterFive, value => { value.flags._ch5_match_started = true; }, chapterFiveProgress, "_ch5_match_started"],
]) {
  const value = core.state;
  clearPreviousChapter(value, chapter);
  value.stats.technique = 20 + chapter;
  value.affinity.sumi = 30 + chapter;
  value.flavorStock = { mint: 20 + chapter };
  const previousCheckpoint = value.flags[checkpointFlag];

  assert.equal(advance(value), true);
  const checkpoint = value.flags[checkpointFlag];
  assert(isChapterStart(checkpoint, value), `Ch${chapter} captured at its actual start`);
  assert(!Object.hasOwn(checkpoint.flags, checkpointFlag), "Only one checkpoint belongs to the current save");
  if (previousCheckpoint) assert.equal(previousCheckpoint.chapter, chapter - 1);
  assert.deepEqual(progressState(checkpoint), progressState(value), "Capture preserves the whole entry state");
  assert.equal(core.save(), true);

  // Keep the chapter start as it is seen through the ordinary SAVE/LOAD pipeline.
  const played = core.load();
  const expected = progressState(played);
  played.day += 5;
  played.phase = "daily";
  played.slot = 1;
  played.money -= 1000;
  played.stamina -= 30;
  played.stats.technique += 10;
  played.affinity.sumi += 3;
  played.flavorStock.mint -= 9;
  played.owned.push("hagal_80beat");
  played.equip.bowl = "hagal_80beat";
  played.flags._affinity_first_meeting_pending_ageha = true;
  corrupt(played);
  if (chapter === 3) ch3Tournament(played).voted = 99;
  assert.equal(core.save(), true);
  const owner = core.load();
  const baseline = auto();
  const ownerJSON = JSON.stringify(owner);
  const savedStart = owner.flags[checkpointFlag];
  assertSaveError(owner, validate, condition);
  if (chapter === 3) assertSaveError(owner, ch3Tournament, "_ch3_tournament.voted");
  assert.deepEqual(progressState(savedStart), progressState(checkpoint), "Later saves cannot change the entry snapshot");

  // All failure paths leave the active object and AUTO untouched.
  published.length = 0;
  assert.equal(core.restartChapterFromSave(owner, { ...savedStart, cycleId: "another-cycle" }), false);
  assert.equal(core.restartChapterFromSave(copy(owner), savedStart), false);
  assert.equal(core.restartChapterFromSave(owner, null), false);
  failAutoSave = true;
  assert.equal(core.restartChapterFromSave(owner, savedStart), false);
  failAutoSave = false;
  assert.strictEqual(core.state, owner);
  assert.equal(JSON.stringify(owner), ownerJSON);
  assert.equal(auto(), baseline);
  assert.deepEqual(published, []);

  const otherTab = JSON.stringify({ ...owner, money: 77777 });
  files.set(core.SAVE_KEY, otherTab);
  assert.equal(core.restartChapterFromSave(owner, savedStart), false);
  assert.equal(auto(), otherTab, "A concurrent AUTO must win over chapter recovery");
  assert.strictEqual(core.state, owner);
  assert.deepEqual(published, []);
  files.set(core.SAVE_KEY, baseline);

  assert.equal(core.restartChapterFromSave(owner, savedStart), true);
  assert.notStrictEqual(core.state, owner);
  assert.deepEqual(progressState(core.state), expected, "Rewind restores resources, progress and prior chapter flags");
  assert.equal(published.length, 1);
  assert.strictEqual(published[0].state, core.state);
  assert.equal(published[0].auto, JSON.stringify(core.state), "AUTO is committed before the HUD sees the new owner");
  assert(!Object.hasOwn(core.state.flags[checkpointFlag].flags, checkpointFlag));
  assert.deepEqual(progressState(core.load()), expected, "Rewind survives the normal reload path");
}

// A chapter start saved by the previous version can still be used when it is from the same cycle.
const manualKey = core.SAVE_SLOTS.find(slot => !slot.auto).key;
const legacyStart = copy(core.state.flags[checkpointFlag]);
const manualRaw = JSON.stringify(legacyStart);
files.set(manualKey, manualRaw);
files.set(core.SAVE_KEY, manualRaw);
const fromAuto = core.load();
assert(isChapterStart(fromAuto.flags[checkpointFlag], fromAuto), "An unplayed legacy AUTO is captured on load");
assert.equal(auto(), manualRaw, "Ordinary AUTO load does not write");
const current = core.loadFromSlot(manualKey);
assert(isChapterStart(current.flags[checkpointFlag], current), "A legacy manual start is captured when first loaded");
assert.equal(files.get(manualKey), manualRaw);
delete current.flags[checkpointFlag];
current.day += 1;
current.flags._ch5_match_started = true;
assert.equal(core.save(), true);
const legacyOwner = core.load();
assert.equal(legacyOwner.flags[checkpointFlag], undefined);
assertSaveError(legacyOwner, chapterFiveProgress, "_ch5_match_started");
assert.equal(isChapterStart(legacyOwner, legacyOwner), false, "An in-progress legacy save is not a checkpoint");
assert.equal(core.restartChapterFromSave(legacyOwner, legacyOwner), false);
const legacyCheckpoint = core.readSlot(manualKey);
assert(isChapterStart(legacyCheckpoint, legacyOwner));
assert.equal(core.restartChapterFromSave(legacyOwner, legacyCheckpoint), true);
assert.equal(files.get(manualKey), manualRaw, "Recovery must preserve the original manual slot");
assert(isChapterStart(core.state.flags[checkpointFlag], core.state), "A legacy chapter start is captured for later retries");

console.log("PASS: 第2〜5章の保存検査、章頭の復帰、保存失敗・競合、旧保存の復帰");
