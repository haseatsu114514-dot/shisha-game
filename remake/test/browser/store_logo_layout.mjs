// #574: actual map layout, selection and save boundaries on PC and touch.
import assert from 'node:assert/strict';
import { suite, storageSnapshot } from './support.mjs';

await suite('store-logo-layout', async check => {
  for (const [device, viewport, touch] of [
    ['pc', { width: 1280, height: 720 }, false],
    ['touch', { width: 844, height: 390 }, true],
    ['narrow', { width: 591, height: 1280 }, false],
  ]) for (const [tod, slot] of [['day', 0], ['night', 1]]) {
    await check(`${device}-${tod}`, async page => {
      await page.evaluate(async ({ slot }) => {
        const core = await import('./js/core/state.js'), ui = await import('./js/core/ui.js');
        const map = await import('./js/daily/map.js'), hud = await import('./js/daily/hud.js');
        const fixture = core.newState();
        Object.assign(fixture, { schema: 11, phase: 'daily', day: 4, slot, money: 30000, seed: 574 });
        for (const id of ['naru', 'adam', 'minto', 'rin', 'tsumugi']) fixture.met[id] = true;
        Object.assign(fixture.flags, { _spot_guide_naru: true, _spot_guide_adam: true, _spot_guide_minto: true });
        localStorage.setItem(core.SAVE_KEY, JSON.stringify(fixture));
        core.load(); // Synthetic pre-schema12 save, through the real migration path.
        hud.initHud({}); hud.showHud(); await ui.warmUiArt();
        window.L = { core, ui, map, pending: null, moves: 0 };
        L.open = () => {
          map.interruptMap(null); ui.dropRetired();
          L.pending = map.chooseSpot({ eventPin: 'c_station', onBeforeGo: () => { L.moves++; return false; } });
        };
        L.open();
      }, { slot });
      await page.locator('.spot-pin.branded').first().waitFor();
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.spot-pin img')].map(i => i.decode())));
      const storage = await storageSnapshot(page);
      const state = await page.evaluate(() => JSON.stringify(L.core.state));
      const measurements = await page.evaluate(() => {
        const scale = document.querySelector('#stage').getBoundingClientRect().width / 1280;
        const box = node => node.getBoundingClientRect();
        const overlap = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) + .5
          && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + .5;
        return [...document.querySelectorAll('.spot-pin.branded')].map(pin => {
          const logo = pin.querySelector('.store-logo'), r = box(logo), s = box(pin.querySelector('.shield'));
          const decorations = [...pin.querySelectorAll('.pin-person,.evt-badge')];
          return { id: pin.dataset.spot, centerError: Math.abs(r.x + r.width / 2 - s.x - s.width / 2) / scale,
            clear: decorations.every(n => !overlap(r, box(n))) && decorations.every((a, i) => decorations.slice(i + 1).every(b => !overlap(box(a), box(b)))),
            contained: r.top >= s.top && r.bottom <= s.bottom,
            loaded: logo.querySelector('img').naturalWidth > 0 };
        });
      });
      assert.equal(measurements.length, 6); // 7 logo spots; choizap renders its facility icon instead (facility-icons precedence in map.js)
      assert(measurements.every(m => m.centerError < .1), JSON.stringify(measurements));
      assert(measurements.every(m => m.clear && m.contained && m.loaded));
      // Actual selection includes enlarged selected shields, people and badges.
      for (const id of ['shop', 'minto', 'c_station']) {
        const pin = page.locator(`[data-test="pin-${id}"]`);
        if (touch) await pin.tap(); else await pin.click();
        await page.waitForTimeout(180);
        assert(await pin.evaluate(n => n.classList.contains('sel')));
        assert(await pin.evaluate(n => {
          const l = n.querySelector('.store-logo').getBoundingClientRect(), s = n.querySelector('.shield').getBoundingClientRect();
          return Math.abs(l.x + l.width / 2 - s.x - s.width / 2) < .1;
        }));
      }
      // Vetoed entry must keep the map and resources, even with duplicate input.
      await page.locator('[data-test="map-go"]').click();
      assert.equal(await page.locator('.map').count(), 1);
      assert.equal(await page.evaluate(() => L.moves), 1);
      assert.equal(await page.evaluate(() => JSON.stringify(L.core.state)), state);
      assert.deepEqual(await storageSnapshot(page), storage);
      // Current-schema re-save and reload retain the same map rendering.
      await page.evaluate(() => { L.core.save(); L.core.load(); L.open(); });
      await page.locator('[data-test="pin-shop"] .store-logo').waitFor();
      assert.equal(await page.locator('.spot-pin.branded').count(), 6); // choizap: facility icon takes precedence (map.js)
      // No logo/name disclosure before the existing unlock condition is met.
      await page.evaluate(() => { delete L.core.state.flags._spot_guide_naru; L.open(); });
      await page.locator('.map:not(.done)').waitFor();
      assert.equal(await page.locator('[data-test="pin-c_station"]').count(), 0);
      // Leave a useful final screenshot with all brands unlocked.
      await page.evaluate(() => { L.core.state.flags._spot_guide_naru = true; L.open(); });
      await page.locator('[data-test="pin-c_station"] .store-logo').waitFor();
      // Exercise each real text mode before returning to the same map.
      // Short synthetic dialogue avoids claiming a chapter playthrough.
      if (tod === 'day' && device !== 'narrow') for (const mode of ['normal', 'auto', 'skip']) {
        const saved = await storageSnapshot(page);
        await page.evaluate(async mode => {
          const vn = await import('./js/vn/engine.js');
          L.core.config.textSpeed = 4; L.finished = false;
          L.dialogue = vn.play({ dialogue_id: `logo_layout_${mode}`, lines: [{ speaker: '', text: '地図へ戻る。' }] })
            .then(() => { L.finished = true; });
        }, mode);
        await page.locator('.vn-box').waitFor({ state: 'visible' });
        if (mode === 'normal') {
          await page.waitForTimeout(500);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(150);
          if (!(await page.evaluate(() => L.finished))) await page.keyboard.press('Enter');
        } else {
          const button = page.locator(`[data-test="vn-${mode}"]`);
          if (touch) await button.tap(); else await button.click();
        }
        await page.waitForFunction(() => L.finished);
        assert.equal(await page.locator('.spot-pin.branded').count(), 6); // choizap: facility icon takes precedence (map.js)
        const after = await storageSnapshot(page);
        const seenKey = 'suien_remake_seen_dialogue_lines';
        assert(JSON.parse(after.local[seenKey] || '[]').some(key => key.includes(`logo_layout_${mode}`)));
        // Reading dialogue intentionally persists its seen-line marker; map and save storage still stay unchanged.
        delete saved.local[seenKey];
        delete after.local[seenKey];
        assert.deepEqual(after, saved);
      }
    }, { viewport, isMobile: touch, hasTouch: touch });
  }
});
