import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.document = { addEventListener() {} }; globalThis.window = {};
const stored = new Map();
globalThis.localStorage = { getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k) };
const core = await import("../js/core/state.js"), growth = await import("../js/core/growth.js");
const { DB } = await import("../js/core/data.js");
const { NARU_FINISH, startNaruFinish, naruFinishRange, inNaruFinishRange, naruFinishGuide, recordNaruFinish, naruFinishBonus } = await import("../js/core/naru-finish.js");
const { noteGrowthCraftOwner } = await import("../js/core/growth-memory.js");
const { temperatureBands, EQUIP_WIDTH_FACTORS } = await import("../js/craft/temperature-model.js");
const { pullResult } = await import("../js/craft/conditions.js");
const { finalize, bonusOf } = await import("../js/craft/score.js");
DB.flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json",import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(DB.flavors.map(f=>[f.id,f]));
DB.equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json",import.meta.url))).equipment;
DB.equipById = Object.fromEntries(DB.equipment.map(e=>[e.id,e]));
core.newGame(); growth.setGrowthPreview(true); growth.ensureGrowth();
function fixture(mix={vanilla:12}, equip={}, dmg=0, chapter=3, skipped=false) {
 return { mode:"tournament", chapter, mix, equip, leaf:{hp:5,max:5,burn:0,dmg,steps:0}, pack:"normal", place:"three", steamSeconds:360,
 holes:{total:22,evenness:1,outerEven:1,innerExcess:0,score:90,skipped},
 heat:{heatPower:80,heatStability:90,burnRisk:10,aromaRetention:90,score:90},
 mixInfo:{score:90,intensity:5,total:12},steam:{score:90},careHistory:[{score:90},{score:90}] };
}
function serve(cs,temp,learned=true,automatic=false) {
 startNaruFinish(cs,learned); cs.pull={temp,pulls:3,justs:0,...pullResult(temp,3,0,temperatureBands(cs))}; cs.pullDone=true;
 recordNaruFinish(cs,temperatureBands(cs),{automatic}); return cs;
}
const bands=temperatureBands(fixture()),range=naruFinishRange(bands);
assert(range && range.low>bands.center && range.high<bands.optimal[1]);
for (const [temp,hit] of [[range.low,true],[range.high,true],[(range.low+range.high)/2,true],[range.low-1e-6,false],[range.high+1e-6,false],[bands.center,false],[bands.ideal[1],false]]) {
 const cs=serve(fixture(),temp); assert.equal(naruFinishBonus(cs),hit?.5:0); assert.equal(cs.pull.temp,temp);
 const saved=JSON.parse(JSON.stringify(cs)); assert.equal(naruFinishBonus(saved),hit?.5:0);
 const record=JSON.stringify(cs.naruFinish); cs.pull.temp=range.low; recordNaruFinish(cs,bands); assert.equal(JSON.stringify(cs.naruFinish),record,"cannot reroll a served cup");
}
for (const mode of ["tutorial","drill"]) { const cs=fixture();cs.mode=mode;serve(cs,range.low);assert.equal(naruFinishBonus(cs),0);assert(!naruFinishGuide(cs)); }
for (const automatic of [true,false]) { const cs=serve(fixture(),range.low,false,automatic);assert.equal(naruFinishBonus(cs),0);startNaruFinish(cs,true);assert.equal(cs.naruFinish.learned,false,"mid-cup lesson gain is not retroactive"); }
assert.equal(naruFinishBonus(serve(fixture(),range.low,true,true)),0);
for (const field of ["failed","pull"]) { const cs=serve(fixture(),range.low);if(field==="pull")cs.pull.failed=true;else cs.failed=true;assert.equal(naruFinishBonus(cs),0); }
const passing=fixture();startNaruFinish(passing,true);passing.pull={temp:range.low,score:95};assert.equal(recordNaruFinish(passing,bands),false,"passing through or prediction does not award before serve");
for(const value of [null,{},[],{optimal:[NaN,.6],ideal:[.4,.7]},{optimal:[.8,1],ideal:[.7,1]}])assert.equal(naruFinishRange(value),null);
for(const value of [null,{}, {mode:"tournament",pullDone:true,naruFinish:{version:1,learned:true,recorded:true,hit:true,bonus:.5,low:"x",high:.6,temp:.58}}])assert.equal(naruFinishBonus(value),0);
// Existing M-W3 ownership upgrades without another purchase/read; missing record on a completed old cup awards nothing.
core.state.growth.nodes=["M-W3"];core.state.growth.learned=["M-W3"];
const owned=fixture();noteGrowthCraftOwner(owned,core.state);assert.equal(owned.naruFinish.learned,true);
const old=fixture();old.pullDone=true;old.pull={temp:range.low,score:95};assert.equal(naruFinishBonus(old),0);
const saved=serve(fixture(),range.low);core.state.flags._naruFinishTest=saved;core.save();core.load();
assert.equal(naruFinishBonus(core.state.flags._naruFinishTest),.5);
const beforeRecord=JSON.stringify(saved.naruFinish);saved.leaf.dmg=10;saved.careHistory[0].temp=.2;
assert.equal(naruFinishBonus(saved),.5);assert.equal(JSON.stringify(saved.naruFinish),beforeRecord,"later care cannot move the recorded target");
const enabledBonus=bonusOf(saved).bonus;
growth.setGrowthPreview(false);assert.equal(bonusOf(saved).bonus,enabledBonus-.5,"preview OFF disables the stored lesson bonus without deleting its record");
growth.setGrowthPreview(true);assert.equal(bonusOf(saved).bonus,enabledBonus);
const once=finalize(saved).total;assert.equal(finalize(saved).total,once);assert.equal(saved.bonusNotes.filter(n=>n.startsWith("焼き際の見極め")).length,1);
// Catalog + mixed recipes, all equipment width factors and damaged bands: actual rounded final score must not lose vs the old center target.
const equipment=[{}, ...Object.entries(EQUIP_WIDTH_FACTORS).flatMap(([type,values])=>Object.keys(values).map(id=>({[type]:id})))];
const mixes=[...DB.flavors.map(f=>({[f.id]:12})),{vanilla:6,mint:6},{nightside_earlgrey:6,dobaj_double_apple:6},{lemon:4,mint:4,vanilla:4}];
let cases=0,minDelta=Infinity,maxDelta=-Infinity;
for (const mix of mixes) for(const equip of equipment) for(const dmg of [0,6,12]) for(const [chapter,skipped] of [[1,false],[1,true],[3,true],[5,false]]) {
 const cs=fixture(mix,equip,dmg,chapter,skipped),b=temperatureBands(cs),r=naruFinishRange(b);
 assert(r,"every current flavor/equipment/damage configuration has a safe guide");
 for(const temp of [r.low,(r.low+r.high)/2,r.high]) {
  const center=serve(structuredClone(cs),b.center,false), upper=serve(structuredClone(cs),temp);
  const delta=finalize(upper).total-finalize(center).total;
  assert(delta>=-1e-9,JSON.stringify({mix,equip,dmg,chapter,skipped,temp,delta}));
  minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);cases++;
 }
}
assert.equal(NARU_FINISH.bonus,.5); assert.equal(bonusOf(serve(fixture(),range.low)).notes.filter(n=>n.startsWith("焼き際")).length,1);
console.log(`Naru finish: ${DB.flavors.length} flavors, ${cases} actual-score cases, net delta ${minDelta.toFixed(1)}..${maxDelta.toFixed(1)}; boundaries, save/load, snapshot, no reroll PASS`);
