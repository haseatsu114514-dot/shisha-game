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
   // #780: 対面の噂を完読した状態。旧LIME既読では解放しない。晴れの種は維持。
   Q.core.state.flags._fortune_rumor_heard=true;Q.core.state.weatherSeed=2;
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
  const riftAndTrivia=await page.evaluate(async()=>{
   const snap=JSON.stringify(Q.core.state);
   // Legacy mask 31 on naru draws from the newly added readings (naru_9 / naru_12 / naru_15) in live doFortune.
   Object.assign(Q.core.state,{chapter:1,day:6,slot:0,fortuneDay:0,money:13000,met:{naru:true},affinity:{naru:10}});
   Q.core.state.flags._fortune_trivia_seen_naru=31;
   const newDone=await Q.fortune.doFortune();
   const newLines=Q.vn.backlog().map(x=>x.text);
   const newMatched=Q.data.DB.fortuneTrivia.characters.naru.filter(x=>newLines.includes(x.teller)).map(x=>x.id);
   // Chapter 2 before and after Naru confrontation (rift).
   const naruSpot=Q.spots.spotById('naru');
   Object.assign(Q.core.state,{chapter:2,day:27,slot:0,fortuneDay:0,money:13000,met:{naru:true,adam:true},affinity:{naru:30,adam:20}});
   Q.core.state.flags={_ch2_day1:{startDay:15},_fortune_met:true,_fortune_rumor_heard:true};
   const beforeRiftOpen=Q.access.spotAvailability(naruSpot).ok;
   Q.core.state.day=24; // 24 % 7 === 3 (regular weekly holiday before rift)
   const beforeRiftHoliday=Q.access.spotAvailability(naruSpot).tag;
   // Mid-selection transition in doFortune: if rift activates while choosing Naru, abort without charging.
   Q.core.state.day=27;
   Q.vn.vnTest.choose=did=>{
    if(did==='remake_fortune_pick_live'){Q.core.state.flags._ch2_read_ch2_naru_confrontation=true;return 0;}
    return 0;
   };
   const midTransition=await Q.fortune.doFortune();
   Q.vn.vnTest.choose=null;
   const midTransitionSafe=!midTransition&&Q.core.state.money===13000&&Q.core.state.fortuneDay===0;
   // Continuous temporary closure after rift across normal days, regular holiday (day 24), SAVE/LOAD, and direct entry.
   const afterRiftNormal=Q.access.spotAvailability(naruSpot).tag;
   Q.core.state.day=24;
   const afterRiftHoliday=Q.access.spotAvailability(naruSpot).tag;
   Q.core.save();Q.core.newGame();Q.core.load();
   const afterReloadTag=Q.access.spotAvailability(naruSpot).tag;
   const moneyBeforeVisit=Q.core.state.money,staminaBeforeVisit=Q.core.state.stamina;
   const blockedRival=await Q.spots.visitRival(naruSpot);
   const blockedChar=await Q.spots.visitChar('naru');
   const entryBlocked=!blockedRival&&!blockedChar&&Q.core.state.money===moneyBeforeVisit&&Q.core.state.stamina===staminaBeforeVisit;
   // Fortune picker after rift excludes Naru and only offers Adam (or no_target if Naru was sole acquaintance).
   Q.core.state.day=27;
   let offeredChoices=[];
   Q.vn.vnTest.choose=(did,texts)=>{if(did==='remake_fortune_pick_live')offeredChoices=texts;return 0;};
   const adamPicked=await Q.fortune.doFortune();
   Q.vn.vnTest.choose=null;
   const pickedChar=Q.core.state.fortune?.char;
   delete Q.core.state.affinity.adam;Q.core.state.fortuneDay=0;
   const soleNaruNoTarget=!(await Q.fortune.doFortune());
   Object.assign(Q.core.state,JSON.parse(snap));
   Q.core.save();
   return {
    newDone,newMatched,beforeRiftOpen,beforeRiftHoliday,midTransitionSafe,
    afterRiftNormal,afterRiftHoliday,afterReloadTag,entryBlocked,
    adamPicked,offeredChoices,pickedChar,soleNaruNoTarget,
   };
  });
  assert(riftAndTrivia.newDone);
  assert(riftAndTrivia.newMatched.some(id=>['naru_9','naru_12','naru_15'].includes(id)),'legacy mask 31 did not advance to new naru trivia');
  assert(riftAndTrivia.beforeRiftOpen);
  assert.equal(riftAndTrivia.beforeRiftHoliday,'本日定休日');
  assert(riftAndTrivia.midTransitionSafe,'mid-selection rift transition charged or granted reading');
  assert.equal(riftAndTrivia.afterRiftNormal,'本日臨時休業');
  assert.equal(riftAndTrivia.afterRiftHoliday,'本日臨時休業');
  assert.equal(riftAndTrivia.afterReloadTag,'本日臨時休業');
  assert(riftAndTrivia.entryBlocked,'direct entry to KEMURIKUSA or Naru succeeded after rift');
  assert(riftAndTrivia.adamPicked);
  assert.equal(riftAndTrivia.pickedChar,'adam');
  assert(riftAndTrivia.offeredChoices.every(t=>!t.includes('なる')),'Naru remained in fortune choices after rift');
  assert(riftAndTrivia.soleNaruNoTarget);
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
  // 当たりの選択肢は赤で示す。色の濃さはUIテーマ（紙では読める濃い赤）に合わせる。
  const ink=await page.locator('.vn-choice.fortune-hint').evaluate(n=>getComputedStyle(n).color.match(/\d+/g).map(Number));assert(ink[0]>=150&&ink[0]-ink[1]>=100&&ink[0]-ink[2]>=90,`fortune hint is not red: ${ink}`);
  await page.screenshot({path:`${out}/hint-${name}.jpg`,type:'jpeg',quality:80});
  await page.locator('[data-test="choice-1"]').click();await page.evaluate(()=>{Q.vn.vnTest.turbo=true;});await page.keyboard.press('Enter');await page.evaluate(()=>window.preview);
  await page.evaluate(()=>{Q.vn.vnTest.turbo=false;window.portrait=Q.vn.play('remake_fortune_again',{bg:'bg_street'});});
  await page.locator('.vn-portraits img[src*="uranaishi"]').waitFor();await page.locator('.vn-portraits img[src*="uranaishi"]').evaluate(i=>i.decode());
  await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/portrait-${name}.jpg`,type:'jpeg',quality:80});
  assert.deepEqual(errors,[]);results.push({name,night,unsuccessful,paid,duplicate,bonus,persisted,today,last,expired,second,riftAndTrivia,errors});console.log(`PASS fortune UI: ${name}`);await ctx.close();
 }
}finally{fs.writeFileSync(`${out}/fortune-browser.json`,JSON.stringify({ref:process.env.TEST_REF||null,results},null,2)+'\n');await browser.close();}
