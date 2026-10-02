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
 '../core/state.js':{state,save:()=>saves++,markMet:id=>state.met[id]=true},
 '../core/stats.js':{gainAffinity:(...args)=>rewards.push(args),gainStat:()=>{},addMoney:()=>{},addStamina:()=>{}},
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
await k.maybeKafukaEncounter();assert.deepEqual(played,['kafuka_first_encounter']);assert.equal(saves,1);
assert(state.contacts.includes('kafuka'));assert.equal(state.met.kafuka,undefined);assert.equal(data.displayName('kafuka',state),'？？？');
assert.equal(await k.maybeKafukaEncounter(),false);assert.equal(played.length,1);assert.equal(rewards.length,1);
const prep=k.kafukaSpot();assert.equal(prep.label,'SHISHARK');assert.equal(prep.kind,'kafuka');assert.equal(prep.unavailable,'開店準備中');assert.equal(prep.cost,0);assert.equal(prep.stamina,0);assert.equal(prep.preview,'bg_shishark_preparing_night');
assert.equal(await k.visitKafuka(prep),false);
state.limeRead.push(k.KAFUKA_NICKNAME_TOPIC);k.syncKafukaKnowledge();assert.equal(data.displayName('kafuka',state),'サメちゃん');assert(state.met.kafuka);
state.chapter=2;k.syncKafukaKnowledge();const open=k.kafukaSpot();assert.equal(open.unavailable,undefined);assert.equal(open.preview,'bg_shishark');assert.equal(state.flags._shishark_opened,true);
await k.visitKafuka(open);assert.equal(played.at(-1),'kafuka_shop_first');assert.equal(state.story.kafuka,1);
await k.visitKafuka(open);assert.equal(played.at(-1),'kafuka_shop_repeat_0');
state.flags._kafuka_name_known=true;assert.equal(data.displayName('kafuka',state),'波多野かふか');
for(const scene of story.dialogues){
 const rows=[...scene.lines,...Object.values(scene.branches||{}).flat()];
 for(const row of rows){if(row.speaker==='kafuka')assert(manifest.portraits.kafuka.faces.includes(row.face));
  if(row.type==='choice')for(const choice of row.choices)assert(scene.branches[choice.next]);}
}
assert(story.dialogues[0].lines.some(l=>l.text==='お主、サメは好きか？'));
assert(story.lime.find(m=>m.id==='lime_kafuka_preparing_thanks').chapter===1);
assert(story.lime.find(m=>m.id==='lime_kafuka_opening').chapter===2);
assert.equal(story.profile.romance_available,false);
console.log('[SHISHARK] live data load / 4 portraits / construction tint / one-time quiet-night encounter / name knowledge / chapter boundary / visit branches: PASS');
