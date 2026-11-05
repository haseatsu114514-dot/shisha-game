// デバッグ用の道具（remake/js/dev/）: ?debug=1 で出る・?debug=0 で消える・何倍速・シーシャ作りの自動・便利ボタン。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = id => `[data-test="${id}"]`;
const openPanel = async page => {
  await page.locator(t("debug-toggle")).click();
  await page.locator(t("debug-panel")).waitFor();
};

await suite("debug-tools", async check => {
  for (const touch of [false, true]) {
    await check(`portrait-style-shares-config-without-changing-progress-${touch ? "touch" : "desktop"}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const { play, clearLog } = await import("./js/vn/engine.js");
        const { markIntroSeen } = await import("./js/vn/intro.js");
        core.newGame(); core.save(); core.saveToSlot(core.SAVE_SLOTS[1].key);
        core.config.textSpeed = 4;
        for (const id of ["minto", "kuyuri"]) markIntroSeen(id);
        clearLog();
        void play({ dialogue_id: "debug-portrait-style-fixture", lines: [
          { speaker: "minto", face: "normal", text: "画風を比べます" },
          { speaker: "kuyuri", face: "normal", text: "進行は変えません" },
        ] });
      });
      await page.locator(".vn-next.show").waitFor();
      const snapshot = () => page.evaluate(async () => {
        const { state } = await import("./js/core/state.js");
        const { backlog } = await import("./js/vn/engine.js");
        const storage = Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== "suien_remake_config"));
        return { state: JSON.stringify(state), storage, log: JSON.stringify(backlog()),
          text: document.querySelector(".vn-text").innerHTML,
          people: [...document.querySelectorAll(".vn-portraits img")].map(i => [i.dataset.speaker, i.dataset.face, i.dataset.pos, i.classList.contains("active")]) };
      });
      const before = await snapshot();
      await openPanel(page);
      const select = page.locator(t("debug-portrait-style"));
      assert.deepEqual(await select.locator("option").evaluateAll(options => options.map(option => option.value)), ["new", "classic"]);
      for (const style of ["classic", "new", "classic", "new"]) {
        await select.selectOption(style);
        await page.waitForFunction(() => [...document.querySelectorAll(".vn-portraits img")].every(i => i.complete && i.naturalWidth > 0));
        const actual = await page.locator('.vn-portraits img[data-speaker="minto"]').getAttribute("src");
        if (style === "classic") assert.match(actual, /sprites\/characters\/minto\//);
        else assert.match(actual, new RegExp(`character_variants/${style}/minto/`));
        assert.deepEqual(await snapshot(), before, "DBG changes only the shared device setting");
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config")).portraitStyle), style);
      }
      await page.locator(t("debug-toggle")).click();
      await page.locator(t("vn-config")).click();
      assert.equal(await page.locator(t("cfg-portrait-style")).inputValue(), "new");
      await page.locator(t("cfg-portrait-style")).selectOption("classic");
      await page.locator(t("cfg-close")).click();
      await openPanel(page);
      assert.equal(await select.inputValue(), "classic", "DBG syncs changes from normal CONFIG");
      await select.selectOption("classic");
      await page.locator(t("debug-toggle")).click();
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "進行は変えません");
      await page.waitForFunction(() => [...document.querySelectorAll(".vn-portraits img")].every(i => i.complete && i.naturalWidth > 0));
      const fallbackBefore = await snapshot();
      const oldSrc = await page.locator('.vn-portraits img[data-speaker="kuyuri"]').getAttribute("src");
      await openPanel(page);
      await select.selectOption("new");
      assert.equal(await page.locator('.vn-portraits img[data-speaker="kuyuri"]').getAttribute("src"), oldSrc, "Unregistered art keeps the classic portrait");
      assert.deepEqual(await snapshot(), fallbackBefore);
      const bounds = await select.boundingBox();
      const panel = await page.locator(t("debug-panel")).boundingBox();
      assert(bounds && panel && bounds.x >= panel.x && bounds.x + bounds.width <= panel.x + panel.width);
      const storageBeforeReload = (await snapshot()).storage;
      await page.reload({ waitUntil: "load" });
      await page.locator(t("title-new")).waitFor();
      await openPanel(page);
      assert.equal(await select.inputValue(), "new", "Selection survives reload");
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key !== "suien_remake_config"))), storageBeforeReload);
    }, { viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: touch });
  }

  await check("shown-with-debug-1-and-gone-with-debug-0", async page => {
    await page.locator(t("debug-toggle")).waitFor();
    await openPanel(page);
    for (const id of ["debug-speed-1", "debug-speed-8", "debug-craft-manual", "debug-craft-good", "debug-craft-bad", "debug-stamina", "debug-money"]) {
      assert.equal(await page.locator(t(id)).count(), 1, id);
    }
    // 端末に覚える（?debug を付けずに開き直しても出る）
    await page.goto(baseURL, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.locator(t("debug-toggle")).waitFor();
    // ?debug=0 で消える（以後、付けなくても出ない）
    await page.goto(`${baseURL}?debug=0`, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.goto(baseURL, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    assert.equal(await page.locator(t("debug-toggle")).count(), 0);
  });

  await check("speed-runs-timers-and-animations-faster-and-is-remembered", async page => {
    await openPanel(page);
    await page.locator(t("debug-speed-4")).click();
    const started = Date.now();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    const elapsed = Date.now() - started;
    assert(elapsed < 1100, `×4 なら 2000ms の待ちは 500ms ほど（実際 ${elapsed}ms）`);
    const animation = await page.evaluate(async () => {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;left:0;top:0;width:10px;height:10px";
      document.body.append(box);
      box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
      await new Promise(resolve => setTimeout(resolve, 400)); // 本物で 100ms
      return box.getAnimations()[0]?.playbackRate;
    });
    assert.equal(animation, 4);
    await page.reload({ waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("debug-toggle")).getAttribute("data-speed"), "4");
    await openPanel(page);
    await page.locator(t("debug-speed-1")).click();
    const normal = Date.now();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 600)));
    assert(Date.now() - normal >= 550, "×1 に戻すと元の速さ");
  });

  await check("shisha-making-runs-by-itself-and-shortcuts-work", async page => {
    await openPanel(page);
    await page.locator(t("debug-craft-good")).click();
    assert.equal(await page.evaluate(() => window.__remake.craftTest.auto), "good");
    await page.reload({ waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__remake.craftTest.auto), "good", "設定を覚える");
    await openPanel(page);
    await page.locator(t("debug-speed-8")).click();
    // 練習のドリルが、操作なしで最後まで進む
    const done = await page.evaluate(async () => {
      await Promise.race([window.__remake.dev.drill("heat"), new Promise((_, reject) => setTimeout(() => reject(new Error("drill timeout")), 240000))]);
      return true;
    });
    assert.equal(done, true);
    // 便利ボタン
    const before = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", day: 3, slot: 0, stamina: 5, money: 1000 });
      return { stamina: s.stamina, money: s.money };
    });
    await page.locator(t("debug-stamina")).click();
    await page.locator(t("debug-money")).click();
    const after = await page.evaluate(async () => {
      const stats = await import("./js/core/stats.js"), core = await import("./js/core/state.js");
      return { stamina: core.state.stamina, max: stats.maxStamina(), money: core.state.money };
    });
    assert.equal(before.stamina, 5);
    assert.equal(after.stamina, after.max);
    assert.equal(after.money, before.money + 100000);
    await page.locator(t("debug-craft-manual")).click();
    assert.equal(await page.evaluate(() => window.__remake.craftTest.auto), null);
    await page.locator(t("debug-speed-1")).click();
  });

  await check("date-and-chapter-jumps-save-resumable-state", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      s.phase = "daily"; s.day = 3; s.slot = 0;
      core.save();
    });
    await openPanel(page);
    await Promise.all([page.waitForNavigation(), page.locator(t("debug-night")).click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.slot === 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")).day), 3);
    await page.locator(t("debug-toggle")).click();
    await Promise.all([page.waitForNavigation(), page.locator(t("debug-next-day")).click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.day === 4);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")).slot), 0);
    await page.locator(t("debug-toggle")).click();
    await page.locator(t("debug-chapter-select")).selectOption("3");
    await Promise.all([page.waitForNavigation(), page.locator(t("debug-chapter-go")).click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.chapter === 3);
    const checkpoint = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("suien_remake_save"));
      return { phase: s.phase, prep: s.flags._ch3_prep, intro: s.flags._ch3_intro };
    });
    assert.equal(checkpoint.phase, "opening");
    assert.equal(checkpoint.prep.step, 0);
    assert.equal(checkpoint.intro.stage, 0);
  });

  await check("every-chapter-head-has-a-save-checkpoint", async page => {
    for (const chapter of [1, 2, 4, 5]) {
      await openPanel(page);
      await page.locator(t("debug-chapter-select")).selectOption(String(chapter));
      await Promise.all([page.waitForNavigation(), page.locator(t("debug-chapter-go")).click()]);
      await page.locator("#boot").waitFor({ state: "detached" });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
      assert.equal(saved.chapter, chapter);
      assert.equal(saved.phase, "opening");
      if (chapter === 1) assert.equal(saved.flags._ch1_opening.introDone, false);
      if (chapter === 2) assert.equal(saved.flags._ch2_day1.stage, "departure");
      if (chapter === 4) assert.equal(saved.flags._ch4.part, "prologue");
      if (chapter === 5) assert.equal(saved.flags._ch5.part, "prologue");
    }
  });

  await check("relationship-and-save-json-import", async page => {
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.newGame(); core.save(); });
    await openPanel(page);
    await page.locator(t("debug-character")).selectOption("minto");
    await page.locator(t("debug-hearts")).selectOption("3");
    await page.locator(t("debug-lover")).check();
    await page.locator(t("debug-love-points")).fill("40");
    await page.locator(t("debug-relationship-set")).click();
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert(current.lovers.includes("minto"));
    assert.equal(current.loveLevel.minto, 3);
    assert.equal(current.lovePts.minto, 40);
    assert.equal(current.loverSince.minto, current.day);
    const downloadPromise = page.waitForEvent("download");
    await page.locator(t("debug-save-export")).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /suien-save-ch1-day1\.json/);
    await page.locator(t("debug-save-file")).setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"schema":999}') });
    await page.locator(t("debug-save-import")).click();
    await page.locator(t("debug-message")).filter({ hasText: "形式が正しくありません" }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), JSON.stringify(current));
    current.money = 12345;
    await page.locator(t("debug-save-file")).setInputFiles({ name: "good.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(current)) });
    await Promise.all([page.waitForNavigation(), page.locator(t("debug-save-import")).click()]);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.money === 12345);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(t("debug-toggle")).click();
    const bounds = await page.locator(t("debug-panel")).boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  });

  await check("import-validates-migrated-chapter-before-replacing-save", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); core.state.money = 54321; core.save();
      window.__debugImportOriginal = core.state;
    });
    await openPanel(page);
    const before = await page.evaluate(() => localStorage.getItem("suien_remake_save"));
    for (const schema of [25, 26]) for (const chapter of [4, 5]) {
      const bad = { schema, chapter, day: 50, slot: 0, phase: "daily", flags: {} };
      await page.locator(t("debug-save-file")).setInputFiles({ name: "bad-progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bad)) });
      await page.locator(t("debug-save-import")).click();
      await page.locator(t("debug-message")).filter({ hasText: "セーブの検証または保存に失敗しました" }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), before);
      assert(await page.evaluate(async () => (await import("./js/core/state.js")).state === window.__debugImportOriginal), "invalid import keeps live state identity");
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_debug_import_candidate")), null);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("suien_remake_boot_load")), null);
    }
    // Genuine old saves pass through migration and the same chapter progress validators.
    for (const chapter of [4, 5]) {
      await page.locator(t("debug-chapter-select")).selectOption(String(chapter));
      await Promise.all([page.waitForNavigation(), page.locator(t("debug-chapter-go")).click()]);
      await page.locator("#boot").waitFor({ state: "detached" });
      const old = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
      old.schema = 25; old.money = 12000 + chapter;
      await openPanel(page);
      await page.locator(t("debug-save-file")).setInputFiles({ name: "old-valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
      await Promise.all([page.waitForNavigation(), page.locator(t("debug-save-import")).click()]);
      await page.locator("#boot").waitFor({ state: "detached" });
      await page.waitForFunction(amount => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.money === amount, 12000 + chapter);
      const migrated = await page.evaluate(async chapter => {
        const core = await import("./js/core/state.js");
        const saved = JSON.parse(localStorage.getItem("suien_remake_save"));
        const progress = chapter === 4 ? (await import("./js/chapters/ch4-progress.js")).chapterFourProgress(saved) : (await import("./js/chapters/ch5-progress.js")).chapterFiveProgress(saved);
        return { schema: saved.schema, currentSchema: core.SCHEMA, part: progress.part };
      }, chapter);
      assert.equal(migrated.schema, migrated.currentSchema);
      assert.equal(migrated.part, "prologue");
      if (chapter === 4) await openPanel(page);
    }
  });

  await check("old-chapter-two-without-day-one-checkpoint-keeps-compatibility", async page => {
    const old = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const data = core.newState();
      Object.assign(data, { schema: 25, chapter: 2, day: 15, phase: "opening", slot: 0, money: 16666 });
      data.flags = {};
      return data;
    });
    await openPanel(page);
    await page.locator(t("debug-save-file")).setInputFiles({ name: "old-ch2.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) });
    await Promise.all([page.waitForNavigation(), page.locator(t("debug-save-import")).click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.chapter, 2);
    assert.equal(saved.schema, 26);
    assert.equal(saved.money, 16666);
    assert.equal(saved.flags._ch2_day1.startDay, 15);
    assert.equal(saved.flags._ch2_day1.stage, "departure");
  });
}, { entry: `${baseURL}?debug=1` });

