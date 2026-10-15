import assert from "node:assert/strict";
import test from "node:test";
import { BULLS, KILLS, resolveThrow } from "../js/minigames/axe-model.js";
import { shotFeedback, sessionStats } from "../js/minigames/axe-presentation.js";

const shot = (x = 0, y = 0, power = .62, called = null) => resolveThrow({ x, y, power, called });

test("feedback celebrates actual central and off-center red bulls without suggesting a correction", () => {
  for (const { x, y } of [{ x: 0, y: 0 }, ...BULLS]) {
    const feedback = shotFeedback(shot(x, y));
    assert.equal(feedback.label, "BULL'S EYE"); assert.equal(feedback.tone, "bull");
    assert.match(feedback.tip, /赤い中心に命中/); assert.doesNotMatch(feedback.tip, /次は/);
  }
});
test("normal aim correction uses the nearest red core, including outer bulls", () => {
  assert.match(shotFeedback(shot(.48, -.24)).tip, /左の赤い中心/);
  assert.match(shotFeedback(shot(.36, -.36)).tip, /下の赤い中心/);
  assert.match(shotFeedback(shot(.18, 0)).tip, /左の赤い中心/);
  assert.equal(shotFeedback(shot(.48, -.24)).tone, "hit");
  assert.equal(shotFeedback(shot(1, 1)).tone, "miss");
});
test("declared misses explain the called blue instead of offering normal red points", () => {
  const target = KILLS[0], declared = shot(0, 0, .62, target.id);
  assert.equal(shotFeedback(declared).tone, "miss");
  assert.match(shotFeedback(declared).tip, /宣言した青だけが得点対象/);
  assert.match(shotFeedback(declared).tip, /左上の青/);
  assert.doesNotMatch(shotFeedback(declared).tip, /赤/);
  assert.equal(shotFeedback(shot(target.x, target.y)).tone, "hit");
  for (const dx of [0, .07]) assert.equal(shotFeedback(shot(target.x + dx, target.y, .62, target.id)).tone, "killshot");
});
test("drops use the actual power failure even over red or declared blue", () => {
  for (const power of [.1, .95]) for (const called of [null, KILLS[0].id]) {
    const result = shot(0, 0, power, called), feedback = shotFeedback(result);
    assert.equal(result.stuck, false); assert.equal(feedback.tone, "drop");
    assert.match(feedback.tip, /54〜70%/); assert.match(feedback.tip, power < .42 ? /力が足りず/ : /回転が合わず/);
    assert.doesNotMatch(feedback.tip, /宣言した青だけ|赤い中心を狙/);
  }
  const tired = { ...shot(.48, -.24), sway: { fatigue: 1, focused: false } };
  assert.match(shotFeedback(tired).tip, /左の赤い中心.*息を整える/);
  assert.doesNotMatch(shotFeedback({ ...tired, sway: { fatigue: 1, focused: true } }).tip, /息を整える/);
});
test("session summaries handle empty play and count outcomes, stuck axes, rounded average and best streak", () => {
  assert.deepEqual(sessionStats([]), { bulls: 0, killshots: 0, stuck: 0, average: 0, best: 0, streak: 0 });
  const target = KILLS[0], shots = [shot(BULLS[0].x, BULLS[0].y), shot(target.x, target.y, .62, target.id),
    shot(0, 0, .1), shot(), shot(0, 0, .62, target.id), shot(1, 1)];
  assert.deepEqual(sessionStats(shots), { bulls: 2, killshots: 1, stuck: 5, average: 3.3, best: 8, streak: 2 });
  assert.equal(sessionStats([shot(), shot(), shot(), shot(.3, 0), shot()]).streak, 3);
});
