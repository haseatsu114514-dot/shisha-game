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
  assert.match(await page.locator('.mix-list').innerText(),/熟練度 ★☆☆☆☆/);
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
 await check('lemon-tournament-is-supplied-not-consumed' ,async page=>{
  // 課題のレモンは大会が無制限に支給する。本番で何g使っても私物在庫は減らない（#1052）。
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();core.state.flavorStock={lemon:50};
   window.S={core,steps:await import('./js/craft/steps.js'),session:await import('./js/craft/session.js')};
   window.cs=S.session.newSession('tournament');S.session.openBench(cs);window.done=false;void S.steps.stepMix(cs).then(()=>done=true);
  });
  await page.locator('[data-test="mix-ok"]').waitFor();assert.equal(await page.locator('[data-flavor="mint"]').count(),0);
  assert.match(await page.locator('.flavor-row[data-flavor="lemon"]').textContent(),/課題（支給）/);
  for(let i=0;i<12;i++)await page.locator('[data-test="mix-plus-lemon"]').click();
  await page.locator('[data-test="mix-ok"]').click();await page.waitForFunction(()=>done);
  assert.equal(await page.evaluate(()=>S.core.state.flavorStock.lemon),50);
 });
 await check('day2-old-rig-gift-once',async page=>{
  const result=await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.day=1;s.phase='daily';
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   const rig=await import('./js/daily/home-rig.js');await rig.giveEarlyHomeRig();const day1=s.owned.includes(rig.SUMI_RIG);
   const stockBefore={...s.flavorStock};
   s.day=2;await rig.giveEarlyHomeRig();const after={owned:[...s.owned],stock:{...s.flavorStock}};
   await rig.giveEarlyHomeRig();core.save();core.load();await rig.giveEarlyHomeRig();
   return {day1,stockBefore,after,loaded:{owned:core.state.owned,stock:core.state.flavorStock}};
  });
  // D02: 贈呈するのは卓上台だけ。在庫は増やさず、再実行・SAVE/LOADでも受領状態を保つ。
  assert.equal(result.day1,false);assert.equal(result.after.owned.filter(id=>id==='home_rig_set').length,1);assert.deepEqual(result.after.stock,result.stockBefore);assert.deepEqual(result.loaded,result.after);
 });
 for(const touch of [false,true])await check(`spring-water-${touch?'touch':'pc'}`,async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.chapter=2;s.day=4;s.phase='daily';
   window.SW={core,shop:await import('./js/daily/shop.js')};
   void SW.shop.openShop({branch:'widehanga'});
  });
  const row=page.locator('.shop-row.product').filter({has:page.locator('[data-test="buy-spring_water"]')});
  await row.waitFor();const image=row.locator('[data-product-art="spring_water"] img');
  await image.evaluate(im=>im.decode());assert.match(await image.getAttribute('src'),/spring-water.webp/);
  await row.screenshot({path:`.codex/artifacts/remake-browser/spring-water-product-${touch?'touch':'pc'}.png`});
  await page.locator('[data-test="buy-spring_water"]').click();await page.locator('[data-test="shop-checkout"]').click();
  assert.deepEqual(await page.evaluate(()=>({stock:SW.core.state.flavorStock.spring_water,money:SW.core.state.money})),{stock:50,money:28250});
  await page.locator('[data-test="shop-leave"]').click();
  const result=await page.evaluate(async()=>{
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   await vn.play('samechan_shop_repeat_0');const first=SW.core.state.flavorMastery.spring_water;
   await vn.play('samechan_shop_repeat_0');SW.core.save();SW.core.load();
   return {first,after:SW.core.state.flavorMastery.spring_water,stock:SW.core.state.flavorStock.spring_water};
  });
  assert.deepEqual(result,{first:12,after:12,stock:50});
  await page.evaluate(async()=>{
   const s=SW.core.state;s.flavorStock={spring_water:50};
   const craft=await import('./js/craft/session.js');const steps=await import('./js/craft/steps.js');
   window.cs=craft.newSession('rehearsal');cs.staffPractice=true;craft.openBench(cs);window.mixDone=false;void steps.stepMix(cs).then(()=>mixDone=true);
  });
  const mixRow=page.locator('[data-flavor="spring_water"]');await mixRow.waitFor();
  assert.match(await mixRow.innerText(),/熟練度 ★★☆☆☆/);
  for(let i=0;i<12;i++)await page.locator('[data-test="mix-plus-spring_water"]').click();
  assert(await page.locator('[data-test="mix-ok"]').isEnabled());
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
 await check('read-lesson-once' ,async page=>{
  const result=await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');core.newGame();
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   await vn.play('ch1_minto_second');const first={...core.state.flavorMastery};await vn.play('ch1_minto_second');
   await vn.play('remake_lemon_gift');await vn.play('remake_lemon_gift');
   core.save();core.load();return {first,after:core.state.flavorMastery,lessons:core.state.flavorLessons};
  });
  assert.equal(result.first.mint,12);assert.deepEqual(result.after,{mint:12,lemon:12});
  assert.deepEqual(result.lessons,['ch1_minto_second','remake_lemon_gift']);
 });
});
