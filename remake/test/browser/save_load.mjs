// Existing production save APIs and save/load UI; no gameplay source changes.
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    window.QA = { core, saves: await import("./js/scenes/saves.js") };
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 6, slot: 1, money: 45678, stamina: 73, seed: 1234, weatherSeed: 4 });
    Object.assign(s.flags, { _morning_6: true, _errand_scout_done: true, _delivery_adam_done: true,
      _delivery_minto_done: true, _lime_tut: 1, _qa_preserved: "keep" });
    s.stats.insight = 27; s.statXp.insight = 0.25;
    s.flavorStock.double_apple = 37;
    s.relationshipMemories = ["tsumugi_creature"];
    s.lovers = ["mashiro"]; s.lovePts.mashiro = 4; s.loveLevel.mashiro = 2;
    s.romance.mashiro = 2;
    s.romanceChoices.qa = { char: "mashiro", value: 1, day: 5 };
    s.finales.mashiro = { day: 5, chapter: 1, route: "lover" };
    s.reel.seed = 4321; s.reel.count = 3;
    s.keepsakes = ["qa_keepsake"];
    localStorage.setItem(core.CONFIG_KEY, JSON.stringify({ textSpeed: 4, bgmVolume: 0 }));
    localStorage.setItem("qa_unrelated", "keep");
    sessionStorage.setItem("qa_unrelated", "session-keep");
    QA.copy = value => {
      const copy = JSON.parse(JSON.stringify(value));
      delete copy.savedAt;
      return copy;
    };
  });
}

await suite("save-load", async check => {
  await check("all-slots-round-trip", async page => {
    await prepare(page);
    const result = await page.evaluate(() => {
      const { core, copy } = QA;
      const expected = {};
      for (const [index, slot] of core.SAVE_SLOTS.entries()) {
        core.state.money = 45678 + index;
        if (slot.auto) core.save(); else core.saveToSlot(slot.key);
        expected[slot.key] = copy(core.state);
      }
      expected[core.SAVE_KEY] = copy(core.state); // manual saves also refresh autosave
      const comparisons = core.SAVE_SLOTS.map(slot => {
        core.newGame();
        const loaded = slot.auto ? core.load() : core.loadFromSlot(slot.key);
        return { key: slot.key, expected: expected[slot.key], actual: copy(loaded) };
      });
      return { comparisons, config: localStorage.getItem(core.CONFIG_KEY),
        unrelated: localStorage.getItem("qa_unrelated"), session: sessionStorage.getItem("qa_unrelated") };
    });
    for (const { key, expected, actual } of result.comparisons) assert.deepEqual(actual, expected, key);
    assert.equal(JSON.parse(result.config).textSpeed, 4);
    assert.equal(result.unrelated, "keep"); assert.equal(result.session, "session-keep");
  });

  await check("legacy-migration-auto-and-manual", async page => {
    await prepare(page);
    const result = await page.evaluate(() => {
      const { core, copy } = QA;
      // Representative pre-schema-6 save: no newer fields or gram inventory.
      const old = { schema: 5, chapter: 1, phase: "daily", day: 15, slot: 1, money: 1000000, stamina: 60,
        seed: 1234, weatherSeed: 4,
        stats: { technique: 10, sense: 30, guts: 50, charm: 70, insight: 90 },
        statXp: { technique: 0.5, sense: 0.75, guts: 1, charm: 1.5, insight: 2 },
        flags: { _confession_due: "mashiro", _confession_wait: "mashiro", _qa_preserved: true },
        story: { minto: 6, adam: 5 }, flavors: ["double_apple", "lemon"],
        lovers: ["mashiro"], lovePts: { mashiro: 4 }, loveLevel: { mashiro: 2 },
        tournament: { attempts: 2, lastRank: null },
        reel: { seed: 4321, count: 3, pending: [], introDone: true } };
      const raw = JSON.stringify(old);
      localStorage.setItem(core.SAVE_KEY, raw);
      localStorage.setItem("suien_remake_slot1", raw);
      const auto = copy(core.load());
      const automaticSourcePreserved = localStorage.getItem(core.SAVE_KEY) === raw;
      const manual = copy(core.loadFromSlot("suien_remake_slot1"));
      const manualSourcePreserved = localStorage.getItem("suien_remake_slot1") === raw;
      return { auto, manual, schema: core.SCHEMA, automaticSourcePreserved, manualSourcePreserved,
        persisted: copy(JSON.parse(localStorage.getItem(core.SAVE_KEY))) };
    });
    assert.deepEqual(result.auto, result.manual);
    assert.deepEqual(result.persisted, result.manual);
    const s = result.auto;
    assert.equal(s.schema, result.schema); assert.equal(s.day, 14); assert.equal(s.money, 999999);
    assert.equal(s.tournament.attempts, 2); assert.equal(s.phase, "daily");
    assert.equal(s.story.minto, 5); assert.equal(s.story.adam, 4);
    assert(s.flags._minto_fifth_done && s.flags._adam_arcade_done && s.flags._qa_preserved);
    assert.equal(s.flags._confession_due, undefined); assert.equal(s.flags._confession_wait, undefined);
    assert.deepEqual(s.flavorStock, { double_apple: 50, lemon: 50 });
    assert.deepEqual(s.statXp, { technique: 0.5, sense: 0.5, guts: 0.5, charm: 0.5, insight: 0.5 });
    assert.deepEqual(s.lovers, ["mashiro"]); assert.equal(s.lovePts.mashiro, 4);
    assert.deepEqual(s.romance, {}); assert.deepEqual(s.relationshipMemories, []);
    assert(s.reel.installed); assert.equal(s.reel.seed, 4321);
    assert(result.automaticSourcePreserved && result.manualSourcePreserved);
  });

  await check("missing-and-invalid-json", async page => {
    await prepare(page);
    const result = await page.evaluate(() => {
      const { core } = QA;
      const before = JSON.stringify(core.state);
      const outcomes = [];
      for (const raw of [null, "{broken", "null"]) {
        for (const key of [core.SAVE_KEY, "suien_remake_slot1"]) {
          if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw);
          outcomes.push(core.readSlot(key), key === core.SAVE_KEY ? core.load() : core.loadFromSlot(key));
        }
      }
      return { outcomes, unchanged: before === JSON.stringify(core.state) };
    });
    assert(result.outcomes.every(value => value === null)); assert(result.unchanged);
  });

  for (const [label, options] of [
    ["desktop-ui", { viewport: { width: 1280, height: 720 } }],
    ["mobile-ui", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(label, async page => {
      await prepare(page);
      // Use production resume/menu handlers, then click the actual save/load controls.
      await page.evaluate(async () => {
        QA.core.save();
        const { showTitle } = await import("./js/scenes/title.js");
        showTitle();
      });
      await assertFits(page, ".title-item");
      await page.locator('[data-test="title-load"]').click();
      await assertFits(page, ".save-slot, [data-test='slot-cancel']");
      await page.locator('[data-test="slot-0"]').click();
      await page.locator("#screen .map:not(.done)").waitFor();
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-save"]').click();
      assert(await page.locator('[data-test="slot-0"]').isDisabled());
      await page.locator('[data-test="slot-1"]').click();
      await page.locator("#modal.show").waitFor({ state: "hidden" });
      let saved = await page.evaluate(() => QA.copy(QA.core.readSlot("suien_remake_slot1")));
      assert.equal(saved.money, 45678); assert.equal(saved.day, 6);
      await page.evaluate(() => { QA.core.state.money = 999; });
      // Cancel overwrite and cancel a load: neither may change storage or current progress.
      const before = await storageSnapshot(page);
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-save"]').click();
      await page.locator('[data-test="slot-1"]').click();
      await page.locator("#modal .modal-actions button").first().click();
      await page.locator('[data-test="slot-cancel"]').click();
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-load"]').click();
      await page.locator('[data-test="slot-1"]').click();
      await page.locator("#modal .modal-actions button").first().click();
      assert.deepEqual(await storageSnapshot(page), before);
      assert.equal(await page.evaluate(() => QA.core.state.money), 999);
      // Confirming overwrite replaces this slot with the new progress.
      await page.evaluate(() => { QA.core.state.money = 12345; });
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-save"]').click();
      await page.locator('[data-test="slot-1"]').click();
      await page.locator('[data-test="confirm-overwrite"]').click();
      await page.locator("#modal.show").waitFor({ state: "hidden" });
      saved = await page.evaluate(() => QA.copy(QA.core.readSlot("suien_remake_slot1")));
      assert.equal(saved.money, 12345);
      await page.evaluate(() => { QA.core.state.money = 999; });
      // A confirmed manual load reloads the document and resumes directly on the map.
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-load"]').click();
      await page.locator('[data-test="slot-1"]').click();
      await Promise.all([
        page.waitForEvent("load"),
        page.locator('[data-test="confirm-load"]').click(),
      ]);
      await page.locator("#screen .map:not(.done)").waitFor();
      const loaded = await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const copy = JSON.parse(JSON.stringify(core.state)); delete copy.savedAt;
        return { copy, resumeAgain: core.consumeResumeOnBoot(), unrelated: localStorage.getItem("qa_unrelated") };
      });
      assert.deepEqual(loaded.copy, saved);
      assert.equal(loaded.resumeAgain, false); assert.equal(loaded.unrelated, "keep");
      await assertFits(page, "[data-test='hud-menu']");
    }, options);
  }

  await check("touch-portrait-rotation", async page => {
    assert(await page.locator("#rotate-hint").isVisible());
    const before = await storageSnapshot(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator("#rotate-hint").waitFor({ state: "hidden" });
    await assertFits(page, ".title-item");
    assert.deepEqual(await storageSnapshot(page), before);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
