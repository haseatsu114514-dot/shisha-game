// 実ブラウザで、回転中のマップ再表示と夜の行動の演出を検証する。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const reel = await import("./js/daily/reel.js");
    const { layers } = await import("./js/core/ui.js");
    core.newGame();
    core.state.phase = "daily";
    core.state.reel.seed = 1;
    core.state.reel.introDone = true;
    layers.screen.replaceChildren();
    reel.onAction();
    window.reelProbe = { core, reel, layers };
    window.daySpin = reel.mountReel(layers.screen);
  });
  await page.waitForSelector('.rw-strip.spinning');
  const remount = await page.evaluate(() => {
    const { reel, layers } = window.reelProbe;
    const firstWidget = document.querySelector('.reel-widget');
    layers.screen.replaceChildren();
    const task = reel.mountReel(layers.screen);
    return {
      sameWidget: firstWidget === document.querySelector('.reel-widget'),
      spinning: document.querySelectorAll('.rw-strip.spinning').length,
      sameTask: task === window.daySpin,
    };
  });
  assert(remount.sameWidget, "回転中の筐体が、前回の停止出目の筐体に置き換わった");
  assert(remount.spinning > 0, "マップを戻したら回転済みの出目が表示された");
  assert(remount.sameTask, "再表示で回転の待機処理が分かれた");
  await page.evaluate(() => window.daySpin);
  const final = await page.evaluate(() => {
    const { core, reel } = window.reelProbe;
    return [...document.querySelectorAll('.rw-strip')].map((node, i) => ({
      y: new DOMMatrixReadOnly(getComputedStyle(node).transform).m42,
      expected: -26 * (core.state.reel.shown[i] + reel.core.STRIPS[i].length - 1),
    }));
  });
  for (const stop of final) assert(Math.abs(stop.y - stop.expected) < 0.1, "再表示したリールの最終出目が抽選結果と違う");

  // 夜の行動を実際に抽選。表示は回転数・適用済み報酬を増やさない。
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    layers.screen.replaceChildren();
    core.state.slot = 2;
    reel.onAction();
    window.nightBefore = JSON.stringify({ count: core.state.reel.count, stats: core.state.stats });
    window.nightFirstFrame = null;
    const observer = new MutationObserver(() => {
      const host = document.querySelector('.reel-night.show');
      if (!host) return;
      window.nightFirstFrame = host.querySelectorAll('.rw-strip.spinning').length;
      observer.disconnect();
    });
    observer.observe(layers.fx, { subtree: true, attributes: true });
    window.nightSpin = reel.presentNow();
  });
  await page.waitForSelector('.reel-night.show .rw-strip.spinning');
  assert.equal(await page.evaluate(() => window.nightFirstFrame), 3, "夜の表示開始時に前回の停止出目が見えた");
  await page.evaluate(() => window.nightSpin);
  const night = await page.evaluate(() => {
    const { core } = window.reelProbe;
    return {
      sameRewards: window.nightBefore === JSON.stringify({ count: core.state.reel.count, stats: core.state.stats }),
      pending: core.state.reel.pending.length,
      overlays: document.querySelectorAll('.reel-night').length,
    };
  });
  assert(night.sameRewards, "夜の演出で報酬または回転数が二重加算された");
  assert.equal(night.pending, 0, "夜の回転が翌朝に残った");
  assert.equal(night.overlays, 0, "終わった夜の筐体が残った");
  await page.evaluate(() => window.reelProbe.reel.presentNow());
  assert.equal(await page.locator('.reel-night').count(), 0, "表示済みの夜の回転がもう一度出た");

  // 初回説明中に再表示しても、説明・回転・報酬を重複させない。
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    core.state.reel.introDone = false;
    core.state.slot = 1;
    reel.onAction();
    layers.screen.replaceChildren();
    window.introSpin = reel.mountReel(layers.screen);
    window.introBox = document.querySelector('.reel-intro');
    layers.screen.replaceChildren();
    window.introRemount = reel.mountReel(layers.screen);
  });
  assert(await page.evaluate(() => window.introBox === document.querySelector('.reel-intro')), "再表示で初回説明が作り直された");
  assert(await page.evaluate(() => window.introSpin === window.introRemount), "初回説明中に回転処理が重複した");
  for (let i = 0; i < 4; i++) await page.click('[data-test="reel-intro"]');
  await page.evaluate(() => window.introSpin);
  assert.equal(await page.locator('.reel-intro').count(), 0);
  assert.deepEqual(errors, []);
  console.log('[reel lifecycle] remount while spinning, correct stops, night spin once, no repeated rewards, intro remount: PASS');
} finally {
  await browser.close();
}
