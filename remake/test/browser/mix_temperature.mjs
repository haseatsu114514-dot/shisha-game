// #401: real gram buttons and production steam/pull/care routes; rendering and judgments must agree.
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const near = (actual, expected, label = "") => assert(Math.abs(actual - expected) < .002, `${label}: ${actual} != ${expected}`);
const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
const bandsOf = async (page, selector = ".mix-temperature, .thermo") => {
  const thermometer = page.locator(selector);
  await thermometer.locator(".mix-thermal-scale, .thermo-tube").waitFor({ state: "visible" });
  return thermometer.evaluate(root => {
  const horizontal = !!root.querySelector(".mix-thermal-scale");
  const bar = root.querySelector(horizontal ? ".mix-thermal-scale" : ".thermo-tube");
  const tube = bar.getBoundingClientRect();
  const scaleX = tube.width / bar.offsetWidth;
  if (!root.isConnected || tube.height <= 0) throw new Error("Thermometer detached or has no measurable tube");
  const bounds = selector => {
    const node = root.querySelector(selector);
    if (node.hidden) return null;
    const band = node.getBoundingClientRect();
    return horizontal ? [(band.left - tube.left - bar.clientLeft * scaleX) / (bar.clientWidth * scaleX), (band.right - tube.left - bar.clientLeft * scaleX) / (bar.clientWidth * scaleX)]
      : [(tube.bottom - band.bottom) / tube.height, (tube.bottom - band.top) / tube.height];
  };
  return { t: Number(root.dataset.tolerance), ideal: bounds(horizontal ? ".mix-thermal-ideal" : ".thermo-zone"), optimal: bounds(horizontal ? ".mix-thermal-optimal" : ".thermo-optimal"),
    expressionMode: root.dataset.expressionMode,
    gradient: getComputedStyle(root.querySelector(horizontal ? ".mix-thermal-scale" : ".thermo-scale")).backgroundImage };
});
};
const expectBands = async (page, t, selector) => {
  const bands = await bandsOf(page, selector);
  near(bands.t, t);
  const model = await page.evaluate(() => QA.conditions.temperatureBands(QA.cs));
  for (const [key, expected] of [["ideal", model.ideal], ["optimal", model.optimal]]) {
    if (key === "optimal" && model.expressionWeight >= .999) { assert.equal(bands[key], null, "Expressive blends must not mark only the middle as best"); continue; }
    expected.forEach((value, i) => near(bands[key][i], value, key));
  }
  assert.equal(bands.expressionMode, model.expressionWeight >= .999 ? "broad" : "focused");
  assert(bands.gradient.includes("linear-gradient"));
  // The green color itself moves, in addition to the band outlines.
  const greenStop = /rgb\(103, 210, 163\) ([\d.]+)%/.exec(bands.gradient);
  assert(greenStop, bands.gradient); near(Number(greenStop[1]) / 100, model.ideal[0], "green gradient");
  return bands;
};
async function prepare(page, mode = "tournament") {
  await page.evaluate(async mode => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.state.flavorStock = { double_apple: 50, vanilla: 24 };
    // この温度回帰は既に開始済みの旧ミント大会を継続する経路。新大会の私物レモンはflavor_masteryで検証する。
    if (mode === "tournament") { core.state.schema = 20; core.state.phase = "tournament"; core.save(); core.load(); }
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
      assert.equal(await page.locator(".mix-ideal").textContent(), "おいしい範囲");
      assert.equal(await page.locator(".mix-optimal").textContent(), "低め／高め");
      assert.equal(await page.locator('[data-test="mix-optimal"]').isVisible(), false);
      assert.match(await page.locator(".mix-temperature").getAttribute("aria-label"), /低めと高めで香りが変わる/);
      assert.doesNotMatch(await page.locator(".mix-temperature-legend").textContent(), /[\d%]/);
      assert.doesNotMatch(await page.locator(".mix-temperature").getAttribute("aria-label"), /[\d%]/);
      assert.equal(await page.locator('[data-test="mix-ratio-mint"]').textContent(), "比率 100%");
      assert.match(await page.locator('.flavor-row[data-flavor="mint"]').textContent(), /課題（支給）/);
      await assertFits(page, '.mix-temperature-preview, .mix-temperature, .mix-temperature-legend, [data-test="mix-ok"]');
      await page.screenshot({ path: path.join(shots, `mix-temperature-preview-${name}.png`) });
      await page.locator('[data-test="mix-ok"]').click(); await page.evaluate(() => QA.run);
      const mix = await page.evaluate(() => ({ mix: QA.cs.mix, mintStock: QA.core.state.flavorStock.mint || 0 }));
      assert.deepEqual(mix, { mix: { mint: 12 }, mintStock: 0 });

      // The real timer, forecast and steam path retain exactly the selected preview.
      await page.evaluate(() => {
        Object.assign(QA.cs, { water: 0.5, steamSeconds: 600, steamVariation: { offset: 0, transfer: 1 },
          environment: { rainy: false, ambientC: 23, humidityPercent: 52 }, place: "four", pack: "normal",
          equip: { ...QA.cs.equip, charcoal: "cube_charcoal" },
          heat: { heatPower: 100, heatStability: 100, burnRisk: 0, aromaRetention: 100, score: 100 },
          holes: { total: 24, minimumComplete: true, evenness: 1, outerEven: 1, innerExcess: 0, inner: 2, score: 100 } });
        QA.run = QA.steps.stepSteamTime(QA.cs);
      });
      await page.locator('[data-test="timer-start"]').waitFor(); await expectBands(page, preview.t);
      assert.match(await page.locator('[data-test="steam-forecast-text"]').textContent(), /適温|おいし/);
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
      assert.equal(result.pull.score, result.expected.score); assert.equal(result.background, "ready");
      assert.equal(result.pull.score, 100);
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
        ["peaky-dobaj", { nightside_earlgrey: 9, dobaj_double_apple: 3 }]]) {
        await page.evaluate(async () => {
          QA.cs = QA.session.newSession("drill"); QA.cs.staffPractice = true;
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
        // Same initial heat, weather, equipment, packing and two keep inputs; only the recipe changes.
        await page.evaluate(() => {
          Object.assign(QA.cs, { water: 0.5, steamSeconds: 300, steam: { temp: .64, score: 100, seconds: 300 }, pack: "normal", place: "triangle",
            environment: { rainy: false, ambientC: 23, humidityPercent: 52 },
            heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
            holes: { total: 24, minimumComplete: true, outerEven: 1, evenness: 1, innerExcess: 0, inner: 2, score: 80 } });
          QA.session.craftTest.auto = null; QA.run = QA.pull.runPull(QA.cs);
        });
        await keep(page); await keep(page); await page.locator('[data-test="pull-serve"]').click();
        await page.locator('[data-test="step-next"]:enabled').waitFor();
        const measured = await page.evaluate(() => ({ pull: QA.cs.pull, quality: QA.score.computeShisha(QA.cs),
          expected: QA.conditions.pullResult(QA.cs.pull.temp, QA.cs.pull.pulls, QA.cs.pull.justs, QA.conditions.temperatureBands(QA.cs)) }));
        assert.equal(measured.pull.score, measured.expected.score);
        assert.equal(measured.pull.inZone, measured.expected.inZone);
        assert.equal(measured.pull.optimal, measured.expected.optimal);
        Object.assign(rows.at(-1), measured);
        await finishResult(page);
      }
      assert(rows[2].ideal[1] - rows[2].ideal[0] > rows[1].ideal[1] - rows[1].ideal[0]);
      assert(rows[2].center < rows[1].center);
      fs.writeFileSync(path.join(shots, `thermal-comparison-${name}.json`), JSON.stringify({
        initialTemperature: .64, totalGrams: 12, steamSeconds: 300, pulls: 2, rows,
      }, null, 2) + "\n");
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

  await check("expressive-labels-fit-through-care", async page => {
    await page.evaluate(async () => {
      const { TITLE_LAYOUT_KEY } = await import("./js/scenes/title-layout.js");
      localStorage.setItem(TITLE_LAYOUT_KEY, "ds");
      window.dispatchEvent(new Event("display-layout-change"));
    });
    await prepare(page, "drill");
    await page.locator("body.game-ds").waitFor();
    for (const care of [false, true]) for (const high of [false, true]) {
      await page.evaluate(async ({ care, high }) => {
        const cs = QA.session.newSession("drill");
        cs.mix = { mint: 12 }; cs.mixInfo = { total: 12 }; cs.pack = "normal";
        const bands = QA.conditions.temperatureBands(cs);
        const temp = high ? bands.ideal[1] - .04 : bands.ideal[0] + .04;
        cs.steam = { temp, score: 100 };
        cs.holes = { total: 24, minimumComplete: true };
        if (care) cs.pull = { temp, score: 100, pulls: 2 };
        QA.cs = cs; QA.session.craftTest.auto = null;
        await QA.session.openBench(cs).ready;
        QA.run = care ? QA.pull.runCare(cs) : QA.pull.runPull(cs);
      }, { care, high });
      if (care) await page.locator('[data-test="care-coal-0"]').click();
      await page.locator('[data-test="pull-stop"]:enabled').waitFor();
      await page.locator(".pull-state").filter({ hasText: high ? "適温・高" : "適温・低" }).waitFor();
      await assertFits(page, ".pull-read");
      assert.equal(await page.locator(".thermo-optimal").isVisible(), false);
      assert.equal(await page.locator(".pull-drift").count(), care ? 1 : 0);
      // render() replaces the live label each frame; query it and measure it in one browser task.
      assert(await page.evaluate(() => {
        const node = document.querySelector(".pull-state");
        const text = node.getBoundingClientRect(), box = node.parentElement.getBoundingClientRect();
        const front = document.elementFromPoint(text.left + text.width / 2, text.top + text.height / 2);
        return text.width > 0 && text.height > 0 && node.scrollWidth <= node.clientWidth + 1
          && node.scrollHeight <= node.clientHeight + 1 && text.left >= box.left - 1 && text.right <= box.right + 1
          && text.top >= box.top - 1 && text.bottom <= box.bottom + 1 && node.contains(front);
      }), "The low/high label must fit and remain in front of the audience panel, including while coals are cooling");
      await page.screenshot({ path: path.join(shots, `expression-${care ? "care" : "pull"}-${high ? "high" : "low"}-ds.png`) });
      // Finish each live stage before mounting the next shisha; a cancelled care is an error.
      await keep(page);
      if (!care) await keep(page);
      await page.locator('[data-test="pull-serve"]').click();
      await finishResult(page);
    }
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

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
          rows.push({ id: flavor.id, temp, expressive: bands.expressionWeight >= .999,
            ideal: meter.root.classList.contains("ok"), optimal: meter.root.classList.contains("optimal"),
            steamIdeal: steam.root.classList.contains("ok"), steamOptimal: steam.root.classList.contains("optimal"), actual,
            ready: effect.id === "ready" || effect.id === "optimal", rainbow: effect.id === "optimal" });
        }
      }
      // Reusing a meter must update its expression mode even when center and width are unchanged.
      const switched = { mix: { orange: 12 } };
      const switchedMeter = thermometer.buildThermometer({ cs: switched });
      const switchedGauge = thermometer.buildMixTemperatureGauge(switched);
      session.stepPanel("pull", "味の作り分け").append(switchedMeter.root, switchedGauge.root);
      const modes = [];
      for (const id of ["orange", "double_apple", "orange"]) {
        switched.mix = { [id]: 12 };
        const bands = conditions.temperatureBands(switched);
        switchedMeter.update(bands.center); switchedGauge.updateBands();
        modes.push({ id, center: bands.center, width: bands.totalWidthScale,
          mode: switchedMeter.root.dataset.expressionMode,
          centerHidden: switchedMeter.root.querySelector(".thermo-optimal").hidden,
          horizontalCenterHidden: switchedGauge.root.querySelector(".mix-thermal-optimal").hidden,
          optimal: switchedMeter.root.classList.contains("optimal"),
          text: switchedMeter.root.getAttribute("aria-valuetext"),
          lowScore: conditions.pullResult(bands.ideal[0], 2, 0, bands).score,
          highScore: conditions.pullResult(bands.ideal[1], 2, 0, bands).score });
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
      return { rows, modes, isolated, mintRisk, mintCenterRisk, afRisk, afCenterRisk, vanillaRisk, vanillaCenterRisk };
    });
    for (const row of results.rows) {
      assert.equal(row.ideal, row.actual.inZone, JSON.stringify(row)); assert.equal(row.optimal, row.actual.optimal && !row.expressive, JSON.stringify(row));
      assert.equal(row.steamIdeal, row.ideal); assert.equal(row.steamOptimal, row.optimal);
      assert.equal(row.ready, row.ideal); assert.equal(row.rainbow, row.optimal);
    }
    assert(results.rows.length >= 768); assert(results.isolated);
    assert.deepEqual(results.modes.map(m => m.mode), ["focused", "broad", "focused"]);
    assert.deepEqual(results.modes.map(m => m.centerHidden), [false, true, false]);
    assert.deepEqual(results.modes.map(m => m.horizontalCenterHidden), [false, true, false]);
    assert.deepEqual(results.modes.map(m => m.optimal), [true, false, true]);
    assert.equal(new Set(results.modes.map(m => m.center)).size, 1);
    assert.equal(new Set(results.modes.map(m => m.width)).size, 1);
    assert.match(results.modes[1].text, /おいしく作れる範囲/);
    assert.equal(results.modes[1].lowScore, 100); assert.equal(results.modes[1].highScore, 100);
    assert.equal(results.mintRisk, results.mintCenterRisk);
    assert.equal(results.afRisk - results.afCenterRisk, 12);
    assert.equal(results.vanillaRisk - results.vanillaCenterRisk, 12);
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
