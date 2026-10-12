// #402: 本番の素材待ち・工程/表情・一口/泡の同期をPCと実タッチイベントで検証。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function init(page) {
  await page.evaluate(async () => {
    const state = await import("./js/core/state.js"); state.newGame();
    window.T = {
      state, session: await import("./js/craft/session.js"),
      heat: await import("./js/craft/heat.js"), pull: await import("./js/craft/pull.js"),
      steps: await import("./js/craft/steps.js"),
    };
    T.open = async () => {
      window.cs = T.session.newSession("drill");
      window.bench = T.session.openBench(cs);
      await T.session.waitBenchReady(cs);
    };
  });
}
const worker = page => page.locator('[data-test="worker-window"]');

await suite("worker-scenes", async check => {
  for (const [name, options] of [
    ["pc", {}],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`steps-faces-${name}`, async page => {
      await init(page); await page.evaluate(() => T.open());
      const before = await page.evaluate(() => JSON.stringify(cs));
      for (const step of ["mix", "pack", "holes", "heat", "pull", "care"]) {
        await page.evaluate(step => T.session.stepPanel(step, step), step);
        assert.equal(await worker(page).getAttribute("data-scene"), step === "care" ? "pull" : step);
        assert.equal(await page.locator(".worker-action:visible").count(), 1);
        assert(await page.locator(".worker-action:visible").evaluate(img => img.complete && img.naturalWidth > 0));
        await assertFits(page, ".worker-action:visible");
        await capture(page, `${name}-${step}`);
      }
      await page.evaluate(() => T.session.stepPanel("steam", "蒸らし"));
      for (const [mental, fatigue, face, waiting] of [
        ["steady", 0, "serious", "true"], ["steady", 2, "sad", "false"],
        ["unsteady", 0, "sad", "false"], ["shaken", 2, "surprise", "false"],
      ]) {
        await page.evaluate(([mental, fatigue]) => { bench.worker.setFatigue(fatigue); T.session.setPlayerMental(cs, mental); }, [mental, fatigue]);
        assert.equal(await worker(page).getAttribute("data-face"), face);
        assert.equal(await worker(page).getAttribute("data-waiting"), waiting);
        assert.equal(await worker(page).getAttribute("data-scene"), "focus");
        assert.equal(await page.locator(".worker-action:visible").count(), 0);
        await capture(page, `${name}-steam-${mental}-${fatigue}`);
      }
      await page.evaluate(() => {
        T.session.stepPanel("pull", "吸い出し"); T.session.setBenchDraw(cs, "up", 1400);
        T.session.stepPanel("mix", "配合");
      });
      assert.equal(await worker(page).getAttribute("data-draw"), null, "Previous puff survived a step change");
      assert.equal(await worker(page).getAttribute("data-scene"), "mix");
      assert(!/泡立って/.test(await page.locator(".bench-worker-stage").getAttribute("aria-label")), "Puff aria label survived a step change");
      assert.equal(await page.evaluate(() => JSON.stringify(cs)), before, "Visual state mutated game state");
    }, options);

    await check(`real-puff-${name}`, async page => {
      await init(page); await page.evaluate(async () => {
        await T.open(); cs.mix = { double_apple: 10, mint: 2 }; cs.pack = "normal"; cs.place = "triangle";
        window.pullRun = T.pull.runPull(cs);
      });
      await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor();
      assert.equal(await worker(page).getAttribute("data-scene"), "pull");
      const button = page.locator('[data-test="pull-stop"]');
      if (name === "touch") await button.tap(); else await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector('.bench-worker')?.dataset.draw);
      assert.equal(await worker(page).getAttribute("data-scene"), "inhale");
      assert(await page.locator('.worker-action[data-scene="inhale"]').isVisible());
      assert(Number(await page.locator('[data-test="worker-bubbles"]').evaluate(n => getComputedStyle(n).opacity)) > 0);
      assert(await button.isDisabled());
      const overlap = await page.evaluate(() => {
        const bottle = document.querySelector('.worker-equipment').getBoundingClientRect();
        const thermometer = document.querySelector('.thermo').getBoundingClientRect();
        return bottle.right > thermometer.left;
      });
      assert.equal(overlap, false, "Bottle and bubbles were hidden behind the thermometer");
      await capture(page, `${name}-real-inhale`);
      const duration = await worker(page).evaluate(n => parseFloat(n.style.getPropertyValue("--draw-duration")));
      assert([1400, 1900, 3200].includes(duration), "Existing puff length changed");
      // 無効中の実タップ/Spaceは次の一口にならない。
      if (name === "touch") {
        const r = await button.boundingBox(); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      } else await page.keyboard.press("Space");
      await page.waitForFunction(() => !document.querySelector('.bench-worker')?.dataset.draw);
      assert.equal(await worker(page).getAttribute("data-scene"), "pull");
      // 既存の .15s フェードを、固定sleepでフレーム遅延と混同しない。
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test="worker-bubbles"]')).opacity === "0", null, { timeout: 1500 });
      assert.equal(await page.locator('[data-test="worker-bubbles"]').evaluate(n => getComputedStyle(n).opacity), "0");
      assert.equal(await page.locator('.pull-count .pull-pip.on').count(), 1, "Repeated input added another puff");
      await capture(page, `${name}-real-rest`);
      await assertFits(page, '[data-test="pull-stop"], [data-test="pull-serve"]');
    }, options);
  }

  await check("slow-image-before-heat", async page => {
    await init(page);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/hajime_craft_heat.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => {
        window.cs = T.session.newSession("drill"); T.session.openBench(cs);
        window.heatRun = T.heat.runHeat(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor(); await page.waitForTimeout(350);
      assert(await page.locator(".bench").evaluate(n => n.inert));
      assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Coal clock started before scene load");
      assert.equal(await page.evaluate(() => cs.heat), null);
    } finally { release(); }
    await page.locator('[data-test="coal-0"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-scene"), "heat");
  });

  await check("visible-element-decode-gate", async page => {
    await init(page);
    await page.evaluate(() => {
      const native = HTMLImageElement.prototype.decode;
      const held = new Promise(resolve => { window.releaseDecode = resolve; });
      HTMLImageElement.prototype.decode = function () {
        if (this.classList.contains("worker-action") && /hajime_craft_heat/.test(this.src)) return held.then(() => native.call(this));
        return native.call(this);
      };
      window.cs = T.session.newSession("drill"); T.session.openBench(cs);
      window.heatRun = T.heat.runHeat(cs);
    });
    await page.locator('[data-test="craft-loading"]').waitFor(); await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Only the preload Image was awaited");
    await page.evaluate(() => releaseDecode());
    await page.locator('[data-test="coal-0"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-scene"), "heat");
  });

  await check("broken-scene-real-mix-fallback", async page => {
    await init(page);
    await page.route("**/img/ui/making/hajime_craft_mix.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "broken image" }));
    await page.evaluate(async () => {
      T.state.state.flavors = ["double_apple", "mint"];
      T.state.state.flavorStock = { double_apple: 50, mint: 50 };
      await T.open(); window.mixRun = T.steps.stepMix(cs);
    });
    await page.locator('[data-test="mix-plus-mint"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-art-fallback"), "true");
    assert.equal(await worker(page).getAttribute("data-scene"), "fallback");
    assert(await page.locator(".worker-actor").isVisible());
    for (let i = 0; i < 10; i++) await page.locator('[data-test="mix-plus-double_apple"]').click();
    for (let i = 0; i < 2; i++) await page.locator('[data-test="mix-plus-mint"]').click();
    assert(await page.locator('[data-test="mix-ok"]').isEnabled());
    await page.locator('[data-test="mix-ok"]').click();
    assert.deepEqual(await page.evaluate(() => cs.mix), { double_apple: 10, mint: 2 });
    await capture(page, "failed-scene-usable-mix");
  });

  await check("timeout-then-late-image-stays-fallback", async page => {
    await init(page);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/hajime_craft_mix.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => { window.openRun = T.open(); });
      await page.locator('[data-test="craft-loading"]').waitFor();
      await page.waitForTimeout(350);
      assert(await page.locator(".bench").evaluate(n => n.inert));
      await page.locator('[data-test="craft-loading"]').waitFor({ state: "detached", timeout: 18000 });
      await page.evaluate(() => { T.session.stepPanel("mix", "配合"); });
      assert.equal(await worker(page).getAttribute("data-art-fallback"), "true");
    } finally { release(); }
    await page.waitForTimeout(250);
    assert.equal(await worker(page).getAttribute("data-scene"), "fallback", "Late response changed the scene during play");
    assert.equal(await page.locator('.worker-action:visible').count(), 0);
  });

  await check("broken-focus-uses-approved-face", async page => {
    await init(page);
    await page.route("**/img/ui/making/hajime_steam_wait.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "broken image" }));
    await page.evaluate(async () => { await T.open(); T.session.stepPanel("steam", "蒸らし"); });
    assert.equal(await worker(page).getAttribute("data-waiting"), "false");
    assert.match(await page.locator(".worker-actor").getAttribute("src"), /chr_hajime_serious/);
    assert(await page.locator(".worker-actor").evaluate(n => n.complete && n.naturalWidth > 0));
    assert.match(await page.locator(".bench-worker-stage").getAttribute("aria-label"), /集中/);
    await capture(page, "failed-focus-approved-face");
  });

  await check("browser-without-decode", async page => {
    await init(page);
    await page.evaluate(async () => {
      HTMLImageElement.prototype.decode = undefined;
      await T.open(); T.session.stepPanel("holes", "アルミ穴あけ");
    });
    assert.equal(await worker(page).getAttribute("data-scene"), "holes");
    assert(await page.locator('.worker-action:visible').evaluate(n => n.complete && n.naturalWidth > 0));
  });

  await check("reduced-motion-cues", async page => {
    await init(page); await page.evaluate(() => T.open());
    await page.evaluate(() => { T.session.stepPanel("pull", "吸い出し"); T.session.setBenchDraw(cs, "down", 3200); bench.worker.flinch(); });
    assert.equal(await worker(page).getAttribute("data-scene"), "inhale");
    assert.equal(await page.locator(".worker-actions").evaluate(n => getComputedStyle(n).animationName), "none");
    assert.equal(await page.locator(".worker-water i").first().evaluate(n => getComputedStyle(n).animationName), "none");
    assert.equal(await page.locator(".worker-water i").first().evaluate(n => getComputedStyle(n).opacity), "0.7");
    await page.evaluate(() => { T.session.stepPanel("steam", "蒸らし"); });
    assert.equal(await page.locator(".worker-actor").evaluate(n => getComputedStyle(n).animationName), "none");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
});
