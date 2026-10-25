import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium', headless:true });
const page = await browser.newPage({ viewport:{ width:1320, height:950 } });
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
const base = process.env.BASE_URL || 'http://127.0.0.1:8123';
try {
 await page.goto(`${base}/remake/map-comparison.html`);
 await page.evaluate(()=>localStorage.setItem('map-comparison-sentinel','keep'));
 const originalStorage = await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
 const frame = page.frameLocator('iframe');
 await frame.locator('[data-test="pin-naru"]').waitFor();
 await frame.locator('[data-test="pin-naru"]').click();
 const name = await frame.locator('.mi-banner').textContent();
 await page.locator('[data-variant="improved"]').click();
 await frame.locator('body[data-map-variant="improved"]').waitFor();
 assert.equal(await frame.locator('.mi-banner').textContent(),name);
 for (const size of ['844,390','667,375','1280,720']) {
  await page.selectOption('#size',size);
  await page.waitForTimeout(300);
  const metrics=await frame.locator('.map-info').evaluate(n=>{
   const r=n.getBoundingClientRect(), go=n.querySelector('.mi-go').getBoundingClientRect();
   const label=n.querySelector('.mi-banner'), lr=label.getBoundingClientRect();
   return {left:r.left, right:r.right, bottom:r.bottom, width:innerWidth,height:innerHeight,
    goHeight:go.height, text:parseFloat(getComputedStyle(label).fontSize)*lr.width/label.offsetWidth};
  });
  assert(metrics.left>=0 && metrics.right<=metrics.width+1 && metrics.bottom<=metrics.height+1,JSON.stringify(metrics));
  if(size!=='1280,720') { assert(metrics.goHeight>=43.5,JSON.stringify(metrics)); assert(metrics.text>=15,JSON.stringify(metrics)); }
  if(process.env.SHOTS) {
   fs.mkdirSync(process.env.SHOTS,{recursive:true});
   await frame.locator('body').screenshot({path:`${process.env.SHOTS}/improved-${size.replace(',','x')}.png`});
   await page.locator('[data-variant="current"]').click();
   await frame.locator('body[data-map-variant="current"]').waitFor();
   await frame.locator('body').screenshot({path:`${process.env.SHOTS}/current-${size.replace(',','x')}.png`});
   await page.locator('[data-variant="improved"]').click();
   await frame.locator('body[data-map-variant="improved"]').waitFor();
  }
 }
 await page.selectOption('#size','844,390');
 await frame.locator('[data-test="pin-naru"]').click();
 assert.equal(await frame.locator('.spot-pin.sel').count(),1);
 assert.equal(await page.locator('#result').textContent(),'');
 await frame.locator('.comparison-close').click();
 await frame.locator('.map-info').waitFor({state:'hidden'});
 await frame.locator('[data-test="pin-c_station"]').click();
 await frame.locator('.map-info').waitFor({state:'visible'});
 await frame.locator('[data-test="map-go"]').click();
 await page.waitForFunction(()=>document.querySelector('#result').textContent.length>0);
 await frame.locator('[data-test="pin-naru"]').waitFor();
 await page.selectOption('#scenario','closed');
 await frame.locator('[data-test="pin-naru"]').click();
 assert.equal(await frame.locator('[data-test="map-go"]').count(),0);
 await page.selectOption('#city','widehanga');
 await frame.locator('[data-test="pin-ch2_shop"]').click();
 assert.match(await frame.locator('.mi-banner').textContent(),/柚ヶ谷/);
 await page.selectOption('#scenario','unknown');
 await frame.locator('[data-test="pin-ch2_shop"]').waitFor();
 assert.equal(await frame.locator('[data-test="pin-ch2_aquarium"]').count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort())),originalStorage);
 assert.deepEqual(errors,[]);
 console.log('PASS: same selection, 3 sizes, two-step confirmation, closed shop, chapter 2, unrevealed place, storage isolation');
} finally { await browser.close(); }
