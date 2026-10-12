import assert from "node:assert/strict";
import test from "node:test";
import { RINGS, THROW_COUNT, scoreAt, resolveThrow, gaugeAt, totalOf, gradeOf } from "../js/minigames/axe-model.js";
test("painted ring scores and inclusive boundaries, including outside the board", () => {
  assert.deepEqual(RINGS.map(r => r.score), [6, 5, 4, 3, 2, 1]);
  for (const [radius, points] of [[0,6],[.12,6],[.12001,5],[.28,5],[.28001,4],[.46,4],[.46001,3],
    [.64,3],[.64001,2],[.82,2],[.82001,1],[1,1],[1.00001,0]]) {
    assert.equal(scoreAt(radius, 0), points); assert.equal(scoreAt(0, -radius), points);
  }
  assert.equal(scoreAt(.6, .8), 1); assert.equal(scoreAt(1, 1), 0);
});
test("aim and actual release both affect landing; no random result or input mutation", () => {
  const aim = Object.freeze({ x: 0, y: 0 });
  assert.equal(resolveThrow(aim, .5).score, 6);
  assert.equal(resolveThrow(aim, 0).score, 3); assert.equal(resolveThrow(aim, 1).score, 3);
  assert.equal(resolveThrow({ x: 1, y: 1 }, .5).score, 0);
  assert.deepEqual(resolveThrow(aim, .5), resolveThrow(aim, .5));
});
test("gauge moves both ways in a 2.6 second cycle", () => {
  for (const [time, needle] of [[0,0],[650,.5],[1300,1],[1950,.5],[2600,0]]) assert.equal(gaugeAt(time), needle);
});
test("three throws max 18; result grades do not invent a reward", () => {
  assert.equal(THROW_COUNT, 3);
  assert.equal(totalOf([6,6,6].map(score => ({ score }))), 18);
  assert.equal(totalOf([0,4,2].map(score => ({ score }))), 6);
  assert.equal(gradeOf(13), "great"); assert.equal(gradeOf(12), "good"); assert.equal(gradeOf(6), "again");
});
test("invalid numeric inputs cannot produce NaN scores", () => {
  assert.throws(() => scoreAt(NaN, 0), RangeError);
  assert.throws(() => scoreAt(0, Infinity), RangeError);
  assert.throws(() => resolveThrow({ x: 0, y: 0 }, -1), RangeError);
  assert.throws(() => resolveThrow({ x: 0, y: 0 }, 2), RangeError);
});
