// 確率の境界と、実際の日常進行（キャンセル・0体力・休養・初回半日・再発全日・大会当日）を確認。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { coldRisk, catchesCold, fitActive, FIT_DAYS, FIT_RISK } from "../js/core/illness.js";
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
// チョコザップの数日は同じ無理でも風邪をひきにくい。健康なときは抽選しない
for (const ratio of [.25, .1, 0]) assert(Math.abs(coldRisk(ratio, { fit: true }) - coldRisk(ratio) * FIT_RISK) < 1e-12);
assert.equal(coldRisk(.5, { fit: true }), 0);
const fitSave = (day, chapter = 1) => ({ chapter, day, flags: { _fit_since: { chapter: 1, day: 3 } } });
assert(fitActive(fitSave(3)) && fitActive(fitSave(3 + FIT_DAYS - 1)));
assert(!fitActive(fitSave(3 + FIT_DAYS)) && !fitActive(fitSave(2)) && !fitActive(fitSave(4, 2)) && !fitActive({ chapter: 1, day: 3, flags: {} }));

const state = {}, played = [], saves = [], guards = [], homecomingChecks = [];
let rng = .99, route = [], decisions = [], shifts = 0;
const math = Object.create(Math); math.random = () => rng;
const context = vm.createContext({ Math: math, Set, Map, Promise, console, setTimeout: () => 0, clearTimeout() {}, document: { querySelector: () => null } });
const noop = () => {}, elem = () => ({ classList: { add: noop, remove: noop, contains: () => false }, remove: noop });
const db = { dialogues: {}, statusTexts: {}, lime: [] };
const values = {
  "growth-mode.js": { growthEnabled: () => false, GROWTH_BOARD: false, PREVIEW_KEY: "suien_growth_preview" },
  "growth-effects.js": { growthPerks: () => null },
  "flavor-mastery.js": { masteryHooks: { multiplier: () => 1 } },
  "city-guests.js": { cityGuestAtShop: () => null, visitCityGuestAtShop: async () => false },
  "hiyori.js": { hiyoriShopEncounterDue: () => false, visitHiyoriAtShop: async () => false, hiyoriShopLocation: () => null, playHiyoriEvent: async () => false, meetHiyoriAtTonari: async () => false, playHiyoriHangout: async () => false },
  "util.js": { el: elem, sleep: async () => {}, yen: (n) => `${n}円`, clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  "state.js": { state, save: () => saves.push({ day: state.day, slot: state.slot, cold: !!state.flags._cold_pending,
    visitedDay: { ...state.visitedDay }, stamina: state.stamina, rest: state.restDay ? { ...state.restDay } : null,
    queue: JSON.parse(JSON.stringify(state.deferredNightEvents || [])), appointment: state.pendingInvite ? { ...state.pendingInvite } : null }),
    STAT_KEYS: ["technique", "sense", "guts", "charm", "insight"], STAT_JA: { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" },
    markMet: (id) => state.met[id] = true, loadFromSlot: () => false, requestResumeOnBoot: noop },
  "ui.js": { withScenePreparation: task => task, imageReady: async () => false, layers: { fx: { append: noop }, modal: elem() }, dropRetired: noop, dayCard: async () => {}, modal: async () => { guards.push(state.stamina); return decisions.length ? decisions.shift() : true; },
    toast: noop, fadeBlack: async (mid) => mid?.(), dayTurn: async (mid) => { await mid?.(); }, bannersIdle: async () => {}, setBg: noop, refreshWeather: noop },
  "transitions.js": { refreshPlaceCue: noop },
  "data.js": { sceneBg: () => ({}), DB: db, loadCinemaDialogue: async () => db, bgUrl: (ref) => ref, displayName: id => id }, "saves.js": { saveFlow: async () => {}, loadFlow: async () => {} },
  "audio.js": { SE: { select: noop, cancel: noop }, playBgm: noop },
  "engine.js": { isPlaying: () => false, play: async (id) => played.push(id) }, "glossary.js": { glossaryPanel: () => "" },
  "hud.js": { initHud: noop, showHud: noop, updateHud: noop, daysLeft: () => 14 - state.day, setPhoneBadge: noop, presentSleepRecovery: async () => {} },
  "map.js": { chooseSpot: async () => route.shift() || "rest", interruptMap: noop, isChoosingDestination: () => false },
  "weather.js": { isRainy: () => false, weatherOf: () => "sun", RAIN_SPOT_TEXTS: {} },
  "tonari.js": { tonariMenu: async () => "baito", tonariCustomer: async () => {}, tonariPractice: async () => {}, doBaito: async () => { shifts++; stats.addStamina(-24); } },
  // 家シーシャ（#638）: 寝る前の一服はこのテストの対象外（home_shisha.mjs で確かめる）
  "home-shisha.js": { runHomeShisha: async () => false },
  "home-rig.js": { showSumiRigAtHome: async () => false },
  "shop.js": { openShop: async () => null, visitRin: async () => {}, ownsFlavor: () => true },
  "fortune.js": { doFortune: async () => {} },
  "phone.js": { deliverMorning: () => 0, pushNotice: noop, hasUnread: () => false, unreadCount: () => 0,
    actionInviteNeedingReply: () => null, openLime: async () => {}, limeCoach: noop, expireInvitations: noop,
    rescheduleInvitation: noop, completeInvitation: noop, invitationReadBeforeMeeting: () => null },
  "status.js": { openStatus: async () => {} }, "reel.js": { onAction: noop, presentNow: async () => {}, installReel: noop, changeSetting: () => false },
  "romance.js": { maybeConfession: async () => false, playDate: async () => {} },
  "samechan-date.js": { samechanDateReady: () => false, playSamechanDate: async () => ({ done: false, spent: 0 }) },
  "bonds.js": { afterStory: async () => {}, isFinaleEvent: () => false, playFinale: async () => {}, isFriendEvent: () => false, playFriendHangout: async () => {},
    questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false },
  "samechan.js": { syncSamechanKnowledge: noop, maybeSamechanEncounter: async opts => { homecomingChecks.push({ day: state.day, ...opts }); return false; }, visitSamechan: async () => false, samechanSpot: () => null, samechanVisitDialogue: () => null },
};
const files = { "stat-step-tables.js": "core", "cinema.js": "daily", "cinema-discovery.js": "core", "affinity-stages.js": "core", "fortune-schedule.js": "daily", "travel-budget.js": "core", "city-locations.js": "core", "trpg-discovery.js": "core", "ryuji-visit.js": "core", "tsumugi-schedule.js": "daily", "axe-bar-discovery.js": "core", "cafe-ideas.js": "daily", "spot-hours.js": "daily", "axe-bar-data.js": "daily", "chapter-clock.js": "core", "stats.js": "core", "growth.js": "core", "growth-board-data.js": "core", "rules.js": "core", "condition.js": "core", "illness.js": "core", "bus.js": "core", "story-knowledge.js": "core", "trpg.js": "daily", "spots.js": "daily", "spot-encounters.js": "daily", "calendar.js": "daily", "invitations.js": "daily", "night-events.js": "daily" };

const modules = new Map(), pending = new Map();
function load(name) {
  if (!pending.has(name)) pending.set(name, (async () => {
    const exports = values[name];
    const module = exports ? new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, val] of Object.entries(exports)) this.setExport(key, val); }, { context })
      : new vm.SourceTextModule(await fs.readFile(new URL(`../js/${files[name]}/${name}`, import.meta.url), "utf8"), { context });
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
result = await run({ stamina: 60, guts: 100, roll: 0 }); assert.equal(result.guards.length, 0); assert(!result.played.some((id) => id.includes("sick")));
result = await run({ stamina: 58, guts: 100, roll: 0 }); assert.deepEqual(result.guards, [58]); assert(result.played.includes("remake_sick_tournament")); assert.equal(result.stamina, 40);
result = await run({ stamina: 24, day: 12, roll: 0, paths: ["tonari", "tonari", "rest"] });
assert(!result.played.includes("remake_sick_tournament"), "家で休むと、その晩の発病予約を解消する");
console.log("[illness] PASS: increasing risk, lucky zero, canceled action, actual save, rest, half/full sick days, capacity/discount boundary, tournament without a softlock");

// #783: 廃止前の直接ルートが来ても家で休む。在庫・記録の家練習処理は呼ばない。
result = await run({ stamina: 10, day: 12, slot: 0, paths: ["rest:practice"], answers: ["full"] });
assert(result.saves.some(s => s.day === 12 && s.slot === 2 && s.rest?.fullDay && s.stamina === 100));
assert.equal(state.visitedDay.home_practice, undefined);
assert(result.saves.some(s => s.day === 12 && s.visitedDay.rest === 12));

// #367: 能動休養は過去へ戻らず、既存の1枠回復を残り時間へ適用する。
result = await run({ stamina: 10, day: 12, slot: 0, paths: ["rest"], answers: ["full"] });
let rested = result.saves.find(s => s.day === 12 && s.slot === 2 && s.rest?.fullDay);
assert(rested); assert.equal(rested.stamina, 100); assert(!rested.cold);
result = await run({ stamina: 10, paths: ["rest"], answers: ["full"] });
rested = result.saves.find(s => s.day === 13 && s.rest?.fullDay);
assert.equal(rested.slot, 2); assert.equal(rested.stamina, 65);
result = await run({ stamina: 10, slot: 0, paths: ["rest", "rest"], answers: ["half"] });
assert(result.saves.some(s => s.day === 13 && s.slot === 1 && s.stamina === 65 && !s.rest?.fullDay));
result = await run({ stamina: 10, slot: 0, paths: ["rest", "rest"], answers: [null, "full"] });
assert(result.saves.some(s => s.day === 13 && s.slot === 0 && s.stamina === 10));
result = await run({ stamina: 60, paths: ["rest"] }); assert.equal(result.guards.length, 0, "健康時は従来の1行動休養");

const executions = [];
function event(id, fields = {}) {
  return { id, doneKeys: [id], schedule: "regular", ...fields, done: () => !!state.flags[id],
    run: async () => { executions.push({ id, day: state.day, health: stats.currentCondition().health, stamina: state.stamina }); state.flags[id] = true; } };
}
const nights = modules.get("night-events.js").namespace;
executions.length = 0;
await run({ stamina: 10, day: 2, slot: 0, paths: ["rest"], answers: ["full"], events: {
  2: event("regular_2"), 3: event("practice_3", { schedule: "preparation", deadline: 6 }) } });
assert.deepEqual(executions.map(({ id, day }) => ({ id, day })), [{ id: "regular_2", day: 3 }, { id: "practice_3", day: 4 }]);
assert.equal(state.deferredNightEvents.length, 0);

// 自動終日発病の夜も通常予定を消さず、回復後の最初の夜に実行する。
executions.length = 0;
await run({ stamina: 24, day: 9, roll: 0, sick: true, events: { 10: event("regular_10") } });
assert(played.includes("remake_sick_full"));
assert.equal(executions[0].day, 11); assert.equal(executions.length, 1);

// 休養しても日時固定の重要イベントは当日参加、発病時の既存red補正を維持。
executions.length = 0;
await run({ stamina: 24, day: 12, roll: 0, sick: true, events: { 13: event("fixed_13", { schedule: "fixed" }) } });
assert.deepEqual(executions, [{ id: "fixed_13", day: 13, health: "red", stamina: 80 }]);
assert.equal(stats.currentCondition().health, "green", "翌日の通常回復で発病日の補正は解除");

// 既に受けた夜の約束は1枠を確保し、回復に二重利用せず、実際に会う。
result = await run({ stamina: 10, day: 12, slot: 0, paths: ["rest"], answers: ["full"],
  appointment: { sender: "sumi", event: "__sumi_baito__", day: 12, slot: 1 } });
rested = result.saves.find(s => s.day === 12 && s.rest?.fullDay);
assert.equal(rested.stamina, 65); assert.equal(result.shifts, 1); assert.equal(state.pendingInvite, null);
executions.length = 0;
await run({ stamina: 60, day: 4, events: { 2: event("regular_2") },
  queue: [{ id: "regular_2", chapter: 1, originalDay: 2, deferredOn: 3, reason: "rest" }],
  appointment: { sender: "sumi", event: "__sumi_baito__", day: 4, slot: 1 } });
assert.equal(executions[0].day, 5, "既に会った夜にも通常の延期イベントを重ねない");

// 締切前の準備は休養を続けても救済。通常予定は固定日に重ねず、大会後にも順序を保持。
executions.length = 0;
await run({ stamina: 10, day: 12, slot: 0, paths: ["rest"], answers: ["full"],
  queue: [2, 3, 5, 7, 10].map(day => ({ id: `${[3, 7].includes(day) ? "practice" : "regular"}_${day}`,
    chapter: 1, originalDay: day, deferredOn: 11, reason: "rest" })), events: {
  2: event("regular_2"), 3: event("practice_3", { schedule: "preparation", deadline: 6 }),
  5: event("regular_5"), 7: event("practice_7", { schedule: "preparation", deadline: 12, prerequisites: ["practice_3"] }),
  10: event("regular_10", { prerequisites: ["regular_2"] }), 13: event("fixed_13", { schedule: "fixed" }) } });
assert.deepEqual(executions.map(x => x.id), ["practice_3", "practice_7", "fixed_13"]);
assert.deepEqual(executions.map(x => x.day), [12, 12, 13]);
assert.equal(nights.nightPlan({}).length, 0, "通常イベントを大会の前へ割り込ませない");
const definitions = { 2: event("regular_2"), 5: event("regular_5"), 10: event("regular_10", { prerequisites: ["regular_2"] }) };
state.phase = "aftermath";
await nights.finishDeferredNights(definitions);
assert.deepEqual(executions.slice(3).map(x => x.id), ["regular_2", "regular_5", "regular_10"]);
assert.equal(state.deferredNightEvents.length, 0);
const beforeRepeat = JSON.stringify(state); await nights.finishDeferredNights(definitions);
assert.equal(JSON.stringify(state), beforeRepeat); assert.equal(executions.length, 6);

// 他章・既読・失敗を予約成功に見せない。例外時は未読キューを残す。
state.deferredNightEvents = [{ id: "other", chapter: 2, originalDay: 2, deferredOn: 2 }];
nights.syncNightQueue(definitions); assert.equal(state.deferredNightEvents.length, 1);
state.day = 3; state.phase = "daily"; state.restDay = null;
const failed = { 3: { id: "failed", schedule: "regular", done: () => false, run: async () => { throw Error("Interrupted scene"); } } };
nights.syncNightQueue(failed);
await assert.rejects(nights.runNightPlan(failed), /Interrupted scene/);
assert(state.deferredNightEvents.some(entry => entry.id === "failed"));
assert(!state.flags.failed);
// 実読了直後にロードしても同じ夜の空き枠は復活せず、後続は翌夜に送る。
state.day = 4; delete state.flags._night_event_day; executions.length = 0;
const budgetEvents = { 2: event("budget_a"), 3: event("budget_b") };
state.deferredNightEvents = [2, 3].map((day, i) => ({ id: `budget_${i ? "b" : "a"}`, chapter: 1,
  originalDay: day, deferredOn: 3, reason: "rest" }));
await nights.runNightPlan(budgetEvents);
const savedBudget = JSON.parse(JSON.stringify(state)); Object.assign(state, savedBudget);
assert.equal(await nights.runNightPlan(budgetEvents), 0);
assert.equal(executions.length, 1); assert.equal(state.deferredNightEvents.length, 1);
state.day = 5; await nights.runNightPlan(budgetEvents);
assert.deepEqual(executions.map(x => x.day), [4, 5]); assert.equal(state.deferredNightEvents.length, 0);
await run({ stamina: 60, day: 4, slot: 2, flags: { _night_event_day: "1:4" }, events: { 3: event("homecoming_pending") },
  queue: [{ id: "homecoming_pending", chapter: 1, originalDay: 3, deferredOn: 3, reason: "rest" }] });
assert(homecomingChecks.find(check => check.day === 4)?.hasNightEvent,
  "読了直後のロードでも夜の予定が無かったことにして追加遭遇を発火しない");
console.log("[full-day rest] PASS: remaining slots/recovery, half/cancel/healthy, automatic illness deferral, fixed sick attendance, accepted appointment, preparation deadlines, post-tournament order, no duplicates, other chapters and interrupted scenes");
