// Real media clock + production audio module; tiny generated WAV, no game assets.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const source = await fs.readFile(new URL("../../js/core/audio.js", import.meta.url), "utf8");
const wav = Buffer.alloc(44 + 8000 * 2 * 30);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.route("http://bgm.test/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/audio.js") return route.fulfill({ contentType: "text/javascript", body: source });
      if (path === "/state.js") return route.fulfill({ contentType: "text/javascript", body: 'export const config = {bgmVolume: .5, seVolume: 0};' });
      if (path === "/data.js") return route.fulfill({ contentType: "text/javascript", body: 'export const bgmUrl = k => k ? `/${k}.wav` : null;' });
      if (path.endsWith(".wav")) return route.fulfill({ contentType: "audio/wav", body: wav });
      return route.fulfill({ contentType: "text/html", body: '<button id="start">start</button>' });
    });
    await page.goto("http://bgm.test/");
    await page.evaluate(async () => {
      window.a = await import("/audio.js"); window.players = [];
      const Native = window.Audio;
      window.Audio = function (...args) { const el = new Native(...args); players.push(el); return el; };
      window.Audio.prototype = Native.prototype;
      document.querySelector("button").onclick = () => a.unlockAudio();
    });
    await page.click("button");
    for (const [key, rate] of [["bgm_camel_race", 1.14], ["bgm_ethnic05", 1.18], ["bgm_ethnic08", 1.18], ["bgm_ethnic12", 1.18]]) {
      await page.evaluate(key => a.playBgm(key), key);
      await page.waitForFunction(() => players.at(-1).readyState >= 3 && !players.at(-1).paused);
      await page.evaluate(() => { window.el = players.at(-1); el.currentTime = 8; });
      await page.waitForFunction(() => !el.seeking && el.currentTime >= 8);
      const before = await page.evaluate(() => ({ time: el.currentTime, count: players.length, src: el.src }));
      await page.evaluate(rate => { a.setBgmPlaybackRate(rate); for (let i = 0; i < 60; i++) a.tickBgmPlaybackRate(1 / 60); }, rate);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ time: el.currentTime, count: players.length, src: el.src, rate: el.playbackRate, paused: el.paused }));
      assert(after.time > before.time && after.time < before.time + 2, "acceleration keeps the media clock moving from its current position");
      assert.equal(after.count, before.count); assert.equal(after.src, before.src); assert.equal(after.paused, false);
      assert.equal(after.rate, rate);
      assert.equal(await page.evaluate(() => el.preservesPitch), !touch);
      await page.evaluate(() => a.resetBgmTempo());
      assert.equal(await page.evaluate(() => el.playbackRate), 1);
      assert(await page.evaluate(() => el.currentTime) >= after.time, "release never rewinds");
      await page.evaluate(() => el.pause()); await page.click("button");
      await page.waitForFunction(() => !el.paused);
      assert(await page.evaluate(() => el.currentTime) >= after.time, "gesture resumes interrupted media without rewind");
      assert.equal(await page.evaluate(() => players.length), before.count);
    }
    assert.deepEqual(errors, []);
    console.log(`[BGM continuity] PASS: ${touch ? "touch" : "PC"}, camel + 3 sandboard tracks, acceleration/release/interruption preserve media and position`);
    await context.close();
  }
} finally { await browser.close(); }
