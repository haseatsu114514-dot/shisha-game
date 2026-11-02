// Actual chapter schedule, night runner, access/people and calendar; controlled UI/VN/stats ports.
// Does not certify real browser, touchscreen, pixels or disk SAVE/LOAD.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../js/',import.meta.url);
let state, paid=0, staminaCalls=0, choices=0, lastOptions, notices=[], saved=[];
const fresh=(day=11,slot=0)=>state={chapter:1,phase:'daily',day,slot,flags:{['_morning_'+day]:true},story:{},met:{sumi:true,tsumugi:true},visitedDay:{},visits:{},money:20000,stamina:100,deferredNightEvents:[]};
fresh();
const ctx=vm.createContext({console});
const actual=new Set(['chapters/ch1.js','daily/calendar.js','daily/night-events.js','daily/spot-access.js','daily/spot-people.js']);
const modules=new Map(), synthetics=new Map();
const tonari={id:'tonari',kind:'tonari',label:'tonari',face:'sumi'};
const other={id:'other',kind:'spot'};
const noop=()=>{};
const ports={
 state,TOURNAMENT_DAY:14,chapterDay:s=>s.day,atChapterFinalDay:s=>s.day>=14,save:()=>saved.push(JSON.stringify(state)),flag:k=>!!state.flags[k],setFlag:k=>{state.flags[k]=true;},
 DB:{dialogues:{},characters:{},lime:[]},CRAFT_STEPS:[],SE:{},displayName:id=>id,el:noop,
 playTsumugiStory:async day=>{state.flags[day===11?'_tsumugi_contest_submitted':'_tsumugi_contest_eve']=true;},
 isUnlocked:()=>true,isClosed:()=>false,isTemporaryClosed:()=>false,visitedToday:()=>false,openingStatus:()=>({ok:true}),spendableMoney:s=>s.money,returnFareReserve:()=>0,
 hiyoriFirstMeetingReady:()=>false,tsumugiAtTonari:()=>true,cityGuestAtShop:()=>null,ryujiAtMeltyPuff:()=>false,
 showHud:noop,initHud:noop,setPhoneBadge:noop,updateHud:noop,unreadCount:()=>0,syncSamechanKnowledge:noop,expireInvitations:noop,presentNow:async()=>{},
 spotById:id=>id==='tonari'?tonari:other,facilityGrowth:()=>({}),toast:text=>notices.push(text),
 paidAction:async fn=>{paid++;return {value:await fn(),spent:0};},addStamina:n=>{staminaCalls++;state.stamina+=n;},
 chooseSpot:async opts=>{lastOptions=opts;choices++;if(choices===1)return 'tonari';assert.equal(opts.visitBlock(other),null);throw Error('next destination boundary');},
};
const stateModules=[];
function get(id){if(!modules.has(id))modules.set(id,new vm.SourceTextModule(fs.readFileSync(new URL(id,root),'utf8'),{context:ctx,identifier:id}));return modules.get(id);}
async function link(spec,ref){
 const id=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),spec));if(actual.has(id))return get(id);
 const key=ref.identifier+'->'+id;if(synthetics.has(key))return synthetics.get(key);
 const text=fs.readFileSync(new URL(ref.identifier,root),'utf8');const names=spec.endsWith('/broadcast.js')?[]:[...text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]));
 const m=new vm.SyntheticModule([...new Set(names)],function(){for(const n of new Set(names))this.setExport(n,n==='state'?state:ports[n]??(()=>{throw Error('Unexpected port '+n);}));},{context:ctx});synthetics.set(key,m);if(id==='core/state.js')stateModules.push(m);return m;
}
async function load(id){const m=get(id);if(m.status==='unlinked')await m.link(link);if(m.status==='linked')await m.evaluate();return m.namespace;}
function reset(day=11,slot=0){fresh(day,slot);for(const m of stateModules)m.setExport('state',state);paid=staminaCalls=choices=0;notices=[];saved=[];}
const chapter=await load('chapters/ch1.js'),night=await load('daily/night-events.js'),access=await load('daily/spot-access.js'),people=await load('daily/spot-people.js'),calendar=await load('daily/calendar.js');
const events=chapter.NIGHT_EVENTS;
// Baseline has no common guard: keep its real availability/people result observable for RED.
const visitBlock=spot=>night.fixedNightVisitBlock?.(events,spot)??null;
const results=[];const check=async(name,fn)=>{await fn();results.push(name);};
await check('actual fixed-day access and all-person suppression preserve pin without mutation',()=>{
 reset();const before=JSON.stringify(state);
 const av = access.spotAvailability(tonari,{visitBlock});
 assert.equal(av.ok,false,'fixed tonari event must reject the earlier free visit');
 assert.match(av.why,/この後もtonari/);
 assert.match(av.desc,/客としての一服・まかない練習・シフトには入れない/);
 assert.match(av.desc,/夜の予定がない日/);
 assert.equal(access.spotVisible(tonari),true);assert.deepEqual([...people.spotPeople(tonari,{visitBlock})],[]);
 assert.equal(access.spotAvailability(other,{visitBlock}).ok,true);
 for(let i=0;i<4;i++)visitBlock(tonari);assert.equal(JSON.stringify(state),before);
});
await check('regular/preparation candidates and a merely future deadline remain available',()=>{
 for(const day of [2,3,5,7,10]){reset(day);if(day>6)Object.assign(state.flags,{_ev_first_practice:true,_tsumugi_contest_progress:true});if(day===10)state.flags._ev_salaryman=true;night.syncNightQueue(events);const before=JSON.stringify(state);assert.equal(visitBlock(tonari),null);assert.equal(access.spotAvailability(tonari,{visitBlock}).ok,true);assert(people.spotPeople(tonari,{visitBlock}).length);assert.equal(JSON.stringify(state),before);}
});
await check('saved urgent preparation, multiple plans, prerequisite chain and non-tonari first event',()=>{
 reset(11);state.flags.ready=true;
 const e={3:{id:'prep',pin:'elsewhere',schedule:'preparation',deadline:6,doneKeys:['prepared'],done:()=>!!state.flags.prepared,run:async()=>{state.flags.prepared=true;}},11:{id:'fixed',pin:'tonari',prerequisites:['prepared'],done:()=>!!state.flags.done,run:async()=>{state.flags.done=true;}}};
 state.deferredNightEvents=[{id:'prep',chapter:1,originalDay:3,deferredOn:10}];
 assert.equal(night.nightPlan(e)[0].pin,'elsewhere');const before=JSON.stringify(state);assert(night.fixedNightVisitBlock(e,tonari));assert.equal(JSON.stringify(state),before);
 state.deferredNightEvents=[];assert.equal(night.fixedNightVisitBlock(e,tonari),null,'Missing prerequisite is not a confirmed visit');
 state.flags.prepared=true;assert(night.fixedNightVisitBlock(e,tonari));
});
await check('deadline day is mandatory through rest/appointments, before deadline is not',()=>{
 for(const day of [5,6]){reset(day);state.deferredNightEvents=[{id:'_ev_first_practice',chapter:1,originalDay:3,deferredOn:4}];state.restDay={chapter:1,day,fullDay:true};state.pendingInvite={day,slot:1};const before=JSON.stringify(state);assert.equal(!!visitBlock(tonari),day===6);assert.equal(JSON.stringify(state),before);}
});
await check('fixed event still executes and unlocks free visits after completion, LOAD and next day',async()=>{
 reset();state.restDay={chapter:1,day:11,fullDay:true};state.pendingInvite={day:11,slot:1};assert(visitBlock(tonari));
 assert.equal(await night.runNightPlan(events),1);assert(events[11].done());assert.equal(visitBlock(tonari),null);
 const snapshot=JSON.stringify(state);state=JSON.parse(snapshot);for(const m of stateModules)m.setExport('state',state);assert.equal(visitBlock(tonari),null);
 state.day=12;state.slot=0;assert.equal(visitBlock(tonari),null);state.day=13;assert(visitBlock(tonari));state.slot=2;assert.equal(visitBlock(tonari),null);
});
await check('public calendar rejects stale/forced choice BEFORE paidAction, stamina, visited; chooses again',async()=>{
 reset();const before=JSON.stringify(state);await assert.rejects(calendar.runDaily({nightEvents:events,untilDay:12}),/next destination boundary/);
 assert.equal(paid,0);assert.equal(staminaCalls,0);assert.equal(JSON.stringify(state),before);assert.equal(choices,2);assert.match(notices[0],/この後もtonari/);
 assert.equal(saved.length,1,'Only the pre-existing calendar loop autosave of unchanged state');assert.equal(saved[0],before);
 assert.equal(lastOptions.visitBlock(tonari).ok,false);
});
// Both map pins and its details reuse availability; no real DOM/rendering acceptance claimed.
const map=fs.readFileSync(new URL('daily/map.js',root),'utf8');assert(map.includes('spotAvailability(s, { guide, visitBlock })'));assert(map.includes('spotPeople(s, { visitBlock })'));assert(map.includes('const av = availability(s)'));
console.log(JSON.stringify({groups:results.length,results,scope:'actual main chapter NIGHT_EVENTS + night runner + public calendar + access/people; controlled unrelated ports; no browser/real SAVE or visual acceptance'},null,2));
