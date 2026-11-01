// DJ を本編から開く部品（DJS10）: 結果の検査・記録・セット解放・東京の地図の行き先・SBD39 の火種・セーブ往復。
import assert from "node:assert/strict";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const dj = await import("../js/minigames/dj.js");
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const { chapterThreeMapModel } = await import("../js/chapters/ch3-map-model.js");
let groups = 0; const check = (name, fn) => { fn(); groups++; console.log("PASS " + name); };
const msg = (set, rank, total, floor = 80) => ({ type: "dj-result", set, rank, total, floor });

check("sets mirror the preview's SET list; ranks S > A > B > C", () => {
  assert.deepEqual(dj.DJ_SETS.map(s => [s.id, s.name]), [[1, "SET 1"], [2, "SET 2"], [3, "SET 3"]]);
  assert.deepEqual(dj.DJ_SETS.map(s => s.tracks), [3, 4, 4]);
  assert.deepEqual(dj.DJ_RANKS, ["C", "B", "A", "S"]);
});
check("readDjResult accepts only well-formed results for the requested set", () => {
  assert.deepEqual(dj.readDjResult(msg(1, "A", 82.4, 99.6)), { set: 1, rank: "A", total: 82, floor: 100 });
  for (const bad of [null, [], "x", { ...msg(1, "A", 80), type: "dj-exit" }, msg(4, "A", 80), msg(0, "A", 80), msg(1, "SS", 80), msg(1, "D", 80),
    msg(1, "A", 101), msg(1, "A", -1), msg(1, "A", NaN), msg(1, "A", 80, 120), msg(1, "A", "80")]) assert.equal(dj.readDjResult(bad), null, JSON.stringify(bad));
  assert.equal(dj.readDjResult(msg(2, "A", 80), 1), null, "a result for another set is ignored");
  const checked = dj.readDjResult(msg(1, "B", 61)); assert.deepEqual(dj.readDjResult(checked), checked, "an already checked result (what onResult receives) stays valid");
  const s = {}; assert.ok(dj.recordDjResult(s, checked)); assert.equal(s.dj.sets[1].best.total, 61, "runDjSet → onResult → recordDjResult path");
  assert.ok(dj.readDjResult(msg(2, "A", 80), 2));
});
check("records: plays count up, best by points, bestRank over all sets, rankUp only when it rises", () => {
  const s = { chapter: 3, day: 12, money: 5000, stamina: 40, slot: 1, flags: {} };
  const before = JSON.stringify({ money: s.money, stamina: s.stamina, day: s.day, slot: s.slot, flags: s.flags });
  let r = dj.recordDjResult(s, msg(1, "B", 70));
  assert.ok(r.newBest && r.rankUp); assert.deepEqual(s.dj.sets[1], { plays: 1, best: { rank: "B", total: 70, floor: 80, chapter: 3, day: 12 } }); assert.equal(s.dj.bestRank, "B");
  r = dj.recordDjResult(s, msg(1, "C", 40));
  assert.ok(!r.newBest && !r.rankUp); assert.equal(s.dj.sets[1].plays, 2); assert.equal(s.dj.sets[1].best.total, 70); assert.equal(s.dj.bestRank, "B");
  s.day = 13; r = dj.recordDjResult(s, msg(2, "A", 81));
  assert.ok(r.newBest && r.rankUp); assert.equal(s.dj.bestRank, "A"); assert.equal(s.dj.sets[2].best.day, 13);
  r = dj.recordDjResult(s, msg(1, "A", 88));
  assert.ok(r.newBest && !r.rankUp, "same best rank is not a rank up");
  assert.equal(dj.recordDjResult(s, msg(1, "S", 120)), null); assert.equal(s.dj.sets[1].plays, 3, "a malformed result is not counted");
  assert.equal(JSON.stringify({ money: s.money, stamina: s.stamina, day: 13, slot: s.slot, flags: s.flags }), before.replace('"day":12', '"day":13'), "no money, stamina, slot or flags change");
});
check("djRecords tolerates missing and broken saves without changing them", () => {
  assert.deepEqual(dj.djRecords({}).bestRank, null); assert.deepEqual(dj.djRecords(null).sets[1], { plays: 0, best: null });
  const broken = { dj: { sets: { 1: { plays: -3, best: { rank: "Z", total: 50 } }, 2: "x", 3: { plays: 2, best: { rank: "S", total: 95, floor: "loud" } } }, bestRank: "S" } };
  const copy = JSON.stringify(broken); const read = dj.djRecords(broken);
  assert.deepEqual(read.sets[1], { plays: 0, best: null }); assert.deepEqual(read.sets[2], { plays: 0, best: null });
  assert.deepEqual(read.sets[3].best, { rank: "S", total: 95, floor: 0, chapter: null, day: null }); assert.equal(read.bestRank, "S");
  assert.equal(JSON.stringify(broken), copy);
});
check("SET 1 is always open; SET 2 / 3 open after the previous set is played through once", () => {
  const s = {};
  assert.deepEqual([1, 2, 3, 4].map(id => dj.djSetOpen(s, id)), [true, false, false, false]);
  dj.recordDjResult(s, msg(1, "C", 30));
  assert.deepEqual([1, 2, 3].map(id => dj.djSetOpen(s, id)), [true, true, false]);
  dj.recordDjResult(s, msg(2, "C", 20));
  assert.deepEqual([1, 2, 3].map(id => dj.djSetOpen(s, id)), [true, true, true]);
});
check("the club appears on the Tokyo map only in chapter 3 night free time, unnamed until the first visit, without using the free time", () => {
  const first = dj.djNightChoices({ chapter: 3, flags: {} }, { id: "d5-1", slot: 1 });
  assert.deepEqual(first, [{ ...dj.DJ_NIGHT_FIRST, ok: true, consumes: false, dj: true }]);
  assert.equal(first[0].place, "club"); assert.equal(first[0].placeLabel, "地下の店"); assert.doesNotMatch(first[0].label, /SEAM|クラブ/, "the name is learned at the door");
  const known = dj.djNightChoices({ chapter: 3, flags: { [dj.CLUB_MET_FLAG]: true } }, { id: "d6-1", slot: 1 });
  assert.deepEqual(known, [{ ...dj.DJ_NIGHT, ok: true, consumes: false, dj: true }]); assert.match(known[0].label, /クラブSEAM/);
  assert.deepEqual(dj.djNightChoices({ chapter: 3 }, { id: "d5-0", slot: 0 }), []);
  assert.deepEqual(dj.djNightChoices({ chapter: 3 }, null), []);
  for (const chapter of [1, 2, 4, 5]) assert.deepEqual(dj.djNightChoices({ chapter }, { slot: 1 }), []);
  const value = { chapter: 3, slot: 1, flags: { _ch3_intro: { stage: 1 } } }, scenes = [{ id: "ch3_opening" }, { id: "ch3_kuze_first" }];
  const plain = chapterThreeMapModel(value, scenes, { freeTime: true, actions: [] });
  assert.ok(!plain.pins.some(pin => pin.id === "club")); assert.ok(plain.landmarks.some(item => item.id === "livehouse"), "the drawn live house stays a landmark"); assert.doesNotMatch(plain.note, /DJ/);
  const model = chapterThreeMapModel(value, scenes, { freeTime: true, actions: dj.djNightChoices(value, { slot: 1 }) });
  const pin = model.pins.find(item => item.id === "club");
  assert.ok(pin && pin.actions[0].dj && pin.actions[0].consumes === false); assert.equal(pin.label, "地下の店");
  assert.ok(model.landmarks.some(item => item.id === "livehouse")); assert.match(model.note, /地下の店のDJは予定を進めません/);
  value.flags[dj.CLUB_MET_FLAG] = true;
  assert.equal(chapterThreeMapModel(value, scenes, { freeTime: true, actions: dj.djNightChoices(value, { slot: 1 }) }).pins.find(item => item.id === "club").label, "クラブSEAM");
});
check("the club owner is a venue host with an intro cut-in; the club script names her before her cut-in and has a line per rank", () => {
  const fs = globalThis.process.getBuiltinModule("node:fs");
  const yoru = JSON.parse(fs.readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8")).find(c => c.id === "yoru");
  assert.equal(yoru.role, "venue_host"); assert.equal(yoru.display_name, "針間ヨル"); assert.equal(yoru.affiliation, "クラブSEAM"); assert.ok(yoru.intro_cutin?.title && yoru.intro_cutin.line);
  const script = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_club.json", import.meta.url), "utf8")).dialogues.map(d => [d.dialogue_id, d]));
  for (const id of ["ch3_club_first", "ch3_club_first_after", "ch3_club_a_talk", "venue_yoru_greet", "venue_yoru_return", ...dj.DJ_RANKS.map(rank => `venue_yoru_set_${rank}`)]) assert.ok(script[id]?.lines?.length, id);
  const before = script.ch3_club_first.lines;
  assert.match(before.at(-1).text, /針間ヨル/, "the first part ends with her name; dj-club.js plays her cut-in before the rest");
  assert.ok(!before.slice(0, -1).some(line => /針間|ヨル/.test(line.text || "")), "nobody says her name before she does");
  assert.ok(!JSON.stringify(script).includes("set_flag"), "met and cut-in come from playIntro, not from new literal flags");
  for (const d of Object.values(script)) for (const line of d.lines) if (line.speaker !== undefined) assert.ok(["", "hajime", "yoru"].includes(line.speaker), line.speaker);
  assert.doesNotMatch(JSON.stringify(script), /大会|全国|味覚|恋人/, "no tournament, taste or romance assumptions (no before/after branch needed)");
});
check("SBD39: an A (or S) best gives one sense ember at bedtime, once; B does not", () => {
  const s = { chapter: 3, flags: {}, trpg: { cleared: {} }, kuji: {} };
  const g = growth.newGrowth();
  dj.recordDjResult(s, msg(1, "B", 70));
  assert.deepEqual(growth.claimPlayRewards(g, s), []);
  dj.recordDjResult(s, msg(2, "A", 80));
  const got = growth.claimPlayRewards(g, s);
  assert.equal(got.length, 1); assert.equal(got[0].label, "DJで Aランク"); assert.equal(g.rewards["dj-a"], true);
  assert.deepEqual(growth.claimPlayRewards(g, s), [], "only once");
  const g2 = growth.newGrowth(), s2 = {}; dj.recordDjResult(s2, msg(1, "S", 95)); assert.equal(growth.claimPlayRewards(g2, { ...s2, flags: {}, kuji: {} }).length, 1);
});
check("state.dj survives save and load without a schema change", () => {
  core.setState(core.newState());
  dj.recordDjResult(core.state, msg(1, "A", 84));
  core.save();
  core.setState(core.newState()); assert.equal(core.state.dj, undefined);
  assert.ok(core.load());
  assert.deepEqual(dj.djRecords(core.state).sets[1].best.rank, "A"); assert.equal(core.state.dj.bestRank, "A");
});
check("djUrl passes the set, embed flag and the game's mute / BGM volume", () => {
  const url = new URL(dj.djUrl(2, { muted: true, volume: 1.4 }));
  assert.ok(url.pathname.endsWith("/remake/previews/dj/index.html"));
  assert.deepEqual([url.searchParams.get("set"), url.searchParams.get("embed"), url.searchParams.get("mute"), url.searchParams.get("vol")], ["2", "1", "1", "1"]);
  assert.equal(new URL(dj.djUrl(1)).searchParams.get("mute"), null);
});
console.log(`DJ club: ${groups} groups PASS`);
