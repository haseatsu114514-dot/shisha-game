import assert from "node:assert/strict";
import { judgeDeductionReason } from "../js/craft/feedback.js";

const items = ["holes", "heat", "shisha", "care1", "care2"];
const judges = ["maezono", "dr_kemuri", "sui", "emil", "da_silva"];
const perfect = () => Object.fromEntries(items.map(item => [item, 100]));
const labels = ["穴あけ", "炭焼き", "完成品", "調整1", "調整2"];
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
    assert.equal(reason.item, neutral.item, "Voice never changes item selection");
    const width = [...reason.text].reduce((sum, char) => sum + (char.charCodeAt(0) <= 127 ? .5 : 1), 0);
    assert(width <= 22, `${judge}/${item} exceeds the one-line copy budget`);
    assert(!/[\n。]/u.test(reason.text));
    return reason.text;
  });
  assert.equal(new Set(texts).size, judges.length, "Every judge has a distinct voice for the shared item");
  assert.equal(JSON.stringify(cs), before);
}
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
for (const cs of [undefined, { parts: perfect() }, skipped, { parts: { care2: 40, care1: 40 } }]) {
  const neutral = judgeDeductionReason(cs);
  for (const judge of judges) {
    assert.equal(judgeDeductionReason(cs, judge).item, neutral.item);
    if (neutral.item === null) assert.deepEqual(judgeDeductionReason(cs, judge), neutral);
  }
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
console.log("PASS: five judge voices, five items, fallback, ties, missing records, foil weights and unchanged scores/votes/rankings");
