const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const out=require('path').join(__dirname,'qa'); fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'}); const results=[];
 for(const scene of ['night','open']) for(const [mode,opts] of [['pc',{viewport:{width:1280,height:720}}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]){
  const name=scene+'-'+mode; const context=await browser.newContext({...opts,reducedMotion:'reduce'}); const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/',{waitUntil:'load'});await page.locator('[data-test="title-new"]').waitFor({timeout:30000});await page.locator('#boot').waitFor({state:'detached'});
  await page.evaluate(async(scene)=>{window.Q={core:await import('./js/core/state.js'),same:await import('./js/daily/samechan.js'),ui:await import('./js/core/ui.js'),vn:await import('./js/vn/engine.js'),ch:await import('./js/chapters/ch1.js')}; const s=Q.core.newGame();Object.assign(s,{chapter:1,phase:'daily',day:8,slot:1});Q.ch.setupHooks();Q.core.config.textSpeed=4;Q.ui.clearScreen();if(scene==='night')window.encounter=Q.same.playSamechanEncounter();else{Object.assign(s,{chapter:2,day:1,slot:0});s.flags._samechan_first_encounter=true;s.flags._samechan_nickname_known=true;window.encounter=Q.same.visitSamechan(Q.same.samechanSpot());}},scene);
  await page.locator('.vn-text').waitFor({state:'visible',timeout:30000}); await page.waitForTimeout(1000);
  const bg=await page.locator('#bg').evaluate(e=>[...e.querySelectorAll('*')].map(n=>getComputedStyle(n).backgroundImage).filter(s=>s.includes('shishark')));
  if(!bg.some(s=>s.includes(scene==='night'?'bg_shishark_preparing_night.webp':'bg_shishark.webp')))throw Error('Wrong runtime background '+bg);
  await page.screenshot({path:`${out}/${name}-encounter.png`});
  let found=scene==='open';
  for(let i=0;scene==='night' && i<75;i++){
   if(await page.locator('.vn-name').textContent()==='コロちゃん'){found=true;break;}
   const c=page.locator('.vn-choice').first();if(await c.isVisible())await c.click();else await page.locator('.vn-box').click();await page.waitForTimeout(110);
  }
  if(!found)throw Error('Korochan name not reached');await page.waitForTimeout(500);if(scene==='night')await page.screenshot({path:`${out}/${name}-korochan.png`});
  if(errors.length)throw Error(errors.join('\n'));
  results.push({name,background:bg,korochan:scene==='night'?found:null,errors});await context.close();
 }
 await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
