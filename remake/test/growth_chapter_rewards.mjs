// 実章runner・実進行・実XP計算。VN/UI/制作入力だけを制御する境界検査（通しプレイの代用ではない）。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
globalThis.document = { addEventListener() {} }; globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) };
const core = await import("../js/core/state.js"), growth = await import("../js/core/growth.js");
const p3 = await import("../js/chapters/ch3-aftermath-progress.js"), p4 = await import("../js/chapters/ch4-progress.js"), p5 = await import("../js/chapters/ch5-progress.js");
const actions = await import("../js/core/chapter-actions.js");
const stats = await import("../js/core/stats.js"), map4 = await import("../js/chapters/ch4-map-model.js");
growth.setGrowthPreview(true);
const dialogues = {};
for(const file of fs.readdirSync(new URL("../../data/dialogue/",import.meta.url)).filter(x=>x.endsWith(".json"))){
  const data=JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${file}`,import.meta.url)));
  for(const d of data.dialogues||[])dialogues[d.dialogue_id]=d;
}
const node=(tag,props={},children=[])=>Array.isArray(props)?{tag,children:props}:{tag,...props,children};
const find=(n,id)=>n?.dataset?.test===id?n:(n?.children||[]).filter(Boolean).map(x=>find(x,id)).find(Boolean);
const stateBindings=[];
const syncBindings=()=>stateBindings.forEach(m=>m.setExport("state",core.state));

async function runner(name,progress,exposed){
  let owner,screen,cancel=false,swap=false,craft,snapshots=[],replacement;
  const noop=()=>{};
  const ports={...progress,...growth,el:node,DB:{dialogues},bgUrl:x=>x,
    chapterFourMapModel:map4.chapterFourMapModel,canReflect:()=>false,paidAction:stats.paidAction,
    chapterDay:()=>core.state.day,chapterGrowthNight:async()=>true,createChapterActions:opts=>actions.createChapterActions(opts),
    layers:{hud:{replaceChildren:noop,classList:{remove:noop}}},showScreen:(_id,n)=>{screen=n;},
    setBg:async()=>{},playBgm:noop,toast:noop,hooks:{},
    save:()=>{snapshots.push(JSON.parse(JSON.stringify(core.state)));owner.active=false;},
    play:async()=>{if(swap){core.newGame();syncBindings();replacement=JSON.stringify(core.state);}return {id:"fixture",visited:[],cancelled:cancel};},
    newSession:()=>craft,openBench:noop,waitBenchReady:async()=>{},CRAFT_STEPS:[],
    stepSetup:noop,stepWater:noop,stepMix:noop,stepPack:noop,runHoles:noop,stepPlace:noop,runHeat:noop,
    stepSteamTime:noop,runSteamDodge:noop,runPull:async()=>true,
    runCare:async cs=>{cs.careHistory.push({score:100});},finalize:noop,
    naruTastingCategory:()=>"steady",craftReviewLines:()=>[],servedEvaluationLines:()=>[],
  };
  const context=vm.createContext({AbortController,console});
  let source=fs.readFileSync(new URL(`../js/chapters/${name}.js`,import.meta.url),"utf8");
  source+=`\nexport function testOwner(o){session=o;}\nexport {${exposed.join(",")}};`;
  const module=new vm.SourceTextModule(source,{context});
  await module.link(async spec=>{
    const matches=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)];
    const names=matches.filter(m=>m[2]===spec).flatMap(m=>m[1].split(",").map(x=>x.trim()));
    const stub=new vm.SyntheticModule(names,function(){
      for(const key of names)this.setExport(key,key==="state"?core.state:ports[key]);
    },{context});
    if(names.includes("state"))stateBindings.push(stub);
    return stub;
  });
  await module.evaluate();
  return {module:module.namespace,
    use(value,options={}){
      core.setState(value);syncBindings();
      growth.ensureGrowth();owner={state:core.state,active:true};module.namespace.testOwner(owner);
      cancel=!!options.cancel;swap=!!options.swap;craft=options.craft;snapshots=[];replacement=null;return owner;
    },get screen(){return screen;},get saves(){return snapshots;},get owner(){return owner;},get replacement(){return replacement;}};
}
function fresh(chapter){const s=core.newState();s.chapter=chapter;s.growth=growth.newGrowth();
  s.growth.chapterLog[chapter]={people:["sumi","minto","minto"],places:["one","two","two"]};return s;}
function beforeThreeClear(){
  const s=fresh(3);Object.assign(s,{day:42,phase:"tournament",slot:0});
  Object.assign(s.flags,{_ch3_tournament_won:true,_ch3_tournament:{stage:"complete",result:{rank:1,win:true}}});
  p3.beginChapterThreeAftermath(s);
  for(const scene of p3.CH3_AFTERMATH_SCENES.slice(0,-1))p3.completeChapterThreeAftermathScene(s,scene.id);
  return s;
}
function beforeFourClear(){
  const s=fresh(3);s.phase="cleared";s.flags._ch3_cleared=true;p4.advanceToChapterFour(s);
  s.growth.chapterLog[4]={people:["sumi","minto","minto"],places:["one","two","two"]};
  for(const scene of p4.CH4_PROLOGUE)p4.completeChapterFourScene(s,scene.id);
  p4.completeChapterFourScene(s,"ch4_stranger_first");
  for(let i=0;i<4;i++)p4.endChapterFourDay(s);
  for(const id of ["ch4_stranger_second","ch4_wang_reception_forced_in","ch4_wang_reception","ch4_stranger_third"])p4.completeChapterFourScene(s,id);
  p4.finishChapterFourEve(s);p4.completeChapterFourScene(s,"ch4_tournament_start");
  s.flags._ch4.match={result:{win:true}};p4.completeChapterFourScene(s,"ch4_final");
  for(const scene of p4.CH4_RESOLUTION.slice(0,-1))p4.completeChapterFourScene(s,scene.id);
  return s;
}
function beforeFiveFree(){
  const s=fresh(4);s.phase="cleared";s.flags._ch4_cleared=true;p5.advanceToChapterFive(s);
  s.growth.chapterLog[5]={people:["sumi","minto","minto"],places:["one","two","two"]};
  for(const scene of p5.CH5_PROLOGUE)p5.completeChapterFiveScene(s,scene.id);
  return s;
}
function beforeFiveCup(){
  const s=beforeFiveFree();
  p5.completeChapterFiveScene(s,"ch5_unrecorded_day");p5.recordChapterFiveScheduleDecision(s,"decide");
  p5.completeChapterFiveScene(s,"ch5_schedule_contact");p5.beginChapterFiveMatch(s);
  for(const key of ["arrival","firstCup","beforeSecond"])p5.completeChapterFiveScene(s,p5.CH5_MATCH_SCENES[key]);
  return s;
}
function beforeFiveClear(){
  const s=beforeFiveCup();p5.recordChapterFiveSecondCup(s,{total:100,category:"steady"});
  for(const key of ["win","afterglow"])p5.completeChapterFiveScene(s,p5.CH5_MATCH_SCENES[key]);
  for(const scene of p5.CH5_AFTERMATH)p5.completeChapterFiveScene(s,scene.id);
  p5.beginChapterFiveFinale(s,["ending_start","ending_normal","ending_daily_smoke"]);
  p5.completeChapterFiveScene(s,"ending_start");p5.completeChapterFiveScene(s,"ending_normal");return s;
}

core.newGame();
const r3=await runner("ch3-aftermath",p3,["renderStage"]);
const r4=await runner("ch4",p4,["readAndCommit","visit"]);
const r5=await runner("ch5",p5,["readAndCommit","craftSecondCup"]);
for(const [chapter,r,seed,id] of [[3,r3,beforeThreeClear,"ch3_ageha_reunion"],
  [4,r4,beforeFourClear,p4.CH4_RESOLUTION.at(-1).id],[5,r5,beforeFiveClear,"ending_daily_smoke"]]){
  const invoke=async()=>{
    if(chapter!==3)return r.module.readAndCommit(r.owner,id);
    await r.module.renderStage(r.owner);return find(r.screen,"ch3-aftermath-continue").onclick();
  };
  for(const enabled of [false,true]){
    growth.setGrowthPreview(enabled);r.use(seed());const stats=JSON.stringify(core.state.stats);
    await invoke();assert.equal(core.state.flags[`_ch${chapter}_cleared`],true);
    assert.equal(core.state.growth.cleared.includes(chapter),enabled);
    if(enabled){
      assert.equal(core.state.growth.today.learned.chapter_clear,Math.round(150*growth.CHAPTER_MULT[chapter]));
      assert.equal(core.state.growth.today.learned.chapter_breadth,Math.round(80*growth.CHAPTER_MULT[chapter]));
      assert.equal(r.saves[0].growth.xp,core.state.growth.xp,"XP must be in the same checkpoint save");
      const checkpoint=JSON.stringify(core.state.growth);assert.equal(growth.awardChapterClearExp(),0);
      assert.equal(JSON.stringify(core.state.growth),checkpoint,"reload/redraw cannot stack a clear reward");
    }
    assert.equal(JSON.stringify(core.state.stats),stats,"legacy abilities must be preserved");
  }
  growth.setGrowthPreview(true);r.use(seed(),{cancel:true});const before=JSON.stringify(core.state);
  await invoke();assert.equal(JSON.stringify(core.state),before);assert.equal(r.saves.length,0);
  r.use(seed(),{swap:true});await invoke();assert(r.replacement);
  assert.equal(JSON.stringify(core.state),r.replacement,"LOAD completion must not award another save");assert.equal(r.saves.length,0);
}
const abortedCraft={mode:"tournament",chapter:5,total:100,pullDone:true,careHistory:[],heat:{score:100},steam:{score:90},holes:{score:80},stats:{craftQuality:70}};
r5.use(beforeFiveCup(),{craft:abortedCraft,swap:true});await r5.module.craftSecondCup(r5.owner);
assert(r5.replacement);assert.equal(JSON.stringify(core.state),r5.replacement);assert.equal(r5.saves.length,0);

for(const [total,failed,expectedBase] of [[100,false,200],[20,false,120],[76,false,120],[100,true,120]]){
  const craft={mode:"tournament",chapter:5,total,failed,pullDone:!failed,careHistory:[],
    heat:{score:100},steam:{score:90},holes:{score:80},stats:{craftQuality:70}};
  r5.use(beforeFiveCup(),{craft});await r5.module.craftSecondCup(r5.owner);
  if(total===76)assert.equal(p5.chapterFiveMatchOutcome(core.state),"tie","existing tied votes must stay tied");
  assert.equal(core.state.growth.tournamentXp[5].entered,true);
  assert.equal(core.state.growth.tournamentXp[5].rankBase,expectedBase);
  assert.equal(core.state.growth.xp,(100+expectedBase)*2);
  assert.equal(!!core.state.growth.tournamentXp[5].gifted,!failed);
  assert.equal(r5.saves[0].growth.xp,core.state.growth.xp);
  const before=JSON.stringify(core.state.growth);growth.awardTournamentExp(expectedBase===200?1:2,craft);
  assert.equal(JSON.stringify(core.state.growth),before,"tournament retry cannot repeat XP or colored fire");
}
// 既存のスーク行動はX1が一回、場所の初回X3と固有場面X5。日・体力を新設しない。
{
  const s=fresh(3);s.phase="cleared";s.flags._ch3_cleared=true;p4.advanceToChapterFour(s);
  for(const scene of p4.CH4_PROLOGUE)p4.completeChapterFourScene(s,scene.id);
  const day=s.day,stamina=s.stamina;r4.use(s);await r4.module.visit(r4.owner,"souq");
  assert.equal(core.state.growth.xp,158);assert.equal(core.state.growth.fresh.counts["dubai:souq"],1);
  assert(core.state.growth.read.includes("ch4_dubai_souq"));assert(core.state.growth.firsts.places.includes("dubai:souq"));
  assert.equal(core.state.day,day);assert.equal(core.state.stamina,stamina);
}
// 第5章の既存の任意の会話は完読分だけ。無料の再表示を一行動に数えない。
{
  const s=beforeFiveFree(),id=p5.CH5_FREE_SCENES[0].id;r5.use(s);
  assert.equal(await r5.module.readAndCommit(r5.owner,id),true);
  assert.equal(core.state.growth.xp,40);assert.deepEqual(core.state.growth.fresh.counts,{});
  assert(core.state.growth.read.includes(id));
}
console.log("PASS: actual chapter 3/4/5 runner commit boundaries save clear/breadth XP once; cancellation/off preserve old stats; chapter 5 real outcome records participation/rank/fire once; optional and spot XP preserve existing action/time contracts (controlled VN/UI/craft input)");

// 章の時計を読む共通境界。旧セーブ初表示・再表示・巻戻しでは夜を作らない。
{
  const value={day:10}, owner={}, calls=[];let current=true,replace=false;
  const context=vm.createContext({});
  const source=fs.readFileSync(new URL("../js/core/chapter-growth.js",import.meta.url),"utf8");
  const module=new vm.SourceTextModule(source,{context});
  await module.link(spec=>new vm.SyntheticModule(spec.endsWith("state.js")?["state"]:["presentNight"],function(){
    if(spec.endsWith("state.js"))this.setExport("state",value);
    else this.setExport("presentNight",async options=>{calls.push(options);if(replace)current=false;});
  },{context}));await module.evaluate();
  const run=options=>module.namespace.chapterGrowthNight(owner,()=>current,options);
  assert.equal(await run(),true);assert.equal(calls.length,0);
  value.day=11;assert.equal(await run(),true);assert.equal(calls.length,1);
  await run();assert.equal(calls.length,1);
  value.day=14;await run({evePlace:"tokyo_shrine"});assert.equal(calls.length,2);
  assert.equal(calls[1].evePlace,"tokyo_shrine");
  value.day=9;await run();assert.equal(calls.length,2);
  value.day=10;replace=true;assert.equal(await run(),false);assert.equal(calls.length,3);
  const stamp=owner.growthDay;value.day=12;assert.equal(await run(),false);assert.equal(owner.growthDay,stamp);
}
console.log("PASS: chapter night boundary detects real date advance once, preserves reload/redraw and stops after owner replacement");
