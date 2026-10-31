// 第3章以降の恋人の入口（#2024）: 実物の state/stats/romance と chapters/lover-entry.js を読み、
// 恋人LIME（lover.json）と節目（lover_events.json）が第3章でも進むことを確かめる。VN・端末は記録だけの port。
// node --experimental-vm-modules remake/test/ch3_lover_entry.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../js/', import.meta.url));
const realPaths = ['core/state.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','core/chapter-clock.js','daily/date-scene.js','daily/romance.js','daily/samechan-bonds.js','chapters/lover-entry.js'];
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
  return { core, stats: ns('core/stats.js'), romance: ns('daily/romance.js'), entry: ns('chapters/lover-entry.js'), plays, phones, chapterThree };
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
  assert.equal(f.romance.loverMessages().find(m => m.sender === 'mashiro')?.type, 'invitation',
    'The chapter 1-2 morning would invite her to a date that chapter 3 cannot keep');
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
  const s = f.chapterThree(['ageha'], 31);
  Object.assign(s, { chapter: 4 });
  const due = f.entry.pendingLoverLime();
  same(due.map(m => m.id), ['_lover_morning_ageha_d31']);
  same(f.entry.pendingLoverLime({ exclude: ['ageha'] }), []);
  same(f.entry.loverMilestonesDue(), ['ageha']);
  assert.equal(await f.entry.readLoverMilestone('ageha'), true);
  same(f.plays, ['lover_ageha_lv1']);
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
  assert.match(src('chapters/ch5.js'), /import\("\.\/lover-entry\.js"\)/);
  assert.doesNotMatch(src('chapters/lover-entry.js'), /lover_\$\{|limePhase|morning/, 'Text and timing stay in romance.js / lover.json');
});

console.log(`ch3_lover_entry: ${count} checks passed`);
