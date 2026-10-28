// Actual exported offer + keepsakes/travel-budget/photo and the actual addMoney function.
// VN/UI/state/storage are controlled ports; this is not browser or menu LOAD acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = process.env.PURIKURA_SOURCE_ROOT || fileURLToPath(new URL('../js/', import.meta.url));
const support = process.env.PURIKURA_SUPPORT_ROOT || root;
const read = p => fs.readFileSync(path.join(fs.existsSync(path.join(root,p)) ? root : support,p),'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
async function fixture() {
 let state={chapter:2,day:2,slot:0,phase:'daily',money:1000,stamina:77,inventory:{lemon:12},story:{ageha:1},keepsakes:[],flags:{_ageha_first_purikura:true,_ageha_purikura_offer:'2:1:0'}};
 const log=[],saved=[],memory=new Map();let mode='solo',guest='kumicho',playImpl=async id=>({id,visited:[]}),modalImpl=null;
 let present=[{id:'kumicho',role:'guest',known:true,name:'神崎'},{id:'rei',role:'guest',known:true,name:'REI'}];
 const ctx=vm.createContext({console,WeakSet});
 const fixed=(id,values)=>new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context:ctx,identifier:id});
 let stateModule=fixed('core/state.js',{state,save:()=>{saved.push(clone(state));memory.set('save',JSON.stringify(state));}});
 const replace = next=>{state=next;stateModule.setExport('state',state);return state;};
 const el=(selector,attrs={},children=[])=>({selector,attrs,children:Array.isArray(attrs)?attrs:children});
 const ports=new Map([
 ['core/state.js',stateModule],['core/ui.js',fixed('core/ui.js',{toast:()=>{},modal:async o=>{
  log.push({kind:'modal',title:o.title,body:typeof o.body==='string'?o.body:null,options:o.options});
  if(modalImpl)return modalImpl(o);
  if(o.options.some(x=>x.test==='purikura-insufficient'))return true;
  if(o.options.some(x=>x.test==='purikura-receive'))return true;
  if(o.options.some(x=>x.test?.startsWith('purikura-with-')))return guest;
  return mode;
 }})],
 ['core/data.js',fixed('core/data.js',{DB:{characters:{hajime:{},ageha:{},kumicho:{},rei:{}}},displayName:id=>id,portraitInfo:id=>({src:id+'.webp'})})],
 ['core/util.js',fixed('core/util.js',{el})],
 ['core/bus.js',fixed('core/bus.js',{emit:(...args)=>log.push({kind:'emit',args})})],
  ['daily/spot-people.js',fixed('daily/spot-people.js',{spotPeople:()=>present})],
 ['vn/engine.js',fixed('vn/engine.js',{play:async(id,opts)=>{log.push({kind:'play',id,opts});return playImpl(id,opts);}})]
 ]);
 const modules=new Map(ports);
 const real=['chapters/ch2-purikura.js','core/keepsakes.js','core/travel-budget.js','core/purikura-photo.js','core/rules.js','core/ryuji-visit.js','core/chapter-clock.js'];
 for(const p of real)modules.set(p,new vm.SourceTextModule(read(p),{context:ctx,identifier:p}));
 const money=read('core/stats.js').match(/export function addMoney\(n\) \{[\s\S]*?\n\}/)?.[0];assert(money,'actual addMoney source');
 modules.set('core/stats.js',new vm.SourceTextModule('import {state} from "./state.js";import {MAX_MONEY} from "./rules.js";import {emit} from "./bus.js";\n'+money,{context:ctx,identifier:'core/stats.js'}));
 const main=modules.get('chapters/ch2-purikura.js');
 await main.link((s,m)=>{const id=path.posix.normalize(path.posix.join(path.posix.dirname(m.identifier),s));assert(modules.has(id),id);return modules.get(id);});await main.evaluate();
 return {get state(){return state;},log,saved,memory,replace,setMode:v=>mode=v,setGuest:v=>guest=v,setPeople:v=>present=v,setPlay:v=>playImpl=v,setModal:v=>modalImpl=v,
  next:()=>state.day++,roundTrip:()=>{memory.set('save',JSON.stringify(state));return replace(JSON.parse(memory.get('save')));},
  offer:(signal,spot={id:'ch2_ageha',kind:'rival',charId:'ageha'})=>main.namespace.offerAgehaPurikura('bg',spot,{signal})};
}
let groups=0,failures=0;
async function check(name,fn){try{await fn(await fixture());groups++;console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);}}
const paidState=f=>{const before=clone(f.state);return ()=>{assert.equal(f.state.money,before.money);assert.deepEqual(f.state.flags,before.flags);assert.deepEqual(f.state.keepsakes,before.keepsakes);assert.equal(f.saved.length,0);}};
for(const money of [0,399,400,401,999999])await check(`existing first service is free at ${money}; next solo costs once`,async f=>{
 delete f.state.flags._ageha_first_purikura;delete f.state.flags._ageha_purikura_offer;f.state.money=money;
 assert.equal(await f.offer(),true);assert.equal(f.state.money,money);assert.equal(f.state.flags._ageha_first_purikura,true);assert(f.state.keepsakes.includes('ageha_first_purikura'));
 const n=f.saved.length;assert.equal(await f.offer(),true);assert.equal(f.saved.length,n,'same visit no new shot/save');
 f.next();f.setMode('solo');assert.equal(await f.offer(),true);assert.equal(f.state.money,money>=400?money-400:money);assert.equal(f.state.flags._ageha_purikura_history?.length||0,money>=400?1:0);
});
for(const money of [0,399,400,401])await check(`paid funds boundary ${money} before shooting`,async f=>{
 f.state.money=money;const resources=clone({stamina:f.state.stamina,inventory:f.state.inventory,story:f.state.story,slot:f.state.slot});
 assert.equal(await f.offer(),true);assert.equal(f.state.money,money>=400?money-400:money);
 assert.equal(f.state.flags._ageha_purikura_history?.length||0,money>=400?1:0);
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_solo').length,money>=400?1:0);
 assert.deepEqual({stamina:f.state.stamina,inventory:f.state.inventory,story:f.state.story,slot:f.state.slot},resources);
 if(money<400)assert.equal(f.saved.length,0);
});
await check('photo stores chapter DAY while retaining elapsed day and visit identity',async f=>{
 f.state.day=17;f.state.met={};f.state.flags._ch2_day1={startDay:15};
 assert.equal(await f.offer(),true);
 const row=f.state.flags._ageha_purikura_history[0];
 assert.equal(row.day,17);assert.equal(row.chapterDay,3);assert.equal(f.state.flags._ageha_purikura_offer,'2:17:0');
 f.roundTrip();assert.equal(f.state.flags._ageha_purikura_history[0].chapterDay,3);
});
await check('shop visit cost and 200-yen return fare remain reserved',async f=>{
 f.state.flags._ch2_preparation_started=true;f.state.flags._ch2_region='widehanga';const spot={cost:3000};
 f.state.money=3599;assert.equal(await f.offer(undefined,spot),true);assert.equal(f.state.money,3599);assert.equal(f.saved.length,0);
 f.state.money=3600;assert.equal(await f.offer(undefined,spot),true);assert.equal(f.state.money,3200);assert.equal(f.state.flags._ageha_purikura_history.length,1);
});
await check('mode and partner changes do not renew free service; history survives isolated JSON LOAD',async f=>{
 for(const [mode,guest] of [['solo',null],['pair',null],['guest','rei'],['guest','kumicho']]){
  f.state.money=999999;f.setMode(mode);f.setGuest(guest);const before=f.state.flags._ageha_purikura_history?.length||0;
  assert.equal(await f.offer(),true);assert.equal(f.state.money,999599);assert.equal(f.state.flags._ageha_purikura_history.length,before+1);
  const row=f.state.flags._ageha_purikura_history.at(-1);assert.equal(row.mode,mode);assert.equal(row.people.join(','),mode==='solo'?'hajime':`hajime,${mode==='pair'?'ageha':guest}`);
  const snapshot=clone(f.state);f.roundTrip();assert.deepEqual(f.state,snapshot);assert.equal(await f.offer(),true);assert.equal(f.state.money,999599);f.next();
 }
 assert(f.state.keepsakes.includes('ryuji_purikura'));assert.equal(f.state.flags._ageha_purikura_history.length,4);
});
for(const phase of ['invite','mode','guest','shot','receive'])for(const outcome of ['cancel','abort','throw','load'])await check(`${phase} ${outcome}: no photo or fee commit`,async f=>{
 const controller=new AbortController();const original=f.state;const unchanged=paidState(f);let hit=false;
 const intercept=()=>{hit=true;if(outcome==='throw')throw Error('controlled interruption');if(outcome==='abort')controller.abort();if(outcome==='load')f.replace({...clone(original),money:7777,flags:{_loaded:true}});return outcome==='cancel'?null:true;};
 f.setMode(phase==='guest'?'guest':'solo');
 f.setPlay(async id=>{if((phase==='invite'&&id==='remake_ch2_purikura_invite')||(phase==='shot'&&id==='remake_ch2_purikura_solo')){const r=intercept();return r?{id,visited:[]}:{cancelled:true};}return {id,visited:[]};});
 f.setModal(o=>{
  if((phase==='mode'&&o.title==='プリクラ、撮っていく？')||(phase==='guest'&&o.title==='誰と撮る？')||(phase==='receive'&&o.options.some(x=>x.test==='purikura-receive'))){const r=intercept();return r===null?null:o.title==='誰と撮る？'?'kumicho':o.title==='プリクラ、撮っていく？'?'solo':true;}
  return o.title==='プリクラ、撮っていく？'?(phase==='guest'?'guest':'solo'):o.title==='誰と撮る？'?'kumicho':true;
 });
 const job=f.offer(controller.signal);if(outcome==='throw')await assert.rejects(job,/controlled interruption/);else {const result=await job;assert.equal(result,outcome==='cancel'&&['mode','guest'].includes(phase)?true:false);}
 assert(hit);assert.equal(original.money,1000);assert.equal(original.flags._ageha_purikura_history,undefined);assert.equal(original.keepsakes.length,0);
 if(outcome==='load'){assert.equal(f.state.money,7777);assert.deepEqual(f.state.flags,{_loaded:true});assert.equal(f.saved.length,0);}
 else if(outcome==='cancel'&&['mode','guest'].includes(phase)){assert.equal(f.state.flags._ageha_purikura_offer,'2:2:0');}
 else unchanged();
});
for(const outcome of ['missing','cancel','abort','throw','load'])await check(`first free scene ${outcome} keeps free eligibility`,async f=>{
 delete f.state.flags._ageha_first_purikura;delete f.state.flags._ageha_purikura_offer;const old=f.state,c=new AbortController();
 f.setPlay(async()=>{if(outcome==='throw')throw Error('controlled interruption');if(outcome==='abort')c.abort();if(outcome==='load')f.replace({...clone(old),money:8888});return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:{id:'done',visited:[]};});
 if(outcome==='throw')await assert.rejects(f.offer(c.signal),/controlled interruption/);else assert.equal(await f.offer(c.signal),false);
 assert.equal(old.flags._ageha_first_purikura,undefined);assert.equal(old.keepsakes.length,0);assert.equal(old.money,1000);assert.equal(f.saved.length,0);
});
await check('pre-abort starts no VN/UI or payment',async f=>{const c=new AbortController();c.abort();assert.equal(await f.offer(c.signal),false);assert.equal(f.log.length,0);assert.equal(f.saved.length,0);});
await check('same-owner double entry rejected; paid receive commits once',async f=>{
 let release,entered,receives=0;const waiting=new Promise(r=>entered=r);f.setModal(o=>{if(o.options.some(x=>x.test==='purikura-receive')){if(receives++)return true;entered();return new Promise(r=>release=r);}return 'solo';});
 const pending=f.offer();await waiting;const duplicate=await f.offer();const pendingMoney=f.state.money;release(true);const complete=await pending;assert.equal(duplicate,false);assert.equal(pendingMoney,1000);assert.equal(complete,true);assert.equal(f.state.money,600);assert.equal(f.state.flags._ageha_purikura_history.length,1);
 assert.equal(await f.offer(),true);assert.equal(f.state.money,600);
});
await check('same-owner day advance during shot cannot commit to a new visit',async f=>{f.setPlay(async id=>{if(id==='remake_ch2_purikura_solo')f.next();return {id,visited:[]};});assert.equal(await f.offer(),false);assert.equal(f.state.money,1000);assert.equal(f.saved.length,0);});
await check('receipt cancel can retry without charge; only normal receive advances solo history',async f=>{let cancel=true;f.setModal(o=>o.options.some(x=>x.test==='purikura-receive')?(cancel?null:true):'solo');assert.equal(await f.offer(),false);assert.equal(f.state.flags._ageha_purikura_history,undefined);cancel=false;assert.equal(await f.offer(),true);assert.equal(f.state.money,600);assert.equal(f.state.flags._ageha_purikura_history.length,1);});
await check('display declares 400yen before mode choice and at receipt',async f=>{await f.offer();const choice=f.log.find(l=>l.title==='プリクラ、撮っていく？');assert.match(choice.body,/400円/);assert.doesNotMatch(choice.body,/追加の代金.*使いません/);assert(choice.options.filter(o=>o.value).every(o=>/400円/.test(o.label)));assert(f.log.find(l=>l.options?.some(o=>o.test==='purikura-receive')).options[0].label.includes('400円'));});
await check('existing photo history and unrelated keepsakes are preserved',async f=>{
 const old={chapter:2,day:1,slot:1,people:['hajime','rei'],mode:'guest'};f.state.flags._ageha_purikura_history=[clone(old)];f.state.keepsakes=['ageha_first_purikura','minto_first_cheki'];
 f.setMode('pair');assert.equal(await f.offer(),true);assert.deepEqual(f.state.flags._ageha_purikura_history[0],old);assert.equal(f.state.flags._ageha_purikura_history.length,2);assert.deepEqual(f.state.keepsakes,['ageha_first_purikura','minto_first_cheki']);assert.equal(f.state.money,600);
});
await check('funds lost while receiving do not create photo or overdraw reserved costs',async f=>{
 f.setModal(o=>{if(o.options.some(x=>x.test==='purikura-receive')){f.state.money=399;return true;}return o.options.some(x=>x.test==='purikura-insufficient')?true:'solo';});
 assert.equal(await f.offer(),true);assert.equal(f.state.money,399);assert.equal(f.state.flags._ageha_purikura_history,undefined);assert.equal(f.saved.length,0);
});
await check('guest who left before receipt creates no photo, charge or keepsake',async f=>{
 f.setMode('guest');f.setModal(o=>{if(o.options.some(x=>x.test==='purikura-receive')){f.setPeople([]);return true;}return o.title==='誰と撮る？'?'kumicho':'guest';});
 assert.equal(await f.offer(),false);assert.equal(f.state.money,1000);assert.equal(f.saved.length,0);assert.equal(f.state.keepsakes.length,0);
});
await check('throw releases entry lock for a normal retry',async f=>{
 f.setPlay(async()=>{throw Error('controlled retry failure');});await assert.rejects(f.offer(),/controlled retry failure/);
 f.setPlay(async id=>({id,visited:[]}));assert.equal(await f.offer(),true);assert.equal(f.state.money,600);assert.equal(f.state.flags._ageha_purikura_history.length,1);
});
for(const cancel of [false,true])await check(`existing Ryuji greeting stays separate; photo cancel=${cancel}`,async f=>{
 f.state.met={ageha:true,kumicho:true};f.state.flags._ch2_day1={startDay:1};f.setMode('guest');
 f.setModal(o=>o.options.some(x=>x.test==='purikura-receive')?(cancel?null:true):o.title==='誰と撮る？'?'kumicho':'guest');
 assert.equal(await f.offer(),!cancel);assert.equal(f.state.flags._ryuji_melty_greeting,true);assert.equal(f.state.flags._ryuji_melty_visit,'2:2:0');
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_ryuji_melty_greeting').length,1);assert.equal(f.state.money,cancel?1000:600);assert.equal(f.state.flags._ageha_purikura_history?.length||0,cancel?0:1);
});
console.log(JSON.stringify({groups,failures,scope:'actual offer/keepsakes/travel/photo and actual addMoney; controlled VM/state/VN/UI/Map-JSON, not browser/menu LOAD'}));
if(failures)process.exitCode=1;
