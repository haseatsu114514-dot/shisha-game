import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";
const shotsPath = process.env.COMPARISON_DIR;
if (shotsPath) await fs.mkdir(shotsPath, { recursive: true });
const game = page => page.locator('[data-test="axe-game"]');
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
async function fit(page) {
  const results = await game(page).locator(".axe-header, .axe-panel, .axe-button, .axe-note, .axe-legend").evaluateAll(nodes => {
    const game = document.querySelector(".axe-game").getBoundingClientRect();
    return nodes.map(n => {
      const r = n.getBoundingClientRect();
      return { text: n.textContent, visible: r.width > 0 && r.height > 0,
        fits: r.left >= game.left - 1 && r.right <= game.right + 1 && r.top >= game.top - 1 && r.bottom <= game.bottom + 1
          && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
          && n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1 };
    });
  });
  for (const r of results) if (r.visible) assert(r.fits, JSON.stringify(r));
}
async function aimAt(page, x = 0, y = 0, touch = false) {
  const point = await page.locator('[data-test="axe-target"]').evaluate((svg, { x, y }) => {
    const p = svg.createSVGPoint(); p.x = 330 + x * 164; p.y = 245 + y * 164;
    const result = p.matrixTransform(svg.getScreenCTM()); return { x: result.x, y: result.y };
  }, { x, y });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
async function shoot(page, { touch = false, x = 0, y = 0, keyboard = false } = {}) {
  await phase(page, "aim"); await aimAt(page, x, y, touch);
  await page.locator('[data-test="axe-action"]:not([disabled])').waitFor();
  if (keyboard) await page.keyboard.press("Space"); else await page.locator('[data-test="axe-action"]').click();
  await phase(page, "timing"); await fit(page);
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-test="axe-game"]');
    return Number(root.dataset.timing) >= .48 && Number(root.dataset.timing) <= .52;
  });
  if (keyboard) await page.keyboard.press("Space"); else await page.locator('[data-test="axe-action"]').click();
  await page.waitForFunction(() => ["result","summary"].includes(document.querySelector('[data-test="axe-game"]')?.dataset.phase));
}
async function standalone(page) {
  await page.evaluate(() => {
    localStorage.setItem("suien_remake_save", JSON.stringify({ schema: 5, money: 45678, stamina: 71,
      lovers: ["rin"], flags: { _friend_hiyori: true }, inbox: [{ id: "keep", read: true }],
      pendingInvite: { sender: "hiyori", day: 10, slot: 1 }, affinity: { hiyori: 66 } }));
    localStorage.setItem("unrelated", "keep"); sessionStorage.setItem("unrelated", "keep");
  });
  await page.goto(new URL("axe-throw.html", page.url()).href);
  await page.locator('[data-test="axe-start"]').click(); await phase(page, "aim");
}
await suite("axe-throw", async check => {
  for (const [label, options, touch] of [
    ["pc", { viewport: { width: 1280, height: 800 } }, false],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ["touch-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true],
    ["keyboard-reduced", { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" }, false],
  ]) await check(label, async page => {
    await standalone(page); const before = await storageSnapshot(page); await fit(page);
    for (let n = 0; n < 3; n++) {
      await shoot(page, { touch, x: n === 1 ? 1 : 0, y: n === 1 ? 1 : 0, keyboard: label === "keyboard-reduced" });
      await fit(page);
      if (n < 2) await page.locator('[data-test="axe-action"]').click();
    }
    assert.equal(await game(page).getAttribute("data-phase"), "summary");
    assert.match(await page.locator('[data-test="axe-note"]').textContent(), /合計 .*18点/);
    if (shotsPath) await page.screenshot({ path: shotsPath + "/" + label + "-summary.png" });
    await page.locator('[data-test="axe-retry"]').click(); await phase(page, "aim");
    assert.equal(await page.locator('[data-test="axe-round"]').textContent(), "1 / 3 投");
    await page.locator('[data-test="axe-cancel"]').click();
    await page.locator('[data-test="axe-start"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), before, "Practice must preserve raw legacy saves and LIME");
  }, options);
  await check("pause-reaim-and-repeat", async page => {
    await standalone(page);
    await page.locator('[data-test="axe-aim-右"]').click();
    assert(Number(await game(page).getAttribute("data-aim-x")) > -.42);
    await page.locator('[data-test="axe-action"]').click(); await phase(page, "timing");
    await page.evaluate(() => {
      window.testHidden = true;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => window.testHidden });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const needle = await game(page).getAttribute("data-timing"); await page.waitForTimeout(350);
    assert.equal(await game(page).getAttribute("data-timing"), needle);
    assert(await page.locator('[data-test="axe-action"]').isDisabled());
    await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    await page.locator('[data-test="axe-reaim"]').click(); await phase(page, "aim");
    await page.locator('[data-test="axe-target"]').focus(); await page.keyboard.press("Space");
    await phase(page, "timing"); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-test="axe-target"]').dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true })));
    assert.equal(await game(page).getAttribute("data-phase"), "timing");
    for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
    assert(await game(page).evaluate(root => root.contains(document.activeElement)));
    await page.keyboard.press("Escape"); assert.equal(await game(page).count(), 0);
  });
  for (const relationship of ["friend-legacy", "lover"]) await check("api-" + relationship, async page => {
    await page.evaluate(async relationship => {
      const core = await import("./js/core/state.js");
      window.A = { core, mini: await import("./js/minigames/axe.js") };
      const s = core.newGame(); s.phase = "daily"; s.money = 45678; s.stamina = 71;
      s.flags._hiyori_real_self_known = false; s.contacts.push("hiyori");
      s.inbox = [{ id: "keep", read: true, log: ["keep"] }]; s.pendingInvite = { sender: "hiyori", day: 10, slot: 1 };
      if (relationship === "friend-legacy") { s.schema = 5; s.flags._friend_hiyori = true; s.affinity.hiyori = 66; }
      else { s.lovers = ["hiyori","rin"]; s.lovePts.hiyori = 12; s.loveLevel.hiyori = 2; }
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(s)); core.load();
      A.before = JSON.stringify(core.state); A.abort = new AbortController();
      A.flow = A.mini.runAxeThrow({ signal: A.abort.signal });
      A.duplicate = A.flow === A.mini.runAxeThrow();
    }, relationship);
    assert(await page.evaluate(() => A.duplicate)); assert.equal(await game(page).count(), 1);
    await phase(page, "aim"); await fit(page);
    await shoot(page); await fit(page);
    await page.evaluate(() => A.abort.abort()); const result = await page.evaluate(() => A.flow);
    assert(!result.completed && result.cancelled && result.throws.length === 1);
    assert.equal(await game(page).count(), 0);
    assert(await page.evaluate(() => JSON.stringify(A.core.state) === A.before));
    await page.evaluate(() => { A.flow = A.mini.runAxeThrow({ reducedMotion: true }); });
    for (let n = 0; n < 3; n++) { await shoot(page); if (n < 2) await page.locator('[data-test="axe-action"]').click(); }
    await page.locator('[data-test="axe-action"]').click(); const complete = await page.evaluate(() => A.flow);
    assert(complete.completed && !complete.cancelled); assert.equal(complete.throws.length, 3);
    assert.equal(complete.total, complete.throws.reduce((sum, shot) => sum + shot.score, 0));
    assert(await page.evaluate(() => JSON.stringify(A.core.state) === A.before));
  });
});
