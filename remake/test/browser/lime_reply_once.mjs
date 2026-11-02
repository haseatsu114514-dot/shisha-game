// #673: normal replies through the production HUD/thread, using real click/tap only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, assertFits } from './support.mjs';

const id = 'lime_minto_day5';
const replyText = 'お店では余裕なんですね';
const responseText = '……あれは、お店の顔だから。はじめくんにだけ、内緒ね';
const out = path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser');
fs.mkdirSync(out, { recursive: true });
const measurements = [];
const control = (page, test) => page.locator(`[data-test="${test}"]`);
const expectedGain = .2125;
const expectedNote = '♡ ほんの少し仲良くなった';
const snap = page => page.evaluate(() => {
  const s = QA.core.state, item = s.inbox.find(i => i.id === 'lime_minto_day5');
  return { affinity: s.affinity.minto, carry: s.affinityCarry.minto,
    item: JSON.parse(JSON.stringify(item)), limeRead: [...s.limeRead],
    peer: [...document.querySelectorAll('.lime-row.peer:not(.typing) .lime-bubble')].map(n => n.textContent.trim()),
    mine: [...document.querySelectorAll('.lime-row.me .lime-bubble')].map(n => n.textContent.trim()),
    notes: [...document.querySelectorAll('.lime-chat .lime-note')].map(n => n.textContent.trim()),
    replies: [...document.querySelectorAll('.lime-actions .lime-reply')].map(n => n.textContent.trim()) };
});

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'), data = await import('./js/core/data.js');
    const s = core.newGame();
    Object.assign(s, { phase: 'daily', chapter: 1, day: 5, slot: 0, money: 30000, stamina: 100, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true,
      _delivery_minto_done: true, _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    s.met.minto = true; s.contacts.push('minto'); s.affinity.minto = 10; s.affinityCarry.minto = .5;
    const msg = structuredClone(data.DB.lime.find(m => m.id === 'lime_minto_day5'));
    s.inbox = [{ id: msg.id, originId: msg.id, day: 5, msg, read: false, done: false, replyState: 'waiting', log: [] }];
    s.limeRead = []; core.save(); core.load();
    window.QA = { core, clicks: [], start: performance.now() };
    document.addEventListener('click', e => {
      const b = e.target.closest?.('button');
      if (b?.dataset.test) QA.clicks.push({ test: b.dataset.test, trusted: e.isTrusted, t: performance.now() - QA.start });
    }, true);
    (await import('./js/chapters/ch1.js')).setupHooks();
    (await import('./js/core/ui.js')).clearScreen();
    QA.daily = (await import('./js/daily/calendar.js')).runDaily({ untilDay: 14, nightEvents: {} })
      .catch(e => { QA.error = String(e.stack || e); });
  });
  await page.locator('.map:not(.done)').waitFor();
}

function assertOnce(value) {
  assert.equal(value.affinity, 10); assert(Math.abs(value.carry - (.5 + expectedGain)) < 1e-9);
  assert(value.item.read && value.item.done); assert.equal(value.item.replyState, 'replied');
  assert.deepEqual(value.item.log, [{ me: true, text: replyText }, { me: false, text: responseText }]);
  assert.equal(value.limeRead.filter(x => x === id).length, 1);
}

try {
  await suite('lime-reply-once', async check => {
    for (const [kind, label] of [['default', null], ['short', '……誰？'], ['long', '……はい。ありがとうございます、スミさん']]) {
      await check(`story-close-${kind}-1180`, async page => {
        await page.evaluate(async label => {
          const core = await import('./js/core/state.js');
          core.newGame(); core.config.bgmVolume = 0; core.config.seVolume = 0;
          (await import('./js/core/ui.js')).showScreen('home', document.createElement('div'));
          window.storyPhoneClosed = false;
          void (await import('./js/daily/phone.js')).openPhone([
            { id: 'story-close-layout', sender: 'sumi', messages: ['お疲れさま'], close_label: label },
          ], { title: '表彰式のあと', time: 'PM 10:18' }).then(() => { storyPhoneClosed = true; });
        }, label);
        const button = control(page, 'phone-next');
        await button.waitFor();
        assert.equal(await button.textContent(), label || 'スマホを閉じる');
        const fit = await button.evaluate(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const box = node.getBoundingClientRect(), style = getComputedStyle(node), lines = [...range.getClientRects()];
          return { whiteSpace: style.whiteSpace, ellipsis: style.textOverflow === 'ellipsis', lines: lines.length,
            inside: lines.every(r => r.left >= box.left && r.right <= box.right + 1 && r.top >= box.top && r.bottom <= box.bottom + 1),
            overflow: node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1 };
        });
        assert.equal(fit.whiteSpace, label ? 'normal' : 'nowrap');
        if (label) assert.equal(fit.ellipsis, false);
        assert.equal(fit.overflow, false); assert(fit.inside);
        assert.equal(fit.lines > 1, kind === 'long', 'long closing reply wraps while short controls stay one line');
        await assertFits(page, '[data-test="phone-next"]');
        await button.click(); await page.waitForFunction(() => storyPhoneClosed);
        assert.equal(await page.locator('.phone-overlay').count(), 0);
      }, { viewport: { width: 1180, height: 740 }, reducedMotion: 'reduce' });
    }
    const cases = [
      ['pc-single', 'single', {}],
      ['pc-send-reenter', 'send', {}],
      ['pc-typing-reenter', 'typing', {}],
      ['pc-response-reenter', 'response', {}],
      ['pc-close-reopen', 'close', {}],
      ['pc-abandon-choice', 'abandon', {}],
      ['touch-typing-reenter', 'typing', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
    ];
    for (const [name, mode, options] of cases) await check(name, async page => {
      page.setDefaultTimeout(15000);
      await setup(page);
      const act = locator => locator[options.hasTouch ? 'tap' : 'click']();
      const open = async () => { await act(control(page, 'hud-phone')); await act(control(page, 'lime-chat-minto')); };
      await open();
      await page.getByRole('button', { name: replyText, exact: true }).waitFor();
      const before = await snap(page);
      assert.equal(before.affinity, 10); assert(Math.abs(before.carry - .5) < 1e-9);
      assert.equal(before.item.done, false); assert.deepEqual(before.item.log, []);
      if (mode === 'abandon') {
        await act(control(page, 'lime-back')); await act(control(page, 'lime-chat-minto'));
        await page.getByRole('button', { name: replyText, exact: true }).waitFor();
        const abandoned = await snap(page);
        assert.equal(abandoned.affinity, 10); assert(Math.abs(abandoned.carry - .5) < 1e-9);
        assert.equal(abandoned.item.done, false);
      }
      await act(page.getByRole('button', { name: replyText, exact: true }));
      if (mode !== 'single' && mode !== 'abandon') {
        if (mode === 'typing' || mode === 'close') await page.locator('.lime-row.peer.typing').waitFor();
        if (mode === 'response') await page.getByText(responseText, { exact: true }).waitFor();
        await act(control(page, 'lime-back'));
        if (mode === 'close') { await act(control(page, 'phone-close')); await page.locator('.phone-overlay').waitFor({ state: 'detached' }); await open(); }
        else await act(control(page, 'lime-chat-minto'));
        // Try the same real button if a regression exposed it; no direct handler calls.
        const again = page.getByRole('button', { name: replyText, exact: true });
        if (await again.isVisible()) await act(again);
      }
      await control(page, 'phone-next').waitFor();
      await page.waitForTimeout(1200); // Observe completion of stale production waits too.
      const after = await snap(page);
      assertOnce(after);
      assert.equal(after.mine.filter(x => x === replyText).length, 1);
      assert.equal(after.peer.filter(x => x === responseText).length, 1);
      assert.equal(after.notes.filter(x => x === expectedNote).length, mode === 'single' || mode === 'abandon' ? 1 : 0);
      assert.equal(await page.getByRole('button', { name: replyText, exact: true }).count(), 0);
      await page.screenshot({ path: path.join(out, name + '.png') });
      await act(control(page, 'phone-next')); await act(control(page, 'lime-chat-minto'));
      await control(page, 'phone-next').waitFor();
      const reopened = await snap(page);
      assertOnce(reopened);
      assert.equal(reopened.notes.filter(x => x === expectedNote).length, 0);
      await act(control(page, 'phone-next')); await act(control(page, 'phone-close'));
      await page.locator('.phone-overlay').waitFor({ state: 'detached' });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(QA.core.SAVE_KEY)));
      assertOnce({ affinity: saved.affinity.minto, carry: saved.affinityCarry.minto,
        item: saved.inbox.find(i => i.id === id), limeRead: saved.limeRead });
      const clicks = await page.evaluate(() => QA.clicks);
      assert(clicks.every(c => c.trusted));
      assert.equal(clicks.filter(c => c.test === 'reply-1').length, 1);
      assert.equal(await page.evaluate(() => QA.error || null), null);
      measurements.push({ name, before, after, saved: { affinity: saved.affinity.minto, carry: saved.affinityCarry.minto,
        item: saved.inbox.find(i => i.id === id), limeRead: saved.limeRead }, clicks });
    }, { reducedMotion: 'no-preference', ...options });
  });
} finally {
  fs.writeFileSync(path.join(out, 'lime-reply-once-measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
}
