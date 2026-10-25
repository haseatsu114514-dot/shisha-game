const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, 'remake/test/browser/node_modules/playwright'));
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const out=process.env.SHOTS || '/tmp/purikura947-review'; fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'});
  const results=[];
  for (const [label,viewport,touch] of [['pc',{width:1280,height:720},false],['touch',{width:844,height:390},true]]) {
    const context=await browser.newContext({viewport,hasTouch:touch});
    const page=await context.newPage(); const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8123/remake/')+'?movar=a');
    await page.waitForSelector('[data-test="title-new"]',{timeout:30000});
    await page.waitForSelector('#boot',{state:'detached'});
    await page.evaluate(()=>{window.pkDone=false;window.pkRun=__remake.dev.motion('purikura').then(()=>window.pkDone=true);});
    await page.waitForSelector('.mo-purikura');
    await page.waitForFunction(()=>{
      const n=document.querySelector('.mo-pk-sheet');
      return n && Number(getComputedStyle(n).opacity)>.95;
    });
    const printed=await page.evaluate(async()=>{
      const halves=[...document.querySelectorAll('.mo-pk-half.cg.strip')];
      const backgrounds=halves.map(n=>getComputedStyle(n).backgroundImage);
      const img=new Image();img.src=backgrounds[0].slice(5,-2); await img.decode();
      return {count:halves.length,backgrounds,size:[img.naturalWidth,img.naturalHeight],
        backgroundSizes:halves.map(n=>getComputedStyle(n).backgroundSize),
        rects:halves.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})};
    });
    assert.equal(printed.count,2); assert.equal(printed.backgrounds[0],printed.backgrounds[1]);
    assert(printed.backgrounds[0].includes('cg_ch2_ageha_purikura_strip.webp'));
    assert.deepEqual(printed.size,[640,1080]); assert.deepEqual(printed.backgroundSizes,['100% 100%','100% 100%']);
    await page.screenshot({path:out+'/'+label+'-printed.png'});
    await page.waitForFunction(()=>{
      const n=document.querySelector('.mo-pk-half.left');
      return n && Number(getComputedStyle(n).opacity)<.5;
    });
    await page.screenshot({path:out+'/'+label+'-cut.png'});
    await page.waitForFunction(()=>window.pkDone,{timeout:15000});
    assert.equal(await page.locator('.mo-purikura').count(),0); assert.deepEqual(errors,[]);
    results.push({label,printed,errors,cleanup:true});
    await context.close();
  }
  await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
