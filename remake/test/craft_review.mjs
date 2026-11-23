import assert from "node:assert/strict";
import { goodPointOf, improvementOf, craftReviewLines } from "../js/craft/advice.js";
import { temperatureBands } from "../js/craft/temperature-model.js";
import { LEAF_MAX, LEAF_FAIL_STEPS } from "../js/craft/flavor-life.js";

const bands = temperatureBands();
const served = { temp: bands.ideal[0] + .01, pulls: 2, score: 100 };
const warm = { temp: bands.ideal[1] - .01, pulls: 1, score: 100 };
const steady = { pull: served, careHistory: [warm, served] };
const repeat = "次の練習：同じ手順でもう一台作り、今回の仕上がりを再現しよう。";
assert.match(goodPointOf(steady), /提供と2回の調整/);
const ngReasons = ["配合の指摘1", "配合の指摘2"];
assert.deepEqual(craftReviewLines({ ...steady, mixInfo: { ngReasons } }).slice(-2), ngReasons);
const coldFinish = { ...steady, careHistory: [warm, { temp: .1, pulls: 1, score: 10 }] };
assert.match(goodPointOf(coldFinish), /提供できた/);
assert.match(improvementOf(coldFinish), /調整2回目.*熱を戻して/);
const overpull = { ...steady, pull: { ...served, pulls: 5 } };
assert.match(improvementOf(overpull), /提供.*吸う回数を減らし/);

// #2190 P23: 実測した温度の失敗・ずれは、吸う回数より先に直す。
const roundCases = [["提供", "pull", 3], ["調整1回目", 0, 2], ["調整2回目", 1, 2]];
const withRound = (key, result, base = steady) => key === "pull"
  ? { ...base, pull: result }
  : { ...base, careHistory: base.careHistory.map((round, i) => i === key ? result : round) };
for (const [label, key, safe] of roundCases) {
  for (const [temp, text] of [[bands.ideal[0] - .01, "少し熱を戻して"], [bands.ideal[1] + .01, "少し下げて"]]) {
    assert.match(improvementOf(withRound(key, { temp, pulls: safe + 1 })), new RegExp(`${label}.*${text}`), `${label}: temperature mismatch must precede excessive pulls`);
  }
  for (const [failed, failedTemp, text] of [["cold", .04, "冷え切る前に炭を交換"], ["burnt", 1, "熱が上がり切る前に下げ吸い"]]) {
    for (const temp of [failedTemp, undefined]) {
      assert.match(improvementOf(withRound(key, { failed, temp, pulls: safe + 1 })), new RegExp(`${label}.*${text}`), `${label}: recorded ${failed} failure must precede excessive pulls`);
    }
  }
  assert.match(improvementOf(withRound(key, { ...served, pulls: safe + 1 })), new RegExp(`${label}.*吸う回数を減らし`), `${label}: ideal temperature still allows excessive-pull advice`);
  assert.equal(improvementOf(withRound(key, { ...served, pulls: safe })), repeat, `${label}: safe-pull threshold is inclusive`);
  const dobaj = { ...steady, mix: { dobaj_test: 12 } };
  assert.equal(improvementOf(withRound(key, { ...served, pulls: safe + 1 }, dobaj)), repeat, `${label}: maker safe-pull bonus is preserved`);
  assert.match(improvementOf(withRound(key, { ...served, pulls: safe + 2 }, dobaj)), /吸う回数を減らし/);
}

// 実際の保存種別は burnt/cold/leaf。葉切れは過熱と分け、累積消耗も扱う。
const depleted = { pull: { ...served, temp: bands.center }, careHistory: [{ ...warm, temp: bands.center }, { ...served, temp: bands.center }],
  leaf: { hp: 0, max: LEAF_MAX, burn: 1, dmg: LEAF_FAIL_STEPS, steps: LEAF_FAIL_STEPS } };
for (const [label, key, safe] of roundCases) {
  const leafResult = { failed: "leaf", score: 0, temp: bands.center, pulls: safe + 1 };
  assert.match(improvementOf(withRound(key, leafResult, depleted)), new RegExp(`${label}.*吸う回数を減らし`), `${label}: ideal-temperature leaf exhaustion keeps excessive-pull advice`);
  // 現runnerの葉切れは過多吸引時。少回数記録は保存済み・不完全な履歴への防御ケース。
  for (const pulls of [0, 1, safe]) {
    const line = improvementOf(withRound(key, { ...leafResult, pulls }, depleted));
    assert.match(line, new RegExp(`${label}.*葉が尽きた.*適温に入った工程から吸い足さず`), `${label}: leaf exhaustion with no local overpull must use the cumulative leaf cause`);
  }
  for (const temp of [undefined, bands.ideal[0] - .01, bands.ideal[1] + .01]) {
    assert.match(improvementOf(withRound(key, { ...leafResult, temp, pulls: 1 }, depleted)), /葉が尽きた/, `${label}: recorded leaf failure must not become a temperature diagnosis`);
  }
  for (const failed of ["burst", "unknown", true, 1]) {
    assert.match(improvementOf(withRound(key, { temp: bands.center, pulls: safe + 1, failed })), new RegExp(`${label}.*吸う回数を減らし`), `${label}: unknown failure must use actual pull-count evidence`);
    assert.match(improvementOf(withRound(key, { temp: .1, pulls: 1, failed })), new RegExp(`${label}.*熱を戻して`), `${label}: unknown failure may use a finite temperature measurement`);
    assert.match(improvementOf(withRound(key, { pulls: 1, failed }, { ...steady, parts: { heat: 70 } })), /炭の全面が赤くなる頃合い/, `${label}: unknown failure without a measurement uses the generic fallback`);
  }
}
assert.match(improvementOf(withRound(1, { failed: "leaf", temp: bands.center, pulls: 1 }, { ...depleted, pull: { ...depleted.pull, pulls: 4 } })), /提供.*吸う回数を減らし/, "Earlier excessive pulls explain later cumulative leaf exhaustion");
console.log("PASS actual thermal/leaf failure kinds and unknown-failure evidence fallbacks");

for (const temp of [undefined, null, NaN, Infinity, -Infinity, "0.1"]) {
  assert.match(improvementOf({ pull: { temp, pulls: 4 } }), /提供.*吸う回数を減らし/, `No temperature cause without a finite measurement: ${temp}`);
}
const multipleMisses = { pull: { temp: .1, pulls: 4 }, careHistory: [{ temp: .8, pulls: 3 }, { temp: .1, pulls: 3 }] };
assert.match(improvementOf(multipleMisses), /提供.*熱を戻して/, "With no scores to compare, tied misses use stage order");
assert.match(improvementOf({ pull: { temp: .8, pulls: 2, score: 45 }, careHistory: [{ temp: .15, pulls: 1, score: 15 }, { temp: .8, pulls: 1, score: 55 }] }),
  /調整1回目.*交換する炭を一つ増やそう/, "Weakest measured temperature round wins");
assert.match(improvementOf({ ...multipleMisses, pull: { ...multipleMisses.pull, failed: "burnt" } }), /提供.*熱が上がり切る前/, "Recorded thermal failure precedes a later missed temperature");
assert.match(improvementOf({ pull: { failed: "cold", pulls: 4 }, careHistory: [{ failed: "burnt", pulls: 3 }] }), /提供.*冷え切る前/, "First recorded thermal failure retains priority");
assert.match(improvementOf({ pull: { ...served, pulls: 4 }, careHistory: [{ ...served, pulls: 3 }, { ...served, pulls: 3 }] }), /提供.*吸う回数を減らし/, "First excessive round retains priority");
assert.match(improvementOf({ ...steady, parts: { holes: 80, heat: 70, shisha: 90 } }), /炭の全面が赤くなる頃合い/, "Weakest-part fallback retains priority when all temperatures and pull counts are safe");
console.log("PASS temperature advice precedes excessive pulls with recorded evidence and preserves existing priorities");

assert.equal(goodPointOf({}), "", "Do not invent successes for an unfinished session");
assert.equal(improvementOf({ parts: { invented: -99 } }), "");
assert.match(improvementOf({ careHistory: [{ failed: "cold", temp: .04, pulls: 1 }] }), /冷え切る前に炭を交換/);
assert.doesNotMatch(improvementOf(steady), /最適温/, "Do not steer a valid low/high expression back to the center");
console.log("PASS review uses recorded actions, preserves a success and suggests one change");

const clean = {
  holes: { score: 96 }, heat: { score: 97, picks: ["just", "just", "just"] }, steam: { score: 100, hits: 0 },
  pull: { ...served, temp: bands.center, inZone: true, optimal: true, justs: 2 },
  careHistory: [{ ...warm, inZone: true }, { ...served, inZone: true }],
  parts: { shisha: 68 },
};
const weakSteam = { score: 0, hits: 8 };
const offCenter = { ...clean.pull, temp: served.temp, score: 74, optimal: false, justs: 0 };
assert.equal(improvementOf(clean), repeat, "Composite quality cannot invent a weakness in an otherwise clean cup");
assert.match(improvementOf({ ...clean, steam: weakSteam, pull: offCenter }), /蒸らし、雑念に囲まれる前にリフレッシュ/);
assert.match(improvementOf({ ...clean, steam: { score: 86, hits: 1 } }), /蒸らしでは雑念が近づく前に、心を空いている方へ動か/);
assert.match(improvementOf({ ...clean, pull: offCenter, steam: { score: 86, hits: 1 } }), /キープの芯で針を止め/);
assert.equal(improvementOf({ ...clean, pull: { ...offCenter, justs: 1 } }), repeat, "A valid chosen temperature does not need correction");
assert.equal(improvementOf({ ...clean, pull: { ...offCenter, attack: true } }), repeat, "An intentional attack-band finish does not need needle advice");
assert.match(improvementOf({ ...clean, pull: { ...offCenter, inZone: false, under: true, temp: .2, score: 15 }, steam: { score: 58, hits: 3 } }),
  /提供.*上げ吸いを一口/, "The lower temperature score can beat a weak steam score");
assert.match(improvementOf({ ...clean, pull: { ...offCenter, inZone: false, over: true, temp: .8, score: 10 } }), /提供.*下げ吸いを一口/);
assert.match(improvementOf({ ...clean, holes: { score: 20, holeSizes: { shallow: 6 } } }), /押してから少し待って離そう/);
assert.match(improvementOf({ ...clean, holes: { score: 65, evenness: .9, precision: .8, sizeStab: .2 } }), /押した針を早めに離そう/);
assert.match(improvementOf({ ...clean, holes: { score: 80, evenness: .65, precision: .85, sizeStab: .9 } }), /針が目印に重なったところで押そう/);
assert.match(improvementOf({ ...clean, heat: { score: 50, picks: ["early", "just"] } }), /黒い面が消えるまで待って/);
assert.equal(improvementOf({ ...clean, holes: { score: 0, skipped: true }, steam: { score: 0, hits: 0, zeroSteam: true },
  careHistory: [], parts: { holes: 0, heat: 0, shisha: 68, care1: 0, care2: 0 } }), repeat);
assert.equal(improvementOf({ parts: { holes: 0, heat: 0, shisha: 55, care1: 0, care2: 0 } }), "");
assert.match(improvementOf({ ...clean, holes: { score: 50 }, heat: { score: 50, picks: ["early"] } }), /穴あけ/);
console.log("PASS weakest completed stage selects one operational tip for steam, needle, temperature, holes or coals");

// #1909: 中程度でも実際の完了記録から控えめに一つ認める。
const moderate = { holes: { score: 72 }, heat: { score: 81 }, steam: { score: 76 }, pull: { score: 70, temp: .2 }, careHistory: [{ score: 74, temp: .2 }, { score: 75, temp: .2 }] };
assert.equal(goodPointOf(moderate), "今回よかったこと：今回の工程では、炭焼きの評価が比較的よかった。");
for (const [key, label] of [["holes", "穴あけ"], ["heat", "炭焼き"], ["steam", "蒸らし"], ["pull", "提供"]]) {
  assert.match(goodPointOf({ [key]: { score: 74 } }), new RegExp(label));
}
assert.match(goodPointOf({ careHistory: [{ score: 73 }, { score: 80 }] }), /2回目の調整の評価/);
assert.match(goodPointOf({ holes: { score: 80 }, heat: { score: 80 } }), /穴あけの評価/);
assert.equal(goodPointOf({ parts: { holes: 100, heat: 100, shisha: 100 } }), "");
for (const score of [undefined, null, NaN, Infinity, -Infinity, "90", 0, -1]) {
  assert.equal(goodPointOf({ holes: { score }, heat: { score }, steam: { score }, pull: { score }, careHistory: [{ score }, { score }] }), "", `invalid/unperformed score: ${score}`);
}
assert.equal(goodPointOf({ holes: { score: 100, skipped: true }, heat: { score: 100, failed: true }, pull: { score: 100, temp: served.temp, failed: "cold" } }), "");
assert.match(goodPointOf({ ...moderate, pull: served }), /適温に整えて提供できた/);
assert.match(goodPointOf({ ...moderate, ...steady }), /提供と2回の調整/);
assert.match(goodPointOf({ ...moderate, careHistory: [{ score: 70 }, served] }), /2回目の調整で適温/);
assert.match(goodPointOf({ heat: { score: 85 }, holes: { score: 95 } }), /炭をしっかり/);
assert.match(goodPointOf({ holes: { score: 85 } }), /穴をそろえて/);
assert.match(goodPointOf({ steam: { score: 85 } }), /集中を保てた/);
console.log("PASS moderate/tied/invalid/incomplete/failed/skipped records and existing success priority");

const sparseCare = [];
sparseCare[1] = served;
assert.equal(goodPointOf({ pull: served, careHistory: sparseCare }), "今回よかったこと：2回目の調整で適温に整えられた。", "A missing first adjustment must not count as two successful adjustments");

// #1909: 第2章以降の結果カード共通の2行。全工程70〜84点でも「よかったこと」が空にならない。
assert.deepEqual(craftReviewLines(null), []);
assert.deepEqual(craftReviewLines({}), [], "No lines for an unfinished session");
const moderateLines = craftReviewLines(moderate);
assert.equal(moderateLines.length, 2);
assert.match(moderateLines[0], /^今回よかったこと：/);
assert.match(moderateLines[1], /^次に変える一つ：|^次の練習：/);
assert.deepEqual(craftReviewLines(steady), [goodPointOf(steady), improvementOf(steady)].filter(Boolean));
console.log("PASS shared result-card review lines for chapters 2-5");

// 最低2回で提供しても適温帯の端では○になる。汎用講評は回数を原因と断定しない。
const { pullResult } = await import("../js/craft/conditions.js");
const { evaluationOf, feedbackLine } = await import("../js/craft/feedback.js");
const orangeBands = { center: .54, optimal: [.488, .592], ideal: [.4152, .6648], expressionWeight: 0 };
const edge = pullResult(.6648, 2, 0, orangeBands, 3);
assert.equal(edge.score, 65);
assert.equal(edge.inZone, true);
assert.equal(evaluationOf(edge.score).mark, "○");
assert.doesNotMatch(feedbackLine("sumi", "pull", evaluationOf(edge.score)), /回数|抑え|減ら|吸いすぎ/);
for (const [score, mark] of [[64, "△"], [65, "○"], [89, "○"], [90, "◎"]]) {
  assert.equal(evaluationOf(score).mark, mark);
  assert(feedbackLine("sumi", "pull", evaluationOf(score)));
}
assert.equal(feedbackLine("sumi", "pull", evaluationOf(90)), "いい頃合いだ。これなら出せる");
assert.equal(feedbackLine("sumi", "pull", evaluationOf(64)), "熱が合わなかったな。焦らず一口ずつだ");
console.log("PASS minimum-two-pull edge result and unchanged 65/90 feedback boundaries");
