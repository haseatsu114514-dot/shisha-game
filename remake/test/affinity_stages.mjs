// Actual state/stats/public callers; VN and presentation are controlled ports, not browser acceptance.
// node --experimental-vm-modules remake/test/affinity_stages.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../js/', import.meta.url));
const sourceRoot = process.env.AFFINITY_SOURCE_ROOT || root;
const realPaths = ['core/state.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','daily/spots.js','daily/bonds.js','daily/samechan.js','daily/romance.js','daily/samechan-bonds.js'];
const scripts = ['ch1_sumi','ch1_tsumugi','ch1_minto','ch1_naru','ch1_adam','ch1_rin','ch1_bonds','samechan','hiyori','lover_events'];
const data = scripts.map(name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))));
const clone = value => JSON.parse(JSON.stringify(value));
async function fixture() {
  const memory = new Map(), events = [], plays = [], timers = new Map();
  let serial = 0, playImpl = async scene => ({ id: typeof scene === 'string' ? scene : scene.dialogue_id, visited: [] });
  const db = { dialogues: Object.fromEntries(data.flatMap(d => d.dialogues || []).map(d => [d.dialogue_id,d])), hiyori: data[8], equipById: {}, flavorById: {}, characters: {} };
  const context = vm.createContext({ console, AbortController, setTimeout: fn => { timers.set(++serial,fn); return serial; }, clearTimeout: id => timers.delete(id), localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  const known = {
    MAX_MONEY: 999999, TOURNAMENT_DAY: 14, DB: db, callName: String,
    emit: (type,payload) => events.push({type,payload}),
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)),
    play: async (...args) => { plays.push(args); return playImpl(...args); }, isPlaying: () => false,
    AXE_BAR: {id:'axe_bar'}, RAIN_SPOT_TEXTS: {}, isRainy: () => false,
    spotFollowupDue: () => null, syncMintoKnowledge() {}, meetHiyoriAtTonari: async () => false,
    maybeRecruitTrpgMember: async () => false, sharkSwim: async swap => swap(),
    setBg: async () => {}, sceneBg: () => ({}),
    hiyoriFirstMeetingReady: () => true,
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
  return { core, stats, fresh, db, plays, events, memory, stages: ns('core/affinity-stages.js'), spots: ns('daily/spots.js'), bonds: ns('daily/bonds.js'), samechan: ns('daily/samechan.js'), romance: ns('daily/romance.js'), sharkBond: ns('daily/samechan-bonds.js'), setPlay: fn => playImpl=fn,
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
await check('five social shop routes: each unread stage caps earned points, completing it releases once', async f => {
  for (const [id,seq] of Object.entries(f.spots.VISIT_SEQ).filter(([id]) => id !== "sumi")) for (let stage=0;stage<seq.length;stage++) {
    const s=f.fresh(); s.story[id]=stage;
    if (stage>3) s.flags[f.stages.questionDoneKey(id)]=true;
    s.affinity[id]=f.stats.AFFINITY_RANK_PTS[stage];
    f.stats.gainAffinity(id,100);
    const cap=stage<5 ? f.stats.AFFINITY_RANK_PTS[stage+1]-1 : Infinity;
    const effective=['tsumugi','minto','rin'].includes(id)&&stage<=3 ? Math.min(cap,33) : cap;
    assert.equal(s.affinity[id], Math.min(f.stats.AFFINITY_RANK_PTS[stage]+85,effective),`${id}:${stage}`);
    assert(f.stats.affinityLevel(id)<=stage,`${id}:${stage} skipped unread`);
    if (stage<seq.length-1) {
      s.story[id]++;
      if (stage===3) s.flags[f.stages.questionDoneKey(id)]=true;
      const got=f.stats.releaseAffinity(id); assert(got>0,`${id}:${stage} did not release`);
      assert.equal(f.stats.releaseAffinity(id),0);
    }
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
  assert.equal(s.story.naru,1); assert.equal(s.visits.naru,1); assert.equal(s.affinity.naru,8);
  assert.equal(f.spots.hasNewStory('naru'),false);
  f.setPlay(async()=>done); await f.spots.visitChar('naru'); // repeat provides existing +5, then ♥1 unlocks second
  assert.equal(s.story.naru,1); assert.equal(f.stats.affinityLevel('naru'),1); assert.equal(f.spots.hasNewStory('naru'),true);
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
await check('legacy current/carry/history stay intact; old rescued points never released twice across SAVE/LOAD', async f => {
  let s=f.core.state;s.affinity.tsumugi=66;s.affinityCarry.tsumugi=.7;
  s.flags._tsumugi_affinity_waiting_pts=34;s.flags._tsumugi_affinity_waiting_released=true;s.flags._tsumugi_affinity_released_pts=15;
  const before=clone(s);assert.equal(f.stats.releaseAffinity('tsumugi'),0);assert.deepEqual(clone(s),before);
  s=f.roundTrip();assert.equal(s.affinity.tsumugi,66);assert.equal(s.story.tsumugi||0,0);close(s.affinityCarry.tsumugi,.7);
  s.story.tsumugi=6;s.flags[f.stages.questionDoneKey('tsumugi')]=true;
  assert.equal(f.stats.releaseAffinity('tsumugi'),19);assert.equal(s.affinity.tsumugi,85);
  assert.equal(s.flags._tsumugi_affinity_waiting_pts,34);assert.equal(s.flags._tsumugi_affinity_released_pts,15);
  s=f.roundTrip();assert.equal(f.stats.releaseAffinity('tsumugi'),0);assert.equal(s.affinity.tsumugi,85);
});
await check('LIME .25/carry and fortune once: blocked actual delta has no false gain notification', async f => {
  const s=f.core.state;s.story.naru=0;s.affinity.naru=8;
  for(let i=0;i<5;i++) f.stats.gainAffinity('naru',1,{source:'lime'});
  close(s.affinityCarry.naru,.0625);assert.equal(s.affinity.naru,8);assert.equal(s.flags._naru_affinity_waiting_pts,1);
  f.tick();assert.equal(f.events.filter(e=>e.type==='affinity-gain').length,0);
  s.story.naru=1;s.fortune={char:'naru'};assert.equal(f.stats.releaseAffinity('naru'),1);assert(s.fortune);
  f.stats.gainAffinity('naru',2,{source:'lime'});assert.equal(s.fortune,undefined);assert.equal(s.affinity.naru,9);
  close(s.affinityCarry.naru,.7); // round(2*1.5)*.85*.25 + .0625
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
await check('hiyori connected prerequisites: work_talk2 never caps before required axe3; dedicated return guard stays', async f => {
  const s=f.core.state;const route=f.db.hiyori.route;
  for(const e of route.events) if(e.id!=='axe_reveal'&&e.id!=='work_talk')s.flags[e.flag]=true;
  s.affinity.hiyori=33;assert.equal(f.stats.affinityPointCap('hiyori'),47);
  assert.equal(f.stages.pendingAffinityStage(s,'hiyori',f.db).level,3);
  delete s.flags._hiyori_tonari_return_done;assert.equal(f.stats.affinityPointCap('hiyori'),33);
  s.flags._hiyori_tonari_return_done=true;s.flags._hiyori_real_self_known=true;s.flags._hiyori_work_talk_done=true;
  assert.equal(f.stats.affinityPointCap('hiyori'),47);
  s.flags._hiyori_bond_question_done=true;assert.equal(f.stats.affinityPointCap('hiyori'),Infinity);
});
await check('chapter2 actual flags: chat/followup/ageha three visits are independent completion evidence', async f => {
  for(const id of ['ageha','kumicho','rei']) {
    const s=f.fresh();assert.equal(f.stats.affinityPointCap(id),8);
    s.flags._ch2_talks={[id]:1};assert.equal(f.stats.affinityPointCap(id),19);
    s.flags._ch2_followup_done={[id]:true};
    assert.equal(f.stats.affinityPointCap(id),id==='ageha'?32:Infinity);
    if(id==='ageha')for(const [i,key]of ['gyaru','newcomer','magazine'].entries()){
      s.flags[`_ch2_read_remake_ch2_ageha_${key}`]=true;
      assert.equal(f.stats.affinityPointCap(id),i===2?Infinity:f.stats.AFFINITY_RANK_PTS[i+4]-1);
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
  for (const id of [...f.stats.ROMANCEABLE.filter(id=>id!=="hiyori"),"mashiro"]) for (let level=1;level<5;level++) {
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
await check('question pending public caller rejects duplicate entry without a second play',async f=>{
  const s=f.core.state;s.affinity.rin=33;s.story.rin=3;let resolve;
  f.setPlay(()=>new Promise(r=>resolve=r));const p=f.bonds.playQuestionVisit('rin');
  assert.equal(await f.bonds.playQuestionVisit('rin'),false);assert.equal(f.plays.length,1);
  f.bonds.recordRomanceChoice({id:'bond_q1_rin',romance_char:'rin'},{romance:1});resolve(done);assert.equal(await p,true);
});
console.log(`affinity stages: ${count} PASS; browser/real LOAD not executed`);
