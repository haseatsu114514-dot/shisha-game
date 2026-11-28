import assert from "node:assert/strict";
import { drawRivalForm, rivalScores } from "../js/chapters/tournament-ballot.js";
import { beginCh1Votes, castCh1Votes, CH1_RIVALS } from "../js/craft/ch1-votes.js";
import * as ch2 from "../js/chapters/ch2-tournament-state.js";
import * as ch3 from "../js/chapters/ch3-tournament-state.js";
import * as ch4 from "../js/chapters/ch4-tournament-state.js";

const craft = {
  holes: { score: 75 }, heat: { score: 75 }, servedQuality: 75,
  stats: { craftQuality: 75, aroma: 75, taste: 75, burnRisk: 25, heatStability: 75, draw: 75, smoke: 75 },
  pull: { score: 75 }, pullDone: true, careHistory: [{ score: 75 }, { score: 75 }], total: 75,
};
const reload = value => JSON.parse(JSON.stringify(value));
const rivalOrder = rows => rows.filter(row => row.id !== "hajime").map(row => row.id).join("/");
function checkSeries(name, play) {
  const orders = new Set(), forms = new Set(), leaders = new Set();
  for (let attempt = 1; attempt <= 7; attempt++) {
    const { rows, form } = play(attempt);
    const order = rivalOrder(rows);
    assert.equal(rows.reduce((n, row) => n + row.points, 0), 34);
    assert.equal(rows[0].id === "hajime", false);
    assert(!forms.has(JSON.stringify(form)), "each new challenge draws a fresh form in the cycle");
    forms.add(JSON.stringify(form)); orders.add(order); leaders.add(rows[0].id);
  }
  assert(orders.size >= 5, name);
  assert.equal(leaders.size, 3, name);
  console.log(`PASS: ${name}, ${orders.size} rival orders, all three rivals led across seven attempts`);
}

for (const style of ["classic", "sakurai"]) {
  checkSeries("ch1/" + style, attempt => {
    const match = {};
    const form = drawRivalForm(Object.keys(CH1_RIVALS), 42, 1, attempt);
    beginCh1Votes(match, { style, rivalForm: form });
    castCh1Votes(match, 0, craft);
    const loaded = reload(match);
    for (let round = 1; round < 4; round++) {
      assert(castCh1Votes(match, round, craft));
      assert(castCh1Votes(loaded, round, craft));
    }
    assert.deepEqual(loaded, match);
    return { rows: match.voteAttempt.result.rows, form: match.voteAttempt.rivalForm };
  });
}
for (const [chapter, api] of [[2, ch2], [3, ch3]]) {
  const game = { chapter, day: 42, weatherSeed: 42, flags: {} };
  checkSeries("ch" + chapter, () => {
    const p = api.startAttempt(game, craft);
    assert(api.castVotes(p, 0, 75));
    const saved = reload(game);
    for (const state of [game, saved]) {
      const match = api.tournamentProgress(state);
      for (let round = 1; round < 4; round++) assert(api.castVotes(match, round, 75));
      match.step = 11;
      api.recordResult(state, 75);
    }
    assert.deepEqual(api.tournamentProgress(saved).result, p.result);
    p.stage = "defeat";
    return { rows: p.result.rows, form: p.rivalForm };
  });
}
{
  const game = { chapter: 4, weatherSeed: 42, flags: { _ch4: { part: "tournament", read: { ch4_tournament_start: true } } } };
  checkSeries("ch4", attempt => {
    if (attempt > 1) assert(ch4.resetChapterFourCraft(game));
    const p = ch4.startChapterFourCraft(game, craft);
    function finish(state) {
      ch4.beginChapterFourStep(state);
      ch4.finishChapterFourStep(state, craft);
    }
    while (p.voted === 0) finish(game);
    const saved = reload(game);
    for (const state of [game, saved]) while (!ch4.chapterFourMatch(state).result) finish(state);
    assert.deepEqual(ch4.chapterFourMatch(saved).result, p.result);
    return { rows: p.result.rows, form: p.rivalForm };
  });
}

for (const seed of [0, 1, 42, 77, 99999]) {
  const ids = Object.keys(CH1_RIVALS);
  let last;
  for (let attempt = 1; attempt <= 49; attempt++) {
    const form = drawRivalForm(ids, seed, 1, attempt);
    assert.notDeepEqual(form, last, "adjacent draws also differ across cycles");
    last = form;
  }
}
const scores = { first: 96, second: 94, third: 72 };
for (let attempt = 1; attempt <= 7; attempt++) {
  const scoresToday = rivalScores(scores, drawRivalForm(Object.keys(scores), 42, 1, attempt));
  assert.deepEqual(Object.values(scoresToday).sort(), Object.values(scores).sort());
  assert.equal(scoresToday.third, 72, "a large performance gap survives");
}
assert.deepEqual(rivalScores(scores), scores, "a save without form keeps its original scores");
