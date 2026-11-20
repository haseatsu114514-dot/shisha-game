// tonari フロア営業のルール（js/daily/tonari-floor-model.js）。ワンオペ＆フレーバー調合型。
// 台本の整合・調合と評価・同じ種なら同じ一晩・自動着席と注文待ち・同時作成・ケア・ドリンクと延長・会計・フィーバー・定番・締め・通しを確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorResult, floorHint, floorUrgency, floorWaitLeft, floorStayLeft, floorCoalLeft,
  floorMaking, floorBill, floorStage, floorFace, floorFeverLevel, floorPresets, floorOrderWait, floorFeverLength, floorSlots,
  mixInfo, mixKey, mixLabel, aptitude, evaluateMix, pickNight, FLOOR_TABLE_COUNT,
} from "../js/daily/tonari-floor-model.js";
import {
  PRICE, COST, TRAIT_IDS, FAMILIES, FLAVORS, SYNERGIES, NG, TAG_LABEL, GUESTS, CALLS, VERBS, NIGHTS, RANKS, MOODS, STARTER_PRESETS,
  PRESET_MAX, SERVE_LINES, SEND_LINES, ORDER_WORDS,
} from "../js/daily/tonari-floor-data.js";
import { playFloorBot, bestMix } from "./tonari_floor_bot.mjs";

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
/** その卓が会計を頼むまで進める（ケアには正しく応える）。 */
function toBill(s, tableId = 1) {
  for (let i = 0; i < 600 && floorTap(s, tableId) !== "bill"; i++) {
    s = floorTap(s, tableId) === "care" ? act(s, { type: "care", tableId, verb: CALLS[at(s, tableId).call.type].verb }) : floorTick(s);
  }
  assert.equal(floorTap(s, tableId), "bill");
  return s;
}
/** 最初の客に、選んだ一台を出すところまで（1卓）。 */
function serveFirst(s, pick = (guest) => bestMix(guest.order, guest.rank)) {
  s = until(s, (x) => at(x, 1).phase === "order");
  const guest = s.guests[at(s, 1).guestId];
  s = act(s, { type: "order", tableId: 1, mix: pick(guest) });
  return until(s, (x) => at(x, 1).phase === "enjoy");
}
const order = (over) => ({ type: "normal", family: "fruit", trait: "cloud", ng: null, must: null, quote: "", ...over });

test("台本: 棚の30種・相性・NG・ケア・客・夜の種類がそろっている", () => {
  const flavors = Object.values(FLAVORS);
  assert.equal(flavors.length, 30);
  assert.deepEqual(FAMILIES.map((f) => flavors.filter((x) => x.family === f.id).length), [10, 6, 7, 7]);
  for (const f of flavors) {
    assert.equal(f.traits.length, 4, f.id);
    assert.ok(f.traits.every((v) => v >= 0 && v <= 3) && f.cost > 0, f.id);
    for (const tag of f.tags) assert.ok(TAG_LABEL[tag], `${f.id}:${tag}`);
    for (const fam of f.also) assert.ok(FAMILIES.some((x) => x.id === fam) && fam !== f.family, `${f.id}:${fam}`);
  }
  for (const pair of SYNERGIES) for (const tag of pair) assert.ok(TAG_LABEL[tag], tag);
  for (const ng of Object.values(NG)) for (const tag of ng.tags) assert.ok(TAG_LABEL[tag], tag);
  // スッキリ系には、ミントのタグが無いフレーバーもある（「ミント無しでスッキリ」に応えられる）
  assert.ok(flavors.some((f) => f.family === "fresh" && !f.tags.includes("mint")));
  const verbs = VERBS.map((v) => v.id);
  assert.deepEqual(verbs, ["add", "ease", "water", "teach", "chat"]);
  for (const [type, call] of Object.entries(CALLS)) assert.ok(verbs.includes(call.verb), type);
  for (const line of [...Object.values(SERVE_LINES).flat(), ...Object.values(SEND_LINES).flat(), ...Object.values(ORDER_WORDS.omakase), ...Object.values(CALLS).map((c) => c.good)]) {
    assert.ok(!line.endsWith("。"), `客の台詞は句点で終えない: ${line}`);
  }
  assert.deepEqual({ ...PRICE }, { shisha: 2000, charge: 700, top: 1500, drink: 600 });
  assert.ok(STARTER_PRESETS.length >= 3 && STARTER_PRESETS.length <= PRESET_MAX);
  for (const ids of STARTER_PRESETS) assert.ok(mixInfo(ids), ids.join("+"));
  for (const night of Object.values(NIGHTS)) {
    assert.equal(night.arrive.length, night.cast.length, night.id);
    for (const kind of night.cast) assert.ok(GUESTS[kind], `${night.id}:${kind}`);
  }
  assert.deepEqual(RANKS.map((r) => r.id), ["S", "A", "B", "C"]);
  assert.deepEqual(MOODS.map((m) => m.id), ["max", "good", "ok", "low", "mad"]);
  assert.deepEqual([100, 85, 84, 65, 64, 40, 39, 20, 19, 0].map((v) => floorStage(v).id), ["max", "max", "good", "good", "ok", "ok", "low", "low", "mad", "mad"]);
  assert.deepEqual([90, 50, 10].map(floorFace), ["smile", "flat", "frown"]);
});

test("調合: 1〜3種を混ぜると、特性は平均・系統は寄り・相性はタグの組・原価と作成時間は数で決まる", () => {
  const lm = mixInfo(["lemon", "mint"]);
  assert.equal(lm.label, "レモン＋ミント");
  assert.equal(mixLabel(["apple"]), "ダブルアップル");
  assert.deepEqual(lm.traits, { taste: 1.5, chill: 1.5, cloud: 2.5, last: 1.5 });
  assert.deepEqual(lm.family, { fruit: 0.5, fresh: 0.75, sweet: 0, deep: 0 });
  assert.deepEqual(lm.synergies, [["citrus", "mint"]]);
  assert.equal(lm.cost, FLAVORS.lemon.cost + FLAVORS.mint.cost + COST.coal);
  assert.equal(mixKey(["mint", "lemon"]), mixKey(["lemon", "mint"]), "入れた順は区別しない");
  const [one, two, three] = [mixInfo(["grape"]), mixInfo(["grape", "berry"]), mixInfo(["grape", "berry", "pine"])];
  assert.ok(one.time < two.time && two.time < three.time, "混ぜる数が多いほど、立ち上げに時間がかかる");
  assert.ok(mixInfo(["grape", "berry"], { preset: true }).time < two.time, "定番は早く出せる");
  assert.equal(mixInfo(["peach", "vanilla"]).synergies.length, 1);
  assert.equal(mixInfo(["earlgrey", "milk", "lemon"]).synergies.length, 2);
  for (const bad of [[], ["grape", "grape"], ["grape", "berry", "pine", "mint"], ["nothing"], null]) assert.equal(mixInfo(bad), null);
  assert.deepEqual([1, 0.8, 0.5, 0.25, 0.2].map(aptitude), ["best", "best", "good", "weak", "none"]);
});

test("評価: 系統の適性×吸い心地の到達度×相性。NGを混ぜると大きく下がり、指定フレーバー・おまかせには別の加点がある", () => {
  const fruitCloud = order();
  const best = evaluateMix(["grape", "berry"], fruitCloud);
  assert.deepEqual([best.family, best.grade, best.ratio], ["best", "best", 1.25]);
  const good = evaluateMix(["peach"], fruitCloud); // 系統は合うが、煙は並
  const weak = evaluateMix(["milk", "mint", "grape"], fruitCloud); // 煙は出るが、果物は1/3
  const none = evaluateMix(["vanilla"], fruitCloud);
  assert.deepEqual([good.family, weak.family, none.family], ["best", "weak", "none"]);
  assert.ok(best.mood > good.mood && good.mood > weak.mood && weak.mood > none.mood);
  assert.equal(none.grade, "off");
  // こだわりの客は要求が高い（同じ一台でも到達度が下がる）
  assert.ok(evaluateMix(["grape"], fruitCloud, "keen").mood < evaluateMix(["grape"], fruitCloud, "plain").mood);
  // 相性が成立すると上がる
  const plain = evaluateMix(["lemon", "orange"], order({ trait: "taste" }));
  const synergy = evaluateMix(["lemon", "peach"], order({ trait: "taste" }));
  assert.equal(plain.synergies.length, 0);
  assert.ok(synergy.synergies.length === 1 && synergy.mood > plain.mood);
  // NG: 「スッキリ系でミント無し」にミントを混ぜると大幅減。ライムやレモングラスなら通る
  const noMint = order({ type: "ng", family: "fresh", trait: "chill", ng: "mint" });
  const hit = evaluateMix(["mint", "lime"], noMint);
  const safe = evaluateMix(["lemongrass", "lime"], noMint);
  assert.deepEqual([hit.ngHit, hit.grade, safe.ngHit], [true, "ng", false]);
  assert.ok(safe.mood - hit.mood > 25);
  // 指定フレーバー: 入れれば加点、入れなければ外れ
  const pin = order({ type: "pin", family: "sweet", trait: "taste", must: "earlgrey" });
  const withIt = evaluateMix(["earlgrey", "honey"], pin);
  const without = evaluateMix(["vanilla", "honey"], pin);
  assert.deepEqual([withIt.mustOk, without.mustOk, without.grade], [true, false, "off"]);
  assert.ok(withIt.mood > without.mood);
  // おまかせ: 系統は問わない。相性の数が効く
  const omakase = order({ type: "omakase", family: null, trait: "chill" });
  assert.equal(evaluateMix(["vanilla"], omakase).family, null);
  assert.ok(evaluateMix(["earlgrey", "milk", "lemon"], omakase).mood > evaluateMix(["earlgrey", "hinoki"], omakase).mood);
});

test("同じ種なら同じ一晩。操作も経過も元の state を書き換えない。注文の種類は回すほど増える", () => {
  const input = { seed: 321, level: 2, chapter: 1 };
  const a = createFloorNight(input), b = createFloorNight(input);
  assert.deepEqual(a, b);
  assert.equal(a.tables.length, FLOOR_TABLE_COUNT);
  const frozen = structuredClone(a);
  const later = floorTick(a, 10);
  assert.deepEqual(a, frozen);
  assert.equal(later.t, 10);
  assert.equal(floorAct(later, { type: "order", tableId: 9, mix: ["apple"] }), later, "無い卓は何も進めない");
  assert.equal(floorAct(later, { type: "bill", tableId: 1 }), later, "会計前の卓は会計できない");
  assert.equal(act(later, { type: "order", tableId: 1, mix: ["apple"] }).t, later.t, "操作は時間を使わない");
  const types = (level) => { const set = new Set(); for (let seed = 0; seed < 30; seed++) for (const g of Object.values(createFloorNight({ seed, level }).guests)) set.add(g.order.type); return [...set].sort(); };
  assert.deepEqual(types(0), ["normal"]);
  assert.deepEqual(types(1), ["ng", "normal"]);
  assert.deepEqual(types(3), ["ng", "normal", "omakase", "pin"]);
  for (const g of Object.values(createFloorNight({ seed: 9, level: 3 }).guests)) {
    assert.ok(g.order.quote.length <= 48 && !g.order.quote.endsWith("。"), g.order.quote);
    assert.ok(TRAIT_IDS.includes(g.order.trait));
  }
  assert.equal(pickNight(0, 5).id, "first");
  assert.equal(pickNight(1, 5).id, "usual");
  assert.equal(pickNight(3, 5, { rainy: true }).id, "rain");
  assert.equal(createFloorNight({ level: 0 }).hint, "said");
  assert.equal(createFloorNight({ level: 3 }).hint, "sight");
});

test("来店と注文待ち: 客は自動で座り、約9秒のうちに注文を聞かないと怒って帰る", () => {
  let s = createFloorNight({ seed: 5, level: 1 });
  s = until(s, (x) => at(x, 1).phase === "order");
  assert.equal(s.came, 1);
  assert.equal(s.log.at(-1).type, "arrive");
  assert.equal(floorTap(s, 1), "order");
  assert.equal(floorWaitLeft(s, 1), floorOrderWait(s));
  assert.equal(floorOrderWait(s), 18);
  assert.equal(floorOrderWait(createFloorNight({ level: 0 })), 30, "はじめての営業は長く待ってくれる");
  assert.equal(floorHint(s).kind, "order");
  const waited = floorTick(s, 10);
  assert.equal(floorWaitLeft(waited, 1), 8);
  assert.ok(floorUrgency(waited, 1) > 0.5);
  const gone = floorTick(s, 18);
  assert.equal(at(gone, 1).phase, "cool");
  assert.equal(gone.counts.left, 1);
  assert.equal(gone.results[0].left, true);
  assert.equal(gone.results[0].total, 0);
  assert.ok(gone.fans < 0, "怒って帰るとファンが減る");
  assert.equal(at(floorTick(gone, 6), 1).phase, "empty", "少し置いて、卓が空く");
  assert.equal(at(until(gone, (x) => at(x, 1).phase === "order"), 1).phase, "order", "次に来た客が、その卓に入る");
  // 卓が埋まっている間は、次の客は入ってこない（空くまで待つ）
  let full = createFloorNight({ seed: 5, night: "full", level: 5 });
  for (let i = 0; i < 40; i++) {
    full = floorTick(full);
    for (const table of full.tables) if (table.phase === "order") full = act(full, { type: "order", tableId: table.id, mix: ["apple"] });
  }
  assert.ok(full.tables.every((x) => x.phase !== "empty"));
  assert.equal(full.came, FLOOR_TABLE_COUNT);
  assert.ok(full.upcoming.length > 0);
});

test("注文と作成: 確定でチャージと初回ドリンクが付き、同時に2台まで作成が進んで、出来たら自動で提供される", () => {
  let s = createFloorNight({ seed: 5, night: "full", level: 5 });
  s = until(s, (x) => x.tables.filter((t) => t.phase === "order").length >= 3);
  const pair = s.tables.find((t) => t.phase === "order" && s.guests[t.guestId].party === 2);
  const before = s.sales;
  s = act(s, { type: "order", tableId: pair.id, mix: ["grape", "berry"] });
  assert.equal(at(s, pair.id).phase, "prep");
  assert.deepEqual(floorBill(s, pair.id), { charge: 1400, shisha: 0, drink: 1200, top: 0, total: 2600 }, "二人組: チャージと初回ドリンクが二人分");
  assert.equal(s.sales - before, 2600);
  assert.equal(floorAct(s, { type: "order", tableId: pair.id, mix: ["apple"] }), s, "注文は一度だけ");
  for (const table of s.tables) if (table.phase === "order") s = act(s, { type: "order", tableId: table.id, mix: ["apple", "mint", "lemon"] });
  const making = floorMaking(s);
  assert.ok(making.length >= 3);
  assert.deepEqual(making.map((m) => m.active), making.map((_, i) => i < floorSlots), "同時に作れるのは2台まで");
  const third = making[2];
  const next = floorTick(s, 3);
  assert.equal(floorMaking(next).find((m) => m.tableId === third.tableId).left, third.left, "枠が空くまで、3台目は進まない");
  // 出来上がると自動で提供され、シーシャの代金と原価が付く
  const cost = s.cost;
  s = until(s, (x) => at(x, pair.id).phase === "enjoy");
  assert.equal(floorBill(s, pair.id).shisha, PRICE.shisha);
  assert.equal(s.cost - cost >= mixInfo(["grape", "berry"]).cost, true);
  assert.ok(["best", "good", "ok", "off", "ng"].includes(at(s, pair.id).grade));
  assert.ok(s.log.some((e) => e.type === "serve") || floorStayLeft(s, pair.id) > 0.9);
  assert.equal(floorTap(s, pair.id), "info");
});

test("ケア: 定期の温度調整と客の様子に、正しい言葉で応えると満足とフィーバーが上がる。外す・放っておくと下がる", () => {
  let s = serveFirst(createFloorNight({ seed: 4, level: 1 }));
  assert.ok(floorCoalLeft(s, 1) > 0.9);
  s = until(s, (x) => floorTap(x, 1) === "care");
  const type = at(s, 1).call.type;
  const right = CALLS[type].verb;
  const wrong = VERBS.find((v) => v.id !== right).id;
  const good = act(s, { type: "care", tableId: 1, verb: right });
  const bad = act(s, { type: "care", tableId: 1, verb: wrong });
  assert.ok(at(good, 1).mood > at(s, 1).mood && at(bad, 1).mood < at(s, 1).mood);
  assert.ok(good.fever > s.fever);
  assert.equal(good.counts.care, 1);
  assert.equal(bad.counts.careMiss, 1);
  assert.equal(at(good, 1).call, null);
  assert.equal(floorWaitLeft(s, 1), at(s, 1).call.until - s.t);
  const late = until(s, (x) => !at(x, 1).call);
  assert.ok(at(late, 1).mood < at(s, 1).mood - 5);
  assert.equal(late.counts.late, 1);
  // 初心者はむせる（吸い方の案内）。はじめての営業でも出る
  let first = serveFirst(createFloorNight({ seed: 4, level: 0 }));
  assert.equal(first.guests[at(first, 1).guestId].trait, "beginner");
  first = until(first, (x) => !!at(x, 1).call);
  assert.equal(at(first, 1).call.type, "cough");
  // 同時に呼ばれるのは、店全体で2卓まで
  let busy = createFloorNight({ seed: 6, night: "full", level: 5 });
  let most = 0;
  for (let i = 0; i < 300 && !busy.done; i++) {
    busy = floorTick(busy);
    for (const table of busy.tables) {
      if (table.phase === "order") busy = act(busy, { type: "order", tableId: table.id, mix: ["apple"] });
      if (table.phase === "bill") busy = act(busy, { type: "bill", tableId: table.id });
    }
    most = Math.max(most, busy.tables.filter((t) => t.call).length);
  }
  assert.equal(most, 2);
});

test("ドリンクと延長: 居心地の良い卓ほど追加ドリンクが入り、延長（トップ替え）は満足した客だけが自分から頼む", () => {
  const run = (mood) => {
    let drinks = 0, extends_ = 0, groups = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = serveFirst(createFloorNight({ seed, level: 0 }));
      for (let i = 0; i < 300 && at(s, 1).phase === "enjoy"; i++) {
        at(s, 1).mood = mood; // 検査のため、満足を固定して滞在させる
        if (at(s, 1).call) s = act(s, { type: "care", tableId: 1, verb: CALLS[at(s, 1).call.type].verb });
        at(s, 1).mood = mood;
        s = floorTick(s);
      }
      drinks += at(s, 1).extra ?? 0;
      extends_ += floorBill(s, 1)?.top ? 1 : 0;
      groups += 1;
      if (floorBill(s, 1)?.top) {
        assert.equal(floorBill(s, 1).top, PRICE.top);
        assert.equal(s.counts.extend, 1, "延長は一卓に一度まで");
      }
    }
    return { drinks: drinks / groups, extends: extends_ / groups };
  };
  const [max, good, ok] = [run(95), run(70), run(50)];
  assert.ok(max.drinks > good.drinks && good.drinks > ok.drinks, JSON.stringify([max, good, ok]));
  assert.ok(max.extends > good.extends && max.extends > 0.15 && max.extends < 0.6, JSON.stringify(max));
  assert.equal(ok.extends, 0, "普通の客は延長しない");
});

test("会計: 見送り方を選ぶ。ショップカードは少しの費用でファンが増える。売上と利益は明細と一致する", () => {
  let s = serveFirst(createFloorNight({ seed: 7, level: 0 }));
  s = toBill(s);
  assert.ok(["bill", "order", "call"].includes(floorHint(s).kind));
  const total = floorBill(s, 1).total;
  assert.equal(total, PRICE.charge + PRICE.shisha + PRICE.drink * at(s, 1).drinks + floorBill(s, 1).top, "1名: チャージ＋基本＋ドリンク（初回1杯＋追加）");
  at(s, 1).mood = 70;
  const plain = act(s, { type: "bill", tableId: 1 });
  const card = act(s, { type: "bill", tableId: 1, card: true });
  assert.equal(plain.results.at(-1).total, total);
  assert.equal(card.service - s.service, COST.card);
  assert.ok(card.fans > plain.fans && plain.fans > s.fans);
  assert.equal(at(plain, 1).phase, "cool");
  assert.equal(floorTap(plain, 1), "none");
  // 不満の客にカードを渡しても、ファンは増えない
  at(s, 1).mood = 30;
  assert.equal(act(s, { type: "bill", tableId: 1, card: true }).fans, act(s, { type: "bill", tableId: 1 }).fans);
  // 会計を待たせると、満足が下がっていく
  at(s, 1).mood = 70;
  assert.ok(at(floorTick(s, 40), 1).mood < 70);
  const done = floorResult(act(plain, { type: "finish" }));
  assert.equal(done.sales, done.groups.reduce((sum, g) => sum + g.total, 0));
  assert.equal(done.sales, done.items.charge + done.items.shisha + done.items.drink + done.items.top);
  assert.equal(done.profit, done.sales - done.cost - done.service);
  assert.ok(done.cost > 0);
  assert.equal(done.mixes[0].label, mixLabel(plain.results.find((row) => row.tableId === 1 && row.mix).mix), "好評だったミックスに残る");
});

test("フィーバー: 溜まった段だけ使え、対象の卓は居心地が最高のまま止まり、追加ドリンクが続く", () => {
  let s = createFloorNight({ seed: 5, night: "full", level: 5 });
  for (let i = 0; i < 60; i++) {
    s = floorTick(s);
    for (const table of s.tables) if (table.phase === "order") s = act(s, { type: "order", tableId: table.id, mix: ["apple"] });
  }
  const enjoying = s.tables.filter((t) => t.phase === "enjoy").length;
  assert.ok(enjoying >= 4);
  const low = { ...s, fever: 99 };
  assert.equal(floorAct(low, { type: "fever" }), low, "溜まる前は使えない");
  assert.equal(floorFeverLevel(low), 0);
  assert.deepEqual([100, 250, 300].map((fever) => floorFeverLevel({ ...s, fever })), [1, 2, 3]);
  const one = act({ ...s, fever: 130 }, { type: "fever" });
  assert.equal(one.tables.filter((t) => t.fever).length, 2, "Lv1＝2卓");
  assert.equal(one.fever, 30);
  assert.equal(one.feverLeft, floorFeverLength);
  const two = act({ ...s, fever: 200 }, { type: "fever" });
  assert.equal(two.tables.filter((t) => t.fever).length, 4, "Lv2＝4卓");
  const three = act({ ...s, fever: 300 }, { type: "fever" });
  assert.equal(three.tables.filter((t) => t.fever).length, enjoying, "Lv3＝くつろいでいる全卓");
  assert.equal(floorAct(one, { type: "fever" }), one, "フィーバー中は重ねて使えない");
  const target = one.tables.find((t) => t.fever);
  const base = at(s, target.id).mood;
  const mid = floorTick(one, 12);
  assert.equal(at(mid, target.id).mood, 100);
  assert.equal(at(mid, target.id).call, null);
  assert.equal(at(mid, target.id).stayEnd - mid.t, target.stayEnd - one.t, "滞在の残りは減らない");
  assert.ok(at(mid, target.id).extra > target.extra, "追加ドリンクが入る");
  assert.equal(floorTap(mid, target.id), "info");
  const after = floorTick(one, floorFeverLength);
  assert.equal(after.feverLeft, 0);
  assert.ok(after.log.some((e) => e.type === "feverEnd"));
  assert.ok(at(after, target.id).mood > base && at(after, target.id).mood < 100, "明けた後は、少し上乗せが残る");
  assert.equal(after.fevers, 1);
});

test("定番: 最大8枠。登録・外す・重複なし。保存が壊れていたら、はじめの4つに戻る", () => {
  let s = createFloorNight({ seed: 1, level: 2 });
  assert.deepEqual(s.presets, STARTER_PRESETS.map((m) => [...m]));
  s = act(s, { type: "preset", op: "add", mix: ["grape", "berry"] });
  assert.equal(s.presets.length, STARTER_PRESETS.length + 1);
  assert.equal(floorAct(s, { type: "preset", op: "add", mix: ["berry", "grape"] }), s, "同じ組み合わせは二度登録しない");
  for (const id of ["mango", "lychee", "pine", "rose", "chai"]) s = floorAct(s, { type: "preset", op: "add", mix: [id] });
  assert.equal(s.presets.length, PRESET_MAX);
  s = act(s, { type: "preset", op: "remove", mix: ["apple"] });
  assert.equal(s.presets.length, PRESET_MAX - 1);
  assert.equal(s.t, 0);
  assert.deepEqual(floorPresets([["grape"], ["nothing"], ["grape"], ["lemon", "mint"]]), [["grape"], ["lemon", "mint"]]);
  assert.deepEqual(floorPresets(null), STARTER_PRESETS.map((m) => [...m]));
  assert.equal(createFloorNight({ presets: [["rose", "lychee"]] }).presets.length, 1);
  // 定番の一台は、早く出せる
  const quick = serveFirst(createFloorNight({ seed: 3, level: 0, presets: [["lemon", "mint"]] }), () => ["lemon", "mint"]);
  const slow = serveFirst(createFloorNight({ seed: 3, level: 0, presets: [["apple"]] }), () => ["lemon", "mint"]);
  assert.ok(quick.t < slow.t);
});

test("締め: 時間が来たら残った卓を送り出す。早じまいも出来る。怒って帰した夜は大入りにならない", () => {
  let s = serveFirst(createFloorNight({ seed: 8, level: 1 }));
  const closed = act(s, { type: "finish" });
  assert.ok(closed.done);
  assert.equal(closed.closing, "early");
  assert.equal(floorAct(closed, { type: "fever" }), closed);
  assert.equal(floorTick(closed, 5), closed);
  const result = floorResult(closed);
  assert.equal(result.groups[0].by, "close");
  assert.equal(result.sales, result.groups.reduce((sum, g) => sum + g.total, 0));
  // 誰の注文も聞かない夜: 全員が怒って帰り、評価は最低
  const idle = floorTick(createFloorNight({ seed: 8, level: 1 }), 1000);
  assert.ok(idle.done);
  assert.ok(["time", "clear"].includes(idle.closing));
  const none = floorResult(idle);
  assert.equal(none.rank, "C");
  assert.equal(none.sales, 0);
  assert.ok(none.left >= 5 && none.left === none.came);
  assert.ok(none.fans < 0);
  // 全員を迎えて送り出したら、時間前でも閉まる
  const all = playFloorBot({ seed: 2, level: 0, pace: 2 });
  assert.equal(all.state.closing, "clear");
  assert.ok(all.state.t < all.state.length);
});

test("通し: 注文に合わせて調合すれば大入り、定番だけでも回せる、放っておく夜は評価が低い", () => {
  for (const [night, level] of [["first", 0], ["usual", 1], ["friday", 2], ["rain", 2], ["newcomers", 3], ["full", 5]]) {
    const quick = playFloorBot({ seed: 11, level, night, pace: 2 }).result;
    assert.equal(quick.rank, "S", `${night}: 合わせて調合し、手際よく回せば大入り（${quick.score}）`);
    assert.equal(quick.left, 0);
    assert.equal(quick.sales, quick.groups.reduce((sum, g) => sum + g.total, 0));
    assert.ok(quick.profit < quick.sales && quick.fans > 0);
    assert.ok(quick.mixes.length >= 1 && quick.mixes[0].avg >= quick.mixes.at(-1).avg);
    const preset = playFloorBot({ seed: 11, level, night, pace: 5, pick: "preset" }).result;
    assert.ok(["S", "A", "B"].includes(preset.rank) && preset.score < quick.score, `${night}: 定番だけでも回せる（${preset.rank}）`);
    const slow = playFloorBot({ seed: 11, level, night, pace: 16, pick: "preset" }).result;
    assert.ok(slow.score < preset.score && ["A", "B", "C"].includes(slow.rank), `${night}: 手が遅いと評価は下がる（${slow.rank}）`);
  }
});
