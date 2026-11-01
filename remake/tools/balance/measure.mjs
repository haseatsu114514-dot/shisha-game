/** SPEC 8.2: offline Chapter 1 tournament sampler. Run with `node remake/tools/balance/measure.mjs [--calibrate]`.
 * Uses the game's mix, heat, steam, temperature and final scoring. The Gaussian input
 * model is an explicit approximation of human operation, not a frame simulation.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const mode = process.argv.includes('--star') ? 'star' : 'step';
// Default uses the production ten-step calculation unchanged. --star is only a legacy
// comparison of tier01; the loader changes that export in memory, never the game files.
if (mode === 'star') registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (!url.endsWith('/core/stats.js')) return loaded;
  const source = String(loaded.source);
  const current = 'return (step(key) - 1) / 9;';
  assert.equal(source.split(current).length, 2, 'tier01 source changed: update the legacy comparison');
  return { ...loaded, source: source.replace(current, 'return (star(key) - 1) / 4;') };
}});

globalThis.document = { addEventListener() {} };
globalThis.window = {};
Math.random = () => { throw Error('unseeded random draw'); };
const root = new URL('.', import.meta.url);
const dataRoot = new URL('../../../data/', import.meta.url);
const plan = JSON.parse(fs.readFileSync(new URL('plan.json', root)));
const [{DB}, stateModule, score, steps, thermal, conditions, heat, common, statsModule, holes, heart, condition, mastery, leaf, result] = await Promise.all([
  '../../js/core/data.js','../../js/core/state.js','../../js/craft/score.js','../../js/craft/steps.js',
  '../../js/craft/temperature-model.js','../../js/craft/conditions.js','../../js/craft/heat_logic.js',
  '../../js/craft/common.js','../../js/core/stats.js','../../js/craft/holes_logic.js',
  '../../js/craft/steam-heart.js','../../js/core/condition.js','../../js/core/flavor-mastery.js',
  '../../js/craft/flavor-life.js','../../js/craft/result.js',
].map(p => import(p)));
for (const name of ['flavors','equipment','recipes','ng_mixes']) {
  const data = JSON.parse(fs.readFileSync(new URL(`${name}.json`, dataRoot)));
  DB[name === 'ng_mixes' ? 'ngMixes' : name] = data[name];
}
DB.flavorById = Object.fromEntries(DB.flavors.map(x => [x.id,x]));
DB.equipById = Object.fromEntries(DB.equipment.map(x => [x.id,x]));
assert.equal(score.NAGUMO_BAR, 90.8);
const keys = ['technique','sense','guts','charm','insight'];
const profiles = { C1:[1,1,1,1,1], C2:[3,3,2,2,3], C3:[5,5,1,1,4], C4:[5,5,2,1,5], C3cap4:[4,4,1,1,4] };
const sha = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
function fnv(s) { let h=2166136261; for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function mulberry32(a) { return () => { let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normal=rng=>Math.sqrt(-2*Math.log(Math.max(rng(),Number.MIN_VALUE)))*Math.cos(2*Math.PI*rng());
export const hasSkill = (scenario, id) => scenario.skills?.includes(id) === true; // future skill injection seam
function setup(profile) {
  const playStats=Object.fromEntries(keys.map((k,i)=>[k,profile[i]*10]));
  const state=stateModule.setState({cycle:1,chapter:1,day:14,stats:{...playStats},flags:{_last_night:'sleep_early'},owned:['silicone_bowl','lotos_hagal','flat_charcoal'],goods:[],stamina:100,flavorMastery:{},rehearsal:null});
  mastery.gainFlavorExperience(state,{lemon:1},12,DB.flavorById);
  mastery.gainFlavorExperience(state,{lemon:10,mint:2},2,DB.flavorById);
  assert.equal(mastery.masteryLevel(state,'lemon',DB.flavorById),2);
  assert.equal(mastery.masteryLevel(state,'mint',DB.flavorById),1);
  return {mode:'tournament',chapter:1,condition:condition.STAMINA_CONDITIONS.green,
    equip:{bowl:'silicone_bowl',hms:'lotos_hagal',charcoal:'flat_charcoal'},
    mix:{lemon:10,mint:2},pack:'normal',place:'triangle',foilOptIn:false,
    steamSeconds:360,environment:{rainy:false,ambientC:23,humidityPercent:50},
    steamVariation:{offset:0,transfer:1},masteryAtStart:{...state.flavorMastery},
    careHistory:[],strain:0,retryAssist:false};
}
function heatResult(timings) {
  const picks=timings.map(t=>t.phase);
  const avg=k=>picks.reduce((sum,p)=>sum+heat.HEAT_GRADES[p][k],0)/picks.length;
  const accuracy=heat.summarizeCoalTimings(timings).accuracy;
  return {score:accuracy,picks,just:picks.filter(p=>p==='just').length,
    heatPower:clamp(50+avg('hp'),0,100),heatStability:clamp(50+avg('hs'),0,100),
    burnRisk:clamp(30+avg('br'),0,100),aromaRetention:clamp(55+avg('ar'),0,100)};
}
export function runOne(id, operation, seed, config = plan, skillLookup = hasSkill) {
  const cs=setup(profiles[id]);
  const scenario={id, operation, playStats:{...stateModule.state.stats}, skills:config.skills ?? []};
  const cfg=config.operations[operation];
  const rng=mulberry32((fnv('u5-process-v1')^seed)>>>0);
  const slow=common.skill.slow(cs), window=common.skill.window(cs);
  cs.mixInfo=steps.evaluateMix(cs);
  assert(cs.mixInfo.regOk && cs.mixInfo.total===12 && !holes.usesFoil(cs));
  leaf.ensureFlavorLife(cs);
  cs.holes=holes.skippedFoilResult();
  const justSeconds=heat.coalJustSeconds(window,false,[]);
  const timings=Array.from({length:3},()=>{
    const tj=4.2+3.2*rng();
    const error=cfg.coalBias+cfg.coalSigma*normal(rng);
    return heat.evaluateCoalTiming(tj+justSeconds/2+error,tj,justSeconds);
  });
  cs.heat=heatResult(timings);
  const radius=heart.heartHitRadius(statsModule.tier01('guts'),cs.condition.focus);
  const spawn=0.46*(1+0.25*statsModule.tier01('insight'))*cs.condition.focus;
  let hits=0;
  for(let i=0;i<6;i++) {
    const present=rng()<.46/spawn;
    const distance=clamp(cfg.nearMissMean+cfg.nearMissSigma*normal(rng),0,12);
    if(present && heart.heartTouchesBullet({x:distance,y:-1,w:1,h:2},0,0,radius)) hits++;
  }
  cs.steam={seconds:360,min:6,hits,score:clamp(100-hits*14,0,100),temp:conditions.temperatureAfterSteam(cs,360,cs.steamVariation)};
  const bands=thermal.temperatureBands(cs);
  const finishThermal=round=>{
    const residual=cfg.temperatureSigma*normal(rng);
    const focus=round===0?conditions.pullFocusFromSteam(cs).slow:1;
    const temp=bands.center+residual/(slow*focus);
    const pulls=round===0?3:1;
    const safe=(round===0?3:2)+thermal.makerMixProfile(cs).safePullsBonus;
    return {round,temp,pulls,...conditions.pullResult(temp,pulls,0,bands,safe)};
  };
  cs.pull=finishThermal(0);
  cs.careHistory=[finishThermal(1),finishThermal(2)];
  score.finalize(cs);
  const outcome=result.outcomeOf(cs.total);
  assert.equal(cs.foilSkipped,true);
  assert.equal(typeof skillLookup(scenario,'K11'),'boolean');
  return {id,operation,seed,total:cs.total,rank:outcome.rank,
    parts:cs.parts,heatPhases:timings.map(t=>t.phase),steamHits:hits,
    playStats:scenario.playStats,tierMode:mode};
}
function rowsFor(id,operation,config=plan) { return Array.from({length:1000},(_,i)=>runOne(id,operation,i+1,config)); }
if (process.argv.includes('--calibrate-poor')) {
  for(let scale=1;scale<=4.01;scale+=.1) {
    const config=structuredClone(plan);
    config.operations.poor.coalSigma=Number((plan.operations.poor.coalSigma*scale).toFixed(5));
    config.operations.poor.temperatureSigma=Number((plan.operations.poor.temperatureSigma*scale).toFixed(5));
    const wins=rowsFor('C1','poor',config).filter(x=>x.rank===1).length;
    console.log(JSON.stringify({scale:Number(scale.toFixed(2)),wins}));
  }
} else if (process.argv.includes('--calibrate')) {
  for(let scale=.5;scale<=2.001;scale+=.025) {
    const config=structuredClone(plan);
    config.operations.mid.coalSigma=Number((plan.operations.mid.coalSigma*scale).toFixed(5));
    config.operations.mid.temperatureSigma=Number((plan.operations.mid.temperatureSigma*scale).toFixed(5));
    const wins=rowsFor('C1','mid',config).filter(x=>x.rank===1).length;
    if(wins>=730&&wins<=755) console.log(JSON.stringify({scale:Number(scale.toFixed(3)),wins,coalSigma:config.operations.mid.coalSigma,temperatureSigma:config.operations.mid.temperatureSigma}));
  }
} else {
  const selected=process.argv.includes('--star')?['C2','C3']:['C1','C2','C3','C4','C3cap4'];
  const all=[];
  for(const id of selected) for(const operation of ['poor','mid','perfect']) {
    const rows=rowsFor(id,operation), again=rowsFor(id,operation);
    assert.deepEqual(again,rows,`repeat ${id}/${operation}`);
    all.push({id,operation,n:rows.length,wins:rows.filter(x=>x.rank===1).length,sha256:sha(rows),repeatSha256:sha(again)});
  }
  console.log(JSON.stringify({tierMode:mode,model:'gaussian-input-approximation; legacy-stats-only; no growth-board acceptance',planSha256:sha(fs.readFileSync(new URL('plan.json',root))),rows:all}));
}
