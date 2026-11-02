import assert from "node:assert/strict";
import fs from "node:fs";
import { judgeComment, evaluationOf, feedbackLine } from "../js/craft/feedback.js";
import { temperatureBands, isIdealTemperature } from "../js/craft/temperature-model.js";
import { allRecordedTemperaturesIdeal } from "../js/craft/temperature-records.js";
import { improvementOf } from "../js/craft/advice.js";

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
  const stronger = saved(cs);
  Object.assign(stronger.holes, { score: 95, evenness: .95, outerEven: .95 });
  Object.assign(stronger.heat, { score: 95, heatPower: 95, heatStability: 95, burnRisk: 5, aromaRetention: 95 });
  delete stronger.stats; finalize(stronger);
  assert.equal(evaluationOf(stronger.parts.shisha).mark, "○");
  assert.match(improvementOf(stronger), /今回の記録を見て、次に試すことを選ぼう/,
    "The real composite-quality fallback does not contradict three recorded temperature successes");
}

// The complete cup can be ○/△ while all three recorded temperature results succeeded.
for (const quality of [40, 65, 80, 89, 90, 100]) {
  const cs = saved(cup(quality)), before = JSON.stringify(cs);
  assert.match(judgeComment(cs), /提供も2回の調整も、いい温度だった/);
  assert.doesNotMatch(judgeComment(cs), /もっと揃え|合わなかった/);
  assert.equal(allRecordedTemperaturesIdeal(cs), true);
  assert.match(improvementOf(cs), /今回の記録を見て、次に試すことを選ぼう/);
  assert.equal(JSON.stringify(cs), before, "Final comments do not mutate saved craft data");
}

// A real miss in any recorded stage stays a miss even when the composite quality is ◎.
for (const index of [0, 1, 2]) {
  const cs = cup(95), rounds = [cs.pull, ...cs.careHistory];
  Object.assign(rounds[index], round(false), { temp: .25 });
  assert.match(judgeComment(saved(cs)), /温度が合わなかったところ/);
  assert.equal(allRecordedTemperaturesIdeal(cs), false);
  assert.match(improvementOf(cs), /熱を戻して/);
}

// Synthetic saved history, not a reachable fresh safe-count run: explicit historical successes remain authoritative.
{
  const cs = cup();
  cs.pull.temp = temperatureBands(cs).ideal[0] + .001;
  cs.leaf = { hp: 2, max: 5, burn: 1, dmg: 10, steps: 10 };
  assert(!isIdealTemperature(cs.pull.temp, temperatureBands(cs)), "Fixture reproduces the later narrower band");
  assert.match(judgeComment(saved(cs)), /提供も2回の調整も、いい温度だった/);
  assert.match(improvementOf(saved(cs)), /今回の記録を見て、次に試すことを選ぼう/);
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
  assert.equal(allRecordedTemperaturesIdeal(cs), false);
  assert.doesNotMatch(improvementOf(cs), /今回の記録を見て/, "Unverified records do not select the success fallback");
}
assert.equal(judgeComment(undefined), feedbackLine("maezono", "default", evaluationOf(0)));

// Only the final temperature-related fallback changes; known causes keep their existing priority.
for (const part of ["shisha", "care1", "care2"]) {
  const cs = cup();
  cs.parts = { holes: 95, heat: 95, shisha: 95, care1: 95, care2: 95, [part]: 70 };
  if (part !== "shisha") cs.careHistory[part === "care1" ? 0 : 1].score = 70;
  assert.match(improvementOf(cs), /今回の記録を見て、次に試すことを選ぼう/);
  delete cs.pull.inZone;
  assert.match(improvementOf(cs), part === "shisha" ? /配合と、提供時の温度/ : part === "care1" ? /交換する炭の数/ : /葉を残し、適温/,
    "Legacy records retain the existing weakest-part fallback");
}
for (const [part, expected] of [["holes", /穴を均等/], ["heat", /炭の全面/]]) {
  const cs = cup(); cs.parts[part] = 10;
  assert.match(improvementOf(cs), expected, "Known holes/heat practice stays actionable");
}
{
  const cs = cup(); cs.pull.pulls = 5;
  assert(allRecordedTemperaturesIdeal(cs));
  assert.match(improvementOf(cs), /提供.*吸う回数を減らし/, "Excessive pulls precede the neutral fallback");
  cs.careHistory[1] = { score: 40, temp: .2, pulls: 3, inZone: false };
  assert.match(improvementOf(cs), /調整2回目.*熱を戻して/, "A measured temperature miss precedes excessive pulls");
  cs.careHistory[1] = { score: 0, temp: 1, pulls: 3, failed: "burnt", inZone: false };
  assert.match(improvementOf(cs), /調整2回目.*熱が上がり切る前/, "Recorded heat failure precedes excessive pulls");
  Object.assign(cs.careHistory[1], { temp: .54, pulls: 1, failed: "leaf" });
  assert.match(improvementOf(cs), /提供.*吸う回数を減らし/, "Earlier excessive pulls precede cumulative leaf advice");
  cs.pull.pulls = 2;
  assert.match(improvementOf(cs), /調整2回目で葉が尽きた/, "Leaf failure retains its existing cause");
  cs.careHistory[1] = { score: 0, temp: .54, pulls: 1, failed: "unknown", inZone: false };
  assert.match(improvementOf(cs), /配合と、提供時の温度/, "Unknown failures retain the existing fallback");
}

// Stage-specific feedback and the established evaluation thresholds remain unchanged.
assert.equal(feedbackLine("maezono", "pull", evaluationOf(80)), "いいねえ。次は温度をもっと揃えたいね");
assert.deepEqual([64, 65, 89, 90].map(value => evaluationOf(value).mark), ["△", "○", "○", "◎"]);
console.log("PASS: saved stage temperatures drive final comments; composite quality, legacy data and leaf narrowing stay separate");
