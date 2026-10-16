const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const target='https://haseatsu114514-dot.github.io/shisha-game/remake/chapter-titles-preview.html';
const result={startedAt:new Date().toISOString(),target,mode:'fresh-PC-preview-1-2-4-5',viewport:{width:1280,height:720},hasTouch:false,console:[],logEntries:[],httpErrors:[],failedRequests:[],pageErrors:[],actions:[],checks:[],scope:'read-only public preview; no user profile or runtime edits'};
let phase='launch';const stamp=()=>({at:new Date().toISOString(),phase});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:result.viewport});
const page=await context.newPage();const cdp=await context.newCDPSession(page);const requests=new Map();
page.on('console',m=>{if(['error','warning'].includes(m.type()))result.console.push({...stamp(),type:m.type(),text:m.text(),location:m.location()})});
page.on('pageerror',e=>result.pageErrors.push({...stamp(),message:e.message}));
cdp.on('Network.requestWillBeSent',e=>requests.set(e.requestId,{url:e.request.url,requestPhase:phase,type:e.type,initiatorType:e.initiator?.type}));
cdp.on('Network.responseReceived',e=>{if(e.response.status>=400)result.httpErrors.push({...stamp(),...requests.get(e.requestId),url:e.response.url,status:e.response.status,type:e.type})});
cdp.on('Network.loadingFailed',e=>result.failedRequests.push({...stamp(),...requests.get(e.requestId),errorText:e.errorText,canceled:e.canceled,type:e.type}));
cdp.on('Log.entryAdded',e=>{const l=e.entry;if(['error','warning'].includes(l.level))result.logEntries.push({...stamp(),source:l.source,level:l.level,text:l.text,url:l.url,lineNumber:l.lineNumber,networkRequestId:l.networkRequestId})});
try {
 await Promise.all([cdp.send('Network.enable'),cdp.send('Log.enable')]);
 phase='initial-navigation';result.actions.push({...stamp(),action:'goto preview'});
 await page.goto(target,{waitUntil:'networkidle'});await page.waitForTimeout(1200);
 const pub=await context.request.get(target);const bytes=await pub.body();
 result.publicPreviewHash={status:pub.status(),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),checkoutSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../../../../remake/chapter-titles-preview.html',import.meta.url))).digest('hex')};
 assert.equal(result.publicPreviewHash.sha256,result.publicPreviewHash.checkoutSha256);
 await page.evaluate(()=>localStorage.setItem('suien_remake_save','followup-qa-preserve'));
 const snapshot=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));const before=await snapshot();
 for(const chapter of [1,2,4,5]) {
  phase=`chapter-${chapter}-select-and-play`;result.actions.push({...stamp(),action:'selectOption then click play',chapter});
  await page.locator('#chapter').selectOption(String(chapter));await page.locator('#play').click();await page.locator('.chapter-card.show').waitFor();
  const art=await page.locator('.cc-art').evaluate(async i=>{await i.decode();return {src:i.src,width:i.naturalWidth,height:i.naturalHeight,fit:getComputedStyle(i).objectFit}});
  assert.equal(art.width,1280);assert.equal(art.height,720);assert.equal(art.fit,'contain');assert.equal(await page.locator('.cc-copy').isVisible(),false);
  phase=`chapter-${chapter}-playback`;await page.waitForFunction(()=>!document.querySelector('#play').disabled,{},{timeout:30000});
  assert.equal(await snapshot(),before);result.checks.push({...stamp(),chapter,art,storageUnchanged:true,domTitleHidden:true});
 }
 phase='after-last-playback';await page.waitForTimeout(1200);result.completed=true;
} catch(e) {result.completed=false;result.failure={...stamp(),message:e.stack};process.exitCode=1;}
finally {result.browser=browser.version();result.finishedAt=new Date().toISOString();await browser.close();fs.writeFileSync(new URL('./console-followup.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({completed:result.completed,checks:result.checks.length,httpErrors:result.httpErrors,failedRequests:result.failedRequests,pageErrors:result.pageErrors,console:result.console},null,2));
