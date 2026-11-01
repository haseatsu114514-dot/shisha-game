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
let coldDraws = 0;
const noop = () => {}, asyncNoop = async () => {};
const unexpected = async () => { throw new Error('Unexpected unrelated chapter event'); };
const spots = { minto: { id: 'minto' }, adam: { id: 'adam' }, c_station: { id: 'c_station' } };
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
  chapterDay: () => state.day, daysLeft: () => 14 - state.day, TOURNAMENT_DAY: 14,
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
    calls.push({ type: 'map', pin: opts.guide?.pin }); return opts.guide?.pin || 'rest';
  },
  spotById: id => spots[id] || { id, kind: 'rest', stamina: 0 },
  visitChar: async id => { state.story[id] = (state.story[id] || 0) + 1; calls.push({ type: 'visit', id }); },
  visitSpot: async () => { state.flags._c_station_registered = true; },
  storyCount: id => state.story[id] || 0, isClosed: () => false, isUnlocked: () => true,
  markMet: id => state.met[id] = true, onAction: () => actionEnds++,
  runHomeShisha: async () => false, maybeConfession: async () => false, unreadCount: () => 0,
  completeInvitation: () => { state.pendingInvite = null; },
  invitationCost: () => 0, invitationGrowth: () => ({}), isFriendEvent: () => false,
  isFinaleEvent: () => false, CHAR_STAT: {}, storeInvitationSpot: () => false,
  openingStatus: () => ({ ok: true }), VISIT_BG: {}, currentCondition: () => ({ health: 'green' }),
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

reset();
await run();
assert.equal(countScene(reportId), 1);
assert.equal(countScene(salaryId), 1, 'Existing customer conversation was lost');
assert.equal(countArrival(), 0, 'Report and DAY2 night plan narrated two consecutive arrivals');
assert(calls.findIndex(x => x.id === reportId) < calls.findIndex(x => x.id === salaryId));
assert.equal(state.flags._ev_salaryman, true);
assert.equal(state.flags._night_event_day, '1:2');
assert.equal(state.deferredNightEvents.length, 0);
assert.equal(calls.filter(x => x.type === 'hiyori').length,
  Number(originalSalary.lines.some(line => line.speaker === 'sumi')));
assertSalaryOpening(true);
assert.equal(state.money, 14000); assert.equal(state.stamina, 74); assert.equal(actionEnds, 2);
assert.equal(state.day, 3); assert.equal(state.slot, 0);
const reportCheckpoint = structuredClone(saves.find(s => s.flags._delivery_report_done && !s.flags._ev_salaryman));
assert(reportCheckpoint, 'Report must have a checkpoint before the night conversation');
console.log('delivery night: fresh DAY2 joins report and actual customer event PASS');

reset({ flags: { _delivery_minto_told: true, _delivery_adam_told: true } });
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 1);
assert.equal(state.money, 14000); assert.equal(actionEnds, 2);
assertSalaryOpening(false);
console.log('delivery night: legacy non-batch arrival retained PASS');

reset(); replaceState(structuredClone(reportCheckpoint));
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 1);
assert.equal(state.money, 14000); assert.equal(actionEnds, 0);
assertSalaryOpening(false);
const finished = structuredClone(state);
replaceState(structuredClone(finished)); calls.length = 0;
await calendar.namespace.runDaily({ untilDay: finished.day, nightEvents: events });
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 0);
assert.deepEqual(state, finished);
console.log('delivery night: real saved report and completed-event checkpoints do not replay PASS');

reset({ day: 3, slot: 2, flags: completed, money: 14000, stamina: 60 });
state.deferredNightEvents = [{ id: salary.id, chapter: 1, originalDay: 2, deferredOn: 2, reason: 'rest' }];
await run();
assert.equal(countScene(reportId), 1); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 0);
assert.equal(state.money, 14000); assert.equal(actionEnds, 0); assert.equal(state.flags._night_event_day, '1:3');
assertSalaryOpening(true);
console.log('delivery night: delayed report joins the actual deferred night plan PASS');

reset({ slot: 2, flags: { ...completed, _private_night_day: 2 }, money: 14000, stamina: 60 });
await run();
assert.equal(countScene(reportId), 1); assert.equal(countScene(salaryId), 0);
assert.equal(state.deferredNightEvents.length, 1, 'Booked night must preserve the deferred customer event');
state.slot = 2; state.flags._morning_3 = true; calls.length = 0;
await run();
assert.equal(countScene(reportId), 0); assert.equal(countScene(salaryId), 1); assert.equal(countArrival(), 1);
assertSalaryOpening(false);
console.log('delivery night: same-visit cue never persists into the following day PASS');

reset({ slot: 2, flags: completed, money: 14000, stamina: 60 });
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
const deliveryWarnings = calls.filter(x => x.type === 'stamina-warning');
assert.equal(deliveryWarnings.length, 2, 'Each mandatory delivery warns before spending stamina');
assert(deliveryWarnings.every(x => x.options.length === 1 && x.options[0].value === true));
assert.equal(actionEnds, 2, 'Both deliveries still finish');
assert.equal(coldDraws, 2, 'Mandatory deliveries still receive the normal cold-risk draw');
console.log('delivery night: red stamina warns without cancelling deliveries or cold draws PASS');

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
