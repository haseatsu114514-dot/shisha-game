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

const expectedIds = {
  sumi: ['sumi_1', 'sumi_2', 'sumi_3', 'sumi_4', 'sumi_5', 'sumi_6', 'sumi_7', 'sumi_9', 'sumi_11', 'sumi_13'],
  naru: ['naru_1', 'naru_2', 'naru_4', 'naru_5', 'naru_9', 'naru_12', 'naru_15'],
  adam: ['adam_2', 'adam_4', 'adam_5', 'adam_13', 'adam_14'],
  minto: ['minto_2', 'minto_3', 'minto_4', 'minto_5', 'minto_6', 'minto_10', 'minto_13', 'minto_15'],
  tsumugi: ['tsumugi_1', 'tsumugi_2', 'tsumugi_3', 'tsumugi_5', 'tsumugi_6', 'tsumugi_9', 'tsumugi_13', 'tsumugi_15'],
  rio: ['rio_1', 'rio_2', 'rio_3', 'rio_5', 'rio_6', 'rio_11', 'rio_14'],
  hiyori: ['hiyori_1', 'hiyori_2', 'hiyori_3', 'hiyori_6', 'hiyori_8'],
  samechan: ['samechan_1', 'samechan_2', 'samechan_3', 'samechan_5', 'samechan_6', 'samechan_9'],
  ageha: ['ageha_1', 'ageha_2', 'ageha_3', 'ageha_4', 'ageha_5', 'ageha_6'],
};
// 2026-11-02: 第2〜5章で占い師が選べるのに読み物の無かった9人へ5本ずつ（第3・5章は東京にも出る）。
const castIds = ['kumicho', 'rei', 'saku', 'steve', 'volk', 'mashiro', 'mukai_master', 'da_silva', 'sheikh'];
for (const char of castIds) expectedIds[char] = [1, 2, 3, 4, 5].map(n => `${char}_${n}`);
// 2026-11-06: 好感度のある20人へ各5本（王煙楼・ヌールは初）。欠番は使わず、続きの番号から振る。
const addedFrom = { sumi: 16, naru: 16, adam: 16, minto: 16, tsumugi: 16, rio: 16, hiyori: 16, samechan: 16, ageha: 7,
  kumicho: 6, rei: 6, saku: 6, steve: 6, volk: 6, mashiro: 6, mukai_master: 6, da_silva: 6, sheikh: 6, master_hookah: 1, noor: 1 };
const addedIds = [];
for (const [char, from] of Object.entries(addedFrom)) {
  const ids = [0, 1, 2, 3, 4].map(n => `${char}_${from + n}`);
  expectedIds[char] = [...(expectedIds[char] || []), ...ids];
  addedIds.push(...ids);
}
const excludedIds = [
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
assert.equal(Object.keys(trivia.characters).length, 20);
const all = Object.values(trivia.characters).flat();
assert.equal(all.length, 207);
assert.equal(new Set(all.map(x => x.id)).size, 207);
// 追加分は吹き出し1枚に収め、本名や正体を先出ししない（レヰの本名・ましろの噂の正体・組長の過去）。
for (const char of castIds) for (const entry of trivia.characters[char]) {
  for (const text of [entry.teller, entry.reaction]) {
    assert.equal(paginate(text).length, 1, `${entry.id} spills onto a second page: ${text}`);
    assert(!/。$/.test(text) && !/。）$/.test(text), `${entry.id} ends a spoken line with 。`);
    assert(!/健太|田中|シガーマン|若い?衆|抗争|ファヴェーラ|スラム|軍で|15年前|レモンケーキ/.test(text), `${entry.id} reveals a secret: ${text}`);
  }
  assert(/^（.+）$/.test(entry.reaction), `${entry.id} reaction must be Hajime's inner voice`);
}
// 追加分も吹き出し1枚・文末に句点なし・秘密/旧名を出さない（2026-11-06 NAMES-1106）。
for (const entry of all.filter(x => addedIds.includes(x.id))) {
  for (const text of [entry.teller, entry.reaction]) {
    assert.equal(paginate(text).length, 1, `${entry.id} spills onto a second page: ${text}`);
    assert(!/。$/.test(text) && !/。）$/.test(text), `${entry.id} ends a spoken line with 。`);
    assert(!/健太|田中|シガーマン|若い?衆|抗争|ファヴェーラ|スラム|軍で|15年前|レモンケーキ/.test(text), `${entry.id} reveals a secret: ${text}`);
    assert(!/蒸野|墨田|猫柳|薄羽|汐見|宵野|緑川|綾取朔|向井玄|須井|香坂|くゆり|スハイル/.test(text), `${entry.id} uses an old name: ${text}`);
  }
  assert(/^（.+）$/.test(entry.reaction), `${entry.id} reaction must be Hajime's inner voice`);
}
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
  const seenZero = Array.from({ length: expectedIds.adam.length }, () => grantFortuneReading(maskZero, 'adam', trivia).id);
  assert.equal(new Set(seenZero).size, expectedIds.adam.length);

  // For adam, old bit 0 = adam_1 (removed), bit 1 = adam_2 (kept), bit 2 = adam_3 (removed).
  const maskPartial = { chapter: 1, day: 3, seed: 19, flags: { _fortune_trivia_seen_adam: 0b00111 }, fortune: null };
  const restAdam = Array.from({ length: expectedIds.adam.length - 1 }, () => grantFortuneReading(maskPartial, 'adam', trivia).id);
  assert(!restAdam.includes('adam_2'), 'surviving legacy seen item adam_2 repeated in same cycle');
  assert.deepEqual([...restAdam, 'adam_2'].sort(), [...expectedIds.adam].sort());

  // When legacy mask is 31, surviving old IDs (1..5) stay seen while newly added IDs are drawn first.
  const mask31 = { chapter: 1, day: 3, seed: 23, flags: { _fortune_trivia_seen_naru: 31 }, fortune: null };
  const legacyNaru = ['naru_1', 'naru_2', 'naru_4', 'naru_5'];
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
    flags: { _fortune_trivia_seen_adam: ['adam_1', 'adam_3', 'adam_11', 'adam_2', 'adam_14'] },
    fortune: null,
  };
  const unseenAdam = expectedIds.adam.filter(id => !['adam_2', 'adam_14'].includes(id));
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
  // 占い師本人は初対面の♥1で好感度の欄があっても選べない（2026-11-06 台帳 URA07）
  {
    const withTeller = JSON.parse(JSON.stringify(baseCh2));
    withTeller.met.uranaishi = true; withTeller.affinity.uranaishi = 1;
    assert.deepEqual(fortuneTargets(withTeller, { ...characters, uranaishi: {} }), ['naru', 'adam', 'samechan']);
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
const db = { dialogues: Object.fromEntries(base.map(d => [d.dialogue_id, d])), fortuneTrivia: trivia };
registerFortuneReadings(db);
for (const entry of all) {
  const d = db.dialogues[fortuneResultId(entry)];
  assert(d);
  assert(d.lines.some(l => l.text === entry.teller));
  assert(d.lines.some(l => l.type === 'motion' && l.id === 'tarot'));
}
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
console.log('PASS fortune: 207 readings (62 approved + 45 for the Chapter 2-5 cast + 100 for the 20 affinity characters), 2-cycle nonrepeat, legacy mask migration, Naru rift exclusion, save/RNG, inclusive three days, independent bonus, guarded choice hints, daylight hours and authored annotations');

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
