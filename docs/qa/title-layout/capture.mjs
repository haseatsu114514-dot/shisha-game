// Same approved original art in every comparison; disposable browser contexts.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(new URL("../../../remake/test/browser/support.mjs", import.meta.url))("playwright");
const out = fileURLToPath(new URL("./", import.meta.url));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  for (const [device, options] of [["pc", { viewport: { width: 1280, height: 720 } }],
    ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const context = await browser.newContext(options); const page = await context.newPage();
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 35000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    const selected = await page.evaluate(async () => {
      const { DB, assetUrl } = await import("./js/core/data.js");
      const { newState, SAVE_KEY } = await import("./js/core/state.js");
      const state = newState(); Object.assign(state, { phase: "daily", day: 6, slot: 1, money: 45678 });
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const { prepareTitleArt } = await import("./js/scenes/title-art.js");
      const { showTitle } = await import("./js/scenes/title.js");
      const original = DB.manifest.titleArts.find(a => a.character === "hiyori");
      showTitle(await prepareTitleArt({ ...original, url: assetUrl(`ui/title_arts/${original.file}`) }));
      for (const animation of document.querySelector(".title").getAnimations({ subtree: true })) {
        if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
      }
      return original;
    });
    await page.screenshot({ path: out + `${device}-normal.png` });
    if (device === "phone") {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.screenshot({ path: out + "phone-normal-landscape.png" });
      await page.setViewportSize(options.viewport);
    }
    await page.locator('[data-test="title-layout-ds"]').click();
    await page.screenshot({ path: out + `${device}-ds.png` });
    await page.locator('[data-test="title-gallery"]').focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("data-test"), "title-config");
    await page.keyboard.press("Enter"); await page.locator("#modal.show .cfg").waitFor();
    await page.locator("#modal.show .modal-actions button").click();
    fs.writeFileSync(out + "comparison-art.json", JSON.stringify(selected, null, 2) + "\n");
    await context.close();
  }
} finally { await browser.close(); }
