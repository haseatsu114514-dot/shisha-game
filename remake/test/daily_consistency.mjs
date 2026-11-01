// 本番tonariシフトをVMで実行。接客条件・一度限り・同じ客の連日登場・昼の閉店矛盾を検証。
// node --experimental-vm-modules remake/test/daily_consistency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { seeded } from "../js/core/util.js";
import { conditionForRatio } from "../js/core/condition.js";
const root = new URL("../", import.meta.url), dataRoot = new URL("../../", import.meta.url);
const baitoData = JSON.parse(await fs.readFile(new URL("data/baito_events.json", dataRoot), "utf8"));
const categories = new Set(["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]);
const events = baitoData.events.filter((e) => categories.has(e.category));
const scenes = JSON.parse(await fs.readFile(new URL("data/dialogue/remake_ch1.json", dataRoot), "utf8")).dialogues;
const sumi = JSON.parse(await fs.readFile(new URL("data/dialogue/ch1_sumi.json", dataRoot), "utf8")).dialogues;
const state = {}, db = { baito: events, dialogues: {} }, plays = [], money = [], menus = [];
let rainy = false, selectedPools = [], charmStep = 1, hiyoriDue = false;
class Element { constructor(spec) { this.spec = spec; this.children = []; this.dataset = {}; } append(...nodes) { this.children.push(...nodes.flat().filter(Boolean)); } }
function el(spec, attrs = {}, children = []) { if (Array.isArray(attrs)) { children = attrs; attrs = {}; } const node = new Element(spec); Object.assign(node, attrs); node.append(children); return node; }
function find(node, id) { if (node.dataset?.test === id) return node; return node.children?.map((child) => find(child, id)).find(Boolean); }
const values = {
  "practice.js": { runFullPractice: async () => {} },
  "hiyori.js": { meetHiyoriAtTonari: async () => false, hiyoriShopEncounterDue: () => hiyoriDue, hiyoriAtTonari: () => false },
  "hiyori-axe.js": { hiyoriAxeReady: () => false, hiyoriAxeAffordable: () => false, hiyoriAxePrereqsMet: () => false, axeThrowExposed: () => false },
  "util.js": { el, seeded, pick: (pool) => { selectedPools.push(pool.map((e) => e.id)); return pool[0]; } },
  "data.js": { DB: db, sceneBg: () => ({}), loadCinemaDialogue: async () => db, bgUrl: () => "bg", displayName: id => id },
  "ui.js": { withScenePreparation: task => task, imageReady: async () => false, showScreen: (_, node) => { menus.push(node); Promise.resolve().then(() => find(node, "after-none")?.onclick()); return node; }, setBg() {}, toast() {}, retire() {}, modal: async () => true },
  "transitions.js": { refreshPlaceCue() {} },
  "state.js": { state, config: { statEffectColors: true }, save() {}, timeOfDay: () => state.slot === 0 ? "day" : "night", markMet() {}, STAT_JA: { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" } },
  "stats.js": { AFFINITY_RANK_PTS: [0,9,20,33,48,66], setStoryAffinityCap() {}, affinityGateWaiting: () => false, addMoney: (value) => money.push(value), addStamina: (value) => { state.stamina = Math.max(0, state.stamina + value); }, applyStats() {}, paidAction: async (run) => ({ value: await run() }), DRILL_GROWTH_BUDGET: 2, step: () => charmStep,
    currentCondition: () => conditionForRatio(state.stamina / 100), gainAffinity() {}, releaseAffinity() {}, ensureAffinityLevel() {}, earnStat() {}, affinityLevel: id => [9,20,33,48,66].filter(n => (state.affinity?.[id] || 0) >= n).length },

  "audio.js": { SE: { select() {}, cancel() {} }, playBgm() {} },
  "engine.js": { isPlaying: () => false, play: async (scene) => { plays.push(scene); return {id: typeof scene === "string" ? scene : scene.dialogue_id, visited: []}; }, dialogueSequence: (run) => run() },
  "story-knowledge.js": { syncMintoKnowledge() {} },
  "session.js": { runDrill: async () => 0, DRILLS: {} },
  "samechan.js": { samechanSpot: () => null, samechanVisitDialogue: () => null },
  "bonds.js": { afterStory: async () => {}, questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false, playFinale: async () => false },
  "scene-motions.js": { shiftClose: async () => {} },
  "bus.js": { emit() {}, on: () => () => {} },
  "growth.js": { growthEnabled: () => false, hidaneTotal: () => 0, readyLessons: () => [], consultLessons: async () => [] },
  "growth-effects.js": { callingSalesBonus: () => 0 }, // このスイートは盤無効の既存の接客・給料を検証する。
  "reel.js": { installReel() {} },
  "weather.js": { isRainy: () => rainy, weatherOf: () => (rainy ? "rain" : "sun"), RAIN_BAITO: ["baito_rainy_day", "baito_tsumugi_rain"], RAIN_BAITO_BONUS: 500, RAIN_SPOT_TEXTS: {} },
};
const context = vm.createContext({ Math, Set, Promise, console, AbortController }); const mods = new Map();
async function load(name) { if (mods.has(name)) return mods.get(name); const mod = values[name]
  ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
  : new vm.SourceTextModule(await fs.readFile(new URL(`js/${name === "train-passengers.js" ? "motions" : ["coals.js", "attack-training.js"].includes(name) ? "craft" : ["chapter-features.js", "stat-step-tables.js", "flavor-mastery.js", "cinema-discovery.js", "rules.js", "affinity-stages.js", "axe-bar-discovery.js", "city-locations.js", "trpg-discovery.js", "ryuji-visit.js", "travel-budget.js"].includes(name) ? "core" : "daily"}/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod; }
const module = await load("tonari.js"); await module.evaluate(); const tonari = module.namespace;
const byid = Object.fromEntries(events.map((e) => [e.id, e]));
function reset(overrides = {}) { Object.keys(state).forEach((key) => delete state[key]); Object.assign(state, { chapter: 1, day: 8, slot: 0, stamina: 74, flags: { _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true }, met: {}, story: {}, usedBaito: [], baitoRecent: [], baitoCount: 10, best: {}, visits: {}, contacts: [], visitedDay: {}, lovers: [], loveLevel: {}, finales: {}, spotVisits: {} }, overrides);
  // 既読段階を注入する在店fixtureでは、その段階を読める♥も明示する（加算の検証は別suite）。
  if (!overrides.affinity) state.affinity = Object.fromEntries(Object.entries(state.story).map(([id,n]) => [id,[0,9,20,33,48,66][Math.min(5,n)] || 0]));
  // DAY8の接客fixtureは、それまでの必須場面を読了した通常営業。
  Object.assign(state.flags, { _tsumugi_contest_research: true, _tsumugi_contest_progress: true });
  db.baito = events; rainy = false; charmStep = 1; plays.length = 0; money.length = 0; menus.length = 0; selectedPools = []; }
function selected() { return plays.find((scene) => typeof scene === "object" && scene.dialogue_id?.startsWith("baito_"))?.dialogue_id; }
const custom = (id, fields = {}) => ({ id, category: "regular", text: "注文を受けた", choices: [], customers: [id], ...fields });
// #1178 C1-01: 読み込んだ常連回は面識・在店予定を守り、別IDの同じ客も連日出さない。
assert(byid.baito_tsumugi_art, "つむぎの絵の接客回がロード対象にない");
reset(); db.baito = [byid.baito_tsumugi_art]; await tonari.doBaito(); assert.equal(selected(), undefined);
for (const known of [{ met: { tsumugi: true } }, { flags: { _met_tsumugi: true, _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true } }, { story: { tsumugi: 1 } }]) {
  reset(known); db.baito = [byid.baito_tsumugi_art]; await tonari.doBaito();
  assert.equal(selected(), "baito_baito_tsumugi_art");
}
for (const schedule of [{ day: 8, slot: 1 }, { day: 11, slot: 1 }]) {
  reset({ ...schedule, met: { tsumugi: true } }); db.baito = [byid.baito_tsumugi_art];
  await tonari.doBaito(); assert.equal(selected(), undefined);
}
reset({ met: { tsumugi: true }, baitoRecent: [{ id: "baito_tsumugi_rain", chapter: 1, day: 7, customers: ["tsumugi"] }] });
db.baito = [byid.baito_tsumugi_art]; await tonari.doBaito(); assert.equal(selected(), undefined);
// 未対面つむぎは雨でも閉店でも選ばない。旧進行とmet/flagの各記録なら永久封鎖しない。
reset(); rainy = true; db.baito = [byid.baito_tsumugi_rain]; await tonari.doBaito(); assert.equal(selected(), undefined); assert(plays.some((s) => s.dialogue_id === "remake_baito_routine"));
for (const known of [{ met: { tsumugi: true } }, { flags: { _met_tsumugi: true, _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true } }, { story: { tsumugi: 1 } }]) {
  reset(known); rainy = true; db.baito = [byid.baito_tsumugi_rain]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_tsumugi_rain");
}
reset(); db.baito = [byid.baito_tsumugi_closing]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ day: 6, slot: 1, met: { tsumugi: true } }); db.baito = [byid.baito_tsumugi_closing]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_tsumugi_closing");
// chapter、正/否定flag、set_flag、既読旧記録をすべて尊重。
reset({ chapter: 2 }); db.baito = [byid.baito_mysterious_customer]; await tonari.doBaito(); assert.equal(selected(), undefined);
// #2032: 第2章固有の接客はロード対象で、第1章には出ず第2章で出る。章指定の無い回は第2章にも混ざる。
const ch2Events = events.filter((e) => e.chapter === 2);
assert(ch2Events.length >= 4, "第2章固有の接客がロード対象に4件以上ない");
for (const ev of ch2Events) {
  const slot = ev.time_slot === "night" ? 1 : 0;
  reset({ slot }); db.baito = [ev]; await tonari.doBaito(); assert.equal(selected(), undefined, `${ev.id} が第1章に出た`);
  reset({ chapter: 2, slot }); db.baito = [ev]; await tonari.doBaito(); assert.equal(selected(), `baito_${ev.id}`, `${ev.id} が第2章に出ない`);
}
reset({ chapter: 2 }); db.baito = [byid.baito_mysterious_customer, byid.baito_regular_03]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_regular_03");
reset(); db.baito = [custom("locked", { trigger_flag: "needs_contact" })]; await tonari.doBaito(); assert.equal(selected(), undefined);
state.flags.needs_contact = true; await tonari.doBaito(); assert.equal(selected(), "baito_locked");
reset(); db.baito = [byid.baito_mob_flavor_police]; await tonari.doBaito(); assert(state.flags.ch1_flavor_police_event); plays.length = 0; state.day++;
await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ usedBaito: ["baito_mob_flavor_police"] }); db.baito = [byid.baito_mob_flavor_police]; await tonari.doBaito(); assert.equal(selected(), undefined);
// 同じ常連が複数IDに居ても今日/昨日に再登場しない。当章の履歴4件を記録。
for (const family of ["occhan", "takahashi", "freelancer"]) {
  reset({ baitoRecent: [{ id: "previous", chapter: 1, day: 7, customers: [family] }] }); db.baito = [custom("same_face", { customers: [family] }), custom("different_face")];
  await tonari.doBaito(); assert.equal(selected(), "baito_different_face");
}
reset({ baitoRecent: [{ id: "occhan_before", chapter: 1, day: 7, customers: ["occhan"] }] }); db.baito = [byid.baito_regular_01, byid.baito_smoke_ring, byid.baito_mob_03, byid.baito_regulars_chat, byid.baito_regular_04]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ baitoRecent: [{ id: "repeat", chapter: 1, day: 8, customers: [] }] }); db.baito = [custom("repeat", { customers: [] }), custom("other")]; await tonari.doBaito(); assert.equal(selected(), "baito_other");
reset({ baitoRecent: [{ id: "old", chapter: 1, day: 6, customers: ["occhan"] }] }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_regular_01");
reset({ chapter: 2, baitoRecent: [{ id: "old", chapter: 1, day: 7, customers: ["occhan"] }] }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_regular_01");
reset(); db.baito = Array.from({ length: 6 }, (_, i) => custom(`rotating_${i}`));
for (let i = 0; i < 6; i++) { state.day = 8 + i; await tonari.doBaito(); }
assert.equal(state.baitoRecent.length, 4); assert.equal(state.baitoRecent[0].id, "rotating_2"); assert.equal(state.baitoRecent[3].day, 13);
// 一度きりの初来店/誕生日/初めてコールと、戻ってくる常連を分ける。
const oneOffIds = ["baito_beginner_01", "baito_couple_time", "baito_mob_01", "baito_mob_02", "baito_jiro_call"];
for (const id of oneOffIds) { reset({ usedBaito: [id] }); db.baito = [byid[id], byid.baito_regular_01]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_regular_01"); }
reset({ usedBaito: ["baito_regular_01"] }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_regular_01");
// 昼に閉店回、夜に昼下がり回を出さない。晴れに雨回を出さない。
for (const id of ["baito_closing_smoke", "baito_closing_late", "baito_atmosphere_03"]) { reset(); db.baito = [byid[id]]; await tonari.doBaito(); assert.equal(selected(), undefined); reset({ slot: 1 }); db.baito = [byid[id]]; await tonari.doBaito(); assert.equal(selected(), `baito_${id}`); }
reset({ slot: 1 }); db.baito = [byid.baito_atmosphere_02]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset(); db.baito = [byid.baito_rainy_day]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset(); rainy = true; db.baito = [byid.baito_regular_01, byid.baito_rainy_day]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_rainy_day");
// chapter1の正体を伏せた3客はそれぞれ一度きり、chapter2に持ち越さない。
reset({ day: 6, baitoCount: 1, flags: {} }); db.baito = [byid.baito_regular_01];
await tonari.doBaito(); await tonari.doBaito(); await tonari.doBaito(); await tonari.doBaito();
for (const scene of ["ch1_rei_cameo", "ch1_reviewer_cameo", "ch1_maezono_cameo"]) assert.equal(plays.filter((s) => s === scene).length, 1);
reset({ chapter: 2, baitoCount: 1, flags: {} }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert(!plays.includes("ch1_rei_cameo"));
// 報酬/choicesは保持。昼シフト後のUIと台本にレジ締めや閉店を持ち込まない。
reset(); db.baito = [byid.baito_regular_01]; await tonari.doBaito({ called: true }); assert.equal(money[0], 13000); assert(!JSON.stringify(menus).includes("閉店"));
// 体力の消耗後の色で制作の売上上乗せを決める。基本給・急なシフト・雨の手当は維持。
for (const [stamina, expectedPay, expectedChoice] of [[75, 15075, 2300], [74, 14000, 2000], [49, 13750, 1000], [24, 13750, 1000]]) {
  reset({ stamina }); charmStep = 3; rainy = true;
  db.baito = [custom("condition", { choices: [{ text: "作る", result: "一台を仕上げた", stats: { technique: 3 }, money_bonus: 2000 }] })];
  await tonari.doBaito({ called: true });
  assert.equal(money[0], expectedPay, `Shift condition at stamina=${stamina}`);
  const reward = plays.find((scene) => scene.dialogue_id === "baito_condition").branches.c0.at(-1);
  assert.equal(reward.money, expectedChoice);
  assert.equal(reward.stats.technique, 3);
}
reset({ stamina: 24 }); db.baito = []; await tonari.doBaito(); assert.equal(money[0], 8000, "Exhaustion cut the guaranteed base wage");
// #1081 B05: シフト上がりのスミ会話は必須で、メニューに選択肢は無い。
// 統合spots.jsの夜限定gateをそのまま使い、昼は夜限定の固有会話（ch1_sumi_training）を
// 流さず定型の一言にし、夜は固有会話を流して既読（story）を進める。
db.dialogues = Object.fromEntries([...scenes, ...sumi].map((s) => [s.dialogue_id, s]));
reset({ story: { sumi: 2 }, affinity: { sumi: 20 } }); db.baito = [byid.baito_regular_01]; await tonari.doBaito();
assert(plays.includes("remake_sumi_after_shift"), "昼のシフト上がりは定型の一言");
assert(!plays.includes("ch1_sumi_training"), "昼は夜限定の固有会話を流さない");
assert.equal(state.story.sumi, 2, "定型の一言では既読を進めない");
assert(!JSON.stringify(menus).includes("スミさんと話す"), "シフト上がりメニューにスミ会話の選択肢は無い");
reset({ slot: 1, story: { sumi: 2 }, affinity: { sumi: 20 } }); db.baito = [byid.baito_regular_01]; await tonari.doBaito();
assert(plays.includes("ch1_sumi_training"), "夜のシフト上がりは固有会話を流す");
assert(!plays.includes("remake_sumi_after_shift"), "固有会話がある日は定型の一言にしない");
assert.equal(state.story.sumi, 3, "固有会話の既読が進む");

const handoff = scenes.find((s) => s.dialogue_id === "remake_delivery_minto_handoff");
assert(handoff && /peppermint/.test(handoff.metadata.bg) && /この後よかったら/.test(JSON.stringify(handoff)));
assert.equal(handoff.lines[0].speaker, "minto");
assert(!/bg_street|到着した|看板を確かめ|ドアを|店内に入ると/.test(JSON.stringify(handoff)));
assert(!/一服してって|どうぞ、こっちへ/.test(JSON.stringify(handoff)), "Delivery must not auto-enter PEPPERMINT");
const mintoFirst = JSON.parse(await fs.readFile(new URL("data/dialogue/ch1_minto.json", dataRoot), "utf8")).dialogues.find((d) => d.dialogue_id === "ch1_minto_first");
assert(mintoFirst?.branches?.dl_door?.some((line) => /配達してくれた/.test(line.text || "")));
assert(!mintoFirst.branches.dl_door.some((line) => /三袋を/.test(line.text || "")), "Delivery should not replay on first voluntary visit");
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
  plays.length = 0;
  db.baito = [byid.baito_tsumugi_rain]; rainy = true;
  await tonari.doBaito();
  assert.equal(selected() === "baito_baito_tsumugi_rain", present);
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
plays.length = 0; rainy = true; db.baito = [byid.baito_tsumugi_rain];
await tonari.doBaito();
assert.equal(selected(), undefined, "昼に会ったつむぎが夜の接客候補へ戻った");
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
for (const event of events) {
  if (event.time_slot !== "night") assert(!/金曜の夜|土曜の夜|夕方6時|毎週木曜|閉店後/.test(JSON.stringify(event)), event.id);
  assert(Array.isArray(event.customers));
}
console.log("[remake daily] customer flags/chapter/weather/time, legacy one-off history, recurring families, four records, cameos, shift-time copy: PASS");

// 隣町からの私用の客。実際の抽選・地図・読了記録を使い、料金や好感度は増やさない。
const cityModule = await load("city-guests.js"); await cityModule.evaluate();
const cityGuests = cityModule.namespace;
const guestScript = JSON.parse(await fs.readFile(new URL("data/dialogue/ch2_city_guests.json", dataRoot), "utf8")).dialogues;
const guestIds = ["ageha", "kumicho", "rei"];
const guestSpots = { ageha: "minto", kumicho: "adam", rei: "tonari" };
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
