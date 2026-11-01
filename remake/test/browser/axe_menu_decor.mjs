import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";

const output = process.env.COMPARISON_DIR;
async function capture(page, name) {
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function entrance(page) {
  await page.goto(new URL("axe-throw.html", page.url()).href);
  await page.locator(".axe-menu").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function reachableControls(page) {
  const menu = page.locator(".axe-menu");
  assert.equal(await menu.locator("button, a").count(), 16);
  assert.deepEqual(await menu.locator(".axe-menu-mode").evaluateAll(nodes => nodes.map(n => n.dataset.kind)), ["practice", "league", "versus"]);
  assert.equal(await menu.locator("h1").textContent(), "AXE THROW");
  assert.equal(await menu.locator("img, canvas").count(), 0, "Menu content is live text DOM, not a screenshot click surface");
  const overflow = await menu.evaluate(n => n.scrollWidth - n.clientWidth);
  assert(overflow <= 1, `Horizontal overflow: ${overflow}`);
  const initiallyClipped = await menu.locator("button, a").evaluateAll(nodes => nodes.flatMap(n => {
    const r = n.getBoundingClientRect();
    return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
      ? [] : [{ text: n.textContent.trim(), rect: r.toJSON() }];
  }));
  assert.deepEqual(initiallyClipped, [], "Named acceptance viewports initially show every menu control");
  for (const control of await menu.locator("button, a").all()) {
    await control.scrollIntoViewIfNeeded();
    const metrics = await control.evaluate(n => {
      const r = n.getBoundingClientRect();
      return { text: n.textContent.trim(), width: r.width, height: r.height,
        fits: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
        textFits: n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1 };
    });
    assert(metrics.fits && metrics.textFits && metrics.width >= 44 && metrics.height >= 44, JSON.stringify(metrics));
    await control.click({ trial: true });
  }
}
async function useSettingsAndRules(page, touch) {
  const press = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
  await press('[data-companion="shark"]');
  assert.equal(await page.locator('[data-companion="shark"]').getAttribute("aria-pressed"), "true");
  const hard = page.locator('[data-difficulty="hard"]');
  await hard.focus(); await page.keyboard.press("Space");
  assert.equal(await hard.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('[data-difficulty="normal"]').getAttribute("aria-pressed"), "false");
  assert.equal(await hard.evaluate(n => getComputedStyle(n).outlineWidth), "3px");
  await press('[data-test="axe-menu-rules"]');
  await page.locator('[data-test="axe-rules-panel"]').waitFor();
  assert.equal(await page.locator(".axe-menu").getAttribute("inert"), "");
  await press('[data-test="axe-rules-close"]');
  assert.equal(await page.locator('[data-test="axe-menu-rules"]').evaluate(n => n === document.activeElement), true);
}
await suite("axe-menu-decor", async check => {
  for (const [w, h, touch] of [[1280,720,false],[800,600,false],[390,844,true],[844,390,true],[812,375,true]]) {
    await check(`${w}x${h}-live-controls`, async page => {
      await entrance(page);
      const before = await storageSnapshot(page);
      const images = await page.evaluate(async () => Promise.all(["menu-walnut-panel", "menu-crossed-axes"].map(async name => {
        const image = new Image(); image.src = `./img/ui/axe_throw/${name}.webp`;
        await image.decode(); return [image.naturalWidth, image.naturalHeight];
      })));
      assert.deepEqual(images, [[1024,228],[192,192]]);
      assert.equal(await page.locator("h1").evaluate(n => getComputedStyle(n, "::after").pointerEvents), "none");
      assert.equal(await page.locator(".axe-menu-mode").first().evaluate(n => getComputedStyle(n, "::before").pointerEvents), "none");
      await capture(page, `${w}x${h}-top`);
      await reachableControls(page);
      await capture(page, `${w}x${h}-footer`);
      await useSettingsAndRules(page, touch);
      assert.equal(await page.locator(".axe-back").getAttribute("href"), "./");
      assert.deepEqual(await storageSnapshot(page), before);
    }, { viewport: { width: w, height: h }, hasTouch: touch, isMobile: w === 390 });
  }
  await check("keyboard-modes-lesson-return-and-no-save", async page => {
    await entrance(page);
    const before = await storageSnapshot(page);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator('[data-test="axe-start"]').evaluate(n => n === document.activeElement), true);
    for (const [selector, key, text] of [
      ['[data-test="axe-start"]', "Enter", /3投の練習/],
      ['[data-test="axe-league"]', "Space", /10投ゲーム/],
      ['[data-test="axe-versus"]', "Enter", /ひよりと10投対戦/],
    ]) {
      await page.locator(selector).focus(); await page.keyboard.press(key);
      const game = page.locator('[data-test="axe-game"]'); await game.waitFor();
      await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]')?.dataset.phase === "choice");
      assert.match(await game.innerText(), text);
      await game.focus(); await page.keyboard.press("Escape"); await page.locator(".axe-menu").waitFor();
      assert.equal(await page.locator('[data-test="axe-start"]').evaluate(n => n === document.activeElement), true);
      assert.deepEqual(await storageSnapshot(page), before);
    }
    await page.locator('[data-test="axe-menu-lesson"]').click();
    await page.locator('[data-test="axe-coach"][data-kind="welcome"]').waitFor();
    await page.locator('[data-test="axe-coach-skip"]').click();
    assert.equal(await page.locator('[data-test="axe-game"]').count(), 0, "Lesson stop closes the tutorial");
    await page.locator(".axe-menu:not([inert])").waitFor();
    assert.equal(await page.locator('[data-test="axe-menu-lesson"]').evaluate(n => n === document.activeElement), true);
    assert.deepEqual(await storageSnapshot(page), before);
    await page.locator(".axe-back").click();
    await page.locator('[data-test="title-new"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), before);
  });
  await check("invalid-decoration-images-and-reduced-motion", async page => {
    // A successful HTTP transfer with an invalid payload exercises image decode failure
    // without teaching the shared harness to ignore real network failures.
    await page.route("**/img/ui/axe_throw/menu-*.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "invalid image fixture" }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await entrance(page); const before = await storageSnapshot(page);
    const decodeFailed = await page.evaluate(async () => {
      const image = new Image(); image.src = "./img/ui/axe_throw/menu-walnut-panel.webp";
      try { await image.decode(); return false; } catch { return true; }
    });
    assert(decodeFailed);
    assert.equal(await page.locator(".axe-menu-mode").first().evaluate(n => getComputedStyle(n).transitionDuration), "0s");
    await reachableControls(page); await capture(page, "fallback-reduced-motion");
    await useSettingsAndRules(page, false);
    await page.locator('[data-test="axe-start"]').click();
    await page.locator('[data-test="axe-game"]').waitFor();
    await page.locator('[data-test="axe-cancel"]').click(); await page.locator(".axe-menu").waitFor();
    assert.deepEqual(await storageSnapshot(page), before);
  });
});
