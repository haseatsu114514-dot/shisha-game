// DOM ports exercise the real view/session; these do not measure browser layout.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
class Dom {
  constructor(tag = 'div', text = '') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.events = {};
    this._text = text; this.className = ''; this.style = { setProperty() {} };
    this.classList = { add: (...xs) => { this.className = [...new Set([...this.className.split(' '), ...xs])].join(' '); },
      remove: x => { this.className = this.className.split(' ').filter(y => y !== x).join(' '); },
      toggle: (x, on) => on ? this.classList.add(x) : this.classList.remove(x), contains: x => this.className.split(' ').includes(x) };
  }
  append(...nodes) { for (let n of nodes) { if (!(n instanceof Dom)) n = new Dom('#text', String(n)); n.parentNode = this; this.children.push(n); } }
  prepend(n) { n.parentNode = this; this.children.unshift(n); }
  replaceChildren(...nodes) { this.children.forEach(n => n.parentNode = null); this.children = []; this._text = ''; this.append(...nodes); }
  insertBefore(n, before) { n.parentNode = this; this.children.splice(this.children.indexOf(before), 0, n); }
  replaceWith(n) { const p = this.parentNode; const i = p.children.indexOf(this); p.children[i] = n; n.parentNode = p; this.parentNode = null; }
  get firstChild() { return this.children[0]; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(t) { this._text = String(t); this.children = []; }
  set innerHTML(t) { this.textContent = t; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'disabled') this.disabled = true; if (k === 'hidden') this.hidden = true; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(k, fn) { (this.events[k] ||= []).push(fn); }
  removeEventListener() {}
  focus() { documentPort.activeElement = this; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
  get isConnected() { return !!this.parentNode; }
  matches(s) {
    if (s.includes(':not(:disabled)')) { if (this.disabled) return false; s = s.replace(':not(:disabled)', ''); }
    const attr = /\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/.exec(s);
    if (attr) { const key = attr[1]; const value = key.startsWith('data-') ? this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : this.getAttribute(key);
      if (value == null || attr[2] !== undefined && String(value) !== attr[2]) return false; s = s.replace(attr[0], ''); }
    const cls = /\.([\w-]+)/.exec(s); if (cls && !this.classList.contains(cls[1])) return false;
    const tag = /^[\w-]+/.exec(s); return !tag || this.tagName.toLowerCase() === tag[0];
  }
  querySelectorAll(s) { const out = []; const selectors = s.split(',').map(s => s.trim());
    const visit = n => { for (const child of n.children) { if (selectors.some(s => child.matches(s))) out.push(child); visit(child); } }; visit(this); return out; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  click() { assert(!this.disabled, 'disabled control'); for (const fn of this.events.click || []) fn({ currentTarget: this }); }
  change() { for (const fn of this.events.change || []) fn({ currentTarget: this }); }
  scrollTo() {}
}
const documentPort = { createElement: tag => new Dom(tag), createTextNode: text => new Dom('#text', text), addEventListener() {}, removeEventListener() {}, hidden: false };
const timers = [];
const delays = [], tickers = []; let reducedMotion = true;
const context = vm.createContext({ Node: Dom, document: documentPort, URL, structuredClone, console,
  Image: class { decode() { return Promise.resolve(); } }, matchMedia: () => ({ matches: reducedMotion }),
  AbortController, setTimeout: (fn, delay) => { timers.push(fn); delays.push(delay); return timers.length; }, clearTimeout() {}, setInterval: fn => { tickers.push(fn); return tickers.length; }, clearInterval() {} });
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const code = url.pathname.endsWith('/audio.js') ? 'export function createTrpgAudio() { throw new Error("audio port required"); }' : await readFile(url, 'utf8');
  const mod = new vm.SourceTextModule(code, { context, identifier: url.href, initializeImportMeta: meta => { meta.url = url.href; } });
  modules.set(url.href, mod); await mod.link((specifier, parent) => load(new URL(specifier, parent.identifier))); return mod;
}
const mod = await load(new URL('../js/trpg/view.js', import.meta.url)); await mod.evaluate();
const scenarios = await Promise.all(['ordinary', 'shark'].map(async theme => JSON.parse(await readFile(new URL('../../data/dialogue/trpg_' + theme + '.json', import.meta.url), 'utf8'))));
function mount(scenario) {
  const host = new Dom();
  const manifest = { portraits: Object.fromEntries(scenario.cast.map(c => [c.id, { faces: ['normal'], h: .7, b: .1, aspect: 1 }])) };
  const audio = { enabled: false, available: true, setTheme() {}, play() {}, silence() {}, setEnabled() {} };
  let completions = 0;
  const api = mod.namespace.mountTrpg(host, { onComplete: () => completions++, scenario, characters: [], manifest, seed: 9, profileId: scenario.profiles[0].id, audio });
  const root = host.children[0];
  const q = id => { const node = root.querySelector('[data-test="' + id + '"]'); assert(node, id); return node; };
  const drain = () => { let n = 0; while (!q('trpg-next').hidden) { q('trpg-next').click(); assert(++n < 100); } };
  const roll = () => { q('trpg-roll').click(); timers.shift()(); };
  // A real table declares who acts before the dice: pick the first approach and read the declaration.
  const declare = kind => { const first = scenario.checks[kind].approaches?.[0]; if (first) { q('trpg-approach-' + first.id).click(); drain(); } };
  return { api, root, q, drain, roll, declare, get completions() { return completions; } };
}
for (const scenario of scenarios) {
  test(scenario.id + ': cast seats follow dialogue and idle GM; no invented participants', () => {
    const { api, root, q, drain } = mount(scenario); q('trpg-start').click();
    assert.equal(root.querySelectorAll('.trpg-table-person').length, scenario.cast.length);
    const active = root.querySelector('.trpg-table-person.active'); assert(active); assert.equal(active.querySelector('.trpg-seat-speaking').textContent, '話者');
    drain(); q('trpg-declare-back').click();
    assert.equal(root.querySelector('.trpg-table-person.active').dataset.speaker, scenario.cast.find(c => c.part === 'GM').id);
    assert.equal(root.querySelectorAll('[data-test^="trpg-seat-pc-"], .trpg-seat-pc').length >= scenario.cast.length - 1, true, 'player seats carry their PC sheet');
    api.destroy();
  });
  test(scenario.id + ': support cancellation does not spend; confirmed help and reroll share seat receipts', () => {
    const mounted = mount(scenario); const { api, root, q, drain, roll, declare } = mounted; q('trpg-start').click(); drain(); declare('listen'); roll();
    const actor = scenario.cast.find(c => c.abilityType === 'reroll').id;
    q('trpg-reroll-1').click();
    assert(q('trpg-reroll-receipt').textContent.includes(actor));
    assert.equal(root.querySelectorAll('.trpg-reroll-stamp').length, 1);
    for (const die of root.querySelectorAll('.trpg-die')) {
      const face = die.querySelector('.trpg-d20-value'); assert(face, 'd20 has a numeric face');
      assert.equal(die.getAttribute('aria-label'), '20面ダイス ' + face.textContent);
      assert(Number(face.textContent) >= 1 && Number(face.textContent) <= 20);
      assert.equal(die.querySelectorAll('.trpg-pip').length, 0, 'No d6 pips remain');
    }
    assert.equal(api.snapshot().used[actor], true); q('trpg-settle').click(); drain();
    for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
    q('trpg-interpret').click(); q('trpg-hypothesis-' + scenario.hypotheses[0].id).click(); drain();
    for (const field of Object.keys(api.snapshot().plan).filter(f => scenario.flow?.prepare?.includes(f) || !scenario.flow && ['aroma', 'seat'].includes(f))) {
      q('trpg-choice-tab-' + field).click(); q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
    }
    q('trpg-prepare-open').click(); declare('prepare'); const helper = scenario.checks.prepare.helper;
    const before = JSON.stringify(api.snapshot()); q('trpg-support-' + helper).checked = true; q('trpg-support-' + helper).change(); q('trpg-check-back').click();
    assert.equal(JSON.stringify(api.snapshot()), before);
    q('trpg-prepare-open').click(); declare('prepare'); assert(!q('trpg-support-' + helper).checked); q('trpg-support-' + helper).checked = true; roll();
    assert(q('trpg-actor-receipt').textContent.includes(scenario.cast.find(c => c.id === 'hajime').sheet.name), 'the roll names the declared character');
    assert(q('trpg-helper-receipt').textContent.includes(helper)); assert.equal(api.snapshot().used[helper], true);
    const seat = root.querySelectorAll('.trpg-table-person').find(n => n.dataset.speaker === helper);
    assert.equal(seat.querySelector('.trpg-seat-ability').dataset.spent, 'true');
    q('trpg-settle').click(); drain();
    const fields = scenario.flow?.serve || ['approach'];
    for (const field of fields) q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
    q('trpg-serve-open').click(); declare('serve'); roll(); assert(!root.querySelector('[data-test="trpg-helper-receipt"]'));
    q('trpg-settle').click(); drain(); assert.equal(api.snapshot().phase, 'ending');
    assert.equal(root.querySelectorAll('.trpg-table-clue').length, 3); assert(!q('trpg-finish').disabled);
    assert.equal(api.snapshot().teamwork, 0); assert.equal(mounted.completions, 1); drain(); assert.equal(mounted.completions, 1, 'Fast advance cannot deliver completion twice'); api.destroy(); assert.equal(mounted.completions,1);
  });
  test(scenario.id + ': 0/1/3 clue cards open the existing notes without inspecting again', () => {
    const { api, root, q, drain, roll, declare } = mount(scenario); q('trpg-start').click(); drain(); declare('listen'); roll(); q('trpg-settle').click(); drain();
    assert.equal(root.querySelectorAll('.trpg-table-clue').length, 0);
    for (const [i, spot] of scenario.spots.slice(0, 3).entries()) {
      q('trpg-spot-' + spot.id).click(); drain(); assert.equal(root.querySelectorAll('.trpg-table-clue').length, i + 1);
      const before = JSON.stringify(api.snapshot()); q('trpg-compare-notes').click();
      assert.equal(root.querySelectorAll('.trpg-note-card').length, i + 1); q('trpg-notes-close').click(); assert.equal(JSON.stringify(api.snapshot()), before);
    }
    assert.deepEqual(Array.from(root.querySelectorAll('.trpg-table-clue'), n => n.dataset.clue), Array.from(api.snapshot().clues).slice(0, 3)); api.destroy();
  });
}

// Static cascade regression for the actual card and existing pocket-span rules.
// This is selector/media evidence, not a browser/computed-style or pixel test.
const stageCss = await readFile(new URL('../css/trpg-stage.css', import.meta.url), 'utf8');
function cardDeclarations(width, height) {
  const stack = [], rules = []; let start = 0;
  const css = stageCss.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') { stack.push(css.slice(start, i).trim()); start = i + 1; }
    else if (css[i] === '}') {
      const selector = stack.pop();
      if (selector && !selector.startsWith('@') &&
          (selector.endsWith(' .trpg-table-clue') || selector.endsWith(' .trpg-stage-pockets :is(small, span)'))) {
        const active = stack.every(context => !context.startsWith('@media') || context.slice(6).split(',').some(part => {
          const constraints = [...part.matchAll(/\(max-(width|height):\s*(\d+)px\)/g)];
          assert(constraints.length, 'Unexpected media around card rules: ' + context);
          return constraints.every(([, axis, max]) => (axis === 'width' ? width : height) <= Number(max));
        }));
        if (active) {
          // :is(small,span) contributes one type selector, not both arguments.
          const simple = selector.replace(':is(small, span)', 'span');
          const specificity = [(simple.match(/#[\w-]+/g) || []).length,
            (simple.match(/\.[\w-]+/g) || []).length, (simple.match(/(?:^|\s)(?:small|span)(?=\s|$)/g) || []).length];
          rules.push({ specificity, declarations: Object.fromEntries(css.slice(start, i).split(';').filter(x => x.includes(':')).map(x => {
            const at = x.indexOf(':'); return [x.slice(0, at).trim(), x.slice(at + 1).trim()];
          })) });
        }
      }
      start = i + 1;
    }
  }
  assert(rules.length >= 2, 'Card and existing pocket rule must both participate');
  rules.sort((a, b) => { for (let i = 0; i < 3; i++) if (a.specificity[i] !== b.specificity[i]) return a.specificity[i] - b.specificity[i]; return 0; });
  return Object.assign({}, ...rules.map(r => r.declarations));
}
for (const [width, height, size] of [[1280, 720, '12px'], [1001, 720, '12px'], [1000, 720, '0'], [844, 390, '0'], [390, 844, '0']]) {
  test(`clue card cascade ${width}x${height}`, () => {
    const styles = cardDeclarations(width, height);
    assert.equal(styles.color, '#273d3a', 'Dark card text must beat inherited pocket text');
    assert.equal(styles['font-size'], size, 'Narrow card text must collapse without changing other pockets');
    assert.equal(styles.background, '#eaddbb');
  });
}

// Exercise the real preview resize callback and existing readiness predicate.
// No DOM layout/rendering: the stage-width port models only scale reflection.
test('seat rail measurement waits for preview resize outputs', async () => {
  const browserTest = await readFile(new URL('./browser/trpg_tabletop.mjs', import.meta.url), 'utf8');
  const seatLoop = browserTest.slice(browserTest.indexOf('// Adopted table presentation:'), browserTest.indexOf('// Reach the real preparation check'));
  assert.match(seatLoop, /await p\.setViewportSize\(\{width,height\}\);\s*await settledPreview\(p\);\s*const seats=/);
  assert.match(seatLoop, /assert\(seats\.visible&&seats\.inside,/);
  const previewSource = await readFile(new URL('../js/trpg/preview.js', import.meta.url), 'utf8');
  const listeners = {}, styles = new Map();
  const stage = { style: { setProperty: (k, v) => styles.set(k, v), getPropertyValue: k => styles.get(k) },
    getBoundingClientRect: () => ({ width: 1280 * Number(styles.get('--k')) }) };
  const rotate = { hidden: true };
  const port = vm.createContext({ URL, URLSearchParams,
    innerWidth: 1280, innerHeight: 720,
    document: { getElementById: id => id === 'stage' ? stage : id === 'trpg-rotate' ? rotate : {}, querySelector: () => null },
    window: { addEventListener: (event, fn) => { listeners[event] = fn; } },
    matchMedia: () => ({ matches: reducedMotion }), location: { href: 'https://example.invalid/remake/trpg-preview.html', search: '' }, history: { replaceState() {} } });
  const preview = new vm.SourceTextModule(previewSource, { context: port });
  await preview.link(() => new vm.SyntheticModule(['mountTrpgCollection'], function () {
    this.setExport('mountTrpgCollection', () => ({ snapshot() {}, audioSnapshot() {}, loaded: true }));
  }, { context: port }));
  await preview.evaluate();
  const { settledPreview } = await import('./browser/trpg_layout.mjs');
  let readiness;
  await settledPreview({ waitForFunction: async predicate => { readiness = predicate; } });
  const ready = () => vm.runInContext('(' + readiness.toString() + ')()', port);
  // Browser global visualViewport is optional, so explicitly model its absence.
  port.visualViewport = undefined;
  assert.equal(ready(), true);
  port.innerWidth = 844; port.innerHeight = 390;
  assert.equal(ready(), false, 'new viewport with old scale must not be measured');
  listeners.resize();
  assert.equal(Number(styles.get('--k')), 390 / 720);
  assert.equal(ready(), true, 'real fit callback supplies the expected scale');
  port.innerWidth = 390; port.innerHeight = 844;
  assert.equal(ready(), false);
  listeners.resize();
  assert.equal(Number(styles.get('--k')), 390 / 1280);
  assert.equal(rotate.hidden, false);
  assert.equal(ready(), true);
});


for (const reduced of [true, false]) test('d20 roll once and settle once; reduced-motion=' + reduced, async () => {
  reducedMotion = reduced; timers.length = delays.length = tickers.length = 0;
  const { api, root, q, drain, declare } = mount(scenarios[0]); q('trpg-start').click(); drain(); declare('listen');
  const roll = q('trpg-roll'), click = roll.events.click[0];
  click({currentTarget:roll}); const pending = JSON.stringify(api.snapshot().pending);
  click({currentTarget:roll}); assert.equal(JSON.stringify(api.snapshot().pending), pending, 'Double click cannot roll twice');
  assert.equal(delays.at(-1), reduced ? 40 : 650);
  for (const tick of tickers) tick(); assert.equal(JSON.stringify(api.snapshot().pending), pending, 'Animation cannot update actual dice');
  timers.shift()();
  const values = root.querySelectorAll('.trpg-d20-value').map(n => Number(n.textContent));
  assert.deepEqual(values, Array.from(api.snapshot().pending.dice));
  const settle = q('trpg-settle').events.click[0]; settle(); settle();
  assert.equal(api.snapshot().checks.length, 1, 'Double callback cannot settle twice');
  api.destroy(); reducedMotion = true;
});

test('actual runTrpg public caller: pre-abort and in-flight abort return cancellation without completion', async () => {
  const entry = await load(new URL('../js/trpg/index.js', import.meta.url)); await entry.evaluate();
  const scenario = scenarios[0], host = new Dom(), signal = new AbortController(); let completed = 0;
  const manifest = { portraits: Object.fromEntries(scenario.cast.map(c => [c.id, {faces:['normal'],h:.7,b:.1,aspect:1}])) };
  const options = { resources: {scenario,characters:scenario.cast.map(c=>({id:c.id,name:c.id})),manifest}, signal:signal.signal,
    audio:{available:false,enabled:false,setTheme(){},play(){},silence(){}}, onComplete:()=>completed++ };
  const pending = entry.namespace.runTrpg(host, options); signal.abort(); signal.abort();
  assert.equal((await pending).cancelled, true); assert.equal(completed, 0);
  const again = await entry.namespace.runTrpg(new Dom(), options); assert.equal(again.cancelled,true); assert.equal(completed,0);
});
