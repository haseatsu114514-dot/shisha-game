// Actual state/stats/public callers; VN and presentation are controlled ports, not browser acceptance.
// node --experimental-vm-modules remake/test/affinity_stages.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../js/', import.meta.url));
const sourceRoot = process.env.HIYORI_SOURCE_ROOT || root;
const supportRoot = process.env.HIYORI_SUPPORT_ROOT || root;
const realPaths = ['core/util.js','core/axe-bar-discovery.js','daily/hiyori.js','daily/spot-encounters.js','core/cinema-discovery.js','core/travel-budget.js','daily/cinema.js','core/state.js','core/gallery-progress.js','core/stats.js','core/affinity-stages.js','core/condition.js','core/hiyori-route.js','daily/spots.js','daily/bonds.js','daily/samechan.js','daily/romance.js','daily/samechan-bonds.js'];
const scripts = ['ch1_sumi','ch1_tsumugi','ch1_minto','ch1_naru','ch1_adam','ch1_rin','ch1_bonds','samechan','hiyori','lover_events','cinema','remake_ch1','ch1_spots'];
const data = scripts.map(name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))));
const clone = value => JSON.parse(JSON.stringify(value));
async function fixture() {
  const memory = new Map(), events = [], plays = [], timers = new Map();
  let rainy = false;
  let serial = 0, playImpl = async scene => ({ id: typeof scene === 'string' ? scene : scene.dialogue_id, visited: [] });
  const db = { dialogues: Object.fromEntries(data.flatMap(d => d.dialogues || []).map(d => [d.dialogue_id,d])), hiyori: data[8], samechan: data[7], equipById: {}, flavorById: {}, characters: {} };
  const context = vm.createContext({ console, AbortController, setTimeout: fn => { timers.set(++serial,fn); return serial; }, clearTimeout: id => timers.delete(id), localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  const known = {
    on: () => () => {}, hiyoriAxeAffordable: () => false, playHiyoriAxeSequence: async () => false, playAxeBarRumor: async () => false, MAX_MONEY: 999999, TOURNAMENT_DAY: 14, DB: db, callName: String,
    emit: (type,payload) => events.push({type,payload}),
    
    play: async (...args) => { plays.push(args); return playImpl(...args); }, isPlaying: () => false,
    trpgSpot: () => ({id:'trpg',kind:'trpg'}), AXE_BAR: {id:'axe_bar',kind:'axe'}, RAIN_SPOT_TEXTS: {}, isRainy: () => rainy,
    spotFollowupDue: () => null, syncMintoKnowledge() {}, 
    maybeRecruitTrpgMember: async () => false, sharkSwim: async swap => swap(),
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
  return { core, stats, fresh, db, plays, events, memory, stages: ns('core/affinity-stages.js'), spots: ns('daily/spots.js'), hiyori: ns('daily/hiyori.js'), util: ns('core/util.js'), bonds: ns('daily/bonds.js'), samechan: ns('daily/samechan.js'), romance: ns('daily/romance.js'), sharkBond: ns('daily/samechan-bonds.js'), setRain: value => rainy=value, setPlay: fn => playImpl=fn,
    tick: () => { for (const [id,fn] of [...timers]) { timers.delete(id); fn(); } },
    roundTrip: () => { core.save(); core.newGame(); assert(core.load()); return core.state; },
  };
}
let count = 0;
const done = { id: 'controlled-complete', visited: [] };
async function check(name, run) {
  if (process.env.HIYORI_CASE && !new RegExp(process.env.HIYORI_CASE).test(name)) return;
  try { await run(await fixture()); count++; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}
function host(f, id, { read = 2, points = 26 } = {}) {
  const s = f.core.state; s.met[id] = true; s.story[id] = read; s.affinity[id] = points;
  if (id === 'naru') s.flags._cafe_introduced = true;
  return f.spots.allSpots().find(spot => spot.charId === id);
}
// Reconstruct only the old eligibility/seed ordering to prove the occurrence set is unchanged.
function oldCandidates(f) {
  const s = f.core.state;
  return f.spots.allSpots().filter(p => f.hiyori.hiyoriShopEligible(p) && f.spots.isUnlocked(p)
    && !f.spots.isClosed(p) && !p.unavailable && s.visitedDay[p.id] !== s.day).map(p => {
    let salt = 2166136261;
    for (const c of `hiyori:${s.chapter}:${s.day}:${s.slot}:${p.id}`) salt = Math.imul(salt ^ c.charCodeAt(0), 16777619) >>> 0;
    return { ...p, roll: f.util.seeded(s.seed, salt) };
  }).filter(p => p.roll < .2).sort((a,b) => a.roll-b.roll || a.id.localeCompare(b.id));
}
await check('quiet heart2.5 and oldest unread heart2 at high affinity match actual visitChar', async f => {
  const s=f.core.state, p=host(f,'naru',{read:3,points:26});
  assert.equal(f.spots.shortNormalVisit(p),true);
  const before=JSON.stringify(s); assert.equal(f.spots.shortNormalVisit(p),true); assert.equal(JSON.stringify(s),before);
  assert.equal(await f.spots.visitChar('naru'),true); assert.equal(s.story.naru,3);
  assert.match(f.plays[0][0],/^remake_repeat_naru_/);
  s.story.naru=2;s.affinity.naru=48;f.plays.length=0;
  assert.equal(f.spots.shortNormalVisit(p),false);
  assert.equal(await f.spots.visitChar('naru'),true);
  assert.equal(f.plays[0][0],f.spots.VISIT_SEQ.naru[2]);assert.equal(s.story.naru,3);
});
await check('seeded eligible occurrence set retained; one quiet host wins and all-long falls back', async f => {
  const s=f.core.state;
  for (const id of ['naru','adam','minto']) host(f,id,{read:2,points:66});
  let shifted=0, absent=0, present=0;
  for(let seed=0;seed<200;seed++) {
    s.seed=seed;s.story.naru=2;s.affinity.naru=66;
    const old=oldCandidates(f), allLong=f.hiyori.hiyoriShopLocation();
    assert.equal(allLong,old[0]?.id||null,'No quiet candidate must preserve old order');
    s.story.naru=3;s.affinity.naru=26;
    const before=JSON.stringify(s), chosen=f.hiyori.hiyoriShopLocation();
    assert.equal(JSON.stringify(s),before);assert.equal(f.hiyori.hiyoriShopLocation(),chosen);
    const quiet=old.filter(p=>p.id==='naru'); // The prepared host state above makes only Naru a quiet repeat.
    assert.equal(chosen,(quiet[0]||old[0])?.id||null);
    if(chosen)present++;else absent++;
    if(quiet.length&&old[0].id!==quiet[0].id)shifted++;
    assert.equal(f.spots.allSpots().filter(f.hiyori.hiyoriShopEncounterDue).length,chosen?1:0);
  }
  assert(shifted>0);assert(absent>0&&present>0);
});
await check('first meeting, followup, cafe introduction, question and missing repeat stay separate', async f => {
  const s=f.core.state,p=host(f,'naru',{read:3,points:26});
  delete s.met.naru;assert.equal(f.spots.shortNormalVisit(p),false);s.met.naru=true;
  s.story.naru=0;assert.equal(f.spots.shortNormalVisit(p),false);s.story.naru=3;
  delete s.flags._cafe_introduced;assert.equal(f.spots.shortNormalVisit(p),false);s.flags._cafe_introduced=true;
  s.affinity.naru=33;assert.equal(f.spots.shortNormalVisit(p),false);s.affinity.naru=26;
  const id='remake_repeat_naru_0',saved=f.db.dialogues[id];delete f.db.dialogues[id];
  assert.equal(f.spots.shortNormalVisit(p),false);f.db.dialogues[id]=saved;
  assert(f.db.dialogues.cafe_naru_followup?.lines?.length);s.flags._spot_seen_cafe_naru_break=true;
  assert.equal(f.spots.shortNormalVisit(p),false);assert.equal(s.flags._spot_follow_naru,undefined);
});
await check('samechan and C.STATION repeat classification preserves pending intros and special events',async f=>{
  const s=f.core.state;s.chapter=2;s.met.samechan=true;s.story.samechan=1;
  const shark=f.spots.allSpots().find(p=>p.kind==='samechan');assert(shark);
  assert.equal(f.spots.shortNormalVisit(shark),true);
  s.flags._samechan_quiet_seat_done=true;assert.equal(f.spots.shortNormalVisit(shark),false);
  s.flags._samechan_cinema_introduced=true;assert.equal(f.spots.shortNormalVisit(shark),true);
  s.flags._samechan_visit={stamp:`2:${s.day}:${s.slot}`,dialogue:'samechan_shop_first'};
  assert.equal(f.spots.shortNormalVisit(shark),false);
  const cs=f.spots.allSpots().find(p=>p.id==='c_station');
  assert.equal(f.spots.shortNormalVisit(cs),false);
  s.spotVisits={c_station:1};s.reel.introDone=true;
  const id=cs.pool[0];assert(f.db.dialogues[id]?.lines?.length,'Use the actual C.STATION repeat script');
  assert.equal(f.spots.shortNormalVisit(cs),true);
  // #1696: 博士と面識があれば2回目の来店は一度きりの回になるので、短い日常として扱わない。
  s.met.dr_kemuri=true;assert.equal(f.spots.shortNormalVisit(cs),false,'doctor encounter due is not a quiet visit');
  s.flags._spot_seen_cs_kemuri_sample=true;assert.equal(f.spots.shortNormalVisit(cs),true);
  delete s.met.dr_kemuri;delete s.flags._spot_seen_cs_kemuri_sample;
  s.flags._pakki_first_spin_pending=true;assert.equal(f.spots.shortNormalVisit(cs),false);
});
await check('invitation tonari closure unmets slot and daily cap preserve original eligibility',async f=>{
  const s=f.core.state;host(f,'naru',{read:3,points:26});
  for(let n=0;n<500&&!f.hiyori.hiyoriShopLocation();n++)s.seed=n;
  assert(f.hiyori.hiyoriShopLocation());
  const original=JSON.stringify(s);s.pendingInvite={sender:'hiyori',day:s.day};assert.equal(f.hiyori.hiyoriShopLocation(),null);
  delete s.pendingInvite;s.flags._hiyori_tonari_return_done=true;assert.equal(f.hiyori.hiyoriShopLocation(),null);
  delete s.flags._hiyori_tonari_return_done;s.flags._hiyori_encounter_day=`1:${s.day}`;assert.equal(f.hiyori.hiyoriShopLocation(),null);
  delete s.flags._hiyori_encounter_day;s.slot=2;assert.equal(f.hiyori.hiyoriShopLocation(),null);s.slot=0;
  const naru=f.spots.allSpots().find(p=>p.id==='naru');s.day=3;assert(f.spots.isClosed(naru));assert.notEqual(f.hiyori.hiyoriShopLocation(),'naru');
  delete s.met.naru;assert.equal(f.spots.shortNormalVisit(naru),false);
  assert(original.length>0);
});
await check('scheduled guest stays frozen across host reward unlocking a stage and isolated SAVE reload',async f=>{
  let s=f.core.state;host(f,'naru',{read:3,points:32});
  for(let seed=0;seed<500;seed++){s.seed=seed;if(f.hiyori.hiyoriShopLocation()==='naru')break;}
  assert.equal(f.hiyori.hiyoriShopLocation(),'naru');const scheduled=f.hiyori.hiyoriShopLocation();
  const before=JSON.stringify(s);for(let i=0;i<4;i++)assert.equal(f.hiyori.hiyoriShopLocation(),scheduled);assert.equal(JSON.stringify(s),before);
  s=f.roundTrip();assert.equal(f.hiyori.hiyoriShopLocation(),scheduled);
  assert.equal(await f.spots.visitChar('naru'),true);assert.equal(s.story.naru,3);assert(s.affinity.naru>=33);
  s.visitedDay.naru=s.day;const money=s.money,stamina=s.stamina;
  assert.equal(await f.hiyori.visitHiyoriAtShop(f.spots.spotById('naru'),{scheduledSpot:scheduled}),true);
  assert.equal(s.flags._hiyori_encounter_day,`1:${s.day}`);assert.equal(s.money,money);assert.equal(s.stamina,stamina);
  assert.equal(f.hiyori.hiyoriShopLocation(),null);
});
for(const outcome of ['cancel','missing','throw','abort','load']) await check(`actual shop public caller ${outcome}: no encounter stamp or reward`,async f=>{
  const s=f.core.state,controller=new AbortController(), before=JSON.stringify(s),money=s.money,stamina=s.stamina;
  f.setPlay(async()=>{if(outcome==='throw')throw Error('controlled failure');if(outcome==='abort')controller.abort();if(outcome==='load')f.core.newGame();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
  const p=f.hiyori.visitHiyoriAtShop(f.spots.spotById('naru'),{scheduledSpot:'naru',signal:controller.signal});
  if(outcome==='throw')await assert.rejects(p,/controlled failure/);else assert.equal(await p,false);
  assert.equal(s.flags._hiyori_encounter_day,undefined);assert.equal(s.flags._hiyori_repeat_count,undefined);
  assert.equal(s.affinity.hiyori||0,0);assert.equal(s.money,money);assert.equal(s.stamina,stamina);
  if(outcome!=='load')assert.equal(JSON.stringify(s),before);
});
await check('repeat pool rotates four scenes; double entry and deferred completion reward once',async f=>{
  const s=f.core.state,p=f.spots.spotById('naru');let resolve;
  f.setPlay(()=>new Promise(r=>resolve=r));
  const pending=f.hiyori.visitHiyoriAtShop(p,{scheduledSpot:'naru'});
  assert.equal(await f.hiyori.visitHiyoriAtShop(p,{scheduledSpot:'naru'}),false);
  assert.equal(s.flags._hiyori_repeat_count,undefined);resolve(done);assert.equal(await pending,true);
  const earned=s.affinity.hiyori,serialized=JSON.stringify(s);
  assert.equal(await f.hiyori.visitHiyoriAtShop(p,{scheduledSpot:'naru'}),false);assert.equal(JSON.stringify(s),serialized);
  f.setPlay(async()=>done);
  for(let n=1;n<4;n++){s.day++;assert.equal(await f.hiyori.visitHiyoriAtShop(p,{scheduledSpot:'naru'}),true);}
  assert.deepEqual(f.plays.map(p=>p[0]),[0,1,2,3].map(n=>`hiyori_shop_repeat_${n}`));
  assert.equal(s.flags._hiyori_repeat_count,4);assert(s.affinity.hiyori>=earned);
});
await check('multiple host repeats and rain use the same existing scripts in preview and actual visit',async f=>{
  const s=f.core.state,p=host(f,'naru',{read:3,points:20});
  const scripts=[];
  for(let n=0;n<4;n++) {
    s.affinity.naru=20;s.visits.naru=n;
    assert.equal(f.spots.shortNormalVisit(p),true);
    assert.equal(await f.spots.visitChar('naru'),true);scripts.push(f.plays.at(-1)[0]);
  }
  assert.equal(new Set(scripts).size,4);
  f.setRain(true);s.affinity.naru=20;
  assert.equal(f.spots.shortNormalVisit(p),true);
  assert.equal(await f.spots.visitChar('naru'),true);
  const played=f.plays.at(-1)[0];
  assert.equal(played.dialogue_id,'remake_repeat_naru_0');
  assert.equal(played.lines.length,f.db.dialogues.remake_rain_opener.lines.length+f.db.dialogues.remake_repeat_naru_0.lines.length);
  assert.equal(played.lines[0].text,f.db.dialogues.remake_rain_opener.lines[0].text);
  assert.equal(s.story.naru,3);
});
for(const outcome of ['cancel','missing','throw','abort','load']) await check(`Hiyori first meeting ${outcome} keeps dedicated event unread`,async f=>{
  const s=f.core.state,controller=new AbortController();
  for(const key of ['_hiyori_meeting_done','_hiyori_sumi_message_done','_hiyori_message_delivered','_hiyori_cracks_done'])delete s.flags[key];
  f.setPlay(async()=>{if(outcome==='throw')throw Error('controlled failure');if(outcome==='abort')controller.abort();if(outcome==='load')f.core.newGame();return outcome==='missing'?undefined:outcome==='cancel'?{cancelled:true}:done;});
  const p=f.hiyori.visitHiyoriAtShop(f.spots.spotById('naru'),{scheduledSpot:'naru',signal:controller.signal});
  if(outcome==='throw')await assert.rejects(p,/controlled failure/);else assert.equal(await p,false);
  assert.equal(s.flags._hiyori_meeting_done,undefined);assert.equal(s.flags._hiyori_encounter_day,undefined);
  assert.equal(s.affinity.hiyori||0,0);assert.equal(s.story.hiyori||0,0);
});
await check('Hiyori dedicated meeting relay cracks remain available instead of being replaced by repeat',async f=>{
  const s=f.core.state,spot=f.spots.spotById('naru');
  delete s.flags._hiyori_meeting_done;delete s.flags._hiyori_message_delivered;delete s.flags._hiyori_cracks_done;
  assert.equal(await f.hiyori.visitHiyoriAtShop(spot,{scheduledSpot:'naru'}),true);
  assert.equal(f.plays.at(-1)[0],'hiyori_meeting');s.day++;
  assert.equal(await f.hiyori.visitHiyoriAtShop(spot,{scheduledSpot:'naru'}),true);
  assert.equal(f.plays.at(-1)[0],'hiyori_shop_message');s.day++;
  assert.equal(await f.hiyori.visitHiyoriAtShop(spot,{scheduledSpot:'naru'}),true);
  assert.equal(f.plays.at(-1)[0],'hiyori_cracks');assert.equal(s.flags._hiyori_repeat_count,undefined);
});
console.log(`Hiyori quiet-visit: ${count} groups passed (controlled VM ports; not browser acceptance)`);
