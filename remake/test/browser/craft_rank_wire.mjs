import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite, assertFits } from './support.mjs';
import { assertCraftProgress } from './craft_progress_assertions.mjs';

await suite('craft-rank-wire', async check => {
  for (const [name, ds, options] of [
    ['session-pc', false, {}],
    ['session-pc-1180', false, { viewport: { width: 1180, height: 740 } }],
    ['session-touch', false, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ['session-ds', true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(name, async page => {
    await page.evaluate(async ds => {
      const core = await import('./js/core/state.js'); core.newGame();
      window.T = { session: await import('./js/craft/session.js'), heat: await import('./js/craft/heat.js'),
        score: await import('./js/craft/score.js'), ui: await import('./js/core/ui.js') };
      const { TITLE_LAYOUT_KEY } = await import('./js/scenes/title-layout.js');
      localStorage.setItem(TITLE_LAYOUT_KEY, ds ? 'ds' : 'normal');
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      T.cs = T.session.newSession('rehearsal');
      T.bench = T.session.openBench(T.cs, { steps: CRAFT_STEPS });
      while (!T.bench.root.isConnected) await new Promise(requestAnimationFrame);
      await T.bench.ready;
      T.session.stepPanel('heat', '炭焼き');
    }, ds);
    assert.equal(await page.locator('body.game-ds').count(), ds ? 1 : 0);
    assert.equal(await page.locator('.craft-rank').count(), 1);
    assert.equal(await page.locator('.bench-mode').count(), 1);
    if (!ds) await assertFits(page, '.bench-mode');
    assert.equal(await page.locator('.craft-rank-wide .craft-rank-grade').textContent(), '—');
    await page.evaluate(() => { T.session.craftTest.auto = 'good'; window.heatRun = T.heat.runHeat(T.cs); });
    await page.evaluate(() => window.heatRun);
    assert.notEqual(await page.locator('.craft-rank').getAttribute('data-grade'), 'unavailable');
    // Use the actual session fields and refresh path; no production score override hook.
    for (const [grade, score, progress] of [['B', 70, '33'], ['S', 92.5, '50'], ['SS', 96, '33'], ['SSS', 99, '100'], ['B', 70, '33']]) {
      await page.evaluate(score => {
        T.cs.heat.score = score;
        T.session.refreshBench();
      }, score);
      assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), grade);
      assert(['enter', 'up', 'down'].includes(await page.locator('.craft-rank').getAttribute('data-change')));
      assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), progress);
      await assertFits(page, '.craft-rank, .craft-rank-meter');
      if (!ds) {
        await assertFits(page, '.bench-mode');
        const separated = await page.evaluate(() => {
          const a = document.querySelector('.bench-mode').getBoundingClientRect();
          const b = document.querySelector('.craft-rank').getBoundingClientRect();
          return a.right <= b.left;
        });
        assert(separated, 'Mode context must stay beside the rank');
      }
      await assertCraftProgress(page);
      const overlaps = await page.evaluate(() => {
        const a = document.querySelector('.craft-rank').getBoundingClientRect();
        const b = document.querySelector('.bench-progress').getBoundingClientRect();
        return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      });
      assert.equal(overlaps, false);
      if (process.env.SHOTS && ['session-pc', 'session-ds'].includes(name)) {
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${process.env.SHOTS}/U6-${ds ? 'DS' : 'PC'}-${grade}.png` });
      }
    }

    await page.evaluate(() => {
      T.cs.stats = { craftQuality: 99 };
      T.cs.careHistory = [{ score: 99 }, { score: 99 }];
      T.score.finalize(T.cs);
    });
    const expected = await page.evaluate(async () => {
      const { CRAFT_RANK_THRESHOLDS } = await import('./js/craft/common.js');
      const { craftRankProgress } = await import('./js/craft/rank-hud.js');
      return craftRankProgress(T.cs.total, CRAFT_RANK_THRESHOLDS).grade;
    });
    assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), expected);
    assert.equal(await page.locator('.craft-rank').getAttribute('data-provisional'), 'false');
    await page.evaluate(async () => {
      const { resultTable } = await import('./js/craft/result.js');
      T.session.craftTest.auto = null;
      window.resultRun = resultTable(T.cs, 3);
    });
    await page.locator('[data-test="craft-final-rank"]').waitFor();
    assert.equal(await page.locator('[data-test="craft-final-rank"]').textContent(), expected);
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
    await page.locator('[data-test="result-next"]').click();
    await page.evaluate(() => window.resultRun);
    await page.evaluate(async () => {
      const b = T.session.openBench(T.session.newSession('rehearsal'));
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await b.ready;
    });
    assert.equal(await page.locator('.craft-rank').count(), 1);
    await page.evaluate(() => T.ui.retireScreen());
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
    // Reopening and aborting through a screen replacement also cleans up.
    await page.evaluate(async () => {
      const cs = T.session.newSession('rehearsal');
      const b = T.session.openBench(cs);
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await b.ready;
      T.ui.clearScreen();
    });
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
  }, options);
});
