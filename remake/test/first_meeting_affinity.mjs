// Actual state/stats/public callers; VN and presentation are controlled ports, not browser acceptance.
// node --experimental-vm-modules remake/test/affinity_stages.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = process.env.HEART1_ROOT || fileURLToPath(new URL('../js/', import.meta.url));
const sourceRoot = process.env.HIYORI_SOURCE_ROOT || root;
const supportRoot = process.env.HIYORI_SUPPORT_ROOT || root;
const realPaths = ['core/util.js','core/axe-bar-discovery.js','daily/hiyori.js','daily/spot-encounters.js','core/cinema-discovery.js','core/travel-budget.js','daily/cinema.js','core/state.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','daily/spots.js','daily/bonds.js','daily/samechan.js','daily/romance.js','daily/samechan-bonds.js'];
const scripts = ['ch1_sumi','ch1_tsumugi','ch1_minto','ch1_naru','ch1_adam','ch1_rin','ch1_bonds','samechan','hiyori','lover_events','cinema','remake_ch1','ch1_spots'];
const data = scripts.map(name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))));
const clone = value => JSON.parse(JSON.stringify(value));
async function fixture() {
  const memory = new Map(), events = [], plays = [], timers = new Map();
  let rainy = false, recruitImpl = async () => false;
  let serial = 0, playImpl = async scene => ({ id: typeof scene === 'string' ? scene : scene.dialogue_id, visited: [] });
  const db = { dialogues: Object.fromEntries(data.flatMap(d => d.dialogues || []).map(d => [d.dialogue_id,d])), hiyori: data[8], samechan: data[7], equipById: {}, flavorById: {}, characters: {} };
  const context = vm.createContext({ console, AbortController, setTimeout: fn => { timers.set(++serial,fn); return serial; }, clearTimeout: id => timers.delete(id), localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  const known = {
    on: () => () => {}, hiyoriAxeAffordable: () => false, playHiyoriAxeSequence: async () => false, playAxeBarRumor: async () => false, MAX_MONEY: 999999, TOURNAMENT_DAY: 14, DB: db, callName: String,
    emit: (type,payload) => events.push({type,payload}),
    
    play: async (...args) => { plays.push(args); return playImpl(...args); }, isPlaying: () => false,
    trpgSpot: () => ({id:'trpg',kind:'trpg'}), AXE_BAR: {id:'axe_bar',kind:'axe'}, RAIN_SPOT_TEXTS: {}, isRainy: () => rainy,
    spotFollowupDue: () => null, syncMintoKnowledge() {}, 
    maybeRecruitTrpgMember: (...args) => recruitImpl(...args), sharkSwim: async swap => swap(),
    withScenePreparation: task => task, imageReady: async () => false, toast() {}, setBg: async () => {}, sceneBg: () => ({}),
    
    openingStatus: () => ({ok:true}), refreshPlaceCue() {}, playBgm() {}, 
  };
  const modules = new Map(), required = new Map();
  for (const p of realPaths) {
    const file = path.join(sourceRoot,p);
    const source = fs.readFileSync(fs.existsSync(file) ? file : path.join(supportRoot,p),'utf8');
    modules.set(p,new vm.SourceTextModule(source,{context,identifier:p}));
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(p),match[2]));
      if (realPaths.includes(target)) continue;
      if (!required.has(target)) required.set(target,new Set());
      for (const name of match[1].split(',')) required.get(target).add(name.trim().split(/\s+as\s+/)[0]);
    }
  }
  for (const [p,names] of required) modules.set(p,new vm.SyntheticModule([...names],function() {
    for (const name of names) this.setExport(name,Object.hasOwn(known,name) ? known[name] : () => { throw Error(`Unexpected port ${p}:${name}`); });
  },{context,identifier:p}));
  const entry = new vm.SourceTextModule(realPaths.map(p=>`export * as ${p.replace(/\W/g,'_')} from './${p}';`).join('\n'),{context,identifier:'entry.js'});
  await entry.link((s,ref) => { const p=path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier),s)); assert(modules.has(p),p); return modules.get(p); });
  await entry.evaluate();
  const ns = p => modules.get(p).namespace;
  const core=ns('core/state.js'), stats=ns('core/stats.js');
  const fresh=() => { const s=core.newGame(); Object.assign(s,{phase:'daily',day:8,slot:0,seed:4}); Object.assign(s.met,{hiyori:true,naru:true,adam:true,minto:true}); Object.assign(s.flags,{_hiyori_meeting_done:true,_hiyori_sumi_message_done:true,_hiyori_message_delivered:true,_hiyori_cracks_done:true}); return s; };
  fresh();
  return { core, stats, fresh, db, plays, events, memory, stages: ns('core/affinity-stages.js'), spots: ns('daily/spots.js'), hiyori: ns('daily/hiyori.js'), util: ns('core/util.js'), bonds: ns('daily/bonds.js'), samechan: ns('daily/samechan.js'), romance: ns('daily/romance.js'), sharkBond: ns('daily/samechan-bonds.js'), setRain: value => rainy=value, setPlay: fn => playImpl=fn, setRecruit: fn => recruitImpl=fn,
    tick: () => { for (const [id,fn] of [...timers]) { timers.delete(id); fn(); } },
    roundTrip: () => { core.save(); core.newGame(); assert(core.load()); return core.state; },
  };
}

let failures=0,groups=0;
async function check(name,fn){try{await fn(await fixture());groups++;console.log(`PASS ${name}`);}catch(e){failures++;console.error(`FAIL ${name}: ${e.stack}`);}}
const done={id:'controlled-complete',visited:[]};
const first=(f,id)=>{const s=f.fresh();delete s.met[id];s.story[id]=0;s.affinity[id]=0;s.flags._cafe_introduced=true;return s;};
for(const id of ['naru','adam','minto','rin','tsumugi','sumi'])await check(`${id} first complete guarantees displayed heart1 without reading next scene`,async f=>{
 const s=first(f,id);assert.equal(f.stats.affinityLevel(id),0);
 assert.equal(await f.spots.visitChar(id),true);assert.equal(f.stats.affinityLevel(id),1);
 assert.equal(s.affinity[id],f.stats.AFFINITY_RANK_PTS[1]);assert.equal(s.story[id],1);assert.equal(s.met[id],true);
 const after=JSON.parse(JSON.stringify(s)),loaded=f.roundTrip(),copy=JSON.parse(JSON.stringify(loaded));delete after.savedAt;delete copy.savedAt;assert.deepEqual(copy,after);
 assert.equal(f.stats.affinityLevel(id),1);assert.equal(loaded.story[id],1);
});
await check('high value is not reduced; a later visit does not repeat the first-visit floor',async f=>{
 let s=first(f,'naru');s.affinity.naru=40;await f.spots.visitChar('naru');assert(s.affinity.naru>=40);assert.equal(s.story.naru,1);
 s=first(f,'naru');await f.spots.visitChar('naru');await f.spots.visitChar('naru');assert.equal(s.story.naru,2);assert.equal(s.affinity.naru,18);
 s=first(f,'naru');await f.spots.visitChar('naru');s.affinity.naru=0;s.affinityCarry.naru=0;
 // Already read first story: the new guarantee must not turn every visit into a floor.
 await f.spots.visitChar('naru');assert.equal(s.affinity.naru,4);assert.equal(s.story.naru,1); // real repeat +5 at .85, not a second floor
});
for(const outcome of ['cancel','missing','throw','abort','load'])await check(`ordinary first visit ${outcome} cannot award heart or story`,async f=>{
 const s=first(f,'naru'),controller=new AbortController();
 f.setPlay(async()=>{if(outcome==='throw')throw Error('controlled failure');if(outcome==='abort')controller.abort();if(outcome==='load')f.core.newGame();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
 const job=f.spots.visitChar('naru',{signal:controller.signal});if(outcome==='throw')await assert.rejects(job,/controlled failure/);else assert.equal(await job,false);
 assert.equal(s.affinity.naru,0);assert.equal(s.story.naru,0);assert.equal(f.core.state.affinity.naru||0,0);
});
await check('concurrent first entry rejected and first grant not committed until completion',async f=>{
 const s=first(f,'naru');let resolve;f.setPlay(()=>new Promise(r=>resolve=r));const pending=f.spots.visitChar('naru');
 assert.equal(s.affinity.naru,0);assert.equal(await f.spots.visitChar('naru'),false);resolve(done);assert.equal(await pending,true);assert.equal(s.affinity.naru,9);assert.equal(s.story.naru,1);
});
const readyMeeting=f=>{const s=f.fresh();for(const e of f.db.hiyori.route.events)delete s.flags[e.flag];s.affinity.hiyori=0;s.story.hiyori=0;return s;};
await check('Hiyori actual dedicated meeting completes once at heart1 and preserves later prerequisites',async f=>{
 const s=readyMeeting(f);assert.equal(await f.hiyori.playHiyoriEvent('meeting'),true);assert.equal(s.affinity.hiyori,9);assert.equal(f.stats.affinityLevel('hiyori'),1);
 assert.equal(s.flags._hiyori_meeting_done,true);assert.equal(s.flags._hiyori_message_delivered,undefined);
 const before=JSON.stringify(s);assert.equal(await f.hiyori.playHiyoriEvent('meeting'),false);assert.equal(JSON.stringify(s),before);
});
for(const outcome of ['cancel','missing','throw','abort','load'])await check(`Hiyori first ${outcome} remains unawarded`,async f=>{
 const s=readyMeeting(f),controller=new AbortController();f.setPlay(async()=>{if(outcome==='throw')throw Error('controlled failure');if(outcome==='abort')controller.abort();if(outcome==='load')f.core.newGame();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
 const job=f.hiyori.playHiyoriEvent('meeting',{signal:controller.signal});if(outcome==='throw')await assert.rejects(job,/controlled failure/);else assert.equal(await job,false);
 assert.equal(s.affinity.hiyori,0);assert.equal(s.flags._hiyori_meeting_done,undefined);assert.equal(f.core.state.affinity.hiyori||0,0);
});
await check('Samechan reuses existing first-encounter guarantee without another implementation',async f=>{
 const s=f.fresh();s.chapter=2;delete s.flags._samechan_first_encounter;s.affinity.samechan=0;
 assert.equal(await f.samechan.playSamechanEncounter(),true);assert.equal(f.stats.affinityLevel('samechan'),1);
 const after=JSON.stringify(s);assert.equal(await f.samechan.playSamechanEncounter(),false);assert.equal(JSON.stringify(s),after);
});
// The initial VN commit is real; only the unrelated recruitment UI is a controlled deferred port.
for (const route of ['ordinary','hiyori']) for (const interruption of ['abort','load']) {
 await check(`${route} completed first VN keeps heart floor across pending recruitment ${interruption}`,async f=>{
  const id=route==='ordinary'?'adam':'hiyori';
  const s=route==='ordinary'?first(f,id):readyMeeting(f);
  s.chapter=2;s.trpg.club.founded=true;s.trpg.club.members={};
  const controller=new AbortController();let release,entered;
  const waiting=new Promise(r=>entered=r);
  f.setRecruit(personId=>{assert.equal(personId,id);assert(s.chapter>=2 && s.phase==='daily' && s.trpg.club.founded && !s.trpg.club.members[id] && s.met[id] && !['sumi','naru'].includes(id),'actual recruitment entry prerequisites');entered();return new Promise(r=>release=r);});
  const job=route==='ordinary'?f.spots.visitChar(id,{signal:controller.signal}):f.hiyori.playHiyoriEvent('meeting',{signal:controller.signal});
  await waiting;
  // Already committed by the existing read path, independently of the visit's eventual return value.
  assert.equal(s.story[id],1);
  if(route==='hiyori')assert.equal(s.flags._hiyori_meeting_done,true);
  const pendingAffinity=s.affinity[id];
  const loaded=interruption==='load'?f.roundTrip():null;
  const before=loaded?JSON.stringify(loaded):null;
  if(interruption==='abort')controller.abort();
  release(false);assert.equal(await job,false);
  if(loaded)assert.equal(JSON.stringify(loaded),before,'old runner cannot mutate loaded owner');
  assert.equal(pendingAffinity,9,'completed first VN must commit its floor before unrelated postprocessing');
  assert.equal((loaded||s).affinity[id],9);
  assert.equal(f.stats.affinityLevel(id),1);
  f.setRecruit(async()=>false);
  f.roundTrip();assert.equal(f.core.state.affinity[id],9,'isolated save/reload retains the one-time floor');
  const committed=f.core.state;
  if(route==='hiyori'){
   assert.equal(await f.hiyori.playHiyoriEvent('meeting'),false);
   assert.equal(committed.affinity[id],9,'already committed meeting cannot award again');
  }else{
   assert.equal(await f.spots.visitChar(id),true);
   assert.equal(committed.story[id],2);assert.equal(committed.affinity[id],18,'next visit reads exactly one next scene');
  }
 });
}
for (const route of ['ordinary','hiyori']) await check(`${route} pending recruitment normal completion keeps high affinity`,async f=>{
 const id=route==='ordinary'?'adam':'hiyori',s=route==='ordinary'?first(f,id):readyMeeting(f);s.chapter=2;s.trpg.club.founded=true;s.trpg.club.members={};s.affinity[id]=40;
 let release,entered;const waiting=new Promise(r=>entered=r);
 f.setRecruit(()=>{entered();return new Promise(r=>release=r);});
 const job=route==='ordinary'?f.spots.visitChar(id):f.hiyori.playHiyoriEvent('meeting');
 await waiting;const before=s.affinity[id];assert(before>=40);release(false);assert.equal(await job,true);assert.equal(s.affinity[id],before);
});
// #2026: 第1章の後日談は、第1章で通った店主（章の切り替え時の記録）の第2章最初の来店で一度だけ。
await check('after-chapter revisit plays once on the first chapter-2 visit of a chapter-1 regular',async f=>{
 const s=f.fresh();s.chapter=2;s.story.adam=3;s.affinity.adam=20;
 f.db.dialogues.venue_adam_day={dialogue_id:'venue_adam_day',lines:[{speaker:'',text:'いらっしゃい'}]};
 assert.equal(f.spots.afterChapterVisitDue('adam'),null,'first talked in chapter 2: no chapter-1 aftermath');
 s.flags._ch1_regulars={adam:true};
 assert.equal(f.spots.afterChapterVisitDue('adam'),'ch1_adam_after_ch1');
 assert.equal(f.spots.hasNewStory('adam'),true);
 f.setPlay(async scene=>{const id=typeof scene==='string'?scene:scene.dialogue_id;if(id==='ch1_adam_after_ch1')s.flags.ch1_adam_after_ch1_done=true;return {id,visited:[]};});
 const ids=from=>f.plays.slice(from).map(args=>typeof args[0]==='string'?args[0]:args[0].dialogue_id);
 let mark=f.plays.length;
 assert.equal(await f.spots.visitChar('adam',{welcome:'venue_adam_day'}),true);
 assert.deepEqual(ids(mark),['ch1_adam_after_ch1'],'no shop greeting or story stage on the aftermath visit');
 assert.equal(s.story.adam,3);
 mark=f.plays.length;
 assert.equal(await f.spots.visitChar('adam',{welcome:'venue_adam_day'}),true);
 assert(!ids(mark).includes('ch1_adam_after_ch1'),'read once only');
 assert.equal(f.spots.afterChapterVisitDue('minto'),null,'only the recorded regulars');
 const later=f.fresh();later.chapter=3;later.flags._ch1_regulars={adam:true};
 assert.equal(f.spots.afterChapterVisitDue('adam'),null,'only in chapter 2');
});
console.log(JSON.stringify({groups,failures,scope:'actual modules with controlled VN/UI and isolated Map storage; not real browser/menu LOAD'}));
if(failures)process.exitCode=1;


