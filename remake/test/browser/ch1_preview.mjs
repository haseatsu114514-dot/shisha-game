// #384: real chapter-clear integration, retro preview controls and interrupted loading.
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits, storageSnapshot } from "./support.mjs";
import { createChapterSample } from "../../js/chapters/chapter-preview-samples.js";

const base = JSON.parse(fs.readFileSync(new URL("../../../data/chapter_previews/ch2.json", import.meta.url), "utf8"));
assert.equal(base.presentation, "quiet", "The owner selected C for the production preview");
const spec = createChapterSample(base, base.presentation);
const frameIds = spec.frames.map(frame => frame.id);
const preview = '[data-test="chapter-preview"]';

async function setup(page, { cleared = false, restore = false } = {}) {
  await page.evaluate(async ({ cleared, restore }) => {
    window.P = {
      core: await import("./js/core/state.js"),
      chapter: await import("./js/chapters/ch1.js"),
      preview: await import("./js/chapters/ch1-preview.js"),
      ui: await import("./js/core/ui.js"),
    };
    if (restore) P.core.load();
    else {
      const state = P.core.newGame();
      Object.assign(state, { phase: cleared ? "cleared" : "daily", day: 14, money: 54321 });
      state.stats.technique = 37;
      state.contacts.push("naru");
      state.flags._preview_save_sentinel = "keep";
      P.core.save();
      localStorage.setItem("suien_remake_slot1", JSON.stringify({ chapter: 1, day: 7, marker: "untouched manual slot" }));
    }
    P.cuts = []; P.visuals = [];
    P.observer = new MutationObserver(() => {
      const root = document.querySelector('[data-test="chapter-preview"]');
      const cut = root?.dataset.cut;
      if (cut && cut !== P.cuts.at(-1)?.id) P.cuts.push({
        id: cut,
        elapsed: Number(root.dataset.elapsed || 0),
        caption: root.querySelector('[data-test="preview-caption"]')?.textContent || "",
      });
      const art = root?.querySelector(".preview-art");
      if (art?.complete && art.naturalWidth && !P.visuals.some(v => v.cut === cut)) {
        const a = art.getBoundingClientRect(), s = root.querySelector('[data-test="preview-screen"]').getBoundingClientRect();
        const caption = root.querySelector('[data-test="preview-caption"]');
        P.visuals.push({ cut, file: art.src.split("/").at(-1), width: art.naturalWidth, height: art.naturalHeight,
          wholeImageFits: a.left >= s.left - 1 && a.top >= s.top - 1 && a.right <= s.right + 1 && a.bottom <= s.bottom + 1,
          captionFits: !caption || (caption.scrollWidth <= caption.clientWidth + 1 && caption.scrollHeight <= caption.clientHeight + 1),
          captionFont: caption ? getComputedStyle(caption.querySelector("p")).fontFamily : "",
          dotFontLoaded: [...document.fonts].some(f => f.family === "DS Dot" && f.status === "loaded"),
          dotFont: !!caption && getComputedStyle(caption).fontFamily.includes("DS Dot")
            && [...document.fonts].some(f => f.family === "DS Dot" && f.status === "loaded") });
      }
    });
    P.observer.observe(document.getElementById("stage"), { subtree: true, attributes: true, childList: true });
    P.launch = ({ abortable = false } = {}) => {
      P.done = false; P.result = null;
      P.controller = abortable ? new AbortController() : null;
      P.running = P.preview.playChapterPreview({
        ...(P.controller ? { signal: P.controller.signal } : {}),
      }).then(result => { P.result = result; P.done = true; return result; });
    };
  }, { cleared, restore });
}

async function playing(page) {
  await page.locator(`${preview}[data-phase="playing"]`).waitFor({ timeout: 25000 });
}

async function assertPreviewLayout(page) {
  await assertFits(page, '[data-test="preview-screen"], [data-test="preview-skip"], [data-test="preview-pause"], [data-test="preview-sound"]');
  const bounds = await page.locator('[data-test="preview-screen"]').evaluate(node => {
    const r = node.getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
    const caption = document.querySelector('[data-test="preview-caption"]');
    return { ratio: r.width / r.height, stageRatio: stage.width / stage.height,
      captionFits: !caption || (caption.scrollWidth <= caption.clientWidth + 1 && caption.scrollHeight <= caption.clientHeight + 1) };
  });
  assert(Math.abs(bounds.ratio - 16 / 9) < .01, `Adopted C screen is not 16:9: ${JSON.stringify(bounds)}`);
  assert(Math.abs(bounds.stageRatio - 16 / 9) < .01);
  assert(bounds.captionFits, "Preview caption is clipped");
}

function withoutPreviewSaveFields(saved) {
  const copy = structuredClone(saved);
  delete copy.savedAt;
  delete copy.flags._ch1_preview_seen;
  return copy;
}

// Use the timeline's first image; the art directory is deliberately not hardcoded.
function imagePattern() {
  const image = spec.frames.find(frame => frame.art)?.art;
  assert(image, "Preview timeline has no image asset to exercise");
  return `**/${image.split("/").at(-1)}.webp`;
}

await suite("ch1-preview", async check => {
  await check("desktop-full-timeline", async page => {
    await setup(page, { cleared: true });
    const before = await page.evaluate(() => structuredClone(P.core.state));
    await page.evaluate(() => { P.clearRun = P.chapter.showClear(); });
    await playing(page);
    assert.equal(await page.locator(preview).getAttribute("data-sample"), "quiet", "Chapter clear did not use the adopted C presentation");
    await assertPreviewLayout(page);
    // Repeated dialogue advances must not activate the preview's SKIP button.
    for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
    assert.equal(await page.locator(preview).getAttribute("data-phase"), "playing");
    await page.locator(preview).waitFor({ state: "detached", timeout: spec.duration + 15000 });
    await page.locator('[data-test="end-title"]').waitFor();
    const result = await page.evaluate(() => ({ cuts: P.cuts, visuals: P.visuals, state: P.core.state, saved: P.core.peekSave() }));
    assert.deepEqual(result.cuts.map(cut => cut.id), frameIds, "The preview skipped or reordered a timed cut");
    const adopted = spec.frames.filter(f => f.art);
    assert.equal(result.visuals.length, adopted.length);
    for (const frame of adopted) {
      const visual = result.visuals.find(v => v.cut === frame.id);
      assert(visual && visual.file === `${frame.art}.webp` && visual.width === 1664 && visual.height === 936,
        `An approved sample frame was replaced: ${JSON.stringify(visual)}`);
      assert(visual.wholeImageFits && visual.captionFits && visual.captionFont.includes("Suien Gothic") && visual.dotFontLoaded,
        `The adopted C composition or subtitle font changed: ${JSON.stringify(visual)}`);
    }
    const returnIndex = result.cuts.findIndex(cut => cut.id === "minto-return");
    assert.equal(result.cuts[returnIndex - 1]?.id, "chapter-title");
    assert.equal(result.cuts[returnIndex + 1]?.id, "last-question");
    assert.equal(result.cuts[returnIndex].caption, result.cuts.find(cut => cut.id === "minto-warning").caption,
      "Minto's words did not return between the title and the final question");
    assert(result.state.flags._ch1_preview_seen);
    assert(result.saved.flags._ch1_preview_seen);
    assert.deepEqual(withoutPreviewSaveFields(result.state), withoutPreviewSaveFields(before));
    await assertFits(page, '[data-test="end-title"], [data-test="end-preview"]');
    const ratio = await page.locator("#stage").evaluate(node => { const r = node.getBoundingClientRect(); return r.width / r.height; });
    assert(Math.abs(ratio - 16 / 9) < .01, "Chapter clear did not return to 16:9");
  });

  for (const [label, options] of [
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["reduced-motion", { reducedMotion: "reduce" }],
  ]) await check(`${label}-controls-and-save-preservation`, async page => {
    await setup(page);
    const before = await storageSnapshot(page);
    await page.evaluate(() => P.launch());
    await playing(page);
    await assertPreviewLayout(page);
    if (label === "reduced-motion") {
      await page.locator(`${preview} .preview-art`).waitFor();
      assert.equal(await page.locator(`${preview} .preview-art`).evaluate(node => getComputedStyle(node).animationName), "none");
      await assertPreviewLayout(page);
    }
    await page.locator('[data-test="preview-pause"]').click();
    await page.locator(`${preview}[data-phase="paused"]`).waitFor();
    const stopped = await page.locator(preview).getAttribute("data-elapsed");
    await page.waitForTimeout(250);
    assert.equal(await page.locator(preview).getAttribute("data-elapsed"), stopped);
    const sound = page.locator('[data-test="preview-sound"]');
    const soundBefore = await sound.getAttribute("aria-pressed");
    await sound.click();
    assert.notEqual(await sound.getAttribute("aria-pressed"), soundBefore, "Sound control did not toggle");
    await page.locator('[data-test="preview-pause"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.waitForFunction(() => P.done);
    assert.equal(await page.evaluate(() => P.result), "skipped");
    assert.deepEqual(await storageSnapshot(page), before, "Direct preview wrote a player's save or settings");
    assert.equal(await page.locator(preview).count(), 0);
  }, options);

  await check("legacy-cleared-auto-once-replay", async page => {
    await setup(page, { cleared: true });
    const original = await page.evaluate(() => ({ state: structuredClone(P.core.state), slot: localStorage.getItem("suien_remake_slot1") }));
    // A cleared save from before this feature has no preview flag.
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor();
    await setup(page, { restore: true });
    await page.evaluate(() => { P.resumeRun = P.chapter.resumeGame(); });
    await page.locator(preview).waitFor();
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator('[data-test="end-title"]').waitFor();
    const viewed = await page.evaluate(() => ({ saved: P.core.peekSave(), slot: localStorage.getItem("suien_remake_slot1") }));
    assert.equal(viewed.saved.flags._ch1_preview_seen, true);
    assert.deepEqual(withoutPreviewSaveFields(viewed.saved), withoutPreviewSaveFields(original.state));
    assert.equal(viewed.slot, original.slot, "Auto preview overwrote a manual save slot");
    const savedAfterFirst = await storageSnapshot(page);
    await page.locator('[data-test="end-preview"]').click();
    await playing(page);
    await page.keyboard.press("Escape");
    await page.locator('[data-test="end-title"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), savedAfterFirst, "Replay saved again or changed game progress");
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor();
    await setup(page, { restore: true });
    await page.evaluate(() => P.chapter.resumeGame());
    await page.locator('[data-test="end-title"]').waitFor();
    assert.equal(await page.locator(preview).count(), 0, "Seen preview auto-played again after restoring the clear save");
  });

  await check("tab-visibility-and-user-pause", async page => {
    await setup(page);
    await page.clock.install();
    await page.evaluate(() => P.launch());
    // The actual asset loader must settle before advancing the virtual playback clock.
    await playing(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
    await page.evaluate(() => {
      P.hidden = true;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => P.hidden });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => P.hidden ? "hidden" : "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator(`${preview}[data-phase="paused"]`).waitFor();
    const before = await page.locator(preview).evaluate(node => ({ cut: node.dataset.cut, elapsed: node.dataset.elapsed }));
    await page.clock.runFor(15000);
    assert.deepEqual(await page.locator(preview).evaluate(node => ({ cut: node.dataset.cut, elapsed: node.dataset.elapsed })), before,
      "Background tab consumed the preview timeline");
    await page.evaluate(() => { P.hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    await playing(page);
    await page.clock.runFor(200);
    assert(Number(await page.locator(preview).getAttribute("data-elapsed")) > Number(before.elapsed));
    await page.locator('[data-test="preview-pause"]').click();
    await page.evaluate(() => { P.hidden = true; document.dispatchEvent(new Event("visibilitychange")); P.hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    assert.equal(await page.locator(preview).getAttribute("data-phase"), "paused", "Returning to the tab canceled the player's pause");
    await page.locator('[data-test="preview-skip"]').click();
    assert.equal(await page.evaluate(() => P.running), "skipped");
  });

  await check("delayed-image-remains-skippable", async page => {
    await setup(page);
    const before = await storageSnapshot(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route(imagePattern(), async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => P.launch());
      await page.locator(`${preview}[data-phase="loading"]`).waitFor();
      await page.locator('[data-test="preview-skip"]').click();
      await page.waitForFunction(() => P.done);
      assert.equal(await page.evaluate(() => P.result), "skipped");
      assert.deepEqual(await storageSnapshot(page), before);
    } finally { release(); }
    await page.waitForTimeout(250);
    assert.equal(await page.locator(preview).count(), 0, "An image finishing after SKIP revived the overlay");
  });

  await check("failed-image-retry-and-skip", async page => {
    await setup(page);
    const before = await storageSnapshot(page);
    await page.route(imagePattern(), route => route.fulfill({ status: 200, contentType: "image/png", body: "not a decodable image" }));
    await page.evaluate(() => P.launch());
    await page.locator(`${preview}[data-phase="unavailable"]`).waitFor({ timeout: 20000 });
    await assertFits(page, '[data-test="preview-retry"], [data-test="preview-skip"]');
    await page.unroute(imagePattern());
    await page.locator('[data-test="preview-retry"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    assert.equal(await page.evaluate(() => P.running), "skipped");
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("abort-and-root-removal-cleanup", async page => {
    await setup(page, { cleared: true });
    const before = await storageSnapshot(page);
    await page.evaluate(() => P.launch({ abortable: true }));
    await playing(page);
    await page.evaluate(() => P.controller.abort());
    assert.equal(await page.evaluate(() => P.running), "aborted");
    assert.equal(await page.locator(preview).count(), 0);
    assert.deepEqual(await storageSnapshot(page), before);
    await page.evaluate(() => {
      P.done = false;
      P.clearRun = P.chapter.showClear().then(() => { P.done = true; });
    });
    await playing(page);
    await page.locator(preview).evaluate(root => root.remove());
    await page.waitForFunction(() => P.done);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    assert.equal(await page.locator(preview).count(), 0);
    assert.deepEqual(await storageSnapshot(page), before);
    assert.equal(await page.evaluate(() => !!P.core.state.flags._ch1_preview_seen), false, "Aborted preview marked itself seen");
    await page.evaluate(() => {
      P.done = false;
      P.clearRun = P.chapter.showClear().then(() => { P.done = true; });
    });
    await playing(page);
    // Navigation can replace the chapter-clear screen while the preview lives in #fx.
    // The caller must abort its overlay and prevent a stale completion from saving.
    await page.evaluate(() => P.ui.showScreen("preview-test-navigation", document.createElement("div")));
    await page.locator(preview).waitFor({ state: "detached" });
    await page.waitForFunction(() => P.done);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    assert.equal(await page.locator(preview).count(), 0, "Replacing the clear screen revived an old preview");
    assert.equal(await page.locator("#screen").getAttribute("data-screen"), "preview-test-navigation");
    assert.deepEqual(await storageSnapshot(page), before, "A removed clear screen saved stale preview completion");
    assert.equal(await page.evaluate(() => !!P.core.state.flags._ch1_preview_seen), false, "Navigation-aborted preview marked itself seen");
  });

  await check("standalone-page-preserves-game-storage", async page => {
    await setup(page);
    const before = await storageSnapshot(page);
    await page.goto(new URL("chapter-preview.html", page.url()).href);
    await page.locator('[data-test="preview-start"]').click();
    await playing(page);
    await assertPreviewLayout(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    assert.deepEqual(await storageSnapshot(page), before, "Standalone preview changed a player's game storage");
  });
});
