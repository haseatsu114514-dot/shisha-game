// #2772: 縦持ちDS風の章カード・レモン仕入れ・ショップ入口を実画面で確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const chooseDs = () => localStorage.setItem("suien_title_layout", "ds");
const setup = page => page.evaluate(async () => {
  const core = await import("./js/core/state.js");
  const ui = await import("./js/core/ui.js");
  const shop = await import("./js/daily/shop.js");
  const state = core.newGame();
  Object.assign(state, { phase: "daily", day: 1, slot: 1, money: 12800, stamina: 100 });
  ui.clearScreen();
  window.openTestShop = options => { window.shopResult = shop.openShop(options); };
  ui.showScreen("none", document.createElement("section"));
});
const visibleFallback = async (page, screen) => {
  await page.waitForFunction(expected => document.body.dataset.screen === expected &&
    document.body.classList.contains("game-ds-fallback"), screen);
  assert.equal(await page.locator("#rotate-hint").isVisible(), false);
  assert.equal(await page.locator("#viewport").evaluate(node => getComputedStyle(node).overflowX), "auto");
};

await suite("portrait-shop-fallback", async check => {
  await check("ds-portrait-lemon-and-entry", async page => {
    await setup(page);
    await visibleFallback(page, "none");
    await page.evaluate(() => openTestShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" }));
    await visibleFallback(page, "shop");
    assert((await page.locator("#viewport").evaluate(node => node.scrollWidth)) > 390);
    await page.locator('[data-test="buy-lemon"]').tap();
    await page.locator('[data-test="shop-checkout"]').tap();
    await page.locator('[data-test="shop-leave"]').tap();
    assert.equal(await page.evaluate(() => window.shopResult), null);
    assert((await page.evaluate(async () => (await import("./js/core/state.js")).state.flavorStock.lemon)) > 0);
    await page.evaluate(() => openTestShop());
    await visibleFallback(page, "shop-entry");
    await page.locator('[data-test="shop-enter"]').tap();
    await visibleFallback(page, "shop");
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check("normal-portrait-keeps-guard", async page => {
    await page.evaluate(() => {
      localStorage.setItem("suien_title_layout", "normal");
      window.dispatchEvent(new Event("display-layout-change"));
    });
    await setup(page);
    assert.equal(await page.locator("#rotate-hint").isVisible(), true);
    assert.equal(await page.locator("body").evaluate(node => node.classList.contains("game-ds-fallback")), false);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check("landscape-and-supported-map", async page => {
    await setup(page);
    await page.waitForFunction(() => document.body.classList.contains("game-ds-fallback"));
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
    assert.equal(await page.locator("#viewport").evaluate(node => getComputedStyle(node).overflowX), "hidden");
    await page.evaluate(async () => (await import("./js/core/ui.js")).showScreen("map", document.createElement("section")));
    await page.waitForFunction(() => document.body.classList.contains("game-ds"));
    assert.equal(await page.locator("body").evaluate(node => node.classList.contains("game-ds-fallback")), false);
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
}, { initScript: chooseDs });
