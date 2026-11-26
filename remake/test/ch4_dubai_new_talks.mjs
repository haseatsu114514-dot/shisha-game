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
  // #3097 計画 4-5: h・i は太陽との小会話
  festa: ['ch4_festa_revisit', 'ch4_festa_talk_b', 'ch4_festa_talk_c', 'ch4_festa_talk_d', 'ch4_festa_talk_e', 'ch4_festa_talk_f', 'ch4_festa_talk_g',
    'ch4_festa_talk_h', 'ch4_festa_talk_i'],
  center_cafe: ['ch4_dubai_cafe_revisit', 'ch4_cafe_talk_b', 'ch4_cafe_culture_hose', 'ch4_cafe_talk_c', 'ch4_cafe_culture_coffee', 'ch4_cafe_talk_d', 'ch4_cafe_talk_e', 'ch4_cafe_talk_f'],
  alley_cafe: ['ch4_alley_cafe_quiet', 'ch4_alley_culture_clay', 'ch4_alley_talk_c', 'ch4_alley_culture_majlis', 'ch4_alley_talk_d', 'ch4_alley_talk_e', 'ch4_alley_talk_f'],
};
const first = {
  souq: ['ch4_dubai_souq', 'ch4_stranger_first'], festa: ['ch4_festa'],
  center_cafe: ['ch4_dubai_cafe'], alley_cafe: ['ch4_stranger_second'],
};
for (const id of Object.values(pools).flat()) DB.dialogues[id] = { dialogue_id: id, lines: [{ text: id }] };
let canReadSecond = false, cancelled = false, chainDue = null;
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
  // 中心地のカフェの二択（Issue #4254）では客として吸う側を選び、それ以外のモーダルは従来どおり未選択（中止）にする
  modal: async ({ options } = {}) => options?.some(option => option.value === 'customer') ? 'customer' : undefined,
  setBg: async () => {}, bgUrl: id => id,
  play: async dialogue => { played.push(dialogue.dialogue_id); return { cancelled }; },
  // 通いの続き（#3097）。段の判定・記録は visit_chains.mjs が実物で確かめる。ここはスークの来店の分岐だけ
  chainVisitDue: async place => chainDue?.stage.place === place ? chainDue : null,
  playChainStage: async (due, read) => !!(await read(due.stage.id)),
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
// 通いの続き（#3097）: 段がある日は、スークの再訪の会話の代わりに段を読み、巡回は進めない
{
  reset();
  for (const id of first.souq) state.flags._ch4.read[id] = true;
  state.flags._ch4_dubai_talks = { souq: 3 };
  DB.dialogues.ch4_chain_spice_1 = { dialogue_id: 'ch4_chain_spice_1', lines: [{ text: 'spice' }] };
  chainDue = { id: 'ch4_spice_blend', stage: { id: 'ch4_chain_spice_1', place: 'souq' } };
  assert.equal((await perform(spot('souq')))?.used, true);
  assert.equal(played.at(-1), 'ch4_chain_spice_1', 'the chain stage replaces the souq revisit');
  assert.equal(state.flags._ch4_dubai_talks.souq, 3, 'the souq revisit rotation does not advance');
  cancelled = true;
  const before = JSON.stringify(state.flags);
  assert.notEqual((await perform(spot('souq')))?.used, true, 'a cancelled chain stage is not a visit');
  assert.equal(JSON.stringify(state.flags), before, 'a cancelled chain stage keeps nothing');
  cancelled = false; chainDue = null;
  await perform(spot('souq'));
  assert.equal(played.at(-1), pools.souq[3], 'without a stage, the next revisit');
}
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
  // #3097: 4本目からは期限の無い追加の小会話。期限の夜には来ず、地図の「なると会う」で読み、3本を読んだ後は追加の分だけを巡回する
  // #3097 計画 4-3 で 7〜10 を足した（7本目は見本①）。10本目は二桁の id なので、読み込みの一覧（DUBAI_DAILY_IDS）にも入ることを見る
  const extra = ['ch4_naru_dubai_4', 'ch4_naru_dubai_5', 'ch4_naru_dubai_6', 'ch4_naru_dubai_7', 'ch4_naru_dubai_8', 'ch4_naru_dubai_9', 'ch4_naru_dubai_10'];
  assert.deepEqual([...module.namespace.DUBAI_DAILY_IDS].filter(id => /^ch4_naru_dubai_/.test(id)), ['ch4_naru_dubai_1', 'ch4_naru_dubai_2', 'ch4_naru_dubai_3', ...extra],
    'every naru talk, including the two-digit one, is in the real load list');
  for (const id of extra) DB.dialogues[id] = { dialogue_id: id, lines: [{ text: id }] };
  assert.equal(dueNaruTalk(at(12, 3)), null, 'no deadline night for the added talks');
  state.flags = { _ch4: { startDay: 49, part: 'free', day: 11, read: {} }, _ch4_dubai_talks: { naru: 3 } };
  assert.equal(spot('naru').hasNew(), true, 'the added talks are new on the map');
  played.length = 0;
  for (let i = 0; i < extra.length + 1; i++) await perform(spot('naru'));
  assert.deepEqual(played, [...extra, extra[0]], 'added talks rotate without returning to the first (jet lag) talk');
  assert.equal(state.flags._ch4_dubai_talks.naru, 3 + extra.length + 1);
  assert.equal(spot('naru').hasNew(), false);
}
console.log('PASS Dubai new-talk markers: four pools, actual visits, completion, repeat, interruption, load, missing scripts and reset');
