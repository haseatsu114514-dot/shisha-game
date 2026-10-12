// Actual authored puppet lines, including branches, must use the adopted face-covering pose.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, assertFits } from "./browser/support.mjs";
const data = JSON.parse(await fs.readFile(new URL("../../data/dialogue/kafuka.json", import.meta.url), "utf8"));
const lines = [];
function collect(value, scene) {
  if (Array.isArray(value)) return value.forEach(v => collect(v, scene));
  if (!value || typeof value !== "object") return;
  if (value.voice === "korochan") {
    assert.equal(value.speaker, "kafuka"); assert.equal(value.face, "ventriloquism");
    lines.push({ scene, line: value });
  }
  Object.values(value).forEach(v => collect(v, scene));
}
data.dialogues.forEach(scene => collect(scene, scene.dialogue_id));
assert(lines.length >= 7, "Keep the original puppet passages and inspect every added line");
await suite("kafuka-portrait", async check => {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 720 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      await page.evaluate(async () => {
        window.K = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"), vn: await import("./js/vn/engine.js") };
        K.core.newGame(); K.core.state.met.kafuka = true;
        Object.assign(K.core.state.flags, { _intro_kafuka: true, _kafuka_nickname_known: true });
        K.core.config.textSpeed = 4;
      });
      const before = await page.evaluate(() => JSON.stringify(K.core.state));
      for (const { scene, line } of lines) {
        await page.evaluate(({ scene, line }) => {
          K.scene = K.vn.play({ metadata: K.data.DB.dialogues[scene].metadata, lines: [line,
            { speaker: "kafuka", face: "normal", text: "分かっておる" }] });
        }, { scene, line });
        await page.waitForFunction(text => document.querySelector('.vn-text')?.textContent === text, line.text);
        await page.locator('#vn.active .vn-next.show').waitFor();
        const img = page.locator('img[data-speaker="kafuka"]');
        assert.match(await img.getAttribute("src"), /chr_kafuka_ventriloquism\.webp$/);
        assert.equal(await page.locator(".vn-name").textContent(), "コロちゃん（腹話術）");
        assert(await img.evaluate(i => i.complete && i.naturalWidth === 896 && i.naturalHeight === 1200));
        await assertFits(page, ".vn-box, .vn-text, .vn-controls");
        if (scene === "kafuka_first_encounter" && line.text === lines[0].line.text) {
          if (process.env.COMPARISON_DIR) await page.screenshot({ path: `${process.env.COMPARISON_DIR}/after-${label}.png` });
        }
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.querySelector('img[data-speaker="kafuka"]')?.src.endsWith("chr_kafuka_normal.webp"));
        await page.waitForFunction(() => document.querySelector('.vn-text')?.textContent === "分かっておる");
        await page.locator('#vn.active .vn-next.show').waitFor();
        assert.equal(await page.locator(".vn-name").textContent(), "サメちゃん");
        await page.keyboard.press("Enter"); await page.evaluate(() => K.scene);
      }
      assert.equal(await page.evaluate(() => JSON.stringify(K.core.state)), before, "Pose switches must not alter save data");
    }, { viewport, reducedMotion: "reduce" });
  }
});
