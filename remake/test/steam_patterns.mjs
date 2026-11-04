// #2519 雑念弾幕の難度表: 舞台の格→表の選択、calm が導入前の値と同じこと、表の単調性、各波の安全な通り道。
// 実行: node remake/test/steam_patterns.mjs
import assert from 'node:assert/strict';
import { STEAM_STAGES, STEAM_TABLES, steamStageOf, steamTableFor, steamPace, pickWave, planWave, waveBullets, SWEEP_LANES, RAIN_LANES }
  from '../js/craft/steam-patterns.js';

const W = 784, H = 414, HEART_SPEED = 290, HIT_R = 4, WORD_HALF_H = 13.5, OBJECT_HALF = 11;

// 舞台の格: 練習系は practice、大会は章、明示の cs.stage が最優先。不明な章は小さい大会側へ倒す。
for (const mode of ['drill', 'rehearsal', 'tutorial', 'practice', undefined]) assert.equal(steamStageOf({ mode, chapter: 4 }), 'practice', `${mode}`);
const byChapter = { 1: 'local', 2: 'prefectural', 3: 'national', 4: 'world', 5: 'exhibition' };
for (const [chapter, stage] of Object.entries(byChapter)) assert.equal(steamStageOf({ mode: 'tournament', chapter: Number(chapter) }), stage);
for (const chapter of [undefined, null, 'x', 0, -3, 1.5, 5.5, 9, Infinity]) assert.equal(steamStageOf({ mode: 'tournament', chapter }), 'local', `chapter ${chapter}`);
assert.equal(steamStageOf({ mode: 'tournament', chapter: 2, stage: 'world' }), 'world', 'explicit stage from a common runner wins');
assert.equal(steamStageOf({ mode: 'drill', stage: 'national' }), 'national');
assert.equal(steamStageOf({ mode: 'tournament', chapter: 3, stage: 'toString' }), 'national', 'prototype keys are not stages');
assert.equal(steamStageOf(null), 'practice');

// 大舞台ほど難しい表。練習と第1章は同じ calm（導入前の値）。
const order = ['practice', 'local', 'prefectural', 'national', 'world', 'exhibition'];
assert.deepEqual(Object.keys(STEAM_STAGES), order);
assert.deepEqual(order.map(stage => steamTableFor(stage).id), ['calm', 'calm', 'stir', 'swell', 'whirl', 'storm']);
assert.equal(steamTableFor('unknown').id, 'calm');
assert.equal(steamTableFor('toString').id, 'calm');
for (let i = 1; i < order.length; i++) {
  assert(STEAM_STAGES[order[i]].rank >= STEAM_STAGES[order[i - 1]].rank);
  assert(STEAM_STAGES[order[i]].pressure > STEAM_STAGES[order[i - 1]].pressure);
}

// calm は導入前の定数と完全に一致（通常・救済とも）。
assert.deepEqual(steamPace(steamTableFor('practice')), { spawnEvery: .46, speedScale: 1, objects: 2, waveEvery: 2.8, waveSpeed: 205, warn: .75 });
assert.deepEqual(steamPace(steamTableFor('local'), true), { spawnEvery: .85, speedScale: .7, objects: 1, waveEvery: 4, waveSpeed: 140, warn: .75 });
assert.deepEqual(steamTableFor('local').waves, { sweep: 1 });

// 段が上がるほど密・速・短い予告。救済は同じ表のまま必ず通常より緩い。
const harder = (a, b) => b.spawnEvery < a.spawnEvery && b.speedScale > a.speedScale && b.waveEvery < a.waveEvery && b.waveSpeed > a.waveSpeed && b.warn <= a.warn;
for (let i = 0; i < STEAM_TABLES.length; i++) {
  const table = STEAM_TABLES[i], normal = steamPace(table), eased = steamPace(table, true);
  assert.equal(table.rank, i);
  assert(Object.isFrozen(table) && Object.isFrozen(table.eased) && Object.isFrozen(table.waves));
  assert(harder(eased, normal), `${table.id}: eased must be easier than normal`);
  assert(eased.objects <= normal.objects && eased.warn >= normal.warn);
  if (i) {
    const previous = STEAM_TABLES[i - 1];
    assert(harder(steamPace(previous), normal), `${table.id} is not harder than ${previous.id}`);
    assert(harder(steamPace(previous, true), eased), `${table.id} eased is not harder than ${previous.id} eased`);
    for (const kind of Object.keys(previous.waves)) assert(table.waves[kind] > 0, `${table.id} dropped ${kind}`);
    assert(Object.keys(table.waves).length > Object.keys(previous.waves).length, `${table.id} adds no new wave`);
  }
  // 最上段でも狙い撃ちは心より遅い（導入前の最大190px/秒×倍率）。
  assert(190 * normal.speedScale < HEART_SPEED, `${table.id}: aimed shots outrun the heart`);
}

// 候補が一つの表は乱数を消費しない（calm の乱数列を導入前と同じに保つ）。重みは偏りどおりに出る。
let draws = 0;
assert.equal(pickWave(steamTableFor('practice'), () => { draws++; return .3; }), 'sweep');
assert.equal(draws, 0);
const storm = steamTableFor('exhibition');
const counts = {};
for (let i = 0; i < 1000; i++) { const kind = pickWave(storm, () => (i + .5) / 1000); counts[kind] = (counts[kind] || 0) + 1; }
assert.deepEqual(Object.keys(counts).sort(), Object.keys(storm.waves).sort());
const stir = steamTableFor('prefectural'), stirCounts = {};
for (let i = 0; i < 1000; i++) { const kind = pickWave(stir, () => (i + .5) / 1000); stirCounts[kind] = (stirCounts[kind] || 0) + 1; }
assert.deepEqual(stirCounts, { sweep: 750, fan: 250 });

// 横なぎは導入前と同じ順に乱数を引く（左右→隙間）。弾も同じ順・同じ位置・同じ速さ。
const seq = values => { let i = 0; return () => values[i++]; };
const sweep = planWave('sweep', { width: W, height: H, hx: 300, hy: 200, random: seq([.7, .1]) });
assert.deepEqual(sweep, { kind: 'sweep', side: 1, gap: 2 });
const legacy = [];
for (let i = 0; i < 9; i++) { if (Math.abs(i - 2) <= 1) continue; legacy.push({ type: i % 2 ? 'word' : 'orb', x: W + 20, y: (i + 0.5) * H / 9, angle: Math.PI, speed: 205 }); }
assert.deepEqual(waveBullets(sweep, { width: W, height: H, speed: 205 }), legacy);

// 乱数・心の位置を振って、全種類の波に「予告を見てから間に合う通り道」が残ることを確かめる。
let seed = 2519;
const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
const halfHeight = b => (b.type === 'word' ? WORD_HALF_H : OBJECT_HALF) + HIT_R;
const laneSafeInterval = bullets => {
  // 横方向の壁: 弾の無い連続区間のうち最も広い所（心の中心が居てよい範囲）を返す。
  const ys = bullets.map(b => [b.y - halfHeight(b), b.y + halfHeight(b)]).sort((a, b) => a[0] - b[0]);
  let best = null, cursor = 16;
  for (const [top, bottom] of [...ys, [H - 16, H - 16]]) {
    if (top - cursor > (best ? best[1] - best[0] : 0)) best = [cursor, top];
    cursor = Math.max(cursor, bottom);
  }
  return best;
};
for (const table of STEAM_TABLES) for (const eased of [false, true]) {
  const pace = steamPace(table, eased);
  for (let n = 0; n < 400; n++) {
    const hx = 16 + random() * (W - 32), hy = 16 + random() * (H - 32);
    for (const kind of Object.keys(table.waves)) {
      const plan = planWave(kind, { width: W, height: H, hx, hy, random });
      const bullets = waveBullets(plan, { width: W, height: H, speed: pace.waveSpeed });
      assert(bullets.every(b => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.angle) && b.speed > 0 && b.speed < HEART_SPEED));
      if (kind === 'sweep' || kind === 'pincer') {
        assert(plan.gap >= 2 && plan.gap <= 6);
        const lefts = bullets.filter(b => b.angle === 0), rights = bullets.filter(b => b.angle === Math.PI);
        // 挟み撃ちは左右とも空く帯（重なり）に居れば両方を避けられる。
        const safe = laneSafeInterval(bullets);
        assert(safe && safe[1] - safe[0] >= 60, `${table.id}/${kind}: safe band too narrow ${JSON.stringify(safe)}`);
        if (kind === 'pincer') { assert.equal(Math.abs(plan.gap - plan.otherGap), 1); assert(lefts.length && rights.length); }
        const reach = Math.max(0, safe[0] - hy, hy - safe[1]) / HEART_SPEED;
        const wallSpeed = bullets[0].speed;
        const arrival = pace.warn + Math.max(0, Math.min(hx + 20, W + 20 - hx) - OBJECT_HALF) / wallSpeed;
        assert(reach <= arrival, `${table.id}/${kind}${eased ? '/eased' : ''}: needs ${reach.toFixed(2)}s, wall in ${arrival.toFixed(2)}s`);
      } else if (kind === 'rain') {
        assert(bullets.every(b => b.type === 'orb' && b.angle === Math.PI / 2), 'rain uses small orbs only');
        assert.equal(bullets.length, RAIN_LANES - 3);
        const laneW = W / RAIN_LANES, gapLeft = (plan.gap - 1) * laneW, gapRight = (plan.gap + 2) * laneW;
        assert(bullets.every(b => b.x + OBJECT_HALF + HIT_R <= gapLeft + laneW / 2 || b.x - OBJECT_HALF - HIT_R >= gapRight - laneW / 2));
        const reach = Math.max(0, gapLeft + laneW / 2 + OBJECT_HALF + HIT_R - hx, hx - (gapRight - laneW / 2 - OBJECT_HALF - HIT_R)) / HEART_SPEED;
        assert(reach <= pace.warn + Math.max(0, hy + 20 - OBJECT_HALF) / bullets[0].speed, `${table.id}/rain unreachable`);
      } else if (kind === 'fan') {
        assert(Math.hypot(hx - plan.x, hy - plan.y) >= 200, `${table.id}/fan fired point-blank`);
        assert.equal(bullets.length, 5);
        assert.equal(bullets.filter(b => b.type === 'word').length, 1);
        // 外側の弾より外へ出るのに要る横移動が、予告と到達までに間に合う。
        const distance = Math.hypot(hx - plan.x, hy - plan.y), side = distance * Math.sin(.4) + OBJECT_HALF + HIT_R;
        assert(side / HEART_SPEED <= pace.warn + (distance - OBJECT_HALF) / Math.max(...bullets.map(b => b.speed)));
      } else if (kind === 'ring') {
        assert(Math.hypot(hx - plan.x, hy - plan.y) >= 220, `${table.id}/ring too close`);
        assert.equal(bullets.length, 12);
        // 心の位置での弾と弾の間（弧長）は、弾の幅と判定を足しても十分広い。
        const arc = Math.hypot(hx - plan.x, hy - plan.y) * 2 * Math.PI / 12;
        assert(arc - 2 * (OBJECT_HALF + HIT_R) >= 80);
      }
    }
  }
}
assert.equal(SWEEP_LANES, 9);
console.log('[steam patterns] PASS: stage→table ladder, calm equals legacy (normal/eased), monotonic tables, weighted waves, legacy sweep order, reachable safe gaps for every wave');
