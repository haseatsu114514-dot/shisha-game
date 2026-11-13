// LIMEの連絡の塩梅（2026-10-31 LM01〜LM06）。本番の phone.js・romance.js・casual-lime.js をVMで読み、
// 何日も朝を進めて、通知と返事の要る連絡が積み上がらないことを確かめる。
// node --experimental-vm-modules remake/test/lime_balance.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { clamp } from "../js/core/util.js";
import { MAX_MONEY } from "../js/core/rules.js";
import { STAT_JA, hasAffinity } from "../js/core/state.js";
import { chapterDay, chapterDaysLeft, departurePrep, relationshipElapsedDay } from "../js/core/chapter-clock.js";
import { chapterFeatureEnabled } from "../js/core/chapter-features.js";
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
db.lover = JSON.parse(await fs.readFile(new URL("data/lover.json", root), "utf8"));
db.casualLime = JSON.parse(await fs.readFile(new URL("data/casual_lime.json", root), "utf8"));
db.manifest = { limeMedia: JSON.parse(await fs.readFile(new URL("data/lime_media.json", root), "utf8")) };
let friendQueue = [];
const noop = () => {}, mods = new Map();
const values = {
  "chapter-clock.js": { chapterDay, chapterDaysLeft, departurePrep, relationshipElapsedDay },
  "chapter-features.js": { chapterFeatureEnabled },
  "hiyori-route.js": { hiyoriEventStatus: () => "disabled", hiyoriRoute: () => ({}), hiyoriFinaleReady: () => false },
  "util.js": { el, clamp, sleep: async () => {}, fitOneLine: () => {}, yen: (n) => `¥${n}` },
  "data.js": { DB: db, displayName: (id) => id, limeAccountName: (id) => id, callName: (id) => id, faceIconUrl: () => null },
  "lime-icons.js": { customLimeIconUrl: () => null },
  "ui.js": { layers, toast: noop }, "state.js": { state, save: noop, STAT_JA, hasAffinity, STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"] },
  "stats.js": { setStoryAffinityCap() {}, affinityGateWaiting: () => false, gainStat: noop, addMoney: noop, gainAffinity: (id, pts) => gains.push({ id, pts }),
    affinityLevel: (id) => (state.lovers || []).includes(id) ? 5 : state.levels?.[id] ?? 0, applyStats: noop, bond: {}, addStamina: noop, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66] },
  "audio.js": { SE: { phone: noop, phoneReceive: noop, phoneSend: noop, select: noop, click: noop, cancel: noop } },
  "engine.js": { isPlaying: () => false, hooks: {}, play: async () => ({ visited: [] }) },
  "rules.js": { MAX_MONEY, TOURNAMENT_DAY: 14 },
  "text.js": { formatHtml: (t) => t }, "spots.js": { hasContact: (id) => state.contacts.includes(id), spotById: (id) => ({ charId: id, closedOn: 6 }), isClosed: () => false },
  "bus.js": { emit: noop },
  "bonds.js": { bondInvites: () => [], friendMessages: () => friendQueue },
  "story-knowledge.js": { syncMintoKnowledge: noop },
  // サメちゃんのデート（samechan-date.js）が読む心得の盤。LIMEの検査なので旧しくみ（盤は無効）の代役にする
  "growth.js": { growthEnabled: () => false, awardActionExp: () => 0 },
  "petit-shuraba.js": { petitAfterDate: async () => false }, // プチ修羅場（デートの後の寄り道）は remake/test/petit_shuraba.mjs
  "lover-strain.js": { strainOf: () => 0, STRAIN_SIGN2: 7 }, // すれ違い（恋人の裏の数値）は remake/test/lover_strain.mjs。この検査では動かない
  "gallery-progress.js": { recordRouteLover: noop, recordRouteEvent: noop }, // コレクションのルート記録（恋人成立・閲覧した段階）は remake/test/gallery_route_records.mjs
};
const coreFiles = { "stat-step-tables.js": "stat-step-tables.js", "production-stats.js": "stats.js", "condition.js": "condition.js", "affinity-stages.js": "affinity-stages.js", "travel-budget.js": "travel-budget.js" };
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  let mod;
  if (values[name]) mod = new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name });
  else mod = new vm.SourceTextModule(await fs.readFile(new URL(coreFiles[name] ? `js/core/${coreFiles[name]}` : `js/daily/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod;
}
const statsModule = await load("production-stats.js"); await statsModule.evaluate();
Object.assign(values["stats.js"], { bond: statsModule.namespace.bond, privateBondScope: statsModule.namespace.privateBondScope, releaseLoveAffinity: statsModule.namespace.releaseLoveAffinity });
const phoneModule = await load("phone.js"); await phoneModule.evaluate();
const phone = phoneModule.namespace, romance = (await load("romance.js")).namespace;

function reset(overrides = {}) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, { chapter: 1, phase: "daily", money: 30000, day: 1, slot: 0, flags: {}, limeRead: [], inbox: [], contacts: [], met: {}, story: {},
    lastBaitoDay: 99, lovers: [], loveLevel: {}, loverSince: {}, lastDate: {}, lovePts: {}, loverEventsSeen: [], finales: {}, levels: {}, owned: [] }, overrides);
  friendQueue = []; gains.length = 0;
}
/** その朝に届いた分を、読んだものとして受信箱へ積む（翌朝の判定に使う） */
function deliver(msgs) {
  for (const m of msgs) {
    state.inbox.push({ id: m.id, originId: m.origin_id || m.id, day: state.day, chapter: state.chapter, msg: { ...m }, read: true, done: true, log: [] });
    state.limeRead.push(m.id);
  }
}

// LM01〜LM03: 恋人が3人いても、朝のひとことは朝に1通・同じ恋人は3日あける・返事なし。誘いは全員で4日に1回。
{
  reset({ lovers: ["tsumugi", "minto", "rio"], loverSince: { tsumugi: 0, minto: 0, rio: 0 }, loveLevel: { tsumugi: 1, minto: 1, rio: 1 }, lastDate: {} });
  const days = { morning: {}, invite: [] };
  let stamps = 0;
  for (let day = 1; day <= 13; day++) {
    state.day = day;
    const msgs = romance.loverMessages({ fixedNight: () => false });
    const mornings = msgs.filter((m) => m.id.startsWith("_lover_morning_"));
    const invites = msgs.filter((m) => m.type === "invitation");
    assert(mornings.length <= 1, `DAY${day}: 恋人の朝のひとことは朝に1通まで`);
    assert(invites.length <= 1, `DAY${day}: 恋人の誘いは朝に1通まで`);
    for (const m of mornings) {
      assert(!m.replies?.length, `${m.id}: 朝のひとことは返事なし`);
      if (m.messages.some((line) => line?.stamp)) stamps++;
      const prev = days.morning[m.sender];
      assert(prev == null || day - prev >= 3, `${m.id}: 同じ恋人の朝のひとことは3日あける`);
      days.morning[m.sender] = day;
    }
    if (invites.length) days.invite.push([day, invites[0].sender]);
    deliver(msgs);
  }
  for (let i = 1; i < days.invite.length; i++) assert(days.invite[i][0] - days.invite[i - 1][0] >= 4, `誘いは全員で4日に1回: ${JSON.stringify(days.invite)}`);
  assert(days.invite.length >= 2, "誘いは止まらない");
  assert.equal(new Set(days.invite.slice(0, 3).map(([, id]) => id)).size, 3, `誘いは恋人に順番に回る: ${JSON.stringify(days.invite)}`);
  assert.deepEqual(Object.keys(days.morning).sort(), ["minto", "rio", "tsumugi"], "誰の朝のひとことも届く");
  assert(stamps >= 1, "スタンプの朝がある");
  console.log("[LM01-03] PASS lovers: one morning note per day, read-only, 3-day gap, shared 4-day invite budget, stamp mornings");
}

// IR16: 第5章は帰郷後なので、地元にいる朝は恋人のデートの誘いが届く（大会の章の DAY14 の止めは無い）。
// 東京・ドバイへ出ると、届いていた誘いには乗れず、約束したデートは別の日に改める。一緒にいる恋人からは届かない（IR17）。
{
  reset({ chapter: 5, day: 80, flags: { _ch5: { startDay: 60, stage: 2, part: "free" }, _elapsed_calendar: true }, contacts: ["tsumugi"],
    lovers: ["tsumugi"], loverSince: { tsumugi: 41 }, loveLevel: { tsumugi: 1 }, lovePts: { tsumugi: 9 }, limeRead: ["_lover_private_account_tsumugi"] });
  const invite = () => phone.morningMessages({ fixedNight: () => false }).find((m) => m.accept_event === "date_tsumugi");
  const first = invite();
  assert(first, "第5章の地元の朝は、恋人のデートの誘いが届く");
  assert.equal(first.time_slot, "night");
  assert(!phone.morningMessages({ fixedNight: () => false, exclude: ["tsumugi"] }).some((m) => m.lover && m.sender === "tsumugi"), "一緒にいる恋人からは恋人のLIMEが届かない");
  state.flags._ch2_region = "tokyo";
  assert(!invite(), "東京にいる朝は届かない");
  // 地元で受け取った誘いに、東京へ出てから返事はできない（期限切れの扱い）。
  state.flags._ch2_region = "home";
  state.inbox.push({ id: first.id, originId: first.id, day: 80, chapter: 5, msg: { ...first }, read: true, done: false, replyState: "waiting", log: [] });
  state.flags._ch2_region = "dubai";
  phone.expireInvitations({ fixedNight: () => false });
  assert.equal(state.inbox[0].result, "expired", "ドバイにいる間は地元のデートの誘いに乗れない");
  // 約束したデートも、東京にいたら別の日に改める（その場では会わない）。
  reset({ chapter: 5, day: 81, slot: 1, flags: { _ch5: { startDay: 60, stage: 2, part: "free" }, _ch2_region: "home" }, contacts: ["tsumugi"],
    lovers: ["tsumugi"], loveLevel: { tsumugi: 1 } });
  state.inbox.push({ id: "_date_inv_tsumugi_d81", originId: "_date_inv_tsumugi_d81", day: 81, msg: { id: "_date_inv_tsumugi_d81", sender: "tsumugi", type: "invitation", lover: true,
    accept_event: "date_tsumugi", time_slot: "night", after_close: true, messages: [] }, read: true, done: true, result: "accepted", log: [] });
  state.pendingInvite = { event: "date_tsumugi", sender: "tsumugi", slot: 1, day: 81, originId: "_date_inv_tsumugi_d81", afterClose: true };
  phone.expireInvitations({ fixedNight: () => false });
  assert(state.pendingInvite, "地元にいれば約束はそのまま");
  state.flags._ch2_region = "tokyo";
  phone.expireInvitations({ fixedNight: () => false });
  assert.equal(state.pendingInvite, null, "東京にいれば、地元のデートの約束は改める");
  assert.equal(state.inbox[0].result, "expired");
  assert.equal(state.inbox[0].needsResend, true, "改めた約束は、また誘ってもらえる");
  console.log("[IR16] PASS chapter 5 hometown date invitations; none in Tokyo/Dubai, open ones expire, booked dates are rescheduled; together lovers send none");
}

// LM01: 恋人の読むだけの連絡は、私的なやりとりとして既読で絆に積もる
{
  reset({ lovers: ["tsumugi"], loverSince: { tsumugi: 0 }, loveLevel: { tsumugi: 1 } });
  const src = await fs.readFile(new URL("js/daily/phone.js", root), "utf8");
  assert.match(src, /bond\.private = lover;\s*try \{\s*gainAffinity\(m\.sender, lover \? 3 : 2, \{ remote: true \}\);/);
  console.log("[LM01] PASS read-only lover notes deepen the bond on read");
}

// LM05: ♥3以上の知り合い（恋人・締めくくり前）から読むだけの雑談。全員で3日に1通・同じ相手は6日・一度ずつ。
// 物語の誘い（♥3の外出など）と♥3・♥4で届く物語の雑談（lime_adam_bond_a など）は同じ相手の枠を先に取るので、
// ここでは済ませた（読んだ）状態にして雑談だけを見る。
const storyDone = Object.fromEntries(allMessages.filter((m) => m.type === "invitation").map((m) => [`_invited_${m.id}`, true]));
const storyChatsRead = allMessages.filter((m) => m.type === "chat" && m.trigger_condition === "affinity_level").map((m) => m.id);
{
  reset({ flags: { ...storyDone }, limeRead: [...storyChatsRead], chapter: 2, day: 20, contacts: ["naru", "adam", "minto", "kumicho", "tsumugi"], met: { naru: true, adam: true, minto: true, kumicho: true, tsumugi: true },
    levels: { naru: 3, adam: 4, minto: 2, kumicho: 3, tsumugi: 4 }, lovers: ["tsumugi"], finales: { kumicho: { route: "friend", day: 18 } } });
  const got = [];
  for (let day = 20; day <= 60; day++) {
    state.day = day;
    // その朝に届いた分はすべて読む（LM08: 朝の枠は基本2通。噂・恋人のLIMEと枠を分け合った上で、雑談の決まりを見る）
    const arrived = phone.morningMessages({ fixedNight: () => false });
    const msgs = arrived.filter((m) => m.casual);
    assert(msgs.length <= 1, `DAY${day}: 知り合いの雑談は朝に1通まで`);
    for (const m of msgs) {
      assert(!m.replies?.length && m.type === "chat", `${m.id}: 読むだけ`);
      got.push([day, m.sender, m.id]);
    }
    deliver(arrived);
  }
  const senders = new Set(got.map(([, s]) => s));
  assert.deepEqual([...senders].sort(), ["adam", "naru"], `♥3以上・恋人でも締めくくり後でもない相手だけ: ${JSON.stringify(got)}`);
  for (let i = 1; i < got.length; i++) assert(got[i][0] - got[i - 1][0] >= 3, `全員で3日に1通: ${JSON.stringify(got)}`);
  for (const id of senders) {
    const mine = got.filter(([, s]) => s === id);
    assert.equal(mine.length, db.casualLime.people[id].chats.length, `${id}: 各雑談は一度ずつ`);
    for (let i = 1; i < mine.length; i++) assert(mine[i][0] - mine[i - 1][0] >= 6, `${id}: 同じ相手は6日あける`);
  }
  // 第1章だけの相手（あげは等は第2章だけ）。第1章では第2章の人から届かない
  reset({ flags: { ...storyDone }, chapter: 1, day: 6, contacts: ["kumicho"], met: { kumicho: true }, levels: { kumicho: 4 } });
  assert(!phone.morningMessages().some((m) => m.casual), "章の外の雑談は届かない");
  // 物語のLIMEが届いたばかりの相手からは控える
  reset({ flags: { ...storyDone }, chapter: 2, day: 30, contacts: ["naru"], met: { naru: true }, levels: { naru: 3 } });
  state.inbox.push({ id: "story", day: 29, msg: { sender: "naru", type: "chat" }, read: true, done: true });
  assert(!phone.morningMessages().some((m) => m.casual), "物語のLIMEの直後は控える");
  state.day = 32;
  assert(phone.morningMessages().some((m) => m.casual && m.sender === "naru"));
  console.log("[LM05] PASS acquaintance chats: >=3 hearts only, read-only, shared 3-day gap, 6-day per person, once each, quiet after story LIME");
}

// LM04: 返事の要る物語のLIMEが届く朝は、返事の要る友人の雑談を重ねない（スミさんのバイトの誘いは数えない）
{
  const friendChat = { id: "_friend_chat_kumicho_d5", sender: "kumicho", type: "chat", friend: true, messages: ["やあ"], replies: [{ text: "うん", response: "うむ" }] };
  reset({ chapter: 1, day: 5, contacts: ["minto", "kumicho"], met: { minto: true, kumicho: true } });
  friendQueue = [friendChat];
  const withStory = phone.morningMessages({ fixedNight: () => false });
  assert(withStory.some((m) => m.sender === "minto" && (m.type === "invitation" || m.replies?.length)), "返事の要る物語のLIMEが届く朝");
  assert(!withStory.some((m) => m.id === friendChat.id), "返事の要る友人の雑談は重ねない");
  reset({ chapter: 1, day: 5, contacts: ["kumicho"], met: { kumicho: true } });
  friendQueue = [friendChat];
  assert(phone.morningMessages({ fixedNight: () => false }).some((m) => m.id === friendChat.id), "ほかに返事の要る連絡が無ければ届く");
  console.log("[LM04] PASS reply-needing friend chats wait for a morning without other reply-needing LIME");
}

// LM06: スタンプ・画像は一言の締め・近況の証拠。誘いと噂の本文には入れない（みんとの店の新作案内だけは店の告知として例外）
{
  const media = (lines) => (lines || []).some((line) => line && typeof line === "object" && ("stamp" in line || "image" in line));
  for (const m of allMessages) if (["invitation", "rumor"].includes(m.type) && m.id !== "lime_minto_day4") assert(!media(m.messages), `${m.id}: 誘い・噂の本文にスタンプ・画像を入れない`);
  const catalog = db.manifest.limeMedia;
  const owned = (sender, line) => !line?.stamp && !line?.image || catalog[line.stamp || line.image]?.owner === sender;
  for (const [id, p] of Object.entries(db.casualLime.people)) for (const chat of p.chats) {
    assert(chat.filter((l) => typeof l === "object").length <= 1, `${id}: 雑談の素材は1つまで`);
    assert(typeof chat[0] === "string" && chat.every((l) => owned(id, l)), `${id}: 文字から始まり、本人の素材だけ`);
  }
  for (const [id, s] of Object.entries(db.lover.morningStamp)) assert(typeof s.text === "string" && catalog[s.stamp]?.owner === id, `${id}: 恋人のスタンプの朝`);
  for (const [id, a] of Object.entries(db.lover.anniversary)) assert(a.m.every((l) => typeof l === "string" || owned(id, l)), `${id}: 記念日の画像は本人の素材`);
  console.log("[LM06] PASS media placement: no media in invitations/rumors, one owned asset per casual chat, lover stamp mornings and anniversary images");
}

// #2024: 第3〜5章の物語のLIME（region で届く街を決める）と、遠征中に地元の誘いを帰るまで止めること。
const awayStory = {
  3: ["lime_ch3_sumi_tokyo_settle"],
  4: ["lime_ch4_sumi_settle", "lime_ch4_tsumugi_counter", "lime_ch4_mashiro_mukai", "lime_ch4_ageha_melty", "lime_ch4_saku_stream", "lime_ch4_sumi_eve"],
  5: ["lime_ch5_saku_title", "lime_ch5_kumicho_title", "lime_ch5_rei_title"],
};
const limeById = (id) => allMessages.find((m) => m.id === id);
{
  for (const m of allMessages.filter((x) => x.region)) {
    assert(["home", "away", "tokyo", "dubai"].includes(m.region), `${m.id}: region は home / away / tokyo / dubai`);
    assert(m.chapter, `${m.id}: region を持つLIMEは章も決める`);
  }
  for (const [chapter, ids] of Object.entries(awayStory)) for (const id of ids) {
    const m = limeById(id);
    assert(m, `${id} がある`);
    assert.equal(m.chapter, Number(chapter), `${id}: 第${chapter}章`);
    assert.equal(m.region, { 3: "tokyo", 4: "dubai", 5: "home" }[chapter], `${id}: 届く街`);
    assert(m.type === "chat" && m.messages.every((line) => typeof line.text === "string"), `${id}: 文字だけの雑談`);
    assert.equal(m.replies.length, 2, `${id}: 返事は2つ`);
    assert.equal(new Set(m.replies.map((r) => r.affinity)).size, 2, `${id}: 返事の好感度に差がある`);
  }
  console.log("[#2024] PASS story LIME regions: valid values, chapter set, text-only chats with two replies");
}

// 東京にいる間: 地元の外出の誘いは届かない（雑談・噂・恋人の朝のひとこと・物語のLIMEは届く）。
// 第4章の出発前（地元）に戻ると、止めていた誘いが届く。同じ朝に積み上がらない（朝に3通・1人1通）。
{
  reset({ chapter: 3, day: 43, flags: { _ch3_intro: { startDay: 43, stage: 3, titleSeen: true, routeVersion: 3 }, _ch2_region: "tokyo" },
    contacts: ["sumi", "adam", "ageha", "tsumugi", "minto"], met: { adam: true, ageha: true, tsumugi: true, minto: true },
    levels: { adam: 3, ageha: 3, tsumugi: 3 }, lovers: ["minto"], loverSince: { minto: 0 }, loveLevel: { minto: 1 },
    limeRead: ["_lover_private_account_minto"] });
  const got = [];
  for (let day = 43; day <= 55; day++) {
    state.day = day;
    const msgs = phone.morningMessages({ fixedNight: () => false, invitations: false });
    assert(msgs.length <= 3 && new Set(msgs.map((m) => m.sender)).size === msgs.length, `東京DAY${chapterDay(state)}: 朝に3通・1人1通`);
    for (const m of msgs) {
      assert.notEqual(m.type, "invitation", `東京DAY${chapterDay(state)}: 地元で会う誘いは届かない（${m.id}）`);
      got.push([chapterDay(state), m.id, m.sender]);
    }
    deliver(msgs);
  }
  const ids = got.map(([, id]) => id);
  assert(!ids.some((id) => /^lime_outing_/.test(id)), `♥3の外出の誘いは東京では届かない: ${ids}`);
  assert(ids.includes("rumor_ageha_mashiro"), "噂は東京でも届く");
  assert(ids.some((id) => id.startsWith("_lover_morning_minto")), "恋人の朝のひとことは東京でも届く");
  assert(got.some(([, id, sender]) => sender === "ageha" && !id.startsWith("rumor_")), "知り合いの雑談も東京で届く");
  const settle = got.filter(([, id]) => id === "lime_ch3_sumi_tokyo_settle");
  assert.equal(settle.length, 1, "スミさんの東京の連絡は一度だけ");
  assert([2, 3].includes(settle[0][0]), `東京DAY2〜3に届く: ${settle[0][0]}`);
  // 帰郷して第4章の出発前（地元の3日）。止めていた♥3の外出の誘いが届き、ドバイの物語のLIMEは届かない。
  Object.assign(state, { chapter: 4, day: 56 });
  Object.assign(state.flags, { _ch2_region: "home", _ch4_prep: { startDay: 56, days: 3, step: 0, departed: false },
    _ch4: { startDay: 59, day: 1, stage: 0, part: "prologue", read: {} } });
  const home = [];
  for (let day = 56; day <= 58; day++) {
    state.day = day;
    const msgs = phone.morningMessages({ fixedNight: () => false });
    assert(msgs.length <= 3 && new Set(msgs.map((m) => m.sender)).size === msgs.length, `出発前${chapterDay(state)}日目: 朝に3通・1人1通`);
    home.push(...msgs.map((m) => m.id));
    deliver(msgs);
  }
  for (const id of ["lime_outing_adam_1", "lime_outing_ageha_1", "lime_outing_tsumugi_1"]) assert(home.includes(id), `${id}: 地元に戻ると届く（${home}）`);
  assert(!home.some((id) => awayStory[4].includes(id)), `出発前の地元ではドバイの物語のLIMEは届かない（同じ章内日でも）: ${home}`);
  console.log("[#2024] PASS Tokyo holds hometown invitations (chats, rumors, lover notes, story LIME still arrive); they arrive back home");
}

// 東京のムカイさんのシフトの誘いは、仕事の連絡なので東京で届く。
{
  reset({ chapter: 3, day: 44, weatherSeed: 0, flags: { _ch3_intro: { startDay: 43, stage: 3, titleSeen: true, routeVersion: 3 }, _ch2_region: "tokyo", _mukai_shift_day: 0 },
    contacts: ["mukai_master"] });
  db.limeTemplates = JSON.parse(await fs.readFile(new URL("data/lime_messages.json", dataRoot), "utf8")).templates;
  try {
    const mukai = phone.morningMessages({ fixedNight: () => false }).find((m) => m.accept_event === "__mukai_baito__");
    assert(mukai, "東京ではムカイさんのシフトの誘いが届く");
    // 届いた誘いに東京で返事でき、受けたシフトもそのまま残る（地元の誘いのように期限切れ・日の改めにならない）
    state.inbox.push({ id: mukai.id, originId: mukai.id, day: state.day, chapter: 3, msg: { ...mukai }, read: true, done: false, replyState: "waiting", log: [] });
    phone.expireInvitations({ fixedNight: () => false });
    assert(!state.inbox[0].done && state.inbox[0].result !== "expired", "東京のムカイさんの誘いは、返事を待つ間に期限切れにならない");
    Object.assign(state.inbox[0], { done: true, result: "accepted" });
    state.pendingInvite = { event: "__mukai_baito__", sender: "mukai_master", day: state.day, slot: 0, originId: mukai.id };
    phone.expireInvitations({ fixedNight: () => false });
    assert.equal(state.pendingInvite?.event, "__mukai_baito__", "受けた東京のシフトは、別の日に改めない");
    assert.equal(state.inbox[0].result, "accepted", "受けたシフトは受けたまま");
  } finally { delete db.limeTemplates; }
  console.log("[#2024] PASS mukai shift invitation still arrives in Tokyo, stays open to reply, and an accepted shift is kept");
}

// ドバイ: 物語のLIMEはドバイの日だけ・窓の中で一度ずつ（出発前の地元の同じ章内日には届かない）。
// 同行者は隣にいるので、恋人のLIMEも物語のLIMEも送ってこない。別の恋人の朝のひとことは届く。
for (const companion of ["ageha", null]) {
  reset({ chapter: 4, day: 60, flags: { ...storyDone, _ch2_region: "home", _ch4_prep: { startDay: 60, days: 3, step: 0, departed: false },
    _ch4: { startDay: 63, day: 1, stage: 0, part: "prologue", read: {} },
    _overseas_companion: { decided: true, companion, supports: ["tsumugi", "mashiro"] } },
    contacts: ["sumi", "tsumugi", "mashiro", "ageha", "saku"], lovers: ["ageha", "tsumugi"], loverSince: { ageha: 1, tsumugi: 1 }, loveLevel: { ageha: 1, tsumugi: 1 } });
  const got = [];
  for (let day = 60; day <= 74; day++) {
    state.day = day;
    if (day === 63) { state.flags._ch4_prep.departed = true; state.flags._ch2_region = "dubai"; }
    const dubai = state.flags._ch2_region === "dubai";
    const msgs = phone.morningMessages({ fixedNight: () => false, invitations: !dubai, exclude: dubai && companion ? [companion] : [] });
    for (const m of msgs) got.push({ day: chapterDay(state), dubai, id: m.id, sender: m.sender });
    deliver(msgs);
  }
  for (const id of awayStory[4]) {
    const hits = got.filter((g) => g.id === id);
    if (limeById(id).sender === companion) { assert.equal(hits.length, 0, `${id}: 同行者からは届かない`); continue; }
    assert.equal(hits.length, 1, `${id}: 一度だけ届く（${JSON.stringify(hits)}）`);
    const due = limeById(id).trigger_day;
    assert(hits[0].dubai && hits[0].day >= due && hits[0].day <= due + 1, `${id}: ドバイDAY${due}〜${due + 1}に届く（${JSON.stringify(hits[0])}）`);
  }
  if (companion) assert(!got.some((g) => g.dubai && g.sender === companion), `同行者（${companion}）はドバイでLIMEを送ってこない`);
  assert(got.some((g) => g.dubai && g.id.startsWith("_lover_morning_tsumugi")), "ドバイにいない恋人の朝のひとことは届く");
}
console.log("[#2024] PASS Dubai story LIME: once each in its Dubai window, none on prep days, nothing from the companion");

// 第5章: 地元の日に届く（東京・ドバイにいる間は帰るまで待つ）。店で会って話したあとは、同じ祝いを重ねない。
{
  const run = (overrides, days, region = () => "home") => {
    reset({ chapter: 5, day: 100, flags: { ...storyDone, _ch5: { startDay: 100, stage: 2, part: "free" }, _elapsed_calendar: true, ...overrides },
      contacts: ["saku", "kumicho", "rei"] });
    const got = [];
    for (let day = 100; day < 100 + days; day++) {
      state.day = day;
      state.flags._ch2_region = region(day);
      const msgs = phone.morningMessages({ fixedNight: () => false });
      for (const m of msgs) got.push({ day: chapterDay(state), region: state.flags._ch2_region, id: m.id });
      deliver(msgs);
    }
    return got;
  };
  const home = run({}, 10);
  for (const id of awayStory[5]) {
    const hits = home.filter((g) => g.id === id);
    assert.equal(hits.length, 1, `${id}: 一度だけ届く`);
    assert(hits[0].day >= limeById(id).trigger_day, `${id}: 章内DAY${limeById(id).trigger_day}以降`);
  }
  const away = run({}, 10, (day) => day < 108 ? "tokyo" : "home");
  for (const id of awayStory[5]) {
    const hits = away.filter((g) => g.id === id);
    assert(hits.length === 1 && hits[0].region === "home", `${id}: 東京にいる間は待ち、帰ってから届く（${JSON.stringify(hits)}）`);
  }
  // 神崎の店で第5章の会話（世界一の祝い）を読んだ後は、同じ祝いのLIMEを重ねない。
  // レヰの店の会話は動画の話で祝いの言葉を言わないので、LIMEはその前後どちらでも読める文にしてある。
  const met = run({ ch2_kumicho_after_ch2_done: true, _talk_seen_ch5_rei_shop: true }, 10).map((g) => g.id);
  assert(met.includes("lime_ch5_saku_title") && met.includes("lime_ch5_rei_title") && !met.includes("lime_ch5_kumicho_title"),
    `神崎の店で第5章の会話を読んだ後は、神崎の祝いのLIMEを重ねない: ${met}`);
  console.log("[#2024] PASS chapter 5 congratulations arrive once at home, wait while away, kumicho skips after the in-person talk");
}
console.log("[lime balance] PASS");

// #3081: 布巾の場面を読み、連絡先がある朝に一度。旗が無い・連絡先が無い・既読の重ね配信はしない。
{
  const id = "lime_mashiro_glass_cloth";
  const due = (overrides) => {
    reset(overrides);
    return phone.morningMessages({ fixedNight: () => false }).some((m) => m.id === id);
  };
  assert.equal(due({ chapter: 3, day: 50, contacts: ["mashiro"], flags: { _ch3_intro: { startDay: 40, routeVersion: 3 }, _ch2_region: "tokyo" } }), false, "unread scene");
  assert.equal(due({ chapter: 3, day: 50, contacts: [], flags: { _ch3_read_ch3_mashiro_glass_cloth: true, _ch2_region: "tokyo" } }), false, "no contact");
  reset({ chapter: 3, day: 50, contacts: ["mashiro"], flags: { _ch3_read_ch3_mashiro_glass_cloth: true, _ch3_intro: { startDay: 40, routeVersion: 3 }, _ch2_region: "tokyo" } });
  const hit = phone.morningMessages({ fixedNight: () => false }).find((m) => m.id === id);
  assert(hit, "arrives the morning after the cloth scene");
  assert.equal(hit.sender, "mashiro");
  deliver([hit]);
  state.day += 1;
  assert(!phone.morningMessages({ fixedNight: () => false }).some((m) => m.id === id), "once");
  reset({ chapter: 4, day: 60, contacts: ["mashiro"], flags: { _ch3_read_ch3_mashiro_glass_cloth: true, _ch2_region: "dubai" } });
  assert(phone.morningMessages({ fixedNight: () => false }).some((m) => m.id === id), "still arrives if the morning has moved on");
  console.log("[#3081] PASS mashiro cloth LIME once after the scene flag");
}

// ムカイさんは通常好感度がない。面識と連絡先取得で1通だけ、登場章のみ。
{
  const casual = (await load("casual-lime.js")).namespace;
  for (const chapter of [3, 5]) {
    reset({ chapter, day: 20, contacts: ["mukai_master"], met: { mukai_master: true } });
    const messages = casual.casualMessages({ sceneChapter: true });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].messages.at(-1).stamp, "st_mukai_master_latte");
    deliver(messages); state.day += 10;
    assert.equal(casual.casualMessages({ sceneChapter: true }).length, 0);
  }
  for (const overrides of [{ chapter: 4 }, { contacts: [] }, { met: {} }]) {
    reset({ chapter: 3, day: 20, contacts: ["mukai_master"], met: { mukai_master: true }, ...overrides });
    assert.equal(casual.casualMessages({ sceneChapter: true }).length, 0);
  }
  console.log("PASS Mukai latte note: no affinity required, known contact, chapters 3/5, once only");
}
