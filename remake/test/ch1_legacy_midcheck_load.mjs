// Legacy DAY7: real state/SAVE/LOAD, public event, practice/history and rig reward.
// In-memory localStorage, controlled VN/graphics/craft ports; no browser or user SAVE.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const [root='.',out=null]=process.argv.slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
const dialogues=Object.fromEntries(['remake_ch1','ch1_sumi'].flatMap(file=>JSON.parse(fs.readFileSync(`${root}/data/dialogue/${file}.json`)).dialogues).map(d=>[d.dialogue_id,d]));
const real=new Set(['chapters/ch1.js','core/state.js','craft/practice.js','craft/practice-history.js','daily/night-events.js','chapters/naru-match.js','daily/home-rig.js','daily/preparation.js']);
const ticks=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
async function harness({route='first',holdAt=null,breakAt=null,broken='cancel',craftMode='success',storageWritable=true,choice='full',legacy=true,progress={},image=false,stocked=false}={}){
 const modules=new Map(),synth=new Map(),memory=new Map(),writes=[],entries=[],choiceScenes=[],steps=[],sessions=[],retired=[],ownerNumbers=new WeakMap();
 let stateModule,ownerSeq=0,generation=0,gateResolve,gate=new Promise(r=>gateResolve=r),releaseGate,waitGate=new Promise(r=>releaseGate=r),held=false;
 const current=()=>stateModule?.namespace.state;
 const ownerNumber=owner=>{if(!ownerNumbers.has(owner))ownerNumbers.set(owner,++ownerSeq);return ownerNumbers.get(owner)};
 const memoryStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(!storageWritable)throw Error('memory storage blocked');memory.set(key,String(value));writes.push({key,owner:ownerNumber(current()),value:JSON.parse(value)})},removeItem:key=>memory.delete(key)};
 const context=vm.createContext({console,DOMException,setTimeout,clearTimeout,localStorage:memoryStorage,sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
 const boundary=async name=>{if(name===holdAt&&!held){held=true;gateResolve();await waitGate}if(name===breakAt){if(broken==='throw')throw Error('controlled '+name+' error');if(broken==='abort')throw new DOMException('controlled '+name+' abort','AbortError');return broken==='missing'?undefined:broken==='false'?false:{cancelled:true}}return {id:name,visited:[name]}};
 const owners=new WeakMap();
 const ports={
  temperatureBands:()=>({ideal:[.4,.7]}),isIdealTemperature:t=>t>=.4&&t<=.7,vnTest:{turbo:!image},img:x=>x,imageReady:async()=>{await boundary('rigImage');return true},withScenePreparation:p=>p,modal:async()=>boundary('rigModal'),el:()=>({}),toast:()=>{},masteryDay:()=>7,growthSkill:()=>false,gainFlavorExperience:()=>[],notifyMastery:()=>{},computeShisha:()=>({craftQuality:80}),MAX_MONEY:100000000,TOURNAMENT_DAY:14,emit:()=>{},recordGalleryProgress:()=>{},
  DB:{dialogues,characters:{}},hooks:{},chapterDay:s=>s.day,atChapterFinalDay:s=>s.day>=14,recordRomanceChoice:()=>{},
  playTsumugiStory:async()=>{await boundary('tsumugi')},
  play:async input=>{const d=typeof input==='string'?dialogues[input]:input;assert(d,'actual dialogue must exist');entries.push(d.dialogue_id);
   const question=d.lines.find(x=>x.type==='choice');if(question){choiceScenes.push(d.dialogue_id);const answer=question.choices.find(x=>x.next===choice);assert(answer);ports.hooks.onChoice?.(d.dialogue_id,'',answer.next,'',answer,question)}
   return boundary(d.dialogue_id)},
  newSession:mode=>{assert.equal(mode,'rehearsal');const cs={mode,pullDone:false,mix:{double_apple:12},careHistory:[],failed:null};sessions.push(cs);owners.set(cs,current());return cs},
  openBench:cs=>steps.push('bench'),waitBenchReady:async()=>{await boundary('ready')},
  retireScreen:()=>retired.push(ownerNumber(current())),waterQuantity:x=>x,
 };
 for(const name of ['stepSetup','stepWater','stepMix','stepPack','runHoles','stepPlace','runHeat','stepSteamTime','runSteamDodge'])ports[name]=async cs=>{steps.push(name);if(name==='stepSetup')owners.get(cs).stamina-=4;await boundary(name)};
 ports.runPull=async cs=>{steps.push('pull');await boundary('pull');if(craftMode==='throw')throw Error('controlled pull error');if(craftMode==='abort')throw new DOMException('controlled pull abort','AbortError');if(craftMode==='unserved')return false;cs.pullDone=true;cs.failed=craftMode==='failed'?'burnt':null;cs.pull={failed:!!cs.failed,score:80,temp:.55};cs.holes={score:80};cs.heat={score:80};return true};
 ports.runCare=async (cs,{round})=>{steps.push('care'+round);await boundary('care'+round);cs.careHistory.push({score:80});if(craftMode==='cold'||craftMode==='leaf')cs.failed=craftMode};
 // Stock selection/shop UI stays controlled; preparation's async SAVE boundaries are real.
 ports.ownedFlavorIds=()=>stocked?['blueberry']:[];ports.flavorStock=()=>stocked?50:0;
 ports.autoSkill=()=>true;ports.SE={select:()=>{}};ports.DB.flavorById={};
 ports.showScreen=()=>({});ports.retire=()=>{};
 ports.el=(tag,props)=>({click:async()=>{await boundary('stockChoice');props?.onclick?.()}});
 ports.openShop=async()=>boundary('stock');
 const code=id=>fs.readFileSync(`${root}/remake/js/${id}`,'utf8');
 function module(id){if(modules.has(id))return modules.get(id);const m=new vm.SourceTextModule(code(id),{identifier:id,context});modules.set(id,m);return m}
 async function link(spec,ref){const id=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),spec));if(real.has(id))return module(id);
  const key=ref.identifier+'->'+id;if(synth.has(key))return synth.get(key);
  const names=[...code(ref.identifier).matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]));
  const m=new vm.SyntheticModule([...new Set(names)],function(){for(const n of new Set(names))this.setExport(n,ports[n]??(()=>{throw Error('Unexpected controlled port '+n)}))},{identifier:key,context});synth.set(key,m);return m}
 const chapter=module('chapters/ch1.js');await chapter.link(link);await chapter.evaluate();stateModule=modules.get('core/state.js');const core=stateModule.namespace;
 core.newGame();Object.assign(current(),{phase:'daily',day:7,slot:2,stamina:80,money:18000,flavorStock:{double_apple:50},best:{heat:1},met:{sumi:true}});current().flags._tsumugi_contest_progress=true;current().flags._ev_first_practice=true;if(legacy)current().flags._ch1_mid={introRead:true,...progress};
 if(route!=='first')current().flags._craft_practice_runs=[{day:route==='retry'?3:1,kind:route==='retry'?'practice':'tutorial',scope:'full',success:route!=='retry',served:route!=='retry',adjustments:2,mix:{double_apple:12},scores:{},careScores:[]}];
 chapter.namespace.setupHooks();const initial=current();ownerNumber(initial);
 const run=(night=false)=>(night?modules.get('daily/night-events.js').namespace.runNightPlan(chapter.namespace.NIGHT_EVENTS):chapter.namespace.NIGHT_EVENTS[7].run()).then(()=>null,error=>({name:error.name,message:error.message}));
 const deferred=()=>{current().deferredNightEvents=[{id:'_ev_first_practice',chapter:1,originalDay:3,deferredOn:2,doneKeys:['_ev_first_practice']}];};
 const saveSlot=()=>{assert(core.saveToSlot('suien_remake_slot1'));return JSON.parse(memory.get('suien_remake_slot1'))};
 const loadSlot=()=>{generation++;const loaded=core.loadFromSlot('suien_remake_slot1');assert(loaded);return loaded};
 const stats=()=>({state:clone(current()),initial:clone(initial),entries:[...entries],choiceScenes:[...choiceScenes],steps:[...steps],sessions:sessions.length,retired:[...retired],writes:clone(writes),owner:ownerNumber(current()),generation});
 return {run,deferred,saveSlot,loadSlot,core,current,initial,stats,gate,release:()=>releaseGate(),setHold:value=>{holdAt=value},setBreak:value=>{breakAt=value},setMode:value=>{craftMode=value},setWritable:value=>{storageWritable=value},memory,ownerNumber};
}
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(error){results.push({name,passed:false,error:error.stack})}}
const stable=s=>{const c=clone(s);delete c.savedAt;return c};
const records=s=>(s.flags._craft_practice_runs||[]).filter(r=>r.kind==='midcheck');
const boundaries=[
 ['stockChoice',{}],['stock',{}],['remake_midcheck_review',{route:'review'}],['ready',{}],['pull',{}],['care1',{}],
 ['remake_preparation_failed',{craftMode:'failed'}],['remake_midcheck',{}],
 ['ch1_sumi_home_rig',{}],['rigImage',{image:true}],['rigModal',{image:true}],
];
for(const [at,options] of boundaries)for(const loadDay of [3,7])await check(`legacy LOAD day${loadDay} during ${at}`,async()=>{
 const h=await harness({...options,holdAt:at});
 h.current().day=loadDay;h.saveSlot();h.current().day=7;
 const pending=h.run();await h.gate;const oldProgress=clone(h.initial.flags._ch1_mid);
 h.loadSlot();h.current().flags.keep_new_owner='preserve';h.core.save();
 const owner=h.current(),before=stable(owner),writes=h.stats().writes.length,retired=h.stats().retired.length;
 h.release();const error=await pending;assert.equal(error?.name,'AbortError','old event must abort');
 assert.strictEqual(h.current(),owner);assert.deepEqual(stable(owner),before);assert.deepEqual(clone(h.initial.flags._ch1_mid),oldProgress);
 assert.equal(h.stats().writes.length,writes);assert.equal(h.stats().retired.length,retired);assert(!owner.flags._ev_midcheck);
});
for(const at of ['stockChoice','stock','ready','care1','ch1_sumi_home_rig','rigImage','rigModal'])for(const change of ['day','chapter','slot','progress'])await check(`legacy same owner ${change} change during ${at}`,async()=>{
 const h=await harness({holdAt:at,image:at==='rigImage'||at==='rigModal'});const pending=h.run();await h.gate;
 if(change==='progress')h.current().flags._ch1_mid={introRead:true,choice:'stock'};else h.current()[change]++;
 const before=stable(h.current()),writes=h.stats().writes.length;h.release();assert.equal((await pending)?.name,'AbortError');
 assert.deepEqual(stable(h.current()),before);assert.equal(h.stats().writes.length,writes);
});
for(const [at,options] of [['remake_midcheck_review',{route:'review'}],['remake_preparation_failed',{craftMode:'failed'}],['remake_midcheck',{}]])for(const broken of ['false','cancel','missing','throw','abort'])await check(`legacy ${broken} dialogue ${at}`,async()=>{
 const h=await harness({...options,breakAt:at,broken});assert(await h.run());assert(!h.current().flags._ev_midcheck);assert(!h.current().flags._ch1_mid.feedbackRead);
 if(at==='remake_midcheck_review')assert.equal(h.stats().sessions,0);
});
for(const choice of ['full','stock'])await check(`legacy ${choice} completion SAVE/LOAD no repeated record or rig reward`,async()=>{
 const h=await harness({route:'review',choice});assert.equal(await h.run(),null);
 const p=h.current().flags._ch1_mid;assert(!p.naruMatch);assert.equal(p.choice,choice);assert(p.stockDone&&p.feedbackRead);assert.equal(!!p.practiceDone,choice==='full');
 assert(h.current().flags._ev_midcheck);assert.equal(records(h.current()).length,choice==='full'?1:0);assert.equal(h.current().owned.filter(x=>x==='home_rig_set').length,1);
 h.saveSlot();h.loadSlot();const before=stable(h.current()),sessions=h.stats().sessions,rewards=h.stats().entries.filter(x=>x==='ch1_sumi_home_rig').length;
 assert.equal(await h.run(),null);assert.deepEqual(stable(h.current()),before);assert.equal(h.stats().sessions,sessions);assert.equal(h.stats().entries.filter(x=>x==='ch1_sumi_home_rig').length,rewards);
});
for(const progress of [{stockDone:true,choice:'stock',feedbackRead:true},{stockDone:true,choice:'full',practiceDone:true,feedbackRead:true,midBranch:'mid_good'}])await check(`legacy completed checkpoints respected ${progress.choice}`,async()=>{
 const h=await harness({progress});h.current().owned.push('home_rig_set');const before=clone(h.current().flags._ch1_mid);assert.equal(await h.run(),null);
 assert.deepEqual(clone(h.current().flags._ch1_mid),before);assert(h.current().flags._ev_midcheck);assert.equal(h.stats().sessions,0);assert.equal(h.stats().entries.length,0);
});
await check('legacy existing stocked flavor respects old checkpoint and avoids shop',async()=>{
 const h=await harness({stocked:true,progress:{choice:'stock'}});assert.equal(await h.run(),null);
 assert.equal(h.current().flags._prep_flavor,'blueberry');assert(h.current().flags._ch1_mid.stockDone);assert(h.current().flags._ev_midcheck);assert.equal(h.stats().sessions,0);
});
await check('new DAY7 naru route unchanged with real rig reward',async()=>{
 const h=await harness({legacy:false});assert.equal(await h.run(),null);assert(h.current().flags._ch1_mid.naruMatch);assert(h.current().flags._ev_midcheck);assert.equal(h.current().owned.filter(x=>x==='home_rig_set').length,1);
});
const summary={total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,scope:'Real current state/SAVE/LOAD with legacy introRead checkpoints, public DAY7 once, full practice/history and real home-rig reward; real preparation with controlled VN, stock selection/shop UI, graphics and craft steps. No browser or user storage.',results};
if(out)fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));assert.equal(summary.failed,0);
