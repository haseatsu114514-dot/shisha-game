// #454/#466: centered typewriter, white captions, adopted C face framing and selection-only gold buttons.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const shots = process.env.SHOTS || ".codex/artifacts/continue-typing";
await fs.mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const errors = [];

async function prepare(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator("#boot").waitFor({ state: "detached" });
  await page.evaluate(async () => {
    window.C = {
      go: await import("./js/chapters/gameover.js"), premium: await import("./js/chapters/continue-premium.js"),
      core: await import("./js/core/state.js"), ui: await import("./js/core/ui.js"),
    };
    C.core.newGame(); C.core.config.bgmVolume = C.core.config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes();
    await document.fonts.ready;
    C.script = variant => typeof variant === "number" ? C.go.SUMI_CONTINUE_SCRIPTS[variant]
      : C.premium.PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)];
    C.headTops = new Map();
    C.read = async () => {
      const root = document.querySelector(".gameover"), caption = root.querySelector(".go-speech-text");
      const box = caption.getBoundingClientRect(), stage = document.querySelector("#stage").getBoundingClientRect();
      const image = root.querySelector(".go-sumi-img"); await image.decode();
      if (!C.headTops.has(image.src)) {
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let first = 3; while (first < pixels.length && pixels[first] < 24) first += 4;
        C.headTops.set(image.src, Math.floor((first - 3) / 4 / canvas.width) / canvas.height);
      }
      const imageBox = image.getBoundingClientRect(), clip = image.parentElement.getBoundingClientRect();
      const { DB, portraitInfo } = await import("./js/core/data.js");
      const info = portraitInfo(root.dataset.speaker, root.dataset.emotion);
      const framing = DB.manifest.continuePortraits[info.folder][info.face];
      const imageHeight = parseFloat(image.style.height), imageWidth = parseFloat(image.style.width);
      const faceSize = imageHeight * framing.size;
      const faceCenterX = (clip.left - stage.left) / stage.width * 1280
        + parseFloat(getComputedStyle(image).left) + (framing.cx - .5) * imageWidth;
      const faceCenterY = (clip.top - stage.top) / stage.height * 720
        + parseFloat(image.style.top) + imageHeight * (framing.top + framing.size / 2);
      return { prefix: [...caption.querySelectorAll(".go-on")].map(n => n.textContent).join(""),
        text: caption.textContent, cue: Number(root.dataset.cue), live: root.querySelector(".go-a11y").textContent,
        count: root.querySelector(".go-count").textContent, phase: root.dataset.phase,
        animations: caption.getAnimations({ subtree: true }).length,
        transformed: [caption, ...caption.children].some(n => getComputedStyle(n).transform !== "none"),
        centered: Math.abs((box.left + box.right - stage.left - stage.right) / 2) <= 1,
        fits: box.left >= stage.left - 1 && box.right <= stage.right + 1 && box.height <= stage.height / 720 * 72,
        white: [...caption.children].every(n => getComputedStyle(n).color === "rgb(255, 255, 255)"),
        faceSize, faceCenterX, faceCenterY,
        headGap: (imageBox.top + C.headTops.get(image.src) * imageBox.height - clip.top) / stage.height * 720,
        buttons: [...root.querySelectorAll(".go-choice")].map(button => ({
          selected: getComputedStyle(button).getPropertyValue("--go-frame-selected").trim() === "1",
          color: getComputedStyle(button).color,
          frame: button.querySelector(".go-choice-frame-selected").getAttribute("src"),
        })),
        decisions: [...C.decisions] };
    };
    C.resources = () => JSON.stringify({ state: C.core.state, storage: { ...localStorage } });
    C.before = C.resources();
  });
  await page.clock.install({ time: new Date("2026-10-13T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-13T00:00:01Z"));
  return { context, page };
}
async function mount(page, variant = 0, reducedMotion = false, context = null) {
  await page.evaluate(({ variant, reducedMotion, context }) => {
    C.decisions = [];
    C.ui.showScreen("end", C.go.buildGameOver({ variant, context, soundEffects: false, reducedMotion,
      onRetry: () => C.decisions.push("retry"), onTitle: () => C.decisions.push("quit") }));
  }, { variant, reducedMotion, context });
  await page.locator(".go-sumi-img").evaluate(image => image.decode());
}
const read = page => page.evaluate(() => C.read());
function captionIsStatic(value) {
  assert.equal(value.animations, 0, "Caption and letters must not animate");
  assert(!value.transformed, "Caption and letters must not scale or bounce");
  assert(value.centered && value.fits, "Visible prefix stays centered on one line inside the stage");
  assert(value.text.startsWith(value.prefix), "Only a prefix of whole Unicode characters is visible");
  assert(value.white, "All normal/reaction letters, including emphasis, stay white");
  // C intentionally crops hair/hat. Every cue/reaction keeps the adopted face bbox instead.
  assert(Math.abs(value.faceSize - 524.8) < .02 && Math.abs(value.faceCenterX - 640) < .02
    && Math.abs(value.faceCenterY - 273) < .02, `C framing changed: ${JSON.stringify(value)}`);
}

try {
  for (const [label, options, touch] of [
    ["pc", { viewport: { width: 1280, height: 720 } }, false],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) {
    const { page, context } = await prepare(options);
    const tap = selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
    // Use a real uncapped cue long enough to distinguish 26 letters/s from the old 20.
    const target = await page.evaluate(() => C.go.SUMI_CONTINUE_SCRIPTS.flatMap((s, variant) =>
      s.cues.map((c, index) => ({ variant, index, text: c.text,
        next: !!s.cues[index + 1], slot: (s.cues[index + 1]?.at ?? s.duration) - c.at })))
      .find(c => c.next && [...c.text].length >= 14 && [...c.text].length / 26 < c.slot * .6));
    assert(target, "Production scripts need an uncapped timing sample");
    await mount(page);
    await page.clock.runFor(20);
    assert(await page.locator('[data-test="retry"]').evaluate(b => b === document.activeElement), "Ready screen focuses retry");
    await page.locator('[data-test="retry"]').evaluate(b => b.blur());
    await page.mouse.move(0, 0);
    let buttons = (await read(page)).buttons;
    assert.deepEqual(buttons.map(b => b.selected), [false, false], "Unfocused choices stay neutral");
    assert.equal(buttons[0].color, buttons[1].color, "Neither choice is privileged before selection");
    assert(buttons.every(b => b.frame.includes("neon_retry_frame")), "Both choices have the same prepared gold frame");
    if (!touch) {
      await page.locator('[data-test="retry"]').hover();
      assert.deepEqual((await read(page)).buttons.map(b => b.selected), [true, false], "Hover selects retry in gold");
      await page.locator('[data-test="game-over-title"]').hover();
      assert.deepEqual((await read(page)).buttons.map(b => b.selected), [false, true], "Hover selects quit in gold");
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      for (let i = 0; i < 6 && !await page.locator('[data-test="retry"]').evaluate(b => b === document.activeElement); i++) await page.keyboard.press("Tab");
      assert(await page.locator('[data-test="retry"]').evaluate(b => b === document.activeElement));
      assert.deepEqual((await read(page)).buttons.map(b => b.selected), [true, false], "Keyboard focus selects retry in gold");
      await page.locator('[data-test="retry"]').hover();
      await page.keyboard.press("Tab");
      assert.deepEqual((await read(page)).buttons.map(b => b.selected), [false, true], "Keyboard focus takes precedence over a resting pointer");
      await page.mouse.click(0, 0);
      assert.deepEqual((await read(page)).buttons.map(b => b.selected), [false, false], "Leaving the choices restores neutral colors");
    }
    await mount(page, target.variant);
    await page.evaluate(index => {
      const root = document.querySelector(".gameover");
      while (Number(root.dataset.cue) < index) {
        root.querySelector(".go-dialogue").click();
      }
      C.rateStart = performance.now(); C.counts = [root.querySelectorAll(".go-on").length];
      C.observer = new MutationObserver(() => {
        const n = root.querySelectorAll(".go-on").length;
        if (C.counts.at(-1) !== n) C.counts.push(n);
      });
      C.observer.observe(root.querySelector(".go-speech-text"), { attributes: true, subtree: true });
    }, target.index);
    for (const ms of [33, 50, 100, 150, 100]) {
      await page.clock.runFor(ms);
      const value = await read(page); captionIsStatic(value);
      const expected = await page.evaluate(() => Math.floor((performance.now() - C.rateStart) / 1000 * 26) + 1);
      assert([...value.prefix].length >= expected - 1 && [...value.prefix].length <= expected,
        `26 letters/s within one animation frame: ${JSON.stringify(value)}`);
      assert.equal(value.live, target.text, "Screen reader gets the whole cue, independent of typing");
    }
    const counts = await page.evaluate(() => { C.observer.disconnect(); return C.counts; });
    assert(counts.every((n, i) => i === 0 || n - counts[i - 1] === 1), "Letters appear one at a time");
    await page.screenshot({ path: `${shots}/${label}-typing.png` });
    const beforeClick = await read(page);
    await tap('[data-test="continue-caption"]');
    const full = await read(page); assert.equal(full.prefix, target.text); captionIsStatic(full);
    assert.equal(full.count, beforeClick.count, "Full-text input does not advance the deadline");
    await tap('[data-test="continue-next"]');
    assert.equal((await read(page)).cue, target.index + 1);

    // Every normal/premium cue completes in its original slot, including the shortest slots.
    const variants = await page.evaluate(() => [0, 1, 2,
      ...Object.keys(C.premium.PREMIUM_CONTINUE_SCRIPTS).map(id => `premium:${id}`)]);
    for (const variant of variants) {
      await mount(page, variant);
      const script = await page.evaluate(variant => C.script(variant), variant);
      for (let index = 0; index < script.cues.length; index++) {
        const cue = script.cues[index];
        assert.equal((await read(page)).cue, index);
        const slot = (script.cues[index + 1]?.at ?? script.duration) - cue.at;
        await page.clock.runFor(Math.ceil(slot * 620));
        const value = await read(page); captionIsStatic(value);
        assert.equal(value.prefix, cue.text, `${variant} cue ${index} completes before the next cue`);
        if (index < script.cues.length - 1) await tap('[data-test="continue-next"]');
      }
      for (const choice of ["retry", "quit"]) {
        await mount(page, variant);
        await tap(`[data-test="${choice === "retry" ? "retry" : "game-over-title"}"]`);
        const first = await read(page); captionIsStatic(first);
        assert.deepEqual(first.buttons.map(b => b.selected), choice === "retry" ? [true, false] : [false, true], "Only the chosen, now disabled button keeps gold during reactions");
        assert.equal(first.live, script.reactions[choice].text.join(""));
        assert.equal(first.prefix, [...script.reactions[choice].text[0]][0]);
        await page.clock.runFor(500);
        const partial = await read(page); captionIsStatic(partial);
        if (partial.prefix !== partial.text) await tap('[data-test="continue-proceed"]');
        assert.equal((await read(page)).prefix, script.reactions[choice].text[0]);
        await tap('[data-test="continue-proceed"]');
        const second = await read(page); captionIsStatic(second);
        assert.equal(second.phase, "leaving", "one complete reaction exits on the next press");
        await page.clock.runFor(10000);
        assert.deepEqual((await read(page)).decisions, [choice], "Reaction leaves through the original route once");
      }
    }
    // Visibility pauses both the 20-second clock and the new caption-only frame updates.
    await mount(page, target.variant);
    await page.clock.runFor(100);
    const paused = await read(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(5000);
    const hidden = await read(page); assert.equal(hidden.prefix, paused.prefix); assert.equal(hidden.count, paused.count);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(100); assert.equal((await read(page)).count, "20");
    await mount(page, 0, true);
    const reduced = await read(page); assert.equal(reduced.prefix, reduced.text); captionIsStatic(reduced);
    await tap('[data-test="retry"]');
    const reducedReaction = await read(page); assert.equal(reducedReaction.prefix, reducedReaction.text);
    await mount(page, 0, false, { lossOrdinal: 2 });
    await page.clock.runFor(20000);
    const zero = await read(page); assert.equal(zero.count, "0"); assert.equal(zero.phase, "gameover");
    await page.clock.runFor(1900); assert.deepEqual((await read(page)).decisions, ["quit"]);
    await page.clock.runFor(1000); assert.deepEqual((await read(page)).decisions, ["quit"]);
    assert.equal(await page.evaluate(() => C.resources()), await page.evaluate(() => C.before), "No game/save changes");
    console.log(`[continue typing] PASS: ${label} 26/s, centered white prefixes, ${await page.evaluate(() => C.headTops.size)} C-framed portrait faces, neutral/selected buttons, all ${variants.length} scripts/choices, controls, hidden-tab pause, reduced motion, 20-second timeout and unchanged state`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
