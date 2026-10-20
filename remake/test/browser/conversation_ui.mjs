import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

await suite("conversation-ui", async check => {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 768 }], ["landscape", { width: 844, height: 438 }]]) {
    await check(label, async page => {
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
      const saved = await storageSnapshot(page);
      const geometry = await page.evaluate(() => {
        const box = document.querySelector(".vn-box").getBoundingClientRect();
        const controls = document.querySelector(".vn-controls").getBoundingClientRect();
        const name = document.querySelector(".vn-name");
        return { gap: (box.top - controls.bottom) / (box.width / 1120), font: getComputedStyle(name).fontFamily,
          nameTop: parseFloat(getComputedStyle(name).top),
          buttons: [...document.querySelectorAll(".vn-ctl")].map(el => parseFloat(getComputedStyle(el).minHeight)) };
      });
      assert(Math.abs(geometry.gap - 5) < .1, "Control frame must have a 5px gap above dialogue");
      assert(geometry.font.includes("Suien Name"));
      assert.equal(geometry.nameTop, -30);
      assert(geometry.buttons.every(height => height >= 44));
      await page.locator('[data-test="vn-auto"]').click();
      assert(await page.locator('[data-test="vn-auto"]').evaluate(el => el.classList.contains("on")));
      await page.locator('[data-test="vn-auto"]').click();
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-inner")?.textContent.includes("よし、今のはかなり儚い。決まった"));
      const fits = await page.locator(".vn-inner").evaluate(el => el.getBoundingClientRect().bottom <= el.closest(".vn-box").getBoundingClientRect().bottom - 5);
      assert(fits, "Inner voice must remain inside dialogue frame");
      await page.locator('[data-test="vn-log"]').click();
      await page.locator(".vn-log.show").waitFor();
      await page.locator(".vn-log button").click();
      await page.locator('[data-test="vn-glossary"]').click();
      await page.getByText("用語集", { exact: true }).waitFor();
      await page.getByRole("button", { name: "閉じる", exact: true }).last().click();
      await page.selectOption("#preview-scene", "choices");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……今日はどうしようか");
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator('[data-test="choice-0"]').waitFor();
      const modes = () => page.evaluate(() => ({
        auto: document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed"),
        skip: document.querySelector('[data-test="vn-skip"]').getAttribute("aria-pressed"),
        fast: document.body.classList.contains("vn-skip"),
      }));
      await page.locator('[data-test="vn-auto"]').click();
      assert.deepEqual(await modes(), { auto: "true", skip: "false", fast: false });
      await page.locator('[data-test="vn-skip"]').click();
      assert.deepEqual(await modes(), { auto: "false", skip: "true", fast: true });
      await page.locator('[data-test="vn-auto"]').click();
      await page.keyboard.down("Control");
      assert.deepEqual(await modes(), { auto: "false", skip: "true", fast: true });
      await page.locator('[data-test="vn-auto"]').click();
      await page.keyboard.up("Control");
      assert.deepEqual(await modes(), { auto: "true", skip: "false", fast: false });
      await page.locator('[data-test="vn-auto"]').click();
      assert.deepEqual(await modes(), { auto: "false", skip: "false", fast: false });
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator('[data-test="choice-0"]').click();
      await page.waitForFunction(() => document.querySelector("#preview-status").textContent.includes("会話終了"));
      await page.selectOption("#preview-scene", "names");
      await page.waitForFunction(() => document.querySelector(".vn-name.show")?.textContent === "アダム");
      await page.locator(".vn-next.show").waitFor();
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-name.show")?.textContent === "はじめ");
      await page.selectOption("#preview-scene", "narration");
      await page.locator(".vn-box.narration").waitFor();
      assert.equal(await page.locator(".vn-name.show").count(), 0);
      assert.deepEqual(await storageSnapshot(page), saved, "Preview must not change saved games/config");
      await page.selectOption("#preview-scene", "hiyori");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
    }, { viewport });
  }
}, { entry: new URL("conversation-preview.html", baseURL).href, readySelector: ".vn-box" });
