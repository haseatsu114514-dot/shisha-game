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
const spots={naru:{id:'naru',charId:'naru',cost:3000,stamina:-16},minto:{id:'minto'},adam:{id:'adam'},c_station:{id:'c_station'}};
const overrides={spendableMoney,state, DB:{flavorById:{lemon:{}},dialogues:{},lime:[]},
 save:()=>saves.push(structuredClone(state)),
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
 chooseSpot:async opts=>{if(calls.length>100)throw Error('Calendar fixture did not make progress');calls.push({type:'map',pin:opts.guide?.pin,free:opts.guide?.free,day:state.day,slot:state.slot});return opts.guide?.pin||'rest'},
 spotById:id=>spots[id]||{id,kind:'rest',stamina:0},ownsFlavor:()=>false,
 openShop:async()=>calls.push({type:'shop'}),
 visitRival:async spot=>{state.money-=spot.cost;state.stamina+=spot.stamina;state.story.naru=1;calls.push({type:'scout',day:state.day})},
 visitSpot:async spot=>{assert.equal(spot.cost,0);assert.equal(spot.stamina,0);state.flags._c_station_registered=true;calls.push({type:'register',day:state.day,slot:state.slot})},
 visitChar:async id=>{state.story[id]=(state.story[id]||0)+1;calls.push({type:'visit',id,day:state.day,slot:state.slot})},
 storyCount:id=>state.story[id]||0,isClosed:spot=>closed.has(spot.id),isUnlocked:spot=>!locked.has(spot.id),markMet:id=>state.met[id]=true,
 onAction:()=>actionEnds++,presentNow:(...args)=>displayProbe(...args),installReel:()=>installProbe(),
 restingToday:()=>!!state.restDay?.fullDay,
 runNightPlan:async()=>0,nightPlan:()=>[],nightOccupied:()=>false,
 // This delivery fixture has no night schedule; the synchronous guard returns no block.
 fixedNightVisitBlock:events=>{assert.deepEqual(Object.keys(events),[]);return null},
 runHomeShisha:async()=>false,maybeConfession:async()=>false,unreadCount:()=>0,
 completeInvitation:()=>{state.pendingInvite=null},
 invitationCost:()=>0,invitationGrowth:()=>({}),isFriendEvent:()=>false,isFinaleEvent:()=>false,CHAR_STAT:{},storeInvitationSpot:()=>false,
 openingStatus:()=>({ok:true}),VISIT_BG:{},restAtHome:async()=>{},currentCondition:()=>({health:'green'}),
};
const context=vm.createContext({console,Math,Set,String,Number,Array,Promise});
const modules=new Map();
const calendar=new vm.SourceTextModule(source+'\nexport { dueDelivery, day1Errands, deliver, DELIVERIES };',{context});
await calendar.link(async spec=>{
 if(modules.has(spec)) return modules.get(spec);
 const names=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(n=>n.trim().split(/\s+as\s+/)[0]));
 const mod=new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,name in overrides?overrides[name]:asyncNoop)},{context});modules.set(spec,mod);return mod;
});
await calendar.evaluate();const c=calendar.namespace;
function reset({day=2,slot=0,flags={},story={}}={}){
 Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,{chapter:1,day,slot,money:10000,stamina:80,flags:{_errand_scout_done:true,_c_station_registered:true,_ch1_rules_read:true,...flags},story:{...story},met:{},visitedDay:{},stats:{},inbox:[]});calls.length=0;saves.length=0;actionEnds=0;closed.clear();locked.clear();
}
reset();assert.equal(c.dueDelivery().charId,'minto');await c.deliver(c.dueDelivery());assert.equal(c.dueDelivery().charId,'adam');await c.deliver(c.dueDelivery());
assert.equal(c.dueDelivery(),null);assert.equal(state.money,14000);assert.equal(state.stamina,60);assert.equal(state.slot,2);assert.equal(actionEnds,2);assert.equal(state.story.minto,undefined);assert.equal(state.story.adam,1);assert.equal(state.met.minto,true);
assert(calls.find(x=>x.id==='remake_delivery_minto_handoff').opts.bg.endsWith('/peppermint.png'));
// A reload from the committed checkpoint cannot pay or consume a slot twice.
Object.assign(state,structuredClone(saves.at(-1)));assert.equal(c.dueDelivery(),null);assert.equal(state.money,14000);
for(const id of ['minto','adam']){reset({story:{[id]:1}});const d=c.dueDelivery();assert.equal(state.flags[`_delivery_${id}_done`],id==='minto'?true:undefined);if(id==='minto')assert.equal(d,null);else assert.equal(d.charId,'minto');assert.equal(state.money,10000);}
reset({slot:1,story:{minto:1}});assert.equal(c.dueDelivery().charId,'adam');assert.equal(state.flags._delivery_minto_done,true);
reset();closed.add('minto');assert.equal(c.dueDelivery(),null);state.slot=1;assert.equal(c.dueDelivery(),null);closed.clear();assert.equal(c.dueDelivery().charId,'minto');
reset();state.pendingInvite={day:2,slot:0};assert.equal(c.dueDelivery(),null);state.pendingInvite=null;assert.equal(c.dueDelivery().charId,'minto');
reset();state.restDay={fullDay:true};assert.equal(c.dueDelivery(),null);
reset({day:3});assert.equal(c.dueDelivery(),null);state.flags._delivery_schedule_v2=true;assert.equal(c.dueDelivery().charId,'minto');
reset({day:1,slot:1});assert.equal(c.dueDelivery(),null);
// Actual runDaily ordering: shopping/scout, home/sleep, registration, minto, adam.
reset({day:1,flags:{_errand_scout_done:false,_c_station_registered:false}});await c.runDaily({untilDay:3,nightEvents:{}});
assert.deepEqual(calls.filter(x=>['shop','scout','register','visit'].includes(x.type)).map(x=>[x.type,x.id||'',x.day||1]),[['shop','',1],['scout','',1],['register','',2],['visit','adam',2]]);
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
// DAY2 batch handoff: both requests are read in tonari before visiting either shop.
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
assert.equal(state.money,14000);assert.equal(state.stamina,74);assert.equal(actionEnds,2);
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
assert.equal(state.money,14000);assert.equal(state.stamina,74);assert.equal(actionEnds,1);

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
 assert.equal(calls.find(x=>x.type==='map').pin,'minto');
 assert.equal(state.visitedDay.c_station,undefined);
 assert.equal(state.money,14000);assert.equal(actionEnds,2);
});
await entryCheck('resume precedes result display and delivery actions',async()=>{
 reset({flags:{_pakki_first_spin_pending:true}});const trace=[];
 installProbe=async()=>{assert.equal(calls.length,0);trace.push('install');delete state.flags._pakki_first_spin_pending};
 displayProbe=async()=>{if(!trace.includes('display'))assert.equal(calls.length,0);trace.push('display')};
 await c.runDaily({untilDay:3,nightEvents:{}});
 assert.deepEqual(trace.slice(0,2),['install','display']);
 assert.equal(calls.find(x=>x.type==='map').pin,'minto');
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
