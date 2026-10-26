import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MASTERY_THRESHOLDS, gainFlavorExperience, learnFlavorStory, masteryLevel, masteryBonus, staffFlavors, staffStock, spendPracticeMix } from '../js/core/flavor-mastery.js';
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const { DB } = await import('../js/core/data.js');
const flavors = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json',import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f=>[f.id,f]));
DB.recipes=[]; DB.ngMixes=[];
const { addStamina } = await import('../js/core/stats.js');
const { SPOTS } = await import('../js/daily/spots.js');
const { applyHomeShisha } = await import('../js/daily/home-shisha.js');
const { regulationFor } = await import('../js/craft/steps.js');
let s=core.newGame();
assert.equal(masteryLevel(s,'lemon'),1);
for(let i=0;i<MASTERY_THRESHOLDS.length;i++){s.flavorMastery.lemon=MASTERY_THRESHOLDS[i];assert.equal(masteryLevel(s,'lemon'),i+1);}
s.flavorMastery={};
gainFlavorExperience(s,{lemon:9,mint:3},6,DB.flavorById);
assert.deepEqual(s.flavorMastery,{lemon:4.5,mint:1.5});
gainFlavorExperience(s,{dobaj_mint:12},6,DB.flavorById);assert.equal(masteryLevel(s,'mint'),2);
for(let i=0;i<30;i++)gainFlavorExperience(s,{lemon:12},6,DB.flavorById);
assert.equal(s.flavorMastery.lemon,66);assert.equal(masteryBonus(s,{lemon:12}),3);
assert.equal(masteryBonus(s,{lemon:1,orange:11}),.25,'tiny amount cannot confer full bonus');
const d={dialogue_id:'lesson',metadata:{flavor_lesson:{orange:1}}};
learnFlavorStory(s,d);learnFlavorStory(s,d);assert.equal(s.flavorMastery.orange,3);
learnFlavorStory(s,{dialogue_id:'ordinary'});assert.equal(s.flavorMastery.orange,3);
for(const file of fs.readdirSync(new URL('../../data/dialogue/',import.meta.url)).filter(f=>f.endsWith('.json'))){
 for(const dlg of JSON.parse(fs.readFileSync(new URL('../../data/dialogue/'+file,import.meta.url))).dialogues||[])
  for(const id of Object.keys(dlg.metadata?.flavor_lesson||{}))assert(DB.flavorById[id],`${file}/${dlg.dialogue_id}: unknown flavor ${id}`);
}
s.flavorStock={lemon:50};s.weatherSeed=0;
const [a,b]=staffFlavors(s);s.flavorStock[a]=20;s.flavorStock[b]=20;
assert.deepEqual(spendPracticeMix(s,{[a]:9,[b]:3}),{staff:{[a]:6,[b]:3},own:{[a]:3,[b]:0}});
assert.equal(s.flavorStock[a],17);assert.equal(staffStock(s,a),0);
const snapshot=structuredClone(s);assert.equal(spendPracticeMix(s,{[a]:100}),null);assert.deepEqual(s,snapshot);
core.save();s=core.load();assert.equal(staffStock(s,a),0);assert.deepEqual(s.flavorMastery,snapshot.flavorMastery);learnFlavorStory(s,d);assert.equal(s.flavorMastery.orange,3);
s.day++;assert.equal(staffStock(s,staffFlavors(s)[0]),6);
s=core.newGame();s.schema=20;s.flavorStock={mint:37};s.flavorMastery={lemon:Infinity,mint:-4};core.save();s=core.load();assert.deepEqual(s.flavorStock,{mint:37});assert.deepEqual(s.flavorMastery,{});
assert.equal(regulationFor({mode:'tournament'}).flavor,'lemon');assert.equal(regulationFor({mode:'tournament'}).supply,undefined);
s.schema=20;s.phase='tournament';core.save();s=core.load();assert.equal(regulationFor({mode:'tournament'}).flavor,'mint');
// Daily budgets at initial guts: light day +6, shisha day -18, light day with home -18.
const cafe=SPOTS.find(x=>x.id==='cafe'),temple=SPOTS.find(x=>x.id==='kannon'),shop=SPOTS.find(x=>x.id==='naru');
for(const [costs,delta] of [[[cafe.stamina,temple.stamina],6],[[shop.stamina,shop.stamina],-18],[[cafe.stamina,temple.stamina,-24],-18]]){
 s=core.newGame();s.stamina=70;for(const cost of costs)addStamina(cost);addStamina(14);assert.equal(s.stamina,70+delta);
}
s=core.newGame();s.flavorStock={lemon:50};s.stamina=80;
assert(applyHomeShisha({lemon:12},{id:'home_rig_set'},s));assert.equal(s.stamina,56);assert.equal(s.flavorStock.lemon,38);assert.equal(masteryLevel(s,'lemon'),2);
const once=structuredClone(s);assert.equal(applyHomeShisha({lemon:12},{id:'home_rig_set'},s),null);assert.deepEqual(s,once);
core.save();s=core.load();assert.equal(applyHomeShisha({lemon:12},{id:'home_rig_set'},s),null);
console.log('PASS mastery levels, weighting, lessons once, valid flavor data, private/staff stock, SAVE/LOAD, legacy tournament, daily budgets, home settlement once');
