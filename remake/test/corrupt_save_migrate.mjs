// 構造的に壊れたセーブ（null・型不一致）の移行テスト。
// 直せる形は既定値へ直して読み込み、直せない形は例外でなく読み込み不可として失敗する。
// node --experimental-vm-modules remake/test/corrupt_save_migrate.mjs
import assert from "node:assert/strict";
import * as core from "../js/core/state.js";

const files = new Map();
globalThis.localStorage = {
  getItem: (key) => files.get(key) ?? null,
  setItem(key, value) { files.set(key, String(value)); },
  removeItem(key) { files.delete(key); },
};

const loaders = [
  ["boot", core.SAVE_KEY, () => core.load()],
  ...core.SAVE_SLOTS.map(({ key }) => [key, key, () => core.loadFromSlot(key)]),
];

// 監査で再現した形: reel.pending が null の schema 9 セーブは、例外なく読み込める。
for (const [name, key, load] of loaders) {
  files.clear();
  core.setState(null);
  files.set(key, JSON.stringify({ schema: 9, day: 1, reel: { pending: null } }));
  const loaded = load();
  assert(loaded, name + ": reel.pending null でも読み込める");
  assert.deepEqual(loaded.reel.pending, []);
  assert.equal(loaded.day, 1);
  assert.equal(loaded.schema, core.SCHEMA);
}

// null のコンテナは既定値へ直る（欠落キー補完をすり抜けていた形）。
for (const [name, key, load] of loaders) {
  files.clear();
  core.setState(null);
  files.set(key, JSON.stringify({
    schema: 8, day: 2, stats: null, statXp: null,
    reel: null, trpg: null, inbox: null, flags: null, contacts: null,
  }));
  const loaded = load();
  assert(loaded, name + ": null コンテナでも読み込める");
  assert.deepEqual(loaded.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
  assert.deepEqual(loaded.reel.pending, []);
  assert.ok(loaded.contacts.includes("sumi"));
}

// 型の違う値も例外にしない（文字列の tournament / flavors、null の equip）。
for (const [name, key, load] of loaders) {
  files.clear();
  core.setState(null);
  files.set(key, JSON.stringify({ schema: 5, day: 3, tournament: "x", flavors: "double_apple", equip: null }));
  const loaded = load();
  assert(loaded, name + ": 型不一致でも読み込める");
  assert.equal(loaded.tournament.attempts, 0);
  assert.ok(Array.isArray(loaded.flavors));
  assert.equal(typeof loaded.equip, "object");
}

// 状態として解釈できない形（配列）は、例外なく読み込み不可になり、進行中の状態と保存が保たれる。
{
  files.clear();
  const previous = core.newGame();
  const previousJSON = JSON.stringify(previous);
  files.set(core.SAVE_KEY, "[1,2,3]");
  assert.equal(core.load(), null);
  assert.strictEqual(core.state, previous);
  assert.equal(JSON.stringify(core.state), previousJSON);
  assert.equal(files.get(core.SAVE_KEY), "[1,2,3]");
}

// 健全な旧セーブは従来どおり移行できる（正規化で意味が変わらない）。
for (const [name, key, load] of loaders) {
  files.clear();
  core.setState(null);
  files.set(key, JSON.stringify({
    schema: 9, day: 5, money: 12345,
    stats: { technique: 25, sense: 10, guts: 10, charm: 10, insight: 10 },
    reel: { pending: [], count: 3, introDone: true },
  }));
  const loaded = load();
  assert(loaded, name + ": 健全な旧セーブが読み込める");
  assert.equal(loaded.money, 12345);
  assert.equal(loaded.day, 5);
  assert.equal(loaded.stats.technique, 25);
  assert.equal(loaded.reel.count, 3);
}

console.log("corrupt save migrate: PASS (repro shape, null containers, type mismatches, graceful rejection, legacy compatibility)");
