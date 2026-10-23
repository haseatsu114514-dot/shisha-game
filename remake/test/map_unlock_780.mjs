// Production modules in a synthetic DOM. No real save, browser or asset download.
// node --experimental-vm-modules remake/test/map_unlock_780.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const state = {}, DB = { dialogues: {} }, played = [];
let cancelled = false, shown, timers = new Map(), clock = 0, nextTimer = 0;
const schedule = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms }); return id; };
const cancel = id => timers.delete(id);
function tick(ms) { const end = clock + ms; for (;;) { const task = [...timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0]; if (!task) break; clock = task[1].at; timers.delete(task[0]); task[1].fn(); } clock = end; }
class Node {
  constructor(spec, attrs = {}, children = []) {
    this.classes = new Set(spec.split('.').slice(1)); this.children = []; this.dataset = attrs.dataset || {}; this.attrs = {}; this.isConnected = true;
    this.style = { setProperty(k,v) { this[k] = v; } }; this.classList = { add: (...xs) => xs.forEach(x=>this.classes.add(x)), remove: (...xs)=>xs.forEach(x=>this.classes.delete(x)), contains:x=>this.classes.has(x), toggle:(x,on)=>on ? this.classes.add(x) : this.classes.delete(x) };
    const style=this.style; Object.assign(this, attrs); this.style=Object.assign(style,attrs.style||{}); if (Array.isArray(attrs)) children = attrs; this.append(...children);
  }
  append(...xs) { for (const x of xs.filter(Boolean)) { this.children.push(x); x.parent = this; } }
  replaceChildren(...xs) { this.children = []; this.append(...xs); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x=>x!==this); this.isConnected = false; }
  contains(n) { return this===n || this.children.some(x=>x.contains(n)); }
  setAttribute(k,v) { this.attrs[k]=v; } getAttribute(k) { return this.attrs[k]; } removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {}
  querySelectorAll(selector) { const out=[]; const matches = n => selector.split(',').some(s=> {s=s.trim(); return s.startsWith('.') && n.classes.has(s.slice(1));}); const walk=n=>{for(const c of n.children){if(matches(c))out.push(c);walk(c);}}; walk(this); return out; }
  querySelector(s) { if (s.includes('[data-spot=')) { const id=s.match(/data-spot="([^"]+)"/)[1]; const p=this.querySelectorAll('.spot-pin').find(n=>n.dataset.spot===id); return p?.querySelector('.shield'); } return this.querySelectorAll(s)[0] || null; }
}
const el=(spec, attrs={}, children=[]) => new Node(spec,attrs,children);
const noop=()=>{};
const overrides = {
 'state.js': { state, timeOfDay:()=>state.slot ? 'night':'day', markMet:id=>{state.met[id]=true;} },
 'data.js': { DB, bgUrl:x=>x, sceneBg:()=>({}), displayName:id=>id, faceIconUrl:()=>null },
 'util.js': { el, yen:String }, 'ui.js': { layers:{fx:el('div')}, uiArtReady:noop, imageReady:async()=>true, setBg:async()=>{}, showScreen:(_name,root)=>{shown=root;}, retire:root=>root.classList.add('done') },
 'stats.js': { affinityLevel:()=>0, earnStat:noop, gainAffinity:noop, STAMINA_LOW:20 },
 'engine.js': { play:async id=>{played.push(id);return {cancelled:cancelled && id==='ch1_naru_cafe_intro'};} },
 'bonds.js': { questionVisitDue:()=>false, finaleAtVisit:()=>false }, 'weather.js':{isRainy:()=>false},
 'samechan.js':{samechanSpot:()=>null}, 'trpg.js':{trpgSpot:()=>null}, 'spot-encounters.js':{spotFollowupDue:()=>null},
 'home-rig.js':{homeRig:()=>null}, 'street.js':{canWalkStreet:()=>true}, 'spot-people.js':{spotPeople:()=>[]},
 'store-logos.js':{hasStoreLogo:()=>false}, 'facility-icons.js':{createMapFacilityIcon:()=>null,hasFacilityIcon:()=>false,FACILITY_SHEET:'facility-sheet'},
 'fortune.js':{fortuneToday:()=>[3,6].includes(state.day % 7)}, 'scene-art.js':{sceneArtUrls:()=>[]}, 'audio.js':{SE:{click:noop,select:noop}},
};
const real = new Set(['map.js','spots.js','spot-access.js','spot-hours.js','map-reveals.js','axe-bar-data.js','axe-bar-discovery.js']);
const context=vm.createContext({console,setTimeout:schedule,clearTimeout:cancel,document:{getElementById:()=>null},globalThis:{}});
const modules=new Map(), sources=new Map(), exportsNeeded=new Map();
for (const name of real) {
 const folder=name==='axe-bar-discovery.js'?'core':'daily';
 const source=await fs.readFile(new URL(`../js/${folder}/${name}`,import.meta.url),'utf8');sources.set(name,source);
 for(const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
  const dep=m[2].split('/').at(-1), names=exportsNeeded.get(dep)||new Set();
  m[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0]).forEach(n=>names.add(n));exportsNeeded.set(dep,names);
 }
}
function load(name) {
 if(modules.has(name))return modules.get(name);
 const names=[...(exportsNeeded.get(name)||[])], values=overrides[name]||{};
 const mod=real.has(name) ? new vm.SourceTextModule(sources.get(name),{context,identifier:name})
  : new vm.SyntheticModule(names,function(){for(const key of names)this.setExport(key,key in values?values[key]:noop);},{context,identifier:name});
 modules.set(name,mod);return mod;
}
const mapMod=load('map.js');await mapMod.link(spec=>load(spec.split('/').at(-1)));await mapMod.evaluate();
const map=mapMod.namespace, spots=modules.get('spots.js').namespace, access=modules.get('spot-access.js').namespace, reveals=modules.get('map-reveals.js').namespace;
function reset(extra={}) {for(const k of Object.keys(state))delete state[k];Object.assign(state,{chapter:1,day:2,slot:0,phase:'daily',flags:{},story:{},met:{},visits:{},visitedDay:{},spotVisits:{},contacts:[],money:30000,stamina:100},extra);played.length=0;cancelled=false;}
const cafe=spots.spotById('cafe'), axe=spots.spotById('axe_bar');
reset({story:{naru:2},flags:{_spot_guide_naru:true}});
assert.equal(spots.isUnlocked(cafe),false,'count/autonomous visit is not an introduction');
assert.equal(access.spotVisible(cafe),false);assert.equal(access.spotAvailability(cafe).why,'locked');
DB.dialogues.ch1_naru_cafe_intro={lines:[{}]};
await spots.visitChar('naru');assert(played.includes('ch1_naru_cafe_intro'));assert(spots.isUnlocked(cafe));
assert(access.spotVisible(cafe));assert(access.spotAvailability(cafe).ok);
played.length=0;await spots.visitChar('naru');assert(!played.includes('ch1_naru_cafe_intro'),'one-time intro');
reset({story:{naru:2}});cancelled=true;await spots.visitChar('naru');assert(!spots.isUnlocked(cafe),'cancel does not unlock');
reset({spotVisits:{cafe:1}});assert(spots.isUnlocked(cafe),'legacy actual visit survives');
reset();assert(!access.spotVisible(axe));state.flags._axe_bar_rumor_done=true;assert(access.spotVisible(axe));
assert.equal(spots.spotDetailLabel(spots.spotById('minto')),'PEPPERMINT（シーシャ屋）');assert.equal(spots.spotDetailLabel(spots.spotById('shop')),'Dr.fookah（ショップ）');
const history={};assert.equal(reveals.newlyRevealedSpots(history,'osu',[]).length,0);assert.equal(reveals.newlyRevealedSpots(history,'osu',[{id:'cafe',revealed:true}])[0],'cafe');assert.equal(reveals.newlyRevealedSpots(history,'osu',[{id:'cafe',revealed:true}]).length,0);assert.equal(reveals.newlyRevealedSpots({},'osu',[{id:'cafe',revealed:true}]).length,0,'loaded save baseline');
reset();const options={regions:[{id:'test',spots:()=>[cafe,axe,spots.spotById('rest')]}]};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
let flow=map.chooseSpot(options);await flush();assert(shown);assert(!shown.querySelectorAll('.spot-pin').some(n=>n.dataset.spot==='axe_bar'));map.interruptMap(null);await flow;
state.flags._cafe_introduced=true;const saved=JSON.stringify(state);flow=map.chooseSpot(options);await flush();
assert.equal(shown.dataset.revealing,'true');let pin=shown.querySelectorAll('.spot-pin').find(n=>n.dataset.spot==='cafe');assert.equal(pin.style.visibility,'hidden');pin.onclick();assert(!pin.classList.contains('sel'));
tick(649);assert.equal(pin.style.visibility,'hidden');tick(1);assert(pin.classList.contains('newly-revealed'));assert(shown.children.some(n=>n.textContent?.includes('なるから聞いた喫茶こはく')));pin.onclick();assert(!pin.classList.contains('sel'));
tick(1800);assert.equal(shown.dataset.revealing,undefined);pin.onclick();assert(pin.classList.contains('sel'));assert.equal(JSON.stringify(state),saved);map.interruptMap(null);await flow;
state.flags._axe_bar_rumor_done=true;flow=map.chooseSpot(options);await flush();assert.equal(shown.dataset.revealing,'true');map.interruptMap('__lime__');assert.equal(await flow,'__lime__');assert.equal(shown.dataset.revealing,undefined);tick(5000);assert.equal(shown.querySelectorAll('.newly-revealed').length,0,'interrupt removes timers/art');
console.log('PASS #780: production intro/legacy/access/detail/history/delayed pop/input lock/normal and interrupt cleanup; synthetic state only');
