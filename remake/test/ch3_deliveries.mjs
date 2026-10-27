// Production public delivery coordinator with controlled read/save/owner ports. Not browser acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({console});
const mod=new vm.SourceTextModule(fs.readFileSync(new URL('../js/chapters/ch3-deliveries.js',import.meta.url),'utf8'),{context});
await mod.link(()=>{throw Error('Delivery coordinator must not import economy or advance time');});await mod.evaluate();
const {runMukaiDeliveryWork:run,MUKAI_DELIVERY_STEPS:steps}=mod.namespace;
const fresh=()=>({chapter:3,day:17,slot:0,phase:'daily',flags:{_ch3_intro:{stage:2,routeVersion:2}},met:{mukai_master:true},money:9000,stamina:75,affinity:{},visits:{},story:{}});
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name);}
await check('normal completion commits three identities and no voluntary/economy/time state',async()=>{
 const value=fresh(),called=[],saved=[];
 const before=JSON.parse(JSON.stringify(value));
 assert.equal(await run(value,{read:async s=>{called.push(s.id);return true;},save:()=>saved.push(JSON.stringify(value)),isCurrent:()=>true}),true);
 assert.deepEqual(called,Array.from(steps,s=>s.id));assert.equal(saved.length,6);
 for(const id of ['kuze','steve','volk']){assert.equal(value.met[id],true);assert.equal(value.flags['_met_'+id],true);assert.equal(value.flags['_ch3_delivery_'+id],true);}
 for(const key of ['day','slot','phase','money','stamina','affinity','visits','story'])assert.deepEqual(value[key],before[key]);
 assert.deepEqual(value.flags._ch3_intro,before.flags._ch3_intro);
 assert(!value.flags._ch3_kuze_first);assert(!value.flags._ch3_rules_read);
 assert.equal(await run(value,{read:async()=>{throw Error('Completed delivery cannot replay');},save:()=>{throw Error('Cannot save twice');},isCurrent:()=>true}),true);
});
for(const failure of ['cancel','missing','throw','abort','owner','day'])await check(`${failure} cannot complete current introduction; completed earlier stops retained`,async()=>{
 const value=fresh(),controller=new AbortController();let current=true,saves=0;
 const read=async step=>{
  if(step.person!=='steve')return true;
  // Emulate VN first-appearance state written before the reader stops.
  value.met.steve=true;value.flags._met_steve=true;value.flags._intro_steve=true;
  if(failure==='throw')throw Error('controlled read failure');
  if(failure==='abort')controller.abort();if(failure==='owner')current=false;if(failure==='day')value.day++;
  return failure==='cancel'?false:failure==='missing'?undefined:true;
 };
 const task=run(value,{read,save:()=>saves++,isCurrent:()=>current,signal:controller.signal});
 if(failure==='throw')await assert.rejects(task,/controlled read failure/);else assert.equal(await task,false);
 assert.equal(value.met.steve,undefined);assert.equal(value.flags._met_steve,undefined);assert.equal(value.flags._intro_steve,undefined);
 assert.equal(value.flags._ch3_delivery_steve,undefined);assert.equal(value.flags._ch3_delivery_return,undefined);
 assert(value.flags._ch3_delivery_kuze);assert.equal(saves,3);assert.equal(value.money,9000);
 if(failure!=='owner'&&failure!=='day'){
  assert.equal(await run(value,{read:async()=>true,save:()=>saves++,isCurrent:()=>true}),true);
  assert.equal(saves,6,'Resume only unfinished steps');
 }
});
await check('existing identities and old history survive cancellation; no unearned completion',async()=>{
 const value=fresh();value.met.kuze=true;value.flags._met_kuze=true;value.flags._intro_kuze=true;value.flags._ch3_delivery_offer=true;value.flags._ch3_mukai_work_intro_read=true;
 value.visits.kuze=4;value.story.kuze=2;
 assert.equal(await run(value,{read:async()=>false,save:()=>{throw Error('Cannot save cancelled read');},isCurrent:()=>true}),false);
 assert(value.met.kuze&&value.flags._met_kuze&&value.flags._intro_kuze);assert.equal(value.visits.kuze,4);assert.equal(value.story.kuze,2);assert.equal(value.flags._ch3_delivery_kuze,undefined);
});
await check('duplicate click and pre-aborted/wrong-stage entry do not read or save twice',async()=>{
 const value=fresh();let resolve,reads=0;
 const task=run(value,{read:()=>{reads++;return new Promise(r=>resolve=r);},save(){},isCurrent:()=>true});
 assert.equal(await run(value,{read:async()=>{throw Error('Duplicate read');},save(){},isCurrent:()=>true}),false);
 resolve(false);assert.equal(await task,false);assert.equal(reads,1);
 const c=new AbortController();c.abort();assert.equal(await run(value,{signal:c.signal,read:async()=>{throw Error('aborted');},save(){},isCurrent:()=>true}),false);
 value.flags._ch3_intro.stage=3;assert.equal(await run(value,{read:async()=>{throw Error('wrong stage');},save(){},isCurrent:()=>true}),false);
});
await check('isolated JSON reload resumes only remaining delivery; later customer scene flags untouched',async()=>{
 let value=fresh();const log=[];
 assert.equal(await run(value,{read:async s=>{log.push(s.id);return s.person!=='steve';},save(){},isCurrent:()=>true}),false);
 value=JSON.parse(JSON.stringify(value));const resumed=[];
 assert.equal(await run(value,{read:async s=>{resumed.push(s.id);return true;},save(){},isCurrent:()=>true}),true);
 assert.deepEqual(resumed,['ch3_delivery_steve','ch3_delivery_volk','ch3_delivery_return']);
 assert.equal(value.flags._ch3_kuze_first,undefined);assert.equal(value.flags._ch3_kuze_advice,undefined);
});
await check('actual script branches keep delivery and later customer introductions separate',async()=>{
 const load=name=>JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`,import.meta.url),'utf8'));
 const expand=(scene,game,lines=scene.lines)=>lines.flatMap(line=>{
  if(line.type!=='condition')return [line];
  const ok=line.condition_type==='met'?!!game.met[line.char_id]:!!game.flags[line.flag];
  return expand(scene,game,scene.branches?.[ok?line.next_true:line.next_false]||[]);
 });
 const deliveries=load('ch3_deliveries');
 for(const who of ['kuze','steve','volk']){
  const scene=deliveries.dialogues.find(s=>s.dialogue_id==='ch3_delivery_'+who);
  const first=expand(scene,{met:{},flags:{}}),known=expand(scene,{met:{[who]:true},flags:{}});
  assert.notDeepEqual(first,known);
  for(const line of [...first,...known])assert(!['set_flag','affinity','money','stats'].includes(line.type),'Delivery text cannot commit identity or rewards');
  assert(!JSON.stringify([...first,...known]).includes('チョコレート'));
 }
 const volk=load('ch3_volk').dialogues.find(s=>s.dialogue_id==='ch3_volk_first');
 const known=expand(volk,{met:{volk:true},flags:{_ch3_delivery_volk:true}}).map(l=>l.text||'').join('\n');
 assert(!known.includes('初めて見る顔'));assert(!known.includes('名前を聞いても'));
 assert(known.includes('ナイトサイド')&&known.includes('凛'),'Approved parent characterization retained after delivery');
 const kuze=load('ch3_rivals').dialogues.find(s=>s.dialogue_id==='ch3_kuze_first');
 assert(expand(kuze,{met:{kuze:true},flags:{_ch3_delivery_kuze:true}})[0].text.includes('配達で会った'));
});
console.log(`Mukai delivery: ${count} controlled groups PASS; real AUTO/SKIP/LOAD not run`);
