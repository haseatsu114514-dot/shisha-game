import assert from 'node:assert/strict';
import path from 'node:path';
import { suite, baseURL } from './support.mjs';

await suite('loading-craft', async check => {
  for (const [label, viewport] of [['pc', { width: 1280, height: 720 }], ['mobile', { width: 844, height: 390 }]]) {
    await check(label, async page => {
      const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      assert.equal(await page.locator('.bench').count(), 1, 'Use the actual game bench');
      await page.locator('.loading-panels img').first().waitFor();
      assert.equal(await page.locator('.loading-panels img').count(), 2);
      assert.match(await page.locator('.loading-comic h2').textContent(), /メニュー改訂/);
      assert.equal(await page.locator('.loading-proceed').isVisible(), false);
      assert.equal(await page.locator('.bench-panel > *').count(), 0, 'No gameplay before preparation');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.loading-gate').count(), 1, 'Cannot skip the preparation');
      await page.locator('.loading-proceed').waitFor();
      assert.equal(await page.locator('.bench-panel > *').count(), 0, 'Wait for the reader before starting');
      const regions = await page.locator('.loading-panel-art').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(), image = node.querySelector('img');
        const stage = document.querySelector('#stage').getBoundingClientRect();
        return { inside: box.left >= stage.left && box.right <= stage.right && box.bottom <= stage.bottom,
          ratio: box.width / box.height, decoded: image.complete && image.naturalWidth === 1086,
          overflow: getComputedStyle(node).overflow, src: image.getAttribute('src') };
      }));
      assert(regions.every(region => region.inside && region.decoded && region.overflow === 'hidden'));
      assert(regions[0].ratio > 1.5 && regions[1].ratio > 1.8, 'Keep the original panel proportions');
      assert(regions.every(region => region.src.endsWith('adam-chaos.webp')));
      await page.screenshot({ path: path.resolve(`.codex/artifacts/remake-browser/loading-ingame-${label}.png`) });
      await page.locator('.loading-proceed').click();
      await page.locator('.loading-gate').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.querySelector('.bench-panel')?.childElementCount > 0);
      assert.equal(await page.locator('#screen').evaluate(node => node.inert), false);
      assert.equal(await page.locator('.bench').evaluate(node => node.inert), false);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), storage);
    }, { viewport });
  }
}, {
  entry: new URL('craft-preview.html?loading=comic', baseURL).href,
  readySelector: '.loading-gate',
  initScript: () => localStorage.setItem('suien_remake_save', 'untouched-loading-preview'),
});
