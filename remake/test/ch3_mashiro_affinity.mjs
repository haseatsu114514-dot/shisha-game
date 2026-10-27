// Actual visit/clock/progress/stats modules; controlled VN/UI/storage boundary, not browser/real LOAD.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=JSON.parse(fs.readFileSync(path.join(root,'../data/dialogue/ch3_mashiro.json'),'utf8'));
const emptyVisits=()=>({version:1,offers:{},plans:[],closedSlots:[],chats:{}});
const fresh=()=>({chapter:3,day:5,slot:0,phase:'daily',flags:{_ch3_intro:{startDay:1,stage:8,titleSeen:true,routeVersion:2}},met:{mashiro:true},affinity:{},affinityCarry:{},lovePts:{},loveCarry:{},loveLevel:{},lovers:[],finales:{},visits:{},story:{},stats:{technique:10,sense:10,charm:10,guts:10,insight:10},statXp:{},money:4000,stamina:80,relationshipMemories:[],tokyoVisits:emptyVisits()});
async function harness() {
 const host={value:fresh(),reads:[],saves:[],mode:'normal',signal:null,backgrounds:[],events:[],play:null};
 const DB={dialogues:{},relationshipMemories:{mashiro_practice:{char_id:'mashiro'}}};
 const context=vm.createContext({console,AbortController,window:{addEventListener(){},removeEventListener(){}},setTimeout:()=>1,clearTimeout(){}});
 const synthetic=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v);},{context});
 const stateModule=synthetic({state:host.value,save:()=>host.saves.push(JSON.stringify(host.value)),emptyTokyoVisits:emptyVisits,STAT_KEYS:['technique','sense','guts','charm','insight'],STAT_JA:{}});
 const ports={
  'core/state.js':stateModule,
  'core/data.js':synthetic({DB,bgUrl:id=>id}),
  'core/util.js':synthetic({clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}),
  'core/bus.js':synthetic({emit:(...e)=>host.events.push(e)}),
  'core/ui.js':synthetic({layers:{hud:{replaceChildren(){},classList:{remove(){}}}},showScreen(){},setBg:async bg=>{host.backgrounds.push(bg);}}),
  'chapters/ch2-city-data.js':synthetic({readDialogues:async(name,ids)=>{
   assert.equal(name,'ch3_mashiro');if(host.mode==='missing')throw Error('missing script');
   const out=Object.fromEntries(script.dialogues.map(d=>[d.dialogue_id,d]));for(const id of ids)assert(out[id]?.lines?.length);return out;
  }}),
  'vn/engine.js':synthetic({play:async(dlg,opts)=>{
   host.reads.push(dlg.dialogue_id);host.signal=opts.signal;
   assert(!dlg.growth_stats);assert(!dlg.lines.some(l=>l.type==='remember'||/【技術】/.test(l.text||'')));
   if(host.play)return host.play(dlg,opts);
   if(host.mode==='throw')throw Error('VN failure');if(host.mode==='cancel')return {cancelled:true};return {};
  }}),
 };
 const mods=new Map(Object.entries(ports));
 const get=id=>{
  if(!mods.has(id))mods.set(id,new vm.SourceTextModule(fs.readFileSync(path.join(root,'js',id),'utf8'),{context,identifier:id}));return mods.get(id);
 };
 const visit=get('chapters/ch3-affinity.js');
 await visit.link((spec,from)=>get(path.posix.normalize(path.posix.join(path.posix.dirname(from.identifier),spec))));await visit.evaluate();
 const namespace=id=>mods.get(id).namespace;
 host.replace=value=>{host.value=value;stateModule.setExport('state',value);};
 return {...host,host,visit:visit.namespace,clock:namespace('core/tokyo-clock.js'),progress:namespace('chapters/ch3-progress.js'),stats:namespace('core/stats.js'),selector:namespace('core/tokyo-affinity.js')};
}
let groups=0;async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
await check('new save without gym gets real free window and first normal visit',async()=>{
 const h=await harness(),v=h.host.value,before={money:v.money,stamina:v.stamina,stage:v.flags._ch3_intro.stage};
 assert.ok(h.progress.chapterThreeFreeTime(v),'met Mashiro must open an existing free window without a gym membership');
 assert.equal(h.progress.chapterThreeFreeTime(v).id,'d5-noon');assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),true);
 assert.equal(v.flags._ch3_read_ch3_mashiro_play_1,true);assert.equal(v.affinity.mashiro,9);assert.equal(v.affinityCarry.mashiro,.5);assert.equal(v.visits.mashiro,1);assert.equal(h.host.saves.length,1);
 assert.equal(v.money,before.money);assert.equal(v.stamina,before.stamina);assert.equal(v.flags._ch3_intro.stage,before.stage);assert(v.tokyoVisits.closedSlots.includes('d5-noon'));assert.deepEqual(h.host.reads,['ch3_mashiro_play_1']);
 assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),false);
});
await check('LIME-high affinity reads oldest one only then next visit; no rewind of old history',async()=>{
 const h=await harness(),v=h.host.value;v.affinity.mashiro=66;v.visits.mashiro=8;v.flags.kept=true;
 assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),true);assert.deepEqual(h.host.reads,['ch3_mashiro_play_1']);assert(v.affinity.mashiro>=66);assert.equal(v.visits.mashiro,9);assert(v.flags.kept);assert(!v.flags._ch3_read_ch3_mashiro_play_2);
});
await check('actual LIME gain and multiple thresholds never create read flags',async()=>{
 const h=await harness(),v=h.host.value;h.stats.gainAffinity('mashiro',200,{source:'lime'});
 assert(v.affinity.mashiro>=33);for(const s of h.selector.MASHIRO_STORIES)assert(!v.flags['_ch3_read_'+s.id]);
 assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),true);assert.deepEqual(h.host.reads,['ch3_mashiro_play_1']);
});
await check('existing lovers keep ordinary points and separate bond history',async()=>{
 const h=await harness(),v=h.host.value;v.lovers=['mashiro'];v.affinity.mashiro=66;v.lovePts.mashiro=12;v.loveCarry.mashiro=.5;v.loveLevel.mashiro=2;
 assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),true);assert.equal(v.affinity.mashiro,66);assert.equal(v.lovePts.mashiro,12);assert.equal(v.loveCarry.mashiro,.5);assert.equal(v.loveLevel.mashiro,2);assert.deepEqual(v.lovers,['mashiro']);
});
for(const mode of ['cancel','throw','missing','abort','owner','day','chapter'])await check(mode+' leaves read/reward/slot/memory uncommitted',async()=>{
 const h=await harness();h.host.mode=mode;const v=h.host.value,before=JSON.stringify(v);const controller=new AbortController();
 if(['abort','owner','day','chapter'].includes(mode))h.host.play=async()=>{if(mode==='abort')controller.abort();if(mode==='owner')h.host.replace(fresh());if(mode==='day')v.day++;if(mode==='chapter')v.chapter++;return {};};
 let result;try{result=await h.visit.visitTokyoMashiro('d5-noon',{signal:controller.signal});}catch(e){assert(['missing','throw'].includes(mode));}
 assert(!result);assert.equal(h.host.saves.length,0);assert.equal(v.flags._ch3_read_ch3_mashiro_play_1,undefined);assert.deepEqual(v.affinity,{});assert.equal(v.visits.mashiro,undefined);assert.equal(v.tokyoVisits.closedSlots.length,0);assert.equal(v.relationshipMemories.length,0);
 if(!['day','chapter'].includes(mode))assert.equal(JSON.stringify(v),before);
});
await check('duplicate public entry and pre-abort cannot double-read',async()=>{
 const h=await harness();let finish,started;const ready=new Promise(r=>started=r);h.host.play=()=>{started();return new Promise(r=>finish=r);};
 const a=h.visit.visitTokyoMashiro('d5-noon');await ready;assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),false);finish({});assert.equal(await a,true);assert.equal(h.host.reads.length,1);assert.equal(h.host.saves.length,1);
 const c=new AbortController();c.abort();assert.equal(await h.visit.visitTokyoMashiro('d5-noon',{signal:c.signal}),false);
});
await check('practice night gate + older eligible order + actual paidAction growth once',async()=>{
 const h=await harness(),v=h.host.value;v.flags._ch3_intro.stage=13;v.day=9;v.slot=1;v.affinity.mashiro=13;
 v.flags._ch3_read_ch3_mashiro_play_1=true;v.flags._ch3_read_ch3_mashiro_play_2=true;
 assert.equal(h.progress.chapterThreeFreeTime(v).id,'d9-night');assert.equal(h.visit.mashiroVisitScene(v,h.progress.chapterThreeFreeTime(v)),'ch3_mashiro_practice');
 assert.equal(await h.visit.visitTokyoMashiro('d9-night'),true);assert.equal(v.flags._ch3_read_ch3_mashiro_practice,true);assert.equal(v.relationshipMemories.length,1);assert.equal(v.relationshipMemories[0],'mashiro_practice');assert.equal(v.stats.technique,11);assert.equal(v.stats.sense,11);assert.equal(h.host.saves.length,1);
 assert.equal(await h.visit.visitTokyoMashiro('d9-night'),false);
});
await check('practice cancellation defers growth/memory and does not consume window',async()=>{
 const h=await harness(),v=h.host.value;v.flags._ch3_intro.stage=13;v.day=9;v.slot=1;v.affinity.mashiro=13;v.flags._ch3_read_ch3_mashiro_play_1=true;v.flags._ch3_read_ch3_mashiro_play_2=true;h.host.mode='cancel';const before=JSON.stringify(v);
 assert.equal(await h.visit.visitTokyoMashiro('d9-night'),false);assert.equal(JSON.stringify(v),before);
});
await check('no unread uses short daily; JSON resume preserves old read flags/points',async()=>{
 const h=await harness(),v=h.host.value;for(const s of h.selector.MASHIRO_STORIES)v.flags['_ch3_read_'+s.id]=true;v.affinity.mashiro=33;v.flags.savedHistory=7;
 h.host.replace(JSON.parse(JSON.stringify(v)));assert.equal(await h.visit.visitTokyoMashiro('d5-noon'),true);assert.deepEqual(h.host.reads,['ch3_mashiro_repeat']);assert.equal(h.host.value.flags.savedHistory,7);assert(h.host.value.affinity.mashiro>33);
});
await check('reserved invite, no meeting, wrong chapter, aftermath and fixed-night preserve original availability',async()=>{
 const h=await harness(),v=h.host.value;const w=h.progress.chapterThreeFreeTime(v);assert(w);
 v.pendingInvite={day:5,slot:0,sender:'tsumugi'};assert.equal(h.visit.mashiroVisitScene(v,w),null);assert.equal(h.progress.chapterThreeFreeTime(v),null);delete v.pendingInvite;
 v.met.mashiro=false;assert.equal(h.progress.chapterThreeFreeTime(v),null);v.met.mashiro=true;v.chapter=2;assert.equal(h.selector.selectTokyoAffinityStory(v,w),null);v.chapter=3;v.flags._ch3_aftermath={stage:0};assert.equal(h.selector.selectTokyoAffinityStory(v,w),null);delete v.flags._ch3_aftermath;
 assert.equal(h.visit.mashiroVisitScene(v,{id:'d13-night',before:'tournament',day:13,slot:1}),null);
});
await check('real chapter progression can reach all four authored stories in existing windows',async()=>{
 const h=await harness(),v=h.host.value;let guard=0;
 while(guard++<40){
  const w=h.progress.chapterThreeFreeTime(v);
  if(w){assert.equal(await h.visit.visitTokyoMashiro(w.id),true);}else{const scene=h.progress.chapterThreeScenes(v)[v.flags._ch3_intro.stage];if(!scene)break;assert(h.progress.completeChapterThreeScene(v,scene.id));}
 }
 for(const s of h.selector.MASHIRO_STORIES)assert.equal(v.flags['_ch3_read_'+s.id],true,s.id);
 assert.equal(h.host.reads.filter(id=>id==='ch3_mashiro_practice').length,1);assert.equal(v.relationshipMemories.length,1);assert.equal(v.flags._ch3_intro.stage,h.progress.chapterThreeScenes(v).length);
 assert.equal(v.money,4000);assert.equal(v.stamina,80);
});
console.log(`Mashiro affinity: ${groups} controlled groups PASS; real PC/touch/AUTO/SKIP/menu LOAD untested.`);
