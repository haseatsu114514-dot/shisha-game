// The first scene must open even while the title's conversation font request is stalled.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failedRequests = [], httpErrors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText || "";
    if (!reason.includes("ERR_ABORTED")) failedRequests.push(`${reason} ${request.url()}`);
  });
  page.on("response", response => { if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`); });

  let releaseFont;
  const heldFont = new Promise(resolve => { releaseFont = resolve; });
  let fontRequests = 0;
  await page.route("**/ZenOldMincho-Blue-Regular.woff2", async route => {
    fontRequests++;
    await heldFont;
    await route.continue();
  });
  try {
    await page.goto(baseURL, { waitUntil: "load" });
    await page.locator("#boot").waitFor({ state: "detached", timeout: 45000 });
    const start = Date.now();
    await page.locator('[data-test="title-new"]').click();
    await page.waitForFunction(() => !!document.querySelector(".vn-text")?.textContent.trim(), null, { timeout: 10000 });
    assert(fontRequests > 0, "The font request was not held");
    assert(Date.now() - start < 10000, "The first line waited too long for the font");
    assert.equal(await page.locator('[data-test="vn-loading"]').count(), 0);
    assert.equal(await page.evaluate(() => document.fonts.status), "loading", "The first line should appear before the font arrives");
    assert.deepEqual(errors, [], JSON.stringify({ failedRequests, httpErrors }));
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(httpErrors, []);
    console.log(`[newgame-font-wait] PASS: first line after ${((Date.now() - start) / 1000).toFixed(2)}s with font request held`);
  } finally {
    releaseFont();
    await page.close();
  }
} finally {
  await browser.close();
}
