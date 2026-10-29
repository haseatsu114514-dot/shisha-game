import assert from 'node:assert/strict';
import path from 'node:path';
import { suite, baseURL } from './support.mjs';
import { LOADING_COMICS } from '../../js/core/loading-comics.js';

// The bench preview picks one eligible comic at random (see selectLoadingComic
// in js/core/loading.js), so expectations are derived from whichever registered
// comic actually appears instead of pinning one episode.
const eligibleComics = LOADING_COMICS.filter(comic =>
  comic.panels?.length === 2 &&
  Number.isInteger(comic.minChapter) && comic.minChapter <= 1 &&
  (!comic.contexts || comic.contexts.includes('craft')));
assert(eligibleComics.length > 0, 'At least one registered comic must be eligible for craft at chapter 1');

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

await suite('loading-craft', async check => {
  for (const [label, viewport] of [['pc', { width: 1280, height: 720 }], ['mobile', { width: 844, height: 390 }]]) {
    await check(label, async page => {
      const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      assert.equal(await page.locator('.bench').count(), 1, 'Use the actual game bench');
      await page.locator('.loading-panels img').first().waitFor();
      assert.equal(await page.locator('.loading-panels img').count(), 2);
      const shownTitle = await page.locator('.loading-comic-title').innerText();
      const comic = eligibleComics.find(entry => entry.title === shownTitle);
      assert(comic, `Shown comic "${shownTitle}" must be a registered comic eligible for craft`);
      assert.match(await page.locator('.loading-comic').getAttribute('aria-label'), new RegExp(escapeRegExp(comic.title)));
      assert.equal(await page.locator('.loading-status').innerText(), 'LOADING…');
      assert.equal(await page.locator('.loading-gate button, .loading-gate progress, .loading-gate figcaption').count(), 0);
      assert.equal(await page.locator('.bench-panel > *').count(), 0, 'No gameplay before preparation');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.loading-gate').count(), 1, 'Cannot skip the preparation');
      const regions = await page.locator('.loading-panel-art').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(), image = node.querySelector('img');
        const stage = document.querySelector('#stage').getBoundingClientRect();
        return { inside: box.left >= stage.left && box.right <= stage.right && box.bottom <= stage.bottom,
          ratio: box.width / box.height, decoded: image.complete && image.naturalWidth > 0,
          naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          overflow: getComputedStyle(node).overflow, src: image.getAttribute('src') };
      }));
      assert(regions.every(region => region.inside && region.decoded && region.overflow === 'hidden'));
      assert(regions.every(region => Math.abs(region.ratio - 3 / 2) < 0.03), 'Every panel uses the fixed 3:2 display frame');
      // The decoded image must be the shown comic's registered sheet, at its registered size.
      regions.forEach((region, index) => {
        const panel = comic.panels[index];
        const srcTail = panel.src.split('/').slice(-2).join('/');
        assert(region.src.endsWith(srcTail), `Panel ${index} must show the registered ${srcTail}`);
        if (panel.region) {
          assert.equal(region.naturalWidth, panel.region.sourceWidth, `Panel ${index} sheet width matches the registration`);
          assert.equal(region.naturalHeight, panel.region.sourceHeight, `Panel ${index} sheet height matches the registration`);
        }
      });
      // The cropped region keeps its own proportions, letterboxed inside the frame (no stretching).
      const crops = await page.locator('.loading-panel-crop').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width / node.getBoundingClientRect().height));
      crops.forEach((crop, index) => {
        const panel = comic.panels[index];
        const expected = panel.region ? panel.region.width / panel.region.height
          : regions[index].naturalWidth / regions[index].naturalHeight;
        assert(Math.abs(crop - expected) < 0.06, `Panel ${index} crop keeps the registered region proportions (${expected})`);
      });
      await page.locator(".loading-card").evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
      assert.equal(await page.locator('.loading-card').evaluate(node => {
        const matrix = new DOMMatrix(getComputedStyle(node).transform);
        return matrix.b === 0 && matrix.c === 0;
      }), true, 'The comic sheet stays horizontal, including after its entrance');
      await page.locator("#stage").screenshot({ path: path.resolve(`.codex/artifacts/remake-browser/loading-ingame-${label}.png`) });
      const indicator = await page.locator('.loading-status').evaluate(node => {
        const box = node.getBoundingClientRect(), stage = document.querySelector('#stage').getBoundingClientRect();
        const center = box.left + box.width / 2;
        return { right: stage.right - box.right, bottom: stage.bottom - box.bottom, left: box.left - stage.left,
          inside: box.top > stage.top + stage.height * .8 && Math.abs(center - (stage.left + stage.width / 2)) < stage.width * .2,
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
          animation: getComputedStyle(node.querySelector('.loading-emblem path')).animationName };
      });
      assert(indicator.inside && indicator.left >= 0 && indicator.right >= 0 && indicator.bottom >= 0, 'LOADING sits centred along the bottom');
      if (indicator.reduced) assert.equal(indicator.animation, 'none');
      assert.equal(await page.locator('.loading-emblem path').count(), 3, 'Use the game-specific smoke mark');
      // A shown comic holds for reading; advancing needs a tap/key, then the gate closes.
      await page.locator('.loading-gate.is-ready').waitFor();
      await page.keyboard.press('Enter');
      await page.locator('.loading-gate').waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.querySelector('.bench-panel')?.childElementCount > 0);
      assert.equal(await page.locator('#screen').evaluate(node => node.inert), false);
      assert.equal(await page.locator('.bench').evaluate(node => node.inert), false);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), storage);
    }, { viewport, reducedMotion: label === 'mobile' ? 'reduce' : 'no-preference' });
  }
  await check('portrait', async page => {
    // In the real game canvas too, portrait shows the comic at viewport scale with large panels.
    await page.locator('.loading-gate').waitFor();
    await page.locator('.loading-panels img').first().waitFor();
    const layout = await page.evaluate(() => {
      const gate = document.querySelector('.loading-gate');
      const arts = [...document.querySelectorAll('.loading-panel-art')].map(node => node.getBoundingClientRect());
      return {
        viewport: gate.classList.contains('is-viewport') && gate.parentElement === document.body,
        widths: arts.map(box => box.width),
        stacked: arts.length === 2 && arts[1].top >= arts[0].bottom - 2,
        within: arts.every(box => box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1),
      };
    });
    assert(layout.viewport, 'Portrait renders the gate at viewport scale, outside #stage');
    assert(layout.stacked, 'Portrait stacks the two panels');
    assert(layout.widths.every(width => width >= 280), `Panels must be large in portrait, got ${layout.widths}`);
    assert(layout.within, 'Portrait layout stays within the viewport');
    await page.locator('.loading-gate.is-ready').waitFor();
    await page.keyboard.press('Enter');
    await page.locator('.loading-gate').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('.bench-panel')?.childElementCount > 0);
  }, { viewport: { width: 390, height: 844 } });
}, {
  readLoadingComics: false,
  entry: new URL('craft-preview.html?loading=comic', baseURL).href,
  readySelector: '.loading-gate',
  initScript: () => localStorage.setItem('suien_remake_save', 'untouched-loading-preview'),
});
