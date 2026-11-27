// tonari フロア営業のルールの検査（ワンオペ・ミックスを一覧から選ぶ形）。
// 実行: node --test remake/test/tonari_floor_model.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorResult, floorHint, floorBill, floorMaking, floorHand, floorShuffleLeft, floorShuffleTime, floorPlan,
  floorWaitLeft, floorStayLeft, floorCoalLeft, floorTendDue, floorFeverReady, floorFace, floorStage, floorTimeLeft, floorClock,
  floorOutlook, mixName, mixNameParts, mixFlavorNames, mixFlavorParts, mixFullName, mixIsSingle, mixRatings, evaluateMix, pickNight, floorOrderWait, floorFeverLength, floorSlots, FLOOR_TABLE_COUNT,
  rateMix, floorCallLine, floorDusk, createFloorTutorial, floorTutorialCue, floorVenueShuffleTime, floorFeverTargets,
} from "../js/daily/tonari-floor-model.js";
import {
  PRICE, FLAVORS, MIXES, WISHES, WISH_IDS, HAND_SIZE, GUESTS, VISITORS, CALLS, VERBS, NIGHTS, RANKS, MOODS, SERVE_LINES, SEND_LINES, mixIdsFor, mixChapter,
  TUTORIAL, CALL_MISS,
} from "../js/daily/tonari-floor-data.js";
import { playFloorBot, bestMix, floorBotAction } from "./tonari_floor_bot.mjs";
import { CHAT_COMMON, CHAT_TONARI, CHAT_MUKAI, CHAT_DUBAI, CHAT_STAFF, CHAT_SPEAKERS, VISITOR_CHATS } from "../js/daily/floor-chats.js";
import { FLOOR_VENUES } from "../js/daily/floor-venues.js";
import { OVERSEAS_HEROINES } from "../js/core/overseas-companion.js";

const at = (s, id) => s.tables[id - 1];
const act = (s, action) => {
  const next = floorAct(s, action);
  assert.notEqual(next, s, `t${s.t} ${JSON.stringify(action)} は受け付けられるはず`);
  return next;
};
const until = (s, done, limit = 500) => {
  for (let i = 0; i < limit && !done(s) && !s.done; i++) s = floorTick(s);
  assert.ok(done(s), `t${s.t} まで待っても条件を満たさない`);
  return s;
};
const wishOf = (s, tableId) => s.guests[at(s, tableId).guestId].order;
/** 一組目（1卓）に、並んでいる中でいちばん合う一台を出して、提供まで進める。 */
function serveFirst(s) {
  s = until(s, (x) => at(x, 1).phase === "order");
  s = act(s, { type: "order", tableId: 1, mix: bestMix(s, wishOf(s, 1)).id });
  return until(s, (x) => at(x, 1).phase === "enjoy");
}
/** その卓が会計を頼むまで進める（炭は自分から整え、頼みには正しく応える）。 */
function toBill(s, tableId = 1) {
  for (let i = 0; i < 700 && floorTap(s, tableId) !== "bill"; i++) {
    const tap = floorTap(s, tableId);
    s = tap === "care" ? act(s, { type: "care", tableId, verb: CALLS[at(s, tableId).call.type].verb })
      : tap === "tend" ? act(s, { type: "tend", tableId }) : floorTick(s);
  }
  assert.equal(floorTap(s, tableId), "bill");
  return s;
}

test("台本: 気分4つ・ミックスの一覧・ケア・客・夜の種類がそろっている。原価は持たない", () => {
  assert.deepEqual(WISHES.map((w) => w.label), ["フルーティ", "スイート", "刺激系", "リラックス"]);
  // 材料は、本編のフレーバー（data/flavors.json）から選ぶ。大会で使えない物・非売品は使わない。属性は本編の系統から、章は本編の解禁から決まる
  const game = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors.map((f) => [f.id, f]));
  const wishOfCategory = { fruit: "fruit", sweet: "sweet", cooling: "fresh", spice: "fresh", floral: "deep" };
  for (const f of Object.values(FLAVORS)) {
    const source = game[f.id];
    assert.ok(source, `${f.id}: 本編にあるフレーバー`);
    assert.ok(source.competition_legal !== false && source.serve_legal !== false && !source.not_for_sale, `${f.id}: 大会で使える`);
    assert.equal(f.family, f.id === "black_tea" ? "deep" : wishOfCategory[source.category], `${f.id}: 属性は本編の系統（${source.category}）から`);
    assert.equal(f.chapter, source.chapter_min ?? 1, `${f.id}: 出回る章は本編と同じ`);
    assert.ok(source.name.endsWith(f.label) || f.label.length <= 5, `${f.id}: 呼び名は短い`);
    // （）に出す名前は、本編のフレーバー名からメーカー名を除いたもの（わたあめ＝コットンキャンディ など、呼び名と違う物もそのまま出す）
    assert.equal(f.full, source.name.split(" ").slice(1).join(" "), `${f.id}: 材料として出す名前は、本編の名前`);
    assert.ok(f.fullParts.join("") === f.full && f.fullParts.every((part) => part.length >= 1 && part.length <= 6), `${f.id}: 狭い札では、6字までの切れ目で折れる`);
    assert.ok(f.also.every((wish) => WISH_IDS.includes(wish) && wish !== f.family));
  }
  assert.ok(Object.keys(MIXES).length >= 70, "ミックスは、一覧に並びきらない数がある");
  assert.ok(mixIdsFor(1).length >= 60 && mixIdsFor(2).length > mixIdsFor(1).length, "章が進むと、出せるミックスが増える");
  assert.ok(mixIdsFor(1).every((id) => mixChapter(id) === 1) && mixIdsFor(0).length === mixIdsFor(1).length);
  const names = new Set();
  for (const [id, mix] of Object.entries(MIXES)) {
    assert.ok(mix.flavors.length >= 1 && mix.flavors.length <= 3 && mix.flavors.every((f) => FLAVORS[f]), id);
    const name = mixName(id);
    // 1種の物はミックスではない。名前は「本編のフレーバー名＋単」（ダブルアップル単）で、作った名前（わたあめ など）は付けない。
    // 2〜3種のミックスは、名前（材料そのまま、または付けた名前）のあとに、使ったフレーバーを（）で添える
    const single = mix.flavors.length === 1;
    assert.equal(mixIsSingle(id), single);
    if (single) assert.deepEqual([name, mix.name], [`${FLAVORS[mix.flavors[0]].full}単`, null], `${id}: 単品の名前`);
    assert.ok(name.length >= 2 && name.length <= (single ? 11 : 10), `名前は札に収まる長さ: ${name}`);
    assert.ok(mixNameParts(id).every((part) => part.length <= (single ? 6 : 5)) && mixNameParts(id).join("") === name && !name.includes("｜"), `狭い札では、5字（単品は6字）までの切れ目で折れる: ${name}`);
    if (mix.flavors.length === 3) {
      // 3種のミックス: 右の列で（）が2行に収まる並び（前の二つか、後ろの二つが短い）。接客の画面で1行に収まる長さ
      const [a, b, c] = mix.flavors.map((f) => FLAVORS[f].full.length);
      assert.ok(mix.name && (a + b <= 7 || b + c <= 8) && a + b + c <= 14, `${name}: 3種の材料は札に収まる並び（${a}・${b}・${c}）`);
    }
    assert.ok(!names.has(name), `同じ名前が二つ無い: ${name}`);
    names.add(name);
    // 名前のあとに、使ったフレーバーを必ず（）で添える。グラム数は出さない（TFL44）
    assert.deepEqual(mixFlavorNames(id), mix.flavors.map((f) => FLAVORS[f].full));
    assert.deepEqual(mixFlavorParts(id).map((words) => words.join("")), mixFlavorNames(id));
    assert.equal(mixFullName(id), mix.flavors.length === 1 ? name : `${name}（${mixFlavorNames(id).join("・")}）`);
    assert.ok((mix.flavors.length === 1 ? /^[^（）0-9０-９]+単$/ : /^[^（）]+（[^（）0-9０-９]+）$/).test(mixFullName(id)) && !/グラム|[0-9０-９]\s*g/i.test(mixFullName(id)), mixFullName(id));
    // 属性はメイン一つと、あればサブ一つ。アップルミントとブルーベリーミントは名前の果物を主役にし、also がメイン
    const has = (wish) => mix.flavors.some((f) => FLAVORS[f].family === wish || FLAVORS[f].also.includes(wish));
    const appleFruit = id === "applemint" && mix.main === "fruit" && FLAVORS.double_apple.also.includes(mix.main);
    const berryFruit = id === "berrymint" && single && mix.flavors[0] === "blueberry_mint"
      && mix.main === "fruit" && mix.sub === "fresh" && FLAVORS.blueberry_mint.also.includes(mix.main);
    assert.ok(WISH_IDS.includes(mix.main) && (appleFruit || berryFruit || mix.flavors.some((f) => FLAVORS[f].family === mix.main)), `${name}: メインの属性が材料の系統にある`);
    assert.ok(mix.sub === null || (WISH_IDS.includes(mix.sub) && mix.sub !== mix.main && has(mix.sub)), `${name}: サブの属性が材料にある`);
    if (single) assert.equal(mix.main, berryFruit ? "fruit" : FLAVORS[mix.flavors[0]].family, `${name}: 単品の系統がメイン（ブルーベリーミントは果物が主役）`);
  }
  // フローズンベリー廃止（2026-11-26 オーナー決定）で第1章 fresh のメインは19件が上限
  for (const chapter of [1, 2]) for (const wish of WISH_IDS) {
    const main = mixIdsFor(chapter).filter((id) => MIXES[id].main === wish).length;
    assert.ok(main >= 19, `第${chapter}章・${wish}: メインのミックスが19件以上ある（${main}）`);
  }
  // 1種（単品）・2種・3種が、どの章でも並ぶ
  for (const chapter of [1, 2]) {
    const count = (n) => mixIdsFor(chapter).filter((id) => MIXES[id].flavors.length === n).length;
    assert.ok(count(1) >= 12 && count(2) >= 50 && count(3) >= 18, `第${chapter}章: 単品 ${count(1)}・2種 ${count(2)}・3種 ${count(3)}`);
    for (const wish of WISH_IDS) assert.ok(mixIdsFor(chapter).some((id) => MIXES[id].flavors.length === 3 && MIXES[id].main === wish), `第${chapter}章・${wish}: 3種のミックスがある`);
  }
  for (const f of Object.values(FLAVORS)) assert.equal("cost" in f, false, "原価は扱わない");
  assert.deepEqual(Object.keys(CALLS), ["thin", "harsh", "thirsty", "cough", "chatty"], "炭の調整は、頼みではなく自分から行く");
  for (const call of Object.values(CALLS)) {
    assert.ok(VERBS.some((v) => v.id === call.verb) && call.lines.length >= 3);
    for (const { said, sight, good, reply } of call.lines) {
      const back = call.verb === "chat" ? reply : good; // 雑談は、客の話しかけとはじめの返しの二回（TFL72）
      assert.ok(said && !said.endsWith("。") && back && !back.endsWith("。"));
      assert.ok(sight.endsWith("。"));
    }
  }
  assert.ok(CALL_MISS.length >= 3 && CALL_MISS.every((line) => !line.endsWith("。")));
  for (const night of Object.values(NIGHTS)) {
    assert.equal(night.cast.length, night.arrive.length, night.id);
    assert.ok(night.cast.every((kind) => GUESTS[kind]) && night.arrive.every((t, i) => i === 0 || t >= night.arrive[i - 1]));
  }
  for (const lines of Object.values(SERVE_LINES)) for (const line of lines) assert.ok(!line.endsWith("。"), line);
  assert.deepEqual(Object.keys(SERVE_LINES), ["best", "good", "off"]);
  assert.ok(SEND_LINES.extend.every((line) => /おかわり|もう一台/.test(line)), "延長とは言わない（おかわり）");
  assert.deepEqual([PRICE.shisha, PRICE.charge, PRICE.top, PRICE.drink], [2000, 700, 1500, 600]);
  assert.deepEqual(RANKS.map((r) => r.id), ["S", "A", "B", "C"]);
  assert.deepEqual([90, 70, 50, 30, 10].map(floorFace), ["moodMax", "moodGood", "moodOk", "moodLow", "moodMad"]);
  assert.equal(new Set(MOODS.map((m) => m.color)).size, 5);
  assert.equal(floorStage(85).id, "max");
});

test("ミックスの属性: メイン＝◎・サブ＝○・ほか＝×。提供した時の満足になる", () => {
  const fruitMintMixes = [
    "lemonmint", "grapemint", "orangemint", "pinemint", "peachmint", "watermelonmint", "cherrymint", "passionmint",
    "dragonmint", "applemint", "berrymint", "limemint", "mojito", "suikacooler", "cherrycooler", "oasismint",
  ];
  for (const id of fruitMintMixes) {
    assert.deepEqual(mixRatings(id), { fruit: "best", sweet: "none", fresh: "good", deep: "none" }, mixName(id));
  }
  assert.deepEqual(mixRatings("minttea"), { fruit: "none", sweet: "none", fresh: "best", deep: "good" });
  assert.deepEqual(mixRatings("apple"), { fruit: "good", sweet: "none", fresh: "best", deep: "none" }, "ダブルアップル単は刺激系がメイン");
  assert.equal(mixRatings("icegrape").fresh, "best");
  assert.equal(mixRatings("gingerlemon").fresh, "best");
  assert.deepEqual(mixRatings("honeyginger"), { fruit: "none", sweet: "best", fresh: "good", deep: "none" });
  assert.deepEqual(mixRatings("cardamomtea"), { fruit: "none", sweet: "none", fresh: "best", deep: "good" });
  assert.deepEqual(mixRatings("cardamomearlgrey"), { fruit: "none", sweet: "none", fresh: "best", deep: "good" }, "スパイス紅茶は先頭のスパイスがメイン");
  assert.deepEqual(mixRatings("caramelmilk"), { fruit: "none", sweet: "best", fresh: "none", deep: "none" });
  assert.deepEqual(mixRatings("milktea"), { fruit: "none", sweet: "best", fresh: "none", deep: "good" }, "ミルクティーは先頭のミルクがメイン");
  for (const id of Object.keys(MIXES)) {
    const marks = Object.values(mixRatings(id));
    assert.deepEqual([marks.filter((r) => r === "best").length, marks.filter((r) => r === "good").length], [1, MIXES[id].sub ? 1 : 0], id);
  }
  assert.equal(mixRatings("nothing"), null);
  assert.equal(mixName("lemonmint"), "レモンミント");
  assert.equal(mixName("chocomint"), "チョコミント");
  assert.deepEqual(mixNameParts("chocomint"), ["チョコ", "ミント"]);
  assert.deepEqual(mixNameParts("lemonmint"), ["レモン", "ミント"]);
  // 1種の物は「〜単」。作った名前は付けず、（）も付けない（名前がそのまま中身）
  assert.deepEqual([mixName("cottoncandy"), mixFullName("cottoncandy"), mixNameParts("cottoncandy")], ["コットンキャンディ単", "コットンキャンディ単", ["コットン", "キャンディ単"]]);
  assert.deepEqual([mixName("apple"), mixFullName("apple"), mixNameParts("apple")], ["ダブルアップル単", "ダブルアップル単", ["ダブル", "アップル単"]]);
  assert.deepEqual([mixName("cappuccino"), mixName("earlgrey"), mixName("mintshake")], ["カプチーノ単", "アールグレイ単", "ペパーミントシェイク単"]);
  // 3種のミックス: 名前のあとに、3つのフレーバー
  assert.equal(mixFullName("chai"), "チャイ（ブラックティー・シナモン・ハニー）");
  assert.equal(mixFullName("tropical"), "トロピカル（パイナップル・マンゴー・バナナ）");
  assert.deepEqual(mixNameParts("flowergarden"), ["フラワー", "ガーデン"]);
  // 名前だけでは材料が分からないミックスも、（）を見れば分かる
  assert.equal(mixFullName("cafemocha"), "カフェモカ（コーヒー・チョコレート）");
  assert.equal(mixFullName("milktea"), "ミルクティー（アールグレイ・ミルク）");
  assert.equal(mixFullName("caramelnuts"), "キャラメルナッツ（キャラメル・ヘーゼルナッツ）");
  assert.equal(mixFullName("lemonmint"), "レモンミント（レモン・ミント）");
  assert.deepEqual(mixFlavorParts("cottoncandy"), [["コットン", "キャンディ"]]);
  // 3種のミックスは、仕込みが長いぶん、合った時（◎・○）の満足が少し高い（合わない時は同じ）
  assert.deepEqual([evaluateMix("chai", { wish: "deep" }).mood, evaluateMix("chai", { wish: "sweet" }).mood, evaluateMix("chai", { wish: "fresh" }).mood], [94, 30, 76]);
  assert.deepEqual([evaluateMix("cinnamontea", { wish: "fresh" }).mood, evaluateMix("apple", { wish: "fresh" }).mood], [90, 90], "2種と単品は、これまでどおり");
  assert.deepEqual([mixFlavorNames("nothing"), mixFlavorParts("nothing")], [[], []]);
  const order = { wish: "fruit" };
  const best = evaluateMix("lemonmint", order), good = evaluateMix("honeylemon", order), none = evaluateMix("caramelmilk", order);
  assert.deepEqual([best.rating, good.rating, none.rating], ["best", "good", "none"]);
  assert.deepEqual([best.grade, good.grade, none.grade], ["best", "good", "off"]);
  assert.ok(best.mood >= 85 && good.mood >= 65 && good.mood < 85 && none.mood < 40);
  // こだわりの客は、ぴったりでないと少し辛い（ぴったりなら同じ）
  assert.equal(evaluateMix("lemonmint", order, "keen").mood, best.mood);
  assert.ok(evaluateMix("honeylemon", order, "keen").mood < good.mood);
});

test("同じ種なら同じ一晩。操作も経過も元の state を書き換えない。客は気分を言うだけ", () => {
  const input = { seed: 321, level: 2, chapter: 1 };
  const a = createFloorNight(input), b = createFloorNight(input);
  assert.deepEqual(a, b);
  assert.equal(a.tables.length, FLOOR_TABLE_COUNT);
  const frozen = structuredClone(a);
  const later = floorTick(a, 10);
  assert.deepEqual(a, frozen);
  assert.equal(later.t, 10);
  assert.equal(floorAct(later, { type: "order", tableId: 9, mix: later.hand[0] }), later, "無い卓は何も進めない");
  assert.equal(floorAct(later, { type: "bill", tableId: 1 }), later, "会計前の卓は会計できない");
  assert.equal(act(later, { type: "order", tableId: 1, mix: later.hand[0] }).t, later.t, "操作は時間を使わない");
  // 注文は気分だけ。フレーバーの名指し（「〇〇だけで」）はしない
  const labels = Object.values(FLAVORS).map((f) => f.label);
  const seen = new Set();
  for (let seed = 0; seed < 30; seed++) for (const g of Object.values(createFloorNight({ seed, level: 3 }).guests)) {
    assert.deepEqual(Object.keys(g.order), ["wish", "quote"]);
    assert.ok(WISH_IDS.includes(g.order.wish) && g.order.quote.length <= 24 && !g.order.quote.endsWith("。"), g.order.quote);
    assert.ok(!labels.some((label) => g.order.quote.includes(label)), `名指ししない: ${g.order.quote}`);
    assert.ok(WISHES.find((w) => w.id === g.order.wish).say.includes(g.order.quote));
    seen.add(g.order.wish);
  }
  assert.equal(seen.size, 4);
  assert.equal(pickNight(0, 5).id, "first");
  assert.equal(pickNight(1, 5).id, "usual");
  assert.equal(pickNight(3, 5, { rainy: true }).id, "rain");
  assert.equal(createFloorNight({ level: 0 }).hint, "said");
  assert.equal(createFloorNight({ level: 3 }).hint, "sight");
  assert.equal(floorTimeLeft(a), "3:00");
  assert.equal(floorClock(createFloorNight({ level: 1, daytime: true })), "12:00");
});

test("来店と注文待ち: 客は自分で座る。注文を聞かないと、怒って帰ってファンが減る", () => {
  let s = createFloorNight({ seed: 7, level: 1 });
  assert.equal(floorTap(s, 1), "none");
  s = until(s, (x) => at(x, 1).phase === "order");
  assert.equal(s.log.find((e) => e.type === "arrive").line, wishOf(s, 1).quote, "来店した時に、気分をひとこと言う");
  assert.equal(floorTap(s, 1), "order");
  assert.equal(floorWaitLeft(s, 1), floorOrderWait(s));
  assert.equal(floorHint(s).kind, "order");
  assert.equal(floorBill(s, 1).total, 0);
  const gone = until(s, (x) => x.counts.left === 1, 60);
  assert.equal(gone.fans, -3);
  assert.equal(gone.results[0].left, true);
  assert.equal(gone.sales, 0);
  assert.ok(floorOrderWait(createFloorNight({ level: 0 })) > floorOrderWait(s), "はじめての営業は、長く待ってくれる");
  // 営業の種類は、回数と天気で決まる。名指しもできる（デバッグの試遊）
  assert.deepEqual([floorPlan(createFloorNight({ level: 0 })).id, floorPlan(createFloorNight({ level: 1 })).id, floorPlan(createFloorNight({ level: 1, night: "full" })).id], ["first", "usual", "full"]);
  assert.equal(floorPlan(createFloorNight({ level: 1, daytime: true })).title, "いつもの昼");
});

test("二人連れ: 一卓に一人。同じ時に来て、空いている卓へ一人ずつ座り、注文も会計も一人ずつ（TFL51）", () => {
  for (const night of Object.keys(NIGHTS)) {
    const s = createFloorNight({ seed: 3, level: 1, night });
    const people = NIGHTS[night].cast.reduce((sum, kind) => sum + GUESTS[kind].party, 0);
    assert.equal(Object.keys(s.guests).length, people, `${night}: 二人連れは二人の客になる`);
    for (const g of Object.values(s.guests)) {
      assert.equal(g.party, 1, `${night}: ${g.id} は一人`);
      if (!g.pair) continue;
      const mate = s.guests[g.pair];
      assert.deepEqual([mate.pair, mate.arrive, mate.kind], [g.id, g.arrive, g.kind], `${night}: 連れとは同じ時に来る`);
      assert.notEqual(mate.art, g.art, "絵は一人ずつ違う");
    }
  }
  // 来たら、空いている卓へ一人ずつ座る（同じ卓には座らない）
  let s = createFloorNight({ seed: 3, level: 1, night: "full" });
  const pair = Object.values(s.guests).find((g) => g.pair);
  s = until(s, (x) => x.tables.some((t) => t.guestId === pair.id) && x.tables.some((t) => t.guestId === pair.pair), 40);
  const seats = s.tables.filter((t) => t.guestId === pair.id || t.guestId === pair.pair);
  assert.equal(new Set(seats.map((t) => t.id)).size, 2);
  assert.ok(seats.every((t) => t.phase === "order"), "注文も一人ずつ");
});

test("注文: 並んでいるミックスから選ぶ。出すと次の一つが入る。仕込みは同時に2台まで", () => {
  let s = createFloorNight({ seed: 7, level: 1 });
  assert.equal(s.hand.length, HAND_SIZE);
  assert.equal(new Set([...s.hand, ...s.deck]).size, mixIdsFor(1).length, "その章で出せるミックスが、山に入る");
  assert.equal(new Set([...createFloorNight({ seed: 7, level: 1, chapter: 2 }).hand, ...createFloorNight({ seed: 7, level: 1, chapter: 2 }).deck]).size, mixIdsFor(2).length);
  s = until(s, (x) => at(x, 1).phase === "order");
  const hand = floorHand(s, wishOf(s, 1).wish);
  assert.deepEqual(hand.map((h) => h.id), s.hand);
  assert.ok(hand.every((h) => h.name === mixName(h.id) && h.rating === h.ratings[wishOf(s, 1).wish]));
  assert.ok(hand.every((h) => h.recipe.length >= 1 && h.recipe.join("・") === mixFlavorNames(h.id).join("・")), "一覧の札は、使ったフレーバーを持つ");
  assert.ok(hand.every((h) => h.main === MIXES[h.id].main && h.sub === MIXES[h.id].sub), "並んでいる札に、メインとサブの属性が付く");
  const outside = s.deck[3];
  assert.equal(floorAct(s, { type: "order", tableId: 1, mix: outside }), s, "並んでいないミックスは出せない");
  const pick = hand[1].id, next = s.deck[0];
  const ordered = act(s, { type: "order", tableId: 1, mix: pick });
  assert.equal(at(ordered, 1).phase, "prep");
  assert.equal(at(ordered, 1).mix, pick);
  assert.equal(ordered.hand[1], next, "出した所に、次の一つが入る");
  assert.ok(!ordered.hand.includes(pick));
  assert.deepEqual(ordered.hand.filter((_, i) => i !== 1), s.hand.filter((_, i) => i !== 1));
  assert.equal(ordered.log[0].rating, hand[1].rating);
  assert.deepEqual(floorBill(ordered, 1), { charge: PRICE.charge, shisha: 0, drink: PRICE.drink, top: 0, total: PRICE.charge + PRICE.drink }, "チャージと初回のドリンク");
  assert.deepEqual(floorMaking(ordered).map((m) => [m.tableId, m.label, m.active]), [[1, mixName(pick), true]]);
  // 三台目は、枠が空くまで待つ
  s = ordered;
  for (const id of [2, 3]) { s = until(s, (x) => at(x, id).phase === "order", 60); s = act(s, { type: "order", tableId: id, mix: s.hand[0] }); }
  const making = floorMaking(s);
  if (making.length === 3) assert.deepEqual(making.map((m) => m.active), [true, true, false]);
  assert.equal(floorSlots, 2);
  s = until(s, (x) => at(x, 1).phase === "enjoy");
  assert.equal(floorBill(s, 1).shisha, PRICE.shisha);
  assert.equal(at(s, 1).rating, hand[1].rating);
  assert.ok(s.log.some((e) => e.type === "serve") || floorStayLeft(s, 1) > 0.9);
  // 山が尽きても、出ていないミックスから組み直して出し続けられる
  let long = createFloorNight({ seed: 2, level: 5, night: "full" });
  long.deck = [];
  long = until(long, (x) => at(x, 1).phase === "order");
  const previous = [...long.hand];
  long = act(long, { type: "order", tableId: 1, mix: previous[0] });
  assert.ok(!previous.includes(long.hand[0]), "山の組み直しでも、出したばかりの一台はすぐに補充しない");
  assert.deepEqual(long.hand.slice(1), previous.slice(1), "提供した枠だけを入れ替える");
  assert.equal(long.hand.length, HAND_SIZE);
  assert.equal(new Set(long.hand).size, HAND_SIZE);
});

test("シャッフル: 並んでいるミックスを全部入れ替える。入れ替えには時間がかかり、その間は出せない", () => {
  let s = until(createFloorNight({ seed: 7, level: 1 }), (x) => at(x, 1).phase === "order");
  const before = [...s.hand];
  assert.equal(floorShuffleLeft(s), 0);
  const shuffled = act(s, { type: "shuffle" });
  assert.ok(shuffled.hand.every((id) => !before.includes(id)), "いま並んでいた物は出てこない");
  assert.equal(new Set([...shuffled.hand, ...shuffled.deck]).size, mixIdsFor(1).length);
  assert.equal(shuffled.shuffles, 1);
  assert.deepEqual(shuffled.log, [{ type: "shuffle", ticks: floorShuffleTime }]);
  // 入れ替えには2秒かかる。その間は、ミックスを出せず、シャッフルも重ねられない（客は待っている）
  assert.equal(floorShuffleLeft(shuffled), floorShuffleTime);
  assert.equal(floorShuffleTime, 4); // 0.5秒刻みで2秒
  assert.equal(floorAct(shuffled, { type: "order", tableId: 1, mix: shuffled.hand[0] }), shuffled, "入れ替えの最中は出せない");
  assert.equal(floorAct(shuffled, { type: "shuffle" }), shuffled, "重ねては出来ない");
  assert.equal(floorHint(shuffled).kind, "shuffle", "その間は、ほかの卓を見る");
  const waiting = floorWaitLeft(shuffled, 1);
  const later = floorTick(shuffled, floorShuffleTime);
  assert.equal(floorShuffleLeft(later), 0);
  assert.ok(later.log.some((e) => e.type === "shuffleDone"));
  assert.equal(floorWaitLeft(later, 1), waiting - floorShuffleTime, "入れ替えの間も、客の待ち時間は減る");
  assert.equal(at(act(later, { type: "order", tableId: 1, mix: later.hand[0] }), 1).phase, "prep");
  assert.notDeepEqual(act(later, { type: "shuffle" }).hand, later.hand);
  assert.deepEqual(act(s, { type: "shuffle" }).hand, shuffled.hand, "同じ種・同じ操作なら同じ並び");
  // 待たせた分だけ、最初の満足が下がる（すぐ出せば下がらない）
  const mixId = Object.keys(MIXES).find((id) => MIXES[id].main === wishOf(s, 1).wish);
  const serveAfter = (state, ticks) => {
    let x = floorTick(state, ticks);
    x.hand[0] = mixId;
    x = until(act(x, { type: "order", tableId: 1, mix: mixId }), (y) => at(y, 1).phase === "enjoy");
    return x.log.find((e) => e.type === "serve") || { mood: at(x, 1).mood, late: null };
  };
  const quick = serveAfter(s, 1), slow = serveAfter(s, 14);
  assert.deepEqual([quick.late, quick.mood], [0, 90]);
  assert.ok(slow.late >= 5 && slow.mood === 90 - slow.late, `待たせると下がる（${slow.late}）`);
});

test("提供したミックスは、次のシャッフルでもう一度出ることがある", () => {
  let appeared = false;
  // 母数が変わると乱数の並びがずれる（フローズンベリー廃止後は初出が seed 132）ため、走査は 256 まで
  for (let seed = 1; seed <= 256 && !appeared; seed++) {
    let s = until(createFloorNight({ seed, level: 1 }), (x) => at(x, 1).phase === "order");
    const served = s.hand[0];
    s = act(s, { type: "order", tableId: 1, mix: served });
    assert.ok(!s.hand.includes(served));
    appeared = act(s, { type: "shuffle" }).hand.includes(served);
  }
  assert.ok(appeared, "一度出したミックスも入れ替えの候補になる");
});

test("一般の注文は選んだ卓に合わせ、盤の強化で◎の出る割合が上がる", () => {
  const trials = 256;
  function matches(floorMatch) {
    let first = 0, either = 0;
    for (let seed = 1; seed <= trials; seed++) {
      let s = floorTick(createFloorNight({ seed, level: 5, night: "full", floorPerks: { floorMatch } }), 8);
      const order = wishOf(s, 2);
      // 先に来た1卓と、今選んだ2卓が別の属性を待っている。
      wishOf(s, 1).wish = "sweet";
      order.wish = "deep";
      s = act(s, { type: "shuffle", tableId: 2 });
      const hit = floorHand(s, order).some((m) => m.rating === "best");
      if (hit) first++;
      else s = act(floorTick(s, floorShuffleTime), { type: "shuffle", tableId: 2 });
      if (hit || floorHand(s, order).some((m) => m.rating === "best")) either++;
    }
    return { first, either };
  }
  const base = matches(0), trained = matches(20);
  assert.ok(base.first > trials * 0.65 && base.first < trials * 0.90, `基本は一度でも当たりやすく、外れもある（${base.first}/${trials}）`);
  assert.ok(base.either > trials * 0.90, `2回までに◎が出る（${base.either}/${trials}）`);
  assert.ok(trained.first > base.first + trials * 0.10, `強化で初回の◎が増える（${base.first} → ${trained.first}）`);
});

test("シャッフルしすぎると損をする: ◎が出るまで回し続けると、満席の日は客を待たせて帰られる", () => {
  const NIGHTS_PLAYED = 48; // ミックスの顔ぶれで1晩ごとの揺れが大きいので、夜数を多めに取る
  const total = (pick) => Array.from({ length: NIGHTS_PLAYED }, (_, i) => playFloorBot({ seed: i + 1, level: 5, night: "full", pace: 6, pick }).result)
    .reduce((sum, r) => ({ left: sum.left + r.left, score: sum.score + r.score, shuffles: sum.shuffles + r.shuffles }), { left: 0, score: 0, shuffles: 0 });
  const careful = total("best"), greedy = total("greedy");
  assert.ok(greedy.shuffles > careful.shuffles * 3, `欲張ると、何倍も回す（${careful.shuffles} → ${greedy.shuffles}）`);
  assert.ok(greedy.left >= careful.left + NIGHTS_PLAYED, `待たせて帰られる組が増える（1晩に1組以上。${careful.left} → ${greedy.left}）`);
  assert.ok(greedy.score < careful.score - 3 * NIGHTS_PLAYED, `満足の平均も下がる（1晩あたり3点以上。${careful.score} → ${greedy.score}）`); // 閾値はミックス拡充（107→156件・PR #4257）後の実測（48晩で196点低下・1晩平均4.08点）に合わせて再校正（2026-11-26）
});

test("調整: 炭の残りが少なくなったら、頼まれる前に自分から行く。放っておくと客から頼まれる", () => {
  let s = serveFirst(createFloorNight({ seed: 7, level: 1, night: "usual" }));
  at(s, 1).wants = []; // 炭の話だけを見る
  assert.equal(floorCoalLeft(s, 1), 1);
  assert.equal(floorTap(s, 1), "info", "炭がまだ残っているうちは、行っても変わらない");
  assert.equal(floorAct(s, { type: "tend", tableId: 1 }), s);
  s = until(s, (x) => floorTendDue(x, 1), 80);
  assert.ok(floorCoalLeft(s, 1) <= 0.35 && floorCoalLeft(s, 1) > 0);
  assert.equal(floorTap(s, 1), "tend");
  assert.equal(at(s, 1).call, null, "客は、まだ何も言っていない");
  assert.equal(floorHint({ ...s, tables: s.tables.map((x) => (x.id === 1 ? x : { ...x, phase: "empty", guestId: null, call: null })) }).kind, "tend");
  const mood = at(s, 1).mood;
  const tended = act(s, { type: "tend", tableId: 1 });
  assert.ok(Math.abs(at(tended, 1).mood - (mood + 6)) < 0.01, "いい調整で満足が上がる");
  assert.equal(floorCoalLeft(tended, 1), 1);
  assert.equal(tended.counts.tend, 1);
  assert.ok(tended.fever > s.fever);
  assert.equal(tended.log[0].type, "tend");
  assert.equal(floorTap(tended, 1), "info");
  // 行かないと、客のほうから頼まれる（煙が薄い／熱を下げてほしい）。満足も下がる
  const ignored = until(s, (x) => !!at(x, 1).call, 60);
  assert.ok(["thin", "harsh"].includes(at(ignored, 1).call.type) && at(ignored, 1).call.coal);
  assert.equal(ignored.counts.tendLate, 1);
  assert.ok(at(ignored, 1).mood < mood - 3);
  assert.equal(floorTap(ignored, 1), "care");
  const fixed = act(ignored, { type: "care", tableId: 1, verb: CALLS[at(ignored, 1).call.type].verb });
  assert.equal(floorCoalLeft(fixed, 1), 1, "正しく応えれば、炭も整う");
  // 持続性の高いミックスほど、調整の間隔が長い
  const span = (mix) => { const x = createFloorNight({ seed: 7, level: 1 }); let y = until(x, (z) => at(z, 1).phase === "order"); y.hand[0] = mix; y = act(y, { type: "order", tableId: 1, mix }); return at(until(y, (z) => at(z, 1).phase === "enjoy"), 1).coalSpan; };
  assert.ok(span("apple") > span("lemonmint"));
  assert.equal(span("apple"), span("rosejasmine"), "刺激系になったスパイスも花と同じ調整間隔");
});

test("頼み: 5つの手から正しい物で応える。外す・放っておくと満足が下がる", () => {
  let s = serveFirst(createFloorNight({ seed: 7, level: 1, night: "usual" })); // 一組目は初めての方（むせやすい）
  s = until(s, (x) => !!at(x, 1).call, 80);
  assert.equal(at(s, 1).call.type, "cough");
  assert.equal(floorTap(s, 1), "care");
  assert.equal(floorHint(s).kind === "call" || floorHint(s).kind === "order", true);
  const mood = at(s, 1).mood;
  const good = act(s, { type: "care", tableId: 1, verb: "teach" });
  assert.ok(at(good, 1).mood > mood && good.counts.care === 1 && good.log[0].ok);
  assert.ok(CALLS.cough.lines.some(({ good: line }) => at(good, 1).line === line));
  const miss = act(s, { type: "care", tableId: 1, verb: "water" });
  assert.ok(at(miss, 1).mood < mood - 7 && miss.counts.careMiss === 1 && !miss.log[0].ok);
  const late = until(s, (x) => !at(x, 1).call, 40);
  assert.ok(at(late, 1).mood < mood - 9 && late.counts.late === 1);
  assert.equal(floorAct(good, { type: "care", tableId: 1, verb: "teach" }), good, "頼まれていない卓には応えられない");
});

test("頼みの台詞と地の文は、同じ営業内で同じ一文が続かない", () => {
  for (const [type, { verb, lines }] of Object.entries(CALLS)) {
    let s = serveFirst(createFloorNight({ seed: 7, level: 3, night: "usual" }));
    s.upcoming = [];
    at(s, 1).stayEnd = s.length;
    const coal = type === "thin" || type === "harsh";
    const seen = { said: [], sight: [], good: [], miss: [] };
    for (let i = 0; i < 2 * (lines.length + 1); i++) {
      const table = at(s, 1);
      table.nextCall = s.t;
      if (coal) {
        const harshNextTick = Boolean((s.seed + table.id + s.t + 1) % 2);
        table.coalAt = s.t + (harshNextTick === (type === "harsh") ? 1 : 2);
        table.wants = [];
      } else {
        table.coalAt = s.length;
        table.wants = [{ type, at: s.t }];
      }
      s = until(s, (x) => !!at(x, 1).call, 2);
      assert.equal(at(s, 1).call.type, type);
      const call = floorCallLine(s, 1);
      assert.deepEqual(floorCallLine(s, 1), call, "同じ頼みを読み直しても変わらない");
      seen.said.push(call.said);
      seen.sight.push(call.sight);
      const ok = i % 2 === 0;
      s = act(s, { type: "care", tableId: 1, verb: ok ? verb : verb === "chat" ? "water" : "chat" });
      seen[ok ? "good" : "miss"].push(at(s, 1).line);
    }
    for (const [kind, shown] of Object.entries(seen)) {
      assert.ok(new Set(shown).size >= 3, `${type}: ${kind} に3種類以上出る`);
      shown.slice(1).forEach((line, i) => assert.notEqual(line, shown[i], `${type}: ${kind} の連続`));
    }
  }
});

// ---- 雑談（TFL68〜72）: 客の話しかけ → はじめ（つむぎ）の返しの二回のキャッチボール ----
/** 1卓の客に、雑談の頼みを n 回出させて、そのたびに応える。出た雑談（台本の行）と、応えた後の state を返す。 */
function chatRounds(s, n, tableId = 1) {
  const shown = [];
  for (let i = 0; i < n; i++) {
    Object.assign(at(s, tableId), { nextCall: s.t, coalAt: s.length, stayEnd: s.length, call: null, wants: [{ type: "chatty", at: s.t }] });
    s = until(s, (x) => !!at(x, tableId).call, 3);
    assert.equal(at(s, tableId).call.type, "chatty");
    const asked = floorCallLine(s, tableId);
    s = act(s, { type: "care", tableId, verb: "chat" });
    const care = s.log.find((e) => e.type === "care");
    shown.push({ said: asked.said, sight: asked.sight, reply: care.reply, by: care.by, line: at(s, tableId).line });
  }
  return { s, shown };
}

test("雑談の台本: 味・趣味・何気ない話・愚痴をたっぷり。客とはじめの二回のキャッチボールで、どれも短く、大会に触れない（TFL68〜74）", () => {
  const venues = Object.values(FLOOR_VENUES);
  const rows = [
    ...CHAT_COMMON, ...CHAT_TONARI, ...CHAT_MUKAI, ...CHAT_DUBAI, ...Object.values(CHAT_STAFF).flat(),
    ...Object.values(VISITOR_CHATS).flatMap((byId) => Object.values(byId).flat()),
  ];
  const lines = new Set();
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).filter((k) => ["said", "sight", "reply", "good"].includes(k)), ["said", "sight", "reply"], `二回のキャッチボール（客のひとことは無い）: ${row.said}`);
    assert.ok(!/[？?]$/.test(row.reply), `返しは質問で終えず、言い切って会話を閉じる: ${row.reply}`);
    for (const key of ["said", "reply"]) {
      const line = row[key];
      assert.ok(line && !line.endsWith("。"), `台詞は句点で終えない: ${line}`);
      assert.ok([...line].length <= 20, `できる限り短く（20字まで・TFL74）: ${line}`);
      assert.ok((line.match(/。/g) || []).length <= 2, line);
      assert.ok(!lines.has(line), `同じ台詞を使い回さない: ${line}`);
      lines.add(line);
    }
    assert.ok(row.sight.endsWith("。") && [...row.sight].length <= 22 && !lines.has(row.sight), row.sight);
    lines.add(row.sight);
    assert.ok(!/大会|本番|優勝|予選|審査|決勝/.test(`${row.said}${row.reply}${row.sight}`), `大会の前後どちらでも通る: ${row.said}`);
    assert.ok(!row.by || CHAT_SPEAKERS[row.by], row.by);
    assert.ok(!row.at || ["day", "night"].includes(row.at), row.at);
  }
  // モブの共通の言葉（頼み・提供・見送り）とも重ならない
  const mob = [...Object.entries(CALLS).filter(([k]) => k !== "chatty").flatMap(([, c]) => c.lines.flatMap((l) => [l.said, l.good])), ...CALL_MISS];
  for (const line of mob) assert.ok(!lines.has(line), line);
  assert.equal(CALLS.chatty.lines, CHAT_COMMON, "どの店でも通る味の話が、頼みの雑談の既定");
  // 店ごと: 味の話（全店共通・30本以上）＋その店の客の話。どの店（tonari・東京 mukai・ドバイ）も、趣味・何気ない話・愚痴を20本以上ずつ（TFL71・73）
  const topics = (list) => Object.fromEntries(["taste", "hobby", "daily", "gripe"].map((t) => [t, list.filter((c) => c.topic === t).length]));
  for (const v of venues) {
    const counts = topics(v.chats);
    assert.ok(counts.taste >= 30 && ["hobby", "daily", "gripe"].every((t) => counts[t] >= 20), `${v.id}: ${JSON.stringify(counts)}`);
    assert.ok(v.chats.length >= 90, `${v.id}: 雑談 ${v.chats.length} 本`);
    assert.ok(CHAT_COMMON.every((c) => v.chats.includes(c)), v.id);
    assert.ok(v.chats.some((c) => c.at === "day") && v.chats.some((c) => c.at === "night"), `${v.id}: 昼だけ・夜だけの話もある`);
    // レアで来る本編の人物は、全員その人だけの雑談を持つ（五本ずつ。ドバイへ同行した人は三本から）
    for (const who of Object.values(v.visitors)) assert.ok(v.visitorChats[who.id]?.length >= 5, `${v.id}: ${who.id}`);
  }
  for (const id of OVERSEAS_HEROINES) assert.ok(FLOOR_VENUES.dubai.visitorChats[id]?.length >= 3, `ドバイへ同行した ${id}`);
  // つむぎが働く日の話: 客がつむぎのことを話す物と、つむぎ本人が返す物
  const staff = CHAT_STAFF.tsumugi;
  assert.ok(staff.length >= 20 && staff.filter((c) => c.by === "tsumugi").length >= 8 && staff.filter((c) => !c.by).length >= 10);
  assert.ok(staff.filter((c) => c.by === "tsumugi").every((c) => c.reply.startsWith("……")), "つむぎは、間に「……」を置いて話す");
});

test("雑談: その店の話から選び、出しきるまで同じ話を繰り返さない。昼だけ・夜だけの話は、その時間にだけ出る", () => {
  const byLine = new Map([...FLOOR_VENUES.tonari.chats, ...CHAT_MUKAI, ...CHAT_DUBAI].map((c) => [c.said, c]));
  // 夜の営業: 昼だけの話は出ない。出しきるまで、同じ話は出ない
  const nightFits = FLOOR_VENUES.tonari.chats.filter((c) => c.at !== "day");
  let s = serveFirst(createFloorNight({ seed: 11, level: 3, night: "usual" }));
  s.upcoming = [];
  const { s: after, shown } = chatRounds(s, nightFits.length + 3);
  const first = shown.slice(0, nightFits.length).map((c) => c.said);
  assert.equal(new Set(first).size, nightFits.length, "出しきるまで繰り返さない");
  shown.slice(1).forEach((c, i) => assert.notEqual(c.said, shown[i].said, "出しきった後も、直前の話は続けない"));
  for (const c of shown) {
    const row = byLine.get(c.said);
    assert.ok(row && row.at !== "day", c.said);
    assert.deepEqual([c.sight, c.reply, c.by, c.line], [row.sight, row.reply, "hajime", row.reply], "話しかけと返しは一組。卓の言葉は返し");
  }
  assert.ok(after.counts.care >= shown.length, "雑談に応えるのもケアに数える");
  // 昼の営業（日が暮れる前）: 夜だけの話は出ない
  let day = serveFirst(createFloorNight({ seed: 11, level: 3, night: "usual", daytime: true }));
  day.upcoming = [];
  for (const c of chatRounds(day, 20).shown) assert.notEqual(byLine.get(c.said).at, "night", c.said);
  // mukai・ドバイは、その店の話と味の話だけ
  for (const [venue, own] of [["mukai", CHAT_MUKAI], ["dubai", CHAT_DUBAI]]) {
    let v = serveFirst(createFloorNight({ venue, seed: 4, level: 3, chapter: venue === "mukai" ? 3 : 4, night: "usual" }));
    v.upcoming = [];
    const said = chatRounds(v, 24).shown.map((c) => c.said);
    assert.ok(said.every((line) => [...CHAT_COMMON, ...own].some((c) => c.said === line)), venue);
    assert.ok(said.some((line) => own.some((c) => c.said === line)), `${venue}: その店の客の話が出る`);
  }
});

test("雑談: つむぎが働く日（第5章の tonari）は、一部がつむぎの話になり、つむぎ本人が返すこともある（TFL69）", () => {
  const staff = CHAT_STAFF.tsumugi;
  const plain = serveFirst(createFloorNight({ seed: 21, level: 3, chapter: 5, night: "usual" }));
  plain.upcoming = [];
  assert.equal(plain.staff, null);
  assert.ok(chatRounds(plain, 30).shown.every((c) => !staff.some((x) => x.said === c.said)), "つむぎがいない日は、つむぎの話は出ない");
  let s = serveFirst(createFloorNight({ seed: 21, level: 3, chapter: 5, night: "usual", staff: "tsumugi" }));
  s.upcoming = [];
  assert.equal(s.staff, "tsumugi");
  const shown = chatRounds(s, 30).shown;
  const hers = shown.filter((c) => staff.some((x) => x.said === c.said));
  assert.ok(hers.length >= 6 && hers.length <= 24, `30回のうち、つむぎの話 ${hers.length} 回`);
  assert.ok(shown.length - hers.length >= 6, "ふつうの雑談も混ざる");
  for (const c of hers) {
    const row = staff.find((x) => x.said === c.said);
    assert.deepEqual([c.reply, c.by, c.line], [row.reply, row.by || "hajime", row.reply]);
  }
  assert.ok(hers.some((c) => c.by === "tsumugi") && hers.some((c) => c.by === "hajime"), "つむぎが返す話も、はじめが返す話もある");
  assert.equal(createFloorNight({ seed: 21, staff: "nobody" }).staff, null);
  // 同じ種なら、つむぎがいてもいなくても、客の並び・注文・ミックスの並びは同じ（雑談の選び方は、他の抽選を動かさない）
  const a = createFloorNight({ seed: 21, level: 3, chapter: 5 }), b = createFloorNight({ seed: 21, level: 3, chapter: 5, staff: "tsumugi" });
  assert.deepEqual([a.guests, a.hand, a.deck], [b.guests, b.hand, b.deck]);
});

test("雑談: mukai・ドバイにレアで来た本編の人物も、その人だけの雑談で話しかける（TFL70）", () => {
  for (const [venue, chapter, id] of [["mukai", 3, "ayatori"], ["mukai", 5, "yoru"], ["dubai", 4, "noor"], ["dubai", 4, "mashiro"], ["dubai", 4, "tsumugi"]]) {
    let s = createFloorNight({ venue, seed: 5, level: 2, chapter, visitor: id });
    assert.equal(s.visitor, id, `${venue}: ${id}`);
    s = until(s, (x) => x.tables.some((t) => t.guestId === "g3" && t.phase === "order"), 300);
    const table = s.tables.find((t) => t.guestId === "g3");
    s = act(s, { type: "order", tableId: table.id, mix: s.hand[0] });
    s = until(s, (x) => at(x, table.id).phase === "enjoy", 60);
    assert.ok(at(s, table.id).wants.some((w) => w.type === "chatty"), `${id}: 雑談の頼みがある`);
    s.upcoming = [];
    const own = FLOOR_VENUES[venue].visitorChats[id];
    const shown = chatRounds(s, own.length, table.id).shown;
    assert.deepEqual(shown.map((c) => c.said).sort(), own.map((c) => c.said).sort(), `${venue}: ${id} の雑談を出しきる`);
  }
});

test("追加ドリンクとおかわり: 居心地の良い客が自分から頼む（こちらからは誘わない）", () => {
  const happy = (seed) => {
    let s = serveFirst(createFloorNight({ seed, level: 1, night: "usual" }));
    for (let i = 0; i < 400 && ["enjoy", "order", "prep"].includes(at(s, 1).phase); i++) {
      if (at(s, 1).phase === "order") {
        // おかわりも、客の気分を聞いて並んだミックスから選ぶ（2026-11-25 オーナー指示）
        assert.ok(at(s, 1).refill && s.counts.extend === 1, "おかわりは注文として出る");
        assert.equal(at(s, 1).bill.top, 0, "トップ替えの料金は、選んで出した時に入る");
        s = act(s, { type: "order", tableId: 1, mix: s.hand[0] });
        assert.equal(at(s, 1).bill.top, PRICE.top);
        continue;
      }
      if (at(s, 1).phase === "enjoy") { at(s, 1).mood = 95; at(s, 1).call = null; at(s, 1).wants = []; }
      if (floorTap(s, 1) === "tend") s = act(s, { type: "tend", tableId: 1 });
      s = floorTick(s);
    }
    return s;
  };
  const runs = Array.from({ length: 24 }, (_, i) => happy(i + 1));
  const extended = runs.filter((s) => s.counts.extend >= 1);
  assert.ok(extended.length >= 3 && extended.length < runs.length, `おかわりは、たまに起きる（${extended.length}/24）`);
  const one = extended[0];
  assert.ok(one.results.concat(one.tables.map((t) => t.bill).filter(Boolean)).some((row) => row.top === PRICE.top), "おかわりは＋1,500円");
  assert.ok(runs.some((s) => s.counts.drink >= 1), "追加ドリンクが出る");
  // 不満の客は、どちらも頼まない
  let sad = serveFirst(createFloorNight({ seed: 3, level: 1, night: "usual" }));
  for (let i = 0; i < 400 && at(sad, 1).phase === "enjoy"; i++) { at(sad, 1).mood = 25; at(sad, 1).call = null; at(sad, 1).wants = []; at(sad, 1).coalAt = sad.t + 50; sad = floorTick(sad); }
  const row = sad.tables[0].bill;
  assert.deepEqual([row.top, row.drink], [0, PRICE.drink]);
});

test("おかわり: 客の気分を聞いて選ぶ。聞きそびれたら会計にする（怒って帰らない）", () => {
  // 居心地の良い客の滞在を終わらせ、おかわりが入るまで回す（おかわりが入る種を探す）
  let s = null;
  for (let seed = 1; seed <= 40 && !s; seed++) {
    let x = serveFirst(createFloorNight({ seed, level: 1, night: "usual" }));
    for (let i = 0; i < 400 && at(x, 1).phase === "enjoy"; i++) {
      at(x, 1).mood = 95; at(x, 1).call = null; at(x, 1).wants = []; at(x, 1).coalAt = x.t + 50;
      x = floorTick(x);
    }
    if (at(x, 1).phase === "order") s = x;
  }
  assert.ok(s, "おかわりの注文が入る種がある");
  const guest = s.guests[at(s, 1).guestId];
  assert.ok(at(s, 1).refill && guest.order.wish && at(s, 1).line.includes(guest.order.quote), "おかわりの一言に、吸いたい気分が入る");
  const before = { top: at(s, 1).bill.top };
  const missed = floorTick(s, 60);
  assert.equal(at(missed, 1).phase === "bill" || at(missed, 1).phase === "cool", true, "聞きそびれたおかわりは、会計に回る");
  assert.ok(!missed.results.some((r) => r.tableId === 1 && r.guestId === guest.id && r.left), "怒って帰りはしない");
  assert.equal(before.top, 0);
});

test("会計: ひと押しで受ける。ファンは満足の段で決まる。売上は明細と一致する", () => {
  let s = toBill(serveFirst(createFloorNight({ seed: 7, level: 0 })));
  const total = floorBill(s, 1).total;
  assert.equal(total, PRICE.charge + PRICE.shisha + PRICE.drink * at(s, 1).drinks + floorBill(s, 1).top);
  at(s, 1).mood = 70;
  const plain = act(s, { type: "bill", tableId: 1 });
  assert.equal(plain.results.at(-1).total, total);
  assert.equal(plain.fans - s.fans, 2, "満足の客は、ファン＋2");
  assert.equal(at(plain, 1).phase, "cool");
  at(s, 1).mood = 90;
  assert.equal(act(s, { type: "bill", tableId: 1 }).fans - s.fans, 3);
  at(s, 1).mood = 30;
  assert.equal(act(s, { type: "bill", tableId: 1 }).fans, s.fans);
  at(s, 1).mood = 70;
  assert.ok(at(floorTick(s, 40), 1).mood < 70, "会計を待たせると、満足が下がる");
  const done = floorResult(act(plain, { type: "finish" }));
  assert.equal(done.sales, done.groups.reduce((sum, g) => sum + g.total, 0));
  assert.equal(done.sales, done.items.charge + done.items.shisha + done.items.drink + done.items.top);
  assert.deepEqual(["cost", "service", "profit", "presets"].filter((key) => key in done), []);
  assert.equal(done.mixes[0].label, mixName(plain.results.find((row) => row.tableId === 1).mix), "好評だったミックスに残る");
});

test("フィーバー: 使った刻みだけ消費して切り上げられ、残りをもう一度使える", () => {
  let s = createFloorNight({ seed: 5, level: 2, night: "full" });
  for (let i = 0; i < 80; i++) {
    for (const table of s.tables) if (floorTap(s, table.id) === "order") s = act(s, { type: "order", tableId: table.id, mix: s.hand[0] });
    s = floorTick(s);
    if (s.tables.filter((x) => x.phase === "enjoy").length >= 5) break;
  }
  const testTables = s.tables.filter((x) => x.phase === "enjoy").sort((a, b) => b.stayEnd - a.stayEnd || a.id - b.id);
  assert.equal(testTables.length, 5);
  s.upcoming = [];
  for (const table of testTables) table.mood = 70;
  const called = testTables[0];
  called.call = { type: "thirsty", since: s.t - 4, until: s.t + 18, coal: false };
  const below = { ...s, fever: 99 };
  assert.equal(floorFeverReady(below), false);
  assert.equal(floorAct(below, { type: "fever" }), below);
  assert.equal(floorAct(s, { type: "feverStop" }), s);

  for (const fever of [100, 250, 300]) {
    const ready = { ...s, fever };
    assert.equal(floorFeverReady(ready), true);
    const on = act(ready, { type: "fever" });
    assert.equal(on.feverLeft, floorFeverLength);
    assert.deepEqual(on.log[0].tables, testTables.slice(0, 2).map((x) => x.id));
    assert.ok(on.tables.filter((x) => x.fever).every((x) => x.mood === 100));
    assert.equal(on.fever, fever, "発動の演出中には減らない");
    const untouched = act(on, { type: "feverStop" });
    assert.equal(untouched.fever, fever);
    assert.equal(untouched.fevers, 0);
    assert.equal(at(untouched, called.id).mood, 70, "刻みを使わず終了しても居心地は上がらない");
    assert.equal(floorWaitLeft(untouched, called.id), 18);
    const closed = act(on, { type: "finish" });
    assert.deepEqual([closed.fever, closed.fevers, closed.feverLeft], [fever, 0, 0]);
    assert.equal(closed.results.find((row) => row.tableId === called.id).mood, 70);

    const coal = floorCoalLeft(on, called.id);
    const mid = floorTick(on, 10);
    assert.equal(mid.fever, fever - 34);
    assert.equal(floorCoalLeft(mid, called.id), coal, "フィーバー中は炭が進まない");
    assert.equal(floorTap(mid, called.id), "info");
    assert.equal(floorWaitLeft(mid, called.id), null);
    assert.equal(floorAct(mid, { type: "fever" }), mid, "重ねては使えない");
    assert.equal(mid.log.filter((event) => event.type === "drink" && event.why === "fever" && event.tableId === called.id).length, 1);
    const stopped = act(mid, { type: "feverStop" });
    assert.equal(stopped.fever, fever - 34);
    assert.equal(stopped.feverLeft, 0);
    assert.equal(stopped.fevers, 1);
    assert.equal(at(stopped, called.id).mood, 70 + 10 / 3);
    assert.equal(floorWaitLeft(stopped, called.id), 18, "途中終了で保留中の頼みが戻る");
    assert.ok(stopped.log.some((e) => e.type === "feverEnd"));
    assert.equal(floorFeverReady(stopped), true, "残りが100未満でも途中まで使った分は再開できる");
    const again = act(stopped, { type: "fever" });
    assert.equal(again.feverLeft, floorFeverLength - 10);
    assert.ok(again.log[0].tables.every((id) => !at(mid, id).fever), "次はまだ対象になっていない卓を優先する");
    const againEnd = floorTick(again, floorFeverLength - 10);
    assert.deepEqual([againEnd.fever, againEnd.feverLeft, againEnd.feverResume, againEnd.fevers], [fever - 100, 0, 0, 2]);
    assert.equal(floorFeverReady(againEnd), fever >= 200);
    const end = floorTick(on, floorFeverLength);
    assert.equal(end.feverLeft, 0);
    assert.equal(end.fever, fever - 100);
    assert.equal(at(end, called.id).mood, 80);
    assert.equal(at(end, called.id).call, null);
    assert.ok(end.log.some((e) => e.type === "feverEnd"));
  }
  const twoTables = structuredClone({ ...s, fever: 300 });
  for (const { id } of testTables.slice(2)) at(twoTables, id).phase = "bill";
  const drinks = (state) => state.log.filter((event) => event.type === "drink" && event.why === "fever" && event.tableId === called.id).length;
  const first = floorTick(act(twoTables, { type: "fever" }), 3);
  assert.equal(drinks(first), 1);
  const restarted = act(act(first, { type: "feverStop" }), { type: "fever" });
  const stillWaiting = floorTick(restarted, 3);
  assert.equal(drinks(stillWaiting), 0, "再発動しても同じ卓の注文間隔は巻き戻らない");
  assert.equal(drinks(floorTick(stillWaiting, 7)), 1);
});

test("流れ: ◎を続けて出すほどフィーバーのゲージが早く溜まる。◎以外を出す・客が帰ると切れる", () => {
  // 流れが streak の時に、1卓へ合い方 want の一台を出して、提供された刻みの様子を見る
  const serveAt = (streak, want = "best") => {
    let x = createFloorNight({ seed: 11, level: 6, night: true });
    x = until(x, (y) => at(y, 1).phase === "order");
    const wish = wishOf(x, 1).wish, mix = Object.keys(MIXES).find((id) => mixRatings(id)[wish] === want);
    x = { ...x, hand: [mix, ...x.hand.filter((id) => id !== mix).slice(0, HAND_SIZE - 1)], streak, bestStreak: streak, fever: 0 };
    x = act(x, { type: "order", tableId: 1, mix });
    const made = until(x, (y) => y.log.some((e) => e.type === "serve" && e.tableId === 1));
    return { fever: made.fever, streak: made.streak, best: made.bestStreak, note: made.log.find((e) => e.type === "serve").streak };
  };
  // ◎が続くと流れが伸び、○や×を出すと切れる
  assert.deepEqual(serveAt(0), { fever: 14, streak: 1, best: 1, note: 1 });
  assert.deepEqual(serveAt(1), { fever: 17, streak: 2, best: 2, note: 2 });
  assert.deepEqual(serveAt(2, "good"), { fever: 7, streak: 0, best: 2, note: 0 });
  assert.deepEqual(serveAt(2, "none"), { fever: 0, streak: 0, best: 2, note: 0 });
  // ゲージの増え方: 1つ目＝14、2連続＝17、3連続＝20、4連続から＝23（そこで頭打ち）
  assert.deepEqual([0, 1, 2, 3, 6].map((streak) => serveAt(streak).fever), [14, 17, 20, 23, 23]);
  // 注文を聞かずに帰らせると、流れも切れる
  let gone = createFloorNight({ seed: 11, level: 6, night: true });
  gone = until({ ...until(gone, (x) => at(x, 1).phase === "order"), streak: 3, bestStreak: 3 }, (x) => x.counts.left >= 1);
  assert.deepEqual([gone.streak, gone.bestStreak], [0, 3]);
  assert.equal(floorResult(gone).streak, 3, "精算に、いちばん長かった流れが残る");
});

test("いまの調子: いま締めたらどの評価かを、見送った組と、一台が出ている卓の満足から出す", () => {
  let s = createFloorNight({ seed: 5, level: 1, night: true });
  assert.equal(floorOutlook(s), null, "まだ一台も出していない間は出さない");
  s = serveFirst(s);
  const mood = at(s, 1).mood;
  const first = floorOutlook(s);
  assert.deepEqual([first.score, first.rank, first.left], [Math.round(mood), RANKS.find((r) => Math.round(mood) >= r.min).id, 0]);
  // 一つ上の評価と、そこまでに足りない満足
  const low = floorOutlook({ ...s, tables: s.tables.map((t) => (t.id === 1 ? { ...t, mood: 60 } : t)) });
  assert.deepEqual([low.rank, low.stamp, low.next], ["B", "まずまず", { rank: "A", stamp: "上々", need: 14, blocked: false }]);
  const top = floorOutlook({ ...s, tables: s.tables.map((t) => (t.id === 1 ? { ...t, mood: 95 } : t)) });
  assert.deepEqual([top.rank, top.next], ["S", null]);
  // 誰かを帰らせた夜は、満足が足りていても大入りにならない（見通しにも出る）
  const gone = floorOutlook({ ...s, tables: s.tables.map((t) => (t.id === 1 ? { ...t, mood: 100 } : t)), results: [{ mood: 100 }, { mood: 100 }, { mood: 100 }, { mood: 100 }, { mood: 100 }, { mood: 100 }, { mood: 100 }, { mood: 0, left: true }] });
  assert.deepEqual([gone.score, gone.rank, gone.left, gone.next.blocked], [89, "A", 1, true]);
  // 締めの評価と同じ答えになる
  const done = playFloorBot({ seed: 9, level: 3, night: true }).state;
  assert.deepEqual([floorOutlook(done).rank, floorOutlook(done).score], [floorResult(done).rank, floorResult(done).score]);
});

test("レアな来店: 本編の人物は三組目として来て、その人の口調で話し、その人だけの注文をする（TFL65・66）。来なくても同じ一晩", () => {
  const base = createFloorNight({ seed: 5, level: 2 });
  assert.equal(base.visitor, null);
  const mobSays = new Set([...WISHES.flatMap((w) => w.say), ...Object.values(SERVE_LINES).flat(), ...SEND_LINES.extend, ...SEND_LINES.bye, SEND_LINES.byeLow, SEND_LINES.mad,
    ...CALL_MISS, ...Object.values(CALLS).flatMap((c) => c.lines.flatMap(({ said, good }) => [said, good]))]);
  const quotes = new Set();
  for (const who of Object.values(VISITORS)) {
    assert.ok(GUESTS[who.id] === undefined && who.chapters.length >= 1 && WISH_IDS.includes(who.order.wish) && WISH_IDS.includes(who.refill.wish), who.id);
    // 口調: 来店から帰るまで、モブの共通の言葉を使わない（台詞なので句点で終えない）
    const own = [who.order.quote, who.refill.quote, ...["best", "good", "off", "miss", "check", "skip", "bye", "byeLow", "mad"].map((k) => who.lines[k]),
      ...["thin", "harsh", "thirsty"].flatMap((k) => [who.lines.calls[k].said, who.lines.calls[k].good])];
    for (const line of own) {
      assert.ok(line && !line.endsWith("。") && !mobSays.has(line), `${who.id}: ${line}`);
      quotes.add(line);
    }
    assert.ok(!/大会|本番|優勝|予選/.test(own.join("")), `${who.id}: 大会の前後どちらでも通る言葉`);
    // 注文: 好きなフレーバーを名指しする（その章の店に、◎になる一台がある）
    for (const order of [who.order, who.refill]) {
      assert.ok(order.label && order.has.length >= 1 && order.has.every((id) => FLAVORS[id]), `${who.id}: ${order.label}`);
      for (const chapter of who.chapters) assert.ok(mixIdsFor(chapter).some((id) => rateMix(id, { ...order, pref: { label: order.label, has: order.has } }) === "best"), `${who.id} 第${chapter}章`);
    }
    const chapter = who.chapters[0];
    let s = createFloorNight({ seed: 5, level: 2, chapter, visitor: who.id });
    assert.equal(s.visitor, who.id);
    const guest = s.guests.g3;
    assert.deepEqual([guest.charId, guest.name, guest.party, guest.order.wish, guest.order.quote, guest.order.pref.label],
      [who.id, who.name, 1, who.order.wish, who.order.quote, who.order.label]);
    assert.deepEqual(Object.keys(s.guests), Object.keys(base.guests), "組数と来店の刻みは変わらない");
    assert.deepEqual(s.hand, createFloorNight({ seed: 5, level: 2, chapter }).hand, "ミックスの並びも変わらない");
    s = until(s, (x) => x.tables.some((t) => t.guestId === "g3"), 200);
    const table = s.tables.find((t) => t.guestId === "g3");
    // 名指しの注文: 好きなフレーバーの入った一台だけが◎。気分が同じでも、入っていなければ○
    const liked = mixIdsFor(chapter).find((id) => MIXES[id].flavors.some((f) => who.order.has.includes(f)));
    const sameMood = mixIdsFor(chapter).find((id) => MIXES[id].main === who.order.wish && !MIXES[id].flavors.some((f) => who.order.has.includes(f)));
    assert.deepEqual([rateMix(liked, guest.order), rateMix(sameMood, guest.order)], ["best", "good"]);
    assert.equal(rateMix(sameMood, { wish: who.order.wish }), "best", "モブの物差しなら◎の一台も、名指しの注文では○");
    // 並んでいなければ、山のいちばん上に取り置かれていて、シャッフル一回で並ぶ
    if (!floorHand(s, guest.order).some((m) => m.rating === "best")) {
      assert.ok(s.stock && rateMix(s.stock, guest.order) === "best" && s.deck[0] === s.stock);
      const shuffled = act(s, { type: "shuffle" });
      assert.ok(floorHand(shuffled, guest.order).some((m) => m.rating === "best") && shuffled.stock === null);
    }
    const again = act(s, { type: "shuffle" });
    assert.ok(floorHand(again, guest.order).some((m) => m.rating === "best"), "取り置き済みでも、すでに手札に出ていても、名指しに応えられる");
    s.hand[0] = liked;
    s = act(s, { type: "order", tableId: table.id, mix: liked });
    s = until(s, (x) => at(x, table.id).phase === "enjoy", 60);
    assert.equal(at(s, table.id).line, who.lines.best);
    // 炭が尽きても気遣いの頼みは出ない。自分から調整できる。その人だけの雑談で話しかけてきて（TFL70）、お水の頼みはその人の口調で出る。
    at(s, table.id).nextCall = s.t;
    at(s, table.id).coalAt = s.t;
    s = floorTick(s);
    assert.equal(at(s, table.id).call, null);
    assert.equal(floorTap(s, table.id), "tend");
    const waitCall = (x) => until(x, (y) => {
      assert.ok(!y.log.some((e) => e.type === "call" && e.tableId === table.id && e.coal), who.id);
      return !!at(y, table.id).call;
    }, 80);
    s = waitCall(s);
    assert.equal(at(s, table.id).call.type, "chatty", `${who.id}: 本編の人物も雑談で話しかける`);
    const ownChats = VISITOR_CHATS.tonari[who.id];
    const talked = ownChats.find((c) => c.said === floorCallLine(s, table.id).said);
    assert.ok(talked, `${who.id}: その人だけの雑談（${floorCallLine(s, table.id).said}）`);
    assert.equal(floorCallLine(s, table.id).sight, talked.sight);
    const chatted = act(s, { type: "care", tableId: table.id, verb: "chat" });
    assert.equal(at(chatted, table.id).line, talked.reply);
    assert.deepEqual(["said", "reply", "by"].map((k) => chatted.log.find((e) => e.type === "care")[k]), [talked.said, talked.reply, "hajime"], "画面に会話を渡す");
    s = chatted;
    at(s, table.id).nextCall = s.t;
    s = waitCall(s);
    const call = at(s, table.id).call.type;
    assert.equal(call, "thirsty");
    assert.equal(floorCallLine(s, table.id).said, who.lines.calls[call].said);
    const cared = act(s, { type: "care", tableId: table.id, verb: CALLS[call].verb });
    assert.equal(at(cared, table.id).line, who.lines.calls[call].good);
    const missed = act(s, { type: "care", tableId: table.id, verb: VERBS.find((v) => v.id !== CALLS[call].verb).id });
    assert.equal(at(missed, table.id).line, who.lines.miss);
    s = cared;
    at(s, table.id).stayEnd = s.t; at(s, table.id).extended = true; at(s, table.id).call = null; at(s, table.id).wants = [];
    s = until(s, (x) => at(x, table.id).phase === "bill", 10);
    assert.equal(at(s, table.id).line, who.lines.check);
    const paid = act(s, { type: "bill", tableId: table.id });
    assert.equal(paid.log.find((e) => e.type === "bill").line, who.lines.bye);
    assert.equal(paid.results.at(-1).charId, who.id);
  }
  assert.equal(quotes.size, Object.values(VISITORS).length * 17, "来店客の言葉は、互いにも重ならない");
  assert.equal(createFloorNight({ seed: 5, level: 2, visitor: "nobody" }).visitor, null);
});

test("盤のトップ替え強化は、くつろいだ客のおかわりが増える", () => {
  function count(floorTop) {
    const s = serveFirst(createFloorNight({ seed: 9, level: 1, floorPerks: { floorTop } }));
    Object.assign(at(s, 1), { mood: 100, stayEnd: s.t, call: null, wants: [] });
    let refills = 0;
    for (let rolls = 0; rolls < 256; rolls++) {
      if (at(floorTick({ ...s, rolls }), 1).refill) refills++;
    }
    return refills;
  }
  const base = count(0), trained = count(10);
  assert.ok(trained > base && trained < 256, `強化でおかわりの抽選に当たりやすくなる（${base} → ${trained}）`);
});

// ---- 店番のスキル（心得の盤 v16・SBD157）: 仕事が早い・売り上手・波に乗る・フロアを読む ----
test("盤の仕事が早い: シャッフルが2秒→1秒。入れ替えの間に出せないのは同じ", () => {
  let s = until(createFloorNight({ seed: 7, level: 1, floorPerks: { shuffleScale: 0.5 } }), (x) => at(x, 1).phase === "order");
  assert.equal(floorVenueShuffleTime(s), 2, "0.5秒刻みで1秒");
  const shuffled = act(s, { type: "shuffle" });
  assert.deepEqual(shuffled.log, [{ type: "shuffle", ticks: 2 }]);
  assert.equal(floorShuffleLeft(shuffled), 2);
  assert.equal(floorAct(shuffled, { type: "order", tableId: 1, mix: shuffled.hand[0] }), shuffled, "入れ替えの最中は出せない");
  assert.equal(floorShuffleLeft(floorTick(shuffled, 2)), 0, "1秒で並ぶ");
  // 灯していなければ2秒のまま。壊れた値は効かない（素の長さ）
  for (const shuffleScale of [undefined, 0, -1, 2, "x"]) assert.equal(floorVenueShuffleTime(createFloorNight({ seed: 7, floorPerks: { shuffleScale } })), floorShuffleTime);
  // 並びは同じ（速さだけが変わる）
  const plain = act(until(createFloorNight({ seed: 7, level: 1 }), (x) => at(x, 1).phase === "order"), { type: "shuffle" });
  assert.deepEqual(shuffled.hand, plain.hand);
});

test("盤の波に乗る: フィーバーが、くつろいでいる卓の3つまで広がる", () => {
  const open = (floorPerks) => {
    let s = createFloorNight({ seed: 5, level: 2, night: "full", floorPerks });
    for (let i = 0; i < 80; i++) {
      for (const table of s.tables) if (floorTap(s, table.id) === "order") s = act(s, { type: "order", tableId: table.id, mix: s.hand[0] });
      s = floorTick(s);
      if (s.tables.filter((x) => x.phase === "enjoy").length >= 5) break;
    }
    return act({ ...s, fever: 100 }, { type: "fever" });
  };
  const plain = open(null), wave = open({ feverTables: 1 });
  assert.equal(floorFeverTargets(plain), 2);
  assert.equal(floorFeverTargets(wave), 3);
  assert.equal(plain.tables.filter((x) => x.fever).length, 2);
  assert.equal(wave.tables.filter((x) => x.fever).length, 3);
  assert.deepEqual(wave.log[0].tables.slice(0, 2), plain.log[0].tables, "広がる順は同じ（足した1卓が後ろに付く）");
  assert.ok(wave.tables.filter((x) => x.fever).every((x) => x.mood === 100));
});

test("盤のフロアを読む: シャッフルが、注文を待つほかの卓の気分にも合う一台を引き寄せる", () => {
  const trials = 200;
  // 3卓が別々の気分で注文を待つ。2卓を選んでシャッフルし、1卓・3卓にも◎が並ぶかを数える
  function served(floorPerks) {
    let all = 0, others = 0, chosen = 0;
    for (let seed = 1; seed <= trials; seed++) {
      let s = floorTick(createFloorNight({ seed, level: 5, night: "full", floorPerks }), 8);
      if (at(s, 3).phase !== "order") s = until(s, (x) => at(x, 3).phase === "order");
      const [o1, o2, o3] = [1, 2, 3].map((id) => wishOf(s, id));
      Object.assign(o1, { wish: "sweet" }); Object.assign(o2, { wish: "deep" }); Object.assign(o3, { wish: "fresh" });
      for (const o of [o1, o2, o3]) delete o.pref;
      s = act(s, { type: "shuffle", tableId: 2 });
      const hit = (o) => floorHand(s, o).some((m) => m.rating === "best");
      if (hit(o2)) chosen++;
      if (hit(o1) && hit(o3)) others++;
      if (hit(o1) && hit(o2) && hit(o3)) all++;
    }
    return { all, others, chosen };
  }
  const plain = served(null), read = served({ floorRead: true });
  assert.ok(read.others > plain.others + trials * 0.25, `ほかの卓にも◎が並ぶ（${plain.others} → ${read.others}）`);
  assert.ok(read.all > trials * 0.5, `3卓とも◎が並ぶことが多い（${read.all}/${trials}）`);
  assert.ok(Math.abs(read.chosen - plain.chosen) <= trials * 0.1, `選んだ卓の当たりやすさはほぼ同じ（${plain.chosen} → ${read.chosen}）`);
  // 盤の注文の読み（floorMatch）も、ほかの卓の抽選に効く
  const both = served({ floorRead: true, floorMatch: 20 });
  assert.ok(both.all > read.all, `注文の読みを重ねると、さらに揃う（${read.all} → ${both.all}）`);
  // 灯していなければ、乱数の進み方も今までと同じ（同じ並び）
  const night = () => act(floorTick(createFloorNight({ seed: 3, level: 5, night: "full" }), 8), { type: "shuffle", tableId: 2 });
  assert.deepEqual(night().hand, act(floorTick(createFloorNight({ seed: 3, level: 5, night: "full", floorPerks: { floorRead: false } }), 8), { type: "shuffle", tableId: 2 }).hand);
});

test("盤の売り上手: 歩合が売上の10%→13%。精算の支給額と上乗せの記録が一致する", () => {
  const night = createFloorNight({ chapter: 2, floorPerks: { commission: 3 } });
  night.sales = 12349;
  const result = floorResult(night, 500);
  assert.equal(result.commissionBonus, 3);
  assert.deepEqual(result.pay, { base: 10000, commission: 1605, allowances: 500, total: 12105 }, "12,349円の13%＝1,605.37（円未満は切り捨て）");
  const plain = createFloorNight({ chapter: 2 });
  plain.sales = 12349;
  assert.equal(floorResult(plain).commissionBonus, 0);
  assert.equal(floorResult(plain).pay.commission, 1234);
});

test("レアな来店のおかわり: その人のおかわりの注文（名指し）をする。待たせても、その人の言葉で帰る", () => {
  for (const who of Object.values(VISITORS)) {
    const chapter = who.chapters[0];
    let s = createFloorNight({ seed: 5, level: 2, chapter, visitor: who.id });
    s = until(s, (x) => x.tables.some((t) => t.guestId === "g3"), 200);
    const id = s.tables.find((t) => t.guestId === "g3").id;
    const liked = mixIdsFor(chapter).find((m) => MIXES[m].flavors.some((f) => who.order.has.includes(f)));
    s.hand[0] = liked;
    s = act(s, { type: "order", tableId: id, mix: liked });
    s = until(s, (x) => at(x, id).phase === "enjoy", 60);
    // 大満足で滞在が終わる時に、おかわりを言い出させる（抽選を通る種まで回す）
    let refill = null;
    for (let tries = 0; tries < 60 && !refill; tries++) {
      const x = structuredClone(s);
      Object.assign(at(x, id), { mood: 100, stayEnd: x.t, call: null, wants: [] });
      x.rolls = tries;
      const next = floorTick(x);
      if (at(next, id).refill) refill = next;
    }
    assert.ok(refill, `${who.id}: おかわりを言い出す`);
    const guest = refill.guests.g3;
    assert.deepEqual([guest.order.quote, guest.order.pref.label, at(refill, id).line], [who.refill.quote, who.refill.label, who.refill.quote]);
    const late = until(refill, (x) => at(x, id).phase === "bill", 40);
    assert.equal(at(late, id).line, who.lines.skip, "聞きそびれたら、その人の言葉で会計に回る");
  }
  // 注文を待たせて帰る時も、その人の言葉（怒鳴らない）
  for (const who of Object.values(VISITORS)) {
    const chapter = who.chapters[0];
    let s = createFloorNight({ seed: 5, level: 2, chapter, visitor: who.id });
    s = until(s, (x) => x.log.some((e) => e.type === "left" && e.guestId === "g3") || x.done, 400);
    if (s.done) continue;
    assert.equal(s.log.find((e) => e.type === "left" && e.guestId === "g3").line, who.lines.mad);
  }
});

test("昼から夜まで通しの店番（TFL62）: 営業の半ばで日が暮れ、そこから来る客は夜の呼び名", () => {
  const day = createFloorNight({ seed: 3, level: 2, daytime: true, night: "friday" });
  const span = createFloorNight({ seed: 3, level: 2, daytime: true, night: "friday", dusk: true });
  assert.equal(day.dusk, null);
  assert.equal(span.dusk, Math.round(span.length / 2));
  assert.deepEqual(Object.keys(span.guests), Object.keys(day.guests), "客の並びと注文は同じ");
  for (const [id, g] of Object.entries(span.guests)) {
    const kind = GUESTS[g.kind];
    const name = Array.isArray(kind.name) ? kind.name[g.arrive >= span.dusk ? 1 : 0] : kind.name;
    assert.equal(g.name, name, id);
    assert.deepEqual(g.order, day.guests[id].order);
  }
  assert.ok(Object.values(span.guests).some((g) => g.arrive >= span.dusk && g.name !== day.guests[g.id].name), "夜の客の呼び名が変わる");
  assert.equal(floorDusk(span), false);
  assert.equal(floorDusk(floorTick(span, span.dusk)), true);
  assert.equal(floorDusk(floorTick(day, 300)), false, "昼だけの営業は暮れない");
  assert.equal(createFloorNight({ seed: 3, level: 1, daytime: false, dusk: true }).dusk, null, "夜の営業には効かない");
});

test("チュートリアル（TFL64）: 客と並びが決まっていて、待たせても帰らず、段取りでだけ頼み・調整・会計が起きる", () => {
  let s = createFloorTutorial();
  assert.equal(s.tutorial, true);
  assert.deepEqual(Object.keys(s.guests), ["g1", "g2"]);
  assert.deepEqual([s.guests.g1.order.wish, s.guests.g2.order.wish], ["fruit", "deep"]);
  assert.equal(s.guests.g1.trait, "beginner", "一人目は初めての客（むせて、吸い方を案内する）");
  s = until(s, (x) => at(x, 1).phase === "order", 10);
  // 1卓: ◎が一つ（○も一つ）並ぶ
  const first = floorHand(s, wishOf(s, 1));
  assert.deepEqual([first.filter((m) => m.rating === "best").length, first.filter((m) => m.rating === "good").length], [1, 1]);
  const waited = floorTick(s, 400);
  assert.equal(at(waited, 1).phase, "order", "待たせても帰らない");
  assert.equal(floorWaitLeft(waited, 1), floorWaitLeft(s, 1), "待ち時間も減らない");
  s = act(s, { type: "order", tableId: 1, mix: first.find((m) => m.rating === "best").id });
  s = until(s, (x) => at(x, 1).phase === "enjoy" && at(x, 2).phase === "order", 40);
  // 2卓: 合う一台が無い。シャッフルすると、◎と○が並ぶ
  assert.ok(floorHand(s, wishOf(s, 2)).every((m) => m.rating === "none"));
  s = act(s, { type: "shuffle" });
  s = until(s, (x) => floorShuffleLeft(x) === 0, 10);
  const second = floorHand(s, wishOf(s, 2));
  assert.deepEqual([second.filter((m) => m.rating === "best").length, second.filter((m) => m.rating === "good").length], [1, 1]);
  s = act(s, { type: "order", tableId: 2, mix: second.find((m) => m.rating === "best").id });
  s = until(s, (x) => at(x, 2).phase === "enjoy", 40);
  // 放っておいても、頼み・調整・会計は勝手に起きない
  const calm = floorTick(s, 400);
  assert.ok([1, 2].every((id) => !at(calm, id).call && at(calm, id).phase === "enjoy" && !floorTendDue(calm, id)) && !calm.done);
  s = floorTutorialCue(s, "cough", 1);
  assert.equal(floorTap(s, 1), "care");
  s = act(s, { type: "care", tableId: 1, verb: "teach" });
  s = floorTutorialCue(s, "coal", 2);
  assert.equal(floorTap(s, 2), "tend");
  s = act(s, { type: "tend", tableId: 2 });
  s = floorTutorialCue(s, "bill", 1);
  assert.equal(floorTap(s, 1), "bill");
  s = act(s, { type: "bill", tableId: 1 });
  s = floorTutorialCue(s, "fever");
  assert.equal(floorFeverReady(s), true);
  s = act(s, { type: "fever" });
  assert.ok(s.feverLeft > 0 && !s.done);
  assert.equal(floorTutorialCue(createFloorNight({ seed: 1 }), "fever").fever, 0, "本番の営業には効かない");
  for (const id of ["hello", "arrive", "wish", "open", "pick", "prep", "shuffle", "shuffling", "quick", "prep2", "care", "careAnswer", "tend", "bill", "fever", "done", "nudge"]) {
    assert.ok(TUTORIAL[id] && !TUTORIAL[id].endsWith("。"), id);
  }
});

test("締め: 全組を送り出すか時間で終わる。早じまいもできる。評価は満足の平均", () => {
  let s = createFloorNight({ seed: 9, level: 0 });
  s = until(s, (x) => x.done, 700);
  assert.ok(["time", "clear"].includes(s.closing));
  const idle = floorResult(s);
  assert.ok(idle.left >= 1 && idle.rank !== "S", "放っておいた夜は、大入りにならない");
  assert.equal(idle.came, idle.groups.length);
  const early = floorResult(act(serveFirst(createFloorNight({ seed: 9, level: 0 })), { type: "finish" }));
  assert.equal(early.closing, "early");
  assert.equal(early.served, 1);
  assert.equal(early.sales, 3300);
  assert.deepEqual(early.pay, { base: 8000, commission: 330, allowances: 0, total: 8330 });
  const empty = floorResult(act(createFloorNight({ chapter: 2 }), { type: "finish" }), 5000);
  assert.equal(empty.sales, 0);
  assert.deepEqual(empty.pay, { base: 10000, commission: 0, allowances: 5000, total: 15000 });
  assert.equal(floorAct(s, { type: "finish" }), s, "終わった営業は進めない");
});

test("報酬は章ごとの基本給と売上の1割。円未満は切り捨て、評価は歩合に影響しない", () => {
  for (const [i, base] of [8000, 10000, 12000, 14000, 16000].entries()) {
    const night = createFloorNight({ chapter: i + 1 });
    night.sales = 12349;
    const low = floorResult(night);
    const high = floorResult({ ...night, results: [{ mood: 100 }] });
    assert.deepEqual([low.rank, high.rank], ["C", "S"]);
    assert.deepEqual(low.pay, { base, commission: 1234, allowances: 0, total: base + 1234 });
    assert.deepEqual(high.pay, low.pay);
  }
});

test("通し: 気分に合う一台を選んで調整に回れば大入り。合わせない・放っておく夜は評価が低い", () => {
  for (const [night, level] of [["first", 0], ["usual", 1], ["friday", 2], ["rain", 2], ["newcomers", 3], ["full", 5]]) {
    const quick = playFloorBot({ seed: 11, level, night, pace: 2 }).result;
    assert.equal(quick.rank, "S", `${night}: 合う一台を選んで、手際よく回せば大入り（${quick.score}）`);
    assert.equal(quick.left, 0);
    assert.equal(quick.sales, quick.groups.reduce((sum, g) => sum + g.total, 0));
    assert.equal(quick.pay.total, 8000 + quick.sales / 10);
    assert.ok(quick.fans > 0 && quick.counts.tend >= 1);
    assert.ok(quick.mixes.length >= 1 && quick.mixes[0].avg >= quick.mixes.at(-1).avg);
    const blind = playFloorBot({ seed: 11, level, night, pace: 3, pick: "first" }).result;
    assert.ok(blind.score < quick.score, `${night}: 気分を見ずに出すと下がる（${blind.score}）`);
    const lazy = playFloorBot({ seed: 11, level, night, pace: 2, tend: false }).result;
    assert.ok(lazy.score < quick.score && lazy.counts.tendLate >= 1, `${night}: 調整に行かないと下がる（${lazy.score}）`);
    const idle = playFloorBot({ seed: 11, level, night, pace: 16, pick: "first" }).result;
    assert.ok(["B", "C"].includes(idle.rank), `${night}: ほぼ放置（${idle.rank}）`);
    assert.ok(idle.pay.commission < quick.pay.commission, `${night}: 売上を伸ばすと歩合が上がる`);
  }
  assert.equal(floorBotAction(createFloorNight({ seed: 1 }), {}), null, "開店直後は、することが無い");
});
