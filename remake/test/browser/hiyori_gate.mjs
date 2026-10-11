// #320: 本番の好感度・台本・LIME・日常・保存をPCとタッチで検証。
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
async function setup(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    window.H = { core: await import('./js/core/state.js'), stats: await import('./js/core/stats.js'),
      data: await import('./js/core/data.js'), route: await import('./js/core/hiyori-route.js'),
      phone: await import('./js/daily/phone.js'), daily: await import('./js/daily/calendar.js'),
      hiyori: await import('./js/daily/hiyori.js'), spots: await import('./js/daily/spots.js'),
      ch1: await import('./js/chapters/ch1.js'), vn: await import('./js/vn/engine.js'), ui: await import('./js/core/ui.js') };
    H.ch1.setupHooks(); H.vn.vnTest.turbo = true; H.vn.vnTest.choose = () => 0;
    H.fresh = () => {
      const s = H.core.newGame();
      Object.assign(s, { phase: 'daily', day: 9, slot: 1, seed: 131, money: 30000, stamina: 100, lastBaitoDay: 9 });
      Object.assign(s.flags, { _morning_9: true, _morning_10: true, _delivery_minto_done: true,
        _delivery_adam_done: true, _errand_scout_done: true, _lime_tut: 1, _hiyori_meeting_done: true,
        _hiyori_sumi_message_done: true, _hiyori_message_delivered: true, _hiyori_cracks_done: true,
        _intro_hiyori: true, known_name_hiyori: true });
      s.met.hiyori = s.met.naru = s.met.adam = s.met.minto = true;
      s.contacts = ['hiyori']; s.affinity.hiyori = 33;
      return s;
    };
    H.fresh();
  });
}
await suite('hiyori-gate', async check => {
  for (const [label, options] of [['pc', {}], ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-gate-rescue-save`, async page => {
      await setup(page);
      const results = await page.evaluate(async () => {
        const rows = [];
        for (const start of [30, 33, 47, 66]) {
          let s = H.fresh(); s.affinity.hiyori = start; s.fortune = { char: 'hiyori' };
          s.stats.charm = 100;
          for (let n = 0; n < 20; n++) H.stats.gainAffinity('hiyori', 10);
          const locked = s.affinity.hiyori, held = s.flags._hiyori_affinity_waiting_pts, carry = s.affinityCarry.hiyori;
          H.core.save(); H.core.load(); s = H.core.state;
          const beforeRead = H.stats.releaseHiyoriAffinity();
          H.vn.backlog().length = 0;
          const read = await H.hiyori.playHiyoriEvent('tonari_return');
          const after = s.affinity.hiyori, rescued = s.flags._hiyori_affinity_released_pts;
          const duplicate = await H.hiyori.playHiyoriEvent('tonari_return');
          H.core.save(); H.core.load();
          const again = H.stats.releaseHiyoriAffinity();
          rows.push({ start, locked, held, carry, beforeRead, read, after, rescued, duplicate, again,
            final: H.core.state.affinity.hiyori, done: H.core.state.flags._hiyori_tonari_return_done,
            retained: H.core.state.flags._hiyori_affinity_waiting_pts, fortuneUsed: !H.core.state.fortune });
        }
        let s = H.fresh(); H.stats.ensureAffinityLevel('hiyori', 4);
        const guaranteed = s.flags._hiyori_affinity_waiting_pts;
        H.stats.ensureAffinityLevel('hiyori', 4);
        const guarantee = { points: s.affinity.hiyori, guaranteed, again: s.flags._hiyori_affinity_waiting_pts };
        s = H.fresh(); s.lovers = ['hiyori']; s.loveLevel.hiyori = 1;
        H.stats.bond.private = true; H.stats.gainAffinity('hiyori', 10); H.stats.bond.private = false;
        const lover = s.lovePts.hiyori;
        H.stats.gainAffinity('minto', 10);
        return { rows, guarantee, lover, minto: s.affinity.minto };
      });
      for (const r of results.rows) {
        assert.equal(r.locked, Math.max(r.start, 33)); assert(r.held > 100);
        assert.equal(r.beforeRead, 0); assert(r.read && r.done && r.fortuneUsed);
        assert(r.rescued >= 0 && r.rescued <= 15); assert.equal(r.retained, r.held);
        if (r.start < 48) assert(r.after >= 48 && r.after < 66, JSON.stringify(r));
        assert(!r.duplicate); assert.equal(r.again, 0); assert.equal(r.final, r.after);
      }
      assert.deepEqual(results.guarantee, { points: 33, guaranteed: 15, again: 15 });
      assert.equal(results.lover, 5); assert.equal(results.minto, 8);
    }, options);
    await check(`${label}-lime-paid-visit`, async page => {
      await setup(page);
      const eligibility = await page.evaluate(() => {
        const s = H.core.state, find = opts => H.phone.morningMessages(opts).find(m => m.accept_event === '__hiyori_shop__');
        const before = !!find(); s.flags._hiyori_tonari_return_done = true;
        const m = find();
        const tournament = !!find({ tournamentDay: true }), fixed = !!find({ fixedNight: () => true });
        s.pendingInvite = { event: 'other', day: 9, slot: 1 }; const booked = !!find(); s.pendingInvite = null;
        s.inbox = [{ id: 'unread', day: 9, msg: { sender: 'hiyori' }, read: false }]; const unread = !!find(); s.inbox = [];
        s.inbox = [{ id: 'other', day: 9, msg: { sender: 'minto', type: 'invitation', time_slot: 'night' }, read: true, done: false }];
        const other = !!find(); s.inbox = [];
        H.phone.deliverMorning(); const repeat = !!find();
        const saved = structuredClone(s.inbox); H.core.save(); H.core.load();
        return { before, m, tournament, fixed, booked, unread, other, repeat, saved };
      });
      assert(!eligibility.before && eligibility.m && !eligibility.tournament && !eligibility.fixed);
      assert(!eligibility.booked && !eligibility.unread && !eligibility.other && !eligibility.repeat);
      assert(eligibility.m.messages[0].includes('PEPPERMINT')); assert.equal(eligibility.saved.length, 1);
      await page.evaluate(() => { H.ui.clearScreen(); H.run = H.daily.runDaily({ nightEvents: {} }); });
      await page.locator('[data-test="pin-rest"]').waitFor();
      await page.locator('[data-test="hud-phone"]').click(); await page.locator('[data-test="lime-chat-hiyori"]').click();
      await page.locator('[data-test="reply-0"]').waitFor();
      await assertFits(page, '[data-test="reply-0"], [data-test="reply-1"]');
      await page.locator('[data-test="reply-0"]').click();
      await page.locator('[data-test="phone-next"]').waitFor();
      const pending = await page.evaluate(() => ({ money: H.core.state.money, pts: H.core.state.affinity.hiyori,
        day: H.core.state.day, inv: H.core.state.pendingInvite }));
      assert.equal(pending.money, 30000); assert.equal(pending.pts, 33); assert.equal(pending.day, 9);
      assert.equal(pending.inv.visitSpot, 'minto');
      await page.locator('[data-test="phone-next"]').click(); await page.locator('[data-test="phone-close"]').click();
      await page.waitForFunction(() => H.core.state.day === 10 && document.querySelector('#screen .map:not(.done)'));
      const after = await page.evaluate(() => {
        H.core.save(); H.core.load(); const s = H.core.state;
        s.day = 12; const cooldown = H.phone.morningMessages().some(m => m.accept_event === '__hiyori_shop__'); s.day = 10;
        return { money: s.money, pts: s.affinity.hiyori, count: s.flags._hiyori_repeat_count,
          visit: s.visitedDay.minto, pending: s.pendingInvite, cooldown };
      });
      assert.deepEqual(after, { money: 27000, pts: 41, count: 1, visit: 9, pending: null, cooldown: false });
    }, options);
  }
});
