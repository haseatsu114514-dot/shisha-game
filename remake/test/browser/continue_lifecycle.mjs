// #590: real browser/controller, actual rotate-hint CSS, overlapping pauses and owner/cleanup boundaries.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const out = process.env.ARTIFACT_DIR || ".codex/artifacts/continue-lifecycle";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"],
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      isMobile: touch, hasTouch: touch });
    const page = await context.newPage(), errors = [], missing = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (r.status() >= 400) missing.push(r.url()); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
    // This suite exercises synthesized CONTINUE audio; unrelated recorded SE
    // preload failure is intentional and must not fetch external dependencies.
    await page.route("**/assets/audio/se/**", r => r.abort());
    await page.addInitScript(() => {
      // Track emitted oscillators without replacing the browser's AudioContext/rendering.
      const AC = window.AudioContext;
      const edges = new WeakMap(), connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (target, ...args) {
        const result = connect.call(this, target, ...args);
        if (!edges.has(this)) edges.set(this, new Set());
        edges.get(this).add(target);
        return result;
      };
      const reaches = (source, target, steps) => steps === 0 ? source === target
        : [...(edges.get(source) || [])].some(next => reaches(next, target, steps - 1));
      window.__notes = [];
      window.__audioContexts = [];
      window.AudioContext = class extends AC {
        constructor(...args) { super(...args); this.__gains = []; window.__audioContexts.push(this); }
        createGain() { const gain = super.createGain(); this.__gains.push(gain); return gain; }
        createOscillator() {
          const osc = super.createOscillator(), start = osc.start.bind(osc), stop = osc.stop.bind(osc);
          const set = osc.frequency.setValueAtTime.bind(osc.frequency);
          let scheduledFrequency;
          osc.frequency.setValueAtTime = (value, at) => { scheduledFrequency = value; return set(value, at); };
          osc.start = at => {
            const row = { freq: scheduledFrequency ?? osc.frequency.value, at: performance.now(), count: document.querySelector(".go-count")?.textContent, stops: [] };
            // CONTINUE routes oscillator → envelope → owned output → SE bus.
            // Exclude muted synth BGM and the separate MENU button click sound.
            if (reaches(osc, this.__gains[1], 3)) window.__notes.push(row);
            osc.__row = row; return start(at);
          };
          osc.stop = at => { osc.__row?.stops.push(at ?? null); return stop(at); };
          return osc;
        }
      };
    });
    await page.goto(new URL("continue-preview.html", base).href);
    await page.waitForFunction(() => !document.querySelector("#preview-play").disabled);
    await page.locator("#preview-play").click();
    await page.waitForFunction(() => window.__audioContexts.some(c => c.state === "running"));
    await page.evaluate(() => document.querySelector(".gameover").cleanupContinue());
    await page.evaluate(async () => {
      const { config } = await import("./js/core/state.js");
      config.bgmVolume = 0; config.seVolume = .5; config.mute = false;
      (await import("./js/core/audio.js")).applyVolumes();
      for (const id of ["rotate-hint", "modal"]) {
        const node = document.createElement("div"); node.id = id;
        (id === "modal" ? document.querySelector("#stage") : document.body).append(node);
      }
      document.querySelector("#rotate-hint").textContent = "横向きにしてください";
      (await import("./js/core/ui.js")).initLayers();
      await document.fonts.ready;
    });
    await page.clock.install({ time: new Date("2026-10-20T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-20T00:00:01Z"));
    const mount = async (options = {}) => {
      await page.evaluate(async options => {
        window.__go?.cleanupContinue();
        const { buildGameOver } = await import("./js/chapters/gameover.js");
        window.__calls = []; window.__notes = [];
        window.__go = buildGameOver({ variant: 0, ...options,
          onRetry: () => window.__calls.push("retry"), onTitle: () => window.__calls.push("title") });
        document.querySelector("#screen").replaceChildren(window.__go);
      }, options);
      await page.clock.runFor(20);
    };
    const snapshot = () => page.evaluate(() => ({
      count: document.querySelector(".go-count").textContent,
      cue: __go.dataset.cue, letters: __go.querySelectorAll(".go-on").length,
      paused: __go.dataset.paused, phase: __go.dataset.phase, calls: [...__calls],
      notes: __notes.map(n => ({ ...n, stops: [...n.stops] })),
    }));
    const hidden = value => page.evaluate(value => {
      Object.defineProperty(document, "hidden", { configurable: true, value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, value);
    const menu = value => page.evaluate(async value => {
      if (value) {
        const { modal } = await import("./js/core/ui.js");
        void modal({ title: "MENU", body: "保存・読込の表示中",
          options: [{ label: "閉じる", test: "590-menu-close" }] });
      } else document.querySelector('[data-test="590-menu-close"]').click();
    }, value);
    await mount({ context: { lossOrdinal: 1 }, soundEffects: false });
    await page.clock.runFor(22000);
    assert.equal((await snapshot()).phase, "speaking", "first loss has no automatic timeout");
    assert.equal((await snapshot()).count, "∞", "first loss keeps the countdown animation before showing no limit");
    assert(await page.locator('[data-test="retry"],[data-test="game-over-title"]').evaluateAll(buttons => buttons.every(button => !button.disabled)));
    if (touch) {
      await page.setViewportSize({ width: 390, height: 844 });
      await mount({ context: { lossOrdinal: 2 } });
      assert.equal(await page.locator("#rotate-hint").evaluate(n => getComputedStyle(n).display), "grid");
      const held = await snapshot(); await page.clock.runFor(30000);
      assert.deepEqual(await snapshot(), held, "30s initial rotation holds captions, count, callbacks and SE");
      await page.setViewportSize({ width: 844, height: 390 }); await page.clock.runFor(20);
    } else await mount({ context: { lossOrdinal: 2 } });
    await page.clock.runFor(3000);
    await menu(true); await hidden(true);
    const held = await snapshot(); await page.clock.runFor(30000);
    assert.deepEqual(await snapshot(), held, "menu + hidden hold one clock interval");
    await menu(false); await page.clock.runFor(5000);
    assert.deepEqual(await snapshot(), held, "clearing only menu cannot resume hidden");
    if (touch) {
      await page.setViewportSize({ width: 390, height: 844 });
      await hidden(false); await page.clock.runFor(5000);
      assert.deepEqual(await snapshot(), held, "rotation still holds after hidden clears");
      await page.setViewportSize({ width: 844, height: 390 });
    } else await hidden(false);
    await page.clock.runFor(1000);
    assert.equal(Number((await snapshot()).count), Number(held.count) - 1, "one second after all pauses clear");
    await page.evaluate(() => { for (let i = 0; i < 40; i++) __go.querySelector('[data-test="continue-next"]').click(); });
    assert.equal((await snapshot()).count, String(Number(held.count) - 1), "subtitle skipping does not advance deadline");
    await page.clock.runFor(17000);
    assert.equal((await snapshot()).phase, "gameover");
    await page.clock.runFor(2000);
    assert.deepEqual((await snapshot()).calls, ["title"]);
    console.log(`PASS ${touch ? "touch" : "PC"}: overlapping pauses and subtitle deadline`);

    // Normal countdown: requested sound boundaries use the same visible clock.
    await mount({ context: { lossOrdinal: 2 } });
    await page.clock.runFor(20000);
    const notes = (await snapshot()).notes;
    const counts = notes.filter(n => n.freq === 1000 || [620, 700, 780, 870, 990, 70].includes(n.freq));
    if (counts.length !== 21) console.error("Observed native oscillator starts:", JSON.stringify(notes));
    assert.deepEqual(counts.map(n => n.count), Array.from({ length: 21 }, (_, i) => String(20 - i)));
    assert.equal(counts.filter(n => n.freq === 1000).length, 15);
    counts.forEach((n, i) => assert(Math.abs(n.at - counts[0].at - i * 1000) < 2, `integer boundary ${i}`));
    await page.clock.runFor(3000);
    assert.deepEqual((await snapshot()).calls, ["title"]);
    console.log(`PASS ${touch ? "touch" : "PC"}: 15+5+1 exact clock boundaries`);

    // Selecting at 19s remaining and just before expiry stops countdown reservations.
    for (const elapsed of [1000, 19950]) {
      await mount({ context: { lossOrdinal: 2 } }); await page.clock.runFor(elapsed);
      await page.evaluate(() => {
        __go.querySelector('[data-test="retry"]').click();
        for (let i = 0; i < 10; i++) __go.querySelector('[data-test="game-over-title"]').click();
      });
      const countNotes = () => page.evaluate(() => __notes.filter(n => n.freq === 1000 || [620, 700, 780, 870, 990, 70].includes(n.freq)).length);
      const before = await countNotes();
      await menu(true);
      const reaction = await snapshot(); await page.clock.runFor(30000);
      assert.deepEqual(await snapshot(), reaction, "reaction also pauses behind MENU");
      await menu(false); await page.clock.runFor(10000);
      assert.equal(await countNotes(), before);
      assert.deepEqual((await snapshot()).calls, ["retry"], "decision callback exactly once");
    }

    // LOAD changes the owner even if the old DOM has not yet been removed.
    await mount(); await page.clock.runFor(500);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const replacement = core.newState();
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(replacement));
      core.load();
    });
    const disposed = await snapshot(); await page.clock.runFor(30000);
    assert.deepEqual(await snapshot(), disposed, "LOAD disposes old owner, clock and audio");
    await mount(); await page.clock.runFor(500);
    await page.evaluate(() => __go.remove());
    await page.clock.runFor(30000);
    assert.deepEqual(await page.evaluate(() => __calls), [], "detached root never calls back");

    const geometry = [];
    for (const [width, height] of (touch ? [[844, 390], [667, 375]] : [[1280, 720], [1920, 1080]])) {
      await page.setViewportSize({ width, height });
      await mount({ context: { lossOrdinal: 2 }, soundEffects: false }); await page.clock.runFor(700);
      await page.locator(".gameover img").evaluateAll(imgs => Promise.all(imgs.map(i => i.decode())));
      const face = await page.evaluate(async () => {
        for (const el of __go.querySelectorAll(".go-left,.go-sumi-img"))
          for (const a of el.getAnimations()) a.finish();
        const { DB, portraitInfo } = await import("./js/core/data.js");
        const info = portraitInfo(__go.dataset.speaker, __go.dataset.emotion);
        const f = DB.manifest.continuePortraits[info.folder][info.face];
        const s = document.querySelector("#stage").getBoundingClientRect(), k = s.width / 1280;
        const r = __go.querySelector(".go-sumi-img").getBoundingClientRect();
        return { size: r.height * f.size / k, x: (r.left + r.width * f.cx - s.left) / k,
          y: (r.top + r.height * (f.top + f.size / 2) - s.top) / k };
      });
      assert(Math.abs(face.size - 524.8) < .1 && Math.abs(face.x - 640) < .1 && Math.abs(face.y - 273) < .1);
      await page.screenshot({ path: path.join(out, `continue-${width}.png`) });
      await page.clock.fastForward(20000);
      assert.equal((await snapshot()).phase, "gameover");
      const logo = await page.evaluate(() => {
        for (const el of __go.querySelectorAll(".go-heading,.go-title"))
          for (const a of el.getAnimations()) a.finish();
        const s = document.querySelector("#stage").getBoundingClientRect(), k = s.width / 1280;
        const r = __go.querySelector(".go-title").getBoundingClientRect();
        return { x: (r.x + r.width / 2 - s.x) / k, y: (r.y + r.height / 2 - s.y) / k,
          hidden: [".go-left", ".go-right"].every(q => getComputedStyle(__go.querySelector(q)).opacity === "0")
            && [...__go.querySelectorAll(".go-clock,.go-count-back,.end-actions")].every(e => e.hidden) };
      });
      assert(Math.abs(logo.x - 640) <= 1 && Math.abs(logo.y - 360) <= 1 && logo.hidden);
      await page.screenshot({ path: path.join(out, `gameover-${width}.png`) });
      await page.clock.runFor(2000);
      assert.deepEqual((await snapshot()).calls, ["title"]);
      geometry.push({ width, height, face, logo });
    }

    // A portrait viewport with the hint actually hidden is not paused (existing layout behavior).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.querySelector("#rotate-hint").style.display = "none");
    await mount({ reducedMotion: true, soundEffects: false });
    await page.clock.runFor(2000);
    assert.equal((await snapshot()).count, "18");
    assert.equal((await snapshot()).paused, "false");
    assert.deepEqual((await snapshot()).notes, [], "soundEffects=false emits no SE");
    await page.screenshot({ path: path.join(out, `${touch ? "touch" : "pc"}.png`) });
    await page.evaluate(() => __go.cleanupContinue());
    assert.deepEqual(errors, []);
    assert.deepEqual([...new Set(missing)], [], "required runtime assets must load");
    results.push({ touch, passed: true, geometry, counts: counts.map(({ freq, at, count }) => ({ freq, at, count })) });
    await context.close();
    console.log(`PASS continue lifecycle: ${touch ? "touch" : "PC"}`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
}
