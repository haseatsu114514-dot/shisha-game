// Issue 564: stock moves to the existing rig gift; old inventory is never reconstructed.
import assert from 'node:assert/strict';
globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const {DB} = await import('../js/core/data.js');
const rig = await import('../js/daily/home-rig.js');
DB.dialogues = {}; // Real dialogue/save switching/portrait paths are exercised in the browser companion.
const resources = s => JSON.stringify([s.money,s.stamina,s.stats,s.statXp,s.day,s.slot,s.affinity]);
let s = core.newGame();
assert.deepEqual(s.flavorStock, {});
const before = resources(s);
s.flavorStock.double_apple = 25; // A purchased box remainder before the gift is preserved.
assert.equal(await rig.giveSumiRig(), true);
assert.equal(s.flavorStock.double_apple,75);
assert(s.flags._sumi_double_apple_received);
assert.equal(resources(s),before);
assert.equal(await rig.giveSumiRig(),false);
s.flavorStock.double_apple = 0;
core.save(); s = core.load();
assert.equal(await rig.giveSumiRig(),false);
assert.equal(s.flavorStock.double_apple,0,'consumed gift cannot be restored by reload');
for (const schema of [1,4,14,18]) for (const grams of [0,12.5,100]) for (const complete of [false,true]) {
  s = core.newGame(); s.schema=schema; s.phase='daily'; s.day=complete?8:2;
  s.flavorStock={double_apple:grams,mint:17}; s.flavors=['double_apple','mint'];
  if (complete) s.flags._ev_midcheck=true;
  // Existing pre-schema-9 migration expands absent XP keys to zero.
  // Preserve that established load shape; this gift migration must not change it.
  const expected = structuredClone(s);
  if (schema < 9) expected.statXp = Object.fromEntries(core.STAT_KEYS.map(key => [key, 0]));
  const before=resources(expected);
  const raw=JSON.stringify(s);
  for (const key of [core.SAVE_KEY,'suien_remake_slot1']) {
    storage.set(key,raw);
    s=key===core.SAVE_KEY?core.load():core.loadFromSlot(key);
    assert.equal(s.flags._sumi_double_apple_received,true);
    assert.equal(resources(s),before);
    assert.deepEqual(s.flavorStock,{double_apple:grams,mint:17});
    await rig.giveSumiRig();
    assert.deepEqual(s.flavorStock,{double_apple:grams,mint:17});
    core.save(); s=core.load(); await rig.giveSumiRig();
    assert.equal(s.flavorStock.double_apple,grams,`${schema}/${grams}/${complete}/${key}`);
  }
}
// New save after feedback, before the rig dialogue: migration can restore the rig, not lose the leaves.
s=core.newGame(); s.flags._ch1_mid={feedbackRead:true}; core.save(); s=core.load();
assert(s.owned.includes(rig.SUMI_RIG));
assert.equal(await rig.giveSumiRig(),true);
assert.equal(s.flavorStock.double_apple,50);
assert.equal(s.owned.filter(id=>id===rig.SUMI_RIG).length,1);
core.save();s=core.load();assert.equal(await rig.giveSumiRig(),false);
console.log('story_edit_564 OK: new gift, existing purchases, consumed stock, 48 legacy auto/manual loads, feedback checkpoint');
