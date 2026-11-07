// #2789: 縦持ちではDS風の章タイトル・ショップ・ショップ入口を回転ガードで封じる。
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
const assertGuard = async (page, screen) => {
  await page.waitForFunction(expected => document.body.dataset.screen === expected, screen);
  assert.equal(await page.locator("#rotate-hint").isVisible(), true, `${screen}: 回転ガードが見える`);
  assert.match(await page.locator("#rotate-hint").textContent(), /スマホは横向きでお楽しみください/);
  const coverage = await page.evaluate(() => {
    const guard = document.querySelector("#rotate-hint");
    const rect = guard.getBoundingClientRect();
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      covers: rect.left <= 0 && rect.top <= 0 && rect.right >= innerWidth && rect.bottom >= innerHeight,
      intercepts: hit === guard || guard.contains(hit),
    };
  });
  assert.deepEqual(coverage, { covers: true, intercepts: true }, `${screen}: ガードが画面を覆い入力を遮る`);
  assert.equal(await page.locator("body").evaluate(node => node.classList.contains("game-ds-fallback")), false);
};

await suite("portrait-shop-rotate-guard", async check => {
  await check("ds-portrait-guards-shop-and-entry", async page => {
    await setup(page);
    await assertGuard(page, "none");
    await page.evaluate(() => openTestShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" }));
    await assertGuard(page, "shop");
    assert.equal(await page.locator('[data-test="buy-lemon"]').count(), 1);
    await page.evaluate(async () => {
      const ui = await import("./js/core/ui.js");
      ui.showScreen("none", document.createElement("section"));
      openTestShop();
    });
    await assertGuard(page, "shop-entry");
    assert.equal(await page.locator('[data-test="shop-enter"]').count(), 1);
    await page.evaluate(async () => (await import("./js/core/ui.js")).showScreen("map", document.createElement("section")));
    await page.waitForFunction(() => document.body.classList.contains("game-ds"));
    await assertGuard(page, "map");
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check("normal-portrait-keeps-guard", async page => {
    await page.evaluate(() => {
      localStorage.setItem("suien_title_layout", "normal");
      window.dispatchEvent(new Event("display-layout-change"));
    });
    await setup(page);
    await assertGuard(page, "none");
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check("landscape-shop-and-supported-map", async page => {
    await setup(page);
    await page.waitForFunction(() => document.body.dataset.gameLayout === "ds");
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
    await page.evaluate(() => openTestShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" }));
    await page.waitForFunction(() => document.body.dataset.screen === "shop");
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
    assert.equal(await page.locator('[data-test="buy-lemon"]').isVisible(), true);
    assert.equal(await page.locator("#viewport").evaluate(node => getComputedStyle(node).overflowX), "clip");
    await page.evaluate(async () => (await import("./js/core/ui.js")).showScreen("map", document.createElement("section")));
    await page.waitForFunction(() => document.body.classList.contains("game-ds"));
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
}, { initScript: chooseDs });
