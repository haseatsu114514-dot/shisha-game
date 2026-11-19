import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

await suite("mobile-dialogue", async check => {
  const longName = "シーシャ機材発明家チャコール博士";
  for (const [width, height, mobile] of [[844, 390, true], [740, 320, true], [1280, 720, false]]) {
    await check(`${width}x${height}`, async page => {
      await page.evaluate(async longName => {
        const [vn, core, ui, data] = await Promise.all([
          import("./js/vn/engine.js"), import("./js/core/state.js"),
          import("./js/core/ui.js"), import("./js/core/data.js"),
        ]);
        const state = core.newGame();
        state.met[longName] = true;
        core.config.textSpeed = 4;
        ui.showScreen("daily", document.createElement("div"));
        await ui.setBg(data.bgUrl("bg_tonari_inside_day"), { instant: true });
        void vn.play({
          dialogue_id: "qa_mobile_dialogue",
          lines: [
            { speaker: "hajime", face: "normal", text: "お疲れさまです。あ、さっきの常連さん、帰り際に『今日の、良かったよ』って" },
            { speaker: longName, portrait: false, text: "長い名前でも、名札からはみ出さない。" },
            { speaker: "", text: "地の文と本文の窓枠はそのまま。" },
          ],
        }, { previewProtagonist: true });
      }, longName);
      const name = page.locator(".vn-name");
      const box = page.locator(".vn-box");
      await page.waitForFunction(() => document.querySelector(".vn-name.show")?.textContent === "はじめ");
      await page.locator(".vn-next.show").waitFor();
      const frame = await box.evaluate(el => {
        const name = el.querySelector(".vn-name");
        const frame = getComputedStyle(el, "::before");
        const strip = getComputedStyle(el, "::after");
        const plate = getComputedStyle(name);
        const k = parseFloat(getComputedStyle(document.getElementById("stage")).getPropertyValue("--k"));
        return {
          frame: frame.backgroundImage, plate: plate.backgroundImage, strip: strip.content, clip: strip.clipPath,
          size: parseFloat(plate.fontSize), projectedSize: parseFloat(plate.fontSize) * k,
        };
      });
      assert(frame.frame.includes("paper/dialogue.webp") && frame.plate.includes("paper/lavender.webp"), "retain the paper frame and purple nameplate");
      assert.equal(frame.strip, mobile ? '""' : "none", "cover only the inset rule on the phone");
      if (mobile) {
        assert.notEqual(frame.clip, "none", "cover one strip of paper, not the frame");
        assert(frame.projectedSize >= 13.49 && frame.size >= 27, "short names are more readable on the phone");
      } else {
        assert.equal(frame.size, 22, "desktop name typography is unchanged");
      }
      await assertFits(page, ".vn-box");
      const advance = () => page.waitForFunction(async () => (await import("./js/vn/engine.js")).tapAdvance());
      await advance();
      await page.waitForFunction(name => document.querySelector(".vn-name.show")?.textContent === name, longName);
      await page.locator(".vn-next.show").waitFor();
      assert(await name.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const glyphs = range.getBoundingClientRect(), tag = el.getBoundingClientRect();
        return glyphs.left >= tag.left && glyphs.right <= tag.right && glyphs.top >= tag.top && glyphs.bottom <= tag.bottom;
      }), "a long speaker name stays in its nameplate");
      await advance();
      await page.locator(".vn-box.narration").waitFor();
      assert.equal(await name.evaluate(el => getComputedStyle(el).display), "none");
      await assertFits(page, ".vn-box");
    }, { viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  }
}, { initScript: () => localStorage.setItem("suien_side_pad", "on") });
