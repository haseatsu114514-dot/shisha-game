import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
const shots = process.env.SHOTS || ".codex/artifacts/remake-browser/presentation";
fs.mkdirSync(shots, { recursive: true });
const select = (page, selector, touch) => touch ? page.locator(selector).tap() : page.locator(selector).click();

async function setup(page) {
  await page.evaluate(async () => {
    window.V = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      cold: await import("./js/scenes/coldopen.js"), vn: await import("./js/vn/engine.js"),
      craft: await import("./js/craft/session.js"), steps: await import("./js/craft/steps.js"),
      result: await import("./js/craft/result.js"), recognition: await import("./js/craft/recognition.js"),
      ui: await import("./js/core/ui.js") };
    V.core.newGame(); V.ui.clearScreen();
  });
}
await suite("ch1-presentation", async check => {
  for (const [device, touch, options] of [["pc", false, { reducedMotion: "reduce" }],
    ["touch", true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }]]) {
    await check(`${device}-cold-open`, async page => {
      await setup(page);
      await page.evaluate(async () => { V.before = JSON.stringify(V.core.state); V.previous = V.vn.hooks.onLine; V.scene = V.cold.mountColdOpen(); await V.scene.ready; });
      assert.equal(await page.locator(".co-crowd, .co-beams, .co-stage").count(), 0);
      for (const [shot, fragment] of [["smoke", null], ["hand", "提供されます"], ["reaction", "誰かが呟いた"], ["fill", "会場を満たして"]]) {
        await page.evaluate(fragment => {
          if (fragment) {
            const line = V.data.DB.dialogues.ch1_cold_open.lines.find(l => l.text?.includes(fragment));
            V.vn.hooks.onLine("ch1_cold_open", line);
          }
        }, fragment);
        assert.equal(await page.locator('[data-test="cold-open"]').getAttribute("data-shot"), shot);
        await page.screenshot({ path: `${shots}/${device}-cold-${shot}.png` });
      }
      await page.evaluate(() => V.vn.hooks.onLine("other-scene", { text: "1年前" }));
      assert.equal(await page.locator(".cold-open.out").count(), 0);
      const after = await page.evaluate(() => { V.scene.stop(); return { restored: V.vn.hooks.onLine === V.previous, state: JSON.stringify(V.core.state) === V.before }; });
      assert(after.restored && after.state); await page.waitForTimeout(1000);
      assert.equal(await page.locator(".cold-open").count(), 0);
    }, options);
    for (const mode of ["tutorial", "drill"]) await check(`${device}-${mode}-mix-and-basic-taste`, async page => {
      await setup(page);
      await page.evaluate(async mode => {
        // Normal practice uses owned mint; the first lesson supplies its two flavors.
        if (mode === "drill") { V.core.state.flavors.push("mint"); V.core.state.flavorStock.mint = 50; }
        V.stockBefore = JSON.stringify(V.core.state.flavorStock);
        V.cs = V.craft.newSession(mode); await V.craft.openBench(V.cs).ready;
        V.running = V.steps.stepMix(V.cs);
      }, mode);
      await page.locator('[data-test="mix-plus-double_apple"]').waitFor();
      assert.equal(await page.locator(".bowl-layers").count(), 0);
      const preview = page.locator('[data-test="mix-temperature-preview"]');
      assert.equal(await preview.count(), 1, "The preview stays mounted in both modes");
      assert.equal(await preview.isVisible(), mode !== "tutorial", "Only the first lesson hides the preview");
      assert.equal(await page.locator('[data-test="mix-temperature"]').isVisible(), mode !== "tutorial");
      assert.match(await page.locator('.mix-temperature-legend').textContent(), /未選択/);
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /どんな一服/);
      for (const [id, times] of [["double_apple", 10], ["mint", 2]]) for (let i = 0; i < times; i++) await select(page, `[data-test="mix-plus-${id}"]`, touch);
      await assertFits(page, ".mix-vessel, .mix-taste, .mix-footer, .fr-btn");
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /アニス.*ミント/);
      assert.equal(await preview.isVisible(), mode !== "tutorial", "Adding leaves preserves the mode's visibility");
      await page.screenshot({ path: `${shots}/${device}-${mode}-mix-basic.png` });
      if (mode !== "tutorial") await assertFits(page, ".mix-temperature, .mix-temperature-legend");
      await page.screenshot({ path: `${shots}/${device}-${mode}-mix-temperature.png` });
      await select(page, '[data-test="mix-ok"]', touch); await page.evaluate(() => V.running);
      await page.evaluate(() => { V.running = V.steps.stepPack(V.cs); });
      await page.locator('[data-test="opt-normal"]').waitFor();
      assert.match(await page.locator('[data-test="mix-confirmed-taste"]').textContent(), /アニス.*後味/);
      await select(page, '[data-test="opt-normal"]', touch);
      await select(page, '[data-test="pack-confirm"]', touch); await page.evaluate(() => V.running);
      assert.deepEqual(await page.evaluate(() => V.cs.mix), { double_apple: 10, mint: 2 });
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.double_apple), 50);
      assert(await page.evaluate(() => JSON.stringify(V.core.state.flavorStock) === V.stockBefore));
    }, options);
    await check(`${device}-many-flavors-and-regulation`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        for (const id of ["blueberry", "lemon", "vanilla", "coconut", "mango", "grape"]) { V.core.state.flavors.push(id); V.core.state.flavorStock[id] = 30; }
        V.cs = V.craft.newSession("tournament"); await V.craft.openBench(V.cs).ready; V.running = V.steps.stepMix(V.cs);
      });
      await page.locator('[data-test="mix-plus-mint"]').waitFor();
      await assertFits(page, ".mix-vessel, .mix-taste, .mix-footer");
      const list = await page.locator(".mix-list").evaluate(n => ({ scroll: n.scrollHeight > n.clientHeight,
        horizontalFits: n.scrollWidth <= n.clientWidth + 1, overflow: getComputedStyle(n).overflowY }));
      assert(list.scroll && list.horizontalFits && list.overflow === "auto");
      await select(page, '[data-test="mix-plus-grape"]', touch);
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /グレープ/);
      for (let i = 0; i < 9; i++) await select(page, '[data-test="mix-plus-grape"]', touch);
      assert(await page.locator('[data-test="mix-ok"]').isDisabled());
      for (let i = 0; i < 2; i++) await select(page, '[data-test="mix-plus-mint"]', touch);
      assert(!await page.locator('[data-test="mix-ok"]').isDisabled());
      await select(page, '[data-test="mix-ok"]', touch); await page.evaluate(() => V.running);
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.grape), 20);
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.mint), undefined); // Real supplied mint, not owned stock.
    }, options);
    await check(`${device}-gift-bowl-leaf-plane`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        V.cs = V.craft.newSession("tutorial"); V.cs.equip.bowl = "suyaki_tsumugi";
        await V.craft.openBench(V.cs).ready; V.running = V.steps.stepMix(V.cs);
      });
      await page.locator('[data-test="mix-plus-double_apple"]').waitFor();
      await select(page, '[data-test="mix-plus-double_apple"]', touch);
      const plane = await page.locator(".mix-vessel-art").evaluate(n => {
        const bowl = n.querySelector(".art").getBoundingClientRect(), leaf = n.querySelector(".mix-clay-leaves").getBoundingClientRect();
        return { center: (leaf.top + leaf.bottom) / 2, top: bowl.top, height: bowl.height, leafWidth: leaf.width, bowlWidth: bowl.width };
      });
      assert(plane.center > plane.top && plane.center < plane.top + plane.height / 2, "Leaves floated above the gift bowl");
      assert(plane.leafWidth < plane.bowlWidth);
      await page.screenshot({ path: `${shots}/${device}-mix-gift-bowl.png` });
    }, options);
    await check(`${device}-recognition-keeps-votes`, async page => {
      await setup(page);
      await page.evaluate(() => {
        V.cs = { heat: { score: 100 }, holes: { score: 20 }, mix: { double_apple: 10, mint: 2 } };
        V.table = JSON.stringify(V.result.pointTable(1));
        V.running = V.result.showStandings(1, 60, V.cs);
      });
      await page.locator('[data-test="standings-recognition"]').waitFor();
      await assertFits(page, ".sd-recognition");
      assert.match(await page.locator('[data-test="standings-recognition"]').textContent(), /焼き炭/);
      assert.equal(await page.locator('.sd-row[data-id="hajime"] .sd-points').textContent(), "0pt");
      await page.waitForTimeout(100); await page.screenshot({ path: `${shots}/${device}-recognition.png` });
      await page.evaluate(() => V.running);
      assert(await page.evaluate(() => V.table === JSON.stringify(V.result.pointTable(1))));
    }, options);
  }
});
