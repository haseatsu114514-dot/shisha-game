import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";

const root = page => page.locator('[data-test="axe-game"]');
const phase = (page, expected) => page.waitForFunction(expected =>
  document.querySelector('[data-test="axe-game"]')?.dataset.phase === expected, expected);
const output = process.env.COMPARISON_DIR;
const sizes = [];

async function capture(page, name) {
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  // CSS arrival animation uses the browser animation timeline, not the controlled game clock.
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/polish-${name}.png` });
}
async function start(page, options = {}) {
  await page.goto(new URL("axe-throw.html", page.url()).href);
  await page.evaluate(async options => {
    // This context is disposable. No game save is created or edited by the fixture.
    localStorage.setItem("axe-polish-fixture", "unchanged");
    sessionStorage.setItem("axe-polish-fixture", "unchanged");
    const { runAxeThrow } = await import("./js/minigames/axe.js");
    window.axePolishPromise = runAxeThrow({ host: document.getElementById("axe-app"), ...options });
  }, options);
  await phase(page, "choice");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  return storageSnapshot(page);
}
async function hit(page, selector, touch = false) {
  if (touch) await page.locator(selector).tap(); else await page.locator(selector).click();
}
async function action(page, touch = false) {
  await page.clock.runFor(300);
  await hit(page, '[data-test="axe-action"]:not([disabled])', touch);
}
async function gauge(page, value, cycle) {
  await page.clock.runFor(20);
  const current = Number(await root(page).getAttribute("data-timing"));
  assert(current < value, "Read the rising gauge before its stop point");
  await page.clock.runFor(Math.ceil((value - current) * cycle / 2));
}
async function boardStop(page, value, cycle, next, touch) {
  await gauge(page, value, cycle);
  assert.equal(await page.locator(".axe-target").getAttribute("aria-disabled"), "false");
  await hit(page, ".axe-target", touch);
  await phase(page, next);
}
async function throwWithBoard(page, { touch = false, power = .62, focus = true, finish = 1320 } = {}) {
  await action(page, touch); await phase(page, "horizontal");
  await boardStop(page, .5, 3200, "vertical", touch);
  await boardStop(page, .5, 3600, "power", touch);
  if (focus) {
    await gauge(page, .4, 2400);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(await root(page).getAttribute("data-focused"), "true");
  }
  await boardStop(page, power, 2400, "flight", touch);
  await page.clock.runFor(finish); await phase(page, "result");
}
async function fits(page) {
  const checks = await root(page).locator(".axe-header, .axe-panel, .axe-button, .axe-total, .axe-result-card, .axe-result-tip, .axe-comment").evaluateAll(nodes =>
    nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent, box: { width: r.width, height: r.height },
        scroll: { width: node.scrollWidth, height: node.scrollHeight }, client: { width: node.clientWidth, height: node.clientHeight },
        visible: r.width > 0 && r.height > 0,
        fits: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
          && node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 };
    }));
  for (const check of checks) if (check.visible) assert(check.fits, JSON.stringify(check));
}
async function cancel(page, before) {
  await root(page).focus(); await page.keyboard.press("Escape");
  const result = await page.evaluate(() => window.axePolishPromise);
  assert(result.cancelled && !result.completed);
  assert.deepEqual(await storageSnapshot(page), before);
  return result;
}

await suite("axe-polish", async check => {
  for (const [label, context, touch, minimum] of [
    ["pc", { viewport: { width: 1280, height: 800 } }, false, 300],
    ["touch-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true, 180],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true, 145],
  ]) await check(`${label}-board-input-results-and-total`, async page => {
    const before = await start(page);
    const shown = [];
    for (let i = 0; i < 3; i++) {
      await throwWithBoard(page, { touch, power: i === 0 ? .93 : .62, focus: i !== 0 });
      await fits(page);
      const result = await page.locator('[data-test="axe-result"]').innerText();
      if (i === 0) { assert.match(result, /DROP/); assert.match(result, /54〜70%/); }
      else { assert.match(result, /BULL'S EYE/); assert.match(result, /赤い中心に命中/); }
      shown.push(Number(await page.locator(".axe-result-value > span").textContent()));
      assert.equal(Number(await page.locator(".axe-total strong").textContent()), shown.reduce((a, b) => a + b, 0));
      if (i === 1) {
        const board = await page.locator(".axe-target > image").boundingBox();
        assert(board.width > minimum, `Usable wood target width: ${board.width}`);
        sizes.push({ label, viewport: page.viewportSize(), phase: "result", woodWidth: board.width, woodHeight: board.height });
        await capture(page, `${label}-bull-result`);
      }
      await action(page, touch);
      if (i < 2) await phase(page, "choice");
    }
    await phase(page, "summary"); await fits(page);
    assert.match(await page.locator(".axe-result-tip").textContent(), /ブル 2回/);
    const displayedTotal = Number(await page.locator(".axe-total strong").textContent());
    await capture(page, `${label}-summary`); await action(page, touch);
    const completed = await page.evaluate(() => window.axePolishPromise);
    assert(completed.completed && !completed.cancelled);
    assert.deepEqual(completed.throws.map(s => s.score), shown);
    assert.equal(completed.total, displayedTotal);
    assert.equal(completed.total, completed.throws.reduce((sum, shot) => sum + shot.score, 0));
    assert.deepEqual(await storageSnapshot(page), before);
  }, context);

  await check("keyboard-focus-is-once-and-reaim-keeps-use", async page => {
    const before = await start(page);
    await action(page); await phase(page, "horizontal"); await page.clock.runFor(300);
    await root(page).focus();
    for (const modifier of ["Control", "Meta", "Alt"]) {
      await page.keyboard.press(`${modifier}+f`);
      assert.equal(Number(await root(page).getAttribute("data-focus-remaining")), 0, `${modifier}+F must preserve focus`);
      assert(!await page.locator('[data-test="axe-focus"]').isDisabled());
    }
    await root(page).focus(); await page.keyboard.press("f");
    const first = Number(await root(page).getAttribute("data-focus-remaining"));
    assert(first > 1100);
    await page.clock.runFor(400); await page.keyboard.press("F");
    const second = Number(await root(page).getAttribute("data-focus-remaining"));
    assert(second < first - 300, "Repeated F must not refill focus");
    await page.locator('[data-test="axe-reaim"]').click(); await phase(page, "choice");
    await action(page); await phase(page, "horizontal"); await page.clock.runFor(300);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(Number(await root(page).getAttribute("data-focus-remaining")), 0);
    assert(await page.locator('[data-test="axe-focus"]').isDisabled());
    const result = await cancel(page, before); assert.equal(result.throws.length, 0);
  });

  await check("impact-pauses-in-rules-and-opponent-rejects-shortcuts", async page => {
    const before = await start(page, { mode: "versus", difficulty: "hard", seed: 9 });
    await throwWithBoard(page, { finish: 960 });
    const effect = page.locator(".axe-impact-fx");
    assert(Number(await effect.getAttribute("opacity")) > 0, "Scoring impact starts visibly");
    await page.locator('[data-test="axe-rules"]').click();
    const frozen = await effect.evaluate(n => n.outerHTML);
    await page.clock.runFor(1000);
    assert.equal(await effect.evaluate(n => n.outerHTML), frozen, "Rules pause the complete impact effect");
    await page.locator('[data-test="axe-rules-close"]').click();
    await capture(page, "pc-impact");
    await page.clock.runFor(1250); assert.equal(Number(await effect.getAttribute("opacity")), 0);
    await action(page); await phase(page, "opponent-ready");
    const actorBefore = await root(page).evaluate(n => ({ actor: n.dataset.actor, held: n.dataset.held,
      player: n.dataset.playerThrows, opponent: n.dataset.opponentThrows, focus: n.dataset.focusRemaining }));
    const board = await page.locator(".axe-target").boundingBox();
    // Physical input on a disabled board exercises its event guard; locator.click would refuse the test input.
    await page.mouse.click(board.x + board.width / 2, board.y + board.height / 2);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(await root(page).getAttribute("data-phase"), "opponent-ready");
    assert.equal(await page.locator(".axe-target").getAttribute("aria-disabled"), "true");
    assert.deepEqual(await root(page).evaluate(n => ({ actor: n.dataset.actor, held: n.dataset.held,
      player: n.dataset.playerThrows, opponent: n.dataset.opponentThrows, focus: n.dataset.focusRemaining })), actorBefore);
    const result = await cancel(page, before); assert.equal(result.match.player.length, 1); assert.equal(result.match.opponent.length, 0);
  });

  await check("reduced-motion-keeps-result-without-impact-animation", async page => {
    const before = await start(page, { reducedMotion: true });
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .5, 3200, "vertical", false);
    await boardStop(page, .5, 3600, "power", false);
    await gauge(page, .4, 2400); await root(page).focus(); await page.keyboard.press("f");
    await gauge(page, .62, 2400); await page.locator(".axe-target").click();
    await page.clock.runFor(40); await phase(page, "result");
    assert.match(await page.locator(".axe-result-label").textContent(), /BULL'S EYE/);
    assert.equal(Number(await page.locator(".axe-impact-fx").getAttribute("opacity")), 0);
    assert.equal(await page.locator(".axe-result-card").evaluate(n => getComputedStyle(n).animationName), "none");
    const result = await cancel(page, before); assert.equal(result.throws[0].score, 6);
  }, { reducedMotion: "reduce" });

  await check("green-power-cue-and-zero-point-wood-contact-never-celebrate", async page => {
    const before = await start(page, { opponent: null });
    await page.evaluate(async () => {
      const { SE } = await import("./js/core/audio.js");
      window.axeSounds = { hit: 0, perfect: 0, miss: 0 };
      for (const kind of Object.keys(window.axeSounds)) SE[kind] = () => window.axeSounds[kind]++;
    });
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .98, 3200, "vertical", false);
    await boardStop(page, .98, 3600, "power", false);
    await gauge(page, .62, 2400);
    assert.equal(await page.locator(".axe-timing").getAttribute("data-quality"), "sweet");
    assert.match(await page.locator('[data-test="axe-power-cue"]').textContent(), /いま投げる/);
    assert.equal(await root(page).getAttribute("data-preview-score"), "0");
    await page.locator(".axe-target").click();
    const predicted = await root(page).evaluate(n => ({ x: Number(n.dataset.landingX), y: Number(n.dataset.landingY) }));
    await page.clock.runFor(980); await phase(page, "result");
    assert.equal(await page.locator(".axe-total strong").textContent(), "0");
    assert.equal(Number(await page.locator(".axe-impact-fx").getAttribute("opacity")), 0);
    assert.deepEqual(await page.evaluate(() => window.axeSounds), { hit: 0, perfect: 0, miss: 1 });
    const result = await cancel(page, before), shot = result.throws[0];
    assert(shot.stuck && shot.score === 0 && shot.outcome === "miss");
    assert.deepEqual(shot.landing, predicted, "A zero score uses exactly the displayed landing too");
  });
});

if (output && sizes.length) await fs.writeFile(`${output}/polish-target-sizes.json`, JSON.stringify(sizes, null, 2) + "\n");
