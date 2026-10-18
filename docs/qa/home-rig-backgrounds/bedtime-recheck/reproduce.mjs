import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const out = process.env.ARTIFACT_DIR || 'work/pr646/bedtime-recheck';
fs.mkdirSync(out,{recursive:true});
const refs = process.env.COMPARE_REFS ? JSON.parse(process.env.COMPARE_REFS) : {
  before:'13bf4a125d781c1d1bc4e6e94687e72f8d9477f4',
  submitted:'b427a933977b8ce5ffbe9dc317e25a5d565ff9ac',
  fixed:'7a0986c778ea479054d7fd16dcc98794de12f3b1',
};
const browser = await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const records=[];
try {
 for (const [label,ref] of Object.entries(refs)) {
  const changed = new Set(execFileSync('git',['diff','--name-only','HEAD',ref],{encoding:'utf8'}).trim().split('\n'));
  const cache = new Map();
  for (const [device,opts] of [['pc',{viewport:{width:1280,height:720}}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
   const context = await browser.newContext(opts);
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
   await page.route('http://127.0.0.1:8123/**',async route=>{
    const file=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    if(!changed.has(file))return route.continue();
    if(!cache.has(file)) {
     try {cache.set(file,execFileSync('git',['show',`${ref}:${file}`],{stdio:['ignore','pipe','ignore']}));}
     catch {return route.fulfill({status:404,body:'Not present in selected ref'});}
    }
    const ext=file.split('.').at(-1), mime={js:'text/javascript',json:'application/json',css:'text/css',webp:'image/webp',png:'image/png'}[ext];
    return route.fulfill({body:cache.get(file),...(mime?{contentType:mime}:{})});
   });
   await page.goto('http://127.0.0.1:8123/remake/',{waitUntil:'load'});
   await page.locator('[data-test="title-new"]').waitFor({timeout:30000});
   await page.locator('#boot').waitFor({state:'detached'});
   for(const [state,owned] of [['none',[]],['both',['home_rig_set','home_rig_pro']]]) {
    // 同じfixture・同じ入力。所持しないケースも家の休養後の共通モーダルを検査する。
    await page.evaluate(async owned=>{
     const c=await import('./js/core/state.js'), u=await import('./js/core/ui.js'), d=await import('./js/core/data.js');
     const s=c.newGame(); Object.assign(s,{phase:'daily',day:8,slot:2,stamina:80});
     s.owned.push(...owned);s.flavorStock={lemon:20,mint:20};
     Object.assign(c.config,{bgmVolume:0,seVolume:0,voiceBlip:false});
     u.showScreen('home',document.createElement('div'));
     await u.setBg(d.bgUrl('bg_home','night'),{instant:true});
     window.fixtureBefore=JSON.stringify(c.state);
     if(owned.length)void(await import('./js/daily/home-shisha.js')).runHomeShisha().then(v=>window.bedtimeDone=v);
     else void u.modal({title:'寝る前の一服',className:'home-shisha-dialog',body:'未所持の表示対照',options:[{label:'今日は寝る',value:null,test:'home-shisha-skip'}]});
    },owned);
    await page.locator('[data-test="home-shisha-skip"]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`${out}/${label}-${device}-${state}.png`,animations:'disabled'});
    const details=await page.evaluate(()=>{
     const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
     return {stage:box(document.querySelector('#stage')),bgCount:document.querySelectorAll('#bg > *').length,rigs:[...document.querySelectorAll('#bg [data-home-rig]')].map(n=>n.dataset.homeRig),filter:getComputedStyle(document.querySelector('.modal-backdrop')).backdropFilter,transform:getComputedStyle(document.querySelector('#stage')).transform};
    });
    // 原因切り分け専用。保存されたゲームコードには変更を加えない。
    const diagnosticStyle=await page.addStyleTag({content:'.modal-backdrop {backdrop-filter:none !important;}'});
    await page.screenshot({path:`${out}/${label}-${device}-${state}-diagnostic-no-blur.png`,animations:'disabled'});
    const skip=page.locator('[data-test="home-shisha-skip"]');
    await (device==='touch'?skip.tap():skip.click());
    await page.locator('#modal.show').waitFor({state:'hidden'});
    assert(await page.evaluate(async()=>window.fixtureBefore===JSON.stringify((await import('./js/core/state.js')).state)),'Cancel must preserve game state');
    records.push({label,ref,device,state,details,errors:[...errors]});
    assert.deepEqual(errors,[]);
    // 診断CSSは次のfixtureへ持ち越さない。
    await diagnosticStyle.evaluate(n=>n.remove());
   }
   await context.close();
  }
 }
} finally {
 await browser.close();fs.writeFileSync(`${out}/results.json`,JSON.stringify({browser:await browser.version(),records},null,2)+'\n');
}
console.log(JSON.stringify(records,null,2));
