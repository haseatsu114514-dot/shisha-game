// Real title/gallery UI. Fixture comics/video exist only in this isolated test context.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const out = process.env.ARTIFACT_DIR || ".codex/artifacts/gallery";
fs.mkdirSync(out, { recursive: true });
// Synthetic two-second VP9 color clip; no production movie is adopted or required.
const movie = Buffer.from("GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAZiEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggZM7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAn0AAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIBkxV2xsGTSScgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QCYloA4JCwgaC6gVqagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiAZMVdsbBk0kZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDIuMDAwMDAwMDAwAB9DtnVEnueBAKOygQAAgIJJg0IACfAFlgA4JBwYSgAAMGAAAGc///7twy/////2xA/////nJh1FTKKXPACjlYEAKACGAECSnABQAAADIAAAWfmG4KOVgQBQAIYAQJKcAE7gAAMgAABZ+Ybgo5WBAHgAhgBAkpwAUAAAAyAAAFn5huCjlYEAoACGAECSnABNQAADIAAAWfmG4KOVgQDIAIYAQJKcAFAAAAMgAABZ+Ybgo5WBAPAAhgBAkpwATuAAAyAAAFn5huCjlYEBGACGAECSnABQAAADIAAAWfmG4KOVgQFAAIYAQJKcAEogAAMgAABZ+Ybgo5WBAWgAhgBAkpwAUAAAAyAAAFn5huCjlYEBkACGAMCSnABKIAADIAAAWfmG4KOVgQG4AIYAQJKcAFAAAAMgAABZ+Ybgo5WBAeAAhgBAkpwATUAAAyAAAFn5huCjlYECCACGAECSnABQAAADIAAAWfmG4KOVgQIwAIYAQJKcAE7gAAMgAABZ+Ybgo5WBAlgAhgBAkpwAUAAAAyAAAFn5huCjlYECgACGAECSnABKIAADIAAAWfmG4KOVgQKoAIYAQJKcAFAAAAMgAABZ+Ybgo5WBAtAAhgBAkpwATuAAAyAAAFn5huCjlYEC+ACGAECSnABQAAADIAAAWfmG4KOVgQMgAIYAwJKcAEogAAMgAABZ+Ybgo5WBA0gAhgBAkpwAUAAAAyAAAFn5huCjlYEDcACGAECSnABO4AADIAAAWfmG4KOVgQOYAIYAQJKcAFAAAAMgAABZ+Ybgo5WBA8AAhgBAkpwASiAAAyAAAFn5huCjlYED6ACGAECSnABQAAADIAAAWfmG4KOVgQQQAIYAQJKcAE7gAAMgAABZ+Ybgo5WBBDgAhgBAkpwAUAAAAyAAAFn5huCjlYEEYACGAECSnABNQAADIAAAWfmG4KOVgQSIAIYAQJKcAFAAAAMgAABZ+Ybgo5WBBLAAhgDAkpwASiAAAyAAAFn5huCjlYEE2ACGAECSnABQAAADIAAAWfmG4KOVgQUAAIYAQJKcAEogAAMgAABZ+Ybgo5WBBSgAhgBAkpwAUAAAAyAAAFn5huCjlYEFUACGAECSnABO4AADIAAAWfmG4KOVgQV4AIYAQJKcAFAAAAMgAABZ+Ybgo5WBBaAAhgBAkpwATUAAAyAAAFn5huCjlYEFyACGAECSnABQAAADIAAAWfmG4KOVgQXwAIYAQJKcAE7gAAMgAABZ+Ybgo5WBBhgAhgBAkpwAUAAAAyAAAFn5huCjlYEGQACGAMCSnABKIAADIAAAWfmG4KOVgQZoAIYAQJKcAFAAAAMgAABZ+Ybgo5WBBpAAhgBAkpwATuAAAyAAAFn5huCjlYEGuACGAECSnABQAAADIAAAWfmG4KOVgQbgAIYAQJKcAE1AAAMgAABZ+Ybgo5WBBwgAhgBAkpwAUAAAAyAAAFn5huCjlYEHMACGAECSnABO4AADIAAAWfmG4KOVgQdYAIYAQJKcAFAAAAMgAABZ+Ybgo5WBB4AAhgBAkpwASiAAAyAAAFn5huCjlYEHqACGAECSnABQAAADIAAAWfmG4BxTu2uRu4+zgQC3iveBAfGCAajwgQM=", "base64");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const t = id => '[data-test="' + id + '"]';
const results = [];
async function shot(page, file) {
  await page.locator(".gal-viewer.show").evaluateAll(nodes => Promise.all(nodes.flatMap(n => n.getAnimations().map(a => a.finished.catch(() => {})))));
  await page.screenshot({ path: path.join(out, file) });
}
async function open(page) { await page.locator(t("title-gallery")).click(); await page.locator(".gal").waitFor(); }
async function close(page) { await page.locator(t("gallery-close")).click(); await page.locator(".gal-overlay").waitFor({ state: "detached" }); }
async function snapshot(page) {
  return page.evaluate(() => Object.fromEntries(["suien_remake_save", "suien_remake_slot1", "suien_remake_slot2", "suien_remake_slot3"].map(k => [k, localStorage.getItem(k)])));
}
// First LOAD must preserve the *raw* old autosave before it is overwritten.
// Neither GALLERY, newGame(), save() nor saveToSlot() may pre-collect this fixture.
// Two fresh test-owned contexts exercise the inputs without contaminating the
// existing gallery checks below or opening a player's storage.
async function initialLegacyLoad(name, options, malformed) {
  const context = await browser.newContext(options), page = await context.newPage(), errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  try {
    await page.goto(base);
    await page.locator(t("title-load")).waitFor({ timeout: 45000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    const fixture = await page.evaluate(async malformed => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/core/gallery-progress.js");
      const old = core.newState();
      Object.assign(old, { chapter: 2, phase: "daily", day: 19, slot: 1 });
      if (malformed) old.keepsakes = [{ toString: null, valueOf: null }];
      else {
        old.flags._ch1_cleared = true;
        old.keepsakes = ["minto_first_cheki", "ageha_first_purikura"];
        old.flags._ageha_purikura_history = [
          { chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "samechan"] },
        ];
      }
      // A valid older free-time slot, with earlier mandatory delivery/story done.
      // This slot has no photos and no explicit chapter-clear evidence.
      const target = core.newState();
      Object.assign(target, { chapter: 1, phase: "daily", day: 6, slot: 1,
        money: 45678, stamina: 73, seed: 1234, weatherSeed: 4 });
      Object.assign(target.flags, { _morning_6: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _delivery_report_done: true,
        _c_station_registered: true, _lime_tut: 1,
        _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
        _ev_first_practice: true });
      const rawAuto = JSON.stringify(old), rawSlot = JSON.stringify(target);
      localStorage.setItem(core.SAVE_KEY, rawAuto);
      localStorage.setItem("suien_remake_slot1", rawSlot);
      // A fresh context must not have a collection already populated by setup.
      if (localStorage.getItem(progress.GALLERY_PROGRESS_KEY) !== null) throw Error("fixture pre-collected gallery");
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      (await import("./js/scenes/title.js")).showTitle();
      return { rawAuto, rawSlot, day: target.day, slot: target.slot, money: target.money, stamina: target.stamina };
    }, malformed);
    const press = async id => {
      if (options.hasTouch) await page.locator(t(id)).tap(); else await page.locator(t(id)).click();
    };
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), fixture.rawAuto,
      "title setup must not overwrite or pre-collect the old auto");
    await press("title-load"); await press("slot-1");
    await page.locator("#screen .map:not(.done)").waitFor();
    const loaded = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const gallery = await import("./js/core/gallery-progress.js");
      const s = core.state, auto = JSON.parse(localStorage.getItem(core.SAVE_KEY));
      return { phase: s.phase, day: s.day, slot: s.slot, money: s.money, stamina: s.stamina,
        auto: { chapter: auto.chapter, day: auto.day, slot: auto.slot },
        rawSlot: localStorage.getItem("suien_remake_slot1"),
        rawProgress: localStorage.getItem(gallery.GALLERY_PROGRESS_KEY), progress: gallery.readGalleryProgress() };
    });
    assert.equal(loaded.phase, "daily");
    for (const key of ["day", "slot", "money", "stamina"]) assert.equal(loaded[key], fixture[key], `${name}: ${key}`);
    assert.deepEqual(loaded.auto, { chapter: 1, day: fixture.day, slot: fixture.slot }, "LOAD must update auto, not leave DAY19 behind");
    assert.equal(loaded.rawSlot, fixture.rawSlot, "legacy manual slot must remain byte-identical");
    if (malformed) {
      assert.deepEqual(loaded.progress, { completeAnnounced: false, clearedChapters: [], keepsakes: [], purikura: [], routeRecords: {} }, "malformed IDs must not invent collection records");
    } else {
      assert(loaded.rawProgress, "old-auto-only evidence must persist before gallery is ever opened");
      assert.deepEqual(loaded.progress.clearedChapters, [1]);
      assert.deepEqual([...loaded.progress.keepsakes].sort(), ["ageha_first_purikura", "minto_first_cheki"]);
      assert.deepEqual(loaded.progress.purikura, [
        { chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "samechan"] },
      ]);
    }
    // Reach GALLERY only after LOAD/autosave has discarded the old raw evidence.
    await press("hud-menu");
    await Promise.all([page.waitForEvent("load"), press("menu-title")]);
    await page.locator(t("title-gallery")).waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    await press("title-gallery"); await page.locator(".gal").waitFor();
    await press("gallery-tab-cheki");
    assert.equal(await page.locator(t("gal-cg_minto_first_cheki")).count(), malformed ? 0 : 1);
    await press("gallery-tab-purikura");
    assert.equal(await page.locator(t("gal-cg_ageha_first_purikura")).count(), malformed ? 0 : 1);
    assert.equal(await page.locator(t("gal-purikura-2-18-1-guest-hajime-samechan")).count(), malformed ? 0 : 1);
    await press("gallery-tab-comic");
    assert.equal(await page.locator(".gal-cell").count(), 0, "unadopted comics remain hidden");
    assert(!requests.some(url => url.includes("asset_sources/short-comics")));
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_slot1")), fixture.rawSlot);
    assert.deepEqual(errors, [], `${name}: no LOAD error may be swallowed by the test`);
    await page.screenshot({ path: path.join(out, name + ".png") });
    results.push({ name, passed: true }); console.log("PASS: gallery " + name);
  } finally { await context.close(); }
}
// #1136: exercise the actual motion, manifest URL and persistent gallery unlock together.
async function adoptedPurikura(name, viewport, random, variant) {
  const context = await browser.newContext({ viewport, hasTouch: name.includes("touch"), reducedMotion: "no-preference" });
  const page = await context.newPage(), requests = [], errors = [];
  page.on("request", r => requests.push(r.url()));
  page.on("pageerror", e => errors.push(e.message));
  const id = "cg_ch2_ageha_purikura_strip";
  try {
    await page.goto(base + "?movar=" + variant);
    await page.locator(t("title-gallery")).waitFor({ timeout: 45000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(random => {
      const original = Math.random;
      Math.random = () => random;
      window.pkDone = false;
      window.pkRun = __remake.dev.motion("purikura").then(() => { window.pkDone = true; })
        .finally(() => { Math.random = original; });
    }, random);
    await page.waitForFunction(() => {
      const sheet = document.querySelector(".mo-pk-sheet");
      return sheet && Number(getComputedStyle(sheet).opacity) > .95;
    });
    const backgrounds = await page.locator(".mo-pk-half.cg.strip").evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundImage));
    assert.equal(backgrounds.length, 2);
    for (const background of backgrounds) assert.match(background, /\/img\/cgs\/cg_ch2_ageha_purikura_strip\.webp(?:[?][^"]*)?"\)$/);
    await page.screenshot({ path: path.join(out, name + "-adopted-printed.png") });
    await page.waitForFunction(() => window.pkDone, { timeout: 15000 });
    await page.evaluate(() => window.pkRun);
    assert.equal(await page.locator(".mo-purikura").count(), 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_gallery"))), [id]);
    await page.reload(); // The unlock must survive a fresh title/gallery load.
    await page.locator(t("title-gallery")).waitFor({ timeout: 45000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await open(page);
    for (const tab of ["all", "purikura"]) {
      await page.locator(t("gallery-tab-" + tab)).click();
      for (const suffix of ["_soft", "_gal"]) assert.equal(await page.locator(t("gal-" + id + suffix)).count(), 0);
    }
    await page.locator(t("gal-" + id)).click();
    await page.waitForFunction(() => document.querySelector(".gal-viewer img")?.naturalWidth > 0);
    assert.match(await page.locator(".gal-viewer img").getAttribute("src"), /img\/cgs\/cg_ch2_ageha_purikura_strip\.webp(?:[?].*)?$/);
    await shot(page, name + "-adopted-gallery.png");
    assert(!requests.some(url => /cg_ch2_ageha_purikura_strip_(soft|gal)/.test(url)), "candidate images must never be requested");
    assert.deepEqual(errors, []);
    results.push({ name, passed: true }); console.log("PASS: adopted purikura " + name);
  } finally { await context.close(); }
}
// R11: hold real img requests and advance browser timers explicitly.
async function imageLoadingNotice() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const notice = page.locator(t("module-loading"));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="gold"/></svg>';
  try {
    await page.goto(base);
    await page.locator(t("title-gallery")).waitFor({ timeout: 45000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.evaluate(() => {
      window.qaNoticeAdds = 0;
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches('[data-test="module-loading"]')) window.qaNoticeAdds++;
        }
      }).observe(document.querySelector("#fx"), { childList: true });
    });
    for (const mode of ["fast", "slow", "error", "early-close", "close", "gallery-close", "replace", "switch"]) {
      const held = [];
      let answer = null;
      const respond = route => answer === "error" ? route.abort() : route.fulfill({ contentType: "image/svg+xml", body: svg });
      const handler = route => { if (answer) return respond(route); held.push(route); };
      await page.route("**/assets/cgs/cg_r11_*.png", handler);
      const addedBefore = await page.evaluate(() => window.qaNoticeAdds);
      await page.evaluate(async mode => {
        const { DB } = await import("./js/core/data.js");
        const gallery = await import("./js/scenes/gallery.js");
        const id = "cg_r11_" + mode.replaceAll("-", "_");
        DB.manifest.cgs = [id + ".png", id + "_next.png"];
        DB.gallery = { items: [] };
        gallery.recordCg(id); gallery.recordCg(id + "_next");
        window.qaGalleryDone = gallery.openGallery();
        document.querySelector('[data-test="gal-' + id + '"]').click();
        window.qaNoticeImage = document.querySelector(".gal-viewer img");
        window.qaNoticeNext = document.querySelector('[data-test="gal-' + id + '_next"]');
      }, mode);
      await page.clock.runFor(499);
      assert.equal(await notice.count(), 0, mode + ": silent before 500ms");
      if (mode !== "fast" && mode !== "early-close") {
        await page.clock.runFor(1);
        assert.equal(await notice.count(), 1, mode + ": one notice at 500ms");
        assert(await page.evaluate(() => Number(getComputedStyle(document.querySelector("#fx")).zIndex)
          > Number(getComputedStyle(document.querySelector("#modal")).zIndex)), "notice must be above the viewer");
        await page.clock.runFor(1000);
        assert.equal(await notice.count(), 1, "a long wait must not duplicate the notice");
      }
      if (["early-close", "close"].includes(mode)) await page.keyboard.press("Escape");
      else if (mode === "gallery-close") await page.evaluate(() => document.querySelector('[data-test="gallery-close"]').click());
      else if (mode === "replace") await page.evaluate(async () => {
        (await import("./js/core/ui.js")).layers.modal.replaceChildren();
      });
      else if (mode === "switch") await page.evaluate(() => window.qaNoticeNext.click());
      if (!["fast", "slow", "error"].includes(mode)) {
        assert.equal(await notice.count(), 0, "close/replacement must remove the old notice immediately");
        await page.evaluate(() => {
          qaNoticeImage.dispatchEvent(new Event("load"));
          qaNoticeImage.dispatchEvent(new Event("error"));
        });
        assert.equal(await page.locator(".gal-media-error").count(), 0, "late old events cannot damage the viewer");
        await page.clock.runFor(500);
        assert.equal(await notice.count(), mode === "switch" ? 1 : 0, "only the new image may show a notice");
      }
      answer = mode === "error" ? "error" : "ok";
      await Promise.all(held.splice(0).map(respond));
      if (mode === "error") {
        await page.locator(".gal-viewer img").evaluate(img => img.hidden || new Promise(resolve => {
          img.addEventListener("error", () => resolve(), { once: true });
        }));
        assert.equal(await page.locator(".gal-media-error").count(), 1);
      } else if (["fast", "slow", "switch"].includes(mode)) {
        const width = await page.locator(".gal-viewer img").evaluate(img => img.complete ? img.naturalWidth : new Promise((resolve, reject) => {
          img.addEventListener("load", () => resolve(img.naturalWidth), { once: true });
          img.addEventListener("error", () => reject(new Error("fixture image failed")), { once: true });
        }));
        assert(width > 0);
      }
      await notice.waitFor({ state: "detached" });
      await page.clock.runFor(1000);
      assert.equal(await notice.count(), 0, "no late reappearance");
      if (mode === "fast") assert.equal(await page.evaluate(() => window.qaNoticeAdds), addedBefore, "fast load must never flash");
      await page.evaluate(() => document.querySelector('[data-test="gallery-close"]')?.click());
      await page.evaluate(() => window.qaGalleryDone);
      await page.unroute("**/assets/cgs/cg_r11_*.png", handler);
    }
    assert.deepEqual(errors, []);
    results.push({ name: "image-loading-notice", passed: true });
    console.log("PASS: gallery image-loading-notice");
  } finally { await context.close(); }
}
try {
  await imageLoadingNotice();
  for (const [name, viewport, random, variant] of [
    ["strip-pc-low", { width: 1280, height: 720 }, 0, "a"],
    ["strip-pc-mid", { width: 1280, height: 720 }, .4, "a"],
    ["strip-touch-high", { width: 844, height: 390 }, .999, "b"],
  ]) await adoptedPurikura(name, viewport, random, variant);
  await initialLegacyLoad("first-load-raw-auto-pc", { viewport: { width: 1280, height: 720 } }, false);
  await initialLegacyLoad("first-load-malformed-auto-touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true);
  for (const [name, options] of Object.entries({ pc: { viewport: { width: 1280, height: 720 } },
    touch: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  }).filter(([name]) => !process.env.GALLERY_DEVICE || process.env.GALLERY_DEVICE === name)) {
    const context = await browser.newContext(options), page = await context.newPage(), errors = [], requests = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => requests.push(r.url()));
    await page.route("**/img/comics/qa-*.webp", route => route.fulfill({ contentType: "image/svg+xml", body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="1086" height="1448"><rect width="1086" height="1448" fill="#fff5df"/><text x="60" y="150" font-size="70">GALLERY PAGE ' + (route.request().url().includes("two") ? "2" : "1") + '</text><rect x="60" y="250" width="440" height="500" fill="#8cbed2"/><rect x="570" y="250" width="440" height="500" fill="#d5a3b3"/><text x="120" y="900" font-size="100">1 → 2</text></svg>' }));
    await page.route("**/movies/qa.webm", route => route.fulfill({ contentType: "video/webm", body: movie }));
    await page.goto(base);
    await page.locator(t("title-gallery")).waitFor({ timeout: 45000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    if (name !== "pc") {
      await page.locator(t("title-layout-settings")).click();
      await page.locator(t("title-layout-ds")).click();
    }
    await open(page);
    assert.equal(await page.locator('[role="tab"]').count(), 6);
    await page.locator(t("gallery-tab-comic")).click();
    assert.match(await page.locator(".gal-empty").textContent(), /準備中/);
    await page.screenshot({ path: path.join(out, name + "-comics-unadopted.png") });
    await page.locator(t("gallery-tab-movie")).click();
    assert.match(await page.locator(".gal-empty").textContent(), /準備中/);
    assert.equal(await page.locator("video").count(), 0);
    assert(!requests.some(url => url.includes("asset_sources/short-comics")), "unadopted comic images are never requested");
    await close(page);

    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newState(); s.chapter = 2; s.day = 19; s.phase = "daily";
      s.flags._ch1_cleared = true; s.keepsakes = ["minto_first_cheki", "ageha_first_purikura"];
      s.flags._ageha_purikura_history = [{ chapter: 2, day: 18, slot: 1, mode: "guest", people: ["hajime", "samechan"] }];
      localStorage.setItem("suien_remake_slot1", JSON.stringify(s));
      localStorage.setItem("suien_remake_gallery", JSON.stringify(["cg_minto_cheki"]));
    });
    const before = await snapshot(page);
    await open(page);
    assert(await page.locator(".gal-grid .gal-cell").evaluateAll(nodes => {
      const rects = nodes.map(n => n.getBoundingClientRect());
      return rects.every((a, i) => rects.slice(i + 1).every(b => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
    }), "mixed still/portrait photo cards must not overlap or intercept another card");
    await page.locator(t("gallery-tab-cheki")).click();
    // A failed thumbnail must leave a named, usable card without a broken img.
    const cheki = page.locator(t("gal-cg_minto_first_cheki"));
    await cheki.locator("img").evaluate(n => n.dispatchEvent(new Event("error")));
    assert.equal(await cheki.locator("img").count(), 0);
    assert.equal(await cheki.locator(".gal-media-symbol").textContent(), "画像なし");
    assert.equal(await cheki.getAttribute("aria-label"), "みんとの初来店チェキ");
    assert.equal(await cheki.locator(".gal-caption").textContent(), "みんとの初来店チェキ");
    await page.locator(t("gal-cg_minto_first_cheki")).click();
    await page.locator(".gal-viewer.show .gal-media-image").waitFor();
    await page.waitForFunction(() => document.querySelector(".gal-viewer img").naturalWidth > 0);
    assert.equal(await page.locator(".gal-viewer img").evaluate(n => getComputedStyle(n).objectFit), "contain");
    await shot(page, name + "-cheki.png");
    await page.locator(t("gallery-viewer-close")).click();
    await page.locator(t("gallery-tab-purikura")).click();
    await page.locator(t("gal-cg_ageha_first_purikura")).click();
    await page.waitForFunction(() => document.querySelector(".gal-viewer img").naturalWidth > 0);
    await shot(page, name + "-purikura.png");
    await page.locator(t("gallery-viewer-close")).click();
    await page.locator(t("gal-purikura-2-18-1-guest-hajime-samechan")).click();
    assert.match(await page.locator(".gal-viewer .purikura-caption").textContent(), /サメちゃん/);
    assert(!(await page.locator(".gal-viewer").textContent()).includes("波多野"), "photo replay must not disclose her unlearned full name");
    await page.locator(t("gallery-viewer-close")).click();
    await close(page);
    assert.deepEqual(await snapshot(page), before, "collecting legacy evidence does not load or rewrite the save slots");

    await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      DB.gallery = { items: [
        { id: "qa_comic", title: "閲覧テスト", kind: "comic", approved: true, requiredChapter: 1, pages: ["img/comics/qa-one.webp", "img/comics/qa-two.webp"] },
        { id: "qa_late", title: "未来の題名を隠す", kind: "comic", approved: true, requiredChapter: 3, pages: ["img/comics/qa-late.webp"] },
        { id: "qa_rejected", title: "未採用候補を隠す", kind: "comic", approved: false, requiredChapter: 1, pages: ["img/comics/qa-rejected.webp"] },
        { id: "qa_movie", title: "再生テスト", kind: "movie", approved: true, requiredChapter: 2, src: "movies/qa.webm" },
      ] };
    });
    await open(page); await page.locator(t("gallery-tab-comic")).click();
    assert.equal(await page.locator('.gal-grid .gal-cell').count(), 2);
    assert(!(await page.locator(".gal").textContent()).includes("未来の題名"));
    assert(!(await page.locator(".gal").textContent()).includes("未採用候補"));
    assert(!requests.some(url => /qa-(late|rejected)/.test(url)));
    const comicCard = page.locator(t("gal-qa_comic"));
    await comicCard.locator("img").evaluate(n => n.dispatchEvent(new Event("error")));
    assert.equal(await comicCard.locator("img").count(), 0);
    assert.equal(await comicCard.locator(".gal-media-symbol").textContent(), "画像なし");
    assert.equal(await comicCard.getAttribute("aria-label"), "閲覧テスト");
    assert.equal(await comicCard.locator(".gal-caption").textContent(), "閲覧テスト");
    await page.locator(t("gal-qa_comic")).click();
    assert.equal(await page.locator(t("gallery-page-count")).textContent(), "1 / 2");
    assert(await page.locator(t("gallery-page-prev")).isDisabled());
    await page.locator(".gal-comic-scroll img").evaluate(n => { window.qaOldImage = n; });
    await page.locator(t("gallery-page-next")).click();
    await page.evaluate(() => qaOldImage.dispatchEvent(new Event("error")));
    assert.equal(await page.locator(".gal-media-error").count(), 0, "a late failure from the previous page cannot damage the current page");
    assert.equal(await page.locator(t("gallery-page-count")).textContent(), "2 / 2");
    assert(await page.locator(t("gallery-page-next")).isDisabled());
    await page.locator(t("gallery-zoom")).click();
    await page.waitForFunction(() => document.querySelector(".gal-comic-scroll").scrollHeight > document.querySelector(".gal-comic-scroll").clientHeight);
    await shot(page, name + "-comic-zoom-fixture.png");
    // 現在表示中のページ画像が失敗したら、その画像を隠して案内を1件だけ出す。
    await page.locator(".gal-comic-scroll img").evaluate(n => n.dispatchEvent(new Event("error")));
    assert.equal(await page.locator(".gal-media-error").count(), 1);
    assert.equal(await page.locator(".gal-media-error").textContent(), "画像を読み込めませんでした。閉じて、もう一度開いてください。");
    assert(await page.locator(".gal-comic-scroll img").evaluate(n => n.hidden), "the failed current page image is hidden");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".gal-viewer.show").count(), 0);
    await page.locator(t("gallery-tab-movie")).click();
    assert.equal(await page.locator(t("gal-qa_movie")).count(), 0, "chapter two not cleared yet");
    assert(!requests.some(url => url.endsWith("movies/qa.webm")));
    await close(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); s.chapter = 2; s.phase = "cleared"; s.flags._ch2_cleared = true;
      core.save(); core.wipeSave(); core.newGame(); core.save();
    });
    await page.reload(); await page.locator(t("title-gallery")).waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_gallery_progress")));
    assert.deepEqual(history.clearedChapters, [1, 2]); assert.equal(history.purikura.length, 1);
    await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      DB.gallery = { items: [{ id: "qa_movie", title: "再生テスト", kind: "movie", approved: true, requiredChapter: 2, src: "movies/qa.webm" }] };
    });
    await open(page); await page.locator(t("gallery-tab-movie")).click(); await page.locator(t("gal-qa_movie")).click();
    const v = page.locator("video.gal-movie");
    assert(await v.evaluate(n => n.controls && n.playsInline && !n.autoplay));
    await v.evaluate(async n => { window.qaMusic = (await import("./js/core/audio.js")).currentBgm(); window.qaVideo = n; await n.play(); });
    await page.waitForFunction(() => qaVideo.currentTime > 0);
    assert.equal(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm()), null);
    await page.locator(t("gallery-viewer-close")).click();
    assert(await page.evaluate(() => qaVideo.paused && !qaVideo.getAttribute("src")));
    assert(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm() === qaMusic), "title BGM returns after movie playback");
    assert.equal(await page.locator("video").count(), 0);
    await page.evaluate(() => qaVideo.dispatchEvent(new Event("play")));
    assert(await page.evaluate(() => qaVideo.paused), "detached video cannot restart from a late event");
    // 自然終了: 再生中は BGM が止まり、ended で再生前の BGM に戻る。失敗表示は出ない。
    const bgm = () => page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm());
    const playMovie = async () => {
      await page.locator(t("gal-qa_movie")).click();
      await page.locator("video.gal-movie").evaluate(async n => { window.qaMusic = (await import("./js/core/audio.js")).currentBgm(); window.qaVideo = n; await n.play(); });
      await page.waitForFunction(() => qaVideo.currentTime > 0);
      assert.equal(await bgm(), null, "BGM is stopped while the movie plays");
    };
    await playMovie();
    await page.locator("video.gal-movie").evaluate(n => n.dispatchEvent(new Event("ended")));
    assert(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm() === qaMusic), "BGM returns when the movie ends naturally");
    assert.equal(await page.locator(".gal-media-error").count(), 0, "a natural end is not a load failure");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".gal-viewer.show").count(), 0);
    assert.equal(await page.locator("video").count(), 0);
    // 読み込み失敗: BGM が戻り、動画用の案内が出る。閉じられる。
    await playMovie();
    await page.locator("video.gal-movie").evaluate(n => n.dispatchEvent(new Event("error")));
    assert(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm() === qaMusic), "BGM returns when the movie fails");
    assert.equal(await page.locator(".gal-media-error").count(), 1);
    assert.equal(await page.locator(".gal-media-error").textContent(), "動画を読み込めませんでした。閉じて、もう一度開いてください。");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".gal-viewer.show").count(), 0);
    assert.equal(await page.locator("video").count(), 0);
    await close(page);
    assert.deepEqual(errors, [], "unexpected page errors");
    results.push({ name, passed: true }); console.log("PASS: gallery " + name);
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
