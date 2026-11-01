import assert from "node:assert/strict";
globalThis.document = { addEventListener() {} }; globalThis.window = {};
const stored = new Map();
globalThis.localStorage = { getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k) };
const core = await import("../js/core/state.js"), growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js"), stats = await import("../js/core/stats.js");
const effects = await import("../js/core/growth-effects.js");
const { gainFlavorExperience } = await import("../js/core/flavor-mastery.js");
const { leafDamagePerPull } = await import("../js/craft/flavor-life.js");
const { skill } = await import("../js/craft/common.js");
const { bonusOf } = await import("../js/craft/score.js");
core.newGame(); growth.setGrowthPreview(true);
const g = growth.ensureGrowth(); g.hidane.any=3;
const before = { day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:{...core.state.stats} };
assert.equal(stats.maxStamina(),100);
assert.equal(board.commitPending(["B1"]).length,1);
assert.equal(stats.maxStamina(),102,"B1の表示どおり最大体力+2");
assert.equal(board.commitPending(["B1"]).length,0);
core.save(); core.load();
assert.equal(stats.maxStamina(),102); assert.equal(core.state.growth.hidane.any,2);
assert.deepEqual({ day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:core.state.stats },before);
growth.setGrowthPreview(false); assert.equal(stats.maxStamina(),100);
growth.setGrowthPreview(true);
for (const raw of [10,21,48,80,100]) {
  for (const key of core.STAT_KEYS) core.state.stats[key]=raw;
  growth.setGrowthPreview(false); const legacy={ maximum:stats.maxStamina(),slow:skill.slow({}),window:skill.window({}) };
  growth.setGrowthPreview(true);
  assert(stats.maxStamina()>=legacy.maximum); assert(skill.slow({})>=legacy.slow); assert(skill.window({})>=legacy.window);
}
core.newGame(); growth.ensureGrowth();
// 表示する恩恵と同じ値で、帯・要・色の台座・重複を検査する。
for (const key of board.BOARD_KEYS) {
  const nodes=board.boardNodes(key).filter(n=>["stat","gate"].includes(n.kind));
  const sums=effects.boardPerks(nodes.map(n=>n.id));
  for (const p of board.perkTotals(key,new Set(nodes.map(n=>n.id)))) assert.equal(sums[p.key],p.sum);
}
assert.deepEqual(effects.boardPerks(["B1","B1","unknown"]),effects.boardPerks(["B1"]));
assert.deepEqual(effects.boardPerks({}),effects.boardPerks([]));
const nodeFor = perk => board.NODES.find(n=>n.kind==="stat"&&!n.peak&&n.perk===perk);
const cs={ mix:{ lemon:12 },steamSeconds:360 };
const baseDamage=leafDamagePerPull(cs,{ lemon:{mix_life:1} });
core.state.growth.nodes=[nodeFor("leaf").id];
assert(leafDamagePerPull(cs,{ lemon:{mix_life:1} })<baseDamage);
core.state.growth.nodes=[nodeFor("tongue").id];
gainFlavorExperience(core.state,{ lemon:12 },10);
assert(core.state.flavorMastery.lemon>10);
core.state.growth.nodes=[nodeFor("gauge").id]; assert(skill.slow({})>1);
core.state.growth.nodes=[nodeFor("heat").id]; assert(skill.window({})>1); assert.equal(skill.window({},"pull"),1);
core.state.growth.nodes=[nodeFor("pull").id]; assert(skill.window({},"pull")>1); assert.equal(skill.window({}),1);
core.state.growth.nodes=[nodeFor("stage").id]; assert(bonusOf({mode:"tournament"}).bonus>0);
assert.equal(bonusOf({mode:"practice"}).bonus,0);
growth.setGrowthPreview(false); assert.equal(bonusOf({mode:"tournament"}).bonus,0);
console.log("[growth effects] PASS: B1 real effect, time/stamina/old stats unchanged, reload, no duplication, legacy floors, UI totals, leaf/mastery/gauge/heat/pull/stage and mode off");
