// #733: 実配合の寸法・自主訪問解放・台の有無・イベント終端のスロット。
import assert from 'node:assert/strict';
import { suite } from './support.mjs';
async function setup(page) {
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame(); core.state.phase = 'daily';
    core.config.bgmVolume = core.config.seVolume = 0;
    window.F = { core, ui: await import('./js/core/ui.js'), map: await import('./js/daily/map.js'),
      spots: await import('./js/daily/spots.js'), rig: await import('./js/daily/home-rig.js'),
      vn: await import('./js/vn/engine.js'),
      chapter: await import('./js/chapters/ch1.js'), steps: await import('./js/craft/steps.js'),
      session: await import('./js/craft/session.js'), data: await import('./js/core/data.js'),
      stats: await import('./js/core/stats.js'), calendar: await import('./js/daily/calendar.js') };
    F.chapter.setupHooks(); F.vn.vnTest.turbo = true;
    F.vn.vnTest.choose = () => 0;
    F.openMap = () => { F.mapRun = F.map.chooseSpot(); };
  });
}
const devices = [['pc', {}], ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]];
await suite('play-feedback', async check => {
  for (const [device, options] of devices) {
    const press = (page, selector) => options.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    await check(`${device}-mix-reserves-ratio-space`, async page => {
      await setup(page);
      await page.evaluate(() => {
        F.cs = F.session.newSession('tutorial');
        F.cs.orderFlavorIds = ['mint', 'lemon', 'orange'];
        F.session.openBench(F.cs); F.task = F.steps.stepMix(F.cs);
      });
      await page.locator('[data-test="mix-plus-mint"]').waitFor();
      const boxes = () => page.locator('.bench-panel, .flavor-row, .fr-ratio').evaluateAll(ns => ns.map(n => {
        const b = n.getBoundingClientRect(); return [b.x, b.y, b.width, b.height];
      }));
      // 1g入力そのものの寸法変化を測る。別の葉へ移るためのスクロールは先に済ませる。
      // 両方の入力を見える位置に置き、基準取得後にはスクロールを補正しない。
      const inputTargets = await page.locator('.mix-list').evaluate(list => {
        const stage = document.querySelector('#stage');
        const ids = ['mint', 'lemon'];
        const buttons = ids.map(id => list.querySelector('[data-test="mix-plus-' + id + '"]'));
        const bounds = buttons.map(button => button.getBoundingClientRect());
        const listBox = list.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        const scale = stageBox.width / stage.offsetWidth;
        const middle = (Math.min(...bounds.map(b => b.top)) + Math.max(...bounds.map(b => b.bottom))) / 2;
        list.scrollTop += (middle - (listBox.top + listBox.bottom) / 2) / scale;
        return buttons.map((button, i) => {
          const b = button.getBoundingClientRect();
          return { id: ids[i], contained: b.width > 0 && b.height > 0
            && b.left >= Math.max(listBox.left, stageBox.left, 0)
            && b.top >= Math.max(listBox.top, stageBox.top, 0)
            && b.right <= Math.min(listBox.right, stageBox.right, innerWidth)
            && b.bottom <= Math.min(listBox.bottom, stageBox.bottom, innerHeight) };
        });
      });
      assert(inputTargets.every(target => target.contained),
        '配合の寸法検査は両方の入力が見える位置で始める: ' + JSON.stringify(inputTargets));
      const empty = await boxes();
      await press(page, '[data-test="mix-plus-mint"]');
      assert.deepEqual(await boxes(), empty, '1gで行・パネルが移動/拡大した');
      assert.equal(await page.locator('[data-test="mix-ratio-mint"]').textContent(), '比率 100%');
      await press(page, '[data-test="mix-plus-lemon"]');
      assert.deepEqual(await boxes(), empty, '2種類目で行・パネルが移動/拡大した');
      assert.equal(await page.locator('[data-test="mix-ratio-mint"]').textContent(), '比率 50%');
      await press(page, '[data-test="mix-minus-lemon"]');
      for (let i = 1; i < 12; i++) await press(page, '[data-test="mix-plus-mint"]');
      assert.equal(await page.locator('[data-test="mix-ok"]').textContent(), 'このフレーバーで詰める');
      await press(page, '[data-test="mix-ok"]'); await page.evaluate(() => F.task);
      assert.deepEqual(await page.evaluate(() => F.cs.mix), { mint: 12 });
    }, options);

    await check(`${device}-map-layer-locks-and-home-rig`, async page => {
      await setup(page);
      await page.evaluate(() => {
        Object.assign(F.core.state.met, { naru: true, adam: true, minto: true });
        F.openMap();
      });
      await page.locator('.map:not(.done)').waitFor();
      for (const id of ['cafe', 'kannon', 'choizap', 'c_station']) assert.equal(await page.locator(`[data-spot="${id}"]`).count(), 0);
      await press(page, '[data-spot="rest"]');
      assert.equal(await page.locator('[data-test="map-home-practice"]').count(), 0);
      const geometry = await page.locator('.map-info').evaluate(n => {
        const p = document.querySelector('.map-pins');
        const b = n.getBoundingClientRect();
        return { info: +getComputedStyle(n).zIndex, pins: +getComputedStyle(p).zIndex,
          width: parseFloat(getComputedStyle(n).width), inStage: b.right <= innerWidth && b.bottom <= innerHeight };
      });
      // DUI16 (6ed65699a84) uses a 312px guide with a 16:9 photo outside DS mode.
      assert(geometry.info > geometry.pins); assert.equal(geometry.width, 312); assert(geometry.inStage);
      // #1081 J08（699d48310）: 説明パネルは見た目だけ前面に置き、余白のクリックは背後のピンへ
      // 素通りさせる（操作を奪わない）。クリックを受けるのはパネル内のボタンだけ。
      // ピンをパネルの余白へ重ね、実ヒットテストでピンが押せて、ボタンも押せることを確認する。
      const hit = await page.evaluate(() => {
        const info = document.querySelector('.map-info'), pin = document.querySelector('[data-spot="rest"]');
        const photo = info.querySelector('.mi-preview').getBoundingClientRect();
        const stage = document.querySelector('#stage').getBoundingClientRect();
        const pinBefore = pin.getBoundingClientRect();
        const x = photo.x + photo.width / 2, y = photo.y + photo.height / 2;
        pin.style.left = `${(x - pinBefore.width / 2 - stage.x) * 1280 / stage.width}px`;
        pin.style.top = `${(y - pinBefore.height / 2 - stage.y) * 720 / stage.height}px`;
        const r = pin.getBoundingClientRect();
        const atPin = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        const goBtn = document.querySelector('[data-test="map-go"]');
        const gb = goBtn.getBoundingClientRect();
        const atGo = document.elementFromPoint(gb.x + gb.width / 2, gb.y + gb.height / 2);
        return { pinHit: !!atPin?.closest('[data-spot="rest"]'), infoHit: !!atPin?.closest('.map-info'),
          goHit: !!atGo?.closest('[data-test="map-go"]') };
      });
      assert(hit.pinHit && !hit.infoHit, 'パネルの余白に重なったピンはパネル越しに押せる');
      assert(hit.goHit, 'パネル内のボタンはクリックを受ける');
      await page.evaluate(() => { F.map.interruptMap(null); F.core.state.owned.push(F.rig.SUMI_RIG); F.openMap(); });
      await page.locator('.map:not(.done)').waitFor(); await press(page, '[data-spot="rest"]');
      assert.equal(await page.locator('[data-test="map-home-practice"]').count(), 0, '台を持っていても家練習はない');
    }, options);
  }
  await check('voluntary-conversations-unlock-and-save', async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const s = F.core.state, can = id => F.spots.isUnlocked(F.spots.spotById(id));
      // 配達で通る実visitCharは面識だけで解放しない。
      await F.spots.visitChar('adam');
      const tutorial = can('kannon');
      s.spotVisits = { kannon: 1 }; const legacyVisited = can('kannon');
      delete s.spotVisits.kannon;
      for (const char of ['adam', 'naru', 'minto']) {
        s.stamina = 100;
        await F.spots.visitRival(F.spots.spotById(char));
      }
      const unlocked = ['kannon', 'cafe', 'c_station', 'choizap'].map(can);
      F.core.save(); F.core.load();
      return { tutorial, legacyVisited, unlocked, restored: ['kannon', 'cafe', 'c_station', 'choizap'].map(can) };
    });
    assert.equal(result.tutorial, false); assert.equal(result.legacyVisited, true); // #780: 喫茶店は紹介の完読（_cafe_introduced）か訪問後に出る。ライバル訪問だけでは解放しない。
    assert.deepEqual(result.unlocked, [true, false, true, true]);
    assert.deepEqual(result.restored, result.unlocked);
    await page.evaluate(() => F.openMap()); await page.locator('[data-spot="kannon"]').waitFor();
    assert.equal(await page.locator('[data-spot="cafe"]').count(), 0); // #780: 未紹介の喫茶店は地図に出さない
  });
  await check('saved-night-pending-finishes-before-morning-without-new-reward', async page => {
    await setup(page);
    const before = await page.evaluate(async () => {
      const s = F.core.state, reel = await import('./js/daily/reel.js');
      Object.assign(s, { day: 5, slot: 2, weatherSeed: 4 });
      Object.assign(s.flags, { _morning_5: true, _morning_6: true, _lime_tut: true,
        _delivery_minto_done: true, _delivery_adam_done: true, _errand_scout_done: true,
        _hiyori_meeting_done: true, _hiyori_message_delivered: true, _home_tonight: true });
      Object.assign(s.reel, { installed: true, introDone: true, settingGuideDone: true, seed: 1 });
      reel.onAction({ spent: 10 }); F.core.save(); F.core.load();
      const before = { count: F.core.state.reel.count, stats: { ...F.core.state.stats } };
      F.task = F.calendar.runDaily({ nightEvents: {}, untilDay: 7 });
      return before;
    });
    await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
    assert.equal(await page.evaluate(() => F.core.state.day), 5);
    assert.equal(await page.locator('.rn-label').textContent(), '前回のスロット');
    await page.locator('.reel-night').waitFor({ state: 'detached', timeout: 30000 });
    await page.locator('.map:not(.done)').waitFor({ timeout: 30000 });
    const after = await page.evaluate(() => ({ count: F.core.state.reel.count, stats: { ...F.core.state.stats },
      pending: F.core.state.reel.pending.length, day: F.core.state.day }));
    assert.equal(after.count, before.count); assert.deepEqual(after.stats, before.stats);
    assert.equal(after.pending, 0); assert.equal(after.day, 6);
  });
  for (const slot of [0, 1]) await check(`slot-${slot}-spin-before-next-map-or-morning`, async page => {
    await setup(page);
    await page.evaluate(slot => {
      const s = F.core.state;
      Object.assign(s, { day: 5, slot, weatherSeed: 4 });
      Object.assign(s.flags, { _morning_5: true, _morning_6: true, _lime_tut: true,
        _delivery_minto_done: true, _delivery_adam_done: true, _errand_scout_done: true,
        _hiyori_meeting_done: true, _hiyori_message_delivered: true });
      Object.assign(s.reel, { installed: true, introDone: true, settingGuideDone: true, seed: 1 });
      F.task = F.calendar.runDaily({ nightEvents: {}, untilDay: 7 });
    }, slot);
    await page.locator('.map:not(.done)').waitFor();
    await page.locator('[data-spot="naru"]').click(); await page.locator('[data-test="map-go"]').click();
    await page.locator('.reel-night .rw-strip.spinning').first().waitFor({ timeout: 30000 });
    const spinning = await page.evaluate(() => ({ day: F.core.state.day, slot: F.core.state.slot,
      maps: document.querySelectorAll('.map:not(.done)').length, label: document.querySelector('.rn-label').textContent }));
    assert.equal(spinning.day, 5); assert.equal(spinning.slot, slot + 1); assert.equal(spinning.maps, 0);
    assert.equal(spinning.label, '今回のスロット');
    await page.locator('.reel-night').waitFor({ state: 'detached', timeout: 30000 });
    await page.locator('.map:not(.done)').waitFor({ timeout: 30000 });
    const done = await page.evaluate(() => ({ day: F.core.state.day, slot: F.core.state.slot,
      pending: F.core.state.reel.pending.length, count: F.core.state.reel.count,
      saved: JSON.parse(localStorage.getItem(F.core.SAVE_KEY)).reel.pending.length }));
    assert.equal(done.pending, 0); assert.equal(done.saved, 0); assert(done.count >= 1);
    assert.equal(done.day, slot === 0 ? 5 : 6); assert.equal(done.slot, slot === 0 ? 1 : 0);
  });
});
