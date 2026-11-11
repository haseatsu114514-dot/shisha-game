// 第4章ドバイ・ラクダレースの接続（ch4-camel-race.js）: 段階と日付・昼の行動の消費・自己ベスト・一度限りの育成報酬。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { advanceToChapterFour, completeChapterFourScene, endChapterFourDay, CH4_PROLOGUE } from "../js/chapters/ch4-progress.js";
import { chapterFourMapModel } from "../js/chapters/ch4-map-model.js";
import { CAMEL_FLAG, CAMEL_SCENES, CH4_CAMEL_SCENE_FILES, CAMEL_STAGES, camelRaceRecord, camelRaceDestination, camelRaceOpen,
  recordCamelRaceResult, consumeCamelRaceDaytime, advanceCamelRaceStage, resultSceneFor, camelSceneBg, CAMEL_TRACK_BG, CAMEL_SHOP_BG,
  CAMEL_DAILY_SPOT_ID, camelDailySpot, availableCamelCups, CH5_CAMEL_MEET, chapterFiveCamelMeetDue, advanceChapterFiveCamelMeet } from "../js/chapters/ch4-camel-progress.js";
import { PLAY_REWARDS } from "../js/core/growth-board-data.js";
import { newGrowth, claimPlayRewards } from "../js/core/growth.js";
import { simulateRace, camelMastered, camelExpert, CAMEL_CUPS } from "../js/minigames/camel-race-model.js";
import { classifyFlag, buildCarryPackage } from "../js/core/carry.js";

const emptyCups = () => Object.fromEntries(CAMEL_CUPS.slice(1).map(cup => [cup.id, { qualified: false, mastered: false, best: null }]));
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
  assert(characters.has("faris") && characters.has("khalil"));
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
  assert.deepEqual(camelRaceRecord(value), { stage: 0, meetDay: null, inviteDay: null, watched: false, plays: 0, lastPlayDay: null, best: null, cups: emptyCups() });
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
  assert.equal(camel.ok, true); assert.match(camel.label, /ファーリスとまた話す/); assert.equal(camel.consumes, false);
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
  assert.deepEqual(camelRaceRecord(value), { stage: 3, meetDay: null, inviteDay: null, watched: false, plays: 0, lastPlayDay: null, best: null, cups: emptyCups() });
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
// 大会の段階、旧セーブ、複数走、夜の一度きりの精算と周回の保持。
{
  const value = dubaiFreeDay();
  assert.deepEqual(availableCamelCups(value), ["practice", "rookie"]);
  assert.equal(recordCamelRaceResult(value, simulateRace({ cup: "standard" }).score), null, "locked events cannot be recorded");
  assert.equal(value.flags._camel_cups, undefined, "rejected runs do not mutate the save");
  const rookie = simulateRace({ cup: "rookie", policy: "good" }).score;
  recordCamelRaceResult(value, rookie);
  assert.deepEqual(availableCamelCups(value), ["practice", "rookie", "standard"]);
  const standard = simulateRace({ cup: "standard", policy: "good" }).score;
  assert(camelMastered(standard));
  recordCamelRaceResult(value, standard);
  assert.deepEqual(availableCamelCups(value), CAMEL_CUPS.map(cup => cup.id));
  // 上級は、お手本の操作でも勝てない seed がある（2026-11-11 の調整。camel_race_model.mjs が割合を確かめる）。ここは記録の流れを見るので、勝てる seed を使う。
  const expert = simulateRace({ seed: 2, cup: "expert", policy: "perfect" }).score;
  assert(camelExpert(expert));
  recordCamelRaceResult(value, expert);
  assert(camelRaceRecord(value).cups.expert.mastered);
  const g = newGrowth();
  const rewards = claimPlayRewards(g, value);
  assert.deepEqual(rewards.find(row => row.label === "ラクダレース中級認定").parts, [{ kind: "any", n: 1 }]);
  assert.equal(rewards.filter(row => /ラクダ/.test(row.label)).length, 2, "old finish and new mastery are separate");
  assert.equal(g.rewards["camel-master"], true);
  assert.deepEqual(claimPlayRewards(g, JSON.parse(JSON.stringify(value))), [], "SAVE/LOAD cannot duplicate the gift");
  value.growth = g;
  assert.equal(classifyFlag("_camel_cups"), "unlock");
  const carry = buildCarryPackage(value);
  assert.deepEqual(carry.flags._camel_cups, value.flags._camel_cups);
  assert.equal(carry.growth.rewards["camel-master"], true);
  const next = dubaiFreeDay(); Object.assign(next.flags, carry.flags);
  assert.equal(next.flags._ch4_camel, undefined, "story progress resets for the next cycle");
  assert.deepEqual(availableCamelCups(next), CAMEL_CUPS.map(cup => cup.id));
  assert.deepEqual(claimPlayRewards(carry.growth, next), [], "NG+ cannot duplicate the gift");
  const cap = newGrowth(); cap.earned = 198;
  const capped = claimPlayRewards(cap, value).find(row => row.label === "ラクダレース中級認定");
  assert.deepEqual(capped.parts, [], "at the cap mastery is recorded without a false +1");
  assert.equal(cap.rewards["camel-master"], true);
}
// 第5章でドバイにいる日（chapters/ch5-dubai.js）: 第4章で一度でも走った人は、練習レースへまた通える。走っていない人は第5章の店先から
// （2026-11-07 オーナー決定）。第4章の店先の場面（「大会の人だ」「宿の前に迎えに行く」）は第5章では読まない。日付は通算の value.day。
{
  const fields = { region: "dubai", kind: "ch5_dubai", stamina: 0 };
  const raced = { stage: CAMEL_STAGES.unlocked, meetDay: 47, inviteDay: 48, watched: true, plays: 1, lastPlayDay: 49,
    best: { total: 61, rank: 3, grade: "B", time: 53.2, chapter: 4, day: 49 } };
  const chapterFive = (camel, region = "dubai") => {
    const value = newState();
    Object.assign(value, { chapter: 5, phase: "daily", day: 60, slot: 0 });
    value.flags._ch2_region = region;
    if (camel) value.flags[CAMEL_FLAG] = structuredClone(camel);
    return value;
  };
  let value = chapterFive(raced);
  const before = structuredClone(value);
  assert(camelRaceOpen(value));
  const destination = camelRaceDestination(value);
  assert.deepEqual([destination.ok, destination.consumes, destination.label], [true, true, "ラクダレース場で練習レース"]);
  let spot = camelDailySpot(value, fields);
  assert.deepEqual(value, before, "Building the Chapter 5 spot mutated the save");
  assert.deepEqual([spot.id, spot.kind, spot.region, spot.place, spot.label, spot.preview, spot.unavailable, spot.hasNew()],
    [CAMEL_DAILY_SPOT_ID, "ch5_dubai", "dubai", "camel", "ラクダレース場", CAMEL_TRACK_BG, "", false]);
  assert.match(spot.desc, /自己ベスト 61/);
  assert.doesNotMatch(spot.desc, /宿/, "Hajime stays at the Sheikh's residence in Chapter 5, not the inn");
  // 1日1回・昼だけ（第5章の通算の日で比べる。第4章の記録日 49 より後なので、最初の日から走れる）
  recordCamelRaceResult(value, { total: 70, rank: 2, grade: "A", time: 52 });
  spot = camelDailySpot(value, fields);
  assert.deepEqual([spot.unavailableTag, camelRaceRecord(value).lastPlayDay, camelRaceRecord(value).best.chapter], ["今日はもう走った", 60, 5]);
  value.day += 1;
  assert.equal(camelDailySpot(value, fields).unavailable, "");
  value.slot = 1;
  assert.equal(camelDailySpot(value, fields).unavailableTag, "レースは昼だけ");
  assert.equal(chapterFiveCamelMeetDue(value), false, "a Chapter 4 racer needs no shop-front meeting");
  // 2026-11-07 オーナー決定「第4章のラクダレースを飛ばしたプレイヤーも、第5章側で前提を補ってルートに入れる」:
  // 第4章で走っていない人（知らない・知り合っただけ・誘われただけ・本番を見ただけ）は、第5章では店先の場面（時間は使わない）から。
  // 読み終えると誘われた段階になり、翌日以降の昼にレース場（宿ではなく店の前で待ち合わせ）。本番を見た記録は残す。
  for (const camel of [null, { stage: 0 }, { stage: 1, meetDay: 47 }, { stage: 2, meetDay: 47, inviteDay: 48 }, { stage: 2, meetDay: 47, inviteDay: 48, watched: true }]) {
    const label = JSON.stringify(camel);
    value = chapterFive(camel);
    assert(camelRaceOpen(value), label);
    assert(chapterFiveCamelMeetDue(value), label);
    const meet = camelRaceDestination(value);
    assert.deepEqual([meet.ok, meet.consumes, meet.label], [true, false,
      (camel?.stage || 0) === 0 ? "Dr.fookah ドバイ店の店先で、店員と話す" : "Dr.fookah ドバイ店で、ファーリスに顔を出す"], label);
    spot = camelDailySpot(value, fields);
    assert.deepEqual([spot.label, spot.x, spot.y, spot.preview, spot.unavailable, spot.hasNew()], ["Dr.fookah の店先", 46, 42, CAMEL_SHOP_BG, "", true], label);
    assert.doesNotMatch(spot.desc, /宿|大会/, label);
    assert.equal(advanceChapterFiveCamelMeet(value), true, label);
    assert.equal(advanceChapterFiveCamelMeet(value), false, `${label}: only once`);
    const after = camelRaceRecord(value);
    assert.deepEqual([after.stage, after.inviteDay, after.watched, after.meetDay], [CAMEL_STAGES.invited, 60, camel?.watched === true, camel?.meetDay ?? 60], label);
    assert.equal(value.flags[CH5_CAMEL_MEET.flag], true, label);
    assert.equal(chapterFiveCamelMeetDue(value), false, label);
    spot = camelDailySpot(value, fields);
    assert.deepEqual([spot.label, spot.unavailable, spot.unavailableTag], ["ラクダレース場", "レースは明日の朝。六時に店の前で待ち合わせ", "レースは明日の朝"], label);
    value.day = 61;
    const race = camelRaceDestination(value);
    assert.deepEqual([race.ok, race.consumes], [true, true], `${label}: the next daytime goes to the track`);
    assert.equal(camelDailySpot(value, fields).hasNew(), true, label);
  }
  // 第4章は今までどおり（宿の前で迎えに来てくれる）。第5章の店先の判定は第4章では立たない
  value = newState();
  Object.assign(value, { chapter: 4, phase: "daily", day: 48, slot: 0 });
  value.flags[CAMEL_FLAG] = { stage: CAMEL_STAGES.invited, meetDay: 47, inviteDay: 48 };
  assert.equal(camelRaceDestination(value).why, "レースは明日の朝。宿の前で迎えに来てくれる", "Chapter 4 keeps the inn pick-up line");
  assert.equal(chapterFiveCamelMeetDue(value), false);
  assert.equal(advanceChapterFiveCamelMeet(value), false, "the Chapter 5 meeting never advances a Chapter 4 save");
  // 第5章でも、ドバイ以外（地元・隣町・東京）や自由行動の外では出ない。ほかの章の値でも開かない
  for (const region of ["home", "widehanga", "tokyo", null]) assert.equal(camelDailySpot(chapterFive(raced, region), fields), null, String(region));
  for (const region of ["home", "widehanga", "tokyo", null]) assert.equal(camelDailySpot(chapterFive(null, region), fields), null, `never raced, ${region}`);
  value = chapterFive(raced); value.phase = "tournament";
  assert.equal(camelRaceDestination(value), null, "not on the match day");
  for (const chapter of [3, 6]) { value = chapterFive(raced); value.chapter = chapter; assert.equal(camelRaceOpen(value), false, `chapter ${chapter}`); }
  // 第5章の再会の場面（ch5_dubai.json）: 話者は characters.json に居る。大会・王者・シェイクの正体・宿には触れない
  const characters = new Set(readData("characters").map(c => c.id));
  const reunion = readData("dialogue/ch5_dubai").dialogues.find(row => row.dialogue_id === "ch5_dubai_camel_again");
  assert(reunion?.lines.length >= 3, "ch5_dubai_camel_again exists");
  assert.deepEqual([...new Set(reunion.lines.map(line => line.speaker).filter(Boolean))].sort(), ["faris", "hajime", "khalil"]);
  for (const line of reunion.lines) if (line.speaker) assert(characters.has(line.speaker), line.speaker);
  assert.doesNotMatch(reunion.lines.map(line => line.text).join(""), /大会|王者|優勝|世界一|シェイク|宿/, "the reunion stays off the tournament and the inn");
  // 第5章の店先の場面: 第4章の段階（一時の印 _ch5_camel_known。0 会っていない・1 知り合った／誘われた・2 本番を見た）で分ける
  const shop = readData("dialogue/ch5_dubai").dialogues.find(row => row.dialogue_id === CH5_CAMEL_MEET.scene);
  assert(shop, "ch5_dubai_camel_meet exists");
  const known = shop.lines[0];
  assert.deepEqual([known.type, known.condition_type, known.flag, known.threshold, known.next_true, known.next_false],
    ["condition", "flag_count", "_ch5_camel_known", 1, "again", "first"]);
  for (const key of ["first", "again"]) assert(shop.branches[key]?.length >= 3, key);
  assert(shop.branches.first.some(line => line.type === "set_flag" && line.flag === "_met_faris"), "the first meeting introduces Faris");
  const watched = shop.branches.again.find(line => line.type === "condition");
  assert.deepEqual([watched.condition_type, watched.flag, watched.threshold], ["flag_count", "_ch5_camel_known", 2]);
  for (const key of [watched.next_true, watched.next_false]) assert(shop.branches[key]?.length, key);
  assert.match(JSON.stringify(shop.branches[watched.next_false]), /ロボット/, "players who never saw a race hear about the robot jockeys");
  assert.match(JSON.stringify(shop.branches[watched.next_true]), /理解の早い子/, "players who saw the race are remembered by Khalil");
  const shopRows = [shop.lines, ...Object.values(shop.branches)].flat();
  assert.deepEqual([...new Set(shopRows.map(line => line.speaker).filter(Boolean))].sort(), ["faris", "hajime"]);
  assert.doesNotMatch(JSON.stringify(shopRows), /大会|王者|優勝|世界一|シェイク|宿/, "the Chapter 5 shop front stays off the tournament and the inn");
  assert.equal(classifyFlag(CH5_CAMEL_MEET.flag), "progression");
  assert.equal(classifyFlag("_ch5_camel_known"), "progression");
  // ch5-dubai.js: 店先の場面は一時の印を立てて読み、後で消す。会い直したので、レース場の前の再会（日本に帰ったんじゃ…）は読まない
  const ch5Dubai = readFileSync(new URL("../js/chapters/ch5-dubai.js", import.meta.url), "utf8");
  assert.match(ch5Dubai, /if \(chapterFiveCamelMeetDue\(owner\)\) return meetFarisAtShop\(owner\)/);
  assert.match(ch5Dubai, /owner\.flags\[CH5_CAMEL_KNOWN\] = camel\.stage === CAMEL_STAGES\.unknown \? 0 : camel\.watched \? 2 : 1/);
  assert.match(ch5Dubai, /delete owner\.flags\[CH5_CAMEL_KNOWN\]/);
  assert.match(ch5Dubai, /owner\.flags\[CAMEL_AGAIN\.flag\] = true/);
}
// 初回の会話は読了まで待ち、再訪は直接レースへ。第5章の最初の再会だけは残す。
{
  const { runInNewContext } = await import("node:vm");
  const source = readFileSync(new URL("../js/chapters/ch4-camel-race.js", import.meta.url), "utf8")
    .replace(/^import [\s\S]*?;\n/gm, "").replace(/^export \*[^\n]*\n/gm, "").replace("export async function", "async function");
  const loadVisit = ({ stage = CAMEL_STAGES.unlocked, watched = true, readDone = true, current = true, aborted = false } = {}) => {
    const calls = [], owner = { flags: {}, day: 50, chapter: 4 };
    const camel = { stage, watched, plays: stage === CAMEL_STAGES.unlocked ? 1 : 0, cups: {} };
    const context = { state: owner, CAMEL_SCENES, CAMEL_STAGES,
      camelRaceDestination: () => ({ ok: true }), camelRaceRecord: () => camel,
      advanceCamelRaceStage: (_, id) => { calls.push(["advance", id]); return true; },
      save: () => calls.push(["save"]), availableCamelCups: () => [],
      paidAction: async work => ({ value: await work() }),
      runCamelRace: async options => { calls.push(["race", options.tutorial]); return { completed: false }; } };
    const visit = runInNewContext(source + "\nvisitCamelRace;", context);
    return { calls, run: (extra = {}) => visit({ host: {}, signal: { aborted }, isCurrent: () => current,
      read: async id => { calls.push(["read", id]); return readDone; },
      beforeRace: () => calls.push(["before"]), ...extra }) };
  };
  for (const [stage, scene] of [[CAMEL_STAGES.unknown, CAMEL_SCENES.meet], [CAMEL_STAGES.met, CAMEL_SCENES.invite]]) {
    const entry = loadVisit({ stage }); await entry.run();
    assert.deepEqual(entry.calls, [["read", scene], ["advance", scene], ["save"]]);
  }
  const first = loadVisit({ stage: CAMEL_STAGES.invited, watched: false }); await first.run();
  assert.deepEqual(first.calls, [["read", CAMEL_SCENES.watch], ["advance", CAMEL_SCENES.watch], ["save"], ["before"], ["race", true]]);
  const interrupted = loadVisit({ stage: CAMEL_STAGES.invited, watched: false, readDone: false }); await interrupted.run();
  assert.deepEqual(interrupted.calls, [["read", CAMEL_SCENES.watch]], "interrupted dialogue neither saves nor starts the race");
  const watched = loadVisit({ stage: CAMEL_STAGES.invited }); await watched.run();
  assert.deepEqual(watched.calls, [["before"], ["race", true]], "a saved viewing is not replayed after an interrupted first race");
  const repeat = loadVisit(); await repeat.run();
  assert.deepEqual(repeat.calls, [["before"], ["race", false]], "repeat visits start directly without read or save");
  const reunion = loadVisit(); await reunion.run({ replayIntro: true });
  assert.deepEqual(reunion.calls, [["read", CAMEL_SCENES.replay], ["before"], ["race", false]], "Chapter 5 still reads its first reunion");
  const reunionInterrupted = loadVisit({ readDone: false }); await reunionInterrupted.run({ replayIntro: true });
  assert.deepEqual(reunionInterrupted.calls, [["read", CAMEL_SCENES.replay]]);
  for (const options of [{ current: false }, { aborted: true }]) {
    const cancelled = loadVisit(options); await cancelled.run();
    assert.deepEqual(cancelled.calls, [], "cancelled repeat entry does not start or consume anything");
  }
  const chapterFive = readFileSync(new URL("../js/chapters/ch5-dubai.js", import.meta.url), "utf8");
  assert.match(chapterFive, /replayIntro: !owner\.flags\[CAMEL_AGAIN\.flag\]/, "Chapter 5 requests only its unread reunion");
}

console.log("ch4_camel_race: ok");

