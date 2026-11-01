// #505: 本番UIから購入・案内・行動枠・セーブ境界を検証する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
const HEAVEN = ['mint', 'double_apple', 'blueberry', 'strawberry', 'pineapple', 'lemon', 'orange', 'grape', 'watermelon', 'cinnamon'];
const REMAINING = ['vanilla', 'coconut', 'mango', 'peach', 'melon', 'banana', 'rose', 'lychee'];
const ADOPTED = [...HEAVEN, ...REMAINING];
const CHARACTER_CARTONS = ['cola', 'raspberry', 'gum_cinnamon', 'bombshell', 'white_musk'];
const HMD = ['tanukish_lid', 'amaburst_hms'];
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser');
fs.mkdirSync(artifacts, { recursive: true });
const capture = (page, name) => page.screenshot({ path: path.join(artifacts, `shop-art-${name}.png`) });
const tap = (page, test) => page.locator(`[data-test="${test}"]`).click();
const snapshot = page => page.evaluate(() => ({ money: S.core.state.money, stock: S.core.state.flavorStock, slot: S.core.state.slot, stamina: S.core.state.stamina }));

await suite("shop-ui", async check => {
  const selected = process.env.TEST_CASES?.split(",");
  const run = (name, body, options = {}) => !selected || selected.includes(name) ? check(name, body, { reducedMotion: "reduce", ...options }) : Promise.resolve();
  await run('af-vanilla-stock-and-craft-art', async page => {
    await setup(page);
    await page.evaluate(() => { S.core.save(); S.core.newGame(); S.core.load(); });
    assert.equal((await snapshot(page)).stock.vanilla, 20, 'Saved vanilla stock keeps its ID and grams');
    await open(page);
    assert.match(await page.locator('[data-test="detail-vanilla"] b').innerText(), /アルファーヘブン バニラ/);
    await tap(page, 'buy-vanilla'); await tap(page, 'shop-checkout');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
    assert.equal(saved.flavorStock.vanilla, 70);
    assert.equal(saved.money, 11050);
    const source = await page.evaluate(async () => {
      const art = S.shop.flavorPackageArt('vanilla');
      S.ui.showScreen(art);
      const image = art.querySelector('img'); await image.decode();
      return { url: image.src, width: image.naturalWidth, maker: S.data.DB.flavorById.vanilla.maker };
    });
    assert(source.url.endsWith('/af-vanilla/vanilla.webp'));
    assert.equal(source.width, 512); assert.equal(source.maker, 'af');
  });
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }], ["compact", { viewport: { width: 800, height: 600 } }]]) {
    await run(`${platform}-product-art-legacy-save`, async page => {
      await setup(page);
      // A real pre-gram-inventory save: viewing art must not rewrite it.
      await page.evaluate(() => {
        const old = { schema: 5, chapter: 1, phase: "daily", day: 5, slot: 0,
          money: 12800, stamina: 100, seed: 1234, weatherSeed: 4,
          stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
          owned: ['silicone_bowl', 'lotos_hagal', 'flat_charcoal', 'hagal_80beat'],
          equip: { bowl: 'silicone_bowl', hms: 'lotos_hagal', charcoal: 'flat_charcoal' },
          flags: { _qa_art_legacy: true, _qa_unrelated_story: 'keep' }, flavors: ["mint", "lemon"] };
        S.legacyRaw = JSON.stringify(old);
        localStorage.setItem(S.core.SAVE_KEY, S.legacyRaw);
        S.core.load();
      });
      const before = await page.evaluate(() => JSON.stringify(S.core.state));
      await open(page);
      const mapping = await page.evaluate(async () => Object.keys({ ...(await import('./js/daily/shop-art.js')).SHOP_ART,
        ...(await import('./js/daily/shop-art-remaining.js')).REMAINING_SHOP_ART }));
      assert.deepEqual(mapping.sort(), [...ADOPTED].sort());
      const decodeRows = async expected => {
        assert.equal(await page.locator('.shop-row.product').count(), expected);
        const rows = await page.locator('.shop-row.product .shop-product-art').evaluateAll(async nodes => Promise.all(nodes.map(async node => {
          const image = node.querySelector('img');
          const painted = [node, ...node.querySelectorAll('*')].find(n => getComputedStyle(n).backgroundImage !== 'none');
          const url = image?.src || painted && getComputedStyle(painted).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
          if (!url) return { id: node.dataset.productArt, text: node.textContent.trim() };
          const decoded = new Image(); decoded.src = url; await decoded.decode();
          return { id: node.dataset.productArt, url, width: decoded.naturalWidth, height: decoded.naturalHeight,
            kind: node.classList.contains('generated') ? 'generated' : node.classList.contains('botanical') ? 'botanical' : 'existing' };
        })));
        for (const row of rows.filter(row => row.url)) {
          assert(row.width > 0 && row.height > 0, JSON.stringify(row));
          assert.equal((await page.request.get(row.url)).status(), 200, row.url);
        }
        return rows;
      };
      const flavors = await decodeRows(25);
      const generatedIds = new Set(flavors.filter(row => row.kind === 'generated').map(row => row.id));
      for (const id of [...ADOPTED, ...CHARACTER_CARTONS]) assert(generatedIds.has(id), `${id} has generated carton art`);
      assert.deepEqual(flavors.filter(row => row.kind === 'botanical').map(row => row.id), []);
      assert.equal(new Set(flavors.filter(row => ADOPTED.includes(row.id)).map(row => row.url)).size, 18, 'Adopted flavor cartons remain distinct');
      for (const row of flavors.filter(row => ADOPTED.includes(row.id))) {
        assert(row.url.includes(`/${row.id === 'vanilla' ? 'af-vanilla' : REMAINING.includes(row.id) ? 'remaining8' : 'heaven10'}/${row.id}.webp`));
      }
      for (const id of await page.evaluate(() => S.shop.SHOP_FLAVORS)) {
        const button = page.locator(`[data-test="detail-${id}"]`);
        // Old saves retain their data; AF is displayed with the catalog's full maker name.
        const expectedName = await page.evaluate(id => {
          const item = S.data.DB.flavorById[id];
          return item.maker === 'af' ? item.name : item.short_name || item.name;
        }, id);
        assert.equal(await button.locator('b').innerText(), `${expectedName} 1箱（50g）`);
        await button.scrollIntoViewIfNeeded();
        // Every carton is recorded in its real list and detail context.
        await capture(page, `${platform}-list-${id}`);
        await button.click();
        const detail = page.locator(`.shop-detail [data-product-art="${id}"]`);
        await detail.waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('.shop-detail img')].every(n => n.complete && n.naturalWidth > 0));
        await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
        const box = await detail.evaluate(node => ({ width: parseFloat(getComputedStyle(node).width), height: parseFloat(getComputedStyle(node).height) }));
        assert.equal(box.width, 112); assert.equal(box.height, 112);
        await assertFits(page, '.shop-detail .shop-product-art');
        if (ADOPTED.includes(id) || id === 'vanilla') await capture(page, `${platform}-detail-${id}`);
        await tap(page, 'shop-detail-close');
      }
      await page.locator('[data-tab="equip"]').click();
      const equipment = await decodeRows(8);
      assert.equal(equipment.filter(row => row.url).length, 6, 'Three bowls, two regenerated coals and the new lotos image');
      for (const [id, suffix] of [['lotos_hagal', '/equipment-v2/lotos_hagal.webp'],
        ['flat_charcoal', '/equipment-v2/flat_charcoal.webp'], ['cube_charcoal', '/equipment-v2/cube_charcoal.webp']]) {
        assert(equipment.find(row => row.id === id)?.url.endsWith(suffix), `${id} uses its selected illustration`);
        await tap(page, `detail-${id}`);
        const image = page.locator('.shop-detail img');
        await image.evaluate(node => node.decode());
        assert((await image.getAttribute('src')).endsWith(suffix));
        await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
        await assertFits(page, '.shop-detail .shop-product-art');
        await capture(page, `${platform}-equipment-${id}`);
        await tap(page, 'shop-detail-close');
      }
      for (const id of HMD) {
        assert.equal(equipment.find(row => row.id === id)?.text, 'HMD');
        await tap(page, `detail-${id}`);
        assert.equal(await page.locator('.shop-detail .shop-type-mark').innerText(), 'HMD');
        assert.equal(await page.locator('.shop-detail img').count(), 0);
        await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
        await capture(page, `${platform}-held-${id}`);
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
      assert.deepEqual(saved.equip, { bowl: 'silicone_bowl', hms: 'lotos_hagal', charcoal: 'flat_charcoal' });
      assert.deepEqual(saved.owned, ['silicone_bowl', 'lotos_hagal', 'flat_charcoal', 'hagal_80beat']);
      assert.equal(saved.flags._qa_unrelated_story, 'keep');
      await capture(page, `${platform}-purchased-mint`);
      await page.locator('[data-tab="equip"]').click();
      await tap(page, 'detail-amaburst_hms');
      await page.locator('.modal-box.shop-dialog').evaluate(async box => {
        await Promise.all(box.getAnimations().map(animation => animation.finished));
      });
      await assertFits(page, '.shop-detail .shop-product-art');
    }, options);
    await run(`${platform}-equipment-art-fallback`, async page => {
      const aborted = new Set();
      for (const tail of ['shop/equipment-v2/lotos_hagal.webp', 'shop/equipment-v2/flat_charcoal.webp', 'shop/equipment-v2/cube_charcoal.webp']) {
        await page.route(`**/img/${tail}`, route => { aborted.add(tail); return route.abort('aborted'); });
      }
      await setup(page); await open(page);
      await page.locator('[data-tab="equip"]').click();
      for (const [id, label] of [['lotos_hagal', 'HMD'], ['flat_charcoal', '炭'], ['cube_charcoal', '炭']]) {
        await page.locator(`[data-test="detail-${id}"] .shop-type-mark`).waitFor();
        await tap(page, `detail-${id}`);
        const fallback = page.locator('.shop-detail .shop-type-mark');
        await fallback.waitFor();
        assert.equal(await fallback.innerText(), label);
        await tap(page, 'shop-detail-close');
      }
      assert.equal(aborted.size, 3);
      const before = await snapshot(page);
      const price = await page.evaluate(() => S.data.DB.equipById.cube_charcoal.buy_price);
      if (platform === 'touch') {
        await page.locator('[data-test="buy-cube_charcoal"]').tap();
        await page.locator('[data-test="shop-checkout"]').tap();
      } else {
        await tap(page, 'buy-cube_charcoal'); await tap(page, 'shop-checkout');
      }
      assert.equal((await snapshot(page)).money, before.money - price);
      assert(await page.evaluate(() => S.core.state.owned.includes('cube_charcoal')));
    }, options);
    await run(`${platform}-missing-art-fallback`, async page => {
      // Deliberate network abort exercises the real image error event (not a synthetic dispatch).
      let aborted = 0;
      await page.route('**/img/shop/heaven10/mint.webp', route => { aborted++; return route.abort('aborted'); });
      await setup(page); await open(page);
      const mint = page.locator('[data-test="detail-mint"] .shop-product-art');
      await page.locator('[data-test="detail-mint"] .botanical img').waitFor();
      await page.waitForFunction(() => document.querySelector('[data-test="detail-mint"] img')?.naturalWidth > 0);
      assert.equal(await mint.locator('.shop-type-mark').count(), 0);
      assert(aborted > 0, 'Adopted delivery request was actually blocked');
      await capture(page, `${platform}-failed-delivery-sheet`);
      await tap(page, 'detail-mint');
      await page.locator('.shop-detail .botanical img').waitFor();
      await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
      await capture(page, `${platform}-failed-delivery-detail`);
      await tap(page, 'shop-detail-close');
    }, options);
    await run(`${platform}-both-art-fallback`, async page => {
      // Fresh context: block both URLs BEFORE setup/open; decoded sheet cache cannot mask the failure.
      const aborted = new Set();
      for (const tail of ['heaven10/mint.webp', 'flavors.webp']) {
        await page.route(`**/img/shop/${tail}`, async route => {
          aborted.add(tail); await route.abort('aborted');
        });
      }
      await setup(page); await open(page);
      const mint = page.locator('[data-test="detail-mint"] .shop-product-art');
      await mint.locator('.shop-type-mark').waitFor();
      assert.deepEqual([...aborted].sort(), ['flavors.webp', 'heaven10/mint.webp']);
      assert.equal(await mint.innerText(), 'フレーバー');
      assert.equal(await mint.locator('img').count(), 0);
      await assertFits(page, '[data-test="detail-mint"] .shop-type-mark');
      await capture(page, `${platform}-failed-both-text`);
      await tap(page, 'detail-mint');
      await page.locator('.shop-detail .shop-type-mark').waitFor();
      assert.equal(await page.locator('.shop-detail .shop-type-mark').innerText(), 'フレーバー');
      assert.equal(await page.locator('.shop-detail img').count(), 0);
      await assertFits(page, '.shop-detail .shop-type-mark');
      await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
      await capture(page, `${platform}-failed-both-detail`);
      await tap(page, 'shop-detail-close');
      await tap(page, 'buy-mint');
      assert.equal(await page.locator('.shop-row.selected [data-test="detail-mint"]').count(), 1);
      await tap(page, 'shop-checkout');
      assert.equal((await snapshot(page)).money, 11250);
      assert.equal((await snapshot(page)).stock.mint, 65);
    }, options);
    if (platform === 'compact') continue;
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
      assert.equal(await page.locator('.shop-row.product').count(), 25);
      assert.equal(await page.locator('[data-test="shop-upstairs"]').count(), 0);
      await tap(page, 'buy-mint'); await tap(page, 'buy-mint'); await tap(page, 'buy-blueberry');
      assert.match(await page.locator('.shop-summary').innerText(), /4,650/);
      assert.match(await page.locator('.shop-summary').innerText(), /8,150/);
      assert.equal((await snapshot(page)).money, 12800, 'Quantity selection spent money');
      await assertFits(page, '.shop-back, .shop-checkout, .shop-summary, .shop-tabs');
      await page.locator('[data-category="floral"]').click();
      assert.equal(await page.locator('.shop-row.product').count(), 3);
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
  for (const touch of [false, true]) await run(`first-mint-tutorial-${touch ? 'touch' : 'pc'}`, async page => {
    await setup(page, { day: 1, money: 12800 });
    await page.evaluate(() => { S.core.state.flavorStock.mint = 0; });
    const press = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
    const allState = () => page.evaluate(() => JSON.stringify(S.core.state));
    await open(page, { errand: 'mint', expense: true });
    await page.evaluate(() => S.ui.setBg(S.data.bgUrl('bg_shop'), { fast: true }));
    assert.equal(await page.locator('.shop-row.product').count(), 25, '他の商品を一覧から消さない');
    assert.equal(await page.locator('.shop-errand').getAttribute('data-guide-step'), 'select');
    assert.equal(await page.locator('[data-test="buy-mint"]').getAttribute('data-errand-target'), 'true');
    await assertFits(page, '.shop-errand, [data-test="buy-mint"], .shop-foot');
    await capture(page, `first-errand-${touch ? 'touch' : 'pc'}-select`);
    let before = await allState();
    await press('[data-test="buy-blueberry"]');
    assert.equal(await page.locator('[data-test="quantity-blueberry"]').innerText(), '0');
    assert.equal(await allState(), before, '他フレーバーの購入拒否で状態を変えない');
    assert.match(await page.locator('.toast.warn').last().innerText(), /先に頼まれた.*ミントを購入/);
    assert.doesNotMatch(await page.locator('.toast.warn').last().innerText(), /スミ/);
    await page.evaluate(() => { const b = document.querySelector('[data-test="buy-blueberry"]'); b.click(); b.click(); });
    assert.equal(await page.locator('.toast.warn').count(), 1, '連打で同じ注意が積み重ならない');
    assert.equal(await allState(), before);

    await press('[data-tab="equip"]');
    assert.equal(await page.locator('[data-test="detail-hagal_80beat"]').count(), 1, '機材は表示したまま');
    before = await allState(); await press('[data-test="buy-hagal_80beat"]');
    assert.equal(await allState(), before, '機材を購入させない');
    assert.equal(await page.locator('[data-test="quantity-hagal_80beat"]').innerText(), '0');
    assert.equal(await page.locator('[data-tab="flavor"]').getAttribute('data-errand-target'), 'true');
    await press('[data-tab="kuji"]');
    before = await allState(); await press('[data-test="kuji-g500"]');
    assert.equal(await allState(), before, 'くじ料金・景品・箱順を購入入力で変えない');
    assert.equal(await page.locator('[data-test="kuji-reveal"]').count(), 0);

    await press('[data-tab="flavor"]'); await press('[data-category="fruit"]');
    assert.equal(await page.locator('.shop-errand').getAttribute('data-guide-step'), 'return-filter');
    assert.equal(await page.locator('[data-category="all"]').getAttribute('data-errand-target'), 'true');
    await press('[data-category="all"]'); await press('[data-test="buy-mint"]');
    assert.equal(await page.locator('.shop-errand').getAttribute('data-guide-step'), 'purchase');
    assert.equal(await page.locator('[data-test="shop-checkout"]').getAttribute('data-errand-target'), 'true');
    await capture(page, `first-errand-${touch ? 'touch' : 'pc'}-purchase`);

    // 選択だけでは購入を保存しない。LOAD後は選び直し、古い画面の入力は無効。
    await page.evaluate(() => { S.oldBuy = document.querySelector('[data-test="buy-mint"]'); S.core.save(); S.ui.clearScreen(); S.core.load(); });
    before = await allState(); await page.evaluate(() => S.oldBuy.click());
    assert.equal(await allState(), before);
    await open(page, { errand: 'mint', expense: true });
    assert.equal(await page.locator('[data-test="quantity-mint"]').innerText(), '0');
    await press('[data-test="buy-mint"]'); await press('[data-test="shop-checkout"]');
    assert.equal((await snapshot(page)).money, 12800); assert.equal((await snapshot(page)).stock.mint, 50);
    assert.equal(await page.locator('.shop-errand').getAttribute('data-guide-step'), 'leave');
    assert.equal(await page.locator('[data-test="shop-leave"]').getAttribute('data-errand-target'), 'true');
    await assertFits(page, '.shop-errand, .shop-foot');
    await capture(page, `first-errand-${touch ? 'touch' : 'pc'}-leave`);
    before = await allState(); await page.evaluate(() => document.querySelector('[data-test="shop-checkout"]').click());
    assert.equal(await allState(), before, '確定連打で経費や在庫を二重処理しない');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
    assert.equal(saved.flavorStock.mint, 50); assert.equal(saved.flags._errand_mint_expensed, true);
    await press('[data-test="shop-leave"]');
    await page.evaluate(() => { S.core.state.flags._errand_shop_done = true; }); // calendarの買い出し完了後
    await open(page);
    await press('[data-test="buy-blueberry"]'); await press('[data-test="shop-checkout"]');
    assert.equal((await snapshot(page)).stock.blueberry, 50, '通常営業では他の商品を買える');
    assert.equal((await snapshot(page)).money, 12800 - await page.evaluate(() => S.data.DB.flavorById.blueberry.price));
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

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
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await run(`${platform}-goods-sell-confirm`, async page => {
      await setup(page);
      await page.evaluate(() => {
        S.core.state.owned.push('hagal_80beat');
        S.core.state.goods = [{ name: '限定コラボ・ガラスハガル', sell: 6000 }, { name: '小物B', sell: 20 }];
        S.core.save();
      });
      await open(page); await page.locator('[data-tab="sell"]').click();
      const goodsState = () => page.evaluate(() => ({ money: S.core.state.money, goods: S.core.state.goods,
        saved: localStorage.getItem(S.core.SAVE_KEY) }));
      const before = await goodsState();
      const sell = page.locator('.shop-row').filter({ hasText: '限定コラボ・ガラスハガル' }).getByRole('button');
      await sell.click();
      assert.match(await page.locator('.shop-dialog').innerText(), /限定コラボ・ガラスハガルを6,000円で売りますか？/);
      assert.deepEqual(await goodsState(), before);
      // 背後の別の行を強制クリックしても確認を差し替えない。
      await page.locator('.shop-row').filter({ hasText: '小物B' }).getByRole('button').evaluate(b => b.click());
      await page.locator('[data-test="sell-hagal_80beat"]').evaluate(b => b.click());
      assert.match(await page.locator('.shop-dialog').innerText(), /ガラスハガル/);
      await page.getByRole('button', { name: 'やめる', exact: true }).click();
      assert.deepEqual(await goodsState(), before);
      await sell.click(); await tap(page, 'shop-sell-confirm');
      const after = await goodsState();
      assert.equal(after.money, before.money + 6000);
      assert.deepEqual(after.goods, [{ name: '小物B', sell: 20 }]);
      assert.deepEqual(JSON.parse(after.saved).goods, after.goods);
      assert.equal(JSON.parse(after.saved).money, after.money);
      await page.evaluate(() => S.core.load());
      assert.deepEqual(await goodsState(), after, 'sale survives load');
      await page.evaluate(() => S.ui.clearScreen());
      await open(page); await page.locator('[data-tab="sell"]').click();
      await page.locator('.shop-row').filter({ hasText: '小物B' }).getByRole('button').click();
      await page.evaluate(() => S.core.newGame());
      const fresh = await goodsState();
      await tap(page, 'shop-sell-confirm');
      assert.deepEqual(await goodsState(), fresh, 'confirmation after new game must be inert');
    }, options);
  }
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
    const go = async () => {
      await page.locator('.map:not(.done):not([data-revealing="true"])').waitFor(); // #780: 解錠演出中は選択を受け付けない
      await page.locator('.map:not(.done) [data-test="pin-shop"]').click(); await tap(page, 'map-go');
    };
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
