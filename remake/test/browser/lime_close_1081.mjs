// #326: 本番LIME→マップ割り込み→夜の試飲→翌朝をPC/タッチで通す。
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
await suite('lime-close-1081', async check => {
  for (const [label, options, read, legacy] of [
    ['pc', {}, true, true],
    ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true, true],
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
      for (const step of (await import('./js/daily/tsumugi-schedule.js')).TSUMUGI_STORY) if (step.day <= 3) s.flags[step.flag] = true;
      s.met.minto = true; s.contacts.push('minto'); s.story.minto = 1;
      const m = QA.data.DB.lime.find(m => m.id === 'lime_minto_day4');
      s.inbox.push({ id: m.id, originId: m.id, day: 4, msg: structuredClone(m), read, done: legacy,
        replyState: legacy ? 'expired' : 'waiting', ...(legacy ? { result: 'expired' } : {}), log: [] });
      if (read) s.limeRead.push(m.id);
      Object.assign(s.inbox[0], { done: false, result: undefined, replyState: 'waiting' });
      for (const id of ['lime_minto_day5', 'lime_adam_day5']) {
        const msg = QA.data.DB.lime.find(m => m.id === id);
        if (msg) s.inbox.push({ id, originId: id, day: 4, msg: structuredClone(msg), read: false, done: false, log: [] });
      }
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
    const act = test => page.locator(`[data-test="${test}"]`)[options.hasTouch ? 'tap' : 'click']();
    await act('reply-0');
    // Leave during the sending animation, then reply to another message without travelling.
    await act('lime-back');
    await act('lime-chat-adam');
    await act('reply-0');
    await page.locator('[data-test="phone-next"]').waitFor();
    const waiting = await page.evaluate(() => {
      const s = QA.core.state;
      QA.core.saveToSlot('suien_remake_slot1');
      const saved = JSON.parse(localStorage.getItem('suien_remake_slot1'));
      return { day: s.day, slot: s.slot, money: s.money, pending: s.pendingInvite,
        complete: s.inbox[0].completed, saved, adam: s.inbox.find(i=>i.msg.sender==='adam') };
    });
    assert.equal(waiting.day, 4); assert.equal(waiting.slot, 1); assert.equal(waiting.money, 30000);
    assert(waiting.pending.awaitingLimeClose); assert(!waiting.complete); assert(waiting.adam.done);
    assert.deepEqual(waiting.saved.pendingInvite, waiting.pending);
    await act('phone-next');
    await act('phone-close');

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
    // Load the pre-close appointment through the real MENU (document reload).
    await act('hud-menu'); await act('menu-load'); await act('slot-1');
    await Promise.all([page.waitForEvent('load'), act('confirm-load')]);
    await page.locator('[data-test="phone-close"]').waitFor({ timeout: 30000 });
    const restored = await page.evaluate(async () => {
      const { state: s } = await import('./js/core/state.js');
      return { day: s.day, slot: s.slot, money: s.money, pending: s.pendingInvite, completed: s.inbox[0].completed };
    });
    assert.equal(restored.day, 4); assert.equal(restored.slot, 1); assert.equal(restored.money, 30000);
    assert(restored.pending.awaitingLimeClose); assert(!restored.completed);
    // Double press cannot resolve the close Promise twice.
    await page.locator('[data-test="phone-close"]').evaluate(b => { b.click(); b.click(); });
    await page.locator('.phone-overlay').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(async () => (await import('./js/core/state.js')).state.pendingInvite?.awaitingLimeClose), undefined);
    // Reload uses production pacing (turbo does not survive a document reload).
    await page.locator('[data-test="vn-auto"]').waitFor();
    await page.locator('.vn-text').waitFor();
    await act('vn-auto');
    assert.equal(await page.locator('[data-test="vn-auto"]').getAttribute('aria-pressed'), 'true');
    await act('vn-skip');
    assert.equal(await page.locator('[data-test="vn-skip"]').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(async () => (await import('./js/core/state.js')).state.money === 27000);


  }, options);
  await check('chapter-two-resume', async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const s = core.newGame();
      Object.assign(s, { chapter: 2, phase: 'daily', day: 18, slot: 0, money: 30000 });
      Object.assign(s.flags, { _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true },
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1, _morning_18: true });
      s.pendingInvite = { event: 'outing_minto_1', sender: 'minto', day: 18, slot: 0, awaitingLimeClose: true };
      core.saveToSlot('suien_remake_slot1'); core.loadFromSlot('suien_remake_slot1');
      (await import('./js/core/ui.js')).clearScreen();
      window.QA = { core };
      QA.run = (await import('./js/chapters/ch2-preparation.js')).runChapterTwoPreparation();
    });
    await page.locator('[data-test="phone-close"]').waitFor();
    assert.deepEqual(await page.evaluate(() => [QA.core.state.day, QA.core.state.slot, QA.core.state.money]), [18, 0, 30000]);
    await page.locator('[data-test="phone-close"]').click();
    await page.locator('.phone-overlay').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => QA.core.state.pendingInvite?.awaitingLimeClose), undefined);
  });

});
