// カードゲーム「一台勝負」の規則とCPU（ブラウザ不要）。
//   1. ゲーム内のカードの名前・数値・文が、ルールブック（docs/design/card_game/cards.js）と同じ
//   2. 組み済みの一式が40枚・同名3枚まで（フラット炭とキューブ炭を除く）・人物1枚まで
//   3. 採点（帯・加点・焦げ）と、炭の動き（着火・冷める・火持ち）が規則どおり
//   4. CPUどうしの対戦が、規則違反の入力なしで最後まで進む（カードは1ラウンドに1枚まで）
//   5. 3人・4人の対戦（1:1:1:1）: 手番は席の順・一票はいちばん高い1人・相手を1人ねらうカードは相手を選ぶ
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { FLAVORS, FLAVOR, CARDS, CARD, BOWLS, HMDS, JUDGES, PUFFS, TOURNAMENTS, KITS, TYPE_LABEL, WHEN_LABEL, RARITIES, SERIES_SIZE, numberOf, rarityOf, expandDeck } from "../js/minigames/ichidai-data.js";
import { RULES, createGame, act, heatOf, coalHeat, coalMaxOf, leavesOf, firepower, coolStepsOf, slotsOf, scorePuff, judgedHeat, roundsOf, canPlay, impressionOf, rivalsOf, targetsOf, targetOf, pileOf } from "../js/minigames/ichidai-rules.js";
import { aiAct } from "../js/minigames/ichidai-ai.js";

const DOC = createRequire(import.meta.url)("../../docs/design/card_game/cards.js");

// ── 1. ルールブックとの一致 ──
{
  assert.equal(FLAVORS.length, DOC.FLAVORS.length);
  for (const d of DOC.FLAVORS) {
    const f = FLAVOR[d.id]; assert.ok(f, `葉 ${d.id}`);
    assert.deepEqual([f.name, f.brand, f.kind, f.t, f.lo, f.hi, f.j, f.s, f.pair, f.ab], [d.n, d.b, d.k, d.t, d.lo, d.hi, d.j, d.s, d.pair, d.ab], `葉 ${d.n}`);
  }
  const byName = Object.fromEntries(CARDS.map((c) => [c.name, c]));
  assert.equal(CARDS.length, DOC.SUPPORT.length);
  for (const d of DOC.SUPPORT) {
    const c = byName[d.n]; assert.ok(c, `カード ${d.n}`);
    assert.equal(TYPE_LABEL[c.type], d.type, `${d.n} の種類`);
    assert.equal(c.tx, d.tx, `${d.n} の文`);
    if (c.type === "coal") assert.deepEqual([c.ig, c.heat], [d.ig, d.heat], `${d.n} の着火と熱`);
    else {
      assert.equal(WHEN_LABEL[c.when], d.when, `${d.n} の使える時`);
      assert.equal(c.need, d.need, `${d.n} の必要火力`);
    }
  }
  for (const [list, doc] of [[BOWLS, DOC.BOWLS], [HMDS, DOC.HMDS]]) {
    assert.equal(list.length, doc.length);
    list.forEach((x, i) => assert.deepEqual([x.name, x.cap, x.ab], [doc[i].n, doc[i].cap, doc[i].ab], x.name));
  }
  for (const d of DOC.JUDGES) {
    const j = JUDGES.find((x) => x.id === d.id); assert.ok(j, d.n);
    assert.deepEqual([j.name, j.motto, j.bonus], [d.n, d.t, d.tx], d.n);
    assert.deepEqual(j.puffs.map(([pid, n]) => [PUFFS[pid].style, n]), d.puffs.map((q) => [q.style, q.c]), `${d.n} の審査カード`);
  }
  for (const [k, q] of Object.entries(DOC.PUFF)) assert.deepEqual([PUFFS[k].style, PUFFS[k].tx, PUFFS[k].dh, PUFFS[k].just, PUFFS[k].band, PUFFS[k].offZero], [q.style, q.stx, q.dh, q.just, q.band, q.offZero], q.style);
  assert.deepEqual(TOURNAMENTS.map((t) => [t.name, t.sessions, t.judges, t.task]), DOC.TOURNAMENTS.map((t) => [t.n, t.s, t.judges, t.task]));
}

// ── 2. 組み済みの一式 ──
for (const kit of KITS) {
  const deck = expandDeck(kit.cards);
  assert.equal(deck.length, 40, `${kit.name} は40枚`);
  for (const [id, n] of kit.cards) {
    assert.ok(CARD[id], `${kit.name}: ${id}`);
    assert.notEqual(id, "repack", "まだ動かないカードは入れない");
    if (id !== "flat" && id !== "cube") assert.ok(n <= (CARD[id].type === "person" ? 1 : 3), `${kit.name}: ${CARD[id].name} が多い`);
  }
  assert.ok(BOWLS.some((b) => b.id === kit.bowl) && HMDS.some((h) => h.id === kit.hmd));
  assert.ok(kit.plan.reduce((a, [, n]) => a + n, 0) <= BOWLS.find((b) => b.id === kit.bowl).cap, `${kit.name} の葉が容量に収まる`);
}

// ── 3. 採点と炭 ──
const fake = (over = {}) => ({ bowl: { mango: 6, vanilla: 3 }, main: "mango", bowlId: "funnel", hmd: "lotus", tools: [], person: null, zone: [], stove: [],
  pend: 0, sessMod: 0, usedLotus: true, usedSilicone: false, ...over });
{
  const p = fake(), q = PUFFS.normal;
  assert.deepEqual([6, 5, 4, 3, 7].map((h) => scorePuff(p, h, q).zone), ["just", "band", "off", "cold", "scorch"]);
  assert.equal(scorePuff(p, 6, q).pts, 8, "味値4＋ジャスト2＋ミックス1＋相性1");
  assert.equal(scorePuff(p, 5, q).pts, 6);
  assert.equal(scorePuff(p, 4, q).pts, 1);
  assert.equal(scorePuff(p, 4, PUFFS.measure).pts, 0, "温度を測る: ズレは0点");
  assert.equal(scorePuff(p, 6, PUFFS.measure).pts, 9, "温度を測る: ジャスト+1");
  assert.equal(scorePuff(p, 5, PUFFS.happy).pts, 7, "にこにこ吸う: 適温+1");
  assert.equal(scorePuff(fake({ bowl: { mango: 7, vanilla: 3 } }), 6, q).pts, 9, "10枚で濃厚+1");
  assert.equal(scorePuff(p, 7, q, { blow: true }).zone, "band", "ブロー: 焦げない。焦げライン以上なら適温として採点");
  assert.equal(scorePuff(fake({ usedLotus: false }), 4, q).zone, "band", "ロートスHMD: ズレを適温に");
  assert.equal(scorePuff(fake({ bowlId: "silicone" }), 7, q).zone, "off", "シリコンボウル: 焦げを取り消す");
  assert.equal(scorePuff(fake({ bowl: { rose: 6, mint: 2 }, main: "rose" }), 5, q).zone, "off", "ミントの【クッション】で焦げラインが6に");
  // ダブルアップル（第0.5版）: ジャストは熱7だけ。単品なら【原点】で毎口+1
  const da = (over = {}) => fake({ bowl: { double_apple: 12 }, main: "double_apple", bowlId: "clay", person: "adam", ...over });
  assert.deepEqual([6, 7, 8, 9, 10].map((h) => scorePuff(da(), h, q).zone), ["band", "just", "band", "off", "scorch"], "ダブルアップルのジャストは7だけ");
  assert.equal(scorePuff(da(), 7, q).pts, 9, "単品: 味値3＋ジャスト2＋濃厚1＋素焼き1＋アダム1＋原点1");
  assert.equal(scorePuff(da(), 6, q).pts, 7, "適温でも【原点】は付く");
  assert.equal(scorePuff(da({ bowl: { double_apple: 10, mint: 2 }, bowlId: "funnel", person: null }), 7, q).parts.some((x) => x.label === "原点"), false, "ほかの葉が混ざると【原点】は付かない");
  assert.equal(judgedHeat(fake({ hmd: "amaburst", zone: [{ id: "x", up: false }], pend: 1, sessMod: 1 }), PUFFS.long, -1), 1 + 1 + 1 + 1 + 1 - 1);
  assert.equal(judgedHeat(fake({ bowl: { lavender: 8 }, main: "lavender", zone: [], pend: 2 }), PUFFS.normal), 0, "ラベンダーの【鎮静】");
}
{
  // 着火: フラットは1ターン、キューブは2ターン。冷める: 1ターンに炭1つの火が1下がる（第0.5版）
  const G = createGame({ seed: 7, tournament: "practice", first: 0, players: [{ kit: "a" }, { kit: "b" }] });
  const [p, o] = G.P;
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  const no = (a, why) => assert.equal(act(G, a).ok, false, why);
  assert.equal(p.hand.length, 7);
  no({ type: "embers", picks: [] }, "立ち上げの炭は1枚以上"); no({ type: "embers", picks: [0, 1, 2, 3, 4] }, "立ち上げの炭は4枚まで（炭は4つまで）");
  ok({ type: "embers", picks: [0, 1, 2] }); ok({ type: "embers", picks: [0, 1, 2] });
  assert.deepEqual([heatOf(p), heatOf(o), p.hand.length, G.wait.type, G.wait.player], [3, 3, 4, "prep", 0]);
  no({ type: "pack", picks: { lemon: 3 } }, "先手の最初の詰めるは2枚まで");
  no({ type: "steam" }, "葉が8枚ないと蒸らせない");
  no({ type: "end" }, "詰めるか蒸らすかを選ぶ");
  ok({ type: "pack", picks: { lemon: 2 } }); no({ type: "charge", hand: 0 }, "詰めるターンは炭に触れない"); ok({ type: "end" });
  no({ type: "pack", picks: { lemon: 2, mint: 1, rose: 1 } }, "2種類まで");
  ok({ type: "pack", picks: { double_apple: 4 } }); ok({ type: "end" });
  for (let t = 0; t < 2; t++) { ok({ type: "pack", picks: t ? { mint: 4 } : { lemon: 4 } }); ok({ type: "end" }); ok({ type: "pack", picks: { double_apple: 4 } }); ok({ type: "end" }); }
  assert.deepEqual([leavesOf(p), leavesOf(o), p.main, G.supply.double_apple], [10, 12, "lemon", 0]);
  // 手札を入れ替えて、炭の動きを決め打ちで確かめる
  p.hand = ["flat", "cube", "heat_in", "all_in"]; p.deck.push("blow", "blow", "blow", "blow", "blow", "blow");
  ok({ type: "steam" });
  assert.equal(p.hand.length, 6, "蒸らす：2枚引く");
  ok({ type: "place", hand: p.hand.indexOf("flat") }); ok({ type: "place", hand: p.hand.indexOf("cube") });
  assert.deepEqual(p.stove.map((c) => c.stage), [1, 0], "フラットは縦向き、キューブは横向きで置く");
  no({ type: "puton", stove: 0 }, "まだ焼けていない");
  ok({ type: "charge", hand: p.hand.indexOf("blow") });
  assert.deepEqual([heatOf(p), p.hand.length], [4, 4], "チャージ＆ドロー: そのターン最初のチャージは、1枚置いて1枚引く（手札の枚数は変わらない）");
  no({ type: "charge", hand: 0 }, "炭は4つまで（種火も1つに数える）");
  ok({ type: "end" }); ok(aiAct(G, 1)); while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.deepEqual(p.stove.map((c) => c.stage), [2, 1], "次のターンにフラットが焼け、キューブは縦向きに");
  ok({ type: "steam" });
  no({ type: "puton", stove: 0 }, "枠が空いていないと、焼けた炭をのせられない");
  ok({ type: "ash", zone: 0 }); // 立ち上げ: 種火を1つ外して、焼けたフラット炭（火2）と入れ替える
  ok({ type: "puton", stove: 0 });
  assert.deepEqual([heatOf(p), p.zone.at(-1).up, coalHeat(p.zone.at(-1)), p.zone.length], [5, true, 2, 4], "種火3つ（火1）＋フラット炭（火2）で熱5");
  ok({ type: "end" }); while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.deepEqual(p.stove.map((c) => c.stage), [2], "キューブは2ターンで焼ける");
  ok({ type: "steam" }); ok({ type: "end" });
  assert.deepEqual([G.wait.type, p.hand.length], ["discard", 8], "手札は7枚まで。超えたぶんはターンの終わりに灰にする");
  ok({ type: "discard", picks: [p.hand.length - 1] });
  while (G.wait.player === 1 && G.phase === "prep") ok(aiAct(G, 1));
  assert.equal(G.phase, "serve");
  // 提供の最初のターン: キューブが焼けている
  if (G.wait.player !== 0) while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.equal(G.wait.type, "cool"); assert.equal(G.wait.left, 1, "冷めるのは1段階（炭1つの火が1下がる）");
  const fi = p.zone.findIndex((c) => c.up);
  ok({ type: "cool", zone: fi });
  assert.deepEqual([heatOf(p), coalHeat(p.zone[fi]), p.zone[fi].up, p.zone.length, G.wait.type, p.hand.length], [4, 1, true, 4, "main", 8],
    "フラット炭の火が2→1に下がる（裏返らない。炭は残る）。冷めたあと、普通のドローで1枚引く");
  no({ type: "cool", zone: 0 }, "冷めるのは1ターンに1段階だけ");
  no({ type: "puton", stove: 0 }, "炭が4つあると、のせられない");
  ok({ type: "ash", zone: p.zone.findIndex((c) => !c.up) }); // 種火を1つ外して枠を空ける（灰にするのは1ターンに1回）
  assert.deepEqual([heatOf(p), p.zone.length], [3, 3], "種火を外して熱−1");
  ok({ type: "puton", stove: 0 });
  assert.deepEqual([heatOf(p), firepower(p), p.zone.length, coolStepsOf(p)], [6, 6, 4, 1], "キューブ炭は火3。熱＝炭の火の合計（炭の数ではない）。冷めるのは1ターンに1段階");
  assert.equal(coolStepsOf({ zone: [p.zone[0]] }), 1, "炭が1つなら、冷めるのは1段階だけ");
  // 第0.3版: 必要火力に届けば払わずに使える。一口のカードは提供の自分のターンに仕込む。1ラウンドに1枚
  p.hand.push("heat_in", "encore");
  assert.equal(canPlay(G, p, "all_in").ok, true, "熱6なら渾身の一口（必要火力6）に届く");
  assert.deepEqual(canPlay(G, p, "encore"), { ok: false, reason: "火力7以上で使える" });
  const before = [heatOf(p), p.zone.length];
  ok({ type: "play", hand: p.hand.indexOf("heat_in") });
  assert.deepEqual([heatOf(p), p.zone.length], before, "払わない（炭はそのまま）");
  assert.equal(p.puff.tk, 1, "この一口に仕込まれた");
  assert.deepEqual(canPlay(G, p, "breath"), { ok: false, reason: "カードはこのラウンドもう使った" });
  no({ type: "charge", hand: 0 }, "炭が4つあると、チャージできない");
  no({ type: "ash", zone: 0 }, "灰にするのは1ターンに1回");
  ok({ type: "end" });
  if (G.wait.type === "discard") ok({ type: "discard", picks: Array.from({ length: p.hand.length - RULES.handMax }, (_, i) => i) });
  const round = G.round;
  while (G.wait && G.wait.player === 1 && G.round === round) ok(aiAct(G, 1));
  assert.notEqual(G.wait.type, "react", "めくったあとに使う時間は無い");
  const sc = G.events.findLast((e) => e.t === "score");
  assert.equal(sc.round, round, "後手のターンのあと、そのまま審査");
  const mine = sc.res[0];
  assert.equal(mine.h, before[0] + 1 + sc.puff.dh, "判定熱＝熱＋審査カード＋仕込んだ熱を入れる吸い");
  assert.ok(Number.isInteger(mine.imp), "印象が出る");
  assert.equal(p.cardsUsed, 0, "次のラウンドでまた1枚使える");
}
// 火力を落として発動するカードと、枠を返すカード
{
  const G = createGame({ seed: 21, tournament: "open_cloud", players: [{ kit: "b" }, { kit: "a", ai: true, level: 1 }] });
  const p = G.P[0];
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  for (let n = 0; n < 600 && !(G.phase === "serve" && G.wait.player === 0 && G.wait.type === "main"); n++) {
    if (G.wait.player === 0 && G.wait.type === "prep" && !p.turn.mode && leavesOf(p) < 10) { ok({ type: "pack", picks: { [G.market.find((id) => G.supply[id] >= 4)]: 2 } }); ok({ type: "end" }); continue; }
    ok(aiAct(G, G.wait.player));
  }
  assert.equal(G.wait.type, "main");
  // 熱6: 火力ゾーンを決め打ちする（種火3つ＝火1ずつ、キューブ炭1つ＝火3）
  p.zone = [{ id: "flat", up: false }, { id: "flat", up: false }, { id: "flat", up: false }, { id: "cube", up: true }];
  assert.equal(heatOf(p), 6);
  p.hand = ["reset", "tongs", "show_smoke", "add_coal", "breath", "heat_in"]; p.cardsUsed = 0;
  // 仕切り直し: 必要火力5。火力を2落として発動（種火から灰になる）→ 熱4。3枚引いて、枠は返る
  const deck0 = p.deck.length;
  ok({ type: "play", hand: p.hand.indexOf("reset") });
  assert.deepEqual([heatOf(p), p.zone.length, deck0 - p.deck.length, p.cardsUsed], [4, 2, 3, 0], "火力を2落として熱4（種火が2つ灰に）、3枚引き、もう1枚使える");
  // トングさばきは必要火力3: 熱4なら使える。火力を1落として熱3、2枚引いて、枠は返る
  ok({ type: "play", hand: p.hand.indexOf("tongs") });
  assert.deepEqual([heatOf(p), p.cardsUsed], [3, 0]);
  // 追い炭: 山札から種火2枚を空いた枠に置いて熱5。枠は返る。炭が4つあるときは使えない
  ok({ type: "play", hand: p.hand.indexOf("add_coal") });
  assert.deepEqual([heatOf(p), p.zone.length, p.cardsUsed], [5, 3, 0]);
  assert.deepEqual(canPlay(G, { ...p, zone: [...p.zone, { id: "read", up: false }] }, "add_coal"), { ok: false, reason: "炭は4つまで" });
  // 見せ煙: 必要火力3。葉を1枚減らして発動、この一口の印象+4。これで枠を使い切る
  const main = p.main, leaves = p.bowl[main];
  ok({ type: "play", hand: p.hand.indexOf("show_smoke") });
  assert.deepEqual([p.bowl[main] ?? 0, p.puff.impress, p.cardsUsed], [leaves - 1, 4, 1]);
  assert.equal(canPlay(G, p, "breath").ok, false, "枠を使い切ったあとは、枠を返すカードも使えない");
  // 葉が無いと見せ煙は使えない
  assert.deepEqual(canPlay(G, { ...p, cardsUsed: 0, main: null, bowl: {} }, "show_smoke"), { ok: false, reason: "減らす葉がない" });
  // 火力はちょうど落とした数だけ下がる。火の小さい炭から1ずつ下がり、0になった炭は灰になる（炭の火は戻らない）
  p.zone = [{ id: "cube", up: true }, { id: "cube", up: true, f: 2 }, { id: "flat", up: true, f: 1 }]; p.hand = ["reset"]; p.cardsUsed = 0;
  assert.equal(heatOf(p), 6);
  ok({ type: "play", hand: 0 });
  assert.deepEqual([heatOf(p), p.zone.map(coalHeat)], [4, [3, 1]], "火1のフラット炭が灰になり、次に火2のキューブ炭が1下がる。火力はちょうど2落ちる");
  p.hand = ["tongs"]; p.cardsUsed = 0;
  ok({ type: "play", hand: 0 });
  assert.deepEqual([heatOf(p), p.zone.map(coalHeat)], [3, [3]], "1落とすと、火1になっていた炭が灰になる");
  // 同じ火なら、種火から先に落ちる
  p.zone = [{ id: "flat", up: true, f: 1 }, { id: "cube", up: true, f: 2 }, { id: "heat_in", up: false }]; p.hand = ["reset"]; p.cardsUsed = 0;
  assert.equal(heatOf(p), 4);
  assert.deepEqual(canPlay(G, p, "reset"), { ok: false, reason: "火力5以上で使える" });
  p.zone.push({ id: "read", up: false });
  ok({ type: "play", hand: 0 });
  assert.deepEqual([heatOf(p), p.zone.map((c) => c.id)], [3, ["flat", "cube"]], "種火から先に落ちる");
  // チャージ＆ドロー: そのターン最初のチャージだけ1枚引く（置かずに引くことはできない）。2回目からのチャージは引かない
  p.zone = [{ id: "flat", up: true }]; p.hand = ["read", "read", "read"]; p.turn.charges = 0;
  ok({ type: "charge", hand: 0 }); assert.deepEqual([heatOf(p), p.hand.length], [3, 3], "1枚置いて1枚引く");
  assert.deepEqual(act(G, { type: "charge", hand: 0 }), { ok: false, reason: "チャージ＆ドローは1ターンに1回" });
  // 引かずに置くことはできない: 山札も灰も空なら、チャージできない
  { const keep = [p.deck, p.ash]; p.turn.charges = 0; p.deck = []; p.ash = [];
    assert.deepEqual(act(G, { type: "charge", hand: 0 }), { ok: false, reason: "引く札が無いので置けない" }); [p.deck, p.ash] = keep; }
  // C1（炭1個で回す低温用のHMD）: 置ける炭は2つまで。炭が1つだけのあいだ、冷めない
  { const hmd = p.hmd; p.hmd = "one_coal"; p.turn.charges = 0;
    p.zone = [{ id: "cube", up: true }, { id: "flat", up: true }]; p.stove = [{ id: "flat", stage: 2 }];
    assert.deepEqual([coalMaxOf(p), act(G, { type: "puton", stove: 0 }).reason, act(G, { type: "charge", hand: 0 }).reason], [2, "炭は2つまで", "炭は2つまで"]);
    p.hmd = hmd; p.stove = []; }
}
// 一式d「一つ火の低温型」（C1）: 立ち上げは2枚まで。炭が1つだけなら、自分のターンのはじめに冷めない
{
  const G = createGame({ seed: 5, tournament: "open_cloud", first: 0, players: [{ kit: "d" }, { kit: "a", ai: true, level: 1 }] });
  const p = G.P[0];
  assert.deepEqual([p.hmd, coalMaxOf(p), coalMaxOf(G.P[1])], ["one_coal", 2, 4]);
  assert.equal(act(G, { type: "embers", picks: [0, 1, 2] }).ok, false, "C1は、立ち上げの炭も2つまで");
  assert.equal(act(G, { type: "embers", picks: [0, 1] }).ok, true);
  for (let n = 0; n < 900 && !(G.phase === "serve" && G.wait.player === 0 && G.wait.type === "main"); n++) assert.ok(act(G, aiAct(G, G.wait.player)).ok);
  p.zone = [{ id: "cube", up: true }]; p.wind = 0; p.noCool = false;
  const round = G.round;
  assert.ok(act(G, { type: "end" }).ok);
  if (G.wait.type === "discard") assert.ok(act(G, { type: "discard", picks: Array.from({ length: p.hand.length - RULES.handMax }, (_, i) => i) }).ok);
  for (let n = 0; n < 400 && !G.over && !(G.wait.player === 0 && G.round > round); n++) assert.ok(act(G, aiAct(G, G.wait.player)).ok);
  assert.deepEqual([G.wait.type, heatOf(p), p.zone.length], ["main", 3, 1], "炭が1つだけなので冷めない（火3のまま、すぐ自分の手番）");
  assert.ok(G.log.some((l) => /C1：炭が1つだけなので冷めない/.test(l.text)));
  p.zone.push({ id: "flat", up: true });
  const r2 = G.round;
  assert.ok(act(G, { type: "end" }).ok);
  if (G.wait.type === "discard") assert.ok(act(G, { type: "discard", picks: Array.from({ length: p.hand.length - RULES.handMax }, (_, i) => i) }).ok);
  for (let n = 0; n < 400 && !G.over && !(G.wait.player === 0 && G.round > r2); n++) assert.ok(act(G, aiAct(G, G.wait.player)).ok);
  if (!G.over) assert.deepEqual([G.wait.type, G.wait.left], ["cool", 1], "炭が2つあれば、ふつうに冷める（1ターンに1段階）");
}
// 熱を入れる吸い（帯に入れば印象+1）・内寄せ（このセッションの印象+1）・ブロー（焦げを適温として採点）
{
  const m = fake(), q = PUFFS.normal;
  assert.equal(scorePuff(m, 7, q, { blow: true }).zone, "band");
  assert.equal(impressionOf(m, scorePuff(m, 6, q)), 5);
}
// 印象: 味値＋帯の分（ジャストも適温も+1）＋濃厚＋カード。一票は印象の高い方に
{
  const s = (z) => ({ zone: z, rich: false });
  const m = fake();
  assert.deepEqual(["just", "band", "off", "cold", "scorch"].map((z) => impressionOf(m, s(z))), [5, 5, 3, 2, 1], "マンゴー味値4");
  assert.equal(impressionOf(m, { zone: "band", rich: true }, 4), 10, "濃厚+1・見せ煙+4");
  assert.equal(impressionOf(fake({ bowl: {}, main: null }), s("just")), 0, "葉が無ければ0");
}

// ── 2b. トレカとしての札: 通し番号は重ならず、どの札にもレア度がある ──
{
  const all = [...FLAVORS.map((x) => ["flavor", x.id]), ...BOWLS.map((x) => ["bowl", x.id]), ...HMDS.map((x) => ["hmd", x.id]), ...CARDS.map((x) => ["card", x.id])];
  assert.equal(SERIES_SIZE, all.length);
  assert.deepEqual(all.map(([k, id]) => numberOf(k, id)), all.map((_, i) => i + 1), "通し番号は1から順");
  for (const [k, id] of all) assert.ok(RARITIES[rarityOf(k, id)], `レア度が無い: ${k}/${id}`);
  assert.equal(numberOf("card", "no_such_card"), 0);
}

// ── 3b. 炭焼き場は4つまで（カードでは増えない）。タヌキッシュリッド【素直】とチャコスタ ──
{
  const G = createGame({ seed: 5, tournament: "practice", players: [{ name: "低温", kit: "c" }, { name: "単品", kit: "b", ai: true, level: 1 }] });
  const p = G.P[0];
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  const toMyMain = () => { for (let n = 0; n < 400 && !(G.phase === "serve" && G.wait.player === 0 && G.wait.type === "main"); n++) ok(aiAct(G, G.wait.player)); assert.equal(G.wait.type, "main"); };
  assert.equal(RULES.slots, 4);
  toMyMain();
  assert.equal(p.hmd, "tanukish");
  p.stove = []; p.hand = ["flat", "flat", "cube", "flat", "flat"]; p.tools = ["chacosta"];
  assert.equal(slotsOf(p), 4, "タヌキッシュリッドでもチャコスタでも枠は増えない");
  for (let k = 0; k < 4; k++) ok({ type: "place", hand: 0 });
  assert.equal(p.stove.length, 4);
  assert.deepEqual(act(G, { type: "place", hand: 0 }), { ok: false, reason: "炭焼き場がいっぱい" });
  // 【素直】「灰にする」で炭を落としたら1枚引く（1ターンに1回）
  p.zone = [{ id: "flat", up: true }, { id: "flat", up: false }, { id: "flat", up: false }];
  const hand0 = p.hand.length;
  ok({ type: "ash", zone: 2 }); assert.equal(p.hand.length, hand0 + 1, "灰にしたら引く");
  assert.equal(act(G, { type: "ash", zone: 1 }).ok, false, "灰にするのは1ターンに1回");
  // チャコスタ: 自分のターンのはじめ、炭焼き場に炭が3つ以上あれば1枚引く
  const logs = G.log.length;
  ok({ type: "end" });
  for (let n = 0; n < 400 && !G.over && !(G.wait.player === 0 && (G.wait.type === "cool" || G.wait.type === "main")); n++) ok(aiAct(G, G.wait.player));
  assert.ok(G.log.slice(logs).some((l) => l.who === 0 && l.text.startsWith("チャコスタ：")), "炭焼き場に4つ置いたまま次のターンを迎えると、チャコスタで引く");
}

// ── 4. CPUどうしの対戦 ──
function autoplay(cfg) {
  const G = createGame(cfg); let steps = 0;
  while (!G.over) {
    const where = `${G.wait.type}・ラウンド${G.round}`, a = aiAct(G, G.wait.player);
    const r = act(G, a);
    assert.ok(r.ok, `CPUの入力が通らない: ${JSON.stringify(a)} → ${r.reason}（${where}）`);
    assert.ok(++steps < 4000, "対戦が終わらない");
    for (const p of G.P) {
      assert.ok(heatOf(p) <= RULES.heatMax && heatOf(p) >= 0, "熱は0〜10");
      assert.ok(firepower(p) >= 0, "火力は負にならない");
      assert.ok(p.stove.length <= RULES.slots, "炭焼き場は4つまで");
      assert.ok(Object.values(p.bowl).every((n) => n > 0), "0枚の葉は残さない");
      assert.ok((p.cardsUsed || 0) <= RULES.cardsPerRound, "カードは1ラウンドに1枚まで");
    }
  }
  return G;
}
{
  const stats = {}; let games = 0;
  for (const tour of TOURNAMENTS) for (const [ka, kb] of [["a", "b"], ["b", "c"], ["c", "a"], ["a", "a"]]) for (const levels of [[2, 2], [0, 1], [1, 2]]) for (let s = 1; s <= 4; s++) {
    const G = autoplay({ seed: s * 7919 + games, tournament: tour.id, players: [{ kit: ka, ai: true, level: levels[0] }, { kit: kb, ai: true, level: levels[1] }] });
    games++;
    assert.equal(G.shown.length, tour.judges.length ? Math.min(12, roundsOf(G)) : 0);
    for (const p of G.P) {
      assert.ok(p.score >= 0 && p.score < 260, `点が範囲外: ${p.score}`);
      assert.equal(p.deck.length + p.hand.length + p.ash.length + p.zone.length + p.stove.length + p.tools.length + (p.person ? 1 : 0), 40, "カードが40枚のまま");
      const k = `${p.kit}`; (stats[k] ||= { n: 0, score: 0, win: 0 }); stats[k].n++; stats[k].score += p.score; if (G.result.winner === p.index) stats[k].win++;
    }
  }
  // 強さの段階: つよい は やさしい に勝ち越す
  let strong = 0, n = 0;
  for (let s = 1; s <= 60; s++) for (const kit of ["a", "c"]) {
    const G = autoplay({ seed: s * 104729, tournament: "open_cloud", first: s % 2, players: [{ kit, ai: true, level: 2 }, { kit, ai: true, level: 0 }] });
    n++; if (G.result.winner === 0) strong++;
  }
  assert.ok(strong / n > 0.6, `つよいCPUが、やさしいCPUに勝ち越す（${strong}/${n}）`);
  console.log(`ichidai_rules PASS: ${games}+${n} 対戦。` + Object.entries(stats).map(([k, v]) => `${k} 平均${(v.score / v.n).toFixed(0)}点・勝率${Math.round(100 * v.win / v.n)}%`).join(" / ") + ` / つよい対やさしい ${strong}/${n}`);
}

// ── 4a. 第0.5版: 審査カードはラウンドのはじめにめくる。「吸い方を読む」は次のラウンドの分を見る ──
{
  const G = createGame({ seed: 9, tournament: "open_cloud", first: 0, players: [{ kit: "c", ai: true, level: 2 }, { kit: "a", ai: true, level: 2 }] });
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  assert.equal(RULES.revealFirst, true);
  while (G.phase !== "serve") ok(aiAct(G, G.wait.player));
  // 提供に入った時点で、このラウンドの審査カードがもうめくられている（だれの手番よりも前）
  assert.ok(G.judge && G.judge.judge, "ラウンドのはじめに審査カードがめくられている");
  assert.deepEqual([G.round, G.shown.length, G.pile.length], [0, 1, 11]);
  const evs = G.events.map((e) => e.t), ri = evs.lastIndexOf("round");
  assert.equal(evs[ri + 1], "reveal", "ラウンドの知らせのすぐあとに、めくる");
  // 自分の番まで進めて「吸い方を読む」: 山のいちばん上＝次のラウンドの審査カードを、自分だけ見る
  while (!(G.wait.type === "main")) ok(aiAct(G, G.wait.player));
  const p = G.P[G.wait.player], now = G.judge;
  p.cardsUsed = 0; p.hand = ["read"];
  ok({ type: "play", hand: 0 });
  assert.equal(p.peek, G.pile[0], "読んだのは、次のラウンドの分");
  assert.notEqual(p.peek, now);
  const peeked = p.peek, r0 = G.round;
  while (!G.over && G.round === r0) ok(aiAct(G, G.wait.player));
  const sc = G.events.findLast((e) => e.t === "score");
  assert.equal(sc.puff, now, "審査は、ラウンドのはじめにめくったカードで行う");
  assert.equal(G.judge, peeked, "次のラウンドでは、読んだカードがめくられる");
  assert.equal(p.peek, null, "めくられたら、読んだ印は消える");
  // 最後のラウンドは、読む先が無い
  while (!G.over && G.round < roundsOf(G) - 1) ok(aiAct(G, G.wait.player));
  while (!G.over && G.wait.type !== "main") ok(aiAct(G, G.wait.player));
  if (!G.over) { const q = G.P[G.wait.player]; q.cardsUsed = 0; q.hand = ["read"]; assert.equal(canPlay(G, q, "read").reason, "次のラウンドがない"); }
  // めくる時を「全員のターンのあと」に戻す規則（第0.4版）でも動く
  const H = createGame({ seed: 9, tournament: "open_cloud", rules: { revealFirst: false }, players: [{ kit: "c", ai: true, level: 2 }, { kit: "a", ai: true, level: 2 }] });
  while (H.phase !== "serve") assert.ok(act(H, aiAct(H, H.wait.player)).ok);
  assert.equal(H.judge, null, "第0.4版の規則では、ターンのあいだは審査カードが伏せてある");
  while (!H.over) assert.ok(act(H, aiAct(H, H.wait.player)).ok);
  assert.equal(H.shown.length, roundsOf(H));
}

// ── 4b. 炭が消えるときは、どの炭がなぜ消えたかを出来事と記録に残す（画面が合図を出すため。2026-11-11 オーナー「急に消えたり」） ──
{
  const G = createGame({ seed: 4, tournament: "practice", first: 0, players: [{ kit: "a" }, { kit: "b", ai: true }] });
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  while (!(G.phase === "serve" && G.wait.type === "cool" && G.wait.player === 0)) ok(aiAct(G, G.wait.player));
  const p = G.P[0];
  p.zone = [{ id: "cube", up: true, f: 3 }, { id: "flat", up: false, f: 1 }, { id: "flat", up: false, f: 1 }]; p.wind = 0; p.tools = p.tools.filter((x) => x !== "windguard");
  G.wait = { type: "cool", player: 0, left: 2, steps: 2, h0: heatOf(p) }; G.events.length = 0;
  ok({ type: "cool", zone: 1 });
  assert.deepEqual(G.events.filter((e) => e.t === "ash").map((e) => [e.p, e.zi, e.up, e.why]), [[0, 1, false, "cool"]], "灰になった炭の位置と理由が出来事に入る");
  ok({ type: "cool", zone: 0 });
  assert.deepEqual(G.events.filter((e) => e.t === "flip").map((e) => [e.zi, e.f, e.why]), [[0, 2, "cool"]], "火が下がった炭も同じ");
  assert.deepEqual(G.events.filter((e) => e.t === "cooled").map((e) => [e.from, e.to, e.burnt]), [[5, 3, 1]]);
  assert.ok(G.log.some((l) => l.who === 0 && l.text === "冷めた：熱5→3（炭1つが灰になった）"), "どう冷めたかを記録に残す");
  assert.equal(G.wait.type, "main");
  // 火力を落として発動: 落ちた炭も1段ずつ出来事になる
  p.zone = [{ id: "cube", up: true, f: 3 }, { id: "flat", up: false, f: 1 }]; p.hand = ["all_in"]; p.cardsUsed = 0; G.events.length = 0;
  if (CARD.all_in.pay?.fire && canPlay(G, p, "all_in").ok) {
    ok({ type: "play", hand: 0 });
    assert.equal(G.events.filter((e) => (e.t === "ash" || e.t === "flip") && e.why === "pay").length, CARD.all_in.pay.fire, "落とした火のぶんだけ出来事が出る");
  }
  // 器具は3つまで: 4つ目を出すと、いちばん古い器具が灰になる。それも記録に残す
  const tools = CARDS.filter((c) => c.type === "tool").map((c) => c.id);
  p.tools = tools.slice(0, 3); p.wind = p.tools.includes("windguard") ? 2 : 0; p.hand = [tools[3]]; p.cardsUsed = 0; p.zone = [{ id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 3 }];
  if (canPlay(G, p, tools[3]).ok) {
    ok({ type: "play", hand: 0 });
    assert.ok(G.log.at(-1).text.startsWith("器具は3つまで。") || G.log.slice(-2).some((l) => l.text.startsWith("器具は3つまで。")), "押し出された器具を記録に残す");
    assert.equal(p.tools.length, 3);
  }
}

// ── 5. 3人・4人の対戦（2026-11-11 オーナー「1:1:1:1の4人のやつ」「5もいる」） ──
{
  const four = (over = {}) => createGame({ seed: 77, tournament: "open_cloud", first: 2, players: ["a", "b", "c", "d"].map((kit, i) => ({ name: `P${i}`, kit, ai: true, level: 2 })), ...over });
  const G = four();
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  assert.equal(G.P.length, 4);
  assert.deepEqual([pileOf(G), G.supply[G.market[0]]], [24, 24], "場の葉の山は、4人なら1種24枚（2人で12枚・1人6枚ぶん）");
  assert.equal(pileOf(createGame({ seed: 1, tournament: "open_cloud", players: [{ kit: "a" }, { kit: "b" }] })), 12, "2人なら12枚のまま");
  assert.deepEqual(rivalsOf(G, G.P[2]).map((p) => p.index), [3, 0, 1], "相手は、自分の次の席から順");
  // 最初の火: 先手（席2）から席の順に、4人とも選ぶ
  const seen = [];
  while (G.wait.type === "embers") { seen.push(G.wait.player); ok(aiAct(G, G.wait.player)); }
  assert.deepEqual(seen, [2, 3, 0, 1], "最初の火は先手から席の順");
  // 準備: 先手から席の順に1人ずつ、6ターンずつ（4人で24手番）
  const prep = [];
  while (G.phase === "prep") { if (G.wait.type === "prep" && prep[prep.length - 1]?.[0] !== `${G.wait.player}:${G.wait.n}`) prep.push([`${G.wait.player}:${G.wait.n}`]); ok(aiAct(G, G.wait.player)); }
  assert.deepEqual(prep.slice(0, 5).map((x) => x[0]), ["2:1", "3:1", "0:1", "1:1", "2:2"], "準備の手番は席の順に回る");
  assert.equal(prep.length, RULES.prepTurns * 4, "準備は1人6ターン");
  // 提供: 先手から席の順。ラウンドごとに先手が次の席へ回る
  assert.deepEqual([G.round, G.order], [0, [2, 3, 0, 1]]);
  const turns = [];
  while (!G.over && G.round === 0) { const w = G.wait; if (w.type === "main" && turns[turns.length - 1] !== w.player) turns.push(w.player); ok(aiAct(G, w.player)); }
  assert.deepEqual(turns, [2, 3, 0, 1], "提供の手番は4人とも1回ずつ");
  assert.equal(G.lastResult.res.length, 4, "審査は4人ぶん");
  assert.deepEqual(G.order, [3, 0, 1, 2], "次のラウンドの先手は、次の席");
  // 一票: 印象がいちばん高い1人だけ。いちばん上が並んだら入らない
  const imps = G.lastResult.res.map((r) => r.imp), top = Math.max(...imps);
  assert.equal(G.lastResult.voter, imps.filter((x) => x === top).length === 1 ? imps.indexOf(top) : null, "一票は、いちばん高い1人");
  assert.equal(G.P.reduce((a, p) => a + p.votes, 0), G.lastResult.voter == null ? 0 : 1, "一票は1ラウンドに1つまで");

  // 相手を1人ねらうカード: 相手を選べる（選ばなければ、点がいちばん高い相手）
  while (!(G.wait.type === "main" && G.phase === "serve")) ok(aiAct(G, G.wait.player));
  const me = G.P[G.wait.player], rs = rivalsOf(G, me);
  me.cardsUsed = 0; me.hand = ["hype", "draft", "hype"]; me.zone = [{ id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 3 }];
  for (const o of rs) { o.bowl = { lemon: 6 }; o.main = "lemon"; o.tools = []; o.pend = 0; o.zone = [{ id: "flat", up: true, f: 2 }]; }
  rs[0].score = 10; rs[1].score = 30; rs[2].score = 20;
  assert.deepEqual(targetsOf(G, me, "hype"), rs.map((o) => o.index), "煽りは、どの相手にも使える");
  assert.equal(targetOf(G, me, "hype").index, rs[1].index, "選ばなければ、点がいちばん高い相手");
  rs[2].zone = [];
  assert.deepEqual(targetsOf(G, me, "draft"), [rs[0].index, rs[1].index], "すきま風は、炭のある相手だけ");
  assert.equal(act(G, { type: "play", hand: 1, target: rs[2].index }).reason, "その相手には使えない");
  assert.equal(act(G, { type: "play", hand: 0, target: me.index }).reason, "その相手には使えない", "自分はねらえない");
  ok({ type: "play", hand: 0, target: rs[0].index });
  assert.deepEqual(rs.map((o) => o.pend), [1, 0, 0], "選んだ相手の判定熱だけ+1");
  me.cardsUsed = 0;
  ok({ type: "play", hand: 1 }); // 手札は [すきま風, 煽り]。相手を選ばずに煽りを使う
  assert.deepEqual(rs.map((o) => o.pend), [1, 1, 0], "選ばなければ、点がいちばん高い相手");
  me.cardsUsed = 0;
  ok({ type: "play", hand: 0, target: rs[0].index });
  assert.deepEqual([G.wait.type, G.wait.player, G.wait.by], ["weaken", rs[0].index, me.index], "すきま風は、ねらわれた相手が弱める炭を選ぶ");
  ok({ type: "weaken", zone: 0 });
  assert.deepEqual([coalHeat(rs[0].zone[0]), coalHeat(rs[1].zone[0]), G.wait.type, G.wait.player], [1, 2, "main", me.index], "選んだ相手の炭だけ火が1下がり、手番に戻る");

  // 後の先: 使った人が、次のラウンドのいちばん後になる
  const H = four({ seed: 5 });
  while (!(H.phase === "serve" && H.wait.type === "main")) assert.ok(act(H, aiAct(H, H.wait.player)).ok);
  const user = H.P[H.wait.player];
  user.cardsUsed = 0; user.hand = ["go_second"]; user.zone = [{ id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 3 }];
  assert.ok(act(H, { type: "play", hand: 0 }).ok);
  const r0 = H.round;
  while (!H.over && H.round === r0) assert.ok(act(H, aiAct(H, H.wait.player)).ok);
  assert.equal(H.order[3], user.index, "後の先を使った人が最後");

  // CPUどうしの3人・4人: 規則違反の入力なしで最後まで進み、順位が付く
  let games = 0; const firsts = {};
  for (const tour of TOURNAMENTS) for (const kits of [["a", "b", "c", "d"], ["d", "c", "b", "a"], ["b", "a", "c"], ["c", "c", "d", "a"]]) for (let sd = 1; sd <= 2; sd++) {
    const K = autoplay({ seed: sd * 6007 + games, tournament: tour.id, players: kits.map((kit, i) => ({ kit, ai: true, level: (i + sd) % 3 })) });
    games++;
    const n = kits.length, res = K.result;
    assert.deepEqual([res.scores.length, res.votes.length, res.ranks.slice().sort().join()], [n, n, kits.map((_, i) => i).join()], "点・一票・順位が人数ぶん");
    assert.deepEqual(res.scores, K.P.map((p) => p.score));
    for (let i = 1; i < n; i++) assert.ok(K.P[res.ranks[i - 1]].score >= K.P[res.ranks[i]].score, "順位は点の高い順");
    assert.ok(res.winner === null || res.winner === res.ranks[0], "1位が勝者");
    assert.ok(res.votes.reduce((a, b) => a + b, 0) <= roundsOf(K), "一票は1ラウンドに1つまで");
    for (const b of res.bonus) assert.equal(b.pts.length, n, "審査員のボーナスも人数ぶん");
    for (const p of K.P) assert.equal(p.deck.length + p.hand.length + p.ash.length + p.zone.length + p.stove.length + p.tools.length + (p.person ? 1 : 0), 40, "カードが40枚のまま");
    if (res.winner != null) firsts[n] = (firsts[n] || 0) + 1;
  }
  console.log(`ichidai_rules PASS: 3〜4人 ${games} 対戦（1位が決まった局: ${Object.entries(firsts).map(([n, v]) => `${n}人 ${v}`).join("・")}）`);
}
