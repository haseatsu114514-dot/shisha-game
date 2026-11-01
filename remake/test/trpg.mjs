import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../js/trpg/session.js", import.meta.url), "utf8");
const { TrpgSession, specialOf, HEAT, heatTier } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const scenario = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_ordinary.json", import.meta.url), "utf8"));
const shark = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_shark.json", import.meta.url), "utf8"));
const catalogScenarios = [scenario, shark];
const characters = JSON.parse(await readFile(new URL("../../data/characters.json", import.meta.url), "utf8"));
const catalog = JSON.parse(await readFile(new URL("../../data/trpg_catalog.json", import.meta.url), "utf8"));
const overlays = await Promise.all(catalog.characterProfiles.map(async file =>
  JSON.parse(await readFile(new URL("../../data/" + file, import.meta.url), "utf8"))));
characters.push(...overlays.map(o => o.profile));

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
 for (const scenario of catalogScenarios) {
  const ids = new Set(scenario.dialogues.map(d => d.dialogue_id));
  assert.equal(ids.size, scenario.dialogues.length);
  const speakers = new Set(characters.map(c => c.id));
  function refs(value) {
    if (typeof value === "string" && /^trpg_(ordinary|shark)_/.test(value)) assert(ids.has(value), value);
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
      assert(result.checks.every(c => c.dice.every(d => d >= 1 && d <= 20)));
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
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 5 });
  session.start(); const first = session.beginCheck("listen");
  const next = session.reroll(0);
  assert.equal(next.dice[1], first.dice[1]);
  assert(session.snapshot().used.hajime);
  assert.throws(() => session.reroll(1));
  session.settleCheck();
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); session.plan("aroma", "tea"); session.plan("seat", "window");
  const preparation = session.beginCheck("prepare", { support: true });
  // Reroll, the listen result and the hypothesis talk lift the table to the first tier: momentum +1.
  assert.equal(preparation.momentum, 1);
  // The default approach is the player's own character: the sheet stat replaces the old flat +3.
  assert.equal(preparation.base, scenario.cast.find(c => c.id === "hajime").sheet.stats.hand);
  assert.equal(preparation.bonus, preparation.base + 7 + preparation.momentum * 4);
  assert(session.snapshot().used.adam);
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

function sharkRun({ profileId = "scent", seed = 4, choices = null, hypothesis = profileId, count = 3 } = {}) {
  const session = new TrpgSession(shark, { profileId, seed });
  session.start(); session.beginCheck("listen"); session.settleCheck();
  for (const spot of shark.spots.slice(0, count)) session.inspect(spot.id);
  session.interpret(hypothesis);
  const plan = choices || Object.fromEntries(Object.entries(session.profile.likes).map(([field, values]) => [field, values[0]]));
  for (const field of shark.flow.prepare) session.plan(field, plan[field]);
  session.beginCheck("prepare"); session.settleCheck();
  session.plan("finale", plan.finale); session.beginCheck("serve"); session.settleCheck();
  return session;
}

test("the shark movie offers three planned escapes and a rescue with a sequel", () => {
  assert.equal(sharkRun().result().ending, "last-order");
  assert.equal(sharkRun({ profileId: "vibration" }).result().ending, "quiet-escape");
  assert.equal(sharkRun({ profileId: "light" }).result().ending, "premiere");
  assert.equal(sharkRun({ choices: { tool: "beacon", route: "roof", finale: "silence" } }).result().ending, "sequel");
});

test("limited investigation consumes tide only once; rereading and consulting stay available", () => {
  const s = new TrpgSession(shark, { profileId: "light", seed: 4 });
  s.start(); s.beginCheck("listen"); s.settleCheck();
  const before = s.snapshot().pressure;
  for (const spot of shark.spots.slice(0, 4)) s.inspect(spot.id);
  assert.equal(s.snapshot().pressure, Math.min(6, before + 4));
  const state = s.snapshot();
  s.inspect("radio"); s.consult("hiyori"); s.consult("hiyori");
  assert.equal(s.snapshot().pressure, state.pressure);
  assert.throws(() => s.inspect("rope"), /limit/);
  assert.equal(s.snapshot().clues.length, 4);
  s.interpret("light");
  assert.equal(s.snapshot().phase, "prepare");
});

test("all 243 shark plans finish; both risk variants exist and risk stays bounded", () => {
  const endings = new Set(), variants = new Set(); let seed = 1;
  for (const profile of shark.profiles) for (const tool of shark.options.tool) {
    for (const route of shark.options.route) for (const finale of shark.options.finale) {
      const result = sharkRun({ profileId: profile.id, seed: seed++, choices: { tool: tool.id, route: route.id, finale: finale.id } }).result();
      assert.equal(result.checks.length, 3);
      assert(result.pressure >= 3 && result.pressure <= 6);
      assert(shark.endings[result.ending]);
      assert(result.checks.every(c => c.dice.every(n => n >= 1 && n <= 20)));
      endings.add(result.ending); variants.add(result.variant);
    }
  }
  assert.equal(endings.size, 4);
  assert.deepEqual([...variants].sort(), ["smooth", "with-detour"]);
});

test("a matching shark hypothesis improves preparation, and an unknown plan field is inert", () => {
  const correct = sharkRun(), incorrect = sharkRun({ hypothesis: "light" });
  assert.equal(correct.result().checks[1].bonus, incorrect.result().checks[1].bonus + 4);
  const s = new TrpgSession(shark, { seed: 5 });
  s.start(); s.beginCheck("listen"); s.settleCheck();
  for (const spot of shark.spots.slice(0, 3)) s.inspect(spot.id);
  s.interpret("scent"); const before = s.snapshot();
  assert.throws(() => s.plan("aroma", "citrus"));
  assert.deepEqual(s.snapshot(), before);
});

test("doubles are table events: a critical returns one card up to two, never changing the grade", () => {
  assert.equal(specialOf([20, 20]), "critical"); assert.equal(specialOf([1, 1]), "fumble");
  assert.equal(specialOf([3, 3]), "double"); assert.equal(specialOf([2, 5]), null);
  for (let seed = 1; seed < 400; seed++) {
    const session = new TrpgSession(scenario, { profileId: "quiet", seed });
    session.start();
    session.state.teamwork = 1;
    const rolled = session.beginCheck("listen");
    const settled = session.settleCheck();
    assert.equal(settled.grade, rolled.grade);
    assert.equal(settled.special, specialOf(rolled.dice));
    assert.equal(session.snapshot().teamwork, settled.special === "critical" ? 2 : 1);
    assert.equal(!!settled.inspired, settled.special === "critical");
  }
  const full = new TrpgSession(scenario, { profileId: "quiet", seed: 1 });
  full.start();
  full.state.pending = { kind: "listen", dice: [20, 20], bonus: 1, hypothesisBonus: 0, helper: null, rerolled: false };
  const capped = full.settleCheck();
  assert.equal(capped.special, "critical"); assert.equal(capped.inspired, false); assert.equal(full.snapshot().teamwork, 2);
});

test("the three-star rating reads the hypothesis, the true ending and two successful checks", () => {
  const best = complete();
  const rating = best.result().rating;
  assert.equal(rating.marks.insight, true); assert.equal(rating.marks.plan, true);
  assert.equal(rating.marks.dice, best.snapshot().checks.filter(c => c.grade === "success").length >= 2);
  assert.equal(rating.stars, Object.values(rating.marks).filter(Boolean).length);
  const wrong = complete({ profileId: "home", aroma: "spice", seat: "window", approach: "quiet" }).result().rating;
  assert.equal(wrong.marks.insight, false); assert.equal(wrong.marks.plan, false);
  assert(["にぎやかな卓", "よい卓", "名卓", "伝説の卓"].includes(wrong.title));
});

test("table chatter files only use the GM seats and the required player", async () => {
  const talk = JSON.parse(await readFile(new URL("../../data/" + catalog.tableTalk, import.meta.url), "utf8"));
  const gms = new Set(catalogScenarios.map(s => s.cast.find(c => c.part === "GM").id));
  for (const gm of gms) for (const kind of ["critical", "critical_full", "fumble", "double", "heat_up", "heat_max"]) {
    const block = talk.dialogues.find(d => d.dialogue_id === "trpg_talk_" + gm + "_" + kind);
    assert(block?.lines.length, gm + kind);
    for (const line of block.lines) {
      assert([gm, "hajime"].includes(line.speaker));
      assert(Array.from(line.text).reduce((n, c) => n + (c.codePointAt(0) <= 255 ? 0.5 : 1), 0) <= 48, line.text);
    }
  }
});

test("table excitement rises with shared moments, tiers give the next roll one momentum (bonus +4) and the night gets a name", () => {
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 3 });
  session.start();
  const start = session.snapshot();
  assert.equal(start.heat, 0); assert.equal(start.momentum, 0);
  session.state.pending = { kind: "listen", dice: [20, 20], bonus: 1, hypothesisBonus: 0, momentum: 0, helper: null, rerolled: false };
  session.settleCheck();
  assert.equal(session.snapshot().heat, 3, "a critical lifts the table three");
  assert.equal(session.snapshot().momentum, 1, "reaching the first tier");
  session.consult("adam"); session.consult("adam");
  assert.equal(session.snapshot().heat, 4, "only the first talk with each friend counts");
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); session.plan("aroma", "tea"); session.plan("seat", "window");
  const before = session.snapshot().momentum;
  const check = session.beginCheck("prepare");
  assert.equal(check.momentum, before); assert.equal(check.bonus, check.base + before * 4);
  assert.equal(session.snapshot().momentum, 0, "momentum is spent on the roll");
  session.state.heat = HEAT.max - 1; session.cheer(5, "test");
  assert.equal(session.snapshot().heat, HEAT.max);
  assert(session.snapshot().momentum <= HEAT.momentumMax);
  assert.deepEqual([0, 3, 6, 8].map(heatTier), [0, 1, 2, 3]);
  const done = complete();
  assert.equal(done.result().heat.night, HEAT.nights[heatTier(done.snapshot().heat)]);
});


test("declared approaches roll with the PC's sheet stat; a companion's first turn is a table moment", () => {
  for (const s of catalogScenarios) {
    const gm = s.cast.find(c => c.part === "GM").id;
    const sheets = Object.fromEntries(s.cast.filter(c => c.sheet).map(c => [c.id, c.sheet]));
    assert.equal(Object.keys(sheets).length, 3);
    for (const sheet of Object.values(sheets)) {
      assert(sheet.name && sheet.title);
      for (const stat of ["eye", "hand", "talk", "nerve"]) assert(Number.isInteger(sheet.stats[stat]) && sheet.stats[stat] >= 1 && sheet.stats[stat] <= 5);
    }
    for (const kind of ["listen", "prepare", "serve"]) {
      const approaches = s.checks[kind].approaches;
      assert.equal(approaches.length, 3);
      assert.equal(approaches[0].actor, "hajime", "the player's own character leads the list");
      assert.equal(new Set(approaches.map(a => a.actor)).size, 3, "every PC can act in each scene");
      for (const a of approaches) {
        assert(Number.isInteger(sheets[a.sheet || a.actor].stats[a.stat]), a.id);
        const block = s.dialogues.find(d => d.dialogue_id === a.declare);
        assert(block, a.declare);
        assert(block.lines.some(l => l.speaker === gm), "the GM calls the roll");
        assert(block.lines.some(l => l.speaker === a.actor), "the acting player declares");
      }
    }
  }
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 7 });
  session.start();
  assert.throws(() => session.beginCheck("listen", { approach: "nope" }));
  const first = session.beginCheck("listen", { approach: "listen_watch" });
  assert.equal(first.actor, "tsumugi"); assert.equal(first.stat, "eye"); assert.equal(first.base, 5); assert.equal(first.bonus, 5);
  assert.equal(session.snapshot().heat, 1, "a companion stepping forward lifts the table once");
  assert.deepEqual(session.snapshot().acted, { tsumugi: 1 });
  session.settleCheck();
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); session.plan("aroma", "tea"); session.plan("seat", "window");
  const heatBefore = session.snapshot().heat;
  const second = session.beginCheck("prepare", { approach: "prepare_light" });
  assert.equal(second.base, 5); assert.equal(session.snapshot().heat, heatBefore, "the same companion earns no second spotlight");
  session.settleCheck(); session.plan("approach", "quiet");
  const own = session.beginCheck("serve");
  assert.equal(own.actor, "hajime"); assert.equal(own.base, 4, "the default approach is the player's own character");
  assert.equal(session.snapshot().heat, heatBefore, "the player's own turn is not a spotlight");
  session.settleCheck();
  assert.deepEqual(session.result().checks.map(c => c.approach), ["listen_watch", "prepare_light", "serve_word"]);
  assert.deepEqual(session.result().acted, { tsumugi: 2, hajime: 1 });
});
