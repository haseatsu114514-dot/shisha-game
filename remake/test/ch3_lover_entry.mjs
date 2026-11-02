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
const realPaths = ['core/state.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','core/chapter-clock.js','daily/date-scene.js','daily/romance.js','daily/samechan-bonds.js','daily/samechan-date.js','chapters/lover-entry.js'];
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
  assert.match(fs.readFileSync(path.join(root, 'chapters/lover-entry.js'), 'utf8'), /loverMessages\(\{ invitations: false \}\)/);
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

await check('chapter runners call the shared entry (no duplicated lover logic)', async () => {
  const src = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(src('chapters/ch3-social.js'), /from "\.\/lover-entry\.js"/);
  assert.match(src('chapters/ch3.js'), /if \(kind === "date"\) await readLoverMilestoneAt\(owner, id\)/);
  assert.match(src('chapters/ch4.js'), /import\("\.\/lover-entry\.js"\)/);
  // 第5章の自由行動は日常ループ（#2033）。帰郷後なので、恋人の誘い・デート・節目は第1・2章と同じ（IR16・IR17）。告白は出さない。
  const ch5Daily = src('chapters/ch5-daily.js');
  assert.match(ch5Daily, /runDaily\(/);
  assert.doesNotMatch(ch5Daily, /dateInvitations:\s*false/);
  assert.match(ch5Daily, /confessions:\s*false/);
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
  assert.doesNotMatch(src('chapters/lover-entry.js'), /lover_\$\{|limePhase|morning/, 'Text and timing stay in romance.js / lover.json');
});

console.log(`ch3_lover_entry: ${count} checks passed`);
