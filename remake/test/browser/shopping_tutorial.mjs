import assert from 'node:assert/strict';
import {suite} from './support.mjs';
await suite('shopping-tutorial',async check=>{
 for(const touch of [false,true]) await check(touch?'touch':'pc',async page=>{
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js');const s=core.newGame();
   window.ST={core,shop:await import('./js/daily/shop.js')};window.left=false;
   void ST.shop.openShop({errand:'lemon',expense:true,expenseFlag:'_errand_lemon_expensed'}).then(()=>left=true);
  });
  const press=target=>touch?target.tap():target.click();
  const highlighted=page.locator('.shop-paper button[data-errand-target="true"]');
  const guide=async(test, step)=>{
   assert.equal(await highlighted.count(),1);
   assert.equal(await highlighted.getAttribute('data-test'),test);
   assert.equal(await page.locator('.shop-errand').getAttribute('data-guide-step'),step);
   assert.equal(await highlighted.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
   assert.equal(await highlighted.isEnabled(),true);
   assert.equal(await highlighted.getAttribute('aria-current'),'step');
  };
  const lemon=page.locator('[data-test="buy-lemon"]');await lemon.waitFor();
  assert.equal(await page.locator('.shop-row.product').first().locator('[data-test="buy-lemon"]').count(),1);
  const box=await lemon.boundingBox();assert(box.y>=0&&box.y+box.height< (touch?390:720));
  await guide('buy-lemon','select');
  // Even after opening a different tab/filter or trying to leave, there is just one next target.
  await press(page.getByRole('button',{name:'機材',exact:true}));
  assert.equal(await highlighted.innerText(),'フレーバー');
  await press(highlighted);
  await press(page.getByRole('button',{name:'清涼',exact:true}));
  assert.equal(await highlighted.innerText(),'すべて');
  await press(highlighted);
  await guide('buy-lemon','select');
  await press(page.locator('[data-test="shop-leave"]'));
  await guide('buy-lemon','select');
  assert.doesNotMatch(await page.locator('#toasts').innerText(),/スミ/);
  await press(lemon);
  await guide('shop-checkout','purchase');
  await page.evaluate(()=>ST.core.state.money=0);
  await press(lemon);
  await guide('minus-lemon','reduce');
  await press(highlighted);
  await guide('shop-checkout','purchase');
  await page.evaluate(()=>ST.core.state.money=30000);
  await press(page.locator('[data-test="minus-lemon"]'));
  await guide('buy-lemon','select');
  await press(lemon);
  await press(page.locator('[data-test="shop-summary"]'));
  await press(page.locator('[data-test="shop-clear"]'));
  await guide('buy-lemon','select');
  await press(lemon);
  await guide('shop-checkout','purchase');
  await press(highlighted);
  await guide('shop-leave','leave');
  assert.deepEqual(await page.evaluate(()=>({money:ST.core.state.money,stock:ST.core.state.flavorStock.lemon,paid:ST.core.state.flags._errand_lemon_expensed})),{money:30000,stock:50,paid:true});
  await press(highlighted);await page.waitForFunction(()=>left);
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
