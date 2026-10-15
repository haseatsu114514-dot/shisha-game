// #505: 本番UIから購入・案内・行動枠・セーブ境界を検証する。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page, values = {}) {
  await page.evaluate(async values => {
    window.S = { core: await import("./js/core/state.js"), shop: await import("./js/daily/shop.js"),
      ui: await import("./js/core/ui.js"), data: await import("./js/core/data.js"),
      hud: await import("./js/daily/hud.js"), transitions: await import("./js/core/transitions.js") };
    const s = S.core.newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 0, money: 12800, stamina: 100 }, values);
    s.flavorStock = { mint: 15, double_apple: 50, vanilla: 20 }; s.flavors = Object.keys(s.flavorStock);
    S.ui.clearScreen(); S.hud.initHud({}); S.hud.showHud();
    await S.ui.setBg(S.data.bgUrl("bg_osu_map_day"), { instant: true });
    S.open = (opts = {}) => { S.result = "pending"; S.promise = S.shop.openShop(opts).then(r => { S.result = r; }); };
  }, values);
}
async function open(page, opts = {}) {
  await page.evaluate(opts => S.open(opts), opts);
  if (!opts.errand) await page.locator('[data-test="shop-enter"]').click();
  await page.locator('.shop-tabs').waitFor();
}
const tap = (page, test) => page.locator(`[data-test="${test}"]`).click();
const snapshot = page => page.evaluate(() => ({ money: S.core.state.money, stock: S.core.state.flavorStock, slot: S.core.state.slot, stamina: S.core.state.stamina }));

await suite("shop-ui", async check => {
  const selected = process.env.TEST_CASES?.split(",");
  const run = (name, body, options = {}) => !selected || selected.includes(name) ? check(name, body, { reducedMotion: "reduce", ...options }) : Promise.resolve();
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await run(`${platform}-product-art-legacy-save`, async page => {
      await setup(page);
      // A real pre-gram-inventory save: viewing art must not rewrite it.
      await page.evaluate(() => {
        const old = { schema: 5, chapter: 1, phase: "daily", day: 5, slot: 0,
          money: 12800, stamina: 100, seed: 1234, weatherSeed: 4,
          stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
          flags: { _qa_art_legacy: true }, flavors: ["mint", "lemon"] };
        S.legacyRaw = JSON.stringify(old);
        localStorage.setItem(S.core.SAVE_KEY, S.legacyRaw);
        S.core.load();
      });
      const before = await page.evaluate(() => JSON.stringify(S.core.state));
      await open(page);
      const decodeRows = async expected => {
        assert.equal(await page.locator('.shop-row.product').count(), expected);
        assert.equal(await page.locator('.shop-row.product .shop-type-mark, .shop-row.product .art-missing').count(), 0);
        const rows = await page.locator('.shop-row.product .shop-product-art').evaluateAll(async nodes => {
          return Promise.all(nodes.map(async node => {
            const painted = [node, ...node.querySelectorAll('*')].find(n => getComputedStyle(n).backgroundImage !== 'none');
            const url = painted && getComputedStyle(painted).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
            if (!url) return { error: 'Missing product image' };
            const image = new Image(); image.src = url; await image.decode();
            return { url, width: image.naturalWidth, height: image.naturalHeight };
          }));
        });
        assert.equal(rows.length, expected);
        for (const row of rows) assert(row.width > 0 && row.height > 0, JSON.stringify(row));
        return rows;
      };
      const flavors = await decodeRows(18);
      assert.equal(new Set(flavors.map(row => row.url)).size, 18, 'Each flavor needs its own carton');
      for (const id of await page.evaluate(() => S.shop.SHOP_FLAVORS)) {
        await tap(page, `detail-${id}`);
        const detail = page.locator(`.shop-detail [data-product-art="${id}"]`);
        await detail.waitFor();
        // The stage scales the same 112px detail window to each viewport.
        const box = await detail.evaluate(node => {
          const style = getComputedStyle(node);
          return { width: parseFloat(style.width), height: parseFloat(style.height) };
        });
        assert.equal(box.width, 112); assert.equal(box.height, 112);
        await assertFits(page, '.shop-detail .shop-product-art');
        await tap(page, 'shop-detail-close');
      }
      await page.locator('[data-tab="equip"]').click();
      await decodeRows(8);
      for (const id of ['lotos_hagal', 'tanukish_lid', 'amaburst_hms']) {
        assert.equal(await page.locator(`.shop-row [data-product-art="${id}"]`).count(), 1);
        await tap(page, `detail-${id}`);
        await page.locator(`.shop-detail [data-product-art="${id}"]`).waitFor();
        await tap(page, 'shop-detail-close');
      }
      assert.equal(await page.evaluate(() => JSON.stringify(S.core.state)), before);
      assert(await page.evaluate(() => localStorage.getItem(S.core.SAVE_KEY) === S.legacyRaw));
      await page.locator('[data-tab="flavor"]').click();
      if (platform === 'touch') {
        await page.locator('[data-test="buy-mint"]').tap();
        await page.locator('[data-test="shop-checkout"]').tap();
      } else {
        await tap(page, 'buy-mint'); await tap(page, 'shop-checkout');
      }
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
      assert.equal(saved.money, 11250); assert.equal(saved.flavorStock.mint, 100);
      assert.equal(saved.flavorStock.lemon, 50); assert.equal(saved.flags._qa_art_legacy, true);
      await page.locator('[data-tab="equip"]').click();
      await tap(page, 'detail-amaburst_hms');
      await page.locator('.modal-box.shop-dialog').evaluate(async box => {
        await Promise.all(box.getAnimations().map(animation => animation.finished));
      });
      await assertFits(page, '.shop-detail .shop-product-art');
    }, options);
    await run(`${platform}-entry`, async page => {
      await setup(page); const before = await snapshot(page);
      await page.evaluate(() => S.open());
      await page.locator('.shop-floor img').first().waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.shop-floor img')].every(n => n.complete && n.naturalWidth > 0));
      await assertFits(page, '.shop-floor, .shop-back');
      assert.equal(await page.locator('.shop-tabs').count(), 0);
      await tap(page, 'shop-entry-back');
      assert.equal(await page.evaluate(() => S.result), null);
      assert.deepEqual(await snapshot(page), before);
      await page.evaluate(() => S.open());
    }, options);
    await run(`${platform}-batch`, async page => {
      await setup(page); await open(page);
      assert.equal(await page.locator('.shop-row.product').count(), 18);
      assert.equal(await page.locator('[data-test="shop-upstairs"]').count(), 0);
      await tap(page, 'buy-mint'); await tap(page, 'buy-mint'); await tap(page, 'buy-blueberry');
      assert.match(await page.locator('.shop-summary').innerText(), /4,650/);
      assert.match(await page.locator('.shop-summary').innerText(), /8,150/);
      assert.equal((await snapshot(page)).money, 12800, 'Quantity selection spent money');
      await assertFits(page, '.shop-back, .shop-checkout, .shop-summary, .shop-tabs');
      await page.locator('[data-category="floral"]').click();
      assert.equal(await page.locator('.shop-row.product').count(), 1);
      await tap(page, 'shop-summary'); assert.match(await page.locator('.shop-order').innerText(), /ミント × 2/);
      await page.getByRole('button', { name: '一覧に戻る', exact: true }).click();
      await tap(page, 'shop-checkout');
      const after = await snapshot(page);
      assert.deepEqual(after, { money: 8150, stock: { mint: 115, double_apple: 50, vanilla: 20, blueberry: 50 }, slot: 0, stamina: 100 });
      assert(await page.locator('[data-test="shop-checkout"]').isDisabled());
      await page.evaluate(() => document.querySelector('[data-test="shop-checkout"]').click());
      assert.deepEqual(await snapshot(page), after);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
      assert.equal(saved.money, 8150); assert.equal(saved.flavorStock.mint, 115);
      await page.locator('[data-category="all"]').click();
      await tap(page, 'detail-mint'); assert.match(await page.locator('.shop-detail').innerText(), /115g/);
      await tap(page, 'shop-detail-close');
      await tap(page, 'buy-mint'); await tap(page, 'buy-blueberry');
    }, options);
  }
  await run('availability-and-cancel-cue', async page => {
    await setup(page, { day: 2 }); await page.evaluate(() => S.open());
    assert(await page.locator('[data-test="shop-upstairs"]').isDisabled());
    assert.match(await page.locator('.showroom').innerText(), /出張中/);
    await tap(page, 'shop-entry-back');
    await page.evaluate(() => { S.core.state.day = 5; S.core.state.slot = 1; S.core.state.visitedDay.rin = 5; S.open(); });
    assert(await page.locator('[data-test="shop-upstairs"]').isDisabled());
    assert.match(await page.locator('.showroom').innerText(), /訪問済み/);
    await tap(page, 'shop-entry-back');
    await page.evaluate(() => { delete S.core.state.visitedDay.rin; S.transitions.cueTransition('place', { spotId: 'shop' }); S.open(); });
    await tap(page, 'shop-entry-back');
    await page.evaluate(() => { S.curtain = S.transitions.createSceneCurtain(S.ui.layers.fx, {}); });
    assert.equal(await page.locator('[data-test="store-arrival"]').count(), 0, 'Cancelled entry leaked the arrival logo');
    await page.evaluate(() => S.curtain.release());
  });
  await run('errand-expense-and-preparation', async page => {
    await setup(page, { money: 0, day: 1 });
    await page.evaluate(() => { S.core.state.flavorStock.mint = 0; });
    await open(page, { errand: 'mint', expense: true });
    assert.equal(await page.locator('.shop-entry').count(), 0);
    await assertFits(page, '.shop-row.errand .shop-price');
    await tap(page, 'shop-leave'); assert.equal(await page.evaluate(() => S.result), 'pending');
    await tap(page, 'buy-mint'); await tap(page, 'shop-checkout');
    assert.equal((await snapshot(page)).money, 0); assert.equal((await snapshot(page)).stock.mint, 50);
    assert(await page.evaluate(() => S.core.state.flags._errand_mint_expensed));
    await tap(page, 'buy-mint'); assert(await page.locator('[data-test="shop-checkout"]').isDisabled());
    await tap(page, 'minus-mint'); await tap(page, 'shop-leave');
    await page.evaluate(() => { S.core.state.flavorStock.mint = 0; });
    await open(page, { errand: 'mint', expense: true });
    await tap(page, 'buy-mint'); assert(await page.locator('[data-test="shop-checkout"]').isDisabled(), 'Reopening granted a second expense');
    await page.evaluate(() => { S.ui.clearScreen(); S.core.state.flavorStock.blueberry = 1; });
    await open(page, { errand: 'blueberry', expense: true, minStock: 12, expenseFlag: '_prep_flavor_expensed' });
    await tap(page, 'shop-leave'); assert.equal(await page.evaluate(() => S.result), 'pending');
    await tap(page, 'buy-blueberry'); await tap(page, 'shop-checkout'); await tap(page, 'shop-leave');
    assert.equal((await snapshot(page)).stock.blueberry, 51); assert.equal((await snapshot(page)).money, 0);
  });
  await run('equipment-sell-kuji', async page => {
    await setup(page); await page.evaluate(() => { S.core.state.owned.push('suyaki_minto'); }); await open(page);
    await page.locator('[data-tab="equip"]').click();
    assert.equal(await page.locator('.shop-row.product').count(), 8);
    assert.deepEqual(await page.locator('.shop-price, .shop-stock').evaluateAll(ns => ns.filter(n => n.scrollWidth > n.clientWidth + 1).map(n => n.textContent)), []);
    assert.equal(await page.locator('[data-test="buy-suyaki_minto"]').count(), 0);
    assert.equal(await page.locator('[data-test="buy-silicone_bowl"]').count(), 0);
    await tap(page, 'detail-hagal_80beat'); assert.match(await page.locator('.shop-current').innerText(), /シリコンボウル/);
    await tap(page, 'shop-detail-close'); await tap(page, 'buy-hagal_80beat');
    assert(await page.locator('[data-test="buy-hagal_80beat"]').isDisabled());
    await page.locator('[data-tab="flavor"]').click(); await tap(page, 'buy-mint'); await tap(page, 'shop-checkout');
    assert.equal((await snapshot(page)).money, 7250);
    assert.equal(await page.evaluate(() => S.core.state.owned.filter(id => id === 'hagal_80beat').length), 1);
    await page.locator('[data-tab="sell"]').click();
    assert.equal(await page.locator('[data-test="sell-locked-suyaki_minto"]').count(), 1);
    assert.equal(await page.locator('[data-test="sell-silicone_bowl"]').count(), 0);
    await tap(page, 'sell-hagal_80beat'); await tap(page, 'shop-sell-confirm');
    assert.equal((await snapshot(page)).money, 9250);
    assert.equal(await page.evaluate(() => S.shop.sellEquipment('suyaki_minto')), false);
    await page.locator('[data-tab="kuji"]').click(); await tap(page, 'kuji-g500');
    assert(await page.locator('[data-test="shop-checkout"]').isHidden());
    await page.locator('.kuji-card.reveal').waitFor(); await tap(page, 'kuji-reveal');
    assert.equal(await page.evaluate(() => S.core.state.kuji.g500.drawn), 1);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
    assert.equal(saved.kuji.g500.drawn, 1);
  });
  await run('shortfall-scroll-discard-stale-state', async page => {
    await setup(page, { money: 1600 }); await open(page);
    await tap(page, 'buy-lychee'); const scroll = await page.locator('.shop-body').evaluate(n => n.scrollTop);
    assert(scroll > 0); await tap(page, 'buy-lychee');
    assert(Math.abs(await page.locator('.shop-body').evaluate(n => n.scrollTop) - scroll) < 2);
    assert(await page.locator('[data-test="shop-checkout"]').isDisabled());
    await tap(page, 'shop-leave'); await page.getByRole('button', { name: '買い物に戻る', exact: true }).click();
    assert.equal(await page.evaluate(() => S.result), 'pending');
    await tap(page, 'shop-summary'); await tap(page, 'shop-clear');
    await page.locator('[data-category="cooling"]').click(); await tap(page, 'buy-mint');
    // 表示後に資金が変わっても、古い表示価格のまま確定しない。
    await page.evaluate(() => { S.core.state.money = 0; document.querySelector('[data-test="shop-checkout"]').click(); });
    assert.equal((await snapshot(page)).stock.mint, 15);
    await page.evaluate(() => { S.core.state.money = 1600; S.oldButton = document.querySelector('[data-test="buy-mint"]'); S.oldCheckout = document.querySelector('[data-test="shop-checkout"]'); S.core.newGame(); });
    const fresh = await snapshot(page); await page.evaluate(() => { S.oldButton.click(); S.oldCheckout.disabled = false; S.oldCheckout.click(); });
    assert.deepEqual(await snapshot(page), fresh);
  });
  await run('delayed-entry-and-discard', async page => {
    await setup(page);
    await page.evaluate(() => { S.transitions.cueTransition('place', { spotId: 'shop', area: '問屋街' }); S.open(); });
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('[data-test="store-arrival"]').count(), 0);
    await tap(page, 'shop-enter');
    await page.locator('[data-test="store-arrival"][data-store="shop"]').waitFor();
    await tap(page, 'buy-mint'); await tap(page, 'shop-leave'); await tap(page, 'shop-discard-leave');
    assert.equal(await page.evaluate(() => S.result), null);
    assert.equal((await snapshot(page)).money, 12800); assert.equal((await snapshot(page)).stock.mint, 15);
  }, { reducedMotion: 'no-preference' });
  await run('calendar-shopping-and-showroom', async page => {
    page.setDefaultTimeout(45000);
    await setup(page);
    await page.evaluate(async () => {
      const s = S.core.state;
      Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1, _lime_opened: true });
      const vn = await import('./js/vn/engine.js'); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      (await import('./js/chapters/ch1.js')).setupHooks();
      S.error = null; (await import('./js/daily/calendar.js')).runDaily({ nightEvents: {} }).catch(e => S.error = e.stack);
    });
    const go = async () => { await page.locator('.map:not(.done) [data-test="pin-shop"]').click(); await tap(page, 'map-go'); };
    await go(); await tap(page, 'shop-entry-back');
    await page.locator('.map:not(.done)').waitFor(); assert.equal((await snapshot(page)).slot, 0);
    await go(); await tap(page, 'shop-enter'); await tap(page, 'buy-mint'); await tap(page, 'shop-checkout'); await tap(page, 'shop-leave');
    await page.locator('.map:not(.done)').waitFor(); assert.equal((await snapshot(page)).slot, 0);
    await go();
    assert(await page.locator('[data-test="shop-upstairs"]').isDisabled(), 'The daytime showroom must stay closed');
    await tap(page, 'shop-entry-back'); await page.locator('.map:not(.done)').waitFor();
    await page.evaluate(() => { S.core.state.slot = 1; S.core.state.stamina = 5; });
    const beforeCancel = await snapshot(page);
    await go(); await tap(page, 'shop-upstairs');
    await page.getByRole('button', { name: 'やめておく', exact: true }).click();
    await page.locator('.map:not(.done)').waitFor();
    assert.deepEqual(await snapshot(page), beforeCancel, 'The cancelled night visit must preserve money, stock, stamina and its action');
    assert.equal((await snapshot(page)).slot, 1); assert.equal((await snapshot(page)).stamina, 5);
    await page.evaluate(() => { S.curtain = S.transitions.createSceneCurtain(S.ui.layers.fx, {}); });
    assert.equal(await page.locator('[data-test="store-arrival"]').count(), 0, 'Stamina cancellation leaked the showroom arrival');
    await page.evaluate(() => S.curtain.release());
    await page.evaluate(() => {
      S.core.state.stamina = 100;
      // Observe the real action save before the night is followed by sleep; never change its payload.
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'suien_remake_save') {
          const saved = JSON.parse(value);
          if (saved.day === 5 && saved.slot === 2 && saved.visitedDay.rin === 5 && !S.showroomSave) S.showroomSave = saved;
        }
        return originalSet.call(this, key, value);
      };
    });
    await go(); await tap(page, 'shop-upstairs');
    await page.waitForFunction(() => S.error || S.core.state.day === 6 && S.core.state.slot === 0 && document.querySelector('.map:not(.done)'));
    assert.equal(await page.evaluate(() => S.error), null);
    const saved = await page.evaluate(() => S.showroomSave);
    assert(saved, 'The completed showroom visit must save its cost and action before sleep');
    assert.equal(saved.slot, 2); assert.equal(saved.day, 5);
    assert.equal(saved.stamina, 86);
    assert.equal(saved.money, beforeCancel.money, 'The existing free consultation must not add a fee');
    assert.deepEqual(saved.flavorStock, beforeCancel.stock);
    assert.equal((await snapshot(page)).slot, 0); assert.equal((await snapshot(page)).stamina, 100);
    assert.equal(await page.evaluate(() => S.core.state.visitedDay.rin), 5);
    await go(); assert(await page.locator('[data-test="shop-upstairs"]').isDisabled());
  });
});
