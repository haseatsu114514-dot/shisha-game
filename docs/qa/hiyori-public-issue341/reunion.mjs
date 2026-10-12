// Focused public-site cases missing from the existing regression: reload mid-reunion and actual SKIP.
import assert from 'node:assert/strict';
import { suite } from '../../../remake/test/browser/support.mjs';

async function modules(page) {
  await page.evaluate(async () => {
    window.R = {
      core: await import('./js/core/state.js'), vn: await import('./js/vn/engine.js'),
      daily: await import('./js/daily/hiyori.js'), route: await import('./js/core/hiyori-route.js'),
      stats: await import('./js/core/stats.js'), ch1: await import('./js/chapters/ch1.js'),
    };
    R.ch1.setupHooks(); R.core.config.textSpeed = 4;
    R.vn.vnTest.turbo = false;
  });
}

await suite('reunion-readiness', async check => {
  for (const [label, options] of [
    ['pc', {}],
    ['mobile', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-interruption-skip-legacy`, async page => {
      await modules(page);
      await page.evaluate(() => {
        const s = R.core.newGame();
        Object.assign(s, { phase: 'daily', day: 9, slot: 0, money: 30000, seed: 131 });
        s.met.hiyori = s.met.sumi = true; s.contacts = ['hiyori','sumi']; s.affinity.hiyori = 33;
        Object.assign(s.flags, { _intro_hiyori: true, _hiyori_meeting_done: true,
          _hiyori_sumi_message_done: true, _hiyori_message_delivered: true, _hiyori_cracks_done: true,
          _hiyori_affinity_waiting_pts: 40 });
        R.core.save(); R.flow = R.daily.playHiyoriEvent('tonari_return');
      });
      await page.locator('#vn.active .vn-next.show').waitFor();
      await page.waitForTimeout(350);
      await (label === 'mobile' ? page.locator('.vn-box').tap() : page.locator('.vn-box').click());
      const unread = await page.evaluate(() => ({ done: !!R.core.state.flags._hiyori_tonari_return_done,
        points: R.core.state.affinity.hiyori, rescued: R.core.state.flags._hiyori_affinity_released_pts || 0 }));
      assert.deepEqual(unread, { done: false, points: 33, rescued: 0 });
      // Reload discards the running VN. Only the save from before entering the event can be restored.
      await page.reload();
      await page.locator('[data-test="title-new"]').waitFor();
      await page.locator('#boot').waitFor({ state: 'detached' });
      await modules(page);
      const restored = await page.evaluate(() => {
        const loaded = R.core.load(), s = R.core.state;
        return { loaded: !!loaded, done: !!s.flags._hiyori_tonari_return_done, points: s.affinity.hiyori,
          held: s.flags._hiyori_affinity_waiting_pts, status: R.route.hiyoriEventStatus('tonari_return') };
      });
      assert.deepEqual(restored, { loaded: true, done: false, points: 33, held: 40, status: 'ready' });
      await page.evaluate(() => { R.flow = R.daily.playHiyoriEvent('tonari_return'); });
      await page.locator('#vn.active .vn-next.show').waitFor();
      await (label === 'mobile' ? page.locator('[data-test="vn-skip"]').tap() : page.locator('[data-test="vn-skip"]').click());
      await page.waitForFunction(() => R.core.state.flags._hiyori_tonari_return_done, null, { timeout: 90000 });
      const completed = await page.evaluate(async () => {
        await R.flow;
        const s = R.core.state;
        const points = s.affinity.hiyori, duplicate = await R.daily.playHiyoriEvent('tonari_return');
        R.core.save(); R.core.load();
        return { points, duplicate, afterLoad: R.core.state.affinity.hiyori,
          rescued: s.flags._hiyori_affinity_released_pts, held: s.flags._hiyori_affinity_waiting_pts,
          known: !!s.flags._hiyori_real_self_known, work: !!s.flags._hiyori_work_talk_done };
      });
      assert.deepEqual(completed, { points: 56, duplicate: false, afterLoad: 56, rescued: 15, held: 40, known: false, work: false });
      const old = await page.evaluate(() => {
        const legacy = structuredClone(R.core.state);
        legacy.schema = 5; legacy.affinity.hiyori = 66;
        // A high old affinity is not evidence that the player read the new story.
        for (const k of Object.keys(legacy.flags)) if (k.startsWith('_hiyori_')) delete legacy.flags[k];
        localStorage.setItem('suien_remake_slot3', JSON.stringify(legacy));
        const loaded = R.core.loadFromSlot('suien_remake_slot3'), s = R.core.state;
        return { loaded: !!loaded, schema: s.schema, points: s.affinity.hiyori,
          inferred: Object.keys(s.flags).some(k => k.startsWith('_hiyori_')),
          known: !!s.flags._hiyori_real_self_known, work: !!s.flags._hiyori_work_talk_done,
          reunion: R.route.hiyoriEventStatus('tonari_return'), axe: R.route.hiyoriEventStatus('axe_reveal') };
      });
      assert.deepEqual(old, { loaded: true, schema: 12, points: 66, inferred: false, known: false, work: false,
        reunion: 'prerequisites', axe: 'missing_script' });
    }, options);
  }
});
