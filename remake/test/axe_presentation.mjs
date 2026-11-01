import assert from "node:assert/strict";
import test from "node:test";
import { BULLS, KILLS, resolveThrow } from "../js/minigames/axe-model.js";
const league = { throws: 10 };
import { shotFeedback, sessionStats, impactFeedback, declarationCue } from "../js/minigames/axe-presentation.js";

test("declaring a new killshot blue gives one cue; same blue, normal, or non-killshot gives none", () => {
  const [first, second] = KILLS;
  assert.deepEqual(declarationCue(null, first.id), { label: "KILL SHOT 宣言", target: first.id, place: "左上" });
  assert.equal(declarationCue(first.id, first.id), null);
  assert.equal(declarationCue(first.id, null), null);
  assert.equal(declarationCue(null, null), null);
  assert.equal(declarationCue(null, "not-a-target"), null);
  assert.equal(declarationCue(first.id, second.id).target, second.id);
});

const shot = (x = 0, y = 0, power = .62, called = null) => resolveThrow({ x, y, power, called });

test("bullseye and killshot hits get the special celebration, ordinary hits do not", () => {
  const killTarget = KILLS[0];
  assert.equal(impactFeedback(shot()).special, true);
  assert.equal(impactFeedback(shot(killTarget.x, killTarget.y, .62, killTarget.id)).special, true);
  assert.equal(impactFeedback(shot(.7, 0)).special, false);
  assert.equal(impactFeedback(shot(.9, .9)).special, false);
});

test("misses never celebrate a valid-power axe stuck outside the scoring circle or called blue", () => {
  for (const failed of [shot(1.15, 1.15), shot(1.2, 1.2), shot(0, 0, .62, KILLS[0].id), shot(0, 0, .1)]) {
    assert.equal(failed.score, 0);
    assert.equal(impactFeedback(failed).hit, false);
    assert.equal(impactFeedback(failed).strength, 0);
    assert.equal(impactFeedback(failed).duration, 0);
  }
  assert(shot(1.15, 1.15).stuck && shot(1.2, 1.2).stuck, "Wood contact is separate from earning a point");
  assert(!shot(0, 0, .1).stuck, "An under-rotated axe does not stick");
  const bull = impactFeedback(shot()), normal = impactFeedback(shot(.7, 0));
  assert(bull.hit && normal.hit); assert(bull.strength > normal.strength);
});

test("feedback celebrates actual central and off-center red bulls without suggesting a correction", () => {
  for (const { x, y } of [{ x: 0, y: 0 }, ...BULLS]) {
    const feedback = shotFeedback(shot(x, y));
    assert.equal(feedback.label, "BULL'S EYE"); assert.equal(feedback.tone, "bull");
    assert.match(feedback.tip, /赤い中心に命中/); assert.doesNotMatch(feedback.tip, /次は/);
  }
});
test("normal aim correction uses the nearest red core, including outer bulls", () => {
  assert.match(shotFeedback(shot(.6, -.24)).tip, /左の赤い中心/);
  assert.match(shotFeedback(shot(.41, -.45)).tip, /下の赤い中心/);
  assert.match(shotFeedback(shot(.2, 0)).tip, /左の赤い中心/);
  assert.equal(shotFeedback(shot(.6, -.24)).tone, "hit");
  assert.equal(shotFeedback(shot(1, 1)).tone, "miss");
});
test("declared misses explain the called blue instead of offering normal red points", () => {
  const target = KILLS[0], declared = shot(0, 0, .62, target.id);
  assert.equal(shotFeedback(declared).tone, "miss");
  assert.match(shotFeedback(declared).tip, /宣言した青だけが得点対象/);
  assert.match(shotFeedback(declared).tip, /左上の青/);
  assert.doesNotMatch(shotFeedback(declared).tip, /赤/);
  assert.equal(shotFeedback(shot(target.x, target.y)).tone, "hit");
  for (const dx of [0, .04]) assert.equal(shotFeedback(shot(target.x + dx, target.y, .62, target.id)).tone, "killshot");
});
test("drops use the actual power failure even over red or declared blue", () => {
  for (const power of [.1, .95]) for (const called of [null, KILLS[0].id]) {
    const result = shot(0, 0, power, called), feedback = shotFeedback(result);
    assert.equal(result.stuck, false); assert.equal(feedback.tone, "drop");
    assert.match(feedback.tip, /54〜70%/); assert.match(feedback.tip, power < .42 ? /柄から/ : /回りすぎ/);
    assert.doesNotMatch(feedback.tip, /宣言した青だけ|赤い中心を狙/);
  }
  const tired = { ...shot(.6, -.24), sway: { fatigue: 1, focused: false } };
  assert.match(shotFeedback(tired).tip, /左の赤い中心.*息を整える/);
  assert.doesNotMatch(shotFeedback({ ...tired, sway: { fatigue: 1, focused: true } }).tip, /息を整える/);
});
test("session summaries handle empty play and count outcomes, calls, drops, two-decimal average and best streak", () => {
  assert.deepEqual(sessionStats([]), { bulls: 0, killshots: 0, calls: 0, stuck: 0, drops: 0, average: 0, best: 0, streak: 0 });
  const target = KILLS[0], shots = [shot(BULLS[0].x, BULLS[0].y), shot(target.x, target.y, .62, target.id),
    shot(0, 0, .1), shot(), shot(0, 0, .62, target.id), shot(1, 1)];
  assert.deepEqual(sessionStats(shots), { bulls: 2, killshots: 1, calls: 2, stuck: 5, drops: 1, average: 3.33, best: 8, streak: 2 });
  assert.equal(sessionStats([shot(), shot(), shot(), shot(.3, 0), shot()]).streak, 3);
});
test("a throw into a closed Pro five ring explains the closure instead of a miss correction", () => {
  const first = resolveThrow({ x: 0, y: 0, power: .62 }, [], { division: "pro", ...league });
  const closed = resolveThrow({ x: 0, y: 0, power: .62 }, [first], { division: "pro", ...league });
  assert.equal(closed.score, 0); assert.equal(shotFeedback(closed).label, "CLOSED");
  assert.match(shotFeedback(closed).tip, /閉じ|使った/);
  assert.equal(impactFeedback(closed).hit, false);
  const outer = shotFeedback(shot(BULLS[0].x, BULLS[0].y));
  assert.equal(outer.tone, "bull"); assert.match(outer.tip, /外側の赤/);
});
