// 第4章ドバイ・砂丘のサンドボードの接続規則（chapters/ch4-desert-progress.js）:
// カフェ・オアシス（ヌールの父の店）で一台頼んで話すと好感度が上がり、段階の会話は♥0・1・2・3で1日1つ。♥3の誘いで昼の外出、
// 初回は無料・2回目から 6,000円、同じ日に二度は行けない、記録と初回だけの報酬、遊びのご褒美の判定。
import assert from "node:assert/strict";
import test from "node:test";
import { DESERT_FLAG, DESERT_TALKS, DESERT_TALK_HEARTS, DESERT_INVITE_STAGE, NOOR_QUESTION_CHOICE, DESERT_CAFE_CHATS, DESERT_CAFE_PRICE, DESERT_RIDE_PRICE, DESERT_SCENES, DESERT_DIALOGUE_IDS,
  desertRivals, markNaruMet, desertProgress, desertInvited, desertTalkScene, completeDesertTalk, desertCafeVisit, completeDesertCafeVisit, noorHeart,
  desertOutingStatus, beginDesertOuting, desertRecords, recordDesertResult, desertRankAtLeast, desertDestinations,
  DESERT_SPOT_IDS, desertDailySpots, desertDailySpotById, NOOR_FINALE, NOOR_CONFESSION, NOOR_OTHER_LOVER_FLAG, noorStoriesDone, noorFinaleWaiting,
  noorConfessionWaiting, desertChapterFiveSpots, completeDesertReunion, NOOR_VISIT_CONFESSION_FLAG,
  NOOR_STORY_EXTRAS, NOOR_STORY_DIALOGUE_IDS, NOOR_CONFESSION_DIALOGUE_IDS, noorStoryFlag, noorStoryDue, completeNoorStory } from "../js/chapters/ch4-desert-progress.js";
import { PLAY_REWARDS } from "../js/core/growth-board-data.js";
import { tournamentFinished } from "../js/core/story-context.js";
import { readFileSync } from "node:fs";

const fresh = () => ({ chapter: 4, day: 46, flags: {}, money: 50000, affinity: {} });
const result = (score, rank, extra = {}) => ({ finished: true, score, rank, time: 55.2, maxCombo: 9, falls: 1, bigJumps: 5, perfect: 2, good: 2, nearMiss: 3, ...extra });
const HEART = [0, 9, 20, 33, 48, 66];
/** 誘いまでの段階の会話を読んで誘われた状態にする（♥は足りる分だけ足す）。 */
function invite(value) {
  let day = (desertProgress(value).lastTalkDay ?? 0) + 1;
  for (let index = desertProgress(value).talks; index < DESERT_INVITE_STAGE; index++, day++) {
    value.affinity.noor = HEART[DESERT_TALK_HEARTS[index]];
    assert.equal(completeDesertTalk(value, DESERT_TALKS[index], day, noorHeart(value)), true, DESERT_TALKS[index]);
  }
  value.affinity.noor = HEART[3];
  return value;
}

test("café visits: one a day, the next stage when Noor's heart allows it, a chat otherwise; the ♥3 invitation opens the dunes", () => {
  const value = fresh();
  assert.deepEqual(desertProgress(value), { talks: 0, chats: 0, lastTalkDay: null, outings: 0, lastOutingDay: null });
  assert.deepEqual(DESERT_TALK_HEARTS, [0, 1, 2, 3, 3, 4]);
  assert.equal(DESERT_INVITE_STAGE, 4);
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
  assert.deepEqual(desertOutingStatus(value, 5), { ok: false, why: "まだ誘われていない", first: true, price: 0, invited: false });
  assert.equal(beginDesertOuting(value, 5), false);
  assert.deepEqual(desertCafeVisit(value, 5), { id: DESERT_CAFE_CHATS[1], kind: "talk" }, "the invitation waits for ♥3");
  value.affinity.noor = 33;
  assert.deepEqual(desertCafeVisit(value, 5), { id: DESERT_TALKS[3], kind: "story" });
  completeDesertCafeVisit(value, desertCafeVisit(value, 5), 5);
  assert.equal(desertInvited(value), true);
  assert.deepEqual(value.flags[DESERT_FLAG], { v: 2, talks: 4, chats: 1, lastTalkDay: 5, outings: 0, lastOutingDay: null });
  // 誘いの後も店の段階は続く: ♥3の問い（恋愛／友情）→ ♥4の会話。♥4までは雑談
  assert.deepEqual(desertCafeVisit(value, 6), { id: "ch4_noor_bond_question", kind: "story" }, "the ♥3 question follows the invitation");
  completeDesertCafeVisit(value, desertCafeVisit(value, 6), 6);
  assert.deepEqual(desertCafeVisit(value, 7), { id: DESERT_CAFE_CHATS[1], kind: "talk" }, "the ♥4 talk waits for ♥4");
  value.affinity.noor = 48;
  assert.deepEqual(desertCafeVisit(value, 7), { id: "ch4_noor_cafe_4", kind: "story" });
  completeDesertCafeVisit(value, desertCafeVisit(value, 7), 7);
  assert.equal(desertProgress(value).talks, DESERT_TALKS.length);
  assert.deepEqual(desertCafeVisit(value, 8), { id: DESERT_CAFE_CHATS[1], kind: "talk" }, "after every stage the café keeps its chats");
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
  assert.equal(desertProgress(invited).talks, DESERT_INVITE_STAGE, "an old invited save is at the invitation, before the ♥3 question");
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
  assert.deepEqual(desertOutingStatus(value, 4), { ok: true, why: "", first: true, price: 0, invited: false }, "the first trip is on Noor");
  assert.equal(beginDesertOuting(value, 4), true);
  assert.equal(value.slot, 1, "the outing spends the daytime action (the same slot as the camel race)");
  assert.deepEqual(desertOutingStatus(value, 4), { ok: false, why: "今日はもう砂丘へ行った", first: false, price: DESERT_RIDE_PRICE, invited: false });
  assert.equal(beginDesertOuting(value, 4), false, "no second outing on the same day");
  value.slot = 0; // 宿で日を終えると昼に戻る（endChapterFourDay）
  recordDesertResult(value, result(3000, "C")); recordDesertResult(value, result(5000, "B"));
  assert.equal(desertProgress(value).outings, 1);
  assert.deepEqual(desertOutingStatus(value, 5), { ok: true, why: "", first: false, price: DESERT_RIDE_PRICE, invited: false });
  value.money = 5999;
  assert.deepEqual(desertOutingStatus(value, 5), { ok: false, why: "お金が足りない（6,000円）", first: false, price: DESERT_RIDE_PRICE, invited: false });
  value.money = 50000;
  assert.equal(beginDesertOuting(value, 5), true);
  assert.equal(desertProgress(value).outings, 2);
  value.slot = 1;
  assert.deepEqual(desertOutingStatus(value, 6), { ok: false, why: "今日の昼はもう別の予定に使った", first: false, price: DESERT_RIDE_PRICE, invited: false });
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
  // ♥3の問い: 恋愛寄り（1）と友情（0）の実回答。分岐はどちらも読み終えられる
  const question = data.dialogues.find(d => d.dialogue_id === "ch4_noor_bond_question");
  const choice = question.lines.find(line => line.type === "choice");
  assert.deepEqual([choice.id, choice.romance_char, choice.choices.map(c => c.romance)], [NOOR_QUESTION_CHOICE, "noor", [1, 0]]);
  for (const c of choice.choices) assert(question.branches[c.next]?.length, c.next);
  assert.match(readFileSync(new URL("../js/chapters/ch4-desert.js", import.meta.url), "utf8"), /questionDoneKey\(DESERT_GUIDE\)/);
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
  assert.match(cafe.desc, /3,000円（約70ディルハム）/, "the same price wording as the other Dubai cafés");
  completeDesertCafeVisit(value, desertCafeVisit(value, 1), 1);
  [cafe] = desertDailySpots(value, 1);
  assert.deepEqual([cafe.unavailable, cafe.unavailableTag, cafe.hasNew()], ["今日はもう寄った。また明日", "また明日", false], "one visit a day");
  assert.equal(desertDailySpotById(value, 1, DESERT_SPOT_IDS.desk), null, "a disabled spot is not performed");
  [cafe] = desertDailySpots(value, 2);
  assert.equal(cafe.label, "カフェ・オアシス");
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



test("v2 keeps old scores separately and preserves highest earned rank, rewards and rival unlocks across SAVE/LOAD", () => {
  const value = fresh();
  const old = result(30000, "S", { race: { won: true, gap: 2, who: "noor" } });
  recordDesertResult(value, old);
  const previous = structuredClone(value.desert.best);
  const current = result(3500, "B", { rulesVersion: 2 });
  let called = 0;
  const first = recordDesertResult(value, current, { awardExp: () => ++called });
  assert.equal(first.newBest, true, "new scoring has its own first best");
  assert.deepEqual(value.desert.legacyBest, previous);
  assert.equal(value.desert.best.score, 3500);
  assert.equal(value.desert.best.rulesVersion, 2);
  assert.equal(value.desert.bestRank, "S");
  assert.equal(desertRankAtLeast(value, "A"), true, "the fire seed requirement stays earned");
  assert.equal(called, 0); assert.equal(value.desert.rewarded, true);
  const loaded = JSON.parse(JSON.stringify(value));
  assert.equal(desertRecords(loaded).bestRank, "S");
  assert.deepEqual(desertRivals(loaded), ["noor", "naru"]);
  assert.equal(recordDesertResult(loaded, result(6000, "A", { rulesVersion: 2 })).newBest, true);
  assert.equal(recordDesertResult(loaded, current).newBest, false);
  assert.equal(recordDesertResult(loaded, old), null, "a delayed old-version result cannot replace current records");
  assert.deepEqual(loaded.desert.legacyBest, previous);
  assert.equal(loaded.desert.bestRank, "S");
});

// DSR20: 店の段階の会話と♥3の問いを読んだ♥5の来店が締めくくり（daily/bonds.js の playFinale が記録）。
// 最後の問いで恋愛を選んだ後の砂丘はヌールの誘い（ツアー代なし）で、滑ったあと夕日で告白（confession_noor）。
test("the ♥5 café visit is Noor's finale; a romantic answer makes the next dunes free and ends them with her confession", () => {
  const value = fresh();
  value.slot = 0;
  invite(value);
  let day = desertProgress(value).lastTalkDay + 1;
  for (let index = DESERT_INVITE_STAGE; index < DESERT_TALKS.length; index++, day++) {
    value.affinity.noor = HEART[DESERT_TALK_HEARTS[index]];
    assert.equal(completeDesertTalk(value, DESERT_TALKS[index], day, noorHeart(value)), true, DESERT_TALKS[index]);
  }
  assert.equal(noorStoriesDone(value), true);
  value.flags[DESERT_FLAG].outings = 1; // 砂丘へは一度行った（次からは相場のツアー代）
  value.affinity.noor = HEART[5];
  assert.equal(desertCafeVisit(value, day).kind, "talk", "the ♥3 answer comes before the finale");
  value.flags._noor_affinity_question_done = true;
  value.affinity.noor = HEART[4];
  assert.equal(noorFinaleWaiting(value), false, "needs ♥5");
  value.affinity.noor = HEART[5];
  assert.deepEqual(desertCafeVisit(value, day), { id: NOOR_FINALE, kind: "finale" });
  assert.equal(desertCafeVisit(value, day, { legacy: true }).kind, "talk", "not on the old 5-day card map");
  assert.equal(desertDailySpots(value, day)[0].hasNew(), true, "the café is marked new");
  const visit = desertCafeVisit(value, day);
  assert.equal(completeDesertCafeVisit(value, visit, day), false, "only after bonds.js recorded the finale");
  value.finales = { noor: { day, chapter: 4, route: "romance" } };
  assert.equal(completeDesertCafeVisit(value, visit, day), true);
  assert.equal(completeDesertCafeVisit(value, visit, day), false, "once a day");
  assert.equal(desertCafeVisit(value, day), null);
  assert.equal(desertCafeVisit(value, day + 1).kind, "talk", "chats after the finale");
  // 告白待ち: 次の砂丘はツアー代なし（2回目以降でも）。地図にも印
  assert.equal(noorConfessionWaiting(value), true);
  value.money = 0;
  let status = desertOutingStatus(value, day + 1);
  assert.deepEqual([status.ok, status.price, status.invited], [true, 0, true]);
  const dunes = desertDailySpots(value, day + 1)[1];
  assert.match(dunes.desc, /ヌールとの約束/); assert.match(dunes.desc, /ツアー代はいらない/);
  assert.equal(dunes.hasNew(), true);
  // 付き合う（恋人）／友達のまま、どちらでも告白は終わり、次からは相場のツアー代
  value.lovers = ["noor"];
  assert.equal(noorConfessionWaiting(value), false);
  status = desertOutingStatus(value, day + 1);
  assert.deepEqual([status.price, status.invited, status.ok], [DESERT_RIDE_PRICE, false, false]);
  value.lovers = []; value.flags._friend_noor = true;
  assert.equal(noorConfessionWaiting(value), false);
  value.flags._friend_noor = false; value.finales.noor.route = "friend";
  assert.equal(noorConfessionWaiting(value), false, "a friendship finale has no confession");
});

test("Noor's finale, confession and gift data line up with bonds.js / romance.js", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/dialogue/ch4_desert.json", import.meta.url), "utf8"));
  const confessionData = JSON.parse(readFileSync(new URL("../../data/dialogue/confession.json", import.meta.url), "utf8"));
  const scene = id => [...data.dialogues, ...confessionData.dialogues].find(d => d.dialogue_id === id);
  assert.deepEqual(NOOR_CONFESSION_DIALOGUE_IDS, [NOOR_CONFESSION, `${NOOR_CONFESSION}_accept`, `${NOOR_CONFESSION}_reject`]);
  for (const id of NOOR_CONFESSION_DIALOGUE_IDS) assert(confessionData.dialogues.some(d => d.dialogue_id === id), id);
  const finale = scene(NOOR_FINALE);
  assert.equal(finale.metadata.bond_finale, "noor");
  const ask = finale.branches.ask.find(line => line.type === "choice");
  assert.deepEqual([ask.id, ask.romance_char, ask.choices.map(c => c.romance)], ["bond_q2_noor", "noor", [1, 0]]);
  for (const key of ["lover", "check", "ask", "close", "ask_friend", "friend"]) assert(finale.branches[key]?.length, key);
  const choice = scene(NOOR_CONFESSION).lines.find(line => line.type === "choice");
  assert.deepEqual(choice.choices.map(c => c.next_id), [`${NOOR_CONFESSION}_accept`, `${NOOR_CONFESSION}_reject`]);
  assert.equal(scene(`${NOOR_CONFESSION}_accept`).metadata.set_romance, "noor");
  // ほかに恋人がいれば、返事の前に一度だけ立ち止まる（一時の印は再生の前に立て、後で消す）
  const aside = scene(NOOR_CONFESSION).lines.find(line => line.type === "condition" && line.condition_type === "flag");
  assert.deepEqual([aside.condition_type, aside.flag], ["flag", NOOR_OTHER_LOVER_FLAG]);
  assert(scene(NOOR_CONFESSION).branches[aside.next_true]?.length);
  // 締めくくり・告白は大会に触れない（大会の前後どちらで読んでも成り立つ）
  for (const id of [NOOR_FINALE, NOOR_CONFESSION, `${NOOR_CONFESSION}_accept`, `${NOOR_CONFESSION}_reject`]) {
    assert.doesNotMatch(JSON.stringify([scene(id).lines, scene(id).branches || {}]), /大会|本番/, id);
  }
  const gear = JSON.parse(readFileSync(new URL("../../data/equipment.json", import.meta.url), "utf8")).equipment.find(e => e.id === "suyaki_noor");
  assert.deepEqual([gear.type, gear.art, gear.gift.from, gear.gift.flavor, gear.not_for_sale], ["bowl", "suyaki_hagal", "noor", "double_apple", true]);
  const bonds = readFileSync(new URL("../js/daily/bonds.js", import.meta.url), "utf8");
  assert.match(bonds, /noor: \{ dialogue: "ch4_noor_bond_finale", gift: "suyaki_noor", question: "bond_q2_noor", ownConfession: true \}/);
  const desert = readFileSync(new URL("../js/chapters/ch4-desert.js", import.meta.url), "utf8");
  assert.match(desert, /playFinale\(DESERT_GUIDE/);
  assert.match(desert, /romanceRouteOpen\(DESERT_GUIDE\)/);
  assert.match(desert, /read\(NOOR_CONFESSION, bgUrl\(DESERT_DUSK_BG\)\)/);
  assert.match(desert, /delete owner\.flags\[NOOR_OTHER_LOVER_FLAG\]/);
});

test("Noor's 16 café stories follow the visited stages once, including a late chapter 5 visit", () => {
  const value = fresh();
  const data = JSON.parse(readFileSync(new URL("../../data/dialogue/noor.json", import.meta.url), "utf8"));
  const scenes = new Map(data.dialogues.map(scene => [scene.dialogue_id, scene]));
  assert.equal(NOOR_STORY_EXTRAS.length, 16);
  assert.deepEqual(NOOR_STORY_DIALOGUE_IDS, NOOR_STORY_EXTRAS.map(entry => entry.id));
  assert.equal(noorStoryDue(value), null, "no story before meeting Noor");
  assert.equal(completeNoorStory(value, NOOR_STORY_EXTRAS[0].id), false);
  let day = 1;
  for (let stage = 0; stage < DESERT_TALKS.length; stage++, day++) {
    value.affinity.noor = HEART[DESERT_TALK_HEARTS[stage]];
    assert(completeDesertTalk(value, DESERT_TALKS[stage], day, noorHeart(value)));
    const group = NOOR_STORY_EXTRAS.filter(entry => entry.afterTalks === stage + 1);
    assert.equal(noorStoryDue(value), group[0].id);
    for (const entry of group) {
      assert.equal(noorStoryDue(value), entry.id);
      const scene = scenes.get(entry.id);
      assert(scene?.lines?.length, entry.id);
      assert(scene.lines.some(line => line.speaker === "noor"), entry.id);
      assert(!scene.lines.some(line => "inner" in line), entry.id);
      assert(!scene.lines.some(line => line.speaker && /。$/.test(line.text || "")), entry.id);
      assert.doesNotMatch(scene.lines.map(line => line.text || "").join(""), /大会|本番|優勝|明日の試合/, entry.id);
      assert(completeNoorStory(value, entry.id));
      assert.equal(value.flags[noorStoryFlag(entry.id)], true);
      assert.equal(completeNoorStory(value, entry.id), false, "read once");
    }
    assert.equal(noorStoryDue(value), null);
  }
  value.chapter = 5;
  delete value.flags[noorStoryFlag(NOOR_STORY_EXTRAS.at(-1).id)];
  assert.equal(noorStoryDue(value), NOOR_STORY_EXTRAS.at(-1).id, "unfinished story stays readable after the chapter changes");
  value.finales = { noor: { route: "romance" } };
  assert.equal(noorStoryDue(value), null, "a completed route does not replay the pre-confession stories out of order");
});

test("Noor's lover milestones use the five existing romance levels at the dunes", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/dialogue/lover_events.json", import.meta.url), "utf8"));
  const scenes = new Map(data.dialogues.map(scene => [scene.dialogue_id, scene]));
  for (let level = 1; level <= 5; level++) {
    const id = `lover_noor_lv${level}`, scene = scenes.get(id);
    assert(scene?.lines?.length, id);
    assert.equal(scene.metadata.private_scene, true);
    assert.match(scene.metadata.bg, /bg_dubai_dunes_dusk/);
    assert(!scene.lines.some(line => line.speaker && /。$/.test(line.text || "")), id);
  }
  const desert = readFileSync(new URL("../js/chapters/ch4-desert.js", import.meta.url), "utf8");
  assert.match(desert, /playLoverMilestone\(DESERT_GUIDE, \{ signal, home: false \}\)/);
});

test("chapter 5 Dubai: Café Oasis until Noor's finale, the dunes once invited; Naru stays home (owner 2026-11-07)", () => {
  // 2026-11-07 オーナー決定「第4章の砂丘を飛ばしたプレイヤーも、第5章側で前提を補ってルートに入れる」「ノールの告白は第5章でも可能にする」:
  // 会っていなければ第5章のカフェ・オアシスで出会いから。宿の隣ではなく旧市街の通り（第5章は屋敷に泊まる）
  const value = fresh();
  Object.assign(value, { chapter: 5, slot: 0 });
  let spots = desertChapterFiveSpots(value, 60);
  let [cafe] = spots;
  assert.deepEqual(spots.map(entry => entry.id), [DESERT_SPOT_IDS.desk], "never met: the café only");
  assert.deepEqual([cafe.x, cafe.y, cafe.label, cafe.area, cafe.place, cafe.region, cafe.kind, cafe.unavailable],
    [60, 28, "砂漠ツアーのカフェ", "旧市街の通り", "tour_desk", "dubai", "ch4_desert", ""]);
  assert.doesNotMatch([cafe.label, cafe.area, cafe.desc].join(""), /宿/, "Hajime stays at the Sheikh's residence in Chapter 5");
  assert.match(cafe.desc, /3,000円/);
  assert.equal(cafe.hasNew(), true);
  assert.deepEqual(desertCafeVisit(value, 60), { id: DESERT_TALKS[0], kind: "story" }, "the first visit is the meeting stage");
  // 第4章の地図はそのまま（宿の隣のカフェ）
  const chapterFour = desertDailySpots(fresh(), 3).find(entry => entry.id === DESERT_SPOT_IDS.desk);
  assert.deepEqual([chapterFour.label, chapterFour.area, chapterFour.x, chapterFour.y], ["宿の隣のカフェ", "宿の隣", 34, 26]);
  assert(completeDesertTalk(value, DESERT_TALKS[0], 60, noorHeart(value)));
  [cafe] = desertChapterFiveSpots(value, 61);
  assert.deepEqual([cafe.label, cafe.area, cafe.x, cafe.y], ["カフェ・オアシス", "旧市街の通り", 60, 28], "after meeting her");
  // 誘われた（砂丘へは一度も出かけていない）: カフェと砂丘。初めての砂丘は無料
  value.flags[DESERT_FLAG] = { v: 2, talks: 3, chats: 2, lastTalkDay: 9, outings: 0, lastOutingDay: null };
  invite(value);
  spots = desertChapterFiveSpots(value, 60);
  assert.deepEqual(spots.map(entry => entry.id), [DESERT_SPOT_IDS.desk, DESERT_SPOT_IDS.dunes], "invited: the café and the dunes");
  let dunes = spots[1];
  assert.deepEqual([dunes.place, dunes.region, dunes.kind, dunes.unavailable], ["dunes", "dubai", "ch4_desert", ""]);
  assert.match(dunes.desc, /初回は無料/);
  // 第4章で一度出かけた（章内の日 5 で記録）→ 2回目からのツアー代
  value.flags[DESERT_FLAG] = { ...value.flags[DESERT_FLAG], outings: 1, lastOutingDay: 5 };
  dunes = desertChapterFiveSpots(value, 60)[1];
  assert.match(dunes.desc, /6,000円/, "later trips cost the usual tour fee");
  assert.equal(dunes.hasNew(), false);
  // 1日1回・昼だけ。第5章では通算の日で記録する（第4章の章内の日より必ず大きいので、最初の日から行ける）
  const dunesOn = day => desertChapterFiveSpots(value, day).find(entry => entry.id === DESERT_SPOT_IDS.dunes);
  assert(beginDesertOuting(value, 60));
  assert.equal(desertProgress(value).lastOutingDay, 60);
  value.slot = 0;
  assert.equal(dunesOn(60).unavailableTag, "今日はもう行った");
  assert.equal(dunesOn(61).unavailable, "");
  value.slot = 1;
  assert.equal(dunesOn(61).unavailableTag, "砂丘は昼だけ");
  value.slot = 0; value.money = 5000;
  assert.equal(dunesOn(61).unavailableTag, "お金が足りない");
  value.money = 50000;
  // 締めくくりの後（ルートを問わず）はカフェを出さず、砂丘だけ
  for (const route of ["friend", "romance", "lover"]) {
    value.finales = { noor: { route, chapter: 4, day: 12 } };
    assert.deepEqual(desertChapterFiveSpots(value, 61).map(entry => entry.id), [DESERT_SPOT_IDS.dunes], route);
  }
  // 第4章で締めくくりを迎えたまま砂丘へ一度も出かけていない人にも、第5章で砂丘が出る（#2708 では出なかった・意図した変更）
  const held = fresh();
  Object.assign(held, { chapter: 5, slot: 0, finales: { noor: { route: "romance", chapter: 4, day: 12 } } });
  held.flags[DESERT_FLAG] = { v: 2, talks: 6, chats: 0, lastTalkDay: 12, outings: 0, lastOutingDay: null };
  let rest;
  [dunes, ...rest] = desertChapterFiveSpots(held, 60);
  assert.deepEqual([dunes.id, rest], [DESERT_SPOT_IDS.dunes, []]);
  assert.match(dunes.desc, /ヌールとの約束.*ツアー代はいらない/, "the promised trip");
  const { first, price, invited } = desertOutingStatus(held, 60);
  assert.deepEqual({ first, price, invited }, { first: true, price: 0, invited: true });
  held.finales.noor.route = "friend";
  [dunes, ...rest] = desertChapterFiveSpots(held, 60);
  assert.deepEqual([dunes.id, rest], [DESERT_SPOT_IDS.dunes, []]);
  assert.match(dunes.desc, /初回は無料/, "the friend route gets the free first trip");
  // 第4章に通っていた人の、第5章で最初の来店（再会だけ）: 今日の来店として数える。段階・雑談の数は進めない
  const regular = fresh();
  Object.assign(regular, { chapter: 5, slot: 0 });
  assert.equal(completeDesertReunion(regular, 60), false, "nothing to reunite with before meeting her");
  regular.flags[DESERT_FLAG] = { v: 2, talks: 3, chats: 1, lastTalkDay: 9, outings: 0, lastOutingDay: null };
  regular.affinity.noor = HEART[3];
  assert.equal(completeDesertReunion(regular, 60), true);
  const progress = desertProgress(regular);
  assert.deepEqual([progress.talks, progress.chats, progress.lastTalkDay], [3, 1, 60]);
  assert.equal(completeDesertReunion(regular, 60), false, "once a day");
  assert.equal(desertCafeVisit(regular, 60), null, "the reunion was today's café visit");
  assert.deepEqual(desertCafeVisit(regular, 61), { id: DESERT_TALKS[3], kind: "story" }, "the stages continue from the next visit");
  // 第5章の再会の場面（ch5_dubai.json）: 恋人なら最初の一言が変わる。大会・王者・味覚・ツアー代には触れない
  const ch5 = JSON.parse(readFileSync(new URL("../../data/dialogue/ch5_dubai.json", import.meta.url), "utf8"));
  const reunion = ch5.dialogues.find(d => d.dialogue_id === "ch5_dubai_dunes_again");
  const branch = reunion.lines.find(line => line.type === "condition");
  assert.deepEqual([branch.condition_type, branch.char_id], ["lover", "noor"]);
  for (const key of [branch.next_true, branch.next_false]) assert(reunion.branches[key]?.length, key);
  assert.doesNotMatch(JSON.stringify([reunion.lines, reunion.branches]), /大会|王者|優勝|世界一|味|ツアー代|円/, "the reunion stays off the tournament, taste and the fee");
  // 恋人でなければ、第4章の締めくくりの約束（告白を待っている）かどうかで分かれる。印は ch5-dubai.js が読む間だけ立てる
  const promise = reunion.branches[branch.next_false].find(line => line.type === "condition");
  assert.deepEqual([promise.condition_type, promise.flag], ["flag", "_noor_ch5_promise"]);
  for (const key of [promise.next_true, promise.next_false]) assert(reunion.branches[key]?.length, key);
  assert.match(JSON.stringify(reunion.branches[promise.next_true]), /約束/, "the promise branch picks up the date she circled");
  assert.doesNotMatch(JSON.stringify(reunion.branches[promise.next_true]), /久しぶり/, "she was waiting for him, so no casual hello");
  // 告白（confession_noor）は第5章でも読む。第4章は「いつか日本に帰る」のまま。大会の後は、第4章の締めくくりのあと帰国した人（came_back）と、
  // 第5章で締めくくりを迎えた人（visiting。ch4-desert.js が読む間だけ立てる一時の印）で分ける
  const ch4 = JSON.parse(readFileSync(new URL("../../data/dialogue/ch4_desert.json", import.meta.url), "utf8"));
  const confessionData = JSON.parse(readFileSync(new URL("../../data/dialogue/confession.json", import.meta.url), "utf8"));
  const confession = confessionData.dialogues.find(d => d.dialogue_id === NOOR_CONFESSION);
  const after = confession.lines.find(line => line.type === "condition" && line.condition_type === "tournament_finished");
  assert.equal(after.tournament_chapter, 4);
  assert.match(JSON.stringify(confession.branches[after.next_false]), /いつか日本に帰る/, "Chapter 4 keeps the original lines");
  const router = confession.branches[after.next_true];
  assert.equal(router.length, 1);
  assert.deepEqual([router[0].type, router[0].condition_type, router[0].flag], ["condition", "flag", NOOR_VISIT_CONFESSION_FLAG]);
  assert.match(JSON.stringify(confession.branches[router[0].next_false]), /日本に帰ってから/, "a Chapter 4 finale: she speaks after he went home");
  assert.match(JSON.stringify(confession.branches[router[0].next_true]), /また日本に帰る/, "a Chapter 5 finale: he is visiting and will go home again");
  for (const key of [router[0].next_true, router[0].next_false]) {
    assert.doesNotMatch(JSON.stringify(confession.branches[key]), /いつか日本に帰る|見送ったら|大会|本番/, key);
  }
  assert.doesNotMatch(JSON.stringify(confession.lines), /いつか日本に帰る|見送ったら/);
  assert.equal(tournamentFinished({ chapter: 4, phase: "daily" }, 4), false, "the Chapter 4 Dubai days are before the tournament");
  assert.equal(tournamentFinished({ chapter: 5, phase: "daily" }, 4), true);
  // ch4_noor_talk2 の大会後の分岐は、第5章で初めて読む人もいる（大会から何週も後）。「終わったんでしょ」と直後の言い方にしない
  const talk2 = ch4.dialogues.find(d => d.dialogue_id === "ch4_noor_talk2");
  assert.doesNotMatch(talk2.branches.after_tournament[0].text, /終わったんでしょ|お疲れさま/);
  // 第5章の場面（ch5_dubai.json）: 宿・大会・味覚に触れない。歓迎の語録は初対面の一度だけ
  const ch5Scene = id => ch5.dialogues.find(d => d.dialogue_id === id);
  for (const id of ["ch5_noor_meet", "ch5_noor_cafe_again", "ch5_noor_cafe_4", "ch5_noor_sunset_first"]) {
    const rows = [ch5Scene(id)?.lines || [], ...Object.values(ch5Scene(id)?.branches || {})].flat();
    assert(rows.length >= 5, `${id} exists`);
    for (const line of rows) if (line.speaker !== undefined) assert(["noor", "hajime", ""].includes(line.speaker), `${id}: ${line.speaker}`);
    assert.doesNotMatch(JSON.stringify(rows), /大会|王者|優勝|世界一|宿|味覚/, id);
    if (id !== "ch5_noor_meet") assert.doesNotMatch(JSON.stringify(rows), /アリガトナス|カシコマリ|ヤリマスネ/, id);
  }
  assert(ch5Scene("ch5_noor_meet").lines.some(line => line.type === "set_flag" && line.flag === "_met_noor"));
  assert.match(JSON.stringify(ch5Scene("ch5_noor_meet").lines), /アリガトナス/);
  // ♥4の場面は第4章と同じ流れで、「いつか帰る」だけ「また帰る」に替える（第4章の台詞を直したら、こちらも見直す）
  const cafe4 = ch4.dialogues.find(d => d.dialogue_id === "ch4_noor_cafe_4");
  assert.deepEqual(ch5Scene("ch5_noor_cafe_4").lines.map(line => line.speaker), cafe4.lines.map(line => line.speaker));
  assert.match(JSON.stringify(ch5Scene("ch5_noor_cafe_4").lines), /また日本に帰っちゃう/);
  assert.doesNotMatch(JSON.stringify(ch5Scene("ch5_noor_cafe_4").lines), /いつか日本に帰っちゃう/);
  // 第5章のカフェ・砂丘は ch5-dubai.js から performDesertSpot を通算の日で呼び、なる（地元の KEMURIKUSA にいる）を呼ばない。
  // 第4章の書き出し（宿・大会の前）は第5章の場面に差し替える（差し替え表が欠けると「いつか日本に帰っちゃう」等が第5章に出る）
  const ch5Dubai = readFileSync(new URL("../js/chapters/ch5-dubai.js", import.meta.url), "utf8");
  assert.match(ch5Dubai, /performDesertSpot\(spot, \{ day: state\.day, showHud, naru: false, scene: chapterFiveNoorScene \}\)/);
  assert.match(ch5Dubai, /desertChapterFiveSpots\(value, value\.day\)/);
  assert.match(ch5Dubai, /if \(spot\.id === DESERT_SPOT_IDS\.desk\) return visitNoorCafe\(spot, owner\)/);
  assert.match(ch5Dubai, /ch4_noor_meet: "ch5_noor_meet", ch4_noor_cafe_4: "ch5_noor_cafe_4", ch4_desert_sunset_first: "ch5_noor_sunset_first"/);
  assert.match(ch5Dubai, /NOOR_CAFE_AGAIN, \.\.\.Object\.values\(CH5_NOOR_SCENES\)/);
  assert.match(ch5Dubai, /owner\.flags\[NOOR_PROMISE_FLAG\] = noorConfessionWaiting\(owner\) && romance\.romanceRouteOpen\(DESERT_GUIDE\)/);
  assert.match(ch5Dubai, /finally \{ delete owner\.flags\[NOOR_PROMISE_FLAG\]; \}/);
  const desert = readFileSync(new URL("../js/chapters/ch4-desert.js", import.meta.url), "utf8");
  assert.match(desert, /const rivals = !naru \|\| \(confessionDay && !before\.naruMet\) \? \["noor"\] : desertRivals\(owner\)/);
  assert.match(desert, /visitDesert\(\{ kind: cafe \? "desert_talk" : "desert", ok: true \}, \{ day, paid: cafe, naru, scene \}\)/);
  assert.match(desert, /naru = true, scene = id => id \}/, "Chapter 4 passes no scene and reads its own lines");
  assert.match(desert, /read\(scene\(id\), bgUrl\("bg_dubai_cafe_salim_day"\)\)/);
  assert.match(desert, /owner\.flags\[NOOR_VISIT_CONFESSION_FLAG\] = \(owner\.finales\?\.\[DESERT_GUIDE\]\?\.chapter \|\| 0\) >= 5/);
  assert.match(desert, /delete owner\.flags\[NOOR_VISIT_CONFESSION_FLAG\]/);
});
