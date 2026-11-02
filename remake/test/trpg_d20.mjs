import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
const source=fs.readFileSync(new URL('../js/trpg/session.js',import.meta.url),'utf8');
const {TrpgSession,specialOf,DICE}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const scenario=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/trpg_ordinary.json',import.meta.url)));
const travelURL='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../js/core/travel-budget.js',import.meta.url))).toString('base64');
const campaignSource=fs.readFileSync(new URL('../js/trpg/campaign.js',import.meta.url),'utf8').replace('"../core/travel-budget.js"',JSON.stringify(travelURL));
const campaign=await import('data:text/javascript;base64,'+Buffer.from(campaignSource).toString('base64'));

// The scenes a full session adds between the old ones: two questions after the first roll, a twist after the guess.
function interviewDone(s) {
  if (s.snapshot().phase !== "interview") return;
  for (const topic of s.scenario.interview.topics.slice(0, s.scenario.interview.picks || 2)) s.ask(topic.id);
  s.endInterview();
}
function twistDone(s) {
  if (s.snapshot().phase !== "twist") return;
  for (const field of s.flow.twist) s.plan(field, s.scenario.options[field][0].id);
  s.beginCheck("twist"); s.settleCheck();
}

const catalog=JSON.parse(fs.readFileSync(new URL('../../data/trpg_catalog.json',import.meta.url)));
const counts=(sides,bonus,success,mixed)=>{
  const out={success:0,mixed:0,trouble:0};
  for(let a=1;a<=sides;a++)for(let b=1;b<=sides;b++)out[a+b+bonus>=success?'success':a+b+bonus>=mixed?'mixed':'trouble']++;
  return Object.fromEntries(Object.entries(out).map(([k,n])=>[k,n*100/(sides*sides)]));
};
test('actual die exposes every true face 1..20, not relabelled d6 outcomes',()=>{
  const s=new TrpgSession(scenario,{seed:1});const faces=[];
  for(let n=0;n<20;n++){s.next=()=>n;faces.push(s.die());}
  assert.deepEqual(faces,Array.from({length:20},(_,i)=>i+1));
  assert.equal(DICE.sides,20);
});
test('d20 maximum/minimum pair keeps the existing effects, never creates automatic grade rules',()=>{
  assert.equal(specialOf([20,20]),'critical');assert.equal(specialOf([1,1]),'fumble');assert.equal(specialOf([6,6]),'double');
  const s=new TrpgSession(scenario,{seed:1});s.start();s.state.teamwork=1;
  s.state.pending={kind:'listen',dice:[20,20],bonus:-50,rerolled:false};
  const result=s.settleCheck();assert.equal(result.grade,'trouble');assert.equal(result.special,'critical');assert.equal(s.state.teamwork,2);
  assert.throws(()=>s.settleCheck());assert.equal(s.state.teamwork,2);
});
test('every supported old/new bonus combination has a measured probability difference',()=>{
  const rows=[];
  for(const support of [false,true])for(let momentum=0;momentum<=2;momentum++)for(const hypothesis of [0,1]){
    const oldBonus=1+2*Number(support)+momentum+hypothesis;
    const newBonus=3+7*Number(support)+4*momentum+4*hypothesis;
    const old=counts(6,oldBonus,10,7),current=counts(20,newBonus,30,19);
    const delta=current.success-old.success;
    assert(Math.abs(delta)<=5.04,JSON.stringify({support,momentum,hypothesis,delta}));
    rows.push({support,momentum,hypothesis,oldBonus,newBonus,old,current,successDeltaPoints:delta});
  }
  const base=rows.find(r=>!r.support&&!r.momentum&&!r.hypothesis);
  const aid=rows.find(r=>r.support&&!r.momentum&&!r.hypothesis);
  assert.equal(base.current.success,26.25);assert.equal(aid.current.success,57.25);
  assert.equal(aid.current.success-base.current.success,31);
  console.log(JSON.stringify({assumption:'equally likely independent faces; seeded PRNG modulo bias not included in theoretical table',rows,specials:{criticalOld:100/36,criticalNew:100/400,fumbleOld:100/36,fumbleNew:100/400,allDoublesOld:100/6,allDoublesNew:5}},null,2));
});
test('actual d20 completion through campaign contract: cancel/stale inert, one action, detached serialization',()=>{
  const state={chapter:2,phase:'daily',day:3,slot:1,money:3000,lovers:[],affinity:{},met:{},flags:{},trpg:{...campaign.emptyTrpgProgress(),shifts:[]}};
  campaign.foundTrpgClub(state,catalog);
  for(const p of catalog.participants){state.met[p.id]=true;state.affinity[p.id]=66;campaign.joinTrpgClub(state,catalog,p.id);}
  campaign.syncTrpgStock(state,catalog);assert(campaign.buyTrpgBook(state,catalog,scenario.id));
  const cast=campaign.castTrpgTable(state,catalog,scenario);assert(cast.ok);
  const ticket={chapter:state.chapter,day:state.day,slot:state.slot,assignments:cast.assignments};
  const session=new TrpgSession(scenario,{seed:5});session.start();session.beginCheck('listen');session.settleCheck();interviewDone(session);
  for(const spot of scenario.spots.slice(0,3))session.inspect(spot.id);session.interpret(scenario.hypotheses[0].id); twistDone(session);
  for(const kind of ['prepare','serve']){for(const field of session.flow[kind])session.plan(field,scenario.options[field][0].id);session.beginCheck(kind);session.settleCheck();}
  const result=session.result(),before=structuredClone(state);
  assert.equal(campaign.completeTrpgTable(state,catalog,scenario,ticket,{cancelled:true}),false);assert.deepEqual(state,before);
  assert.equal(campaign.completeTrpgTable(state,catalog,scenario,{...ticket,day:2},result),false);assert.deepEqual(state,before);
  assert(campaign.completeTrpgTable(state,catalog,scenario,ticket,result));assert.equal(state.slot,2);
  assert.equal(campaign.completeTrpgTable(state,catalog,scenario,ticket,result),false);assert.equal(state.slot,2);
  const saved=JSON.parse(JSON.stringify(state));assert.deepEqual(saved.trpg.cleared,state.trpg.cleared);assert.equal(saved.money,before.money);
});
