import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
// Only task-owned temporary Chrome profiles; shared by normal and cleanup-only paths.
async function cleanupProfile(profilePath) {
 const profile=path.resolve(profilePath);
 if(!/^\/(?:private\/)?tmp\/cutin772-cdp-[A-Za-z0-9]+$/.test(profile))throw new Error('Expected a cutin772-cdp temporary profile');
 let info;
 try{info=await lstat(profile);}catch(error){if(error.code==='ENOENT')return {profile,alreadyAbsent:true};throw error;}
 if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid())throw new Error('Profile must be an owned temporary directory');
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 return {profile,removed:true};
}
if(process.argv[2]==='--cleanup-only'){
 if(process.argv.length!==4)throw new Error('Usage: --cleanup-only <owned-temporary-profile>');
 const result=await cleanupProfile(process.argv[3]);
 console.log(JSON.stringify({kind:'cleanup-only; no browser launch',...result}));
}else{
const out=process.argv[2]||'/tmp/cutin772-after-browser.json',html=process.argv[3]||'/tmp/cutin772-after.html';
const report=JSON.parse(await readFile(process.argv[4]||'docs/qa/cutin-fit-772/results.json','utf8'));
const baseline=report.before || report;
const near=(a,b,label)=>assert(Math.abs(a-b)<.12,label+': '+a+' != '+b);
function check(row){
 assert.equal(row.directChild,true,'cutin must remain an FX direct child');
 assert.deepEqual(row.seen,[{char:'adam',art:true}],'direct-child observer missed art intro');
 for(const key of ['x','y','width','height'])near(row.surface[key],row.stage[key],'surface '+key);
 for(const box of Object.values(row.elements).filter(Boolean))assert(box.withinStage,'art content clipped');
 for(const key of ['x','y','width','height'])near(row.elements['.ci-art-background'][key],row.host[key],'background '+key);
 near(row.host.width/row.host.height,1280/720,'aspect ratio');
 if(row.mode==='ds')assert.equal(row.surfaceBackground,'rgb(16, 24, 32)');
}
const profile=await mkdtemp('/tmp/cutin772-cdp-'),started=Date.now();
const child=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let n=0,buffer='';const pending=new Map();child.stderr.on('data',()=>{});
child.stdio[4].on('data',b=>{buffer+=b;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;const d=JSON.parse(raw),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(new Error(JSON.stringify(d.error))):p.resolve(d.result);}}});
function rpc(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});child.stdio[3].write(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}})+'\0');});}
child.on('exit',()=>{for(const p of pending.values())p.reject(new Error('Chrome exited before response'));pending.clear();});
const watchdog=setTimeout(()=>child.kill(),15000);
try{
 const version=await rpc('Browser.getVersion'),rows=[];
 for(const [width,height,mode] of [[1280,720,'normal'],[844,390,'normal'],[1280,800,'ds']]){
  const {targetId}=await rpc('Target.createTarget',{url:'about:blank'}),{sessionId}=await rpc('Target.attachToTarget',{targetId,flatten:true});
  await rpc('Page.enable',{},sessionId);await rpc('Network.enable',{},sessionId);await rpc('Network.setBlockedURLs',{urls:['http://*','https://*']},sessionId);
  await rpc('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
  await rpc('Page.navigate',{url:'file://'+path.resolve(html)+'?mode='+mode},sessionId);
  const res=await rpc('Runtime.evaluate',{expression:`(async()=>{const end=Date.now()+3000;while(!window.cutin772Result&&Date.now()<end)await new Promise(r=>setTimeout(r,10));await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));dispatchEvent(new Event('resize'));return window.cutin772Result;})()`,awaitPromise:true,returnByValue:true},sessionId);
  if(res.exceptionDetails||!res.result?.value)throw new Error(JSON.stringify(res));const row=res.result.value;check(row);
  if(mode==='normal'){
   const before=baseline.cases.find(r=>r.mode===mode&&r.viewport[0]===width);
   for(const [name,box] of Object.entries(row.elements))for(const key of ['x','y','width','height'])near(box[key],before.elements[name][key],name+' normal unchanged '+key);
   for(const key of ['x','y','width','height'])near(row.host[key],before.host[key],'normal host '+key);
  }
  // Send real mouse input into the outer gutter in DS, or composition in normal.
  const x=Math.round(row.stage.x+row.stage.width/2),y=Math.floor(row.stage.bottom-1);
  await rpc('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},sessionId);
  await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},sessionId);
  await rpc('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},sessionId);
  const evaluate=async expression=>{
   const r=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
   if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  assert.equal(await evaluate('window.fixtureInputCount'),0,'input leaked past intro');
  assert.equal(await evaluate('!!document.querySelector(".cutin.in:not(.out)")'),true,'input shortened intro');
  if(mode==='ds'){
   row.coverage=await evaluate(`(()=>{const s=document.querySelector('.intro-fit-surface'),b=s.getBoundingClientRect();const host=document.querySelector('.cutin');return [b.y+1,b.bottom-1].map(y=>{const hit=document.elementFromPoint(b.x+b.width/2,y);return s.contains(hit)||host.contains(hit);});})()`);
   assert(row.coverage.every(Boolean),'gutter hit testing uncovered');
   await rpc('Emulation.setDeviceMetricsOverride',{width:1200,height:800,deviceScaleFactor:1,mobile:false},sessionId);
   row.resize=await evaluate('(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));dispatchEvent(new Event("resize"));return window.cutin772Result;})()');
   check(row.resize);
  }
  row.cleanup=await evaluate('window.finishIntro()');
  assert.equal(row.cleanup.surfaces,0);assert.equal(row.cleanup.hosts,0);assert.equal(row.cleanup.domRestored,true,'art cleanup did not restore FX DOM');assert.deepEqual(row.cleanup.sleeps,[3600,280]);
  const afterCleanup=await evaluate(`(()=>{window.fixtureInputCount=0;window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return window.fixtureInputCount;})()`);
  assert.equal(afterCleanup,1,'intro key listener remained after cleanup');
  if(mode==='ds'){
   row.fallback=await evaluate('window.startFallback()');
   assert.equal(row.fallback.directChild,true);assert.deepEqual(row.fallback.seen,[{char:'adam',art:true},{char:'adam',art:false}],'direct-child observer missed fallback');
   near(row.fallback.host.width/row.fallback.host.height,1280/720,'fallback aspect');
   for(const name of ['.ci-name','.ci-title','.ci-line'])assert(row.fallback.elements[name].withinStage,'fallback text clipped');
   row.fallbackCleanup=await evaluate('window.finishIntro()');
   assert.equal(row.fallbackCleanup.surfaces,0);assert.equal(row.fallbackCleanup.hosts,0);assert.equal(row.fallbackCleanup.domRestored,true,'fallback cleanup did not restore FX DOM');
   row.initializationRollback=await evaluate('window.checkMountRollback()');
   assert.deepEqual(row.initializationRollback,{sameError:true,domRestored:true,activeListeners:0,registrations:12,disconnected:1,eventsUnblocked:true},'observe failure rollback incomplete');
  }
  rows.push(row);await rpc('Target.closeTarget',{targetId});
 }
 const result={browser:version.product,kind:'isolated synthetic component; no game/assets/network',elapsedSeconds:(Date.now()-started)/1000,cases:rows};await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({out,seconds:result.elapsedSeconds,cases:rows.map(r=>({mode:r.mode,viewport:r.viewport,stage:r.stage,background:r.elements['.ci-art-background'],outOfStage:Object.entries(r.elements).filter(([,v])=>v&&!v.withinStage).map(([k])=>k)}))}));
}finally{clearTimeout(watchdog);const exit=child.exitCode!==null||child.signalCode!==null?Promise.resolve():new Promise(r=>child.once('exit',r));child.kill();await exit;await cleanupProfile(profile);}
}
