import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}), chromiumSandbox: false });
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 640, height: 360 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, hasTouch: viewport.width !== 1280 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(async () => {
      const { newGame } = await import("./js/core/state.js"); newGame();
      const { resultTable } = await import("./js/craft/result.js");
      window.cardSession = { mode: "tournament", chapter: 1, total: 72,
        mix: { double_apple: 9.5, mint: 2.5 }, holes: { score: 72 }, parts: { holes: 72, heat: 72, shisha: 72, care1: 72, care2: 72 } };
      window.beforeCard = JSON.stringify(cardSession);
      window.cardResult = resultTable(cardSession, 3);
      document.querySelector("#boot")?.remove();
    });
    const save = page.locator('[data-test="result-save"]');
    await save.scrollIntoViewIfNeeded();
    const next = page.locator('[data-test="result-next"]');
    const box = await save.boundingBox(), nextBox = await next.boundingBox();
    assert(box && nextBox);
    assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
    assert(box.y + box.height <= nextBox.y || box.y >= nextBox.y + nextBox.height || box.x + box.width <= nextBox.x || box.x >= nextBox.x + nextBox.width);
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    for (let repeat = 0; repeat < 2; repeat++) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }), save.click(),
      ]).catch(async error => {
        await page.screenshot({ path: `/tmp/craft-result-failed-${viewport.width}.png` });
        console.error(await page.locator(".rt-save").innerText(), await save.isDisabled());
        throw error;
      });
      assert.match(download.suggestedFilename(), /^shisha-result-\d{8}-\d{4}\.png$/);
      assert.equal(await download.failure(), null);
      const png = await readFile(await download.path());
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert(png.length > 1000);
      if (viewport.width === 1280 && repeat === 0) await writeFile("/tmp/craft-result-card.png", png);
      assert.equal(png.readUInt32BE(16), 960);
      assert(png.readUInt32BE(20) >= 720);
      await page.waitForFunction(() => !document.querySelector('[data-test="result-save"]').disabled);
    }
    assert(!requests.some(url => !url.startsWith("data:") && !url.startsWith("http://127.0.0.1:")), "Saving makes no external request");
    assert(await page.evaluate(() => JSON.stringify(cardSession) === beforeCard));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/craft-result-${viewport.width}.png` });
    await next.click();
    await page.evaluate(() => cardResult);
    console.log(`PASS craft result PNG download ${viewport.width}x${viewport.height}`);
    await context.close();
  }
} finally {
  await browser.close();
}
