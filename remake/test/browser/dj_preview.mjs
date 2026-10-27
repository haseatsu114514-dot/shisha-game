// Normal PR-CI browser acceptance only. Do not run locally around the recorded Chrome EPERM.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8123/remake/';
const url=new URL('previews/dj/index.html',base.endsWith('/')?base:base+'/').href;
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/dj-prototype-1064');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const results=[];
const snapshot=page=>page.evaluate(async()=> (await import('./app.mjs')).snapshot());
const wait=async(page,key,timeout=5000)=>page.waitForFunction(async key=>{
 const s=(await import('./app.mjs')).snapshot();
 return key==='running'?s.running&&s.voices===2&&s.rms>0.00001:key==='mix'?s.mode==='mix':!!s.last?.reached;
},key,{timeout});
try {
 for(const kind of ['pc','touch','reduced']){
  const context=await browser.newContext({viewport:kind==='pc'?{width:1280,height:720}:{width:844,height:390},hasTouch:kind!=='pc',isMobile:kind!=='pc',reducedMotion:kind==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);assert.equal((await snapshot(page)).state,'not-started');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  for(const id of ['start','pause','crossfader','tempo-a','tempo-b','offset']){
   const box=await page.locator('#'+id).boundingBox();assert(box?.height>=44,`${id} target height`);
  }
  if(kind==='pc')await page.locator('#start').click();else await page.locator('#start').tap();
  await wait(page,'running');const before=await snapshot(page);assert.deepEqual(before.bpms,[128,128]);assert(Math.abs(before.phase)<.001);
  if(kind==='pc'){
   await wait(page,'mix',19000);
   assert(await page.locator('#tap').isDisabled(),'No extra tap workload during transition');
   await page.locator('#crossfader').focus();await page.locator('#crossfader').press('End');
   await wait(page,'done',19000);const done=await snapshot(page);assert.equal(done.master,1);assert.equal(done.visualMaster,1);assert(done.last.reached);
  }else{
   await page.locator('#offset').tap();assert(Math.abs(Math.abs((await snapshot(page)).phase)-.5)<.01);
   for(let i=0;i<8;i++)await page.locator('[data-nudge="1,-0.0625"]').tap();
   assert(Math.abs((await snapshot(page)).phase)<.01,'Touch corrections change audio/controller phase');
   const range=page.locator('#crossfader');await range.scrollIntoViewIfNeeded();const box=await range.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert(Math.abs((await snapshot(page)).mix-.5)<.1);
  }
  await page.locator('#pause').click();const stopped=await snapshot(page);assert(!stopped.running);assert.equal(stopped.voices,0);await page.waitForTimeout(120);const still=await snapshot(page);assert.deepEqual(still.beats,stopped.beats);
  await page.locator('#start').click();await wait(page,'running');const resumed=await snapshot(page);assert(resumed.beats[0]>=stopped.beats[0]);assert.equal(resumed.voices,2);assert.equal(resumed.reduced,kind==='reduced');
  assert.deepEqual(errors,[]);results.push({kind,before,stopped,resumed,passed:true,limits:'Real WebAudio graph; not physical speakers/listening or capture'});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({url,results},null,2));
 console.log('DJ preview PC/touch/reduced WebAudio/UI acceptance PASS (physical listening/video excluded)');
}finally{await browser.close();}
