import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createMatch, turnOf, takeTurn, planOpponent, matchResult, resolveTurn, inSuddenDeath, suddenDeathWinner, suddenDeathTarget, openAim, DIFFICULTIES, MEASURE_FROM } from "../js/minigames/axe-match.js";
import { resolveThrow, KILLS, KILL_ROTATION, CLUSTERS, killState, closuresOf } from "../js/minigames/axe-model.js";
import { matchReaction } from "../js/minigames/axe-companions.js";
const center = { x: 0, y: 0, power: .62 }, drop = { x: 0, y: 0, power: .1 };
const kill = id => { const k = KILLS.find(k => k.id === id); return { x: k.x, y: k.y, power: .62 }; };
function play(seed, difficulty, playerInput = center, division = "rec") {
  let match = createMatch(difficulty, seed, division);
  for (let i = 0; i < 10; i++) {
    assert.equal(turnOf(match), "player");
    match = takeTurn(match, "player", playerInput);
    assert.equal(turnOf(match), "opponent");
    match = takeTurn(match, "opponent", planOpponent(match));
  }
  return match;
}
const tied = (p = center, o = center) => { let m = createMatch(); for (let i = 0; i < 10; i++) { m = takeTurn(m, "player", p); m = takeTurn(m, "opponent", o); } return m; };

test("player starts; exactly twenty alternating throws use the common scoring model with each thrower's own history", () => {
  let match = createMatch();
  for (let i = 0; i < 20; i++) {
    const actor = i % 2 ? "opponent" : "player";
    const input = actor === "player" ? center : planOpponent(match);
    const history = structuredClone(match[actor]);
    const before = structuredClone(match);
    assert.deepEqual(resolveTurn(match, actor, input), resolveThrow(input, history, { division: "rec", throws: 10 }));
    const next = takeTurn(match, actor, input);
    assert.deepEqual(next[actor].at(-1), resolveThrow(input, history, { division: "rec", throws: 10 }));
    assert.deepEqual(match, before, "a turn must not mutate old histories");
    match = next;
    if (i < 19) assert.equal(matchResult(match).winner, null);
  }
  assert.equal(match.player.length, 10); assert.equal(match.opponent.length, 10);
  assert.equal(matchResult(match).winner, matchResult(match).playerTotal > matchResult(match).opponentTotal ? "player" : matchResult(match).playerTotal < matchResult(match).opponentTotal ? "opponent" : null);
  assert.equal(turnOf(tied()), "player", "a tie goes to sudden death instead of ending");
  assert.throws(() => takeTurn(tied(), "opponent", center), RangeError);
});
test("either player can win on points and the game ends after ten", () => {
  for (const [p, o, winner] of [[.62, .1, "player"], [.1, .62, "opponent"]]) {
    let match = createMatch();
    for (let i = 0; i < 10; i++) { match = takeTurn(match, "player", { ...center, power: p }); match = takeTurn(match, "opponent", { ...center, power: o }); }
    assert.equal(matchResult(match).winner, winner); assert.equal(turnOf(match), null); assert.equal(inSuddenDeath(match), false);
    assert.equal(matchResult(match).suddenDeath, null);
  }
});
test("sudden death: clockwise killshot rotation, the higher score wins, double misses rotate and are measured from the third attempt", () => {
  assert.deepEqual(KILL_ROTATION, ["upper-left", "upper-right", "lower-right", "lower-left"]);
  let match = tied();
  assert(inSuddenDeath(match)); assert.equal(suddenDeathTarget(0), "upper-left");
  match = takeTurn(match, "player", kill("upper-left"));
  assert.equal(match.suddenDeath.length, 1); assert.equal(match.suddenDeath[0].target, "upper-left"); assert.equal(match.suddenDeath[0].player.score, 8);
  assert.equal(match.player.length, 10, "sudden death never adds game throws"); assert.equal(turnOf(match), "opponent");
  match = takeTurn(match, "opponent", center);
  assert.equal(matchResult(match).winner, "player"); assert.deepEqual(matchResult(match).suddenDeath, { rounds: 1, winner: "player" }); assert.equal(turnOf(match), null);
  assert.throws(() => takeTurn(match, "player", center), RangeError);
  // both hit the same value: rotate to the next blue
  let m2 = tied(); m2 = takeTurn(m2, "player", kill("upper-left")); m2 = takeTurn(m2, "opponent", kill("upper-left"));
  assert.equal(turnOf(m2), "player"); assert.equal(suddenDeathTarget(m2.suddenDeath.length), "upper-right");
  m2 = takeTurn(m2, "player", kill("upper-right")); m2 = takeTurn(m2, "opponent", { ...kill("upper-right"), x: kill("upper-right").x + .035 });
  assert.equal(matchResult(m2).winner, "player", "8 beats 7");
  // misses: attempts one and two just rotate, the third is measured
  let m3 = tied(); const miss = { x: .3, y: .3, power: .62 }, nearMiss = { x: KILLS[3].x - .12, y: KILLS[3].y, power: .62 };
  m3 = takeTurn(m3, "player", miss); m3 = takeTurn(m3, "opponent", miss); assert.equal(turnOf(m3), "player");
  m3 = takeTurn(m3, "player", nearMiss); m3 = takeTurn(m3, "opponent", miss); assert.equal(turnOf(m3), "player", "attempt two is not measured");
  assert.equal(MEASURE_FROM, 2); assert.equal(m3.suddenDeath[2 - 1].target, "upper-right");
  m3 = takeTurn(m3, "player", nearMiss); m3 = takeTurn(m3, "opponent", miss);
  assert.equal(matchResult(m3).winner, "player", "the shorter measured distance wins from the third attempt");
  let m4 = tied(); for (let i = 0; i < 2; i++) { m4 = takeTurn(m4, "player", miss); m4 = takeTurn(m4, "opponent", miss); }
  m4 = takeTurn(m4, "player", drop); m4 = takeTurn(m4, "opponent", miss);
  assert.equal(matchResult(m4).winner, "opponent", "a drop is unmeasurable and loses to a stuck axe");
  let m5 = tied(); for (let i = 0; i < 2; i++) { m5 = takeTurn(m5, "player", miss); m5 = takeTurn(m5, "opponent", miss); }
  m5 = takeTurn(m5, "player", drop); m5 = takeTurn(m5, "opponent", drop);
  assert.equal(turnOf(m5), "player", "two unmeasurable axes rethrow"); assert.equal(suddenDeathWinner(m5.suddenDeath), null);
  assert.equal(m5.suddenDeath.length, 3); assert.equal(suddenDeathTarget(3), "lower-left"); assert.equal(suddenDeathTarget(4), "upper-left");
});
test("sudden death ignores call limits and height closures, and the opponent aims the round's blue", () => {
  const upper = kill("upper-left"), lower = kill("lower-left");
  let match = createMatch("hard", 3);
  for (let i = 0; i < 10; i++) {
    const input = i === 0 ? { ...upper, called: "upper-left" } : i === 1 ? { ...lower, called: "lower-left" } : center;
    match = takeTurn(match, "player", input); match = takeTurn(match, "opponent", input);
  }
  assert(inSuddenDeath(match)); assert.equal(killState(match.player, 10).remaining, 0);
  match = takeTurn(match, "player", upper); assert.equal(match.suddenDeath[0].player.score, 8);
  const plan = planOpponent(match); assert.equal(plan.called, "upper-left");
  assert(Math.abs(plan.x - KILLS[0].x) <= DIFFICULTIES.hard.kill && Math.abs(plan.y - KILLS[0].y) <= DIFFICULTIES.hard.kill);
});
test("calls, bonus calls and closures belong to each individual history and the chosen division", () => {
  let match = createMatch("normal", 0, "am");
  const upper = { ...kill("upper-left"), called: "upper-left" }, lower = { ...kill("lower-left"), called: "lower-left" };
  match = takeTurn(match, "player", upper);
  assert.deepEqual(killState(match.player, 10).closed, ["upper"]); assert.deepEqual(killState(match.opponent, 10).closed, []);
  match = takeTurn(match, "opponent", upper);
  assert.throws(() => takeTurn(match, "player", upper), RangeError);
  match = takeTurn(match, "player", lower);
  match = takeTurn(match, "opponent", { ...lower, power: .1 });
  assert.deepEqual(killState(match.player, 10).closed, ["upper", "lower"]); assert.equal(killState(match.player, 10).remaining, 0);
  assert.deepEqual(killState(match.opponent, 10).closed, ["upper"]); assert.equal(killState(match.opponent, 10).remaining, 1, "the opponent's drop earned a bonus call");
  assert.throws(() => takeTurn(match, "player", lower), RangeError);
  match = takeTurn(match, "player", center); match = takeTurn(match, "opponent", center);
  match = takeTurn(match, "player", center);
  assert.equal(match.player.at(-1).score, 5, "Am closes the centre bull for the player");
  match = takeTurn(match, "opponent", center);
  assert.equal(match.opponent.at(-1).score, 5);
  assert(closuresOf(match.player, match.player.length, 10, "am").bull.has("center"));
  const pro = takeTurn(takeTurn(createMatch("normal", 0, "pro"), "player", center), "opponent", center);
  assert.equal(takeTurn(pro, "player", center).player.at(-1).score, 0, "Pro scores zero on a reused five ring");
  assert.throws(() => createMatch("normal", 0, "elite"), RangeError);
});
test("the opponent reads its own closures: centre first, then an open outer bull", () => {
  assert.equal(openAim([], "pro").id, "center");
  const history = [resolveThrow(center, [], { division: "pro", throws: 10 })];
  assert.equal(openAim(history, "pro").id, "ul");
  const am = [resolveThrow(center, [], { division: "am", throws: 10 })];
  assert.equal(openAim(am, "am").id, "center", "a closed six still offers the five");
  am.push(resolveThrow(center, am, { division: "am", throws: 10 }));
  assert.equal(openAim(am, "am").id, "ul");
  let match = createMatch("hard", 11, "pro");
  for (let i = 0; i < 5; i++) { match = takeTurn(match, "player", center); match = takeTurn(match, "opponent", planOpponent(match)); }
  const clusters = match.opponent.filter(s => !s.called).map(s => s.zone.cluster);
  assert.equal(new Set(clusters.filter(Boolean)).size, clusters.filter(Boolean).length, "a hard Pro opponent spreads its first-half hits over different reds");
});
test("seed fixes opposing inputs independently of player scores; calls on throws five and ten, a bonus call on eight", () => {
  const high = play(489, "normal"), low = play(489, "normal", { ...center, power: .1 });
  assert.deepEqual(high.opponent, low.opponent);
  assert.deepEqual(high.opponent.flatMap((shot, i) => shot.called ? [i + 1] : []), [5, 10]);
  assert.equal(high.opponent[4].called, KILLS[0].id); assert.equal(high.opponent[9].called, KILLS[2].id);
  assert.notDeepEqual(high.opponent, play(490, "normal").opponent);
  let bonus = null;
  for (let seed = 0; seed < 400 && !bonus; seed++) { const m = play(seed, "easy"); if (m.opponent.slice(0, 7).some(s => !s.stuck) && m.opponent[7].called) bonus = m; }
  assert(bonus, "an easy opponent that dropped spends its bonus call on throw eight");
  assert.equal(KILLS.find(k => k.id === bonus.opponent[7].called).row, "lower");
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
      assert(killState(match.opponent, 10).remaining <= killState(match.opponent, 10).bonus, "both base calls are always spent");
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
test("canonical match lines cover opponent outcomes, point gaps, calls, halves, sudden death and final results", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/axe_versus.json", import.meta.url)));
  const lines = Object.fromEntries(data.axe_versus.lines.map(line => [line.id, line.text]));
  for (const line of data.axe_versus.lines) { assert.equal(line.speaker, "hiyori"); assert(line.text.length <= 48); }
  for (const key of ["switch", "sudden", "sudden-call", "sudden-hit", "sudden-miss", "sudden-player-hit", "sudden-player-miss"]) assert.equal(typeof lines[key], "string", key);
  let match = takeTurn(createMatch(), "player", center);
  assert.equal(matchReaction(lines, "opponent-ready", match, "opponent", { called: KILLS[0].id }).text, lines.call);
  for (const outcome of ["hit", "bull", "killshot", "killshot-miss", "miss", "drop"]) {
    assert.equal(matchReaction(lines, "result", { ...match, opponent: [{ score: 0, outcome }] }, "opponent").text, lines[outcome]);
  }
  assert.equal(matchReaction(lines, "choice", match, "player").text, lines.behind);
  assert.equal(matchReaction(lines, "choice", match, "player", null, null, { switching: true }).text, lines.switch);
  assert.equal(matchReaction(lines, "summary", match, "player").text, lines.player);
  const sd = tied();
  assert.equal(matchReaction(lines, "choice", sd, "player", null, "upper-left", { suddenDeath: true }).text, lines.sudden);
  assert.equal(matchReaction(lines, "opponent-ready", sd, "opponent", { called: "upper-left" }, "upper-left", { suddenDeath: true }).text, lines["sudden-call"]);
  assert.equal(matchReaction(lines, "result", sd, "opponent", { score: 8 }, "upper-left", { suddenDeath: true }).face, "axe_shout");
});
