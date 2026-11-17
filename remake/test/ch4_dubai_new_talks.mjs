// Existing Dubai revisit progress drives the map marker. No new save keys or dialogue.
// node --experimental-vm-modules remake/test/ch4_dubai_new_talks.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/chapters/ch4-dubai-daily.js', import.meta.url), 'utf8');
const state = { chapter: 4, day: 50, slot: 0, flags: {} };
const DB = { dialogues: {} };
const pools = {
  souq: ['ch4_dubai_souq_revisit', 'ch4_souq_talk_b', 'ch4_souq_talk_c', 'ch4_souq_talk_d', 'ch4_souq_talk_e', 'ch4_souq_talk_f', 'ch4_souq_talk_g'],
  festa: ['ch4_festa_revisit', 'ch4_festa_talk_b', 'ch4_festa_talk_c', 'ch4_festa_talk_d'],
  center_cafe: ['ch4_dubai_cafe_revisit', 'ch4_cafe_talk_b', 'ch4_cafe_culture_hose', 'ch4_cafe_talk_c', 'ch4_cafe_culture_coffee', 'ch4_cafe_talk_d', 'ch4_cafe_talk_e', 'ch4_cafe_talk_f'],
  alley_cafe: ['ch4_alley_cafe_quiet', 'ch4_alley_culture_clay', 'ch4_alley_talk_c', 'ch4_alley_culture_majlis', 'ch4_alley_talk_d', 'ch4_alley_talk_e', 'ch4_alley_talk_f'],
};
const first = {
  souq: ['ch4_dubai_souq', 'ch4_stranger_first'], festa: ['ch4_festa'],
  center_cafe: ['ch4_dubai_cafe'], alley_cafe: ['ch4_stranger_second'],
};
for (const id of Object.values(pools).flat()) DB.dialogues[id] = { dialogue_id: id, lines: [{ text: id }] };
let canReadSecond = false, cancelled = false;
const played = [];
const context = vm.createContext({ console });
const module = new vm.SourceTextModule(source, { context });
const overrides = {
  state, DB, layers: { hud: { firstElementChild: null } }, CH4_PLACE_BG: {}, CH4_SCENE_BG: {}, CH4_FREE_SCENE_IDS: [],
  CAFE_PLACES: [], CAFE_TASTE_IDS: [], NIGHT_SCENE_IDS: [], STALL_SCENE_IDS: [],
  INN_TRIAL_IDS: [], REHEARSAL_IDS: [], LONGLONG_IDS: [],
  CH4_DAILY_EVE_DAY: 13,
  chapterFourProgress: value => value.flags._ch4,
  chapterFourSecondAvailable: () => canReadSecond,
  syncChapterFourDay() {},
  camelDailySpot: () => null, desertDailySpots: () => [], canReflect: () => false,
  dubaiSpotAt: entry => entry, nightVisit: () => null,
  spendableMoney: () => 100000, stallChoices: () => [],
  setBg: async () => {}, bgUrl: id => id,
  play: async dialogue => { played.push(dialogue.dialogue_id); return { cancelled }; },
};
const bindings = new Map();
for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
  bindings.set(match[2], match[1].split(',').map(name => name.trim()).filter(Boolean));
}
await module.link(specifier => {
  const names = bindings.get(specifier);
  return new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, name in overrides ? overrides[name] : () => {});
  }, { context });
});
await module.evaluate();
const { CH4_DUBAI_SPOTS, chapterFourDubaiSpots, chapterFourDubaiDefinition } = module.namespace;
const spot = place => CH4_DUBAI_SPOTS.find(entry => entry.place === place);
function reset() {
  state.flags = { _ch4: { startDay: 49, read: {} } };
  canReadSecond = false; cancelled = false; played.length = 0;
}
const io = { readAndCommit: async id => {
  if (cancelled) return false;
  state.flags._ch4.read[id] = true;
  return true;
} };
const perform = entry => chapterFourDubaiDefinition(io).performSpot(entry, { staminaGuard: async () => true });

for (const [place, ids] of Object.entries(pools)) {
  reset();
  canReadSecond = true;
  const entry = spot(place);
  assert.equal(entry.hasNew(), true, `${place}: initial visit`);
  for (const id of first[place]) state.flags._ch4.read[id] = true;
  assert.equal(entry.hasNew(), true, `${place}: revisit remains after initial scene`);
  for (let index = 0; index < ids.length; index++) {
    assert.equal(entry.hasNew(), true, `${place}: revisit ${index + 1} is new`);
    await perform(entry);
    assert.equal(played.at(-1), ids[index], `${place}: marker matches the next actual scene`);
    assert.equal(state.flags._ch4_dubai_talks[place], index + 1);
  }
  assert.equal(entry.hasNew(), false, `${place}: exhausted pool has no permanent marker`);
  await perform(entry);
  assert.equal(played.at(-1), ids[0], `${place}: normal repeat rotation is unchanged`);
  assert.equal(entry.hasNew(), false, `${place}: repeat is not new`);
  // SAVE/LOAD retains the existing visit counts without introducing another read ledger.
  state.flags = JSON.parse(JSON.stringify(state.flags));
  assert.equal(entry.hasNew(), false, `${place}: loaded completed rotation`);
}
reset();
assert(!chapterFourDubaiSpots().some(entry => entry.place === 'alley_cafe'), 'alley remains hidden until the appointment is available');
canReadSecond = true;
assert(chapterFourDubaiSpots().some(entry => entry.place === 'alley_cafe'), 'available appointment retains its marker');
for (const id of first.souq) state.flags._ch4.read[id] = true;
cancelled = true;
await perform(spot('souq'));
assert.equal(state.flags._ch4_dubai_talks, undefined, 'cancelled scene does not consume a revisit');
assert.equal(spot('souq').hasNew(), true, 'cancelled scene remains new');
cancelled = false;
await perform(spot('souq'));
state.flags = JSON.parse(JSON.stringify(state.flags));
assert.equal(spot('souq').hasNew(), true, 'partially read pool survives SAVE/LOAD');
// 最後の1本だけ残った状態で、その台本が読めなければ新着にしない（#3097 でスークの巡回は7本）
const lastSouq = pools.souq.at(-1);
state.flags._ch4_dubai_talks.souq = pools.souq.length - 1;
const missing = DB.dialogues[lastSouq];
delete DB.dialogues[lastSouq];
assert.equal(spot('souq').hasNew(), false, 'missing scene is excluded just as it is during a visit');
DB.dialogues[lastSouq] = missing;
assert.equal(spot('souq').hasNew(), true, 'loaded scene restores the real remaining visit');
reset();
for (const id of first.souq) state.flags._ch4.read[id] = true;
assert.equal(spot('souq').hasNew(), true, 'NG+ reset permits revisits again');
// なるとの会話の期限の夜（4-3・SPC28）: 地図で読まなかった分は 2・4・10 日目以降の夜に。先に読めば来ない。自由行動の間だけ。
{
  const { dueNaruTalk, NARU_TALK_DEADLINES } = module.namespace;
  const naru = ['ch4_naru_dubai_1', 'ch4_naru_dubai_2', 'ch4_naru_dubai_3'];
  for (const id of naru) DB.dialogues[id] = { dialogue_id: id, lines: [{ text: id }] };
  assert.deepEqual([...NARU_TALK_DEADLINES], [2, 4, 10]);
  const at = (day, count = 0, part = 'free') => ({ flags: { _ch4: { part, day, read: {} }, _ch4_dubai_talks: { naru: count } } });
  assert.equal(dueNaruTalk(at(1)), null, 'not on DAY1');
  assert.equal(dueNaruTalk(at(2)), naru[0], 'DAY2: the first talk');
  assert.equal(dueNaruTalk(at(3, 1)), null, 'the second waits for DAY4');
  assert.equal(dueNaruTalk(at(4, 1)), naru[1]);
  assert.equal(dueNaruTalk(at(9, 2)), null, 'the third waits for DAY10');
  assert.equal(dueNaruTalk(at(11, 2)), naru[2], 'a later night still brings it');
  assert.equal(dueNaruTalk(at(12, 3)), null, 'all read on the map: nothing more');
  assert.equal(dueNaruTalk(at(4, 0)), naru[0], 'one at a time, in order');
  assert.equal(dueNaruTalk(at(13, 0, 'eve')), null, 'not on the eve');
  // 夜の出来事として出る（期限の出会いが無い夜）。読むと巡回の回数が進み、地図の「なると会う」の残りと同じになる。
  state.flags = { _ch4: { startDay: 49, part: 'free', day: 2, read: { ch4_festa: true, ch4_stranger_first: true, ch4_stranger_second: true } } };
  const events = chapterFourDubaiDefinition(io).nightEvents;
  const night = Object.values(events)[0];
  assert.equal(night?.id, 'dubai-naru:ch4_naru_dubai_1');
  played.length = 0;
  await night.run();
  assert.deepEqual(played, ['ch4_naru_dubai_1']);
  assert.equal(state.flags._ch4_dubai_talks.naru, 1);
  assert.equal(night.done(), true);
}
console.log('PASS Dubai new-talk markers: four pools, actual visits, completion, repeat, interruption, load, missing scripts and reset');
