// DESERT RIDE（第4章ドバイ・サンドボード）の規則: コースの決定性と公平さ、ジャンプ・着地・転倒、採点と評価の境目。
import assert from "node:assert/strict";
import test from "node:test";
import { CHARGE, COURSE, LAYOUT, NEAR, GATE, SLALOM, PRACTICE_WALL, PLAYER, nearReward, recoverWindow, SPEED, JUMP, FALL, SCORE, SPIN, BOOST, STEER, CARVE, EDGE, RUBBER, rubberCaps, DISPLAY, toKmh, toMeters, RULES_VERSION, RANKS, DEFAULT_SEED, COURSE_PACKS, CURVE_SCALE, generateCourse, practiceCourse, curveAt, headingAt, offsetAt, lateralAt, upcomingCurve, buildCourse, pickCourse, createGame, step, press, boost, chargeBoost, canRecover,
  summary, rankOf, readResult, botControl, botStep, nextBumpDistance, comboMultiplier, rivalRun, rivalAt, smashing, RIVALS, jumpPeak, jumpHeight } from "../js/minigames/desert-ride-model.js";

const DT = 1 / 60;
/** ゲージを置く（使わないと減る仕組みを止めて、量そのものを確かめる）。 */
const hold = (game, gauge) => { game.gauge = gauge; game.chargedAt = Infinity; };
function play(course, skill, { maxTime = 200, race = false } = {}) {
  const game = createGame(course, { rival: race ? rivalRun(course) : null }), memo = {};
  while (!game.finished && game.t < maxTime) botStep(game, skill, memo, DT);
  return game;
}
/** 次の起伏の手前まで滑って大ジャンプする。 */
function jumpAtNextBump(game) {
  while (nextBumpDistance(game) > game.speed * JUMP.bumpWindow * 0.5) step(game, {}, DT);
  assert.equal(press(game), "big");
}

test("the course is deterministic per seed, sorted, fair: rocks leave a gap and never sit in a landing zone", () => {
  const a = generateCourse(DEFAULT_SEED), b = generateCourse(DEFAULT_SEED), other = generateCourse(DEFAULT_SEED + 1);
  assert.deepEqual(a.features, b.features);
  assert.notDeepEqual(a.features, other.features);
  assert.equal(a.length, COURSE.length);
  for (let i = 1; i < a.features.length; i++) assert(a.features[i].z >= a.features[i - 1].z, "features sorted by z");
  // 2026-11-13: 最初の要素は岩の無い起伏（走り出して約5秒で最初の「跳ぶ」）。岩は 160m から
  assert.deepEqual({ kind: a.features[0].kind, z: a.features[0].z }, { kind: "bump", z: LAYOUT.firstBump });
  assert(LAYOUT.firstBump >= 80 && LAYOUT.firstBump <= 100, "the first jump comes about five seconds in, with time to read it");
  const bumps = a.features.filter(f => f.kind === "bump"), rocks = a.features.filter(f => f.kind === "rock");
  assert(rocks[0].z >= LAYOUT.start, "no rock before the random layout starts");
  assert(bumps.length >= 5 && rocks.length >= 10, `enough jumps (${bumps.length}) and rocks (${rocks.length})`);
  for (const bump of bumps) {
    for (const rock of rocks) assert(rock.z <= bump.z || rock.z - bump.z >= 50, `no rock in the landing zone after the bump at ${bump.z}`);
  }
  // 同じ z の岩の列は、コースの中（端の深い砂の内側）のどこか1か所に、板（0.2）の2倍以上の隙間を必ず残す
  // （2026-11-13 の「門」は、空いた1か所以外を岩でふさぐ。それまでの2つ岩は、間も外側も通れる）
  for (const rock of rocks) {
    assert(Math.abs(rock.x) + rock.w <= 1, "rocks stay inside the course");
    const row = rocks.filter(r => Math.abs(r.z - rock.z) < 1).sort((a, b) => a.x - b.x);
    const edges = [-EDGE, ...row.flatMap(r => [r.x - r.w, r.x + r.w]), EDGE];
    let widest = 0;
    for (let i = 0; i < edges.length; i += 2) widest = Math.max(widest, edges[i + 1] - edges[i]);
    assert(widest >= 0.4, `the row at ${rock.z} leaves a passable gap (${widest.toFixed(2)})`);
  }
  // 岩は見てから避けられる間隔（連なる小岩も 30m 以上）
  const zs = [...new Set(rocks.map(r => r.z))].sort((p, q) => p - q);
  for (let i = 1; i < zs.length; i++) assert(zs[i] - zs[i - 1] >= 30, `rocks ${zs[i - 1]} and ${zs[i]} are too close`);
  assert.equal(curveAt(a, 0), 0); assert.equal(curveAt(a, a.length + 1000), 0);
  for (let z = 0; z < a.length; z += 7) assert(Math.abs(curveAt(a, z)) <= 1);
});

test("the practice course is short, fixed and in the lesson order (rock, bump, rock, bump for a spin, rocks to smash, a wall to recover from)", () => {
  const course = practiceCourse();
  assert.equal(course.practice, true);
  assert.equal(course.length, COURSE.practiceLength);
  assert.deepEqual(course.features.map(f => f.kind), ["rock", "bump", "rock", "bump", "rock", "rock", "rock", "rock", "rock", "rock"]);
  // 2026-11-13: 最後は岩の壁（立て直しを一度やってみる所）。コースの中（端の深い砂の内側）ではよけられない
  const wall = course.features.filter(f => f.z === PRACTICE_WALL);
  assert.equal(wall.length, 4);
  for (const r of wall) assert(Math.abs(r.x) + r.w <= 1, "the wall stays inside the course");
  for (let x = -EDGE; x <= EDGE + 1e-9; x += 0.01) assert(wall.some(r => Math.abs(x - r.x) < r.w + PLAYER.half), `the wall cannot be dodged inside the course (x=${x.toFixed(2)})`);
  assert(PRACTICE_WALL - 590 > SPEED.boost * (BOOST.duration - BOOST.smashCost * 2) * 0.7, "the wall sits past the smash lesson");
  assert(COURSE.practiceLength - PRACTICE_WALL >= 60, "room to coast after the wall");
  assert.equal(rivalRun(course).samples.length > 0, true, "the rival can run any course (the screen only races in the main run)");
});

test("steering has inertia and sand drag; the edge slows the board; dt is capped", () => {
  const game = createGame(generateCourse(DEFAULT_SEED));
  step(game, { right: true }, DT);
  assert(game.vx > 0 && game.x > 0 && game.x < 0.01, "moves gradually, not instantly");
  for (let i = 0; i < 120; i++) step(game, { right: true }, DT);
  assert(game.x > 0.9, "holding right reaches the edge within 2 seconds");
  assert(game.x <= 1.05);
  const edgeSpeed = game.speed;
  for (let i = 0; i < 60; i++) step(game, { right: true }, DT);
  assert(game.speed < edgeSpeed + SPEED.accel, "the deep sand at the edge holds the speed down");
  assert(game.stats.edgeTime > 0.5);
  const before = game.z;
  step(game, {}, 5); // 5秒を渡しても 50ms 分しか進まない
  assert(game.z - before < SPEED.max * 0.06);
});

test("analog steering follows stick deflection while button steering stays at full strength", () => {
  const course = practiceCourse();
  const travel = input => {
    const game = createGame(course);
    for (let i = 0; i < 18; i++) step(game, input, DT);
    return game.x;
  };
  const half = travel({ steer: 0.5 }), full = travel({ steer: 1 });
  assert(half > 0 && half < full * 0.6, `half tilt ${half} stays below full tilt ${full}`);
  assert(Math.abs(full - travel({ right: true })) < 1e-9, "the right button still gives full steering");
  assert(Math.abs(travel({ steer: -0.5 }) + half) < 1e-9, "left tilt mirrors right tilt");
});

test("pressing near a bump is a big jump, pressing in the air braces the landing, perfect landings boost", () => {
  const course = generateCourse(DEFAULT_SEED);
  const game = createGame(course);
  const bump = course.features.find(f => f.kind === "bump");
  while (nextBumpDistance(game) > game.speed * JUMP.bumpWindow * 0.5) step(game, {}, DT);
  assert.equal(game.air, 0);
  assert.equal(press(game), "big");
  assert(game.air > 0 && game.airKind === "big");
  assert.equal(game.stats.bigJumps, 1);
  assert.equal(game.score, 0, "takeoff does not score");
  assert.equal(game.combo, 0, "takeoff does not build a combo");
  assert.equal(game.gauge, 0, "recovery waits until landing");
  // 空中でもう一度押すと着地の構え。着地の直前（landingWindow 以内）なら完璧
  while (game.air > JUMP.landingWindow * 0.5) step(game, {}, DT);
  assert.equal(press(game), "brace");
  const speedBefore = game.speed;
  while (game.air > 0) step(game, {}, DT);
  assert.equal(game.stats.perfect, 1);
  assert(game.speed > speedBefore, "a perfect landing adds speed");
  assert(game.passed.has(bump));
  assert.equal(game.combo, 1, "only the successful landing builds the combo");
});

test("a bump taken without pressing only bounces (slower, no score); a flat press is a small hop", () => {
  const course = generateCourse(DEFAULT_SEED);
  let game = createGame(course);
  const bump = course.features.find(f => f.kind === "bump");
  while (!game.passed.has(bump)) step(game, {}, DT);
  assert.equal(game.airKind, "bounce");
  assert.equal(game.stats.bounces, 1);
  assert.equal(game.gauge, 0, "a bounce never recovers boost");
  assert.equal(game.stats.bigJumps, 0);
  assert.equal(game.falls, 0, "missing a bump never counts as a fall");
  assert.equal(press(game), null, "no brace during a bounce");
  game = createGame(course);
  step(game, {}, DT);
  assert.equal(press(game), "hop");
  assert.equal(game.stats.hops, 1);
  assert.equal(game.score, 0, "hops do not score");
  assert.equal(game.airTotal, JUMP.hopAir);
});

test("hitting a rock is a fall: slower, combo reset, recoverable, never game over; a big jump clears any rock, a hop small ones and big ones near its top", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rock = course.features.find(f => f.kind === "rock");
  let game = createGame(course);
  game.combo = 5; game.score = 1000;
  while (game.z < rock.z - 30) step(game, {}, DT);
  const speedBefore = game.speed;
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, 1);
  assert.equal(game.combo, 0);
  assert.equal(game.score, 1000 + FALL.points);
  assert(game.fallT > 0 && game.speed <= (speedBefore + SPEED.accel * 2) * SPEED.fallFactor, "a fall cuts the speed");
  assert.equal(game.finished, false);
  for (let i = 0; i < 90; i++) step(game, {}, DT);
  assert.equal(game.fallT, 0, "the rider gets up by themselves");
  assert(game.speed > SPEED.min, "and speeds up again");
  // 大ジャンプ中は岩の上を越える
  game = createGame(course);
  while (game.z < rock.z - 20) step(game, {}, DT);
  game.x = rock.x; game.air = 1; game.airTotal = 1; game.airKind = "big";
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, 0, "a big jump clears the rock");
  // ホップ（2026-11-11 オーナー「ブースト溜まってない時のジャンプが弱すぎて難しい」）: 小さい岩はいつでも、
  // 大きい岩は跳んだ高い所（JUMP.hopClearsBig 以上）で越える。低い所（跳び始め・着地際）では大きい岩に当たる
  const big = course.features.find(f => f.kind === "rock" && f.size !== "small"), small = course.features.find(f => f.kind === "rock" && f.size === "small");
  const hopOver = (target, height) => {
    const g = createGame(course);
    while (g.z < target.z - 1) step(g, {}, DT);
    g.x = target.x; g.airKind = "hop"; g.airTotal = 1; g.air = 0.5; g.airPeak = height; // 弧の頂上で岩の上を通る
    while (!g.passed.has(target)) { g.x = target.x; g.air = 0.5; step(g, {}, DT); }
    return g.falls;
  };
  assert.equal(hopOver(small, 0.2), 0, "a hop clears a small rock even low");
  assert.equal(hopOver(big, JUMP.hopClearsBig + 0.05), 0, "a hop clears a big rock near its top");
  assert.equal(hopOver(big, JUMP.hopClearsBig - 0.2), 1, "but not a big rock while still low");
  assert(jumpPeak(SPEED.start, "hop") > JUMP.hopClearsBig + 0.2, "a hop from the start speed is high enough to clear a big rock at its top");
});

test("passing close to a rock scores a near miss and extends the combo", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rock = course.features.find(f => f.kind === "rock");
  const game = createGame(course);
  while (game.z < rock.z - 10) step(game, {}, DT);
  const side = rock.x > 0 ? -1 : 1;
  while (!game.passed.has(rock)) { game.x = rock.x + side * (rock.w + 0.2); step(game, {}, DT); }
  assert.equal(game.falls, 0);
  assert.equal(game.stats.nearMiss, 1);
  assert.equal(game.combo, 1);
  assert(game.score >= NEAR.minPoints && game.score <= NEAR.maxPoints);
});

test("near misses are graded: closer to the rock pays more, and the safe middle of a rock pair pays less than one close shave (2026-11-13)", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rock = course.features.find(f => f.kind === "rock" && course.features.filter(o => o.z === f.z).length === 1);
  const pass = margin => {
    const game = createGame(course);
    while (game.z < rock.z - 10) step(game, {}, DT);
    const side = rock.x > 0 ? -1 : 1;
    while (!game.passed.has(rock)) { game.x = rock.x + side * (rock.w + PLAYER.half + margin); step(game, {}, DT); }
    return game;
  };
  const shave = pass(0.01), mid = pass(0.11), wide = pass(NEAR.width - 0.01), outside = pass(NEAR.width + 0.01), hit = pass(-0.01);
  assert.equal(hit.falls, 1, "inside the hit box is a fall, not a near miss");
  assert.equal(hit.stats.nearMiss, 0);
  assert.equal(outside.stats.nearMiss, 0, "outside the band is nothing");
  for (const game of [shave, mid, wide]) { assert.equal(game.falls, 0); assert.equal(game.stats.nearMiss, 1); }
  assert(shave.score > mid.score && mid.score > wide.score, `closer pays more (${shave.score} > ${mid.score} > ${wide.score})`);
  assert(shave.gauge > mid.gauge && mid.gauge > wide.gauge, "and charges more boost");
  assert(shave.score >= NEAR.maxPoints - 5 && wide.score <= NEAR.minPoints + 5);
  assert(Math.abs(shave.gauge - NEAR.maxGauge * CHARGE) < 0.01 && Math.abs(wide.gauge - NEAR.minGauge * CHARGE) < 0.01, "the band's gauge, scaled by CHARGE");
  assert.deepEqual(nearReward(1), { points: NEAR.maxPoints, gauge: NEAR.maxGauge });
  assert.deepEqual(nearReward(0), { points: NEAR.minPoints, gauge: NEAR.minGauge });
  // 2つ岩の真ん中（いちばん安全な線）: 2つ合わせても、1つをぎりぎりでかすめた時のゲージに届かない程度
  const pairMargin = 0.42 - (0.17 + PLAYER.half), each = nearReward(1 - pairMargin / NEAR.width);
  assert(each.points < 60 && each.gauge < 0.08, `the middle of a pair pays ${each.points} / ${each.gauge.toFixed(3)} per rock`);
  assert(each.gauge * 2 <= NEAR.maxGauge + 0.01, "the safe line through a pair is not worth more boost than one close shave");
  // 跳び越えた岩は、横の危険を取っていないので真ん中の値
  const over = createGame(course);
  while (over.z < rock.z - 20) step(over, {}, DT);
  over.x = rock.x; over.air = 1; over.airTotal = 1; over.airKind = "big";
  while (!over.passed.has(rock)) { over.x = rock.x; step(over, {}, DT); }
  assert.equal(over.falls, 0);
  assert.equal(over.score, nearReward(NEAR.airCloseness).points);
});

test("boost has a price: every smashed rock shortens it, and the deep sand at the edge ends it (2026-11-13)", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rocks = course.features.filter(f => f.kind === "rock" && course.features.filter(o => o.z === f.z).length === 1);
  const through = (rock, boostT) => {
    const game = createGame(course);
    while (game.z < rock.z - 20) step(game, {}, DT);
    game.boostT = boostT; game.speed = SPEED.boost;
    let before = null;
    while (!game.passed.has(rock)) { game.x = rock.x; before = game.boostT; step(game, {}, DT); }
    return { game, before, event: game.events.find(e => e.kind === "smash") };
  };
  // 砕くたびに smashCost 秒減る
  const full = through(rocks[0], 2.5);
  assert.equal(full.game.stats.smashed, 1); assert.equal(full.game.falls, 0);
  assert(Math.abs(full.before - DT - BOOST.smashCost - full.game.boostT) < 1e-9, `one smash costs ${BOOST.smashCost}s (${full.before} → ${full.game.boostT})`);
  assert(Math.abs(full.event.boostLost - BOOST.smashCost) < 1e-9, "the event reports what was lost");
  assert.equal(full.event.points, SCORE.smash, "the points are unchanged");
  // 残り smashFloor 秒までは削らない（砕いた直後に切れて、次の岩で転ばない）。増やしもしない
  const low = through(rocks[0], 0.9);
  assert(low.game.boostT >= BOOST.smashFloor - 1e-9 && low.game.boostT < low.before, `the cost never cuts below the floor (${low.before} → ${low.game.boostT})`);
  const nearEnd = createGame(course);
  while (nearEnd.z < rocks[0].z - 1) step(nearEnd, {}, DT);
  nearEnd.speed = SPEED.boost; nearEnd.boostT = BOOST.smashFloor + 0.1; nearEnd.x = rocks[0].x;
  while (!nearEnd.passed.has(rocks[0])) { nearEnd.x = rocks[0].x; step(nearEnd, {}, DT); }
  assert.equal(nearEnd.stats.smashed, 1);
  assert(nearEnd.boostT <= BOOST.smashFloor + 1e-9 && nearEnd.boostT > 0, `a nearly spent boost keeps its last moment (${nearEnd.boostT})`);
  // ブーストが終わった後の勢いで砕いても、ブーストは増えない
  const coasting = createGame(course);
  while (coasting.z < rocks[0].z - 1) step(coasting, {}, DT);
  coasting.speed = SPEED.boost; coasting.boostT = 0; coasting.x = rocks[0].x;
  assert(smashing(coasting));
  while (!coasting.passed.has(rocks[0])) { coasting.x = rocks[0].x; step(coasting, {}, DT); }
  assert.equal(coasting.stats.smashed, 1); assert.equal(coasting.boostT, 0, "smashing on leftover speed never grants boost time");
  // 端の深い砂: 入ったその場でブーストが切れる（コースの中なら切れない）
  const edge = createGame(course);
  edge.boostT = 2; edge.x = EDGE - 0.02;
  step(edge, {}, DT);
  assert(edge.boostT > 1.9, "inside the course the boost runs on");
  edge.x = EDGE + 0.02;
  step(edge, {}, DT);
  assert.equal(edge.boostT, 0, "the deep sand ends the boost");
  assert.equal(edge.stats.boostsLost, 1);
  assert.deepEqual(edge.events.filter(e => e.kind === "boostEnd").map(e => e.reason), ["edge"], "announced once, with the reason");
  step(edge, {}, DT);
  assert.equal(edge.events.filter(e => e.kind === "boostEnd").length, 1);
  // 大ジャンプの空中は、端の上でも切れない（地面の砂に触れていない）
  const air = createGame(course);
  air.boostT = 2; air.x = EDGE + 0.1; air.air = 1; air.airTotal = 1; air.airKind = "big";
  step(air, {}, DT);
  assert(air.boostT > 1.9, "airborne over the edge keeps the boost");
  // 理想の滑りは、どのコースでも端でブーストを失わない（切り込めば流されない）
  for (const pack of COURSE_PACKS) for (const skill of ["expert", "perfect"]) assert.equal(play(buildCourse({ id: pack.id }), skill).stats.boostsLost, 0, `${pack.id} ${skill} keeps its boosts`);
});

test("courses are longer and more varied: gates, slaloms and S-bends, every row still passable (2026-11-13)", () => {
  assert.equal(COURSE.length, 2000);
  let gates = 0, slaloms = 0;
  const all = [...COURSE_PACKS.map(pack => buildCourse({ id: pack.id })), ...Array.from({ length: 30 }, (_, i) => generateCourse(i + 1))];
  for (const course of all) {
    const rocks = course.features.filter(f => f.kind === "rock");
    const rows = [...new Set(rocks.map(r => r.z))].map(z => rocks.filter(r => r.z === z));
    const gateRows = rows.filter(row => row.length === GATE.slots.length - 1 && row.every(r => r.size === "small" && GATE.slots.includes(r.x)));
    const slalomRuns = rows.filter((row, i) => row.length === 1 && Math.abs(row[0].x) === SLALOM.x
      && Array.from({ length: SLALOM.count }, (_, k) => rows.find(o => o.length === 1 && Math.abs(o[0].z - (row[0].z + SLALOM.gap * k)) < 1e-9 && Math.abs(o[0].x - row[0].x * (k % 2 ? -1 : 1)) < 1e-9)).every(Boolean));
    gates += gateRows.length; slaloms += slalomRuns.length;
    // 門の空きは、板が余裕を持って抜けられる幅（空いた所の両隣の岩の間）
    for (const row of gateRows) {
      const xs = row.map(r => r.x).sort((a, b) => a - b), open = GATE.slots.find(x => !xs.includes(x));
      const left = Math.max(-EDGE, ...xs.filter(x => x < open).map(x => x + 0.11)), right = Math.min(EDGE, ...xs.filter(x => x > open).map(x => x - 0.11));
      assert(right - left >= 0.4, `${course.id}: the gate at ${row[0].z} leaves room (${(right - left).toFixed(2)})`);
    }
    if (COURSE_PACKS.some(pack => pack.id === course.id)) {
      assert(gateRows.length + slalomRuns.length >= 1, `${course.id} has a gate or a slalom`);
      // S字: 左右の曲がりが2回以上入れ替わる
      const turns = course.curves.map(p => Math.sign(p.c)).filter(Boolean);
      const flips = turns.filter((sign, i) => i && sign !== turns[i - 1]).length;
      assert(flips >= 2, `${course.id} bends both ways more than once (${flips})`);
    }
  }
  assert(gates >= 10 && slaloms >= 5, `gates (${gates}) and slaloms (${slaloms}) appear across the courses`);
});

test("rivals boost often and the race stays close, without changing who can win (2026-11-13)", () => {
  const starts = run => run.samples.filter((s, i) => i && s.boostT > 0 && run.samples[i - 1].boostT <= 0).length;
  for (const pack of COURSE_PACKS) {
    const course = buildCourse({ id: pack.id });
    const noor = rivalRun(course), naru = rivalRun(course, { who: "naru" });
    assert(starts(noor) >= 5, `${pack.id}: Noor boosts often (${starts(noor)})`);
    assert(starts(naru) >= 5, `${pack.id}: Naru boosts often (${starts(naru)})`);
  }
  assert(RIVALS.noor.boostAt < 0.5 && RIVALS.naru.boostAt < 0.5, "rivals do not wait for a full gauge");
  // 接戦: 着地を決める滑りとヌール、理想の滑りとなるは、差 15m 以内で滑る時間が半分以上
  const course = buildCourse({ id: "ridge" });
  for (const [who, skill] of [["noor", "perfect"], ["naru", "expert"]]) {
    const rival = rivalRun(course, { who }), game = createGame(course, { rival }), memo = {};
    let close = 0, all = 0;
    while (!game.finished && game.t < 200) { botStep(game, skill, memo, DT); all++; if (Math.abs(game.z - rivalAt(rival, game.rivalClock).z) < 15) close++; }
    assert(close / all > 0.5, `${who} vs ${skill}: close for ${Math.round(100 * close / all)}% of the run`);
    assert.equal(game.race.won, true, `${skill} still beats ${who}`);
  }
});

test("the boost gauge charges a little slower everywhere, and drains slowly when it is not used (2026-11-13)", () => {
  // 溜まり方: 滑りの中で貯まる分には一律に CHARGE を掛ける（練習の説明が渡す量には掛けない）
  assert(CHARGE >= 0.8 && CHARGE < 0.95, "a little slower, not a lot");
  const game = createGame(generateCourse(DEFAULT_SEED));
  chargeBoost(game, 0.5);
  assert.equal(game.gauge, 0.5, "a direct charge (the practice lesson) is not scaled");
  // 使わないと減る: 最後に貯まってから decayDelay 秒は減らず、その後は毎秒 decay ずつ
  const fresh = createGame(generateCourse(DEFAULT_SEED));
  chargeBoost(fresh, 1);
  for (let i = 0; i < Math.round((BOOST.decayDelay - 0.1) / DT); i++) step(fresh, {}, DT);
  assert.equal(fresh.gauge, 1, "a fresh charge waits before it drains");
  for (let i = 0; i < 60; i++) step(fresh, {}, DT);
  assert(fresh.gauge < 1 && fresh.gauge > 1 - BOOST.decay * 1.2, `then it drains slowly (${fresh.gauge})`);
  const full = 1 / BOOST.decay + BOOST.decayDelay;
  assert(full > 25 && full < 45, `a full gauge lasts about half a run if never used (${full.toFixed(0)}s)`);
  // 貯まるたびに、減り始めるまでの間がやり直しになる
  const topped = createGame(generateCourse(DEFAULT_SEED));
  chargeBoost(topped, 0.5);
  for (let i = 0; i < Math.round((BOOST.decayDelay + 1) / DT); i++) step(topped, {}, DT);
  const before = topped.gauge;
  chargeBoost(topped, 0.1);
  for (let i = 0; i < Math.round((BOOST.decayDelay - 0.1) / DT); i++) step(topped, {}, DT);
  assert(Math.abs(topped.gauge - (before + 0.1)) < 1e-9, "charging again resets the wait");
  // ブースト中は減らない（貯めた分は次に回せる）
  const boosting = createGame(generateCourse(DEFAULT_SEED));
  boosting.boostT = 10; boosting.gauge = 0.4; boosting.chargedAt = -100;
  for (let i = 0; i < 120; i++) step(boosting, {}, DT);
  assert.equal(boosting.gauge, 0.4, "no drain while boosting");
  // 空になったら止まる（負にならない）
  const empty = createGame(generateCourse(DEFAULT_SEED));
  empty.gauge = 0.01; empty.chargedAt = -100;
  for (let i = 0; i < 120; i++) step(empty, {}, DT);
  assert.equal(empty.gauge, 0);
});

test("Naru is a real final rival: only the ideal spinning run beats him, by a small margin, and he never eases off (2026-11-13)", () => {
  for (const pack of COURSE_PACKS) {
    const course = buildCourse({ id: pack.id }), naru = rivalRun(course, { who: "naru" }), noor = rivalRun(course);
    assert.equal(naru.easeOff, false); assert.equal(noor.easeOff, true);
    assert(naru.finishTime < noor.finishTime - 1.5, `${pack.id}: Naru is well ahead of Noor (${naru.finishTime.toFixed(1)} vs ${noor.finishTime.toFixed(1)})`);
    const expert = play(course, "expert"), perfect = play(course, "perfect");
    const margin = naru.finishTime - expert.finishTime;
    assert(margin > 0 && margin < 1.6, `${pack.id}: the ideal spinning run wins, but only just (${margin.toFixed(2)}s)`);
    assert(perfect.finishTime > naru.finishTime + 1, `${pack.id}: clean landings without spins lose clearly`);
  }
});

test("practice gives a longer window to recover after hitting the wall; the main run keeps the short one (2026-11-13)", () => {
  assert(BOOST.practiceRecoverWindow >= BOOST.recoverWindow * 1.8);
  const hit = course => {
    const rock = course.features.find(f => f.kind === "rock" && (course.practice ? f.z === PRACTICE_WALL : true));
    const game = createGame(course);
    game.z = rock.z - 20; game.x = rock.x; // 手前の岩は飛ばして、その岩の前から
    game.gauge = 0.6;
    while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
    assert.equal(game.falls, 1);
    return game;
  };
  const practice = hit(practiceCourse()), run = hit(generateCourse(DEFAULT_SEED));
  assert.equal(recoverWindow(practice), BOOST.practiceRecoverWindow); assert.equal(recoverWindow(run), BOOST.recoverWindow);
  const wait = BOOST.recoverWindow + 0.2;
  for (let i = 0; i < Math.round(wait / DT); i++) { step(practice, {}, DT); step(run, {}, DT); }
  assert.equal(canRecover(run), false, "the main run's window has closed");
  assert.equal(canRecover(practice), true, "practice still lets the learner recover");
  assert.equal(boost(practice), "recover");
  assert.equal(practice.falls, 0);
  const late = hit(practiceCourse());
  for (let i = 0; i < Math.round((BOOST.practiceRecoverWindow + 0.05) / DT); i++) step(late, {}, DT);
  assert.equal(canRecover(late), false, "but not forever");
});

test("the course has a flat and a mountain: a chain of rock-free bumps mid-run, then a denser rocky finish (2026-11-13)", () => {
  const sum = { before: 0, after: 0 };
  for (const course of [...COURSE_PACKS.map(pack => buildCourse({ id: pack.id })), ...Array.from({ length: 30 }, (_, i) => generateCourse(i + 1))]) {
    const bumps = course.features.filter(f => f.kind === "bump"), rocks = course.features.filter(f => f.kind === "rock");
    // 連続起伏: chainGap おきに chainCount 個。間と着地帯に岩が無い
    const start = bumps.find((b, i) => Array.from({ length: LAYOUT.chainCount }, (_, k) => bumps[i + k]?.z === b.z + LAYOUT.chainGap * k).every(Boolean));
    assert(start, `${course.id} has a chain of ${LAYOUT.chainCount} bumps`);
    const from = start.z, to = start.z + LAYOUT.chainGap * (LAYOUT.chainCount - 1) + LAYOUT.landing;
    assert(from / course.length >= LAYOUT.chainFrom && from / course.length < LAYOUT.chainFrom + 0.12, `${course.id}: the chain starts mid-run (${from})`);
    assert(!rocks.some(r => r.z > from && r.z < to), `${course.id}: no rock inside the chain`);
    // 山: 連続起伏の先は、手前より岩が詰まっている（100m あたりの岩の数）。本番の4本はどれも。乱数の30本は平均で
    const density = (a, b) => rocks.filter(r => r.z >= a && r.z < b).length / (b - a) * 100;
    const before = density(LAYOUT.start, from), after = density(to, course.length - 100);
    if (COURSE_PACKS.some(pack => pack.id === course.id)) assert(after > before, `${course.id}: the finish is rockier than the run-up (${before.toFixed(2)} → ${after.toFixed(2)})`);
    sum.before += before; sum.after += after;
  }
  assert(sum.after > sum.before * 1.3, `on average the finish is clearly rockier (${sum.before.toFixed(1)} → ${sum.after.toFixed(1)})`);
  // 起伏の間隔は、通常の最高速の大ジャンプの飛距離より長い（着地してから次を押せる）
  const flight = SPEED.max * JUMP.bigAir * (JUMP.airFloor + JUMP.airGain);
  assert(LAYOUT.chainGap > flight + SPEED.max * 0.5, `chain gap ${LAYOUT.chainGap} leaves half a second after a ${flight.toFixed(0)}m flight`);
});

test("the single course rates S / A / B / C by skill: spins = S, clean landings without spins = A, late landings = B, no jumps = C, clumsy = C", () => {
  const course = generateCourse(DEFAULT_SEED);
  const run = skill => summary(play(course, skill, { race: true }));
  const expert = run("expert"), perfect = run("perfect"), good = run("good"), none = run("none"), lazy = run("lazy");
  for (const result of [expert, perfect, good, none, lazy]) {
    assert.equal(result.finished, true);
    assert(result.time >= 50 && result.time <= 85, `a run takes about a minute (${result.time}s; 2026-11-13 に 2,000m へ延ばした)`);
  }
  assert.equal(expert.falls, 0, "the course can be finished without any fall, spinning on every jump");
  assert.equal(perfect.falls, 0);
  assert(expert.tricks >= 5 && expert.bestTrick >= 720 && expert.boosts >= 2, "the expert spins and boosts");
  assert.equal(perfect.tricks, 0, "the perfect rider never spins");
  assert.equal(expert.rank, "S");
  assert.equal(perfect.rank, "A", "S needs spins");
  assert.equal(good.rank, "B");
  assert.equal(none.rank, "C");
  assert.equal(lazy.rank, "C");
  assert(expert.score > perfect.score && perfect.score > good.score && good.score > none.score && none.score > lazy.score);
  // ヌールとの競走: 着地を決めてブーストを使えば勝てる。ヌールと同じ滑り（着地が遅い）では届かない。跳ばないと負ける
  assert.equal(expert.race.won, true); assert.equal(perfect.race.won, true);
  assert.equal(good.race.won, false); assert.equal(none.race.won, false);
  // 同じ seed・同じ操作なら同じ結果
  assert.deepEqual(run("expert"), expert);
  // 2026-11-13 にコースを組み替えた（最初の起伏・連続起伏・終盤の山）ので、不器用な人は本番の4本で見る: どれも完走して C、どこかで転ぶ
  const clumsy = COURSE_PACKS.map(pack => summary(play(buildCourse({ id: pack.id }), "lazy", { race: true })));
  for (const result of clumsy) { assert.equal(result.finished, true); assert.equal(result.rank, "C"); }
  assert(clumsy.some(result => result.falls >= 1), "the clumsy rider falls but still finishes");
  assert.deepEqual(RANKS.map(([rank]) => rank), ["S", "A", "B", "C"]);
  assert.equal(rankOf(RANKS[0][1]), "S"); assert.equal(rankOf(RANKS[0][1] - 1), "A"); assert.equal(rankOf(0), "C");
  assert.equal(comboMultiplier(0), 1); assert.equal(comboMultiplier(100), SCORE.comboMax);
});

test("every generated course up to seed 30 can be finished by the ideal rider without a fall (no unfair layouts)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const skill of ["expert", "perfect"]) {
      const result = summary(play(generateCourse(seed), skill));
      assert.equal(result.finished, true, `seed ${seed} finishes`);
      assert.equal(result.falls, 0, `seed ${seed} has no unavoidable rock (${skill})`);
    }
    assert.equal(rivalRun(generateCourse(seed)).falls, 0, `Noor never falls on seed ${seed}`);
  }
});

test("summary and readResult keep only well-formed finished records", () => {
  const game = play(generateCourse(DEFAULT_SEED), "expert", { race: true });
  const result = summary(game);
  assert.deepEqual(readResult(result), { rulesVersion: RULES_VERSION, finished: true, score: result.score, rank: result.rank, time: result.time, maxCombo: result.maxCombo,
    falls: result.falls, bigJumps: result.bigJumps, perfect: result.perfect, good: result.good, nearMiss: result.nearMiss,
    tricks: result.tricks, bestTrick: result.bestTrick, boosts: result.boosts, race: { won: true, gap: result.race.gap, who: "noor" } });
  // 以前の形の記録（トリック・ブースト・競走が無い）も読める
  assert.deepEqual(readResult({ finished: true, score: 9000, rank: "A", time: 55, maxCombo: 3, falls: 0 }),
    { finished: true, score: 9000, rank: "A", time: 55, maxCombo: 3, falls: 0, bigJumps: 0, perfect: 0, good: 0, nearMiss: 0, tricks: 0, bestTrick: 0, boosts: 0, race: null });
  assert.equal(readResult({ ...result, finished: false }), null);
  assert.equal(readResult({ ...result, rank: "Z" }), null);
  assert.equal(readResult({ ...result, score: -1 }), null);
  assert.equal(readResult(null), null);
  assert.equal(readResult({ ...result, rulesVersion: 99 }), null, "unknown scoring versions must not become legacy records");
  const unfinished = summary(createGame(generateCourse(DEFAULT_SEED)));
  assert.equal(unfinished.finished, false); assert.equal(unfinished.rank, null);
  assert.equal(summary(play(practiceCourse(), "perfect")).score, 0, "practice has no score");
});

test("air spins: hold ← or → in a big jump to rotate, letting go finishes the half turn, landing mid-spin is a fall", () => {
  const course = generateCourse(DEFAULT_SEED);
  // 跳んだ瞬間から押していた向きでは回らない（よけながら跳んだだけで回らない）。一度離して押すと回る
  let game = createGame(course);
  jumpAtNextBump(game);
  for (let i = 0; i < 10; i++) step(game, { right: true }, DT);
  assert.equal(game.spinDir, 0, "the key held at take-off does not spin");
  step(game, {}, DT);
  const twin = structuredClone(game); // 同じ状態で何も押さない方と比べる
  for (let i = 0; i < 20; i++) { step(game, { right: true }, DT); step(twin, {}, DT); }
  assert.equal(game.spinDir, 1);
  assert(game.rot > 0.4 && game.rot < 0.7, `about ${SPIN.rate * 20 / 60} turns (${game.rot})`);
  assert(Math.abs(game.x - twin.x) < 1e-9, "the spin key does not steer");
  while (game.air > 0) step(game, {}, DT); // 離すと 360 まで回り切って着地
  const trick = game.events.find(e => e.kind === "trick");
  assert.deepEqual({ degrees: trick.degrees, half: trick.half }, { degrees: 360, half: 2 });
  assert.equal(game.stats.tricks, 1); assert.equal(game.stats.bestTrick, 360);
  assert.equal(game.falls, 0);
  assert(trick.points >= SPIN.points[2], "a 360 scores");
  assert.equal(game.rot, 0, "the board faces forward again");
  // 着地の直前に回り始めると回り切れずに転倒（ゲージも減る）
  game = createGame(course);
  hold(game, 0.5);
  jumpAtNextBump(game);
  step(game, {}, DT);
  while (game.air > 0.2) step(game, {}, DT);
  while (game.air > 0) step(game, { left: true }, DT); // 約 1/3 回転のところで着地
  assert.equal(game.falls, 1);
  assert.equal(game.events.at(-1).kind, "fall"); assert.equal(game.events.at(-1).reason, "spin");
  assert.equal(game.stats.spinFalls, 1);
  assert.equal(game.gauge, 0.25, "a fall drains the gauge but retains half");
  // 小さなホップでは回らない
  game = createGame(course);
  step(game, {}, DT); press(game); step(game, {}, DT);
  for (let i = 0; i < 10; i++) step(game, { right: true }, DT);
  assert.equal(game.spinDir, 0);
});

test("boost: the gauge fills from near misses, successful big landings and spins; when full it lifts the top speed and smashes rocks", () => {
  const course = generateCourse(DEFAULT_SEED);
  const game = createGame(course);
  assert.equal(boost(game), null, "an empty gauge cannot boost");
  chargeBoost(game, 0.6); chargeBoost(game, 0.6);
  assert.equal(game.gauge, 1);
  assert.equal(game.events.filter(e => e.kind === "gaugeFull").length, 1, "full is announced once");
  assert.equal(boost(game), "boost");
  assert.equal(game.gauge, 0); assert.equal(game.stats.boosts, 1);
  assert.equal(boost(game), null, "no double boost");
  for (let i = 0; i < 120; i++) step(game, {}, DT);
  assert(game.speed > SPEED.max + 5, `boost goes past the normal top speed (${game.speed})`);
  assert(game.speed <= SPEED.boost);
  assert(smashing(game));
  // ブースト中は岩に当たっても転ばず砕く
  const rock = course.features.find(f => f.kind === "rock" && f.z > game.z + 10);
  game.boostT = 5;
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, 0);
  assert.equal(game.stats.smashed, 1);
  assert(game.smashedRocks.has(rock));
  assert(game.events.some(e => e.kind === "smash" && e.points === SCORE.smash));
  // 終わると少しずつ最高速へ戻る
  game.boostT = 0.01; step(game, {}, DT);
  assert(game.events.some(e => e.kind === "boostEnd"));
  for (let i = 0; i < 180; i++) step(game, {}, DT);
  assert(game.speed <= SPEED.max + 1e-9);
  // かすめ・大ジャンプ・完璧な着地で貯まる
  const fill = createGame(course);
  jumpAtNextBump(fill);
  assert.equal(fill.gauge, 0, "takeoff alone cannot recover boost");
  while (fill.air > JUMP.landingWindow * 0.5) step(fill, {}, DT);
  press(fill);
  while (fill.air > 0) step(fill, {}, DT);
  assert(Math.abs(fill.gauge - (BOOST.land + BOOST.perfect) * CHARGE) < 1e-9);
});

test("boost spends any stocked gauge proportionally, even during recovery or an active boost", () => {
  const game = createGame(generateCourse(DEFAULT_SEED));
  chargeBoost(game, 0.4);
  game.fallT = 0.5;
  assert.equal(boost(game), "boost");
  assert.equal(game.gauge, 0);
  assert(Math.abs(game.boostT - BOOST.duration * 0.4) < 1e-9);
  game.fallT = 0;
  chargeBoost(game, 0.2);
  assert.equal(boost(game), "boost");
  assert(Math.abs(game.boostT - BOOST.duration * 0.6) < 1e-9);
  assert.equal(game.stats.boosts, 2);
  assert.equal(boost(game), null, "spent stock cannot be used again");
});

test("race: Noor runs the same course deterministically; finishing first wins a bonus; the result keeps the gap", () => {
  const course = generateCourse(DEFAULT_SEED);
  const a = rivalRun(course), b = rivalRun(course);
  assert.equal(a.finishTime, b.finishTime);
  assert.equal(a.falls, 0);
  assert(a.finishTime > 45 && a.finishTime < 60, `Noor takes about a minute (${a.finishTime})`);
  const start = rivalAt(a, 0), mid = rivalAt(a, 20), end = rivalAt(a, a.finishTime + 3);
  assert.equal(start.z, 0); assert(start.x < -0.3, "Noor starts on the left");
  assert(mid.z > 300 && mid.z < course.length);
  assert(end.finished && end.z >= course.length, "after the goal she coasts past the flags");
  assert(rivalAt(a, 10).z < rivalAt(a, 10.5).z, "she keeps moving");
  // 速くゴールすれば勝ち。加点と差が残る
  const win = createGame(course, { rival: { ...a, finishTime: 999 } });
  win.z = course.length - 0.1; step(win, {}, DT);
  assert.equal(win.race.won, true);
  assert(win.events.some(e => e.kind === "race" && e.won && e.points === SCORE.raceWin));
  const lose = createGame(course, { rival: { ...a, finishTime: 0.01 } });
  lose.z = course.length - 0.1; lose.t = 0.4; step(lose, {}, DT);
  assert.equal(lose.race.won, false);
  assert(Math.abs(win.score - lose.score - SCORE.raceWin) <= SCORE.timeBonusPerSec, "the winner gets the race bonus");
  assert.equal(summary(createGame(course)).race, null, "no rival, no race");
});

test("the hidden rival Naru (after beating Noor) spins 360s, lands clean and boosts: only a spinning run beats him", () => {
  const course = generateCourse(DEFAULT_SEED);
  assert.deepEqual(Object.keys(RIVALS), ["noor", "naru"]);
  const noor = rivalRun(course), naru = rivalRun(course, { who: "naru" });
  assert.equal(noor.who, "noor"); assert.equal(naru.who, "naru");
  assert.equal(naru.falls, 0);
  assert(naru.finishTime < noor.finishTime - 2, `Naru is clearly faster (${naru.finishTime} vs ${noor.finishTime})`);
  assert.equal(rivalRun(course, { who: "naru" }).finishTime, naru.finishTime, "deterministic");
  assert(rivalAt(naru, 0).x > 0.3, "Naru starts on the right");
  const race = skill => { const game = createGame(course, { rival: naru }), memo = {}; while (!game.finished && game.t < 200) botStep(game, skill, memo, DT); return game; };
  const expert = race("expert"), perfect = race("perfect");
  assert.equal(expert.race.won, true); assert.equal(expert.race.who, "naru");
  assert.equal(perfect.race.won, false, "clean landings without spins are not enough");
  assert(expert.events.some(e => e.kind === "race" && e.points === SCORE.raceWinNaru));
  assert.deepEqual(readResult(summary(expert)).race, { won: true, gap: expert.race.gap, who: "naru" });
  for (let seed = 1; seed <= 30; seed++) assert.equal(rivalRun(generateCourse(seed), { who: "naru" }).falls, 0, `Naru never falls on seed ${seed}`);
});

test("the adopted Codex art (PR #2306, #2333) matches its adoption record: sizes, anchors and runtime files", async () => {
  const { readFileSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  // CI の quick は画像を checkout しない（sparse）。存在は git の索引で確かめる
  const tracked = path => execFileSync("git", ["ls-files", "--", path], { cwd: new URL("../../", import.meta.url) }).toString().trim() === path;
  const { DESERT_ART, DESERT_BG, DESERT_DUSK_BG, loadDesertArt } = await import("../js/minigames/desert-ride-art.js");
  const root = new URL("../../", import.meta.url);
  const record = JSON.parse(readFileSync(new URL("asset_sources/desert-ride-2306/adoption.json", root), "utf8"));
  const pairs = { sky: record.backdrop.sky, land: record.backdrop.land, rider: record.rider_ride, rockLarge: record.rock_large, rockSmall: record.rock_small,
    flag: record.flag_pole, goal: record.goal_banner, puff: record.sand_puff, duskSky: record.backdrop_dusk.sky, duskLand: record.backdrop_dusk.land,
    riderLeft: record.rider_lean_left, riderRight: record.rider_lean_right, riderJump: record.rider_jump, riderBrace: record.rider_brace, riderFall: record.rider_fall };
  for (const [name, entry] of Object.entries(pairs)) {
    assert.equal(`remake/img/${DESERT_ART[name].file}`, entry.webp, `${name} file`);
    assert.deepEqual([...DESERT_ART[name].size], entry.size, `${name} size`);
    assert(tracked(entry.webp) && tracked(entry.png), `${name} files are committed`);
  }
  const { width, height, horizon, duneTop, landTop } = record.backdrop;
  assert.deepEqual({ ...DESERT_ART.backdrop }, { width, height, horizon, duneTop });
  assert.equal(DESERT_ART.land.top, landTop);
  assert.deepEqual({ ...DESERT_ART.rider.anchor }, { x: record.rider_ride.anchor.x, y: record.rider_ride.anchor.y });
  // 背面の差分は背面Bと同じ縮尺で、姿勢ごとの基準点を持つ
  for (const [name, key] of [["riderLeft", "rider_lean_left"], ["riderRight", "rider_lean_right"], ["riderJump", "rider_jump"], ["riderBrace", "rider_brace"], ["riderFall", "rider_fall"]]) {
    assert.deepEqual({ ...DESERT_ART[name].anchor }, record[key].anchor, `${name} anchor`);
    assert(record[key].scale > 0.5 && record[key].scale < 0.6 && DESERT_ART[name].size[1] < 800, `${name} keeps the rider scale`);
  }
  assert.deepEqual([...DESERT_ART.duskSky.size], [...DESERT_ART.sky.size], "the dusk backdrop has the day geometry");
  assert.equal(DESERT_ART.duskLand.top, landTop);
  assert.deepEqual({ ...DESERT_ART.flag.foot }, record.flag_pole.foot);
  // 会話の背景は manifest の背景一覧と WebP 一覧に入っている
  const manifest = JSON.parse(readFileSync(new URL("remake/data/manifest.json", root), "utf8"));
  assert(manifest.backgrounds.includes(`${DESERT_BG}.png`) && manifest.webp.includes(`backgrounds/${DESERT_BG}.png`));
  for (const bg of [DESERT_BG, DESERT_DUSK_BG]) {
    assert(manifest.backgrounds.includes(`${bg}.png`) && manifest.webp.includes(`backgrounds/${bg}.png`), bg);
    assert(tracked(`remake/img/backgrounds/${bg}.webp`) && tracked(`assets/backgrounds/${bg}.png`), bg);
  }
  // ヌールの立ち絵は normal A（2026-11-02 オーナー選定）。立ち絵の一覧と顔アイコンに入っている
  assert.equal(record.noor_normal.raw, "raw/phase4/noor-candidates/noor_normal_A-raw.png");
  assert.deepEqual(record.noor_normal.size, [896, 1200]);
  // 表情差分（第5弾）は normal と同じ切り抜き・倍率・位置で置く
  assert.deepEqual(Object.keys(record.noor_normal.faces), ["smile", "surprise"]);
  assert.deepEqual(record.noor_normal.faces.smile.raw, "raw/phase5/noor_smile-raw.png");
  assert.deepEqual(manifest.portraits.noor.faces, ["normal", "smile", "surprise"]);
  assert(manifest.faceIcons.includes("face_noor.png") && tracked("assets/ui/face_icons/face_noor.png"));
  for (const face of ["normal", "smile", "surprise"]) assert(tracked(`assets/sprites/characters/noor/chr_noor_${face}.png`), face);
  const noor = JSON.parse(readFileSync(new URL("data/characters.json", root), "utf8")).find(c => c.id === "noor");
  assert.equal(noor.spriteScale, 0.977, "168cm / 172cm");
  // Node（Image の無い環境）では何も読まず、図形で描く側へ落ちる
  assert.equal(loadDesertArt().get("rider"), null);
});

test("the rider pose follows the run: lean with hysteresis, jump, brace before and just after landing, fall", async () => {
  const { riderPose } = await import("../js/minigames/desert-ride-art.js");
  const course = generateCourse(DEFAULT_SEED);
  const game = createGame(course);
  assert.equal(riderPose(game), "rider");
  game.vx = 0.4; assert.equal(riderPose(game), "riderRight", "screen right");
  game.vx = 0.25; assert.equal(riderPose(game, "riderRight"), "riderRight", "keeps the lean until it eases");
  assert.equal(riderPose(game, "rider"), "rider", "does not start a lean on a small drift");
  game.vx = -0.4; assert.equal(riderPose(game), "riderLeft", "screen left");
  game.vx = 0;
  while (nextBumpDistance(game) > game.speed * JUMP.bumpWindow * 0.5) step(game, {}, DT);
  press(game);
  assert.equal(riderPose(game), "riderJump");
  while (game.air > JUMP.landingWindow * 0.5) step(game, {}, DT);
  press(game);
  assert.equal(riderPose(game), "riderBrace", "bracing for the landing");
  while (game.air > 0) step(game, {}, DT);
  assert.equal(riderPose(game), "riderBrace", "holds the brace just after landing");
  for (let i = 0; i < 15; i++) step(game, {}, DT);
  assert.equal(riderPose(game), "rider");
  game.fallT = 1; assert.equal(riderPose(game), "riderFall");
  game.fallT = 0.2; assert.notEqual(riderPose(game), "riderFall", "getting up");
  game.fallT = 0; game.air = 0.2; game.airTotal = 0.26; game.airKind = "bounce";
  assert.equal(riderPose(game), "rider", "a small bounce over a bump keeps the riding pose");
});



test("repeated flat hops cannot farm score, combo, speed or gauge, including the deep sand edge", () => {
  const course = { length: 10000, features: [], curves: [{ z: 0, c: 0 }], practice: false };
  for (const x of [0, 1]) {
    const game = createGame(course), grounded = createGame(course);
    game.x = grounded.x = x;
    for (let i = 0; i < 1800; i++) {
      if (game.air <= 0 || game.air <= JUMP.landingWindow * 0.5) press(game);
      step(game, {}, DT); step(grounded, {}, DT);
      assert.equal(game.speed, grounded.speed, "hops do not accelerate or escape edge drag");
      assert.equal(game.z, grounded.z);
    }
    assert(game.stats.hops > 40);
    assert.equal(game.score, 0); assert.equal(game.combo, 0); assert.equal(game.gauge, 0);
    assert.equal(game.stats.perfect, 0); assert.equal(game.stats.good, 0);
  }
});

test("landing recovery is capped, awarded once and absent on a failed spin or bounce", () => {
  for (const [grade, braceAt, gain] of [["plain", null, BOOST.land * CHARGE], ["good", 0.45, (BOOST.land + BOOST.good) * CHARGE]]) {
    const game = createGame(generateCourse(DEFAULT_SEED));
    jumpAtNextBump(game);
    if (braceAt !== null) { while (game.air > braceAt) step(game, {}, DT); press(game); }
    while (game.air > 0) step(game, {}, DT);
    assert.equal(game.events.find(e => e.kind === "land").grade, grade);
    assert(Math.abs(game.gauge - gain) < 1e-9);
  }
  for (const initial of [0, 0.99, 1]) {
    const game = createGame(generateCourse(DEFAULT_SEED));
    hold(game, initial); jumpAtNextBump(game);
    assert.equal(game.gauge, initial);
    while (game.air > JUMP.landingWindow * 0.5) step(game, {}, DT);
    press(game); press(game);
    while (game.air > 0) step(game, {}, DT);
    const expected = Math.min(1, initial + (BOOST.land + BOOST.perfect) * CHARGE);
    assert(Math.abs(game.gauge - expected) < 1e-9);
    const landing = game.events.find(e => e.kind === "land" && e.grade === "perfect");
    assert(Math.abs(landing.gaugeGained - (expected - initial)) < 1e-9);
    for (let i = 0; i < 5; i++) step(game, {}, DT);
    assert(Math.abs(game.gauge - expected) < 1e-9, "the reward is not repeated");
  }
});

test("360-only clean runs keep S without making a no-spin run S", () => {
  const course = generateCourse(DEFAULT_SEED), game = createGame(course, { rival: rivalRun(course) }), memo = { only360: true };
  while (!game.finished && game.t < 200) botStep(game, "expert", memo, DT);
  assert.equal(summary(game).bestTrick, 360); assert.equal(summary(game).rank, "S");
  assert.equal(summary(play(course, "perfect", { race: true })).rank, "A");
});



test("take-off speed raises big jumps and hops through boost speed, without moving the landing window", () => {
  const course = { length: 500, features: [{ kind: "bump", z: 0, x: 0, w: 1 }], curves: [{ z: 0, c: 0 }, { z: 1000, c: 0 }] };
  for (const kind of ["big", "hop"]) {
    let previous = 0;
    for (const speed of [0, SPEED.min, SPEED.start, 24, SPEED.max, 40, SPEED.boost]) {
      const game = createGame(kind === "big" ? course : { ...course, features: [] });
      game.speed = speed;
      assert.equal(press(game), kind);
      assert(game.airPeak > previous, `${kind} gets higher at ${speed}m/s`);
      previous = game.airPeak;
      const expectedTime = kind === "big" ? JUMP.bigAir * (JUMP.airFloor + JUMP.airGain * Math.min(1, speed / SPEED.max)) : JUMP.hopAir;
      assert.equal(game.airTotal, expectedTime, "the configured airtime applies at take-off");
      assert.equal(jumpHeight(game), 0, "starts on the ground");
      game.air = game.airTotal / 2;
      assert.equal(jumpHeight(game), game.airPeak, "the model trajectory reaches the take-off peak");
      const height = jumpHeight(game);
      game.speed = SPEED.min; game.boostT = 0;
      assert.equal(jumpHeight(game), height, "boost ending cannot lower an airborne rider abruptly");
      chargeBoost(game, 1); boost(game);
      assert.equal(jumpHeight(game), height, "midair boost cannot teleport the rider up");
      game.air = 0;
      assert.equal(jumpHeight(game), 0, "ends on the ground");
    }
  }
  assert.equal(jumpPeak(-100), jumpPeak(0));
  assert.equal(jumpPeak(NaN), jumpPeak(0));
  assert.equal(jumpPeak(SPEED.boost * 100), jumpPeak(SPEED.boost));
  assert(jumpPeak(0) > 0, "zero-speed jump stays finite and nonzero");
  assert.equal(jumpPeak(0, "bounce"), jumpPeak(SPEED.boost, "bounce"), "unrequested bump bounce stays small");
  assert(JUMP.bigAir > 1.22 && JUMP.hopAir > 0.53, "both deliberate jumps stay airborne longer");
  assert(jumpPeak(SPEED.start) > 2 && jumpPeak(SPEED.start, "hop") > 0.9, "both leave the ground with a stronger arc");
});

test("rival playback preserves the same speed-based jump height", () => {
  for (const who of ["noor", "naru"]) {
    const run = rivalRun(generateCourse(DEFAULT_SEED), { who });
    const airborne = run.samples.filter(s => s.airKind === "big" && s.air > 0);
    assert(airborne.length > 0);
    assert(airborne.every(s => Number.isFinite(jumpHeight(s)) && jumpHeight(s) >= 0 && jumpHeight(s) <= jumpPeak(SPEED.boost)));
    const sample = airborne[Math.floor(airborne.length / 2)];
    const replay = rivalAt(run, sample.t);
    assert(Number.isFinite(replay.airPeak) && Number.isFinite(jumpHeight(replay)));
    assert.equal(jumpHeight(rivalAt(run, run.finishTime + 1)), 0);
  }
});


test("course packs are 4 distinct layouts of the same length, picked deterministically from a run seed", () => {
  assert.equal(COURSE_PACKS.length, 4);
  assert.deepEqual(COURSE_PACKS.map(p => p.id), ["ridge", "left-bowl", "right-crest", "switchback"]);
  const ridge = buildCourse({ id: "ridge" });
  const fromSeed = generateCourse(DEFAULT_SEED);
  assert.equal(ridge.id, "ridge");
  assert.deepEqual(ridge.features, fromSeed.features);
  assert.deepEqual(ridge.curves, fromSeed.curves);
  assert.equal(ridge.length, COURSE.length);
  const ids = new Set(), names = new Set();
  for (const pack of COURSE_PACKS) {
    const a = buildCourse({ id: pack.id }), b = buildCourse({ id: pack.id });
    assert.equal(a.length, COURSE.length);
    assert.equal(a.id, pack.id);
    assert.equal(a.name, pack.name);
    assert.deepEqual(a.features, b.features);
    assert.deepEqual(a.curves, b.curves);
    ids.add(a.id); names.add(a.name);
    const bumps = a.features.filter(f => f.kind === "bump"), rocks = a.features.filter(f => f.kind === "rock");
    assert(bumps.length >= 5 && rocks.length >= 10, `${pack.id} has enough features`);
  }
  assert.equal(ids.size, 4); assert.equal(names.size, 4);
  // same seed always the same pack; a different seed can pick another
  assert.equal(pickCourse(1).id, pickCourse(1).id);
  assert.deepEqual(pickCourse(1).features, pickCourse(1).features);
  const seen = new Set(Array.from({ length: 40 }, (_, i) => pickCourse(i + 1).id));
  assert.equal(seen.size, 4, "a spread of run seeds covers every pack");
});

test("curve offset math eases in and out, stays in range, and is zero at the rider", () => {
  const course = { length: 1000, curves: [{ z: 0, c: 0 }, { z: 200, c: 0 }, { z: 400, c: 1 }, { z: 600, c: 1 }, { z: 800, c: 0 }, { z: 1400, c: 0 }] };
  // decorate via build of a disposable object through generate + replace is heavy; use a helper course from buildCourse and also raw curveAt
  const baked = buildCourse({ id: "ridge" });
  assert.equal(curveAt(baked, 0), 0);
  assert.equal(headingAt(baked, 0), 0);
  assert.equal(offsetAt(baked, 0), 0);
  assert.equal(lateralAt(baked, 300, 300), 0);
  assert.equal(lateralAt(baked, baked.length + 100, baked.length + 100), 0);
  for (let z = 0; z < baked.length; z += 11) {
    assert(Math.abs(curveAt(baked, z)) <= 1 + 1e-9);
    assert.equal(lateralAt(baked, z, z), 0);
  }
  // smoothstep between keys: mid-point of a 0→1 rise is 0.5, quarter is 0.15625
  assert.equal(curveAt(course, 200), 0);
  assert.equal(curveAt(course, 400), 1);
  assert(Math.abs(curveAt(course, 300) - 0.5) < 1e-9, "midpoint of the ease is 1/2");
  assert(Math.abs(curveAt(course, 250) - 0.15625) < 1e-9, "quarter uses smoothstep");
  // a constant-c stretch accumulates heading ≈ c * scale * distance
  const left = buildCourse({ id: "left-bowl" }), right = buildCourse({ id: "right-crest" });
  assert(upcomingCurve(left, 260) < 0, "a left bowl warns of a left bend");
  assert(upcomingCurve(right, 260) > 0, "a right crest warns of a right bend");
  assert.equal(upcomingCurve(left, 700), 0, "already in the bend, no new hint");
  // authored left/right packs are mirrors in curvature
  for (let z = 0; z < left.length; z += 17) {
    assert(Math.abs(curveAt(left, z) + curveAt(right, z)) < 1e-9, `mirror at ${z}`);
    assert(Math.abs(headingAt(left, z) + headingAt(right, z)) < 1e-6);
    assert(Math.abs(lateralAt(left, z + 80, z) + lateralAt(right, z + 80, z)) < 1e-5);
  }
  // heading grows in the direction of a sustained curve
  assert(headingAt(left, 900) < headingAt(left, 500));
  assert(Math.abs(headingAt(left, 900)) > 0.3);
});

test("every course pack can be finished by the ideal rider without a fall", () => {
  for (const pack of COURSE_PACKS) {
    const course = buildCourse({ id: pack.id });
    for (const skill of ["expert", "perfect"]) {
      const result = summary(play(course, skill));
      assert.equal(result.finished, true, `${pack.id} finishes (${skill})`);
      assert.equal(result.falls, 0, `${pack.id} has no unavoidable rock (${skill})`);
      assert.equal(result.courseId, pack.id);
    }
    assert.equal(rivalRun(course).falls, 0, `Noor never falls on ${pack.id}`);
    assert.equal(rivalRun(course, { who: "naru" }).falls, 0, `Naru never falls on ${pack.id}`);
  }
});

test("boost during the hit window cancels the stumble; an empty gauge or a late press does not", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rock = course.features.find(f => f.kind === "rock");
  // hit + boost with gauge: recover, keep speed, spend the gauge, no fall on the result
  let game = createGame(course);
  game.combo = 4; game.score = 1000;
  chargeBoost(game, 0.8);
  while (game.z < rock.z - 30) step(game, {}, DT);
  const speedBefore = game.speed, comboBefore = game.combo, scoreBefore = game.score;
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, 1);
  assert(game.fallT > 0);
  assert.equal(canRecover(game), true);
  assert.equal(boost(game), "recover");
  assert.equal(game.fallT, 0);
  assert.equal(game.falls, 0);
  assert.equal(game.combo, comboBefore);
  assert.equal(game.score, scoreBefore);
  assert(game.speed >= speedBefore - 1e-9, "recovery keeps the pre-hit speed");
  assert.equal(game.gauge, 0);
  assert(game.boostT > 0);
  assert.equal(game.stats.recoveries, 1);
  assert.equal(game.stats.boosts, 1);
  assert(game.events.some(e => e.kind === "recover"));
  assert.equal(canRecover(game), false);
  assert.equal(boost(game), null, "the spent gauge cannot recover again");
  // hit without gauge: normal fall, boost does nothing
  game = createGame(course);
  game.combo = 3; game.score = 500;
  assert.equal(game.gauge, 0);
  while (game.z < rock.z - 20) step(game, {}, DT);
  const midSpeed = game.speed;
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, 1);
  assert.equal(canRecover(game), false);
  assert.equal(boost(game), null);
  assert(game.fallT > 0);
  assert(game.speed <= (midSpeed + SPEED.accel * 2) * SPEED.fallFactor + 1e-9);
  assert.equal(game.combo, 0);
  assert.equal(game.score, 500 + FALL.points);
  assert.equal(game.stats.recoveries, 0);
  // timing window: a boost after recoverWindow is a normal boost, the stumble remains
  game = createGame(course);
  chargeBoost(game, 0.7);
  while (game.z < rock.z - 20) step(game, {}, DT);
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(canRecover(game), true);
  const after = BOOST.recoverWindow + 0.05;
  for (let i = 0; i < Math.ceil(after / DT); i++) step(game, {}, DT);
  assert.equal(canRecover(game), false, "the window has closed");
  assert(game.fallT > 0, "the rider is still down");
  assert.equal(boost(game), "boost");
  assert(game.fallT > 0, "a late boost does not stand the rider up");
  assert.equal(game.falls, 1);
  assert.equal(game.stats.recoveries, 0);
  // a spin fall cannot be recovered
  game = createGame(course);
  game.gauge = 0.5;
  jumpAtNextBump(game);
  step(game, {}, DT);
  while (game.air > 0.2) step(game, {}, DT);
  while (game.air > 0) step(game, { left: true }, DT);
  assert.equal(game.events.at(-1).reason, "spin");
  assert.equal(canRecover(game), false);
  assert.equal(boost(game), "boost");
  assert(game.fallT > 0);
});

// ---- 2026-11-11: カーブの手応え（外へ流される・切り込むと踏ん張れてゲージが貯まる） ----

/** まっすぐな 1000m の中に、曲がり c の区間（200〜800m）を持つコース。岩も起伏も無い。 */
function curveOnly(c) {
  const base = buildCourse({ id: "left-bowl" });
  return { ...base, features: [], curves: [{ z: 0, c: 0 }, { z: 120, c: 0 }, { z: 200, c }, { z: 800, c }, { z: 880, c: 0 }, { z: 2400, c: 0 }] };
}

test("a curve pushes the board outward; steering into it holds the line, and the straight has no push", () => {
  const drift = (c, input) => {
    const game = createGame(curveOnly(c));
    while (game.z < 320) step(game, {}, DT);
    game.x = 0; game.vx = 0; game.speed = SPEED.max;
    for (let i = 0; i < 60; i++) step(game, input, DT);
    return game;
  };
  const right = drift(1, {}), left = drift(-1, {});
  assert(right.x < -0.15 && right.x > -0.4, `a right curve carries an idle rider left, gently (${right.x})`);
  assert(Math.abs(right.x + left.x) < 1e-9, "left and right curves mirror");
  assert.equal(right.carving, false);
  // 何もしないと、やがて端の深い砂に出て遅くなる
  const idle = drift(1, {}); for (let i = 0; i < 300; i++) step(idle, {}, DT);
  assert(idle.x < -EDGE && idle.stats.edgeTime > 0, "an idle rider ends up in the deep sand outside the curve");
  // 曲がる向きへ切っている間は流されない（直線と同じだけ動ける）
  const straight = createGame(curveOnly(0));
  while (straight.z < 320) step(straight, {}, DT);
  straight.x = 0; straight.vx = 0; straight.speed = SPEED.max;
  for (let i = 0; i < 30; i++) step(straight, { right: true }, DT);
  const into = createGame(curveOnly(1));
  while (into.z < 320) step(into, {}, DT);
  into.x = 0; into.vx = 0; into.speed = SPEED.max;
  for (let i = 0; i < 30; i++) step(into, { right: true }, DT);
  assert(Math.abs(into.x - straight.x) < 1e-9, "steering into the curve moves exactly like a straight");
  // 外へ切ると、流れが乗ってさらに速く外へ出る
  const away = createGame(curveOnly(1));
  while (away.z < 320) step(away, {}, DT);
  away.x = 0; away.vx = 0; away.speed = SPEED.max;
  for (let i = 0; i < 30; i++) step(away, { left: true }, DT);
  assert(away.x < -straight.x - 0.02, "steering away adds the drift");
  // 直線では流されない
  const flat = createGame(curveOnly(0));
  for (let i = 0; i < 600; i++) step(flat, {}, DT);
  assert.equal(flat.x, 0);
  assert(STEER.curveDrift >= 0.8 && STEER.curveDrift < STEER.accel / 2, "the push is felt but always weaker than the steering");
});

test("carving: steering into a curve on the ground charges the boost gauge and scores a little; nowhere else", () => {
  const start = c => { const game = createGame(curveOnly(c)); while (game.z < 320) step(game, {}, DT); game.x = 0; game.vx = 0; return game; };
  const carve = start(1);
  for (let i = 0; i < 30; i++) step(carve, { steer: 0.5 }, DT);
  assert.equal(carve.carving, true);
  assert(Math.abs(carve.gauge - CARVE.gaugePerSec * CHARGE * 0.5 * 0.5) < 1e-6, `half tilt for half a second charges a quarter of the rate (${carve.gauge})`);
  const full = start(1);
  for (let i = 0; i < 30; i++) step(full, { right: true }, DT);
  assert(Math.abs(full.gauge - CARVE.gaugePerSec * CHARGE * 0.5) < 1e-6, "full tilt charges at the full rate");
  // 0.8秒ぶん切り込むごとに少し得点（コンボは増やさない）
  const scored = start(1);
  while (scored.stats.carves < 1) { scored.x = 0; step(scored, { right: true }, DT); }
  const event = scored.events.find(e => e.kind === "carve");
  assert.equal(event.points, CARVE.points); assert.equal(event.dir, 1);
  assert.equal(scored.combo, 0, "carving does not build the combo");
  assert.equal(summary(scored).carves, 1);
  assert(Math.abs(scored.stats.carveTime - CARVE.tickSec) < 0.02);
  // 外へ切る・直線・空中・端の深い砂・転倒中は貯まらない
  const away = start(1);
  for (let i = 0; i < 30; i++) step(away, { left: true }, DT);
  assert.equal(away.gauge, 0); assert.equal(away.carving, false);
  const flat = start(0);
  for (let i = 0; i < 30; i++) step(flat, { right: true }, DT);
  assert.equal(flat.gauge, 0);
  const edge = start(1); edge.x = EDGE + 0.1;
  step(edge, { right: true }, DT);
  assert.equal(edge.gauge, 0, "no carving in the deep sand");
  const air = start(1); press(air); assert(air.air > 0);
  step(air, { right: true }, DT);
  assert.equal(air.gauge, 0, "no carving in the air");
  const down = start(1); down.fallT = 0.5;
  step(down, { right: true }, DT);
  assert.equal(down.gauge, 0, "no carving while down");
  // 満タンになった瞬間は、ほかの貯め方と同じく知らせる
  const fill = start(1); fill.gauge = 1 - 1e-4;
  step(fill, { right: true }, DT);
  assert.equal(fill.gauge, 1); assert(fill.events.some(e => e.kind === "gaugeFull"));
  // 保存する記録の形は変えない（結果画面だけに出す）
  assert.equal("carves" in readResult({ ...summary(play(generateCourse(DEFAULT_SEED), "perfect")) }), false);
});

test("the autopilot looks ahead: it holds its line through curves, never dithers in front of a rock, and spends the gauge without waste", () => {
  for (const pack of COURSE_PACKS) {
    const course = buildCourse({ id: pack.id });
    for (const skill of ["expert", "perfect", "good", "none"]) {
      const game = play(course, skill);
      assert.equal(game.falls, 0, `${skill} never falls on ${pack.id}`);
      assert(game.stats.edgeTime < 0.5, `${skill} stays out of the deep sand on ${pack.id} (${game.stats.edgeTime})`);
      if (skill !== "none") assert(game.gauge < 0.3, `${skill} spends the gauge before the goal on ${pack.id} (${game.gauge})`);
    }
  }
  for (let seed = 31; seed <= 60; seed++) {
    const course = generateCourse(seed);
    for (const skill of ["expert", "perfect"]) assert.equal(play(course, skill).falls, 0, `seed ${seed} (${skill})`);
    for (const who of ["noor", "naru"]) assert.equal(rivalRun(course, { who }).falls, 0, `${who} never falls on seed ${seed}`);
  }
  // 同じ状態からは同じ判断（決定的）
  const course = generateCourse(DEFAULT_SEED), a = createGame(course), b = createGame(course);
  assert.deepEqual(botControl(a, "perfect", {}), botControl(b, "perfect", {}));
});

test("rivals: Noor starts a touch quicker than the rider, Naru boosts and spins in the recorded run", () => {
  assert(RIVALS.noor.startSpeed > SPEED.start && RIVALS.noor.startSpeed < SPEED.start + 1.5);
  // 2026-11-13 オーナー「なるが弱かった」: なるは 720 まで回る腕前。出だしだけ少し遅くして、理想の滑りでやっと勝てる差にした
  // 2026-11-13「ライバルももっとブースト使って」: こまめに使う分だけ速くなるので、出だしをもう少し遅くした
  assert(RIVALS.naru.startSpeed < SPEED.start && RIVALS.naru.startSpeed >= SPEED.start - 3);
  assert.equal(RIVALS.naru.only360, false, "Naru spins up to 720");
  const course = generateCourse(DEFAULT_SEED), noor = rivalRun(course), naru = rivalRun(course, { who: "naru" });
  assert(rivalAt(noor, 1).z > rivalAt(naru, 1).z, "Noor is ahead of Naru off the line");
  assert(naru.samples.some(s => s.boostT > 0), "the playback knows when Naru is boosting (aura)");
  assert(naru.samples.some(s => Math.abs(s.rot) > 0.25), "the playback knows Naru's spin");
  assert(noor.samples.every(s => Math.abs(s.rot) < 1e-9), "Noor does not spin");
  const boosting = naru.samples.find(s => s.boostT > 1);
  assert(rivalAt(naru, boosting.t + 0.01).boostT > 0);
});

test("Naru's rider art (Issue #3222) is rebuilt to the protagonist's scale with board-centre anchors, and is committed", async () => {
  const { readFileSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const root = new URL("../../", import.meta.url);
  const tracked = path => execFileSync("git", ["ls-files", "--", path], { cwd: root }).toString().trim() === path;
  const { DESERT_ART, riderPose } = await import("../js/minigames/desert-ride-art.js");
  const record = JSON.parse(readFileSync(new URL("asset_sources/desert-ride-naru-3222/adoption.json", root), "utf8"));
  const names = { ride: "naruRider", lean_left: "naruRiderLeft", lean_right: "naruRiderRight", jump: "naruRiderJump", brace: "naruRiderBrace", fall: "naruRiderFall" };
  for (const [pose, name] of Object.entries(names)) {
    const entry = record[`rider_naru_${pose}`], art = DESERT_ART[name];
    assert.equal(`remake/img/${art.file}`, entry.webp, `${name} file`);
    assert.deepEqual([...art.size], entry.size, `${name} size`);
    assert.deepEqual({ ...art.anchor }, entry.anchor, `${name} anchor`);
    assert(entry.scale > 0.45 && entry.scale < 0.7, `${name} is downscaled from the raw art (${entry.scale})`);
    assert(art.size[1] > 600 && art.size[1] < 860, `${name} is about the protagonist's sprite height`);
    assert(tracked(entry.webp) && tracked(entry.raw), `${name} files are committed`);
  }
  // 走りの姿勢（riderPose）のどれにも、なるの絵がある（drawRival は `<相手>Rider…` を探す）
  const game = createGame(generateCourse(DEFAULT_SEED));
  for (const state of [{}, { vx: 0.5 }, { vx: -0.5 }, { air: 0.5, airTotal: 1, airKind: "big", landingPress: null }, { air: 0.2, airTotal: 1, airKind: "big", landingPress: 0.2 }, { fallT: 1 }]) {
    const pose = riderPose({ ...game, ...state });
    assert(DESERT_ART[pose.replace(/^rider/, "naruRider")], `Naru has art for ${pose}`);
  }
});

test("a close race: the rival eases off when far ahead and catches up when far behind, but the result stays the rider's skill", () => {
  // ずれの上限: 追いついた分は6割地点まで持てて、ゴール手前で 0。手加減は終盤に keep 秒まで戻す
  assert.equal(rubberCaps(0).lead, RUBBER.lead); assert.equal(rubberCaps(RUBBER.holdUntil).lead, RUBBER.lead);
  assert.equal(rubberCaps(RUBBER.settleAt).lead, 0); assert.equal(rubberCaps(1).lead, 0);
  assert.equal(rubberCaps(0.5).lag, RUBBER.lag); assert(Math.abs(rubberCaps(1).lag - RUBBER.keep) < 1e-9);
  for (const pack of COURSE_PACKS) {
    const course = buildCourse({ id: pack.id });
    for (const who of ["noor", "naru"]) {
      const rival = rivalRun(course, { who });
      for (const skill of ["expert", "perfect", "good", "none"]) {
        const game = createGame(course, { rival }), memo = {};
        let behindRaw = 0, behind = 0, earlyRaw = 0, early = 0, maxDev = -Infinity, minDev = Infinity;
        while (!game.finished && game.t < 200) {
          botStep(game, skill, memo, DT);
          const dev = game.rivalClock - game.t, p = game.z / course.length;
          maxDev = Math.max(maxDev, dev - rubberCaps(p).lead); minDev = Math.min(minDev, dev + rubberCaps(Math.max(p, rivalAt(rival, game.rivalClock).z / course.length)).lag);
          if (p < 0.85) { behindRaw = Math.min(behindRaw, game.z - rivalAt(rival, game.t).z); behind = Math.min(behind, game.z - rivalAt(rival, game.rivalClock).z); }
          // 手加減の持ち分が満額（lag 秒）の間: 記録どおりの相手が終盤（残り lastStretch）へ入るまで
          if (rivalAt(rival, game.t).z / course.length < 1 - RUBBER.lastStretch) { earlyRaw = Math.min(earlyRaw, game.z - rivalAt(rival, game.t).z); early = Math.min(early, game.z - rivalAt(rival, game.rivalClock).z); }
        }
        const label = `${pack.id} ${skill} vs ${who}`;
        // 勝ち負けは記録どおりの相手と同じ（腕前で決まる）
        assert.equal(game.race.won, game.finishTime < rival.finishTime, `${label}: the result is unchanged by the rubber band`);
        assert(maxDev < 0.15 && minDev > -0.15, `${label}: the rival stays within its allowance (${maxDev.toFixed(2)}, ${minDev.toFixed(2)})`);
        assert(behind >= behindRaw - 3, `${label}: the rival never runs further away than its recording (${behind.toFixed(1)} vs ${behindRaw.toFixed(1)} m)`);
        // 手加減は最大 RUBBER.lag 秒分なので、大きく離された時は少なくとも 25m は待ってくれる（持ち分が満額の間）。
        // 終盤は keep 秒まで返すので、いちばん離れた所（相手がゴールした後を含む）でも keep 秒ぶんは待つ。
        // 2026-11-13: 起伏が増えて跳ばない人がなるから 250m 以上離されるようになり、いちばん離れた所が「相手のゴール後」になった。
        // そこは設計上 keep 秒ぶん（最高速で約17m〜ブーストで約23m）なので、25m は持ち分が満額の区間で確かめる
        // なる（2026-11-13 オーナー「なるが弱かった」）は手加減しない: 大きく離されても待たない
        if (rival.easeOff === false) { assert(behind - behindRaw < 3, `${label}: Naru never waits (${behind.toFixed(0)} vs ${behindRaw.toFixed(0)} m)`); continue; }
        if (earlyRaw < -80) assert(early - earlyRaw >= 25, `${label}: a rider left far behind sees the rival wait (${early.toFixed(0)} vs ${earlyRaw.toFixed(0)} m)`);
        if (behindRaw < -80) assert(behind - behindRaw >= RUBBER.keep * SPEED.max - 1, `${label}: even at the widest gap the rival keeps its last allowance (${behind.toFixed(0)} vs ${behindRaw.toFixed(0)} m)`);
      }
    }
  }
});

test("the meter shows realistic sandboard speeds: a slight stretch over the real riders, never past the records", () => {
  // 実物: 上手な人で約64 km/h、サンドボードのギネス記録 82 km/h（砂のスキーの記録は 127 km/h）。少しだけ盛る。
  assert.equal(Math.round(toKmh(SPEED.start)), 30, "the start reads about 30 km/h");
  const top = toKmh(SPEED.max), boosted = toKmh(SPEED.boost);
  assert(top >= 60 && top <= 70, `the normal top speed is a skilled rider's (${top.toFixed(1)} km/h)`);
  assert(boosted > 82 && boosted < 95, `boost goes a little past the sandboard record, far below sand skiing's (${boosted.toFixed(1)} km/h)`);
  assert(top < DISPLAY.redFrom && boosted > DISPLAY.redFrom && boosted < DISPLAY.dialMax, "only the boost reaches the red band, and the needle never pins");
  assert.equal(toMeters(100), 100 * DISPLAY.scale, "distances on screen use the same scale as the speed");
});

test("rock and spin falls retain positive gauge without refilling an empty gauge", () => {
  const course = generateCourse(DEFAULT_SEED);
  const rock = course.features.find(f => f.kind === "rock");
  for (const initial of [0, 0.01, 0.15, 0.3, 0.6, 1]) {
    const game = createGame(course);
    hold(game, initial);
    while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
    assert.equal(game.falls, 1);
    assert.equal(game.gauge, Math.max(initial * 0.5, initial - BOOST.fallLoss));
    assert.equal(canRecover(game), initial > 0);
    const spin = createGame(course);
    jumpAtNextBump(spin);
    step(spin, {}, DT);
    while (spin.air > 0.2) step(spin, {}, DT);
    hold(spin, initial);
    while (spin.air > 0) step(spin, { left: true }, DT);
    assert.equal(spin.events.at(-1).reason, "spin");
    assert.equal(spin.gauge, Math.max(initial * 0.5, initial - BOOST.fallLoss));
    assert.equal(canRecover(spin), false);
  }
});

test("scoped art loading defers unselected rivals and waits through decode", async () => {
  const NativeImage = globalThis.Image, requested = [], decode = [];
  globalThis.Image = class {
    set src(value) {
      requested.push(value);
      this.complete = true;
      this.decode = () => new Promise(resolve => decode.push(resolve));
      this.onload();
    }
  };
  try {
    const { DESERT_ART, loadDesertArt } = await import("../js/minigames/desert-ride-art.js?scoped");
    const common = loadDesertArt({ rivals: [] });
    const commonCount = Object.keys(DESERT_ART).filter(key => DESERT_ART[key].file && !/^(noor|naru)Rider/.test(key)).length;
    assert.equal(requested.length, commonCount);
    assert.equal(common.pending(), true, "HTTP completion is not decode completion");
    decode.splice(0).forEach(resolve => resolve());
    await common.whenReady();
    assert.equal(common.pending(), false);
    const noor = loadDesertArt({ rivals: ["noor"] });
    assert.equal(requested.length, commonCount + 6);
    assert.equal(common.pending(), false, "another scope does not delay common assets");
    assert.equal(requested.some(url => /rider_naru/.test(url)), false);
    decode.splice(0).forEach(resolve => resolve());
    await noor.whenReady();
    loadDesertArt({ rivals: ["noor"] });
    assert.equal(requested.length, commonCount + 6, "retry reuses images");
    const naru = loadDesertArt({ rivals: ["naru"] });
    assert.equal(requested.length, commonCount + 12);
    decode.splice(0).forEach(resolve => resolve());
    await naru.whenReady();
    assert(naru.get("naruRider"));
    assert(naru.get("noorRider"), "previously decoded rivals remain available");
  } finally {
    if (NativeImage === undefined) delete globalThis.Image;
    else globalThis.Image = NativeImage;
  }
});
