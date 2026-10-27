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
