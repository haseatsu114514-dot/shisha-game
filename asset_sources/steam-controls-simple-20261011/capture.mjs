// サーバー8123で実装画面を保存する。ゲームの時計・弾・被弾を偽造しない。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const output = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const report = { date: '2026-10-11', screens: [], pageErrors: [] };
const shoot = async (page, name) => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: `${output}${name}.png` });
};
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 720 }, false],
    ['mobile', { width: 844, height: 390 }, true],
    ['portrait', { width: 390, height: 844 }, true],
  ]) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'), session = await import('./js/craft/session.js'), steam = await import('./js/craft/steam.js');
      core.newGame(); core.state.stamina = 80;
      __remake.craftTest.auto = null;
      window.cs = session.newSession('drill'); cs.steamSeconds = 480;
      cs.environment = { rainy: true, ambientC: 23, humidityPercent: 80 };
      cs.heat = { heatPower: 70 }; cs.holes = { total: 24, minimumComplete: true };
      const bench = session.openBench(cs);
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      window.running = steam.runSteamDodge(cs);
    });
    await page.waitForFunction(() => document.querySelector('[data-test="dodge-precision"]')?.disabled === false);
    await page.waitForFunction(() => [...document.querySelectorAll('.bench img')].every(n => n.complete && n.naturalWidth));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('.scene-curtain'));
    const geometry = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const field = r('.dodge'), panel = r('.bench-right'), refresh = r('.dodge-refresh'), precision = r('.dodge-precision'), pad = r('.dodge-pad');
      const scale = field.width / document.querySelector('.dodge').offsetWidth;
      const heart = document.querySelector('.dodge-heart'), ring = getComputedStyle(document.querySelector('.dodge-core'), '::after');
      return {
        field: [document.querySelector('.dodge').offsetWidth, document.querySelector('.dodge').offsetHeight],
        upperMargin: (field.top - panel.top) / scale,
        buttonsClear: refresh.top > field.bottom && precision.top > field.bottom && pad.top > field.bottom,
        controlsContained: refresh.left >= field.left && pad.right <= field.right && Math.max(refresh.bottom, precision.bottom, pad.bottom) < panel.bottom,
        buttonSize: [refresh.width / scale, refresh.height / scale],
        gaps: [(precision.left - refresh.right) / scale, (pad.left - precision.right) / scale],
        heartSize: getComputedStyle(heart.querySelector('svg')).width,
        hitRing: { declared: parseFloat(heart.style.getPropertyValue('--hit-diameter')), width: parseFloat(ring.width), boxSizing: ring.boxSizing },
      };
    });
    assert(geometry.buttonsClear && geometry.controlsContained, JSON.stringify(geometry));
    assert(geometry.upperMargin >= 12 && geometry.upperMargin <= 30, JSON.stringify(geometry));
    assert.equal(geometry.hitRing.boxSizing, 'border-box');
    assert(Math.abs(geometry.hitRing.declared - geometry.hitRing.width) < .08);
    if (name === 'portrait') {
      assert(await page.locator('#rotate-hint').isVisible());
      await shoot(page, 'portrait-rotation-hint');
      report.screens.push({ name, viewport, geometry, states: [], portraitRotationHint: true });
      await page.close();
      continue;
    }
    await shoot(page, `controls-${name}-off`);
    const precision = page.locator('[data-test="dodge-precision"]');
    mobile ? await precision.tap() : await precision.click();
    await page.waitForTimeout(280);
    assert.equal(await precision.getAttribute('aria-pressed'), 'true');
    assert.equal(await precision.locator('.precision-state').textContent(), 'オン');
    await shoot(page, `controls-${name}-on`);
    const screen = { name, viewport, geometry, states: ['オフ', 'オン'] };
    if (name === 'desktop') {
      for (let tries = 0; tries < 18; tries++) {
        if (await page.locator('[data-test="mental-trace"]').evaluate(n => Number(n.dataset.hits) >= 2)) break;
        const target = await page.evaluate(() => {
          const field = document.querySelector('.dodge').getBoundingClientRect();
          for (const node of document.querySelectorAll('.dodge-word, .dodge-object')) {
            const b = node.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
            if (x > field.left + 20 && x < field.right - 20 && y > field.top + 20 && y < field.bottom - 20) return { x, y };
          }
          return null;
        });
        if (target) await page.mouse.move(target.x, target.y);
        await page.waitForTimeout(220);
      }
      await page.waitForFunction(() => Number(document.querySelector('[data-test="mental-trace"]').dataset.hits) >= 2);
      const field = await page.locator('.dodge').boundingBox();
      await page.mouse.move(field.x + field.width * .62, field.y + field.height * .3);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test="steam-clock"]')).color === getComputedStyle(document.querySelector('.dodge-beat-line')).stroke && Number(getComputedStyle(document.querySelector('.dodge-heart')).opacity) > .85);
      screen.hitColors = await page.evaluate(() => ({
        hits: Number(document.querySelector('[data-test="mental-trace"]').dataset.hits),
        level: document.querySelector('[data-test="mental-trace"]').dataset.level,
        clock: getComputedStyle(document.querySelector('[data-test="steam-clock"]')).color,
        heartbeat: getComputedStyle(document.querySelector('.dodge-beat-line')).stroke,
      }));
      await shoot(page, 'live-desktop');
    }
    report.screens.push(screen);
    await page.close();
  }
  assert.deepEqual(report.pageErrors, []);
  fs.writeFileSync(`${output}verification.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log('PASS: desktop/mobile controls separated and contained; portrait retains existing rotation hint; ring diameter accurate; real repeated hits link clock and heartbeat colors; page errors 0');
} finally { await browser.close(); }
