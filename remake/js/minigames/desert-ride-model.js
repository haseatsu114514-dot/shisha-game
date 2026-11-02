// DESERT RIDE（第4章ドバイ・サンドボード）の規則。コースの生成・1フレームの物理・採点だけを持ち、DOM に触れない。
// 画面と入力は desert-ride.js、本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js。
// 座標: z はコースに沿った距離（m）、x はコース中央からの横位置（-1〜1 がコース幅、|x|>EDGE は端の深い砂）。

export const COURSE = Object.freeze({ length: 1700, practiceLength: 470, laneHalf: 1 });
export const PLAYER = Object.freeze({ half: 0.1 });
export const EDGE = 0.86;
export const SPEED = Object.freeze({ start: 15, min: 8, max: 34, accel: 1.5, fallFactor: 0.42, edgeDrag: 7, landingBoost: 3.5, plainLanding: 0.94, bounceLoss: 0.9 });
export const JUMP = Object.freeze({ bigAir: 1.15, hopAir: 0.5, bounceAir: 0.26, landingWindow: 0.3, goodWindow: 0.6, bumpWindow: 0.36, bumpGrace: 0.14, steerInAir: 0.55 });
export const FALL = Object.freeze({ recover: 1.1, points: -150 });
export const STEER = Object.freeze({ accel: 4.6, damping: 4.0, curveDrift: 0.28 });
export const SCORE = Object.freeze({ finish: 1200, timePar: 72, timeBonusPerSec: 30, bigJump: 150, airPerSec: 120, perfect: 250, good: 120, hopPerfect: 40, nearMiss: 60, comboStep: 0.15, comboMax: 3 });
// 本編のコースは1本（DEFAULT_SEED）。評価の境目はそのコースで、転倒なし・全起伏で大ジャンプ・着地ほぼ完璧＝S、
// 着地が「良い」止まり＝A、転倒2回＝B、ジャンプを使わず避けるだけ＝C になるよう合わせた（remake/test/desert_ride.mjs のボットで照合）。
export const DEFAULT_SEED = 7;
export const RANKS = Object.freeze([["S", 9000], ["A", 6500], ["B", 3800], ["C", 0]]);
export const RANK_ORDER = Object.freeze(["C", "B", "A", "S"]);

/** 決定的な乱数（mulberry32）。同じ seed なら同じコース。 */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rock = (z, x, size = "big") => ({ kind: "rock", z, x, w: size === "small" ? 0.11 : 0.17, size });
const bump = z => ({ kind: "bump", z, x: 0, w: 1 });

/**
 * コースを作る。features は z の昇順。岩は手前から見えるよう十分な間隔を空け、起伏の着地帯には岩を置かない。
 * curves はカーブの要所（z, c∈[-1,1]）。描画と横流れに使う。
 */
export function generateCourse(seed = 1, { length = COURSE.length } = {}) {
  const random = rng(seed);
  const features = [];
  let z = 160; // 最初の数秒はまっすぐ滑るだけ
  const minGap = progress => 60 - 22 * progress; // 進むほど密に（60 → 38）
  while (z < length - 140) {
    const progress = Math.min(1, z / length);
    const roll = random();
    const side = () => (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.55);
    if (roll < 0.34) {
      // 起伏: ジャンプの見せ場。着地帯（52m）に岩を置かない
      features.push(bump(z));
      z += 52;
    } else if (roll < 0.52) {
      features.push(rock(z, side()));
    } else if (roll < 0.66) {
      // 2つの岩の間を抜ける。間隔は必ず板の幅の3倍以上
      const center = (random() - 0.5) * 0.7;
      features.push(rock(z, center - 0.42), rock(z, center + 0.42));
    } else if (roll < 0.82 && progress > 0.25) {
      // ジグザグの小岩3つ。ひとつずつ見える距離を置く
      const dir = random() < 0.5 ? -1 : 1;
      features.push(rock(z, dir * 0.4, "small"), rock(z + 34, -dir * 0.3, "small"), rock(z + 68, dir * 0.15, "small"));
      z += 68;
    } else if (progress > 0.3) {
      // 起伏の先に岩: 着地してから曲がる時間（64m 以上）を取る
      features.push(bump(z), rock(z + 64, side()));
      z += 64;
    } else {
      features.push(rock(z, side(), "small"));
    }
    z += minGap(progress) + random() * 26;
  }
  const curves = [{ z: 0, c: 0 }];
  for (let at = 220; at < length - 120; at += 170 + random() * 150) {
    const c = [-1, -0.6, 0, 0.6, 1][Math.floor(random() * 5)];
    curves.push({ z: at, c });
  }
  curves.push({ z: length - 60, c: 0 }, { z: length + 400, c: 0 });
  features.sort((a, b) => a.z - b.z);
  return Object.freeze({ seed, length, features, curves, practice: false });
}

/** 練習コース: まっすぐ → 岩1つ → 起伏 → 岩 → 起伏。説明の順番が固定なので乱数は使わない。 */
export function practiceCourse() {
  const length = COURSE.practiceLength;
  const features = [rock(150, 0.35), bump(240), rock(330, -0.3), bump(400)];
  const curves = [{ z: 0, c: 0 }, { z: length + 400, c: 0 }];
  return Object.freeze({ seed: 0, length, features, curves, practice: true });
}

/** z でのカーブ（-1〜1）。要所の間は滑らかにつなぐ。 */
export function curveAt(course, z) {
  const points = course.curves;
  if (z <= points[0].z) return points[0].c;
  for (let i = 1; i < points.length; i++) {
    if (z <= points[i].z) {
      const a = points[i - 1], b = points[i];
      const t = (z - a.z) / Math.max(1, b.z - a.z);
      const s = t * t * (3 - 2 * t);
      return a.c + (b.c - a.c) * s;
    }
  }
  return points[points.length - 1].c;
}

export function createGame(course) {
  return {
    course, t: 0, z: 0, x: 0, vx: 0, speed: SPEED.start,
    air: 0, airTotal: 0, airKind: null, landingPress: null, lastJumpT: -9,
    fallT: 0, falls: 0, combo: 0, maxCombo: 0, score: 0,
    stats: { bigJumps: 0, hops: 0, perfect: 0, good: 0, plain: 0, nearMiss: 0, edgeTime: 0, bounces: 0, airTime: 0 },
    passed: new Set(), lastBump: null, finished: false, finishTime: null, events: [], landedAt: null,
  };
}

export const comboMultiplier = combo => Math.min(SCORE.comboMax, 1 + SCORE.comboStep * combo);

function award(game, kind, base, { combo = true, at = {} } = {}) {
  const points = Math.round(base * comboMultiplier(game.combo));
  game.score += points;
  if (combo) { game.combo += 1; game.maxCombo = Math.max(game.maxCombo, game.combo); }
  game.events.push({ kind, points, t: game.t, combo: game.combo, ...at });
  return points;
}

/** 次の起伏（まだ越えていない）までの距離。無ければ Infinity。 */
export function nextBumpDistance(game) {
  for (const feature of game.course.features) {
    if (feature.kind !== "bump" || game.passed.has(feature)) continue;
    if (feature.z >= game.z) return feature.z - game.z;
  }
  return Infinity;
}

/** ジャンプ／着地ボタン。空中なら着地の構え、起伏の直前なら大ジャンプ、それ以外は小さなホップ。 */
export function press(game) {
  if (game.finished) return null;
  if (game.air > 0) {
    if (game.airKind === "bounce") return null;
    game.landingPress = game.air;
    game.events.push({ kind: "brace", t: game.t, remaining: game.air });
    return "brace";
  }
  if (game.fallT > 0) return null;
  const ahead = nextBumpDistance(game);
  const inWindow = ahead <= game.speed * JUMP.bumpWindow;
  const justPassed = game.lastBump && game.t - game.lastBump.t <= JUMP.bumpGrace && !game.lastBump.used;
  if (inWindow || justPassed) {
    if (justPassed) game.lastBump.used = true;
    else game.pendingBump = true; // 起伏に着いたら大ジャンプ（手前で押しても同じ）
    startAir(game, "big");
    return "big";
  }
  startAir(game, "hop");
  return "hop";
}

function startAir(game, kind) {
  const scale = 0.85 + 0.3 * (game.speed / SPEED.max);
  game.air = game.airTotal = kind === "big" ? JUMP.bigAir * scale : kind === "hop" ? JUMP.hopAir : JUMP.bounceAir;
  game.airKind = kind;
  game.landingPress = null;
  game.lastJumpT = game.t;
  if (kind === "big") {
    game.stats.bigJumps += 1;
    award(game, "jump", SCORE.bigJump + SCORE.airPerSec * game.airTotal, { at: { airTotal: game.airTotal } });
  } else if (kind === "hop") game.stats.hops += 1;
  else game.stats.bounces += 1;
}

function land(game) {
  const kind = game.airKind;
  game.air = 0; game.airKind = null;
  if (kind === "bounce") { game.events.push({ kind: "land", grade: "bounce", t: game.t }); return; }
  game.landedAt = game.t; // 画面が着地の構えを少し残すため（採点には使わない）
  const remaining = game.landingPress;
  let grade = "plain";
  if (remaining !== null && remaining <= JUMP.landingWindow) grade = "perfect";
  else if (remaining !== null && remaining <= JUMP.goodWindow) grade = "good";
  if (grade === "perfect") {
    game.stats.perfect += 1;
    game.speed = Math.min(SPEED.max, game.speed + SPEED.landingBoost);
    award(game, "land", kind === "big" ? SCORE.perfect : SCORE.hopPerfect, { at: { grade } });
  } else if (grade === "good") {
    game.stats.good += 1;
    award(game, "land", kind === "big" ? SCORE.good : Math.round(SCORE.hopPerfect / 2), { at: { grade } });
  } else {
    game.stats.plain += 1;
    game.speed = Math.max(SPEED.min, game.speed * SPEED.plainLanding);
    game.events.push({ kind: "land", grade, t: game.t });
  }
  game.landingPress = null;
}

function fall(game, feature) {
  game.fallT = FALL.recover;
  game.falls += 1;
  game.combo = 0;
  game.speed = Math.max(SPEED.min, game.speed * SPEED.fallFactor);
  game.vx = 0;
  game.score += FALL.points;
  game.air = 0; game.airKind = null;
  game.events.push({ kind: "fall", points: FALL.points, t: game.t, x: feature?.x ?? game.x });
}

/** 1フレーム進める。dt は秒（50ms で頭打ち）。入力は { left, right }。 */
export function step(game, input, dt) {
  if (game.finished) return game;
  dt = Math.min(0.05, Math.max(0, dt));
  game.t += dt;
  const falling = game.fallT > 0;
  if (falling) {
    game.fallT = Math.max(0, game.fallT - dt);
  } else {
    game.speed = Math.min(SPEED.max, game.speed + SPEED.accel * dt);
  }
  if (Math.abs(game.x) > EDGE && game.air <= 0) {
    game.speed = Math.max(SPEED.min, game.speed - SPEED.edgeDrag * dt);
    game.stats.edgeTime += dt;
  }
  // 横移動: 入力で加速、砂の抵抗で減衰。空中は効きが弱い。カーブでは外へ流れる。
  const steer = falling ? 0 : ((input?.right ? 1 : 0) - (input?.left ? 1 : 0));
  const grip = game.air > 0 ? JUMP.steerInAir : 1;
  game.vx += steer * STEER.accel * grip * dt;
  game.vx -= curveAt(game.course, game.z) * STEER.curveDrift * (game.speed / SPEED.max) * dt;
  game.vx *= Math.max(0, 1 - STEER.damping * dt);
  game.x += game.vx * dt;
  if (game.x > 1.05) { game.x = 1.05; game.vx = Math.min(0, game.vx); }
  if (game.x < -1.05) { game.x = -1.05; game.vx = Math.max(0, game.vx); }
  const z0 = game.z;
  game.z += game.speed * dt;
  if (game.air > 0) {
    game.stats.airTime += dt;
    game.air -= dt;
    if (game.air <= 0) land(game);
  }
  // 越えた要素を順に判定する
  for (const feature of game.course.features) {
    if (game.passed.has(feature) || feature.z > game.z) continue;
    if (feature.z <= z0 && !game.passed.has(feature)) { game.passed.add(feature); continue; }
    game.passed.add(feature);
    if (feature.kind === "bump") {
      game.lastBump = { t: game.t, used: false };
      if (game.pendingBump) { game.pendingBump = false; game.lastBump.used = true; continue; }
      if (game.air > 0) { game.lastBump.used = true; continue; } // 空中で越えた
      if (falling) continue;
      // ボタンを押さずに起伏に乗った: 小さく跳ねて少し遅くなる（転倒ではない）
      game.speed = Math.max(SPEED.min, game.speed * SPEED.bounceLoss);
      startAir(game, "bounce");
      continue;
    }
    const dx = Math.abs(game.x - feature.x);
    const cleared = game.air > 0 && (game.airKind === "big" || feature.size === "small") && game.airKind !== "bounce";
    if (dx < feature.w + PLAYER.half && !cleared) {
      if (!falling) fall(game, feature);
      continue;
    }
    if (dx < feature.w + PLAYER.half + 0.22 && !falling) {
      game.stats.nearMiss += 1;
      award(game, "near", SCORE.nearMiss, { at: { dx } });
    }
  }
  if (game.z >= game.course.length) finish(game);
  return game;
}

function finish(game) {
  game.finished = true;
  game.finishTime = game.t;
  game.z = game.course.length;
  if (game.course.practice) return;
  game.score += SCORE.finish;
  const bonus = Math.max(0, Math.round((SCORE.timePar - game.t) * SCORE.timeBonusPerSec));
  game.score += bonus;
  game.score = Math.max(0, Math.round(game.score));
  game.events.push({ kind: "finish", t: game.t, bonus });
}

export const rankOf = score => RANKS.find(([, min]) => score >= min)[0];
export const rankAtLeast = (rank, need) => RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(need);

/** 結果（リザルト画面・保存用）。完走していなければ finished:false・rank:null。 */
export function summary(game) {
  const time = Math.round((game.finishTime ?? game.t) * 10) / 10;
  const score = game.course.practice ? 0 : Math.max(0, Math.round(game.score)); // 練習は採点しない
  return {
    finished: game.finished, score, rank: game.finished ? rankOf(score) : null, time,
    maxCombo: game.maxCombo, falls: game.falls, bigJumps: game.stats.bigJumps, perfect: game.stats.perfect,
    good: game.stats.good, nearMiss: game.stats.nearMiss, seed: game.course.seed,
  };
}

/** 保存する記録の形を検査して整える（形が合わなければ null）。 */
export function readResult(value) {
  if (!value || typeof value !== "object" || value.finished !== true) return null;
  const n = (v, lo = 0) => Number.isFinite(v) && v >= lo ? v : null;
  const score = n(value.score), time = n(value.time), maxCombo = n(value.maxCombo), falls = n(value.falls);
  if (score === null || time === null || maxCombo === null || falls === null || !RANK_ORDER.includes(value.rank)) return null;
  return { finished: true, score: Math.round(score), rank: value.rank, time: Math.round(time * 10) / 10, maxCombo: Math.round(maxCombo), falls: Math.round(falls),
    bigJumps: Math.round(n(value.bigJumps) ?? 0), perfect: Math.round(n(value.perfect) ?? 0), good: Math.round(n(value.good) ?? 0), nearMiss: Math.round(n(value.nearMiss) ?? 0) };
}

/**
 * 検証・デモ用の自動操作。skill: "perfect"（全部よけて起伏で跳び、着地を決める）／"good"（着地が少し遅い）／
 * "none"（跳ばずによけるだけ）／"lazy"（反応が遅くよく転ぶ）。戻り値は { input, action } で、action は押すべき時に "press"。
 * 乱数を使わないので同じコースなら同じ結果になる。
 */
export function botControl(game, skill = "perfect", memo = {}) {
  const course = game.course;
  const react = skill === "lazy" ? 22 : 45;
  const ahead = course.features.filter(f => f.kind === "rock" && !game.passed.has(f) && f.z > game.z && f.z - game.z < react);
  let target = 0;
  if (ahead.length) {
    const first = ahead[0], row = ahead.filter(r => Math.abs(r.z - first.z) < 1);
    let best = null;
    for (let x = -0.8; x <= 0.8001; x += 0.05) {
      const d = Math.min(...row.map(r => Math.abs(x - r.x) - r.w - PLAYER.half));
      const cost = -Math.min(d, 0.6) * 3 + Math.abs(x - game.x) * 0.6;
      if (!best || cost < best.cost) best = { x, cost };
    }
    target = best.x;
  }
  const slow = skill === "lazy" && Math.floor(game.t * 4) % 3 === 0; // 時々手が止まる
  const input = slow ? { left: false, right: false } : { left: game.x > target + 0.03, right: game.x < target - 0.03 };
  let action = null;
  const jumps = skill === "perfect" || skill === "good";
  if (jumps && game.air <= 0 && nextBumpDistance(game) <= game.speed * JUMP.bumpWindow * 0.8) { action = "press"; memo.braced = false; }
  else if (game.air > 0 && game.airKind === "big" && !memo.braced && game.air <= (skill === "perfect" ? 0.2 : 0.45)) { action = "press"; memo.braced = true; }
  return { input, action };
}
