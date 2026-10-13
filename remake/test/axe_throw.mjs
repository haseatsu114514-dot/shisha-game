import assert from "node:assert/strict";
import test from "node:test";
import { RINGS, BULLS, KILLS, MODES, POWER, scoreAt, resolveThrow, gaugeAt, axisAt, totalOf, gradeOf, canCall, killState } from "../js/minigames/axe-model.js";
import { reaction } from "../js/minigames/axe-companions.js";
const shot = (x = 0, y = 0, power = POWER.ideal, called = null, history = []) => resolveThrow({ x, y, power, called }, history);
test("painted circles match scores; black boundaries use lower neighbouring zones", () => {
  assert.deepEqual(RINGS.map(r => r.score), [6, 5, 4, 3, 2, 1]);
  for (const [radius, score] of [[0,6],[.1,6],[.10001,5],[.22999,5],[.23,4],[.4,3],[.62,2],[.8,1],[1,0]]) {
    assert.equal(scoreAt(radius, 0), score); assert.equal(scoreAt(0, radius), score);
  }
  for (const b of BULLS) { assert.equal(scoreAt(b.x,b.y),6); assert.equal(scoreAt(b.x + .1,b.y),5); }
});
test("three independently stopped gauges determine aim and strength deterministically", () => {
  assert.equal(axisAt(.5),0); assert.equal(axisAt(0),-1.08); assert.equal(axisAt(1),1.08);
  const input = Object.freeze({ x: 0, y: 0, power: .62 });
  assert.deepEqual(resolveThrow(input),resolveThrow(input)); assert.equal(resolveThrow(input).score,6);
  assert.equal(shot(1,1).score,0); assert.notEqual(shot(0,.105,.45).score,shot(0,.105,.7).score);
  assert.notEqual(shot(0,0,.45).rotation,shot(0,0,.7).rotation);
});
test("underpowered and overrotated axes drop rather than earning center points", () => {
  for (const [power,reason] of [[0,"weak"],[.41999,"weak"],[.82001,"rotation"],[1,"rotation"]]) {
    const r=shot(0,0,power); assert.equal(r.score,0); assert(!r.stuck); assert.equal(r.dropReason,reason);
  }
  for (const power of [.42,.54,.62,.70,.82]) assert(shot(0,0,power).stuck);
});
test("called Killshot inner 8 / outer 7, misses zero; uncalled blue is an ordinary ring", () => {
  for (const k of KILLS) {
    assert.equal(shot(k.x,k.y,.62,k.id).score,8);
    assert.equal(shot(k.x + .07,k.y,.62,k.id).score,7);
    assert.equal(shot(0,0,.62,k.id).score,0);
    assert.equal(shot(k.x,k.y).score,1);
    assert.equal(shot(k.x,k.y,.1,k.id).score,0);
  }
});
test("successful Killshot closes both at its height, persists across half; calls consumed by misses and drops", () => {
  const upper=KILLS[0], lower=KILLS[2], history=[shot(upper.x,upper.y,.62,upper.id)];
  assert.deepEqual(killState(history),{remaining:1,closed:["upper"]});
  assert(!canCall(KILLS[1].id,history)); assert(canCall(lower.id,history));
  history.push(...Array.from({length:4},()=>shot())); assert(!canCall(upper.id,history));
  history.push(shot(lower.x,lower.y,.62,lower.id,history)); assert.equal(killState(history).remaining,0);
  assert.throws(()=>shot(0,0,.62,upper.id,history),RangeError);
  const missed=[shot(0,0,.62,upper.id),shot(0,0,.1,lower.id)];
  assert.deepEqual(killState(missed),{remaining:0,closed:[]}); assert(!canCall(upper.id,missed));
});
test("3 and 10 throw maximums include two different-height Killshots, without invented rewards", () => {
  const a=KILLS[0],b=KILLS[2], history=[shot(a.x,a.y,.62,a.id)]; history.push(shot(b.x,b.y,.62,b.id,history));
  assert.equal(totalOf([...history,shot()]),MODES.practice.max);
  assert.equal(totalOf([...history,...Array.from({length:8},()=>shot())]),MODES.league.max);
  assert.equal(MODES.league.throws,10); assert.equal(gradeOf(45,64),"great"); assert.equal(gradeOf(20,64),"again");
});
test("horizontal, vertical and strength gauges traverse both directions", () => {
  for (const cycle of [3200,3600,2400]) for (const [fraction,value] of [[0,0],[.25,.5],[.5,1],[.75,.5],[1,0]])
    assert.equal(gaugeAt(cycle*fraction,cycle),value);
});
test("companion reacts to actual result, with canonical voice and distinct expressions", () => {
  for (const id of ["hiyori","shark"]) {
    assert.notEqual(reaction(id,"choice",[],null).text,reaction(id,"choice",[],KILLS[0].id).text);
    for (const outcome of ["bull","hit","killshot","killshot-miss","miss","drop"])
      assert.equal(typeof reaction(id,"result",[{outcome}],null).text,"string");
    assert.notEqual(reaction(id,"result",[{outcome:"bull"}],null).face,reaction(id,"result",[{outcome:"drop"}],null).face);
  }
  assert.match(reaction("shark","summary",[],null).text,/お主/);
  assert.doesNotMatch(reaction("shark","summary",[],null).text,/波多野|なぎさ|泳/);
});
test("invalid input cannot produce NaN or illegally call a closed target", () => {
  for (const input of [{x:NaN,y:0,power:.6},{x:0,y:Infinity,power:.6},{x:0,y:0,power:2},{x:2,y:0,power:.6},{x:0,y:0,power:.6,called:"fake"}])
    assert.throws(()=>resolveThrow(input),RangeError);
  assert.throws(()=>scoreAt(NaN,0),RangeError); assert.throws(()=>gaugeAt(0,0),RangeError);
});
