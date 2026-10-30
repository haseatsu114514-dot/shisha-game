// Run the production encounter path over multiple save seeds and shop visits.
// node --experimental-vm-modules remake/test/hiyori_frequency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const root = new URL("../../", import.meta.url);
const hiyori = JSON.parse(await fs.readFile(new URL("data/dialogue/hiyori.json", root), "utf8"));
const DB = { hiyori, dialogues: Object.fromEntries(hiyori.dialogues.map(d => [d.dialogue_id, d])) };
const state = {}, played = [];
let saves = 0;
const context = vm.createContext({ Math, Set, Promise, console });
const mocks = {
  "core/data.js": { DB },
  "core/state.js": { state, save: () => saves++ },
  "core/stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], setStoryAffinityCap() {}, releaseStoryAffinity: () => 0, affinityGateWaiting: () => false, gainAffinity: (id, n) => { state.affinity[id] = (state.affinity[id] || 0) + n; }, affinityLevel: () => 3, ensureAffinityLevel: (id, level) => { const target = [0, 9, 20, 33, 48, 66][level]; if (!id || !Number.isInteger(level) || !(target > 0) || state.lovers.includes(id)) return 0; const before = state.affinity[id] || 0; state.affinity[id] = Math.max(before, target); return state.affinity[id] - before; }, releaseHiyoriAffinity: () => {}, addMoney() {}, addStamina() {} },
  "vn/engine.js": { play: async id => played.push(id), isPlaying: () => false },
  "daily/bonds.js": { afterStory: async () => {}, hiyoriQuestionReady: () => false, playHiyoriQuestion: async () => false, finaleAtVisit: () => false, playFinale: async () => false },
  "daily/spots.js": { allSpots: () => shops, isClosed: spot => spot.closedOn === state.day % 7, isUnlocked: spot => !spot.locked, shortNormalVisit: () => false },
  "daily/spot-hours.js": { rinUnavailable: () => state.slot === 1 ? "" : "夜から" },
  "daily/hiyori-axe.js": { hiyoriAxeAffordable: () => false, playHiyoriAxeSequence: async () => false },
};
const modules = new Map();
async function load(name) {
  if (modules.has(name)) return modules.get(name);
  const mod = mocks[name]
    ? new vm.SyntheticModule(Object.keys(mocks[name]), function () {
      for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
    }, { context, identifier: name })
    : new vm.SourceTextModule(await fs.readFile(new URL(`remake/js/${name}`, root), "utf8"), { context, identifier: name });
  modules.set(name, mod);
  await mod.link(specifier => load(new URL(specifier, `https://test/${name}`).pathname.slice(1)));
  return mod;
}
const mod = await load("daily/hiyori.js"); await mod.evaluate();
const { visitHiyoriAtShop, meetHiyoriAtTonari, playHiyoriEvent, hiyoriShopLocation, hiyoriShopEncounterDue } = mod.namespace;
const shops = [{ id: "naru", kind: "rival" }, { id: "adam", kind: "rival" },
  { id: "minto", kind: "rival" }, { id: "shop", kind: "shop" }, { id: "c_station", kind: "spot" }];
function reset(seed = 0, flags = { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true,
  _hiyori_message_delivered: true, _hiyori_cracks_done: true }) {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, { seed, chapter: 1, day: 1, slot: 0, flags: { ...flags },
    contacts: [], met: { hiyori: true }, story: {}, affinity: {}, lovers: [], finales: {}, loveLevel: {} });
  played.length = 0; saves = 0;
}
// A single shop per time slot; first meetings cover all eligible shops over save seeds.
const firstLocations = new Set();
for (let seed = 0; seed < 500; seed++) {
  reset(seed, {}); state.slot = 1;
  const before = JSON.stringify(state), location = hiyoriShopLocation();
  assert(location); firstLocations.add(location);
  assert.equal(shops.filter(hiyoriShopEncounterDue).length, 1);
  assert.equal(JSON.stringify(state), before); assert.equal(saves, 0);
  const other = shops.find(s => s.id !== location);
  assert(!await visitHiyoriAtShop(other));
  assert(await visitHiyoriAtShop(shops.find(s => s.id === location)));
  assert.equal(state.flags._hiyori_meeting_shop, location);
  assert.equal(hiyoriShopLocation(), null);
  state.day++; assert.equal(hiyoriShopLocation(), null, "Report must precede relay");
  assert(await meetHiyoriAtTonari());
}
const eligibleShops = shops.filter(s => s.id !== "shop");
assert.deepEqual([...firstLocations].sort(), eligibleShops.map(s => s.id).sort());
assert(!firstLocations.has("shop"), "Dr.fookah showroom must never be chosen for first meeting");
let encounters = 0, absent = 0;
for (let seed = 0; seed < 100; seed++) {
  reset(seed);
  for (let day = 1; day <= 14; day++) for (let slot = 0; slot < 2; slot++) {
    Object.assign(state, { day, slot });
    const before = JSON.stringify(state), location = hiyoriShopLocation();
    assert.equal(hiyoriShopLocation(), location);
    assert.equal(JSON.stringify(state), before);
    assert(shops.filter(hiyoriShopEncounterDue).length <= 1);
    if (!location) { absent++; continue; }
    assert.notEqual(location, "shop", "Showroom must never be chosen during relay/cracks/repeat");
    const other = shops.find(s => s.id !== location);
    assert(!await visitHiyoriAtShop(other));
    assert(await visitHiyoriAtShop(shops.find(s => s.id === location)));
    encounters++;
    const saved = JSON.stringify(state), savedCount = saves;
    assert(!await visitHiyoriAtShop(other));
    assert.equal(hiyoriShopLocation(), null); assert.equal(JSON.stringify(state), saved);
    assert.equal(saves, savedCount);
  }
}
assert(encounters > 500 && absent > 500, "Both encounter and absent slots must be exercised");
// A store action may change meeting/unlock/consultation state; keep the entry-time schedule.
reset(131, {}); state.slot = 1;
const planned = hiyoriShopLocation();
shops.find(s => s.id === planned).locked = true;
assert(await visitHiyoriAtShop(shops.find(s => s.id === planned), { scheduledSpot: planned }));
delete shops.find(s => s.id === planned).locked;
// Closure, locks, showroom ineligibility and accepted invitations override spontaneous appearances.
reset(131, {}); state.slot = 1;
const scheduled = shops.find(s => s.id === hiyoriShopLocation());
scheduled.locked = true; assert.notEqual(hiyoriShopLocation(), scheduled.id); delete scheduled.locked;
scheduled.closedOn = state.day % 7; assert.notEqual(hiyoriShopLocation(), scheduled.id); delete scheduled.closedOn;
state.visitedDay = { [scheduled.id]: state.day }; assert.notEqual(hiyoriShopLocation(), scheduled.id); state.visitedDay = {};
state.slot = 0; assert.notEqual(hiyoriShopLocation(), "shop");
state.slot = 1; assert.notEqual(hiyoriShopLocation(), "shop");
assert(!mod.namespace.hiyoriShopEligible({ id: "shop", kind: "shop" }));
assert(!await visitHiyoriAtShop({ id: "shop", kind: "shop" }, { scheduledSpot: "shop" }));
state.pendingInvite = { sender: "hiyori", event: "__hiyori_shop__", day: state.day };
assert.equal(hiyoriShopLocation(), null); delete state.pendingInvite;
state.chapter = 3; assert.equal(hiyoriShopLocation(), null);
// Follow the displayed schedule to the actual relay and cracks; no read/reward injection.
reset(131, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true });
for (let day = 1; day <= 14 && !state.flags._hiyori_cracks_done; day++) {
  state.day = day; const id = hiyoriShopLocation();
  if (id) await visitHiyoriAtShop(shops.find(s => s.id === id));
}
assert(state.flags._hiyori_message_delivered && state.flags._hiyori_cracks_done);
assert(await playHiyoriEvent("tonari_return"));
const reward = state.affinity.hiyori; assert(!await playHiyoriEvent("tonari_return"));
assert.equal(state.affinity.hiyori, reward);
assert(await meetHiyoriAtTonari()); assert(state.flags._hiyori_tonari_followup_done);
assert.equal(hiyoriShopLocation(), null, "The next tonari meeting must not also appear at another shop");
assert(!state.flags._hiyori_real_self_known);
// #1434 決定B: feelings_spoken は第1〜3章・仕事の相談の読了後・恋人・絆Lv2の時だけ。デート後の入口（calendar.js）から一度だけ。
reset(7, { _hiyori_work_talk_done: true });
assert(!await playHiyoriEvent("feelings_spoken"), "not before becoming lovers");
state.lovers = ["hiyori"]; state.loveLevel = { hiyori: 1 };
assert(!await playHiyoriEvent("feelings_spoken"), "bond Lv2 is required");
state.loveLevel.hiyori = 2; state.chapter = 4;
assert(!await playHiyoriEvent("feelings_spoken"), "chapters 1-3 only");
state.chapter = 2;
const affinityBefore = JSON.stringify(state.affinity);
assert(await playHiyoriEvent("feelings_spoken"));
assert.deepEqual(played, ["hiyori_feelings_spoken"]); assert.equal(state.flags._hiyori_feelings_spoken, true);
assert.equal(JSON.stringify(state.affinity), affinityBefore, "the scene itself grants no affinity");
assert(!await playHiyoriEvent("feelings_spoken"), "read once");
console.log("[hiyori schedule] PASS", JSON.stringify({ firstLocations: [...firstLocations], encounters, absent }));
