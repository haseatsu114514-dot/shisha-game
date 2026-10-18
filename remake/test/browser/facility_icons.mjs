import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { FACILITY_ICONS } from '../../js/daily/facility-icons.js';

const out = process.env.ARTIFACT_DIR ? new URL(path.resolve(process.env.ARTIFACT_DIR) + '/', 'file:')
  : new URL('../../../asset_sources/store-logos/ch1-issue470/ingame-qa/facility-icons-579/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
// Pages copies assets + remake, excluding asset_sources. Stage only the five runtime files.
// A project subpath also catches URLs that accidentally depend on the domain root.
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'facility-icons-579-delivery-'));
const mount = '/shisha-game/';
const files = new Map([
  ['remake/facility-icons-preview.html', 'text/html; charset=utf-8'],
  ['remake/css/facility-icons.css', 'text/css; charset=utf-8'],
  ['remake/js/daily/facility-icons.js', 'text/javascript; charset=utf-8'],
  ['assets/ui/map-facilities-579.png', 'image/png'],
  ['assets/ui/map-facilities-extra-579.webp', 'image/webp'],
]);
for (const file of files.keys()) {
  const target = path.join(stage, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(new URL(`../../../${file}`, import.meta.url), target, fs.constants.COPYFILE_EXCL);
}
assert.equal(fs.existsSync(path.join(stage, 'asset_sources')), false);
const requests = [];
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  requests.push(pathname);
  const file = pathname.startsWith(mount) ? pathname.slice(mount.length) : '';
  if (!files.has(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': files.get(file) });
  response.end(fs.readFileSync(path.join(stage, file)));
});
await new Promise((resolve, reject) => {
  server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
});
const previewURL = `http://127.0.0.1:${server.address().port}${mount}remake/facility-icons-preview.html`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
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
    await page.goto(previewURL);
    await page.locator('.facility-icon img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('button').count(), 56);
    const geometry = await page.locator('.facility-icon').evaluateAll(icons => icons.map(icon => {
      const crop = icon.firstElementChild, image = crop.firstElementChild;
      const c = crop.getBoundingClientRect(), i = image.getBoundingClientRect(), b = icon.parentElement.getBoundingClientRect();
      return { id: icon.dataset.facility, size: Number(icon.parentElement.dataset.size),
        crop: [c.width, c.height], source: [image.naturalWidth, image.naturalHeight],
        imagePath: new URL(image.currentSrc).pathname,
        sourceOrigin: [(c.left-i.left)/i.width*image.naturalWidth, (c.top-i.top)/i.height*image.naturalHeight],
        overflow: getComputedStyle(crop).overflow, button: [b.width,b.height],
        fits: b.left >= 0 && b.right <= innerWidth, decoration: getComputedStyle(image).filter };
    }));
    const origins = Object.fromEntries(Object.entries(FACILITY_ICONS).map(([id,e]) => [id,e.rect.slice(0,2)]));
    for (const g of geometry) {
      const extra = FACILITY_ICONS[g.id].extra;
      assert.deepEqual(g.source, extra ? [1536,1024] : [2172,724]); assert.equal(g.overflow, 'hidden');
      assert.equal(g.imagePath, `${mount}assets/ui/map-facilities-${extra ? 'extra-579.webp' : '579.png'}`);
      assert(g.crop.every(value => value > 0 && value <= g.size + .1));
      g.sourceOrigin.forEach((value,index) => assert(Math.abs(value-origins[g.id][index]) < 1, JSON.stringify(g)));
      assert(g.button.every(value => value >= 48)); assert(g.fits); assert.equal(g.decoration, 'none');
    }
    for (const theme of ['light','dark']) for (const id of Object.keys(FACILITY_ICONS)) for (const size of [32,48,64,128]) {
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
    await page.screenshot({ path: new URL(`${label}.jpg`, out).pathname, fullPage: true, type: 'jpeg', quality: 80 });
    results.push({ label, passed: true, geometry, errors, failed, saveUnchanged: true });
    console.log(`PASS: ${label} — delivery stage without asset_sources, assets URL, 56 selections, crop geometry, save unchanged, no resource/page errors`);
    await context.close();
  }
  assert.deepEqual([...new Set(requests)].sort(), [...files.keys()].map(file => mount + file).sort());
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(stage, { recursive: true, force: true });
}
fs.writeFileSync(new URL('browser-results.json', out), JSON.stringify({
  mode: 'local delivery-equivalent stage; not live GitHub Pages',
  assetSourcesPresent: false, stagedFiles: [...files.keys()], requests: [...new Set(requests)].sort(), results,
}, null, 2) + '\n');
