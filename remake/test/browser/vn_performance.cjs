// Manual Issue #3513 benchmark: NEW GAME -> SMOKE CROWN CUP。2週間後だ.
// 1280x720, DPR 1, default settings; 5s idle then ten native clicks at 500ms deadlines.
// BASE_URL / CHROME_EXECUTABLE_PATH / NODE_PATH are the same as the browser suites.
// LABEL and OUT select artifacts; LOOKS=neo,classic; TRACE=1 adds CDP timelines/layers.
// FAST=1 starts the same opening at the target line (diagnostics only).
// BASELINE_REF=<fixed commit> serves the original presentation code for an A/B comparison.
// COMPARE=1 alternates that baseline and the working tree for each entry in LOOKS.
// SPEAKER_SCOPE=1 with LOOKS=neo isolates inherited vs local speaker colors on one page.
// Use TRACE=1 for that probe; it changes only the color, not portraits or dialogue.
// Timing is reported, never asserted: shared CI/VM load makes wall-clock budgets unreliable.
const fs = require('fs');
const {chromium} = require('playwright');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const out = process.env.OUT || path.join(root, 'remake/test/shots/vn-performance');
fs.mkdirSync(out, { recursive: true });
// Serve only the changed presentation code from a fixed ref. Assets and game data stay identical.
const baseline = process.env.BASELINE_REF ? new Map(['css/bundle-2.css', 'js/looks/neo.js'].map(file =>
 [file, execFileSync('git', ['show', `${process.env.BASELINE_REF}:remake/${file}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 })])) : null;
// Routing disables Playwright's HTTP cache. Route the same files in both versions.
const current = baseline && new Map([...baseline.keys()].map(file => [file, fs.readFileSync(path.join(root, 'remake', file))]));
async function main() {
 if (process.env.COMPARE && !baseline) throw new Error('COMPARE requires a fixed BASELINE_REF');
 if (process.env.SPEAKER_SCOPE && (baseline || process.env.LOOKS !== 'neo')) throw new Error('SPEAKER_SCOPE requires LOOKS=neo and the working tree');
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE_PATH});
 const results=[];
 const sys=await browser.newBrowserCDPSession();
 fs.writeFileSync(out+'/'+(process.env.LABEL||'measure')+'-environment.json',JSON.stringify({version:await browser.version(),info:await sys.send('SystemInfo.getInfo')},null,2));
 const runs = (process.env.LOOKS || 'neo,classic,neo,classic').split(',').flatMap(look =>
   process.env.COMPARE ? [{look, before:true}, {look, before:false}] : [{look, before:!!baseline}]);
 try { for (const {look, before} of runs) {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();
  if (baseline) for (const [file, body] of before ? baseline : current) await page.route(new URL(file, baseURL).href, route =>
    route.fulfill({ status: 200, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript', body }));
  page.setDefaultTimeout(45000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const {installLoadingComicReader}=await import(root+'/remake/test/browser/loading_reader.mjs');
  await installLoadingComicReader(page);
  await page.goto(baseURL+'?look='+look);
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator('#boot').waitFor({state:'detached'});
  // Use the default portrait style for both looks.
  if(process.env.FAST) {
   await page.evaluate(async()=>{
    const core=await import('./js/core/state.js');core.newGame();
    const {DB}=await import('./js/core/data.js');
    (await import('./js/vn/intro.js')).markIntroSeen('sumi');
    (await import('./js/core/ui.js')).clearScreen();
    const d=DB.dialogues.ch1_opening;const i=d.lines.findIndex(l=>l.text?.includes('2週間後だ'));
    void (await import('./js/scenes/tonari-opening.js')).playTonariOpening({dialogue:{...d,lines:d.lines.slice(i)}});
   });
  } else {
  await page.locator('[data-test="title-new"]').click();
  let found=false;
  for(let n=0;n<220;n++) {
   await page.waitForTimeout(350);
   const state=await page.evaluate(()=>({text:document.querySelector('.vn-text')?.textContent||'',next:!!document.querySelector('.vn-next.show'),poem:!!document.querySelector('.chapter-poem'),body:document.body.innerText.slice(-500)}));
   if(state.text.includes('2週間後だ')) {found=true;break;}
   if(n%10===0) console.log(look,n,JSON.stringify(state));
   await page.keyboard.press('Enter');
  }
  if(!found) throw new Error('target not found');
  }
  await page.locator('.vn-next.show').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('img.portrait')].every(i=>i.complete&&i.naturalWidth));
  await page.waitForTimeout(1500);
  
  await page.waitForTimeout(500);
  const scene=await page.evaluate(()=>({text:document.querySelector('.vn-text').textContent,portraits:[...document.querySelectorAll('img.portrait')].map(i=>({src:i.getAttribute('src'),w:i.naturalWidth,h:i.naturalHeight})),bg:[...document.querySelectorAll('.bg-img')].map(i=>({cls:i.className,filter:getComputedStyle(i).filter,html:i.outerHTML.slice(0,500)})),animations:document.getAnimations().map(a=>({name:a.animationName,target:a.effect.target?.className})),config:localStorage.getItem('suien_remake_config')}));
  console.log('scene',JSON.stringify(scene));
  const cdp=await context.newCDPSession(page);
  let layers=[];
  if(process.env.TRACE) {
    await cdp.send('DOM.enable');
    cdp.on('LayerTree.layerTreeDidChange',e=>layers=e.layers||[]);
    await cdp.send('LayerTree.enable');
  }
  const prefix=out+'/'+(process.env.LABEL||'measure')+'-'+look+'-'+results.length;
  console.log('version',before ? process.env.BASELINE_REF : 'working-tree');
  if(process.env.TRACE) await cdp.send('Tracing.start',{categories:'viz,toplevel,cc,gpu,devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
  const metrics=[];
  const phases=process.env.SPEAKER_SCOPE ? ['root1','local1','root2','local2'] : ['idle','advance'];
  for(const phase of phases) {
   if(process.env.SPEAKER_SCOPE) {
    await page.evaluate(phase=>{
     const host=document.querySelector('#vn'),name=host.querySelector('.vn-name');
     const color=name.style.getPropertyValue('--neo-speaker')||host.style.getPropertyValue('--neo-speaker');
     host.style.removeProperty('--neo-speaker');name.style.removeProperty('--neo-speaker');
     (phase.startsWith('root')?host:name).style.setProperty('--neo-speaker',color);
    },phase);
    await page.waitForTimeout(500);
   }
   await page.evaluate((phase)=>{
    window.__measure={phase,start:performance.now(),frames:[],tasks:[],clicks:[]};
    performance.mark('3513-'+phase+'-start');
    const m=window.__measure;let prev;
    m.onClick=()=>m.clicks.push({at:performance.now(),text:document.querySelector('.vn-text')?.textContent});
    document.addEventListener('pointerup',m.onClick);
    m.observer=new PerformanceObserver(list=>m.tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));m.observer.observe({type:'longtask'});
    function tick(t){if(prev)m.frames.push(t-prev);prev=t;m.raf=requestAnimationFrame(tick);}m.raf=requestAnimationFrame(tick);
   },phase);
   if(process.env.SPEAKER_SCOPE) {
    await page.evaluate(async phase=>{
     const node=document.querySelector(phase.startsWith('root')?'#vn':'.vn-name');
     for(let i=0;i<10;i++) {
      node.style.setProperty('--neo-speaker',i%2?'#8eaf87':'#e2bc68');
      await new Promise(resolve=>setTimeout(resolve,500));
     }
    },phase);
   } else if(phase==='advance') {
    // Browser input, at fixed 500ms deadlines. No locator stability waits during animations.
    const start=Date.now();
    for(let i=0;i<10;i++) {await new Promise(r=>setTimeout(r,Math.max(0,start+i*500-Date.now()))); await page.mouse.click(640,620);}
    await new Promise(r=>setTimeout(r,Math.max(0,start+5000-Date.now())));
   } else await page.waitForTimeout(5000);
   const m=await page.evaluate(()=>{const m=window.__measure;cancelAnimationFrame(m.raf);m.tasks.push(...m.observer.takeRecords().map(e=>({start:e.startTime,duration:e.duration})));m.observer.disconnect(); document.removeEventListener('pointerup',m.onClick); performance.mark('3513-'+m.phase+'-end');return {phase:m.phase,start:m.start,end:performance.now(),frames:m.frames,tasks:m.tasks,clicks:m.clicks,text:document.querySelector('.vn-text')?.textContent};});
   const s=[...m.frames].sort((a,b)=>a-b);m.summary={frames:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],max:Math.max(...s),longTasks:m.tasks.length,longMax:Math.max(0,...m.tasks.map(x=>x.duration)),longTotal:m.tasks.reduce((a,x)=>a+x.duration,0)};
   metrics.push(m); console.log(look,phase,JSON.stringify(m.summary));
  }
  if(process.env.TRACE) {
   const layerDetails=[];
   for(const layer of layers) {
     const reasons=await cdp.send('LayerTree.compositingReasons',{layerId:layer.layerId}).catch(()=>({}));
     const node=layer.backendNodeId?await cdp.send('DOM.describeNode',{backendNodeId:layer.backendNodeId}).catch(()=>({})):{};
     layerDetails.push({...layer,reasons,node});
   }
   fs.writeFileSync(prefix+'-layers.json',JSON.stringify(layerDetails,null,2));
   const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await done;
   const fd=fs.openSync(prefix+'-trace.json','w');for(;;){const r=await cdp.send('IO.read',{handle:stream});fs.writeSync(fd,r.base64Encoded?Buffer.from(r.data,'base64'):r.data);if(r.eof)break;}fs.closeSync(fd);await cdp.send('IO.close',{handle:stream});
  }
  await page.screenshot({path:prefix+'.png'});
  results.push({look,baselineRef:before?process.env.BASELINE_REF:null,fixture:!!process.env.FAST,speakerProbe:!!process.env.SPEAKER_SCOPE,scene,metrics,errors});fs.writeFileSync(out+'/'+(process.env.LABEL||'measure')+'.json',JSON.stringify(results,null,2));
  await context.close();
  if(errors.length) throw new Error('Browser/resource errors: '+errors.join('\n'));
 }} finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
