// Actual preparation/loader modules with isolated dependencies; browser suite covers calendar settlement.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { scheduleChapterTwoTrpgNight } from "../js/chapters/ch2-progress.js";
import { reiStickerDue } from "../js/core/ryuji-visit.js";

const root = new URL("../../", import.meta.url);
const preparation = JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_preparation.json", root)));
const stories = ["ch2_kumicho", "ch2_rei", "venue_hours"].flatMap(name => JSON.parse(fs.readFileSync(new URL(`data/dialogue/${name}.json`, root))).dialogues);
const stickerScene = JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_deliveries.json", root))).dialogues.filter(d => d.dialogue_id === "remake_ch2_rei_purikura_after");
const all = Object.fromEntries([...preparation.dialogues, ...stories, ...stickerScene].map(d => [d.dialogue_id, d]));
const stagesSource = fs.readFileSync(new URL("remake/js/core/affinity-stages.js", root), "utf8");
const { CH2_VISIT_STORIES, ch2VisitDone } = await import(new URL("remake/js/core/affinity-stages.js", root));
const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
let state, options, played, saves, mode, resolvePlay, heartLevel = 1, finaleOpen = new Set(), finaleCalls = [], agehaStory = null, agehaLater = null;
const AGEHA_LATER_SCENES = [
  { id: "ch1_ageha_gummy_share", flag: "_ageha_gummy_share_done" },
  { id: "ch1_ageha_bear_seat", flag: "_ageha_bear_seat_done" },
];
const isRepeat = (id, scene) => /^remake_ch2_(ageha|kumicho|rei)_repeat(_[bcde])?$/.test(scene) && scene.includes(id);
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
    affinityLevel: () => heartLevel, releaseAffinity: () => 0,

    addMoney: n => { state.money += n; }, addStamina: n => { state.stamina += n; },
    earnStat: (id, n) => { state.growth.push([id, n]); }, gainAffinity: (id, n) => { state.affinity.push([id, n]); },
    // 来店の好感度（台帳 AFB01）: 第2章は段階会話・初対面・締めくくり 16、通い 8
    visitAffinity: kind => ({ story: 16, talk: 8 })[kind],
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
  "../daily/spots.js": { allSpots: () => [], VISIT_COST: 3000, isClosed: spot => spot.closedOn !== undefined && state.day % 7 === spot.closedOn,
    CHAR_STAT: {}, VISIT_BG: {}, bgRef: x => x, setChapterVisitDue: () => {}, hasNewEvent: () => false },
  "../daily/hiyori.js": { setHiyoriExtraShops: () => {} },
  "../daily/roamers.js": { addRoamerSpots: () => {} }, // よその店に居合わせる人（第2章は柚ヶ谷の店も登録する）
  "../daily/trpg.js": { trpgSpot: () => null, maybeRecruitTrpgMember: async () => false },
  "../daily/shop.js": { openShop: async () => null },
  "./ch2-purikura.js": { offerAgehaPurikura: async () => true },
  // MELTY PUFFでのレヰの挨拶回の後日（#3468 A案）。判定は実物を使う
  "../core/ryuji-visit.js": { reiStickerDue },
  // あげはの♥3の質問（#1988）は affinity_stages.mjs で確認する。ここでは質問が無い通常訪問だけを見る
  // 締めくくりの記録・贈り物は bonds.mjs / affinity_stages.mjs が確認する。ここでは訪問の分岐と精算だけを見る（#2027）
  "../daily/bonds.js": { BOND_QUESTIONS: { ageha: { host: "remake_ch2_ageha_newcomer", dialogue: "ch2_ageha_bond_question" } },
    BOND_FINALES: { ageha: { dialogue: "ch2_ageha_bond_finale" }, kumicho: { dialogue: "ch2_kumicho_bond_finale" }, rei: { dialogue: "ch2_rei_bond_finale" } },
    playQuestionVisit: async () => true, questionVisitDue: () => false, finaleAtVisit: id => finaleOpen.has(id),
    playFinale: async (id, opts) => {
      finaleCalls.push([id, opts]); played.push(`${id}:finale`);
      if (mode === "cancel") return false;
      (state.finales ||= {})[id] = { route: "friend" }; return true;
    } },
  "./ch2-outings.js": { CITY_OUTINGS: [], CITY_SHOP: { id: "ch2_shop" }, knownCityOutings: () => [], introduceCitySpot: () => false, outingDialogue: () => null, recordOutingVisit: () => {} },
  "./ch2-city-data.js": { MAP: { day: "map" }, STOPS: ids.map(id => ({ id, name: id })), ROOMS: Object.fromEntries(ids.map(id => [id, id])) },
  "./ch2-progress.js": { dayOneProgress: () => ({ startDay: 15 }), recordCityVisit: () => {}, scheduleChapterTwoTrpgNight },
  // 地元の店で読む第2章の本編（VOL13）は ch2_story_visits.mjs で確認する
  "./ch2-story.js": { chapterTwoNights: () => ({}), storyVisitDue: () => null, readStoryVisit: async () => false },
  // tonariの大会準備（VOL13）は ch2_craft_prep.mjs で確認する
  "./ch2-craft-prep.js": { craftPrepDue: () => null, offerCraftPrep: async () => null },
  // あげはの店に通う回は ch2_ageha_story.mjs で確認する。ここでは従来の chat/followup/repeat だけを見る
  "./ch2-story-data.js": { agehaStoryScene: () => agehaStory, agehaLaterScene: () => agehaLater, AGEHA_BADDAY: { id: "remake_ch2_ageha_badday", fromDay: 7 }, AGEHA_LATER_SCENES, syncAgehaVibes: () => 0 },
  // 心得の盤の授業の相談（SBD70）。盤が無効な時と同じく何もしない
  "../core/growth.js": { consultLessons: async () => [] },
  // 第5章の柚ヶ谷の通い訪問（#2033）が小会話を読み込む。ここでは第2章の訪問だけを見る
  "../core/chapter-data.js": { readDialogues: async () => ({}) },
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
  heartLevel = 1; finaleOpen = new Set(); finaleCalls = []; agehaLater = null;
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
    assert.deepEqual(state.affinity, [[id, first ? 16 : 8]]);
    assert.deepEqual(state.relationshipMemories, before.relationshipMemories); assert.deepEqual(state.lovers, before.lovers);
    assert.equal(saves, 1, "Visit must not insert an early save before calendar settlement");
    if (first) { await visit(id); assert.equal(played.at(-1), `remake_ch2_${id}_followup`); }
    if (id !== "ageha") {
      // #1648: 続編の後は訪問列の最古未読を一本ずつ。ハートが届くまではrepeatで、先の段階へ飛ばない。
      state.money += 60000; // 列の全段階とrepeatを通す代金
      for (const entry of CH2_VISIT_STORIES[id].slice(1)) {
        heartLevel = entry.heart - 1; await visit(id);
        assert(isRepeat(id, played.at(-1)), `${entry.scene} waits for ♥${entry.heart}`);
        assert.equal(ch2VisitDone(state.flags, id, entry), false);
        if (entry.after) {
          // #2720: ♥が届いても、前提の出来事（組長♥3はDAY5夜の味の不調）を読むまではrepeat
          heartLevel = entry.heart; await visit(id);
          assert(isRepeat(id, played.at(-1)), `${entry.scene} waits for ${entry.after}`);
          assert.equal(ch2VisitDone(state.flags, id, entry), false);
          state.flags[entry.after] = true;
        }
        heartLevel = entry.heart; const money = state.money; await visit(id);
        assert.equal(played.at(-1), entry.scene); assert.equal(ch2VisitDone(state.flags, id, entry), true);
        assert.equal(state.money, money - 3000);
      }
      assert.equal(state.flags._ch2_revisit_done[id], true);
      heartLevel = 5;
    }
    await visit(id); assert(isRepeat(id, played.at(-1)));
    await visit(id); assert(isRepeat(id, played.at(-1)), "Every visit story is read only once");
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

// #3468 A案: MELTY PUFFでの挨拶回の翌日以降、零の小会話を一度だけシールの後日に置き換える。代金・好感度・能力は小会話と同じ。
{
  await setup(1); await visit("rei"); heartLevel = 0;
  state.day = 20; state.flags._rei_melty_greeting = 20;
  await visit("rei"); assert(isRepeat("rei", played.at(-1)), "not on the greeting day");
  state.day = 21; mode = "cancel"; const before = JSON.stringify(state);
  assert.equal((await visit("rei")).used, false); assert.equal(JSON.stringify(state), before, "cancel leaves the after scene unread");
  mode = "ok"; const money = state.money; state.affinity = []; state.growth = [];
  assert.equal((await visit("rei")).used, true); assert.equal(played.at(-1), "remake_ch2_rei_purikura_after");
  assert.equal(state.flags._rei_purikura_after, true); assert.equal(state.money, money - 3000);
  assert.deepEqual(state.affinity, [["rei", 8]]); assert.deepEqual(state.growth, [["charm", 4]]);
  await visit("rei"); assert(isRepeat("rei", played.at(-1)), "after scene is read once");
  await setup(1); await visit("rei"); heartLevel = 0; state.day = 21; state.flags._rei_melty_greeting = 20;
  await visit("ageha"); assert.notEqual(played.at(-1), "remake_ch2_rei_purikura_after", "only at ZERO");
}

// ♥0の再訪はrepeatで正規報酬を得る。♥1になった時だけ既存followupへ。
for (const id of ids) {
  await setup(1); heartLevel = 0;
  assert.equal((await visit(id)).used, true);
  assert(isRepeat(id, played.at(-1)));
  assert.equal(state.flags._ch2_followup_done?.[id], undefined);
  assert.deepEqual(state.affinity, [[id,8]]);
  heartLevel = 1; await visit(id);
  assert.equal(played.at(-1), `remake_ch2_${id}_followup`);
  assert.equal(state.flags._ch2_followup_done[id], true);
}

// あげはの店に通う回は、神崎・レヰの段階会話と同じ+16。いつもの会話だけ+8（VOL06・AFB01）。
{
  await setup(1); state.flags._ch2_followup_done = { ageha: true };
  agehaStory = "remake_ch2_ageha_gyaru";
  DB.dialogues.remake_ch2_ageha_gyaru = { dialogue_id: agehaStory, lines: [{ speaker: "ageha", face: "smile", text: "a" }] };
  assert.equal((await visit("ageha")).used, true);
  assert.equal(played.at(-1), agehaStory);
  assert.deepEqual(state.affinity, [["ageha", 16]], "An Ageha story visit gains like the Kanzaki/レヰ stages");
  assert.equal(state.flags._ch2_read_remake_ch2_ageha_gyaru, true);
  agehaStory = null;
  await visit("ageha");
  assert(isRepeat("ageha", played.at(-1)));
  assert.deepEqual(state.affinity, [["ageha", 16], ["ageha", 8]], "The usual chat stays +8");
}

// 通う回のあと、グミを一度だけ。中断では旗が残らず、次は小品に戻る（#3081）
{
  await setup(1); state.flags._ch2_followup_done = { ageha: true };
  agehaLater = "ch1_ageha_gummy_share";
  DB.dialogues.ch1_ageha_gummy_share = { dialogue_id: agehaLater, lines: [{ speaker: "ageha", face: "smile", text: "一個" }] };
  assert.equal((await visit("ageha")).used, true);
  assert.equal(played.at(-1), agehaLater);
  assert.equal(state.flags._ageha_gummy_share_done, true);
  assert.deepEqual(state.affinity, [["ageha", 16]], "The one-time gummy visit is a story visit, not chatter");
  agehaLater = null;
  await visit("ageha");
  assert(isRepeat("ageha", played.at(-1)));
  assert.deepEqual(state.affinity.at(-1), ["ageha", 8]);
  await setup(1); state.flags._ch2_followup_done = { ageha: true };
  agehaLater = "ch1_ageha_gummy_share";
  DB.dialogues.ch1_ageha_gummy_share = { dialogue_id: agehaLater, lines: [{ speaker: "ageha", face: "smile", text: "一個" }] };
  mode = "cancel";
  assert.equal((await visit("ageha")).used, false);
  assert.equal(state.flags._ageha_gummy_share_done, undefined);
}

// 通う回のあと、白いクマの席を一度だけ。読了前の中断では旗を残さず、次は小品に戻る（#3081）
{
  await setup(1); state.flags._ch2_followup_done = { ageha: true };
  agehaLater = "ch1_ageha_bear_seat";
  DB.dialogues.ch1_ageha_bear_seat = { dialogue_id: agehaLater, lines: [{ speaker: "ageha", face: "smile", text: "席" }] };
  assert.equal((await visit("ageha")).used, true);
  assert.equal(played.at(-1), agehaLater);
  assert.equal(state.flags._ageha_bear_seat_done, true);
  assert.deepEqual(state.affinity, [["ageha", 16]], "The one-time seat is a story visit, not chatter");
  agehaLater = null;
  await visit("ageha");
  assert(isRepeat("ageha", played.at(-1)));
  assert.deepEqual(state.affinity.at(-1), ["ageha", 8]);
  await setup(1); state.flags._ch2_followup_done = { ageha: true };
  agehaLater = "ch1_ageha_bear_seat";
  DB.dialogues.ch1_ageha_bear_seat = { dialogue_id: agehaLater, lines: [{ speaker: "ageha", face: "smile", text: "席" }] };
  mode = "cancel";
  assert.equal((await visit("ageha")).used, false);
  assert.equal(state.flags._ageha_bear_seat_done, undefined);
}

// A short Ageha followup can lead into an unlocked story, with one shared settlement.
{
  await setup(1); heartLevel = 2; agehaStory = "remake_ch2_ageha_gyaru";
  DB.dialogues[agehaStory] = { dialogue_id: agehaStory, lines: [{ type: "choice", id: "fixture", choices: [] }] };
  const before = structuredClone(state);
  assert.equal((await visit("ageha")).used, true);
  assert.deepEqual(played, ["remake_ch2_ageha_followup", "remake_ch2_ageha_gyaru"]);
  assert(state.flags._ch2_followup_done.ageha && state.flags._ch2_read_remake_ch2_ageha_gyaru);
  assert.equal(state.money, before.money - 3000); assert.equal(state.stamina, before.stamina - 16);
  assert.equal(state.visits.ageha, before.visits.ageha + 1);
  assert.deepEqual(state.affinity, [["ageha", 16]]); assert.deepEqual(state.growth, [["sense", 4]]);
  agehaStory = null;
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
await loader.link(async spec => spec.includes("chapter-data") ? new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/core/chapter-data.js", root), "utf8"), { context: loaderContext }) : spec.includes("affinity-stages") ? new vm.SourceTextModule(stagesSource, { context: loaderContext }) : new vm.SyntheticModule(spec.includes("city-locations") ? ["CITY_BACKGROUNDS"] : spec.includes("core/data") ? ["DB"] : ["CH2_NIGHTS", "AGEHA_VISITS", "AGEHA_BADDAY", "STRAWBERRY_TRIAL_IDS"], function () {
  if (spec.includes("city-locations")) this.setExport("CITY_BACKGROUNDS", { kumicho: "room" });
  else if (spec.includes("core/data")) this.setExport("DB", loaderDB);
  else { this.setExport("CH2_NIGHTS", []); this.setExport("AGEHA_VISITS", []); this.setExport("AGEHA_BADDAY", null); this.setExport("STRAWBERRY_TRIAL_IDS", []); }
}, { context: loaderContext }));
await loader.evaluate();
const validatedIds = [
  ...ids.map(id => `remake_ch2_${id}_repeat_e`),
  ...ids.map(id => `remake_ch2_${id}_followup`), ...["kumicho", "rei"].map(id => `remake_ch2_${id}_revisit`)];
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
// 31 本 + あげはの♥3の質問（#1988）＋あげは♥5の締めくくり（#2023）+ 神崎・レヰの小会話6本と締めくくり2本（#2027）
// + 今回の日常3本（#3097）+ レヰのライブの夜（RVE07）
// + あげはの小会話3本と地元の第2章の会話7本、tonariの大会準備9本（VOL13）＋中間の確認4本（#2032）
// + レヰのMELTY PUFFの挨拶回とシールの後日2本（#3468 A案）
assert.equal(Object.keys(loaderDB.dialogues).length, 70 +Object.values(CH2_VISIT_STORIES).flat().filter(entry => entry.file).length);
for (const suffix of ["b", "c", "d"]) assert(loaderDB.dialogues[`remake_ch2_ageha_repeat_${suffix}`], `ageha small talk ${suffix}`);
for (const id of ["cafe_ch2_commute", "cafe_ch2_taste", "kannon_ch2_wish", "choizap_ch2_numbers", "cs_ch2_haze", "ch2_rio_taste", "ch2_rio_strawberry"]) assert(loaderDB.dialogues[id], id);
for (const id of ["ch2_prep_basics_intro", "ch2_prep_basics_end", "ch2_prep_basics_failed", "ch2_prep_rehearsal_intro",
  ...["intro", "good", "rough", "failed"].map(result => `ch2_prep_midcheck_${result}`),
  ...["great", "good", "rough", "burnt", "drill"].map(result => `ch2_prep_rehearsal_${result}`)]) assert(loaderDB.dialogues[id], `craft prep ${id} is published`);
for (const id of ["kumicho", "rei"]) {
  assert(loaderDB.dialogues[`ch2_${id}_bond_finale`], `${id} finale is published`);
  for (const suffix of ["b", "c", "d"]) assert(loaderDB.dialogues[`remake_ch2_${id}_repeat_${suffix}`]);
}
assert(loaderDB.dialogues.ch2_ageha_bond_question, "the ♥3 question is published with the ageha visits");
assert(loaderDB.dialogues.ch2_ageha_bond_finale, "the ♥5 finale is published with the ageha visits");
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
  for (const entry of CH2_VISIT_STORIES[id]) if (entry.after) state.flags[entry.after] = true;
  const before = structuredClone(state);
  const sequence = [...CH2_VISIT_STORIES[id].map(entry => entry.scene), "repeat", "repeat"];
  for (const scene of sequence) {
    const money = state.money, stamina = state.stamina;
    assert.equal((await visit(id)).used, true);
    if (scene === "repeat") assert(isRepeat(id, played.at(-1)), played.at(-1)); else assert.equal(played.at(-1), scene);
    assert.equal(state.money, money - 3000); assert.equal(state.stamina, stamina - 16);
  }
  assert.equal(state.flags._ch2_revisit_done[id], true);
  assert.equal(state.flags._ch2_talks[id], before.flags._ch2_talks[id] + sequence.length);
  // 長い段階会話は第1章の固有会話と同じ+16、続編・再訪・小会話は+8（#2027・AFB01）
  const gained = [...CH2_VISIT_STORIES[id].map(entry => [id, entry.file ? 16 : 8]), [id, 8], [id, 8]];
  assert.deepEqual(state.affinity, gained);
  assert.deepEqual(state.relationshipMemories, before.relationshipMemories); assert.deepEqual(state.lovers, before.lovers);
}
console.log("PASS: actual preparation/loader, three owners, old saves, once-only followups, cancellation/LOAD, atomic preflight");

// #2720: 組長♥3（「味は遠い」）は味の不調の後だけ。フラグの無い旧セーブもDAY6以降は待たせない（締めくくりへ届く）。
{
  const list = CH2_VISIT_STORIES.kumicho, at = list.findIndex(entry => entry.after);
  assert.equal(list[at]?.scene, "ch2_kumicho_fourth"); assert.equal(list[at].after, "_ch2_taste_distant");
  assert.equal(CH2_VISIT_STORIES.rei.some(entry => entry.after), false, "rei keeps heart-only stages");
  const spot = module.namespace.PREPARATION_SPOTS.find(s => s.charId === "kumicho");
  for (const [chapterDay, expected] of [[4, "repeat"], [5, "repeat"], [6, list[at].scene]]) {
    await setup(); state.money += 60000; heartLevel = 5; played = [];
    for (const entry of list.slice(0, at)) {
      if (entry.done) (state.flags[entry.done] ||= {}).kumicho = true;
      else state.flags[`_ch2_read_${entry.scene}`] = true;
    }
    state.day = 15 + chapterDay - 1; assert.notEqual(state.day % 7, spot.closedOn, "pick open days");
    assert.equal((await visit("kumicho")).used, true, `DAY${chapterDay}`);
    if (expected === "repeat") assert(isRepeat("kumicho", played.at(-1)), `DAY${chapterDay}: ${played.at(-1)}`);
    else assert.equal(played.at(-1), expected, `DAY${chapterDay}`);
  }
}
// #2027: 神崎・レヰの小会話は5種を巡回し、その前だけ昼夜の店のあいさつ。訪問列を読み終えた♥5で締めくくり、定休日は入れない。
const allStoriesRead = id => { for (const entry of CH2_VISIT_STORIES[id]) {
  if (entry.done) (state.flags[entry.done] ||= {})[id] = true; else state.flags[`_ch2_read_${entry.scene}`] = true;
} };
for (const id of ["kumicho", "rei"]) {
  await setup(); allStoriesRead(id); heartLevel = 5; state.money += 60000;
  const repeats = [];
  for (let n = 0; n < 5; n++) {
    const before = played.length;
    assert.equal((await visit(id)).used, true);
    const scenes = played.slice(before);
    assert.deepEqual(scenes, [`venue_${id}_day`, scenes[1]], "greeting first, then one small talk");
    assert(isRepeat(id, scenes[1])); repeats.push(scenes[1]);
  }
  assert.equal(new Set(repeats).size, 5, `${id}: five distinct small talks rotate`);
  // 締めくくり: 室内の背景で再生し、完読で+16。中断では請求・交流回数・好感度を残さない。
  finaleOpen.add(id); mode = "cancel";
  const before = structuredClone(state);
  assert.equal((await visit(id)).used, false);
  assert.equal(JSON.stringify(state), JSON.stringify(before), `${id}: cancelled finale leaves the visit unsettled`);
  mode = "ok"; finaleCalls = [];
  const money = state.money;
  assert.equal((await visit(id)).used, true);
  assert.equal(played.at(-1), `${id}:finale`, "no greeting before the finale");
  assert.deepEqual(finaleCalls.map(([who, opts]) => [who, opts.bg, opts.deferSave]), [[id, id, true]]);
  assert.equal(state.money, money - 3000); assert.deepEqual(state.affinity.at(-1), [id, 16]);
  // 訪問列が残っていれば、♥5でも締めくくりより段階会話が先
  await setup(); heartLevel = 5; finaleOpen.add(id);
  state.flags._ch2_followup_done = { [id]: true };
  await visit(id); assert.equal(played.at(-1), CH2_VISIT_STORIES[id][1].scene);
  // 定休日（day % 7）は支払い・会話・記録なしで断る。翌日は入れる。
  const spot = module.namespace.PREPARATION_SPOTS.find(s => s.charId === id);
  assert(Number.isInteger(spot.closedOn), `${id} has a weekly closing day`);
  await setup(); state.day = 14 + spot.closedOn; played = [];
  const closed = structuredClone(state);
  assert.equal((await visit(id)).used, false); assert.deepEqual(played, []);
  assert.equal(JSON.stringify(state), JSON.stringify(closed));
  state.day += 1; assert.equal((await visit(id)).used, true);
}
assert.equal(module.namespace.PREPARATION_SPOTS.find(s => s.charId === "ageha").closedOn, undefined, "ageha keeps her current hours");
// 準備期間（通算16〜27日・ch2開始15日）に、各店の定休日はちょうど1日だけ。
for (const [id, closedOn] of Object.entries(module.namespace.CH2_CLOSED_ON)) {
  assert.equal(Array.from({ length: 12 }, (_, i) => 16 + i).filter(day => day % 7 === closedOn).length, 1, id);
}
console.log("PASS: kumicho/rei small-talk rotation with greetings, ♥5 finale after the visit list, weekly closing day");

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

// #3097: added everyday talks run through the real published pool, with ordinary settlement only.
for (const id of ids) {
  const scene = `remake_ch2_${id}_repeat_e`;
  assert(loaderDB.dialogues[scene], `${scene} is published by the real preparation loader`);
  assert(loaderDB.dialogues[scene].lines.length >= 12);
  assert(loaderDB.dialogues[scene].lines.every(line => !line.type && typeof line.text === "string"));
  for (const outcome of ["ok", "cancel", "undefined", "throw"]) {
    await setup(4); DB.dialogues = { ...loaderDB.dialogues };
    if (CH2_VISIT_STORIES[id]) allStoriesRead(id);
    state.flags._ch2_followup_done = { [id]: true };
    const before = structuredClone(state); mode = outcome;
    if (outcome === "throw") await assert.rejects(visit(id), /injected play failure/);
    else {
      const result = await visit(id);
      assert.equal(result.used, outcome === "ok");
    }
    if (outcome !== "ok") {
      assert.deepEqual(state, before, `${scene}: ${outcome} does not settle any resource or relation`);
      continue;
    }
    assert.equal(played.at(-1), scene);
    assert.equal(state.money, before.money - 3000);
    assert.equal(state.stamina, before.stamina - 16);
    assert.equal(state.flags._ch2_talks[id], 5);
    assert.deepEqual(state.affinity, [[id, 8]]);
    assert.deepEqual(state.growth, [[{ ageha: "sense", kumicho: "guts", rei: "charm" }[id], 4]]);
    assert.deepEqual(state.lovers, before.lovers);
    assert.deepEqual(state.relationshipMemories, before.relationshipMemories);
    await visit(id);
    assert.equal(played.at(-1), `remake_ch2_${id}_repeat`, "the next ordinary talk wraps to the existing pool");
  }
}
console.log("PASS: three everyday talks are loaded, rotate, retain normal fees/rewards, and leave no settlement on interruption");

// RVE07: レヰのライブの夜。第2章で余りチケットを受け取った人が、第3章の東京へ発つ前の準備期間にレヰの店へ来たら、
// いつもの会話・段階より先に一度だけ。終演後の場面なので夜だけ。チケットが無い・第2章・出発後は出さない。中断では既読にしない。
{
  const live = "ch3_prep_rei_live";
  const homeScript = JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_rei.json", root), "utf8")).dialogues
    .find(d => d.dialogue_id === live);
  assert(homeScript?.lines?.length, "the live night script exists in ch2_rei.json");
  assert(loaderDB.dialogues[live], "the preparation loader publishes it with Rei's scripts");
  assert(homeScript.lines.some(line => line.type === "set_flag" && line.flag === `_talk_seen_${live}`), "the script marks itself read");
  const prepSave = (extra = {}) => {
    state.chapter = 3; state.slot = 1; state.flags._ch3_prep = { startDay: 1, days: 3, departed: false }; Object.assign(state.flags, extra);
  };
  await setup(2); DB.dialogues[live] = homeScript; prepSave({ _ch2_rei_ticket: true });
  assert.equal(module.namespace.reiLiveDue(state), true);
  mode = "cancel"; const before = structuredClone(state);
  assert.equal((await visit("rei")).used, false);
  assert.equal(played.at(-1), live);
  assert.deepEqual(state, before, "an interrupted live night leaves no fee, read mark or affinity");
  mode = "ok";
  assert.equal((await visit("rei")).used, true);
  assert.equal(played.at(-1), live, "the live night comes before the ordinary talk");
  assert.equal(state.flags[`_talk_seen_${live}`], true);
  assert.equal(module.namespace.reiLiveDue(state), false, "only once");
  await visit("rei"); assert.notEqual(played.at(-1), live, "the next visit is an ordinary one");
  for (const [label, prepare] of [
    ["no ticket", () => prepSave()],
    ["daytime (the scene is after the show)", () => { prepSave({ _ch2_rei_ticket: true }); state.slot = 0; }],
    ["chapter 2", () => { state.flags._ch2_rei_ticket = true; }],
    ["after departure", () => { prepSave({ _ch2_rei_ticket: true }); state.flags._ch3_prep.departed = true; }],
    ["script not loaded", () => { prepSave({ _ch2_rei_ticket: true }); delete DB.dialogues[live]; }],
  ]) {
    await setup(2); DB.dialogues[live] = homeScript; prepare();
    assert.equal(module.namespace.reiLiveDue(state), false, label);
  }
  // 神崎の店には出ない
  await setup(2); DB.dialogues[live] = homeScript; prepSave({ _ch2_rei_ticket: true });
  await visit("kumicho"); assert.notEqual(played.at(-1), live);
}
console.log("PASS: Rei's live night appears once during the chapter 3 departure prep for ticket holders");

