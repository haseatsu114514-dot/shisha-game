const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');const {chromium}=require(path.join(root,'remake/test/browser/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});const checks=[];try{
 for(const viewport of [{width:1280,height:720},{width:844,height:390}])for(const version of ['before','after']){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(version==='before')await page.route('**/img/sprites/characters/salaryman/chr_salaryman_smile.webp',route=>route.fulfill({path:path.join(root,'asset_sources/portraits/size-alignment-review/salaryman-smile-before.png'),contentType:'image/png'}));
  await page.goto('http://127.0.0.1:8123/remake/');await page.locator('[data-test="title-new"]').waitFor();await page.locator('#boot').waitFor({state:'detached'});
  await page.evaluate(async()=>{const s=await import('./js/core/state.js');s.newGame();s.state.met.salaryman=true;const vn=await import('./js/vn/engine.js');window.reviewRun=vn.play({dialogue_id:'__salaryman_size_review',metadata:{bg:'peppermint.png'},lines:['normal','smile'].map(face=>({speaker:'salaryman',face,text:'表情確認。'}))});});
  for(const face of ['normal','smile']){
   await page.waitForFunction(face=>[...document.querySelectorAll('.portrait.active')].some(i=>i.src.endsWith(`chr_salaryman_${face}.webp`)&&i.complete&&i.naturalWidth),face);await page.waitForTimeout(750);
   const info=await page.locator('.portrait.active').evaluate(i=>{const r=i.getBoundingClientRect();return {src:i.src,width:r.width,height:r.height,x:r.x,y:r.y,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight};});
   assert.equal(info.naturalWidth,896);assert.equal(info.naturalHeight,1200);assert.deepEqual(errors,[]);
   checks.push({version,face,viewport,errors:[...errors],...info});
   if(face==='smile')await page.screenshot({path:path.join(__dirname,`salaryman-${version}-${viewport.width}.jpg`)});else await page.keyboard.press('Enter');
  }
  await context.close();
 }
 for(const w of [1280,844]){const r=checks.filter(c=>c.version==='after'&&c.viewport.width===w);assert.equal(r[0].width,r[1].width);assert.equal(r[0].x,r[1].x);assert.equal(r[0].y,r[1].y)}
 fs.writeFileSync(path.join(__dirname,'browser-check.json'),JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors:checks.flatMap(c=>c.errors)}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
