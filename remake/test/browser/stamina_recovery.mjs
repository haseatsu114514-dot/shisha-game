import assert from 'node:assert/strict';
import { suite } from './support.mjs';
await suite('stamina-recovery', async check => {
  for (const [name, options] of [['pc', {}], ['touch', {viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    await check(name, async page => {
      await page.evaluate(async () => {
        window.R = {core:await import('./js/core/state.js'),hud:await import('./js/daily/hud.js'),stats:await import('./js/core/stats.js')};
        R.core.newGame(); R.core.state.restDay={chapter:R.core.state.chapter,day:R.core.state.day,illnessHealth:'red'}; R.hud.initHud({}); R.hud.showHud(true);
      });
      for (const [before, after, expected] of [[5,20,'rgb(255, 105, 105)'],[20,35,'rgb(255, 212, 92)'],[30,45,'rgb(255, 212, 92)'],[45,65,'rgb(142, 230, 168)'],[90,100,'rgb(142, 230, 168)']]) {
        await page.evaluate(({before,after}) => {
          const maximum=R.stats.maxStamina(); R.core.state.stamina=maximum*after/100;
          R.hud.updateHud(); R.pending=R.hud.presentSleepRecovery({before:maximum*before/100,after:maximum*after/100});
        },{before,after});
        await page.locator('.sleep-recovery.show').waitFor();
        const colors=await page.evaluate(()=>({
          hud:getComputedStyle(document.querySelector('.hud-stamina b')).backgroundColor,
          sleep:getComputedStyle(document.querySelector('.sleep-gauge b')).backgroundColor,
          health:document.querySelector('.sleep-recovery').dataset.health
        }));
        assert.equal(colors.sleep,expected); assert.equal(colors.hud,expected);
        assert.equal(await page.evaluate(()=>R.stats.currentCondition().health),'red', 'illness gameplay condition stays unchanged');
        await page.evaluate(()=>R.pending);
        // Exercise the actual persisted state APIs in an isolated browser context.
        assert.equal(await page.evaluate(()=>{R.core.save();R.core.load();R.hud.updateHud();return document.querySelector('.hud-stamina').dataset.health;}),colors.health);
      }
    },options);
  }
});
