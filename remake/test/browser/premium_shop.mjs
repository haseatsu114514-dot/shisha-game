// VOL08: 柚ヶ谷店・東京店の機材タブに高級機材と家シーシャの台が並び、詳細で実際に効く値を見せる。
// 購入は1台だけ・SAVE/LOADで二重にならない。地元の1階の品揃えは変えない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, values) {
  await page.evaluate(async values => {
    window.P = { core: await import("./js/core/state.js"), shop: await import("./js/daily/shop.js"),
      ui: await import("./js/core/ui.js"), data: await import("./js/core/data.js"), hud: await import("./js/daily/hud.js") };
    const s = P.core.newGame();
    Object.assign(s, { phase: "daily", day: 4, slot: 0, money: 500000, stamina: 100 }, values);
    s.owned.push("home_rig_set");
    P.ui.clearScreen(); P.hud.initHud({}); P.hud.showHud();
    P.open = opts => { P.done = P.shop.openShop(opts); };
  }, values);
}
const tap = (page, test) => page.locator(`[data-test="${test}"]`).click();
const rowIds = page => page.locator('.shop-row.product .shop-product').evaluateAll(nodes => nodes.map(n => n.dataset.test.replace(/^detail-/, "")));

await suite("premium-shop", async check => {
  await check("widehanga-chapter2", async page => {
    await setup(page, { chapter: 2, flags: { _ch2_region: "widehanga" } });
    await page.evaluate(() => P.open({ branch: "widehanga" }));
    await page.locator('[data-tab="equip"]').click();
    const ids = await rowIds(page);
    for (const id of ["kumogama_phunnel", "dense_flat_charcoal", "stand_stainless"]) assert(ids.includes(id), `${id} は柚ヶ谷店に並ぶ`);
    for (const id of ["lotos_plus", "stand_walnut", "stand_custom", "pipe_middle", "home_rig_pro"]) assert(!ids.includes(id), `${id} は柚ヶ谷店に並ばない`);
    assert.match(await page.locator('[data-test="detail-stand_stainless"] .shop-feature-tags').innerText(), /家シーシャ1回で熟練度の経験値7/);
    await tap(page, "detail-stand_stainless");
    assert.match(await page.locator(".shop-current").innerText(), /家で使用中：ミャア 卓上台/);
    assert.match(await page.locator(".shop-detail .equipment-guide").innerText(), /点数は変わらない/);
    assert.equal(await page.locator(".shop-detail .shop-type-mark").innerText(), "台", "画像が届くまで短い文字の箱");
    assert.equal(await page.locator(".shop-detail .shop-detail-category").innerText(), "シーシャ台");
    await tap(page, "shop-detail-close");
    await tap(page, "buy-stand_stainless");
    assert(await page.locator('[data-test="buy-stand_stainless"]').isDisabled(), "台は1台まで");
    await tap(page, "shop-checkout");
    await page.locator('[data-test="detail-stand_stainless"]').waitFor();
    const saved = await page.evaluate(() => {
      P.core.load();
      return { money: P.core.state.money, count: P.core.state.owned.filter(id => id === "stand_stainless").length };
    });
    assert.deepEqual(saved, { money: 470000, count: 1 });
  });
  await check("tokyo-chapter3", async page => {
    await setup(page, { chapter: 3 });
    await page.evaluate(() => P.open({ branch: "tokyo" }));
    await page.locator('[data-tab="equip"]').click();
    const ids = await rowIds(page);
    for (const id of ["lotos_plus", "stand_walnut", "stand_custom", "kumogama_phunnel"]) assert(ids.includes(id), `${id} は東京店に並ぶ`);
    await tap(page, "detail-lotos_plus");
    const guide = page.locator(".shop-detail .equipment-guide");
    assert.match(await guide.innerText(), /全サイズ対応/);
    await guide.locator("summary").click();
    assert.match(await guide.innerText(), /仕上がり補正 \+2 → \+4/);
    await tap(page, "shop-detail-close");
  });
  await check("home-store-unchanged", async page => {
    await setup(page, { chapter: 5 });
    await page.evaluate(() => P.open({}));
    await page.locator('[data-test="shop-enter"]').click();
    await page.locator('[data-tab="equip"]').click();
    const ids = await rowIds(page);
    assert.equal(ids.length, 8, "地元の1階の機材は第1章の8点のまま");
    assert(!ids.some(id => ["kumogama_phunnel", "lotos_plus", "dense_flat_charcoal", "stand_stainless", "stand_walnut", "stand_custom"].includes(id)));
  });
});
