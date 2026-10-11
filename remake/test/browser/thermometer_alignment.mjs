// #324: the current-temperature arrow must use the same value as the fixed optimal band.
import assert from "node:assert/strict";
import { suite, storageSnapshot } from "./support.mjs";

await suite("thermometer-alignment", async check => {
  for (const [name, options] of [
    ["desktop", {}],
    ["mobile-rotation", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["reduced-motion", { reducedMotion: "reduce" }],
  ]) {
    await check(name, async page => {
      const stored = await storageSnapshot(page);
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        const { buildThermometer } = await import("./js/craft/thermometer.js");
        const { el } = await import("./js/core/util.js");
        const conditions = await import("./js/craft/conditions.js");
        const cs = session.newSession("drill");
        const bench = session.openBench(cs); await bench.ready;
        window.QA = { session, buildThermometer, el, conditions, cs };
      });
      // Rotating the same mounted bench exercises the game's stage scaling, not a new page.
      const viewports = name === "mobile-rotation"
        ? [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
        : [options.viewport || { width: 1280, height: 720 }];
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        const measurements = await page.evaluate(async () => {
          const { session, buildThermometer, el, conditions } = QA;
          const results = [];
          for (const step of ["steam-timer", "steam", "pull", "care"]) {
            const compact = step.startsWith("steam");
            const meter = buildThermometer({ compact, height: 360, width: 64 });
            const panel = session.stepPanel(step, "温度");
            panel.append(el(`div.${step === "care" ? "pull" : step}`, [meter.root]));
            for (const temp of [0, .2, .42, .489, .49, .54, .59, .591, .66, .9, 1, .54]) {
              meter.update(temp);
              await new Promise(requestAnimationFrame);
              const tube = meter.root.querySelector(".thermo-tube").getBoundingClientRect();
              const arrow = meter.root.querySelector(".thermo-pointer").getBoundingClientRect();
              const mark = meter.root.querySelector(".thermo-mark").getBoundingClientRect();
              const band = meter.root.querySelector(".thermo-optimal").getBoundingClientRect();
              results.push({ step, temp, arrow: (tube.bottom - arrow.y - arrow.height / 2) / tube.height,
                mark: (tube.bottom - mark.y - mark.height / 2) / tube.height,
                low: (tube.bottom - band.bottom) / tube.height, high: (tube.bottom - band.top) / tube.height,
                optimal: meter.root.classList.contains("optimal"), expected: conditions.isOptimalTemperature(temp),
                bounds: conditions.OPTIMAL });
            }
          }
          return results;
        });
        for (const m of measurements) {
          assert(Math.abs(m.arrow - m.temp) < .002, `Arrow lags behind judgment: ${JSON.stringify(m)}`);
          assert(Math.abs(m.mark - m.temp) < .002, JSON.stringify(m));
          assert(Math.abs(m.low - m.bounds[0]) < .001 && Math.abs(m.high - m.bounds[1]) < .001,
            `Optimal band moved: ${JSON.stringify(m)}`);
          assert.equal(m.optimal, m.expected);
        }
      }
      // Use the real inhalation input and animation, including the crossing into optimal heat.
      await page.evaluate(async () => {
        const { runPull } = await import("./js/craft/pull.js");
        Object.assign(QA.cs, { steam: { temp: .47 }, heat: { heatPower: 50 },
          holes: { total: 24, minimumComplete: true }, place: "triangle" });
        window.pullRun = runPull(QA.cs);
      });
      await page.locator('[data-test="pull-stop"]:enabled').waitFor();
      const draw = await page.evaluate(async () => {
        while (Number(document.querySelector('[data-test="pull-needle"]').dataset.pos) < 85) {
          await new Promise(requestAnimationFrame);
        }
        document.querySelector('[data-test="pull-stop"]').click();
        let maxError = 0, optimalSamples = 0, samples = 0;
        while (document.querySelector(".pull-play").dataset.draw) {
          await new Promise(requestAnimationFrame);
          const root = document.querySelector(".thermo"), temp = Number(root.getAttribute("aria-valuenow"));
          const tube = root.querySelector(".thermo-tube").getBoundingClientRect();
          const arrow = root.querySelector(".thermo-pointer").getBoundingClientRect();
          maxError = Math.max(maxError, Math.abs((tube.bottom - arrow.y - arrow.height / 2) / tube.height - temp));
          if (root.classList.contains("optimal")) optimalSamples++;
          samples++;
        }
        return { maxError, optimalSamples, samples };
      });
      assert(draw.samples > 1 && draw.optimalSamples > 0, JSON.stringify(draw));
      assert(draw.maxError < .002, `Inhalation arrow disagrees with temperature: ${JSON.stringify(draw)}`);
      assert.deepEqual(await storageSnapshot(page), stored, "Rendering wrote save data");
    }, options);
  }
});
