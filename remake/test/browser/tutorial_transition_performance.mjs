// Manual Chrome CDP comparison after game boot; local bundled video stands in for concurrent media.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const artifacts=process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {})}), results=[];
 for(const mobile of [false,true]) for(const profile of ['normal','slow','offline']) for(const video of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();
   const engine=await import('./js/vn/engine.js'),ui=await import('./js/core/ui.js'),data=await import('./js/core/data.js'),intro=await import('./js/vn/intro.js');
   const ch=await import('./js/chapters/ch1.js');ch.setupHooks();
   window.V={core,engine,ui,data};engine.vnTest.turbo=true;
   await ui.setBg(data.bgUrl('bg_tonari_inside'),{instant:true});
   await engine.play('remake_tutorial_result');
   engine.vnTest.turbo=false;intro.markIntroSeen('oneesan');
   window.audit={start:0,first:null,ticks:0,maxGap:0,longTasks:[]};
   new PerformanceObserver(l=>audit.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Performance.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:profile==='offline',latency:profile==='slow'?150:0,downloadThroughput:profile==='slow'?65536:-1,uploadThroughput:profile==='slow'?65536:-1});
  if(video) await page.evaluate(()=>{const v=document.createElement('video');v.muted=true;v.autoplay=true;v.loop=true;v.style.cssText='position:fixed;width:240px;right:0;bottom:0;z-index:999';v.src='/asset_sources/transitions/move-variants-20261010/3_walk.mp4';document.body.append(v);v.play().catch(()=>{});});
  const metricsBefore=await cdp.send('Performance.getMetrics');
  await page.evaluate(()=>{
   audit.start=performance.now();let last=audit.start;
   const tick=now=>{audit.ticks++;audit.maxGap=Math.max(audit.maxGap,now-last);last=now;if(!audit.first)requestAnimationFrame(tick);};requestAnimationFrame(tick);
   V.engine.hooks.onLine=()=>{audit.first??=performance.now()-audit.start;};
   window.scene=V.engine.play('ch1_tutorial_oneesan');
  });
  await page.waitForFunction(()=>audit.first!==null,{},{timeout:60000});
  const metricsAfter=await cdp.send('Performance.getMetrics');
  const row=await page.evaluate(()=>({...audit,resources:performance.getEntriesByType('resource').filter(r=>r.startTime>=audit.start).map(r=>({name:r.name.split('/').pop(),duration:r.duration,size:r.transferSize})),loading:!!document.querySelector('[data-test="vn-loading"]')}));
  row.taskMs=(metricsAfter.metrics.find(m=>m.name==='TaskDuration').value-metricsBefore.metrics.find(m=>m.name==='TaskDuration').value)*1000;
  row.mobile=mobile;row.profile=profile;row.video=video;row.errors=errors;results.push(row);
  console.log(JSON.stringify({mobile,profile,video,firstLineMs:Math.round(row.first),taskMs:Math.round(row.taskMs),rafTicks:row.ticks,maxGap:Math.round(row.maxGap),longTasks:row.longTasks.length,loading:row.loading,errors}));
  await context.close();
 }
 fs.writeFileSync(path.join(artifacts,'tutorial-transition-performance.json'),JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
