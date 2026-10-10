// 実際のタイマー操作で天候・予測を読み、全工程の温度計の位置と停止中の描画を確かめる。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium SHOTS=<任意> node remake/test/steam_forecast.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const errors = [], shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const open = async (viewport, mobile, insight = 10) => {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async insight => {
    const core = await import('./js/core/state.js'); core.newGame(); core.state.stamina = 80;
    core.state.stats.insight = insight;
    const session = await import('./js/craft/session.js'), steps = await import('./js/craft/steps.js');
    const steam = await import('./js/craft/steam.js'), pull = await import('./js/craft/pull.js');
    window.T = { core, session, steps, steam, pull };
    window.cs = session.newSession('drill');
    cs.environment = { rainy: true, ambientC: 23, humidityPercent: 80 };
    cs.heat = { heatPower: 70 }; cs.holes = { total: 24, minimumComplete: true };
    const bench = session.openBench(cs);
    while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
  }, insight);
  return page;
};
const ready = async page => {
  await page.waitForFunction(() => [...document.querySelectorAll('.bench img')].every(i => i.complete && i.naturalWidth));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.scene-curtain'));
};
const geometry = page => page.locator('.thermo').evaluate(n => {
  const r = n.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100);
});
const screenshot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 720 }, false],
    ['mobile', { width: 844, height: 390 }, true],
  ]) {
    let position;
    for (const mode of ['pull', 'care']) {
      const page = await open(viewport, mobile);
      await page.evaluate(mode => {
        cs.steam = { temp: .31, score: 100, seconds: 360 };
        cs.pull = { temp: .31, score: 100, pulls: 2 };
        window.run = mode === 'pull' ? T.pull.runPull(cs) : T.pull.runCare(cs);
      }, mode);
      await page.waitForSelector('.thermo'); await ready(page);
      const current = await geometry(page);
      if (position) assert.deepEqual(current, position, `${name}: care and inhalation positions differ`);
      position = current;
      await screenshot(page, `${mode}-${name}`);
      await page.close();
    }
    const page = await open(viewport, mobile);
    await page.evaluate(() => { window.timerRun = T.steps.stepSteamTime(cs); });
    await page.waitForSelector('[data-test="kitchen-timer"]'); await ready(page);
    assert.deepEqual(await geometry(page), position, `${name}: thermometer was moved during timer setup`);
    assert(await page.locator('.thermo').isVisible());
    assert(await page.locator('[data-test="steam-forecast-range"]').isHidden());
    assert.match(await page.locator('[data-test="steam-weather"]').textContent(), /雨.*23℃.*80%/);
    assert.match(await page.locator('.worker-actor').getAttribute('src'), /hajime_steam_wait/);
    assert(!/呼吸|パッド|ボタン|キー/.test(await page.locator('[data-test="craft-feedback"]').textContent()));
    const selectSix = async () => { for (let i = 0; i < 6; i++) await page.locator('[data-test="timer-minute-up"]').click(); };
    const forecast = () => page.locator('[data-test="steam-forecast"]').evaluate(n => ({ low: n.dataset.low, high: n.dataset.high }));
    await selectSix();
    const first = await forecast();
    assert(Number(first.low) < Number(first.high) && Number(first.high) < .49);
    assert(await page.locator('[data-test="steam-forecast-range"]').isVisible());
    await page.locator('[data-test="timer-reset"]').click();
    assert(await page.locator('[data-test="steam-forecast-range"]').isHidden());
    assert.deepEqual(await forecast(), { low: undefined, high: undefined });
    await selectSix(); assert.deepEqual(await forecast(), first, 'Timer adjustments rerolled the estimate');
    await screenshot(page, `timer-rain-${name}`);
    const spacing = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const left = r('.bench-left'), right = r('.bench-right'), bench = r('.bench');
      const scale = bench.width / 1280;
      return { gap: (right.left - left.right) / scale, bottom: (bench.bottom - right.bottom) / scale };
    });
    assert(spacing.gap > 0 && spacing.gap <= 8, `Window gap too wide: ${JSON.stringify(spacing)}`);
    assert(spacing.bottom <= 14, `Bottom margin too large: ${JSON.stringify(spacing)}`);
    await page.locator('[data-test="timer-start"]').click(); await page.evaluate(() => window.timerRun);
    await page.evaluate(() => { window.steamRun = T.steam.runSteamDodge(cs); });
    await page.waitForSelector('.dodge'); await ready(page);
    assert.deepEqual(await geometry(page), position, `${name}: thermometer was moved during bullet hell`);
    assert(await page.locator('[data-test="steam-forecast-range"]').isHidden(), 'Forecast leaked into bullet hell');
    assert(await page.locator('.bench-guide').isHidden());
    assert(await page.locator('.bench-worker-name').isHidden());
    assert.equal(await page.locator('.bench-title').textContent(), '蒸らし');
    assert.equal(await page.locator('.dodge-controls').textContent(), 'リフレッシュ');
    await page.locator('[data-test="steam-world-art"]').evaluate(async n => {
      const url = getComputedStyle(n).backgroundImage.match(/url\(["']?([^"')]+)/)?.[1];
      if (!url?.includes('steam_mind_world')) throw new Error('Cosmic artwork is not connected');
      const art = new Image(); art.src = url; await art.decode();
      if (!art.naturalWidth) throw new Error('Cosmic artwork did not load');
    });
    const buttonLook = await page.locator('.dodge-refresh').evaluate(n => ({ background: getComputedStyle(n).backgroundImage, direction: getComputedStyle(n).flexDirection }));
    assert(!buttonLook.background.includes('url('), 'Old ornate button art overrode the simple refresh');
    assert.equal(buttonLook.direction, 'row');
    const traceY = await page.locator('.dodge-beat-line').evaluate(n => Number(n.getAttribute('d').match(/M0,([\d.]+)/)[1]));
    assert(Math.abs(traceY - 163) < 2, 'Heartbeat was not centered');
    await page.waitForFunction(() => !document.querySelector('[data-test="timer-stop"]').disabled);
    await page.waitForSelector('.dodge-object');
    await page.waitForTimeout(1200);
    await screenshot(page, `steam-live-${name}`);
    await page.locator('[data-test="dodge-refresh"]').click();
    await page.waitForTimeout(120);
    assert(!/呼吸|息を整|パッド|ボタン|キー/.test(await page.locator('[data-test="craft-feedback"]').textContent()));
    await screenshot(page, `refresh-${name}`);
    await page.locator('[data-test="timer-stop"]').click();
    const snapshot = () => page.evaluate(() => ({
      frame: document.querySelector('[data-test="steam-world"]').dataset.frame,
      stock: document.querySelector('.dodge-refresh').dataset.remaining,
      effect: document.querySelector('.dodge-refresh-fx')?.outerHTML,
      mist: getComputedStyle(document.querySelector('.dodge-mist')).animationPlayState,
      worker: getComputedStyle(document.querySelector('.worker-actor')).animationPlayState,
    }));
    const paused = await snapshot();
    assert.equal(paused.mist, 'paused'); assert.equal(paused.worker, 'paused');
    await page.waitForTimeout(300); assert.deepEqual(await snapshot(), paused, 'Pause advanced the world or refresh effect');
    await page.locator('[data-test="timer-stop"]').click();
    await page.waitForFunction(() => !document.querySelector('.dodge-thought-echo, .dodge-refresh-fx'));
    await page.close();
    if (name === 'desktop') {
      const skilled = await open(viewport, mobile, 81);
      await skilled.evaluate(() => { window.timerRun = T.steps.stepSteamTime(cs); });
      await skilled.waitForSelector('[data-test="kitchen-timer"]'); await ready(skilled);
      for (let i = 0; i < 6; i++) await skilled.locator('[data-test="timer-minute-up"]').click();
      const precise = await skilled.locator('[data-test="steam-forecast"]').evaluate(n => ({ low: Number(n.dataset.low), high: Number(n.dataset.high) }));
      assert(precise.high - precise.low < Number(first.high) - Number(first.low), 'Actual insight growth did not narrow the forecast');
      assert.equal(await skilled.evaluate(() => cs.steamPrediction.precision), 1);
      await screenshot(skilled, 'timer-insight-five'); await skilled.close();
    }
    console.log(`[steam forecast] PASS: ${name} real timer/reset, repeatable rainy estimate, Hajime waiting, same thermometer in four stages, tight window spacing and paused visuals`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
