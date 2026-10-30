// 心得の盤のデータと解放の規則（SPEC 2.1・2.2・2.6・1.9）。
import assert from "node:assert/strict";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");

// データ検査（2.6）: 能力ノードが各色9・段2〜10・コスト1、スキル14・合計41、全体86、輪ごとの数と火種が 2.1 の表どおり
for (const stat of core.STAT_KEYS) {
  const nodes = board.STAT_NODES.filter((n) => n.stat === stat);
  assert.deepEqual(nodes.map((n) => n.step), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert(nodes.every((n) => n.cost === 1));
}
assert.equal(board.STAT_NODES.length, 45);
assert.equal(board.SKILLS.length, 14);
assert.equal(board.SKILLS.reduce((n, s) => n + s.cost, 0), 41);
assert.equal(board.BOARD_TOTAL_COST, 86);
assert.equal(board.BOARD_TOTAL_COST, growth.BOARD_TOTAL, "盤の全部と火種の上限が同じ");
const perRing = [1, 2, 3, 4, 5].map((ring) => board.NODES.filter((n) => n.ring === ring).reduce((n, x) => n + x.cost, 0));
assert.deepEqual(perRing, [30, 16, 14, 21, 5]);
assert.deepEqual([1, 2, 3, 4, 5].map((r) => board.SKILLS.filter((s) => s.ring === r).length), [5, 2, 3, 4, 0]);
assert.equal(new Set(board.NODES.map((n) => n.id)).size, 59);
for (const stat of core.STAT_KEYS) assert(board.SKILLS.filter((s) => s.colors.includes(stat)).length >= 2, `${stat} は最低2つ`);
assert.deepEqual(board.SKILLS.filter((s) => s.colors.length === 2).map((s) => s.id), ["K07", "K11"]);
for (const stat of core.STAT_KEYS) assert.equal(board.STEP_TEXT[stat].length, 10);
assert.equal(board.rankOfStep("technique", 1), "見習い");
assert.equal(board.rankOfStep("technique", 2), "見習い");
assert.equal(board.rankOfStep("technique", 10), "神業");

growth.setGrowthPreview(true);
core.newGame();
core.state.phase = "daily";
const g = growth.ensureGrowth();
assert.deepEqual(g.nodes, []);
const status = (id, pending = []) => board.nodeStatus(board.NODE_BY_ID[id], g, board.replay(g, pending));

// 火種が無い・段の順・輪の鍵
assert.equal(status("T1"), "short");
assert.equal(status("T2"), "waiting");
assert.equal(status("T5"), "locked", "第2輪（6段）は第1章では鍵");
assert.equal(status("K06"), "locked");
g.hidane.any = 3;
assert.equal(status("T1"), "available");
assert.equal(status("K01"), "available", "スキルは段の条件なし・経路も見ない");
assert.equal(status("K11"), "locked");

// 仮置き: 段の順・払いの減り方・払えない分は外れる
let v = board.replay(g, ["T1", "T2", "K01"]);
assert.deepEqual(v.pending, ["T1", "T2"], "火種3で T1+T2 の後に K01（2）は払えない");
assert.equal(v.hidane.any, 1);
assert.equal(board.nodeStatus(board.NODE_BY_ID.T3, g, v), "available");
assert.equal(board.nodeStatus(board.NODE_BY_ID.K01, g, v), "short");
v = board.replay(g, ["T2"]);
assert.deepEqual(v.pending, [], "段の順が合わない仮置きは外れる");

// 限定の火種が先、2色は多い方から
g.hidane = { any: 2, technique: 1, sense: 0, guts: 0, charm: 0, insight: 0 };
assert.deepEqual(board.paymentFor(board.NODE_BY_ID.T1, g.hidane), { technique: 1 });
assert.deepEqual(board.paymentFor(board.NODE_BY_ID.S1, g.hidane), { any: 1 });
assert.deepEqual(board.paymentFor(board.NODE_BY_ID.K01, g.hidane), { technique: 1, any: 1 });
assert.equal(board.paymentFor(board.NODE_BY_ID.K06, g.hidane), null, "第2輪のスキル3は払えない");
assert.deepEqual(board.paymentFor({ cost: 3, colors: ["technique", "sense"] }, { any: 1, technique: 1, sense: 2 }), { sense: 2, technique: 1 });

// 確定: 払った種類を記録し、火種を減らす
const committed = board.commitPending(["T1", "K01"]);
assert.deepEqual(committed.map((n) => n.id), ["T1", "K01"]);
assert.deepEqual(g.nodes, ["T1", "K01"]);
assert.deepEqual(g.paid, { T1: { technique: 1 }, K01: { any: 2 } }, "T1 で技の火種を使った後、K01 は万能2");
assert.equal(growth.hidaneTotal(g), 0);
assert.equal(board.stepOf("technique", new Set(g.nodes)), 2);
assert.deepEqual(board.ringFill(g, 1), { got: 3, total: 30 });
assert.equal(status("T1"), "unlocked");
assert.equal(board.hasUsableHidane(g), false);

// 章で輪が開く
core.state.chapter = 2;
g.hidane.any = 10;
assert.equal(board.ringsOpen(), 2);
assert.equal(status("K06"), "available");
assert.equal(status("T5"), "waiting");
assert.equal(status("K08"), "locked");

// 保存・読込と壊れた値
core.save(); core.load();
assert.deepEqual(core.state.growth.nodes, ["T1", "K01"]);
core.state.growth.nodes = "x"; core.state.growth.paid = [1];
const fixed = growth.ensureGrowth();
assert.deepEqual(fixed.nodes, []);
assert.deepEqual(fixed.paid, {});

// 盤は旧しくみの能力を書き換えない（試作の間）
core.newGame();
const before = { ...core.state.stats };
growth.ensureGrowth().hidane.any = 5;
board.commitPending(["T1", "T2", "S1"]);
assert.deepEqual(core.state.stats, before);

// メニュー: 無効なら出さない
assert.equal(growth.growthMenuItems().length, 1);
growth.setGrowthPreview(false);
assert.deepEqual(growth.growthMenuItems(), []);
console.log("[growth board] PASS: data 45+14=86 per ring, 3 unlock rules, pending replay, limited-first payment, commit/paid, rings by chapter, save/load, stats untouched, menu gate");
