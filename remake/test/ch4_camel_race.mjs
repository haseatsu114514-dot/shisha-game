// 第4章ドバイ・ラクダレースの接続（ch4-camel-race.js）: 段階と日付・昼の行動の消費・自己ベスト・一度限りの育成報酬。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { advanceToChapterFour, completeChapterFourScene, endChapterFourDay, CH4_PROLOGUE } from "../js/chapters/ch4-progress.js";
import { chapterFourMapModel } from "../js/chapters/ch4-map-model.js";
import { CAMEL_FLAG, CAMEL_SCENES, CH4_CAMEL_SCENE_FILES, CAMEL_STAGES, camelRaceRecord, camelRaceDestination, camelRaceOpen,
  recordCamelRaceResult, consumeCamelRaceDaytime, advanceCamelRaceStage, resultSceneFor, camelSceneBg, CAMEL_TRACK_BG, CAMEL_SHOP_BG,
  CAMEL_DAILY_SPOT_ID, camelDailySpot } from "../js/chapters/ch4-camel-progress.js";
import { PLAY_REWARDS } from "../js/core/growth-board-data.js";
import { newGrowth, claimPlayRewards } from "../js/core/growth.js";
import { classifyFlag } from "../js/core/carry.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));

// 台本はすべて実在し、本文がある。登録ファイルは1つ。話者は characters.json に居る。
{
  const rows = readData("dialogue/ch4_camel_race").dialogues;
  const characters = new Set(readData("characters").map(c => c.id));
  assert.deepEqual(Object.keys(CH4_CAMEL_SCENE_FILES), ["ch4_camel_race"]);
  assert.deepEqual([...CH4_CAMEL_SCENE_FILES.ch4_camel_race].sort(), rows.map(row => row.dialogue_id).sort());
  for (const row of rows) {
    assert(row.lines.length >= 3, row.dialogue_id);
    for (const line of row.lines) if (line.speaker) assert(characters.has(line.speaker), `${row.dialogue_id}: ${line.speaker}`);
    // 大会の予告・結果に触れない（交流の時系列ルール: 大会前後どちらで読んでも成立する）。
    const text = row.lines.map(line => line.text || "").join("");
    assert(!/明日の大会|本番よろしく|いよいよ|優勝おめでとう|負けた/.test(text), `${row.dialogue_id} assumes a tournament timeline`);
  }
  assert(characters.has("saif") && characters.has("rashid"));
  assert.equal(camelSceneBg(CAMEL_SCENES.meet), CAMEL_SHOP_BG);
  assert.equal(camelSceneBg(CAMEL_SCENES.watch), CAMEL_TRACK_BG);
  assert.equal(camelSceneBg("ch4_festa"), null);
  assert.equal(resultSceneFor(1), CAMEL_SCENES.win); assert.equal(resultSceneFor(2), CAMEL_SCENES.place);
  assert.equal(resultSceneFor(3), CAMEL_SCENES.place); assert.equal(resultSceneFor(4), CAMEL_SCENES.last);
}

function dubaiFreeDay() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45 });
  value.flags._ch3_cleared = true;
  assert(advanceToChapterFour(value));
  for (const scene of CH4_PROLOGUE) assert(completeChapterFourScene(value, scene.id));
  assert.equal(value.phase, "daily");
  return value;
}
const camelOf = value => chapterFourMapModel(value).destinations.find(item => item.id === "camel");

// 段階0→1→2→3 を日付で進める。会話の段階は時間を使わず、レースは昼の行動を使う。
{
  const value = dubaiFreeDay();
  assert(camelRaceOpen(value));
  assert.deepEqual(camelRaceRecord(value), { stage: 0, meetDay: null, inviteDay: null, watched: false, plays: 0, lastPlayDay: null, best: null });
  const before = structuredClone(value);
  let camel = camelOf(value);
  assert.deepEqual(value, before, "Reading the destination mutated the save");
  assert.equal(camel.kind, "camel"); assert.equal(camel.consumes, false); assert.equal(camel.ok, true);
  assert.match(camel.label, /店員と話す/);
  assert.deepEqual(chapterFourMapModel(value).destinations.map(item => item.id), ["souq", "festa", "center_cafe", "tour_desk", "shop", "camel", "inn"]);
  // 知り合う（DAY1）。同じ日はまた話せない。翌日に誘われる。
  assert(advanceCamelRaceStage(value, CAMEL_SCENES.meet));
  assert(!advanceCamelRaceStage(value, CAMEL_SCENES.meet), "meeting twice does nothing");
  assert.equal(camelRaceRecord(value).stage, CAMEL_STAGES.met);
  assert.equal(camelRaceRecord(value).meetDay, value.day);
  camel = camelOf(value);
  assert.equal(camel.ok, false); assert.match(camel.why, /また明日/);
  assert(!advanceCamelRaceStage(value, CAMEL_SCENES.watch), "cannot skip to the track");
  assert.equal(endChapterFourDay(value), "next_day");
  camel = camelOf(value);
  assert.equal(camel.ok, true); assert.match(camel.label, /サイフとまた話す/); assert.equal(camel.consumes, false);
  assert(advanceCamelRaceStage(value, CAMEL_SCENES.invite));
  assert.equal(camelRaceRecord(value).stage, CAMEL_STAGES.invited);
  // 誘われた日はまだ行けない（レースは翌朝）。翌日の昼に行ける。夜（slot 1）は行けない。
  camel = camelOf(value);
  assert.equal(camel.ok, false); assert.match(camel.why, /明日の朝/); assert.equal(camel.consumes, true);
  assert.equal(endChapterFourDay(value), "next_day");
  camel = camelOf(value);
  assert.equal(camel.ok, true); assert.match(camel.label, /ラクダレース場へ/);
  value.slot = 1;
  assert.equal(camelOf(value).ok, false); assert.match(camelOf(value).why, /朝/);
  value.slot = 0;
  // 本番を見た記録は一度だけ。レース前に中断しても次はレースから（watched が残る）。
  assert(advanceCamelRaceStage(value, CAMEL_SCENES.watch));
  assert.equal(camelRaceRecord(value).watched, true);
  assert.equal(camelRaceRecord(value).stage, CAMEL_STAGES.invited, "the stage opens only after a finished race");
  // 初回完走: 記録・自己ベスト・昼の行動の消費。
  const day = value.day;
  const first = recordCamelRaceResult(value, { total: 61, rank: 3, grade: "B", time: 53.21 }, 2);
  assert.deepEqual(first, { firstClear: true, newBest: true, plays: 2 });
  assert(consumeCamelRaceDaytime(value));
  assert.equal(value.slot, 1);
  assert(!consumeCamelRaceDaytime(value), "the daytime slot is spent once");
  let record = camelRaceRecord(value);
  assert.equal(record.stage, CAMEL_STAGES.unlocked);
  assert.deepEqual(record.best, { total: 61, rank: 3, grade: "B", time: 53.21, chapter: 4, day });
  assert.equal(record.lastPlayDay, day);
  camel = camelOf(value);
  assert.equal(camel.ok, false); assert.match(camel.why, /今日はもう走った/); assert.match(camel.purpose, /自己ベスト 61/);
  // 日が変わって再挑戦。悪い結果では自己ベストは変わらず、良い結果で更新。報酬は初回だけ。
  assert.equal(endChapterFourDay(value), "next_day");
  assert.equal(value.slot, 0);
  camel = camelOf(value);
  assert.equal(camel.ok, true); assert.match(camel.label, /練習レース/); assert.equal(camel.consumes, true);
  const worse = recordCamelRaceResult(value, { total: 40, rank: 4, grade: "C", time: 60 });
  assert.deepEqual(worse, { firstClear: false, newBest: false, plays: 3 });
  assert.equal(camelRaceRecord(value).best.total, 61);
  const better = recordCamelRaceResult(value, { total: 92, rank: 1, grade: "S", time: 50.4 });
  assert.deepEqual(better, { firstClear: false, newBest: true, plays: 4 });
  assert.equal(camelRaceRecord(value).best.total, 92);
  assert.equal(recordCamelRaceResult(value, null), null);
  assert.equal(recordCamelRaceResult(value, { rank: 1 }), null, "a result without a score is not recorded");
  // 大会の進行・シェイクの秘匿には触れない。
  assert.equal(value.flags._ch4.part, "free");
  assert.equal(value.flags._ch4_sheikh_revealed, false);
  assert.deepEqual(value.stats, newState().stats, "no direct stat gains");
  // 壊れた保存は安全に読む。
  value.flags[CAMEL_FLAG] = { stage: 9, plays: "x", best: { total: "no" } };
  assert.deepEqual(camelRaceRecord(value), { stage: 3, meetDay: null, inviteDay: null, watched: false, plays: 0, lastPlayDay: null, best: null });
}

// 第4章の自由行動の外では出ない（プロローグ・前夜・大会・他章）。
{
  const value = newState();
  assert.equal(camelRaceDestination(value), null);
  const dubai = dubaiFreeDay();
  dubai.flags._ch4.part = "eve"; dubai.phase = "daily";
  assert.equal(camelRaceDestination(dubai), null);
  dubai.flags._ch4.part = "free"; dubai.phase = "tournament";
  assert.equal(camelRaceDestination(dubai), null);
  // 14日化で _ch4.part が無くなっても、ドバイ滞在中の daily なら開く。
  const future = newState(); Object.assign(future, { chapter: 4, phase: "daily", day: 60 });
  assert(camelRaceOpen(future));
  assert.equal(camelRaceDestination(future).kind, "camel");
}

// 心得の盤の「遊びのご褒美」: 初回完走で火種1つ、一度だけ。未完走では無し。周回の引き継ぎでは記録を捨てる（progression＝reset）。
{
  const reward = PLAY_REWARDS.find(item => item.id === "camel-finish");
  assert.deepEqual(reward, { id: "camel-finish", game: "camel", clears: 1, label: "ラクダレースを完走", gift: { sense: 1 } });
  const value = dubaiFreeDay();
  const g = newGrowth();
  assert.deepEqual(claimPlayRewards(g, value).filter(item => item.label === reward.label), []);
  recordCamelRaceResult(value, { total: 30, rank: 4, grade: "C", time: 62 });
  const got = claimPlayRewards(g, value).filter(item => item.label === reward.label);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].parts, [{ kind: "sense", n: 1 }]);
  recordCamelRaceResult(value, { total: 99, rank: 1, grade: "S", time: 50 });
  assert.deepEqual(claimPlayRewards(g, value).filter(item => item.label === reward.label), [], "claimed once");
  assert.equal(classifyFlag(CAMEL_FLAG), "progression");
}
// ドバイ14日の日常ループの地図（ch4-dubai-daily.js）: 段階で場所と押せる条件が変わる。読むだけで保存を変えない。
{
  const value = dubaiFreeDay();
  const fields = { region: "dubai", kind: "ch4_dubai" };
  const spotOf = () => camelDailySpot(value, fields);
  const before = structuredClone(value);
  let spot = spotOf();
  assert.deepEqual(value, before, "Building the daily spot mutated the save");
  assert.equal(spot.id, CAMEL_DAILY_SPOT_ID); assert.equal(spot.region, "dubai"); assert.equal(spot.kind, "ch4_dubai");
  assert.equal(spot.place, "camel"); assert.equal(spot.label, "Dr.fookah の店先"); assert.equal(spot.unavailable, "");
  assert.equal(spot.hasNew(), true);
  assert(Object.isFrozen(spot));
  advanceCamelRaceStage(value, CAMEL_SCENES.meet);
  spot = spotOf();
  assert.match(spot.unavailable, /また明日/); assert.equal(spot.unavailableTag, "また明日"); assert.equal(spot.hasNew(), false);
  value.day += 1;
  assert.equal(spotOf().unavailable, "");
  advanceCamelRaceStage(value, CAMEL_SCENES.invite);
  spot = spotOf();
  assert.equal(spot.label, "ラクダレース場"); assert.equal(spot.preview, CAMEL_TRACK_BG); assert.equal(spot.unavailableTag, "レースは明日の朝");
  value.day += 1;
  assert.equal(spotOf().unavailable, "", "the race opens the next daytime");
  value.slot = 1;
  assert.equal(spotOf().unavailableTag, "レースは昼だけ");
  value.slot = 0;
  recordCamelRaceResult(value, { total: 70, rank: 2, grade: "A", time: 52 });
  assert.equal(spotOf().unavailableTag, "今日はもう走った");
  assert.equal(spotOf().hasNew(), false, "replays are not new events");
  value.day += 1;
  assert.equal(spotOf().unavailable, "");
  assert.match(spotOf().desc, /自己ベスト 70/);
  value.flags._ch4.part = "eve";
  assert.equal(spotOf(), null, "not on the map after the free days");
}
console.log("ch4_camel_race: ok");
