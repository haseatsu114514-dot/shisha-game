// #590: real state migration and absolute Chapter 1 retry restoration.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as core from "../js/core/state.js";
import { captureEntryResources, restoreEntryResources, applyAssistRecovery } from "../js/chapters/tournament-resources.js";
import { beginCh1Votes, isSakuraiVotes } from "../js/craft/ch1-votes.js";
import { voteStyleFrom } from "../js/core/vote-style.js";
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
const boundaries = source.slice(source.indexOf("async function enterTournamentDay()"), source.indexOf("async function tournamentDay()"));
const start = source.indexOf("async function tournamentDay()");
const end = source.indexOf("  const cs = startTournamentCraft();", start);
assert(boundaries.startsWith("async function enterTournamentDay()") && start >= 0 && end > start);
const prefix = boundaries + source.slice(start, end) + '  return startTournamentCraft();\n}';
core.newGame(); // regulationFor closes over the real core.state, not the sandbox's `state`; reset it to Chapter 1 defaults
const entrant = core.newState();
Object.assign(entrant, { phase: "daily", day: 14, stamina: 52, flavorStock: {} });
const saves = [], sessions = [], notices = [], played = [], stub = () => {}, session = {};
const context = vm.createContext({
  state: entrant, TOURNAMENT_DAY: 14, NIGHT_EVENTS: [], SHOP_FLAVORS: ["lemon"], TONARI: "", TONARI_N: "", STAGE: "",
  syncNightQueue: stub, runNightPlan: stub, playTsumugiStory: stub, sketchScene: stub,
  prepareFlavorStock: stub, lastNight: stub, warmCraftAssets: () => Promise.resolve([]), clearScreen: stub, initHud: stub,
  showHud: stub, playBgm: stub, dayCard: stub, morningMessages: () => [], openPhone: stub,
  play: id => played.push(id),
  captureEntryResources, restoreEntryResources, applyAssistRecovery, beginCh1Votes, maxStamina: () => 130, regulationFor,
  // 審査の方式（SKR04）は試合を始める時の設定で決まる。ここでは桜井式を選んだ端末として流す。
  voteStyleFrom, config: { voteStyle: "sakurai" }, isSakuraiVotes, SAKURAI_RULE_LINES: [],
  save: () => saves.push(copy(entrant)), toast: stub,
  markMet: stub, preloadBgm: stub, warmGameOver: stub, smokeWipe: fn => fn(),
  playTournamentArrival: () => played.push("arrival-sequence"),
  entrance: stub, newSession: () => { sessions.push(copy(entrant)); return session; },
  loadingNotice: label => ({ label }),
  withLoadingNotice: async (task, notice) => { notices.push(notice); return await task; },
  loadTournamentCraftDialogue: async () => {},
});
await vm.runInContext(prefix + "\ntournamentDay()", context);
assert.equal(played.filter(id => id === "arrival-sequence").length, 1);
assert(played.indexOf("arrival-sequence") < played.indexOf("ch1_tournament_opening"), "arrival sequence precedes the opening");
assert.deepEqual(saves[0].tournament.entryResources.flavorStock, {}, "entry does not grant private lemon");
assert(!played.includes("remake_flavor_rescue") && !played.includes("remake_flavor_brought"), "morning does not branch on private stock");
assert.equal(sessions[0].stamina, 52);
assert.equal(entrant.tournament.voteAttempt.style, "sakurai", "試合を始める時の設定の方式で票の記録を始める");
assert.equal(session.voteStyle, "sakurai", "桜井式の試合の一台には攻めの帯の印が付く");
entrant.stamina = 48; entrant.flavorStock.lemon = 0;
await vm.runInContext("tournamentDay()", context);
// #2536: 再挑戦でも版確定と票の初期化を保存するようになったため、保存回数ではなく
// 「どの保存でも entry スナップショットが書き換わらない」ことを直接守る。
for (const sv of saves) assert.deepEqual(sv.tournament.entryResources, saves[0].tournament.entryResources, "retry never overwrites the entry save");
assert.equal(sessions[1].stamina, 52);
assert.deepEqual(sessions[1].flavorStock, {});
// #590: 救済を選んだ挑戦だけ、戻した直後に現在の最大体力（根性込みの値）へ。entryは書き換えない。
entrant.stamina = 3; entrant.tournament.retryAssist = true;
await vm.runInContext("tournamentDay()", context);
assert.equal(sessions[2].stamina, 130, "assisted retry recovers to the current maximum");
assert.deepEqual(sessions[2].flavorStock, {}, "stock is restored once, unchanged by recovery");
assert.equal(entrant.tournament.entryResources.stamina, 52, "the entry snapshot keeps the original stamina");
entrant.stamina = 3; entrant.tournament.retryAssist = false;
await vm.runInContext("tournamentDay()", context);
assert.equal(sessions[3].stamina, 52, "declining the assist keeps the entry stamina");
assert.equal(applyAssistRecovery({ stamina: 9 }, "yes", 130), false, "only an explicit true assists");
for (const sv of saves) assert.deepEqual(sv.tournament.entryResources, saves[0].tournament.entryResources, "recovery never writes a new entry save");
assert.equal(notices.length, 8, "each tournamentDay run waits for both opening music and craft assets");
for (let i = 0; i < 4; i++) {
  assert.deepEqual(notices.slice(i * 2, i * 2 + 2), [
    { label: "音楽を準備しています…" }, { label: "大会の準備をしています…" },
  ], "every initial/retry run keeps both ordered loading gates");
}
const victory = source.slice(source.indexOf("async function victory(cs)"), source.indexOf('  const after = DB.dialogues.ch1_tournament_after;'));
assert.match(victory, /^async function victory\(cs\) \{\s*const owner = state;/, "victory captures the state owner in its own scope");
assert(victory.includes("delete owner.tournament.entryResources"), "victory clears the captured owner's retry snapshot");

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
  // 再挑戦は一筆を逆向きに流す幕（#2688 A19・F4）。幕の内側で呼ぶ関数を受け取る。敗北の入りの灰色はこの検査では出さない
  retryStroke: callback => { transition = callback; }, defeatFade: async () => null, tournamentDay: () => resumed++,
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
console.log("PASS: absolute retry, no private lemon grant, one-time entry, schema15/16/17 migration, re-SAVE/LOAD, illness/progress/#577/Chapter2 preservation, LOAD during preload/wipe");


// 大会の紹介場面は強制イベント。好感度（初対面の♥1を含む）を上げない（2026-11-06 オーナー決定）。
for (const [file, id] of [["ch1_tournament", "ch1_tournament_opening"], ["ch2_tournament", "ch2_tournament_entrance"],
  ["ch3_main", "ch3_tournament_day"], ["ch4_main", "ch4_tournament_start"]]) {
  const scene = JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${file}.json`, import.meta.url), "utf8")).dialogues.find(row => row.dialogue_id === id);
  assert.equal(scene?.metadata?.forced_event, true, `${id} is a forced event (no affection)`);
  assert.equal(scene.metadata.add_affinity, undefined, `${id} has no affection reward`);
}
console.log("PASS tournament introductions are forced events");
