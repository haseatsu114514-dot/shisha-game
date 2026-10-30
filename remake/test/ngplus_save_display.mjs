// node remake/test/ngplus_save_display.mjs
// NG+ U9（Issue #1228 / 設計 §3.6・§8.3）: セーブ枠とステータス見出しの周回表示、
// および手動セーブ時の別周回上書き確認に添える注意文の判定。
// 表示は生データを相手にするため、ここでは移行・保存が起きないことも確認する。
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
globalThis.sessionStorage ??= globalThis.localStorage;

const { slotCycle, slotCycleId, cycleBadgeText, overwriteCycleNote } = await import("../js/core/cycle-display.js");
const { newState } = await import("../js/core/state.js");

const copy = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- 表示（cycleBadgeText）
// 1周目は従来表示のまま（何も出さない）
assert.equal(cycleBadgeText({ cycle: 1, cycleId: "a" }), null);
// cycle 欠損の旧セーブは1周目として扱い、周回数を出さない
assert.equal(cycleBadgeText({ cycleId: "a" }), null);
assert.equal(cycleBadgeText({}), null);
// 空枠・壊れた値でも例外なく null
assert.equal(cycleBadgeText(null), null);
assert.equal(cycleBadgeText(undefined), null);
assert.equal(cycleBadgeText({ cycle: 0 }), null);
assert.equal(cycleBadgeText({ cycle: -2 }), null);
assert.equal(cycleBadgeText({ cycle: 2.5 }), null);
assert.equal(cycleBadgeText({ cycle: "2" }), null);
// 2周目以降は「N周目」。2桁もそのまま出す（丸めない）
assert.equal(cycleBadgeText({ cycle: 2, cycleId: "b" }), "2周目");
assert.equal(cycleBadgeText({ cycle: 12, cycleId: "c" }), "12周目");

// 現行の newState でも判定できる
{
  const s = newState();
  assert.equal(cycleBadgeText(s), null); // 1周目
  s.cycle = 3;
  assert.equal(cycleBadgeText(s), "3周目");
}

// ---------------------------------------------------------------- 値の取り出し
assert.equal(slotCycle({ cycle: 1 }), 1);
assert.equal(slotCycle({ cycle: 2 }), 2);
assert.equal(slotCycle({}), null);
assert.equal(slotCycleId({ cycleId: "x" }), "x");
assert.equal(slotCycleId({ cycleId: "" }), null);
assert.equal(slotCycleId({ cycleId: 42 }), null);
assert.equal(slotCycleId({}), null);

// ---------------------------------------------------------------- 上書き注意文（overwriteCycleNote）
const current = { cycle: 2, cycleId: "run-B" };
// 同じ cycleId なら従来の確認のまま（注意文なし）
assert.equal(overwriteCycleNote({ cycle: 2, cycleId: "run-B" }, current), null);
// 同じ周回数でも cycleId が異なれば別周回として警告し、保存先の周回数を出す
assert.equal(overwriteCycleNote({ cycle: 2, cycleId: "run-A" }, current), "別の周回（2周目）のセーブを上書きします。");
assert.equal(overwriteCycleNote({ cycle: 1, cycleId: "run-A" }, current), "別の周回（1周目）のセーブを上書きします。");
// 保存先の cycle が読めなくても、ID が異なれば別周回として警告する（周回数は出さない）
assert.equal(overwriteCycleNote({ cycleId: "run-A" }, current), "別の周回のセーブを上書きします。");
// cycleId のない旧枠は同一周回と断定せず、旧セーブである旨を添える
assert.equal(overwriteCycleNote({ cycle: 1 }, current), "この枠は周回IDのない旧セーブです。");
assert.equal(overwriteCycleNote({}, current), "この枠は周回IDのない旧セーブです。");
// 現在側の ID が判定できない場合は注意文を足さない（通常の state では起きない理論ケース）
assert.equal(overwriteCycleNote({ cycle: 3, cycleId: "run-A" }, {}), null);

// 表示・判定のために入力データを書き換えない（旧枠の閲覧で移行・保存を発生させない）
{
  const legacy = { day: 3, money: 100 };
  const before = copy(legacy);
  cycleBadgeText(legacy);
  overwriteCycleNote(legacy, current);
  assert.deepEqual(legacy, before);
  assert.equal(store.size, 0); // localStorage にも触らない
}

console.log("ngplus_save_display: all assertions passed");
