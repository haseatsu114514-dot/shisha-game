// 実際のタイマー操作で天候・予測を読み、全工程の温度計位置と弾幕背後の時計を確かめる。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium SHOTS=<任意> node remake/test/steam_forecast.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const errors = [], shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const open = async (viewport, mobile, insight = 10) => {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  await installLoadingComicReader(page);
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
  await page.waitForFunction(() => [...document.querySelectorAll('.bench img[src]')].filter(i => i.getClientRects().length).every(i => i.complete && i.naturalWidth));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.scene-curtain'));
};
const geometry = page => page.locator('.thermo').evaluate(n => {
  const r = n.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100);
});
const screenshot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
// 通常／精密／通常を、実際のスティックのドラッグで比べる。スマホはタッチ入力。
const stickSpeed = async (page, mobile) => {
  const r = await page.locator('[data-test="dodge-pad"]').boundingBox();
  const start = { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 1 };
  const end = { ...start, x: r.x + r.width * .93 };
  const touch = mobile ? await page.context().newCDPSession(page) : null;
  // 操作の速度は弾幕と同じゲーム時刻で比べる。画像デコード中のRAF待ちを
  // 「精密を解除しても遅い」と誤判定しない（ゲーム側も長いフレームを制限する）。
  const sample = () => page.locator('.dodge-heart').evaluate(n => ({
    x: new DOMMatrix(n.style.transform).e,
    at: Number(document.querySelector('[data-test="steam-world"]').dataset.frame),
  }));
  try {
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    } else {
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(end.x, end.y);
    }
    const before = await sample();
    await page.waitForTimeout(260);
    const after = await sample();
    assert(after.at > before.at, 'Game clock stopped while steering');
    return (after.x - before.x) / (after.at - before.at);
  } finally {
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
    } else await page.mouse.up();
  }
};
// 一方の指をスティックに残したまま、もう一方で実際にボタンを押す。
const pressWhileSteering = async (page, selector) => {
  const pad = await page.locator('[data-test="dodge-pad"]').boundingBox();
  const button = await page.locator(selector).boundingBox();
  const stick = { x: pad.x + pad.width * .15, y: pad.y + pad.height / 2, id: 1 };
  const tap = { x: button.x + button.width / 2, y: button.y + button.height / 3, id: 2 };
  const touch = await page.context().newCDPSession(page);
  const heartX = () => page.locator('.dodge-heart').evaluate(n => new DOMMatrix(n.style.transform).e);
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
    const before = await heartX();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick, tap] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [tap] });
    assert.equal(await page.locator('.dodge-pad.held').count(), 1, 'Second finger interrupted the stick');
    await page.waitForTimeout(180);
    assert(await heartX() < before - 5, 'Movement stopped while pressing a button');
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
};
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
    const guide = page.locator('.bench-guide');
    assert(await guide.isVisible(), 'Optional help button should be available');
    assert.equal(await guide.getAttribute('open'), null, 'Help must not cover the playfield by default');
    const helpOutsideField = await guide.locator('summary').evaluate(n => {
      const help = n.getBoundingClientRect(), field = document.querySelector('.dodge').getBoundingClientRect();
      return help.right <= field.left || help.left >= field.right || help.bottom <= field.top || help.top >= field.bottom;
    });
    assert(helpOutsideField, 'Help must not intercept taps inside the playfield');
    await guide.locator('summary').click();
    assert(await guide.locator('.bench-guide-tip').isVisible());
    assert.match(await guide.locator('.bench-guide-tip').textContent(), /アタック/);
    await guide.locator('summary').click();
    assert.equal(await guide.getAttribute('open'), null);
    assert(await page.locator('.bench-worker-name').isHidden());
    assert.equal(await page.locator('.bench-title').textContent(), '蒸らし');
    assert(await page.locator('.bench-title').isHidden());
    assert.equal(await page.locator('.bench-phase[aria-current="step"]').textContent(), '03蒸らし');
    assert.equal(await page.locator('.bench-phase[aria-current="step"]').evaluate(n => n.offsetHeight), 49);
    assert.deepEqual(await page.locator('.dodge-controls .refresh-copy').allTextContents(), ['リフレッシュ', 'アタック', '精密']);
    assert.equal(await page.locator('.dodge-world-title').count(), 0);
    const controls = await page.locator('.dodge-controls').evaluate(n => {
      const r = e => e.getBoundingClientRect(), root = r(n), [refresh, slash, precision, pad] = [...n.children].map(r);
      const scale = root.width / n.offsetWidth;
      return { gap: (slash.left - refresh.right) / scale, secondGap: (precision.left - slash.right) / scale, thirdGap: (pad.left - precision.right) / scale,
        padSize: pad.width / scale, buttonHeight: refresh.height / scale,
        inRow: pad.right <= root.right + 1 && slash.left >= root.left - 1 && Math.abs(refresh.top - precision.top) < 1 && Math.abs(slash.top - refresh.top) < 1,
        clear: pad.top > r(document.querySelector('.dodge')).bottom && pad.bottom < r(document.querySelector('.bench')).bottom - 2 };
    });
    assert(Math.abs(controls.gap - 12) < 1 && Math.abs(controls.secondGap - 12) < 1 && Math.abs(controls.thirdGap - 12) < 1, JSON.stringify(controls));
    assert(controls.padSize >= 170 && controls.buttonHeight >= 175 && controls.inRow && controls.clear, JSON.stringify(controls));
    await page.locator('[data-test="steam-world-art"]').evaluate(async n => {
      const url = getComputedStyle(n).backgroundImage.match(/url\(["']?([^"')]+)/)?.[1];
      if (!url?.includes('steam_mind_world')) throw new Error('Cosmic artwork is not connected');
      const art = new Image(); art.src = url; await art.decode();
      if (!art.naturalWidth) throw new Error('Cosmic artwork did not load');
    });
    const buttonLook = await page.locator('.dodge-refresh').evaluate(n => ({ background: getComputedStyle(n).backgroundImage, direction: getComputedStyle(n).flexDirection }));
    assert(!buttonLook.background.includes('url('), 'Old ornate button art overrode the simple refresh');
    assert.equal(buttonLook.direction, 'column');
    assert.match(await page.locator('.dodge-refresh img').getAttribute('src'), /steam_refresh_simple/);
    const traceY = await page.locator('.dodge-beat-line').evaluate(n => Number(n.getAttribute('d').match(/M0,([\d.]+)/)[1]));
    const fieldHeight = await page.locator('.dodge').evaluate(n => n.offsetHeight);
    assert(Math.abs(traceY - fieldHeight / 2) < 2, 'Heartbeat was not centered');
    assert.equal(await page.locator('.dodge-hud, .dodge-hits, [data-test="timer-stop"]').count(), 0);
    assert.equal(await page.locator('[data-test="steam-clock"]').count(), 1, 'Remaining time was duplicated');
    const clockLook = await page.locator('[data-test="steam-clock"]').evaluate(n => {
      const r = n.getBoundingClientRect(), field = n.closest('.dodge')?.getBoundingClientRect(), css = getComputedStyle(n);
      return { inField: !!field, centered: field && Math.abs(r.x + r.width / 2 - field.x - field.width / 2) < 1 && Math.abs(r.y + r.height / 2 - field.y - field.height / 2) < 1,
        contained: field && r.left > field.left && r.right < field.right && r.top > field.top && r.bottom < field.bottom,
        wide: field && r.width > field.width / 2, opacity: Number(css.opacity), pointer: css.pointerEvents,
        behind: Number(css.zIndex) < Number(getComputedStyle(document.querySelector('.dodge-heart')).zIndex) };
    });
    assert(clockLook.inField && clockLook.centered && clockLook.contained && clockLook.wide && clockLook.behind, JSON.stringify(clockLook));
    assert(clockLook.opacity > 0 && clockLook.opacity <= .2, 'Background timer is too prominent');
    assert.equal(clockLook.pointer, 'none', 'Background timer blocked movement');
    await page.waitForFunction(() => !document.querySelector('[data-test="dodge-refresh"]').disabled);
    const remaining = await page.locator('[data-test="steam-clock"] .clock-value').textContent();
    const precision = page.locator('[data-test="dodge-precision"]');
    assert.equal(await precision.getAttribute('aria-pressed'), 'false');
    assert.equal(await precision.locator('.precision-state').textContent(), 'オフ');
    const toggle = () => mobile ? precision.tap() : precision.click();
    const normalSpeed = await stickSpeed(page, mobile);
    assert(normalSpeed > 100, 'Normal stick did not move');
    await toggle(); assert.equal(await precision.getAttribute('aria-pressed'), 'true');
    assert.equal(await precision.locator('.precision-state').textContent(), 'オン');
    const slowSpeed = await stickSpeed(page, mobile);
    assert(slowSpeed > normalSpeed * .2 && slowSpeed < normalSpeed * .65, `${name}: precision did not slow the stick (${normalSpeed} -> ${slowSpeed})`);
    await screenshot(page, `steam-precision-${name}`);
    await toggle(); assert.equal(await precision.getAttribute('aria-pressed'), 'false');
    const restoredSpeed = await stickSpeed(page, mobile);
    assert(Math.abs(restoredSpeed - normalSpeed) < normalSpeed * .3 && restoredSpeed > slowSpeed * 1.5, `${name}: second press did not restore normal movement`);
    await precision.focus(); await page.keyboard.press('Enter');
    assert.equal(await precision.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Enter');
    assert.equal(await precision.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('.dodge-refresh').getAttribute('data-remaining'), '1', 'Precision toggle spent the refresh');
    assert.equal(await page.locator('.dodge-pad.held').count(), 0, 'Released stick stayed held');
    console.log(`[precision] PASS: ${name} real ${mobile ? 'touch' : 'mouse'} stick ${normalSpeed.toFixed(0)} -> ${slowSpeed.toFixed(0)} -> ${restoredSpeed.toFixed(0)} px/s; Enter toggles independently of refresh`);
    await page.waitForSelector('.dodge-object');
    await page.waitForTimeout(1200);
    assert.notEqual(await page.locator('[data-test="steam-clock"] .clock-value').textContent(), remaining, 'Background clock stopped counting down');
    await screenshot(page, `steam-live-${name}`);
    if (mobile) {
      await pressWhileSteering(page, '[data-test="dodge-precision"]');
      assert.equal(await precision.getAttribute('aria-pressed'), 'true');
      await pressWhileSteering(page, '[data-test="dodge-refresh"]');
      assert.equal(await page.locator('[data-test="dodge-refresh"]').getAttribute('data-remaining'), '0');
      console.log('[controls] PASS: two real simultaneous touches maintain stick movement while toggling precision and refreshing');
    } else await page.locator('[data-test="dodge-refresh"]').click();
    await page.waitForTimeout(120);
    assert(!/呼吸|息を整|パッド|ボタン|キー/.test(await page.locator('[data-test="craft-feedback"]').textContent()));
    await screenshot(page, `refresh-${name}`);
    const frame = Number(await page.locator('[data-test="steam-world"]').getAttribute('data-frame'));
    await page.waitForFunction(() => !document.querySelector('.dodge-thought-echo, .dodge-refresh-fx'));
    assert(Number(await page.locator('[data-test="steam-world"]').getAttribute('data-frame')) > frame, 'World stopped after refreshing');
    assert.equal(await page.locator('.dodge-refresh').getAttribute('data-remaining'), '0');
    assert(await page.locator('.dodge-refresh').isDisabled());
    await page.close();
    if (name === 'desktop') {
      const skilled = await open(viewport, mobile, 91); // 洞察の最上段（10段は91以上。旧★5の81は10段では9段）
      await skilled.evaluate(() => { window.timerRun = T.steps.stepSteamTime(cs); });
      await skilled.waitForSelector('[data-test="kitchen-timer"]'); await ready(skilled);
      for (let i = 0; i < 6; i++) await skilled.locator('[data-test="timer-minute-up"]').click();
      const precise = await skilled.locator('[data-test="steam-forecast"]').evaluate(n => ({ low: Number(n.dataset.low), high: Number(n.dataset.high) }));
      assert(precise.high - precise.low < Number(first.high) - Number(first.low), 'Actual insight growth did not narrow the forecast');
      assert.equal(await skilled.evaluate(() => cs.steamPrediction.precision), 1);
      await screenshot(skilled, 'timer-insight-five'); await skilled.close();
    }
    console.log(`[steam forecast] PASS: ${name} timer/reset, rainy estimate, Hajime waiting, same thermometer in four stages, centered faint background clock, four controls and refresh recharge start`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
