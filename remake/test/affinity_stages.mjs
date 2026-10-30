// Actual state/stats/public callers; VN and presentation are controlled ports, not browser acceptance.
// node --experimental-vm-modules remake/test/affinity_stages.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../js/', import.meta.url));
const sourceRoot = process.env.AFFINITY_SOURCE_ROOT || root;
const realPaths = ['core/cinema-discovery.js','core/travel-budget.js','daily/cinema.js','core/state.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','daily/spots.js','daily/bonds.js','daily/phone.js','daily/invitations.js','core/chapter-clock.js','daily/samechan.js','daily/romance.js','daily/samechan-bonds.js'];
const scripts = ['ch1_sumi','ch1_tsumugi','ch1_minto','ch1_naru','ch1_adam','ch1_rin','ch1_bonds','samechan','hiyori','lover_events','confession','cinema'];
const data = scripts.map(name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))));
const clone = value => JSON.parse(JSON.stringify(value));
async function fixture() {
  const memory = new Map(), events = [], plays = [], timers = new Map();
  let serial = 0, playImpl = async scene => ({ id: typeof scene === 'string' ? scene : scene.dialogue_id, visited: [] });
  const db = { dialogues: Object.fromEntries(data.flatMap(d => d.dialogues || []).map(d => [d.dialogue_id,d])), hiyori: data[8], equipById: {}, flavorById: {}, characters: {}, lime: JSON.parse(fs.readFileSync(new URL('../../data/lime_messages.json', import.meta.url))).messages };
  const context = vm.createContext({ console, AbortController, setTimeout: fn => { timers.set(++serial,fn); return serial; }, clearTimeout: id => timers.delete(id), localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  const known = {
    MAX_MONEY: 999999, TOURNAMENT_DAY: 14, DB: db, callName: String,
    emit: (type,payload) => events.push({type,payload}),
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)),
    play: async (...args) => { plays.push(args); return playImpl(...args); }, isPlaying: () => false,
    AXE_BAR: {id:'axe_bar'}, RAIN_SPOT_TEXTS: {}, isRainy: () => false,
    spotFollowupDue: () => null, syncMintoKnowledge() {}, meetHiyoriAtTonari: async () => false,
    maybeRecruitTrpgMember: async () => false, sharkSwim: async swap => swap(),
    withScenePreparation: task => task, imageReady: async () => false, toast() {}, setBg: async () => {}, sceneBg: () => ({}),
    hiyoriFirstMeetingReady: () => true,
    tsumugiMessages: () => [], hooks: {}, giftOpen: async () => {},
    openingStatus: () => ({ok:true}), refreshPlaceCue() {}, playBgm() {}, hiyoriShopEncounterDue: () => false,
  };
  const modules = new Map(), required = new Map();
  for (const p of realPaths) {
    const source = fs.readFileSync(path.join(sourceRoot,p),'utf8');
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
  const fresh=() => { const s=core.newGame(); Object.assign(s,{phase:'daily',day:8,slot:1}); return s; };
  fresh();
  return { core, stats, fresh, db, plays, events, memory, stages: ns('core/affinity-stages.js'), spots: ns('daily/spots.js'), bonds: ns('daily/bonds.js'), phone: ns('daily/phone.js'), samechan: ns('daily/samechan.js'), romance: ns('daily/romance.js'), sharkBond: ns('daily/samechan-bonds.js'), setPlay: fn => playImpl=fn,
    tick: () => { for (const [id,fn] of [...timers]) { timers.delete(id); fn(); } },
    roundTrip: () => { core.save(); core.newGame(); assert(core.load()); return core.state; },
  };
}
let count=0;
async function check(name,run) {
  if (process.env.AFFINITY_CASE && !new RegExp(process.env.AFFINITY_CASE).test(name)) return;
  try { await run(await fixture()); count++; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode=1; }
}
const done = { id:'port-scene',visited:[] };
const close = (a,b) => assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
await check('five social shop routes: ordinary gains are independent of every unread stage', async f => {
  for (const [id,seq] of Object.entries(f.spots.VISIT_SEQ).filter(([id]) => id !== "sumi")) for (let stage=0;stage<seq.length;stage++) {
    const s=f.fresh(); s.story[id]=stage;
    const start=f.stats.AFFINITY_RANK_PTS[stage];s.affinity[id]=start;
    assert.equal(f.stats.gainAffinity(id,100),85);
    assert.equal(s.affinity[id],start+85,`${id}:${stage}`);
    assert.equal(f.stats.affinityPointCap(id),Infinity);
    assert.equal(s.story[id],stage,'Numeric gain cannot read a story');
    assert.equal(f.stats.releaseAffinity(id),0,'New gains create no deferred ordinary credit');
    assert.equal(s.flags[`_${id}_affinity_waiting_pts`]||0,0);
  }
});
await check('Sumi lessons remain outside social heart caps', async f => {
  const s=f.fresh(); s.affinity.sumi=0;
  assert.equal(f.stages.pendingAffinityStage(s,'sumi'),null);
  assert.equal(f.stats.gainAffinity('sumi',100),85);
  assert.equal(s.affinity.sumi,85);
});
await check('PR970 saved story bank migrates and releases once', async f => {
  const s=f.fresh(); s.story.naru=6; s.affinity.naru=10;
  s.flags._naru_story_waiting_pts=17;
  assert.equal(f.stats.releaseStoryAffinity('naru'),17);
  assert.equal(s.affinity.naru,27);
  assert.equal(s.flags._naru_story_waiting_pts,undefined);
  assert.equal(f.stats.releaseStoryAffinity('naru'),0);
});
await check('legacy rescue history cannot consume independent PR970 pending earnings', async f => {
  const s=f.fresh(); s.story.naru=6; s.affinity.naru=33;
  s.flags._naru_affinity_waiting_pts=5; s.flags._naru_affinity_released_pts=15;
  s.flags._naru_story_waiting_pts=17;
  assert.equal(f.stats.releaseStoryAffinity('naru'),17);
  assert.equal(s.affinity.naru,50);
  assert.equal(s.flags._naru_affinity_released_pts,15);
  assert.equal(f.stats.releaseStoryAffinity('naru'),0);
});
for (const outcome of ['cancel','missing','throw','abort','load']) await check(`visitChar public caller: ${outcome} cannot complete/reward`, async f => {
  const s=f.core.state; s.affinity.naru=0;
  const controller=new AbortController();
  f.setPlay(async () => {
    if (outcome==='throw') throw Error('expected read failure');
    if (outcome==='load') f.core.newGame();
    if (outcome==='abort') controller.abort();
    return outcome==='missing' ? undefined : outcome==='cancel' ? {cancelled:true} : done;
  });
  const pending=f.spots.visitChar('naru',{signal:controller.signal});
  if(outcome==='throw') await assert.rejects(pending,/expected read failure/); else assert.equal(await pending,false);
  assert.equal(s.story.naru||0,0); assert.equal(s.affinity.naru||0,0); assert.equal(s.visits.naru||0,0);
  if(outcome==='load') assert.equal(f.core.state.affinity.naru||0,0);
});
await check('visitChar normal completion, same-owner concurrent entry and heart unlock', async f => {
  const s=f.core.state; let resolve;
  f.setPlay(() => new Promise(r=>resolve=r));
  const pending=f.spots.visitChar('naru'); assert.equal(await f.spots.visitChar('naru'),false);
  assert.equal(s.story.naru||0,0); resolve(done); assert.equal(await pending,true);
  assert.equal(s.story.naru,1); assert.equal(s.visits.naru,1); assert.equal(s.affinity.naru,9);
  assert.equal(f.stats.affinityLevel('naru'),1); assert.equal(f.spots.hasNewStory('naru'),true);
  f.setPlay(async()=>done); await f.spots.visitChar('naru'); // next visit reads only the newly eligible second scene
  assert.equal(s.story.naru,2); assert.equal(s.affinity.naru,18); assert.equal(f.stats.affinityLevel('naru'),1); assert.equal(f.spots.hasNewStory('naru'),false);
});
await check('question selected then cancelled: retain answer, resume reaction and complete once', async f => {
  const s=f.core.state; s.story.rin=3; s.affinity.rin=33;
  f.stats.gainAffinity('rin',40);
  f.setPlay(async () => { f.bonds.recordRomanceChoice({id:'bond_q1_rin',romance_char:'rin'},{romance:0}); return {cancelled:true}; });
  assert.equal(await f.bonds.playQuestionVisit('rin'),false); assert.equal(f.stats.affinityGateWaiting('rin'),true);
  assert.equal(s.flags[f.stages.questionDoneKey('rin')],undefined); assert.equal(s.romanceChoices.bond_q1_rin.value,0);
  f.roundTrip(); f.setPlay(async scene => { assert(!scene.lines.some(l=>l.type==='choice'&&l.id==='bond_q1_rin')); return done; });
  assert.equal(await f.bonds.playQuestionVisit('rin'),true); assert.equal(f.stats.affinityGateWaiting('rin'),false);
  const after=clone(f.core.state); assert.equal(await f.bonds.playQuestionVisit('rin'),false);
  assert.deepEqual(clone(f.core.state),after); assert.equal(f.core.state.romance.rin||0,0);
});
for (const outcome of ['missing','abort','load','throw']) await check(`question public caller ${outcome} does not commit`, async f => {
  const s=f.core.state; s.story.rin=3;s.affinity.rin=33; const controller=new AbortController();
  f.setPlay(async()=> { if(outcome==='throw')throw Error('expected'); if(outcome==='load')f.core.newGame(); if(outcome==='abort')controller.abort(); return outcome==='missing'?undefined:done; });
  const p=f.bonds.playQuestionVisit('rin',{signal:controller.signal});
  if(outcome==='throw')await assert.rejects(p,/expected/); else assert.equal(await p,false);
  assert.equal(s.flags[f.stages.questionDoneKey('rin')],undefined);
});
await check('Rin third story completes at heart2; question becomes due only at heart3',async f=>{
  const s=f.core.state;s.story.rin=2;s.affinity.rin=20;
  f.setPlay(async()=>done);assert.equal(await f.spots.visitChar('rin'),true);
  assert.equal(s.story.rin,3);assert.equal(s.affinity.rin,28);assert.equal(f.bonds.questionVisitDue('rin'),false);
  f.stats.gainAffinity('rin',6);assert.equal(s.affinity.rin,33);assert.equal(f.bonds.questionVisitDue('rin'),true);
});
await check('legacy current/carry/history stay intact; deferred ordinary credit releases once without reading stages across SAVE/LOAD', async f => {
  let s=f.core.state;s.affinity.tsumugi=66;s.affinityCarry.tsumugi=.7;
  s.flags._tsumugi_affinity_waiting_pts=34;s.flags._tsumugi_affinity_waiting_released=true;s.flags._tsumugi_affinity_released_pts=15;
  assert.equal(f.stats.releaseAffinity('tsumugi'),19);assert.equal(s.affinity.tsumugi,85);
  assert.equal(s.story.tsumugi||0,0);assert.equal(s.flags[f.stages.questionDoneKey('tsumugi')],undefined);
  assert.equal(s.flags._tsumugi_affinity_waiting_pts,34);assert.equal(s.flags._tsumugi_affinity_released_pts,15);
  assert.equal(s.flags._tsumugi_affinity_stage_released_pts,19);close(s.affinityCarry.tsumugi,.7);
  s=f.roundTrip();assert.equal(f.stats.releaseAffinity('tsumugi'),0);assert.equal(s.affinity.tsumugi,85);
  close(s.affinityCarry.tsumugi,.7);assert.equal(s.story.tsumugi||0,0);
});
await check('LIME .25/carry crosses unread hearts; old credit releases once without consuming fortune', async f => {
  const s=f.core.state;s.story.naru=0;s.affinity.naru=8;
  for(let i=0;i<5;i++) f.stats.gainAffinity('naru',1,{source:'lime'});
  close(s.affinityCarry.naru,.0625);assert.equal(s.affinity.naru,9);assert.equal(s.flags._naru_affinity_waiting_pts||0,0);
  f.tick();assert.equal(f.events.filter(e=>e.type==='affinity-gain').length,1);
  s.flags._naru_affinity_waiting_pts=1;s.fortune={char:'naru'};
  assert.equal(f.stats.releaseAffinity('naru'),1);assert(s.fortune);assert.equal(f.stats.releaseAffinity('naru'),0);
  f.stats.gainAffinity('naru',2,{source:'lime'});assert.equal(s.fortune,undefined);assert.equal(s.affinity.naru,10);
  close(s.affinityCarry.naru,.7);assert.equal(s.story.naru,0);
});
await check('LIME reply feedback follows actual fractional progress without ordinary story caps, SAVE/LOAD and integer rollover', async f => {
  let s = f.core.state; s.story.naru = 1; s.affinity.naru = 9;
  const deltas = [], opts = { source: 'lime', onGain: delta => deltas.push(delta) };
  for (let i=0;i<5;i++) { f.stats.gainAffinity('naru',1,opts); s=f.roundTrip(); }
  assert.equal(deltas.length,5); deltas.forEach(delta=>close(delta,.2125));
  assert.equal(s.affinity.naru,10); close(s.affinityCarry.naru,.0625);
  f.tick(); assert.equal(f.events.filter(e=>e.type==='affinity-gain').length,0,'reply feedback must not also show a heart card');
  s.affinity.naru=19;
  f.stats.gainAffinity('naru',2,opts); assert.equal(deltas.length,6);close(deltas.at(-1),.425);assert.equal(s.story.naru,1);
  s.affinity.naru=18; s.affinityCarry.naru=.9;
  f.stats.gainAffinity('naru',1,opts); close(deltas.at(-1),.2125); assert.equal(s.affinity.naru,19);close(s.affinityCarry.naru,.1125);
  const n=deltas.length; f.stats.gainAffinity('naru',0,opts); assert.equal(deltas.length,n);
  // Existing private bond formula is separate from ordinary LIME's quarter scale.
  s.lovers=['tsumugi']; s.lovePts.tsumugi=9; s.loveLevel.tsumugi=1;
  f.stats.bond.private=true; f.stats.gainAffinity('tsumugi',3,opts); f.stats.bond.private=false;
  close(deltas.at(-1),1.5); assert.equal(s.lovePts.tsumugi,10); close(s.loveCarry.tsumugi,.5);
});
await check('samechan introduction: cancellation cannot grant846; normal read gives exactly heart1', async f => {
  const s=f.core.state;f.setPlay(async()=>({cancelled:true}));assert.equal(await f.samechan.playSamechanEncounter(),false);
  assert(!s.flags._samechan_first_encounter);assert.equal(f.stats.affinityLevel('samechan'),0);
  f.setPlay(async()=>done);assert.equal(await f.samechan.playSamechanEncounter(),true);assert.equal(f.stats.affinityLevel('samechan'),1);
  const pts=s.affinity.samechan;assert.equal(await f.samechan.playSamechanEncounter(),false);assert.equal(s.affinity.samechan,pts);
});
await check('samechan shop cancellation keeps receipt unpaid/unread, retry completes once', async f => {
  const s=f.core.state;s.chapter=2;s.flags._samechan_first_encounter=true;s.affinity.samechan=9;
  const spot={id:'shishark',cost:3000,stamina:-10};const money=s.money;
  f.setPlay(async()=>({cancelled:true}));assert.equal(await f.samechan.visitSamechan(spot),false);
  assert.equal(s.money,money);assert.equal(s.story.samechan||0,0);assert.equal(s.flags._samechan_visit.complete,false);
  f.setPlay(async()=>done);assert.equal(await f.samechan.visitSamechan(spot),true);assert.equal(s.money,money-3000);
  assert.equal(await f.samechan.visitSamechan(spot),true);assert.equal(s.money,money-3000);assert.equal(s.story.samechan,1);
});
await check('hiyori numeric growth is independent while connected route/question prerequisites remain', async f => {
  const s=f.core.state;const route=f.db.hiyori.route;
  for(const e of route.events) if(e.id!=='axe_reveal'&&e.id!=='work_talk')s.flags[e.flag]=true;
  s.affinity.hiyori=33;assert.equal(f.stats.affinityPointCap('hiyori'),Infinity);
  assert.equal(f.stages.pendingAffinityStage(s,'hiyori',f.db).level,3);
  delete s.flags._hiyori_tonari_return_done;assert.equal(f.stats.affinityPointCap('hiyori'),Infinity);
  assert(f.stats.affinityGateWaiting('hiyori'));assert.equal(f.bonds.hiyoriQuestionReady(),false);
  f.stats.gainAffinity('hiyori',100);assert.equal(s.affinity.hiyori,118);assert(!s.flags._hiyori_tonari_return_done);assert(!s.flags._hiyori_work_talk_done);
  s.flags._hiyori_tonari_return_done=true;s.flags._hiyori_real_self_known=true;s.flags._hiyori_work_talk_done=true;
  assert.equal(f.stats.affinityPointCap('hiyori'),Infinity);
  s.flags._hiyori_bond_question_done=true;assert.equal(f.stats.affinityPointCap('hiyori'),Infinity);
});
await check('chapter2 actual flags: chat/followup/ageha three visits are independent completion evidence', async f => {
  for(const id of ['ageha','kumicho','rei']) {
    const s=f.fresh();assert.equal(f.stats.affinityPointCap(id),Infinity);
    s.flags._ch2_talks={[id]:1};assert.equal(f.stats.affinityPointCap(id),Infinity);
    s.flags._ch2_followup_done={[id]:true};
    assert.equal(f.stats.affinityPointCap(id),Infinity);
    if(id==='ageha')for(const [i,key]of ['gyaru','newcomer','magazine'].entries()){
      s.flags[`_ch2_read_remake_ch2_ageha_${key}`]=true;
      assert.equal(f.stats.affinityPointCap(id),Infinity);
    }
  }
});
for(const id of ['tsumugi','samechan']) for(const outcome of ['cancel','missing','load','abort','throw']) await check(`${id} lover public milestone ${outcome} stays unread/unrewarded`,async f=>{
  const s=f.core.state;s.chapter=2;s.lovers=[id];s.loveLevel[id]=1;s.lovePts[id]=9;const controller=new AbortController();
  f.setPlay(async()=>{if(outcome==='throw')throw Error('expected');if(outcome==='load')f.core.newGame();if(outcome==='abort')controller.abort();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
  const p=f.romance.playLoverMilestone(id,{signal:controller.signal});
  if(outcome==='throw')await assert.rejects(p,/expected/);else assert.equal(await p,false);
  assert.equal(s.loverEventsSeen.length,0);assert.equal(s.lovePts[id],9);assert.equal(f.stats.bond.private,false);
});
await check('lover points wait for both connected scripts; private scale/carry and normal hearts remain separate', async f => {
  const s=f.core.state;s.chapter=2;s.lovers=['tsumugi'];s.loveLevel.tsumugi=1;s.lovePts.tsumugi=9;
  f.db.dialogues.lover_tsumugi_lv1_b={dialogue_id:'lover_tsumugi_lv1_b',lines:[{speaker:'',text:'port'}]};
  f.stats.gainAffinity('tsumugi',100);assert.equal(s.lovePts.tsumugi,9);
  f.stats.bond.private=true;f.stats.gainAffinity('tsumugi',100);f.stats.bond.private=false;
  assert.equal(s.lovePts.tsumugi,19);assert.equal(s.loveLevel.tsumugi,1);assert.equal(s.flags._tsumugi_love_waiting_pts,40);
  f.setPlay(async()=>done);assert.equal(await f.romance.playLoverMilestone('tsumugi'),true);
  assert.equal(s.lovePts.tsumugi,19);assert.equal(f.romance.loverMilestoneDue('tsumugi'),'lover_tsumugi_lv1_b');
  assert.equal(await f.romance.playLoverMilestone('tsumugi'),true);assert.equal(s.lovePts.tsumugi,32);assert.equal(s.loveLevel.tsumugi,2);
  assert.equal(f.stats.affinityLevel('tsumugi'),5);assert.equal(s.affinity.tsumugi||0,0);
  f.roundTrip();assert.equal(f.stats.releaseLoveAffinity('tsumugi'),0);assert.equal(f.core.state.lovePts.tsumugi,32);
});
await check('all romanceable casts: unread lover stage holds next level; normal completion releases to that next stage', async f => {
  for (const id of new Set([...f.stats.ROMANCEABLE.filter(id=>id!=="hiyori"),"mashiro"])) for (let level=1;level<5;level++) {
    const s=f.fresh();s.chapter=5;s.lovers=[id];s.loveLevel[id]=level;s.lovePts[id]=f.stats.AFFINITY_RANK_PTS[level];
    for(let n=1;n<level;n++) s.loverEventsSeen.push(`lover_${id}_lv${n}`,`lover_${id}_lv${n}_b`);
    f.stats.bond.private=true; f.stats.gainAffinity(id,100); f.stats.bond.private=false;
    assert.equal(s.loveLevel[id],level,`${id}:${level} skipped unread`);
    assert.equal(s.lovePts[id],f.stats.AFFINITY_RANK_PTS[level+1]-1);
    f.setPlay(async()=>done);
    assert.equal(await f.romance.playLoverMilestone(id),true,`${id}:${level} cannot read`);
    if (f.db.dialogues[`lover_${id}_lv${level}_b`]) assert.equal(await f.romance.playLoverMilestone(id),true);
    assert.equal(s.loveLevel[id],level+1,`${id}:${level} did not unlock`);
    assert.equal(f.stats.releaseLoveAffinity(id),0);
  }
});
await check('unconnected hiyori lover preview is not invented as a cap or completion requirement',async f=>{
  const s=f.core.state;s.lovers=['hiyori'];s.loveLevel.hiyori=1;s.lovePts.hiyori=9;
  assert.equal(f.stages.pendingLoveStage(s,'hiyori',f.db),null);
  f.stats.bond.private=true;f.stats.gainAffinity('hiyori',30);f.stats.bond.private=false;
  assert.equal(s.lovePts.hiyori,24);assert.equal(s.loveLevel.hiyori,2);
  assert.equal(s.loverEventsSeen.length,0);
});
await check('LOAD during old private scope cannot leak into new public gain or close new private scope',async f=>{
  const old=f.core.state;old.lovers=['tsumugi'];old.loveLevel.tsumugi=1;old.lovePts.tsumugi=9;
  let resolve; f.setPlay(()=>new Promise(r=>resolve=r));
  const pending=f.romance.playLoverMilestone('tsumugi');
  const s=f.fresh();s.lovers=['rin'];s.loveLevel.rin=1;s.lovePts.rin=9;
  f.stats.gainAffinity('rin',10);assert.equal(s.lovePts.rin,9,'old private context leaked across LOAD');
  const restore=f.stats.privateBondScope();resolve(done);assert.equal(await pending,false);
  assert.equal(f.stats.bond.private,true,'old finally closed new context');
  f.stats.gainAffinity('rin',10);assert.equal(s.lovePts.rin,14);restore();assert.equal(f.stats.bond.private,false);
});
await check('privateBondScope: nested scopes restore fully in LIFO order (#1361)',async f=>{
  assert.equal(f.stats.bond.private,false);
  const outer=f.stats.privateBondScope();assert.equal(f.stats.bond.private,true);
  const inner=f.stats.privateBondScope();
  inner();assert.equal(f.stats.bond.private,true,'inner close must keep the outer scope');
  outer();assert.equal(f.stats.bond.private,false,'outer close must restore the pre-scope value');
});
await check('privateBondScope: out-of-order close hands the restore target down (#1361)',async f=>{
  const outer=f.stats.privateBondScope();
  const inner=f.stats.privateBondScope();
  outer();assert.equal(f.stats.bond.private,true,'early outer close must not close the inner scope');
  inner();assert.equal(f.stats.bond.private,false,'last close must restore the pre-scope value');
});
await check('privateBondScope: sequential scopes, stale and double restores are inert (#1361)',async f=>{
  const first=f.stats.privateBondScope();first();assert.equal(f.stats.bond.private,false);
  const second=f.stats.privateBondScope();
  first();assert.equal(f.stats.bond.private,true,'stale restore must not close a live scope');
  second();second();assert.equal(f.stats.bond.private,false,'double restore must be a no-op');
  f.stats.bond.private=true;
  const third=f.stats.privateBondScope();third();
  assert.equal(f.stats.bond.private,true,'scope opened while private must restore to true');
  f.stats.bond.private=false;
});
await check('privateBondScope: LOAD-stale scope cannot close a scope on the new state (#1361)',async f=>{
  const stale=f.stats.privateBondScope();
  f.fresh();
  const live=f.stats.privateBondScope();
  stale();assert.equal(f.stats.bond.private,true,'stale restore must not close the new-state scope');
  live();assert.equal(f.stats.bond.private,false);
});
await check('question pending public caller rejects duplicate entry without a second play',async f=>{
  const s=f.core.state;s.affinity.rin=33;s.story.rin=3;let resolve;
  f.setPlay(()=>new Promise(r=>resolve=r));const p=f.bonds.playQuestionVisit('rin');
  assert.equal(await f.bonds.playQuestionVisit('rin'),false);assert.equal(f.plays.length,1);
  f.bonds.recordRomanceChoice({id:'bond_q1_rin',romance_char:'rin'},{romance:1});resolve(done);assert.equal(await p,true);
});
for (const chapter of [1,2]) for (const points of [32,33,34]) await check(`chapter-spanning visit at ${points} points in chapter${chapter}: one eligible stage or daily talk`,async f=>{
  const s=f.core.state;s.chapter=chapter;s.story.naru=3;s.affinity.naru=points;s.flags._cafe_introduced=true;
  assert.equal(f.spots.storyHeartReady('naru',3),points>=33);
  f.setPlay(async()=>done);assert.equal(await f.spots.visitChar('naru'),true);
  const normal=f.plays.filter(([scene])=>f.spots.VISIT_SEQ.naru.includes(typeof scene==='string'?scene:scene.dialogue_id));
  assert.equal(normal.length,points>=33?1:0);assert.equal(s.story.naru,points>=33?4:3);
});
await check('heart2.5 with heart2 seen uses daily talk and keeps the normal visit fee/action costs',async f=>{
  const s=f.core.state;s.chapter=2;s.story.naru=3;s.affinity.naru=26;s.affinityCarry.naru=.5;s.money=10000;s.flags._cafe_introduced=true;
  const stamina=f.stats.staminaAfter(-16);f.setPlay(async()=>done);
  assert.equal(await f.spots.visitRival({id:'naru',charId:'naru',cost:3000,stamina:-16}),true);
  assert.equal(s.money,7000);assert.equal(s.stamina,stamina);assert.equal(s.story.naru,3);assert.equal(s.visits.naru,1);
  assert(f.plays.some(([scene])=>String(scene).startsWith('remake_repeat_naru_')));
});
await check('LIME-only heart3 unlocks oldest unread; a visit never chains heart2 into heart3',async f=>{
  const s=f.core.state;s.chapter=2;s.story.naru=2;s.affinity.naru=25;s.flags._cafe_introduced=true;
  f.stats.gainAffinity('naru',40,{source:'lime'});assert.equal(s.affinity.naru,33);assert.equal(s.story.naru,2);
  f.setPlay(async()=>done);assert.equal(await f.spots.visitChar('naru'),true);assert.equal(s.story.naru,3);
  assert.deepEqual(f.plays.filter(([id])=>f.spots.VISIT_SEQ.naru.includes(id)).map(([id])=>id),['ch1_naru_third']);
  f.plays.length=0;assert.equal(await f.spots.visitChar('naru'),true);assert.equal(s.story.naru,4);
  assert.deepEqual(f.plays.filter(([id])=>f.spots.VISIT_SEQ.naru.includes(id)).map(([id])=>id),['ch1_naru_group_regulars']);
});
await check('readiness for a detached preview state uses that state and never changes save data',async f=>{
  const current=f.core.state;current.affinity.naru=0;const preview=clone(current);preview.chapter=2;preview.affinity.naru=33;
  assert.equal(f.spots.storyHeartReady('naru',3,preview),true);assert.equal(current.affinity.naru,0);assert.equal(preview.story.naru||0,0);
});
await check('ordinary stage and independent facility introduction remain separate in one visit',async f=>{
  const s=f.core.state;s.affinity.naru=33;s.story.naru=1;f.setPlay(async()=>done);
  assert(f.db.dialogues.ch1_naru_cafe_intro);assert.equal(await f.spots.visitChar('naru'),true);
  assert.equal(s.story.naru,2);assert(s.flags._cafe_introduced);
  assert.deepEqual(f.plays.map(([id])=>id),['ch1_naru_second','ch1_naru_cafe_intro']);
});
for (const outcome of ['cancel','missing','throw','abort','load']) await check(`high numeric affinity ${outcome} keeps oldest stage unread/unrewarded`,async f=>{
  const s=f.core.state;s.chapter=2;s.story.naru=2;s.affinity.naru=48;s.flags._cafe_introduced=true;
  const controller=new AbortController();
  f.setPlay(async()=>{if(outcome==='throw')throw Error('expected');if(outcome==='load')f.core.newGame();if(outcome==='abort')controller.abort();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
  const p=f.spots.visitChar('naru',{signal:controller.signal});
  if(outcome==='throw')await assert.rejects(p,/expected/);else assert.equal(await p,false);
  assert.equal(s.story.naru,2);assert.equal(s.affinity.naru,48);assert.equal(s.visits.naru||0,0);
});

// #1253: real delivery/expiry/save code, with controlled VN/presentation ports.
function readyMinto(f, chapter = 1, day = 13) {
  const s = f.fresh();
  Object.assign(s, { chapter, day, slot: 0, contacts: ['minto'] });
  s.met.minto = true;
  s.story.minto = f.spots.VISIT_SEQ.minto.length;
  s.affinity.minto = 90;
  Object.assign(s.flags, { _minto_identity_revealed: true, _minto_name_known: true, _minto_affinity_question_done: true });
  s.romanceChoices.bond_q1_minto = { char: 'minto', value: 1, day: 12 };
  return s;
}
const finaleMail = s => s.inbox.filter(i => i.originId === 'lime_minto_bond_finale');
await check('Minto finale invitation remains reachable after chapter advancement', async f => {
  for (const chapter of [1, 2, 3, 4, 5]) {
    const s = readyMinto(f, chapter, 13 + (chapter - 1) * 14);
    assert.equal(f.bonds.finaleDue('minto'), true);
    assert.equal(f.bonds.finaleAtVisit('minto'), false);
    f.phone.deliverMorning();
    assert.equal(finaleMail(s).length, 1, `chapter ${chapter}`);
    const item = finaleMail(s)[0];
    assert.equal(item.chapter, chapter);
    assert.equal(item.id, `lime_minto_bond_finale_c${chapter}_d${s.day}`);
    assert.equal(item.msg.time_slot, 'noon');
    assert(!JSON.stringify(item.msg.messages).includes('{private'));
    f.phone.deliverMorning();
    assert.equal(finaleMail(s).length, 1, 'no duplicate delivery');
  }
});

await check('Minto unanswered/declined/lost appointment expires and is re-offered across chapters and SAVE/LOAD', async f => {
  for (const outcome of ['unanswered', 'declined', 'accepted', 'lost']) {
    let s = readyMinto(f);
    f.phone.deliverMorning();
    const item = finaleMail(s)[0];
    if (outcome !== 'unanswered') {
      Object.assign(item, { read: true, done: true, result: outcome === 'declined' ? 'declined' : 'accepted' });
      s.limeRead.push(item.id);
    }
    if (outcome === 'accepted') s.pendingInvite = { day: s.day, slot: 0, sender: 'minto', event: item.msg.accept_event, originId: item.originId };
    s.chapter = 2; s.day = 14; s.slot = 0;
    s = f.roundTrip();
    f.phone.deliverMorning();
    assert.equal(finaleMail(s).length, 1, 'two-day resend interval survives chapter change');
    assert.equal(s.pendingInvite, null);
    if (outcome !== 'declined') assert.equal(finaleMail(s)[0].result, 'expired');
    s.day = 15;
    f.phone.deliverMorning();
    const retry = finaleMail(s)[1];
    assert(retry, outcome);
    assert.equal(retry.id, 'lime_minto_bond_finale_c2_d15');
    assert.equal(retry.msg.time_slot, 'night');
    assert.equal(retry.msg.after_close, true);
    assert(retry.msg.messages[0].includes('この前は都合が合わなかった'));
    assert(!JSON.stringify(retry.msg.messages).includes('{private'));
    f.phone.deliverMorning();
    assert.equal(finaleMail(s).length, 2);
  }
});
await check('Minto finale invitations keep prerequisites, tournament and non-daily exclusions in later chapters', async f => {
  for (const blocked of ['name', 'identity', 'question', 'story', 'affinity', 'seen', 'phase', 'tournament', 'pending']) {
    const s = readyMinto(f, 2, 27);
    if (blocked === 'name') delete s.flags._minto_name_known;
    if (blocked === 'identity') delete s.flags._minto_identity_revealed;
    if (blocked === 'question') delete s.flags._minto_affinity_question_done;
    if (blocked === 'story') s.story.minto--;
    if (blocked === 'affinity') s.affinity.minto = 0;
    if (blocked === 'seen') s.finales.minto = { chapter: 1, day: 13, route: 'friend' };
    if (blocked === 'phase') s.phase = 'aftermath';
    if (blocked === 'pending') s.pendingInvite = { event: 'ch1_minto_bond_finale' };
    assert.equal(f.bonds.bondInvites({ tournamentDay: blocked === 'tournament' }).length, 0, blocked);
  }
});
await check('Minto later-chapter finale grants gift and romance reservation once, friendship remains available', async f => {
  for (const chapter of [1, 2, 3, 4, 5]) for (const value of [0, 1]) {
    let s = readyMinto(f, chapter, 13 + (chapter - 1) * 14);
    f.db.equipById.suyaki_minto = { name: 'gift' };
    f.setPlay(async () => {
      f.bonds.recordRomanceChoice({ id: 'bond_q2_minto', romance_char: 'minto' }, { romance: value });
      return done;
    });
    assert.equal(await f.bonds.playFinale('minto'), true);
    s = f.roundTrip();
    assert.equal(s.finales.minto.chapter, chapter);
    assert.equal(s.finales.minto.route, value ? 'romance' : 'friend');
    assert.equal(s.flags._confession_due, value ? 'minto' : undefined);
    assert.equal(f.romance.romanceRouteOpen('minto'), !!value);
    assert.equal(s.owned.filter(id => id === 'suyaki_minto').length, 1);
    assert.equal(await f.bonds.playFinale('minto'), false);
    assert.equal(f.bonds.bondInvites().length, 0);
    assert.equal(s.owned.filter(id => id === 'suyaki_minto').length, 1);
  }
});

console.log(`affinity stages: ${count} PASS; browser/real LOAD not executed`);

