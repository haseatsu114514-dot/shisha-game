// Actual WAV decoding, output samples and held-loop cleanup in Chromium.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage(), errors = [], seFailures = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (r.url().includes("/assets/audio/se/") && r.status() >= 400) seFailures.push(r.url()); });
    await page.addInitScript(() => {
      const names = new WeakMap(), buffers = new WeakMap(), nativeFetch = window.fetch;
      window.seStarts = []; window.seNodes = []; window.seGains = [];
      window.fetch = async (...args) => {
        const response = await nativeFetch(...args);
        const url = String(args[0]);
        if (url.includes("assets/audio/se/")) {
          const arrayBuffer = response.arrayBuffer.bind(response);
          response.arrayBuffer = async () => { const data = await arrayBuffer(); names.set(data, url.split("/").at(-1)); return data; };
        }
        return response;
      };
      const AC = window.AudioContext;
      const decode = AC.prototype.decodeAudioData, source = AC.prototype.createBufferSource, gain = AC.prototype.createGain;
      AC.prototype.decodeAudioData = async function (data) {
        const buffer = await decode.call(this, data); buffers.set(buffer, names.get(data)); return buffer;
      };
      AC.prototype.createGain = function () { const node = gain.call(this); window.seGains.push(node); window.seContext = this; return node; };
      AC.prototype.createBufferSource = function () {
        const node = source.call(this), start = node.start;
        node.addEventListener("ended", () => { node.testEnded = true; });
        node.start = function (...args) {
          window.seStarts.push({ file: buffers.get(node.buffer) || "synthetic", loop: node.loop, rate: node.playbackRate.value });
          window.seNodes.push(node); return start.apply(this, args);
        };
        return node;
      };
    });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/", { waitUntil: "domcontentloaded" });
    await page.locator('[data-test="title-new"]').waitFor();
    await page.evaluate(async () => {
      window.audio = await import("./js/core/audio.js"); window.config = (await import("./js/core/state.js")).config;
      config.bgmVolume = 0; config.seVolume = .8; audio.stopBgm(0); audio.applyVolumes();
    });
    if (mobile) await page.touchscreen.tap(1, 1); else await page.mouse.click(1, 1);
    assert.equal(await page.evaluate(() => audio.preloadSe()), true, "all actual WAVs decode");
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.analyser = seContext.createAnalyser(); analyser.fftSize = 2048;
      seGains[0].connect(analyser); // observe the real master without adding another output
      window.rms = () => { const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a); return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length); };
      seStarts.length = 0; window.stopWater = audio.startBubbling({ strength: .65 });
    });
    await page.waitForTimeout(180);
    const active = await page.evaluate(() => ({ starts: seStarts, rms: rms() }));
    assert.equal(active.starts.length, 1); assert.equal(active.starts[0].file, "water_loop.wav"); assert(active.starts[0].loop);
    assert(active.rms > .0001, "water loop produces real audio samples");
    await page.waitForTimeout(1700);
    assert.equal(await page.evaluate(() => seStarts.length), 1, "one buffer loops without piling up new shots");
    await page.evaluate(() => { config.seVolume = 0; audio.applyVolumes(); });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => rms()), 0);
    await page.evaluate(() => { config.seVolume = .8; audio.applyVolumes(); });
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => rms()) > .0001);
    await page.evaluate(() => stopWater());
    assert.equal(await page.evaluate(() => seStarts.at(-1).file), "water_end.wav");
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => rms()), 0, "water and tail stop completely");
    assert(await page.evaluate(() => seNodes.filter(n => n.loop).every(n => n.testEnded)));
    const expected = { click: "ui_click.wav", select: "ui_select.wav", cancel: "ui_back.wav", phone: "lime_glass.wav", doorbell: "shop_bell.wav", coalSnip: "coal_grab_", coalPlace: "hms_knock_", foilPunch: "foil_puncture.wav" };
    for (const [id, file] of Object.entries(expected)) {
      await page.evaluate(id => audio.SE[id](), id);
      assert((await page.evaluate(() => seStarts.at(-1).file)).startsWith(file), id);
    }
    await page.evaluate(() => { config.mute = true; audio.applyVolumes(); });
    await page.waitForTimeout(80); assert.equal(await page.evaluate(() => rms()), 0);
    assert.deepEqual(errors, []); assert.deepEqual(seFailures, []);
    console.log(`PASS: ${mobile ? "touch" : "PC"} WAV decode, real samples, continuous loop, volume/mute, final bubble, SE mappings and cleanup`);
    await context.close();
  }
} finally { await browser.close(); }
