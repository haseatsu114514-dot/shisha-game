// #1652: 第2章の夜の予定を実際の ch2-story / night-events で日送りする。
// 転機の夜は固定のまま、訪問・会話の夜だけが休養で後送りされ、DAY2・8の自由な夜と大会前の期限を守ることを確かめる。
// node --experimental-vm-modules remake/test/ch2_night_pacing.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const context = vm.createContext({});
const START = 15, abs = day => START + day - 1, local = day => day - START + 1;
let state, played;
const statePort = new vm.SyntheticModule(['state', 'save', 'markMet'], function () {
  this.setExport('state', state); this.setExport('save', () => {}); this.setExport('markMet', () => {});
}, { context });
function fixed(values) {
  const names = Object.keys(values);
  return new vm.SyntheticModule(names, function () { for (const n of names) this.setExport(n, values[n]); }, { context });
}
const ports = new Map([
  ['remake/js/core/state.js', statePort],
  ['remake/js/core/data.js', fixed({ DB: { dialogues: new Proxy({}, { get: () => ({ lines: [{}] }) }) }, bgUrl: id => id })],
  ['remake/js/core/ui.js', fixed({ imageReady: async () => true, setBg: async () => {} })],
  ['remake/js/vn/engine.js', fixed({ play: async id => { played.push(id); return {}; } })],
  ['remake/js/chapters/ch2-city-data.js', fixed({ MAP: { night: 'night' }, ROOMS: {} })],
  ['remake/js/chapters/ch2-strawberry-trial.js', fixed({ grantStrawberrySample: () => {} })],
  ['remake/js/chapters/ch2-lime.js', fixed({ recordSentLime: () => false })],
  ['remake/js/core/affinity-stages.js', fixed({ AGEHA_AFFINITY_VISITS: [] })],
  ['remake/js/core/city-locations.js', fixed({ CITY_BACKGROUNDS: { c_station_night: 'c' }, CH2_SCENE_BACKGROUNDS: {} })],
  ['remake/js/core/rules.js', fixed({ TOURNAMENT_DAY: 14 })],
  ['remake/js/core/chapter-clock.js', fixed({ chapterDay: s => local(s.day) })],
]);
async function moduleAt(p) {
  if (ports.has(p)) return ports.get(p);
  assert(['remake/js/chapters/ch2-story.js', 'remake/js/chapters/ch2-story-data.js', 'remake/js/daily/night-events.js'].includes(p), p);
  const m = new vm.SourceTextModule(read(p), { context }); ports.set(p, m);
  await m.link(spec => moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(p), spec)))); return m;
}
const story = await moduleAt('remake/js/chapters/ch2-story.js'); await story.evaluate();
const nights = await moduleAt('remake/js/daily/night-events.js'); await nights.evaluate();
const { CH2_NIGHTS, CH2_FREE_NIGHTS } = (await moduleAt('remake/js/chapters/ch2-story-data.js')).namespace;

// 固定（前後すると成立しない転機）と後送り可能（訪問・会話）の切り分け
const deferrable = CH2_NIGHTS.filter(n => n.schedule === 'preparation').map(n => n.day);
assert.deepEqual([...deferrable], [6, 7, 12]);
for (const n of CH2_NIGHTS.filter(n => n.schedule === 'preparation')) {
  assert(n.deadline > n.day && n.deadline < 14, `DAY${n.day} must be read before the tournament`);
  assert(!CH2_FREE_NIGHTS.includes(n.deadline), `DAY${n.day} deadline must not fall on a free night`);
}
assert.deepEqual([...CH2_FREE_NIGHTS], [2, 8]);
assert(!CH2_NIGHTS.some(n => CH2_FREE_NIGHTS.includes(n.day)), 'DAY2・8 stay free nights');

/** 章内日 3〜13 を日送りし、夜ごとに読んだ予定（章内日）を返す。restDays は全日休養した日。 */
async function simulate(restDays = []) {
  state = { chapter: 2, day: abs(3), slot: 0, flags: {}, deferredNightEvents: [] };
  statePort.setExport('state', state); played = [];
  const events = story.namespace.chapterTwoNights(START);
  const log = {};
  for (let day = 3; day <= 13; day++) {
    state.day = abs(day);
    state.restDay = restDays.includes(day) ? { chapter: 2, day: state.day, fullDay: true } : null;
    nights.namespace.syncNightQueue(events);
    const ran = [];
    await nights.namespace.runNightPlan(events, async ev => { ran.push(Number(ev.id.replace('remake_ch2_night_', ''))); });
    log[day] = ran;
  }
  for (const ev of Object.values(events)) assert(ev.done(), `${ev.id} must be read before the tournament`);
  assert.equal(state.deferredNightEvents.length, 0, 'Nothing is carried past the eve');
  return log;
}

// 休まなければ、従来どおり各夜に一件ずつ
const normal = await simulate();
for (const n of CH2_NIGHTS) assert.deepEqual(normal[n.day], [n.day], `DAY${n.day}`);
assert.deepEqual(normal[8], []);

// DAY6を休むと、残る匂いは翌晩に救済。押し出されたアダムは自由なDAY8を避け、DAY12へ。みんとは前夜の前に読む
const rest6 = await simulate([6]);
assert.deepEqual(rest6[6], []);
assert.deepEqual(rest6[7], [6]);
assert.deepEqual(rest6[8], [], 'A postponed visit must not take the free DAY8 night');
assert.deepEqual([rest6[9], rest6[10], rest6[11]], [[9], [10], [11]]);
assert.deepEqual(rest6[12], [7]);
assert.deepEqual(rest6[13], [12, 13]);

// 転機の夜は休養でも動かない
const restFixed = await simulate([4, 5, 9, 10, 11, 13]);
for (const day of [4, 5, 9, 10, 11, 13]) assert.deepEqual(restFixed[day], [day], `DAY${day} is a fixed turning point`);

// DAY7を休むとアダムはDAY12、みんとは前夜へ。DAY12も休むと、期限のアダムは休養より優先
assert.deepEqual((await simulate([7]))[12], [7]);
const rest7and12 = await simulate([7, 12]);
assert.deepEqual(rest7and12[12], [7]);
assert.deepEqual(rest7and12[13], [12, 13]);

// 一日だけの夜の約束でも同じ順で後送りされる
state = { chapter: 2, day: abs(7), flags: { _private_night_day: abs(7) }, deferredNightEvents: [] };
statePort.setExport('state', state);
const booked = story.namespace.chapterTwoNights(START);
nights.namespace.syncNightQueue(booked);
assert.equal(nights.namespace.nightPlan(booked).length, 0, 'A booked night defers the EDEN visit');
assert.equal(state.deferredNightEvents[0]?.id, 'remake_ch2_night_7');
state.day = abs(8); delete state.flags._private_night_day;
assert.equal(nights.namespace.nightOccupied(booked, abs(8)), false, 'DAY8 stays open for TRPG and invitations');
console.log('ch2_night_pacing: ok');
