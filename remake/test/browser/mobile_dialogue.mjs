import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function assertBody(page, rowCount, mobile) {
  const layout = await page.locator(".vn-text").evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rows = [...range.getClientRects()].filter(r => r.width > 0);
    const box = el.closest(".vn-box").getBoundingClientRect();
    const k = parseFloat(getComputedStyle(document.querySelector("#stage")).getPropertyValue("--k"));
    const buttons = [...document.querySelectorAll(".vn-next.show, .vn-name.show, .vn-controls > .vn-ctl, .side-pad.bottom button")]
      .filter(node => node.offsetHeight && getComputedStyle(node).visibility === "visible")
      .map(node => node.getBoundingClientRect());
    const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    return {
      size: parseFloat(getComputedStyle(el).fontSize),
      rows: rows.length,
      top: rows[0].top - box.top,
      bottom: box.bottom - rows.at(-1).bottom,
      tolerance: 4 * k,
      clear: rows.every(r => buttons.every(b => !overlaps(r, b))),
    };
  });
  assert.equal(layout.rows, rowCount, "body type must preserve the intended line breaks");
  assert(layout.clear && layout.top > 0 && layout.bottom > 0, "body text must fit away from the name, advance and controls");
  if (mobile) assert.equal(layout.size, 36);
  if (mobile && rowCount === 2) {
    assert(Math.abs(layout.top - layout.bottom) <= layout.tolerance, `center body text vertically: ${JSON.stringify(layout)}`);
  }
  return layout.top;
}

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
        state.met.hiyori = true;
        state.flags._intro_hiyori = true;
        core.config.textSpeed = 4;
        ui.showScreen("daily", document.createElement("div"));
        await ui.setBg(data.bgUrl("bg_tonari_inside_day"), { instant: true });
        void vn.play({
          dialogue_id: "qa_mobile_dialogue",
          lines: [
            { speaker: "hajime", face: "normal", text: "お疲れさまです。あ、さっきの常連さん、帰り際に『今日の、良かったよ』って" },
            { speaker: "hajime", face: "normal", text: "この行の後に、幅いっぱいの行を置く。\nPEPPERMINTからの帰り道。KEMURIYAの前で足が" },
            { speaker: longName, portrait: false, text: "長い名前でも、名札からはみ出さない。" },
            { speaker: "", text: "地の文と本文の窓枠はそのまま。" },
            { speaker: "hiyori", portrait: false, text: "うん、今日はそれでいいと思う。", inner: "本当は少しだけ期待したけど、それは言わなくていい。" },
            { type: "choice", choices: [{ text: "店に残る" }, { text: "帰る" }] },
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
      const firstRowTop = await assertBody(page, 2, mobile);
      const advance = () => page.waitForFunction(async () => (await import("./js/vn/engine.js")).tapAdvance());
      await advance();
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent.includes("PEPPERMINT"));
      await page.locator(".vn-next.show").waitFor();
      await assertBody(page, 2, mobile);
      await advance();
      await page.waitForFunction(name => document.querySelector(".vn-name.show")?.textContent === name, longName);
      await page.locator(".vn-next.show").waitFor();
      assert(await name.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const glyphs = range.getBoundingClientRect(), tag = el.getBoundingClientRect();
        return glyphs.left >= tag.left && glyphs.right <= tag.right && glyphs.top >= tag.top && glyphs.bottom <= tag.bottom;
      }), "a long speaker name stays in its nameplate");
      assert.equal(await assertBody(page, 1, mobile), firstRowTop, "a one-line speech starts at the same height as a two-line speech");
      await advance();
      await page.locator(".vn-box.narration").waitFor();
      assert.equal(await name.evaluate(el => getComputedStyle(el).display), "none");
      await page.locator(".vn-next.show").waitFor();
      await assertFits(page, ".vn-box");
      assert.equal(await assertBody(page, 1, mobile), firstRowTop, "a one-line narration starts at the same height as a two-line speech");
      await advance();
      await page.locator(".vn-inner:not([hidden])").waitFor();
      await page.locator(".vn-next.show").waitFor();
      await assertFits(page, ".vn-box");
      if (mobile) assert.equal(await page.locator(".vn-text").evaluate(el => getComputedStyle(el).fontSize), "32px", "reserve the prior annotation layout");
      await advance();
      await page.locator(".vn-choice").first().waitFor();
      await assertFits(page, ".vn-choices.show .vn-choice");
    }, { viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  }
}, { initScript: () => localStorage.setItem("suien_side_pad", "on") });
