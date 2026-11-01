// 心得の盤のデータと規則（SPEC 第2版 2.2〜2.6・2.9・1.9・3.1）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const { NODE_BY_ID: N } = board;

// ---------------------------------------------------------------- データ検査（2.9・v3）
const SHAPE_SIZE = { body: [26, 4], sense: [26, 4], wisdom: [26, 4] }; // 3つの盤は同じ大きさ（SBD60） // [能力のマス（極みを含む）, 関門]
for (const k of board.BOARD_KEYS) {
  const layout = board.LAYOUTS[k];
  const [hx, hy] = board.HUB_AT[k].split(",").map(Number);
  for (const c of layout.cells) assert(Math.abs(c.x + hx) <= board.GRID.w && c.y + hy <= 0 && -(c.y + hy) <= board.GRID.h, `${k}: 横13×縦9 に収まる`);
  for (const [a, b] of layout.edges) {
    const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, "線は上下左右の隣だけ（斜めなし）");
  }
}
assert.notDeepEqual(board.LAYOUTS.body.edges, board.LAYOUTS.sense.edges, "盤によって形が違う");
assert.notDeepEqual(board.LAYOUTS.sense.edges, board.LAYOUTS.wisdom.edges);
// 3枚の形はそれぞれ違う（SBD64）: どの2枚を比べても、置き場所の違うマスが多い
for (const [a, b] of [["body", "sense"], ["sense", "wisdom"], ["body", "wisdom"]]) {
  const keys = (k) => new Set(board.LAYOUTS[k].cells.map((c) => c.key));
  const A = keys(a), B = keys(b), diff = [...A].filter((k) => !B.has(k)).length + [...B].filter((k) => !A.has(k)).length;
  assert(diff >= 12, `${a} と ${b} の形が違う（違うマス ${diff}）`);
}
const expect = { body: [7, 6], sense: [8, 7], wisdom: [8, 7] }; // スキル各8（中ほどの面白いスキル2つを足した。SBD66） // スキル各6・授業20（カルダモンは感覚盤へ。SBD60）
for (const k of board.BOARD_KEYS) {
  const nodes = board.boardNodes(k);
  assert.equal(nodes.filter((n) => n.kind === "stat").length, SHAPE_SIZE[k][0]+(k==="body"?1:0), `${k}: 能力のマス`);
  assert.equal(board.STAT_SQUARES[k], SHAPE_SIZE[k][0]);
  assert.equal(nodes.filter((n) => n.kind === "gate").length, SHAPE_SIZE[k][1], `${k}: 関門`);
  assert.equal(nodes.filter((n) => n.kind === "skill").length, expect[k][0], `${k}: スキル`);
  assert.equal(nodes.filter((n) => n.kind === "lesson").length, expect[k][1], `${k}: 授業`);
  assert.equal(new Set(nodes.map((n) => n.cell)).size, nodes.length, "1マスに1つ");
  assert.equal(nodes.filter((n) => n.peak).length, 1, "極みは1つ");
  assert.equal(nodes.find((n) => n.peak).ring, 5, "極みは最後の章");
  const kindAt = (cell) => board.LAYOUTS[k].cells.find((c) => c.key === cell).kind;
  for (const n of nodes.filter((x) => x.kind !== "stat" || x.peak)) assert.equal(kindAt(n.cell), n.kind === "gate" ? "gate" : "spot", `${n.id} の置き場所`);
  // どの章のマスも、その章までに開くマスだけで紋から届く（2.3）
  for (let ring = 1; ring <= 5; ring++) {
    const reach = new Set();
    for (let more = true; more;) {
      more = false;
      for (const n of nodes) if (n.ring <= ring && !n.peak && !reach.has(n.id) && n.links.some((l) => l === board.HUB || reach.has(l))) { reach.add(n.id); more = true; }
    }
    assert.deepEqual(nodes.filter((n) => n.ring <= ring && !n.peak && !reach.has(n.id)).map((n) => n.id), [], `${k} 第${ring}章`);
  }
  // 第1章のスキルと、第1章の物語のスミさんの授業（アタック・キューブ炭）は、関門を越えずに届く（色の火種は第1章の終わりまで来ない）
  for (const n of nodes.filter((x) => (x.kind === "skill" && x.ring === 1) || x.id === "M-S1" || x.id === "M-W1")) {
    const reach = new Set();
    for (let more = true; more;) {
      more = false;
      for (const m of nodes) if (m.kind !== "gate" && !reach.has(m.id) && m.links.some((l) => l === board.HUB || reach.has(l))) { reach.add(m.id); more = true; }
    }
    assert(reach.has(n.id), `${n.id} は関門なしで届く`);
  }
}
// v9（SBD62）: 紋は下の端。紋のそばの授業は第1章の人だけ（関門なし）、第2章からの人の授業は関門の先。
// どの関門の先にも強いスキルがある。誰の授業へ先に進んでも、ほかの授業が遠くならない。
for (const k of board.BOARD_KEYS) {
  const hubSides = board.boardNodes(k).filter((n) => n.links.includes(board.HUB)).map((n) => n.cell).sort();
  assert.deepEqual(hubSides, ["-1,0", "0,-1", "1,0"], `${k}: 紋から出る道は左・右・上の3本`);
}
for (const l of board.LESSONS) {
  const route = board.pathTo(l.id, new Set()).path.filter((id) => id !== l.id);
  const gates = route.filter((id) => N[id].kind === "gate").length;
  if ((l.ring ?? 1) === 1) {
    assert.equal(gates, 0, `${l.id}: 第1章の人の授業は関門なし`);
    assert(route.length <= 3, `${l.id}: 紋のそば（${route.length}マス）`);
    assert.equal(N[l.id].band, 1, `${l.id}: 近くの帯`);
  } else {
    assert.equal(gates, 1, `${l.id}: 第2章からの人の授業は関門の先`);
    assert.equal(N[l.id].band, 3, `${l.id}: 関門の先の帯`);
  }
  assert(board.pathTo(l.id, new Set()).cost <= ((l.ring ?? 1) === 1 ? 3 : 10), `${l.id}: 紋から遠すぎない（火種${board.pathTo(l.id, new Set()).cost}）`);
  assert.equal(N[l.id].ring, l.ring ?? 1, `${l.id}: 授業の章はデータどおり`);
  const others = new Set(board.LESSONS.filter((x) => x.id !== l.id && x.board === l.board).flatMap((x) => board.pathTo(x.id, new Set()).path));
  assert(board.pathTo(l.id, others).cost <= board.pathTo(l.id, new Set()).cost, `${l.id}: 先に進んだ道で遠くならない`);
}
// 帯と強さ: 火種4のスキルは近く、6と8は関門の先。極みも関門の先。どの関門の先にもスキルがある
for (const s of board.SKILLS) assert.equal(N[s.id].band, s.cost === 4 ? 1 : s.cost === 2 ? 2 : 3, `${s.id}（火種${s.cost}）の帯: 4＝近く・2＝中ほど・5と7＝関門の先`);
for (const k of board.BOARD_KEYS) assert.deepEqual([...board.SKILLS,...board.STAT_UPGRADES].filter((s) => s.board === k).map((s) => s.cost).sort(), [2, 2, 4, 4, 5, 5, 7, 7], `${k}: スキルの火種`);
for (const k of board.BOARD_KEYS) {
  const nodes = board.boardNodes(k);
  // 極みは道につながらない。その盤の能力のマスを全部灯すと灯せる（SBD63）
  const peak = nodes.find((n) => n.peak), stats = nodes.filter((n) => n.kind === "stat" && !n.peak).map((n) => n.id);
  assert.deepEqual(peak.links, [], `${k}: 極みは道から外す`);
  assert(nodes.every((n) => !n.links.includes(peak.id)), `${k}: 極みにつながる道は無い`);
  assert.equal(board.connected(peak, new Set(stats.slice(1))), false, `${k}: 1つ残っていると灯せない`);
  assert.equal(board.connected(peak, new Set(stats)), true, `${k}: 全部灯すと灯せる`);
  assert.equal(board.pathTo(peak.id, new Set(stats)).cost, 1);
  for (const gate of nodes.filter((n) => n.kind === "gate")) {
    const beyond = new Set([gate.id]);
    for (let more = true; more;) {
      more = false;
      for (const n of nodes) if (!beyond.has(n.id) && n.kind !== "gate" && n.band === 3 && n.links.some((l) => beyond.has(l))) { beyond.add(n.id); more = true; }
    }
    assert(nodes.some((n) => beyond.has(n.id) && n.kind === "skill"), `${gate.id}: 関門の先に強いスキル`);
  }
  const bands = [1, 2, 3].map((b) => nodes.filter((n) => n.kind === "stat" && !n.peak && n.band === b).length);
  assert.deepEqual(bands, [9, k==="body"?9:8, 8], `${k}: 能力のマスは 近く9・中ほど8・関門の先8`);
  // v13「輪つきの木」（SBD73）
  {
    const V = nodes.filter((n) => !n.peak).length + 1; // 紋を含む（極みは道の外）
    const E = new Set(nodes.flatMap((n) => n.links.filter((l) => l !== board.HUB).map((l) => [n.id, l].sort().join("|")))).size + nodes.filter((n) => n.links.includes(board.HUB)).length;
    assert(E >= V, `${k}: 輪が1つ以上ある（辺${E} ≥ 頂点${V}）`);
    const hubPerks = nodes.filter((n) => n.links.includes(board.HUB)).map((n) => n.perk);
    assert.equal(new Set(hubPerks).size, 3, `${k}: 紋の隣3つの恩恵は全部違う（${hubPerks}）`);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    for (const n of nodes) if (n.kind === "stat") for (const a of n.links) for (const c of n.links) {
      if (a === c || a === board.HUB || c === board.HUB) continue;
      if (byId[a]?.kind === "stat" && byId[c]?.kind === "stat" && byId[a].perk === n.perk && byId[c].perk === n.perk) assert.fail(`${k}: 同じ恩恵が3つ並ぶ ${a}-${n.id}-${c}`);
    }
    const notables = nodes.filter((n) => n.notable);
    assert.equal(notables.length, 3, `${k}: 要のマスは3つ`);
    assert.deepEqual(notables.map((n) => n.band).sort(), [1, 2, 3], `${k}: 要のマスは 近く・中ほど・関門の先 に1つずつ`);
    for (const n of notables) { assert.equal(n.kind, "stat"); assert.equal(n.cost, 1); assert.equal(board.NOTABLES[n.notable].board, k); }
    // 普通のマスの袋小路（線が1本だけ）は無い（授業・スキル・極みの手前は除く）
    for (const n of nodes) if (n.kind === "stat" && !n.peak) {
      // K20はオーナー指定の置き換え。旧セーブの道を変えず、元の脇道の接続を厳密に保持する。
      if(n.id==="K20"){assert.deepEqual(n.links,["B9"]);continue;}
      const deg = n.links.length;
      const onlyToSpot = deg === 2 && n.links.some((l) => byId[l] && byId[l].kind !== "stat" && byId[l].kind !== "gate");
      assert(deg >= 2, `${k} ${n.id}: 能力のマスの袋小路`);
      void onlyToSpot;
    }
    // 通行料のスキル（線が2本＝通り抜けられる）: 才能は K03/K04（火種4）が弧の上、感覚・理論は火種2のスキルが輪の上
    const tolls = k === "body" ? ["K03", "K04"] : nodes.filter((n) => n.kind === "skill" && n.cost === 2).map((n) => n.id);
    for (const id of tolls) assert(byId[id].links.length >= 2, `${id}: 通行料のスキルは通り抜けられる`);
  }
  // 授業は会う章の順に紋から遠い（SBD65）: どの章の授業も、前の章の授業より近くない
  const costOf = (ring) => board.LESSONS.filter((l) => l.board === k && (l.ring ?? 1) === ring).map((l) => board.pathTo(l.id, new Set()).cost);
  for (let r = 1; r < 4; r++) for (let r2 = r + 1; r2 <= 4; r2++) {
    const a = costOf(r), b = costOf(r2);
    if (a.length && b.length) assert(Math.max(...a) <= Math.min(...b), `${k}: 第${r}章の授業（${a}）は第${r2}章の授業（${b}）より近い`);
  }
  // 第2章の関門は紋のそば
  for (const gate of nodes.filter((n) => n.kind === "gate" && n.ring === 2)) assert(board.pathTo(gate.id, new Set()).cost <= 4, `${gate.id}: 紋のそば`);
  // 紋の場所は盤ごとに違う（SBD65）
  assert.equal(new Set(Object.values(board.HUB_AT)).size, 3, "紋の場所は3枚とも違う");
}
// 恩恵は帯の倍率（近く×1・中ほど×2・関門の先×3）
{
  // 帯の倍率: 同じ恩恵（要のマスでない）が 近く・中ほど・関門の先 にあれば ×1・×2・×3
  const plain = board.boardNodes("body").filter((n) => n.kind === "stat" && !n.peak && !n.notable);
  const sample = plain.find((n) => [1, 2, 3].every((b) => plain.some((m) => m.perk === n.perk && m.band === b)));
  assert(sample, "3つの帯にまたがる恩恵がある");
  const unit = Number(/[\d.]+/.exec(board.perkOf(plain.find((m) => m.perk === sample.perk && m.band === 1)).text)[0]);
  for (const b of [1, 2, 3]) assert.equal(Number(/[\d.]+/.exec(board.perkOf(plain.find((m) => m.perk === sample.perk && m.band === b)).text)[0]), unit * b, `帯${b}は×${b}`);
  assert.equal(board.perkOf(plain.find((m) => m.band === 3)).tierName, "台座の先");
  // 色の台座（SBD89）: 色の火をはめると先へ進めて、台座の能力も手に入る。各盤の4つの台座に、その盤の4つの能力を1つずつ。台座1つ＝台座の先のマス×4/3
  for (const k of board.BOARD_KEYS) {
    const gates = board.boardNodes(k).filter((n) => n.kind === "gate");
    assert.deepEqual(gates.map((g) => g.perk).sort(), Object.keys(board.SQUARE_PERKS[k].perks).sort(), `${k}: 台座の能力は盤の4つの能力を1つずつ`);
    for (const g of gates) {
      const p = board.perkOf(g), u = Number(/[\d.]+/.exec(board.SQUARE_PERKS[k].perks[g.perk].text)[0]);
      assert.equal(p.tierName, "色の台座");
      assert.equal(Number(/[\d.]+/.exec(p.text)[0]), u * board.GATE_TIER.mult, `${g.id}: 台座は×${board.GATE_TIER.mult}`);
    }
    const g0 = gates[0], unit = Number(/[\d.]+/.exec(board.SQUARE_PERKS[k].perks[g0.perk].text)[0]);
    const before = board.perkTotals(k, new Set()).find((p) => p.key === g0.perk).sum;
    const after = board.perkTotals(k, new Set([g0.id])).find((p) => p.key === g0.perk).sum;
    assert.equal(after - before, unit * board.GATE_TIER.mult, `${k}: はめた台座の能力が合計に入る`);
  }
  assert.equal(board.perkOf(board.boardNodes("body").find((n) => n.peak)).name, "基礎", "極みは基礎");
  const notable = board.boardNodes("body").find((n) => n.notable === "ironsleep");
  assert.equal(board.perkOf(notable).notable.name, "不眠の体");
  assert.equal(board.perkOf(notable).text, "寝た時の体力の回復 ＋4.5%", "要のマスは帯の倍率×1.5（SBD73）");
  for (const n of board.NODES.filter((x) => x.kind === "stat" && !x.peak)) assert(board.SQUARE_PERKS[n.board].perks[n.perk], `${n.id}: 恩恵が決まっている`);
}
assert.deepEqual(board.HIDANE_NAME, { any: "白火", body: "紅火", sense: "蒼火", wisdom: "翠火" }, "火種の名前（SBD62）");

assert.equal(N["M-W6"].board, "sense", "カルダモンは感覚盤（3つの盤の授業の数をならす。SBD60）");
assert.deepEqual([N["M-W2"].ring, N["M-W6"].ring], [2, 2], "スミさんの四つ置き・カルダモンは第2章から");
// 各スキル・授業は、データの章（届けたい章）までに開く
for (const item of [...board.SKILLS, ...board.STAT_UPGRADES, ...board.LESSONS]) assert(N[item.id].ring <= (item.ring ?? 1), `${item.id} の章`);
assert.equal(board.SKILLS.length, 23, "K20は通常マスへ変更（2026-11-01 オーナー指示）");
assert.equal(N.K20.kind,"stat");assert.equal(N.K20.perk,"charm");assert.equal(N.K20.cost,2);
assert.equal(board.perkOf(N.K20).text,"好感度が上がりやすく（＋2%）");
for (const k of board.BOARD_KEYS) {
  const sk = [...board.SKILLS,...board.STAT_UPGRADES].filter((x) => x.board === k);
  assert.equal(sk.reduce((n, x) => n + x.cost, 0), 36, `${k}: スキルの火種は各36`);
  assert.equal(sk.filter((x) => x.ring === 1).length, 2, `${k}: 第1章のスキルは各2つ`);
  assert.equal(board.boardNodes(k).reduce((n, x) => n + x.cost, 0), 66, `${k}: 盤は各66`);
  assert.equal(board.boardNodes(k).filter((x) => x.ring === 1).reduce((n, x) => n + x.cost, 0), 17, `${k}: 第1章で開く範囲は各17（能力のマス9・スキル2つ。SBD62）`);
}
assert.equal(board.BOARD_TOTAL_COST, 198, "盤の全部で198（1レベル2つ。SPEC 1.6a）");
assert(140 >= 0.7 * board.BOARD_TOTAL_COST, "中央の1周目の火種（約140）で、3つの盤をどれも7割まで開ける");
assert.equal(board.BOARD_TOTAL_COST, growth.BOARD_TOTAL, "盤の全部と火種の上限が同じ");
const cumulative = [1, 2, 3, 4, 5].map((r) => board.NODES.filter((n) => n.ring <= r).reduce((a, n) => a + n.cost, 0));
const received = [26, 52, 78, 104, 140]; // 中央の遊び方で章末までに受け取る火種（1.6。1レベル2つ）
cumulative.forEach((c, i) => assert(c > received[i], `第${i + 1}章: 開く範囲（${c}）が受け取る火種（${received[i]}）より多い`));
for (let i = 1; i < 5; i++) assert(cumulative[i] > cumulative[i - 1], `第${i + 1}章で新しい範囲が開く`);
assert(board.LESSONS.every((l) => N[l.id].cost === 0), "授業は火種いらず");
// 段はなくした（SBD63）。段の「できること」は ✦のマスに移した
for (const name of ["STEP_TEXT", "QUALITY_STEPS", "RANKS", "LESSON_MIN_STEP", "stepOf", "stepForCount", "squaresToNextStep", "rankOfStep"]) assert.equal(board[name], undefined, `${name} は無い`);
assert.deepEqual(board.NODES.filter((n) => n.feature).map((n) => n.feature).sort(), Object.keys(board.FEATURES).sort(), "✦のマスは6つ（できること1つにつき1マス）");
assert(board.NODES.filter((n) => n.feature).every((n) => n.kind === "stat" && n.band <= 2), "✦は関門なしで届くマス");

// ---------------------------------------------------------------- 規則
growth.setGrowthPreview(true);
core.newGame();
core.state.phase = "daily";
const g = growth.ensureGrowth();
assert.deepEqual(g.nodes, []);
const status = (id, pending = []) => board.nodeStatus(N[id], g, board.replay(g, pending));
const firstOf = (k) => board.boardNodes(k).find((n) => n.kind === "stat" && n.links.includes(board.HUB)).id;
const B = firstOf("body"), S = firstOf("sense"), W = firstOf("wisdom");
const nextOf = (id, exclude = []) => N[id].links.find((l) => l !== board.HUB && N[l].kind === "stat" && !exclude.includes(l));

// 火種が無い・つながっていない・章で開く
assert.equal(status(B), "short");
assert.equal(status(nextOf(B)), "far", "隣が灯っていないマスはつながっていない");
const ring2 = board.boardNodes("body").find((n) => n.ring === 2 && n.kind === "stat");
assert.equal(status(ring2.id), "locked", "第2章の範囲は第1章では鍵");
g.hidane.any = 3;
assert.equal(status(B), "available");

// 仮置き: つながった順に積む。払えない分・つながらなくなった分は外れる
const B2 = nextOf(B);
let v = board.replay(g, [B2, B]);
assert.deepEqual(v.pending.sort(), [B, B2].sort(), "仮置きの順に関係なく、つながった順に積む");
assert.equal(v.hidane.any, 1);
v = board.replay(g, [B2]);
assert.deepEqual(v.pending, [], "つながっていない仮置きは外れる");
v = board.replay(g, [B, B2, S, W]);
assert.equal(v.pending.length, 3, "火種3で3マスまで");

// 盤の伸び（SBD63）: 灯した割合と、恩恵ごとの合計
const five = new Set(["B1", "B2", "B3"]);
assert.equal(board.statCount("body", five), 3);
assert.equal(board.statRatio("body", five), 3 / board.statTotal("body"));
{
  const totals = Object.fromEntries(board.perkTotals("body", five).map((p) => [p.key, p]));
  const expect = {};
  for (const id of five) { const p = board.perkOf(N[id]); const key = N[id].perk; expect[key] = (expect[key] || 0) + Number(/[\d.]+/.exec(p.text)[0]); }
  for (const [key, sum] of Object.entries(expect)) assert.equal(totals[key].sum, sum, `${key} の合計`);
  const all = new Set(board.boardNodes("body").map((n) => n.id));
  for (const p of board.perkTotals("body", all)) assert.equal(p.sum, p.max, `${p.key}: 全部灯すと最大`);
}

// 払い方: その盤の色の火種を先に、足りない分を万能で（1.9）
assert.deepEqual(board.paymentFor(N.K03, { any: 3, body: 1 }), { any: 3, body: 1 }, "万能を先に、足りない分を色で");
assert.deepEqual(board.paymentFor(N.K03, { any: 9, body: 9 }), { any: 4 }, "万能が足りれば色は使わない");
assert.equal(board.paymentFor(N.K03, { any: 1, sense: 9 }), null, "ほかの色は使えない");
assert.deepEqual(board.paymentFor(N["M-S1"], {}), {}, "授業は火種いらず");
// 色の予約: まだ越えていない関門の数ぶんの色は、普通のマスに使わない（#1801 引継ぎ B）
assert.deepEqual(board.paymentFor(N.K03, { any: 2, body: 3 }, { reserve: 1 }), { any: 2, body: 2 }, "色3のうち1は関門用に残す");
assert.equal(board.paymentFor(N.K03, { any: 2, body: 3 }, { reserve: 2 }), null, "色3のうち2を残すと4に足りない");
assert.deepEqual(board.paymentFor(N.K03, { any: 0, body: 4 }, { reserve: 0 }), { body: 4 });
assert.equal(board.paymentFor(N.B1, { any: 0, body: 1, sense: 1 }, { reserve: 2 }), null, "色は全部関門の予約");
// 関門: 色つきの火種でだけ越える。その盤の色が先、無ければほかの色（SBD53）
assert.deepEqual(board.paymentFor(N.BG1, { any: 9, body: 1, sense: 1 }), { body: 1 });
assert.deepEqual(board.paymentFor(N.BG1, { any: 9, sense: 1 }), { sense: 1 }, "ほかの色でも越えられる");
assert.deepEqual(board.paymentFor(N.BG1, { any: 9 }, { capped: true }), { any: 1 }, "もう色が来ない（受け取りの上限）なら万能でも越えられる");
assert.equal(board.paymentFor(N.BG1, { any: 9 }), null, "万能の火種では越えられない");
assert.equal(N.BG1.kind, "gate");
assert.equal(board.nodeLabel(N.BG1), "才能の色の台座");

// 確定: 払った種類を記録し、火種を減らす。節目の色のために灯した数を数える
g.hidane = { any: 2, body: 1, sense: 0, wisdom: 0 };
const committed = board.commitPending([B, B2]);
assert.deepEqual(committed.map((n) => n.id), [B, B2]);
assert.deepEqual(g.paid, { [B]: { any: 1 }, [B2]: { any: 1 } }, "万能を先に使う");
assert.equal(growth.hidaneTotal(g), 1);
assert.equal(g.litSince.body, 2);
assert.equal(status(B), "unlocked");

// 目標（2.4）: 一番安い道。灯した所は0
const route = board.pathTo("K03", new Set(g.nodes));
assert(route.path.length > 0 && route.path.at(-1) === "K03");
assert(!route.path.includes(B), "灯したマスは道に入れない");
assert.equal(route.cost, route.path.reduce((n, id) => n + N[id].cost, 0));
g.hidane.any = 50;
const towards = board.pendingTowards(g, [], "K03");
assert.deepEqual(towards, route.path, "目標まで灯す: 火種が足りれば道を全部仮置き");
g.hidane.any = 1;
assert.equal(board.pendingTowards(g, [], "K03").length, 1, "火種1なら1マスだけ");

// 授業の錠（2.6）: スミさんは条件なし／ほかは♥5（段の条件は SBD63 でなくした）。まだ会っていない相手は伏せる
g.hidane.any = 50;
const senseStats = board.boardNodes("sense").filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
const lessonPath = board.pathTo("M-S1", new Set()).path.filter((id) => id !== "M-S1");
assert.equal(status("M-S1"), "far", "道が届いていない");
assert.equal(board.lessonLock(N["M-S1"], new Set()), null, "スミさんの授業は錠なし（好感度・段の条件なし）");
const lessonStats = lessonPath;
assert.equal(board.lessonLock(N["M-S2"], new Set(lessonStats))?.heart, true, "アダムの授業は♥5が要る");
assert.equal(board.hasMet("adam"), false);
assert.equal(board.hasMet("sumi"), true, "スミさんは最初から知っている");
core.state.affinity.adam = 999;
assert.equal(board.lessonLock(N["M-S2"], new Set(lessonStats)), null, "♥5で開く");
assert.equal(board.hasMet("adam"), true);
// 灯すと今のゲームのフラグが立つ（アタックを習得）
g.nodes = []; g.paid = {};
const lessonRun = board.pendingTowards(g, lessonStats, "M-S1");
assert(lessonRun.includes("M-S1"), "錠が開けば道の先で教わる");
board.commitPending(lessonRun);
// 灯すと「相談できる」。習得（今のゲームのフラグ）は、次にスミさんに会って相談した時（SBD50）
assert.notEqual(core.state.flags._sumi_attack_learned, true, "灯しただけでは習得しない");
assert.deepEqual(growth.readyLessons("sumi").map((l) => l.id), ["M-S1"], "灯した授業はスミさんに相談できる");
assert.equal(growth.learnLesson("M-S1"), true);
assert.equal(core.state.flags._sumi_attack_learned, true, "相談して習得するとフラグが立つ");
assert.deepEqual(growth.readyLessons("sumi"), [], "習得した授業はもう相談に出ない");
assert.equal(growth.lessonLearned("M-S1"), true);
assert.equal(growth.learnLesson("M-W1"), false, "灯していない授業は習得できない");
core.state.affinity.adam = 0;

// 火種0でも、道が届いて章が開いた授業が受けられるなら「できることがある」（内省に入れる。#1801 引継ぎ A）
{
  const keep = { nodes: [...g.nodes], learned: [...g.learned], hidane: { ...g.hidane } };
  g.nodes = lessonStats.filter((id) => id !== "M-S1"); g.learned = []; g.hidane = { any: 0, body: 0, sense: 0, wisdom: 0 };
  assert.equal(status("M-S1"), "available");
  assert.equal(board.hasUsableHidane(g), true, "火種0でも授業が受けられる");
  g.nodes = [];
  assert.equal(board.hasUsableHidane(g), false, "道が届かず火種も無ければ、できることは無い");
  Object.assign(g, keep);
}

// 色の火種で詰まらない: 合計272（関門22ぶんの色＋万能）を、どんな順で灯しても全部灯せる（#1801 引継ぎ B）
{
  const keep = { nodes: [...g.nodes], learned: [...g.learned], hidane: { ...g.hidane }, earned: g.earned };
  core.state.chapter = 5;
  const metBefore = { ...core.state.met }, flagsBefore = { ...core.state.flags };
  core.state.met = { ...(core.state.met || {}) };
  for (const l of board.LESSONS) core.state.met[l.who] = true; // 小道は会った人の分だけ出るので、全員に会った状態で
  core.state.flags._ch4_sheikh_revealed = true;
  const gates = board.NODES.filter((n) => n.kind === "gate").length;
  const paid = board.NODES.filter((n) => n.cost > 0);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 30; trial++) {
    const colors = [0, 0, 0]; for (let i = 0; i < gates + 6; i++) colors[Math.floor(rnd() * 3)]++; // 色は偏って届く（関門より少し多い）
    g.nodes = []; g.learned = []; g.earned = board.BOARD_TOTAL_COST;
    g.hidane = { any: board.BOARD_TOTAL_COST - gates - 6, body: colors[0], sense: colors[1], wisdom: colors[2] };
    for (let guard = 0; guard < 400; guard++) {
      const view = board.replay(g, []);
      const open = paid.filter((n) => board.nodeStatus(n, g, view) === "available");
      if (!open.length) break;
      board.commitPending([open[Math.floor(rnd() * open.length)].id]);
    }
    assert.equal(paid.filter((n) => !g.nodes.includes(n.id)).length, 0, `試行${trial}: 全部灯せる`);
  }
  core.state.chapter = 1;
  core.state.met = metBefore; core.state.flags = flagsBefore;
  Object.assign(g, keep);
}

// 授業はいつも盤に出るが、その人に会っていて、その章まで来るまでは中身を伏せる（SBD67。シェイクは正体が明かされてから）
{
  const gg = growth.ensureGrowth();
  const known = (id) => board.lessonKnown(N[id], gg);
  assert.equal(board.lessonShown(N["M-B2"], gg), true, "授業のマスはいつも盤に出る");
  assert.equal(known("M-B2"), false, "まだ会っていない零の授業は伏せる");
  assert.equal(board.nodeStatus(N["M-B2"], gg, board.replay(gg, [])), "locked", "第1章では第2章の授業は封");
  assert.equal(board.NODES.filter((n) => n.trail).length, 0, "授業だけにつながる小道のマスは無い");
  assert.equal(known("M-S1"), true, "スミさんは最初から");
  core.state.affinity.rei = 1;
  assert.equal(known("M-B2"), false, "会っていても、その章まで来るまでは伏せる");
  core.state.chapter = 2;
  assert.equal(known("M-B2"), true, "会っていて、その章まで来たら分かる");
  core.state.affinity.rei = 0;
  assert.equal(known("M-B2"), false, "その章でも、会うまでは伏せる");
  assert.equal(board.nodeStatus(N["M-B2"], gg, board.replay(gg, [])), "sealed", "伏せている授業は灯せない");
  core.state.chapter = 5;
  core.state.affinity.sheikh = 1;
  assert.equal(known("M-W8"), false, "シェイクは正体が明かされるまで伏せる");
  core.state.flags._ch4_sheikh_revealed = true;
  assert.equal(known("M-W8"), true);
  core.state.affinity.sheikh = 0; delete core.state.flags._ch4_sheikh_revealed;
  core.state.affinity.hiyori = 1;
  assert.equal(known("M-B4"), false, "ひよりの授業は斧投げを明かすまで伏せる（SBD71）");
  core.state.flags._hiyori_real_self_known = true;
  assert.equal(known("M-B4"), true);
  core.state.affinity.hiyori = 0; delete core.state.flags._hiyori_real_self_known;
  core.state.chapter = 1;
}

// 20の授業すべてに、会って相談する場面がある（SBD70）。場面の台詞は growth_lessons.json か今のゲームの場面
{
  const files = ["growth_lessons", "ch1_sumi"].map((f) => JSON.parse(readFileSync(new URL(`../../data/dialogue/${f}.json`, import.meta.url), "utf8")).dialogues);
  const ids = new Set(files.flat().map((d) => d.dialogue_id));
  for (const l of board.LESSONS) {
    assert(l.scene, `${l.id}: 相談の場面がある`);
    assert(ids.has(l.scene), `${l.id}: 場面 ${l.scene} の台詞がある`);
  }
}

// 授業は会って相談した時だけ習う（SBD61: LIME では習えない）
{
  assert.equal(growth.canAskByLime, undefined, "LIME で聞く入口は無い");
  assert.equal(growth.consultByLime, undefined);
  const lime = JSON.parse(readFileSync(new URL("../../data/lime_messages.json", import.meta.url), "utf8")).messages;
  assert.equal(lime.filter((m) => m.id.startsWith("lime_lesson_") || m.trigger_condition === "lesson_consult").length, 0, "授業の LIME は無い");
  const gg = growth.ensureGrowth();
  const keep = { nodes: [...gg.nodes], learned: [...gg.learned] };
  gg.nodes.push("M-B2", "M-S2");
  assert.deepEqual(growth.readyLessons("rei").map((l) => l.id), ["M-B2"], "零の授業も会った時に相談できる（SBD70）");
  assert.deepEqual(growth.readyLessons("adam").map((l) => l.id), ["M-S2"], "場面がある授業は会った時に相談できる");
  Object.assign(gg, keep);
}

// 授業はマスとして数えない（2026-10-30 の選定で「能力が伸びるだけ」の授業は無くなった。仕組みは reward: "stat" で残す）
assert.equal(board.LESSONS.filter((l) => l.reward === "stat").length, 0);
assert.equal(board.statCount("sense", new Set(["M-S3"])), 0);
assert.equal(board.LESSONS.find((l) => l.id === "M-S3").name, "安心できる色");

// 第2章で第2章の範囲が開く
core.state.chapter = 2;
assert.equal(board.ringsOpen(), 2);
assert.notEqual(status(ring2.id), "locked");
core.state.chapter = 1;

// v2 の盤の灯し方は、払った火種を同じ種類で返して最初から（習得した授業は残す。SBD53）
{
  const old = growth.ensureGrowth();
  const keepLesson = old.nodes.find((id) => id.startsWith("M-"));
  core.state.growth = { ...JSON.parse(JSON.stringify(old)), boardVersion: undefined, nodes: ["B1", "K03", keepLesson], paid: { B1: { body: 1 }, K03: { any: 4 } }, hidane: { any: 0, body: 0, sense: 0, wisdom: 0 } };
  const after = growth.ensureGrowth();
  assert.deepEqual(after.nodes, [keepLesson]);
  assert.deepEqual([after.hidane.any, after.hidane.body], [4, 1]);
  assert.equal(after.boardVersion, growth.BOARD_VERSION);
  after.nodes.push("B1"); growth.ensureGrowth();
  assert(after.nodes.includes("B1"), "版が同じなら返さない");
  after.nodes = [keepLesson];
}

// 保存・読込と壊れた値
core.save(); core.load();
assert(core.state.growth.nodes.includes("M-S1"));
core.state.growth.nodes = "x"; core.state.growth.paid = [1]; core.state.growth.target = "nope";
const fixed = growth.ensureGrowth();
assert.deepEqual(fixed.nodes.filter((id) => !id.startsWith("M-")), []);
assert.deepEqual(Object.keys(fixed.paid).filter((id) => !id.startsWith("M-")), []);
assert.equal(fixed.target, null);

// #1774/#1801: 既存2授業の4状態と、実際の機能フラグの整合。
const { hasAttackTraining } = await import("../js/craft/attack-training.js");
const { hasCoalTraining } = await import("../js/craft/coals.js");
for (const [id, enabled] of [["M-S1", hasAttackTraining], ["M-W1", hasCoalTraining]]) {
  core.newGame();
  const node = N[id], flag = node.unlocks[0], gr = growth.ensureGrowth();
  core.state.affinity.sumi = 0;
  const result = { id: node.scene, visited: [node.scene] };
  assert.equal(enabled(core.state.flags), false);
  assert.deepEqual(growth.readyLessons("sumi"), []);
  assert.equal(growth.completeLesson(core.state, id, result), false, "未到達では台詞だけ読んでも習得しない");
  const path = board.pathTo(id, new Set()).path.filter((x) => x !== id);
  const stats = board.boardNodes(node.board).filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
  const enough = [...new Set([...path, ...stats])];
  gr.nodes = board.boardNodes(node.board).filter((n) => n.kind === "stat" && !node.links.includes(n.id)).slice(0, 8).map((n) => n.id);
  assert.deepEqual(board.commitPending([id]), [], "道が無ければ灯せない");
  gr.nodes = enough;
  const before = { wallet: { ...gr.hidane }, day: core.state.day, slot: core.state.slot, stamina: core.state.stamina };
  assert.deepEqual(board.commitPending([id]).map((n) => n.id), [id], "好感度0・火種0で授業を灯せる");
  assert.deepEqual(gr.hidane, before.wallet);
  assert.equal(enabled(core.state.flags), false, "灯しただけでは機能を解放しない");
  core.save(); core.load();
  const student = core.state;
  assert(growth.readyLessons("sumi").some((l) => l.id === id), "相談待ちはロード後も続く");
  for (const bad of [undefined, {}, { ...result, cancelled: true }, { ...result, visited: [] }, { ...result, id: "ch1_sumi_training" }]) {
    assert.equal(growth.completeLesson(student, id, bad), false);
    assert.equal(enabled(core.state.flags), false);
  }
  core.save(); core.load();
  assert.equal(growth.completeLesson(student, id, result), false, "ロード前の会話完了は無効");
  assert.equal(growth.completeLesson(core.state, id, result), true);
  assert.equal(enabled(core.state.flags), true);
  assert.equal(growth.completeLesson(core.state, id, result), false, "同じ授業の二重習得なし");
  assert.deepEqual(board.commitPending([id]), [], "二重灯しなし");
  core.load();
  assert.equal(enabled(core.state.flags), true, "相談完了時に保存される");
  assert.equal(growth.lessonLearned(id), true);
  assert.deepEqual(growth.readyLessons("sumi"), []);
  assert.deepEqual(core.state.growth.hidane, before.wallet);
  assert.deepEqual([core.state.day, core.state.slot, core.state.stamina], [before.day, before.slot, before.stamina], "授業で時間・体力を使わない");
  core.newGame(); core.state.flags[flag] = true;
  core.save(); core.load();
  const legacy = growth.ensureGrowth();
  assert(legacy.nodes.includes(id) && legacy.learned.includes(id), "旧習得済みは道なしでも保持");
  assert.equal(enabled(core.state.flags), true);
  assert.deepEqual(growth.readyLessons("sumi"), []);
  growth.ensureGrowth();
  assert.equal(legacy.nodes.filter((x) => x === id).length, 1);
  assert.equal(legacy.learned.filter((x) => x === id).length, 1);
}

// 盤は旧しくみの能力を書き換えない（試作の間）
core.newGame();
const before = { ...core.state.stats };
growth.ensureGrowth().hidane.any = 5;
board.commitPending([B, B2]);
assert.deepEqual(core.state.stats, before);

// 授業の手前のしくみ: 盤が有効ならスミさんの特訓・授業は tonari では出さない（盤の授業から受ける）
const attack = await import("../js/daily/attack-lesson.js");
const coal = await import("../js/daily/coal-lesson.js");
core.state.affinity.sumi = 999;
assert.equal(attack.canStudyAttack(), false);
assert.equal(coal.canStudyCubeCoals(), false);
growth.setGrowthPreview(false);
assert.equal(attack.canStudyAttack(), true, "盤が無効なら今のまま");
assert.equal(coal.canStudyCubeCoals(), true);

// メニュー: 無効なら出さない
assert.deepEqual(growth.growthMenuItems(), []);
growth.setGrowthPreview(true);
assert.equal(growth.growthMenuItems().length, 1);
growth.setGrowthPreview(false);
console.log("[growth board] PASS: v13 ring-tree boards (loops, forked perks, 3 notables, toll skills on loops), lessons farther by chapter with lessons right behind gates, peak only after filling the board, no steps (perk totals + ✦ squares), bands near×1/mid×2/beyond-gate×3, gates by colored hidane, 20 lessons (learn only by meeting in person), chapter reach + gate-free ch1 skills, 3 equal boards of 66 (198 total, 70% of every board in run 1), connect rules, replay, color-first payment, target path, lesson locks + flags, v2 refund, save/load, stats untouched, tonari lessons gated, menu gate");

// 組み直し: 実際の経路と支払を使う保存fixture。獲得ペースの通し証明とは分ける。
const respec = await import("../js/core/growth-respec.js");
const statCore = await import("../js/core/stats.js");
const clone = value => JSON.parse(JSON.stringify(value));
const funds = g => Object.values(g.hidane).reduce((a,b)=>a+b,0)
  + Object.values(g.paid).flatMap(pay=>Object.values(pay)).reduce((a,b)=>a+b,0);
core.newGame(); growth.setGrowthPreview(true);
let respecG = growth.ensureGrowth();
respecG.hidane={any:100,body:5,sense:5,wisdom:5}; respecG.earned=115;
for (const id of ["B1","M-W1","M-S1"]) {
  board.commitPending(board.pathTo(id,new Set(respecG.nodes)).path);
  assert(respecG.nodes.includes(id));
}
assert(growth.completeLesson(core.state,"M-W1",{id:N['M-W1'].scene,visited:[N['M-W1'].scene]}));
const rawBeforeRespec=clone(core.state.stats), maximumBeforeRespec=statCore.maxStamina();
assert.equal(respec.canRespec(respecG,core.state),false,"初周の最初は組み直し無し");
core.state.chapter=2;core.state.phase="opening";growth.ensureGrowth();
assert.equal(respec.canRespec(respecG,core.state),false);
core.state.day+=2;core.state.phase="daily";growth.ensureGrowth();
assert.equal(respec.canRespec(respecG,core.state),true,"冒頭イベント後の最初の日常で開く");
const paidGate=board.NODES.find(n=>n.kind==="gate"&&n.board==="body");
board.commitPending(board.pathTo(paidGate.id,new Set(respecG.nodes)).path);
assert.deepEqual(respecG.paid[paidGate.id],{body:1});
const fullBefore=clone(respecG), originalFunds=funds(respecG), resourcesBefore=clone({day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,money:core.state.money,reel:core.state.reel});
let transaction=respec.prepareRespec(respecG,core.state);
assert(transaction);assert.deepEqual(respecG,fullBefore,"仮状態を作っても実保存は変えない");
assert.deepEqual(transaction.growth.nodes,["M-W1","M-S1"]);
assert.deepEqual(transaction.growth.learned,["M-W1"]);
assert.equal(funds(transaction.growth),originalFunds);
for (const color of growth.HIDANE_KEYS) {
  const refund=Object.entries(fullBefore.paid).filter(([id])=>N[id].kind!=="lesson").reduce((sum,[,pay])=>sum+(pay[color]||0),0);
  assert.equal(transaction.growth.hidane[color],fullBefore.hidane[color]+refund,"支払った種類を変えずに返す");
}
for (const id of transaction.growth.nodes) {
  for (const neighbor of N[id].links.filter(id=>id!==board.HUB)) {
    const node=N[neighbor];if(node.links.includes(board.HUB))continue;
    assert.equal(board.connected(node,new Set(transaction.growth.nodes)),false,"保持授業から有料の道を無料で飛ばさない");
  }
}
const forged=clone(transaction);forged.growth.hidane.any++;
assert.equal(respec.commitRespec(respecG,forged,core.state),false,"返金額の改変を拒否");
assert(respec.commitRespec(respecG,transaction,core.state));
assert.equal(respec.commitRespec(respecG,transaction,core.state),false,"同じ返金を二度確定しない");
assert.equal(funds(respecG),originalFunds);assert.deepEqual(respecG.paid,{"M-W1":{},"M-S1":{}});
assert.equal(growth.lessonLearned("M-W1"),true);assert.equal(core.state.flags._coal_cube_learned,true);
assert.equal(growth.readyLessons("sumi").some(l=>l.id==="M-S1"),true);
assert.deepEqual(core.state.stats,rawBeforeRespec);
assert(statCore.maxStamina()<=maximumBeforeRespec);
assert.deepEqual({day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,money:core.state.money,reel:core.state.reel},resourcesBefore);
assert.equal(board.commitPending(["B1"]).length,1);assert.equal(funds(respecG),originalFunds);
core.save();core.load();respecG=growth.ensureGrowth();
assert.equal(funds(respecG),originalFunds);assert.equal(growth.lessonLearned("M-W1"),true);
transaction=respec.prepareRespec(respecG,core.state);assert(transaction);
const other=core.newState();other.growth=clone(respecG);
assert.equal(respec.commitRespec(respecG,transaction,other),false,"旧ownerは他の保存へ書かない");
await statCore.paidAction(()=>false,{consumed:()=>false});
assert.equal(respec.canRespec(respecG,core.state),true,"行動取消では閉じない");
await statCore.paidAction(()=>true,{consumed:()=>true});
assert.equal(respec.canRespec(respecG,core.state),false,"鍵無しの実行動でも閉じる");
assert.equal(respec.commitRespec(respecG,transaction,core.state),false);
const c3 = await import("../js/chapters/ch3-progress.js");
core.state.phase="cleared";
Object.assign(core.state.flags,{_ch2_cleared:true,_ch2_read_ch2_tournament_ageha_heart:true,_ch2_tournament:{stage:"complete"}});
assert(c3.advanceToChapterThree(core.state));growth.ensureGrowth();
while(!c3.chapterThreeFreeTime(core.state)) {
  const scene=c3.chapterThreeScenes(core.state)[core.state.flags._ch3_intro.stage];
  assert(scene);assert(c3.completeChapterThreeScene(core.state,scene.id));growth.ensureGrowth();
  if(!c3.chapterThreeFreeTime(core.state)) {
    assert.equal(respecG.respec.status,"pending","強制場面の日付変更では失効しない");
    assert.equal(respec.canRespec(respecG,core.state),false);
  }
}
assert.equal(c3.chapterThreeFreeTime(core.state).id,"d5-noon");
assert(respec.canRespec(respecG,core.state),"実進行の最初の自由時間で開く");
core.state.day++;growth.ensureGrowth();assert.equal(respec.canRespec(respecG,core.state),false);
core.state.chapter=4;growth.ensureGrowth();delete respecG.paid.B1;
assert.equal(respec.prepareRespec(respecG,core.state),null,"支払が無ければ無料返金を推測しない");
growth.setGrowthPreview(false);
await statCore.paidAction(()=>true,{consumed:()=>true});
growth.setGrowthPreview(true);
assert.equal(respec.canRespec(respecG,core.state),false,"無効中に済ませた行動の後から機会を復活させない");
const {buildCarryPackage}=await import("../js/core/carry.js"),{startNextCycle}=await import("../js/core/cycle-start.js");
startNextCycle(buildCarryPackage(core.state));core.state.phase="daily";respecG=growth.ensureGrowth();
assert(respec.canRespec(respecG,core.state),"周回はじめの最初の日常にも開く");
respecG.respec=null;core.state.chapter=3;growth.ensureGrowth();
assert.equal(respec.canRespec(respecG,core.state),false,"既存セーブの表示だけで旧移行特典を作らない");
growth.setGrowthPreview(false);
console.log("[respec] PASS: exact payments, lessons retained, no shortcut/duplicate refund, draft/commit, SAVE/LOAD, old owner, action/day/NG+ windows and legacy no-grant");
