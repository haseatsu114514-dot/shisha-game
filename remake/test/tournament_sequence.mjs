// Actual chapter public devTournament, controlled game/UI ports; no browser or real SAVE.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/chapters/ch1.js',import.meta.url),'utf8');
const story=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/ch1_tournament.json',import.meta.url),'utf8')).dialogues;
const dialogues=Object.fromEntries(story.map(d=>[d.dialogue_id,d]));
async function run(failure=null){
 const trace=[],texts=[];let ended=false;
 const state={phase:'tournament',day:14,slot:0,flags:{},stats:{technique:30,insight:30,sense:30},met:{},tournament:{attempts:0}};
 const cs={holes:{score:70},heat:{score:70},steam:{score:70},pull:{score:70},mixInfo:{score:70},tournamentStory:{seen:[]}};
 function el(){return {classList:{add(){}},append(){},replaceChildren(){},remove(){}};}
 const end=new Error('review boundary completed');
 const values={state,hooks:{},DB:{dialogues},TOURNAMENT_DAY:14,CRAFT_STEPS:[],SHOP_FLAVORS:[],el,
  layers:{fx:el()},SE:new Proxy({},{get:()=>()=>{}}),
  sleep:async()=>{},smokeWipe:async mid=>mid(),newSession:()=>cs,
  runSteamDodge:async()=>trace.push('steam'),runPull:async()=>{trace.push('pull');if(failure)cs.failed=failure;},
  play:async(id)=>{trace.push(typeof id==='string'?id:id.dialogue_id);for(const l of dialogues[id]?.lines||[])if(l.text)texts.push({at:trace.length,text:l.text});return {id};},
  computeShisha:()=>({aroma:50,craftQuality:70}),showStandings:async n=>{trace.push('standings:'+n);if(n===2){ended=true;throw end;}},
  buildGameOver:()=>el(),showScreen:()=>{ended=true;},block(){},judge(){},judgeOf:x=>x,burst(){},clearComments(){}};
 const ctx=vm.createContext({console,window:{__remake:{craftTest:{auto:true}}},location:{reload(){}},setTimeout,clearTimeout});
 const mod=new vm.SourceTextModule(source,{context:ctx});
 await mod.link(async spec=>{
  const ns=spec==='../craft/broadcast.js'?['block','judge','judgeOf','burst','clearComments']:[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(x=>x.trim()));
  return new vm.SyntheticModule(ns,function(){for(const n of ns)this.setExport(n,values[n]??(async()=>{}));},{context:ctx});
 });await mod.evaluate();
 try{await mod.namespace.devTournament();}catch(e){if(e!==end)throw e;}
 assert(ended);return {trace,texts};
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
