// Real state newGame/save/loadFromSlot + public DAY3 + real practice/history/night.
// In-memory localStorage, controlled VN/graphics/craft ports; no browser or user SAVE.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const [root='.',out=null,...opts]=process.argv.slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
const dialogues=Object.fromEntries(JSON.parse(fs.readFileSync(`${root}/data/dialogue/remake_ch1.json`)).dialogues.map(d=>[d.dialogue_id,d]));
const real=new Set(['chapters/ch1.js','core/state.js','craft/practice.js','craft/practice-history.js','daily/night-events.js']);
const ticks=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
async function harness({route='first',holdAt=null,breakAt=null,broken='cancel',craftMode='success',storageWritable=true}={}){
 const modules=new Map(),synth=new Map(),memory=new Map(),writes=[],entries=[],choiceScenes=[],steps=[],sessions=[],retired=[],ownerNumbers=new WeakMap();
 let stateModule,ownerSeq=0,generation=0,gateResolve,gate=new Promise(r=>gateResolve=r),releaseGate,waitGate=new Promise(r=>releaseGate=r),held=false;
 const current=()=>stateModule?.namespace.state;
 const ownerNumber=owner=>{if(!ownerNumbers.has(owner))ownerNumbers.set(owner,++ownerSeq);return ownerNumbers.get(owner)};
 const memoryStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(!storageWritable)throw Error('memory storage blocked');memory.set(key,String(value));writes.push({key,owner:ownerNumber(current()),value:JSON.parse(value)})},removeItem:key=>memory.delete(key)};
 const context=vm.createContext({console,DOMException,setTimeout,clearTimeout,localStorage:memoryStorage,sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
 const boundary=async name=>{if(name===holdAt&&!held){held=true;gateResolve();await waitGate}if(name===breakAt){if(broken==='throw')throw Error('controlled '+name+' error');if(broken==='abort')throw new DOMException('controlled '+name+' abort','AbortError');return broken==='missing'?undefined:broken==='false'?false:{cancelled:true}}return {id:name,visited:[name]}};
 const owners=new WeakMap();
 const ports={
  MAX_MONEY:100000000,TOURNAMENT_DAY:14,emit:()=>{},recordGalleryProgress:()=>{},
  DB:{dialogues,characters:{}},hooks:{},chapterDay:s=>s.day,atChapterFinalDay:s=>s.day>=14,recordRomanceChoice:()=>{},
  playTsumugiStory:async()=>{await boundary('tsumugi')},
  play:async input=>{const d=typeof input==='string'?dialogues[input]:input;assert(d,'actual dialogue must exist');entries.push(d.dialogue_id);
   const question=d.lines.find(x=>x.type==='choice');if(question){choiceScenes.push(d.dialogue_id);const choice=question.choices.find(x=>x.next==='full');assert(choice);ports.hooks.onChoice?.(d.dialogue_id,'',choice.next,'',choice,question)}
   return boundary(d.dialogue_id)},
  newSession:mode=>{assert.equal(mode,'tutorial');const cs={mode,pullDone:false,mix:{double_apple:12},careHistory:[],failed:null};sessions.push(cs);owners.set(cs,current());return cs},
  openBench:cs=>steps.push('bench'),waitBenchReady:async()=>{await boundary('ready')},
  retireScreen:()=>retired.push(ownerNumber(current())),waterQuantity:x=>x,
 };
 for(const name of ['stepSetup','stepWater','stepMix','stepPack','runHoles','stepPlace','runHeat','stepSteamTime','runSteamDodge'])ports[name]=async cs=>{steps.push(name);if(name==='stepSetup')owners.get(cs).stamina-=4;await boundary(name)};
 ports.runPull=async cs=>{steps.push('pull');await boundary('pull');if(craftMode==='throw')throw Error('controlled pull error');if(craftMode==='abort')throw new DOMException('controlled pull abort','AbortError');if(craftMode==='unserved')return false;cs.pullDone=true;cs.failed=craftMode==='failed'?'burnt':null;cs.pull={failed:!!cs.failed};return true};
 const code=id=>fs.readFileSync(`${root}/remake/js/${id}`,'utf8');
 function module(id){if(modules.has(id))return modules.get(id);const m=new vm.SourceTextModule(code(id),{identifier:id,context});modules.set(id,m);return m}
 async function link(spec,ref){const id=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),spec));if(real.has(id))return module(id);
  const key=ref.identifier+'->'+id;if(synth.has(key))return synth.get(key);
  const names=[...code(ref.identifier).matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]));
  const m=new vm.SyntheticModule([...new Set(names)],function(){for(const n of new Set(names))this.setExport(n,ports[n]??(()=>{throw Error('Unexpected controlled port '+n)}))},{identifier:key,context});synth.set(key,m);return m}
 const chapter=module('chapters/ch1.js');await chapter.link(link);await chapter.evaluate();stateModule=modules.get('core/state.js');const core=stateModule.namespace;
 core.newGame();Object.assign(current(),{phase:'daily',day:3,slot:2,stamina:80,money:18000,flavorStock:{double_apple:50},best:{heat:1},met:{sumi:true}});current().flags._tsumugi_contest_progress=true;
 if(route!=='first')current().flags._craft_practice_runs=[{day:route==='retry'?3:1,kind:route==='retry'?'practice':'tutorial',scope:'full',success:route!=='retry',served:route!=='retry',adjustments:0,mix:{double_apple:12},scores:{},careScores:[]}];
 chapter.namespace.setupHooks();const initial=current();ownerNumber(initial);
 const run=(night=false)=>(night?modules.get('daily/night-events.js').namespace.runNightPlan(chapter.namespace.NIGHT_EVENTS):chapter.namespace.NIGHT_EVENTS[3].run()).then(()=>null,error=>({name:error.name,message:error.message}));
 const deferred=()=>{current().deferredNightEvents=[{id:'_ev_first_practice',chapter:1,originalDay:3,deferredOn:2,doneKeys:['_ev_first_practice']}];};
 const saveSlot=()=>{assert(core.saveToSlot('suien_remake_slot1'));return JSON.parse(memory.get('suien_remake_slot1'))};
 const loadSlot=()=>{generation++;const loaded=core.loadFromSlot('suien_remake_slot1');assert(loaded);return loaded};
 const stats=()=>({state:clone(current()),initial:clone(initial),entries:[...entries],choiceScenes:[...choiceScenes],steps:[...steps],sessions:sessions.length,retired:[...retired],writes:clone(writes),owner:ownerNumber(current()),generation});
 return {run,deferred,saveSlot,loadSlot,core,current,initial,stats,gate,release:()=>releaseGate(),setHold:value=>{holdAt=value},setBreak:value=>{breakAt=value},setMode:value=>{craftMode=value},setWritable:value=>{storageWritable=value},memory,ownerNumber};
}
const results=[];async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.stack})}}
const stable=s=>{const c=clone(s);delete c.savedAt;return c};
const resources=s=>({money:s.money,flavorStock:s.flavorStock,stats:s.stats,best:s.best,rehearsal:s.rehearsal,owned:s.owned,inventory:s.equip});
const noComplete=s=>{assert(!s.flags._ch1_early?.practiceDone);assert(!s.flags._ch1_early?.feedbackRead);assert(!s.flags._ev_first_practice)};
const earlyRecords=s=>(s.flags._craft_practice_runs||[]).filter(r=>r.kind==='early');
for(const [route,scene]of [['first','remake_preparation_first'],['review','remake_preparation_review'],['retry','remake_preparation_retry']])await check('current-'+route+'-full-only-complete-and-reLOAD',async()=>{
 const h=await harness({route});const before=resources(clone(h.current()));assert.equal(await h.run(),null);let r=h.stats();assert(r.entries.includes(scene));assert.equal(r.choiceScenes.length,0);assert.equal(r.sessions,1);assert.equal(r.state.flags._ch1_early.choice,'full');assert.equal(r.state.stamina,76);assert.equal(earlyRecords(r.state).length,1);assert(earlyRecords(r.state)[0].served);assert.equal(earlyRecords(r.state)[0].adjustments,0);assert(r.state.flags._ch1_early.feedbackRead&&r.state.flags._ev_first_practice);assert.deepEqual(resources(r.state),before);
 h.saveSlot();const completed=stable(h.current());h.loadSlot();assert.equal(await h.run(),null);r=h.stats();assert.equal(r.sessions,1);assert.deepEqual(stable(r.state),completed);
});
await check('current-dialogues-have-no-choice-or-drill-review-branch',async()=>{for(const id of ['remake_preparation_review','remake_preparation_retry']){assert(dialogues[id].lines.every(l=>l.type!=='choice'));assert(!dialogues[id].branches);assert(!/苦手な工程だけ|手順だけ確認|一つに絞っても|どうする？/.test(JSON.stringify(dialogues[id])))}});
for(const scene of ['remake_preparation_first','remake_preparation_review','remake_preparation_retry','remake_preparation_first_end','remake_preparation_failed_day3'])for(const broken of ['false','cancel','missing','throw','abort'])await check('current-VN-'+scene+'-'+broken,async()=>{
 const route=scene.endsWith('_review')?'review':scene.endsWith('_retry')?'retry':'first';const h=await harness({route,breakAt:scene,broken,craftMode:scene.endsWith('_failed_day3')?'failed':'success'});h.deferred();assert(await h.run(true));const r=h.stats();assert(!r.state.flags._ev_first_practice);assert(!r.state.flags._ch1_early?.feedbackRead);assert(!r.state.flags._night_event_day);
 if(scene==='remake_preparation_first_end'||scene==='remake_preparation_failed_day3')assert(r.state.flags._ch1_early.practiceDone);else{assert.equal(r.sessions,0);assert(!r.state.flags._ch1_early.choice)}
});
for(const mode of ['unserved','throw','abort'])await check('current-runner-'+mode+'-then-fresh-retry',async()=>{
 const h=await harness({craftMode:mode});h.deferred();assert(await h.run(true));const r=h.stats();noComplete(r.state);assert.equal(earlyRecords(r.state).length,0);assert(!r.state.flags._night_event_day);assert.equal(r.retired.length,0);assert.equal(r.state.flags._ch1_early.choice,'full');
 h.saveSlot();h.loadSlot();h.setMode('success');assert.equal(await h.run(true),null);const after=h.stats();assert.equal(after.state.stamina,76);assert.equal(earlyRecords(after.state).length,1);assert(after.state.flags._ev_first_practice);assert.equal(after.entries.filter(x=>x==='remake_preparation_first').length,1);
});
await check('current-failed-served-session-feedback-once',async()=>{
 const h=await harness({craftMode:'failed'});assert.equal(await h.run(),null);h.saveSlot();const before=stable(h.current());h.loadSlot();assert.equal(await h.run(),null);const r=h.stats();assert.equal(r.sessions,1);assert.equal(earlyRecords(r.state).length,1);assert.equal(earlyRecords(r.state)[0].success,false);assert.equal(r.state.flags._ch1_early.failed,'burnt');assert.equal(r.entries.filter(x=>x==='remake_preparation_failed_day3').length,1);assert.deepEqual(stable(r.state),before);
});
await check('current-feedback-cancel-save-LOAD-resumes-without-new-craft',async()=>{
 const h=await harness({breakAt:'remake_preparation_first_end'});assert(await h.run());let r=h.stats();assert(r.state.flags._ch1_early.practiceDone);assert(!r.state.flags._ch1_early.feedbackRead);assert(!r.state.flags._ev_first_practice);const saved=h.saveSlot();h.loadSlot();h.setBreak(null);assert.equal(await h.run(),null);r=h.stats();assert.equal(r.sessions,1);assert.equal(earlyRecords(r.state).length,1);assert.equal(r.state.stamina,saved.stamina);assert(r.state.flags._ch1_early.feedbackRead&&r.state.flags._ev_first_practice);
});
for(const at of ['remake_preparation_first','ready','stepSetup','pull','remake_preparation_first_end'])await check('new-save-LOAD-during-'+at+'-old-late-result-is-inert',async()=>{
 const h=await harness({holdAt:at});h.deferred();const pending=h.run(true);await h.gate;const saved=h.saveSlot();h.loadSlot();h.current().flags.unrelated_new_owner='preserve';h.core.save();const newOwner=h.current(),before=stable(newOwner),writeCount=h.stats().writes.length,retiredCount=h.stats().retired.length;h.release();const error=await pending;assert(error);assert.equal(error.name,'AbortError');const r=h.stats();assert.deepEqual(stable(r.state),before);assert.equal(r.writes.length,writeCount);assert.equal(r.retired.length,retiredCount);assert.strictEqual(h.current(),newOwner);assert(!r.state.flags._ev_first_practice);assert.equal(saved.schema,h.core.SCHEMA);
});
await check('new-save-LOAD-new-owner-completes-before-old-pull',async()=>{
 const h=await harness({holdAt:'pull'});const old=h.run();await h.gate;h.saveSlot();h.loadSlot();h.setHold(null);assert.equal(await h.run(),null);const before=stable(h.current()),r0=h.stats();assert.equal(earlyRecords(before).length,1);h.release();assert.equal((await old).name,'AbortError');const r=h.stats();assert.deepEqual(stable(r.state),before);assert.equal(earlyRecords(r.state).length,1);assert.equal(r.retired.length,r0.retired.length);assert.equal(r.writes.length,r0.writes.length);
 h.saveSlot();h.loadSlot();assert.equal(await h.run(),null);assert.equal(h.stats().sessions,2);assert.equal(earlyRecords(h.current()).length,1);
});
for(const [field,value]of [['day',4],['slot',0],['chapter',2],['phase','opening']])await check('same-owner-'+field+'-change-during-runner-stops-write',async()=>{
 const h=await harness({holdAt:'pull'});const old=h.run();await h.gate;h.current()[field]=value;h.core.save();const before=stable(h.current()),r0=h.stats();h.release();assert.equal((await old).name,'AbortError');const r=h.stats();assert.deepEqual(stable(r.state),before);assert.equal(r.retired.length,r0.retired.length);assert.equal(r.writes.length,r0.writes.length);assert.equal(earlyRecords(r.state).length,0);
});
await check('same-owner-progress-object-replaced-preserves-unrelated-fields',async()=>{
 const h=await harness({holdAt:'pull'});const old=h.run();await h.gate;h.current().flags._ch1_early=clone(h.current().flags._ch1_early);h.current().flags.keep='new';const before=stable(h.current()),writes=h.stats().writes.length;h.release();assert.equal((await old).name,'AbortError');assert.deepEqual(stable(h.current()),before);assert.equal(h.stats().writes.length,writes);assert.equal(h.stats().retired.length,0);
});
await check('same-owner-double-entry-shares-one-current-practice',async()=>{
 const h=await harness({holdAt:'pull'});const a=h.run();await h.gate;const b=h.run();await ticks();h.release();assert.equal(await a,null);assert.equal(await b,null);const r=h.stats();assert.equal(r.sessions,1);assert.equal(earlyRecords(r.state).length,1);assert.equal(r.entries.filter(x=>x==='remake_preparation_first_end').length,1);
});
await check('same-owner-abort-unlocks-and-restores-current-entry-stamina',async()=>{
 const h=await harness({craftMode:'abort'});assert(await h.run());assert.equal(h.current().stamina,76);h.setMode('success');assert.equal(await h.run(),null);const r=h.stats();assert.equal(r.sessions,2);assert.equal(r.state.stamina,76);assert.equal(earlyRecords(r.state).length,1);
});
await check('LOAD-before-first-microtask-does-not-start-new-owner',async()=>{
 const h=await harness();h.saveSlot();const a=h.run();h.loadSlot();const before=stable(h.current());assert.equal((await a).name,'AbortError');assert.deepEqual(stable(h.current()),before);assert.equal(h.stats().sessions,0);
});
await check('memory-storage-unwritable-still-current-lifecycle-no-second-record',async()=>{
 const h=await harness({storageWritable:false});assert.equal(await h.run(),null);assert.equal(await h.run(),null);assert.equal(h.stats().sessions,1);assert.equal(earlyRecords(h.current()).length,1);assert.equal(h.stats().writes.length,0);
});
const summary={root,total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,scope:'current-schema newGame checkpoint -> real saveToSlot/loadFromSlot in isolated memory storage -> public DAY3 + real full runner/history + optional real night plan; UI/VN/individual craft steps/bus/gallery are controlled ports. No old-save fixtures, browser, user storage, natural New Game walk-through, AUTO/SKIP or actual craft resource acceptance.',results};
if(out)fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));if(!opts.includes('--baseline'))assert.equal(summary.failed,0);
