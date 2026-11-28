// 本番tonariシフトをVMで実行。店番（昼から夜まで・TFL62）の日当と体調・カメオの一度限り・上がりの会話・昼の閉店矛盾を検証。
// 旧バイトの接客（data/baito_events.json の抽選）は TFL63 で廃止した。店番の画面はこの VM では読まない（歩合なしで勤務だけ済む）。
// node --experimental-vm-modules remake/test/daily_consistency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { seeded } from "../js/core/util.js";
import { conditionForRatio } from "../js/core/condition.js";
const root = new URL("../", import.meta.url), dataRoot = new URL("../../", import.meta.url);
const scenes = JSON.parse(await fs.readFile(new URL("data/dialogue/remake_ch1.json", dataRoot), "utf8")).dialogues;
const sumi = JSON.parse(await fs.readFile(new URL("data/dialogue/ch1_sumi.json", dataRoot), "utf8")).dialogues;
const state = {}, db = { dialogues: {} }, plays = [], money = [], menus = [], toasts = [];
let rainy = false, selectedPools = [], charmStep = 1, hiyoriDue = false, calling = false;
class Element { constructor(spec) { this.spec = spec; this.children = []; this.dataset = {}; } append(...nodes) { this.children.push(...nodes.flat().filter(Boolean)); } }
function el(spec, attrs = {}, children = []) { if (Array.isArray(attrs)) { children = attrs; attrs = {}; } const node = new Element(spec); Object.assign(node, attrs); node.append(children); return node; }
function find(node, id) { if (node.dataset?.test === id) return node; return node.children?.map((child) => find(child, id)).find(Boolean); }
const values = {
  "practice.js": { runFullPractice: async () => {} },
  "hiyori.js": { meetHiyoriAtTonari: async () => false, hiyoriShopEncounterDue: () => hiyoriDue, hiyoriAtTonari: () => false },
  "roamers.js": { roamerAt: () => null, roamerPlan: () => null, meetRoamer: async () => false, addRoamerSpots: () => {} }, // よその店に居合わせる人。この検査では居合わせない
  "hiyori-axe.js": { hiyoriAxeReady: () => false, hiyoriAxeAffordable: () => false, hiyoriAxePrereqsMet: () => false, axeThrowExposed: () => false },
  "util.js": { el, seeded, pick: (pool) => { selectedPools.push(pool.map((e) => e.id)); return pool[0]; } },
  "data.js": { DB: db, sceneBg: () => ({}), loadCinemaDialogue: async () => db, bgUrl: () => "bg", displayName: id => id },
  "ui.js": { withScenePreparation: task => task, imageReady: async () => false, showScreen: (_, node) => { menus.push(node); Promise.resolve().then(() => find(node, "after-none")?.onclick()); return node; }, setBg() {}, toast: (text, opts) => toasts.push({ text, ...opts }), retire() {}, modal: async () => 0 },
  "transitions.js": { refreshPlaceCue() {} },
  "state.js": { state, config: { statEffectColors: true }, save() {}, timeOfDay: () => state.slot === 0 ? "day" : "night", markMet() {}, STAT_JA: { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" } },
  "stats.js": { AFFINITY_RANK_PTS: [0,9,20,33,48,66], setStoryAffinityCap() {}, affinityGateWaiting: () => false, addMoney: (value) => money.push(value), addStamina: (value) => { state.stamina = Math.max(0, state.stamina + value); }, applyStats() {}, paidAction: async (run) => ({ value: await run() }), DRILL_GROWTH_BUDGET: 2, step: () => charmStep,
    currentCondition: () => conditionForRatio(state.stamina / 100), gainAffinity() {}, visitAffinity: kind => ({ story: 16, talk: 8 })[kind], releaseAffinity() {}, ensureAffinityLevel() {}, earnStat() {}, affinityLevel: id => [9,20,33,48,66].filter(n => (state.affinity?.[id] || 0) >= n).length },

  "audio.js": { SE: { select() {}, cancel() {} }, playBgm() {} },
  "engine.js": { isPlaying: () => false, play: async (scene) => {
    plays.push(scene);
    state.money += scene.branches?.c0?.at(-1)?.money || 0;
    return { id: typeof scene === "string" ? scene : scene.dialogue_id, visited: [] };
  }, dialogueSequence: (run) => run() },
  "story-knowledge.js": { syncMintoKnowledge() {} },
  "session.js": { runDrill: async () => 0, DRILLS: {} },
  "samechan.js": { samechanSpot: () => null, samechanVisitDialogue: () => null },
  "bond-after.js": { bondAfterNext: () => null, markBondAfterRead() {}, loadBondAfterScenes: async () => {} },
  "bonds.js": { afterStory: async () => {}, questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false, playFinale: async () => false },
  "scene-motions.js": { shiftClose: async () => {} },
  "bus.js": { emit() {}, on: () => () => {} },
  "growth.js": { EXP: { tutorial: 10 }, gainExp: () => 0, growthEnabled: () => false, hidaneTotal: () => 0, readyLessons: () => [], consultLessons: async () => [] },
  "growth-effects.js": { growthPerks: () => null, callingSalesBonus: (_, condition) => calling ? Math.round(1000 * condition.bonusRate) : 0, growthFloorPerks: () => null },
  "reel.js": { installReel() {} },
  "weather.js": { isRainy: () => rainy, weatherOf: () => (rainy ? "rain" : "sun"), RAIN_SPOT_TEXTS: {} },
};
const context = vm.createContext({ Math, Set, Promise, console, AbortController }); const mods = new Map();
async function load(name) { if (mods.has(name)) return mods.get(name); const mod = values[name]
  ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
  : new vm.SourceTextModule(await fs.readFile(new URL(`js/${name === "train-passengers.js" ? "motions" : ["coals.js", "attack-training.js"].includes(name) ? "craft" : ["shift-pay.js", "chapter-features.js", "stat-step-tables.js", "flavor-mastery.js", "cinema-discovery.js", "rules.js", "affinity-stages.js", "axe-bar-discovery.js", "city-locations.js", "trpg-discovery.js", "ryuji-visit.js", "travel-budget.js", "chapter-clock.js", "play-mastery.js", "minto-cheki-data.js"].includes(name) ? "core" : "daily"}/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod; }
const module = await load("tonari.js"); await module.evaluate(); const tonari = module.namespace;
function reset(overrides = {}) { Object.keys(state).forEach((key) => delete state[key]); Object.assign(state, { chapter: 1, day: 8, slot: 0, stamina: 74, flags: { _ev_kuraudo_cameo: true, _ev_reviewer_cameo: true, _ev_uezono_cameo: true }, met: {}, story: {}, usedBaito: [], baitoRecent: [], baitoCount: 10, best: {}, visits: {}, contacts: [], visitedDay: {}, lovers: [], loveLevel: {}, finales: {}, spotVisits: {} }, overrides);
  // 既読段階を注入する在店fixtureでは、その段階を読める♥も明示する（加算の検証は別suite）。
  if (!overrides.affinity) state.affinity = Object.fromEntries(Object.entries(state.story).map(([id,n]) => [id,[0,9,20,33,48,66][Math.min(5,n)] || 0]));
  // DAY8の接客fixtureは、それまでの必須場面を読了した通常営業。
  Object.assign(state.flags, { _tsumugi_contest_research: true, _tsumugi_contest_progress: true });
  state.money = 0;
  rainy = calling = false; charmStep = 1; plays.length = 0; money.length = 0; menus.length = 0; toasts.length = 0; selectedPools = []; }
// 第1章の正体を伏せた3客（カメオ）は、それぞれ一度きり。第2章に持ち越さない。
reset({ day: 6, baitoCount: 1, flags: {} });
await tonari.doBaito(); await tonari.doBaito(); await tonari.doBaito(); await tonari.doBaito();
for (const scene of ["ch1_kuraudo_cameo", "ch1_reviewer_cameo", "ch1_uezono_cameo"]) assert.equal(plays.filter((s) => s === scene).length, 1);
reset({ chapter: 2, baitoCount: 1, flags: {} }); await tonari.doBaito(); assert(!plays.includes("ch1_kuraudo_cameo"));
// 旧バイトの接客（抽選の客・今日の注文）は出ない（TFL63）
assert(!plays.some((scene) => /^baito_|remake_baito_(routine|rain)/.test(typeof scene === "string" ? scene : scene.dialogue_id || "")));
// 第1章の2コマ分の基本給（8,000円）。昼シフト後のUIと台本にレジ締めや閉店を持ち込まない。
reset(); await tonari.doBaito({ called: true }); assert.equal(money[0], 14000, "8,000＋急なシフト5,000＋好調1,000（体力74から昼の分を引いて54）"); assert(!JSON.stringify(menus).includes("閉店"));
// 体力は昼の分（20）を引いた時の色で、仕上げの調子（指名の倍率・好調の上乗せ）を決める。夜の分（20）は店番の後に引く。基本給・急なシフトは維持。
for (const [stamina, expectedPay] of [[75, 14575], [70, 13500], [45, 13250], [24, 13250]]) {
  reset({ stamina }); charmStep = 3; rainy = true;
  await tonari.doBaito({ called: true });
  assert.equal(money[0], expectedPay, `Shift condition at stamina=${stamina}`);
  assert.equal(state.stamina, Math.max(0, Math.max(0, stamina - 20) - 20), "昼の分と夜の分で、合わせて40");
}
reset({ stamina: 24 }); await tonari.doBaito(); assert.equal(money[0], 8000, "Exhaustion cut the guaranteed base wage");
const fatigueWarning = () => toasts.some(({ text, kind }) => kind === "warn" && text.includes("ボーナスは半額"));
assert.equal(fatigueWarning(), false);
reset({ stamina: 24 }); calling = true; await tonari.doBaito();
assert.equal(money[0], 8500); // 8,000＋呼び込み500（不調で半額）。仕事が早いは SBD157 でシャッフルの速さへ移り、日当には足さない
assert(fatigueWarning(), "指名がなくても呼び込みボーナスの半減を知らせる");
// #1081 B05: シフト上がりのスミ会話は必須で、メニューに選択肢は無い。
// 統合spots.jsの夜限定gateをそのまま使う。店番は昼から夜まで（TFL62）なので、上がりは夜: 夜限定の固有会話（ch1_sumi_training）が流れ、既読（story）が進む。
db.dialogues = Object.fromEntries([...scenes, ...sumi].map((s) => [s.dialogue_id, s]));
reset({ story: { sumi: 2 }, affinity: { sumi: 20 } }); await tonari.doBaito();
assert.equal(state.slot, 1, "昼に入った店番の上がりは夜");
assert(plays.includes("ch1_sumi_training"), "上がりは夜なので、夜限定の固有会話を流す");
assert(!plays.includes("remake_sumi_after_shift"), "固有会話がある日は定型の一言にしない");
assert.equal(state.story.sumi, 3, "固有会話の既読が進む");
assert(!JSON.stringify(menus).includes("スミさんと話す"), "シフト上がりメニューにスミ会話の選択肢は無い");
reset({ story: { sumi: 3 }, affinity: { sumi: 33 }, flags: { _ev_kuraudo_cameo: true, _ev_reviewer_cameo: true, _ev_uezono_cameo: true } });
await tonari.doBaito();
assert(!plays.includes("ch1_sumi_training"), "読んだ固有会話は繰り返さない");

const handoff = scenes.find((s) => s.dialogue_id === "remake_delivery_minto_handoff");
assert(handoff && /peppermint/.test(handoff.metadata.bg) && /この後よかったら/.test(JSON.stringify(handoff)));
assert.equal(handoff.lines[0].speaker, "minto");
assert(!/bg_street|到着した|看板を確かめ|ドアを|店内に入ると/.test(JSON.stringify(handoff)));
assert(!/一服してって|どうぞ、こっちへ/.test(JSON.stringify(handoff)), "Delivery must not auto-enter PEPPERMINT");
const mintoFirst = JSON.parse(await fs.readFile(new URL("data/dialogue/ch1_minto.json", dataRoot), "utf8")).dialogues.find((d) => d.dialogue_id === "ch1_minto_first");
assert(mintoFirst?.branches?.dl_door?.some((line) => /配達してくれた/.test(line.text || "")));
assert(!mintoFirst.branches.dl_door.some((line) => /3つの箱を/.test(line.text || "")), "Delivery should not replay on first voluntary visit");
const end = scenes.find((s) => s.dialogue_id === "remake_baito_end"); assert(!/レジを締め|閉店/.test(JSON.stringify(end)));
assert(!JSON.stringify(scenes.find((s) => s.dialogue_id === "remake_repeat_sumi_1")).includes("静かな夜"));
const closing = sumi.find((s) => s.dialogue_id === "ch1_sumi_closing"); assert(JSON.stringify(closing).includes("閉店後"));
for (const id of ["ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_final"]) assert(JSON.stringify(sumi.find((s) => s.dialogue_id === id)).includes("閉店後"), id);
assert(JSON.stringify(sumi.find((s) => s.dialogue_id === "ch1_sumi_eve")).includes("大会前夜"));
// #782: 同じ在店判定がマップ/入店/シフトに届く。固定回・延期回を通常回で重ねない。
const spots = mods.get("spots.js").namespace;
const peopleModule = await load("spot-people.js"); await peopleModule.evaluate();
for (const [day, slot, present] of [[6, 0, false], [6, 1, true], [8, 0, true], [8, 1, false], [11, 0, false], [11, 1, false]]) {
  reset({ day, slot, story: { tsumugi: 1 }, hearts: { tsumugi: 1 }, visits: {}, contacts: [], visitedDay: { tonari_baito: day } }); // #814: 2本目は♥1で開く
  db.dialogues = { ch1_tsumugi_second: { lines: [] } };
  assert.equal(peopleModule.namespace.spotPeople({ id: "tonari", kind: "tonari" }).some(p => p.id === "tsumugi"), present);
  assert.equal(spots.hasNewEvent({ id: "tonari", kind: "tonari" }), present);
  await tonari.tonariCustomer();
  assert.equal(plays.includes("ch1_tsumugi_second"), present);
  assert.equal(state.story.tsumugi, present ? 2 : 1);
}
// #782 P2: DAY8昼の実来店で個別会話3→4へ進んでも、その日の夜に再登場しない。
reset({ day: 8, slot: 0, story: { tsumugi: 3 }, hearts: { tsumugi: 3 }, visits: {}, contacts: [],
  visitedDay: { tonari_baito: 8, tonari_customer: 8 } });
db.dialogues = { ch1_tsumugi_fourth: { lines: [] } };
await tonari.tonariCustomer();
assert.equal(state.story.tsumugi, 4);
assert(plays.includes("ch1_tsumugi_fourth"));
state.slot = 1;
assert(!peopleModule.namespace.spotPeople({ id: "tonari", kind: "tonari" }).some(p => p.id === "tsumugi"),
  "昼の会話進行で同じ夜の在店表示が復活した");
assert.equal(spots.hasNewEvent({ id: "tonari", kind: "tonari" }), false);
// 後半の夜専用会話はDAY12夜に引き続き到達できる。
reset({ day: 12, slot: 1, story: { tsumugi: 4 }, hearts: { tsumugi: 4 }, visits: {}, contacts: [],
  flags: { _tsumugi_contest_submitted: true }, visitedDay: {} });
db.dialogues = { ch1_tsumugi_fifth: { lines: [] } };
await tonari.tonariCustomer();
assert(plays.includes("ch1_tsumugi_fifth"));
assert.equal(state.story.tsumugi, 5);
// 相席日は昼の単独挨拶だけを省略。通常昼・夜の挨拶と来店報酬はそのまま。
for (const [slot, guest, welcome] of [[0, true, false], [0, false, true], [1, true, true]]) {
  reset({ day: 8, slot, story: { minto: 1 }, visits: {}, contacts: [], visitedDay: {} }); hiyoriDue = guest;
  const id = `venue_minto_${slot ? "night" : "day"}`;
  db.dialogues = { [id]: { lines: [] }, ch1_minto_second: { lines: [] } };
  await spots.visitRival({ id: "minto", kind: "rival", charId: "minto", cost: 3000, stamina: -16 });
  assert.equal(plays.includes(id), welcome);
  assert(plays.includes("ch1_minto_second"));
  assert.equal(money[0], -3000);
  assert.equal(state.stamina, 58);
  assert.equal(state.story.minto, 2);
}
console.log("[remake daily] floor shift pay and condition halves, cameos once, after-shift talk at night, shift-time copy: PASS");

// 隣町からの私用の客。実際の抽選・地図・読了記録を使い、料金や好感度は増やさない。
const cityModule = await load("city-guests.js"); await cityModule.evaluate();
const cityGuests = cityModule.namespace;
const guestScript = JSON.parse(await fs.readFile(new URL("data/dialogue/ch2_city_guests.json", dataRoot), "utf8")).dialogues;
const guestIds = ["ageha", "kumicho", "kuraudo"];
const guestSpots = { ageha: "minto", kumicho: "adam", kuraudo: "tonari" };
function guestState(id, day = 17, extra = {}) {
  reset({ chapter: 2, phase: "daily", day, slot: 0, weatherSeed: 0, stamina: 90, money: 10000,
    met: Object.fromEntries([...guestIds, "minto", "adam", "sumi"].map(id => [id, true])),
    visits: {}, visitedDay: {}, contacts: [], ...extra });
  db.dialogues = Object.fromEntries(guestScript.map(s => [s.dialogue_id, s]));
  for (let weatherSeed = 0; weatherSeed < 10000; weatherSeed++) {
    state.weatherSeed = weatherSeed;
    if (cityGuests.cityGuestVisit()?.id === id) return;
  }
  throw Error("No guest seed for " + id);
}
for (const id of guestIds) {
  guestState(id);
  const spot = spots.SPOTS.find(s => s.id === guestSpots[id]);
  // 17日はEDEN、PEPPERMINTとも定休日ではない。
  const before = JSON.stringify(state);
  const planned = cityGuests.cityGuestAtShop(spot);
  assert.equal(planned?.id, id);
  assert(peopleModule.namespace.spotPeople(spot).some(p => p.id === id && p.known && p.role === "guest"));
  assert.equal(JSON.stringify(state), before, "Map must only read the schedule");
  assert.equal(cityGuests.cityGuestAtShop({ ...spot, closedOn: state.day % 7 }), null);
  assert.equal(cityGuests.cityGuestAtShop({ ...spot, unavailable: "準備中" }), null);
  assert(!await cityGuests.visitCityGuestAtShop({ id: "wrong-shop" }, { scheduledVisit: planned }));
  const resources = JSON.stringify([state.money, state.stamina, state.slot, state.stats, state.affinity, state.visits]);
  assert(await cityGuests.visitCityGuestAtShop(spot, { scheduledVisit: planned }));
  assert(plays.includes(`ch2_city_guest_${id}_first`));
  assert.equal(state.flags[`_city_guest_seen_${id}`], true);
  assert.equal(state.flags._city_guest_day, "2:17");
  assert.equal(cityGuests.cityGuestVisit(), null);
  assert(!await cityGuests.visitCityGuestAtShop(spot, { scheduledVisit: planned }));
  assert.equal(JSON.stringify([state.money, state.stamina, state.slot, state.stats, state.affinity, state.visits]), resources);
  guestState(id, 18); state.flags[`_city_guest_seen_${id}`] = true;
  const repeat = cityGuests.cityGuestAtShop(spot);
  assert(repeat); assert(await cityGuests.visitCityGuestAtShop(spot, { scheduledVisit: repeat }));
  assert(plays.includes(`ch2_city_guest_${id}_repeat`));
  // RVE07: 2回目からは繰り返しの回を巡回する（神崎・クラウドは3本、あげはは1本のまま）。旧保存（巡回の記録なし）は _repeat から
  assert.equal(state.flags[`_city_guest_count_${id}`], 1);
  const pool = id === "ageha" ? ["repeat"] : ["repeat", "repeat_b", "repeat_c"];
  for (let n = 0; n <= 4; n++) {
    assert.equal(cityGuests.cityGuestScene({ flags: { [`_city_guest_seen_${id}`]: true, [`_city_guest_count_${id}`]: n } }, id),
      `ch2_city_guest_${id}_${pool[n % pool.length]}`, `${id}: repeat ${n}`);
    for (const suffix of pool) assert(guestScript.some(d => d.dialogue_id === `ch2_city_guest_${id}_${suffix}` && d.lines?.length), `${id}_${suffix} exists`);
  }
  assert.equal(cityGuests.cityGuestScene({ flags: {} }, id), `ch2_city_guest_${id}_first`);
  guestState(id); const stale = cityGuests.cityGuestAtShop(spot); state.day++;
  assert(!await cityGuests.visitCityGuestAtShop(spot, { scheduledVisit: stale }));
  assert.equal(state.flags._city_guest_day, undefined);
}
guestState("ageha"); state.chapter = 1; assert.equal(cityGuests.cityGuestVisit(), null);
guestState("ageha"); state.met = {}; assert.equal(cityGuests.cityGuestVisit(), null);
guestState("ageha"); state.slot = 2; assert.equal(cityGuests.cityGuestVisit(), null);
guestState("ageha"); state.phase = "tournament"; assert.equal(cityGuests.cityGuestVisit(), null);
guestState("ageha"); state.pendingInvite = { sender: "ageha", day: state.day, slot: 1 }; assert.equal(cityGuests.cityGuestVisit(), null);
console.log("[city guests] PASS: three matching map/shop schedules, known/closed/date guards, first/repeat, once daily, no added resources");
