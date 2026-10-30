// node remake/test/ngplus_cycle_start.mjs
// NG+（Issue #1228）: 周回開始・グループ選択・U2/U4 接続口（設計書 §2・§3・§8）。
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => store.clear(),
};
globalThis.sessionStorage ??= globalThis.localStorage;

const core = await import("../js/core/state.js");
const { newState, newGame, setState, save, SAVE_KEY } = core;
const { buildCarryPackage, KEEPSAKE_ORIGINS } = await import("../js/core/carry.js");
const { startNextCycle, difficultyEvidence, confirmRunDifficulty, isNextCycleUnlocked } = await import("../js/core/cycle-start.js");
const { CYCLE_META_KEY, CYCLE_META_VERSION } = await import("../js/core/cycle-meta.js");
const { maxStamina } = await import("../js/core/stats.js");
const { MAX_MONEY } = await import("../js/core/rules.js");
const { readGalleryProgress, GALLERY_PROGRESS_KEY } = await import("../js/core/gallery-progress.js");
const initial = newState();
const allGroups = { stats: true, money: true, items: true, knowledge: true };

// ---------------------------------------------------------------- A. 引き継ぎとリセット
const previous = newState();
Object.assign(previous, {
  chapter: 5, phase: "cleared", day: 20, stamina: 1, money: 2_000_000,
  stats: { technique: 71, sense: 62, guts: 85, charm: 54, insight: 43 },
  statXp: { technique: 0.7, guts: 0.2 },
  affinity: { minto: 99 }, affinityCarry: { minto: 0.5 }, loveCarry: { minto: 0.5 },
  lovers: ["minto"], loveLevel: { minto: 5 }, lovePts: { minto: 50 },
  loverSince: { minto: { chapter: 2, day: 3 } }, lastDate: { minto: 19 },
  loverEventsSeen: ["minto_1"], finales: { minto: { route: "lover" } },
  met: { minto: true }, romance: { minto: 3 }, story: { minto: 10 }, guilt: 4,
  romanceChoices: { choice: { char: "minto", value: 1 } }, friendHangouts: { minto: 2 },
  owned: [...initial.owned, "suyaki_minto", "hagal_80beat"],
  equip: { ...initial.equip, bowl: "suyaki_minto" },
  keepsakes: ["ryuji_purikura", "minto_first_cheki", "unclassified_souvenir"],
  flags: { _ch5_cleared: true, _gym_member: true, _motion_seen_intro: true, _confession_go: true },
  flavors: ["mint"], flavorStock: { mint: 120 }, flavorMastery: { mint: 36 },
  flavorLessons: ["mint_lesson"], recipes: { mint_mix: true }, best: { drill: 2 },
  goods: [{ name: "小物", sell: 100 }], kuji: { bronze: { drawn: 2, order: [1, 0] } },
});
previous.reel.count = 42;
previous.trpg.owned = ["scenario"];
setState(previous);
save();
assert.ok(readGalleryProgress().clearedChapters.includes(5));
const galleryBefore = localStorage.getItem(GALLERY_PROGRESS_KEY);
const previousBefore = structuredClone(previous);
const pkg = buildCarryPackage(previous);
const pkgBefore = structuredClone(pkg);
let notified;
const next = startNextCycle(pkg, { fromCycle: 1, onCycleStarted: value => {
  assert.equal(core.state.cycle, 2);
  assert.equal(core.state.cycleId, value.cycleId);
  assert.equal(core.state.stamina, maxStamina());
  notified = value;
} });
assert.strictEqual(core.state, next);
assert.equal(next.cycle, 2);
assert.notEqual(next.cycleId, previous.cycleId);
assert.deepEqual(next.stats, pkg.stats);
assert.deepEqual(next.cycleStartStats, pkg.stats);
assert.deepEqual(next.statsAtChapterStart, pkg.stats);
assert.notStrictEqual(next.cycleStartStats, next.stats);
assert.notStrictEqual(next.statsAtChapterStart, next.cycleStartStats);
for (const key of ["affinity", "affinityCarry", "loveCarry", "lovers", "loveLevel", "lovePts",
  "loverSince", "lastDate", "loverEventsSeen", "finales", "met", "romance", "story", "guilt",
  "romanceChoices", "friendHangouts", "chapter", "phase", "day", "tournament"]) {
  assert.deepEqual(next[key], initial[key], `初期値へ戻る: ${key}`);
}
assert.equal(next.money, pkg.money);
assert.ok(next.money <= MAX_MONEY);
assert.ok(!next.owned.includes("suyaki_minto"));
assert.equal(next.equip.bowl, initial.equip.bowl);
assert.ok(Object.values(next.equip).every(id => next.owned.includes(id)));
assert.deepEqual(next.keepsakes, pkg.keepsakes);
assert.ok(next.keepsakes.every(id => KEEPSAKE_ORIGINS[id] && KEEPSAKE_ORIGINS[id] !== "person"));
assert.deepEqual(next.flags, { _gym_member: true, _motion_seen_intro: true });
assert.equal(next.stamina, maxStamina());
assert.ok(next.stamina > initial.stamina, "引き継いだ根性が最大体力へ反映される");
assert.deepEqual(next.carryOptions, { groups: allGroups });
assert.deepEqual(notified, { cycle: 2, cycleId: next.cycleId, cycleStartStats: pkg.stats });
assert.deepEqual(JSON.parse(localStorage.getItem(SAVE_KEY)), next);
assert.equal(localStorage.getItem(GALLERY_PROGRESS_KEY), galleryBefore);
assert.ok(readGalleryProgress().clearedChapters.includes(5));
assert.deepEqual(previous, previousBefore);
assert.deepEqual(pkg, pkgBefore);
for (const key of Object.keys(pkg)) {
  // equip だけは §3.4-3 の既定装備への復旧を上で検証済み。
  if (key !== "equip") assert.deepEqual(next[key], pkg[key], `パッケージを加工しない: ${key}`);
  if (pkg[key] && typeof pkg[key] === "object") assert.notStrictEqual(next[key], pkg[key]);
}
next.goods[0].sell = 1;
next.stats.guts = 1;
assert.deepEqual(pkg, pkgBefore, "深い参照も共有しない");

// ---------------------------------------------------------------- B. グループオフと装備の境界
const disabled = startNextCycle(pkg, { fromCycle: 1, groups: { stats: false, money: false } });
assert.deepEqual(disabled.stats, initial.stats);
assert.deepEqual(disabled.statXp, initial.statXp);
assert.deepEqual(disabled.cycleStartStats, initial.stats);
assert.deepEqual(disabled.statsAtChapterStart, initial.stats);
assert.equal(disabled.money, 30000);
assert.deepEqual(disabled.carryOptions.groups, { ...allGroups, stats: false, money: false });
assert.deepEqual(difficultyEvidence(disabled), { cycle: 2, carryStats: false });
const allOff = startNextCycle(pkg, { fromCycle: 1, groups: { stats: false, money: false, items: false, knowledge: false } });
for (const key of ["owned", "equip", "goods", "kuji", "trpg", "flavorStock", "keepsakes",
  "flavors", "flavorMastery", "flavorLessons", "recipes", "best"]) assert.deepEqual(allOff[key], initial[key]);
assert.equal(allOff.reel.count, 0);
assert.deepEqual(allOff.flags, pkg.flags, "全グループオフでも carry flags は残る");
const noDefault = startNextCycle({ ...pkg, owned: ["hagal_80beat"], equip: { bowl: "missing", extra: "missing" } }, { fromCycle: 1 });
assert.deepEqual(noDefault.equip, {});
assert.equal(startNextCycle({ ...pkg, money: MAX_MONEY + 1 }, { fromCycle: 1 }).money, MAX_MONEY);

// ---------------------------------------------------------------- C. 難易度接続（決定的な時計・乱数で state 全体を比較）
assert.equal(confirmRunDifficulty(initial), 0);
assert.deepEqual(difficultyEvidence(initial), { cycle: 1, carryStats: false });
const realNow = Date.now;
const realRandom = Math.random;
try {
  Date.now = () => 123456789;
  Math.random = () => 0.5;
  const withoutSpy = structuredClone(startNextCycle(pkg, { fromCycle: 1 }));
  let calls = 0;
  const withSpy = startNextCycle(pkg, { fromCycle: 1, difficultyForRun: (s, evidence) => {
    calls++;
    assert.strictEqual(s, core.state);
    assert.equal(s.stamina, maxStamina());
    assert.deepEqual(evidence, { cycle: 2, carryStats: true });
    return 0;
  } });
  assert.equal(calls, 1);
  assert.deepEqual(withSpy, withoutSpy);
  assert.deepEqual(difficultyEvidence(withSpy), { cycle: 2, carryStats: true });
  assert.equal(confirmRunDifficulty(withSpy, () => 7), 7);
} finally {
  Date.now = realNow;
  Math.random = realRandom;
}

// ---------------------------------------------------------------- D. fromCycle の優先順位とメタ層の解放判定
assert.equal(startNextCycle({ ...pkg, fromCycle: 4 }, { fromCycle: 2 }).cycle, 5);
assert.equal(startNextCycle(pkg, { fromCycle: 2 }).cycle, 3);
assert.equal(startNextCycle(pkg).cycle, 4);
setState(null);
assert.equal(startNextCycle(pkg).cycle, 2);
localStorage.removeItem(CYCLE_META_KEY);
assert.ok(readGalleryProgress().clearedChapters.includes(5));
assert.equal(isNextCycleUnlocked(), false, "第5章クリアだけでは解放しない");
localStorage.setItem(CYCLE_META_KEY, JSON.stringify({ version: CYCLE_META_VERSION, unlocked: false }));
assert.equal(isNextCycleUnlocked(), false);
localStorage.setItem(CYCLE_META_KEY, JSON.stringify({ version: CYCLE_META_VERSION, unlocked: true }));
assert.equal(isNextCycleUnlocked(), true);
localStorage.setItem(CYCLE_META_KEY, JSON.stringify({ version: CYCLE_META_VERSION, unlocked: "true" }));
assert.equal(isNextCycleUnlocked(), false, "真偽値 true 以外は解放しない");
localStorage.setItem(CYCLE_META_KEY, JSON.stringify({ version: CYCLE_META_VERSION + 1, unlocked: true }));
assert.equal(isNextCycleUnlocked(), false, "未対応 version は採用しない");
localStorage.setItem(CYCLE_META_KEY, "{broken json");
assert.equal(isNextCycleUnlocked(), false, "壊れた保存は解放しない");
localStorage.removeItem(CYCLE_META_KEY);

// ---------------------------------------------------------------- E. 1周目への無影響（§3.3）
for (const fresh of [newState(), newGame()]) {
  assert.equal(fresh.cycle, 1);
  assert.equal(fresh.carryOptions, null);
  assert.deepEqual(fresh.stats, initial.stats);
  assert.deepEqual(fresh.cycleStartStats, initial.stats);
  assert.equal(fresh.money, 30000);
}
assert.ok(readGalleryProgress().clearedChapters.includes(5));
console.log("ngplus cycle start: PASS (carry/reset, groups, equipment, save/gallery, difficulty hooks, cycle source, first run)");

// 恋人EXPは通常プレイでも保存。盤の公開・能力の変更と切り離し、previewと同じ台帳を引き継ぐ。
const growth = await import("../js/core/growth.js");
const { awardLoverSceneExp } = await import("../js/core/lover-rewards.js");
growth.setGrowthPreview(false);
newGame(); core.state.lovers = ["rin"];
const abilityBefore = structuredClone(core.state.stats);
assert.equal(awardLoverSceneExp("lover_rin_lv1", core.state), 20);
assert.equal(awardLoverSceneExp("lover_rin_lv1", core.state), 0);
assert.equal(growth.gainExp(100), 0, "他のEXP源を先行公開しない");
assert.equal(growth.awardSlotExp("big"), 0);
assert.equal(growth.settleGrowth(), null);
assert.equal(core.state.growth.level, 1); assert.equal(growth.hidaneTotal(), 0);
const held = structuredClone(core.state.growth);
save(); newGame(); core.load();
assert.deepEqual(core.state.growth, held);
assert.equal(awardLoverSceneExp("lover_rin_lv1", core.state), 0, "保存後も一度だけ");
growth.setGrowthPreview(true);
assert.deepEqual(core.state.growth, held, "previewへ切り替えるだけでは加算・精算しない");
assert.equal(awardLoverSceneExp("lover_rin_lv1", core.state), 0);
growth.gainExp(300);
growth.settleGrowth();
const settled = structuredClone(core.state.growth);
assert.equal(settled.xp, 320); assert.equal(settled.level, 2);
growth.setGrowthPreview(false);
assert.deepEqual(core.state.growth, settled, "通常へ戻しても失わない");
assert.equal(awardLoverSceneExp("lover_rin_lv2", core.state), 20);
assert.equal(growth.settleGrowth(), null, "通常プレイで火種を配らない");
assert.deepEqual(core.state.stats, abilityBefore);
assert.equal(core.state.growth.xp, 340);
core.state.growth.fresh.counts.rin = 4;
core.state.growth.firsts.people.push("rin");
core.state.growth.gifted.rin = true;
const expSource = structuredClone(core.state), expPackage = buildCarryPackage(core.state);
assert.deepEqual(core.state, expSource, "引継ぎ抽出で元セーブを変えない");
assert.equal(expPackage.flags._lover_exp_lover_rin_lv1, undefined);
assert.deepEqual(expPackage.growth.fresh, { chapter: 1, counts: {} });
assert.deepEqual(expPackage.growth.firsts, { people: [], places: [] });
assert.deepEqual(expPackage.growth.gifted, {});
const nextExp = startNextCycle(expPackage);
assert.equal(nextExp.growth.xp, 340); assert.equal(nextExp.growth.settledXp, 320);
assert.equal(nextExp.growth.level, 2); assert.equal(nextExp.growth.today.xp, 20);
assert.deepEqual(nextExp.growth.hidane, settled.hidane);
assert.deepEqual(nextExp.lovers, []);
assert.notStrictEqual(nextExp.growth, expPackage.growth);
assert.notStrictEqual(nextExp.growth.hidane, expPackage.growth.hidane);
nextExp.lovers = ["rin"];
assert.equal(awardLoverSceneExp("lover_rin_lv1", nextExp), 20, "新しい周回で実際に読むと再獲得");
assert.equal(expPackage.growth.xp, 340);
save(); newGame(); core.load();
assert.equal(core.state.growth.xp, 360);
growth.setGrowthPreview(true);
assert.equal(awardLoverSceneExp("lover_rin_lv1", core.state), 0);
const resettled = growth.settleGrowth();
assert.equal(resettled.to, resettled.from); assert.deepEqual(core.state.growth.hidane, settled.hidane);
growth.setGrowthPreview(false);
assert.equal(startNextCycle(expPackage, { groups: { stats: false } }).growth, undefined);
assert.equal(startNextCycle(buildCarryPackage(newState())).growth, undefined, "旧セーブに成長台帳を捏造しない");
console.log("lover EXP: PASS (normal awards, preview switch, save/load, NG+ carry/reset, no duplicate settlement or ability gains)");
