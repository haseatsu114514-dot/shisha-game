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
const movie = Buffer.from("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", "base64");
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
try {
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
    await close(page);
    assert.deepEqual(errors, [], "unexpected page errors");
    results.push({ name, passed: true }); console.log("PASS: gallery " + name);
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
