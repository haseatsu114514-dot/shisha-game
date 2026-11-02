// #694: real runHeat -> resultCard -> audience advice. No private-function extraction.
import assert from "node:assert/strict";
import { suite, storageSnapshot } from "./support.mjs";

await suite("heat-advice", async check => {
  const cases = [
    ["tutorial", "late-auto"], ["tutorial", "early"], ["tutorial", "mixed"],
    ["drill", "late-auto"], ["drill", "early"], ["drill", "mixed"],
    ["rehearsal", "late-auto"], ["tournament", "late-auto"],
  ];
  for (const [mode, pattern] of cases) {
    await check(`${mode}-${pattern}`, async page => {
      await page.evaluate(async mode => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        window.A = { core, session, heat: await import("./js/craft/heat.js") };
        const cs = A.cs = session.newSession(mode);
        if (mode === "drill") cs.venue = "home";
        session.craftTest.auto = null; // Late removal must be the real timeout, not QA's synthetic auto picks.
        session.openBench(cs, { steps: [["heat", "HEAT"]] });
        await session.waitBenchReady(cs, "heat");
        A.realNow = performance.now.bind(performance); A.now = 1000;
        A.random = Math.random;
        performance.now = () => A.now; Math.random = () => .5;
        A.run = A.heat.runHeat(cs);
      }, mode);
      await page.waitForSelector('.heat[aria-busy="false"]');
      await page.evaluate(() => { Math.random = A.random; });
      const saved = await storageSnapshot(page);
      if (pattern !== "late-auto") {
        // Fixed RNG gives 5.8s just-start (7.25s for the tutorial); 1s is early in either context.
        await page.evaluate(() => { A.now = 2000; });
        const count = pattern === "early" ? 3 : 1;
        for (let i = 0; i < count; i++) await page.locator(`[data-test="coal-${i}"]`).click();
      }
      if (pattern !== "early") {
        // No input for remaining coals: production burnCoals drops them after p > 1.75.
        await page.evaluate(() => { A.now = 21000; });
      }
      await page.waitForSelector(".result-card.show");
      const actual = await page.evaluate(() => ({
        picks: A.cs.heat.picks,
        automatic: A.cs.heat.timings.map(t => t.automatic),
        over: A.cs.heat.over,
        score: A.cs.heat.score,
      }));
      const expected = pattern === "late-auto" ? ["over", "over", "over"]
        : pattern === "early" ? ["raw", "raw", "raw"] : ["raw", "over", "over"];
      assert.deepEqual(actual.picks, expected);
      assert.deepEqual(actual.automatic, pattern === "late-auto" ? [true, true, true]
        : pattern === "early" ? [false, false, false] : [false, true, true]);
      assert.equal(actual.over, pattern === "early" ? 0 : pattern === "mixed" ? 2 : 3);
      assert.equal(actual.score, pattern === "early" ? 15 : pattern === "mixed" ? 50 : 68);
      const feedback = page.locator('[data-test="craft-feedback"]');
      await feedback.waitFor({ state: "visible" });
      const text = await feedback.textContent();
      if (pattern === "late-auto") {
        assert.match(text, /取り出しが遅れた.*全面が赤くなったら、待たずに取り出そう/);
        assert(!/消えるまで待|焦らず待/.test(text), "Late timeout must not advise waiting longer");
      } else if (pattern === "early") {
        assert.match(text, /早く取り出した.*黒い面が消えるまで待とう/);
      } else {
        assert.match(text, /早い炭と遅い炭.*全面が赤くなった炭から取り出そう/);
      }
      const summary = await page.locator('[data-test="step-summary"]').textContent();
      assert.equal(summary.includes("・自動"), pattern !== "early");
      assert.match(summary, /取り頃で取れた炭はなかった/);
      assert(!/次は.*待とう/.test(summary), "The summary must describe the picks without contradicting timing advice");
      assert.equal(await page.locator('[data-test="craft-rating"]').textContent(), pattern === "late-auto" ? "○" : "△",
        "Timing misses and the existing heat evaluation remain separate axes");
      assert.deepEqual(await storageSnapshot(page), saved, "Heat results must not write player saves");
      await page.locator('[data-test="step-next"]').click();
      await page.evaluate(async () => { await A.run; performance.now = A.realNow; Math.random = A.random; });
    });
  }
});
