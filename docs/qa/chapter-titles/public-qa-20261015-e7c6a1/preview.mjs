import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
for (const [device,viewport,hasTouch] of [['pc',{width:1280,height:720},false],['touch',{width:844,height:390},true]]) {
 const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch});
 const page=await context.newPage(); const consoleLog=[], network=[];
 page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleLog.push({type:m.type(),text:m.text()})});
 page.on('pageerror',e=>consoleLog.push({type:'pageerror',text:e.message}));
 page.on('response',r=>{if(r.status()>=400)network.push({status:r.status(),url:r.url()})});
 await page.goto('https://haseatsu114514-dot.github.io/shisha-game/remake/chapter-titles-preview.html');
 await page.evaluate(()=>localStorage.setItem('suien_remake_save','public-qa-preserve'));
 const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
 const before=await snapshot();
 for(const chapter of [1,2,4,5]) {
 await page.locator('#chapter').selectOption(String(chapter));
 if(hasTouch) await page.locator('#play').tap(); else await page.locator('#play').click();
 await page.locator('.chapter-card.show').waitFor();
 const geometry=await page.locator('.cc-art').evaluate(async i=>{await i.decode();const r=i.getBoundingClientRect();return {size:[i.naturalWidth,i.naturalHeight],fit:getComputedStyle(i).objectFit,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5}});
 assert.deepEqual(geometry,{size:[1280,720],fit:'contain',inside:true});
 assert.equal(await page.locator('.cc-copy').isVisible(),false);
 await page.waitForTimeout(650);
 await page.screenshot({path:out+device+'-preview-'+chapter+'.png'});
 await page.waitForFunction(()=>!document.querySelector('#play').disabled);
 assert.equal(await snapshot(),before);
 results.push({device,viewport,hasTouch,chapter,geometry,storageUnchanged:true});
 }
 results.push({device,consoleLog,network});
 await context.close();
}
fs.writeFileSync(out+'preview.json',JSON.stringify({at:new Date().toISOString(),browser:browser.version(),results},null,2)+'\n');
await browser.close();
