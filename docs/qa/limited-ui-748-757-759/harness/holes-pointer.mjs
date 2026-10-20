import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('work/qa-real/holes-qa/pointer-input');await mkdir(out,{recursive:true});
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:58562';
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server','--disable-domain-reliability','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',`--user-data-dir=${out}/chrome-profile`,'--remote-debugging-pipe'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let seq=0,buf='',session;const pending=new Map(),network=[],blocked=[],results=[];
function send(method,params={},sessionId=session){return new Promise((resolve,reject)=>{let id=++seq;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');});}
chrome.stdio[4].on('data',c=>{buf+=c;let n;while((n=buf.indexOf('\0'))>=0){const m=JSON.parse(buf.slice(0,n));buf=buf.slice(n+1);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Fetch.requestPaused'){const u=m.params.request.url;let allowed=u.startsWith(origin+'/')||u.startsWith('data:')||u.startsWith('blob:'+origin);if(!allowed)blocked.push(u);send(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(allowed?{}:{errorReason:'BlockedByClient'})},m.sessionId).catch(()=>{});}else if(m.method==='Network.responseReceived')network.push({url:m.params.response.url,status:m.params.response.status});}});
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function click(sel){const r=await ev(`(()=>{let r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',clickCount:1});}
async function key(key,code=key){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});}
async function sample(name){const s=await ev('H.sample()');results.at(-1).phases.push({name,...s});console.log(name,JSON.stringify(s));return s;}
async function shot(name){const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(`${out}/${name}.png`,Buffer.from(data,'base64'));}
try{
const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
for(const [label,width,height,mobile] of [['pc',1920,1080,false],['landscape844',844,390,true]]){
 results.push({label,width,height,mobile,phases:[]});await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await send('Page.navigate',{url:origin+'/757/remake/qa-holes.html'});
 await ev(`(async()=>{for(let i=0;i<500&&!window.H;i++)await new Promise(r=>setTimeout(r,20));if(!window.H)throw Error('H missing');await H.ready;await H.start()})()`);
 await ev(`(async()=>{for(let i=0;i<500&&!document.querySelector('[data-test=hole-start]');i++)await new Promise(r=>setTimeout(r,20));})()`);
 results.at(-1).template=await ev(`({options:[...document.querySelectorAll('.ht-option')].map(e=>({test:e.dataset.test,text:e.textContent})),counts:document.querySelector('.ht-counts')?.textContent})`);
 await click('[data-test="hole-template-outer12-middle12"]');await click('[data-test="hole-start"]');await sleep(4000);let s=await sample(label+'-initial-incomplete');assert.equal(s.punchDisabled,false);await shot(label+'-time0');
 for(let ring=0;ring<2;ring++){
  for(let count=0;count<12;count++){await ev('H.nearNext()');if(mobile){const p=await ev(`(()=>{let r=document.querySelector('[data-test=hole-punch]').getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await click('[data-test="hole-punch"]');}
  s=await sample(label+'-ring'+ring+'-complete');assert.equal(s.punchDisabled,true);
  if(!ring){assert.equal(s.nextDisabled,false);assert.match(s.plan,/次のリング/);await shot(label+'-ring-next');await click('[data-test="hole-next"]');await click('[data-test="hole-next"]');s=await sample(label+'-middle-start');assert.equal(s.punchDisabled,false);assert.equal(s.nextDisabled,true);}
 }
 assert.equal(s.doneDisabled,false);assert.match(s.plan,/結果を確認/);const count=s.visualHoles;await key(' ','Space');await key(' ','Space');assert.equal((await ev('H.sample()')).visualHoles,count);
 for(let i=0;i<12;i++){await key('Tab');if(await ev(`document.activeElement?.dataset.test==='hole-done'`))break;}
 results.at(-1).doneFocus=await ev(`({active:document.activeElement?.dataset.test,outline:getComputedStyle(document.activeElement).outlineWidth})`);await shot(label+'-all-complete');
 await click('[data-test="hole-done"]');await click('[data-test="hole-done"]');await sleep(650);s=await sample(label+'-result-before-confirm');assert.equal(s.resolutions,0);assert.equal(s.results,1);assert.equal(await ev(`document.querySelector('[data-test="step-next"]').textContent`),'確認して次の工程へ');await shot(label+'-results');
 for(let i=0;i<12;i++){await key('Tab');if(await ev(`document.activeElement?.dataset.test==='step-next'`))break;}
 results.at(-1).resultFocus=await ev(`({active:document.activeElement?.dataset.test,outline:getComputedStyle(document.activeElement).outlineWidth})`);await click('[data-test="step-next"]');await click('[data-test="step-next"]');await click('[data-test="step-next"]');await sleep(100);s=await sample(label+'-confirmed');assert.equal(s.resolutions,1);assert.deepEqual(s.errors,[]);
 results.at(-1).resources=await ev(`({fonts:document.fonts.status,fontFaces:[...document.fonts].map(f=>({family:f.family,status:f.status})),images:[...document.images].map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0}))})`);
}
console.log('PASS pointer/touch holes and triple result confirmation; isolated production module only');
}catch(e){results.push({error:String(e.stack)});console.error(e.stack);process.exitCode=1;}finally{await writeFile(`${out}/results.json`,JSON.stringify({head:'aeff796097f10d92df932d1bccd3f440910303ed',clock:'real wall clock; no virtual-time override',scope:'isolated production holes module; not chapter playthrough',results,blocked,network},null,2));await send('Browser.close',{},null).catch(()=>{});chrome.kill();}
