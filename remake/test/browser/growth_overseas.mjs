// 第4章クリア保存を開始点に、♥・XP・火種・授業を直接与えず第5章の通常入力から到達する。
import assert from 'node:assert/strict';
import {suite,baseURL,assertFits} from './support.mjs';
const t=id=>`[data-test="${id}"]`;
async function start(page,money=200000){
 await page.emulateMedia({reducedMotion:'reduce'});
 const ids=await page.evaluate(async money=>{
  window.tripCore=await import('./js/core/state.js');const s=tripCore.newGame();
  Object.assign(s,{chapter:4,phase:'cleared',money});Object.assign(s.flags,{_ch4_cleared:true,_ch4_sheikh_revealed:true});
  Object.assign(tripCore.config,{bgmVolume:0,seVolume:0,voiceBlip:false});
  const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
  const p=await import('./js/chapters/ch5-progress.js');
  void (await import('./js/chapters/ch5.js')).beginChapterFive();
  return p.CH5_PROLOGUE.map(s=>s.id);
 },money);
 for(const id of ids){await page.locator(`${t('ch5-scene')}[data-scene="${id}"]`).waitFor({timeout:60000});await page.locator(t('ch5-continue')).click();}
 await page.locator(t('ch5-travel')).waitFor();
 await page.locator(t('ch5-travel')).click();
 await page.locator(t('travel-fly')).waitFor();
}
async function settled(page){
 for(let i=0;i<6;i++){
  await page.waitForFunction(()=>document.querySelector('[data-test="levelup"]')
   ||document.querySelector('[data-test="ch5-travel"] .ch2-contest-actions button:not(:disabled)')
   ||document.querySelector('[data-test="ch5-free"]'),null,{timeout:30000});
  if(await page.locator(t('levelup')).count()){
   await page.locator(t('levelup-ok')).click({timeout:30000});
   await page.locator(t('levelup')).waitFor({state:'detached'});continue;
  }
  return;
 }
 throw new Error('night did not settle');
}
async function allocate(page,id,board){
 await page.locator(t('travel-reflect')).click();await page.locator(t('growth-board')).waitFor();
 await page.locator(t('board-tab-'+board)).click();await page.locator(t('board-node-'+id)).scrollIntoViewIfNeeded();
 await page.locator(t('board-node-'+id)).click();await page.locator(t('board-target')).click();
 await page.locator(t('board-towards')).click();await page.locator(t('board-decide')).click();
 await page.locator(t('growth-board')).waitFor({state:'detached'});await settled(page);
}
await suite('growth-overseas',async check=>{
 await check('normal-meetings-night-fire-board-and-two-lessons',async page=>{
  await start(page);
  const baseline=await page.evaluate(()=>({day:tripCore.state.day,money:tripCore.state.money,stats:JSON.stringify(tripCore.state.stats)}));
  assert.deepEqual(await page.evaluate(()=>({hearts:tripCore.state.affinity,xp:tripCore.state.growth?.xp||0,fire:tripCore.state.growth?.hidane?.any||0})),{hearts:{},xp:0,fire:0});
  await page.locator(t('travel-fly')).click();await page.locator(t('travel-cancel')).click();await settled(page);
  assert.equal(await page.evaluate(()=>tripCore.state.money),baseline.money);
  await page.locator(t('travel-fly')).click();await page.locator(t('travel-confirm')).click();await settled(page);
  const metrics={visits:0,rest:0};
  for(const who of ['sheikh','da_silva']){
   for(let visit=0;visit<8;visit++){
    if(await page.locator(t('travel-visit-'+who)).isDisabled()){
     await page.locator(t('travel-rest')).click();metrics.rest++;await settled(page);
    }
    await page.locator(t('travel-visit-'+who)).click();metrics.visits++;await settled(page);
    await page.waitForFunction(([who,count])=>tripCore.state.flags._ch5_growth_travel.visits[who]===count,[who,visit+1]);
    if(who==='sheikh'&&visit===3){
     await page.evaluate(async()=>{tripCore.save();tripCore.load();void (await import('./js/chapters/ch5.js')).resumeChapterFive();});
     await page.locator(t('travel-visit-sheikh')+':not(:disabled)').waitFor();await settled(page);
    }
   }
   assert.equal(await page.evaluate(async who=>(await import('./js/core/stats.js')).affinityLevel(who),who),5);
  }
  if(await page.evaluate(()=>tripCore.state.slot!==0)){await page.locator(t('travel-rest')).click();metrics.rest++;await settled(page);}
  await allocate(page,'M-W8','wisdom');
  await page.locator(t('travel-lesson-sheikh')).click();await settled(page);
  assert.equal(await page.evaluate(()=>tripCore.state.growth.learned.includes('M-W8')),true);
  await allocate(page,'M-B6','body');
  await page.locator(t('travel-lesson-da_silva')).click();await settled(page);
  assert.equal(await page.evaluate(()=>tripCore.state.growth.learned.includes('M-B6')),true);
  await page.locator(t('travel-return')).click();await page.locator(t('travel-confirm')).click();await settled(page);
  await page.locator(t('ch5-free')).waitFor();
  const result=await page.evaluate(async()=>{
   tripCore.save();tripCore.load();const s=tripCore.state;
   return {day:s.day,money:s.money,stats:JSON.stringify(s.stats),hearts:s.affinity,xp:s.growth.xp,level:s.growth.level,fire:s.growth.hidane,
    learned:s.growth.learned,part:s.flags._ch5.part,region:s.flags._ch5_growth_travel.region};
  });
  assert.equal(result.money,baseline.money-68000);assert.equal(result.stats,baseline.stats);
  assert.equal(result.day-baseline.day,11);assert.equal(metrics.visits,16);assert.equal(metrics.rest,2);
  assert.deepEqual(result.learned.sort(),['M-B6','M-W8']);assert.equal(result.part,'free');assert.equal(result.region,'local');
  assert.equal(result.hearts.sheikh,68);assert.equal(result.hearts.da_silva,68);
  console.log('normal travel metrics',JSON.stringify({...metrics,days:result.day-baseline.day,moneySpent:baseline.money-result.money,xp:result.xp,level:result.level,fire:result.fire}));
 });
 await check('LOAD-during-flight-confirm-and-shift-import',async page=>{
  await start(page);
  await page.locator(t('travel-fly')).click();await page.locator(t('travel-confirm')).waitFor();
  await page.evaluate(()=>{tripCore.save();tripCore.load();});
  await page.locator(t('travel-confirm')).waitFor({state:'detached'});
  await page.evaluate(async()=>{void (await import('./js/chapters/ch5.js')).resumeChapterFive();});
  await page.locator(t('ch5-travel')).click();await page.locator(t('travel-shift')).waitFor();
  // キャッシュ済みでもimportは非同期。選択の継続がimportへ入った後、解決前にLOADする。
  const before=await page.evaluate(async()=>{
   tripCore.save();document.querySelector('[data-test="travel-shift"]').click();
   await Promise.resolve();await Promise.resolve();
   tripCore.load();return JSON.stringify(tripCore.state);
  });
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,300)));
  assert.equal(await page.evaluate(()=>JSON.stringify(tripCore.state)),before,'import後の旧シフトはLOAD先を変更しない');
 });
 await check('landscape-costs-insufficient-and-cancel',async page=>{
  await start(page,0);assert.equal(await page.locator(t('travel-fly')).isDisabled(),true);
  await assertFits(page,'.ch2-contest-actions .btn');
  await page.locator(t('travel-back')).click();await page.locator(t('ch5-free')).waitFor();
  assert.equal(await page.evaluate(()=>tripCore.state.money),0);
 },{viewport:{width:844,height:390},isMobile:true,hasTouch:true});
},{entry:`${baseURL}?growth=1`});
