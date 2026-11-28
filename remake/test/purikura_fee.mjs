// Actual exported offer + keepsakes/travel-budget/photo and the actual addMoney function.
// VN/UI/state/storage are controlled ports; this is not browser or menu LOAD acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PURIKURA_PHOTOS } from '../js/core/purikura-data.js';
const photosOf = (id, lover = false) => PURIKURA_PHOTOS.filter(p => p.with === id && !!p.lover === lover);
const root = process.env.PURIKURA_SOURCE_ROOT || fileURLToPath(new URL('../js/', import.meta.url));
const support = process.env.PURIKURA_SUPPORT_ROOT || root;
const read = p => fs.readFileSync(path.join(fs.existsSync(path.join(root,p)) ? root : support,p),'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
async function fixture() {
 let state={chapter:2,day:2,slot:0,phase:'daily',money:1000,stamina:77,inventory:{lemon:12},story:{ageha:1},keepsakes:[],flags:{_ageha_first_purikura:true,_ageha_purikura_offer:'2:1:0'}};
 const log=[],saved=[],memory=new Map();let mode='solo',guest='kumicho',playImpl=async id=>({id,visited:[]}),modalImpl=null;
 let present=[{id:'kumicho',role:'guest',known:true,name:'神崎'},{id:'kuraudo',role:'guest',known:true,name:'クラウド'}];
 const ctx=vm.createContext({console,WeakSet});
 const fixed=(id,values)=>new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context:ctx,identifier:id});
 let stateModule=fixed('core/state.js',{state,save:()=>{saved.push(clone(state));memory.set('save',JSON.stringify(state));}});
 const replace = next=>{state=next;stateModule.setExport('state',state);return state;};
 const el=(selector,attrs={},children=[])=>({selector,attrs,children:Array.isArray(attrs)?attrs:children});
 const ports=new Map([
 ['core/state.js',stateModule],['core/ui.js',fixed('core/ui.js',{toast:()=>{},modal:async o=>{
  log.push({kind:'modal',title:o.title,body:typeof o.body==='string'?o.body:null,node:o.body&&typeof o.body==='object'?o.body:null,options:o.options});
  if(modalImpl)return modalImpl(o);
  if(o.options.some(x=>x.test==='purikura-insufficient'))return true;
  if(o.options.some(x=>x.test==='purikura-receive'))return true;
  // PFC19: まず「撮る（400円）」か、次に相手（居合わせた知り合い／あげは／一人）
  if(o.options.some(x=>x.test==='purikura-shoot'))return mode?true:null;
  if(o.title==='誰と撮る？')return mode==='guest'?guest:mode;
  return mode;
 }})],
 ['core/data.js',fixed('core/data.js',{DB:{characters:{hajime:{},ageha:{},kumicho:{},kuraudo:{},tsumugi:{},rio:{},hiyori:{},adam:{role:'rival_ch1'},uezono:{role:'judge'},sensu:{role:'judge'},dr_charcoal:{role:'judge_and_hidden_boss'}}},displayName:id=>id,portraitInfo:id=>({src:id+'.webp'}),cgUrl:id=>`img/cgs/${id}.webp`})],
 ['core/purikura-doodle.js',fixed('core/purikura-doodle.js',{chooseBooth:async()=>({}),finishBooth:async()=>'',receivePrint:async()=>true})],
 ['core/util.js',fixed('core/util.js',{el})],
 ['core/bus.js',fixed('core/bus.js',{emit:(...args)=>log.push({kind:'emit',args})})],
  ['daily/spot-people.js',fixed('daily/spot-people.js',{spotPeople:()=>present})],
 ['vn/engine.js',fixed('vn/engine.js',{play:async(id,opts)=>{log.push({kind:'play',id,opts});return playImpl(id,opts);}})]
 ]);
 const modules=new Map(ports);
 const real=['chapters/ch2-purikura.js','core/keepsakes.js','core/minto-cheki-data.js','core/purikura-data.js','core/travel-budget.js','core/purikura-photo.js','core/rules.js','core/ryuji-visit.js','core/chapter-clock.js'];
 for(const p of real)modules.set(p,new vm.SourceTextModule(read(p),{context:ctx,identifier:p}));
 const money=read('core/stats.js').match(/export function addMoney\(n\) \{[\s\S]*?\n\}/)?.[0];assert(money,'actual addMoney source');
 modules.set('core/stats.js',new vm.SourceTextModule('import {state} from "./state.js";import {MAX_MONEY} from "./rules.js";import {emit} from "./bus.js";\n'+money,{context:ctx,identifier:'core/stats.js'}));
 const main=modules.get('chapters/ch2-purikura.js');
 await main.link((s,m)=>{const id=path.posix.normalize(path.posix.join(path.posix.dirname(m.identifier),s));assert(modules.has(id),id);return modules.get(id);});await main.evaluate();
 return {get state(){return state;},log,saved,memory,replace,setMode:v=>mode=v,setGuest:v=>guest=v,setPeople:v=>present=v,setPlay:v=>playImpl=v,setModal:v=>modalImpl=v,
  next:()=>state.day++,roundTrip:()=>{memory.set('save',JSON.stringify(state));return replace(JSON.parse(memory.get('save')));},
  offer:(signal,spot={id:'ch2_ageha',kind:'rival',charId:'ageha'})=>main.namespace.offerAgehaPurikura('bg',spot,{signal}),
  pick:(...args)=>main.namespace.pickPurikuraPhoto(...args)};
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
 for(const [mode,guest] of [['solo',null],['pair',null],['guest','kuraudo'],['guest','kumicho']]){
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
  if((phase==='mode'&&o.title==='プリクラ、撮っていく？')||(phase==='guest'&&o.title==='誰と撮る？')||(phase==='receive'&&o.options.some(x=>x.test==='purikura-receive'))){const r=intercept();return r===null?null:o.title==='誰と撮る？'?(phase==='guest'?'kumicho':'solo'):o.title==='プリクラ、撮っていく？'?'solo':true;}
  return o.title==='プリクラ、撮っていく？'?(phase==='guest'?'guest':'solo'):o.title==='誰と撮る？'?(phase==='guest'?'kumicho':'solo'):true;
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
 const old={chapter:2,day:1,slot:1,people:['hajime','kuraudo'],mode:'guest'};f.state.flags._ageha_purikura_history=[clone(old)];f.state.keepsakes=['ageha_first_purikura','minto_first_cheki'];
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
// #3468 A案: クラウドの挨拶回。場面の中で撮るので、料金・思い出の品・撮影履歴は動かさない。組長の挨拶と同じ日には重ねない。
await check('Cloud greeting plays once, later day than Ryuji, and costs nothing',async f=>{
 f.state.met={ageha:true,kumicho:true,kuraudo:true};f.state.flags._ch2_day1={startDay:1};f.setMode(null);
 assert.equal(await f.offer(),true);assert.equal(f.state.flags._ryuji_melty_greeting,true);
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_kuraudo_melty_greeting').length,0,'not on the Ryuji greeting visit');
 f.state.slot=1;assert.equal(await f.offer(),true);assert.equal(f.log.filter(l=>l.id==='remake_ch2_kuraudo_melty_greeting').length,0,'not later on the same day');
 f.state.slot=0;f.next();const before=clone({money:f.state.money,keepsakes:f.state.keepsakes,history:f.state.flags._ageha_purikura_history||null});
 assert.equal(await f.offer(),true);assert.equal(f.log.filter(l=>l.id==='remake_ch2_kuraudo_melty_greeting').length,1);assert.equal(f.state.flags._kuraudo_melty_greeting,3);
 assert.deepEqual(clone({money:f.state.money,keepsakes:f.state.keepsakes,history:f.state.flags._ageha_purikura_history||null}),before);
 f.next();assert.equal(await f.offer(),true);assert.equal(f.log.filter(l=>l.id==='remake_ch2_kuraudo_melty_greeting').length,1,'once only');
});
for(const met of [{ageha:true},{ageha:true,kumicho:true}])await check(`Cloud greeting needs Cloud met (${Object.keys(met)})`,async f=>{
 f.state.met=met;f.state.flags._ch2_day1={startDay:1};f.state.flags._ryuji_melty_greeting=true;f.setMode(null);f.next();
 assert.equal(await f.offer(),true);assert.equal(f.log.filter(l=>l.id==='remake_ch2_kuraudo_melty_greeting').length,0);assert.equal(f.state.flags._kuraudo_melty_greeting,undefined);
});
await check('Cloud greeting cancel keeps it unread',async f=>{
 f.state.met={ageha:true,kuraudo:true};f.state.flags._ch2_day1={startDay:1};f.setPlay(async id=>id==='remake_ch2_kuraudo_melty_greeting'?{cancelled:true}:{id,visited:[]});
 assert.equal(await f.offer(),false);assert.equal(f.state.flags._kuraudo_melty_greeting,undefined);assert.equal(f.state.money,1000);
});
// PFC18: 選定した写真の絵。相手ごとに、まだ撮っていない1枚 → そろった後はもう一度。記録に絵を残し、受け取りの小窓に絵を出す。
const receipt=f=>f.log.filter(l=>l.options?.some(o=>o.test==='purikura-receive')).at(-1)?.node;
await check('PFC18 pair photos: each untaken ageha picture once, then a repeat; the receipt shows the picture',async f=>{
 f.state.money=999999;f.setMode('pair');const seen=[];const friends=photosOf('ageha').map(p=>p.cg);assert(friends.length>=8,'many Ageha two-shots (PFC20)');
 for(let n=0;n<friends.length;n++){assert.equal(await f.offer(),true);const row=f.state.flags._ageha_purikura_history.at(-1);
  assert.match(row.cg,/^cg_purikura_ageha_/);assert(!seen.includes(row.cg),'no repeat while untaken pictures remain');seen.push(row.cg);
  assert(friends.includes(row.cg),'a friend picture while not lovers');
  const node=receipt(f);assert.match(node.selector,/purikura-photo-real/);assert.equal(node.attrs.dataset.cg,row.cg);assert.equal(node.children[0].attrs.src,`img/cgs/${row.cg}.webp`);f.next();}
 assert.equal(await f.offer(),true);assert(seen.includes(f.state.flags._ageha_purikura_history.at(-1).cg),'after all of them, a repeat');
 f.roundTrip();assert.equal(f.state.flags._ageha_purikura_history.length,friends.length+1);assert(f.state.flags._ageha_purikura_history.every(r=>r.cg));
});
await check('PFC18 solo has its picture; a guest without pictures keeps the face photo and no cg',async f=>{
 f.state.money=999999;f.setMode('solo');assert.equal(await f.offer(),true);assert.equal(f.state.flags._ageha_purikura_history.at(-1).cg,'cg_purikura_solo_first');
 f.next();f.setMode('guest');f.setGuest('kuraudo');assert.equal(await f.offer(),true);
 const row=f.state.flags._ageha_purikura_history.at(-1);assert.equal(row.people.join(','),'hajime,kuraudo');assert.equal(row.cg,undefined);
 assert.doesNotMatch(receipt(f).selector,/purikura-photo-real/);assert.equal(receipt(f).attrs.dataset.test,'purikura-photo');
});
await check('PFC18 present guests with pictures (tsumugi/rio/hiyori) get their own photos',async f=>{
 f.state.money=999999;f.state.met={tsumugi:true,rio:true,hiyori:true};
 f.setPeople([{id:'tsumugi',role:'guest',known:true,name:'つむぎ'},{id:'rio',role:'guest',known:true,name:'凛想'},{id:'hiyori',role:'guest',known:true,name:'ひより'}]);
 f.setMode('guest');
 for(const id of ['tsumugi','rio','hiyori']){f.setGuest(id);assert.equal(await f.offer(),true);const row=f.state.flags._ageha_purikura_history.at(-1);
  assert.equal(row.people.join(','),`hajime,${id}`);assert.match(row.cg,new RegExp(`^cg_purikura_${id}_`));assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_guest').length>0,true);f.next();}
});
await check('PFC18 Kanzaki: first photo is the craftsman strip, later his pictures with the trio scene',async f=>{
 f.state.money=999999;f.state.met={ageha:true,kumicho:true};f.state.flags._ryuji_melty_greeting=true;f.setMode('guest');f.setGuest('kumicho');
 assert.equal(await f.offer(),true);let row=f.state.flags._ageha_purikura_history.at(-1);
 assert.equal(row.cg,'cg_ryuji_purikura');assert(f.state.keepsakes.includes('ryuji_purikura'));assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_ryuji').length,1);
 const later=[];for(let n=0;n<2;n++){f.next();assert.equal(await f.offer(),true);later.push(f.state.flags._ageha_purikura_history.at(-1).cg);}
 assert.deepEqual([...later].sort(),['cg_purikura_kumicho_kinen','cg_purikura_kumicho_trio']);
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_ryuji').length,1,'the craftsman scene is the first time only');
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_trio').length,1,'Ageha joins for the three-person picture');
 assert.equal(f.state.keepsakes.filter(id=>id==='ryuji_purikura').length,1);assert.equal(f.state.money,999999-1200);
});
await check('PFC18 picker: slot-limited pictures, untaken first, then any; no pictures gives null',async f=>{
 const at=(slot,history=[])=>({slot,flags:{_ageha_purikura_history:history}});
 for(let i=0;i<20;i++)assert.equal(f.pick('hiyori',{rand:()=>i/20,save:at(0)}).cg,'cg_purikura_hiyori_naisho','after-work picture only at night');
 assert.equal(f.pick('hiyori',{rand:()=>0.99,save:at(1,[{cg:'cg_purikura_hiyori_naisho'}])}).cg,'cg_purikura_hiyori_otsukare');
 assert.equal(f.pick('rio',{rand:()=>0,save:at(0,[{cg:'cg_purikura_rio_tamaniwa'}])}).cg,'cg_purikura_rio_record');
 assert.match(f.pick('rio',{rand:()=>0,save:at(0,[{cg:'cg_purikura_rio_tamaniwa'},{cg:'cg_purikura_rio_record'}])}).cg,/^cg_purikura_rio_/);
 assert.equal(f.pick('adam',{save:at(0)}),null);assert.equal(f.pick('kuraudo',{save:at(0)}),null);
});
// PFC19: 来店の会話の後にまず「撮る（400円）」→ 居合わせた知り合いがいれば、あげはがその人との2ショットを勧める → 相手（知り合い／あげは／一人）。
const tests=l=>l.options.map(o=>o.test).join(',');
await check('PFC19 shoot first, then Ageha suggests the present acquaintance and any partner can be chosen',async f=>{
 f.state.money=999999;f.setMode('pair');assert.equal(await f.offer(),true);
 assert.equal(f.log.filter(l=>l.kind==='modal').map(l=>l.title).join('|'),'プリクラ、撮っていく？|誰と撮る？|今日のプリクラ');
 assert.equal(tests(f.log.find(l=>l.title==='プリクラ、撮っていく？')),'purikura-shoot,purikura-skip');
 const pick=f.log.find(l=>l.title==='誰と撮る？');
 assert.equal(tests(pick),'purikura-with-kumicho,purikura-with-kuraudo,purikura-pair,purikura-solo,purikura-guest-back');
 assert.equal(pick.options[0].label,'神崎と撮る');assert.equal(pick.options[0].primary,true,'Ageha recommends the acquaintance');
 const plays=f.log.filter(l=>l.kind==='play').map(l=>l.id);
 assert.equal(plays.join(','),'remake_ch2_purikura_invite,remake_ch2_purikura_match,remake_ch2_purikura_pair');
 assert.equal(f.state.money,999599);assert.match(f.state.flags._ageha_purikura_history.at(-1).cg,/^cg_purikura_ageha_/);
});
await check('PFC19 without acquaintances Ageha offers herself or solo; skipping at either step charges nothing',async f=>{
 f.state.money=999999;f.setPeople([]);f.setMode('solo');assert.equal(await f.offer(),true);
 const pick=f.log.find(l=>l.title==='誰と撮る？');assert.equal(tests(pick),'purikura-pair,purikura-solo,purikura-guest-back');assert.equal(pick.options[0].primary,true);
 assert(f.log.some(l=>l.id==='remake_ch2_purikura_choose'));assert(!f.log.some(l=>l.id==='remake_ch2_purikura_match'));
 assert.equal(f.state.money,999599);
 f.next();f.setMode(null);assert.equal(await f.offer(),true);assert.equal(f.state.money,999599);
 assert.equal(f.log.filter(l=>l.title==='誰と撮る？').length,1,'declining to shoot asks no partner');
 f.next();f.setModal(o=>o.options.some(x=>x.test==='purikura-shoot')?true:o.title==='誰と撮る？'?null:true);
 assert.equal(await f.offer(),true);assert.equal(f.state.money,999599);assert.equal(f.state.flags._ageha_purikura_history.length,1);
 assert.equal(f.state.flags._ageha_purikura_offer,'2:4:0','backing out still ends today’s offer');
});
await check('PFC19 solo receipt is the first challenge once, then a daily solo',async f=>{
 f.state.money=999999;f.setMode('solo');
 for(let n=0;n<2;n++){assert.equal(await f.offer(),true);f.next();}
 assert.equal(f.log.filter(l=>l.options?.some(o=>o.test==='purikura-receive')).map(l=>l.title).join('|'),'一人で初挑戦！|今日のソロぷり');
});
await check('PFC19/20 lovers get lover photos where they exist, otherwise friend photos; friends never get lover photos',async f=>{
 const at=(lovers,history=[])=>({slot:0,lovers,flags:{_ageha_purikura_history:history}});
 for(const id of ['ageha','tsumugi','rio','hiyori','minto']){
  const lover=photosOf(id,true).map(p=>p.cg),friend=photosOf(id).map(p=>p.cg);
  assert(lover.length>=2&&friend.length>=2,`${id} has friend and lover pictures`);
  for(let i=0;i<10;i++){
   assert(friend.includes(f.pick(id,{rand:()=>i/10,save:at([])}).cg),`${id} friend`);
   assert(friend.includes(f.pick(id,{rand:()=>i/10,save:at(['someone_else'])}).cg),`${id} friend while dating someone else`);
   assert(lover.includes(f.pick(id,{rand:()=>i/10,save:at([id])}).cg),`${id} lover`);
  }
  // 恋人の写真も、まだ撮っていないものから（そろった後はもう一度）
  const taken=lover.slice(0,-1).map(cg=>({cg}));
  assert.equal(f.pick(id,{rand:()=>0,save:at([id],taken)}).cg,lover.at(-1));
 }
 // 恋人の写真がまだ無い相手は友達の写真（神崎は恋人にならないが、仕組みの確認として）
 assert.match(f.pick('kumicho',{rand:()=>0,save:at(['kumicho'])}).cg,/^cg_purikura_kumicho_/);
 assert.equal(f.pick('solo',{rand:()=>0,save:at(['ageha'])}).cg,'cg_purikura_solo_first','solo ignores lovers');
});
await check('PFC20 the first solo is always the first-challenge picture, then the other solos without repeats',async f=>{
 const at=history=>({slot:0,lovers:[],flags:{_ageha_purikura_history:history}});
 for(const r of [0,0.5,0.999])assert.equal(f.pick('solo',{rand:()=>r,save:at([])}).cg,'cg_purikura_solo_first');
 const solos=photosOf('solo').map(p=>p.cg);assert(solos.length>=6,'many solo pictures (PFC20)');
 const history=[{cg:'cg_purikura_solo_first'}],seen=['cg_purikura_solo_first'];
 for(let n=1;n<solos.length;n++){const p=f.pick('solo',{rand:()=>0.999,save:at(history)});assert(!seen.includes(p.cg));seen.push(p.cg);history.push({cg:p.cg});}
 assert.deepEqual([...seen].sort(),[...solos].sort());
});
// PFC22: 審査員（上園・千須会長・チャコール博士）はプリクラの対象外。居合わせても「○○と撮る」に出さない。
await check('PFC22 judges are never offered as purikura partners; other acquaintances still are',async f=>{
 f.state.money=999999;f.setMode('solo');
 f.setPeople(['uezono','sensu','dr_charcoal','adam'].map(id=>({id,role:'guest',known:true,name:id})));
 assert.equal(await f.offer(),true);
 assert.equal(tests(f.log.find(l=>l.title==='誰と撮る？')),'purikura-with-adam,purikura-pair,purikura-solo,purikura-guest-back');
 f.next();f.setPeople(['uezono','sensu','dr_charcoal'].map(id=>({id,role:'guest',known:true,name:id})));
 assert.equal(await f.offer(),true);
 assert.equal(tests(f.log.filter(l=>l.title==='誰と撮る？').at(-1)),'purikura-pair,purikura-solo,purikura-guest-back','only judges present: Ageha offers herself or solo');
 assert.equal(f.log.filter(l=>l.id==='remake_ch2_purikura_choose').length,1);
});
// PFC23: ソロはあげはから勧めない。はじめが言い出して驚かれ、2回目からは「ソロプリハマっちゃったんだね」と笑われる。
await check('PFC23 solo is Hajime’s idea: Ageha never suggests it; first solo surprises her, later ones make her laugh',async f=>{
 const dialogue=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch2_deliveries.json',import.meta.url),'utf8')).dialogues;
 const text=id=>dialogue.find(d=>d.dialogue_id===id).lines.map(l=>l.speaker+':'+l.text).join('\n');
 for(const id of ['remake_ch2_purikura_invite','remake_ch2_purikura_match','remake_ch2_purikura_choose'])assert.doesNotMatch(text(id),/ソロ|一人/,id);
 assert.match(text('remake_ch2_purikura_solo'),/^hajime:.*一人で撮って/m);assert.match(text('remake_ch2_purikura_solo'),/ageha:.*ソロプリ！？/);
 assert.match(text('remake_ch2_purikura_solo_again'),/ハマっちゃったんだね/);
 // 落書きは写真によって、あげはが書いたものと相手が書いたものがあるので、どの写真でも読む場面では触れない（PFC24）
 for(const id of ['remake_ch2_purikura_invite','remake_ch2_purikura_match','remake_ch2_purikura_choose','remake_ch2_purikura_solo','remake_ch2_purikura_solo_again','remake_ch2_purikura_pair','remake_ch2_purikura_guest','remake_ch2_purikura_trio'])assert.doesNotMatch(text(id),/落書き/,id);
 f.state.money=999999;f.setMode('solo');
 for(let n=0;n<3;n++){assert.equal(await f.offer(),true);f.next();}
 const scenes=f.log.filter(l=>/^remake_ch2_purikura_solo/.test(l.id||'')).map(l=>l.id);
 assert.equal(scenes.join(','),'remake_ch2_purikura_solo,remake_ch2_purikura_solo_again,remake_ch2_purikura_solo_again');
 const solo=f.log.find(l=>l.title==='誰と撮る？').options.find(o=>o.test==='purikura-solo');
 assert.equal(solo.label,'一人で撮りたい');assert.notEqual(solo.primary,true,'Ageha never recommends solo');
});
console.log(JSON.stringify({groups,failures,scope:'actual offer/keepsakes/travel/photo and actual addMoney; controlled VM/state/VN/UI/Map-JSON, not browser/menu LOAD'}));
if(failures)process.exitCode=1;
