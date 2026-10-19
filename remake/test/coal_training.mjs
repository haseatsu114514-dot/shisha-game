// #694: explicit learning, legacy saves, shared tong window and actual before/after heat model.
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k) ?? null };
const core = await import("../js/core/state.js");
const { DB } = await import("../js/core/data.js");
const coal = await import("../js/craft/coals.js");
const { coalJustSeconds, evaluateCoalTiming, phaseOf, summarizeCoalTimings } = await import("../js/craft/heat_logic.js");
const { newSession } = await import("../js/craft/session.js");
const { stepSetup, stepPlace } = await import("../js/craft/steps.js");
const lesson = await import("../js/daily/coal-lesson.js");
const model = await import("../js/craft/conditions.js");
const { temperatureBands } = await import("../js/craft/temperature-model.js");
DB.equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url))).equipment;
DB.equipById = Object.fromEntries(DB.equipment.map(e => [e.id, e]));
DB.flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(DB.flavors.map(f => [f.id, f]));

for (const hearts of [0, 9, 19, 20, 33, 66]) {
  core.newGame(); core.state.affinity.sumi = hearts;
  core.state.flags.ch1_sumi_training = true;
  core.state.owned.push("cube_charcoal"); core.state.equip.charcoal = "cube_charcoal";
  assert.equal(lesson.canStudyCubeCoals(), hearts >= 20);
  for (const mode of ["drill", "tournament", "rehearsal", "tutorial"]) {
    const cs = newSession(mode);
    assert.equal(cs.equip.charcoal, "flat_charcoal");
    assert.equal(cs.place, "triangle"); assert.equal(coal.coalCount(cs), 3);
    assert.deepEqual(cs.coalTypes, Array(3).fill("flat_charcoal"));
    await stepPlace(cs); // No bench / UI needed: the locked step must return immediately.
  }
  core.state.owned = ["silicone_bowl", "lotos_hagal", "flat_charcoal", "cube_charcoal"];
  const cs = newSession("drill"); await stepSetup(cs);
  assert.equal(core.state.equip.charcoal, "cube_charcoal", "Saved equipment was overwritten by the lesson lock");
  assert(core.state.owned.includes("cube_charcoal"));
}
core.newGame(); core.state.affinity.sumi = 20;
const student = core.state;
const result = { id: lesson.COAL_LESSON, visited: [lesson.COAL_LESSON] };
for (const bad of [null, {}, { ...result, cancelled: true }, { ...result, id: "ch1_sumi_training" }, { ...result, visited: [] }]) {
  assert.equal(lesson.completeCoalLesson(student, bad), false);
  assert.equal(coal.hasCoalTraining(student.flags), false);
}
core.save(); core.load();
assert.equal(lesson.completeCoalLesson(student, result), false, "A stale scene granted learning to a loaded save");
assert.equal(lesson.completeCoalLesson(core.state, result), true);
assert.equal(lesson.completeCoalLesson(core.state, result), false, "Rereading granted the lesson again");
core.load(); assert(coal.hasCoalTraining(core.state.flags));
core.state.equip.charcoal = "cube_charcoal";
assert.equal(newSession("drill").equip.charcoal, "cube_charcoal");
assert.equal(newSession("tutorial").equip.charcoal, "flat_charcoal");
assert.deepEqual(coal.availableCoalLayouts(core.state.flags), ["triangle"]);
assert.equal(core.state.flags[coal.COAL_UNLOCK.mixed], undefined);
core.state.flags[coal.COAL_UNLOCK.four] = true;
assert.deepEqual(coal.availableCoalLayouts(core.state.flags), ["triangle", "four"]);
console.log("[coal training] PASS: hearts2 menu gate, explicit read completion, interruption/stale-load guards, persisted flag, old property retention, setup bypass and independent layouts");

const tong = { name: "ステンレストング（上物）", sell: 1000 };
for (const multiplier of [.63, 1, 1.45, 2.175]) for (const tutorial of [false, true]) {
  const normal = coalJustSeconds(multiplier, tutorial);
  assert.equal(normal, .5 * multiplier * (tutorial ? 1.5 : 1));
  assert.equal(coalJustSeconds(multiplier, tutorial, [{ name: "トング" }]), normal);
  const width = coalJustSeconds(multiplier, tutorial, [tong]);
  assert(Math.abs(width - normal - .05) < 1e-12);
  assert.equal(coalJustSeconds(multiplier, tutorial, [tong, { ...tong }]), width);
  const goods = [tong, { ...tong }]; goods.pop();
  assert.equal(coalJustSeconds(multiplier, tutorial, goods), width);
  goods.pop(); assert.equal(coalJustSeconds(multiplier, tutorial, goods), normal);
  const ideal = 6 + width / 2;
  for (const offset of [-.001, 0, width / 2, width - .001, width + .001]) {
    const timing = evaluateCoalTiming(6 + offset, 6, width);
    assert.equal(timing.phase, phaseOf((6 + offset) / 6, width / 6));
    assert.equal(timing.idealSeconds, ideal);
    assert(timing.score <= 100);
  }
  assert.equal(summarizeCoalTimings([evaluateCoalTiming(ideal, 6, width)]).accuracy, 100);
}
console.log("[coal training] PASS: normal/old-name/multiple/sold tongs, post-multiplier +0.05s, identical phase/error/auto ideal, 100 cap");

// Import the actual baseline modules from origin/main; do not manufacture a baseline formula.
const original = path => execFileSync("git", ["show", "origin/main:remake/js/craft/" + path], { encoding: "utf8" });
const dataURL = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const originalCoals = dataURL(original("coals.js"));
const originalConditions = original("conditions.js").replace(/(["'])(\.\.?\/[^"']+)\1/g, (_, q, spec) =>
  JSON.stringify(spec === "./coals.js" ? originalCoals : new URL(spec, new URL("../js/craft/conditions.js", import.meta.url)).href));
const before = await import(dataURL(originalConditions));
const base = { mode: "tournament", place: "triangle", equip: { charcoal: "flat_charcoal" }, mix: { double_apple: 10, mint: 2 },
  heat: { heatPower: 70 }, holes: { total: 24, minimumComplete: true }, pack: "normal", steamSeconds: 600,
  environment: { rainy: false, ambientC: 23, humidityPercent: 52 } };
const curves = [];
for (const seconds of [180, 300, 480, 600]) {
  const oldTemp = before.temperatureAfterSteam(base, seconds);
  const newTemp = model.temperatureAfterSteam(base, seconds);
  assert(newTemp < oldTemp);
  curves.push({ seconds, before: oldTemp, after: newTemp });
}
assert.equal(model.heatDelta(base, -.16), before.heatDelta(base, -.16));
assert(Math.abs(model.heatDelta(base, .175) / before.heatDelta(base, .175) - .94) < 1e-12);
for (const cs of [{ ...base, equip: { charcoal: "cube_charcoal" } }, { ...base, place: "four" },
  { ...base, coalTypes: ["cube_charcoal", "flat_charcoal", "flat_charcoal"] }]) {
  for (const t of [180, 300, 480, 600]) assert.equal(model.temperatureAfterSteam(cs, t), before.temperatureAfterSteam(cs, t));
  for (const d of [-.16, 0, .175]) assert.equal(model.heatDelta(cs, d), before.heatDelta(cs, d));
}
const reachability = [];
for (const mix of [{ vanilla: 12 }, { double_apple: 12 }, { mint: 12 }, base.mix]) {
  const cs = { ...base, mix }, bands = temperatureBands(cs);
  let found;
  for (let seconds = 180; seconds <= 600 && !found; seconds += 10) {
    const start = model.temperatureAfterSteam(cs, seconds);
    for (const a of [-.145, -.085, 0, .115, .175]) for (const b of [-.145, -.085, 0, .115, .175]) for (const c of [-.145, -.085, 0, .115, .175]) {
      const temp = start + [a, b, c].reduce((sum, delta) => sum + model.heatDelta(cs, delta), 0);
      if (model.isOptimalTemperature(temp, bands)) found = { seconds, start, temp, deltas: [a, b, c] };
    }
  }
  assert(found, "Starter mix cannot reach optimal within three modelled pulls: " + JSON.stringify(mix));
  reachability.push({ mix, ...found });
}
const report = { scope: "Numerical model only: real-time drift, player input and tournament success require browser tests", curves, reachability };
if (process.env.COAL_REPORT) fs.writeFileSync(process.env.COAL_REPORT, JSON.stringify(report, null, 2) + "\n");
console.log("[coal training] PASS: actual before/after flat3 curve and positive response; cube/four/mixed and scoring bands unchanged; four starter mixes numerically reachable in three pulls");
