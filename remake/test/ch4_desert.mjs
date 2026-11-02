// 第4章ドバイ・砂丘のサンドボードの接続規則（chapters/ch4-desert-progress.js）:
// カフェ・サーリム（ヌールの父の店）で一台頼んで話すと好感度が上がり、段階の会話は♥0・1・2・3で1日1つ。♥3の誘いで昼の外出、
// 初回は無料・2回目から 6,000円、同じ日に二度は行けない、記録と初回だけの報酬、遊びのご褒美の判定。
import assert from "node:assert/strict";
import test from "node:test";
import { DESERT_FLAG, DESERT_TALKS, DESERT_TALK_HEARTS, DESERT_CAFE_CHATS, DESERT_CAFE_PRICE, DESERT_RIDE_PRICE, DESERT_SCENES, DESERT_DIALOGUE_IDS,
  desertRivals, markNaruMet, desertProgress, desertInvited, desertTalkScene, completeDesertTalk, desertCafeVisit, completeDesertCafeVisit, noorHeart,
  desertOutingStatus, beginDesertOuting, desertRecords, recordDesertResult, desertRankAtLeast, desertDestinations,
  DESERT_SPOT_IDS, desertDailySpots, desertDailySpotById } from "../js/chapters/ch4-desert-progress.js";
import { PLAY_REWARDS } from "../js/core/growth-board-data.js";
import { readFileSync } from "node:fs";

const fresh = () => ({ chapter: 4, day: 46, flags: {}, money: 50000, affinity: {} });
const result = (score, rank, extra = {}) => ({ finished: true, score, rank, time: 55.2, maxCombo: 9, falls: 1, bigJumps: 5, perfect: 2, good: 2, nearMiss: 3, ...extra });
const HEART = [0, 9, 20, 33, 48, 66];
/** 段階の会話を全部読んで誘われた状態にする（♥は足りる分だけ足す）。 */
function invite(value) {
  let day = (desertProgress(value).lastTalkDay ?? 0) + 1;
  for (let index = desertProgress(value).talks; index < DESERT_TALKS.length; index++, day++) {
    value.affinity.noor = HEART[DESERT_TALK_HEARTS[index]];
    assert.equal(completeDesertTalk(value, DESERT_TALKS[index], day, noorHeart(value)), true, DESERT_TALKS[index]);
  }
  value.affinity.noor = HEART[3];
  return value;
}

test("café visits: one a day, the next stage when Noor's heart allows it, a chat otherwise; the ♥3 invitation opens the dunes", () => {
  const value = fresh();
  assert.deepEqual(desertProgress(value), { talks: 0, chats: 0, lastTalkDay: null, outings: 0, lastOutingDay: null });
  assert.deepEqual(DESERT_TALK_HEARTS, [0, 1, 2, 3]);
  assert.deepEqual(desertCafeVisit(value, 1), { id: DESERT_TALKS[0], kind: "story" }, "the first visit is the meeting (♥0)");
  assert.equal(completeDesertCafeVisit(value, { id: DESERT_TALKS[1], kind: "story" }, 1), false, "only the expected scene counts");
  assert.equal(completeDesertCafeVisit(value, desertCafeVisit(value, 1), 1), true);
  assert.equal(desertCafeVisit(value, 1), null, "one visit a day");
  // ♥1 に届くまでは雑談。届いたら次の段階
  assert.deepEqual(desertCafeVisit(value, 2), { id: DESERT_CAFE_CHATS[0], kind: "talk" });
  assert.equal(completeDesertCafeVisit(value, desertCafeVisit(value, 2), 2), true);
  assert.equal(desertProgress(value).chats, 1);
  value.affinity.noor = 9;
  assert.equal(noorHeart(value), 1);
  assert.deepEqual(desertCafeVisit(value, 3), { id: DESERT_TALKS[1], kind: "story" });
  completeDesertCafeVisit(value, desertCafeVisit(value, 3), 3);
  value.affinity.noor = 20; completeDesertCafeVisit(value, desertCafeVisit(value, 4), 4);
  assert.equal(desertInvited(value), false);
  assert.deepEqual(desertOutingStatus(value, 5), { ok: false, why: "まだ誘われていない", first: true, price: 0 });
  assert.equal(beginDesertOuting(value, 5), false);
  assert.deepEqual(desertCafeVisit(value, 5), { id: DESERT_CAFE_CHATS[1], kind: "talk" }, "the invitation waits for ♥3");
  value.affinity.noor = 33;
  assert.deepEqual(desertCafeVisit(value, 5), { id: DESERT_TALKS[3], kind: "story" });
  completeDesertCafeVisit(value, desertCafeVisit(value, 5), 5);
  assert.equal(desertInvited(value), true);
  assert.deepEqual(desertCafeVisit(value, 6), { id: DESERT_CAFE_CHATS[1], kind: "talk" }, "after the invitation the café keeps its chats");
  assert.deepEqual(value.flags[DESERT_FLAG], { v: 2, talks: 4, chats: 1, lastTalkDay: 5, outings: 0, lastOutingDay: null });
  // 恋人なら♥5扱い。旧カードの地図は♥を問わない（heart を省く）
  assert.equal(noorHeart({ lovers: ["noor"] }), 5);
  const old = fresh();
  assert.equal(desertTalkScene(old, 1), DESERT_TALKS[0]);
  assert.equal(completeDesertTalk(old, DESERT_TALKS[0], 1), true);
  assert.equal(desertTalkScene(old, 2), DESERT_TALKS[1]);
});

test("old saves: the three desk talks (meeting, map, invitation) keep the invitation; partial progress keeps its place", () => {
  const invited = { ...fresh(), flags: { [DESERT_FLAG]: { talks: 3, lastTalkDay: 3, outings: 1, lastOutingDay: 3 } } };
  assert.equal(desertInvited(invited), true);
  assert.equal(desertProgress(invited).talks, DESERT_TALKS.length);
  const halfway = { ...fresh(), flags: { [DESERT_FLAG]: { talks: 2, lastTalkDay: 2 } } };
  assert.equal(desertProgress(halfway).talks, 2);
  halfway.affinity.noor = 20;
  assert.equal(desertCafeVisit(halfway, 3).id, "ch4_noor_cafe_3", "the new café talk comes next");
  // 旧カードの地図（5日）では店の3つ目を飛ばし、3回目で誘う（♥も問わない）
  const legacy = { ...fresh(), flags: { [DESERT_FLAG]: { v: 2, talks: 2, lastTalkDay: 2 } } };
  assert.deepEqual(desertCafeVisit(legacy, 3, { legacy: true }), { id: "ch4_noor_invite", kind: "story" });
  assert.equal(completeDesertCafeVisit(legacy, { id: "ch4_noor_invite", kind: "story" }, 3, { legacy: true }), true);
  assert.equal(desertInvited(legacy), true);
  assert.equal(desertDestinations(fresh(), 1)[0].legacy, true, "the old map marks its café visits as legacy");
});

test("the outing uses the day once and costs nothing the first time, then the tour fee; retries inside the trip cost nothing", () => {
  const value = invite(fresh());
  assert.equal(DESERT_RIDE_PRICE, 6000); assert.equal(DESERT_CAFE_PRICE, 3000);
  assert.deepEqual(desertOutingStatus(value, 4), { ok: true, why: "", first: true, price: 0 }, "the first trip is on Noor");
  assert.equal(beginDesertOuting(value, 4), true);
  assert.equal(value.slot, 1, "the outing spends the daytime action (the same slot as the camel race)");
  assert.deepEqual(desertOutingStatus(value, 4), { ok: false, why: "今日はもう砂丘へ行った", first: false, price: DESERT_RIDE_PRICE });
  assert.equal(beginDesertOuting(value, 4), false, "no second outing on the same day");
  value.slot = 0; // 宿で日を終えると昼に戻る（endChapterFourDay）
  recordDesertResult(value, result(3000, "C")); recordDesertResult(value, result(5000, "B"));
  assert.equal(desertProgress(value).outings, 1);
  assert.deepEqual(desertOutingStatus(value, 5), { ok: true, why: "", first: false, price: DESERT_RIDE_PRICE });
  value.money = 5999;
  assert.deepEqual(desertOutingStatus(value, 5), { ok: false, why: "お金が足りない（6,000円）", first: false, price: DESERT_RIDE_PRICE });
  value.money = 50000;
  assert.equal(beginDesertOuting(value, 5), true);
  assert.equal(desertProgress(value).outings, 2);
  value.slot = 1;
  assert.deepEqual(desertOutingStatus(value, 6), { ok: false, why: "今日の昼はもう別の予定に使った", first: false, price: DESERT_RIDE_PRICE });
  assert.equal(beginDesertOuting(value, 6), false);
  value.slot = 0;
  assert.equal(desertOutingStatus(value, 6).ok, true);
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
  assert.deepEqual(desertProgress({ flags: { [DESERT_FLAG]: { v: 2, talks: 99, chats: -1, lastTalkDay: -2 } } }), { talks: DESERT_TALKS.length, chats: 0, lastTalkDay: null, outings: 0, lastOutingDay: null });
});

test("old-route map destinations: the café before the invitation, the dunes after, with the day-use rule and the fee in the text", () => {
  const value = fresh();
  let [cafe] = desertDestinations(value, 1);
  assert.equal(desertDestinations(value, 1).length, 1);
  assert.deepEqual({ id: cafe.id, kind: cafe.kind, ok: cafe.ok, consumes: cafe.consumes, scenes: cafe.scenes, unreadCount: cafe.unreadCount }, { id: "tour_desk", kind: "desert_talk", ok: true, consumes: false, scenes: [DESERT_TALKS[0]], unreadCount: 1 });
  assert.match(cafe.label, /カフェ/);
  completeDesertCafeVisit(value, desertCafeVisit(value, 1), 1);
  [cafe] = desertDestinations(value, 1);
  assert.deepEqual({ ok: cafe.ok, scenes: cafe.scenes, why: cafe.why }, { ok: false, scenes: [], why: "今日はもう寄った" });
  assert.match(desertDestinations(value, 2)[0].label, /ヌールと話す/);
  invite(value);
  let [dunes] = desertDestinations(value, 4);
  assert.deepEqual({ id: dunes.id, kind: dunes.kind, ok: dunes.ok, consumes: dunes.consumes, unreadCount: dunes.unreadCount }, { id: "dunes", kind: "desert", ok: true, consumes: true, unreadCount: 1 });
  assert.match(dunes.purpose, /初回は無料/); assert.match(dunes.purpose, /昼の行動を1つ使う/);
  beginDesertOuting(value, 4);
  recordDesertResult(value, result(6400, "B"));
  [dunes] = desertDestinations(value, 4);
  assert.equal(dunes.ok, false); assert.match(dunes.purpose, /今日はもう砂丘へ行った/);
  value.slot = 0;
  [dunes] = desertDestinations(value, 5);
  assert.equal(dunes.ok, true); assert.match(dunes.purpose, /自己ベスト 6,400点／B/); assert.match(dunes.purpose, /6,000円/);
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

test("the 14-day daily map (route 2) keeps the café on the map (3,000円, one action), adds the dunes after the invitation, and disables them with a reason", () => {
  const value = fresh();
  value.slot = 0;
  let spots = desertDailySpots(value, 1);
  assert.equal(spots.length, 1);
  let [cafe] = spots;
  assert.deepEqual([cafe.id, cafe.region, cafe.kind, cafe.place, cafe.unavailable, cafe.cost], [DESERT_SPOT_IDS.desk, "dubai", "ch4_desert", "tour_desk", "", 3000]);
  assert.equal(cafe.hasNew(), true);
  assert.match(cafe.desc, /3,000円/);
  completeDesertCafeVisit(value, desertCafeVisit(value, 1), 1);
  [cafe] = desertDailySpots(value, 1);
  assert.deepEqual([cafe.unavailable, cafe.unavailableTag, cafe.hasNew()], ["今日はもう寄った。また明日", "また明日", false], "one visit a day");
  assert.equal(desertDailySpotById(value, 1, DESERT_SPOT_IDS.desk), null, "a disabled spot is not performed");
  [cafe] = desertDailySpots(value, 2);
  assert.equal(cafe.label, "カフェ・サーリム");
  assert.equal(cafe.hasNew(), false, "only a chat until ♥1");
  value.money = 2999;
  [cafe] = desertDailySpots(value, 2);
  assert.deepEqual([cafe.unavailable, cafe.unavailableTag], ["お金が足りない（3,000円）", "お金が足りない"]);
  value.money = 50000;
  invite(value);
  spots = desertDailySpots(value, 5);
  assert.deepEqual(spots.map(spot => spot.id), [DESERT_SPOT_IDS.desk, DESERT_SPOT_IDS.dunes], "the café stays after the invitation");
  let dunes = spots[1];
  assert.deepEqual([dunes.place, dunes.unavailable], ["dunes", ""]);
  assert.match(dunes.desc, /初回は無料/);
  assert.equal(desertDailySpotById(value, 5, DESERT_SPOT_IDS.dunes).id, DESERT_SPOT_IDS.dunes);
  value.slot = 1;
  dunes = desertDailySpots(value, 5)[1];
  assert.deepEqual([dunes.unavailable, dunes.unavailableTag], ["砂丘へは昼に出かける", "砂丘は昼だけ"], "the dunes are a daytime trip");
  assert.equal(desertDailySpotById(value, 5, DESERT_SPOT_IDS.dunes), null);
  value.slot = 0;
  assert(beginDesertOuting(value, 5));
  value.slot = 0;
  dunes = desertDailySpots(value, 5)[1];
  assert.deepEqual([dunes.unavailable, dunes.unavailableTag], ["今日はもう砂丘へ行った。また明日", "今日はもう行った"], "once a day");
  recordDesertResult(value, result(9100, "S"));
  dunes = desertDailySpots(value, 6)[1];
  assert.match(dunes.desc, /自己ベスト 9,100点／S/); assert.match(dunes.desc, /6,000円/);
  assert.equal(dunes.hasNew(), false);
  value.money = 5000;
  dunes = desertDailySpots(value, 6)[1];
  assert.deepEqual([dunes.unavailable, dunes.unavailableTag], ["お金が足りない（6,000円）", "お金が足りない"]);
  // ドバイの日常ループに組み込まれている（地図・行き先の解決・処理）
  const daily = readFileSync(new URL("../js/chapters/ch4-dubai-daily.js", import.meta.url), "utf8");
  assert.match(daily, /spots\.push\(\.\.\.desertDailySpots\(state, dubaiDay\(\)\)\)/);
  assert.match(daily, /desertDailySpotById\(state, dubaiDay\(\), id\)/);
  assert.match(daily, /entry\.kind === "ch4_desert"[\s\S]*performDesertSpot/);
  // カフェの会話はヌールの好感度を上げる（段階 +16・雑談 +8 の来店の値）
  const desert = readFileSync(new URL("../js/chapters/ch4-desert.js", import.meta.url), "utf8");
  assert.match(desert, /gainAffinity\(DESERT_GUIDE, visitAffinity\(visit\.kind\)\)/);
});
