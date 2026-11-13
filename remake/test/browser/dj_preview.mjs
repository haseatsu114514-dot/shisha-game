// DJ set (2026-11-01 redesign, DJS17 gameplay, 2026-11-11 renewal DJS20〜) in a real Chromium: ▶ ×2 + crossfader (+ optional PITCH/SYNC),
// quantized entry, riding the guide band for 8 bars, 選曲 cards, floor meter.
// Renewal: the how-to board before the set, the navi line + step lamps + gold arrows (▶ / crossfader), the crowd's mood word and voices.
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
const hashWaves=p=>p.evaluate(()=>['wave-a','wave-b'].map(id=>{const c=document.getElementById(id);return c.getContext('2d').getImageData(0,0,c.width,c.height).data.reduce((h,b)=>(Math.imul(h,31)+b)>>>0,7);}));
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
  assert(await page.locator('#exit').isHidden(),'← 戻る only when opened from the game (?embed=1 in a frame)');
  assert.equal(await page.locator('.eq input').count(),0,'EQ knobs are decorative');
  assert.equal(await page.locator('#track-a').textContent(),'Dance Monster');assert.equal(await page.locator('#track-b').textContent(),'Digital Lemonade');
  assert((await page.locator('main').textContent()).includes('CC BY 4.0'));
  assert.equal((await snap(page)).state,'not-started');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const stageScale=await page.evaluate(()=>Number(getComputedStyle(document.getElementById('dj-stage')).getPropertyValue('--s'))||1);
  for(const id of ['play-a','play-b']){const r=await page.locator('#'+id).boundingBox();assert(r.height/stageScale>=52&&r.width/stageScale>=88,'Large ▶ targets');}
  // DJS20/DJS26/DJS27: the floor takes the top 288px; below it the turntables stand 308px tall on both sides. ▶ (90px) sits in its socket on the strip under each
  // turntable and never overlaps the platter; the crossfader is 400px+ wide.
  for(const key of ['a','b']){assert.equal(await page.locator('#indicator-'+key).textContent(),'STANDBY');const j=await page.locator('#platter-'+key).boundingBox();assert(j.width/stageScale>=300&&j.height/stageScale>=300,'Large turntables');}
  for(const key of ['a','b']){const r=await page.locator('#play-'+key).boundingBox(),j=await page.locator('#platter-'+key).boundingBox(),d=await page.locator('#deck-'+key).boundingBox();
   assert(r.height/stageScale>=88&&r.width/stageScale>=88,'▶ is a 90px pad');assert(r.y>=j.y+j.height-1,'▶ sits below the platter, not on it');assert(r.x>=d.x-1&&r.x+r.width<=d.x+d.width+1&&r.y+r.height<=d.y+d.height+1,'▶ stays inside its deck');}
  {const r=await page.locator('#crossfader').boundingBox();assert(r.width/stageScale>=400&&r.height/stageScale>=70,'The crossfader is the widest control');}
  {const f=await page.locator('.floor').boundingBox();assert(f.height/stageScale>=280,'the floor (the guests) takes the top 288px');}
  // Before the set: the how-to board, step 1 lit, one navi line and a gold arrow on ▶ A. ？ 遊び方 folds the board away and back.
  assert(await page.locator('#howto').isVisible(),'how-to board before the first ▶');assert.equal(await page.locator('#howto li').count(),4);
  assert.match(await page.locator('#coaching').textContent(),/左の ▶ を押して/);assert.equal(await page.locator('#steps li.now').getAttribute('data-step'),'1');
  assert(await page.locator('#point-play-a').isVisible(),'gold arrow on ▶ A');assert(await page.locator('#point-play-b').isHidden());assert.deepEqual((await snap(page)).points,['play-a']);
  assert.equal(await page.locator('#mood').textContent(),'様子見');assert.equal(await page.locator('.floor').getAttribute('data-mood'),'2');
  // The floor is the DJ's own view (DJS28/DJS32): the empty room behind, the silhouette guests' band in front (both cut from the same 3:1 picture,
  // so they line up), cut into strips that move on the beat. The guests fill the floor from its upper half down past its bottom edge.
  assert.equal(await page.locator('#band .strip').count(),7);assert(await page.evaluate(()=>{const r=document.querySelector('.floor-art .room').getBoundingClientRect(),b=document.getElementById('band').getBoundingClientRect(),f=document.querySelector('.floor').getBoundingClientRect();
   return r.top<=f.top+1&&r.bottom>=f.bottom-1&&r.width>=f.width-1&&b.width>=f.width-1&&b.bottom>=f.bottom-1&&b.top<=f.top+f.height/2&&Math.abs(r.width/r.height-3)<.05;}),'room covers the floor, the guests fill it from the upper half down');
  assert(await page.evaluate(()=>[...document.querySelectorAll('#band .strip,#band .base')].every(e=>!e.style.transform)),'nobody moves before the music starts');
  await press('help');await page.locator('#howto').waitFor({state:'hidden'});await press('help');await page.locator('#howto').waitFor({state:'visible'});
  assert(await page.evaluate(()=>{const r=q=>document.querySelector(q).getBoundingClientRect(),fr=r('.floor'),cr=r('.console'),wr=r('.waves'),mr=r('.mixer'),a=r('#platter-a'),b=r('#platter-b'),pa=r('#play-a'),pb=r('#play-b'),x=r('#crossfader');
   return fr.bottom<=cr.top+1&&cr.bottom<=innerHeight+1   // the floor above the booth, the booth inside the viewport
    &&wr.top>=cr.top&&wr.bottom<=mr.top+1&&a.right<=wr.left+1&&wr.right<=b.left+1   // the navi and waveforms sit between the turntables, above the mixer
    &&a.right<=x.left&&x.right<=b.left&&pa.right<=x.left+1&&x.right<=pb.left+1   // ▶ A | crossfader | ▶ B along the bottom, turntables outside
    &&a.left>=cr.left&&b.right<=cr.right&&a.bottom<=cr.bottom+1&&b.bottom<=cr.bottom+1;}),'floor above the booth; turntables left and right, the navi over the mixer between them');
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
  // ▶ A starts the set: A on air, B cued at the next 4-bar line (beat 16 in SET 1: 8 s, DJF03), B's waveform stays still.
  await press('play-a');await until(page,'audio',s=>s.running&&s.rms>1e-5,errors);
  let started=await snap(page);assert.deepEqual(started.playing,[true,false]);assert.equal(started.phase,'cue');assert.deepEqual([started.cue.from,started.cue.to,started.cue.start],[0,1,16]);assert.equal(started.grid,16);
  await until(page,'deck A DOM',()=>true,errors);
  assert.equal(await page.locator('#indicator-a').textContent(),'ON AIR');assert.equal(await page.locator('#deck-a').getAttribute('data-playing'),'true');
  assert(await page.locator('#play-a').isDisabled(),'▶ only starts: a deck on air cannot be stopped by ▶');
  const a=await hashWaves(page);let b;await until(page,'deck A waveform',()=>true,errors);
  // DJS29: both lanes scroll on one bar grid (the deck on air); the stopped deck B itself never advances.
  for(let i=0;i<40;i++){b=await hashWaves(page);if(b[0]!==a[0]&&b[1]!==a[1])break;await page.waitForTimeout(50);}assert.notEqual(a[0],b[0]);assert.notEqual(a[1],b[1],'B lane scrolls with the shared bar grid');
  {const s=await snap(page);assert.equal(s.beats[1],0,'Stopped deck B cannot advance');assert.equal(s.playing[1],false);}
  // Started: the how-to board is gone, step 2 is lit, and no arrow yet (pressing ▶ B now would be early).
  await page.locator('#howto').waitFor({state:'hidden'});assert.equal(await page.locator('#steps li.now').getAttribute('data-step'),'2');
  assert.match(await page.locator('#coaching').textContent(),/次は右の ▶/);assert.match(await page.locator('#coach-sub').textContent(),/あと \d 小節/);
  assert(await page.locator('#point-play-a').isHidden());assert(await page.locator('#point-play-b').isHidden(),'no arrow on ▶ B until the count');
  if(kind==='pc'){
   // Moving the fader away before the entry fades the playing track out: the navi warns and the arrows point back to A.
   await page.locator('#crossfader').focus();await page.locator('#crossfader').press('End');
   await until(page,'away',s=>s.away===true,errors);assert.match(await page.locator('#coaching').textContent(),/音が消える！ 横フェーダーを左へ戻そう/);
   assert(await page.locator('#fader-arrows').isVisible());assert(await page.locator('#fader-arrows').evaluate(e=>e.classList.contains('left')),'arrows point back to the left (A)');
   await page.locator('#crossfader').press('Home');await until(page,'back',s=>s.away===false&&s.mix===0,errors);assert(await page.locator('#fader-arrows').isHidden());
   // An interruption (tab hidden) pauses the set. The navi points at the playing deck's ▶, and that one press brings the set back where it stopped.
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
   const paused=await until(page,'paused',s=>!s.running&&s.state==='suspended',errors);assert.equal(paused.phase,'cue');assert.deepEqual(paused.playing,[false,false]);
   await until(page,'paused navi',s=>/一時停止中。左の ▶ で続きから/.test(s.navi),errors);assert(await page.locator('#point-play-a').isVisible());assert.deepEqual((await snap(page)).points,['play-a']);
   await page.evaluate(()=>{delete document.hidden;});
   await press('play-a');const resumed=await until(page,'resumed',s=>s.running,errors);assert.deepEqual(resumed.playing,[true,false]);assert.equal(resumed.cue.start,16);
   assert(resumed.beats[0]>=paused.beats[0]-.01&&resumed.beats[0]<paused.beats[0]+2,'the track continues from where it stopped');
  }
  // The light on the floor moves while playing, and is static with reduced motion.
  const crowdHash=()=>page.evaluate(()=>{const c=document.getElementById('crowd');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.reduce((h,b)=>(Math.imul(h,31)+b)>>>0,7);});
  const c1=await crowdHash();await page.waitForTimeout(260);const c2=await crowdHash();
  // 様子見: the guests only sway a little while the track plays (they bounce once the room warms up); with reduced motion they stay put.
  const moved=()=>page.evaluate(()=>[...document.querySelectorAll('#band .strip')].filter(e=>e.style.transform).length);
  if(kind==='reduced')assert.equal(await moved(),0,'reduced motion: the guests do not move');else{let n=0;for(let i=0;i<20&&!n;i++){n=await moved();await page.waitForTimeout(60);}assert(n>0,'the guests sway with the music');}
  if(kind==='reduced')assert.equal(await page.locator('#platter-a').evaluate(e=>e.style.getPropertyValue('--rotation')),'0deg','reduced motion: the platter does not spin');else assert.notEqual(c1,c2,'crowd bobs on the beat');
  // SYNC exists but SET 1 does not need it; it stays enabled while a cue is open.
  assert(!(await page.locator('#sync').isDisabled()));assert(!(await page.locator('#sync').evaluate(e=>e.classList.contains('needed'))));
  // Countdown numbers show for the last 4 beats, then ▶ B at the head is quantized onto the beat and graded.
  await until(page,'countdown',s=>s.phase==='cue'&&s.remaining<=4&&s.remaining>0,errors,19000,20);
  const count=await page.locator('#count').textContent();assert(['4','3','2','1'].includes(count),`countdown digit, got ${JSON.stringify(count)}`);
  assert(await page.locator('#play-b').evaluate(e=>e.classList.contains('cue-soon')||e.classList.contains('cue-open')),'▶ B highlighted before the entry');
  assert(await page.locator('#point-play-b').isVisible(),'gold arrow on ▶ B during the count');
  // DJS29: the waiting track is drawn from the entry flag on (nothing before it), so the player sees where B comes in.
  const lane=await page.evaluate(async()=>{const s=(await import('./app.mjs')).snapshot(),cv=document.getElementById('wave-b'),c=cv.getContext('2d'),w=cv.width,h=cv.height,row=c.getImageData(0,Math.round(h/2),w,1).data,cyan=[];
   for(let x=0;x<w;x++){const r=row[x*4],g=row[x*4+1],b=row[x*4+2];if(b>120&&g>100&&r<110)cyan.push(x);}
   const f=s.cue.from;return{flag:Math.round(w*.3)+(s.cue.start-s.beats[f])*60/s.bpms[f]*(w/7),first:cyan[0]??null,count:cyan.length,w};});
  assert(lane.count>0&&lane.first>=lane.flag-8,`B is drawn from the entry flag on: ${JSON.stringify(lane)}`);assert.match(await page.locator('#coaching').textContent(),/カウント 0 で、右の ▶/);
  await until(page,'head',s=>s.phase==='cue'&&s.remaining<=.12,errors,4000,5);
  await press('play-b');
  const entered=await until(page,'entry',s=>s.phase==='mix',errors);
  assert.deepEqual(entered.playing,[true,true]);assert(entered.lastPlay&&['PERFECT','GOOD','OK'].includes(entered.lastPlay.grade),JSON.stringify(entered.lastPlay));assert.equal(entered.cue.pressed.beat,16,'quantized onto the entry line');
  // DJF01/02/10: the press answers at once where it was made (a ring in the grade's colour on the button, a sound), the count-in clicked on the beats before it,
  // and a good entry holds the floor for a blink and then drops it (no hold, no shake animation with reduced motion).
  {const g=entered.lastPlay.grade,good=g==='PERFECT'||g==='GOOD';
   assert(await page.locator('#burst-b').evaluate((e,c)=>e.classList.contains('go')&&e.classList.contains(c),g.toLowerCase()),'ring on ▶ B in the grade colour');assert(await page.locator('#burst-a').evaluate(e=>!e.classList.contains('go')));
   assert(entered.fx.ticks>=1&&entered.fx.ticks<=4,`count-in clicks: ${entered.fx.ticks}`);assert(entered.fx.sfx>entered.fx.ticks,'the entry has its own sound');
   const landed=await until(page,'entry feel',s=>!s.fx.held,errors);
   if(good){assert.equal(landed.fx.lastShake,'drop');assert.equal(landed.fx.holds,kind==='reduced'?0:1,'a good entry is held once (never with reduced motion)');assert.equal(await page.locator('#drop').textContent(),'DROP!');
    assert.equal(await page.locator('#floor-art').evaluate(e=>e.classList.contains('shake-drop')),kind!=='reduced');}
   else{assert.equal(landed.fx.holds,0,'OK is not held');assert.equal(landed.fx.shakes,0);}
   assert(await page.locator('#floor-art').evaluate(e=>!e.classList.contains('hold')),'the hold is over');}
  await until(page,'B audible',s=>s.beats[1]>=0,errors);near((await snap(page)).phase_error,0,.02);
  assert.equal(await page.locator('#judge').textContent(),entered.lastPlay.grade);
  // The guests answer the entry: a voice in a bubble, and the heat meter says why it moved.
  assert(await page.locator('#voices .voice').count()>=1,'a guest reacts to the entry');assert.equal(await page.locator('#voices .voice').last().getAttribute('data-kind'),entered.lastPlay.grade);
  if(entered.lastPlay.grade!=='OK')assert.match(await page.locator('#heat-delta').textContent(),/^\+\d+　/,'the heat meter shows the step and its reason');
  assert.equal(await page.locator('#steps li.now').getAttribute('data-step'),'3');assert.match(await page.locator('#coaching').textContent(),/横フェーダーを右へ/);assert(await page.locator('#point-play-b').isHidden());
  assert.equal(await page.locator('#indicator-b').textContent(),'ON AIR');
  // 8-bar mix: the guide band shows where the fader should be on every beat; ride it toward B (keyboard / tap = genuine native input).
  // Automatic EQ cuts A's lows past the centre.
  const fader=page.locator('#crossfader'),fr=await fader.boundingBox(),thumb=54*stageScale;
  assert(await page.locator('#guide').isVisible(),'guide band during the mix');
  if(kind==='pc')await fader.focus();
  // Leave the fader at A until the band has moved on a little: the gold arrows appear between the cap and the band and point to B (still inside the ±0.14 band, so no beat is missed).
  const behind=await until(page,'behind',s=>s.phase==='mix'&&s.guide>.09,errors,8000,20);assert.equal(behind.mix,0);
  assert(await page.locator('#fader-arrows').isVisible(),'arrows toward the band');assert(!(await page.locator('#fader-arrows').evaluate(e=>e.classList.contains('left'))),'they point right, toward B');
  assert.match(await page.locator('#fader-hint').textContent(),/もっと右へ/);
  let mixed=null,comboText='',onLine=false;
  for(let i=0;i<600;i++){
   const s=await snap(page);if(s.phase!=='mix')break;
   // hint and arrows are read in the same snapshot (the same frame): asking the page again a moment later raced the moving band on slow CI machines
   if(!onLine&&s.hint==='いい感じ、そのまま'){onLine=true;assert.equal(s.arrows,false,'no arrows while the cap rides the band');}
   const target=s.guide==null?s.mix:s.guide,diff=target-s.mix;
   if(kind==='pc'){if(Math.abs(diff)>.03)await fader.press(diff>0?(diff>.12?'PageUp':'ArrowRight'):(diff<-.12?'PageDown':'ArrowLeft'));}
   else if(Math.abs(diff)>.06)await page.touchscreen.tap(fr.x+thumb/2+Math.min(1,target+.02)*(fr.width-thumb),fr.y+fr.height/2);
   if(!mixed&&s.mix>.8){mixed=s;assert(await page.locator('#led-autoeq').evaluate(e=>e.classList.contains('on')),'AUTO EQ lamp while A\'s lows are cut');}
   if(!comboText&&s.fader?.combo>=4){await page.waitForTimeout(40);comboText=await page.locator('#combo').textContent();}
   await page.waitForTimeout(40);
  }
  assert(mixed,'the fader rode past 0.8 during the 8 bars');assert.match(comboText,/^COMBO \d+$/,'combo counter on the fader');assert(onLine,'the hint said the cap was on the band');
  // Transition end: scored toast, A leaves the air and empties, then the 選曲 cards appear over deck A.
  const done=await until(page,'transition',s=>s.transitions.length>=1,errors,20000,100);
  const t=done.transitions[0];assert.equal(t.to,'digitalLemonade');assert.equal(t.parts[0],100,'BPM matched');assert(t.parts[2]>=85,`fader ${t.parts[2]} follow ${t.follow}`);assert(t.combo>=16,`combo ${t.combo}`);assert(['S','A'].includes(t.rank),t.rank);
  assert.deepEqual(done.playing,[false,true]);assert.equal(done.master,1);assert.equal(done.cue,null);assert.equal(done.phase,'select');assert.equal(done.tracks[0],null);assert(done.floor>.5);
  assert.equal(await page.locator('#toast').evaluate(e=>e.textContent.length>0),true,'transition toast');assert.equal(await page.locator('#toast .medal.stamp').count(),1,'the rank is stamped on (DJF05)');assert.equal(done.fx.lastSfx,'transition');
  assert.equal(await page.locator('#indicator-a').textContent(),'EMPTY');assert.equal(await page.locator('#track-a').textContent(),'— 選曲中 —');assert.equal(await page.locator('#set-progress').textContent(),'2 / 3');
  assert(await page.locator('#guide').isHidden(),'no guide band outside the mix');
  await page.locator('#pick').waitFor();assert.equal(await page.locator('#pick').getAttribute('data-side'),'a');assert.equal(await page.locator('.pick-card').count(),2);
  assert.match(await page.locator('#request').textContent(),/^お客さんの声「.+」$/);assert.equal(await page.locator('#steps li.now').getAttribute('data-step'),'4');
  assert.equal(await page.locator('.pick-card .energy').count(),2,'ノリ as flames');assert.equal(await page.locator('.pick-card .marks em').count(),4,'two ✓/✕ marks per card: fits the request, mixes in key');
  assert(done.mood>=2,'a clean transition never cools the room');assert.equal(await page.locator('#mood').textContent(),['帰りそう','しらけ気味','様子見','ノってきた','最高潮'][done.mood]);assert.equal(await page.locator('.floor').getAttribute('data-mood'),String(done.mood));
  for(const [i,key] of done.select.options.entries())assert.match(await page.locator('#pick-'+i).textContent(),new RegExp(await page.evaluate(async k=>(await import('./tracks.mjs')).TRACKS[k].title.replace(/[()]/g,'.'),key)));
  // Pick the first card: it loads on deck A at the master tempo (SET 1) and the next cue opens from B.
  await press('pick-0');
  const picked=await until(page,'pick',s=>s.phase==='cue',errors);
  assert.equal(picked.tracks[0],done.select.options[0]);assert.deepEqual(picked.bpms,[120,120]);assert.deepEqual([picked.cue.from,picked.cue.to],[1,0]);assert.equal(picked.played.length,3);
  assert(await page.locator('#pick').isHidden());assert.equal(await page.locator('#indicator-a').textContent(),'STANDBY');
  assert.match(await page.locator('#toast').textContent(),/[◎○△]/,'the pick is rated');
  assert.equal(await page.locator('#score-result').evaluate(e=>e.children.length),0,'set result only after the last transition');
  // Restart rebuilds a fresh set without a page reload.
  await press('restart');const fresh=await until(page,'restart',s=>!s.running&&s.transitions.length===0,errors);assert.deepEqual(fresh.playing,[false,false]);assert.equal(fresh.voices,0);near(fresh.floor,.5);
  assert(await page.locator('#howto').isHidden(),'DJF08: the how-to board does not come back on a retry');assert.match(await page.locator('#coaching').textContent(),/左の ▶ を押して/);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,`visual-${kind}.png`),fullPage:true});
  results.push({kind,ready,started,entered,mixed,done,picked,passed:true,limits:'Real WebAudio/UI only; physical listening/capture excluded'});await context.close();
 }
 // DJF06〜08: one whole SET 1 to the end (PC; the fader is driven by script here, native input is covered above). The afterglow, the result card
 // that counts up and is stamped, the next goal, and 「もう一度」 putting the first track straight back on.
 {
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__djTestFrames=0;const count=()=>{window.__djTestFrames++;requestAnimationFrame(count);};requestAnimationFrame(count);});
  await page.goto(url+'&best=70&feel=afterglow.ms:6000,afterglow.countUp:500');await page.locator('#play-a').click();
  let s;const deadline=Date.now()+110000;
  for(;;){
   s=await snap(page);assert(Date.now()<deadline,`the set did not finish: ${JSON.stringify({phase:s.phase,transitions:s.transitions.length})}`);
   if(s.phase==='done')break;
   if(s.phase==='cue'&&s.cue&&!s.cue.pressed&&s.remaining<=.05)await page.locator('#play-'+(s.cue.to?'b':'a')).click();
   else if(s.phase==='mix'){const g=s.progress>=.97?1:s.guide??0;await page.evaluate(v=>{const f=document.getElementById('crossfader');f.value=String(v);f.dispatchEvent(new Event('input',{bubbles:true}));},s.cue.to===1?g:1-g);}
   else if(s.phase==='select'){await page.waitForTimeout(300);await page.locator('#pick-0').click();}
   await page.waitForTimeout(15);
  }
  // the record is fixed the moment the set ends; the card waits while the room cheers
  assert(s.result&&s.result.transitions.length===2);assert.equal(s.fx.afterglow,true);assert.equal(s.fx.lastSfx,'finish');assert.equal(await page.locator('#result-card').count(),0,'no result card during the afterglow');
  assert.equal(await page.locator('#drop').textContent(),'SET COMPLETE!');assert(await page.locator('#drop').evaluate(e=>e.classList.contains('finish')));assert.equal(await page.locator('#toast').textContent(),'','the last transition is answered by the finish, not a toast');
  assert.equal(s.best,Math.max(70,s.result.total));
  // …and never holds the player: a click moves on (6 s of afterglow were asked for)
  await page.waitForTimeout(450);assert.equal(await page.locator('#result-card').count(),0);await page.locator('#floor').click({position:{x:640,y:200}});
  await page.locator('#result-card').waitFor({timeout:1500});assert(await page.locator('#again').isVisible(),'the buttons work from the start');
  await page.locator('#result-card.settled').waitFor({timeout:3000});const total=String(s.result.total);
  assert.equal(await page.locator('#result-num').textContent(),total);assert(await page.locator('#result-medal').evaluate(e=>e.classList.contains('stamp')&&!e.classList.contains('wait')));
  const goal=await page.locator('#result-goal').textContent();assert.match(goal,s.result.rank==='S'?/最高ランク S に届いた/:/次のランク [SAB] まで あと \d+点/);
  assert.match(goal,s.result.total>70?/自己ベスト更新！（これまで 70点）/:s.result.total===70?/自己ベストに並んだ/:/自己ベスト 70点 まで あと \d+点/);
  assert.equal((await snap(page)).fx.lastSfx,'stamp');
  await page.screenshot({path:path.join(out,'visual-result.png')});
  // 「もう一度」: the first track is back on at once, no how-to board, the best carries over
  await page.locator('#again').click();const again=await until(page,'again',x=>x.running&&x.phase==='cue',errors);
  assert.deepEqual(again.playing,[true,false]);assert.equal(again.transitions.length,0);assert.equal(again.cue.start,16);assert.equal(again.best,Math.max(70,s.result.total));near(again.floor,.5);
  assert(await page.locator('#howto').isHidden());assert.equal(await page.locator('#score-result').evaluate(e=>e.children.length),0);
  assert.deepEqual(errors,[]);results.push({kind:'whole-set',result:s.result,goal,passed:true});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({url,results},null,2));console.log('DJ set PC/touch/reduced WebAudio/UI PASS; no physical listening/video claim');
}catch(error){
 const detail=String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
 console.error(`::error title=DJ browser failure::${detail}`);throw error;
}finally{await browser.close();}
