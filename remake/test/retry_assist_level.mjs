// 大会の救済の難易度（WIN13）: 3敗でイージー、6敗でベリーイージーも選べる。ライバルの強さは変えない。
import assert from "node:assert/strict";
import { RETRY_ASSIST_EFFECTS, RETRY_ASSIST_MAX_LEVEL, RETRY_ASSIST_NAMES, retryAssistLevelFor, assistLevelOf, assistEffect,
  assistBenchNote, chosenAssistLevel } from "../js/craft/retry-assist-level.js";

assert.equal(RETRY_ASSIST_MAX_LEVEL, 2);
assert.deepEqual([...RETRY_ASSIST_NAMES], ["ノーマル", "イージー", "ベリーイージー"]);
assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 30].map(retryAssistLevelFor), [0, 0, 1, 1, 2, 2, 2, 2]);
assert.deepEqual([undefined, null, NaN, -3, 3.9].map(retryAssistLevelFor), [0, 0, 0, 0, 1]);
// イージーは導入時（#590）の倍率のまま。ベリーイージーは針がさらに遅く・判定がさらに広く・冷え方がさらに穏やか。
assert.deepEqual({ ...RETRY_ASSIST_EFFECTS[0] }, { slow: 1, window: 1, holesGood: 1, cool: 1 });
assert.deepEqual({ ...RETRY_ASSIST_EFFECTS[1] }, { slow: 1.35, window: 1.5, holesGood: 1.35, cool: .55 });
assert.deepEqual({ ...RETRY_ASSIST_EFFECTS[2] }, { slow: 3.2, window: 4, holesGood: 3.2, cool: .2 });
assert.equal(RETRY_ASSIST_EFFECTS.length, RETRY_ASSIST_MAX_LEVEL + 1);
// その一台の段。段を持たない旧保存の救済はイージー、救済なしは段を持っていても0。範囲外は丸める。
assert.equal(assistLevelOf(null), 0);
assert.equal(assistLevelOf({ retryAssist: false, retryAssistLevel: 2 }), 0);
assert.equal(assistLevelOf({ retryAssist: true }), 1);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 0 }), 1);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 2 }), 2);
assert.equal(assistLevelOf({ retryAssist: true, retryAssistLevel: 9 }), 2);
assert.equal(assistEffect({ retryAssist: true, retryAssistLevel: 2 }), RETRY_ASSIST_EFFECTS[2]);
assert.equal(assistEffect({}), RETRY_ASSIST_EFFECTS[0]);
// 選んだ挑戦の段。6敗でもイージーを選べば1。段を持たない旧保存はイージー。
assert.equal(chosenAssistLevel({ retryAssist: false, losses: 9, retryAssistLevel: 2 }), 0);
assert.equal(chosenAssistLevel({ retryAssist: true, losses: 9, retryAssistLevel: 2 }), 2);
assert.equal(chosenAssistLevel({ retryAssist: true, losses: 9, retryAssistLevel: 1 }), 1);
assert.equal(chosenAssistLevel({ retryAssist: true, losses: 9 }), 1);
// 作業台の札
assert.equal(assistBenchNote({ retryAssist: true }), "今回のみイージー");
assert.equal(assistBenchNote({ retryAssist: true, retryAssistLevel: 2 }), "今回のみベリーイージー");
console.log("PASS: retry assist offers イージー after three losses and ベリーイージー after six, イージー keeps the original multipliers, old saves read as イージー");
