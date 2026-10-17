// #401: real gram buttons and production steam/pull/care routes; rendering and judgments must agree.
import assert from "node:assert/strict";
import path from "node:path";
import { suite, assertFits } from "./support.mjs";

const near = (actual, expected, label = "") => assert(Math.abs(actual - expected) < .002, `${label}: ${actual} != ${expected}`);
const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
const bandsOf = async (page, selector = ".mix-temperature, .thermo") => {
  const thermometer = page.locator(selector);
  await thermometer.locator(".mix-thermal-scale, .thermo-tube").waitFor({ state: "visible" });
  return thermometer.evaluate(root => {
  const horizontal = root.classList.contains("mix-temperature");
  const bar = root.querySelector(horizontal ? ".mix-thermal-scale" : ".thermo-tube");
  const tube = bar.getBoundingClientRect();
  const scaleX = tube.width / bar.offsetWidth;
  if (!root.isConnected || tube.height <= 0) throw new Error("Thermometer detached or has no measurable tube");
  const bounds = selector => {
    const band = root.querySelector(selector).getBoundingClientRect();
    return horizontal ? [(band.left - tube.left - bar.clientLeft * scaleX) / (bar.clientWidth * scaleX), (band.right - tube.left - bar.clientLeft * scaleX) / (bar.clientWidth * scaleX)]
      : [(tube.bottom - band.bottom) / tube.height, (tube.bottom - band.top) / tube.height];
  };
  return { t: Number(root.dataset.tolerance), ideal: bounds(horizontal ? ".mix-thermal-ideal" : ".thermo-zone"), optimal: bounds(horizontal ? ".mix-thermal-optimal" : ".thermo-optimal"),
    gradient: getComputedStyle(root.querySelector(horizontal ? ".mix-thermal-scale" : ".thermo-scale")).backgroundImage };
});
};
const expectBands = async (page, t, selector) => {
  const bands = await bandsOf(page, selector);
  near(bands.t, t);
  const model = await page.evaluate(() => QA.conditions.temperatureBands(QA.cs));
  for (const [key, expected] of [["ideal", model.ideal], ["optimal", model.optimal]]) {
    expected.forEach((value, i) => near(bands[key][i], value, key));
  }
  assert(bands.gradient.includes("linear-gradient"));
  // The green color itself moves, in addition to the band outlines.
  const greenStop = /rgb\(103, 210, 163\) ([\d.]+)%/.exec(bands.gradient);
  assert(greenStop, bands.gradient); near(Number(greenStop[1]) / 100, model.ideal[0], "green gradient");
  return bands;
};
async function prepare(page, mode = "tournament") {
  await page.evaluate(async mode => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.state.flavorStock = { double_apple: 50, vanilla: 24 }; // mint comes from the real regulation
    const session = await import("./js/craft/session.js");
    const steps = await import("./js/craft/steps.js"), steam = await import("./js/craft/steam.js");
    const pull = await import("./js/craft/pull.js"), conditions = await import("./js/craft/conditions.js");
    const thermal = await import("./js/craft/thermal.js"), score = await import("./js/craft/score.js");
    const thermometer = await import("./js/craft/thermometer.js"), forecast = await import("./js/craft/steam-forecast.js");
    const cs = session.newSession(mode);
    await session.openBench(cs).ready;
    window.QA = { core, session, steps, steam, pull, conditions, thermal, score, thermometer, forecast, cs };
  }, mode);
}
const repeatClick = async (page, id, n) => { for (let i = 0; i < n; i++) await page.locator(`[data-test="${id}"]`).click(); };
const finishResult = async page => {
  await page.locator('[data-test="step-next"]:enabled').waitFor();
  await page.locator('[data-test="step-next"]').click();
  await page.evaluate(() => QA.run);
};
// Stop the real moving needle near the center of keep, then wait for the full inhalation.
const keep = async page => {
  await page.locator('[data-test="pull-stop"]:enabled').waitFor();
  await page.evaluate(async () => {
    const needle = document.querySelector('[data-test="pull-needle"]');
    while (Math.abs(Number(needle.dataset.pos) - 50) > 1.3) await new Promise(requestAnimationFrame);
    document.querySelector('[data-test="pull-stop"]').click();
  });
  await page.waitForFunction(() => !document.querySelector(".pull-play")?.dataset.draw);
};

await suite("mix-temperature", async check => {
  for (const [name, options] of [["desktop", {}],
    ["mobile", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["reduced-motion", { reducedMotion: "reduce" }]]) {
    await check(`preview-through-care-${name}`, async page => {
      await prepare(page);
      await page.evaluate(() => { QA.run = QA.steps.stepMix(QA.cs); });
      await page.locator('[data-test="mix-temperature-preview"]').waitFor();
      assert.equal(await page.locator('[data-test="mix-temperature"]').getAttribute("data-selected"), "false");
      assert.match(await page.locator(".mix-temperature-legend").textContent(), /未選択/);
      assert.equal(await page.locator('[data-test="thermo-pointer"]').isVisible(), false);
      assert.match(await page.locator(".mix-temperature").getAttribute("aria-label"), /未選択/);
      await assertFits(page, '.mix-temperature-preview, .mix-temperature, .mix-temperature-legend, [data-test="mix-ok"]');
      await repeatClick(page, "mix-plus-vanilla", 3); await repeatClick(page, "mix-plus-mint", 1);
      const small = await expectBands(page, .9);
      await repeatClick(page, "mix-plus-vanilla", 3); await repeatClick(page, "mix-plus-mint", 1);
      const large = await expectBands(page, .9);
      small.ideal.forEach((v, i) => near(v, large.ideal[i]));
      small.optimal.forEach((v, i) => near(v, large.optimal[i]));
      await repeatClick(page, "mix-plus-mint", 4); await expectBands(page, 1);
      await repeatClick(page, "mix-minus-vanilla", 6); await repeatClick(page, "mix-plus-mint", 6);
      const preview = await expectBands(page, 1.2);
      assert.equal(await page.locator(".mix-ideal").textContent(), "適温 52.3〜77.3%");
      assert.equal(await page.locator(".mix-optimal").textContent(), "最適温 59.6〜70.0%");
      assert.match(await page.locator('.flavor-row[data-flavor="mint"]').textContent(), /課題（支給）/);
      await assertFits(page, '.mix-temperature-preview, .mix-temperature, .mix-temperature-legend, [data-test="mix-ok"]');
      await page.screenshot({ path: path.join(shots, `mix-temperature-preview-${name}.png`) });
      await page.locator('[data-test="mix-ok"]').click(); await page.evaluate(() => QA.run);
      const mix = await page.evaluate(() => ({ mix: QA.cs.mix, mintStock: QA.core.state.flavorStock.mint || 0 }));
      assert.deepEqual(mix, { mix: { mint: 12 }, mintStock: 0 });

      // The real timer, forecast and steam path retain exactly the selected preview.
      await page.evaluate(() => {
        Object.assign(QA.cs, { steamSeconds: 600, steamVariation: { offset: 0, transfer: 1 },
          environment: { rainy: false, ambientC: 23, humidityPercent: 52 }, place: "four", pack: "normal",
          equip: { ...QA.cs.equip, charcoal: "cube_charcoal" },
          heat: { heatPower: 100, heatStability: 100, burnRisk: 0, aromaRetention: 100, score: 100 },
          holes: { total: 24, minimumComplete: true, evenness: 1, outerEven: 1, innerExcess: 0, inner: 2, score: 100 } });
        QA.run = QA.steps.stepSteamTime(QA.cs);
      });
      await page.locator('[data-test="timer-start"]').waitFor(); await expectBands(page, preview.t);
      assert.match(await page.locator('[data-test="steam-forecast-text"]').textContent(), /適温|最適温/);
      await page.locator('[data-test="timer-start"]').click(); await page.evaluate(() => QA.run);
      // Desktop exercises the live steam clock. Other profiles use the existing auto hook for completion.
      await page.evaluate(name => { QA.session.craftTest.auto = name === "desktop" ? null : "good"; QA.run = QA.steam.runSteamDodge(QA.cs); }, name);
      // The timer has the same data-test while steam assets are preparing. Measure
      // the new dodge screen's connected, visible tube, never the outgoing timer.
      await expectBands(page, preview.t, '.steam [data-test="steam-temperature"]');
      if (name === "desktop") {
        await page.locator('[data-test="dodge-refresh"]:enabled').waitFor();
        await page.locator('[data-test="step-next"]:enabled').waitFor({ timeout: 45000 });
        await finishResult(page);
      } else await page.evaluate(() => QA.run);
      const steam = await page.evaluate(() => ({ actual: QA.cs.steam.temp,
        expected: QA.conditions.temperatureAfterSteam(QA.cs, QA.cs.steamSeconds, QA.cs.steamVariation) }));
      near(steam.actual, steam.expected); assert(steam.actual > .59 && steam.actual < .708);
      await page.evaluate(() => { QA.session.craftTest.auto = null; QA.run = QA.pull.runPull(QA.cs); });
      await page.locator('[data-test="pull-stop"]:enabled').waitFor(); await expectBands(page, preview.t);
      await keep(page); await keep(page); await page.locator('[data-test="pull-serve"]').click();
      await page.locator('[data-test="step-next"]:enabled').waitFor();
      const result = await page.evaluate(() => ({ pull: QA.cs.pull,
        expected: QA.conditions.pullResult(QA.cs.pull.temp, QA.cs.pull.pulls, QA.cs.pull.justs, QA.conditions.temperatureBands(QA.cs)),
        background: document.querySelector(".bench").dataset.thermalBand,
        score: QA.cs.arcade.parts.pull, strain: QA.cs.strain || 0 }));
      assert.equal(result.pull.optimal, true); assert.equal(result.pull.inZone, true);
      assert.equal(result.pull.score, result.expected.score); assert.equal(result.background, "optimal");
      assert.equal(result.score, result.pull.score * 100); assert.equal(result.strain, 0);
      await finishResult(page);

      // Care uses the same model and the actual served temperature, including its ordinary cooling.
      await page.evaluate(() => { QA.run = QA.pull.runCare(QA.cs, { round: 1 }); });
      await page.locator('[data-test="care-coals"]').waitFor(); await expectBands(page, preview.t);
      await page.locator('[data-test="care-coal-0"]').click(); await keep(page);
      await page.locator('[data-test="pull-serve"]').click(); await page.locator('[data-test="step-next"]:enabled').waitFor();
      const care = await page.evaluate(() => ({ actual: QA.cs.care,
        expected: QA.conditions.pullResult(QA.cs.care.temp, QA.cs.care.pulls, QA.cs.care.justs, QA.conditions.temperatureBands(QA.cs), 2),
        score: QA.cs.arcade.parts.care1 }));
      for (const key of ["score", "inZone", "optimal"]) assert.equal(care.actual[key], care.expected[key]);
      assert(!care.actual.failed); assert.equal(care.score, care.actual.score * 200);
      await finishResult(page);
      assert.equal(await page.evaluate(() => QA.cs.careHistory[0].temp), care.actual.temp);
      await page.evaluate(async () => { QA.session.craftTest.auto = "good"; await QA.pull.runCare(QA.cs, { round: 2 }); QA.score.finalize(QA.cs); });
      await expectBands(page, preview.t);
      const final = await page.evaluate(() => ({ history: QA.cs.careHistory, total: QA.cs.total, parts: QA.cs.parts }));
      assert.equal(final.history.length, 2); assert(final.history.every(item => !item.failed)); assert(Number.isFinite(final.total));
      assert.equal(final.parts.care1, final.history[0].score); assert.equal(final.parts.care2, final.history[1].score);
    }, options);
  }

  for (const [name, options] of [["desktop", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`recipe-and-width-comparison-${name}`, async page => {
      await prepare(page, "drill");
      await page.evaluate(() => {
        QA.core.state.flavors.push("mint", "nightside_earlgrey", "dobaj_double_apple");
        Object.assign(QA.core.state.flavorStock, { mint: 24, nightside_earlgrey: 24, dobaj_double_apple: 24 });
      });
      const rows = [];
      for (const [id, mix] of [["basic", { double_apple: 9, mint: 3 }], ["peaky", { nightside_earlgrey: 12 }],
        ["peaky-dobaj", { nightside_earlgrey: 9, vanilla: 3 }]]) {
        await page.evaluate(async () => {
          QA.cs = QA.session.newSession("drill");
          await QA.session.openBench(QA.cs).ready;
          QA.run = QA.steps.stepMix(QA.cs);
        });
        await page.locator('[data-test="mix-plus-double_apple"]').waitFor();
        for (const [flavor, grams] of Object.entries(mix)) for (let i = 0; i < grams; i++) {
          const button = page.locator(`[data-test="mix-plus-${flavor}"]`);
          if (name === "touch") await button.tap(); else await button.click();
        }
        const bands = await page.evaluate(() => QA.conditions.temperatureBands(QA.cs));
        await expectBands(page, bands.t);
        await assertFits(page, '.mix-temperature-preview, .mix-temperature-legend, [data-test="mix-ok"]');
        rows.push({ id, ...bands });
        await page.screenshot({ path: path.join(shots, `thermal-${id}-${name}.png`) });
        await page.locator('[data-test="mix-ok"]').click(); await page.evaluate(() => QA.run);
      }
      assert(rows[2].ideal[1] - rows[2].ideal[0] > rows[1].ideal[1] - rows[1].ideal[0]);
      assert(rows[2].center < rows[1].center);
      // Reuse live meters. Same-t maker and equipment edits must move the endpoints without moving center.
      const changed = await page.evaluate(() => {
        QA.cs.mix = { double_apple: 12 };
        const meter = QA.thermometer.buildThermometer({ cs: QA.cs });
        const gauge = QA.thermometer.buildMixTemperatureGauge(QA.cs);
        QA.session.stepPanel("pull", "幅変更の確認").append(meter.root, gauge.root);
        const read = () => { meter.update(.54); const b = gauge.updateBands(); return { ...b, meter: { ...meter.root.dataset }, gauge: { ...gauge.root.dataset } }; };
        const a = read(); QA.cs.mix = { dobaj_double_apple: 12 }; const b = read();
        QA.cs.equip.charcoal = "cube_charcoal"; const c = read();
        return [a, b, c];
      });
      for (const row of changed) {
        near(row.center, .54);
        for (const view of [row.meter, row.gauge]) { near(Number(view.idealLow), row.ideal[0]); near(Number(view.optimalHigh), row.optimal[1]); }
      }
      assert.notEqual(changed[0].meter.idealLow, changed[1].meter.idealLow);
      assert.notEqual(changed[1].meter.idealLow, changed[2].meter.idealLow);
    }, options);
  }

  await check("highest-tolerance-green-does-not-strain", async page => {
    await prepare(page, "drill");
    await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      const flavor = DB.flavors.reduce((best, item) => item.heat_tolerance > best.heat_tolerance ? item : best);
      QA.cs.mix = { [flavor.id]: 12 };
      const bands = QA.conditions.temperatureBands(QA.cs);
      QA.cs.steam = { temp: bands.ideal[1] - .02, score: 100 };
      QA.session.craftTest.auto = null;
      QA.run = QA.pull.runPull(QA.cs);
    });
    await page.locator('[data-test="pull-stop"]:enabled').waitFor(); await expectBands(page, 1.3);
    await keep(page); await keep(page); await page.locator('[data-test="pull-serve"]').click();
    await page.locator('[data-test="step-next"]:enabled').waitFor();
    const result = await page.evaluate(() => ({ actual: QA.cs.pull, strain: QA.cs.strain || 0,
      effect: document.querySelector(".bench").dataset.thermalBand, haze: document.querySelector(".bench").dataset.thermalHaze }));
    assert(result.actual.temp > .75 && result.actual.inZone && !result.actual.over && !result.actual.optimal);
    assert.equal(result.strain, 0); assert.equal(result.effect, "ready"); assert.equal(result.haze, "0");
    await finishResult(page);
  });

  await check("all-bands-boundaries-and-session-isolation", async page => {
    await prepare(page, "drill");
    const results = await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      const { el } = await import("./js/core/util.js");
      const { session, conditions, thermometer, forecast, thermal, score } = QA;
      const rows = [];
      for (const flavor of DB.flavors) {
        const cs = { mix: { [flavor.id]: 12 } }, bands = conditions.temperatureBands(cs);
        const meter = thermometer.buildThermometer({ cs });
        const steam = forecast.buildSteamTemperature(cs);
        session.stepPanel("pull", "境界値").append(meter.root, steam.root);
        for (const band of [bands.ideal, bands.optimal]) for (const temp of [band[0] - 1e-7, band[0], band[0] + 1e-7, band[1] - 1e-7, band[1], band[1] + 1e-7]) {
          meter.update(temp); steam.update(temp);
          const actual = conditions.pullResult(temp, 2, 0, bands), effect = thermal.thermalBand(temp, bands);
          rows.push({ id: flavor.id, temp, ideal: meter.root.classList.contains("ok"), optimal: meter.root.classList.contains("optimal"),
            steamIdeal: steam.root.classList.contains("ok"), steamOptimal: steam.root.classList.contains("optimal"), actual,
            ready: effect.id === "ready" || effect.id === "optimal", rainbow: effect.id === "optimal" });
        }
      }
      const a = session.newSession("drill"), b = session.newSession("drill");
      a.mix = { mint: 12 }; b.mix = { vanilla: 12 };
      const ma = thermometer.buildThermometer({ cs: a }), mb = thermometer.buildThermometer({ cs: b });
      session.stepPanel("pull", "セッション分離").append(el("div", [ma.root, mb.root]));
      ma.update(.76); mb.update(.76);
      const before = { a: ma.root.classList.contains("ok"), b: mb.root.classList.contains("ok"), bt: mb.root.dataset.tolerance };
      a.mix = { double_apple: 12 }; ma.update(.54);
      const isolated = before.a && !before.b && mb.root.dataset.tolerance === before.bt && conditions.temperatureBands(b).t === .8;
      // Stale fixed-band flags must not determine burn risk when the real temperature is available.
      const base = { equip: {}, mix: { mint: 12 }, pull: { score: 80, temp: .76, pulls: 2, over: true } };
      const mintRisk = score.computeShisha(base).burnRisk;
      const mintCenterRisk = score.computeShisha({ ...base, pull: { ...base.pull, temp: .648, over: false } }).burnRisk;
      const afBase = { ...base, mix: { cotton_candy: 12 }, pull: { ...base.pull, temp: .58, over: false } };
      const afRisk = score.computeShisha(afBase).burnRisk;
      const afCenterRisk = score.computeShisha({ ...afBase, pull: { ...afBase.pull, temp: .432 } }).burnRisk;
      const vanillaBase = { ...base, mix: { vanilla: 12 }, pull: { ...base.pull, temp: .61, over: false } };
      const vanillaRisk = score.computeShisha(vanillaBase).burnRisk;
      const vanillaCenterRisk = score.computeShisha({ ...vanillaBase, pull: { ...vanillaBase.pull, temp: .432 } }).burnRisk;
      return { rows, isolated, mintRisk, mintCenterRisk, afRisk, afCenterRisk, vanillaRisk, vanillaCenterRisk };
    });
    for (const row of results.rows) {
      assert.equal(row.ideal, row.actual.inZone, JSON.stringify(row)); assert.equal(row.optimal, row.actual.optimal, JSON.stringify(row));
      assert.equal(row.steamIdeal, row.ideal); assert.equal(row.steamOptimal, row.optimal);
      assert.equal(row.ready, row.ideal); assert.equal(row.rainbow, row.optimal);
    }
    assert(results.rows.length >= 768); assert(results.isolated);
    assert.equal(results.mintRisk, results.mintCenterRisk);
    assert.equal(results.afRisk - results.afCenterRisk, 12);
    assert.equal(results.vanillaRisk - results.vanillaCenterRisk, 6);
  });

  await check("legacy-save-care-start-and-auto-targets", async page => {
    await prepare(page, "drill");
    const result = await page.evaluate(async () => {
      const { core, session, pull, conditions } = QA;
      const old = { schema: 5, chapter: 1, day: 3, stamina: 60, flavors: ["double_apple"], flags: {},
        stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 } };
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(old)); core.load();
      const legacy = session.newSession("drill"), cases = [];
      session.craftTest.auto = "good";
      for (const id of ["vanilla", "mint", "double_apple"]) {
        const cs = session.newSession("drill"); cs.mix = { [id]: 12 };
        const bands = conditions.temperatureBands(cs);
        const start = pull.careStartTemp(cs), invalid = pull.careStartTemp({ ...cs, pull: { temp: NaN } });
        await session.openBench(cs).ready;
        cs.steam = { temp: bands.center, score: 100 };
        await pull.runPull(cs);
        const actual = { ...cs.pull };
        await pull.runCare(cs);
        cases.push({ id, bands, start, invalid, actual, care: cs.care, strain: cs.strain || 0 });
      }
      return { legacy: conditions.temperatureBands(legacy), cases };
    });
    assert.equal(result.legacy.t, 1);
    for (const row of result.cases) {
      near(row.start, row.bands.center); near(row.invalid, row.bands.center);
      assert(row.actual.optimal && row.care.optimal, JSON.stringify(row));
      near(row.actual.temp, row.bands.center); assert.equal(row.strain, 0);
    }
    // The old session cannot change the newly mounted shisha's thermal display.
    const stale = await page.evaluate(() => {
      const current = document.querySelector(".bench").dataset.thermalBand;
      QA.session.setBenchTemperature(QA.cs, 1);
      return { current, after: document.querySelector(".bench").dataset.thermalBand };
    });
    assert.equal(stale.after, stale.current);
  });
});
