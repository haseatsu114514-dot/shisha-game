// Actual public callers with controlled rendering/VN/stats ports; no browser acceptance.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = new URL("../js/", import.meta.url);
const dataRoot = new URL("../../data/dialogue/", import.meta.url);
const actual = new Set(["core/state.js", "core/rules.js", "core/bus.js", "core/chapter-clock.js", "core/fortune-discovery.js", "core/fortune-effects.js",
  "daily/fortune-rumor.js", "daily/weather.js", "daily/tonari.js", "daily/spots.js", "daily/fortune.js", "daily/spot-access.js",
  "daily/spot-people.js", "daily/map-reveals.js", "daily/tsumugi-schedule.js", "chapters/tsumugi-story.js", "daily/calendar.js"]);
const DB = { dialogues: {}, characters: { naru: { name: "なる" } }, fortuneTrivia: {}, flavors: [], recipes: [], baito: [] };
for (const name of ["ch1_events", "ch1_tsumugi", "remake_ch1"]) for (const d of JSON.parse(fs.readFileSync(new URL(`${name}.json`, dataRoot))).dialogues) DB.dialogues[d.dialogue_id] = d;
const trace = [], storage = new Map(); let core, mode = "normal", release, writes = 0, syncCalls = 0;
const ctx = vm.createContext({ console, Date, Math, setTimeout, clearTimeout,
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { writes++; storage.set(k, v); } },
  sessionStorage: { getItem: () => null, setItem() {} }, window: {}, document: {}, location: { reload() { throw Error("unexpected reload"); } } });
const noop = () => {}, empty = () => [], el = () => ({ classList: { contains: () => false }, append() {}, remove() {}, replaceChildren() {} });
const mocks = {
  DB, el, yen: String, clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)), bgUrl: x => x, displayName: x => x,
  layers: { modal: el(), fx: el() }, SE: new Proxy({}, { get: () => noop }), DRILLS: {}, AXE_BAR: null,
  setBackgroundWeatherSource: noop, setBg: async () => {}, showScreen: noop,
  addStamina: n => { core.state.stamina += n; }, addMoney: n => { core.state.money += n; },
  gainAffinity: noop, earnStat: noop, affinityLevel: () => 0, currentCondition: () => ({ bonusRate: 1, shiftBonus: 0 }),
  questionVisitDue: () => false, finaleAtVisit: () => false, spotFollowupDue: () => null, maybeRecruitTrpgMember: async () => {},
  openingStatus: (s, value) => s.kind === "fortune" && value.slot !== 0 ? { ok: false, tag: "昼のみ営業" } : { ok: true },
  trpgSpot: () => null, samechanSpot: () => null, cityGuestAtShop: () => null, hiyoriFirstMeetingReady: () => false,
  nightPlan: empty, restingToday: () => false, unreadCount: () => 0,
  chooseSpot: async () => { throw new Error("map boundary"); },
  dialogueSequence: fn => fn(),
  play: async id => {
    const key = typeof id === "string" ? id : id.dialogue_id; trace.push(key);
    if (key === "ch1_tsumugi_fortune_rumor") {
      if (mode === "cancel") return { cancelled: true };
      if (mode === "throw") throw Error("controlled VN failure");
      if (mode === "deferred") return new Promise(r => { release = r; });
    }
    if (key === "venue_tonari_night" && mode === "greeting-cancel") return { cancelled: true };
    if (key === "remake_fortune_offer") core.state.flags._fortune_go = true;
    if (key === "remake_fortune_pick_live") core.state.flags._fortune_pick_naru = true;
    return { id: key };
  },
};
const modules = new Map(), synthetic = new Map();
function moduleOf(p) { if (!modules.has(p)) modules.set(p, new vm.SourceTextModule(fs.readFileSync(new URL(p, root), "utf8"), { context: ctx, identifier: p })); return modules.get(p); }
async function link(spec, ref) {
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier), spec));
  if (actual.has(p)) return moduleOf(p);
  const k = `${ref.identifier}->${p}`; if (synthetic.has(k)) return synthetic.get(k);
  const source = fs.readFileSync(new URL(ref.identifier, root), "utf8"), names = [];
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) if (m[2] === spec) names.push(...m[1].split(",").map(x => x.trim().split(/\s+as\s+/)[0]));
  assert(names.length, `unhandled import ${k}`);
  const sm = new vm.SyntheticModule([...new Set(names)], function () { for (const name of new Set(names)) this.setExport(name, mocks[name] ?? noop); }, { context: ctx }); synthetic.set(k, sm); return sm;
}
async function load(p) { const m = moduleOf(p); if (m.status === "unlinked") await m.link(link); if (m.status === "linked") await m.evaluate(); return m.namespace; }
core = await load("core/state.js"); const discovery = await load("core/fortune-discovery.js"), weather = await load("daily/weather.js");
const rumor = await load("daily/fortune-rumor.js"), tonari = await load("daily/tonari.js"), spots = await load("daily/spots.js");
const fortune = await load("daily/fortune.js"), access = await load("daily/spot-access.js"), people = await load("daily/spot-people.js");
const reveal = await load("daily/map-reveals.js"), fixed = await load("chapters/tsumugi-story.js"), calendar = await load("daily/calendar.js");
const key = discovery.FORTUNE_RUMOR, results = [];
const fresh = (day = 2, slot = 1) => { trace.length = 0; mode = "normal"; release = null; core.newGame(); Object.assign(core.state, { phase: "daily", day, slot, weatherSeed: 4 }); core.state.flags._tsumugi_contest_research = true; return core.state; };
async function check(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
const offer = () => spots.spotById("fortune");

await check("forced research does not grant rumor; first autonomous visit does", async () => {
  fresh(1, 0); delete core.state.flags._tsumugi_contest_research;
  await fixed.playTsumugiStory(1); assert.equal(core.state.flags[key], undefined);
  core.state.day = 2; core.state.slot = 1; const saved = writes;
  assert.equal(await tonari.tonariCustomer(), true); assert.equal(core.state.flags[key], true);
  assert(trace.indexOf("ch1_tsumugi_first") < trace.indexOf(rumor.FORTUNE_RUMOR_SCENE));
  assert.equal(writes, saved, "rumor must not save a partially committed paid visit");
  await tonari.tonariCustomer(); assert.equal(trace.filter(x => x === rumor.FORTUNE_RUMOR_SCENE).length, 1);
});
await check("cancel, missing dialogue, exception and greeting cancellation keep rumor unread", async () => {
  for (const kind of ["cancel", "throw", "missing", "greeting-cancel"]) {
    fresh(); mode = kind; const d = DB.dialogues[rumor.FORTUNE_RUMOR_SCENE];
    if (kind === "missing") delete DB.dialogues[rumor.FORTUNE_RUMOR_SCENE];
    try { if (kind === "throw") await assert.rejects(tonari.tonariCustomer(), /controlled VN failure/); else assert.equal(await tonari.tonariCustomer(), false); }
    finally { DB.dialogues[rumor.FORTUNE_RUMOR_SCENE] = d; }
    assert.equal(core.state.flags[key], undefined); assert.equal(core.state.flags._fortune_schedule, undefined);
    if (kind === "greeting-cancel") assert(!trace.includes(rumor.FORTUNE_RUMOR_SCENE));
  }
});
await check("LOAD owner swap and parallel callbacks never mark another owner or replay concurrently", async () => {
  const old = fresh(); mode = "deferred"; const task = rumor.hearFortuneRumor(); const same = rumor.hearFortuneRumor();
  assert.equal(trace.filter(x => x === rumor.FORTUNE_RUMOR_SCENE).length, 1);
  core.newGame(); const next = core.state; release({ id: rumor.FORTUNE_RUMOR_SCENE });
  assert.equal(await task, false); assert.equal(await same, false); assert.equal(old.flags[key], undefined); assert.equal(next.flags[key], undefined);
  fresh(); mode = "deferred"; const a = rumor.hearFortuneRumor(), b = rumor.hearFortuneRumor(); release({ id: rumor.FORTUNE_RUMOR_SCENE });
  assert.equal(await a, true); assert.equal(await b, true); assert.equal(trace.length, 1);
});
await check("legacy records do not fabricate rumor; actual next visit can read it", async () => {
  const s = fresh(); Object.assign(s.flags, { _fortune_met: true }); s.met.uranaishi = true; s.met.tsumugi = true; s.fortuneDay = 1; s.story.tsumugi = 2;
  const old = JSON.stringify({ met: s.met, used: s.fortuneDay });
  discovery.syncFortuneSchedule(s, () => false); assert.equal(s.flags[key], undefined); assert.equal(spots.isUnlocked(offer()), false);
  await tonari.tonariCustomer(); assert.equal(s.flags[key], true); assert.equal(JSON.stringify({ met: s.met, used: s.fortuneDay }), old);
});
await check("unheard hides pin/people/availability and blocks direct entry without mutation", async () => {
  const s = fresh(3, 0); const before = JSON.stringify(s);
  assert.equal(spots.isUnlocked(offer()), false); assert.equal(access.spotVisible(offer()), false);
  assert.equal(access.spotAvailability(offer()).ok, false); assert.equal(people.spotPeople(offer()).length, 0);
  assert.equal(fortune.fortuneToday(), false); assert.equal(await fortune.doFortune(), false); assert.equal(JSON.stringify(s), before);
});
await check("consecutive rain rolls forward; reads do not move dates; regular overlap is one date", () => {
  const s = fresh(3, 0); s.flags[key] = true;
  discovery.syncFortuneSchedule(s, d => d === 3 || d === 4 || d === 5); assert.equal(s.flags._fortune_schedule.postponed, 4);
  for (const day of [4, 5]) { s.day = day; discovery.syncFortuneSchedule(s, () => true); assert.equal(s.flags._fortune_schedule.postponed, day + 1); }
  s.day = 6; discovery.syncFortuneSchedule(s, () => false); assert.equal(s.flags._fortune_schedule.openDay, 6); assert.equal(s.flags._fortune_schedule.postponed, null);
  const stable = JSON.stringify(s); for (let i = 0; i < 5; i++) discovery.fortunePresent(s, false);
  assert.equal(JSON.stringify(s), stable); assert.equal(discovery.syncFortuneSchedule(s, () => true), false, "same day is not rescheduled by redraw");
  s.day = 7; discovery.syncFortuneSchedule(s, () => false); assert.equal(discovery.fortunePresent(s, false), false);
});
await check("original cycle, skipped-day rain replay, chapters and no retroactive backlog", () => {
  const s = fresh(2, 0); s.flags[key] = true; discovery.syncFortuneSchedule(s, () => false);
  for (let day = 3; day <= 13; day++) { s.day = day; discovery.syncFortuneSchedule(s, () => false); assert.equal(discovery.fortunePresent(s, false), [3, 6].includes(day % 7)); }
  const late = fresh(5, 0); late.flags[key] = true; discovery.syncFortuneSchedule(late, () => true); assert.equal(late.flags._fortune_schedule.postponed, null);
  const skipped = fresh(3, 0); skipped.flags[key] = true; discovery.syncFortuneSchedule(skipped, () => true); skipped.day = 5; discovery.syncFortuneSchedule(skipped, d => d === 4);
  assert.equal(discovery.fortunePresent(skipped, false), true); skipped.chapter = 3; assert.equal(discovery.fortunePresent(skipped, false), false);
});
await check("real SAVE/LOAD retains rumor/postponement without deleting old fortune", () => {
  const s = fresh(3, 0); s.flags[key] = true; s.flags._fortune_met = true; s.fortuneDay = 1; s.fortune = { char: "naru", mult: 1.5 };
  discovery.syncFortuneSchedule(s, () => true); core.saveToSlot("suien_remake_slot1"); core.newGame(); core.loadFromSlot("suien_remake_slot1");
  assert.equal(core.state.flags[key], true); assert.equal(core.state.flags._fortune_schedule.postponed, 4); assert.equal(core.state.fortuneDay, 1); assert.equal(core.state.fortune.char, "naru");
  core.state.day = 4; discovery.syncFortuneSchedule(core.state, () => false); assert.equal(discovery.fortunePresent(core.state, false), true);
});
await check("daylight, fee, once/day and live result application retained", async () => {
  const s = fresh(3, 0); s.flags[key] = true; while (weather.isRainy()) s.weatherSeed++;
  discovery.syncFortuneSchedule(s, weather.isRainy); s.met.naru = true; s.affinity.naru = 5;
  s.slot = 1; assert.equal(access.spotAvailability(offer()).tag, "昼のみ営業"); assert.equal(await fortune.doFortune(), false);
  s.slot = 0; s.money = 2999; assert.equal(await fortune.doFortune(), false); assert.equal(s.money, 2999);
  s.money = 10000; assert.equal(await fortune.doFortune(), true); assert.equal(s.money, 7000); assert.equal(s.fortuneDay, 3);
  assert.equal(await fortune.doFortune(), false); assert.equal(s.money, 7000); assert.equal(s.fortune.char, "naru");
});
await check("calendar resume syncs before destination selection; repeated display notice is not duplicated", async () => {
  const s = fresh(3, 0); s.flags[key] = true; s.flags._morning_3 = true; while (weather.isRainy()) s.weatherSeed++;
  await assert.rejects(calendar.runDaily({ nightEvents: {}, untilDay: 4 }), /map boundary/); assert.equal(discovery.fortunePresent(s, false), true);
  const spot = { id: "fortune", label: "タロット占い", revealed: false }; assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 0);
  spot.revealed = true; assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 1); assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 0);
  assert.match(reveal.spotRevealNotice(spot), /^つむぎから聞いた/);
});
console.log(JSON.stringify({ groups: results.length, results, scope: "Node actual public modules; controlled VN/render/stats ports; no real PC/touch/LOAD UI" }));
