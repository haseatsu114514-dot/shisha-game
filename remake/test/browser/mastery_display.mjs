import assert from 'node:assert/strict';
import { suite } from './support.mjs';
await suite('mastery-display', async check => {
 for (const touch of [false,true]) await check(touch?'touch':'pc', async page => {
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js'); const s=core.newGame();
   const m=await import('./js/core/flavor-mastery.js'); const n=await import('./js/core/mastery-notice.js');
   const {DB}=await import('./js/core/data.js'); window.MD={core,m,n,DB};
   s.flavorMastery={lemon:5,mint:59};
   n.notifyMastery(m.gainFlavorExperience(s,{lemon:6,mint:6},2,DB.flavorById));
  });
  await page.locator('.gain-card').first().waitFor();
  assert.equal(await page.locator('.gain-card').count(),2);
  assert.match(await page.locator('#banners').innerText(),/熟練度アップ/);
  assert.match(await page.locator('#banners').innerText(),/★★★★★ MAX/);
  assert.doesNotMatch(await page.locator('#banners').innerText(),/次まで|あと\d/);
  await page.waitForTimeout(650); // 通知の入場アニメーション完了を待つ
  await page.screenshot({path:`/tmp/1081-mastery-${touch?'touch':'pc'}.png`});
  await page.evaluate(()=>{
   MD.n.notifyMastery(MD.m.gainFlavorExperience(MD.core.state,{mint:1},6,MD.DB.flavorById));
   MD.n.notifyMastery(MD.m.gainFlavorExperience(MD.core.state,{lemon:1},0,MD.DB.flavorById));
   MD.n.notifyMastery(MD.m.gainFlavorExperience(MD.core.state,{lemon:1},.1,MD.DB.flavorById));
   MD.core.save(); MD.core.load();
  });
  assert.equal(await page.locator('.gain-card').count(),2,'max, no gain, small gain and LOAD do not notify again');
  await page.evaluate(()=>document.querySelector('#banners').replaceChildren());
  await page.evaluate(async()=>{
   const s=MD.core.state;s.stats.charm=20;
   (await import('./js/core/stats.js')).gainStat('charm',1);
  });
  await page.locator('.gain-card.stat').waitFor();
  assert.match(await page.locator('.gain-card.stat').innerText(),/Lv.2/);
  assert.equal(await page.locator('.gain-card.stat .gc-points').count(),0);
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
});
