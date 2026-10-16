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
  "core/stats.js": { gainAffinity: (id, n) => { state.affinity[id] = (state.affinity[id] || 0) + n; }, affinityLevel: () => 3, releaseHiyoriAffinity: () => {}, addMoney() {}, addStamina() {} },
  "vn/engine.js": { play: async id => played.push(id), isPlaying: () => false },
  "daily/bonds.js": { afterStory: async () => {}, playHiyoriQuestion: async () => false, finaleAtVisit: () => false, playFinale: async () => false },
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
const { visitHiyoriAtShop, meetHiyoriAtTonari, playHiyoriEvent } = mod.namespace;
const shops = [{ id: "naru", kind: "rival" }, { id: "adam", kind: "rival" },
  { id: "minto", kind: "rival" }, { id: "shop", kind: "shop" }, { id: "c_station", kind: "spot" }];
function reset(seed = 0, flags = { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true,
  _hiyori_message_delivered: true, _hiyori_cracks_done: true }) {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, { seed, chapter: 1, day: 1, slot: 0, flags: { ...flags },
    contacts: [], met: { hiyori: true }, story: {}, affinity: {}, lovers: [], finales: {}, loveLevel: {} });
  played.length = 0; saves = 0;
}
// Every first meeting is retained, regardless of the save seed or initial shop.
for (const shop of shops) for (let seed = 0; seed < 20; seed++) {
  reset(seed, {}); assert(await visitHiyoriAtShop(shop));
  assert.equal(state.flags._hiyori_meeting_shop, shop.id);
  assert(!await visitHiyoriAtShop(shops[(shops.indexOf(shop) + 1) % shops.length]));
  state.day++; assert(!await visitHiyoriAtShop(shop), "Report must precede the relay");
  assert(await meetHiyoriAtTonari(), "The mandatory report must not be randomized");
}
const rates = {};
const gaps = new Set();
for (const shop of shops) {
  let hits = 0;
  for (let seed = 0; seed < 500; seed++) {
    reset(seed); let lastHit = null;
    for (let day = 1; day <= 14; day++) {
      state.day = day;
      if (await visitHiyoriAtShop(shop)) {
        hits++;
        if (lastHit !== null) gaps.add(day - lastHit);
        lastHit = day;
      }
    }
  }
  rates[shop.id] = hits / 7000;
  assert(rates[shop.id] > 0.18 && rates[shop.id] < 0.22, JSON.stringify(rates));
}
assert(gaps.size > 5 && gaps.has(1) && gaps.has(5), "Encounters must have varying gaps");
// A miss cannot be rerolled by repeating the call; a hit locks other shops that day.
let foundMiss = false;
for (let seed = 0; seed < 100 && !foundMiss; seed++) {
  reset(seed); const before = JSON.stringify(state);
  if (!await visitHiyoriAtShop(shops[0])) {
    foundMiss = true; assert.equal(JSON.stringify(state), before); assert.equal(saves, 0);
    assert(!await visitHiyoriAtShop(shops[0])); assert.equal(JSON.stringify(state), before);
  }
}
assert(foundMiss);
reset(131); state.day = 6;
assert(await visitHiyoriAtShop(shops[2]));
const count = state.flags._hiyori_repeat_count, points = state.affinity.hiyori;
state.slot = 1; assert(!await visitHiyoriAtShop(shops[1]));
assert.equal(state.flags._hiyori_repeat_count, count); assert.equal(state.affinity.hiyori, points);
let chapterTwoHit = false;
for (let seed = 0; seed < 100 && !chapterTwoHit; seed++) {
  reset(seed); state.chapter = 2; state.flags._hiyori_encounter_day = "1:1";
  chapterTwoHit = await visitHiyoriAtShop(shops[0]);
}
assert(chapterTwoHit, "The preceding chapter's day must not block a new encounter");
state.chapter = 3; assert(!await visitHiyoriAtShop(shops[0]));
let twoSlotHits = 0;
for (let seed = 0; seed < 500; seed++) {
  reset(seed);
  for (let day = 1; day <= 14; day++) for (let slot = 0; slot < 2; slot++) {
    Object.assign(state, { day, slot });
    if (await visitHiyoriAtShop(shops[(day + slot) % shops.length])) twoSlotHits++;
  }
}
const twoSlotRate = twoSlotHits / 14000;
assert(twoSlotRate > 0.16 && twoSlotRate < 0.20, "The existing one-encounter-per-day limit must hold");
// Story order and required tonari scenes remain reachable and reward only once.
reset(131, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true });
state.day = 6; assert(await visitHiyoriAtShop(shops[2])); assert(state.flags._hiyori_message_delivered);
state.day = 7; assert(await visitHiyoriAtShop(shops[1])); assert(state.flags._hiyori_cracks_done);
assert(await playHiyoriEvent("tonari_return"));
const reward = state.affinity.hiyori; assert(!await playHiyoriEvent("tonari_return"));
assert.equal(state.affinity.hiyori, reward);
assert(await meetHiyoriAtTonari()); assert(state.flags._hiyori_tonari_followup_done);
assert(!state.flags._hiyori_real_self_known);
console.log("[hiyori frequency] PASS", JSON.stringify({ rates, twoSlotRate, gaps: [...gaps].sort((a,b) => a-b) }));
