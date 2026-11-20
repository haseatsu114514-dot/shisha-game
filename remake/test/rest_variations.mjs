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
import { advanceToChapterThree, departChapterThree } from '../js/chapters/ch3-progress.js';
import { classifyFlag } from '../js/core/carry.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const DB = { dialogues: {} }, loaded = new Set(), scenes = [];
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)) };
let current, cancelled = false, swap = false, choices = [], trial = false, rehearsal = false, rewards = 0;
let rainy = false; // 東京の雨の日（daily/weather.js の isRainy の代わり。第3章の奥の部屋・公園・mukai のシフト）
let sumiCallRead = false, companion = null; // 第4章の時差の電話（ch4_story_sumi_call）の既読と、同じ便で来た恋人
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
  spendableMoney: () => current.money, chapterFourProgress: () => ({ startDay: current.day, read: sumiCallRead ? { ch4_story_sumi_call: true } : {} }),
  CH4_SUMI_CALL: 'ch4_story_sumi_call', overseasCompanion: () => ({ companion }),
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
  ['ch4_dubai_inn', 'ch4_inn_rest', () => inn.namespace.performDubaiSpot(inn.namespace.CH4_DUBAI_SPOTS.find(s=>s.place==='inn'), {}, {staminaGuard:async()=>true}), ['_b', '_c', '_d', '_e']], // #3097 で宿は5本
];
const revisits = rest => rest || ['_b', '_c'];
for (const [spot,base,visit,rest] of cases) {
  replace(newState()); current.money=12345; current.stamina=10; scenes.length=0;
  for (const suffix of ['', ...revisits(rest), '']) {
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
for (const [,base,,rest] of cases) for (const suffix of revisits(rest)) {
  const scene=DB.dialogues[base+suffix]; assert(scene && !scene.metadata);
  for (const line of scene.lines) {
    assert(!line.type); assert(['','hajime'].includes(line.speaker));
    assert([...line.text].reduce((n,c)=>n+(c.codePointAt(0)<=255?0.5:1),0)<=48);
  }
}
// スミさんからの夜の電話（#3097 計画 4-1）: DAY7 の時差の電話を読んだ後の夜だけ、宿で休むと休む場面の代わりに一本ずつ順に読む。
// 昼・電話の前は休む巡回のまま。電話は休む巡回を進めず、一度きり。中断・保存の切り替えでは進めない。つむぎが同じ便なら _c を飛ばす。
{
  const calls = ['ch4_sumi_call_b', 'ch4_sumi_call_c', 'ch4_sumi_call_d', 'ch4_sumi_call_e'];
  assert.deepEqual([...inn.namespace.SUMI_NIGHT_CALLS], calls);
  for (const id of calls) {
    const scene = DB.dialogues[id];
    assert(loaded.has(id) && scene?.lines?.length, `${id}: in the real chapter load list`);
    assert(!scene.metadata && scene.lines.every(line => !line.type), `${id}: no rewards, flags or branches in the script`);
    assert(scene.lines.some(line => line.speaker === 'sumi'), `${id}: Sumi talks`);
    assert(scene.lines.every(line => ['', 'hajime', 'sumi'].includes(line.speaker)), `${id}: only Sumi and Hajime on the phone`);
    assert(!scene.lines.some(line => /大会|審査|優勝|シェイク|路地裏/.test(line.text)), `${id}: no tournament or Sumi's Dubai past`);
  }
  const innVisit = cases[2][2], restKey = '_spot_turn_ch4_dubai_inn';
  const rest = async (slot) => {
    current.slot = slot; current.stamina = 10;
    const result = await innVisit();
    assert.equal(result.used, true); assert(current.stamina > 10, 'a call night is still a rest');
    return scenes.at(-1);
  };
  replace(newState()); current.money = 12345; scenes.length = 0; rewards = 0; sumiCallRead = false; companion = null;
  assert.equal(await rest(1), 'ch4_inn_rest', 'before the DAY7 call, a night rest is a rest');
  sumiCallRead = true;
  assert.equal(await rest(0), 'ch4_inn_rest_b', 'a daytime rest after the call is still a rest');
  for (const id of calls) {
    assert.equal(await rest(1), id, 'night rests after the call read the calls in order');
    assert(saveToSlot('suien_remake_slot1')); replace(loadFromSlot('suien_remake_slot1'));
  }
  assert.equal(current.flags[restKey], 2, 'calls do not advance the rest rotation');
  assert.equal(current.flags._ch4_dubai_talks.sumi_call, calls.length);
  assert.equal(await rest(1), 'ch4_inn_rest_c', 'after the four calls, the night rest returns to the rest rotation');
  assert.equal(current.money, 12345); assert.equal(rewards, 0, 'calls give no affinity or stats');
  // 中断・別の保存への切り替えでは、電話も休む巡回も進めない
  replace(newState()); current.slot = 1; current.stamina = 10;
  cancelled = true; assert.equal((await innVisit()).used, false); cancelled = false;
  assert.equal(current.flags._ch4_dubai_talks, undefined); assert.equal(current.flags[restKey], undefined); assert.equal(current.stamina, 10);
  const abandoned = current; swap = true; assert.equal((await innVisit()).used, false); swap = false;
  assert.equal(abandoned.flags._ch4_dubai_talks, undefined, 'a switched save does not count the call');
  assert.equal(await rest(1), calls[0], 'the interrupted call is read again');
  // つむぎが同じ便で来ていれば、tonari のつむぎの話は飛ばす
  replace(newState()); companion = 'tsumugi'; scenes.length = 0;
  for (let i = 0; i < 4; i++) await rest(1);
  assert.deepEqual(scenes, ['ch4_sumi_call_b', 'ch4_sumi_call_d', 'ch4_sumi_call_e', 'ch4_inn_rest'], 'Tsumugi travelling with Hajime is not drawing at tonari');
  sumiCallRead = false; companion = null;
}
console.log('PASS rest variations: real chapter loaders/visits, rotation, SAVE/LOAD, cancellation, menus, unchanged rewards and Sumi\'s night calls');

// #3097 PR-G: 東京の雨の日（第3章の日常ループ）。isRainy が雨の日だけ雨の回を読み、晴れの日は今までの巡回のまま。
// 奥の部屋は第1章の家で休むと同じ quietTurn の雨の束（休む1回目は雨でも最初の場面）。公園・mukai のシフトは外出の記録に雨の回を数える。
{
  Object.assign(values, { isRainy: () => rainy, availableOptionalScenes: () => [], availableChapterThreeTrials: () => [],
    loverMilestonesDue: () => [], mukaiShiftPay: () => 10000, runMukaiShift: async ({ intro }) => intro() });
  const ch3 = await load('chapters/ch3-tokyo-daily.js'); await ch3.evaluate();
  const { chapterThreeTokyoDefinition, CH3_TOKYO_SPOTS, TOKYO_DAILY_IDS } = ch3.namespace;
  Object.assign(DB.dialogues, await readDialogues('ch3_outings', [...outings.OUTING_DIALOGUE_IDS]),
    await readDialogues('ch3_tokyo_daily', [...TOKYO_DAILY_IDS]));
  const tokyo = () => {
    const value = newState();
    Object.assign(value, { chapter: 2, day: 25, phase: 'cleared', money: 12345, stamina: 50 });
    value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: 'complete' } };
    assert(advanceToChapterThree(value)); value.day += 3; assert(departChapterThree(value));
    value.slot = 0; value.phase = 'daily';
    return value;
  };
  const def = chapterThreeTokyoDefinition({});
  const go = async (place, wet, pick = []) => {
    rainy = wet; choices = [...pick]; current.stamina = 50;
    const result = await def.performSpot(CH3_TOKYO_SPOTS.find(entry => entry.place === place), { staminaGuard: async () => true });
    rainy = false;
    return result.used ? scenes.at(-1) : null;
  };
  replace(tokyo()); scenes.length = 0;
  assert.deepEqual([await go('room', true), await go('room', true), await go('room', false), await go('room', true), await go('room', false)],
    ['ch3_tokyo_room_rest', 'ch3_tokyo_room_rest_rain', 'ch3_tokyo_room_rest_b', 'ch3_tokyo_room_rest_rain', 'ch3_tokyo_room_rest_c'],
    'room rests: the first rest is the usual one, rainy rests read the rain scene and keep the usual rotation');
  assert.equal(current.flags._ch3_room_rests, 3);
  assert.equal(current.flags._spot_turn_ch3_room_rest_rain, 2);
  assert.equal(classifyFlag('_spot_turn_ch3_room_rest_rain'), 'progression', 'the rain turn is not carried into NG+');
  cancelled = true; assert.equal(await go('room', true), null); cancelled = false;
  assert.equal(current.flags._spot_turn_ch3_room_rest_rain, 2, 'a cancelled rainy rest does not count');
  assert(loaded.has('ch3_tokyo_room_rest_rain'), 'the rain scene is in the real chapter load list');

  replace(tokyo()); scenes.length = 0;
  assert.deepEqual([await go('park', true), await go('park', false), await go('park', true), await go('park', false)],
    ['ch3_outing_park_walk_day_rain', 'ch3_outing_park_walk_day', 'ch3_outing_park_walk_day_rain', 'ch3_outing_park_walk_day_b']);
  current.slot = 1;
  assert.deepEqual([await go('park', true), await go('park', false)], ['ch3_outing_park_walk_night_rain', 'ch3_outing_park_walk_night']);
  const shift = ['outing:mukai_help'];
  current.slot = 0;
  assert.deepEqual([await go('mukai', true, shift), await go('mukai', true, shift), await go('mukai', false, shift), await go('mukai', true, shift)],
    ['ch3_outing_mukai_help_lost', 'ch3_outing_mukai_help_rain', 'ch3_outing_mukai_help_lost_d', 'ch3_outing_mukai_help_rain_b'],
    'shift intros: the first shift is the usual one, then rainy days read the rain intros');
  cancelled = true; assert.equal(await go('mukai', true, shift), null); cancelled = false;
  assert.deepEqual(current.flags._ch3_outings, { park_walk: 6, park_walk_day: 4, park_walk_day_rain: 2, park_walk_night: 2,
    park_walk_night_rain: 1, mukai_help: 4, mukai_help_rain_lost: 2 }, 'a cancelled rainy shift does not count');

  const scene = DB.dialogues.ch3_tokyo_room_rest_rain;
  assert(scene && !scene.metadata && scene.lines.every(line => !line.type && ['', 'hajime', 'mukai_master'].includes(line.speaker)));
  assert(scene.lines.every(line => [...line.text].reduce((n, c) => n + (c.codePointAt(0) <= 255 ? 0.5 : 1), 0) <= 48));
  const text = scene.lines.map(line => line.text).join('\n');
  assert.match(text, /雨/); assert.doesNotMatch(text, /昼|夜|午後|朝|大会/, 'a room rest can be any time of day');
  assert.doesNotMatch(scene.lines.filter(line => line.speaker === 'hajime').map(line => line.text).join('\n'), /舌|味/);
  assert(scene.lines.filter(line => line.speaker === 'mukai_master').length >= 3, 'Mukai speaks');
}
console.log('PASS rest variations: Tokyo rain scenes only on rainy days (room, park, mukai shift) without skipping the usual rotation');
