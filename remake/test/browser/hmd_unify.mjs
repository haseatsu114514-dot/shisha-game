// #2213: HMDの作りは全HMD共通。ロートスでもタヌキッシュでも同じ穴あけ工程を通る。
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
    await suite("hmd-unify", async run => {
  for (const hms of ["lotos_hagal", "lotos_plus", "tanukish_lid", "amaburst_hms"]) {
    await run(`${hms}-uses-foil`, async page => {
      await init(page);
      await page.evaluate(id => { T.session.craftTest.auto = "good"; return T.start(c => { c.equip.hms = id; }); }, hms);
      await page.evaluate(() => window.running);
      const holes = await page.evaluate(() => cs.holes);
      assert(!holes.skipped && Number.isFinite(holes.score), `${hms} で穴あけが行われていない`);
      assert.equal(await page.evaluate(() => cs.vent), undefined, `${hms} で通気の工程が出た`);
      await page.evaluate(() => { T.session.craftTest.auto = null; });
    });
  }
});
