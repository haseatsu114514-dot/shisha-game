// CAMEL RACE の競走モデル: 再現性・所要時間・採点・連打の罰・順位。
import assert from "node:assert/strict";
import { RACE, CUE, WHIP, PACK, DRAFT, DUEL, createRace, stepRace, pressVoice, setWhip, whipReady, activeCue, scoreRace, simulateRace, standings,
  draftTarget, whipDrain, staminaRecovery, finishMargins, inSpurt,
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
  // 2026-11-11: 後ろに付くと風よけで息が戻るので、GOOD の遅れは以前（1.5秒超）より少し縮む。それでも1秒（約20m）以上の差が付く。
  assert(good.score.time > perfect.score.time + 1.0, "late GOOD presses are clearly slower than PERFECT");
  assert(good.score.rank >= 1 && good.score.rank <= 3, `seed ${seed}: GOOD with a good whip is in the fight (${good.score.rank})`);
  if (good.score.rank === 1) goodWins += 1;
  // ムチを使わない（声だけぴたり）と勝ちきれず、押しっぱなしは息が切れてもっと悪い。
  const cruise = simulateRace({ seed, policy: "cruise" });
  assert(cruise.score.time > perfect.score.time + 1.5, `seed ${seed}: the whip is worth about two seconds`);
  assert.equal(cruise.state.stats.whipTime, 0);
  const hold = simulateRace({ seed, policy: "hold" });
  assert(hold.score.time > cruise.score.time, `seed ${seed}: holding the whip all race is worse than never using it`);
  assert(hold.score.rank >= 3, `seed ${seed}: holding the whip all race finishes in the back half`);
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
  // ここでは風よけ・競り合いの無い素の消費を見る（ライバルを後ろへ離す。風よけの中の消費は下の「駆け引き」で確かめる）。
  for (const rival of race.rivals) rival.distance = race.player.distance - 30;
  stepRace(race, 1 / 60);
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

// ---- 駆け引き（2026-11-11）: 群れ・風よけ・競り合い・終盤の輪 ----------------------------------------
const run = (state, seconds, act = null) => { for (let i = 0; i < Math.round(seconds * 60) && !state.finished; i++) { act?.(state); stepRace(state, 1 / 60); } };
const place = (state, id, gap) => { const rival = state.rivals.find(r => r.id === id); rival.distance = state.player.distance + gap; return rival; };
// 風よけ: すぐ前（near〜far）にラクダがいる間だけ、回復が増えてムチの消費が軽い。先頭や離れた後ろでは効かない。
{
  const race = createRace({ seed: 11 });
  run(race, 4);
  for (const rival of race.rivals) rival.distance = race.player.distance - 30;
  stepRace(race, 1 / 60);
  assert.equal(race.player.drafting, null, "no shelter while leading");
  const open = { recover: staminaRecovery(race), drain: whipDrain(race) };
  place(race, "steady", (DRAFT.near + DRAFT.far) / 2);
  stepRace(race, 1 / 60);
  assert.equal(race.player.drafting, "steady");
  assert.equal(draftTarget(race).id, "steady");
  assert(Math.abs(staminaRecovery(race) - open.recover - DRAFT.recover) < 0.02, "shelter adds recovery");
  assert(Math.abs(whipDrain(race) - open.drain * (1 - DRAFT.whipSave)) < 1e-9, "the whip costs less in shelter");
  assert(race.events.some(event => event.kind === "draft" && event.type === "in" && event.who === "steady"));
  for (const gap of [DRAFT.near - 0.5, DRAFT.far + 0.5, -3]) {
    place(race, "steady", gap); stepRace(race, 1 / 60);
    assert.equal(race.player.drafting, null, `no shelter at ${gap}m`);
  }
  // 息が切れて腕が止まっている間は、風よけでも余分には戻らない（押しっぱなしを助けない）。
  place(race, "steady", 4); race.player.whipLocked = true; race.player.stamina = WHIP.empty; stepRace(race, 1 / 60);
  assert(race.player.whipLocked && race.player.drafting === "steady");
  assert(Math.abs(staminaRecovery(race) - open.recover) < 0.05, "an exhausted camel gets no extra recovery");
  // 表示のために数えている。
  assert(race.stats.draftTime > 0);
}
// 競り合い: 後ろから並びかけると相手が粘る（根性のぶんだけ）。抜き切ると相手は気落ちし、しばらく粘り直せない。
{
  const race = createRace({ seed: 12 });
  run(race, 6);
  for (const rival of race.rivals) rival.distance = race.player.distance - 30;
  const rival = place(race, "steady", DUEL.range - 0.5);
  race.player.speed = rival.speed + 1.5;
  const guts = rival.guts;
  stepRace(race, 1 / 60);
  assert.equal(race.player.duel, "steady");
  assert.equal(rival.guts, guts - 1);
  assert(race.events.some(event => event.kind === "duel" && event.type === "start" && event.who === "steady"));
  stepRace(race, 1 / 60);
  assert(rival.whipping, "the rival's jockey whips while it fights back");
  // 競り合いの最中に当てた声は、もう一伸びする。
  const cue = race.cues.find(c => c.state === "pending"); cue.at = race.t; const before = race.player.surge;
  assert.equal(pressVoice(race).duel, "steady");
  assert(race.player.surge - before >= CUE.perfectSurge + DUEL.voiceKick - 1e-9);
  // ムチで抜き切る。
  race.events.length = 0;
  setWhip(race, true); run(race, DUEL.seconds + 0.5);
  const done = race.events.find(event => event.kind === "duel" && event.type !== "start");
  assert.equal(done?.type, "won");
  assert.equal(race.player.duel, null);
  assert.equal(race.stats.duels, 1); assert.equal(race.stats.duelsWon, 1);
  assert(Math.abs(rival.dent - DUEL.dent) < 1e-9, "the beaten rival loses heart");
  assert(rival.duelReadyAt > race.t, "no second fight right away");
}
// 粘られた場合: 抜けないまま時間が切れると held。気落ちはしない。出だし（コースの8%まで）は競り合いにならない。
{
  const race = createRace({ seed: 13 });
  run(race, 1);
  const early = place(race, "front", 1); race.player.speed = early.speed + 2; stepRace(race, 1 / 60);
  assert.equal(race.player.duel, null, "no duel in the opening scramble");
  run(race, 7);
  for (const rival of race.rivals) rival.distance = race.player.distance - 30;
  const rival = place(race, "front", 2);
  race.player.speed = rival.speed + 0.5; stepRace(race, 1 / 60);
  assert.equal(race.player.duel, "front");
  race.events.length = 0;
  run(race, DUEL.seconds + 0.2, state => { state.player.speed = Math.min(state.player.speed, rival.speed - 0.5); });
  assert.equal(race.events.find(event => event.kind === "duel")?.type, "held");
  assert.equal(rival.dent, 0); assert.equal(race.stats.duelsWon, 0);
}
// 群れ: 大きく遅れたライバルは追い足を使う。近づくと0（追い足だけでは抜かれない）。使ったぶんは最後の直線で足が鈍って返す。
{
  const race = createRace({ seed: 14 });
  run(race, 5);
  const rival = place(race, "steady", -(PACK.chaseFrom + 10));
  stepRace(race, 1 / 60);
  assert(Math.abs(rival.pack - Math.min(PACK.chaseMax, 10 * PACK.chaseGain)) < 0.05, `chase ${rival.pack}`);
  assert(rival.debt > 0);
  place(race, "steady", -(PACK.chaseFrom - 1)); stepRace(race, 1 / 60);
  assert.equal(rival.pack, 0, "no chase once close: the chase alone never passes the player");
  rival.debt = 12; rival.distance = race.length * PACK.chaseUntil + 1; race.player.distance = rival.distance + 20;
  stepRace(race, 1 / 60);
  assert(rival.pack < 0 && rival.debt < 12, "the chase is paid back on the final stretch");
  // 離しすぎた先頭はスパート前だけ息を入れる。自分がスパートに入ったら待たない。遠すぎても待たない。
  const lead = createRace({ seed: 15 });
  run(lead, 5);
  const front = place(lead, "front", PACK.easeFrom + 8); stepRace(lead, 1 / 60);
  assert(front.pack < 0, "a far leader eases before the spurt");
  place(lead, "front", PACK.easeGiveUp + 5); stepRace(lead, 1 / 60);
  assert.equal(front.pack, 0);
  lead.player.distance = lead.length * RACE.spurtFrom + 1; place(lead, "front", PACK.easeFrom + 8); stepRace(lead, 1 / 60);
  assert.equal(front.pack, 0, "nobody waits in the spurt");
}
// 終盤の輪: スパート区間に入ると、輪が詰まって来る（間隔 spurtGap）。同じ seed・同じ操作なら同じ並び。
{
  const race = createRace({ seed: 16 });
  while (!inSpurt(race)) { const cue = activeCue(race); if (cue && Math.abs(cue.dt) < 0.02) pressVoice(race); stepRace(race, 1 / 60); }
  stepRace(race, 1 / 60);
  assert(race.spurtCues);
  const pending = race.cues.filter(cue => cue.state === "pending" && cue.at - cue.lead > race.t + 0.3).map(cue => cue.at);
  for (let i = 1; i < 6; i++) {
    const gap = pending[i] - pending[i - 1];
    assert(gap >= CUE.spurtGapMin - 1e-9 && gap <= CUE.spurtGapMax + 1e-9, `spurt gap ${gap}`);
  }
  assert(race.cues.filter(cue => cue.state === "pending").every(cue => cue.lead <= CUE.leadMax));
}
// 着差: 1着なら behind だけ、最下位なら ahead だけ。秒は0以上。
{
  assert.equal(finishMargins(createRace({ seed: 1 })), null);
  const win = simulateRace({ seed: 2, policy: "perfect" });
  const first = finishMargins(win.state);
  assert.equal(first.ahead, null); assert(first.behind.seconds > 0 && RIVAL_PROFILES.some(profile => profile.id === first.behind.id));
  const last = finishMargins(simulateRace({ seed: 2, policy: "none" }).state);
  assert.equal(last.behind, null); assert(last.ahead.seconds >= 0);
}
// 駆け引きの効き目: 群れが画面（自分の後ろ22m〜前46m）に残る。競り合いは毎レース起き、上手な操作なら抜き切れる。
// 競り合いを避けてスパートだけムチを使うより、競り勝っておく方が勝てる（中盤のムチに意味がある）。
{
  const half = state => { const cue = activeCue(state); const late = Math.round(cue?.at * 7) % 2 === 1; const target = late ? 0.22 : 0;
    return { voice: !!cue && cue.dt >= target - 0.02 && cue.dt <= target + 0.02 }; };
  const fighter = state => ({ ...half(state), whip: POLICIES.perfect(state).whip });
  const saver = state => ({ ...half(state), whip: whipReady(state) && inSpurt(state) });
  let seen = 0, total = 0, duels = 0, won = 0, fightWins = 0, saveWins = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const state = createRace({ seed });
    while (!state.finished) {
      const action = POLICIES.perfect(state); if (action.voice) pressVoice(state); setWhip(state, !!action.whip); stepRace(state, 1 / 60); state.events.length = 0;
      for (const rival of state.rivals) { const gap = rival.distance - state.player.distance; total += 1; if (gap > -22 && gap < 46) seen += 1; }
    }
    duels += state.stats.duels; won += state.stats.duelsWon;
    // 勝ち負けが分かれる上級大会で比べる（練習はどちらでもほぼ勝てる）。
    if (simulateRace({ seed, cup: "expert", policy: fighter }).score.rank === 1) fightWins += 1;
    if (simulateRace({ seed, cup: "expert", policy: saver }).score.rank === 1) saveWins += 1;
  }
  assert(seen / total > 0.72, `rivals stay in view ${(seen / total).toFixed(2)}`);
  assert(duels >= 45 && won >= duels * 0.9, `duels ${duels}, won ${won}`);
  assert(fightWins > saveWins + 3, `fighting the duels pays off (${fightWins} vs ${saveWins})`);
  assert(fightWins >= 6 && fightWins <= 22, `half-accurate play wins some and loses some in the expert cup (${fightWins}/30)`);
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
// 上級大会（2026-11-11 に強さを調整）: お手本の操作なら称号に届くが毎回ではない。GOOD だけでは勝てない。押しっぱなしは後方。
{
  let titles = 0;
  for (let seed = 1; seed <= 60; seed++) {
    if (camelExpert(simulateRace({ seed, cup: "expert", policy: "perfect" }).score)) titles += 1;
    assert(!camelExpert(simulateRace({ seed, cup: "expert", policy: "good" }).score), `GOOD-only does not take the title, seed ${seed}`);
    assert(simulateRace({ seed, cup: "expert", policy: "hold" }).score.rank >= 3);
  }
  assert(titles >= 36 && titles <= 54, `the expert title is a challenge even for perfect timing (${titles}/60)`);
}
console.log("camel_cups: 360 policy runs + boundaries ok");
