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
const context = vm.createContext({ Node: Dom, document: documentPort, URL, structuredClone, console,
  Image: class { decode() { return Promise.resolve(); } }, matchMedia: () => ({ matches: true }),
  setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() {}, clearInterval() {} });
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
  const api = mod.namespace.mountTrpg(host, { scenario, characters: [], manifest, seed: 9, profileId: scenario.profiles[0].id, audio });
  const root = host.children[0];
  const q = id => { const node = root.querySelector('[data-test="' + id + '"]'); assert(node, id); return node; };
  const drain = () => { let n = 0; while (!q('trpg-next').hidden) { q('trpg-next').click(); assert(++n < 100); } };
  const roll = () => { q('trpg-roll').click(); timers.shift()(); };
  return { api, root, q, drain, roll };
}
for (const scenario of scenarios) {
  test(scenario.id + ': cast seats follow dialogue and idle GM; no invented participants', () => {
    const { api, root, q, drain } = mount(scenario); q('trpg-start').click();
    assert.equal(root.querySelectorAll('.trpg-table-person').length, scenario.cast.length);
    const active = root.querySelector('.trpg-table-person.active'); assert(active); assert.equal(active.querySelector('.trpg-seat-speaking').textContent, '話者');
    drain(); q('trpg-check-back').click();
    assert.equal(root.querySelector('.trpg-table-person.active').dataset.speaker, scenario.cast.find(c => c.part === 'GM').id); api.destroy();
  });
  test(scenario.id + ': support cancellation does not spend; confirmed help and reroll share seat receipts', () => {
    const { api, root, q, drain, roll } = mount(scenario); q('trpg-start').click(); drain(); roll();
    const actor = scenario.cast.find(c => c.abilityType === 'reroll').id;
    q('trpg-reroll-1').click();
    assert(q('trpg-reroll-receipt').textContent.includes(actor));
    assert.equal(root.querySelectorAll('.trpg-reroll-stamp').length, 1);
    for (const die of root.querySelectorAll('.trpg-die')) assert.equal(die.children.length, 9, 'dice retain only nine real pips');
    assert.equal(api.snapshot().used[actor], true); q('trpg-settle').click(); drain();
    for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
    q('trpg-interpret').click(); q('trpg-hypothesis-' + scenario.hypotheses[0].id).click(); drain();
    for (const field of Object.keys(api.snapshot().plan).filter(f => scenario.flow?.prepare?.includes(f) || !scenario.flow && ['aroma', 'seat'].includes(f))) {
      q('trpg-choice-tab-' + field).click(); q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
    }
    q('trpg-prepare-open').click(); const helper = scenario.checks.prepare.helper;
    const before = JSON.stringify(api.snapshot()); q('trpg-support-' + helper).checked = true; q('trpg-support-' + helper).change(); q('trpg-check-back').click();
    assert.equal(JSON.stringify(api.snapshot()), before);
    q('trpg-prepare-open').click(); assert(!q('trpg-support-' + helper).checked); q('trpg-support-' + helper).checked = true; roll();
    assert(q('trpg-helper-receipt').textContent.includes(helper)); assert.equal(api.snapshot().used[helper], true);
    const seat = root.querySelectorAll('.trpg-table-person').find(n => n.dataset.speaker === helper);
    assert.equal(seat.querySelector('.trpg-seat-ability').dataset.spent, 'true');
    q('trpg-settle').click(); drain();
    const fields = scenario.flow?.serve || ['approach'];
    for (const field of fields) q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
    q('trpg-serve-open').click(); roll(); assert(!root.querySelector('[data-test="trpg-helper-receipt"]'));
    q('trpg-settle').click(); drain(); assert.equal(api.snapshot().phase, 'ending');
    assert.equal(root.querySelectorAll('.trpg-table-clue').length, 3); assert(!q('trpg-finish').disabled);
    assert.equal(api.snapshot().teamwork, 0); api.destroy();
  });
  test(scenario.id + ': 0/1/3 clue cards open the existing notes without inspecting again', () => {
    const { api, root, q, drain, roll } = mount(scenario); q('trpg-start').click(); drain(); roll(); q('trpg-settle').click(); drain();
    assert.equal(root.querySelectorAll('.trpg-table-clue').length, 0);
    for (const [i, spot] of scenario.spots.slice(0, 3).entries()) {
      q('trpg-spot-' + spot.id).click(); drain(); assert.equal(root.querySelectorAll('.trpg-table-clue').length, i + 1);
      const before = JSON.stringify(api.snapshot()); q('trpg-compare-notes').click();
      assert.equal(root.querySelectorAll('.trpg-note-card').length, i + 1); q('trpg-notes-close').click(); assert.equal(JSON.stringify(api.snapshot()), before);
    }
    assert.deepEqual(Array.from(root.querySelectorAll('.trpg-table-clue'), n => n.dataset.clue), Array.from(api.snapshot().clues).slice(0, 3)); api.destroy();
  });
}
