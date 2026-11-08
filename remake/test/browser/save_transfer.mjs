// セーブの書き出し／読み込み・全画面の案内（#2856）。保存形式は変えず、今の保存内容を包んで往復できること。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const SAVED = { day: 9, money: 31415, phase: "daily", slot: 1 };
const KEYS = ["suien_remake_save", "suien_remake_slot1"];

async function seed(page) {
  await page.evaluate(async (v) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: v.phase, day: v.day, slot: v.slot, money: v.money, seed: 77 });
    core.saveToSlot(core.SAVE_SLOTS[1].key);
  }, SAVED);
}
const openConfig = async (page) => {
  await page.evaluate(async () => { (await import("./js/scenes/title.js")).openConfig(); });
  await page.locator('[data-test="save-export"]').waitFor();
};
const rawOf = (page) => page.evaluate((keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), KEYS);
// 実寸（画面に出た大きさ）が基準を満たすか。ゲーム全体が縮小表示されるので getBoundingClientRect で測る
const assertSizes = async (page, selector) => {
  const sizes = await page.locator(selector).evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(), k = n.offsetHeight ? r.height / n.offsetHeight : 1;
    return { text: n.textContent.trim(), h: r.height, w: r.width, font: parseFloat(getComputedStyle(n).fontSize) * k };
  }));
  assert(sizes.length > 0, `no target ${selector}`);
  for (const s of sizes) assert(s.h >= 38 && s.w >= 38 && s.font >= 11, `too small: ${JSON.stringify(s)}`);
};
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

await suite("save-transfer", async check => {
  for (const [label, viewport] of [["844x390", { width: 844, height: 390 }], ["844x340", { width: 844, height: 340 }]]) {
    await check(`roundtrip-and-sizes-${label}`, async page => {
      await seed(page);
      const before = await rawOf(page);
      await openConfig(page);
      await assertSizes(page, '[data-test="save-transfer"] button');
      await page.locator('[data-test="save-export"]').click();
      await assertSizes(page, ".xfer-box .modal-actions button");
      const text = await page.locator('[data-test="export-text"]').inputValue();
      assert.match(text, /^SUIEN-SAVE1:/);
      // 往復: 保存を空にしたプロファイルへ読み込むと、同じ内容で再開できる
      await page.locator('[data-test="export-close"]').click();
      await page.evaluate((keys) => keys.forEach(k => localStorage.removeItem(k)), KEYS);
      await page.locator('[data-test="save-import"]').click();
      await page.locator('[data-test="import-text"]').fill(text);
      await page.locator('[data-test="import-go"]').click();
      await page.evaluate(() => { window.__beforeReload = true; });
      await page.locator('[data-test="import-confirm"]').click();
      await page.waitForFunction(() => !window.__beforeReload, null, { timeout: 15000 });
      await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
      assert.deepEqual(await rawOf(page), before);
      const s = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_slot1")));
      assert.equal(s.day, SAVED.day); assert.equal(s.money, SAVED.money);
    }, { viewport, hasTouch: true });
  }

  await check("broken-text-is-rejected-and-save-kept", async page => {
    await seed(page);
    const before = await rawOf(page);
    await openConfig(page);
    const b64 = (o) => "SUIEN-SAVE1:" + Buffer.from(JSON.stringify(o)).toString("base64");
    const bads = ["こわれた文字列", "SUIEN-SAVE1:@@@",
      b64({ format: "suien-save", version: 1, slots: { suien_remake_slot1: "[1]" } }),
      b64({ format: "suien-save", version: 1, slots: { suien_remake_slot1: JSON.stringify({ day: 3, schema: 99999 }) } })];
    for (const bad of bads) {
      await page.locator('[data-test="save-import"]').click();
      await page.locator('[data-test="import-text"]').fill(bad);
      await page.locator('[data-test="import-go"]').click();
      await page.locator('[data-test="import-error-ok"]').click();
    }
    assert.deepEqual(await rawOf(page), before);
  });

  await check("confirm-cancel-keeps-save", async page => {
    await seed(page);
    await openConfig(page);
    await page.locator('[data-test="save-export"]').click();
    const text = await page.locator('[data-test="export-text"]').inputValue();
    await page.locator('[data-test="export-close"]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("suien_remake_slot1")); s.money = 1; localStorage.setItem("suien_remake_slot1", JSON.stringify(s)); });
    const before = await rawOf(page);
    await page.locator('[data-test="save-import"]').click();
    await page.locator('[data-test="import-text"]').fill(text);
    await page.locator('[data-test="import-go"]').click();
    await page.locator('[data-test="import-abort"]').click();
    assert.deepEqual(await rawOf(page), before);
  });

  await check("iphone-shows-home-screen-notice", async page => {
    await openConfig(page);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 0);
    await assertSizes(page, '[data-test="a2hs-help"]');
    await page.locator('[data-test="a2hs-help"]').click();
    const t = await page.locator('[data-test="a2hs-notice"]').textContent();
    for (const w of ["ホーム画面に追加", "ツールバーを非表示", "横向きのタブバー", "先にここで「書き出し」"]) assert(t.includes(w), w);
  }, { userAgent: iphone, viewport: { width: 844, height: 390 }, hasTouch: true });

  await check("standalone-hides-notice", async page => {
    await page.evaluate(() => Object.defineProperty(navigator, "standalone", { value: true, configurable: true }));
    await openConfig(page);
    assert.equal(await page.locator('[data-test="a2hs-help"]').count(), 0);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 0);
  }, { userAgent: iphone, viewport: { width: 844, height: 390 }, hasTouch: true });

  await check("desktop-shows-fullscreen-button", async page => {
    await openConfig(page);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 1);
    assert.equal(await page.locator('[data-test="a2hs-help"]').count(), 0);
  });

  // #3013: 同じボタンで全画面化／解除の両方ができ、表示名が実状態へ追随すること（Fullscreen API はスタブで切り替える）
  await check("fullscreen-button-toggles", async page => {
    await page.evaluate(() => {
      let fs = null;
      Object.defineProperty(document, "fullscreenElement", { get: () => fs, configurable: true });
      document.documentElement.requestFullscreen = async () => { fs = document.documentElement; document.dispatchEvent(new Event("fullscreenchange")); };
      document.exitFullscreen = async () => { fs = null; document.dispatchEvent(new Event("fullscreenchange")); };
    });
    await openConfig(page);
    const btn = page.locator('[data-test="fullscreen"]');
    assert.equal(await btn.textContent(), "全画面");
    await btn.click();
    await page.waitForFunction(() => document.querySelector('[data-test="fullscreen"]')?.textContent === "全画面を解除");
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), true);
    await btn.click();
    await page.waitForFunction(() => document.querySelector('[data-test="fullscreen"]')?.textContent === "全画面");
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  });

  await check("manifest-is-linked-and-landscape", async page => {
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const m = await page.evaluate(async (h) => (await fetch(h)).json(), href);
    assert.equal(m.display, "fullscreen"); assert.equal(m.orientation, "landscape");
    assert(m.icons.length >= 2);
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute("content"), "yes");
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute("content"), "black-translucent");
    assert.equal(await page.locator('link[rel="apple-touch-icon"]').count(), 1);
  });
});
