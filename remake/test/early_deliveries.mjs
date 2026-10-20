// Run the production calendar in a VM; only its UI/services are replaced.
// node --experimental-vm-modules remake/test/early_deliveries.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../js/daily/calendar.js',import.meta.url),'utf8');
const state={}, calls=[], saves=[], closed=new Set();
let actionEnds=0;
const noop=()=>{}, asyncNoop=async()=>{};
const spots={naru:{id:'naru',charId:'naru',cost:3000,stamina:-16},minto:{id:'minto'},adam:{id:'adam'},c_station:{id:'c_station'}};
const overrides={state, DB:{flavorById:{mint:{}},dialogues:{}},
 save:()=>saves.push(structuredClone(state)),
 el:()=>({classList:{add:noop,remove:noop},remove:noop}), sleep:asyncNoop,
 layers:{fx:{append:noop},modal:{classList:{contains:()=>false}}},
 dayTurn:async fn=>fn(),fadeBlack:async fn=>fn?.(),
 chapterDay:()=>state.day,daysLeft:()=>14-state.day,TOURNAMENT_DAY:14,
 maxStamina:()=>100,staminaRatio:()=>state.stamina/100,
 addMoney:n=>state.money+=n,addStamina:n=>state.stamina=Math.min(100,state.stamina+n),
 catchesCold:()=>false,conditionForRatio:()=>({health:'green'}),
 paidAction:async fn=>({value:await fn(),spent:0}),
 play:async(id,opts)=>calls.push({type:'scene',id,opts,day:state.day,slot:state.slot}),
 chooseSpot:async opts=>{if(calls.length>100)throw Error('Calendar fixture did not make progress');calls.push({type:'map',pin:opts.guide?.pin,day:state.day,slot:state.slot});return opts.guide?.pin||'rest'},
 spotById:id=>spots[id]||{id,kind:'rest',stamina:0},ownsFlavor:()=>false,
 openShop:async()=>calls.push({type:'shop'}),
 visitRival:async spot=>{state.money-=spot.cost;state.stamina+=spot.stamina;state.story.naru=1;calls.push({type:'scout',day:state.day})},
 visitSpot:async spot=>{assert.equal(spot.cost,0);assert.equal(spot.stamina,0);state.flags._c_station_registered=true;calls.push({type:'register',day:state.day,slot:state.slot})},
 visitChar:async id=>{state.story[id]=(state.story[id]||0)+1;calls.push({type:'visit',id,day:state.day,slot:state.slot})},
 storyCount:id=>state.story[id]||0,isClosed:spot=>closed.has(spot.id),markMet:id=>state.met[id]=true,
 onAction:()=>actionEnds++,presentNow:asyncNoop,
 restingToday:()=>!!state.restDay?.fullDay,
 runNightPlan:async()=>0,nightPlan:()=>[],nightOccupied:()=>false,
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
 Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,{chapter:1,day,slot,money:10000,stamina:80,flags:{_errand_scout_done:true,_c_station_registered:true,...flags},story:{...story},met:{},visitedDay:{},stats:{},inbox:[]});calls.length=0;saves.length=0;actionEnds=0;closed.clear();
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
console.log('early deliveries: order, accounting, legacy checkpoints, appointments, closures and rest PASS');
