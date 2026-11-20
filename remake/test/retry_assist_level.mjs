// 大会の救済の段（WIN13）: 3回負けるごとに一段ずつ、針が遅く・判定が広くなる。ライバルの強さは変えない。
import assert from "node:assert/strict";
import { RETRY_ASSIST_EFFECTS, RETRY_ASSIST_MAX_LEVEL, retryAssistLevelFor, assistLevelOf, assistEffect,
  assistBenchNote, chosenAssistLevel } from "../js/craft/retry-assist-level.js";

assert.equal(RETRY_ASSIST_MAX_LEVEL, 4);
assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 11, 12, 30].map(retryAssistLevelFor), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
assert.deepEqual([undefined, null, NaN, -3, 3.9].map(retryAssistLevelFor), [0, 0, 0, 0, 1]);
// 1段目は導入時（#590）の倍率のまま。段が上がるほど、針は遅く・判定は広く・冷え方は穏やかに。
assert.deepEqual({ ...RETRY_ASSIST_EFFECTS[1] }, { slow: 1.35, window: 1.5, holesGood: 1.35, cool: .55 });
assert.deepEqual({ ...RETRY_ASSIST_EFFECTS[0] }, { slow: 1, window: 1, holesGood: 1, cool: 1 });
for (let level = 1; level <= RETRY_ASSIST_MAX_LEVEL; level++) {
  const now = RETRY_ASSIST_EFFECTS[level], before = RETRY_ASSIST_EFFECTS[level - 1];
  assert(now.slow > before.slow && now.window > before.window && now.holesGood > before.holesGood && now.cool < before.cool, `段${level}`);
}
assert.equal(RETRY_ASSIST_EFFECTS.length, RETRY_ASSIST_MAX_LEVEL + 1);
// その一台の段。段を持たない旧保存の救済は1段目、救済なしは段を持っていても0。範囲外は丸める。
assert.equal(assistLevelOf(null), 0);
assert.equal(assistLevelOf({ retryAssist: false, retryAssistLevel: 3 }), 0);
assert.equal(assistLevelOf({ retryAssist: true }), 1);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 0 }), 1);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 3 }), 3);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 9 }), 4);
assert.equal(assistEffect({ retryAssist: true, retryAssistLevel: 2 }), RETRY_ASSIST_EFFECTS[2]);
assert.equal(assistEffect({}), RETRY_ASSIST_EFFECTS[0]);
// 選んだ挑戦の段は、選んだ時点の負けの数から決まる。
assert.equal(chosenAssistLevel({ retryAssist: false, losses: 9 }), 0);
assert.equal(chosenAssistLevel({ retryAssist: true, losses: 9 }), 3);
assert.equal(chosenAssistLevel({ retryAssist: true, losses: 1 }), 1);
// 作業台の札。1段目は導入時の文言のまま。
assert.equal(assistBenchNote({ retryAssist: true }), "今回のみ操作補助");
assert.equal(assistBenchNote({ retryAssist: true, retryAssistLevel: 3 }), "今回のみ操作補助（3段目）");
console.log("PASS: retry assist steps every three losses up to level 4, level 1 keeps the original multipliers, old saves read as level 1");
