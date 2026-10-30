import assert from "node:assert/strict";
import { newState } from "../js/core/state.js";
import { CONTESTANTS, JUDGES, SPEND, tournamentProgress, resources, startAttempt,
  beginStep, finishStep, recoverStep, buildTastingPlan, tastingEffect,
  castVotes, standings, recordResult, CH3_PRIZE } from "../js/chapters/ch3-tournament-state.js";

const copy = value => JSON.parse(JSON.stringify(value));
const makeState = () => {
  const value = newState();
  value.chapter = 3; value.day = 42; value.stamina = 78; value.weatherSeed = 7317;
  value.flavorStock = { double_apple: 44, citrus: 28 };
  value.flags._ch2_tournament = { stage: "complete", result: { rank: 1 } };
  value.tournament = { attempts: 2, lastRank: 1 };
  value.lovers = ["minto"]; value.contacts = ["sumi", "minto"];
  return value;
};
const craft = { careHistory: [], total: 0 };

assert.deepEqual(CONTESTANTS, ["hajime", "kuze", "steve", "volk"]);
assert.deepEqual(JUDGES, ["emil", "dr_kemuri", "nagumo"]);
assert.equal(SPEND.reduce((sum, value) => sum + value, 0), 10);
const value = makeState(), before = copy(value);
assert.equal(tournamentProgress(value).stage, "entry");
let p = startAttempt(value, craft);
assert.equal(p.attempts, 1);
assert.equal(startAttempt(value, craft).attempts, 1); // 二度押しでも二台目にしない
assert.deepEqual(p.tastingPlan, buildTastingPlan(p.tastingSeed));
for (const round of p.tastingPlan) for (const judge of JUDGES) {
  assert.deepEqual([...round[judge].order].sort(), [...CONTESTANTS].sort());
  if (judge === "nagumo") assert.equal(round[judge].waterAfterKuze, true);
}

// 現在工程だけはLOAD時に戻り、確定済みの前工程は戻らない。
beginStep(value); value.flavorStock.double_apple -= 9; value.stamina -= 3;
beginStep(value); value.flavorStock.citrus -= 4; // 二度呼んでも開始スナップを上書きしない
const midStep = copy(value); recoverStep(midStep);
assert.deepEqual(resources(midStep), resources(before));
assert.equal(midStep.flags._ch3_tournament.step, 0);
recoverStep(midStep); assert.deepEqual(resources(midStep), resources(before));
finishStep(value, { ...craft, mix: { double_apple: 9 } });
const committed = copy(value); recoverStep(committed);
assert.equal(committed.flavorStock.double_apple, 35);
assert.equal(committed.flavorStock.citrus, 24);
assert.equal(committed.stamina, 75);
assert.equal(committed.flags._ch3_tournament.step, 1);

// 柑橘の残り香は直後の試喫だけ。水を飲めばゼロ、次が他人ならはじめに作用しない。
const direct = { order: ["kuze", "hajime", "volk", "steve"], waterAfterKuze: false };
assert.deepEqual(tastingEffect(direct, "emil"), { ...direct, affected: "hajime", delta: -2 });
assert.deepEqual(tastingEffect(direct, "dr_kemuri"), { ...direct, affected: "hajime", delta: 2 });
assert.equal(tastingEffect({ ...direct, waterAfterKuze: true }, "emil").delta, 0);
assert.equal(tastingEffect({ order: ["kuze", "steve", "hajime", "volk"], waterAfterKuze: false }, "emil").affected, "steve");
assert.equal(tastingEffect({ order: ["hajime", "volk", "steve", "kuze"], waterAfterKuze: false }, "emil").affected, null);
const plans = Array.from({ length: 32 }, (_, seed) => buildTastingPlan(seed)[0].emil);
assert(plans.some(plan => plan.order[0] === "kuze"));
assert(plans.some(plan => plan.order[0] !== "kuze"));
assert(plans.some(plan => plan.waterAfterKuze));
assert(plans.some(plan => !plan.waterAfterKuze));
const withWater = startAttempt(makeState(), craft);
const withoutWater = startAttempt(makeState(), craft);
withWater.tastingPlan[1].dr_kemuri = { ...direct, waterAfterKuze: true };
withoutWater.tastingPlan[1].dr_kemuri = direct;
castVotes(withWater, 0, 83);
castVotes(withoutWater, 0, 83);
assert.deepEqual(withWater.votes, withoutWater.votes, "The pre-service poll cannot taste Kuze's aroma");
assert(JUDGES.every(judge => withWater.lastVotes[judge].tactic === null));
castVotes(withWater, 1, 83);
castVotes(withoutWater, 1, 83);
assert.equal(withWater.votes.dr_kemuri.hajime, 0);
assert.equal(withoutWater.votes.dr_kemuri.hajime, 2);

// 4回の票は各審査員10点。投票の再呼出し、JSON保存・再開でも加算しない。
let prior = copy(p.votes);
for (const [round, quality] of [95, 40, 97, 95].entries()) {
  assert.equal(castVotes(p, round, quality), true);
  for (const judge of JUDGES) {
    const last = p.lastVotes[judge];
    const gained = Object.fromEntries(CONTESTANTS.map(id => [id, p.votes[judge][id] - prior[judge][id]])
      .filter(([, points]) => points > 0));
    assert.deepEqual(last.points, gained);
    assert.equal(Object.values(gained).reduce((sum, points) => sum + points, 0), SPEND[round]);
  }
  const after = copy(p.votes);
  assert.equal(castVotes(p, round, quality), false);
  assert.deepEqual(p.votes, after);
  p = copy(p); value.flags._ch3_tournament = p;
  prior = copy(p.votes);
}
for (const judge of JUDGES) assert.equal(CONTESTANTS.reduce((sum, id) => sum + p.votes[judge][id], 0), 10);

// 不正な持ち点でも全審査員を一部だけ確定しない。
const bad = startAttempt(makeState(), craft);
bad.votes.nagumo.kuze = 10;
const untouched = copy(bad.votes);
assert.throws(() => castVotes(bad, 0, 90), /持ち点/);
assert.deepEqual(bad.votes, untouched);
assert.equal(bad.voted, 0);

assert.throws(() => recordResult(value, 95), /2回/);
p.step = 11; p.craft.careHistory = [{ score: 90 }, { score: 94 }];
const result = recordResult(value, 95);
assert.deepEqual(recordResult(value, 95), result);
assert.equal(p.history.length, 1);
assert.equal(result.win, result.rank === 1);
assert.equal(result.careHistory.length, 2);
assert.deepEqual(result.tastingPlan, p.tastingPlan);

// 敗北後だけ再戦し、失敗した一台の消費は元へ。以前の章と交流は保持する。
p.stage = "defeat";
p.failure = "low_score";
p.defeatRead = true;
startAttempt(value, craft);
assert.equal(p.attempts, 2);
assert.equal(p.voted, 0);
assert.equal(p.defeatRead, false, "A new failed attempt must be able to read its own defeat scene");
assert.deepEqual(resources(value), resources(before));
assert.equal(p.history.length, 1);
assert.equal(CH3_PRIZE, 100000, "decided chapter 3 prize");
assert.equal(value.money, before.money + (result.win ? CH3_PRIZE : 0), "prize follows the recorded result and survives retry");
for (const key of ["tournament", "lovers", "contacts", "inbox", "keepsakes", "relationshipMemories"]) {
  assert.deepEqual(value[key], before[key], key);
}

// 制作の高低で勝敗が変わる。低品質の一台を脚本だけで優勝へ変えない。
for (const [quality, expectedWin] of [[98, true], [25, false]]) {
  const caseState = makeState(), caseProgress = startAttempt(caseState, craft);
  for (let round = 0; round < SPEND.length; round++) castVotes(caseProgress, round, quality);
  caseProgress.step = 11;
  caseProgress.craft.careHistory = [{ score: quality }, { score: quality }];
  const moneyBefore = caseState.money;
  const outcome = recordResult(caseState, quality);
  assert.equal(outcome.win, expectedWin);
  assert.equal(outcome.rank, standings(caseProgress).find(row => row.id === "hajime").rank);
  assert.equal(caseState.money, moneyBefore + (expectedWin ? CH3_PRIZE : 0), "prize only on a win");
  recordResult(caseState, quality);
  assert.equal(caseState.money, moneyBefore + (expectedWin ? CH3_PRIZE : 0), "prize is paid once");
}
assert.throws(() => tournamentProgress({ chapter: 2, flags: {} }), /第3章/);
console.log("PASS: chapter3 four-person 3x10 voting, conditional citrus, save rollback, retry and honest ranking");
