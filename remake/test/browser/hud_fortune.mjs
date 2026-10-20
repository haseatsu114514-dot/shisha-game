import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const baseline = process.env.BASELINE === '1', phase = baseline ? 'before' : 'after';
const out = process.env.ARTIFACT_DIR || 'docs/qa/hud-fortune-682'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const results = [];
try {
 for (const [device,viewport,touch] of [['pc',{width:1280,height:900},false],['landscape',{width:844,height:390},true],['portrait',{width:390,height:844},true]]) for (const layout of ['normal','ds']) {
  const context = await browser.newContext({ viewport, isMobile:touch, hasTouch:touch, reducedMotion:'reduce' });
  const page = await context.newPage(), errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(layout=>localStorage.setItem('suien_title_layout',layout),layout);
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.locator('[data-test="title-new"]').waitFor({timeout:45000}); await page.locator('#boot').waitFor({state:'detached'});
  await page.evaluate(async()=>{
   window.H={ core:await import('./js/core/state.js'), hud:await import('./js/daily/hud.js'), map:await import('./js/daily/map.js') };
   const s=H.core.newGame(); Object.assign(s,{phase:'daily',day:3,slot:0,seed:131,weatherSeed:4,money:90000,stamina:70});
   Object.assign(s.met,{sumi:true,tsumugi:true,naru:true,adam:true,minto:true});
   H.hud.initHud({}); H.hud.showHud(true); window.flow=H.map.chooseSpot();
  });
  await page.locator('.map:not(.done)').waitFor(); await page.evaluate(()=>document.fonts.ready);
  const saved=await page.evaluate(()=>JSON.stringify(H.core.state));
  const hud=await page.evaluate(()=>{
   const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   const card=document.querySelector('.hud-card'),stamina=document.querySelector('.hud-stamina');
   return {card:rect(card),stamina:rect(stamina),integrated:card.contains(stamina),visible:getComputedStyle(stamina).display!=='none',
    text:card.textContent,operations:[...document.querySelectorAll('.hud-right button')].map(rect)};
  });
  const rotates=device==='portrait' && layout==='normal';
  if(!baseline){
   assert(hud.integrated && hud.visible,'stamina must be visible inside the unified HUD');
   assert(hud.stamina.left>=hud.card.left-1 && hud.stamina.right<=hud.card.right+1 && hud.stamina.bottom<=hud.card.bottom+1,'stamina escapes unified frame');
   if(!rotates) assert(hud.operations.every(b=>b.left>=hud.card.right || b.top>=hud.card.bottom),'HUD overlaps LIME/status/menu');
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(H.core.state)),saved);
  await page.screenshot({path:`${out}/${phase}-${device}-${layout}.jpg`,type:'jpeg',quality:80});
  if(device==='pc' && layout==='normal') {
   const r=await page.locator('.hud-card').boundingBox();
   await page.screenshot({path:`${out}/${phase}-hud.png`,clip:{x:r.x-4,y:r.y-4,width:r.width+8,height:r.height+8}});
  }
  assert.deepEqual(errors,[]);results.push({device,layout,hud,errors});await context.close();console.log(`PASS HUD ${phase}: ${device}/${layout}`);
 }
} finally { fs.writeFileSync(`${out}/${phase}.json`,JSON.stringify({ref:process.env.TEST_REF||null,results},null,2)+'\n');await browser.close(); }
