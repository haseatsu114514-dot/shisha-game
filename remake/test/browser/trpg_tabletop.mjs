import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {layoutSnapshot,settledPreview} from './trpg_layout.mjs';
import {TrpgSession} from '../../js/trpg/session.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8123/remake/';
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/trpg-roll-ui-issue596');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 ...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});const results=[];
const ctl=(p,id)=>p.locator(`[data-test="${id}"]`);
async function lines(p){for(let n=0;n<60&&await ctl(p,'trpg-next').isVisible();n++)await ctl(p,'trpg-next').click();}
async function declare(p){const card=p.locator('[data-test^="trpg-approach-"]').first();if(await card.count()&&await card.isVisible()){await card.click();await lines(p);}}
async function assertReducedDice(p){
 // The 40ms result render replaces rolling dice. Query and read styles in one
 // browser task so a selector handle cannot retain dice detached between awaits.
 const dice=await p.evaluate(()=>[...document.querySelectorAll('.trpg-die')].map(n=>({
   connected:n.isConnected,animationName:getComputedStyle(n).animationName,
 })));
 assert.deepEqual(dice.map(n=>n.connected),[true,true],'Both reduced-motion dice must be connected');
 assert.deepEqual(dice.map(n=>n.animationName),['none','none'],'Reduced motion keeps both actual dice still');
}
async function fit(p,label){
 try {
 // Keep a previous click from hovering the edge of a newly positioned result control.
 await p.mouse.move(0,0);
 await settledPreview(p);
 // Full rectangles must survive every clipping ancestor, not merely fit their own box.
 const visible=async (locator,frame=false)=>locator.evaluate((el,frame)=>{
   const r=el.getBoundingClientRect(), scale=document.getElementById('stage').getBoundingClientRect().width/1280;
   const pad=frame?14*scale:0;
   const box={left:r.left-pad,top:r.top-pad,right:r.right+pad,bottom:r.bottom+pad};
   const clips=[{name:'viewport',left:0,top:0,right:innerWidth,bottom:innerHeight}];
   for(let a=el.parentElement;a;a=a.parentElement){const st=getComputedStyle(a),b=a.getBoundingClientRect();
     if(/hidden|clip|auto|scroll/.test(st.overflowX+' '+st.overflowY))clips.push({name:a.id||a.className,left:b.left,top:b.top,right:b.right,bottom:b.bottom});
   }
   const failures=clips.filter(c=>box.left<c.left-.1||box.top<c.top-.1||box.right>c.right+.1||box.bottom>c.bottom+.1);
   const hitTargets=[];
   const hits=frame||el.tagName==='H2'?[]:[[6,6],[r.width-6,6],[6,r.height-6],[r.width-6,r.height-6],[r.width/2,r.height/2]].map(([x,y])=>{const h=document.elementFromPoint(r.left+x,r.top+y);const ancestry=[];for(let n=h;n;n=n.parentElement){const s=getComputedStyle(n);ancestry.push({tag:n.tagName,id:n.id,classes:n.className,role:n.getAttribute('role'),pointerEvents:s.pointerEvents,inert:n.inert,visibility:s.visibility,opacity:s.opacity,zIndex:s.zIndex,transform:s.transform});}hitTargets.push({x:r.left+x,y:r.top+y,ancestry});return !!h&&(el===h||el.contains(h));});
   return {box,clips,failures,hits,hitTargets};
 },frame);
 const saveFailure=async v=>{
  if(v.failures.length||!v.hits.every(Boolean)){
   fs.writeFileSync(path.join(out,label+'-probe-failure.json'),JSON.stringify({probe:v,layout:await p.evaluate(layoutSnapshot)},null,2)+'\n');
   await p.screenshot({path:path.join(out,label+'-probe-failure.png')});
  }
 };
 const visibility=[];
 for(const [locator,frame] of [[p.locator('.trpg-roll-stage'),true],[p.locator('.trpg-roll-stage > h2'),false],...await p.locator('.trpg-modal-actions button').all().then(xs=>xs.map(x=>[x,false]))]){
   const v=await visible(locator,frame);await saveFailure(v);assert.deepEqual(v.failures,[],label+' clipped '+JSON.stringify(v));assert(v.hits.every(Boolean),label+' action corner obscured '+JSON.stringify(v));visibility.push(v);
 }
 // Scrollable body controls must become completely visible and operable.
 for(const control of await p.locator('.trpg-modal-body button:not(:disabled), .trpg-modal-body summary, label.trpg-aid').all()){
   if(!await control.isVisible())continue;
   await control.scrollIntoViewIfNeeded();const v=await visible(control);await saveFailure(v);assert.deepEqual(v.failures,[],label+' body control clipped '+JSON.stringify(v));assert(v.hits.every(Boolean),label+' body control obscured '+await control.getAttribute('class')+' '+JSON.stringify(v));
 }
 await p.locator('.trpg-modal-body').evaluate(n=>n.scrollTop=0);
 await p.screenshot({path:path.join(out,label+".png")});
 const metrics=await p.locator('.trpg-roll-stage').evaluate(n=>{
  const controls=[...n.querySelectorAll('button:not(:disabled),summary,label.trpg-aid')].filter(x=>x.checkVisibility());
  return {box:n.getBoundingClientRect().toJSON(),controls:controls.map(x=>{const r=x.getBoundingClientRect();return {text:x.textContent,width:r.width,height:r.height}}),overflow:n.querySelector(".trpg-modal-body").scrollWidth>n.querySelector(".trpg-modal-body").clientWidth+1};
 });
 assert(!metrics.overflow,label+' horizontal overflow '+JSON.stringify(metrics));assert(metrics.box.x>=0&&metrics.box.y>=0);assert(metrics.box.right<=await p.evaluate(()=>innerWidth)+1);assert(metrics.box.bottom<=await p.evaluate(()=>innerHeight)+1);
 for(const c of metrics.controls){assert(c.height>=43.9,`${label}: ${c.text} touch height ${c.height}`);assert(c.width>=44);}
 assert.equal(await p.locator('.trpg-die').count(),2);
 const dice=await p.locator('.trpg-die').evaluateAll(nodes=>nodes.map(n=>({
   label:n.getAttribute('aria-label'),role:n.getAttribute('role'),
   value:Number(n.querySelector('.trpg-d20-value')?.textContent),
   facets:n.querySelectorAll('svg polygon,svg path').length,
   faceOffset:(()=>{const die=n.getBoundingClientRect(),face=n.querySelector('.trpg-d20-value').getBoundingClientRect();return {
    x:face.left+face.width/2-die.left-die.width/2,y:face.top+face.height/2-die.top-die.height/2};})(),
   edges:['::before','::after'].map(x=>getComputedStyle(n,x).content),
 })));
 for(const d of dice){assert.equal(d.role,'img');assert.match(d.label,/^20面ダイス ([1-9]|1[0-9]|20)$/);
   assert.equal(d.value,Number(d.label.split(' ').at(-1)),'Numeric d20 face must match accessible value');
   assert.equal(d.facets,2,'D20 silhouette and facet edges are present');
   assert(Math.abs(d.faceOffset.x)<1&&Math.abs(d.faceOffset.y)<1,'Numeric result must be centered on its actual d20 face: '+JSON.stringify(d.faceOffset));
   assert(d.edges.every(c=>['none','""'].includes(c)),'Blank edges cannot imply another result');
 }
 const pending=(await p.evaluate(()=>__trpg.snapshot())).pending;
 assert.doesNotMatch(await p.locator('.trpg-heat').textContent(),/null|undefined/,'No placeholder text in the heat meter without momentum');
 const faceText=await p.locator('.trpg-roll-instruction,.trpg-d20-value,.trpg-dice-total > strong,.trpg-dice-grade').evaluateAll(nodes=>{
  const scale=document.getElementById('stage').getBoundingClientRect().width/1280;
  return nodes.filter(n=>n.checkVisibility()).map(n=>({text:n.textContent,size:parseFloat(getComputedStyle(n).fontSize)*scale}));
 });
 for(const text of faceText)assert(text.size>=11.9,label+' roll text must remain readable: '+JSON.stringify(text));
 if(pending){assert.deepEqual(dice.map(d=>d.value),pending.dice,'Rendered dice must match actual model');
   for(const i of [0,1])if(await ctl(p,'trpg-reroll-'+i).count())assert.match(await ctl(p,'trpg-reroll-'+i).textContent(),new RegExp(`${i+1}個目（${pending.dice[i]}）`));
 }
 const prop=p.locator('.trpg-spare-kit');assert.equal(await prop.count(),1);
 assert.equal(await prop.getAttribute('aria-hidden'),'true');assert.equal(await prop.getAttribute('role'),'presentation');
 assert.equal(await prop.locator('button,input,a,[tabindex],.trpg-die').count(),0);
 const gear=await prop.evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {display:s.display,pointer:s.pointerEvents,rect:r.toJSON(),text:n.textContent,children:n.children.length,tab:n.tabIndex}});
 assert.equal(gear.pointer,'none');assert.equal(gear.text,'');assert.equal(gear.children,0);assert.equal(gear.tab,-1);
 const vp=p.viewportSize();
 if(vp.width<=1200||vp.height<=600)assert.equal(gear.display,'none','Constrained view hides spare gear');
 else {assert.notEqual(gear.display,'none');assert(gear.rect.left>=0&&gear.rect.top>=0&&gear.rect.right<=vp.width&&gear.rect.bottom<=vp.height,'Spare gear inside viewport');
   const overlaps=await prop.evaluate(n=>{const a=n.getBoundingClientRect();return [...document.querySelectorAll('.trpg-roll-stage h2,.trpg-roll-stage button,.trpg-roll-stage summary,.trpg-roll-stage .trpg-aid,.trpg-roll-stage .trpg-die')].filter(x=>x.checkVisibility()).filter(x=>{const b=x.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}).map(x=>x.className)});
   assert.deepEqual(overlaps,[],'Spare gear must not overlap live controls/dice/title');
 }

 const aid=p.locator('.trpg-aid');if(await aid.count()){
   const textSize=await aid.locator('small').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)*document.getElementById('stage').getBoundingClientRect().width/1280);
   assert(textSize>=11.9,label+' helper explanation must remain readable');
 }

 results.push({label,visibility,...metrics});await p.screenshot({path:path.join(out,label+'.png')});
 } catch(error) {
  fs.writeFileSync(path.join(out,label+'-failure.json'),JSON.stringify(await p.evaluate(layoutSnapshot),null,2)+'\n');
  await p.screenshot({path:path.join(out,label+'-failure.png')});
  throw error;
 }
}
try{
 for(const scenario of ['ordinary-cup','shark-last-order']){
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});const p=await context.newPage();
  await p.goto(base+`trpg-preview.html?scenario=${scenario}&seed=9`);await ctl(p,'trpg-start').click();await lines(p);await declare(p);await ctl(p,'trpg-roll').waitFor();
  await p.evaluate(async()=>{for(const name of ['walnut-brass-frame','deep-teal-felt','harbour-paper-stack','spare-polyhedral-kit']){const img=new Image();img.src='img/ui/trpg/'+name+'.webp';await img.decode();if(!img.naturalWidth)throw Error('Missing material '+name);}});
  const before=await p.evaluate(()=>__trpg.snapshot());
  for(const [width,height] of [[1280,720],[800,600],[390,844],[844,390]]){
   await p.setViewportSize({width,height});await fit(p,`${scenario}-${width}x${height}`);
   await ctl(p,'trpg-details-toggle').press('Enter');assert(await ctl(p,'trpg-forecast').isVisible());await fit(p,`${scenario}-${width}x${height}-details`);
   await ctl(p,'trpg-details-toggle').press('Space');
   assert.deepEqual(await p.evaluate(()=>__trpg.snapshot()),before,'Resize/details must not change model');
  }
  await p.setViewportSize({width:1280,height:720});
  await ctl(p,'trpg-check-back').focus();await p.keyboard.press('Shift+Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('[role=dialog]')));
  await p.keyboard.press('Escape');assert.equal(await p.locator('[role=dialog]').count(),0);
  // Reopen through the real action, roll and verify committed keyboard guard.
  await ctl(p,'trpg-listen-open').click();await declare(p);await ctl(p,'trpg-roll').focus();await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.up('Enter');
  await p.keyboard.press('Escape');assert.equal(await p.locator('[role=dialog]').count(),1);
  await ctl(p,'trpg-settle').waitFor();assert.equal(await p.locator('[role=status].trpg-dice-total').count(),1);await fit(p,scenario+'-result');
  if(await ctl(p,'trpg-reroll-0').count()){await ctl(p,'trpg-reroll-0').dblclick();assert.equal(await ctl(p,'trpg-reroll-0').count(),0);}
  await ctl(p,'trpg-settle').click();await lines(p);assert.equal((await p.evaluate(()=>__trpg.snapshot())).phase,'explore');
  // Adopted table presentation: check real CSS/viewport separately from DOM ports.
  for (const [width,height] of [[1280,720],[844,390],[390,844]]) {
   await p.setViewportSize({width,height});
   await settledPreview(p);
   const seats=await p.locator('.trpg-table').evaluate(n=>{
    const r=n.getBoundingClientRect(),stage=document.getElementById('stage'),style=getComputedStyle(n);return {box:r.toJSON(),stage:stage.getBoundingClientRect().toJSON(),scale:stage.style.getPropertyValue('--k'),viewport:{width:innerWidth,height:innerHeight,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height},css:{width:style.width,height:style.height,gap:style.gap,font:style.fontSize,top:style.top,bottom:style.bottom,transform:style.transform},pointer:style.pointerEvents,visible:n.checkVisibility(),
     inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,
     active:n.querySelectorAll('.trpg-table-person.active').length,
     speaking:n.querySelector('.trpg-table-person.active .trpg-seat-speaking')?.textContent};
   });
   assert(seats.visible&&seats.inside, 'Seat rail fits '+width+'x'+height+' '+JSON.stringify(seats));
   assert.equal(seats.pointer,'none');assert.equal(seats.active,1);assert.equal(seats.speaking,'話者');
  }
  await p.setViewportSize({width:1280,height:720});
  assert.equal(await p.locator('.trpg-table-clue').count(),0);
  // Reach the real preparation check, retaining canonical helper and scene.
  const scenarioData=await p.evaluate(async id=>{const cat=await (await fetch('../data/trpg_catalog.json')).json();return (await fetch('../data/'+cat.scenarios.find(x=>x.id===id).file)).json();},scenario);
  for(const [index,spot] of scenarioData.spots.slice(0,3).entries()){
   await ctl(p,'trpg-spot-'+spot.id).click();await lines(p);
   assert.equal(await p.locator('.trpg-table-clue').count(),index+1);
   const beforeMemo=await p.evaluate(()=>__trpg.snapshot());
   await ctl(p,'trpg-compare-notes').tap();assert.equal(await p.locator('.trpg-note-card').count(),index+1);
   await ctl(p,'trpg-notes-close').press('Enter');assert.deepEqual(await p.evaluate(()=>__trpg.snapshot()),beforeMemo);
  }
  await ctl(p,'trpg-interpret').click();await ctl(p,'trpg-hypothesis-'+scenarioData.hypotheses[0].id).click();await lines(p);
  for(const field of scenarioData.flow?.prepare||['aroma','seat'])await ctl(p,'trpg-plan-'+field+'-'+scenarioData.options[field][0].id).click();
  await ctl(p,'trpg-prepare-open').click();await declare(p);
  const helper=scenarioData.checks.prepare.helper;
  const lead=scenarioData.checks.prepare.approaches[0],leadBase=scenarioData.cast.find(c=>c.id===lead.actor).sheet.stats[lead.stat];
  assert(await ctl(p,'trpg-support-'+helper).isEnabled());
  assert.match(await p.locator('.trpg-aid-art img').getAttribute('src'),new RegExp(helper));
  for(const [width,height] of [[1280,720],[800,600],[390,844],[844,390]]){
    await p.setViewportSize({width,height});await fit(p,`${scenario}-aid-${width}x${height}`);
    await ctl(p,'trpg-details-toggle').press('Enter');await fit(p,`${scenario}-aid-${width}x${height}-details`);await ctl(p,'trpg-details-toggle').press('Space');
    await ctl(p,'trpg-support-'+helper).press('Space');assert(await ctl(p,'trpg-support-'+helper).isChecked());
    const momentum=(await p.evaluate(()=>__trpg.snapshot())).momentum; // table excitement adds to the shown bonus
    assert.equal(await ctl(p,'trpg-bonus').textContent(),'＋'+(leadBase+7+momentum*4));await ctl(p,'trpg-support-'+helper).press('Space');
  }
  await ctl(p,'trpg-support-'+helper).check();await ctl(p,'trpg-roll').click();await ctl(p,'trpg-settle').waitFor();
  assert((await p.evaluate(()=>__trpg.snapshot())).used[helper]);assert.equal(await ctl(p,'trpg-reroll-0').count(),0,'Spent teamwork and used reroll cannot offer another reroll');
  await fit(p,scenario+'-help-used-result');
  await ctl(p,'trpg-settle').click();await lines(p);
  for(const field of scenarioData.flow?.serve||['approach'])await ctl(p,'trpg-plan-'+field+'-'+scenarioData.options[field][0].id).click();
  await ctl(p,'trpg-serve-open').click();await declare(p);assert.equal(await p.locator('.trpg-aid input').count(),0,'No teamwork means helper unavailable');
  await fit(p,scenario+'-help-unavailable');
  await context.close();
 }
 for(const scenario of ['ordinary-cup','shark-last-order'])for(const [width,height] of [[1280,720],[800,600],[390,844],[844,390]]){
   const c=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});const p=await c.newPage();
   await p.goto(base+`trpg-preview.html?scenario=${scenario}&seed=9`);await ctl(p,'trpg-start').click();await lines(p);await declare(p);
   await p.setViewportSize({width,height});await ctl(p,'trpg-details-toggle').press('Enter');await ctl(p,'trpg-roll').click();await ctl(p,'trpg-settle').waitFor();
   await fit(p,`${scenario}-${width}x${height}-actual-result`);
   assert(await ctl(p,'trpg-reroll-0').count());await ctl(p,'trpg-reroll-0').click();await ctl(p,'trpg-settle').waitFor();
   await fit(p,`${scenario}-${width}x${height}-rerolled-result`);
   await ctl(p,'trpg-settle').click();await p.setViewportSize({width:1280,height:720});await lines(p);assert.equal((await p.evaluate(()=>__trpg.snapshot())).phase,'explore');await c.close();
 }
 // Reduced motion uses the same actual dice and spare equipment in both stories.
 for(const scenario of ['ordinary-cup','shark-last-order']){
   const c=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});const p=await c.newPage();
   await p.goto(base+`trpg-preview.html?scenario=${scenario}&seed=9`);await ctl(p,'trpg-start').click();await lines(p);await declare(p);
   await ctl(p,'trpg-roll').click();
   await assertReducedDice(p);
   await ctl(p,'trpg-settle').waitFor();await assertReducedDice(p);await fit(p,scenario+'-reduced-motion-result');await c.close();
 }
 // Discover deterministic seeds with the unchanged real model, then roll in DOM.
 const scenarioData=JSON.parse(fs.readFileSync(new URL('../../../data/dialogue/trpg_ordinary.json',import.meta.url)));
 const seeds={};for(let seed=1;Object.keys(seeds).length<3&&seed<1000;seed++){const m=new TrpgSession(scenarioData,{seed});m.start();const r=m.beginCheck('listen');seeds[r.grade]??=seed;}
 assert.equal(Object.keys(seeds).length,3);
 for(const [grade,seed] of Object.entries(seeds)){
   const c=await browser.newContext();const p=await c.newPage();await p.goto(base+`trpg-preview.html?scenario=ordinary-cup&seed=${seed}`);await ctl(p,'trpg-start').click();await lines(p);await declare(p);
   await ctl(p,'trpg-roll').click();assert(await ctl(p,'trpg-roll').isDisabled());await p.screenshot({path:path.join(out,'rolling-'+grade+'.png')});await ctl(p,'trpg-settle').waitFor();assert.equal(await ctl(p,'trpg-roll-total').getAttribute('data-grade'),grade);await fit(p,'grade-'+grade);await c.close();
 }
 // Deliberately fail all decorative resources; live content stays usable.
 const c=await browser.newContext();const p=await c.newPage();await p.route(/\/(walnut-brass-frame|deep-teal-felt|harbour-paper-stack|spare-polyhedral-kit)\.webp$/,r=>r.abort());
 await p.goto(base+'trpg-preview.html?scenario=ordinary-cup&seed=9');await ctl(p,'trpg-start').click();await lines(p);await declare(p);await fit(p,'missing-decoration');await ctl(p,'trpg-roll').click();await ctl(p,'trpg-settle').waitFor();await ctl(p,'trpg-settle').click();await lines(p);assert.equal((await p.evaluate(()=>__trpg.snapshot())).phase,'explore');await c.close();
}finally{await browser.close();fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2)+'\n');}
console.log('PASS tabletop viewport, live input, state invariance and missing image checks');

