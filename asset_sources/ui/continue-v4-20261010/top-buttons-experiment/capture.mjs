// 実ゲームからCV27–32の比較画像を再取得（先にserve_preview.pyを起動）。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const dir = fileURLToPath(new URL(".", import.meta.url));
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], missing = [], captures = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if (response.status() >= 400 && /\.(webp|png|woff2|css|js)/.test(response.url())) missing.push(response.url()); });
await page.route("https://bgmer.net/**", route => route.abort());
try {
  await page.goto(base);
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const { config } = await import("./js/core/state.js");
    config.bgmVolume = config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes();
  });
  await page.clock.install({ time: new Date("2026-10-10T17:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-10T17:00:01Z"));
  async function capture(name, layout, variant, phone = false, elapsed = 5250, background = "purple") {
    await page.setViewportSize(phone ? { width: 844, height: 390 } : { width: 1280, height: 720 });
    await page.evaluate(async ({ layout, variant, background }) => {
      const { buildGameOver } = await import("./js/chapters/gameover.js");
      const { showScreen } = await import("./js/core/ui.js");
      showScreen("end", buildGameOver({ reason: "rank", rank: 2, variant, layout, background, soundEffects: false }));
    }, { layout, variant, background });
    await page.clock.runFor(elapsed);
    await page.evaluate(async () => {
      if (document.querySelector(".go-letter:not(.go-on)")) document.querySelector(".go-dialogue").click();
      await Promise.all([...document.querySelectorAll(".go-sumi-img,.go-title-art")].map(image => image.decode()));
      const url = getComputedStyle(document.querySelector(".gameover")).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1];
      const backdrop = new Image(); backdrop.src = url; await backdrop.decode();
    });
    await page.locator("#stage").screenshot({ path: `${dir}/${name}.png`, animations: "disabled" });
    const record = await page.evaluate(() => {
      const root = document.querySelector(".gameover");
      const selectors = { stage: "#stage", title: ".go-title-label", logo: ".go-title-art", count: ".go-count",
        portrait: ".go-left", caption: ".go-speech-text", retry: ".go-retry", quit: ".go-quit" };
      const geometry = Object.fromEntries(Object.entries(selectors).map(([key, selector]) =>
        [key, document.querySelector(selector).getBoundingClientRect().toJSON()]));
      const clockVisible = !root.querySelector(".go-clock").hidden;
      return { phase: root.dataset.phase, layout: root.dataset.layout, background: root.dataset.background, countVisible: clockVisible,
        backCount: root.querySelector(".go-count-echo") ? { text: root.querySelector(".go-count-echo").textContent, hidden: root.querySelector(".go-count-back").hidden, scale: root.style.getPropertyValue("--go-count-scale"), opacity: getComputedStyle(root.querySelector(".go-count-echo")).opacity, height: root.querySelector(".go-count-echo").getBoundingClientRect().height } : null,
        count: clockVisible ? root.querySelector(".go-count").textContent : "",
        caption: root.querySelector(".go-speech-text").textContent,
        captionFontSize: getComputedStyle(root.querySelector(".go-speech-text")).fontSize,
        retryLabel: root.querySelector(".go-choice-label").textContent,
        choicesVisible: !root.querySelector(".end-actions").hidden, geometry };
    });
    const { geometry: g } = record, scale = g.stage.height / 720;
    if (record.phase === "gameover") {
      assert(!record.countVisible && !record.choicesVisible);
      assert(Math.abs((g.logo.left + g.logo.right - g.stage.left - g.stage.right) / 2) < 1);
    } else {
      assert.equal(record.count, String(Math.ceil(20 - elapsed / 1000)));
      assert(g.count.left > g.title.right);
      assert(Math.abs(g.portrait.bottom - g.stage.bottom) < 1);
      assert(g.caption.left >= g.stage.left && g.caption.right <= g.stage.right);
      if (["top", "back-count"].includes(layout)) {
        assert(g.retry.left > g.count.right && g.quit.left > g.retry.right);
        assert(g.retry.bottom <= g.portrait.top && g.quit.bottom <= g.portrait.top);
        assert.equal(record.retryLabel, "する");
        assert.equal(record.captionFontSize, "48px");
      } else {
        assert(g.retry.top - g.caption.bottom >= 8 * scale);
        assert(g.stage.bottom - g.retry.bottom >= 20 * scale);
      }
    }
    captures.push({ image: `${name}.png`, variant, viewport: page.viewportSize(), ...record });
    console.log(`Captured ${name}: ${record.layout}, count visible ${record.countVisible}`);
  }
  await capture("current-sumi", "bottom", 0);
  await capture("top-sumi", "top", 0);
  await capture("current-phone-ageha", "bottom", "premium:ageha", true);
  await capture("top-phone-ageha", "top", "premium:ageha", true);
  await capture("stage-top-sumi", "top", 0, false, 5250, "stage");
  await capture("back-count-15", "back-count", 0, false, 5250, "stage");
  await capture("back-count-5", "back-count", 0, false, 15250, "stage");
  await capture("back-count-1", "back-count", 0, false, 19250, "stage");
  await capture("back-count-purple", "back-count", 0);
  await capture("stage-phone-ageha", "back-count", "premium:ageha", true, 5250, "stage");
  await capture("game-over", "back-count", 0, false, 20250, "stage");
  const growing = captures.filter(c => ["back-count-15.png", "back-count-5.png", "back-count-1.png"].includes(c.image));
  assert(growing[0].backCount.height < growing[1].backCount.height && growing[1].backCount.height < growing[2].backCount.height);
  assert(captures.find(c => c.image === "game-over.png").backCount.hidden);
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  await fs.writeFile(`${dir}/verification.json`, JSON.stringify({ date: "2026-10-10", requests: "CV27–32", experimentalAdoption: "undecided", errors, missing, captures }, null, 2) + "\n");
} finally { await browser.close(); }
