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
function mount(scenario, extra = {}) {
  const host = new Dom();
  const manifest = { portraits: Object.fromEntries(scenario.cast.map(c => [c.id, { faces: ['normal'], h: .7, b: .1, aspect: 1 }])) };
  const audio = { enabled: false, available: true, setTheme() {}, play() {}, silence() {}, setEnabled() {} };
  let completions = 0, result = null;
  const api = mod.namespace.mountTrpg(host, { ...extra, onComplete: r => { completions++; result = r; return extra.onComplete?.(r); }, scenario, characters: [], manifest, seed: 9, profileId: scenario.profiles[0].id, audio });
  const root = host.children[0];
  const q = id => { const node = root.querySelector('[data-test="' + id + '"]'); assert(node, id); return node; };
  const drain = () => { let n = 0; while (!q('trpg-next').hidden) { q('trpg-next').click(); assert(++n < 100); } };
  const roll = () => { q('trpg-roll').click(); timers.shift()(); };
  // A real table declares who acts before the dice: pick the first approach and read the declaration.
  const declare = kind => { const first = scenario.checks[kind].approaches?.[0]; if (first) { q('trpg-approach-' + first.id).click(); drain(); } };
  // New scenes: two questions for the story's character, then a twist with its own tactic and roll.
  const interview = () => {
    if (api.snapshot().phase !== 'interview') return;
    for (const topic of scenario.interview.topics.slice(0, scenario.interview.picks || 2)) { q('trpg-topic-' + topic.id).click(); drain(); }
    q('trpg-interview-done').click();
  };
  const twist = () => {
    if (api.snapshot().phase !== 'twist') return;
    const field = scenario.flow.twist[0];
    q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
    q('trpg-twist-open').click(); declare('twist'); roll(); q('trpg-settle').click(); drain();
  };
  return { api, root, q, drain, roll, declare, interview, twist, get completions() { return completions; }, get result() { return result; } };
}
for (const scenario of scenarios) {
  // 物語の層と卓の層（TRF10）: 台本の role から、語り・GMが演じる人物・役の台詞・卓の会話を見分けて、名札と舞台の層を切り替える。
  // ゲームマスターは顔を出さない（TRF20）: GMの声は印と「ゲームマスター（名前）」、演じる人物は人影の札、PLは卓では本人・物語では役の姿。
  test(scenario.id + ': each line is staged as table talk, narration, a character the GM plays, or a player in role; the GM never shows a face', () => {
    const mounted = mount(scenario), { api, root, q } = mounted;
    const gm = scenario.cast.find(c => c.part === 'GM').id, seen = {};
    // The cover lists everyone as themselves, with what they will be at this table.
    const roster = root.querySelectorAll('.trpg-cover-person').map(n => n.children.map(c => c.textContent));
    assert.equal(roster.length, scenario.cast.length);
    assert.deepEqual(roster[scenario.cast.findIndex(c => c.id === gm)].slice(1), [gm, 'ゲームマスター']);
    q('trpg-start').click();
    const dock = () => root.querySelector('.trpg-dock'), art = () => root.querySelector('.trpg-speaker-art');
    const label = () => root.querySelector('.trpg-speaker-label').children.map(n => n.textContent);
    for (let n = 0; !q('trpg-next').hidden; n++) {
      assert(n < 100);
      const byGm = dock().dataset.gm === 'true', kind = root.dataset.kind + (byGm && root.dataset.kind === 'table' ? ':gm' : ''), [who, aside] = label();
      seen[kind] ||= { who, aside, gm: byGm, layer: root.dataset.layer, dock: dock().dataset.layer, art: art().children.length,
        face: art().querySelectorAll('img').length, mark: art().querySelectorAll('.trpg-gm-mark').length };
      assert.equal(art().querySelectorAll('img').some(img => img.getAttribute('alt') === gm), false, 'no portrait of the GM in any line');
      q('trpg-next').click();
    }
    assert(seen.table && seen['table:gm'] && seen.narration && seen.npc && seen.pc, 'the opening of ' + scenario.id + ' uses every layer: ' + Object.keys(seen));
    for (const kind of ['table', 'table:gm']) { assert.equal(seen[kind].layer, 'table'); assert.equal(seen[kind].dock, 'table'); }
    for (const kind of ['narration', 'npc', 'pc']) { assert.equal(seen[kind].layer, 'fiction'); assert.equal(seen[kind].dock, 'fiction'); }
    // A player at the table is themselves, with their own portrait.
    assert(scenario.cast.some(c => c.part !== 'GM' && c.id === seen.table.who)); assert.equal(seen.table.face, 1); assert.equal(seen.table.gm, false);
    // The GM's own voice: the mark and "ゲームマスター（name）", at the table and when narrating (the narration shows no art at all).
    assert.deepEqual([seen['table:gm'].who, seen['table:gm'].aside, seen['table:gm'].face, seen['table:gm'].mark], ['ゲームマスター', gm, 0, 1]);
    assert.deepEqual([seen.narration.who, seen.narration.aside, seen.narration.art, seen.narration.gm], ['ゲームマスター', gm, 0, true]);
    // A character the GM plays: the silhouette card alone, credited to the game master.
    assert.equal(seen.npc.aside, 'ゲームマスター ' + gm, 'the GM is credited beside the character they play');
    assert.deepEqual([seen.npc.art, seen.npc.face, seen.npc.mark, seen.npc.gm], [1, 0, 0, false]);
    assert(seen.npc.who && seen.npc.who !== gm && !/物語|\{pc/.test(seen.npc.who), 'the story character is named: ' + seen.npc.who);
    const sheets = api.snapshot(), names = scenario.cast.filter(c => c.sheet).map(c => c.sheet.name);
    assert(names.includes(seen.pc.who) || Object.values(scenario.companionBuilds || {}).some(byPlayer => Object.values(byPlayer).flat().some(o => o.name === seen.pc.who)),
      'a player in role is named by the character: ' + seen.pc.who);
    assert(scenario.cast.some(c => c.id === seen.pc.aside), 'with the player credited: ' + seen.pc.aside);
    assert.equal(sheets.phase, 'listen');
    // Waiting for input is neither layer: the scene is the player's again, and the prompt is the game master's.
    q('trpg-declare-back').click();
    assert.equal(root.dataset.layer, 'idle');
    assert.deepEqual(label(), ['ゲームマスター', gm]); assert.equal(dock().dataset.gm, 'true');
    assert.equal(art().querySelectorAll('img').length, 0); assert.equal(art().querySelectorAll('.trpg-gm-mark').length, 1);
    // The seat rail: the GM's seat is the lettered mark, every player keeps a face.
    for (const c of scenario.cast) {
      const seat = root.querySelectorAll('.trpg-table-person').find(n => n.dataset.speaker === c.id), face = seat.querySelector('.trpg-seat-face');
      assert.equal(face.dataset.gm, String(c.id === gm));
      assert.equal(face.querySelectorAll('img').length, c.id === gm ? 0 : 1);
      if (c.id === gm) { assert.equal(face.querySelector('.trpg-gm-mark').dataset.lettered, 'true'); assert.equal(seat.getAttribute('title'), 'ゲームマスター ' + gm); }
    }
    // The log names the game master too.
    q('trpg-log').click();
    assert(root.querySelectorAll('.trpg-log-line').some(line => line.children[0].textContent.startsWith('ゲームマスター（' + gm + '）')));
    api.destroy();
  });
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
    const mounted = mount(scenario); const { api, root, q, drain, roll, declare, interview, twist } = mounted; q('trpg-start').click(); drain(); declare('listen'); roll();
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
    assert.equal(api.snapshot().used[actor], true); q('trpg-settle').click(); drain(); interview();
    for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
    q('trpg-interpret').click(); q('trpg-hypothesis-' + scenario.hypotheses[0].id).click(); drain(); twist();
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
  // 部の成長（TRF13）: 本編の卓は成長点を受け取り、結末で「今夜の卓で増えた部の実績」を出す。試遊の卓には何も出ない。
  test(scenario.id + ': growth shows on the cover and the sheet, and the ending shows what the club gained', () => {
    const play = extra => {
      const mounted = mount(scenario, extra), { root, q, drain, roll, declare, interview, twist } = mounted;
      const cover = { chip: root.querySelector('[data-test="trpg-growth"]')?.textContent ?? null, stats: { ...mounted.api.snapshot().pc.stats } };
      q('trpg-start').click(); drain(); declare('listen'); roll(); q('trpg-settle').click(); drain(); interview();
      for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
      q('trpg-interpret').click(); q('trpg-hypothesis-' + scenario.hypotheses[0].id).click(); drain(); twist();
      for (const field of scenario.flow.prepare) { q('trpg-choice-tab-' + field).click(); q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click(); }
      q('trpg-prepare-open').click(); declare('prepare'); roll(); q('trpg-settle').click(); drain();
      for (const field of scenario.flow.serve) q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
      q('trpg-serve-open').click(); declare('serve'); roll(); q('trpg-settle').click(); drain();
      const club = root.querySelector('[data-test="trpg-ending-club"]');
      const out = { cover, club: club && { up: club.dataset.up, text: club.textContent }, completions: mounted.completions };
      mounted.api.destroy(); return out;
    };
    const base = scenario.builder.archetypes[0].stats, sum = stats => Object.values(stats).reduce((n, v) => n + v, 0);
    const plain = play({});
    assert.equal(plain.cover.chip, null); assert.deepEqual(plain.cover.stats, base); assert.equal(plain.club, null, 'a table outside the campaign shows no club line');
    const next = { rank: 3, name: '評判の部', at: 16, need: 9, growth: 1 };
    const grown = play({ growth: 1, onComplete: () => ({ club: { gained: 4, points: 7, rank: 2, name: 'なじみの部', growth: 1, rankUp: true, growthUp: 1, next } }) });
    assert.equal(grown.cover.chip, '成長点 ＋1'); assert.equal(sum(grown.cover.stats), sum(base) + 1); assert.equal(grown.completions, 1);
    assert.equal(grown.club.up, 'true'); assert.match(grown.club.text, /部の実績 ＋4/); assert.match(grown.club.text, /ランク 2 · なじみの部/); assert.match(grown.club.text, /能力＋1/);
    const steady = play({ growth: 1, onComplete: () => ({ club: { gained: 1, points: 8, rank: 2, name: 'なじみの部', growth: 1, rankUp: false, growthUp: 0, next: { ...next, need: 8 } } }) });
    assert.equal(steady.club.up, 'false'); assert.match(steady.club.text, /部の実績 ＋1次のランクまで あと 8/); assert.doesNotMatch(steady.club.text, /能力＋/);
    assert.equal(play({ growth: 1, onComplete: () => ({ club: { gained: 0, rankUp: false, growthUp: 0, next } }) }).club, null, 'nothing gained, nothing shown');
  });
  // じっくり調べる（目星・TRF14）: 見立ての卓で一度だけ振れる。出目と結果の帯・違いそうな見立ての付箋が出て、しおりにも残る。
  test(scenario.id + ': a closer look rolls once on the guess board, marks the wrong guesses and is kept in the bookmark', () => {
    const marks = [];
    const mounted = mount(scenario, { onBookmark: mark => marks.push(mark) }), { api, root, q, drain, roll, declare, interview } = mounted;
    q('trpg-start').click(); drain(); declare('listen'); roll(); q('trpg-settle').click(); drain(); interview();
    for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
    q('trpg-interpret').click();
    const eye = api.snapshot().pc.stats.eye;
    assert.equal(q('trpg-search').textContent, 'じっくり調べる' + scenario.presentation.stats.eye + ' ＋' + eye + ' · 1回');
    assert.match(q('trpg-search').getAttribute('aria-label'), /一度だけ。成功 約\d+%で違う見立てが2つ、ひと手間 約\d+%で1つ分かる/);
    assert.equal(root.querySelectorAll('.trpg-hint-mark').length, 0);
    const pending = timers.length;
    q('trpg-search').click(); for (const fn of timers.splice(pending)) fn();
    const found = api.snapshot().search;
    assert.equal(found.base, eye); assert.equal(root.querySelector('[data-test="trpg-search"]'), null, 'one look per table');
    const strip = q('trpg-search-result');
    assert.equal(strip.dataset.grade, found.grade); assert.equal(strip.dataset.fresh, 'true');
    assert(strip.textContent.startsWith(found.dice.join('') + '＋' + eye + ' ＝ ' + found.total), strip.textContent);
    assert(strip.textContent.endsWith(found.ruled.length ? '✕ ' + found.ruled.length + 'つ' : '決め手なし'), strip.textContent);
    assert.equal(root.querySelectorAll('.trpg-hint-mark').length, found.ruled.length);
    for (const h of scenario.hypotheses) assert.equal(q('trpg-hypothesis-' + h.id).dataset.ruled, String(found.ruled.includes(h.id)));
    assert(marks.at(-1).actions.some(([key]) => key === 'search'), 'the bookmark keeps the look');
    // Reopening the board shows the same result without replaying the roll.
    q('trpg-hypothesis-back').click(); q('trpg-interpret').click();
    assert.equal(q('trpg-search-result').dataset.fresh, 'false');
    assert.equal(root.querySelectorAll('.trpg-hint-mark').length, found.ruled.length);
    // A marked guess can still be chosen, and the table goes on as usual.
    const pick = found.ruled[0] || scenario.hypotheses[0].id;
    q('trpg-hypothesis-' + pick).click(); drain();
    assert.equal(api.snapshot().hypothesis, pick);
    const actions = marks.at(-1).actions; api.destroy();
    // Continuing from the bookmark lands on the same look.
    const again = mount(scenario, { resume: { actions } });
    assert.deepEqual(again.api.snapshot().search, found); again.api.destroy();
  });
  test(scenario.id + ': a role against type says one line in the role before the ending and one as the player after the table (S17)', () => {
    const text = id => scenario.dialogues.find(d => d.dialogue_id === id).lines[0].text;
    // Play the whole table with the seat's player bringing the given role, and keep every line the ending talk shows.
    const read = (seat, role) => {
      const m = mount(scenario, { companions: { [seat]: role.id } }); const { api, root, q, drain, roll, declare, interview, twist } = m;
      q('trpg-start').click(); drain(); declare('listen'); roll(); q('trpg-settle').click(); drain(); interview();
      for (const spot of scenario.spots.slice(0, 3)) { q('trpg-spot-' + spot.id).click(); drain(); }
      q('trpg-interpret').click(); q('trpg-hypothesis-' + scenario.hypotheses[0].id).click(); drain(); twist();
      for (const field of scenario.flow.prepare) { q('trpg-choice-tab-' + field).click(); q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click(); }
      q('trpg-prepare-open').click(); declare('prepare'); roll(); q('trpg-settle').click(); drain();
      for (const field of scenario.flow.serve) q('trpg-plan-' + field + '-' + scenario.options[field][0].id).click();
      q('trpg-serve-open').click(); declare('serve'); roll(); q('trpg-settle').click();
      const said = [];
      for (let n = 0; !q('trpg-next').hidden; n++) { said.push(root.querySelector('.trpg-speech').textContent); q('trpg-next').click(); assert(n < 100); }
      assert.equal(api.snapshot().phase, 'ending'); assert.equal(m.completions, 1);
      assert.equal(m.result.companions[seat], role.id, 'the table kept the role the player brought');
      api.destroy(); return said;
    };
    let checked = 0;
    for (const [seat, byPlayer] of Object.entries(scenario.companionBuilds)) {
      const against = (byPlayer[seat] || []).find(o => o.aside), usual = (byPlayer[seat] || []).find(o => !o.aside);
      if (!against) continue;
      // The speech box also shows the speaker and the role label in front of the line.
      const at = (lines, line) => lines.findIndex(shown => shown.endsWith(line));
      const said = read(seat, against), epilogue = at(said, text(scenario.epilogue)), aside = at(said, text(against.aside));
      assert(epilogue > 0, 'the epilogue is read');
      assert(aside >= 0 && aside < epilogue, 'the line in the role comes before the ending');
      assert(said.at(-1).endsWith(text(against.after)), 'the player has the last word after the table');
      const plain = read(seat, usual);
      assert(at(plain, text(against.aside)) < 0 && at(plain, text(against.after)) < 0, 'the usual role adds nothing');
      assert.equal(plain.length + 2, said.length, 'exactly the two lines are added');
      checked++;
    }
    assert(checked >= 1, 'this table has a role against type');
  });
  test(scenario.id + ': 0/1/3 clue cards open the existing notes without inspecting again', () => {
    const { api, root, q, drain, roll, declare, interview } = mount(scenario); q('trpg-start').click(); drain(); declare('listen'); roll(); q('trpg-settle').click(); drain(); interview();
    assert.equal(root.querySelectorAll('.trpg-table-clue').length, 0);
    for (const [i, spot] of scenario.spots.slice(0, 3).entries()) {
      q('trpg-spot-' + spot.id).click(); drain(); assert.equal(root.querySelectorAll('.trpg-table-clue').length, i + 1);
      const before = JSON.stringify(api.snapshot()); q('trpg-compare-notes').click();
      // The notebook keeps the interview answers above the room's clues.
      assert.equal(root.querySelectorAll('.trpg-note-card').length, i + 1 + api.snapshot().asked.length); q('trpg-notes-close').click(); assert.equal(JSON.stringify(api.snapshot()), before);
    }
    assert.deepEqual(Array.from(root.querySelectorAll('.trpg-table-clue'), n => n.dataset.clue), Array.from(api.snapshot().clues).slice(0, 3)); api.destroy();
  });
}

for (const scenario of scenarios) {
  test(scenario.id + ': the cover builds the player character; seats, lines and the result use it', () => {
    const { api, root, q, drain, declare, roll, interview } = mount(scenario);
    const builder = scenario.builder, origin = builder.archetypes[1];
    assert.equal(q('trpg-cover-pc-name').textContent, builder.archetypes[0].name);
    q('trpg-build').click();
    // The look is not chosen (#3050): no look buttons; the PC wears the player's own face.
    // Only two parts remain: the origin and the name/stats (#3050).
    assert.deepEqual([...q('trpg-builder').children].map(n => String(n.className).trim()), ['trpg-builder-origins', 'trpg-builder-stats'], 'no look choice in the builder');
    q('trpg-archetype-' + origin.id).click();
    // Beginners never see +/- unless they ask; every stat carries a plain explanation.
    assert(!root.querySelector('[data-test="trpg-stat-eye-up"]'), 'easy mode hides the point-buy');
    assert.equal(root.querySelectorAll('.trpg-builder-stat-help').length, 4);
    q('trpg-builder-advanced').click();
    const lowered = Object.keys(origin.stats).find(k => origin.stats[k] > builder.min), raised = Object.keys(origin.stats).find(k => k !== lowered && origin.stats[k] < builder.max);
    q('trpg-stat-' + lowered + '-down').click();
    assert.equal(q('trpg-stat-points').dataset.left, '1');
    q('trpg-stat-' + raised + '-up').click();
    assert.equal(q('trpg-stat-points').dataset.left, '0');
    assert(q('trpg-stat-' + raised + '-up').disabled, 'no points left to spend');
    q('trpg-build-confirm').click();
    const pc = api.snapshot().pc;
    assert.equal(pc.name, origin.name); assert(!('look' in pc), 'the built character has no look');
    assert.equal(pc.stats[lowered], origin.stats[lowered] - 1); assert.equal(pc.stats[raised], origin.stats[raised] + 1);
    assert.equal(q('trpg-cover-pc-name').textContent, origin.name);
    const coverFace = root.querySelector('.trpg-cover-pc-face img');
    assert(coverFace, 'the cover shows a face');
    assert(!String(coverFace.src || '').includes('/ui/trpg/'), 'the cover shows the player\'s own portrait, not a look');
    q('trpg-start').click();
    assert(q('trpg-seat-pc-hajime').textContent.includes(origin.name), 'the seat shows the built character');
    assert(!root.textContent.includes('{pc}'), 'the name token never leaks to the screen');
    drain(); declare('listen'); roll(); q('trpg-settle').click(); drain(); interview();
    assert.equal(api.snapshot().checks[0].base, pc.stats[scenario.checks.listen.approaches[0].stat]);
    api.destroy();
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
  const stage = { style: { setProperty: (k, v) => styles.set(k, v), getPropertyValue: k => styles.get(k), removeProperty: k => styles.delete(k) },
    dataset: {}, getBoundingClientRect: () => ({ width: 1280 * Number(styles.get('--k')) }) };
  const rotate = { hidden: true };
  const port = vm.createContext({ URL, URLSearchParams,
    innerWidth: 1280, innerHeight: 720,
    document: { documentElement: { dataset: {} }, getElementById: id => id === 'stage' ? stage : id === 'trpg-rotate' ? rotate : {}, querySelector: () => null },
    // The preview fits with the game's shared core/stage-fit.js, which reads the window's size.
    window: { addEventListener: (event, fn) => { listeners[event] = fn; }, get innerWidth() { return port.innerWidth; },
      get innerHeight() { return port.innerHeight; }, get visualViewport() { return port.visualViewport; } },
    matchMedia: () => ({ matches: reducedMotion }), location: { href: 'https://example.invalid/remake/trpg-preview.html', search: '' }, history: { replaceState() {} } });
  const preview = new vm.SourceTextModule(previewSource, { context: port });
  const stageFit = new vm.SourceTextModule(await readFile(new URL('../js/core/stage-fit.js', import.meta.url), 'utf8'), { context: port });
  await preview.link(specifier => specifier.endsWith('core/stage-fit.js') ? stageFit
    // 左右の余白の煙と縁（YHK12）。この検査は画面当ての倍率だけを見るので、層は作らない
    : specifier.endsWith('core/side-area.js') ? new vm.SyntheticModule(['initSideArea'], function () { this.setExport('initSideArea', () => {}); }, { context: port })
    : new vm.SyntheticModule(['mountTrpgCollection'], function () {
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
  // The dice are thrown into the tray and bounce before they settle (2026-11-02: 650ms → 1050ms).
  assert.equal(delays.at(-1), reduced ? 40 : 1050);
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

test('the shopkeeper tutorial plays on the cover, blocks the start until it ends, and can be replayed', async () => {
  const tutorial = JSON.parse(await readFile(new URL('../../data/dialogue/trpg_tutorial.json', import.meta.url), 'utf8'));
  for (const scenario of scenarios) {
    const host = new Dom();
    const manifest = { portraits: Object.fromEntries(scenario.cast.map(c => [c.id, { faces: ['normal'], h: .7, b: .1, aspect: 1 }])) };
    const audio = { enabled: false, available: true, setTheme() {}, play() {}, silence() {}, setEnabled() {} };
    let done = 0;
    const api = mod.namespace.mountTrpg(host, { scenario, characters: [], manifest, seed: 9, profileId: scenario.profiles[0].id, audio,
      tutorialLines: tutorial.lines, tutorial: true, onTutorialDone: () => done++ });
    const root = host.children[0];
    const q = id => { const node = root.querySelector('[data-test="' + id + '"]'); assert(node, id); return node; };
    assert.match(root.querySelector('.trpg-speaker-label').textContent, /^sai店長/, 'the shopkeeper speaks first');
    assert.equal(q('trpg-tutorial-panel').dataset.panel, 'welcome');
    q('trpg-start').click();
    assert.equal(api.snapshot().phase, 'cover', 'the story cannot start over the tutorial');
    const panels = new Set();
    for (let n = 0; !q('trpg-next').hidden; n++) {
      const panel = root.querySelector('[data-test="trpg-tutorial-panel"]'); if (panel) panels.add(panel.dataset.panel);
      assert(!root.querySelector('.trpg-speech').textContent.includes('{gm}'), 'the GM name is filled in');
      q('trpg-next').click(); assert(n < 40);
    }
    assert.equal(done, 1); assert.equal(panels.size, 8); assert.equal(root.querySelector('[data-test="trpg-tutorial-panel"]'), null);
    q('trpg-tutorial').click(); assert(!q('trpg-next').hidden, 'the cover button replays the tutorial');
    while (!q('trpg-next').hidden) q('trpg-next').click();
    assert.equal(done, 2);
    // Session zero: the companions announce the characters they made before the story begins.
    q('trpg-start').click();
    const said = [];
    for (let n = 0; n < 6; n++) { said.push(root.querySelector('.trpg-speech').textContent); q('trpg-next').click(); }
    for (const option of Object.values(api.snapshot().companions)) assert(option);
    const names = Object.keys(scenario.companionBuilds).map(seat => scenario.companionBuilds[seat][seat].find(o => o.id === api.snapshot().companions[seat]).name);
    assert(names.every(name => said.join('').includes(name)), 'each companion names their character: ' + said.join(' / '));
    assert(!said.join('').includes('{pc'), 'no name token leaks');
    api.destroy();
  }
});
