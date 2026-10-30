// #590: real state migration and absolute Chapter 1 retry restoration.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as core from "../js/core/state.js";
import { captureEntryResources, restoreEntryResources, applyAssistRecovery } from "../js/chapters/tournament-resources.js";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const { regulationFor } = await import("../js/craft/steps.js");

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
const copy = value => JSON.parse(JSON.stringify(value));
const s = core.newGame();
Object.assign(s, { phase: "tournament", day: 14, stamina: 52, flavorStock: { mint: 12 },
  restDay: { chapter: 1, day: 14, fullDay: true, illnessHealth: "red" } });
captureEntryResources(s);
const entry = copy(s.tournament.entryResources);
assert.deepEqual(entry, { version: 1, stamina: 52, flavorStock: { mint: 12 }, source: "entry" });
s.stamina = 48; s.flavorStock.mint = 2;
s.money += 100; s.affinity.sumi = 18; s.flags.reward = true; s.tournament.attempts = 3;
s.tournament.losses = 3; s.tournament.retryAssist = true;
const progress = copy(s);
captureEntryResources(s);
assert.deepEqual(s.tournament.entryResources, entry, "another attempt must not recapture consumed resources");
for (let i = 0; i < 3; i++) {
  restoreEntryResources(s);
  assert.equal(s.stamina, 52);
  assert.deepEqual(s.flavorStock, { mint: 12 });
}
for (const key of Object.keys(progress).filter(k => !["stamina", "flavorStock"].includes(k))) {
  assert.deepEqual(s[key], progress[key], `retry preserves ${key}`);
}
s.flavorStock.mint = 1;
assert.deepEqual(s.tournament.entryResources.flavorStock, { mint: 12 }, "stock is copied, not aliased");
core.saveToSlot("suien_remake_slot1");
core.newGame(); core.loadFromSlot("suien_remake_slot1");
restoreEntryResources(core.state);
assert.equal(core.state.stamina, 52);
assert.deepEqual(core.state.tournament.entryResources, entry);
assert.equal(core.state.restDay.illnessHealth, "red", "retry/load must not cure illness");

for (const schema of [15, 16, 17]) {
  const legacy = core.newState();
  Object.assign(legacy, { schema, phase: "tournament", day: 14, stamina: 48, flavorStock: { mint: 2 } });
  legacy.tournament.stockSnap = { mint: 12 };
  legacy.restDay = { chapter: 1, day: 14, fullDay: true, illnessHealth: "yellow" };
  storage.set(core.SAVE_KEY, JSON.stringify(legacy));
  core.load();
  assert.equal(core.state.schema, core.SCHEMA);
  assert.deepEqual(core.state.tournament.entryResources, {
    version: 1, stamina: 48, flavorStock: { mint: 12 }, source: "legacy-load",
  });
  assert.equal(core.state.stamina, 48, "migration does not grant maximum health");
  core.state.stamina = 44; core.state.flavorStock.mint = 1;
  core.saveToSlot("suien_remake_slot2");
  core.newGame(); core.loadFromSlot("suien_remake_slot2"); core.save(); core.load();
  restoreEntryResources(core.state);
  assert.equal(core.state.stamina, 48, "re-SAVE/LOAD must not lower the migration baseline");
  assert.deepEqual(core.state.flavorStock, { mint: 12 });
  assert.equal(core.state.restDay.illnessHealth, "yellow");
  assert.equal(!!core.state.flags._axe_bar_legacy_access, schema < 16, "#577 migration remains intact");
}
for (const [chapter, phase] of [[1, "daily"], [1, "aftermath"], [2, "tournament"]]) {
  const other = core.newState();
  Object.assign(other, { schema: 17, chapter, phase, stamina: 48 });
  other.tournament.stockSnap = { mint: 12 };
  storage.set(core.SAVE_KEY, JSON.stringify(other)); core.load();
  assert.equal(core.state.tournament.entryResources, undefined);
  const before = copy(core.state);
  captureEntryResources(core.state); restoreEntryResources(core.state);
  assert.deepEqual(core.state, before, "unrelated phases/Chapter 2 are unchanged");
}

// Execute the actual tournamentDay prefix through its first newSession call.
// UI/story/assets are stubs; resource functions and source ordering are real.
const source = fs.readFileSync(new URL("../js/chapters/ch1.js", import.meta.url), "utf8");
const start = source.indexOf("async function tournamentDay()");
const end = source.indexOf('  const cs = newSession("tournament");', start);
assert(start >= 0 && end > start);
const prefix = source.slice(start, end) + '  return newSession("tournament");\n}';
core.newGame(); // regulationFor closes over the real core.state, not the sandbox's `state`; reset it to Chapter 1 defaults
const entrant = core.newState();
Object.assign(entrant, { phase: "daily", day: 14, stamina: 52, flavorStock: {} });
const saves = [], sessions = [], notices = [], stub = () => {};
const context = vm.createContext({
  state: entrant, TOURNAMENT_DAY: 14, NIGHT_EVENTS: [], SHOP_FLAVORS: ["lemon"], TONARI: "", TONARI_N: "", STAGE: "",
  syncNightQueue: stub, runNightPlan: stub, playTsumugiStory: stub, sketchScene: stub,
  prepareFlavorStock: stub, lastNight: stub, warmCraftAssets: () => Promise.resolve([]), clearScreen: stub, initHud: stub,
  showHud: stub, playBgm: stub, dayCard: stub, morningMessages: () => [], openPhone: stub,
  play: stub, ownsFlavor: () => false, flavorStock: id => entrant.flavorStock[id] || 0,
  addFlavorStock: (id, amount) => { entrant.flavorStock[id] = (entrant.flavorStock[id] || 0) + amount; },
  captureEntryResources, restoreEntryResources, applyAssistRecovery, maxStamina: () => 130, regulationFor,
  save: () => saves.push(copy(entrant)), toast: stub,
  markMet: stub, preloadBgm: stub, warmGameOver: stub, smokeWipe: fn => fn(), maybeShuraba: stub,
  entrance: stub, newSession: () => { sessions.push(copy(entrant)); return {}; },
  loadingNotice: label => ({ label }),
  withLoadingNotice: async (task, notice) => { notices.push(notice); return await task; },
  loadTournamentCraftDialogue: async () => {},
});
await vm.runInContext(prefix + "\ntournamentDay()", context);
assert.deepEqual(saves[0].tournament.entryResources.flavorStock, { lemon: 12 }, "capture follows rescue grant");
assert.equal(sessions[0].stamina, 52);
entrant.stamina = 48; entrant.flavorStock.lemon = 0;
await vm.runInContext("tournamentDay()", context);
assert.equal(saves.length, 1, "retry never overwrites the entry save");
assert.equal(sessions[1].stamina, 52);
assert.deepEqual(sessions[1].flavorStock, { lemon: 12 });
// #590: 救済を選んだ挑戦だけ、戻した直後に現在の最大体力（根性込みの値）へ。entryは書き換えない。
entrant.stamina = 3; entrant.tournament.retryAssist = true;
await vm.runInContext("tournamentDay()", context);
assert.equal(sessions[2].stamina, 130, "assisted retry recovers to the current maximum");
assert.deepEqual(sessions[2].flavorStock, { lemon: 12 }, "stock is restored once, unchanged by recovery");
assert.equal(entrant.tournament.entryResources.stamina, 52, "the entry snapshot keeps the original stamina");
entrant.stamina = 3; entrant.tournament.retryAssist = false;
await vm.runInContext("tournamentDay()", context);
assert.equal(sessions[3].stamina, 52, "declining the assist keeps the entry stamina");
assert.equal(applyAssistRecovery({ stamina: 9 }, "yes", 130), false, "only an explicit true assists");
assert.equal(saves.length, 1, "recovery never writes a new entry save");
assert.equal(notices.length, 4, "every tournamentDay run wraps the entry wait in the loading notice");
for (const notice of notices) assert.deepEqual(notice, { label: "大会の準備をしています…" });
const victory = source.slice(source.indexOf("async function victory(cs)"), source.indexOf('  const after = DB.dialogues.ch1_tournament_after;'));
assert(victory.includes("delete state.tournament.entryResources"), "victory clears the retry snapshot");

// Run the actual Chapter 1 asynchronous owner boundaries. A LOAD during
// preload or the transition must not attach/resume the old tournament.
const gameOverStart = source.indexOf("async function showGameOver(");
const gameOverEnd = source.indexOf("/** 開発用:", gameOverStart);
assert(gameOverStart >= 0 && gameOverEnd > gameOverStart);
let ready, retryOptions, transition, opened = 0, resumed = 0;
const ownerContext = vm.createContext({
  state: core.newState(), recordTournamentLoss: stub, save: stub,
  craftContinueContext: () => ({}), recordContinueContext: () => ({}),
  warmGameOver: () => new Promise(resolve => { ready = resolve; }),
  showHud: stub, stopBgm: stub, SE: { miss: stub }, location: { reload: stub },
  buildGameOver: options => { retryOptions = options; return { isConnected: true }; },
  showScreen: () => opened++, chooseRetryAssist: async () => {}, retire: stub,
  smokeWipe: callback => { transition = callback; }, tournamentDay: () => resumed++,
});
vm.runInContext(source.slice(gameOverStart, gameOverEnd), ownerContext);
const waiting = vm.runInContext("showGameOver()", ownerContext);
ownerContext.state = core.newState(); ready(); await waiting;
assert.equal(opened, 0, "LOAD during preload cannot attach the old game-over screen");
ownerContext.warmGameOver = async () => {};
await vm.runInContext("showGameOver()", ownerContext);
assert.equal(opened, 1);
await retryOptions.onRetry();
assert.equal(typeof transition, "function");
ownerContext.state = core.newState(); transition();
assert.equal(resumed, 0, "LOAD during the wipe cannot resume the old tournament");
console.log("PASS: absolute retry, rescue-before-capture, one-time entry, schema15/16/17 migration, re-SAVE/LOAD, illness/progress/#577/Chapter2 preservation, LOAD during preload/wipe");
