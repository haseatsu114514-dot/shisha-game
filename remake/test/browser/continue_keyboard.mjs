// #590: actual native button keyboard activation, focus order and held-key boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.ARTIFACT_DIR || '.codex/artifacts/continue-keyboard';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const errors = [], missing = [], results = [];
try {
  for (const touch of [false, true]) for (const reducedMotion of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      isMobile: touch, hasTouch: touch, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && /\.(webp|png|woff2|css|js|json)/.test(r.url())) missing.push(r.url()); });
    await page.route('**/assets/audio/bgm/bgm_continue_urgent.mp3', r => r.abort());
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.waitForSelector('[data-test="title-new"]');
    await page.locator('#boot').waitFor({ state: 'detached' });
    const before = await page.evaluate(async () => {
      const { config } = await import('./js/core/state.js'); config.bgmVolume = config.seVolume = 0;
      (await import('./js/core/audio.js')).applyVolumes();
      await document.fonts.ready;
      return JSON.stringify({ state: (await import('./js/core/state.js')).state, storage: { ...localStorage } });
    });
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
    const mount = async (attach = true) => {
      await page.evaluate(async attach => {
        window.__go?.cleanupContinue(); window.__calls = [];
        const { buildGameOver } = await import('./js/chapters/gameover.js');
        window.__go = buildGameOver({ variant: 0, soundEffects: false,
          onRetry: () => __calls.push('retry'), onTitle: () => __calls.push('title') });
        if (attach) document.querySelector('#screen').replaceChildren(__go);
      }, attach);
      await page.clock.runFor(20);
    };
    const focus = () => page.evaluate(() => document.activeElement?.dataset.test || document.activeElement?.tagName);
    const phase = () => page.locator('.gameover').getAttribute('data-phase');
    const calls = () => page.evaluate(() => [...__calls]);
    const assertSpeaking = async () => { assert.equal(await phase(), 'speaking'); assert.deepEqual(await calls(), []); };

    // Detached, hidden, MENU and real touch rotation must not steal focus or start the deadline.
    await page.locator('[data-test="title-new"]').focus();
    await mount(false);
    assert.equal(await focus(), 'title-new');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.querySelector('#modal').classList.add('show');
      document.querySelector('#screen').replaceChildren(__go);
    });
    await page.clock.runFor(2000);
    assert.notEqual(await focus(), 'retry');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1000);
    assert.notEqual(await focus(), 'retry', 'MENU still blocks initial focus');
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector('#modal').classList.remove('show'));
    if (touch) {
      await page.clock.runFor(1000);
      assert.equal(await page.locator('#rotate-hint').evaluate(n => getComputedStyle(n).display), 'grid');
      assert.notEqual(await focus(), 'retry');
      await page.setViewportSize({ width: 844, height: 390 });
    }
    await page.clock.runFor(20);
    assert.equal(await focus(), 'retry');
    assert.equal(await page.locator('.go-count').textContent(), '20');
    assert.equal(await page.evaluate(() => scrollX + scrollY), 0);
    assert.equal(await page.locator('.gameover [tabindex]').count(), 0);
    await page.keyboard.press('Tab'); assert.equal(await focus(), 'game-over-title');
    await page.keyboard.press('Tab'); assert.equal(await focus(), 'continue-caption');
    await page.keyboard.press('ArrowLeft'); assert.equal(await focus(), 'continue-caption', 'arrows stay local to choices');
    await page.keyboard.press('Shift+Tab'); assert.equal(await focus(), 'game-over-title');
    await page.keyboard.press('ArrowLeft'); assert.equal(await focus(), 'retry');
    await page.keyboard.press('ArrowRight'); assert.equal(await focus(), 'game-over-title');
    await page.keyboard.press('ArrowRight'); assert.equal(await focus(), 'game-over-title');
    await page.keyboard.press('ArrowLeft'); assert.equal(await focus(), 'retry');
    await page.locator('.gameover img').evaluateAll(imgs => Promise.all(imgs.map(i => i.decode())));
    await page.clock.runFor(700);
    await page.screenshot({ path: `${out}/${touch ? 'touch' : 'pc'}-${reducedMotion ? 'reduced' : 'normal'}.png` });

    // A key held before this screen must neither choose on repeat nor on Space release.
    for (const key of ['Enter', ' ']) {
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.down(key);
      await mount();
      await page.keyboard.down(key); // Playwright generates repeat=true for an already-held key.
      await page.clock.runFor(600);
      await page.keyboard.up(key);
      await assertSpeaking();
      // Fresh press is accepted immediately, with native Enter/Space semantics.
      await page.keyboard.press(key);
      assert.equal(await phase(), 'reaction');
      assert.equal(await page.locator('.gameover').getAttribute('data-choice'), 'retry');
      await page.clock.runFor(9000);
      assert.deepEqual(await calls(), ['retry']);
    }
    // Enter repeats must not carry over to the newly focused reaction button after its 450ms guard.
    await mount();
    await page.keyboard.down('Enter'); assert.equal(await phase(), 'reaction');
    await page.clock.runFor(600);
    const reaction = await page.locator('.go-speech-text').textContent();
    for (let i = 0; i < 10; i++) await page.keyboard.down('Enter');
    assert.equal(await page.locator('.go-speech-text').textContent(), reaction);
    assert.deepEqual(await calls(), []);
    await page.keyboard.up('Enter');
    await page.clock.runFor(9000); assert.deepEqual(await calls(), ['retry']);
    await page.clock.runFor(9000); assert.deepEqual(await calls(), ['retry']);

    // Both native activation keys also select quit, and rapid mixed inputs cannot change the branch.
    for (const key of ['Enter', ' ']) {
      await mount(); await page.keyboard.press('ArrowRight'); await page.keyboard.press(key);
      await page.evaluate(() => { __go.querySelector('.go-retry').click(); __go.querySelector('.go-quit').click(); });
      assert.equal(await page.locator('.gameover').getAttribute('data-choice'), 'quit');
      await page.clock.runFor(9000); assert.deepEqual(await calls(), ['title']);
    }
    // Pointer/touch input and cleanup retain the existing once-only callback boundary.
    await mount();
    if (touch) await page.locator('.go-retry').tap(); else await page.locator('.go-retry').click();
    await page.evaluate(() => { for (let i = 0; i < 20; i++) __go.querySelector('.go-proceed').click(); });
    assert.deepEqual(await calls(), []);
    await page.clock.runFor(9000); assert.deepEqual(await calls(), ['retry']);
    await mount(); await page.keyboard.press('Enter');
    await page.evaluate(() => __go.cleanupContinue());
    await page.clock.fastForward(30000); assert.deepEqual(await calls(), []);
    const after = await page.evaluate(async () => JSON.stringify({ state: (await import('./js/core/state.js')).state, storage: { ...localStorage } }));
    assert.equal(after, before);
    results.push({ touch, reducedMotion, focusOrder: 'retry, quit, caption', heldKeys: 'Enter/Space', callbacks: 'once', save: 'unchanged' });
    console.log(`PASS keyboard: ${touch ? '844x390 touch' : '1280x720 PC'}, reduced=${reducedMotion}`);
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors, missing }, null, 2));
} finally { await browser.close(); }
