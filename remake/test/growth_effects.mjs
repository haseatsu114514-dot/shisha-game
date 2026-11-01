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
const { steamHeartRadius } = await import("../js/craft/steam.js");
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
  assert.equal(stats.maxStamina(),legacy.maximum+2,"旧能力が高くてもB1の+2を加算する");
  assert.equal(skill.slow({}),legacy.slow); assert.equal(skill.window({}),legacy.window);
}
const legacyStats = JSON.stringify(core.state.stats);
core.state.stamina=81;
assert.equal(stats.maxStamina(),162);
assert.equal(stats.currentCondition().health,"green","容量を増やしただけで旧体調を悪化させない");
assert.equal(stats.maxStamina({forCondition:true}),160);
for (let i=0;i<3;i++) {
  core.save(); core.load();
  assert.equal(stats.maxStamina(),162,"LOADのたびに効果を積み増さない");
  assert.equal(JSON.stringify(core.state.stats),legacyStats); assert.equal(core.state.stamina,81);
}
core.state.growth.nodes=board.NODES.filter(n=>["stat","gate"].includes(n.kind)).map(n=>n.id);
assert.equal(stats.maxStamina(),189,"旧最大体力160に盤の29を加算できる");
core.state.stamina=189; core.save(); core.load();
assert.equal(core.state.stamina,189); assert.equal(stats.maxStamina(),189);
for (const schema of [8,21,23,core.SCHEMA]) {
  const old=core.newState(); old.schema=schema;
  for (const key of core.STAT_KEYS) old.stats[key]=100;
  old.stamina=81;
  stored.set(core.SAVE_KEY,JSON.stringify(old)); core.load();
  assert.equal(stats.maxStamina(),160); assert.equal(stats.currentCondition().health,"green");
  growth.ensureGrowth().hidane.any=1; board.commitPending(["B1"]);
  for (let i=0;i<2;i++) {
    core.save(); core.load();
    assert.equal(stats.maxStamina(),162); assert.equal(core.state.stamina,81);
    assert.equal(core.state.growth.hidane.any,0);
    assert.equal(core.state.growth.nodes.filter(id=>id==="B1").length,1);
    for (const key of core.STAT_KEYS) assert.equal(core.state.stats[key],100);
  }
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
assert.deepEqual(effects.boardPerks([{},null,0,["B1"],{toString:"B1"},"__proto__"]),effects.boardPerks([]));
const nodeFor = perk => board.NODES.find(n=>n.kind==="stat"&&!n.peak&&n.perk===perk);
// 旧強化が最大でも、新しいマスの恩恵が止まらない。
Object.assign(core.state.stats,{technique:100,sense:100,guts:100,charm:100});
core.state.growth.nodes=[nodeFor("gauge").id]; assert(skill.slow({})>1.18);
core.state.growth.nodes=[nodeFor("heat").id]; assert(skill.window({})>1.45);
core.state.growth.nodes=[nodeFor("dodge").id]; assert(steamHeartRadius()<3.2);
core.state.growth.nodes=["B4"]; core.state.fortune={char:"adam"};
stats.gainAffinity("adam",1,{source:"lime",onGain(){}});
const totalAffinity = () => (core.state.affinity.adam||0)+(core.state.affinityCarry.adam||0);
assert(Math.abs(totalAffinity()-(2+.015)*.85*.25)<1e-10,"旧報酬と盤の端数へ占いを一度だけ適用");
assert.equal(core.state.fortune,undefined);
stats.gainAffinity("adam",1,{source:"lime",onGain(){}});
assert(Math.abs(totalAffinity()-((2+.015)+(1+.01))*.85*.25)<1e-10);
core.newGame(); growth.ensureGrowth();
const cs={ mix:{ lemon:12 },steamSeconds:360 };
const baseDamage=leafDamagePerPull(cs,{ lemon:{mix_life:1} });
core.state.growth.nodes=[nodeFor("leaf").id];
assert(leafDamagePerPull(cs,{ lemon:{mix_life:1} })<baseDamage);
core.state.growth.nodes=[nodeFor("tongue").id];
gainFlavorExperience(core.state,{ lemon:12 },10);
assert(core.state.flavorMastery.lemon>10);
// 旧セーブの不足補完は、今の盤の熟練度倍率で過去の報酬を増やさない。
core.state.schema=23; core.state.story.rin=4;
core.save(); core.load();
assert.equal(core.state.flavorMastery.rose,6); assert.equal(core.state.flavorMastery.lychee,6);
assert.equal(core.state.flavorMastery.blueberry,12);
const migrated=JSON.stringify(core.state.flavorMastery); core.save(); core.load();
assert.equal(JSON.stringify(core.state.flavorMastery),migrated);
core.state.growth.nodes=board.NODES.filter(n=>n.perk==="sleep").map(n=>n.id);
core.state.stamina=20; stats.addStamina(14,{sleep:true});
assert(core.state.stamina>34,"睡眠だけに眠りの回復倍率を適用");
core.state.stamina=20; stats.addStamina(14); assert.equal(core.state.stamina,34);
core.state.growth.nodes=[nodeFor("gauge").id]; assert(skill.slow({})>1);
core.state.growth.nodes=[nodeFor("heat").id]; assert(skill.window({})>1); assert.equal(skill.window({},"pull"),1);
core.state.growth.nodes=[nodeFor("pull").id]; assert(skill.window({},"pull")>1); assert.equal(skill.window({}),1);
core.state.growth.nodes=[nodeFor("stage").id]; assert(bonusOf({mode:"tournament"}).bonus>0);
assert.equal(bonusOf({mode:"practice"}).bonus,0);
growth.setGrowthPreview(false); assert.equal(bonusOf({mode:"tournament"}).bonus,0);
// スキルは確定済みIDから一度だけ作用する。通常マスと重なり、無効時と通常回復には漏れない。
growth.setGrowthPreview(true); core.newGame(); growth.ensureGrowth();
core.state.growth.nodes=["K09","K09"];
gainFlavorExperience(core.state,{lemon:12},10);
assert.equal(core.state.flavorMastery.lemon,12);
core.state.growth.nodes.push(nodeFor("tongue").id);
const priorMastery=core.state.flavorMastery.lemon;
gainFlavorExperience(core.state,{lemon:12},10);
assert(core.state.flavorMastery.lemon-priorMastery>12);
core.state.growth.nodes=["K17","K17"];
assert(Math.abs(leafDamagePerPull(cs,{lemon:{mix_life:1}})-baseDamage*.8)<1e-12);
core.state.growth.nodes=["K03","K03"];
core.state.stamina=0; stats.addStamina(40,{sleep:true}); assert.equal(core.state.stamina,44);
core.state.stamina=0; stats.addStamina(40); assert.equal(core.state.stamina,40);
core.save(); core.load();
core.state.stamina=0; stats.addStamina(40,{sleep:true}); assert.equal(core.state.stamina,44);
growth.setGrowthPreview(false);
core.state.stamina=0; stats.addStamina(40,{sleep:true}); assert.equal(core.state.stamina,40);
assert(!effects.growthSkill(core.state,"K03"));
// 新しいスキルも実際の制作セッションへ反映し、日常の体力・旧能力を変えない。
growth.setGrowthPreview(true);core.newGame();growth.ensureGrowth();
const session=await import("../js/craft/session.js");
const steam=await import("../js/craft/steam.js");
core.state.stamina=20;core.state.growth.nodes=["K12"];
const tournament=session.newSession("tournament");
assert.equal(tournament.condition.health,"yellow");assert.equal(stats.currentCondition().health,"red");
assert.equal(core.state.stamina,20);assert.equal(session.newSession("rehearsal").condition.health,"red");
core.state.stamina=0;session.strainBench(tournament);assert.equal(tournament.condition.health,"yellow");
core.newGame();growth.ensureGrowth().nodes=["K08"];core.state.stamina=100;
const fatigued=session.newSession("rehearsal");
for(const expected of [0,1,2,3]) {session.strainBench(fatigued,4);assert.equal(fatigued.strain,expected);}
assert.equal(core.state.stamina,88);assert.equal(fatigued.strainRemainder,0);
core.state.growth.nodes=["K06"];assert.equal(steam.refreshStock(),2);
core.state.growth.nodes=["K13"];assert(steam.refreshEffect({mode:"tournament"}).mentalRecovery);
assert(!steam.refreshEffect({mode:"rehearsal"}).mentalRecovery);
const mentalNode=board.NODES.find(n=>n.feature==="mental");core.state.growth.nodes=[mentalNode.id];
assert(steam.refreshEffect({mode:"rehearsal"}).mentalRecovery);
for(const feature of ["pairing","golden","mental"]) {
 const n=board.NODES.find(x=>x.feature===feature);core.state.growth.nodes=[n.id,n.id];
 assert(effects.growthFeature(core.state,feature));
}
growth.setGrowthPreview(false);assert.equal(steam.refreshStock(),1);
assert.equal(session.newSession("tournament").condition.health,stats.currentCondition().health);
// 授業は灯しただけで発動せず、相談完了後の実効値を保存から再構成する。
growth.setGrowthPreview(true);core.newGame();growth.ensureGrowth().nodes=["M-B4"];
core.state.stats.guts=100;core.state.stamina=81;
assert.equal(stats.maxStamina(),160);assert.equal(effects.growthLesson(core.state,"M-B4"),false);
assert(growth.learnLesson("M-B4"));assert.equal(stats.maxStamina(),180);
assert.equal(core.state.stamina,81);assert.equal(stats.currentCondition().health,"green");
core.save();core.load();assert.equal(stats.maxStamina(),180);assert.equal(core.state.growth.learned.length,1);
growth.setGrowthPreview(false);assert.equal(stats.maxStamina(),160);
growth.setGrowthPreview(true);core.newGame();growth.ensureGrowth();
const {readFileSync}=await import("node:fs"),{DB}=await import("../js/core/data.js");
const fixture=name=>JSON.parse(readFileSync(new URL(`../../data/${name}.json`,import.meta.url),"utf8"));
DB.flavors=fixture("flavors").flavors;DB.flavorById=Object.fromEntries(DB.flavors.map(f=>[f.id,f]));
DB.recipes=fixture("recipes").recipes;DB.ngMixes=fixture("ng_mixes").ng_mixes;
const {evaluateMix}=await import("../js/craft/steps.js");
const mixScore=mix=>evaluateMix({mode:"rehearsal",mix,equip:{}});
for(const [id,mix,miss] of [
 ["M-S6",{blueberry:3,lemon:9},{blueberry:1,lemon:11}],
 ["M-B5",{black_tea:2,lemon:10},{black_tea:3,lemon:9}],
 ["M-W6",{double_apple:5,coconut:5,cardamom:2},{double_apple:4,coconut:4,cardamom:4}],
]) {
 core.state.growth.nodes=[];core.state.growth.learned=[];
 const base=mixScore(mix),wrong=mixScore(miss);
 core.state.growth.nodes=[id];assert.equal(mixScore(mix).score,base.score,"相談前には授業の恩恵を付けない");
 assert(growth.learnLesson(id));assert(mixScore(mix).score>base.score);
 assert.equal(mixScore(miss).score,wrong.score,"指定比率から外れた配合へ授業を付けない");
 const once=mixScore(mix);assert.deepEqual(mixScore(mix),once,"再評価で効果を積み増さない");
 core.save();core.load();assert.equal(mixScore(mix).score,once.score);
 growth.setGrowthPreview(false);assert.equal(mixScore(mix).score,base.score);growth.setGrowthPreview(true);
}
console.log("[growth effects] PASS: additive legacy growth, 160+29=189, no resource use or repeated LOAD gain, condition boundaries, fractional affinity/fortune, UI totals, leaf/mastery/gauge/heat/pull/stage and mode off");
