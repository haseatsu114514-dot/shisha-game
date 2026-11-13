import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"],
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });

const phase = (page, value) => page.waitForFunction(value =>
  document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
const ready = page => page.locator('[data-test="axe-action"]:not([disabled])');
async function stopGauge(page, target) {
  await page.evaluate(target => new Promise((resolve, reject) => {
    const deadline = performance.now() + 12000;
    const seek = () => {
      const root = document.querySelector('[data-test="axe-game"]');
      const button = root?.querySelector('[data-test="axe-action"]');
      if (button && !button.disabled && Math.abs(Number(root.dataset.timing) - target) < .045) {
        button.click(); resolve();
      } else if (performance.now() < deadline) requestAnimationFrame(seek);
      else reject(new Error(`Visible gauge never reached ${target}`));
    };
    requestAnimationFrame(seek);
  }), target);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.axeAudioProbe = { media: [], starts: 0 };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.axeAudioProbe.media.push(this);
      return play.apply(this, args);
    };
    for (const type of [OscillatorNode, AudioBufferSourceNode]) {
      const start = type.prototype.start;
      type.prototype.start = function (...args) {
        window.axeAudioProbe.starts++;
        return start.apply(this, args);
      };
    }
  });
  await page.goto(new URL("axe-throw.html?input=gauges", baseURL).href, { waitUntil: "load" });
  await page.locator('[data-test="axe-start"]').click();
  await phase(page, "choice");
  await page.waitForFunction(() => window.axeAudioProbe.media.some(a =>
    a.src.startsWith("blob:") && !a.paused && a.currentTime > .05 && a.volume > .05), null, { timeout: 12000 });
  assert.equal(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm()), "bgm_axe");

  // Call a blue target but throw at the middle: the axe sticks for zero points.
  // This used to omit the wood impact and play only the failure tone.
  await page.locator('[data-call="upper-left"]').click();
  await ready(page).click();
  await phase(page, "horizontal");
  const motion = await page.evaluate(async () => {
    const root = document.querySelector(".axe-game"), cursor = root.querySelector(".axe-crosshair");
    const positions = new Set(), intervals = [];
    let mutations = 0, last = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(root, { subtree: true, attributes: true, characterData: true, childList: true });
    await new Promise(resolve => {
      const step = now => {
        if (last) intervals.push(now - last);
        last = now;
        positions.add(cursor.getAttribute("transform"));
        if (intervals.length >= 90) resolve(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    observer.disconnect();
    const sorted = intervals.slice().sort((a, b) => a - b);
    return { frames: intervals.length, positions: positions.size, mutations,
      meanMs: intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length,
      p95Ms: sorted[Math.floor(sorted.length * .95)] };
  });
  assert(motion.positions > 10, `aim stopped following the gauge: ${JSON.stringify(motion)}`);
  assert(motion.mutations < motion.frames * 100, `aim redraw regressed: ${JSON.stringify(motion)}`);

  // 斧投げの音（2026-11-11 作り直し）: 鳴らした音を id ごとに数える（録音のファイルか、読めるまでの合成音か）。
  const played = () => page.evaluate(async () => (await import("./js/core/audio.js")).axeSePlayed());
  await stopGauge(page, .5); await phase(page, "vertical");
  await stopGauge(page, .5); await phase(page, "power");
  assert.deepEqual((await played()).stop, { recorded: 2, synth: 0 }, "each gauge stop clicks with the recorded ratchet");
  const beforeThrow = await page.evaluate(() => window.axeAudioProbe.starts);
  await stopGauge(page, .62); await phase(page, "flight");
  const afterThrow = await page.evaluate(() => window.axeAudioProbe.starts);
  assert(afterThrow >= beforeThrow + 1, "the throw sound did not start");
  assert.deepEqual((await played()).throw, { recorded: 1, synth: 0 }, "the throw plays the spinning whoosh file");
  await phase(page, "result");
  const impact = await page.evaluate(() => ({
    starts: window.axeAudioProbe.starts,
    outcome: document.querySelector(".axe-game").dataset.outcome,
    embedded: document.querySelectorAll(".axe-impacts > g").length,
  }));
  assert.equal(impact.outcome, "killshot-miss");
  assert.equal(impact.embedded, 1, "the zero-point axe should stick in wood");
  assert(impact.starts >= afterThrow + 2, "wood impact and failure layers did not fire");
  const sounds = await played();
  assert.deepEqual(sounds.stick, { recorded: 1, synth: 0 }, "a zero-point axe still thuds into the wood (recorded hit)");
  assert.equal(sounds.miss?.synth, 1, "and the failure tone follows");
  assert.equal(sounds.killshot, undefined, "no killshot ring for a missed call");
  // 弱く放すと柄から板に当たって跳ね返り（コンッ）、床に落ちて鳴る（ガシャン）。
  await ready(page).click(); await phase(page, "choice");
  await ready(page).click(); await phase(page, "horizontal");
  await stopGauge(page, .5); await phase(page, "vertical");
  await stopGauge(page, .5); await phase(page, "power");
  await stopGauge(page, .25); await phase(page, "result");
  assert.equal(await page.evaluate(() => document.querySelector(".axe-game").dataset.outcome), "drop");
  const dropped = await played();
  assert.deepEqual([dropped.bounce, dropped.drop], [{ recorded: 1, synth: 0 }, { recorded: 1, synth: 0 }], "a weak release bounces off the board, then clatters on the floor");
  assert.deepEqual(errors, []);
  console.log(`[axe-audio-performance] PASS: BGM playing; gauge clicks, throw and zero-point wood impact fired from the files; cursor ${motion.positions} positions, ${motion.mutations} DOM changes / ${motion.frames} frames, mean ${motion.meanMs.toFixed(1)} ms, p95 ${motion.p95Ms.toFixed(1)} ms`);
} finally {
  await browser.close();
}
