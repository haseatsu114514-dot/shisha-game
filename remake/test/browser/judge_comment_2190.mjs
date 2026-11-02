// #2190 final item 6: saved craft fixtures rendered through the actual final result table.
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

await suite("judge-comment-2190", async check => {
  for (const viewport of [{ width: 1180, height: 740 }, { width: 1280, height: 720 }]) {
    await check(`${viewport.width}x${viewport.height}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const { temperatureBands } = await import("./js/craft/temperature-model.js");
        const { pullResult } = await import("./js/craft/conditions.js");
        const { finalize } = await import("./js/craft/score.js");
        const cs = { mode: "tournament", chapter: 1, water: .5, mix: { double_apple: 12 },
          equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
          holes: { total: 22, evenness: .6, outerEven: .6, innerExcess: 0, score: 60, minimumComplete: true },
          heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
          mixInfo: { score: 60, intensity: 5, total: 12 }, steam: { min: 5, hits: 2, score: 70 }, pack: "normal" };
        const bands = temperatureBands(cs);
        cs.pull = { ...pullResult(bands.center, 2, 0, bands, 3), temp: bands.center, pulls: 2 };
        const adjustment = { ...pullResult(bands.center, 1, 0, bands, 2), temp: bands.center, pulls: 1 };
        cs.careHistory = [{ ...adjustment }, { ...adjustment }];
        finalize(cs);
        window.J = { saved: JSON.stringify(cs), finalize, result: await import("./js/craft/result.js") };
      });
      const storage = await storageSnapshot(page);
      for (const [kind, expected] of [
        ["three-ideal", /提供も2回の調整も、いい温度だった/],
        ["three-ideal-next", /提供も2回の調整も、いい温度だった/],
        ["recorded-miss", /温度が合わなかったところ/],
        ["legacy", /いいねえ。そのまま丁寧にいこう/],
      ]) {
        await page.evaluate(kind => {
          J.cs = JSON.parse(J.saved);
          if (kind === "three-ideal-next") {
            Object.assign(J.cs.holes, { score: 95, evenness: .95, outerEven: .95 });
            Object.assign(J.cs.heat, { score: 95, heatPower: 95, heatStability: 95, burnRisk: 5, aromaRetention: 95 });
            delete J.cs.stats; J.finalize(J.cs);
          }
          if (kind === "recorded-miss") Object.assign(J.cs.careHistory[1], { temp: .2, score: 40, inZone: false });
          if (kind === "legacy") delete J.cs.pull.inZone;
          J.before = JSON.stringify(J.cs);
          J.run = J.result.resultTable(J.cs, J.result.outcomeOf(J.cs.total).rank);
        }, kind);
        await page.locator('[data-test="result-next"]').waitFor();
        const text = await page.locator(".rt-judge-comment").innerText();
        assert.match(text, expected);
        assert(!text.includes("温度をもっと揃えたい"));
        const quality = page.locator(".rt-part").filter({ has: page.locator("span", { hasText: /^完成品$/ }) });
        assert.equal(await quality.locator(".craft-evaluation").textContent(), "○");
        await assertFits(page, ".rt-judge-comment");
        if (kind === "three-ideal-next") {
          assert.match(await page.locator(".rt-next-tip").innerText(), /今回の記録を見て、次に試すことを選ぼう/);
          await assertFits(page, ".rt-next-tip");
        }
        assert(await page.evaluate(() => JSON.stringify(J.cs) === J.before), "Result comment leaves craft data unchanged");
        assert.deepEqual(await storageSnapshot(page), storage, "Result comment does not save or award anything");
        await page.locator('[data-test="result-next"]').click();
        await page.evaluate(async () => {
          await J.run;
          // The chapter normally clears the retired result when it opens the next scene.
          const { dropRetired } = await import("./js/core/ui.js"); dropRetired();
        });
        await page.locator('[data-test="tournament-result"]').waitFor({ state: "detached" });
      }
    }, { viewport });
  }
});
