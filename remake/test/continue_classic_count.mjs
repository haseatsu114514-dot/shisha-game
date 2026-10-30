// 王道の下段2択を維持した、大きく迫る背面カウント比較版。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/continue_classic_count.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const errors = [], missing = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", e => errors.push(e.message));
page.on("response", r => { if (r.status() >= 400 && /\.(webp|png|woff2)/.test(r.url())) missing.push(r.url()); });
await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.abort());
async function mount(variant = 0, options = {}) {
  await page.evaluate(async ({ variant, options }) => {
    const { buildGameOver } = await import("./js/chapters/gameover.js");
    const { showScreen } = await import("./js/core/ui.js");
    window.__decisions = [];
    showScreen("end", buildGameOver({ variant, soundEffects: false, ...options,
      onRetry: () => window.__decisions.push("retry"), onTitle: () => window.__decisions.push("quit") }));
  }, { variant, options });
  await page.clock.runFor(50);
}
async function measurements() {
  return page.evaluate(() => {
    const root = document.querySelector(".gameover"), rect = selector => root.querySelector(selector).getBoundingClientRect().toJSON();
    const echo = root.querySelector(".go-count-echo"), layer = echo?.parentElement;
    return { stage: document.querySelector("#stage").getBoundingClientRect().toJSON(),
      heading: rect(".go-heading"), portrait: rect(".go-left"), caption: rect(".go-speech-text"),
      retry: rect(".go-retry"), quit: rect(".go-quit"), count: root.querySelector(".go-count").textContent,
      echo: echo ? { ...echo.getBoundingClientRect().toJSON(), text: echo.textContent,
        opacity: Number(getComputedStyle(echo).opacity), hidden: layer.hidden,
        fontSize: Number.parseFloat(getComputedStyle(echo).fontSize),
        scale: root.style.getPropertyValue("--go-count-scale"),
        inert: getComputedStyle(layer).pointerEvents === "none",
        behind: Number(getComputedStyle(layer).zIndex) < Number(getComputedStyle(root.querySelector(".go-left")).zIndex) } : null };
  });
}
function checkClassic(g) {
  const k = g.stage.height / 720;
  assert(g.heading.bottom <= g.portrait.top + 1);
  assert(Math.abs(g.portrait.bottom - g.stage.bottom) < 1);
  for (const choice of [g.retry, g.quit]) {
    assert(g.caption.bottom + 8 * k <= choice.top, "classic caption must stay above bottom buttons");
    assert(g.stage.bottom - choice.bottom >= 20 * k, "classic buttons must keep bottom space");
  }
  assert(g.echo?.behind && g.echo.inert && g.echo.opacity > 0 && g.echo.opacity <= .16);
  assert(Math.abs((g.echo.left + g.echo.right - g.stage.left - g.stage.right) / 2) < 1);
  assert(Math.abs((g.echo.top + g.echo.bottom - g.stage.top - g.stage.bottom) / 2) < 1);
}
try {
  await page.goto(base);
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const { config } = await import("./js/core/state.js");
    config.bgmVolume = config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes();
  });
  await page.clock.install({ time: new Date("2026-10-10T20:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-10T20:00:01Z"));
  await mount(0, { layout: "bottom", background: "purple" });
  assert.equal(await page.locator(".gameover").getAttribute("data-layout"), "bottom");
  assert.equal(await page.locator(".gameover").getAttribute("data-background"), "purple");
  assert.equal(await page.locator(".go-count-echo").count(), 0, "original classic remains available for comparison");
  for (const layout of ["top", "back-count"]) {
    await mount(0, { layout });
    assert.equal(await page.locator(".gameover").getAttribute("data-layout"), layout);
    assert.equal(await page.locator(".go-retry").textContent(), "する");
  }
  const variants = [0, 1, 2, ...["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan"].map(id => `premium:${id}`)];
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const [index, variant] of variants.entries()) {
      await mount(variant, { layout: "bottom-back-count", background: "stage", reducedMotion: true });
      await page.evaluate(async () => {
        // 最後の字幕まで送る。時計は動かさず、キャラ差分と最長22字の既存1行を保つ。
        for (let n = 0; n < 40; n++) document.querySelector(".go-dialogue").click();
        await document.querySelector(".go-sumi-img").decode();
      });
      const g = await measurements(); checkClassic(g);
      assert.equal(g.count, "20", "caption advance must not shorten classic deadline");
      assert.equal(g.echo.fontSize, 1000);
      assert.equal(await page.locator(".go-retry").textContent(), "最初から再挑戦");
      const choice = index % 2 ? "quit" : "retry";
      await page.locator(choice === "retry" ? ".go-retry" : ".go-quit").click();
      await page.clock.runFor(8000);
      assert.deepEqual(await page.evaluate(() => window.__decisions), [choice]);
    }
  }
  console.log("PASS: classic composition and bottom spacing, all 9 portraits on PC/phone, reactions unchanged");
  await page.setViewportSize({ width: 1280, height: 720 });
  await mount("premium:ageha", { layout: "bottom-back-count", background: "stage", context: { lossOrdinal: 1 } });
  await page.clock.runFor(22000);
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "speaking");
  assert.equal((await measurements()).count, "∞");
  assert(await page.locator(".go-retry,.go-quit").evaluateAll(els => els.every(el => !el.disabled)));
  await page.locator(".go-quit").click();
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
  await mount("premium:ageha", { layout: "back-count", background: "stage" });
  await page.clock.runFor(5200);
  const top = await measurements();
  await mount("premium:ageha", { layout: "bottom-back-count", background: "stage", context: { lossOrdinal: 2 } });
  const twenty = await measurements(); checkClassic(twenty);
  await page.clock.runFor(5200);
  const fifteen = await measurements(); checkClassic(fifteen);
  assert.equal(fifteen.count, "15");
  assert.equal(fifteen.echo.text, "15");
  assert(fifteen.echo.height > top.echo.height * 1.8, "classic back count should be considerably larger than top experiment");
  assert(fifteen.echo.height > twenty.echo.height + 200);
  const paused = await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    return document.querySelector(".gameover").style.getPropertyValue("--go-count-scale");
  });
  await page.clock.runFor(5000);
  assert.equal((await measurements()).echo.scale, paused);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(10000);
  const five = await measurements();
  assert.equal(five.echo.text, "5");
  assert(five.echo.height > fifteen.echo.height + 400 && five.echo.height > five.stage.height * 2,
    "late count should approach beyond the stage bounds");
  await page.clock.runFor(4000);
  const one = await measurements();
  assert.equal(one.echo.text, "1");
  assert(one.echo.height > five.echo.height + 150);
  await page.clock.runFor(1000);
  assert(await page.locator(".go-count-back,.go-clock,.end-actions").evaluateAll(els => els.every(el => el.hidden)));
  assert(await page.locator(".go-title-art").isVisible());
  await page.clock.runFor(2000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"]);
  await page.goto(new URL("continue-preview.html?layout=bottom-back-count&background=stage", base).href);
  await page.waitForFunction(() => !document.querySelector("#preview-play").disabled);
  await page.evaluate(() => localStorage.setItem("suien_remake_save", "classic-preview-sentinel"));
  await page.locator("#preview-play").click();
  assert.equal(await page.locator(".gameover").getAttribute("data-layout"), "bottom-back-count");
  assert.equal(await page.locator(".gameover").getAttribute("data-background"), "stage");
  await page.locator("#preview-layout").selectOption("bottom");
  assert.equal(await page.locator(".go-count-echo").count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), "classic-preview-sentinel");
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  console.log("PASS: considerably larger 20→15→5→1 count, pause, hidden zero, classic preview link and save-safe comparison");
} finally { await browser.close(); }
