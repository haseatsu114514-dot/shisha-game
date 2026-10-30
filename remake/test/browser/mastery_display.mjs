import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
async function forecastSummary(page) {
 const compact=page.locator('[data-test="mix-taste-compact"]');
 const host=await compact.isVisible()?compact:page.locator('[data-test="mix-taste"]');
 const details=host.locator('.flavor-forecast-compact');
 if (await details.count() && !await details.evaluate(node=>node.open)) await details.locator(':scope > summary').click();
 return host.locator('[data-test="mix-mastery-summary"]');
}
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
  assert.match(await page.locator('.gain-card.stat').innerText(),/3段に上がった/); // 10段化（#1685 T2）: 内部値21は3段
  assert.equal(await page.locator('.gain-card.stat .gc-points').count(),0);
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});
 for (const touch of [false,true]) await check(`stars-without-experience-${touch?'touch':'pc'}`, async page => {
  for (const [xp,stars] of [[0,1],[5.999,1],[6,2],[17.999,2],[18,3],[35.999,3],[36,4],[59.999,4],[60,5]]) {
   await page.evaluate(async xp => {
    const core=await import('./js/core/state.js'), session=await import('./js/craft/session.js');
    const steps=await import('./js/craft/steps.js');
    const s=core.newGame();s.flavorStock={lemon:50};s.flavorMastery={lemon:xp};
    core.save();core.load();
    const cs=session.newSession('drill');
    await session.openBench(cs).ready;
    window.masteryMix={core,cs};void steps.stepMix(cs);
   },xp);
   for (let i=0;i<12;i++) await page.locator('[data-test="mix-plus-lemon"]').click();
   const summary=await forecastSummary(page);
   const expected=`${'★'.repeat(stars)}${'☆'.repeat(5-stars)}${stars===5?' MAX':''}`;
   assert.equal(await page.locator('[data-flavor="lemon"] .fr-mastery').innerText(),`熟練度 ${expected}`);
   assert.equal(await summary.innerText(),`熟練 ${expected} · 香りと予想に効く`);
   await summary.click();
   const masteryText=await page.locator('[data-flavor="lemon"] .fr-mastery').innerText()+' '+await summary.locator('..').innerText();
   assert.doesNotMatch(masteryText,/\d|経験値|次まで/,'Mastery details must show stages without numeric levels, XP or remaining XP');
   await summary.scrollIntoViewIfNeeded();await assertFits(page,'[data-test="mix-mastery-summary"]:visible');
   await page.locator('[data-test="mix-ok"]').scrollIntoViewIfNeeded();await assertFits(page,'[data-test="mix-ok"]');
   assert(await page.locator('[data-test="mix-ok"]').isEnabled());
   assert.deepEqual(await page.evaluate(()=>masteryMix.core.state.flavorMastery),{lemon:xp},'Viewing stars and SAVE/LOAD preserve fractional internal XP');
  }
  for (const [xp,mix,expected,level] of [
   [{lemon:60,mint:36},{lemon:9,mint:3},'★★★★☆ · 大会 +7.5',4.75],
   [{lemon:60,mint:60,double_apple:60},{lemon:9,mint:2,double_apple:1},'★★★★★ MAX · 大会 +8.0',4.999999999999999],
  ]) {
   await page.evaluate(async xp=>{
    const core=await import('./js/core/state.js'), session=await import('./js/craft/session.js');
    const steps=await import('./js/craft/steps.js'), m=await import('./js/core/flavor-mastery.js');
    const {DB}=await import('./js/core/data.js');
    const s=core.newGame();s.flavorStock=Object.fromEntries(Object.keys(xp).map(id=>[id,50]));s.flavorMastery=xp;
    const cs=session.newSession('tournament');await session.openBench(cs).ready;
    window.masteryMix={core,cs,m,DB};void steps.stepMix(cs);
   },xp);
   for (const [id,grams] of Object.entries(mix)) for(let i=0;i<grams;i++) await page.locator(`[data-test="mix-plus-${id}"]`).click();
   const summary=await forecastSummary(page);
   assert.equal(await summary.innerText(),`熟練 ${expected}`,'Weighted mastery shows completed stages, including MAX despite floating-point error; tournament points stay numeric');
   assert.equal(await page.evaluate(()=>masteryMix.m.mixMasteryProfile(masteryMix.core.state,masteryMix.cs.mix,masteryMix.DB.flavorById).level),level,'Star formatting preserves the weighted calculation');
   await summary.scrollIntoViewIfNeeded();
   await assertFits(page,'[data-test="mix-mastery-summary"]:visible');
   await page.locator('[data-test="mix-ok"]').scrollIntoViewIfNeeded();await assertFits(page,'[data-test="mix-ok"]');
   assert(await page.locator('[data-test="mix-ok"]').isEnabled());
  }
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{reducedMotion:'reduce'});
});
