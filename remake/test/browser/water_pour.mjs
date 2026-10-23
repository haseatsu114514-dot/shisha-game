// #872 水入れミニゲーム（試遊ページ）：長押しで注ぐ・傾けてこぼす・判定は実水量だけ・PC/タッチ。
import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

const entry = new URL("craft-preview.html?step=water", baseURL).href;
const view = page => page.evaluate(() => {
  const d = globalThis.__waterPourPreview.debug, root = document.querySelector('[data-test="water-pour"]');
  return { volume: d.volume, tilt: d.tilt, spilled: d.spilledArea, target: d.target, pour: root.dataset.pour, tiltOn: root.dataset.tilt };
});
async function holdMouse(page, selector, ms) {
  await page.locator(selector).hover();
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
}
async function setVolumeAtLine(page, offsetPx = 0) {
  await page.evaluate(async offsetPx => {
    const m = await import("./js/craft/water-pour.js");
    const d = globalThis.__waterPourPreview.debug;
    d.volume = m.volumeAtLevel(d.target + offsetPx);
  }, offsetPx);
}

await suite("water_pour", async check => {
  await check("pc-pour-and-spill", async page => {
    await page.waitForTimeout(300);
    const before = await storageSnapshot(page);
    assert.equal((await view(page)).volume, 0);
    await holdMouse(page, '[data-test="pour-hold"]', 1200);
    await page.waitForTimeout(700); // 落ちている途中の水まで入る
    const poured = await view(page);
    assert.ok(poured.volume > 15000, `pouring adds water (${poured.volume})`);
    assert.equal(poured.pour, "off");
    await page.waitForTimeout(500);
    assert.equal((await view(page)).volume, poured.volume, "water stops after release");

    // たっぷり入れてから倒すと、口からこぼれて卓に溜まる。
    await page.evaluate(() => { globalThis.__waterPourPreview.debug.volume = 300000; });
    await holdMouse(page, '[data-test="pour-tilt"]', 1800);
    const spilled = await view(page);
    assert.ok(spilled.spilled > 0 && spilled.volume < 300000, "tilting far enough spills water");
    assert.notEqual(await page.locator('[data-test="pour-spilled"]').textContent(), "0ml");
    await page.waitForTimeout(1200);
    assert.equal((await view(page)).tilt, 0, "bottle stands back up after release");
    assert.deepEqual(await storageSnapshot(page), before, "preview must not touch saves");
  }, { viewport: { width: 1280, height: 772 } });

  await check("judges-real-water-not-waves", async page => {
    await page.waitForTimeout(300);
    await setVolumeAtLine(page);
    // 少しだけ傾けて水面を大きく揺らす（こぼれない角度）。
    await holdMouse(page, '[data-test="pour-tilt"]', 250);
    assert.equal((await view(page)).spilled, 0);
    await page.locator('[data-test="pour-decide"]').click();
    await page.locator('[data-test="pour-result"]').waitFor({ state: "visible" });
    assert.match(await page.locator('[data-test="pour-result"]').innerText(), /EXCELLENT[\s\S]*±0\.0mm/);
    assert.equal(await page.locator('[data-test="pour-hold"]').isDisabled(), true);

    // 次の一本：空のボトルと新しい目安線。
    await page.locator('[data-test="pour-next"]').click();
    const fresh = await view(page);
    assert.equal(fresh.volume, 0);
    assert.equal(await page.locator('[data-test="pour-result"]').isVisible(), false);

    await setVolumeAtLine(page, -4 * 4.25 - 3); // 約4.7mm 多い
    await page.keyboard.press("Enter");
    await page.locator('[data-test="pour-result"]').waitFor({ state: "visible" });
    assert.match(await page.locator('[data-test="pour-result"]').innerText(), /GOOD[\s\S]*\+4\.\dmm/);
  }, { viewport: { width: 1280, height: 772 } });

  await check("keyboard-and-interruptions", async page => {
    await page.waitForTimeout(300);
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    assert.equal((await view(page)).pour, "on");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.equal((await view(page)).pour, "off", "window blur stops pouring");
    await page.keyboard.up("Space");
    await page.waitForTimeout(700);
    const stopped = (await view(page)).volume;
    await page.waitForTimeout(400);
    assert.equal((await view(page)).volume, stopped, "no automatic restart");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(200);
    assert.equal((await view(page)).tiltOn, "on");
    await page.keyboard.up("ArrowRight");
    assert.equal((await view(page)).tiltOn, "off");
  }, { viewport: { width: 1280, height: 772 } });

  await check("touch-landscape-fits", async page => {
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".wpour-stage"), canvas = stage.querySelector("canvas");
      const side = document.querySelector(".wpour-info").getBoundingClientRect();
      const buttons = [...document.querySelectorAll(".wpour-actions .btn")].map(b => b.getBoundingClientRect());
      return {
        canvasFillsStage: Math.abs(canvas.clientWidth - stage.clientWidth) < 2 && Math.abs(canvas.clientHeight - stage.clientHeight) < 2,
        buttonsInside: buttons.every(b => b.left >= side.left - 1 && b.right <= side.right + 1 && b.bottom <= side.bottom + 1),
        smallest: Math.min(...buttons.map(b => b.height)),
      };
    });
    assert.ok(layout.canvasFillsStage, "canvas uses the stage even when the bench is scaled");
    assert.ok(layout.buttonsInside, "buttons stay inside the side card");
    const box = await page.locator('[data-test="pour-hold"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(900);
    assert.equal((await view(page)).pour, "on");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(700);
    const after = await view(page);
    assert.equal(after.pour, "off");
    assert.ok(after.volume > 0, "touch hold pours");
  }, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
}, { entry, readySelector: '[data-test="pour-hold"]' });
