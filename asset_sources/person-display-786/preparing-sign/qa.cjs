const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const out=require('path').join(__dirname,'qa'); fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'}); const results=[];
 for(const [name,opts] of [['pc',{viewport:{width:1280,height:720}}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext({...opts,reducedMotion:'reduce'}); const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/',{waitUntil:'load'});await page.locator('[data-test="title-new"]').waitFor({timeout:30000});await page.locator('#boot').waitFor({state:'detached'});
  await page.evaluate(async()=>{window.Q={core:await import('./js/core/state.js'),same:await import('./js/daily/samechan.js'),ui:await import('./js/core/ui.js'),vn:await import('./js/vn/engine.js'),ch:await import('./js/chapters/ch1.js')}; const s=Q.core.newGame();Object.assign(s,{chapter:1,phase:'daily',day:8,slot:1});Q.ch.setupHooks();Q.core.config.textSpeed=4;Q.ui.clearScreen();window.encounter=Q.same.playSamechanEncounter();});
  await page.locator('.vn-text').filter({hasText:'帰り道'}).waitFor({timeout:30000}); await page.waitForTimeout(1000);
  const bg=await page.locator('#bg').evaluate(e=>[...e.querySelectorAll('*')].map(n=>getComputedStyle(n).backgroundImage).filter(s=>s.includes('shishark')));
  if(!bg.some(s=>s.includes('bg_shishark_preparing_night.webp')))throw Error('Wrong runtime background '+bg);
  await page.screenshot({path:`${out}/${name}-encounter.png`});
  let found=false;
  for(let i=0;i<75;i++){
   if(await page.locator('.vn-name').textContent()==='コロちゃん'){found=true;break;}
   const c=page.locator('.vn-choice').first();if(await c.isVisible())await c.click();else await page.locator('.vn-box').click();await page.waitForTimeout(110);
  }
  if(!found)throw Error('Korochan name not reached');await page.waitForTimeout(500);await page.screenshot({path:`${out}/${name}-korochan.png`});
  if(errors.length)throw Error(errors.join('\n'));
  results.push({name,background:bg,korochan:found,errors});await context.close();
 }
 await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
