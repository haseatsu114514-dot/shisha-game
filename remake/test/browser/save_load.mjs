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
    s.flavorMastery = { lemon: 6, mint: 60 };
    s.flavorLessons = ["remake_lemon_gift"];
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
  await check("chapter-two-first-day-slot-labels-survive-reopen", async page => {
    await prepare(page);
    const oldRaw = await page.evaluate(async () => {
      const { core } = QA;
      const firstDay = { ...core.newGame(), chapter: 2, phase: "opening", day: 15, slot: 0,
        flags: { _ch2_day1: { startDay: 15, stage: "arrival" } } };
      const completed = { ...firstDay, phase: "daily", flags: { _ch2_day1: { startDay: 15, stage: "complete" } } };
      const old = { ...firstDay, schema: 5 };
      const secondDay = { ...completed, day: 16 };
      for (const [slot, value] of core.SAVE_SLOTS.map((slot, i) => [slot, [firstDay, completed, old, secondDay][i]])) {
        localStorage.setItem(slot.key, JSON.stringify(value));
      }
      (await import("./js/scenes/title.js")).showTitle();
      return localStorage.getItem(core.SAVE_SLOTS[2].key);
    });
    const labels = async () => Promise.all([0, 1, 2, 3].map(async i =>
      page.locator(`[data-test="slot-${i}"] .ss-info b`).textContent()));
    await page.locator('[data-test="title-load"]').click();
    const captions = await labels();
    assert.match(captions[0], /第2章.*DAY 1.*初日/);
    assert(!captions[0].includes("プロローグ"));
    assert.match(captions[1], /第2章.*DAY 1.*初日終了/);
    assert.match(captions[2], /第2章.*DAY 1.*初日/);
    assert(!captions[2].includes("プロローグ"));
    assert.match(captions[3], /第2章.*DAY 2.*日常/);
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    assert.deepEqual(await labels(), captions);
    const loaded = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.loadFromSlot(core.SAVE_SLOTS[2].key);
      return { chapter: value.chapter, day: value.day, source: localStorage.getItem(core.SAVE_SLOTS[2].key) };
    });
    assert.equal(loaded.chapter, 2);
    assert.equal(loaded.day, 15);
    assert.equal(loaded.source, oldRaw);
  });

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
      const persisted = copy(JSON.parse(localStorage.getItem(core.SAVE_KEY)));
      // cycleId is a per-cycle unique stamp issued on SCHEMA 22 migration
      // (state.js: issued only when missing). Two independent migrations of
      // the same legacy raw are two adoptions and receive different stamps,
      // so exclude it from the purity comparison — like savedAt in copy() —
      // and verify the issuance itself separately below.
      const cycleIds = { auto: auto.cycleId, manual: manual.cycleId, persisted: persisted.cycleId };
      delete auto.cycleId; delete manual.cycleId; delete persisted.cycleId;
      return { auto, manual, schema: core.SCHEMA, automaticSourcePreserved, manualSourcePreserved,
        persisted, cycleIds };
    });
    assert.deepEqual(result.auto, result.manual);
    assert.deepEqual(result.persisted, result.manual);
    for (const id of Object.values(result.cycleIds)) {
      assert.equal(typeof id, "string"); assert(id.length > 0, "migration must issue a cycleId");
    }
    assert.equal(result.cycleIds.persisted, result.cycleIds.manual,
      "manual load must refresh the autosave with the same cycleId");
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

  await check("future-schema-slot-notice", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      const { core } = QA;
      const future = {
        schema: core.SCHEMA + 1, chapter: 1, phase: "daily",
        day: 6, slot: 1, money: 45678,
      };
      localStorage.setItem(core.SAVE_SLOTS[1].key, JSON.stringify(future));
      (await import("./js/scenes/title.js")).showTitle();
    });
    const before = await storageSnapshot(page);
    await page.locator('[data-test="title-load"]').click();
    const slot = page.locator('[data-test="slot-1"]');
    assert.equal(await slot.locator(".ss-info b").textContent(), "新しいバージョンのセーブです");
    assert.equal(await slot.locator(".ss-info small").textContent(), "今のバージョンでは読み込めません");
    await slot.click();
    const warning = page.locator("#toasts .toast.warn");
    await warning.waitFor({ state: "visible" });
    assert.equal(await warning.textContent(), "新しいバージョンのセーブです");
    assert(await page.locator('#modal.show [data-test="slot-1"]').isVisible());
    assert.deepEqual(await storageSnapshot(page), before);
    await page.locator('[data-test="slot-cancel"]').click();
  });

  for (const [label, options] of [
    ["desktop-ui", { viewport: { width: 1280, height: 720 } }],
    ["mobile-ui", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(label, async page => {
      await prepare(page);
      // Use production resume/menu handlers, then click the actual save/load controls.
      await page.evaluate(async () => {
        // Read any newly added story catch-up before exercising the map's save menu.
        const { vnTest } = await import("./js/vn/engine.js");
        vnTest.turbo = true;
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

  // #1262: 書き込み失敗は実UIで警告し、既存の枠を壊さず、解消後は同じ手順で保存し直せる。
  await check("save-failure-ui-preserves-slot-and-recovers", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      QA.core.save();
      (await import("./js/scenes/title.js")).showTitle();
    });
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    await page.locator("#screen .map:not(.done)").waitFor();
    const uiSave = async () => {
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-save"]').click();
      await page.locator('[data-test="slot-1"]').click();
    };
    // 目印の既知セーブを手動枠1へ通常保存する。
    await uiSave();
    await page.locator(".toast.good", { hasText: "にセーブした" }).waitFor();
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => QA.core.readSlot("suien_remake_slot1").money), 45678);
    // 枠1への書き込みだけ失敗させる（saveToSlot が先に行うオートセーブは通常どおり成功させる）。
    await page.evaluate(() => {
      QA.core.state.money = 11111;
      QA.setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "suien_remake_slot1") throw new DOMException("quota", "QuotaExceededError");
        return QA.setItem.call(this, key, value);
      };
    });
    await uiSave();
    await page.locator('[data-test="confirm-overwrite"]').click();
    const warn = page.locator(".toast.warn");
    await warn.waitFor();
    assert.equal(await warn.textContent(), "セーブできなかった（ブラウザの保存領域がいっぱいかも）");
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    const failed = await page.evaluate(() => ({ slot: QA.core.readSlot("suien_remake_slot1").money,
      auto: QA.core.readSlot(QA.core.SAVE_KEY).money, current: QA.core.state.money }));
    assert.equal(failed.slot, 45678, "失敗した上書きは既存の枠1を保持する");
    assert.equal(failed.auto, 11111); assert.equal(failed.current, 11111);
    // 原因が解消したら、同じ実UI手順で保存できる。
    await page.evaluate(() => { Storage.prototype.setItem = QA.setItem; });
    await warn.waitFor({ state: "detached" }); // 固定待ちではなく toast の消滅を待つ
    await uiSave();
    await page.locator('[data-test="confirm-overwrite"]').click();
    await page.locator(".toast.good", { hasText: "にセーブした" }).waitFor();
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".toast.warn").count(), 0);
    assert.equal(await page.evaluate(() => QA.core.readSlot("suien_remake_slot1").money), 11111);
  }, { viewport: { width: 1280, height: 720 } });

  // #782: a valid DAY11 free-time checkpoint. Earlier fixed stories are read;
  // today's submission/done flags are deliberately absent. Only the normal daily
  // runner may complete them. All storage belongs to check()'s isolated context.
  for (const [device, options] of [
    ["pc", { viewport: { width: 1280, height: 720 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(`tonari-fixed-day11-${device}`, async page => {
    const press = async selector => {
      const target = page.locator(selector);
      if (device === "touch") await target.tap(); else await target.click();
    };
    // Same hit-testing as facility_map.mjs: no forced click through another pin.
    const pin = async id => {
      // LOAD can show the map before its smoke wipe clears; a reveal also owns input.
      await page.waitForFunction(() => !document.querySelector("#wipe.cover, #wipe.black, #screen .map[data-revealing='true']"));
      const target = page.locator(`[data-test="pin-${id}"]`);
      await target.scrollIntoViewIfNeeded();
      // The map toggles an already-selected pin closed. Selecting a destination is idempotent here.
      if (await target.evaluate(node => node.classList.contains("sel"))) return;
      const point = await target.evaluate(node => {
        for (const part of [node, node.querySelector(".ico")].filter(Boolean)) {
          const r = part.getBoundingClientRect();
          for (const dy of [0.5, 0.2, 0.8]) for (const dx of [0.5, 0.2, 0.8]) {
            const x = r.left + r.width * dx, y = r.top + r.height * dy;
            if (document.elementFromPoint(x, y)?.closest(".spot-pin") === node) return { x, y };
          }
        }
        return null;
      });
      assert(point, `${id}: no unobscured pin hit target`);
      if (device === "touch") await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    };
    const progress = () => page.evaluate(async () => {
      const { state: s } = await import("./js/core/state.js");
      return JSON.parse(JSON.stringify({ day: s.day, slot: s.slot, money: s.money, stamina: s.stamina,
        visitedDay: s.visitedDay, visits: s.visits, lovePts: s.lovePts, loveLevel: s.loveLevel }));
    });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 1, phase: "daily", day: 11, slot: 0,
        money: 20000, stamina: 100, seed: 1234, weatherSeed: 4 });
      Object.assign(s.met, { sumi: true, tsumugi: true });
      Object.assign(s.flags, { _morning_11: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _delivery_report_done: true,
        _c_station_registered: true, _lime_tut: 1,
        _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
        _ev_first_practice: true, _ev_midcheck: true, _ev_salaryman: true,
        _ev_day5: true, _ev_meet_rivals: true, _ev_salaryman_change: true });
      const { vnTest } = await import("./js/vn/engine.js");
      vnTest.turbo = true; // existing dialogue acceleration, not event completion
      core.config.bgmVolume = 0;
      core.save();
      (await import("./js/scenes/title.js")).showTitle();
    });
    await press('[data-test="title-load"]');
    await press('[data-test="slot-0"]');
    await page.locator("#screen .map:not(.done)").waitFor();
    let before = await progress();
    const assertBlocked = async () => {
      const shop = page.locator('[data-test="pin-tonari"]');
      assert(await shop.isVisible(), "mandatory event must retain the store pin");
      assert.equal(await shop.locator(".pin-person").count(), 0, "all people are hidden");
      assert.doesNotMatch(await shop.getAttribute("aria-label"), /在店：/);
      await pin("tonari");
      assert.match(await page.locator(".mi-no").textContent(), /この後もtonari.*別のところ/);
      assert.equal(await page.locator('[data-test="map-go"]').count(), 0, "no earlier paid visit can start");
      assert.deepEqual(await progress(), before, "blocked selection must not charge or consume time/visits");
      await pin("rest");
      assert(await page.locator('[data-test="map-go"]').isEnabled(), "another destination remains selectable");
      assert.deepEqual(await progress(), before, "choosing another pin is also free");
    };
    await assertBlocked();
    await press('[data-test="hud-menu"]'); await press('[data-test="menu-save"]');
    await press('[data-test="slot-1"]');
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    const saved = await page.evaluate(() => localStorage.getItem("suien_remake_slot1"));
    await press('[data-test="hud-menu"]'); await press('[data-test="menu-load"]');
    await press('[data-test="slot-1"]');
    await Promise.all([page.waitForEvent("load"), press('[data-test="confirm-load"]')]);
    await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = true; });
    await page.locator("#screen .map:not(.done)").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_slot1")), saved, "LOAD must not rewrite the slot");
    await assertBlocked();
    // Actually spend both free actions at home through the map. The fixed night
    // scene must still run; no runNightPlan call or completion flag is injected.
    for (const slot of [0, 1]) {
      await pin("rest"); await press('[data-test="map-go"]');
      if (slot === 0) {
        await page.waitForFunction(() => {
          const map = document.querySelector("#screen .map:not(.done)");
          return map && map.dataset.night === "true";
        });
        before = await progress();
        assert.equal(before.slot, 1);
        await assertBlocked();
      }
    }
    const stateHandle = await page.evaluateHandle(async () => (await import("./js/core/state.js")).state);
    // Observe the real fixed scene before its completion and overnight transition.
    await page.locator('.mo[data-motion="sketch"]').waitFor();
    await page.waitForFunction(state => state.flags._ev_tsumugi_sketch
      && state.flags._tsumugi_contest_submitted, stateHandle);
    await page.waitForFunction(state => state.day === 12 && state.slot === 0
      && !!document.querySelector("#screen .map:not(.done)"), stateHandle);
    await stateHandle.dispose();
    const finished = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      return { sketch: state.flags._ev_tsumugi_sketch, submitted: state.flags._tsumugi_contest_submitted };
    });
    assert(finished.sketch && finished.submitted, "DAY11 fixed submission must actually finish");
    await pin("tonari");
    assert.equal(await page.locator(".mi-no").count(), 0, "completed event must not permanently suppress visits");
    assert(await page.locator('[data-test="map-go"]').isEnabled());
  }, options);

  await check("touch-portrait-rotation", async page => {
    assert(await page.locator("#rotate-hint").isVisible());
    const before = await storageSnapshot(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator("#rotate-hint").waitFor({ state: "hidden" });
    await assertFits(page, ".title-item");
    assert.deepEqual(await storageSnapshot(page), before);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
