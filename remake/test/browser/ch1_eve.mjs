// #451 A: real chapter/VN/bench, choices before making, legacy flags and interrupted saves.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits } from "./support.mjs";
const shots = path.resolve(process.env.SHOTS || fileURLToPath(new URL("../../../.codex/artifacts/remake-browser", import.meta.url)));
fs.mkdirSync(shots, { recursive: true });

async function setup(page, { fresh = true, day = 13, manual = false, auto = "good" } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ fresh, day, manual, auto }) => {
    window.E = { core: await import("./js/core/state.js"), ch1: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), session: await import("./js/craft/session.js"),
      stats: await import("./js/core/stats.js"), story: await import("./js/chapters/tsumugi-story.js"),
      nights: await import("./js/daily/night-events.js"), intro: await import("./js/vn/intro.js") };
    if (fresh) {
      const s = E.core.newGame();
      Object.assign(s, { phase: "daily", day, slot: 2, stamina: 57, weatherSeed: 4 });
      s.flavors.push("blueberry", "mint");
      s.flavorStock = { double_apple: 50, blueberry: 50, mint: 50 };
      for (const ev of Object.values(E.ch1.NIGHT_EVENTS)) for (const key of ev.doneKeys || []) s.flags[key] = true;
      delete s.flags._ev_last_night; delete s.flags._tsumugi_contest_eve;
      for (const step of E.story.TSUMUGI_STORY.filter(step => step.day < 13)) s.flags[step.flag] = true;
      s.flags._morning_13 = true;
      for (const id of ["sumi", "tsumugi", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"]) E.intro.markIntroSeen(id);
    } else E.core.load();
    E.ch1.setupHooks(); E.vn.vnTest.turbo = !manual;
    E.vn.vnTest.choose = () => 3; // automated compatibility cases choose sleep
    E.session.craftTest.auto = auto;
    E.entries = []; E.steps = []; E.benches = 0;
    const enter = E.vn.hooks.onEnter;
    E.vn.hooks.onEnter = (id, dlg) => { E.entries.push(id); enter?.(id, dlg); };
    const seen = new WeakSet();
    E.observer = new MutationObserver(() => {
      for (const bench of document.querySelectorAll(".bench:not(.done)")) {
        if (!seen.has(bench)) { seen.add(bench); E.benches++; }
        const step = bench.querySelector(".bench-panel")?.dataset.step;
        const value = `${bench.dataset.mode}:${step}`;
        if (step && E.steps.at(-1) !== value) E.steps.push(value);
      }
    });
    E.observer.observe(document.getElementById("screen"), { subtree: true, attributes: true, childList: true });
    E.run = () => {
      E.done = false; E.error = null;
      E.promise = E.ch1.NIGHT_EVENTS[13].run().then(() => E.done = true).catch(e => E.error = e.stack);
    };
    E.core.save();
  }, { fresh, day, manual, auto });
}

const select = (page, selector, touch = false) => touch ? page.locator(selector).tap() : page.locator(selector).click();
async function advanceTo(page, selector, touch = false) {
  const until = Date.now() + 30000;
  while (!(await page.locator(selector).isVisible().catch(() => false))) {
    assert(Date.now() < until, `Did not reach ${selector}`);
    const error = await page.evaluate(() => E.error);
    assert(!error, error);
    const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
    if (await skip.isVisible().catch(() => false)) await select(page, '#vn.active [data-test="vn-skip"]:not(.on)', touch);
    await page.waitForTimeout(40);
  }
}
async function finish(page, touch = false) {
  const until = Date.now() + 30000;
  while (!(await page.evaluate(() => E.done))) {
    const error = await page.evaluate(() => E.error);
    assert(!error, error); assert(Date.now() < until, "Eve did not finish");
    const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
    if (await skip.isVisible().catch(() => false)) await select(page, '#vn.active [data-test="vn-skip"]:not(.on)', touch);
    await page.waitForTimeout(40);
  }
}
async function snapshot(page) {
  return page.evaluate(() => ({ state: JSON.parse(JSON.stringify(E.core.state)), entries: E.entries,
    steps: E.steps, benches: E.benches, done: E.ch1.NIGHT_EVENTS[13].done() }));
}
async function reload(page, options = {}) {
  await page.reload(); await page.locator('[data-test="title-new"]').waitFor();
  await setup(page, { ...options, fresh: false });
}
async function choose(page, index, touch = false) {
  await advanceTo(page, '[data-test="choice-3"]', touch);
  assert.equal(await page.locator(".vn-choice").count(), 4);
  await assertFits(page, ".vn-choice");
  assert.equal(await page.evaluate(() => E.benches), 0, "制作より先に選択する");
  await select(page, `[data-test="choice-${index}"]`, touch);
}

await suite("ch1-eve", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [device, touch, options] of [["pc", false, {}],
    ["touch", true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    for (const [index, branch] of ["practice", "drill", "talk_sumi", "sleep_early"].entries()) {
      await check(`${device}-${branch}`, async page => {
        await setup(page, { manual: true }); await page.evaluate(() => E.run());
        await advanceTo(page, '[data-test="choice-3"]', touch);
        await page.waitForTimeout(500); // All four existing VN choice entrances have settled.
        await page.screenshot({ path: `${shots}/eve-${device}-${branch}-menu.png` });
        await choose(page, index, touch);
        if (branch === "drill") {
          await page.locator('[data-test="drill-heat"]').waitFor();
          await assertFits(page, ".big-choice");
          await page.screenshot({ path: `${shots}/eve-${device}-drill-menu.png` });
          await select(page, '[data-test="drill-heat"]', touch);
        }
        await finish(page, touch);
        const result = await snapshot(page), s = result.state;
        assert(result.done && s.flags._ev_last_night && s.flags._tsumugi_contest_eve);
        assert.equal(result.entries.filter(id => id === "ch1_tsumugi_eve").length, 1);
        assert.equal(s.flags._last_night, branch);
        assert.deepEqual(s.flavorStock, { double_apple: 50, blueberry: 50, mint: 50 });
        assert.equal(s.day, 13); assert.equal(s.slot, 2); assert.equal(s.reel.count, 0);
        if (branch === "practice") {
          assert.equal(result.benches, 1);
          for (const step of ["mix", "pack", "holes", "place", "heat", "steam", "pull", "care"]) assert(result.steps.includes(`rehearsal:${step}`), step);
          assert.equal(s.flags._craft_practice_runs.length, 1);
          assert.equal(s.flags._craft_practice_runs[0].adjustments, 2);
          assert.equal(s.flags._craft_practice_runs[0].success, true);
          assert(s.flags._ev_rehearsal && s.flags._ch1_eve.practiceDone);
          assert(["good", "great", "rough"].includes(s.rehearsal));
          // Latest main gates dialogue growth through paidAction: fixed nights award no skill XP.
          assert.deepEqual(s.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
        } else {
          assert.equal(s.rehearsal, null); assert.equal(s.flags._ev_rehearsal, undefined);
          assert.equal(s.flags._craft_practice_runs, undefined);
          if (branch === "drill") {
            assert.equal(result.benches, 1); assert.deepEqual(result.steps, ["drill:heat"]);
            assert.equal(s.best.heat, 2); assert(s.flags._ch1_eve.practiceDone);
          } else assert.equal(result.benches, 0);
          assert.deepEqual(s.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
        }
        if (branch === "sleep_early") { assert.equal(s.stamina, 100); assert(s.flags._home_tonight); }
        // Finished manual/automatic save: rerunning the same fixed event is inert.
        await page.evaluate(() => E.core.saveToSlot("suien_remake_slot1"));
        await reload(page);
        await page.evaluate(() => { E.core.loadFromSlot("suien_remake_slot1"); E.run(); });
        await finish(page);
        const again = await snapshot(page);
        for (const key of ["stats", "stamina", "flavorStock", "rehearsal", "best", "flags"]) assert.deepEqual(again.state[key], s[key], key);
        assert.equal(again.benches, 0); assert.deepEqual(again.entries, []);
      }, options);
    }
  }

  for (const kind of ["holes", "steam", "pull"]) await check(`single-drill-${kind}`, async page => {
    await setup(page); await page.evaluate(() => { E.vn.vnTest.choose = () => 1; E.run(); });
    await page.locator(`[data-test="drill-${kind}"]`).click(); await finish(page);
    const result = await snapshot(page);
    assert.deepEqual(result.steps, [`drill:${kind}`]); assert.equal(result.benches, 1);
    assert.equal(result.state.best[kind], 2);
    assert.deepEqual(result.state.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
    assert.equal(result.state.rehearsal, null);
  });

  // All four legacy flag combinations on DAY13 and the actual DAY14 fallback.
  for (const day of [13, 14]) for (const rehearsal of [false, true]) for (const lastNight of [false, true]) {
    await check(`legacy-${day}-${+rehearsal}${+lastNight}`, async page => {
      await setup(page, { day });
      await page.evaluate(({ rehearsal, lastNight, day }) => {
        const s = E.core.state;
        if (rehearsal) { s.flags._ev_rehearsal = true; s.rehearsal = "good"; }
        if (lastNight) { s.flags._ev_last_night = true; s.flags._last_night = "talk_sumi"; }
        E.core.saveToSlot("suien_remake_slot1"); E.core.loadFromSlot("suien_remake_slot1");
        if (day === 13) E.run();
        else { const enter = E.vn.hooks.onEnter; E.ch1.devTournament(); E.vn.hooks.onEnter = enter; E.session.craftTest.auto = null; }
      }, { rehearsal, lastNight, day });
      if (day === 13) await finish(page);
      else await page.waitForFunction(() => E.core.state.phase === "tournament" && E.core.state.tournament.attempts === 1);
      const result = await snapshot(page);
      assert(result.done); assert.equal(result.state.day, day);
      assert.equal(result.state.rehearsal, rehearsal ? "good" : null);
      assert.equal(result.state.flags._ev_rehearsal, rehearsal ? true : undefined);
      assert.equal(result.state.flags._craft_practice_runs, undefined);
      assert.equal(result.entries.filter(id => id === "ch1_day7_last_night").length, lastNight ? 0 : 1);
      assert.equal(result.entries.filter(id => id === "ch1_tsumugi_eve").length, 1);
      assert.equal(result.state.flags._last_night, lastNight ? "talk_sumi" : "sleep_early");
      assert(!result.steps.some(step => step.startsWith("rehearsal:") || step.startsWith("drill:")));
    });
  }

  await check("legacy-rehearsal-only-practice-choice", async page => {
    await setup(page); await page.evaluate(() => {
      E.core.state.flags._ev_rehearsal = true; E.core.state.rehearsal = "good";
      E.vn.vnTest.choose = () => 0; E.run();
    }); await finish(page);
    const result = await snapshot(page);
    assert.equal(result.benches, 0); assert.equal(result.state.rehearsal, "good");
    assert.equal(result.state.flags._craft_practice_runs, undefined);
    assert.deepEqual(result.state.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
  });

  for (const stage of ["before-choice", "drill-menu", "during-practice", "during-drill", "during-talk", "after-practice", "after-drill"]) {
    await check(`save-${stage}`, async page => {
      const practice = stage.includes("practice"), drill = stage.includes("drill");
      await setup(page, { manual: true, auto: stage.startsWith("during-") && (practice || drill) ? null : "good" });
      // Stop at the first conclusion line, after actual practice has been checkpointed.
      if (stage.startsWith("after-")) await page.evaluate(() => {
        E.vn.hooks.onLine = id => {
          if (id === "ch1_day7_last_night_practice" || id === "ch1_day7_last_night_drill") {
            E.vn.vnTest.turbo = false;
            document.querySelector('[data-test="vn-skip"].on')?.click();
          }
        };
      });
      await page.evaluate(() => E.run());
      await advanceTo(page, '[data-test="choice-3"]');
      if (stage !== "before-choice") await choose(page, practice ? 0 : drill ? 1 : 2);
      if (drill) {
        await page.locator('[data-test="drill-heat"]').waitFor();
        if (stage !== "drill-menu") await page.locator('[data-test="drill-heat"]').click();
      }
      if (stage === "during-practice") await advanceTo(page, '[data-test="mix-ok"]');
      if (stage === "during-drill") await page.locator('[data-test="coal-0"]').waitFor();
      if (stage === "during-talk") await page.waitForFunction(() => E.entries.includes("ch1_day7_last_night_talk_sumi"));
      if (stage.startsWith("after-")) {
        await page.evaluate(() => E.vn.vnTest.turbo = true);
        const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
        if (await skip.isVisible().catch(() => false)) await skip.click();
        await page.waitForFunction(() => E.entries.some(id => id === "ch1_day7_last_night_practice" || id === "ch1_day7_last_night_drill"));
      }
      await page.evaluate(() => E.core.saveToSlot("suien_remake_slot1"));
      const interrupted = await snapshot(page);
      assert(!interrupted.state.flags._ev_last_night);
      if (stage.startsWith("during-")) assert.equal(interrupted.state.flags._ch1_eve.practiceDone, undefined);
      await reload(page); await page.evaluate(() => { E.core.loadFromSlot("suien_remake_slot1"); E.run(); });
      if (stage === "drill-menu") await page.locator('[data-test="drill-heat"]').click();
      await finish(page);
      const resumed = await snapshot(page);
      assert(resumed.done); assert.equal(resumed.state.flags._last_night, practice ? "practice" : drill ? "drill" : stage === "before-choice" ? "sleep_early" : "talk_sumi");
      assert.equal(resumed.entries.filter(id => id === "ch1_tsumugi_eve").length, 0, "Saved Tsumugi event replayed");
      assert.equal(resumed.entries.filter(id => id === "ch1_day7_last_night").length, stage === "before-choice" ? 1 : 0);
      assert.equal(resumed.benches, stage.startsWith("after-") || stage === "during-talk" || stage === "before-choice" ? 0 : 1);
      if (practice) { assert.equal(resumed.state.flags._craft_practice_runs.length, 1); assert.equal(resumed.state.stats.guts, 10); }
      if (drill) { assert.equal(resumed.state.best.heat, 2); assert.equal(resumed.state.stats.technique, 10); }
    });
  }

  await check("failed-full-practice-keeps-real-outcome", async page => {
    await setup(page, { auto: "burn" });
    await page.evaluate(() => { E.vn.vnTest.choose = () => 0; E.run(); }); await finish(page);
    const result = await snapshot(page);
    assert.equal(result.state.rehearsal, "rough");
    assert.equal(result.state.flags._craft_practice_runs[0].success, false);
    assert.equal(result.state.flags._craft_practice_runs.length, 1);
    assert.equal(result.state.stats.guts, 10); assert(result.done);
  });
});
