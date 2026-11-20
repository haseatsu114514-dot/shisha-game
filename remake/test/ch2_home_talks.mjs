// VOL13: 第2章の地元の会話を足す。
// ① 施設の寄り道（実 spot-encounters.js）: 喫茶こはく・観音堂・CHOI-ZAP・C.STATIONに第2章だけの回。第1章・第3章では出ない
// ② Dr.fookah 2階の凛想（実 spots.js の visitChar）: 第2章だけの会話2本。味の不調に気づく回を先に、一来店一本・一度だけ
//    #3097 PR-C: 凛想・アダム・みんとの続きと、なるの1本（DAY3の祝いの後、対峙より前だけ）。台本10本の中身の決まり（④）
// ③ あげはの通い訪問（実 ch2-preparation.js）: 小会話6種を巡回し、昼夜の店のあいさつを挟む
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
// #3097 第1弾: 各施設の第2章の回を1本ずつ足した（既存の回の後ろ）
// #3097 第2弾: さらに各施設に1本（時計・香炉・首のストレッチ・帰りの飴）
// #3097 PR-I: 喫茶こはくに上園さんの回（面識がある時だけ・味の回の後ろ）
const CH2 = { cafe: ["cafe_ch2_commute", "cafe_ch2_taste", "cafe_ch2_maezono", "cafe_ch2_foam", "cafe_ch2_clock"], kannon: ["kannon_ch2_wish", "kannon_ch2_omikuji", "kannon_ch2_incense"],
  choizap: ["choizap_ch2_numbers", "choizap_ch2_stairs", "choizap_ch2_neck"], c_station: ["cs_ch2_haze", "cs_ch2_new_staff", "cs_ch2_candy"] };
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
// #3097 PR-I: 上園さんの回は、面識がある時だけ。味の不調の後は、マスターの味の回を先に
{
  const met = { maezono: true };
  const commuteRead = { _spot_seen_cafe_ch2_commute: true };
  assert.equal(encounters.spotEncounterDue("cafe", 5, save(2, commuteRead, { met }), all), "cafe_ch2_maezono", "after the commute talk");
  assert.equal(encounters.spotEncounterDue("cafe", 5, save(2, { ...commuteRead, _ch2_taste_distant: true }, { met }), all), "cafe_ch2_taste");
  assert.equal(encounters.spotEncounterDue("cafe", 5, save(2, { ...commuteRead, _ch2_taste_distant: true, _spot_seen_cafe_ch2_taste: true }, { met }), all), "cafe_ch2_maezono");
  assert.equal(encounters.spotEncounterDue("cafe", 5, save(2, commuteRead), all), "cafe_ch2_foam", "not before meeting him");
  assert.notEqual(encounters.spotEncounterDue("cafe", 5, save(1, commuteRead, { met }), all), "cafe_ch2_maezono", "chapter 2 only");
  // 味の不調の前後で、はじめの答え方だけが分かれる（どちらも同じ場面の続きへ戻る）
  const scene = all.cafe_ch2_maezono;
  const conditions = scene.lines.filter(line => line.type === "condition");
  assert(conditions.length === 2 && conditions.every(line => line.flag === "_ch2_taste_distant" && scene.branches[line.next_true] && scene.branches[line.next_false]));
  assert(!/大会|県大会|審査|採点|HAZE/.test(JSON.stringify(scene)), "a judge does not talk about the tournament with a contestant");
}
// 台本が読み込まれていない（第2章の準備期間の外）なら出さない
assert.equal(encounters.spotEncounterDue("cafe", 5, save(2), {}), null);
// #2090・RVE: なるとの決裂（第2章の対峙）以降は、店を閉めて修行に出ているので、喫茶こはく・ジムでもなるに会わない
{
  const ch2Seen = Object.fromEntries(Object.values(CH2).flat().map(id => [`_spot_seen_${id}`, true]));
  const rifts = ["_ch2_read_ch2_naru_confrontation", "_ch2_night_11_done", "_ch2_naru_listened", "_ch2_naru_hurt"];
  for (const [spot, id] of [["cafe", "cafe_naru_break"], ["choizap", "choizap_naru"]]) {
    assert.equal(encounters.spotEncounterDue(spot, 5, save(1, ch2Seen), all), id, `${id}: chapter 1`);
    assert.equal(encounters.spotEncounterDue(spot, 5, save(2, ch2Seen), all), id, `${id}: chapter 2 before the rift`);
    for (const rift of rifts) {
      for (const chapter of [2, 3, 5]) {
        assert.notEqual(encounters.spotEncounterDue(spot, 5, save(chapter, { ...ch2Seen, [rift]: true }), all), id, `${id}: not during the rift (${rift}, chapter ${chapter})`);
      }
    }
    // 第1章ではまだ決裂していない（同じ保存値でも章が1なら出る）
    assert.equal(encounters.spotEncounterDue(spot, 5, save(1, { ...ch2Seen, _ch2_naru_hurt: true }), all), id, `${id}: chapter 1 is never a rift`);
  }
}

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

// ---- ② 凛想の第2章の会話（実 spots.js の visitChar） --------------------------------------
let state, played, affinity, playMode = "ok";
const DB = { dialogues: all, manifest: {} };
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB },
  "../core/stats.js": { gainAffinity: (id, n) => affinity.push([id, n]), visitAffinity: kind => ({ story: 16, talk: 8 })[kind], affinityLevel: () => 5, releaseAffinity: () => 0,
    AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], earnStat: () => {}, addStamina: () => {}, addMoney: () => {} },
  "../vn/engine.js": { play: async (id) => { played.push(id); return playMode === "cancel" ? { cancelled: true } : { id }; } },
  "../core/affinity-stages.js": { VISIT_SEQ: { rio: ["ch1_rio_first", "ch1_rio_second", "ch1_rio_third", "ch1_rio_fourth"] } },
  "./weather.js": { isRainy: () => false, RAIN_SPOT_TEXTS: {} },
  "./bonds.js": { questionVisitDue: () => false, finaleAtVisit: () => false, afterStory: async () => true },
  "./spot-encounters.js": { spotFollowupDue: () => null },
  "./trpg.js": { maybeRecruitTrpgMember: async () => false, trpgSpot: () => null },
  "./axe-bar-data.js": { AXE_BAR: { id: "axe_bar" } },
}, context);
const spots = spotsModule.ns;
function rioSave(patch = {}) {
  const value = { chapter: 2, phase: "daily", day: 20, slot: 1, story: { rio: 4 }, visits: { rio: 6 }, met: { rio: true }, contacts: [],
    affinity: { rio: 40 }, lovers: [], flags: {}, ...patch };
  spotsModule.set("../core/state.js", "state", value);
  return value;
}
async function visitRio(patch) {
  if (patch) state = rioSave(patch);
  played = []; affinity = [];
  return spots.visitChar("rio");
}
state = rioSave(); played = []; affinity = [];
assert.equal(spots.chapterTalkDue("rio"), "ch2_rio_strawberry", "Before the taste trouble, the strawberry talk");
assert.equal(spots.hasNewStory("rio"), true, "地図の Dr.fookah に「！」");
assert.equal(await visitRio(), true);
assert.deepEqual(played, ["ch2_rio_strawberry"]);
assert.deepEqual(plain(affinity), [["rio", 8]]); // 来店の通いの値（AFB01）
assert.equal(state.flags._talk_seen_ch2_rio_strawberry, true);
await visitRio();
assert(!played.includes("ch2_rio_strawberry"), "read once");
// 味の不調の後は、気づく回を先に
await visitRio({ flags: { _ch2_taste_distant: true } });
assert.deepEqual(played, ["ch2_rio_taste"]);
await visitRio(); assert.deepEqual(played, ["ch2_rio_strawberry"]);
// #3097 第1弾: 柚ヶ谷の匂いの回は、苺の回の後に一本
await visitRio(); assert.deepEqual(played, ["ch2_rio_city_scent"]);
// #3097 PR-C: 満員電車の回は、柚ヶ谷の匂いの回の後に一本
await visitRio(); assert.deepEqual(played, ["ch2_rio_rush_hour"]);
// #3097 第2弾（VOL20）: 塩だけのおにぎりの回は、満員電車の回の後に一本
await visitRio(); assert.deepEqual(played, ["ch2_rio_plain_lunch"]);
await visitRio(); assert(!played.some(id => id.startsWith("ch2_rio_")), "all five read");
// 中断したら既読にしない
state = rioSave({ flags: { _ch2_taste_distant: true } }); playMode = "cancel";
played = []; affinity = [];
assert.equal(await spots.visitChar("rio"), false);
assert(!state.flags._talk_seen_ch2_rio_taste); assert.deepEqual(plain(affinity), []);
playMode = "ok";
// 段階会話がまだなら、第2章の会話を先に一本（段階は次の来店）
state = rioSave({ story: { rio: 2 } }); played = []; affinity = [];
await spots.visitChar("rio"); assert.deepEqual(played, ["ch2_rio_strawberry"]); assert.equal(state.story.rio, 2);
// 凛想と初めて話す前（固有会話0本）は、呼び名や面識を前提にする第2章の会話を出さない（先に初対面）
state = rioSave({ story: {} }); assert.equal(spots.chapterTalkDue("rio"), null, "first meeting comes first");
// 第1章・第3章、台本が無い時は出さない
for (const chapter of [1, 3]) { state = rioSave({ chapter }); assert.equal(spots.chapterTalkDue("rio"), null, `chapter ${chapter}`); }
state = rioSave(); const saved = DB.dialogues; DB.dialogues = {}; assert.equal(spots.chapterTalkDue("rio"), null); DB.dialogues = saved;
assert.equal(spots.chapterTalkDue("adam"), null);
// #3097 第1弾: アダム・みんとの第2章の会話。初めて話した後の第2章だけ、一度きり
// #3097 PR-C: アダム・みんとに2本ずつ。第1弾の回の後に、並びの順で一来店に一本
// #3097 第2弾（VOL20）: アダム・みんとに1本ずつ（林檎のお使い・あだ名の手帳）
for (const [id, scenes] of [["adam", ["ch2_adam_ticket_machine", "ch2_adam_yuzugaya_apples", "ch2_adam_out_of_stock", "ch2_adam_apple_errand"]],
  ["minto", ["ch2_minto_commute_frame", "ch2_minto_lost_pass", "ch2_minto_mint_scale", "ch2_minto_nickname_notes"]]]) {
  const seen = {};
  for (const scene of scenes) {
    state = rioSave({ story: { [id]: 2 }, flags: { ...seen } });
    assert.equal(spots.chapterTalkDue(id), scene, `${id}: chapter 2 talk ${scene}`);
    assert.equal(spots.hasNewStory(id), true, `${id}: the map marks ${scene}`);
    seen[`_talk_seen_${scene}`] = true;
  }
  state = rioSave({ story: { [id]: 2 }, flags: seen });
  assert.equal(spots.chapterTalkDue(id), null, `${id}: each read once`);
  for (const chapter of [1, 3]) { state = rioSave({ chapter, story: { [id]: 2 } }); assert(!scenes.includes(spots.chapterTalkDue(id)), `${id}: not in chapter ${chapter}`); }
  state = rioSave({ story: {} }); assert.equal(spots.chapterTalkDue(id), null, `${id}: first meeting comes first`);
  // 実 visitChar: 一来店に一本、段階会話より先。読み終えたら既読、好感度は通い訪問と同じ
  state = rioSave({ story: { [id]: 2 }, visits: { [id]: 6 }, met: { [id]: true }, affinity: { [id]: 40 } }); played = []; affinity = [];
  for (const scene of scenes) {
    played = []; affinity = [];
    assert.equal(await spots.visitChar(id), true);
    assert.deepEqual(played, [scene]); assert.deepEqual(plain(affinity), [[id, 8]]); assert.equal(state.story[id], 2);
    assert.equal(state.flags[`_talk_seen_${scene}`], true);
  }
}
// #3097 PR-C: なるの第2章の会話は、DAY3の祝い（_ch2_naru_warm_done）の後、DAY11の対峙より前だけ。対峙の後、なるは店を長く休む
{
  const warm = { _ch2_naru_warm_done: true };
  state = rioSave({ story: { naru: 3 } }); assert.equal(spots.chapterTalkDue("naru"), null, "naru: not before the celebration night");
  state = rioSave({ story: { naru: 3 }, flags: warm });
  assert.equal(spots.chapterTalkDue("naru"), "ch2_naru_sign_light", "naru: after the celebration night");
  assert.equal(spots.hasNewStory("naru"), true);
  for (const rift of ["_ch2_read_ch2_naru_confrontation", "_ch2_night_11_done", "_ch2_naru_listened", "_ch2_naru_hurt"]) {
    state = rioSave({ story: { naru: 3 }, flags: { ...warm, [rift]: true } });
    assert.equal(spots.chapterTalkDue("naru"), null, `naru: never after the confrontation (${rift})`);
  }
  for (const chapter of [1, 3, 4]) { state = rioSave({ chapter, story: { naru: 3 }, flags: warm }); assert.equal(spots.chapterTalkDue("naru"), null, `naru: chapter ${chapter}`); }
  state = rioSave({ story: {}, flags: warm }); assert.equal(spots.chapterTalkDue("naru"), null, "naru: first meeting comes first");
  state = rioSave({ story: { naru: 3 }, flags: { ...warm, _talk_seen_ch2_naru_sign_light: true } }); assert.equal(spots.chapterTalkDue("naru"), null, "naru: read once");
  // 実 visitChar: 対峙より前は読む。中断なら既読にしない
  state = rioSave({ story: { naru: 3 }, visits: { naru: 6 }, met: { naru: true }, affinity: { naru: 40 }, flags: { ...warm } });
  playMode = "cancel"; played = []; affinity = [];
  assert.equal(await spots.visitChar("naru"), false); assert(!state.flags._talk_seen_ch2_naru_sign_light); assert.deepEqual(plain(affinity), []);
  playMode = "ok"; played = []; affinity = [];
  assert.equal(await spots.visitChar("naru"), true); assert.deepEqual(played, ["ch2_naru_sign_light"]);
  assert.equal(state.flags._talk_seen_ch2_naru_sign_light, true); assert.deepEqual(plain(affinity), [["naru", 8]]);
  // 対峙の後は、店そのものが閉まっていて来店できない
  state = rioSave({ story: { naru: 3 }, visits: { naru: 6 }, met: { naru: true }, flags: { ...warm, _ch2_naru_hurt: true } }); played = [];
  assert.equal(await spots.visitChar("naru"), false); assert.deepEqual(played, []);
}

// ---- ③ あげはの通い訪問の小会話6種と昼夜のあいさつ（実 ch2-preparation.js） --------------------
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
  "./ch2-story-data.js": { agehaStoryScene: () => null, agehaLaterScene: () => null, AGEHA_LATER_SCENES: [], syncAgehaVibes: () => 0 },
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
for (let n = 0; n < 9; n++) {
  slotOfDay = n % 2 ? "night" : "day"; prepPlayed = [];
  const result = await prepState.def.performSpot(agehaShop, { staminaGuard: async () => true });
  assert.equal(result.used, true);
  assert.equal(prepPlayed[0], `venue_ageha_${slotOfDay}`, "昼夜の店のあいさつを先に");
  seen.push(prepPlayed[1]);
}
assert.deepEqual(seen.slice().sort(), ["remake_ch2_ageha_repeat", ...["b", "c", "d", "e", "f", "g", "h", "i"].map(s => `remake_ch2_ageha_repeat_${s}`)],
  "九回通えば、小会話9種を一巡する（#3097 で6種→9種）");

// ---- ④ 台本 ----------------------------------------------------------------------
const tournamentSafe = id => JSON.stringify(all[id]).includes('"tournament_finished"');
for (const id of ["cs_ch2_haze", "ch2_rio_strawberry"]) assert(tournamentSafe(id), `${id} has an after-tournament branch`);
// あげはの小会話・あいさつ・凛想の味の回・施設の回は、大会の前後どちらでも成り立つ（出発前の準備期間でも読む）
for (const id of ["remake_ch2_ageha_repeat_b", "remake_ch2_ageha_repeat_c", "remake_ch2_ageha_repeat_d", "remake_ch2_ageha_repeat_f",
  "remake_ch2_ageha_repeat_g", "remake_ch2_ageha_repeat_h", "remake_ch2_ageha_repeat_i", "venue_ageha_day", "venue_ageha_night",
  "ch2_rio_taste", "cafe_ch2_commute", "cafe_ch2_taste", "kannon_ch2_wish", "choizap_ch2_numbers"]) {
  assert(!/大会|本番|県大会|優勝/.test(JSON.stringify(all[id])), `${id} does not presuppose the tournament`);
}
// 凛想の味の回は、原因を決めつけず、吸って確かめ続けない（物語の正本「味の不調と受診」）
const taste = all.ch2_rio_taste.lines.map(line => line.text || "").join("\n");
assert(/煙の褒め方が嘘だね/.test(taste)); assert(!/心因|気のせい|ストレス/.test(taste)); assert(/確かめ続けるのはやめ/.test(taste));
// 水族館の再訪（1,800円）は各4行以上
for (const id of ["remake_ch2_aquarium_repeat", "remake_ch2_aquarium_repeat_b", "remake_ch2_aquarium_repeat_c"]) {
  assert(all[id].lines.length >= 4, `${id} has a few more lines`);
}
// #3097 PR-C: 地元の普段の会話10本。大会・味の感想を前提にせず、報酬の文・命令を持たない（読了と好感度は来店の処理が持つ）
{
  const PRC = { minto: ["ch2_minto_lost_pass", "ch2_minto_mint_scale"], rio: ["ch2_rio_rush_hour"], samechan: ["ch2_samechan_remora_seat", "ch2_samechan_spare_teeth"],
    hiyori: ["ch2_hiyori_health_check", "ch2_hiyori_capsule_toy"], adam: ["ch2_adam_yuzugaya_apples", "ch2_adam_out_of_stock"], naru: ["ch2_naru_sign_light"] };
  const { CH2_HOME_IDS } = await import(new URL("remake/js/chapters/ch2-city-data.js", root));
  const textOf = id => all[id].lines.map(line => line.text).join("\n");
  for (const [who, ids] of Object.entries(PRC)) for (const id of ids) {
    assert(all[id]?.lines?.length, `${id} exists`);
    assert(CH2_HOME_IDS.includes(id), `${id} is loaded with the chapter 2 preparation`);
    assert(all[id].lines.every(line => !line.type), `${id}: the visit handles reading and affinity`);
    assert(all[id].lines.some(line => line.speaker === who), `${id}: ${who} speaks`);
    assert(!/大会|本番|県大会|優勝|審査|採点|が(少し|かなり|大きく)?上がった/.test(textOf(id)), `${id}: before or after the tournament, no reward text`);
    // はじめは味の感想を言わない（第2章の味の不調の前後どちらでも読む）
    assert(!all[id].lines.some(line => line.speaker === "hajime" && /味|甘い|苦い|香り|おいし|うまい/.test(line.text)), `${id}: hajime does not judge the taste`);
  }
  // みんと: 営業中の名前のまま、年齢の話をしない
  for (const id of PRC.minto) {
    assert(!/歳|年齢|二十|はたち|アラサー|栞|お姉さん/.test(textOf(id)), `${id}: no age talk, the shop name only`);
    assert(all[id].lines.every(line => !/^ura_/.test(line.face)), `${id}: the shop look`);
  }
  // 凛想: 香りへの配慮は、生活用品（無香料の洗剤・柔軟剤）で見せる
  assert(/無香料/.test(textOf("ch2_rio_rush_hour")) && /柔軟剤/.test(textOf("ch2_rio_rush_hour")) && !/マニキュア|ネイル/.test(textOf("ch2_rio_rush_hour")));
  // サメちゃん: 本名・泳ぎ・恋愛・店の手伝いに触れない。コロちゃんに本人の語尾が混ざらない
  for (const id of PRC.samechan) {
    assert(!/なぎさ|泳ぎ|恋人|告白|手伝/.test(textOf(id)), id);
    for (const line of all[id].lines) if (line.voice === "korochan") assert(!/じゃ|のう|おる/.test(line.text), `${id}: ${line.text}`);
  }
  // ひより: どの店の相席でも読むので店名を出さない。斧投げの正体を前提にしない。本心は inner だけ
  for (const id of PRC.hiyori) {
    assert(!/斧|tonari|SHISHARK|PEPPERMINT|EDEN|KEMURIKUSA|Dr\.fookah|C\.STATION|MELTY/.test(JSON.stringify(all[id].lines)), id);
    assert(all[id].lines.some(line => line.inner) && all[id].metadata?.private_scene === true, id);
  }
}
// ---- ⑤ 第2章の地元の雨の回（#3097 PR-B・実 spots.js の visitSpot・restAtHome） ----------------------
// 雨の日、巡回が引いた回の代わりに章の台本を一度だけ読む。巡回は引いた回を読んだものとして進め、
// 経験値は引いた回の鍵（play の growthKey）で数える。夜の束の施設・晴れの日・第1章では差し替えない。
{
  const rainTexts = (await import(new URL("remake/js/daily/weather.js", root))).RAIN_SPOT_TEXTS;
  const rest = Object.fromEntries(dialogueFile("remake_ch1").filter(d => /^remake_rest/.test(d.dialogue_id)).map(d => [d.dialogue_id, d]));
  const saved = DB.dialogues; DB.dialogues = { ...all, ...rest };
  let rainy = true, calls = [];
  spotsModule.set("./weather.js", "isRainy", () => rainy);
  spotsModule.set("./weather.js", "RAIN_SPOT_TEXTS", rainTexts);
  spotsModule.set("./spot-encounters.js", "chapterRainScene", encounters.chapterRainScene);
  spotsModule.set("./spot-encounters.js", "quietSpotPool", encounters.quietSpotPool);
  spotsModule.set("./spot-encounters.js", "spotEncounterDue", () => null);
  spotsModule.set("./spot-encounters.js", "recordSpotEncounter", encounters.recordSpotEncounter);
  spotsModule.set("./spot-hours.js", "openingStatus", () => ({ ok: true }));
  spotsModule.set("../vn/engine.js", "play", async (id, opts = {}) => { calls.push({ id, ...opts }); return { id }; });
  const spotSave = (chapter, patch = {}) => {
    state = { chapter, phase: "daily", day: 20, slot: 0, stamina: 80, money: 50000, met: { naru: true, adam: true, minto: true, dr_kemuri: true },
      spotVisits: { cafe: 3, choizap: 3, c_station: 3 }, reel: { introDone: true }, story: {}, visits: {}, contacts: [], affinity: {}, lovers: [],
      ...patch, flags: { _gym_member: true, ...patch.flags } };
    spotsModule.set("../core/state.js", "state", state);
    calls = [];
  };
  const spot = id => spots.SPOTS.find(entry => entry.id === id);
  const plainCall = call => ({ id: call.id, growthScene: call.growthScene, growthKey: call.growthKey });
  // 喫茶こはく: 雨の回（第1章の2本）を引いた日に、第2章の雨の台本へ差し替える
  spotSave(2);
  await spots.visitSpot(spot("cafe"));
  assert.deepEqual(plainCall(calls[0]), { id: "cafe_ch2_rain", growthScene: true, growthKey: rainTexts.cafe[0] });
  assert.equal(state.flags._spot_turn_cafe_rain, 1, "the drawn rain turn counts as read");
  // 台本の末尾で既読になった後は、引いた回をそのまま読む（経験値の鍵の差し替えも無い）
  state.flags._spot_seen_cafe_ch2_rain = true; calls = [];
  await spots.visitSpot(spot("cafe"));
  assert.deepEqual(plainCall(calls[0]), { id: rainTexts.cafe[1], growthScene: true, growthKey: undefined });
  // 第1章・晴れの日は差し替えない
  spotSave(1); await spots.visitSpot(spot("cafe")); assert.equal(calls[0].id, rainTexts.cafe[0]); assert.equal(calls[0].growthKey, undefined);
  rainy = false; spotSave(2); await spots.visitSpot(spot("cafe"));
  assert.notEqual(calls[0].id, "cafe_ch2_rain"); assert.equal(calls[0].growthKey, undefined); rainy = true;
  // CHOI-ZAP・C.STATION: 雨の回が無いので、引いた静かな回を差し替える。静かな回の巡回も一つ進む
  for (const [id, scene, key] of [["choizap", "choizap_ch2_rain", "_spot_turn_choizap"], ["c_station", "cs_ch2_rain", "_spot_turn_c_station"]]) {
    spotSave(2);
    await spots.visitSpot(spot(id));
    const drawn = encounters.quietSpotPool(spot(id), 0).filter(scene => all[scene])[0];
    assert.deepEqual(plainCall(calls[0]), { id: scene, growthScene: true, growthKey: drawn }, `${id}: chapter 2 rain`);
    assert.equal(state.flags[key], 1);
  }
  // CHOI-ZAP の夜は夜の束を読み、雨の台本（昼の場面）にしない
  spotSave(2, { slot: 1 }); await spots.visitSpot(spot("choizap"));
  assert.notEqual(calls[0].id, "choizap_ch2_rain"); assert.equal(calls[0].growthKey, undefined);
  // 家で休む: 雨の回を一度だけ差し替える（休む回は経験値の付かない場面のまま）
  spotSave(2); await spots.restAtHome(spot("rest"));
  assert.equal(calls[0].id, "ch2_rest_rain"); assert.equal(calls[0].growthScene, undefined);
  assert.equal(state.flags._spot_turn_rest_rain, 1);
  state.flags._spot_seen_ch2_rest_rain = true; calls = [];
  await spots.restAtHome(spot("rest")); assert.equal(calls[0].id, "remake_rest_rain");
  spotSave(2); await spots.restAtHome(spot("rest"), { fullDay: true }); assert.equal(calls[0].id, "remake_rest_day");
  spotSave(1); await spots.restAtHome(spot("rest")); assert.equal(calls[0].id, "remake_rest_rain");
  // 台本: 読み込み一覧と一致し、自分の既読を記録し、大会・味・報酬の文を書かない。観音堂（心得の盤）には置かない
  const { CH2_RAIN_IDS } = await import(new URL("remake/js/chapters/ch2-city-data.js", root));
  assert.deepEqual([...encounters.CHAPTER_RAIN_IDS], [...CH2_RAIN_IDS], "the chapter 2 loader publishes every rain scene");
  for (const id of encounters.CHAPTER_RAIN_IDS) {
    const text = JSON.stringify(all[id]);
    assert(all[id]?.lines?.length, `${id} exists`);
    assert(text.includes(`"_spot_seen_${id}"`), `${id} records its own reading`);
    assert(!/大会|本番|県大会|優勝|味|が(少し|かなり|大きく)?上がった/.test(text), `${id}: any day before or after the taste trouble, no reward text`);
    assert(/雨/.test(text), `${id} is a rainy day scene`);
  }
  assert(!encounters.CHAPTER_RAIN_IDS.some(id => id.startsWith("kannon")));
  // 実 VN エンジンは、growthKey を渡された時だけその鍵で完読の経験値を数える（実際の再生はブラウザの検査）
  const engineSource = read("remake/js/vn/engine.js");
  assert.match(engineSource, /growthKey: typeof opts\.growthKey === "string" && opts\.growthKey \? opts\.growthKey : null,/);
  assert.match(engineSource, /if \(!cancelled && r\.growthScene\) earnSceneCompletion\(r\.growthKey \|\| r\.id, r\.owner\);/);
  DB.dialogues = saved;
}
console.log("PASS ch2 home talks: chapter 2 facility encounters, chapter 2 rainy-day swaps (#3097 PR-B), Rio's two talks, Ageha's nine small talks with greetings, tournament-safe scripts, aquarium revisits");

