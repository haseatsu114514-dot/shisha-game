import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium }=createRequire(import.meta.url)('playwright');
const out=process.env.ARTIFACT_DIR||'docs/qa/hud-fortune-682';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium'}),results=[];
try{
 for(const [name,viewport,layout] of [['pc',{width:1280,height:900},'normal'],['touch',{width:844,height:390},'normal'],['ds',{width:390,height:844},'ds']]){
  const ctx=await browser.newContext({viewport,hasTouch:name!=='pc',reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(layout=>localStorage.setItem('suien_title_layout',layout),layout);
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:8123/remake/');await page.locator('[data-test="title-new"]').waitFor({timeout:45000});await page.locator('#boot').waitFor({state:'detached'});
  await page.evaluate(async()=>{
   window.Q={core:await import('./js/core/state.js'),data:await import('./js/core/data.js'),vn:await import('./js/vn/engine.js'),chapter:await import('./js/chapters/ch1.js'),fortune:await import('./js/daily/fortune.js'),effects:await import('./js/core/fortune-effects.js'),stats:await import('./js/core/stats.js'),access:await import('./js/daily/spot-access.js'),spots:await import('./js/daily/spots.js')};
   Q.chapter.setupHooks();Q.vn.vnTest.turbo=true;
   Object.assign(Q.core.newGame(),{phase:'daily',day:3,slot:1,seed:131,money:13000});Q.core.state.met.naru=true;Q.core.state.affinity.naru=6;
  });
  const night=await page.evaluate(async()=>{const before=JSON.stringify(Q.core.state);const av=Q.access.spotAvailability(Q.spots.spotById('fortune'));const result=await Q.fortune.doFortune();return {av,result,unchanged:before===JSON.stringify(Q.core.state)};});
  assert.equal(night.result,false);assert(night.unchanged);assert.equal(night.av.tag,'昼のみ営業');
  const unsuccessful=await page.evaluate(async()=>{
   Q.core.state.slot=0;Q.core.state.money=2999;
   const broke=await Q.fortune.doFortune();
   const brokeSafe=!broke&&Q.core.state.money===2999&&!Q.effects.activeFortuneSight(Q.core.state);
   Q.core.state.money=13000;Q.vn.vnTest.choose=id=>id==='remake_fortune_offer'?1:0;
   const cancel=await Q.fortune.doFortune();Q.vn.vnTest.choose=null;
   const cancelSafe=!cancel&&Q.core.state.money===13000&&!Q.effects.activeFortuneSight(Q.core.state);
   Q.core.state.affinity={};const empty=await Q.fortune.doFortune();
   const noTargetSafe=!empty&&Q.core.state.money===13000&&!Q.effects.activeFortuneSight(Q.core.state);
   Q.core.state.affinity.naru=6;return {brokeSafe,cancelSafe,noTargetSafe};
  });assert(Object.values(unsuccessful).every(Boolean),'unsuccessful reading granted or charged a benefit');
  const paid=await page.evaluate(async()=>{
   Q.core.state.slot=0;const seed=Q.core.state.seed;const done=await Q.fortune.doFortune();
   const lines=Q.vn.backlog().map(x=>x.text);const readings=Q.data.DB.fortuneTrivia.characters.naru;
   return {done,money:Q.core.state.money,day:Q.core.state.fortuneDay,char:Q.core.state.fortune?.char,sight:Q.effects.activeFortuneSight(Q.core.state),trivia:readings.filter(x=>lines.includes(x.teller)).map(x=>x.id),seedUnchanged:seed===Q.core.state.seed};
  });
  assert(paid.done);assert.equal(paid.money,10000);assert.equal(paid.day,3);assert.equal(paid.char,'naru');assert.equal(paid.sight.until,5);assert.equal(paid.trivia.length,1);assert(paid.seedUnchanged);
  const duplicate=await page.evaluate(async()=>{const before=JSON.stringify(Q.core.state);return {result:await Q.fortune.doFortune(),unchanged:before===JSON.stringify(Q.core.state)};});
  assert.equal(duplicate.result,false);assert(duplicate.unchanged);
  const nightAfter=await page.evaluate(()=>{Q.core.state.slot=1;const tag=Q.access.spotAvailability(Q.spots.spotById('fortune')).tag;Q.core.state.slot=0;return tag;});assert.equal(nightAfter,'昼のみ営業');
  const bonus=await page.evaluate(()=>{const before=Q.core.state.affinity.naru;Q.stats.gainAffinity('naru',2);return {increase:Q.core.state.affinity.naru-before,carry:Q.core.state.affinityCarry.naru,consumed:!Q.core.state.fortune,sight:Q.effects.activeFortuneSight(Q.core.state)};});
  assert.equal(bonus.increase,2);assert(Math.abs(bonus.carry-.55)<1e-9);assert(bonus.consumed&&bonus.sight);
  const persisted=await page.evaluate(()=>{Q.core.save();Q.core.newGame();Q.core.load();return Q.effects.activeFortuneSight(Q.core.state);});assert.equal(persisted.char,'naru');assert.equal(persisted.until,5);
  async function choices(day,target,id){return page.evaluate(async({day,target,id})=>{
   Q.core.state.day=day;if(target==='rin')Q.effects.grantFortuneReading(Q.core.state,'rin',Q.data.DB.fortuneTrivia);
   Q.core.state.met[target]=true;const shown=[];
   Q.vn.vnTest.choose=(did,texts)=>{shown.push({id:did,marked:[...document.querySelectorAll('.vn-choice')].map(n=>n.classList.contains('fortune-hint'))});return 0;};
   await Q.vn.play(id);Q.vn.vnTest.choose=null;return shown;
  },{day,target,id});}
  const today=await choices(3,'naru','ch1_naru_first');assert(today.some(x=>x.marked[0]&&!x.marked[1]),'target conversation not marked');
  const last=await choices(5,'naru','ch1_naru_first');assert(last.some(x=>x.marked[0]));
  const expired=await choices(6,'naru','ch1_naru_first');assert(expired.every(x=>x.marked.every(v=>!v)),'hint survived fourth day');
  const second=await choices(3,'rin','ch1_rin_first');assert(second.some(x=>!x.marked[0]&&x.marked[1]),'hint blindly favors first option');
  // Capture real choice DOM before selecting; this scene is authored data, not a synthetic quiz.
  await page.evaluate(()=>{
   Q.vn.vnTest.turbo=false;Q.vn.vnTest.choose=null;
   const d=Q.data.DB.dialogues.ch1_rin_first,choice=d.lines.find(x=>x.type==='choice'&&x.id==='rin_first_pen');
   window.preview=Q.vn.play({...d,lines:[{speaker:'rin',face:'normal',text:'……どこを見てたの？'},choice]},{bg:'bg_fookah_showroom'});
  });
  await page.waitForFunction(()=>document.querySelector('.vn-text')?.textContent.includes('どこを見てたの'));
  await page.keyboard.press('Enter');await page.waitForTimeout(100);
  if(await page.locator('.vn-choice').count()===0)await page.keyboard.press('Enter');
  await page.locator('.vn-choice.fortune-hint').waitFor();
  assert.equal(await page.locator('.vn-choice.fortune-hint').getAttribute('data-test'),'choice-1');
  await page.waitForTimeout(500);await page.waitForFunction(()=>!document.querySelector('.toast'));
  const ink=await page.locator('.vn-choice.fortune-hint').evaluate(n=>getComputedStyle(n).color);assert.equal(ink,'rgb(255, 119, 127)');
  await page.screenshot({path:`${out}/hint-${name}.jpg`,type:'jpeg',quality:80});
  await page.locator('[data-test="choice-1"]').click();await page.evaluate(()=>{Q.vn.vnTest.turbo=true;});await page.keyboard.press('Enter');await page.evaluate(()=>window.preview);
  await page.evaluate(()=>{Q.vn.vnTest.turbo=false;window.portrait=Q.vn.play('remake_fortune_again',{bg:'bg_street'});});
  await page.locator('.vn-portraits img[src*="uranaishi"]').waitFor();await page.locator('.vn-portraits img[src*="uranaishi"]').evaluate(i=>i.decode());
  await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/portrait-${name}.jpg`,type:'jpeg',quality:80});
  assert.deepEqual(errors,[]);results.push({name,night,unsuccessful,paid,duplicate,bonus,persisted,today,last,expired,second,errors});console.log(`PASS fortune UI: ${name}`);await ctx.close();
 }
}finally{fs.writeFileSync(`${out}/fortune-browser.json`,JSON.stringify({ref:process.env.TEST_REF||null,results},null,2)+'\n');await browser.close();}
