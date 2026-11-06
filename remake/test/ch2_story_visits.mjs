// VOL13: 第2章のDAY7のアダム・DAY12の夜のみんとは、地図の店を選んだ行動で読む本編（夜は期限の救済だけ）。
// 実 ch2-preparation / ch2-story / ch2-story-data で、来店の分岐・精算・中断・地図の「！」を確かめる。
// 初日に続けて読んでいた街の遊び場の紹介（実 ch2-outings）は、その店へ初めて通った時に読む。
// node --experimental-vm-modules remake/test/ch2_story_visits.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const dialogues = Object.fromEntries(["ch2_isolation", "ch2_main", "ch2_ageha_story", "remake_ch2", "ch2_choice_echoes", "ch2_preparation", "ch2_deliveries"]
  .flatMap(file => JSON.parse(read(`data/dialogue/${file}.json`)).dialogues).map(d => [d.dialogue_id, d]));
const START = 15, abs = day => START + day - 1;
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
let state, played, mode, saves, visitDue, lessons, prepDue = null;
const DB = { dialogues };
const statePort = new vm.SyntheticModule(["state", "save", "markMet", "timeOfDay"], function () {
  this.setExport("state", state); this.setExport("save", () => saves++);
  this.setExport("markMet", id => { state.met[id] = true; }); this.setExport("timeOfDay", () => state.slot ? "night" : "day");
}, { context });
const mocks = {
  "remake/js/core/data.js": { DB, bgUrl: x => x },
  "remake/js/core/travel-budget.js": { spendableMoney: value => value.money },
  "remake/js/chapters/ch2-commute.js": { normalizeCommuteState() {}, chooseMorningCity: async () => {}, returnCityHome: async () => {} },
  "remake/js/core/city-locations.js": { CH2_CITY_NAME: "柚ヶ谷", HOME_CITY_NAME: "橙須", CITY_BACKGROUNDS: { c_station_night: "c" },
    CH2_SCENE_BACKGROUNDS: { naruWindow: "res://assets/backgrounds/bg_kemurikusa_outside_night.png", venueBench: "bench" } },
  "remake/js/core/stats.js": { affinityLevel: () => 1, releaseAffinity: () => 0,
    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; },
    earnStat: (id, n) => { state.growth.push([id, n]); }, gainAffinity: (id, n) => { state.affinity.push([id, n]); },
    visitAffinity: kind => ({ story: 16, talk: 8 })[kind] }, // 来店の好感度（AFB01）
  "remake/js/core/ui.js": { withScenePreparation: task => task, imageReady: async () => true, setBg: async () => {}, toast: () => {} },
  "remake/js/vn/engine.js": { play: async (id, opts) => {
    played.push([id, opts?.bg || null]);
    if (mode === "cancel" && id === "ch2_naru_window") return { cancelled: true };
    if (mode === "cancel-intro" && /_(trpg|aquarium|sento)$/.test(id)) return { cancelled: true };
    if (mode === "replace-state") { state = fresh(); statePort.setExport("state", state); }
    return { id };
  } },
  "remake/js/daily/calendar.js": { runDaily: async def => { state.def = def; } },
  "remake/js/daily/spots.js": { allSpots: () => [{ id: "tonari", kind: "tonari" }], VISIT_COST: 3000,
    isClosed: spot => spot.closedOn !== undefined && state.day % 7 === spot.closedOn,
    CHAR_STAT: { adam: "guts", minto: "charm" }, VISIT_BG: { adam: "bg_eden_shop", minto: "peppermint" },
    bgRef: name => `res://assets/backgrounds/${name}.png`, setChapterVisitDue: fn => { visitDue = fn; }, hasNewEvent: () => false },
  "remake/js/daily/hiyori.js": { setHiyoriExtraShops: () => {} },
  "remake/js/daily/roamers.js": { addRoamerSpots: () => {} }, // よその店に居合わせる人（第2章は柚ヶ谷の店も登録する）
  "remake/js/daily/trpg.js": { trpgSpot: () => null, maybeRecruitTrpgMember: async () => false },
  "remake/js/daily/shop.js": { openShop: async () => null },
  "remake/js/chapters/ch2-purikura.js": { offerAgehaPurikura: async () => true },
  "remake/js/daily/bonds.js": { BOND_QUESTIONS: { ageha: {} }, BOND_FINALES: {}, playQuestionVisit: async () => true,
    questionVisitDue: () => false, finaleAtVisit: () => false, playFinale: async () => true },
  "remake/js/core/trpg-discovery.js": { knowsTrpgBar: value => !!value?.flags?._rei_trpg_introduced },
  "remake/js/chapters/ch2-city-data.js": { MAP: { day: "map", night: "night" }, STOPS: [],
    ROOMS: { ageha: "room_ageha", kumicho: "room_kumicho", rei: "room_rei" } },
  "remake/js/chapters/ch2-progress.js": { dayOneProgress: () => ({ startDay: START }), recordCityVisit: () => {} },
  "remake/js/chapters/ch2-strawberry-trial.js": { grantStrawberrySample: () => {} },
  "remake/js/chapters/ch2-lime.js": { recordSentLime: () => false },
  "remake/js/core/growth.js": { consultLessons: async id => { lessons.push(id); return []; } },
  "remake/js/core/chapter-data.js": { readDialogues: async () => ({}) },
  "remake/js/core/affinity-stages.js": { AGEHA_AFFINITY_VISITS: [], CH2_VISIT_STORIES: {}, ch2VisitDone: () => false, ch2VisitReady: () => true },
  "remake/js/chapters/ch2-craft-prep.js": { craftPrepDue: () => prepDue, offerCraftPrep: async () => ({ used: true, exerted: true }) },
};
const REAL = ["remake/js/chapters/ch2-preparation.js", "remake/js/chapters/ch2-story.js", "remake/js/chapters/ch2-story-data.js", "remake/js/chapters/ch2-outings.js"];
const modules = new Map([["remake/js/core/state.js", statePort]]);
async function moduleAt(p) {
  if (modules.has(p)) return modules.get(p);
  let m;
  if (REAL.includes(p)) {
    m = new vm.SourceTextModule(read(p), { context, identifier: p });
    modules.set(p, m);
    await m.link(spec => moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(p), spec))));
    return m;
  }
  const exports = mocks[p]; assert(exports, `unmocked import ${p}`);
  m = new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
  modules.set(p, m);
  return m;
}
const prep = await moduleAt(REAL[0]); await prep.evaluate();
const { runChapterTwoPreparation } = prep.namespace;

function fresh() {
  return { chapter: 2, phase: "daily", day: abs(7), slot: 0, money: 20000, stamina: 100, met: {}, visits: {}, growth: [], affinity: [],
    contacts: [], flags: { _ch2_day1: { startDay: START } }, deferredNightEvents: [] };
}
async function setup(patch = {}) {
  state = Object.assign(fresh(), patch); statePort.setExport("state", state);
  played = []; mode = "ok"; saves = 0; lessons = [];
  await runChapterTwoPreparation();
}
const EDEN = { id: "adam", kind: "rival", charId: "adam", cost: 3000, stamina: -16, closedOn: 5 };
const PEPPERMINT = { id: "minto", kind: "rival", charId: "minto", cost: 3000, stamina: -16, closedOn: 6 };
const go = (spot, guard = true) => state.def.performSpot(spot, { staminaGuard: async () => guard });
const plain = v => JSON.parse(JSON.stringify(v));

// DAY7: EDENを選ぶと、その来店でアダムの本編を読む。料金・体力・能力・好感度は通常の来店と同じ
await setup();
assert.equal(visitDue("adam"), true, "地図のEDENに「！」");
assert.equal(visitDue("minto"), false);
let result = await go(EDEN);
assert.deepEqual(plain(result), { used: true, exerted: true });
assert.deepEqual(played, [["ch2_adam_distance", "res://assets/backgrounds/bg_eden_shop.png"]]);
assert.equal(state.money, 17000); assert.equal(state.stamina, 84);
assert.deepEqual(plain(state.affinity), [], "Mandatory scenes give no affinity"); assert.deepEqual(plain(state.growth), [["guts", 4]]);
assert(state.flags._ch2_read_ch2_adam_distance && state.flags._ch2_night_7_done && state.flags._spot_guide_adam);
assert.equal(state.visits.adam, 1); assert.equal(state.met.adam, true); assert.deepEqual(lessons, ["adam"]);
assert.equal(saves, 1, "精算と保存は calendar に任せる（準備開始の保存だけ）");
assert.equal(visitDue("adam"), false, "読んだら「！」は消える");
assert.equal(await go(EDEN), null, "二度目は通常の来店（calendar の visitRival）へ");

// 定休日・体力の確認で戻る・所持金不足では、読まずに何も変えない
for (const [label, patch, guard] of [["closed", { day: abs(12) }, true], ["guard", {}, false], ["money", { money: 100 }, true]]) {
  await setup(patch);
  const before = plain(state);
  assert.deepEqual(plain(await go(EDEN, guard)), { used: false, exerted: false }, label);
  assert.deepEqual(plain(state), before, `${label}: no read, no payment`); assert.deepEqual(played, []);
}

// DAY6は早い、DAY13は期限の救済を過ぎている。隣町や他の店は従来どおり
await setup({ day: abs(6) }); assert.equal(await go(EDEN), null); assert.equal(visitDue("adam"), false);
await setup({ day: abs(13) }); assert.equal(await go(EDEN), null);
await setup(); await go({ ...EDEN, id: "ch2_ageha", region: "widehanga", charId: "ageha" });
assert(!played.some(([id]) => id === "ch2_adam_distance"), "隣町の店は第2章の通い訪問のまま");
await setup({ chapter: 3 }); assert.equal(visitDue("adam"), false, "第2章だけ");

// DAY12: みんとは夜の来店だけ。DAY11の選択があれば、帰り道の閉じたケムリクサまで同じ来店で読む
await setup({ day: abs(12) });
assert.equal(visitDue("minto"), false); assert.equal(await go(PEPPERMINT), null, "昼はいつもの来店");
state.slot = 1; state.flags._ch2_naru_hurt = true;
assert.equal(visitDue("minto"), true);
result = await go(PEPPERMINT);
assert.equal(result.used, true);
assert.deepEqual(played, [["ch2_minto_warning", null], ["ch2_naru_window", "res://assets/backgrounds/bg_kemurikusa_outside_night.png"]],
  "台本の背景（PEPPERMINT）と、帰り道のケムリクサ");
assert(state.flags._ch2_read_ch2_minto_warning && state.flags._ch2_read_ch2_naru_window && state.flags._ch2_night_12_done);
assert.deepEqual(plain(state.affinity), [], "Mandatory scenes give no affinity");

// 途中で中断・LOADしたら、既読も料金も残さない（期限の夜に読み直せる）
await setup({ day: abs(12), slot: 1 }); state.flags._ch2_naru_listened = true; mode = "cancel";
let before = plain(state);
assert.deepEqual(plain(await go(PEPPERMINT)), { used: false, exerted: false });
assert.deepEqual(plain(state), before, "cancel keeps nothing");
await setup(); mode = "replace-state";
const old = state; before = plain(state);
assert.deepEqual(plain(await go(EDEN)), { used: false, exerted: false });
assert.deepEqual(plain(old), before, "LOAD target must receive no old action effects");

// tonariの大会準備（ch2-craft-prep.js）: 期間中は地図の tonari に「！」、tonari を選ぶと準備の問いを先に出す
await setup();
const tonari = () => state.def.mapOptions().regions.find(region => region.id === "home").spots().find(spot => spot.id === "tonari");
assert.equal(tonari().hasNew(), false);
prepDue = { id: "basics" };
assert.equal(tonari().hasNew(), true);
assert.deepEqual(plain(await go({ id: "tonari", kind: "tonari" })), { used: true, exerted: true });
prepDue = null;
assert.equal(await go({ id: "tonari", kind: "tonari" }), null, "no prep: the usual tonari menu");

// 夜の予定表: 訪問の本編は自分の日の夜を塞がず、期限の夜に救済する
await setup();
const nights = state.def.nightEvents;
assert.equal(nights[abs(7)].schedule, "visit"); assert.equal(nights[abs(7)].deadline, abs(12));
assert.equal(nights[abs(12)].schedule, "visit"); assert.equal(nights[abs(12)].deadline, abs(12));
assert.equal(nights[abs(6)].schedule, "preparation");
// 街の遊び場の紹介: 初日の配達では読まず、DAY2以降にその店へ初めて通った回の最後に読んで地図へ出す
for (const [charId, intro, flag] of [["rei", "remake_ch2_rei_trpg", "_rei_trpg_introduced"],
  ["ageha", "remake_ch2_ageha_aquarium", "_ageha_aquarium_introduced"], ["kumicho", "remake_ch2_kumicho_sento", "_kumicho_sento_introduced"]]) {
  await setup({ day: abs(2), met: { [charId]: true } });
  const shop = { id: `ch2_${charId}`, kind: "rival", charId, region: "widehanga", cost: 3000, stamina: -16 };
  assert.equal((await go(shop)).used, true);
  assert.deepEqual(played.map(([id]) => id), [`remake_ch2_${charId}_chat`, intro], `${charId}: the first own visit ends with the introduction`);
  assert.equal(state.flags[flag], true);
  played = []; await go(shop);
  assert(!played.some(([id]) => id === intro), `${charId}: the introduction is read once`);
  // 紹介の途中で中断したら、紹介も来店も残さない
  await setup({ day: abs(2), met: { [charId]: true } }); mode = "cancel-intro";
  const before = plain(state);
  assert.equal((await go(shop)).used, false);
  assert.deepEqual(plain(state), before, `${charId}: cancelled introduction keeps nothing`);
}
// 第3・4章の出発前の準備期間（同じ visitPreparationSpot）では、未紹介でも紹介を読まない（毎回の読み直しを防ぐ）
await setup({ chapter: 3, met: { rei: true } });
await go({ id: "ch2_rei", kind: "rival", charId: "rei", region: "widehanga", cost: 3000, stamina: -16 });
assert(!played.some(([id]) => id === "remake_ch2_rei_trpg"), "no city introduction outside chapter 2");
const intro = dialogues.remake_ch2_ageha_aquarium.lines.map(line => line.text).join("\n");
assert(!/初めて|配達|会場はあっち|大会/.test(intro), "the aquarium introduction no longer assumes DAY1 or the tournament");

console.log("PASS ch2 story visits: EDEN DAY7-11 and PEPPERMINT DAY12 night as visits, settlement, cancel/LOAD, badge, schedule, city introductions on the first own visit");
