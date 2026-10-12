import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, assertFits } from "./support.mjs";
const faces = ["normal", "sad", "smile", "student_smile", "surprise", "tears", "axe_normal", "axe_laugh", "axe_shout", "serious", "love_blush"];
const shots = process.env.COMPARISON_DIR;
if (shots) await fs.mkdir(shots, { recursive: true });
await suite("hiyori-axe-assets", async check => {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 720 }], ["touch", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      page.setDefaultTimeout(30000);
      await page.evaluate(async () => {
        window.K = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"), ui: await import("./js/core/ui.js") };
        K.core.newGame(); K.core.state.met.hiyori = true;
        Object.assign(K.core.state.flags, { _intro_hiyori: true, _met_hiyori: true, known_name_hiyori: true });
        K.core.config.textSpeed = 4; K.ui.clearScreen();
      });
      const before = await page.evaluate(() => JSON.stringify(K.core.state));
      for (const face of faces) {
        await page.evaluate(face => {
          K.flow = K.vn.play({ metadata: { bg: "res://assets/backgrounds/bg_axe_lounge_night.png" }, lines: [
            { speaker: "hiyori", face, text: "今日は、思いきり楽しもう！" },
            { speaker: "hiyori", face: "normal", text: "また一緒に来ようね。" }
          ] });
        }, face);
        await page.waitForFunction(() => document.querySelector('.vn-text')?.textContent === "今日は、思いきり楽しもう！");
        await page.locator('#vn.active .vn-next.show').waitFor();
        const portrait = page.locator('img[data-speaker="hiyori"]');
        assert((await portrait.getAttribute("src")).endsWith(`chr_hiyori_${face}.webp`));
        assert(await portrait.evaluate(i => i.complete && i.naturalWidth === 896 && i.naturalHeight === 1200));
        assert(await page.locator('#bg .bg-img.show').evaluate(n => getComputedStyle(n).backgroundImage.includes("bg_axe_lounge_night.webp")));
        await assertFits(page, ".vn-box, .vn-text, .vn-controls");
        if (shots) await page.screenshot({ path: `${shots}/${label}-${face}.png` });
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.querySelector('.vn-text')?.textContent === "また一緒に来ようね。");
        await page.locator('#vn.active .vn-next.show').waitFor();
        await page.keyboard.press("Enter"); await page.evaluate(() => K.flow);
      }
      assert.equal(await page.evaluate(() => JSON.stringify(K.core.state)), before, "Artwork must not award relationship, money or story flags");
    }, { viewport, hasTouch: label === "touch", reducedMotion: "reduce" });
  }
});
