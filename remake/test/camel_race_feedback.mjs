import assert from 'node:assert/strict';
import { createRace, WHIP, PLAYER, simulateRace } from '../js/minigames/camel-race-model.js';
import { camelStaminaReadout, camelSpectatorComment, STAMINA_WARNING, SPURT_RESERVE } from '../js/minigames/camel-race-feedback.js';
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
assert.deepEqual(camelSpectatorComment(race), camelSpectatorComment(race));
assert.ok(!camelSpectatorComment(race).text.includes('\n'));
race.t = 10;
assert.match(camelSpectatorComment(race).key, /spurt/);
assert.match(camelSpectatorComment(race, 'goal').key, /finish/);
race.player.distance = 0; race.player.stamina = 20;
assert.match(camelSpectatorComment(race).key, /low/);
race.player.stamina = 80;
assert.match(camelSpectatorComment(race).key, /boost/);
const leaderKey = camelSpectatorComment(race).key;
race.rivals[0].distance = 10;
assert.notEqual(camelSpectatorComment(race).key, leaderKey, '同じ表示区間の先頭交代もkeyに反映');
// 表示変更が既存の『短く押し、声で整え、終盤で使う』優位を変えない。
for (let seed = 1; seed <= 20; seed++) {
  const smart = simulateRace({ seed, policy: 'perfect' }).score;
  const held = simulateRace({ seed, policy: 'hold' }).score;
  assert.ok(smart.time < held.time);
  assert.ok(smart.parts.stamina > held.parts.stamina);
}
console.log('[camel race feedback] PASS');
