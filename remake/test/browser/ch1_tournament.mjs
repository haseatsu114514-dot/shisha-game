// 一章改修の回帰: 素材待ち、初期/解放済み炭、調整2回、準備・保存、発表画面。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core,
      session: await import("./js/craft/session.js"),
      steps: await import("./js/craft/steps.js"),
      heat: await import("./js/craft/heat.js"),
      pull: await import("./js/craft/pull.js"),
      score: await import("./js/craft/score.js"),
      result: await import("./js/craft/result.js"),
      broadcast: await import("./js/craft/broadcast.js"),
      preparation: await import("./js/daily/preparation.js"),
      practice: await import("./js/craft/practice.js"),
    };
    T.open = async (cs) => {
      const b = T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await T.session.waitBenchReady(cs);
    };
  });
}

await suite("ch1-tournament", async check => {
  await check("delayed-assets-gate", async page => {
    await init(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/coal_white.png", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => {
        T.session.craftTest.auto = "good";
        window.cs = T.session.newSession("tournament");
        T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
        window.running = T.heat.runHeat(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.bench').evaluate(n => n.inert), true);
      assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Game started before its images decoded");
      assert.equal(await page.evaluate(() => cs.heat), null);
    } finally { release(); }
    await page.evaluate(() => window.running);
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
    assert.equal(await page.locator('.bench').evaluate(n => n.inert), false);
    assert.equal(await page.evaluate(() => cs.heat.picks.length), 3);
  });

  await check("failed-image-fallback", async page => {
    await init(page);
    // 読み込み自体は成功、画像デコードは失敗。必須操作はDOMなので先に進める。
    await page.route("**/img/ui/making/coal_white.png", route => route.fulfill({ status: 200, contentType: "image/png", body: "broken image" }));
    await page.evaluate(async () => {
      T.session.craftTest.auto = "good";
      window.cs = T.session.newSession("tournament");
      await T.open(cs); await T.heat.runHeat(cs);
    });
    assert.equal(await page.evaluate(() => cs.heat.score), 100);
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
  });

  await check("real-vn-skip-with-delayed-tournament-art", async page => {
    await init(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/coal_white.png", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(async () => {
        const chapter = await import("./js/chapters/ch1.js");
        const vn = await import("./js/vn/engine.js");
        const intro = await import("./js/vn/intro.js");
        const { state } = T.core;
        Object.assign(state, { phase: "tournament", day: 14, flavors: ["double_apple", "mint", "blueberry"], flavorStock: { double_apple: 50, mint: 50, blueberry: 50 } });
        // 初登場カットインは3.6秒固定。既読セーブを想定し、会話のSKIPだけを検証する。
        for (const id of ["sumi", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"]) intro.markIntroSeen(id);
        vn.vnTest.turbo = false;
        window.openingRead = false;
        vn.hooks.onLine = id => { if (id === "ch1_tournament_opening") openingRead = true; };
        window.tournamentRun = chapter.devTournament();
      });
      // 本番のSKIPボタンで各会話を送る。制作のテスト自動操作は使わない。
      const deadline = Date.now() + 15000;
      while (!(await page.evaluate(() => openingRead && !document.querySelector('#vn.active')))) {
        assert(Date.now() < deadline, "Tournament opening did not finish under SKIP");
        const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
        if (await skip.count()) await skip.click();
        await page.waitForTimeout(60);
      }
      assert.equal(await page.locator('.entrance, .bench, [data-test="coal-0"]').count(), 0, "SKIP bypassed the asset gate");
    } finally { release(); }
    const deadline = Date.now() + 15000;
    while (!(await page.locator('.bench .opt-grid, [data-test="mix-ok"]').count())) {
      // 初期機材が一種類ずつなら機材選択は省略され、配合へ進む。
      assert(Date.now() < deadline, "Tournament did not resume after the image arrived");
      const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
      if (await skip.count()) await skip.click();
      await page.waitForTimeout(60);
    }
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
    assert.equal(await page.locator('.bench').evaluate(n => n.inert), false);
  });

  await check("coals-two-care-and-comments", async page => {
    await init(page);
    await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament"); await T.open(cs);
      window.placement = T.steps.stepPlace(cs);
    });
    await page.locator('[data-test="opt-triangle"]').waitFor();
    assert.equal(await page.locator('[data-test="opt-four"]').count(), 0);
    assert.equal(await page.locator('[data-test="opt-mixed"]').count(), 0);
    await page.locator('[data-test="opt-triangle"]').click();
    await page.evaluate(() => window.placement);
    await page.evaluate(() => {
      Object.assign(T.core.state.flags, { _coal_four_unlocked: true, _coal_mix_unlocked: true });
      T.core.state.owned.push("cube_charcoal");
      window.placement = T.steps.stepPlace(cs);
    });
    await page.locator('[data-test="opt-four"]').click();
    await page.locator('[data-test="opt-mixed"]').click();
    await page.evaluate(() => window.placement);
    assert.deepEqual(await page.evaluate(() => cs.coalTypes), ["cube_charcoal", "flat_charcoal", "flat_charcoal", "flat_charcoal"]);
    await page.evaluate(async () => {
      T.session.craftTest.auto = "good";
      await T.heat.runHeat(cs);
      cs.mix = { blueberry: 9, mint: 3 }; cs.mixInfo = T.steps.evaluateMix(cs); cs.pack = "normal";
      cs.holes = { score: 95, outerEven: .95, innerExcess: 0, outer: 24, middle: 0, inner: 0 };
      cs.steam = { score: 100, seconds: 480, temp: .54 }; cs.steamSeconds = 480;
      await T.pull.runPull(cs);
      await T.pull.runCare(cs, { round: 1 });
      window.firstCare = JSON.stringify(cs.careHistory[0]);
      await T.pull.runCare(cs, { round: 2 });
      T.session.craftTest.auto = null;
      T.score.finalize(cs);
      T.broadcast.clearComments();
      T.broadcast.burst(cs, "perfect", 4);
    });
    const data = await page.evaluate(() => ({ picks: cs.heat.picks.length, history: cs.careHistory, first: firstCare,
      parts: cs.parts, arcade: cs.arcade.parts, failed: cs.failed }));
    assert.equal(data.picks, 4);
    assert.equal(data.history.length, 2);
    assert.equal(JSON.stringify(data.history[0]), data.first, "Second care overwrote first care");
    assert(Math.abs(data.history[1].startTemp - Math.max(.14, data.history[0].temp - .075)) < 1e-9);
    assert.equal(data.parts.care1, data.history[0].score);
    assert.equal(data.parts.care2, data.history[1].score);
    assert(data.arcade.care1 && data.arcade.care2);
    assert(!data.failed);
    await page.waitForTimeout(800);
    const lane = await page.locator('.bc-lane').evaluate(n => {
      const r = n.getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
      return { width: r.width / stage.width, pointer: getComputedStyle(n).pointerEvents, count: n.children.length };
    });
    assert(lane.width > .95 && lane.count > 0 && lane.count <= 4);
    assert.equal(lane.pointer, "none");
    // 工程間の矢印はセル外へ描く。ラベル自体とヘッダー全体の収まりを確認する。
    await assertFits(page, '.bench-progress, .bench-phase-copy b');
    await page.evaluate(() => { T.broadcast.clearComments(); T.broadcast.burst(cs, "perfect", 4); T.broadcast.clearComments(); });
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.nico').count(), 0, "Old comments leaked after fast transition");
  });

  await check("preparation-low-money-stock-and-save", async page => {
    await init(page);
    await page.evaluate(() => {
      T.core.state.money = 0; T.core.state.day = 7;
      T.core.state.flavorStock.blueberry = 1;
      T.core.state.flavors.push("blueberry");
      window.preparing = T.preparation.prepareFlavorStock();
    });
    await page.locator('[data-test="prep-flavor-blueberry"]').click();
    await page.locator('[data-test="shop-leave"]').click();
    assert.equal(await page.locator('.shop').count(), 1, "Insufficient stock could leave preparation");
    await page.locator('.shop-row.errand [data-test="buy-blueberry"]').click();
    await page.locator('[data-test="shop-leave"]').click();
    await page.evaluate(() => window.preparing);
    const prepared = await page.evaluate(() => ({ money: T.core.state.money, stock: T.core.state.flavorStock.blueberry, flavor: T.core.state.flags._prep_flavor }));
    assert.deepEqual(prepared, { money: 0, stock: 51, flavor: "blueberry" });
    await page.evaluate(async () => {
      window.cs = T.session.newSession("rehearsal"); await T.open(cs);
      window.mixing = T.steps.stepMix(cs);
    });
    await page.locator('[data-test="mix-ok"]').click();
    await page.evaluate(() => window.mixing);
    assert.deepEqual(await page.evaluate(() => cs.mix), { blueberry: 10, mint: 2 });
    assert.equal(await page.evaluate(() => T.core.state.flavorStock.blueberry), 51);
    await page.evaluate(() => { cs.careHistory = [{ score: 90 }, { score: 95 }]; T.practice.recordPractice(cs, "midweek"); T.core.save(); });
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor();
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); });
    assert.deepEqual(await page.evaluate(() => __remake.state.flags._craft_practice_runs.at(-1)), {
      day: 7, kind: "midweek", success: true, mix: { blueberry: 10, mint: 2 }, adjustments: 2,
    });
  });

  for (const [label, viewport, mobile] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["landscape", { width: 844, height: 390 }, true],
    ["portrait", { width: 390, height: 844 }, true],
  ]) await check(`results-${label}`, async page => {
    await init(page);
    await page.evaluate(() => {
      ["naru", "adam", "minto", "nagumo", "maezono", "dr_kemuri"].forEach(T.core.markMet);
      window.cs = { mix: { blueberry: 10, mint: 2 }, total: 84.4, parts: { holes: 95, heat: 100, shisha: 78, care1: 86, care2: 91 }, arcade: { total: 92340 }, bonusNotes: ["前日リハーサルの手応え"] };
    });
    if (label === "desktop") {
      await page.evaluate(() => { window.countdown = T.result.resultCountdown(cs, "premium"); });
      await page.locator('[data-test="result-count"]').waitFor();
      await assertFits(page, '.count-screen .tournament-heading, .rc-ring, .rc-pray, .rc-card');
      await capture(page, "result-count");
      await page.evaluate(async () => { await countdown; (await import("./js/core/ui.js")).retireScreen(); });
    }
    await page.evaluate(() => { window.standings = T.result.showStandings(3, 88); });
    await page.locator('[data-test="standings"].show').waitFor();
    await assertFits(page, '.standings, .sd-row, .sd-status');
    await capture(page, `standings-${label}`);
    await page.evaluate(() => window.standings);
    await page.evaluate(() => { window.cut = T.result.nagumoCutin(1); });
    await page.locator('.nc-cut.show').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.nagumo-cut, .nc-row, .nc-cut');
    await capture(page, `nagumo-${label}`);
    await page.evaluate(() => window.cut);
    await page.evaluate(() => { window.finalResult = T.result.resultTable(cs, 1); });
    await page.locator('[data-test="result-next"]').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.result-table, .rt-layout, .rt-row, .rt-detail, [data-test="result-next"]');
    const labels = await page.locator('.rt-part > span').allTextContents();
    assert.deepEqual(labels, ["穴あけ", "炭焼き", "完成品", "調整1回目", "調整2回目", "総合", "SCORE"]);
    assert.equal(await page.locator('.rt-row.me .rt-rank').textContent(), "1位");
  }, { viewport, isMobile: mobile, hasTouch: mobile });
});
