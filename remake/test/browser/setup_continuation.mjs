import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";
import { waitForSetupContinuation } from "./appearance_setup.mjs";

await suite("setup-continuation", async check => {
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
