// 本番LIME・恋人モジュールをVMで読み、受信/返信/予約/再案内を実際のボタン経由で検証する。
// node --experimental-vm-modules remake/test/lime_consistency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const root = new URL("../", import.meta.url);
const dataRoot = new URL("../../", import.meta.url);
const db = { lime: JSON.parse(await fs.readFile(new URL("data/lime_messages.json", dataRoot), "utf8")).messages, lover: {}, dialogues: {} };
const allMessages = db.lime, state = {}, gains = [], plays = [], statGains = [];
let playHook = async () => {};
class Element {
  constructor(spec) {
    const [tag, ...classes] = spec.split("."); this.tag = tag; this.children = []; this.dataset = {};
    const names = new Set(classes);
    this.classList = { add: (...v) => v.forEach((x) => names.add(x)), remove: (...v) => v.forEach((x) => names.delete(x)), contains: (v) => names.has(v) };
  }
  append(...children) { for (const node of children.flat(Infinity).filter(Boolean)) { node.parent = this; this.children.push(node); } }
  replaceChildren(...children) { this.children.forEach((n) => n.parent = null); this.children = []; this.append(...children); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((n) => n !== this); this.parent = null; } }
  get scrollHeight() { return this.children.length * 20; }
}
function el(spec, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const node = new Element(spec); Object.assign(node, attrs); node.append(children); return node;
}
const layers = Object.fromEntries(["modal", "toasts", "fx"].map((k) => [k, new Element("div")]));
const context = vm.createContext({ console, setTimeout: () => {}, requestAnimationFrame: (fn) => fn(), document: { querySelector: () => null }, Math, Date, Set, Promise });
const noop = () => {}, mods = new Map();
const values = {
  "util.js": { el, sleep: async () => {} },
  "data.js": { DB: db, displayName: (id) => id, callName: (id) => id, faceIconUrl: () => null },
  "ui.js": { layers }, "state.js": { state, save: noop },
  "stats.js": { gainAffinity: (id, pts) => gains.push({ id, pts }), affinityLevel: () => 5, applyStats: (stats) => statGains.push(stats), bond: {}, addStamina: noop, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66] },
  "audio.js": { SE: { phone: noop, select: noop, click: noop, cancel: noop } },
  "engine.js": { hooks: { interpolate: (t) => t.replace("{daysLeft}", String(15 - state.day)) }, play: async (...a) => { plays.push(a); await playHook(...a); } },
  "text.js": { formatHtml: (t) => t }, "spots.js": { hasContact: (id) => state.contacts.includes(id) }, "bus.js": { emit: noop },
  "bonds.js": { bondInvites: () => [], friendMessages: () => [] }, // 締めくくりの誘い・友人のLIMEは remake/test/bonds.mjs
};
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  let mod;
  if (values[name]) mod = new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name });
  else mod = new vm.SourceTextModule(await fs.readFile(new URL(`js/daily/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod;
}
const phoneModule = await load("phone.js"); await phoneModule.evaluate();
const phone = phoneModule.namespace, romance = (await load("romance.js")).namespace;
const clone = (v) => JSON.parse(JSON.stringify(v));
function reset(overrides = {}) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, { chapter: 1, phase: "daily", day: 6, slot: 0, flags: {}, limeRead: [], inbox: [], contacts: ["minto", "rin", "tsumugi", "naru", "adam", "sumi"], met: {}, story: {}, lastBaitoDay: 6, lovers: [], loveLevel: {}, loverSince: {}, lastDate: {}, lovePts: {}, loverEventsSeen: [] }, overrides);
  db.lime = allMessages; db.lover = {}; db.dialogues = {}; gains.length = 0; plays.length = 0; statGains.length = 0; playHook = async () => {};
  for (const layer of Object.values(layers)) layer.replaceChildren();
}
function find(node, test) { if (node.dataset?.test === test) return node; for (const c of node.children || []) { const v = find(c, test); if (v) return v; } return null; }
const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
async function click(test) {
  await settle(); const node = find(layers.modal, test) || find(layers.toasts, test);
  assert(node, `Missing button: ${test}`); assert(!node.disabled, `Disabled button: ${test}`); node.onclick(); await settle(); return node;
}
function item(msg, values = {}) { return { id: msg.id, originId: msg.id, day: state.day, msg, read: false, done: false, replyState: "waiting", log: [], ...values }; }
function invitation(id, sender, meta = {}) { return { id, sender, type: "invitation", time_slot: "night", trigger_condition: "affinity_level", trigger_value: 3, messages: ["今日、会える？"], accept_event: `outing_${sender}`, decline_response: { text: "うん、またね" }, ...meta }; }
async function closeThread(session) { await click("phone-next"); await click("phone-close"); await session; }

// 通知ボタンは一度だけ最新の送り主を渡す。
reset(); state.inbox.push(item(invitation("a", "minto")), item(invitation("b", "rin")));
const opened = []; phone.pushNotice(2, { onOpen: (sender) => opened.push(sender) });
const notice = find(layers.toasts, "lime-notice"); assert.equal(notice.tag, "button"); notice.onclick(); notice.onclick(); assert.deepEqual(opened, ["rin"]); assert.equal(notice.parent, null);

// 通知からトーク直行。読んでも保留なら返事待ちのまま一覧へ戻る。
reset(); const waiting = item(invitation("later", "minto", { important: true })); state.inbox.push(waiting);
let session = phone.openLime({ sender: "minto" }); await settle(); assert(!find(layers.modal, "lime-chat-minto")); await click("reply-2");
assert(find(layers.modal, "lime-chat-minto")); assert(waiting.read); assert(!waiting.done); assert.equal(waiting.replyState, "waiting"); assert.equal(waiting.log.length, 0); assert(!state.flags._invited_later);
await click("phone-close"); await session;

// 一方の承諾で、他の競合誘いへ自動辞退を送る。未読はそのまま、重要な誘いは翌日以降に再案内。
reset(); db.lime = [invitation("one", "minto", { important: true }), invitation("two", "rin", { important: true }), invitation("ordinaryConflict", "sumi")];
assert.equal(phone.deliverMorning(), 3); session = phone.openLime({ sender: "minto" }); await click("reply-0");
const automaticallyDeclined = state.inbox[1], politeDeclined = state.inbox[2];
assert.equal(state.pendingInvite.sender, "minto"); assert.equal(state.pendingInvite.day, 6); assert.equal(state.inbox[0].result, "accepted");
assert.equal(automaticallyDeclined.result, "conflict_declined"); assert.equal(automaticallyDeclined.replyState, "replied"); assert(!automaticallyDeclined.read); assert(automaticallyDeclined.needsResend); assert(!state.flags._invited_two);
assert(automaticallyDeclined.log.some((entry) => entry.me && /別の約束/.test(entry.text))); assert(automaticallyDeclined.log.some((entry) => !entry.me && entry.text === "うん、またね")); assert(automaticallyDeclined.log.some((entry) => /今回は断った/.test(entry.note || "")));
assert(politeDeclined.log.some((entry) => entry.me && entry.text.startsWith("すみません"))); assert(!politeDeclined.needsResend); assert(state.flags._invited_ordinaryConflict);
assert.equal(phone.deliverMorning(), 0); await click("phone-next"); await click("lime-chat-rin"); assert(!find(layers.modal, "reply-0")); await closeThread(session);
state.day = 7; state.slot = 0; phone.deliverMorning(); assert(state.inbox.some((i) => i.msg.origin_id === "two" && i.id.includes("_retry_c1_d7"))); assert(!state.inbox.some((i) => i.msg.origin_id === "ordinaryConflict"));

// 自動辞退した重要トークを未読のまま残しても、翌日の再案内を止めない。
reset(); db.lime = [invitation("yes", "minto", { important: true }), invitation("unseenConflict", "rin", { important: true })]; phone.deliverMorning();
session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session); const unseen = state.inbox[1]; assert(!unseen.read);
state.day = 7; phone.deliverMorning(); assert(!unseen.read); assert(state.inbox.some((i) => i.originId === "unseenConflict" && i.id.includes("_retry_c1_d7")));

// 既に約束がある時に届いた別の誘いには、明示辞退か保留を選べる。
reset(); const existing = invitation("existing", "minto"); state.inbox.push(item(existing, { read: true, done: true, result: "accepted" }));
state.pendingInvite = { day: 6, originId: "existing", event: existing.accept_event, sender: "minto", slot: 1 };
const busy = item(invitation("busy", "rin", { important: true })); state.inbox.push(busy);
session = phone.openLime({ sender: "rin" }); await settle(); assert(find(layers.modal, "reply-0").disabled); assert(find(layers.modal, "reply-2"));
await click("reply-1"); await closeThread(session); assert.equal(busy.result, "declined"); assert(state.flags._invited_busy); assert.equal(state.pendingInvite.sender, "minto");

// 未読でも既読・未返信でも、期限切れの重要誘いを翌適合日に一度だけ再案内。
for (const read of [false, true]) {
  reset(); const msg = invitation("important", "minto", { important: true, closed_on: 6, time_slot: "noon" }); db.lime = [msg];
  const missed = item(clone(msg), { day: 5, read }); state.inbox.push(missed); if (read) state.limeRead.push("important");
  assert.equal(phone.deliverMorning(), 1); assert.equal(missed.read, read); assert.equal(missed.result, "expired"); assert.equal(missed.replyState, "expired"); assert.equal(state.inbox[1].originId, "important"); assert(state.inbox[1].id.includes("_retry_c1_d6"));
  assert.equal(phone.deliverMorning(), 0); assert(!state.flags._invited_important);
  session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session); assert(state.flags._invited_important); assert(!state.flags[`_invited_${state.inbox[1].id}`]);
}
reset(); db.lime = [invitation("ordinary", "rin")]; state.inbox.push(item(db.lime[0], { day: 5 })); assert.equal(phone.deliverMorning(), 0); assert.equal(state.inbox[0].result, "expired");

// 旧セーブの過去予約や固定夜との衝突も、既読履歴を保って次の適合日に再案内。
reset(); const legacyImportant = invitation("legacy", "minto", { important: true, closed_on: 6, time_slot: "noon" });
db.lime = [legacyImportant]; const legacy = item({ ...legacyImportant, important: false }, { day: 5, read: true, done: true, result: "accepted" });
state.inbox.push(legacy); state.limeRead.push("legacy"); state.flags._invited_legacy = true;
state.pendingInvite = { day: 5, originId: "legacy", event: legacyImportant.accept_event, sender: "minto", slot: 1 };
assert.equal(phone.deliverMorning({ fixedNight: () => true }), 1); assert.equal(state.pendingInvite, null); assert(legacy.needsResend);
assert(legacy.read); assert(state.limeRead.includes("legacy")); assert(!state.flags._invited_legacy); assert(legacy.log.some((l) => /時間を過ぎ/.test(l.note || "")));
reset({ day: 3 }); const fixedInvite = invitation("fixed", "rin", { trigger_condition: "lime_exchanged", trigger_day: 3 }); db.lime = [fixedInvite];
const fixed = item(fixedInvite, { read: true, done: true, result: "accepted" }); state.inbox.push(fixed); state.limeRead.push("fixed"); state.flags._invited_fixed = true;
state.pendingInvite = { day: 3, originId: "fixed", event: fixedInvite.accept_event, sender: "rin", slot: 1 };
phone.expireInvitations({ fixedNight: () => true }); assert.equal(state.pendingInvite, null); assert(fixed.log.some((l) => /別の日に改める/.test(l.note || "")));
state.day = 6; assert.equal(phone.deliverMorning({ fixedNight: () => false }), 1); assert.equal(state.inbox.at(-1).originId, "fixed");
// inbox照合ができない壊れた古い予約も、消去する前にトークに経緯を補う。
reset(); db.lime = []; state.pendingInvite = { day: 5, event: "date_minto", sender: "minto", slot: 1 };
phone.expireInvitations(); assert.equal(state.pendingInvite, null); assert.equal(state.inbox.length, 1); assert(state.inbox[0].log.some((l) => /約束/.test(l.note || "")));

// 閉店待ちとしてslot2へ送った予約は、当日は過去slotや固定営業イベントとの衝突で消さない。
for (const event of ["outing_minto", "date_minto"]) {
  reset({ slot: 2 }); const msg = invitation("queued", "minto", { accept_event: event, after_close: true }); db.lime = [msg];
  const booked = item(msg, { read: true, done: true, result: "accepted" }); state.inbox.push(booked); state.flags._invited_queued = true;
  const pending = { day: 6, originId: "queued", event, sender: "minto", slot: 1, afterClose: true, queuedAfterClose: true };
  state.pendingInvite = pending; phone.expireInvitations({ fixedNight: () => true });
  assert.equal(state.pendingInvite, pending); assert.equal(booked.result, "accepted"); assert.equal(booked.log.length, 0); assert(state.flags._invited_queued);
  state.day = 7; phone.expireInvitations(); assert.equal(state.pendingInvite, null); assert.equal(booked.result, "expired");
}
reset({ slot: 2 }); const notQueued = invitation("notQueued", "minto", { after_close: true }); db.lime = [notQueued];
state.inbox.push(item(notQueued, { read: true, done: true, result: "accepted" })); state.pendingInvite = { day: 6, originId: "notQueued", event: notQueued.accept_event, sender: "minto", slot: 1, afterClose: true };
phone.expireInvitations(); assert.equal(state.pendingInvite, null);

// 雑談の返事は小さな加点。0点を尊重し、読むだけでは返信報酬を付けない。
for (const pts of [0, 1, 2]) {
  reset(); const msg = { id: `chat${pts}`, sender: "minto", type: "chat", messages: ["おはよう"], replies: [{ text: "おはよう", response: "返事、ありがと", affinity: pts }] };
  state.inbox.push(item(msg)); session = phone.openLime({ sender: "minto" }); await settle(); assert.equal(gains.length, 0);
  await click("reply-0"); await closeThread(session); assert.deepEqual(gains, [{ id: "minto", pts }]); assert.equal(state.inbox[0].replyState, "replied");
}
reset({ lovers: ["minto"] }); state.inbox.push(item({ id: "loverchat", sender: "minto", type: "chat", messages: ["おはよう"], replies: [{ text: "おはよう", affinity: 1 }] }));
session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session); assert.equal(gains[0].pts, 3);

// 六つの噂も返信可能。全選択肢が自然な文面/反応/小さい点数を持ち、洞察報酬は読む時に一度だけ。
const rumors = allMessages.filter((m) => m.type === "rumor"); assert.equal(rumors.length, 6);
for (const rumor of rumors) {
  assert(rumor.replies.length >= 2); assert(rumor.replies.some((r) => r.affinity === 0));
  for (let index = 0; index < rumor.replies.length; index++) {
    const reply = rumor.replies[index]; assert(reply.text && reply.response); assert([0, 1, 2].includes(reply.affinity));
    reset(); state.contacts.push(rumor.sender); state.inbox.push(item(rumor)); session = phone.openLime({ sender: rumor.sender }); await settle();
    assert.equal(gains.length, 0); assert.equal(statGains.length, 1); assert.equal(statGains[0].insight, 2);
    await click(`reply-${index}`); await closeThread(session); assert.equal(gains.length, 1); assert.equal(gains[0].pts, reply.affinity); assert.equal(statGains.length, 1);
    assert(state.inbox[0].log.some((entry) => entry.me && entry.text === reply.text)); assert(state.inbox[0].log.some((entry) => !entry.me && entry.text === reply.response));
  }
}

// 初私服デートは店の第五会話後、定休日の午後。移行済みセーブでは再配信しない。
reset({ day: 5, story: { minto: 5 } }); assert(!phone.morningMessages().some((m) => m.id === "lime_minto_first_holiday"));
state.day = 6; const firstHoliday = phone.morningMessages().find((m) => m.sender === "minto"); assert.equal(firstHoliday.id, "lime_minto_first_holiday"); assert.equal(firstHoliday.time_slot, "noon"); assert.equal(firstHoliday.accept_event, "ch1_minto_fifth");
state.lovers.push("minto"); assert.equal(phone.morningMessages().find((m) => m.sender === "minto").id, "lime_minto_first_holiday");
state.flags._minto_fifth_done = true; assert(!phone.morningMessages().some((m) => m.id === "lime_minto_first_holiday"));

// アダムのゲームセンター外出は店の第四会話後、営業後の重要誘いとして届く。
reset({ day: 8, story: { adam: 4 } }); const arcade = phone.morningMessages({ fixedNight: () => false }).find((m) => m.sender === "adam");
assert.equal(arcade.id, "lime_adam_arcade_after_close"); assert.equal(arcade.accept_event, "ch1_adam_outing_dagurikura"); assert(arcade.important && arcade.after_close); assert.equal(arcade.time_slot, "night");
state.inbox.push(item(arcade)); session = phone.openLime({ sender: "adam" }); await click("reply-0"); await closeThread(session); assert(state.pendingInvite.afterClose); assert.equal(state.pendingInvite.slot, 1);
reset({ day: 8, story: { adam: 4 } }); assert(!phone.morningMessages({ fixedNight: () => true }).some((m) => m.id === "lime_adam_arcade_after_close"));
state.day = 5; assert(!phone.morningMessages().some((m) => m.id === "lime_adam_arcade_after_close"));
state.day = 11; state.inbox.push(item(arcade, { day: 8, read: true })); state.limeRead.push(arcade.id);
const arcadeRetry = phone.morningMessages().find((m) => m.sender === "adam"); assert.equal(arcadeRetry.origin_id, "lime_adam_arcade_after_close"); assert(arcadeRetry.id.includes("_retry_c1_d11"));
state.flags._adam_arcade_done = true; assert(!phone.morningMessages().some((m) => m.accept_event === "ch1_adam_outing_dagurikura"));

// 店休日以外は閉店後、固定夜イベントの日は昼へ無理に振り替えない。
reset({ lovers: ["minto", "rin", "tsumugi"], day: 5 }); assert.equal(romance.dateSchedule("minto", { fixedNight: () => false }).time_slot, "night"); assert(romance.dateSchedule("rin", { fixedNight: () => false }).after_close);
assert.equal(romance.dateSchedule("minto", { fixedNight: () => true }), null); assert(!romance.loverMessages({ fixedNight: () => true }).some((m) => m.type === "invitation"));
state.day = 6; const date = romance.loverMessages({ fixedNight: () => true }).find((m) => m.sender === "minto"); assert.equal(date.time_slot, "noon"); assert.equal(date.closed_on, 6);

// 告白は交友の締めくくりで恋愛ルートに入った相手だけ（HF05）。答えた質問がすべて恋愛寄りで、締めくくりの記録がある。
const romanceRoute = (id) => ({ finales: { [id]: { day: 5, chapter: 1, route: "romance" } },
  romanceChoices: { [`bond_q1_${id}`]: { char: id, value: 1, day: 3 }, [`bond_q2_${id}`]: { char: id, value: 1, day: 5 } }, romance: { [id]: 2 } });
// 告白待ちを昼に消さず、仕事を終える夜の行動後まで保留する。
reset({ slot: 1, flags: { _confession_due: "minto" }, ...romanceRoute("minto") }); db.dialogues.confession_minto = {};
assert.equal(await romance.maybeConfession(async () => {}), false); assert.equal(state.flags._confession_due, "minto"); assert.equal(plays.length, 0);

reset({ slot: 2, flags: { _confession_due: "minto" }, ...romanceRoute("minto") }); db.dialogues.confession_minto = {};
assert.equal(await romance.maybeConfession(async () => {}), false); assert.equal(state.flags._confession_due, "minto"); assert.equal(plays.length, 0);
// 旧セーブに残った自動予約（好感度MAXだけ）では告白しない。予約は消え、場面も出ない。
reset({ slot: 2, flags: { _confession_due: "minto", _minto_identity_revealed: true, _minto_name_known: true } }); db.dialogues.confession_minto = {};
assert.equal(await romance.maybeConfession(async () => {}), false); assert.equal(state.flags._confession_due, undefined); assert.equal(plays.length, 0);
// 友情寄りの答えが一つでもあれば、締めくくりの記録が恋愛でも告白しない。
reset({ slot: 2, flags: { _confession_due: "rin" }, ...romanceRoute("rin") }); db.dialogues.confession_rin = {};
state.romanceChoices.bond_q1_rin.value = 0;
assert.equal(await romance.maybeConfession(async () => {}), false); assert.equal(plays.length, 0); assert.equal(state.flags._confession_due, undefined);
// 予約が無くても、恋愛ルートの相手は夜の帰り道で拾う。別の約束で会った夜は重ねず、予約を残して後日へ。
reset({ slot: 2, ...romanceRoute("rin") }); db.dialogues.confession_rin = {};
assert.equal(await romance.maybeConfession(async () => {}, { busyNight: true }), false); assert.equal(state.flags._confession_due, "rin"); assert.equal(plays.length, 0);
playHook = async (dialogue) => { if (dialogue?.dialogue_id === "remake_confession_gate_rin") state.flags._confession_go = true; };
assert.equal(await romance.maybeConfession(async () => {}), true); assert.deepEqual(plays.map(([d]) => d?.dialogue_id || d), ["remake_confession_gate_rin", "confession_rin"]);
assert.equal(state.flags._confession_due, undefined);
// 恋人デートの到着でも、午後の休みか仕事後かを明示する。
for (const slot of [0, 1]) {
  reset({ slot, lovers: ["minto"], loveLevel: { minto: 1 } });
  const face = { face: "ura_smile", text: "待ってたよ" };
  db.lover = { venues: [{ id: "cafe", bg: "bg_cafe.png", name: "カフェ", note: "静かな席" }], dates: { minto: {
    arrive: face, mid: face, close: face, choiceQ: "どれにする？", optA: { text: "ミント", line: "うん", stat: "sense" }, optB: { text: "果物", line: "うん", stat: "sense" } } } };
  await romance.playDate("minto"); assert.match(plays[0][0].lines[0].text, slot === 0 ? /定休日の午後/ : /仕事を終えてから/);
}

// 私服交流済みの旧セーブは、告白を選んでから本名紹介を補完し、紹介済みなら繰り返さない。
for (const known of [false, true]) {
  reset({ slot: 2, flags: { _confession_due: "minto", _minto_identity_revealed: true, _minto_name_known: known }, ...romanceRoute("minto") }); db.dialogues.confession_minto = {};
  playHook = async (dialogue) => { if (dialogue?.dialogue_id === "remake_confession_gate_minto") state.flags._confession_go = true; };
  assert.equal(await romance.maybeConfession(async () => {}), true);
  const introIndex = plays.findIndex(([dialogue]) => dialogue?.dialogue_id === "remake_minto_name_before_confession");
  const confessionIndex = plays.findIndex(([dialogue]) => dialogue === "confession_minto");
  assert(confessionIndex > 0); assert(state.flags._minto_name_known);
  if (known) assert.equal(introIndex, -1);
  else { assert(introIndex > 0 && introIndex < confessionIndex); const lines = plays[introIndex][0].lines;
    assert(lines.some((line) => line.speaker === "minto" && /緑川栞.*二人の時/.test(line.text)));
    assert(lines.some((line) => line.speaker === "hajime" && line.text.startsWith("栞さん")));
  }
}
reset({ slot: 2, flags: { _confession_due: "minto", _minto_identity_revealed: true }, ...romanceRoute("minto") }); db.dialogues.confession_minto = {};
assert.equal(await romance.maybeConfession(async () => {}), true); assert.equal(plays.length, 1); assert(!state.flags._minto_name_known); assert.equal(state.flags._confession_due, "minto");

// 外出後の話は後日読んでも時間が食い違わない。私的LIMEに店の呼び込み口調を持ち込まない。
const afterOutings = allMessages.filter((m) => m.id.startsWith("lime_after_outing_")); assert.equal(afterOutings.length, 4);
for (const message of afterOutings) { const text = JSON.stringify(message); assert(!/昨日|昨夜/.test(text)); assert(text.includes("この前")); }
const privateMinto = allMessages.filter((m) => m.sender === "minto" && m.id !== "lime_minto_day4");
for (const message of privateMinto) assert(!/♡|生きてる〜|おはよっ|チェキ/.test(JSON.stringify(message)), message.id);
assert(JSON.stringify(allMessages.find((m) => m.id === "lime_minto_day4")).includes("チェキ"));

// 朝文面と本名の先行表示。通知の親layerはpointer-events:noneでもボタン自身を操作可能にする。
const rumor = allMessages.find((m) => m.id === "rumor_minto_late_night"); assert(rumor.messages.some((m) => /昨日、店を閉めたあと/.test(m.text))); assert(!rumor.messages.some((m) => /まだ起きてる|おやすみ|こんな時間/.test(m.text)));
assert(!JSON.stringify(allMessages.find((m) => m.id === "lime_after_outing_minto")).match(/おやすみ|栞さん/));
const css = await fs.readFile(new URL("css/daily.css", root), "utf8"); assert(css.match(/\.lime-push\s*\{[^}]*pointer-events:\s*auto/s));
// 店の私的な用事は営業中の訪問から分離する。買い物の昼は店休日、夜は仕事後。
const invitationById = Object.fromEntries(allMessages.filter((m) => m.type === "invitation").map((m) => [m.id, m]));
assert.equal(invitationById.lime_outing_naru_1.closed_on, 3); assert.equal(invitationById.lime_outing_naru_1.time_slot, "noon");
assert.equal(invitationById.lime_outing_minto_1.closed_on, 6); assert.equal(invitationById.lime_outing_minto_1.time_slot, "noon");
for (const id of ["lime_naru_day3", "lime_outing_adam_1", "lime_adam_arcade_after_close", "lime_outing_ageha_1"]) {
  assert.equal(invitationById[id].time_slot, "night"); assert(invitationById[id].after_close, id);
}
assert.equal(invitationById.lime_minto_day4.time_slot, "noon"); assert(!invitationById.lime_minto_day4.after_close); assert.equal(invitationById.lime_minto_day4.closed_on, undefined);
reset({ day: 3, contacts: ["naru"] }); const naruDayOff = phone.morningMessages().find((m) => m.id === "lime_outing_naru_1"); assert(naruDayOff); assert(naruDayOff.messages[0].text.includes("定休日"));
state.day = 4; assert(!phone.morningMessages().some((m) => m.id === "lime_outing_naru_1"));
// 次の私服の約束を定休日だけに縛らない。配信した時点で本文と予約時刻を一緒に確定。
for (const day of [6, 11]) {
  reset({ day, lastBaitoDay: day, flags: { _minto_identity_revealed: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
  const flexible = phone.morningMessages({ fixedNight: () => false })[0]; assert(flexible); assert.equal(flexible.time_slot, day === 6 ? "noon" : "night");
  assert.equal(flexible.after_close, day !== 6); assert.equal(flexible.closed_on, day === 6 ? 6 : undefined);
  const text = JSON.stringify(flexible); assert(!text.includes("{private")); assert.match(text, day === 6 ? /お店がお休み.*午後/ : /仕事を終えたあと/);
  assert.equal(phone.deliverMorning({ fixedNight: () => false }), 1);
  const received = state.inbox[0]; assert.equal(received.msg.time_slot, flexible.time_slot);
  session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session);
  assert.equal(state.pendingInvite.slot, day === 6 ? 0 : 1); assert.equal(state.pendingInvite.afterClose, day !== 6);
  phone.expireInvitations({ fixedNight: () => false }); assert(state.pendingInvite, "resolved night slot must survive reopening LIME");
}
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2]; assert.equal(phone.deliverMorning({ fixedNight: () => true }), 0);
// 返事を忘れた休日の約束を、次の適合する仕事後の夜に再案内。本文に古い休日を残さない。
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
const oldHoliday = { ...invitationById.lime_outing_minto_2, time_slot: "noon", closed_on: 6, after_close: false, messages: ["午後、会える？"] };
state.inbox.push(item(oldHoliday, { day: 6, read: true })); state.limeRead.push(oldHoliday.id);
assert.equal(phone.deliverMorning({ fixedNight: () => false }), 1); const laterPrivate = state.inbox.at(-1).msg;
assert(laterPrivate.origin_id === oldHoliday.id && laterPrivate.id.includes("_retry_c1_d11")); assert.equal(laterPrivate.time_slot, "night"); assert(laterPrivate.after_close); assert(!/お店がお休み|\{private/.test(JSON.stringify(laterPrivate)));
// 既存予約が古い休日枠だった場合も、営業時間外でない昼の約束を履歴付きで再案内へ。
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
const oldWrongDay = item(oldHoliday, { read: true, done: true, result: "accepted" }); state.inbox.push(oldWrongDay);
state.pendingInvite = { day: 11, originId: oldHoliday.id, event: oldHoliday.accept_event, sender: "minto", slot: 0 };
phone.expireInvitations({ fixedNight: () => false }); assert.equal(state.pendingInvite, null); assert(oldWrongDay.needsResend); assert(oldWrongDay.log.some((l) => /別の日/.test(l.note || "")));

console.log("[remake LIME] notification thread, defer, automatic conflict history/retry, six rumor replies, unread/read retry, small affinity, holiday/after-close schedules, queued closing appointment, legacy name introduction, Adam arcade, confession gate, morning copy: PASS");
