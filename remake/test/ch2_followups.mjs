// Actual preparation/loader modules with isolated dependencies; browser suite covers calendar settlement.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const preparation = JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_preparation.json", root)));
const all = Object.fromEntries(preparation.dialogues.map(d => [d.dialogue_id, d]));
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
let state, options, played, saves, mode, resolvePlay;
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
    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; },
    earnStat: (id, n) => { state.growth.push([id, n]); }, gainAffinity: (id, n) => { state.affinity.push([id, n]); },
  },
  "../core/ui.js": { imageReady: async () => mode !== "bad-image", setBg: async () => {}, toast: () => {} },
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
  "./ch2-outings.js": { CITY_OUTINGS: [], CITY_SHOP: { id: "ch2_shop" }, knownCityOutings: () => [], introduceCitySpot: () => false },
  "./ch2-city-data.js": { MAP: { day: "map" }, STOPS: ids.map(id => ({ id, name: id })), ROOMS: Object.fromEntries(ids.map(id => [id, id])) },
  "./ch2-progress.js": { dayOneProgress: () => ({ startDay: 15 }), recordCityVisit: () => {}, scheduleChapterTwoTrpgNight: () => {} },
  "./ch2-story.js": { chapterTwoNights: () => ({}) },
  // あげはの店に通う回は ch2_ageha_story.mjs で確認する。ここでは従来の chat/followup/repeat だけを見る
  "./ch2-story-data.js": { agehaStoryScene: () => null, syncAgehaVibes: () => 0 },
};
const module = new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/chapters/ch2-preparation.js", root), "utf8"), { context });
await module.link(async specifier => {
  if (specifier === "../core/state.js") return states;
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
      // #952: 続編のあと一度だけ、前の話を覚えて少し進む再訪。正常終了でだけ請求・既読。
      const money = state.money; await visit(id);
      assert.equal(played.at(-1), `remake_ch2_${id}_revisit`); assert.equal(state.flags._ch2_revisit_done[id], true);
      assert.equal(state.money, money - 3000);
    }
    await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_repeat`);
    await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_repeat`, "The revisit is read only once");
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
  if (id !== "ageha") for (const failure of ["cancel", "undefined", "replace-state"]) {
    await setup(); await visit(id); mode = failure;
    const old = state, before = structuredClone(state);
    assert.equal((await visit(id)).used, false);
    // 続編の既読（VM内で作られたオブジェクト）を含むため、値だけをJSONで比べる。
    assert.equal(JSON.stringify(old), JSON.stringify(before), `${id}: ${failure} during the revisit leaves money/stamina/read state unchanged`);
    assert.equal(old.flags._ch2_revisit_done?.[id], undefined);
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

// The actual required-ID loader is atomic on missing/malformed new scenes.
let fixture = preparation;
const loaderDB = DB; loaderDB.dialogues = { preserved: true };
const loaderContext = context;
loaderContext.fetch = async url => ({ ok: true, json: async () => String(url).includes("ch2_deliveries") ? JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_deliveries.json", root))) : fixture });
const loader = new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/chapters/ch2-city-data.js", root), "utf8"), { context: loaderContext });
await loader.link(async spec => new vm.SyntheticModule(spec.includes("city-locations") ? ["CITY_BACKGROUNDS"] : spec.includes("core/data") ? ["DB"] : ["CH2_NIGHTS", "AGEHA_VISITS", "AGEHA_BADDAY"], function () {
  if (spec.includes("city-locations")) this.setExport("CITY_BACKGROUNDS", { kumicho: "room" });
  else if (spec.includes("core/data")) this.setExport("DB", loaderDB);
  else { this.setExport("CH2_NIGHTS", []); this.setExport("AGEHA_VISITS", []); this.setExport("AGEHA_BADDAY", null); }
}, { context: loaderContext }));
await loader.evaluate();
for (const id of ids) {
  fixture = { dialogues: preparation.dialogues.filter(d => d.dialogue_id !== `remake_ch2_${id}_followup`) };
  await assert.rejects(loader.namespace.loadPreparationDialogues(), /台本が不足/);
  assert.deepEqual(loaderDB.dialogues, { preserved: true });
}
fixture = structuredClone(preparation); fixture.dialogues.find(d => d.dialogue_id.endsWith("_followup")).lines = [{}];
await assert.rejects(loader.namespace.loadPreparationDialogues(), /続編台本の形式/);
fixture = preparation; await loader.namespace.loadPreparationDialogues();

assert(loaderDB.dialogues.remake_ch2_rei_trpg);
assert(loaderDB.dialogues.remake_ch2_ageha_aquarium);
assert(loaderDB.dialogues.remake_ch2_kumicho_sento);
// #957 regression: a successful real loader must expose each new revisit to the public visit callback.
// These are controlled ports, NOT browser/calendar settlement or a real SAVE/LOAD acceptance test.
for (const id of ["kumicho", "rei"]) {
  const revisitId = `remake_ch2_${id}_revisit`;
  for (const count of [0, 17]) {
    await setup(count); DB.dialogues = { preserved: true }; fixture = preparation;
    await loader.namespace.loadPreparationDialogues();
    for (const person of ids) for (const suffix of ["chat", "followup", "repeat"])
      assert(DB.dialogues[`remake_ch2_${person}_${suffix}`], "Existing scenes stay available");
    assert.equal(state.flags._ch2_revisit_done?.[id], undefined, "Old visit counts do not mark new dialogue read");
    const expected = [...(count ? [] : ["chat"]), "followup", "revisit", "repeat"];
    for (const suffix of expected) {
      const money = state.money, stamina = state.stamina, calls = played.length;
      assert.equal((await visit(id)).used, true);
      assert.equal(played.length, calls + 1);
      assert.equal(played.at(-1), `remake_ch2_${id}_${suffix}`);
      assert.equal(state.money, money - 3000, "Exactly one normal paid visit");
      assert.equal(state.stamina, stamina - 16);
      assert.equal(!!state.flags._ch2_revisit_done?.[id], suffix === "revisit" || suffix === "repeat");
    }
    assert.equal(Object.keys(DB.dialogues).length, 31, "Preserved entry + existing preparation/delivery IDs + two revisits");
    assert(DB.dialogues[revisitId]);
  }
  for (const defect of ["missing", "empty", "control", "missing-face"]) {
    fixture = structuredClone(preparation);
    const scene = fixture.dialogues.find(d => d.dialogue_id === revisitId);
    if (defect === "missing") fixture.dialogues = fixture.dialogues.filter(d => d !== scene);
    if (defect === "empty") scene.lines = [];
    if (defect === "control") scene.lines[0] = { type: "apply", text: "bad", speaker: "", face: "" };
    if (defect === "missing-face") delete scene.lines[0].face;
    DB.dialogues = { preserved: true };
    const before = JSON.stringify(state), priorDB = DB.dialogues;
    await assert.rejects(loader.namespace.loadPreparationDialogues(), /台本が不足|続編台本の形式/);
    assert.equal(DB.dialogues, priorDB, "A failed load must not replace the published DB");
    assert.deepEqual(DB.dialogues, { preserved: true }, "No partial publication on a bad revisit");
    assert.equal(JSON.stringify(state), before, "Loader failure cannot charge or invent read state");
  }
  for (const failure of ["cancel", "undefined", "throw", "replace-state", "pending"]) {
    await setup(1); DB.dialogues = { preserved: true }; fixture = preparation;
    await loader.namespace.loadPreparationDialogues();
    await visit(id); // complete followup through the actual loader-fed DB
    assert.equal(played.at(-1), `remake_ch2_${id}_followup`);
    const owner = state, before = JSON.stringify(owner), money = owner.money, stamina = owner.stamina;
    mode = failure;
    if (failure === "throw") await assert.rejects(visit(id), /injected/);
    else if (failure === "pending") {
      const pending = visit(id);
      for (let n = 0; n < 10 && !resolvePlay; n++) await Promise.resolve();
      assert(resolvePlay); assert.equal(JSON.stringify(owner), before, "Entering a revisit cannot charge or mark read");
      resolvePlay({ id: revisitId });
      assert.equal((await pending).used, true);
      assert.equal(owner.money, money - 3000); assert.equal(owner.stamina, stamina - 16);
      assert.equal(owner.flags._ch2_revisit_done[id], true);
    } else assert.equal((await visit(id)).used, false);
    if (failure !== "pending") {
      assert.equal(JSON.stringify(owner), before, `${id}: loader-fed ${failure} must leave the old owner unchanged`);
      if (failure === "replace-state") assert.deepEqual(state, fresh(9), "Old completion cannot mutate the replacement owner");
      else { mode = "ok"; assert.equal((await visit(id)).used, true); assert.equal(played.at(-1), revisitId); }
    }
  }
}
console.log("PASS: original preparation boundaries plus real-loader revisit publication, atomic rejection/retry, paid sequence, delayed completion and owner replacement");
