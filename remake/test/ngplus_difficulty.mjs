import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { carryIndex, difficultyForRun, liftRivalScore, KB, setRivalScoreObserver } from "../js/core/ngplus-difficulty.js";
import * as tournament from "../js/chapters/ch3-tournament-state.js";

const stats = n => Object.fromEntries(["technique", "sense", "guts", "charm", "insight"].map(key => [key, n]));
let checks = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
equal(carryIndex(stats(10)), 0);
equal(carryIndex(stats(100)), 1);
equal(carryIndex(stats(-100)), 0);
equal(carryIndex(stats(200)), 1);
equal(carryIndex(stats(55)), .5);
equal(carryIndex(), 0);
let previous = -1;
for (let n = 10; n <= 100; n++) {
  const p = carryIndex(stats(n));
  assert(p > previous); checks++; previous = p;
}
for (const cycle of [1, 2, 10]) for (const carryStats of [false, true]) {
  equal(difficultyForRun({ cycleStartStats: stats(100) }, { cycle, carryStats }), cycle > 1 && carryStats ? 1 : 0);
}
equal(difficultyForRun({ cycleStartStats: stats(100) }), 0);
equal(KB, .40);
equal(difficultyForRun({ statsAtChapterStart: stats(100), cycleStartStats: stats(10) }, { cycle: 2, carryStats: true }), 0);
for (const rival of [-100, 0, .1, 82.333333333, 100]) {
  equal(liftRivalScore(rival, 0, 3), rival);
  for (const p of [.5, 1]) equal(liftRivalScore(rival, p, 3), rival + (99 - rival) * KB * p);
}

// 変更前のcastVotes/standingsで取得したゴールデン値。全4投票と全順位を比較する。
const digest = createHash("sha256");
const events = [];
setRivalScoreObserver(event => events.push(event));
for (const seed of [1, 7, 42, 7317, 0xffffffff]) {
  for (const performance of [0, 30, 79, 80, 81, 82, 83, 84, 85, 98, 100]) {
    for (const p of [0, .5, 1]) {
      const value = { chapter: 3, day: 42, weatherSeed: seed, flags: {} };
      const progress = tournament.startAttempt(value, { careHistory: [] });
      for (let round = 0; round < 4; round++) {
        tournament.castVotes(progress, round, performance, { emil: -1, dr_kemuri: .5, nagumo: 1 }, p);
        if (p === 0) digest.update(JSON.stringify([progress.votes, progress.lastVotes, progress.quality, tournament.standings(progress)]));
      }
    }
  }
}
equal(digest.digest("hex"), "b5fdefd76cc2c1a186d9fc3076902843cf3c401ab66a6f55031ef01fd2cde7c7");
equal(events.length, 5 * 11 * 3 * 4 * 3);
assert(events.every(e => Object.isFrozen(e) && e.lifted === liftRivalScore(e.rival, e.p, e.chapter) && e.chapter === 3)); checks++;
assert(events.some(e => e.p > 0 && e.lifted !== e.rival)); checks++;
assert(events.filter(e => e.p === 0).every(e => Object.is(e.rival, e.lifted))); checks++;
equal([...new Set(events.map(e => e.p))], [0, .5, 1]);
setRivalScoreObserver(() => { throw new Error("observer failed"); });
const value = { chapter: 3, flags: {} };
assert(tournament.castVotes(tournament.startAttempt(value, {}), 0, 80)); checks++;
setRivalScoreObserver();
console.log(`PASS: ${checks} U4 assertions; 220 legacy-equivalent voting rounds (P=0), 440 lifted rounds, observer isolation`);
