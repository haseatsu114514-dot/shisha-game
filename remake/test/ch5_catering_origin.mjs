// node --experimental-vm-modules remake/test/ch5_catering_origin.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../js/chapters/ch5-catering-origin.js', import.meta.url), 'utf8');
const scenes = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch5_catering_origin.json', import.meta.url), 'utf8')).dialogues;
for (const scene of scenes) assert.deepEqual(scene.metadata, { forced_event: true }, '強制導入の面識から好感度を付けない');
const context = vm.createContext({ console });
const DB = { dialogues: {} }, played = [], notices = [], backgrounds = [];
let current, saves, onRead, onBg, onPlay, result, failRead;
const fresh = () => ({ chapter: 5, day: 40, slot: 0, money: 1234, stamina: 75,
  flags: { _ch5: { part: 'free', startDay: 40 }, _ch2_region: 'home' }, inbox: [] });
const stateMod = new vm.SyntheticModule(['state', 'save', 'timeOfDay'], function () {
  this.setExport('state', current); this.setExport('save', () => saves++);
  this.setExport('timeOfDay', () => current.slot === 1 ? 'night' : 'day');
}, { context });
const values = {
  DB, sceneBg: ref => ({ url: ref, tint: '' }),
  setBg: async url => { backgrounds.push(url); await onBg?.(); }, toast: t => notices.push(t),
  readDialogues: async (file, ids) => {
    assert.equal(file, 'ch5_catering_origin'); assert.deepEqual([...ids], scenes.map(s => s.dialogue_id));
    await onRead?.(); if (failRead) throw Error('network');
    return Object.fromEntries(scenes.map(s => [s.dialogue_id, s]));
  },
  play: async id => { played.push(id); await onPlay?.(); return result; },
};
const mod = new vm.SourceTextModule(source, { context });
await mod.link(spec => {
  if (spec === '../core/state.js') return stateMod;
  const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .find(m => m[2] === spec)[1].split(',').map(s => s.trim());
  return new vm.SyntheticModule(names, function () { for (const name of names) this.setExport(name, values[name]); }, { context });
});
current = fresh(); await mod.evaluate(); const O = mod.namespace;
function reset() {
  current = fresh(); stateMod.setExport('state', current); saves = 0; result = {};
  played.length = notices.length = backgrounds.length = 0; onRead = onBg = onPlay = null; failRead = false;
  for (const id of Object.keys(DB.dialogues)) delete DB.dialogues[id];
}
const swap = value => { current = value; stateMod.setExport('state', current); };
reset(); assert.equal(O.cateringBusinessOpen(current), false);
const before = JSON.stringify(current);
assert.equal(await O.introduceCateringBusiness(), true);
assert.deepEqual(played, ['ch5_catering_business']); assert.equal(saves, 1);
assert.equal(O.cateringBusinessOpen(current), true);
const expected = JSON.parse(before); expected.flags[O.CATERING_ORIGIN_FLAG] = true;
assert.equal(JSON.stringify(current), JSON.stringify(expected), '無料の導入で日付/行動/体力/金銭/報酬を変えない');
assert.equal(await O.introduceCateringBusiness(), true); assert.equal(saves, 1); assert.equal(played.length, 1);
// SAVE/LOAD with the read flag does not play again.
swap(JSON.parse(JSON.stringify(current))); await O.introduceCateringBusiness(); assert.equal(played.length, 1);
// The bridge may already have been read, but its old prologue stage is not rewritten.
reset(); current.flags._ch5.read = { ch5_bridge_after_return: true, ch5_opening: true };
await O.introduceCateringBusiness(); assert.equal(played[0], 'ch5_catering_business');
assert.deepEqual(current.flags._ch5.read, { ch5_bridge_after_return: true, ch5_opening: true });
// Existing offers, delegation, or served records remain open before the short retrospective.
for (const record of [{ offers: 1 }, { offer: { assigned: 'tsumugi', jobDay: 42 } }, { served: { wedding_party: 1 } }, { last: { day: 39 } }]) {
  reset(); current.flags._ch5_catering = record; assert.equal(O.cateringBusinessOpen(current), true);
  const snapshot = JSON.stringify(record); await O.introduceCateringBusiness();
  assert.equal(played[0], 'ch5_catering_business_recall'); assert.equal(JSON.stringify(record), snapshot);
}
for (const amend of [s => s.chapter = 4, s => s.flags._ch5.part = 'prologue', s => s.flags._ch5.part = 'scheduled',
  s => s.flags._ch5.matchDay = 41, s => s.flags._ch2_region = 'tokyo', s => s.flags._ch2_region = 'dubai', s => s.flags._ch2_region = 'widehanga']) {
  reset(); amend(current); assert.equal(O.cateringBusinessPending(current), false);
  assert.equal(await O.introduceCateringBusiness(), true); assert.equal(played.length, 0); assert.equal(saves, 0);
}
reset(); current.slot = 1; await O.introduceCateringBusiness(); assert.equal(backgrounds[0], 'bg_tonari_inside_night');
reset(); result = { cancelled: true }; const interrupted = JSON.stringify(current);
assert.equal(await O.introduceCateringBusiness(), false); assert.equal(JSON.stringify(current), interrupted); assert.equal(saves, 0);
result = {}; await O.introduceCateringBusiness(); assert.equal(saves, 1);
for (const hook of ['read', 'bg', 'play']) {
  reset(); const abandoned = current, replacement = fresh();
  const replace = () => swap(replacement);
  if (hook === 'read') onRead = replace; else if (hook === 'bg') onBg = replace; else onPlay = replace;
  assert.equal(await O.introduceCateringBusiness(), false);
  assert.equal(abandoned.flags[O.CATERING_ORIGIN_FLAG], undefined);
  assert.equal(replacement.flags[O.CATERING_ORIGIN_FLAG], undefined); assert.equal(saves, 0);
}
reset(); failRead = true;
await assert.rejects(O.introduceCateringBusiness(), /会話を読み込めませんでした/); assert.equal(saves, 0); assert.equal(played.length, 0);
failRead = false; assert.equal(await O.introduceCateringBusiness(), true); assert.equal(saves, 1);
// Repeated entry while the first read is in flight shares one task.
reset(); let release; onRead = () => new Promise(resolve => { release = resolve; });
const a = O.introduceCateringBusiness(), b = O.introduceCateringBusiness(); assert.equal(a, b);
release(); assert.equal(await a, true); assert.equal(played.length, 1); assert.equal(saves, 1);
console.log('ch5 catering origin: first/read-once, old saves, history, region/order, cancellation, LOAD, retry and concurrent entry passed');
