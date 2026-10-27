// Issue 1081 D02: only the rig is gifted; existing flavor stock is preserved.
import assert from 'node:assert/strict';
globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const {DB} = await import('../js/core/data.js');
const rig = await import('../js/daily/home-rig.js');
const { on } = await import('../js/core/bus.js');
DB.dialogues = {}; // Real dialogue/save switching/portrait paths are exercised in the browser companion.
const notices = [];
on('notice', ({ text }) => notices.push(text));
const resources = s => JSON.stringify([s.money,s.stamina,s.stats,s.statXp,s.day,s.slot,s.affinity]);
let s = core.newGame();
assert.deepEqual(s.flavorStock, {});
const before = resources(s);
s.flavorStock = { double_apple: 25, lemon: 50, mint: 17 };
s.flavors = ['double_apple', 'lemon', 'mint'];
const leavesBefore = structuredClone([s.flavors, s.flavorStock]);
assert.equal(await rig.giveSumiRig(), true);
assert.deepEqual([s.flavors, s.flavorStock], leavesBefore, 'purchases and other supplies remain unchanged');
assert(s.owned.includes(rig.SUMI_RIG));
assert.equal(s.flags._sumi_double_apple_received, undefined, 'no new double apple receipt');
assert.equal(notices.length, 1);
assert(notices[0].includes('卓上台'));
assert(!notices.some(text => text.includes('ダブルアップル')));
assert.equal(resources(s),before);
assert.equal(await rig.giveSumiRig(),false);
s.flavorStock.double_apple = 0;
core.save(); s = core.load();
assert.equal(await rig.giveSumiRig(),false);
assert.equal(s.flavorStock.double_apple,0,'consumed gift cannot be restored by reload');
assert.equal(notices.length, 1, 'repeat and reload do not repeat the gift notice');

// New games receive no leaves; old receipt flags never prevent receiving a missing rig.
for (const received of [undefined, false, true]) {
  s = core.newGame(); s.day = 2;
  if (received !== undefined) s.flags._sumi_double_apple_received = received;
  const leaves = structuredClone([s.flavors, s.flavorStock]);
  await rig.giveEarlyHomeRig();
  assert(s.owned.includes(rig.SUMI_RIG));
  assert.deepEqual([s.flavors, s.flavorStock], leaves);
  assert.equal(s.flags._sumi_double_apple_received, received);
  const snapshot = JSON.stringify(s), count = notices.length;
  await rig.giveEarlyHomeRig();
  assert.equal(await rig.giveSumiRig(), false);
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(notices.length, count);
}

// Already received on the current schema: actual auto/manual LOAD keeps stock and flags byte for byte.
for (const key of [core.SAVE_KEY, 'suien_remake_slot1']) {
  s = core.newGame(); s.owned.push(rig.SUMI_RIG);
  s.flags._sumi_double_apple_received = true;
  s.flavors = ['double_apple', 'lemon']; s.flavorStock = { double_apple: 37.5, lemon: 50 };
  storage.set(key, JSON.stringify(s));
  s = key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key);
  const snapshot = JSON.stringify(s), count = notices.length;
  assert.equal(await rig.giveSumiRig(), false);
  await rig.giveEarlyHomeRig();
  assert.equal(JSON.stringify(s), snapshot);
  assert.deepEqual(s.flavorStock, { double_apple: 37.5, lemon: 50 });
  assert.equal(s.flags._sumi_double_apple_received, true);
  assert.equal(notices.length, count);
}
for (const schema of [1,4,14,18]) for (const grams of [0,12.5,100]) for (const complete of [false,true]) {
  s = core.newGame(); s.schema=schema; s.phase='daily'; s.day=complete?8:2;
  s.flavorStock={double_apple:grams,mint:17,lemon:50}; s.flavors=['double_apple','mint','lemon'];
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
    assert.deepEqual(s.flavorStock,{double_apple:grams,mint:17,lemon:50});
    await rig.giveSumiRig();
    assert.deepEqual(s.flavorStock,{double_apple:grams,mint:17,lemon:50});
    core.save(); s=core.load(); await rig.giveSumiRig();
    assert.equal(s.flavorStock.double_apple,grams,`${schema}/${grams}/${complete}/${key}`);
  }
}
// Feedback checkpoint LOAD restores the rig without adding leaves or replaying its gift.
s=core.newGame(); s.flags._ch1_mid={feedbackRead:true}; core.save(); s=core.load();
assert(s.owned.includes(rig.SUMI_RIG));
assert.equal(await rig.giveSumiRig(),false);
assert.deepEqual(s.flavorStock,{});
assert.equal(s.owned.filter(id=>id===rig.SUMI_RIG).length,1);
core.save();s=core.load();assert.equal(await rig.giveSumiRig(),false);
console.log('story_edit_564 OK: rig only, no flavor notice, existing supplies, consumed stock, receipt flags, 48 legacy auto/manual loads, feedback checkpoint');
