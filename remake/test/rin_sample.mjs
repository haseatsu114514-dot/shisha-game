// Actual VN control flow, visitChar, visitRin and SAVE/LOAD; presentation ports are controlled.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = new URL('../js/', import.meta.url);
const scripts = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch1_rin.json', import.meta.url)));
const db = { relationshipMemories: { rin_sample: { char_id: 'rin' } }, dialogues: Object.fromEntries(scripts.dialogues.map(d => [d.dialogue_id, d])), flavorById: {}, characters: {} };
const notices = [], shown = [], memory = new Map();
let interrupt = null, finished = false;
const node = () => ({ dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  children: [], append(...xs) { this.children.push(...xs); }, replaceChildren() {}, setAttribute() {}, addEventListener() {},
  querySelector() { return null; }, querySelectorAll() { return []; }, remove() {} });
const context = vm.createContext({ console, URL, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, performance,
  document: { body: node() }, window: { addEventListener() {} },
  localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,String(v)), removeItem: k => memory.delete(k) },
  rendered: line => { shown.push(line.text); return interrupt?.(line); } });
const real = ['core/state.js', 'daily/shop.js', 'daily/spots.js', 'vn/engine.js', 'core/relationships.js', 'core/story-context.js'];
const modules = new Map(), required = new Map();
const known = { DB: db, MAX_MONEY: 999999, TOURNAMENT_DAY: 14, MASTERY_THRESHOLDS: [0,6,18,36,60],
  VISIT_SEQ: { rin: ['ch1_rin_first','ch1_rin_second','ch1_rin_third'] }, AFFINITY_RANK_PTS: [0,9,18,27],
  RAIN_SPOT_TEXTS: {}, AXE_BAR: {}, el: node, layers: { vn: node(), fx: node() },
  createNameFit: () => ({ fit() {} }), sceneBg: () => ({}), imageReady: async () => true,
  loadVnFonts: async () => [],
  setBg: () => Promise.resolve(), portraitInfo: () => null, tournamentFinished: () => finished,
  toast: text => notices.push(text), currentBgm: () => null };
for (const p of real) {
  let source = fs.readFileSync(new URL(p, root), 'utf8');
  if (p === 'vn/engine.js') source += `\n// Test port: drive rendered lines without layout, preserving all production control lines.\nintroThenShow = function(line) { if (!line) return finish(); if (!rendered(line)) next(); };\nexport const samplePort = { skip: () => setSkip(true), cancel: () => finish(true) };`;
  modules.set(p, new vm.SourceTextModule(source, { context, identifier: p, initializeImportMeta(meta) { meta.url = new URL(p, root).href; },
    importModuleDynamically: async specifier => {
      assert.equal(specifier, '../scenes/title.js');
      const title = new vm.SyntheticModule(['openConfig'], function() { this.setExport('openConfig', async () => {}); }, { context });
      await title.link(() => { throw new Error('unexpected title import'); });
      await title.evaluate();
      return title;
    },
  }));
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
await entry.link((s,ref) => modules.get(path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),s))));
await entry.evaluate();
const { m0: core, m1: shop, m2: spots, m3: vn } = entry.namespace;
const fresh = () => {
  interrupt = null; notices.length = 0; shown.length = 0;
  const s = core.newGame(); Object.assign(s,{ phase: 'daily', chapter: finished ? 2 : 1, day: 5, slot: 1 });
  s.story.rin = 2; s.affinity.rin = 18; return s;
};
const revisit = async () => { core.state.day += 7; return shop.visitRin(); };
for (finished of [false,true]) {
  let s = fresh(); assert.equal(await shop.visitRin(),true);
  assert.equal(s.story.rin,3); assert(s.relationshipMemories.includes('rin_sample')); assert(s.flags._rin_sample); assert(s.flags._rin_sample_received);
  assert.equal(s.flavorStock.nightside_earlgrey,50); assert.equal(notices.length,1);
  assert(shown.includes(db.dialogues.ch1_rin_third.branches[finished ? 'sample_after' : 'sample_before'][0].text));
  assert(!shown.some(text => text?.includes('手に入った')),'receipt text belongs to the actual stock grant');
  await revisit(); assert.equal(s.flavorStock.nightside_earlgrey,50); assert.equal(notices.length,1);
  shop.addFlavorStock('nightside_earlgrey',-50); assert(Object.hasOwn(s.flavorStock,'nightside_earlgrey'));
  core.save(); s = core.load(); await revisit(); assert.equal(s.flavorStock.nightside_earlgrey,0); assert.equal(notices.length,1);
}
console.log('PASS normal completion, both timeline branches, revisit, consumption and reload');
for (const stage of ['before-flag','after-flag','after-memory']) for (const outcome of ['skip','cancel','load']) {
  const s = fresh();
  interrupt = () => {
    const ready = stage === 'before-flag' || stage === 'after-flag' && s.flags._rin_sample
      || stage === 'after-memory' && shown.at(-1)?.includes('センス');
    if (!ready) return false;
    if (outcome === 'load') { core.newGame(); vn.samplePort.cancel(); }
    else vn.samplePort[outcome]();
    return true;
  };
  assert.equal(await shop.visitRin(),false,`${stage}/${outcome}`);
  assert.equal(s.story.rin,2);
  if (stage === 'after-memory') assert(s.relationshipMemories.includes('rin_sample'));
  assert.equal(s.flavorStock.nightside_earlgrey,undefined); assert.equal(notices.length,0);
  if (outcome !== 'load') { interrupt = null; await revisit(); assert.equal(s.flavorStock.nightside_earlgrey,50); }
}
console.log('PASS SKIP, cancellation and state replacement before/after flag and memory; retry');
for (const afterFlag of [false,true]) {
  const s = fresh(), controller = new AbortController();
  interrupt = () => { if (afterFlag && !s.flags._rin_sample) return false; controller.abort(); return true; };
  assert.equal(await spots.visitChar('rin',{ signal: controller.signal }),false);
  assert.equal(s.story.rin,2); assert.equal(s.flavorStock.nightside_earlgrey,undefined);
}
// An ordinary scene keeps the existing fast-forward behavior, including a sequence carrying SKIP.
fresh();
await vn.dialogueSequence(async () => {
  interrupt = () => true;
  const ordinary = vn.play({ dialogue_id: 'ordinary', lines: [{ text: 'pause' }] });
  await new Promise(resolve => setTimeout(resolve,0));
  interrupt = null; vn.samplePort.skip();
  assert.equal((await ordinary).cancelled,undefined);
  assert.equal(await shop.visitRin(),false,'inherited SKIP cancels only the sample scene');
  assert.equal(core.state.story.rin,2);
});
console.log('PASS AbortSignal and ordinary/inherited SKIP behavior');
for (const key of [core.SAVE_KEY,'suien_remake_slot1']) for (const stock of [undefined,0,12.5,50]) {
  let s = fresh(); s.story.rin = 3; s.flags._rin_sample = true;
  if (stock !== undefined) s.flavorStock.nightside_earlgrey = stock;
  memory.set(key,JSON.stringify(s)); s = key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key);
  await shop.visitRin();
  assert.equal(s.flavorStock.nightside_earlgrey,stock ?? 50); assert(s.flags._rin_sample_received);
  assert.equal(notices.length,stock === undefined ? 1 : 0);
  core.save(); s = core.load(); await revisit(); assert.equal(s.flavorStock.nightside_earlgrey,stock ?? 50);
}
// Pre-gram saves already receive 50g from the existing migration; ownership-only history is conservative.
for (const legacy of ['pre-grams','ownership-only','already-received','interrupted']) {
  let s = fresh(); s.flags._rin_sample = true; s.story.rin = legacy === 'interrupted' ? 2 : 3;
  if (legacy === 'pre-grams') delete s.flavorStock;
  if (legacy === 'ownership-only') s.flavors.push('nightside_earlgrey');
  if (legacy === 'already-received') s.flags._rin_sample_received = true;
  core.save(); s = core.load();
  if (legacy === 'interrupted') interrupt = () => { vn.samplePort.cancel(); return true; };
  await shop.visitRin();
  assert.equal(s.flavorStock.nightside_earlgrey,legacy === 'pre-grams' ? 50 : undefined);
  assert.equal(notices.length,0);
}
console.log('PASS auto/manual legacy saves, zero stock, existing migration, ownership history and incomplete story');
// A closed entry cannot grant the gift.
fresh(); core.state.phase = 'opening'; assert.equal(await shop.visitRin(),false); assert.equal(notices.length,0);
assert.equal(shop.FLAVOR_BOX_GRAMS,50);
const flavor = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json',import.meta.url))).flavors.find(f => f.id === 'nightside_earlgrey');
assert.equal(flavor.requires_flag,'_rin_sample');
console.log('PASS entry refusal, 50g box and unchanged flavor unlock flag');
