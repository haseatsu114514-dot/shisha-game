// Normal PR CI only; never launch locally around the recorded Chrome refusal.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8123/remake/';
const url=new URL('previews/dj/index.html',base.endsWith('/')?base:base+'/').href;
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/dj-prototype-1064');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const results=[],near=(a,b,e=.01)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const snap=p=>p.evaluate(async()=>(await import('./app.mjs')).snapshot());
const wait=(p,key,timeout=5000)=>p.waitForFunction(async key=>{const s=(await import('./app.mjs')).snapshot();return key==='audio'?s.running&&s.rms>1e-5:key==='head'?s.mode==='waiting-play':s.guide?.from===1;},key,{timeout});
const hashWaves=p=>p.evaluate(()=>['wave-a','wave-b'].map(id=>document.getElementById(id).getContext('2d').getImageData(0,0,960,65).data.reduce((h,b)=>(Math.imul(h,31)+b)>>>0,7)));
try{
 for(const kind of ['pc','touch','reduced']){
  const context=await browser.newContext({viewport:kind==='pc'?{width:1280,height:720}:{width:844,height:390},hasTouch:kind!=='pc',isMobile:kind!=='pc',reducedMotion:kind==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
  assert.equal((await snap(page)).state,'not-started');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const id of ['play-a','play-b']){const r=await page.locator('#'+id).boundingBox();assert(r.height>=64&&r.width>=100,'Large individual PLAY targets');}
  assert.equal(await page.locator('[data-sync],#assist,#tap').count(),0,'No sync/CUE/tap input workload');
  if(kind==='pc')await page.locator('#start').click();else await page.locator('#start').tap();
  const ready=await snap(page);assert.deepEqual(ready.playing,[false,false]);assert.equal(ready.voices,0);assert.deepEqual(ready.bpms,[128,126]);
  for(const deck of [0,1]){
   const plus=page.locator(`[data-pitch="${deck},0.01"]`),minus=page.locator(`[data-pitch="${deck},-0.01"]`);
   const before=await snap(page);if(kind==='pc')await plus.click();else await plus.tap();
   const after=await snap(page);near(after.bpms[deck],before.bpms[deck]+.01,.000001);assert.deepEqual(after.playing,[false,false]);assert.equal(after.bpms[1-deck],before.bpms[1-deck]);
   if(kind==='pc')await minus.click();else await minus.tap();near((await snap(page)).bpms[deck],before.bpms[deck],.000001);
  }
  // Genuine native input, not setter/evaluate/forceclick.
  if(kind==='pc'){await page.locator('#tempo-b').focus();for(let n=0;n<200;n++)await page.locator('#tempo-b').press('ArrowRight');}
  else{const input=page.locator('#tempo-b');await input.scrollIntoViewIfNeeded();const r=await input.boundingBox();await page.touchscreen.tap(r.x+r.width*.6,r.y+r.height/2);}
  const pitched=await snap(page),manual=pitched.bpms[1];assert.notEqual(manual,126);if(kind==='pc')near(manual,128,.001);
  if(kind==='pc')await page.locator('#play-a').click();else await page.locator('#play-a').tap();await wait(page,'audio');
  assert.deepEqual((await snap(page)).playing,[true,false]);
  const a=await hashWaves(page);await page.waitForTimeout(160);const b=await hashWaves(page);assert.notEqual(a[0],b[0]);assert.equal(a[1],b[1],'Stopped B waveform cannot advance');
  if(kind==='pc')await wait(page,'head',19000);
  if(kind==='pc')await page.locator('#play-b').click();else await page.locator('#play-b').tap();
  const entered=await snap(page);assert.deepEqual(entered.playing,[true,true]);assert(entered.beats[1]>=0&&entered.beats[1]<1,'Manual PLAY starts at its click, not pre-started by guide');near(entered.bpms[1],manual,.001);
  if(kind==='pc'){
   await page.locator('#crossfader').focus();await page.locator('#crossfader').press('End');await wait(page,'transfer',19000);
   const mixed=await snap(page);near(mixed.bpms[1],manual,.001);assert.equal(mixed.master,1);assert.equal(mixed.mix,1);assert(!('last'in mixed));
  }else{
   const before=await snap(page);await page.locator('#offset').tap();const offset=await snap(page);near(offset.beats[1]-before.beats[1]-(offset.clock-before.clock)*manual/60,.5);
   for(let n=0;n<8;n++)await page.locator('[data-nudge="1,-0.0625"]').tap();const corrected=await snap(page);near(corrected.beats[1]-offset.beats[1]-(corrected.clock-offset.clock)*manual/60,-.5);
   const input=page.locator('#crossfader');await input.scrollIntoViewIfNeeded();const r=await input.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);near((await snap(page)).mix,.5,.1);near((await snap(page)).bpms[1],manual,.001);
  }
  assert(await page.evaluate(()=>{const v=document.querySelector('.visual-slot').getBoundingClientRect(),box=document.querySelector('.console').getBoundingClientRect();return v.width<=180&&v.height<=160&&v.top>=box.bottom;}),'VJ small window stays below controls');
  if(kind==='reduced')assert((await page.locator('#visual-label').textContent()).includes('静止'));
  await page.locator('#pause').click();const stopped=await snap(page);assert.deepEqual(stopped.playing,[false,false]);assert.equal(stopped.voices,0);await page.waitForTimeout(100);assert.deepEqual((await snap(page)).beats,stopped.beats);
  await page.locator('#start').click();await wait(page,'audio');const resumed=await snap(page);assert.deepEqual(resumed.playing,[true,true]);near(resumed.bpms[1],manual,.001);assert.equal(resumed.voices,2);assert.deepEqual(errors,[]);
  results.push({kind,ready,pitched,entered,stopped,resumed,passed:true,limits:'Real WebAudio/UI only; physical listening/capture excluded'});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({url,results},null,2));console.log('Manual pitch/individual PLAY PC/touch/reduced WebAudio/UI PASS; no physical listening/video claim');
}finally{await browser.close();}
