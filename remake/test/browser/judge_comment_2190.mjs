// #2190 final item 6: saved craft fixtures rendered through the actual final result table.
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

await suite("judge-comment-2190", async check => {
  for (const viewport of [{ width: 1180, height: 740 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await check(`${viewport.width}x${viewport.height}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const { DB } = await import("./js/core/data.js");
        const characters = await (await fetch("../data/characters.json")).json();
        for (const character of characters) { DB.characters[character.id] = character; core.state.met[character.id] = true; }
        const { temperatureBands } = await import("./js/craft/temperature-model.js");
        const { pullResult } = await import("./js/craft/conditions.js");
        const { finalize } = await import("./js/craft/score.js");
        const cs = { mode: "tournament", chapter: 1, water: .5, mix: { double_apple: 12 },
          equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
          holes: { total: 22, evenness: .6, outerEven: .6, innerExcess: 0, score: 60, minimumComplete: true },
          heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
          mixInfo: { score: 60, intensity: 5, total: 12 }, steam: { min: 5, hits: 2, score: 70 }, pack: "normal" };
        const bands = temperatureBands(cs);
        cs.pull = { ...pullResult(bands.center, 2, 0, bands, 3), temp: bands.center, pulls: 2 };
        const adjustment = { ...pullResult(bands.center, 1, 0, bands, 2), temp: bands.center, pulls: 1 };
        cs.careHistory = [{ ...adjustment }, { ...adjustment }];
        finalize(cs);
        window.J = { saved: JSON.stringify(cs), finalize, result: await import("./js/craft/result.js") };
      });
      const storage = await storageSnapshot(page);
      for (const [kind, expected] of [
        ["three-ideal", /提供も2回の調整も、いい温度だった/],
        ["three-ideal-next", /提供も2回の調整も、いい温度だった/],
        ["recorded-miss", /温度が合わなかったところ/],
        ["legacy", /いいねえ。そのまま丁寧にいこう/],
      ]) {
        await page.evaluate(kind => {
          J.cs = JSON.parse(J.saved);
          if (kind === "three-ideal-next") {
            Object.assign(J.cs.holes, { score: 95, evenness: .95, outerEven: .95 });
            Object.assign(J.cs.heat, { score: 95, heatPower: 95, heatStability: 95, burnRisk: 5, aromaRetention: 95 });
            delete J.cs.stats; J.finalize(J.cs);
          }
          if (kind === "recorded-miss") Object.assign(J.cs.careHistory[1], { temp: .2, score: 40, inZone: false });
          if (kind === "legacy") delete J.cs.pull.inZone;
          J.before = JSON.stringify(J.cs);
          J.run = J.result.resultTable(J.cs, J.result.outcomeOf(J.cs.total).rank);
        }, kind);
        await page.locator('[data-test="result-next"]').waitFor();
        const deductions = page.locator(".rt-judge-deduction");
        assert.equal(await deductions.count(), 3);
        assert.deepEqual(await deductions.evaluateAll(nodes => nodes.map(node => node.dataset.judge)), ["maezono", "dr_kemuri", "sui"]);
        for (const line of await deductions.all()) {
          const judge = await line.getAttribute("data-judge");
          const expectedReason = await page.evaluate(async judge => (await import("./js/craft/feedback.js")).judgeDeductionReason(J.cs, judge).text, judge);
          assert((await line.innerText()).endsWith(expectedReason));
          await line.scrollIntoViewIfNeeded();
          await assertFits(page, ".rt-judge-deduction[data-judge='" + await line.getAttribute("data-judge") + "']");
        }
        const renderedReasons = (await deductions.allTextContents()).map(text => text.slice(text.indexOf("：") + 1));
        assert.equal(new Set(renderedReasons).size, 3);
        // Scores and the actual vote ranking remain exactly as requested before rendering.
        assert.deepEqual(await page.locator(".rt-row").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.id, rank: Number(node.dataset.rank) }))),
          await page.evaluate(() => {
            const table = J.result.pointTable(J.result.outcomeOf(J.cs.total).rank);
            const ids = J.result.CONTESTANTS;
            const points = id => Object.values(table).reduce((sum, row) => sum + (row[id] || 0), 0);
            return [...ids].sort((a, b) => points(b) - points(a)).map(id => ({ id, rank: 1 + ids.filter(other => points(other) > points(id)).length }));
          }));
        await page.locator(".rt-judge-comment").scrollIntoViewIfNeeded();
        const text = await page.locator(".rt-judge-comment").innerText();
        assert.match(text, expected);
        assert(!text.includes("温度をもっと揃えたい"));
        const quality = page.locator(".rt-part").filter({ has: page.locator("span", { hasText: /^完成品$/ }) });
        assert.equal(await quality.locator(".craft-evaluation").textContent(), "○");
        await assertFits(page, ".rt-judge-comment");
        if (kind === "three-ideal-next") {
          assert.match(await page.locator(".rt-next-tip").innerText(), /今回の記録を見て、次に試すことを選ぼう/);
          await page.locator(".rt-next-tip").scrollIntoViewIfNeeded();
          await assertFits(page, ".rt-next-tip");
        }
        assert(await page.evaluate(() => JSON.stringify(J.cs) === J.before), "Result comment leaves craft data unchanged");
        assert.deepEqual(await storageSnapshot(page), storage, "Result comment does not save or award anything");
        await page.locator('[data-test="result-next"]').click();
        await page.evaluate(async () => {
          await J.run;
          // The chapter normally clears the retired result when it opens the next scene.
          const { dropRetired } = await import("./js/core/ui.js"); dropRetired();
        });
        await page.locator('[data-test="tournament-result"]').waitFor({ state: "detached" });
      }
      // Chapters two and three share this judge panel; chapter four renders its actual final standings view.
      for (const chapter of [2, 3, 4]) {
        const expectedIds = chapter === 2 ? ["maezono", "dr_kemuri", "sui"] : chapter === 3 ? ["emil", "dr_kemuri", "sui"] : ["sui", "da_silva", "emil"];
        await page.evaluate(async ({ chapter, expectedIds }) => {
          const { modal } = await import("./js/core/ui.js");
          const { judgePanel } = await import("./js/craft/tournament-graphics.js");
          const { CH4_CONTESTANTS } = await import("./js/chapters/ch4-tournament-state.js");
          const votes = Object.fromEntries(expectedIds.map(judge => [judge, { hajime: 10 }]));
          let body = judgePanel(votes, expectedIds, { cls: ".ch2-contest-judges", craft: J.cs });
          if (chapter === 4) {
            const { chapterFourStandingsView } = await import("./js/chapters/ch4-standings.js");
            const p = { voted: 4, craft: J.cs, votes };
            const rows = CH4_CONTESTANTS.map((id, i) => ({ id, rank: i + 1, points: id === "hajime" ? 30 : 0 }));
            const options = { rows, notes: [], final: true };
            body = chapterFourStandingsView(p, options);
            if (chapterFourStandingsView(p, { ...options, final: false }).querySelector(".judge-deduction")) throw new Error("Interim standings must not show final deductions");
          }
          J.modal = modal({ title: "審査結果", body, options: [{ label: "次へ", value: true, test: "deduction-close" }] });
        }, { chapter, expectedIds });
        const lines = page.locator(".judge-deduction");
        assert.equal(await lines.count(), 3);
        assert.deepEqual(await lines.evaluateAll(nodes => nodes.map(node => node.dataset.judge)), expectedIds);
        assert.equal(new Set(await lines.allTextContents()).size, 3);
        for (const line of await lines.all()) {
          await line.scrollIntoViewIfNeeded();
          if (viewport.width === 1280) {
            assert(await line.evaluate(async node => {
              const { judgeDeductionReason } = await import("./js/craft/feedback.js");
              const original = node.textContent;
              try {
                return ["holes", "heat", "shisha", "care1", "care2"].every(item => {
                  node.textContent = judgeDeductionReason({ parts: { [item]: 70 } }, node.dataset.judge).text;
                  return node.getBoundingClientRect().height <= parseFloat(getComputedStyle(node).lineHeight) + 1
                    && node.scrollWidth <= node.clientWidth + 1;
                });
              } finally { node.textContent = original; }
            }), "Every item reason fits on one line for this judge");
          }
          await assertFits(page, ".judge-deduction[data-judge='" + await line.getAttribute("data-judge") + "']");
        }
        assert(await page.evaluate(() => JSON.stringify(J.cs) === J.before));
        assert.deepEqual(await storageSnapshot(page), storage);
        // Leave the last rendered result visible for the harness screenshot.
        if (chapter !== 4) {
          await page.locator('[data-test="deduction-close"]').click();
          await page.evaluate(() => J.modal);
        }
      }
    }, { viewport });
  }
});
