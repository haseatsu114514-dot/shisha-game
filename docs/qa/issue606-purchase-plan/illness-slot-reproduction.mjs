// 確率の境界と、実際の日常進行（キャンセル・0体力・休養・初回半日・再発全日・大会当日）を確認。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { coldRisk, catchesCold } from "../../../remake/js/core/illness.js";
const risks = [0.25, 0.2, 0.1, 0.01, 0].map(coldRisk);
assert(risks.every((value, i) => !i || value > risks[i - 1]));
assert.equal(risks[0], .04); assert(Math.abs(risks.at(-1) - .85) < 1e-9);
for (const ratio of [.250001, .5, 1]) {
  assert.equal(coldRisk(ratio), 0);
  assert.equal(catchesCold(ratio, () => { throw Error("Healthy action rolled illness"); }), false);
}
for (const ratio of [.25, .1, 0]) {
  assert(catchesCold(ratio, () => 0)); assert(!catchesCold(ratio, () => .99));
}

const state = {}, played = [], saves = [], guards = [], homecomingChecks = [];
let rng = .99, route = [], decisions = [], shifts = 0;
const math = Object.create(Math); math.random = () => rng;
const context = vm.createContext({ Math: math, Set, Map, Promise, console, setTimeout: () => 0, clearTimeout() {}, document: { querySelector: () => null } });
const noop = () => {}, elem = () => ({ classList: { add: noop, remove: noop, contains: () => false }, remove: noop });
const db = { dialogues: {}, statusTexts: {} };
const values = {
  "hiyori.js": { visitHiyoriAtShop: async () => false, playHiyoriEvent: async () => false, meetHiyoriAtTonari: async () => false, playHiyoriHangout: async () => false },
  "util.js": { el: elem, sleep: async () => {}, yen: (n) => `${n}円`, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  "state.js": { state, save: () => saves.push({ day: state.day, slot: state.slot, cold: !!state.flags._cold_pending,
    stamina: state.stamina, rest: state.restDay ? { ...state.restDay } : null,
    queue: JSON.parse(JSON.stringify(state.deferredNightEvents || [])), appointment: state.pendingInvite ? { ...state.pendingInvite } : null }),
    STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"], STAT_JA: { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" },
    markMet: (id) => state.met[id] = true, loadFromSlot: () => false, requestResumeOnBoot: noop },
  "ui.js": { layers: { fx: { append: noop }, modal: elem() }, dayCard: async () => {}, modal: async () => { guards.push(state.stamina); return decisions.length ? decisions.shift() : true; },
    toast: noop, fadeBlack: async (mid) => mid?.(), dayTurn: async (mid) => { await mid?.(); }, bannersIdle: async () => {}, setBg: noop, refreshWeather: noop },
  "transitions.js": { refreshPlaceCue: noop },
  "data.js": { DB: db, bgUrl: (ref) => ref, displayName: id => id }, "saves.js": { saveFlow: async () => {}, loadFlow: async () => {} },
  "audio.js": { SE: { select: noop, cancel: noop }, playBgm: noop },
  "engine.js": { play: async (id) => played.push(id) }, "glossary.js": { glossaryPanel: () => "" },
  "hud.js": { initHud: noop, showHud: noop, updateHud: noop, daysLeft: () => 14 - state.day, setPhoneBadge: noop, presentSleepRecovery: async () => {} },
  "map.js": { chooseSpot: async () => route.shift() || "rest", interruptMap: noop, isChoosingDestination: () => false },
  "weather.js": { isRainy: () => false, weatherOf: () => "sun", RAIN_SPOT_TEXTS: {} },
  "tonari.js": { tonariMenu: async () => "baito", tonariCustomer: async () => {}, tonariPractice: async () => {}, doBaito: async () => { shifts++; stats.addStamina(-32); } },
  "shop.js": { openShop: async () => null, visitRin: async () => {}, ownsFlavor: () => true },
  "fortune.js": { doFortune: async () => {} },
  "phone.js": { deliverMorning: () => 0, pushNotice: noop, hasUnread: () => false, unreadCount: () => 0,
    actionInviteNeedingReply: () => null, openLime: async () => {}, limeCoach: noop, expireInvitations: noop,
    rescheduleInvitation: noop, completeInvitation: noop },
  "status.js": { openStatus: async () => {} }, "reel.js": { onAction: noop, presentNow: async () => {}, installReel: noop },
  "romance.js": { maybeConfession: async () => false, playDate: async () => {} },
  "samechan-date.js": { samechanDateReady: () => false, playSamechanDate: async () => ({ done: false, spent: 0 }) },
  "bonds.js": { afterStory: async () => {}, isFinaleEvent: () => false, playFinale: async () => {}, isFriendEvent: () => false, playFriendHangout: async () => {},
    questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false },
  "samechan.js": { syncSamechanKnowledge: noop, maybeSamechanEncounter: async opts => { homecomingChecks.push({ day: state.day, ...opts }); return false; }, visitSamechan: async () => false, samechanSpot: () => null },
};
const files = { "spot-hours.js": "daily", "axe-bar-data.js": "daily", "chapter-clock.js": "core", "stats.js": "core", "rules.js": "core", "condition.js": "core", "illness.js": "core", "bus.js": "core", "story-knowledge.js": "core", "trpg.js": "daily", "spots.js": "daily", "spot-encounters.js": "daily", "calendar.js": "daily", "invitations.js": "daily", "night-events.js": "daily" };
const modules = new Map(), pending = new Map();
function load(name) {
  if (!pending.has(name)) pending.set(name, (async () => {
    const exports = values[name];
    const module = exports ? new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, val] of Object.entries(exports)) this.setExport(key, val); }, { context })
      : new vm.SourceTextModule(await fs.readFile(new URL(`../../../remake/js/${files[name]}/${name}`, import.meta.url), "utf8"), { context });
    modules.set(name, module);
    return module;
  })());
  return pending.get(name);
}
const calendarModule = await load("calendar.js");
// Nodeに依存グラフ全体をリンクさせる。共有するrules/stateを途中で重複リンクしない。
await calendarModule.link((s) => load(s.split("/").at(-1)));
await calendarModule.evaluate();
const stats = modules.get("stats.js").namespace;
async function run({ stamina = 0, guts = 10, day = 13, slot = 1, roll = .99, sick = false, paths = ["tonari"], answers = [], events = {}, flags = {}, appointment = null, queue = [] } = {}) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, { chapter: 1, phase: "daily", day, slot, stamina, money: 10000, pendingInvite: appointment, deferredNightEvents: JSON.parse(JSON.stringify(queue)),
    stats: { technique: 10, sense: 10, guts, charm: 10, insight: 10 }, statXp: {}, story: {}, visitedDay: {}, met: {}, contacts: [], inbox: [], limeRead: [],
    flags: { [`_morning_${day}`]: true, _sick_once: sick, _overwork: 9, ...flags } });
  played.length = 0; saves.length = 0; guards.length = 0; homecomingChecks.length = 0; shifts = 0;
  rng = roll; route = paths.slice(); decisions = answers.slice();
  await calendarModule.namespace.runDaily({ nightEvents: events });
  return { played: [...played], saves: [...saves], guards: [...guards], stamina: state.stamina, day: state.day, shifts };
}

const evidence = [];
for (const roll of [.99, 0]) {
 await run({ stamina: 56, guts: 16, day: 11, slot: 1, roll });
 evidence.push({ roll, fixture: "DAY11 night: 56 stamina before baito+pull drill, aggregate cost32; real calendar/stats/illness modules; mocked UI/work", night: saves.filter(s=>s.day===11&&s.slot===2), day12: saves.filter(s=>s.day===12).map(s=>({slot:s.slot,stamina:s.stamina,cold:s.cold})), illness:played.filter(x=>typeof x==="string"&&x.includes("sick")) });
}
console.log(JSON.stringify(evidence,null,2));

assert(evidence[0].day12.some(s => s.slot === 0));
assert(!evidence[1].day12.some(s => s.slot === 0));
assert.equal(evidence[1].day12[0].slot, 1);
assert.equal(evidence[1].day12[0].stamina, 60);
