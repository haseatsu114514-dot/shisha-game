// Actual chapter public devTournament, controlled game/UI ports; no browser or real SAVE.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/chapters/ch1.js',import.meta.url),'utf8');
const story=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch1_tournament.json',import.meta.url),'utf8')).dialogues;
const dialogues=Object.fromEntries(story.map(d=>[d.dialogue_id,d]));
async function run(failure=null,{pullMode="success",insight=30}={}){
 const trace=[],texts=[];let ended=false,resolvePull,enterPull,error=null;
 const atPull=new Promise(r=>enterPull=r),rejected=new Error("controlled pull rejection");
 const state={phase:'tournament',day:14,slot:0,flags:{},stats:{technique:30,insight,sense:30},met:{},tournament:{attempts:0}};
 const cs={holes:{score:70},heat:{score:70},steam:{score:70},pull:{score:70},mixInfo:{score:70},tournamentStory:{seen:[]}};
 function el(){return {classList:{add(){}},append(){},replaceChildren(){},remove(){}};}
 const end=new Error('review boundary completed');
 const values={state,hooks:{},DB:{dialogues},TOURNAMENT_DAY:14,CRAFT_STEPS:[],SHOP_FLAVORS:[],el,
  layers:{fx:el()},SE:new Proxy({},{get:()=>()=>{}}),
  sleep:async()=>{},smokeWipe:async mid=>mid(),newSession:()=>cs,servedEvaluationLines:()=>[],
  runSteamDodge:async()=>trace.push('steam'),runPull:async()=>{trace.push('pull');enterPull();if(pullMode==='false')return false;if(pullMode==='reject')throw rejected;
   if(pullMode==='deferred')await new Promise(r=>resolvePull=r);if(failure)cs.failed=failure;trace.push('pull:completed');return true;},
  play:async(id)=>{const dlg=typeof id==='string'?dialogues[id]:id;trace.push(typeof id==='string'?id:id.dialogue_id);for(const l of dlg?.lines||[])if(l.text)texts.push({at:trace.length,text:l.text});return {id};},
  computeShisha:()=>({aroma:50,craftQuality:70}),showStandings:async n=>{trace.push('standings:'+n);if(n===2){ended=true;throw end;}},
  buildGameOver:()=>el(),showScreen:()=>{ended=true;},block(){},judge(){},judgeOf:x=>x,burst(){},clearComments(){}};
 const ctx=vm.createContext({console,window:{__remake:{craftTest:{auto:true}}},location:{reload(){}},setTimeout,clearTimeout});
 const mod=new vm.SourceTextModule(source,{context:ctx});
 await mod.link(async spec=>{
  const ns=spec==='../craft/broadcast.js'?['block','judge','judgeOf','burst','clearComments']:[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(x=>x.trim()));
  return new vm.SyntheticModule(ns,function(){for(const n of ns)this.setExport(n,values[n]??(async()=>{}));},{context:ctx});
 });await mod.evaluate();
 const task=mod.namespace.devTournament();
 if(pullMode==='deferred'){
  await atPull;await Promise.resolve();assert(!trace.includes('ch1_tournament_served'),'must await actual pull completion');
  resolvePull(true);resolvePull(false);
 }
 try{await task;}catch(e){if(e!==end){if(pullMode!=='reject')throw e;assert.equal(e,rejected);error=e.message;}}
 if(['false','reject'].includes(pullMode))assert(!ended,'aborted/rejected pull must not reach standings or failure screen');else assert(ended);
 return {trace,texts,error};
}
const success=await run();const failure=await run('burnt');
const completion=/各選手、完成|4台のシーシャが、審査員の前に並んだ/;
const early=success.texts.filter(x=>completion.test(x.text)&&x.at<success.trace.indexOf('pull')+1);
const failedCompletion=failure.texts.filter(x=>completion.test(x.text));
const result={mode:!process.argv.includes('--baseline')?'regression':'baseline',success:success.trace,failure:failure.trace,early_completion:early,failed_completion:failedCompletion,scope:'Real chapter module public devTournament. Gameplay/UI/VN/time/save ports controlled; real browser AUTO/SKIP/LOAD not tested.'};
console.log(JSON.stringify(result,null,2));
if(!process.argv.includes('--baseline')){
 assert.equal(early.length,0,'completion must not precede actual runPull');assert.equal(failedCompletion.length,0,'failure must not claim completion');
 assert.equal(success.trace.filter(x=>x==='ch1_tournament_served').length,1);assert(success.trace.indexOf('pull')<success.trace.indexOf('ch1_tournament_served'));
 assert(success.trace.indexOf('ch1_tournament_served')<success.trace.indexOf('ch1_tournament_r2_end'));
 const retry=await run();assert.equal(retry.trace.filter(x=>x==='ch1_tournament_served').length,1,'a fresh successful retry completes once');
 assert(!JSON.stringify(dialogues.ch1_tournament_match).match(/パッキングに入ります|炭をコンロに乗せる|炭を置く。蒸らす/));
}else{assert.equal(early.length,2);assert.equal(failedCompletion.length,2);}

// Exact false means screen detachment / draw abandonment in the real runPull contract.
for(const pullMode of ['false','reject','deferred']){
 const boundary=await run(null,{pullMode});
 if(pullMode==='deferred'){
  assert.equal(boundary.trace.filter(x=>x==='ch1_tournament_served').length,1,'double resolve completes once');
  assert(boundary.trace.indexOf('pull:completed')<boundary.trace.indexOf('ch1_tournament_served'));
  assert(boundary.trace.indexOf('ch1_tournament_served')<boundary.trace.indexOf('ch1_tournament_r2_end'));
 }else{
  assert.equal(boundary.texts.filter(x=>completion.test(x.text)).length,0,'aborted/rejected pull must not claim completion');
  assert(!boundary.trace.includes('ch1_tournament_served'));assert(!boundary.trace.includes('ch1_tournament_r2_end'));
  assert.equal(boundary.error,pullMode==='reject'?'controlled pull rejection':null);
 }
 console.log(JSON.stringify({boundary:pullMode,trace:boundary.trace,error:boundary.error}));
}
for(const insight of [0,30]){
 const fresh=await run(null,{insight});assert.equal(fresh.trace.filter(x=>x==='ch1_tournament_served').length,1);
 console.log(JSON.stringify({fresh_success_insight:insight,served:1,scope:'caller only; VN branch content is separately byte-preserved'}));
}

// #2035: the real chapter-3 tournament buttons keep their session/error contract.
{
 const chapterSource=fs.readFileSync(new URL('../js/chapters/ch3-tournament.js',import.meta.url),'utf8');
 const helperSource=fs.readFileSync(new URL('../js/core/chapter-actions.js',import.meta.url),'utf8');
 const errors=[],screens=[];const chapterState={chapter:3};
 const node=(selector,attrs={},children=[])=>({selector,...(Array.isArray(attrs)?{children:attrs}:{...attrs,children})});
 const context=vm.createContext({console:{error:(...args)=>errors.push(args)}});
 const runner=new vm.SourceTextModule(chapterSource+`\nexport {button,perform}; export function owner(){return session={state,active:true,busy:false};}`,{context});
 let stateModule;
 await runner.link(async spec=>{
  if(spec==='../core/chapter-actions.js'){
   const helper=new vm.SourceTextModule(helperSource,{context});
   await helper.link(()=>new vm.SyntheticModule(['el'],function(){this.setExport('el',node);},{context}));return helper;
  }
  const names=spec==='../craft/broadcast.js'?['block','judge','judgeOf','burst','clearComments']:
   [...chapterSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(s=>s.trim()));
  const values={state:chapterState,el:node,layers:{hud:{replaceChildren(){},classList:{toggle(){}}}},showScreen:(name,root)=>screens.push({name,root})};
  const stub=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,values[n]??(()=>{}));},{context});
  if(spec==='../core/state.js')stateModule=stub;return stub;
 });await runner.evaluate();const api=runner.namespace;
 let owner=api.owner(),calls=0,release;
 const wait=new Promise(resolve=>release=resolve);
 const button=api.button(owner,'続ける','next',()=>{calls++;return wait;});
 assert.equal(button.selector,'button.btn');assert.equal(button.type,'button');assert.equal(button.text,'続ける');assert.equal(button.dataset.test,'ch3-tournament-next');
 assert.equal(api.button(owner,'進む','go',()=>{},true).selector,'button.btn.primary');
 const pending=button.onclick();assert.equal(owner.busy,true);await button.onclick();assert.equal(calls,1,'repeated clicks run once');
 release();await pending;assert.equal(owner.busy,false);await api.perform(owner,()=>calls++);assert.equal(calls,2);
 api.owner();await button.onclick();assert.equal(calls,2,'stale session is ignored');
 owner=api.owner();owner.active=false;await api.perform(owner,()=>calls++);assert.equal(calls,2,'inactive session is ignored');
 owner=api.owner();stateModule.setExport('state',{});await api.perform(owner,()=>calls++);assert.equal(calls,2,'LOAD invalidates the owner');stateModule.setExport('state',chapterState);
 for(const asyncError of [false,true]){
  owner=api.owner();const error=new Error('controlled chapter 3 action failure');
  await api.perform(owner,()=>{if(asyncError)return Promise.reject(error);throw error;});
  assert.equal(owner.busy,false);assert.equal(errors.at(-1)[0],'[ch3 tournament]');assert.equal(errors.at(-1)[1],error);
  assert.equal(screens.at(-1).name,'ch3-tournament');assert.equal(screens.at(-1).root.dataset.test,'ch3-tournament-error');
 }
 const before=errors.length;owner=api.owner();await api.perform(owner,()=>{api.owner();throw new Error('stale failure');});
 assert.equal(errors.length,before,'stale errors do not replace newer screens');assert.equal(owner.busy,false);
 owner=api.owner();let finish;const later=new Promise(resolve=>finish=resolve);const running=api.perform(owner,()=>later);api.owner();finish();await running;
 assert.equal(owner.busy,false,'busy resets on an old owner without mutating the newer session');
 console.log('chapter-3 tournament actions: session, repeated input and error recovery PASS');
}
