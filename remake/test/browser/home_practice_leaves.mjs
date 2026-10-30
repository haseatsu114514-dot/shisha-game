// #783: 店の練習は私物を減らさない。旧ファイル名は既存CIの入口として維持。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
import { confirmAppearanceSetup, prepareAppearanceCatalog } from "./appearance_setup.mjs";
import { confirmWaterSetup } from "./water_setup.mjs";
prepareAppearanceCatalog();
const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function startPractice(page, stock, { auto = "good" } = {}) {
  await page.evaluate(async ({ stock, auto }) => {
    const core = await import("./js/core/state.js");
    const craft = await import("./js/craft/session.js");
    core.newGame(); Object.assign(core.state, { phase: "daily", day: 8, slot: 0, stamina: 80, weatherSeed: 4 });
    core.state.flavorStock = { ...stock }; core.state.flavors = Object.keys(stock);
    core.config.bgmVolume = core.config.seVolume = 0;
    craft.craftTest.auto = auto;
    core.save();
    window.__practice = { done: false };
    // 店イベントと同じ制作本体を呼ぶ。日常の行動・消耗はこのfixtureでは追加しない。
    import("./js/craft/practice.js").then(m => m.runFullPractice())
      .then(cs => { window.__practice = { done: true, mix: cs.mix }; });
  }, { stock, auto });
}
const snapshot = page => page.evaluate(async () => {
  const core = await import("./js/core/state.js");
  return { stock: { ...core.state.flavorStock }, runs: core.state.flags._craft_practice_runs || [],
    saved: JSON.parse(localStorage.getItem(core.SAVE_KEY)).flavorStock };
});

await suite("shop-practice-stock", async check => {
  for (const [label, options] of [["pc", {}], ["touch", touch]]) {
    await check(`${label}-full-practice-save-load-preserves-stock`, async page => {
      const stock = { double_apple: 1, mint: 1 };
      await startPractice(page, stock);
      await page.waitForFunction(() => window.__practice.done, null, { timeout: 120000 });
      const after = await snapshot(page);
      assert.equal(after.runs.length, 1);
      assert.equal(after.runs[0].served, true);
      assert.deepEqual(after.stock, stock, "完成しても私物は減らない");
      assert.deepEqual(after.saved, stock, "途中のオートセーブも私物不変");
      const loaded = await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        core.save(); const auto = core.load().flavorStock;
        localStorage.setItem("suien_remake_slot1", JSON.stringify(core.state));
        const slot = core.loadFromSlot("suien_remake_slot1").flavorStock;
        return { auto, slot, runs: core.state.flags._craft_practice_runs.length };
      });
      assert.deepEqual(loaded, { auto: stock, slot: stock, runs: 1 });
    }, options);

    await check(`${label}-home-menu-absent-with-and-without-rig`, async page => {
      for (const slot of [0, 1]) for (const rig of [false, true]) {
        await page.evaluate(async ({ slot, rig }) => {
          const core = await import("./js/core/state.js"), map = await import("./js/daily/map.js");
          map.interruptMap(null);
          core.newGame(); Object.assign(core.state, { phase: "daily", day: 8, slot, weatherSeed: 4 });
          if (rig) core.state.owned.push("home_rig_set");
          window.__map = map.chooseSpot();
        }, { slot, rig });
        await page.locator('.map:not(.done)').waitFor();
        const pin = page.locator('[data-test="pin-rest"]');
        if (options.hasTouch) await pin.tap(); else await pin.click();
        assert.equal(await page.locator('[data-test="map-home-practice"]').count(), 0);
        assert.equal(await page.locator('[data-test="map-go"]').innerText(), "家に帰る");
      }
    }, options);
  }

  await check("hidden-menu-not-clickable-on-bench", async page => {
    await startPractice(page, { double_apple: 20, mint: 10 }, { auto: null });
    await page.evaluate(async () => {
      (await import("./js/daily/hud.js")).initHud({ phone() {}, status() {}, menu() { throw Error("hidden menu opened"); } });
    });
    await confirmAppearanceSetup(page, { touch: true });
    await confirmWaterSetup(page, { touch: true });
    await page.locator('[data-test="mix-ok"]').waitFor();
    assert.equal(await page.evaluate(() => {
      const m = document.querySelector('[data-test="hud-menu"]'), r = m.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === m || m.contains(top);
    }), false);
  }, touch);

  for (const [name, options] of [["store-leaves-without-own-stock", {}], ["touch-store-leaves-without-own-stock", touch]]) await check(name, async page => {
    await startPractice(page, {}, { auto: null });
    await confirmAppearanceSetup(page, { touch: !!options.hasTouch });
    await confirmWaterSetup(page, { touch: !!options.hasTouch });
    await page.locator('[data-test="mix-ok"]').waitFor();
    const press = locator => options.hasTouch ? locator.tap() : locator.click();
    assert.equal(await page.locator('.flavor-row').count(), 3);
    assert.equal(await page.locator('.fr-stock').count(), 0);
    for (let n = 0; n < 10; n++) await press(page.locator('[data-test="mix-plus-lemon"]'));
    for (let n = 0; n < 2; n++) await press(page.locator('[data-test="mix-plus-mint"]'));
    assert.equal(await page.locator('.flavor-row[data-flavor="lemon"] .fr-g').textContent(), "10g");
    assert.equal(await page.locator('[data-test="mix-ok"]').isEnabled(), true);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await press(page.locator('[data-test="mix-ok"]'));
    await page.waitForFunction(() => window.__practice.done, null, { timeout: 120000 });
    assert.deepEqual(await page.evaluate(() => window.__practice.mix), { lemon: 10, mint: 2 });
    assert.deepEqual((await snapshot(page)).stock, {});
  }, options);

  await check("reload-mid-bench-keeps-save", async page => {
    const stock = { double_apple: 20, mint: 10 };
    await startPractice(page, stock, { auto: null });
    await confirmAppearanceSetup(page);
    await confirmWaterSetup(page);
    await page.locator('[data-test="mix-ok"]').waitFor();
    for (let n = 0; n < 10; n++) await page.locator('[data-test="mix-plus-lemon"]').click();
    for (let n = 0; n < 2; n++) await page.locator('[data-test="mix-plus-mint"]').click();
    await page.locator('[data-test="mix-ok"]').click();
    await page.locator('[data-test="pack-confirm"]').waitFor();
    assert.deepEqual((await snapshot(page)).stock, stock);
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    assert.deepEqual(await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), s = core.load();
      return { stock: s.flavorStock, stamina: s.stamina, runs: s.flags._craft_practice_runs || [] };
    }), { stock, stamina: 80, runs: [] });
    await startPractice(page, stock);
    await page.waitForFunction(() => window.__practice.done, null, { timeout: 120000 });
    assert.deepEqual((await snapshot(page)).stock, stock, "再開して完成しても減らない");
  });

  await check("tournament-caps-and-consumes-only-carried-leaves", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), craft = await import("./js/craft/session.js"), steps = await import("./js/craft/steps.js");
      core.newGame(); core.state.flavorStock = { double_apple: 10, lemon: 3 }; core.state.flavors = ["double_apple", "lemon"];
      craft.craftTest.auto = null;
      window.__mix = craft.newSession("tournament"); craft.openBench(__mix);
      window.__mixDone = false; steps.stepMix(__mix).then(() => { window.__mixDone = true; });
    });
    await page.locator('[data-test="mix-ok"]').waitFor();
    assert.equal(await page.locator('[data-test="mix-plus-blueberry"]').count(), 0);
    for (let n = 0; n < 12; n++) await page.locator('[data-test="mix-plus-double_apple"]').click();
    assert.equal(await page.locator('.flavor-row[data-flavor="double_apple"] .fr-g').textContent(), "10g");
    for (let n = 0; n < 2; n++) await page.locator('[data-test="mix-plus-lemon"]').click();
    await page.locator('[data-test="mix-ok"]').click(); await page.waitForFunction(() => window.__mixDone);
    // 課題のレモンは大会支給で私物から減らない（オーナー決定 2026-10-28・9e99f279, Refs #1052）。持ち込みのダブルアップルだけ減る。
    assert.deepEqual(await page.evaluate(async () => (await import("./js/core/state.js")).state.flavorStock), { double_apple: 0, lemon: 3 });
  });
});
