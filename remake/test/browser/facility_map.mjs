// Map rendering in isolated saves. BASELINE=1 records the unmodified main.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const baseline = process.env.BASELINE === '1', phase = baseline ? 'before' : 'after';
const out = process.env.ARTIFACT_DIR || 'docs/qa/map-facilities-579';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
const expected = { kannon: 'kannondo', rest: 'home', cafe: 'kohaku', choizap: 'choizap', axe_bar: 'axe_bar', fortune: 'fortune' };
const protectedLogos = ['tonari', 'naru', 'adam', 'minto', 'shop', 'c_station'];
try {
  for (const [device, viewport, touch] of [
    ['pc', { width: 1280, height: 900 }, false],
    ['landscape', { width: 844, height: 390 }, true],
    ['portrait', { width: 390, height: 844 }, true],
  ]) for (const layout of ['normal', 'ds']) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], resources = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) resources.push(`${r.status()} ${r.url()}`); });
    await page.addInitScript(layout => { localStorage.setItem('suien_title_layout', layout); localStorage.setItem('qa-facility-sentinel', '579'); }, layout);
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 45000 });
    await page.locator('#boot').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      window.F = { core: await import('./js/core/state.js'), map: await import('./js/daily/map.js'),
        hud: await import('./js/daily/hud.js') };
      F.core.config.bgmVolume = 0;
      F.hud.initHud({});
    });
    const cases = [];
    for (const scenario of ['day', 'night', 'chapter2', 'locked', 'legacy']) {
      const saved = await page.evaluate(async scenario => {
        if (window.mapFlow) { F.map.interruptMap(null); await window.mapFlow; }
        const s = F.core.newGame();
        Object.assign(s, { chapter: scenario === 'chapter2' ? 2 : 1, phase: 'daily', day: 3,
          slot: ['night', 'legacy'].includes(scenario) ? 1 : 0, seed: 131, weatherSeed: 4, money: 90000, stamina: 90 });
        if (scenario !== 'locked') {
          for (const id of ['sumi', 'tsumugi', 'naru', 'adam', 'minto', 'rin', 'uranaishi']) s.met[id] = true;
          if (scenario === 'legacy') s.flags._axe_bar_legacy_access = true;
          else s.flags._axe_bar_rumor_done = true;
        }
        F.hud.showHud(true); F.hud.setPhoneBadge(0);
        const before = JSON.stringify(s);
        window.mapFlow = F.map.chooseSpot();
        return before;
      }, scenario);
      await page.locator('.map:not(.done)').waitFor();
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.map-pins img')].map(i => i.decode())); });
      const state = await page.evaluate(() => JSON.stringify(F.core.state));
      assert.equal(state, saved, 'map rendering changed save state');
      const pins = await page.locator('.map-pins .spot-pin').evaluateAll(nodes => nodes.map(pin => {
        const icon = pin.querySelector('.facility-icon'), crop = icon?.querySelector('.facility-icon-crop'), img = crop?.querySelector('img');
        const r = pin.getBoundingClientRect();
        return { id: pin.dataset.spot, locked: pin.classList.contains('pin-locked'),
          facility: icon?.dataset.facility || null, logo: pin.querySelector('[data-store-logo]')?.dataset.storeLogo || null,
          label: pin.getAttribute('aria-label'), caption: pin.querySelector('.sub-label').textContent,
          image: img ? { src: new URL(img.currentSrc).pathname, width: img.naturalWidth, height: img.naturalHeight } : null,
          filter: crop ? getComputedStyle(crop).filter : null,
          shieldBackground: getComputedStyle(pin.querySelector('.shield')).backgroundColor,
          target: { x: r.x, y: r.y, width: r.width, height: r.height },
          logicalTarget: [pin.offsetWidth, pin.offsetHeight], people: [...pin.querySelectorAll('.pin-person')].map(p => p.getAttribute('alt') || p.getAttribute('aria-label')) };
      }));
      for (const id of protectedLogos) {
        const pin = pins.find(p => p.id === id);
        assert.equal(pin?.logo, pin?.locked ? null : id, `${id} logo changed`);
      }
      if (!baseline && layout === 'normal') {
        for (const pin of pins.filter(p => p.facility)) {
          const a = pin.target;
          assert(pins.filter(p => p.id !== pin.id).every(({ target: b }) =>
            a.x+a.width <= b.x+1 || b.x+b.width <= a.x+1 || a.y+a.height <= b.y+1 || b.y+b.height <= a.y+1), `${pin.id} overlaps another destination`);
        }
      }
      const wanted = { ...expected, ...(scenario === 'chapter2' ? { trpg_bar: 'trpg_bar' } : {}) };
      for (const [id, facility] of Object.entries(wanted)) {
        const pin = pins.find(p => p.id === id);
        if (!pin) { assert(id === 'fortune' && scenario === 'chapter2'); continue; }
        const hidden = pin.locked || (id === 'fortune' && scenario === 'locked');
        assert.equal(pin.facility, !baseline && !hidden ? facility : null, `${scenario}/${id} facility visibility`);
        if (!baseline && !hidden) {
          assert(pin.image.width > 0 && pin.image.height > 0);
          assert(pin.image.src.startsWith('/assets/ui/map-facilities-'));
          assert(pin.filter.includes('facility-sticker-outline'), 'white silhouette contour missing');
          assert.equal(pin.shieldBackground, 'rgba(0, 0, 0, 0)', 'facility has a rectangular background');
          assert(pin.logicalTarget.every(n => n >= 44), 'logical target too small');
          if (!(device === 'portrait' && layout === 'normal')) assert(pin.target.width >= 44 && pin.target.height >= 44, 'touch target too small');
        }
        if (hidden) assert.equal(pin.caption, '？？？', 'locked place identity leaked');
      }
      if (scenario === 'chapter2' && !baseline && layout === 'normal') {
        const a = pins.find(p => p.id === 'trpg_bar').target;
        assert(pins.filter(p => p.id !== 'trpg_bar').every(({ target: b }) =>
          a.x+a.width <= b.x || b.x+b.width <= a.x || a.y+a.height <= b.y || b.y+b.height <= a.y), 'board-game cafe overlaps another destination');
      }
      const rotates = device === 'portrait' && layout === 'normal';
      if (rotates) assert(await page.locator('#rotate-hint').isVisible());
      if (scenario === 'day' || device === 'pc' && layout === 'normal') {
        await page.screenshot({ path: path.join(out, `${phase}-${device}-${layout}-${scenario}.jpg`), type: 'jpeg', quality: 80 });
      }
      if (scenario === 'day' && !rotates) {
        for (const id of Object.keys(expected)) {
          const pin = page.locator(`[data-test="pin-${id}"]`);
          await pin.scrollIntoViewIfNeeded();
          if (touch) await pin.tap(); else await pin.click();
          assert.equal(await pin.evaluate(p => p.classList.contains('sel')), true);
        }
        assert.equal(await page.evaluate(() => JSON.stringify(F.core.state)), saved, 'pin selection changes save');
      }
      cases.push({ scenario, pins, stateUnchanged: true, rotateHint: rotates });
    }
    if (!(device === 'portrait' && layout === 'normal')) {
      const pin = page.locator('[data-test="pin-axe_bar"]'); await pin.scrollIntoViewIfNeeded();
      if (touch) await pin.tap(); else await pin.click();
      const go = page.locator('[data-test="map-go"]'); await go.scrollIntoViewIfNeeded();
      if (touch) await go.tap(); else await go.click();
      assert.equal(await page.evaluate(() => window.mapFlow), 'axe_bar', 'legacy axe destination changed');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('qa-facility-sentinel')), '579');
    assert.deepEqual(errors, []); assert.deepEqual(resources, []);
    results.push({ device, viewport, layout, cases, errors, resources });
    console.log(`PASS ${phase}: ${device}/${layout} day/night/ch2/locked/legacy`);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(out, `${phase}.json`), JSON.stringify({ ref: process.env.TEST_REF || null, results }, null, 2) + '\n');
  await browser.close();
}
