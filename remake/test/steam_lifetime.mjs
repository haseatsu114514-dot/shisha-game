// Real steam module; deferred asset/help/countdown/timer and DOM ports isolate lifetime boundaries.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../js/craft/steam.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n = 0; n < 16; n++) await Promise.resolve(); };

async function harness({ manual = false } = {}) {
  const ready = deferred(), help = deferred(), countdown = deferred(), sleeps = [], frames = new Map();
  const metrics = { score: 0, result: 0, unkey: 0, abort: 0, clockDisposed: 0, countdown: 0 };
  class Node extends EventTarget {
    constructor() {
      super(); this.style = { setProperty() {} }; this.dataset = {}; this.inert = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    append() {} setAttribute() {} remove() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 784, height: 414 }; }
  }
  const guide = new Node(), root = new Node(), panel = new Node();
  root.querySelector = () => guide;
  panel.dataset.step = 'steam';
  let activeRoot = root, frameId = 0, stateModule;
  const owner = { flags: {} }, cs = { mode: 'tutorial', steam: null };
  const context = vm.createContext({
    window: new Node(), navigator: { getGamepads: () => [] },
    AbortController: class extends AbortController { abort() { metrics.abort++; super.abort(); } },
    requestAnimationFrame(fn) { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const noop = () => {};
  const imports = {
    './effect-visual.js': { effectVisible: () => false, effectBadge: () => null, effectLine: () => null },
    '../core/state.js': { state: owner },
    '../core/growth-effects.js': { growthPerks: () => null },
    '../core/util.js': { el: () => new Node(), sleep: ms => { const d = deferred(); sleeps.push({ ms, ...d }); return d.promise; }, clamp: (x, a, b) => Math.max(a, Math.min(b, x)), rand: () => .5, pick: a => a[0] },
    '../core/ui.js': { countdown: () => { metrics.countdown++; return countdown.promise; }, shake: noop },
    '../core/audio.js': { SE: new Proxy({}, { get: () => noop }) },
    '../core/stats.js': { tier01: () => 0, step: () => 1 },
    '../core/stat-step-tables.js': { REFRESH_RADII: [90], REFRESH_LABELS: ['小さな範囲'], refreshRestoresMental: () => false },
    './session.js': { benchRoot: () => activeRoot, stepPanel: () => panel, waitBenchReady: () => ready.promise,
      explainTutorialStep: () => help.promise, refreshBench: noop, reactAudience: noop, setPlayerMental: noop,
      setBenchTemperature: noop, scoreStep: () => metrics.score++ },
    './attack-training.js': { hasAttackTraining: () => false, ATTACK_LOCK_REASON: 'locked' },
    './steam-time.js': { steamSecondsOf: () => 300, steamPlaySeconds: () => 30, steamTimeLabel: () => '5min', SHORT_DODGE_SECONDS: 8 },
    './digital-clock.js': { buildDigitalClock: () => ({ root: new Node(), update: noop }) },
    './common.js': { autoSkill: () => manual ? null : 'good', resultCard: async () => { metrics.result++; }, keys: () => () => metrics.unkey++, popStamp: noop },
    './conditions.js': { craftConditions: () => ({ rainy: false }), temperatureAfterSteam: () => .5 },
    './steam-forecast.js': { buildSteamTemperature: () => ({ root: new Node(), update: noop }) },
    './steam-climate.js': { steamClimate: () => ({ transfer: 1 }) },
    './steam-art.js': { buildSteamWorld: () => ({ root: new Node(), draw: noop }), HEART_ART: '', BULLET_ART: {} },
    '../core/data.js': { makingUrl: () => '' },
    './mental.js': { buildMentalTrace: () => ({ root: new Node() }) },
    '../core/condition.js': { craftCondition: () => ({ focus: 1 }) },
    './steam-slash.js': { SLASH_ART: '', SLASH_RECHARGE_SECONDS: 1, slashProfile: () => ({ reach: 1, recharge: 1, tier: 1 }), slashAngle: noop, slashTouchesBullet: noop, buildSlashFx: noop, buildWordCutFx: noop },
    './steam-heart.js': { HEART_SIZE: 28, heartHitRadius: () => 5, heartTouchesBullet: () => false },
    './clock.js': { createCraftClock: () => ({ now: () => 0, paused: true, dispose: () => metrics.clockDisposed++ }) },
  };
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(spec => {
    assert(imports[spec], `Unexpected dependency ${spec}`);
    const values = imports[spec];
    const dep = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
    if (spec === '../core/state.js') stateModule = dep;
    return dep;
  });
  await mod.evaluate();
  const run = mod.namespace.runSteamDodge(cs);
  return { cs, panel, root, guide, metrics, sleeps, frames, ready, help, countdown, run,
    replaceState: () => stateModule.setExport('state', { flags: {} }),
    replaceBench: () => { const next = new Node(); next.guide = { open: true }; activeRoot = next; return next; },
    async startCountdown() { ready.resolve(); await flush(); help.resolve(true); await flush(); assert.equal(metrics.countdown, 1); },
  };
}

function assertCancelled(h) {
  assert.equal(h.cs.steam, null);
  assert.equal(h.metrics.score, 0); assert.equal(h.metrics.result, 0);
  assert.equal(h.metrics.unkey, 1); assert.equal(h.metrics.abort, 1);
  assert.equal(h.panel.inert, false);
}

for (const invalidation of ['state', 'bench', 'step']) test(`countdown rejects stale ${invalidation} before starting or scoring`, async () => {
  const h = await harness(); await h.startCountdown();
  if (invalidation === 'state') h.replaceState();
  if (invalidation === 'bench') { const next = h.replaceBench(); assert.equal(next.guide.open, true); }
  if (invalidation === 'step') h.panel.dataset.step = 'pull';
  h.countdown.resolve(); await h.run;
  assertCancelled(h); assert.equal(h.sleeps.length, 0); assert.equal(h.frames.size, 0);
});

test('countdown rejection still releases installed input handlers', async () => {
  const h = await harness(); await h.startCountdown();
  const rejected = assert.rejects(h.run, /countdown failed/);
  h.countdown.reject(Error('countdown failed')); await rejected; assertCancelled(h);
});

test('LOAD during automated play suppresses the later score and result', async () => {
  const h = await harness(); await h.startCountdown(); h.countdown.resolve(); await flush();
  assert.equal(h.sleeps[0].ms, 200); h.replaceState(); h.sleeps[0].resolve(); await h.run;
  assertCancelled(h);
});

test('LOAD during manually paused play disposes clock and clears old guide lock', async () => {
  const h = await harness({ manual: true }); await h.startCountdown(); h.countdown.resolve(); await flush();
  h.guide.open = true; h.panel.inert = true; h.root.dataset.helpPaused = 'true';
  h.replaceState(); const [id, frame] = h.frames.entries().next().value; h.frames.delete(id); frame(); await h.run;
  assertCancelled(h); assert.equal(h.metrics.clockDisposed, 1); assert.equal(h.frames.size, 0);
  assert.equal(h.guide.open, false); assert.equal(h.root.dataset.helpPaused, 'false');
});

test('LOAD in post-score delay prevents a stale result card', async () => {
  const h = await harness(); await h.startCountdown(); h.countdown.resolve(); await flush();
  h.sleeps[0].resolve(); await flush();
  assert.equal(h.metrics.score, 1); assert.equal(h.sleeps[1].ms, 400);
  h.replaceState(); h.sleeps[1].resolve(); await h.run;
  assert.equal(h.metrics.result, 0); assert.equal(h.metrics.unkey, 1); assert.equal(h.metrics.abort, 1);
});

test('valid session still records one score and shows its result', async () => {
  const h = await harness(); await h.startCountdown(); h.countdown.resolve(); await flush();
  h.sleeps[0].resolve(); await flush(); h.sleeps[1].resolve(); await h.run;
  assert.equal(h.cs.steam.score, 100); assert.equal(h.metrics.score, 1); assert.equal(h.metrics.result, 1);
  assert.equal(h.metrics.unkey, 1); assert.equal(h.metrics.abort, 1);
});
