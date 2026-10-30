import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";
import { waitForSetupContinuation } from "./appearance_setup.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sourceDir = "asset_sources/shisha-hardware-reference/skin-candidates-issue374/";
const sourceFile = file => {
  const local = path.join(repositoryRoot, sourceDir, file);
  return fs.existsSync(local) ? fs.readFileSync(local) : execFileSync("git", ["-C", repositoryRoot, "show", `HEAD:${sourceDir}${file}`]);
};

await suite("setup-continuation", async check => {
  await check("optional appearance selection updates the active rig and SAVE only", async page => {
    for (const file of ["candidates.json", "render-preview.json"]) {
      await page.route(`**/skin-candidates-issue374/${file}`, route => route.fulfill({ contentType: "application/json", body: sourceFile(file) }));
    }
    const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR4sAAAAASUVORK5CYII=", "base64");
    await page.route("**/skin-candidates-issue374/*.png", route => route.fulfill({ contentType: "image/png", body: pixel }));
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const session = await import("./js/craft/session.js");
      const ui = await import("./js/core/ui.js");
      const s = core.newGame();
      s.appearance = { handle: "handle-01-yoshio", mouthpiece: "mouthpiece-01-crystal-drop" };
      window.before = structuredClone({ equip: s.equip, owned: s.owned, stats: s.stats, money: s.money });
      ui.clearScreen();
      window.S = { core, cs: session.newSession("rehearsal") };
      session.openBench(S.cs, { steps: [["setup", "機材"]] });
    });
    await page.locator('[data-test="worker-appearance"] [data-id="handle-01-yoshio"]').waitFor();
    await page.locator('[data-test="worker-appearance"] [data-id="mouthpiece-01-crystal-drop"]').waitFor();
    await page.locator('[data-test="bench-appearance-open"]').click();
    await page.locator('[data-test="appearance-handle"]').selectOption("handle-02-shishark-blue");
    await page.locator('[data-test="appearance-cancel"]').click();
    assert.equal(await page.locator('[data-test="worker-appearance"] [data-id="handle-01-yoshio"]').count(), 1);
    await page.locator('[data-test="bench-appearance-open"]').click();
    await page.locator('[data-test="appearance-handle"]').selectOption("handle-02-shishark-blue");
    await page.locator('[data-test="appearance-mouthpiece"]').selectOption("mouthpiece-02-starmoon-charm");
    await page.locator('[data-test="appearance-confirm"]').click();
    await page.locator('[data-test="worker-appearance"] [data-id="handle-02-shishark-blue"]').waitFor();
    await page.locator('[data-test="worker-appearance"] [data-id="mouthpiece-02-starmoon-charm"]').waitFor();
    const after = await page.evaluate(() => {
      S.core.save();
      return { appearance: S.core.state.appearance, rig: S.cs.appearance,
        loaded: S.core.load().appearance,
        resources: { equip: S.core.state.equip, owned: S.core.state.owned, stats: S.core.state.stats, money: S.core.state.money } };
    });
    assert.deepEqual(after.appearance, { handle: "handle-02-shishark-blue", mouthpiece: "mouthpiece-02-starmoon-charm" });
    assert.deepEqual(after.rig, after.appearance);
    assert.deepEqual(after.loaded, after.appearance);
    assert.deepEqual(after.resources, await page.evaluate(() => before));
  }, { reducedMotion: "reduce" });
  for (const touch of [false, true]) await check(touch ? "touch-tournament" : "pc-practice", async page => {
    const catalogs = [];
    page.on("request", request => { if (request.url().includes("candidates.json")) catalogs.push(request.url()); });
    await page.evaluate(async touch => {
      const core = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const session = await import("./js/craft/session.js");
      const steps = await import("./js/craft/steps.js");
      const { stepWater } = await import("./js/craft/water-view.js");
      const ui = await import("./js/core/ui.js");
      const s = core.newGame();
      s.chapter = touch ? 2 : 1;
      s.appearance = { handle: "saved-handle", mouthpiece: "saved-mouthpiece" };
      window.alternative = Object.values(DB.equipById).find(e => e.type === "bowl" && !s.owned.includes(e.id)).id;
      s.owned.push(alternative);
      window.before = structuredClone({ appearance: s.appearance, owned: s.owned, stats: s.stats, money: s.money });
      session.craftTest.auto = null;
      ui.clearScreen();
      window.S = { core, cs: session.newSession(touch ? "tournament" : "practice") };
      session.openBench(S.cs, { steps: [["setup", "機材"], ["mix", "配合"]] });
      window.running = (async () => { await steps.stepSetup(S.cs); await stepWater(S.cs); await steps.stepMix(S.cs); })();
    }, touch);
    const alternative = await page.evaluate(() => alternative);
    const equipment = page.locator(`[data-test="opt-${alternative}"]`);
    if (touch) await equipment.tap(); else await equipment.click();
    await waitForSetupContinuation(page);
    await assertFits(page, '[data-test="water-confirm"]');
    const confirm = page.locator('[data-test="water-confirm"]');
    if (touch) await confirm.tap(); else await confirm.click();
    await page.locator('[data-test="mix-ok"]').waitFor();
    const after = await page.evaluate(() => ({
      before, resources: { appearance: S.core.state.appearance, owned: S.core.state.owned, stats: S.core.state.stats, money: S.core.state.money },
      bowl: S.cs.equip.bowl, savedBowl: S.core.state.equip.bowl,
    }));
    assert.equal(after.bowl, alternative);
    assert.equal(after.savedBowl, alternative);
    assert.deepEqual(after.resources, after.before);
    assert.deepEqual(catalogs, []);
    assert.equal(await page.locator('[data-test="appearance-confirm"]').count(), 0);
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : { reducedMotion: "reduce" });
});
