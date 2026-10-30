// 心得の盤のデータと規則（SPEC 第2版 2.2〜2.6・2.9・1.9・3.1）。
import assert from "node:assert/strict";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const { NODE_BY_ID: N } = board;

// ---------------------------------------------------------------- データ検査（2.9）
assert.equal(board.LAYOUT.cells.length, 36, "9×7 の方眼に36マス");
assert.equal(board.LAYOUT.cells.filter((c) => c.special).length, 10, "要所10か所");
for (const c of board.LAYOUT.cells) {
  assert(Math.abs(c.x) <= 4 && Math.abs(c.y) <= 3, "9×7 に収まる");
  assert(board.LAYOUT.cells.some((d) => d.x === -c.x && d.y === -c.y), "点対称");
}
for (const [a, b] of board.LAYOUT.edges) {
  const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
  assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, "線は上下左右の隣だけ（斜めなし）");
}
const expect = { body: [6, 1], sense: [6, 3], wisdom: [5, 3] };
for (const k of board.BOARD_KEYS) {
  const nodes = board.boardNodes(k);
  assert.equal(nodes.filter((n) => n.kind === "stat").length, 27, `${k}: 能力のマス27`);
  assert.equal(nodes.filter((n) => n.kind === "skill").length, expect[k][0], `${k}: スキル`);
  assert.equal(nodes.filter((n) => n.kind === "lesson").length, expect[k][1], `${k}: 授業`);
  assert.equal(new Set(nodes.map((n) => n.cell)).size, nodes.length, "1マスに1つ");
  assert.equal(nodes.filter((n) => n.peak).length, 1, "極みは1つ");
  for (const n of nodes.filter((x) => x.kind !== "stat" || x.peak)) assert(board.LAYOUT.cells.find((c) => `${c.x},${c.y}` === n.cell).special, `${n.id} は要所`);
  // どの章のマスも、その章までに開くマスだけで紋から届く（2.3）
  for (let ring = 1; ring <= 5; ring++) {
    const reach = new Set();
    for (let more = true; more;) {
      more = false;
      for (const n of nodes) if (n.ring <= ring && !reach.has(n.id) && n.links.some((l) => l === board.HUB || reach.has(l))) { reach.add(n.id); more = true; }
    }
    assert.deepEqual(nodes.filter((n) => n.ring <= ring && !reach.has(n.id)).map((n) => n.id), [], `${k} 第${ring}章`);
  }
}
assert.equal(board.SKILLS.length, 17);
assert.equal(board.SKILLS.reduce((n, s) => n + s.cost, 0), 98, "スキルの火種 98");
assert.equal(board.BOARD_TOTAL_COST, 179);
assert.equal(board.BOARD_TOTAL_COST, growth.BOARD_TOTAL, "盤の全部と火種の上限が同じ");
const cumulative = [1, 2, 3, 4, 5].map((r) => board.NODES.filter((n) => n.ring <= r).reduce((a, n) => a + n.cost, 0));
assert.deepEqual(cumulative, [60, 96, 129, 170, 179], "章の範囲ごとの火種（1.6 の表）");
assert(board.LESSONS.every((l) => N[l.id].cost === 0), "授業は火種いらず");
for (const k of board.BOARD_KEYS) assert.equal(board.STEP_TEXT[k].length, 10);
assert.equal(board.rankOfStep("wisdom", 1), "見習い");
assert.equal(board.rankOfStep("wisdom", 10), "神業");

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

// 段: 能力のマス3つで1段（3.1）
assert.equal(board.stepOf("body", new Set()), 1);
const three = new Set(["B1", "B2", "B3"]);
assert.equal(board.statCount("body", three), 3);
assert.equal(board.stepOf("body", three), 2);
assert.equal(board.stepOf("body", new Set(board.boardNodes("body").filter((n) => n.kind === "stat").map((n) => n.id))), 10);
assert.equal(board.statRatio("body", three), 3 / 27);

// 払い方: その盤の色の火種を先に、足りない分を万能で（1.9）
assert.deepEqual(board.paymentFor(N.K03, { any: 3, body: 1 }), { body: 1, any: 3 });
assert.deepEqual(board.paymentFor(N.K03, { any: 9, body: 9 }), { body: 4 });
assert.equal(board.paymentFor(N.K03, { any: 1, sense: 9 }), null, "ほかの色は使えない");
assert.deepEqual(board.paymentFor(N["M-S1"], {}), {}, "授業は火種いらず");

// 確定: 払った種類を記録し、火種を減らす。節目の色のために灯した数を数える
g.hidane = { any: 2, body: 1, sense: 0, wisdom: 0 };
const committed = board.commitPending([B, B2]);
assert.deepEqual(committed.map((n) => n.id), [B, B2]);
assert.deepEqual(g.paid, { [B]: { body: 1 }, [B2]: { any: 1 } });
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

// 授業の錠（2.6）: 盤3段＋スミさんは条件なし／ほかは♥5。まだ会っていない相手は伏せる
g.hidane.any = 50;
const senseStats = board.boardNodes("sense").filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
const lessonPath = board.pathTo("M-S1", new Set()).path.filter((id) => id !== "M-S1");
assert.equal(status("M-S1"), "sealed", "感覚盤1段では錠");
const lock = board.lessonLock(N["M-S1"], new Set(lessonPath));
assert.equal(lock?.step, true, "道は届いても3段に足りない");
const six = [...new Set([...lessonPath, ...senseStats])].slice(0, Math.max(6, lessonPath.length));
assert.equal(board.lessonLock(N["M-S1"], new Set(six)), null, "3段でスミさんの授業は開く（好感度の条件なし）");
assert.equal(board.lessonLock(N["M-S2"], new Set(six))?.heart, true, "アダムの授業は♥5が要る");
assert.equal(board.hasMet("adam"), false);
assert.equal(board.hasMet("sumi"), true, "スミさんは最初から知っている");
core.state.affinity.adam = 999;
assert.equal(board.lessonLock(N["M-S2"], new Set(six)), null, "♥5で開く");
assert.equal(board.hasMet("adam"), true);
// 灯すと今のゲームのフラグが立つ（アタックを習得）
g.nodes = []; g.paid = {};
const lessonRun = board.pendingTowards(g, six, "M-S1");
assert(lessonRun.includes("M-S1"), "錠が開けば道の先で教わる");
board.commitPending(lessonRun);
assert.equal(core.state.flags._sumi_attack_learned, true);
core.state.affinity.adam = 0;

// 授業はマスとして数えない（2026-10-30 の選定で「能力が伸びるだけ」の授業は無くなった。仕組みは reward: "stat" で残す）
assert.equal(board.LESSONS.filter((l) => l.reward === "stat").length, 0);
assert.equal(board.statCount("sense", new Set(["M-S3"])), 0);
assert.equal(board.LESSONS.find((l) => l.id === "M-S3").name, "安心できる色");

// 第2章で第2章の範囲が開く
core.state.chapter = 2;
assert.equal(board.ringsOpen(), 2);
assert.notEqual(status(ring2.id), "locked");
core.state.chapter = 1;

// 保存・読込と壊れた値
core.save(); core.load();
assert(core.state.growth.nodes.includes("M-S1"));
core.state.growth.nodes = "x"; core.state.growth.paid = [1]; core.state.growth.target = "nope";
const fixed = growth.ensureGrowth();
assert.deepEqual(fixed.nodes.filter((id) => !id.startsWith("M-")), []);
assert.deepEqual(Object.keys(fixed.paid).filter((id) => !id.startsWith("M-")), []);
assert.equal(fixed.target, null);

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
console.log("[growth board] PASS: v2 layout 36 cells/10 spots, 3 boards 27+skills+lessons, chapter reach, 179 totals, connect rules, replay, color-first payment, steps by 3, target path, lesson locks + flags, save/load, stats untouched, tonari lessons gated, menu gate");
