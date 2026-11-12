// New default input: exercise real mouse and touch events, not injected game outcomes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { suite, baseURL, storageSnapshot } from './support.mjs';
import { flick, flickFromHandle, flickFromBoard } from './axe_flick_input.mjs';
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
// 2026-11-12: 投げ方は「的に触れた所が狙い → そのまま上へ弾く」（右の取っ手からも弾ける）。強さは弾く速さ。
async function throwAxe(page, { touch = false, power = .62, from = 'board', lean = 0 } = {}) {
  if (from === 'board') await flickFromBoard(page, { touch, power, lean });
  else { await aim(page, touch); await flickFromHandle(page, { touch, power, lean }); }
  await phase(page, 'result');
}
// 着地点（刃先の印）と、触れて決めた狙い（金の輪）の横の差（的の絵の座標。半径164）
const driftX = page => page.evaluate(() => { const x = s => Number(/translate\(([-\d.]+)/.exec(document.querySelector(s).getAttribute('transform'))?.[1]); return x('.axe-impact-mark') - x('.axe-fixed-aim'); });
await suite('axe-tap-pull', async check => {
  for (const [label, context, touch] of [
    ['pc', { viewport: { width: 1280, height: 720 } }, false],
    ['touch-landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ['touch-wide', { viewport: { width: 932, height: 430 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-three-throws-and-storage`, async page => {
    const before = await start(page, touch);
    await capture(page, `${label}-aim`);
    for (let i = 0; i < 3; i++) {
      // 1・3投目は的に触れてそのまま弾く、2投目はタップで狙ってから右の取っ手で弾く
      await throwAxe(page, { touch, from: i === 1 ? 'handle' : 'board' });
      const power = Number(await root(page).getAttribute('data-power'));
      assert(Number.isFinite(power) && Math.abs(power - .62) < .06, `visible flick power ${power}`);
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

  await check('flick-speed-lean-and-tap-only', async page => {
    await start(page);
    // 触れて離すだけ（弾かない）なら、狙いを決めるだけで投げない
    await aim(page);
    await page.waitForTimeout(300);
    assert.equal(await root(page).getAttribute('data-phase'), 'power', 'a tap only sets the aim');
    assert.equal(await root(page).getAttribute('data-player-throws'), '0');
    // 遅い弾きは柄から当たって落ちる、速すぎる弾きは回りすぎて落ちる
    for (const [power, reason] of [[.3, '柄から当たって落下'], [.95, '回りすぎて落下']]) {
      await flickFromHandle(page, { power }); await phase(page, 'result');
      const actual = Number(await root(page).getAttribute('data-power'));
      assert(Math.abs(actual - power) < .06, `flick speed sets the power: ${actual} / ${power}`);
      assert.match(await page.locator('.axe-note').innerText(), new RegExp(reason));
      await ready(page).click(); await phase(page, 'choice'); await aim(page);
    }
    // 斜めに弾くと横へ流れる（右へ傾けた弾きは、まっすぐより右に刺さる）
    await flickFromHandle(page, { power: .62, lean: .6 }); await phase(page, 'result');
    const drift = await driftX(page);
    assert(drift > 10, `a flick leaning right lands right of the aim: ${drift}`);
  });

  await check('cancel-and-resize-never-spend-throw', async page => {
    const before = await start(page);
    for (const operation of ['return', 'sideways', 'escape', 'pointercancel', 'resize']) {
      await aim(page);
      const grip = await handle(page).boundingBox(), stage = await root(page).boundingBox();
      const x = grip.x + grip.width / 2, y = grip.y + grip.height / 2, rise = stage.height * .2;
      if (operation === 'sideways') await flick(page, { x, y, height: stage.height, rise: rise * .5, lean: 3 });
      else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x, y - rise, { steps: 4 });
        if (operation === 'return') await page.mouse.move(x, y, { steps: 4 });
        if (operation === 'escape') await page.keyboard.press('Escape');
        if (operation === 'pointercancel') await handle(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true });
        if (operation === 'resize') await page.setViewportSize({ width: 1200, height: 700 });
        await page.mouse.up();
      }
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
      const grip = await handle(page).boundingBox(), stage = await root(page).boundingBox(), cdp = await page.context().newCDPSession(page);
      const p = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, endY = p.y - stage.height * .2;
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: endY, id: 1 }] });
        if (operation === 'second-finger') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: endY, id: 1 }, { x: p.x - 70, y: p.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      } finally { await cdp.detach(); }
      await page.waitForTimeout(1000);
      const current = await root(page).getAttribute('data-phase');
      assert(['choice', 'power'].includes(current), `${operation} must cancel, not throw: ${current}`);
    }
    await throwAxe(page, { touch: true });
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
}, { entry: new URL('axe-throw.html', baseURL).href, readySelector: '[data-test="axe-start"]', freshBrowserPerCase: true });
