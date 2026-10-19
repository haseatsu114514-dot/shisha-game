// #609: first-use / cached scene on PC and landscape touch, with optional CDP network limits.
// Uses disposable contexts and real scene/image/transition code; never a player's saved storage.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8124/remake/';
const out=path.resolve(process.env.AUDIT_DIR||'.codex/artifacts/ch1-loading/matrix');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
const results=[];
try {
  for(const mobile of [false,true])for(const limited of [false,true]){
    const label=`${mobile?'touch':'pc'}-${limited?'128k-150ms':'local'}`;
    const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const start=Date.now();await page.goto(base);
    await page.locator('#boot').waitFor({state:'detached',timeout:30000});
    const bootMs=Date.now()-start;
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js'),ui=await import('./js/core/ui.js'),data=await import('./js/core/data.js'),vn=await import('./js/vn/engine.js');
      core.newGame();core.config.textSpeed=4;ui.clearScreen();
      await ui.setBg(data.bgUrl('bg_tonari_inside_day'),{instant:true});
      window.M={core,ui,data,vn,rows:[]};
      vn.hooks.onLine=()=>{M.current.first=performance.now();};
      new MutationObserver(records=>{
        for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('.vn-loading')){
          const event={text:n.textContent,start:performance.now()};M.current?.loading.push(event);
          const observer=new MutationObserver(()=>{if(!n.isConnected){event.end=performance.now();observer.disconnect();}});
          observer.observe(document.body,{subtree:true,childList:true});
        }
      }).observe(document.body,{subtree:true,childList:true});
    });
    if(limited){
      const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:128*1024,uploadThroughput:128*1024,connectionType:'cellular3g'});
    }
    for(const cache of ['first-use','warm']){
      await page.evaluate(cache=>{
        M.stop=new AbortController();M.current={cache,start:performance.now(),first:null,loading:[]};M.rows.push(M.current);
        M.play=M.vn.play({dialogue_id:'loading_matrix',lines:[{text:'画像を待ってから同じ場面を出す。',portrait:'oneesan',portrait_face:'ura_normal'}]},
          {bg:'bg_home_day',signal:M.stop.signal});
      },cache);
      // Same point during the intentional curtain, whether or not a loading notice is present.
      await page.waitForTimeout(700);
      await page.screenshot({path:path.join(out,`${label}-${cache}-700ms.png`)});
      await page.waitForFunction(()=>M.current.first!==null,null,{timeout:20000});
      await page.waitForFunction(()=>document.querySelector('.vn-text')?.textContent==='画像を待ってから同じ場面を出す。');
      await page.evaluate(()=>{
        M.current.readable=performance.now();
        M.current.portraitDecoded=[...document.querySelectorAll('.portrait')].every(n=>n.complete&&n.naturalWidth>0);
        M.current.resources=performance.getEntriesByType('resource').filter(r=>r.startTime>=M.current.start).map(r=>({url:r.name,duration:r.duration,transferSize:r.transferSize,decodedBodySize:r.decodedBodySize,kind:r.initiatorType}));
      });
      await page.screenshot({path:path.join(out,`${label}-${cache}-ready.png`)});
      await page.evaluate(async()=>{M.stop.abort();await M.play;await M.ui.setBg(M.data.bgUrl('bg_tonari_inside_day'),{instant:true});});
    }
    results.push({label,base,mobile,limited,bootMs,errors,rows:await page.evaluate(()=>M.rows)});
    console.log(JSON.stringify(results.at(-1)));await context.close();
  }
}finally{
  await fs.writeFile(path.join(out,'matrix.json'),JSON.stringify({browser:browser.version(),results},null,2)+'\n');
  await browser.close();
}
