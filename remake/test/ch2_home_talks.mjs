// VOL13: 第2章の地元の会話を足す。
// ① 施設の寄り道（実 spot-encounters.js）: 喫茶こはく・観音堂・CHOI-ZAP・C.STATIONに第2章だけの回。第1章・第3章では出ない
// ② Dr.fookah 2階のりん（実 spots.js の visitChar）: 第2章だけの会話2本。味の不調に気づく回を先に、一来店一本・一度だけ
// ③ あげはの通い訪問（実 ch2-preparation.js）: 小会話4種を巡回し、昼夜の店のあいさつを挟む
// ④ 台本: 大会を前提にする台詞には大会後の分岐、第2章の水族館の再訪は数行
// node --experimental-vm-modules remake/test/ch2_home_talks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const dialogueFile = name => JSON.parse(read(`data/dialogue/${name}.json`)).dialogues;
const all = Object.fromEntries(["ch2_home", "ch2_preparation", "ch2_ageha_story", "venue_hours", "ch2_deliveries", "ch1_spots"]
  .flatMap(dialogueFile).map(d => [d.dialogue_id, d]));
const plain = v => JSON.parse(JSON.stringify(v));

// ---- ① 施設の寄り道 ---------------------------------------------------------------
const encounters = await import(new URL("remake/js/daily/spot-encounters.js", root));
const CH2 = { cafe: ["cafe_ch2_commute", "cafe_ch2_taste"], kannon: ["kannon_ch2_wish"], choizap: ["choizap_ch2_numbers"], c_station: ["cs_ch2_haze"] };
const save = (chapter, flags = {}, extra = {}) => ({ chapter, slot: 0, met: { naru: true, adam: true, minto: true, dr_kemuri: true },
  flags: { _gym_member: true, ...flags }, ...extra });
for (const [spot, ids] of Object.entries(CH2)) {
  // 第2章は、前の章の残りより先に第2章の回
  assert.equal(encounters.spotEncounterDue(spot, 5, save(2, { _ch2_taste_distant: true }), all), ids[0], `${spot}: chapter 2 first`);
  // 第1章・第3章では第2章の回を出さない
  for (const chapter of [1, 3]) {
    const due = encounters.spotEncounterDue(spot, 5, save(chapter, { _ch2_taste_distant: true }), all);
    assert(!Object.values(CH2).flat().includes(due), `${spot}: no chapter 2 talk in chapter ${chapter}`);
  }
  // 読んだら次へ。一度だけ
  const flags = { _ch2_taste_distant: true, ...Object.fromEntries(ids.map(id => [`_spot_seen_${id}`, true])) };
  assert(!ids.includes(encounters.spotEncounterDue(spot, 5, save(2, flags), all)), `${spot}: read once`);
  for (const id of ids) {
    assert(all[id], `${id} exists`);
    assert(JSON.stringify(all[id]).includes(`"_spot_seen_${id}"`), `${id} records its own reading`);
    assert(!/が(少し|かなり|大きく)?上がった/.test(JSON.stringify(all[id])), `${id}: the visit gives growth, not the script`);
  }
}
// 味の不調を知る前は、喫茶こはくの味の回を出さない。観音堂は昼だけ
assert.equal(encounters.spotEncounterDue("cafe", 5, save(2, { _spot_seen_cafe_ch2_commute: true }), all) === "cafe_ch2_taste", false);
assert.equal(encounters.spotEncounterDue("kannon", 5, save(2, {}, { slot: 1 }), all) === "kannon_ch2_wish", false);
// 台本が読み込まれていない（第2章の準備期間の外）なら出さない
assert.equal(encounters.spotEncounterDue("cafe", 5, save(2), {}), null);

// ---- 実モジュールを、名前付き import だけ差し替えて読み込む --------------------------------
function namedImports(src) {
  const map = new Map();
  for (const m of src.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const set = map.get(m[2]) || new Set();
    for (const part of m[1].split(",").map(s => s.trim()).filter(Boolean)) set.add(part.split(/\s+as\s+/)[0].trim());
    map.set(m[2], set);
  }
  return map;
}
// 戻り値の set(spec, name, value) で、読み込み後に差し替えた値（state など）を実モジュールへ届ける。
async function loadWithStubs(file, overrides, context) {
  const src = read(file);
  const mod = new vm.SourceTextModule(src, { context, identifier: file });
  const imports = namedImports(src);
  const synthetic = new Map();
  await mod.link(spec => {
    const names = [...(imports.get(spec) || [])];
    const values = overrides[spec] || {};
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in values ? values[name] : (() => undefined));
    }, { context, identifier: spec });
    synthetic.set(spec, stub);
    return stub;
  });
  await mod.evaluate();
  return { ns: mod.namespace, set: (spec, name, value) => synthetic.get(spec).setExport(name, value) };
}

// ---- ② りんの第2章の会話（実 spots.js の visitChar） --------------------------------------
let state, played, affinity, playMode = "ok";
const DB = { dialogues: all, manifest: {} };
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB },
  "../core/stats.js": { gainAffinity: (id, n) => affinity.push([id, n]), visitAffinity: kind => ({ story: 16, talk: 8 })[kind], affinityLevel: () => 5, releaseAffinity: () => 0,
    AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], earnStat: () => {}, addStamina: () => {}, addMoney: () => {} },
  "../vn/engine.js": { play: async (id) => { played.push(id); return playMode === "cancel" ? { cancelled: true } : { id }; } },
  "../core/affinity-stages.js": { VISIT_SEQ: { kuyuri: ["ch1_kuyuri_first", "ch1_kuyuri_second", "ch1_kuyuri_third", "ch1_kuyuri_fourth"] } },
  "./weather.js": { isRainy: () => false, RAIN_SPOT_TEXTS: {} },
  "./bonds.js": { questionVisitDue: () => false, finaleAtVisit: () => false, afterStory: async () => true },
  "./spot-encounters.js": { spotFollowupDue: () => null },
  "./trpg.js": { maybeRecruitTrpgMember: async () => false, trpgSpot: () => null },
  "./axe-bar-data.js": { AXE_BAR: { id: "axe_bar" } },
}, context);
const spots = spotsModule.ns;
function kuyuriSave(patch = {}) {
  const value = { chapter: 2, phase: "daily", day: 20, slot: 1, story: { kuyuri: 4 }, visits: { kuyuri: 6 }, met: { kuyuri: true }, contacts: [],
    affinity: { kuyuri: 40 }, lovers: [], flags: {}, ...patch };
  spotsModule.set("../core/state.js", "state", value);
  return value;
}
async function visitKuyuri(patch) {
  if (patch) state = kuyuriSave(patch);
  played = []; affinity = [];
  return spots.visitChar("kuyuri");
}
state = kuyuriSave(); played = []; affinity = [];
assert.equal(spots.chapterTalkDue("kuyuri"), "ch2_kuyuri_strawberry", "Before the taste trouble, the strawberry talk");
assert.equal(spots.hasNewStory("kuyuri"), true, "地図の Dr.fookah に「！」");
assert.equal(await visitKuyuri(), true);
assert.deepEqual(played, ["ch2_kuyuri_strawberry"]);
assert.deepEqual(plain(affinity), [["kuyuri", 8]]); // 来店の通いの値（AFB01）
assert.equal(state.flags._talk_seen_ch2_kuyuri_strawberry, true);
await visitKuyuri();
assert(!played.includes("ch2_kuyuri_strawberry"), "read once");
// 味の不調の後は、気づく回を先に
await visitKuyuri({ flags: { _ch2_taste_distant: true } });
assert.deepEqual(played, ["ch2_kuyuri_taste"]);
await visitKuyuri(); assert.deepEqual(played, ["ch2_kuyuri_strawberry"]);
await visitKuyuri(); assert(!played.some(id => id.startsWith("ch2_kuyuri_")), "both read");
// 中断したら既読にしない
state = kuyuriSave({ flags: { _ch2_taste_distant: true } }); playMode = "cancel";
played = []; affinity = [];
assert.equal(await spots.visitChar("kuyuri"), false);
assert(!state.flags._talk_seen_ch2_kuyuri_taste); assert.deepEqual(plain(affinity), []);
playMode = "ok";
// 段階会話がまだなら、第2章の会話を先に一本（段階は次の来店）
state = kuyuriSave({ story: { kuyuri: 2 } }); played = []; affinity = [];
await spots.visitChar("kuyuri"); assert.deepEqual(played, ["ch2_kuyuri_strawberry"]); assert.equal(state.story.kuyuri, 2);
// りんと初めて話す前（固有会話0本）は、呼び名や面識を前提にする第2章の会話を出さない（先に初対面）
state = kuyuriSave({ story: {} }); assert.equal(spots.chapterTalkDue("kuyuri"), null, "first meeting comes first");
// 第1章・第3章、台本が無い時は出さない
for (const chapter of [1, 3]) { state = kuyuriSave({ chapter }); assert.equal(spots.chapterTalkDue("kuyuri"), null, `chapter ${chapter}`); }
state = kuyuriSave(); const saved = DB.dialogues; DB.dialogues = {}; assert.equal(spots.chapterTalkDue("kuyuri"), null); DB.dialogues = saved;
assert.equal(spots.chapterTalkDue("adam"), null);

// ---- ③ あげはの通い訪問の小会話4種と昼夜のあいさつ（実 ch2-preparation.js） --------------------
let prepState, prepPlayed, slotOfDay = "day";
const prepContext = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
const ROOMS = { ageha: "room_ageha", kumicho: "room_kumicho", rei: "room_rei" };
const prepModule = await loadWithStubs("remake/js/chapters/ch2-preparation.js", {
  "../core/state.js": { save: () => {}, markMet: id => { prepState.met[id] = true; }, timeOfDay: () => slotOfDay },
  "../core/data.js": { DB: { dialogues: all }, bgUrl: x => x },
  "../core/travel-budget.js": { spendableMoney: value => value.money },
  "../core/city-locations.js": { CH2_CITY_NAME: "柚ヶ谷", HOME_CITY_NAME: "橙須" },
  "../core/stats.js": { affinityLevel: () => 5 },
  "../core/ui.js": { withScenePreparation: task => task, imageReady: async () => true, setBg: async () => {} },
  "../vn/engine.js": { play: async id => { prepPlayed.push(id); return { id }; } },
  "../daily/calendar.js": { runDaily: async def => { prepState.def = def; } },
  "../daily/spots.js": { allSpots: () => [], VISIT_COST: 3000, isClosed: () => false, CHAR_STAT: {}, VISIT_BG: {}, bgRef: x => x },
  "../daily/trpg.js": { trpgSpot: () => null, maybeRecruitTrpgMember: async () => false },
  "../daily/bonds.js": { BOND_QUESTIONS: { ageha: {} }, BOND_FINALES: {}, questionVisitDue: () => false, finaleAtVisit: () => false },
  "./ch2-outings.js": { CITY_OUTINGS: [], CITY_SHOP: { id: "ch2_shop" }, knownCityOutings: () => [] },
  "./ch2-city-data.js": { MAP: { day: "map", night: "night" }, STOPS: Object.keys(ROOMS).map(id => ({ id, name: id })), ROOMS },
  "./ch2-progress.js": { dayOneProgress: () => ({ startDay: 15 }) },
  "./ch2-story.js": { chapterTwoNights: () => ({}), storyVisitDue: () => null },
  "./ch2-story-data.js": { agehaStoryScene: () => null, syncAgehaVibes: () => 0 },
  "../core/affinity-stages.js": { CH2_VISIT_STORIES: {} },
  "../core/growth.js": { consultLessons: async () => [] },
  "./ch2-purikura.js": { offerAgehaPurikura: async () => true },
}, prepContext);
const prep = prepModule.ns;
prepState = { chapter: 2, phase: "daily", day: 20, slot: 0, money: 50000, stamina: 100, met: { ageha: true }, visits: {}, contacts: [],
  affinity: {}, flags: { _ch2_talks: { ageha: 2 }, _ch2_followup_done: { ageha: true } } };
prepModule.set("../core/state.js", "state", prepState);
await prep.runChapterTwoPreparation();
const agehaShop = prep.PREPARATION_SPOTS.find(spot => spot.charId === "ageha");
const seen = [];
for (let n = 0; n < 4; n++) {
  slotOfDay = n % 2 ? "night" : "day"; prepPlayed = [];
  const result = await prepState.def.performSpot(agehaShop, { staminaGuard: async () => true });
  assert.equal(result.used, true);
  assert.equal(prepPlayed[0], `venue_ageha_${slotOfDay}`, "昼夜の店のあいさつを先に");
  seen.push(prepPlayed[1]);
}
assert.deepEqual(seen.slice().sort(), ["remake_ch2_ageha_repeat", "remake_ch2_ageha_repeat_b", "remake_ch2_ageha_repeat_c", "remake_ch2_ageha_repeat_d"],
  "四回通えば、小会話4種を一巡する");

// ---- ④ 台本 ----------------------------------------------------------------------
const tournamentSafe = id => JSON.stringify(all[id]).includes('"tournament_finished"');
for (const id of ["cs_ch2_haze", "ch2_kuyuri_strawberry"]) assert(tournamentSafe(id), `${id} has an after-tournament branch`);
// あげはの小会話・あいさつ・りんの味の回・施設の回は、大会の前後どちらでも成り立つ（出発前の準備期間でも読む）
for (const id of ["remake_ch2_ageha_repeat_b", "remake_ch2_ageha_repeat_c", "remake_ch2_ageha_repeat_d", "venue_ageha_day", "venue_ageha_night",
  "ch2_kuyuri_taste", "cafe_ch2_commute", "cafe_ch2_taste", "kannon_ch2_wish", "choizap_ch2_numbers"]) {
  assert(!/大会|本番|県大会|優勝/.test(JSON.stringify(all[id])), `${id} does not presuppose the tournament`);
}
// りんの味の回は、原因を決めつけず、吸って確かめ続けない（物語の正本「味の不調と受診」）
const taste = all.ch2_kuyuri_taste.lines.map(line => line.text || "").join("\n");
assert(/煙の褒め方が嘘だね/.test(taste)); assert(!/心因|気のせい|ストレス/.test(taste)); assert(/確かめ続けるのはやめ/.test(taste));
// 水族館の再訪（1,800円）は各4行以上
for (const id of ["remake_ch2_aquarium_repeat", "remake_ch2_aquarium_repeat_b", "remake_ch2_aquarium_repeat_c"]) {
  assert(all[id].lines.length >= 4, `${id} has a few more lines`);
}
console.log("PASS ch2 home talks: chapter 2 facility encounters, Kuyuri's two talks, Ageha's four small talks with greetings, tournament-safe scripts, aquarium revisits");
