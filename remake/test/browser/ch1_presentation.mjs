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
      await page.evaluate(() => {
        const line = V.data.DB.dialogues.ch1_cold_open.lines.find(l => l.text?.includes("あの頃、tonariで"));
        if (!line) throw new Error("Missing flashback cue");
        V.vn.hooks.onLine("ch1_cold_open", line);
      });
      assert.equal(await page.locator(".cold-open.out").count(), 1);
      const after = await page.evaluate(() => { V.scene.stop(); return { restored: V.vn.hooks.onLine === V.previous, state: JSON.stringify(V.core.state) === V.before }; });
      assert(after.restored && after.state); await page.waitForTimeout(1000);
      assert.equal(await page.locator(".cold-open").count(), 0);
    }, options);
    await check(`${device}-mix-and-basic-taste`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        V.cs = V.craft.newSession("tutorial"); await V.craft.openBench(V.cs).ready;
        V.running = V.steps.stepMix(V.cs);
      });
      await page.locator('[data-test="mix-plus-double_apple"]').waitFor();
      assert.equal(await page.locator(".bowl-layers").count(), 0);
      assert(await page.locator('[data-test="mix-temperature-preview"]').isHidden());
      assert(await page.locator('.mix-temperature').isHidden());
      assert.match(await page.locator('.mix-temperature-legend').textContent(), /未選択/);
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /どんな一服/);
      for (const [id, times] of [["double_apple", 10], ["mint", 2]]) for (let i = 0; i < times; i++) await select(page, `[data-test="mix-plus-${id}"]`, touch);
      await assertFits(page, ".mix-vessel, .mix-taste, .mix-footer, .fr-btn");
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /アニス.*ミント/);
      await page.screenshot({ path: `${shots}/${device}-mix-basic.png` });
      assert(await page.locator('[data-test="mix-temperature-preview"]').isHidden());
      assert(await page.locator('.mix-temperature').isHidden());
      await page.screenshot({ path: `${shots}/${device}-mix-initial-no-temperature.png` });
      await select(page, '[data-test="mix-ok"]', touch); await page.evaluate(() => V.running);
      await page.evaluate(() => { V.running = V.steps.stepPack(V.cs); });
      await page.locator('[data-test="opt-normal"]').waitFor();
      assert.match(await page.locator('[data-test="mix-confirmed-taste"]').textContent(), /アニス.*後味/);
      await select(page, '[data-test="opt-normal"]', touch);
      await select(page, '[data-test="pack-confirm"]', touch); await page.evaluate(() => V.running);
      assert.deepEqual(await page.evaluate(() => V.cs.mix), { double_apple: 10, mint: 2 });
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.double_apple ?? 0), 0);
    }, options);
    await check(`${device}-many-flavors-and-regulation`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        for (const id of ["blueberry", "lemon", "vanilla", "coconut", "mango", "grape"]) { V.core.state.flavors.push(id); V.core.state.flavorStock[id] = 30; }
        V.cs = V.craft.newSession("tournament"); await V.craft.openBench(V.cs).ready; V.running = V.steps.stepMix(V.cs);
      });
      await page.locator('[data-test="mix-plus-lemon"]').waitFor();
      assert(await page.locator('[data-test="mix-temperature-preview"]').isVisible());
      assert.match(await page.locator('.mix-temperature-legend').textContent(), /未選択/);
      await assertFits(page, ".mix-temperature-preview, .mix-temperature, .mix-temperature-legend");
      await assertFits(page, ".mix-vessel, .mix-taste, .mix-footer");
      const list = await page.locator(".mix-list").evaluate(n => ({ scroll: n.scrollHeight > n.clientHeight,
        horizontalFits: n.scrollWidth <= n.clientWidth + 1, overflow: getComputedStyle(n).overflowY }));
      assert(list.scroll && list.horizontalFits && list.overflow === "auto");
      await select(page, '[data-test="mix-plus-grape"]', touch);
      assert.match(await page.locator('[data-test="mix-taste"]').textContent(), /グレープ/);
      for (let i = 0; i < 9; i++) await select(page, '[data-test="mix-plus-grape"]', touch);
      assert(await page.locator('[data-test="mix-ok"]').isDisabled());
      for (let i = 0; i < 2; i++) await select(page, '[data-test="mix-plus-lemon"]', touch);
      assert(!await page.locator('[data-test="mix-ok"]').isDisabled());
      await assertFits(page, ".mix-temperature-preview, .mix-temperature, .mix-temperature-legend");
      await select(page, '[data-test="mix-ok"]', touch); await page.evaluate(() => V.running);
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.grape), 20);
      assert.equal(await page.evaluate(() => V.core.state.flavorStock.lemon), 30); // 課題のレモンは大会支給（オーナー決定 2026-10-28）で私物在庫は減らない。
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
      assert.match(await page.locator('[data-test="standings-recognition"]').textContent(), /コンロの上で、炭は角まで赤く焼けていた/);
      assert.equal(await page.locator('.sd-row[data-id="hajime"] .sd-points').textContent(), "1pt");
      await page.waitForTimeout(100); await page.screenshot({ path: `${shots}/${device}-recognition.png` });
      await page.evaluate(() => V.running);
      assert(await page.evaluate(() => V.table === JSON.stringify(V.result.pointTable(1))));
    }, options);
  }
});
