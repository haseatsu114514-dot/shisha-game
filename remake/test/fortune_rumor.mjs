// Actual public callers with controlled rendering/VN/stats ports; no browser acceptance.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = new URL("../js/", import.meta.url);
const dataRoot = new URL("../../data/dialogue/", import.meta.url);
const actual = new Set(["core/chapter-features.js", "core/flavor-mastery.js","core/cinema-discovery.js", "daily/cinema.js","core/affinity-stages.js", "core/state.js", "core/gallery-progress.js", "core/rules.js", "core/bus.js", "core/chapter-clock.js", "daily/fortune-schedule.js", "core/fortune-effects.js",
  "daily/fortune-rumor.js", "daily/weather.js", "daily/tonari.js", "daily/spots.js", "daily/fortune.js", "daily/spot-access.js",
  "daily/spot-people.js", "daily/map-reveals.js", "daily/tsumugi-schedule.js", "chapters/tsumugi-story.js", "daily/calendar.js"]);
const DB = { flavorById: {}, dialogues: {}, characters: { naru: { name: "なる" } }, fortuneTrivia: {}, flavors: [], recipes: [], baito: [] };
for (const name of ["ch1_events", "ch1_tsumugi", "remake_ch1"]) for (const d of JSON.parse(fs.readFileSync(new URL(`${name}.json`, dataRoot))).dialogues) DB.dialogues[d.dialogue_id] = d;
const trace = [], storage = new Map(); let core, mode = "normal", release, writes = 0, syncCalls = 0;
const ctx = vm.createContext({ console, Date, Math, AbortController, setTimeout, clearTimeout,
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { writes++; storage.set(k, v); } },
  sessionStorage: { getItem: () => null, setItem() {} }, window: {}, document: {}, location: { reload() { throw Error("unexpected reload"); } } });
const noop = () => {}, empty = () => [];
const el = (tag,attrs={},children=[]) => { if(Array.isArray(attrs)){children=attrs;attrs={};} return {tag,...attrs,children:children.flat(Infinity).filter(Boolean),classList:{contains:()=>false},append(){},remove(){},replaceChildren(){}}; };
const find = (node,test) => node?.dataset?.test===test ? node : (node?.children||[]).map(n=>find(n,test)).find(Boolean);
const mocks = {
  DB, el, yen: String, clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)), bgUrl: x => x, displayName: x => x,
  layers: { modal: el(), fx: el() }, SE: new Proxy({}, { get: () => noop }), DRILLS: {}, AXE_BAR: null,
  sceneBg: () => ({}), withScenePreparation: task => task, imageReady: async () => false, setBackgroundWeatherSource: noop, setBg: async () => {}, showScreen: noop,
  addStamina: n => { core.state.stamina += n; }, addMoney: n => { core.state.money += n; },
  gainAffinity: noop, visitAffinity: kind => ({ story: 16, talk: 8 })[kind], releaseAffinity: () => 0, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], setStoryAffinityCap: noop, releaseStoryAffinity: () => 0, affinityGateWaiting: () => false, earnStat: noop, ensureAffinityLevel: (id,level) => { core.state.affinity[id] = Math.max(core.state.affinity[id] || 0, [0,9,20,33,48,66][level]); }, syncMintoKnowledge: noop, meetHiyoriAtTonari: async () => false, afterStory: async () => true, playBgm: noop, syncSamechanKnowledge: noop, syncNightQueue: noop, expireInvitations: noop, initHud: noop, showHud: noop, setPhoneBadge: noop, presentNow: async ({label}={}) => { if(mode==="calendar"&&label==="今回のスロット")throw Error("after-action boundary"); }, spendableMoney: s => s.money, returnFareReserve: () => 0, affinityLevel: () => 0, currentCondition: () => ({ bonusRate: 1, shiftBonus: 0 }),
  questionVisitDue: () => false, finaleAtVisit: () => false, spotFollowupDue: () => null, maybeRecruitTrpgMember: async () => {},
  // 占い師は昼にも夜にも現れる（台帳 URA）。営業時間の門は無い
  openingStatus: () => ({ ok: true }),
  // 日常ループが占い師の時間帯を決めるとき、夜の固定の予定を見る（この試験では予定なし）
  nightOccupied: () => false,
  trpgSpot: () => null, samechanSpot: () => null, cityGuestAtShop: () => null, hiyoriFirstMeetingReady: () => false,
  fixedNightVisitBlock: () => null, nightPlan: empty, restingToday: () => false, unreadCount: () => 0,
  chooseSpot: async () => { if(mode==="calendar")return "tonari";throw new Error("map boundary"); },
  showScreen: (name,node) => { if(mode==="calendar")Promise.resolve().then(()=>find(node,"tonari-customer").onclick()); return node; }, retire:noop, hiyoriAxeReady:()=>false,
  paidAction:async run=>({value:await run(),spent:10}), coldRisk:()=>false,catchesCold:()=>false,fitActive:()=>false,staminaAfter:n=>core.state.stamina+n,maxStamina:()=>100,staminaRatio:()=>core.state.stamina/100,
  readyLessons: () => [], consultLessons: async () => [], // 心得の盤の授業（相談）。この検査では無効
  onAction:noop,hiyoriShopLocation:()=>null,visitHiyoriAtShop:async()=>false,visitCityGuestAtShop:async()=>false,roamerAt:()=>null,roamerPlan:()=>null,meetRoamer:async()=>false,

  dialogueSequence: fn => fn(),
  play: async id => {
    const key = typeof id === "string" ? id : id.dialogue_id; trace.push(key);
    if (key === "ch1_tsumugi_first" && mode === "host-missing") return undefined;
    if (key === "ch1_tsumugi_first" && mode === "host-cancel") return {cancelled:true};
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
  const sm = new vm.SyntheticModule([...new Set(names)], function () { for (const name of new Set(names)) this.setExport(name, mocks[name] ?? (() => { throw Error(`Unexpected port ${name}`); })); }, { context: ctx }); synthetic.set(k, sm); return sm;
}
async function load(p) { const m = moduleOf(p); if (m.status === "unlinked") await m.link(link); if (m.status === "linked") await m.evaluate(); return m.namespace; }
core = await load("core/state.js"); const discovery = await load("daily/fortune-schedule.js"), weather = await load("daily/weather.js");
const rumor = await load("daily/fortune-rumor.js"), tonari = await load("daily/tonari.js"), spots = await load("daily/spots.js");
const fortune = await load("daily/fortune.js"), access = await load("daily/spot-access.js"), people = await load("daily/spot-people.js");
const reveal = await load("daily/map-reveals.js"), fixed = await load("chapters/tsumugi-story.js"), calendar = await load("daily/calendar.js");
const key = discovery.FORTUNE_RUMOR, results = [];
const fresh = (day = 2, slot = 1) => { trace.length = 0; mode = "normal"; release = null; core.newGame(); Object.assign(core.state, { phase: "daily", day, slot, weatherSeed: 4 }); core.state.flags._tsumugi_contest_research = true; return core.state; };
async function check(name, fn) { await fn(); results.push(name); console.log(`PASS ${name}`); }
// 占い師は現れている時間帯だけ行き先になる（台帳 URA）。いない時は同じ形の行き先で門を確かめる。
const offer = () => spots.spotById("fortune") || { id: "fortune", kind: "fortune", charId: "uranaishi", label: "路上占い", area: "", x: 0, y: 0 };
// 予定の最初の時間帯へ移す（第1章は章内日＝通算日）
const toPlan = (s, n = 0) => { const at = discovery.fortunePlan(s)[n]; s.day = Math.floor(at / 2) + 1; s.slot = at % 2; return at; };

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
  s.limeRead.push(discovery.FORTUNE_RUMOR_ID); assert.equal(discovery.fortuneRumorHeard(s), false); assert.equal(s.flags[key], undefined); assert.equal(spots.isUnlocked(offer()), false);
  await tonari.tonariCustomer(); assert.equal(s.flags[key], true); assert.equal(JSON.stringify({ met: s.met, used: s.fortuneDay }), old);
});
await check("unheard hides pin/people/availability and blocks direct entry without mutation", async () => {
  const s = fresh(3, 0); const before = JSON.stringify(s);
  assert.equal(spots.isUnlocked(offer()), false); assert.equal(access.spotVisible(offer()), false);
  assert.equal(access.spotAvailability(offer()).ok, false); assert.equal(people.spotPeople(offer()).length, 0);
  assert.equal(fortune.fortuneToday(), false); assert.equal(await fortune.doFortune(), false); assert.equal(JSON.stringify(s), before);
});
await check("wandering schedule: 1-2 times a chapter, on/after the planned half-day, postponed by plans, gone if missed", () => {
  for (const seed of [1, 2, 3, 7, 12, 99, 1234]) for (const chapter of [1, 2, 5]) {
    const s = fresh(); s.chapter = chapter; s.seed = seed; s.flags[key] = true;
    if (chapter === 2) s.flags._ch2_day1 = { startDay: 1 }; if (chapter === 5) s.flags._ch5 = { startDay: 1 };
    const plan = discovery.fortunePlan(s), label = JSON.stringify({ seed, chapter, plan });
    assert(plan.length === 1 || plan.length === 2, label);
    assert.deepEqual(discovery.fortunePlan(s), plan, `deterministic: ${label}`);
    const [lo, hi] = chapter === 5 ? [1, 12] : [2, 13];
    for (const at of plan) assert(at >= (lo - 1) * 2 && at <= hi * 2 - 1, label);
    if (plan.length === 2) assert(plan[0] < plan[1], label);
  }
  // 予定の時間帯の前は出ない。予定と重なればずれて、空いた時間帯に出る。寄らずに過ぎれば、いなくなる。
  const s = fresh(); s.flags[key] = true; s.seed = 5;
  const at = toPlan(s);
  if (at > 2) { const keep = [s.day, s.slot]; s.day = Math.floor((at - 1) / 2) + 1; s.slot = (at - 1) % 2;
    assert.equal(discovery.syncFortune(s), false); assert.equal(fortune.fortuneToday(), false); [s.day, s.slot] = keep; }
  assert.equal(discovery.syncFortune(s, { busy: true }), false, "a planned slot with plans postpones");
  assert.equal(fortune.fortuneToday(), false);
  if (s.slot === 0) s.slot = 1; else { s.day += 1; s.slot = 0; }
  assert.equal(discovery.syncFortune(s), true, "the next free slot");
  assert.equal(fortune.fortuneToday(), true); assert.equal(spots.isUnlocked(offer()), true);
  const before = JSON.stringify(s);
  assert.equal(discovery.syncFortune(s), true); assert.equal(fortune.fortuneToday(), true); assert.equal(JSON.stringify(s), before, "same slot is idempotent");
  if (s.slot === 0) s.slot = 1; else { s.day += 1; s.slot = 0; }
  assert.equal(fortune.fortuneToday(), false, "missed: she is gone");
  // 柚ヶ谷にいる間は現れず、地元に戻った時間帯へずれる。東京は第3・5章だけ。
  const t = fresh(); t.flags[key] = true; t.seed = 5; toPlan(t);
  assert.equal(discovery.syncFortune(t, { where: "widehanga" }), false);
  assert.equal(discovery.syncFortune(t, { where: "tokyo" }), false, "Tokyo only in Chapters 3 and 5");
});
// 遠出する章（VOL15）: 第3章は出発前の準備と東京、第4章は出発前の準備だけ。日は準備の1日目から通しで数える。
await check("Chapters 3 and 4 count from the departure prep; Chapter 3 also in Tokyo, Chapter 4 never in Dubai", () => {
  const prepSave = (chapter, seed, departed = false) => {
    const s = fresh(); s.chapter = chapter; s.seed = seed; s.day = 40; s.slot = 0;
    s.flags[`_ch${chapter}_prep`] = { startDay: 40, days: 3, step: departed ? 6 : 0, departed };
    return s;
  };
  for (const seed of [1, 2, 3, 7, 12, 99, 1234]) for (const [chapter, hi] of [[3, 16], [4, 3]]) {
    const plan = discovery.fortunePlan(prepSave(chapter, seed)), label = JSON.stringify({ seed, chapter, plan });
    assert(plan.length === 1 || plan.length === 2, label);
    for (const at of plan) assert(at >= 0 && at <= hi * 2 - 1, label);
  }
  // 第3章: 準備の3日を過ぎた東京でも、通しで数えた時間帯が来ていれば現れる。地図の一覧（地元）には出ず、行き先としては引ける。
  for (const seed of [1, 2, 3, 7, 12]) {
    const s = prepSave(3, seed, true), label = `seed ${seed}`;
    s.day = 40 + 15; s.slot = 1; // 通しの16日目（東京DAY13）の夜
    assert.equal(discovery.syncFortune(s, { where: "widehanga" }), false, label);
    assert.equal(discovery.syncFortune(s, { where: "tokyo" }), true, label);
    assert.equal(discovery.fortuneHere(s, "tokyo"), true, label);
    assert.equal(fortune.fortuneToday(), true, label);
    assert.equal(spots.allSpots().some(spot => spot.id === "fortune"), false, `the home map does not list her: ${label}`);
    assert.equal(spots.spotById("fortune")?.kind, "fortune", `she can still be visited in Tokyo: ${label}`);
    assert.match(discovery.fortunePosition(s).area, /高架|池/, label);
  }
  // 第4章: 準備の間は地元に現れる。ドバイでは、予定の時間帯を過ぎていても現れない。
  for (const seed of [1, 2, 3, 7, 12]) {
    const s = prepSave(4, seed), label = `seed ${seed}`;
    const at = discovery.fortunePlan(s)[0];
    s.day = 40 + Math.floor(at / 2); s.slot = at % 2;
    assert.equal(discovery.syncFortune(s, { where: "home" }), true, label);
    const d = prepSave(4, seed, true);
    for (const day of [43, 46, 52]) for (const slot of [0, 1]) {
      d.day = day; d.slot = slot;
      assert.equal(discovery.syncFortune(d, { where: "dubai" }), false, `${label} day ${day}`);
      assert.equal(fortune.fortuneToday(), false, `${label} day ${day}`);
    }
  }
});
await check("actual state SAVE/LOAD preserves face completion, legacy LIME history, old fortune and pure-rain result", () => {
  const s = fresh(3, 0); s.flags[key] = true; s.flags._fortune_met = true; s.fortuneDay = 1; s.fortune = { char: "naru", mult: 1.5 };
  s.limeRead.push(discovery.FORTUNE_RUMOR_ID); const prior=JSON.stringify(s.limeRead);
  core.saveToSlot("suien_remake_slot1"); core.newGame(); core.loadFromSlot("suien_remake_slot1");
  assert.equal(core.state.flags[key],true);assert.equal(core.state.fortuneDay,1);assert.equal(core.state.fortune.char,"naru");
  assert.equal(JSON.stringify(core.state.limeRead),prior);
});
await check("chapters, rumor gate and entry: Chapter 1 after the rumor, Chapters 2 to 5 always", async () => {
  const features = await load("core/chapter-features.js");
  for (const chapter of [1, 2, 3, 4, 5, undefined, "1", "2", "5"]) {
    assert.equal(features.chapterFeatureEnabled(chapter, "fortune"), [1, 2, 3, 4, 5].includes(chapter));
    assert.equal(features.chapterFeatureEnabled(chapter, "unknown"), false);
    for (const heard of [false, true]) for (const seed of [2, 4, 12, 29]) {
      const s = fresh(); if (chapter === undefined) delete s.chapter; else s.chapter = chapter;
      if (s.chapter === 2) s.flags._ch2_day1 = { startDay: 1 }; if (s.chapter === 5) s.flags._ch5 = { startDay: 1 };
      if (s.chapter === 3 || s.chapter === 4) s.flags[`_ch${s.chapter}_prep`] = { startDay: 1, days: 3, step: 0, departed: false };
      s.seed = seed; s.flags[key] = heard; s.money = 10000; s.met.naru = true; s.affinity.naru = 5;
      const plan = discovery.fortunePlan(s);
      if (plan.length) toPlan(s);
      const expected = [1, 2, 3, 4, 5].includes(chapter) && (chapter !== 1 || heard);
      const label = JSON.stringify({ chapter, heard, seed });
      assert.equal(discovery.syncFortune(s), expected, label);
      assert.equal(fortune.fortuneToday(), expected, label);
      assert.equal(spots.isUnlocked(offer()), expected, label);
      assert.equal(access.spotVisible(offer()), expected, label);
      assert.equal(access.spotAvailability(offer()).ok, expected, label);
      assert.equal(await fortune.doFortune(), expected, label);
      if (expected) {
        assert.equal(s.money, 7000, label); assert.equal(s.fortune.char, "naru", label);
        assert.equal(s.affinity.naru, 5, label); assert.equal(fortune.fortuneToday(), false, `once per appearance: ${label}`);
        assert.equal(await fortune.doFortune(), false, label); assert.equal(s.money, 7000, label);
      }
    }
  }
});
await check("day or night, fee, once per appearance and live result application retained", async () => {
  for (const slot of [0, 1]) {
    const s = fresh(); s.flags[key] = true; s.seed = 8; s.met.naru = true; s.affinity.naru = 5;
    s.slot = slot; assert.equal(discovery.placeFortuneNow(s), true);
    assert.equal(access.spotAvailability(offer()).ok, true, `slot ${slot}`);
    s.money = 2999; assert.equal(await fortune.doFortune(), false); assert.equal(s.money, 2999);
    s.money = 10000; assert.equal(await fortune.doFortune(), true); assert.equal(s.money, 7000); assert.equal(s.slot, slot, "no time used");
    assert.equal(await fortune.doFortune(), false); assert.equal(s.money, 7000); assert.equal(s.fortune.char, "naru");
  }
});
await check("calendar resume uses current schedule; repeated display notice is not duplicated", async () => {
  const s = fresh(); s.flags[key] = true; s.seed = 3; toPlan(s); s.flags[`_morning_${s.day}`] = true;
  await assert.rejects(calendar.runDaily({ nightEvents: {}, untilDay: s.day + 1 }), /map boundary/); assert.equal(fortune.fortuneToday(), true);
  const spot = { id: "fortune", label: "タロット占い", revealed: false }; assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 0);
  spot.revealed = true; assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 1); assert.equal(reveal.newlyRevealedSpots(s, "home", [spot]).length, 0);
  assert.match(reveal.spotRevealNotice(spot), /^つむぎから聞いた/);
});
await check("legacy morning LIME alone cannot reveal, enter or mutate the game", async () => {
  const s=fresh(3,0);s.limeRead.push(discovery.FORTUNE_RUMOR_ID);s.flags._fortune_met=true;
  s.met.tsumugi=true;s.met.uranaishi=true;s.fortuneDay=1;while(weather.isRainy())s.weatherSeed++;
  const before=JSON.stringify(s);assert.equal(discovery.fortuneRumorHeard(s),false);
  assert.equal(access.spotVisible(offer()),false);assert.equal(people.spotPeople(offer()).length,0);
  assert.equal(await fortune.doFortune(),false);assert.equal(JSON.stringify(s),before);
});
await check("public customer double entry is rejected; completion has no rumor-local save", async () => {
  const s=fresh();mode="deferred";const before=writes;const a=tonari.tonariCustomer();
  for(let n=0;n<40&&!release;n++)await Promise.resolve();assert(release);
  assert.equal(await tonari.tonariCustomer(),false);release({id:rumor.FORTUNE_RUMOR_SCENE});
  assert.equal(await a,true);assert.equal(s.flags[key],true);assert.equal(writes,before);
  assert.equal(await tonari.tonariCustomer(),true);assert.equal(writes,before);
  assert.equal(trace.filter(id=>id===rumor.FORTUNE_RUMOR_SCENE).length,1);
});
await check("calendar public route first settlement includes rumor and slot together, with no early rumor save", async () => {
  const s=fresh();s.chapter=2;s.flags._morning_2=true;mode="calendar";const before=writes;
  await assert.rejects(calendar.runDaily({nightEvents:{},untilDay:3}),/after-action boundary/);
  assert.equal(s.flags[key],true);assert.equal(s.slot,2);assert.equal(s.visitedDay.tonari,2);
  assert.equal(writes,before+1,"Only the existing afterAction settlement wrote before the controlled animation boundary");
  core.newGame();const loaded=core.load();assert(loaded);assert.equal(core.state.flags[key],true);assert.equal(core.state.slot,2);
});
await check("public customer abort during rumor never completes; retry can complete", async () => {
  const s=fresh();mode="deferred";const controller=new AbortController();const a=tonari.tonariCustomer({signal:controller.signal});
  for(let n=0;n<40&&!release;n++)await Promise.resolve();assert(release);controller.abort();release({id:rumor.FORTUNE_RUMOR_SCENE});
  assert.equal(await a,false);assert.equal(s.flags[key],undefined);mode="normal";
  assert.equal(await tonari.tonariCustomer(),true);assert.equal(s.flags[key],true);
});
await check("missing or cancelled host conversation cannot unlock the rumor", async () => {
  for(const outcome of ["host-missing","host-cancel"]){fresh();mode=outcome;
    assert.equal(await tonari.tonariCustomer(),false);assert.equal(core.state.flags[key],undefined);
    assert(!trace.includes(rumor.FORTUNE_RUMOR_SCENE));assert.equal(core.state.story.tsumugi||0,0,"Incomplete first host conversation stays unread");}
});
await check("obsolete LIME is not newly delivered and requested scene is retained exactly", () => {
  const lime=JSON.parse(fs.readFileSync(new URL("../../data/lime_messages.json",import.meta.url)));
  assert(!lime.messages.some(m=>m.id===discovery.FORTUNE_RUMOR_ID));
  const lines=DB.dialogues[rumor.FORTUNE_RUMOR_SCENE].lines;
  assert(lines.some(l=>l.speaker==="tsumugi"&&/チャーハンとオムライス/.test(l.text)));
  assert(lines.some(l=>l.speaker==="hajime"&&l.text==="（好きな方を食べればいいのに……）"));
});
console.log(JSON.stringify({ groups: results.length, results, scope: "Node actual public modules; controlled VN/render/stats ports; no real PC/touch/LOAD UI" }));
