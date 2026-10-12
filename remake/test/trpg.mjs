import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../js/trpg/session.js", import.meta.url), "utf8");
const { TrpgSession } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const scenario = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_ordinary.json", import.meta.url), "utf8"));
const characters = JSON.parse(await readFile(new URL("../../data/characters.json", import.meta.url), "utf8"));

function complete({ profileId = "quiet", seed = 1, aroma = "tea", seat = "window", approach = "quiet", supports = true } = {}) {
  const session = new TrpgSession(scenario, { profileId, seed });
  session.start(); session.beginCheck("listen"); session.settleCheck();
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet");
  session.plan("aroma", aroma); session.plan("seat", seat);
  session.beginCheck("prepare", { support: supports }); session.settleCheck();
  session.plan("approach", approach);
  session.beginCheck("serve", { support: supports }); session.settleCheck();
  return session;
}

test("each traveler has clues for every spot; all dialogue references resolve to canonical lines", () => {
  const ids = new Set(scenario.dialogues.map(d => d.dialogue_id));
  assert.equal(ids.size, scenario.dialogues.length);
  const speakers = new Set(characters.map(c => c.id));
  function refs(value) {
    if (typeof value === "string" && value.startsWith("trpg_ordinary_")) assert(ids.has(value), value);
    else if (Array.isArray(value)) value.forEach(refs);
    else if (value && typeof value === "object") Object.values(value).forEach(refs);
  }
  refs(scenario);
  for (const profile of scenario.profiles) {
    for (const spot of scenario.spots) assert(profile.evidence[spot.id]?.title && profile.evidence[spot.id]?.text);
  }
  for (const dialogue of scenario.dialogues) {
    assert(dialogue.lines.length);
    for (const line of dialogue.lines) {
      assert(speakers.has(line.speaker), line.speaker);
      assert(!line.text.includes("\n"));
      assert(Array.from(line.text).reduce((n, c) => n + (c.codePointAt(0) <= 255 ? 0.5 : 1), 0) <= 48, line.text);
    }
  }
});

test("all three matching proposals and a mismatched proposal reach distinct endings", () => {
  assert.equal(complete().result().ending, "rain");
  assert.equal(complete({ profileId: "home", aroma: "tea", seat: "shelf", approach: "memory" }).result().ending, "home");
  assert.equal(complete({ profileId: "company", aroma: "fruit", seat: "counter", approach: "company" }).result().ending, "company");
  assert.equal(complete({ profileId: "quiet", aroma: "spice", seat: "counter", approach: "company" }).result().ending, "discovery");
});

test("all choices, including low rolls without help, remain finishable", () => {
  const seen = new Set();
  const grades = new Set();
  let seed = 1;
  for (const profile of scenario.profiles) for (const aroma of scenario.options.aroma) {
    for (const seat of scenario.options.seat) for (const approach of scenario.options.approach) {
      const session = complete({ profileId: profile.id, aroma: aroma.id, seat: seat.id, approach: approach.id,
        seed: seed++, supports: false });
      const result = session.result();
      assert.equal(result.checks.length, 3);
      assert(result.checks.every(c => c.dice.every(d => d >= 1 && d <= 6)));
      assert(result.pressure >= 0 && result.pressure <= 3);
      assert(scenario.endings[result.ending]);
      result.checks.forEach(check => grades.add(check.grade));
      seen.add(result.ending);
    }
  }
  assert.equal(seen.size, 4);
  assert.deepEqual([...grades].sort(), ["mixed", "success", "trouble"]);
});

test("rerolls are shared across checks and take the new die; aids are spent once", () => {
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 9 });
  session.start(); const first = session.beginCheck("listen");
  const next = session.reroll(0);
  assert.equal(next.dice[1], first.dice[1]);
  assert(session.snapshot().used.hajime);
  assert.throws(() => session.reroll(1));
  session.settleCheck();
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); session.plan("aroma", "tea"); session.plan("seat", "window");
  const preparation = session.beginCheck("prepare", { support: true });
  assert.equal(preparation.bonus, 3);
  assert(session.snapshot().used.naru);
  assert.throws(() => session.reroll(0));
});

test("invalid phase, double submission and unknown choices cannot advance or consume randomness", () => {
  const session = new TrpgSession(scenario, { seed: 100 });
  const before = session.snapshot();
  assert.throws(() => session.beginCheck("serve"));
  assert.throws(() => session.inspect("bag"));
  assert.deepEqual(session.snapshot(), before);
  session.start(); session.beginCheck("listen");
  const pending = session.snapshot();
  assert.throws(() => session.beginCheck("listen"));
  assert.throws(() => session.reroll(2));
  assert.deepEqual(session.snapshot(), pending);
  session.settleCheck();
  assert.throws(() => session.settleCheck());
  assert.throws(() => session.interpret("quiet"));
  assert.throws(() => session.inspect("not-a-spot"));
  session.inspect("menu"); session.inspect("menu");
  assert.equal(session.snapshot().clues.length, 1);
});

test("snapshots and results are detached; equal seeds and decisions are reproducible", () => {
  const a = complete({ seed: 123 }), b = complete({ seed: 123 });
  assert.deepEqual(a.snapshot(), b.snapshot());
  const result = a.result(); result.plan.aroma = "changed"; result.checks[0].dice[0] = 99;
  assert.deepEqual(a.result(), b.result());
  const snap = a.snapshot(); snap.clues.length = 0;
  assert.equal(a.snapshot().clues.length, 3);
});

test("the three individual trumps compete for two shared teamwork cards", () => {
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 12 });
  session.start(); session.beginCheck("listen"); session.reroll(0); session.settleCheck();
  assert.equal(session.snapshot().teamwork, 1);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); session.plan("aroma", "tea"); session.plan("seat", "window");
  session.beginCheck("prepare", { support: true }); session.settleCheck();
  assert.equal(session.snapshot().teamwork, 0);
  session.plan("approach", "quiet");
  const before = session.snapshot();
  assert.throws(() => session.beginCheck("serve", { support: true }));
  assert.deepEqual(session.snapshot(), before);
  session.beginCheck("serve"); session.settleCheck();
  assert.equal(session.result().ending, "rain");
});
