// The comic loading screen in the real game (core/loading.js comicLoadingRequired; 2026-11-12 owner
// "漫画はマストで出して欲しい", "決まった場面は毎回出す"):
// - boot is a fixed point: players read one comic and tap (or press Enter) to open the title;
// - chapter starts and resumes (core/ui.js withChapterLoading) show it every time;
// - waits inside a scene (core/ui.js loadingNotice) use the same screen once they pass 0.5 s;
// - the gallery's picture wait stays the small inline notice.
// Automated browsers keep the old behaviour (plain boot gate, small notices), so every other browser
// check reaches the title and its scenes as before.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { LOADING_COMICS } from "../../js/core/loading-comics.js";
import { KNOWN_AT_START } from "../../js/core/state.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
let failed = 0;
async function check(label, body, { mode = null, viewport = { width: 1280, height: 720 }, touch = false, delayGame = 0 } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  if (mode) await context.addInitScript(value => localStorage.setItem("suien_loading_comics", value), mode);
  const page = await context.newPage();
  // Hold the game's entry module so the static boot screen (index.html) stays up long enough to look at.
  if (delayGame) await page.route("**/js/main.js*", async route => { await new Promise(resolve => setTimeout(resolve, delayGame)); await route.continue(); });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  try {
    await page.goto(base);
    await body(page);
    assert.deepEqual(errors, [], "Unexpected browser errors");
    console.log(`[loading-game] PASS: ${label}`);
  } catch (error) {
    failed++;
    console.error(`[loading-game] FAIL: ${label}\n${error.stack || error}`);
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
// While the game itself downloads (index.html #boot, before any module runs), the boot screen already
// shows a new-game comic; the loading screen that follows goes on with the same episode and its art.
for (const [label, options] of [["pc", {}], ["phone-touch", { viewport: { width: 844, height: 390 }, touch: true }]]) {
  await check(`static-boot-screen-shows-the-comic-${label}`, async page => {
    await page.locator("#boot.has-comic .boot-comic.is-ready").waitFor();
    const staticTitle = await page.locator(".boot-comic-title").innerText();
    assert(freshTitles.has(staticTitle), `The boot screen shows a new-game comic, got ${staticTitle}`);
    const fits = await page.evaluate(() => {
      const box = document.querySelector(".boot-comic").getBoundingClientRect();
      return box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
    });
    assert(fits, "The boot screen's comic sheet fits the screen before the stage is fitted");
    await page.locator(".loading-gate.is-ready").waitFor();
    assert.equal(await page.locator(".loading-comic-title").innerText(), staticTitle, "The loading screen goes on with the same comic");
    await page.keyboard.press("Enter");
    await page.locator('[data-test="title-new"]').waitFor();
  }, { mode: "always", delayGame: 2500, ...options });
}
const openTitle = async page => {
  await page.locator(".loading-gate.is-ready").waitFor();
  await page.keyboard.press("Enter");
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator("#boot").waitFor({ state: "detached" });
  // Past the gap in which a gate goes on with the comic just read (core/loading.js FIXED_GAP_MS).
  await page.waitForTimeout(2100);
};
await check("chapter-start-and-resume-show-a-comic-every-time", async page => {
  await openTitle(page);
  await page.evaluate(() => {
    window.__chapter = import("./js/core/ui.js").then(ui => ui.withChapterLoading(() => Promise.resolve({ chapter: 2 }), "第2章の街へ向かっています…"));
  });
  await page.locator(".loading-gate.is-ready").waitFor();
  assert(await page.locator(".loading-panels img").count() === 2, "The chapter loading screen carries a comic");
  assert.equal(await page.evaluate(() => Promise.race([window.__chapter.then(() => "settled"), new Promise(r => setTimeout(() => r("waiting"), 300))])),
    "waiting", "The chapter waits until the reader moves on");
  await page.keyboard.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.__chapter), { chapter: 2 });
  await page.locator(".loading-gate").waitFor({ state: "detached" });
}, { mode: "always" });
await check("scene-waits-use-the-same-loading-screen", async page => {
  await openTitle(page);
  const quick = await page.evaluate(async () => {
    const [{ loadingNotice }, { withLoadingNotice }] = await Promise.all([import("./js/core/ui.js"), import("./js/core/module-loading.js")]);
    let seen = false;
    const observer = new MutationObserver(() => { if (document.querySelector(".loading-gate, .vn-loading")) seen = true; });
    observer.observe(document.body, { subtree: true, childList: true });
    await withLoadingNotice(new Promise(resolve => setTimeout(resolve, 100)), loadingNotice("場面を準備しています…"));
    observer.disconnect();
    window.__wait = withLoadingNotice(new Promise(resolve => setTimeout(() => resolve("prepared"), 1200)), loadingNotice("場面を準備しています…"));
    return seen;
  });
  assert.equal(quick, false, "A short wait inside a scene shows nothing");
  await page.locator(".loading-gate.is-ready").waitFor();
  assert.equal(await page.locator(".vn-loading").count(), 0, "No small notice: the same loading screen as the bench");
  assert.equal(await page.locator(".loading-panels img").count(), 2);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => window.__wait), "prepared");
  await page.waitForTimeout(2100);
  // A failed wait closes the screen without holding the reader, and the failure reaches the caller.
  const failure = await page.evaluate(async () => {
    const [{ loadingNotice }, { withLoadingNotice }] = await Promise.all([import("./js/core/ui.js"), import("./js/core/module-loading.js")]);
    let ready = false;
    const observer = new MutationObserver(() => { if (document.querySelector(".loading-gate.is-ready")) ready = true; });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    const message = await withLoadingNotice(new Promise((_, reject) => setTimeout(() => reject(new Error("offline")), 900)), loadingNotice("場面を準備しています…"))
      .then(() => "resolved", error => error.message);
    await new Promise(resolve => setTimeout(resolve, 400));
    observer.disconnect();
    return { message, ready, closed: !document.querySelector(".loading-gate") };
  });
  assert.deepEqual(failure, { message: "offline", ready: false, closed: true });
  // The gallery's picture wait (not a change of scene) keeps the small inline notice.
  const inline = await page.evaluate(async () => {
    const { loadingNotice } = await import("./js/core/ui.js");
    const notice = loadingNotice("画像を読み込んでいます…", { inline: true });
    notice.onShow();
    const small = !!document.querySelector(".vn-loading[data-test='module-loading']") && !document.querySelector(".loading-gate");
    notice.onHide();
    return small && !document.querySelector(".vn-loading");
  });
  assert.equal(inline, true);
}, { mode: "always" });
await check("automated-boot-stays-plain", async page => {
  await page.locator('[data-test="title-new"]').waitFor();
  assert.equal(await page.locator("#boot.has-comic").count(), 0, "No comic on the static boot screen for automated browsers");
  await page.locator("#boot").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_loading_comics_read")), null, "No comic was shown or recorded");
  // The old small notice and the old chapter wait stay for the existing checks.
  const old = await page.evaluate(async () => {
    const [{ loadingNotice, withChapterLoading }, { withLoadingNotice }] = await Promise.all([import("./js/core/ui.js"), import("./js/core/module-loading.js")]);
    const wait = withLoadingNotice(new Promise(resolve => setTimeout(resolve, 800)), loadingNotice("場面を準備しています…"));
    await new Promise(resolve => setTimeout(resolve, 600));
    const small = !!document.querySelector(".vn-loading[data-test='module-loading']") && !document.querySelector(".loading-gate");
    await wait;
    let gate = false;
    const observer = new MutationObserver(() => { if (document.querySelector(".loading-gate")) gate = true; });
    observer.observe(document.body, { subtree: true, childList: true });
    const value = await withChapterLoading(() => Promise.resolve(5), "第5章へ向かっています…");
    observer.disconnect();
    return { small, gone: !document.querySelector(".vn-loading"), value, gate };
  });
  assert.deepEqual(old, { small: true, gone: true, value: 5, gate: false });
});
await browser.close();
assert.equal(failed, 0, `loading-game: ${failed} failed case(s)`);
