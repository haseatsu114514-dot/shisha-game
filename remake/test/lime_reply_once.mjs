// #673: controlled async regressions against the complete production phone module.
// Unit probes are not counted as real-browser reproduction.
// node --experimental-vm-modules --test remake/test/lime_reply_once.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await fs.readFile(new URL('../js/daily/phone.js', import.meta.url), 'utf8');
const response = { text: '頑張ります', response: 'うん、お互いにね', affinity: 1 };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

async function fixture({ lover = false, reply = response, invitation = false } = {}) {
  const original = { phase: 'daily', day: 5, slot: 0, flags: {}, inbox: [], limeRead: [], gains: [], lovers: lover ? ['minto'] : [] };
  let current = original;
  const bond = { private: false };
  const notes = [];
  const noop = () => {};
  const imports = {
    'util.js': { el: noop, sleep: async () => {}, fitOneLine: noop, yen: String },
    'data.js': { DB: { lime: [] }, displayName: String, faceIconUrl: noop },
    'ui.js': { layers: {}, toast: noop }, 'tsumugi-schedule.js': { tsumugiAtTonari: () => false, tsumugiMessages: () => [], TSUMUGI_STORY: [] }, 'state.js': { state: current }, 'rules.js': { TOURNAMENT_DAY: 14 },
    'chapter-clock.js': { chapterDay: () => 5 },
    'travel-budget.js': { spendableMoney: () => 30000 },
    'stats.js': { gainAffinity: (id, pts, opts) => { current.gains.push({ id, pts, private: bond.private }); if (pts > 0) opts?.onGain?.(.2125); },
      affinityLevel: () => 1, applyStats: noop, bond },
    'audio.js': { SE: {} }, 'engine.js': { hooks: {} }, 'text.js': { formatHtml: String },
    'spots.js': { hasContact: noop, spotById: noop, isClosed: noop },
    'romance.js': { loverMessages: noop, isLover: id => current.lovers.includes(id), dateSchedule: noop },
    'bonds.js': { bondInvites: noop, friendMessages: noop },
    'story-knowledge.js': { syncMintoKnowledge: noop }, 'hiyori-route.js': { hiyoriEventStatus: noop },
    'story-contact.js': { storyThreadStatus: () => null },
    'invitations.js': { invitationCost: () => 0, storeInvitationSpot: noop, visitReminderSpot: noop, invitationVisitSpot: noop, immediateInvitation: () => false, missedInvitationNote: () => null },
  };
  const context = vm.createContext({ console, setTimeout, requestAnimationFrame: noop, document: {}, Math, Date, Set, Promise });
  const modules = new Map();
  const phone = new vm.SourceTextModule(source + '\nexport { runItem as testRunItem };', { context });
  await phone.link(async specifier => {
    const key = specifier.split('/').at(-1);
    if (!modules.has(key)) {
      const values = imports[key]; assert(values, key);
      modules.set(key, new vm.SyntheticModule(Object.keys(values), function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      }, { context }));
    }
    return modules.get(key);
  });
  await phone.evaluate();
  const item = { id: 'lime_minto_day5', read: true, done: false, replyState: 'waiting', log: [],
    msg: { type: 'chat', sender: 'minto', replies: [reply] } };
  if (invitation) Object.assign(item, { day: 5, msg: { id: item.id, type: 'invitation', sender: 'minto', time_slot: 'noon', accept_event: 'outing_minto_1' } });
  original.inbox.push(item);
  const picks = [], bubbles = [], held = [];
  const ui = { gen: 0, open: true, live(g) { return this.open && this.gen === g; },
    choose() { const pick = deferred(); picks.push(pick); return pick.promise; },
    bubble(text, mine, sender, animate = true) {
      bubbles.push({ text, mine, animate });
      if (!animate) return Promise.resolve();
      const hold = deferred(); held.push(hold); return hold.promise;
    }, note: value => notes.push(value) };
  return { original, bond, item, ui, picks, bubbles, held, reply, notes,
    run: (target = item) => phone.namespace.testRunItem(target, ui, []),
    replaceState() {
      current = { inbox: [], limeRead: [], gains: [], lovers: [] };
      modules.get('state.js').setExport('state', current); return current;
    },
    async finish() { for (let i = 0; i < 8; i++) { for (const h of held) h.resolve(); await flush(); } },
  };
}

const logs = item => JSON.parse(JSON.stringify(item.log));
const expectedLog = [ { me: true, text: response.text }, { me: false, text: response.response } ];

test('two pending selections for the same message settle once before animation', async () => {
  const f = await fixture(); const a = f.run(), b = f.run();
  f.picks[0].resolve(f.reply); f.picks[1].resolve(f.reply); await flush();
  assert.equal(f.original.gains.length, 1); assert.equal(f.item.done, true);
  assert.equal(f.item.replyState, 'replied'); assert.deepEqual(logs(f.item), expectedLog);
  await f.finish(); await Promise.all([a, b]);
  assert.equal(f.original.gains.length, 1);
  assert.deepEqual(f.notes, ['♡ ほんの少し仲良くなった']);
});

test('back/reentry during the sent bubble cannot offer another reply', async () => {
  const f = await fixture(); const first = f.run(); f.picks[0].resolve(f.reply); await flush();
  f.ui.gen++;
  const reopened = f.run(); await flush();
  assert.equal(f.picks.length, 1); assert.deepEqual(logs(f.item), expectedLog);
  await f.finish(); await Promise.all([first, reopened]);
  assert.equal(f.original.gains.length, 1);
  assert.equal(f.bubbles.filter(b => b.animate).length, 1, 'old generation must not start the peer animation');
  assert.deepEqual(f.notes, ['♡ ほんの少し仲良くなった']);
});

test('a selected choice whose item was already completed is rejected', async () => {
  const f = await fixture(); const pending = f.run();
  f.item.done = true; f.item.replyState = 'replied';
  f.item.log.push(...expectedLog); f.original.gains.push({ id: 'minto', pts: 1 });
  f.picks[0].resolve(f.reply); await flush(); await f.finish(); await pending;
  assert.equal(f.original.gains.length, 1); assert.deepEqual(logs(f.item), expectedLog);
});

test('state replacement while choosing rejects the old choice without writing either save', async () => {
  const f = await fixture(); const pending = f.run(); const fresh = f.replaceState();
  f.picks[0].resolve(f.reply); await flush(); await f.finish(); await pending;
  assert.equal(f.original.gains.length, 0); assert.equal(fresh.gains.length, 0);
  assert.equal(f.item.done, false); assert.deepEqual(logs(f.item), []);
});

test('state replacement after selection leaves its committed result on the old save only', async () => {
  const f = await fixture(); const pending = f.run(); f.picks[0].resolve(f.reply); await flush();
  const fresh = f.replaceState(); await f.finish(); await pending;
  assert.equal(f.original.gains.length, 1); assert.equal(fresh.gains.length, 0);
  assert.deepEqual(logs(f.item), expectedLog); assert.equal(f.bubbles.length, 1);
});

test('leaving an unselected reply keeps it resumable', async () => {
  const f = await fixture(); const pending = f.run(); f.picks[0].resolve(null); await pending;
  assert.equal(f.item.done, false); assert.deepEqual(logs(f.item), []); assert.equal(f.original.gains.length, 0);
});

test('a presentation error cannot lose or duplicate the already accepted result', async () => {
  const f = await fixture(); f.ui.bubble = async () => { throw Error('presentation failed'); };
  const pending = f.run(); f.picks[0].resolve(f.reply);
  await assert.rejects(pending, /presentation failed/);
  assert.equal(f.item.done, true); assert.deepEqual(logs(f.item), expectedLog);
  assert.equal(f.original.gains.length, 1); assert.equal(f.bond.private, false);
});

for (const [name, lover, points, expected] of [['zero reward', false, 0, 0], ['existing lover multiplier', true, 1, 3]]) {
  test(name + ' remains unchanged', async () => {
    const f = await fixture({ lover, reply: { ...response, affinity: points } });
    const pending = f.run(); f.picks[0].resolve(f.reply); await flush(); await f.finish(); await pending;
    assert.deepEqual(f.original.gains.map(x => x.pts), [expected]); assert.equal(f.bond.private, false);
  });
}

for (const mode of ['reentry', 'load']) test(`invitation commits before animation: ${mode}`, async () => {
  const f = await fixture({ invitation: true });
  const run = f.run();
  f.picks[0].resolve({ text: '行く！', go: true }); await flush();
  assert.equal(f.item.result, 'accepted');
  assert.equal(f.item.completed, undefined);
  assert.equal(f.original.pendingInvite.event, 'outing_minto_1');
  assert.equal(f.original.gains.length, 0);
  if (mode === 'reentry') { f.ui.gen++; f.run(); await flush(); assert.equal(f.picks.length, 1); }
  if (mode === 'load') { const loaded = f.replaceState(); await f.finish(); await run; assert.equal(loaded.pendingInvite, undefined); return; }
  const saved = JSON.parse(JSON.stringify(f.original));
  assert.equal(saved.pendingInvite.originId, f.item.id);
  await f.finish(); await run;
  assert.equal(f.item.log.filter(x => x.me).length, 1);
});

test('invitation cannot commit an old selection after LOAD', async () => {
  const f = await fixture({ invitation: true }); const run = f.run();
  const loaded = f.replaceState();
  f.picks[0].resolve({ text: '行く！', go: true }); await run;
  assert.equal(f.item.done, false); assert.equal(loaded.pendingInvite, undefined);
});
test('two overlapping invitation selections keep the first appointment', async () => {
  const f = await fixture({ invitation: true }); const a = f.run(), b = f.run();
  f.picks[0].resolve({ text: '行く！', go: true }); f.picks[1].resolve({ text: '行く！', go: true }); await flush();
  assert.equal(f.item.log.filter(x => x.me).length, 1);
  assert.equal(f.original.pendingInvite.event, 'outing_minto_1');
  await f.finish(); await Promise.all([a, b]);
});

test('acceptance keeps the first destination and does not read or accept a conflicting invitation', async () => {
  const f = await fixture({ invitation: true });
  const other = { ...f.item, id: 'other', read: false, log: [], msg: { ...f.item.msg, id: 'other', sender: 'adam', accept_event: 'outing_adam_1' } };
  f.original.inbox.push(other);
  const run = f.run(); f.picks[0].resolve({ text: '行く！', go: true }); await flush();
  assert.equal(f.original.pendingInvite.event, 'outing_minto_1');
  assert.equal(other.read, false); assert.equal(other.result, 'conflict_declined');
  assert.equal(other.completed, undefined); assert.equal(f.item.completed, undefined);
  await f.finish(); await run;
});
test('an invitation expiring while its selection is pending is not accepted', async () => {
  const f = await fixture({ invitation: true }); const run = f.run();
  f.original.slot = 2; f.picks[0].resolve({ text: '行く！', go: true }); await run;
  assert.equal(f.original.pendingInvite, undefined); assert.equal(f.item.done, false);
});
