import assert from 'node:assert/strict';
import * as core from '../js/core/state.js';
import { on } from '../js/core/bus.js';

const files = new Map();
let writes = 0;
let hudEvents = 0;
globalThis.localStorage = {
  getItem: key => files.get(key) ?? null,
  setItem(key, value) { writes++; files.set(key, String(value)); },
};
on('hud', () => hudEvents++);

const loaders = [
  ['boot', core.SAVE_KEY, () => core.load()],
  ...core.SAVE_SLOTS.map(({ key }) => [key, key, () => core.loadFromSlot(key)]),
];

for (const [name, key, load] of loaders) {
  for (const schema of [core.SCHEMA + 1, String(core.SCHEMA + 1), core.SCHEMA + 100]) {
    for (const inGame of [false, true]) {
      files.clear();
      const previous = inGame ? core.newState() : null;
      core.setState(previous);
      const previousJSON = JSON.stringify(previous);
      files.set(core.SAVE_KEY, JSON.stringify(core.newState()));
      files.set(key, JSON.stringify({ ...core.newState(), schema, futureOnly: { keep: true } }, null, 2));
      const before = [...files];
      writes = 0;
      hudEvents = 0;
      assert.equal(load(), null, `${name}: reject future schema ${schema}`);
      assert.equal(core.state, previous, `${name}: preserve active state reference`);
      assert.equal(JSON.stringify(core.state), previousJSON, `${name}: preserve active state content`);
      assert.equal(hudEvents, 0, `${name}: no state-change notification`);
      assert.equal(writes, 0, `${name}: no autosave or gallery writes`);
      assert.deepEqual([...files], before, `${name}: preserve original storage bytes`);
    }
  }

  // Missing schema and old saves still migrate; current saves remain loadable.
  for (const schema of [undefined, 1, core.SCHEMA - 1, core.SCHEMA]) {
    files.clear();
    core.setState(null);
    files.set(key, JSON.stringify({ ...core.newState(), schema, money: 12345, day: 3 }));
    const loaded = load();
    assert.equal(loaded, core.state);
    assert.equal(loaded.schema, core.SCHEMA);
    assert.equal(loaded.money, 12345);
    assert.equal(loaded.day, 3);
    if (schema == null || schema < 16) assert.equal(loaded.flags._axe_bar_legacy_access, true);
    core.save();
    assert.equal(JSON.parse(files.get(core.SAVE_KEY)).schema, core.SCHEMA);
  }

  for (const raw of [null, '{broken json']) {
    files.clear();
    if (raw !== null) files.set(key, raw);
    const previous = core.newGame();
    writes = 0;
    assert.equal(load(), null, `${name}: existing missing/corrupt save behavior`);
    assert.equal(core.state, previous);
    assert.equal(writes, 0);
  }
}
console.log('future schema save: PASS (boot + all slots; storage/state preservation; legacy/current compatibility)');
