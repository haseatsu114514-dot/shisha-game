// 本番tonariシフトをVMで実行。接客条件・一度限り・同じ客の連日登場・昼の閉店矛盾を検証。
// node --experimental-vm-modules remake/test/daily_consistency.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const root = new URL("../", import.meta.url), dataRoot = new URL("../../", import.meta.url);
const baitoData = JSON.parse(await fs.readFile(new URL("data/baito_events.json", dataRoot), "utf8"));
const categories = new Set(["beginner", "mob", "atmosphere", "regular", "rush", "trouble"]);
const events = baitoData.events.filter((e) => categories.has(e.category));
const scenes = JSON.parse(await fs.readFile(new URL("data/dialogue/remake_ch1.json", dataRoot), "utf8")).dialogues;
const sumi = JSON.parse(await fs.readFile(new URL("data/dialogue/ch1_sumi.json", dataRoot), "utf8")).dialogues;
const state = {}, db = { baito: events, dialogues: {} }, plays = [], money = [], menus = [];
let rainy = false, selectedPools = [];
class Element { constructor(spec) { this.spec = spec; this.children = []; this.dataset = {}; } append(...nodes) { this.children.push(...nodes.flat().filter(Boolean)); } }
function el(spec, attrs = {}, children = []) { if (Array.isArray(attrs)) { children = attrs; attrs = {}; } const node = new Element(spec); Object.assign(node, attrs); node.append(children); return node; }
function find(node, id) { if (node.dataset?.test === id) return node; return node.children?.map((child) => find(child, id)).find(Boolean); }
const values = {
  "util.js": { el, pick: (pool) => { selectedPools.push(pool.map((e) => e.id)); return pool[0]; } },
  "data.js": { DB: db, bgUrl: () => "bg" },
  "ui.js": { showScreen: (_, node) => { menus.push(node); Promise.resolve().then(() => find(node, "after-none")?.onclick()); return node; }, setBg() {}, toast() {}, retire() {} },
  "state.js": { state, timeOfDay: () => state.slot === 0 ? "day" : "night", markMet() {} },
  "stats.js": { addMoney: (value) => money.push(value), addStamina() {}, applyStats() {}, star: () => 1, gainAffinity() {}, gainStat() {}, affinityLevel: () => 0 },
  "audio.js": { SE: { select() {}, cancel() {} }, playBgm() {} },
  "engine.js": { play: async (scene) => plays.push(scene) },
  "session.js": { runDrill: async () => 0, DRILLS: {} },
  "kafuka.js": { kafukaSpot: () => null },
  "bonds.js": { afterStory: async () => {}, questionVisitDue: () => false, playQuestionVisit: async () => {}, finaleAtVisit: () => false, playFinale: async () => false },
  "weather.js": { isRainy: () => rainy, RAIN_BAITO: ["baito_rainy_day", "baito_tsumugi_rain"], RAIN_BAITO_BONUS: 500, RAIN_SPOT_TEXTS: {} },
};
const context = vm.createContext({ Math, Set, Promise, console }); const mods = new Map();
async function load(name) { if (mods.has(name)) return mods.get(name); const mod = values[name]
  ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
  : new vm.SourceTextModule(await fs.readFile(new URL(`js/daily/${name}`, root), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod; }
const module = await load("tonari.js"); await module.evaluate(); const tonari = module.namespace;
const byid = Object.fromEntries(events.map((e) => [e.id, e]));
function reset(overrides = {}) { Object.keys(state).forEach((key) => delete state[key]); Object.assign(state, { chapter: 1, day: 8, slot: 0, flags: { _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true }, notes: {}, met: {}, story: {}, usedBaito: [], baitoRecent: [], baitoCount: 10, best: {} }, overrides);
  db.baito = events; rainy = false; plays.length = 0; money.length = 0; menus.length = 0; selectedPools = []; }
function selected() { return plays.find((scene) => typeof scene === "object" && scene.dialogue_id?.startsWith("baito_"))?.dialogue_id; }
const custom = (id, fields = {}) => ({ id, category: "regular", text: "注文を受けた", choices: [], customers: [id], ...fields });
// 未対面つむぎは雨でも閉店でも選ばない。旧進行とmet/flagの各記録なら永久封鎖しない。
reset(); rainy = true; db.baito = [byid.baito_tsumugi_rain]; await tonari.doBaito(); assert.equal(selected(), undefined); assert(plays.some((s) => s.dialogue_id === "remake_baito_routine"));
for (const known of [{ met: { tsumugi: true } }, { flags: { _met_tsumugi: true, _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true } }, { story: { tsumugi: 1 } }]) {
  reset(known); rainy = true; db.baito = [byid.baito_tsumugi_rain]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_tsumugi_rain");
}
reset(); db.baito = [byid.baito_tsumugi_closing]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ slot: 1, met: { tsumugi: true } }); db.baito = [byid.baito_tsumugi_closing]; await tonari.doBaito(); assert.equal(selected(), "baito_baito_tsumugi_closing");
// chapter、正/否定flag、set_flag、既読旧記録をすべて尊重。
reset({ chapter: 2 }); db.baito = [byid.baito_mysterious_customer]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset(); db.baito = [custom("locked", { trigger_flag: "needs_contact" })]; await tonari.doBaito(); assert.equal(selected(), undefined);
state.flags.needs_contact = true; await tonari.doBaito(); assert.equal(selected(), "baito_locked");
reset(); db.baito = [byid.baito_mob_flavor_police]; await tonari.doBaito(); assert(state.flags.ch1_flavor_police_event); plays.length = 0; state.day++;
await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ usedBaito: ["baito_mob_flavor_police"] }); db.baito = [byid.baito_mob_flavor_police]; await tonari.doBaito(); assert.equal(selected(), undefined);
reset({ notes: { baito_mob_flavor_police: 1 } }); db.baito = [byid.baito_mob_flavor_police]; await tonari.doBaito(); assert.equal(selected(), undefined);
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
// 統合spots.jsの夜限定gateをそのまま使い、昼のシフト上がりで夜限定固有会話を案内しない。
reset({ story: { sumi: 2 } }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert(JSON.stringify(menus).includes("落ち着いた一台")); assert(!JSON.stringify(menus).includes("今日は何か教えて"));
reset({ slot: 1, story: { sumi: 2 } }); db.baito = [byid.baito_regular_01]; await tonari.doBaito(); assert(JSON.stringify(menus).includes("今日は何か教えて"));
const end = scenes.find((s) => s.dialogue_id === "remake_baito_end"); assert(!/レジを締め|閉店/.test(JSON.stringify(end)));
assert(!JSON.stringify(scenes.find((s) => s.dialogue_id === "remake_repeat_sumi_1")).includes("静かな夜"));
const closing = sumi.find((s) => s.dialogue_id === "ch1_sumi_closing"); assert(JSON.stringify(closing).includes("閉店後"));
for (const id of ["ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_final"]) assert(JSON.stringify(sumi.find((s) => s.dialogue_id === id)).includes("閉店後"), id);
assert(JSON.stringify(sumi.find((s) => s.dialogue_id === "ch1_sumi_eve")).includes("大会前夜"));
for (const event of events) {
  if (event.time_slot !== "night") assert(!/金曜の夜|土曜の夜|夕方6時|毎週木曜|閉店後/.test(JSON.stringify(event)), event.id);
  assert(Array.isArray(event.customers));
}
console.log("[remake daily] customer flags/chapter/weather/time, legacy one-off history, recurring families, four records, cameos, shift-time copy: PASS");
