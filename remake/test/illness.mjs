// 確率の境界と、実際の日常進行（キャンセル・0体力・休養・初回半日・再発全日・大会当日）を確認。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { coldRisk, catchesCold } from "../js/core/illness.js";
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

const state = {}, played = [], saves = [], guards = [];
let rng = .99, route = [], decisions = [], shifts = 0;
const math = Object.create(Math); math.random = () => rng;
const context = vm.createContext({ Math: math, Set, Map, Promise, console, setTimeout: () => 0, clearTimeout() {}, document: { querySelector: () => null } });
const noop = () => {}, elem = () => ({ classList: { add: noop, remove: noop, contains: () => false }, remove: noop });
const db = { dialogues: {}, statusTexts: {} };
const values = {
  "hiyori.js": { visitHiyoriAtShop: async () => false, playHiyoriEvent: async () => false, meetHiyoriAtTonari: async () => false, playHiyoriHangout: async () => false },
  "util.js": { el: elem, sleep: async () => {}, yen: (n) => `${n}円`, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  "state.js": { state, save: () => saves.push({ day: state.day, slot: state.slot, cold: !!state.flags._cold_pending }),
    STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"], STAT_JA: { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" },
    markMet: (id) => state.met[id] = true, loadFromSlot: () => false, requestResumeOnBoot: noop },
  "ui.js": { layers: { fx: { append: noop }, modal: elem() }, dayCard: async () => {}, modal: async () => { guards.push(state.stamina); return decisions.shift() ?? true; },
    toast: noop, fadeBlack: async (mid) => mid?.(), dayTurn: async (mid) => { await mid?.(); }, bannersIdle: async () => {}, setBg: noop },
  "data.js": { DB: db, bgUrl: (ref) => ref }, "saves.js": { saveFlow: async () => {}, loadFlow: async () => {} },
  "audio.js": { SE: { select: noop, cancel: noop }, playBgm: noop },
  "engine.js": { play: async (id) => played.push(id) }, "glossary.js": { glossaryPanel: () => "" },
  "hud.js": { initHud: noop, showHud: noop, updateHud: noop, daysLeft: () => 14 - state.day, setPhoneBadge: noop, presentSleepRecovery: async () => {} },
  "map.js": { chooseSpot: async () => route.shift() || "rest", interruptMap: noop },
  "weather.js": { isRainy: () => false, weatherOf: () => "sun", RAIN_SPOT_TEXTS: {} },
  "tonari.js": { tonariMenu: async () => "baito", tonariCustomer: async () => {}, tonariPractice: async () => {}, doBaito: async () => { shifts++; stats.addStamina(-24); } },
  "shop.js": { openShop: async () => null, visitRin: async () => {}, ownsFlavor: () => true },
  "fortune.js": { doFortune: async () => {} },
  "phone.js": { deliverMorning: () => 0, pushNotice: noop, hasUnread: () => false, unreadCount: () => 0, mintoStoreInviteNeedingReply: () => null, venueInviteNeedingReply: () => null, actionInviteNeedingReply: () => null, openLime: async () => {}, limeCoach: noop, expireInvitations: noop },
  "status.js": { openStatus: async () => {} }, "reel.js": { onAction: noop, presentNow: async () => {}, installReel: noop },
  "romance.js": { maybeConfession: async () => false, playDate: async () => {} },
  "bonds.js": { afterStory: async () => {}, isFinaleEvent: () => false, playFinale: async () => {}, isFriendEvent: () => false, playFriendHangout: async () => {},
    questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false },
  "kafuka.js": { syncKafukaKnowledge: noop, maybeKafukaEncounter: async () => false, visitKafuka: async () => false, kafukaSpot: () => null },
};
const files = { "stats.js": "core", "rules.js": "core", "condition.js": "core", "illness.js": "core", "bus.js": "core", "story-knowledge.js": "core", "spots.js": "daily", "calendar.js": "daily", "invitations.js": "daily" };
const modules = new Map();
async function load(name) {
  if (modules.has(name)) return modules.get(name);
  const exports = values[name];
  const module = exports ? new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, val] of Object.entries(exports)) this.setExport(key, val); }, { context })
    : new vm.SourceTextModule(await fs.readFile(new URL(`../js/${files[name]}/${name}`, import.meta.url), "utf8"), { context });
  modules.set(name, module); await module.link((s) => load(s.split("/").at(-1))); return module;
}
const calendarModule = await load("calendar.js"); await calendarModule.evaluate();
const stats = modules.get("stats.js").namespace;
async function run({ stamina = 0, guts = 10, day = 13, roll = .99, sick = false, paths = ["tonari"], answers = [] } = {}) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, { chapter: 1, phase: "daily", day, slot: 1, stamina, money: 10000,
    stats: { technique: 10, sense: 10, guts, charm: 10, insight: 10 }, statXp: {}, story: {}, visitedDay: {}, met: {}, contacts: [], inbox: [], limeRead: [],
    flags: { [`_morning_${day}`]: true, _sick_once: sick, _overwork: 9 } });
  played.length = 0; saves.length = 0; guards.length = 0; shifts = 0;
  rng = roll; route = paths.slice(); decisions = answers.slice();
  await calendarModule.namespace.runDaily({ nightEvents: {} });
  return { played: [...played], saves: [...saves], guards: [...guards], stamina: state.stamina, day: state.day, shifts };
}
let result = await run(); assert.equal(result.shifts, 1); assert(!result.played.some((id) => id.includes("sick")), "0体力でも運が良ければ進める");
result = await run({ roll: 0 }); assert(result.played.includes("remake_sick_tournament")); assert.equal(result.day, 14); assert.equal(result.stamina, 0);
assert(result.saves.some((s) => s.cold), "抽選結果を行動直後に保存する");
result = await run({ stamina: 40, roll: 0, paths: ["tonari", "rest"], answers: [false] });
assert.equal(result.shifts, 0); assert.equal(result.stamina, 100); assert(!result.played.some((id) => id.includes("sick")), "警告を断っただけで発病しない");
result = await run({ stamina: 24, day: 12, roll: 0 }); assert(result.played.includes("remake_sick_half"));
assert(result.saves.some((s) => s.day === 13 && s.slot === 1), "初回は夜の行動を残す");
assert(!result.played.includes("remake_sick_tournament"), "休養で翌朝の風邪リスクを持ち越さない");
result = await run({ stamina: 24, day: 12, roll: 0, sick: true }); assert(result.played.includes("remake_sick_full"));
assert(!result.saves.some((s) => s.day === 13 && s.slot < 2), "再発は丸一日休む");
result = await run({ stamina: 60, guts: 90, roll: 0 }); assert.equal(result.guards.length, 0); assert(!result.played.some((id) => id.includes("sick")));
result = await run({ stamina: 58, guts: 90, roll: 0 }); assert.deepEqual(result.guards, [58]); assert(result.played.includes("remake_sick_tournament")); assert.equal(result.stamina, 40);
result = await run({ stamina: 24, day: 12, roll: 0, paths: ["tonari", "tonari", "rest"] });
assert(!result.played.includes("remake_sick_tournament"), "家で休むと、その晩の発病予約を解消する");
console.log("[illness] PASS: increasing risk, lucky zero, canceled action, actual save, rest, half/full sick days, capacity/discount boundary, tournament without a softlock");
