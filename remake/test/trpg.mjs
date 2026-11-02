import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../js/trpg/session.js", import.meta.url), "utf8");
const { TrpgSession, specialOf, HEAT, heatTier, checkKindsOf } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

// The scenes a full session adds between the old ones: two questions after the first roll, a twist after the guess.
function interviewDone(s) {
  if (s.snapshot().phase !== "interview") return;
  for (const topic of s.scenario.interview.topics.slice(0, s.scenario.interview.picks || 2)) s.ask(topic.id);
  s.endInterview();
}
function twistDone(s) {
  if (s.snapshot().phase !== "twist") return;
  for (const field of s.flow.twist) s.plan(field, s.scenario.options[field][0].id);
  s.beginCheck("twist"); s.settleCheck();
}

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
  session.start(); session.beginCheck("listen"); session.settleCheck(); interviewDone(session);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session);
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
      assert.equal(result.checks.length, checkKindsOf(scenario).length);
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
  session.settleCheck(); interviewDone(session);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session); session.plan("aroma", "tea"); session.plan("seat", "window");
  const banked = session.snapshot().momentum;
  const preparation = session.beginCheck("prepare", { support: true });
  // Whatever momentum the table banked after the twist roll is spent on this roll, +4 each.
  assert.equal(preparation.momentum, banked);
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
  assert.throws(() => session.inspect("menu"), /phase/, "the interview comes before the room");
  assert.throws(() => session.endInterview(), /at least one/);
  assert.throws(() => session.ask("not-a-topic"));
  interviewDone(session);
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
  session.start(); session.beginCheck("listen"); session.reroll(0); session.settleCheck(); interviewDone(session);
  assert.equal(session.snapshot().teamwork, 1);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session); session.plan("aroma", "tea"); session.plan("seat", "window");
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
  session.start(); session.beginCheck("listen"); session.settleCheck(); interviewDone(session);
  for (const spot of shark.spots.slice(0, count)) session.inspect(spot.id);
  session.interpret(hypothesis); twistDone(session);
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
  s.start(); s.beginCheck("listen"); s.settleCheck(); interviewDone(s);
  const before = s.snapshot().pressure;
  for (const spot of shark.spots.slice(0, 4)) s.inspect(spot.id);
  assert.equal(s.snapshot().pressure, Math.min(6, before + 4));
  const state = s.snapshot();
  s.inspect("radio"); s.consult("hiyori"); s.consult("hiyori");
  assert.equal(s.snapshot().pressure, state.pressure);
  assert.throws(() => s.inspect("rope"), /limit/);
  assert.equal(s.snapshot().clues.length, 4);
  s.interpret("light"); twistDone(s);
  assert.equal(s.snapshot().phase, "prepare");
});

test("all 243 shark plans finish; both risk variants exist and risk stays bounded", () => {
  const endings = new Set(), variants = new Set(); let seed = 1;
  for (const profile of shark.profiles) for (const tool of shark.options.tool) {
    for (const route of shark.options.route) for (const finale of shark.options.finale) {
      const result = sharkRun({ profileId: profile.id, seed: seed++, choices: { tool: tool.id, route: route.id, finale: finale.id } }).result();
      assert.equal(result.checks.length, checkKindsOf(shark).length);
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
  const prep = run => run.result().checks.find(c => c.kind === "prepare");
  assert.equal(prep(correct).bonus, prep(incorrect).bonus + 4);
  const s = new TrpgSession(shark, { seed: 5 });
  s.start(); s.beginCheck("listen"); s.settleCheck(); interviewDone(s);
  for (const spot of shark.spots.slice(0, 3)) s.inspect(spot.id);
  s.interpret("scent"); twistDone(s); const before = s.snapshot();
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
  interviewDone(session);
  assert.equal(session.snapshot().heat, 4, "talking to the story's character lifts the table once");
  session.consult("adam"); session.consult("adam");
  assert.equal(session.snapshot().heat, 5, "only the first talk with each friend counts");
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session); session.plan("aroma", "tea"); session.plan("seat", "window");
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
  session.settleCheck(); interviewDone(session);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session); session.plan("aroma", "tea"); session.plan("seat", "window");
  const heatBefore = session.snapshot().heat;
  const second = session.beginCheck("prepare", { approach: "prepare_light" });
  assert.equal(second.base, 5); assert.equal(session.snapshot().heat, heatBefore, "the same companion earns no second spotlight");
  session.settleCheck(); session.plan("approach", "quiet");
  const heatBeforeServe = session.snapshot().heat;
  const own = session.beginCheck("serve");
  assert.equal(own.actor, "hajime"); assert.equal(own.base, 4, "the default approach is the player's own character");
  assert.equal(session.snapshot().heat, heatBeforeServe, "the player's own turn is not a spotlight");
  session.settleCheck();
  assert.deepEqual(session.result().checks.map(c => c.approach), ["listen_watch", "twist_talk", "prepare_light", "serve_word"]);
  assert.deepEqual(session.result().acted, { tsumugi: 2, hajime: 2 });
});

test("character creation: looks, origin presets, a point-buy and a name replace the player's seat; dialogue names the built character", async () => {
  const { buildPc, randomPc } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  for (const s of catalogScenarios) {
    const b = s.builder;
    assert(b && b.looks.length >= 4 && b.archetypes.length >= 3);
    for (const a of b.archetypes) assert.equal(Object.values(a.stats).reduce((n, v) => n + v, 0), b.points, a.id + " presets spend every point");
    // The authored default on the player's seat equals the first origin, so the untouched table plays as before.
    const seat = s.cast.find(c => c.id === b.seat);
    assert.deepEqual(seat.sheet.stats, b.archetypes[0].stats); assert.equal(seat.sheet.name, b.archetypes[0].name);
    // The player's name never appears hard-coded: every line uses the {pc} token instead.
    assert(!s.dialogues.some(d => d.lines.some(l => l.text.includes(b.archetypes[0].name))), "no raw default name in dialogue");
    assert(s.dialogues.some(d => d.lines.some(l => l.text.includes("{pc}"))));
    for (const check of Object.values(s.checks)) assert(check.approaches.some(a => a.detail.includes("{pc}")));
    const pc = buildPc(s, { look: b.looks[2].id, archetype: b.archetypes[1].id, name: "ソラ" });
    assert.equal(pc.name, "ソラ"); assert.equal(pc.title, b.archetypes[1].title); assert.equal(pc.look, b.looks[2].id);
    assert.deepEqual(pc.stats, b.archetypes[1].stats);
    assert.throws(() => buildPc(s, { look: "nope" })); assert.throws(() => buildPc(s, { archetype: "nope" }));
    assert.throws(() => buildPc(s, { name: "" })); assert.throws(() => buildPc(s, { name: "あいうえおかき" }));
    assert.throws(() => buildPc(s, { stats: { ...b.archetypes[0].stats, eye: b.max + 1 } }));
    assert.throws(() => buildPc(s, { stats: { ...b.archetypes[0].stats, nerve: b.min - 1 } }));
    const full = b.archetypes[0].stats, over = { ...full, [Object.keys(full).find(k => full[k] < b.max)]: full[Object.keys(full).find(k => full[k] < b.max)] + 1 };
    assert.throws(() => buildPc(s, { stats: over }), /points/);
    const spare = { ...full, [Object.keys(full).find(k => full[k] > b.min)]: full[Object.keys(full).find(k => full[k] > b.min)] - 1 };
    assert.equal(buildPc(s, { stats: spare }).points, b.points - 1, "leaving a point unspent is allowed");
    const a = randomPc(s, 42), c = randomPc(s, 42);
    assert.deepEqual(a, c, "a seeded random character is reproducible");
    assert(a.points <= b.points);
  }
  const moved = { eye: 2, hand: 3, talk: 3, nerve: 3 };
  const session = new TrpgSession(scenario, { profileId: "quiet", seed: 7, pc: { look: "rust", archetype: "sailor", name: "ソラ", stats: moved } });
  assert.equal(session.sheets.hajime.name, "ソラ"); assert.deepEqual(session.sheets.hajime.stats, moved);
  assert(scenario.companionBuilds.adam.adam.some(o => o.name === session.sheets.adam.name), "companions bring a character they made");
  assert.deepEqual(session.snapshot().pc, { name: "ソラ", title: "船乗り帰りの手伝い", look: "rust", archetype: "sailor", stats: moved });
  session.start();
  const roll = session.beginCheck("listen", { approach: "listen_talk" });
  assert.equal(roll.base, 3, "the player's own stat drives the roll");
  session.settleCheck(); interviewDone(session);
  for (const id of ["menu", "window", "bag"]) session.inspect(id);
  session.interpret("quiet"); twistDone(session); session.plan("aroma", "tea"); session.plan("seat", "window");
  session.beginCheck("prepare"); session.settleCheck(); session.plan("approach", "quiet");
  session.beginCheck("serve"); session.settleCheck();
  assert.equal(session.result().pc.name, "ソラ");
  assert.throws(() => new TrpgSession(scenario, { seed: 1, pc: { name: "" } }));
});

test("companions make their own characters: seeded variety, likes, own-voice making talk, and tokens for every name", async () => {
  const { pickCompanions } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const ids = new Set(characters.map(c => c.id));
  for (const s of catalogScenarios) {
    const gm = s.cast.find(c => c.part === "GM").id;
    for (const [seat, byPlayer] of Object.entries(s.companionBuilds)) {
      const authored = s.cast.find(c => c.id === seat);
      assert(authored?.sheet, seat);
      assert.equal(byPlayer[seat][0].name, authored.sheet.name, "the first option is the authored default");
      for (const [player, options] of Object.entries(byPlayer)) {
        assert(ids.has(player)); assert(options.length >= 2, "more than one way to build " + seat);
        for (const o of options) {
          assert(o.name && o.title && o.trait && o.likes, o.id);
          assert(Object.values(o.stats).every(v => Number.isInteger(v) && v >= 1 && v <= 5));
          assert(Object.values(o.stats).reduce((n, v) => n + v, 0) <= 11);
          const talk = s.dialogues.find(d => d.dialogue_id === o.making);
          assert(talk?.metadata?.making, o.making);
          assert(talk.lines.some(l => l.speaker === player), "the player announces their own character");
          assert(talk.lines.every(l => [player, gm, "hajime"].includes(l.speaker)));
        }
      }
    }
    // No companion or player character name is hard-coded outside the build options: everything goes through {pc}.
    const names = Object.values(s.companionBuilds).flatMap(p => Object.values(p).flat()).map(o => o.name);
    for (const d of s.dialogues.filter(d => !d.metadata?.making)) for (const l of d.lines) {
      for (const name of names) assert(!l.text.includes(name) && !(l.role || "").includes(name), d.dialogue_id + ": " + l.text);
    }
    for (const check of Object.values(s.checks)) for (const a of check.approaches) for (const name of names) assert(!a.detail.includes(name) && !a.label.includes(name));
    assert(s.sessionZero && s.dialogues.some(d => d.dialogue_id === s.sessionZero.open) && s.dialogues.some(d => d.dialogue_id === s.sessionZero.close));
    // Variety comes from the seed through a separate hash: the dice are unchanged by companion choice.
    const seen = new Set();
    for (let seed = 1; seed <= 40; seed++) seen.add(JSON.stringify(pickCompanions(s, seed)));
    assert(seen.size >= 3, "different nights bring different companion characters");
    const plain = new TrpgSession(s, { seed: 11 }), forced = new TrpgSession(s, { seed: 11, companions: Object.fromEntries(Object.keys(s.companionBuilds).map(seat => [seat, s.companionBuilds[seat][seat][1].id])) });
    plain.start(); forced.start();
    assert.deepEqual(plain.beginCheck("listen").dice, forced.beginCheck("listen").dice);
    for (const seat of Object.keys(s.companionBuilds)) {
      assert.equal(forced.sheets[seat].name, s.companionBuilds[seat][seat][1].name);
      assert.equal(forced.snapshot().companions[seat], s.companionBuilds[seat][seat][1].id);
    }
  }
});

test("the shopkeeper's first-table tutorial explains GM, PL, PC, the sheet, declaring, rolling and failure in short lines", async () => {
  const tutorial = JSON.parse(await readFile(new URL("../../data/" + catalog.tutorial, import.meta.url), "utf8"));
  const panels = new Set(tutorial.lines.map(l => l.panel));
  for (const panel of ["welcome", "table", "sheet", "declare", "roll", "fail", "build"]) assert(panels.has(panel), panel);
  assert(tutorial.lines.every(l => ["sai", "hajime"].includes(l.speaker)));
  const text = tutorial.lines.map(l => l.text).join("");
  for (const word of ["GM", "PL", "PC", "キャラクターシート", "30以上", "おすすめ"]) assert(text.includes(word), word);
  for (const l of tutorial.lines) assert(Array.from(l.text.replace("{gm}", "サメちゃん")).reduce((n, c) => n + (c.codePointAt(0) <= 255 ? 0.5 : 1), 0) <= 48, l.text);
});

test("a full session talks to the story's character, survives a twist and reads about ten minutes of lines", () => {
  for (const s of catalogScenarios) {
    assert(s.interview?.topics.length >= 4 && (s.interview.picks || 2) >= 2);
    for (const p of s.profiles) for (const topic of s.interview.topics) {
      const a = p.answers[topic.id];
      assert(a?.title && a.text && s.dialogues.some(d => d.dialogue_id === a.lines), p.id + "/" + topic.id);
    }
    assert(s.hypotheses.every(h => s.dialogues.some(d => d.dialogue_id === h.discussion)), "every guess is talked over");
    assert(s.flow.twist?.length && s.options[s.flow.twist[0]].length === 3 && s.checks.twist.approaches.length === 3);
    // Interview, twist and the old scenes, in order, with every transition guarded.
    const session = new TrpgSession(s, { seed: 21, profileId: s.profiles[0].id });
    session.start(); session.beginCheck("listen"); session.settleCheck();
    assert.equal(session.snapshot().phase, "interview");
    const [a, b, c] = s.interview.topics;
    session.ask(a.id); session.ask(a.id); session.ask(b.id);
    assert.throws(() => session.ask(c.id), /No more/, "only the allowed number of questions");
    assert.deepEqual(session.snapshot().asked, [a.id, b.id]);
    session.endInterview();
    for (const spot of s.spots.slice(0, 3)) session.inspect(spot.id);
    session.interpret(s.hypotheses[0].id);
    assert.equal(session.snapshot().phase, "twist");
    assert.throws(() => session.beginCheck("twist"), /Complete the plan/);
    assert.throws(() => session.plan(s.flow.prepare[0], s.options[s.flow.prepare[0]][0].id));
    twistDone(session);
    assert.equal(session.snapshot().phase, "prepare");
    // A typical path: session zero, opening, two answers, four clues, the guess, the twist and an ending.
    const by = Object.fromEntries(s.dialogues.map(d => [d.dialogue_id, d.lines.length]));
    const L = id => by[id] || 0, profile = s.profiles[0];
    const zero = L(s.sessionZero.open) + L(s.sessionZero.close) + Object.values(s.companionBuilds).reduce((n, p) => n + L(Object.values(p)[0][0].making), 0);
    const opening = L(s.intro) + L(s.listen) + 1;
    const talk = Object.values(profile.answers).slice(0, 2).reduce((n, a) => n + L(a.lines), 0);
    const clues = s.spots.slice(0, 4).reduce((n, spot) => n + L(profile.evidence[spot.id].lines), 0);
    const declare = ["listen", "twist", "prepare", "serve"].reduce((n, k) => n + L(s.checks[k].approaches[0].declare) + L(s.checks[k].mixed), 0);
    const middle = L(s.hypotheses[0].discussion) + L(s.twist.intro) + L(s.options[s.flow.twist[0]][0].response) + L(s.preparation) + L(s.serving)
      + Object.values(s.consult).reduce((n, id) => n + L(id), 0);
    const ending = L(s.endings[profile.ending].dialogue) + L(Object.values(s.debrief)[0]) + L(s.epilogue);
    const total = zero + opening + talk + clues + declare + middle + ending;
    assert(total >= 95, s.id + " reads only " + total + " lines on a typical path");
  }
});
