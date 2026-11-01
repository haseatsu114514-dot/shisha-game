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
const {evaluateMix}=await import("../js/craft/steps.js");
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
// 香りの記憶・メモ魔: 実際の配合と完成品スコアを保存し、再計算・LOAD・旧ownerで重ねない。
const memory=await import("../js/core/growth-memory.js"),{finalize}=await import("../js/craft/score.js");
core.newGame();growth.ensureGrowth().nodes=["K02","K24"];
const resources=()=>JSON.stringify({day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:core.state.stats,reel:core.state.reel});
const untouched=resources();
memory.rememberGrowthMix(core.state,{lemon:9,mint:3});
core.state.recipes.ice_lemonade={day:1};
const made=care=>{
 const cs=session.newSession("tournament");Object.assign(cs,{mix:{lemon:9,mint:3},pack:"normal",steamSeconds:360,
  holes:{score:90,total:24,minimumComplete:true,outerEven:1,innerExcess:0},heat:{score:90,heatPower:70,heatStability:90,burnRisk:5,aromaRetention:90},
  steam:{score:90,hits:0,seconds:360,temp:.55},pull:{score:90,temp:.55,pulls:3},pullDone:true,careHistory:[{score:care},{score:care}]});
 cs.mixInfo=evaluateMix(cs);return cs;
};
const firstCraft=made(80);finalize(firstCraft);
const firstMemo=memory.growthCraftMemo(core.state,"ice_lemonade");
assert(firstMemo,JSON.stringify({score:firstCraft.total,recipe:firstCraft.mixInfo.recipe?.id,memory:core.state.growth.memory}));
assert.equal(firstMemo.total,firstCraft.total);assert.equal(firstMemo.previousTotal,null);
finalize(firstCraft);assert.deepEqual(memory.growthCraftMemo(core.state,"ice_lemonade"),firstMemo);
core.save();core.load();assert.deepEqual(memory.growthCraftMemo(core.state,"ice_lemonade"),firstMemo);
const nextCraft=made(95);finalize(nextCraft);
const nextMemo=memory.growthCraftMemo(core.state,"ice_lemonade");
assert(nextMemo.total>firstMemo.total);assert.equal(nextMemo.previousTotal,firstMemo.total);
finalize(firstCraft);assert.deepEqual(memory.growthCraftMemo(core.state,"ice_lemonade"),nextMemo,"古いownerの再計算は新しいセーブへ書かない");
assert.equal(resources(),untouched);assert.equal(core.state.growth.xp,0);
let options=memory.growthRecallOptions(core.state,DB.recipes,DB.flavorById,["lemon","mint"]);
assert.deepEqual(options.find(x=>x.id==="last").mix,{lemon:9,mint:3});
assert.deepEqual(options.find(x=>x.id==="ice_lemonade").mix,nextMemo.mix);
core.state.recipes.test_recall={day:1};
const secretRecipe={id:"test_recall",name:"記録のない配合",flavors:["lemon","mint"],get golden(){throw Error("黄金比を呼び出しへ使わない");}};
options=memory.growthRecallOptions(core.state,[secretRecipe],DB.flavorById,["lemon","mint"]);
assert.deepEqual(options.find(x=>x.id==="test_recall").mix,{lemon:8,mint:4});
assert(!memory.growthRecallOptions(core.state,[secretRecipe],DB.flavorById,["lemon"]).some(x=>x.id==="test_recall"));
const {buildCarryPackage}=await import("../js/core/carry.js");
assert.deepEqual(buildCarryPackage(core.state).growth.memory,core.state.growth.memory);
growth.setGrowthPreview(false);assert.deepEqual(memory.growthRecallOptions(core.state,DB.recipes,DB.flavorById,["lemon","mint"]),[]);
assert.equal(memory.growthCraftMemo(core.state,"ice_lemonade"),null);
// 空模様は翌日の同じ抽選結果を読むだけ。取得・表示・無効化で種や日付を動かさない。
const weather=await import("../js/daily/weather.js");growth.setGrowthPreview(true);core.newGame();core.state.phase="daily";
growth.ensureGrowth().nodes=["K05"];
for(const seed of [0,4,100,99999]) for(let day=1;day<14;day++) {
 core.state.weatherSeed=seed;core.state.day=day;const before=JSON.stringify(core.state);
 assert.equal(weather.tomorrowForecast(),weather.WEATHER_LABEL[weather.weatherOf(day+1)]);
 assert.equal(JSON.stringify(core.state),before);
}
delete core.state.weatherSeed;assert.equal(weather.tomorrowForecast(),null);assert.equal(core.state.weatherSeed,undefined);
growth.setGrowthPreview(false);assert.equal(weather.tomorrowForecast(),null);
// デンスパックは新しい盤で習得し、旧保存の利用権は移行・再LOAD・周回で保持する。
growth.setGrowthPreview(true);core.newGame();assert(!effects.densePackAvailable(core.state));
growth.ensureGrowth().nodes=["K18"];assert(effects.densePackAvailable(core.state));
core.newGame();const oldDense=core.newState();oldDense.schema=24;
for(const key of core.STAT_KEYS) oldDense.stats[key]=100;
stored.set(core.SAVE_KEY,JSON.stringify(oldDense));core.load();
assert.equal(core.state.schema,25);assert(effects.densePackAvailable(core.state));
core.save();core.load();assert(effects.densePackAvailable(core.state));
for(const key of core.STAT_KEYS) assert.equal(core.state.stats[key],100);
assert.equal(buildCarryPackage(core.state).flags._dense_pack_legacy,true);
// 会話の気配は指定済みの普通の会話だけ。強制場面・恋愛の決断・変更済みの選択は示さない。
core.newGame();growth.ensureGrowth().nodes=["K07"];
const hints=JSON.parse(readFileSync(new URL("../data/fortune-choice-hints.json",import.meta.url),"utf8"));
const hint=hints.choices["ch1_naru_first:naru_first_scout"];
const choiceLine={id:"naru_first_scout",choices:hint.options.map(next=>({text:next,next}))};
const choiceBefore=JSON.stringify(core.state);
assert.equal(effects.growthChoiceIndex(core.state,"ch1_naru_first",choiceLine,hints,true),hint.options.indexOf(hint.preferred));
assert.equal(effects.growthChoiceIndex(core.state,"ch1_naru_first",choiceLine,hints,false),-1);
assert.equal(effects.growthChoiceIndex(core.state,"ch1_naru_first",{...choiceLine,choices:[...choiceLine.choices].reverse()},hints,true),-1);
assert.equal(effects.growthChoiceIndex(core.state,"ch1_tsumugi_bond_question",{id:"bond_q1_tsumugi",choices:choiceLine.choices},hints,true),-1);
assert.equal(JSON.stringify(core.state),choiceBefore);
// 顔が広いは既存の未読遭遇の間隔だけを縮め、初回紹介や面識の条件を飛ばさない。
const {spotEncounterDue}=await import("../js/daily/spot-encounters.js");
core.state.met.naru=true;core.state.flags._spot_seen_cafe_naru_break=true;core.state.flags._spot_last_cafe=2;
const encounters={cafe_naru_break:{},cafe_maezono_break:{}};
assert.equal(spotEncounterDue("cafe",3,core.state,encounters),null);
core.state.growth.nodes=["K19"];assert.equal(spotEncounterDue("cafe",3,core.state,encounters,{wide:effects.growthSkill(core.state,"K19")}),"cafe_maezono_break");
assert.equal(spotEncounterDue("cafe",1,core.state,encounters),null);
// 目利きの価格は同日再表示とLOADで同一。表示と会計が同じ関数を使う。
const {shopFlavorPrice,SHOP_FLAVORS}=await import("../js/daily/shop.js");
core.state.growth.nodes=["K23"];const shopBefore=JSON.stringify(core.state);
const prices=()=>SHOP_FLAVORS.map(id=>shopFlavorPrice(DB.flavorById[id],SHOP_FLAVORS));
const firstPrices=prices();assert.equal(firstPrices.filter((price,i)=>price<DB.flavorById[SHOP_FLAVORS[i]].price).length,2);
assert.deepEqual(prices(),firstPrices);assert.equal(JSON.stringify(core.state),shopBefore);
core.save();core.load();assert.deepEqual(prices(),firstPrices);
growth.setGrowthPreview(false);assert.deepEqual(prices(),SHOP_FLAVORS.map(id=>DB.flavorById[id].price));
// 単体の美学は、授業を習い選んだ一種の一台だけ。旧来の単体を弱くしない。
growth.setGrowthPreview(true);core.newGame();growth.ensureGrowth().nodes=["M-S2"];
const singleCs={mode:"rehearsal",chapter:1,mix:{double_apple:12},masteryAtStart:{double_apple:60}};
const singleBase=evaluateMix(singleCs).score;singleCs.singleStyle=true;
assert.equal(evaluateMix(singleCs).score,singleBase,"灯すだけでは習得しない");
core.state.growth.learned=["M-S2"];assert.equal(evaluateMix(singleCs).score,singleBase+4);
assert.equal(evaluateMix({...singleCs,masteryAtStart:{}}).score,singleBase,"熟練度が無ければ加点しない");
assert.equal(evaluateMix({...singleCs,singleStyle:false}).score,singleBase);
const duo={...singleCs,mix:{double_apple:10,mint:2}};assert.equal(evaluateMix(duo).score,evaluateMix({...duo,singleStyle:false}).score);
// 会心の中央・教材・自動落下と、勝負勘の隣接工程・再読込・上限。
growth.setGrowthPreview(true);core.newGame();growth.ensureGrowth().nodes=["K15","K16","K21"];
assert(effects.growthCritical(core.state,.05,.5));assert(!effects.growthCritical(core.state,.051,.5));
assert(!effects.growthCritical(core.state,0,.5,{tutorial:true}));assert(!effects.growthCritical(core.state,0,.5,{automatic:true}));
assert(!effects.growthCritical(core.state,NaN,.5));assert(!effects.growthCritical(core.state,0,0));
let phaseCs={mode:"tournament",holes:{skipped:false}};
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"mix",{score:80},true),80);
let phaseRes={score:80,grade:"A"};assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"holes",phaseRes,false),82);
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"holes",phaseRes,false),82,"再採点で積み増さない");
phaseCs=JSON.parse(JSON.stringify(phaseCs));phaseRes=JSON.parse(JSON.stringify(phaseRes));
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"holes",phaseRes,false),82,"保存された元の点から再評価する");
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"heat",{score:80},true),80,"二つ前の会心を使い回さない");
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"steam",{score:99},true),100);
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"pull",{score:0,failed:true},true),0);
assert.equal(effects.settleGrowthPhase(core.state,phaseCs,"care1",{score:80},false),80,"失敗は次の会心を作らない");
const rehearsal={mode:"rehearsal"}, rehearsalRes={score:80};effects.settleGrowthPhase(core.state,rehearsal,"heat",rehearsalRes,true);
assert.deepEqual(rehearsalRes,{score:80});assert.deepEqual(rehearsal,{mode:"rehearsal"});
const ringCs={mode:"tournament",chapter:2,pullDone:true,pull:{smokeRings:3}};
assert.equal(bonusOf(ringCs).bonus,1);assert.equal(bonusOf(ringCs).bonus,1);ringCs.failed=true;assert.equal(bonusOf(ringCs).bonus,0);
const {steamClimate}=await import("../js/craft/steam-climate.js");
for(const rainy of [false,true])for(const ambientC of [10,19,23,30]){
 const actual=steamClimate({rainy,ambientC}), precise=steamClimate({rainy,ambientC,precision:true});
 assert.equal(precise.offset,actual.offset*.5);assert.equal(precise.transfer,1+(actual.transfer-1)*.5);
 assert.equal(precise.rainy,rainy);assert.equal(precise.ambientC,ambientC);
}
const {steamSecondsOf}=await import("../js/craft/steam-time.js");
assert.equal(steamSecondsOf({mode:"rehearsal",steamSeconds:0}),10);
assert.equal(steamSecondsOf({mode:"rehearsal",steamSeconds:0,zeroSteam:true}),0);
assert.equal(steamSecondsOf({mode:"tutorial",steamSeconds:0,zeroSteam:true}),10);
growth.setGrowthPreview(false);assert(!effects.growthCritical(core.state,0,.5));assert.equal(bonusOf({...ringCs,failed:false}).bonus,0);
growth.setGrowthPreview(true);core.newGame();
const {NODES}=await import("../js/core/growth-board-layout.js");
growth.ensureGrowth().nodes=[NODES.find(n=>n.feature==="insurance").id];
let insured={mode:"tournament"};assert.equal(effects.useGrowthInsurance(core.state,insured,"leaf"),true);
insured=JSON.parse(JSON.stringify(insured));assert.equal(effects.useGrowthInsurance(core.state,insured,"burnt"),false);
assert.equal(insured.growthInsuranceKind,"leaf");assert.equal(effects.useGrowthInsurance(core.state,{mode:"rehearsal"},"leaf"),false);
assert.equal(effects.useGrowthInsurance(core.state,{mode:"tournament"},"invalid"),false);
growth.setGrowthPreview(false);assert.equal(effects.useGrowthInsurance(core.state,{mode:"tournament"},"leaf"),false);
// 廃止した差し入れのK20は同じ開放ID・支払のまま人柄+2%になる。
growth.setGrowthPreview(true);core.newGame();const replacement=growth.ensureGrowth();
Object.assign(replacement,{nodes:["K20"],paid:{K20:{any:1,body:1}},hidane:{any:3,body:4,sense:0,wisdom:0}});
const replacementBefore=JSON.stringify(replacement),rawBefore=JSON.stringify(core.state.stats);
core.save();core.load();assert.equal(JSON.stringify(growth.ensureGrowth()),replacementBefore);
assert.deepEqual(board.NODE_BY_ID.K20.links,["B9"]);assert.equal(effects.boardPerks(["K20","K20"]).charm,2);
assert.equal(effects.growthSkill(core.state,"K20"),false);assert.equal(JSON.stringify(core.state.stats),rawBefore);
core.state.growth.nodes=[];stats.gainAffinity("naru",5,{onGain(){}});
const withoutK20=(core.state.affinity.naru||0)+(core.state.affinityCarry.naru||0);
core.state.affinity.naru=0;core.state.affinityCarry.naru=0;core.state.growth.nodes=["K20"];
stats.gainAffinity("naru",5,{onGain(){}});
const withK20=(core.state.affinity.naru||0)+(core.state.affinityCarry.naru||0);
assert(Math.abs(withK20-withoutK20-.085)<1e-10,"5ポイントの通常交流へ2%を端数込みで加え、既存の0.85ペースを一度掛ける");
console.log("[growth effects] PASS: additive legacy growth, 160+29=189, no resource use or repeated LOAD gain, condition boundaries, fractional affinity/fortune, UI totals, leaf/mastery/gauge/heat/pull/stage and mode off");
