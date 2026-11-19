// Packing shows the confirmed mix temperature bands; packing only changes the heat-entry note.
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
fs.mkdirSync(shots, { recursive: true });

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.state.flavorStock = { double_apple: 50, mint: 50, vanilla: 24 };
    core.state.flags._dense_pack_legacy = true;
    const session = await import("./js/craft/session.js");
    const steps = await import("./js/craft/steps.js");
    const conditions = await import("./js/craft/conditions.js");
    const cs = session.newSession("rehearsal");
    cs.mix = { double_apple: 9, mint: 3 };
    cs.mixInfo = steps.evaluateMix(cs);
    cs.equip = cs.equip || { bowl: "phunnel_basic", hms: "kaloud", charcoal: "cube_charcoal" };
    await session.openBench(cs).ready;
    window.QA = { core, session, steps, conditions, cs };
  });
}

await suite("packing-temperature", async check => {
  await check("pack-gauge-1280", async page => {
    await prepare(page);
    await page.evaluate(() => { QA.run = QA.steps.stepPack(QA.cs); });
    await page.locator('[data-test="pack-temperature-preview"]').waitFor();
    assert.equal(await page.locator('[data-test="pack-temperature-preview"]').isVisible(), true);
    assert.equal(await page.locator('[data-test="mix-temperature"]').getAttribute("data-selected"), "true");
    const parked = page.locator('[data-test="thermo-pointer"]');
    assert(await parked.isVisible(), "preheat pointer stays at the bottom");
    const center = await parked.evaluate(p => {
      const a = p.getBoundingClientRect(), tube = p.closest(".thermo").querySelector(".thermo-tube").getBoundingClientRect();
      return Math.abs(a.top + a.height / 2 - tube.bottom);
    });
    assert(center < 3, "preheat pointer must line up with the bottom of the glass");
    assert.equal(await page.locator(".thermo").getAttribute("aria-valuenow"), null, "no measured heat before steaming");
    const expected = await page.evaluate(() => QA.conditions.temperatureBands(QA.cs));
    const shown = await page.locator('[data-test="mix-temperature"]').evaluate(root => ({
      t: Number(root.dataset.tolerance),
      idealLow: Number(root.dataset.idealLow),
      idealHigh: Number(root.dataset.idealHigh),
    }));
    assert.equal(shown.t, expected.t);
    assert.equal(shown.idealLow, expected.ideal[0]);
    assert.equal(shown.idealHigh, expected.ideal[1]);
    assert.match(await page.locator('[data-test="pack-heat-hint"]').textContent(), /熱は標準/);
    assert.equal(await page.locator('[data-test="pack-temperature-preview"]').getAttribute("data-pack"), "normal");

    await page.locator('[data-test="opt-fluffy"]').click();
    assert.equal(await page.locator('[data-test="pack-temperature-preview"]').getAttribute("data-pack"), "fluffy");
    assert.match(await page.locator('[data-test="pack-heat-hint"]').textContent(), /熱が早い/);
    const afterFluffy = await page.locator('[data-test="mix-temperature"]').evaluate(root => Number(root.dataset.tolerance));
    assert.equal(afterFluffy, expected.t, "packing must not move the band");

    await page.locator('[data-test="opt-firm"]').click();
    assert.match(await page.locator('[data-test="pack-heat-hint"]').textContent(), /熱が遅い/);
    assert.equal(await page.locator('[data-test="pack-temperature-preview"]').getAttribute("data-pack"), "firm");

    await assertFits(page, '[data-test="pack-temperature-preview"], .mix-temperature, .mix-temperature-legend, [data-test="pack-confirm"]');
    await page.screenshot({ path: path.join(shots, "packing-temperature-1280.png") });

    const before = await page.evaluate(() => JSON.stringify({ mix: QA.cs.mix, mixInfo: QA.cs.mixInfo }));
    await page.locator('[data-test="pack-confirm"]').click();
    await page.evaluate(() => QA.run);
    const after = await page.evaluate(() => ({ pack: QA.cs.pack, snap: JSON.stringify({ mix: QA.cs.mix, mixInfo: QA.cs.mixInfo }) }));
    assert.equal(after.pack, "firm");
    assert.equal(after.snap, before, "confirming pack must not rewrite mix scoring inputs");
  }, { viewport: { width: 1280, height: 720 } });
  await check("first-lesson-and-tournament-preheat", async page => {
    await prepare(page);
    for (const mode of ["tutorial", "tournament"]) {
      await page.evaluate(async mode => {
        const cs = QA.cs = QA.session.newSession(mode);
        cs.mix = { double_apple: 9, mint: 3 };
        await QA.session.openBench(cs).ready;
        await QA.session.waitBenchReady(cs, "mix");
        QA.session.stepPanel("mix", "配合");
      }, mode);
      const worker = page.locator(".bench-worker");
      assert.equal(await worker.getAttribute("data-face"), mode === "tutorial" ? "normal" : "serious");
      if (mode === "tutorial") assert(await worker.locator(".worker-actor").isVisible());
      await page.evaluate(() => { QA.run = QA.steps.stepPack(QA.cs); });
      await page.locator('[data-test="pack-confirm"]').waitFor();
      await page.locator('[data-test="pack-confirm"]').click(); await page.evaluate(() => QA.run);
      const gauge = page.locator(".thermo");
      for (const id of ["holes", "place", "heat"]) {
        await page.evaluate(id => QA.session.stepPanel(id, id), id);
        assert.equal(await gauge.count(), 1);
        assert(await gauge.isVisible());
        assert.equal(await gauge.getAttribute("aria-valuenow"), null);
        assert.match(await gauge.getAttribute("aria-label"), /加熱前/);
        assert.equal(await gauge.locator(".thermo-mark").evaluate(n => n.style.bottom), "0%");
        assert(!(await page.locator(".bench-right").evaluate(n => getComputedStyle(n, "::before").content)).includes("お休み"));
      }
      await page.evaluate(() => QA.session.stepPanel("steam", "蒸らし"));
      assert.equal(await gauge.count(), 0, "preparation does not duplicate the next live meter");
    }
  });
});
