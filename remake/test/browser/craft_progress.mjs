// 提供成功/失敗、同じ調整セルへの2回の実プレイ、単工程のヘッダー。
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const labels = ["パッキング", "炭焼き", "蒸らし", "吸い出し", "提供", "調整"];
async function init(page, steps = null) {
  await page.evaluate(async steps => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core, session: await import("./js/craft/session.js"),
      pull: await import("./js/craft/pull.js"), practice: await import("./js/craft/practice.js"),
      score: await import("./js/craft/score.js") };
    window.cs = T.session.newSession("tournament");
    Object.assign(cs, { water: 0.5, place: "triangle", heat: { score: 100, heatPower: 70, heatStability: 80, burnRisk: 10, aromaRetention: 80 },
      steam: { temp: .54, score: 100, seconds: 480 }, steamSeconds: 480,
      holes: { score: 95, total: 24, outerEven: .95, innerExcess: 0, outer: 24, middle: 0, inner: 0 },
      mix: { blueberry: 9, mint: 3 }, mixInfo: { score: 90, total: 12, intensity: 5 }, pack: "normal" });
    T.session.openBench(cs, { steps: steps || T.practice.CRAFT_STEPS });
    await T.session.waitBenchReady(cs);
  }, steps);
}
const active = page => page.locator('.bench-phase[aria-current="step"]').getAttribute("data-step");
const headerLabels = page => page.locator(".bench-phase-copy b").allTextContents();
const fits = page => assertFits(page, ".bench-progress, .bench-phase-copy b");

await suite("craft-progress", async check => {
  for (const [name, viewport, mobile, reducedMotion] of [
    ["desktop", { width: 1280, height: 720 }, false, "no-preference"],
    ["touch", { width: 844, height: 390 }, true, "reduce"],
  ]) {
    await check(`${name}-steam-guide`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        const steam = await import("./js/craft/steam.js");
        window.guideSession = session;
        window.guideCS = session.newSession("tutorial"); guideCS.steamSeconds = 600;
        session.openBench(guideCS); await session.waitBenchReady(guideCS);
        window.guideStarts = 0;
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes)
            if (node.classList?.contains("countdown")) guideStarts++;
        }).observe(document.body, { childList: true, subtree: true });
        window.guideRun = steam.runSteamDodge(guideCS);
      });
      const close = page.getByRole("button", { name: "説明を閉じて進む" });
      const summary = page.locator(".bench-guide summary");
      const clock = page.locator('[data-test="steam-clock"]');
      await close.waitFor();
      await page.waitForFunction(() => document.activeElement?.dataset.test === "bench-guide-close");
      await assertFits(page, '.bench-guide-tip, [data-test="bench-guide-close"]');
      const size = await close.boundingBox(); assert(size.height >= 43, "Touch target remains 44px after stage scaling");
      const before = await clock.textContent();
      await page.waitForTimeout(250);
      assert.equal(await clock.textContent(), before);
      assert.equal(await page.evaluate(() => guideStarts), 0, "Initial explanation must hold the countdown");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), true);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-steam-guide-open.png` });
      if (mobile) await close.tap(); else await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.activeElement?.matches(".bench-guide summary"));
      await page.waitForFunction(() => guideStarts === 1);
      await page.waitForFunction(() => !document.querySelector('[data-test="dodge-precision"]')?.disabled);
      await page.waitForFunction(() => document.querySelector('[data-test="steam-clock"]').textContent !== "10:00");
      // Reopen through the native summary, then dismiss through the same real button.
      if (mobile) await summary.tap(); else await page.keyboard.press("Enter");
      await close.waitFor();
      const paused = await clock.textContent();
      await page.waitForTimeout(250);
      assert.equal(await clock.textContent(), paused, "Reopened guide pauses the active steam clock");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), true);
      if (mobile) await close.tap(); else await page.keyboard.press("Space");
      await page.waitForFunction(() => document.activeElement?.matches(".bench-guide summary"));
      await page.waitForFunction(value => document.querySelector('[data-test="steam-clock"]').textContent !== value, paused);
      assert.equal(await page.evaluate(() => guideStarts), 1, "Reopening must not start a second countdown");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), false);
      assert.equal(await page.evaluate(() => guideSession.explainTutorialStep(guideCS, "steam")), true);
      assert.equal(await page.locator('.bench-guide').evaluate(n => n.open), false, "Acknowledged lesson is not repeated");
    }, { viewport, isMobile: mobile, hasTouch: mobile, reducedMotion });
  }
  for (const [name, viewport, mobile] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["mobile-landscape", { width: 844, height: 390 }, true],
  ]) {
    await check(`${name}-serve-and-two-care`, async page => {
      await init(page);
      assert.deepEqual(await headerLabels(page), labels);
      const before = await storageSnapshot(page);
      await page.evaluate(() => { window.run = T.pull.runPull(cs); });
      await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]')?.disabled);
      assert.equal(await active(page), "pull");
      await fits(page);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-pull.png` });
      // 本番の吸う/提供ボタンを操作する。自動解決は提供確認まで使わない。
      for (let i = 0; i < 2; i++) {
        await page.waitForFunction(() => {
          const n = document.querySelector('[data-test="pull-needle"]');
          return !document.querySelector('[data-test="pull-stop"]').disabled && Number(n.dataset.pos) > 44 && Number(n.dataset.pos) < 56;
        });
        const stop = page.locator('[data-test="pull-stop"]');
        if (mobile) await stop.tap(); else await stop.click();
        await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]').disabled);
      }
      assert.equal(await active(page), "pull", "Ready to serve is still inhalation");
      const serve = page.locator('[data-test="pull-serve"]');
      if (mobile) await serve.tap(); else await serve.click();
      await page.locator('.bench-phase[data-step="serve"][aria-current="step"]').waitFor();
      assert.equal(await page.locator('.bench-title').textContent(), "提供");
      assert.match(await page.locator('.bench-hint').textContent(), /提供した/);
      assert.equal(await page.locator('.bench').getAttribute("data-step"), "serve");
      assert.equal(await page.locator('.bench-progress-count').textContent(), "5 / 6");
      assert.equal(await page.evaluate(() => cs.pullDone && !cs.pull.failed), true);
      await fits(page);
      await assertFits(page, '.rc-summary, .rc-title, [data-test="step-next"]');
      assert.match(await page.locator('.rc-summary').textContent(), /提供した.*吸ってもらおう/);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-serve.png` });
      await page.locator('[data-test="step-next"]').click();
      await page.evaluate(() => window.run);
      for (const round of [1, 2]) {
        await page.evaluate(round => { T.session.craftTest.auto = null; window.run = T.pull.runCare(cs, { round }); }, round);
        await page.locator('[data-test="care-coals"]').waitFor();
        assert.equal(await active(page), "care");
        assert.deepEqual(await headerLabels(page), labels);
        assert.equal(await page.locator('.bench-phase[data-step="care"]').count(), 1);
        assert.equal(await page.locator('.bench-progress-count').textContent(), "6 / 6");
        assert(!/回目/.test(await page.locator('.bench-progress').getAttribute("aria-label")));
        const lead = await page.locator('.care-coals-lead').textContent();
        assert.match(lead, round === 1 ? /提供して約20分.*温度が下が/ : /再び.*温度が下が/);
        await fits(page);
        await assertFits(page, '.care-coals-lead, .care-coals-ask, .care-coal');
        await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-care${round}.png` });
        // 既存の炭焼き・吸引を自動操作して結果を取得。実時間20分の待ちはない。
        await page.evaluate(() => { T.session.craftTest.auto = "good"; });
        await page.locator('[data-test="care-coal-1"]').click();
        await page.evaluate(() => window.run);
        assert.equal(await active(page), "care");
        assert.deepEqual(await headerLabels(page), labels);
        assert(!/調整.*回目/.test(await page.locator('.bench-top').textContent()), "Care count leaked into the header score popup");
        if (round === 1) await page.evaluate(() => { window.firstCare = JSON.stringify(cs.careHistory[0]); });
      }
      const data = await page.evaluate(() => {
        T.score.finalize(cs);
        return { history: cs.careHistory, first: firstCare, parts: cs.parts, weights: T.score.WEIGHTS,
          bonus: T.score.bonusOf(cs).bonus, total: cs.total, arcade: cs.arcade.parts, failed: cs.failed };
      });
      assert.equal(data.history.length, 2);
      assert.equal(JSON.stringify(data.history[0]), data.first);
      assert.equal(data.history[1].startTemp, Math.max(.14, data.history[0].temp - .075));
      assert(data.history.every(h => h.coals === 1 && h.coalsDetail.count === 1 && h.coalsDetail.picks.length === 1));
      assert.equal(data.parts.care1, data.history[0].score);
      assert.equal(data.parts.care2, data.history[1].score);
      assert.deepEqual(data.weights, { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 });
      assert.equal(data.total, Math.round(Math.min(100, Object.values(data.parts).reduce((sum, n) => sum + n * .2, data.bonus)) * 10) / 10);
      assert.equal(data.arcade.care1, Math.round(data.history[0].score * 200));
      assert.equal(data.arcade.care2, Math.round(data.history[1].score * 200));
      assert(!data.failed);
      assert.deepEqual(await storageSnapshot(page), before, "Transient craft display wrote to the save");
    }, { viewport, isMobile: mobile, hasTouch: mobile });
  }

  await check("failed-pull-stays-on-pull", async page => {
    await init(page);
    await page.evaluate(async () => { T.session.craftTest.auto = "burn"; await T.pull.runPull(cs); });
    assert.equal(await page.evaluate(() => cs.pull.failed), "burnt");
    assert.equal(await page.evaluate(() => cs.pullDone), true);
    assert.equal(await active(page), "pull");
    assert.equal(await page.locator('.bench').getAttribute("data-step"), "pull");
    assert.equal(await page.locator('.bench-title').textContent(), "吸い出し");
  });

  await check("single-steps-and-care-aliases", async page => {
    await init(page);
    for (const [id, expected] of [["holes", ["パッキング"]], ["heat", ["炭焼き"]], ["steam", ["蒸らし"]],
      ["pull", ["吸い出し", "提供"]], ["care", ["調整"]], ["care1", ["調整"]], ["care2", ["調整"]]]) {
      await page.evaluate(id => {
        window.cs = T.session.newSession("drill");
        T.session.openBench(cs, { steps: [[id, id]] });
      }, id);
      await page.evaluate(() => T.session.waitBenchReady(cs));
      assert.deepEqual(await headerLabels(page), expected, id);
    }
    const aliases = await page.evaluate(async () => {
      const { buildCraftProgress } = await import("./js/craft/progress.js");
      const progress = buildCraftProgress(T.practice.CRAFT_STEPS);
      return ["care", "care1", "care2"].map(id => {
        progress.update(id, id === "care" ? "熱管理" : `調整 ${id.at(-1)}回目`);
        const cell = progress.root.querySelector('[aria-current="step"]');
        return { step: cell.dataset.step, label: cell.querySelector("b").textContent, count: progress.count.textContent,
          description: progress.root.getAttribute("aria-label") };
      });
    });
    for (const a of aliases) {
      assert.equal(a.step, "care"); assert.equal(a.label, "調整"); assert.equal(a.count, "6 / 6");
      assert.equal(a.description, "制作の工程：調整。6 / 6");
    }
    const phases = await page.evaluate(async () => {
      const { buildCraftProgress } = await import("./js/craft/progress.js");
      const progress = buildCraftProgress(T.practice.CRAFT_STEPS);
      return [["setup", "機材", "pack"], ["mix", "配合", "pack"], ["holes", "アルミ穴あけ", "pack"],
        ["place", "炭配置", "heat"], ["heat", "炭焼き", "heat"], ["steam", "蒸らし中", "steam"],
        ["pull", "吸い出し", "pull"], ["serve", "提供", "serve"]].map(([id, title, expected]) => {
          progress.update(id, title);
          return { expected, active: progress.root.querySelector('[aria-current="step"]').dataset.step,
            labels: [...progress.root.querySelectorAll('.bench-phase-copy b')].map(n => n.textContent) };
        });
    });
    for (const phase of phases) {
      assert.equal(phase.active, phase.expected);
      assert.deepEqual(phase.labels, labels, "Substep titles must keep the six phase labels");
    }
  });

  await check("tutorial-progress-includes-pull-and-serve", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      const session = await import("./js/craft/session.js");
      const ch1 = await import("./js/chapters/ch1.js");
      window.Q = { session };
      window.qcs = session.newSession("tutorial");
      session.openBench(qcs, { steps: ch1.TUTORIAL_STEPS });
      await session.waitBenchReady(qcs);
    });
    assert.deepEqual(await headerLabels(page), ["パッキング", "炭焼き", "蒸らし", "吸い出し", "提供"],
      "Tutorial header lists every phase the lesson actually plays");
    await page.evaluate(() => { Q.session.stepPanel("pull", "吸い出し"); });
    assert.equal(await active(page), "pull");
    assert.equal(await page.locator(".bench-progress-count").textContent(), "4 / 5");
    await page.evaluate(() => { qcs.pullDone = true; qcs.pull = { failed: false }; Q.session.refreshBench(); });
    assert.equal(await active(page), "serve");
    assert.equal(await page.locator(".bench-progress-count").textContent(), "5 / 5");
  });
});
