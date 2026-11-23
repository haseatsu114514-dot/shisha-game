// デバッグ用の道具（remake/js/dev/）: ?debug=1 で出る・?debug=0 で消える・タイトルの版の表示を5回押して出し入れ・何倍速・シーシャ作りの自動・便利ボタン。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = id => `[data-test="${id}"]`;
const openPanel = async page => {
  await page.locator(t("debug-toggle")).click();
  await page.locator(t("debug-panel")).waitFor();
};

await suite("debug-tools", async check => {
  await check("minigames-start-directly-without-writing-normal-save", async page => {
    const games = [
      ["axe", "axe-game"], ["camel", "camel-game"], ["desert", "desert-ride"],
      ["dj-1", "dj-frame"], ["dj-2", "dj-frame"], ["dj-3", "dj-frame"],
      ["tetsuko", "tetsuko-cat"], ["trpg", "trpg-play-ordinary-cup"], ["ichidai", "ichi-game"], ["floor", "tonari-floor-intro"],
    ];
    await page.evaluate(() => localStorage.setItem("suien_remake_save", '{"debugSentinel":true}'));
    for (const [id, screen] of games) {
      await openPanel(page);
      await page.locator(t(`debug-minigame-${id}`)).click();
      await page.locator(t(screen)).waitFor({ timeout: 30000 });
      const close = page.locator(t("debug-minigame-close"));
      assert.equal(await close.isVisible(), false, `${id}: no return button is overlaid on the game`);
      assert.equal(await close.evaluate(node => node.parentElement.dataset.test), "debug-panel");
      assert.match(await page.locator(t("debug-toggle")).innerText(), /終了/, "the visible toggle tells how to exit");
      if (id === "trpg") {
        assert.ok(await page.locator(t(screen)).isEnabled(), "night debug has an actual playable story");
        await page.locator(t(screen)).click();
        await page.locator(t("trpg-skip")).click(); // 初回の店長の説明は残し、ここでは表紙へ進める
        await page.locator(t("trpg-start")).waitFor({ timeout: 30000 });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), '{"debugSentinel":true}', id);
      await page.locator(t("debug-toggle")).focus();
      await page.keyboard.press("Enter");
      await page.locator(t("debug-panel")).waitFor();
      await close.focus();
      await page.keyboard.press("Enter");
      await page.locator(t("title-new")).waitFor({ timeout: 30000 });
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), '{"debugSentinel":true}', `${id} close`);
      assert.equal(await page.locator(t("debug-toggle")).innerText(), "DBG");
      assert.equal(await page.locator(t("debug-panel")).isVisible(), false);
    }
  });

  await check("minigame-return-panel-on-touch", async page => {
    await openPanel(page);
    await page.locator(t("debug-minigame-ichidai")).tap();
    await page.locator(t("ichi-game")).waitFor();
    assert.equal(await page.locator(t("debug-minigame-close")).isVisible(), false);
    await page.locator(t("debug-toggle")).tap();
    await page.locator(t("debug-minigame-close")).tap();
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("debug-toggle")).innerText(), "DBG");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  // tonari フロア営業: デバッグの試遊は本編の状態に触れず、最後まで回すと元の画面へ戻る。休止の窓に本編メニューは出さない。
  await check("floor-minigame-plays-through-without-save", async page => {
    await page.evaluate(() => localStorage.setItem("suien_remake_save", '{"debugSentinel":true}'));
    await openPanel(page);
    assert.deepEqual(await page.locator('[data-test^="debug-minigame-floor"]').allInnerTexts(),
      ["フロア営業（はじめて）", "フロア営業（いつもの夜）", "フロア営業（満席の日）"]);
    // 実時間では進めず、検査の側から刻みを送る
    await page.evaluate(async () => { const view = await import("./js/daily/tonari-floor-view.js"); view.floorTest.manual = true; window.floorView = view; });
    await page.locator(t("debug-minigame-floor-full")).click();
    await page.locator(t("tonari-floor-intro")).waitFor({ timeout: 30000 });
    assert.match(await page.locator(t("tonari-floor-intro")).innerText(), /満席の日/);
    assert.equal(await page.locator(t("tonari-floor-screen")).evaluate(node => node.parentElement.dataset.test), "debug-minigame-host");
    assert.equal(await page.evaluate(() => document.body.dataset.screen), "title", "本編の画面は差し替えない");
    await page.locator(t("tonari-floor-option-start")).click();
    await page.locator(t("tonari-floor-pause")).click();
    assert.deepEqual(await page.locator(`${t("tonari-floor-pause-panel")} .tf-option b`).allInnerTexts(), ["つづける", "ゆっくりにする", "早じまいにする"]);
    await page.locator(t("tonari-floor-option-resume")).click();
    const result = await page.evaluate(async () => {
      const [bot, model] = await Promise.all([import("./test/tonari_floor_bot.mjs"), import("./js/daily/tonari-floor-model.js")]);
      const api = window.floorView.floorTest.api;
      for (let i = 0; i < 3000 && !api.state().done; i++) {
        const action = api.mode() === "live" ? bot.floorBotAction(api.state(), {}) : null;
        if (action) api.act(action);
        if (api.mode() === "live") api.tick(2);
        if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
      }
      const r = model.floorResult(api.state());
      return { done: api.state().done, night: api.state().night, came: r.came, served: r.served };
    });
    // 客は一人ずつ数える（二人連れは一人ずつ別の卓。TFL51）。閉店が近づくと来なくなるので、来た人数は回し方で少し変わる
    assert.deepEqual([result.done, result.night], [true, "full"]);
    assert.ok(result.came >= 12, `満席の日は大勢来る: ${result.came}`);
    assert.ok(result.served >= 8, `ボットで回しきれる: ${result.served}`);
    await page.locator(t("tonari-floor-result")).waitFor();
    await page.locator(t("tonari-floor-option-continue")).click();
    // 終えると、試遊は自分で閉じて元の画面（タイトル）へ戻る
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('[data-test="debug-minigame-host"]'));
    assert.equal(await page.locator(t("tonari-floor-screen")).count(), 0);
    assert.equal(await page.locator(t("debug-toggle")).innerText(), "DBG");
    assert.equal(await page.evaluate(() => document.body.dataset.screen), "title");
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), '{"debugSentinel":true}', "本編のセーブに触れない");
  });

  await check("normal-minigame-gates-remain-active", async page => {
    await page.goto(`${baseURL}?debug=0`, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("debug-toggle")).count(), 0);
    const gates = await page.evaluate(async () => {
      const [{ newState }, { djSetOpen }, { camelRaceDestination }, { desertOutingStatus }, { knowsTrpgBar }] = await Promise.all([
        import("./js/core/state.js"), import("./js/minigames/dj.js"), import("./js/chapters/ch4-camel-progress.js"),
        import("./js/chapters/ch4-desert-progress.js"), import("./js/core/trpg-discovery.js"),
      ]);
      const fresh = newState();
      return [djSetOpen(fresh, 2), camelRaceDestination(fresh), desertOutingStatus(fresh, fresh.day).ok, knowsTrpgBar(fresh)];
    });
    assert.deepEqual(gates, [false, null, false, false]);
  });

  await check("background-preview-switches-variants-without-saving", async page => {
    await page.locator(t("title-new")).waitFor();
    const before = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      return { state: JSON.stringify(state), storage: JSON.stringify(localStorage) };
    });
    await openPanel(page);
    const select = page.locator(t("debug-background-select"));
    const options = await select.locator("option").evaluateAll(nodes => nodes.map(node => node.value));
    const manifest = await page.evaluate(async () => (await import("./js/core/data.js")).DB.manifest.backgrounds);
    assert.deepEqual(options, manifest);
    for (const name of ["bg_tonari_inside_day.png", "bg_tonari_inside_night.png", "bg_tonari_inside_overcast_day.png"]) {
      await select.selectOption(name);
      await page.locator(t("debug-background-show")).click();
      const image = page.locator(t("debug-background-image"));
      await image.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector('[data-test="debug-background-image"]')?.naturalWidth > 0);
      const expected = await page.evaluate(async selected => (await import("./js/core/data.js")).img(`backgrounds/${selected}`), name);
      assert.equal(await image.getAttribute("src"), expected);
      assert.equal(await image.evaluate(node => node.parentElement.id), "stage");
    }
    await page.locator(t("debug-background-close")).click();
    assert.equal(await page.locator(t("debug-background-image")).isVisible(), false);
    const after = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      return { state: JSON.stringify(state), storage: JSON.stringify(localStorage) };
    });
    assert.deepEqual(after, before);
  });

  for (const touch of [false, true]) {
    await check(`portrait-style-shares-config-without-changing-progress-${touch ? "touch" : "desktop"}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const { play, clearLog } = await import("./js/vn/engine.js");
        const { markIntroSeen } = await import("./js/vn/intro.js");
        core.newGame(); core.save(); core.saveToSlot(core.SAVE_SLOTS[1].key);
        core.config.textSpeed = 4;
        for (const id of ["minto", "rio"]) markIntroSeen(id);
        // 新版が未登録の人物は旧版のまま、を確かめる。凛想は #2714 で新版がそろったので、
        // このページの中だけ新版の登録を外して「未登録」の人物として使う（本物の素材や保存には触れない）。
        const { DB } = await import("./js/core/data.js");
        delete DB.manifest.portraitVariants?.new?.rio;
        clearLog();
        void play({ dialogue_id: "debug-portrait-style-fixture", lines: [
          { speaker: "minto", face: "normal", text: "画風を比べます" },
          { speaker: "rio", face: "normal", text: "進行は変えません" },
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
      assert.equal(await page.locator(`${t("cfg-portrait-style")} [aria-checked="true"]`).getAttribute("value"), "new");
      await page.locator(`${t("cfg-portrait-style")} button[value="classic"]`).click();
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
      const oldSrc = await page.locator('.vn-portraits img[data-speaker="rio"]').getAttribute("src");
      await openPanel(page);
      await select.selectOption("new");
      assert.equal(await page.locator('.vn-portraits img[data-speaker="rio"]').getAttribute("src"), oldSrc, "Unregistered art keeps the classic portrait");
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

  // ホーム画面に追加したiPhoneなど URL を変えられない時（DBG01）: タイトルの版の表示を5回続けて押すと出し入れできる
  await check("version-label-five-taps-toggle-debug-without-url", async page => {
    await page.goto(`${baseURL}?debug=0`, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.goto(baseURL, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("debug-toggle")).count(), 0);
    const ver = page.locator(".title .title-ver");
    // 4回では出ない・間が空くと数え直す
    for (let i = 0; i < 4; i++) await ver.click();
    await page.waitForTimeout(1700);
    await ver.click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator(t("debug-toggle")).count(), 0);
    for (let i = 0; i < 5; i++) await ver.click();
    await page.locator(t("debug-toggle")).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_debug")), "1");
    // 開き直しても出る（端末に覚える）
    await page.goto(baseURL, { waitUntil: "load" });
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.locator(t("debug-toggle")).waitFor();
    // もう一度5回で消える（読み直す）
    await Promise.all([page.waitForNavigation(), (async () => { for (let i = 0; i < 5; i++) await page.locator(".title .title-ver").click(); })()]);
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    assert.equal(await page.locator(t("debug-toggle")).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_debug")), "0");
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
    assert.equal(saved.schema, await page.evaluate(async () => (await import("./js/core/state.js")).SCHEMA)); // 現在の版へ移行される
    assert.equal(saved.money, 16666);
    assert.equal(saved.flags._ch2_day1.startDay, 15);
    assert.equal(saved.flags._ch2_day1.stage, "departure");
  });

  const attachBgmAudio = page => page.evaluate(async () => {
    window.__bgmAudio = await import("./js/core/audio.js");
  });

  const verifyTitleBgmLifecycle = async (page, games) => {
    await attachBgmAudio(page);
    await openPanel(page);
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
      && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));

    for (const [id, screen, expectedBgm] of games) {
      if (await page.locator(t("debug-panel")).isVisible() === false) await openPanel(page);
      await page.locator(t(`debug-minigame-${id}`)).click();
      await page.locator(t(screen)).waitFor({ timeout: 30000 });
      if (screen === "dj-frame") {
        await page.waitForFunction(() => {
          const frame = document.querySelector('[data-test="dj-frame"]');
          return frame?.contentDocument?.readyState === "complete";
        });
      }
      await page.waitForFunction(() => window.__bgmElements
        .filter(a => a.src.endsWith("/title.mp3"))
        .every(a => a.paused && a.volume === 0));
      if (expectedBgm) {
        await page.waitForFunction(k => window.__bgmAudio.currentBgm() === k
          && window.__bgmElements.some(a => a.src.startsWith("blob:") && !a.paused && a.volume > 0), expectedBgm);
      } else {
        assert.equal(await page.evaluate(() => window.__bgmAudio.currentBgm()), null, `${id} starts without title BGM`);
        await page.waitForFunction(() => window.__bgmElements
          .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
      }
      await page.locator(t("debug-toggle")).click();
      await page.locator(t("debug-minigame-close")).click();
      await page.locator(t("title-new")).waitFor({ timeout: 30000 });
      await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
        && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));
      await page.waitForFunction(() => window.__bgmElements
        .filter(a => !a.src.endsWith("/title.mp3"))
        .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
    }
  };

  await check("minigames-stop-title-bgm-and-restore-on-close", page => verifyTitleBgmLifecycle(page, [
    ["axe", "axe-game", "bgm_axe"],
    ["camel", "camel-game", null],
    ["desert", "desert-ride", null],
    ["dj-1", "dj-frame", null],
  ]));

  await check("minigames-stop-title-bgm-and-restore-on-close-part2", page => verifyTitleBgmLifecycle(page, [
    ["ichidai", "ichi-game", null],
    ["trpg", "trpg-play-ordinary-cup", "bgm_trpg"],
    ["tetsuko", "tetsuko-cat", "bgm_tetsuko_time"],
  ]));

  await check("debug-minigame-switch-and-ingame-bgm-restore", async page => {
    await attachBgmAudio(page);
    await openPanel(page);
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
      && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));

    // Switching directly between minigames stops the first minigame BGM and still restores title BGM on close.
    await page.locator(t("debug-minigame-axe")).click();
    await page.locator(t("axe-game")).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "bgm_axe"
      && window.__bgmElements.some(a => a.src.startsWith("blob:") && !a.paused && a.volume > 0));
    await openPanel(page);
    await page.locator(t("debug-minigame-ichidai")).click();
    await page.locator(t("ichi-game")).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__bgmAudio.currentBgm()), null);
    await page.waitForFunction(() => window.__bgmElements
      .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
    await openPanel(page);
    await page.locator(t("debug-minigame-close")).click();
    await page.locator(t("title-new")).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
      && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));

    // Opening from an in-game screen returns to that screen and restores its BGM and duck level.
    await page.evaluate(() => {
      document.body.dataset.screen = "map";
      window.__bgmAudio.playBgm("tonari");
      window.__bgmAudio.duckBgm(0.5, 0);
    });
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "tonari"
      && window.__bgmElements.some(a => a.src.endsWith("/tonari.mp3") && !a.paused && a.volume > 0));
    await openPanel(page);
    await page.locator(t("debug-minigame-ichidai")).click();
    await page.locator(t("ichi-game")).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__bgmAudio.currentBgm()), null);
    await page.waitForFunction(() => window.__bgmElements
      .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
    await openPanel(page);
    await page.locator(t("debug-minigame-close")).click();
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "tonari"
      && window.__bgmElements.some(a => a.src.endsWith("/tonari.mp3") && !a.paused && a.volume > 0));
    assert.equal(await page.evaluate(() => document.body.dataset.screen), "map");
    assert.equal(await page.evaluate(() => window.__bgmAudio.bgmDuckLevel()), 0.5);
  });

  await check("minigames-own-bgm-and-exit-restore-title", async page => {
    await attachBgmAudio(page);
    const waitTitleRestored = async () => {
      await page.locator(t("title-new")).waitFor({ timeout: 30000 });
      await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
        && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));
      await page.waitForFunction(() => window.__bgmElements
        .filter(a => !a.src.endsWith("/title.mp3"))
        .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
      assert.equal(await page.locator(t("debug-toggle")).innerText(), "DBG");
    };
    const waitTitleStopped = () => page.waitForFunction(() => window.__bgmElements
      .filter(a => a.src.endsWith("/title.mp3"))
      .every(a => a.paused && a.volume === 0));

    await openPanel(page);
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "title"
      && window.__bgmElements.some(a => a.src.endsWith("/title.mp3") && !a.paused && a.volume > 0));

    // Camel race: starts bgm_camel_race on race start and restores title when closed via its own button.
    await page.locator(t("debug-minigame-camel")).click();
    await page.locator(t("camel-tutorial-skip")).click();
    await page.locator('[data-test="camel-cup"][data-cup="practice"]').click();
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "bgm_camel_race"
      && window.__bgmElements.some(a => a.src.startsWith("blob:") && !a.paused && a.volume > 0));
    await waitTitleStopped();
    await page.locator(t("camel-close")).click();
    await page.locator(t("camel-pause-quit")).click();
    await waitTitleRestored();

    // DESERT RIDE: starts bgm_ethnic12 in practice and restores title when leaving via its own buttons.
    await openPanel(page);
    await page.locator(t("debug-minigame-desert")).click();
    await page.locator(t("desert-practice")).click();
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "bgm_ethnic12"
      && window.__bgmElements.some(a => a.src.startsWith("blob:") && !a.paused && a.volume > 0));
    await waitTitleStopped();
    await page.locator(t("desert-quit")).click();
    await page.locator(t("desert-quit-confirm")).click();
    await page.locator(t("desert-leave")).click();
    await waitTitleRestored();

    // DJ: starts its own WebAudio deck inside the iframe without title BGM and restores title on #exit.
    await openPanel(page);
    await page.locator(t("debug-minigame-dj-1")).click();
    await page.locator(t("dj-frame")).waitFor({ timeout: 30000 });
    let djFrame = null;
    for (let i = 0; i < 100; i++) {
      djFrame = page.frames().find(f => /previews\/dj\/index\.html/.test(f.url()));
      if (djFrame && await djFrame.locator("#play-a").isVisible().catch(() => false)) break;
      await page.waitForTimeout(50);
    }
    assert.ok(djFrame, "DJ iframe loaded");
    await djFrame.locator("#play-a").click();
    await page.waitForFunction(() => {
      const f = [...document.querySelectorAll("iframe")].find(n => n.dataset.test === "dj-frame");
      return f?.contentWindow;
    });
    for (let i = 0; i < 100; i++) {
      const snap = await djFrame.evaluate(async () => (await import("./app.mjs")).snapshot());
      if (snap.running) break;
      await page.waitForTimeout(50);
    }
    assert.equal((await djFrame.evaluate(async () => (await import("./app.mjs")).snapshot())).running, true);
    await waitTitleStopped();
    await djFrame.locator("#exit").click();
    await page.locator(t("dj-frame")).waitFor({ state: "detached" });
    await waitTitleRestored();

    // Axe, TRPG, and Tetsuko own exit buttons also restore title BGM and DBG toggle state.
    await openPanel(page);
    await page.locator(t("debug-minigame-axe")).click();
    await page.locator(t("axe-cancel")).click();
    await waitTitleRestored();

    await openPanel(page);
    await page.locator(t("debug-minigame-trpg")).click();
    await page.locator(t("trpg-campaign-close")).click();
    await page.locator(t("trpg-tryout-exit")).click();
    await waitTitleRestored();

    await openPanel(page);
    await page.locator(t("debug-minigame-tetsuko")).click();
    await page.locator(t("tetsuko-cat")).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "bgm_tetsuko_time");
    await page.locator(t("tetsuko-time-back")).click();
    await page.locator(t("tetsuko-quit-confirm")).click();
    await waitTitleRestored();

    // Switching directly from tetsuko (which replaced #screen) to ichidai stops bgm_tetsuko_time and restores title on exit.
    await openPanel(page);
    await page.locator(t("debug-minigame-tetsuko")).click();
    await page.locator(t("tetsuko-cat")).waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.__bgmAudio.currentBgm() === "bgm_tetsuko_time");
    await openPanel(page);
    await page.locator(t("debug-minigame-ichidai")).click();
    await page.locator(t("ichi-game")).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__bgmAudio.currentBgm()), null);
    await page.waitForFunction(() => window.__bgmElements
      .every(a => a.paused && (!window.__bgmPlayed.has(a) || a.volume === 0)));
    await page.locator(t("ichi-close")).click();
    await waitTitleRestored();
  });
}, {
  entry: `${baseURL}?debug=1`,
  initScript: () => {
    window.__bgmElements = [];
    window.__bgmPlayed = new WeakSet();
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const a = new NativeAudio(...args);
      window.__bgmElements.push(a);
      return a;
    };
    window.Audio.prototype = NativeAudio.prototype;
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!window.__bgmElements.includes(this)) window.__bgmElements.push(this);
      window.__bgmPlayed.add(this);
      return nativePlay.apply(this, args);
    };
  },
});

