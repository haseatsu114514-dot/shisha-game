import assert from "node:assert/strict";
import { config, newGame, state } from "../js/core/state.js";
import { nextStepProgress, stepOfValue } from "../js/core/stat-progress.js";
import { effectVisible, senseExtra } from "../js/craft/effect-visual.js";

newGame();
state.chapter = 5;
for (const [value, step, remaining] of [
  [10, 1, 1], [11, 2, 10], [20, 2, 1], [21, 3, 10],
  [48, 5, 3], [50, 5, 1], [51, 6, 10], [100, 10, 0],
]) {
  state.stats.sense = value;
  assert.equal(stepOfValue(value), step);
  const progress = nextStepProgress("sense");
  assert.equal(progress.step, step);
  if (value < 100) assert.equal(progress.remaining, remaining);
  else assert.equal(progress.capped, true);
}

state.chapter = 1;
state.stats.sense = 48;
assert.deepEqual([nextStepProgress("sense").capped, nextStepProgress("sense").fill], [true, 100]);

config.statEffectColors = true;
state.stats.sense = 10;
assert.equal(effectVisible("sense"), false);
assert.equal(senseExtra(100), 0);
for (const [value, step] of [[20, 2], [50, 5], [100, 10]]) {
  state.stats.sense = value;
  assert.equal(effectVisible("sense"), true);
  assert.ok(Math.abs(senseExtra(100) - 100 * 0.45 * (step - 1) / 9) < 1e-9);
}
config.statEffectColors = false;
assert.equal(effectVisible("sense"), false);
assert.equal(senseExtra(100), 0);
console.log("stat UI progress and sense color width: PASS");
