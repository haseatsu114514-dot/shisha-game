// 参照デザインを実際の本編ステージで撮影。数字と字幕は20秒の実処理。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const dir = fileURLToPath(new URL(".", import.meta.url));
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], missing = [], captures = [];
page.on("pageerror", e => errors.push(e.message));
page.on("response", r => { if (r.status() >= 400 && /\.(webp|png|woff2|css|js)/.test(r.url())) missing.push(r.url()); });
await page.route("https://bgmer.net/**", r => r.abort());
try {
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const { config } = await import("./js/core/state.js"); config.bgmVolume = config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes(); await document.fonts.ready;
  });
  await page.clock.install({ time: new Date("2026-10-11T08:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-11T08:00:01Z"));
  async function capture(name, variant, viewport, elapsed = 5250, options = {}) {
    await page.setViewportSize(viewport);
    await page.evaluate(async ({ variant, options }) => {
      const { buildGameOver } = await import("./js/chapters/gameover.js");
      const { showScreen } = await import("./js/core/ui.js");
      showScreen("end", buildGameOver({ variant, soundEffects: false, ...options }));
    }, { variant, options });
    await page.clock.runFor(elapsed);
    await page.evaluate(async () => {
      const root = document.querySelector(".gameover");
      if (root.dataset.phase === "speaking" && root.querySelector(".go-letter:not(.go-on)")) root.querySelector(".go-dialogue").click();
      await Promise.all([...root.querySelectorAll("img")].map(i => i.decode()));
      const backdrop = new Image(); backdrop.src = getComputedStyle(root).backgroundImage.match(/url\("?([^"\)]+)"?\)/)[1];
      await backdrop.decode();
    });
    await page.mouse.move(1, 1);
    await page.locator("#stage").screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
    const record = await page.evaluate(() => {
      const root = document.querySelector(".gameover"), rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { layout: root.dataset.layout, background: root.dataset.background, phase: root.dataset.phase,
        title: root.querySelector(".go-title").getAttribute("aria-label"), count: root.querySelector(".go-count").textContent,
        clockHidden: root.querySelector(".go-clock").hidden, choicesHidden: root.querySelector(".end-actions").hidden,
        echoHidden: root.querySelector(".go-count-back").hidden, echoScale: root.style.getPropertyValue("--go-count-scale"),
        caption: root.querySelector(".go-speech-text").textContent,
        geometry: Object.fromEntries(Object.entries({ stage: "#stage", title: ".go-title", clock: ".go-clock",
          portrait: ".go-left", caption: ".go-speech-text", retry: ".go-retry", quit: ".go-quit", logo: ".go-title-art" }).map(([k, v]) => [k, rect(v)])) };
    });
    const { geometry: g } = record, scale = g.stage.height / 720;
    if (record.phase === "gameover") assert(record.clockHidden && record.choicesHidden && record.echoHidden);
    else {
      assert.equal(record.count, String(Math.ceil(20 - elapsed / 1000)));
      assert(g.caption.left >= g.stage.left && g.caption.right <= g.stage.right);
      assert(g.retry.top - g.caption.bottom >= 8 * scale);
      assert(g.stage.bottom - g.retry.bottom >= 20 * scale);
      assert(Math.abs(g.portrait.bottom - g.stage.bottom) < 1);
    }
    captures.push({ image: `${name}.png`, variant, viewport, ...record });
    console.log(`Captured ${name}: ${record.count} / ${record.phase}`);
  }
  await capture("neon-ageha-1080", "premium:ageha", { width: 1920, height: 1080 });
  await capture("neon-sumi-720", 0, { width: 1280, height: 720 });
  await capture("neon-ageha-phone", "premium:ageha", { width: 844, height: 390 });
  await capture("neon-ageha-5", "premium:ageha", { width: 1920, height: 1080 }, 15250);
  await capture("neon-ageha-1", "premium:ageha", { width: 1920, height: 1080 }, 19250);
  await capture("neon-game-over", "premium:ageha", { width: 1920, height: 1080 }, 20250);
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await fs.writeFile(`${dir}/verification.json`, JSON.stringify({ date: "2026-10-11", requests: "CV35–46", errors, missing, captures }, null, 2) + "\n");
} finally { await browser.close(); }
