import assert from "node:assert/strict";
import { beginCh1Votes, castCh1Votes, ch1Standings, CH1_JUDGES, CH1_CONTESTANTS } from "../js/craft/ch1-votes.js";

const craft = parts => ({ holes: { score: parts[0] }, heat: { score: parts[1] },
  stats: { craftQuality: parts[2] }, careHistory: [{ score: parts[3] }, { score: parts[4] }],
  total: parts.reduce((a, b) => a + b, 0) / 5 });
function match(parts) {
  const attempt = {};
  beginCh1Votes(attempt);
  const cs = craft(parts);
  for (let round = 0; round < 4; round++) {
    assert.equal(castCh1Votes(attempt, round, cs), true);
    assert.equal(castCh1Votes(attempt, round, cs), false, "二重投入しない");
  }
  return attempt.voteAttempt;
}
for (const score of [60, 70, 80, 82, 84, 85, 86, 88, 90, 100]) {
  const p = match([score, score, score, score, score]);
  assert.deepEqual(p, match([score, score, score, score, score]), "同じ制作は同じ票");
  for (const judge of CH1_JUDGES) assert.equal(Object.values(p.votes[judge]).reduce((a, b) => a + b, 0), 10);
  assert.equal(p.result.rows.reduce((a, b) => a + b.points, 0), 34);
  assert(p.result.rows.every(row => row.points >= 1), "全員に最低1票");
  const old = structuredClone(p);
  delete old.baseVotes;
  const oldRows = ch1Standings(old, score).rows;
  assert.deepEqual(p.result.rows.map(row => [row.id, row.rank]), oldRows.map(row => [row.id, row.rank]), "基礎票は順位を変えない");
  assert(p.result.rows.every(row => row.points === oldRows.find(previous => previous.id === row.id).points + 1));
}
const mint = match([90, 90, 90, 90, 90]);
assert.equal(CH1_JUDGES.reduce((sum, judge) => sum + mint.votes[judge].minto, 0), 0, "旧方式のみんと0票を再現");
assert.equal(mint.result.rows.find(row => row.id === "minto").points, 1);
assert.equal(CH1_CONTESTANTS.length, 4);
assert.equal(match([80, 80, 80, 80, 80]).result.rank, 4);
assert.equal(match([90, 90, 90, 90, 90]).result.rank, 1);
const close = match([84, 87, 86, 86, 86]);
assert.equal(close.result.rows[0].points - close.result.rows.find(row => row.id === "hajime").points, 1);
assert.equal(close.beforeLast.sui.naru + 1, close.votes.sui.naru);
for (const base of [60, 70, 80, 84, 85, 86, 90]) {
  const baseline = match([base, base, base, base, base]).result.votes;
  for (let part = 0; part < 5; part++) {
    const higher = [base, base, base, base, base]; higher[part] += 2;
    const upgraded = match(higher).result.votes;
    for (const judge of CH1_JUDGES) assert(upgraded[judge].hajime >= baseline[judge].hajime, "改善で得票は減らない");
  }
}
const loaded = JSON.parse(JSON.stringify({ voteAttempt: match([88, 88, 88, 88, 88]) }));
const result = structuredClone(loaded.voteAttempt.result);
assert.equal(castCh1Votes(loaded, 3, craft([100, 100, 100, 100, 100])), false);
assert.deepEqual(loaded.voteAttempt.result, result, "確定済み結果を再計算しない");
console.log("PASS: Chapter 1 deterministic votes, limits, ties, monotonicity and saved result");
