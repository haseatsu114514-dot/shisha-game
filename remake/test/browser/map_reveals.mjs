import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.ARTIFACT_DIR || 'docs/qa/map-facilities-579/placement';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const results = [];
try {
  for (const [name, viewport, layout, reducedMotion] of [
    ['pc', { width: 1280, height: 900 }, 'normal', 'no-preference'],
    ['landscape', { width: 844, height: 390 }, 'normal', 'no-preference'],
    ['ds-portrait', { width: 390, height: 844 }, 'ds', 'no-preference'],
    ['ds-reduced', { width: 844, height: 390 }, 'ds', 'reduce'],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion, hasTouch: name !== 'pc' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(layout => localStorage.setItem('suien_title_layout', layout), layout);
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator('#boot').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      window.R = { core: await import('./js/core/state.js'), map: await import('./js/daily/map.js'), hud: await import('./js/daily/hud.js') };
      R.core.config.bgmVolume = 0; R.hud.initHud({}); R.hud.showHud(true);
      Object.assign(R.core.newGame(), { phase: 'daily', day: 3, seed: 131, weatherSeed: 4 });
      R.shown = 0;
      R.phaseObserver = new MutationObserver(records => {
        if (records.some(r => r.target.dataset.revealPhase === 'pause')) R.pauseAt = performance.now();
      });
      R.phaseObserver.observe(document.getElementById('screen'), { subtree: true, attributes: true, attributeFilter: ['data-reveal-phase'] });
      window.reopen = async (options = {}) => {
        if (window.flow) { R.map.interruptMap(null); await window.flow; }
        const saved = JSON.stringify(R.core.state);
        window.flow = R.map.chooseSpot({ ...options, onShown: () => { R.shown++; R.shownAt = performance.now(); } });
        return saved;
      };
      void reopen();
    });
    await page.locator('.map:not(.done)').waitFor();
    assert.equal(await page.locator('.newly-revealed').count(), 0, 'first map must not celebrate existing places');
    assert.equal(await page.evaluate(() => R.shown), 1);
    const saved = await page.evaluate(async () => {
      Object.assign(R.core.state.met, { adam: true, minto: true, sumi: true, tsumugi: true });
      Object.assign(R.core.state.flags, { _spot_guide_adam: true, _spot_guide_minto: true });
      return reopen({ notice: '次の予定を確認しよう', guide: { pin: 'choizap', text: '次はちょいZAPへ' } });
    });
    const currentMap = page.locator('.map:not(.done)');
    await currentMap.locator('[data-test="map-guide"]').waitFor({ state: 'attached' });
    assert.equal(await currentMap.locator('.map-info').isVisible(), false);
    assert.equal(await currentMap.locator('.map-guide').isVisible(), false);
    assert.equal(await currentMap.locator('.map-notice:not(.map-unlock-notice)').isVisible(), false);
    assert.equal(await page.evaluate(() => R.shown), 1, 'onShown waits for the reveal');
    await page.locator('[data-test="pin-kannon"].newly-revealed').waitFor();
    assert(await currentMap.locator('.map-unlock-notice').isVisible());
    assert.equal(await currentMap.locator('.map-guide').isVisible(), false);
    assert.equal(await page.evaluate(() => JSON.stringify(R.core.state)), saved, 'presentation must not modify save');
    assert.deepEqual(await page.locator('.newly-revealed').evaluateAll(p => p.map(n => n.dataset.spot).sort()), ['choizap', 'kannon']);
    assert.equal(await page.locator('.pin-people').first().evaluate(n => getComputedStyle(n).justifyContent), 'flex-start');
    if (reducedMotion === 'reduce') {
      assert.equal(await page.locator('.newly-revealed .shield').first().evaluate(n => getComputedStyle(n).animationName), 'none');
    } else {
      assert.equal(await page.locator('.newly-revealed .shield').first().evaluate(n => getComputedStyle(n).animationName), 'spot-reveal-pop');
    }
    if (name === 'pc') {
      await page.evaluate(() => document.querySelectorAll('.newly-revealed').forEach(pin => pin.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = 280; })));
      await page.screenshot({ path: `${out}/unlock-pop.jpg`, type: 'jpeg', quality: 80 });
      await page.evaluate(() => document.querySelectorAll('.newly-revealed').forEach(pin => pin.getAnimations({ subtree: true }).forEach(a => a.play())));
    }
    // After the unlock label, keep a quiet pause before guides and callbacks.
    await page.locator('.map[data-reveal-phase="pause"]').waitFor();
    assert.equal(await currentMap.locator('.map-unlock-notice').textContent(), '');
    assert.equal(await currentMap.locator('.map-info').isVisible(), false);
    assert.equal(await currentMap.locator('.map-guide').isVisible(), false);
    assert.equal(await page.evaluate(() => R.shown), 1);
    await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
    assert(await currentMap.locator('.map-guide').isVisible());
    assert(await currentMap.locator('.map-info').isVisible());
    assert(await currentMap.locator('.map-notice:not(.map-unlock-notice)').isVisible());
    assert.equal(await page.evaluate(() => R.shown), 2);
    assert(await page.evaluate(() => R.shownAt - R.pauseAt >= 400), 'a visible quiet pause precedes follow-up messages');
    const gym = page.locator('[data-test="pin-choizap"]'); await gym.scrollIntoViewIfNeeded(); await gym.click();
    assert(await gym.evaluate(n => n.classList.contains('sel')));
    await page.waitForFunction(() => !document.querySelector('.newly-revealed'));
    await page.evaluate(() => reopen());
    await page.locator('.map:not(.done)').waitFor();
    assert.equal(await page.locator('.newly-revealed').count(), 0, 'opening map repeats animation');
    await page.evaluate(async () => { R.core.state.met.uranaishi = true; await reopen(); });
    assert.equal(await page.locator('[data-test="pin-fortune"].newly-revealed').count(), 0, 'meeting is not a second facility unlock');
    await page.evaluate(async () => { R.core.state.day = 4; await reopen(); });
    await page.locator('.map:not(.done)').waitFor();
    assert.equal(await page.locator('[data-test="pin-fortune"]').count(), 0);
    await page.evaluate(async () => { R.core.state.day = 6; await reopen(); });
    await page.locator('[data-test="pin-fortune"]').waitFor();
    assert.equal(await page.locator('.newly-revealed').count(), 0, 'scheduled stall repeats unlock');
    await page.evaluate(async () => {
      R.core.state.chapter = 2; R.core.state.flags._axe_bar_rumor_done = true;
      await reopen();
    });
    await page.locator('[data-test="pin-shishark"].newly-revealed').waitFor();
    assert.equal(await page.locator('[data-test="pin-trpg_bar"]').count(), 0, 'chapter 2 alone does not introduce the TRPG bar');
    assert.deepEqual(await page.locator('.newly-revealed').evaluateAll(p => p.map(n => n.dataset.spot).sort()), ['axe_bar', 'shishark']);
    await page.waitForFunction(() => !document.querySelector('.newly-revealed'));
    await page.evaluate(async () => { R.core.state.flags._rei_trpg_introduced = true; await reopen(); });
    await page.locator('[data-test="pin-trpg_bar"].newly-revealed').waitFor();
    assert.deepEqual(await page.locator('.newly-revealed').evaluateAll(p => p.map(n => n.dataset.spot).sort()), ['trpg_bar']);
    await page.evaluate(async () => { R.core.newGame(); await reopen(); });
    await page.locator('.map:not(.done)').waitFor();
    assert.equal(await page.locator('.newly-revealed').count(), 0, 'history leaked to a new game');
    assert.deepEqual(errors, []);
    results.push({ name, firstMapQuiet: true, unlocks: ['choizap', 'kannon', 'fortune', 'axe_bar', 'shishark', 'trpg_bar'], selectionAfterAnimation: true, noRepeat: true, stateUnchanged: true, reducedMotion });
    console.log(`PASS unlock: ${name}`);
    await context.close();
  }
} finally {
  fs.writeFileSync(`${out}/unlocks.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
