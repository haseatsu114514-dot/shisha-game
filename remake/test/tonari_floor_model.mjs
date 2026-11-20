// tonari フロア営業のルールの検査（ワンオペ・ミックスを一覧から選ぶ形）。
// 実行: node --test remake/test/tonari_floor_model.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorResult, floorHint, floorBill, floorMaking, floorHand, floorShuffleLeft, floorShuffleTime, floorPlan,
  floorWaitLeft, floorStayLeft, floorCoalLeft, floorTendDue, floorFeverLevel, floorFace, floorStage, floorTimeLeft, floorClock,
  mixName, mixNameParts, mixRatings, evaluateMix, pickNight, floorOrderWait, floorFeverLength, floorSlots, FLOOR_TABLE_COUNT,
} from "../js/daily/tonari-floor-model.js";
import {
  PRICE, FLAVORS, MIXES, WISHES, WISH_IDS, HAND_SIZE, GUESTS, VISITORS, CALLS, VERBS, NIGHTS, RANKS, MOODS, SERVE_LINES, SEND_LINES, mixIdsFor, mixChapter,
} from "../js/daily/tonari-floor-data.js";
import { playFloorBot, bestMix, floorBotAction } from "./tonari_floor_bot.mjs";

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
  assert.deepEqual(WISHES.map((w) => w.label), ["フルーティ", "スイート", "リフレッシュ", "リラックス"]);
  // 材料は、本編のフレーバー（data/flavors.json）から選ぶ。大会で使えない物・非売品は使わない。属性は本編の系統から、章は本編の解禁から決まる
  const game = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors.map((f) => [f.id, f]));
  const wishOfCategory = { fruit: "fruit", sweet: "sweet", cooling: "fresh", spice: "deep", floral: "deep" };
  for (const f of Object.values(FLAVORS)) {
    const source = game[f.id];
    assert.ok(source, `${f.id}: 本編にあるフレーバー`);
    assert.ok(source.competition_legal !== false && source.serve_legal !== false && !source.not_for_sale, `${f.id}: 大会で使える`);
    assert.equal(f.family, wishOfCategory[source.category], `${f.id}: 属性は本編の系統（${source.category}）から`);
    assert.equal(f.chapter, source.chapter_min ?? 1, `${f.id}: 出回る章は本編と同じ`);
    assert.ok(source.name.endsWith(f.label) || f.label.length <= 5, `${f.id}: 呼び名は短い`);
    assert.ok(f.also.every((wish) => WISH_IDS.includes(wish) && wish !== f.family));
  }
  assert.ok(Object.keys(MIXES).length >= 70, "ミックスは、一覧に並びきらない数がある");
  assert.ok(mixIdsFor(1).length >= 60 && mixIdsFor(2).length > mixIdsFor(1).length, "章が進むと、出せるミックスが増える");
  assert.ok(mixIdsFor(1).every((id) => mixChapter(id) === 1) && mixIdsFor(0).length === mixIdsFor(1).length);
  const names = new Set();
  for (const [id, mix] of Object.entries(MIXES)) {
    assert.ok(mix.flavors.length >= 1 && mix.flavors.length <= 3 && mix.flavors.every((f) => FLAVORS[f]), id);
    const name = mixName(id);
    assert.ok(name.length >= 2 && name.length <= 10, `名前は札に収まる長さ: ${name}`);
    assert.ok(mixNameParts(id).every((part) => part.length <= 5) && mixNameParts(id).join("") === name && !name.includes("｜"), `狭い札では、5字までの切れ目で折れる: ${name}`);
    assert.ok(!names.has(name), `同じ名前が二つ無い: ${name}`);
    names.add(name);
    // 属性は、メイン一つと、あればサブ一つ。メインは材料の属性（family）から、サブは材料の family か also から選ぶ
    const has = (wish) => mix.flavors.some((f) => FLAVORS[f].family === wish || FLAVORS[f].also.includes(wish));
    assert.ok(WISH_IDS.includes(mix.main) && mix.flavors.some((f) => FLAVORS[f].family === mix.main), `${name}: メインの属性が材料の系統にある`);
    assert.ok(mix.sub === null || (WISH_IDS.includes(mix.sub) && mix.sub !== mix.main && has(mix.sub)), `${name}: サブの属性が材料にある`);
    if (/ミント$/.test(name)) assert.equal(mix.main, "fresh", `${name}: 「〜ミント」はリフレッシュがメイン`);
  }
  for (const chapter of [1, 2]) for (const wish of WISH_IDS) {
    const main = mixIdsFor(chapter).filter((id) => MIXES[id].main === wish).length;
    assert.ok(main >= 16 && main <= 22, `第${chapter}章・${wish}: メインのミックスが偏らない（${main}）`);
  }
  for (const f of Object.values(FLAVORS)) assert.equal("cost" in f, false, "原価は扱わない");
  assert.deepEqual(Object.keys(CALLS), ["thin", "harsh", "thirsty", "cough", "chatty"], "炭の調整は、頼みではなく自分から行く");
  for (const call of Object.values(CALLS)) assert.ok(VERBS.some((v) => v.id === call.verb) && call.said && call.sight && call.good);
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
  assert.deepEqual(mixRatings("lemonmint"), { fruit: "good", sweet: "none", fresh: "best", deep: "none" });
  assert.deepEqual(mixRatings("apple"), { fruit: "good", sweet: "none", fresh: "none", deep: "best" }, "ダブルアップルは、本編の系統（スパイス）に合わせてリラックスがメイン");
  assert.deepEqual(mixRatings("caramelmilk"), { fruit: "none", sweet: "best", fresh: "none", deep: "none" });
  assert.deepEqual(mixRatings("milktea"), { fruit: "none", sweet: "good", fresh: "none", deep: "best" });
  for (const id of Object.keys(MIXES)) {
    const marks = Object.values(mixRatings(id));
    assert.deepEqual([marks.filter((r) => r === "best").length, marks.filter((r) => r === "good").length], [1, MIXES[id].sub ? 1 : 0], id);
  }
  assert.equal(mixRatings("nothing"), null);
  assert.equal(mixName("lemonmint"), "レモンミント");
  assert.equal(mixName("chocomint"), "チョコミント");
  assert.deepEqual(mixNameParts("chocomint"), ["チョコ", "ミント"]);
  assert.deepEqual(mixNameParts("lemonmint"), ["レモン", "ミント"]);
  const order = { wish: "fresh" };
  const best = evaluateMix("lemonmint", order), good = evaluateMix("watermelonkiwi", order), none = evaluateMix("caramelmilk", order);
  assert.deepEqual([best.rating, good.rating, none.rating], ["best", "good", "none"]);
  assert.deepEqual([best.grade, good.grade, none.grade], ["best", "good", "off"]);
  assert.ok(best.mood >= 85 && good.mood >= 65 && good.mood < 85 && none.mood < 40);
  // こだわりの客は、ぴったりでないと少し辛い（ぴったりなら同じ）
  assert.equal(evaluateMix("lemonmint", order, "keen").mood, best.mood);
  assert.ok(evaluateMix("watermelonkiwi", order, "keen").mood < good.mood);
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

test("注文: 並んでいるミックスから選ぶ。出すと次の一つが入る。仕込みは同時に2台まで", () => {
  let s = createFloorNight({ seed: 7, level: 1 });
  assert.equal(s.hand.length, HAND_SIZE);
  assert.equal(new Set([...s.hand, ...s.deck]).size, mixIdsFor(1).length, "その章で出せるミックスが、山に入る");
  assert.equal(new Set([...createFloorNight({ seed: 7, level: 1, chapter: 2 }).hand, ...createFloorNight({ seed: 7, level: 1, chapter: 2 }).deck]).size, mixIdsFor(2).length);
  s = until(s, (x) => at(x, 1).phase === "order");
  const hand = floorHand(s, wishOf(s, 1).wish);
  assert.deepEqual(hand.map((h) => h.id), s.hand);
  assert.ok(hand.every((h) => h.name === mixName(h.id) && h.rating === h.ratings[wishOf(s, 1).wish]));
  assert.ok(hand.every((h) => h.main === MIXES[h.id].main && h.sub === MIXES[h.id].sub), "並んでいる札に、メインとサブの属性が付く");
  const outside = s.deck[3];
  assert.equal(floorAct(s, { type: "order", tableId: 1, mix: outside }), s, "並んでいないミックスは出せない");
  const pick = hand[1].id, next = s.deck[0];
  const ordered = act(s, { type: "order", tableId: 1, mix: pick });
  assert.equal(at(ordered, 1).phase, "prep");
  assert.equal(at(ordered, 1).mix, pick);
  assert.equal(ordered.hand[1], next, "出した所に、次の一つが入る");
  assert.ok(!ordered.hand.includes(pick));
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
  long = act(long, { type: "order", tableId: 1, mix: long.hand[0] });
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
  // 入れ替えには約4秒かかる。その間は、ミックスを出せず、シャッフルも重ねられない（客は待っている）
  assert.equal(floorShuffleLeft(shuffled), floorShuffleTime);
  assert.equal(floorShuffleTime, 8);
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

test("シャッフルしすぎると損をする: ◎が出るまで回し続けると、満席の日は客を待たせて帰られる", () => {
  const total = (pick) => Array.from({ length: 16 }, (_, i) => playFloorBot({ seed: i + 1, level: 5, night: "full", pace: 6, pick }).result)
    .reduce((sum, r) => ({ left: sum.left + r.left, score: sum.score + r.score, shuffles: sum.shuffles + r.shuffles }), { left: 0, score: 0, shuffles: 0 });
  const careful = total("best"), greedy = total("greedy");
  assert.ok(greedy.shuffles > careful.shuffles * 3, `欲張ると、何倍も回す（${careful.shuffles} → ${greedy.shuffles}）`);
  assert.ok(greedy.left >= careful.left + 10, `待たせて帰られる組が増える（${careful.left} → ${greedy.left}）`);
  assert.ok(greedy.score < careful.score - 80, `満足の平均も下がる（${careful.score} → ${greedy.score}）`);
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
  assert.equal(at(good, 1).line, CALLS.cough.good);
  const miss = act(s, { type: "care", tableId: 1, verb: "water" });
  assert.ok(at(miss, 1).mood < mood - 7 && miss.counts.careMiss === 1 && !miss.log[0].ok);
  const late = until(s, (x) => !at(x, 1).call, 40);
  assert.ok(at(late, 1).mood < mood - 9 && late.counts.late === 1);
  assert.equal(floorAct(good, { type: "care", tableId: 1, verb: "teach" }), good, "頼まれていない卓には応えられない");
});

test("追加ドリンクとおかわり: 居心地の良い客が自分から頼む（こちらからは誘わない）", () => {
  const happy = (seed) => {
    let s = serveFirst(createFloorNight({ seed, level: 1, night: "usual" }));
    for (let i = 0; i < 400 && at(s, 1).phase === "enjoy"; i++) {
      at(s, 1).mood = 95; at(s, 1).call = null; at(s, 1).wants = [];
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

test("フィーバー: 3段。段ごとに対象の卓が増え、その間は満足が最高で、炭も進まない", () => {
  let s = createFloorNight({ seed: 5, level: 2, night: "full" });
  for (let i = 0; i < 80; i++) {
    for (const table of s.tables) if (floorTap(s, table.id) === "order") s = act(s, { type: "order", tableId: table.id, mix: s.hand[0] });
    s = floorTick(s);
    if (s.tables.filter((x) => x.phase === "enjoy").length >= 5) break;
  }
  assert.ok(s.tables.filter((x) => x.phase === "enjoy").length >= 4);
  assert.equal(floorAct({ ...s, fever: 99 }, { type: "fever" }).fevers, 0);
  for (const [fever, level, tables] of [[100, 1, 2], [250, 2, 4], [300, 3, 5]]) {
    const ready = { ...s, fever };
    assert.equal(floorFeverLevel(ready), level);
    const on = act(ready, { type: "fever" });
    assert.equal(on.feverLevel, level);
    assert.equal(on.tables.filter((x) => x.fever).length, Math.min(tables, s.tables.filter((x) => x.phase === "enjoy").length));
    assert.ok(on.tables.filter((x) => x.fever).every((x) => x.mood === 100 && !x.call));
    assert.equal(on.fever, fever - level * 100);
    const target = on.tables.find((x) => x.fever);
    const coal = floorCoalLeft(on, target.id);
    const mid = floorTick(on, 10);
    assert.equal(floorCoalLeft(mid, target.id), coal, "フィーバー中は炭が進まない");
    assert.notEqual(floorTap(mid, target.id), "tend");
    assert.equal(floorAct(mid, { type: "fever" }), mid, "重ねては使えない");
    const end = floorTick(on, floorFeverLength);
    assert.equal(end.feverLeft, 0);
    assert.ok(end.log.some((e) => e.type === "feverEnd") || end.done);
  }
});

test("レアな来店: 本編の人物は三組目として来て、その人の気分と言葉で返す。来なくても同じ一晩", () => {
  const base = createFloorNight({ seed: 5, level: 2 });
  assert.equal(base.visitor, null);
  for (const who of Object.values(VISITORS)) {
    assert.ok(GUESTS[who.id] === undefined && who.chapters.length >= 1 && WISH_IDS.includes(who.wish), who.id);
    for (const key of ["best", "good", "off", "bye"]) assert.ok(who.lines[key] && !who.lines[key].endsWith("。"), `${who.id}.${key}`);
    assert.ok(!/大会|本番|優勝|予選/.test([who.quote, ...Object.values(who.lines)].join("")), `${who.id}: 大会の前後どちらでも通る言葉`);
    let s = createFloorNight({ seed: 5, level: 2, visitor: who.id });
    assert.equal(s.visitor, who.id);
    const guest = s.guests.g3;
    assert.deepEqual([guest.charId, guest.name, guest.party, guest.order.wish, guest.order.quote], [who.id, who.name, 1, who.wish, who.quote]);
    assert.deepEqual(Object.keys(s.guests), Object.keys(base.guests), "組数と来店の刻みは変わらない");
    assert.deepEqual(s.hand, base.hand, "ミックスの並びも変わらない");
    s = until(s, (x) => x.tables.some((t) => t.guestId === "g3"), 200);
    const table = s.tables.find((t) => t.guestId === "g3");
    const best = Object.keys(MIXES).find((id) => mixRatings(id)[who.wish] === "best");
    s.hand[0] = best;
    s = act(s, { type: "order", tableId: table.id, mix: best });
    s = until(s, (x) => at(x, table.id).phase === "enjoy", 60);
    assert.equal(at(s, table.id).line, who.lines.best);
    at(s, table.id).stayEnd = s.t; at(s, table.id).extended = true; at(s, table.id).call = null; at(s, table.id).wants = [];
    s = until(s, (x) => at(x, table.id).phase === "bill", 10);
    const paid = act(s, { type: "bill", tableId: table.id });
    assert.equal(paid.log.find((e) => e.type === "bill").line, who.lines.bye);
    assert.equal(paid.results.at(-1).charId, who.id);
  }
  assert.equal(createFloorNight({ seed: 5, level: 2, visitor: "nobody" }).visitor, null);
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
  assert.equal(floorAct(s, { type: "finish" }), s, "終わった営業は進めない");
});

test("通し: 気分に合う一台を選んで調整に回れば大入り。合わせない・放っておく夜は評価が低い", () => {
  for (const [night, level] of [["first", 0], ["usual", 1], ["friday", 2], ["rain", 2], ["newcomers", 3], ["full", 5]]) {
    const quick = playFloorBot({ seed: 11, level, night, pace: 2 }).result;
    assert.equal(quick.rank, "S", `${night}: 合う一台を選んで、手際よく回せば大入り（${quick.score}）`);
    assert.equal(quick.left, 0);
    assert.equal(quick.sales, quick.groups.reduce((sum, g) => sum + g.total, 0));
    assert.ok(quick.fans > 0 && quick.counts.tend >= 1);
    assert.ok(quick.mixes.length >= 1 && quick.mixes[0].avg >= quick.mixes.at(-1).avg);
    const blind = playFloorBot({ seed: 11, level, night, pace: 3, pick: "first" }).result;
    assert.ok(blind.score < quick.score, `${night}: 気分を見ずに出すと下がる（${blind.score}）`);
    const lazy = playFloorBot({ seed: 11, level, night, pace: 2, tend: false }).result;
    assert.ok(lazy.score < quick.score && lazy.counts.tendLate >= 1, `${night}: 調整に行かないと下がる（${lazy.score}）`);
    const idle = playFloorBot({ seed: 11, level, night, pace: 16, pick: "first" }).result;
    assert.ok(["B", "C"].includes(idle.rank), `${night}: ほぼ放置（${idle.rank}）`);
  }
  assert.equal(floorBotAction(createFloorNight({ seed: 1 }), {}), null, "開店直後は、することが無い");
});
