// node --experimental-vm-modules remake/test/trpg_campaign_save.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const storage = new Map();
const context = vm.createContext({ Date, Math, console,
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } });
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const module = new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, module); await module.link(s => load(new URL(s, url))); return module;
}
const mod = await load(new URL("../js/core/state.js", import.meta.url)); await mod.evaluate();
const core = mod.namespace, copy = v => JSON.parse(JSON.stringify(v));
const legacy = copy(core.newState()); legacy.schema = 13; delete legacy.trpg;
Object.assign(legacy, { chapter: 2, day: 3, slot: 1, money: 12345 });
legacy.lovers = ["hiyori"]; legacy.affinity.hiyori = 66;
for (const key of [core.SAVE_KEY, "suien_remake_slot1"]) {
  storage.set(key, JSON.stringify(legacy));
  const state = copy(key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key));
  assert.equal(state.schema, 15); assert.equal(state.money, 12345); assert.equal(state.slot, 1);
  assert.deepEqual(state.trpg, { stock: [], owned: [], cleared: {}, shifts: [], club: { founded: null, members: {} } });
  assert.deepEqual(state.lovers, ["hiyori"]);
}
// Schema 14 preserves books and endings without inferring club events.
const oldCampaign = copy(core.newState()); oldCampaign.schema = 14; delete oldCampaign.trpg.club;
oldCampaign.trpg.stock = ["ordinary-cup"]; oldCampaign.trpg.owned = ["ordinary-cup"];
oldCampaign.trpg.cleared["ordinary-cup"] = { chapter: 2, day: 3, gm: "hiyori", participants: ["hiyori", "hajime"], ending: "discovery" };
for (const key of [core.SAVE_KEY, "suien_remake_slot1"]) {
  storage.set(key, JSON.stringify(oldCampaign));
  const migrated = copy(key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key));
  assert.deepEqual(migrated.trpg.club, { founded: null, members: {} });
  assert.deepEqual(migrated.trpg.owned, ["ordinary-cup"]); assert(migrated.trpg.cleared["ordinary-cup"]);
}
const modern = core.newState(); Object.assign(modern, { chapter: 2, day: 3, slot: 2 });
modern.trpg = { stock: ["ordinary-cup", "ordinary-cup"], owned: ["ordinary-cup"],
  cleared: { "ordinary-cup": { chapter: 2, day: 3, gm: "hiyori", participants: ["hiyori", "hajime"], ending: "discovery", endingTitle: "一緒に見つけた一台" } },
  club: { founded: { chapter: 2, day: 2 }, members: {
    hiyori: { chapter: 2, day: 3 }, samechan: { chapter: 2, day: 4 },
    naru: { chapter: 2, day: 4 }, sumi: { chapter: 2, day: 4 }, adam: { chapter: 1, day: 2 },
  } },
  shifts: [{ id: "samechan", chapter: 2, day: 5, slot: 1, busy: true }] };
core.setState(modern); core.saveToSlot("suien_remake_slot2");
const loaded = copy(core.loadFromSlot("suien_remake_slot2"));
assert.equal(loaded.slot, 2); assert.deepEqual(loaded.trpg.owned, ["ordinary-cup"]);
assert.deepEqual(loaded.trpg.stock, ["ordinary-cup"]);
assert.equal(loaded.trpg.cleared["ordinary-cup"].ending, "discovery"); assert(loaded.trpg.shifts[0].busy);
assert.deepEqual(Object.keys(loaded.trpg.club.members), ["hiyori", "samechan"]);
assert.deepEqual(loaded.trpg.club.founded, { chapter: 2, day: 2 });
console.log("PASS: schema 13/14 auto/manual migration; schema 15 membership, books, clears and shifts");
