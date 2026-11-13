import assert from "node:assert/strict";
import { castVotes, CONTESTANTS, JUDGES, SPEND, RIVAL_QUALITY, evaluateJudgeScore } from "../js/chapters/ch2-tournament-state.js";

// 後段の審査員だけ持ち点が不足する旧/不整合SAVEでも、先行の票を確定しない。
const p = {
  voted: 0,
  votes: Object.fromEntries(JUDGES.map(judge => [judge,
    Object.fromEntries(CONTESTANTS.map(id => [id, 0]))])),
  quality: { hajime: 44 }, lastVotes: { previous: true },
};
p.votes[JUDGES[1]].hajime = 10;
const before = structuredClone(p);
assert.throws(() => castVotes(p, 0, 88), /審査員の持ち点が不足しています/);
assert.deepEqual(p, before, "不足時に先行審査員の票だけを書き込まない");
console.log("PASS chapter 2 vote commit is atomic on insufficient later votes");

// main 7fa356769 の変更前関数。正常時の票/品質/表示用記録をそのまま比較する。
function legacyCastVotes(p, round, performance, prefByJudge = null) {
  if (round !== p.voted || round < 0 || round >= SPEND.length) return false;
  const quality = { ...RIVAL_QUALITY, hajime: bounded(performance) };
  const lastVotes = {};
  for (const judge of JUDGES) {
    const bias = judge === "maezono" ? { ageha: 4, rei: 1 }
      : judge === "dr_kemuri" ? { kumicho: 3 } : { rei: 3 };
    const hajimeScore = prefByJudge && judge in prefByJudge
      ? evaluateJudgeScore(judge, quality.hajime, prefByJudge[judge])
      : quality.hajime;
    const scoreOf = (c) => (c === "hajime" ? hajimeScore : quality[c]) + (bias[c] || 0);
    const order = CONTESTANTS.slice().sort((a, b) =>
      scoreOf(b) - scoreOf(a) || a.localeCompare(b));
    const amount = SPEND[round], row = p.votes[judge];
    const available = 10 - Object.values(row).reduce((sum, n) => sum + n, 0);
    if (available < amount) throw new Error("審査員の持ち点が不足しています");
    row[order[0]] += amount - 1;
    row[order[1]]++;
    // 表示専用（#909）。この回に誰へ何点入れたか。得点・順位の計算には使わない。
    lastVotes[judge] = { first: order[0], second: order[1], points: { [order[0]]: amount - 1, [order[1]]: 1 } };
  }
  p.lastVotes = lastVotes;
  p.voted++;
  p.quality = quality;
  return true;
}

const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));
const fresh = round => ({ voted: round,
  votes: Object.fromEntries(JUDGES.map(judge => [judge, Object.fromEntries(CONTESTANTS.map((id, i) =>
    [id, i === 0 ? SPEND.slice(0, round).reduce((a, b) => a + b, 0) : 0]))])),
  quality: { previous: 44 }, lastVotes: { previous: true }, untouched: { record: [1, 2] },
});
let comparisons = 0;
const compare = (left, right, label) => { assert.deepEqual(left, right, label); comparisons++; };
for (let round = 0; round < SPEND.length; round++) for (const judge of JUDGES) {
  const bad = fresh(round);
  bad.votes[judge].hajime = 10;
  // JSON経由の旧/不整合SAVEも、繰り返しの呼出しも、一切補填せず同じ例外を返す。
  for (const save of [bad, JSON.parse(JSON.stringify(bad))]) {
    const before = structuredClone(save), votes = save.votes, quality = save.quality, last = save.lastVotes;
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.throws(() => castVotes(save, round, 88), { message: "審査員の持ち点が不足しています" });
      compare(save, before, `round${round}/${judge}: no partial commit`);
      assert.equal(save.votes, votes); assert.equal(save.quality, quality); assert.equal(save.lastVotes, last);
    }
  }
}
const prefs = [null, {}, { maezono: -1, dr_kemuri: 0, nagumo: 1 },
  { maezono: .5, dr_kemuri: -.5, nagumo: .25 }];
const scores = [...Array.from({ length: 101 }, (_, i) => i), -20, 120, undefined, null, false, "81", NaN, Infinity];
for (const score of scores) for (const pref of prefs) {
  let actual = fresh(0), expected = structuredClone(actual);
  const inputPref = structuredClone(pref);
  for (let round = 0; round < SPEND.length; round++) {
    const rows = JUDGES.map(judge => actual.votes[judge]);
    compare(castVotes(actual, round, score, pref), legacyCastVotes(expected, round, score, pref), "normal return");
    compare(actual, expected, `normal record: score${score}/round${round}`);
    JUDGES.forEach((judge, i) => assert.equal(actual.votes[judge], rows[i], "keep successful row identity"));
    const once = structuredClone(actual);
    compare(castVotes(actual, round, score, pref), false, "a committed vote cannot be cast twice");
    compare(actual, once, "repeat call preserves votes/quality/lastVotes/voted");
    // 次の回はSAVE/LOADで読み戻した状態から投票する。
    actual = JSON.parse(JSON.stringify(actual)); expected = JSON.parse(JSON.stringify(expected));
  }
  compare(pref, inputPref, "preference input is not changed");
}
// 既存の演算で扱う値を新しく正規化しない。成功する不整合値も旧実装と同じまま。
for (const value of [undefined, null, false, "0", NaN, -1]) {
  const actual = fresh(0); actual.votes[JUDGES[2]].rei = value;
  const expected = structuredClone(actual);
  compare(castVotes(actual, 0, 81), legacyCastVotes(expected, 0, 81), "legacy numeric handling return");
  compare(actual, expected, "legacy numeric handling record");
}
for (const round of [-1, 4, 1]) {
  const actual = fresh(0), before = structuredClone(actual);
  compare(castVotes(actual, round, 88), false, "out of range or wrong round returns false");
  compare(actual, before, "rejected round never writes");
}
console.log(`PASS chapter 2 atomic vote commit: ${comparisons} checks; old normal outputs and JSON SAVE preserved`);
