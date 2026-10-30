// CONTINUE V4: 全18分岐、1行テロップ、20秒の期限、連打・画面離脱・復帰・横持ち。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/continue_screen.mjs
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
await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.abort()); // オフラインでも成立する。
async function mount(variant = 0, options = {}) {
  await page.evaluate(async ({ variant, options }) => {
    const { buildGameOver } = await import("./js/chapters/gameover.js");
    const { showScreen } = await import("./js/core/ui.js");
    window.__decisions = [];
    window.__continue = buildGameOver({ reason: "burnt", variant, ...options,
      onRetry: () => window.__decisions.push("retry"), onTitle: () => window.__decisions.push("quit") });
    showScreen("end", window.__continue);
  }, { variant, options });
  await page.clock.runFor(50);
}
async function geometry() {
  const boxes = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { layout: document.querySelector(".gameover").dataset.layout,
      stage: rect("#stage"), title: rect(".go-heading"), label: rect(document.querySelector('.gameover').dataset.layout === 'neon' ? '.go-neon-title' : '.go-title-label'), face: rect(".go-left"), caption: rect(".go-speech-text"), playback: rect(".go-playback"),
      retry: rect('[data-test="retry"]'), quit: rect('[data-test="game-over-title"]'), count: rect(".go-count") };
  });
  assert(boxes.caption.bottom <= boxes.playback.top + 1, `caption overlaps controls: ${JSON.stringify(boxes)}`);
  // テロップは1行が限界（2026-10-10 オーナー指定）。
  assert(boxes.caption.height / boxes.stage.height * 720 < 72, `caption must stay on one line: ${JSON.stringify(boxes.caption)}`);
  const scale = boxes.stage.height / 720;
  assert(boxes.face.bottom <= boxes.stage.bottom + 1, "portrait must extend to the bottom");
  if (boxes.layout === "neon") {
    assert(boxes.count.left >= boxes.label.right - 2 * scale, "neon title and HUD need separate spaces");
    assert(boxes.count.left > boxes.face.left + boxes.face.width * .7, "HUD must stay to the right of the face");
  } else {
    assert(boxes.title.bottom <= boxes.face.top + 1, "legacy portrait fits below heading");
    assert(boxes.count.left >= boxes.label.right + 8 * scale
      && Math.abs((boxes.count.top + boxes.count.bottom - boxes.label.top - boxes.label.bottom) / 2) <= 4 * scale,
      "legacy count must sit beside the heading without overlap");
  }
  if (["top", "back-count"].includes(boxes.layout)) {
    assert(boxes.retry.left >= boxes.count.right + 8 * scale && boxes.quit.left >= boxes.retry.right + 8 * scale,
      "heading, count, retry and quit must have separate spaces");
    assert(boxes.retry.bottom <= boxes.face.top && boxes.quit.bottom <= boxes.face.top,
      "experimental choices must stay above the portrait and leave the footer to captions");
  } else for (const key of ["retry", "quit"]) {
      assert(boxes.caption.bottom + 8 * scale <= boxes[key].top,
        `caption overlaps or crowds ${key}: ${JSON.stringify(boxes)}`);
      assert(boxes.stage.bottom - boxes[key].bottom >= 20 * scale, `${key} needs bottom breathing room`);
    }
  for (const key of ["face", "caption"]) {
    assert(Math.abs((boxes[key].left + boxes[key].right) / 2 - (boxes.stage.left + boxes.stage.right) / 2) <= 1,
      `${key} must be centered`);
  }
  for (const key of ["caption", "retry", "quit", "count"]) {
    const b = boxes[key], s = boxes.stage;
    assert(b.left >= s.left - 1 && b.right <= s.right + 1 && b.bottom <= s.bottom + 1, `${key} exceeds stage`);
  }
}
try {
  await page.goto(base);
  await page.waitForSelector('[data-test="title-new"]');
  await page.mouse.click(4, 4);
  await page.evaluate(async () => {
    const { config } = await import("./js/core/state.js");
    config.bgmVolume = config.seVolume = 0;
    (await import("./js/core/audio.js")).applyVolumes();
  });
  await page.clock.install({ time: new Date("2026-10-11T09:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-11T09:00:01Z"));
  // 全台本・全反応の1行が、全角22字以内に収まる。
  const tooLong = await page.evaluate(async () => {
    const { SUMI_CONTINUE_SCRIPTS } = await import("./js/chapters/gameover.js");
    const { PREMIUM_CONTINUE_SCRIPTS } = await import("./js/chapters/continue-premium.js");
    const width = t => [...t].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? .5 : 1), 0);
    return [...SUMI_CONTINUE_SCRIPTS, ...Object.values(PREMIUM_CONTINUE_SCRIPTS)].flatMap(s =>
      [...s.cues.map(c => c.text), ...s.reactions.retry.text, ...s.reactions.quit.text]).filter(t => width(t) > 22);
  });
  assert.deepEqual(tooLong, []);
  await mount(2);
  await page.locator(".go-choice-frame").evaluateAll(images => Promise.all(images.map(image => image.decode())));
  assert(await page.locator(".go-choice").evaluateAll(buttons => buttons.every(button => {
    const frame = button.querySelector(".go-choice-frame");
    if (frame) return frame.complete && frame.naturalWidth > 0 && !!button.querySelector(".go-choice-label").textContent;
    const style = getComputedStyle(button);
    return style.backgroundColor !== "rgba(0, 0, 0, 0)" && parseFloat(style.borderTopWidth) > 0;
  })), "choices must have visible button surfaces");
  const art = await page.locator(".go-title-art,.go-neon-title,.go-approval").evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ width: image.naturalWidth, src: image.src }));
  });
  assert(art.every(image => image.width > 0 && image.src.includes("/ui/continue/")), "generated art must load");
  const panels = await page.evaluate(async () => {
    const urls = [".gameover"].map(selector =>
      getComputedStyle(document.querySelector(selector)).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1]);
    await Promise.all(urls.map(async url => {
      if (!url) throw new Error("Generated background missing");
      const image = new Image(); image.src = url; await image.decode();
    }));
    return urls;
  });
  assert(panels.every(url => url.includes("/ui/continue/")), "generated backdrop must resolve from both pages");
  await page.locator('[data-test="retry"]').click();
  assert(await page.locator(".go-approval").isVisible(), "generated approval stamp appears on meeting retry");
  console.log("PASS: GAME OVER / approval assets load; stamp appears");
  const variants = [0, 1, 2, ...["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan"].map(id => `premium:${id}`)];
  for (const variant of variants) {
    for (const choice of ["retry", "quit"]) {
      await mount(variant);
      // 最後のキューまで1行に収まり、正規画像が読み込める。時計は実時間でも進むため回数でなく終端まで送る。
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        await page.evaluate(() => {
          const caption = document.querySelector('[data-test="continue-caption"]');
          if (!caption.disabled && document.querySelector(".go-letter:not(.go-on)")) caption.click();
        });
        seen.add(await page.locator(".gameover").getAttribute("data-cue"));
        await geometry();
        const info = await page.locator(".go-sumi-img").evaluate(async image => {
          // 表情の切替で decode 中に src が変わることがあるため、読み込み完了も待つ。
          for (let n = 0; n < 3; n++) { try { await image.decode(); break; } catch { await new Promise(r => setTimeout(r, 30)); } }
          return { complete: image.complete, width: image.naturalWidth, src: image.src };
        });
        assert(info.complete && info.width > 0, info.src);
        if (await page.locator('[data-test="continue-next"]').isDisabled()) break;
        await page.evaluate(() => document.querySelector('[data-test="continue-next"]').click());
      }
      assert.equal(await page.locator(".gameover").getAttribute("data-last-cue"), "true", "reached the final cue");
      assert.equal(seen.size, 7, `all seven cues were displayed: ${[...seen]}`);
      await page.locator(`[data-test="${choice === "retry" ? "retry" : "game-over-title"}"]`).click();
      assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
      const expected = await page.evaluate(async ({ variant, choice }) => {
        const { SUMI_CONTINUE_SCRIPTS } = await import("./js/chapters/gameover.js");
        const { PREMIUM_CONTINUE_SCRIPTS } = await import("./js/chapters/continue-premium.js");
        const script = typeof variant === "number" ? SUMI_CONTINUE_SCRIPTS[variant] : PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)];
        return script.reactions[choice];
      }, { variant, choice });
      assert.equal(await page.locator(".go-a11y[aria-live]:not(.go-time-announcement)").textContent(), expected.text.join(""));
      assert.equal(await page.locator(".go-speech-text").textContent(), expected.text[0], "reaction starts with its first line");
      assert.deepEqual(await page.evaluate(() => window.__decisions), [], "reaction must precede navigation");
      await geometry();
      await page.evaluate(() => { for (let i = 0; i < 15; i++) {
        document.querySelector('[data-test="retry"]').click();
        document.querySelector('[data-test="game-over-title"]').click();
        document.querySelector('[data-test="continue-proceed"]').click();
      } });
      assert.deepEqual(await page.evaluate(() => window.__decisions), [], "instant repeated taps must not erase reaction");
      if (expected.text.length > 1) {
        await page.clock.runFor(2200);
        assert.equal(await page.locator(".go-speech-text").textContent(), expected.text[1], "reaction lines advance one at a time");
      }
      await page.clock.runFor(8000);
      assert.deepEqual(await page.evaluate(() => window.__decisions), [choice]);
      await page.clock.runFor(500);
      assert.deepEqual(await page.evaluate(() => window.__decisions), [choice], "only one callback");
      console.log(`PASS: ${variant} / ${choice}, captions, canon portraits, single navigation`);
    }
  }
  // 初回はカウント後も選べる。再挑戦以降の20秒期限は維持する。
  await mount(0, { context: { lossOrdinal: 1 } });
  await page.clock.runFor(22000);
  assert.equal(await page.locator(".go-count").textContent(), "∞");
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "speaking");
  assert(await page.locator('[data-test="retry"]').isEnabled());
  await page.locator('[data-test="retry"]').click();
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
  await mount(0, { context: { lossOrdinal: 2 } });
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) document.querySelector('[data-test="continue-caption"]').click();
  });
  assert.equal(await page.locator(".go-count").textContent(), "20");
  await page.clock.runFor(19100); // 表示は70ms刻みで更新されるため、境目から少し離して読む。
  assert.equal(await page.locator(".go-count").textContent(), "1");
  assert(await page.locator('[data-test="retry"]').isEnabled());
  await page.clock.runFor(900);
  assert.equal(await page.locator(".go-count").textContent(), "0");
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "gameover");
  assert.equal(await page.locator(".go-title").textContent(), "GAME OVER");
  assert.deepEqual(await page.evaluate(() => window.__decisions), []);
  assert(await page.locator('[data-test="retry"]').isDisabled());
  assert(await page.locator('[data-test="game-over-title"]').isDisabled());
  assert(await page.locator(".go-count").isHidden(), "GAME OVER must hide the count");
  assert(await page.locator(".go-title-art").isVisible(), "GAME OVER logo remains visible");
  await page.evaluate(() => {
    document.querySelector('[data-test="retry"]').click();
    document.querySelector('[data-test="game-over-title"]').click();
  });
  await page.clock.runFor(1900);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"]);
  await page.clock.runFor(5000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"], "timeout navigates only once");
  console.log("PASS: captions do not shorten the deadline; 20 → 0 → GAME OVER → title once");

  await mount(0);
  await page.clock.runFor(19900);
  // 期限境界は同じ時計で即時に入力。UI安定待ちによる期限越えを混ぜない（実クリックは全18分岐で確認）。
  await page.evaluate(() => document.querySelector('[data-test="retry"]').click());
  await page.clock.runFor(200);
  assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
  assert.equal(await page.locator(".gameover").getAttribute("data-timed-out"), null);
  await page.clock.runFor(8000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["retry"]);
  console.log("PASS: continue just before zero cancels the deadline and returns to tournament");

  await mount(0);
  await page.locator('[data-test="game-over-title"]').click();
  for (let i = 0; i < 7; i++) {
    await page.clock.runFor(500);
    await page.evaluate(() => document.querySelector('[data-test="continue-proceed"]').click());
  }
  await page.clock.runFor(300);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"]);
  console.log("PASS: voluntary quit reaction can be advanced");

  // 途中選択と直後の画面離脱は、遅延callbackを破棄する。
  await mount(1);
  await page.locator('[data-test="retry"]').click();
  await page.evaluate(() => document.querySelector("#screen").replaceChildren());
  await page.clock.runFor(5000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), []);
  console.log("PASS: removed screen cancels timers and navigation");
  await mount(0, { context: { lossOrdinal: 2 } });
  await page.clock.runFor(20000);
  await page.evaluate(() => document.querySelector("#screen").replaceChildren());
  await page.clock.runFor(5000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), [], "removed GAME OVER cancels title callback");

  await mount(0);
  await page.clock.runFor(2500); // 秒の境目を避けて読む。
  const before = await page.locator(".go-count").textContent();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(25000);
  assert.equal(await page.locator(".go-count").textContent(), before);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(1100);
  assert.equal(Number(await page.locator(".go-count").textContent()), Number(before) - 1);
  console.log("PASS: background pauses timeline, resuming continues without missed-count bursts");

  // スマホ横持ちでも実画面の全字幕と2択が収まる。軽減モードでは静止。
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const variant of variants) {
    await mount(variant, { soundEffects: false });
    assert.equal(await page.locator(".gameover").getAttribute("data-reduced-motion"), "true");
    for (let i = 0; i < 20 && await page.locator('[data-test="continue-next"]').isEnabled(); i++) {
      await geometry(); await page.locator('[data-test="continue-next"]').click();
    }
    await geometry();
    const animated = await page.locator(".gameover").evaluate(root => root.getAnimations({ subtree: true }).length);
    assert.equal(animated, 0);
    await page.locator('[data-test="game-over-title"]').click();
    await geometry();
  }
  console.log("PASS: all 9 scripts in phone landscape, reduced motion, muted controls");
  // 実験版は同じボタン処理を使う。全台本の大きい1行と、上部の2択をPC／横持ちで検証。
  for (const layout of ["top", "back-count"]) for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const [index, variant] of variants.entries()) {
      await mount(variant, { layout, background: layout === "back-count" ? "stage" : "purple", soundEffects: false });
      assert.equal(await page.locator('[data-test="retry"]').textContent(), "する");
      for (let n = 0; n < 40; n++) {
        await page.evaluate(() => {
          if (document.querySelector(".go-letter:not(.go-on)")) document.querySelector(".go-dialogue").click();
        });
        await geometry();
        if (await page.locator('[data-test="continue-next"]').isDisabled()) break;
        await page.locator(".go-dialogue").click();
      }
      assert.equal(await page.locator(".gameover").getAttribute("data-last-cue"), "true");
      const choice = index % 2 ? "quit" : "retry";
      await page.locator(`[data-test="${choice === "retry" ? "retry" : "game-over-title"}"]`).click();
      await geometry();
      await page.clock.runFor(8000);
      assert.deepEqual(await page.evaluate(() => window.__decisions), [choice]);
    }
    await mount(0, { layout, soundEffects: false, context: { lossOrdinal: 2 } });
    await page.clock.runFor(20100);
    assert(await page.locator(".go-count").isHidden());
    assert(await page.locator('[data-test="retry"]').isHidden());
    assert(await page.locator('[data-test="game-over-title"]').isHidden());
    assert(await page.locator(".go-title-art").isVisible());
    if (layout === "back-count") assert(await page.locator(".go-count-back").isHidden());
    await page.clock.runFor(2000);
    assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"]);
  }
  console.log("PASS: both top-button experiments, all 9 scripts on PC / phone; GAME OVER hides every count and choices");
  // 拡大は台詞送りから独立し、タブ休止・動き軽減を尊重する。
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mount(0, { layout: "back-count", background: "stage", soundEffects: false, context: { lossOrdinal: 2 } });
  await page.evaluate(async () => {
    const url = getComputedStyle(document.querySelector(".gameover")).backgroundImage.match(/url\("?([^"\)]+)"?\)/)?.[1];
    if (!url?.includes("backdrop_stage")) throw new Error("Stage backdrop missing");
    const image = new Image(); image.src = url; await image.decode();
  });
  const echo = async () => page.locator(".go-count-echo").evaluate(el => ({
    text: el.textContent, height: el.getBoundingClientRect().height,
    scale: el.closest(".gameover").style.getPropertyValue("--go-count-scale"),
    opacity: Number(getComputedStyle(el).opacity), transform: getComputedStyle(el).transform,
    behind: Number(getComputedStyle(el.parentElement).zIndex) < Number(getComputedStyle(document.querySelector(".go-left")).zIndex),
    inert: getComputedStyle(el.parentElement).pointerEvents === "none"
  }));
  const first = await echo();
  assert.equal(first.text, "20");
  assert(first.behind && first.inert && first.opacity > 0 && first.opacity <= .16, "count must be faint and behind the portrait");
  await page.clock.runFor(5200);
  const fifteen = await echo();
  assert.equal(fifteen.text, "15");
  assert(fifteen.height > first.height + 50, "back count must grow as time passes");
  const advance = await page.evaluate(() => {
    const root = document.querySelector(".gameover"), before = performance.now();
    const scale = Number(root.style.getPropertyValue("--go-count-scale"));
    for (let n = 0; n < 40; n++) document.querySelector(".go-dialogue").click();
    return { elapsed: performance.now() - before, scale, after: Number(root.style.getPropertyValue("--go-count-scale")) };
  });
  assert(Math.abs(advance.after - advance.scale) <= (advance.elapsed + 70) / 20000 * .9 + .00001,
    "caption advance must not jump beyond real elapsed time");
  const pausedScale = await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    return document.querySelector(".gameover").style.getPropertyValue("--go-count-scale");
  });
  await page.clock.runFor(5000);
  assert.equal((await echo()).scale, pausedScale, "hidden tab must pause back-count growth");
  assert.equal((await echo()).text, "15");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(10000);
  const five = await echo();
  assert.equal(five.text, "5");
  assert(five.height > fifteen.height + 100);
  await page.clock.runFor(4000);
  const one = await echo();
  assert.equal(one.text, "1");
  assert(one.height > five.height + 50);
  await page.clock.runFor(1100);
  assert(await page.locator(".go-count-back,.go-clock").evaluateAll(els => els.every(el => el.hidden)));
  assert(await page.locator(".go-title-art").isVisible());
  await page.clock.runFor(2000);
  assert.deepEqual(await page.evaluate(() => window.__decisions), ["quit"]);
  await mount(0, { layout: "back-count", background: "purple", reducedMotion: true, soundEffects: false });
  const still = await echo();
  await page.clock.runFor(5200);
  assert.equal((await echo()).height, still.height, "reduced motion must keep back-count size fixed");
  assert.equal((await echo()).transform, "none");
  assert.equal((await echo()).text, "15");
  assert.equal(await page.locator(".gameover").getAttribute("data-background"), "purple");
  console.log("PASS: faint growing back count, stage backdrop, independent captions, hidden-tab pause, reduced motion and zero removal");
  await page.close();

  // プレビューは両分岐を見せ、セーブと恋人抽選履歴を変えない。
  const preview = await browser.newPage({ viewport: { width: 844, height: 390 } });
  preview.on("pageerror", e => errors.push(e.message));
  await preview.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.abort());
  await preview.goto(new URL("continue-preview.html", base).href);
  await preview.waitForFunction(() => !document.querySelector("#preview-play").disabled);
  await preview.evaluate(() => localStorage.setItem("suien_remake_save", "preview-sentinel"));
  await preview.locator("#preview-bgm").uncheck();
  await preview.locator("#preview-se").uncheck();
  await preview.locator("#preview-play").click();
  await preview.clock.install();
  await preview.locator("#preview-retry").click();
  await preview.clock.runFor(8000);
  assert.equal(await preview.locator(".gameover").getAttribute("data-phase"), "preview-ended");
  assert.match(await preview.locator("#preview-error").textContent(), /大会の最初/);
  await preview.locator("#preview-play").click();
  await preview.locator("#preview-quit").click();
  await preview.clock.runFor(8000);
  assert.match(await preview.locator("#preview-error").textContent(), /タイトル/);
  await preview.locator("#loss").fill("2");
  await preview.locator("#preview-play").click();
  await preview.clock.runFor(22000);
  assert.match(await preview.locator("#preview-error").textContent(), /20秒でGAME OVER/);
  await preview.locator("#preview-layout").selectOption("top");
  assert.equal(await preview.locator(".gameover").getAttribute("data-layout"), "top");
  await preview.locator("#preview-retry").click();
  await preview.clock.runFor(8000);
  assert.match(await preview.locator("#preview-error").textContent(), /大会の最初/);
  await preview.locator("#preview-layout").selectOption("bottom");
  assert.equal(await preview.locator(".gameover").getAttribute("data-layout"), "bottom");
  await preview.locator("#preview-layout").selectOption("back-count");
  await preview.locator("#preview-background").selectOption("stage");
  assert.equal(await preview.locator(".gameover").getAttribute("data-layout"), "back-count");
  assert.equal(await preview.locator(".gameover").getAttribute("data-background"), "stage");
  await preview.locator("#preview-quit").click();
  await preview.clock.runFor(8000);
  assert.match(await preview.locator("#preview-error").textContent(), /タイトル/);
  await preview.locator("#preview-background").selectOption("purple");
  assert.equal(await preview.locator(".gameover").getAttribute("data-background"), "purple");
  assert.equal(await preview.evaluate(() => localStorage.getItem("suien_remake_save")), "preview-sentinel");
  await preview.close();
  assert.deepEqual(missing, [], "all canon portraits must resolve");
  assert.deepEqual(errors, []);
  console.log("PASS: preview branches do not touch saves; page errors / missing portraits 0");
} finally { await browser.close(); }
