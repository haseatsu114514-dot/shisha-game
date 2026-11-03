// #2035 slice A: bonds.js / phone.js の章番号決め打ちを chapterFeatureEnabled へ寄せても、
// 章ごとの開放（久世の締めくくり・くゆりの地元外出・つむぎの応募ゲート）は変えない。
// 旧式と新式のブロック判定が、照合しうる章の値で一致することを確かめる（挙動不変）。
import assert from "node:assert/strict";
import { chapterFeatureEnabled } from "../js/core/chapter-features.js";

// 実セーブで取りうる章（旧セーブの欠損 undefined/null、0 も含む）。
const CHAPTERS = [1, 2, 3, 4, 5, 6, 0, undefined, null];

for (const ch of CHAPTERS) {
  const label = `chapter=${String(ch)}`;

  // 久世の締めくくり（bonds.finaleDue）: 旧 `state.chapter !== 3` と同じブロック判定を保つ。
  assert.equal(!chapterFeatureEnabled(ch, "kuzeBond"), ch !== 3, `kuze: ${label}`);

  // くゆりの♥3の外出（phone.eligible, lime_outing_rin_1）: 旧 `state.chapter > 2` と同じブロック判定を保つ。
  assert.equal(!chapterFeatureEnabled(ch || 1, "rinHomeOuting"), ch > 2, `rin: ${label}`);

  // つむぎの締めくくりを本筋の応募前に待たせるゲート（bonds.finaleDue）: 旧 `(state.chapter || 1) === 1` と同じ。
  assert.equal(chapterFeatureEnabled(ch || 1, "tsumugiContestGate"), (ch || 1) === 1, `tsumugi: ${label}`);
}

// 文字列や未定義の章を開放しない（開くのは限定した章だけ）。
assert.equal(chapterFeatureEnabled("3", "kuzeBond"), false);
assert.equal(chapterFeatureEnabled("1", "rinHomeOuting"), false);
assert.equal(chapterFeatureEnabled("1", "tsumugiContestGate"), false);
assert.equal(chapterFeatureEnabled(3, "kuzeBond"), true);
assert.equal(chapterFeatureEnabled(1, "rinHomeOuting"), true);
assert.equal(chapterFeatureEnabled(2, "rinHomeOuting"), true);
assert.equal(chapterFeatureEnabled(3, "rinHomeOuting"), false);
assert.equal(chapterFeatureEnabled(1, "tsumugiContestGate"), true);
assert.equal(chapterFeatureEnabled(2, "tsumugiContestGate"), false);

console.log("chapter_feature_gates_2035: ok");
