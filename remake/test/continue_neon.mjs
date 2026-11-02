// 参照UI専用: 1080p/720p/スマホ、顔の保護、実時計HUD、軽減・停止・キーボード。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/continue_neon.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [], missing = [];
page.on("pageerror", e => errors.push(e.message));
page.on("response", r => { if (r.status() >= 400 && /\.(webp|png|woff2|css|js)/.test(r.url())) missing.push(r.url()); });
await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", r => r.abort());
async function mount(options = {}) {
  await page.evaluate(async options => {
    const { buildGameOver } = await import("./js/chapters/gameover.js");
    const { showScreen } = await import("./js/core/ui.js");
    window.__decisions = [];
    showScreen("end", buildGameOver({ variant: "premium:ageha", soundEffects: false, ...options,
      onRetry: () => window.__decisions.push("retry"), onTitle: () => window.__decisions.push("title") }));
  }, options);
  await page.clock.runFor(50);
  await page.locator(".gameover img").evaluateAll(imgs => Promise.all(imgs.map(i => i.decode())));
}
async function reading() {
  return page.evaluate(() => {
    const root = document.querySelector(".gameover"), ring = root.querySelector(".go-ring-progress"), echo = root.querySelector(".go-count-echo");
    return { count: root.querySelector(".go-count").textContent, echo: echo.textContent,
      scale: root.style.getPropertyValue("--go-count-scale"), echoHeight: echo.getBoundingClientRect().height,
      progress: Number(ring.getAttribute("stroke-dashoffset")) / Number(ring.getAttribute("stroke-dasharray")),
      urgent: root.classList.contains("go-urgent"), hidden: document.hidden };
  });
}
try {
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const { config } = await import("./js/core/state.js"); config.bgmVolume = config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes(); await document.fonts.ready;
  });
  await page.clock.install({ time: new Date("2026-10-11T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-11T09:00:01Z"));
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await mount();
    assert.equal(await page.locator(".gameover").getAttribute("data-layout"), "neon");
    assert.equal(await page.locator(".gameover").getAttribute("data-background"), "stage");
    assert.equal(await page.locator(".go-title").getAttribute("aria-label"), "コンティニューする？");
    assert.equal(await page.locator(".go-retry").textContent(), "最初から再挑戦");
    assert.equal(await page.locator(".go-quit").textContent(), "諦める");
    const safe = await page.evaluate(async () => {
      const root = document.querySelector(".gameover"), stage = document.querySelector("#stage").getBoundingClientRect();
      const k = stage.width / 1280, image = root.querySelector(".go-sumi-img");
      for (const animation of image.getAnimations()) animation.finish();
      const { DB, portraitInfo } = await import("./js/core/data.js");
      const info = portraitInfo(root.dataset.speaker, root.dataset.emotion);
      const framing = DB.manifest.continuePortraits[info.folder][info.face], r = image.getBoundingClientRect();
      const size = r.height / k * framing.size;
      const cx = (r.left - stage.left + r.width * framing.cx) / k;
      const cy = (r.top - stage.top + r.height * (framing.top + framing.size / 2)) / k;
      // 採用Cでは帽子/髪と見出しの重なりを許容。実測顔bboxの目〜口を保護する。
      const face = { x: cx - size * .34, y: cy - size * .1, w: size * .68, h: size * .55 };
      const title = root.querySelector(".go-title"), art = root.querySelector(".go-neon-title");
      // 実際の透過筆跡をステージ座標へ描き、中心の顔にタイトルが重ならないことを検査。
      const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext("2d");
      const heading = root.querySelector(".go-heading");
      ctx.translate(heading.offsetLeft + title.offsetLeft + title.offsetWidth / 2,
        heading.offsetTop + title.offsetTop + title.offsetHeight / 2);
      ctx.rotate(-2 * Math.PI / 180);
      ctx.drawImage(art, -title.offsetWidth / 2, -title.offsetHeight / 2, title.offsetWidth, title.offsetHeight);
      const data = ctx.getImageData(face.x, face.y, face.w, face.h).data;
      const hud = root.querySelector(".go-clock").getBoundingClientRect();
      return { size, cx, cy, inkOnFace: Array.from(data).filter((a, i) => i % 4 === 3 && a > 24).length,
        hudOutsideFace: (hud.left - stage.left) / k > face.x + face.w,
        imagesLoaded: [...root.querySelectorAll("img")].every(i => i.complete && i.naturalWidth > 0) };
    });
    assert(Math.abs(safe.size - 524.8) < .1 && Math.abs(safe.cx - 640) < .1 && Math.abs(safe.cy - 273) < .1,
      "adopted C face bbox must keep its size and center");
    assert.equal(safe.inkOnFace, 0, "brush title must not obscure eyes or mouth");
    assert(safe.hudOutsideFace && safe.imagesLoaded);
  }
  console.log("PASS: generated brush title / frames, dynamic labels, face protection and 1080p / 720p / phone");
  // #2190 P24: the first count is an animation, so show that before it reaches infinity.
  await page.setViewportSize({ width: 1180, height: 740 });
  await mount({ variant: 0, context: { lossOrdinal: 1 } });
  const limitNote = page.locator(".go-limit-note");
  assert(await limitNote.isVisible(), "the initial unlimited-time explanation must be visible");
  assert.equal(await limitNote.textContent(), "初回は時間制限なし（カウントは演出です）");
  assert.equal((await reading()).count, "20", "keep the initial countdown animation");
  assert.match(await page.locator(".go-time-announcement").textContent(), /初回は時間制限がありません/);
  const noteLayout = await limitNote.evaluate(note => {
    const box = note.getBoundingClientRect(), stage = document.querySelector("#stage").getBoundingClientRect();
    const separate = other => { const r = other.getBoundingClientRect(); return box.right <= r.left || box.left >= r.right || box.bottom <= r.top || box.top >= r.bottom; };
    return { inside: box.left >= stage.left && box.right <= stage.right && box.top >= stage.top && box.bottom <= stage.bottom,
      separate: [...document.querySelectorAll(".go-clock,.go-dialogue,.end-actions")].every(separate),
      readable: parseFloat(getComputedStyle(note).fontSize) * stage.width / 1280 >= 16 };
  });
  assert(noteLayout.inside && noteLayout.separate && noteLayout.readable, JSON.stringify(noteLayout));
  await page.clock.runFor(21000);
  assert.equal((await reading()).count, "∞");
  assert(await limitNote.isVisible(), "the explanation remains visible after the animated count");
  assert.deepEqual(await page.evaluate(() => __decisions), [], "the first count must not choose automatically");
  await mount({ variant: 0, context: { lossOrdinal: 2 } });
  assert(await limitNote.isHidden(), "repeat losses must not show the unlimited-time explanation");
  assert.match(await page.locator(".go-time-announcement").textContent(), /20秒以内に選択/);
  console.log("PASS: first-loss unlimited-time note before/after animation, clear of controls at 1180×740; repeat-loss deadline announcement preserved");
  // #590: measure the actual scaled target, feedback handoff, guard and both callbacks.
  const saved = await page.evaluate(async () => JSON.stringify({ state: (await import("./js/core/state.js")).state, storage: { ...localStorage } }));
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const reducedMotion of [false, true]) for (const choice of ["retry", "quit"]) {
      await mount({ variant: 0, reducedMotion });
      await page.evaluate(choice => document.querySelector(`.go-${choice}`).click(), choice);
      await page.clock.runFor(100);
      assert(await page.locator(".go-proceed").isHidden(), "keep the selected choice visible for 180ms");
      assert(await page.locator(".end-actions").isVisible());
      await page.clock.runFor(100);
      assert(await page.locator(".end-actions").isHidden());
      assert(await page.locator(".go-proceed").isVisible());
      const target = await page.locator(".go-proceed").evaluate(button => {
        const r = button.getBoundingClientRect(), stage = document.querySelector("#stage").getBoundingClientRect();
        const dialogue = document.querySelector(".go-dialogue").getBoundingClientRect();
        return { width: r.width, height: r.height, centered: Math.abs(r.x + r.width / 2 - (stage.x + stage.width / 2)) < 1,
          inside: r.left >= stage.left && r.right <= stage.right && r.top >= stage.top && r.bottom <= stage.bottom + .1,
          separate: r.top >= dialogue.bottom, focused: document.activeElement === button };
      });
      assert(target.width >= 44 && target.height >= 44, `scaled target >=44 CSS px: ${JSON.stringify(target)}`);
      assert(target.centered && target.inside && target.separate && target.focused, JSON.stringify(target));
      assert.equal(await page.locator(".go-clock").evaluate(n => getComputedStyle(n).visibility), "hidden");
      const firstLine = await page.locator(".go-speech-text").textContent();
      await page.clock.runFor(200);
      await page.evaluate(() => { for (let i = 0; i < 10; i++) document.querySelector(".go-proceed").click(); });
      assert.equal(await page.locator(".go-speech-text").textContent(), firstLine, "450ms reaction guard survives handoff");
      assert.deepEqual(await page.evaluate(() => __decisions), []);
      await page.clock.runFor(100);
      const revealed = await page.locator(".go-letter").evaluateAll(letters => letters.every(n => n.classList.contains("go-on")));
      if (!revealed) await page.evaluate(() => document.querySelector(".go-proceed").click()); // reveal all before advancing
      assert(await page.locator(".go-letter").evaluateAll(letters => letters.every(n => n.classList.contains("go-on"))));
      if (process.env.SHOTS && choice === "retry" && !reducedMotion) {
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        await page.screenshot({ path: `${process.env.SHOTS}/proceed-${viewport.width}.png` });
      }
      await page.evaluate(() => document.querySelector(".go-proceed").click());
      assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "leaving", "next press leaves after the full reaction");
      await page.clock.runFor(9000);
      assert.deepEqual(await page.evaluate(() => __decisions), [choice === "retry" ? "retry" : "title"]);
      await page.clock.runFor(9000);
      assert.deepEqual(await page.evaluate(() => __decisions), [choice === "retry" ? "retry" : "title"], "callback fires once");
    }
  }
  assert.equal(await page.evaluate(async () => JSON.stringify({ state: (await import("./js/core/state.js")).state, storage: { ...localStorage } })), saved);
  console.log("PASS: centered proceed >=44 CSS px at 1280/844/667/390 widths; 180ms feedback, 450ms guard, both branches, normal/reduced, save unchanged");
  await page.setViewportSize({ width: 1280, height: 720 }); await mount({ context: { lossOrdinal: 2 } });
  const initial = await reading(); assert.equal(initial.count, "20"); assert.equal(initial.echo, "20");
  await page.clock.runFor(5200);
  const fifteen = await reading(); assert.equal(fifteen.count, "15"); assert.equal(fifteen.echo, "15");
  assert(fifteen.progress > .25 && fifteen.progress < .27, "HUD arc follows the real deadline");
  assert(fifteen.echoHeight > initial.echoHeight);
  const advance = await page.evaluate(() => {
    const root = document.querySelector(".gameover"), ring = root.querySelector(".go-ring-progress");
    const start = performance.now(), scale = Number(root.style.getPropertyValue("--go-count-scale")), arc = Number(ring.getAttribute("stroke-dashoffset"));
    for (let i = 0; i < 30; i++) root.querySelector(".go-dialogue").click();
    return { ms: performance.now() - start, scale: Number(root.style.getPropertyValue("--go-count-scale")) - scale,
      progress: (Number(ring.getAttribute("stroke-dashoffset")) - arc) / Number(ring.getAttribute("stroke-dasharray")) };
  });
  assert(advance.scale <= (advance.ms + 70) / 20000 * 1.05 + .00001, "captions cannot accelerate backdrop beyond real elapsed time");
  assert(advance.progress <= (advance.ms + 70) / 20000 + .00001, "captions cannot accelerate HUD beyond real elapsed time");
  assert.equal((await reading()).count, "15");
  const hover = await page.locator(".go-retry").evaluate(button => {
    button.focus(); return { shine: getComputedStyle(button, "::after").opacity, outline: getComputedStyle(button).outlineStyle };
  });
  assert.equal(hover.outline, "solid", "keyboard selection has a visible outline");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.locator(".go-smoke-left").evaluate(el => getComputedStyle(el).animationPlayState), "paused");
  const { echoHeight: pausedHeight, ...paused } = await reading(); await page.clock.runFor(12000);
  const { echoHeight: resumedHeight, ...pausedAfter } = await reading(); assert.deepEqual(pausedAfter, paused);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(10000); const five = await reading();
  assert.equal(five.count, "5"); assert.equal(five.echo, "5"); assert(five.urgent && five.progress > .75);
  assert(five.echoHeight > fifteen.echoHeight);
  await page.clock.runFor(5000);
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "gameover");
  assert(await page.locator(".go-clock,.go-count-back,.end-actions").evaluateAll(els => els.every(el => el.hidden)));
  assert.match(await page.locator(".go-title-art").getAttribute("src"), /neon_game_over/);
  assert(await page.locator(".go-title-art").isVisible()); assert(await page.locator(".go-neon-title").isHidden());
  assert.deepEqual(await page.evaluate(() => window.__decisions), []);
  await page.clock.runFor(2000); assert.deepEqual(await page.evaluate(() => window.__decisions), ["title"]);
  await page.clock.runFor(2000); assert.deepEqual(await page.evaluate(() => window.__decisions), ["title"]);
  console.log("PASS: real HUD / growing count, independent caption clicks, hidden-tab pause, final 5 seconds and simple GAME OVER → title once");
  await mount({ reducedMotion: true }); const still = await reading(); await page.clock.runFor(5200);
  assert.equal((await reading()).echoHeight, still.echoHeight);
  assert.equal(await page.locator(".go-smoke-left").evaluate(el => getComputedStyle(el).animationName), "none");
  await page.locator(".go-retry").focus(); await page.keyboard.press("Enter");
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
  await page.clock.runFor(8000); assert.deepEqual(await page.evaluate(() => window.__decisions), ["retry"]);
  await page.emulateMedia({ reducedMotion: "reduce" }); await mount();
  assert.equal(await page.locator(".gameover").getAttribute("data-reduced-motion"), "true");
  assert.equal(await page.locator(".go-smoke-left").evaluate(el => getComputedStyle(el).animationName), "none");
  // 最新mainの幕待ちのように、生成後すぐDOMへ付かない場合も表示後に時計を始める。
  await page.evaluate(async () => {
    const { buildGameOver } = await import("./js/chapters/gameover.js");
    const { showScreen } = await import("./js/core/ui.js");
    const root = buildGameOver({ variant: 0, soundEffects: false }); root.id = "continue-delayed";
    window.setTimeout(() => showScreen("end", root), 500);
  });
  await page.clock.runFor(700);
  assert(await page.locator("#continue-delayed").isVisible());
  await page.clock.runFor(5200);
  assert.equal(await page.locator("#continue-delayed .go-count").textContent(), "15", "a deferred mount must start its visible countdown");
  // #590: actual contextual captions and shortened scripts keep the independent 20-second deadline.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const reason of ["burnt", "cold", "leaf", "rank"]) for (const lossOrdinal of [1, 2, 3]) {
    await mount({ variant: 0, context: { reason, rank: 3, parts: { heat: 42, holes: 60 }, completedParts: ["holes", "heat"], lossOrdinal, sameReasonOrdinal: lossOrdinal } });
    const first = await page.locator(".go-speech-text").textContent();
    assert.match(first, new RegExp({ burnt: "熱", cold: "冷え", leaf: "香り", rank: "3位" }[reason]));
    const script = await page.evaluate(async context => {
      const { prepareContinueScript, normalizeContinueContext } = await import("./js/chapters/continue-context.js");
      const { SUMI_CONTINUE_SCRIPTS } = await import("./js/chapters/gameover.js");
      return prepareContinueScript(SUMI_CONTINUE_SCRIPTS[0], normalizeContinueContext(context));
    }, { reason, rank: 3, parts: { heat: 42, holes: 60 }, completedParts: ["holes", "heat"], lossOrdinal, sameReasonOrdinal: lossOrdinal });
    await page.clock.runFor(2500);
    assert.equal(await page.locator(".go-speech-text").textContent(), script.cues[1].text);
    assert.notEqual(await page.locator(".gameover").getAttribute("data-quiet"), "true", "the opening keeps its normal sound level");
    await page.clock.runFor(14500);
    assert.equal(await page.locator(".gameover").getAttribute("data-quiet"), "true", "first and shortened repeat scripts both enter the quiet second half");
    assert.equal(await page.locator(".go-speech-text").textContent(), script.cues.at(-1).text);
    assert.equal((await reading()).count, "3");
    assert.deepEqual(await page.evaluate(() => __decisions), []);
    await page.clock.runFor(3000);
    assert.equal(await page.locator(".gameover").getAttribute("data-phase"), lossOrdinal === 1 ? "speaking" : "gameover");
    if (lossOrdinal === 1) assert.equal((await reading()).count, "∞");
  }
  // Measure every visible input after stage scaling, including the portrait-sized DS stage.
  for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await mount({ variant: 0, reducedMotion: true });
    const targets = await page.locator(".go-retry,.go-quit,.go-next,.go-dialogue").evaluateAll(nodes => nodes.map(n => {
      const r = n.getBoundingClientRect();
      return { name: n.className, x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    }));
    for (const r of targets) assert(r.w >= 44 && r.h >= 44 && r.x >= 0 && r.y >= 0 && r.right <= viewport.width && r.bottom <= viewport.height, JSON.stringify(r));
  }
  console.log("PASS: four reasons x first/repeat/third loss, real advice, 7/4 cues with 20 seconds, all scaled inputs >=44px");
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  console.log("PASS: reduced motion by option / OS, keyboard retry and deferred mounting; page errors / missing art 0");
} finally { await browser.close(); }
