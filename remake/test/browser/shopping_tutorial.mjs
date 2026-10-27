import assert from 'node:assert/strict';
import {suite} from './support.mjs';
await suite('shopping-tutorial',async check=>{
 for(const touch of [false,true]) await check(touch?'touch':'pc',async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();
   window.ST={core,shop:await import('./js/daily/shop.js')};window.left=false;
   void ST.shop.openShop({errand:'lemon',expense:true,expenseFlag:'_errand_lemon_expensed'}).then(()=>left=true);
  });
  const lemon=page.locator('[data-test="buy-lemon"]');await lemon.waitFor();
  assert.equal(await page.locator('.shop-row.product').first().locator('[data-test="buy-lemon"]').count(),1);
  const box=await lemon.boundingBox();assert(box.y>=0&&box.y+box.height< (touch?390:720));
  await page.locator('[data-test="shop-leave"]').click();
  assert.doesNotMatch(await page.locator('#toasts').innerText(),/スミ/);
  await page.screenshot({path:`/tmp/1081-shop-${touch?'touch':'pc'}.png`});
  await lemon.click();await page.locator('[data-test="shop-checkout"]').click();
  assert.deepEqual(await page.evaluate(()=>({money:ST.core.state.money,stock:ST.core.state.flavorStock.lemon,paid:ST.core.state.flags._errand_lemon_expensed})),{money:30000,stock:50,paid:true});
  await page.locator('[data-test="shop-leave"]').click();await page.waitForFunction(()=>left);
  assert.doesNotMatch(await page.locator('#toasts').innerText(),/スミ|ご苦労/);
  const result=await page.evaluate(async()=>{
   const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
   await vn.play('remake_lemon_gift');const first=ST.core.state.flavorMastery.lemon;
   ST.core.save();ST.core.load();await vn.play('remake_lemon_gift');
   return {first,xp:ST.core.state.flavorMastery.lemon,stock:ST.core.state.flavorStock.lemon,money:ST.core.state.money};
  });
  assert.deepEqual(result,{first:12,xp:12,stock:50,money:30000});
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
 for(const touch of [false,true]) await check(`daily-return-${touch?'touch':'pc'}`,async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();s.phase='daily';
   s.flags._morning_1=true;
   (await import('./js/vn/engine.js')).vnTest.turbo=true;
   void (await import('./js/daily/calendar.js')).runDaily({untilDay:2,nightEvents:[],onQuit(){}});
  });
  await page.locator('[data-test="pin-shop"]').click();
  await page.locator('[data-test="map-go"]').click();
  await page.locator('[data-test="buy-lemon"]').click();
  await page.locator('[data-test="shop-checkout"]').click();
  await page.locator('[data-test="shop-leave"]').click();
  await page.waitForFunction(()=>__remake.state.flags._lemon_gift_read);
  assert.deepEqual(await page.evaluate(()=>{const s=__remake.state;return {done:s.flags._errand_shop_done,read:s.flags._lemon_gift_read,xp:s.flavorMastery.lemon,stock:s.flavorStock.lemon,money:s.money};}),{done:true,read:true,xp:12,stock:50,money:30000});
  assert.doesNotMatch(await page.locator('#toasts').innerText(),/仕入れ、ご苦労/);
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});

});
