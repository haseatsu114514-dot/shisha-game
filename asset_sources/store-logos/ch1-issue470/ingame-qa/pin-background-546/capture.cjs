// 背景候補の実画面を使い捨てブラウザで撮影。本編のソースやプレイヤーの保存は変更しない。
const fs = require('node:fs');
const {createRequire}=require('node:module');
const path=require('node:path');
const {chromium}=createRequire(path.resolve(__dirname,'../../../../../remake/test/store_logos.mjs'))('playwright');
const out=__dirname;fs.mkdirSync(out,{recursive:true});
const base=fs.readFileSync(path.join(out,'base.css'),'utf8');
const themes=Object.fromEntries(['warm','slate','character'].map(id=>[id,fs.readFileSync(path.join(out,`${id}.css`),'utf8')]));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js'),ui=await import('./js/core/ui.js'),map=await import('./js/daily/map.js'),hud=await import('./js/daily/hud.js');
   core.newGame();Object.assign(core.state,{phase:'daily',day:4,slot:0,money:30000});for(const id of ['naru','adam','minto','rin','tsumugi'])core.state.met[id]=true;
   hud.initHud({});hud.showHud();await ui.warmUiArt();window.T={core,ui,map};
  });
  await page.addStyleTag({content:'.evt-badge {animation:none!important}'});
  const studyStyle=await page.addStyleTag({content:'/* candidate */'});
  for(const tod of ['day','night']){
   await page.evaluate(tod=>{T.map.interruptMap(null);T.ui.dropRetired();T.core.state.slot=tod==='night'?1:0;void T.map.chooseSpot({eventPin:'naru'});},tod);
   await page.waitForSelector('.map .spot-pin.branded');
   await page.waitForFunction(()=>[...document.querySelectorAll('.spot-pin img')].every(i=>i.complete && i.naturalWidth>0));
   await page.waitForTimeout(700);
   for(const type of ['current',...Object.keys(themes)]){
    await studyStyle.evaluate((n,css)=>n.textContent=css,type==='current'?'':base+themes[type]);
    await page.mouse.move(1275,715);await page.waitForTimeout(200);
    await page.screenshot({path:`${out}/${type}-${tod}.png`});
   }
  }
  console.log(JSON.stringify({output:out,errors,variants:['current',...Object.keys(themes)]}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
