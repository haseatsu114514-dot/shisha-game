// 本番LIME・恋人モジュールをVMで読み、受信/返信/予約/再案内を実際のボタン経由で検証する。
// node --experimental-vm-modules remake/test/lime_consistency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { clamp } from "../js/core/util.js";
import { MAX_MONEY } from "../js/core/rules.js";
import { STAT_JA } from "../js/core/state.js";
import { chapterDay, chapterDaysLeft, relationshipElapsedDay } from "../js/core/chapter-clock.js";
const root = new URL("../", import.meta.url);
const dataRoot = new URL("../../", import.meta.url);
const db = { lime: JSON.parse(await fs.readFile(new URL("data/lime_messages.json", dataRoot), "utf8")).messages, lover: {}, dialogues: {} };
const allMessages = db.lime, state = {}, gains = [], plays = [], statGains = [], nudges = [];
const completedPlay = (scene) => ({ id: typeof scene === "string" ? scene : scene?.dialogue_id, visited: [] });
let playResult = completedPlay;
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
  querySelectorAll(selector) { return this.children.flatMap((n) => [...(n.classList.contains(selector.slice(1)) ? [n] : []), ...n.querySelectorAll(selector)]); }
  get scrollHeight() { return this.children.length * 20; }
}
function el(spec, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const node = new Element(spec); Object.assign(node, attrs); node.append(children); return node;
}
const layers = Object.fromEntries(["modal", "toasts", "fx"].map((k) => [k, new Element("div")]));
const context = vm.createContext({ console, clearTimeout, setTimeout: () => {}, requestAnimationFrame: (fn) => fn(), document: { querySelector: () => null }, Math, Date, Set, Promise });
const noop = () => {}, mods = new Map();
const values = {
  "chapter-clock.js": { chapterDay, chapterDaysLeft, relationshipElapsedDay },
  "hiyori-route.js": { hiyoriEventStatus: () => "disabled", hiyoriRoute: () => db.hiyori?.route || {}, hiyoriFinaleReady: () => false },
  "util.js": { el, clamp, sleep: async () => {}, fitOneLine: () => {}, yen: (n) => `¥${Number(n).toLocaleString("ja-JP")}` },
  "data.js": { DB: db, displayName: (id) => id, callName: (id) => id, faceIconUrl: () => null },
  "lime-icons.js": { customLimeIconUrl: () => null },
  "ui.js": { layers, toast: (text) => nudges.push(text) }, "state.js": { state, save: noop, STAT_JA, STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"] },
  "stats.js": { setStoryAffinityCap() {}, affinityGateWaiting: () => false, gainStat: noop, addMoney: noop, gainAffinity: (id, pts) => gains.push({ id, pts }), affinityLevel: () => 5, applyStats: (stats) => statGains.push(stats), bond: {}, addStamina: noop, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66] },

  "audio.js": { SE: { phone: noop, phoneReceive: noop, phoneSend: noop, select: noop, click: noop, cancel: noop } },
  "engine.js": { isPlaying: () => false, hooks: { interpolate: (t) => t.replace("{daysLeft}", String(14 - state.day)) }, play: async (...a) => { plays.push(a); await playHook(...a); return playResult(...a); } },
  "rules.js": { MAX_MONEY, TOURNAMENT_DAY: 14 },
  "text.js": { formatHtml: (t) => t }, "spots.js": { hasContact: (id) => state.contacts.includes(id), spotById: (id) => ({ charId: id, closedOn: 6 }),
    isClosed: (spot) => state.day % 7 === spot.closedOn || state.flags[`_temporary_closed_${spot.charId}`] === `${state.chapter}:${state.day}` }, "bus.js": { emit: noop },
  "bonds.js": { bondInvites: () => [], friendMessages: () => [] }, // 締めくくりの誘い・友人のLIMEは remake/test/bonds.mjs
  "story-knowledge.js": { syncMintoKnowledge: () => {} },
};
// 同じVM stateに実statsを接続。新しいexportを空の成功stubで埋めない。
const coreFiles = { "stat-step-tables.js": "stat-step-tables.js", "production-stats.js": "stats.js", "condition.js": "condition.js", "affinity-stages.js": "affinity-stages.js", "travel-budget.js": "travel-budget.js" };
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  let mod;
  if (values[name]) mod = new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name });
  else mod = new vm.SourceTextModule(await fs.readFile(new URL(coreFiles[name] ? `js/core/${coreFiles[name]}` : `js/daily/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod;
}
const statsModule = await load("production-stats.js"); await statsModule.evaluate();
const actualStats = statsModule.namespace;
Object.assign(values["stats.js"], { bond: actualStats.bond, privateBondScope: actualStats.privateBondScope, releaseLoveAffinity: actualStats.releaseLoveAffinity });
const phoneModule = await load("phone.js"); await phoneModule.evaluate();
const phone = phoneModule.namespace, romance = (await load("romance.js")).namespace;
const clone = (v) => JSON.parse(JSON.stringify(v));
function reset(overrides = {}) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, { chapter: 1, phase: "daily", money: 30000, day: 6, slot: 0, flags: {}, limeRead: [], inbox: [], contacts: ["minto", "rin", "tsumugi", "naru", "adam", "sumi"], met: {}, story: {}, lastBaitoDay: 6, lovers: [], loveLevel: {}, loverSince: {}, lastDate: {}, lovePts: {}, loverEventsSeen: [] }, overrides);
  db.lime = allMessages; db.lover = {}; db.dialogues = {}; gains.length = 0; plays.length = 0; statGains.length = 0; nudges.length = 0; playHook = async () => {}; playResult = completedPlay;
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

// #814: phone/romanceが実際に使うprivate scopeと保留解放を、実statsのまま通す。
// 描画/VNは制御port。正常結果・欠落・取消・例外・signalを混同しない。
assert.equal(values["stats.js"].bond, actualStats.bond);
for (const outcome of ["complete", "cancel", "missing", "throw", "abort"]) {
  reset({ chapter: 2, lovers: ["tsumugi"], loveLevel: { tsumugi: 1 }, lovePts: { tsumugi: 9 }, flags: { _tsumugi_love_waiting_pts: 40 } });
  db.dialogues = Object.fromEntries([1, 2].map(level => [`lover_tsumugi_lv${level}`, { lines: [{ speaker: "tsumugi", text: "話そう", face: "normal" }] }]));
  const controller = new AbortController();
  if (outcome === "cancel") playResult = () => ({ cancelled: true });
  if (outcome === "missing") playResult = () => undefined;
  if (outcome === "throw") playHook = async () => { throw Error("controlled milestone failure"); };
  if (outcome === "abort") playHook = async () => controller.abort();
  assert.equal(actualStats.bond.private, false);
  const reading = romance.playLoverMilestone("tsumugi", { signal: controller.signal });
  if (outcome === "throw") await assert.rejects(reading, /controlled milestone failure/);
  else assert.equal(await reading, outcome === "complete");
  assert.equal(actualStats.bond.private, false, `${outcome}: scope restored`);
  if (outcome === "complete") {
    assert.deepEqual(clone(state.loverEventsSeen), ["lover_tsumugi_lv1"]);
    assert.equal(state.lovePts.tsumugi, 32); assert.equal(state.loveLevel.tsumugi, 2);
    assert.equal(state.flags._tsumugi_love_waiting_pts, 17, "Actual release stops before the next unread stage");
    assert.equal(actualStats.releaseLoveAffinity("tsumugi"), 0, "No second release before reading that stage");
  } else {
    assert.deepEqual(clone(state.loverEventsSeen), []); assert.equal(state.lovePts.tsumugi, 9);
    assert.equal(state.flags._tsumugi_love_waiting_pts, 40);
  }
  console.log(`[814 stats port] PASS ${outcome}: real scope/release and existing public milestone`);
}
reset();

// 通知ボタンは一度だけ最新の送り主を渡す。
reset(); state.inbox.push(item(invitation("a", "minto")), item(invitation("b", "rin")));
const opened = []; phone.pushNotice(2, { onOpen: (sender) => opened.push(sender) });
const notice = find(layers.toasts, "lime-notice"); assert.equal(notice.tag, "button"); notice.onclick(); notice.onclick(); assert.deepEqual(opened, ["rin"]); assert.equal(notice.parent, null);

// #1081 C03: 未読/既読保留の重要な誘いは、再案内で時計を戻さず3日後に一度だけ促す。
for (const read of [false, true]) {
  reset({ day: 1, contacts: ["minto"] });
  db.lime = [invitation("nudge_story", "minto", { important: true })];
  phone.deliverMorning();
  state.inbox[0].read = read;
  if (read) state.limeRead.push("nudge_story");
  for (const day of [2, 3]) {
    state.day = day; phone.deliverMorning(); assert.equal(nudges.length, 0, "3日未満は促さない");
  }
  state.day = 4; phone.deliverMorning();
  assert.equal(nudges.length, 1, "再案内の初回受信から3日で促す");
  assert.match(nudges[0], /LIME.*そろそろ/);
  assert.equal(state.inbox[0].read, read, "促しで既読にしない");
  assert.equal(state.inbox[0].result, "expired", "過去の誘いは失効のまま");
  assert(state.inbox.some(i => i.id.includes("_retry_c1_d4") && !i.read && !i.done));
  assert.equal(state.pendingInvite, undefined); assert.equal(gains.length, 0);
  assert.deepEqual(clone(state.limeRead), read ? ["nudge_story"] : []);
  const saved = clone(state);
  reset(saved); db.lime = [invitation("nudge_story", "minto", { important: true })];
  for (const day of [4, 5, 8]) { state.day = day; phone.deliverMorning(); }
  assert.equal(nudges.length, 0, "保存復元・同日再実行・翌日以降の再案内で繰り返さない");
}

// 重要な返信付き連絡/読むだけの連絡も対象。新着がない朝でも、まとめて一つの通知。
reset({ day: 4, contacts: [] }); db.lime = [];
state.inbox.push(...[false, true].map((read, index) => item({ id: `important_chat_${index}`, sender: "minto",
  type: "chat", important: true, messages: ["大事な連絡"], replies: [{ text: "わかった" }] }, { day: 1, read })));
state.inbox.push(item({ id: "important_note", sender: "adam", type: "chat", important: true, messages: ["連絡"] }, { day: 1 }));
const beforeNudge = clone(state.inbox);
assert.equal(phone.deliverMorning(), 0); assert.equal(nudges.length, 1);
assert.deepEqual(clone(state.inbox), beforeNudge, "既読/返信/履歴を書き換えない");
phone.deliverMorning(); assert.equal(nudges.length, 1);

// 雑談、返信済み、期限切れだけの履歴、他章限定/完了済みの連絡からは促さない。
for (const variant of ["ordinary", "read_note", "replied", "expired_only", "other_chapter", "completed", "tournament", "declined_retry"]) {
  reset({ day: 4, contacts: [] }); db.lime = [];
  const msg = invitation("excluded_nudge", "minto", { important: true });
  const old = item(msg, { day: 1 });
  if (variant === "ordinary") delete msg.important;
  if (variant === "read_note") { msg.type = "chat"; old.read = true; old.done = true; old.replyState = "none"; }
  if (variant === "replied") { old.done = true; old.replyState = "replied"; old.result = "declined"; }
  if (variant === "expired_only") { old.done = true; old.replyState = "expired"; old.result = "expired"; }
  if (variant === "other_chapter") msg.chapter = 2;
  if (variant === "completed") { msg.exclude_flag = "_story_done"; state.flags._story_done = true; }
  if (variant === "tournament") state.phase = "tournament";
  if (variant === "declined_retry") { old.done = true; old.replyState = "replied"; old.result = "declined"; }
  state.inbox.push(old);
  if (!["read_note", "expired_only", "replied"].includes(variant)) {
    // 今日の再案内があっても、完了/章/直近の返信は尊重する。
    state.inbox.push(item({ ...msg, id: `${msg.id}_retry_c1_d4`, origin_id: msg.id }, { originId: msg.id }));
  }
  phone.deliverMorning(); assert.equal(nudges.length, 0, variant);
}
console.log("[1081 C03] PASS unread/deferred/3-day boundary/retries/once/restore/important contacts/exclusions");

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

// #485: 承諾後の所持金不足は、予約と再案内の抑止を一緒に解除する。既読・報酬は戻さない。
reset(); const moneyInvite = invitation("money", "minto", { important: true }); db.lime = [moneyInvite];
phone.deliverMorning(); session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session);
const moneyBooking = state.pendingInvite, moneyHistory = state.inbox[0], moneyGains = gains.length;
state.money = 0; phone.rescheduleInvitation(moneyBooking, "所持金が足りなかったため、約束を別の日に改めることにした");
assert.equal(state.pendingInvite, null); assert.equal(moneyHistory.result, "expired"); assert(moneyHistory.needsResend);
assert(!state.flags._invited_money); assert(moneyHistory.read); assert(state.limeRead.includes("money"));
assert(moneyHistory.log.some((l) => /所持金が足りなかった/.test(l.note || ""))); assert.equal(gains.length, moneyGains);
state.day = 7; state.money = 30000; assert.equal(phone.deliverMorning(), 1); assert.equal(phone.deliverMorning(), 0);
assert.equal(state.inbox.at(-1).originId, "money");
session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session);
const retriedBooking = state.pendingInvite, retriedHistory = state.inbox.at(-1);
phone.completeInvitation(retriedBooking); state.pendingInvite = null;
assert(retriedHistory.completed); assert.equal(retriedHistory.result, "accepted"); assert(!retriedHistory.needsResend);
state.day = 8; phone.deliverMorning(); assert.equal(state.inbox.filter(i => i.originId === "money").length, 2); assert.equal(retriedHistory.log.length, 2);

// 予約だけ消えていた旧セーブは、未完了の重要な招待だけを救済する。後の辞退や再案内を上書きしない。
for (const event of ["ch1_minto_fifth", "ch1_minto_private_1", "ch1_adam_outing_dagurikura", "outing_tsumugi_1", "ch1_minto_bond_finale", "hiyori_tonari_return"]) {
  reset({ day: 7 }); const source = allMessages.find(m => m.accept_event === event);
  db.lime = [source]; const history = item({ ...source, important: false }, { day: 6, read: true, done: true, result: "accepted" });
  state.inbox.push(history); state.limeRead.push(source.id); state.flags[`_invited_${source.id}`] = true;
  phone.expireInvitations(); assert.equal(history.result, "expired", event); assert(history.needsResend, event);
  assert(!state.flags[`_invited_${source.id}`], event); assert(history.read, event); assert(state.limeRead.includes(source.id), event);
  const logs = history.log.length; phone.expireInvitations(); assert.equal(history.log.length, logs, event);
}
for (const [event, done] of [
  ["ch1_minto_fifth", () => state.flags._minto_fifth_done = true],
  ["ch1_minto_private_1", () => state.flags._minto_private_done = true],
  ["ch1_adam_outing_dagurikura", () => state.flags._adam_arcade_done = true],
  ["outing_tsumugi_1", () => state.flags._outing_done_tsumugi = true],
  ["ch1_minto_bond_finale", () => state.finales = { minto: { route: "friend" } }],
  ["hiyori_tonari_return", () => state.flags._hiyori_tonari_return_done = true],
]) {
  reset({ day: 7 }); const source = allMessages.find(m => m.accept_event === event); db.lime = [source]; done();
  const history = item(source, { day: 6, read: true, done: true, result: "accepted" }); state.inbox.push(history);
  state.flags[`_invited_${source.id}`] = true; phone.expireInvitations();
  assert.equal(history.result, "accepted", event); assert(!history.needsResend, event); assert(state.flags[`_invited_${source.id}`], event);
}
reset(); db.lime = [moneyInvite]; state.inbox.push(item(moneyInvite, { day: 5, done: true, result: "accepted" }),
  item({ ...moneyInvite, id: "money_retry_c1_d6", origin_id: "money" }, { originId: "money", done: true, result: "declined" }));
state.flags._invited_money = true; phone.expireInvitations(); assert.equal(state.inbox[0].result, "accepted"); assert(state.flags._invited_money);

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

// #326: 未読・既読保留・旧版失効・保存済み予約の店LIMEは同日夜も可。日付/休日/私的外出は守る。
const shopMsg = allMessages.find(m => m.id === "lime_minto_day4");
for (const read of [false, true]) {
  reset({ day: 4, slot: 0 }); const late = item(clone(shopMsg), { read }); state.inbox.push(late);
  if (read) state.limeRead.push(shopMsg.id);
  state.slot = 1; phone.expireInvitations({ fixedNight: () => true });
  assert(!late.done); session = phone.openLime({ sender: "minto", fixedNight: () => true });
  await click("reply-0"); await closeThread(session);
  assert.equal(state.pendingInvite.slot, 1); assert.equal(state.pendingInvite.day, 4);
  const reserved = clone(state.pendingInvite); phone.expireInvitations({ fixedNight: () => true });
  assert.deepEqual(clone(state.pendingInvite), reserved); assert.equal(late.result, "accepted");
  const count = gains.length; session = phone.openLime({ sender: "minto" }); await closeThread(session);
  assert.equal(gains.length, count); assert.deepEqual(clone(state.pendingInvite), reserved);
  state.slot = 2; phone.expireInvitations(); assert.equal(state.pendingInvite, null);
}
reset({ day: 4, slot: 1 }); const oldExpired = item(clone(shopMsg), { read: true, done: true, result: "expired" });
state.inbox.push(oldExpired); phone.expireInvitations(); assert(!oldExpired.done); assert.equal(oldExpired.replyState, "waiting");
reset({ day: 4, slot: 1 }); const oldBooking = item(clone(shopMsg), { read: true, done: true, result: "accepted" });
state.inbox.push(oldBooking); state.pendingInvite = { day: 4, slot: 0, originId: shopMsg.id, sender: "minto", event: shopMsg.accept_event };
phone.expireInvitations({ fixedNight: () => true }); assert.equal(state.pendingInvite.slot, 1); assert.equal(oldBooking.result, "accepted");
for (const scenario of [{ day: 5, slot: 1, itemDay: 4 }, { day: 6, slot: 0, itemDay: 6 }, { day: 4, slot: 2, itemDay: 4 },
  { day: 4, slot: 1, itemDay: 4, flags: { _temporary_closed_minto: "1:4" } }]) {
  reset(scenario); const unavailable = item(clone(shopMsg), { day: scenario.itemDay }); state.inbox.push(unavailable);
  phone.expireInvitations(); assert.equal(unavailable.result, "expired"); assert.equal(state.pendingInvite, undefined);
}
reset({ day: 4, slot: 1 }); const lunchOnly = item(invitation("day_outing", "tsumugi", { time_slot: "noon", accept_event: "outing_tsumugi_1" }));
state.inbox.push(lunchOnly); phone.expireInvitations(); assert.equal(lunchOnly.result, "expired");

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

// 初私服の約束は店の第五会話後、休日午後か営業後。週一の定休日を待って進行不能にしない。
reset({ day: 5, story: { minto: 4 } }); assert(!phone.morningMessages().some((m) => m.id === "lime_minto_first_holiday"));
state.story.minto = 5; const firstWorkday = phone.morningMessages().find((m) => m.id === "lime_minto_first_holiday");
assert.equal(firstWorkday.time_slot, "night"); assert(firstWorkday.after_close);
// 同じ雛形を読む旧版はprivateContext/privateWhenを置換しない。本文・返事は単独でも自然に表示できる。
const firstTemplate = db.lime.find((m) => m.id === "lime_minto_first_holiday");
assert.equal(firstTemplate.time_slot, "night");
assert(!JSON.stringify(firstTemplate).includes("{private"));
const firstTemporary = phone.morningMessages({ fixedNight: () => true }).find((m) => m.id === "lime_minto_first_holiday"); assert.equal(firstTemporary.time_slot, "noon"); assert(firstTemporary.temporary_closed);
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
    assert(lines.some((line) => line.speaker === "minto" && /緑川栞.*２人の時/.test(line.text)));
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
const rumor = allMessages.find((m) => m.id === "rumor_minto_late_night");
assert.equal(rumor.trigger_flag, "_minto_phantom_shared", "既に話した後の続報として届ける");
assert(rumor.messages.some((m) => /聞いてくれてありがとう/.test(m.text)));
assert(!rumor.messages.some((m) => /まだ起きてる|おやすみ|こんな時間/.test(m.text)));
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
reset({ day: 3, contacts: ["naru"] }); const naruDayOff = phone.morningMessages().find((m) => m.id === "lime_outing_naru_1"); assert(naruDayOff); assert(naruDayOff.messages.some((line) => /休み/.test(typeof line === "string" ? line : line.text)));
state.day = 4; const naruTemporary = phone.morningMessages().find((m) => m.id === "lime_outing_naru_1"); assert.equal(naruTemporary.time_slot, "noon"); assert(naruTemporary.temporary_closed);
// 次の私服の約束を定休日だけに縛らない。配信した時点で本文と予約時刻を一緒に確定。
for (const day of [6, 11]) {
  reset({ day, lastBaitoDay: day, flags: { _minto_identity_revealed: true, _minto_fifth_done: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
  const flexible = phone.morningMessages({ fixedNight: () => false })[0]; assert(flexible); assert.equal(flexible.time_slot, day === 6 ? "noon" : "night");
  assert.equal(flexible.after_close, day !== 6); assert.equal(flexible.closed_on, day === 6 ? 6 : undefined);
  const text = JSON.stringify(flexible); assert(!text.includes("{private")); assert.match(text, day === 6 ? /お店がお休み.*午後/ : /仕事を終えたあと/);
  assert.equal(phone.deliverMorning({ fixedNight: () => false }), 1);
  const received = state.inbox[0]; assert.equal(received.msg.time_slot, flexible.time_slot);
  session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session);
  assert.equal(state.pendingInvite.slot, day === 6 ? 0 : 1); assert.equal(state.pendingInvite.afterClose, day !== 6);
  phone.expireInvitations({ fixedNight: () => false }); assert(state.pendingInvite, "resolved night slot must survive reopening LIME");
}
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true, _minto_fifth_done: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2]; assert.equal(phone.deliverMorning({ fixedNight: () => true }), 1); assert(state.inbox[0].msg.temporary_closed);
session = phone.openLime({ sender: "minto" }); await click("reply-0"); await closeThread(session);
assert.equal(state.pendingInvite.slot, 0); assert(state.pendingInvite.temporaryClosed); assert(!state.pendingInvite.afterClose);
assert.equal(state.flags._temporary_closed_minto, "1:11");
phone.expireInvitations(); assert(state.pendingInvite, "temporary holiday must survive reopening LIME without fixed-night options");
// 返事を忘れた休日の約束を、次の適合する仕事後の夜に再案内。本文に古い休日を残さない。
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true, _minto_fifth_done: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
const oldHoliday = { ...invitationById.lime_outing_minto_2, time_slot: "noon", closed_on: 6, after_close: false, messages: ["午後、会える？"] };
state.inbox.push(item(oldHoliday, { day: 6, read: true })); state.limeRead.push(oldHoliday.id);
assert.equal(phone.deliverMorning({ fixedNight: () => false }), 1); const laterPrivate = state.inbox.at(-1).msg;
assert(laterPrivate.origin_id === oldHoliday.id && laterPrivate.id.includes("_retry_c1_d11")); assert.equal(laterPrivate.time_slot, "night"); assert(laterPrivate.after_close); assert(!/お店がお休み|\{private/.test(JSON.stringify(laterPrivate)));
// 既存予約が古い休日枠だった場合も、営業時間外でない昼の約束を履歴付きで再案内へ。
reset({ day: 11, lastBaitoDay: 11, flags: { _minto_identity_revealed: true, _minto_fifth_done: true }, contacts: ["minto"] }); db.lime = [invitationById.lime_outing_minto_2];
const oldWrongDay = item(oldHoliday, { read: true, done: true, result: "accepted" }); state.inbox.push(oldWrongDay);
state.pendingInvite = { day: 11, originId: oldHoliday.id, event: oldHoliday.accept_event, sender: "minto", slot: 0 };
phone.expireInvitations({ fixedNight: () => false }); assert.equal(state.pendingInvite, null); assert(oldWrongDay.needsResend); assert(oldWrongDay.log.some((l) => /別の日/.test(l.note || "")));

// 第2章は通算日を保存し、朝の条件と記念日だけを適切な時計で読む。
reset({ chapter: 2, day: 16, flags: { _ch2_day1: { startDay: 15 }, _ch2_ageha_contact: true }, contacts: ["ageha"] });
db.lime = allMessages.filter(m => m.id === "lime_ch2_ageha_after_visit");
assert.equal(phone.deliverMorning(), 1); assert.equal(state.inbox[0].msg.sender, "ageha");
assert.equal(phone.deliverMorning(), 0, "Read/unread buffers must not duplicate the new contact's message");
reset({ chapter: 2, day: 16, flags: { _ch2_day1: { startDay: 15 }, _ch2_ageha_contact: true }, contacts: [] });
db.lime = allMessages.filter(m => m.id === "lime_ch2_ageha_after_visit"); assert.equal(phone.deliverMorning(), 0, "No message without an actual contact exchange");
reset({ chapter: 1, day: 3, flags: { _ch2_ageha_contact: true }, contacts: ["ageha"] });
db.lime = allMessages.filter(m => m.id === "lime_ch2_ageha_after_visit"); phone.deliverMorning(); assert(!state.inbox.some(item => item.msg.sender === "ageha"));
reset({ chapter: 2, day: 17, flags: { _ch2_day1: { startDay: 15 } }, contacts: ["naru"] });
db.lime = [{ id: "ch2_clock_probe", sender: "naru", chapter: 2, type: "chat", trigger_condition: "lime_exchanged", trigger_day: 3, messages: ["章内DAY3"] }];
assert.equal(phone.deliverMorning(), 1, "Chapter-scoped triggers use local DAY3, not elapsed day17");
reset({ chapter: 2, day: 16, flags: { _ch2_day1: { startDay: 15 } }, lovers: ["minto"], contacts: ["minto"], loverSince: { minto: 6 } });
db.lime = []; db.lover = { anniversary: { minto: { m: ["{n}日"], r: [] } } };
assert.equal(phone.morningMessages()[0].id, "_lover_anniv_minto_n10", "Chapter transition must preserve ten-day anniversaries");
reset({ chapter: 2, day: 16, flags: { _ch2_day1: { startDay: 15 } }, lovers: ["minto"], contacts: ["minto"], lastDate: { minto: 12 } });
db.lime = []; db.lover = { inviteLines: { minto: ["仕事のあと"] } };
assert.equal(phone.morningMessages()[0].type, "invitation", "Dates remain available before the chapter-two tournament");

// #1178 CH2-TF-02/03: 実データの日数指定LIMEを章内日で配信する。
for (const [id, sender, due] of [
  ["lime_ageha_day3", "ageha", 3],
  ["lime_ageha_day5", "ageha", 5],
  ["rumor_kemuri_experiments", "naru", 3],
]) {
  const message = allMessages.find(m => m.id === id);
  assert(message, id);
  for (const startDay of [8, 15]) {
    const setup = (localDay, overrides = {}) => {
      reset({ chapter: 2, day: startDay + localDay - 1, lastBaitoDay: startDay + localDay - 1,
        flags: { _ch2_day1: { startDay } }, contacts: [sender], ...overrides });
      db.lime = [message];
    };
    for (const [day, expected] of [[due - 1, 0], [due, 1], [due + 1, 1], [due + 2, 0]]) {
      setup(day);
      assert.equal(phone.deliverMorning(), expected, `${id}: start=${startDay}, DAY${day}`);
      if (expected) {
        assert.equal(state.inbox[0].id, id);
        assert.equal(phone.deliverMorning(), 0, `${id}: 未読を二重配信しない`);
        state.inbox[0].read = true; state.inbox[0].done = true; state.limeRead.push(id);
        const saved = clone(state);
        assert.equal(phone.deliverMorning(), 0, `${id}: 既読を再配信しない`);
        setup(day, saved);
        assert.equal(phone.deliverMorning(), 0, `${id}: 保存復元後も一度きり`);
      }
    }
    setup(due, { contacts: [] });
    assert.equal(phone.deliverMorning(), 0, `${id}: 連絡先交換前は配信しない`);
    for (const chapter of [1, 3]) {
      setup(due, { chapter, day: due, lastBaitoDay: due });
      phone.deliverMorning(); // 第1章DAY3にはスミの固定バイト連絡もある。
      assert(!state.inbox.some(item => item.id === id), `${id}: 第${chapter}章では配信しない`);
    }
    setup(due);
    state.inbox.push(item({ id: `older_${id}`, sender, type: "chat" }));
    assert.equal(phone.deliverMorning(), 0, `${id}: 同じ相手の未読を優先`);
    setup(due);
    assert.equal(phone.deliverMorning({ tournamentDay: true }), 0, `${id}: 大会当日は配信しない`);
  }
}
console.log("[1178 CH2-TF-02/03] PASS actual messages/local days/contacts/chapter/once/restore");

// #1210: 訪問直後の返信は、同じ朝に窓が開く定期雑談より先。定期雑談は次の朝（+1日）に届く。
{
  const day3 = allMessages.find(m => m.id === "lime_ageha_day3");
  const afterVisit = allMessages.find(m => m.id === "lime_ch2_ageha_after_visit");
  assert(day3 && afterVisit);
  reset({ chapter: 2, day: 17, flags: { _ch2_day1: { startDay: 15 }, _ch2_ageha_contact: true }, contacts: ["ageha"] });
  db.lime = [day3, afterVisit]; // ファイル順では定期雑談が先。priority で返信を先に届ける。
  assert.equal(phone.deliverMorning(), 1);
  assert.equal(state.inbox.map(i => i.id).join(), "lime_ch2_ageha_after_visit");
  state.inbox[0].read = true; state.inbox[0].done = true; state.limeRead.push(afterVisit.id);
  state.day = 18; // chapterDay 4。day3 の trigger_day 3 は +1 日まで有効。
  assert.equal(phone.deliverMorning(), 1);
  assert.equal(state.inbox.at(-1).id, "lime_ageha_day3");
  assert.equal(state.inbox.filter(i => i.id === "lime_ageha_day3").length, 1);
  assert.equal(state.inbox.filter(i => i.id === "lime_ch2_ageha_after_visit").length, 1);
}
console.log("[1210] PASS ageha after-visit precedes day3; day3 arrives the next morning");

// #782: 追加候補も本番の連絡先/未読/1話題/一度きり/最大3通の制御を通す。
db.friends = JSON.parse(await fs.readFile(new URL("data/friends.json", root), "utf8"));
for (const day of [5, 10]) {
  reset({ day, lastBaitoDay: day, contacts: ["tsumugi"] }); db.lime = [];
  const original = JSON.stringify(db.friends);
  assert.equal(phone.deliverMorning(), 1);
  assert.equal(state.inbox[0].id, `lime_tsumugi_note_day${day}`);
  assert.equal(phone.deliverMorning(), 0);
  state.inbox[0].read = true; state.inbox[0].done = true;
  assert.equal(phone.deliverMorning(), 0);
  state.day++;
  assert.equal(phone.deliverMorning(), 0);
  assert.equal(JSON.stringify(db.friends), original);
  assert.equal(gains.length, 0, "配信だけで好感度を変更した");
}
reset({ day: 5, contacts: [] }); db.lime = []; assert.equal(phone.deliverMorning(), 0);
reset({ day: 5, contacts: ["tsumugi"], inbox: [{ id: "older", day: 1, chapter: 1, read: false, msg: { sender: "tsumugi", type: "chat" } }] });
db.lime = []; assert.equal(phone.deliverMorning(), 0);
reset({ day: 5, contacts: ["tsumugi"], inbox: [{ id: "recent", day: 4, chapter: 1, read: true, done: true, msg: { sender: "tsumugi", type: "chat" } }] });
db.lime = []; assert.equal(phone.deliverMorning(), 0);
reset({ day: 5, contacts: ["tsumugi"] });
db.lime = [{ id: "priority_tsumugi", sender: "tsumugi", priority: 1, type: "chat", trigger_condition: "lime_exchanged", trigger_day: 5, messages: ["既存の優先連絡"] }];
assert.equal(phone.deliverMorning(), 1); assert.equal(state.inbox[0].id, "priority_tsumugi");
reset({ chapter: 2, day: 5, contacts: ["tsumugi"] }); db.lime = []; assert.equal(phone.deliverMorning(), 0);
reset({ day: 5, contacts: ["tsumugi"] }); db.lime = []; assert.equal(phone.deliverMorning({ tournamentDay: true }), 0);
reset({ day: 5, contacts: ["naru", "adam", "minto", "tsumugi"] });
db.lime = ["naru", "adam", "minto"].map(sender => ({ id: `cap_${sender}`, sender, priority: 1,
  type: "chat", trigger_condition: "lime_exchanged", trigger_day: 5, messages: ["既存の優先連絡"] }));
assert.equal(phone.deliverMorning(), 3);
assert(!state.inbox.some(item => item.msg.sender === "tsumugi"));
// 章をまたぐ同じ日付と、chapter がない旧セーブの表示。
reset({ chapter: 2, day: 3 });
const historyMessage = { id: "history", sender: "minto", type: "chat", messages: ["履歴"] };
state.inbox.push(
  item(historyMessage, { chapter: 1, day: 14, read: true, done: true }),
);
session = phone.openLime(); await settle();
assert.equal(find(layers.modal, "lime-chat-minto").children[2].children[0].text, "第1章 DAY 14");
await click("phone-close"); await session;
state.inbox.push(
  item(historyMessage, { chapter: 1, day: 3, read: true, done: true }),
  item(historyMessage, { chapter: 2, day: 3, read: true, done: true }),
  item(historyMessage, { day: 2, read: true, done: true }),
);
session = phone.openLime(); await settle();
const row = find(layers.modal, "lime-chat-minto");
assert.equal(row.children[2].children[0].text, "昨日");
await click("lime-chat-minto");
assert.deepEqual(layers.modal.querySelectorAll(".day").map((node) => node.text), ["第1章 DAY 14", "第1章 DAY 3", "今日", "昨日"]);
await closeThread(session);

// #1081 C04: 未読の誘いを前提に約束の場面を始めない。先に開かせるトークを返し、既読や予約済みなら案内しない。
reset({ day: 5, contacts: ["minto"] });
const c04Invite = { originId: "c04_minto", sender: "minto", event: "ch1_minto_fifth", day: 5, slot: 1 };
// 予約だけ残り、本文を読んでいない（旧セーブ/復元）→ そのトークを先に開かせる。
state.inbox.push(item(invitation("c04_minto", "minto"), { read: false, done: true, result: "accepted", replyState: "replied" }));
assert.equal(phone.invitationReadBeforeMeeting(c04Invite), "minto");
// 読み終えていれば案内しない。
state.inbox[0].read = true;
assert.equal(phone.invitationReadBeforeMeeting(c04Invite), null);
// 受信箱に無い予約・予約そのものが無い場合は何も返さない（進行を止めない）。
assert.equal(phone.invitationReadBeforeMeeting({ originId: "missing", sender: "naru" }), null);
assert.equal(phone.invitationReadBeforeMeeting(null), null);
// みんとの私用アカウントなど、トーク単位（account）が分かれていてもその単位で開かせる。
reset({ day: 5, contacts: ["minto"], lovers: ["minto"], loveLevel: { minto: 1 }, met: { minto: true } });
state.inbox.push(item(invitation("c04_private", "minto"), { account: "minto_private", read: false, done: true, result: "accepted" }));
assert.equal(phone.invitationReadBeforeMeeting({ originId: "c04_private", sender: "minto" }), "minto_private");
reset();

console.log("[remake LIME] notification/reply/invitations/legacy + #782 contact/unread/once/gap/priority + #1081 C04 unread guard: PASS");
