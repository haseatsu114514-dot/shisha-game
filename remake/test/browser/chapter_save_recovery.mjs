import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const diagnosticKey = "suien_remake_chapter_save_error";
const autoKey = "suien_remake_save";
const manualKey = "suien_remake_slot1";
const raw = (page, key) => page.evaluate(key => localStorage.getItem(key), key);

await suite("chapter-save-recovery", async check => {
  for (const [chapter, screen, condition] of [
    [2, "ch2-tournament", "_ch2_tournament.version"],
    [3, "ch3-intro", "_ch3_intro.stage"],
    [4, "ch4", "_ch4.match.version"],
    [5, "ch5", "_ch5.part / _ch5_match_scheduled / _ch5_match_started"],
  ]) {
    await check(`chapter-${chapter}-restart`, async page => {
      const consoleErrors = [];
      page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
      const original = await page.evaluate(async chapter => {
        const core = await import("./js/core/state.js");
        const progress = await import(`./js/chapters/ch${chapter}-progress.js`);
        const value = core.newGame();
        Object.assign(value, { chapter: chapter - 1, phase: "cleared", day: 40, money: 51000, stamina: 73,
          flavorStock: { double_apple: 12 }, seed: 10, weatherSeed: 7 });
        value.affinity.sumi = 15;
        Object.assign(value.flags, { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
          _ch3_cleared: chapter >= 4, _ch4_cleared: chapter === 5 });
        if (chapter === 3) value.flags._ch2_tournament = { stage: "complete" };
        core.saveToSlot(core.SAVE_SLOTS[1].key);
        const advance = [progress.advanceToChapterTwo, progress.advanceToChapterThree,
          progress.advanceToChapterFour, progress.advanceToChapterFive][chapter - 2];
        if (!advance(value)) throw new Error("Chapter advance failed");
        const checkpoint = value.flags._chapter_start_checkpoint;
        Object.assign(value, { day: 55, money: 200, stamina: 10, flavorStock: {} });
        if (chapter === 2) value.flags._ch2_tournament = { version: 99 };
        if (chapter === 3) {
          value.flags._ch3_intro.stage = 99;
          value.flags._ch3_tournament = { version: 1 };
        }
        if (chapter === 4) {
          value.phase = "tournament";
          value.flags._ch4_prep.departed = true;
          Object.assign(value.flags._ch4, { day: progress.CH4_DAILY_TOURNAMENT_DAY,
            part: "tournament", stage: progress.CH4_PROLOGUE.length, titleSeen: true,
            read: { ch4_tournament_start: true }, match: { version: 99, craft: {} } });
        }
        if (chapter === 5) value.flags._ch5_match_started = true;
        core.save();
        return { day: checkpoint.day, money: checkpoint.money, stamina: checkpoint.stamina,
          stock: checkpoint.flavorStock, cycleId: checkpoint.cycleId };
      }, chapter);
      const manual = await raw(page, manualKey);
      await page.evaluate(async () => {
        const { load } = await import("./js/core/state.js");
        const { resumeGame } = await import("./js/chapters/ch1.js");
        if (!load()) throw new Error("Test save was not loaded");
        void resumeGame();
      });
      if (chapter === 4) await page.locator(dt("ch4-start")).click({ timeout: 60000 });
      await page.locator(dt(`${screen}-error`)).waitFor({ timeout: 60000 });
      const diagnostic = JSON.parse(await raw(page, diagnosticKey));
      assert.equal(diagnostic.chapter, chapter);
      assert.equal(diagnostic.condition, condition);
      assert(consoleErrors.some(message => message.includes(condition)), "the condition is logged to console");

      const restart = page.locator(dt(`${screen}-restart-chapter`));
      assert.equal(await restart.textContent(), "この章の頭から再開");
      const broken = await raw(page, autoKey);
      await restart.click();
      await page.locator(dt("chapter-restart-cancel")).click();
      assert.equal(await raw(page, autoKey), broken);
      await restart.click();
      await Promise.all([
        page.waitForEvent("load", { timeout: 60000 }),
        page.locator(dt("chapter-restart-confirm")).click(),
      ]);
      await page.waitForFunction(({ chapter, day }) => {
        const state = window.__remake?.state;
        return state?.chapter === chapter && state.day === day;
      }, { chapter, day: original.day }, { timeout: 60000 });
      const restored = JSON.parse(await raw(page, autoKey));
      assert.deepEqual({ day: restored.day, money: restored.money, stamina: restored.stamina,
        stock: restored.flavorStock, cycleId: restored.cycleId }, original);
      assert.equal(restored.affinity.sumi, 15);
      assert.equal(await raw(page, manualKey), manual);
    }, { serviceWorkers: "block" });
  }
});
