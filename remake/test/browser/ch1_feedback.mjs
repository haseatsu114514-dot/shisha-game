// Issue #647: real purchase/grants, old-box continuation, immediate band updates and indoor delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite, assertFits } from './support.mjs';
const shots = process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser';
fs.mkdirSync(shots, { recursive: true });
async function setup(page) {
  await page.evaluate(async () => {
    window.F = { core: await import('./js/core/state.js'), data: await import('./js/core/data.js'),
      ui: await import('./js/core/ui.js'), vn: await import('./js/vn/engine.js'),
      kuji: await import('./js/daily/kuji.js'), home: await import('./js/daily/home-shisha.js'),
      session: await import('./js/craft/session.js'), steps: await import('./js/craft/steps.js'),
      calendar: await import('./js/daily/calendar.js'), ch1: await import('./js/chapters/ch1.js') };
    F.core.newGame(); F.ui.clearScreen(); F.vn.vnTest.turbo = true;
    F.showKuji = () => F.ui.layers.screen.replaceChildren(...F.kuji.kujiRows(F.showKuji));
  });
}
const tap = (page, selector, touch) => touch ? page.locator(selector).tap() : page.locator(selector).click();
await suite('ch1-feedback', async check => {
  for (const [name, touch, options] of [['pc', false, { reducedMotion: 'reduce' }],
    ['touch', true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }]]) {
    for (const grade of ['g500', 'g1000']) await check(`${name}-${grade}-full-box-and-refill`, async page => {
      await setup(page);
      const initial = await page.evaluate(() => {
        F.core.state.money = 100000; F.core.state.flavorStock = {}; F.core.state.owned = [];
        F.showKuji(); return JSON.parse(JSON.stringify(F.core.state));
      });
      const rows = await page.locator('.kuji-row').allTextContents();
      for (const row of rows) { assert.match(row, /50/); assert.match(row, /ラストワン賞・シークレット/); assert(!row.includes('ナイトサイド')); }
      // Verify the actual deck includes exactly one S before consuming it.
      const deck = await page.evaluate(id => {
        const b = F.core.state.kuji[id]; return { size: b.order.length, s: b.order.filter(i => b.prizes[i].rank === 'S').length };
      }, grade);
      assert.deepEqual(deck, { size: 50, s: 1 });
      for (let i = 0; i < 50; i++) {
        await tap(page, `[data-test="kuji-${grade}"]`, touch);
        await page.locator('.kuji-card.reveal').waitFor();
        assert.equal(await page.evaluate(id => F.core.state.kuji[id].drawn, grade), i + 1);
        await tap(page, '[data-test="kuji-reveal"]', touch);
        await page.locator('[data-test="kuji-reveal"]').waitFor({ state: 'detached' });
        if (i === 48) assert.match(await page.locator('.kuji-row').filter({ has: page.locator(`[data-test="kuji-${grade}"]`) }).textContent(), /次が最後の1枚/);
      }
      const result = await page.evaluate(({id, initial}) => {
        const s = F.core.state, g = F.data.DB.kuji.grades[id], expected = {};
        for (const p of g.prizes) {
          if (p.flavorId) expected[p.flavorId] = (expected[p.flavorId] || 0) + (p.grams ?? 50) * p.count;
          for (const f of p.flavors || []) expected[f.id] = (expected[f.id] || 0) + f.grams * p.count;
        }
        return { stock: s.flavorStock, expected, money: s.money, expectedMoney: initial.money - g.price * 50,
          owned: s.owned, last: g.lastOne.equipId, saved: JSON.parse(localStorage.getItem(F.core.SAVE_KEY)) };
      }, { id: grade, initial });
      assert.deepEqual(result.stock, result.expected);
      assert.equal(result.money, result.expectedMoney);
      assert(result.owned.includes(result.last));
      if (grade === 'g1000') assert(result.owned.includes('home_rig_pro'));
      assert.equal(result.saved.kuji[grade].drawn, 50);
      assert.equal(result.saved.owned.filter(id => id === result.last).length, 1);
      const refill = await page.evaluate(id => {
        const before = JSON.stringify(F.core.state.kuji[id]); F.core.state.day += 2; F.showKuji();
        const waiting = JSON.stringify(F.core.state.kuji[id]) === before;
        F.core.state.day++; F.showKuji();
        return { waiting, drawn: F.core.state.kuji[id].drawn, size: F.core.state.kuji[id].order.length };
      }, grade);
      assert.deepEqual(refill, { waiting: true, drawn: 0, size: 50 });
    }, options);
    await check(`${name}-legacy-boxes`, async page => {
      await setup(page);
      for (const id of ['g500', 'g1000']) {
        const before = await page.evaluate(id => {
          F.core.newGame(); F.core.state.money = 10000;
          const old = F.data.DB.kuji.legacyGrades[id];
          const order = old.prizes.flatMap((p, i) => Array(p.count).fill(i));
          // Last draw is S; already-drawn prefix remains present in the legacy save.
          order.reverse();
          F.core.state.kuji[id] = { order, drawn: order.length - 1, emptyDay: null };
          F.core.save(); F.core.load(); F.showKuji();
          return { order, size: order.length, oldPrizes: old.prizes, saved: JSON.parse(localStorage.getItem(F.core.SAVE_KEY)) };
        }, id);
        assert.deepEqual(before.saved.kuji[id].order, before.order);
        assert.deepEqual(before.saved.kuji[id].prizes, before.oldPrizes);
        assert.match(await page.locator('.kuji-row').filter({ has: page.locator(`[data-test="kuji-${id}"]`) }).textContent(), new RegExp(`1 / ${before.size}`));
        await tap(page, `[data-test="kuji-${id}"]`, touch); await page.locator('.kuji-card.reveal').waitFor();
        await tap(page, '[data-test="kuji-reveal"]', touch);
        await page.locator('[data-test="kuji-reveal"]').waitFor({ state: 'detached' });
        const after = await page.evaluate(id => ({ b: F.core.state.kuji[id], owned: F.core.state.owned, money: F.core.state.money }), id);
        assert.equal(after.b.drawn, before.size);
        assert(after.owned.includes('nightside_premier_hagal'));
        assert.equal(after.money, 10000 - (id === 'g500' ? 500 : 1000));
        await page.evaluate(id => { F.core.save(); F.core.load(); F.core.state.day += 3; F.showKuji(); }, id);
        assert.equal(await page.evaluate(id => F.core.state.kuji[id].order.length, id), 50);
      }
    }, options);
    await check(`${name}-mix-same-event-update`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        F.vn.vnTest.turbo = false;
        F.cs = F.session.newSession('tutorial'); await F.session.openBench(F.cs).ready;
        F.running = F.steps.stepMix(F.cs);
      });
      await page.locator('[data-test="mix-plus-mint"]').waitFor();
      assert.equal(await page.locator('.mix-temperature').getAttribute('data-selected'), 'false');
      // 配合の温度計は共通の縦型温度計（thermometer.js の帯プレビュー）へ移行済み（#703, 4137635de）。
      // 帯の中心は dataset の idealLow/idealHigh の中点。表示仕様の詳細は mix_temperature.mjs が検証する。
      // ここでは入力した同じイベント内で帯が即時に追随すること（フレーム・タイマーを挟まない）を見る。
      // チュートリアルではプレビュー自体は隠れるが、帯の状態は同じ経路で更新される。
      const immediate = await page.evaluate(() => {
        const gauge = document.querySelector('.mix-temperature');
        const sample = () => ({ selected: gauge.dataset.selected,
          center: (Number(gauge.dataset.idealLow) + Number(gauge.dataset.idealHigh)) / 2,
          zoneHidden: gauge.querySelector('.thermo-zone').hidden,
          text: document.querySelector('.mix-temperature-legend').textContent });
        document.querySelector('[data-test="mix-plus-mint"]').click(); const mint = sample();
        document.querySelector('[data-test="mix-plus-double_apple"]').click(); const blend = sample();
        document.querySelector('[data-test="mix-minus-mint"]').click(); const apple = sample();
        document.querySelector('[data-test="mix-minus-double_apple"]').click(); const empty = sample();
        // No animation frame, timer or polling occurs between input and sampling.
        return { mint, blend, apple, empty };
      });
      for (const kind of ['mint', 'blend', 'apple']) {
        const s = immediate[kind]; assert.equal(s.selected, 'true'); assert.equal(s.zoneHidden, false);
        assert.match(s.text, /適温|おいしい/); assert(!/未選択/.test(s.text));
      }
      assert(immediate.mint.center > immediate.blend.center && immediate.blend.center > immediate.apple.center);
      assert.equal(immediate.empty.selected, 'false'); assert(immediate.empty.zoneHidden); assert.match(immediate.empty.text, /未選択/);
      await tap(page, '[data-test="mix-plus-mint"]', touch);
      await assertFits(page, '[data-test="mix-ok"]');
      await page.screenshot({ path: `${shots}/${name}-immediate-mix.png` });
    }, options);
    await check(`${name}-single-mint-at-home`, async page => {
      await setup(page);
      await page.evaluate(() => {
        F.vn.vnTest.turbo = false;
        Object.assign(F.core.state, { day: 8, stamina: 80 });
        F.core.state.owned.push('home_rig_set'); F.core.state.flavorStock = { mint: 50 };
        F.running = F.home.runHomeShisha();
      });
      await tap(page, '[data-test="home-shisha-mix"]', touch);
      for (let i = 0; i < 12; i++) await tap(page, '[data-test="home-plus-mint"]', touch);
      await tap(page, '[data-test="home-mix-ok"]', touch);
      await page.locator('#vn.active').waitFor();
      await page.evaluate(() => {
        F.vn.vnTest.turbo = true;
        document.querySelector('[data-test="vn-auto"]').click();
      });
      await page.evaluate(() => F.running);
      const result = await page.evaluate(() => ({ lines: F.vn.backlog().map(l => l.text), s: F.core.state,
        saved: JSON.parse(localStorage.getItem(F.core.SAVE_KEY)) }));
      // #1081 D07（7b51a7bd0）: 家シーシャの感想は出来の評価（美味しい／イマイチ）ではなく、
      // 銘柄ごとの気づきに変わった。ミント単体ではミントの気づきが出て、旧い評価文は出ない。
      assert(result.lines.some(t => /冴えのある清涼感/.test(t))); assert(!result.lines.some(t => /イマイチ|美味しい/.test(t)));
      assert.equal(result.s.flavorStock.mint, 38); assert.equal(result.s.stamina, 56);
      assert.equal(result.s.slot, 0); assert.equal(result.saved.flavorStock.mint, 38);
    }, options);
  }
});
