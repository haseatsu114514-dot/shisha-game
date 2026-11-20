// #834: actual calendar + night scheduler + chapter's actual NIGHT_EVENTS wiring.
// Only UI/services are stubbed. Do not replace runNightPlan with a no-op.
// node --experimental-vm-modules remake/test/delivery_night_plan.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const calendarSource = await fs.readFile(new URL('../js/daily/calendar.js', import.meta.url), 'utf8');
const nightSource = await fs.readFile(new URL('../js/daily/night-events.js', import.meta.url), 'utf8');
const chapterSource = await fs.readFile(new URL('../js/chapters/ch1.js', import.meta.url), 'utf8');
// Evaluate the production definitions, including once()/nightScene(), rather than
// copying DAY2's text or completion flag into a test-only event implementation.
const start = chapterSource.indexOf('const nightScene =');
const end = chapterSource.indexOf('\nasync function lastNight()', start);
assert(start >= 0 && end > start, 'Chapter night-event definition boundary changed');
const chapterNightSource = chapterSource.slice(start, end);

let state = {};
const calls = [], saves = [];
let actionEnds = 0, reportMode = 'normal';
const destinations = [], tonariPicks = [];
let coldDraws = 0;
const noop = () => {}, asyncNoop = async () => {};
const unexpected = async () => { throw new Error('Unexpected unrelated chapter event'); };
const spots = { minto: { id: 'minto' }, adam: { id: 'adam' }, c_station: { id: 'c_station' }, tonari: { id: 'tonari', kind: 'tonari' } };
const chapterDialogues = JSON.parse(await fs.readFile(new URL('../../data/dialogue/ch1_main.json', import.meta.url), 'utf8')).dialogues;
const DB = { flavorById: {}, lime: [], dialogues: Object.fromEntries(chapterDialogues.map(d => [d.dialogue_id, d])) };
const originalSalary = structuredClone(DB.dialogues.ch1_salaryman_regular);
assert(originalSalary?.lines.length > 1 && originalSalary.branches, 'Use the full production customer dialogue');
let stateModule;
function replaceState(next) { state = next; stateModule.setExport('state', next); }
const play = async (value, opts) => {
  const id = typeof value === 'string' ? value : value.dialogue_id;
  const dialogue = typeof value === 'string' ? DB.dialogues[value] : value;
  calls.push({ type: 'scene', id, opts, day: state.day, slot: state.slot,
    dialogue: dialogue ? structuredClone(dialogue) : null });
  if (id === 'remake_delivery_report' && reportMode === 'cancel') return { cancelled: true };
  if (id === 'remake_delivery_report' && reportMode === 'load') {
    const next = structuredClone(state); next.money = 4321; replaceState(next);
  }
};
const overrides = {
  state, DB, save: () => saves.push(structuredClone(state)),
  el: (selector, attrs) => {
    if (selector === 'div.beat') calls.push({ type: 'beat', text: attrs.text, day: state.day });
    return { classList: { add: noop, remove: noop }, remove: noop };
  },
  sleep: asyncNoop, layers: { fx: { append: noop }, modal: { classList: { contains: () => false } } },
  dayTurn: async fn => fn(), fadeBlack: async fn => fn?.(),
  chapterDay: () => state.day, daysLeft: () => 14 - state.day, TOURNAMENT_DAY: 14, atChapterFinalDay: () => state.day >= 14,
  maxStamina: () => 100, staminaRatio: () => state.stamina / 100,
  spendableMoney: () => state.money,
  addMoney: n => state.money += n, addStamina: n => state.stamina = Math.max(0, Math.min(100, state.stamina + n)),
  staminaAfter: n => Math.max(0, state.stamina + n), coldRisk: ratio => ratio <= .25,
  catchesCold: () => { coldDraws++; return false; }, fitActive: () => false,
  modal: async options => { calls.push({ type: 'stamina-warning', options: options.options }); return options.options[0].value; },
  rescheduleInvitation: (inv, note) => { calls.push({ type: 'rescheduled', note }); state.pendingInvite = null; },
  conditionForRatio: () => ({ health: 'green' }),
  paidAction: async fn => ({ value: await fn(), spent: 0 }), play,
  chooseSpot: async opts => {
    assert(calls.length < 100, 'Calendar did not progress');
    calls.push({ type: 'map', pin: opts.guide?.pin }); return opts.guide?.pin || destinations.shift() || 'rest';
  },
  spotById: id => spots[id] || { id, kind: 'rest', stamina: 0 },
  tonariMenu: async () => tonariPicks.shift() || null,
  visitChar: async id => { state.story[id] = (state.story[id] || 0) + 1; calls.push({ type: 'visit', id }); },
  // This ports-only fixture checks the night flow around the shared rival handoff.
  deliverToRival: async ({ id }) => {
    const done = `_delivery_${id}_done`;
    if (state.flags[done]) return false;
    state.flags[`_delivery_${id}`] = true;
    if (id === 'minto') await play('remake_delivery_minto_handoff', { bg: 'res://assets/backgrounds/peppermint.png' });
    else await overrides.visitChar(id);
    state.flags[done] = true; overrides.addMoney(2000); overrides.save();
    return true;
  },
  visitSpot: async () => { state.flags._c_station_registered = true; },
  storyCount: id => state.story[id] || 0, isClosed: () => false, isUnlocked: () => true,
  markMet: id => state.met[id] = true, onAction: () => actionEnds++,
  runHomeShisha: async () => false, maybeConfession: async () => false, unreadCount: () => 0,
  completeInvitation: () => { state.pendingInvite = null; },
  invitationCost: () => 0, invitationGrowth: () => ({}), isFriendEvent: () => false,
  isFinaleEvent: () => false, CHAR_STAT: {}, storeInvitationSpot: () => false,
  openingStatus: () => ({ ok: true }), VISIT_BG: {}, currentCondition: () => ({ health: 'green' }),
  // #3819: there is no DAY2 fixed shift. The next shift the player takes runs its story hook (the regular's scene)
  // as that shift's customer.
  doBaito: async ({ story } = {}) => { calls.push({ type: 'shift', day: state.day, slot: state.slot, story: !!story }); await story?.(); },
};
const context = vm.createContext({
  console, DB, play, TOURNAMENT_DAY: 14,
  TONARI_N: 'res://assets/backgrounds/bg_tonari_inside_night.png',
  BG: id => `res://assets/backgrounds/${id}.png`,
  flag: key => !!state.flags[key], setFlag: key => { state.flags[key] = true; },
  meetHiyoriAtTonari: async () => calls.push({ type: 'hiyori' }),
  earlyPractice: unexpected, midPreparation: unexpected, playTsumugiStory: unexpected,
  lastNight: unexpected,
});
const importNames = new Map();
for (const source of [calendarSource, nightSource]) {
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    const names = importNames.get(match[2]) || new Set();
    for (const entry of match[1].split(',')) names.add(entry.trim().split(/\s+as\s+/)[0]);
    importNames.set(match[2], names);
  }
}
const modules = new Map();
for (const [specifier, names] of importNames) {
  if (specifier === './night-events.js') continue;
  const module = new vm.SyntheticModule([...names], function () {
    for (const name of names) this.setExport(name, name in overrides ? overrides[name] : asyncNoop);
  }, { context });
  modules.set(specifier, module);
}
stateModule = modules.get('../core/state.js');
const night = new vm.SourceTextModule(nightSource, { context });
await night.link(specifier => modules.get(specifier));
await night.evaluate();
const chapter = new vm.SourceTextModule(chapterNightSource, { context });
await chapter.link(() => { throw new Error('Unexpected import in chapter night definitions'); });
await chapter.evaluate();
const calendar = new vm.SourceTextModule(calendarSource, { context });
await calendar.link(specifier => specifier === './night-events.js' ? night : modules.get(specifier));
await calendar.evaluate();
const salary = chapter.namespace.NIGHT_EVENTS[2];
assert.equal(salary.id, '_ev_salaryman');
assert.equal(salary.pin, 'tonari');
assert(salary.beat, 'A real arrival beat is required to exercise the regression');
const events = { 2: salary };
const reportId = 'remake_delivery_report', salaryId = 'ch1_salaryman_regular';
function reset({ day = 2, slot = 0, flags = {}, money = 10000, stamina = 80 } = {}) {
  replaceState({ chapter: 1, day, slot, money, stamina,
    flags: { _errand_scout_done: true, _c_station_registered: true, [`_morning_${day}`]: true, ...flags },
    story: {}, met: {}, visitedDay: {}, stats: {}, inbox: [], deferredNightEvents: [], restDay: null });
  calls.length = 0; saves.length = 0; actionEnds = 0; coldDraws = 0; reportMode = 'normal';
  destinations.length = 0; tonariPicks.length = 0;
}
const countScene = id => calls.filter(x => x.type === 'scene' && x.id === id).length;
const countArrival = () => calls.filter(x => x.type === 'beat' && x.text === salary.beat).length;
function assertSalaryOpening(sameVisit) {
  const actual = calls.find(x => x.type === 'scene' && x.id === salaryId)?.dialogue;
  assert(actual, 'Production customer dialogue was not passed to playback');
  const expected = structuredClone(originalSalary);
  if (sameVisit) {
    expected.lines[0].text = '夜のtonari。帰り際、スミさんに「悪い、カウンター頼めるか」と呼び止められた。';
    assert.notEqual(expected.lines[0].text, originalSalary.lines[0].text,
      'The production arrival changed; review the same-visit adaptation');
    assert.match(actual.lines[0].text, /カウンター頼めるか/, 'Counter request must remain');
    assert(!actual.lines[0].text.includes('顔を出すと'), 'Dialogue narrates a second arrival');
  }
  assert.deepEqual(actual, expected, 'Keep dialogue ID, all remaining lines and every choice branch');
  assert.deepEqual(DB.dialogues.ch1_salaryman_regular, originalSalary, 'Do not mutate shared dialogue data');
}

const completed = { _delivery_batch_started: true, _delivery_minto_told: true, _delivery_adam_told: true,
  _delivery_minto_done: true, _delivery_adam_done: true };
const run = (nightEvents = events) => calendar.namespace.runDaily({ untilDay: state.day + 1, nightEvents });

// #3819: a fresh DAY2 delivers on the way from the registration, reports once, and keeps both slots free.
// There is no fixed shift and no night visit for the regular: his story waits for the next shift (or DAY8's night).
reset();
await run();
assert.equal(countScene(reportId), 1);
assert.equal(countScene(salaryId), 0, 'The regular is not read on DAY2 without a shift');
assert.equal(countArrival(), 0, 'No night visit is forced on DAY2');
assert.deepEqual(calls.filter(x => x.type === 'shift'), []);
assert(calls.findIndex(x => x.type === 'visit' && x.id === 'adam') < calls.findIndex(x => x.id === reportId));
assert.equal(calls.find(x => x.id === reportId).slot, 0, 'The report comes before the free day');
assert.equal(state.flags._ev_salaryman, undefined);
assert.equal(state.flags._night_event_day, undefined);
assert.deepEqual(state.deferredNightEvents.map(entry => entry.id), [salary.id], 'The regular stays queued');
assert.equal(state.money, 14000); assert.equal(state.stamina, 94); assert.equal(actionEnds, 2);
assert.equal(state.day, 3); assert.equal(state.slot, 0);
console.log('delivery night: fresh DAY2 delivers after the registration, no fixed shift, regular queued PASS');

// The next shift the player takes (DAY3, free noon) reads the regular as that shift's customer. No night arrival.
reset({ day: 3, flags: { ...completed, _delivery_report_done: true } });
state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 1, reason: 'scheduled' }];
destinations.push('tonari'); tonariPicks.push('baito');
await run();
assert.deepEqual(calls.filter(x => x.type === 'shift').map(x => [x.day, x.slot, x.story]), [[3, 0, true]]);
assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 0);
assert.equal(state.flags._ev_salaryman, true);
assert.equal(state.deferredNightEvents.length, 0);
{
  const actual = calls.find(x => x.type === 'scene' && x.id === salaryId).dialogue;
  // The night-visit arrival line is dropped inside the shift; every later line and choice branch stays.
  assert(originalSalary.lines[0].text.includes('顔を出すと'));
  assert.deepEqual(actual.lines, originalSalary.lines.slice(1));
  assert.deepEqual(actual.branches, originalSalary.branches);
  assert.deepEqual(DB.dialogues.ch1_salaryman_regular, originalSalary, 'Do not mutate shared dialogue data');
}
// A later shift, once the regular is read, is an ordinary shift.
reset({ day: 4, flags: { ...completed, _delivery_report_done: true, _ev_salaryman: true } });
destinations.push('tonari'); tonariPicks.push('baito');
await run();
assert.deepEqual(calls.filter(x => x.type === 'shift').map(x => [x.day, x.story]), [[4, false]]);
assert.equal(countScene(salaryId), 0);
// Without any shift through DAY7, the regular is read on DAY8's night (before DAY10's follow-up).
for (const day of [7, 8]) {
  reset({ day, slot: 2, flags: { ...completed, _delivery_report_done: true } });
  state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 1, reason: 'scheduled' }];
  await run();
  assert.equal(countScene(salaryId), day === 8 ? 1 : 0, `DAY${day}`);
  assert.equal(countArrival(), day === 8 ? 1 : 0);
}
assertSalaryOpening(false);
console.log('delivery night: the regular joins the next shift, or DAY8 night without one PASS');
// A legacy save that reported before reading the regular (old DAY2 flow).
const reportCheckpoint = { chapter: 1, day: 2, slot: 2, money: 14000, stamina: 60,
  flags: { _errand_scout_done: true, _c_station_registered: true, _morning_2: true, ...completed, _delivery_report_done: true },
  story: {}, met: {}, visitedDay: {}, stats: {}, inbox: [], deferredNightEvents: [], restDay: null };

reset({ flags: { _delivery_minto_told: true, _delivery_adam_told: true } });
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 0); assert.equal(countArrival(), 0);
assert.equal(state.flags._delivery_minto_done && state.flags._delivery_adam_done, true, 'Legacy deliveries finish on the way home');
assert.equal(state.money, 14000); assert.equal(actionEnds, 2);
console.log('delivery night: legacy non-batch deliveries on the way home, regular waits PASS');

reset(); replaceState(structuredClone(reportCheckpoint));
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 0); assert.equal(countArrival(), 0);
assert.equal(state.money, 14000); assert.equal(actionEnds, 0);
const finished = structuredClone(state);
replaceState(structuredClone(finished)); calls.length = 0;
await calendar.namespace.runDaily({ untilDay: finished.day, nightEvents: events });
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 0);
assert.deepEqual(state, finished);
console.log('delivery night: real saved report and completed-event checkpoints do not replay PASS');

reset({ day: 8, slot: 2, flags: completed, money: 14000, stamina: 60 });
state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 2, reason: 'rest' }];
await run();
assert.equal(countScene(reportId), 1); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 0);
assert.equal(state.money, 14000); assert.equal(actionEnds, 0); assert.equal(state.flags._night_event_day, '1:8');
assertSalaryOpening(true);
console.log('delivery night: delayed report joins the actual deferred night plan PASS');

reset({ day: 8, slot: 2, flags: { ...completed, _private_night_day: 8 }, money: 14000, stamina: 60 });
state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 1, reason: 'scheduled' }];
await run();
assert.equal(countScene(reportId), 1); assert.equal(countScene(salaryId), 0);
assert.equal(state.deferredNightEvents.length, 1, 'Booked night must preserve the deferred customer event');
state.slot = 2; state.flags._morning_9 = true; calls.length = 0;
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 1);
assertSalaryOpening(false);
console.log('delivery night: same-visit cue never persists into the following day PASS');

reset({ day: 8, slot: 2, flags: completed, money: 14000, stamina: 60 });
state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 1, reason: 'scheduled' }];
await run({ 2: { ...salary, pin: 'c_station' } });
assert.equal(countScene(reportId), 1); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 1);
assertSalaryOpening(false);
console.log('delivery night: a different destination keeps its arrival PASS');

for (const mode of ['cancel', 'load']) {
  reset({ slot: 2, flags: completed, money: 14000, stamina: 60 }); reportMode = mode;
  const old = state;
  await run();
  assert.equal(countScene(salaryId), 0); assert.equal(countArrival(), 0);
  assert.equal(state.flags._delivery_report_done, undefined);
  assert.equal(old.flags._delivery_report_done, undefined);
  assert.equal(state.day, 2); assert.equal(state.slot, 2);
  assert.equal(state.money, mode === 'load' ? 4321 : 14000); assert.equal(actionEnds, 0);
  console.log(`delivery night: report ${mode} cannot finish the old day PASS`);
}

reset({ stamina: 15 });
await run();
// #2213 B01・#3819: the free deliveries cost no stamina, and DAY2 has no mandatory shift to warn about.
assert.deepEqual(calls.filter(x => x.type === 'stamina-warning'), [], 'No forced action warns on DAY2');
assert.deepEqual(calls.filter(x => x.type === 'shift'), [], 'No fixed shift on DAY2');
assert.equal(state.flags._delivery_minto_done && state.flags._delivery_adam_done, true, 'Both deliveries still finish');
assert.equal(state.stamina, 29, 'Deliveries spend no stamina (15 + 14 from sleep)');
console.log('delivery night: red stamina on DAY2 has no forced shift, deliveries still finish PASS');

for (const afterClose of [false, true]) {
  reset({ slot: afterClose ? 2 : 0, flags: { ...completed, _delivery_report_done: true }, stamina: 15 });
  state.pendingInvite = { event: 'test_invitation', sender: 'minto', day: state.day, slot: afterClose ? 1 : 0,
    afterClose, queuedAfterClose: afterClose };
  await run({});
  assert.equal(calls.filter(x => x.type === 'stamina-warning').length, 1);
  assert.equal(calls.filter(x => x.type === 'rescheduled').length, 1);
  assert.equal(state.pendingInvite, null);
  assert.equal(coldDraws, 0, 'Declining an invitation does not draw for illness');
  assert.equal(countScene('test_invitation'), 0);
}
console.log('delivery night: declined daytime and after-close invitations reschedule without illness draw PASS');
