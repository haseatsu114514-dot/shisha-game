// Focused persistence check: real state/save/migrate and contact interpreter branch.
// Storage and the motion are test doubles; this is NOT a browser SAVE/LOAD test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files = new Map();
const context = vm.createContext({ console, localStorage: {
  setItem(key, value) { files.set(key, String(value)); },
  getItem(key) { return files.get(key) ?? null; },
} });
const modules = new Map();
async function moduleAt(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const module = new vm.SourceTextModule(fs.readFileSync(url, 'utf8'), {
    context, identifier: url.href,
  });
  modules.set(url.href, module);
  await module.link((path) => moduleAt(new URL(path, url)));
  return module;
}
const module = await moduleAt(new URL('../js/core/state.js', import.meta.url));
await module.evaluate();
const storage = module.namespace;
const engine = fs.readFileSync(new URL('../js/vn/engine.js', import.meta.url), 'utf8');
const start = engine.indexOf('    if (type === "set_flag") {');
const end = engine.indexOf('    if (type === "show_cg") {', start);
assert(start >= 0 && end > start, 'locate the production contact interpreter');
const control = engine.slice(start, end);
let shown = 0;
let skipped = false;
Object.assign(context, {
  vnTest: { turbo: false },
  limeExchange: async () => { if (!skipped) shown++; },
  next: () => {},
});
Object.defineProperty(context, 'state', { get: () => storage.state });
new vm.Script(`function contact(id) {
  const r = { queue: [{type:'set_flag', flag:'_lime_contact_' + id}], ready:true };
  running = r;
  for (;;) {
    const line = r.queue.shift(); if (!line) return;
    const type = line.type;
    ${control}
  }
}`).runInContext(context);

async function contact(id) {
  context.contact(id);
  // Flush the real interpreter's promise continuation without browser timers.
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
const results = [];
for (const id of ['naru', 'adam']) {
  files.clear(); shown = 0; skipped = false;
  storage.newGame();
  storage.save();
  storage.load();
  await contact(id);
  assert.equal(shown, 1, `${id}: save before first exchange must not suppress it`);
  storage.state.contacts.push(id); // visitChar's post-dialogue contact registration
  const expected = JSON.stringify(storage.state);
  storage.saveToSlot(storage.SAVE_SLOTS[1].key);
  storage.newGame();
  assert(storage.loadFromSlot(storage.SAVE_SLOTS[1].key));
  assert(storage.state.contacts.includes(id));
  assert.equal(storage.state.flags[`_lime_contact_${id}`], true);
  assert.equal(storage.state.flags[`_lime_exchange_shown_${id}`], true);
  const restored = { ...storage.state, savedAt: JSON.parse(expected).savedAt };
  assert.equal(JSON.stringify(restored), expected, `${id}: state survives slot round trip`);
  await contact(id);
  assert.equal(shown, 1, `${id}: loaded exchange must not repeat`);
  results.push({ id, firstAfterLoad: 1, repeatsAfterSlotLoad: 0 });
}
files.clear(); shown = 0;
storage.newGame();
storage.state.contacts.push('naru');
storage.state.schema = 17;
storage.save(); storage.newGame(); storage.load();
await contact('naru');
assert.equal(storage.state.schema, storage.SCHEMA, 'legacy save migrated');
assert.equal(shown, 0, 'legacy connected save must not replay');
assert.equal(storage.state.flags._lime_contact_naru, true);
assert.equal(storage.state.flags._lime_exchange_shown_naru, undefined);

files.clear(); shown = 0; skipped = true;
storage.newGame();
await contact('adam');
storage.save(); storage.newGame(); storage.load();
skipped = false;
await contact('adam');
assert.equal(shown, 0, 'SKIP exchange remains consumed after load');
assert.equal(storage.state.flags._lime_exchange_shown_adam, true);
console.log(JSON.stringify({ status: 'PASS', results, legacyReplay: 0,
  skipReplayAfterLoad: 0, browserVerified: false }));
