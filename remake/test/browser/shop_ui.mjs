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
const HMD = ['tanukish_lid', 'amaburst_hms']; // 2026-11-11 オーナー採用の絵（#2741）。絵が無いときの「HMD」の札は equipment-art-fallback で見る
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
      const flavors = await decodeRows(27); // 25種＋第1章の新入荷（グレープフルーツ・ハニー、NF02）
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
      assert.equal(equipment.filter(row => row.url).length, 8, 'All eight equipment rows have illustrations, including the newly adopted art');
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
        const suffix = `/equipment-v2/${id}.webp`;
        assert(equipment.find(row => row.id === id)?.url.endsWith(suffix), `${id} uses its adopted illustration`);
        await tap(page, `detail-${id}`);
        const image = page.locator('.shop-detail img');
        await image.evaluate(node => node.decode());
        assert((await image.getAttribute('src')).endsWith(suffix));
        await page.locator('.modal-box.shop-dialog').evaluate(async box => Promise.all(box.getAnimations().map(a => a.finished)));
        await assertFits(page, '.shop-detail .shop-product-art');
        await capture(page, `${platform}-equipment-${id}`);
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
      await assertFits(page, '.shop-floor, .shop-back, .shop-entry .shop-money');
      // 店の入口では左上の HUD の札を隠し、所持金は店のヘッダーに出す（#2958）。右上の LIME・MENU も店の中では出さず、
      // その分パネルを上まで広げる（上下左右 24px の余白。SUI01・オーナー指示 2026-11-11）。
      assert.equal(await page.locator('.hud-card').evaluate(n => getComputedStyle(n).visibility), 'hidden');
      assert.equal(await page.locator('[data-test="hud-menu"]').isVisible(), false);
      assert.equal(await page.locator('[data-test="hud-phone"]').isVisible(), false);
      const stageBox = sel => page.locator(sel).evaluate(n => ({ left: n.offsetLeft - n.offsetWidth / 2, top: n.offsetTop, width: n.offsetWidth, height: n.offsetHeight }));
      assert.deepEqual(await stageBox('.shop-entry'), { left: 24, top: 24, width: 1232, height: 672 });
      assert.match(await page.locator('.shop-entry .shop-money').innerText(), /所持金\s*¥12,800/);
      if (platform === 'touch') {
        // スマホ横持ちでは写真がカードの縦いっぱいに出て、細い帯にならない（#2858 の追加・オーナー指示）。
        const cards = await page.locator('.shop-floor').evaluateAll(nodes => nodes.map(n => ({
          card: n.getBoundingClientRect().height, picture: n.querySelector('.shop-floor-picture').getBoundingClientRect().height })));
        for (const { card, picture } of cards) assert(picture >= 100 && picture >= card * .9, `phone entry photo is tall: ${picture}/${card}`);
      }
      assert.equal(await page.locator('.shop-tabs').count(), 0);
      await tap(page, 'shop-entry-back');
      assert.equal(await page.evaluate(() => S.result), null);
      assert.deepEqual(await snapshot(page), before);
      await page.evaluate(() => S.ui.showScreen("map"));
      assert.equal(await page.locator('.hud-card').evaluate(n => getComputedStyle(n).visibility), 'visible', 'HUD の札は店を出ると戻る');
      assert.equal(await page.locator('[data-test="hud-menu"]').isVisible(), true, 'LIME・MENU も店を出ると戻る');
      assert.equal(await page.locator('[data-test="hud-phone"]').isVisible(), true);
      await page.evaluate(() => S.open());
      await page.locator('[data-test="shop-enter"]').click(); await page.locator('.shop-tabs').waitFor();
      assert.equal(await page.locator('[data-test="hud-menu"]').isVisible(), false, '1Fショップでも LIME・MENU は出さない');
      assert.deepEqual(await stageBox('.shop.shop-paper'), { left: 24, top: 24, width: 1232, height: 672 });
      await assertFits(page, '.shop.shop-paper .shop-head, .shop.shop-paper .shop-foot');
    }, options);
    await run(`${platform}-batch`, async page => {
      await setup(page); await open(page);
      assert.equal(await page.locator('.shop-row.product').count(), 27);
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
    await page.evaluate(() => { S.core.state.day = 5; S.core.state.slot = 1; S.core.state.visitedDay.rio = 5; S.open(); });
    assert(await page.locator('[data-test="shop-upstairs"]').isDisabled());
    assert.match(await page.locator('.showroom').innerText(), /訪問済み/);
    await tap(page, 'shop-entry-back');
    await page.evaluate(() => { delete S.core.state.visitedDay.rio; S.transitions.cueTransition('place', { spotId: 'shop' }); S.open(); });
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
    assert.equal(await page.locator('.shop-row.product').count(), 27, '他の商品を一覧から消さない');
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
    before = await allState(); await press('[data-test="kuji-g1000"]');
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
    await page.locator('[data-tab="kuji"]').click(); await tap(page, 'kuji-g1000');
    assert(await page.locator('[data-test="shop-checkout"]').isHidden());
    await page.locator('.kuji-card.reveal').waitFor(); await tap(page, 'kuji-reveal');
    assert.equal(await page.evaluate(() => S.core.state.kuji.g1000.drawn), 1);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
    assert.equal(saved.kuji.g1000.drawn, 1);
  });
  // KJ11: くじは店ごとに1種類。章が進むと、新しい街の店に上位のくじがある（本店500円・柚ヶ谷店1,000円・東京店3,000円・ドバイ店5,000円。値段は KJ15 で1ランク下げた）。
  // GCH13: 行の下に、その箱の景品の一覧（賞・名前・のこり枚数。ラストワン賞は中身を伏せる）。
  // KJ17・KJ18: 値段に合わせて中身を調整し（ハズレの葉はお試し10g）、箱は40枚前後（本店・柚ヶ谷・東京40枚・ドバイ45枚・限定30枚）。
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await run(`${platform}-kuji-tiers-by-chapter`, async page => {
      const labels = () => page.locator('.kuji-row b').allTextContents();
      await setup(page, { chapter: 2, money: 500000 }); await open(page);
      await page.locator('[data-tab="kuji"]').click();
      assert.deepEqual(await labels(), ["シーシャくじ（1回500円）"], "本店（地元）は第2章でもシーシャくじ1種類");
      assert.match(await page.locator('.kuji-row').first().innerText(), /のこり 40 \/ 40 枚 ・ S賞: 大会公式モデルの台/);
      // 景品の一覧: 箱の景品6種＋ラストワン賞。のこり枚数が出て、ラストワン賞の中身は出さない。横にはみ出さない。
      const lineup = page.locator('[data-test="kuji-lineup-g1000"] .kuji-lineup-item');
      assert.deepEqual(await lineup.evaluateAll(items => items.map(n => [n.dataset.rank, n.querySelector('.kuji-lineup-name').textContent, n.querySelector('.kuji-lineup-left').textContent])), [
        ["S", "大会公式モデルの台", "のこり 1 / 1"], ["A", "クリアパイプ（中級機）", "のこり 1 / 1"], ["A", "人気フレーバー詰め合わせ", "のこり 1 / 1"],
        ["B", "AF ミント（25g）", "のこり 5 / 5"], ["C", "AF ミント（お試し10g）", "のこり 16 / 16"], ["C", "AF ブルーベリー（お試し10g）", "のこり 16 / 16"],
        ["LAST", "最後の1枚に付く・中身は秘密", "のこり 1 / 1"]]);
      assert.doesNotMatch(await page.locator('[data-test="kuji-lineup-g1000"]').innerText(), /ナイトサイド/, "ラストワン賞の中身は伏せる");
      assert.equal(await lineup.evaluateAll(items => items.filter(n => n.scrollWidth > n.clientWidth + 1).length), 0, "一覧の札が横にはみ出さない");
      assert.equal(await lineup.locator('.kuji-lineup-art').evaluateAll(arts => arts.filter(n => !n.firstElementChild).length), 0, "どの景品にも絵か包みが出る");
      if (platform === 'touch') {
        const k = await page.locator('#stage').evaluate(stage => stage.getBoundingClientRect().width / stage.offsetWidth);
        const smallest = await page.locator('.kuji-lineup :is(.kuji-lineup-rank, .kuji-lineup-name, .kuji-lineup-left, .kuji-lineup-head small)').evaluateAll(nodes => Math.min(...nodes.map(n => parseFloat(getComputedStyle(n).fontSize))));
        assert(smallest * k >= 11.4, `一覧の文字は実寸11.5px以上: ${smallest * k}`);
      }
      // 「?」は専用の行を作らず最初のくじの見出しの横に小さく置き、押せる範囲は透明な余白で広げる（#2958）。
      assert.equal(await page.locator('.kuji-help-row').count(), 0);
      assert.equal(await page.locator('.kuji-row').first().locator('[data-test="kuji-help"]').count(), 1);
      assert.equal(await page.locator('.hud-card').evaluate(n => getComputedStyle(n).visibility), 'hidden');
      const help = await page.locator('[data-test="kuji-help"]').evaluate(button => {
        const r = button.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        const span = (dx, dy) => Array.from({ length: 121 }, (_, i) => i - 60).filter(d => document.elementFromPoint(x + d * dx, y + d * dy) === button).length;
        return { width: r.width, stage: button.offsetWidth, across: span(1, 0), down: span(0, 1) };
      });
      assert(help.stage <= 34 && help.width < 40, `「?」の見た目は文字ほどの小さな丸: ${JSON.stringify(help)}`);
      const reach = platform === 'touch' ? 38 : 44;
      assert(help.across >= reach && help.down >= reach, `「?」の押せる範囲は見た目より広い（${reach}px 以上）: ${JSON.stringify(help)}`);
      await tap(page, 'kuji-help'); await page.locator('[data-test="kuji-help-close"]').click();
      assert.equal(await page.locator('.modal-box').filter({ hasText: 'シーシャくじ（1回500円）' }).count(), 0, '「?」で行の詳細は開かない');
      await page.locator('[data-test="shop-leave"]').click();
      // 支店を開いて、その店のくじだけが並ぶことを見る。
      const branchLabels = async (chapter, branch) => {
        await page.evaluate(({ chapter, branch }) => { Object.assign(S.core.state, { chapter, money: 500000 }); S.open({ branch }); }, { chapter, branch });
        await page.locator('.shop-tabs').waitFor(); await page.locator('[data-tab="kuji"]').click();
        return labels();
      };
      // 第2章の柚ヶ谷店: 機材くじ（1回1,000円）だけ。
      assert.deepEqual(await branchLabels(2, "widehanga"), ["機材くじ（1回1,000円）"]);
      assert.match(await page.locator('.kuji-row').first().innerText(), /のこり 40 \/ 40 枚 ・ S賞: ステンレス削り出しの台/);
      // 景品の絵が、賞と名前の字に重ならない（3種セットはパッケージを3つ重ねた絵で、枠からはみ出しやすい）。
      assert.equal(await page.locator('[data-test="kuji-lineup-g3000"] .kuji-lineup-item[data-rank="B"] .kj-art-fan > *').count(), 3);
      assert.deepEqual(await page.locator('.kuji-lineup-item').evaluateAll(items => items.filter(item => {
        const main = item.querySelector('.kuji-lineup-main').getBoundingClientRect();
        return [...item.querySelectorAll('.kuji-lineup-art > *, .kuji-lineup-art .kj-art-fan > *')].some(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right > main.left + 0.5; });
      }).map(item => item.querySelector('.kuji-lineup-name').textContent)), [], "絵が字に重なっている景品");
      assert.equal(await page.locator('.kuji-row').first().locator('[data-test="kuji-help"]').count(), 1, "「?」はどの店でも最初のくじの横");
      await page.locator('[data-test="shop-leave"]').click();
      // 第3章の東京店: 上級機材くじ（1回3,000円）だけ。
      assert.deepEqual(await branchLabels(3, "tokyo"), ["上級機材くじ（1回3,000円）"]);
      assert.match(await page.locator('.kuji-row').first().innerText(), /のこり 40 \/ 40 枚 ・ S賞: くるみ材と真鍮の台/);
      await page.locator('[data-test="shop-leave"]').click();
      // 第4章のドバイ店: 特注台くじ（1回5,000円）だけ。S賞（特注台）を引くと持ち物に入る。
      assert.deepEqual(await branchLabels(4, "dubai"), ["特注台くじ（1回5,000円）"]);
      const top = page.locator('.kuji-row').filter({ has: page.locator('[data-test="kuji-g10000"]') });
      assert.match(await top.innerText(), /のこり 45 \/ 45 枚 ・ S賞: 職人仕立ての特注台/);
      assert.equal(await page.evaluate(() => S.core.state.kuji.g3000.order.length), 40, "柚ヶ谷店の箱は、ほかの街へ行っても残る");
      assert.equal(await page.locator('.kuji-row').evaluateAll(rows => rows.filter(r => r.scrollWidth > r.clientWidth + 1).length), 0, "行が横にはみ出さない");
      // 箱の先頭を S賞・A賞（ロートスプラス）に並べ替え、ロートスプラスは持っておく（持っている機材は中古買い取りの額になる）。
      await page.evaluate(() => {
        const s = S.core.state, box = s.kuji.g10000;
        const first = ["stand_custom", "lotos_plus"].map(id => box.prizes.findIndex(p => p.equipId === id));
        const rest = [...box.order]; for (const i of first) rest.splice(rest.indexOf(i), 1);
        box.order = [...first, ...rest]; s.owned.push("lotos_plus");
      });
      await page.locator('[data-tab="sell"]').click(); await page.locator('[data-tab="kuji"]').click();
      await top.locator('[data-test="kuji-g10000"]').scrollIntoViewIfNeeded(); await tap(page, 'kuji-g10000');
      await page.locator('.kuji-card.reveal').waitFor();
      assert.match(await page.locator('.kuji-card.reveal').innerText(), /S賞[\s\S]*職人仕立ての特注台/);
      assert.equal(await page.locator('.kuji-card.reveal .kuji-dupe').count(), 0);
      await tap(page, 'kuji-reveal');
      let saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
      assert.equal(saved.money, 495000); assert(saved.owned.includes("stand_custom")); assert.equal(saved.kuji.g10000.drawn, 1);
      assert.equal(saved.kuji.g10000.price, 5000, "箱は作った時の1回の値段を持つ");
      // 景品の一覧: 当たったS賞はのこりが無くなり、薄くなる。
      const sItem = page.locator('[data-test="kuji-lineup-g10000"] .kuji-lineup-item[data-rank="S"]');
      assert.equal(await sItem.getAttribute('data-out'), '1'); assert.equal(await sItem.locator('.kuji-lineup-left').textContent(), '');
      assert.match(await page.locator('.kuji-row').first().innerText(), /のこり 44 \/ 45 枚/);
      await tap(page, 'kuji-g10000');
      await page.locator('.kuji-card.reveal').waitFor();
      assert.match(await page.locator('.kuji-card.reveal .kuji-dupe').innerText(), /持っているので、中古買い取りの7,000円を受け取った/);
      await capture(page, `kuji-tiers-dupe-${platform}`);
      await tap(page, 'kuji-reveal');
      saved = await page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
      assert.equal(saved.money, 495000 - 5000 + 7000);
      assert.equal(saved.owned.filter(id => id === "lotos_plus").length, 1, "同じ機材を二つ持たない");
      // 売却タブ: くじで当たった台も、店で買った物と同じ中古買い取りの額（箱の総額は台と機材の売値より高く、買い切って売ってもお金は増えない）。
      await page.locator('[data-tab="sell"]').click();
      assert.match(await page.locator('.shop-row').filter({ has: page.locator('[data-test="sell-stand_custom"]') }).innerText(), /中古買い取り[\s\S]*150,000円で売る/);
      await page.locator('[data-tab="kuji"]').click();
      await capture(page, `kuji-tiers-${platform}`);
    }, options);
  }
  // KJ05・KJ11: 第5章の本店は、シーシャくじが限定台くじ（1回10,000円）に入れ替わり、くじ券の行が並ぶ。行は横にはみ出さず、持っている限定の台はくじ券に替わり、くじ券で1回引ける。
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await run(`${platform}-kuji-limited-ch5`, async page => {
      const labels = () => page.locator('.kuji-row b').allTextContents();
      const savedState = () => page.evaluate(() => JSON.parse(localStorage.getItem(S.core.SAVE_KEY)));
      await setup(page, { chapter: 4, money: 500000 }); await open(page);
      await page.locator('[data-tab="kuji"]').click();
      assert.deepEqual(await labels(), ["シーシャくじ（1回500円）"]);
      assert.equal(await page.locator('[data-test="kuji-g20000"], .kuji-ticket-row').count(), 0, "第4章には限定台くじもくじ券の行も無い");
      await page.locator('[data-test="shop-leave"]').click();
      await page.evaluate(() => { Object.assign(S.core.state, { chapter: 5, money: 500000, kujiTickets: 0 }); S.open(); });
      await page.locator('[data-test="shop-enter"]').click();
      await page.locator('.shop-tabs').waitFor(); await page.locator('[data-tab="kuji"]').click();
      assert.deepEqual(await labels(), ["限定台くじ（1回10,000円）"], "第5章の本店は限定台くじ1種類");
      assert.equal(await page.locator('[data-test="kuji-lineup-g20000"] .kuji-lineup-item').count(), 13, "景品12種＋ラストワン賞");
      assert.match(await page.locator('[data-test="kuji-lineup-g20000"]').innerText(), /各地の葉 3種セット（各25g）[\s\S]*のこり 4 \/ 4/);
      assert.equal(await page.locator('[data-test="kuji-lineup-g20000"] .kuji-lineup-item[data-rank="S"]').count(), 3, "S賞はくじ限定の台3種");
      assert.equal(await page.locator('[data-test="kuji-row-g20000"] [data-test="kuji-help"]').count(), 1);
      const row = page.locator('[data-test="kuji-row-g20000"]');
      const ticketRow = page.locator('[data-test="kuji-ticket-row-g20000"]');
      const ticket = page.locator('[data-test="kuji-g20000-ticket"]');
      assert.match(await row.innerText(), /のこり 30 \/ 30 枚 ・ S賞: くじ限定の台3種/);
      assert.match(await ticketRow.innerText(), /くじ券 0枚/);
      assert.equal(await ticket.innerText(), "くじ券で引く（残り0枚）");
      assert(await ticket.isDisabled(), "0枚では押せない");
      await ticketRow.scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.kuji-row, .kuji-ticket-row').evaluateAll(rows => rows.filter(r => r.scrollWidth > r.clientWidth + 1).length), 0, "行が横にはみ出さない");
      await assertFits(page, '[data-test="kuji-ticket-row-g20000"] .btn');
      await assertFits(page, '[data-test="kuji-row-g20000"] .kuji-actions .btn');
      await capture(page, `kuji-limited-row-${platform}`);
      // 行を押すと、S賞の限定の台3種の名前とくじ券の決まりが読める。見出しの横の「?」は案内で、押せる範囲が
      // 見た目より広い（72px 四方）ので、「?」から離れた左端の券の印を押す。
      await row.locator('.kuji-cat').click();
      const detail = await page.locator('.modal-box.shop-dialog').innerText();
      assert.match(detail, /MELTY PUFF柄の特注台・橙須限定色の特注台・名入れの特注台（逢縁）/);
      assert.match(detail, /くじ券1枚に替わる/);
      await tap(page, 'kuji-detail-close');
      // 箱の先頭を限定の台にして、それを持っておく → お金ではなくくじ券1枚。
      await page.evaluate(() => {
        const s = S.core.state, box = s.kuji.g20000;
        const first = box.prizes.findIndex(p => p.equipId === "stand_custom_melty");
        const rest = [...box.order]; rest.splice(rest.indexOf(first), 1);
        box.order = [first, ...rest]; s.owned.push("stand_custom_melty");
      });
      await page.locator('[data-tab="sell"]').click();
      assert.match(await page.locator('[data-test="sell-locked-stand_custom_melty"]').locator('..').innerText(), /くじ限定の台なので売れない/);
      await page.locator('[data-tab="kuji"]').click();
      await row.locator('[data-test="kuji-g20000"]').scrollIntoViewIfNeeded(); await tap(page, 'kuji-g20000');
      await page.locator('.kuji-card.reveal').waitFor();
      assert.match(await page.locator('.kuji-card.reveal').innerText(), /S賞[\s\S]*MELTY PUFF柄の特注台/);
      assert.match(await page.locator('.kuji-card.reveal .kuji-dupe').innerText(), /持っているので、くじ券を1枚受け取った/);
      await capture(page, `kuji-limited-dupe-${platform}`);
      await tap(page, 'kuji-reveal');
      let saved = await savedState();
      assert.equal(saved.money, 490000, "1回分だけ払い、買い取りのお金は無い");
      assert.equal(saved.kujiTickets, 1);
      assert.equal(saved.owned.filter(id => id === "stand_custom_melty").length, 1);
      assert.equal(await ticket.innerText(), "くじ券で引く（残り1枚）");
      await ticket.scrollIntoViewIfNeeded(); await ticket.click();
      await page.locator('.kuji-card.reveal').waitFor(); await tap(page, 'kuji-reveal');
      saved = await savedState();
      assert.equal(saved.money, 490000, "くじ券で引くとお金は使わない");
      assert.equal(saved.kujiTickets, 0);
      assert.equal(saved.kuji.g20000.drawn, 2);
      assert(await ticket.isDisabled());
      await capture(page, `kuji-limited-${platform}`);
    }, options);
  }
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
          if (saved.day === 5 && saved.slot === 2 && saved.visitedDay.rio === 5 && !S.showroomSave) S.showroomSave = saved;
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
    assert.equal(await page.evaluate(() => S.core.state.visitedDay.rio), 5);
    await go(); assert(await page.locator('[data-test="shop-upstairs"]').isDisabled());
  });
  await run('ch5-counter-direct-leave', async page => {
    // 第5章の本店スポットは階を選ばず1階へ直行する（ch5-daily.js の呼び方）。
    // errand: true の誤用で退出が永久に塞がれた事故の回帰（詳細を閉じた後に店を出られない）。
    await setup(page, { chapter: 5 });
    await page.evaluate(() => S.open({ direct: true }));
    await page.locator('.shop-tabs').waitFor();
    assert.equal(await page.locator('[data-test="shop-enter"]').count(), 0, '階の選択を出さず1階へ直行する');
    assert.equal(await page.locator('.shop-errand').count(), 0, '買い出しでない来店に案内は出ない');
    await tap(page, 'detail-mint');
    await tap(page, 'shop-detail-close');
    await tap(page, 'shop-leave');
    await page.waitForFunction(() => S.result !== "pending");
    assert.equal(await page.evaluate(() => S.result), null, '詳細を閉じた後も店を出られる');
  });
});
