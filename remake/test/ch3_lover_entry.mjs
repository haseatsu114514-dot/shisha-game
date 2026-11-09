// 第3章以降の恋人の入口（#2024）: 実物の state/stats/romance と chapters/lover-entry.js を読み、
// 恋人LIME（lover.json）と節目（lover_events.json）が第3章でも進むことを確かめる。VN・端末は記録だけの port。
// 修羅場が未解決のあいだは誘いが無い・サメちゃんのデート間隔（通算日の保存）・第5章で初めて届いた締めくくりでは
// 告白しない（オーナー既定 B）も同じ実物で確かめる。
// node --experimental-vm-modules remake/test/ch3_lover_entry.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../js/', import.meta.url));
const realPaths = ['core/state.js','core/portrait-style.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','core/chapter-clock.js','daily/date-scene.js','daily/romance.js','daily/samechan-bonds.js','daily/samechan-date.js','chapters/lover-entry.js'];
const read = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url)));
const loverEvents = read('../../data/dialogue/lover_events.json');
const lover = read('../data/lover.json');
async function fixture() {
  const memory = new Map(), plays = [], phones = [];
  const db = { dialogues: Object.fromEntries(loverEvents.dialogues.map(d => [d.dialogue_id, d])), lover, characters: {}, lime: [] };
  const context = vm.createContext({ console, AbortController, setTimeout: () => 0, clearTimeout() {},
    localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  let core;
  const known = {
    MAX_MONEY: 999999, TOURNAMENT_DAY: 14, DB: db, callName: String, emit() {},
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)), hiyoriFirstMeetingReady: () => true,
    play: async scene => { plays.push(typeof scene === 'string' ? scene : scene.dialogue_id); return { visited: [] }; },
    isPlaying: () => false,
    // サメちゃんのデート（samechan-date.js）が読む心得の盤。誘いの検査なので旧しくみ（盤は無効）の代役にする
    growthEnabled: () => false, awardActionExp: () => 0,
    // phone.js の openPhone（runItem）と同じく、読んだ通は既読と受信箱の履歴に残る。
    openPhone: async messages => {
      phones.push(messages.map(m => m.id));
      for (const m of messages) {
        if (!core.state.limeRead.includes(m.id)) core.state.limeRead.push(m.id);
        core.state.inbox.push({ id: m.id, originId: m.id, day: core.state.day, msg: { ...m }, read: true, done: true, log: [] });
      }
      return [];
    },
  };
  const modules = new Map(), required = new Map();
  for (const p of realPaths) {
    const source = fs.readFileSync(path.join(root,p),'utf8');
    modules.set(p,new vm.SourceTextModule(source,{context,identifier:p}));
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(p),match[2]));
      if (realPaths.includes(target)) continue;
      if (!required.has(target)) required.set(target,new Set());
      for (const name of match[1].split(',')) required.get(target).add(name.trim().split(/\s+as\s+/)[0]);
    }
  }
  for (const [p,names] of required) modules.set(p,new vm.SyntheticModule([...names],function() {
    for (const name of names) this.setExport(name,Object.hasOwn(known,name) ? known[name] : () => { throw Error(`Unexpected port ${p}:${name}`); });
  },{context,identifier:p}));
  const entry = new vm.SourceTextModule(realPaths.map(p=>`export * as ${p.replace(/\W/g,'_')} from './${p}';`).join('\n'),{context,identifier:'entry.js'});
  await entry.link((s,ref) => { const p=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),s)); assert(modules.has(p),p); return modules.get(p); });
  await entry.evaluate();
  const ns = p => modules.get(p).namespace;
  core = ns('core/state.js');
  // 第3章の東京滞在中（DAY 2）。付き合い始めは今日で、記念日は来ない。
  const chapterThree = (lovers, day = 30) => {
    const s = core.newGame();
    Object.assign(s, { chapter: 3, phase: 'daily', day, slot: 1, lovers: [...lovers], contacts: ['sumi', ...lovers] });
    s.flags._elapsed_calendar = true;
    s.flags._ch3_intro = { startDay: day - 1, stage: 3, titleSeen: true, prologueStep: 4 };
    s.flags._ch2_region = 'tokyo'; // 東京の日常ループの現在地
    for (const id of lovers) { s.loveLevel[id] = 1; s.lovePts[id] = 9; s.loverSince[id] = day; }
    return s;
  };
  // 任意の章の通算日の保存（第2章から）。私用LIMEの最初のひとことは読み終えていて、付き合って7日目（10日ごとの
  // 記念日に当たらない）。誘いの判定だけを見る。
  const chapterAt = (chapter, lovers, { day = 70, flags = {} } = {}) => {
    const s = core.newGame();
    Object.assign(s, { chapter, phase: 'daily', day, slot: 0, lovers: [...lovers], contacts: ['sumi', ...lovers] });
    Object.assign(s.flags, { _elapsed_calendar: chapter >= 2 }, flags);
    for (const id of lovers) {
      s.loveLevel[id] = 1; s.lovePts[id] = 9; s.loverSince[id] = day - 7;
      s.limeRead.push(`_lover_private_account_${id}`);
    }
    return s;
  };
  return { core, db, stats: ns('core/stats.js'), romance: ns('daily/romance.js'), entry: ns('chapters/lover-entry.js'),
    samechanDate: ns('daily/samechan-date.js'), plays, phones, chapterThree, chapterAt };
}
// vm の別 realm で作られた配列は prototype が違い deepStrictEqual が通らないため、JSON 化して中身だけ比べる。
const same = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
let count = 0;
async function check(name, run) {
  try { await run(await fixture()); count++; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}

await check('chapter 3 lover LIME comes from lover.json without date invitations, once per message', async f => {
  const s = f.chapterThree(['mashiro']);
  // ましろは東京に住むので、第3章からは地元のデートに誘ってこない（IR16）。入口はそもそも誘いを出さない。
  assert.equal(f.romance.loverMessages().some(m => m.type === 'invitation'), false);
  assert.match(fs.readFileSync(path.join(root, 'chapters/lover-entry.js'), 'utf8'), /loverMessages\(\{ invitations: false, home \}\)/);
  const due = f.entry.pendingLoverLime();
  same(due.map(m => m.id), ['_lover_morning_mashiro_d30']);
  assert.equal(due[0].type, 'chat');
  assert(lover.morning.mashiro.some(v => JSON.stringify(v.m) === JSON.stringify(due[0].messages)), 'Text must be the lover.json morning pool');
  same(f.entry.pendingLoverLime({ senders: ['ageha'] }), []);
  assert.equal(await f.entry.readLoverLime(), true);
  same(f.phones, [['_lover_morning_mashiro_d30']]);
  assert(s.limeRead.includes('_lover_morning_mashiro_d30'));
  same(f.entry.pendingLoverLime(), []);
  assert.equal(await f.entry.readLoverLime(), false, 'A read message must not reopen the phone');
  assert.equal(f.phones.length, 1);
});

await check('an unresolved shuraba stops every date invitation; a single lover after the party still gets them', async f => {
  const invites = () => f.romance.loverMessages().filter(m => m.type === 'invitation').map(m => m.sender);
  // 第5章の地元の自由行動 DAY5。打ち上げで恋人2人の浮気がばれた後（PTY02・shuraba_accountability が
  // _story_shuraba_unresolved を立てる）。
  f.chapterAt(5, ['tsumugi', 'minto'], { day: 55, flags: { _ch5: { startDay: 51, part: 'free' }, _ch5_after_party: true,
    _minto_name_known: true, _minto_identity_revealed: true } });
  same(invites(), ['tsumugi'], 'Control: before the affair comes out, one of the two is invited');
  f.core.state.flags._story_shuraba_unresolved = true;
  same(invites(), [], 'While the shuraba is unresolved nobody sends a date invitation');
  f.chapterAt(5, ['tsumugi'], { day: 55, flags: { _ch5: { startDay: 51, part: 'free' }, _ch5_after_party: true, _ch5_party_seat: 'tsumugi' } });
  same(invites(), ['tsumugi'], 'One lover at the party: no shuraba, dates go on');
});

await check('chapter 3 and 4 departure preparation closes invitations and night confession, then reopens', async f => {
  const invites = () => f.romance.loverMessages().filter(m => m.type === 'invitation');
  for (const chapter of [3, 4]) {
    const s = f.chapterAt(chapter, ['tsumugi'], { day: 70, flags: chapter === 3
      ? { _ch3_intro: { startDay: 69 } } : { _ch4: { startDay: 69 } } });
    const key = `_ch${chapter}_prep`;
    assert.equal(invites().length, 1, `chapter ${chapter} outside preparation`);
    f.db.dialogues.confession_rio = { dialogue_id: 'confession_rio', lines: [] };
    s.romanceChoices = { bond_q_rio: { char: 'rio', value: 1 } };
    s.finales = { rio: { day: 60, chapter: 2, route: 'romance' } };
    s.slot = 2;
    s.flags._confession_due = 'rio';
    s.flags[key] = { startDay: 70, days: 3, step: 0, departed: false };
    for (let day = 70; day < 73; day++) {
      s.day = day;
      assert.equal(invites().length, 0, `chapter ${chapter} prep day ${day} invitation`);
      assert.equal(await f.romance.maybeConfession(async () => {}), false, `chapter ${chapter} prep day ${day} confession`);
      assert.equal(s.flags._confession_due, 'rio', 'reserved confession remains due');
    }
    s.flags[key].departed = true;
    assert.equal(invites().length, 1, `chapter ${chapter} after departure`);
  }
  f.chapterAt(5, ['tsumugi'], { day: 70, flags: { _ch5: { startDay: 65, part: 'free' } } });
  assert.equal(invites().length, 1, 'chapter 5 invitation stays open');
  f.chapterAt(2, ['tsumugi'], { day: 70, flags: { _ch2_day1: { startDay: 69 } } });
  assert.equal(invites().length, 1, 'chapter 2 invitation stays open');
});

await check('a confession held over the departure prep and Tokyo/Dubai nights reaches a hometown night in chapter 5 (IR33)', async f => {
  f.db.dialogues.confession_rio = { dialogue_id: 'confession_rio', lines: [{ speaker: '', text: '…' }] };
  // 第2章の締めくくりで恋愛ルートに入り、告白を持ち越している（予約は締めくくりの直後に入る）。
  const at = (chapter, flags) => {
    const s = f.chapterAt(chapter, [], { day: 80, flags });
    s.romanceChoices = { bond_q_rio: { char: 'rio', value: 1 } };
    s.finales = { rio: { day: 60, chapter: 2, route: 'romance' } };
    s.slot = 2;
    s.flags._confession_due = 'rio';
    return s;
  };
  const held = async (s, label) => {
    assert.equal(f.romance.confessionHeld(), true, `${label}: held`);
    assert.equal(await f.romance.maybeConfession(async () => {}), false, `${label}: no night-walk confession`);
    assert.equal(s.flags._confession_due, 'rio', `${label}: the reservation stays`);
    assert.equal(f.romance.romanceRouteOpen('rio'), true, `${label}: the route stays open`);
  };
  // 第4章: ドバイへ来る人は出発前に決まっている。準備3日の地元でも、ドバイでも告白しない。
  await held(at(4, { _ch4: { startDay: 79 }, _ch4_prep: { startDay: 80, days: 3, step: 0, departed: false }, _ch2_region: 'home' }), 'chapter 4 prep');
  await held(at(4, { _ch4: { startDay: 79 }, _ch4_prep: { startDay: 70, days: 3, step: 1, departed: true }, _ch2_region: 'dubai' }), 'chapter 4 Dubai');
  // 第3章の東京の夜も、帰り道の告白（地元の場面）を始めない。
  await held(at(3, { _ch3_intro: { startDay: 79 }, _ch3_prep: { startDay: 70, days: 3, step: 1, departed: true }, _ch2_region: 'tokyo' }), 'chapter 3 Tokyo');
  // 第5章: 東京・ドバイへ出ている夜は持ち越し、地元の夜に告白へ（主人公が踏み出すかどうかから）。
  for (const region of ['tokyo', 'dubai']) await held(at(5, { _ch5: { startDay: 65, part: 'free' }, _ch2_region: region }), `chapter 5 in ${region}`);
  for (const region of ['home', 'widehanga']) {
    const s = at(5, { _ch5: { startDay: 65, part: 'free' }, _ch2_region: region });
    f.plays.length = 0;
    assert.equal(f.romance.confessionHeld(), false, `chapter 5 ${region}: not held`);
    assert.equal(await f.romance.maybeConfession(async () => {}), true, `chapter 5 ${region}: the confession comes back`);
    same(f.plays, ['remake_confession_gate_rio'], `chapter 5 ${region}: the usual gate first`);
    // 「まだ胸にしまっておく」を選んでも、予約は残って後日の夜にもう一度
    assert.equal(s.flags._confession_due, 'rio');
    assert.equal(s.flags._confession_wait, 82);
  }
  // 第2章（地元）は今までどおり
  at(2, { _ch2_day1: { startDay: 69 }, _ch2_region: 'home' });
  assert.equal(f.romance.confessionHeld(), false, 'chapter 2 at home');
  // ドバイに住むヌールの告白は砂丘の夕日だけ（DSR20）。第5章の地元の夜の帰り道には出さない。
  f.db.dialogues.confession_noor = { dialogue_id: 'confession_noor', lines: [{ speaker: '', text: '…' }] };
  const n = f.chapterAt(5, [], { day: 80, flags: { _ch5: { startDay: 65, part: 'free' }, _ch2_region: 'home' } });
  n.romanceChoices = { bond_q2_noor: { char: 'noor', value: 1 } };
  n.finales = { noor: { day: 60, chapter: 4, route: 'romance' } };
  n.slot = 2;
  f.plays.length = 0;
  assert.equal(await f.romance.maybeConfession(async () => {}), false, 'no night-walk confession for Noor');
  same(f.plays, []);
  // 第5章のドバイで迎えた締めくくり（告白は第5章でも開く・2026-11-07）でも、夜の帰り道には出さない（予約が残っていても消す）
  n.finales.noor.chapter = 5;
  n.flags._confession_due = 'noor';
  assert.equal(await f.romance.maybeConfession(async () => {}), false, 'no night-walk confession for a chapter 5 Noor finale either');
  same(f.plays, []);
  assert.equal(n.flags._confession_due, undefined);
});

await check('samechan: a confession held from a chapter 3 finale reaches a chapter 5 hometown night; the route still starts only in chapters 2-3 (IR36)', async f => {
  f.db.dialogues.confession_samechan = { dialogue_id: 'confession_samechan', lines: [{ speaker: '', text: '…' }] };
  // 第3章の出発前の準備3日に締めくくりを迎え、告白を持ち越している（サメちゃんの恋愛の入口は第2・3章）。
  const at = (chapter, flags, finaleChapter = 3) => {
    const s = f.chapterAt(chapter, [], { day: 80, flags: { _samechan_bond_question_done: true, ...flags } });
    s.romanceChoices = { bond_q1_samechan: { char: 'samechan', value: 1 }, bond_q2_samechan: { char: 'samechan', value: 1 } };
    s.finales = { samechan: { day: 60, chapter: finaleChapter, route: 'romance' } };
    s.slot = 2;
    s.flags._confession_due = 'samechan';
    return s;
  };
  // 第3章の準備3日・東京、第4章のあいだは持ち越す（予約もルートも残る）
  for (const [label, make] of [
    ['chapter 3 prep', () => at(3, { _ch3_intro: { startDay: 79 }, _ch3_prep: { startDay: 80, days: 3, step: 0, departed: false }, _ch2_region: 'home' })],
    ['chapter 3 Tokyo', () => at(3, { _ch3_intro: { startDay: 79 }, _ch3_prep: { startDay: 70, days: 3, step: 1, departed: true }, _ch2_region: 'tokyo' })],
    ['chapter 4 Dubai', () => at(4, { _ch4: { startDay: 79 }, _ch4_prep: { startDay: 70, days: 3, step: 1, departed: true }, _ch2_region: 'dubai' })],
  ]) {
    const s = make(); // at() で今の state が切り替わるので、1つずつ作る
    assert.equal(f.romance.confessionHeld(), true, `${label}: held`);
    assert.equal(await f.romance.maybeConfession(async () => {}), false, `${label}: no night-walk confession`);
    assert.equal(s.flags._confession_due, 'samechan', `${label}: the reservation stays`);
    assert.equal(f.romance.romanceRouteOpen('samechan'), true, `${label}: the route stays open`);
  }
  // 第5章の地元の夜に届く（踏み出すかどうかから）
  const s = at(5, { _ch5: { startDay: 65, part: 'free' }, _ch2_region: 'home' });
  f.plays.length = 0;
  assert.equal(f.romance.romanceRouteOpen('samechan'), true, 'chapter 5: a chapter 3 finale keeps its route');
  assert.equal(await f.romance.maybeConfession(async () => {}), true, 'chapter 5 home: the confession comes back');
  same(f.plays, ['remake_confession_gate_samechan']);
  assert.equal(s.flags._confession_due, 'samechan');
  // 第4章以降に記録された締めくくり（入口の外）は恋愛ルートにしない
  at(5, { _ch5: { startDay: 65, part: 'free' }, _ch2_region: 'home' }, 4);
  assert.equal(f.romance.romanceRouteOpen('samechan'), false, 'a finale outside chapters 2-3 is not a romance route');
  // 締めくくりの章の記録がない旧セーブは、今の章で判断する（今までどおり）
  const legacy = at(5, { _ch5: { startDay: 65, part: 'free' }, _ch2_region: 'home' });
  delete legacy.finales.samechan.chapter;
  assert.equal(f.romance.romanceRouteOpen('samechan'), false, 'legacy save without the finale chapter');
});

await check('samechan date gap counts elapsed days on _elapsed_calendar saves; legacy chapter-local saves keep the 14-day offset', async f => {
  // 通算日の保存: 第2章の通算40日にデート → 第3章の通算45日。間は5日（旧式は 45-(14+40) = -9 で誘いが止まっていた）
  const s = f.chapterAt(3, ['samechan'], { day: 45, flags: { _ch3_intro: { startDay: 44 } } });
  s.lastDate.samechan = 40; s.flags._samechan_last_date_chapter = 2;
  assert.equal(f.samechanDate.samechanDateGap(), 5);
  assert.equal(f.romance.loverMessages().find(m => m.type === 'invitation')?.id, '_date_inv_samechan_c3_d45');
  s.day = 42; // 2日後はまだ早い（恋人のデートの間は3日から）
  assert.equal(f.samechanDate.samechanDateGap(), 2);
  assert.equal(f.romance.loverMessages().some(m => m.type === 'invitation'), false);
  // 章内日の旧保存（_elapsed_calendar なし）: 第2章DAY14 → 第3章DAY3 は3日（samechan_dates.mjs の旧保存と同じ）
  const legacy = f.chapterAt(3, ['samechan'], { day: 3, flags: { _elapsed_calendar: false } });
  legacy.lastDate.samechan = 14; legacy.flags._samechan_last_date_chapter = 2;
  assert.equal(f.samechanDate.samechanDateGap(), 3);
  delete legacy.flags._samechan_last_date_chapter; legacy.day = 5; // 章の記録が無い旧日は前の章とみなす
  assert.equal(f.samechanDate.samechanDateGap(), 5);
});

await check('a bond finale first reached in chapter 5 opens no confession (owner default B)', async f => {
  const s = f.chapterAt(5, [], { day: 70, flags: { _ch5: { startDay: 51, part: 'free' } } });
  f.db.dialogues.confession_tsumugi = { dialogue_id: 'confession_tsumugi', lines: [{ speaker: '', text: '…' }] };
  s.romanceChoices = { bond_q_tsumugi: { char: 'tsumugi', value: 1 } };
  s.finales = { tsumugi: { day: 40, chapter: 3, route: 'romance' } };
  assert.equal(f.romance.romanceRouteOpen('tsumugi'), true, 'Control: a chapter 3 finale keeps its confession');
  s.finales.tsumugi = { day: 70, chapter: 5, route: 'romance' };
  assert.equal(f.romance.NO_CONFESSION_FINALE_CHAPTER, 5);
  assert.equal(f.romance.romanceRouteOpen('tsumugi'), false, 'A chapter 5 finale does not open the confession');
  // ヌールだけ例外（2026-11-07 オーナー決定「ノールの告白は第5章でも可能にする」）: 第5章のドバイの締めくくりでも砂丘の夕日で告白できる
  f.db.dialogues.confession_noor = { dialogue_id: 'confession_noor', lines: [{ speaker: '', text: '…' }] };
  s.romanceChoices.bond_q1_noor = { char: 'noor', value: 1 };
  s.romanceChoices.bond_q2_noor = { char: 'noor', value: 1 };
  s.finales.noor = { day: 70, chapter: 5, route: 'romance' };
  assert.equal(f.romance.romanceRouteOpen('noor'), true, 'Noor alone: a chapter 5 finale opens her dunes confession');
  assert.equal(f.romance.romanceRouteOpen('tsumugi'), false, 'the other heroines keep owner default B');
});

await check('chapter 3 lover milestones advance lv1 -> lv2 through the shared romance.js ladder', async f => {
  const s = f.chapterThree(['mashiro']);
  same(f.entry.loverMilestonesDue(['mashiro', 'ageha']), ['mashiro']);
  assert.equal(await f.entry.readLoverMilestone('mashiro'), true);
  same(f.plays, ['lover_mashiro_lv1']);
  assert(s.loverEventsSeen.includes('lover_mashiro_lv1'));
  same(f.entry.loverMilestonesDue(['mashiro']), [], 'lv2 waits for the bond to grow');
  assert.equal(await f.entry.readLoverMilestone('mashiro'), false);
  // 恋人とのLIMEの返信（phone.js runItem）と同じ私的な絆の加算で、次の段へ。
  const restore = f.stats.privateBondScope();
  try { f.stats.gainAffinity('mashiro', 30, { source: 'lime' }); } finally { restore(); }
  assert.equal(s.loveLevel.mashiro, 2);
  assert.equal(await f.entry.readLoverMilestone('mashiro'), true);
  same(f.plays, ['lover_mashiro_lv1', 'lover_mashiro_lv2']);
  f.core.save(); f.core.newGame(); assert(f.core.load());
  same(f.core.state.loverEventsSeen.filter(id => id.startsWith('lover_mashiro_')), ['lover_mashiro_lv1', 'lover_mashiro_lv2']);
});

await check('ageha lover content reaches chapter 4 at home, and a companion abroad sends no LIME', async f => {
  // 朝のひとことは3日おき（LM01）。あげは（位相1）は 32+1 が3の倍数の日に届く
  const s = f.chapterThree(['ageha'], 32);
  Object.assign(s, { chapter: 4 });
  const due = f.entry.pendingLoverLime();
  same(due.map(m => m.id), ['_lover_morning_ageha_d32']);
  same(f.entry.pendingLoverLime({ exclude: ['ageha'] }), []);
  same(f.entry.loverMilestonesDue(), ['ageha']);
  assert.equal(await f.entry.readLoverMilestone('ageha'), true);
  same(f.plays, ['lover_ageha_lv1']);
  s.loveLevel.ageha = 2;
  s.loverEventsSeen.push('lover_ageha_lv2');
  assert.equal(f.romance.loverMilestoneDue('ageha'), 'lover_ageha_lv2_b');
  assert.equal(await f.entry.readLoverMilestone('ageha'), true);
  same(f.plays, ['lover_ageha_lv1', 'lover_ageha_lv2_b']);
  assert.equal(f.romance.loverMilestoneDue('ageha'), null, 'lv3 waits for the next bond level');
});

await check('chapter 3 tournament morning: one cheer per lover, from far away or from Tokyo, read once (IR19)', async f => {
  const s = f.chapterThree(['tsumugi', 'mashiro'], 42);
  for (const id of ['tsumugi', 'mashiro']) s.limeRead.push(`_lover_private_account_${id}`);
  // 地元のつむぎは配信で見る側の文面。東京に住むましろは、第1・2章と同じ大会の朝の文面。
  assert.equal(await f.entry.readTournamentCheers({ away: ['tsumugi'] }), true);
  same(f.phones, [['_lover_gameday_tsumugi_c3', '_lover_gameday_mashiro_c3']]);
  const text = id => JSON.stringify(s.inbox.find(item => item.id === `_lover_gameday_${id}_c3`).msg.messages);
  assert.equal(text('tsumugi'), JSON.stringify(lover.gameday_away.tsumugi[0].m));
  assert(lover.gameday.mashiro.some(v => JSON.stringify(v.m) === text('mashiro')));
  assert.match(text('tsumugi'), /配信/, 'The hometown lover watches the stream');
  assert.equal(s.inbox.find(item => item.id === '_lover_gameday_tsumugi_c3').msg.replies.length, 2, 'A cheer can be answered, like chapters 1-2');
  // LOAD・再挑戦で同じ朝の応援を重ねて届けない。
  assert.equal(await f.entry.readTournamentCheers({ away: ['tsumugi'] }), false);
  assert.equal(f.phones.length, 1);
  // 恋人がいなければ端末は開かない。
  s.lovers = [];
  assert.equal(await f.entry.readTournamentCheers(), false);
  // 遠くの文面が無い恋人（あげはは第3章の大会の時点では恋人にならない）は、いつもの文面に戻る。
  assert.equal(lover.gameday_away.ageha, undefined);
  s.lovers = ['ageha']; s.limeRead.push('_lover_private_account_ageha');
  const [ageha] = f.romance.loverMessages({ tournamentDay: true, away: ['ageha'] });
  assert(lover.gameday.ageha.some(v => JSON.stringify(v.m) === JSON.stringify(ageha.messages)));
});

await check('chapter 5 at home: date invitations, the date bond and the next milestone work like chapters 1-2 (IR16/IR17)', async f => {
  const s = f.core.newGame();
  // 第5章の21日目（勝負の日は未定）。大会のある章の DAY14 の止めは掛からない。
  Object.assign(s, { chapter: 5, phase: 'daily', day: 80, slot: 0, lovers: ['tsumugi', 'mashiro'], contacts: ['sumi', 'tsumugi', 'mashiro'] });
  s.flags._elapsed_calendar = true;
  s.flags._ch5 = { startDay: 60, stage: 2, part: 'free' };
  for (const id of s.lovers) { s.loveLevel[id] = 1; s.lovePts[id] = 9; s.loverSince[id] = 41; s.limeRead.push(`_lover_private_account_${id}`); }
  const invites = () => f.romance.loverMessages().filter(m => m.type === 'invitation').map(m => m.sender);
  same(invites(), ['tsumugi'], 'Mashiro lives in Tokyo, so she does not ask for a hometown date');
  const invite = f.romance.loverMessages().find(m => m.type === 'invitation');
  assert.equal(invite.accept_event, 'date_tsumugi');
  assert.equal(invite.lover, true);
  // 東京・ドバイにいる間は、地元のデートの誘いは届かない（朝のひとことは届く）。
  for (const region of ['tokyo', 'dubai']) {
    s.flags._ch2_region = region;
    same(invites(), [], `No hometown date while in ${region}`);
    assert.equal(f.romance.hometownDateOpen('tsumugi'), false);
  }
  s.flags._ch2_region = 'widehanga';
  same(invites(), ['tsumugi'], 'Yuzugaya is a train ride from home (chapter 2 rule)');
  s.flags._ch2_region = 'home';
  // デート: 私的な絆が深まり、読了後に未読の節目（lv1）を一つだけ読む。
  await f.romance.playDate('tsumugi');
  same(f.plays, ['remake_date_tsumugi', 'lover_tsumugi_lv1']);
  assert(s.lovePts.tsumugi > 9, 'The date deepens the private bond');
  assert.equal(s.lastDate.tsumugi, 80);
  assert(s.loverEventsSeen.includes('lover_tsumugi_lv1'));
  // 第1・2章の東京在住でない保存（旧来のUI検査）では、ましろも地元のデートに誘う。
  s.chapter = 2;
  assert.equal(f.romance.hometownDateOpen('mashiro'), true);
});

await check('a lover who is with hajime sends no LIME, and the rest still do (IR17)', async f => {
  const s = f.chapterThree(['ageha', 'tsumugi'], 32);
  Object.assign(s, { chapter: 4 });
  s.limeRead.push('_lover_private_account_ageha', '_lover_private_account_tsumugi');
  same(f.romance.loverMessages({ invitations: false }).map(m => m.sender), ['ageha']);
  same(f.romance.loverMessages({ invitations: false, exclude: ['ageha'] }).map(m => m.sender), []);
  same(f.romance.loverMessages({ tournamentDay: true, exclude: ['ageha'] }).map(m => m.sender), ['tsumugi']);
});

await check('in Tokyo/Dubai, lover notes do not assume hajime is in town; the anniversary waits for his return (#2024)', async f => {
  const text = m => JSON.stringify(m.messages);
  const filled = (v, n) => JSON.stringify(v.m.map(t => typeof t === 'string' ? t.replace('{n}', n) : t));
  // 文面の決まり: 地元前提の朝のひとことは印だけ付け、どの恋人にも離れていても届く文を残す。離れている日の記念日はいつもの記念日と同じ恋人だけ。
  const hometown = lover.morning.tsumugi.filter(v => v.hometown);
  same(hometown.map(v => v.m[0]), ['……今日、tonariに行きます']);
  for (const [id, pool] of Object.entries(lover.morning)) assert(pool.some(v => !v.hometown), `${id}: an away-safe morning note`);
  const awayIds = Object.keys(lover.anniversary_away).filter(id => !id.startsWith('_'));
  for (const id of ['minto', 'ageha']) assert(awayIds.includes(id), `${id}: the anniversary plans a same-night date, so it needs an away text`);
  for (const id of awayIds) {
    assert(lover.anniversary[id], `${id}: the away anniversary replaces an existing one`);
    assert.match(lover.anniversary_away[id].m[0], /\{n\}/, `${id}: the away anniversary counts the days`);
    assert.doesNotMatch(JSON.stringify(lover.anniversary_away[id]), /閉店後|今夜|夜、/, `${id}: no same-night plan while away`);
  }

  // つむぎ（位相0）の DAY12 の朝は、地元なら「今日、tonariに行きます」に当たる。離れていても朝のひとこと自体は届く（IR17）。
  const morning = () => f.romance.loverMessages({ invitations: false }).find(m => m.id.startsWith('_lover_morning_'));
  const s = f.chapterAt(4, ['tsumugi'], { day: 12, flags: { _ch2_region: 'home' } });
  assert.equal(text(morning()), JSON.stringify(hometown[0].m), 'Control: at home the visit note arrives');
  for (const region of ['tokyo', 'dubai']) {
    s.flags._ch2_region = region;
    const note = morning();
    assert.equal(note?.id, '_lover_morning_tsumugi_d12', `${region}: the morning note still arrives`);
    assert([...lover.morning.tsumugi.filter(v => !v.hometown), ...lover.morning_away.tsumugi].some(v => JSON.stringify(v.m) === text(note)),
      `${region}: an away-safe note`);
  }
  // 3日おきの朝を120日分たどっても、地元にいる時だけ届く（記念日に当たらない日で見る）。
  for (const region of ['home', 'widehanga', 'tokyo', 'dubai']) {
    s.flags._ch2_region = region;
    let visits = 0;
    for (let day = 3; day <= 120; day += 3) {
      Object.assign(s, { day }); s.loverSince.tsumugi = day - 7;
      const note = morning();
      assert(note, `${region} DAY${day}: the morning note arrives`);
      if (text(note) === JSON.stringify(hometown[0].m)) visits++;
    }
    if (['home', 'widehanga'].includes(region)) assert(visits > 0, `${region}: the visit note is still in the rotation`);
    else assert.equal(visits, 0, `${region}: no "coming to tonari today" while hajime is away`);
  }

  // 記念日（付き合って10日）: 地元はいつもの文面、離れている日は「帰ってきてから」。返事と好感度もその文面のもの。
  const anniversary = (id, region, opts = {}) => {
    const t = f.chapterAt(4, [id], { day: 40, flags: { _ch2_region: region } });
    t.loverSince[id] = 30;
    return f.romance.loverMessages({ invitations: false, ...opts }).find(m => m.id === `_lover_anniv_${id}_n10`);
  };
  for (const id of awayIds) {
    assert.equal(text(anniversary(id, 'home')), filled(lover.anniversary[id], 10), `${id}: at home`);
    for (const region of ['tokyo', 'dubai']) {
      const note = anniversary(id, region);
      assert.equal(text(note), filled(lover.anniversary_away[id], 10), `${id}: in ${region}`);
      same(note.replies, lover.anniversary_away[id].r);
    }
  }
  const usual = Object.keys(lover.anniversary).find(id => !awayIds.includes(id));
  assert.equal(text(anniversary(usual, 'dubai')), filled(lover.anniversary[usual], 10), `${usual} has no away text: the usual anniversary`);

  // 場面カードは現在地の印が場面と合わない（第4章の帰国後の tonari は印がドバイのまま）。呼び出し側の home が勝つ。
  assert.equal(text(anniversary('minto', 'dubai', { home: true })), filled(lover.anniversary.minto, 10));
  assert.equal(text(anniversary('minto', 'home', { home: false })), filled(lover.anniversary_away.minto, 10));
  // 入口（lover-entry.js）も home を渡すだけ。省略時は印から。読んだ文面が受信箱に残る。
  const u = f.chapterAt(4, ['minto'], { day: 40, flags: { _ch2_region: 'dubai' } });
  u.loverSince.minto = 30;
  assert.equal(text(f.entry.pendingLoverLime()[0]), filled(lover.anniversary_away.minto, 10));
  assert.equal(text(f.entry.pendingLoverLime({ home: true })[0]), filled(lover.anniversary.minto, 10));
  assert.equal(await f.entry.readLoverLime({ home: true }), true);
  assert.equal(text(u.inbox.find(item => item.id === '_lover_anniv_minto_n10').msg), filled(lover.anniversary.minto, 10));
  same(f.entry.pendingLoverLime({ home: false }), [], 'Read once, whichever text it was');
});

// DSR20: ヌールはドバイに住む恋人。地元のデートには誘ってこない（会えるのはドバイにいる間だけ）。朝のLIMEはどこでも届き、
// 時差やテレビ電話の文（hometown）は、はじめが地元にいる朝だけ。告白は砂丘の夕日の場面だけで、夜の帰り道には出ない。
await check('Noor lives in Dubai: no hometown dates, morning LIME everywhere, long-distance notes only at home (DSR20)', async f => {
  const pool = lover.morning.noor;
  assert(pool.some(v => !v.hometown) && pool.some(v => v.hometown), 'both kinds of morning notes');
  for (const v of pool.filter(v => v.hometown)) assert.match(JSON.stringify(v.m), /三時|ツアー|砂丘|テレビ電話|時差/);
  const s = f.chapterAt(5, ['noor'], { day: 70, flags: { _ch5: { startDay: 60, stage: 2, part: 'free' }, _ch2_region: 'home' } });
  s.lastDate.noor = 0;
  assert.equal(f.romance.hometownDateOpen('noor'), false);
  assert.equal(f.romance.loverMessages().some(m => m.type === 'invitation'), false, 'no hometown date invitation from Dubai');
  const morning = () => f.romance.loverMessages({ invitations: false, home: s.flags._ch2_region === 'home' }).find(m => m.id.startsWith('_lover_morning_noor'));
  const seen = { home: new Set(), dubai: new Set() };
  for (const region of ['home', 'dubai']) {
    s.flags._ch2_region = region;
    for (let day = 70; day < 130; day++) {
      s.day = day; s.loverSince.noor = day - 7;
      const note = morning();
      if (note) seen[region].add(JSON.stringify(note.messages));
    }
  }
  const lines = kind => pool.filter(v => !!v.hometown === kind).map(v => JSON.stringify(v.m));
  assert(seen.home.size > 0 && seen.dubai.size > 0, 'morning notes arrive in both places');
  for (const text of seen.dubai) assert(lines(false).includes(text), 'in Dubai, only notes that do not assume the distance');
  assert([...seen.home].some(text => lines(true).includes(text)), 'at home, the long-distance notes arrive too');
  // 記念日（10日ごと）。離れた街の差し替えは無く、いつもの文面（ヌールとはドバイで会える）
  assert.equal(lover.anniversary_away.noor, undefined);
  s.day = 80; s.loverSince.noor = 70;
  const anniversary = f.romance.loverMessages({ invitations: false }).find(m => m.id === '_lover_anniv_noor_n10');
  assert(anniversary, 'the ten-day anniversary');
  assert.match(JSON.stringify(anniversary.messages), /10日目/);
  assert.equal(anniversary.replies.length, 2);
  assert.match(fs.readFileSync(path.join(root, 'daily/romance.js'), 'utf8'), /const OWN_CONFESSION_SCENE = Object\.freeze\(\["mashiro", "noor"\]\)/);
});

await check('non-lovers and cancelled milestones stay unread', async f => {
  const s = f.chapterThree([]);
  same(f.entry.pendingLoverLime(), []);
  same(f.entry.loverMilestonesDue(['mashiro']), []);
  assert.equal(await f.entry.readLoverMilestone('mashiro'), false);
  s.lovers.push('mashiro'); s.loveLevel.mashiro = 1;
  const controller = new AbortController(); controller.abort();
  assert.equal(await f.entry.readLoverMilestone('mashiro', { signal: controller.signal }), false);
  same(s.loverEventsSeen, []);
});

await check('apart mornings mix in morning_away: not at home, not in Tokyo for Mashiro, not for a lover visiting Tokyo (#2024)', async f => {
  const lines = v => JSON.stringify(v.m);
  // 文面の決まり: 地元・東京に住む恋人は全員、離れている朝の一言を持つ。地元で会う前提の語を入れない。
  // （ドバイに住むヌールの遠距離の文は、地元にいる朝だけの hometown で持つ・DSR20）
  for (const id of ['tsumugi', 'minto', 'rio', 'ageha', 'mashiro', 'hiyori', 'samechan']) assert(lover.morning_away[id]?.length, id);
  for (const id of Object.keys(lover.morning_away).filter(id => !id.startsWith('_'))) assert(lover.morning[id], `${id}: has usual mornings`);
  for (const [id, pool] of Object.entries(lover.morning_away)) {
    if (id.startsWith('_')) continue;
    for (const v of pool) {
      assert(!v.hometown && !v.r, `${id}: away notes are read-only and never hometown`);
      assert.doesNotMatch(lines(v), /tonari|閉店後|今夜|お祝い|行きます/, `${id}: no same-day hometown plan`);
      for (const t of v.m) assert(!/。$/.test(t) && t.length <= 30, `${id}: ${t}`);
    }
  }
  const away = id => new Set(lover.morning_away[id].map(lines));
  const hometown = id => new Set(lover.morning[id].filter(v => v.hometown).map(lines));
  // 3日おきの朝を120日分たどり、届いた文のうち離れている朝の一言・地元前提の一言を数える（記念日に当たらない日で見る）。
  const tally = (s, id) => {
    const out = { away: 0, hometown: 0, notes: 0 };
    for (let day = 3; day <= 120; day++) {
      Object.assign(s, { day }); s.loverSince[id] = day - 7;
      const note = f.romance.loverMessages({ invitations: false }).find(m => m.id.startsWith(`_lover_morning_${id}`));
      if (!note) continue;
      out.notes++;
      const text = JSON.stringify(note.messages);
      if (away(id).has(text)) out.away++;
      if (hometown(id).has(text)) out.hometown++;
    }
    return out;
  };
  // 地元の恋人（つむぎ）: 地元・柚ヶ谷では混ぜない。東京・ドバイでは混ぜ、地元前提の一言は出さない。
  const s = f.chapterAt(4, ['tsumugi'], { day: 3, flags: { _ch2_region: 'home' } });
  for (const region of ['home', 'widehanga']) {
    s.flags._ch2_region = region;
    const t = tally(s, 'tsumugi');
    assert(t.notes > 0 && t.away === 0 && t.hometown > 0, `${region}: ${JSON.stringify(t)}`);
  }
  for (const region of ['tokyo', 'dubai']) {
    s.flags._ch2_region = region;
    const t = tally(s, 'tsumugi');
    assert(t.away > 0 && t.hometown === 0, `${region}: ${JSON.stringify(t)}`);
  }
  // 東京へ会いに来ている間（第3章の訪問。到着〜帰る日の前日）は一緒にいるので、離れている一言も地元前提の一言も無い。
  s.flags._ch2_region = 'tokyo';
  s.tokyoVisits = { plans: [{ characterId: 'tsumugi', status: 'staying', arrivalDay: 1, returnDay: 200 }], offers: {}, closedSlots: [] };
  const visiting = tally(s, 'tsumugi');
  assert(visiting.notes > 0 && visiting.away === 0 && visiting.hometown === 0, `visiting: ${JSON.stringify(visiting)}`);
  s.tokyoVisits.plans[0].status = 'returned';
  assert(tally(s, 'tsumugi').away > 0, 'After the visit she is far away again');

  // 東京に住むましろ: はじめが地元・ドバイにいる朝は離れている。東京にいる朝（第3章・第5章の東京）は同じ街。
  const m = f.chapterAt(4, ['mashiro'], { day: 3, flags: { _ch2_region: 'home' } });
  for (const region of ['home', 'dubai']) {
    m.flags._ch2_region = region;
    assert(tally(m, 'mashiro').away > 0, `mashiro while hajime is in ${region}`);
  }
  for (const chapter of [3, 5]) {
    Object.assign(m, { chapter }); m.flags._ch2_region = 'tokyo';
    assert.equal(tally(m, 'mashiro').away, 0, `mashiro is local in chapter ${chapter} Tokyo`);
  }
  // 場面カードの帰国後の tonari（印はドバイのまま・home を渡す）でも、ましろとは離れている。
  Object.assign(m, { chapter: 4, day: 30 }); m.flags._ch2_region = 'dubai'; m.loverSince.mashiro = 23;
  let found = false;
  for (let day = 3; day <= 120 && !found; day++) {
    Object.assign(m, { day }); m.loverSince.mashiro = day - 7;
    const note = f.romance.loverMessages({ invitations: false, home: true }).find(x => x.id.startsWith('_lover_morning_mashiro'));
    found = !!note && away('mashiro').has(JSON.stringify(note.messages));
  }
  assert(found, 'home: true reads Mashiro as far away');
});

await check('a hometown milestone waits while hajime is in Tokyo/Dubai and is read once he is home; others are not skipped (#2024)', async f => {
  const tagged = Object.values(f.db.dialogues).filter(d => /^lover_\w+_lv\d(?:_b)?$/.test(d.dialogue_id) && d.metadata?.hometown).map(d => d.dialogue_id).sort();
  same(tagged, ['lover_hiyori_lv1', 'lover_hiyori_lv1_b', 'lover_hiyori_lv2', 'lover_hiyori_lv5', 'lover_minto_lv2', 'lover_minto_lv3', 'lover_minto_lv4',
    'lover_minto_lv5', 'lover_rio_lv1', 'lover_tsumugi_lv2', 'lover_tsumugi_lv3']);
  // ましろの節目は東京（mukai）が舞台。東京では同じ街なので印を付けない（第5章は tonari で思い出す形・#2024 A2）。
  assert(!tagged.some(id => id.includes('mashiro')));
  // 第3章の東京: つむぎが会いに来た日のデート。lv1 は駅までの帰り道なので東京でも読める。
  const s = f.chapterThree(['tsumugi']);
  s.flags._ch2_region = 'tokyo';
  s.loveLevel.tsumugi = 3;
  same(f.entry.loverMilestonesDue(['tsumugi']), ['tsumugi']);
  assert.equal(await f.entry.readLoverMilestone('tsumugi'), true);
  same(f.plays, ['lover_tsumugi_lv1']);
  // lv2（はじめの部屋）・lv3（閉店後の tonari）は東京では読まない。lv3 へ飛ばして先に読むこともしない。
  assert.equal(f.romance.loverMilestoneDue('tsumugi'), null);
  same(f.entry.loverMilestonesDue(['tsumugi']), []);
  assert.equal(await f.entry.readLoverMilestone('tsumugi'), false);
  for (const region of ['dubai']) { s.flags._ch2_region = region; assert.equal(f.romance.loverMilestoneDue('tsumugi'), null, region); }
  // 場面カードの東京（印は地元のまま）は呼び出し側の home: false が勝つ。
  s.flags._ch2_region = 'home';
  same(f.entry.loverMilestonesDue(['tsumugi'], { home: false }), []);
  assert.equal(await f.entry.readLoverMilestone('tsumugi', { home: false }), false);
  same(f.plays, ['lover_tsumugi_lv1'], 'Nothing was read in Tokyo');
  // 帰ってから: lv2 → lv3 の順に読める。
  assert.equal(f.romance.loverMilestoneDue('tsumugi'), 'lover_tsumugi_lv2');
  assert.equal(await f.entry.readLoverMilestone('tsumugi'), true);
  s.flags._ch2_region = 'widehanga';
  assert.equal(f.romance.loverMilestoneDue('tsumugi'), 'lover_tsumugi_lv3');
  same(f.plays, ['lover_tsumugi_lv1', 'lover_tsumugi_lv2']);
  // 第3章の場面カード（chapters/ch3.js）は東京にいるかを playerRegion で渡す。
  assert.match(fs.readFileSync(path.join(root, 'chapters/ch3.js'), 'utf8'),
    /const home = playerRegion\(state\) === "home";[\s\S]*?loverMilestonesDue\(\[id\], \{ home \}\)[\s\S]*?readLoverMilestone\(id, \{ signal: controller\.signal, home \}\)/);
  // 第4章の帰国後の tonari は印がドバイのまま。場面の home を節目にも渡す。
  const ch4 = fs.readFileSync(path.join(root, 'chapters/ch4.js'), 'utf8');
  assert.match(ch4, /lover\.loverMilestonesDue\([^;]*, \{ home \}\)/);
  assert.match(ch4, /lover\.readLoverMilestone\(id, \{ signal: controller\.signal, home \}\)/);
});

await check('chapter runners call the shared entry (no duplicated lover logic)', async () => {
  const src = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(src('chapters/ch3-social.js'), /from "\.\/lover-entry\.js"/);
  assert.match(src('chapters/ch3.js'), /if \(kind === "date"\) await readLoverMilestoneAt\(owner, id\)/);
  assert.match(src('chapters/ch4.js'), /import\("\.\/lover-entry\.js"\)/);
  // 第5章の自由行動は日常ループ（#2033）。帰郷後なので、恋人の誘い・デート・節目は第1・2章と同じ（IR16・IR17）。
  // 夜の告白も閉じない（第4章までに入った恋愛ルートの持ち越しだけ。第5章で初めての締めくくりは romanceRouteOpen が閉じる・IR33）。
  const ch5Daily = src('chapters/ch5-daily.js');
  assert.match(ch5Daily, /runDaily\(/);
  assert.doesNotMatch(ch5Daily, /dateInvitations:\s*false/);
  assert.doesNotMatch(ch5Daily, /confessions:\s*false/);
  // 第3章の東京・第4章のドバイは誘いを閉じたまま（IR16）。ドバイでは節目を出さず、同行者はLIMEを送ってこない（IR17）。
  assert.match(src('chapters/ch3-tokyo-daily.js'), /dateInvitations:\s*false/);
  const ch4Daily = src('chapters/ch4-dubai-daily.js');
  assert.match(ch4Daily, /dateInvitations:\s*false/);
  assert.match(ch4Daily, /confessions:\s*false/);
  assert.match(ch4Daily, /withLovers: \(\) => \[overseasCompanion\(state\)\.companion\]\.filter\(Boolean\)/);
  const calendar = src('daily/calendar.js');
  assert.match(calendar, /deliverMorning\(\{ fixedNight, invitations: chapterDef\.dateInvitations !== false,\s*exclude: chapterDef\.withLovers\?\.\(\) \|\| \[\] \}\)/);
  assert.match(calendar, /chapterDef\.confessions === false \? false/);
  // 日常ループの節目は、デートの読了後（romance.js の playDate）だけ。誘いの無い章では節目は進まない。
  assert.doesNotMatch(calendar, /playLoverMilestone|loverMilestoneDue/);
  assert.doesNotMatch(ch4Daily, /lover-entry|playLoverMilestone|readLoverMilestone/);
  // 第3章の大会の朝は、共通の入口から応援を届ける（IR19）。
  assert.match(src('chapters/ch3-tournament.js'), /readTournamentCheers\(\{ away \}\)/);
  // 場面カードは地元にいるかを入口へ渡す（#2024）。第4章は既存の home（帰国後の tonari）、第3章は playerRegion（帰郷の後）。
  const ch4 = src('chapters/ch4.js');
  assert.match(ch4, /lover\.pendingLoverLime\(\{ exclude, home \}\)/);
  assert.match(ch4, /lover\.readLoverLime\(\{ exclude, home \}\)/);
  const social = src('chapters/ch3-social.js');
  assert.match(social, /pendingLoverLime\(\{ senders: \[id\], home: playerRegion\(state\) === "home" \}\)/);
  assert.match(social, /readLoverLime\(\{ senders: \[loverRead\], home: playerRegion\(state\) === "home" \}\)/);
  assert.doesNotMatch(src('chapters/lover-entry.js'), /lover_\$\{|limePhase|morning/, 'Text and timing stay in romance.js / lover.json');
});

console.log(`ch3_lover_entry: ${count} checks passed`);
