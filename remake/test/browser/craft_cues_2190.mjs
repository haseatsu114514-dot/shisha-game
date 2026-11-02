// #2190 P04/P15: real practice entry and five real pulls, with fixture state kept separate from public play.
import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits } from "./support.mjs";

await suite("craft-cues-2190", async check => {
  for (const viewport of [{ width: 1180, height: 740 }, { width: 1280, height: 720 }]) {
    await check(`midcheck-${viewport.width}x${viewport.height}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        const practice = await import("./js/craft/practice.js");
        window.C = { core, session, practice, pull: await import("./js/craft/pull.js") };
        C.before = JSON.stringify(core.state);
        C.practiceRun = practice.runFullPractice({ kind: "midcheck" });
      });
      await page.locator('.bench[data-step="setup"]').waitFor();
      const midcheck = await page.evaluate(() => {
        const bench = document.querySelector(".bench"), mode = bench.querySelector(".bench-mode");
        return { mode: bench.dataset.mode, title: mode.firstChild.textContent, note: mode.querySelector("small").textContent,
          sequence: C.practice.CRAFT_STEPS.map(([id]) => id), sameState: C.before === JSON.stringify(C.core.state) };
      });
      assert.deepEqual(midcheck, { mode: "rehearsal", title: "PRACTICE", note: "手順の中間チェック",
        sequence: ["setup", "mix", "pack", "holes", "place", "heat", "steam", "pull", "care1", "care2"], sameState: true });
      await assertFits(page, ".bench-mode");
    }, { viewport });

    await check(`controls-${viewport.width}x${viewport.height}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        window.C = { core, session: await import("./js/craft/session.js"), pull: await import("./js/craft/pull.js") };
      });

      // Header context also preserves the eve rehearsal, the first lesson, and explicit event/assistance notes.
      for (const [properties, expected] of [
        [{ mode: "rehearsal", practiceKind: "rehearsal" }, ["REHEARSAL", "大会前のリハーサル"]],
        [{ mode: "rehearsal", practiceKind: "practice" }, ["PRACTICE", "一台を作る練習"]],
        [{ mode: "tutorial", practiceKind: "early" }, ["LESSON", "レッスン"]],
        [{ mode: "rehearsal", practiceKind: "practice", eventTitle: "PRACTICE", eventNote: "まかないで練習" }, ["PRACTICE", "まかないで練習"]],
        [{ mode: "rehearsal", practiceKind: "midcheck", retryAssist: true }, ["PRACTICE", "今回のみ操作補助"]],
        [{ mode: "tournament" }, ["SMOKE CROWN CUP", "大会"]],
      ]) {
        const actual = await page.evaluate(async properties => {
          const cs = Object.assign(C.session.newSession(properties.mode), properties);
          C.session.openBench(cs); await C.session.waitBenchReady(cs);
          const mode = document.querySelector(".bench-mode");
          return [mode.firstChild.textContent, mode.querySelector("small").textContent];
        }, properties);
        assert.deepEqual(actual, expected);
      }

      await page.evaluate(async () => {
        C.core.newGame();
        const cs = C.cs = C.session.newSession("tutorial");
        cs.holes = { total: 24, minimumComplete: true }; cs.pack = "normal";
        cs.steam = { temp: .32, score: 100, hits: 0, concentration: 1 };
        C.session.openBench(cs, { steps: [["pull", "PULL"]] });
        await C.session.waitBenchReady(cs);
        C.run = C.pull.runPull(cs);
      });
      await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor();
      const saved = await storageSnapshot(page);
      for (let i = 1; i <= 5; i++) {
        // Observe the rendered needle and send the normal pointer event at keep-left, moving away from the target.
        await page.evaluate(async () => {
          const button = document.querySelector('[data-test="pull-stop"]'), needle = document.querySelector('.pg-needle');
          const deadline = performance.now() + 8000;
          while (button.disabled || Number(needle.dataset.pos) < 39 || Number(needle.dataset.pos) > 41) {
            if (performance.now() > deadline) throw new Error("Needle did not reach keep-left");
            await new Promise(requestAnimationFrame);
          }
          button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        });
        await page.waitForFunction(() => !document.querySelector('.pull-play').dataset.draw);
        assert.equal(await page.locator('[data-test="pull-count"]').getAttribute("data-pulls"), String(i));
        if (i === 1) assert.match(await page.locator('[data-test="craft-feedback"]').textContent(), /まだ合わせられる/);
      }
      const feedback = await page.locator('[data-test="craft-feedback"]').textContent();
      assert.match(feedback, /吸うのはここまで.*「提供する」/);
      assert(!/まだ合わせられる|キープ左|右で微増/.test(feedback));
      assert(await page.locator('[data-test="pull-stop"]').isDisabled());
      assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()));
      await assertFits(page, '[data-test="craft-feedback"], [data-test="pull-count"], [data-test="pull-serve"]');
      await page.keyboard.press("Space");
      assert.equal(await page.locator('[data-test="pull-count"]').getAttribute("data-pulls"), "5", "The existing cap blocks a sixth pull");
      assert.equal(await page.locator('.pull-play').getAttribute("data-draw"), null);
      await page.locator('[data-test="pull-serve"]').click();
      await page.locator('.result-card.show').waitFor();
      assert.equal(await page.evaluate(() => C.cs.pull.pulls), 5);
      assert.deepEqual(await storageSnapshot(page), saved, "Craft cues do not write player saves");
      await page.locator('[data-test="step-next"]').click();
      await page.evaluate(() => C.run);
    }, { viewport });
  }
});
