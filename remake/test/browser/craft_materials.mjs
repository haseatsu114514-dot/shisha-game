// #533: 見比べて確定・針穴の残留・目印と光の分離を本番の工程で操作する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits, storageSnapshot, baseURL } from "./support.mjs";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const click = (page, selector, touch) => touch ? page.locator(selector).tap() : page.locator(selector).click();
async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.F = { core, session: await import("./js/craft/session.js"), steps: await import("./js/craft/steps.js"),
      holes: await import("./js/craft/holes.js"), common: await import("./js/craft/common.js") };
    F.cs = F.session.newSession("tutorial"); F.cs.mix = { double_apple: 10, mint: 2 };
    await F.session.openBench(F.cs).ready;
  });
}
await suite("craft-materials", async check => {
  for (const [device, touch, options] of [["pc", false, {}], ["touch", true,
    { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }]]) {
    await check(`${device}-chapter-five-exact-12g`, async page => {
      for (const bowl of ["silicone_bowl", "hagal_80beat", "suyaki_hagal"]) {
        await page.evaluate(async bowl => {
          const core = await import("./js/core/state.js"), session = await import("./js/craft/session.js");
          const steps = await import("./js/craft/steps.js"), ui = await import("./js/core/ui.js");
          const s = core.newGame(); s.chapter = 5;
          s.owned.push("hagal_80beat", "suyaki_hagal");
          ui.clearScreen(); session.craftTest.auto = null;
          window.F = { core, steps, session, cs: session.newSession("tournament") };
          F.cs.orderFlavorIds = ["double_apple"];
          session.openBench(F.cs, { steps: [["setup", "機材"], ["mix", "配合"]] });
          F.beforeStock = JSON.stringify(s.flavorStock);
          F.running = (async () => { await steps.stepSetup(F.cs); await steps.stepMix(F.cs); })();
        }, bowl);
        await click(page, `[data-test="opt-${bowl}"]`, touch);
        const plus = '[data-test="mix-plus-double_apple"]', minus = '[data-test="mix-minus-double_apple"]';
        const ok = page.locator('[data-test="mix-ok"]');
        await ok.waitFor();
        assert.equal(await page.locator('.flavor-row').count(), 1, "Only the supplied double apple is offered");
        for (let i = 0; i < 11; i++) await click(page, plus, touch);
        assert(await ok.isDisabled(), "11g is short");
        await click(page, plus, touch);
        assert(!(await ok.isDisabled()), "12g is valid");
        assert.match(await page.locator('.reg-line').innerText(), /^✓/);
        const cap = await page.evaluate(async () => (await import("./js/core/data.js")).DB.equipById[F.cs.equip.bowl].capacity);
        if (cap > 12) {
          for (let grams = 13; grams <= cap; grams++) {
            await click(page, plus, touch);
            assert(await ok.isDisabled(), `${grams}g must not commit`);
            assert.match(await page.locator('.reg-line').innerText(), /^✗/);
          }
          for (let grams = cap; grams > 12; grams--) await click(page, minus, touch);
        }
        assert(!(await ok.isDisabled()), "Returning to 12g restores confirmation");
        await click(page, '[data-test="mix-ok"]', touch);
        const result = await page.evaluate(async () => {
          await F.running;
          return { mix: F.cs.mix, regOk: F.cs.mixInfo.regOk, stock: JSON.stringify(F.core.state.flavorStock), beforeStock: F.beforeStock };
        });
        assert.deepEqual(result.mix, { double_apple: 12 }); assert.equal(result.regOk, true);
        assert.equal(result.stock, result.beforeStock, "The supplied match leaf does not consume private stock");
      }
    }, options);
    await check(`${device}-packing`, async page => {
      await setup(page);
      for (const bowl of ["silicone_bowl", "hagal_80beat", "suyaki_tsumugi"]) {
        const before = await page.evaluate(bowl => {
          F.cs.equip.bowl = bowl; F.cs.pack = null;
          F.before = JSON.stringify(F.core.state); F.mix = JSON.stringify(F.cs.mix);
          F.running = F.steps.stepPack(F.cs);
          return { state: F.before, mix: F.mix };
        }, bowl);
        await page.locator('[data-test="pack-confirm"]').waitFor();
        const variants = [];
        for (const pack of ["normal", "fluffy", "firm"]) {
          await click(page, `[data-test="opt-${pack}"]`, touch);
          assert.equal(await page.locator(`[data-test="opt-${pack}"]`).getAttribute("aria-pressed"), "true");
          assert.equal(await page.locator('[data-test="pack-vessel"]').getAttribute("data-pack"), pack);
          assert.equal(await page.evaluate(() => F.cs.pack), null, "Comparing committed the choice");
          variants.push(await page.locator(".pack-vessel-art").evaluate(n => [...n.children].map(c => c.style.backgroundImage).join(" ")));
          await assertFits(page, ".pack-aroma, .pack-vessel-art, .pack-caption, .pack-choice, .pack-footer");
          if (bowl === "silicone_bowl" || pack === "normal") await capture(page, `${device}-pack-${bowl}-${pack}`);
        }
        assert.equal(new Set(variants).size, 3, "Leaf surfaces did not change");
        // Native keyboard confirmation also works; touch uses real pointer input.
        if (touch) await click(page, '[data-test="pack-confirm"]', true);
        else { await page.locator('[data-test="pack-confirm"]').focus(); await page.keyboard.press("Enter"); }
        await page.evaluate(() => F.running);
        assert.equal(await page.locator(".pack-choice:disabled").count(), 3, "Confirmed packing can still be changed on screen");
        const after = await page.evaluate(() => ({ pack: F.cs.pack, state: JSON.stringify(F.core.state), mix: JSON.stringify(F.cs.mix) }));
        assert.equal(after.pack, "firm"); assert.equal(after.state, before.state); assert.equal(after.mix, before.mix);
      }
    }, options);
    await check(`${device}-foil`, async page => {
      await setup(page);
      await page.evaluate(() => {
        F.clock = 1000;
        Object.defineProperty(performance, "now", { configurable: true, value: () => F.clock });
        const raf = requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => raf(() => callback(F.clock));
        F.running = F.holes.runHoles(F.cs);
      });
      await click(page, '.bench-demo-skip', touch);
      await click(page, '[data-test="hole-template-outer12-middle12"]', touch);
      assert.equal(await page.locator('.ht-option').count(), 1);
      assert.equal(await page.locator(".ht-preview .foil-hole").count(), 0, "Template already has punched holes");
      assert.equal(await page.locator(".ht-preview .foil-marker").count(), 24);
      assert.match(await page.locator(".ht-preview .foil-surface").evaluate(n => n.style.backgroundImage), /foil_interactive_top/);
      const center = await page.locator('.ht-preview').evaluate(n => {
        const disc=n.getBoundingClientRect(), plane=n.querySelector('.foil-target-plane').getBoundingClientRect();
        return ((plane.top+plane.bottom)/2-disc.top)/disc.height;
      });
      assert(Math.abs(center-.47)<.001, 'Foil targets must sit above the lower crimped rim');
      await capture(page, `${device}-foil-template`);
      await click(page, '[data-test="hole-start"]', touch);
      await page.locator(".countdown").waitFor(); await page.locator(".countdown").waitFor({ state: "detached" });
      await assertFits(page, ".foil, .foil-legend, .hr-side, .hr-punch, .hr-row");
      const turnTo = async (ring, k, turn = 0) => {
        await page.evaluate(async ({ ring, k, turn }) => {
          const period = F.holes.RINGS.find(r => r.id === ring).period * F.common.skill.slow(F.cs) * 1.3;
          F.clock = 1000 + period * (turn + k / 12) * 1000;
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        }, { ring, k, turn });
      };
      for (let k = 0; k < 12; k++) {
        await turnTo("outer", k);
        assert.equal(await page.locator(".foil-markers .foil-marker.next").count(), 1);
        const gap = await page.evaluate(() => {
          const a = document.querySelector(".foil-markers .next").getBoundingClientRect(), b = document.querySelector("[data-test=foil] .foil-cursor").getBoundingClientRect();
          return Math.hypot((a.left + a.right - b.left - b.right) / 2, (a.top + a.bottom - b.top - b.bottom) / 2);
        });
        assert(gap < 1, `Next marker disagrees with the scoring target: ${gap}px`);
        if (touch) await click(page, '[data-test="hole-punch"]', true); else await page.keyboard.press("Space");
      }
      assert.equal(await page.locator(".foil-holes .foil-hole.perfect").count(), 12);
      assert(await page.locator('[data-test="hole-punch"]').isDisabled());
      assert(await page.locator('[data-test="foil"] .foil-cursor').isHidden());
      const locations = await page.locator(".foil-holes .foil-hole").evaluateAll(ns => ns.map(n => [n.style.left, n.style.top]));
      await capture(page, `${device}-foil-outer-complete`);
      await click(page, '[data-test="hole-next"]', touch);
      assert.deepEqual(await page.locator(".foil-holes .foil-hole").evaluateAll(ns => ns.map(n => [n.style.left, n.style.top])), locations);
      await turnTo("middle", .48, 2);
      await click(page, '[data-test="foil"]', touch); // Off-target puncture: its mark must remain too.
      assert.equal(await page.locator(".foil-holes .foil-hole.miss").count(), 1);
      for (let k = 1; k <= 12; k++) {
        await turnTo("middle", k, 2);
        await click(page, '[data-test="hole-punch"]', touch);
        if (k === 3) await capture(page, `${device}-foil-punches`);
      }
      assert.equal(await page.locator(".foil-holes .foil-hole").count(), 25);
      assert.equal(await page.locator(".foil-markers .next").count(), 0);
      assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 25, "Hand illustration lost the real holes");
      assert(!await page.locator('[data-test="hole-done"]').isDisabled());
      const finalBar = await page.locator('.hr-time-bar b').evaluate(n=>n.style.width);
      await page.evaluate(async () => {
        F.clock += 60000;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      assert.equal(await page.locator('.hr-time-bar b').evaluate(n=>n.style.width),finalBar);
      assert.equal(await page.evaluate(()=>F.cs.holes),null,'Completed foil advanced without confirmation');
      assert.equal(await page.locator('[data-test="step-next"]').count(),0);
      await click(page, '[data-test="hole-done"]', touch);
      await page.waitForFunction(() => F.cs.holes !== null);
      const result = await page.evaluate(() => ({ template: F.cs.holes.templateId, outer: F.cs.holes.outer, middle: F.cs.holes.middle, inner: F.cs.holes.inner }));
      assert.deepEqual(result, { template: "outer12-middle12", outer: 12, middle: 13, inner: 0 });
      await click(page, '[data-test="step-next"]', touch);
      await page.evaluate(()=>F.running);
    }, options);
    await check(`${device}-preview-isolated`, async page => {
      await page.evaluate(() => { localStorage.setItem("craft-preview-sentinel", "keep"); sessionStorage.setItem("craft-preview-sentinel", "keep"); });
      const before = await storageSnapshot(page);
      await page.goto(new URL("craft-preview.html", baseURL).href);
      await page.locator('[data-test="pack-confirm"]').waitFor();
      await click(page, '[data-test="opt-fluffy"]', touch);
      await click(page, '[data-test="pack-confirm"]', touch);
      await click(page, '.bench-demo-skip', touch);
      await page.locator('[data-test="hole-start"]').waitFor();
      await page.locator('[data-preview-step="holes"]').click();
      await click(page, '.bench-demo-skip', touch);
      await page.locator('[data-test="hole-start"]').waitFor();
      assert.equal(await page.locator(".foil-cursor").count(), 0);
      await page.locator('[data-preview-step="pack"]').click();
      await page.locator('[data-test="pack-confirm"]').waitFor();
      assert.deepEqual(await storageSnapshot(page), before);
      await capture(page, `${device}-preview`);
    }, options);
  }
  await check("automatic-packing", async page => {
    await setup(page);
    await page.evaluate(async () => { F.session.craftTest.auto = "good"; await F.steps.stepPack(F.cs); F.session.craftTest.auto = null; });
    assert.equal(await page.evaluate(() => F.cs.pack), "normal");
  });
});
