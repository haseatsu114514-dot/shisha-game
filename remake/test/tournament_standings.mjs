import assert from "node:assert/strict";
import * as ch2 from "../js/chapters/ch2-tournament-state.js";
import * as ch3 from "../js/chapters/ch3-tournament-state.js";

const freeze = value => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
for (const chapter of [ch2, ch3]) {
  const ids = [...chapter.CONTESTANTS].sort();
  const [a, b, c, d] = ids;
  const [j1, j2, j3] = chapter.JUDGES;
  // 総票はqualityに優先し、同票だけquality、両方同じならIDで決まる。
  const p = freeze({ votes: {
    [j1]: { [a]: 2, [b]: 1, [c]: 2, [d]: 1 },
    [j2]: { [a]: 1, [b]: 2, [c]: 0, [d]: 2 },
    [j3]: {},
  }, quality: { [a]: 80, [b]: 81, [c]: 100, [d]: 81 } });
  const before = JSON.stringify(p);
  const expected = [
    { id: b, rank: 1, points: 3 }, { id: d, rank: 2, points: 3 },
    { id: a, rank: 3, points: 3 }, { id: c, rank: 4, points: 2 },
  ];
  assert.deepEqual(chapter.standings(p), expected);
  assert.deepEqual(chapter.standings(JSON.parse(before)), expected, "JSON読戻しでも順位を保つ");
  assert.equal(JSON.stringify(p), before, "保存状態を改変しない");

  // 途中投票・欠落した審査員／選手・qualityなしは既存どおり0票として扱う。
  assert.deepEqual(chapter.standings(freeze({ votes: { [j1]: { [d]: 1 } } })), [
    { id: d, rank: 1, points: 1 },
    ...[a, b, c].map((id, i) => ({ id, rank: i + 2, points: 0 })),
  ]);
  for (const empty of [{ votes: {} }, { votes: { [j1]: null }, quality: {} },
    { votes: { [j1]: { [a]: null, [b]: false, [c]: 0 } }, quality: { [d]: null } }]) {
    assert.deepEqual(chapter.standings(freeze(empty)), ids.map((id, i) => ({ id, rank: i + 1, points: 0 })));
  }
  // votes全体の欠落は呼出側の契約違反。今回の抽出で黙って補完しない。
  assert.throws(() => chapter.standings({}), TypeError);
  assert.throws(() => chapter.standings({ votes: null }), TypeError);
  const rows = chapter.standings(p);
  rows[0].points = -1;
  rows.reverse();
  assert.deepEqual(chapter.standings(p), expected, "呼出しごとに独立した結果を返す");
}
assert.deepEqual(ch2.CONTESTANTS, ["hajime", "ageha", "kumicho", "rei"]);
assert.deepEqual(ch3.CONTESTANTS, ["hajime", "kuze", "steve", "volk"]);
console.log("tournament_standings: ok (chapter 2/3)");
