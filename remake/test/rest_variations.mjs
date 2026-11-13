// Run the real chapter entry points and quietTurn with rendering replaced.
// node --experimental-vm-modules remake/test/rest_variations.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newState, setState, saveToSlot, loadFromSlot } from '../js/core/state.js';
import * as outings from '../js/chapters/ch3-outing-progress.js';
import * as local from '../js/chapters/ch4-dubai-local.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const DB = { dialogues: {} }, loaded = new Set(), scenes = [];
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)) };
let current, cancelled = false, swap = false, choices = [], trial = false, rehearsal = false, rewards = 0;
const context = vm.createContext({ console });
const noop = () => {};
const readDialogues = async (file, ids) => {
  if (!ids.length) return {};
  const data = JSON.parse(fs.readFileSync(path.resolve(root, '../../data/dialogue', file + '.json')));
  const result = Object.fromEntries(data.dialogues.filter(d => ids.includes(d.dialogue_id)).map(d => [d.dialogue_id,d]));
  for (const id of ids) loaded.add(id);
  return result;
};
const values = {
  ...outings, ...local, DB, TOKYO_VISIT_COST: 4000, MASHIRO_TIME_SCENES: [], MASHIRO_TIME_FILE: 'mashiro_time',
  CH5_CAMEL_MEET: { scene: 'ch5_dubai_camel_meet' }, CAMEL_SCENES: {}, DESERT_SPOT_IDS: {},
  DUBAI_LETTER_AGAIN: [], SHEIKH_BOND_IDS: [], TAIYO_BOND_IDS: [], CH4_PLACE_BG: {},
  INN_TRIAL_IDS: [], REHEARSAL_IDS: [], CAFE_TASTE_IDS: [], FESTA_BOND_IDS: [],
  save: noop, timeOfDay: () => current.slot ? 'night' : 'day', markMet: noop,
  sceneBg: ref => ({ url: ref }), bgUrl: ref => ref, setBg: async () => {},
  play: async scene => { scenes.push(typeof scene === 'string' ? scene : scene.dialogue_id);
    if (swap) replace(newState()); return { cancelled }; },
  modal: async () => choices.shift(), layers: { hud: { firstElementChild: null } },
  readDialogues, loadMukaiShift: async () => {}, creekSpotScenes: x => x,
  addStamina: n => { current.stamina += n; }, earnStat: () => rewards++, gainAffinity: () => rewards++,
  spendableMoney: () => current.money, chapterFourProgress: () => ({ startDay: current.day, read: {} }),
  innTrialDue: () => trial, rehearsalDue: () => rehearsal, chainVisitDue: () => null,
};
const stateModule = new vm.SyntheticModule(['state','save','timeOfDay','markMet'], function() {
  this.setExport('state',current); for (const k of ['save','timeOfDay','markMet']) this.setExport(k,values[k]);
}, { context });
function replace(value) { current = value; setState(value); if (stateModule.status !== 'unlinked') stateModule.setExport('state',value); }
replace(newState());
const modules = new Map();
const real = new Set(['daily/spots.js','chapters/ch5-tokyo.js','chapters/ch5-dubai.js','chapters/ch4-dubai-daily.js']);
async function load(rel) {
  if (modules.has(rel)) return modules.get(rel);
  let source = fs.readFileSync(path.join(root,rel),'utf8');
  if (rel === 'chapters/ch4-dubai-daily.js') source += '\nexport { performDubaiSpot };';
  const mod = new vm.SourceTextModule(source,{context,identifier:rel}); modules.set(rel,mod);
  await mod.link(async spec => {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec));
    if (target === 'core/state.js') return stateModule;
    if (real.has(target)) return load(target);
    const names = [...new Set([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .filter(m => m[2] === spec).flatMap(m => m[1].split(',').map(n => n.trim()).filter(Boolean)))];
    // Re-exported names are unused by these entry points.
    if (target === 'core/affinity-stages.js') names.push('VISIT_SEQ');
    return new vm.SyntheticModule([...new Set(names)],function() {
      for (const name of new Set(names)) this.setExport(name, values[name] ?? (/^[A-Z_0-9]+$/.test(name) ? [] : noop));
    },{context});
  }); return mod;
}
const tokyo = await load('chapters/ch5-tokyo.js'); await tokyo.evaluate();
const dubai = await load('chapters/ch5-dubai.js'); await dubai.evaluate();
const inn = await load('chapters/ch4-dubai-daily.js'); await inn.evaluate();
Object.assign(DB.dialogues, await readDialogues('ch4_dubai_daily', [...inn.namespace.DUBAI_DAILY_IDS]));
const cases = [
  ['ch5_tokyo_attic', 'ch5_tokyo_attic_rest', () => tokyo.namespace.performTokyoSpot(tokyo.namespace.TOKYO_SPOTS.find(s=>s.id==='ch5_tokyo_attic'))],
  ['ch5_dubai_guest', 'ch5_dubai_guest_rest', () => dubai.namespace.performDubaiSpot(dubai.namespace.DUBAI_SPOTS.find(s=>s.id==='ch5_dubai_guest'))],
  ['ch4_dubai_inn', 'ch4_inn_rest', () => inn.namespace.performDubaiSpot(inn.namespace.CH4_DUBAI_SPOTS.find(s=>s.place==='inn'), {}, {staminaGuard:async()=>true})],
];
for (const [spot,base,visit] of cases) {
  replace(newState()); current.money=12345; current.stamina=10; scenes.length=0;
  for (const suffix of ['', '_b', '_c', '']) {
    const before=current.stamina; assert.equal((await visit()).used,true);
    assert.equal(scenes.at(-1),base+suffix,spot+' visit order');
    assert(current.stamina>before); assert.equal(current.money,12345); assert.equal(rewards,0);
    assert(loaded.has(base+suffix), 'variant must be included in the real chapter load list');
    assert(saveToSlot('suien_remake_slot1')); replace(loadFromSlot('suien_remake_slot1'));
    current.stamina=10; current.slot=1-current.slot;
  }
  const key='_spot_turn_'+spot, count=current.flags[key];
  cancelled=true; assert.equal((await visit()).used,false); cancelled=false;
  assert.equal(current.flags[key],count); assert.equal(current.stamina,10);
  const abandoned=current; swap=true; assert.equal((await visit()).used,false); swap=false;
  assert.equal(abandoned.flags[key],count); assert.equal(current.flags[key],undefined);
  assert.equal(current.stamina,100);
}
// Both inn menu paths share the same counter as an ordinary rest; cancel does not advance.
replace(newState()); current.money=12345; current.stamina=10;
trial=true; choices=['cancel']; assert.equal((await cases[2][2]()).used,false);
choices=['rest']; assert.equal((await cases[2][2]()).used,true); assert.equal(scenes.at(-1),'ch4_inn_rest');
trial=false; rehearsal=true; choices=['rest']; await cases[2][2](); assert.equal(scenes.at(-1),'ch4_inn_rest_b');
rehearsal=false; await cases[2][2](); assert.equal(scenes.at(-1),'ch4_inn_rest_c');
for (const [,base] of cases) for (const suffix of ['_b','_c']) {
  const scene=DB.dialogues[base+suffix]; assert(scene && !scene.metadata);
  for (const line of scene.lines) {
    assert(!line.type); assert(['','hajime'].includes(line.speaker));
    assert([...line.text].reduce((n,c)=>n+(c.codePointAt(0)<=255?0.5:1),0)<=48);
  }
}
console.log('PASS rest variations: real chapter loaders/visits, rotation, SAVE/LOAD, cancellation, menus and unchanged rewards');
