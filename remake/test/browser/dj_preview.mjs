// DJ set (2026-11-01 redesign) in a real Chromium: ▶ ×2 + crossfader (+ optional PITCH/SYNC), quantized entry, 8-bar mix scoring, floor meter.
// Normal PR CI only; never launch locally around the recorded Chrome refusal.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8123/remake/';
const url=new URL('previews/dj/index.html?set=1',base.endsWith('/')?base:base+'/').href;
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/dj-prototype-1064');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const results=[],near=(a,b,e=.01)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const snap=p=>p.evaluate(async()=>(await import('./app.mjs')).snapshot());
const diagnostics=async(p,errors)=>({rafFrames:await p.evaluate(()=>window.__djTestFrames),clock:(await snap(p)).clock,errors});
const until=async(p,key,ready,errors,timeout=5000,step=50)=>{
 const deadline=Date.now()+timeout;let state;
 do{state=await snap(p);if(ready(state))return state;await p.waitForTimeout(step);}while(Date.now()<deadline);
 assert.fail(`Timed out waiting for ${key}: ${JSON.stringify({state,...await diagnostics(p,errors)})}`);
};
const hashWaves=p=>p.evaluate(()=>['wave-a','wave-b'].map(id=>document.getElementById(id).getContext('2d').getImageData(0,0,960,60).data.reduce((h,b)=>(Math.imul(h,31)+b)>>>0,7)));
try{
 for(const kind of ['pc','touch','reduced']){
  const context=await browser.newContext({viewport:kind==='pc'?{width:1280,height:720}:{width:844,height:390},hasTouch:kind!=='pc',isMobile:kind!=='pc',reducedMotion:kind==='reduced'?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__djTestFrames=0;const count=()=>{window.__djTestFrames++;requestAnimationFrame(count);};requestAnimationFrame(count);});
  const press=async id=>{if(kind==='pc')await page.locator('#'+id).click();else await page.locator('#'+id).tap();};
  await page.goto(url);
  // Controls: two ▶, a crossfader, PITCH ×2 and SYNC. No stage header, no nudge/judge/VOL/CUE buttons, no EQ inputs.
  assert.equal(await page.locator('.stage-btn,header,[data-nudge],[data-nudge-ms],#judge-btn,#offset,#volume,#cue-a,#cue-b,#start,#pause,#mute').count(),0);
  assert.equal(await page.locator('input[type=range]').count(),3,'crossfader + PITCH ×2 only');
  assert.equal(await page.locator('.eq input').count(),0,'EQ knobs are decorative');
  assert.equal(await page.locator('#track-a').textContent(),'Dance Monster');assert.equal(await page.locator('#track-b').textContent(),'Digital Lemonade');
  assert((await page.locator('main').textContent()).includes('CC BY 4.0'));
  assert.equal((await snap(page)).state,'not-started');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const stageScale=await page.evaluate(()=>Number(getComputedStyle(document.getElementById('dj-stage')).getPropertyValue('--s'))||1);
  for(const id of ['play-a','play-b']){const r=await page.locator('#'+id).boundingBox();assert(r.height/stageScale>=52&&r.width/stageScale>=88,'Large ▶ targets');}
  for(const key of ['a','b']){assert.equal(await page.locator('#indicator-'+key).textContent(),'STANDBY');const j=await page.locator('#platter-'+key).boundingBox();assert(j.width/stageScale>=330&&j.height/stageScale>=330,'Large jog wheels');}
  {const r=await page.locator('#crossfader').boundingBox();assert(r.width/stageScale>=180&&r.height/stageScale>=60,'Large crossfader');}
  assert(await page.evaluate(()=>{const f=document.querySelector('.floor'),w=document.querySelector('.waves'),c=document.querySelector('.console');const fr=f.getBoundingClientRect(),wr=w.getBoundingClientRect(),cr=c.getBoundingClientRect();return fr.bottom<=wr.top+1&&wr.bottom<=cr.top+1&&cr.bottom<=innerHeight+1;}),'floor / waveforms / controller stack top to bottom inside the viewport');
  const ready=await snap(page);assert.deepEqual(ready.playing,[false,false]);assert.equal(ready.voices,0);assert.deepEqual(ready.bpms,[120,120],'SET 1 needs no pitch match');assert.equal(ready.phase,'idle');near(ready.floor,.5);
  assert(await page.locator('#lock-a').evaluate(e=>e.classList.contains('on')),'LOCK lamp lit while BPMs match');
  // PITCH fader: ±8 %, keyboard steps of 0.01 %, only the chosen deck.
  await page.locator('#pitch-b').focus();for(let n=0;n<10;n++)await page.locator('#pitch-b').press('ArrowRight');
  let pitched=await snap(page);near(pitched.pitches[1],.1,.001);near(pitched.bpms[1],120.12,.001);assert.equal(pitched.bpms[0],120);
  await page.waitForTimeout(60);assert(await page.locator('#lock-b').evaluate(e=>e.classList.contains('on')),'0.1 % off is within the 0.15 % lock');
  for(let n=0;n<10;n++)await page.locator('#pitch-b').press('ArrowRight');pitched=await snap(page);near(pitched.bpms[1],120.24,.001);
  await page.waitForTimeout(60);assert(!(await page.locator('#lock-b').evaluate(e=>e.classList.contains('on'))),'0.2 % off unlocks');
  for(let n=0;n<20;n++)await page.locator('#pitch-b').press('ArrowLeft');pitched=await snap(page);near(pitched.bpms[1],120,.001);
  // Jog outer rim: clockwise raises BPM by 0.01 per 12°; the centre does nothing; keyboard arrows do the same.
  for(const deck of [0,1]){
   const jog=page.locator('#platter-'+(deck?'b':'a'));const before=await snap(page);await jog.focus();await jog.press('ArrowRight');
   const after=await snap(page);near(after.bpms[deck],before.bpms[deck]+.01,.000001);assert.deepEqual(after.playing,[false,false]);assert.equal(after.bpms[1-deck],before.bpms[1-deck]);
   await jog.press('ArrowLeft');near((await snap(page)).bpms[deck],before.bpms[deck],.000001);
   if(kind==='pc'){
    const r=await jog.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2,R=r.width/2*.85;
    await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+20,cy+5);await page.mouse.up();near((await snap(page)).bpms[deck],before.bpms[deck],.000001);
    await page.mouse.move(cx,cy-R);await page.mouse.down();for(let t=1;t<=13;t++){const a=t*5*Math.PI/180;await page.mouse.move(cx+R*Math.sin(a),cy-R*Math.cos(a));}await page.mouse.up();
    near((await snap(page)).bpms[deck],before.bpms[deck]+.05,.000001);
    await jog.focus();for(let n=0;n<5;n++)await jog.press('ArrowLeft');near((await snap(page)).bpms[deck],before.bpms[deck],.000001);
   }
  }
  // ▶ A starts the set: A on air, B cued at the next phrase head (beat 32), B's waveform stays still.
  await press('play-a');await until(page,'audio',s=>s.running&&s.rms>1e-5,errors);
  let started=await snap(page);assert.deepEqual(started.playing,[true,false]);assert.equal(started.phase,'cue');assert.deepEqual([started.cue.from,started.cue.to,started.cue.start],[0,1,32]);
  await until(page,'deck A DOM',()=>true,errors);
  assert.equal(await page.locator('#indicator-a').textContent(),'ON AIR');assert.equal(await page.locator('#deck-a').getAttribute('data-playing'),'true');
  assert(await page.locator('#play-a').isDisabled(),'▶ only starts: a deck on air cannot be stopped by ▶');
  const a=await hashWaves(page);let b;await until(page,'deck A waveform',()=>true,errors);
  for(let i=0;i<40;i++){b=await hashWaves(page);if(b[0]!==a[0])break;await page.waitForTimeout(50);}assert.notEqual(a[0],b[0]);assert.equal(a[1],b[1],'Stopped B waveform cannot advance');
  // The crowd canvas changes while playing (bobbing), and is static with reduced motion.
  const crowdHash=()=>page.evaluate(()=>document.getElementById('crowd').getContext('2d').getImageData(0,0,313,28).data.reduce((h,b)=>(Math.imul(h,31)+b)>>>0,7));
  const c1=await crowdHash();await page.waitForTimeout(260);const c2=await crowdHash();
  if(kind==='reduced')assert.equal(await page.locator('#platter-a').evaluate(e=>e.style.getPropertyValue('--rotation')),'0deg','reduced motion: the platter does not spin');else assert.notEqual(c1,c2,'crowd bobs on the beat');
  // SYNC exists but SET 1 does not need it; it stays enabled while a cue is open.
  assert(!(await page.locator('#sync').isDisabled()));assert(!(await page.locator('#sync').evaluate(e=>e.classList.contains('needed'))));
  // Countdown numbers show for the last 4 beats, then ▶ B at the head is quantized onto the beat and graded.
  await until(page,'countdown',s=>s.phase==='cue'&&s.remaining<=4&&s.remaining>0,errors,19000,20);
  const count=await page.locator('#count').textContent();assert(['4','3','2','1'].includes(count),`countdown digit, got ${JSON.stringify(count)}`);
  assert(await page.locator('#play-b').evaluate(e=>e.classList.contains('cue-soon')||e.classList.contains('cue-open')),'▶ B highlighted before the entry');
  await until(page,'head',s=>s.phase==='cue'&&s.remaining<=.12,errors,4000,5);
  await press('play-b');
  const entered=await until(page,'entry',s=>s.phase==='mix',errors);
  assert.deepEqual(entered.playing,[true,true]);assert(entered.lastPlay&&['PERFECT','GOOD','OK'].includes(entered.lastPlay.grade),JSON.stringify(entered.lastPlay));assert.equal(entered.cue.pressed.beat,32,'quantized onto the phrase head');
  await until(page,'B audible',s=>s.beats[1]>=0,errors);near((await snap(page)).phase_error,0,.02);
  assert.equal(await page.locator('#judge').textContent(),entered.lastPlay.grade);
  assert.equal(await page.locator('#indicator-b').textContent(),'ON AIR');
  // 8-bar mix: the crossfader is moved toward B in steps (keyboard = genuine native input); automatic EQ cuts A's lows past the centre.
  const fader=page.locator('#crossfader');
  if(kind==='pc'){await fader.focus();for(let n=0;n<10;n++){await fader.press('PageUp');await page.waitForTimeout(450);}}
  else{const r=await fader.boundingBox();for(let n=1;n<=10;n++){await page.touchscreen.tap(r.x+r.width*(.08+.84*n/10),r.y+r.height/2);await page.waitForTimeout(450);}}
  const mixed=await snap(page);assert(mixed.mix>=.9,`fader reached B: ${mixed.mix}`);assert(mixed.fader.maxJump<=.2,`smooth fader: ${mixed.fader.maxJump}`);assert(mixed.fader.reached!=null&&mixed.fader.reached<1);
  assert(await page.locator('#led-autoeq').evaluate(e=>e.classList.contains('on')),'AUTO EQ lamp while A\'s lows are cut');
  // Transition end: scored toast, A leaves the air and loads the third track, next cue from B.
  const done=await until(page,'transition',s=>s.transitions.length>=1,errors,20000,100);
  const t=done.transitions[0];assert.equal(t.to,'digitalLemonade');assert.equal(t.parts[0],100,'BPM matched');assert(t.parts[2]>=85,`fader ${t.parts[2]}`);assert(['S','A'].includes(t.rank),t.rank);
  assert.deepEqual(done.playing,[false,true]);assert.equal(done.master,1);assert.deepEqual([done.cue.from,done.cue.to],[1,0]);assert.equal(done.tracks[0],'danceMonster');assert(done.floor>.5);
  assert.equal(await page.locator('#toast').evaluate(e=>e.textContent.length>0),true,'transition toast');
  assert.equal(await page.locator('#indicator-a').textContent(),'STANDBY');assert.equal(await page.locator('#set-progress').textContent(),'2 / 3');
  assert.equal(await page.locator('#score-result').evaluate(e=>e.children.length),0,'set result only after the last transition');
  // Restart rebuilds a fresh set without a page reload.
  await press('restart');const fresh=await until(page,'restart',s=>!s.running&&s.transitions.length===0,errors);assert.deepEqual(fresh.playing,[false,false]);assert.equal(fresh.voices,0);near(fresh.floor,.5);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,`visual-${kind}.png`),fullPage:true});
  results.push({kind,ready,started,entered,mixed,done,passed:true,limits:'Real WebAudio/UI only; physical listening/capture excluded'});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({url,results},null,2));console.log('DJ set PC/touch/reduced WebAudio/UI PASS; no physical listening/video claim');
}catch(error){
 const detail=String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
 console.error(`::error title=DJ browser failure::${detail}`);throw error;
}finally{await browser.close();}
