// カードゲーム「一台勝負」の規則とCPU（ブラウザ不要）。
//   1. ゲーム内のカードの名前・数値・文が、ルールブック（docs/design/card_game/cards.js）と同じ
//   2. 組み済みの一式が40枚・同名3枚まで（フラット炭とキューブ炭を除く）・人物1枚まで
//   3. 採点（帯・加点・焦げ）と、炭の動き（着火・冷める・火持ち）が規則どおり
//   4. CPUどうしの対戦が、規則違反の入力なしで最後まで進む
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { FLAVORS, FLAVOR, CARDS, CARD, BOWLS, HMDS, JUDGES, PUFFS, TOURNAMENTS, KITS, TYPE_LABEL, WHEN_LABEL, expandDeck } from "../js/minigames/ichidai-data.js";
import { RULES, createGame, act, heatOf, leavesOf, firepower, coolStepsOf, slotsOf, scorePuff, judgedHeat, roundsOf, canPlay } from "../js/minigames/ichidai-rules.js";
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
      const cost = c.burn ? `B${c.burn}` : c.cost;
      assert.equal(cost, d.cost, `${d.n} の火力`);
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
  spent: 0, pend: 0, sessMod: 0, usedLotus: true, usedSilicone: false, ...over });
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
  assert.equal(scorePuff(p, 7, q, { blow: true }).zone, "off", "ブロー: 焦げない");
  assert.equal(scorePuff(fake({ usedLotus: false }), 4, q).zone, "band", "ロートスHMD: ズレを適温に");
  assert.equal(scorePuff(fake({ bowlId: "silicone" }), 7, q).zone, "off", "シリコンボウル: 焦げを取り消す");
  assert.equal(scorePuff(fake({ bowl: { rose: 6, mint: 2 }, main: "rose" }), 5, q).zone, "off", "ミントの【クッション】で焦げラインが6に");
  assert.equal(scorePuff(fake({ bowl: { double_apple: 12 }, main: "double_apple", bowlId: "clay", person: "adam" }), 7, q).pts, 8, "単品: 素焼き＋アダム＋濃厚");
  assert.equal(judgedHeat(fake({ hmd: "amaburst", zone: [{ id: "x", up: false }], pend: 1, sessMod: 1 }), PUFFS.long, -1), 1 + 1 + 1 + 1 + 1 - 1);
  assert.equal(judgedHeat(fake({ bowl: { lavender: 8 }, main: "lavender", zone: [], pend: 2 }), PUFFS.normal), 0, "ラベンダーの【鎮静】");
}
{
  // 着火: フラットは1ターン、キューブは2ターン。冷める: 2段階、キューブが表向きなら1段階
  const G = createGame({ seed: 7, tournament: "practice", first: 0, players: [{ kit: "a" }, { kit: "b" }] });
  const [p, o] = G.P;
  const ok = (a) => { const r = act(G, a); assert.ok(r.ok, `${a.type}: ${r.reason}`); };
  const no = (a, why) => assert.equal(act(G, a).ok, false, why);
  assert.equal(p.hand.length, 7);
  no({ type: "embers", picks: [0, 1] }, "種火は3枚");
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
  ok({ type: "place", hand: p.hand.indexOf("flat") }); ok({ type: "place", hand: p.hand.indexOf("cube") });
  assert.deepEqual(p.stove.map((c) => c.stage), [1, 0], "フラットは縦向き、キューブは横向きで置く");
  no({ type: "puton", stove: 0 }, "まだ焼けていない");
  ok({ type: "charge", hand: p.hand.indexOf("blow") }); no({ type: "charge", hand: 0 }, "チャージは1ターンに1回");
  assert.equal(heatOf(p), 4);
  ok({ type: "end" }); ok(aiAct(G, 1)); while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.deepEqual(p.stove.map((c) => c.stage), [2, 1], "次のターンにフラットが焼け、キューブは縦向きに");
  ok({ type: "steam" }); ok({ type: "puton", stove: 0 });
  assert.deepEqual([heatOf(p), p.zone.at(-1).up], [5, true]);
  ok({ type: "end" }); while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.deepEqual(p.stove.map((c) => c.stage), [2], "キューブは2ターンで焼ける");
  ok({ type: "steam" }); ok({ type: "end" }); while (G.wait.player === 1 && G.phase === "prep") ok(aiAct(G, 1));
  assert.equal(G.phase, "serve");
  // 提供の最初のターン: キューブが焼けている
  if (G.wait.player !== 0) while (G.wait.player === 1) ok(aiAct(G, 1));
  assert.equal(G.wait.type, "cool"); assert.equal(G.wait.left, 2, "2段階冷める");
  ok({ type: "cool", zone: p.zone.findIndex((c) => c.up) });
  assert.equal(heatOf(p), 5, "フラットは裏返しても熱が下がらない");
  ok({ type: "cool", zone: 0 });
  assert.deepEqual([heatOf(p), G.wait.type], [4, "main"]);
  ok({ type: "puton", stove: 0 });
  assert.deepEqual([heatOf(p), firepower(p), coolStepsOf(p)], [6, 6, 1], "キューブは熱2・火力2、【火持ち】で冷めるのは1段階");
  no({ type: "play", hand: p.hand.indexOf("heat_in") }, "一口の技は審査のときだけ");
  assert.equal(canPlay(G, p, "all_in").ok, false);
  ok({ type: "end" });
  while (G.wait && G.wait.player === 1) ok(aiAct(G, 1));
  assert.deepEqual([G.wait.type, G.wait.player], ["react", G.order[0]]);
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
  p.zone = [{ id: "flat", up: true }, { id: "flat", up: false }, { id: "flat", up: false }]; p.spent = 0;
  const hand0 = p.hand.length;
  ok({ type: "ash", zone: 2 }); assert.equal(p.hand.length, hand0 + 1, "1回目は引く");
  ok({ type: "ash", zone: 1 }); assert.equal(p.hand.length, hand0 + 1, "同じターンの2回目は引かない");
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
