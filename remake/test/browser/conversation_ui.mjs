import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

await suite("conversation-ui", async check => {
  await check("choice-modal-log-keyboard", async page => {
    const saved = await storageSnapshot(page);
    await page.locator('[data-test="vn-log"]').focus();
    await page.keyboard.press("Enter");
    await page.locator(".vn-log.show").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".vn-log.show").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "vn-log");

    const openModal = () => page.evaluate(async () => {
      const { modal } = await import("./js/core/ui.js");
      window.keyboardModal = modal({ title: "Keyboard", options: [
        { label: "Cancel", value: "cancel" }, { label: "Confirm", value: "confirm", primary: true },
      ] });
    });
    await openModal();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Confirm");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.keyboardModal), "cancel");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "vn-log");
    await openModal();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.keyboardModal), "confirm");

    const showChoices = async () => {
      if (await page.locator("#preview-scene").inputValue() === "choices") await page.locator("#preview-restart").click();
      else await page.selectOption("#preview-scene", "choices");
      if (await page.locator('[data-test="vn-skip"]').getAttribute("aria-pressed") === "false") {
        await page.locator('[data-test="vn-skip"]').click();
      }
      await page.locator('[data-test="choice-0"]').waitFor();
    };
    await showChoices();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-0");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-1");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-0");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-1");
    await page.keyboard.press("Enter");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    await showChoices();
    await page.keyboard.press("2");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    await showChoices();
    await page.keyboard.press("3");
    assert.equal(await page.locator(".vn-choice").count(), 2, "Missing numbered choice does nothing");
    await page.keyboard.press("1");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    assert.deepEqual(await storageSnapshot(page), saved);
  });
  await check("keyboard-controls", async page => {
    await page.locator(".vn-next.show").waitFor();
    const saved = await storageSnapshot(page);
    const text = await page.locator(".vn-text").textContent();
    for (const key of ["Enter", "Space"]) {
      const log = page.locator('[data-test="vn-log"]');
      await log.focus(); await page.keyboard.press(key);
      await page.locator(".vn-log.show").waitFor();
      assert.equal(await page.locator(".vn-text").textContent(), text, `${key} opens LOG without advancing dialogue`);
      await page.locator(".vn-log button").press(key);
      await page.locator(".vn-log.show").waitFor({ state: "hidden" });
      for (const control of ["vn-glossary", "vn-config"]) {
        await page.locator(`[data-test="${control}"]`).focus();
        await page.keyboard.press(key);
        await page.locator("#modal.show").waitFor();
        assert.equal(await page.locator(".vn-text").textContent(), text, `${key} opens ${control} without advancing`);
        await page.locator("#modal .modal-actions button").last().press(key);
        await page.locator("#modal.show").waitFor({ state: "hidden" });
      }
      const auto = page.locator('[data-test="vn-auto"]');
      await auto.focus(); await page.keyboard.press(key);
      assert.equal(await auto.getAttribute("aria-pressed"), "true");
      await page.keyboard.press(key);
      assert.equal(await auto.getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator(".vn-text").textContent(), text, "AUTO activation does not consume a dialogue line");
    }
    // Native form controls also keep their own activation semantics during a conversation.
    await page.locator("#preview-scene").focus();
    await page.keyboard.press("Space"); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".vn-text").textContent(), text);
    // Unfocused Enter/Space still advance normally.
    await page.locator("#preview-scene").evaluate(el => el.blur());
    await page.keyboard.press("Enter");
    await page.waitForFunction(old => document.querySelector(".vn-text").textContent !== old, text);
    await page.locator(".vn-next.show").waitFor();
    const second = await page.locator(".vn-text").textContent();
    await page.keyboard.press("Space");
    await page.waitForFunction(old => document.querySelector(".vn-text").textContent !== old, second);
    for (const key of ["Enter", "Space"]) {
      await page.selectOption("#preview-scene", "choices");
      const skip = page.locator('[data-test="vn-skip"]');
      await skip.focus(); await page.keyboard.press(key);
      assert.equal(await skip.getAttribute("aria-pressed"), "true");
      await page.locator('[data-test="choice-0"]').waitFor();
      await skip.focus(); await page.keyboard.press(key);
      assert.equal(await skip.getAttribute("aria-pressed"), "false");
      await page.locator('[data-test="choice-0"]').press(key);
      await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
      await page.locator(".vn-next.show").waitFor();
      await page.keyboard.press(key);
      await page.waitForFunction(() => document.querySelector("#preview-status").textContent.includes("会話終了"));
    }
    assert.deepEqual(await storageSnapshot(page), saved, "Keyboard controls must not change saved games/config");
  });
  for (const [label, viewport] of [["desktop", { width: 1280, height: 768 }], ["landscape", { width: 844, height: 438 }]]) {
    await check(label, async page => {
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
      const saved = await storageSnapshot(page);
      const geometry = await page.evaluate(() => {
        const box = document.querySelector(".vn-box").getBoundingClientRect();
        const controls = document.querySelector(".vn-controls").getBoundingClientRect();
        const name = document.querySelector(".vn-name");
        return { aligned:Math.abs((name.getBoundingClientRect().top+name.getBoundingClientRect().height/2)-(controls.top+controls.height/2))/(box.width/1216), font: getComputedStyle(name).fontFamily,
          nameTop: parseFloat(getComputedStyle(name).top),
          buttons: [...document.querySelectorAll(".vn-ctl")].map(el => parseFloat(getComputedStyle(el).minHeight)) };
      });
      assert(Math.abs(geometry.aligned-16)<=.5,"commands sit 16px above the name tab");
      assert(geometry.font.includes("Suien Name"));
      assert.equal(geometry.nameTop, -36);
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
      const frameStyle = () => page.locator(".vn-box").evaluate(box => ({
        frame: getComputedStyle(box, "::before").backgroundImage,
        top: getComputedStyle(box, "::before").top,
        paintedHeight: parseFloat(getComputedStyle(box, "::before").height),
        nameHidden: getComputedStyle(box.querySelector(".vn-name")).display === "none",
        height: box.offsetHeight,
      }));
      const narration = await frameStyle();
      assert(narration.frame.includes("narration.svg"), "Narration must use the flat, nameless frame");
      assert(narration.nameHidden);
      await page.locator(".vn-next.show").waitFor();
      // A newly opened scene rejects input for 320ms, even if its text is ready.
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.locator(".vn-box.thought").waitFor();
      assert.deepEqual(await frameStyle(), narration, "Inner monologue must use the same nameless frame");
      assert.deepEqual(await storageSnapshot(page), saved, "Preview must not change saved games/config");
      await page.selectOption("#preview-scene", "hiyori");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
      const dialogue = await frameStyle();
      assert.equal(dialogue.frame,narration.frame,"speaker visibility does not replace or resize the panel");
      assert.equal(dialogue.nameHidden, false);
      assert.equal(dialogue.height, narration.height, "Switching frames must preserve text layout");
      assert.equal(dialogue.paintedHeight,narration.paintedHeight,"speech and narration retain the same painted height");
      assert.equal(dialogue.top,narration.top,"speech and narration retain the same top edge");
    }, { viewport });
  }
}, { entry: new URL("conversation-preview.html?theme=classic", baseURL).href, readySelector: ".vn-box" });
