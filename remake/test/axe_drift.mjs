import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveThrow, BOARD, DRIFT_MAGNET } from '../js/minigames/axe-model.js';
import { flickRead, flickTilt, flickDriftScale, FLICK } from '../js/minigames/axe-pull-model.js';
import { flightPose, impactPose } from '../js/minigames/axe-flight.js';
import { createMatch, takeTurn } from '../js/minigames/axe-match.js';

// 2026-11-22 オーナー要望: スワイプを斜めにすると横に飛ぶ（細かい調整ができる）。
// tilt（弾いた向きの傾き）→ drift（着地点の横ずれ）→ 飛行の曲がり、を通しで固定する。
const stroke = (speed, { height = 390, ms = 80, lean = 0, steps = 4 } = {}) => Array.from({ length: steps + 1 }, (_, i) => ({ t: 1000 + ms * i / steps, x: 400 + speed * height * ms / 1000 * lean * i / steps, y: 300 - speed * height * ms / 1000 * i / steps }));

test('flick tilt is the raw sideways ratio, independent of the legacy lean scale', () => {
  assert(Math.abs(flickRead(stroke(3, { lean: .4 }), 390).throw.tilt - .4) < 1e-9);
  assert(Math.abs(flickRead(stroke(3, { lean: -.8 }), 390).throw.tilt + .8) < 1e-9);
  assert.equal(flickRead(stroke(3), 390).throw.tilt, 0);
  // 表示用の tilt は、まだ投げになっていない引きの途中でも横ずれを先行して返す
  assert.equal(flickTilt([{ t: 0, x: 100, y: 100 }, { t: 50, x: 100, y: 160 }], 720), 0);
  assert(flickTilt([{ t: 0, x: 100, y: 100 }, { t: 50, x: 140, y: 160 }], 720) > 0);
  assert(flickTilt([{ t: 0, x: 100, y: 100 }, { t: 50, x: 60, y: 160 }], 720) < 0);
});

test('drift shifts the landing sideways; straight throws are unchanged', () => {
  const straight = resolveThrow({ x: 0, y: 0, power: .62 }, []);
  assert.equal(straight.drift, 0); assert.equal(straight.landing.x, 0); assert.equal(straight.score, 6);
  const right = resolveThrow({ x: 0, y: 0, power: .62, drift: .5 }, []);
  assert(Math.abs(right.landing.x - .5) < 1e-12);
  assert(right.score < straight.score, 'a half-unit drift leaves the bull');
  const back = resolveThrow({ x: .2, y: 0, power: .62, drift: -.2 }, []);
  assert(Math.abs(back.landing.x) < 1e-12); assert.equal(back.score, 6, 'drifting back to centre scores');
});

test('a big diagonal leaves the board: off-board miss, no stick', () => {
  const out = resolveThrow({ x: 0, y: 0, power: .62, drift: 1.6 }, []);
  assert.equal(out.stuck, false); assert.equal(out.score, 0); assert.equal(out.dropReason, 'off-board');
  assert(out.landing.x > BOARD.right);
  const edge = resolveThrow({ x: 0, y: 0, power: .62, drift: 1.2 }, []);
  assert.equal(edge.stuck, true, 'inside the planks still sticks');
});

test('assist: the damping curve weakens small tilts and keeps full tilts at full strength', () => {
  assert.equal(flickDriftScale(0), 0);
  assert.equal(flickDriftScale(1), 1); assert.equal(flickDriftScale(-1), -1);
  assert(Math.abs(flickDriftScale(.3) - .3 ** FLICK.driftCurve) < 1e-12);
  assert(flickDriftScale(.3) < .2, 'a slight diagonal drifts much less than linear');
  assert.equal(flickDriftScale(-.3), -flickDriftScale(.3), 'symmetric');
  assert.equal(flickDriftScale(2), 1, 'clamped');
  assert.equal(flickDriftScale(NaN), 0);
});

test('assist: the edge magnet pulls a just-missing drifted throw back onto the board', () => {
  // raw landing 1.35: overshoot .065 <= margin → pulled inside by overshoot × pull
  const saved = resolveThrow({ x: 0, y: 0, power: .62, drift: 1.35 }, []);
  assert.equal(saved.stuck, true, 'a full diagonal from centre now catches the edge instead of dropping');
  assert(Math.abs(saved.landing.x - (BOARD.right - (1.35 - BOARD.right) * DRIFT_MAGNET.pull)) < 1e-12);
  // beyond the margin the magnet does not reach: the diagonal still misses
  const gone = resolveThrow({ x: 0, y: 0, power: .62, drift: 1.35 + DRIFT_MAGNET.margin + .05 }, []);
  assert.equal(gone.stuck, false); assert.equal(gone.dropReason, 'off-board');
  // symmetric on the left edge
  const left = resolveThrow({ x: 0, y: 0, power: .62, drift: -1.35 }, []);
  assert.equal(left.stuck, true); assert(left.landing.x < 0);
});

test('match turns keep the drift through commit', () => {
  let m = createMatch('normal', 11, 'rec');
  m = takeTurn(m, 'player', { x: 0, y: 0, power: .62, drift: .5 });
  assert(Math.abs(m.player[0].landing.x - .5) < 1e-12);
  assert.equal(m.player[0].drift, .5);
});

test('flight path bends toward the drifted landing', () => {
  const straight = resolveThrow({ x: 0, y: 0, power: .62 }, []);
  const drifted = resolveThrow({ x: 0, y: 0, power: .62, drift: .6 }, []);
  const midS = flightPose(straight, 300), midD = flightPose(drifted, 300);
  const endS = impactPose(straight), endD = impactPose(drifted);
  assert(midD.x - midS.x > 0 && midD.x - midS.x < (endD.x - endS.x) * .5,
    `mid-flight bend ${midD.x - midS.x} should be positive but less than half the total ${endD.x - endS.x}`);
  const done = flightPose(drifted, 600);
  assert(Math.abs(done.pixelX - endD.pixelX) < 1e-9, 'the flight ends exactly on the drifted impact pose');
});
