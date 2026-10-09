// 実ブラウザのデコード・音声出力・ループ・設定変更を確認。
// CHROME_BIN=/usr/bin/chromium node remake/test/bgm_browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.text().startsWith("[BGM] Could not load")) errors.push(m.text()); });
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__bgmElements = [];
    window.Audio = function (...args) {
      const a = new NativeAudio(...args);
      window.__bgmElements.push(a);
      return a;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-test="title-new"]');
  await page.mouse.click(1, 1); // 実ユーザー操作として音を解禁。
  await page.evaluate(async () => {
    window.__audioTest = await import("./js/core/audio.js");
    window.__configTest = (await import("./js/core/state.js")).config;
    window.__configTest.bgmVolume = .5;
  });
  for (const [key, gain, duration] of [["bgm_tournament_edm", .51, 70.99], ["bgm_tournament_craft", .67, 115.91]]) {
    await page.evaluate((key) => window.__audioTest.playBgm(key), key);
    await page.waitForFunction(([key, gain]) => {
      const a = window.__bgmElements.at(-1);
      return window.__audioTest.currentBgm() === key && a.src.startsWith("blob:")
        && !a.paused && a.currentTime > .1 && Math.abs(a.volume - .5 * gain) < .0001;
    }, [key, gain], { timeout: 15000 });
    const decoded = await page.evaluate(async () => {
      const a = window.__bgmElements.at(-1);
      const ctx = new AudioContext();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      ctx.createMediaElementSource(a).connect(analyser).connect(ctx.destination);
      await new Promise((r) => setTimeout(r, 120));
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return { duration: a.duration, loop: a.loop,
        rms: Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length) };
    });
    assert(Math.abs(decoded.duration - duration) < .2, JSON.stringify(decoded));
    assert(decoded.loop);
    assert(decoded.rms > .00001, "Decoded BGM produced no audio samples");
    await page.evaluate(() => { window.__configTest.bgmVolume = .25; window.__audioTest.applyVolumes(); });
    assert(Math.abs(await page.evaluate(() => window.__bgmElements.at(-1).volume) - .25 * gain) < 1e-9);
    await page.evaluate(() => { window.__configTest.bgmVolume = 0; window.__audioTest.applyVolumes(); });
    assert.equal(await page.evaluate(() => window.__bgmElements.at(-1).volume), 0);
    await page.evaluate(() => { window.__configTest.bgmVolume = .5; window.__audioTest.applyVolumes(); });
    await page.evaluate(() => {
      const a = window.__bgmElements.at(-1);
      a.currentTime = a.duration - .3;
    });
    await page.waitForFunction(() => {
      const a = window.__bgmElements.at(-1);
      return a.currentTime > 0 && a.currentTime < 1 && !a.paused;
    }, null, { timeout: 5000 });
    console.log(`[BGM browser] ${key}: decoded, audible samples, gain ${gain}, settings/mute and end-to-start loop PASS`);
  }
  // 従来のMP3もそのまま再生でき、専用音源はフェード後に停止する。
  await page.evaluate(() => window.__audioTest.playBgm("title"));
  await page.waitForFunction(() => {
    const a = window.__bgmElements.at(-1);
    return a.src.endsWith("/title.mp3") && !a.paused && a.currentTime > .1;
  });
  await page.waitForFunction(() => window.__bgmElements.slice(0, -1).every((a) => a.paused && a.volume === 0));
  assert.deepEqual(errors, []);
  console.log("[BGM browser] PASS: packed tracks and existing MP3 playback, no stale/overlapping audio after fade");
} finally { await browser.close(); }
