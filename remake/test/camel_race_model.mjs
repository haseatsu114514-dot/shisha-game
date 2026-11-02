// CAMEL RACE の競走モデル: 再現性・所要時間・採点・連打の罰・順位。
import assert from "node:assert/strict";
import { RACE, CUE, SIGNAL, PLAYER, createRace, stepRace, pressVoice, pressSignal, activeCue, scoreRace, simulateRace, standings,
  gradeOf, GRADES, RANK_POINTS, RIVAL_PROFILES, POLICIES } from "../js/minigames/camel-race-model.js";

// 同じ seed なら同じレース。違う seed なら輪の間隔とライバルの個体差が変わる。
{
  const a = simulateRace({ seed: 7, policy: "perfect" }), b = simulateRace({ seed: 7, policy: "perfect" });
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.state.cues.map(c => c.at), b.state.cues.map(c => c.at));
  const c = createRace({ seed: 8 });
  assert.notDeepEqual(c.cues.map(cue => cue.at), createRace({ seed: 7 }).cues.map(cue => cue.at));
}

// 所要時間は 45〜60秒の設計: ぴたりの声かけと終盤の合図で約50秒・1位・S。何もしなければ60秒超・4位・C。
for (let seed = 1; seed <= 20; seed++) {
  const perfect = simulateRace({ seed, policy: "perfect" });
  assert(perfect.state.finished);
  assert(perfect.score.time >= 45 && perfect.score.time <= 55, `perfect time ${perfect.score.time}`);
  assert.equal(perfect.score.rank, 1, `seed ${seed}: perfect play wins`);
  assert.equal(perfect.score.grade, "S");
  assert(perfect.score.total <= 100 && perfect.score.total >= 85);
  const good = simulateRace({ seed, policy: "good" });
  assert(good.score.time > perfect.score.time, "late GOOD presses are slower than PERFECT");
  assert(good.score.rank >= 2 && good.score.rank <= 4, `seed ${seed}: GOOD-only places mid-field (${good.score.rank})`);
  assert(["A", "B"].includes(good.score.grade), `seed ${seed}: GOOD-only grade ${good.score.grade}`);
  const none = simulateRace({ seed, policy: "none" });
  assert(none.score.time > 58 && none.score.time < RACE.maxTime, `none time ${none.score.time}`);
  assert.equal(none.score.rank, 4);
  assert.equal(none.score.grade, "C");
  assert(none.score.total < 30);
  // ライバルは互いに近い時間でゴールし、順位が入れ替わりうる。
  const finishes = none.state.rivals.map(r => r.finishedAt);
  assert(finishes.every(t => t > 48 && t < 58), `rival finishes ${finishes}`);
}
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
  const rhythm = race.player.rhythm;
  assert.equal(pressVoice(race).type, "perfect");
  assert(race.player.rhythm > rhythm);
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

// 合図: スタミナを使って加速し、再使用待ち。終盤は強く、息が切れていると空ぶかし。
{
  const race = createRace({ seed: 9 });
  stepRace(race, 1 / 60);
  const speed = race.player.speed, stamina = race.player.stamina;
  assert.equal(pressSignal(race).type, "boost");
  assert.equal(race.player.stamina, stamina - SIGNAL.cost);
  assert.equal(pressSignal(race).type, "cooldown");
  for (let i = 0; i < 60; i++) stepRace(race, 1 / 60);
  assert(race.player.speed > speed + 1, "a signal accelerates the camel");
  assert.equal(race.stats.earlySignals, 1, "a signal in the first 20% counts as early");
  race.player.distance = race.length * RACE.spurtFrom + 1;
  race.player.cooldownUntil = -1;
  assert.equal(pressSignal(race).type, "spurt");
  race.player.cooldownUntil = -1; race.player.stamina = PLAYER.spent - 1;
  assert.equal(pressSignal(race).type, "spent");
  assert.equal(race.player.stamina, 0);
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
  assert.deepEqual(Object.keys(POLICIES), ["perfect", "good", "none", "spam"]);
}
console.log("camel_race_model: ok");
