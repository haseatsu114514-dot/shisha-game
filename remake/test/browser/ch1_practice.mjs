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
      s.flavors.push("double_apple", "blueberry", "mint"); s.flavorStock = { double_apple: 50, blueberry: 50, mint: 50, lemon: 50 };
      Object.assign(s.flags, { _tsumugi_contest_progress: true, _hiyori_meeting_done: true, _prep_flavor: "blueberry" });
      for (const id of ["sumi", "tsumugi", "hiyori"]) P.intro.markIntroSeen(id);
    } else P.core.load();
    P.ch1.setupHooks(); P.ui.clearScreen();
    P.vn.vnTest.turbo = !manual; P.vn.vnTest.choose = () => 2;
    P.craft.craftTest.auto = auto;
    P.entries = []; P.steps = []; P.benches = 0; P.earlyChoices = [];
    const choose = P.vn.hooks.onChoice;
    P.vn.hooks.onChoice = (id, ...args) => {
      if (["remake_preparation_review", "remake_preparation_retry"].includes(id)) P.earlyChoices.push(args[1]);
      choose?.(id, ...args);
    };
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
    // 手動SKIPでも卓上台の受け取りは別操作。受領モーダルは手動で閉じ、無いときだけSKIPを押す。
    const gift = '[data-test="home-rig-gift-close"]';
    const skip = '#vn.active [data-test="vn-skip"]:not(.on)';
    if (await page.locator(gift).isVisible()) {
      await select(page, gift, touch);
    } else if (!await page.evaluate(() => P.vn.vnTest.turbo) && await page.locator(skip).isVisible().catch(() => false)) {
      await select(page, skip, touch);
    }
    await page.waitForTimeout(40);
  }
}
const finish = (page, touch) => until(page, () => P.done, touch);
const snapshot = page => page.evaluate(() => ({ state: JSON.parse(JSON.stringify(P.core.state)), entries: P.entries, steps: P.steps, benches: P.benches, earlyChoices: P.earlyChoices }));
function resourcesUnchanged(s, rigOwned = false) {
  // 固定練習は店の葉を使う。D02以降、卓上台を受け取っても私物の葉は増減しない。
  assert.deepEqual(s.flavorStock, { double_apple: 50, blueberry: 50, mint: 50, lemon: 50 });
  assert.equal(s.flags._sumi_double_apple_received, undefined, "葉の受領フラグを新しく立てない");
  assert.equal(s.owned.filter(id => id === "home_rig_set").length, rigOwned ? 1 : 0);
  assert.deepEqual(s.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
  assert.equal(s.slot, 2); assert.equal(s.reel.count, 0); assert.equal(s.rehearsal, null);
}

function assertMidFull(r) {
  const records = r.state.flags._craft_practice_runs.filter(run => run.kind === "midcheck");
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.day, 7); assert.equal(record.scope, "full");
  assert(record.success && record.served); assert.equal(record.adjustments, 2);
  assert.equal(record.careScores.length, 2, "careHistoryの2回分を記録する");
  assert(record.careScores.every(Number.isFinite));
  for (const step of ["heat", "steam", "pull"]) assert(Number.isFinite(record.scores[step]), step);
  assert.deepEqual(record.mix, { blueberry: 9, mint: 3 }, "通常制作で仕入れた葉を配合する");
  assert.deepEqual(r.steps.filter(step => step !== "holes"), ["setup", "mix", "pack", "place", "heat", "steam", "pull", "care"]);
  assert.equal(r.benches, 1);
  assert(r.state.flags._ch1_mid.practiceDone && r.state.flags._ch1_mid.feedbackRead && r.state.flags._ev_midcheck);
}

await suite("ch1-practice", async run => {
  const check = (...args) => !process.env.TEST_CASES || new RegExp(process.env.TEST_CASES).test(args[0]) ? run(...args) : Promise.resolve();
  // 現行newGameから作られる履歴とDAY3途中保存だけを対象にする。
  for (const [label, flags, reviewIntro] of [
    ["current-no-full", {}, false],
    ["current-full-success", { _craft_practice_runs: [{ day: 1, kind: "tutorial", scope: "full", success: true, served: true, adjustments: 0 }] }, true],
    ["current-prior-failed", { _craft_practice_runs: [{ day: 1, kind: "practice", scope: "full", success: false, served: false, adjustments: 0 }] }, false],
    ["current-same-day-failed", { _craft_practice_runs: [{ day: 3, kind: "practice", scope: "full", success: false, served: false, adjustments: 0 }] }, true],
    ["current-care-only", { _craft_practice_runs: [{ day: 2, kind: "care", scope: "care", success: true, served: false, adjustments: 2 }] }, false],
  ]) await check(`early-${label}`, async page => {
    await setup(page); await page.evaluate(flags => { Object.assign(P.core.state.flags, flags); P.run(); }, flags);
    await finish(page); const r = await snapshot(page);
    assert.equal(r.benches, 1); assert.deepEqual(r.earlyChoices, []); assert(r.state.flags._ev_first_practice);
    assert.equal(r.entries.some(id => /remake_preparation_(review|retry)$/.test(id)), reviewIntro);
    { const record = r.state.flags._craft_practice_runs.at(-1); assert(record.success && record.served); assert.equal(record.adjustments, 0); }
    if (label === "current-same-day-failed") assert(!r.state.flags._craft_practice_runs[0].success);
    resourcesUnchanged(r.state);
  });

  for (const [device, touch, options] of [["pc", false, {}], ["touch", true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${device}-early-full-only`, async page => {
      await setup(page, { manual: true });
      await page.evaluate(() => {
        P.core.state.flags._craft_practice_runs = [{ day: 1, kind: "tutorial", scope: "full", success: true, served: true, adjustments: 0 }];
        P.run();
      });
      await finish(page, touch); const r = await snapshot(page);
      assert.deepEqual(r.earlyChoices, [], "DAY3は選択を挟まず一台制作へ");
      assert.equal(r.state.flags._ch1_early.choice, "full"); assert(r.state.flags._ev_first_practice);
      assert.equal(r.benches, 1); assert(r.state.flags._craft_practice_runs.at(-1).served);
      assert.equal(r.state.flags._craft_practice_runs.at(-1).adjustments, 0);
      resourcesUnchanged(r.state);
      await page.evaluate(() => P.core.saveToSlot("suien_remake_slot1"));
      await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { fresh: false });
      await page.evaluate(() => { P.core.loadFromSlot("suien_remake_slot1"); P.run(); }); await finish(page);
      const again = await snapshot(page); assert.equal(again.benches, 0);
      const { savedAt: _beforeTime, ...beforeState } = r.state;
      const { savedAt: _afterTime, ...afterState } = again.state;
      assert.deepEqual(afterState, beforeState);
    }, options);
    await check(`${device}-early-current-interrupted-save-load`, async page => {
      await setup(page, { auto: null });
      await page.evaluate(() => P.run());
      await page.waitForFunction(() => P.core.state.flags._ch1_early?.choice === "full" && P.benches === 1);
      await page.evaluate(() => P.core.saveToSlot("suien_remake_slot1"));
      const before = await snapshot(page);
      assert(!before.state.flags._ch1_early.practiceDone);
      assert(!before.state.flags._ch1_early.feedbackRead);
      assert(!before.state.flags._ev_first_practice);
      await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { fresh: false });
      await page.evaluate(() => { P.core.loadFromSlot("suien_remake_slot1"); P.run(); }); await finish(page);
      const r = await snapshot(page);
      assert.equal(r.benches, 1); assert.deepEqual(r.earlyChoices, []);
      assert.equal(r.state.flags._ch1_early.choice, "full");
      assert(r.state.flags._ch1_early.practiceDone && r.state.flags._ch1_early.feedbackRead && r.state.flags._ev_first_practice);
      assert.equal(r.state.flags._craft_practice_runs.filter(run => run.kind === "early").length, 1);
      assert(r.state.flags._craft_practice_runs.at(-1).served);
      assert.equal(r.state.stamina, before.state.flags._ch1_early.staminaBefore);
      resourcesUnchanged(r.state);
    }, options);
    await check(`${device}-early-current-unread-feedback-load`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const onEnter = P.vn.hooks.onEnter;
        P.vn.hooks.onEnter = (id, d) => { if (id === "remake_preparation_first_end") P.vn.vnTest.turbo = false; onEnter(id, d); };
        P.run();
      });
      await page.waitForFunction(() => P.core.state.flags._ch1_early?.practiceDone && document.querySelector('#vn.active'));
      await page.evaluate(() => P.core.saveToSlot("suien_remake_slot1"));
      const before = await snapshot(page);
      assert(!before.state.flags._ch1_early.feedbackRead); assert(!before.state.flags._ev_first_practice);
      await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { fresh: false });
      await page.evaluate(() => { P.core.loadFromSlot("suien_remake_slot1"); P.run(); }); await finish(page);
      const r = await snapshot(page);
      assert.equal(r.benches, 0); assert.equal(r.state.flags._craft_practice_runs.length, before.state.flags._craft_practice_runs.length);
      assert.equal(r.state.stamina, before.state.stamina); assert(r.state.flags._ev_first_practice);
      resourcesUnchanged(r.state);
    }, options);
    for (const experienced of [false, true]) await check(`${device}-mid-full-${experienced ? "review" : "first"}`, async page => {
      await setup(page, { day: 7 });
      await page.evaluate(experienced => {
        P.core.state.flags._coal_cube_learned = true;
        if (experienced) P.core.state.flags._craft_practice_runs = [{ day: 6, kind: "practice", success: true, adjustments: 2 }];
        P.vn.vnTest.choose = () => 1;
        P.run();
      }, experienced);
      await finish(page); const r = await snapshot(page);
      assertMidFull(r);
      assert.equal(r.state.flags._ch1_mid.choice, "full");
      assert.equal(r.entries.includes("remake_midcheck_review"), experienced);
      resourcesUnchanged(r.state, true); await assertFits(page, ".vn-box");
    }, options);
    await check(`${device}-mid-experienced-skip`, async page => {
      await setup(page, { day: 7, manual: true });
      await page.evaluate(() => { P.core.state.flags._craft_practice_runs = [{ day: 7, kind: "practice", success: true, adjustments: 2 }]; P.run(); });
      await until(page, () => !!document.querySelector('[data-test="choice-1"]'), touch);
      assert.equal(await page.locator('.vn-choice[data-test^="choice-"]').count(), 2);
      assert.equal(await page.evaluate(() => P.benches), 0); await assertFits(page, ".vn-choice");
      await select(page, '[data-test="choice-0"]', touch); await finish(page, touch);
      const r = await snapshot(page); assert.equal(r.benches, 0); assert.equal(r.state.flags._craft_practice_runs.length, 1);
      assert.equal(r.state.flags._ch1_mid.choice, "stock"); resourcesUnchanged(r.state, true);
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
    // 提供前の失敗を固定する。蒸らしの温度上限から実際の熱を入れる吸いで焦がす。
    await page.route("**/js/craft/practice.js", async route => {
      const response = await route.fetch();
      const source = await response.text();
      const call = "  await runPull(cs);";
      assert.equal(source.split(call).length, 2, "吸い出し直前の入力を一箇所だけ固定する");
      await route.fulfill({
        response,
        body: source.replace(call, "  cs.steam.temp = 0.88;\n" + call),
      });
    });
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    await setup(page, { day: 7, auto: "burn" }); await page.evaluate(() => P.run()); await finish(page);
    const r = await snapshot(page), record = r.state.flags._craft_practice_runs.at(-1);
    assert.equal(record.scope, "full"); assert.equal(record.success, false); assert.equal(record.served, false);
    assert.equal(record.adjustments, 0); assert.deepEqual(record.careScores, []); assert.equal(record.scores.pull, 0);
    assert(r.state.flags._ev_midcheck); assert(r.entries.includes("remake_preparation_failed"));
    resourcesUnchanged(r.state, true);
  });
  for (const choice of ["full", "care"]) await check(`mid-interrupted-save-${choice}-restarts-full`, async page => {
    await setup(page, { day: 7, auto: null });
    await page.evaluate(choice => {
      P.core.state.flags._coal_cube_learned = true;
      // 旧版で仕入れと選択を終え、単独調整を始める前に保存した状態。
      if (choice === "care") P.core.state.flags._ch1_mid = { introRead: true, stockDone: true, choice };
      P.run();
    }, choice);
    await page.waitForFunction(() => P.benches === 1 && P.core.state.flags._ch1_mid?.choice);
    await page.evaluate(() => P.core.save());
    const before = await snapshot(page); assert.equal(before.state.flags._ev_midcheck, undefined);
    assert.equal(before.state.flags._ch1_mid.choice, choice); assert(!before.state.flags._ch1_mid.practiceDone);
    assert.equal(before.state.flags._craft_practice_runs, undefined);
    assert.deepEqual(before.state.flavorStock, { double_apple: 50, blueberry: 50, mint: 50, lemon: 50 }, "制作中の保存でも私物の葉は減らない");
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await setup(page, { day: 7, fresh: false });
    await page.evaluate(() => P.run()); await finish(page);
    const r = await snapshot(page); assertMidFull(r); assert.equal(r.state.flags._craft_practice_runs.length, 1);
    assert(!r.entries.includes("remake_midcheck_intro")); assert(!r.entries.includes("remake_midcheck_review"));
    assert.equal(r.state.flags._ch1_mid.choice, choice);
    resourcesUnchanged(r.state, true);
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
    resourcesUnchanged(r.state, true);
  });
});
