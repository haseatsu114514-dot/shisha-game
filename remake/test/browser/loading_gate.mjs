import assert from "node:assert/strict";
import path from "node:path";
import { suite, baseURL } from "./support.mjs";

await suite("loading-gate", async check => {
  for (const [label, viewport] of [["pc", { width: 1280, height: 900 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
      await page.locator('[data-demo="comic"]').click();
      await page.locator('.loading-gate').waitFor();
      assert.equal(await page.locator('#underlying').evaluate(node => node.closest('.demo-scene').inert), true);
      await page.locator('.loading-panels img').first().waitFor();
      assert.equal(await page.locator('.loading-panels img').count(), 2);
      assert.equal(await page.locator('.loading-gate').innerText(), 'LOADING…');
      assert.equal(await page.locator('.loading-gate button, .loading-gate progress, .loading-gate h2, .loading-gate figcaption').count(), 0);
      await page.screenshot({ path: path.resolve(`.codex/artifacts/remake-browser/loading-comic-${label}.png`) });
      const boxes = await page.locator('.loading-panels img').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, natural: node.naturalWidth };
      }));
      assert(boxes.every(box => box.natural > 0 && box.width > 0 && box.left >= 0 && box.right <= viewport.width));
      assert(boxes[0].right < boxes[1].left, "Panels read from left to right");
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.loading-gate').evaluate(node => node === document.activeElement), true);
      await page.evaluate(() => { window.clicksBehindGate = 0; window.addEventListener('click', () => { window.clicksBehindGate++; }, { once: true }); });
      await page.locator('.loading-status').click();
      assert.equal(await page.locator('.loading-gate').count(), 1, 'Input must not skip preparation');
      await page.keyboard.press('Enter');
      await page.locator('.loading-gate').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#underlying').evaluate(node => node.closest('.demo-scene').inert), false);
      assert.match(await page.locator('#result').textContent(), /準備完了/);
      assert.equal(await page.evaluate(() => window.clicksBehindGate), 0, 'Gate clicks must not reach gameplay handlers');
      assert.equal(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })), storage);
    }, { viewport });
  }
  await check("fast-error-cancel", async page => {
    await page.evaluate(() => {
      window.gatesShown = 0;
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node.matches?.('.loading-gate')) window.gatesShown++;
      }).observe(document.querySelector('#loading-demo'), { childList: true });
    });
    await page.locator('[data-demo="fast"]').click();
    await page.getByText('準備完了。次の場面を開始できます。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.gatesShown), 0);
    await page.locator('[data-demo="error"]').click();
    await page.getByText('準備に失敗しました。再度お試しください。', { exact: true }).waitFor();
    assert.equal(await page.locator('.loading-gate').count(), 0);
    await page.locator('[data-demo="plain"]').click();
    await page.locator('.loading-gate').waitFor();
    await page.locator('#cancel').click();
    await page.getByText('中断しました。元の操作に戻れます。', { exact: true }).waitFor();
    await page.locator('#underlying').click();
    assert.match(await page.locator('#result').textContent(), /操作を受け付け/);
  });
  await check("no-comic-does-not-wait", async page => {
    await page.locator('[data-demo="plain"]').click();
    await page.locator('.loading-gate').waitFor();
    assert.equal(await page.locator('.loading-comic img').count(), 0);
    assert.equal(await page.locator('.loading-proceed').count(), 0);
    await page.getByText('準備完了。次の場面を開始できます。', { exact: true }).waitFor();
    assert.equal(await page.locator('.loading-gate').count(), 0);
  });
  await check("slow-comic-does-not-delay", async page => {
    await page.route('**/slow-panel.svg', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' });
    });
    const result = await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = new URL('slow-panel.svg', location.href).href;
      let imagesReceived = false;
      const observer = new MutationObserver(() => { if (host.querySelector('.loading-panels img')) imagesReceived = true; });
      observer.observe(host, { childList: true, subtree: true });
      await withLoading(() => new Promise(resolve => setTimeout(resolve, 300)), { host, delayMs: 0,
        comics: [{ id: 'slow', title: 'slow', minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }] });
      observer.disconnect();
      return { imagesReceived, closed: !host.querySelector('.loading-gate') };
    });
    assert.deepEqual(result, { imagesReceived: false, closed: true });
    // Let the deliberately slow successful response finish before closing the context.
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.loading-gate').count(), 0, 'Late images must not recreate a closed gate');
  });
  await check("failures-lifecycle", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading, selectLoadingComic } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const original = host.firstElementChild;
      original.inert = true;
      host.setAttribute('aria-busy', 'false');
      let release, started;
      const preparationStarted = new Promise(resolve => { started = resolve; });
      const controller = new AbortController();
      const pending = withLoading(() => new Promise(resolve => { release = resolve; started(); }), { host, delayMs: 0, signal: controller.signal });
      const duplicate = await withLoading(async () => {}, { host }).then(() => false, () => true);
      await preparationStarted;
      controller.abort();
      const aborted = await pending.then(() => false, error => error.name === 'AbortError');
      release?.();
      const restored = original.inert && host.getAttribute('aria-busy') === 'false' && !host.querySelector('.loading-gate');
      original.inert = false;
      // Use valid SVG responses for successful images and an invalid data URL for a missing panel.
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>';
      const invalid = [{ id: 'broken', title: 'broken', minChapter: 1, panels: [{ src, alt: 'one' }, { src: 'data:image/png,invalid', alt: 'two' }] }];
      await withLoading(() => new Promise(resolve => setTimeout(resolve, 300)), { host, delayMs: 0, comics: invalid });
      const recovered = !host.querySelector('.loading-gate');
      const spoiler = selectLoadingComic([{ ...invalid[0], minChapter: 3 }], { chapter: 1 }) === null;
      const wrongContext = selectLoadingComic([{ ...invalid[0], contexts: ['craft'] }], { context: 'travel' }) === null;
      const malformed = selectLoadingComic([{ ...invalid[0], panels: [] }]) === null;
      const valid = ["a", "b"].map(id => ({ ...invalid[0], id }));
      const random = Math.random;
      Math.random = () => { throw new Error('Loading consumed gameplay random'); };
      let first, next;
      try { first = selectLoadingComic(valid); next = selectLoadingComic(valid); }
      finally { Math.random = random; }
      const fresh = first.id !== next.id;
      return { duplicate, aborted, restored, recovered, spoiler, wrongContext, malformed, fresh };
    });
    assert(Object.values(result).every(Boolean), JSON.stringify(result));
  });
}, { entry: new URL('loading-preview.html', baseURL).href, readySelector: '[data-demo="plain"]' });
