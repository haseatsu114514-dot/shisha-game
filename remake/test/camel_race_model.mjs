// CAMEL RACE の競走モデル: 再現性・所要時間・採点・連打の罰・順位。
import assert from "node:assert/strict";
import { RACE, CUE, WHIP, createRace, stepRace, pressVoice, setWhip, whipReady, activeCue, scoreRace, simulateRace, standings,
  gradeOf, GRADES, RANK_POINTS, RIVAL_PROFILES, POLICIES, CAMEL_CUPS, camelMastered, camelExpert } from "../js/minigames/camel-race-model.js";

// 同じ seed なら同じレース。違う seed なら輪の間隔とライバルの個体差が変わる。
{
  const a = simulateRace({ seed: 7, policy: "perfect" }), b = simulateRace({ seed: 7, policy: "perfect" });
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.state.cues.map(c => c.at), b.state.cues.map(c => c.at));
  const c = createRace({ seed: 8 });
  assert.notDeepEqual(c.cues.map(cue => cue.at), createRace({ seed: 7 }).cues.map(cue => cue.at));
}

// 所要時間は 45〜60秒の設計: ぴたりの声かけと上手なムチで約50秒・1位・S。何もしなければ60秒超・4位・C。
let goodWins = 0;
for (let seed = 1; seed <= 20; seed++) {
  const perfect = simulateRace({ seed, policy: "perfect" });
  assert(perfect.state.finished);
  assert(perfect.score.time >= 45 && perfect.score.time <= 55, `perfect time ${perfect.score.time}`);
  assert.equal(perfect.score.rank, 1, `seed ${seed}: perfect play wins`);
  assert.equal(perfect.score.grade, "S");
  assert(perfect.score.total <= 100 && perfect.score.total >= 85);
  const good = simulateRace({ seed, policy: "good" });
  assert(good.score.time > perfect.score.time + 1.5, "late GOOD presses are clearly slower than PERFECT");
  assert(good.score.rank >= 1 && good.score.rank <= 3, `seed ${seed}: GOOD with a good whip is in the fight (${good.score.rank})`);
  if (good.score.rank === 1) goodWins += 1;
  // ムチを使わない（声だけぴたり）と勝ちきれず、押しっぱなしは息が切れてもっと悪い。
  const cruise = simulateRace({ seed, policy: "cruise" });
  assert(cruise.score.time > perfect.score.time + 1.5, `seed ${seed}: the whip is worth about two seconds`);
  assert.equal(cruise.state.stats.whipTime, 0);
  const hold = simulateRace({ seed, policy: "hold" });
  assert(hold.score.time > cruise.score.time, `seed ${seed}: holding the whip all race is worse than never using it`);
  assert(hold.score.rank >= 2, `seed ${seed}: holding the whip all race does not win`);
  assert(hold.state.stats.emptyWhip > 5, "holding on an empty camel is counted");
  const none = simulateRace({ seed, policy: "none" });
  assert(none.score.time > 58 && none.score.time < RACE.maxTime, `none time ${none.score.time}`);
  assert.equal(none.score.rank, 4);
  assert.equal(none.score.grade, "C");
  assert(none.score.total < 30);
  // ライバルは互いに近い時間でゴールし、順位が入れ替わりうる。
  const finishes = none.state.rivals.map(r => r.finishedAt);
  assert(finishes.every(t => t > 48 && t < 58), `rival finishes ${finishes}`);
}
assert(goodWins <= 4, `GOOD-only rarely wins (${goodWins}/20)`);
// 連打は消耗して最下位。スコアは0〜100に収まる。
{
  const spam = simulateRace({ seed: 3, policy: "spam" });
  assert.equal(spam.score.rank, 4);
  assert(spam.score.stats.spam > 0 && spam.score.stats.miss > 0);
  assert(spam.score.total >= 0 && spam.score.total < 30);
  assert.equal(spam.score.stats.staminaLeft, 0);
}
// 先行型・追い込み型・安定型のどれも、同じ seed 違いで勝ちうる（単調な順位にならない）。
{
  const winners = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const { state } = simulateRace({ seed, policy: "none" });
    winners.add(standings(state)[0].id);
  }
  assert(winners.size >= 2, `winners ${[...winners]}`);
}

// 1回の声かけの判定: 輪の中心で PERFECT、少しずれて GOOD、外で無駄な声（スタミナ−3・調子−）。同じ輪への2回目は無駄。
{
  const race = createRace({ seed: 5 });
  const first = race.cues[0].at;
  while (race.t < first - CUE.lead - 0.2) stepRace(race, 1 / 60);
  assert.equal(activeCue(race), null, "no ring before lead time");
  const staminaBefore = race.player.stamina;
  const outside = pressVoice(race);
  assert.equal(outside.type, "miss");
  assert.equal(race.player.stamina, staminaBefore - CUE.missStamina);
  while (race.t < first) stepRace(race, 1 / 60);
  const cue = activeCue(race);
  assert(cue && Math.abs(cue.dt) <= CUE.perfect);
  const rhythm = race.player.rhythm, speed = race.player.speed;
  assert.equal(pressVoice(race).type, "perfect");
  assert(race.player.rhythm > rhythm);
  // 当たった声はその場で一伸びする（速さに少し足し、残りは上乗せとして消えていく）。
  assert(race.player.speed > speed && race.player.surge >= CUE.perfectSurge - 1e-9, "a hit kicks the camel forward at once");
  assert.equal(pressVoice(race).type, "miss", "second press on the same ring is wasted");
  assert.equal(race.stats.perfect, 1);
  // 2つ目の輪を GOOD のぎりぎりで。
  const second = race.cues[1].at;
  while (race.t < second + CUE.good - 0.05) stepRace(race, 1 / 60);
  assert.equal(pressVoice(race).type, "good");
  // 3つ目の輪を見送ると lost。
  const third = race.cues[2].at;
  while (race.t < third + CUE.good + 0.1) stepRace(race, 1 / 60);
  assert.equal(race.cues[2].state, "lost");
  assert.equal(race.stats.lost, 1);
  // 連打: 1.5秒に3回以上で毎回さらに消耗。
  const before = race.player.stamina;
  pressVoice(race); pressVoice(race); pressVoice(race);
  assert(race.player.stamina <= before - CUE.missStamina * 3 - CUE.spamStamina, "spam costs extra stamina");
  assert(race.stats.spam >= 1);
}

// 合図（ムチ）: 押している間だけ加速してスタミナを使う。離すと声の調子で息が戻る。空になったら戻るまで止まる。
{
  const race = createRace({ seed: 9 });
  for (let i = 0; i < 120; i++) stepRace(race, 1 / 60);
  const speed = race.player.speed, stamina = race.player.stamina;
  assert.equal(setWhip(race, true).type, "boost");
  assert.equal(setWhip(race, true), null, "holding is not a second press");
  for (let i = 0; i < 60; i++) stepRace(race, 1 / 60);
  assert(race.player.speed > speed + 1.5, "the whip accelerates the camel while held");
  assert(Math.abs(race.player.stamina - (stamina - WHIP.drain)) < 0.5, `one second of whip costs ${WHIP.drain}`);
  assert(Math.abs(race.stats.whipTime - 1) < 0.02);
  assert.equal(setWhip(race, false).type, "release");
  race.player.rhythm = 0.9;
  const rested = race.player.stamina;
  for (let i = 0; i < 60; i++) stepRace(race, 1 / 60);
  assert(race.player.stamina > rested, "releasing with a good rhythm lets the camel breathe");
  // スパート区間では強く効き、消費は少し軽い。
  race.player.distance = race.length * RACE.spurtFrom + 1;
  assert.equal(setWhip(race, true).type, "spurt");
  const before = race.player.stamina;
  stepRace(race, 0.05);
  assert(Math.abs(before - race.player.stamina - WHIP.spurtDrain * 0.05) < 1e-6);
  // 空になるまで押し続けると腕が止まり、押していても空ぶかし（emptyWhip）。戻るまで使えない。
  while (whipReady(race)) stepRace(race, 1 / 60);
  assert(race.player.whipLocked && !race.player.whipping);
  const empty = race.stats.emptyWhip;
  for (let i = 0; i < 30; i++) stepRace(race, 1 / 60);
  assert(race.stats.emptyWhip > empty, "pressing on an empty camel is wasted");
  setWhip(race, false); setWhip(race, true);
  assert.equal(race.events.at(-1).type, "spent");
  setWhip(race, false);
  race.player.stamina = WHIP.resume + 1; stepRace(race, 1 / 60);
  assert(!race.player.whipLocked && whipReady(race), "the whip comes back once the camel has breathed");
}

// 採点の部品と評価の境目。
{
  assert.deepEqual(RANK_POINTS, [40, 30, 20, 10]);
  assert.deepEqual(GRADES.map(([g]) => g), ["S", "A", "B", "C"]);
  assert.equal(gradeOf(85), "S"); assert.equal(gradeOf(84), "A"); assert.equal(gradeOf(70), "A"); assert.equal(gradeOf(69), "B"); assert.equal(gradeOf(50), "B"); assert.equal(gradeOf(49), "C"); assert.equal(gradeOf(0), "C");
  const race = createRace({ seed: 1 });
  assert.equal(scoreRace(race), null, "no score before the finish");
  const { score } = simulateRace({ seed: 1, policy: "perfect" });
  assert.equal(score.total, Math.min(100, score.parts.rank + score.parts.timing + score.parts.stamina));
  assert(score.parts.timing <= 35 && score.parts.stamina <= 25);
  assert.equal(RIVAL_PROFILES.length, RACE.rivals);
  assert.deepEqual(Object.keys(POLICIES), ["perfect", "good", "cruise", "hold", "none", "spam"]);
}
console.log("camel_race_model: ok");


// 標準の認定は1位やPERFECT限定にしない。GOOD中心＋適切なムチで達成可能。
for (let seed = 1; seed <= 60; seed++) {
  const good = simulateRace({ seed, cup: "standard", policy: "good" }).score;
  assert(camelMastered(good), `GOOD-centered run qualifies, seed ${seed}`);
  for (const policy of ["hold", "cruise", "none", "spam"]) {
    assert(!camelMastered(simulateRace({ seed, cup: "standard", policy }).score), `not mastery: ${policy}, seed ${seed}`);
  }
  assert.equal(simulateRace({ seed, cup: "rookie", policy: "good" }).score.rank, 1);
}
{
  const qualified = { cup: "standard", rank: 3, total: 60, parts: { timing: 20, stamina: 20 }, stats: { spam: 0 } };
  assert(camelMastered(qualified));
  assert(!camelMastered({ ...qualified, rank: 4 }));
  assert(!camelMastered({ ...qualified, parts: { timing: 19, stamina: 20 } }));
  assert(!camelMastered({ ...qualified, parts: { timing: 20, stamina: 19 } }));
  assert(!camelMastered({ ...qualified, stats: { spam: 1 } }));
  assert(!camelMastered({ ...qualified, cup: "practice" }));
  assert(!camelMastered({ ...qualified, stats: undefined }));
  assert(!camelExpert({ cup: "expert", rank: 1, total: 84, stats: { spam: 0 } }));
  assert(camelExpert({ cup: "expert", rank: 1, total: 85, stats: { spam: 0 } }));
  assert.deepEqual(CAMEL_CUPS.map(cup => cup.length), [1000, 700, 1000, 1300]);
}
console.log("camel_cups: 360 policy runs + boundaries ok");
