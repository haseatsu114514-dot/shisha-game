import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {TrpgSession} from '../../js/trpg/session.js';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8123/remake/';
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/trpg-roll-ui-issue596');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
const ctl=(p,id)=>p.locator(`[data-test="${id}"]`);
async function lines(p){for(let n=0;n<60&&await ctl(p,'trpg-next').isVisible();n++)await ctl(p,'trpg-next').click();}
async function fit(p,label){
 await p.screenshot({path:path.join(out,label+".png")});
 const metrics=await p.locator('.trpg-roll-stage').evaluate(n=>{
  const controls=[...n.querySelectorAll('button:not(:disabled),summary,label.trpg-aid')].filter(x=>x.checkVisibility());
  return {box:n.getBoundingClientRect().toJSON(),controls:controls.map(x=>{const r=x.getBoundingClientRect();return {text:x.textContent,width:r.width,height:r.height}}),overflow:n.querySelector(".trpg-modal-body").scrollWidth>n.querySelector(".trpg-modal-body").clientWidth+1};
 });
 assert(!metrics.overflow,label+' horizontal overflow '+JSON.stringify(metrics));assert(metrics.box.x>=0&&metrics.box.y>=0);assert(metrics.box.right<=await p.evaluate(()=>innerWidth)+1);assert(metrics.box.bottom<=await p.evaluate(()=>innerHeight)+1);
 for(const c of metrics.controls){assert(c.height>=43.9,`${label}: ${c.text} touch height ${c.height}`);assert(c.width>=44);}
 assert.equal(await p.locator('.trpg-die').count(),2);
 const aid=p.locator('.trpg-aid');if(await aid.count()){
   const textSize=await aid.locator('small').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)*document.getElementById('stage').getBoundingClientRect().width/1280);
   assert(textSize>=11.9,label+' helper explanation must remain readable');
 }

 results.push({label,...metrics});await p.screenshot({path:path.join(out,label+'.png')});
}
try{
 for(const scenario of ['ordinary-cup','shark-last-order']){
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});const p=await context.newPage();
  await p.goto(base+`trpg-preview.html?scenario=${scenario}&seed=9`);await ctl(p,'trpg-start').click();await lines(p);await ctl(p,'trpg-roll').waitFor();
  await p.evaluate(async()=>{for(const name of ['walnut-brass-frame','deep-teal-felt','harbour-paper-stack']){const img=new Image();img.src='img/ui/trpg/'+name+'.webp';await img.decode();if(!img.naturalWidth)throw Error('Missing material '+name);}});
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
  await ctl(p,'trpg-listen-open').click();await ctl(p,'trpg-roll').focus();await p.keyboard.down('Enter');await p.keyboard.down('Enter');await p.keyboard.up('Enter');
  await p.keyboard.press('Escape');assert.equal(await p.locator('[role=dialog]').count(),1);
  await ctl(p,'trpg-settle').waitFor();assert.equal(await p.locator('[role=status].trpg-dice-total').count(),1);await fit(p,scenario+'-result');
  if(await ctl(p,'trpg-reroll-0').count()){await ctl(p,'trpg-reroll-0').dblclick();assert.equal(await ctl(p,'trpg-reroll-0').count(),0);}
  await ctl(p,'trpg-settle').click();await lines(p);assert.equal((await p.evaluate(()=>__trpg.snapshot())).phase,'explore');
  // Reach the real preparation check, retaining canonical helper and scene.
  const scenarioData=await p.evaluate(async id=>{const cat=await (await fetch('../data/trpg_catalog.json')).json();return (await fetch('../data/'+cat.scenarios.find(x=>x.id===id).file)).json();},scenario);
  for(const spot of scenarioData.spots.slice(0,3)){await ctl(p,'trpg-spot-'+spot.id).click();await lines(p);}
  await ctl(p,'trpg-interpret').click();await ctl(p,'trpg-hypothesis-'+scenarioData.hypotheses[0].id).click();await lines(p);
  for(const field of scenarioData.flow?.prepare||['aroma','seat'])await ctl(p,'trpg-plan-'+field+'-'+scenarioData.options[field][0].id).click();
  await ctl(p,'trpg-prepare-open').click();
  const helper=scenarioData.checks.prepare.helper;
  assert(await ctl(p,'trpg-support-'+helper).isEnabled());
  assert.match(await p.locator('.trpg-aid-art img').getAttribute('src'),new RegExp(helper));
  for(const [width,height] of [[1280,720],[800,600],[390,844],[844,390]]){
    await p.setViewportSize({width,height});await fit(p,`${scenario}-aid-${width}x${height}`);
    await ctl(p,'trpg-support-'+helper).press('Space');assert(await ctl(p,'trpg-support-'+helper).isChecked());
    assert.match(await ctl(p,'trpg-bonus').textContent(),/3/);await ctl(p,'trpg-support-'+helper).press('Space');
  }
  await ctl(p,'trpg-support-'+helper).check();await ctl(p,'trpg-roll').click();await ctl(p,'trpg-settle').waitFor();
  assert((await p.evaluate(()=>__trpg.snapshot())).used[helper]);assert.equal(await ctl(p,'trpg-reroll-0').count(),0,'Spent teamwork and used reroll cannot offer another reroll');
  await fit(p,scenario+'-help-used-result');
  await ctl(p,'trpg-settle').click();await lines(p);
  for(const field of scenarioData.flow?.serve||['approach'])await ctl(p,'trpg-plan-'+field+'-'+scenarioData.options[field][0].id).click();
  await ctl(p,'trpg-serve-open').click();assert.equal(await p.locator('.trpg-aid input').count(),0,'No teamwork means helper unavailable');
  await fit(p,scenario+'-help-unavailable');
  await context.close();
 }
 // Discover deterministic seeds with the unchanged real model, then roll in DOM.
 const scenarioData=JSON.parse(fs.readFileSync(new URL('../../../data/dialogue/trpg_ordinary.json',import.meta.url)));
 const seeds={};for(let seed=1;Object.keys(seeds).length<3&&seed<1000;seed++){const m=new TrpgSession(scenarioData,{seed});m.start();const r=m.beginCheck('listen');seeds[r.grade]??=seed;}
 assert.equal(Object.keys(seeds).length,3);
 for(const [grade,seed] of Object.entries(seeds)){
   const c=await browser.newContext();const p=await c.newPage();await p.goto(base+`trpg-preview.html?scenario=ordinary-cup&seed=${seed}`);await ctl(p,'trpg-start').click();await lines(p);
   await ctl(p,'trpg-roll').click();assert(await ctl(p,'trpg-roll').isDisabled());await p.screenshot({path:path.join(out,'rolling-'+grade+'.png')});await ctl(p,'trpg-settle').waitFor();assert.equal(await ctl(p,'trpg-roll-total').getAttribute('data-grade'),grade);await fit(p,'grade-'+grade);await c.close();
 }
 // Deliberately fail only the three decorative resources; live content stays usable.
 const c=await browser.newContext();const p=await c.newPage();await p.route(/\/(walnut-brass-frame|deep-teal-felt|harbour-paper-stack)\.webp$/,r=>r.abort());
 await p.goto(base+'trpg-preview.html?scenario=ordinary-cup&seed=9');await ctl(p,'trpg-start').click();await lines(p);await fit(p,'missing-decoration');await ctl(p,'trpg-roll').click();await ctl(p,'trpg-settle').waitFor();await ctl(p,'trpg-settle').click();await lines(p);assert.equal((await p.evaluate(()=>__trpg.snapshot())).phase,'explore');await c.close();
}finally{await browser.close();fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2)+'\n');}
console.log('PASS tabletop viewport, live input, state invariance and missing image checks');
