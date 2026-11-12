// New default input: exercise real mouse and touch events, not injected game outcomes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { suite, baseURL, storageSnapshot } from './support.mjs';
const root = page => page.locator('[data-test="axe-game"]');
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
const handle = page => page.locator('[data-test="axe-pull-handle"]');
const ready = page => page.locator('[data-test="axe-action"]:not([disabled])');
const shotsPath = process.env.COMPARISON_DIR;
if (shotsPath) await fs.mkdir(shotsPath, { recursive: true });
async function capture(page, label) { if (shotsPath) await page.screenshot({ path: `${shotsPath}/${label}.png` }); }
async function start(page, touch = false) {
  await page.goto(new URL('axe-throw.html', baseURL).href);
  await page.locator('[data-test="axe-start"]').waitFor();
  await page.evaluate(() => { localStorage.setItem('axe-pull-keep', 'unchanged'); sessionStorage.setItem('axe-pull-keep', 'unchanged'); });
  const before = await storageSnapshot(page);
  if (touch) await page.locator('[data-test="axe-start"]').tap(); else await page.locator('[data-test="axe-start"]').click();
  await phase(page, 'choice');
  await page.locator('.axe-cutin').waitFor({ state: 'detached' });
  return before;
}
async function aim(page, touch = false) {
  const p = await page.locator('.axe-target').evaluate(node => {
    const point = new DOMPoint(330, 245).matrixTransform(node.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await phase(page, 'power');
}
async function pullPoints(page, power = .62) {
  const grip = await handle(page).boundingBox(), bounds = await root(page).boundingBox();
  assert(grip && bounds, 'pull handle and stage must be visible');
  const x = grip.x + grip.width / 2, y = grip.y + grip.height / 2;
  return { x, y, endY: y + Math.max(80, Math.min(180, bounds.height * .26)) * power };
}
async function throwAxe(page, { touch = false, power = .62 } = {}) {
  await aim(page, touch);
  const p = await pullPoints(page, power);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (p.endY - p.y) * i / 8, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x, p.endY, { steps: 8 }); await page.mouse.up();
  }
  await phase(page, 'result');
}
await suite('axe-tap-pull', async check => {
  for (const [label, context, touch] of [
    ['pc', { viewport: { width: 1280, height: 720 } }, false],
    ['touch-landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ['touch-wide', { viewport: { width: 932, height: 430 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-three-throws-and-storage`, async page => {
    const before = await start(page, touch);
    await capture(page, `${label}-aim`);
    for (let i = 0; i < 3; i++) {
      await throwAxe(page, { touch });
      const power = Number(await root(page).getAttribute('data-power'));
      assert(Number.isFinite(power) && Math.abs(power - .62) < .06, `visible pull power ${power}`);
      if (i === 0) await capture(page, `${label}-result`);
      if (touch) await ready(page).tap(); else await ready(page).click();
      await phase(page, i === 2 ? 'summary' : 'choice');
    }
    await capture(page, `${label}-summary`);
    const stage = await root(page).boundingBox(), summary = await page.locator('.axe-panel').boundingBox();
    assert(stage && summary);
    assert(summary.x >= stage.x - 1 && summary.y >= stage.y - 1
      && summary.x + summary.width <= stage.x + stage.width + 1
      && summary.y + summary.height <= stage.y + stage.height + 1, 'summary stays inside the first-person stage');
    if (touch) await ready(page).tap(); else await ready(page).click();
    await page.locator('[data-test="axe-start"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), before, 'standalone input must not alter save data');
  }, context);

  await check('cancel-and-resize-never-spend-throw', async page => {
    const before = await start(page);
    for (const operation of ['return', 'escape', 'pointercancel', 'resize']) {
      await aim(page);
      const p = await pullPoints(page);
      await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.mouse.move(p.x, p.endY, { steps: 4 });
      if (operation === 'return') await page.mouse.move(p.x, p.y, { steps: 4 });
      if (operation === 'escape') await page.keyboard.press('Escape');
      if (operation === 'pointercancel') await handle(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true });
      if (operation === 'resize') await page.setViewportSize({ width: 1200, height: 700 });
      await page.mouse.up();
      await page.waitForTimeout(1000);
      const current = await root(page).getAttribute('data-phase');
      assert(['choice', 'power'].includes(current), `${operation} must not launch a throw: ${current}`);
    }
    assert.deepEqual(await storageSnapshot(page), before);
    await throwAxe(page); await ready(page).click(); await phase(page, 'choice');
  });

  await check('keyboard-repeat-focus-and-next-throw', async page => {
    const before = await start(page);
    await aim(page);
    await page.locator('[data-test="axe-reaim"]:not([disabled])').click();
    await phase(page, 'choice');
    assert.equal(await root(page).evaluate(node => node === document.activeElement), true, 'reaim restores keyboard focus');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight'); await phase(page, 'power');
      await page.keyboard.down('Space'); await page.waitForTimeout(744); await page.keyboard.up('Space');
      await phase(page, 'result');
      assert.equal(await root(page).getAttribute('data-player-throws'), String(i + 1));
      await ready(page).click(); await phase(page, i === 2 ? 'summary' : 'choice');
    }
    await page.locator('[data-test="axe-retry"]:not([disabled])').click();
    await phase(page, 'choice');
    assert.equal(await root(page).evaluate(node => node === document.activeElement), true, 'retry restores keyboard focus');
    await page.keyboard.press('ArrowRight'); await phase(page, 'power');
    await page.keyboard.down('Space'); await page.waitForTimeout(744); await page.keyboard.up('Space');
    await phase(page, 'result');
    assert.equal(await root(page).getAttribute('data-player-throws'), '1', 'retry starts a fresh game');
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check('touch-cancel-and-second-finger', async page => {
    await start(page, true);
    for (const operation of ['cancel', 'second-finger']) {
      await aim(page, true);
      const p = await pullPoints(page), cdp = await page.context().newCDPSession(page);
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.endY, id: 1 }] });
        if (operation === 'second-finger') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.endY, id: 1 }, { x: p.x - 70, y: p.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      } finally { await cdp.detach(); }
      await page.waitForTimeout(1000);
      const current = await root(page).getAttribute('data-phase');
      assert(['choice', 'power'].includes(current), `${operation} must cancel, not throw: ${current}`);
    }
    await throwAxe(page, { touch: true });
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
}, { entry: new URL('axe-throw.html', baseURL).href, readySelector: '[data-test="axe-start"]', freshBrowserPerCase: true });
