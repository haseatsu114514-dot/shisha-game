import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = new URL("trpg-preview.html", process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/trpg");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];

async function hit(page, selector) {
  const locator = page.locator(selector);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
async function nextLines(page, keyboard = false) {
  for (let n = 0; n < 60; n++) {
    const next = page.locator('[data-test="trpg-next"]');
    if (!await next.isVisible()) return;
    if (keyboard) await page.keyboard.press("Enter"); else await hit(page, '[data-test="trpg-next"]');
  }
  throw new Error("Dialogue did not terminate");
}
async function checkRoll(page, { support = null, reroll = false } = {}) {
  if (support) await hit(page, '[data-test="trpg-support-' + support + '"]');
  await hit(page, '[data-test="trpg-roll"]');
  await page.locator('[data-test="trpg-settle"]').waitFor();
  if (reroll) await hit(page, '[data-test="trpg-reroll-0"]');
  await hit(page, '[data-test="trpg-settle"]');
  await nextLines(page);
}
async function begin(page, keyboard = false) {
  const start = page.locator('[data-test="trpg-start"]');
  if (keyboard) await start.press("Enter"); else await hit(page, '[data-test="trpg-start"]');
  await nextLines(page, keyboard);
  await checkRoll(page);
  assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "explore");
}
async function explore(page) {
  for (const id of ["menu", "window", "bag"]) {
    await hit(page, '[data-test="trpg-spot-' + id + '"]');
    await nextLines(page);
  }
  await hit(page, '[data-test="trpg-consult-tsumugi"]');
  await nextLines(page);
  await hit(page, '[data-test="trpg-interpret"]');
  await hit(page, '[data-test="trpg-hypothesis-quiet"]');
  await nextLines(page);
}
async function finish(page, choices) {
  await hit(page, '[data-test="trpg-plan-aroma-' + choices.aroma + '"]');
  await hit(page, '[data-test="trpg-plan-seat-' + choices.seat + '"]');
  await hit(page, '[data-test="trpg-prepare-open"]');
  await checkRoll(page, { support: "naru" });
  await hit(page, '[data-test="trpg-plan-approach-' + choices.approach + '"]');
  await hit(page, '[data-test="trpg-serve-open"]');
  await checkRoll(page, { support: "tsumugi" });
}
async function fits(page) {
  const clips = await page.locator("button:not([hidden]), .trpg-speech p").evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return nodes.filter(n => n.offsetWidth && n.offsetHeight).filter(n => {
      const r = n.getBoundingClientRect();
      return r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1
        || r.bottom > stage.bottom + 1 || n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1;
    }).map(n => ({ text: n.textContent, width: n.clientWidth, scroll: n.scrollWidth }));
  });
  assert.deepEqual(clips, [], "Clipped controls or dialogue");
}
async function run(label, params, options, body) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    set.call(localStorage, "suien_remake_save", '{"schema":11,"day":8,"sentinel":"existing-player"}');
    set.call(localStorage, "suien_remake_slot1", "manual-save-sentinel");
    set.call(sessionStorage, "unrelated-tab", "keep-me");
    window.__storageTouches = [];
    for (const key of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function(...args) { window.__storageTouches.push([key, ...args]); return original.apply(this, args); };
    }
    window.__originalStorageGet = get;
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) errors.push(response.status() + " " + response.url()); });
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    await page.goto(url.href);
    await page.locator('[data-test="trpg-start"]').waitFor();
    await body(page);
    await fits(page);
    assert.deepEqual(errors, []);
    const storage = await page.evaluate(() => ({
      touches: __storageTouches,
      save: __originalStorageGet.call(localStorage, "suien_remake_save"),
      slot: __originalStorageGet.call(localStorage, "suien_remake_slot1"),
      other: __originalStorageGet.call(sessionStorage, "unrelated-tab"),
    }));
    assert.deepEqual(storage.touches, [], "The prototype accessed browser storage");
    assert.equal(storage.save, '{"schema":11,"day":8,"sentinel":"existing-player"}');
    assert.equal(storage.slot, "manual-save-sentinel");
    assert.equal(storage.other, "keep-me");
    await page.screenshot({ path: path.join(artifacts, label + ".png") });
    results.push({ label, status: "passed" });
    console.log("PASS " + label);
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, label + "-failed.png") }).catch(() => {});
    results.push({ label, status: "failed", error: error.stack, errors });
    console.error("FAIL " + label + "\n" + error.stack);
  } finally { await context.close(); }
}

try {
  await run("cover-pc", { seed: "9", traveler: "quiet" }, {}, async page => {
    await fits(page);
    await page.locator('[data-test="trpg-cover-help"]').click();
    await fits(page); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-overlay").count(), 0);
  });
  await run("quiet-pc-keyboard", { seed: "9", traveler: "quiet" }, {}, async page => {
    await begin(page, true);
    await page.screenshot({ path: path.join(artifacts, "explore-pc.png") });
    await page.locator('[data-test="trpg-spot-notebook"]').press("Enter");
    await nextLines(page, true);
    await page.locator('[data-test="trpg-clue-notebook"]').click();
    await page.keyboard.press("Escape");
    await explore(page);
    await page.screenshot({ path: path.join(artifacts, "prepare-pc.png") });
    await finish(page, { aroma: "tea", seat: "window", approach: "quiet" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "雨音のある一台");
    await page.locator('[data-test="trpg-finish"]').click();
    await page.locator('[data-test="trpg-start"]').waitFor();
    assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 2);
  });
  await run("home-touch", { seed: "3", traveler: "home" },
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, async page => {
      await page.locator('[data-test="trpg-start"]').tap();
      await nextLines(page); await checkRoll(page);
      await explore(page); await finish(page, { aroma: "tea", seat: "shelf", approach: "memory" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "帰り道の一台");
    });
  await run("company-pc", { seed: "15", traveler: "company" }, {}, async page => {
    await begin(page); await explore(page);
    await finish(page, { aroma: "fruit", seat: "counter", approach: "company" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "話の始まる一台");
  });
  await run("discovery-small-touch", { seed: "12", traveler: "quiet" },
    { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true }, async page => {
      await begin(page); await explore(page);
      await finish(page, { aroma: "spice", seat: "counter", approach: "company" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "一緒に見つけた一台");
    });
  await run("reroll-cancel-and-low-motion", { seed: "8", traveler: "quiet" },
    { reducedMotion: "reduce" }, async page => {
      await page.locator('[data-test="trpg-start"]').click();
      await nextLines(page);
      await checkRoll(page, { reroll: true });
      assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 1);
      await page.locator('[data-test="trpg-log"]').click();
      assert((await page.locator(".trpg-log-line").count()) > 5);
      await page.keyboard.press("Escape");
      await page.locator('[data-test="trpg-exit"]').click();
      await page.locator('[data-test="trpg-exit-confirm"]').click();
      await page.locator('[data-test="trpg-start"]').waitFor();
      assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "cover");
    });
  await run("portrait-touch-hint", { seed: "1" },
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
      assert(await page.locator("#trpg-rotate").isVisible());
      await page.setViewportSize({ width: 844, height: 390 });
      await page.locator("#trpg-rotate").waitFor({ state: "hidden" });
      await fits(page);
    });
  await run("double-input-and-integration-abort", { seed: "13", traveler: "quiet" }, {}, async page => {
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page);
    await page.locator('[data-test="trpg-roll"]').evaluate(node => { node.click(); node.click(); });
    await page.locator('[data-test="trpg-settle"]').waitFor();
    await page.locator('[data-test="trpg-settle"]').evaluate(node => { node.click(); node.click(); });
    await nextLines(page);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.length, 1);
    const cancelled = await page.evaluate(async () => {
      const { runTrpg } = await import("/remake/js/trpg/index.js");
      const fixture = document.createElement("div");
      fixture.style.cssText = "position:absolute;inset:0;z-index:200";
      document.getElementById("stage").append(fixture);
      const signal = new AbortController();
      const pending = runTrpg(fixture, { seed: 9, signal: signal.signal });
      signal.abort();
      const result = await pending;
      const children = fixture.children.length;
      fixture.remove();
      return { result, children };
    });
    assert.equal(cancelled.result.cancelled, true);
    assert.equal(cancelled.children, 0);
    assert.equal(await page.locator(".trpg-root").count(), 1);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ results }, null, 2) + "\n");
}
assert.equal(results.filter(r => r.status === "failed").length, 0, "TRPG browser cases failed");
