import assert from "node:assert/strict";
import { baseURL, suite } from "./support.mjs";

const t = name => `[data-test="desert-${name}"]`;
await suite("desert-ride-guide", async check => {
  for (const [suffix, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }]]) {
    await check(`return-direction-and-reset-${suffix}`, async page => {
      await page.locator(t("page-start")).click();
      await page.locator(t("start")).click();
      await page.waitForFunction(() => window.__desertRide?.mode === "run");
      const cue = page.locator(t("return-cue"));
      assert.equal(await cue.isVisible(), false, "no cue in countdown");
      await page.evaluate(() => { const r = window.__desertRide; r.skipCountdown(); r.setSpeedUp(4); r.game.x = -1.05; r.game.speed = 8; });
      await cue.waitFor({ state: "visible" });
      assert.equal(await cue.innerText(), "→ 右へ戻ろう");
      await page.evaluate(() => { window.__desertRide.setSpeedUp(1); window.__desertRide.game.x = 0; window.__desertRide.redraw(); });
      assert.equal(await cue.isVisible(), false, "returning inside clears immediately");
      await page.evaluate(() => { const r = window.__desertRide; r.setSpeedUp(4); r.game.x = 1.05; r.game.vx = 0; r.game.speed = 8; });
      await cue.waitFor({ state: "visible" });
      assert.equal(await cue.innerText(), "← 左へ戻ろう");
      await page.evaluate(() => { const r = window.__desertRide; r.game.speed = 20; r.redraw(); });
      assert.equal(await cue.isVisible(), false, "regaining speed clears immediately");
      await page.evaluate(() => { const r = window.__desertRide; r.game.speed = 8; r.redraw(); });
      assert.equal(await cue.isVisible(), false, "the next low-speed period needs a fresh wait");
      await cue.waitFor({ state: "visible" });
      await page.evaluate(() => window.__desertRide.setSpeedUp(1));
      const box = await cue.boundingBox(), stage = await page.locator("#stage").boundingBox();
      assert(box.x >= stage.x && box.x + box.width <= stage.x + stage.width);
      assert.equal(await page.locator(t("action-cue")).isVisible(), false, "Space lesson only appears in practice");
    }, options);

    await check(`compact-lesson-and-space-role-${suffix}`, async page => {
      await page.locator(t("page-tutorial")).click();
      await page.waitForFunction(() => window.__desertRide?.mode === "practice");
      const cue = page.locator(t("action-cue")), caption = page.locator(t("caption"));
      assert.equal(await cue.innerText(), "ジャンプ\n跳ぶ", "the cue names the on-screen button, never a keyboard key");
      assert((await caption.locator("kbd").count()) >= 2, "the steering buttons have a distinct display");
      assert.doesNotMatch(await caption.innerText(), /Space|←|→|↓/, "the lesson names on-screen buttons only");
      const layout = await page.locator(t("guide")).evaluate(node => {
        const box = node.getBoundingClientRect(), stage = document.querySelector("#stage").getBoundingClientRect();
        return { top: (box.top - stage.top) / stage.height, bottom: (box.bottom - stage.top) / stage.height };
      });
      assert(layout.top >= 0 && layout.bottom < 0.18, "the compact lesson stays above the course");
      const lines = await page.evaluate(async () => (await import("./js/minigames/desert-ride.js")).TUTORIAL_LINES);
      assert(lines.every(line => line.length <= 36 && !/[。！!？?]/.test(line)), "every lesson is one short sentence");
      if (suffix === "pc") await page.keyboard.press("Space");
      else await page.locator(t("jump")).tap();
      await page.waitForFunction(() => document.querySelector('[data-test="desert-action-cue"]').textContent.endsWith("着地"));
      assert.equal(await cue.locator("kbd").innerText(), "LAND");
      await page.waitForFunction(() => window.__desertRide.game.air <= 0);
      await page.waitForFunction(() => document.querySelector('[data-test="desert-action-cue"]').textContent.endsWith("跳ぶ"));
      await page.keyboard.press("Escape");
      await page.locator(t("quit-confirm")).click();
      assert.equal(await cue.isVisible(), false, "the lesson clears in the menu");
      await page.locator(t("practice")).click();
      await page.waitForFunction(() => window.__desertRide?.mode === "practice");
      assert.equal(await cue.locator("span").innerText(), "跳ぶ", "a new practice resets the role");
    }, options);
  }
}, { entry: new URL("desert-ride.html?course=ridge", baseURL).href, readySelector: t("page-start") });
