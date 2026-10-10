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
await page.route("https://bgmer.net/**", route => route.abort()); // オフラインでも成立する。
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
    return { stage: rect("#stage"), title: rect(".go-heading"), face: rect(".go-left"), caption: rect(".go-speech-text"), playback: rect(".go-playback"),
      retry: rect('[data-test="retry"]'), quit: rect('[data-test="game-over-title"]'), count: rect(".go-count") };
  });
  assert(boxes.caption.bottom <= boxes.playback.top + 1, `caption overlaps controls: ${JSON.stringify(boxes)}`);
  // テロップは1行が限界（2026-10-10 オーナー指定）。
  assert(boxes.caption.height / boxes.stage.height * 720 < 72, `caption must stay on one line: ${JSON.stringify(boxes.caption)}`);
  assert(boxes.title.bottom <= boxes.face.top + 1 && boxes.face.bottom <= boxes.caption.top + 1
    && boxes.caption.bottom <= boxes.retry.top + 1, "title → face → caption → choices must remain in separate rows");
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
  await page.clock.install();
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
  assert.equal(await page.locator(".go-choice").evaluateAll(buttons =>
    buttons.filter(b => getComputedStyle(b).backgroundImage !== "none").length), 0, "choices are text only");
  const art = await page.locator(".go-title-art,.go-approval").evaluateAll(async images => {
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
  const variants = [0, 1, 2, ...["tsumugi", "minto", "rin", "ageha", "mashiro", "kafuka"].map(id => `premium:${id}`)];
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
      assert(seen.size >= 8, `most one-line cues were displayed: ${[...seen]}`);
      await page.locator(`[data-test="${choice === "retry" ? "retry" : "game-over-title"}"]`).click();
      assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
      const expected = await page.evaluate(async ({ variant, choice }) => {
        const { SUMI_CONTINUE_SCRIPTS } = await import("./js/chapters/gameover.js");
        const { PREMIUM_CONTINUE_SCRIPTS } = await import("./js/chapters/continue-premium.js");
        const script = typeof variant === "number" ? SUMI_CONTINUE_SCRIPTS[variant] : PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)];
        return script.reactions[choice];
      }, { variant, choice });
      assert.equal(await page.locator(".go-a11y").textContent(), expected.text.join(""));
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
  // 字幕送りは選択時間を縮めない。カウントは20→0、期限後はGAME OVERを見せてタイトルへ。
  await mount(0);
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
  assert(await page.locator(".go-count").isVisible(), "zero remains visible");
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
  await page.locator('[data-test="retry"]').click();
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
  await mount(0);
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
  await page.close();

  // プレビューは両分岐を見せ、セーブと恋人抽選履歴を変えない。
  const preview = await browser.newPage({ viewport: { width: 844, height: 390 } });
  preview.on("pageerror", e => errors.push(e.message));
  await preview.route("https://bgmer.net/**", route => route.abort());
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
  await preview.locator("#preview-play").click();
  await preview.clock.runFor(22000);
  assert.match(await preview.locator("#preview-error").textContent(), /20秒でGAME OVER/);
  assert.equal(await preview.evaluate(() => localStorage.getItem("suien_remake_save")), "preview-sentinel");
  await preview.close();
  assert.deepEqual(missing, [], "all canon portraits must resolve");
  assert.deepEqual(errors, []);
  console.log("PASS: preview branches do not touch saves; page errors / missing portraits 0");
} finally { await browser.close(); }
