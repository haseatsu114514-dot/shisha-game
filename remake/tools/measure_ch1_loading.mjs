// Runs the unchanged repository playthrough with external observation only.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(new URL('../../',import.meta.url).pathname);
const out=path.resolve(process.env.AUDIT_DIR||'.codex/artifacts/ch1-loading/chapter');
await fs.mkdir(out,{recursive:true});
const mobile=process.env.MOBILE==='1';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
const observations=[];const requests=[];const errors=[];let page;
const launchOriginal=chromium.launch;
chromium.launch=async()=>{
 const facade=new Proxy(browser,{get(target,key){
  if(key==='close')return async()=>{};
  if(key==='newPage')return async()=>{
   page=await context.newPage();
   await page.exposeBinding('__recordLoadingAudit',(_,event)=>observations.push(event));
   await page.addInitScript(()=>{
    if(window.top!==window)return;
    const emit=value=>window.__recordLoadingAudit({...value,at:performance.now(),origin:performance.timeOrigin}).catch(()=>{});
    const state=()=>{const s=window.__remake?.state;return {day:s?.day,slot:s?.slot,phase:s?.phase,screen:document.body?.dataset.screen,dialogue:window.__auditDialogue||null};};
    const srcSet=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    Object.defineProperty(HTMLImageElement.prototype,'src',{...srcSet,set(value){emit({type:'image-src',url:new URL(value,location.href).href,...state()});return srcSet.set.call(this,value);}});
    const originalDecode=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=function(...args){const start=performance.now(),url=this.src;return originalDecode.apply(this,args).then(v=>{emit({type:'decode',url,start,duration:performance.now()-start,ok:true,...state()});return v;},e=>{emit({type:'decode',url,start,duration:performance.now()-start,ok:false,...state()});throw e;});};
    new PerformanceObserver(list=>{for(const e of list.getEntries())emit({type:'longtask',start:e.startTime,duration:e.duration,...state()});}).observe({type:'longtask',buffered:true});
    const tracked=new Map();
    const selectors='#boot:not(.done),.vn-loading,.craft-loading,.preview-loading,.scene-curtain,.store-arrival';
    const observe=()=>{
     for(const n of document.querySelectorAll(selectors))if(!tracked.has(n)){
      const css=getComputedStyle(n),r=n.getBoundingClientRect();
      if(!n.hidden&&css.display!=='none'&&css.visibility!=='hidden'&&r.width&&r.height){const info={type:'overlay',class:n.className,id:n.id,test:n.dataset.test,text:n.textContent,start:performance.now(),...state()};tracked.set(n,info);emit({...info,type:'overlay-start'});}
     }
     for(const [n,info] of tracked)if(!n.isConnected||n.hidden||getComputedStyle(n).display==='none'||(n.id==='boot'&&n.classList.contains('done'))){emit({...info,end:performance.now(),duration:performance.now()-info.start});tracked.delete(n);}
    };
    window.addEventListener('DOMContentLoaded',async()=>{
     new MutationObserver(observe).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style','data-screen']});observe();
     const {hooks}=await import('./js/vn/engine.js');const prev=hooks.onEnter;
     hooks.onEnter=(id,dlg)=>{window.__auditDialogue=id;emit({type:'dialogue-enter',id,...state()});prev?.(id,dlg);};
    });
   });
   const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
   const map=new Map();
   cdp.on('Network.requestWillBeSent',e=>{if(!/^https?:/.test(e.request.url))return;const r={id:e.requestId,url:e.request.url,start:e.timestamp,wall:e.wallTime,kind:e.type};requests.push(r);map.set(e.requestId,r);});
   cdp.on('Network.responseReceived',e=>{const r=map.get(e.requestId);if(r)Object.assign(r,{status:e.response.status,cached:e.response.fromDiskCache||e.response.fromServiceWorker,timing:e.response.timing});});
   cdp.on('Network.requestServedFromCache',e=>{const r=map.get(e.requestId);if(r)r.cached=true;});
   cdp.on('Network.loadingFinished',e=>{const r=map.get(e.requestId);if(r)Object.assign(r,{end:e.timestamp,bytes:e.encodedDataLength});});
   cdp.on('Network.loadingFailed',e=>{const r=map.get(e.requestId);if(r)Object.assign(r,{end:e.timestamp,error:e.errorText});});
   page.on('pageerror',e=>errors.push(e.message));
   return page;
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});return facade;
};
let passed=false,failure=null;
try {await import(pathToFileURL(path.join(root,'remake/test/playthrough.mjs')).href);passed=true;}
catch(e){failure=e.stack;console.error(e);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{
 const state=await page?.evaluate(()=>window.__remake?.state).catch(()=>null);
 await fs.writeFile(path.join(out,'measurement.json'),JSON.stringify({at:new Date().toISOString(),base:process.env.BASE_URL,mobile,passed,failure,errors,browser:browser.version(),state,observations,requests},null,2));
 console.log('AUDIT',JSON.stringify({passed,out,overlays:observations.filter(x=>x.type==='overlay').reduce((a,x)=>{const key=x.test||x.id||x.class;const s=a[key]||={count:0,ms:0};s.count++;s.ms+=x.duration;return a;},{}),requests:requests.length,errors}));
 chromium.launch=launchOriginal;await browser.close();
}
if(!passed)process.exitCode=1;
