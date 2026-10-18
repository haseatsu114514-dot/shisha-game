// #662: production decisions remain the source of button state and nearby reasons.
import assert from 'node:assert/strict';
import { suite, assertFits, storageSnapshot } from './support.mjs';

await suite('craft-decisions', async check => {
  for (const [device, touch, options] of [['pc', false, {}], ['touch', true,
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }]]) {
    await check(`${device}-mix-reasons`, async page => {
      await page.evaluate(async () => {
        const core = await import('./js/core/state.js'); core.newGame();
        const session = await import('./js/craft/session.js');
        const steps = await import('./js/craft/steps.js');
        window.D = { core, session, steps, cs: session.newSession('rehearsal') };
        D.cs.equip.bowl = 'silicone_bowl';
        await session.openBench(D.cs).ready; D.run = steps.stepMix(D.cs);
      });
      const before = await storageSnapshot(page);
      const reason = page.locator('[data-test="mix-decision-reason"]');
      await reason.waitFor();
      assert.match(await reason.textContent(), /あと12g/);
      assert.match(await reason.textContent(), /ミントがあと2g/);
      assert(await page.locator('[data-test="mix-ok"]').isDisabled());
      assert(await page.locator('[data-test="mix-temperature-preview"]').isHidden());
      const press = async (key, n = 1) => { for (let i = 0; i < n; i++) {
        const b = page.locator(`[data-test="${key}"]`); if (touch) await b.tap(); else await b.click();
      } };
      await press('mix-plus-double_apple', 12);
      assert.match(await reason.textContent(), /容量12gいっぱい/);
      assert(await page.locator('[data-test="mix-ok"]').isDisabled());
      await press('mix-plus-double_apple');
      assert.match(await reason.textContent(), /先にほかの葉を減らす/);
      assert.equal(await page.evaluate(() => D.cs.mix.double_apple), 12);
      await press('mix-minus-double_apple', 2); await press('mix-plus-mint', 2);
      assert.match(await reason.textContent(), /決定できます/);
      assert(await page.locator('[data-test="mix-ok"]').isEnabled());
      assert(await page.locator('[data-test="mix-temperature-preview"]').isVisible());
      await assertFits(page, '.mix-footer, .mix-decision, .mix-decision-reason, [data-test="mix-ok"]');
      assert.deepEqual(await storageSnapshot(page), before, 'Previewing a mix wrote storage');
      await page.evaluate(async () => {
        D.core.state.flavorStock.double_apple = 3;
        D.cs = D.session.newSession('tournament'); D.cs.equip.bowl = 'silicone_bowl';
        await D.session.openBench(D.cs).ready; D.run = D.steps.stepMix(D.cs);
      });
      await reason.waitFor();
      await press('mix-plus-double_apple', 4);
      assert.match(await reason.textContent(), /手持ちの3gまで/);
      assert.equal(await page.evaluate(() => D.cs.mix.double_apple), 3);
      assert.equal(await page.evaluate(() => D.core.state.flavorStock.double_apple), 3, 'Merely selecting consumed leaves');
      await assertFits(page, '.mix-decision-reason, [data-test="mix-ok"]');
    }, options);
  }
});
