// #402: 本番の素材待ち・工程/表情・一口/泡の同期をPCと実タッチイベントで検証。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function init(page) {
  await page.evaluate(async () => {
    (await import("./js/craft/session.js")).craftTest.autoLoading = true;
    const state = await import("./js/core/state.js"); state.newGame();
    window.T = {
      state, session: await import("./js/craft/session.js"),
      heat: await import("./js/craft/heat.js"), pull: await import("./js/craft/pull.js"), holes: await import("./js/craft/holes.js"),
      steps: await import("./js/craft/steps.js"),
    };
    T.show = async (step, title) => {
      await T.session.waitBenchReady(cs, step);
      return T.session.stepPanel(step, title);
    };
    T.open = async () => {
      window.cs = T.session.newSession("drill");
      window.bench = T.session.openBench(cs);
      await T.session.waitBenchReady(cs);
    };
  });
}
const worker = page => page.locator('[data-test="worker-window"]');
async function orientForTouch(page, options) {
  if (options.viewport?.height <= options.viewport?.width || !options.hasTouch) return;
  // 既存仕様は横向き。縦向きの回転案内を確認し、実際に向きを変えて操作する。
  assert(await page.locator("#rotate-hint").isVisible());
  await capture(page, "touch-portrait-rotate-guide");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#rotate-hint").waitFor({ state: "hidden" });
}
async function startHoles(page) {
  await page.evaluate(async () => { window.holesRun = T.holes.runHoles(cs); });
  await page.locator('[data-test="hole-start"]').click();
  await page.locator(".countdown").waitFor();
  await page.locator(".countdown").waitFor({ state: "detached" });
}
async function assertHolePositions(page) {
  const { actual, painted } = await page.evaluate(async () => ({
    actual: [...document.querySelectorAll(".foil-holes .foil-hole")].map(n => [(parseFloat(n.style.left) - 50) / 50, (parseFloat(n.style.top) - 50) / 50]),
    painted: [...document.querySelectorAll(".worker-punch-dots ellipse")].map(n => [Number(n.dataset.x), Number(n.dataset.y)]),
  }));
  assert.equal(painted.length, actual.length);
  actual.forEach(([x, y], i) => {
    // CSSOMは%を有限桁へ丸める。画面上で0.01px未満の差を許す。
    assert(Math.abs(x - painted[i][0]) < 1e-5 && Math.abs(y - painted[i][1]) < 1e-5, `Painted hole diverged: ${JSON.stringify({ actual: [x, y], painted: painted[i] })}`);
  });
}

await suite("worker-scenes", async check => {
  for (const [name, options] of [
    ["pc", {}],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["touch-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`steps-faces-${name}`, async page => {
      await init(page); await page.evaluate(async () => T.open());
      await orientForTouch(page, options);
      const before = await page.evaluate(async () => JSON.stringify(cs));
      for (const step of ["mix", "pack", "holes", "heat", "pull", "care"]) {
        await page.evaluate(async step => await T.show(step, step), step);
        assert.equal(await worker(page).getAttribute("data-scene"), step === "care" ? "pull" : step);
        assert.equal(await page.locator(".worker-action:visible").count(), 1);
        assert(await page.locator(".worker-action:visible").evaluate(img => img.complete && img.naturalWidth > 0));
        await assertFits(page, ".worker-action:visible");
        await capture(page, `${name}-${step}`);
      }
      await page.evaluate(async () => await T.show("steam", "蒸らし"));
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
      await page.evaluate(async () => {
        await T.show("pull", "吸い出し"); T.session.setBenchDraw(cs, "up", 1400);
        await T.show("mix", "配合");
      });
      assert.equal(await worker(page).getAttribute("data-draw"), null, "Previous puff survived a step change");
      assert.equal(await worker(page).getAttribute("data-scene"), "mix");
      assert(!/泡立って/.test(await page.locator(".bench-worker-stage").getAttribute("aria-label")), "Puff aria label survived a step change");
      assert.equal(await page.evaluate(async () => JSON.stringify(cs)), before, "Visual state mutated game state");
    }, options);

    await check(`real-puff-${name}`, async page => {
      await init(page); await page.evaluate(async () => {
        await T.open(); cs.mix = { double_apple: 10, mint: 2 }; cs.pack = "normal"; cs.place = "triangle";
      });
      await orientForTouch(page, options);
      await page.evaluate(async () => { window.pullRun = T.pull.runPull(cs); });
      await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor();
      assert.equal(await worker(page).getAttribute("data-scene"), "pull");
      const button = page.locator('[data-test="pull-stop"]');
      if (options.hasTouch) await button.tap(); else await page.keyboard.press("Space");
      await page.waitForFunction(() => document.querySelector('.bench-worker')?.dataset.draw);
      assert.equal(await worker(page).getAttribute("data-scene"), "inhale");
      assert(await page.locator('.worker-action[data-scene="inhale"]').isVisible());
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test="worker-bubbles"]')).opacity) > 0, null, { timeout: 1000 });
      assert(Number(await page.locator('[data-test="worker-bubbles"]').evaluate(n => getComputedStyle(n).opacity)) > 0);
      assert(await button.isDisabled());
      // 無効中の実タップ/Spaceは次の一口にならない。
      if (options.hasTouch) {
        const r = await button.boundingBox(); await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      } else await page.keyboard.press("Space");
      const overlap = await page.evaluate(async () => {
        const bottle = document.querySelector('.worker-equipment').getBoundingClientRect();
        const thermometer = document.querySelector('.thermo').getBoundingClientRect();
        return bottle.right > thermometer.left;
      });
      assert.equal(overlap, false, "Bottle and bubbles were hidden behind the thermometer");
      await capture(page, `${name}-real-inhale`);
      const duration = await worker(page).evaluate(n => parseFloat(n.style.getPropertyValue("--draw-duration")));
      assert([1400, 1900, 3200].includes(duration), "Existing puff length changed");
      await page.waitForFunction(() => !document.querySelector('.bench-worker')?.dataset.draw);
      assert.equal(await worker(page).getAttribute("data-scene"), "pull");
      // 既存の .15s フェードを、固定sleepでフレーム遅延と混同しない。
      await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test="worker-bubbles"]')).opacity === "0", null, { timeout: 1500 });
      assert.equal(await page.locator('[data-test="worker-bubbles"]').evaluate(n => getComputedStyle(n).opacity), "0");
      assert.equal(await page.locator('.pull-count .pull-pip.on').count(), 1, "Repeated input added another puff");
      await capture(page, `${name}-real-rest`);
      await assertFits(page, '[data-test="pull-stop"], [data-test="pull-serve"]');
    }, options);

    await check(`real-hole-punch-${name}`, async page => {
      await init(page); await page.evaluate(async () => T.open()); await orientForTouch(page, options); await startHoles(page);
      assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 0, "Foil already had baked-in holes");
      // 入力イベント内で接触フレームの針先と、その瞬間の実穴を記録する。
      await page.evaluate(async () => {
        const { FOIL_VIEW: v } = await import("./js/craft/worker-holes.js");
        document.querySelector('[data-test="hole-punch"]').addEventListener("pointerdown", () => {
          const punch = document.querySelector(".worker-punch");
          const rect = punch.querySelector('[data-pose="contact"]').getBoundingClientRect();
          const scale = Math.min(rect.width / v.width, rect.height / v.height);
          const dot = punch.querySelector("ellipse:last-child").getBoundingClientRect();
          window.tipSample = {
            pose: punch.dataset.pose,
            tip: [rect.left + (rect.width - v.width * scale) / 2 + v.tipX * scale, rect.top + (rect.height - v.height * scale) / 2 + v.tipY * scale],
            hole: [dot.left + dot.width / 2, dot.top + dot.height / 2],
          };
        });
      });
      const button = page.locator('[data-test="hole-punch"]');
      if (options.hasTouch) await button.tap(); else await button.click();
      const sample = await page.evaluate(async () => tipSample);
      assert.equal(sample.pose, "contact");
      assert(Math.hypot(sample.tip[0] - sample.hole[0], sample.tip[1] - sample.hole[1]) < 1, "Needle tip missed the new hole");
      if (options.hasTouch) { await button.tap(); await button.tap(); }
      else { await page.keyboard.press("Space"); await page.keyboard.press("Space"); }
      assert.equal(await page.locator(".foil-holes .foil-hole").count(), 3);
      await assertHolePositions(page);
      await page.waitForFunction(() => document.querySelector(".worker-punch")?.dataset.pose === "hover");
      assert.equal(await page.locator(".worker-punch-hand:visible").count(), 1);
      assert.equal(await page.evaluate(async () => cs.holes), null, "Presentation completed the minigame");
      await assertFits(page, '[data-test="hole-punch"], [data-test="hole-done"]');
      await capture(page, `${name}-real-holes`);
      await page.evaluate(async () => await T.show("heat", "炭焼き"));
      assert(await page.locator(".worker-punch").isHidden());
      await page.evaluate(async () => await T.show("holes", "アルミ穴あけ"));
      assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 0, "Previous foil holes survived a retry");
    }, options);
  }

  await check("punch-flipbook-and-full-foil", async page => {
    await init(page); await page.evaluate(async () => T.open());
    const before = await page.evaluate(async () => JSON.stringify(cs));
    await page.evaluate(async () => await T.show("holes", "アルミ穴あけ"));
    await page.clock.install({ time: new Date("2026-10-12T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-12T12:00:01Z"));
    await page.evaluate(async () => bench.worker.punch({
      dots: Array.from({ length: 24 }, (_, i) => [.8 * Math.cos(i * Math.PI / 12), .8 * Math.sin(i * Math.PI / 12)]), target: [.8, 0],
    }));
    assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 24);
    assert.equal(await page.locator(".worker-punch").getAttribute("data-pose"), "contact");
    await capture(page, "flipbook-contact");
    await page.clock.runFor(90);
    assert.equal(await page.locator(".worker-punch").getAttribute("data-pose"), "release");
    await capture(page, "flipbook-release");
    await page.clock.runFor(90);
    assert.equal(await page.locator(".worker-punch").getAttribute("data-pose"), "hover");
    await capture(page, "flipbook-hover");
    assert.equal(await page.evaluate(async () => JSON.stringify(cs)), before, "Flipbook mutated the gameplay session");
  });

  await check("slow-image-before-heat", async page => {
    await init(page);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/hajime_heat_scene.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(async () => {
        window.cs = T.session.newSession("drill"); T.session.openBench(cs);
        window.heatRun = T.heat.runHeat(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor(); await page.waitForTimeout(350);
      assert(await page.locator(".bench").evaluate(n => n.inert));
      assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Coal clock started before scene load");
      assert.equal(await page.evaluate(async () => cs.heat), null);
    } finally { release(); }
    await page.locator('[data-test="coal-0"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-scene"), "heat");
  });

  await check("visible-element-decode-gate", async page => {
    await init(page);
    await page.evaluate(async () => {
      const native = HTMLImageElement.prototype.decode;
      const held = new Promise(resolve => { window.releaseDecode = resolve; });
      HTMLImageElement.prototype.decode = function () {
        if (this.classList.contains("worker-action") && /hajime_heat_scene/.test(this.src)) return held.then(() => native.call(this));
        return native.call(this);
      };
      window.cs = T.session.newSession("drill"); T.session.openBench(cs);
      window.heatRun = T.heat.runHeat(cs);
    });
    await page.locator('[data-test="craft-loading"]').waitFor(); await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Only the preload Image was awaited");
    await page.evaluate(async () => releaseDecode());
    await page.locator('[data-test="coal-0"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-scene"), "heat");
  });

  await check("slow-punch-frame-gates-real-holes", async page => {
    await init(page);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/hajime_craft_holes_release.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(async () => {
        window.cs = T.session.newSession("drill"); T.session.openBench(cs); window.holesRun = T.holes.runHoles(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor(); await page.waitForTimeout(350);
      assert(await page.locator(".bench").evaluate(n => n.inert));
      assert.equal(await page.locator('[data-test="hole-start"]').count(), 0);
      assert.equal(await page.locator(".countdown").count(), 0);
      assert.equal(await page.evaluate(async () => cs.holes), null);
    } finally { release(); }
    await page.locator('[data-test="hole-start"]').waitFor();
    assert.equal(await worker(page).getAttribute("data-scene"), "holes");
    assert(await page.locator('.worker-punch-hand[data-pose="hover"]').evaluate(n => n.complete && n.naturalWidth > 0));
  });

  await check("broken-punch-frame-complete-fallback", async page => {
    await init(page);
    await page.route("**/img/ui/making/hajime_craft_holes_contact.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "broken image" }));
    await page.evaluate(async () => T.open()); await startHoles(page);
    assert.equal(await worker(page).getAttribute("data-scene"), "fallback");
    assert.equal(await worker(page).getAttribute("data-art-fallback"), "true");
    assert(await page.locator(".worker-punch").isHidden());
    assert(await page.locator(".worker-actor").isVisible());
    await page.locator('[data-test="hole-punch"]').click();
    assert.equal(await page.locator(".foil-holes .foil-hole").count(), 1);
    assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 0);
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
    assert.deepEqual(await page.evaluate(async () => cs.mix), { double_apple: 10, mint: 2 });
    await capture(page, "failed-scene-usable-mix");
  });

  await check("timeout-then-late-image-stays-fallback", async page => {
    await init(page);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/hajime_craft_mix.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(async () => { window.openRun = (async () => { await T.open(); await T.show("mix", "配合"); })(); });
      await page.locator('[data-test="craft-loading"]').waitFor();
      await page.waitForTimeout(350);
      assert(await page.locator(".bench").evaluate(n => n.inert));
      await page.locator('[data-test="craft-loading"]').waitFor({ state: "detached", timeout: 18000 });
      await page.evaluate(async () => { await T.show("mix", "配合"); });
      assert.equal(await worker(page).getAttribute("data-art-fallback"), "true");
    } finally { release(); }
    await page.waitForTimeout(250);
    assert.equal(await worker(page).getAttribute("data-scene"), "fallback", "Late response changed the scene during play");
    assert.equal(await page.locator('.worker-action:visible').count(), 0);
  });

  await check("broken-focus-uses-approved-face", async page => {
    await init(page);
    await page.route("**/img/ui/making/hajime_steam_wait.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "broken image" }));
    await page.evaluate(async () => { await T.open(); await T.show("steam", "蒸らし"); });
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
      await T.open(); await T.show("holes", "アルミ穴あけ");
    });
    assert.equal(await worker(page).getAttribute("data-scene"), "holes");
    assert(await page.locator('.worker-action:visible').evaluate(n => n.complete && n.naturalWidth > 0));
  });

  await check("reduced-motion-cues", async page => {
    await init(page); await page.evaluate(async () => T.open());
    await page.evaluate(async () => { await T.show("pull", "吸い出し"); T.session.setBenchDraw(cs, "down", 3200); bench.worker.flinch(); });
    assert.equal(await worker(page).getAttribute("data-scene"), "inhale");
    assert.equal(await page.locator(".worker-actions").evaluate(n => getComputedStyle(n).animationName), "none");
    assert.equal(await page.locator(".worker-water i").first().evaluate(n => getComputedStyle(n).animationName), "none");
    assert.equal(await page.locator(".worker-water i").first().evaluate(n => getComputedStyle(n).opacity), "0.7");
    await page.evaluate(async () => { await T.show("steam", "蒸らし"); });
    assert.equal(await page.locator(".worker-actor").evaluate(n => getComputedStyle(n).animationName), "none");
    await startHoles(page);
    await page.locator('[data-test="hole-punch"]').tap();
    await assertHolePositions(page);
    assert.equal(await page.locator(".worker-punch").getAttribute("data-pose"), "hover", "Reduced motion played the flipbook");
    assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 1, "Reduced motion hid the new hole");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
});
