import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { KILLS, BULLS, resolveThrow } from "../js/minigames/axe-model.js";
import { CHALLENGES, pickChallenges, evaluateChallenges, heatOf, rankOf, titleOf, rankTargets } from "../js/minigames/axe-challenges.js";
import { COMPANIONS, reaction, matchReaction } from "../js/minigames/axe-companions.js";
import { createMatch, takeTurn } from "../js/minigames/axe-match.js";

const shot = (x = 0, y = 0, power = .62, called = null, history = []) => resolveThrow({ x, y, power, called }, history);

test("each session picks one known goal per tier, reproducibly from the seed", () => {
  for (const mode of ["practice", "league", "versus"]) for (let seed = 0; seed < 200; seed++) {
    const ids = pickChallenges(mode, seed);
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    ids.forEach(id => assert(CHALLENGES[id], id));
    assert.deepEqual(pickChallenges(mode, seed), ids);
  }
  const seen = new Set(Array.from({ length: 200 }, (_, seed) => pickChallenges("league", seed).join()));
  assert(seen.size > 4, "different seeds give different sets");
});

test("goals clear on the throw that earns them; end goals wait for the finish and fail on a drop", () => {
  const bull = shot(), drop = shot(0, 0, .95);
  assert.equal(evaluateChallenges(["bull"], [])[0].state, "open");
  assert.equal(evaluateChallenges(["bull"], [bull])[0].state, "done");
  assert.equal(evaluateChallenges(["no-drop"], [bull])[0].state, "open");
  assert.equal(evaluateChallenges(["no-drop"], [bull, bull, bull], true)[0].state, "done");
  assert.equal(evaluateChallenges(["no-drop"], [bull, drop])[0].state, "failed");
  assert.equal(evaluateChallenges(["sweet-all"], [shot(0, 0, .45)])[0].state, "failed");
  assert.equal(evaluateChallenges(["bull-3"], [bull], true)[0].state, "failed");
  const [first] = KILLS, kill = shot(first.x, first.y, .62, first.id);
  assert.equal(evaluateChallenges(["kill"], [kill])[0].state, "done");
  assert.deepEqual(evaluateChallenges(["run-3x5"], [bull, bull]).map(c => [c.value, c.goal]), [[2, 3]]);
  assert.equal(evaluateChallenges(["total-12"], [bull, bull])[0].state, "done");
  assert.equal(evaluateChallenges(["first-stick"], [drop, bull])[0].state, "open");
  const outer = shot(BULLS[0].x, BULLS[0].y);
  assert.equal(evaluateChallenges(["outer-bull"], [bull])[0].state, "open");
  assert.equal(evaluateChallenges(["outer-bull"], [outer])[0].state, "done");
  const lower = KILLS[2], killLow = shot(lower.x, lower.y, .62, lower.id, [kill]);
  assert.deepEqual(evaluateChallenges(["kill-both"], [kill]).map(c => [c.value, c.goal]), [[1, 2]]);
  assert.equal(evaluateChallenges(["kill-both"], [kill, killLow])[0].state, "done");
  assert.equal(evaluateChallenges(["average-5"], Array(10).fill(bull), true)[0].state, "done");
  assert.equal(evaluateChallenges(["average-5"], Array(10).fill(shot(.3, 0)), true)[0].state, "failed");
});

test("heat counts the current run of 5+ points; rank and title read the whole session", () => {
  const bull = shot(), low = shot(.7, 0);
  assert.equal(heatOf([]), 0); assert.equal(heatOf([bull, bull]), 2); assert.equal(heatOf([bull, bull, low]), 0);
  assert.equal(rankOf(22, 22), "S"); assert.equal(rankOf(0, 22), "D"); assert.equal(rankOf(32, 64), "B");
  assert.equal(titleOf([bull, bull, bull], 22), "ブルハンター");
  const outer = shot(BULLS[0].x, BULLS[0].y), outer2 = shot(BULLS[1].x, BULLS[1].y);
  assert.equal(titleOf([bull, outer, outer2], 22), "パーフェクト6の人");
  assert.equal(titleOf([], 22), "見学者");
  assert.equal(typeof titleOf([low, shot(0, 0, .95)], 22), "string");
});
// 2026-11-13 指摘12: 次のランクまでの残り点を、近い順に
test("rank targets list the higher ranks nearest first with the points still needed", () => {
  assert.deepEqual(rankTargets(14, 22), [{ rank: "S", need: 4 }]);
  assert.deepEqual(rankTargets(0, 22).map(t => t.rank), ["C", "B", "A", "S"]);
  assert.deepEqual(rankTargets(18, 22), []);
  for (let total = 0; total <= 64; total++) for (const t of rankTargets(total, 64)) {
    assert.equal(rankOf(total + t.need, 64) <= t.rank || rankOf(total + t.need, 64) === "S", true);
    assert.notEqual(rankOf(total + t.need - 1, 64), t.rank, "need is the least");
  }
  assert.deepEqual(rankTargets(5, 0), []);
});

test("companion lines stay in voice, fit one bubble and react to streaks and the last throw", () => {
  for (const [id, c] of Object.entries(COMPANIONS)) {
    if (id === "adam") continue; // アダムは対戦専用で、反応は axe_versus.json に置く。
    const all = [...Object.entries(c).filter(([k]) => !["name", "portraitKey", "titleSuffix", "faces", "focus", "summary"].includes(k)).flatMap(([, v]) => v),
      ...Object.values(c.summary)];
    for (const text of all) { assert.equal(typeof text, "string"); assert(text.length <= 32, text); assert(!text.endsWith("。"), text); }
    if (id === "shark") Object.values(c.summary).forEach(text => assert.match(text, /お主/));
    const bull = shot();
    assert(c.streak.includes(reaction(id, "result", [bull, bull], null, { heat: 2 }).text));
    assert(c.last.includes(reaction(id, "choice", [bull, bull], null, { last: true }).text));
    assert.equal(reaction(id, "summary", [], null, { grade: "great" }).text, c.summary.great);
  }
  // 2026-11-13 指摘5: 練習相手の一言は操作の種類に依らない（旧ゲージの「横、縦、回転の順」「緑の帯で待つ・止める」を言わない）。落下は理由で選ぶ
  for (const id of ["hiyori", "shark"]) {
    const c = COMPANIONS[id], words = [...c.before, ...c.drop, ...c.dropWeak, ...c.dropSpin];
    for (const text of words) assert.doesNotMatch(text, /横、縦|縦、回転|緑の帯|帯に合わせ|止めて|止める/, text);
    const weak = { outcome: "drop", dropReason: "weak", score: 0 }, spin = { outcome: "drop", dropReason: "rotation", score: 0 };
    assert(c.dropWeak.includes(reaction(id, "result", [weak], null).text));
    assert(c.dropSpin.includes(reaction(id, "result", [spin], null).text));
    assert(c.drop.includes(reaction(id, "result", [{ outcome: "drop", score: 0 }], null).text));
    assert(c.bonus.includes(reaction(id, "result", [weak], null, { bonus: true }).text), "the bonus line still wins");
  }
  // The first result always uses the first, canonical outcome line.
  assert.match(reaction("shark", "result", [{ outcome: "killshot", score: 8 }], null).text, /小さい的/);
});

test("versus lines cover the last throw and big gaps", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/axe_versus.json", import.meta.url)));
  const lines = Object.fromEntries(data.axe_versus.lines.map(line => [line.id, line.text]));
  let match = createMatch();
  for (let i = 0; i < 9; i++) {
    match = takeTurn(match, "player", { x: 0, y: 0, power: .62 });
    match = takeTurn(match, "opponent", { x: 0, y: 0, power: .1 });
  }
  assert.equal(matchReaction(lines, "choice", match, "player").text, lines["player-last"]);
  match = takeTurn(match, "player", { x: 0, y: 0, power: .62 });
  assert.equal(matchReaction(lines, "opponent-ready", match, "opponent", {}).text, lines.last);
  let gap = createMatch();
  gap = takeTurn(gap, "player", { x: 0, y: 0, power: .62 }); gap = takeTurn(gap, "opponent", { x: 0, y: 0, power: .1 });
  gap = takeTurn(gap, "player", { x: 0, y: 0, power: .62 }); gap = takeTurn(gap, "opponent", { x: 0, y: 0, power: .1 });
  assert.equal(matchReaction(lines, "choice", gap, "player").text, lines["big-behind"]);
});
