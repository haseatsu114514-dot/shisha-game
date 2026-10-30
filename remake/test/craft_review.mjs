import assert from "node:assert/strict";
import { goodPointOf, improvementOf } from "../js/craft/advice.js";
import { temperatureBands } from "../js/craft/temperature-model.js";

const bands = temperatureBands();
const served = { temp: bands.ideal[0] + .01, pulls: 2, score: 100 };
const warm = { temp: bands.ideal[1] - .01, pulls: 1, score: 100 };
const steady = { pull: served, careHistory: [warm, served] };
assert.match(goodPointOf(steady), /提供と2回の調整/);
const coldFinish = { ...steady, careHistory: [warm, { temp: .1, pulls: 1, score: 10 }] };
assert.match(goodPointOf(coldFinish), /提供できた/);
assert.match(improvementOf(coldFinish), /調整2回目.*熱を戻して/);
const overpull = { ...steady, pull: { ...served, pulls: 5 } };
assert.match(improvementOf(overpull), /提供.*吸う回数を減らし/);
assert.equal(goodPointOf({}), "", "Do not invent successes for an unfinished session");
assert.equal(improvementOf({ parts: { invented: -99 } }), "");
assert.match(improvementOf({ careHistory: [{ failed: "cold", temp: .04, pulls: 1 }] }), /冷え切る前に炭を交換/);
assert.doesNotMatch(improvementOf(steady), /最適温/, "Do not steer a valid low/high expression back to the center");
console.log("PASS review uses recorded actions, preserves a success and suggests one change");

// #1909: 中程度でも実際の完了記録から控えめに一つ認める。
const moderate = { holes: { score: 72 }, heat: { score: 81 }, steam: { score: 76 }, pull: { score: 70, temp: .2 }, careHistory: [{ score: 74, temp: .2 }, { score: 75, temp: .2 }] };
assert.equal(goodPointOf(moderate), "今回よかったこと：今回の工程では、炭焼きの評価が比較的よかった。");
for (const [key, label] of [["holes", "穴あけ"], ["heat", "炭焼き"], ["steam", "蒸らし"], ["pull", "提供"]]) {
  assert.match(goodPointOf({ [key]: { score: 74 } }), new RegExp(label));
}
assert.match(goodPointOf({ careHistory: [{ score: 73 }, { score: 80 }] }), /2回目の調整の評価/);
assert.match(goodPointOf({ holes: { score: 80 }, heat: { score: 80 } }), /穴あけの評価/);
assert.equal(goodPointOf({ parts: { holes: 100, heat: 100, shisha: 100 } }), "");
for (const score of [undefined, null, NaN, Infinity, -Infinity, "90", 0, -1]) {
  assert.equal(goodPointOf({ holes: { score }, heat: { score }, steam: { score }, pull: { score }, careHistory: [{ score }, { score }] }), "", `invalid/unperformed score: ${score}`);
}
assert.equal(goodPointOf({ holes: { score: 100, skipped: true }, heat: { score: 100, failed: true }, pull: { score: 100, temp: served.temp, failed: "cold" } }), "");
assert.match(goodPointOf({ ...moderate, pull: served }), /適温に整えて提供できた/);
assert.match(goodPointOf({ ...moderate, ...steady }), /提供と2回の調整/);
assert.match(goodPointOf({ ...moderate, careHistory: [{ score: 70 }, served] }), /2回目の調整で適温/);
assert.match(goodPointOf({ heat: { score: 85 }, holes: { score: 95 } }), /炭をしっかり/);
assert.match(goodPointOf({ holes: { score: 85 } }), /穴をそろえて/);
assert.match(goodPointOf({ steam: { score: 85 } }), /集中を保てた/);
console.log("PASS moderate/tied/invalid/incomplete/failed/skipped records and existing success priority");

const sparseCare = [];
sparseCare[1] = served;
assert.equal(goodPointOf({ pull: served, careHistory: sparseCare }), "今回よかったこと：2回目の調整で適温に整えられた。", "A missing first adjustment must not count as two successful adjustments");
