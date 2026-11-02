import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";

const game = page => page.locator('[data-test="axe-game"]');
const coach = (page, kind) => page.locator(`[data-test="axe-coach"][data-kind="${kind}"]`);
const phase = (page, expected) => page.waitForFunction(expected =>
  document.querySelector('[data-test="axe-game"]')?.dataset.phase === expected, expected);
const clocked = new WeakSet();
const output = process.env.COMPARISON_DIR;

async function capture(page, name) {
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/lesson-${name}.png` });
}
async function pauseClock(page) {
  if (!clocked.has(page)) { await page.clock.install(); clocked.add(page); }
  const now = await page.evaluate(() => Date.now());
  // A generous margin: the fake clock keeps running between the read and the pause, and a past target throws.
  await page.clock.pauseAt(new Date(now + 500));
}
async function hit(page, selector, touch = false) {
  if (touch) await page.locator(selector).tap(); else await page.locator(selector).click();
}
async function fits(page) {
  const checks = await game(page).locator(".axe-header, .axe-coach-card, .axe-coach-actions button, .axe-panel, .axe-total, .axe-live-score, .axe-result-card").evaluateAll(nodes =>
    nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent, visible: r.width > 0 && r.height > 0,
        fits: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
          && node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 };
    }));
  for (const check of checks) if (check.visible) assert(check.fits, JSON.stringify(check));
}
async function guide(page, kind, touch = false, freeze = true) {
  await coach(page, kind).waitFor(); await fits(page);
  assert.equal(await game(page).getAttribute("data-paused"), "true");
  if (freeze) {
    const snapshot = () => game(page).evaluate(n => ({ phase: n.dataset.phase, timing: n.dataset.timing,
      held: n.dataset.held, focus: n.dataset.focusRemaining, power: n.dataset.power }));
    const before = await snapshot(); await page.clock.runFor(1000);
    assert.deepEqual(await snapshot(), before, `${kind} explanation freezes the game clock`);
  }
  await hit(page, '[data-test="axe-coach-next"]', touch);
}
async function action(page, touch = false) {
  await page.clock.runFor(300);
  await hit(page, '[data-test="axe-action"]:not([disabled])', touch);
}
async function gauge(page, target, cycle) {
  await page.clock.runFor(20);
  const current = Number(await game(page).getAttribute("data-timing"));
  assert(current < target, "Read the rising needle before its desired stop point");
  await page.clock.runFor(Math.ceil((target - current) * cycle / 2));
}
async function stop(page, target, cycle, next, touch = false) {
  await gauge(page, target, cycle); await hit(page, ".axe-target", touch); await phase(page, next);
}
async function start(page, options = {}) {
  await page.goto(new URL("axe-throw.html", page.url()).href);
  const before = await storageSnapshot(page);
  await page.evaluate(async options => {
    const { runAxeThrow } = await import("./js/minigames/axe.js");
    window.lessonAbort = new AbortController();
    window.lessonPromise = runAxeThrow({ host: document.getElementById("axe-app"), signal: lessonAbort.signal, ...options });
  }, options);
  if (options.tutorial) await coach(page, "welcome").waitFor(); else await phase(page, "choice");
  await pauseClock(page);
  return before;
}
async function completeLesson(page, { touch = false, captureName = null, freeze = true } = {}) {
  assert.equal(await game(page).getAttribute("data-tutorial"), "true");
  await guide(page, "welcome", touch, freeze); await guide(page, "target", touch, freeze);
  await action(page, touch); await phase(page, "horizontal");
  await guide(page, "horizontal", touch, freeze);
  await stop(page, .5, 3600, "vertical", touch); await guide(page, "vertical", touch, freeze);
  await stop(page, .5, 3600, "power", touch); await guide(page, "power", touch, freeze);
  await gauge(page, .4, 2400); await game(page).focus(); await page.keyboard.press("f");
  await stop(page, .62, 2400, "flight", touch); await page.clock.runFor(1200);
  await coach(page, "result").waitFor();
  assert.match(await coach(page, "result").innerText(), /今回は6点/);
  if (captureName) await capture(page, `${captureName}-result-guide`);
  await guide(page, "result", touch, freeze); await phase(page, "result");
  const total = Number(await page.locator(".axe-total strong").textContent());
  assert.equal(total, 6); assert.match(await page.locator(".axe-result-label").textContent(), /BULL'S EYE/);
  assert.equal(await game(page).getAttribute("data-player-throws"), "1");
  await fits(page); await action(page, touch); await coach(page, "finish").waitFor();
  await guide(page, "finish", touch, freeze);
  const result = await page.evaluate(() => window.lessonPromise);
  assert(result.completed && !result.cancelled && result.tutorial);
  assert.equal(result.throwCount, 1); assert.equal(result.maximum, 8); assert.equal(result.total, total);
  assert.equal(result.throws.length, 1); assert.equal(result.throws[0].score, 6);
  return result;
}
async function previewMatchesModel(page) {
  const expected = await game(page).evaluate(async root => {
    const { resolveThrow } = await import("./js/minigames/axe-model.js");
    return resolveThrow({ x: Number(root.dataset.releaseX), y: Number(root.dataset.releaseY),
      power: Number(root.dataset.power), called: root.dataset.called || null });
  });
  assert.equal(Number((await page.locator('[data-test="axe-live-score"] strong').textContent()).replace(/[^0-9]/g, "")), expected.score);
  return expected;
}

await suite("axe-lesson", async check => {
  for (const [label, options, touch] of [
    ["pc", { viewport: { width: 1280, height: 800 } }, false],
    ["touch-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-guided-one-throw-and-no-save`, async page => {
    const before = await start(page, { tutorial: true });
    assert.match(await coach(page, "welcome").innerText(), /無料で1投/);
    await completeLesson(page, { touch, captureName: label });
    assert.equal(await game(page).count(), 0);
    assert.deepEqual(await storageSnapshot(page), before);
  }, options);

  await check("normal-live-score-and-prominent-killshot-rules", async page => {
    const before = await start(page, { opponent: null });
    await page.locator('[data-test="axe-rules"]').click();
    const rules = page.locator('[data-test="axe-rules-panel"]');
    assert.equal(await rules.locator(".axe-rules-scroll > .axe-coach-diagram").count(), 1);
    assert.match(await rules.innerText(), /まずこれだけ/); assert.match(await rules.innerText(), /キルショット（青）/);
    for (const explanation of [/外側の青は7点.*中心は8点/, /その青以外.*0点/, /宣言なしで青に刺さると1のリングの1点/, /1ゲーム2回/, /外れ・落下でも1回/, /左右とも閉じ/, /落下.*宣言が1回増える/, /前半・後半/, /レク.*アマ.*プロ|部門/, /サドンデス/])
      assert.match(await rules.innerText(), explanation);
    await page.locator('[data-test="axe-rules-close"]').click();
    await action(page); await stop(page, .5, 3600, "vertical"); await stop(page, .5, 3600, "power");
    await gauge(page, .3, 2400);
    assert.equal((await previewMatchesModel(page)).outcome, "drop");
    await gauge(page, .4, 2400); await game(page).focus(); await page.keyboard.press("f");
    await gauge(page, .62, 2400); assert.equal((await previewMatchesModel(page)).score, 6);
    await page.locator('[data-test="axe-reaim"]').click(); await phase(page, "choice");
    await page.clock.runFor(300); await page.locator('[data-call="upper-left"]').click();
    assert.match(await page.locator('[data-test="axe-call-status"]').textContent(), /青以外0点/);
    await action(page); await stop(page, .5, 3600, "vertical"); await stop(page, .5, 3600, "power");
    await gauge(page, .62, 2400); assert.equal((await previewMatchesModel(page)).outcome, "killshot-miss");
    assert.equal((await previewMatchesModel(page)).score, 0);
    await game(page).focus(); await page.keyboard.press("Escape");
    const result = await page.evaluate(() => window.lessonPromise);
    assert(result.cancelled && !result.completed); assert.equal(result.throws.length, 0);
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("first-play-and-event-contexts-swap-greeting-and-send-off", async page => {
    for (const [context, greeting, farewell, ahead] of [["first", /斧は初めて/, /ここからが本番/, "本番へ"], ["event", /連れと一緒に/, /連れと楽しんで/, "投げに行く"]]) {
      if (clocked.has(page)) await page.clock.resume();
      const before = await start(page, { tutorial: true, opponent: null, lessonContext: context });
      assert.match(await coach(page, "welcome").innerText(), greeting);
      assert.equal(await page.locator('[data-test="axe-coach-skip"]').textContent(), "説明をとばす");
      await guide(page, "welcome", false, true); await guide(page, "target", false, true);
      assert.match(await page.locator('[data-test="axe-rules"]').textContent(), /ルール/);
      await action(page); await phase(page, "horizontal"); await guide(page, "horizontal", false, true);
      await stop(page, .5, 3600, "vertical"); await guide(page, "vertical", false, true);
      await stop(page, .5, 3600, "power"); await guide(page, "power", false, true);
      await stop(page, .62, 2400, "flight"); await page.clock.runFor(1200);
      await coach(page, "result").waitFor(); assert.match(await coach(page, "result").innerText(), /丸い窓/);
      await guide(page, "result", false, true); await phase(page, "result"); await action(page);
      await coach(page, "finish").waitFor();
      assert.match(await coach(page, "finish").innerText(), farewell);
      assert.equal(await page.locator('[data-test="axe-coach-next"]').textContent(), ahead);
      await guide(page, "finish", false, true);
      const result = await page.evaluate(() => window.lessonPromise);
      assert(result.completed && result.tutorial); assert.equal(result.lessonContext, context);
      assert.deepEqual(await storageSnapshot(page), before);
    }
    const refused = await page.evaluate(async () => {
      const { runAxeThrow } = await import("./js/minigames/axe.js"), host = document.getElementById("axe-app");
      return Promise.all([runAxeThrow({ host, tutorial: true, opponent: null, lessonContext: "party" }), runAxeThrow({ host, mode: "practice", lessonContext: "first" })]
        .map(p => p.then(() => false, e => e instanceof RangeError)));
    });
    assert.deepEqual(refused, [true, true], "an unknown context, or a context outside the lesson, is refused");
  });

  await check("skip-abort-and-host-removal-close-coach", async page => {
    for (const operation of ["skip", "abort", "host", "screen"]) {
      if (clocked.has(page)) await page.clock.resume();
      const before = await start(page, { tutorial: true });
      if (operation === "skip") await page.locator('[data-test="axe-coach-skip"]').click();
      if (operation === "abort") await page.evaluate(() => window.lessonAbort.abort());
      if (operation === "host") {
        await page.evaluate(() => document.getElementById("axe-app").remove()); await page.clock.runFor(50);
      }
      if (operation === "screen") {
        await page.evaluate(() => document.querySelector('[data-test="axe-game"]').remove()); await page.clock.runFor(50);
      }
      const result = await page.evaluate(() => window.lessonPromise);
      assert(result.cancelled && !result.completed && result.tutorial);
      assert.equal(result.throws.length, 0); assert.equal(await page.locator('[data-test="axe-coach"]').count(), 0);
      assert.deepEqual(await storageSnapshot(page), before);
    }
  });

  await check("free-store-lesson-ignores-cost-and-day-use-without-mutation", async page => {
    for (const restriction of ["poor", "played", "exhausted"]) {
      if (clocked.has(page)) await page.clock.resume();
      await page.goto(new URL("./", page.url()).href);
      await page.locator('[data-test="title-new"]').waitFor();
      await page.evaluate(async restriction => {
        window.lessonCore = await import("./js/core/state.js");
        const state = lessonCore.newGame();
        Object.assign(state, { chapter: 1, day: 5, slot: 1, phase: "daily", money: restriction === "poor" ? 0 : 12000, stamina: restriction === "exhausted" ? 0 : 80 });
        // 発見・無料目撃は済ませ、保存を伴う初回目撃とレッスンの不変検証を分ける。
        Object.assign(state.flags, { _axe_bar_rumor_done: true, _axe_bar_sighting_done: true,
          _axe_bar_sighting_day: state.day - 1, _axe_bar_sighting_chapter: state.chapter });
        if (restriction === "played") state.visitedDay.axe_bar = state.day;
        window.lessonGuardCalls = 0; window.lessonVisitSettled = false;
        window.visitPromise = (await import("./js/daily/axe-bar.js")).visitAxeBar({
          staminaGuard: async () => { window.lessonGuardCalls++; return true; },
        });
        window.visitPromise.then(() => { window.lessonVisitSettled = true; });
      }, restriction);
      await page.locator('[data-test="axe-bar-menu"]').waitFor();
      assert(await page.locator('[data-test="axe-bar-practice"]').isDisabled());
      assert(!await page.locator('[data-test="axe-bar-lesson"]').isDisabled());
      const stateBefore = await page.evaluate(() => JSON.stringify(lessonCore.state));
      const storageBefore = await storageSnapshot(page);
      await page.locator('[data-test="axe-bar-lesson"]').click(); await coach(page, "welcome").waitFor();
      await page.evaluate(async () => { window.lessonPromise = (await import("./js/minigames/axe.js")).runAxeThrow({ host: document.getElementById("stage") }); });
      await pauseClock(page); await completeLesson(page, { freeze: false });
      await page.locator('[data-test="axe-bar-menu"]').waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => window.lessonGuardCalls), 0);
      assert.equal(await page.evaluate(() => window.lessonVisitSettled), false);
      assert.equal(await page.locator('[data-test="axe-bar-menu"]').evaluate(n => n.inert), false);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "axe-bar-lesson");
      // The only change is the record that the owner's lesson was taken, so the first paid game does not repeat it.
      const taught = JSON.parse(stateBefore); taught.flags._axe_lesson_done = true;
      assert.equal(await page.evaluate(() => JSON.stringify(lessonCore.state)), JSON.stringify(taught), restriction);
      assert.deepEqual(await storageSnapshot(page), storageBefore, restriction);
      assert(await page.locator('[data-test="axe-bar-practice"]').isDisabled());
      await page.locator('[data-test="axe-bar-back"]').click();
      assert.equal(await page.evaluate(() => window.visitPromise), false, "A lesson never completes a paid daily action");
      assert.equal(await page.evaluate(() => JSON.stringify(lessonCore.state)), JSON.stringify(taught));
    }
  });
});
