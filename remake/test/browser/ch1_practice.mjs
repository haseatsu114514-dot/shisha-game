// #451 B/C: real fixed nights, experience boundaries, partial care and saved progress.
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
const shots = process.env.SHOTS || ".codex/artifacts/remake-browser/practice-controls";
fs.mkdirSync(shots, { recursive: true });

async function setup(page, { day = 3, manual = false, fresh = true, auto = "good" } = {}) {
  page.setDefaultTimeout(60000);
  await page.evaluate(async ({ day, manual, fresh, auto }) => {
    window.P = { core: await import("./js/core/state.js"), ch1: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), craft: await import("./js/craft/session.js"),
      practice: await import("./js/craft/practice.js"), history: await import("./js/craft/practice-history.js"),
      temp: await import("./js/craft/conditions.js"), pull: await import("./js/craft/pull.js"),
      intro: await import("./js/vn/intro.js"), ui: await import("./js/core/ui.js") };
    if (fresh) {
      const s = P.core.newGame();
      Object.assign(s, { phase: "daily", day, slot: 2, stamina: 80, weatherSeed: 4 });
      s.flavors.push("double_apple", "blueberry", "mint"); s.flavorStock = { double_apple: 50, blueberry: 50, mint: 50 };
      Object.assign(s.flags, { _tsumugi_contest_progress: true, _hiyori_meeting_done: true, _prep_flavor: "blueberry" });
      for (const id of ["sumi", "tsumugi", "hiyori"]) P.intro.markIntroSeen(id);
    } else P.core.load();
    P.ch1.setupHooks(); P.ui.clearScreen();
    P.vn.vnTest.turbo = !manual; P.vn.vnTest.choose = () => 2;
    P.craft.craftTest.auto = auto;
    P.entries = []; P.steps = []; P.benches = 0;
    const enter = P.vn.hooks.onEnter;
    P.vn.hooks.onEnter = (id, dlg) => { P.entries.push(id); enter?.(id, dlg); };
    const seen = new WeakSet();
    new MutationObserver(() => {
      for (const b of document.querySelectorAll(".bench:not(.done)")) {
        if (!seen.has(b)) { P.benches++; seen.add(b); }
        const step = b.querySelector(".bench-panel")?.dataset.step;
        if (step && P.steps.at(-1) !== step) P.steps.push(step);
      }
    }).observe(document.getElementById("screen"), { subtree: true, attributes: true, childList: true });
    P.run = () => {
      P.done = false; P.error = null;
      P.ch1.NIGHT_EVENTS[P.core.state.day === 3 ? 3 : 7].run().then(() => P.done = true).catch(e => P.error = e.stack);
    };
  }, { day, manual, fresh, auto });
}
const select = (page, selector, touch) => touch ? page.locator(selector).tap() : page.locator(selector).click();
async function until(page, predicate, touch = false) {
  const deadline = Date.now() + 60000;
  while (!await page.evaluate(predicate)) {
    assert(Date.now() < deadline, "Practice timed out");
    assert(!await page.evaluate(() => P.error), await page.evaluate(() => P.error));
    const skip = '#vn.active [data-test="vn-skip"]:not(.on)';
    if (!await page.evaluate(() => P.vn.vnTest.turbo) && await page.locator(skip).isVisible().catch(() => false)) {
      await select(page, skip, touch);
    }
    await page.waitForTimeout(40);
  }
}
const finish = (page, touch) => until(page, () => P.done, touch);
const snapshot = page => page.evaluate(() => ({ state: JSON.parse(JSON.stringify(P.core.state)), entries: P.entries, steps: P.steps, benches: P.benches }));
function resourcesUnchanged(s, giftGrams = 0) {
  assert.deepEqual(s.flavorStock, { double_apple: 50 + giftGrams, blueberry: 50, mint: 50 });
  if (giftGrams) {
    assert.equal(s.flags._sumi_double_apple_received, true);
    assert.equal(s.owned.filter(id => id === "home_rig_set").length, 1);
  }
  assert.deepEqual(s.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
  assert.equal(s.slot, 2); assert.equal(s.reel.count, 0); assert.equal(s.rehearsal, null);
}

await suite("ch1-practice", async run => {
  const check = (...args) => !process.env.TEST_CASES || new RegExp(process.env.TEST_CASES).test(args[0]) ? run(...args) : Promise.resolve();
  for (const [label, flags, hasChoice] of [
    ["skipped", { _tutorial_skipped: true }, false],
    ["legacy-no-history", {}, false],
    ["legacy-tutorial", { _tutorial_done: true }, true],
    ["full-success", { _craft_practice_runs: [{ day: 1, kind: "practice", success: true, adjustments: 0 }] }, true],
    ["full-failed", { _craft_practice_runs: [{ day: 1, kind: "practice", success: false, adjustments: 0 }] }, false],
    ["same-day-failed", { _craft_practice_runs: [{ day: 3, kind: "practice", success: false, adjustments: 0 }] }, true],
    ["care-only", { _craft_practice_runs: [{ day: 2, kind: "care", scope: "care", success: true, served: false, adjustments: 2 }] }, false],
  ]) await check(`early-${label}`, async page => {
    await setup(page); await page.evaluate(flags => { Object.assign(P.core.state.flags, flags); P.run(); }, flags);
    await finish(page); const r = await snapshot(page);
    assert.equal(r.benches, hasChoice ? 0 : 1); assert(r.state.flags._ev_first_practice);
    assert.equal(r.entries.some(id => /remake_preparation_(review|retry)$/.test(id)), hasChoice);
    if (!hasChoice) { const record = r.state.flags._craft_practice_runs.at(-1); assert(record.success && record.served); assert.equal(record.adjustments, 0); }
    if (label === "same-day-failed") assert(!r.state.flags._craft_practice_runs[0].success);
    resourcesUnchanged(r.state);
  });

  for (const [device, touch, options] of [["pc", false, {}], ["touch", true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    for (const [index, choice] of ["drill", "full", "review"].entries()) await check(`${device}-early-${choice}`, async page => {
      await setup(page, { manual: true });
      await page.evaluate(() => { P.core.state.flags._tutorial_done = true; P.run(); });
      await until(page, () => !!document.querySelector('[data-test="choice-2"]'), touch);
      assert.equal(await page.evaluate(() => P.benches), 0); await assertFits(page, ".vn-choice");
      if (choice === "drill") await page.screenshot({ path: `${shots}/${device}-early-menu.png` });
      await select(page, `[data-test="choice-${index}"]`, touch);
      if (choice === "drill") {
        await page.locator('[data-test="drill-heat"]').waitFor(); await assertFits(page, ".big-choice");
        await page.screenshot({ path: `${shots}/${device}-drill-menu.png` });
        await select(page, '[data-test="drill-heat"]', touch);
      }
      await finish(page, touch); const r = await snapshot(page);
      assert.equal(r.state.flags._ch1_early.choice, choice); assert(r.state.flags._ev_first_practice);
      if (choice === "drill") { assert.deepEqual(r.steps, ["heat"]); assert.equal(r.state.best.heat, 2); }
      if (choice === "review") assert.equal(r.benches, 0);
      if (choice === "full") assert(r.state.flags._craft_practice_runs.at(-1).served);
      resourcesUnchanged(r.state);
      await page.evaluate(() => P.core.saveToSlot("suien_remake_slot1"));
      await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { fresh: false });
      await page.evaluate(() => { P.core.loadFromSlot("suien_remake_slot1"); P.run(); }); await finish(page);
      const again = await snapshot(page); assert.equal(again.benches, 0);
      const { savedAt: _beforeTime, ...beforeState } = r.state;
      const { savedAt: _afterTime, ...afterState } = again.state;
      assert.deepEqual(afterState, beforeState);
    }, options);
    await check(`${device}-mid-care`, async page => {
      await setup(page, { day: 7 }); await page.evaluate(() => P.run()); await finish(page);
      const r = await snapshot(page), record = r.state.flags._craft_practice_runs.at(-1);
      assert.deepEqual(r.steps, ["care"]); assert.equal(r.benches, 1);
      assert.equal(record.scope, "care"); assert.equal(record.served, false); assert.equal(record.adjustments, 2);
      assert.deepEqual(record.scores, {}); assert(record.success); assert(r.state.flags._ev_midcheck);
      resourcesUnchanged(r.state, 50); await assertFits(page, ".vn-box");
    }, options);
    await check(`${device}-mid-experienced-skip`, async page => {
      await setup(page, { day: 7, manual: true });
      await page.evaluate(() => { P.core.state.flags._craft_practice_runs = [{ day: 7, kind: "practice", success: true, adjustments: 2 }]; P.run(); });
      await until(page, () => !!document.querySelector('[data-test="choice-2"]'), touch);
      assert.equal(await page.evaluate(() => P.benches), 0); await assertFits(page, ".vn-choice");
      await select(page, '[data-test="choice-1"]', touch); await finish(page, touch);
      const r = await snapshot(page); assert.equal(r.benches, 0); assert.equal(r.state.flags._craft_practice_runs.length, 1);
      assert.equal(r.state.flags._ch1_mid.choice, "stock"); resourcesUnchanged(r.state, 50);
    }, options);
    await check(`${device}-supplied-care-controls`, async page => {
      await setup(page, { day: 7, auto: null });
      await page.evaluate(async () => {
        P.cs = P.practice.newCarePracticeSession(); P.craft.openBench(P.cs, { steps: [["care1", "調整"], ["care2", "調整"]] });
        await P.craft.waitBenchReady(P.cs);
      });
      for (const round of [1, 2]) {
        await page.evaluate(round => { P.craft.craftTest.auto = null; P.running = P.pull.runCare(P.cs, { round }); }, round);
        await page.locator('[data-test="care-coals"]').waitFor();
        await assertFits(page, ".care-coal, .care-coals-ask, .care-coals-lead");
        if (round === 1) await page.screenshot({ path: `${shots}/${device}-care-menu.png` });
        await page.evaluate(() => P.craft.craftTest.auto = "good");
        await select(page, '[data-test="care-coal-1"]', touch);
        await page.evaluate(() => P.running);
      }
      const result = await page.evaluate(() => ({ history: P.cs.careHistory, pullDone: P.cs.pullDone, pull: P.cs.pull, score: P.cs.arcade.parts }));
      assert.equal(result.history.length, 2); assert(result.history.every(h => h.coals === 1 && h.coalsDetail.count === 1));
      assert.equal(result.history[1].startTemp, Math.max(.14, result.history[0].temp - .075));
      assert.equal(result.pullDone, false); assert.equal(result.pull, null);
      assert.deepEqual(Object.keys(result.score).sort(), ["care1", "care2"]);
    }, options);
  }
  await check("mid-supplied-state-and-isolation", async page => {
    await setup(page, { day: 7 });
    const result = await page.evaluate(() => {
      const cs = P.practice.newCarePracticeSession(); cs.careRound = 1;
      const normal = P.craft.newSession("tournament");
      return { supplied: cs.practiceSource.temperature, expected: P.temp.temperatureAfterSteam(cs, 480, 0),
        start: P.pull.careStartTemp(cs), pull: cs.pull, pullDone: cs.pullDone, scores: [cs.holes.score, cs.heat.score],
        normal: [normal.mix, normal.pull, normal.practiceSource], records: P.core.state.flags._craft_practice_runs };
    });
    assert.equal(result.supplied, result.expected); assert.equal(result.start, Math.max(.14, result.expected - .075));
    assert.equal(result.pull, null); assert.equal(result.pullDone, false); assert.deepEqual(result.scores, [undefined, undefined]);
    assert.deepEqual(result.normal, [{}, null, undefined]); assert.equal(result.records, undefined);
  });
  await check("mid-failure-is-not-success", async page => {
    await setup(page, { day: 7, auto: "burn" }); await page.evaluate(() => P.run()); await finish(page);
    const r = await snapshot(page), record = r.state.flags._craft_practice_runs.at(-1);
    assert.equal(record.success, false); assert.equal(record.served, false); assert.equal(record.adjustments, 1);
    assert(r.state.flags._ev_midcheck); assert(r.entries.includes("remake_preparation_failed"));
    resourcesUnchanged(r.state, 50);
  });
  await check("mid-interrupted-save-restarts-only-care", async page => {
    await setup(page, { day: 7, auto: null }); await page.evaluate(() => P.run());
    await page.locator('[data-test="care-coals"]').waitFor();
    await page.evaluate(() => P.core.save());
    const before = await snapshot(page); assert.equal(before.state.flags._ev_midcheck, undefined);
    assert.equal(before.state.flags._craft_practice_runs, undefined);
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { day: 7, fresh: false });
    await page.evaluate(() => P.run()); await finish(page);
    const r = await snapshot(page); assert.deepEqual(r.steps, ["care"]); assert.equal(r.state.flags._craft_practice_runs.length, 1);
    assert(!r.entries.includes("remake_midcheck_intro")); assert.equal(r.state.flags._ch1_mid.choice, "care");
    resourcesUnchanged(r.state, 50);
  });
  await check("completed-practice-unread-feedback-does-not-repeat", async page => {
    await setup(page, { day: 7 });
    await page.evaluate(() => {
      const onEnter = P.vn.hooks.onEnter;
      P.vn.hooks.onEnter = (id, d) => { if (id === "remake_midcheck") P.vn.vnTest.turbo = false; onEnter(id, d); };
      P.run();
    });
    await page.waitForFunction(() => P.core.state.flags._ch1_mid?.practiceDone && document.querySelector('#vn.active'));
    await page.evaluate(() => P.core.save()); const before = await snapshot(page);
    assert(!before.state.flags._ev_midcheck); assert(!before.state.flags._ch1_mid.feedbackRead);
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { day: 7, fresh: false });
    await page.evaluate(() => P.run()); await finish(page);
    const r = await snapshot(page); assert.equal(r.benches, 0); assert.equal(r.state.flags._craft_practice_runs.length, 1);
    assert.equal(r.state.stamina, before.state.stamina); assert(r.state.flags._ev_midcheck);
  });
});
