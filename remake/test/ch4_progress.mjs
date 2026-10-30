import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState } from "../js/core/state.js";
import { paidAction, applyStats } from "../js/core/stats.js";
import { CH4_PLACE_BG, CH4_SCENE_BG, CH4_SCENE_FILES, CH4_PROLOGUE, CH4_RESOLUTION, CH4_MANDATORY,
  CH4_TOURNAMENT_DAY, CH4_EVE_DAY, canAdvanceToChapterFour, advanceToChapterFour, chapterFourProgress,
  completeChapterFourScene, endChapterFourDay, finishChapterFourEve, chapterFourMandatory,
  chapterFourSecondAvailable, chapterFourSheikhRevealed, revealChapterFourSheikh,
  chapterFourTournamentOutcome, chapterFourAfterDefeat, recordChapterFourStrategy, CH4_PRIZE } from "../js/chapters/ch4-progress.js";
import { chapterFourMapModel, DUBAI_MAP_PLACES } from "../js/chapters/ch4-map-model.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));

// 場面表の全IDが台本に実在し、本文がある。空場面と恋人線は接続しない。
const files = { ch4_main: readData("dialogue/ch4_main").dialogues, ch4_spots: readData("dialogue/ch4_spots").dialogues };
const connected = [];
for (const [file, ids] of Object.entries(CH4_SCENE_FILES)) {
  for (const id of ids) {
    assert(files[file].some(row => row.dialogue_id === id && row.lines?.length), `${file}:${id}`);
    connected.push(id);
  }
}
for (const id of [...CH4_PROLOGUE, ...CH4_RESOLUTION].map(scene => scene.id)
  .concat(CH4_MANDATORY.flatMap(entry => [entry.id, entry.lead]).filter(Boolean))) assert(connected.includes(id), id);
for (const id of ["ch4_return", "ch4_samechan_dubai_evening", "ch4_hiyori_dubai_evening"])
  assert(!connected.includes(id), `${id} must stay unconnected`);
assert.equal(new Set(connected).size, connected.length, "A scene is listed twice");
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
// 勝ち側は南雲を屋敷・帰国の前に置く（CH4-CONNECTION-DESIGN 要点3。story_routes の順とは意図的に違う）。
assert.deepEqual(CH4_RESOLUTION.map(scene => scene.id),
  ["ch4_result", "ch4_nagumo_old_rival", "ch4_ending", "ch4_sumi_return", "ch4_two_tables"]);
assert.deepEqual([...routes.on_win].sort(), CH4_RESOLUTION.map(scene => scene.id).sort());
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
assert.equal(value.chapter, 4);
assert.equal(value.day, 46);
assert.equal(value.slot, 0);
assert.equal(value.phase, "opening");
assert.deepEqual(value.statsAtChapterStart, value.stats);
assert.notEqual(value.statsAtChapterStart, value.stats);
assert.equal(value.flags._ch4.day, 1);
assert.equal(value.flags._ch4.startDay, 46);
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
assert.equal(value.day, 46, "The prologue must not advance the calendar");

// 方針の選択は保存だけ。
assert.equal(recordChapterFourStrategy(value, "bogus"), false);
assert.equal(value.flags._ch4_strategy, undefined);
assert.equal(recordChapterFourStrategy(value, "peach"), true);
assert.equal(value.flags._ch4_strategy, "peach");

// 自由行動: 初日のマップ。路地裏は出ない。
let model = chapterFourMapModel(value);
assert.equal(model.mode, "day");
assert.equal(model.background, "bg_dubai_map");
assert.deepEqual(model.destinations.map(item => item.id), ["souq", "festa", "center_cafe", "inn"]);
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
assert.deepEqual(chapterFourMapModel(value).destinations.map(item => item.id), ["souq", "festa", "center_cafe", "inn"]);
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
assert.deepEqual(model.destinations.map(item => item.id), ["souq", "festa", "center_cafe", "alley_cafe", "inn"]);
assert.deepEqual(model.destinations.find(item => item.id === "alley_cafe").scenes, ["ch4_stranger_second"]);
assert.equal(model.daysLeft, 2);
secrecy();
assert.equal(completeChapterFourScene(value, "ch4_alley_cafe_quiet"), false, "Quiet visit needs the second meeting");
assert.equal(completeChapterFourScene(value, "ch4_stranger_second"), true);
assert.equal(chapterFourSecondAvailable(value), false);
assert.deepEqual(chapterFourMapModel(value).destinations.find(item => item.id === "alley_cafe").scenes, ["ch4_alley_cafe_quiet"]);
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

// 勝ち側の本線: 南雲 → 屋敷 → 帰国の順。順番違いは確定しない。
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
  for (const scene of CH4_PROLOGUE) completeChapterFourScene(forced, scene.id);
  for (let step = 0; step < 3; step++) assert.equal(endChapterFourDay(forced), "next_day");
  assert.equal(endChapterFourDay(forced), "eve");
  assert.deepEqual(chapterFourMandatory(forced), [
    { id: "ch4_stranger_first", lead: "ch4_stranger_first_forced_in" },
    { id: "ch4_stranger_second", lead: null },
    { id: "ch4_wang_reception", lead: "ch4_wang_reception_forced_in" },
    { id: "ch4_stranger_third", lead: null },
  ]);
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
