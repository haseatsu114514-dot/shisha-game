// node --experimental-vm-modules remake/test/tsumugi_schedule_782.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { TSUMUGI_STORY, tsumugiAtTonari, tsumugiMessages } from "../js/daily/tsumugi-schedule.js";

const flags = Object.fromEntries(TSUMUGI_STORY.map(step => [step.flag, true]));
const state = { chapter: 1, day: 6, slot: 0, flags: { ...flags }, story: {}, met: {}, inbox: [] };
const baseline = JSON.stringify(state);
assert.equal(tsumugiAtTonari(state), false);
assert.equal(tsumugiAtTonari({ ...state, slot: 1 }), true);
assert.equal(tsumugiAtTonari({ ...state, day: 8 }), true);
assert.equal(tsumugiAtTonari({ ...state, day: 8, slot: 1 }), false);
assert.equal(tsumugiAtTonari({ ...state, day: 8, slot: 1, story: { tsumugi: 4 } }), false);
for (const day of [4, 8, 12]) {
  for (const tsumugi of [0, 3, 4, 5, 6]) {
    const at = { ...state, day, story: { tsumugi } };
    assert.equal(tsumugiAtTonari({ ...at, slot: 0 }), day < 10);
    assert.equal(tsumugiAtTonari({ ...at, slot: 1 }), day >= 10);
  }
}
assert.equal(tsumugiAtTonari({ ...state, slot: 2 }), false);
for (const step of TSUMUGI_STORY) {
  for (const slot of [0, 1]) assert.equal(tsumugiAtTonari({ ...state, day: step.day, slot }), false);
}
// 延期未読・実際に補完した当日は通常遭遇なし。次の通常夜には復帰する。
const deferred = { ...flags, _tsumugi_contest_progress: false };
assert.equal(tsumugiAtTonari({ ...state, day: 4, flags: deferred }), false);
assert.equal(tsumugiAtTonari({ ...state, flags: { ...flags, _tsumugi_story_day: "1:6" }, slot: 1 }), false);
assert.equal(tsumugiAtTonari({ ...state, day: 7, flags: { ...flags, _tsumugi_story_day: "1:6" }, slot: 1 }), true);
assert.equal(tsumugiAtTonari({ ...state, chapter: 2, slot: 1, flags: {} }), true);
assert.equal(JSON.stringify(state), baseline, "在店照会が状態を書き換えた");

const friends = JSON.parse(await fs.readFile(new URL("../data/friends.json", import.meta.url), "utf8"));
for (const [index, day] of [5, 10].entries()) {
  const messages = tsumugiMessages({ ...state, day }, friends);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].trigger_day, day);
  assert.deepEqual(messages[0].messages, friends.friends.tsumugi.chats[index].m);
  assert.equal(tsumugiMessages({ ...state, day, inbox: [{ day: day - 1, chapter: 1, msg: { sender: "tsumugi" } }] }, friends).length, 0);
  assert.equal(tsumugiMessages({ ...state, day, inbox: [{ day, chapter: 1, msg: { sender: "tsumugi" } }] }, friends).length, 0);
}
assert.deepEqual(tsumugiMessages({ ...state, chapter: 2, day: 5 }, friends), []);
assert.deepEqual(tsumugiMessages({ ...state, day: 8 }, friends), []);

// 本番固定runnerを実行し、既読・レベル・一度きり・旧セーブ補完を確認。
const plays = [], levels = [], saves = [];
const context = vm.createContext({ console });
const scheduleSource = await fs.readFile(new URL("../js/daily/tsumugi-schedule.js", import.meta.url), "utf8");
const schedule = new vm.SourceTextModule(scheduleSource, { context });
await schedule.link(() => { throw Error("Unexpected schedule import"); });
await schedule.evaluate();
const mocks = {
  "state.js": { state, save: () => saves.push(JSON.stringify(state)) },
  "stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], setStoryAffinityCap() {}, releaseStoryAffinity: () => 0, affinityGateWaiting: () => false, ensureAffinityLevel: (id, level) => { levels.push([id, level]); return 0; } },
  "engine.js": { play: async id => plays.push(id) },
  "spots.js": { hasContact: () => true },
};
const story = new vm.SourceTextModule(await fs.readFile(new URL("../js/chapters/tsumugi-story.js", import.meta.url), "utf8"), { context });
await story.link(specifier => {
  const name = specifier.split("/").at(-1);
  if (name === "tsumugi-schedule.js") return schedule;
  const values = mocks[name];
  assert(values, `Unexpected import: ${specifier}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
});
await story.evaluate();
state.flags = {}; state.day = 4;
await story.namespace.playTsumugiStory(3, { deferFlags: ["_tsumugi_contest_progress"] });
assert.deepEqual(plays, ["ch1_tsumugi_research"]);
assert.equal(state.flags._tsumugi_contest_progress, undefined);
await story.namespace.playTsumugiStory(3);
assert.deepEqual(plays, ["ch1_tsumugi_research", "ch1_tsumugi_work_in_progress"]);
assert.equal(state.flags._tsumugi_story_day, "1:4");
assert.equal(tsumugiAtTonari(state), false);
state.day = 11;
await story.namespace.playTsumugiStory(11);
state.day = 13;
await story.namespace.playTsumugiStory(13);
const saved = JSON.stringify(state);
await story.namespace.playTsumugiStory(13);
assert.deepEqual(plays, TSUMUGI_STORY.map(step => step.dialogue));
assert.equal(JSON.stringify(state), saved);
assert.equal(saves.length, 4);
assert.deepEqual(levels.at(-1), ["tsumugi", 2]);
console.log("[782] 昼夜/固定日/延期/旧セーブ/一度きり/既存文の配信候補: PASS");
