// #2519 蒸らし弾幕の心の状態: 重圧の入力、導入前の心拍との一致、無心、重圧の薄れとよみがえり、斬り、1段回復。
// 実行: node remake/test/steam_mind.mjs
import assert from 'node:assert/strict';
import { MIND_LEVELS, MIND_LABELS, MIND_TUNING, mindPressure, mindLevelOf, createMind } from '../js/craft/steam-mind.js';
import { STEAM_STAGES } from '../js/craft/steam-patterns.js';

assert.deepEqual(MIND_LEVELS, ['clear', 'steady', 'unsteady', 'shaken']);
assert.deepEqual(MIND_LABELS, { clear: '無心', steady: '平静', unsteady: 'ざわつく', shaken: '動揺' });

// 重圧: 舞台の格＋直前の炭＋救済。0〜0.35 に収まり、保存値を要らない。
assert.equal(mindPressure(), 0);
assert.equal(mindPressure({ stagePressure: STEAM_STAGES.national.pressure }), .15);
assert.equal(mindPressure({ stagePressure: .15, heatScore: 85 }), .1, 'good charcoal settles');
assert.equal(mindPressure({ stagePressure: .15, heatScore: 84 }), .15);
assert.equal(mindPressure({ stagePressure: .15, heatScore: 60 }), .15);
assert.equal(mindPressure({ stagePressure: .15, heatScore: 59 }), .25, 'bad charcoal strains');
assert.equal(mindPressure({ stagePressure: .15, retryAssist: true }), .1);
assert.equal(mindPressure({ stagePressure: .25, heatScore: 0 }), .35);
assert.equal(mindPressure({ stagePressure: 1, heatScore: 0 }), MIND_TUNING.pressureCap);
assert.equal(mindPressure({ stagePressure: 0, heatScore: 100, retryAssist: true }), 0);
assert.equal(mindPressure({ stagePressure: NaN, heatScore: undefined }), 0);
// 最大の重圧でも開始時は「ざわつく」止まりで、動揺から始まらない。
assert.equal(mindLevelOf(MIND_TUNING.pressureCap), 'unsteady');
assert.equal(mindLevelOf(STEAM_STAGES.exhibition.pressure), 'steady', 'a big stage alone starts calm but tense');

// 重圧0は導入前の心拍（被弾の衝撃4秒・被弾の残り0.025×回、上限0.2）と同じ緊張・同じ3段。
const legacyStress = (time, lastHit, hits) => Math.max(0, Math.min(1, (1 - (time - lastHit) / 4) + Math.min(.2, hits * .025)));
const legacyLevel = s => s > .65 ? 'shaken' : s > .25 ? 'unsteady' : 'steady';
{
  const mind = createMind(0); let lastHit = -Infinity, hits = 0;
  const hitTimes = [1, 1.5, 7, 13.2, 13.4, 20];
  for (let step = 0; step <= 300; step++) {
    const time = step / 10;
    if (hitTimes.some(t => Math.abs(t - time) < 1e-9)) { mind.hit(time); lastHit = time; hits++; }
    const expected = legacyStress(time, lastHit, hits);
    assert(Math.abs(mind.tension(time) - expected) < 1e-12, `t=${time}`);
    const level = mind.level(time);
    assert.equal(level === 'clear' ? 'steady' : level, legacyLevel(expected), `t=${time}`);
  }
  assert.equal(mind.hits, 6);
}

// 無心: 緊張が0.05未満のまま、最後の被弾（開始）から6秒。練習なら6秒で入り、被弾で抜ける。
{
  const mind = createMind(0);
  assert.equal(mind.level(5.99), 'steady');
  assert.equal(mind.level(6), 'clear');
  assert.equal(mind.hit(8), 'shaken');
  assert.equal(mind.level(13.99), 'steady');
  assert.equal(mind.level(14), 'clear', 'clear returns six seconds after a hit');
  for (const t of [20, 20.5, 21]) mind.hit(t);
  assert.equal(mind.level(26.99), 'steady');
  assert.equal(mind.level(27), 'clear', 'the hit residue fades like the legacy heartbeat');
}

// 大舞台ほど持ち直しが遅い: 重圧は10秒で薄れ、被弾でよみがえる。
const settleTime = (pressure, level) => {
  const mind = createMind(pressure); mind.hit(0);
  for (let t = 0; t < 60; t += .01) if (MIND_LEVELS.indexOf(mind.level(t)) <= MIND_LEVELS.indexOf(level)) return t;
  return Infinity;
};
let previous = -Infinity;
for (const stage of ['practice', 'local', 'prefectural', 'national', 'world', 'exhibition']) {
  const pressure = STEAM_STAGES[stage].pressure, steadyAt = settleTime(pressure, 'steady'), clearAt = settleTime(pressure, 'clear');
  assert(steadyAt >= previous, `${stage}: settles faster than a smaller stage`);
  assert(clearAt > steadyAt && Number.isFinite(clearAt));
  previous = steadyAt;
}
assert(settleTime(.35, 'steady') > settleTime(0, 'steady') + .5, 'the biggest stage plus bad charcoal must visibly linger');
{
  const mind = createMind(.35);
  assert.equal(mind.level(0), 'unsteady', 'big stage after bad charcoal starts unsteady');
  for (let t = 0; t < 20; t += .5) assert(mind.tension(t + .5) <= mind.tension(t), 'tension never rises without a hit');
  assert.equal(mind.level(3.2), 'steady');
  assert(mind.tension(9) < MIND_TUNING.clear && mind.level(9) === 'clear');
  const twin = createMind(0);
  mind.hit(12); twin.hit(12);
  assert.equal(mind.tension(12), 1);
  assert(mind.tension(17) > twin.tension(17) + .1, 'the stage pressure came back with the hit');
  assert.equal(twin.level(17), 'steady');
  assert.equal(mind.level(17.6), 'steady');
}

// 言葉を斬ると1語0.3秒ぶん落ち着く。被弾回数は変えない。
{
  const a = createMind(.2), b = createMind(.2);
  a.hit(1); b.hit(1);
  const before = b.tension(2);
  b.cut(2, 3);
  assert(Math.abs(b.tension(2) - a.tension(2 + 3 * MIND_TUNING.cutCalmSeconds)) < 1e-12);
  assert(b.tension(2) < before);
  assert.equal(b.hits, 1);
  b.cut(2, 0); b.cut(2, -4);
  assert(Math.abs(b.tension(2) - a.tension(2.9)) < 1e-12, 'zero/negative cuts do nothing');
}

// 根性のリフレッシュ回復: どの重圧でも、ちょうど1段だけ戻す。平静・無心はそのまま。被弾回数は戻さない。
for (const pressure of [0, .05, .15, .25, .35]) for (const hits of [1, 3, 8, 12]) {
  const mind = createMind(pressure);
  for (let i = 0; i < hits; i++) mind.hit(i * .1);
  const t = hits * .1;
  assert.equal(mind.level(t), 'shaken');
  assert.equal(mind.recoverStep(t), 'unsteady', `p=${pressure} hits=${hits}`);
  assert.equal(mind.recoverStep(t), 'steady', `p=${pressure} hits=${hits}`);
  assert.equal(mind.recoverStep(t), 'steady');
  assert.equal(mind.hits, hits);
}
{
  const mind = createMind(0);
  assert.equal(mind.recoverStep(7), 'clear');
}
console.log('[steam mind] PASS: pressure inputs and cap, legacy heartbeat parity, clear state, stage pressure lingers and returns on hits, cuts calm, exact one-step recovery');
