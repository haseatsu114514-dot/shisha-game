// Geometry-only fixture. No game startup, assets, network, or browser installation.
// Run from the snapshot/repo root: node docs/qa/cutin-fit-772/fixture.mjs
import { readFile, writeFile } from 'node:fs/promises';
const cssPaths = ['base.css', 'vn.css', 'game-ds.css', 'intro.css'];
const css = (await Promise.all(cssPaths.map(p => readFile(`remake/css/${p}`, 'utf8'))))
  .join('\n').replace(/@font-face\s*\{[^}]*\}/g, ''); // Product fonts unavailable; never fetch substitutes.
const art = (await readFile('remake/js/vn/intro-art.js', 'utf8'))
  .replace(/^import .*;\s*$/m, '').replace(/export function /g, 'function ');
const fit = (await readFile('remake/js/vn/intro-fit.js', 'utf8')).replace(/export function /g, 'function ');
const introSource = (await readFile('remake/js/vn/intro.js', 'utf8')).replace(/^import .*;\s*$/gm, '').replace(/export /g, '');
const output = process.argv[2] || '/tmp/cutin772-after.html';
const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="680"><rect width="400" height="680" fill="#7499ad"/><circle cx="200" cy="100" r="65" fill="#ffe0ad"/><text x="60" y="400" font-size="32">GEOMETRY ONLY</text></svg>');
await writeFile(output, `<!doctype html><meta charset="utf-8"><title>772 geometry fixture only</title>
<style>${css}
html,body{margin:0;width:100%;height:100%}#viewport{background:#ff00ff}
#report{position:fixed;z-index:2000;top:0;left:0;color:white;background:#000;font:12px monospace;max-width:100%;white-space:pre-wrap;pointer-events:none}
.cutin,.cutin *{transition:none!important}.ci-portrait{filter:none}
</style><div id="viewport"><div id="stage"><div id="fx"></div></div></div><pre id="report"></pre>
<script>
function el(selector, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const [tag, ...classes] = selector.split('.'), node = document.createElement(tag);
  node.classList.add(...classes);
  for (const [key,value] of Object.entries(attrs)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value);
  }
  node.append(...children); return node;
}
${art}
${fit}
${introSource}
const introData = {title:'ダブルアップルの伝道師',line:'煙は二種類。ダブルアップルと、それ以外だ',face:'normal'};
// Synthetic frame only: NOT the adopted portrait's manifest or pixels.
const artData = {color:'#b53e45',secondary:'#8ac56e',shadow:'#0a3020',frames:{normal:{width:400,left:80,top:40}}};
const background = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#243741"/><path d="M0 0H1280V720H0Z" stroke="#ffec00" stroke-width="10" fill="none"/></svg>');
// Exercise real playIntro with mock data/audio/state and virtual sleep; never boot the game.
const DB = {characters:{adam:{intro_cutin:introData}},manifest:{introArt:{adam:artData}}};
artData.background = background;
const state = {flags:{}}, layers = {fx:document.querySelector('#fx')};
const displayName = ()=>'アダム', img = value=>value;
const portraitInfo = ()=>({face:'normal',src:${JSON.stringify(svg)},folder:'pakki',h:1,b:0,ax:.5});
const imageReady = ()=>Promise.resolve(), motifs = {duality:''};
const SE = {select(){}};
// Reduced-motion branch uses the product function and creates no animation handles.
window.matchMedia = ()=>({matches:true});
const pendingSleeps=[];
const sleep=ms=>ms===30 ? Promise.resolve() : new Promise(resolve=>pendingSleeps.push({ms,resolve}));
window.fixtureSleepDurations=[];
const initialFxChildren = [...layers.fx.childNodes];
window.fixtureSeen = [];
// Match the existing intro_art.mjs contract: added direct children only.
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node.classList?.contains('cutin')) window.fixtureSeen.push({char:node.dataset.char,art:node.classList.contains('art-intro')});
}))).observe(layers.fx, {childList:true});
let playback = playIntro('adam');
window.finishIntro=async()=>{
  for(let i=0;i<6 && document.querySelector('.cutin');i++){
    for(const item of pendingSleeps.splice(0)){window.fixtureSleepDurations.push(item.ms);item.resolve();}
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  await playback;
  return {surfaces:document.querySelectorAll('.intro-fit-surface').length,hosts:document.querySelectorAll('.cutin').length,domRestored:layers.fx.childNodes.length===initialFxChildren.length && initialFxChildren.every((node,i)=>layers.fx.childNodes[i]===node),seen:window.fixtureSeen.slice(),sleeps:window.fixtureSleepDurations};
};
window.startFallback=async()=>{DB.manifest.introArt={};playback=playIntro('adam');await new Promise(resolve=>setTimeout(resolve,0));measure();return window.cutin772Result;};
// One failure-injection case, after normal art/fallback checks; no new viewport.
window.checkMountRollback=()=>{
  const before=[...layers.fx.childNodes], NativeObserver=window.ResizeObserver;
  const proto=EventTarget.prototype, add=proto.addEventListener, remove=proto.removeEventListener;
  const active=[], targets=new Set(), sentinel=new Error('fixture observe failure'),host=el('div.cutin');
  let registrations=0,disconnected=0,caught;
  proto.addEventListener=function(type,listener,options){
    if(this===host || this.classList?.contains('intro-fit-surface')){
      active.push({target:this,type,listener});targets.add(this);registrations++;
    }
    return add.call(this,type,listener,options);
  };
  proto.removeEventListener=function(type,listener,options){
    const i=active.findIndex(item=>item.target===this&&item.type===type&&item.listener===listener);
    if(i>=0)active.splice(i,1);
    return remove.call(this,type,listener,options);
  };
  window.ResizeObserver=class {observe(){throw sentinel;}disconnect(){disconnected++;}};
  try {mountIntro(host,layers.fx);}catch(error){caught=error;}
  finally {window.ResizeObserver=NativeObserver;proto.addEventListener=add;proto.removeEventListener=remove;}
  const eventsUnblocked=[...targets].every(target=>['pointerdown','pointerup','click','dblclick','contextmenu','wheel'].every(type=>{
    const event=new Event(type,{bubbles:true,cancelable:true});target.dispatchEvent(event);return !event.defaultPrevented;
  }));
  return {sameError:caught===sentinel,domRestored:layers.fx.childNodes.length===before.length&&before.every((node,i)=>layers.fx.childNodes[i]===node),activeListeners:active.length,registrations,disconnected,eventsUnblocked};
};
window.fixtureInputCount=0;
for(const type of ['pointerdown','pointerup','click','wheel','keydown'])window.addEventListener(type,()=>window.fixtureInputCount++);

const mode = new URLSearchParams(location.search).get('mode') || 'normal';
document.body.classList.toggle('game-ds', mode === 'ds');
function measure() {
  const stage = document.querySelector('#stage'); stage.style.setProperty('--k',Math.min(innerWidth/1280,innerHeight/720));
  const rect = node => { const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}; };
  const host=document.querySelector('.cutin'); if(!host)return;
  const boundary = rect(stage);
  const surface=host.previousElementSibling;
  if(!surface?.classList.contains('intro-fit-surface'))throw new Error('missing backdrop sibling');
  const elements = Object.fromEntries(['.ci-name','.ci-title','.ci-line','.ci-portrait','.ci-art-background'].map(selector=>{
    const node=host.querySelector(selector); if(!node)return [selector,null];
    const box=rect(node); return [selector,{...box,withinStage:box.x>=boundary.x-1&&box.y>=boundary.y-1&&box.right<=boundary.right+1&&box.bottom<=boundary.bottom+1}];
  }));
  window.cutin772Result = {kind:'synthetic geometry only',mode,viewport:[innerWidth,innerHeight],stage:boundary,host:rect(host),surface:rect(surface),surfaceBackground:getComputedStyle(surface).backgroundColor,art:host.classList.contains('art-intro'),directChild:host.parentNode===layers.fx,seen:window.fixtureSeen.slice(),elements};
  document.querySelector('#report').textContent=JSON.stringify(window.cutin772Result,null,2);
}
addEventListener('resize',measure);document.fonts.ready.then(async()=>{await new Promise(resolve=>setTimeout(resolve,0));await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));measure();});
</script>`);
console.log(`Wrote ${output}; browser execution is a separate, unperformed check.`);
