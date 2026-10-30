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

// ---------------------------------------------------------------- データ検査（2.9・v3）
const SHAPE_SIZE = { body: [19, 4], sense: [20, 2], wisdom: [22, 3] }; // [能力のマス（極みを含む）, 関門]
for (const k of board.BOARD_KEYS) {
  const layout = board.LAYOUTS[k];
  for (const c of layout.cells) assert(Math.abs(c.x) <= board.GRID.w && Math.abs(c.y) <= board.GRID.h, `${k}: 13×9 に収まる`);
  for (const [a, b] of layout.edges) {
    const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, "線は上下左右の隣だけ（斜めなし）");
  }
}
assert.notDeepEqual(board.LAYOUTS.body.edges, board.LAYOUTS.sense.edges, "盤によって形が違う");
assert.notDeepEqual(board.LAYOUTS.sense.edges, board.LAYOUTS.wisdom.edges);
const expect = { body: [6, 6], sense: [6, 6], wisdom: [5, 8] }; // 授業20（追加の6人を含む。SBD57）
for (const k of board.BOARD_KEYS) {
  const nodes = board.boardNodes(k);
  assert.equal(nodes.filter((n) => n.kind === "stat").length, SHAPE_SIZE[k][0], `${k}: 能力のマス`);
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
      for (const n of nodes) if (n.ring <= ring && !reach.has(n.id) && n.links.some((l) => l === board.HUB || reach.has(l))) { reach.add(n.id); more = true; }
    }
    assert.deepEqual(nodes.filter((n) => n.ring <= ring && !reach.has(n.id)).map((n) => n.id), [], `${k} 第${ring}章`);
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
// 授業の小道（2026-10-30 オーナー選択）: どの授業も紋から能力のマス3つ（関門なし）で届き、小道はその人の章で開く。
// 第1章で誰の授業へ進んだかで、ほかの人の授業までの火種が変わらない。
const RING_ROAD = ["1,0", "1,1", "0,1", "-1,1", "-1,0", "-1,-1", "0,-1", "1,-1"];
for (const k of board.BOARD_KEYS) for (const key of RING_ROAD) assert.equal(board.LAYOUTS[k].cells.find((c) => c.key === key)?.ring, 1, `${k} ${key}: 一周の道は最初から開く`);
for (const l of board.LESSONS) {
  const route = board.pathTo(l.id, new Set()).path.filter((id) => id !== l.id);
  assert.equal(route.length, 2, `${l.id}: 紋から2マス（一周の道）`);
  assert(route.every((id) => N[id].kind === "stat"), `${l.id}: 関門なし`);
  assert.equal(N[l.id].ring, 1, `${l.id}: 章では封じない（会った時に現れる）`);
  // ほかの授業を全部取った後でも、この授業までの残りは同じ（どの順に仲良くしても遠くならない）
  const others = new Set(board.LESSONS.filter((x) => x.id !== l.id && x.board === l.board).flatMap((x) => board.pathTo(x.id, new Set()).path));
  assert(board.pathTo(l.id, others).cost <= 2, `${l.id}: 先に進んだ道で遠くならない`);
}

// 各スキル・授業は、データの章（届けたい章）までに開く
for (const item of [...board.SKILLS, ...board.LESSONS]) assert(N[item.id].ring <= (item.ring ?? 1), `${item.id} の章`);
assert.equal(board.SKILLS.length, 17);
assert.equal(board.SKILLS.reduce((n, s) => n + s.cost, 0), 49, "スキルの火種 49（2・3・4）");
assert.equal(board.BOARD_TOTAL_COST, 119, "盤の全部で119（1レベル1つ。1周目で3盤とも7割。SPEC 1.6a）");
assert(84 >= 0.7 * board.BOARD_TOTAL_COST, "中央の1周目の火種（約84）で、3つの盤をどれも7割まで開ける");
assert.equal(board.BOARD_TOTAL_COST, growth.BOARD_TOTAL, "盤の全部と火種の上限が同じ");
const cumulative = [1, 2, 3, 4, 5].map((r) => board.NODES.filter((n) => n.ring <= r).reduce((a, n) => a + n.cost, 0));
const received = [15, 30, 45, 60, 84]; // 中央の遊び方で章末までに受け取る火種（1.6。1レベル1つ）
cumulative.forEach((c, i) => assert(c > received[i], `第${i + 1}章: 開く範囲（${c}）が受け取る火種（${received[i]}）より多い`));
for (let i = 1; i < 5; i++) assert(cumulative[i] > cumulative[i - 1], `第${i + 1}章で新しい範囲が開く`);
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

// 段: 能力のマス約2つで1段（3.1。才能盤は19マスで10段。1レベル1つの小さな盤）
assert.equal(board.stepOf("body", new Set()), 1);
const five = new Set(["B1", "B2", "B3"]);
assert.equal(board.statCount("body", five), 3);
assert.equal(board.stepOf("body", five), 2, "3マスで2段");
assert.equal(board.stepOf("body", new Set(["B1"])), 1, "1マスではまだ1段");
assert.equal(board.squaresToNextStep("body", new Set(["B1"])), 2, "あと2つで2段");
assert.equal(board.stepOf("body", new Set(board.boardNodes("body").filter((n) => n.kind === "stat").map((n) => n.id))), 10);
assert.equal(board.statRatio("body", five), 3 / board.STAT_SQUARES.body);
for (const k of board.BOARD_KEYS) {
  const all = board.boardNodes(k).filter((n) => n.kind === "stat").map((n) => n.id);
  for (let n = 0; n <= all.length; n++) {
    const set = new Set(all.slice(0, n));
    if (board.stepOf(k, set) < 10) assert.equal(board.stepOf(k, new Set(all.slice(0, n + board.squaresToNextStep(k, set)))), board.stepOf(k, set) + 1, `${k} ${n}: あとNマスで次の段`);
  }
}

// 払い方: その盤の色の火種を先に、足りない分を万能で（1.9）
assert.deepEqual(board.paymentFor(N.K03, { any: 1, body: 1 }), { any: 1, body: 1 }, "万能を先に、足りない分を色で");
assert.deepEqual(board.paymentFor(N.K03, { any: 9, body: 9 }), { any: 2 }, "万能が足りれば色は使わない");
assert.equal(board.paymentFor(N.K03, { any: 1, sense: 9 }), null, "ほかの色は使えない");
assert.deepEqual(board.paymentFor(N["M-S1"], {}), {}, "授業は火種いらず");
// 色の予約: まだ越えていない関門の数ぶんの色は、普通のマスに使わない（#1801 引継ぎ B）
assert.equal(board.paymentFor(N.K03, { any: 0, body: 2 }, { reserve: 1 }), null, "色2のうち1は関門用に残すので、色1では2に足りない");
assert.deepEqual(board.paymentFor(N.K03, { any: 0, body: 2 }, { reserve: 0 }), { body: 2 });
assert.equal(board.paymentFor(N.B1, { any: 0, body: 1, sense: 1 }, { reserve: 2 }), null, "色は全部関門の予約");
// 関門: 色つきの火種でだけ越える。その盤の色が先、無ければほかの色（SBD53）
assert.deepEqual(board.paymentFor(N.BG1, { any: 9, body: 1, sense: 1 }), { body: 1 });
assert.deepEqual(board.paymentFor(N.BG1, { any: 9, sense: 1 }), { sense: 1 }, "ほかの色でも越えられる");
assert.deepEqual(board.paymentFor(N.BG1, { any: 9 }, { capped: true }), { any: 1 }, "もう色が来ない（受け取りの上限）なら万能でも越えられる");
assert.equal(board.paymentFor(N.BG1, { any: 9 }), null, "万能の火種では越えられない");
assert.equal(N.BG1.kind, "gate");
assert.equal(board.nodeLabel(N.BG1), "才能の関門");

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

// 授業の錠（2.6）: 盤2段（v3）＋スミさんは条件なし／ほかは♥5。まだ会っていない相手は伏せる
g.hidane.any = 50;
const senseStats = board.boardNodes("sense").filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
const lessonPath = board.pathTo("M-S1", new Set()).path.filter((id) => id !== "M-S1");
assert.equal(status("M-S1"), "sealed", "感覚盤1段では錠");
const lock = board.lessonLock(N["M-S1"], new Set(lessonPath));
assert.equal(lock?.step, true, "道は届いても2段に足りない");
const six = [...new Set([...lessonPath, ...senseStats])].slice(0, Math.max(5, lessonPath.length));
assert.equal(board.lessonLock(N["M-S1"], new Set(six)), null, "2段でスミさんの授業は開く（好感度の条件なし）");
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
  g.nodes = six.filter((id) => id !== "M-S1"); g.learned = []; g.hidane = { any: 0, body: 0, sense: 0, wisdom: 0 };
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

// 授業はその人に会うまで盤に出ない（シェイクは正体が明かされてから）
{
  const gg = growth.ensureGrowth();
  assert.equal(board.lessonShown(N["M-B2"], gg), false, "まだ会っていない零の授業は出ない");
  assert.equal(board.nodeStatus(N["M-B2"], gg, board.replay(gg, [])), "hidden");
  assert.equal(board.NODES.filter((n) => n.trail).length, 0, "授業は一周の道の角の隣（小道のマスは無い）");
  assert.equal(board.lessonShown(N["M-S1"], gg), true, "スミさんは最初から");
  core.state.affinity.rei = 1;
  assert.equal(board.lessonShown(N["M-B2"], gg), true, "会うと現れる");
  core.state.affinity.rei = 0;
  core.state.affinity.sheikh = 1;
  assert.equal(board.lessonShown(N["M-W8"], gg), false, "シェイクは正体が明かされるまで出ない");
  core.state.flags._ch4_sheikh_revealed = true;
  assert.equal(board.lessonShown(N["M-W8"], gg), true);
  core.state.affinity.sheikh = 0; delete core.state.flags._ch4_sheikh_revealed;
}

// 会えない人には LIME で聞ける: 相談の場面がまだ無い人はいつでも、場面がある人は地元を離れている章（2〜4）だけ
{
  const gg = growth.ensureGrowth();
  const keep = { nodes: [...gg.nodes], learned: [...gg.learned] };
  gg.nodes.push("M-B2", "M-S2");
  assert.equal(growth.canAskByLime("M-B2"), true, "零（場面なし）は LIME で聞ける");
  assert.equal(growth.canAskByLime("M-S2"), false, "第1章のアダムは店で会って相談");
  core.state.chapter = 3;
  assert.equal(growth.canAskByLime("M-S2"), true, "東京にいる間は LIME で");
  core.state.chapter = 5;
  assert.equal(growth.canAskByLime("M-S2"), false, "第5章はどこへでも行けるので会って相談");
  assert.equal(growth.canAskByLime("M-B3"), false, "灯していない授業は聞けない");
  gg.learned.push("M-B2");
  assert.equal(growth.canAskByLime("M-B2"), false, "習得済みは聞かない");
  core.state.chapter = 1;
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
console.log("[growth board] PASS: v3 shapes per board (cross/pinwheel/tree), gates by colored hidane, 20 lessons (consult to learn, LIME when you can't meet), lessons next to the ring road (2 squares each, shown when you meet the person), chapter reach + gate-free ch1 skills, 119 total (70% of every board in run 1), connect rules, replay, color-first payment, steps ~2-3 squares, target path, lesson locks + flags, v2 refund, save/load, stats untouched, tonari lessons gated, menu gate");
