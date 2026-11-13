import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
const t = id => `[data-test="${id}"]`;
async function setup(page, values = {}) {
  await page.evaluate(async values => {
    const core = await import('./js/core/state.js'), vn = await import('./js/vn/engine.js');
    const s = core.newGame(); Object.assign(s,{phase:'daily',day:1,slot:0},values);
    window.RS = {core,vn,shop:await import('./js/daily/shop.js'),lines:[],scenes:[],done:false};
    const lineBefore=vn.hooks.onLine, enterBefore=vn.hooks.onEnter;
    vn.hooks.onLine=(id,line)=>{ RS.lines.push({id,text:line.text});lineBefore?.(id,line); };
    vn.hooks.onEnter=(id,scene)=>{ RS.scenes.push(id);enterBefore?.(id,scene); };
    RS.open=opts=>{ RS.done=false;RS.promise=RS.shop.openShop(opts).then(r=>{RS.result=r;RS.done=true;}); };
    const ui=await import('./js/core/ui.js');ui.clearScreen();
  }, values);
}
const resources = page => page.evaluate(()=>{
 const s=RS.core.state;return {day:s.day,slot:s.slot,money:s.money,stamina:s.stamina,stats:s.stats,affinity:s.affinity,story:s.story,visits:s.visits,visitedDay:s.visitedDay,contacts:s.contacts,stock:s.flavorStock};
});
async function readTo(page, selector) {
  const until=Date.now()+30000;
  while(Date.now()<until) {
    if(await page.locator(selector).isVisible().catch(()=>false)) return;
    if(await page.locator('.vn-box').isVisible().catch(()=>false)) await page.locator('.vn-box').click({force:true});
    await page.waitForTimeout(50);
  }
  throw Error(`Shop dialogue did not finish before ${selector}`);
}
await suite('rio-shop-entry',async check=>{
 for(const touch of [false,true])await check(touch?'first-touch':'first-pc',async page=>{
  await setup(page);const before=await resources(page);
  await page.evaluate(()=>RS.open({errand:'lemon',expense:true,expenseFlag:'_errand_lemon_expensed'}));
  await page.locator('body.vn-open .vn-box').waitFor();
  assert.equal(await page.locator(t('buy-lemon')).count(),0,'conversation precedes product UI');
  await assertFits(page,'.vn-box');
  await readTo(page,t('buy-lemon'));
  assert.deepEqual(await resources(page),before,'the store greeting is not an affinity/action reward');
  const met=await page.evaluate(()=>({met:RS.core.state.met.rio,flag:RS.core.state.flags._met_rio,monitor:!!RS.core.state.flags._ev_rio_monitor,contact:RS.core.state.contacts.includes('rio'),scenes:RS.scenes,lines:RS.lines}));
  assert(met.met&&met.flag);assert(!met.monitor&&!met.contact);
  assert.deepEqual(met.scenes,['ch1_shop_rio_first']);assert(met.lines.some(l=>l.text?.includes('今度は夜に2階')));
  assert(!met.lines.some(l=>l.text?.includes('モルモット')));
  await page.locator(t('buy-lemon')).click();await page.locator(t('shop-checkout')).click();
  assert.equal(await page.evaluate(()=>RS.core.state.money),before.money);assert.equal(await page.evaluate(()=>RS.core.state.flavorStock.lemon),50);
  await page.locator(t('shop-leave')).click();await page.waitForFunction(()=>RS.done);
  await page.evaluate(()=>{RS.core.save();RS.core.load();RS.open({});});
  await readTo(page,t('shop-enter'));
  assert(await page.locator(t('shop-upstairs')).isDisabled(),'daytime invitation does not force an upstairs visit');
  assert.deepEqual(await page.evaluate(()=>RS.scenes),['ch1_shop_rio_first','ch1_shop_rio_return']);
  await page.locator(t('shop-entry-back')).click();await page.waitForFunction(()=>RS.done);
  assert.equal(await page.evaluate(()=>RS.result),null);
  await page.evaluate(()=>{RS.core.state.day=5;RS.core.state.slot=1;RS.open({});});
  await readTo(page,t('shop-upstairs'));assert(!await page.locator(t('shop-upstairs')).isDisabled());
  const beforeUpstairs=await resources(page);await page.locator(t('shop-upstairs')).click();await page.waitForFunction(()=>RS.done);
  assert.equal(await page.evaluate(()=>RS.result),'rio');assert.deepEqual(await resources(page),beforeUpstairs,'only an explicit upstairs visit spends an action');
  await page.evaluate(()=>{RS.vn.vnTest.turbo=true;RS.vn.vnTest.choose=()=>0;RS.visiting=RS.shop.visitRio();});
  await page.waitForFunction(()=>RS.core.state.story.rio===1);
  await page.evaluate(()=>RS.visiting);
  const up=await page.evaluate(()=>({stamina:RS.core.state.stamina,visits:RS.core.state.visits.rio,lines:RS.lines.map(l=>l.text)}));
  assert.equal(up.stamina,beforeUpstairs.stamina-14);assert.equal(up.visits,1);
  assert(up.lines.some(x=>x?.includes('今日は上まで来たんだ')));assert(!up.lines.some(x=>x?.includes('前掛けの折り目')));
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
 await check('load-during-greeting',async page=>{
  await setup(page);await page.evaluate(()=>{RS.core.save();RS.open({errand:'lemon'});});
  await page.locator('body.vn-open .vn-box').waitFor();
  await page.evaluate(async()=>{const ui=await import('./js/core/ui.js');RS.core.load();ui.clearScreen();RS.vn.vnTest.turbo=true;});
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>RS.done),false,'abandoned errand continuation stays abandoned');
  assert.equal(await page.locator(t('buy-lemon')).count(),0);assert.equal(await page.evaluate(()=>!!RS.core.state.met.rio),false);
  await page.evaluate(()=>RS.open({errand:'lemon'}));await page.locator(t('buy-lemon')).waitFor();
  assert.equal(await page.evaluate(()=>!!RS.core.state.met.rio),true);
 });
 await check('cancel-and-skip',async page=>{
  await setup(page);const before=await resources(page);
  await page.evaluate(()=>{RS.abort=new AbortController();RS.open({errand:'lemon',signal:RS.abort.signal});});
  await page.locator('body.vn-open .vn-box').waitFor();await page.evaluate(()=>RS.abort.abort());
  await page.waitForFunction(()=>RS.done);assert.equal(await page.evaluate(()=>RS.result),null);assert.deepEqual(await resources(page),before);
  await page.evaluate(()=>{RS.core.config.skipSeenOnly=false;RS.open({errand:'lemon'});});
  await page.locator('body.vn-open .vn-box').waitFor();await page.locator(t('vn-skip')).click();
  await page.locator(t('buy-lemon')).waitFor();assert.deepEqual(await resources(page),before);
  assert.equal(await page.evaluate(()=>!!RS.core.state.met.rio),true);
 });
 await check('ngplus-tokyo-prep-fallback',async page=>{
  await setup(page,{chapter:3,day:29});
  await page.evaluate(async()=>{
   const s=RS.core.state;s.flavorStock.lemon=50;s.flavors.push('lemon');
   RS.greeting=await import('./js/daily/shop-greeting.js');
   RS.done=false;RS.promise=RS.greeting.ensureRioBeforeTokyo().then(result=>{RS.result=result;RS.done=true;});
  });
  const before=await resources(page);await page.locator('body.vn-open .vn-box').waitFor();
  await readTo(page,'body:not(.vn-open)');await page.waitForFunction(()=>RS.done);
  assert.deepEqual(await resources(page),before);assert.equal(await page.evaluate(()=>RS.result),true);
  assert.equal(await page.evaluate(()=>!!RS.core.state.met.rio),true);
  assert.equal(await page.locator(t('buy-lemon')).count(),0);assert.equal(await page.locator(t('shop-upstairs')).count(),0);
  assert.deepEqual(await page.evaluate(()=>RS.scenes),['ch1_shop_rio_delivery']);
  await page.evaluate(async()=>{RS.core.save();RS.core.load();await RS.greeting.ensureRioBeforeTokyo();});
  assert.deepEqual(await page.evaluate(()=>RS.scenes),['ch1_shop_rio_delivery']);
 });
 await check('legacy-monitor-and-absent-clerk',async page=>{
  await setup(page,{day:5,slot:1,chapter:2});
  await page.evaluate(()=>{const s=RS.core.state;s.met.rio=true;s.story.rio=2;s.visits.rio=2;s.affinity.rio=18;RS.core.save();RS.core.load();RS.open({});});
  const before=await resources(page);await readTo(page,t('shop-enter'));
  assert.deepEqual(await resources(page),before);assert.deepEqual(await page.evaluate(()=>RS.scenes),['ch1_shop_rio_monitor']);
  await page.locator(t('shop-entry-back')).click();await page.waitForFunction(()=>RS.done);
  await page.evaluate(()=>{RS.core.state.day=9;RS.open({});});await readTo(page,t('shop-enter'));
  assert(await page.locator(t('shop-upstairs')).isDisabled());assert.deepEqual(await page.evaluate(()=>RS.scenes),['ch1_shop_rio_monitor','ch1_shop_clerk']);
  await page.locator(t('shop-enter')).click();await page.locator(t('buy-lemon')).waitFor();
 });
},{readShopGreeting:false});
