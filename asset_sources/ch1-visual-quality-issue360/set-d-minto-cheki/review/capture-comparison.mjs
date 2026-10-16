// Actual canonical command and narration, varying only the missing CG registration.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const output = process.env.ARTIFACT_DIR || fileURLToPath(new URL("comparisons/", import.meta.url));
fs.mkdirSync(output, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, "remake/data/manifest.json")));
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const device of ["pc", "touch"]) for (const version of ["before", "after"]) {
    const context = await browser.newContext({ viewport: device === "pc" ? { width: 1920, height: 1080 } : { width: 844, height: 390 },
      isMobile: device === "touch", hasTouch: device === "touch" });
    const page = await context.newPage();
    if (version === "before") await page.route("**/remake/data/manifest.json", route => route.fulfill({ json: {
      ...manifest, cgs: manifest.cgs.filter(x => x !== "cg_minto_cheki.png"),
      webp: manifest.webp.filter(x => x !== "cgs/cg_minto_cheki.png") } }));
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8124/remake/");
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    const url = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
      const data = await import("./js/core/data.js"), engine = await import("./js/vn/engine.js");
      core.newGame(); core.config.textSpeed = 4; ui.clearScreen(); engine.vnTest.turbo = false;
      const original = data.DB.dialogues.interaction_minto_noon_01;
      const index = original.lines.findIndex(line => line.type === "show_cg" && line.cg_id === "cg_minto_cheki");
      if (index < 0) throw Error("Canonical DAY4 show_cg command missing");
      await ui.setBg(data.bgUrl(original.metadata.bg), { instant: true });
      window.expectedPhotoLine = original.lines[index + 1].text;
      void engine.play({ dialogue_id: "cheki-comparison", lines: [original.lines[index], original.lines[index + 1], { type: "hide_cg" }] });
      return data.cgUrl("cg_minto_cheki");
    });
    assert.equal(url, version === "before" ? null : "img/cgs/cg_minto_cheki.webp");
    await page.waitForFunction(version => document.querySelector(".vn-text")?.textContent === expectedPhotoLine
      && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99
      && (version === "before" ? !document.querySelector(".vn-cg.show")
        : Number(getComputedStyle(document.querySelector(".vn-cg.show")).opacity) >= .99), version);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // Allow a completed line and the loaded font to paint before capture.
    const file = version + "-" + device + ".png";
    await page.screenshot({ path: path.join(output, file) });
    results.push({ device, version, file, url, event: "interaction_minto_noon_01" });
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "comparisons.json"), JSON.stringify({
    ref: process.env.TEST_REF || null,
    scope: "CG-registration-only comparison: existing canonical command/narration with identical current renderer and PEPPERMINT background", results }, null, 2) + "\n");
}
