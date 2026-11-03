import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { selectStoryEnding } from "../js/core/story-routes.js";
import { chapterDay, relationshipElapsedDay } from "../js/core/chapter-clock.js";
import { CH5_SCENE_BG, CH5_SCENE_BGM, CH5_DEFAULT_BGM, CH5_PROLOGUE, CH5_FREE_SCENES, CH5_MATCH_SCENES, CH5_AFTERMATH,
  CH5_ENDING_IDS, CH5_SCENE_FILES, canAdvanceToChapterFive, advanceToChapterFive, chapterFiveProgress,
  chapterFiveFreeRemaining, chapterFiveTimeoutPending, recordChapterFiveScheduleDecision,
  beginChapterFiveMatch, chapterFiveMatchOutcome, chapterFiveEndingContext, beginChapterFiveFinale,
  completeChapterFiveScene, recordChapterFiveSecondCup, chapterFiveSecondCupVotes, chapterFiveVoteTally,
  CH5_AUDIENCE, CH5_FIRST_CUP_VOTES, CH5_PREP_TRIALS, chapterFivePrepScene, chapterFivePreparation,
  chapterFivePrepPending, chapterFivePrepEcho, recordChapterFivePrepTrial,
  recordChapterFivePrepAdjustment, CH5_LIME_CONDITION, CH5_LIME_MILESTONES,
  chapterFiveLimeDue, CH5_CREDITS_FLAG, chapterFiveCreditsPending, recordChapterFiveCredits,
  chapterFiveTrueEndReached, CH5_POST_ENDING, CH5_CONFLICT_SCENES, CH5_TALK_SCENES, chapterFivePostEndingContext,
  chapterFivePostEndingPlan, chapterFivePostEndingUndecided, beginChapterFivePostEnding, chapterFivePostEndingNext,
  chapterFivePostEndingUnresolved, completeChapterFivePostEnding } from "../js/chapters/ch5-progress.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));

// 場面表の全IDが台本に実在し、本文がある。夢の場面とテスト専用場面は接続しない。
const files = { ch5_main: readData("dialogue/ch5_main").dialogues, ending: readData("dialogue/ending").dialogues,
  relationship_conflicts: readData("dialogue/relationship_conflicts").dialogues };
const connected = [];
for (const [file, ids] of Object.entries(CH5_SCENE_FILES)) {
  for (const id of ids) {
    assert(files[file].some(row => row.dialogue_id === id && row.lines?.length), `${file}:${id}`);
    connected.push(id);
  }
}
for (const id of ["ch5_dream_in", "ch5_dream_out", "ch5_reflection_placeholder"])
  assert(!connected.includes(id), `${id} must stay unconnected`);
assert.equal(new Set(connected).size, connected.length, "A scene is listed twice");
// 背景の対応表は全接続場面を覆い、実在の bg だけを使う。
for (const id of connected) assert(CH5_SCENE_BG[id], `bg missing for ${id}`);
for (const bg of Object.values(CH5_SCENE_BG))
  assert(manifest.backgrounds.includes(`${bg}.png`), `unknown background ${bg}`);
// BGM の切替表（#1668 2-7）は接続済みの場面だけを指し、実在の曲だけを使う。
const hasBgm = key => manifest.bgm.some(file => file.replace(/\.[^.]+$/, "") === key);
assert(hasBgm(CH5_DEFAULT_BGM), `unknown bgm ${CH5_DEFAULT_BGM}`);
for (const [id, key] of Object.entries(CH5_SCENE_BGM)) {
  assert(connected.includes(id), `bgm for unconnected scene ${id}`);
  assert(hasBgm(key), `unknown bgm ${key}`);
}

// story_routes との整合: プロローグ後半は before_match[0]、後日談は after_match と同じ順。
const routes = readData("story_routes");
const r5 = routes.chapters["5"];
assert.equal(CH5_PROLOGUE[1].id, r5.before_match[0]);
assert.equal(r5.before_match[1], "ch5_unrecorded_day");
assert.deepEqual(r5.postpone, ["ch5_timeout"]);
assert.equal(CH5_MATCH_SCENES.firstCup, r5.first_cup[0]);
assert.equal(CH5_MATCH_SCENES.beforeSecond, r5.second_cup[0]);
assert.equal(CH5_MATCH_SCENES.win, r5.on_win[0]);
assert.equal(CH5_MATCH_SCENES.loss, r5.on_loss_or_tie[0]);
assert.deepEqual(CH5_AFTERMATH.map(scene => scene.id), r5.after_match);
for (const key of ["start", "normal", "daily"]) assert(CH5_ENDING_IDS.includes(routes.ending[key]), key);
for (const id of routes.heroine_ids) assert(CH5_ENDING_IDS.includes(routes.romance[id].epilogue), id);
// スタッフロールの後（IR32）: 修羅場と話し直しの場面は story_routes の conflict / romance と同じ。
assert.deepEqual(CH5_POST_ENDING, { open: routes.conflict.open, close: routes.conflict.close, pending: routes.conflict.pending_ending });
assert.deepEqual(Object.keys(CH5_CONFLICT_SCENES), routes.heroine_ids);
assert.deepEqual(Object.keys(CH5_TALK_SCENES), routes.heroine_ids);
for (const id of routes.heroine_ids) {
  assert.equal(CH5_CONFLICT_SCENES[id], routes.romance[id].conflict, id);
  assert.equal(CH5_TALK_SCENES[id], routes.romance[id].talk, id);
}
for (const id of [...Object.values(CH5_POST_ENDING), ...Object.values(CH5_CONFLICT_SCENES), ...Object.values(CH5_TALK_SCENES)])
  assert(connected.includes(id), `${id} is loaded by ch5`);
assert(!CH5_ENDING_IDS.includes(CH5_POST_ENDING.pending), "The pending scene is after the roll, not in the finale");
// 打ち上げの済みの印は ch5-party.js の PARTY_FLAG と同じ名前。
assert.match(readFileSync(new URL("../js/chapters/ch5-party.js", import.meta.url), "utf8"),
  /export const PARTY_FLAG = "_ch5_after_party";/);

function clearedCh4Save() {
  const value = newState();
  Object.assign(value, { chapter: 4, phase: "cleared", day: 60, slot: 1 });
  value.flags = { _ch4_cleared: true };
  value.stats = { technique: 41, sense: 42, guts: 43, charm: 44, insight: 45 };
  return value;
}
const roundTrip = value => assert.deepEqual(
  chapterFiveProgress(JSON.parse(JSON.stringify(value))), value.flags._ch5);
const rejects = (value, op) => {
  const prior = structuredClone(value);
  assert.equal(op(value), false);
  assert.deepEqual(value, prior, "A rejected operation must not change the state");
};
function entered() {
  const value = clearedCh4Save();
  assert.equal(advanceToChapterFive(value), true);
  return value;
}
function toFree() {
  const value = entered();
  for (const scene of CH5_PROLOGUE) assert.equal(completeChapterFiveScene(value, scene.id), true, scene.id);
  return value;
}
function toScheduled() {
  const value = toFree();
  assert.equal(completeChapterFiveScene(value, "ch5_unrecorded_day"), true);
  assert.equal(recordChapterFiveScheduleDecision(value, "decide"), true);
  assert.equal(completeChapterFiveScene(value, "ch5_schedule_contact"), true);
  return value;
}
function toBeforeSecond() {
  const value = toScheduled();
  assert.equal(beginChapterFiveMatch(value), true);
  for (const id of [CH5_MATCH_SCENES.arrival, CH5_MATCH_SCENES.firstCup, CH5_MATCH_SCENES.beforeSecond])
    assert.equal(completeChapterFiveScene(value, id), true, id);
  return value;
}
function toAftermath() {
  const value = toBeforeSecond();
  assert.equal(recordChapterFiveSecondCup(value, { total: 90, category: "steady" }), true);
  assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.win), true);
  assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.afterglow), true);
  return value;
}
function toFinale() {
  const value = toAftermath();
  for (const scene of CH5_AFTERMATH) assert.equal(completeChapterFiveScene(value, scene.id), true, scene.id);
  return value;
}

// 章の入口: 第4章を終えた保存だけが進める。
for (const change of [
  value => { value.chapter = 3; },
  value => { value.phase = "aftermath"; },
  value => { delete value.flags._ch4_cleared; },
  value => { value.flags._ch4_cleared = false; },
]) {
  const invalid = clearedCh4Save(); change(invalid);
  assert.equal(canAdvanceToChapterFive(invalid), false);
  rejects(invalid, advanceToChapterFive);
}
assert.equal(canAdvanceToChapterFive(null), false);
assert.throws(() => chapterFiveProgress(clearedCh4Save()));

const value = clearedCh4Save();
assert.equal(canAdvanceToChapterFive(value), true);
assert.equal(advanceToChapterFive(value), true);
assert.equal(value.chapter, 5);
assert.equal(value.day, 61);
assert.equal(value.slot, 0);
assert.equal(value.phase, "opening");
assert.deepEqual(value.statsAtChapterStart, value.stats);
assert.notEqual(value.statsAtChapterStart, value.stats);
assert.deepEqual(value.flags._ch5, { startDay: 61, stage: 0, part: "prologue", titleSeen: false,
  read: {}, scheduleDecision: null, aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null });
assert.equal(value.flags._ch5_match_scheduled, false);
assert.equal(value.flags._ch5_match_started, false);
assert.equal(value.flags._ch4_cleared, true, "The Chapter 4 clear record must stay");
assert.equal(chapterDay(value), 1, "Chapter 5 starts on local day 1");
assert.equal(relationshipElapsedDay(value), 117, "The existing relationship clock calculation is unchanged");
{
  const resumed = JSON.parse(JSON.stringify(value));
  resumed.day = 63;
  const beforeRead = structuredClone(resumed);
  assert.equal(chapterDay(resumed), 3, "A resumed Chapter 5 save uses its original start day");
  assert.deepEqual(chapterFiveProgress(resumed), resumed.flags._ch5);
  assert.equal(relationshipElapsedDay(resumed), 119);
  assert.deepEqual(resumed, beforeRead, "Reading both clocks and progress must not change a save");
}
for (const startDay of [undefined, null, 0, -1, 61.5, "61", Number.NaN]) {
  const legacy = { chapter: 5, day: 63, flags: { _ch5: { startDay } } };
  const beforeRead = structuredClone(legacy);
  assert.equal(chapterDay(legacy), 63, `Invalid startDay ${String(startDay)} keeps the old fallback`);
  assert.deepEqual(legacy, beforeRead);
}
assert.equal(chapterDay({ chapter: 5, day: 63, flags: {} }), 63, "Older saves without _ch5 keep the fallback");
for (const chapter of [1, 4])
  assert.equal(chapterDay({ chapter, day: 63, flags: { _ch5: { startDay: 61 } } }), 63);
for (const [chapter, field] of [[2, "_ch2_day1"], [3, "_ch3_intro"]])
  assert.equal(chapterDay({ chapter, day: 63, flags: { [field]: { startDay: 61 }, _ch5: { startDay: 50 } } }), 3);
assert.equal(canAdvanceToChapterFive(value), false, "A second advance must be refused");
rejects(value, advanceToChapterFive);
roundTrip(value);

// プロローグ: 順番どおりに2場面だけ。順番違い・別partの場面は確定しない。
for (const wrong of ["ch5_opening", "ch5_unrecorded_day", "ch5_schedule_contact", "ch5_timeout"])
  rejects(value, v => completeChapterFiveScene(v, wrong));
for (const [index, scene] of CH5_PROLOGUE.entries()) {
  assert.equal(value.flags._ch5.stage, index);
  assert.equal(completeChapterFiveScene(value, scene.id), true, scene.id);
  rejects(value, v => completeChapterFiveScene(v, scene.id));
  roundTrip(value);
}
assert.equal(value.flags._ch5.part, "free");
assert.equal(value.phase, "daily");

// 自由行動: 自由場面は順不同で1回ずつ。連絡の場面は選択の記録が先。
assert.deepEqual(chapterFiveFreeRemaining(value).map(scene => scene.id),
  CH5_FREE_SCENES.map(scene => scene.id));
rejects(value, v => completeChapterFiveScene(v, "ch5_timeout"));
rejects(value, v => completeChapterFiveScene(v, "ch5_schedule_contact"));
rejects(value, v => recordChapterFiveScheduleDecision(v, "bogus"));
assert.equal(value.flags._ch5.scheduleDecision, null);
assert.equal(completeChapterFiveScene(value, "ch5_free_tonari_practice"), true, "Free scenes are order-free");
rejects(value, v => completeChapterFiveScene(v, "ch5_free_tonari_practice"));
assert.deepEqual(chapterFiveFreeRemaining(value).map(scene => scene.id),
  ["ch5_free_mashiro_visit", "ch5_free_first_visitor", "ch5_free_eden_adam"]);
// #1588: EDEN の任意場面も自由行動の一つとして1回だけ読める（tonari の並びとは別の入口）。
assert.equal(CH5_FREE_SCENES.find(scene => scene.id === "ch5_free_eden_adam")?.location, "EDEN");
assert.equal(completeChapterFiveScene(value, "ch5_free_eden_adam"), true);
rejects(value, v => completeChapterFiveScene(v, "ch5_free_eden_adam"));
assert.deepEqual(chapterFiveFreeRemaining(value).map(scene => scene.id),
  ["ch5_free_mashiro_visit", "ch5_free_first_visitor"]);
assert.equal(completeChapterFiveScene(value, "ch5_unrecorded_day"), true);
rejects(value, v => completeChapterFiveScene(v, "ch5_unrecorded_day"));
roundTrip(value);

// defer 経路: 先送りは free のまま、timeout を読むまで決定が残り、読了で白紙に戻る。
{
  const deferred = toFree();
  assert.equal(recordChapterFiveScheduleDecision(deferred, "defer"), true);
  assert.equal(completeChapterFiveScene(deferred, "ch5_schedule_contact"), true);
  assert.equal(deferred.flags._ch5.part, "free");
  assert.equal(deferred.flags._ch5_match_scheduled, false);
  assert.equal(chapterFiveTimeoutPending(deferred), true);
  roundTrip(deferred);
  assert.equal(completeChapterFiveScene(deferred, "ch5_timeout"), true);
  assert.equal(deferred.flags._ch5.scheduleDecision, null);
  assert.equal(chapterFiveTimeoutPending(deferred), false);
  roundTrip(deferred);
}

// decide 経路: 記録直後（free のまま decide）の保存も検証を通る。確定で scheduled へ、phase は daily のまま。
assert.equal(recordChapterFiveScheduleDecision(value, "decide"), true);
assert.equal(value.flags._ch5.part, "free");
assert.doesNotThrow(() => chapterFiveProgress(JSON.parse(JSON.stringify(value))));
assert.equal(completeChapterFiveScene(value, "ch5_schedule_contact"), true);
assert.equal(value.flags._ch5.part, "scheduled");
assert.equal(value.flags._ch5_match_scheduled, true);
assert.equal(value.phase, "daily");
// 勝負は翌日（日常ループはその朝で終わる・#2033）。
assert.equal(value.flags._ch5.matchDay, value.day + 1);
roundTrip(value);
rejects(value, v => completeChapterFiveScene(v, "ch5_match_day_arrival"));

// scheduled の取り消し: timeout で free へ戻り、もう一度連絡できる。
{
  const cancelled = structuredClone(value);
  assert.equal(completeChapterFiveScene(cancelled, "ch5_timeout"), true);
  assert.equal(cancelled.flags._ch5.part, "free");
  assert.equal(cancelled.flags._ch5_match_scheduled, false);
  assert.equal(cancelled.flags._ch5.scheduleDecision, null);
  assert.equal(cancelled.flags._ch5.matchDay, undefined, "取り消した日程は勝負の日として残らない");
  roundTrip(cancelled);
  assert.equal(recordChapterFiveScheduleDecision(cancelled, "decide"), true);
  assert.equal(completeChapterFiveScene(cancelled, "ch5_schedule_contact"), true);
  assert.equal(cancelled.flags._ch5.part, "scheduled");
}

// 試合: begin でだけ match へ。順序は arrival → firstCup → beforeSecond → 二本目の制作 → 挙手の合計で勝敗。
assert.equal(beginChapterFiveMatch(value), true);
assert.equal(value.flags._ch5.part, "match");
assert.equal(value.flags._ch5_match_started, true);
assert.equal(value.phase, "tournament");
rejects(value, beginChapterFiveMatch);
assert.equal(chapterFiveMatchOutcome(value), null, "No outcome before the second cup is made");
rejects(value, v => recordChapterFiveSecondCup(v, { total: 90, category: "steady" }));
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.firstCup));
assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.arrival), true);
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.beforeSecond));
assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.firstCup), true);
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.win));
assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.beforeSecond), true);
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.afterglow));
// 二本目を作るまで、勝ちの場面も負けの場面も読めない。
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.win));
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.loss));
for (const bad of [{ total: 90, category: "bogus" }, { total: Number.NaN, category: "steady" }])
  rejects(value, v => recordChapterFiveSecondCup(v, bad));
assert.equal(recordChapterFiveSecondCup(value, { total: 90, category: "steady" }), true);
rejects(value, v => recordChapterFiveSecondCup(v, { total: 10, category: "offband" }));
assert.equal(chapterFiveMatchOutcome(value), "win");
assert.deepEqual(chapterFiveVoteTally(value), { first: { hajime: 19, machine: 21 },
  second: { hajime: 26, machine: 14 }, total: { hajime: 45, machine: 35 } });
roundTrip(value);
assert.equal(value.flags._ch5.secondCup.review, undefined, "Old-style records without review lines stay valid");
{
  // #1909: 結果カードの2行は任意で、文字列2行までだけを保存する。
  const reviewed = toBeforeSecond();
  assert.equal(recordChapterFiveSecondCup(reviewed, { total: 90, category: "steady",
    review: ["今回よかったこと：x", "", 3, "次に変える一つ：y", "z"] }), true);
  assert.deepEqual(reviewed.flags._ch5.secondCup.review, ["今回よかったこと：x", "次に変える一つ：y"]);
  roundTrip(reviewed);
  reviewed.flags._ch5.secondCup.review = [1];
  assert.throws(() => chapterFiveProgress(reviewed), "A malformed review must not pass save validation");
}
assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.win), true);
rejects(value, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.loss));
assert.equal(completeChapterFiveScene(value, CH5_MATCH_SCENES.afterglow), true);
assert.equal(value.flags._ch5.part, "aftermath");
assert.equal(value.flags._ch5.won, true);
assert.equal(value.phase, "aftermath");
roundTrip(value);

// 挙手: 一本目は台本どおり 9000 が僅かに先取。二本目は出来で動き、一方的にはならない。
assert.equal(CH5_FIRST_CUP_VOTES.hajime + CH5_FIRST_CUP_VOTES.machine, CH5_AUDIENCE);
assert(CH5_FIRST_CUP_VOTES.machine > CH5_FIRST_CUP_VOTES.hajime);
for (let total = 0; total <= 100; total += 1) {
  assert(chapterFiveSecondCupVotes(total) >= chapterFiveSecondCupVotes(Math.max(0, total - 1)), `monotonic at ${total}`);
  assert(chapterFiveSecondCupVotes(total) < CH5_AUDIENCE * 0.7, `not one-sided at ${total}`);
}
assert.equal(chapterFiveSecondCupVotes(100, true), chapterFiveSecondCupVotes(0));

// 勝敗は二本目の出来だけで変わる。能力値・任意場面の既読は二本目の制作を通してだけ効く。
{
  const outcomeFor = (total, category = "steady", failed = false, tweak = () => {}) => {
    const match = toBeforeSecond();
    tweak(match);
    assert.equal(recordChapterFiveSecondCup(match, { total, category, failed }), true);
    return chapterFiveMatchOutcome(match);
  };
  assert.equal(outcomeFor(95), "win");
  assert.equal(outcomeFor(78, "recovered"), "win");
  assert.equal(outcomeFor(76, "recovered"), "tie");
  assert.equal(outcomeFor(60, "offband"), "loss");
  assert.equal(outcomeFor(95, "steady", true), "loss", "An unserved cup cannot win");
  for (const level of [1, 100]) {
    const tweak = save => { for (const key of Object.keys(save.stats)) save.stats[key] = level; };
    assert.equal(outcomeFor(60, "offband", false, tweak), "loss");
    assert.equal(outcomeFor(90, "steady", false, tweak), "win");
  }
}

// 同数も負けと同じく、勝利フラグなしで後日談へ続く。
{
  const tied = toBeforeSecond();
  assert.equal(recordChapterFiveSecondCup(tied, { total: 76, category: "recovered" }), true);
  assert.equal(chapterFiveMatchOutcome(tied), "tie");
  rejects(tied, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.win));
  assert.equal(completeChapterFiveScene(tied, CH5_MATCH_SCENES.loss), true);
  assert.equal(tied.flags._ch5.won, false);
  for (const scene of CH5_AFTERMATH) assert.equal(completeChapterFiveScene(tied, scene.id), true, scene.id);
  assert.equal(tied.flags._ch5.part, "finale");
  roundTrip(tied);
}

// 勝ち固定の頃の保存（二本目の記録なしで勝ちの場面まで読んだ）は、そのまま余韻へ続けられる。
{
  const legacy = toBeforeSecond();
  delete legacy.flags._ch5.secondCup;
  legacy.flags._ch5.read[CH5_MATCH_SCENES.win] = true;
  assert.equal(chapterFiveMatchOutcome(legacy), "win");
  assert.equal(completeChapterFiveScene(legacy, CH5_MATCH_SCENES.afterglow), true);
  assert.equal(legacy.flags._ch5.won, true);
  const before = toBeforeSecond();
  delete before.flags._ch5.secondCup;
  assert.equal(chapterFiveMatchOutcome(before), null);
  assert.equal(recordChapterFiveSecondCup(before, { total: 60, category: "offband" }), true);
}

// 試合（負け・分岐）: 負け/同数は勝利フラグなしで後日談へ。余韻は入らない。
{
  const lost = toBeforeSecond();
  rejects(lost, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.afterglow));
  assert.equal(recordChapterFiveSecondCup(lost, { total: 55, category: "offband" }), true);
  assert.equal(chapterFiveMatchOutcome(lost), "loss");
  rejects(lost, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.win));
  assert.equal(completeChapterFiveScene(lost, CH5_MATCH_SCENES.loss), true);
  assert.equal(lost.flags._ch5.part, "aftermath");
  assert.equal(lost.flags._ch5.won, false);
  rejects(lost, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.afterglow));
  rejects(lost, v => completeChapterFiveScene(v, CH5_MATCH_SCENES.win));
  roundTrip(lost);
}

// 後日談: 順序どおり2場面でフィナーレへ。phase は aftermath のまま。
rejects(value, v => completeChapterFiveScene(v, CH5_AFTERMATH[1].id));
assert.equal(completeChapterFiveScene(value, CH5_AFTERMATH[0].id), true);
assert.equal(completeChapterFiveScene(value, CH5_AFTERMATH[1].id), true);
assert.equal(value.flags._ch5.part, "finale");
assert.equal(value.phase, "aftermath");
roundTrip(value);

// フィナーレ: begin の検証を通った3場面だけが、順序どおり確定できる。
rejects(value, v => completeChapterFiveScene(v, "ending_start"));
for (const bad of [
  ["ending_start", "ending_normal"],
  ["ending_daily_smoke", "ending_normal", "ending_start"],
  ["ending_start", "ending_normal", "ch5_opening"],
  ["ending_start", "ending_normal", "ending_daily_smoke", "ending_start"],
]) rejects(value, v => beginChapterFiveFinale(v, bad));
const FINALE = ["ending_start", "ending_normal", "ending_daily_smoke"];
assert.equal(beginChapterFiveFinale(value, FINALE), true);
assert.deepEqual(value.flags._ch5.finaleScenes, FINALE);
rejects(value, v => beginChapterFiveFinale(v, FINALE));
rejects(value, v => completeChapterFiveScene(v, "ending_normal"));
for (const id of FINALE) assert.equal(completeChapterFiveScene(value, id), true, id);
assert.equal(value.flags._ch5.part, "cleared");
assert.equal(value.flags._ch5_cleared, true);
assert.equal(value.phase, "cleared");
roundTrip(value);
rejects(value, v => completeChapterFiveScene(v, "ending_start"));

// スタッフロール（#517）: cleared になってから一度だけ確定する。確定前に再開すると、もう一度流す。
{
  const before = toFinale();
  assert.equal(chapterFiveCreditsPending(before), false, "Not before the finale is read");
  assert.equal(recordChapterFiveCredits(before), false);
  assert.equal(before.flags[CH5_CREDITS_FLAG], undefined);
  assert.equal(chapterFiveCreditsPending(value), true, "Pending right after the last ending scene");
  const resumed = structuredClone(value);
  assert.equal(chapterFiveCreditsPending(resumed), true, "A save closed during the roll plays it again");
  assert.equal(recordChapterFiveCredits(value), true);
  assert.equal(value.flags[CH5_CREDITS_FLAG], true);
  assert.equal(chapterFiveCreditsPending(value), false);
  assert.equal(recordChapterFiveCredits(value), false, "Recorded only once");
  assert.equal(value.flags._ch5.part, "cleared", "The roll does not change the chapter state");
  roundTrip(value);
}

// 真エンド（#1228 の周回解放条件）: 決着→フィナーレ→スタッフロールを流し終えたら到達。勝敗は問わない。
for (const won of [true, false]) {
  const ended = toBeforeSecond();
  assert.equal(recordChapterFiveSecondCup(ended, won ? { total: 90, category: "steady" } : { total: 55, category: "offband" }), true);
  for (const id of won ? [CH5_MATCH_SCENES.win, CH5_MATCH_SCENES.afterglow] : [CH5_MATCH_SCENES.loss])
    assert.equal(completeChapterFiveScene(ended, id), true, id);
  for (const scene of CH5_AFTERMATH) assert.equal(completeChapterFiveScene(ended, scene.id), true, scene.id);
  assert.equal(ended.flags._ch5.won, won);
  assert.equal(chapterFiveTrueEndReached(ended), false, `Not before the finale (won: ${won})`);
  assert.equal(beginChapterFiveFinale(ended, FINALE), true);
  for (const id of FINALE.slice(0, -1)) assert.equal(completeChapterFiveScene(ended, id), true, id);
  assert.equal(ended.flags._ch5.part, "finale");
  ended.flags[CH5_CREDITS_FLAG] = true; // 旗だけ先に立っていても、フィナーレの途中では到達しない
  assert.equal(chapterFiveTrueEndReached(ended), false, `Not during the finale (won: ${won})`);
  delete ended.flags[CH5_CREDITS_FLAG];
  assert.equal(completeChapterFiveScene(ended, FINALE.at(-1)), true);
  assert.equal(ended.flags._ch5.part, "cleared");
  assert.equal(chapterFiveTrueEndReached(ended), false, `Not while the first roll is pending (won: ${won})`);
  assert.equal(recordChapterFiveCredits(ended), true);
  assert.equal(chapterFiveTrueEndReached(ended), true, `Reached after the roll (won: ${won})`);
  assert.equal(chapterFiveTrueEndReached(structuredClone(ended)), true, "Read back from the save");
}

// フィナーレ（恋人の epilogue が中間に来る分岐）も完走できる。
{
  const withEpilogue = toFinale();
  const scenes = ["ending_start", "epilogue_minto", "ending_daily_smoke"];
  assert.equal(beginChapterFiveFinale(withEpilogue, scenes), true);
  for (const id of scenes) assert.equal(completeChapterFiveScene(withEpilogue, id), true, id);
  assert.equal(withEpilogue.flags._ch5.part, "cleared");
  assert.equal(withEpilogue.flags._ch5_cleared, true);
}

// 恋人の後日談の接続（#517）: 保存の lovers から中間の場面が決まる。恋人なし・複数・未解決は ending_normal。
{
  const routes = readData("story_routes");
  const ending = value => selectStoryEnding(routes, value, chapterFiveEndingContext(routes, value));
  const single = toFinale();
  assert.deepEqual(chapterFiveEndingContext(routes, single), { present: [], accepted: [], unresolved: [] });
  assert.deepEqual(ending(single), ["ending_start", "ending_normal", "ending_daily_smoke"], "No lover, no epilogue");
  for (const id of routes.heroine_ids) {
    const loved = toFinale();
    loved.lovers = [id];
    const scenes = ending(loved);
    assert.deepEqual(scenes, ["ending_start", routes.romance[id].epilogue, "ending_daily_smoke"], id);
    assert(CH5_ENDING_IDS.includes(scenes[1]), `${scenes[1]} is loaded by ch5`);
    assert.equal(beginChapterFiveFinale(loved, scenes), true, id);
  }
  const duplicated = toFinale();
  duplicated.lovers = ["rin", "rin", "steve"];
  assert.equal(ending(duplicated)[1], "epilogue_rin", "Duplicates and non-heroines are ignored");
  const two = toFinale();
  two.lovers = ["minto", "tsumugi"];
  assert.equal(ending(two)[1], "ending_normal", "Two lovers wait for the post-ending talk");
  const unresolved = toFinale();
  unresolved.lovers = ["minto"];
  unresolved.flags._story_shuraba_unresolved = true;
  assert.equal(ending(unresolved)[1], "ending_normal", "An unresolved conflict keeps the normal ending");
}

// スタッフロールの後の修羅場と話し直し（IR32）: 恋人なし・1人は何も足さない。2人以上は共通のエンディング→スタッフロール→
// 修羅場（開始→恋人ごとの反応→謝罪→話し直しの決意）→一人ずつの話し直し。読んだ人から未解決を外す。報酬は付けない。
{
  const routes = readData("story_routes");
  const toCleared = (lovers, flags = {}) => {
    const save = toFinale();
    save.lovers = [...lovers];
    Object.assign(save.flags, flags);
    const scenes = selectStoryEnding(routes, save, chapterFiveEndingContext(routes, save));
    assert.equal(beginChapterFiveFinale(save, scenes), true);
    for (const id of scenes) assert.equal(completeChapterFiveScene(save, id), true, id);
    return save;
  };
  const credits = save => { assert.equal(recordChapterFiveCredits(save), true); return save; };
  // 読む: 謝罪の台本は読んでいる間に _story_shuraba_unresolved を立てる（engine の set_flag）。ここではそれを再現する。
  const read = (save, id) => {
    if (id === CH5_POST_ENDING.close) save.flags._story_shuraba_unresolved = true;
    assert.equal(completeChapterFivePostEnding(save, id), true, id);
    roundTrip(save);
  };
  const readAll = save => {
    const order = [];
    for (let next; (next = chapterFivePostEndingNext(save));) { read(save, next.id); order.push(next.id); }
    return order;
  };
  const untouched = save => ({ money: save.money, stats: save.stats, statXp: save.statXp, day: save.day, slot: save.slot,
    stamina: save.stamina, phase: save.phase, finaleScenes: save.flags._ch5.finaleScenes, finale: save.flags._ch5.finale });

  // 恋人なし・1人: 並びは空で固定し、何も読まない（完了カード、初回はタイトルへ）。
  for (const lovers of [[], ["rin"]]) {
    const save = toCleared(lovers);
    assert.equal(save.flags._ch5.finaleScenes[1], lovers.length ? "epilogue_rin" : "ending_normal");
    assert.equal(chapterFivePostEndingUndecided(save), false, "Not before the roll");
    rejects(save, v => beginChapterFivePostEnding(v, chapterFivePostEndingPlan(routes, v)));
    credits(save);
    assert.equal(chapterFivePostEndingUndecided(save), true);
    const plan = chapterFivePostEndingPlan(routes, save);
    assert.deepEqual(plan, { kind: "none", scenes: [], unresolved: [] }, `lovers: ${lovers}`);
    assert.equal(beginChapterFivePostEnding(save, plan), true);
    assert.deepEqual(save.flags._ch5.postEnding, { scenes: [], step: 0, unresolved: [] });
    assert.equal(chapterFivePostEndingUndecided(save), false, "Decided once");
    assert.equal(chapterFivePostEndingNext(save), null);
    rejects(save, v => beginChapterFivePostEnding(v, plan));
    rejects(save, v => completeChapterFivePostEnding(v, CH5_POST_ENDING.open));
    roundTrip(save);
  }

  // 恋人2人・3人: 修羅場はその場の恋人全員の反応を順に、話し直しは同じ順に一人ずつ。
  for (const lovers of [["minto", "tsumugi"], ["rin", "hiyori", "samechan"]]) {
    const save = credits(toCleared(lovers));
    assert.deepEqual(save.flags._ch5.finaleScenes, ["ending_start", "ending_normal", "ending_daily_smoke"],
      "Two or more lovers keep the common ending before the roll");
    assert.equal(chapterFiveTrueEndReached(save), true, "The true end is the roll; the talk comes after it");
    assert.deepEqual(chapterFivePostEndingContext(routes, save), { present: lovers, unresolved: [] });
    const plan = chapterFivePostEndingPlan(routes, save);
    const conflict = [CH5_POST_ENDING.open, ...lovers.map(id => CH5_CONFLICT_SCENES[id]), CH5_POST_ENDING.close,
      CH5_POST_ENDING.pending];
    const talks = lovers.map(id => CH5_TALK_SCENES[id]);
    assert.deepEqual(plan, { kind: "conflict", scenes: [...conflict, ...talks], unresolved: lovers });
    const before = untouched(save);
    assert.equal(beginChapterFivePostEnding(save, plan), true);
    rejects(save, v => beginChapterFivePostEnding(v, plan));
    assert.deepEqual(chapterFivePostEndingUnresolved(save), lovers);
    assert.deepEqual(chapterFivePostEndingNext(save), { id: CH5_POST_ENDING.open, talk: null, index: 0, total: lovers.length });
    // 今読むべき場面だけ。先の反応・話し直しや、別の恋人の場面は確定しない。
    for (const wrong of [CH5_CONFLICT_SCENES[lovers[0]], CH5_POST_ENDING.close, talks[0], CH5_CONFLICT_SCENES.ageha, "ending_normal"])
      rejects(save, v => completeChapterFivePostEnding(v, wrong));
    // 修羅場の途中で保存→読み込み: 読み終えた場面の次から。
    read(save, CH5_POST_ENDING.open);
    read(save, CH5_CONFLICT_SCENES[lovers[0]]);
    const midConflict = JSON.parse(JSON.stringify(save));
    assert.equal(chapterFivePostEndingNext(midConflict).id, CH5_CONFLICT_SCENES[lovers[1]], "Resumes mid-conflict");
    rejects(midConflict, v => completeChapterFivePostEnding(v, CH5_POST_ENDING.open));
    for (const id of conflict.slice(2)) read(save, id);
    assert.equal(save.flags._story_shuraba_unresolved, true, "The apology leaves it unresolved");
    assert.deepEqual(chapterFivePostEndingUnresolved(save), lovers, "Nobody is resolved by the apology alone");
    // 話し直しは一人ずつ。読んだ人だけ未解決から外れ、途中で保存→読み込みしても次の人から。
    assert.deepEqual(chapterFivePostEndingNext(save), { id: talks[0], talk: lovers[0], index: 1, total: lovers.length });
    read(save, talks[0]);
    assert.deepEqual(chapterFivePostEndingUnresolved(save), lovers.slice(1));
    assert.equal(save.flags._story_shuraba_unresolved, true, "Still unresolved while someone waits");
    const midTalk = JSON.parse(JSON.stringify(save));
    assert.deepEqual(chapterFivePostEndingNext(midTalk), { id: talks[1], talk: lovers[1], index: 2, total: lovers.length });
    rejects(midTalk, v => completeChapterFivePostEnding(v, talks[0]));
    assert.deepEqual(readAll(save), talks.slice(1));
    assert.deepEqual(chapterFivePostEndingUnresolved(save), []);
    assert.equal(save.flags._story_shuraba_unresolved, undefined, "Released after every talk");
    assert.equal(chapterFivePostEndingNext(save), null);
    for (const id of [...conflict, ...talks]) assert.equal(save.flags._ch5.read[id], true, id);
    rejects(save, v => completeChapterFivePostEnding(v, talks.at(-1)));
    assert.deepEqual(untouched(save), before, "The post-ending pays nothing and does not move the day or the finale");
    assert.deepEqual(save.lovers, lovers, "Nobody is dumped or forgiven by the talk");
    assert.equal(save.flags._ch5.part, "cleared");
    assert.equal(chapterFiveTrueEndReached(save), true);
  }

  // 打ち上げで修羅場が済んでいれば（PTY02）、二度起こさず話し直しの決意→話し直しだけ。恋人全員が未解決。
  {
    const save = credits(toCleared(["tsumugi", "ageha"], { _ch5_after_party: true, _story_shuraba_unresolved: true }));
    assert.equal(save.flags._ch5.finaleScenes[1], "ending_normal");
    assert.deepEqual(chapterFivePostEndingContext(routes, save), { present: [], unresolved: ["tsumugi", "ageha"] });
    const plan = chapterFivePostEndingPlan(routes, save);
    assert.deepEqual(plan, { kind: "pending", scenes: [CH5_POST_ENDING.pending, CH5_TALK_SCENES.tsumugi, CH5_TALK_SCENES.ageha],
      unresolved: ["tsumugi", "ageha"] });
    assert.equal(beginChapterFivePostEnding(save, plan), true);
    assert.deepEqual(readAll(save), plan.scenes);
    assert.equal(save.flags._story_shuraba_unresolved, undefined);
  }
  // 打ち上げで修羅場が起きなかった（その時は恋人が1人だった）なら、スタッフロールの後に修羅場から。
  {
    const save = credits(toCleared(["mashiro", "rin"], { _ch5_after_party: true }));
    assert.equal(chapterFivePostEndingPlan(routes, save).kind, "conflict");
  }
  // 恋人がいないのに未解決の印だけ残る保存は、話し直す相手がいないので何も足さない。
  {
    const save = credits(toCleared([], { _story_shuraba_unresolved: true }));
    assert.deepEqual(chapterFivePostEndingPlan(routes, save), { kind: "none", scenes: [], unresolved: [] });
  }

  // 旧保存: この接続より前にスタッフロールまで見終えた保存（postEnding なし）も読めて、次に開いた時に並びを決める。
  {
    const legacy = JSON.parse(JSON.stringify(credits(toCleared(["minto", "rin"]))));
    assert.equal(legacy.flags._ch5.postEnding, undefined);
    roundTrip(legacy);
    assert.equal(chapterFivePostEndingUndecided(legacy), true);
    assert.equal(beginChapterFivePostEnding(legacy, chapterFivePostEndingPlan(routes, legacy)), true);
    assert.equal(chapterFivePostEndingNext(legacy).id, CH5_POST_ENDING.open);
    // 旧版で固定したフィナーレ（読みかけ）は差し替えない。恋人が2人なら、読み終えてスタッフロールの後に修羅場へ。
    const reading = toFinale();
    reading.lovers = ["minto", "rin"];
    assert.equal(beginChapterFiveFinale(reading, ["ending_start", "ending_normal", "ending_daily_smoke"]), true);
    assert.equal(completeChapterFiveScene(reading, "ending_start"), true);
    const resumed = JSON.parse(JSON.stringify(reading));
    rejects(resumed, v => beginChapterFiveFinale(v, ["ending_start", "epilogue_minto", "ending_daily_smoke"]));
    assert.equal(chapterFivePostEndingUndecided(resumed), false, "Not during the finale");
    for (const id of ["ending_normal", "ending_daily_smoke"]) assert.equal(completeChapterFiveScene(resumed, id), true, id);
    credits(resumed);
    assert.equal(chapterFivePostEndingPlan(routes, resumed).kind, "conflict");
  }

  // 壊れた並びの保存は throw。決めるのはスタッフロールの後だけ。
  const decided = () => {
    const save = credits(toCleared(["minto", "tsumugi"]));
    assert.equal(beginChapterFivePostEnding(save, chapterFivePostEndingPlan(routes, save)), true);
    return save;
  };
  for (const change of [
    save => { delete save.flags[CH5_CREDITS_FLAG]; },
    save => { save.flags._ch5.postEnding.step = 99; },
    save => { save.flags._ch5.postEnding.step = -1; },
    save => { save.flags._ch5.postEnding.unresolved = ["minto"]; },
    save => { save.flags._ch5.postEnding.unresolved = ["tsumugi", "minto"]; },
    save => { save.flags._ch5.postEnding.scenes.splice(1, 1); }, // 反応が1人だけの修羅場
    save => { save.flags._ch5.postEnding.scenes.push("epilogue_minto"); },
    save => { save.flags._ch5.postEnding.scenes = [CH5_POST_ENDING.pending]; save.flags._ch5.postEnding.unresolved = []; },
    save => { save.flags._ch5.postEnding = null; },
  ]) {
    const broken = JSON.parse(JSON.stringify(decided())); change(broken);
    assert.throws(() => chapterFiveProgress(broken));
  }
  {
    const early = toFinale();
    early.flags._ch5.postEnding = { scenes: [], step: 0, unresolved: [] };
    assert.throws(() => chapterFiveProgress(early), "Not decided before the finale ends");
  }
  for (const bad of [
    { scenes: [CH5_POST_ENDING.pending], unresolved: [] },
    { scenes: [CH5_POST_ENDING.pending, CH5_TALK_SCENES.rin], unresolved: ["minto"] },
    { scenes: [CH5_POST_ENDING.open, CH5_CONFLICT_SCENES.rin, CH5_POST_ENDING.close, CH5_POST_ENDING.pending, CH5_TALK_SCENES.rin],
      unresolved: ["rin"] },
    { scenes: ["ending_normal"], unresolved: [] },
    null,
  ]) rejects(credits(toCleared(["minto", "rin"])), v => beginChapterFivePostEnding(v, bad));
}

// 閉店後の試作（#1666）: 練習を読んでから、試作→再調整の順に1回だけ記録する。能力・日・所持金・体力は動かない。
for (const trial of CH5_PREP_TRIALS) for (const adjusted of [true, false]) {
  const prepared = toFree();
  assert.equal(chapterFivePrepPending(prepared), false, "Prep waits for the practice scene");
  rejects(prepared, v => recordChapterFivePrepTrial(v, trial.id));
  assert.equal(completeChapterFiveScene(prepared, "ch5_free_tonari_practice"), true);
  assert.equal(chapterFivePrepPending(prepared), true);
  assert.equal(chapterFivePreparation(prepared), null);
  const before = structuredClone(prepared);
  rejects(prepared, v => recordChapterFivePrepAdjustment(v, adjusted));
  rejects(prepared, v => recordChapterFivePrepTrial(v, "bogus"));
  assert.equal(recordChapterFivePrepTrial(prepared, trial.id), true);
  rejects(prepared, v => recordChapterFivePrepTrial(v, trial.id));
  rejects(prepared, v => recordChapterFivePrepAdjustment(v, "yes"));
  assert.equal(chapterFivePrepPending(prepared), true, "Re-adjustment is still to choose");
  assert.deepEqual(chapterFivePrepEcho(prepared, CH5_MATCH_SCENES.beforeSecond), [], "No echo before the choice is done");
  roundTrip(prepared);
  assert.equal(recordChapterFivePrepAdjustment(prepared, adjusted), true);
  rejects(prepared, v => recordChapterFivePrepAdjustment(v, !adjusted));
  assert.equal(chapterFivePrepPending(prepared), false);
  assert.deepEqual(chapterFivePreparation(prepared), { trial: trial.id, adjusted });
  for (const key of ["day", "slot", "money", "stamina", "stats"])
    assert.deepEqual(prepared[key], before[key], `${key} must not change by reading the prep`);
  roundTrip(prepared);
  // 結果は二杯目の前と帰店後の会話へ返る。勝ち・負けのどちらの後日談でも同じ返答を読む。
  const suffix = adjusted ? "adjusted" : "kept";
  assert.deepEqual(chapterFivePrepEcho(prepared, CH5_MATCH_SCENES.beforeSecond), [`ch5_prep_recall_${trial.id}_${suffix}`]);
  assert.deepEqual(chapterFivePrepEcho(prepared, "ch5_return_to_tonari"), [`ch5_prep_answer_${trial.id}_${suffix}`]);
  assert.deepEqual(chapterFivePrepEcho(prepared, "ch5_doctor_after_match"), []);
  for (const id of [chapterFivePrepScene("trial", trial.id), chapterFivePrepScene("adjust", trial.id),
    chapterFivePrepScene("keep"), ...chapterFivePrepEcho(prepared, CH5_MATCH_SCENES.beforeSecond),
    ...chapterFivePrepEcho(prepared, "ch5_return_to_tonari")]) assert(connected.includes(id), `${id} must be loaded`);
  assert.equal(completeChapterFiveScene(prepared, "ch5_unrecorded_day"), true);
  assert.equal(recordChapterFiveScheduleDecision(prepared, "decide"), true);
  assert.equal(completeChapterFiveScene(prepared, "ch5_schedule_contact"), true);
  assert.equal(beginChapterFiveMatch(prepared), true);
  assert.deepEqual(chapterFivePreparation(prepared), { trial: trial.id, adjusted }, "The record survives into the match");
  roundTrip(prepared);
}
// 旧保存（試作の記録なし）は試作なしで最後まで読め、返りの会話は足さない。
{
  const legacy = toAftermath();
  assert.equal(chapterFivePreparation(legacy), null);
  assert.deepEqual(chapterFivePrepEcho(legacy, "ch5_return_to_tonari"), []);
}

// 保存の検証: 壊れた保存・part とフラグの食い違いは throw。
for (const [base, change] of [
  [toFree(), save => { save.chapter = 4; }],
  [toFree(), save => { delete save.flags._ch5; }],
  [toFree(), save => { save.flags._ch5.part = "bogus"; }],
  [toFree(), save => { save.flags._ch5.part = "prologue"; }],
  [toFree(), save => { save.flags._ch5.read = []; }],
  [toScheduled(), save => { save.flags._ch5_match_scheduled = false; }],
  [toAftermath(), save => { save.flags._ch5.won = null; }],
  [toAftermath(), save => { save.flags._ch5.won = false; }],
  [toAftermath(), save => { save.flags._ch5.secondCup.votes.hajime = 41; }],
  [toAftermath(), save => { save.flags._ch5.secondCup.category = "bogus"; }],
  [toFree(), save => { save.flags._ch5.prep = { trial: "heat", adjusted: true }; }], // 練習の読了前
  [toFree(), save => { save.flags._ch5.read.ch5_free_tonari_practice = true; save.flags._ch5.prep = { trial: "bogus", adjusted: null }; }],
  [toFree(), save => { save.flags._ch5.read.ch5_free_tonari_practice = true; save.flags._ch5.prep = null; }],
]) {
  const broken = JSON.parse(JSON.stringify(base)); change(broken);
  assert.throws(() => chapterFiveProgress(broken));
}
{
  const cleared = toFinale();
  assert.equal(beginChapterFiveFinale(cleared, FINALE), true);
  for (const id of FINALE) completeChapterFiveScene(cleared, id);
  const noClearFlag = JSON.parse(JSON.stringify(cleared));
  delete noClearFlag.flags._ch5_cleared;
  assert.throws(() => chapterFiveProgress(noClearFlag));
  const shortFinale = toFinale();
  assert.equal(beginChapterFiveFinale(shortFinale, FINALE), true);
  shortFinale.flags._ch5.finaleScenes = FINALE.slice(0, 2);
  assert.throws(() => chapterFiveProgress(shortFinale));
}

// 節目の LIME（#1668 2-8）: 本文は data/lime_messages.json。第5章で実際に会った相手だけ、節目ごとに1通。
{
  const lime = readData("lime_messages").messages;
  const chapterFive = lime.filter(m => m.trigger_condition === CH5_LIME_CONDITION);
  const milestones = Object.values(CH5_LIME_MILESTONES);
  const width = text => [...text].reduce((sum, ch) => sum + (/[\x20-\x7e]/.test(ch) ? 0.5 : 1), 0);
  assert(chapterFive.length > 0, "Chapter 5 milestone messages must exist");
  for (const m of chapterFive) {
    assert.equal(m.chapter, 5, `${m.id}: chapter`);
    assert(milestones.includes(m.milestone), `${m.id}: milestone`);
    assert.equal(m.type, "chat", `${m.id}: no invitations from the final chapter`);
    // 送り主は、その場面で実際に話した相手（会っていない人物からの一斉の応援にしない）。
    const scene = files.ch5_main.find(row => row.dialogue_id === m.after_scene);
    assert(CH5_FREE_SCENES.some(entry => entry.id === m.after_scene) && scene, `${m.id}: after_scene`);
    assert(scene.lines.some(line => line.speaker === m.sender), `${m.id}: ${m.sender} must appear in ${m.after_scene}`);
    for (const line of m.messages) {
      assert.equal(line.sender, m.sender);
      assert(width(line.text) <= 48 && !line.text.includes("\n") && !line.text.endsWith("。"), `${m.id}: ${line.text}`);
    }
    assert(m.replies?.length >= 1, `${m.id}: the player can answer`);
    for (const reply of m.replies) {
      assert(width(reply.text) <= 19, `${m.id}: reply button too long: ${reply.text}`);
      assert(width(reply.response) <= 48, `${m.id}: ${reply.response}`);
      assert.equal(reply.affinity, 0, `${m.id}: the finale does not add affinity by LIME`);
    }
  }
  assert.equal(new Set(chapterFive.map(m => `${m.sender}:${m.milestone}`)).size, chapterFive.length, "One message per sender per milestone");

  const contacts = ids => id => ids.includes(id);
  const all = contacts(["mashiro", "adam", "tsumugi", "minto", "rin"]);
  const due = (save, milestone, has = all) => chapterFiveLimeDue(save, milestone, lime, has).map(m => m.id);
  const meet = (save, ...ids) => { for (const id of ids) save.flags._ch5.read[id] = true; return save; };

  // 節目の外では届かない。自由行動・試合中・フィナーレでは空。
  for (const save of [meet(toFree(), "ch5_free_mashiro_visit", "ch5_free_eden_adam"),
    meet(toBeforeSecond(), "ch5_free_mashiro_visit", "ch5_free_eden_adam"),
    meet(toFinale(), "ch5_free_mashiro_visit", "ch5_free_eden_adam")]) {
    for (const milestone of milestones) assert.deepEqual(due(save, milestone), []);
  }
  // 日程が決まった夜: 会った相手だけ。誰にも会っていなければ一通も届かない（連絡先があっても）。
  assert.deepEqual(due(toScheduled(), CH5_LIME_MILESTONES.prep), []);
  assert.deepEqual(due(meet(toScheduled(), "ch5_free_mashiro_visit"), CH5_LIME_MILESTONES.prep), ["lime_ch5_prep_mashiro"]);
  assert.deepEqual(due(meet(toScheduled(), "ch5_free_eden_adam"), CH5_LIME_MILESTONES.prep), ["lime_ch5_prep_adam"]);
  assert.deepEqual(due(meet(toScheduled(), "ch5_free_mashiro_visit", "ch5_free_eden_adam"), CH5_LIME_MILESTONES.afterMatch), []);
  // 連絡先が無ければ、会っていても届かない。判定は渡された関数だけで、連絡先を追加しない。
  {
    const save = meet(toScheduled(), "ch5_free_mashiro_visit", "ch5_free_eden_adam");
    const before = structuredClone(save);
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.prep, contacts(["adam"])), ["lime_ch5_prep_adam"]);
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.prep, contacts([])), []);
    assert.deepEqual(save, before, "Selecting messages must not change the save");
  }
  // 読み終えた（done）ものは再送しない。読み終える前に離れたもの（done でない）は届け直す。
  {
    const save = meet(toScheduled(), "ch5_free_mashiro_visit");
    save.inbox = [{ id: "lime_ch5_prep_mashiro", originId: "lime_ch5_prep_mashiro", msg: { sender: "mashiro" }, done: false }];
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.prep), ["lime_ch5_prep_mashiro"]);
    save.inbox[0].done = true;
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.prep), []);
  }
  // 勝負のあと: 後日談の1場面目（博士）を読んでから、tonari へ戻る前だけ。勝ち・負けで同じ。
  for (const save of [toAftermath(), (() => {
    const lost = toBeforeSecond();
    assert.equal(recordChapterFiveSecondCup(lost, { total: 55, category: "offband" }), true);
    assert.equal(completeChapterFiveScene(lost, CH5_MATCH_SCENES.loss), true);
    return lost;
  })()]) {
    meet(save, "ch5_free_mashiro_visit", "ch5_free_eden_adam");
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.afterMatch), [], "Not before the doctor's scene");
    assert.equal(completeChapterFiveScene(save, CH5_AFTERMATH[0].id), true);
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.afterMatch), ["lime_ch5_after_mashiro", "lime_ch5_after_adam"]);
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.prep), []);
    assert.equal(completeChapterFiveScene(save, CH5_AFTERMATH[1].id), true);
    assert.deepEqual(due(save, CH5_LIME_MILESTONES.afterMatch), [], "Not after returning to tonari");
  }
  // 第5章の場面で会っていない相手（つむぎ・みんと・くゆりなど）からは届かない。朝の配信条件にも乗らない。
  assert(chapterFive.every(m => ["mashiro", "adam"].includes(m.sender)));
}

console.log("PASS: Chapter 5 runner state keeps the road to the SHISHA-9000 finale in order");
