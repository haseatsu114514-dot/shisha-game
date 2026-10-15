import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const out = new URL('../../../asset_sources/store-logos/ch1-issue470/ingame-qa/facility-icons-579/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const [label, options] of [
    ['pc', { viewport: { width: 1280, height: 900 } }],
    ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['portrait-touch', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => localStorage.setItem('suien_remake_save', '{"facilityPreviewSentinel":579}'));
    await page.goto(process.env.FACILITY_PREVIEW_URL || 'http://127.0.0.1:8123/remake/facility-icons-preview.html');
    await page.locator('.facility-icon img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('button').count(), 24);
    const geometry = await page.locator('.facility-icon').evaluateAll(icons => icons.map(icon => {
      const crop = icon.firstElementChild, image = crop.firstElementChild;
      const c = crop.getBoundingClientRect(), i = image.getBoundingClientRect(), b = icon.parentElement.getBoundingClientRect();
      return { id: icon.dataset.facility, size: Number(icon.parentElement.dataset.size),
        crop: [c.width, c.height], source: [image.naturalWidth, image.naturalHeight],
        sourceOrigin: [(c.left-i.left)/i.width*2172, (c.top-i.top)/i.height*724],
        overflow: getComputedStyle(crop).overflow, button: [b.width,b.height],
        fits: b.left >= 0 && b.right <= innerWidth, decoration: getComputedStyle(image).filter };
    }));
    const origins = { kannondo: [21,87], home: [842,125], kohaku: [1552,104] };
    for (const g of geometry) {
      assert.deepEqual(g.source, [2172,724]); assert.equal(g.overflow, 'hidden');
      assert(g.crop.every(value => value > 0 && value <= g.size + .1));
      g.sourceOrigin.forEach((value,index) => assert(Math.abs(value-origins[g.id][index]) < 1, JSON.stringify(g)));
      assert(g.button.every(value => value >= 48)); assert(g.fits); assert.equal(g.decoration, 'none');
    }
    for (const theme of ['light','dark']) for (const id of ['kannondo','home','kohaku']) for (const size of [32,48,64,128]) {
      const button = page.locator(`.${theme} button[data-facility="${id}"][data-size="${size}"]`);
      if (options.hasTouch) await button.tap(); else await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert((await page.locator('#selection').innerText()).includes(`${size}px`));
      assert.equal(await page.locator('button[aria-pressed="true"]').count(), 1);
    }
    if (!options.hasTouch) {
      await page.locator('button').first().focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('button').first().getAttribute('aria-pressed'), 'true');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('suien_remake_save')), '{"facilityPreviewSentinel":579}');
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['suien_remake_save']);
    assert.deepEqual(errors, []); assert.deepEqual(failed, []);
    // Let Chrome's transient tap highlight finish before recording the artwork.
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL(`${label}.png`, out).pathname, fullPage: true });
    results.push({ label, passed: true, geometry, errors, failed, saveUnchanged: true });
    console.log(`PASS: ${label} — 24 selections, source/crop geometry, save unchanged, no resource/page errors`);
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(new URL('browser-results.json', out), JSON.stringify({ results }, null, 2) + '\n');
