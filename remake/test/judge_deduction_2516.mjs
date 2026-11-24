import assert from "node:assert/strict";
import { judgeDeductionReason, JUDGE_DEDUCTION_LINES, JUDGE_VIEWS } from "../js/craft/feedback.js";
import { CH1_WEIGHTS, SAKURAI } from "../js/craft/ch1-votes.js";
import { CH4_JUDGE_WEIGHTS } from "../js/chapters/ch4-tournament-state.js";

const items = ["holes", "heat", "shisha", "care1", "care2"];
const judges = ["uezono", "dr_charcoal", "sensu", "emil", "da_silva"];
const perfect = () => Object.fromEntries(items.map(item => [item, 100]));
const labels = ["穴", "炭", "完成品", "調整1", "調整2"];
const width = text => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) <= 127 ? .5 : 1), 0);

// C-30（#4195）: 審査員の見る所は採点の正本の重みから取る。表示側の写しがずれたら落とす。
for (const judge of ["uezono", "dr_charcoal", "sensu"]) {
  assert.deepEqual(Object.values(JUDGE_VIEWS[judge].steps), [...CH1_WEIGHTS[judge]], `${judge} steps follow CH1_WEIGHTS`);
  const serve = Object.keys(SAKURAI.serve[judge]).filter(key => key !== "pull");
  assert.deepEqual(JUDGE_VIEWS[judge].cup.slice().sort(), serve.sort(), `${judge} cup follows SAKURAI.serve without the served pull`);
}
for (const judge of ["emil", "da_silva", "sensu"]) {
  const total = CH4_JUDGE_WEIGHTS[judge].slice(0, 5);
  const view = Object.values(JUDGE_VIEWS[judge].steps);
  // 千須は第1章の等重み（20）と第4章の等重み（15）で形が同じ。比で照合する。
  assert.deepEqual(view.map(n => n / view[0]), total.map(n => n / total[0]), `${judge} steps follow CH4_JUDGE_WEIGHTS`);
}
// 2人ずつ見る所が重ならない（第1・2章：上園/博士/千須、第3章：エミル/博士/千須、第4章：千須/太陽/エミル）。
for (const panel of [["uezono", "dr_charcoal", "sensu"], ["emil", "dr_charcoal", "sensu"], ["sensu", "da_silva", "emil"]]) {
  const cups = panel.flatMap(judge => JUDGE_VIEWS[judge].cup);
  assert.equal(new Set(cups).size, cups.length, `${panel.join("/")} read different parts of the cup`);
}
// 一行に収まる・句点や改行を含まない。博士は味そのものを評さない。
for (const judge of judges) for (const [key, text] of Object.entries(JUDGE_DEDUCTION_LINES[judge])) {
  assert(width(text) <= 22, `${judge}/${key} exceeds the one-line copy budget`);
  assert(!/[\n。]/u.test(text), `${judge}/${key}`);
  if (judge === "dr_charcoal") assert(!/味|香り/u.test(text), `dr_charcoal/${key} must not judge taste`);
}

for (const [index, item] of items.entries()) {
  const cs = { parts: { ...perfect(), [item]: 70 } };
  const before = JSON.stringify(cs);
  assert.equal(judgeDeductionReason(cs).item, item);
  assert(judgeDeductionReason(cs).text.startsWith(labels[index]));
  assert(judgeDeductionReason(cs).text.length <= 26);
  const neutral = judgeDeductionReason(cs);
  assert.deepEqual(judgeDeductionReason(cs, "unknown-judge"), neutral);
  const texts = judges.map(judge => {
    const reason = judgeDeductionReason(cs, judge);
    // 完成品の中身の記録が無い時は工程の点だけで比べ、落とした工程が一つならどの審査員もそれを挙げる。
    assert.equal(reason.item, item, `${judge} names the only lost step`);
    assert(reason.text.startsWith(labels[index]), `${judge}/${item}`);
    return reason.text;
  });
  assert.equal(new Set(texts).size, judges.length, "Every judge has a distinct voice for the shared item");
  assert.equal(JSON.stringify(cs), before);
}

// 完成品の点は上手でも構造的に80前後で止まる（measure.mjs の perfect: 82）。今までは全員が毎回「完成品」を挙げていた。
// 見る所で比べると、同じ一台でも上園＝味の濃さ、博士＝焦げやすさ、千須＝煙、エミル＝持ち、太陽＝焦げやすさになる。
const standardCup = { aroma: 100, taste: 46, smoke: 65, draw: 80, heatStability: 82, burnRisk: 25, duration: 70, craftQuality: 82 };
const sharp = { chapter: 1, mode: "tournament", foilSkipped: true, holes: { skipped: true },
  parts: { heat: 100, shisha: 82, care1: 100, care2: 100 }, stats: standardCup };
assert.equal(judgeDeductionReason(sharp).item, "shisha", "The shared pick still names the finished cup");
const sharpPicks = Object.fromEntries(judges.map(judge => [judge, judgeDeductionReason(sharp, judge).item]));
assert.deepEqual(sharpPicks, { uezono: "taste", dr_charcoal: "safety", sensu: "smoke", emil: "duration", da_silva: "safety" });
for (const panel of [["uezono", "dr_charcoal", "sensu"], ["emil", "dr_charcoal", "sensu"], ["sensu", "da_silva", "emil"]]) {
  assert.equal(new Set(panel.map(judge => judgeDeductionReason(sharp, judge).item)).size, 3, `${panel.join("/")} point at different things`);
}
// ふつうの腕（炭87）: 炭を重く見る博士だけが炭を挙げ、上園と千須は自分の見る所の中身を挙げる。
const steady = { ...sharp, parts: { ...sharp.parts, heat: 87 } };
assert.deepEqual(["uezono", "dr_charcoal", "sensu"].map(judge => judgeDeductionReason(steady, judge).item), ["taste", "heat", "smoke"]);
assert.equal(judgeDeductionReason(steady, "dr_charcoal").text, JUDGE_DEDUCTION_LINES.dr_charcoal.heat);
// 調整を大きく崩した時は、どの見る所でもそれが一番重い。全員が同じ工程を挙げるのはこの時だけで、口調は分かれる。
const broken = { ...sharp, parts: { ...sharp.parts, care1: 10 } };
assert.deepEqual(new Set(["uezono", "dr_charcoal", "sensu"].map(judge => judgeDeductionReason(broken, judge).item)), new Set(["care1"]));
assert.equal(new Set(["uezono", "dr_charcoal", "sensu"].map(judge => judgeDeductionReason(broken, judge).text)).size, 3);
// 穴を開けた台（第2章以降）は、千須の見る所に穴が入る。
const holed = { chapter: 2, mode: "tournament", parts: { holes: 60, heat: 100, shisha: 82, care1: 100, care2: 100 }, stats: standardCup };
assert.equal(judgeDeductionReason(holed, "sensu").item, "holes");
assert.equal(judgeDeductionReason(holed, "uezono").item, "taste");
// 見る所に落とした所が無ければ、その見る所をほめる一言（item は null）。
const flawless = { parts: perfect(), stats: { aroma: 100, taste: 100, smoke: 100, draw: 100, heatStability: 100, burnRisk: 0, duration: 100 } };
for (const judge of judges) {
  assert.deepEqual(judgeDeductionReason(flawless, judge), { item: null, text: JUDGE_DEDUCTION_LINES[judge].clear });
  assert.deepEqual(judgeDeductionReason({ parts: perfect() }, judge), { item: null, text: JUDGE_DEDUCTION_LINES[judge].clear });
  assert.match(judgeDeductionReason(undefined, judge).text, /確認できない/);
  assert.match(judgeDeductionReason({ parts: { heat: NaN, shisha: Infinity } }, judge).text, /確認できない/);
}
// 見る所の外だけを落とした台では、その審査員は見る所をほめる（上園は炭を見るが、中身は香りと味だけ）。
const onlySmoke = { parts: perfect(), stats: { ...flawless.stats, smoke: 50 } };
assert.equal(judgeDeductionReason(onlySmoke, "sensu").item, "smoke");
assert.equal(judgeDeductionReason(onlySmoke, "uezono").item, null);
assert.equal(judgeDeductionReason(onlySmoke, "dr_charcoal").item, null);
// 完成品の中身の記録が無い古い台は、完成品の点で比べ、今までの完成品の一言を使う。
const legacyCup = { parts: { ...perfect(), shisha: 70 } };
for (const judge of judges) assert.equal(judgeDeductionReason(legacyCup, judge).text, JUDGE_DEDUCTION_LINES[judge].shisha);
assert.equal(judgeDeductionReason({ parts: Object.fromEntries(items.map(item => [item, 60])) }).item, "holes");
assert.equal(judgeDeductionReason({ parts: { care2: 40, care1: 40 } }).item, "care1");
assert.match(judgeDeductionReason({ parts: perfect() }).text, /減点なし/);
assert.equal(judgeDeductionReason({ parts: perfect() }).item, null);
assert.match(judgeDeductionReason().text, /確認できない/);
assert.match(judgeDeductionReason({ parts: { heat: NaN, shisha: Infinity } }).text, /確認できない/);
assert.equal(judgeDeductionReason({ parts: { holes: 0, heat: 80 }, foilSkipped: true }).item, "heat");
assert.equal(judgeDeductionReason({ parts: { holes: 0, heat: 80 }, holes: { skipped: true } }).item, "heat");
// The chapter-one foil-free cup weights the finished cup twice as much as each remaining item.
const skipped = { chapter: 1, mode: "tournament", foilSkipped: true, parts: { heat: 60, shisha: 75, care1: 100, care2: 100 } };
assert.equal(judgeDeductionReason(skipped).item, "shisha");
assert.equal(judgeDeductionReason({ ...skipped, chapter: 2 }).item, "heat");
assert.equal(judgeDeductionReason({ ...skipped, mode: "practice" }).item, "heat");
assert.equal(judgeDeductionReason({ ...skipped, parts: { heat: 50, shisha: 75 } }).item, "heat");

// Run production scoring, then the display helper: totals, grades and all saved data must stay identical.
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const { newGame } = await import("../js/core/state.js");
const { finalize } = await import("../js/craft/score.js");
newGame();
for (const [score, rank] of [[20, "D"], [65, "B"], [85, "A"], [100, "S"]]) {
  const cs = { chapter: 2, mode: "tournament", holes: { score }, heat: { score },
    stats: { craftQuality: score }, careHistory: [{ score }, { score }] };
  finalize(cs);
  assert.equal(cs.total, score);
  assert.equal(cs.rank, rank);
  const before = JSON.stringify(cs);
  for (const judge of judges) judgeDeductionReason(cs, judge);
  assert.equal(JSON.stringify(cs), before);
}
for (const [chapter, skipped, total] of [[2, false, 57], [1, true, 74], [2, true, 68.8]]) {
  const cs = { chapter, mode: "tournament", holes: { score: 10, skipped }, heat: { score: 80 },
    stats: { craftQuality: 95 }, careHistory: [{ score: 30 }, { score: 70 }] };
  finalize(cs);
  assert.equal(cs.total, total);
  const before = JSON.stringify(cs);
  for (const judge of judges) judgeDeductionReason(cs, judge);
  assert.equal(JSON.stringify(cs), before);
}
assert.equal(judgeDeductionReason({ ...skipped, chapter: undefined }).item, "shisha", "Legacy cups use the current chapter like finalize");
// 完成品の中身の記録が無い台で、落とした工程の重みが審査員で変わらない時は、全員が同じ工程を挙げる。
for (const cs of [{ parts: { care2: 40, care1: 40 } }]) {
  const neutral = judgeDeductionReason(cs);
  for (const judge of judges.filter(judge => JUDGE_VIEWS[judge].steps.care1 === JUDGE_VIEWS[judge].steps.care2)) assert.equal(judgeDeductionReason(cs, judge).item, neutral.item);
  // エミルは調整2回目を重く見る（第4章の重み）。
  assert.equal(judgeDeductionReason(cs, "emil").item, "care2");
}
// Judge phrasing cannot change the tournament vote allocation or its ranking.
const { castVotes, standings, CONTESTANTS, JUDGES } = await import("../js/chapters/ch2-tournament-state.js");
for (const total of [20, 65, 85, 100]) {
  const cs = { total, parts: { ...perfect(), heat: total } };
  const run = withReasons => {
    const p = { voted: 0, votes: Object.fromEntries(JUDGES.map(judge => [judge, Object.fromEntries(CONTESTANTS.map(id => [id, 0]))])) };
    for (let round = 0; round < 4; round++) {
      if (withReasons) for (const judge of judges) judgeDeductionReason(cs, judge);
      assert(castVotes(p, round, cs.total));
    }
    return { votes: p.votes, rows: standings(p) };
  };
  assert.deepEqual(run(true), run(false));
}
console.log("PASS: judge views from the scoring weights, per-judge cup reads, distinct picks, praise, fallback, ties, missing records, foil weights and unchanged scores/votes/rankings");
