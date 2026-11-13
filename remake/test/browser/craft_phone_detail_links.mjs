import assert from 'node:assert/strict';
import { suite } from './support.mjs';

// 横持ちスマホ（#3518）: 結果カードの「詳しく見る」と「?」の中の「お手本を見る」は、実寸の高さ 30px 以上で押せる。
const MIN_TAP = 30;

await suite('craft-phone-detail-links', async check => {
  for (const [name, options] of [
    ['phone-844x390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ['phone-low-844x340', { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true }],
  ]) await check(name, async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      window.S = await import('./js/craft/session.js');
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      const bench = S.openBench(S.newSession('tournament'), { steps: CRAFT_STEPS });
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      await bench.ready;
      S.stepPanel('pack', '詰め方', '詰め方');
    });
    // 「お手本を見る」は「?」を開くと出る。
    await page.locator('.bench-guide summary').click();
    const demo = page.locator('.bench-demo-link');
    if (await demo.count()) {
      await demo.waitFor();
      const box = await demo.boundingBox();
      assert(box.height >= MIN_TAP, `「お手本を見る」の高さ ${box.height}px`);
      await demo.click({ trial: true });
    }
    await page.locator('.bench-guide summary').click();
    await page.evaluate(async () => {
      const { resultCard } = await import('./js/craft/common.js');
      window.card = resultCard(document.querySelector('.bench-panel'), { title: '炭焼き', lines: ['炭1 PERFECT 3 GOOD 1 誤差 +0.4秒'], summary: ['炭は良い'], advice: 'もう少し' });
    });
    const details = page.locator('[data-test="step-details"]');
    await details.waitFor();
    await page.waitForTimeout(500);
    const box = await details.boundingBox();
    assert(box.height >= MIN_TAP, `「詳しく見る」の高さ ${box.height}px`);
    await details.click();
    assert.equal(await page.locator('.rc-details').getAttribute('open'), '', '「詳しく見る」で根拠が開く');
    await page.locator('[data-test="step-next"]').click();
    await page.evaluate(() => window.card);
  }, options);
});
