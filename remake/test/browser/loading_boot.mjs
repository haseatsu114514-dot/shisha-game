// The game's boot is a fixed point of the comic loading screen (core/loading.js comicLoadingRequired):
// players read one comic and tap (or press Enter) to open the title. Automated browsers keep the plain
// boot gate (no comic, no hold), so every other browser check reaches the title as before.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { LOADING_COMICS } from "../../js/core/loading-comics.js";
import { KNOWN_AT_START } from "../../js/core/state.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
let failed = 0;
async function check(label, body, { mode = null, viewport = { width: 1280, height: 720 }, touch = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  if (mode) await context.addInitScript(value => localStorage.setItem("suien_loading_comics", value), mode);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  try {
    await page.goto(base);
    await body(page);
    assert.deepEqual(errors, [], "Unexpected browser errors");
    console.log(`[loading-boot] PASS: ${label}`);
  } catch (error) {
    failed++;
    console.error(`[loading-boot] FAIL: ${label}\n${error.stack || error}`);
  } finally { await context.close(); }
}

const freshTitles = new Map(LOADING_COMICS.filter(comic => comic.minChapter === 1 && comic.cast.every(id => KNOWN_AT_START.includes(id)))
  .map(comic => [comic.title, comic.id]));
assert(freshTitles.size > 0, "a first boot has comics to show");

for (const [label, options] of [["pc", {}], ["phone-touch", { viewport: { width: 844, height: 390 }, touch: true }]]) {
  await check(`boot-shows-a-comic-${label}`, async page => {
    await page.locator(".loading-gate.is-ready").waitFor();
    const title = await page.locator(".loading-comic-title").innerText();
    assert(freshTitles.has(title), `Without a save, the boot comic is one of the people a new game has met, got ${title}`);
    assert.equal(await page.locator('[data-test="title-new"]').count(), 0, "The title waits until the reader moves on");
    if (options.touch) {
      assert.equal(await page.locator(".loading-proceed").innerText(), "タップで進む");
      await page.locator(".loading-gate").tap();
    } else {
      assert.equal(await page.locator(".loading-proceed").innerText(), "クリック・Enter で進む");
      await page.keyboard.press("Enter");
    }
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_loading_comics_read"))), [freshTitles.get(title)],
      "The boot comic counts as read once the reader moves on");
  }, { mode: "always", ...options });
}
await check("automated-boot-stays-plain", async page => {
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator("#boot").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_loading_comics_read")), null, "No comic was shown or recorded");
});
await browser.close();
assert.equal(failed, 0, `loading-boot: ${failed} failed case(s)`);
