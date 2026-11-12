// Standalone minigames: real page transitions, steering and media play calls.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installLoadingComicReader } from "./loading_reader.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });

async function open(path, rejectFirstBgm = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await installLoadingComicReader(page); // 始める前のロードに漫画が出たら読んで進む（本編と同じ）
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(rejectFirst => {
    window.__bgmPlayed = [];
    window.__bgmRejected = false;
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!this.src.startsWith("blob:")) return nativePlay.apply(this, args);
      if (rejectFirst && !window.__bgmRejected) {
        window.__bgmRejected = true;
        return Promise.reject(new DOMException("Simulated late media start", "NotAllowedError"));
      }
      return nativePlay.apply(this, args).then(value => {
        window.__bgmPlayed.push({ src: this.src, at: performance.now() });
        return value;
      });
    };
  }, rejectFirstBgm);
  await page.goto(new URL(path, baseURL).href);
  return { page, context, errors };
}

try {
  {
    const { page, context, errors } = await open("desert-ride.html?course=left-bowl");
    try {
      await page.locator('[data-test="desert-page-tutorial"]').click();
      await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "practice");
      await page.waitForFunction(() => window.__bgmPlayed.length > 0);
      // A held direction at the end of practice must not carry into the new run.
      await page.evaluate(() => { window.__desertRide.setInput(true, false); window.__desertRide.setSpeedUp(8); });
      await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "practiced", null, { timeout: 30000 });
      await page.locator('[data-test="desert-start"]').click();
      await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "run");
      assert.equal(await page.evaluate(() => window.__desertRide.course.id), "left-bowl");
      assert.equal(await page.evaluate(() => window.__desertRide.game.x), 0);
      await page.evaluate(() => window.__desertRide.skipCountdown());
      await page.waitForFunction(() => window.__desertRide.game.z > 40);
      assert(Math.abs(await page.evaluate(() => window.__desertRide.game.x)) < 0.1, "idle run stays centered");
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction(() => window.__desertRide.game.x > 0.3);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.down("ArrowLeft");
      await page.waitForFunction(() => window.__desertRide.game.x < 0);
      await page.keyboard.up("ArrowLeft");
      await page.waitForFunction(() => window.__bgmPlayed.length >= 2);
      assert(await page.evaluate(() => performance.getEntriesByType("resource").some(entry => entry.name.endsWith("/bgm_ethnic08.bgm"))));
      assert.deepEqual(errors, []);
      console.log("[minigame BGM/input] PASS: practice to left-bowl resets steering; both directions and both BGM plays work");
    } finally { await context.close(); }
  }
  {
    const { page, context, errors } = await open("camel-race.html", true);
    try {
      await page.locator('[data-test="camel-menu-quick"]').click();
      await page.waitForFunction(() => window.__bgmRejected);
      // The race captures Space at window level. That gesture must retry a late play() rejection.
      await page.keyboard.press("Space");
      await page.waitForFunction(() => window.__bgmPlayed.length > 0);
      assert(await page.evaluate(() => performance.getEntriesByType("resource").some(entry => entry.name.endsWith("/bgm_camel_race.bgm"))));
      assert.deepEqual(errors, []);
      console.log("[minigame BGM/input] PASS: standalone camel BGM retries on captured keyboard input");
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
