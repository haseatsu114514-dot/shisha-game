// 過去の版のセーブを固定して、版を上げても読めることを確かめる（#3726 B-7）。
//
// remake/test/fixtures/saves/ の JSON は、その時点の SCHEMA で作ったセーブをそのまま凍結したもの。
// 中身を書き換えない。SCHEMA を上げたら migrate() に1段足し、この検査が通ることを確かめる。
// 公開（リリース）した版のセーブは、公開時に新しい名前で1つ足す（schemaNN-<場面>.json）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../js/core/state.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/saves');
const files = new Map();
globalThis.localStorage = {
  getItem: key => files.get(key) ?? null,
  setItem(key, value) { files.set(key, String(value)); },
  removeItem(key) { files.delete(key); },
};

const fixtures = fs.readdirSync(dir).filter(name => /^schema\d+-.+\.json$/.test(name)).sort();
assert.ok(fixtures.length >= 2, 'fixtures exist');

// 移行で変えてはいけない、遊んだ結果そのものの値
const KEPT = ['chapter', 'phase', 'day', 'slot', 'money', 'stats', 'equip', 'lovers', 'loveLevel', 'baitoCount', 'kujiTickets', 'cycleId'];
// 持ち物・連絡先は、章に応じた支給品が読み込み時に足されることがあるので「減らない」を見る
const NOT_LOST = ['owned', 'flavors', 'contacts'];
const stable = (s) => { const c = structuredClone(s); delete c.savedAt; delete c.playMs; return JSON.stringify(c); };

for (const name of fixtures) {
  const raw = fs.readFileSync(path.join(dir, name), 'utf8');
  const original = JSON.parse(raw);
  const fixtureSchema = Number(name.match(/^schema(\d+)-/)[1]);
  assert.equal(original.schema, fixtureSchema, `${name}: file name matches its schema`);
  assert.ok(fixtureSchema <= core.SCHEMA, `${name}: not from the future`);

  // 起動時のオートセーブとして読む
  files.clear();
  core.setState(null);
  files.set(core.SAVE_KEY, raw);
  assert.ok(core.isLoadableSave(JSON.parse(raw)), `${name}: loadable`);
  const loaded = core.load();
  assert.ok(loaded, `${name}: load() succeeds`);
  assert.equal(loaded.schema, core.SCHEMA, `${name}: migrated to current schema`);
  for (const key of KEPT) {
    if (key in original) assert.deepEqual(loaded[key], original[key], `${name}: ${key} kept`);
  }
  for (const key of NOT_LOST) {
    for (const item of original[key] || []) assert.ok(loaded[key].includes(item), `${name}: ${key} keeps ${item}`);
  }
  for (const [id, value] of Object.entries(original.affinity || {})) {
    assert.ok((loaded.affinity[id] ?? 0) >= value, `${name}: affinity.${id} not lowered`);
  }

  // 保存し直しても同じ形で読める（移行は2度かけても変わらない）
  assert.equal(core.save(), true, `${name}: save after load`);
  const resaved = files.get(core.SAVE_KEY);
  core.setState(null);
  const reloaded = core.load();
  assert.ok(reloaded, `${name}: reload after save`);
  assert.equal(stable(reloaded), stable(JSON.parse(resaved)), `${name}: migrate is idempotent`);

  // 手動スロットから読んでも同じ
  for (const { key } of core.SAVE_SLOTS) {
    files.clear();
    core.setState(null);
    files.set(key, raw);
    const fromSlot = core.loadFromSlot(key);
    assert.ok(fromSlot, `${name}: loadFromSlot(${key})`);
    assert.equal(fromSlot.schema, core.SCHEMA);
    assert.equal(fromSlot.money, original.money);
  }
  console.log(`ok ${name} (schema ${fixtureSchema} -> ${core.SCHEMA})`);
}
console.log(`save fixtures: ${fixtures.length} files load on schema ${core.SCHEMA}`);
