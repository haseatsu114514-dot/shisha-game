import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
const tree=process.argv[2]||'.';
const resultFile=process.argv[3]||null;
async function fixture(options={}) {
 let now=0,seq=0;const timers=new Map(),rafs=new Map(),nodes=[],sounds=[];let mutations=0;
 class Target {
  constructor(){this.events=new Map()}
  addEventListener(t,fn){if(!this.events.has(t))this.events.set(t,new Set());this.events.get(t).add(fn)}
  removeEventListener(t,fn){this.events.get(t)?.delete(fn)}
  fire(t,extras={}){for(const fn of [...this.events.get(t)||[]])fn({button:0,pointerId:1,key:'',preventDefault(){},...extras})}
 }
 const context2d=new Proxy({}, {get(o,k){if(k in o)return o[k];if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});return()=>{}},set(o,k,v){o[k]=v;return true}});
 class Node extends Target {
  constructor(tag){super();this.tag=tag;this.dataset={};this.style={};this.children=[];this.parent=null;this.connected=false;this.hidden=false;this.disabled=false;this.clientWidth=640;this.clientHeight=480;nodes.push(this)}
  get isConnected(){return this.parent?this.parent.isConnected:this.connected}
  append(...children){for(const n of children){this.children.push(n);if(n&&typeof n==='object')n.parent=this}mutations++}
  replaceChildren(...children){this.children=[];this.append(...children)}
  setAttribute(k,v){this[k]=v}
  getBoundingClientRect(){return {width:640,height:480}}
  getContext(){return context2d}
 }
 const panel=new Node('panel');panel.connected=true;
 const win=new Target(),doc=new Target();doc.createElement=tag=>new Node(tag);doc.hidden=false;
 const abort=new Target();abort.aborted=!!options.preAborted;abort.abort=()=>{abort.aborted=true;abort.fire('abort')};
 const context=vm.createContext({console,document:doc,window:win,URL,DOMException,Float32Array,Math,Image:class{complete=false;naturalWidth=0},performance:{now:()=>now},devicePixelRatio:1,matchMedia:()=>({matches:false}),ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++seq;rafs.set(id,fn);return id},cancelAnimationFrame:id=>rafs.delete(id),setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,time:now+ms,ms});return id},clearTimeout:id=>timers.delete(id)});
 const root=path.resolve(tree+'/remake/js/craft');const cache=new Map();
 async function load(file){if(cache.has(file))return cache.get(file);const mod=file==='common.js'
  ? new vm.SyntheticModule(['timingLabel'],function(){this.setExport('timingLabel',kind=>({perfect:'EXCELLENT',great:'GOOD',good:'GOOD',miss:'MISS'}[kind]||''))},{context,identifier:file})
  : new vm.SourceTextModule(fs.readFileSync(path.join(root,file),'utf8'),{context,identifier:file,initializeImportMeta(meta){meta.url=new URL('file://'+path.join(root,file)).href}});cache.set(file,mod);await mod.link(s=>load(path.posix.normalize(path.posix.join(path.posix.dirname(file),s))));return mod}
 const mod=await load('water-pour-view.js');await mod.evaluate();
 const api=mod.namespace.mountWaterPour(panel,{random:()=>.5,endless:!!options.endless,signal:options.signal||options.preAborted?abort:undefined,sound:Object.fromEntries(['click','pour','perfect','miss','good','select'].map(k=>[k,()=>sounds.push(k)]))});
 const settled=[];api.result.then(v=>settled.push({kind:'resolve',value:JSON.parse(JSON.stringify(v))}),e=>settled.push({kind:'reject',name:e.name}));
 const flush=()=>Promise.resolve().then(()=>Promise.resolve());
 const advance=async ms=>{const end=now+ms;let count=0;while(true){const entries=[...timers].filter(([,v])=>v.time<=end).sort((a,b)=>a[1].time-b[1].time);if(!entries.length)break;assert(++count<1000,'timer runaway');const [id,t]=entries[0];timers.delete(id);now=t.time;t.fn();await flush()}now=end;await flush()};
 const frame=async delta=>{now+=delta;const pending=[...rafs];rafs.clear();for(const[,fn]of pending)fn(now);await flush()};
 const find=test=>nodes.find(n=>n.dataset.test===test);
 const mountAnother=()=>{const panel2=new Node('panel');panel2.connected=true;const sounds2=[],settled2=[];const api2=mod.namespace.mountWaterPour(panel2,{random:()=>.5,sound:Object.fromEntries(['click','pour','perfect','miss','good','select'].map(k=>[k,()=>sounds2.push(k)]))});api2.result.then(v=>settled2.push({kind:'resolve'}),e=>settled2.push({kind:'reject',name:e.name}));return {api:api2,sounds:sounds2,settled:settled2}};
 const ideal=()=>{const math=cache.get('water-pour.js').namespace;api.debug.volume=math.areaBelow(math.interior,api.debug.target)};
 return {api,panel,nodes,abort,sounds,settled,timers,rafs,find,frame,advance,flush,mountAnother,ideal,get mutations(){return mutations},listeners:()=>[win,doc,abort,...nodes].reduce((n,t)=>n+[...t.events.values()].reduce((k,s)=>k+s.size,0),0)};
}
const results=[];
async function check(name,fn){try{await fn();results.push({name,result:'PASS'})}catch(e){results.push({name,result:'FAIL',message:e.message});console.error(name,e.stack)}}
await check('normal success reveals at900ms and settles once',async()=>{const f=await fixture();f.ideal();f.api.decide();await f.advance(899);assert(f.find('pour-result').hidden);await f.advance(1);assert(!f.find('pour-result').hidden);assert.equal(f.settled.length,1);assert.equal(f.settled[0].kind,'resolve');assert.equal(f.settled[0].value.grade,'perfect');assert.deepEqual(f.sounds,['perfect']);assert.equal(f.sounds.length,1);f.api.decide();await f.advance(2000);assert.equal(f.sounds.length,1);f.api.cancel();});
await check('normal cancel/repeated cancel retains AbortError and cleans listeners',async()=>{const f=await fixture();f.api.cancel();f.api.cancel();await f.flush();await f.advance(2000);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.equal(f.timers.size,0);assert.equal(f.rafs.size,0);assert.equal(f.listeners(),0)});
await check('stale public decide after cancel is inert',async()=>{const f=await fixture();f.api.cancel();f.api.decide();await f.advance(1000);assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.equal(f.timers.size,0)});
await check('cancel during900ms reveal prevents late DOM/grade sound',async()=>{const f=await fixture();f.api.decide();assert.equal([...f.timers.values()][0].ms,900);f.api.cancel();await f.flush();const before=f.mutations;await f.advance(2000);console.log('OBSERVED reveal-cancel',JSON.stringify({hidden:f.find('pour-result').hidden,sounds:f.sounds,settled:f.settled,mutationsAfter:f.mutations-before}));assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.equal(f.mutations,before);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);});
await check('cancel during60ms settle wait cancels continuation',async()=>{const f=await fixture();f.find('pour-hold').fire('pointerdown');await f.frame(16);f.api.decide();assert.equal([...f.timers.values()][0].ms,60);f.api.cancel();const before=f.mutations;await f.advance(120);assert.equal(f.timers.size,0);assert.equal(f.mutations,before);assert(f.find('pour-result').hidden);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);});
await check('signal abort while waiting matches explicit cancel',async()=>{const f=await fixture({signal:true});f.api.decide();f.abort.abort();await f.advance(1000);assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);assert.equal(f.listeners(),0)});
await check('already aborted signal returns inert API with AbortError',async()=>{const f=await fixture({preAborted:true});await f.flush();f.api.decide();await f.advance(1000);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.equal(f.rafs.size,0);assert.equal(f.listeners(),0)});
await check('disconnection via RAF aborts pending reveal without late effects',async()=>{const f=await fixture();f.api.decide();f.panel.connected=false;await f.frame(16);await f.advance(1000);assert.deepEqual(f.settled,[{kind:'reject',name:'AbortError'}]);assert(f.find('pour-result').hidden);assert.deepEqual(f.sounds,[]);assert.equal(f.timers.size,0)});
await check('endless next resets and repeats reveal without replacing first result promise',async()=>{const f=await fixture({endless:true});const promise=f.api.result;f.api.decide();await f.advance(900);const first=f.settled[0];assert(!f.find('pour-next').hidden);f.find('pour-next').fire('click');assert(f.find('pour-result').hidden);assert(!f.find('pour-decide').disabled);f.api.decide();await f.advance(900);assert.equal(f.settled.length,1);assert.equal(f.settled[0],first);assert.equal(f.api.result,promise);assert.equal(f.sounds.filter(x=>x==='select').length,1);f.api.cancel();const before=f.sounds.length;f.find('pour-next').fire('click');f.api.decide();await f.advance(1000);assert.equal(f.sounds.length,before);});
await check('two independent mounts do not cross-cancel',async()=>{const a=await fixture(),b=a.mountAnother();a.api.decide();b.api.decide();a.api.cancel();await a.advance(900);assert.equal(a.settled[0].kind,'reject');assert.equal(b.settled[0].kind,'resolve');assert.deepEqual(a.sounds,[]);assert.equal(b.sounds.length,1);assert.equal(a.rafs.size,1);b.api.cancel();assert.equal(a.rafs.size,0)});
console.log(JSON.stringify({tree,scope:'actual exported mountWaterPour + actual water-pour math; controlled minimal DOM/canvas/events/RAF/clock/sound; no browser',results},null,2));if(resultFile)fs.writeFileSync(resultFile,JSON.stringify({tree,results},null,2));if(results.some(x=>x.result==='FAIL'))process.exitCode=1;
