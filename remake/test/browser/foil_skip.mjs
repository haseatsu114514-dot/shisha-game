// ロートスでは蓋の通気を選び、アルミ付きの台では従来通り穴あけをする。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.config.bgmVolume = core.config.seVolume = 0;
    window.T = { core, session: await import("./js/craft/session.js"),
      holes: await import("./js/craft/holes.js"), practice: await import("./js/craft/practice.js"),
      score: await import("./js/craft/score.js") };
    T.start = async (prep = () => {}) => {
      window.cs = T.session.newSession("tournament");
      prep(cs);
      T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
      await T.session.waitBenchReady(cs);
      window.running = T.holes.runHoles(cs);
    };
  });
}

await suite("foil-skip", async run => {
  await run("lotus-skips-foil", async page => {
    await init(page);
    await page.evaluate(() => T.start());
    await page.locator('[data-test="opt-closed"]').click();
    await page.evaluate(() => window.running);
    assert.equal(await page.locator('[data-test="hole-start"]').count(), 0, "ロートスで穴あけ画面が出た");
    assert.equal(await page.locator('[data-test="foil"], .foil-target-plane').count(), 0, "ロートスで穴あけの盤面が出た");
    const holes = await page.evaluate(() => cs.holes);
    assert.equal(holes.skipped, true, "穴あけが飛ばされていない");
    assert.equal(holes.score, null, "飛ばした穴あけに点が付いている");
    assert.equal(await page.evaluate(() => cs.vent), "closed");
    assert.equal(holes.vent, "closed");
  });

  await run("lotus-auto-opens-vent", async page => {
    await init(page);
    await page.evaluate(() => { T.session.craftTest.auto = "good"; return T.start(); });
    await page.evaluate(() => window.running);
    assert.equal(await page.evaluate(() => cs.vent), "open");
    assert.equal(await page.locator('[data-test="hole-start"]').count(), 0);
  });

  await run("opt-in-uses-foil", async page => {
    await init(page);
    await page.evaluate(() => { T.session.craftTest.auto = "good"; return T.start(c => { c.foilOptIn = true; }); });
    await page.evaluate(() => window.running);
    const holes = await page.evaluate(() => cs.holes);
    assert(!holes.skipped, "アルミを付けたのに飛ばされた");
    assert(Number.isFinite(holes.score), "穴あけの点が付いていない");
    await page.evaluate(() => { T.session.craftTest.auto = null; });
  });

  await run("aluminum-hmd-uses-foil", async page => {
    await init(page);
    await page.evaluate(() => { T.session.craftTest.auto = "good"; return T.start(c => { c.equip.hms = "tanukish_lid"; }); });
    await page.evaluate(() => window.running);
    const holes = await page.evaluate(() => cs.holes);
    assert(!holes.skipped && Number.isFinite(holes.score), "アルミHMDで穴あけが行われていない");
    await page.evaluate(() => { T.session.craftTest.auto = null; });
  });
});
