// 第4章ドバイ・砂丘のサンドボードの接続規則（chapters/ch4-desert-progress.js）:
// デスクの会話は1日1つで3回、誘われたら昼の外出、同じ日に二度は行けない、記録と初回だけの報酬、遊びのご褒美の判定。
import assert from "node:assert/strict";
import test from "node:test";
import { DESERT_FLAG, DESERT_TALKS, DESERT_SCENES, DESERT_DIALOGUE_IDS, desertRivals, markNaruMet, desertProgress, desertInvited, desertTalkScene, completeDesertTalk,
  desertOutingStatus, beginDesertOuting, desertRecords, recordDesertResult, desertRankAtLeast, desertDestinations,
  DESERT_SPOT_IDS, desertDailySpots, desertDailySpotById } from "../js/chapters/ch4-desert-progress.js";
import { PLAY_REWARDS } from "../js/core/growth-board-data.js";
import { readFileSync } from "node:fs";

const fresh = () => ({ chapter: 4, day: 46, flags: {} });
const result = (score, rank, extra = {}) => ({ finished: true, score, rank, time: 55.2, maxCombo: 9, falls: 1, bigJumps: 5, perfect: 2, good: 2, nearMiss: 3, ...extra });

test("the tour desk offers one talk per day, in order, and the invitation replaces the desk with the dunes", () => {
  const value = fresh();
  assert.deepEqual(desertProgress(value), { talks: 0, lastTalkDay: null, outings: 0, lastOutingDay: null });
  assert.equal(desertTalkScene(value, 1), DESERT_TALKS[0]);
  assert.equal(completeDesertTalk(value, DESERT_TALKS[1], 1), false, "only the next scene counts");
  assert.equal(completeDesertTalk(value, DESERT_TALKS[0], 1), true);
  assert.equal(desertTalkScene(value, 1), null, "one talk a day");
  assert.equal(completeDesertTalk(value, DESERT_TALKS[1], 1), false);
  assert.equal(desertTalkScene(value, 2), DESERT_TALKS[1]);
  assert.equal(completeDesertTalk(value, DESERT_TALKS[1], 2), true);
  assert.equal(desertInvited(value), false);
  assert.deepEqual(desertOutingStatus(value, 3), { ok: false, why: "まだ誘われていない", first: true });
  assert.equal(beginDesertOuting(value, 3), false);
  assert.equal(completeDesertTalk(value, DESERT_TALKS[2], 3), true);
  assert.equal(desertInvited(value), true);
  assert.equal(desertTalkScene(value, 4), null, "no more desk scenes after the invitation");
  assert.deepEqual(value.flags[DESERT_FLAG], { talks: 3, lastTalkDay: 3, outings: 0, lastOutingDay: null });
});

test("the outing uses the day once: a second trip waits for the next day, retries inside the trip cost nothing", () => {
  const value = fresh();
  for (const [index, id] of DESERT_TALKS.entries()) completeDesertTalk(value, id, index + 1);
  assert.deepEqual(desertOutingStatus(value, 3), { ok: true, why: "", first: true });
  assert.equal(beginDesertOuting(value, 3), true);
  assert.equal(value.slot, 1, "the outing spends the daytime action (the same slot as the camel race)");
  assert.deepEqual(desertOutingStatus(value, 3), { ok: false, why: "今日はもう砂丘へ行った", first: false });
  assert.equal(beginDesertOuting(value, 3), false, "no second outing on the same day");
  value.slot = 0; // 宿で日を終えると昼に戻る（endChapterFourDay）
  // 同じ外出の中の滑り直し: 記録だけが増え、外出の回数は増えない
  recordDesertResult(value, result(3000, "C")); recordDesertResult(value, result(5000, "B"));
  assert.equal(desertProgress(value).outings, 1);
  assert.deepEqual(desertOutingStatus(value, 4), { ok: true, why: "", first: false });
  assert.equal(beginDesertOuting(value, 4), true);
  assert.equal(desertProgress(value).outings, 2);
  // ほかの昼の行動（ラクダレース）で昼を使った日は行けない
  value.slot = 1;
  assert.deepEqual(desertOutingStatus(value, 5), { ok: false, why: "今日の昼はもう別の予定に使った", first: false });
  assert.equal(beginDesertOuting(value, 5), false);
  value.slot = 0;
  assert.equal(desertOutingStatus(value, 5).ok, true);
});

test("records keep the best by score, count runs, and reward the first finish only once", () => {
  const value = fresh();
  const calls = [];
  const awardExp = target => { calls.push(target); return 70; };
  assert.deepEqual(desertRecords(value), { runs: 0, best: null, bestRank: null, firstClear: null, rewarded: false, wins: 0, naruMet: false, naruWins: 0 });
  assert.equal(recordDesertResult(value, { finished: false, score: 10, rank: "C" }, { awardExp }), null, "unfinished runs are not recorded");
  assert.equal(recordDesertResult(value, null, { awardExp }), null);
  const first = recordDesertResult(value, result(4000, "B"), { awardExp });
  assert.deepEqual({ newBest: first.newBest, firstClear: first.firstClear, exp: first.exp }, { newBest: true, firstClear: true, exp: 70 });
  assert.deepEqual(calls, [{ key: "desert_ride", place: "dubai_dunes", person: "noor" }]);
  assert.deepEqual(desertRecords(value).firstClear, { chapter: 4, day: 46 });
  assert.equal(value.desert.bestRank, "B");
  const lower = recordDesertResult(value, result(3000, "C"), { awardExp });
  assert.deepEqual({ newBest: lower.newBest, firstClear: lower.firstClear, exp: lower.exp }, { newBest: false, firstClear: false, exp: 0 });
  assert.equal(desertRecords(value).best.score, 4000, "a lower score keeps the best");
  const higher = recordDesertResult(value, result(7000, "A"), { awardExp });
  assert.deepEqual({ newBest: higher.newBest, exp: higher.exp }, { newBest: true, exp: 0 });
  assert.equal(calls.length, 1, "EXP only for the very first finish, however many replays");
  assert.deepEqual(desertRecords(value), { runs: 3, best: { finished: true, score: 7000, rank: "A", time: 55.2, maxCombo: 9, falls: 1, bigJumps: 5, perfect: 2, good: 2, nearMiss: 3,
    tricks: 0, bestTrick: 0, boosts: 0, race: null }, bestRank: "A", firstClear: { chapter: 4, day: 46 }, rewarded: true, wins: 0, naruMet: false, naruWins: 0 });
  assert.deepEqual(desertRivals(value), ["noor"], "Naru waits until Noor is beaten");
  // ヌールとの競走: 勝った回数を数え、初めて勝った時だけ firstWin（夕日の前の短い会話）
  const lost = recordDesertResult(value, { ...result(5000, "B"), race: { won: false, gap: 0.4 } }, { awardExp });
  assert.deepEqual({ won: lost.won, firstWin: lost.firstWin }, { won: false, firstWin: false });
  const won = recordDesertResult(value, { ...result(9000, "A"), race: { won: true, gap: 1.2 } }, { awardExp });
  assert.deepEqual({ won: won.won, firstWin: won.firstWin }, { won: true, firstWin: true });
  const again = recordDesertResult(value, { ...result(9100, "A"), race: { won: true, gap: 2 } }, { awardExp });
  assert.deepEqual({ won: again.won, firstWin: again.firstWin }, { won: true, firstWin: false });
  assert.equal(desertRecords(value).wins, 2);
  assert.deepEqual(desertRecords(value).best.race, { won: true, gap: 2, who: "noor" });
  // ヌールに勝つと、なる（裏の相手）が来る。初めて来た場面は一度だけ。なるへの勝ちは別に数える
  assert.deepEqual(desertRivals(value), ["noor", "naru"]);
  assert.equal(markNaruMet(value), true); assert.equal(markNaruMet(value), false);
  assert.equal(desertRecords(value).naruMet, true);
  const naruLost = recordDesertResult(value, { ...result(9200, "A"), race: { won: false, gap: 1.2, who: "naru" } }, { awardExp });
  assert.deepEqual({ who: naruLost.who, won: naruLost.won, firstNaruWin: naruLost.firstNaruWin, firstWin: naruLost.firstWin }, { who: "naru", won: false, firstNaruWin: false, firstWin: false });
  const naruWon = recordDesertResult(value, { ...result(9300, "A"), race: { won: true, gap: 0.6, who: "naru" } }, { awardExp });
  assert.deepEqual({ firstNaruWin: naruWon.firstNaruWin, firstWin: naruWon.firstWin }, { firstNaruWin: true, firstWin: false });
  assert.deepEqual([desertRecords(value).wins, desertRecords(value).naruWins], [2, 1], "a win over Naru is not a win over Noor");
  // 遊びのご褒美（心得の盤）の判定と、growth-board-data の登録
  assert.equal(desertRankAtLeast(value, "A"), true); assert.equal(desertRankAtLeast(value, "S"), false);
  assert.equal(desertRankAtLeast(fresh(), "C"), false);
  const reward = PLAY_REWARDS.find(item => item.game === "desert");
  assert.deepEqual(reward, { id: "desert-a", game: "desert", rank: "A", label: "サンドボードで Aランク", gift: { body: 1 } });
  assert.match(readFileSync(new URL("../js/core/growth.js", import.meta.url), "utf8"), /reward\.game === "desert".*s\.desert\?\.bestRank/);
  // 壊れた保存は空扱い（throw しない）
  assert.deepEqual(desertRecords({ desert: { runs: "x", best: { score: "no" } } }).best, null);
  assert.deepEqual(desertProgress({ flags: { [DESERT_FLAG]: { talks: 99, lastTalkDay: -2 } } }), { talks: 3, lastTalkDay: null, outings: 0, lastOutingDay: null });
});

test("map destinations: the desk before the invitation, the dunes after, with the day-use rule in the text", () => {
  const value = fresh();
  let [desk] = desertDestinations(value, 1);
  assert.equal(desertDestinations(value, 1).length, 1);
  assert.deepEqual({ id: desk.id, kind: desk.kind, ok: desk.ok, consumes: desk.consumes, scenes: desk.scenes, unreadCount: desk.unreadCount }, { id: "tour_desk", kind: "desert_talk", ok: true, consumes: false, scenes: [DESERT_TALKS[0]], unreadCount: 1 });
  assert.match(desk.label, /ツアーデスク/);
  completeDesertTalk(value, DESERT_TALKS[0], 1);
  [desk] = desertDestinations(value, 1);
  assert.deepEqual({ ok: desk.ok, scenes: desk.scenes, why: desk.why }, { ok: false, scenes: [], why: "今日はもう話した" });
  assert.equal(desertDestinations(value, 2)[0].label, "ヌールと話す");
  completeDesertTalk(value, DESERT_TALKS[1], 2); completeDesertTalk(value, DESERT_TALKS[2], 3);
  let [dunes] = desertDestinations(value, 3);
  assert.deepEqual({ id: dunes.id, kind: dunes.kind, ok: dunes.ok, consumes: dunes.consumes, unreadCount: dunes.unreadCount }, { id: "dunes", kind: "desert", ok: true, consumes: true, unreadCount: 1 });
  assert.match(dunes.purpose, /昼の行動を1つ使う/);
  beginDesertOuting(value, 3);
  recordDesertResult(value, result(6400, "B"));
  [dunes] = desertDestinations(value, 3);
  assert.equal(dunes.ok, false); assert.match(dunes.purpose, /今日はもう砂丘へ行った/);
  value.slot = 0;
  [dunes] = desertDestinations(value, 4);
  assert.equal(dunes.ok, true); assert.match(dunes.purpose, /自己ベスト 6,400点／B/);
  assert.equal(dunes.visited, true);
});

test("every dialogue the connection needs exists in data/dialogue/ch4_desert.json with the guide as speaker", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/dialogue/ch4_desert.json", import.meta.url), "utf8"));
  const ids = new Set(data.dialogues.map(d => d.dialogue_id));
  for (const id of DESERT_DIALOGUE_IDS) assert(ids.has(id), `missing dialogue ${id}`);
  assert.deepEqual(Object.values(DESERT_SCENES).filter(id => !ids.has(id)), []);
  const meet = data.dialogues.find(d => d.dialogue_id === DESERT_TALKS[0]);
  assert(meet.lines.some(line => line.type === "set_flag" && line.flag === "_met_noor"), "the first talk introduces the guide by name");
  // 大会前を前提にした会話は大会後の分岐を持つ（交流の時系列ルール）
  for (const id of [DESERT_TALKS[1], DESERT_SCENES.sunsetFirst]) {
    const scene = data.dialogues.find(d => d.dialogue_id === id);
    const condition = scene.lines.find(line => line.type === "condition");
    assert.equal(condition?.condition_type, "tournament_finished"); assert.equal(condition.tournament_chapter, 4);
    assert(scene.branches[condition.next_true]?.length && scene.branches[condition.next_false]?.length);
  }
  const characters = JSON.parse(readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8"));
  const noor = characters.find(c => c.id === "noor");
  assert.equal(noor.display_name, "ヌール"); assert.equal(noor.role, "venue_host"); assert(noor.intro_cutin?.title);
});

test("the 14-day daily map (route 2) keeps the desk, then the dunes, on the map and disables them with a reason when not available", () => {
  const value = fresh();
  value.slot = 0;
  const only = spots => { assert.equal(spots.length, 1); return spots[0]; };
  let spot = only(desertDailySpots(value, 1));
  assert.deepEqual([spot.id, spot.region, spot.kind, spot.place, spot.unavailable], [DESERT_SPOT_IDS.desk, "dubai", "ch4_desert", "tour_desk", ""]);
  assert.equal(spot.hasNew(), true);
  assert.match(spot.desc, /時間は使わない/);
  completeDesertTalk(value, DESERT_TALKS[0], 1);
  spot = only(desertDailySpots(value, 1));
  assert.deepEqual([spot.unavailable, spot.unavailableTag, spot.hasNew()], ["今日はもう話した。また明日", "また明日", false], "one talk a day");
  assert.equal(desertDailySpotById(value, 1, DESERT_SPOT_IDS.desk), null, "a disabled spot is not performed");
  assert.equal(only(desertDailySpots(value, 2)).label, "ヌールと話す");
  completeDesertTalk(value, DESERT_TALKS[1], 2); completeDesertTalk(value, DESERT_TALKS[2], 3);
  spot = only(desertDailySpots(value, 3));
  assert.deepEqual([spot.id, spot.place, spot.unavailable], [DESERT_SPOT_IDS.dunes, "dunes", ""]);
  assert.match(spot.desc, /昼の行動を使う/);
  assert.equal(desertDailySpotById(value, 3, DESERT_SPOT_IDS.dunes).id, DESERT_SPOT_IDS.dunes);
  value.slot = 1;
  spot = only(desertDailySpots(value, 3));
  assert.deepEqual([spot.unavailable, spot.unavailableTag], ["砂丘へは昼に出かける", "砂丘は昼だけ"], "the dunes are a daytime trip");
  assert.equal(desertDailySpotById(value, 3, DESERT_SPOT_IDS.dunes), null);
  value.slot = 0;
  assert(beginDesertOuting(value, 3));
  assert.equal(value.slot, 1);
  value.slot = 0;
  spot = only(desertDailySpots(value, 3));
  assert.deepEqual([spot.unavailable, spot.unavailableTag], ["今日はもう砂丘へ行った。また明日", "今日はもう行った"], "once a day");
  recordDesertResult(value, result(9100, "S"));
  assert.match(only(desertDailySpots(value, 4)).desc, /自己ベスト 9,100点／S/);
  assert.equal(only(desertDailySpots(value, 4)).hasNew(), false);
  // ドバイの日常ループに組み込まれている（地図・行き先の解決・処理）
  const daily = readFileSync(new URL("../js/chapters/ch4-dubai-daily.js", import.meta.url), "utf8");
  assert.match(daily, /spots\.push\(\.\.\.desertDailySpots\(state, dubaiDay\(\)\)\)/);
  assert.match(daily, /desertDailySpotById\(state, dubaiDay\(\), id\)/);
  assert.match(daily, /entry\.kind === "ch4_desert"[\s\S]*performDesertSpot/);
});
