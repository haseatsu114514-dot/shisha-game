// 東京の会員利用は既存の一枠だけ。読了・取消・LOAD・精算の境界を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { newState, setState, saveToSlot, loadFromSlot } from "../js/core/state.js";
import * as stats from "../js/core/stats.js";
import { advanceToChapterThree, chapterThreeScenes, completeChapterThreeScene,
  chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { proposeTokyoVisit, bookTokyoVisit } from "../js/core/tokyo-visits.js";
import { TOKYO_FREE_TIMES, tokyoTime, tokyoWindowReserved } from "../js/core/tokyo-clock.js";
import * as activity from "../js/chapters/ch3-activity-progress.js";

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)) };
const copy = value => structuredClone(value);
const definitions = JSON.parse(fs.readFileSync(new URL("../../data/tokyo_visits.json", import.meta.url)));
const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_activities.json", import.meta.url)));
assert.deepEqual(data.dialogues.map(scene => scene.dialogue_id), ["ch3_choizap_day", "ch3_choizap_night"]);
for (const scene of data.dialogues) {
  assert(scene.lines.length >= 3);
  assert(scene.lines.every(line => !line.type && ["", "hajime"].includes(line.speaker)),
    "A Tokyo chain branch must not teleport hometown encounters or pre-apply rewards");
}

function departure({ member = true, legacy = false } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 12345, stamina: 80 });
  value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
    _ch2_tournament: { stage: "complete" } };
  if (member) value.flags._gym_member = true;
  assert(advanceToChapterThree(value));
  if (legacy) delete value.flags._ch3_intro.routeVersion;
  return value;
}

function firstWindow(options) {
  const value = departure(options);
  for (const scene of chapterThreeScenes(value)) {
    if (chapterThreeFreeTime(value)) break;
    assert(completeChapterThreeScene(value, scene.id));
  }
  assert(chapterThreeFreeTime(value));
  return value;
}

// 新旧ルートでも章の日数・既読を巻き戻さず、現在の未消化一枠にだけ到達する。
for (const legacy of [false, true]) {
  const value = firstWindow({ legacy });
  const window = chapterThreeFreeTime(value), before = copy(value);
  assert.equal(window.id, "d5-noon");
  assert.equal(value.day, 33); assert.equal(value.slot, 0);
  assert(activity.chapterThreeGymAvailability(value, window.id).ok);
  assert.deepEqual(value, before, "Reading gym availability mutated the save");
  const stage = value.flags._ch3_intro.stage;
  assert(!completeChapterThreeScene(value, chapterThreeScenes(value)[stage].id), "A gym window was bypassed by the next story");
  assert(activity.claimChapterThreeGym(value, window.id));
  assert.equal(value.flags._ch3_intro.stage, stage);
  assert.deepEqual(value.tokyoVisits.closedSlots, [window.id]);
  assert.equal(value.visitedDay.choizap, 33);
  assert.equal(value.spotVisits.choizap, 1);
  assert.deepEqual(value.flags._fit_since, { chapter: 3, day: 33 });
  const once = copy(value);
  assert.equal(activity.claimChapterThreeGym(value, window.id), null);
  assert.deepEqual(value, once, "An old gym button consumed another window");
  setState(value); assert(saveToSlot("suien_remake_slot1"));
  const loaded = loadFromSlot("suien_remake_slot1");
  assert.deepEqual(loaded.tokyoVisits.closedSlots, [window.id]);
  assert.equal(activity.claimChapterThreeGym(loaded, window.id), null);
}

// 既存訪問の重複枠は互換のため残すが、ジムだけの新規枠にしない。
for (const legacy of [false, true]) {
  const value = departure({ legacy });
  const gymWindows = [], storyTimes = new Set(chapterThreeScenes(value).map(scene =>
    `${value.flags._ch3_intro.startDay + scene.day - 1}:${scene.slot}`));
  for (const scene of chapterThreeScenes(value)) {
    assert(completeChapterThreeScene(value, scene.id));
    for (let window; (window = chapterThreeFreeTime(value));) {
      gymWindows.push(window.id);
      assert(!storyTimes.has(`${window.day}:${window.slot}`), `Gym overlaps mandatory story: ${window.id}`);
      assert(activity.claimChapterThreeRest(value, window.id));
    }
  }
  assert(!gymWindows.includes("d13-night"));
  assert.equal(gymWindows.includes("d9-noon"), legacy);
  assert.equal(gymWindows.includes("d10-night"), legacy);
  assert.equal(value.day, 42); assert.equal(value.phase, "tournament");
}
{
  const value = departure();
  const finalStage = chapterThreeScenes(value).length;
  value.flags._ch3_intro.stage = finalStage;
  const window = tokyoTime(value, TOKYO_FREE_TIMES.find(time => time.id === "d13-night"));
  Object.assign(value, { day: window.day, slot: window.slot, phase: "daily" });
  value.tokyoVisits.plans.push({ id: "legacy-reserved", status: "staying", met: true,
    meetup: { id: "d12-noon", day: 40, slot: 0 }, date: window });
  assert.equal(chapterThreeFreeTime(value).id, window.id, "An existing eve date was dropped");
  assert.equal(activity.chapterThreeGymAvailability(value, window.id).reason, "reserved");
}

// 旧ルートの非会員は従来どおり空き時間なし。新ルートは地図の行き先があるので会員でなくても開く（#1655）。
{
  const value = departure({ member: false, legacy: true });
  assert.equal(activity.chapterThreeGymAvailability(value, "d5-noon").reason, "member");
  for (const scene of chapterThreeScenes(value)) assert(completeChapterThreeScene(value, scene.id));
  assert.equal(value.day, 42); assert.equal(value.phase, "tournament");
  assert.equal(chapterThreeFreeTime(value), null, "Legacy nonmembers gained unrequested action windows");
}
{
  const value = departure({ member: false });
  assert.equal(activity.chapterThreeGymAvailability(value, "d5-noon").reason, "member");
  const windows = [];
  for (const scene of chapterThreeScenes(value)) {
    for (let window; (window = chapterThreeFreeTime(value));) {
      windows.push(window.id);
      assert(activity.claimChapterThreeRest(value, window.id));
    }
    assert(completeChapterThreeScene(value, scene.id));
  }
  assert.deepEqual(windows, ["d5-noon", "d6-night", "d8-night", "d9-night", "d10-noon", "d12-noon"]);
  assert.equal(value.day, 42); assert.equal(value.phase, "tournament");
}

{
  const value = departure();
  value.lovers = ["tsumugi"]; value.contacts = ["tsumugi"];
  assert(bookTokyoVisit(value, definitions, proposeTokyoVisit(value, definitions, "tsumugi")));
  while (!chapterThreeFreeTime(value)) {
    assert(completeChapterThreeScene(value, chapterThreeScenes(value)[value.flags._ch3_intro.stage].id));
  }
  const window = chapterThreeFreeTime(value), before = copy(value);
  assert(tokyoWindowReserved(value, window));
  assert.equal(activity.chapterThreeGymAvailability(value, window.id).reason, "reserved");
  assert.equal(activity.claimChapterThreeGym(value, window.id), null);
  assert.deepEqual(value, before, "Gym stole a rendezvous or changed the visitor's location");
  const pending = firstWindow();
  pending.pendingInvite = { day: pending.day, slot: pending.slot, event: "existing" };
  assert(tokyoWindowReserved(pending, { id: "d5-noon", day: pending.day, slot: pending.slot }));
  assert.equal(chapterThreeFreeTime(pending), null, "Gym exposed a slot reserved by an existing invitation");
  // 旧inviteはday省略時に「今日」を指す。参照時に保存データへdayを補わない。
  for (const day of [undefined, null]) {
    const legacyInvite = firstWindow();
    legacyInvite.pendingInvite = { slot: legacyInvite.slot, event: "legacy-existing", ...(day === null ? { day } : {}) };
    const prior = copy(legacyInvite);
    assert(tokyoWindowReserved(legacyInvite, { id: "d5-noon", day: legacyInvite.day, slot: legacyInvite.slot }));
    assert(!tokyoWindowReserved(legacyInvite, { id: "future", day: legacyInvite.day + 1, slot: legacyInvite.slot }),
      "An invitation without day reserved future dates too");
    assert.equal(chapterThreeFreeTime(legacyInvite), null);
    assert.equal(activity.claimChapterThreeGym(legacyInvite, "d5-noon"), null);
    assert.deepEqual(legacyInvite, prior, "Reservation lookup rewrote the legacy invitation");
  }
}

{
  const value = firstWindow();
  value.day += 1;
  const before = copy(value);
  assert.equal(chapterThreeFreeTime(value), null);
  assert.equal(activity.claimChapterThreeGym(value, "d5-noon"), null);
  assert.deepEqual(value, before, "A legacy save re-opened a free time in its past");
}
{
  const value = firstWindow({ legacy: true });
  while (chapterThreeFreeTime(value)?.id !== "d9-noon") {
    const window = chapterThreeFreeTime(value);
    if (window) assert(activity.claimChapterThreeRest(value, window.id));
    else assert(completeChapterThreeScene(value, chapterThreeScenes(value)[value.flags._ch3_intro.stage].id));
  }
  assert(activity.claimChapterThreeGym(value, "d9-noon"));
  assert.equal(chapterThreeFreeTime(value).id, "d9-night");
  assert.equal(activity.chapterThreeGymAvailability(value, "d9-night").reason, "used-today");
  const before = copy(value);
  assert.equal(activity.claimChapterThreeGym(value, "d9-night"), null);
  assert.deepEqual(value, before, "One member used two branches on the same day");
}

// Runtime adapter: real stats/paidAction, with only the VN and display surface controlled.
let selected = null, saves = 0, playCalls = 0, finishPlay = null;
const context = vm.createContext({ AbortController, window: new EventTarget() });
const synthetic = (names, values) => new vm.SyntheticModule(names, function () {
  for (const name of names) this.setExport(name, values[name]);
}, { context });
const stateModule = synthetic(["state", "save"], { state: null, save: () => { saves++; } });
const dataModule = synthetic(["DB", "bgUrl"], { DB: { dialogues: {} }, bgUrl: id => id });
const uiModule = synthetic(["layers", "showScreen", "setBg", "toast"], {
  layers: { hud: { replaceChildren() {}, classList: { remove() {} } } },
  showScreen() {}, setBg: async () => {}, toast() {},
});
const vnModule = synthetic(["play"], { play: (_dialogue, { signal }) => {
  playCalls++;
  return new Promise(resolve => {
    finishPlay = resolve;
    signal.addEventListener("abort", () => resolve({ cancelled: true }), { once: true });
  });
} });
const deps = {
  "../core/data.js": dataModule,
  "../core/state.js": stateModule,
  "../core/stats.js": synthetic(["addStamina", "earnStat", "paidAction"], stats),
  "../core/ui.js": uiModule,
  "../vn/engine.js": vnModule,
  "../daily/spots.js": synthetic(["facilityGrowth"], { facilityGrowth: spot => {
    assert.equal(spot.id, "choizap"); assert.equal(spot.stat, "charm");
    return { budget: 1, points: 2, primary: spot.stat };
  } }),
  "../core/chapter-data.js": synthetic(["readDialogues"], { readDialogues: async () =>
    Object.fromEntries(data.dialogues.map(scene => [scene.dialogue_id, scene])) }),
  "./ch3-activity-progress.js": synthetic(Object.keys(activity), activity),
};
const runtime = new vm.SourceTextModule(fs.readFileSync(new URL("../js/chapters/ch3-activities.js", import.meta.url), "utf8"), { context });
await runtime.link(spec => { assert(deps[spec], `Unexpected dependency: ${spec}`); return deps[spec]; });
await runtime.evaluate();
const { visitChapterThreeGym: visit, restChapterThreeFreeTime: rest } = runtime.namespace;
const choose = value => {
  selected = value; setState(value); stateModule.setExport("state", value);
};
const ready = async () => { for (let i = 0; i < 10 && !finishPlay; i++) await new Promise(resolve => setImmediate(resolve)); assert(finishPlay); };

{
  choose(firstWindow()); const before = copy(selected), window = chapterThreeFreeTime(selected);
  saves = 0; finishPlay = null;
  const pending = visit(window.id); await ready();
  assert.deepEqual(selected, before, "Starting a gym dialogue consumed resources before completion");
  assert.equal(await visit(window.id), false, "Two clicks launched duplicate workouts");
  assert.equal(rest(window.id), false, "A stale rest button consumed the active workout's slot");
  finishPlay({ cancelled: false }); assert.equal(await pending, true);
  assert.equal(selected.stamina, before.stamina - 8);
  assert.equal(selected.stats.charm, before.stats.charm + 2);
  assert.equal(selected.money, before.money, "Tokyo charged an existing member again");
  assert.equal(selected.flags._gym_member, true);
  assert.deepEqual(selected.flags._fit_since, { chapter: 3, day: window.day });
  assert.equal(saves, 1);
  const once = copy(selected); assert.equal(await visit(window.id), false);
  assert.deepEqual(selected, once);
}

for (const cancellation of ["abort", "cancelled", "load"]) {
  choose(firstWindow()); const before = copy(selected), window = chapterThreeFreeTime(selected);
  saves = 0; finishPlay = null;
  const controller = new AbortController();
  const pending = visit(window.id, { signal: controller.signal }); await ready();
  if (cancellation === "abort") controller.abort();
  else if (cancellation === "load") { const loaded = copy(selected); choose(loaded); finishPlay({ cancelled: false }); }
  else finishPlay({ cancelled: true });
  assert.equal(await pending, false);
  assert.deepEqual(selected, before, `${cancellation} committed a workout`);
  assert.equal(saves, 0);
}

{
  choose(firstWindow()); selected.stats.charm = 82;
  const before = copy(selected), window = chapterThreeFreeTime(selected);
  const sum = value => Object.values(value.stats).reduce((total, points) => total + points, 0);
  finishPlay = null;
  const pending = visit(window.id); await ready(); finishPlay({ cancelled: false }); await pending;
  assert.equal(selected.stats.charm, 82);
  assert.equal(sum(selected) - sum(before), 2, "Gym lost the existing chapter-cap transfer");
}

{
  choose(firstWindow()); selected.stats.guts = 80;
  const expected = stats.staminaAfter(activity.TOKYO_GYM.stamina), window = chapterThreeFreeTime(selected);
  finishPlay = null;
  const pending = visit(window.id); await ready(); finishPlay({ cancelled: false }); await pending;
  assert.equal(selected.stamina, expected, "Tokyo did not share the established guts stamina reduction");
}

{
  choose(firstWindow()); selected.stamina = 12;
  const before = copy(selected), window = chapterThreeFreeTime(selected); saves = 0;
  assert(rest(window.id)); assert.equal(selected.stamina, 67);
  assert.deepEqual(selected.stats, before.stats); assert.deepEqual(selected.statXp, before.statXp);
  assert.equal(selected.money, before.money); assert.equal(selected.flags._fit_since, undefined);
  assert.equal(selected.visitedDay.choizap, undefined); assert.equal(saves, 1);
  const once = copy(selected); assert(!rest(window.id)); assert.deepEqual(selected, once);
}

{
  choose(firstWindow()); selected.stamina = 0;
  const before = copy(selected), calls = playCalls;
  assert.equal(await visit(chapterThreeFreeTime(selected).id), false);
  assert.equal(playCalls, calls); assert.deepEqual(selected, before);
}

console.log("PASS: Tokyo membership, one finite action, reservations, day-bound fit, once-only real stamina/growth, rest, interruption and LOAD boundaries");
