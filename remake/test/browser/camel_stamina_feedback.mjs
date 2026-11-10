// 実画面で加速/息の警告/回復/再挑戦/一行観客席。競走モデルは自然に進める。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const artifacts = process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
const capture = async (page, name) => { fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `camel-stamina-${name}.png`) }); };
import { suite, baseURL } from './support.mjs';

async function launch(page, { reduced = false } = {}) {
  await page.evaluate(async ({ reduced }) => {
    await document.fonts.load('16px "Suien Dot"');
    const { runCamelRace } = await import('./js/minigames/camel-race.js');
    const { activeCue } = await import('./js/minigames/camel-race-model.js');
    window.__whipTest = true;
    window.__warningStates = [];
    const policy = race => {
      const cue = activeCue(race);
      return { voice: !!cue && Math.abs(cue.dt) < .02, whip: window.__whipTest };
    };
    window.__racePromise = runCamelRace({ host: document.getElementById('stage'), tutorial: false,
      seed: 4, pilot: policy, timeScale: 4, reducedMotion: reduced });
    const node = document.querySelector('[data-test="camel-pacing"]');
    new MutationObserver(() => {
      if (!window.__warningStates.includes(node.dataset.state)) window.__warningStates.push(node.dataset.state);
    }).observe(node, { attributes: true });
  }, { reduced });
  await page.waitForFunction(() => document.querySelector('[data-test="camel-game"]')?.dataset.phase === 'race');
}

await suite('camel-stamina-feedback', async check => {
  for (const mobile of [false, true]) await check(mobile ? 'touch-width-warning-recovery' : 'desktop-warning-recovery', async page => {
    await launch(page);
    await page.locator('[data-test="camel-boost-label"]').waitFor({ state: 'visible' });
    await capture(page, mobile ? 'touch-boost' : 'desktop-boost');
    const ticker = page.locator('[data-test="camel-spectators"]');
    assert.equal(await ticker.evaluate(n => getComputedStyle(n).whiteSpace), 'nowrap');
    assert.ok(await ticker.evaluate(n => getComputedStyle(n).fontFamily.includes('Suien Dot')), '同梱の日本語ドット書体を使う');
    assert.equal(await page.evaluate(() => document.fonts.check('16px "Suien Dot"')), true);
    assert.ok((await ticker.textContent()).includes('架空応援席'));
    await page.waitForFunction(() => window.__warningStates.includes('spent'));
    assert.ok(await page.evaluate(() => window.__warningStates.includes('low') && window.__warningStates.includes('tired')));
    await page.locator('[data-test="camel-boost-label"]').waitFor({ state: 'hidden' });
    assert.match(await page.locator('[data-test="camel-pacing"]').textContent(), /再使用まで/);
    await capture(page, mobile ? 'touch-spent' : 'desktop-spent');
    await page.evaluate(() => { window.__whipTest = false; });
    await page.waitForFunction(() => document.querySelector('[data-test="camel-pacing"]')?.dataset.state !== 'spent', null, { timeout: 20000 });
    assert.equal(await page.locator('[data-test="camel-boost-label"]').isVisible(), false);
    const boxes = await page.evaluate(() => Object.fromEntries(['.camel-pacing','.camel-spectators','.camel-voice','.camel-signal','.camel-call','.camel-banner'].map(s => {
      const b = document.querySelector(s).getBoundingClientRect();
      return [s, { x:b.x, y:b.y, right:b.right, bottom:b.bottom }];
    })));
    assert.ok(Object.values(boxes).every(b => b.x >= 0 && b.y >= 0 && b.right <= (mobile ? 844 : 1280) + 1 && b.bottom <= (mobile ? 390 : 720) + 1));
    const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    assert.equal(overlaps(boxes['.camel-pacing'], boxes['.camel-voice']), false);
    assert.equal(overlaps(boxes['.camel-pacing'], boxes['.camel-signal']), false);
    assert.equal(overlaps(boxes['.camel-spectators'], boxes['.camel-call']), false);
    assert.equal(overlaps(boxes['.camel-spectators'], boxes['.camel-banner']), false);
    await page.locator('[data-test="camel-close"]').click();
    await page.locator('[data-test="camel-game"]').waitFor({ state: 'detached' });
    await page.locator('[data-test="camel-menu-quick"]').click();
    assert.match(await page.locator('[data-test="camel-pacing"]').textContent(), /回復/);
  }, mobile ? { viewport: { width:844, height:390 }, hasTouch:true, isMobile:true } : {});

  await check('reduced-motion-keeps-readable-state', async page => {
    await launch(page, { reduced: true });
    await page.locator('[data-test="camel-boost-label"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.camel-spectator-text').evaluate(n => getComputedStyle(n).animationName), 'none');
    await page.locator('[data-test="camel-close"]').click();
    await page.locator('[data-test="camel-game"]').waitFor({ state:'detached' });
  }, { reducedMotion:'reduce' });
}, { entry:new URL('camel-race.html',baseURL).href, readySelector:'[data-test="camel-menu-quick"]' });
