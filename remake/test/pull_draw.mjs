// 一口の間を実際の操作で確認する。連打・提供・温度・水泡・音・画面離脱をまとめて検証。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const errors = [], shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await installLoadingComicReader(page);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.bubbleSounds = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const create = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function (...args) {
      const node = create.apply(this, args), start = node.start;
      node.start = function (...a) {
        if (node.type === 'sine') window.bubbleSounds++;
        return start.apply(this, a);
      };
      return node;
    };
    const bufferSource = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function (...args) {
      const node = bufferSource.apply(this, args), start = node.start;
      node.start = function (...a) {
        if (node.loop || (node.buffer?.duration > .35 && node.buffer?.duration < .4)) window.bubbleSounds++;
        return start.apply(this, a);
      };
      return node;
    };
  });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame();
    const session = await import('./js/craft/session.js'), pull = await import('./js/craft/pull.js'), audio = await import('./js/core/audio.js');
    audio.stopBgm(0);
    window.T = { core, session, pull, audio };
  });
  const open = async (mode = 'pull', temp = .45) => {
    await page.evaluate(async ({ mode, temp }) => {
      T.session.craftTest.auto = null; T.core.state.stamina = 80;
      window.cs = T.session.newSession('drill'); cs.environment.rainy = false;
      cs.holes = { total: 24, minimumComplete: true }; cs.pack = 'normal';
      cs.steam = { temp, score: 100, hits: 0, concentration: 1 };
      if (mode === 'care') cs.pull = { temp, pulls: 2, score: 100 };
      const b = T.session.openBench(cs);
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      window.run = mode === 'care' ? T.pull.runCare(cs) : T.pull.runPull(cs);
    }, { mode, temp });
    if (mode === 'care') await page.locator('[data-test="care-coal-0"]').click();
    await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.bench img[src]')].filter(i => i.getClientRects().length).every(i => i.complete && i.naturalWidth));
    await page.evaluate(() => document.fonts.ready);
  };
  const at = async (lo, hi) => page.evaluate(async ({ lo, hi }) => {
    const button = document.querySelector('[data-test="pull-stop"]'), needle = document.querySelector('.pg-needle');
    const deadline = performance.now() + 12000;
    while (button.disabled || Number(needle.dataset.pos) < lo || Number(needle.dataset.pos) > hi) {
      if (performance.now() > deadline) throw new Error(`needle did not reach ${lo}–${hi}: ${needle.dataset.pos}, disabled=${button.disabled}`);
      await new Promise(requestAnimationFrame);
    }
    const before = Number(document.querySelector('[data-test="pull-temperature"]').getAttribute('aria-valuenow'));
    const began = performance.now();
    window.lastDraw = { began };
    const play = document.querySelector('.pull-play');
    const observer = new MutationObserver(() => {
      if (!play.dataset.draw) { window.lastDraw.ended = performance.now(); observer.disconnect(); }
    });
    observer.observe(play, { attributes: true, attributeFilter: ['data-draw'] });
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    return { before, began, immediately: Number(document.querySelector('[data-test="pull-temperature"]').getAttribute('aria-valuenow')), transform: needle.getAttribute('transform') };
  }, { lo, hi });
  const temperature = () => page.locator('[data-test="pull-temperature"]').getAttribute('aria-valuenow').then(Number);
  const settled = () => page.waitForFunction(() => !document.querySelector('.pull-play').dataset.draw);
  const finish = async () => {
    await page.locator('[data-test="pull-serve"]').click();
    await page.waitForSelector('.result-card.show');
    await page.locator('[data-test="step-next"]').click();
    await page.evaluate(() => window.run);
  };
  const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

  await open();
  await page.mouse.click(1100, 24); // 本物のユーザー操作で音声を解放。
  await page.evaluate(() => T.audio.preloadSe());
  const layout = await page.evaluate(() => {
    const box = s => { const r = document.querySelector(s).getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width }; };
    const white = getComputedStyle(document.querySelector('.thermo-optimal'), '::before');
    const body = document.querySelector('.needle-body').getBBox();
    const note = document.querySelector('.audience-note');
    return { left:box('.bench-left'), right:box('.bench-right'), worker:box('.bench-worker-stage'), thermo:box('.thermo'), button:box('[data-test="pull-stop"]'), buttonArt:getComputedStyle(document.querySelector('[data-test="pull-stop"]')).backgroundImage, summary:box('.pull-summary'), ring:box('.dial-ring'), optimal:box('.thermo-optimal'), ideal:box('.thermo-zone'), note:{bounds:box('.audience-note'), font:getComputedStyle(note).fontSize, white:getComputedStyle(note).whiteSpace}, white:white.backgroundColor, line:white.height, needle:body.height };
  });
  assert(Math.abs(layout.left.top - layout.right.top) < 1 && Math.abs(layout.left.bottom - layout.right.bottom) < 1, JSON.stringify(layout));
  assert(layout.left.width / layout.right.width > .50 && layout.left.width / layout.right.width < .56, 'window ratio differs from mockup');
  assert(layout.thermo.left >= layout.worker.left && layout.thermo.right <= layout.left.right && layout.thermo.bottom <= layout.worker.bottom, 'temperature gauge must fit the left scene');
  assert.equal(layout.white, 'rgb(255, 255, 255)'); assert.equal(layout.line, '3px');
  assert.equal(layout.needle, 197, 'central wiper must reach the ring without extending beyond it');
  assert(Math.abs(layout.ring.width / (layout.ring.bottom-layout.ring.top) - 2) < .005, 'protractor arch must be a true circular semicircle');
  assert(layout.optimal.bottom-layout.optimal.top > 14, 'rainbow target must be wider and conspicuous');
  assert.equal(await page.locator('.bench-condition').count(), 0, 'face badge is absent from the mockup');
  assert(!await page.locator('.pull-dial-labels').innerText().then(t=>/長く|強く|短く/.test(t)), 'side descriptions must only explain temperature');
  assert(layout.buttonArt.includes('ui_mockup_inhale_button'), 'generated button art is not connected');
  await page.evaluate(async () => {
    const art = getComputedStyle(document.querySelector('[data-test="pull-stop"]')).backgroundImage;
    const image = new Image(); image.src = /url\(["']?([^"')]+)/.exec(art)[1];
    await image.decode();
    if (!image.naturalWidth) throw new Error('button skin did not load');
  });
  assert.equal(layout.button.bottom - layout.button.top, 96, 'mockup button height');
  assert(layout.button.top > 585 && layout.button.top < 600, 'bottom controls must use the tightened spacing');
  assert(layout.right.bottom - layout.button.bottom >= 10 && layout.right.bottom - layout.button.bottom <= 16, 'bottom button must keep a small inset inside the window');
  assert.equal(layout.summary.bottom - layout.summary.top, 64, 'mockup information height');
  assert.equal(await page.locator('.pull-pip').count(), 5, 'the information box counts up to five pulls');
  assert.equal(await page.locator('.flavor-leaf[data-stage="red"]').count(), 5, 'flavor must start with five red leaves');
  console.log(`Layout: ${JSON.stringify(layout)}`);
  await shot('01-pull-desktop');

  // 熱を入れる吸い: 直後には温度が飛ばず、針・提供・二重入力を止めて短い一口を吸う。
  const up = await at(80, 84);
  assert.equal(up.immediately, up.before);
  assert.equal(await page.locator('.bench-worker').getAttribute('data-draw'), 'up');
  await page.waitForTimeout(450);
  const mid = await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key:' ' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter' }));
    document.querySelector('[data-test="pull-stop"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
    return { temp:Number(document.querySelector('[data-test="pull-temperature"]').getAttribute('aria-valuenow')), needle:document.querySelector('.pg-needle').getAttribute('transform'), locked:[...document.querySelectorAll('.pull-btns button')].every(n=>n.disabled), results:document.querySelectorAll('.result-card').length, bubbles:Number(getComputedStyle(document.querySelector('.worker-water')).opacity) };
  });
  assert(mid.temp > up.before + .01); assert.equal(mid.needle, up.transform);
  assert(mid.locked); assert.equal(mid.results, 0); assert(mid.bubbles > .9);
  await shot('02-up-drawing');
  await settled();
  const upMs = await page.evaluate(() => lastDraw.ended - lastDraw.began);
  const afterUp = await temperature();
  assert(afterUp > up.before + .08 && upMs >= 1300 && upMs < 2500, `${up.before} -> ${afterUp}, ${upMs}ms`);
  assert(await page.evaluate(() => window.bubbleSounds) >= 2, 'recorded loop and final bubble did not play');
  const sounds = await page.evaluate(() => window.bubbleSounds);
  await page.waitForTimeout(220); assert.equal(await page.evaluate(() => window.bubbleSounds), sounds, 'bubble sound continued after inhaling');
  assert(await page.locator('[data-test="pull-serve"]').isDisabled(), 'minimum two pulls still required');
  console.log(`Up inhale and bubbling passed (${Math.round(upMs)}ms)`);

  // キープも一口が終わるまで提供を待つ。押しっぱなしは自動連打にしない。
  await at(48, 52);
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key:' ', repeat:true })));
  await page.keyboard.press('Enter');
  assert(await page.locator('[data-test="pull-serve"]').isDisabled());
  await settled(); await page.keyboard.up('Space');
  assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()));

  // 熱を逃がす吸いは長く強い一口。2秒経っても固定し、最後まで下がってから再開。
  const down = await at(16, 19);
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('.bench-worker').getAttribute('data-draw'), 'down');
  assert.equal(await page.locator('.pg-needle').getAttribute('transform'), down.transform);
  assert(await temperature() < down.before - .02);
  await shot('03-down-drawing');
  await settled();
  const downMs = await page.evaluate(() => lastDraw.ended - lastDraw.began);
  assert(downMs >= 3100 && downMs > upMs + 1000, `${upMs} vs ${downMs}`);
  assert.equal(await page.locator('[data-test="pull-count"]').getAttribute('data-pulls'), '3');
  assert.equal(await page.locator('[data-test="leaf-icon"]').getAttribute('data-hp'), '5');
  await finish(); assert.equal(await page.evaluate(() => cs.pull.pulls), 3);

  // 熱管理でも同じ流れを使う。動きを減らす設定でも吸い終わる前に提供できない。
  await page.emulateMedia({ reducedMotion:'reduce' });
  await open('care', .5); await at(80, 84);
  assert(await page.locator('[data-test="pull-serve"]').isDisabled());
  assert.equal(await page.locator('.worker-water i').first().evaluate(n => getComputedStyle(n).animationName), 'none');
  await settled(); assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()));
  await finish(); assert.equal(await page.evaluate(() => cs.care.pulls), 1);

  // 横向きのスマホでもウインドウと操作が画面内に収まる。
  await page.setViewportSize({ width:844, height:390 }); await open();
  const bounds = await page.locator('[data-test="pull-stop"]').boundingBox();
  assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 845 && bounds.y + bounds.height <= 391, JSON.stringify(bounds));
  await shot('04-pull-mobile');
  await at(80, 84);
  // 吸引中に画面を離れても、音・キー・遅れた結果を次の工程へ持ち越さない。
  await page.evaluate(() => T.session.stepPanel('mix', '配合'));
  await page.evaluate(() => window.run);
  await page.waitForTimeout(220);
  const stopped = await page.evaluate(() => window.bubbleSounds);
  await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => window.bubbleSounds), stopped);
  assert.equal(await page.locator('.result-card').count(), 0);
  assert.equal(await page.locator('.bench-worker').getAttribute('data-draw'), null);
  assert.equal(await page.evaluate(() => cs.pull), null);
  assert.deepEqual(errors, []);
  console.log(`PASS: mockup windows and button art, circular arch and central wiper, expanded rainbow and white line, gradual heat, input lock, bubbling lifecycle, up ${Math.round(upMs)}ms / down ${Math.round(downMs)}ms, care, reduced motion, mobile and scene exit`);
} finally { await browser.close(); }
