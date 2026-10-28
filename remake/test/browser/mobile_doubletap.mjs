// No installs or media needed. PLAYWRIGHT_MODULE may point to an existing cache.
// These are Chromium checks, not evidence of iOS Safari gesture recognition.
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const missing = new Set();
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = resolve(root, `.${pathname}`);
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] }).end(body); }
  catch { missing.add(pathname); res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  // Launch with the Playwright default like support.mjs: opting into chromiumSandbox
  // fails with "No usable sandbox!" on AppArmor-restricted CI runners.
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: mobile, hasTouch: mobile });
    // Never use external services or download fonts, images, audio or video.
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin && /\.(html|js|css|json)$/.test(url.pathname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const client = await context.newCDPSession(page);
    const measure = () => page.evaluate(() => {
      const stage = document.querySelector("#stage"), box = stage.getBoundingClientRect();
      return { browserScale: visualViewport.scale, visualWidth: visualViewport.width,
        visualHeight: visualViewport.height, gameScale: Number(stage.style.getPropertyValue("--k")),
        width: box.width, height: box.height, transform: getComputedStyle(stage).transform };
    });
    const recordStable = async (label, action) => {
      console.error(`${mobile ? "touch" : "desktop"}: ${label}`);
      const before = await measure();
      await action();
      await page.waitForTimeout(350);
      const after = await measure();
      const pass = Math.abs(after.browserScale - before.browserScale) < .01 && Math.abs(after.gameScale - before.gameScale) < .001;
      results.push({ mobile, label, pass, before, after });
    };
    const tap = async (x, y) => {
      if (mobile) {
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else await page.mouse.click(x, y);
    };
    const repeat = async (locator, count = 4) => {
      const b = await locator.boundingBox();
      assert(b, "tap target exists");
      for (let i = 0; i < count; i++) { await tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(70); }
    };
    const boot = async () => {
      console.error(`${mobile ? "touch" : "desktop"}: boot`);
      await page.goto(`${origin}/remake/index.html?titleLayout=normal`);
      await page.waitForFunction(() => document.body.dataset.screen === "title" && !document.querySelector("#boot:not(.done)"));
      await page.waitForTimeout(800);
    };
    await boot();
    await recordStable("title repeated taps", async () => { for (let i = 0; i < 6; i++) { await tap(90, 100); await page.waitForTimeout(70); } });
    await page.locator('[data-test="title-config"]').click();
    const range = page.locator('#modal input[type="range"]').first();
    await range.focus();
    const old = await range.inputValue();
    await page.keyboard.press("ArrowLeft");
    assert.notEqual(await range.inputValue(), old, "config range keeps keyboard input");
    await recordStable("config input repeated taps", () => repeat(range));
    await boot();
    await page.evaluate(async () => {
      const s = await import("./js/core/state.js"); s.newGame(); s.state.day = 4; s.save();
      void (await import("./js/daily/map.js")).chooseSpot();
    });
    await page.waitForSelector(".map");
    await recordStable("map after navigation", () => repeat(page.locator(".map-info")));
    // Real VN engine with a small deterministic dialogue, avoiding media waits.
    await page.evaluate(async () => {
      const map = await import("./js/daily/map.js"); map.interruptMap(null);
      const { play } = await import("./js/vn/engine.js");
      window.__doubletapDialogue = play({ dialogue_id: "doubletap-regression", lines: [
        { text: "連打で会話を送る" }, { text: "次の台詞" },
        { type: "choice", choices: [{ text: "選ぶ", next: "yes" }] },
      ], branches: { yes: [{ type: "set_flag", flag: "doubletap_choice" }, { text: "選択後の台詞" }] } });
    });
    await page.waitForTimeout(600);
    await recordStable("dialogue advance", () => repeat(page.locator(".vn-box")));
    // Wait for actual progression rather than using the VN auto/skip hooks.
    for (let i = 0; i < 8 && !await page.locator(".vn-choice").isVisible(); i++) {
      await repeat(page.locator(".vn-box"), 1); await page.waitForTimeout(100);
    }
    await page.locator(".vn-choice").waitFor({ state: "visible" });
    await page.locator('[data-test="vn-glossary"]').click();
    const largestGroup = await page.evaluate(() => window.__remake.DB.glossary.reduce((best, g, i, groups) => g.terms.length > groups[best].terms.length ? i : best, 0));
    await page.locator(".gl-tab").nth(largestGroup).click();
    const scroll = page.locator(".gl-body");
    assert(await scroll.evaluate(el => el.scrollHeight > el.clientHeight), "real glossary overflows");
    await recordStable("glossary scroll", async () => {
      const b = await scroll.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height * .8;
      if (mobile) {
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let i = 1; i <= 10; i++) {
          await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - b.height * .6 * i / 10 }] });
          await page.waitForTimeout(20);
        }
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else { await page.mouse.move(x, y); await page.mouse.wheel(0, 400); }
    });
    assert(await scroll.evaluate(el => el.scrollTop > 0), "glossary scroll gesture works");
    await page.locator("#modal .modal-actions button").click();
    await recordStable("choice double tap", () => repeat(page.locator(".vn-choice"), 2));
    assert(await page.evaluate(() => window.__remake.state.flags.doubletap_choice), "choice applied");
    for (let i = 0; i < 8 && await page.locator("#vn.active").count(); i++) {
      await repeat(page.locator(".vn-box"), 1); await page.waitForTimeout(100);
    }
    await page.evaluate(async () => { void window.__remake.dev.drill("holes"); });
    await page.locator('[data-test="hole-start"]').waitFor({ state: "visible", timeout: 20000 });
    await recordStable("mini-game template repeated taps", () => repeat(page.locator(".ht-option").first()));
    await page.locator('[data-test="hole-start"]').click();
    await page.locator('[data-test="hole-punch"]').waitFor({ state: "visible" });
    await page.waitForTimeout(4000); // countdown
    await recordStable("mini-game pointer input", () => repeat(page.locator('[data-test="hole-punch"]'), 2));
    assert(await page.locator(".foil-holes .foil-hole").count() > 0, "real mini-game records punches");
    assert.equal(await page.locator(".foil:not(.ht-preview)").evaluate(el => getComputedStyle(el).touchAction), "none", "mini-game drag policy preserved");
    await boot(); // fresh document stops the mini-game timers, same isolated save
    assert.equal(await page.evaluate(async () => { const s = await import("./js/core/state.js"); return s.load().day; }), 4, "save survives reload");
    await page.evaluate(async () => { void (await import("./js/daily/map.js")).chooseSpot(); });
    await page.waitForSelector(".map");
    await recordStable("map after save restore", () => repeat(page.locator(".map-info")));
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size); await page.waitForTimeout(300);
      const fit = await page.evaluate(() => Number(document.querySelector("#stage").style.getPropertyValue("--k")));
      assert(Math.abs(fit - Math.min(size.width / 1280, size.height / 720)) < .001, "orientation fits stage");
      await recordStable(`after viewport resize ${size.width}x${size.height}`, async () => {
        // Portrait mobile may display the orientation hint over the game.
        for (let i = 0; i < 4; i++) { await tap(90, 100); await page.waitForTimeout(70); }
      });
    }
    await page.evaluate(async () => {
      // The slash attack is learned from Sumi's special training (#712); without the
      // flag the button stays disabled forever, so grant it like steam_slash.mjs does.
      const core = await import("./js/core/state.js");
      core.state.flags._sumi_attack_learned = true;
      void window.__remake.dev.drill("steam");
    });
    await page.locator('[data-test="dodge-slash"]:not(:disabled)').waitFor({ state: "visible", timeout: 20000 });
    const pad = page.locator('[data-test="dodge-pad"]');
    assert.equal(await pad.evaluate(el => getComputedStyle(el).touchAction), "none");
    const heartBefore = await page.locator(".dodge-heart").evaluate(el => el.style.transform);
    await recordStable("mini-game captured drag", async () => {
      const b = await pad.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      if (mobile) {
        await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + b.width * .4, y }] });
        await page.waitForTimeout(300);
        await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + b.width * .4, y, { steps: 5 });
        await page.waitForTimeout(300); await page.mouse.up();
      }
    });
    assert.notEqual(await page.locator(".dodge-heart").evaluate(el => el.style.transform), heartBefore, "drag moves the player");
    assert.equal(await pad.evaluate(el => el.classList.contains("held")), false, "pointer capture releases");
    const before = (await measure()).gameScale;
    await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await page.waitForTimeout(300);
    const zoomed = await measure();
    results.push({ mobile, label: "browser zoom does not counter-scale game", before, after: zoomed,
      pass: Math.abs(zoomed.browserScale - 2) < .01 && Math.abs(zoomed.gameScale - before) < .001 });
    assert.deepEqual(errors, [], "no runtime errors");
    await context.close();
  }
  console.log(JSON.stringify({ browser: browser.version(), results, missing: [...missing] }, null, 2));
  assert(results.every(r => r.pass), "viewport regression (see measured results)");
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
