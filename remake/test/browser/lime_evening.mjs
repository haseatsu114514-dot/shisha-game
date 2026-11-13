if (!process.env.CASE_FILTER || process.env.CASE_FILTER.startsWith("layout-")) await import("./lime_layout_2190.mjs");
// #326: 本番LIME→マップ割り込み→夜の試飲→翌朝をPC/タッチで通す。
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
if (!process.env.CASE_FILTER?.startsWith("layout-")) await suite('lime-evening', async check => {
  for (const [label, options, read, legacy] of [
    ['pc-unread', {}, false, false], ['pc-waiting', {}, true, false],
    ['touch-waiting', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true, false],
    ['touch-legacy-expired', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true, true],
  ]) await check(label, async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async ({ read, legacy }) => {
      const core = await import('./js/core/state.js');
      window.QA = { core, data: await import('./js/core/data.js'), vn: await import('./js/vn/engine.js'),
        ch1: await import('./js/chapters/ch1.js'), daily: await import('./js/daily/calendar.js'), ui: await import('./js/core/ui.js') };
      const s = core.newGame(); Object.assign(s, { phase: 'daily', day: 4, slot: legacy ? 1 : 0, money: 30000, stamina: 100 });
      Object.assign(s.flags, { _morning_4: true, _morning_5: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1, _intro_minto: true, known_name_minto: true, _lime_opened: true });
      // #814: 連絡先を交換した最初の会話（1本目）は読み終えている。読んでいなければ♥1へは上がらない。
      s.met.minto = true; s.contacts.push('minto'); s.story.minto = 1;
      const m = QA.data.DB.lime.find(m => m.id === 'lime_minto_day4');
      s.inbox.push({ id: m.id, originId: m.id, day: 4, msg: structuredClone(m), read, done: legacy,
        replyState: legacy ? 'expired' : 'waiting', ...(legacy ? { result: 'expired' } : {}), log: [] });
      if (read) s.limeRead.push(m.id);
      QA.ch1.setupHooks(); QA.vn.vnTest.turbo = true; QA.vn.vnTest.choose = () => 0;
      QA.vn.backlog().length = 0; QA.ui.clearScreen();
      if (legacy) { core.save(); core.load(); }
      // 固定夜があっても、営業中の店への夜行動は一回使える（固定会話はその後）。
      QA.run = QA.daily.runDaily({ nightEvents: { 4: { run: async () => { core.state.flags._qaNight = true; } } } });
    }, { read, legacy });
    await page.locator('[data-test="pin-rest"]').waitFor();
    if (!legacy) {
      await page.locator('[data-test="pin-rest"]').click(); await page.locator('[data-test="map-go"]').click();
      await page.waitForFunction(() => QA.core.state.slot === 1 && document.querySelector('#screen .map:not(.done)'));
    }
    await page.locator('[data-test="hud-phone"]').click();
    await page.locator('[data-test="lime-chat-minto"]').click();
    await page.locator('[data-test="reply-0"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.money), 30000);
    await assertFits(page, '[data-test="reply-0"], [data-test="reply-1"]');
    await page.locator('[data-test="reply-0"]').click();
    await page.locator('[data-test="phone-next"]').click(); await page.locator('[data-test="phone-close"]').click();
    await page.waitForFunction(() => QA.core.state.day === 5 && document.querySelector('#screen .map:not(.done)'));
    const result = await page.evaluate(() => {
      const s = QA.core.state, entries = QA.vn.backlog().filter(l => l.text.startsWith('夜のPEPPERMINT'));
      const msg = QA.data.DB.dialogues.interaction_minto_noon_01;
      QA.core.save(); const loaded = QA.core.load();
      return { money: s.money, affinity: s.affinity.minto, day: s.day, slot: s.slot, pending: s.pendingInvite,
        result: s.inbox[0].result, count: entries.length, canonical: msg.lines[0].text,
        afterLoad: { money: loaded.money, result: loaded.inbox[0].result, pending: loaded.pendingInvite } };
    });
    assert.equal(result.money, 27000); assert.equal(result.affinity, 13);
    assert.equal(result.day, 5); assert.equal(result.slot, 0); assert(!result.pending);
    assert.equal(result.result, 'accepted'); assert.equal(result.count, 1);
    assert(result.canonical.startsWith('昼下がり')); assert.deepEqual(result.afterLoad, { money: 27000, result: 'accepted', pending: null });
  }, options);
});
