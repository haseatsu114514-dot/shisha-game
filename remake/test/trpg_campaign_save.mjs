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
  assert.equal(state.schema, core.SCHEMA); assert.equal(state.money, 12345); assert.equal(state.slot, 1);
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

// Malformed legacy TRPG data must not erase unrelated progress or invent purchases/read events.
const emptyTrpg = { stock: [], owned: [], cleared: {}, shifts: [], club: { founded: null, members: {} } };
const validClear = { chapter: 2, day: 3, gm: "hiyori", participants: ["hiyori", "hajime"], ending: "discovery" };
const validShift = { id: "hiyori", chapter: 2, day: 4, slot: 0, busy: false };
const founded = { chapter: 2, day: 3 };
const cases = [];
for (const value of [undefined, null, [], "broken", 7, false]) {
  cases.push({ name: `TRPG container ${JSON.stringify(value)}`, trpg: value, expected: emptyTrpg });
}
for (const field of ["stock", "owned", "cleared", "shifts", "club"]) {
  for (const value of [undefined, null, "broken", 7]) {
    cases.push({ name: `${field} ${JSON.stringify(value)}`, trpg: { [field]: value }, expected: emptyTrpg });
  }
}
cases.push({ name: "mixed book IDs, no inferred ownership or clears", trpg: {
  stock: ["ordinary-cup", "ordinary-cup", "", null, 7, false, {}],
  owned: ["sweet-smoke", "sweet-smoke", "", null, 7, {}],
}, expected: { ...emptyTrpg, stock: ["ordinary-cup"], owned: ["sweet-smoke"] } });
const invalidClears = [null, false, "broken", {},
  ...["ending", "chapter", "day", "gm", "participants"].map(field => {
    const value = { ...validClear }; delete value[field]; return value;
  }),
  { ...validClear, ending: 7 }, { ...validClear, chapter: 1 },
  { ...validClear, chapter: "2" }, { ...validClear, chapter: 2.5 },
  { ...validClear, day: 0 }, { ...validClear, day: -1 },
  { ...validClear, day: "3" }, { ...validClear, day: 3.5 },
  { ...validClear, gm: false }, { ...validClear, participants: "hiyori" }];
cases.push({ name: "invalid clears discarded beside a valid ending", trpg: {
  owned: ["ordinary-cup", "sweet-smoke"],
  cleared: { "ordinary-cup": validClear, ...Object.fromEntries(invalidClears.map((v, i) => [`invalid-${i}`, v])) },
}, expected: { ...emptyTrpg, owned: ["ordinary-cup", "sweet-smoke"], cleared: { "ordinary-cup": validClear } } });
const invalidShifts = [null, false, "broken", {},
  ...["id", "chapter", "day", "slot", "busy"].map(field => {
    const value = { ...validShift }; delete value[field]; return value;
  }),
  { ...validShift, id: 7 }, { ...validShift, chapter: "2" }, { ...validShift, chapter: 2.5 },
  { ...validShift, day: "4" }, { ...validShift, day: 4.5 },
  { ...validShift, slot: -1 }, { ...validShift, slot: 2 }, { ...validShift, slot: "0" },
  { ...validShift, busy: 0 }];
const nightShift = { ...validShift, id: "samechan", slot: 1, busy: true };
cases.push({ name: "invalid shifts discarded, both valid slots kept", trpg: {
  shifts: [validShift, ...invalidShifts, nightShift],
}, expected: { ...emptyTrpg, shifts: [validShift, nightShift] } });
for (const value of [undefined, null, "broken", {}, { chapter: 1, day: 3 },
  { chapter: "2", day: 3 }, { chapter: 2, day: 0 }, { chapter: 2, day: 3.5 }]) {
  cases.push({ name: `no valid founding ${JSON.stringify(value)}`, trpg: {
    owned: ["ordinary-cup"], cleared: { "ordinary-cup": validClear },
    club: { founded: value, members: { hiyori: { chapter: 2, day: 4 } } },
  }, expected: { ...emptyTrpg, owned: ["ordinary-cup"], cleared: { "ordinary-cup": validClear } } });
}
cases.push({ name: "membership before founding rejected, same day/later chapter retained", trpg: {
  club: { founded, members: {
    hiyori: { chapter: 2, day: 3 }, samechan: { chapter: 3, day: 1 },
    rin: { chapter: 2, day: 2 }, ageha: { chapter: 1, day: 99 },
    tsumugi: { chapter: "2", day: 4 }, minto: { chapter: 2, day: 0 }, adam: null,
  } },
}, expected: { ...emptyTrpg, club: { founded, members: {
  hiyori: { chapter: 2, day: 3 }, samechan: { chapter: 3, day: 1 },
} } } });
for (const value of [undefined, null, [], "broken", 7]) {
  cases.push({ name: `invalid members ${JSON.stringify(value)}`, trpg: { club: { founded, members: value } },
    expected: { ...emptyTrpg, club: { founded, members: {} } } });
}
for (const fixture of cases) {
  for (const key of [core.SAVE_KEY, "suien_remake_slot1"]) {
    const source = copy(core.newState());
    Object.assign(source, { schema: 14, chapter: 2, day: 5, slot: 1, money: 12345, trpg: fixture.trpg,
      lovers: ["hiyori"], affinity: { hiyori: 66 }, story: { hiyori: 2 },
      romance: { hiyori: 1 }, romanceChoices: { answered: { char: "hiyori", value: 1 } },
      relationshipMemories: ["actually-read"], flags: { _test_read: true } });
    const relationKeys = ["lovers", "affinity", "story", "romance", "romanceChoices", "relationshipMemories", "flags"];
    const relationships = Object.fromEntries(relationKeys.map(k => [k, copy(source[k])]));
    relationships.flags._dense_pack_legacy = true; // schema25以前の詰め方を保持。
    relationships.flags._axe_bar_legacy_access = true; // schema14のBAR互換許可。既読・関係のassertは維持。
    relationships.flags._sumi_double_apple_received = true; // schema19より前は冒頭の葉を受取済み。
    storage.clear();
    const serialized = JSON.stringify(source);
    storage.set(key, serialized);
    const result = copy(key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key));
    const label = `${fixture.name} / ${key}`;
    assert.deepEqual(result.trpg, fixture.expected, label);
    assert.equal(result.schema, core.SCHEMA, label);
    assert.equal(result.money, 12345, label);
    assert.deepEqual([result.chapter, result.day, result.slot], [2, 5, 1], label);
    assert.deepEqual(Object.fromEntries(relationKeys.map(k => [k, result[k]])), relationships, label);
    assert.equal(storage.get(key), serialized, `${label}: source save remains intact`);
    if (key !== core.SAVE_KEY) {
      assert.deepEqual(copy(core.load()), result, `${label}: resumed auto-save keeps normalized progress`);
    }
  }
}
console.log(`PASS: ${cases.length} malformed TRPG fixtures via auto/manual load; valid records, money and relationships preserved`);
