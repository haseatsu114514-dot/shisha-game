import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {layoutSnapshot,settledPreview} from './trpg_layout.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const out=path.resolve(process.env.ARTIFACT_DIR||'docs/qa/trpg-roll-ui-issue596/ci-resize-fix');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();const records=[];
try{for(const scenario of ['ordinary-cup','shark-last-order']){
 const c=await b.newContext({viewport:{width:1280,height:720},hasTouch:true});
 // Hold only application resize callbacks, simulating delivery after the test command.
 await c.addInitScript(()=>{const add=EventTarget.prototype.addEventListener;window.__resizeGate={hold:false,pending:[],release(){this.hold=false;for(const cb of this.pending.splice(0))cb();}};
  EventTarget.prototype.addEventListener=function(type,cb,options){if(type==='resize'&&(this===window||this===visualViewport)){
   const target=this;return add.call(this,type,function(event){const run=()=>cb.call(target,event);if(__resizeGate.hold)__resizeGate.pending.push(run);else run();},options);
  }return add.call(this,type,cb,options);};});
 const p=await c.newPage();await p.goto((process.env.BASE_URL||'http://127.0.0.1:8123/remake/')+`trpg-preview.html?scenario=${scenario}&seed=9`);
 await p.locator('[data-test=trpg-start]').click();for(let i=0;i<60&&await p.locator('[data-test=trpg-next]').isVisible();i++)await p.locator('[data-test=trpg-next]').click();
 // Declare the first approach (the player's own character) and read the GM's call before the roll stage.
 await p.locator('[data-test^="trpg-approach-"]').first().click();for(let i=0;i<60&&await p.locator('[data-test=trpg-next]').isVisible();i++)await p.locator('[data-test=trpg-next]').click();
 await p.locator('[data-test=trpg-roll]').waitFor();
 for(const details of [false,true]){
  if(details)await p.locator('[data-test=trpg-details-toggle]').press('Enter');
  for(const [width,height]of [[1280,720],[800,600],[390,844]]){await p.setViewportSize({width,height});await settledPreview(p);}
  await p.evaluate(()=>__resizeGate.hold=true);await p.setViewportSize({width:844,height:390});
  // An RAF guarantees native resize events have reached the gate, without a sleep.
  await p.waitForFunction(()=>__resizeGate.pending.length>0,null,{polling:'raf'});
  const stale=await p.evaluate(layoutSnapshot);records.push({scenario,details,state:'before-fit',...stale});
  fs.writeFileSync(path.join(out,`${scenario}-${details}-before-fit.json`),JSON.stringify(stale,null,2));
  await p.screenshot({path:path.join(out,`${scenario}-${details}-before-fit.png`)});
  assert.equal(stale.rotate.hidden,false);assert.equal(stale.rotate.display,'block');
  assert(stale.actions.every(a=>a.points.every(x=>!x.hit&&x.target[0].id==='trpg-rotate')),'All five old probes must detect the rotate overlay');
  // Readiness must stay pending while the real resize handler has not run.
  await assert.rejects(settledPreview(p,150),/Timeout/);
  await p.evaluate(()=>__resizeGate.release());await settledPreview(p);
  const ready=await p.evaluate(layoutSnapshot);records.push({scenario,details,state:'after-fit',...ready});
  assert(ready.actions.every(a=>a.points.every(x=>x.hit)));
  await p.screenshot({path:path.join(out,`${scenario}-${details}-after-fit.png`)});
  // Persistent unrelated obstruction is not part of readiness and remains a failure.
  await p.evaluate(()=>{const e=document.createElement('div');e.id='persistent-obstruction';e.style='position:fixed;inset:0;z-index:2000;background:#0008';document.body.append(e);});
  await settledPreview(p);const blocked=await p.evaluate(layoutSnapshot);records.push({scenario,details,state:'persistent-obstruction',...blocked});
  assert(blocked.actions.every(a=>a.points.every(x=>!x.hit&&x.target[0].id==='persistent-obstruction')));
  await p.evaluate(()=>document.getElementById('persistent-obstruction').remove());
 }await c.close();
}}finally{await b.close();fs.writeFileSync(path.join(out,'resize-regression.json'),JSON.stringify(records,null,2)+'\n');}
console.log('PASS delayed resize negative/positive and persistent obstruction controls (both scenarios/details states)');
