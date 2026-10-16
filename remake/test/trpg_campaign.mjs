import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const module = async path => import("data:text/javascript;base64," + Buffer.from(await readFile(new URL(path, import.meta.url), "utf8")).toString("base64"));
const rules = await module("../js/trpg/campaign.js");
const { scheduleChapterTwoTrpgNight } = await module("../js/chapters/ch2-progress.js");
const { CH2_NIGHTS } = await module("../js/chapters/ch2-story-data.js");
const { TrpgSession } = await module("../js/trpg/session.js");
const catalog = await json("../../data/trpg_catalog.json");
const club = await json("../../data/dialogue/trpg_club.json");
const ordinary = await json("../../data/dialogue/trpg_ordinary.json");
const shark = await json("../../data/dialogue/trpg_shark.json");
function state() {
  return { chapter: 2, phase: "daily", day: 3, slot: 1, money: 3000, lovers: [], affinity: {}, met: {}, flags: {},
    trpg: { ...rules.emptyTrpgProgress(), shifts: [] } };
}
function friends(s, ids = catalog.participants.map(p => p.id)) {
  rules.foundTrpgClub(s, catalog);
  for (const id of ids) { s.met[id] = true; s.affinity[id] = 66; rules.joinTrpgClub(s, catalog, id); }
  return s;
}
function own(s, id) { rules.syncTrpgStock(s, catalog); assert(rules.buyTrpgBook(s, catalog, id)); return s; }
function finish(scenario) {
  const session = new TrpgSession(scenario, { seed: 2 });
  session.start(); session.beginCheck("listen"); session.settleCheck();
  for (const spot of scenario.spots.slice(0, 3)) session.inspect(spot.id);
  session.interpret(scenario.hypotheses[0].id);
  for (const phase of ["prepare", "serve"]) {
    for (const field of session.flow[phase]) session.plan(field, scenario.options[field][0].id);
    session.beginCheck(phase); session.settleCheck();
  }
  return session.result();
}

test("chapter two DAY8 is a playable shark night with only the approved individual shift", () => {
  const s = own(friends(state()), shark.id); s.day = 22;
  const before = structuredClone(s), originalCatalog = structuredClone(catalog);
  assert(!rules.castTrpgTable(s, catalog, shark).ok, "The ordinary weekly shift is busy on elapsed day 22");
  assert(scheduleChapterTwoTrpgNight(s, 15));
  assert.deepEqual(s.trpg.shifts, [{ id: "samechan", chapter: 2, day: 22, slot: 1, busy: false }]);
  const cast = rules.castTrpgTable(s, catalog, shark);
  assert(cast.ok); assert.equal(cast.gm, "samechan");
  assert(!CH2_NIGHTS.some(night => night.day === 8), "The exception must not compete with a mandatory story night");
  const once = structuredClone(s);
  assert(!scheduleChapterTwoTrpgNight(s, 15)); assert.deepEqual(s, once);
  for (const [key, value] of Object.entries(before)) {
    if (key !== "trpg") assert.deepEqual(s[key], value, key);
  }
  assert.deepEqual({ ...s.trpg, shifts: [] }, before.trpg);
  for (let localDay = 2; localDay <= 13; localDay++) {
    s.day = 15 + localDay - 1;
    const ready = rules.castTrpgTable(s, catalog, shark, { nightBusy: CH2_NIGHTS.some(night => night.day === localDay) });
    assert.equal(ready.ok, localDay === 8, `Unexpected normal-calendar shark availability on DAY${localDay}`);
  }
  assert.deepEqual(catalog, originalCatalog, "Weekly schedules must stay unchanged");
});

test("the DAY8 exception preserves explicit appointments and does not admit unknown or unrecruited people", () => {
  const s = own(friends(state()), shark.id); s.day = 22;
  s.trpg.shifts = [{ id: "samechan", chapter: 2, day: 22, slot: 1, busy: true, reason: "既存の予定" }];
  const before = structuredClone(s);
  assert(!scheduleChapterTwoTrpgNight(s, 15)); assert.deepEqual(s, before);
  assert(!rules.castTrpgTable(s, catalog, shark).ok);
  s.trpg.shifts = []; assert(scheduleChapterTwoTrpgNight(s, 15));
  s.pendingInvite = { sender: "samechan", day: 22, slot: 1 };
  assert(!rules.castTrpgTable(s, catalog, shark).ok);
  s.pendingInvite = null;
  assert(!rules.castTrpgTable(s, catalog, shark, { nightBusy: true }).ok);
  s.slot = 0; assert(!rules.castTrpgTable(s, catalog, shark).ok); s.slot = 1;
  delete s.trpg.club.members.samechan; assert(!rules.castTrpgTable(s, catalog, shark).ok);
  s.trpg.club.members.samechan = { chapter: 2, day: 15 };
  delete s.met.samechan; assert(!rules.castTrpgTable(s, catalog, shark).ok);
  for (const changes of [{ chapter: 1 }, { day: 23 }]) {
    const other = { ...structuredClone(before), ...changes, trpg: { ...structuredClone(before.trpg), shifts: [] } };
    const untouched = structuredClone(other);
    assert(!scheduleChapterTwoTrpgNight(other, 15)); assert.deepEqual(other, untouched);
  }
  const oldSave = friends(state()); oldSave.day = 22; delete oldSave.trpg.shifts;
  assert(scheduleChapterTwoTrpgNight(oldSave, 15)); assert.equal(oldSave.trpg.shifts.length, 1);
});

test("chapter one cannot stock, buy or call a table", () => {
  const s = friends(state()); s.chapter = 1;
  const before = structuredClone(s);
  assert(!rules.syncTrpgStock(s, catalog));
  assert(!rules.buyTrpgBook(s, catalog, ordinary.id));
  assert(!rules.castTrpgTable(s, catalog, ordinary).ok);
  assert.deepEqual(s, before);
});
test("MAX is recruitment eligibility, never automatic membership or stocking", () => {
  const s = state(); s.met.hiyori = true; s.affinity.hiyori = 66;
  assert(!rules.joinTrpgClub(s, catalog, "hiyori"));
  assert(rules.foundTrpgClub(s, catalog)); assert(!rules.foundTrpgClub(s, catalog));
  assert(rules.recruitmentStatus(s, catalog.participants[0], catalog).ok);
  assert(!rules.participantStatus(s, catalog.participants[0]).ok);
  assert(!rules.syncTrpgStock(s, catalog)); assert.deepEqual(s.trpg.stock, []);
  assert(rules.joinTrpgClub(s, catalog, "hiyori")); assert(!rules.joinTrpgClub(s, catalog, "hiyori"));
  assert(rules.syncTrpgStock(s, catalog)); assert.deepEqual(s.trpg.stock, [ordinary.id]);
  s.met.samechan = true; s.affinity.samechan = 66;
  assert(!rules.syncTrpgStock(s, catalog));
  assert(rules.joinTrpgClub(s, catalog, "samechan")); assert(rules.syncTrpgStock(s, catalog));
  assert.deepEqual(s.trpg.stock, [ordinary.id, shark.id]);
});
test("known MAX friends or lovers may join; work does not prevent face-to-face recruitment", () => {
  const s = state(); rules.foundTrpgClub(s, catalog);
  s.met.hiyori = true; s.affinity.hiyori = 65;
  assert(!rules.joinTrpgClub(s, catalog, "hiyori"));
  s.lovers = ["hiyori"]; s.loveLevel = { hiyori: 1 };
  assert(rules.joinTrpgClub(s, catalog, "hiyori"));
  s.met.adam = true; s.affinity.adam = 66; // His shop is working tonight.
  assert(rules.joinTrpgClub(s, catalog, "adam"));
  assert(!rules.participantStatus(s, catalog.participants.find(p => p.id === "adam")).ok);
  const before = structuredClone(s);
  for (const id of ["sumi", "naru", "unknown"]) assert(!rules.joinTrpgClub(s, catalog, id));
  const uninterested = structuredClone(catalog); uninterested.participants[2].interested = false;
  s.met.tsumugi = true; s.affinity.tsumugi = 66;
  assert(!rules.joinTrpgClub(s, uninterested, "tsumugi"));
  assert.deepEqual(s.trpg, before.trpg);
  assert.equal(s.money, before.money); assert.equal(s.slot, before.slot);
});
test("buy once, charge once, preserve the clock, and keep purchased books when shifts change", () => {
  const s = friends(state()); rules.syncTrpgStock(s, catalog);
  const clock = [s.day, s.slot];
  assert(rules.buyTrpgBook(s, catalog, shark.id));
  assert.equal(s.money, 2200); assert(!rules.buyTrpgBook(s, catalog, shark.id));
  s.day = 4; rules.syncTrpgStock(s, catalog);
  assert(s.trpg.owned.includes(shark.id)); assert.equal(s.slot, clock[1]);
  const poor = friends(state()); poor.money = 499; rules.syncTrpgStock(poor, catalog);
  assert(!rules.buyTrpgBook(poor, catalog, ordinary.id)); assert.equal(poor.money, 499);
});
test("work, explicit shift overrides, temporary closure and existing appointments affect participants", () => {
  const s = friends(state()); s.day = 4;
  const sharkPerson = catalog.participants.find(p => p.id === "samechan");
  assert(!rules.participantStatus(s, sharkPerson).ok);
  s.flags._temporary_closed_samechan = "2:4";
  assert(rules.participantStatus(s, sharkPerson).ok);
  s.trpg.shifts = [{ id: "samechan", chapter: 2, day: 4, slot: 1, busy: true }];
  assert(!rules.participantStatus(s, sharkPerson).ok);
  s.day = 3; assert(rules.participantStatus(s, sharkPerson).ok);
  s.pendingInvite = { sender: "samechan", day: 3, slot: 1 };
  assert(!rules.participantStatus(s, sharkPerson).ok);
});
test("noon, story nights, pending appointments and non-daily phases cannot start a table", () => {
  const s = own(friends(state()), ordinary.id);
  s.slot = 0; assert(!rules.castTrpgTable(s, catalog, ordinary).ok);
  s.slot = 1; assert(!rules.castTrpgTable(s, catalog, ordinary, { nightBusy: true }).ok);
  s.pendingInvite = { sender: "tsumugi", day: 3, slot: 1, afterClose: true };
  assert(!rules.castTrpgTable(s, catalog, ordinary).ok);
  s.pendingInvite.day = 4; assert(rules.castTrpgTable(s, catalog, ordinary).ok);
  s.phase = "tournament"; assert(!rules.castTrpgTable(s, catalog, ordinary).ok);
});
test("Sumi/Naru never join; unrecruited companions are not invited", () => {
  const s = own(friends(state(), ["hiyori", "sumi", "naru"]), ordinary.id);
  const result = rules.castTrpgTable(s, catalog, ordinary);
  assert.deepEqual(result.participants, ["hiyori", "hajime"]);
  assert(!rules.participantStatus(s, { id: "sumi", maxAffinity: 66 }).ok);
});
test("a required shark GM cannot be replaced, while Adam fills Hiyori's optional seat with authored lines", () => {
  const s = own(friends(state()), shark.id);
  s.day = 4; assert(!rules.castTrpgTable(s, catalog, shark).ok);
  s.day = 5; s.trpg.shifts.push({ id: "hiyori", chapter: 2, day: 5, slot: 1, busy: true });
  const cast = rules.castTrpgTable(s, catalog, shark);
  assert.deepEqual(cast.participants, ["samechan", "hajime", "adam", "tsumugi"]);
  const table = rules.materializeTrpgCast(shark, cast.assignments);
  assert.equal(table.checks.prepare.helper, "adam"); assert(table.consult.adam);
  const lines = table.dialogues.flatMap(b => b.lines).filter(l => l.speaker === "adam");
  assert(lines.length > 10); assert(lines.some(l => l.text.includes("舞台装置")));
  assert(!table.dialogues.flatMap(b => b.lines).some(l => ["hiyori", "naru", "sumi"].includes(l.speaker)));
});
test("all eligible small/full tables remain finishable, without absent helpers or lines", () => {
  for (const scenario of [ordinary, shark]) for (let day = 1; day <= 7; day++) for (const count of [1, 2, 4]) {
    const ids = [scenario.cast[0].id, "tsumugi", "hiyori", "adam"].slice(0, count);
    const s = own(friends(state(), ids), scenario.id); s.day = day;
    const cast = rules.castTrpgTable(s, catalog, scenario);
    if (!cast.ok) continue;
    const table = rules.materializeTrpgCast(scenario, cast.assignments);
    assert(table.cast.length >= 2);
    assert(table.dialogues.flatMap(b => b.lines).every(l => cast.participants.includes(l.speaker)));
    assert(scenario.endings[finish(table).ending]);
  }
});
test("reading an ending records its cast and advances exactly one action; cancelled/stale results are inert", () => {
  const s = own(friends(state()), ordinary.id);
  const cast = rules.castTrpgTable(s, catalog, ordinary), ticket = { ...cast, chapter: 2, day: 3, slot: 1 };
  const result = finish(rules.materializeTrpgCast(ordinary, cast.assignments));
  const before = structuredClone(s);
  assert(!rules.completeTrpgTable(s, catalog, ordinary, ticket, { cancelled: true })); assert.deepEqual(s, before);
  assert(!rules.completeTrpgTable(s, catalog, ordinary, { ...ticket, day: 2 }, result)); assert.deepEqual(s, before);
  assert(rules.completeTrpgTable(s, catalog, ordinary, ticket, result));
  assert.equal(s.slot, 2); assert.deepEqual(s.trpg.cleared[ordinary.id].participants, cast.participants);
  assert(!rules.completeTrpgTable(s, catalog, ordinary, ticket, result)); assert.equal(s.slot, 2);
  s.day = 5; s.slot = 1; assert(!rules.castTrpgTable(s, catalog, ordinary).ok);
});
test("alternate dialogue, small-table intro and cast have canonical actors and fit the line limits", () => {
  for (const scenario of [ordinary, shark]) for (const block of scenario.dialogues) for (const line of block.lines) {
    for (const text of [line.text, line.smallTableText, ...Object.values(line.variants || {}).map(v => v.text)].filter(Boolean)) {
      assert(!text.includes("\n")); assert([...text].reduce((n, c) => n + (c.codePointAt(0) <= 255 ? .5 : 1), 0) <= 48, text);
    }
    assert(!["sumi", "naru"].includes(line.speaker));
  }
});

test("club copy fits dialogue limits and the catalog explicitly marks interest", () => {
  const lines = [...club.lines, ...club.branches.invite].map(l => l.text);
  for (const p of catalog.participants) {
    assert.equal(typeof p.interested, "boolean"); assert(Number.isInteger(p.maxAffinity));
    if (p.interested) { assert(club.branches[p.id].length >= 2); assert(club.branches[p.id].every(l => l.speaker === p.id)); lines.push(...club.branches[p.id].map(l => l.text)); }
    assert(!["sumi", "naru"].includes(p.id));
  }
  for (const text of lines) {
    assert(!text.includes("\n")); assert([...text].reduce((n, c) => n + (c.codePointAt(0) <= 255 ? .5 : 1), 0) <= 48, text);
  }
});
