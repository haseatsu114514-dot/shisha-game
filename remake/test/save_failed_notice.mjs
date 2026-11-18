// 端末に保存できない時、遊びを止めずに一度だけ知らせ、保存できるようになったら戻る（#3726 B-7）。
import assert from 'node:assert/strict';
import * as core from '../js/core/state.js';
import { on } from '../js/core/bus.js';

let full = false;
const files = new Map();
globalThis.localStorage = {
  getItem: key => files.get(key) ?? null,
  setItem(key, value) {
    if (full) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    files.set(key, String(value));
  },
  removeItem(key) { files.delete(key); },
};
const events = [];
on('save-failed', () => events.push('failed'));
on('save-recovered', () => events.push('recovered'));

core.newGame();
assert.equal(core.save(), true);
assert.deepEqual(events, [], 'no notice while saving works');

full = true;
const before = core.state.money;
assert.equal(core.save(), false, 'save reports failure');
assert.equal(core.save(), false);
assert.equal(core.saveToSlotResult(core.SAVE_SLOTS[0].key).autoSaved, false);
assert.deepEqual(events, ['failed'], 'only the first failure is announced');
assert.equal(core.state.money, before, 'play state is untouched');

full = false;
assert.equal(core.save(), true);
assert.deepEqual(events, ['failed', 'recovered']);
full = true;
core.save();
assert.deepEqual(events, ['failed', 'recovered', 'failed'], 'a new failure after recovery is announced again');
console.log('save failed notice: once per failing stretch');
