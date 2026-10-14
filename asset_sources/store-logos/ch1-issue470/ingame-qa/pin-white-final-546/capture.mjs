// Current accepted map, with explicit known-owner/day fixtures. No progress is earned.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../../../../../remake/test/browser/package.json', import.meta.url))('playwright');
const out = process.env.SHOTS || new URL('./', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [device, options] of [['pc', { viewport: { width: 1280, height: 720 } }],
    ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    const context = await browser.newContext(options), page = await context.newPage();
    const errors = [], resources = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) resources.push(`${r.status()} ${r.url()}`); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator('#boot').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      window.P = { core: await import('./js/core/state.js'), ui: await import('./js/core/ui.js'),
        map: await import('./js/daily/map.js'), hud: await import('./js/daily/hud.js') };
      const s = P.core.newGame(); Object.assign(s, { phase: 'daily', day: 4, money: 30000 });
      for (const id of ['naru', 'adam', 'minto', 'rin', 'tsumugi']) s.met[id] = true;
      P.hud.initHud({}); P.hud.showHud(); await P.ui.warmUiArt();
    });
    for (const [time, slot] of [['day', 0], ['night', 1]]) {
      await page.evaluate(slot => {
        P.map.interruptMap(null); P.ui.dropRetired(); P.core.state.slot = slot;
        P.before = JSON.stringify(P.core.state); P.saveBefore = localStorage.getItem(P.core.SAVE_KEY);
        P.running = P.map.chooseSpot({ eventPin: 'naru' });
      }, slot);
      await page.locator('.map .spot-pin.branded').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.spot-pin img')].every(i => i.complete && i.naturalWidth > 0));
      const info = await page.evaluate(() => ({
        signs: [...document.querySelectorAll('.spot-pin.branded .shield')].map(n => ({
          spot: n.closest('.spot-pin').dataset.spot, width: parseFloat(getComputedStyle(n).width),
          color: getComputedStyle(n, '::before').backgroundColor, image: getComputedStyle(n, '::before').backgroundImage,
          mask: getComputedStyle(n, '::before').maskImage })),
        faces: [...document.querySelectorAll('.pin-owner-face')].map(n => parseFloat(getComputedStyle(n).width)),
        kannon: !!document.querySelector('[data-test="pin-kannon"] .pin-symbol svg path'),
        preserved: P.before === JSON.stringify(P.core.state) && P.saveBefore === localStorage.getItem(P.core.SAVE_KEY),
      }));
      assert(info.signs.length === 7 && info.signs.every(s => s.width === 100 && s.color === 'rgb(255, 250, 240)' && s.image === 'none' && s.mask === 'none'));
      assert(info.faces.length > 0 && info.faces.every(w => w === 32));
      assert(info.kannon && info.preserved);
      assert.deepEqual(errors, []); assert.deepEqual(resources, []);
      await page.screenshot({ path: `${out}/${device}-${time}.png` });
      results.push({ device, time, status: 'passed', ...info });
    }
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ ref: process.env.TEST_REF || null, results }, null, 2) + '\n');
}
