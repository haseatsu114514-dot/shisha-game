import assert from 'node:assert/strict';
import { AFFINITY_CHARACTERS, KNOWN_AT_START, FIRST_HEART_POINTS, hasAffinity, newState } from '../js/core/state.js';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  activeFortuneSight,
  grantFortuneReading,
  fortuneChoiceIndex,
  fortuneResultId,
  registerFortuneReadings,
  fortuneSightHinted,
  naruRiftActive,
  isFortuneTargetAvailable,
  fortuneTargets,
} from '../js/core/fortune-effects.js';
import { openingStatus, spotTimeNote } from '../js/daily/spot-hours.js';
import { paginate } from '../js/vn/text.js';
import { fortunePlan, syncFortune, fortuneHere, fortuneRumorHeard, FORTUNE_RUMOR_ID } from '../js/daily/fortune-schedule.js';

const triviaPath = new URL('../data/fortune-trivia.json', import.meta.url);
const trivia = JSON.parse(fs.readFileSync(triviaPath, 'utf8'));
const hints = JSON.parse(fs.readFileSync(new URL('../data/fortune-choice-hints.json', import.meta.url), 'utf8'));
const draftMd = fs.readFileSync(new URL('../../docs/qa/hud-fortune-682/trivia-draft.md', import.meta.url), 'utf8');

const cliCheck = spawnSync(
  process.execPath,
  [new URL('../../tools/check_fortune_trivia.cjs', import.meta.url).pathname, triviaPath.pathname],
  { encoding: 'utf8' }
);
assert.equal(cliCheck.status, 0, cliCheck.stderr);

// #2749 最終選定（各キャラ5本・全95本）。順序も最終コメントに合わせる。
const expectedIds = {
  adam: ['adam_23', 'adam_20', 'adam_21', 'adam_27', 'adam_25'],
  ageha: ['ageha_16', 'ageha_20', 'ageha_3', 'ageha_13', 'ageha_18'],
  da_silva: ['da_silva_15', 'da_silva_17', 'da_silva_3', 'da_silva_13', 'da_silva_16'],
  hiyori: ['hiyori_6', 'hiyori_24', 'hiyori_2', 'hiyori_26', 'hiyori_18'],
  kumicho: ['kumicho_10', 'kumicho_16', 'kumicho_2', 'kumicho_15', 'kumicho_17'],
  mashiro: ['mashiro_11', 'mashiro_14', 'mashiro_9', 'mashiro_17', 'mashiro_15'],
  master_hookah: ['master_hookah_15', 'master_hookah_19', 'master_hookah_14', 'master_hookah_16', 'master_hookah_18'],
  minto: ['minto_16', 'minto_21', 'minto_26', 'minto_4', 'minto_30'],
  naru: ['naru_25', 'naru_5', 'naru_4', 'naru_1', 'naru_9'],
  noor: ['noor_15', 'noor_18', 'noor_11', 'noor_10', 'noor_7'],
  rei: ['rei_14', 'rei_16', 'rei_21', 'rei_8', 'rei_15'],
  rio: ['rio_24', 'rio_11', 'rio_28', 'rio_25', 'rio_5'],
  saku: ['saku_15', 'saku_16', 'saku_3', 'saku_11', 'saku_14'],
  samechan: ['samechan_21', 'samechan_23', 'samechan_20', 'samechan_26', 'samechan_27'],
  sheikh: ['sheikh_13', 'sheikh_11', 'sheikh_10', 'sheikh_15', 'sheikh_5'],
  steve: ['steve_14', 'steve_16', 'steve_11', 'steve_18', 'steve_12'],
  sumi: ['sumi_2', 'sumi_24', 'sumi_9', 'sumi_22', 'sumi_11'],
  tsumugi: ['tsumugi_22', 'tsumugi_9', 'tsumugi_25', 'tsumugi_27', 'tsumugi_26'],
  volk: ['volk_14', 'volk_11', 'volk_7', 'volk_16', 'volk_13'],
};
const castIds = ['kumicho', 'rei', 'saku', 'steve', 'volk', 'mashiro', 'da_silva', 'sheikh'];
const addedIds = Object.values(expectedIds).flat().filter(id => Number(id.match(/_(\d+)$/)[1]) >= 16);
// 2026-11-07（#2805）: 占い師は相手に会ったことがないので、見た目・持ち物・私生活の具体・過去の出来事を
// 言い当てる候補（伝聞・言い切りを含む）と秘密に近い候補を削除した。欠番として残し、再利用しない。
const removed2805 = {
  sumi: [6, 7, 17, 18, 20], tsumugi: [15], naru: [2, 12, 18], adam: [2, 5, 14, 17, 19],
  minto: [2, 3, 5, 6, 10, 13, 17, 18, 19], rio: [14, 16, 17, 18, 19, 20], hiyori: [3, 16, 17, 19],
  samechan: [1, 5, 16, 17], ageha: [1, 2, 5, 8, 9, 11], kumicho: [1, 4, 5, 6, 7, 8], rei: [1, 2, 3, 5, 6, 7, 9, 10],
  saku: [1, 4, 5, 6, 7, 8, 9], steve: [2, 3, 5, 6, 7, 9], volk: [1, 2, 3, 4, 5, 8, 9, 10],
  mashiro: [1, 3, 4, 5, 6, 7, 8, 10], da_silva: [5, 6, 7, 8, 9], sheikh: [1, 2, 6, 7, 9],
  master_hookah: [1, 2, 3, 4, 5, 7, 9], noor: [1, 3, 5, 6, 9],
};
const removedIds = Object.entries(removed2805).flatMap(([char, ns]) => ns.map(n => `${char}_${n}`));
const SECRET_WORDS = /健太|田中|シガーマン|若い?衆|抗争|ファヴェーラ|スラム|軍で|15年前|レモンケーキ/;
const OLD_NAMES = /蒸野|墨田|猫柳|薄羽|汐見|宵野|緑川|綾取朔|向井玄|須井|香坂|くゆり|スハイル/;
const excludedIds = [
  ...removedIds,
  'sumi_8', 'sumi_10', 'sumi_12', 'sumi_14', 'sumi_15',
  'naru_3', 'naru_6', 'naru_7', 'naru_8', 'naru_10', 'naru_11', 'naru_13', 'naru_14',
  'adam_1', 'adam_3', 'adam_6', 'adam_7', 'adam_8', 'adam_9', 'adam_10', 'adam_11', 'adam_12', 'adam_15',
  'minto_1', 'minto_7', 'minto_8', 'minto_9', 'minto_11', 'minto_12', 'minto_14',
  'tsumugi_4', 'tsumugi_7', 'tsumugi_8', 'tsumugi_10', 'tsumugi_11', 'tsumugi_12', 'tsumugi_14',
  'rio_4', 'rio_7', 'rio_8', 'rio_9', 'rio_10', 'rio_12', 'rio_13', 'rio_15',
  'hiyori_4', 'hiyori_5', 'hiyori_7', 'hiyori_9', 'hiyori_10', 'hiyori_11', 'hiyori_12', 'hiyori_13', 'hiyori_14', 'hiyori_15',
  'samechan_4', 'samechan_7', 'samechan_8', 'samechan_10', 'samechan_11', 'samechan_12', 'samechan_13', 'samechan_14', 'samechan_15',
];

assert.equal(trivia.draft, true);
assert.equal(Object.keys(trivia.characters).length, 19);
const all = Object.values(trivia.characters).flat();
assert.deepEqual(new Set(Object.keys(trivia.characters)), new Set(AFFINITY_CHARACTERS));
assert.deepEqual(KNOWN_AT_START, ['sumi', 'tsumugi']);
const opening = newState();
for (const id of KNOWN_AT_START) { assert.equal(opening.met[id], true); assert.equal(opening.affinity[id], FIRST_HEART_POINTS); }
for (const id of ['sui', 'maezono', 'dr_kemuri', 'emil', 'mukai_master', 'uranaishi']) assert.equal(hasAffinity(id), false);
assert.equal(hasAffinity('hiyori'), true);

assert.equal(all.length, 95);
assert(Object.values(trivia.characters).every(entries => entries.length === 5));
assert.equal(new Set(all.map(x => x.id)).size, 95);
// 追加分は吹き出し1枚に収め、本名や正体を先出ししない（レヰの本名・ましろの噂の正体・組長の過去）。
for (const char of castIds) for (const entry of trivia.characters[char]) {
  for (const text of [entry.teller, entry.reaction]) {
    assert.equal(paginate(text).length, 1, `${entry.id} spills onto a second page: ${text}`);
    assert(!/。$/.test(text) && !/。）$/.test(text), `${entry.id} ends a spoken line with 。`);
    assert(!SECRET_WORDS.test(text), `${entry.id} reveals a secret: ${text}`);
  }
  assert(/^（.+）$/.test(entry.reaction), `${entry.id} reaction must be Hajime's inner voice`);
}
// 追加分も吹き出し1枚・文末に句点なし・秘密/旧名を出さない（2026-11-06 NAMES-1106）。
for (const entry of all.filter(x => addedIds.includes(x.id))) {
  for (const text of [entry.teller, entry.reaction]) {
    assert.equal(paginate(text).length, 1, `${entry.id} spills onto a second page: ${text}`);
    assert(!/。$/.test(text) && !/。）$/.test(text), `${entry.id} ends a spoken line with 。`);
    assert(!SECRET_WORDS.test(text), `${entry.id} reveals a secret: ${text}`);
    assert(!OLD_NAMES.test(text), `${entry.id} uses an old name: ${text}`);
  }
  assert(/^（.+）$/.test(entry.reaction), `${entry.id} reaction must be Hajime's inner voice`);
}
for (const ex of excludedIds) {
  assert(!all.some(x => x.id === ex), `excluded id ${ex} must not be present`);
  assert(!draftMd.includes(`\`${ex}\`:`), `excluded id ${ex} must not appear in trivia-draft.md`);
}

// 選別用の在庫（#2749・#2805）: 本編に未登録の追加候補と、全候補の系統（4系統）・AI一次選別。最終の5本はオーナーが選ぶ。
{
  const selectionPath = new URL('../data/fortune-trivia-selection.json', import.meta.url);
  const selection = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
  const check = spawnSync(process.execPath, [new URL('../../tools/check_fortune_trivia.cjs', import.meta.url).pathname, selectionPath.pathname], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const FORMS = ['性格論', '出来事の推測', '言いそうなこと', '攻略法'];
  assert.equal(selection.draft, true);
  assert.deepEqual(selection.forms, FORMS);
  assert.deepEqual(new Set(Object.keys(selection.characters)), new Set(AFFINITY_CHARACTERS));
  assert.deepEqual(new Set(Object.keys(selection.picks)), new Set(AFFINITY_CHARACTERS));
  const extraEntries = Object.values(selection.characters).flat();
  for (const entry of extraEntries) {
    const registered = all.find(x => x.id === entry.id);
    if (registered) assert.deepEqual(registered, entry, `${entry.id} differs from its selection source`);
    assert(!excludedIds.includes(entry.id), `removed id ${entry.id} must not come back`);
    for (const text of [entry.teller, entry.reaction]) {
      assert.equal(paginate(text).length, 1, `${entry.id} spills onto a second page: ${text}`);
      assert(!/。$/.test(text) && !/。）$/.test(text), `${entry.id} ends a spoken line with 。`);
      assert(!SECRET_WORDS.test(text), `${entry.id} reveals a secret: ${text}`);
      assert(!OLD_NAMES.test(text), `${entry.id} uses an old name: ${text}`);
    }
    assert(/^（.+）$/.test(entry.reaction), `${entry.id} reaction must be Hajime's inner voice`);
    // 占い師は会ったことのない相手の出来事を、伝聞や過去の言い切りで言い当てない（推測・性格の読みで語る）
    assert(!/(た|とる|てる)そうだ(よ|ね)?$|んだと$|(た|だ)ことがある/.test(entry.teller), `${entry.id} states hearsay or a past event as fact: ${entry.teller}`);
  }
  const pool = Object.fromEntries(AFFINITY_CHARACTERS.map(char => [char, [...trivia.characters[char], ...selection.characters[char]] ]));
  for (const entry of Object.values(pool).flat()) assert(selection.review[entry.id], `${entry.id} has a review entry`);
  for (const [char, entries] of Object.entries(pool)) {
    assert(entries.length >= 12, `${char}: enough rule-compliant candidates to choose the final five`);
    for (const entry of entries) {
      assert(entry.id.startsWith(`${char}_`), `${entry.id} is filed under ${char}`);
      const review = selection.review[entry.id];
      assert(FORMS.includes(review.form), `${entry.id} has one of the four forms`);
      for (const old of review.rewriteOf || []) assert(removedIds.includes(old) && old.startsWith(`${char}_`), `${entry.id} rewrites a removed candidate of ${char}: ${old}`);
    }
    for (const form of FORMS) assert(entries.some(entry => selection.review[entry.id].form === form), `${char} has a ${form} candidate`);
    const { recommended, runnersUp } = selection.picks[char];
    assert.equal(recommended.length, 5, `${char}: five AI picks`);
    assert(runnersUp.length >= 3, `${char}: runners-up remain after the five picks`);
    assert.equal(new Set([...recommended, ...runnersUp]).size, recommended.length + runnersUp.length, `${char}: picks repeat`);
    for (const id of [...recommended, ...runnersUp]) assert(selection.review[id], `${char}: pick ${id} has no review`);
    assert(recommended.some(id => selection.review[id].form === '攻略法'), `${char}: the AI picks include an advice reading`);
  }
}

for (const [char, entries] of Object.entries(trivia.characters)) {
  assert.deepEqual(entries.map(x => x.id), expectedIds[char], `IDs mismatch for ${char}`);
  assert(entries.every(x => x.teller && x.reaction));
  for (const entry of entries) {
    if (draftMd.includes(`\`${entry.id}\`:`)) {
      assert(draftMd.includes(entry.teller), `draft doc missing teller for ${entry.id}`);
      assert(draftMd.includes(entry.reaction), `draft doc missing reaction for ${entry.id}`);
    }
  }
  const count = entries.length;
  let s = { chapter: 1, day: 3, seed: 131, flags: {}, fortune: null };
  const beforeSeed = s.seed;
  const cycle1 = [];
  for (let i = 0; i < count; i++) {
    if (i === Math.floor(count / 2)) s = JSON.parse(JSON.stringify(s)); // mid-cycle save/load
    cycle1.push(grantFortuneReading(s, char, trivia).id);
  }
  assert.equal(new Set(cycle1).size, count, `${char}: repeat before all ${count} have been read in cycle 1`);
  assert.deepEqual([...cycle1].sort(), [...expectedIds[char]].sort());
  const cycle2 = [];
  for (let i = 0; i < count; i++) {
    cycle2.push(grantFortuneReading(s, char, trivia).id);
  }
  assert.equal(new Set(cycle2).size, count, `${char}: repeat before all ${count} have been read in cycle 2`);
  assert.equal(s.seed, beforeSeed, 'fortune advances gameplay RNG');
  // 本編の読みが0本の相手（#2805 で王煙楼の5本がすべて決定ルールに反した）は、オーナーの選定後の登録まで結果の台詞だけで終わる。
  if (!count) {
    assert.equal(char, 'master_hookah', `${char} lost every reading`);
    assert.equal(grantFortuneReading(s, char, trivia), null);
    assert.equal(s.fortune.char, char, 'the affinity bonus is still promised without a reading');
  }
  assert.equal(activeFortuneSight(s).char, char);
  s.fortune = null;
  assert(activeFortuneSight(s), 'one-visit affinity consumption removed three-day sight');
  for (const day of [3, 4, 5]) { s.day = day; assert(activeFortuneSight(JSON.parse(JSON.stringify(s)))); }
  s.day = 6; assert.equal(activeFortuneSight(s), null);
  s.day = 2; assert.equal(activeFortuneSight(s), null);
  s.day = 3; s.chapter = 2; assert.equal(activeFortuneSight(s), null);
}

// Legacy 5-bit mask migration: 0, partial with deleted IDs, and 31 (all 5 legacy items read).
{
  const maskZero = { chapter: 1, day: 3, seed: 19, flags: { _fortune_trivia_seen_adam: 0 }, fortune: null };
  const seenZero = Array.from({ length: expectedIds.adam.length }, () => grantFortuneReading(maskZero, 'adam', trivia).id);
  assert.equal(new Set(seenZero).size, expectedIds.adam.length);

  // 旧ビットで既読のなるの1・4・5番は、新しい5本プールでも既読として扱う。
  const maskPartial = { chapter: 1, day: 3, seed: 19, flags: { _fortune_trivia_seen_naru: 0b11111 }, fortune: null };
  const restNaru = Array.from({ length: expectedIds.naru.length - 3 }, () => grantFortuneReading(maskPartial, 'naru', trivia).id);
  assert.deepEqual([...restNaru].sort(), expectedIds.naru.filter(id => !['naru_1', 'naru_4', 'naru_5'].includes(id)).sort());

  // When legacy mask is 31, surviving old IDs (1..5) stay seen while newly added IDs are drawn first.
  const mask31 = { chapter: 1, day: 3, seed: 23, flags: { _fortune_trivia_seen_naru: 31 }, fortune: null };
  const legacyNaru = ['naru_1', 'naru_4', 'naru_5']; // naru_2 は #2805 で削除
  const unseenNaru = expectedIds.naru.filter(id => !legacyNaru.includes(id));
  const newNaru = Array.from({ length: unseenNaru.length }, () => grantFortuneReading(mask31, 'naru', trivia).id);
  assert.deepEqual([...newNaru].sort(), [...unseenNaru].sort());
  const nextCycleNaru = Array.from({ length: expectedIds.naru.length }, () => grantFortuneReading(mask31, 'naru', trivia).id);
  assert.equal(new Set(nextCycleNaru).size, expectedIds.naru.length);

  // Deleted IDs in array history and reordered entries array are handled by entry ID, not index.
  const reordered = {
    characters: {
      adam: [...trivia.characters.adam].reverse(),
    },
  };
  const withDeletedHistory = {
    chapter: 1,
    day: 3,
    seed: 7,
    // 削除済みIDは無視し、残る adam_20 だけを既読として扱う。
    flags: { _fortune_trivia_seen_adam: ['adam_1', 'adam_3', 'adam_11', 'adam_2', 'adam_14', 'adam_20'] },
    fortune: null,
  };
  const unseenAdam = expectedIds.adam.filter(id => id !== 'adam_20');
  const remainingReordered = Array.from({ length: unseenAdam.length }, () => grantFortuneReading(withDeletedHistory, 'adam', reordered).id);
  assert.deepEqual([...remainingReordered].sort(), [...unseenAdam].sort());

  // Character independence: reading sumi does not alter rio's unseen pool.
  const indep = { chapter: 1, day: 3, seed: 11, flags: {}, fortune: null };
  grantFortuneReading(indep, 'sumi', trivia);
  grantFortuneReading(indep, 'rio', trivia);
  assert.equal(indep.flags._fortune_trivia_seen_sumi.length, 1);
  assert.equal(indep.flags._fortune_trivia_seen_rio.length, 1);
}

// Naru rift state exclusion: tied to actual rift flags in Ch2+, not raw calendar day.
{
  const characters = { naru: {}, adam: {}, minto: {}, samechan: {} };
  const baseCh2 = {
    chapter: 2,
    day: 27, // Even on Ch2 Day 13, if confrontation has not occurred, Naru is not excluded by date alone.
    seed: 5,
    flags: { _ch2_day1: { startDay: 15 } },
    met: { naru: true, adam: true, samechan: true },
    affinity: { naru: 30, adam: 20, samechan: 15 },
    fortune: null,
  };
  assert.equal(naruRiftActive(baseCh2), false);
  assert.equal(isFortuneTargetAvailable(baseCh2, 'naru'), true);
  assert.deepEqual(fortuneTargets(baseCh2, characters), ['naru', 'adam', 'samechan']);
  // 名簿外の人物は旧セーブに好感度が残っていても選べない。
  {
    const withTeller = JSON.parse(JSON.stringify(baseCh2));
    withTeller.met.uranaishi = true; withTeller.affinity.uranaishi = 1;
    withTeller.met.mukai_master = true; withTeller.affinity.mukai_master = 20;
    assert.deepEqual(fortuneTargets(withTeller, { ...characters, uranaishi: {}, mukai_master: {} }), ['naru', 'adam', 'samechan']);
    assert.equal(grantFortuneReading(withTeller, 'uranaishi', trivia), null);
  }
  assert(grantFortuneReading(baseCh2, 'naru', trivia));
  assert.equal(activeFortuneSight(baseCh2)?.char, 'naru');

  for (const flag of ['_ch2_read_ch2_naru_confrontation', '_ch2_night_11_done', '_ch2_naru_listened', '_ch2_naru_hurt']) {
    const rifted = JSON.parse(JSON.stringify(baseCh2));
    rifted.flags[flag] = true;
    assert.equal(naruRiftActive(rifted), true, flag);
    assert.equal(isFortuneTargetAvailable(rifted, 'naru'), false, flag);
    assert.deepEqual(fortuneTargets(rifted, characters), ['adam', 'samechan'], flag);
    assert.equal(activeFortuneSight(rifted), null, `sight should not remain active for naru under ${flag}`);
    const prevFlags = JSON.stringify(rifted.flags);
    assert.equal(grantFortuneReading(rifted, 'naru', trivia), null, flag);
    assert.equal(JSON.stringify(rifted.flags), prevFlags, 'blocked reading mutated flags');
  }
}

const border = { chapter: 1, day: 13, seed: 1, flags: {} };
grantFortuneReading(border, 'naru', trivia);
border.chapter = 2; border.day = 15; border.flags._ch2_day1 = { startDay: 15 };
assert(activeFortuneSight(border), 'chapter transition prematurely expires sight');
border.day = 16; assert.equal(activeFortuneSight(border), null);

const save = { chapter: 1, day: 3, seed: 1, flags: {}, money: 90000 };
grantFortuneReading(save, 'naru', trivia);
const line = { id: 'naru_first_scout', choices: [{ next: 'scout_honest' }, { next: 'scout_bluff' }] };
assert.equal(fortuneChoiceIndex(save, 'ch1_naru_first', line, hints), 0);
assert.equal(fortuneChoiceIndex({ ...save, day: 5 }, 'ch1_naru_first', line, hints), 0);
assert.equal(fortuneChoiceIndex({ ...save, day: 6 }, 'ch1_naru_first', line, hints), -1);
assert.equal(fortuneChoiceIndex(save, 'other_dialogue', line, hints), -1);
assert.equal(fortuneChoiceIndex(save, 'ch1_naru_first', { ...line, choices: [...line.choices, {}] }, hints), -1);
assert.equal(fortuneChoiceIndex(save, 'ch1_naru_first', { ...line, choices: [...line.choices].reverse() }, hints), -1, 'stale annotations should not label a changed choice');
const before = JSON.stringify(save);
fortuneChoiceIndex(save, 'ch1_naru_first', line, hints);
assert.equal(JSON.stringify(save), before);
grantFortuneReading(save, 'rio', trivia);
assert.equal(fortuneChoiceIndex(save, 'ch1_naru_first', line, hints), -1);
const romance = { id: 'bond_q1_rio', choices: [{ next: 'personal' }, { next: 'work' }] };
assert.equal(fortuneChoiceIndex(save, 'ch1_rio_bond_question', romance, { ...hints, includeRomance: false }), -1);
assert.equal(fortuneChoiceIndex(save, 'ch1_rio_bond_question', romance, { ...hints, includeRomance: true }), 0);
// ましろの♥3の質問も他のヒロインと同じ恋愛の注記。恋愛の表示が切られている間は示さない。
{
  const mashiroSave = { chapter: 3, day: 20, seed: 1, flags: {}, money: 90000 };
  grantFortuneReading(mashiroSave, 'mashiro', trivia);
  const q = { id: 'bond_q1_mashiro', choices: [{ next: 'personal' }, { next: 'work' }] };
  assert.equal(fortuneChoiceIndex(mashiroSave, 'ch3_mashiro_bond_question', q, hints), -1);
  assert.equal(fortuneChoiceIndex(mashiroSave, 'ch3_mashiro_bond_question', q, { ...hints, includeRomance: true }), 0);
  assert.equal(fortuneChoiceIndex(save, 'ch3_mashiro_bond_question', q, { ...hints, includeRomance: true }), -1, 'another target must not light the Mashiro choice');
}
assert.equal(activeFortuneSight({ chapter: 1, day: 3, flags: { _fortune_choice_sight: { char: 'naru', chapter: 1, from: 3, until: 999 } } }), null);

const base = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/remake_ch1.json', import.meta.url))).dialogues;
const db = { dialogues: Object.fromEntries(base.map(d => [d.dialogue_id, d])), fortuneTrivia: trivia, fortuneHints: hints };
registerFortuneReadings(db);
// 三日間の「赤く見える」は、選択肢の注記で光りうる相手にだけ約束する（恋愛の注記は表示が切られている間は数えない）。
const sightLine = d => d.lines.some(l => /赤く見える/.test(l.text || ''));
// 第2〜5章の場面の注記で、レヰ・サメちゃん・ましろも加わった（#2704）。
const hinted = new Set(['ageha', 'mashiro', 'minto', 'naru', 'rei', 'rio', 'samechan', 'sumi', 'tsumugi']);
// 判定は注記があるかだけで、章や既読は見ない。凛想の注記は初対面の ch1_rio_first の中、スミさんは第1章DAY5の場面だけなので、
// 第2章以降や初対面の後は、約束しても光らないことがある（既知の限界。#2704 のPR本文の「残り」に記載）。
for (const char of Object.keys(trivia.characters)) assert.equal(fortuneSightHinted(char, hints), hinted.has(char), `${char} sight hint`);
for (const entry of all) {
  const d = db.dialogues[fortuneResultId(entry)];
  assert(d);
  assert(d.lines.some(l => l.text === entry.teller));
  assert(d.lines.some(l => l.type === 'motion' && l.id === 'tarot'));
  const char = Object.keys(trivia.characters).find(id => trivia.characters[id].includes(entry));
  assert.equal(sightLine(d), hinted.has(char), `${entry.id}: the three-day sight is promised only when ${char} has a usable choice hint`);
  if (!hinted.has(char)) assert.equal(d.lines.length, base.find(x => x.dialogue_id === 'remake_fortune_result').lines.length + 1, `${entry.id} keeps the rest of the reading`);
}
// ひよりの注記は恋愛の質問だけなので、恋愛の注記を表示する時だけ数える。
assert.equal(fortuneSightHinted('hiyori', hints), false);
assert.equal(fortuneSightHinted('hiyori', { ...hints, includeRomance: true }), true, 'romance hints count once romance hints are shown');
// 相手を選ぶ前の説明は、注記の無い相手にも聞こえるので「相手によっては」と言い、全員には約束しない。
const offerTexts = db.dialogues.remake_fortune_offer.lines.map(l => l.text || '');
assert(offerTexts.some(t => t.includes('相手によっては三日間')), 'the offer says the sight works only for some targets');
assert(!offerTexts.some(t => t.includes('それと三日間')), 'the offer must not promise the sight to every target');
for (const t of offerTexts) assert(t.length <= 48, `offer line within 48 chars: ${t}`);
assert.equal(fortuneSightHinted('steve', { ...hints, includeRomance: true }), false);
assert.equal(fortuneSightHinted('naru', { choices: { 'x:y': { target: 'naru', kind: 'taste' } } }), false, 'taste hints never light');
assert(db.dialogues.remake_fortune_result, 'legacy result was removed');
// 占い師は昼にも夜にも現れる（2026-11-02 台帳 URA）。営業時間の門と「昼のみ営業」の札は無い。
for (const slot of [0, 1]) assert.equal(openingStatus({ kind: 'fortune' }, { slot }).ok, true);
assert.notEqual(spotTimeNote({ kind: 'fortune' }, { slot: 1 }), '昼のみ営業');

// Verify annotations against the actual authored branches rather than implementation fixtures.
const dialogues = {};
for (const f of fs.readdirSync(new URL('../../data/dialogue/', import.meta.url)).filter(x => x.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/' + f, import.meta.url)));
  for (const d of raw.dialogues || []) dialogues[d.dialogue_id] = d;
}
for (const [key, h] of Object.entries(hints.choices)) {
  const [did, cid] = key.split(':'), d = dialogues[did], c = d?.lines.find(l => l.type === 'choice' && l.id === cid);
  assert(c, key + ' missing');
  assert.deepEqual(c.choices.map(x => String(x.next || x.next_id || '')), h.options, key + ' annotation stale');
  assert(h.options.includes(h.preferred));
}

// CIの軽量checkoutにも含まれる正式PNGで、採用画像の固定ハッシュと透過・WebPを検査する。
const art = spawnSync('python3', ['-c', `
from PIL import Image
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1])
portrait=root/'assets/sprites/characters/uranaishi/chr_uranaishi_normal.png'
assert hashlib.sha256(portrait.read_bytes()).hexdigest()=='38ef4fa13f7e082db74108c52719ab8127071d98db391cea9895a6b4fdfc3f8d', 'adopted portrait changed'
b=Image.open(portrait).convert('RGBA')
assert b.size==(896,1200)
alpha=b.getchannel('A');assert alpha.getextrema()==(0,255)
for p in [(0,0),(b.width-1,0),(0,b.height-1),(b.width-1,b.height-1)]:assert alpha.getpixel(p)==0
left,top,right,bottom=alpha.point(lambda v:255 if v>2 else 0).getbbox();assert left>0 and top>0 and right<b.width and bottom<b.height, 'portrait cut off at an edge'
w=Image.open(root/'remake/img/sprites/characters/uranaishi/chr_uranaishi_normal.webp').convert('RGBA');assert w.size==b.size and w.getchannel('A').tobytes()==alpha.tobytes()
m=json.loads((root/'remake/data/manifest.json').read_text());assert m['portraits']['uranaishi']['faces']==['normal','sad','serious','smile','surprise']
`, new URL('../../', import.meta.url).pathname], { encoding: 'utf8' });
assert.equal(art.status, 0, art.stderr);
console.log('PASS fortune: 95 final readings across 19 characters, selection review, 2-cycle nonrepeat, legacy mask migration, Naru rift exclusion, save/RNG, inclusive three days, independent bonus, guarded choice hints, daylight hours and authored annotations');

// 第1章は噂を読むまで出ない（#780 の噂の門は第1章だけ残す）。出方は章で1〜2回・予定の無い昼か夜（2026-11-02 台帳 URA）。
{
  assert.equal(fortuneRumorHeard({ limeRead: [] }), false);
  assert.equal(fortuneRumorHeard({ flags: { _fortune_met: true }, limeRead: [] }), false, 'Meeting before does not fake the rumor');
  assert.equal(fortuneRumorHeard({ limeRead: [FORTUNE_RUMOR_ID] }), false, "Legacy morning LIME alone cannot unlock");
  assert.equal(fortuneRumorHeard({ flags: { _fortune_rumor_heard: true }, limeRead: [] }), true, "Completed face-to-face rumor unlocks");
  for (const seed of [0, 1, 5, 42, 777]) {
    const plan = fortunePlan({ chapter: 1, seed, flags: {} });
    assert(plan.length >= 1 && plan.length <= 2, `1-2 appearances: ${seed}`);
    const at = plan[0], save = { chapter: 1, seed, day: Math.floor(at / 2) + 1, slot: at % 2, flags: {} };
    assert.equal(syncFortune(save), false, 'Chapter 1 waits for the rumor');
    save.flags._fortune_rumor_heard = true;
    assert.equal(syncFortune(save), true, 'Appears in the planned half-day once heard');
    assert.equal(fortuneHere(save), true);
  }
  for (const [chapter, maxDay] of [[3, 16], [4, 3]]) {
    const plan = fortunePlan({ chapter, seed: 1, flags: {} });
    assert(plan.length >= 1 && plan.length <= 2, `1-2 appearances in Chapter ${chapter}`);
    assert(plan.every(at => at >= 0 && at < maxDay * 2), `Chapter ${chapter} schedule stays within its available days`);
  }
  // 第5章は東京にも現れる（地元と同じ予定。いる地域に出る）。第4章（ドバイ）には出ない。
  {
    const s = { chapter: 5, seed: 3, day: 1, slot: 0, flags: { _ch5: { startDay: 1 } } };
    const at = fortunePlan(s)[0]; s.day = Math.floor(at / 2) + 1; s.slot = at % 2;
    assert.equal(syncFortune(s, { where: 'tokyo' }), true);
    assert.equal(fortuneHere(s, 'tokyo'), true); assert.equal(fortuneHere(s, 'home'), false);
    const w = { chapter: 2, seed: 3, day: 1, slot: 0, flags: { _ch2_day1: { startDay: 1 } } };
    const at2 = fortunePlan(w)[0]; w.day = Math.floor(at2 / 2) + 1; w.slot = at2 % 2;
    assert.equal(syncFortune(w, { where: 'tokyo' }), false, 'Tokyo only in Chapters 3 and 5');
  }
}
console.log('PASS: fortune rumor gate and wandering schedule');
