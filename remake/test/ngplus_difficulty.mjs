import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { carryIndex, difficultyForRun, liftRivalScore, KB, setRivalScoreObserver } from "../js/core/ngplus-difficulty.js";
import { difficultyEvidence } from "../js/core/cycle-start.js";
import { beginCh1Votes, castCh1Votes, CH1_JUDGES, CH1_RIVALS } from "../js/craft/ch1-votes.js";
import * as ch2Tournament from "../js/chapters/ch2-tournament-state.js";
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

// 版1の旧保存を、変更前のcastVotes/standingsで取得したゴールデン値と比較。全4投票と全順位を保持。
// Serialize to the historical fixture's vocabulary ONLY for this comparison. No scores, ordering
// or expected hashes may change when character identifiers change.
const fixtureVotes = data => JSON.stringify(data).replace(/"(ayatori|dr_charcoal|sensu)"/g,
  (_, key) => JSON.stringify(({ ayatori: "saku", dr_charcoal: "dr_kemuri", sensu: "sui" })[key]));
const digest = createHash("sha256");
const events = [];
setRivalScoreObserver(event => events.push(event));
for (const seed of [1, 7, 42, 7317, 0xffffffff]) {
  for (const performance of [0, 30, 79, 80, 81, 82, 83, 84, 85, 98, 100]) {
    for (const p of [0, .5, 1]) {
      const value = { chapter: 3, day: 42, weatherSeed: seed, flags: {} };
      const progress = tournament.startAttempt(value, { careHistory: [] });
      delete progress.rulesVersion; // 版のない旧保存。新規挑戦の版2と混ぜない。
      delete progress.baseVotes; // 旧保存には基礎票も無い。
      for (let round = 0; round < 4; round++) {
        tournament.castVotes(progress, round, performance, { emil: -1, dr_charcoal: .5, sensu: 1 }, p);
        if (p === 0) digest.update(fixtureVotes([progress.votes, progress.lastVotes, progress.quality, tournament.standings(progress)]));
      }
    }
  }
}
equal(digest.digest("hex"), "dc8cba342d2276295cf141e133f754da6d554b308d3247cb43da726d91b3ac7d");
equal(events.length, 5 * 11 * 3 * 4 * 3);
assert(events.every(e => Object.isFrozen(e) && e.lifted === liftRivalScore(e.rival, e.p, e.chapter) && e.chapter === 3)); checks++;
assert(events.some(e => e.p > 0 && e.lifted !== e.rival)); checks++;
assert(events.filter(e => e.p === 0).every(e => Object.is(e.rival, e.lifted))); checks++;
equal([...new Set(events.map(e => e.p))], [0, .5, 1]);
// オーナー承認の強化版（版2）も別の固定値で全4投票/全順位/持ち込みを検査。旧ゴールデン値は上で維持する。
// 新しい挑戦は版3（#3916 WIN11）だが、版2で始めた途中保存はこの値で最後まで進むので、版2に固定して同じ値を検査し続ける。
equal(tournament.V2_RIVAL_QUALITY, { ayatori: 86, steve: 85, volk: 88 });
equal(tournament.RIVAL_QUALITY, { ayatori: 84.5, steve: 83.5, volk: 86.5 });
equal(tournament.TOURNAMENT_RULES_VERSION, 3);
const currentDigest = createHash("sha256"), currentEvents = [];
setRivalScoreObserver(event => currentEvents.push(event));
for (const seed of [1, 7, 42, 7317, 0xffffffff]) {
  for (const performance of [0, 30, 79, 80, 81, 82, 83, 84, 85, 98, 100]) {
    for (const p of [0, .5, 1]) {
      const value = { chapter: 3, day: 42, weatherSeed: seed, flags: {} };
      const progress = tournament.startAttempt(value, { careHistory: [] });
      equal(progress.rulesVersion, 3);
      progress.rulesVersion = 2;
      for (let round = 0; round < 4; round++) {
        assert(tournament.castVotes(progress, round, performance, { emil: -1, dr_charcoal: .5, sensu: 1 }, p));
        if (p === 0) currentDigest.update(fixtureVotes([progress.votes, progress.lastVotes, progress.quality, tournament.standings(progress)]));
      }
    }
  }
}
equal(currentDigest.digest("hex"), "3e62874a792458d11a0b31ac51b201884d65c6edbc2e9a73224868b908fb1053");
equal(currentEvents.length, events.length);
assert(currentEvents.every(e => Object.isFrozen(e) && e.lifted === liftRivalScore(e.rival, e.p, e.chapter) && e.chapter === 3)); checks++;
assert(currentEvents.filter(e => e.p === 0).every(e => Object.is(e.rival, e.lifted))); checks++;
equal([...new Set(currentEvents.map(e => e.p))], [0, .5, 1]);
setRivalScoreObserver(() => { throw new Error("observer failed"); });
const value = { chapter: 3, flags: {} };
assert(tournament.castVotes(tournament.startAttempt(value, {}), 0, 80)); checks++;
setRivalScoreObserver();
console.log(`PASS: ${checks} U4 assertions; 220 legacy + 220 current voting rounds (P=0), 880 lifted rounds, observer isolation`);

// F-03: the real run evidence, including a later cycle with stat carry switched off.
const runCarry = value => difficultyForRun(value, difficultyEvidence(value));
const initial = runCarry({ cycle: 1, cycleStartStats: stats(10), stats: stats(100) });
const disabled = runCarry({ cycle: 2, cycleStartStats: stats(100), carryOptions: { groups: { stats: false } } });
const enabled = runCarry({ cycle: 2, cycleStartStats: stats(100), carryOptions: { groups: { stats: true } } });
equal([initial, disabled, enabled], [0, 0, 1]);

function ch1Match(style, craft, carry) {
  const attempt = {};
  beginCh1Votes(attempt, { style });
  for (let round = 0; round < 4; round++) assert(castCh1Votes(attempt, round, craft, { carryP: carry }));
  return attempt.voteAttempt;
}
const ch1Digest = createHash("sha256");
const ch1Samples = [];
for (const style of ["classic", "sakurai"]) {
  for (let score = 60; score <= 100; score++) {
    const craft = {
      holes: score % 2 ? { skipped: true } : { score: score - 2 }, heat: { score },
      stats: { craftQuality: score + 1, aroma: score, taste: score - 1, burnRisk: 100 - score,
        heatStability: score - 2, draw: score, smoke: score - 3 },
      pull: { score, attack: score % 3 === 0 }, careHistory: [{ score }, { score, attack: score % 3 === 1 }], total: score,
    };
    const match = ch1Match(style, craft, initial);
    equal(ch1Match(style, craft, disabled), match);
    ch1Digest.update(JSON.stringify(match));
    ch1Samples.push({ style, craft, match });
  }
}
// Full vote records with no carry in effect (the F-03 lift stays inactive), including the
// Sakurai judge evaluations and final standings. The digest also pins the C-20 changes
// (hajime-first tie-break and the Sakurai rival caps), which apply at every carry level.
equal(ch1Digest.digest("hex"), "32540013f6dd99e46cdda7ff0f3c05d5810485e8832e0aee4a05e93cf797c3de");

const harderStyles = new Set();
const ch1Events = [];
setRivalScoreObserver(event => ch1Events.push(event));
for (const { style, craft, match } of ch1Samples) {
  const carried = ch1Match(style, craft, enabled);
  const points = p => p.result.rows.find(row => row.id === "hajime").points;
  if (points(carried) < points(match)) harderStyles.add(style);
  if (style === "sakurai") {
    for (const [round, views] of match.views.entries()) for (const judge of CH1_JUDGES) {
      const newView = carried.views[round][judge];
      const oldView = views[judge];
      equal(newView.hajime, oldView.hajime);
      for (const id of Object.keys(CH1_RIVALS)) {
        const base = oldView[id];
        equal(newView[id], Math.max(base, liftRivalScore(base, enabled, 1)));
      }
    }
  }
}
setRivalScoreObserver(null);
equal([...harderStyles], ["classic", "sakurai"]);
equal(ch1Events.length, ch1Samples.length * 4 * 3 * 3);
assert(ch1Events.some(({ rival, lifted }) => rival > 99 && rival === lifted),
  "Sakurai's existing above-ceiling scores never decrease");

function ch2Match(carry) {
  const progress = ch2Tournament.startAttempt({ chapter: 2, flags: {} }, {});
  for (let round = 0; round < 4; round++) {
    assert(ch2Tournament.castVotes(progress, round, 91, null, carry));
  }
  return progress;
}
const ch2Initial = ch2Match(initial);
equal(ch2Match(disabled), ch2Initial);
equal(ch2Initial.quality, { ...ch2Tournament.RIVAL_QUALITY, hajime: 91 });
const ch2Carried = ch2Match(enabled);
equal(ch2Carried.quality, {
  ...Object.fromEntries(Object.entries(ch2Tournament.RIVAL_QUALITY)
    .map(([id, base]) => [id, liftRivalScore(base, enabled, 2)])),
  hajime: 91,
});
equal(ch2Tournament.standings(ch2Initial)[0].id, "hajime");
assert.notEqual(ch2Tournament.standings(ch2Carried)[0].id, "hajime");
console.log("PASS: F-03 Chapter 1 first-cycle parity across 82 matches, both vote styles and Chapter 2 react to carry");
