// LIMEの連絡の塩梅（2026-10-31 LM01〜LM06）。本番の phone.js・romance.js・casual-lime.js をVMで読み、
// 何日も朝を進めて、通知と返事の要る連絡が積み上がらないことを確かめる。
// node --experimental-vm-modules remake/test/lime_balance.mjs
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
db.lover = JSON.parse(await fs.readFile(new URL("data/lover.json", root), "utf8"));
db.casualLime = JSON.parse(await fs.readFile(new URL("data/casual_lime.json", root), "utf8"));
db.manifest = { limeMedia: JSON.parse(await fs.readFile(new URL("data/lime_media.json", root), "utf8")) };
let friendQueue = [];
const noop = () => {}, mods = new Map();
const values = {
  "chapter-clock.js": { chapterDay, chapterDaysLeft, relationshipElapsedDay },
  "hiyori-route.js": { hiyoriEventStatus: () => "disabled", hiyoriRoute: () => ({}), hiyoriFinaleReady: () => false },
  "util.js": { el, clamp, sleep: async () => {}, fitOneLine: () => {}, yen: (n) => `¥${n}` },
  "data.js": { DB: db, displayName: (id) => id, callName: (id) => id, faceIconUrl: () => null },
  "lime-icons.js": { customLimeIconUrl: () => null },
  "ui.js": { layers, toast: noop }, "state.js": { state, save: noop, STAT_JA, STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"] },
  "stats.js": { setStoryAffinityCap() {}, affinityGateWaiting: () => false, gainStat: noop, addMoney: noop, gainAffinity: (id, pts) => gains.push({ id, pts }),
    affinityLevel: (id) => (state.lovers || []).includes(id) ? 5 : state.levels?.[id] ?? 0, applyStats: noop, bond: {}, addStamina: noop, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66] },
  "audio.js": { SE: { phone: noop, phoneReceive: noop, phoneSend: noop, select: noop, click: noop, cancel: noop } },
  "engine.js": { isPlaying: () => false, hooks: {}, play: async () => ({ visited: [] }) },
  "rules.js": { MAX_MONEY, TOURNAMENT_DAY: 14 },
  "text.js": { formatHtml: (t) => t }, "spots.js": { hasContact: (id) => state.contacts.includes(id), spotById: (id) => ({ charId: id, closedOn: 6 }), isClosed: () => false },
  "bus.js": { emit: noop },
  "bonds.js": { bondInvites: () => [], friendMessages: () => friendQueue },
  "story-knowledge.js": { syncMintoKnowledge: noop },
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
  reset({ lovers: ["tsumugi", "minto", "rin"], loverSince: { tsumugi: 0, minto: 0, rin: 0 }, loveLevel: { tsumugi: 1, minto: 1, rin: 1 }, lastDate: {} });
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
  assert.deepEqual(Object.keys(days.morning).sort(), ["minto", "rin", "tsumugi"], "誰の朝のひとことも届く");
  assert(stamps >= 1, "スタンプの朝がある");
  console.log("[LM01-03] PASS lovers: one morning note per day, read-only, 3-day gap, shared 4-day invite budget, stamp mornings");
}

// LM01: 恋人の読むだけの連絡は、私的なやりとりとして既読で絆に積もる
{
  reset({ lovers: ["tsumugi"], loverSince: { tsumugi: 0 }, loveLevel: { tsumugi: 1 } });
  const src = await fs.readFile(new URL("js/daily/phone.js", root), "utf8");
  assert.match(src, /bond\.private = lover;\s*try \{\s*gainAffinity\(m\.sender, lover \? 3 : 2\);/);
  console.log("[LM01] PASS read-only lover notes deepen the bond on read");
}

// LM05: ♥3以上の知り合い（恋人・締めくくり前）から読むだけの雑談。全員で3日に1通・同じ相手は6日・一度ずつ。
// 物語の誘い（♥3の外出など）は同じ相手の枠を先に取るので、ここでは済ませた状態にして雑談だけを見る。
const storyDone = Object.fromEntries(allMessages.filter((m) => m.type === "invitation").map((m) => [`_invited_${m.id}`, true]));
{
  reset({ flags: { ...storyDone }, chapter: 2, day: 20, contacts: ["naru", "adam", "minto", "kumicho", "tsumugi"], met: { naru: true, adam: true, minto: true, kumicho: true, tsumugi: true },
    levels: { naru: 3, adam: 4, minto: 2, kumicho: 3, tsumugi: 4 }, lovers: ["tsumugi"], finales: { kumicho: { route: "friend", day: 18 } } });
  const got = [];
  for (let day = 20; day <= 60; day++) {
    state.day = day;
    const msgs = phone.morningMessages({ fixedNight: () => false }).filter((m) => m.casual);
    assert(msgs.length <= 1, `DAY${day}: 知り合いの雑談は朝に1通まで`);
    for (const m of msgs) {
      assert(!m.replies?.length && m.type === "chat", `${m.id}: 読むだけ`);
      got.push([day, m.sender, m.id]);
    }
    deliver(msgs);
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
console.log("[lime balance] PASS");
