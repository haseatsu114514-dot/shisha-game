// 本編の縦画面で、同じ CONTINUE の文字・時計・ボタンが回転、一時停止、各分岐をまたいで残ること。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const tall = { width: 390, height: 844 };
const page = await browser.newPage({ viewport: tall, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
const shot = async name => {
  if (!process.env.ARTIFACT_DIR) return;
  await mkdir(process.env.ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `after-vertical-${name}.png`) });
};
const go = page.locator(".gameover");
const count = () => go.locator(".go-count").textContent();

async function mount(options) {
  await page.evaluate(async options => {
    const { buildGameOver } = await import("./js/chapters/gameover.js");
    const { showScreen } = await import("./js/core/ui.js");
    document.querySelector(".gameover")?.cleanupContinue();
    window.continueCalls = [];
    showScreen("end", buildGameOver({ variant: 0, soundEffects: false, ...options,
      onRetry: level => window.continueCalls.push(["retry", level]),
      onTitle: () => window.continueCalls.push(["title"]) }));
  }, options);
  await page.clock.runFor(450);
  assert.equal(await page.evaluate(() => window.__verticalLook?.scene()), "continue");
  assert.equal(await go.getAttribute("data-paused"), "false");
}

async function tap(selector) {
  const target = go.locator(selector);
  const { x, y, width, height } = await target.boundingBox();
  assert(width >= 44 && height >= 44 && y >= 0 && y + height <= page.viewportSize().height + 1,
    JSON.stringify({ selector, x, y, width, height }));
  assert(await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }), selector);
  await page.touchscreen.tap(x + width / 2, y + height / 2);
}

try {
  await page.goto(new URL("?look=vertical", base).href);
  await page.locator('[data-test="vt-title-menu"]').waitFor({ timeout: 30000 });
  // タイトルの実ボタンから、保存位置・ロード漫画・縦の煙を一緒に通す。
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    Object.assign(core.newGame(), { chapter: 1, phase: "cleared", day: 7 });
    core.save();
    localStorage.setItem("suien_loading_comics", "always");
    (await import("./js/scenes/title.js")).showTitle();
  });
  await page.locator('[data-test="vt-title-continue"]:enabled .vt-tt-en').tap();
  await page.locator(".vt-resume-smoke .wipe-smoke").waitFor();
  await page.locator('.loading-gate.is-viewport.is-ready .loading-proceed[aria-hidden="false"]').tap();
  await page.waitForFunction(() => window.__verticalLook?.scene() === "chapterClear");
  await page.locator('[data-test="end-chapter2"]:enabled').tap({ trial: true });
  assert.equal(await page.evaluate(() => window.__remake.state.day), 7);
  await page.locator(".vt-resume-smoke:empty").waitFor({ state: "attached" });

  await page.clock.install({ time: new Date("2026-11-28T01:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-28T01:00:01Z"));

  await mount({ context: { lossOrdinal: 1 } });
  await page.clock.runFor(4800);
  assert.equal(await go.locator("mark.go-on").allTextContents().then(a => a.join("")), "ちょっと待て");
  await shot("loss-emphasis");
  const cue = await go.getAttribute("data-cue");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.runFor(150);
  assert.equal(await page.locator("html[data-vt-continue]").count(), 0);
  assert.equal(await go.getAttribute("data-cue"), cue);
  await page.setViewportSize(tall);
  await page.clock.runFor(550); // 縦の外枠が回転案内を閉じて、時計が再開してから進める。
  assert.equal(await go.getAttribute("data-paused"), "false");
  await page.clock.fastForward(16000);
  await page.clock.runFor(150);
  assert.equal(await count(), "∞");
  await shot("loss-endless");
  await tap(".go-quit");
  await page.clock.runFor(720);
  await shot("loss-quit");
  await page.clock.runFor(3600);
  assert.deepEqual(await page.evaluate(() => window.continueCalls), [["title"]]);

  await mount({ context: { lossOrdinal: 2 } });
  await page.clock.fastForward(15600);
  await page.clock.runFor(100);
  assert(await go.evaluate(el => el.classList.contains("go-urgent")));
  await shot("loss-last-five");
  await page.clock.fastForward(4200);
  assert.equal(await go.getAttribute("data-phase"), "gameover");
  assert.equal(await count(), "0");
  assert.equal(await go.locator(".go-clock").isVisible(), false);
  await shot("loss-timeout");
  await page.clock.runFor(2500);
  assert.deepEqual(await page.evaluate(() => window.continueCalls), [["title"]]);

  await page.setViewportSize({ width: 320, height: 568 });
  await mount({ variant: "lover:tsumugi", difficulty: 2, context: { lossOrdinal: 3 }, reducedMotion: true });
  await tap(".go-retry");
  assert.equal(await go.getAttribute("data-phase"), "difficulty");
  const held = await count();
  await page.clock.fastForward(23000);
  assert.equal(await count(), held);
  await tap('[data-test="retry-assist-no"]');
  await page.clock.runFor(7200);
  assert.deepEqual(await page.evaluate(() => window.continueCalls), [["retry", 0]]);

  await page.setViewportSize(tall);
  await mount({ variant: 2, difficulty: 2, context: { lossOrdinal: 3 } });
  await tap(".go-retry");
  await shot("loss-difficulty");
  await tap('[data-test="retry-assist-yes"]');
  await page.clock.runFor(700);
  assert.equal(await go.getAttribute("data-effect"), "vote");
  assert(await go.locator(".go-approval").isVisible());
  await shot("loss-vote");
  await tap(".go-proceed");
  await page.clock.runFor(2600);
  assert.deepEqual(await page.evaluate(() => window.continueCalls), [["retry", 2]]);
  assert.deepEqual(errors, []);
  console.log("PASS portrait CONTINUE: save resume, emphasis, rotation, endless count, quit, timeout, difficulty, retry and 44px touch targets");
} finally {
  await browser.close();
}
