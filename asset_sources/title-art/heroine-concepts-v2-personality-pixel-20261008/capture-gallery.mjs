// Browser screenshots of the preserved originals; never edits an artwork.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../../..');
const { chromium } = createRequire(root + '/remake/test/public-smoke.mjs')('playwright');
const review = folder + '/review';
await mkdir(review, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
const evidence = { tool: 'Playwright browser screenshots', original_artwork_modified: false, screenshots: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1520, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText));
  const url = process.env.GALLERY_URL || 'http://127.0.0.1:8137/' + relative(root, folder) + '/comparison.html';
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0));
  // Keep the comparison controls above the art in full-page screenshots.
  await page.addStyleTag({ content: 'nav{position:static!important}' });
  assert.equal(await page.locator('.grid > figure').count(), 19);
  assert.equal(await page.locator('section').count(), 6);
  const ids = ['tsumugi', 'mashiro', 'minto', 'ageha', 'rin', 'kafuka'];
  for (const id of ids) {
    await page.locator('section[data-character="' + id + '"]').screenshot({ path: review + '/' + id + '.png' });
    evidence.screenshots.push(id + '.png');
  }
  await page.screenshot({ path: review + '/overview.png', fullPage: true });
  evidence.screenshots.push('overview.png');
  await page.getByRole('button', { name: 'タイトル右側で比較', exact: true }).click();
  assert(await page.locator('body').evaluate(el => el.classList.contains('title-mode')));
  for (const id of ids) {
    await page.locator('section[data-character="' + id + '"]').screenshot({ path: review + '/' + id + '-title.png' });
    evidence.screenshots.push(id + '-title.png');
  }
  await page.screenshot({ path: review + '/title-overview.png', fullPage: true });
  evidence.screenshots.push('title-overview.png');
  await page.getByRole('button', { name: '前の案も並べる', exact: true }).click();
  assert.equal(await page.locator('.previous img.art:visible').count(), 0); // Hidden while title frames are shown.
  assert.equal(await page.locator('.previous .frame:visible').count(), 15);
  await page.screenshot({ path: review + '/previous-title-comparison.png', fullPage: true });
  evidence.screenshots.push('previous-title-comparison.png');
  await page.getByRole('button', { name: '原画', exact: true }).click();
  assert.equal(await page.locator('.previous img.art:visible').count(), 15);
  await page.getByRole('button', { name: 'みんと', exact: true }).click();
  assert.equal(await page.locator('section:visible').count(), 1);
  assert.equal(await page.locator('section:visible figure').count(), 4);
  await page.locator('section[data-character="minto"]').screenshot({ path: review + '/minto-previous-comparison.png' });
  evidence.screenshots.push('minto-previous-comparison.png');
  await page.getByRole('button', { name: '前の案も並べる', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'サメちゃん', exact: true }).click();
  assert.equal(await page.locator('section:visible figure').count(), 3);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: review + '/kafuka-mobile.png', fullPage: true });
  evidence.screenshots.push('kafuka-mobile.png');
  assert.deepEqual(errors, []);
  evidence.original_count = 19;
  evidence.previous_count = 15;
  evidence.browser_errors = errors;
  evidence.mobile_width = 390;
  await writeFile(review + '/browser-validation.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('PASS: 19 originals, 15 previous originals, six heroine filters, title layouts, mobile fit, no browser errors');
} finally {
  await browser.close();
}
