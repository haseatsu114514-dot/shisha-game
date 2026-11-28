import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { baseURL, suite } from './support.mjs';

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
    await advanceDialogue(page, touch);
    await page.waitForTimeout(80);
  }
  assert.fail('Actual C.STATION receipt did not reach installation intro');
}
async function readIntro(page, touch, keyboard = false) {
  const intro = page.getByRole('dialog', { name: 'MOKUMOKUパッキーの説明' });
  await intro.waitFor();
  const next = intro.locator('[data-test="reel-intro-next"]');
  assert(await next.evaluate(b => b === document.activeElement));
  const countBefore = await page.evaluate(async () =>
    (await import('./js/core/state.js')).state.reel.count);
  assert.equal(await intro.getByRole('button', { name: '次へ' }).count(), 1);
  if (!touch) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert(await next.evaluate(b => b === document.activeElement), 'Tab must not leave the explanation');
  }
  // A stale receipt input, a double click or a held key must leave the auto-spin line visible.
  assert.match(await intro.locator('.ri-text').innerText(), /ボクはパッキー.*インストール完了/);
  if (touch) await next.tap();
  else if (keyboard) {
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
  } else await next.dblclick();
  assert.match(await intro.locator('.ri-text').innerText(), /かってに1回転.*ボクの顔をタップ/);
  assert.equal(await page.evaluate(async () =>
    (await import('./js/core/state.js')).state.reel.count), countBefore,
  'Drew before the explanation finished');
  const close = intro.getByRole('button', { name: '説明を閉じる' });
  if (touch) await close.tap();
  else await close.press('Space');
  await intro.waitFor({ state: 'detached' });
}
// 登録のついでの配達（#3819）で入った手当・経験値。初回の当たりの支払いと分けて数えるため、案内の前後の差を足し込む。
let errandGain = null;
const emptyGain = () => ({ money: 0, growthXp: 0, stats: {}, xp: {} });
const addDiff = (into, after, before) => {
  for (const key of Object.keys(after)) into[key] = (into[key] || 0) + (after[key] || 0) - (before[key] || 0);
};
const minus = (value, gain) => Object.fromEntries(Object.entries(value).map(([key, n]) => [key, n - (gain[key] || 0)]));
async function noonMapNext(page, touch) {
  // #3819: after registration, DAY2 continues with the errand deliveries ("登録のついで"): the map guides
  // PEPPERMINT, then EDEN, then one report at tonari. Then the noon is the player's own action, and there is no
  // fixed night shift. Only follow the guided pins and advance dialogue here; never choose a free destination.
  let before = null;
  for (let n = 0; n < 400; n++) {
    assert.equal(await page.locator('[data-test="map-guide"]').filter({ hasText: '参加登録' }).count(), 0,
      'LOAD replayed registration');
    for (const id of ['minto', 'adam']) {
      if (await page.locator(`.map:not(.done) .spot-pin.guide[data-spot="${id}"]`).isVisible()) {
        before ||= await snapshot(page);
        await tap(page, `[data-test="pin-${id}"]`, touch);
        await tap(page, '[data-test="map-go"]', touch);
      }
    }
    if (await page.locator('.map:not(.done) [data-test="pin-rest"]').isVisible()
      && await page.locator('[data-test="map-guide"]').count() === 0) {
      const done = await page.evaluate(async () => {
        const s = (await import('./js/core/state.js')).state;
        return [s.slot, !!s.flags._delivery_minto_done, !!s.flags._delivery_adam_done, !!s.flags._delivery_report_done];
      });
      assert.deepEqual(done, [0, true, true, true], 'The errand deliveries and report come before the free noon');
      if (before) {
        const after = await snapshot(page);
        errandGain.money += after.money - before.money;
        errandGain.growthXp += after.growthXp - before.growthXp;
        addDiff(errandGain.stats, after.stats, before.stats);
        addDiff(errandGain.xp, after.xp, before.xp);
      }
      return;
    }
    await advanceDialogue(page, touch);
    await page.waitForTimeout(80);
  }
  assert.fail('LOAD did not reach the free DAY2 noon map within the polling budget');
}
/** 初回の当たりの支払い。旧しくみは能力Pの合計、心得の盤（通常プレイの既定・SBD97）は経験値（SPEC 1.8） */
const statSum = (stats) => Object.values(stats).reduce((a, b) => a + b, 0);
const payoutOf = (snap, board) => board ? (snap.growthXp ?? snap.growth?.xp ?? 0) : statSum(snap.stats);
async function snapshot(page) {
  return page.evaluate(async () => {
    const { state: s } = await import('./js/core/state.js');
    return { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina,
      visits: s.spotVisits.c_station, visitedDay: s.visitedDay.c_station ?? null,
      registered: s.flags._c_station_registered, pendingFirst: !!s.flags._pakki_first_spin_pending,
      intro: s.reel.introDone, seed: s.reel.seed, count: s.reel.count,
      pending: s.reel.pending.length, stats: { ...s.stats }, xp: { ...s.statXp },
      growthXp: s.growth?.xp || 0, board: (await import('./js/core/growth-mode.js')).growthEnabled(),
      note: structuredClone(s.reel.note), lock: structuredClone(s.reel.lock),
      lastChapter: s.reel.lastChapter, setting: s.reel.setting,
      mintoDone: !!s.flags._delivery_minto_done, adamDone: !!s.flags._delivery_adam_done };
  });
}

async function startDay2(page, touch) {
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
}

await suite('reel-registration-load', async check => {
  const portraitEntry = new URL(baseURL);
  portraitEntry.searchParams.set('look', 'vertical');
  await check('portrait-day2-briefing-slow-background', async page => {
    // 曇天の差分を使い、タイトルで先読みする晴天版が検査に影響しないようにする。
    const tonariArt = /\/img\/backgrounds\/bg_tonari_inside_overcast_day\.webp(?:\?|$)/;
    let releaseBackground;
    const holdBackground = new Promise(resolve => { releaseBackground = resolve; });
    await page.route(tonariArt, async route => { await holdBackground; await route.continue(); });
    try {
      await page.evaluate(async () => {
        const [core, data, ui, calendar, time] = await Promise.all([
          import('./js/core/state.js'), import('./js/core/data.js'), import('./js/core/ui.js'),
          import('./js/daily/calendar.js'), import('./js/dev/time-warp.js'),
        ]);
        // 1日目の帰宅を終え、2日目の配達説明に入る直前の状態。
        const s = core.newGame();
        Object.assign(s, { phase: 'daily', day: 2, slot: 0, weatherSeed: 1 });
        Object.assign(s.flags, { _errand_scout_done: true, _morning_2: true });
        core.config.textSpeed = 4;
        ui.showScreen('none');
        await ui.setBg(data.bgUrl('bg_home', 'night'), { instant: true });
        time.installTimeWarp();
        time.setSpeed(8);
        void calendar.runDaily({ untilDay: 3, nightEvents: {} });
      });
      const mainText = page.locator('#vn.active .vn-text');
      await page.locator('#fx > .vn-loading').waitFor({ state: 'attached' });
      // 15秒を8倍速にした従来の上限（実時間で約1.9秒）を越えてから、画像を正常に返す。
      await page.waitForTimeout(2500);
      assert.equal(await mainText.count(), 0, 'The briefing started before the shop background arrived');
      const response = page.waitForResponse(tonariArt);
      releaseBackground();
      assert.equal((await response).status(), 200);
      await mainText.filter({ hasText: 'カウンターの横に、' }).waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.querySelector('.vt-where b')?.textContent === 'tonari');
      assert.equal(await page.locator('#bg .bg-img.show').last().getAttribute('data-scene-bg'), 'bg_tonari_inside_overcast_day.png');
    } finally {
      releaseBackground();
    }
  }, {
    pageEntry: portraitEntry.href, pageReadySelector: '[data-test="vt-title-new"]',
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });

  for (const touch of [false, true]) await check(`${touch ? 'touch' : 'pc'}-day2-guide`, async page => {
    errandGain = emptyGain();
    await startDay2(page, touch);
    await readIntro(page, touch, true);
    const guide = page.locator('[data-test="day2-guide"]');
    await guide.waitFor();
    assert.deepEqual(await guide.locator('b').allTextContents(), ['大会', '公式アプリ', '昼と夜', '配達']);
    const descriptions = await guide.locator('p').allTextContents();
    for (const [i, pattern] of [/DAY14.*レモン.*2g以上/, /MOKUMOKUパッキー.*自動で1回転/, /昼と夜で1回ずつ/, /PEPPERMINT.*EDEN.*tonari/].entries()) {
      assert.match(descriptions[i], pattern);
    }
    const beforeRules = await snapshot(page);
    await tap(page, '[data-test="day2-guide-rules"]', touch);
    assert.match(await page.locator('[data-test="rule-sheet"]').innerText(), /2・3・2・3点.*もう一口吸いたい一台/);
    await tap(page, '[data-test="rule-sheet-close"]', touch);
    await guide.waitFor();
    assert.deepEqual(await snapshot(page), beforeRules);
    await tap(page, '[data-test="day2-guide-close"]', touch);
    await noonMapNext(page, touch);
    await tap(page, '[data-test="hud-menu"]', touch);
    await tap(page, '[data-test="menu-tab-system"]', touch);
    await tap(page, '[data-test="menu-day2-guide"]', touch);
    await guide.waitFor();
    assert.deepEqual(await guide.locator('p').allTextContents(), descriptions);
    await tap(page, '[data-test="day2-guide-close"]', touch);
    assert(await page.locator('.map:not(.done)').isVisible());
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

  for (const touch of [false, true]) for (const boundary of cases) {
    const label = `${touch ? 'touch' : 'pc'}-${boundary}`;
    await check(label, async page => {
      errandGain = emptyGain();
      await startDay2(page, touch);
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
        const { growthEnabled } = await import('./js/core/growth-mode.js');
        const { SLOT_EXP } = await import('./js/core/growth.js');
        const board = growthEnabled();
        const exp = board ? results.reduce((n, r) => n + (r.quiet ? 0 : SLOT_EXP[r.overlap || r.role] || 0), 0)
          : results.reduce((n, r) => n + r.exp, 0);
        return { count: copy.count, exp, board, lock: copy.lock };
      });
      assert.equal(expected.board, receipt.board);
      if (!expected.board) assert(expected.exp < 38, 'Fixture must stay below the stat cap');

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
          // Keep the committed action result queued while the first explanation is pending.
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
        assert(beforeLoad.reel.pending.every(r => r.applied === false));
        assert.equal(payoutOf(beforeLoad, expected.board), payoutOf(receipt, expected.board));
      }
      if (boundary === 'existing-pending-results') assert(beforeLoad.reel.pending.length > 0);

      // Production title LOAD -> chapter resume -> runDaily. Never invoke installReel here.
      await loadTitle(page, touch);
      if (boundary === 'explanation-interrupted' || boundary === 'existing-pending-results') {
        await page.locator('[data-test="reel-intro"]').waitFor();
        const during = await snapshot(page);
        assert.equal(during.count, beforeLoad.reel.count, 'Drew before explanation finished');
        assert.deepEqual(during.stats, beforeLoad.stats);
        assert.equal(during.growthXp, beforeLoad.growth?.xp || 0, 'Paid EXP before explanation finished');
        assert.equal(await page.locator('.spot-pin.guide[data-spot="minto"]').isVisible(), false);
        await readIntro(page, touch);
      }
      if (boundary === 'explanation-interrupted') {
        // A second real interruption: the resumed intro finished and the first draw was committed,
        // but installReel is still awaiting presentation. Its explicit pending flag is gone.
        await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
        const committed = await page.evaluate(async () => {
          const core = await import('./js/core/state.js');
          return JSON.parse(localStorage.getItem(core.SAVE_KEY));
        });
        assert.equal(committed.visitedDay.c_station, undefined, 'First-spin commitment must leave the customer visit available');
        assert(!committed.flags._pakki_first_spin_pending);
        assert.equal(committed.reel.count, expected.count);
        assert(committed.reel.pending.every(r => r.applied === false));
        assert.equal(payoutOf(committed, expected.board), payoutOf(receipt, expected.board));
        await loadTitle(page, touch);
        await noonMapNext(page, touch);
        const resumed = await snapshot(page);
        assert.equal(resumed.visitedDay, null);
        assert.equal(resumed.count, committed.reel.count, 'Second interruption redrew first spin');
        assert.equal(errandGain.money, 4000, 'The errand pays both delivery allowances once');
        assert.deepEqual(minus(resumed.xp, errandGain.xp), committed.statXp);
        assert.equal(payoutOf(resumed, expected.board) - payoutOf(errandGain, expected.board) - payoutOf(committed, expected.board),
          expected.exp, 'Second interruption changed payout');
        assert.deepEqual(resumed.note, committed.reel.note);
      }
      await noonMapNext(page, touch);
      const after = await snapshot(page);
      for (const key of ['day', 'slot', 'stamina']) assert.equal(after[key], receipt[key], key);
      assert.equal(errandGain.money, 4000, 'The errand pays both delivery allowances once');
      assert.equal(after.money - errandGain.money, receipt.money, 'money');
      assert.equal(after.visits, 1, 'Replayed the receipt visit');
      assert.equal(after.registered, true);
      assert.equal(after.intro, true);
      assert.equal(after.pendingFirst, false);
      assert.equal(after.pending, 0);
      assert.equal(after.mintoDone, true); assert.equal(after.adamDone, true); // #3819: 登録のついでに届ける
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
        assert.deepEqual(minus(after.stats, errandGain.stats), receipt.stats);
        assert.deepEqual(minus(after.xp, errandGain.xp), receipt.xp);
        assert.equal(after.growthXp - errandGain.growthXp, receipt.growthXp, 'Paid EXP for an inferred legacy first spin');
      } else {
        assert.equal(after.count, expected.count, 'Lost or duplicated the first series');
        assert.deepEqual(after.lock, expected.lock, 'Changed deterministic next-spin state');
        const errandPayout = expected.board ? errandGain.growthXp : statSum(errandGain.stats);
        const gain = payoutOf(after, expected.board) - payoutOf(receipt, expected.board) - errandPayout;
        if (expected.board) assert.deepEqual(after.stats, receipt.stats, 'The board pays EXP, not stats');
        assert.equal(gain, expected.exp, 'Lost or duplicated first-spin payout');
        if (beforeLoad.reel.count > 0) {
          assert.deepEqual(minus(after.xp, errandGain.xp), beforeLoad.statXp);
          assert.deepEqual(after.note, beforeLoad.reel.note);
        }
      }
      await loadTitle(page, touch);
      await noonMapNext(page, touch);
      assert.deepEqual(await snapshot(page), after, 'Repeat production LOAD changed rewards/bookkeeping');
      summaries.push({ label, checkpoint: boundary === 'explanation-interrupted' ? 'actual receipt' : 'isolated boundary', after });
    }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});
  }
});
fs.mkdirSync(artifacts, { recursive: true });
fs.writeFileSync(path.join(artifacts, 'reel-registration-load-state.json'), JSON.stringify(summaries, null, 2) + '\n');
