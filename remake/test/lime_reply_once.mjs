// #673: controlled async regressions against the complete production phone module.
// Unit probes are not counted as real-browser reproduction.
// node --experimental-vm-modules --test remake/test/lime_reply_once.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await fs.readFile(new URL('../js/daily/phone.js', import.meta.url), 'utf8');
const mediaCatalog = JSON.parse(await fs.readFile(new URL('../data/lime_media.json', import.meta.url), 'utf8'));
const limeTemplates = JSON.parse(await fs.readFile(new URL("../../data/lime_messages.json", import.meta.url), "utf8")).templates;
const response = { text: '頑張ります', response: 'うん、お互いにね', affinity: 1 };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

async function fixture({ lover = false, reply = response, invitation = false, cost = 0 } = {}) {
  const nodes = [], timers = new Map();
  const element = (spec, attrs = {}, children = []) => {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    const node = { spec, ...attrs, children: [...children], style: {}, isConnected: true,
      classList: { add() {}, remove() {} }, append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; }, remove() { this.isConnected = false; } };
    nodes.push(node); return node;
  };
  const original = { phase: 'daily', chapter: 1, day: 5, slot: 0, met: {}, flags: {}, inbox: [], limeRead: [], gains: [], lovers: lover ? ['minto'] : [] };
  let current = original;
  const bond = { private: false };
  const notes = [];
  const noop = () => {};
  const imports = {
    'util.js': { el: element, sleep: async () => {}, fitOneLine: noop, yen: String },
    'data.js': { DB: { lime: [], limeTemplates, manifest: { limeMedia: mediaCatalog } }, displayName: String, faceIconUrl: noop },
    'lime-icons.js': { customLimeIconUrl: () => null },
    'ui.js': { layers: { modal: element('modal') }, toast: noop }, 'tsumugi-schedule.js': { tsumugiAtTonari: () => false, tsumugiMessages: () => [], TSUMUGI_STORY: [] }, 'casual-lime.js': { casualMessages: () => [] }, 'state.js': { state: current }, 'rules.js': { TOURNAMENT_DAY: 14 },
    'chapter-clock.js': { chapterDay: () => 5 },
    'travel-budget.js': { spendableMoney: () => 30000 },
    'stats.js': { gainAffinity: (id, pts, opts) => { current.gains.push({ id, pts, private: bond.private }); if (pts > 0) opts?.onGain?.(.2125); },
      affinityLevel: () => 1, applyStats: noop, bond },
    'audio.js': { SE: { phoneReceive: noop } }, 'engine.js': { hooks: {} }, 'text.js': { formatHtml: String },
    'spots.js': { hasContact: noop, spotById: noop, isClosed: noop },
    'romance.js': { loverMessages: noop, isLover: id => current.lovers.includes(id), dateSchedule: noop },
    'bonds.js': { bondInvites: noop, friendMessages: noop },
    'story-knowledge.js': { syncMintoKnowledge: noop }, 'hiyori-route.js': { hiyoriEventStatus: noop },
    'story-contact.js': { storyThreadStatus: () => null },
    'invitations.js': { invitationCost: () => cost, storeInvitationSpot: noop, visitReminderSpot: noop, invitationVisitSpot: noop, immediateInvitation: () => false, missedInvitationNote: () => null },
  };
  const context = vm.createContext({ console, setTimeout: (fn, ms) => { const id = {}; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: noop, document: {}, Math, Date, Set, Promise });
  const modules = new Map();
  const phone = new vm.SourceTextModule(source + '\nexport { runItem as testRunItem, receiveItem, scheduledInvitation, messageContent, phoneShell, sumiBaitoInvite };', { context });
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
  const picks = [], bubbles = [], media = [], held = [];
  const ui = { gen: 0, open: true, live(g) { return this.open && this.gen === g; },
    choose(options) { const pick = deferred(); pick.options = options; picks.push(pick); return pick.promise; },
    bubble(text, mine, sender, animate = true) {
      bubbles.push({ text, mine, animate });
      if (!animate) return Promise.resolve();
      const hold = deferred(); held.push(hold); return hold.promise;
    }, media(content, sender, animate) { media.push({ content, sender, animate }); return Promise.resolve(); },
    note: value => notes.push(value) };
  return { nodes, timers, api: phone.namespace, original, bond, item, ui, picks, bubbles, media, held, reply, notes,
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


test('media snapshots preserve templates and enforce chapter, account, owner, count and resend', async () => {
  const f = await fixture();
  const template = { id: 'media', sender: 'adam', messages: [
    'hello', { sender: 'adam', stamp: 'st_adam_bless', media_chapters: [1] },
    { sender: 'adam', image: 'im_adam_moon' }, { text: 'bye' },
  ] };
  const original = JSON.stringify(template);
  const receive = () => JSON.parse(JSON.stringify(f.api.receiveItem(template)));
  assert.equal(receive().msg.messages.length, 3);
  assert.equal(JSON.stringify(template), original);
  f.original.chapter = 2;
  // The second asset has no explicit chapter limit and can appear in chapters 1–3.
  assert.equal(receive().msg.messages[1].image, 'im_adam_moon');
  f.original.chapter = 4;
  assert.equal(receive().msg.messages.length, 2);
  f.original.chapter = 1;
  const first = receive(); f.original.inbox.push(first);
  f.original.day += 4;
  assert.equal(receive().msg.messages.length, 2); // same origin
  template.id = 'next';
  assert.equal(receive().msg.messages.length, 2); // consecutive topic
  f.original.inbox.push({ id: 'text', day: 8, msg: { sender: 'adam', messages: ['text'] }, log: [] });
  f.original.day = 7;
  assert.equal(receive().msg.messages.length, 2); // less than 3 days
  f.original.day = 8;
  assert.equal(receive().msg.messages.length, 3); // exactly 3 days
  delete first.day;
  assert.equal(receive().msg.messages.length, 2); // unknown legacy date is conservative
  const privateFixture = await fixture({ lover: true });
  const minto = { id: 'welcome', sender: 'minto', messages: ['hi', { stamp: 'st_minto_welcome' }] };
  assert.equal(privateFixture.api.receiveItem(minto).msg.messages.length, 1);
  assert.equal(f.api.receiveItem(minto).msg.messages.length, 2);
  assert.equal(f.api.messageContent({ image: 'missing' }).fallback, '［画像を表示できません］');
});

test('accepted invitation saves one existing acknowledgement after the player reply', async () => {
  const f = await fixture({ invitation: true });
  f.original.day = f.item.day = 3;
  f.item.id = 'sumi-invite';
  const generated = f.api.sumiBaitoInvite();
  const legacy = { id: '_sumi_baito_inv_d3', sender: 'sumi', type: 'invitation', time_slot: 'noon',
    accept_event: '__sumi_baito__', accept_text: '入ります！',
    accept_reply: { sender: 'sumi', stamp: 'st_sumi_ack' },
    hint: '乗るとそのまま昼のシフトへ（行動を1回使う）。いつもの給料に上乗せがつく',
    messages: ['急で悪い。今日、昼のシフト入れるか？', '常連の団体が入ってな。人手が足りん', '……代わりと言っちゃなんだが、給料は弾むぞ'],
    decline_response: { text: '……そうか。なら、こっちで回す' } };
  assert.deepEqual(JSON.parse(JSON.stringify(generated)), legacy);
  f.item.msg = JSON.parse(JSON.stringify(legacy)); // A serialized pre-template save.
  assert.equal(f.item.msg.accept_reply.stamp, 'st_sumi_ack');
  const run = f.run(); f.picks[0].resolve({ text: '入ります！', go: true });
  await flush(); await f.finish(); await run;
  assert.deepEqual(logs(f.item).slice(0, 2), [
    { me: true, text: '入ります！' }, { me: false, sender: 'sumi', stamp: 'st_sumi_ack' },
  ]);
  assert.equal(f.media.length, 1);
  assert.equal(f.media[0].content.asset.owner, 'sumi');
  assert.equal(f.item.log.filter(line => line.stamp).length, 1);
});

test('reply acknowledgement obeys owner, account and recent-media spacing limits', async () => {
  const f = await fixture({ invitation: true });
  f.item.day = f.original.day;
  const offer = { sender: 'minto', stamp: 'st_minto_welcome' };
  f.item.msg.accept_reply = offer;
  f.item.msg.messages = ['hello'];
  f.original.inbox.push({ id: 'prior', day: 4, msg: { sender: 'minto', messages: ['hi'] }, log: [{ stamp: 'st_minto_cheer' }] });
  let run = f.run(); f.picks[0].resolve({ text: '行く！', go: true }); await flush(); await f.finish(); await run;
  assert.equal(f.item.log.some(line => line.stamp), false, 'recent owner media blocks the reply');
  const g = await fixture({ invitation: true });
  g.item.msg.accept_reply = { sender: 'adam', stamp: 'st_adam_bless' };
  run = g.run(); g.picks[0].resolve({ text: '行く！', go: true }); await flush(); await g.finish(); await run;
  assert.equal(g.item.log.some(line => line.stamp), false, 'wrong owner is rejected');
  const h = await fixture({ invitation: true, lover: true });
  h.item.account = 'minto_private';
  h.item.msg.accept_reply = offer;
  run = h.run(); h.picks[0].resolve({ text: '行く！', go: true }); await flush(); await h.finish(); await run;
  assert.equal(h.item.log.some(line => line.stamp), false, 'private account is rejected');
});

test('reply acknowledgement is suppressed outside media chapters and when a thread already has media', async () => {
  const f = await fixture({ invitation: true });
  f.item.msg.accept_reply = { sender: 'minto', stamp: 'st_minto_cheer' };
  f.original.chapter = 4;
  let run = f.run(); f.picks[0].resolve({ text: '行く！', go: true }); await flush(); await f.finish(); await run;
  assert.equal(f.item.log.some(line => line.stamp), false);
  const g = await fixture({ invitation: true });
  g.item.msg.accept_reply = { sender: 'minto', stamp: 'st_minto_cheer' };
  g.item.msg.messages = [{ sender: 'minto', stamp: 'st_minto_welcome' }];
  run = g.run(); g.picks[0].resolve({ text: '行く！', go: true }); await flush(); await g.finish(); await run;
  assert.equal(g.item.log.some(line => line.stamp), false);
});

test('a chat choice can send its own media reply exactly once', async () => {
  const f = await fixture({ reply: { text: '了解！', response: 'またね', response_media: { sender: 'minto', stamp: 'st_minto_cheer' } } });
  const run = f.run(); f.picks[0].resolve(f.reply); await flush(); await f.finish(); await run;
  assert.deepEqual(logs(f.item), [
    { me: true, text: '了解！' }, { me: false, sender: 'minto', stamp: 'st_minto_cheer' },
    { me: false, text: 'またね' },
  ]);
  assert.equal(f.media.length, 1);
  await f.run();
  assert.equal(f.item.log.filter(line => line.stamp).length, 1);
});

test('media received through log survives save-shaped history and spaces later media', async () => {
  const f = await fixture();
  const old = { id: 'old', day: 3, account: 'minto_private', msg: { sender: 'minto', messages: ['hi'] },
    log: [{ me: false, stamp: 'st_minto_welcome' }] };
  f.original.inbox.push(JSON.parse(JSON.stringify(old)), { id: 'text', day: 4, msg: { sender: 'minto', messages: ['text'] } });
  const m = { id: 'new', sender: 'minto', messages: ['hi', { stamp: 'st_minto_welcome' }] };
  assert.equal(f.api.receiveItem(m).msg.messages.length, 1);
  f.original.day = 6;
  assert.equal(f.api.receiveItem(m).msg.messages.length, 2);
});


test('scheduled invitation renders text only and keeps media attributes', async () => {
  const f = await fixture();
  const media = { sender: 'adam', image: 'im_adam_moon', media_chapters: [1] };
  const m = { sender: 'adam', private_schedule: 'holiday_or_temporary', closed_on: 5,
    messages: [{ text: '{privateContext}' }, media, '{privateWhen}'] };
  const result = f.api.scheduledInvitation(m);
  assert.equal(result.messages[0].text, '今日はお店がお休みだから、午後');
  assert.deepEqual(JSON.parse(JSON.stringify(result.messages[1])), media);
  assert.notEqual(result.messages[1], media);
  assert.equal(result.messages[2], '午後');
  assert(!JSON.stringify(result).includes('undefined'));
});

test('media wait is bounded, history is immediate and stale callbacks cannot change DOM', async () => {
  const f = await fixture();
  const ui = f.api.phoneShell({ time: '昼', title: 'test' });
  const content = f.api.messageContent({ image: 'im_adam_moon' });
  const drawing = ui.media(content, 'adam', true);
  const image = f.nodes.findLast(node => node.spec === 'img');
  const box = f.nodes.findLast(node => node.spec === 'div.lime-media.lime-image');
  assert.equal(box.style.aspectRatio, '960 / 720');
  assert.equal(image.alt, '夜空の月と枝先');
  assert.equal([...f.timers.values()][0].ms, 3000);
  [...f.timers.values()][0].fn();
  await drawing;
  assert.equal(box.children[0].text, '［画像を表示できません］');
  assert.equal(image.onload, null);
  assert.equal(f.timers.size, 0);
  await ui.media(content, 'adam', false); // resolves before onload/error/timeout
  const pastImage = f.nodes.findLast(node => node.spec === 'img');
  pastImage.onload();
  assert.equal(f.timers.size, 0);
  const stale = ui.media(content, 'adam', true);
  const staleImage = f.nodes.findLast(node => node.spec === 'img');
  const staleBox = f.nodes.findLast(node => node.spec === 'div.lime-media.lime-image');
  ui.gen++;
  staleImage.onerror();
  await stale;
  assert.equal(staleBox.children[0], staleImage);
  const loaded = ui.media(content, 'adam', true);
  const loadImage = f.nodes.findLast(node => node.spec === 'img');
  const loadBox = f.nodes.findLast(node => node.spec === 'div.lime-media.lime-image');
  f.replaceState();
  loadImage.onerror(); await loaded;
  assert.equal(loadBox.children[0], loadImage);
});

test('reply layout is established before scrolling to the last message', async () => {
  const f = await fixture();
  const ui = f.api.phoneShell({ time: '昼', title: 'test' });
  Object.defineProperty(ui.chat, 'scrollHeight', { get: () => ui.actions.children.length ? 900 : 500 });
  ui.chat.scrollTop = 500;
  const choice = ui.choose([{ label: '行きます！（行動1回・3,000円必要）', wrap: true }, { text: '今日は難しいです' }]);
  assert.equal(ui.chat.scrollTop, 900, 'scroll after reply buttons change the available chat height');
  const buttons = ui.actions.children;
  assert.match(buttons[0].spec, /\.multiline/);
  assert.doesNotMatch(buttons[1].spec, /\.multiline/);
  ui.cancel(); await choice;
});

test('attachment space is reserved before scrolling, including unread and history draws', async () => {
  const f = await fixture();
  const ui = f.api.phoneShell({ time: '昼', title: 'test' });
  Object.defineProperty(ui.chat, 'scrollHeight', { get: () =>
    f.nodes.findLast(node => node.spec === 'div.lime-media.lime-image')?.style.aspectRatio ? 900 : 500 });
  const drawing = ui.media(f.api.messageContent({ image: 'im_adam_moon' }), 'adam', true);
  assert.equal(ui.chat.scrollTop, 900, 'unread image dimensions contribute before scroll');
  f.nodes.findLast(node => node.spec === 'img').onload(); await drawing;
  ui.chat.scrollTop = 0;
  await ui.media(f.api.messageContent({ image: 'im_adam_moon' }), 'adam', false);
  assert.equal(ui.chat.scrollTop, 900, 'history also scrolls after reserving image dimensions');
});


test('only a priced invitation opts into wrapping without changing the acceptance choice', async () => {
  for (const cost of [0, 3000]) {
    const f = await fixture({ invitation: true, cost });
    const pending = f.run(); await flush();
    const choice = f.picks[0].options[0];
    assert.equal(choice.wrap, !!cost);
    assert.equal(choice.go, true);
    assert.equal(choice.text, '行く！');
    if (cost) assert.match(choice.label, /3000必要/);
    f.picks[0].resolve(null); await pending;
    assert.equal(f.item.done, false);
    assert.equal(f.original.pendingInvite, undefined);
  }
});
