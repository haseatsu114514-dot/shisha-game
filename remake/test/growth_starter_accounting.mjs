// Issue #3118: 初回の白火、上限、旧SAVE、全盤、周回の獲得会計を本番関数で確かめる。
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};

const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const tutorial = await import("../js/daily/growth-board-tutorial.js");
const { buildCarryPackage } = await import("../js/core/carry.js");
const { startNextCycle } = await import("../js/core/cycle-start.js");

const paidTotal = g => Object.values(g.paid).reduce((total, payment) =>
  total + Object.values(payment).reduce((n, amount) => n + amount, 0), 0);
const account = g => ({ earned: g.earned, held: growth.hidaneTotal(g), paid: paidTotal(g) });
const fresh = earned => {
  const s = core.newGame();
  s.phase = "daily";
  const g = growth.ensureGrowth();
  g.earned = earned;
  return { s, g };
};

// 未配布と配布済み。初回6が所持と累計の両方へ一度だけ入る。
{
  const { s, g } = fresh(0);
  assert.equal(tutorial.grantStarterHidane(s, g), 6);
  assert.deepEqual(account(g), { earned: 6, held: 6, paid: 0 });
  assert.equal(g.starterAccounted, true);
  assert.equal(tutorial.grantStarterHidane(s, g), 0);
  assert.deepEqual(account(g), { earned: 6, held: 6, paid: 0 });
}

// 旧保存から初めて盤を開く場合も、残容量1〜5と上限到達後には198を超えて渡さない。
for (const room of [1, 2, 3, 4, 5, 0]) {
  const { s, g } = fresh(growth.BOARD_TOTAL - room);
  assert.equal(tutorial.grantStarterHidane(s, g), room, `残容量${room}`);
  assert.equal(g.earned, growth.BOARD_TOTAL);
  assert.equal(growth.hidaneTotal(g), room);
  assert.equal(s.flags[tutorial.STARTER_FLAG], true);
  assert.equal(tutorial.grantStarterHidane(s, g), 0);
}

{
  const old = core.newState();
  old.schema = 27;
  old.phase = "daily";
  old.growth = growth.newGrowth();
  delete old.growth.starterAccounted;
  old.growth.earned = 197;
  storage.set(core.SAVE_KEY, JSON.stringify(old));
  const loaded = core.load();
  assert.equal(loaded.growth.earned, 197, "旧SAVEの初開封前には補正しない");
  assert.equal(tutorial.grantStarterHidane(loaded, loaded.growth), 1);
  assert.deepEqual(account(loaded.growth), { earned: 198, held: 1, paid: 0 });
}

// Issue本文と同じ順序: 初回付与→Lv99ぶんの経験値→夜の精算→全有料ノードの確定。
{
  const { s, g } = fresh(0);
  s.chapter = 5;
  g.ringsOpen = 5;
  assert.equal(tutorial.grantStarterHidane(s, g), 6);
  assert.deepEqual(account(g), { earned: 6, held: 6, paid: 0 });
  growth.gainExp(growth.totalExpFor(99), { silent: true });
  growth.settleGrowth();
  assert.deepEqual(account(g), { earned: 198, held: 198, paid: 0 });

  for (const lesson of board.LESSONS) { s.met[lesson.who] = true; s.affinity[lesson.who] = 999; }
  s.flags._ch4_sheikh_revealed = true;
  const priced = board.NODES.filter(node => node.cost > 0);
  for (let guard = 0; guard < board.NODES.length * 2; guard++) {
    const view = board.replay(g, []);
    const next = board.NODES.find(node => board.nodeStatus(node, g, view) === "available");
    if (!next) break;
    assert.equal(board.commitPending([next.id]).length, 1);
  }
  assert.equal(priced.filter(node => !g.nodes.includes(node.id)).length, 0,
    `全有料ノードを確定できる: ${JSON.stringify({ rest: priced.filter(node => !g.nodes.includes(node.id)).map(node => [node.id, board.nodeStatus(node, g, board.replay(g, []))]), wallet: g.hidane })}`);
  assert.deepEqual(account(g), { earned: 198, held: 0, paid: 198 });
  assert.equal(growth.settleGrowth().boardFull, true, "全盤完成の判定も成立する");
  assert.equal(growth.giveColored(g, "body").n, 0, "完成後に追加配布しない");

  assert.equal(core.save(), true);
  const loaded = core.load();
  assert.deepEqual(account(loaded.growth), { earned: 198, held: 0, paid: 198 });
  assert.equal(tutorial.grantStarterHidane(loaded, loaded.growth), 0, "LOADで二重付与しない");

  const next = startNextCycle(buildCarryPackage(loaded));
  assert.equal(next.flags[tutorial.STARTER_FLAG], true);
  assert.equal(tutorial.grantStarterHidane(next, next.growth), 0, "NG+で二重付与しない");
  assert.deepEqual(account(next.growth), { earned: 198, held: 0, paid: 198 });

  // 修正前に204個を得て全盤を灯した旧SAVEは、用途のない6を自動没収しない。
  const legacyFull = structuredClone(loaded);
  legacyFull.schema = 27;
  legacyFull.growth.earned = 198;
  legacyFull.growth.hidane.any = 6;
  delete legacyFull.growth.starterAccounted;
  storage.set(core.SAVE_KEY, JSON.stringify(legacyFull));
  assert.deepEqual(account(core.load().growth), { earned: 204, held: 6, paid: 198 });
}

// 旧SAVEで配布済みの6は会計へ足す。既に上限まで通常獲得した保存も没収しない。
for (const priorEarned of [0, 192, 198]) {
  const s = core.newState();
  s.schema = 27;
  s.phase = "daily";
  s.flags[tutorial.STARTER_FLAG] = true;
  s.growth = growth.newGrowth();
  delete s.growth.starterAccounted;
  s.growth.earned = priorEarned;
  s.growth.hidane.any = priorEarned + 5;
  s.growth.nodes = ["B1"];
  s.growth.paid = { B1: { any: 1 } };
  storage.set(core.SAVE_KEY, JSON.stringify(s));
  const loaded = core.load();
  assert.equal(loaded.growth.earned, priorEarned + 6);
  assert.deepEqual(account(loaded.growth), { earned: priorEarned + 6, held: priorEarned + 5, paid: 1 },
    "既取得の所持・支払を減らさない");
  assert.equal(loaded.growth.starterAccounted, true);
  assert.equal(core.save(), true);
  assert.equal(core.load().growth.earned, priorEarned + 6, "再ロードで再加算しない");
}

console.log("[growth starter accounting] PASS");
