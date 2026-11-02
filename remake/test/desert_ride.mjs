// DESERT RIDE（第4章ドバイ・サンドボード）の規則: コースの決定性と公平さ、ジャンプ・着地・転倒、採点と評価の境目。
import assert from "node:assert/strict";
import test from "node:test";
import { COURSE, SPEED, JUMP, FALL, SCORE, RANKS, DEFAULT_SEED, generateCourse, practiceCourse, curveAt, createGame, step, press,
  summary, rankOf, readResult, botControl, nextBumpDistance, comboMultiplier } from "../js/minigames/desert-ride-model.js";

const DT = 1 / 60;
function play(course, skill, { maxTime = 200 } = {}) {
  const game = createGame(course), memo = {};
  while (!game.finished && game.t < maxTime) {
    const { input, action } = botControl(game, skill, memo);
    if (action) press(game);
    step(game, input, DT);
  }
  return game;
}

test("the course is deterministic per seed, sorted, fair: rocks leave a gap and never sit in a landing zone", () => {
  const a = generateCourse(DEFAULT_SEED), b = generateCourse(DEFAULT_SEED), other = generateCourse(DEFAULT_SEED + 1);
  assert.deepEqual(a.features, b.features);
  assert.notDeepEqual(a.features, other.features);
  assert.equal(a.length, COURSE.length);
  for (let i = 1; i < a.features.length; i++) assert(a.features[i].z >= a.features[i - 1].z, "features sorted by z");
  assert(a.features[0].z >= 120, "the first seconds are a straight run");
  const bumps = a.features.filter(f => f.kind === "bump"), rocks = a.features.filter(f => f.kind === "rock");
  assert(bumps.length >= 5 && rocks.length >= 10, `enough jumps (${bumps.length}) and rocks (${rocks.length})`);
  for (const bump of bumps) {
    for (const rock of rocks) assert(rock.z <= bump.z || rock.z - bump.z >= 50, `no rock in the landing zone after the bump at ${bump.z}`);
  }
  // 同じ z の岩の組は、板（0.2）の3倍以上の隙間を残す
  for (const rock of rocks) {
    const row = rocks.filter(r => Math.abs(r.z - rock.z) < 1 && r !== rock);
    for (const other of row) assert(Math.abs(other.x - rock.x) - other.w - rock.w >= 0.4, "a rock pair leaves a passable gap");
    assert(Math.abs(rock.x) + rock.w <= 1, "rocks stay inside the course");
  }
  // 岩は見てから避けられる間隔（連なる小岩も 30m 以上）
  const zs = [...new Set(rocks.map(r => r.z))].sort((p, q) => p - q);
  for (let i = 1; i < zs.length; i++) assert(zs[i] - zs[i - 1] >= 30, `rocks ${zs[i - 1]} and ${zs[i]} are too close`);
  assert.equal(curveAt(a, 0), 0); assert.equal(curveAt(a, a.length + 1000), 0);
  for (let z = 0; z < a.length; z += 7) assert(Math.abs(curveAt(a, z)) <= 1);
});

test("the practice course is short, fixed and in the lesson order (rock, bump, rock, bump)", () => {
  const course = practiceCourse();
  assert.equal(course.practice, true);
  assert.equal(course.length, COURSE.practiceLength);
  assert.deepEqual(course.features.map(f => f.kind), ["rock", "bump", "rock", "bump"]);
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

test("pressing near a bump is a big jump, pressing in the air braces the landing, perfect landings boost", () => {
  const course = generateCourse(DEFAULT_SEED);
  const game = createGame(course);
  const bump = course.features.find(f => f.kind === "bump");
  while (nextBumpDistance(game) > game.speed * JUMP.bumpWindow * 0.5) step(game, {}, DT);
  assert.equal(game.air, 0);
  assert.equal(press(game), "big");
  assert(game.air > 0 && game.airKind === "big");
  assert.equal(game.stats.bigJumps, 1);
  assert(game.score >= SCORE.bigJump, "the jump itself scores");
  // 空中でもう一度押すと着地の構え。着地の直前（landingWindow 以内）なら完璧
  while (game.air > JUMP.landingWindow * 0.5) step(game, {}, DT);
  assert.equal(press(game), "brace");
  const speedBefore = game.speed;
  while (game.air > 0) step(game, {}, DT);
  assert.equal(game.stats.perfect, 1);
  assert(game.speed > speedBefore, "a perfect landing adds speed");
  assert(game.passed.has(bump));
  assert.equal(game.combo, 2, "jump + landing chain the combo");
});

test("a bump taken without pressing only bounces (slower, no score); a flat press is a small hop", () => {
  const course = generateCourse(DEFAULT_SEED);
  let game = createGame(course);
  const bump = course.features.find(f => f.kind === "bump");
  while (!game.passed.has(bump)) step(game, {}, DT);
  assert.equal(game.airKind, "bounce");
  assert.equal(game.stats.bounces, 1);
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

test("hitting a rock is a fall: slower, combo reset, recoverable, never game over; a big jump clears any rock, a hop only small ones", () => {
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
  game = createGame(course);
  while (game.z < rock.z - 8) step(game, {}, DT);
  game.x = rock.x; game.air = 0.5; game.airTotal = 0.5; game.airKind = "hop";
  while (!game.passed.has(rock)) { game.x = rock.x; step(game, {}, DT); }
  assert.equal(game.falls, rock.size === "small" ? 0 : 1, "a hop only clears small rocks");
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
  assert(game.score >= SCORE.nearMiss);
});

test("the single course rates S / A / B / C by skill: perfect = S, late landings = A, no jumps = C, slow and clumsy = C", () => {
  const course = generateCourse(DEFAULT_SEED);
  const perfect = summary(play(course, "perfect")), good = summary(play(course, "good")), none = summary(play(course, "none")), lazy = summary(play(course, "lazy"));
  for (const result of [perfect, good, none, lazy]) {
    assert.equal(result.finished, true);
    assert(result.time >= 45 && result.time <= 75, `a run takes about a minute (${result.time}s)`);
  }
  assert.equal(perfect.falls, 0, "the course can be finished without any fall");
  assert.equal(perfect.rank, "S");
  assert.equal(good.rank, "A");
  assert.equal(none.rank, "C");
  assert.equal(lazy.rank, "C");
  assert(perfect.score > good.score && good.score > none.score && none.score > lazy.score);
  assert(lazy.falls >= 1, "the clumsy rider falls but still finishes");
  assert.deepEqual(RANKS.map(([rank]) => rank), ["S", "A", "B", "C"]);
  assert.equal(rankOf(RANKS[0][1]), "S"); assert.equal(rankOf(RANKS[0][1] - 1), "A"); assert.equal(rankOf(0), "C");
  assert.equal(comboMultiplier(0), 1); assert.equal(comboMultiplier(100), SCORE.comboMax);
  // 同じ seed・同じ操作なら同じ結果
  assert.deepEqual(summary(play(course, "perfect")), perfect);
});

test("every generated course up to seed 30 can be finished by the ideal rider without a fall (no unfair layouts)", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const result = summary(play(generateCourse(seed), "perfect"));
    assert.equal(result.finished, true, `seed ${seed} finishes`);
    assert.equal(result.falls, 0, `seed ${seed} has no unavoidable rock`);
  }
});

test("summary and readResult keep only well-formed finished records", () => {
  const game = play(generateCourse(DEFAULT_SEED), "good");
  const result = summary(game);
  assert.deepEqual(readResult(result), { finished: true, score: result.score, rank: result.rank, time: result.time, maxCombo: result.maxCombo,
    falls: result.falls, bigJumps: result.bigJumps, perfect: result.perfect, good: result.good, nearMiss: result.nearMiss });
  assert.equal(readResult({ ...result, finished: false }), null);
  assert.equal(readResult({ ...result, rank: "Z" }), null);
  assert.equal(readResult({ ...result, score: -1 }), null);
  assert.equal(readResult(null), null);
  const unfinished = summary(createGame(generateCourse(DEFAULT_SEED)));
  assert.equal(unfinished.finished, false); assert.equal(unfinished.rank, null);
  assert.equal(summary(play(practiceCourse(), "perfect")).score, 0, "practice has no score");
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
  assert.deepEqual(manifest.portraits.noor.faces, ["normal"]);
  assert(manifest.faceIcons.includes("face_noor.png") && tracked("assets/sprites/characters/noor/chr_noor_normal.png") && tracked("assets/ui/face_icons/face_noor.png"));
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
