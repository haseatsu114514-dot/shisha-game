import assert from "node:assert/strict";
import fs from "node:fs";
import { judgeComment, evaluationOf, feedbackLine } from "../js/craft/feedback.js";
import { temperatureBands, isIdealTemperature } from "../js/craft/temperature-model.js";

const round = (inZone = true) => ({ temp: .54, score: inZone ? 95 : 40, inZone });
const cup = (quality = 80) => ({ parts: { shisha: quality }, pull: round(), careHistory: [round(), round()] });
const saved = cs => JSON.parse(JSON.stringify(cs));

// Reproduce the score-axis mismatch with the actual flavor data and production scoring.
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const [{ DB }, { newGame }, { pullResult }, { finalize }] = await Promise.all([
  import("../js/core/data.js"), import("../js/core/state.js"),
  import("../js/craft/conditions.js"), import("../js/craft/score.js"),
]);
DB.flavorById = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors.map(f => [f.id, f]));
DB.equipById = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url))).equipment.map(e => [e.id, e]));
newGame();
{
  const cs = { mode: "tournament", chapter: 1, water: .5, mix: { double_apple: 12 },
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    holes: { total: 22, evenness: .6, outerEven: .6, innerExcess: 0, score: 60, minimumComplete: true },
    heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
    mixInfo: { score: 60, intensity: 5, total: 12 }, steam: { min: 5, hits: 2, score: 70 }, pack: "normal" };
  const bands = temperatureBands(cs);
  cs.pull = { ...pullResult(bands.center, 2, 0, bands, 3), temp: bands.center, pulls: 2 };
  const adjustment = { ...pullResult(bands.center, 1, 0, bands, 2), temp: bands.center, pulls: 1 };
  cs.careHistory = [{ ...adjustment }, { ...adjustment }];
  finalize(cs);
  assert.deepEqual([cs.pull, ...cs.careHistory].map(result => [result.score, result.inZone]), [[100, true], [100, true], [100, true]]);
  assert.equal(evaluationOf(cs.parts.shisha).mark, "○", "An actual composite cup score can remain below the temperature scores");
  assert.match(feedbackLine("maezono", "pull", evaluationOf(cs.parts.shisha)), /温度をもっと揃えたい/, "Reproduce the original cause");
  const restored = saved(cs), before = JSON.stringify(restored);
  assert.match(judgeComment(restored), /提供も2回の調整も、いい温度だった/);
  assert.equal(JSON.stringify(restored), before);
}

// The complete cup can be ○/△ while all three recorded temperature results succeeded.
for (const quality of [40, 65, 80, 89, 90, 100]) {
  const cs = saved(cup(quality)), before = JSON.stringify(cs);
  assert.match(judgeComment(cs), /提供も2回の調整も、いい温度だった/);
  assert.doesNotMatch(judgeComment(cs), /もっと揃え|合わなかった/);
  assert.equal(JSON.stringify(cs), before, "Final comments do not mutate saved craft data");
}

// A real miss in any recorded stage stays a miss even when the composite quality is ◎.
for (const index of [0, 1, 2]) {
  const cs = cup(95), rounds = [cs.pull, ...cs.careHistory];
  Object.assign(rounds[index], round(false), { temp: .25 });
  assert.match(judgeComment(saved(cs)), /温度が合わなかったところ/);
}

// Historical inZone remains authoritative after later leaf damage narrows the band.
{
  const cs = cup();
  cs.pull.temp = temperatureBands(cs).ideal[0] + .001;
  cs.leaf = { hp: 2, max: 5, burn: 1, dmg: 10, steps: 10 };
  assert(!isIdealTemperature(cs.pull.temp, temperatureBands(cs)), "Fixture reproduces the later narrower band");
  assert.match(judgeComment(saved(cs)), /提供も2回の調整も、いい温度だった/);
}

// Missing, invalid, skipped and failed records must not manufacture thermal praise or blame.
for (const makeUnknown of [
  cs => { delete cs.pull; },
  cs => { delete cs.pull.inZone; },
  cs => { delete cs.pull.score; },
  cs => { cs.pull.temp = NaN; },
  cs => { cs.pull.skipped = true; },
  cs => { cs.pull.failed = "leaf"; cs.pull.inZone = false; },
  cs => { cs.careHistory = [round()]; },
  cs => { cs.careHistory = [, round()]; },
]) {
  const cs = cup(); makeUnknown(cs);
  assert.equal(judgeComment(cs), feedbackLine("maezono", "default", evaluationOf(80)));
}
assert.equal(judgeComment(undefined), feedbackLine("maezono", "default", evaluationOf(0)));

// Stage-specific feedback and the established evaluation thresholds remain unchanged.
assert.equal(feedbackLine("maezono", "pull", evaluationOf(80)), "いいねえ。次は温度をもっと揃えたいね");
assert.deepEqual([64, 65, 89, 90].map(value => evaluationOf(value).mark), ["△", "○", "○", "◎"]);
console.log("PASS: saved stage temperatures drive final comments; composite quality, legacy data and leaf narrowing stay separate");
