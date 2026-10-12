// CG-only comparison: original registration/art with the current renderer and backgrounds.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const source = path.join(root, "asset_sources/ch1-visual-quality-issue360/set-c-event-cgs");
const old = JSON.parse(fs.readFileSync(path.join(source, "previous/manifest.json")));
const current = JSON.parse(fs.readFileSync(path.join(root, "remake/data/manifest.json")));
const manifest = { ...current, cgs: old.cgs,
  webp: [...current.webp.filter(x => !x.startsWith("cgs/")), ...old.webp.filter(x => x.startsWith("cgs/"))] };
const rows = JSON.parse(fs.readFileSync(path.join(source, "inventory.json"))).rows;
const output = process.env.ARTIFACT_DIR || path.join(source, "review/before-png");
fs.mkdirSync(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  for (const device of ["pc", "touch"]) for (const row of rows) {
    const context = await browser.newContext({ viewport: device === "pc" ? { width: 1920, height: 1080 } : { width: 844, height: 390 },
      isMobile: device === "touch", hasTouch: device === "touch" });
    const page = await context.newPage();
    await page.route("**/remake/data/manifest.json", route => route.fulfill({ json: manifest }));
    await page.route("**/img/cgs/*.webp", route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1);
      const previous = path.join(source, "previous", name);
      return fs.existsSync(previous) ? route.fulfill({ contentType: "image/webp", body: fs.readFileSync(previous) }) : route.continue();
    });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    const dialogue = row.event.split(" / ")[0];
    await page.evaluate(async ({ id, dialogue }) => {
      const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
      const data = await import("./js/core/data.js"), engine = await import("./js/vn/engine.js");
      core.newGame(); core.config.textSpeed = 4; core.state.flags._minto_identity_revealed = true;
      for (const who of ["hajime", "sumi", "tsumugi", "minto", "naru", "adam", "nagumo", "dr_kemuri", "oneesan"]) {
        core.state.met[who] = true; core.state.flags["_intro_" + who] = true;
      }
      ui.clearScreen(); engine.vnTest.turbo = false;
      const original = data.DB.dialogues[dialogue];
      const index = original.lines.findIndex(line => line.type === "show_cg" && line.cg_id === id);
      if (index < 0) throw Error("Canonical CG command missing: " + dialogue);
      const line = original.lines.slice(index + 1).find(item => item.text);
      await ui.setBg(data.bgUrl(original.metadata?.bg || "bg_tonari_inside_night"), { instant: true });
      window.comparisonExpected = line.text;
      void engine.play({ dialogue_id: "cg-before-" + id,
        metadata: { private_scene: original.metadata?.private_scene },
        lines: [original.lines[index], line, { type: "hide_cg" }] });
    }, { id: row.id, dialogue });
    const registered = old.cgs.includes(row.id + ".png");
    await page.waitForFunction(({ id, registered }) => document.querySelector(".vn-text")?.textContent === comparisonExpected
      && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99
      && (registered ? document.querySelector(".vn-cg.show")?.dataset.cg === id
        && Number(getComputedStyle(document.querySelector(".vn-cg")).opacity) >= .99 : !document.querySelector(".vn-cg.show")),
    { id: row.id, registered });
    await page.screenshot({ path: path.join(output, "before-" + device + "-" + row.id + ".png") });
    results.push({ device, id: row.id, dialogue, registered });
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "before.json"), JSON.stringify({
    scope: "CG-only original registration/art; current renderer/backgrounds shared with after fixtures", results }, null, 2) + "\n");
}
