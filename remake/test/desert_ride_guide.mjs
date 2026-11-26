import assert from "node:assert/strict";
import test from "node:test";
import { createReturnGuide, RETURN_GUIDE } from "../js/minigames/desert-ride-guide.js";
import { EDGE, SPEED, COURSE_PACKS, PRACTICE_LESSONS, PRACTICE_WALL, practiceCourse,
  createGame, buildCourse, step, botStep } from "../js/minigames/desert-ride-model.js";

test("return cue waits for sustained low speed and points inward on either edge", () => {
  for (const side of [-1, 1]) {
    const cue = createReturnGuide(), g = createGame(buildCourse("ridge"));
    g.x = side; g.speed = RETURN_GUIDE.speed;
    assert.equal(cue(g), null);
    g.t = RETURN_GUIDE.seconds - 0.001;
    assert.equal(cue(g), null);
    g.t = RETURN_GUIDE.seconds;
    assert.equal(cue(g), side < 0 ? "right" : "left");
    g.x = -side;
    assert.equal(cue(g), null, "changing sides restarts the wait");
  }
});

test("return cue clears immediately and starts a new continuous wait after every interruption", () => {
  for (const change of [{ x: EDGE }, { x: -EDGE }, { speed: SPEED.start + 0.01 }, { air: 0.2 }, { fallT: 0.2 }, { finished: true }]) {
    const cue = createReturnGuide(), g = createGame(buildCourse("ridge"));
    Object.assign(g, { x: 1, speed: SPEED.min });
    cue(g); g.t = 2;
    assert.equal(cue(g), "left");
    Object.assign(g, change);
    assert.equal(cue(g), null, JSON.stringify(change));
    Object.assign(g, { x: 1, speed: SPEED.min, air: 0, fallT: 0, finished: false });
    assert.equal(cue(g), null);
    g.t += 1;
    assert.equal(cue(g), null, "interrupted time is not accumulated");
    g.t += 0.5;
    assert.equal(cue(g), "left");
    cue(null);
    assert.equal(cue(g), null, "leaving or restarting resets the cue");
  }
});

test("physical edge runs trigger promptly; short excursions and ordinary course runs never trigger", () => {
  for (const speed of [SPEED.start, SPEED.max, SPEED.boost]) {
    const cue = createReturnGuide(), g = createGame(buildCourse("ridge"));
    g.x = 1.05; g.speed = speed;
    while (g.t < 7 && !cue(g)) step(g, { right: true }, 1 / 60);
    assert.equal(cue(g), "left");
    assert(g.t >= 1.5 && g.t < 6, `edge at speed ${speed}: ${g.t}s`);
  }
  const cue = createReturnGuide(), g = createGame(buildCourse("ridge"));
  for (let i = 0; i < 600; i++) {
    g.t = i / 60; g.speed = SPEED.min; g.x = i % 60 < 50 ? 1 : 0;
    assert.equal(cue(g), null, "repeated short excursions never accumulate");
  }
  for (const pack of COURSE_PACKS) for (const skill of ["none", "rival", "perfect", "expert"]) {
    const guide = createReturnGuide(), game = createGame(buildCourse(pack.id)), memo = {};
    while (!game.finished && game.t < 200) {
      botStep(game, skill, memo, 1 / 60);
      assert.equal(guide(game), null, `${pack.id}/${skill} at ${game.t}`);
    }
    assert(game.finished);
  }
});

test("practice introductions have at least two seconds of obstacle-free approach even at boost speed", () => {
  const course = practiceCourse(), L = PRACTICE_LESSONS;
  for (const [start, target] of [[0, L.firstRock], [L.rock, L.firstRock], [L.bump, L.firstBump],
    [L.trick, L.trickBump], [L.boost, L.smash], [L.recover, PRACTICE_WALL]]) {
    // Include a full capped physics frame before the introduction is shown.
    const safeEnd = start + SPEED.boost * 2.05;
    assert(target > safeEnd, `reading room from ${start} to ${target}`);
    assert(!course.features.some(f => f.z >= start && f.z <= safeEnd), `clear reading stretch at ${start}`);
    const game = createGame(course);
    game.z = start; game.speed = SPEED.boost;
    for (let i = 0; i < 120; i++) step(game, { right: true }, 1 / 60);
    assert.equal(game.falls, 0, `steering while reading at ${start} is safe`);
  }
  assert.deepEqual(course.features.map(f => f.z), [200, 340, 440, 580, 750, 800, 930, 930, 930, 930]);
});
