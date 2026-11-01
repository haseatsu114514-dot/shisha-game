import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";

const dialogue = { dialogue_id: "accessibility-1914", lines: [
  { text: "一行目。" }, { text: "未読の二行目。" }, { text: "三行目。" },
] };

await suite("vn-accessibility-1914", async check => {
  await check("seen-skip-and-settings", async page => {
    await page.evaluate(async dlg => {
      const core = await import("./js/core/state.js");
      const ui = await import("./js/core/ui.js");
      const vn = await import("./js/vn/engine.js");
      core.newGame(); core.config.textSpeed = 4;
      ui.clearScreen();
      window.test1914 = { core, ui, vn, dlg };
      const controller = new AbortController();
      window.first = vn.play(dlg, { signal: controller.signal });
      window.stopFirst = () => controller.abort();
    }, dialogue);
    await page.locator(".vn-next.show").waitFor();
    await page.waitForTimeout(400);
    await page.locator(".vn-box").click();
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "未読の二行目。");
    await page.evaluate(() => stopFirst());
    await page.evaluate(() => first);

    await page.evaluate(() => { window.replay = test1914.vn.play(test1914.dlg); });
    await page.locator(".vn-next.show").waitFor();
    await page.locator('[data-test="vn-config"]').click();
    await page.selectOption('[data-test="cfg-skip-mode"]', "seen");
    await page.selectOption('[data-test="cfg-auto-speed"]', "3");
    await page.locator('[data-test="cfg-reduce-shake"]').check();
    await page.locator('[data-test="cfg-close"]').click();
    assert.deepEqual(await page.evaluate(() => ({
      seen: test1914.core.config.skipSeenOnly,
      speed: test1914.core.config.autoSpeed,
      motion: test1914.core.config.reduceShake,
    })), { seen: true, speed: 3, motion: true });
    assert.deepEqual(await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("suien_remake_config"));
      return { seen: saved.skipSeenOnly, speed: saved.autoSpeed, motion: saved.reduceShake };
    }), { seen: true, speed: 3, motion: true });

    await page.locator('[data-test="vn-skip"]').click();
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "未読の二行目。");
    assert.equal(await page.locator("body.vn-skip").count(), 0, "SKIP crossed an unread line");
    await page.keyboard.down("Control");
    assert.equal(await page.locator("body.vn-skip").count(), 0, "Ctrl skipped an unread line");
    await page.keyboard.up("Control");

    const effects = await page.evaluate(() => {
      test1914.ui.flash(); test1914.ui.shake();
      return { flash: document.querySelectorAll(".flash").length, shake: document.querySelector("#stage").classList.contains("shake") };
    });
    assert.deepEqual(effects, { flash: 0, shake: false });
    await page.evaluate(() => { test1914.core.config.reduceShake = false; });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const osEffects = await page.evaluate(() => {
      test1914.ui.flash(); test1914.ui.shake();
      return { flash: document.querySelectorAll(".flash").length, shake: document.querySelector("#stage").classList.contains("shake") };
    });
    assert.deepEqual(osEffects, { flash: 0, shake: false });
    await page.locator(".vn-box").click();
    await page.locator(".vn-box").click();
    await page.evaluate(() => replay);
  });
});
