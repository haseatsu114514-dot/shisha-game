import assert from "node:assert/strict";
import test from "node:test";
import { RINGS, BULLS, KILLS, CLUSTERS, MODES, POWER, LINE, BLADE, INCH, AIM_RANGE, BOARD, DIVISIONS, scoreAt, scoreBlade, resolveThrow, gaugeAt, axisAt, swayAt, releaseAimAt, totalOf, gradeOf, canCall, killState, closuresOf, halfOf, bladeDistance } from "../js/minigames/axe-model.js";
import { reaction } from "../js/minigames/axe-companions.js";
import { TARGET, CAMERA, AXE, AXE_SCALE, FLIGHT, flightPose, flightTime, flightDuration, impactPose, projectAxePoint, worldPoint } from "../js/minigames/axe-flight.js";
import { projectedAxe } from "../js/minigames/axe-geometry.js";
const shot = (x = 0, y = 0, power = POWER.ideal, called = null, history = [], options = {}) => resolveThrow({ x, y, power, called }, history, options);
const league = { throws: 10 };
const near = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);

test("target follows the WATL 2026 Hatchet sheet: 1.5in bulls, 3.5in five rings, 20mm lines, 4in blade, outer zones at 56.5/63.5in and killshots at 48/72in", () => {
  assert.deepEqual(RINGS.map(r => r.score), [6, 5, 4, 3, 2, 1]);
  near(RINGS[0].radius, .75 * INCH); near(RINGS[1].radius, 1.75 * INCH); near(RINGS[5].radius, 1);
  near(LINE, .3937 * INCH, 1e-6); near(BLADE.halfLength, 2 * INCH);
  assert.equal(CLUSTERS.length, 5); assert.equal(BULLS.length, 4);
  for (const b of BULLS) { near(Math.abs(b.y), 3.5 * INCH); near(b.outer, RINGS[1].radius); near(b.inner, RINGS[0].radius); }
  for (const k of KILLS) { near(Math.abs(k.y), 12 * INCH); near(k.outer, .75 * INCH); near(k.inner, .375 * INCH); assert(Math.hypot(k.x, k.y) + k.outer < 1, "killshots sit inside the 1 ring"); }
  near(BOARD.right - BOARD.left, 46.25 * INCH); near(BOARD.bottom - BOARD.top, 48 * INCH);
  assert.deepEqual(Object.keys(DIVISIONS), ["rec", "am", "pro"]);
});
test("point scoring: painted zones match values and the black lines score the lower zone", () => {
  const point = (x, y) => scoreAt(x, y, { halfLength: 0 });
  for (const [radius, score] of [[0, 6], [RINGS[0].radius, 6], [RINGS[0].radius + .001, 5], [RINGS[1].radius - LINE - .001, 5], [RINGS[1].radius - LINE, 4], [RINGS[1].radius, 4],
    [RINGS[2].radius - LINE - .001, 4], [RINGS[2].radius, 3], [RINGS[3].radius, 2], [RINGS[4].radius, 1], [RINGS[5].radius - LINE, 0], [1, 0], [1.1, 0]]) {
    assert.equal(point(radius, 0), score, "radius " + radius); assert.equal(point(0, radius), score);
  }
  for (const b of BULLS) { assert.equal(point(b.x, b.y), 6); assert.equal(point(b.x + RINGS[0].radius + .001, b.y), 5); assert.equal(point(b.x - Math.sign(b.x) * RINGS[1].radius, b.y), 3, "just inside the outer five sits in the 3 ring"); }
  for (const k of KILLS) assert.equal(point(k.x, k.y), 1, "an uncalled blue is wood inside the 1 ring");
});
test("the 4in cutting edge forgives vertical error but not horizontal; the highest zone touched scores", () => {
  assert.equal(scoreAt(0, .15), 6); assert.equal(scoreAt(0, BLADE.halfLength + RINGS[0].radius), 6); assert.equal(scoreAt(0, BLADE.halfLength + RINGS[0].radius + .001), 5);
  assert.equal(scoreAt(RINGS[0].radius, 0), 6); assert.equal(scoreAt(RINGS[0].radius + .001, 0), 5);
  assert.equal(scoreAt(0, .3), 4, "the blade reaching the 5 line still touches the 4 ring");
  assert.deepEqual(scoreBlade(BULLS[0].x, BULLS[0].y + .1), { score: 6, kind: "bull", cluster: "ul" });
  near(bladeDistance(0, 0, 0, .1), 0); near(bladeDistance(0, 0, .2, .1), .2); near(bladeDistance(0, 0, 0, .5), .5 - BLADE.halfLength);
});
test("the gauges stay on the five planks; wood outside the 1 ring sticks for zero and never celebrates", () => {
  assert(AIM_RANGE < BOARD.right && AIM_RANGE < BOARD.bottom, "a 46x48in board is wider than the sweep");
  for (const [x, y] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [1.2, 1.2]]) {
    const result = shot(x, y); assert(result.stuck); assert.equal(result.score, 0); assert.equal(result.outcome, "miss"); assert.equal(result.dropReason, null);
  }
  assert.throws(() => shot(BOARD.right + .01, 0), RangeError, "beyond the sweep is not a legal gauge value");
  const corner = shot(1.15, 1.15); assert(corner.stuck); assert.equal(corner.score, 0);
  assert.equal(flightPose(shot(0, 0, .1), FLIGHT.travel + FLIGHT.fall).opacity, 0, "a drop falls out of view");
});
test("three independently stopped gauges determine aim and rotation deterministically", () => {
  assert.equal(axisAt(.5), 0); assert.equal(axisAt(0), -AIM_RANGE); assert.equal(axisAt(1), AIM_RANGE);
  const input = Object.freeze({ x: 0, y: 0, power: .62 });
  assert.deepEqual(resolveThrow(input), resolveThrow(input)); assert.equal(resolveThrow(input).score, 6);
  assert.equal(shot(1, 1).score, 0); assert.notEqual(shot(0, .25, .45).landing.y, shot(0, .25, .7).landing.y);
  assert.notEqual(shot(0, 0, .45).rotation, shot(0, 0, .7).rotation);
});
test("under-rotated and over-rotated axes drop rather than earning centre points", () => {
  for (const [power, reason] of [[0, "weak"], [.41999, "weak"], [.82001, "rotation"], [1, "rotation"]]) {
    const r = shot(0, 0, power); assert.equal(r.score, 0); assert(!r.stuck); assert.equal(r.outcome, "drop"); assert.equal(r.dropReason, reason);
  }
  for (const power of [.42, .54, .62, .70, .82]) assert(shot(0, 0, power).stuck);
});
test("called killshot: inner 8, outer 7 by blade touch, anything else zero; a call on a drop still scores zero", () => {
  for (const k of KILLS) {
    assert.equal(shot(k.x, k.y, .62, k.id).score, 8);
    assert.equal(shot(k.x + k.inner + .005, k.y, .62, k.id).score, 7);
    assert.equal(shot(k.x, k.y + BLADE.halfLength + k.inner - .002, .62, k.id).score, 8, "the blade reaches the inner dot vertically");
    assert.equal(shot(k.x + k.outer + .001, k.y, .62, k.id).score, 0);
    assert.equal(shot(0, 0, .62, k.id).score, 0); assert.equal(shot(0, 0, .62, k.id).outcome, "killshot-miss");
    assert.equal(shot(k.x, k.y).score, 1);
    assert.equal(shot(k.x, k.y, .1, k.id).score, 0); assert.equal(shot(k.x, k.y, .1, k.id).outcome, "drop");
    assert.equal(typeof shot(k.x, k.y, .62, k.id).distance, "number");
  }
});
test("two calls per game, a success closes its height for the whole game, misses and drops consume calls", () => {
  const upper = KILLS[0], lower = KILLS[2], history = [shot(upper.x, upper.y, .62, upper.id, [], league)];
  assert.deepEqual(killState(history, 10), { remaining: 1, closed: ["upper"], bonus: 0, used: 1, mustRow: null });
  assert(!canCall(KILLS[1].id, history, 10)); assert(canCall(lower.id, history, 10));
  history.push(...Array.from({ length: 4 }, () => shot(0, 0, .62, null, history, league))); assert(!canCall(upper.id, history, 10));
  assert.equal(halfOf(history.length, 10), 1, "the second half starts at throw six");
  history.push(shot(lower.x, lower.y, .62, lower.id, history, league)); assert.equal(killState(history, 10).remaining, 0);
  assert.throws(() => shot(0, 0, .62, upper.id, history, league), RangeError);
  const missed = [shot(0, 0, .62, upper.id, [], league)]; missed.push(shot(0, 0, .62, lower.id, missed, league));
  assert.deepEqual(killState(missed, 10).closed, []); assert.equal(killState(missed, 10).remaining, 0); assert(!canCall(upper.id, missed, 10));
});
test("a drop earns one extra call at the opposite height, except on the final throw", () => {
  const drop = shot(0, 0, .1, null, [], league);
  assert.equal(killState([drop], 10).remaining, 3); assert.equal(killState([drop], 10).bonus, 1);
  const upper = KILLS[0], lower = KILLS[2];
  const a = shot(0, 0, .62, upper.id, [drop], league), b = shot(0, 0, .62, "upper-right", [drop, a], league);
  const state = killState([drop, a, b], 10);
  assert.equal(state.remaining, 1); assert.equal(state.mustRow, "lower");
  assert(!canCall(upper.id, [drop, a, b], 10)); assert(canCall(lower.id, [drop, a, b], 10));
  const lateDrop = [...Array.from({ length: 9 }, () => shot()), shot(0, 0, .1)];
  assert.equal(killState(lateDrop, 10).bonus, 0, "a drop on throw ten awards nothing");
  assert.equal(killState([shot(0, 0, .9)], 10).bonus, 1, "an over-rotated axe is a drop too");
  const practiceDrop = [shot(0, 0, .1), shot(0, 0, .1)];
  assert.equal(killState(practiceDrop, 3).bonus, 2);
});
test("Rec never closes; Am closes each bull and five for the half; Pro closes the whole five ring and scores zero on reuse", () => {
  const bull = shot(0, 0, .62, null, [], { division: "am", ...league });
  assert.deepEqual(bull.zone, { kind: "bull", cluster: "center" });
  const second = shot(0, 0, .62, null, [bull], { division: "am", ...league });
  assert.equal(second.score, 5); assert.deepEqual(second.zone, { kind: "five", cluster: "center" });
  const third = shot(0, 0, .62, null, [bull, second], { division: "am", ...league });
  assert.equal(third.score, 4); assert.equal(third.zone.kind, "ring");
  const outer = shot(BULLS[0].x, BULLS[0].y, .62, null, [bull, second, third], { division: "am", ...league });
  assert.equal(outer.score, 6);
  const outerFive = shot(BULLS[0].x, BULLS[0].y, .62, null, [bull, second, third, outer], { division: "am", ...league });
  assert.equal(outerFive.score, 5);
  const halfReset = shot(0, 0, .62, null, [bull, second, third, outer, outerFive], { division: "am", ...league });
  assert.equal(halfReset.score, 6, "closures open again after the half");
  for (let i = 0; i < 3; i++) assert.equal(shot(0, 0, .62, null, [bull, second, third].slice(0, i), { division: "rec", ...league }).score, 6);
  const proBull = shot(0, 0, .62, null, [], { division: "pro", ...league });
  const reuse = shot(0, 0, .62, null, [proBull], { division: "pro", ...league });
  assert.equal(reuse.score, 0); assert.equal(reuse.outcome, "miss"); assert.equal(reuse.zone.kind, "closed");
  assert.equal(shot(.3, 0, .62, null, [proBull], { division: "pro", ...league }).score, 4, "the 4 ring stays open");
  const closed = closuresOf([proBull], 1, 10, "pro"); assert(closed.cluster.has("center"));
  assert.equal(closuresOf([proBull], 5, 10, "pro").cluster.size, 0);
  const killed = shot(KILLS[0].x, KILLS[0].y, .62, KILLS[0].id, [proBull], { division: "pro", ...league });
  assert.equal(killed.score, 8, "a called throw ignores closures");
  assert.throws(() => shot(0, 0, .62, null, [], { division: "elite" }), RangeError);
});
test("3 and 10 throw maximums are two killshots plus bulls, without invented rewards", () => {
  const a = KILLS[0], b = KILLS[2], history = [shot(a.x, a.y, .62, a.id, [], league)]; history.push(shot(b.x, b.y, .62, b.id, history, league));
  assert.equal(totalOf([...history, shot()]), MODES.practice.max);
  assert.equal(totalOf([...history, ...Array.from({ length: 8 }, () => shot())]), MODES.league.max);
  assert.equal(MODES.league.throws, 10); assert.equal(MODES.league.half, 5); assert.equal(gradeOf(45, 64), "great"); assert.equal(gradeOf(20, 64), "again");
  // Pro perfect game: five different reds per half.
  let pro = [];
  for (let i = 0; i < 10; i++) { const c = CLUSTERS[i % 5]; pro.push(shot(c.x, c.y, .62, null, pro, { division: "pro", ...league })); }
  assert.equal(totalOf(pro), 60);
});
test("horizontal, vertical and rotation gauges traverse both directions", () => {
  for (const cycle of [3600, 2400]) for (const [fraction, value] of [[0, 0], [.25, .5], [.5, 1], [.75, .5], [1, 0]])
    assert.equal(gaugeAt(cycle * fraction, cycle), value);
});
test("companion reacts to actual result, with canonical voice and distinct expressions", () => {
  for (const id of ["hiyori", "shark"]) {
    assert.notEqual(reaction(id, "choice", [], null).text, reaction(id, "choice", [], KILLS[0].id).text);
    for (const outcome of ["bull", "hit", "killshot", "killshot-miss", "miss", "drop"])
      assert.equal(typeof reaction(id, "result", [{ outcome }], null).text, "string");
    assert.notEqual(reaction(id, "result", [{ outcome: "bull" }], null).face, reaction(id, "result", [{ outcome: "drop" }], null).face);
    assert.match(reaction(id, "choice", Array(5).fill({ outcome: "hit" }), null, { switching: true }).text, /後半|折り返し/);
    assert.match(reaction(id, "result", [{ outcome: "miss", zone: { kind: "closed" } }], null).text, /閉じ|円/);
    assert.match(reaction(id, "result", [{ outcome: "drop" }], null, { bonus: true }).text, /宣言|青/);
  }
  assert.match(reaction("shark", "summary", [], null).text, /お主/);
  assert.doesNotMatch(reaction("shark", "summary", [], null).text, /波多野|なぎさ|泳/);
});
test("invalid input cannot produce NaN or illegally call a closed target", () => {
  for (const input of [{ x: NaN, y: 0, power: .6 }, { x: 0, y: Infinity, power: .6 }, { x: 0, y: 0, power: 2 }, { x: 2, y: 0, power: .6 }, { x: 0, y: 0, power: .6, called: "fake" }])
    assert.throws(() => resolveThrow(input), RangeError);
  assert.throws(() => scoreAt(NaN, 0), RangeError); assert.throws(() => gaugeAt(0, 0), RangeError);
});
test("waiting and overgripping increase visible sway; focus genuinely reduces it", () => {
  assert(swayAt(9000).amplitude > swayAt(1000).amplitude * 2);
  assert(swayAt(9000, .8).amplitude > swayAt(9000, .62).amplitude);
  const normal = swayAt(9000, .62, 2), focused = swayAt(9000, .62, 2, true);
  assert(Math.hypot(focused.x, focused.y) < Math.hypot(normal.x, normal.y) / 4);
  assert.deepEqual(swayAt(9000, .62, 2), normal, "Replay uses the same visible movement, without hidden random error");
  assert.notDeepEqual(swayAt(9000, .62, 3), normal, "Each throw has its own visible rhythm");
});
test("a locked centre is no longer an automatic bull; timely focus restores precision", () => {
  let misses = 0;
  for (let ms = 3500; ms < 9000; ms += 100) {
    const input = { x: 0, y: 0 }, moving = releaseAimAt(input, ms, .62, 0, false), steady = releaseAimAt(input, ms, .62, 0, true);
    if (resolveThrow({ ...moving, power: .62 }).score < 6) misses++;
    assert.equal(resolveThrow({ ...steady, power: .62 }).score, 6);
    assert.deepEqual(input, { x: 0, y: 0 }, "Sway does not move the player's locked aim");
  }
  assert(misses > 10, "Holding still on the gauge must require reading the moving blade");
});
test("visible release positions remain finite and legal at the edges", () => {
  for (const x of [-AIM_RANGE, AIM_RANGE]) for (const y of [-AIM_RANGE, AIM_RANGE]) for (const power of [0, .62, 1]) {
    const aim = releaseAimAt({ x, y }, 8000, power, 9, false);
    assert(Math.abs(aim.x) <= AIM_RANGE && Math.abs(aim.y) <= AIM_RANGE); assert(Number.isFinite(resolveThrow({ ...aim, power }).score));
  }
  assert.throws(() => swayAt(-1), RangeError); assert.throws(() => swayAt(1, .62, .5), RangeError);
  assert.throws(() => releaseAimAt({ x: 2, y: 0 }, 1, .62, 0, false), RangeError);
});
test("throws arrive in 0.6s and drops finish in 0.9s without changing the shot; the axe is drawn at hatchet size", () => {
  for (const power of [.1, .62, .95]) {
    const result = shot(0, 0, power), before = structuredClone(result);
    assert.equal(flightPose(result, 0).contact, false);
    assert.equal(flightPose(result, FLIGHT.travel - 1).contact, false);
    assert.equal(flightPose(result, 600).contact, true);
    assert.equal(flightPose(result, 900).done, true);
    assert.deepEqual(result, before);
  }
  // A 16in hatchet on a 48in board: the embedded axe spans about a third of the board height.
  const end = impactPose(shot()), length = projectAxePoint(end, AXE.handleTip).y - projectAxePoint(end, AXE.blade).y;
  assert(length > TARGET.radius * .9 && length < TARGET.radius * 1.4, "embedded axe length " + length);
  assert.equal(AXE_SCALE, 1.6);
});
test("a called throw slows only its approach; the display clock is continuous and lands on the same contact", () => {
  assert.equal(flightTime(0, true), 0); assert.equal(flightTime(200, true), 200);
  const start = FLIGHT.travel * FLIGHT.slowFrom, end = start + (FLIGHT.travel - start) / FLIGHT.slowRate;
  assert.equal(flightTime(start, true), start); assert.equal(flightTime(end, true), FLIGHT.travel);
  assert.equal(flightTime(end + 100, true), FLIGHT.travel + 100);
  for (let ms = 0; ms < end + 400; ms += 7) assert(flightTime(ms + 7, true) >= flightTime(ms, true), "never runs backwards");
  for (let ms = 0; ms < 2000; ms += 50) assert.equal(flightTime(ms, false), ms);
  const drop = shot(0, 0, .1), stuck = shot();
  assert.equal(flightDuration(stuck), FLIGHT.travel); assert.equal(flightDuration(drop), FLIGHT.travel + FLIGHT.fall);
  assert.equal(flightDuration(stuck, true), end); assert(flightDuration(stuck, true) <= 900, "even a slow killshot lands within 0.9s");
});
test("flight shrinks toward the board and contacts the scored blade point without a pose jump", () => {
  for (const x of [-1.2, 0, 1.2]) for (const y of [-1.2, 0, 1.2]) for (const power of [.42, .62, .82]) {
    const result = shot(x, y, power), end = impactPose(result), arrival = flightPose(result, FLIGHT.travel);
    assert.equal(arrival.x, end.x); assert(Math.abs(arrival.y - end.y) < 1e-9);
    assert.equal(arrival.pitch, end.pitch); assert.equal(arrival.scale, end.scale);
    assert(Math.abs(arrival.bladeX - (TARGET.x + result.landing.x * TARGET.radius)) < 1e-9);
    assert(Math.abs(arrival.bladeY - (TARGET.y + result.landing.y * TARGET.radius)) < 1e-9);
    assert.equal(arrival.done, result.stuck);
    assert(flightPose(result, FLIGHT.travel + FLIGHT.fall).done);
    const first = flightPose(result, 0);
    for (let ms = 0; ms <= FLIGHT.travel; ms += 40) { const pose = flightPose(result, ms);
      assert(pose.scale <= first.scale && pose.scale >= end.scale);
      assert(pose.z >= first.z && pose.z <= end.z, "The axe travels toward the board in depth");
    }
  }
  assert(AXE.blade.y !== 0 || AXE.blade.z !== 0, "Spin pivot must differ from cutting edge");
});
test("first-person forward tumble shortens the handle, reverses it, then embeds the front cutting edge", () => {
  const result = shot(), poses = [0, .25, .5, .75, 1].map(t => flightPose(result, FLIGHT.travel * t));
  const length = pose => projectAxePoint(pose, AXE.handleTip).y - projectAxePoint(pose, AXE.blade).y;
  assert(poses[0].pixelY < TARGET.y && poses[0].pixelX > TARGET.x, "Release begins above/right of the player's eyes");
  assert(length(poses[0]) > 0 && length(poses[2]) < 0 && length(poses[4]) > 0, "Handle tips toward/away from the viewer, rather than rolling sideways");
  assert(Math.abs(length(poses[1])) < Math.abs(length(poses[0])) / 2, "Quarter-turn is foreshortened");
  assert(worldPoint(poses[1], AXE.handleTip).z < poses[1].z, "Forward pitch brings the handle butt toward the camera");
  assert(Math.abs(worldPoint(poses[4], AXE.blade).z - CAMERA.boardDepth) < 1e-9, "The forward-facing cutting edge reaches the board plane");
});
test("frontal mesh swaps visible steel/wood faces during the pitch and keeps depth ordering", () => {
  const poses = [0, .25, .5, .75, 1].map(t => flightPose(shot(), FLIGHT.travel * t));
  const seen = poses.map(p => projectedAxe(p).polygons.map(f => f.id));
  assert(seen[0].includes("head-rear") && !seen[0].includes("blade-front"), "Initial view sees the axe spine, not the broad side picture");
  assert(seen[1].includes("handle-end"), "Quarter-turn looks along the wooden handle");
  assert(seen[2].includes("blade-front"), "Half-turn exposes the cutting face");
  for (const pose of poses) { const { polygons } = projectedAxe(pose); assert(polygons.length > 0);
    polygons.forEach((f, i) => { assert(f.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))); if (i) assert(polygons[i - 1].depth >= f.depth); });
  }
});
