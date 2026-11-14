// Production shop gateway, greeting, VN conditions, visits and SAVE/LOAD; only presentation ports are controlled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = new URL('../js/', import.meta.url);
const scripts = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch1_rio.json', import.meta.url)));
const allScenes = Object.fromEntries(scripts.dialogues.map(d => [d.dialogue_id, d]));
const db = { relationshipMemories: {}, dialogues: { ...allScenes }, flavorById: {}, characters: {} };
const shown = [], entered = [], counters = [], floors = [], awards = [], memory = new Map();
let interrupt = null, nextFloor = 'shop', reloads = 0, dailyRuns = 0;
const node = () => ({ dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  children: [], append(...xs) { this.children.push(...xs); }, replaceChildren() {}, setAttribute() {}, addEventListener() {},
  querySelector() { return null; }, querySelectorAll() { return []; }, remove() {} });
const context = vm.createContext({ console, URL, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, performance,
  document: { body: node() }, window: { addEventListener() {} },
  localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,String(v)), removeItem: k => memory.delete(k) },
  rendered: line => { shown.push(line.text); return interrupt?.(line); },
  counter: opts => { counters.push(opts); return 'bought'; }, floor: () => { floors.push(true); return nextFloor; } });
const real = ['core/state.js', 'daily/shop.js', 'daily/shop-greeting.js', 'daily/spots.js', 'daily/spot-hours.js', 'core/rules.js', 'vn/engine.js', 'core/relationships.js', 'core/story-context.js', 'core/bus.js', 'chapters/departure-prep.js'];
const modules = new Map(), required = new Map();
const known = { DB: db, MASTERY_THRESHOLDS: [0,6,18,36,60],
  VISIT_SEQ: { rio: ['ch1_rio_first','ch1_rio_second','ch1_rio_third'] }, AFFINITY_RANK_PTS: [0,9,18,27],
  RAIN_SPOT_TEXTS: {}, AXE_BAR: {}, WIDEHANGA_FLAVORS: [], TOKYO_FLAVORS: [], el: node, layers: { vn: node(), fx: node() },
  createNameFit: () => ({ fit() {} }), sceneBg: () => ({}), imageReady: async () => true, loadVnFonts: async () => [],
  setBg: () => Promise.resolve(), portraitInfo: () => null, currentBgm: () => null,
  readDialogues: async () => { reloads++; return allScenes; }, gainAffinity: (...args) => awards.push(args),
  tokyoShopFlavors: () => [], runDaily: async () => { dailyRuns++; } };
for (const p of real) {
  let source = fs.readFileSync(new URL(p, root), 'utf8');
  if (p === 'vn/engine.js') source += `\nintroThenShow = function(line) { if (!line) return finish(); if (!rendered(line)) next(); };\nexport const shopTestPort = { skip: () => setSkip(true), cancel: () => finish(true) };`;
  if (p === 'daily/shop.js') source += `\nopenCounter = async opts => counter(opts); chooseShopFloor = async () => floor();`;
  modules.set(p, new vm.SourceTextModule(source, { context, identifier: p, initializeImportMeta(meta) { meta.url = new URL(p, root).href; },
    importModuleDynamically: async specifier => {
      assert.equal(specifier, '../scenes/title.js');
      const title = new vm.SyntheticModule(['openConfig'], function() { this.setExport('openConfig', async () => {}); }, { context });
      await title.link(() => { throw new Error('unexpected title import'); }); await title.evaluate(); return title;
    } }));
  for (const m of source.matchAll(/(?:import|export)\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(p),m[2]));
    if (real.includes(target)) continue;
    if (!required.has(target)) required.set(target,new Set());
    for (const name of m[1].split(',')) required.get(target).add(name.trim().split(/\s+as\s+/)[0]);
  }
}
for (const [p,names] of required) modules.set(p,new vm.SyntheticModule([...names],function() {
  for (const name of names) this.setExport(name,Object.hasOwn(known,name) ? known[name] : () => {});
},{context,identifier:p}));
const entry = new vm.SourceTextModule(real.map((p,i) => `export * as m${i} from './${p}';`).join('\n'), { context, identifier: 'entry.js' });
await entry.link((s,ref) => modules.get(path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),s)))); await entry.evaluate();
const { m0: core, m1: shop, m2: greeting, m3: spots, m6: vn, m10: departure } = entry.namespace;
vn.hooks.onEnter = id => entered.push(id);
const fresh = (values = {}) => {
  interrupt = null; shown.length = entered.length = counters.length = floors.length = awards.length = 0; nextFloor = 'shop';
  const s = core.newGame(); Object.assign(s, { phase:'daily', chapter:1, day:1, slot:0 }, values); return s;
};
const economy = s => JSON.stringify(Object.fromEntries(['money','stamina','stats','statXp','story','visits','visitedDay','affinity','contacts','flavorStock','flavors','relationshipMemories'].map(k => [k,s[k]])));
let s = fresh(), before = economy(s);
assert.equal(await shop.openShop({ errand:'lemon',expense:true }), 'bought');
assert.deepEqual(entered,['ch1_shop_rio_first']); assert.equal(counters.length,1); assert.equal(floors.length,0);
assert(s.met.rio && s.flags._met_rio); assert.equal(economy(s),before); assert.equal(awards.length,0);
assert(!s.flags._ev_rio_monitor && !s.flags._lime_contact_rio && !s.flags._rio_sample_received);
assert(shown.some(t => t?.includes('今度は夜に2階'))); assert(!shown.some(t => t?.includes('モルモット')));
core.save(); s = core.load(); before = economy(s); await shop.openShop();
assert.deepEqual(entered,['ch1_shop_rio_first','ch1_shop_rio_return']); assert.equal(economy(s),before);
assert.equal(floors.length,1); assert.equal(counters.length,2); assert.equal(awards.length,0);
console.log('PASS compulsory DAY1 counter handoff, no rewards/visit/contact, optional invitation, repeat and SAVE/LOAD');
for (const chapter of [1,2,3,5]) for (const knownAs of ['met','story','visits','flag']) {
  s = fresh({chapter,day:5});
  if (knownAs === 'met') s.met.rio = true;
  if (knownAs === 'story') s.story.rio = 2;
  if (knownAs === 'visits') s.visits.rio = 1;
  if (knownAs === 'flag') s.flags._met_rio = true;
  const scene = greeting.shopGreetingScene(s); assert.notEqual(scene,'ch1_shop_rio_first');
  before = economy(s); core.save(); s=core.load(); await shop.openShop({errand:'lemon'});
  assert.equal(economy(s),before); assert.equal(awards.length,0); assert(!shown.some(t => t?.includes('円頓寺凛想')));
}
console.log('PASS legacy acquaintance/visit/story records, chapter before/after/later states, no retroactive gifts');
s = fresh({day:2}); before=economy(s); await shop.openShop();
assert.deepEqual(entered,['ch1_shop_clerk']); assert(!s.met.rio); assert.equal(economy(s),before); assert.equal(counters.length,1);
s = fresh({day:2,slot:1}); s.met.rio=true; await shop.openShop(); assert.deepEqual(entered,['ch1_shop_clerk']);
for (const branch of ['tokyo','dubai','widehanga']) {
  s=fresh({chapter:branch==='dubai'?4:3}); await shop.openShop({branch}); assert.equal(entered.length,0); assert.equal(counters.length,1);
}
console.log('PASS absent employee, buying still available, branch shops unchanged');
// #3619: 第5章では第1章用の店頭応対を流さない（初対面・顔なじみ・店員のみの日でも）。本店の買い物はそのまま開ける。
for (const day of [1,2,5]) for (const knownAs of ['none','met','story','visits','flag']) {
  s = fresh({chapter:5,day});
  if (knownAs === 'met') s.met.rio = true;
  if (knownAs === 'story') s.story.rio = 2;
  if (knownAs === 'visits') s.visits.rio = 1;
  if (knownAs === 'flag') s.flags._met_rio = true;
  assert.equal(greeting.shopGreetingScene(s), null);
  assert.equal(greeting.shopGreetingScene(s, { errand:'lemon' }), null);
  before = economy(s);
  assert.equal(await shop.openShop({ direct:true }), 'bought');
  assert.equal(entered.length,0); assert.equal(counters.length,1); assert.equal(floors.length,0);
  assert.equal(economy(s),before); assert.equal(awards.length,0);
}
console.log('PASS chapter 5 home shop skips chapter 1 greeting, counter opens directly');
for (const afterName of [false,true]) {
  s=fresh(); before=economy(s); const controller=new AbortController();
  interrupt=() => { if(afterName&&!s.flags._met_rio)return false; controller.abort(); return true; };
  assert.equal(await shop.openShop({errand:'lemon',signal:controller.signal}),null);
  assert.equal(counters.length,0); assert.equal(economy(s),before); assert.equal(awards.length,0);
  interrupt=null; await shop.openShop({errand:'lemon'}); assert.equal(counters.length,1); assert.equal(awards.length,0);
}
s=fresh(); interrupt=() => { interrupt=null; vn.shopTestPort.skip(); return true; };
assert.equal(await shop.openShop({errand:'lemon'}),'bought'); assert(s.met.rio); assert.equal(awards.length,0);
console.log('PASS cancellation before/after name, retry and SKIP without rewards');
s=fresh(); core.save(); let resolved=false;
interrupt=() => { core.load(); return true; };
void shop.openShop({errand:'lemon'}).then(()=>{resolved=true;});
await new Promise(r=>setTimeout(r,15)); assert(!resolved); assert.equal(counters.length,0); assert(!core.state.met.rio);
interrupt=null; await shop.openShop({errand:'lemon'}); assert.equal(counters.length,1);
s=fresh(); let controller=new AbortController(); interrupt=()=>true;
const opening=shop.openShop({signal:controller.signal}); await new Promise(r=>setTimeout(r,0));
assert.equal(await shop.openShop(),null); assert.equal(entered.length,1); controller.abort(); assert.equal(await opening,null);
console.log('PASS LOAD abandons old owner, fresh owner can retry, repeated entry does not stack');
for (const scene of Object.keys(db.dialogues).filter(id=>id.startsWith('ch1_shop_'))) delete db.dialogues[scene];
s=fresh(); await shop.openShop({errand:'lemon'}); assert.equal(reloads,1); assert(s.met.rio);
for (const knownAtEntry of [false,true]) {
  s=fresh({day:5,slot:1}); if(knownAtEntry)s.met.rio=true;
  await spots.visitChar('rio');
  assert.equal(s.story.rio,1);
  assert.equal(shown.some(t=>t?.includes('今日は上まで来たんだ')),knownAtEntry);
  assert.equal(shown.some(t=>t?.includes('前掛けの折り目')), !knownAtEntry);
  assert(shown.some(t=>t?.includes('同意書'))); assert(shown.some(t=>t?.includes('先に私が吸って')));
}
// The real departure runner covers the NG+ lemon shortcut and old saves before Tokyo.
for (const carryLemon of [false,true]) {
  s=fresh({chapter:3,day:29});s.flags._ch3_prep={startDay:29,days:3,step:4,departed:false};
  if(carryLemon){s.flavorStock.lemon=50;s.flavors.push('lemon');}
  before=economy(s);const runs=dailyRuns;await departure.runDeparturePrep({destination:'東京'});
  assert.equal(dailyRuns,runs+1);assert.deepEqual(entered,['ch1_shop_rio_delivery']);
  assert(s.met.rio);assert.equal(economy(s),before);assert.equal(awards.length,0);
  assert.equal(counters.length,0);assert.equal(floors.length,0);
  assert(shown.some(t=>t?.includes('東京から戻ってから')));
  core.save();s=core.load();await departure.runDeparturePrep({destination:'東京'});
  assert.deepEqual(entered,['ch1_shop_rio_delivery']);assert.equal(economy(s),before);
}
for(const evidence of ['met','story','visits','flag']) {
  s=fresh({chapter:3,day:30});
  if(evidence==='met')s.met.rio=true;if(evidence==='story')s.story.rio=1;
  if(evidence==='visits')s.visits.rio=1;if(evidence==='flag')s.flags._met_rio=true;
  await departure.runDeparturePrep({destination:'東京'});assert.equal(entered.length,0);
}
s=fresh({chapter:3,day:29});core.save();const runs=dailyRuns;
interrupt=()=>{core.load();return true;};await departure.runDeparturePrep({destination:'東京'});
assert.equal(dailyRuns,runs);assert(!core.state.met.rio);
s=fresh({chapter:4,day:45});await departure.runDeparturePrep({destination:'ドバイ'});assert.equal(entered.length,0);
console.log('PASS real Tokyo-prep runner: NG+ lemon carry, legacy missing acquaintance, once-only reload, existing knowledge, LOAD and Dubai isolation');
assert.deepEqual([...vn.getVnWarnings()],[]);
console.log('PASS lazy dialogue loading, known/new upstairs branches, original consent and trial retained, no VN warnings');
