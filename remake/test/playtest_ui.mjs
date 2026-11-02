// 実画面で、連続回復/消耗/容量変更/ロード、通知経由LIME、実バイトのSKIP、登場時BGMと腹話術を確認。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), stats = await import("./js/core/stats.js");
    const ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js"), map = await import("./js/daily/map.js");
    const phone = await import("./js/daily/phone.js"), vn = await import("./js/vn/engine.js");
    const audio = await import("./js/core/audio.js"), tonari = await import("./js/daily/tonari.js"), { DB } = await import("./js/core/data.js");
    window.T = { core, stats, ui, hud, map, phone, vn, audio, tonari, DB };
    core.newGame(); core.state.phase = "daily"; hud.initHud({}); hud.showHud();
    audio.unlockAudio(); await ui.warmUiArt();
  });
  const levels = () => page.evaluate(() => ({
    hud: document.querySelector(".hud-bar b").style.width,
    hudHealth: document.querySelector(".hud-stamina").dataset.health,
    cards: document.querySelectorAll(".gain-card.stamina").length,
  }));
  await page.evaluate(() => { T.core.state.stamina = 30; T.stats.addStamina(40); });
  await page.waitForTimeout(350);
  let value = await levels(); assert.equal(value.hud, "70%"); assert.equal(value.cards, 0);
  await page.evaluate(() => { T.stats.addStamina(-60); T.stats.addStamina(20); });
  value = await levels(); assert.equal(value.hud, "30%"); assert.equal(value.cards, 0);
  assert.equal(value.cards, 0); assert.equal(value.hudHealth, "yellow");
  // 最大体力が伸びるとゲージの割合が下がる。旧しくみ（?growth=0）は根性の段、心得の盤（通常プレイの既定・SBD97）は体力のマス
  const board = await page.evaluate(async () => (await import("./js/core/growth-mode.js")).growthEnabled());
  await page.evaluate(async (board) => {
    if (!board) { T.core.state.stats.guts = 20; T.stats.gainStat("guts", 1); return; }
    const g = (await import("./js/core/growth.js")).ensureGrowth(); g.nodes.push("B1"); // 最大体力 ＋4（100→104）
    (await import("./js/core/bus.js")).emit("hud");
  }, board);
  const grownHud = board ? "29%" : "27%";
  value = await levels(); assert.equal(value.hud, grownHud); assert.equal(value.cards, 0);
  await page.evaluate(() => { T.core.save(); T.core.newGame(); });
  assert.equal((await levels()).cards, 0, "New game kept the old recovery notice");
  await page.evaluate(() => T.core.load());
  assert.equal((await levels()).hud, grownHud, "Loaded HUD did not match the loaded state");
  await page.evaluate(() => T.ui.bannersIdle());
  await page.evaluate(() => {
    T.core.state.stats.guts = 10; T.core.state.stamina = 10;
    if (T.core.state.growth) T.core.state.growth.nodes = []; // 盤の体力のマスも外して最大体力100に戻す
    for (let i = 0; i < 3; i++) T.ui.banner(`通知 ${i}`);
    T.stats.addStamina(50); T.stats.addStamina(-40);
  });
  await page.waitForTimeout(350);
  value = await levels(); assert.equal(value.hud, "20%"); assert.equal(value.cards, 0);
  assert.equal(value.hudHealth, "red", "HUD used an old condition after queued notices");
  await page.evaluate(() => T.ui.bannersIdle());
  console.log("[playtest UI] PASS: HUD stays aligned without recovery notices through drain, capacity change, queue and save reload");

  await page.evaluate(() => {
    T.core.state.day = 2; T.core.state.slot = 0;
    T.core.state.contacts = ["tsumugi"]; T.core.state.met.tsumugi = true;
    T.core.state.inbox = [{ id: "probe", day: 2, read: false, done: false, log: [],
      msg: { id: "probe", sender: "tsumugi", type: "chat", messages: ["おはよう"] } }];
    delete T.core.state.flags._lime_tut;
    T.map.chooseSpot(); T.phone.limeCoach(() => {});
    T.phone.pushNotice(1, { onOpen: (sender) => { T.lime = T.phone.openLime({ sender }); } });
  });
  assert.equal(await page.locator(".lime-coach").count(), 1);
  await page.locator('[data-test="lime-notice"]').click();
  assert.equal(await page.locator(".lime-coach").count(), 0, "Notification opening kept the tutorial overlay");
  await page.locator('[data-test="phone-next"]').click(); await page.locator('[data-test="phone-close"]').click();
  await page.evaluate(() => T.lime);
  assert.equal(await page.locator(".lime-coach, .lime-tip").count(), 0);
  console.log("[playtest UI] PASS: top notification opens LIME and removes the guide before and after closing");

  // #2447: production reward cards and the first-LIME coach at desktop / touch widths.
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      hasTouch: touch, isMobile: touch });
    const probe = await context.newPage();
    try {
      await probe.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
      await probe.locator('[data-test="title-new"]').waitFor();
      await probe.locator("#boot").waitFor({ state: "detached" });
      await probe.evaluate(async () => {
        const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), phone = await import("./js/daily/phone.js");
        const hud = await import("./js/daily/hud.js");
        (await import("./js/core/ui-theme.js")).applyUiTheme("paper");
        core.newGame(); Object.assign(core.state, { phase: "daily", day: 5, slot: 0 });
        core.state.met.tsumugi = true; core.state.contacts = ["tsumugi"];
        core.state.inbox = [{ id: "ui2447", day: 5, read: false, done: false, log: [],
          msg: { id: "ui2447", sender: "tsumugi", type: "chat", messages: ["おはよう"] } }];
        ui.showScreen("map", document.createElement("div"));
        hud.initHud({}); hud.showHud();
        window.P = { core, ui, phone, opens: 0, resources: JSON.stringify([core.state.day, core.state.slot, core.state.money, core.state.stamina]) };
        phone.limeCoach(() => { P.opens++; P.closed = phone.openLime(); });
        for (const bond of [false, true]) ui.gainCard({ kind: "affinity", bond, badge: "つ", top: bond ? "BOND" : "AFFINITY",
          main: "つむぎ", sub: "心の距離が少し近づいた" });
      });
      await probe.locator(".gain-card.affinity").first().waitFor();
      await probe.waitForTimeout(500); // production entrance animation
      const cards = await probe.locator(".gain-card.affinity").evaluateAll(nodes => {
        const luminance = css => {
          const rgb = css.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const s = n / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        return nodes.map(node => {
          const bg = luminance(getComputedStyle(node).backgroundColor);
          return [...node.querySelectorAll(".gc-main, .gc-top, .gc-sub")].map(text => {
            const fg = luminance(getComputedStyle(text).color);
            return { text: text.textContent, contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
          });
        });
      });
      assert.equal(cards.length, 2);
      for (const row of cards.flat()) assert(row.contrast >= 4.5, `paper affinity contrast: ${JSON.stringify(row)}`);
      const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
      fs.mkdirSync(shots, { recursive: true });
      await probe.screenshot({ path: `${shots}/2447-affinity-${touch ? "touch" : "desktop"}.png` });
      await probe.evaluate(() => P.ui.bannersIdle());
      await probe.screenshot({ path: `${shots}/2447-lime-coach-${touch ? "touch" : "desktop"}.png` });
      const geometry = await probe.evaluate(() => {
        const bubble = document.querySelector(".lc-bubble").getBoundingClientRect(), icon = document.querySelector(".hud-lime").getBoundingClientRect();
        return { clear: bubble.top >= icon.bottom + 1, fits: bubble.left >= 0 && bubble.right <= innerWidth && bubble.bottom <= innerHeight };
      });
      assert(geometry.clear && geometry.fits, `coach covers icon or viewport: ${JSON.stringify(geometry)}`);
      const bubble = probe.getByRole("button", { name: "案内からLIMEを開く" });
      if (touch) await bubble.tap(); else { await bubble.focus(); await probe.keyboard.press("Enter"); }
      await probe.locator('[data-test="phone-close"]').waitFor();
      assert.equal(await probe.locator(".lime-coach").count(), 0);
      await probe.locator('[data-test="phone-close"]').click();
      await probe.evaluate(() => P.closed);
      assert.equal(await probe.evaluate(() => P.opens), 1);
      assert.equal(await probe.evaluate(() => JSON.stringify([P.core.state.day, P.core.state.slot, P.core.state.money, P.core.state.stamina]) === P.resources), true);
      // Existing highlighted-icon route still opens; a retained old-owner handler cannot open another save.
      await probe.evaluate(() => { delete P.core.state.flags._lime_tut; P.phone.limeCoach(() => P.opens++); });
      await probe.getByRole("button", { name: "LIMEを開く", exact: true }).click();
      assert.equal(await probe.evaluate(() => P.opens), 2);
      assert.equal(await probe.locator(".lime-coach").count(), 0);
      await probe.evaluate(() => {
        delete P.core.state.flags._lime_tut; P.phone.limeCoach(() => P.opens++);
        const old = document.querySelector(".lc-bubble"); P.core.newGame(); old.click(); old.click();
      });
      assert.equal(await probe.evaluate(() => P.opens), 2, "old owner's coach reopened LIME");
      console.log(`[playtest UI] PASS: #2447 affinity contrast and coach keyboard/tap/close/reopen/owner (${touch ? "touch" : "desktop"})`);
    } finally { await context.close(); }
  }

  await page.evaluate(() => {
    T.core.newGame(); Object.assign(T.core.state, { phase: "daily", day: 4, stamina: 70 });
    Object.assign(T.core.state.flags, { _intro_sumi: true, _intro_customer: true, _ev_rei_cameo: true, _ev_reviewer_cameo: true, _ev_maezono_cameo: true });
    T.DB.baito = [{ id: "skip_probe", category: "beginner", text: "注文が入った", choices: [
      { text: "好みを聞く", result: "話しながら一台を仕上げた", stats: { technique: 1 } },
      { text: "お任せで作る", result: "落ち着いて一台を仕上げた", stats: { technique: 1 } },
    ] }];
    T.shiftDone = false; T.shift = T.tonari.doBaito().then(() => { T.shiftDone = true; });
  });
  await page.waitForSelector("#vn.active .vn-text");
  await page.locator('[data-test="vn-skip"]').click();
  await page.waitForSelector(".vn-choices.show .vn-choice", { timeout: 5000 });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".vn-choices.show .vn-choice").count(), 2, "SKIP chose a response without the player");
  await page.locator(".vn-choice").first().click();
  await page.locator('[data-test="shift-order-0"]').click({ timeout: 10000 });
  await page.locator('[data-test="after-none"]').click({ timeout: 30000 });
  await page.waitForFunction(() => T.shiftDone, { timeout: 5000 });
  assert.equal(await page.locator('[data-test="vn-skip"].on').count(), 0, "SKIP carried into the next action");
  console.log("[playtest UI] PASS: actual baito carries SKIP through its scenes, pauses for choices and clears at shift end");

  await page.evaluate(() => {
    T.core.newGame(); T.core.state.phase = "daily";
    T.core.state.met.sumi = true;
    T.introDone = false;
    T.intro = T.vn.play({ dialogue_id: "skip_intro_probe", lines: [
      { speaker: "", text: "紹介を待つ" }, { speaker: "sumi", text: "ようこそ" },
    ] }).then(() => { T.introDone = true; });
  });
  await page.waitForSelector("#vn.active .vn-text");
  await page.locator('[data-test="vn-skip"]').click();
  await page.waitForSelector('.cutin[data-char="sumi"]');
  await page.locator(".cutin").click(); await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.cutin[data-char="sumi"]:not(.out)').count(), 1, "Active SKIP shortened the intro");
  assert.equal(await page.evaluate(() => T.introDone), false);
  await page.waitForFunction(() => T.introDone, { timeout: 5000 });
  console.log("[playtest UI] PASS: already-active SKIP, click and Enter cannot shorten the introduction");

  const shark = await page.evaluate(async () => {
    T.core.newGame(); T.core.state.phase = "daily";
    const history = []; T.audio.playBgm("tonari"); T.vn.vnTest.turbo = true;
    T.vn.hooks.onLine = (_, line) => queueMicrotask(() => history.push({ speaker: line.speaker || "", text: line.text,
      voice: line.voice || "", bgm: T.audio.currentBgm(), name: document.querySelector(".vn-name").textContent }));
    await T.vn.play("samechan_first_encounter");
    T.vn.hooks.onLine = null; T.vn.vnTest.turbo = false;
    return { history, after: T.audio.currentBgm(), contact: T.core.state.flags._lime_contact_samechan };
  });
  const appearance = shark.history.findIndex((l) => l.speaker === "samechan");
  assert(shark.history.slice(0, appearance).every((l) => l.bgm === "tonari"), `Theme before arrival: ${JSON.stringify(shark.history.slice(0, appearance))}`);
  assert.equal(shark.history[appearance].bgm, "sweets_or_sweets");
  assert(shark.history.filter((l) => l.voice === "korochan").every((l) => l.name === "コロちゃん"));
  assert(shark.history.some((l) => l.speaker === "samechan" && l.name === "サメちゃん"));
  assert.equal(shark.after, "tonari"); assert(shark.contact);
  assert.deepEqual(errors, []);
  console.log("[playtest UI] PASS: theme starts on visible arrival and restores, puppet and girl have distinct names, exchanged nickname appears");
} finally { await browser.close(); }
