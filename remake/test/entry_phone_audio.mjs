// Production modules in a VM; no browser or audio device required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const read = p => fs.readFile(new URL(p, import.meta.url), 'utf8');
async function load(code, values = {}, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link(async spec => {
    const names = [...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .filter(m => m[2] === spec).flatMap(m => m[1].split(',').map(n => n.trim()));
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => {}));
    }, { context });
  });
  await mod.evaluate(); return mod.namespace;
}
const entry = await load(await read('../js/core/entry-sound.js'));
for (const chapter of [1, 2, 3, 4, '3', undefined]) {
  assert.equal(entry.bellEntry('tonari', chapter), true);
  assert.equal(entry.bellEntry('mukai', chapter), chapter === 3);
  for (const id of ['rest', 'naru', 'adam', undefined]) assert.equal(entry.bellEntry(id, chapter), false);
}
let rings = 0;
for (const suffix of ['', '_day', '_night', '_overcast_day', '_overcast_night']) {
  const commit = entry.createEntrySound({ spotId: 'tonari' }, 1, () => rings++);
  const before = rings;
  assert.equal(rings, before, 'reservation alone is silent');
  commit(`../assets/backgrounds/bg_tonari_inside${suffix}.png`); commit('bg_tonari_inside.png');
  assert.equal(rings, before + 1, 'one committed arrival only');
}
for (const spotId of ['rest', 'naru', 'mukai', undefined]) {
  const before = rings;
  entry.createEntrySound({ spotId }, 3, () => rings++)('bg_tonari_inside.png');
  assert.equal(rings, before, 'unconnected chapter3 route is not invented');
}
const canceled = entry.createEntrySound({ spotId: 'tonari' }, 1, () => rings++);
const before = rings; canceled('bg_home.png'); canceled('bg_tonari_inside.png');
assert.equal(rings, before, 'stale cue cannot ring on another background');

const sounds = [], waits = [];
const node = () => ({ classList: { add() {}, remove() {} }, append() {}, replaceChildren() {}, remove() {} });
const phoneCode = await read('../js/daily/phone.js');
const phone = await load(phoneCode + '\nexport { phoneShell };', {
  el: node, sleep: () => new Promise(resolve => waits.push(resolve)),
  layers: { modal: node() }, formatHtml: s => s, hooks: {},
  SE: { phoneReceive: () => sounds.push('receive'), phoneSend: () => sounds.push('send') },
}, { requestAnimationFrame: fn => fn() });
const shell = phone.phoneShell({ time: '昼', title: 'LIME' });
await shell.bubble('past', false, null, false); assert.deepEqual(sounds, []);
const send = shell.bubble('reply', true); assert.deepEqual(sounds, ['send']); waits.shift()(); await send;
const receive = shell.bubble('message'); assert.equal(sounds.length, 1);
waits.shift()(); await new Promise(setImmediate); assert.deepEqual(sounds, ['send', 'receive']); waits.shift()(); await receive;
for (const cancel of ['gen', 'close']) {
  const pending = shell.bubble('canceled');
  if (cancel === 'gen') shell.gen++; else shell.open = false;
  waits.shift()(); await pending;
  assert.equal(sounds.length, 2, 'closed/old generation does not sound after typing delay');
}
// The integration must notify only after the actual background append, beyond the stale-request guard.
const ui = await read('../js/core/ui.js');
assert(ui.indexOf('if (bgNow !== key) return;') < ui.indexOf('curtain?.commitArrival?.(url)'));
assert(ui.indexOf('host.append(next);') < ui.indexOf('curtain?.commitArrival?.(url)'));
for (const path of ['../js/motions/door.js', '../js/core/transition-moves.js'])
  assert(!(await read(path)).includes('SE.doorbell'), 'generic movement is silent');
const dialogue = JSON.parse(await read('../../data/dialogue/ch1_main.json'));
const bells = JSON.stringify(dialogue).match(/"id":"doorbell"/g) || [];
assert.equal(bells.length, 1, 'only the tutorial customer entry keeps its bell');
console.log('PASS: entry predicate/commit/deduplication and real phone history/send/receive/cancellation');

let now = 0, reduced = false, transitionRings = 0;
const curtain = () => ({ covered: Promise.resolve(), async release() {} });
const transitions = await load(await read('../js/core/transitions.js'), {
  state: { chapter: 1 }, createEntrySound: entry.createEntrySound,
  SE: { doorbell: () => transitionRings++ }, reducedMotion: () => reduced,
  moveCurtain: curtain, moveStyle: () => 'pin', withStoreArrival: (_host, c) => c,
  el: node, holdKeys: () => () => {}, nextFrame: async () => {}, sleep: async () => {},
}, { performance: { now: () => now } });
for (const fast of [false, true]) for (const reducedSetting of [false, true]) {
  reduced = reducedSetting;
  transitions.cueTransition('place', { spotId: 'tonari' });
  const before = transitionRings;
  const c = transitions.createSceneCurtain({ append() {} }, { fast });
  await c.covered; assert.equal(transitionRings, before, 'cover/logo alone does not ring');
  c.commitArrival('bg_tonari_inside_day.png'); c.commitArrival('bg_tonari_inside_day.png');
  assert.equal(transitionRings, before + 1, 'normal/SKIP/reduced share the same single commit');
  const redraw = transitions.createSceneCurtain({ append() {} }, { fast });
  redraw.commitArrival('bg_tonari_inside_day.png');
  assert.equal(transitionRings, before + 1, 'consumed cue cannot ring on redraw/restore');
}
for (const mode of ['cancel', 'expired']) {
  transitions.cueTransition('place', { spotId: 'tonari' });
  if (mode === 'cancel') transitions.cancelPlaceCue('tonari'); else now += 3001;
  const before = transitionRings;
  transitions.createSceneCurtain({ append() {} }, { fast: true }).commitArrival('bg_tonari_inside_day.png');
  assert.equal(transitionRings, before, mode);
}
console.log('PASS: real transition integration, normal/SKIP/reduced, one-shot cue, cancel and expiry');
