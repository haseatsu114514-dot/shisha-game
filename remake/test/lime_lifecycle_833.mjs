// Exercise production lazy loading, image readiness and stage cleanup with controlled waits.
// These VM regressions do not claim to reproduce the reporter's first-visit browser path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = {
  wrapper: read('../js/core/scene-motions.js'),
  motion: read('../js/motions/lime.js'),
  stage: read('../js/motions/stage.js'),
};
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function fixture({ waitAt = null, faceReady = true } = {}) {
  const requested = deferred(), resume = deferred();
  const original = { save: 'original', contacts: ['sumi'], flags: {} };
  const loaded = { save: 'loaded', contacts: ['sumi'], flags: {} };
  const counters = { images: 0, scenes: 0, phones: 0, held: 0, released: 0, observed: 0, disconnected: 0, cancelled: 0 };
  const labels = [];
  function el(selector, attrs = {}, children = []) {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    if (selector === 'div.mo-lime-scene') counters.scenes++;
    if (selector === 'b') labels.push(attrs.text);
    return {
      selector, attrs, style: { ...attrs.style }, children: [...children], clientWidth: 844, clientHeight: 326,
      append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; } },
      remove() { this.parent.children = this.parent.children.filter(node => node !== this); },
      getAnimations() { return [{ cancel() { counters.cancelled++; } }]; },
    };
  }
  const host = el('fx');
  const context = vm.createContext({
    console,
    document: { body: { classList: { contains: () => false } }, getElementById: () => host },
    ResizeObserver: class {
      observe() { counters.observed++; }
      disconnect() { counters.disconnected++; }
    },
  });
  const wait = async boundary => {
    if (waitAt === boundary) { requested.resolve(); await resume.promise; }
  };
  const values = {
    'state.js': { state: original, config: { shortSeen: false } },
    'util.js': { el, sleep: async () => {}, nextFrame: async () => wait('frame') },
    'data.js': { DB: {}, displayName: () => 'なる', faceIconUrl: () => 'existing-face' },
    'lime-icons.js': { customLimeIconUrl: () => null },
    'ui.js': { imageReady: async () => { counters.images++; await wait('image'); return faceReady; }, loadingNotice: () => ({}) },
    'module-loading.js': { withLoadingNotice: async (task, _opts) => await task },
    'audio.js': { SE: { phone() { counters.phones++; } } },
    'transition-kit.js': {
      reducedMotion: () => false, move: async () => {}, svg: el,
      holdKeys: () => { counters.held++; return () => { counters.released++; }; },
    },
    'transitions.js': { holdCover: () => { throw Error('LIME must use the existing key hold'); } },
    'mg-kit.js': { motionVariant: () => 'a', MG_EASE: { out: 'out', in: 'in', inOut: 'inOut', back: 'back' } },
  };
  const modules = new Map(Object.entries(values).map(([name, exports]) => [name,
    new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context }),
  ]));
  const stage = new vm.SourceTextModule(sources.stage, { context });
  modules.set('stage.js', stage);
  const link = specifier => {
    const module = modules.get(specifier.split('/').at(-1));
    assert(module, `Unexpected dependency: ${specifier}`);
    return module;
  };
  const motion = new vm.SourceTextModule(sources.motion, { context });
  await motion.link(link);
  await motion.evaluate();
  const wrapper = new vm.SourceTextModule(sources.wrapper, {
    context,
    importModuleDynamically: async specifier => {
      assert.equal(specifier, '../motions/lime.js');
      await wait('import');
      return motion;
    },
  });
  await wrapper.link(link);
  await wrapper.evaluate();
  return {
    run: () => wrapper.namespace.limeExchange('naru'),
    requested: requested.promise,
    resume: resume.resolve,
    load: () => modules.get('state.js').setExport('state', loaded),
    counters, labels, host, original, loaded,
  };
}

for (const faceReady of [true, false]) {
  const f = await fixture({ faceReady });
  await f.run();
  assert.equal(f.counters.scenes, 1, 'current save must show the exchange even without a face image');
  assert.equal(f.labels[0], 'なる', 'the new friend is the top row');
  assert.equal(f.counters.phones, 1);
  assert.equal(f.counters.observed, 1);
  assert.equal(f.counters.disconnected, 1);
  assert.equal(f.counters.held, 1);
  assert.equal(f.counters.released, 1);
  assert.equal(f.host.children.length, 0, 'finished stage must be removed');
}

for (const waitAt of ['import', 'image', 'frame']) {
  const f = await fixture({ waitAt });
  const run = f.run();
  await f.requested;
  f.load();
  f.resume();
  await run;
  assert.equal(f.counters.scenes, 0, `LOAD during ${waitAt} must not paint the old exchange`);
  assert.equal(f.counters.phones, 0, `LOAD during ${waitAt} must not play the old sound`);
  assert.equal(f.counters.observed, 0, 'cancelled exchange must not start resize observation');
  assert.equal(f.host.children.length, 0, 'cancelled stage must be removed');
  assert.equal(f.counters.held, waitAt === 'frame' ? 1 : 0);
  assert.equal(f.counters.released, f.counters.held, 'cancelled stage must release the input hold');
  assert.equal(f.counters.cancelled, waitAt === 'frame' ? 1 : 0, 'stage cleanup must still run');
  assert.deepEqual(f.loaded, { save: 'loaded', contacts: ['sumi'], flags: {} });
  assert.deepEqual(f.original, { save: 'original', contacts: ['sumi'], flags: {} });
  if (waitAt === 'import') assert.equal(f.counters.images, 0, 'stale lazy import must not start image work');

  // A stale request must not suppress a later, valid exchange in the newly loaded save.
  await f.run();
  assert.equal(f.counters.scenes, 1);
  assert.equal(f.counters.phones, 1);
  assert.equal(f.counters.held, f.counters.released);
  assert.equal(f.host.children.length, 0);
}

console.log('PASS: LIME current save / missing face / LOAD during import, image and first frame / next exchange');
