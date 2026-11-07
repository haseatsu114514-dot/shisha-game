const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const repo='/workspace/loading-comics-recent-cast',game='/workspace/shisha-game';
const stock=path.join(repo,'asset_sources/loading-comics');
const batch=path.join(stock,'batch-recent-cast-20261104');
const out=path.join(batch,'qa-20261104');fs.mkdirSync(out,{recursive:true});
const items=JSON.parse(fs.readFileSync(path.join(batch,'generation-index.json'))).episodes.map(e=>({
 ...e,caption:JSON.parse(fs.readFileSync(path.join(stock,'allcast-'+e.id,'comics.json'))).caption,
 panels:[1,2].map(n=>({src:'/candidate/'+e.id+'/'+n+'.webp',alt:e.title+' '+n+'コマ目'})),contexts:['craft'],minChapter:4
}));
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game/remake/css/base.css"><div id="viewport"><div id="stage"><div id="screen"></div></div></div><script type="module">import {withLoading} from '/game/remake/js/core/loading.js';window.withLoading=withLoading;function fit(){document.documentElement.style.setProperty('--k',Math.min(innerWidth/1280,innerHeight/720))}fit();addEventListener('resize',fit);window.qaReady=true;</script>`;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');let file;
  if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html)}
  const m=/^\/candidate\/([a-z0-9-]+)\/([12])\.webp$/.exec(u.pathname);
  if(m&&items.some(i=>i.id===m[1]))file=path.join(stock,'allcast-'+m[1],'panels',m[1]+'-'+m[2]+'.webp');
  else if(u.pathname.startsWith('/game/')){
   const rel=decodeURIComponent(u.pathname.slice(6));
   if(rel.includes('..'))throw Error('bad path');
   file=path.join(game,rel);
   if(rel==='remake/img/ui/loading/loading_bg.webp')file=path.join(repo,rel);
  }
  if(!file||!fs.existsSync(file)){res.statusCode=404;return res.end('not found')}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch(e){res.statusCode=500;res.end(String(e))}
});
const viewports=[{id:'pc',width:1280,height:720},{id:'phone-landscape',width:844,height:390},{id:'phone-portrait',width:390,height:844}];
const records=[];let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,chromiumSandbox:true});
  for(const vp of viewports){
   const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,reducedMotion:'reduce'});
   await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   for(const item of items){
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+port+'/');await page.waitForFunction(()=>window.qaReady===true);
    await page.evaluate(comic=>{window.task=window.withLoading(()=>new Promise(r=>window.finish=r),{host:document.getElementById('stage'),context:'craft',chapter:4,comics:[comic],delayMs:0})},item);
    await page.waitForFunction(()=>document.querySelectorAll('.loading-panels img').length===2);
    await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.loading-panels img')].map(i=>i.decode()));await document.fonts.ready;window.finish()});
    await page.waitForSelector('.loading-gate.is-ready');
    const metrics=await page.evaluate(()=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
     return {viewport:{width:innerWidth,height:innerHeight},gate:rect(document.querySelector('.loading-gate')),card:rect(document.querySelector('.loading-card')),panels:[...document.querySelectorAll('.loading-panel-art')].map(rect),images:[...document.querySelectorAll('.loading-panels img')].map(i=>({...rect(i),naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,complete:i.complete})),title:document.querySelector('.loading-comic-title').textContent,caption:document.querySelector('.loading-comic-caption').textContent,bodyScroll:{width:document.body.scrollWidth,height:document.body.scrollHeight}};
    });
    for(const p of metrics.panels){if(p.x<0||p.y<0||p.right>vp.width+.5||p.bottom>vp.height+.5||Math.abs(p.width/p.height-1.5)>.002)throw Error(item.id+' '+vp.id+' panel bounds/ratio')}
    for(const i of metrics.images){if(i.naturalWidth!==1440||i.naturalHeight!==960||!i.complete)throw Error('decode/dimensions')}
    const screenshot=vp.id+'-'+item.id+'.jpg';await page.screenshot({path:path.join(out,screenshot),type:'jpeg',quality:88,animations:'disabled'});
    await page.keyboard.press('Enter');await page.waitForSelector('.loading-gate',{state:'detached'});await page.evaluate(()=>window.task);
    records.push({id:item.id,viewport:vp.id,screenshot,metrics,errors,proceed:'PASS'});console.log('PASS',vp.id,item.id,Math.round(metrics.panels[0].width)+'x'+Math.round(metrics.panels[0].height));
    await page.close();
   }
   await context.close();
  }
 }finally{if(browser)await browser.close();server.close()}
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({tested_head:'98a7f2cc22175feb8531f5b444263b3eaa438efe',browser:'system Chromium; chromiumSandbox:true',method:'actual withLoading + actual loading.css/base.css; candidate array passed only to local QA harness; no runtime registry edit',loadingCssBlob:'0259d4413ecb758b7165133ea269e8e7b2c621d1',loadingJsBlob:'3c13e20f4b82886e54bc489470e26a293dbe681a',baseCssBlob:'e7abcb0e71090a569868fee4fd200d0935d9d546',deviceScaleFactor:1,viewports,records},null,2)+'\n');
})().catch(e=>{console.error(e);if(browser)browser.close();server.close();process.exitCode=1});
