// 経験値・レベル・火種の芯（SPEC 1.2〜1.5・1.9・6.1a、REPORT R1・R4・R7）。GROWTH_BOARD の裏で動く。
import assert from "node:assert/strict";
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const stats = await import("../js/core/stats.js");
const { on } = await import("../js/core/bus.js");
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// 曲線（1.5 の表）
assert.equal(growth.GROWTH_BOARD, false, "盤の画面ができるまで既定で無効");
for (const [lv, total] of [[1, 0], [2, 205], [5, 850], [10, 2025], [20, 4750], [40, 11700], [80, 31600]]) assert.equal(growth.totalExpFor(lv), total, `Lv.${lv}`);
assert.equal(growth.expToNext(79), 595);
assert.equal(growth.levelForExp(204), 1);
assert.equal(growth.levelForExp(205), 2);
assert.equal(growth.levelForExp(1e9), 80);
assert.deepEqual([1, 2, 3, 4, 5, 9].map(growth.freshness), [1, 1, 0.8, 0.6, 0.4, 0.4]);

// 無効のときは状態も通知も増やさない（旧しくみのまま）
core.newGame();
core.state.phase = "daily";
const chips = [];
on("exp-gain", (c) => chips.push(c));
assert.equal(growth.growthEnabled(), false);
assert.equal(growth.gainExp(100), 0);
const off = await stats.paidAction(async () => { stats.addStamina(-10); return true; }, { exp: { key: "naru", person: "naru" } });
assert.equal(off.spent > 0, true);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.equal(growth.settleGrowth(), null);

// 有効: 自由行動 X1〜X3、新鮮さ、1行動1枚のチップ
growth.setGrowthPreview(true);
assert.equal(growth.growthEnabled(), true);
core.newGame();
core.state.phase = "daily";
const statsBefore = { ...core.state.stats };
const visit = (target, run = async () => { stats.addStamina(-4); return true; }) => stats.paidAction(run, { exp: target });
await visit({ key: "naru", person: "naru" });
const g = core.state.growth;
assert.equal(g.xp, 70, "初めての相手: 30＋40");
assert.deepEqual(g.firsts.people, ["naru"]);
await tick(10);
assert.equal(chips.length, 1, "1行動につきチップ1枚");
assert.deepEqual(chips[0], { total: 70, tags: ["はじめて"] });
assert.deepEqual(Object.keys(core.state.stats).map((k) => core.state.stats[k] >= statsBefore[k]), [true, true, true, true, true], "旧しくみの能力は下がらない");
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 100, "2回目は満額・はじめて無し");
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 124, "3回目 ×0.8");
await tick(10);
assert.deepEqual(chips.at(-1), { total: 24, tags: ["なじみ"] });
await visit({ key: "naru", person: "naru" });
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 124 + 18 + 12, "4回目 ×0.6、5回目 ×0.4");
// 体力を使わない行動・中断は数えない
await visit({ key: "kannon", place: "kannon" }, async () => false);
assert.equal(g.xp, 154);
assert.equal(g.fresh.counts.kannon, undefined);
// 関数で結果から鍵を決める（tonari のサブメニュー）
await stats.paidAction(async () => { stats.addStamina(-24); return { sub: "baito" }; }, { exp: (r) => ({ key: `tonari_${r.sub}`, place: `tonari_${r.sub}` }) });
assert.equal(g.xp, 224);
assert.equal(g.today.learned.tonari_baito, 70);

// 好感度の段（X4）は自由行動の中だけ。行動中の分は行動のチップへ合算する
const before = g.xp;
stats.gainAffinity("tsumugi", 12); // 行動の外（LIMEや強制イベント相当）
await tick(800);
assert.equal(g.xp, before, "行動の外の好感度では入らない");
const chipCount = chips.length;
await visit({ key: "minto", person: "minto" }, async () => { stats.addStamina(-16); stats.gainAffinity("minto", 12); return true; });
assert.equal(g.xp, before + 30 + 40 + 30, "段1つで +30");
await tick(800);
assert.equal(chips.length, chipCount + 1, "好感度の段も同じ1枚に");
assert.deepEqual(chips.at(-1).tags.sort(), ["はじめて", "仲が深まった"].sort());

// 章が変わると新鮮さは数え直し、章倍率が掛かる
core.state.chapter = 2;
const xp2 = g.xp;
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp - xp2, 38, "第2章 30×1.25 を四捨五入、新鮮さはリセット");
core.state.chapter = 1;

// 寝る時の精算: レベルと火種、今日の分、冪等
const lvBefore = g.level;
assert.equal(lvBefore, 1, "日中はレベルが上がらない");
const pending = growth.pendingLevels();
assert.equal(pending, growth.levelForExp(g.xp) - 1);
const first = growth.settleGrowth();
assert.equal(first.from, 1);
assert.equal(first.to, growth.levelForExp(g.xp));
assert.equal(first.full, true, "初めてのレベルアップはフル演出");
assert.equal(g.hidane.any, first.to - 1);
assert.equal(g.earned, first.to - 1);
assert.equal(g.settledXp, g.xp);
assert.deepEqual(g.today, { xp: 0, learned: {} });
assert.ok(first.learned.length <= 3 && first.learned.includes("naru"), "今日学んだこと（最大3つ）");
const again = growth.settleGrowth();
assert.equal(again.to, again.from, "二度精算しても増えない");
assert.equal(g.earned, first.to - 1);

// 2回目以降の1レベルは短い帯、2つ以上はフル
growth.gainExp(growth.totalExpFor(g.level + 1) - g.xp);
const one = growth.settleGrowth();
assert.equal(one.to - one.from, 1);
assert.equal(one.full, false, "ふだんの1レベルは短い帯");
growth.gainExp(growth.totalExpFor(g.level + 2) - g.xp);
const two = growth.settleGrowth();
assert.equal(two.to - two.from, 2);
assert.equal(two.full, true, "1晩に2つ以上はフル");

// 節目 Lv.10: 2つ目は系統限定（盤が無い間は一番段の低い系統）
core.state.stats = { technique: 48, sense: 44, guts: 12, charm: 16, insight: 27 };
growth.gainExp(growth.totalExpFor(10) - g.xp);
const earnedBefore = g.earned;
const ms = growth.settleGrowth();
assert.equal(ms.to, 10);
assert.equal(ms.full, true, "節目はフル");
assert.deepEqual(ms.gains.limited, [{ level: 10, system: "guts" }], "根性12・魅力16 → 段2どうしは技→感→根→魅→察の順で根性");
assert.equal(g.hidane.guts, 1);
assert.equal(g.earned - earnedBefore, ms.to - ms.from + 1);
assert.deepEqual(g.milestones, [10]);

// ゲージ（6.1a）
const gauge = growth.gaugeAt(12, growth.totalExpFor(12) + 130, growth.totalExpFor(12) + 200);
assert.equal(gauge.settled, 0.5);
assert.equal(Math.round(gauge.now * 1000), 769);
assert.equal(gauge.left, 60);
assert.equal(gauge.pending, 0);
const over = growth.gaugeAt(12, growth.totalExpFor(12), growth.totalExpFor(13) + 80);
assert.deepEqual([over.now, over.pending, over.overflow, over.left], [1, 1, 80, 0]);
assert.equal(growth.gaugeAt(9, 0, 0).nextMilestone, true);
assert.equal(growth.gaugeAt(80, 0, 0).max, true);

// 保存・読込・壊れた値
core.save(); core.load();
assert.equal(core.state.growth.level, 10);
assert.equal(core.state.growth.hidane.guts, 1);
core.state.growth = { level: 99, xp: -5, hidane: "x", milestones: [3, 10], firsts: null };
const fixed = growth.ensureGrowth();
assert.equal(fixed.level, 1);
assert.equal(fixed.xp, 0);
assert.equal(growth.hidaneTotal(fixed), 0);
assert.deepEqual(fixed.milestones, [10]);
// 上限: 盤の86個を超えて渡さない
core.state.growth = { ...growth.newGrowth(), earned: 85 };
growth.gainExp(growth.totalExpFor(12));
const capped = growth.settleGrowth();
assert.equal(core.state.growth.earned, 86);
assert.equal(capped.boardFull, true);

// 無効へ戻すと新しいゲームには growth が無い
growth.setGrowthPreview(false);
core.newGame();
assert.equal(core.state.growth, undefined);
console.log("[growth levelup] PASS: curve, flag off, X1-X4 + freshness, one chip per action, chapter mult, night settlement, short/full, milestone hidane, gauge, save/load, cap");
