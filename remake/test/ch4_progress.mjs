import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { newState, setState } from "../js/core/state.js";
import { paidAction, applyStats } from "../js/core/stats.js";
import { CH4_PLACE_BG, CH4_SCENE_BG, CH4_SCENE_FILES, CH4_VISITOR_SCENE_FILES, CH4_PROLOGUE, CH4_RESOLUTION, CH4_MANDATORY,
  CH4_ARRIVAL_SCENES, CH4_FRIEND_ARRIVAL_SCENES, chapterFourArrivalsDue, CH4_ARRIVAL_EVENING_SCENES, chapterFourArrivalEveningsDue,
  CH4_FRIEND_ARRIVAL_EVENING_SCENES,
  CH4_TOURNAMENT_DAY, CH4_EVE_DAY, canAdvanceToChapterFour, advanceToChapterFour, chapterFourProgress,
  completeChapterFourScene, endChapterFourDay, finishChapterFourEve, chapterFourMandatory,
  chapterFourSecondAvailable, chapterFourSheikhRevealed, revealChapterFourSheikh,
  chapterFourTournamentOutcome, chapterFourAfterDefeat, recordChapterFourStrategy, CH4_PRIZE,
  CH4_PREP_SCENES, chapterFourPrepPending, departChapterFour, chapterFourDaily, syncChapterFourDay, enterChapterFourEve,
  chapterFourEveDay, chapterFourTournamentDay, CH4_DAILY_EVE_DAY, CH4_DAILY_TOURNAMENT_DAY } from "../js/chapters/ch4-progress.js";
import { chapterFourMapModel, DUBAI_MAP_PLACES } from "../js/chapters/ch4-map-model.js";
import { OVERSEAS_HEROINES, chooseOverseasCompanion } from "../js/core/overseas-companion.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));

// 場面表の全IDが台本に実在し、本文がある。空場面と恋人線は接続しない。
const files = { ch4_main: readData("dialogue/ch4_main").dialogues, ch4_spots: readData("dialogue/ch4_spots").dialogues,
  ch4_arrival_daily: readData("dialogue/ch4_arrival_daily").dialogues };
const connected = [];
for (const [file, ids] of Object.entries(CH4_SCENE_FILES)) {
  for (const id of ids) {
    assert(files[file].some(row => row.dialogue_id === id && row.lines?.length), `${file}:${id}`);
    connected.push(id);
  }
}
for (const id of [...CH4_PROLOGUE, ...CH4_RESOLUTION].map(scene => scene.id)
  .concat(CH4_MANDATORY.flatMap(entry => [entry.id, entry.lead]).filter(Boolean))) assert(connected.includes(id), id);
assert(!connected.includes("ch4_return"), "ch4_return must stay unconnected");
// 到着の後の夕方（IR18）。別便で来る7人の恋人版と、恋人でないましろの友人版（#3097・2026-11-12 オーナー決定で広げた）。
// サメちゃん・ひよりは ch4_main、ほかの6本は ch4_arrival_daily から読み込む（_legacy へ移さない）。
assert.deepEqual(Object.keys(CH4_ARRIVAL_EVENING_SCENES), OVERSEAS_HEROINES);
for (const id of OVERSEAS_HEROINES) assert.equal(CH4_ARRIVAL_EVENING_SCENES[id], `ch4_${id}_dubai_evening`, id);
assert.deepEqual(CH4_FRIEND_ARRIVAL_EVENING_SCENES, { mashiro: "ch4_mashiro_dubai_friend_evening" });
assert.deepEqual(Object.keys(CH4_FRIEND_ARRIVAL_EVENING_SCENES), Object.keys(CH4_FRIEND_ARRIVAL_SCENES), "A friend evening needs a friend arrival");
for (const id of ["ch4_samechan_dubai_evening", "ch4_hiyori_dubai_evening"]) assert(CH4_SCENE_FILES.ch4_main.includes(id), id);
assert.deepEqual([...CH4_SCENE_FILES.ch4_arrival_daily].sort(), readData("dialogue/ch4_arrival_daily").dialogues.map(row => row.dialogue_id).sort(),
  "ch4_arrival_daily: all scenes registered");
for (const scene of [...Object.values(CH4_ARRIVAL_EVENING_SCENES), ...Object.values(CH4_FRIEND_ARRIVAL_EVENING_SCENES)]) {
  assert.equal(CH4_SCENE_BG[scene], "bg_dubai_inn_night", `${scene} is spent at the inn`);
  // 報酬・制御行を持たない（読むだけの場面。報酬は付けない）。
  const row = Object.values(files).flat().find(item => item.dialogue_id === scene);
  assert(row?.lines?.every(line => typeof line.text === "string" && !line.type && !/(上がった|下がった)。?$/.test(line.text)), `${scene}: plain lines only`);
}
assert.equal(new Set(connected).size, connected.length, "A scene is listed twice");
// ヒロイン来訪の台本は全ファイル（ch4_visitors と *_dubai）を読込登録し、本文があり、本編の場面表（CH4_SCENE_FILES）とは別に持つ。
const visitorFiles = readdirSync(new URL("../../data/dialogue/", import.meta.url))
  .map(name => name.replace(/\.json$/, "")).filter(name => /^ch4_(visitors|\w+_dubai)$/.test(name)).sort();
assert.deepEqual(Object.keys(CH4_VISITOR_SCENE_FILES).sort(), visitorFiles);
for (const [file, ids] of Object.entries(CH4_VISITOR_SCENE_FILES)) {
  const rows = readData(`dialogue/${file}`).dialogues;
  assert.deepEqual([...ids].sort(), rows.map(row => row.dialogue_id).sort(), `${file}: all scenes registered`);
  for (const id of ids) {
    assert(rows.some(row => row.dialogue_id === id && row.lines?.length), `${file}:${id}`);
    assert(!connected.includes(id), `${id} is registered apart from the main scene table`);
  }
}
// 別便の応援の到着場面: 恋人版は story_routes の romance[id].arrival と同じ。恋人版＋友人版で来訪の台本をちょうど覆う。
{
  const romance = readData("story_routes").romance;
  assert.deepEqual(Object.keys(CH4_ARRIVAL_SCENES), OVERSEAS_HEROINES);
  // ドバイに住むヌール（resident・DSR20）は渡航しないので到着場面を持たない
  for (const id of readData("story_routes").heroine_ids) assert.equal(CH4_ARRIVAL_SCENES[id], romance[id].resident ? undefined : romance[id].arrival, id);
  assert.equal(romance.noor.resident, "dubai"); assert.equal(romance.noor.arrival, null);
  assert.deepEqual([...Object.values(CH4_ARRIVAL_SCENES), ...Object.values(CH4_FRIEND_ARRIVAL_SCENES)].sort(),
    Object.values(CH4_VISITOR_SCENE_FILES).flat().sort());
  for (const scene of [...Object.values(CH4_ARRIVAL_SCENES), ...Object.values(CH4_FRIEND_ARRIVAL_SCENES)])
    assert.equal(CH4_SCENE_BG[scene], "bg_dubai_inn_day", `${scene} is met in the inn lobby`);
}
assert(readData("dialogue/ch4_rio_dubai").dialogues[0].lines
  .some(line => line.speaker === "rio" && line.text.includes("最重要サンプルの品質管理") && line.text.includes("業務は午後で終わり")),
"rio's visit pretext");
// 背景の対応表は全場面・全行き先を覆い、実在の bg だけを使う。
for (const id of connected) assert(CH4_SCENE_BG[id], `bg missing for ${id}`);
for (const bg of [...Object.values(CH4_SCENE_BG), ...Object.values(CH4_PLACE_BG)])
  assert(manifest.backgrounds.includes(`${bg}.png`), `unknown background ${bg}`);
for (const id of Object.keys(DUBAI_MAP_PLACES)) assert(CH4_PLACE_BG[id], `place bg missing for ${id}`);

// story_routes との整合: プロローグは before_eve の先頭3件＋宿、必須4場面は同じ順序。
const routes = readData("story_routes").chapters["4"];
assert.deepEqual(CH4_PROLOGUE.map(scene => scene.id),
  [...routes.before_eve.slice(0, 3), "ch4_arrival_inn"]);
const mandatoryIds = CH4_MANDATORY.map(entry => entry.id);
assert.deepEqual(routes.before_eve.filter(id => mandatoryIds.includes(id)), mandatoryIds);
assert.deepEqual(routes.after_eve, ["ch4_tournament_start", "ch4_final"]);
// 勝ち側の正本順と実行順は一致する。
assert.deepEqual(CH4_RESOLUTION.map(scene => scene.id),
  ["ch4_result", "ch4_sui_old_rival", "ch4_ending", "ch4_sumi_return", "ch4_two_tables"]);
assert.deepEqual(routes.on_win, CH4_RESOLUTION.map(scene => scene.id));
assert.deepEqual(routes.on_loss, ["ch4_defeat"]);

function clearedSave() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45, slot: 1 });
  value.flags = { _ch3_cleared: true, _ch3_aftermath: { version: 2, winDay: 42, stage: 6 }, _ch3_tournament_won: true };
  value.stats = { technique: 41, sense: 42, guts: 43, charm: 44, insight: 45 };
  return value;
}

// 章の入口: 第3章を終えた保存だけが進める。
for (const change of [
  value => { value.chapter = 2; },
  value => { value.phase = "aftermath"; },
  value => { delete value.flags._ch3_cleared; },
  value => { value.flags._ch3_cleared = false; },
]) {
  const invalid = clearedSave(); change(invalid);
  const prior = structuredClone(invalid);
  assert.equal(canAdvanceToChapterFour(invalid), false);
  assert.equal(advanceToChapterFour(invalid), false);
  assert.deepEqual(invalid, prior, "An unfinished save entered Chapter 4");
}
assert.equal(canAdvanceToChapterFour(null), false);
assert.throws(() => chapterFourProgress(clearedSave()));

const value = clearedSave();
assert.equal(canAdvanceToChapterFour(value), true);
assert.equal(advanceToChapterFour(value), true);
assert.equal(value.flags._ch4.routeVersion, 2, "New saves play Dubai on the daily loop (VOL04)");
delete value.flags._ch4.routeVersion; // 以下は旧行程（ドバイ5日・場面カード）を確かめる
assert.equal(value.chapter, 4);
assert.equal(value.day, 46);
assert.equal(value.slot, 0);
assert.equal(value.phase, "opening");
assert.deepEqual(value.statsAtChapterStart, value.stats);
assert.notEqual(value.statsAtChapterStart, value.stats);
assert.equal(value.flags._ch4.day, 1);
// 出発前の3日を地元で過ごしてからドバイへ（VOL02）。ドバイDAY1（startDay）は出発の朝に確定し直す。
assert.equal(value.flags._ch4.startDay, 49);
assert.deepEqual(value.flags._ch4_prep, { startDay: 46, days: 3, step: 0, departed: false });
assert.equal(value.flags._ch2_region, "home");
assert(chapterFourPrepPending(value));
assert.deepEqual(CH4_PREP_SCENES, ["ch4_sumi_training", "ch4_strategy"]);
assert.equal(value.flags._ch4.firstDay, null);
assert.equal(value.flags._ch4_sheikh_revealed, false);
assert.equal(chapterFourSheikhRevealed(value), false);
assert.equal(value.flags._ch3_cleared, true, "The Chapter 3 clear record must stay");
assert.equal(canAdvanceToChapterFour(value), false, "A second advance must be refused");
assert.equal(advanceToChapterFour(value), false);

const elapsed = () => value.day - value.flags._ch4.startDay + 1;
const readIds = () => Object.keys(value.flags._ch4.read);
const secrecy = () => {
  // 秘匿中は、行き先モデルのどの文字列にも固有名を出さない。
  const model = chapterFourMapModel(value);
  if (model) for (const word of ["シェイク", "sheikh"]) assert(!JSON.stringify(model).includes(word), word);
};
const roundTrip = () => {
  const clone = JSON.parse(JSON.stringify(value));
  assert.deepEqual(chapterFourProgress(clone), value.flags._ch4);
};

// プロローグ: 順番どおりに4場面だけ。順番違い・別partの場面は確定しない。
roundTrip();
assert.equal(chapterFourMapModel(value), null, "No map during the prologue");
for (const wrong of ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_tournament_start", "ch4_opening"]) {
  const prior = structuredClone(value);
  assert.equal(completeChapterFourScene(value, wrong), false, wrong);
  assert.deepEqual(value, prior);
}
for (const [index, scene] of CH4_PROLOGUE.entries()) {
  if (index === CH4_PREP_SCENES.length) {
    // 出発前の2場面（準備1日目の昼・夜）を読み終えた。準備3日の後の出発の朝でないと発てない。
    const early = structuredClone(value);
    assert.equal(departChapterFour(value), false, "Departure waits for the morning after the prep days");
    assert.deepEqual(value, early);
    value.day += 3; value.slot = 2; value.flags._ch2_region = "widehanga";
    assert.equal(departChapterFour(value), true);
    assert.deepEqual([value.flags._ch4_prep.departed, value.flags._ch4.startDay, value.slot, value.phase, value.flags._ch2_region],
      [true, 49, 0, "opening", "home"]);
    assert.equal(chapterFourPrepPending(value), false);
    assert.equal(departChapterFour(value), false, "Departure happens once");
    roundTrip();
  }
  if (index === 0) {
    // 出発前の場面を読まずに出発の朝になっても発てない（ch4.js が出発前に読ませる）。
    const unread = structuredClone(value);
    unread.day += 3;
    assert.equal(departChapterFour(unread), false, "The pre-departure scenes come first");
  }
  assert.equal(value.flags._ch4.stage, index);
  assert.equal(value.flags._ch4.part, "prologue");
  assert.equal(completeChapterFourScene(value, scene.id), true, scene.id);
  const checkpoint = structuredClone(value);
  assert.equal(completeChapterFourScene(value, scene.id), false, "A prologue scene committed twice");
  assert.deepEqual(value, checkpoint);
  roundTrip();
}
assert.equal(value.flags._ch4.part, "free");
assert.equal(value.phase, "daily");
assert.equal(value.flags._ch4.day, 1);
assert.equal(value.day, 49, "The prologue in Dubai must not advance the calendar");

// 方針の選択は保存だけ。
assert.equal(recordChapterFourStrategy(value, "bogus"), false);
assert.equal(value.flags._ch4_strategy, undefined);
assert.equal(recordChapterFourStrategy(value, "peach"), true);
assert.equal(value.flags._ch4_strategy, "peach");

// 自由行動: 初日のマップ。路地裏は出ない。
let model = chapterFourMapModel(value);
assert.equal(model.mode, "day");
assert.equal(model.background, "bg_dubai_map");
// 砂漠ツアーのデスク（ch4-desert-progress.js）は昼の寄り道。誘われるまではデスク、誘われたら砂丘に替わる。
assert.deepEqual(model.destinations.map(item => item.id), ["souq", "festa", "center_cafe", "tour_desk", "shop", "camel", "inn"]);
// Dr.fookah ドバイ店（NF03）: 場面を持たず、時間・体力を使わない買い物の行き先。
assert.equal(DUBAI_MAP_PLACES.shop.label, "Dr.fookah ドバイ店");
assert.deepEqual((({ kind, consumes, scenes, unreadCount }) => ({ kind, consumes, scenes, unreadCount }))(model.destinations.find(item => item.id === "shop")),
  { kind: "shop", consumes: false, scenes: [], unreadCount: 0 });
assert.deepEqual(model.destinations.find(item => item.id === "souq").scenes, ["ch4_dubai_souq", "ch4_stranger_first"]);
assert.deepEqual(model.destinations.find(item => item.id === "festa").scenes, ["ch4_festa"]);
assert.deepEqual(model.destinations.find(item => item.id === "center_cafe").scenes, ["ch4_dubai_cafe"]);
assert.deepEqual(model.destinations.find(item => item.id === "inn").scenes, [], "Tool care waits until DAY 2");
assert.equal(model.daysLeft, CH4_TOURNAMENT_DAY - 1);
assert.equal(model.venue.selectable, false);
assert.match(model.note, /あと4日/);
assert(!model.destinations.some(item => item.id === "venue"), "The venue must not be a destination before the tournament");
secrecy();
assert.equal(completeChapterFourScene(value, "ch4_inn_tool_care"), false, "Tool care before DAY 2");
assert.equal(completeChapterFourScene(value, "ch4_stranger_second"), false, "Second needs first");
assert.equal(completeChapterFourScene(value, "ch4_alley_cafe_quiet"), false);

// マップ訪問では日が進まない。souq の途中保存でも未読分だけ再生する。
const day = value.day, chapterDay = value.flags._ch4.day;
assert.equal(completeChapterFourScene(value, "ch4_dubai_souq"), true);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "souq").scenes, ["ch4_stranger_first"]);
assert.deepEqual(chapterFourMandatory(value).find(entry => entry.id === "ch4_stranger_first"),
  { id: "ch4_stranger_first", lead: null }, "A visited souq needs no forced lead-in");
assert.equal(completeChapterFourScene(value, "ch4_stranger_first"), true);
assert.equal(value.flags._ch4.firstDay, 1);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "souq").scenes, ["ch4_dubai_souq_revisit"]);
assert.equal(completeChapterFourScene(value, "ch4_festa"), true);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "festa").scenes, ["ch4_festa_revisit"]);
assert.equal(completeChapterFourScene(value, "ch4_festa_revisit"), true);
assert.equal(completeChapterFourScene(value, "ch4_dubai_cafe"), true);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "center_cafe").scenes, ["ch4_dubai_cafe_revisit"]);
assert.equal(completeChapterFourScene(value, "ch4_dubai_cafe_revisit"), true);
assert.equal(completeChapterFourScene(value, "ch4_dubai_souq_revisit"), true);
assert.equal(value.day, day, "Visiting places must not advance the calendar");
assert.equal(value.flags._ch4.day, chapterDay);
assert.deepEqual(chapterFourMapModel(value).destinations.map(item => item.id), ["souq", "festa", "center_cafe", "tour_desk", "shop", "camel", "inn"]);
secrecy();
roundTrip();

// 日は endChapterFourDay だけが進める。stranger_second は first を読んだ日 +2日以降（仮置き）。
assert.equal(chapterFourSecondAvailable(value), false);
assert.equal(endChapterFourDay(value), "next_day");
assert.equal(value.flags._ch4.day, 2);
assert.equal(value.day, day + 1);
assert.equal(elapsed(), 2);
assert.equal(chapterFourSecondAvailable(value), false, "DAY 2 is only one day after the first meeting");
assert(!chapterFourMapModel(value).destinations.some(item => item.id === "alley_cafe"), "The alley hides before the second unlocks");
assert.equal(completeChapterFourScene(value, "ch4_stranger_second"), false);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "inn").scenes, ["ch4_inn_tool_care"]);
assert.equal(completeChapterFourScene(value, "ch4_inn_tool_care"), true);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "inn").scenes, []);
secrecy();
assert.equal(endChapterFourDay(value), "next_day");
assert.equal(value.flags._ch4.day, 3);
assert.equal(elapsed(), 3);
assert.equal(chapterFourSecondAvailable(value), true);
model = chapterFourMapModel(value);
assert.equal(model.mode, "day", "DAY 3 still shows the midday map");
assert.equal(model.background, "bg_dubai_map");
assert.deepEqual(model.destinations.map(item => item.id), ["souq", "festa", "center_cafe", "alley_cafe", "tour_desk", "shop", "camel", "inn"]);
assert.deepEqual(model.destinations.find(item => item.id === "alley_cafe").scenes, ["ch4_stranger_second"]);
assert.equal(model.daysLeft, 2);
secrecy();
assert.equal(completeChapterFourScene(value, "ch4_alley_cafe_quiet"), false, "Quiet visit needs the second meeting");
assert.equal(completeChapterFourScene(value, "ch4_stranger_second"), true);
assert.equal(chapterFourSecondAvailable(value), false);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "alley_cafe").scenes, ["ch4_alley_cafe_quiet"]);
// 「使える」は既存の再訪行動の解放。未読の二度目とは別の場面で、保存を跨いでも残る。
const revisitSave = JSON.parse(JSON.stringify(value));
assert.match(chapterFourMapModel(revisitSave).destinations.find(item => item.id === "alley_cafe").purpose, /再訪できるようになった/);
const beforeRevisit = structuredClone(revisitSave);
assert.equal(completeChapterFourScene(revisitSave, "ch4_alley_cafe_quiet"), true);
assert.deepEqual(revisitSave.stats, beforeRevisit.stats, "Revisit must not award fixed-event stat growth");
assert.equal(revisitSave.money, beforeRevisit.money);
assert.equal(completeChapterFourScene(value, "ch4_alley_cafe_quiet"), true);
roundTrip();

// DAY4: 宿で終えると前夜へ。日はまだ進まない。
assert.equal(endChapterFourDay(value), "next_day");
assert.equal(value.flags._ch4.day, CH4_EVE_DAY);
model = chapterFourMapModel(value);
assert.equal(model.mode, "dusk", "The eve day shows the Dubai map at dusk");
assert.equal(model.background, "bg_dubai_map_dusk");
assert.equal(model.daysLeft, 1);
assert.match(model.destinations.find(item => item.id === "inn").label, /前夜/);
secrecy();
const eveDay = value.day;
assert.equal(endChapterFourDay(value), "eve");
assert.equal(value.flags._ch4.part, "eve");
assert.equal(value.flags._ch4.day, CH4_EVE_DAY);
assert.equal(value.day, eveDay);
assert.equal(chapterFourMapModel(value), null, "No map during the eve");
assert.equal(endChapterFourDay(value), null, "The eve cannot be ended as a free-time day");
roundTrip();
// 前夜の必須場面: 未読だけが story_routes の順で返り、繋ぎ場面は先に再生される。
assert.deepEqual(chapterFourMandatory(value), [
  { id: "ch4_wang_reception", lead: "ch4_wang_reception_forced_in" },
  { id: "ch4_stranger_third", lead: null },
]);
assert.equal(finishChapterFourEve(value), false, "The eve cannot end with mandatory scenes unread");
assert.equal(completeChapterFourScene(value, "ch4_festa_revisit"), false, "Free scenes are closed during the eve");
// third は reception より先に確定しない。繋ぎがある場面は本編より先に確定する。
assert.equal(completeChapterFourScene(value, "ch4_stranger_third"), false, "Third must wait for the reception");
assert.equal(completeChapterFourScene(value, "ch4_wang_reception"), false, "The lead-in comes first");
assert.equal(completeChapterFourScene(value, "ch4_wang_reception_forced_in"), true);
assert.deepEqual(chapterFourMandatory(value)[0], { id: "ch4_wang_reception", lead: null });
assert.equal(completeChapterFourScene(value, "ch4_wang_reception"), true);
assert.equal(finishChapterFourEve(value), false);
assert.equal(completeChapterFourScene(value, "ch4_stranger_third"), true);
assert.deepEqual(chapterFourMandatory(value), []);
assert.equal(finishChapterFourEve(value), true);
assert.equal(value.flags._ch4.part, "tournament");
assert.equal(value.flags._ch4.day, CH4_TOURNAMENT_DAY);
assert.equal(value.day, eveDay + 1);
assert.equal(value.phase, "tournament");
assert.equal(elapsed(), CH4_TOURNAMENT_DAY);
assert.equal(finishChapterFourEve(value), false, "The eve closes once");
roundTrip();
assert.equal(chapterFourSheikhRevealed(value), false, "The sheikh stays hidden until the tournament starts");

// 大会: start で正体を明かすが、勝敗は実制作の結果が確定するまで未確定。
assert.equal(chapterFourTournamentOutcome(value), null, "No result before crafting");
for (const id of ["ch4_final", "ch4_defeat", "ch4_result"]) assert.equal(completeChapterFourScene(value, id), false, id);
// defeat 経路は実結果を保存してから chapterFourAfterDefeat を通る。
const lost = structuredClone(value);
assert.equal(chapterFourAfterDefeat(lost), false, "AfterDefeat needs a read defeat");
revealChapterFourSheikh(lost);
assert.equal(completeChapterFourScene(lost, "ch4_tournament_start"), true);
assert.equal(completeChapterFourScene(lost, "ch4_defeat"), false, "No defeat scene before the result");
lost.flags._ch4.match = { version: 1, step: 9, voted: 1, history: [], result: { win: false } };
assert.equal(completeChapterFourScene(lost, "ch4_defeat"), true);
assert.equal(lost.flags._ch4.part, "tournament", "A defeat does not leave the tournament");
assert.equal(chapterFourAfterDefeat(lost), true);
assert.equal(lost.flags._ch4.part, "tournament");
assert.equal(lost.flags._ch4.attempts, 1);
for (const id of ["ch4_tournament_start", "ch4_final", "ch4_defeat"]) assert.equal(lost.flags._ch4.read[id], undefined, id);
assert.equal(lost.flags._ch4_sheikh_revealed, true, "The reveal is not undone by a retry");
assert.equal(lost.flags._ch4_cleared, undefined);
assert.equal(lost.day, value.day, "A retry must not rewind or advance the calendar");
assert.deepEqual(chapterFourProgress(JSON.parse(JSON.stringify(lost))), lost.flags._ch4);

revealChapterFourSheikh(value);
assert.equal(chapterFourSheikhRevealed(value), true);
assert.equal(completeChapterFourScene(value, "ch4_tournament_start"), true);
assert.equal(completeChapterFourScene(value, "ch4_final"), false, "No victory or prize before actual judging");
value.flags._ch4.match = { result: { win: true } };
roundTrip();
assert.equal(completeChapterFourScene(value, "ch4_final"), true);
assert.equal(value.flags._ch4.part, "resolution");
assert.equal(value.phase, "aftermath");
assert.equal(value.flags._ch4_cleared, undefined);

// 勝ち側の本線: 千須 → 屋敷 → 帰国の順。順番違いは確定しない。
for (const [index, scene] of CH4_RESOLUTION.entries()) {
  assert.equal(value.flags._ch4.resolution, index);
  const wrong = CH4_RESOLUTION[(index + 1) % CH4_RESOLUTION.length].id;
  const prior = structuredClone(value);
  assert.equal(completeChapterFourScene(value, wrong), false, wrong);
  assert.deepEqual(value, prior);
  assert.equal(completeChapterFourScene(value, scene.id), true, scene.id);
  roundTrip();
}
assert.equal(value.flags._ch4.part, "cleared");
assert.equal(value.flags._ch4_cleared, true);
assert.equal(value.phase, "cleared");
assert.equal(value.chapter, 4);
assert.equal(value.flags._ch3_cleared, true);
for (const id of [...CH4_PROLOGUE.map(scene => scene.id), ...mandatoryIds, "ch4_tournament_start", "ch4_final",
  ...CH4_RESOLUTION.map(scene => scene.id)]) assert(readIds().includes(id), `${id} was never committed`);
assert.equal(chapterFourMapModel(value), null);
assert.equal(completeChapterFourScene(value, "ch4_two_tables"), false, "A cleared chapter commits nothing");

// 前夜の強制: 何も読まずに前夜を迎えた場合、4場面すべてが story_routes 順で、繋ぎ付きで返る。
{
  const forced = clearedSave();
  advanceToChapterFour(forced);
  delete forced.flags._ch4.routeVersion; // 旧行程
  for (const scene of CH4_PROLOGUE) completeChapterFourScene(forced, scene.id);
  for (let step = 0; step < 3; step++) assert.equal(endChapterFourDay(forced), "next_day");
  assert.equal(endChapterFourDay(forced), "eve");
  assert.deepEqual(chapterFourMandatory(forced), [
    { id: "ch4_festa", lead: null },
    { id: "ch4_stranger_first", lead: "ch4_stranger_first_forced_in" },
    { id: "ch4_stranger_second", lead: null },
    { id: "ch4_wang_reception", lead: "ch4_wang_reception_forced_in" },
    { id: "ch4_stranger_third", lead: null },
  ]);
  assert.equal(completeChapterFourScene(forced, "ch4_stranger_first_forced_in"), false, "FESTA comes first on the eve");
  assert.equal(completeChapterFourScene(forced, "ch4_festa"), true);
  assert.equal(completeChapterFourScene(forced, "ch4_stranger_first_forced_in"), true);
  assert.equal(completeChapterFourScene(forced, "ch4_stranger_first"), true);
  assert.equal(forced.flags._ch4.firstDay, CH4_EVE_DAY, "A forced first meeting records its own day");
  for (const id of ["ch4_stranger_second", "ch4_wang_reception_forced_in", "ch4_wang_reception", "ch4_stranger_third"])
    assert.equal(completeChapterFourScene(forced, id), true, id);
  assert.equal(finishChapterFourEve(forced), true);
}

// 前夜日のマップは夕景。訪問しても切り替わらず、保存を復元しても夕景のまま。
{
  const eveDaySave = clearedSave();
  advanceToChapterFour(eveDaySave);
  delete eveDaySave.flags._ch4.routeVersion; // 旧行程
  for (const scene of CH4_PROLOGUE) completeChapterFourScene(eveDaySave, scene.id);
  for (let step = 0; step < 3; step++) assert.equal(endChapterFourDay(eveDaySave), "next_day");
  assert.equal(eveDaySave.flags._ch4.day, CH4_EVE_DAY);
  assert.equal(chapterFourMapModel(eveDaySave).mode, "dusk");
  assert.equal(chapterFourMapModel(eveDaySave).background, "bg_dubai_map_dusk");
  assert.equal(completeChapterFourScene(eveDaySave, "ch4_dubai_souq"), true);
  assert.equal(chapterFourMapModel(eveDaySave).background, "bg_dubai_map_dusk", "Visits must not switch the eve-day map back");
  const restored = JSON.parse(JSON.stringify(eveDaySave));
  assert.equal(chapterFourMapModel(restored).background, "bg_dubai_map_dusk", "A restored save keeps the dusk map");
}

// #1660 回帰: スポットの「上がった」表示は、エンジンの報酬解析（文頭が「……」の1文）に必ず乗る。
// 説明文の途中に埋めると解析が null になり、表示だけで加算されなかった。
for (const dialogue of files.ch4_spots.filter(row => ["ch4_dubai_souq", "ch4_dubai_cafe"].includes(row.dialogue_id))) {
  const cues = dialogue.lines.map(line => line.text || "").filter(text => text.includes("上がった"));
  assert.equal(cues.length, 1, `${dialogue.dialogue_id} has one reward cue`);
  assert(cues[0].startsWith("……"), `${dialogue.dialogue_id}: the cue must start the line: ${cues[0]}`);
  assert(/^……【(技術|センス|根性|魅力|洞察)】(と【(技術|センス|根性|魅力|洞察)】)?が少し上がった。$/.test(cues[0]), cues[0]);
}
{
  // 台本報酬は paidAction の中で読んだ時だけ、最大2能力各1P実際に入る。外では入らない。
  const gameState = clearedSave();
  gameState.stats = { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 };
  gameState.statXp = {};
  setState(gameState);
  applyStats({ sense: 3, insight: 3 });
  assert.equal(gameState.stats.sense, 10, "Reward outside an action must not add");
  await paidAction(() => { applyStats({ sense: 3, insight: 3 }); return true; }, { consumed: ok => ok });
  assert.equal(gameState.stats.sense, 11);
  assert.equal(gameState.stats.insight, 11);
  assert.equal(gameState.stats.technique, 10);
  await paidAction(() => { applyStats({ sense: 3 }); return false; }, { consumed: ok => ok });
  assert.equal(gameState.stats.sense, 11, "An interrupted visit must not pay");
}

// #1660: 大会に勝ったとき賞金を一度だけ付与する（敗北では付けない）。
{
  assert.equal(CH4_PRIZE, 200000, "decided chapter 4 prize");
  const prizeSave = clearedSave();
  advanceToChapterFour(prizeSave);
  delete prizeSave.flags._ch4.routeVersion; // 旧行程
  const progress = chapterFourProgress(prizeSave);
  Object.assign(progress, { part: "tournament", day: CH4_TOURNAMENT_DAY, stage: CH4_PROLOGUE.length });
  prizeSave.phase = "tournament";
  prizeSave.money = 1000;
  assert.equal(completeChapterFourScene(prizeSave, "ch4_tournament_start"), true);
  assert.equal(prizeSave.money, 1000, "Reading the start scene pays nothing");
  progress.match = { result: { win: false } };
  assert.equal(completeChapterFourScene(prizeSave, "ch4_defeat"), true);
  assert.equal(prizeSave.money, 1000, "Defeat pays nothing");
  progress.match.result = { win: true };
  assert.equal(completeChapterFourScene(prizeSave, "ch4_final"), true);
  assert.equal(prizeSave.money, 1000 + CH4_PRIZE);
  progress.part = "tournament"; progress.resolution = 0; // 再読・LOAD相当
  assert.equal(completeChapterFourScene(prizeSave, "ch4_final"), true);
  assert.equal(prizeSave.money, 1000 + CH4_PRIZE, "The prize is paid once");
}

// 保存の検証: 壊れた保存・part と日付の食い違いは throw。
for (const change of [
  save => { save.chapter = 3; },
  save => { delete save.flags._ch4; },
  save => { save.flags._ch4.day = CH4_TOURNAMENT_DAY + 1; },
  save => { save.flags._ch4.part = "bogus"; },
  save => { save.flags._ch4.read = []; },
  save => { save.flags._ch4.firstDay = save.flags._ch4.day + 1; },
  save => { save.flags._ch4.part = "prologue"; },
  save => { save.flags._ch4.part = "tournament"; },
  save => { delete save.flags._ch4_cleared; },
]) {
  const broken = JSON.parse(JSON.stringify(value)); change(broken);
  assert.throws(() => chapterFourProgress(broken));
}

console.log("PASS: Chapter 4 runner state keeps the Dubai days, mandatory scenes, tournament outcome and secrecy in order");

// ドバイも日常ループの行程（版2・VOL04）: DAY1〜12は日常、DAY13は前夜、DAY14が大会。章内日は暦に合わせる。
{
  const daily = clearedSave();
  assert(advanceToChapterFour(daily));
  assert(chapterFourDaily(daily));
  assert.deepEqual([chapterFourEveDay(daily), chapterFourTournamentDay(daily)], [CH4_DAILY_EVE_DAY, CH4_DAILY_TOURNAMENT_DAY]);
  for (const id of CH4_PREP_SCENES) assert(completeChapterFourScene(daily, id));
  daily.day += 3;
  assert(departChapterFour(daily));
  for (const scene of CH4_PROLOGUE.slice(CH4_PREP_SCENES.length)) assert(completeChapterFourScene(daily, scene.id));
  const p = daily.flags._ch4;
  assert.equal(p.part, "free");
  assert.equal(enterChapterFourEve(daily), false, "Not before the eve day");
  daily.day = p.startDay + 6;
  assert(syncChapterFourDay(daily));
  assert.equal(p.day, 7, "The chapter day follows the calendar");
  assert.equal(completeChapterFourScene(daily, "ch4_stranger_first_forced_in"), true, "The deadline lead can be read in free time");
  assert.equal(completeChapterFourScene(daily, "ch4_stranger_first_forced_in"), false, "Only once");
  assert.equal(completeChapterFourScene(daily, "ch4_stranger_first"), true);
  assert.equal(p.firstDay, 7);
  daily.day = p.startDay + 11; syncChapterFourDay(daily);
  assert.equal(p.day, 12);
  assert.equal(enterChapterFourEve(daily), false, "DAY12 is still a free day");
  daily.day = p.startDay + 12;
  assert.equal(enterChapterFourEve(daily), true);
  assert.deepEqual([p.part, p.day, daily.slot], ["eve", 13, 1]);
  assert.deepEqual(chapterFourProgress(JSON.parse(JSON.stringify(daily))), p, "The DAY13 eve is a valid save in the daily route");
  for (const entry of CH4_MANDATORY) for (const id of [entry.lead, entry.id].filter(Boolean)) completeChapterFourScene(daily, id);
  assert.deepEqual(chapterFourMandatory(daily), []);
  assert.equal(finishChapterFourEve(daily), true);
  assert.deepEqual([p.part, p.day, daily.day], ["tournament", 14, p.startDay + 13], "The world tournament is Dubai DAY14");
  console.log("PASS: Chapter 4 daily route keeps Dubai DAY1-12 free, the DAY13 eve and the DAY14 tournament");
}

// 別便の応援の到着（前夜祭の日）: 出発前に決めた supports だけ、前夜の part の前夜祭より前に、1人ずつ順に確定する。
{
  // 第3章クリア→第4章（版2）で同行を選び、ドバイDAY12まで進めた保存。
  const arrivalSave = (lovers, companion, { decide = true } = {}) => {
    const save = clearedSave();
    save.lovers = [...lovers];
    assert(advanceToChapterFour(save));
    if (decide) assert(chooseOverseasCompanion(save, companion));
    for (const id of CH4_PREP_SCENES) assert(completeChapterFourScene(save, id));
    save.day += 3;
    assert(departChapterFour(save));
    for (const scene of CH4_PROLOGUE.slice(CH4_PREP_SCENES.length)) assert(completeChapterFourScene(save, scene.id));
    save.day = save.flags._ch4.startDay + 11; syncChapterFourDay(save);
    return save;
  };
  const toEve = save => { save.day = save.flags._ch4.startDay + 12; assert(enterChapterFourEve(save)); return save; };
  const due = save => chapterFourArrivalsDue(save).map(entry => entry.scene);

  // 同行なし・恋人は凛想: 凛想（恋人版）→ ましろ（友人版）の順。自由行動の間は出さない。
  const save = arrivalSave(["rio"], null);
  assert.deepEqual(save.flags._overseas_companion.supports, ["rio", "mashiro"]);
  assert.deepEqual(chapterFourArrivalsDue(save), [], "No arrival during the Dubai daily days");
  assert.equal(completeChapterFourScene(save, "ch4_rio_dubai_girlfriend"), false, "An arrival is not a free-time scene");
  toEve(save);
  assert.deepEqual(chapterFourArrivalsDue(save), [
    { id: "rio", scene: "ch4_rio_dubai_girlfriend" },
    { id: "mashiro", scene: "ch4_mashiro_dubai_friend" },
  ]);
  // 1人ずつ順に。2人目・恋人でない人の恋人版・来ない人の到着は確定しない。
  for (const wrong of ["ch4_mashiro_dubai_friend", "ch4_mashiro_dubai_girlfriend", "ch4_tsumugi_dubai_girlfriend"]) {
    const prior = structuredClone(save);
    assert.equal(completeChapterFourScene(save, wrong), false, wrong);
    assert.deepEqual(save, prior);
  }
  const before = structuredClone(save);
  assert.equal(completeChapterFourScene(save, "ch4_rio_dubai_girlfriend"), true);
  assert.equal(completeChapterFourScene(save, "ch4_rio_dubai_girlfriend"), false, "An arrival commits once");
  assert.deepEqual([save.money, save.stats, save.day, save.flags._ch4.day, save.flags._ch4.part],
    [before.money, before.stats, before.day, before.flags._ch4.day, "eve"], "An arrival pays nothing and keeps the day");
  assert.deepEqual(due(save), ["ch4_mashiro_dubai_friend"]);
  // 到着待ちの間も必須場面は確定できる（旧保存・LOADを止めない）。
  const [required] = chapterFourMandatory(save);
  const blocked = structuredClone(save);
  assert.equal(completeChapterFourScene(blocked, required.lead || required.id), true, "Mandatory scenes stay committable");
  assert.equal(completeChapterFourScene(save, "ch4_mashiro_dubai_friend"), true);
  assert.deepEqual(chapterFourArrivalsDue(save), []);
  assert.deepEqual(chapterFourProgress(JSON.parse(JSON.stringify(save))), save.flags._ch4, "Arrival reads survive SAVE/LOAD");

  // 前夜祭が始まった後・前夜の過ごし方を記録した後は、到着を足さない。
  const festival = toEve(arrivalSave(["rio"], null));
  for (const id of ["ch4_festa", "ch4_stranger_first", "ch4_stranger_second"]) festival.flags._ch4.read[id] = true;
  assert.deepEqual(chapterFourMandatory(festival)[0], { id: "ch4_wang_reception", lead: "ch4_wang_reception_forced_in" });
  assert.deepEqual(due(festival), ["ch4_rio_dubai_girlfriend", "ch4_mashiro_dubai_friend"],
    "Scenes read before the festival keep the arrivals");
  assert.equal(completeChapterFourScene(festival, "ch4_wang_reception_forced_in"), true);
  assert.deepEqual(chapterFourArrivalsDue(festival), [], "No lobby arrival after the festival started");
  assert.equal(completeChapterFourScene(festival, "ch4_rio_dubai_girlfriend"), false);
  const evening = toEve(arrivalSave(["rio"], null));
  evening.flags._ch4_evening = { kind: "rest", participants: [] };
  assert.deepEqual(chapterFourArrivalsDue(evening), []);
  assert.equal(completeChapterFourScene(evening, "ch4_rio_dubai_girlfriend"), false);

  // 同行者は同じ便なので到着場面が無い。ましろが恋人なら恋人版。順は OVERSEAS_HEROINES。
  const companion = toEve(arrivalSave(["hiyori", "tsumugi", "mashiro"], "tsumugi"));
  assert.deepEqual(due(companion), ["ch4_mashiro_dubai_girlfriend", "ch4_hiyori_dubai_girlfriend"]);
  assert.equal(completeChapterFourScene(companion, "ch4_tsumugi_dubai_girlfriend"), false, "The companion has no arrival");
  // 同行の選択が無い旧保存は supports が空なので、ましろも含め到着を作らない。
  const undecided = toEve(arrivalSave(["rio"], null, { decide: false }));
  assert.equal(undecided.flags._overseas_companion, undefined);
  assert.deepEqual(chapterFourArrivalsDue(undecided), []);
  // 大会の後（tournament・resolution）は出さない。
  for (const part of ["tournament", "resolution"]) {
    const after = toEve(arrivalSave(["rio"], null));
    Object.assign(after.flags._ch4, { part, day: CH4_DAILY_TOURNAMENT_DAY });
    assert.deepEqual(chapterFourArrivalsDue(after), [], part);
    assert.equal(completeChapterFourScene(after, "ch4_rio_dubai_girlfriend"), false, part);
  }
  console.log("PASS: Chapter 4 separate-flight arrivals play once each, in order, before the eve festival, never for the companion");

  // IR18: 到着したサメちゃん・ひよりとは、到着の後、前夜祭の前に夕方を任意で一度過ごせる。
  const evenings = save => chapterFourArrivalEveningsDue(save).map(entry => entry.scene);
  const visit = arrivalSave(["samechan", "hiyori"], null);
  assert.deepEqual(evenings(visit), [], "No evening during the Dubai daily days");
  assert.equal(completeChapterFourScene(visit, "ch4_samechan_dubai_evening"), false);
  toEve(visit);
  assert.deepEqual(due(visit), ["ch4_mashiro_dubai_friend", "ch4_samechan_dubai_girlfriend", "ch4_hiyori_dubai_girlfriend"]);
  assert.deepEqual(evenings(visit), [], "The evening waits for every arrival");
  assert.equal(completeChapterFourScene(visit, "ch4_samechan_dubai_evening"), false, "Not before she arrives");
  for (const scene of due(visit)) assert(completeChapterFourScene(visit, scene));
  assert.deepEqual(chapterFourArrivalEveningsDue(visit), [
    { id: "mashiro", scene: "ch4_mashiro_dubai_friend_evening" },
    { id: "samechan", scene: "ch4_samechan_dubai_evening" },
    { id: "hiyori", scene: "ch4_hiyori_dubai_evening" },
  ]);
  const plain = structuredClone(visit);
  assert.equal(completeChapterFourScene(visit, "ch4_samechan_dubai_evening"), true);
  assert.equal(completeChapterFourScene(visit, "ch4_samechan_dubai_evening"), false, "An evening commits once");
  assert.deepEqual([visit.money, visit.stats, visit.day, visit.slot, visit.flags._ch4.day, visit.flags._ch4.part],
    [plain.money, plain.stats, plain.day, plain.slot, plain.flags._ch4.day, "eve"], "An evening pays nothing and keeps the day");
  assert.deepEqual(chapterFourMandatory(visit), chapterFourMandatory(plain), "An evening does not move the eve");
  assert.deepEqual(evenings(visit), ["ch4_mashiro_dubai_friend_evening", "ch4_hiyori_dubai_evening"]);
  // 任意なので、読まずに前夜祭へ進めば出ない。前夜の過ごし方の記録の後・大会の後も出さない。
  for (const id of ["ch4_festa", "ch4_stranger_first", "ch4_stranger_second"]) visit.flags._ch4.read[id] = true;
  assert.equal(completeChapterFourScene(visit, "ch4_wang_reception_forced_in"), true);
  assert.deepEqual(evenings(visit), [], "No evening after the festival started");
  assert.equal(completeChapterFourScene(visit, "ch4_hiyori_dubai_evening"), false);
  const settled = structuredClone(plain);
  settled.flags._ch4_evening = { kind: "rest", participants: [] };
  assert.deepEqual(evenings(settled), []);
  const later = structuredClone(plain);
  Object.assign(later.flags._ch4, { part: "tournament", day: CH4_DAILY_TOURNAMENT_DAY });
  assert.deepEqual(evenings(later), []);
  // 同行者（同じ便・到着場面なし）には夕方も無い。恋人でない人にも無い。
  const together = toEve(arrivalSave(["samechan", "hiyori"], "samechan"));
  for (const scene of due(together)) assert(completeChapterFourScene(together, scene));
  assert.deepEqual(evenings(together), ["ch4_mashiro_dubai_friend_evening", "ch4_hiyori_dubai_evening"],
    "The companion came on the same flight");
  assert.equal(completeChapterFourScene(together, "ch4_samechan_dubai_evening"), false);
  const friends = toEve(arrivalSave([], null));
  assert.deepEqual(due(friends), ["ch4_mashiro_dubai_friend"], "Only Mashiro comes when no one is a lover");
  for (const scene of due(friends)) assert(completeChapterFourScene(friends, scene));
  assert.deepEqual(chapterFourArrivalEveningsDue(friends), [{ id: "mashiro", scene: "ch4_mashiro_dubai_friend_evening" }]);
  for (const id of ["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori"])
    assert.equal(completeChapterFourScene(friends, CH4_ARRIVAL_EVENING_SCENES[id]), false, `${id}: no lover evening without dating`);
  assert.deepEqual(chapterFourProgress(JSON.parse(JSON.stringify(plain))), plain.flags._ch4, "Evening reads survive SAVE/LOAD");
  console.log("PASS: Chapter 4 arrival evenings: after the arrival, before the festival, once, never for the companion");

  // #3097: あげは・みんと・凛想・つむぎ・ましろ（恋人）にも、到着の後の夕方がある。恋人でないましろは友人版。
  const five = ["tsumugi", "minto", "rio", "ageha", "mashiro"];
  const all = arrivalSave(five, null);
  toEve(all);
  assert.deepEqual(due(all), five.map(id => CH4_ARRIVAL_SCENES[id]), "Lovers arrive with their lover versions");
  assert.deepEqual(evenings(all), [], "The evenings wait for every arrival");
  for (const id of five) assert.equal(completeChapterFourScene(all, CH4_ARRIVAL_EVENING_SCENES[id]), false, `${id}: not before arriving`);
  for (const scene of due(all)) assert(completeChapterFourScene(all, scene));
  assert.deepEqual(chapterFourArrivalEveningsDue(all), five.map(id => ({ id, scene: CH4_ARRIVAL_EVENING_SCENES[id] })));
  assert.equal(completeChapterFourScene(all, "ch4_mashiro_dubai_friend_evening"), false, "A lover Mashiro has no friend evening");
  const fresh = structuredClone(all);
  for (const id of five) {
    assert.equal(completeChapterFourScene(all, CH4_ARRIVAL_EVENING_SCENES[id]), true, id);
    assert.equal(completeChapterFourScene(all, CH4_ARRIVAL_EVENING_SCENES[id]), false, `${id}: an evening commits once`);
  }
  assert.deepEqual(evenings(all), [], "Every evening is read once");
  assert.deepEqual([all.money, all.stats, all.day, all.slot, all.flags._ch4.day, all.flags._ch4.part, all.affinity],
    [fresh.money, fresh.stats, fresh.day, fresh.slot, fresh.flags._ch4.day, "eve", fresh.affinity], "Evenings pay nothing and keep the day");
  assert.deepEqual(chapterFourMandatory(all), chapterFourMandatory(fresh), "Evenings do not move the eve");
  assert.equal(all.flags._ch4_evening, undefined, "Evenings are not the eve date");
  assert.deepEqual(chapterFourProgress(JSON.parse(JSON.stringify(all))), all.flags._ch4, "Evening reads survive SAVE/LOAD");
  // 前夜祭が始まった後・大会の後は出ない。
  const late = structuredClone(fresh);
  for (const id of ["ch4_festa", "ch4_stranger_first", "ch4_stranger_second"]) late.flags._ch4.read[id] = true;
  assert.equal(completeChapterFourScene(late, "ch4_wang_reception_forced_in"), true);
  assert.deepEqual(evenings(late), [], "No evening after the festival started");
  for (const id of five) assert.equal(completeChapterFourScene(late, CH4_ARRIVAL_EVENING_SCENES[id]), false, `${id} after the festival`);
  const after = structuredClone(fresh);
  Object.assign(after.flags._ch4, { part: "tournament", day: CH4_DAILY_TOURNAMENT_DAY });
  assert.deepEqual(evenings(after), [], "No evening after the tournament");
  // 同行者（同じ便）には夕方が無い。同行者と過ごす時間（BLC08・companion-time.js）と同じ人が重ならない。
  for (const companionId of five) {
    const trip = toEve(arrivalSave(five, companionId));
    for (const scene of due(trip)) assert(completeChapterFourScene(trip, scene));
    assert(!evenings(trip).includes(CH4_ARRIVAL_EVENING_SCENES[companionId]), `${companionId}: the companion has no arrival evening`);
    assert.deepEqual(evenings(trip), five.filter(id => id !== companionId).map(id => CH4_ARRIVAL_EVENING_SCENES[id]), companionId);
    assert.equal(completeChapterFourScene(trip, CH4_ARRIVAL_EVENING_SCENES[companionId]), false, companionId);
    assert.equal(completeChapterFourScene(trip, "ch4_mashiro_dubai_friend_evening"), false, `${companionId}: no friend evening for a lover`);
  }
  // 恋人でないましろ（視察）: 友人版の到着の後だけ友人版の夕方。恋人版は出さない。前夜の過ごし方の相手には数えない。
  const visit2 = toEve(arrivalSave(["rio"], null));
  assert.deepEqual(due(visit2), ["ch4_rio_dubai_girlfriend", "ch4_mashiro_dubai_friend"]);
  assert(completeChapterFourScene(visit2, "ch4_rio_dubai_girlfriend"));
  assert.deepEqual(evenings(visit2), [], "Mashiro's arrival comes before any evening");
  assert(completeChapterFourScene(visit2, "ch4_mashiro_dubai_friend"));
  assert.deepEqual(evenings(visit2), ["ch4_rio_dubai_evening", "ch4_mashiro_dubai_friend_evening"]);
  assert.equal(completeChapterFourScene(visit2, "ch4_mashiro_dubai_evening"), false, "A friend Mashiro has no lover evening");
  assert.equal(completeChapterFourScene(visit2, "ch4_mashiro_dubai_friend_evening"), true);
  assert.equal(completeChapterFourScene(visit2, "ch4_mashiro_dubai_friend_evening"), false, "The friend evening commits once");
  assert.deepEqual(evenings(visit2), ["ch4_rio_dubai_evening"]);
  // 一人一本: 友人版を読んだ後に恋人の記録へ変わった保存でも、同じ日に恋人版を重ねない（逆も同じ）。
  const swapped = structuredClone(visit2);
  swapped.lovers = ["rio", "mashiro"];
  swapped.flags._ch4.read.ch4_mashiro_dubai_girlfriend = true;
  assert(!evenings(swapped).includes("ch4_mashiro_dubai_evening"), "One evening per person");
  // 同行の選択が無い旧保存（supports が空）は到着が無いので、夕方も無い。
  const legacy = toEve(arrivalSave(five, null, { decide: false }));
  assert.deepEqual(evenings(legacy), []);
  console.log("PASS: Chapter 4 arrival evenings (#3097): five more lovers and the friend Mashiro, once each, never for the companion");
}

// 同じ日常・大会へ接続するスタッフ仕事の回帰。
await import("./ch4_staff_work.mjs");
