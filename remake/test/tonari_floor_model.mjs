// tonari フロア営業のルール（js/daily/tonari-floor-model.js）。
// 同じ種なら同じ一晩・操作は刻みを使わない・配合の合否・合図・会計の声かけ（延長）・ボーナスタイム・評価の境界を確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFloorNight, floorTick, floorAct, floorTap, floorResult, floorAdvice, floorUrgency, pickNight,
  floorSendOff, floorBill, floorFace, floorAirFull, floorBonusTimeLength, FLOOR_TABLE_COUNT } from "../js/daily/tonari-floor-model.js";
import { MIXES, WISHES, GUESTS, CALLS, NIGHTS, FAMILIES, PRICE, RANKS, VERBS, SENDS, SEND_LINES } from "../js/daily/tonari-floor-data.js";
import { playFloorBot } from "./tonari_floor_bot.mjs";

const at = (s, id) => s.tables[id - 1];
const act = (s, action) => {
  const next = floorAct(s, action);
  assert.notEqual(next, s, `t${s.t} ${JSON.stringify(action)} は受け付けられるはず`);
  return next;
};
const until = (s, done, limit = 400) => {
  for (let i = 0; i < limit && !done(s) && !s.done; i++) s = floorTick(s);
  assert.ok(done(s), `t${s.t} まで待っても条件を満たさない`);
  return s;
};
const near = (guest) => guest.options.find((id) => id !== guest.best && MIXES[id].family === MIXES[guest.best].family);
const off = (guest) => guest.options.find((id) => MIXES[id].family !== MIXES[guest.best].family);
/** その卓が会計を頼むまで進める（合図には正しく応え、仕上がった一台は運ぶ）。 */
function toBill(s, tableId = 1) {
  for (let i = 0; i < 600 && floorTap(s, tableId) !== "bill"; i++) {
    const tap = floorTap(s, tableId);
    if (tap === "care") s = act(s, { type: "care", tableId, verb: CALLS[at(s, tableId).call.type].verb });
    else if (tap === "serve") s = act(s, { type: "serve", tableId });
    else s = floorTick(s);
  }
  assert.equal(floorTap(s, tableId), "bill");
  return s;
}
/** 1卓へ案内し、選んだ配合を提供するところまで。 */
function serveFirst(s, pick = (guest) => guest.best, tableId = 1) {
  s = until(s, (x) => x.queue.length > 0);
  s = act(s, { type: "seat", tableId });
  const guest = s.guests[at(s, tableId).guestId];
  s = act(s, { type: "order", tableId, mixId: pick(guest) });
  s = until(s, (x) => at(x, tableId).delivery?.ready);
  return act(s, { type: "serve", tableId });
}

test("台本: 客の言葉・配合・合図・夜の種類がそろっている", () => {
  for (const w of WISHES) {
    assert.ok(MIXES[w.best] && MIXES[w.off], w.quote);
    assert.notEqual(MIXES[w.best].family, MIXES[w.off].family, `外れは別の注文から: ${w.quote}`);
    assert.ok(!w.quote.endsWith("。"), `客の台詞は句点で終えない: ${w.quote}`);
  }
  for (const families of Object.values(FAMILIES)) for (const family of families) {
    for (const index of [0, 1]) assert.ok(WISHES.some((w) => w.best === `${family}:${index}`), `${family}:${index} を望む客がいる`);
  }
  const verbs = VERBS.map((v) => v.id);
  for (const [type, call] of Object.entries(CALLS)) assert.ok(verbs.includes(call.verb), type);
  for (const guest of Object.values(GUESTS)) for (const type of guest.calls) assert.ok(CALLS[type], `${guest.id}:${type}`);
  assert.deepEqual(SENDS.map((send) => send.id), ["extend", "thanks", "sorry"]);
  for (const line of Object.values(SEND_LINES).flat()) assert.ok(!line.endsWith("。"), `客の台詞は句点で終えない: ${line}`);
  for (const night of Object.values(NIGHTS)) {
    assert.equal(night.arrive.length, night.cast.length, night.id);
    for (const kind of night.cast) assert.ok(GUESTS[kind], `${night.id}:${kind}`);
    assert.ok(night.arrive.at(-1) + 110 < night.length, `${night.id}: 最後の客が帰るまでの時間がある`);
  }
  assert.deepEqual(RANKS.map((r) => r.id), ["S", "A", "B", "C"]);
});

test("同じ種なら同じ一晩。操作も経過も元の state を書き換えない", () => {
  const input = { seed: 321, level: 2, chapter: 1, anchor: { family: "fruit_mint_free", index: 1 } };
  const a = createFloorNight(input), b = createFloorNight(input);
  assert.deepEqual(a, b);
  assert.equal(a.tables.length, FLOOR_TABLE_COUNT);
  const anchored = a.guests[a.anchor.guestId];
  assert.equal(anchored.best, "fruit_mint_free:1");
  assert.equal(new Set(anchored.options).size, 3);
  const wishes = (seed) => Object.values(createFloorNight({ seed, level: 1 }).guests).map((g) => g.quote).join("/");
  assert.equal(new Set([1, 2, 3, 4, 5, 6].map(wishes)).size > 3, true, "種が違えば客の言葉も変わる");
  const frozen = structuredClone(a);
  const later = floorTick(a, 10);
  assert.deepEqual(a, frozen);
  assert.equal(later.t, 10);
  assert.equal(floorAct(later, { type: "seat", tableId: 9 }), later, "無い卓は何も進めない");
  assert.equal(floorAct(later, { type: "bill", tableId: 1 }), later, "会計前の卓は会計できない");
  const seated = act(later, { type: "seat", tableId: 3 });
  assert.equal(at(later, 3).phase, "empty");
  assert.equal(at(seated, 3).phase, "order");
  assert.equal(seated.t, later.t, "操作は時間を使わない");
});

test("夜の種類: 最初は四組、二回目は六組、雨の日は雨の夜、第2章は第2章の注文も出る", () => {
  assert.equal(pickNight(0, 5).id, "first");
  assert.equal(pickNight(1, 5).id, "usual");
  assert.equal(pickNight(3, 5, { rainy: true }).id, "rain");
  assert.ok(["friday", "newcomers", "usual"].includes(pickNight(2, 77).id));
  assert.equal(Object.keys(createFloorNight({ level: 0 }).guests).length, 4);
  assert.equal(Object.keys(createFloorNight({ level: 1 }).guests).length, 6);
  const first = createFloorNight({ level: 0, seed: 3 });
  for (const guest of Object.values(first.guests)) for (const type of guest.calls) assert.ok(["thin", "harsh", "glass"].includes(type));
  assert.equal(first.hint, "said");
  assert.equal(createFloorNight({ level: 3 }).hint, "sight");
  const ch1 = new Set(), ch2 = new Set();
  for (let seed = 0; seed < 40; seed++) {
    for (const g of Object.values(createFloorNight({ seed, level: 2, chapter: 1 }).guests)) ch1.add(MIXES[g.best].family);
    for (const g of Object.values(createFloorNight({ seed, level: 2, chapter: 2 }).guests)) ch2.add(MIXES[g.best].family);
  }
  assert.deepEqual([...ch1].sort(), [...FAMILIES[1]].sort());
  assert.ok([...ch2].some((family) => family.startsWith("ch2_")));
});

test("配合: ぴったり・悪くない・外れで満足と会計が変わる。外れは相談から作り直せる", () => {
  const base = createFloorNight({ seed: 12, level: 1 });
  const best = serveFirst(base);
  const fine = serveFirst(base, near);
  const miss = serveFirst(base, off);
  assert.equal(best.log.at(-1).grade, "best");
  assert.equal(fine.log.at(-1).grade, "near");
  assert.equal(miss.log.at(-1).grade, "off");
  assert.ok(at(best, 1).mood > at(fine, 1).mood && at(fine, 1).mood > at(miss, 1).mood);
  assert.ok(best.air > fine.air && fine.air > miss.air);
  assert.equal(at(miss, 1).accepted, null);
  // 相談: 作り直すと先に作られ、ぴったりなら台代をいただける
  let s = until(miss, (x) => floorTap(x, 1) === "consult");
  const guest = s.guests[at(s, 1).guestId];
  const redo = act(s, { type: "consult", tableId: 1, mixId: guest.best });
  assert.equal(redo.bench?.tableId ?? redo.line[0].tableId, 1);
  let served = act(until(redo, (x) => at(x, 1).delivery?.ready), { type: "serve", tableId: 1 });
  assert.equal(served.log.at(-1).grade, "redo");
  assert.equal(at(served, 1).accepted, true);
  // 相談: 台代を外すと、席と飲み物だけの会計になる
  const waived = act(s, { type: "consult", tableId: 1 });
  assert.equal(at(waived, 1).accepted, false);
  let paid = until(waived, (x) => floorTap(x, 1) === "bill" || floorTap(x, 1) === "care");
  while (floorTap(paid, 1) !== "bill") {
    if (floorTap(paid, 1) === "care") paid = act(paid, { type: "care", tableId: 1, verb: CALLS[at(paid, 1).call.type].verb });
    else paid = floorTick(paid);
  }
  paid = act(paid, { type: "bill", tableId: 1 });
  const row = paid.results.at(-1);
  assert.equal(row.shisha, 0);
  assert.equal(row.seat, PRICE.seat * guest.party);
  assert.equal(row.drink, PRICE.drink * guest.party);
});

test("合図: 正しい手入れで満足が上がり、外すと下がる。夢中の客はそっとしておく", () => {
  let s = serveFirst(createFloorNight({ seed: 4, level: 1 }));
  s = until(s, (x) => floorTap(x, 1) === "care");
  const type = at(s, 1).call.type;
  const right = CALLS[type].verb;
  const wrong = VERBS.find((v) => v.id !== right).id;
  const good = act(s, { type: "care", tableId: 1, verb: right });
  const bad = act(s, { type: "care", tableId: 1, verb: wrong });
  assert.ok(at(good, 1).mood > at(s, 1).mood && at(bad, 1).mood < at(s, 1).mood);
  assert.equal(good.counts.care, 1);
  assert.equal(bad.counts.careMiss, 1);
  assert.equal(at(good, 1).call, null);
  assert.ok(floorUrgency(s, 1) >= 0 && floorUrgency(s, 1) <= 1);
  // 応えないまま時間が過ぎると、合図は消えて満足が下がる
  const late = until(s, (x) => !at(x, 1).call);
  assert.ok(at(late, 1).mood < at(s, 1).mood);
  // 夢中の客（読書）は、放っておいても減点しない
  let reader = createFloorNight({ seed: 2, level: 1 });
  const readerId = Object.values(reader.guests).find((g) => g.kind === "reader").id;
  reader = until(reader, (x) => x.queue.some((q) => q.id === readerId), 300);
  while (reader.queue[0].id !== readerId) reader = act(reader, { type: "seat", tableId: reader.tables.find((t) => t.phase === "empty").id });
  reader = act(reader, { type: "seat", tableId: 5 });
  reader = act(reader, { type: "order", tableId: 5, mixId: reader.guests[readerId].best });
  reader = act(until(reader, (x) => at(x, 5).delivery?.ready), { type: "serve", tableId: 5 });
  reader = until(reader, (x) => at(x, 5).call?.type === "focus");
  const before = at(reader, 5).mood;
  assert.equal(at(until(reader, (x) => !at(x, 5).call), 5).mood, before);
  assert.ok(at(act(reader, { type: "care", tableId: 5, verb: "leave" }), 5).mood > before);
  assert.ok(at(act(reader, { type: "care", tableId: 5, verb: "talk" }), 5).mood < before);
});

test("会計と片付け: 人数分の席と初杯・一台分の台代。会計だけでは空席にならない", () => {
  let s = createFloorNight({ seed: 7, level: 1 });
  const pair = Object.values(s.guests).find((g) => g.party === 2);
  s = until(s, (x) => x.queue.some((q) => q.id === pair.id), 300);
  let tableId = 1;
  while (s.queue[0].id !== pair.id) s = act(s, { type: "seat", tableId: tableId++ });
  s = act(s, { type: "seat", tableId: 5 });
  s = act(s, { type: "order", tableId: 5, mixId: pair.best });
  s = act(until(s, (x) => at(x, 5).delivery?.ready), { type: "serve", tableId: 5 });
  s = toBill(s, 5);
  const sales = s.sales;
  const running = floorBill(s, 5);
  s = act(s, { type: "bill", tableId: 5 });
  const row = s.results.at(-1);
  assert.equal(running.total, row.total, "卓の「ご利用」は、会計の合計と同じ");
  assert.equal(floorBill(s, 5), null);
  assert.equal(row.seat, 1000);
  assert.equal(row.drink, 800);
  assert.equal(row.shisha, PRICE.shisha[pair.stay]);
  assert.equal(s.sales - sales, row.total);
  assert.equal(at(s, 5).phase, "dirty");
  assert.equal(floorTap(s, 5), "clean");
  assert.equal(floorAct(s, { type: "seat", tableId: 5 }), s, "片付け前の卓へは案内できない");
  s = act(s, { type: "clean", tableId: 5 });
  assert.equal(at(s, 5).phase, "empty");
});

test("会計の声かけ: 顔に合った一言で満足が上がる。笑顔の客は延長に応じ、一卓に一度まで", () => {
  const s = toBill(serveFirst(createFloorNight({ seed: 4, level: 1 })));
  const withMood = (mood) => { const x = structuredClone(s); at(x, 1).mood = mood; return x; };
  assert.equal(floorSendOff(s, 2), null, "会計前の卓に見立ては無い");
  assert.deepEqual([90, 80, 79, 45, 44].map(floorFace), ["smile", "smile", "flat", "flat", "frown"]);
  // 笑顔: 延長（トップ替え）に応じてくれる。売上は、運んでから会計で入る
  const smile = withMood(90);
  assert.deepEqual(floorSendOff(smile, 1), { face: "smile", extend: "ok", best: "extend" });
  const extended = act(smile, { type: "bill", tableId: 1, reply: "extend" });
  assert.equal(at(extended, 1).phase, "enjoy");
  assert.equal(at(extended, 1).top, "ordered");
  assert.equal(extended.sales, smile.sales);
  assert.equal(extended.log.at(-1).type, "extend");
  assert.equal(extended.counts.extend, 1);
  assert.ok(extended.air > smile.air);
  assert.equal(floorTap(extended, 1), "info", "仕上がるまでは待つ");
  const again = toBill(extended);
  assert.equal(at(again, 1).top, "served");
  assert.ok(again.t - extended.t >= 26, "延長した分だけ長く過ごす");
  assert.deepEqual(floorSendOff(again, 1), { face: "smile", extend: "used", best: "thanks" });
  assert.equal(floorAct(again, { type: "bill", tableId: 1, reply: "extend" }), again, "延長は一卓に一度まで");
  const paid = act(again, { type: "bill", tableId: 1, reply: "thanks" });
  assert.equal(paid.results.at(-1).top, PRICE.top);
  assert.equal(paid.log.at(-1).verdict, "best");
  // 笑顔にお礼だけ: 悪くはないが、延長の機会を逃す
  const plain = act(smile, { type: "bill", tableId: 1 });
  assert.equal(plain.log.at(-1).reply, "thanks");
  assert.equal(plain.log.at(-1).verdict, "good");
  assert.equal(plain.results.at(-1).mood, 90);
  assert.equal(plain.results.at(-1).top, 0);
  // ふつうの顔: お礼が合う。延長をすすめると断られて、少し気まずい
  const flat = withMood(60);
  assert.equal(floorSendOff(flat, 1).best, "thanks");
  assert.equal(act(flat, { type: "bill", tableId: 1, reply: "thanks" }).results.at(-1).mood, 65);
  const pushed = act(flat, { type: "bill", tableId: 1, reply: "extend" });
  assert.equal(pushed.log.at(-1).verdict, "miss");
  assert.equal(pushed.results.at(-1).mood, 54);
  assert.equal(at(pushed, 1).phase, "dirty");
  assert.equal(act(flat, { type: "bill", tableId: 1, reply: "sorry" }).results.at(-1).mood, 60);
  // 曇り顔: お詫びが届く。お礼だけでは変わらない
  const frown = withMood(40);
  assert.equal(floorSendOff(frown, 1).best, "sorry");
  const sorry = act(frown, { type: "bill", tableId: 1, reply: "sorry" });
  assert.equal(sorry.results.at(-1).mood, 54);
  assert.equal(sorry.log.at(-1).verdict, "best");
  assert.equal(act(frown, { type: "bill", tableId: 1, reply: "thanks" }).log.at(-1).verdict, "miss");
  // 閉店が近い時・台代を外した卓には、延長をすすめられない
  const late = withMood(90);
  late.t = late.length - 20;
  assert.deepEqual(floorSendOff(late, 1), { face: "smile", extend: "late", best: "thanks" });
  assert.equal(floorAct(late, { type: "bill", tableId: 1, reply: "extend" }), late);
  const waived = withMood(90);
  at(waived, 1).accepted = false;
  assert.equal(floorSendOff(waived, 1).extend, "none");
});

test("入口: 待たせすぎると帰ってしまう。満席でも6卓目は生まれない", () => {
  let s = createFloorNight({ seed: 5, level: 1 });
  s = until(s, (x) => x.counts.missed > 0, 400);
  assert.ok(s.results[0].missed);
  assert.equal(s.results[0].total, 0);
  const full = createFloorNight({ seed: 5, night: "full", level: 5 });
  let f = full;
  for (let i = 0; i < 200 && f.tables.some((t) => t.phase === "empty"); i++) {
    f = floorTick(f);
    const free = f.tables.find((t) => t.phase === "empty");
    if (f.queue.length && free) f = act(f, { type: "seat", tableId: free.id });
  }
  assert.ok(f.tables.every((t) => t.phase !== "empty"));
  f = until(f, (x) => x.queue.length > 0, 200);
  for (const t of f.tables) assert.equal(floorTap(f, t.id) === "seat", false);
  assert.equal(f.tables.length, FLOOR_TABLE_COUNT);
});

test("作業台と受渡棚: 一台ずつ仕上がり、棚は二つまで。急ぎの伝票は先に回せる", () => {
  let s = createFloorNight({ seed: 5, night: "full", level: 5 });
  for (let seated = 0; seated < 5;) {
    s = floorTick(s);
    const free = s.tables.find((t) => t.phase === "empty");
    if (s.queue.length && free) {
      s = act(s, { type: "seat", tableId: free.id });
      s = act(s, { type: "order", tableId: free.id, mixId: s.guests[at(s, free.id).guestId].best });
      seated++;
    }
  }
  assert.ok(s.bench);
  const waiting = s.line.map((job) => job.tableId);
  assert.ok(waiting.length >= 2);
  const rushed = act(s, { type: "rush", tableId: waiting.at(-1) });
  assert.equal(rushed.line[0].tableId, waiting.at(-1));
  assert.equal(floorAct(s, { type: "rush", tableId: waiting[0] }), s, "先頭の伝票は動かない");
  s = floorTick(s, 120);
  assert.equal(s.shelf.length, 2, "棚は二つまで");
  assert.ok(s.bench && s.bench.left === 0, "三台目は作業台で棚が空くのを待つ");
  const first = s.shelf[0].tableId;
  s = act(s, { type: "serve", tableId: first });
  assert.equal(s.shelf.length, 2, "運ぶと、待っていた一台が棚へ出る");
});

test("ボーナスタイム: 溜まった時だけ使え、その間は合図と待ち時間が止まり満足が上がる", () => {
  let s = serveFirst(createFloorNight({ seed: 4, level: 1 }));
  assert.equal(floorAct(s, { type: "bonusTime" }), s, "溜まる前は使えない");
  s = { ...s, air: floorAirFull };
  s = until(s, (x) => floorTap(x, 1) === "care");
  const call = { ...at(s, 1).call };
  const mood = at(s, 1).mood;
  s = act(s, { type: "bonusTime" });
  assert.equal(s.air, 0);
  assert.equal(s.bonusTimeLeft, floorBonusTimeLength);
  assert.equal(floorAdvice(s).kind, "bonusTime");
  s = floorTick(s, floorBonusTimeLength);
  assert.equal(s.bonusTimeLeft, 0);
  assert.ok(at(s, 1).mood > mood, "満足が上がる");
  assert.equal(at(s, 1).call.until - s.t, call.until - (s.t - floorBonusTimeLength), "合図の残り時間は減らない");
  assert.ok(s.log.some((e) => e.type === "bonusTimeEnd"));
  assert.equal(s.bonusTimes, 1);
});

test("今夜の段取り: 仕込み・炭・レジがそれぞれ効く", () => {
  const plain = serveFirst(createFloorNight({ seed: 6, level: 2, night: "usual" }));
  const prep = serveFirst(createFloorNight({ seed: 6, level: 2, night: "usual", plan: "prep" }));
  assert.ok(prep.t < plain.t, "仕込みを先に済ませると早く出せる");
  const open = (s) => { s = until(s, (x) => floorTap(x, 1) === "care"); return at(s, 1).call.until - at(s, 1).call.since; };
  assert.ok(open(serveFirst(createFloorNight({ seed: 6, level: 2, night: "usual", plan: "coal" }))) > open(plain));
  let s = serveFirst(createFloorNight({ seed: 6, level: 2, night: "usual", plan: "register" }));
  for (let i = 0; i < 300 && at(s, 1).phase !== "dirty"; i++) {
    const tap = floorTap(s, 1);
    if (tap === "care") s = act(s, { type: "care", tableId: 1, verb: CALLS[at(s, 1).call.type].verb });
    else s = floorTick(s);
  }
  assert.equal(at(s, 1).phase, "dirty", "会計はスミさんが受ける");
  assert.equal(s.results.at(-1).by, "sumi");
});

test("締め: 時間切れ・引き継ぎは提供済みの卓だけ会計し、提供前の卓にお代を付けない", () => {
  let s = serveFirst(createFloorNight({ seed: 8, level: 1 }));
  s = until(s, (x) => x.queue.length > 0);
  s = act(s, { type: "seat", tableId: 2 });
  s = act(s, { type: "order", tableId: 2, mixId: s.guests[at(s, 2).guestId].best });
  const closed = act(s, { type: "finish" });
  assert.ok(closed.done);
  assert.equal(floorAct(closed, { type: "clean", tableId: 1 }), closed);
  assert.equal(floorTick(closed, 5), closed);
  const result = floorResult(closed);
  assert.equal(result.closing, "handoff");
  const [served, unserved] = [result.groups.find((g) => g.tableId === 1), result.groups.find((g) => g.tableId === 2)];
  assert.equal(served.by, "sumi");
  assert.ok(served.total > 0);
  assert.ok(unserved.unserved);
  assert.equal(unserved.total, 0);
  assert.equal(result.sales, served.total);
  assert.notEqual(result.rank, "S", "途中で任せた夜は大入りにならない");
  assert.ok(result.score < 60, "まだ来ていない組の分も平均に入る");
  // 誰も迎えない夜は、最後の客が帰った時に閉まる
  const idle = floorTick(createFloorNight({ seed: 8, level: 1 }), 1000);
  assert.ok(idle.done);
  assert.equal(idle.closing, "clear");
  assert.equal(floorResult(idle).rank, "C");
  assert.equal(floorResult(idle).sales, 0);
  assert.equal(floorResult(idle).lost, 6);
  // 注文を聞かないまま閉店時刻になった卓は、スミさんが引き継ぐ
  let stuck = until(createFloorNight({ seed: 8, level: 1 }), (x) => x.queue.length > 0);
  stuck = floorTick(act(stuck, { type: "seat", tableId: 4 }), 1000);
  assert.equal(stuck.closing, "time");
  assert.equal(stuck.t, stuck.length);
  assert.ok(floorResult(stuck).groups.find((g) => g.tableId === 4).unserved);
});

test("今日の注文の客: 受け取った一台だけを記録する", () => {
  const input = { seed: 15, level: 1, anchor: { family: "citrus", index: 1 } };
  const play = (pick) => playFloorBot({ ...input, pick });
  assert.equal(play("best").result.anchorIndex, 1);
  assert.equal(play("near").result.anchorIndex, 0);
  assert.equal(createFloorNight({ seed: 15, level: 1 }).anchor, null);
  assert.equal(floorResult(act(createFloorNight(input), { type: "finish" })).anchorIndex, null);
});

test("通し: 手際のよい操作は大入り、放っておく夜は評価が低い。売上は明細の合計と一致する", () => {
  for (const [night, level] of [["first", 0], ["usual", 1], ["friday", 2], ["rain", 2], ["newcomers", 3], ["full", 5]]) {
    for (const chapter of [1, 2]) {
      const quick = playFloorBot({ seed: 11, level, night, chapter, pace: 2 }).result;
      assert.equal(quick.rank, "S", `${night} 第${chapter}章: 手際よく回せば大入り（${quick.score}）`);
      assert.equal(quick.lost, 0);
      assert.equal(quick.served, quick.expected);
      assert.equal(quick.sales, quick.groups.reduce((sum, g) => sum + g.total, 0));
      assert.ok(quick.bonusTimes >= 1, `${night}: 一晩に一度はボーナスタイムが溜まる`);
      const slow = playFloorBot({ seed: 11, level, night, chapter, pace: 16, pick: "near" }).result;
      assert.ok(["B", "C"].includes(slow.rank), `${night}: 手が遅いと評価は下がる（${slow.rank}）`);
      assert.ok(slow.score < quick.score);
    }
  }
});
