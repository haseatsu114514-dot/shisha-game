import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = path => fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const story = JSON.parse(await fs.readFile(new URL('../../data/dialogue/samechan.json',import.meta.url),'utf8'));
const lime = JSON.parse(await fs.readFile(new URL('../../data/lime_messages.json',import.meta.url),'utf8'));
const manifest = JSON.parse(await read('data/manifest.json'));
const state = {chapter:1,day:8,phase:'daily',slot:2,flags:{},contacts:[],met:{},story:{},limeRead:[]};
const played=[], rewards=[];
const context=vm.createContext({AbortController,setTimeout,clearTimeout,Promise,Set,
  fetch:async path=>({ok:true,json:async()=>{
    if(path==='data/manifest.json')return manifest;
    if(path.endsWith('/dialogue/samechan.json'))return story;
    if(path.endsWith('/characters.json'))return [{id:'hajime',display_name:'はじめ'}];
    if(path.endsWith('/relationship_memories.json'))return {memories:[]};
    if(path.endsWith('/flavors.json'))return {flavors:[]};
    if(path.endsWith('/equipment.json'))return {equipment:[]};
    if(path.endsWith('/baito_events.json'))return {events:[]};
    if(path.endsWith('/glossary.json'))return {groups:[]};
    if(path.endsWith('/lime_messages.json'))return lime;
    return {dialogues:[]};
  }})});
const dataModule=new vm.SourceTextModule(await read('js/core/data.js'),{context});
await dataModule.link(spec=>{assert.equal(spec,'./fortune-effects.js','unexpected data import');return new vm.SyntheticModule(['registerFortuneReadings'],function(){this.setExport('registerFortuneReadings',()=>{});},{context});});await dataModule.evaluate();
const data=dataModule.namespace;await data.loadAll();
assert.equal(data.DB.samechan.spot.label,'SHISHARK');assert.equal(data.DB.characters.samechan.id,'samechan');
const firstShop = story.dialogues.find(d=>d.dialogue_id==='samechan_shop_first');
for (const [name, lines] of Object.entries(firstShop.branches)) {
  const texts = lines.map(line=>line.text || '');
  const order = texts.findIndex(text=>text.includes('すっとする香りをお願いします'));
  const serving = texts.findIndex(text=>text.includes('一台を運んできた'));
  assert(order>=0 && serving>order,`${name}: 初回来店で注文の後に一台を飲む`);
  const farewell = texts.findIndex(text=>text.includes('一服を終えて'));
  if (farewell>=0) assert(farewell>serving,`${name}: 一服を終えた描写は提供後`);
}
assert.deepEqual(JSON.parse(JSON.stringify(data.DB.lime)),lime.messages);assert(data.DB.dialogues.samechan_first_encounter);
assert.equal(data.displayName('samechan',state),'？？？');
for(const face of ['normal','smile','surprise','serious'])assert.equal(data.portraitInfo('samechan',face).src,`img/sprites/characters/samechan/chr_samechan_${face}.webp`);
assert.equal(data.sceneBg('bg_shishark_preparing_night','night').tint,null);
assert.equal(data.sceneBg('bg_shishark_preparing_night','night').url,'img/backgrounds/bg_shishark_preparing_night.webp');
assert.equal(data.sceneBg('bg_shishark','night').tint,'night');

let saves=0;
const deps={
 '../core/data.js':data,
 '../core/state.js':{state,save:()=>saves++,markMet:id=>state.met[id]=true,timeOfDay:()=> 'night'},
 '../core/ui.js':{withScenePreparation: task => task, imageReady:async()=>false,toast:()=>{},setBg:async()=>{}},
 '../core/travel-budget.js':{spendableMoney:s=>s.money||0},
 '../core/scene-motions.js':{sharkSwim:async swap=>{await swap();}},
 '../core/stats.js':{gainAffinity:(...args)=>rewards.push(args),affinityLevel:()=>0,releaseAffinity:()=>0,ensureAffinityLevel:()=>{},earnStat:()=>{},addMoney:()=>{},addStamina:()=>{},STAMINA_LOW:25},
 '../vn/engine.js':{play:async id=>{played.push(id);return {id,visited:[]};},isPlaying:()=>false},
 './bonds.js':{finaleAtVisit:()=>false,playFinale:async()=>false},
 './trpg.js':{maybeRecruitTrpgMember:async()=>false},
};
const samechanModule=new vm.SourceTextModule(await read('js/daily/samechan.js'),{context});
const modulePorts = new Map();
await samechanModule.link(async spec=>{
 if(modulePorts.has(spec))return modulePorts.get(spec);
 let mod;
 if(spec==='../core/cinema-discovery.js'||spec==='./cinema.js')mod=new vm.SourceTextModule(await read(spec==='./cinema.js'?'js/daily/cinema.js':'js/core/cinema-discovery.js'),{context});
 else {const d=deps[spec];assert(d,spec);mod=new vm.SyntheticModule(Object.keys(d),function(){for(const[k,v]of Object.entries(d))this.setExport(k,v);},{context});}
 modulePorts.set(spec,mod);return mod;
});await samechanModule.evaluate();
const k=samechanModule.namespace;
assert.equal(k.samechanSpot(),null);
state.day=7;assert.equal(k.samechanEncounterDue(),false);state.day=8;
for(const flag of ['hasNightEvent','hasAppointment','hadConfession','athome'])assert.equal(k.samechanEncounterDue({[flag]:true}),false,flag);
state.flags._private_night_day=8;assert.equal(k.samechanEncounterDue(),false);delete state.flags._private_night_day;
state.chapter=2;assert.equal(k.samechanEncounterDue(),false,'do not play construction scene after opening');state.chapter=1;
assert.equal(k.samechanEncounterDue(),true);
await k.maybeSamechanEncounter();assert.deepEqual(played,['samechan_first_encounter']);
// 場所によらず、本人が登場した時にテーマを鳴らす。
for(const scene of story.dialogues){assert.equal(scene.metadata?.bgm,'sweets_or_sweets',scene.dialogue_id);assert.equal(scene.metadata?.bgm_on_speaker,'samechan');}
assert(manifest.bgm.includes('sweets_or_sweets.mp3'));assert.equal(saves,1);
assert(state.contacts.includes('samechan'));assert(state.met.samechan);assert.equal(data.displayName('samechan',state),'サメちゃん');
assert.equal(await k.maybeSamechanEncounter(),false);assert.equal(played.length,1);assert.equal(rewards.length,1);
assert.equal(k.samechanSpot(),null,'第1章では準備中のピンも出さない');
assert.equal(await k.visitSamechan(null),false);
state.limeRead.push(k.SAMECHAN_NICKNAME_TOPIC);k.syncSamechanKnowledge();assert.equal(data.displayName('samechan',state),'サメちゃん');assert(state.met.samechan);
state.chapter=2;k.syncSamechanKnowledge();const open=k.samechanSpot();assert.equal(open.unavailable,undefined);assert.equal(open.preview,'bg_shishark');assert.equal(state.flags._shishark_opened,true);
const contacts=state.contacts;state.contacts=[];delete state.flags._lime_contact_samechan;assert(k.samechanSpot(),'章2では未交換でも店が開く');state.contacts=contacts;
await k.visitSamechan(open);assert.equal(played.at(-1),'samechan_shop_first');assert.equal(state.story.samechan,1);
state.day++;
await k.visitSamechan(open);assert.equal(played.at(-1),'samechan_shop_repeat_0');
// 路地裏シネマを観た後の来店で、感想を一度だけ聞く（#1718）。
state.day++;state.spotVisits={...(state.spotVisits||{}),rojiura_cinema:1};assert.equal(k.samechanVisitDialogue(),'samechan_shop_cinema_impression');
await k.visitSamechan(open);assert.equal(played.at(-1),'samechan_shop_cinema_impression');assert.equal(state.flags._samechan_cinema_impression_done,true);
assert.notEqual(k.samechanVisitDialogue(),'samechan_shop_cinema_impression','感想は一度だけ');
// 体力が少ない日の来店で一度だけ、本人の声で叱る（#1718）。
const staminaBefore=state.stamina;state.day++;state.stamina=10;assert.equal(k.samechanVisitDialogue(),'samechan_shop_unwell');
await k.visitSamechan(open);assert.equal(played.at(-1),'samechan_shop_unwell');assert.equal(state.flags._samechan_unwell_done,true);
state.stamina=10;assert.notEqual(k.samechanVisitDialogue(),'samechan_shop_unwell','不調の場面は一度だけ');state.stamina=staminaBefore;
state.flags._samechan_name_known=true;assert.equal(data.displayName('samechan',state),'波多野なぎさ');
// 表示名は台詞の正本を参照し、名乗る前に本名を漏らさない。
const encounter=story.dialogues.find(d=>d.dialogue_id==='samechan_first_encounter');
const aliasAt=encounter.lines.findIndex(l=>l.text==='強いていうなら、サメちゃんと呼ばれておる');
assert(aliasAt>=0);assert.equal(encounter.lines[aliasAt+1].flag,'_samechan_nickname_known');
assert(!JSON.stringify(encounter).includes(story.profile.full_name));
assert(!encounter.lines.some(l=>l.flag==='_samechan_name_known'));
const privateName=story.dialogues.find(d=>d.dialogue_id==='samechan_future_private_name');
assert.equal(privateName.metadata.future_only,false,'本名は恋人絆Lv4の正式原稿へ接続済み');
assert.equal(privateName.metadata.private_scene,true);
for(const scene of story.dialogues){
 const rows=[...scene.lines,...Object.values(scene.branches||{}).flat()];
 for(const row of rows)if(row.voice==='korochan')assert(!/じゃ|のう|おる/.test(row.text),`${scene.dialogue_id}: コロちゃんに本人の語尾が混ざった`);
 for(const row of rows){if(row.speaker==='samechan')assert(manifest.portraits.samechan.faces.includes(row.face));
  if(row.type==='choice')for(const choice of row.choices)assert(scene.branches[choice.next]);}
}
assert(story.dialogues[0].lines.some(l=>l.text==='お主、サメは好きか？'));
assert(data.DB.lime.find(m=>m.id==='lime_samechan_preparing_thanks').chapter===1);
assert(data.DB.lime.find(m=>m.id==='lime_samechan_opening').chapter===2);
assert.equal(story.profile.romance_available,true);
console.log('[SHISHARK] live data load / 4 portraits / construction tint / one-time quiet-night encounter / name knowledge / chapter boundary / visit branches: PASS');
