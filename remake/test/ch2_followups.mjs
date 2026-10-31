// Actual preparation/loader modules with isolated dependencies; browser suite covers calendar settlement.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { scheduleChapterTwoTrpgNight } from "../js/chapters/ch2-progress.js";

const root = new URL("../../", import.meta.url);
const preparation = JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_preparation.json", root)));
const stories = ["ch2_kumicho", "ch2_rei"].flatMap(name => JSON.parse(fs.readFileSync(new URL(`data/dialogue/${name}.json`, root))).dialogues);
const all = Object.fromEntries([...preparation.dialogues, ...stories].map(d => [d.dialogue_id, d]));
const stagesSource = fs.readFileSync(new URL("remake/js/core/affinity-stages.js", root), "utf8");
const { CH2_VISIT_STORIES, ch2VisitDone } = await import(new URL("remake/js/core/affinity-stages.js", root));
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
let state, options, played, saves, mode, resolvePlay, heartLevel = 1;
const ids = ["ageha", "kumicho", "rei"];
const DB = { dialogues: { ...all } };
const states = new vm.SyntheticModule(["state", "save", "markMet", "timeOfDay"], function () {
  this.setExport("state", state);
  this.setExport("save", () => saves++);
  this.setExport("markMet", id => { state.met[id] = true; });
  this.setExport("timeOfDay", () => "day");
}, { context });
const mocks = {
  "../core/travel-budget.js": { spendableMoney: value => value.money },
  "./ch2-commute.js": { normalizeCommuteState() {}, chooseMorningCity: async () => {}, returnCityHome: async () => {} },
  "../core/data.js": { DB, bgUrl: x => x },
  "../core/city-locations.js": { CH2_CITY_NAME: "柚ヶ谷", HOME_CITY_NAME: "橙須" },
  "../core/stats.js": {
    affinityLevel: () => heartLevel,

    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; },
    earnStat: (id, n) => { state.growth.push([id, n]); }, gainAffinity: (id, n) => { state.affinity.push([id, n]); },
  },
  "../core/ui.js": { withScenePreparation: task => task, imageReady: async () => mode !== "bad-image", setBg: async () => {}, toast: () => {} },
  "../vn/engine.js": { play: async id => {
    played.push(id);
    if (mode === "cancel") return { cancelled: true };
    if (mode === "undefined") return;
    if (mode === "throw") throw Error("injected play failure");
    if (mode === "pending") return new Promise(resolve => { resolvePlay = resolve; });
    if (mode === "replace-state") { state = fresh(9); states.setExport("state", state); }
    return { id, visited: [id] };
  } },
  "../daily/calendar.js": { runDaily: async def => { options = def; } },
  "../daily/spots.js": { allSpots: () => [], VISIT_COST: 3000 },
  "../daily/hiyori.js": { setHiyoriExtraShops: () => {} },
  "../daily/trpg.js": { trpgSpot: () => null },
  "../daily/shop.js": { openShop: async () => null },
  "./ch2-purikura.js": { offerAgehaPurikura: async () => true },
  // あげはの♥3の質問（#1988）は affinity_stages.mjs で確認する。ここでは質問が無い通常訪問だけを見る
  "../daily/bonds.js": { BOND_QUESTIONS: { ageha: { host: "remake_ch2_ageha_newcomer", dialogue: "ch2_ageha_bond_question" } },
    playQuestionVisit: async () => true, questionVisitDue: () => false },
  "./ch2-outings.js": { CITY_OUTINGS: [], CITY_SHOP: { id: "ch2_shop" }, knownCityOutings: () => [], introduceCitySpot: () => false, outingDialogue: () => null, recordOutingVisit: () => {} },
  "./ch2-city-data.js": { MAP: { day: "map" }, STOPS: ids.map(id => ({ id, name: id })), ROOMS: Object.fromEntries(ids.map(id => [id, id])) },
  "./ch2-progress.js": { dayOneProgress: () => ({ startDay: 15 }), recordCityVisit: () => {}, scheduleChapterTwoTrpgNight },
  "./ch2-story.js": { chapterTwoNights: () => ({}) },
  // あげはの店に通う回は ch2_ageha_story.mjs で確認する。ここでは従来の chat/followup/repeat だけを見る
  "./ch2-story-data.js": { agehaStoryScene: () => null, syncAgehaVibes: () => 0 },
};
const module = new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/chapters/ch2-preparation.js", root), "utf8"), { context });
await module.link(async specifier => {
  if (specifier === "../core/state.js") return states;
  if (specifier === "../core/affinity-stages.js") return new vm.SourceTextModule(stagesSource, { context });
  const exports = mocks[specifier]; assert(exports, specifier);
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await module.evaluate();
function fresh(count) {
  return { money: 20000, stamina: 100, met: Object.fromEntries(ids.map(id => [id, true])), visits: { ageha: 80 },
    contacts: ["old-contact"], growth: [], affinity: [], relationshipMemories: ["old-memory"], lovers: ["minto"],
    flags: { ...(count === undefined ? {} : { _ch2_talks: Object.fromEntries(ids.map(id => [id, count])) }), old: true } };
}
async function setup(count) {
  if (!arguments.length) count = 1;
  heartLevel = 1;
  state = fresh(count); states.setExport("state", state); played = []; saves = 0; mode = "ok";
  DB.dialogues = { ...all }; resolvePlay = null;
  await module.namespace.runChapterTwoPreparation();
}
function visit(id, guard = true) { return options.performSpot(module.namespace.PREPARATION_SPOTS.find(s => s.charId === id), { staminaGuard: async () => guard }); }
for (const id of ids) {
  for (const count of [undefined, 0, 1, 17]) {
    await setup(count);
    const first = !count, expected = `remake_ch2_${id}_${first ? "chat" : "followup"}`;
    const before = structuredClone(state);
    const result = await visit(id);
    assert.equal(result.used, true); assert.equal(played.at(-1), expected);
    assert.equal(state.money, before.money - 3000); assert.equal(state.stamina, 84);
    assert.equal(state.flags._ch2_talks[id], (count || 0) + 1);
    assert.equal(!!state.flags._ch2_followup_done?.[id], !first);
    assert.deepEqual(state.affinity, [[id, first ? 10 : 5]]);
    assert.deepEqual(state.relationshipMemories, before.relationshipMemories); assert.deepEqual(state.lovers, before.lovers);
    assert.equal(saves, 1, "Visit must not insert an early save before calendar settlement");
    if (first) { await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_followup`); }
    if (id !== "ageha") {
      // #1648: 続編の後は訪問列の最古未読を一本ずつ。ハートが届くまではrepeatで、先の段階へ飛ばない。
      state.money += 60000; // 列の全段階とrepeatを通す代金
      for (const entry of CH2_VISIT_STORIES[id].slice(1)) {
        heartLevel = entry.heart - 1; await visit(id);
        assert.equal(played.at(-1), `remake_ch2_${id}_repeat`, `${entry.scene} waits for ♥${entry.heart}`);
        assert.equal(ch2VisitDone(state.flags, id, entry), false);
        heartLevel = entry.heart; const money = state.money; await visit(id);
        assert.equal(played.at(-1), entry.scene); assert.equal(ch2VisitDone(state.flags, id, entry), true);
        assert.equal(state.money, money - 3000);
      }
      assert.equal(state.flags._ch2_revisit_done[id], true);
      heartLevel = 5;
    }
    await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_repeat`);
    await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_repeat`, "Every visit story is read only once");
  }
  for (const failure of ["cancel", "undefined", "throw", "bad-image", "bad-dialogue", "missing-dialogue", "guard"]) {
    await setup(); mode = failure;
    if (failure === "bad-dialogue") DB.dialogues[`remake_ch2_${id}_followup`] = { lines: [{ type: "apply", stats: { sense: 8 } }] };
    if (failure === "missing-dialogue") delete DB.dialogues[`remake_ch2_${id}_followup`];
    const before = structuredClone(state);
    if (failure === "throw") await assert.rejects(visit(id), /injected/);
    else assert.equal((await visit(id, failure !== "guard")).used, false);
    assert.deepEqual(state, before, `${id}: ${failure} must leave the entire action state unchanged`);
  }
  if (id !== "ageha") for (const failure of ["cancel", "undefined", "replace-state", "throw", "bad-image", "missing-dialogue", "bad-dialogue"]) {
    await setup(); await visit(id); mode = failure; heartLevel = 2;
    for (const entry of CH2_VISIT_STORIES[id].filter(entry => entry.file && entry.heart < 2)) state.flags[`_ch2_read_${entry.scene}`] = true;
    if (failure === "missing-dialogue") delete DB.dialogues[`remake_ch2_${id}_revisit`];
    if (failure === "bad-dialogue") DB.dialogues[`remake_ch2_${id}_revisit`] = { lines: [{ type: "apply", stats: { sense: 8 } }] };
    const old = state, before = structuredClone(state);
    if (failure === "throw") await assert.rejects(visit(id), /injected/);
    else assert.equal((await visit(id)).used, false);
    // 続編の既読（VM内で作られたオブジェクト）を含むため、値だけをJSONで比べる。
    assert.equal(JSON.stringify(old), JSON.stringify(before), `${id}: ${failure} during the revisit leaves money/stamina/read state unchanged`);
    assert.equal(old.flags._ch2_revisit_done?.[id], undefined);
    mode = "ok";
  }
  // 長い段階会話（味の学習を含む）も、途中終了・LOAD・失敗では請求も既読も残さない。
  if (id !== "ageha") for (const failure of ["cancel", "undefined", "replace-state", "throw", "bad-image", "missing-dialogue"]) {
    await setup(); await visit(id); mode = failure;
    const scene = CH2_VISIT_STORIES[id][1].scene;
    if (failure === "missing-dialogue") delete DB.dialogues[scene];
    const old = state, before = structuredClone(state);
    if (failure === "throw") await assert.rejects(visit(id), /injected/);
    else assert.equal((await visit(id)).used, false);
    assert.equal(JSON.stringify(old), JSON.stringify(before), `${id}: ${failure} during ${scene} leaves money/stamina/read state unchanged`);
    assert.equal(old.flags[`_ch2_read_${scene}`], undefined);
    mode = "ok";
  }
  await setup(); mode = "pending";
  const before = structuredClone(state), pending = visit(id);
  for (let n = 0; n < 10 && !resolvePlay; n++) await Promise.resolve();
  assert(resolvePlay); assert.deepEqual(state, before, "Entering/last line display is not completion");
  resolvePlay({ id: `remake_ch2_${id}_followup` }); await pending;
  assert(state.flags._ch2_followup_done[id]);
  await setup(); mode = "replace-state";
  const old = state, oldBefore = structuredClone(state);
  assert.equal((await visit(id)).used, false);
  assert.deepEqual(old, oldBefore); assert.deepEqual(state, fresh(9), "LOAD target must receive no old action effects");
}

// ♥0の再訪はrepeatで正規報酬を得る。♥1になった時だけ既存followupへ。
for (const id of ids) {
  await setup(1); heartLevel = 0;
  assert.equal((await visit(id)).used, true);
  assert.equal(played.at(-1), `remake_ch2_${id}_repeat`);
  assert.equal(state.flags._ch2_followup_done?.[id], undefined);
  assert.deepEqual(state.affinity, [[id,5]]);
  heartLevel = 1; await visit(id);
  assert.equal(played.at(-1), `remake_ch2_${id}_followup`);
  assert.equal(state.flags._ch2_followup_done[id], true);
}

// The actual required-ID loader is atomic on missing/malformed new scenes.
let fixture = preparation;
const loaderDB = { dialogues: { preserved: true } };
const loaderContext = vm.createContext({ console, AbortController, setTimeout, clearTimeout,
  fetch: async url => ({ ok: true, json: async () => {
    const name = String(url).match(/(\w+)\.json/)[1];
    return name === "ch2_preparation" ? fixture : JSON.parse(fs.readFileSync(new URL(`data/dialogue/${name}.json`, root)));
  } }) });
const loader = new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/chapters/ch2-city-data.js", root), "utf8"), { context: loaderContext });
await loader.link(async spec => spec.includes("affinity-stages") ? new vm.SourceTextModule(stagesSource, { context: loaderContext }) : new vm.SyntheticModule(spec.includes("city-locations") ? ["CITY_BACKGROUNDS"] : spec.includes("core/data") ? ["DB"] : ["CH2_NIGHTS", "AGEHA_VISITS", "AGEHA_BADDAY", "STRAWBERRY_TRIAL_IDS"], function () {
  if (spec.includes("city-locations")) this.setExport("CITY_BACKGROUNDS", { kumicho: "room" });
  else if (spec.includes("core/data")) this.setExport("DB", loaderDB);
  else { this.setExport("CH2_NIGHTS", []); this.setExport("AGEHA_VISITS", []); this.setExport("AGEHA_BADDAY", null); this.setExport("STRAWBERRY_TRIAL_IDS", []); }
}, { context: loaderContext }));
await loader.evaluate();
const validatedIds = [...ids.map(id => `remake_ch2_${id}_followup`), ...["kumicho", "rei"].map(id => `remake_ch2_${id}_revisit`)];
for (const id of validatedIds) {
  fixture = { dialogues: preparation.dialogues.filter(d => d.dialogue_id !== id) };
  await assert.rejects(loader.namespace.loadPreparationDialogues(), /台本が不足/);
  assert.deepEqual(loaderDB.dialogues, { preserved: true });
}
for (const id of validatedIds) {
  fixture = structuredClone(preparation); fixture.dialogues.find(d => d.dialogue_id === id).lines = [{}];
  await assert.rejects(loader.namespace.loadPreparationDialogues(), /台本の形式/);
  assert.deepEqual(loaderDB.dialogues, { preserved: true });
}
fixture = preparation; await loader.namespace.loadPreparationDialogues();
// 31 本 + あげはの♥3の質問 ch2_ageha_bond_question（#1988）
assert.equal(Object.keys(loaderDB.dialogues).length, 32 + Object.values(CH2_VISIT_STORIES).flat().filter(entry => entry.file).length);
assert(loaderDB.dialogues.ch2_ageha_bond_question, "the ♥3 question is published with the ageha visits");
for (const entry of Object.values(CH2_VISIT_STORIES).flat()) assert(loaderDB.dialogues[entry.scene], entry.scene);
assert.equal(loaderDB.dialogues.ch2_kumicho_second.metadata.flavor_lesson, undefined);
assert.deepEqual(loaderDB.dialogues.ch2_kumicho_fourth.metadata.flavor_lesson, { dragonfruit: 1 });
assert.equal(loaderDB.dialogues.ch2_rei_first.metadata.flavor_lesson, undefined);
assert.deepEqual(loaderDB.dialogues.ch2_rei_fourth.metadata.flavor_lesson, { rose: 1 });
assert(loaderDB.dialogues.remake_ch2_rei_trpg);
assert(loaderDB.dialogues.remake_ch2_ageha_aquarium);
assert(loaderDB.dialogues.remake_ch2_kumicho_sento);
// Use only the IDs published by the actual loader, not the full source JSON.
for (const id of ["kumicho", "rei"]) {
  await setup(); DB.dialogues = { ...loaderDB.dialogues }; heartLevel = 5;
  state.money += 60000;
  const before = structuredClone(state);
  const sequence = [...CH2_VISIT_STORIES[id].map(entry => entry.scene), `remake_ch2_${id}_repeat`, `remake_ch2_${id}_repeat`];
  for (const scene of sequence) {
    const money = state.money, stamina = state.stamina;
    assert.equal((await visit(id)).used, true);
    assert.equal(played.at(-1), scene);
    assert.equal(state.money, money - 3000); assert.equal(state.stamina, stamina - 16);
  }
  assert.equal(state.flags._ch2_revisit_done[id], true);
  assert.equal(state.flags._ch2_talks[id], before.flags._ch2_talks[id] + sequence.length);
  assert.deepEqual(state.affinity, Array.from({ length: sequence.length }, () => [id, 5]));
  assert.deepEqual(state.relationshipMemories, before.relationshipMemories); assert.deepEqual(state.lovers, before.lovers);
}
console.log("PASS: actual preparation/loader, three owners, old saves, once-only followups, cancellation/LOAD, atomic preflight");

// Entering preparation after the initial deliveries must not create TRPG appointments
// or change any participant/relationship state. Keep the real legacy scheduler above
// so an accidental automatic call reproduces the browser regression.
const participants = JSON.parse(fs.readFileSync(new URL("data/trpg_catalog.json", root))).participants.map(person => person.id);
for (const shifts of [undefined, [], [{ id: "samechan", chapter: 2, day: 22, slot: 1, busy: true }]]) {
  await setup();
  Object.assign(state, { chapter: 2, day: 15, slot: 2,
    trpg: { owned: ["qa_book"], club: { founded: true, members: Object.fromEntries(participants.map(id => [id, { chapter: 1, day: 12 }])) },
      ...(shifts === undefined ? {} : { shifts: structuredClone(shifts) }) },
  });
  const before = structuredClone(state);
  await module.namespace.runChapterTwoPreparation();
  for (const key of Object.keys(before).filter(key => key !== "flags")) {
    assert.deepEqual(state[key], before[key], `Preparation entry changed ${key}`);
  }
}
console.log("PASS: preparation preserves every resource/relationship and all TRPG members and explicit shifts (legacy/empty/existing)");
