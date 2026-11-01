import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite } from './support.mjs';

const artifacts = process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
const summaries = [];
const cases = ['explanation-interrupted', 'intro-done-before-draw',
  'committed-during-spin', 'existing-pending-results', 'legacy-no-explicit-flag'];

// These are real UI steps, with bounded polling. No LOAD/calendar/install stubs.
async function tap(page, selector, touch) {
  const target = page.locator(selector);
  await (touch ? target.tap() : target.click());
}
async function loadTitle(page, touch) {
  await page.reload({ waitUntil: 'load' });
  await page.locator('#boot').waitFor({ state: 'detached' });
  // Use the player's instant-text preference; keep real cut-ins and UI input.
  await page.evaluate(async () => { (await import('./js/core/state.js')).config.textSpeed = 4; });
  await tap(page, '[data-test="title-load"]:not([disabled])', touch);
  await tap(page, '[data-test="slot-0"]', touch);
}
async function advanceDialogue(page, touch) {
  // The receipt includes first-meeting cut-ins and portrait entrances. Wait for
  // the real dialogue's next marker instead of spending the polling budget on
  // inputs ignored during those transitions or the typewriter animation.
  if (await page.locator('#vn.active').isVisible()) {
    await page.waitForFunction(() => !document.querySelector('#vn.active')
      || document.querySelector('#vn.active .vn-next.show')
      || [...document.querySelectorAll('.vn-choice')].some(node => node.getClientRects().length));
  }
  const choices = page.locator('.vn-choice:visible');
  if (await choices.count()) {
    const register = choices.filter({ hasText: /登録|参加|お願い/ });
    assert.equal(await register.count(), 1, 'Unexpected receipt choice; do not silently choose a branch');
    await (touch ? register.tap() : register.click());
  } else if (await page.locator('#vn.active .vn-box').isVisible()) {
    if (touch) await page.locator('.vn-box').tap();
    else await page.keyboard.press('Enter');
  }
}
async function receiptToIntro(page, touch) {
  // #834: the fresh DAY2 now reads both real delivery requests before registration.
  // Advance the VN through the UI; do not fabricate told/done flags to reach the map.
  const receiptPin = page.locator('[data-test="pin-c_station"]');
  for (let n = 0; n < 400 && !(await receiptPin.isVisible()); n++) {
    await advanceDialogue(page, touch);
    await page.waitForTimeout(80);
  }
  await receiptPin.waitFor();
  const briefing = await page.evaluate(async () => {
    const s = (await import('./js/core/state.js')).state;
    return { started: !!s.flags._delivery_batch_started,
      mintoTold: !!s.flags._delivery_minto_told, adamTold: !!s.flags._delivery_adam_told,
      mintoDone: !!s.flags._delivery_minto_done, adamDone: !!s.flags._delivery_adam_done,
      day: s.day, slot: s.slot, money: s.money, stamina: s.stamina };
  });
  assert.deepEqual(briefing, { started: true, mintoTold: true, adamTold: true,
    mintoDone: false, adamDone: false, day: 2, slot: 0, money: 10000, stamina: 80 },
  'Both requests must be read before the free registration, without delivering or paying');
  await tap(page, '[data-test="pin-c_station"]', touch);
  await tap(page, '[data-test="map-go"]', touch);
  for (let n = 0; n < 200; n++) {
    if (await page.locator('[data-test="reel-intro"]').isVisible()) return;
    if (await page.locator('[data-test="rule-sheet"]').isVisible()) {
      assert.match(await page.locator('[data-test="rule-sheet"]').innerText(), /レモン.*2g以上/);
      await tap(page, '[data-test="rule-sheet-close"]', touch);
    }
    await advanceDialogue(page, touch);
    await page.waitForTimeout(80);
  }
  assert.fail('Actual C.STATION receipt did not reach installation intro');
}
async function readIntro(page, touch) {
  const intro = page.locator('[data-test="reel-intro"]');
  await intro.waitFor();
  const countBefore = await page.evaluate(async () =>
    (await import('./js/core/state.js')).state.reel.count);
  // Five text pages followed by the guide. Observe the current page: receipt
  // input may already have advanced it. Each input must transition once; no retries.
  for (let i = 0; i < 6; i++) {
    const shown = await intro.evaluate(root => ({
      text: root.querySelector('.ri-text')?.textContent,
      guide: !!root.querySelector('[data-test="reel-guide-card"]'),
    }));
    if (shown.guide) {
      await page.locator('[data-test="reel-guide-card"]').waitFor();
      assert.equal(await page.evaluate(async () =>
        (await import('./js/core/state.js')).state.reel.count), countBefore,
      'Drew before explanation/guide finished');
      await tap(page, '[data-test="reel-intro"]', touch);
      await intro.waitFor({ state: 'detached' });
      return;
    }
    assert(shown.text?.trim(), 'Missing intro text before guide');
    await tap(page, '[data-test="reel-intro"]', touch);
    await page.waitForFunction(previous => {
      const root = document.querySelector('[data-test="reel-intro"]');
      return !!root && (!!root.querySelector('[data-test="reel-guide-card"]')
        || root.querySelector('.ri-text')?.textContent !== previous);
    }, shown.text);
  }
  assert.fail('Intro exceeded five text pages without reaching the guide');
}
async function mintoNext(page, touch) {
  // Only advance the delivery instruction; never select/perform a delivery.
  for (let n = 0; n < 250; n++) {
    if (await page.locator('.spot-pin.guide[data-spot="minto"]').isVisible()) return;
    assert.equal(await page.locator('[data-test="map-guide"]').filter({ hasText: '参加登録' }).count(), 0,
      'LOAD replayed registration');
    await advanceDialogue(page, touch);
    await page.waitForTimeout(80);
  }
  assert.fail('LOAD did not reach Minto as the next delivery within 20 seconds');
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const { state: s } = await import('./js/core/state.js');
    return { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina,
      visits: s.spotVisits.c_station, visitedDay: s.visitedDay.c_station ?? null,
      registered: s.flags._c_station_registered, pendingFirst: !!s.flags._pakki_first_spin_pending,
      intro: s.reel.introDone, seed: s.reel.seed, count: s.reel.count,
      pending: s.reel.pending.length, stats: { ...s.stats }, xp: { ...s.statXp },
      note: structuredClone(s.reel.note), lock: structuredClone(s.reel.lock),
      lastChapter: s.reel.lastChapter, setting: s.reel.setting,
      mintoDone: !!s.flags._delivery_minto_done, adamDone: !!s.flags._delivery_adam_done };
  });
}

await suite('reel-registration-load', async check => {
  for (const touch of [false, true]) for (const boundary of cases) {
    const label = `${touch ? 'touch' : 'pc'}-${boundary}`;
    await check(label, async page => {
      await page.evaluate(async () => {
        const core = await import('./js/core/state.js');
        const s = core.newGame();
        Object.assign(s, { phase: 'daily', day: 2, slot: 0, money: 10000, stamina: 80 });
        Object.assign(s.flags, { _errand_shop_done: true, _errand_naru_visited: true,
          _errand_scout_done: true, _spot_guide_naru: true, _delivery_schedule_v2: true,
          _morning_2: true, _lime_tut: true, _lime_opened: true,
          _tsumugi_contest_research: true });
        s.affinity.tsumugi = 25;
        s.story.naru = 1; s.met.naru = true;
        for (const key of core.STAT_KEYS) { s.stats[key] = 10; s.statXp[key] = 0; }
        s.reel.seed = 1; // Fixed result, no search for convenient outcomes.
        core.save();
      });
      await loadTitle(page, touch);
      await receiptToIntro(page, touch);
      const receipt = await snapshot(page);
      assert.equal(receipt.registered, true);
      assert.equal(receipt.pendingFirst, true);
      assert.equal(receipt.visits, 1);
      assert.equal(receipt.visitedDay, null);
      assert.equal(receipt.count, 0);
      for (const [key, value] of Object.entries({ day: 2, slot: 0, money: 10000, stamina: 80 })) {
        assert.equal(receipt[key], value, `Free receipt changed ${key}`);
      }
      const expected = await page.evaluate(async () => {
        const { state } = await import('./js/core/state.js');
        const { core } = await import('./js/daily/reel.js');
        const copy = structuredClone(state.reel);
        const results = core.spinSeries(copy, { chapterFirst: true, reset: true });
        return { count: copy.count, exp: results.reduce((n, r) => n + r.exp, 0), lock: copy.lock };
      });
      assert(expected.exp < 38, 'Fixture must stay below the stat cap');

      // The first case reloads the actual receipt-produced checkpoint, unmodified.
      // Other cases explicitly isolate saved boundaries, rather than claiming UI reachability.
      if (boundary === 'intro-done-before-draw' || boundary === 'legacy-no-explicit-flag') {
        await page.evaluate(async boundary => {
          const core = await import('./js/core/state.js'), s = core.state;
          s.reel.introDone = s.reel.settingGuideDone = true;
          if (boundary === 'legacy-no-explicit-flag') {
            delete s.flags._pakki_first_spin_pending;
            s.visitedDay.c_station = 1;
          }
          core.save();
        }, boundary);
      } else if (boundary === 'existing-pending-results') {
        await page.evaluate(async () => {
          const core = await import('./js/core/state.js');
          const reel = await import('./js/daily/reel.js');
          // A previously committed action result already paid. Keep explicit intro pending.
          reel.onAction({ spent: 10 });
          core.state.visitedDay.c_station = 1;
          core.save();
        });
      } else if (boundary === 'committed-during-spin') {
        await readIntro(page, touch);
        await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
      }
      const beforeLoad = await page.evaluate(async () => {
        const core = await import('./js/core/state.js');
        return JSON.parse(localStorage.getItem(core.SAVE_KEY));
      });
      if (boundary === 'committed-during-spin') {
        assert.equal(beforeLoad.reel.count, expected.count);
        assert(!beforeLoad.flags._pakki_first_spin_pending);
      }
      if (boundary === 'existing-pending-results') assert(beforeLoad.reel.pending.length > 0);

      // Production title LOAD -> chapter resume -> runDaily. Never invoke installReel here.
      await loadTitle(page, touch);
      if (boundary === 'explanation-interrupted' || boundary === 'existing-pending-results') {
        await page.locator('[data-test="reel-intro"]').waitFor();
        const during = await snapshot(page);
        assert.equal(during.count, beforeLoad.reel.count, 'Drew before explanation finished');
        assert.deepEqual(during.stats, beforeLoad.stats);
        assert.equal(await page.locator('.spot-pin.guide[data-spot="minto"]').isVisible(), false);
        await readIntro(page, touch);
      }
      if (boundary === 'explanation-interrupted') {
        // A second real interruption: resumed intro finished and first payout committed,
        // but installReel is still awaiting presentation. Its explicit pending flag is gone.
        await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
        const committed = await page.evaluate(async () => {
          const core = await import('./js/core/state.js');
          return JSON.parse(localStorage.getItem(core.SAVE_KEY));
        });
        assert.equal(committed.visitedDay.c_station, undefined, 'First-spin commitment must leave the customer visit available');
        assert(!committed.flags._pakki_first_spin_pending);
        assert.equal(committed.reel.count, expected.count);
        assert.equal(Object.values(committed.stats).reduce((a, b) => a + b, 0)
          - Object.values(receipt.stats).reduce((a, b) => a + b, 0), expected.exp);
        await loadTitle(page, touch);
        await mintoNext(page, touch);
        const resumed = await snapshot(page);
        assert.equal(resumed.visitedDay, null);
        assert.equal(resumed.count, committed.reel.count, 'Second interruption redrew first spin');
        assert.deepEqual(resumed.stats, committed.stats, 'Second interruption changed payout');
        assert.deepEqual(resumed.xp, committed.statXp);
        assert.deepEqual(resumed.note, committed.reel.note);
      }
      await mintoNext(page, touch);
      const after = await snapshot(page);
      for (const key of ['day', 'slot', 'money', 'stamina']) assert.equal(after[key], receipt[key], key);
      assert.equal(after.visits, 1, 'Replayed the receipt visit');
      assert.equal(after.registered, true);
      assert.equal(after.intro, true);
      assert.equal(after.pendingFirst, false);
      assert.equal(after.pending, 0);
      assert.equal(after.mintoDone, false); assert.equal(after.adamDone, false);
      assert.equal(after.seed, 1);
      assert.equal(after.visitedDay, beforeLoad.visitedDay.c_station ?? null);
      const customerAccess = await page.evaluate(async () => {
        const { spotAvailability } = await import('./js/daily/spot-access.js');
        const { spotById } = await import('./js/daily/spots.js');
        return spotAvailability(spotById('c_station'));
      });
      assert.equal(customerAccess.ok, true, `Registration blocked a same-day customer visit: ${customerAccess.why}`);
      if (boundary === 'legacy-no-explicit-flag') {
        assert.equal(after.count, 0, 'Inferred a first spin for a legacy installed save');
        assert.deepEqual(after.stats, receipt.stats);
        assert.deepEqual(after.xp, receipt.xp);
      } else {
        assert.equal(after.count, expected.count, 'Lost or duplicated the first series');
        assert.deepEqual(after.lock, expected.lock, 'Changed deterministic next-spin state');
        const gain = Object.values(after.stats).reduce((a, b) => a + b, 0)
          - Object.values(receipt.stats).reduce((a, b) => a + b, 0);
        assert.equal(gain, expected.exp, 'Lost or duplicated first-spin payout');
        if (beforeLoad.reel.count > 0) {
          assert.deepEqual(after.stats, beforeLoad.stats, 'Repaid a committed result');
          assert.deepEqual(after.xp, beforeLoad.statXp);
          assert.deepEqual(after.note, beforeLoad.reel.note);
        }
      }
      await loadTitle(page, touch);
      await mintoNext(page, touch);
      assert.deepEqual(await snapshot(page), after, 'Repeat production LOAD changed rewards/bookkeeping');
      summaries.push({ label, checkpoint: boundary === 'explanation-interrupted' ? 'actual receipt' : 'isolated boundary', after });
    }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});
  }
});
fs.mkdirSync(artifacts, { recursive: true });
fs.writeFileSync(path.join(artifacts, 'reel-registration-load-state.json'), JSON.stringify(summaries, null, 2) + '\n');
