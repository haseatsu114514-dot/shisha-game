// 実画面で、連続回復/消耗/容量変更/ロード、通知経由LIME、実バイトのSKIP、登場時BGMと腹話術を確認。
import assert from "node:assert/strict";
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
  await page.evaluate(() => { T.core.state.stats.guts = 20; T.stats.gainStat("guts", 1); });
  value = await levels(); assert.equal(value.hud, "27%"); assert.equal(value.cards, 0);
  await page.evaluate(() => { T.core.save(); T.core.newGame(); });
  assert.equal((await levels()).cards, 0, "New game kept the old recovery notice");
  await page.evaluate(() => T.core.load());
  assert.equal((await levels()).hud, "27%", "Loaded HUD did not match the loaded state");
  await page.evaluate(() => T.ui.bannersIdle());
  await page.evaluate(() => {
    T.core.state.stats.guts = 10; T.core.state.stamina = 10;
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
