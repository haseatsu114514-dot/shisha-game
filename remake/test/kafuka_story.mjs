import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = path => fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const story = JSON.parse(await fs.readFile(new URL('../../data/dialogue/kafuka.json',import.meta.url),'utf8'));
const manifest = JSON.parse(await read('data/manifest.json'));
const state = {chapter:1,day:8,phase:'daily',slot:2,flags:{},contacts:[],met:{},story:{},limeRead:[]};
const played=[], rewards=[];
const context=vm.createContext({AbortController,setTimeout,clearTimeout,Promise,Set,
  fetch:async path=>({ok:true,json:async()=>{
    if(path==='data/manifest.json')return manifest;
    if(path.endsWith('/dialogue/kafuka.json'))return story;
    if(path.endsWith('/characters.json'))return [{id:'hajime',display_name:'はじめ'}];
    if(path.endsWith('/relationship_memories.json'))return {memories:[]};
    if(path.endsWith('/flavors.json'))return {flavors:[]};
    if(path.endsWith('/equipment.json'))return {equipment:[]};
    if(path.endsWith('/baito_events.json'))return {events:[]};
    if(path.endsWith('/glossary.json'))return {groups:[]};
    if(path.endsWith('/lime_messages.json'))return {messages:[]};
    return {dialogues:[]};
  }})});
const dataModule=new vm.SourceTextModule(await read('js/core/data.js'),{context});
await dataModule.link(()=>{throw new Error('unexpected data import');});await dataModule.evaluate();
const data=dataModule.namespace;await data.loadAll();
assert.equal(data.DB.kafuka.spot.label,'SHISHARK');assert.equal(data.DB.characters.kafuka.id,'kafuka');
assert.equal(data.DB.lime.length,3);assert(data.DB.dialogues.kafuka_first_encounter);
assert.equal(data.displayName('kafuka',state),'？？？');
for(const face of ['normal','smile','surprise','serious'])assert.equal(data.portraitInfo('kafuka',face).src,`img/sprites/characters/kafuka/chr_kafuka_${face}.webp`);
assert.equal(data.sceneBg('bg_shishark_preparing_night','night').tint,null);
assert.equal(data.sceneBg('bg_shishark_preparing_night','night').url,'img/backgrounds/bg_shishark_preparing_night.webp');
assert.equal(data.sceneBg('bg_shishark','night').tint,'night');

let saves=0;
const deps={
 '../core/data.js':data,
 '../core/state.js':{state,save:()=>saves++,markMet:id=>state.met[id]=true,timeOfDay:()=> 'night'},
 '../core/ui.js':{setBg:async()=>{}},
 '../core/scene-motions.js':{sharkSwim:async swap=>{await swap();}},
 '../core/stats.js':{gainAffinity:(...args)=>rewards.push(args),earnStat:()=>{},addMoney:()=>{},addStamina:()=>{}},
 '../vn/engine.js':{play:async id=>played.push(id)},
};
const kafukaModule=new vm.SourceTextModule(await read('js/daily/kafuka.js'),{context});
await kafukaModule.link(spec=>{const d=deps[spec];assert(d);return new vm.SyntheticModule(Object.keys(d),function(){for(const[k,v]of Object.entries(d))this.setExport(k,v);},{context});});await kafukaModule.evaluate();
const k=kafukaModule.namespace;
assert.equal(k.kafukaSpot(),null);
state.day=7;assert.equal(k.kafukaEncounterDue(),false);state.day=8;
for(const flag of ['hasNightEvent','hasAppointment','hadConfession','athome'])assert.equal(k.kafukaEncounterDue({[flag]:true}),false,flag);
state.flags._private_night_day=8;assert.equal(k.kafukaEncounterDue(),false);delete state.flags._private_night_day;
state.chapter=2;assert.equal(k.kafukaEncounterDue(),false,'do not play construction scene after opening');state.chapter=1;
assert.equal(k.kafukaEncounterDue(),true);
await k.maybeKafukaEncounter();assert.deepEqual(played,['kafuka_first_encounter']);
// 場所によらず、本人が登場した時にテーマを鳴らす。
for(const scene of story.dialogues){assert.equal(scene.metadata?.bgm,'sweets_or_sweets',scene.dialogue_id);assert.equal(scene.metadata?.bgm_on_speaker,'kafuka');}
assert(manifest.bgm.includes('sweets_or_sweets.mp3'));assert.equal(saves,1);
assert(state.contacts.includes('kafuka'));assert(state.met.kafuka);assert.equal(data.displayName('kafuka',state),'サメちゃん');
assert.equal(await k.maybeKafukaEncounter(),false);assert.equal(played.length,1);assert.equal(rewards.length,1);
assert.equal(k.kafukaSpot(),null,'第1章では準備中のピンも出さない');
assert.equal(await k.visitKafuka(null),false);
state.limeRead.push(k.KAFUKA_NICKNAME_TOPIC);k.syncKafukaKnowledge();assert.equal(data.displayName('kafuka',state),'サメちゃん');assert(state.met.kafuka);
state.chapter=2;k.syncKafukaKnowledge();const open=k.kafukaSpot();assert.equal(open.unavailable,undefined);assert.equal(open.preview,'bg_shishark');assert.equal(state.flags._shishark_opened,true);
const contacts=state.contacts;state.contacts=[];delete state.flags._lime_contact_kafuka;assert(k.kafukaSpot(),'章2では未交換でも店が開く');state.contacts=contacts;
await k.visitKafuka(open);assert.equal(played.at(-1),'kafuka_shop_first');assert.equal(state.story.kafuka,1);
await k.visitKafuka(open);assert.equal(played.at(-1),'kafuka_shop_repeat_0');
state.flags._kafuka_name_known=true;assert.equal(data.displayName('kafuka',state),'波多野なぎさ');
// 表示名は台詞の正本を参照し、名乗る前に本名を漏らさない。
const encounter=story.dialogues.find(d=>d.dialogue_id==='kafuka_first_encounter');
const aliasAt=encounter.lines.findIndex(l=>l.text==='強いていうなら、サメちゃんと呼ばれておる');
assert(aliasAt>=0);assert.equal(encounter.lines[aliasAt+1].flag,'_kafuka_nickname_known');
assert(!JSON.stringify(encounter).includes(story.profile.full_name));
assert(!encounter.lines.some(l=>l.flag==='_kafuka_name_known'));
const privateName=story.dialogues.find(d=>d.dialogue_id==='kafuka_future_private_name');
assert.equal(privateName.metadata.future_only,true);
assert.equal(privateName.metadata.private_scene,true);
for(const scene of story.dialogues){
 const rows=[...scene.lines,...Object.values(scene.branches||{}).flat()];
 for(const row of rows)if(row.voice==='korochan')assert(!/じゃ|のう|おる/.test(row.text),`${scene.dialogue_id}: コロちゃんに本人の語尾が混ざった`);
 for(const row of rows){if(row.speaker==='kafuka')assert(manifest.portraits.kafuka.faces.includes(row.face));
  if(row.type==='choice')for(const choice of row.choices)assert(scene.branches[choice.next]);}
}
assert(story.dialogues[0].lines.some(l=>l.text==='お主、サメは好きか？'));
assert(story.lime.find(m=>m.id==='lime_kafuka_preparing_thanks').chapter===1);
assert(story.lime.find(m=>m.id==='lime_kafuka_opening').chapter===2);
assert.equal(story.profile.romance_available,false);
console.log('[SHISHARK] live data load / 4 portraits / construction tint / one-time quiet-night encounter / name knowledge / chapter boundary / visit branches: PASS');
