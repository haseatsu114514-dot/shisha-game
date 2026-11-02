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
  ['remake/js/core/chapter-clock.js', fixed({ chapterDay: s => local(s.day), atChapterFinalDay: s => local(s.day) >= 14 })],
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

// 固定（前後すると成立しない転機）と後送り可能（会話）と、地図の店で読む本編（visit・VOL13）の切り分け
const deferrable = CH2_NIGHTS.filter(n => n.schedule === 'preparation').map(n => n.day);
assert.deepEqual([...deferrable], [6]);
const visits = CH2_NIGHTS.filter(n => n.schedule === 'visit');
assert.deepEqual(JSON.parse(JSON.stringify(visits.map(n => [n.day, n.charId, n.deadline]))), [[7, 'adam', 12], [12, 'minto', 12]]);
assert.deepEqual([...visits.find(n => n.charId === 'minto').slots], [1], '正本どおり、みんとは夜の来店で読む');
for (const n of CH2_NIGHTS.filter(n => n.schedule === 'preparation' || n.schedule === 'visit')) {
  assert(n.deadline >= n.day && n.deadline < 13, `DAY${n.day} must be read before the eve`);
  assert(!CH2_FREE_NIGHTS.includes(n.deadline), `DAY${n.day} deadline must not fall on a free night`);
}
const forced = CH2_NIGHTS.filter(n => n.schedule !== 'visit').map(n => n.day);
assert.deepEqual([...forced], [3, 4, 5, 6, 9, 10, 11, 13], '必ず読む夜は8夜');
assert.deepEqual([...CH2_FREE_NIGHTS], [2, 8]);
assert(!CH2_NIGHTS.some(n => CH2_FREE_NIGHTS.includes(n.day)), 'DAY2・8 stay free nights');

/** 章内日 3〜13 を日送りし、夜ごとに読んだ予定（章内日）を返す。restDays は全日休養した日。visitOn は {章内日: [店]} の来店。 */
async function simulate(restDays = [], visitOn = {}) {
  state = { chapter: 2, day: abs(3), slot: 0, phase: 'daily', flags: { _ch2_day1: { startDay: START } }, deferredNightEvents: [] };
  statePort.setExport('state', state); played = [];
  const events = story.namespace.chapterTwoNights(START);
  const log = {};
  for (let day = 3; day <= 13; day++) {
    state.day = abs(day);
    state.restDay = restDays.includes(day) ? { chapter: 2, day: state.day, fullDay: true } : null;
    nights.namespace.syncNightQueue(events);
    for (const [slot, charId] of (visitOn[day] || []).entries()) {
      state.slot = slot;
      const night = story.namespace.storyVisitDue(state, charId);
      if (night) assert.equal(await story.namespace.readStoryVisit(night, { read: async id => { played.push(id); return true; }, bg: 'shop' }), true);
    }
    state.slot = 2;
    const ran = [];
    await nights.namespace.runNightPlan(events, async ev => { ran.push(Number(ev.id.replace('remake_ch2_night_', ''))); });
    log[day] = ran;
    state.slot = 0;
  }
  for (const ev of Object.values(events)) assert(ev.done(), `${ev.id} must be read before the tournament`);
  assert.equal(state.deferredNightEvents.length, 0, 'Nothing is carried past the eve');
  return log;
}

// 一度も店へ行かなければ、固定の夜は従来どおり。アダムとみんとはDAY12の夜に救済（アダム→みんとの順）
const normal = await simulate();
for (const n of CH2_NIGHTS.filter(n => n.schedule !== 'visit')) assert.deepEqual(normal[n.day], [n.day], `DAY${n.day}`);
assert.deepEqual(normal[7], [], 'The EDEN visit does not take the DAY7 night');
assert.deepEqual(normal[8], []);
assert.deepEqual(normal[12], [7, 12]);

// 店へ行けば夜は空く: DAY9昼にEDEN、DAY12夜にPEPPERMINT。強制の夜は8夜だけ
const visited = await simulate([], { 9: ['adam'], 12: [null, 'minto'] });
assert.deepEqual(visited[12], []);
assert.equal(Object.values(visited).filter(ran => ran.length).length, 8);
assert.deepEqual(played.filter(id => /adam|minto|naru_window/.test(id)), ['ch2_adam_distance', 'ch2_minto_warning'],
  'DAY11の記録が無い保存では、閉じたケムリクサを足さない');

// 訪問できる日と時間帯: アダムはDAY7〜12、みんとはDAY12の夜だけ（昼は通常の来店）
state = { chapter: 2, day: abs(6), slot: 0, phase: 'daily', flags: { _ch2_day1: { startDay: START } }, deferredNightEvents: [] };
statePort.setExport('state', state);
assert.equal(story.namespace.storyVisitDue(state, 'adam'), null, 'DAY6 is before the EDEN visit');
state.day = abs(7); assert.equal(story.namespace.storyVisitDue(state, 'adam')?.day, 7);
state.day = abs(13); assert.equal(story.namespace.storyVisitDue(state, 'adam'), null, 'Past the deadline the night rescue has read it');
state.day = abs(12); assert.equal(story.namespace.storyVisitDue(state, 'minto'), null, 'PEPPERMINT by day is a usual visit');
state.slot = 1; assert.equal(story.namespace.storyVisitDue(state, 'minto')?.day, 12);
assert.equal(story.namespace.storyVisitDue({ ...state, chapter: 3 }, 'minto'), null);
assert.equal(story.namespace.storyVisitDue(state, 'naru'), null);
// 中断した訪問は既読を残さない
state.slot = 1; state.flags._ch2_naru_listened = true;
assert.equal(await story.namespace.readStoryVisit(story.namespace.storyVisitDue(state, 'minto'),
  { read: async id => id === 'ch2_minto_warning', bg: 'shop' }), false);
assert(!state.flags._ch2_read_ch2_minto_warning && !state.flags._ch2_night_12_done, 'An interrupted visit keeps nothing');
assert.equal(await story.namespace.readStoryVisit(story.namespace.storyVisitDue(state, 'minto'),
  { read: async () => true, bg: 'shop' }), true);
assert(state.flags._ch2_read_ch2_minto_warning && state.flags._ch2_read_ch2_naru_window && state.flags._ch2_night_12_done);

// DAY6を休むと、残る匂いは翌晩に救済。自由なDAY8は空けたまま
const rest6 = await simulate([6]);
assert.deepEqual(rest6[6], []);
assert.deepEqual(rest6[7], [6]);
assert.deepEqual(rest6[8], [], 'A postponed visit must not take the free DAY8 night');
assert.deepEqual([rest6[9], rest6[10], rest6[11]], [[9], [10], [11]]);
assert.deepEqual(rest6[12], [7, 12]);
assert.deepEqual(rest6[13], [13]);

// 転機の夜は休養でも動かない
const restFixed = await simulate([4, 5, 9, 10, 11, 13]);
for (const day of [4, 5, 9, 10, 11, 13]) assert.deepEqual(restFixed[day], [day], `DAY${day} is a fixed turning point`);

// DAY12を休んでも、期限の訪問は休養より優先して読む（前夜へは持ち越さない）
const rest12 = await simulate([7, 12]);
assert.deepEqual(rest12[12], [7, 12]);
assert.deepEqual(rest12[13], [13]);

// 夜の約束: 期限前の訪問の本編はその夜を塞がない。期限の夜（DAY12）は救済があるので塞ぐ
state = { chapter: 2, day: abs(6), slot: 0, phase: 'daily', flags: { _ch2_day1: { startDay: START } }, deferredNightEvents: [] };
statePort.setExport('state', state);
const booked = story.namespace.chapterTwoNights(START);
assert.equal(nights.namespace.nightOccupied(booked, abs(7)), false, 'DAY7 stays open for invitations');
assert.equal(nights.namespace.nightOccupied(booked, abs(12)), true, 'DAY12 night is the rescue');
state.day = abs(7); state.flags._private_night_day = abs(7);
nights.namespace.syncNightQueue(booked);
assert.equal(nights.namespace.nightPlan(booked).length, 0);
state.day = abs(8); delete state.flags._private_night_day;
assert.equal(nights.namespace.nightOccupied(booked, abs(8)), false, 'DAY8 stays open for TRPG and invitations');
console.log('ch2_night_pacing: ok');
