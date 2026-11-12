// Actual catering/model/daily modules, with rendering and unrelated chapter dependencies replaced.
// node --experimental-vm-modules remake/test/ch5_catering_integration.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const original = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch5_catering.json', import.meta.url), 'utf8'));
const DB = { dialogues: Object.fromEntries(original.dialogues.map(d => [d.dialogue_id, d])) };
const context = vm.createContext({ console });
const callbacks = new Map(), notices = [], messages = [], modals = [];
let current, choices = [], playing = [], saved = 0, scenes = [], onModal, onPlay;
const fresh = () => ({ chapter: 5, day: 42, slot: 0, phase: 'daily', money: 1000, stamina: 100, kujiTickets: 0,
  flags: { _ch5: { startDay: 40, part: 'free' }, _ch2_region: 'home' }, inbox: [] });
const noop = () => {};
const reset = () => { current = fresh(); stateModule.setExport('state', current); choices = []; playing = []; messages.length = 0;
  notices.length = 0; modals.length = 0; saved = 0; scenes = []; onModal = onPlay = null; };
const values = {
  DB, save: () => saved++, timeOfDay: () => current.slot ? 'night' : 'day', sceneBg: ref => ({ url: ref }),
  modal: async data => { modals.push(data); onModal?.(); return choices.shift(); }, setBg: async () => {},
  toast: text => notices.push(text), play: async id => { scenes.push(id); onPlay?.(); return playing.length ? playing.shift() : {}; },
  readDialogues: async () => DB.dialogues,
  addMoney: n => { current.money = Math.min(9999999, current.money + n); },
  addStamina: n => { current.stamina += n; }, earnStat: noop,
  grantKujiTickets: n => (current.kujiTickets += n, n),
  registerLimeReplyAction: (name, fn) => callbacks.set(name, fn),
  deliverLimeMessage: msg => { messages.push(msg); current.inbox.push({ id: msg.id, day: current.day, msg, read: false, log: [] }); },
  chapterFiveFreeRemaining: () => [{ id: 'ch5_tsumugi_serving', location: 'tonari' }],
  chapterFiveRead: () => true, chapterFiveProgress: () => current.flags._ch5,
  noteShopStamp: noop, allSpots: () => [], chapterFiveShops: () => [], chapterFiveTokyoPin: () => null, chapterFiveDubaiPin: () => null,
  inTokyo: () => current.flags._ch2_region === 'tokyo', inDubai: () => current.flags._ch2_region === 'dubai',
  tokyoNight: async () => {}, dubaiNight: async () => {}, returnCityHome: async () => {},
  TOKYO_SPOTS: [], DUBAI_SPOTS: [], CITY_SHOP: {}, MAP: {}, CH5_PREP_TRIALS: [],
};
const stateModule = new vm.SyntheticModule(['state', 'save', 'timeOfDay'], function () {
  this.setExport('state', current); this.setExport('save', values.save); this.setExport('timeOfDay', values.timeOfDay);
}, { context });
current = fresh();
const modules = new Map();
const real = new Set(['chapters/ch5-catering-model.js', 'chapters/ch5-catering.js', 'chapters/ch5-daily.js', 'daily/tsumugi-schedule.js']);
async function load(rel) {
  if (modules.has(rel)) return modules.get(rel);
  let source = fs.readFileSync(path.join(root, rel), 'utf8');
  if (rel === 'chapters/ch5-daily.js') source += '\nexport { contactDoctor };';
  const mod = new vm.SourceTextModule(source, { context, identifier: rel });
  modules.set(rel, mod);
  await mod.link(async spec => {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    if (target === 'core/state.js') return stateModule;
    if (real.has(target)) return load(target);
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .find(m => m[2] === spec)?.[1].split(',').map(n => n.trim()).filter(Boolean) || [];
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? noop);
    }, { context });
  });
  return mod;
}
const mod = await load('chapters/ch5-daily.js'); await mod.evaluate();
const M = modules.get('chapters/ch5-catering-model.js').namespace;
const C = modules.get('chapters/ch5-catering.js').namespace;
const D = mod.namespace;
const schedule = await load('daily/tsumugi-schedule.js'); await schedule.evaluate();
const reserve = (id = 'housewarming', delegate = false) => {
  M.recordCateringOffer(current, id, 'request');
  const item = { id: 'request', msg: { ch5Catering: id } };
  const note = callbacks.get(delegate ? 'ch5_catering_delegate' : 'ch5_catering_accept')(item);
  return { entry: M.cateringRequestById(id), note };
};

reset();
C.deliverCateringMorning();
assert(messages[0].messages.some(t => /手取り.*円/.test(t)));
assert(messages[0].replies.some(r => r.action === 'ch5_catering_delegate'));
assert.equal(current.money, 1000);

// A delegated shift leaves the player's action free and removes Tsumugi only for its actual slot.
reset();
let { entry, note } = reserve('housewarming', true);
assert.match(note, /つむぎに任せた/);
assert.equal(current.slot, 0); assert.equal(current.stamina, 100); assert.equal(current.money, 1000);
assert.match(C.chapterFiveCateringSpot().unavailable, /つむぎ/);
current.day++; current.slot = 0;
assert.equal(schedule.namespace.tsumugiAtTonari(current), false);
assert.equal(D.dueTonariScene(current), null);
const definition = D.chapterFiveDailyDefinition({});
assert.equal(definition.withLovers()[0], 'tsumugi');
definition.afterSpot({ id: 'rest' });
assert.equal(current.money, 1000 + entry.payout); assert.equal(current.kujiTickets, 0);
assert.equal(current.stamina, 100); assert.equal(current.slot, 0);
assert.equal(messages.filter(m => /catering-done/.test(m.id)).length, 1);
definition.afterSpot({ id: 'rest' }); definition.mapOptions();
assert.equal(current.money, 1000 + entry.payout);
current.slot = 1; assert.equal(schedule.namespace.tsumugiAtTonari(current), true);

// Personal outing: cancel and interrupted scenes charge nothing; successful completion pays once.
reset(); ({ entry } = reserve()); current.day++;
choices = [null];
assert.equal((await C.performCateringSpot({ id: M.CATERING_SPOT_ID })).used, false);
assert.equal(current.money, 1000); assert.equal(current.stamina, 100);
choices = ['go']; playing = [{ cancelled: true }];
await C.performCateringSpot({ id: M.CATERING_SPOT_ID });
assert.equal(current.money, 1000);
choices = ['go', entry.options.findIndex(o => o.fit === 'best')];
const done = await C.performCateringSpot({ id: M.CATERING_SPOT_ID });
assert.equal(done.used, true); assert.equal(current.money, 1000 + entry.payout);
assert.equal(current.kujiTickets, 2); assert.equal(current.stamina, 86);
assert.equal((await C.performCateringSpot({ id: M.CATERING_SPOT_ID })).used, false);
assert.equal(current.money, 1000 + entry.payout);

reset(); reserve(); current.day++;
const abandoned = current;
choices = ['go'];
onModal = () => { current = fresh(); stateModule.setExport('state', current); };
assert.equal((await C.performCateringSpot({ id: M.CATERING_SPOT_ID })).used, false);
assert.equal(current.money, 1000); assert.equal(abandoned.money, 1000);

// A personal acceptance can be changed into delegation without spending this slot.
reset(); reserve(); current.day++; choices = ['delegate'];
assert.equal((await C.performCateringSpot({ id: M.CATERING_SPOT_ID })).used, false);
assert.equal(M.cateringDelegation(current).jobDay, 44);
assert.equal(current.money, 1000); assert.equal(current.slot, 0);

// Arrival, rest and late LOAD all reconcile once, including while the player is far away.
reset(); ({ entry } = reserve('wedding_party', true)); current.day++; current.slot = 2;
current.flags._ch2_region = 'tokyo';
await D.chapterFiveDailyDefinition({}).beforeHomecoming();
assert.equal(current.money, 1000 + entry.payout);
C.settleCateringWork(); assert.equal(current.money, 1000 + entry.payout);
reset(); ({ entry } = reserve('wedding_party', true)); current.day += 8;
C.deliverCateringMorning(); assert.equal(current.money, 1000 + entry.payout);
assert(!messages.some(m => /catering-lapse/.test(m.id)));

// Old unread invitations cannot invite Tsumugi back during her delegated slot.
reset(); reserve('housewarming', true); current.day++;
current.inbox.push({ id: 'date', day: current.day, msg: { sender: 'tsumugi', type: 'invitation', time_slot: 'noon' } });
C.deliverCateringMorning();
assert.equal(current.inbox.find(i => i.id === 'date').needsResend, true);
assert.equal(current.inbox.find(i => i.id === 'date').done, true);

// Closing the season returns a future booking, does not pay it early, and is idempotent.
reset(); reserve('wedding_party', true);
const io = { readAndCommit: async () => { current.flags._ch5.part = 'scheduled'; current.flags._ch5.matchDay = current.day + 1; return true; } };
await D.contactDoctor(io);
assert.equal(M.cateringState(current).offer, null); assert.equal(current.money, 1000);
assert.equal(messages.filter(m => /catering-close/.test(m.id)).length, 1);
C.finishCateringSeason(); assert.equal(messages.filter(m => /catering-close/.test(m.id)).length, 1);
console.log('ch5 catering integration: replies, delegation, personal action, cancellation/LOAD, hooks, presence and finale passed');

// 固有20件の後は、会場・条件・手取りを保って短い汎用会話へ。
const completeRound = () => { current.flags[M.CATERING_FLAG] = { offers: 20, next: 42, offer: null,
  served: Object.fromEntries(M.CATERING_REQUESTS.map(e => [e.id, 1])) }; };
reset(); completeRound();
C.deliverCateringMorning();
assert(messages[0].messages.some(t => /また出張の予約/.test(t)));
assert(!messages[0].messages.some(t => M.CATERING_REQUESTS.some(e => e.lime.includes(t))));
reset(); completeRound(); ({ entry } = reserve('housewarming')); current.day++;
choices = ['go', entry.options.findIndex(o => o.fit === 'best')];
assert.equal((await C.performCateringSpot({ id: M.CATERING_SPOT_ID })).used, true);
assert.equal(scenes[0], 'ch5_catering_repeat_intro');
assert.equal(scenes[1].dialogue_id, 'ch5_catering_repeat_best');
assert.equal(scenes[1].lines.length, DB.dialogues.ch5_catering_repeat_best.lines.length, '長い固有会話と店への帰還を繰り返さない');
assert.equal(current.money, 1000 + entry.payout);
assert.equal(M.cateringState(current).last.repeat, true);
reset(); completeRound(); ({ entry } = reserve('housewarming', true)); current.day++; current.slot = 1;
C.settleCateringWork();
const report = messages.find(m => /catering-done/.test(m.id));
assert.equal(report.sender, 'tsumugi');
assert(report.messages.some(t => /また呼んで/.test(t)));
assert(report.messages.some(t => /楽しんで/.test(t)));
assert(!report.messages.some(t => entry.report.includes(t)));
assert.equal(report.replies[0].affinity, 0);
assert.equal(current.money, 1000 + entry.payout);
C.settleCateringWork();
assert.equal(messages.filter(m => /catering-done/.test(m.id)).length, 1);
console.log('ch5 catering integration: generic repeat replaces unique conversations only after all 20 passed');
