import assert from 'node:assert/strict';
import { suite } from './support.mjs';
await suite('flavor-mastery',async check=>{
 for(const touch of [false,true])await check(`private-and-staff-${touch?'touch':'pc'}`,async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.flavorStock={lemon:50};s.weatherSeed=0;s.day=8;
   window.M={core,mastery:await import('./js/core/flavor-mastery.js'),steps:await import('./js/craft/steps.js'),session:await import('./js/craft/session.js')};
   window.cs=M.session.newSession('rehearsal');cs.staffPractice=true;
   window.freeId=M.mastery.staffFlavors(s).find(id=>id!=='lemon');
   M.session.openBench(cs);window.done=false;void M.steps.stepMix(cs).then(()=>done=true);
  });
  await page.locator('[data-test="mix-ok"]').waitFor();
  const free=await page.evaluate(()=>freeId);
  for(const id of [free,'lemon'])for(let i=0;i<6;i++)await page.locator(`[data-test="mix-plus-${id}"]`).click();
  assert.match(await page.locator('.mix-list').innerText(),/熟練度 Lv.1\/5/);
  assert.match(await page.locator('.mix-list').innerText(),/まかない 6g/);
  assert(await page.locator('[data-test="mix-ok"]').isEnabled());
  await page.locator('[data-test="mix-ok"]').click();await page.waitForFunction(()=>done);
  const paid=await page.evaluate(()=>({stock:M.core.state.flavorStock.lemon,own:cs.practiceSpent.own.lemon,free:M.mastery.staffStock(M.core.state,freeId)}));
  assert.equal(paid.stock,50-paid.own);assert.equal(paid.free,0);assert(paid.own>0);
  await page.evaluate(()=>{M.core.save();M.core.load();});assert.equal(await page.evaluate(()=>M.mastery.staffStock(M.core.state,freeId)),0);
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
 await check('staff-full-practice-grows-on-completion',async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.flavorStock={lemon:50};s.weatherSeed=0;s.day=8;
   const craft=await import('./js/craft/session.js');craft.craftTest.auto='good';
   window.practiceDone=false;void (await import('./js/craft/practice.js')).runFullPractice({staffPractice:true,kind:'self'}).then(cs=>{window.finishedPractice=cs;practiceDone=true;});
  });
  await page.waitForFunction(()=>practiceDone,null,{timeout:120000});
  const result=await page.evaluate(()=>({xp:__remake.state.flavorMastery,runs:__remake.state.flags._craft_practice_runs,mix:finishedPractice.mix,own:finishedPractice.practiceSpent.own}));
  assert(Object.values(result.xp).reduce((a,b)=>a+b,0)>=2);assert.equal(result.runs.length,1);assert.equal(result.runs[0].served,true);
  const total=Object.values(result.mix).reduce((a,b)=>a+b,0),budget=2+4*Object.values(result.own).reduce((a,b)=>a+b,0)/total;
  for(const [id,g] of Object.entries(result.mix))assert.equal(result.xp[id],Math.round(budget*g/total*1000)/1000,'staff practice divides experience by grams');
 });
 await check('first-lemon-errand' ,async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();window.errandDone=false;
   const shop=await import('./js/daily/shop.js');void shop.openShop({errand:'lemon',expense:true,expenseFlag:'_errand_lemon_expensed'}).then(()=>errandDone=true);
  });
  await page.locator('[data-test="buy-lemon"]').click();await page.locator('[data-test="shop-checkout"]').click();
  const bought=await page.evaluate(()=>({money:__remake.state.money,lemon:__remake.state.flavorStock.lemon,mint:__remake.state.flavorStock.mint||0}));
  assert.deepEqual(bought,{money:30000,lemon:50,mint:0});
  await page.locator('[data-test="shop-leave"]').click();await page.waitForFunction(()=>errandDone);
 });
 await check('lime-shift-order-survives-close',async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.day=3;s.phase='daily';s.flavorStock={lemon:50};
   (await import('./js/vn/engine.js')).vnTest.turbo=true;
   const {doBaito}=await import('./js/daily/tonari.js');const {openLime}=await import('./js/daily/phone.js');
   window.shiftDone=false;
   void openLime({beforeClose:()=>{void doBaito({called:true}).then(()=>shiftDone=true);}});
  });
  await page.locator('[data-test="phone-close"]').click();
  await page.locator('[data-test="shift-order-0"]').waitFor();
  await page.waitForTimeout(400); // スマホの閉じる処理が新しい注文を消さないこと
  await page.locator('[data-test="shift-order-0"]').click();
  await page.locator('[data-test="after-none"]').click();await page.waitForFunction(()=>shiftDone);
  const result=await page.evaluate(()=>({xp:__remake.state.flavorMastery,stock:__remake.state.flavorStock,money:__remake.state.money}));
  assert.deepEqual(result.xp,{},'customer orders never grant flavor experience');
  assert.deepEqual(result.stock,{lemon:50});assert(result.money>=43000);
 });
 await check('lemon-tournament-consumes' ,async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();core.state.flavorStock={lemon:50};
   window.S={core,steps:await import('./js/craft/steps.js'),session:await import('./js/craft/session.js')};
   window.cs=S.session.newSession('tournament');S.session.openBench(cs);window.done=false;void S.steps.stepMix(cs).then(()=>done=true);
  });
  await page.locator('[data-test="mix-ok"]').waitFor();assert.equal(await page.locator('[data-flavor="mint"]').count(),0);
  for(let i=0;i<12;i++)await page.locator('[data-test="mix-plus-lemon"]').click();
  await page.locator('[data-test="mix-ok"]').click();await page.waitForFunction(()=>done);
  assert.equal(await page.evaluate(()=>S.core.state.flavorStock.lemon),38);
 });
 await check('day2-old-rig-gift-once',async page=>{
  const result=await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.day=1;s.phase='daily';
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   const rig=await import('./js/daily/home-rig.js');await rig.giveEarlyHomeRig();const day1=s.owned.includes(rig.SUMI_RIG);
   s.day=2;await rig.giveEarlyHomeRig();const after={owned:[...s.owned],stock:{...s.flavorStock}};
   await rig.giveEarlyHomeRig();core.save();core.load();await rig.giveEarlyHomeRig();
   return {day1,after,loaded:{owned:core.state.owned,stock:core.state.flavorStock}};
  });
  assert.equal(result.day1,false);assert(result.after.owned.includes('home_rig_set'));assert.equal(result.after.stock.double_apple,50);assert.deepEqual(result.loaded,result.after);
 });
 await check('read-lesson-once' ,async page=>{
  const result=await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   await vn.play('ch1_minto_second');const first={...core.state.flavorMastery};await vn.play('ch1_minto_second');
   core.save();core.load();return {first,after:core.state.flavorMastery,lessons:core.state.flavorLessons};
  });
  assert.equal(result.first.mint,3);assert.deepEqual(result.after,result.first);assert.deepEqual(result.lessons,['ch1_minto_second']);
 });
});
