// Real feature registry and public daily entry points; controlled UI/VN/stats/save ports.
// This checks state and persistence calls, not browser rendering or disk SAVE/LOAD.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = new URL('../js/', import.meta.url);
const state = {}, DB = { dialogues: {}, baito: [], equipById: {} };
let trace = [], saves = [], rainy = false;
const noop = () => {};
const el = (tag, attrs = {}, children = []) => Array.isArray(attrs)
  ? { tag, children: attrs } : { tag, ...attrs, children };
const find = (node, test) => node?.dataset?.test === test ? node
  : (node?.children || []).filter(Boolean).map(n => find(n, test)).find(Boolean);
const ports = {
  state, DB, config: {}, timeOfDay: () => 'day', bgUrl: x => x,
  el, pick: list => list[0], save: () => saves.push(JSON.stringify(state)),
  emit: (...args) => trace.push(['emit', ...args]), vnTest: { turbo: true },
  play: async (scene, opts) => { trace.push(['play', typeof scene === 'string' ? scene : scene.dialogue_id, opts]); return {}; },
  dialogueSequence: fn => fn(),
  showScreen: (_id, node) => { queueMicrotask(() => find(node, 'after-none').onclick()); return node; },
  setBg: async (...args) => trace.push(['bg', ...args]), retire: noop,
  SE: { select: noop }, playBgm: noop, modal: async () => null, toast: (...args) => trace.push(['toast', ...args]),
  addStamina: n => { state.stamina += n; trace.push(['stamina', n]); },
  addMoney: n => { state.money += n; trace.push(['money', n]); },
  applyStats: stats => trace.push(['stats', stats]), step: () => 1,
  currentCondition: () => ({ bonusRate: 1, shiftBonus: 0 }),
  isRainy: () => rainy, RAIN_BAITO: [], RAIN_BAITO_BONUS: 1200,
  shiftClose: async () => trace.push(['close']), meetHiyoriAtTonari: async () => {},
  hasNewStory: () => false, spotFollowupDue: () => null,
  axeThrowExposed: () => true, canStudyAttack: () => false, canStudyCubeCoals: () => false,
  readyLessons: () => [],
  on: () => () => {},
  callingSalesBonus: () => 0,
};
const ctx = vm.createContext({ console, queueMicrotask, AbortController });
const actual = new Set(['core/chapter-features.js', 'core/stat-step-tables.js', 'daily/home-rig.js', 'daily/tonari.js']);
const modules = new Map();
function get(id) {
  if (!modules.has(id)) modules.set(id, new vm.SourceTextModule(fs.readFileSync(new URL(id, root), 'utf8'), { context: ctx, identifier: id }));
  return modules.get(id);
}
async function link(spec, ref) {
  const id = path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier), spec));
  if (actual.has(id)) return get(id);
  const key = ref.identifier + '->' + id;
  if (!modules.has(key)) {
    const source = fs.readFileSync(new URL(ref.identifier, root), 'utf8');
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .filter(m => m[2] === spec).flatMap(m => m[1].split(',').map(x => x.trim()));
    modules.set(key, new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, ports[name] ?? (() => { throw Error('Unexpected port: ' + name); }));
    }, { context: ctx }));
  }
  return modules.get(key);
}
async function load(id) { const m = get(id); await m.link(link); await m.evaluate(); return m.namespace; }
const features = await load('core/chapter-features.js');
// Already evaluated dependencies may be returned by link for both public modules.
const rig = await load('daily/home-rig.js'), tonari = await load('daily/tonari.js');
function reset(overrides = {}) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, { chapter: 1, day: 2, slot: 1, flags: {}, owned: [], money: 20000, stamina: 100,
    baitoCount: 0, usedBaito: [], baitoRecent: [] }, structuredClone(overrides));
  DB.dialogues = {}; DB.baito = []; trace = []; saves = []; rainy = false;
}
const plays = () => trace.filter(t => t[0] === 'play').map(t => t[1]);
const chapters = [1, 2, 3, 4, 5, '1', undefined];
let cases = 0;
for (const chapter of chapters) {
  for (const feature of ['earlyHomeRig', 'baitoCameos']) assert.equal(features.chapterFeatureEnabled(chapter, feature), chapter === 1);
  assert.equal(features.chapterFeatureEnabled(chapter, 'fortune'), chapter === 1 || chapter === 2);
}
assert.equal(features.chapterFeatureEnabled(1, 'unknown'), false);
// DAY1/2/13/14, partial/full rest, old ownership including pro-only: exact old gift window.
for (const chapter of chapters) for (const day of [1, 2, 13, 14])
  for (const owned of [[], [rig.SUMI_RIG], [rig.PRO_RIG]]) for (const rest of [undefined, { fullDay: false }, { fullDay: true }]) {
    reset({ chapter, day, owned, restDay: rest });
    DB.dialogues[rig.RIG_SCENE] = {};
    const before = JSON.stringify(state);
    const due = chapter === 1 && day >= 2 && day < 14 && !rest?.fullDay && !owned.includes(rig.SUMI_RIG);
    await rig.giveEarlyHomeRig();
    assert.equal(state.owned.includes(rig.SUMI_RIG), due || owned.includes(rig.SUMI_RIG));
    if (due) {
      assert.deepEqual(plays(), [rig.RIG_SCENE]);
      assert.equal(state.flags._sumi_rig_received_day, `1:${day}`);
      assert.equal(saves.length, 1); assert.equal(saves[0], JSON.stringify(state));
      assert.equal(state.money, 20000); assert.equal(state.stamina, 100);
      const received = JSON.stringify(state); await rig.giveEarlyHomeRig();
      assert.equal(JSON.stringify(state), received); assert.equal(saves.length, 1);
    } else { assert.equal(JSON.stringify(state), before); assert.equal(trace.length, 0); assert.equal(saves.length, 0); }
    cases++;
  }
reset(); await rig.giveEarlyHomeRig(); // Missing gift dialogue still grants/saves, as before.
assert.deepEqual(plays(), []); assert(state.owned.includes(rig.SUMI_RIG)); assert.equal(saves.length, 1);
// Actual complete shifts: count is incremented before eligibility; first eligible cameo wins.
const cameoFlags = ['_ev_rei_cameo', '_ev_reviewer_cameo', '_ev_maezono_cameo'];
const cameoScenes = ['ch1_rei_cameo', 'ch1_reviewer_cameo', 'ch1_maezono_cameo'];
for (const chapter of chapters) for (const day of [1, 2, 3, 4, 5, 6, 13, 14])
  for (const count of [1, 2, 3, 4, 5]) for (const mask of [0, 1, 3, 7]) for (const agehaScript of [false, true]) {
    const flags = Object.fromEntries(cameoFlags.filter((_, i) => mask & (1 << i)).map(k => [k, true]));
    reset({ chapter, day, baitoCount: count - 1, flags });
    if (agehaScript) DB.dialogues.ch1_ageha_encounter = {};
    const expected = chapter !== 1 ? -1 : count === 2 && !(mask & 1) ? 0
      : count >= 3 && day >= 4 && !(mask & 2) ? 1 : count >= 4 && day >= 6 && !(mask & 4) ? 2 : -1;
    await tonari.doBaito();
    const ids = plays();
    assert.deepEqual(ids.filter(id => cameoScenes.includes(id)), expected < 0 ? [] : [cameoScenes[expected]]);
    assert.equal(ids.includes('remake_baito_routine'), expected < 0);
    assert.equal(ids.includes('ch1_ageha_encounter'), chapter === 1 && day >= 4 && agehaScript);
    for (let i = 0; i < 3; i++) assert.equal(!!state.flags[cameoFlags[i]], !!(mask & (1 << i)) || i === expected);
    assert.equal(!!state.flags._ev_ageha_cameo, chapter === 1 && day >= 4 && agehaScript);
    assert.equal(state.baitoCount, count); assert.equal(state.lastBaitoDay, day);
    assert.equal(state.money, 28000); assert.equal(state.stamina, 76); assert.equal(saves.length, 0);
    assert.deepEqual(structuredClone(trace.find(t => t[0] === 'stats')), ['stats', { technique: 2, charm: 2 }]);
    assert.equal(state.baitoRecent.length, expected < 0 ? 0 : 1);
    if (expected >= 0) assert.equal(state.baitoRecent[0].id, cameoScenes[expected]);
    cases++;
  }
// All read flags suppress repeat cameos; ordinary customer and empty-pool fallbacks remain intact.
for (const chapter of chapters) for (const pool of [[], [{ id: 'ordinary', text: 'いつもの注文', choices: [], customers: ['regular'] }]]) {
  reset({ chapter, day: 6, baitoCount: 3, flags: Object.fromEntries([...cameoFlags, '_ev_ageha_cameo'].map(k => [k, true])) });
  DB.dialogues.ch1_ageha_encounter = {}; DB.baito = pool; rainy = true;
  await tonari.doBaito({ called: true });
  assert(!plays().some(id => [...cameoScenes, 'ch1_ageha_encounter'].includes(id)));
  assert(plays().includes(pool.length ? 'baito_ordinary' : 'remake_baito_routine'));
  assert.equal(state.money, 34200); assert.equal(saves.length, 0);
  assert.equal(state.usedBaito.includes('ordinary'), !!pool.length);
  cases++;
}
// Missing cameo scripts still mark their existing flags/history (no new fallback behavior).
for (let i = 0; i < 3; i++) {
  reset({ day: 6, baitoCount: i + 1, flags: Object.fromEntries(cameoFlags.slice(0, i).map(k => [k, true])) });
  await tonari.doBaito(); assert(plays().includes(cameoScenes[i])); assert(state.flags[cameoFlags[i]]);
}
console.log(`PASS ch1 daily features: ${cases} boundary cases; actual registry/home-rig/tonari, controlled ports`);
