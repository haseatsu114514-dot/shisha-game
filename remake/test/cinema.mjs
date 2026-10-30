import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = path => fs.readFile(new URL("../js/" + path, import.meta.url), "utf8");
const context = vm.createContext({});
const discovery = new vm.SourceTextModule(await source("core/cinema-discovery.js"), { context });
await discovery.link(() => { throw new Error("Unexpected dependency"); });
await discovery.evaluate();
const { CINEMA, CINEMA_FILMS, cinemaDiscovered, cinemaIntroductionDue } = discovery.namespace;
const dialogues = JSON.parse(await fs.readFile(new URL("../../data/dialogue/cinema.json", import.meta.url), "utf8"));
const DB = { dialogues: Object.fromEntries(dialogues.dialogues.map(scene => [scene.dialogue_id, scene])) };
const game = () => ({ chapter: 2, day: 4, slot: 0, phase: "daily", money: 5000, stamina: 80,
  flags: { _samechan_quiet_seat_done: true }, met: { samechan: true }, spotVisits: {}, visitedDay: {} });
let state = game(), result = { cancelled: false }, ready = true, playing = false, enter = async () => {};
let seen = [], rewards = [], notices = [], backgrounds = [];
const stateModule = new vm.SyntheticModule(["state"], function () { this.setExport("state", state); }, { context });
function replace(value) { state = value; stateModule.setExport("state", value); }
const ports = {
  "../core/state.js": stateModule,
  "../core/data.js": { DB, sceneBg: () => ({ url: "cinema.webp" }), loadCinemaDialogue: async () => DB },
  "../core/ui.js": { withScenePreparation: task => task, imageReady: async () => ready, toast: text => notices.push(text) },
  "../core/stats.js": {
    addMoney: n => state.money += n, addStamina: n => state.stamina += n,
    earnStat: (...args) => rewards.push(args),
  },
  "../core/travel-budget.js": { spendableMoney: value => value.money },
  "../vn/engine.js": { isPlaying: () => playing, play: async (id, options) => {
    seen.push(id); backgrounds.push(options?.bg); await enter(); return result;
  } },
  "../core/cinema-discovery.js": discovery,
};
const module = new vm.SourceTextModule(await source("daily/cinema.js"), { context });
await module.link(id => {
  const port = ports[id]; assert(port, id);
  return port instanceof vm.Module ? port : new vm.SyntheticModule(Object.keys(port), function () {
    for (const [key, value] of Object.entries(port)) this.setExport(key, value);
  }, { context });
});
await module.evaluate();
const { cinemaSpot, visitCinema, readCinemaIntroduction } = module.namespace;
assert(cinemaIntroductionDue(state));
for (const patch of [{ chapter: 1 }, { phase: "story" }, { met: {} }, { flags: {} }]) {
  assert(!cinemaIntroductionDue({ ...game(), ...patch }), JSON.stringify(patch));
}
assert(!cinemaIntroductionDue({ ...game(), flags: { _samechan_quiet_seat_done: true, _samechan_cinema_introduced: true } }));
assert(!cinemaDiscovered({ ...game(), story: { samechan: 999 }, spotVisits: { rojiura_cinema: 99 } }));
assert(!cinemaDiscovered({ ...game(), chapter: 1, flags: { _samechan_cinema_introduced: true } }));
assert.equal(CINEMA.region, "home");
for (const value of [null, undefined, { cancelled: true }]) {
  replace(game()); result = value; const before = structuredClone(state);
  assert.equal(await readCinemaIntroduction(), false); assert.deepEqual(state, before);
}
replace(game()); result = { cancelled: false }; enter = async () => {};
const beforeIntroduction = structuredClone(state);
assert.equal(await readCinemaIntroduction(), true);
assert.deepEqual(state, beforeIntroduction, "reading alone does not commit unlock or visit");
replace(game()); enter = async () => replace(game());
assert.equal(await readCinemaIntroduction(), false, "LOAD prevents introduction commit");
replace(game()); enter = async () => { throw new Error("missing renderer"); };
await assert.rejects(readCinemaIntroduction(), /missing renderer/);
enter = async () => {}; assert.equal(await readCinemaIntroduction(), true, "exception releases guard");
replace(game()); const introSignal = { aborted: false };
enter = async () => { introSignal.aborted = true; };
assert.equal(await readCinemaIntroduction({ signal: introSignal }), false);
replace(game()); enter = async () => { assert.equal(await readCinemaIntroduction(), false); };
assert.equal(await readCinemaIntroduction(), true, "introduction is not re-entrant");
enter = async () => {};
replace({ ...game(), chapter: 1 }); assert.equal(cinemaSpot(), null);
replace(game()); assert.equal(cinemaSpot().id, CINEMA.id);
assert.equal(await visitCinema(), false, "direct entry remains locked");
const unlocked = () => { replace(game()); state.flags._samechan_cinema_introduced = true; return state; };
for (const patch of [{ money: 999 }, { slot: 2 }, { phase: "story" }, { chapter: 1 }, { visitedDay: { rojiura_cinema: 4 } }]) {
  Object.assign(unlocked(), patch);
  const before = structuredClone(state);
  assert.equal(await visitCinema(), false);
  assert.deepEqual(state, before);
}
for (const value of [null, undefined, { cancelled: true }]) {
  unlocked(); result = value; const before = structuredClone(state);
  assert.equal(await visitCinema(), false); assert.deepEqual(state, before);
}
unlocked(); result = { cancelled: false }; ready = false;
const beforeMissing = structuredClone(state);
assert.equal(await visitCinema(), false); assert.deepEqual(state, beforeMissing); assert.equal(notices.length, 1);
ready = true;
unlocked(); enter = async () => { throw new Error("VN failure"); };
const beforeThrow = structuredClone(state);
await assert.rejects(visitCinema(), /VN failure/); assert.deepEqual(state, beforeThrow);
enter = async () => {}; // throwing must release the in-flight guard
assert.equal(await visitCinema(), true);
unlocked(); const previous = state;
enter = async () => replace(game());
assert.equal(await visitCinema(), false); assert.equal(previous.money, 5000); assert.equal(state.money, 5000);
unlocked(); enter = async () => state.day++;
assert.equal(await visitCinema(), false); assert.equal(state.money, 5000);
unlocked(); const signal = { aborted: false };
enter = async () => { signal.aborted = true; };
assert.equal(await visitCinema({ signal }), false); assert.equal(state.money, 5000);
unlocked(); enter = async () => { assert.equal(await visitCinema(), false, "re-entrant call"); };
rewards = []; seen = [];
assert.equal(await visitCinema(), true);
assert.equal(state.money, 4000); assert.equal(state.stamina, 72);
assert.equal(state.spotVisits.rojiura_cinema, 1);
assert.equal(state.slot, 0, "calendar owns slot advancement");
assert.deepEqual(rewards, [["insight", 4]], "candidate for existing paidAction, not direct growth");
assert.equal(await visitCinema(), false, "completed action cannot be charged twice");
// 再訪プール全体を巡り、追加された上映も精算を一度だけ行う。
for (const id of CINEMA.pool) {
  state.day++; state.money += CINEMA.cost;
  assert(DB.dialogues[id]?.lines?.length, id);
  assert.equal(await visitCinema(), true);
  assert.equal(seen.at(-1), id);
  assert.equal(backgrounds.at(-1), CINEMA_FILMS[DB.dialogues[id].metadata.cinema_film].bg,
    "each film uses its matching background");
}
assert.deepEqual(seen, [CINEMA.first, ...CINEMA.pool]);
assert.equal(Object.keys(CINEMA_FILMS).length, 4, "a small fixed repertoire");
assert.equal(new Set(backgrounds.filter(Boolean)).size, 4, "all four screening backgrounds are used");
console.log("[cinema] discovery, legacy, direct access, funds/slots, cancel/missing/throw/LOAD/abort, re-entry, once-only settlement: PASS");
