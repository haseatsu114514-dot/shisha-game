import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.document={addEventListener(){}};globalThis.window={};
const stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)};
const core=await import('../js/core/state.js'),growth=await import('../js/core/growth.js'),stats=await import('../js/core/stats.js');
const board=await import('../js/core/growth-board.js'),effects=await import('../js/core/growth-effects.js');
const p=await import('../js/chapters/ch5-progress.js'),trip=await import('../js/chapters/ch5-growth-travel-state.js');
const {buildCarryPackage}=await import('../js/core/carry.js');
const scenes=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch5_growth_visits.json',import.meta.url))).dialogues;
for(const who of trip.TEACHERS)for(let i=0;i<=trip.TRAVEL.topics;i++)assert(scenes.some(x=>x.dialogue_id===`ch5_growth_${who}_${i}`));
core.newGame();growth.setGrowthPreview(true);
Object.assign(core.state,{chapter:4,phase:'cleared',money:200000});
Object.assign(core.state.flags,{_ch4_cleared:true,_ch4_sheikh_revealed:true});
growth.ensureGrowth();assert(p.advanceToChapterFive(core.state));
for(const scene of p.CH5_PROLOGUE)assert(p.completeChapterFiveScene(core.state,scene.id));
assert.equal(core.state.phase,'daily');
const before={day:core.state.day,money:core.state.money,stats:structuredClone(core.state.stats)};
const original=structuredClone(core.state);
const initialPlan=trip.planTripAction(core.state,'fly');assert(initialPlan);
assert.equal(trip.commitTripAction(core.state,{...initialPlan,slots:0}),false);
assert.deepEqual(core.state,original,'候補・取消・不正計画で資源を動かさない');
const tally={fly:0,return:0,visit:0,rest:0};
async function night(){
 if(!trip.tripState(core.state).pendingNight)return;
 growth.settleGrowth();stats.addStamina(trip.TRAVEL.sleep,{sleep:true});
 assert(trip.completeTripNight(core.state));assert.equal(trip.completeTripNight(core.state),false);core.save();
}
async function act(kind,who){
 const plan=trip.planTripAction(core.state,kind,who);assert(plan,`${kind}:${who}`);
 const result=await stats.paidAction(()=>{
  if(kind==='visit')stats.earnSceneCompletion(plan.scene,core.state);
  assert(trip.commitTripAction(core.state,plan));
  assert.equal(trip.commitTripAction(core.state,plan),false,'同じ入力の二重確定なし');
  if(plan.cost)stats.addMoney(-plan.cost);if(plan.strain)stats.addStamina(-plan.strain);
  if(kind==='rest')stats.addStamina(trip.TRAVEL.rest);
  if(kind==='visit'){core.markMet(who);stats.gainAffinity(who,plan.affinity);}
  return true;
 },{consumed:ok=>ok,exp:kind==='visit'?{key:who,person:who,place:`dubai:${who}`}:null});
 assert(result.value);tally[kind]++;core.save();await night();
}
await act('fly');
assert.equal(trip.tripState(core.state).region,'dubai');assert.equal(core.state.money,before.money-trip.TRAVEL.roundTrip);
const noReveal=structuredClone(core.state);noReveal.flags._ch4_sheikh_revealed=false;
assert.equal(trip.planTripAction(noReveal,'visit','sheikh'),null);
assert(trip.planTripAction(noReveal,'visit','da_silva'));
for(const who of trip.TEACHERS){
 for(let visit=0;visit<8;visit++){
  if(core.state.stamina<=0)await act('rest');
  await act('visit',who);
  if(visit===3){const oldPlan=trip.planTripAction(core.state,'rest');core.save();core.load();if(oldPlan)assert.equal(trip.commitTripAction(core.state,oldPlan),false,'LOAD前の計画を新ownerへ適用しない');}
 }
 assert.equal(stats.affinityLevel(who),5,'好感度は実visit処理の積み重ねで♥5へ');
 assert.equal(core.state.growth.learned.includes(who==='sheikh'?'M-W8':'M-B6'),false);
}
if(core.state.slot)await act('rest');
for(const [who,id] of [['sheikh','M-W8'],['da_silva','M-B6']]){
 const path=board.pathTo(id,new Set(core.state.growth.nodes));
 const committed=board.commitPending(path.path);assert(committed.some(n=>n.id===id),'交流・夜の精算で得た火種だけで授業の実経路を灯す');
 const lesson=board.NODE_BY_ID[id];assert(growth.readyLessons(who).some(l=>l.id===id));
 assert.equal(growth.completeLesson(core.state,id,{id:lesson.scene,visited:[lesson.scene],cancelled:true}),false);
 assert(growth.completeLesson(core.state,id,{id:lesson.scene,visited:[lesson.scene]}));
 assert(effects.growthLesson(core.state,id));
}
const priorMoney=core.state.money;await act('return');assert.equal(core.state.money,priorMoney,'帰路を二重請求しない');
assert.equal(trip.tripState(core.state).region,'local');assert.deepEqual(core.state.stats,before.stats);
const result={actions:tally,days:core.state.day-before.day,moneySpent:before.money-core.state.money,
 hearts:Object.fromEntries(trip.TEACHERS.map(who=>[who,core.state.affinity[who]])),xp:core.state.growth.xp,
 level:core.state.growth.level,fire:core.state.growth.hidane,learned:core.state.growth.learned};
core.save();core.load();for(const id of ['M-W8','M-B6'])assert(effects.growthLesson(core.state,id));
const carry=buildCarryPackage(core.state);assert.equal(carry.flags._ch5_growth_travel,undefined);
const closed=structuredClone(core.state);closed.flags._ch5.part='scheduled';assert.equal(trip.planTripAction(closed,'fly'),null);
const broke=structuredClone(core.state);broke.money=0;assert.equal(trip.planTripAction(broke,'fly'),null);
growth.setGrowthPreview(false);
console.log('[growth travel] PASS: chapter transition/action plans + actual costs/affinity/XP/night/fire/path/lesson, no direct hearts or fire fixture; controlled dialogue completion; SAVE/LOAD/NG+; metrics',JSON.stringify(result));
