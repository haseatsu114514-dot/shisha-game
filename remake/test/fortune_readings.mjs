import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  activeFortuneSight,
  grantFortuneReading,
  fortuneChoiceIndex,
  fortuneResultId,
  registerFortuneReadings,
  naruRiftActive,
  isFortuneTargetAvailable,
  fortuneTargets,
} from '../js/core/fortune-effects.js';
import { openingStatus, spotTimeNote } from '../js/daily/spot-hours.js';
import { fortuneOpenOn, fortuneScheduled, fortuneRumorHeard, FORTUNE_RUMOR_ID } from '../js/daily/fortune-schedule.js';

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

const expectedIds = {
  sumi: ['sumi_1', 'sumi_2', 'sumi_3', 'sumi_4', 'sumi_5', 'sumi_6', 'sumi_7', 'sumi_9', 'sumi_11', 'sumi_13'],
  naru: ['naru_1', 'naru_2', 'naru_4', 'naru_5', 'naru_9', 'naru_12', 'naru_15'],
  adam: ['adam_2', 'adam_4', 'adam_5', 'adam_13', 'adam_14'],
  minto: ['minto_2', 'minto_3', 'minto_4', 'minto_5', 'minto_6', 'minto_10', 'minto_13', 'minto_15'],
  tsumugi: ['tsumugi_1', 'tsumugi_2', 'tsumugi_3', 'tsumugi_5', 'tsumugi_6', 'tsumugi_9', 'tsumugi_13', 'tsumugi_15'],
  rin: ['rin_1', 'rin_2', 'rin_3', 'rin_5', 'rin_6', 'rin_11', 'rin_14'],
  hiyori: ['hiyori_1', 'hiyori_2', 'hiyori_3', 'hiyori_6', 'hiyori_8'],
  samechan: ['samechan_1', 'samechan_2', 'samechan_3', 'samechan_5', 'samechan_6', 'samechan_9'],
  ageha: ['ageha_1', 'ageha_2', 'ageha_3', 'ageha_4', 'ageha_5', 'ageha_6'],
};
const excludedIds = [
  'sumi_8', 'sumi_10', 'sumi_12', 'sumi_14', 'sumi_15',
  'naru_3', 'naru_6', 'naru_7', 'naru_8', 'naru_10', 'naru_11', 'naru_13', 'naru_14',
  'adam_1', 'adam_3', 'adam_6', 'adam_7', 'adam_8', 'adam_9', 'adam_10', 'adam_11', 'adam_12', 'adam_15',
  'minto_1', 'minto_7', 'minto_8', 'minto_9', 'minto_11', 'minto_12', 'minto_14',
  'tsumugi_4', 'tsumugi_7', 'tsumugi_8', 'tsumugi_10', 'tsumugi_11', 'tsumugi_12', 'tsumugi_14',
  'rin_4', 'rin_7', 'rin_8', 'rin_9', 'rin_10', 'rin_12', 'rin_13', 'rin_15',
  'hiyori_4', 'hiyori_5', 'hiyori_7', 'hiyori_9', 'hiyori_10', 'hiyori_11', 'hiyori_12', 'hiyori_13', 'hiyori_14', 'hiyori_15',
  'samechan_4', 'samechan_7', 'samechan_8', 'samechan_10', 'samechan_11', 'samechan_12', 'samechan_13', 'samechan_14', 'samechan_15',
];

assert.equal(trivia.draft, true);
assert.equal(Object.keys(trivia.characters).length, 9);
const all = Object.values(trivia.characters).flat();
assert.equal(all.length, 62);
assert.equal(new Set(all.map(x => x.id)).size, 62);
for (const ex of excludedIds) {
  assert(!all.some(x => x.id === ex), `excluded id ${ex} must not be present`);
  assert(!draftMd.includes(`\`${ex}\`:`), `excluded id ${ex} must not appear in trivia-draft.md`);
}

for (const [char, entries] of Object.entries(trivia.characters)) {
  assert.deepEqual(entries.map(x => x.id), expectedIds[char], `IDs mismatch for ${char}`);
  assert(entries.every(x => x.teller && x.reaction));
  for (const entry of entries) {
    assert(draftMd.includes(`\`${entry.id}\`:`), `draft doc missing ${entry.id}`);
    assert(draftMd.includes(entry.teller), `draft doc missing teller for ${entry.id}`);
    assert(draftMd.includes(entry.reaction), `draft doc missing reaction for ${entry.id}`);
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
  const seenZero = Array.from({ length: 5 }, () => grantFortuneReading(maskZero, 'adam', trivia).id);
  assert.equal(new Set(seenZero).size, 5);

  // For adam, old bit 0 = adam_1 (removed), bit 1 = adam_2 (kept), bit 2 = adam_3 (removed).
  const maskPartial = { chapter: 1, day: 3, seed: 19, flags: { _fortune_trivia_seen_adam: 0b00111 }, fortune: null };
  const restAdam = Array.from({ length: 4 }, () => grantFortuneReading(maskPartial, 'adam', trivia).id);
  assert(!restAdam.includes('adam_2'), 'surviving legacy seen item adam_2 repeated in same cycle');
  assert.deepEqual([...restAdam, 'adam_2'].sort(), [...expectedIds.adam].sort());

  // When legacy mask is 31, surviving old IDs (1..5) stay seen while newly added IDs are drawn first.
  const mask31 = { chapter: 1, day: 3, seed: 23, flags: { _fortune_trivia_seen_naru: 31 }, fortune: null };
  const newNaru = Array.from({ length: 3 }, () => grantFortuneReading(mask31, 'naru', trivia).id);
  assert.deepEqual([...newNaru].sort(), ['naru_12', 'naru_15', 'naru_9']);
  const nextCycleNaru = Array.from({ length: 7 }, () => grantFortuneReading(mask31, 'naru', trivia).id);
  assert.equal(new Set(nextCycleNaru).size, 7);

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
    flags: { _fortune_trivia_seen_adam: ['adam_1', 'adam_3', 'adam_11', 'adam_2', 'adam_14'] },
    fortune: null,
  };
  const remainingReordered = Array.from({ length: 3 }, () => grantFortuneReading(withDeletedHistory, 'adam', reordered).id);
  assert.deepEqual([...remainingReordered].sort(), ['adam_13', 'adam_4', 'adam_5']);

  // Character independence: reading sumi does not alter rin's unseen pool.
  const indep = { chapter: 1, day: 3, seed: 11, flags: {}, fortune: null };
  grantFortuneReading(indep, 'sumi', trivia);
  grantFortuneReading(indep, 'rin', trivia);
  assert.equal(indep.flags._fortune_trivia_seen_sumi.length, 1);
  assert.equal(indep.flags._fortune_trivia_seen_rin.length, 1);
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
grantFortuneReading(save, 'rin', trivia);
assert.equal(fortuneChoiceIndex(save, 'ch1_naru_first', line, hints), -1);
const romance = { id: 'bond_q1_rin', choices: [{ next: 'personal' }, { next: 'work' }] };
assert.equal(fortuneChoiceIndex(save, 'ch1_rin_bond_question', romance, { ...hints, includeRomance: false }), -1);
assert.equal(fortuneChoiceIndex(save, 'ch1_rin_bond_question', romance, { ...hints, includeRomance: true }), 0);
assert.equal(activeFortuneSight({ chapter: 1, day: 3, flags: { _fortune_choice_sight: { char: 'naru', chapter: 1, from: 3, until: 999 } } }), null);

const base = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/remake_ch1.json', import.meta.url))).dialogues;
const db = { dialogues: Object.fromEntries(base.map(d => [d.dialogue_id, d])), fortuneTrivia: trivia };
registerFortuneReadings(db);
for (const entry of all) {
  const d = db.dialogues[fortuneResultId(entry)];
  assert(d);
  assert(d.lines.some(l => l.text === entry.teller));
  assert(d.lines.some(l => l.type === 'motion' && l.id === 'tarot'));
}
assert(db.dialogues.remake_fortune_result, 'legacy result was removed');
for (const slot of [1, 2]) assert.equal(openingStatus({ kind: 'fortune' }, { slot }).ok, false);
assert.equal(openingStatus({ kind: 'fortune' }, { slot: 0 }).ok, true);
assert.equal(spotTimeNote({ kind: 'fortune' }, { slot: 1 }), '昼のみ営業');

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
console.log('PASS fortune: 62 approved readings, 2-cycle nonrepeat, legacy mask migration, Naru rift exclusion, save/RNG, inclusive three days, independent bonus, guarded choice hints, daylight hours and authored annotations');

// #780: 噂を読むまで出ない。出店日が雨なら休み、晴れる日へ繰り越す（連続雨も保持、二重出店なし）。
{
  assert.equal(fortuneRumorHeard({ limeRead: [] }), false);
  assert.equal(fortuneRumorHeard({ flags: { _fortune_met: true }, limeRead: [] }), false, 'Meeting before does not fake the rumor');
  assert.equal(fortuneRumorHeard({ limeRead: [FORTUNE_RUMOR_ID] }), false, "Legacy morning LIME alone cannot unlock");
  assert.equal(fortuneRumorHeard({ flags: { _fortune_rumor_heard: true }, limeRead: [] }), true, "Completed face-to-face rumor unlocks");
  const days = rain => Array.from({ length: 21 }, (_, i) => i + 1).filter(d => fortuneOpenOn(d, d => rain.includes(d)));
  assert.deepEqual(days([]), [3, 6, 10, 13, 17, 20], 'Sunny weeks keep the weekly 3rd/6th days');
  assert.deepEqual(days([3]), [4, 6, 10, 13, 17, 20], 'Rain on day 3 moves it to day 4');
  assert.deepEqual(days([3, 4, 5]), [6, 10, 13, 17, 20], 'Carried opening lands on the next scheduled day only once');
  assert.deepEqual(days([6, 7, 8]), [3, 9, 10, 13, 17, 20], 'Consecutive rain keeps the postponement until it clears');
  assert.deepEqual(days([10]), [3, 6, 11, 13, 17, 20]);
  assert.equal(fortuneOpenOn(5, d => d === 4), false, 'Rain on a normal day carries nothing');
  for (let d = 1; d <= 28; d++) assert.equal(fortuneScheduled(d), d % 7 === 3 || d % 7 === 6);
}
console.log('PASS: fortune rumor gate and rainy-day carryover');
