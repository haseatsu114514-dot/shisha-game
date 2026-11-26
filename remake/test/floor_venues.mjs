// 店番ゲーム（フロア営業）の店舗拡大（tonari / mukai / ドバイ中心地のカフェ・Issue #4254）の自動検査。
// 実行: node --test remake/test/floor_venues.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FLOOR_VENUES, FLOOR_VENUE_IDS, MUKAI_GUESTS, MUKAI_NIGHTS, MUKAI_VISITORS, MUKAI_RANKS,
  DUBAI_GUESTS, DUBAI_NIGHTS, DUBAI_VISITORS, DUBAI_RANKS, COMPANION_VISITORS,
  floorVenue, floorVenueBasePay, floorVenueShiftPay, floorVenuePayText,
  floorVenueProgress, recordFloorVenueProgress, floorVenueVisitor, resolveVenueVisitor,
} from "../js/daily/floor-venues.js";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorResult, floorOutlook, floorPlan,
  floorHand, floorMaking, floorOrderWait, floorShuffleLeft, floorShuffleTime, floorCallLine,
  floorVenueTableCount, floorVenueSlots, floorVenueShuffleTime, floorVenueFeverLength, floorVenueLastCall, floorVenuePrice,
  evaluateMix, rateMix, pickNight, mixName, mixNameParts, mixFullName,
} from "../js/daily/tonari-floor-model.js";
import {
  PRICE, FLAVORS, MIXES, WISHES, WISH_IDS, HAND_SIZE, VISITORS, CALLS, SERVE_LINES, SEND_LINES, CALL_MISS, mixIdsFor, mixChapter,
} from "../js/daily/tonari-floor-data.js";
import { STAGES, currentStage } from "../js/daily/tonari-floor-stage.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";
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
const wishOf = (s, tableId) => s.guests[at(s, tableId).guestId].order;

test("店舗データ集約: tonari・mukai・dubai が1か所（FLOOR_VENUES）に揃い、舞台・保存フラグ・夜定義が整合する", () => {
  assert.deepEqual([...FLOOR_VENUE_IDS], ["tonari", "mukai", "dubai"]);
  const validLooks = new Set(["short", "bob", "long", "pony", "bun", "curly", "cap", "hat", "glasses"]);
  for (const id of FLOOR_VENUE_IDS) {
    const v = floorVenue(id);
    assert.equal(v.id, id);
    assert.ok(STAGES[v.stage], `${id}: 舞台 ${v.stage} が STAGES にある`);
    assert.equal(currentStage(v.stage).id, v.stage);
    assert.equal(v.rules.tableCount, 5, `${id}: 暫定5卓で tonari と同一配置`);
    assert.equal(v.rules.shuffle, 4, `${id}: シャッフルは全店舗共通で2秒（4刻み）`);
    assert.deepEqual(v.price, PRICE, `${id}: 暫定は全店舗共通の PRICE`);
    assert.equal(classifyFlag(v.progressFlag), "progression", `${id}: 保存フラグ ${v.progressFlag} は進行`);
    assert.equal(flagVerdict(v.progressFlag), "reset", `${id}: 周回では持ち越さない`);
    for (const g of Object.values(v.guests)) {
      assert.ok(g.party >= 1 && g.party <= 2 && g.look.every((l) => validLooks.has(l)), `${id}.${g.id}: 見た目`);
      if (g.prefPool) {
        assert.ok(g.prefPool.length >= 2, `${id}.${g.id}: 名指し候補がある`);
        const ch = id === "dubai" ? 4 : 3;
        for (const p of g.prefPool) {
          assert.ok(WISH_IDS.includes(p.wish) && p.label && !p.quote.endsWith("。"), `${id}.${g.id}: ${p.quote}`);
          assert.ok(p.has.every((f) => FLAVORS[f]), `${id}.${g.id}: 実在フレーバー`);
          assert.ok(mixIdsFor(ch).some((m) => rateMix(m, { ...p, pref: { label: p.label, has: p.has } }) === "best"), `${id}.${g.id}: ${p.label} に◎がある`);
        }
      }
    }
    for (const n of Object.values(v.nights)) {
      assert.equal(n.cast.length, n.arrive.length, `${id}.${n.id}`);
      assert.ok(n.cast.every((kind) => v.guests[kind]), `${id}.${n.id}: 客種が定義済み`);
      assert.ok(n.arrive.every((t, i) => i === 0 || t >= n.arrive[i - 1]), `${id}.${n.id}: 来店順`);
      assert.ok(n.arrive.at(-1) < n.length - v.rules.lastCall, `${id}.${n.id}: ラストオーダー前に最後の客が来る`);
    }
    assert.deepEqual(v.ranks.map((r) => r.id), ["S", "A", "B", "C"]);
    assert.ok(v.ranks.every((r) => r.line && !r.line.endsWith("。")), `${id}: 講評は台詞なので句点で終えない`);
  }
  assert.ok(MUKAI_GUESTS && MUKAI_NIGHTS && MUKAI_RANKS && DUBAI_GUESTS && DUBAI_NIGHTS && DUBAI_RANKS);
});

test("拡張性: 店舗データの差し替え（卓数6・独自単価・独自基本給）だけでモデルが切り替わる", () => {
  const custom = {
    id: "future_lounge",
    name: "将来の6卓店",
    price: { shisha: 3000, charge: 1000, top: 2000, drink: 800 },
    entry: { basePay: 15000, commissionPercent: 10 },
    rules: { tableCount: 6, slots: 3 },
  };
  let s = createFloorNight({ venue: custom, seed: 5, level: 2, chapter: 3 });
  assert.equal(s.tables.length, 6);
  assert.equal(floorVenueTableCount(s), 6);
  assert.equal(floorVenueSlots(s), 3);
  assert.equal(floorVenuePrice(s).shisha, 3000);
  // structuredClone 互換（状態に関数を持たない）
  assert.deepEqual(structuredClone(s), s);
  s = until(s, (x) => at(x, 1).phase === "order");
  s = act(s, { type: "order", tableId: 1, mix: s.hand[0] });
  s = until(s, (x) => at(x, 1).phase === "enjoy");
  const done = floorResult(act(s, { type: "finish" }), 1000);
  assert.equal(done.sales, 1000 + 800 + 3000);
  assert.deepEqual(done.pay, { base: 15000, commission: 480, allowances: 1000, total: 16480 });
});

test("第3章のフレーバー5種・ミックス18種: 本編データと整合し、第1・2章の並びを壊さない", () => {
  const game = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors.map((f) => [f.id, f]));
  const addedFlavors = ["lime", "biscuit", "pistachio", "mountain_mist", "nightside_blast_mint"];
  for (const id of addedFlavors) {
    assert.ok(FLAVORS[id] && game[id], id);
    assert.equal(FLAVORS[id].chapter, 3, `${id} は第3章解禁`);
    assert.equal(game[id].chapter_min, 3, `${id} は本編も第3章解禁`);
    assert.ok(Object.values(MIXES).some((m) => m.flavors.includes(id)), `${id} を使うミックスがある`);
  }
  const ch3Only = mixIdsFor(3).filter((id) => mixChapter(id) === 3);
  assert.equal(ch3Only.length, 18, "第3章追加ミックスは18種");
  assert.equal(mixIdsFor(3).length, mixIdsFor(2).length + 18);
  for (const wish of WISH_IDS) {
    assert.ok(ch3Only.some((id) => MIXES[id].main === wish), `第3章追加ミックスに ${wish} メインがある`);
  }
  assert.ok(ch3Only.some((id) => MIXES[id].flavors.length === 1));
  assert.ok(ch3Only.some((id) => MIXES[id].flavors.length === 2));
  assert.ok(ch3Only.some((id) => MIXES[id].flavors.length === 3));
  assert.equal(mixName("luqaimat"), "ルカイマット");
  assert.deepEqual(mixNameParts("mountainmist"), ["マウンテン", "ミスト単"]);
  assert.equal(mixFullName("pistachiolatte"), "ピスタチオラテ（ピスタチオ・コーヒー・ミルク）");
});

test("店舗ごとの難易度差: 待ち時間・sight移行・仕込み枠・VIPの3種優遇/単品減点・評価ラインが切り替わる", () => {
  const t0 = createFloorNight({ venue: "tonari", seed: 7, level: 0, chapter: 1 });
  const m0 = createFloorNight({ venue: "mukai", seed: 7, level: 0, chapter: 3 });
  const d0 = createFloorNight({ venue: "dubai", seed: 7, level: 0, chapter: 4 });
  assert.ok(floorOrderWait(t0) > floorOrderWait(m0) && floorOrderWait(m0) > floorOrderWait(d0), "初回待ち時間: tonari > mukai > dubai");

  const t2 = createFloorNight({ venue: "tonari", seed: 7, level: 2, chapter: 2 });
  const m2 = createFloorNight({ venue: "mukai", seed: 7, level: 2, chapter: 3 });
  const d2 = createFloorNight({ venue: "dubai", seed: 7, level: 2, chapter: 4 });
  assert.ok(floorOrderWait(t2) > floorOrderWait(m2) && floorOrderWait(m2) > floorOrderWait(d2), "通常待ち時間: tonari > mukai > dubai");

  // 様子読み（sight）への移行タイミング
  assert.deepEqual([t0.hint, createFloorNight({ venue: "tonari", level: 2 }).hint, createFloorNight({ venue: "tonari", level: 3 }).hint], ["said", "said", "sight"]);
  assert.deepEqual([m0.hint, createFloorNight({ venue: "mukai", level: 1, chapter: 3 }).hint], ["said", "sight"]);
  assert.equal(d0.hint, "sight", "ドバイは言葉の壁があるため初回から様子読み");

  // 同時仕込み枠（tonari・mukai＝2台、dubai＝3台）
  assert.deepEqual([floorVenueSlots(t2), floorVenueSlots(m2), floorVenueSlots(d2)], [2, 2, 3]);
  let dFull = createFloorNight({ venue: "dubai", seed: 3, level: 2, chapter: 4, night: "full" });
  for (const id of [1, 2, 3]) {
    dFull = until(dFull, (x) => at(x, id).phase === "order", 60);
    dFull = act(dFull, { type: "order", tableId: id, mix: dFull.hand[0] });
  }
  const dMaking = floorMaking(dFull);
  if (dMaking.length >= 3) assert.deepEqual(dMaking.slice(0, 3).map((m) => m.active), [true, true, true], "ドバイは3台同時に仕込める");

  // ドバイのVIP・語らい組（wantRich）: 3種ミックス◎で加点、単品◎で減点
  const dubaiRules = floorVenue("dubai").rules;
  const vipGuest = { rank: "keen", wantRich: true };
  const deepOrder = { wish: "deep" };
  const singleDeep = evaluateMix("earlgrey", deepOrder, vipGuest, dubaiRules).mood;
  const pairDeep = evaluateMix("rosejasmine", deepOrder, vipGuest, dubaiRules).mood;
  const richDeep = evaluateMix("flowergarden", deepOrder, vipGuest, dubaiRules).mood;
  assert.ok(singleDeep < pairDeep && pairDeep < richDeep, `wantRich: 単品(${singleDeep}) < 2種(${pairDeep}) < 3種(${richDeep})`);

  // ドバイの評価ライン（S=90）は tonari/mukai（S=88）より厳しい
  const d89 = { ...d2, results: [{ mood: 89, left: false }] };
  const m89 = { ...m2, results: [{ mood: 89, left: false }] };
  assert.deepEqual([floorResult(m89).rank, floorResult(d89).rank], ["S", "A"]);
  assert.equal(floorOutlook(d89).next.need, 1);

  // ドバイの市場帰りの早期喉渇き・VIPの2回ケア
  let dHeat = createFloorNight({ venue: "dubai", seed: 5, level: 2, chapter: 4, night: "heat_day" });
  dHeat = until(dHeat, (x) => at(x, 1).phase === "order");
  assert.equal(dHeat.guests[at(dHeat, 1).guestId].fastThirsty, true);
  dHeat = act(dHeat, { type: "order", tableId: 1, mix: dHeat.hand[0] });
  dHeat = until(dHeat, (x) => at(x, 1).phase === "enjoy");
  assert.equal(at(dHeat, 1).wants[0]?.type, "thirsty");
  let dMajlis = createFloorNight({ venue: "dubai", seed: 5, level: 2, chapter: 4, night: "majlis" });
  dMajlis = until(dMajlis, (x) => at(x, 2).phase === "order", 60);
  assert.equal(dMajlis.guests[at(dMajlis, 2).guestId].callsPerStay, 2);
  dMajlis = act(dMajlis, { type: "order", tableId: 2, mix: dMajlis.hand[0] });
  dMajlis = until(dMajlis, (x) => at(x, 2).phase === "enjoy");
  assert.equal(at(dMajlis, 2).wants.length, 2, "VIPは1滞在で2回のケア欲求を持つ");

  // 営業予報・種別抽選が店舗ごとに切り替わる
  assert.equal(pickNight(0, 1, { venue: "mukai" }).id, "first");
  assert.equal(pickNight(3, 1, { venue: "mukai", rainy: true }).id, "rain");
  assert.equal(floorPlan(d0).title, "ドバイの初シフト");
  for (const s of [t2, m2, d2]) {
    assert.equal(floorVenueFeverLength(s), 30);
    const opened = createFloorNight({ venue: s.venue, chapter: s.chapter, level: 3, seed: 0xffffffff });
    assert.ok(floorVenue(s.venue).nightPool.early.includes(opened.night));
  }
  assert.equal(floorVenueLastCall(d2), 40);
});

test("シャッフルと心得の盤（floorMatch・floorTop・floorRare）が mukai・ドバイでも共通で機能する", () => {
  for (const [venue, chapter, night] of [["mukai", 3, "full"], ["dubai", 4, "full"]]) {
    let s = createFloorNight({ venue, seed: 9, level: 2, chapter, night });
    assert.equal(floorVenueShuffleTime(s), floorShuffleTime);
    s = until(s, (x) => at(x, 1).phase === "order");
    const prevHand = [...s.hand];
    const served = prevHand[2];
    const afterOrder = act(s, { type: "order", tableId: 1, mix: served });
    assert.deepEqual(afterOrder.hand.filter((_, i) => i !== 2), prevHand.filter((_, i) => i !== 2), `${venue}: 提供した枠だけ入れ替わる`);
    assert.ok(!afterOrder.hand.includes(served));

    // floorMatch: 通常注文への初回シャッフル◎率が上がる
    const trials = 160;
    const countMatch = (floorMatch) => {
      let hits = 0;
      for (let seed = 1; seed <= trials; seed++) {
        let x = until(createFloorNight({ venue, seed, level: 3, chapter, night, floorPerks: { floorMatch } }), (y) => at(y, 1).phase === "order");
        // 通常注文に揃えて測定
        x.guests[at(x, 1).guestId].order = { wish: "fruit", quote: "フルーツ系が吸いたいな" };
        x = act(x, { type: "shuffle", tableId: 1 });
        assert.equal(floorShuffleLeft(x), 4);
        if (floorHand(x, wishOf(x, 1)).some((m) => m.rating === "best")) hits++;
      }
      return hits;
    };
    const baseHits = countMatch(0), trainedHits = countMatch(20);
    assert.ok(trainedHits > baseHits + trials * 0.08, `${venue}: floorMatch が効く（${baseHits} → ${trainedHits}）`);

    // floorTop: おかわり発生率が上がる
    let baseS = until(createFloorNight({ venue, seed: 5, level: 1, chapter }), (y) => at(y, 1).phase === "order");
    baseS = act(baseS, { type: "order", tableId: 1, mix: baseS.hand[0] });
    baseS = until(baseS, (y) => at(y, 1).phase === "enjoy");
    const countRefill = (floorTop) => {
      let n = 0;
      for (let rolls = 0; rolls < 256; rolls++) {
        const x = structuredClone(baseS);
        x.floorPerks.floorTop = floorTop;
        x.rolls = rolls;
        Object.assign(at(x, 1), { mood: 100, stayEnd: x.t, call: null, wants: [] });
        if (at(floorTick(x), 1).refill) n++;
      }
      return n;
    };
    assert.ok(countRefill(10) > countRefill(0), `${venue}: floorTop が効く`);
  }

  // レア客の好物保証（別の卓を選んでシャッフルしてもレア客の◎を1枠確保）
  for (const [venue, chapter, visitor] of [["mukai", 3, "steve"], ["dubai", 4, "noor"]]) {
    let s = createFloorNight({ venue, seed: 4, level: 2, chapter, night: "full", visitor });
    s = until(s, (x) => x.tables.some((t) => t.guestId === "g3") && at(x, 1).phase === "order", 200);
    const rareTable = s.tables.find((t) => t.guestId === "g3");
    const otherId = rareTable.id === 1 ? 2 : 1;
    const shuffled = act(s, { type: "shuffle", tableId: otherId });
    assert.ok(floorHand(shuffled, s.guests.g3.order).some((m) => m.rating === "best"), `${venue}: 他卓選択中でもレア客 ${visitor} の好物を1枠確保`);
  }
});

test("日当計算式（基本給＋売上歩合10%＋手当）が全店舗・全章で統一されている", () => {
  const expectedBases = [8000, 10000, 12000, 14000, 16000];
  for (const venue of FLOOR_VENUE_IDS) {
    for (const [idx, base] of expectedBases.entries()) {
      const chapter = idx + 1;
      assert.equal(floorVenueBasePay(venue, chapter), base);
      assert.deepEqual(floorVenueShiftPay(venue, chapter, 15678, 1200), {
        base, commission: 1567, allowances: 1200, total: base + 1567 + 1200,
      });
      assert.match(floorVenuePayText(venue, chapter), new RegExp(`基本給${base.toLocaleString("ja-JP")}円＋売上の10%`));
    }
  }
  const mCh3 = createFloorNight({ venue: "mukai", chapter: 3 }); mCh3.sales = 20000;
  const mCh5 = createFloorNight({ venue: "mukai", chapter: 5 }); mCh5.sales = 20000;
  const dCh4 = createFloorNight({ venue: "dubai", chapter: 4 }); dCh4.sales = 20000;
  assert.deepEqual([floorResult(mCh3, 5000).pay.total, floorResult(mCh5).pay.total, floorResult(dCh4).pay.total], [19000, 18000, 16000]);
});

test("レア来店者（mukai・ドバイ・同行恋人）: 固有口調17種・ネタバレ無し・面識と好感度と章の条件を守る", () => {
  assert.equal(MUKAI_VISITORS.emil, undefined, "エミルは来店客に出さない");
  assert.equal(MUKAI_VISITORS.mashiro, undefined, "ましろは店のスタッフなので来店客に出さない");
  assert.equal(MUKAI_VISITORS.mukai_master, undefined, "ムカイさんは店長なので来店客に出さない");
  assert.deepEqual([...DUBAI_VISITORS.sheikh.chapters], [5], "シェイクは第4章の正体秘匿を守り第5章のみ");
  assert.ok(DUBAI_VISITORS.da_silva && DUBAI_VISITORS.master_hookah && DUBAI_VISITORS.noor && DUBAI_VISITORS.naru);
  assert.ok(MUKAI_VISITORS.ayatori && MUKAI_VISITORS.steve && MUKAI_VISITORS.volk && MUKAI_VISITORS.yoru);

  const mobSays = new Set([
    ...WISHES.flatMap((w) => w.say), ...Object.values(SERVE_LINES).flat(), ...SEND_LINES.extend,
    ...SEND_LINES.bye, SEND_LINES.byeLow, SEND_LINES.mad, CALL_MISS, ...Object.values(CALLS).flatMap((c) => [c.said, c.good]),
  ]);
  const allNew = [...Object.values(MUKAI_VISITORS), ...Object.values(DUBAI_VISITORS), ...Object.values(COMPANION_VISITORS)];
  const quotes = new Set();
  for (const who of allNew) {
    const own = [
      who.order.quote, who.refill.quote,
      ...["best", "good", "off", "miss", "check", "skip", "bye", "byeLow", "mad"].map((k) => who.lines[k]),
      ...["thin", "harsh", "thirsty"].flatMap((k) => [who.lines.calls[k].said, who.lines.calls[k].good]),
    ];
    assert.equal(own.length, 17, `${who.id}: 17種の台詞`);
    for (const line of own) {
      assert.ok(line && !line.endsWith("。") && !mobSays.has(line), `${who.id}: ${line}`);
      quotes.add(line);
    }
    assert.ok(!/大会|本番|優勝|予選|審査員|王族/.test(own.join("")), `${who.id}: 大会・審査・正体のネタバレ無し`);
    for (const order of [who.order, who.refill]) {
      assert.ok(order.label && order.has.length >= 1 && order.has.every((f) => FLAVORS[f]), `${who.id}: ${order.label}`);
      for (const ch of who.chapters) {
        assert.ok(mixIdsFor(ch).some((id) => rateMix(id, { ...order, pref: { label: order.label, has: order.has } }) === "best"), `${who.id} 第${ch}章: ◎あり`);
      }
    }
  }
  assert.equal(quotes.size, allNew.length * 17, "新規来店客の台詞がすべて重複しない");

  // 第4章ドバイでは sheikh は選ばれない。同行恋人（extraVisitorIds）は7ヒロイン全員が解決できる
  for (const heroine of ["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori"]) {
    assert.ok(resolveVenueVisitor("dubai", heroine), `同行恋人 ${heroine} がドバイで解決できる`);
  }
  const dOwner = {
    chapter: 4, day: 50, weatherSeed: 12,
    met: { naru: true, noor: true, da_silva: true, master_hookah: true, sheikh: true },
    affinity: { naru: 20, noor: 20, da_silva: 20, master_hookah: 20, sheikh: 50 },
    flags: {},
  };
  const dSeen = new Set();
  for (let day = 1; day <= 300; day++) {
    dOwner.day = day;
    const v = floorVenueVisitor(dOwner, "dubai", day * 97, 2, 0, {
      affinityLevel: (id) => ((dOwner.affinity[id] || 0) >= 9 ? 1 : 0),
      extraVisitorIds: ["mashiro"],
    });
    if (v) dSeen.add(v);
  }
  assert.ok(!dSeen.has("sheikh"), "第4章ドバイではシェイクは来店しない");
  assert.ok(dSeen.has("mashiro") && dSeen.has("noor") && dSeen.has("da_silva"), "同行恋人と条件を満たすドバイ人物が来店する");

  // mukai の floorRare 加算と針間ヨルの面識のみ条件
  const mOwner = { chapter: 3, day: 30, weatherSeed: 5, met: {}, affinity: {}, flags: { _club_yoru_first_done: true } };
  let baseCount = 0, bonusCount = 0;
  for (let day = 1; day <= 200; day++) {
    mOwner.day = day;
    if (floorVenueVisitor(mOwner, "mukai", day * 31, 1, 0, { affinityLevel: () => 0 }) === "yoru") baseCount++;
    if (floorVenueVisitor(mOwner, "mukai", day * 31, 1, 15, { affinityLevel: () => 0 }) === "yoru") bonusCount++;
  }
  assert.ok(baseCount >= 15 && bonusCount > baseCount, `mukai の floorRare が効く（${baseCount} → ${bonusCount}）`);
  assert.equal(floorVenueVisitor(mOwner, "mukai", 123, 0, 50, { affinityLevel: () => 5 }), null, "初回営業には来店しない");
  // ドバイのレア来店客の会話が floorCallLine で反映される
  let ds = createFloorNight({ venue: "dubai", seed: 5, level: 2, chapter: 4, visitor: "da_silva" });
  assert.equal(ds.visitor, "da_silva");
  ds = until(ds, (x) => x.tables.some((t) => t.guestId === "g3"), 200);
  const tid = ds.tables.find((t) => t.guestId === "g3").id;
  const liked = mixIdsFor(4).find((id) => MIXES[id].flavors.includes("passion_fruit"));
  ds.hand[0] = liked;
  ds = act(ds, { type: "order", tableId: tid, mix: liked });
  ds = until(ds, (x) => at(x, tid).phase === "enjoy", 60);
  ds = until(ds, (x) => !!at(x, tid).call, at(ds, tid).stayEnd - ds.t);
  assert.equal(at(ds, tid).call.type, "thirsty");
  assert.equal(floorCallLine(ds, tid).said, DUBAI_VISITORS.da_silva.lines.calls.thirsty.said);
});

test("店舗ごとの進み具合記録（_mukai_floor / _dubai_floor）が独立して更新される", () => {
  const account = { flags: {} };
  assert.deepEqual(floorVenueProgress(account, "mukai"), { nights: 0, best: null, fans: 0, top: 0 });
  recordFloorVenueProgress(account, "mukai", { rank: "A", fans: 8, sales: 24000 });
  assert.deepEqual(account.flags._mukai_floor, { nights: 1, best: "A", fans: 8, top: 24000 });
  assert.equal(account.flags._dubai_floor, undefined, "他店舗の記録には影響しない");
  recordFloorVenueProgress(account, "mukai", { rank: "B", fans: -20, sales: 18000 });
  assert.deepEqual(account.flags._mukai_floor, { nights: 2, best: "A", fans: 0, top: 24000 }, "最高評価と最高売上は下がらず、ファンは0未満にならない");
  recordFloorVenueProgress(account, "dubai", { rank: "S", fans: 15, sales: 41000 });
  assert.deepEqual(account.flags._dubai_floor, { nights: 1, best: "S", fans: 15, top: 41000 });
  assert.equal(recordFloorVenueProgress(account, "dubai", { fallback: true, sales: 0 }), null, "フォールバックは記録を進めない");
  assert.equal(account.flags._dubai_floor.nights, 1);
});

test("通しプレイ: mukai・ドバイとも手際よい接客が雑な接客・放置を上回り、売上明細が一致する", () => {
  for (const [venue, chapter, nights] of [
    ["mukai", 3, [["first", 0], ["usual", 1], ["rush", 2], ["keen_day", 3], ["full", 5]]],
    ["dubai", 4, [["first", 0], ["usual", 1], ["heat_day", 2], ["majlis", 3], ["full", 5]]],
  ]) {
    for (const [night, level] of nights) {
      const quick = playFloorBot({ venue, chapter, seed: 11, level, night, pace: 2 }).result;
      assert.equal(quick.venue, venue);
      assert.equal(quick.sales, quick.groups.reduce((sum, g) => sum + g.total, 0), `${venue}/${night}: 売上＝卓合計`);
      assert.equal(quick.sales, quick.items.charge + quick.items.shisha + quick.items.drink + quick.items.top, `${venue}/${night}: 売上＝明細合計`);
      assert.equal(quick.pay.total, floorVenueBasePay(venue, chapter) + Math.floor(quick.sales * 10 / 100));
      assert.ok(quick.score >= (night === "full" ? 60 : 70) && quick.served >= 6, `${venue}/${night}: 手際よく回せば高評価（${quick.score}）`);
      const blind = playFloorBot({ venue, chapter, seed: 11, level, night, pace: 3, pick: "first" }).result;
      assert.ok(blind.score < quick.score, `${venue}/${night}: 気分を見ないと下がる（${blind.score} < ${quick.score}）`);
      const lazy = playFloorBot({ venue, chapter, seed: 11, level, night, pace: 2, tend: false }).result;
      assert.ok(lazy.score <= quick.score && lazy.counts.tendLate >= 1, `${venue}/${night}: 調整に行かないと下がる`);
      const idle = playFloorBot({ venue, chapter, seed: 11, level, night, pace: 16, pick: "first" }).result;
      assert.ok(idle.score < quick.score && idle.pay.commission < quick.pay.commission, `${venue}/${night}: 放置より手際よい方が歩合も高い`);
    }
  }
  assert.ok(bestMix(createFloorNight({ venue: "mukai", chapter: 3 }), { wish: "fruit" }));
});

test("本編導線と境界の整合: mukai・ドバイ接続済み、共用ブース（ch4-staff-work）は必須チェックポイントとして維持", () => {
  const mukaiSrc = readFileSync(new URL("../js/chapters/tokyo-mukai.js", import.meta.url), "utf8");
  const ch3Src = readFileSync(new URL("../js/chapters/ch3-tokyo-daily.js", import.meta.url), "utf8");
  const ch5Src = readFileSync(new URL("../js/chapters/ch5-tokyo.js", import.meta.url), "utf8");
  const ch4Src = readFileSync(new URL("../js/chapters/ch4-dubai-daily.js", import.meta.url), "utf8");
  const staffSrc = readFileSync(new URL("../js/chapters/ch4-staff-work.js", import.meta.url), "utf8");

  assert.match(mukaiSrc, /runVenueFloorShift/);
  assert.match(mukaiSrc, /venue: "mukai"/);
  assert.match(ch3Src, /mukaiShiftPayText/);
  assert.match(ch3Src, /holdSaveUntilActionEnds/);
  assert.match(ch5Src, /mukaiShiftPayText/);
  assert.match(ch5Src, /holdSaveUntilActionEnds/);
  assert.match(ch4Src, /dubaiShiftUnlocked/);
  assert.match(ch4Src, /dubaiShiftOpen/);
  assert.match(ch4Src, /venue: "dubai"/);
  assert.match(ch4Src, /_shift_through_night/);
  assert.doesNotMatch(staffSrc, /floor-shift|tonari-floor/, "共用ブースは必須チェックポイントのまま維持");
});
