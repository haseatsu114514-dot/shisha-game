// #574: reproducible before/after evidence; no game or source-image writes.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const mode=process.env.MODE||'after', out=process.env.ARTIFACT_DIR||`work/store-logo-comparison-${mode}`;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const results=[];
try {
 for(const [device,viewport,touch] of [['pc',{width:1280,height:720},false],['touch',{width:844,height:390},true]]){
  const ctx=await browser.newContext({viewport,isMobile:touch,hasTouch:touch}); const p=await ctx.newPage();
  await p.route('https://**/*',r=>r.abort());
  if(mode==='before') await p.route('**/css/store-logos.css',async r=>r.fulfill({contentType:'text/css',body:await fs.readFile(process.env.BASELINE_CSS,'utf8')}));
  await p.goto(process.env.BASE_URL||'http://127.0.0.1:8123/remake/');
  await p.locator('[data-test="title-new"]').waitFor(); await p.locator('#boot').waitFor({state:'detached'});
  await p.evaluate(async()=>{
   const core=await import('./js/core/state.js'),ui=await import('./js/core/ui.js'),map=await import('./js/daily/map.js'),hud=await import('./js/daily/hud.js');
   core.newGame();Object.assign(core.state,{phase:'daily',day:4,slot:0,money:30000,seed:574});
   for(const id of ['naru','adam','minto','rin','tsumugi']) core.state.met[id]=true;
   hud.initHud({});hud.showHud();await ui.warmUiArt();
   window.T={core,ui,map};
  });
  for(const [tod,slot] of [['day',0],['night',1]]){
   await p.evaluate(async(slot)=>{T.map.interruptMap(null);T.ui.dropRetired();T.core.state.slot=slot;T.pending=T.map.chooseSpot({eventPin:'c_station'});},slot);
   await p.locator('.spot-pin.branded').first().waitFor();await p.waitForTimeout(350);
   await p.evaluate(()=>Promise.all([...document.querySelectorAll('.spot-pin img')].map(i=>i.decode().catch(()=>{}))));
   const metrics=await p.evaluate(()=>{
    const stage=document.querySelector('#stage').getBoundingClientRect(),scale=stage.width/1280;
    const box=n=>{const r=n.getBoundingClientRect();return {x:(r.x-stage.x)/scale,y:(r.y-stage.y)/scale,w:r.width/scale,h:r.height/scale,cx:(r.x+r.width/2-stage.x)/scale,cy:(r.y+r.height/2-stage.y)/scale};};
    return {body:document.body.className,pins:[...document.querySelectorAll('.spot-pin.branded')].map(n=>({id:n.dataset.spot,shield:box(n.querySelector('.shield')),ico:box(n.querySelector('.ico')),logo:box(n.querySelector('.store-logo')),label:box(n.querySelector('.sub-label')),filter:getComputedStyle(n.querySelector('.store-logo')).filter}))};
   });results.push({device,tod,...metrics});
   await p.screenshot({path:`${out}/${device}-${tod}.jpg`,type:'jpeg',quality:80});
  }
  await ctx.close();
 }
 console.log(JSON.stringify(results,null,2));await fs.writeFile(`${out}/metrics.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}
