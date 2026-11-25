// Run the production calendar in a VM; only its UI/services are replaced.
// node --experimental-vm-modules remake/test/early_deliveries.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { spendableMoney } from '../js/core/travel-budget.js';
const source=await fs.readFile(new URL('../js/daily/calendar.js',import.meta.url),'utf8');
let state={};
const calls=[], saves=[], closed=new Set(), locked=new Set();
let installProbe=async()=>{}, displayProbe=async()=>{};
let actionEnds=0;
const noop=()=>{}, asyncNoop=async()=>{};
const mapQueue=[];
const spots={
 naru:{id:'naru',kind:'rival',charId:'naru',cost:3000,stamina:-16},
 minto:{id:'minto',kind:'rival',charId:'minto',cost:3000,stamina:-16},
 adam:{id:'adam',kind:'rival',charId:'adam',cost:3000,stamina:-16},
 c_station:{id:'c_station'}
};
const overrides={spendableMoney,state, DB:{flavorById:{lemon:{}},dialogues:{},lime:[]},
 save:()=>saves.push(structuredClone(state)),
 // 休養の前にも今日のお誘いの締め切りを確かめる（calendar.js）。この検査では返事待ちのお誘いは無い
 actionInviteNeedingReply:()=>null,
 holdActionSave:()=>noop,
 el:()=>({classList:{add:noop,remove:noop},remove:noop}), sleep:asyncNoop,
 layers:{fx:{append:noop},modal:{classList:{contains:()=>false}}},
 dayTurn:async fn=>fn(),fadeBlack:async fn=>fn?.(),
 chapterDay:()=>state.day,daysLeft:()=>14-state.day,TOURNAMENT_DAY:14,
 maxStamina:()=>100,staminaRatio:()=>state.stamina/100,
 staminaAfter:n=>Math.max(0,state.stamina+n),coldRisk:ratio=>ratio<=.25,fitActive:()=>false,
 modal:async({options})=>options.at(-1).value,
 addMoney:n=>state.money+=n,addStamina:n=>state.stamina=Math.min(100,state.stamina+n),
 catchesCold:()=>false,conditionForRatio:()=>({health:'green'}),
 paidAction:async fn=>({value:await fn(),spent:0}),
 play:async(id,opts)=>calls.push({type:'scene',id,opts,day:state.day,slot:state.slot}),
 chooseSpot:async opts=>{if(calls.length>100)throw Error('Calendar fixture did not make progress');calls.push({type:'map',pin:opts.guide?.pin,free:opts.guide?.free,day:state.day,slot:state.slot});return opts.guide?.pin||mapQueue.shift()||'rest'},
 spotById:id=>spots[id]||{id,kind:'rest',stamina:0},ownsFlavor:()=>false,
 openShop:async()=>calls.push({type:'shop'}),
 visitRival:async spot=>{state.money-=spot.cost;state.stamina+=spot.stamina;state.story[spot.charId]=(state.story[spot.charId]||0)+1;calls.push(spot.id==='naru'&&state.day===1?{type:'scout',day:state.day}:{type:'rival',id:spot.charId,day:state.day,slot:state.slot,deliveryFlag:!!state.flags[`_delivery_${spot.charId}`]});return true},
 // Calendar owns ordering; the actual handoff implementation is tested with spots.js below.
 deliverToRival:async ({charId:id})=>{
  const done=`_delivery_${id}_done`;
  if(state.flags[done])return false;
  state.flags[`_delivery_${id}`]=true;
  if(id==='minto'){
   await overrides.play('remake_delivery_minto_handoff',{bg:'res://assets/backgrounds/peppermint.png'});
   overrides.markMet(id);
  } else await overrides.visitChar(id);
  state.flags[done]=true;overrides.addMoney(2000);overrides.save();return true;
 },
 visitSpot:async spot=>{assert.equal(spot.cost,0);assert.equal(spot.stamina,0);state.flags._c_station_registered=true;calls.push({type:'register',day:state.day,slot:state.slot})},
 visitChar:async id=>{state.story[id]=(state.story[id]||0)+1;calls.push({type:'visit',id,day:state.day,slot:state.slot,deliveryFlag:!!state.flags[`_delivery_${id}`]})},
 storyCount:id=>state.story[id]||0,isClosed:spot=>closed.has(spot.id),isUnlocked:spot=>!locked.has(spot.id),markMet:id=>state.met[id]=true,
 onAction:()=>actionEnds++,presentNow:(...args)=>displayProbe(...args),installReel:()=>installProbe(),
 restingToday:()=>!!state.restDay?.fullDay,
 runNightPlan:async()=>0,nightPlan:()=>[],nightOccupied:()=>false,
 // This delivery fixture has no night schedule; the synchronous guard returns no block.
 fixedNightVisitBlock:events=>{assert.deepEqual(Object.keys(events),[]);return null},
 runHomeShisha:async()=>false,maybeConfession:async()=>false,unreadCount:()=>0,
 completeInvitation:noop,
 invitationCost:()=>0,invitationGrowth:()=>({}),isFriendEvent:()=>false,isFinaleEvent:()=>false,CHAR_STAT:{},storeInvitationSpot:()=>false,
 openingStatus:()=>({ok:true}),VISIT_BG:{},restAtHome:async()=>{},currentCondition:()=>({health:'green'}),
 // #3819: DAY2 has no fixed shift any more. A voluntary shift is recorded instead of running the tonari scenes.
 doBaito:async({story}={})=>{calls.push({type:'shift',day:state.day,slot:state.slot,story:await story?.()})},
};
const context=vm.createContext({console,Math,Set,String,Number,Array,Promise});
const modules=new Map();
const calendar=new vm.SourceTextModule(source+'\nexport { dueDelivery, day1Errands, deliver, DELIVERIES };',{
 context,
 async importModuleDynamically(spec){
  assert.equal(spec,'../scenes/day2-guide.js');
  const guide=new vm.SyntheticModule(['openDay2Guide'],function(){
   this.setExport('openDay2Guide',async()=>calls.push({type:'day2-guide',day:state.day,slot:state.slot}));
  },{context});
  await guide.link(()=>{throw new Error('Unexpected DAY2 guide dependency');});
  await guide.evaluate();
  return guide;
 },
});
await calendar.link(async spec=>{
 if(modules.has(spec)) return modules.get(spec);
 const names=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(n=>n.trim().split(/\s+as\s+/)[0]));
 const mod=new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,name in overrides?overrides[name]:asyncNoop)},{context});modules.set(spec,mod);return mod;
});
await calendar.evaluate();const c=calendar.namespace;
function reset({day=2,slot=0,flags={},story={}}={}){
 Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,{chapter:1,day,slot,money:10000,stamina:80,flags:{_errand_scout_done:true,_c_station_registered:true,_ch1_rules_read:true,...flags},story:{...story},met:{},visitedDay:{},stats:{},inbox:[]});calls.length=0;saves.length=0;actionEnds=0;closed.clear();locked.clear();mapQueue.length=0;
}
// #2213 B01: deliveries are the free walk home after the day's slots — no slot, stamina or action end.
reset();assert.equal(c.dueDelivery(),null);state.slot=1;assert.equal(c.dueDelivery(),null);
reset({slot:2});assert.equal(c.dueDelivery().charId,'minto');await c.deliver(c.dueDelivery());assert.equal(c.dueDelivery().charId,'adam');await c.deliver(c.dueDelivery());
assert.equal(c.dueDelivery(),null);assert.equal(state.money,14000);assert.equal(state.stamina,80);assert.equal(state.slot,2);assert.equal(actionEnds,0);assert.equal(state.story.minto,undefined);assert.equal(state.story.adam,1);assert.equal(state.met.minto,true);
assert(calls.find(x=>x.id==='remake_delivery_minto_handoff').opts.bg.endsWith('/peppermint.png'));
assert.equal(calls.find(x=>x.type==='map'&&x.pin==='minto').free,'配達（帰り道・代金なし）');
// A reload from the committed checkpoint cannot pay twice.
Object.assign(state,structuredClone(saves.at(-1)));assert.equal(c.dueDelivery(),null);assert.equal(state.money,14000);
for(const id of ['minto','adam']){reset({slot:2,story:{[id]:1}});const d=c.dueDelivery();assert.equal(state.flags[`_delivery_${id}_done`],id==='minto'?true:undefined);if(id==='minto')assert.equal(d.charId,'adam');else assert.equal(d.charId,'minto');assert.equal(state.money,10000);}
reset({slot:2,story:{minto:1}});assert.equal(c.dueDelivery().charId,'adam');assert.equal(state.flags._delivery_minto_done,true);
reset({slot:2});closed.add('minto');assert.equal(c.dueDelivery(),null);closed.clear();assert.equal(c.dueDelivery().charId,'minto');
reset({slot:2});state.restDay={fullDay:true};assert.equal(c.dueDelivery(),null);
reset({day:3,slot:2});assert.equal(c.dueDelivery(),null);state.flags._delivery_schedule_v2=true;assert.equal(c.dueDelivery().charId,'minto');
reset({day:1,slot:1});assert.equal(c.dueDelivery(),null);
// Actual runDaily ordering: shopping/scout, home/sleep, registration, minto, adam.
reset({day:1,flags:{_errand_scout_done:false,_c_station_registered:false,_ch1_rules_read:false}});await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(calls.filter(x=>['shop','scout','register','day2-guide','visit'].includes(x.type)).map(x=>[x.type,x.id||'',x.day||1]),[['shop','',1],['scout','',1],['register','',2],['day2-guide','',2],['visit','adam',2]]);
assert.equal(calls.find(x=>x.type==='day2-guide').slot,0);
assert.equal(state.flags._ch1_rules_read,true);
assert.equal(calls.find(x=>x.id==='remake_delivery_minto_handoff').day,2);
assert(!calls.some(x=>x.type==='map'&&x.day===1&&!['shop','naru'].includes(x.pin)));
assert.equal(actionEnds,3);assert.equal(state.money,11000);assert.equal(state.flags._c_station_registered,true);
assert.equal(state.visitedDay.c_station,undefined,'Free registration must leave the same-day customer visit available');
// Old DAY1-night checkpoints do not replay scouting or the existing registration.
reset({day:1,slot:1});await c.runDaily({untilDay:3,nightEvents:{}});assert(!calls.some(x=>['scout','register','shop'].includes(x.type)));assert.equal(state.money,14000);assert.equal(actionEnds,2);
// A full DAY2 rest defers both registration and ordered deliveries, without losing them.
reset({day:2,slot:2,flags:{_c_station_registered:false,_delivery_schedule_v2:true}});
state.restDay={chapter:1,day:2,fullDay:true};await c.runDaily({untilDay:4,nightEvents:{}});
assert.equal(calls.find(x=>x.type==='register').day,3);
assert.equal(calls.find(x=>x.id==='remake_delivery_minto_handoff').day,3);
assert.equal(calls.find(x=>x.type==='visit'&&x.id==='adam').day,3);
assert.equal(state.money,14000);assert.equal(actionEnds,2);
// Saved scouting consumes no second fare/stamina on resume before its old registration.
reset({day:1,flags:{_errand_scout_done:false,_errand_naru_visited:true,_errand_shop_done:true}});
await c.runDaily({untilDay:3,nightEvents:{}});assert(!calls.some(x=>x.type==='scout'));assert.equal(state.money,14000);
// Keep an already-accepted old DAY1-night appointment when ending the shift.
reset({day:1,slot:1});state.pendingInvite={day:1,slot:1,sender:'naru',event:'legacy_appointment'};
await c.runDaily({untilDay:3,nightEvents:{}});assert.equal(calls.filter(x=>x.id==='legacy_appointment').length,1);assert.equal(state.pendingInvite,null);
// Do not insert a registration guide into an already-completed legacy DAY2.
reset({day:2,flags:{_c_station_registered:false,_delivery_adam_done:true,_delivery_minto_done:true}});
await c.runDaily({untilDay:3,nightEvents:{}});
assert(!calls.some(x=>x.type==='register'));assert.equal(state.flags._c_station_registered,false);
assert.equal(state.money,10000);
// Registration remains free and cannot strand old saves at a locked/closed venue.
for(const unavailable of [locked,closed]) {
 reset({day:2,flags:{_c_station_registered:false}});unavailable.add('c_station');
 await c.runDaily({untilDay:3,nightEvents:{}});
 assert(!calls.some(x=>x.type==='register'));assert.equal(state.money,14000);
 assert.equal(state.flags._c_station_registered,false);
 unavailable.clear();await c.runDaily({untilDay:4,nightEvents:{}});
 assert.equal(calls.find(x=>x.type==='register').day,3);
 assert.equal(calls.find(x=>x.pin==='c_station').free,'参加登録（代金なし）');
 assert.equal(state.money,14000);
}
// DAY2 batch handoff (#3819): both requests are read in tonari, then the deliveries follow the registration
// in the morning ("登録のついで"), before any free action. No fixed shift.
const deliveryTrace=()=>calls.filter(x=>x.type==='scene'
  && ['remake_delivery_minto','remake_delivery_eden','remake_delivery_report'].includes(x.id)
  || x.type==='map' && ['minto','adam'].includes(x.pin))
  .map(x=>x.type==='scene'?x.id:x.pin);
reset({day:2});
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),[
 'remake_delivery_minto','remake_delivery_eden','minto','adam','remake_delivery_report'
]);
assert.equal(state.flags._delivery_batch_started,true);
assert.equal(state.flags._delivery_report_done,true);
assert.deepEqual(calls.filter(x=>x.type==='shift'),[],'#3819: DAY2 has no fixed shift');
assert.equal(state.flags._ch1_day2_shift_done,undefined);
assert.deepEqual(calls.filter(x=>x.type==='map'&&['minto','adam'].includes(x.pin)).map(x=>[x.pin,x.slot,x.free]),
 [['minto',0,'配達（登録のついで・代金なし）'],['adam',0,'配達（登録のついで・代金なし）']]);
assert.equal(calls.find(x=>x.id==='remake_delivery_report').slot,0,'The report is read before the free day');
const firstFree=calls.findIndex(x=>x.type==='map'&&!x.pin);
assert(firstFree>calls.findIndex(x=>x.id==='remake_delivery_report'),'Free actions come after the errand and report');
assert.deepEqual(calls.filter(x=>x.type==='map'&&!x.pin).map(x=>x.slot),[0,1],'Both DAY2 slots stay free');
assert.equal(state.money,14000);assert.equal(state.stamina,94);assert.equal(actionEnds,2);
const firstGuide=calls.findIndex(x=>x.type==='map'&&x.pin==='minto');
const secondGuide=calls.findIndex(x=>x.type==='map'&&x.pin==='adam');
assert(firstGuide>=0 && secondGuide>firstGuide);
assert(!calls.slice(firstGuide+1,secondGuide).some(x=>x.type==='scene'
  && x.opts?.bg==='res://assets/backgrounds/bg_tonari_inside.png'),
  'An interim tonari return was inserted between the deliveries');
assert.equal(calls.filter(x=>x.id==='remake_delivery_report').length,1);

// LOAD after just the first delivery: already-read briefs, flags, reward and slot survive.
reset({day:2,slot:1,flags:{_delivery_batch_started:true,
 _delivery_minto_told:true,_delivery_adam_told:true,_delivery_minto_done:true,_morning_2:true}});
state.money=12000;state.stamina=70;
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),['adam','remake_delivery_report']);
assert.equal(state.money,14000);assert.equal(state.stamina,84);assert.equal(actionEnds,1);

// LOAD during the batch briefing: preserve the first explanation but read the second.
reset({day:2,flags:{_delivery_batch_started:true,_delivery_minto_told:true,_morning_2:true}});
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),['remake_delivery_eden','minto','adam','remake_delivery_report']);
assert.equal(state.money,14000);assert.equal(actionEnds,2);

// LOAD after both deliveries but before the final report: no second delivery or payout.
reset({day:2,slot:2,flags:{_delivery_batch_started:true,
 _delivery_minto_told:true,_delivery_adam_told:true,_delivery_minto_done:true,
 _delivery_adam_done:true,_morning_2:true}});
state.money=14000;state.stamina=60;
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),['remake_delivery_report']);
assert.equal(state.money,14000);assert.equal(state.stamina,74);assert.equal(actionEnds,0);
assert.equal(state.flags._delivery_report_done,true);
// LOAD of completed report is idempotent.
reset({day:2,slot:2,flags:{_delivery_batch_started:true,
 _delivery_minto_done:true,_delivery_adam_done:true,
 _delivery_report_done:true,_morning_2:true}});
state.money=14000;state.stamina=60;
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),[]);

// A preexisting partial DAY2 save is not upgraded to a fresh morning batch.
reset({day:2,slot:1,flags:{_delivery_minto_told:true,_delivery_minto_done:true,_morning_2:true}});
state.money=12000;state.stamina=70;
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(deliveryTrace(),['remake_delivery_eden','adam']);
assert.equal(state.flags._delivery_batch_started,undefined);
assert.equal(state.money,14000);assert.equal(actionEnds,1);
const dialogueList=JSON.parse(await fs.readFile(new URL('../../data/dialogue/remake_ch1.json',import.meta.url),'utf8')).dialogues;
const dialogue=id=>dialogueList.find(item=>item.dialogue_id===id);
assert(dialogue('remake_delivery_report')?.lines.length>=3);
assert(!dialogue('remake_delivery_eden').lines[0].text.includes('戻ったか'));
assert(!dialogue('remake_delivery_minto').lines.some(line=>line.text?.includes('戻ってこい')));
console.log('delivery batch: morning briefing, no interim return, one report, SAVE/LOAD and old checkpoint PASS');

// #3819 item 2: visiting Adam or Minto while delivery is still requested prioritizes delivery over normal smoking,
// does not advance the daytime slot to night, and allows normal smoking once delivery is completed.
// The morning errand delivers both shops first; a shop is left for the day only when the errand could not reach it.
reset({day:2});
mapQueue.push('adam');
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(
 calls.filter(x=>['visit','rival','shift'].includes(x.type)||x.id==='remake_delivery_minto_handoff'||x.id==='remake_delivery_report')
  .map(x=>[x.type,x.id,x.day,x.slot,x.deliveryFlag??null]),
 [
  ['scene','remake_delivery_minto_handoff',2,0,null],
  ['visit','adam',2,0,true],
  ['scene','remake_delivery_report',2,0,null],
  ['rival','adam',2,0,true],
 ],
 'After the morning errand, choosing Adam at noon is an ordinary visit'
);
assert.equal(state.story.adam,2);
assert.equal(state.money,11000,'+4000 delivery pay (minto+adam) -3000 normal Adam visit');

// Minto closed in the morning: the errand keeps the order (no Adam first), Adam is delivered on a noon visit
// without spending the slot, a second Adam visit is ordinary smoking, and Minto waits for its next open day.
reset({day:2});closed.add('minto');
mapQueue.push('adam','adam');
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(
 calls.filter(x=>['visit','rival','shift'].includes(x.type)||x.id==='remake_delivery_minto_handoff'||x.id==='remake_delivery_report')
  .map(x=>[x.type,x.id,x.day,x.slot,x.deliveryFlag??null]),
 [
  ['visit','adam',2,0,true],
  ['rival','adam',2,0,true],
 ],
 'Adam daytime visit must run delivery first (slot 0), then allow normal smoking (slot 0->1)'
);
assert.equal(state.flags._delivery_adam_done,true);
assert.equal(state.flags._delivery_minto_done,undefined,'A closed shop waits; the order is not swapped');
assert.equal(state.flags._delivery_report_done,undefined);
assert.equal(state.money,9000,'+2000 Adam delivery pay -3000 normal Adam visit');
assert.equal(actionEnds,2,'Only the normal customer visit and the free night action spin the reel');
closed.clear();

reset({day:2});closed.add('adam');
mapQueue.push('minto');
await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(
 calls.filter(x=>['visit','rival','shift'].includes(x.type)||x.id==='remake_delivery_minto_handoff'||x.id==='remake_delivery_report')
  .map(x=>[x.type,x.id,x.day,x.slot,x.deliveryFlag??null]),
 [
  ['scene','remake_delivery_minto_handoff',2,0,null],
  ['rival','minto',2,0,true],
 ],
 'With Adam closed the errand still hands Minto the boxes, then a noon Minto visit is ordinary'
);
assert.equal(state.flags._delivery_minto_done,true);
assert.equal(state.flags._delivery_adam_done,undefined);
assert.equal(state.story.minto,1);
closed.clear();
console.log('delivery priority (#3819 item 2): Adam/Minto daytime delivery before normal smoking PASS');

console.log('early deliveries: order, accounting, legacy checkpoints, appointments, closures and rest PASS');

// Entry integration (#749): real runDaily, mocked installer/display only.
// Their own payout/animation lifecycle is covered by reel_lifecycle and production LOAD.
const entryFailures=[];
async function entryCheck(name, run) {
 try { await run(); console.log(`calendar entry: ${name} PASS`); }
 catch(error) { entryFailures.push(name); console.error(`calendar entry: ${name} FAIL: ${error.message}`); }
 finally { installProbe=async()=>{}; displayProbe=async()=>{}; }
}
const replaceState=next=>{state=next;modules.get('../core/state.js').setExport('state',next)};
for(const registered of [true,false]) for(const recordedDay of [undefined,1]) {
 await entryCheck(`pending registered=${registered} visited=${recordedDay}`,async()=>{
  reset({flags:{_pakki_first_spin_pending:true,_c_station_registered:registered}});
  if(recordedDay!==undefined)state.visitedDay.c_station=recordedDay;
  state.spotVisits={c_station:1};
  const before=structuredClone(state), trace=[];
  let release;const gate=new Promise(resolve=>release=resolve);
  installProbe=async()=>{trace.push('install');await gate;delete state.flags._pakki_first_spin_pending};
  displayProbe=async()=>trace.push('display');
  const task=c.runDaily({untilDay:2,nightEvents:{}});
  // No daily loop is needed to prove the entry waits and completes bookkeeping.
  const waiting=trace.slice();release();await task;
  assert.deepEqual(waiting,['install'],'entry did not await explicit first-spin resume');
  assert.deepEqual(trace,['install','display']);
  assert.deepEqual(calls,[]);
  assert.equal(state.flags._pakki_first_spin_pending,undefined);
  assert.equal(state.visitedDay.c_station,recordedDay);
  for(const key of ['day','slot','stamina','money','stats','spotVisits'])assert.deepEqual(state[key],before[key],key);
  if(registered&&recordedDay===undefined)assert(!saves.some(s=>s.visitedDay.c_station!==undefined));
 });
}
await entryCheck('legacy without explicit flag displays existing results only',async()=>{
 reset();state.reel={installed:true,count:0,pending:[]};
 let installs=0,displays=0;
 installProbe=async()=>installs++;displayProbe=async()=>displays++;
 await c.runDaily({untilDay:3,nightEvents:{}});
 assert.equal(installs,0);assert(displays>0);
 assert.equal(calls.find(x=>x.type==='map'&&x.pin).pin,'minto');
 assert.equal(state.visitedDay.c_station,undefined);
 assert.equal(state.money,14000);assert.equal(actionEnds,2);
});
await entryCheck('resume precedes result display and delivery actions',async()=>{
 reset({flags:{_pakki_first_spin_pending:true}});const trace=[];
 installProbe=async()=>{assert.equal(calls.length,0);trace.push('install');delete state.flags._pakki_first_spin_pending};
 displayProbe=async()=>{if(!trace.includes('display'))assert.equal(calls.length,0);trace.push('display')};
 await c.runDaily({untilDay:3,nightEvents:{}});
 assert.deepEqual(trace.slice(0,2),['install','display']);
 assert.equal(calls.find(x=>x.type==='map'&&x.pin).pin,'minto');
 assert.equal(state.money,14000);assert.equal(actionEnds,2);
});
await entryCheck('free registration survives reload during resumed first-spin presentation',async()=>{
 reset({flags:{_pakki_first_spin_pending:true}});
 state.spotVisits={c_station:1};state.reel={count:0,pending:[]};state.stats={technique:10};
 let installs=0;
 installProbe=async()=>{
  installs++;
  assert.equal(state.visitedDay.c_station,undefined,'Pending first spin must not consume customer visit');
  assert.equal(state.flags._pakki_first_spin_pending,true);
  // Model installReel's commit/save followed by document replacement during presentation.
  delete state.flags._pakki_first_spin_pending;
  state.reel.count=1;state.stats.technique++;
  overrides.save();replaceState(structuredClone(saves.at(-1)));
 };
 await c.runDaily({untilDay:2,nightEvents:{}});
 assert.equal(installs,1,'Explicit pending resume was skipped');
 const committed=structuredClone(state);
 await c.runDaily({untilDay:2,nightEvents:{}});
 assert.equal(installs,1,'Committed first spin was installed again');
 assert.equal(state.visitedDay.c_station,undefined);
 assert.deepEqual(state,committed,'Second LOAD changed payout/count/registration');
 assert.deepEqual(calls,[]);
});
for(const wait of ['installer','display'])await entryCheck(`state replaced during ${wait}`,async()=>{
 reset({flags:{_pakki_first_spin_pending:wait==='installer'}});
 const old=state;const replacement=structuredClone(state);replacement.money=4321;
 let displays=0;
 installProbe=async()=>{replaceState(replacement)};
 displayProbe=async()=>{displays++;if(wait==='display')replaceState(replacement)};
 await c.runDaily({untilDay:3,nightEvents:{}});
 assert.equal(state,replacement);assert.equal(state.money,4321);
 assert.equal(state.day,2);assert.equal(state.slot,0);
 assert.equal(old.visitedDay.c_station,undefined);
 assert.equal(state.visitedDay.c_station,undefined,'Old run mutated replacement state');
 assert.equal(displays,wait==='installer'?0:1);
 assert.deepEqual(calls,[]);
 assert.equal(saves.length,0);
});
assert.deepEqual(entryFailures,[],'calendar entry regressions');

// #3819 item 2: verify actual spots.js (visitRival/visitChar), spot-access.js (freeGuide/spotAvailability),
// and actual ch1_adam.json / ch1_minto.json condition branches when delivery is pending vs completed.
{
 const adamDialogues=JSON.parse(await fs.readFile(new URL('../../data/dialogue/ch1_adam.json',import.meta.url),'utf8')).dialogues;
 const mintoDialogues=JSON.parse(await fs.readFile(new URL('../../data/dialogue/ch1_minto.json',import.meta.url),'utf8')).dialogues;
 const spotSource=await fs.readFile(new URL('../js/daily/spots.js',import.meta.url),'utf8');
 const accessSource=await fs.readFile(new URL('../js/daily/spot-access.js',import.meta.url),'utf8');
 const allDialogues=Object.fromEntries([...dialogueList,...adamDialogues,...mintoDialogues].map(d=>[d.dialogue_id,d]));
 const evalDialogue=(id)=>{
  const dlg=allDialogues[id];
  if(!dlg) return [];
  const lines=[];
  const walk=(list)=>{
   for(const line of list||[]){
    if(line.type==='set_flag'&&line.flag) state.flags[line.flag]=true;
    else if(line.type==='condition'){
     const ok=line.condition_type==='met'?!!state.met[line.char_id]:!!state.flags[line.flag];
     const branch=ok?line.next_true:line.next_false;
     if(branch&&dlg.branches?.[branch]) walk(dlg.branches[branch]);
    } else if(line.text) lines.push(line.text);
   }
  };
  walk(dlg.lines);
  return lines;
 };
 const played=[];
 const spotContext=vm.createContext({console,Math,Set,WeakMap,Object,Array,Number,String,Promise});
 const spotOverrides={
  state,DB:{dialogues:allDialogues},
  markMet:id=>{state.met[id]=true},
  spendableMoney,returnFareReserve:()=>0,yen:n=>`¥${n}`,
  play:async(scene)=>{const id=typeof scene==='string'?scene:scene.dialogue_id;played.push({id,texts:evalDialogue(id)});return {id}},
  playBgm:noop,refreshPlaceCue:noop,toast:noop,
  addMoney:n=>{state.money+=n},addStamina:n=>{state.stamina+=n},
  earnStat:noop,gainAffinity:noop,visitAffinity:()=>16,
  affinityLevel:id=>(state.affinity?.[id]||0)>=9?1:0,
  releaseAffinity:noop,AFFINITY_RANK_PTS:[0,9,20,33,48,66],setStoryAffinityCap:noop,
  ensureAffinityLevel:(id,lv)=>{state.affinity[id]=Math.max(state.affinity[id]||0,[0,9,20,33,48,66][lv]||0)},
  VISIT_SEQ:{adam:['ch1_adam_first','ch1_adam_second'],minto:['ch1_minto_first','ch1_minto_second']},
  visitStorySkipped:()=>false,
  isRainy:()=>false,RAIN_SPOT_TEXTS:{},
  afterStory:async()=>true,questionVisitDue:()=>false,playQuestionVisit:async()=>true,finaleAtVisit:()=>false,playFinale:async()=>true,
  bondAfterNext:()=>null,markBondAfterRead:noop,loadBondAfterScenes:async()=>{},
  openingStatus:()=>({ok:true}),rioUnavailable:()=>'',
  spotEncounterDue:()=>null,quietSpotPool:()=>[],recordSpotEncounter:noop,spotFollowupDue:()=>null,
  hiyoriShopEncounterDue:()=>false,meetHiyoriAtTonari:async()=>false,tsumugiAtTonari:()=>false,
  maybeRecruitTrpgMember:async()=>false,trpgSpot:()=>null,samechanSpot:()=>null,cinemaSpot:()=>null,
  fortuneHere:()=>false,fortunePosition:()=>({x:0,y:0,area:''}),
  growthEnabled:()=>false,hidaneTotal:()=>0,cinemaDiscovered:()=>false,cinemaIntroductionDue:()=>false,
  axeBarDiscovered:()=>false,AXE_BAR:{id:'axe_bar',kind:'axe'},
  cafeIdeaDue:()=>false,pickCafeIdea:()=>null,ideaDialogue:()=>null,markCafeIdea:()=>'',
  syncMintoKnowledge:noop,
 };
 const loadSpotModule=async(src,id,linked={})=>{
  const mod=new vm.SourceTextModule(src,{context:spotContext,identifier:id});
  const map=new Map();
  for(const m of src.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)){
   const set=map.get(m[2])||new Set();
   for(const p of m[1].split(',').map(s=>s.trim()).filter(Boolean)) set.add(p.split(/\s+as\s+/)[0]);
   map.set(m[2],set);
  }
  await mod.link(spec=>{
   if(linked[spec]) return linked[spec];
   const names=[...(map.get(spec)||[])];
   return new vm.SyntheticModule(names,function(){
    for(const n of names) this.setExport(n,n in spotOverrides?spotOverrides[n]:noop);
   },{context:spotContext,identifier:spec});
  });
  await mod.evaluate();
  return mod;
 };
 const spotsMod=await loadSpotModule(spotSource,'spots.js');
 const accessMod=await loadSpotModule(accessSource,'spot-access.js',{'./spots.js':spotsMod});
 const sp=spotsMod.namespace, acc=accessMod.namespace;

 // 1) Adam: delivery pending -> delivery event (dl_open, dl_can, dl_thanks), free even at <3000 yen; then normal smoking -> ch1_adam_second
 reset({day:2,slot:0,flags:{_delivery_batch_started:true,_delivery_adam_told:true}});
 state.affinity={};state.visits={};state.contacts=[];state.money=1000;played.length=0;
 const adamSpot=sp.spotById('adam');
 assert.equal(acc.freeGuide(adamSpot,null),true,'Pending delivery spot is free on the map');
 assert.equal(acc.spotAvailability(adamSpot).ok,true,'Pending delivery is accessible even with <3000 yen');
 assert.equal(await sp.visitRival(adamSpot),true);
 assert.equal(played.length,1);
 assert.equal(played[0].id,'ch1_adam_first');
 assert(played[0].texts.some(t=>t.includes('スミさんの届け先だ')),'Adam delivery open branch was not selected');
 assert(played[0].texts.some(t=>t.includes('失われた果実だ')),'Adam delivery handoff branch was not selected');
 assert(played[0].texts.some(t=>t.includes('tonariの主に伝えろ')),'Adam delivery thanks branch was not selected');
 assert(!played[0].texts.some(t=>t.includes('勉強のために')),'Normal customer study branch ran instead of delivery');
 assert.equal(state.flags._delivery_adam,true);
 assert.equal(state.flags._delivery_adam_done,true);
 assert.equal(state.flags._spot_guide_adam,undefined,'Delivery does not count as voluntary customer guide unlock');
 assert.equal(state.money,3000,'+2000 delivery pay without charging 3000 visit cost');
 assert.equal(state.stamina,80,'Delivery spends no stamina');
 assert.equal(acc.freeGuide(adamSpot,null),false,'Completed delivery restores normal cost check');
 played.length=0;
 assert.equal(await sp.visitRival(adamSpot),true);
 assert.equal(played[0].id,'ch1_adam_second','Subsequent visit after delivery runs normal smoking progression');
 assert.equal(state.money,0,'Normal visit charges 3000 yen');
 assert.equal(state.stamina,64,'Normal visit spends 16 stamina');
 assert.equal(state.flags._spot_guide_adam,true);

 // 2) Minto: delivery pending -> remake_delivery_minto_handoff; then normal smoking -> ch1_minto_first with dl_door
 reset({day:2,slot:0,flags:{_delivery_batch_started:true,_delivery_minto_told:true}});
 state.affinity={};state.visits={};state.contacts=[];state.money=1000;played.length=0;
 const mintoSpot=sp.spotById('minto');
 assert.equal(acc.freeGuide(mintoSpot,null),true);
 assert.equal(acc.spotAvailability(mintoSpot).ok,true);
 assert.equal(await sp.visitRival(mintoSpot),true);
 assert.equal(played.length,1);
 assert.equal(played[0].id,'remake_delivery_minto_handoff');
 assert.equal(state.flags._delivery_minto,true);
 assert.equal(state.flags._delivery_minto_done,true);
 assert.equal(state.story.minto,undefined,'Minto handoff leaves ch1_minto_first for customer visit');
 assert.equal(state.money,3000);
 assert.equal(state.stamina,80);
 assert.equal(acc.freeGuide(mintoSpot,null),false);
 played.length=0;
 assert.equal(await sp.visitRival(mintoSpot),true);
 assert.equal(played[0].id,'ch1_minto_first');
 assert(played[0].texts.some(t=>t.includes('配達してくれたはじめくんだ')),'Minto post-delivery customer branch dl_door was not selected');
 assert(!played[0].texts.some(t=>t.includes('おかえりなさーいっ♡ はじめまして')),'Minto self_door branch ran after delivery');
 assert.equal(state.story.minto,1);
 assert.equal(state.money,0);
 assert.equal(state.stamina,64);
 assert.equal(state.flags._spot_guide_minto,true);
 console.log('spots/spot-access delivery priority (#3819 item 2): dialogue branches and post-delivery smoking PASS');
}
