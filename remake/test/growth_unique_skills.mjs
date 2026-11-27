// 心得の盤のユニークなスキル（2026-11-20 SBD154）: 聞き上手（K25）・くじ運（K26）・仕事が早い（K27）の効き目。
// 仕事が早いは 2026-11-27（SBD157）に店番のシャッフルの速さへつなぎ直した。同じ時に足した店番のスキル（K28〜K30）の盤からの受け渡しもここで見る
// （営業の中の効き目は tonari_floor_model.mjs）。
// 灯していなければ今までと同じ、灯すと決めた分だけ変わる。くじ運は箱の中身と枚数を変えない。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const stats = await import("../js/core/stats.js");
const effects = await import("../js/core/growth-effects.js");
const { luckyOrder, KUJI_HIGH } = await import("../js/daily/kuji-luck.js");
const { NODE_BY_ID: N } = board;

// ---- 盤のデータ: 各盤に1つ、火種2、第2章から、紋の上の道の脇
const unique = { K25: ["body", "聞き上手"], K26: ["sense", "くじ運"], K27: ["wisdom", "仕事が早い"] };
for (const [id, [b, name]] of Object.entries(unique)) {
  const n = N[id];
  assert.deepEqual([n.kind, n.board, n.name, n.cost, n.ring], ["skill", b, name, 2, 2], `${id} のデータ`);
  assert.equal(board.pathTo(id, new Set()).cost, 4, `${id}: 紋から 能力のマス2つ＋火種2`);
}
assert.equal(growth.BOARD_TOTAL, 204, "盤の全部（＝受け取りの上限）は 198 → 204");
assert.equal(growth.BOARD_VERSION, 16, "v16（SBD157）で店番のスキルを足した");

// ---- 聞き上手: 通いの小会話の好感度に＋2（段階の会話は変えない）
const s = core.newGame();
Object.assign(s, { phase: "daily", chapter: 2 });
const g = growth.ensureGrowth();
assert.deepEqual([stats.visitAffinity("talk"), stats.visitAffinity("story")], [8, 15], "灯していなければ小会話8・物語15");
g.nodes.push("K25");
assert.deepEqual([stats.visitAffinity("talk"), stats.visitAffinity("story")], [10, 15], "聞き上手: 小会話だけ＋2");
assert.equal(stats.LISTEN_BONUS, effects.SKILL_TUNING.listen, "足す点は1か所の値");
s.chapter = 5;
assert.deepEqual([stats.visitAffinity("talk"), stats.visitAffinity("story")], [9, 12], "第5章（ゆっくり上がる）でも小会話に＋2");
s.chapter = 2;
g.nodes.length = 0;
assert.equal(stats.visitAffinity("talk"), 8, "外せば戻る（組み直し）");

// ---- くじ運: 後ろ半分の上の賞が前半へ。中身と枚数は同じ
const prizes = [{ rank: "S" }, { rank: "A" }, { rank: "B" }, { rank: "C" }];
const order = [2, 3, 3, 2, 3, 3, 2, 3, 3, 3, /* 後ろ半分 */ 3, 0, 3, 1, 3, 2, 3, 1, 3, 3];
const counts = (list) => list.reduce((m, i) => (m[i] = (m[i] || 0) + 1, m), {});
const highFront = (list) => list.slice(0, list.length / 2).filter((i) => KUJI_HIGH.has(prizes[i].rank)).length;
assert.equal(luckyOrder(order, prizes, false), order, "くじ運が無ければそのまま");
const always = luckyOrder(order, prizes, true, 1, () => 0);
assert.deepEqual(counts(always), counts(order), "箱の中身と枚数は変わらない");
assert.equal(always.length, order.length);
assert.equal(highFront(order), 0);
assert.equal(highFront(always), 3, "確率1なら、後ろ半分の上の賞3枚がすべて前半へ");
assert.deepEqual(luckyOrder(order, prizes, true, 0.5, () => 0.9), order, "外れた時（乱数が確率以上）は動かさない");
assert.notEqual(always, order, "元の並びは書き換えない");
// 既定の確率（SKILL_TUNING.kujiLuck）で、前半の上の賞の数が平均して増える
{
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let base = 0, lucky = 0;
  for (let i = 0; i < 400; i++) {
    const shuffled = order.slice().sort(() => random() - 0.5);
    base += highFront(shuffled);
    lucky += highFront(luckyOrder(shuffled, prizes, true, effects.SKILL_TUNING.kujiLuck, random));
  }
  assert(lucky > base * 1.3, `前半の上の賞が増える（${base} → ${lucky}）`);
}
const kujiSource = readFileSync(new URL("../js/daily/kuji.js", import.meta.url), "utf8");
assert.match(kujiSource, /order: luckyOrder\(shuffle\(order\), g\.prizes, growthSkill\(state, "K26"\), SKILL_TUNING\.kujiLuck\)/, "新しい箱を作る時だけ寄せる");

// ---- 仕事が早い: 店番のシャッフルが2秒→1秒（SBD157。基本の日当の1割の上乗せは無くした）
assert.equal(N.K27.scene, "店番");
assert.equal(effects.SKILL_TUNING.quickShuffle, 0.5);
assert.equal(effects.SKILL_TUNING.baitoPay, undefined, "日当の上乗せは無い");
const tonari = readFileSync(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
assert.doesNotMatch(tonari, /quickPay|baitoPay/, "日当の手当に足さない");

// ---- 店番のスキル（SBD157）: 盤から店番へ渡す値。灯していなければ素の決まり
{
  const floor = { K27: ["wisdom", "仕事が早い"], K28: ["body", "売り上手"], K29: ["sense", "波に乗る"], K30: ["wisdom", "フロアを読む"] };
  for (const [id, [b, name]] of Object.entries(floor)) {
    assert.deepEqual([N[id].kind, N[id].board, N[id].name, N[id].cost, N[id].ring, N[id].scene], ["skill", b, name, 2, 2, "店番"], `${id} のデータ`);
  }
  g.nodes.length = 0;
  const none = effects.growthFloorPerks(s);
  assert.deepEqual(none, { floorRare: 0, floorTop: 0, floorMatch: 0, shuffleScale: 1, commission: 0, feverTables: 0, floorRead: false });
  g.nodes.push("K27", "K28", "K29", "K30");
  assert.deepEqual(effects.growthFloorPerks(s), { floorRare: 0, floorTop: 0, floorMatch: 0, shuffleScale: 0.5, commission: 3, feverTables: 1, floorRead: true });
  // 能力のマスの恩恵（#4255）はそのまま一緒に渡る
  const matchSquare = board.boardNodes("wisdom").find((n) => n.perk === "floorMatch" && n.band === 1);
  g.nodes.push(matchSquare.id);
  assert.equal(effects.growthFloorPerks(s).floorMatch, 8);
  g.nodes.length = 0;
  globalThis.localStorage.setItem("suien_growth_preview", "0");
  assert.equal(effects.growthFloorPerks(s), null, "盤が無効なら店番は素の決まり");
  globalThis.localStorage.removeItem("suien_growth_preview");
}

console.log("[growth unique skills] PASS: K25 listen +2 on small talks only, K26 kuji luck keeps the box and moves high prizes forward, K27 now speeds up the floor shuffle and K28-K30 hand commission / fever / floor reading to the floor shift (SBD157), board 204 / v16");
