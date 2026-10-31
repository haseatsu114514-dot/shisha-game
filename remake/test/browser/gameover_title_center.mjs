// Actual deadline → GAME OVER, in stage coordinates; no mocked timeout DOM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const out = process.env.ARTIFACT_DIR || '.codex/artifacts/gameover-title-center';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [], errors = [], missing = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && /\.(webp|png|woff2|css|js)/.test(r.url())) missing.push(r.url()); });
  await page.route('**/assets/audio/bgm/bgm_continue_urgent.mp3', r => r.abort());
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const { config } = await import('./js/core/state.js');
    config.bgmVolume = config.seVolume = 0;
    (await import('./js/core/audio.js')).applyVolumes();
    await document.fonts.ready;
    localStorage.setItem('suien_remake_save', 'center-regression-sentinel');
  });
  await page.clock.install({ time: new Date('2026-10-16T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-16T00:00:01Z'));
  for (const mode of ['normal', 'fast', 'reduced']) {
    await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    for (const [width, height] of [[1280,720], [1920,1080], [844,390], [667,375]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(async () => {
        const { buildGameOver } = await import('./js/chapters/gameover.js');
        const { showScreen } = await import('./js/core/ui.js');
        window.__decisions = [];
        showScreen('end', buildGameOver({ variant: 0, context: { lossOrdinal: 2 }, soundEffects: false,
          onTitle: () => window.__decisions.push('title'), onRetry: () => window.__decisions.push('retry') }));
      });
      await page.clock.runFor(700);
      await page.locator('.gameover img').evaluateAll(imgs => Promise.all(imgs.map(i => i.decode())));
      const normal = await page.evaluate(() => {
        const style = q => { const e = document.querySelector(q), s = getComputedStyle(e);
          return { left: s.left, top: s.top, width: s.width, height: s.height, transform: s.transform, inline: e.getAttribute('style') }; };
        return { title: style('.go-title'), portrait: style('.go-left'), image: style('.go-sumi-img') };
      });
      assert.equal(normal.title.left, '58px');
      assert.equal(normal.portrait.top, '0px');
      assert.equal(normal.portrait.height, '720px');
      if (mode === 'normal') await page.screenshot({ path: `${out}/continue-${width}.png` });
      if (mode === 'fast') await page.evaluate(() => {
        for (let i = 0; i < 40; i++) document.querySelector('.go-dialogue').click();
      });
      // Advance the real deadline without rendering every intermediate frame.
      await page.clock.fastForward(19000);
      await page.clock.runFor(1000);
      assert.equal(await page.locator('.gameover').getAttribute('data-phase'), 'gameover');
      // CSS animations use the browser rendering clock. Finish only the entry
      // animations before measuring the stable logo box, leaving timers intact.
      await page.locator('.go-heading,.go-title').evaluateAll(els => {
        for (const el of els) for (const animation of el.getAnimations()) animation.finish();
      });
      const final = await page.evaluate(() => {
        const root = document.querySelector('.gameover'), stage = document.querySelector('#stage').getBoundingClientRect();
        const title = root.querySelector('.go-title'), r = title.getBoundingClientRect(), k = stage.width / 1280, s = getComputedStyle(title);
        return { centerX: (r.x + r.width / 2 - stage.x) / k, centerY: (r.y + r.height / 2 - stage.y) / k,
          width: r.width / k, height: r.height / k, left: s.left, right: s.right, transform: s.transform,
          facesHidden: ['.go-left', '.go-right'].every(q => getComputedStyle(root.querySelector(q)).opacity === '0'),
          controlsHidden: [...root.querySelectorAll('.go-clock,.go-count-back,.end-actions')].every(e => e.hidden),
          calls: [...window.__decisions] };
      });
      await page.screenshot({ path: `${out}/gameover-${mode}-${width}.png` });
      await page.clock.runFor(2500);
      assert.deepEqual(await page.evaluate(() => window.__decisions), ['title']);
      assert.equal(await page.evaluate(() => localStorage.getItem('suien_remake_save')), 'center-regression-sentinel');
      results.push({ mode, width, height, normal, final, exit: 'title once' });
      console.log(`${mode} ${width}x${height}: center=(${final.centerX.toFixed(4)},${final.centerY.toFixed(4)}), exit once`);
    }
  }
  fs.writeFileSync(`${out}/metrics.json`, JSON.stringify({ results, errors, missing }, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  for (const { mode, width, final: f } of results) {
    assert(Math.abs(f.centerX - 640) <= 1, `${mode} ${width}: centerX=${f.centerX}, expected 640 ±1 stage px`);
    assert(Math.abs(f.centerY - 360) <= 1);
    assert(Math.abs(f.width - 760) < .1 && Math.abs(f.height - 220) < .1);
    assert.equal(f.left, '0px');
    assert(['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(f.transform), 'no residual title translation/scale');
    assert(f.facesHidden && f.controlsHidden); assert.deepEqual(f.calls, []);
  }
  // CSSOM resolves relative right:auto to -left, so check this explicit contract
  // in the shipped rule as well as testing its actual browser geometry above.
  const css = fs.readFileSync(new URL('../../css/continue-neon.css', import.meta.url), 'utf8');
  const rule = css.match(/\.gameover\[data-layout="neon"\]\[data-timed-out="true"\] \.go-title \{([^}]+)\}/)?.[1];
  assert.match(rule, /\bleft:\s*0\s*;/); assert.match(rule, /\bright:\s*auto\s*;/);
  assert.match(rule, /\btransform:\s*none\s*;/);
  console.log('PASS: 12 actual timeouts; 4 sizes × normal/fast/reduced; center, hidden faces/captions/count/choices, exit once, save unchanged; errors/missing=0');
} finally { await browser.close(); }
