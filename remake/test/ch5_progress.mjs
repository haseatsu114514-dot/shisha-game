import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { CH5_SCENE_BG, CH5_SCENE_BGM, CH5_DEFAULT_BGM, CH5_PROLOGUE, CH5_FREE_SCENES, CH5_MATCH_SCENES, CH5_AFTERMATH,
  CH5_ENDING_IDS, CH5_SCENE_FILES, canAdvanceToChapterFive, advanceToChapterFive, chapterFiveProgress,
  chapterFiveFreeRemaining, chapterFiveTimeoutPending, recordChapterFiveScheduleDecision,
  beginChapterFiveMatch, chapterFiveMatchOutcome, beginChapterFiveFinale,
  completeChapterFiveScene, recordChapterFiveSecondCup, chapterFiveSecondCupVotes, chapterFiveVoteTally,
  CH5_AUDIENCE, CH5_FIRST_CUP_VOTES, CH5_PREP_TRIALS, chapterFivePrepScene, chapterFivePreparation,
  chapterFivePrepPending, chapterFivePrepEcho, recordChapterFivePrepTrial,
  recordChapterFivePrepAdjustment } from "../js/chapters/ch5-progress.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));

// 場面表の全IDが台本に実在し、本文がある。夢の場面とテスト専用場面、後段（Q20）の場面は接続しない。
const files = { ch5_main: readData("dialogue/ch5_main").dialogues, ending: readData("dialogue/ending").dialogues };
const connected = [];
for (const [file, ids] of Object.entries(CH5_SCENE_FILES)) {
  for (const id of ids) {
    assert(files[file].some(row => row.dialogue_id === id && row.lines?.length), `${file}:${id}`);
    connected.push(id);
  }
}
for (const id of ["ch5_dream_in", "ch5_dream_out", "ch5_reflection_placeholder", "ending_relationship_pending"])
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
roundTrip(value);
rejects(value, v => completeChapterFiveScene(v, "ch5_match_day_arrival"));

// scheduled の取り消し: timeout で free へ戻り、もう一度連絡できる。
{
  const cancelled = structuredClone(value);
  assert.equal(completeChapterFiveScene(cancelled, "ch5_timeout"), true);
  assert.equal(cancelled.flags._ch5.part, "free");
  assert.equal(cancelled.flags._ch5_match_scheduled, false);
  assert.equal(cancelled.flags._ch5.scheduleDecision, null);
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

// フィナーレ（恋人の epilogue が中間に来る分岐）も完走できる。
{
  const withEpilogue = toFinale();
  const scenes = ["ending_start", "epilogue_minto", "ending_daily_smoke"];
  assert.equal(beginChapterFiveFinale(withEpilogue, scenes), true);
  for (const id of scenes) assert.equal(completeChapterFiveScene(withEpilogue, id), true, id);
  assert.equal(withEpilogue.flags._ch5.part, "cleared");
  assert.equal(withEpilogue.flags._ch5_cleared, true);
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

console.log("PASS: Chapter 5 runner state keeps the road to the SHISHA-9000 finale in order");
