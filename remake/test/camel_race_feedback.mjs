import assert from 'node:assert/strict';
import { createRace, WHIP, PLAYER, simulateRace } from '../js/minigames/camel-race-model.js';
import { camelStaminaReadout, camelNextGoal, STAMINA_WARNING, SPURT_RESERVE } from '../js/minigames/camel-race-feedback.js';
const race = createRace({ seed: 2 });
const before = JSON.stringify(race);
assert.equal(camelStaminaReadout(race).state, 'ok');
assert.equal(JSON.stringify(race), before, '表示の計算でモデルを書き換えない');
assert.equal(SPURT_RESERVE, WHIP.empty + 3 * WHIP.spurtDrain);
for (const [value, state] of [[100,'ok'], [STAMINA_WARNING + .01,'ok'], [STAMINA_WARNING,'low'], [PLAYER.tired,'low'], [PLAYER.tired - .01,'tired'], [WHIP.empty,'spent']]) {
  race.player.stamina = value;
  assert.equal(camelStaminaReadout(race).state, state, String(value));
}
race.player.stamina = 10; race.player.whipLocked = true;
assert.match(camelStaminaReadout(race).message, /再使用まで 12/);
race.player.rhythm = 0;
assert.match(camelStaminaReadout(race).message, /声で調子/);
race.player.rhythm = 1;
assert.equal(camelStaminaReadout(race).recovery, 1.7000000000000002);
race.player.whipLocked = false; race.player.stamina = 80; race.player.whipping = true;
assert.equal(camelStaminaReadout(race).accelerating, true);
assert.equal(camelStaminaReadout(race).seconds, (80 - WHIP.empty) / WHIP.drain);
race.player.distance = race.length * .75;
assert.equal(camelStaminaReadout(race).seconds, (80 - WHIP.empty) / WHIP.spurtDrain);
assert.match(camelStaminaReadout(race).reserveText, /終盤/);
// 表示変更が既存の『短く押し、声で整え、終盤で使う』優位を変えない。
for (let seed = 1; seed <= 20; seed++) {
  const smart = simulateRace({ seed, policy: 'perfect' }).score;
  const held = simulateRace({ seed, policy: 'hold' }).score;
  assert.ok(smart.time < held.time);
  assert.ok(smart.parts.stamina > held.parts.stamina);
}
// 結果の「次の目標」（CRF10）: 表示専用。採点を書き換えず、次の評価までの点・伸びる所を1つ・大会の条件の達成を返す。
{
  const run = (policy, cup = 'practice', seed = 3) => simulateRace({ seed, policy, cup }).score;
  const top = run('perfect', 'standard');
  const frozen = JSON.stringify(top);
  const best = camelNextGoal(top);
  assert.equal(JSON.stringify(top), frozen, '次の目標の計算で結果を書き換えない');
  assert.match(best.grade, /評価 S/); assert.equal(best.tip, null, '満点には助言を出さない'); assert.equal(best.cup, null, '認定した走には条件を出さない');
  const good = run('good', 'standard');
  const goodGoal = camelNextGoal(good);
  assert.equal(goodGoal.grade, `次の評価 S まで あと ${85 - good.total}点`, 'A の次は S（85点）');
  assert.match(goodGoal.tip, /^伸びる所：GOOD を PERFECT に/, 'GOOD だけの走は声の助言');
  assert.match(camelNextGoal(run('none', 'rookie')).tip, /輪を見送らない/);
  assert.match(camelNextGoal(run('spam')).tip, /連打をやめる/);
  assert.match(camelNextGoal(run('cruise')).tip, /LAST SPURT でムチを3秒以上/, 'ムチを使わない走はスパートの助言');
  assert.match(camelNextGoal(run('hold', 'expert')).tip, /息が切れたらムチを離す|LAST SPURT/, '押しっぱなしは順位ではなくムチの助言');
  // 評価の境目（S85・A70・B50）は採点と同じ。
  for (const [total, text] of [[84, '次の評価 S まで あと 1点'], [70, '次の評価 S まで あと 15点'], [69, '次の評価 A まで あと 1点'], [49, '次の評価 B まで あと 1点'], [85, '評価 S ── いちばん上の評価']]) {
    assert.equal(camelNextGoal({ ...top, total }).grade, text, String(total));
  }
  // 大会の条件: 標準は4つ、上級は3つ、入門は3位以内。達成済み（mastered）と練習には出さない。
  const missed = { ...good, cup: 'standard', rank: 2, parts: { ...good.parts, timing: 19, stamina: 20 }, stats: { ...good.stats, spam: 2 } };
  const standard = camelNextGoal(missed).cup;
  assert.equal(standard.label, '中級認定まで');
  assert.deepEqual(standard.items.map(item => item.ok), [true, false, true, false]);
  assert.equal(camelNextGoal(missed, { mastered: true }).cup, null);
  assert.equal(camelNextGoal({ ...missed, cup: 'practice' }).cup, null);
  const expert = camelNextGoal({ ...missed, cup: 'expert', rank: 1, total: 84 }).cup;
  assert.equal(expert.label, '称号まで'); assert.deepEqual(expert.items.map(item => item.ok), [true, false, false]);
  assert.deepEqual(camelNextGoal({ ...missed, cup: 'rookie', rank: 4 }).cup, { label: '標準大会まで', items: [{ text: '3位以内', ok: false }] });
  assert.equal(camelNextGoal({ ...missed, cup: 'rookie', rank: 3 }).cup, null, '入門で3位以内なら条件は出さない');
}
console.log('[camel race feedback] PASS');
