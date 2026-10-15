import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createMatch, turnOf, takeTurn, planOpponent, matchResult, DIFFICULTIES } from "../js/minigames/axe-match.js";
import { resolveThrow, KILLS, killState } from "../js/minigames/axe-model.js";
import { matchReaction } from "../js/minigames/axe-companions.js";
const center = { x: 0, y: 0, power: .62 };
function play(seed, difficulty, playerInput = center) {
  let match = createMatch(difficulty, seed);
  for (let i = 0; i < 10; i++) {
    assert.equal(turnOf(match), "player");
    match = takeTurn(match, "player", playerInput);
    assert.equal(turnOf(match), "opponent");
    match = takeTurn(match, "opponent", planOpponent(match));
  }
  return match;
}
test("player starts; exactly twenty alternating throws use the common scoring model", () => {
  let match = createMatch();
  for (let i = 0; i < 20; i++) {
    const actor = i % 2 ? "opponent" : "player";
    const input = actor === "player" ? center : planOpponent(match);
    const history = structuredClone(match[actor]);
    const before = structuredClone(match);
    const next = takeTurn(match, actor, input);
    assert.deepEqual(next[actor].at(-1), resolveThrow(input, history));
    assert.deepEqual(match, before, "a turn must not mutate old histories");
    match = next;
    if (i < 19) assert.equal(matchResult(match).winner, null);
  }
  assert.equal(turnOf(match), null);
  assert.equal(match.player.length, 10); assert.equal(match.opponent.length, 10);
  assert.throws(() => takeTurn(match, "player", center), RangeError);
});
test("both players can win or draw; a draw ends after ten with no overtime", () => {
  for (const [p, o, winner] of [[.62, .1, "player"], [.1, .62, "opponent"], [.62, .62, "draw"]]) {
    let match = createMatch();
    for (let i = 0; i < 10; i++) {
      match = takeTurn(match, "player", { ...center, power: p });
      match = takeTurn(match, "opponent", { ...center, power: o });
    }
    assert.equal(matchResult(match).winner, winner);
    assert.equal(turnOf(match), null);
  }
});
test("calls and successful height closures belong to each individual history", () => {
  let match = createMatch();
  const upper = { ...center, x: KILLS[0].x, y: KILLS[0].y, called: KILLS[0].id };
  const lower = { ...center, x: KILLS[2].x, y: KILLS[2].y, called: KILLS[2].id };
  match = takeTurn(match, "player", upper);
  assert.deepEqual(killState(match.player), { remaining: 1, closed: ["upper"] });
  assert.deepEqual(killState(match.opponent), { remaining: 2, closed: [] });
  match = takeTurn(match, "opponent", upper);
  assert.throws(() => takeTurn(match, "player", upper), RangeError);
  match = takeTurn(match, "player", lower);
  match = takeTurn(match, "opponent", { ...lower, power: .1 });
  assert.deepEqual(killState(match.player), { remaining: 0, closed: ["upper", "lower"] });
  assert.deepEqual(killState(match.opponent), { remaining: 0, closed: ["upper"] });
  assert.throws(() => takeTurn(match, "player", lower), RangeError);
});
test("seed fixes opposing inputs independently of player scores; two calls on throws five and ten", () => {
  const high = play(489, "normal"), low = play(489, "normal", { ...center, power: .1 });
  assert.deepEqual(high.opponent, low.opponent);
  assert.deepEqual(high.opponent.flatMap((shot, i) => shot.called ? [i + 1] : []), [5, 10]);
  assert.equal(high.opponent[4].called, KILLS[0].id); assert.equal(high.opponent[9].called, KILLS[2].id);
  assert.notDeepEqual(high.opponent, play(490, "normal").opponent);
});
test("invalid settings, order and values refuse a turn without consuming it", () => {
  for (const [difficulty, seed] of [["fake", 1], ["normal", -1], ["normal", NaN], ["normal", 2 ** 32]])
    assert.throws(() => createMatch(difficulty, seed), RangeError);
  const match = createMatch();
  assert.throws(() => takeTurn(match, "opponent", center), RangeError);
  assert.throws(() => planOpponent(match), RangeError);
  assert.throws(() => takeTurn(match, "player", { ...center, power: NaN }), RangeError);
  assert.deepEqual(match.player, []);
});
test("fixed seeds 0..9999 give ordered difficulty distributions, legal calls and drop rates", () => {
  const stats = {};
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    const totals = []; let drops = 0, kills = 0;
    for (let seed = 0; seed < 10000; seed++) {
      const match = play(seed, difficulty);
      totals.push(matchResult(match).opponentTotal);
      for (const shot of match.opponent) {
        if (!shot.stuck) drops++;
        if (shot.outcome === "killshot") kills++;
        assert(shot.score >= 0 && shot.score <= 8);
      }
      assert.equal(killState(match.opponent).remaining, 0);
    }
    totals.sort((a, b) => a - b);
    stats[difficulty] = { mean: totals.reduce((a, b) => a + b) / totals.length,
      p10: totals[1000], p90: totals[9000], dropRate: drops / 100000, killRate: kills / 20000 };
  }
  assert(stats.normal.mean > stats.easy.mean + 5);
  assert(stats.hard.mean > stats.normal.mean + 5);
  assert(stats.easy.dropRate > .1 && stats.easy.dropRate < .2);
  assert.equal(stats.normal.dropRate, 0); assert.equal(stats.hard.dropRate, 0);
  assert(stats.hard.killRate > stats.normal.killRate && stats.normal.killRate > stats.easy.killRate);
  console.log("Opponent distributions (10000 games each): " + JSON.stringify(stats));
});
test("canonical match lines cover opponent outcomes, point gaps, calls and final results", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/axe_versus.json", import.meta.url)));
  const lines = Object.fromEntries(data.axe_versus.lines.map(line => [line.id, line.text]));
  for (const line of data.axe_versus.lines) { assert.equal(line.speaker, "hiyori"); assert(line.text.length <= 48); }
  let match = takeTurn(createMatch(), "player", center);
  assert.equal(matchReaction(lines, "opponent-ready", match, "opponent", { called: KILLS[0].id }).text, lines.call);
  for (const outcome of ["hit", "bull", "killshot", "killshot-miss", "miss", "drop"]) {
    assert.equal(matchReaction(lines, "result", { ...match, opponent: [{ score: 0, outcome }] }, "opponent").text, lines[outcome]);
  }
  assert.equal(matchReaction(lines, "choice", match, "player").text, lines.behind);
  assert.equal(matchReaction(lines, "summary", match, "player").text, lines.player);
});
