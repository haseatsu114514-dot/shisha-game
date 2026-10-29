import assert from "node:assert/strict";
import {
  PROCESS_CAP, carryPForScenario, createCh3TournamentEvaluate, defaultScenarios,
  measurementMarkdown, pairedOperationDeltas, runMeasurement, summarizeRows, validateScenario,
} from "../js/core/ngplus-measurement.js";
import { setRivalScoreObserver } from "../js/core/ngplus-difficulty.js";
import * as tournament from "../js/chapters/ch3-tournament-state.js";

const stats = n => Object.fromEntries(["technique", "sense", "guts", "charm", "insight"].map(key => [key, n]));
let checks = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const ok = value => { assert.ok(value); checks++; };

// シナリオ検証: 既定値の補完と入力の不変。
equal(validateScenario({ id: "x", chapter: 3 }).operation, "mid");
equal(validateScenario({ id: "x", chapter: 3 }).bonuses, { equip: false, rehearsal: false });
assert.throws(() => validateScenario({ chapter: 3 }), TypeError); checks++;
assert.throws(() => validateScenario({ id: "x", chapter: 3, operation: "wild" }), TypeError); checks++;
const rawScenario = { id: "raw", chapter: 3, cycleStartStats: stats(10), playStats: stats(10) };
validateScenario(rawScenario);
equal(rawScenario.cycle, undefined);

// P は開始スナップショット（cycleStartStats）だけから決まり、playStats では変わらない。
// difficultyForRun は周回開始値 cycleStartStats を直接参照する。
equal(carryPForScenario({ id: "a", chapter: 3, cycle: 1, carryStats: true, cycleStartStats: stats(100) }), 0);
equal(carryPForScenario({ id: "a", chapter: 3, cycle: 2, carryStats: false, cycleStartStats: stats(100) }), 0);
equal(carryPForScenario({ id: "a", chapter: 3, cycle: 2, carryStats: true, cycleStartStats: stats(100) }), 1);
equal(carryPForScenario({ id: "a", chapter: 3, cycle: 3, carryStats: true, cycleStartStats: stats(55), playStats: stats(10) }),
  carryPForScenario({ id: "a", chapter: 3, cycle: 3, carryStats: true, cycleStartStats: stats(55), playStats: stats(100) }));
equal(carryPForScenario({ id: "a", chapter: 3, cycle: 3, carryStats: true, cycleStartStats: stats(55) }), .5);

// 第3章アダプター: 実物の投票・順位計算を使い、手計算の直接実行と一致する。
const base = { chapter: 3, cycle: 1, carryStats: false, cycleStartStats: stats(10), playStats: stats(55), mastery: .5 };
const constant = performance => createCh3TournamentEvaluate({ performanceOf: () => performance });
const seeds = [1, 7, 42];
const strong = runMeasurement({ scenarios: [{ ...base, id: "strong", operation: "perfect" }], seeds, evaluate: constant(100) });
const lifted = runMeasurement({ scenarios: [{ ...base, id: "lifted", cycle: 2, carryStats: true,
  cycleStartStats: stats(100), operation: "perfect" }], seeds: [1], evaluate: constant(100) });
equal(lifted[0].p, 1);
ok(lifted[0].rivalSamples.some(s => s.lifted > s.rival), "持ち込みありでは相手点が上がる");
for (const row of strong) {
  equal(row.rank, 1);
  equal(row.p, 0);
  equal(row.rivalSamples.length, 12); // 相手3人×4ラウンド
  ok(row.rivalSamples.every(s => s.rival === s.lifted && s.chapter === 3)); // P=0 なら無変化
  equal(Object.values(row.votes).reduce((sum, v) => sum + v, 0), 30); // SPEND合計10×審査員3人
}
const direct = { chapter: 3, day: 42, weatherSeed: 7, flags: {} };
const directProgress = tournament.startAttempt(direct, { careHistory: [] });
for (let round = 0; round < 4; round++) tournament.castVotes(directProgress, round, 100, null, 0);
equal(strong.find(r => r.seed === 7).votes,
  Object.fromEntries(tournament.standings(directProgress).map(r => [r.id, r.points])));
const weak = runMeasurement({ scenarios: [{ ...base, id: "weak", operation: "poor" }], seeds, evaluate: constant(0) });
ok(weak.every(row => row.rank === 4));
// 再現性: 同一条件・同一シードは完全に同じ行を返す。
equal(runMeasurement({ scenarios: [{ ...base, id: "strong", operation: "perfect" }], seeds, evaluate: constant(100) }), strong);

// 対応比較: 同じシードで操作条件だけを変えると、相手サンプル列は同一になる。
const operationPerformance = { poor: 40, mid: 60, perfect: 85 };
const paired = runMeasurement({
  scenarios: ["poor", "mid", "perfect"].map(operation => ({ ...base, id: `op-${operation}`, operation, group: "operation" })),
  seeds, evaluate: createCh3TournamentEvaluate({ performanceOf: s => operationPerformance[s.operation] }),
});
for (const seed of seeds) {
  const samples = paired.filter(r => r.seed === seed).map(r => r.rivalSamples);
  equal(samples[0], samples[1]); equal(samples[1], samples[2]);
}

// 例外時も observer は解除され、後続の計測へ混ざらない。
const throwing = createCh3TournamentEvaluate({ performanceOf: () => { throw new Error("adapter failed"); } });
assert.throws(() => runMeasurement({ scenarios: [{ ...base, id: "boom" }], seeds: [1], evaluate: throwing }), /adapter failed/); checks++;
const external = [];
setRivalScoreObserver(sample => external.push(sample));
const probe = { chapter: 3, day: 42, weatherSeed: 3, flags: {} };
tournament.castVotes(tournament.startAttempt(probe, { careHistory: [] }), 0, 50, null, 0);
equal(external.length, 3); // ハーネスの収集口ではなく自前の observer だけが受ける
setRivalScoreObserver(null);
const noop = runMeasurement({ scenarios: [{ ...base, id: "noop" }], seeds: [1], evaluate: () => ({}) });
equal(noop[0].rivalSamples, []);
equal(noop[0].total, null);

// 飽和と集計: 工程点はアダプターが返し、ハーネスが上限到達を数える。
const synthetic = runMeasurement({
  scenarios: [{ ...base, id: "sat" }],
  seeds: [1],
  evaluate: () => ({ processScores: [100, 82, 100, 40, 100], total: 84.4, rank: 2, votes: null }),
});
equal(synthetic[0].saturatedProcesses, [0, 2, 4]);
const satSummary = summarizeRows(synthetic);
equal(satSummary[0].saturationRateByProcess, [1, 0, 1, 0, 1]);
equal(satSummary[0].rankDistribution, { 2: 1 });
const spread = summarizeRows(runMeasurement({
  scenarios: [{ ...base, id: "one" }, { ...base, id: "two" }, { ...base, id: "three" }],
  seeds: [1], evaluate: s => ({ total: { one: 10, two: 20, three: 30 }[s.id], rank: 1 }),
}));
equal(spread.find(s => s.scenarioId === "two").total, { mean: 20, min: 20, max: 20, q25: 20, median: 20, q75: 20 });
const manual = summarizeRows([
  { scenarioId: "m", chapter: 3, total: 10, processScores: null, rank: 1 },
  { scenarioId: "m", chapter: 3, total: 20, processScores: null, rank: 1 },
  { scenarioId: "m", chapter: 3, total: 30, processScores: null, rank: 2 },
]);
equal(manual[0].total, { mean: 20, min: 10, max: 30, q25: 15, median: 20, q75: 25 });
equal(manual[0].rankDistribution, { 1: 2, 2: 1 });

// 操作間の対応差: 同じ group・同じシード同士で total の平均差を取る。
const deltaRows = runMeasurement({
  scenarios: [
    { ...base, id: "d-poor", operation: "poor", group: "op" },
    { ...base, id: "d-perfect", operation: "perfect", group: "op" },
  ],
  seeds: [1, 2], evaluate: s => ({ total: s.operation === "perfect" ? 25 : 10, rank: 1 }),
});
equal(pairedOperationDeltas(deltaRows, [
  { ...base, id: "d-poor", operation: "poor", group: "op" },
  { ...base, id: "d-perfect", operation: "perfect", group: "op" },
]), [{ group: "op", from: "poor", to: "perfect", runs: 2, meanDelta: 15 }]);

// ラウンド別 performance と工程点の透過（実工程計算を接続する注入点の形）。
const roundsAdapter = createCh3TournamentEvaluate({
  performanceOf: () => ({ rounds: [90, 92, 94, 96], processScores: [100, 90, 80, 70, 60] }),
});
const roundsRow = runMeasurement({ scenarios: [{ ...base, id: "rounds" }], seeds: [5], evaluate: roundsAdapter })[0];
equal(roundsRow.total, 96);
equal(roundsRow.processScores, [100, 90, 80, 70, 60]);
equal(roundsRow.saturatedProcesses, [0]);
assert.throws(() => createCh3TournamentEvaluate(), TypeError); checks++;

// 入力の不変と保存領域の隔離: 凍結したシナリオでも計測でき、localStorage は現れない。
const frozen = { ...base, id: "frozen", cycleStartStats: stats(10), playStats: stats(55), bonuses: { equip: true } };
Object.freeze(frozen); Object.freeze(frozen.cycleStartStats); Object.freeze(frozen.playStats); Object.freeze(frozen.bonuses);
runMeasurement({ scenarios: [frozen], seeds: [1], evaluate: constant(50) });
equal(globalThis.localStorage, undefined);

// 標準掃引: id の一意性と、操作・周回の対応グループが揃っていること。
const defaults = defaultScenarios();
equal(new Set(defaults.map(s => s.id)).size, defaults.length);
equal(defaults.filter(s => s.group === "operation").map(s => s.operation).join(), "poor,mid,perfect");
ok(defaults.some(s => s.id === "ch3-cycle2-carry" && s.cycle === 2 && s.carryStats === true));
for (const scenario of defaults) validateScenario(scenario);
checks++;

// Markdown 表: シナリオと試行条件の注記を含む。
const markdown = measurementMarkdown([...satSummary, ...manual], [], { seeds });
ok(markdown.includes("| sat | 1 | 84.40 |"));
ok(markdown.includes("試行数: シナリオ×シード"));
equal(PROCESS_CAP, 100);

console.log(`PASS: ${checks} U5 assertions; ch3 adapter on real castVotes/standings, observer isolation, aggregation`);
