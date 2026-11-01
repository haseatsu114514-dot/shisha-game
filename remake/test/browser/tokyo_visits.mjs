import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";
const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
async function seed(page, { lovers = ["tsumugi", "minto", "rin", "samechan", "hiyori"], schema = null } = {}) {
  await page.evaluate(async ({ lovers, schema }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, phase: "cleared", lovers, contacts: ["sumi", ...lovers], money: 23456, stamina: 65 });
    value.owned.push("home_rig_set");
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
    const progress = await import("./js/chapters/ch3-progress.js");
    if (!progress.advanceToChapterThree(value)) throw new Error("Natural chapter boundary failed");
    // This suite starts inside Tokyo; the separate chapter-entry suite plays the prologue.
    value.flags._ch3_intro.titleSeen = true;
    value.flags._ch3_intro.prologueStep = 4;
    for (const id of [...lovers, "hajime"]) { value.met[id] = true; value.flags[`_intro_${id}`] = true; }
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    (await import("./js/vn/engine.js")).vnTest.turbo = true;
    (await import("./js/vn/engine.js")).vnTest.choose = () => 0;
    if (schema) {
      value.schema = schema; delete value.tokyoVisits;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(value)); core.load();
    }
    core.save();
    const social = await import("./js/chapters/ch3-social.js");
    await social.loadTokyoSocial();
    void social.openTokyoLime();
  }, { lovers, schema });
}
async function open(page) { await page.evaluate(() => { void import("./js/chapters/ch3-social.js").then(module => module.openTokyoLime()); }); }
async function close(page) { await page.locator(t("lime-back")).click(); await page.locator(t("phone-close")).click(); await page.locator(".phone-overlay").waitFor({ state: "detached" }); }
await suite("tokyo-visits", async check => {
  await check("story-call-history-after-completion-and-load", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch3-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 35, slot: 1, phase: "daily", lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
        _ch3_intro: { startDay: 29, stage: 9, titleSeen: true, prologueStep: 4, routeVersion: 2 } };
      value.met.naru = true; value.flags._intro_naru = true;
      for (let window; (window = progress.chapterThreeFreeTime(value));) progress.completeChapterThreeFreeTime(value, window.id);
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig(); core.save();
      const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true;
      vn.hooks.onLine = (id, line) => { if (id === "ch3_naru_contact_before_tournament" && line.text?.includes("今、少し話せますか")) vn.vnTest.turbo = false; };
      void (await import("./js/chapters/ch3.js")).resumeChapterThree();
    });
    const scene = '[data-test="ch3-intro-scene"][data-scene="ch3_naru_contact_before_tournament"]';
    await page.locator(scene).waitFor();
    const before = await get(page);
    await page.locator(t("ch3-intro-continue")).click();
    await page.waitForFunction(() => document.querySelector("#vn.active .vn-text")?.textContent.includes("今、少し話せますか"));
    assert.equal((await get(page)).inbox.length, 0, "An interrupted call has no completed history");
    await page.reload(); await page.locator(t("title-load")).click();
    await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = true; });
    await page.locator(t("slot-0")).click(); await page.locator(scene).waitFor();
    assert.equal((await get(page)).inbox.length, 0);
    await page.locator(t("ch3-intro-continue")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_intro.stage === 10);
    const after = await get(page);
    assert.equal(after.inbox.length, 1);
    assert.deepEqual(after.inbox[0].log, [{ note: "通話：戻ったら会う約束をした" }]);
    for (const key of ["money", "stamina", "stats", "affinity", "flavorStock", "contacts", "lovers"])
      assert.deepEqual(after[key], before[key], `The call history changed ${key}`);
    await page.locator(t("ch3-intro-lime")).click();
    await page.locator(t("lime-contact-naru")).click();
    assert((await page.locator(".lime-chat").textContent()).includes("通話：戻ったら会う約束をした"));
    for (const action of ["chat", "offer", "book", "lover"]) assert.equal(await page.locator(t(`lime-travel-${action}`)).count(), 0);
    await close(page);
    await page.reload(); await page.locator(t("title-load")).click(); await page.locator(t("slot-0")).click();
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_naru_work"]').waitFor();
    assert.equal((await get(page)).inbox.length, 1, "SAVE/LOAD must preserve one call record");
  });
  for (const touch of [false, true]) await check(touch ? "travel-lime-touch" : "travel-lime-pc", async page => {
    // The function deliberately remains pending while its phone is open.
    await seed(page);
    await page.locator(t("lime-contact-tsumugi")).waitFor();
    await assertFits(page, ".phone button");
    await page.locator(t("lime-contact-tsumugi")).click();
    const before = await get(page);
    await page.locator(t("lime-travel-chat")).click();
    await page.locator(t("lime-travel-chat")).click();
    let value = await get(page);
    assert.equal(value.inbox.filter(item => item.id.includes("chat_")).length, 1, "Repeated free chats added messages/rewards");
    for (const key of ["stats", "statXp", "lovePts", "loveLevel", "stamina", "money", "guilt"]) assert.deepEqual(value[key], before[key]);
    await page.locator(t("lime-travel-offer")).click();
    await assertFits(page, ".phone button");
    await page.locator(t("lime-travel-hold")).click();
    assert.equal((await get(page)).tokyoVisits.plans.length, 0);
    await page.locator(t("lime-travel-offer")).click();
    await page.locator(t("lime-travel-book")).click();
    const first = (await get(page)).tokyoVisits.plans[0];
    assert.equal(first.status, "booked"); assert.equal(first.arrivalDay, 33);
    await close(page);
    await open(page);
    await page.locator(t("lime-contact-minto")).click();
    assert.equal(await page.locator(".lime-name").innerText(), "栞", "Private account name was lost");
    await page.locator(t("lime-travel-offer")).click();
    await page.locator(t("lime-travel-book")).click();
    value = await get(page);
    assert(value.tokyoVisits.plans[1].arrivalDay >= first.returnDay);
    assert(value.inbox.some(item => item.msg.sender === "minto" && item.account === "minto_private"));
    await close(page);
    // Real save APIs, then boot/reload through the production title router.
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.saveToSlot("suien_remake_slot2");
      core.state.tokyoVisits.plans.length = 0;
      core.loadFromSlot("suien_remake_slot2"); core.requestResumeOnBoot();
    });
    await page.reload();
    await page.locator(t("ch3-intro-scene")).waitFor();
    value = await get(page);
    assert.equal(value.tokyoVisits.plans.length, 2);
    assert.equal(value.day, 29); assert.equal(value.flags._ch3_intro.stage, 0);
    await assertFits(page, `${t("ch3-intro-scene")} button`);
    await page.evaluate(async () => {
      const { vnTest } = await import("./js/vn/engine.js"); vnTest.turbo = true; vnTest.choose = () => 0;
      const { state } = await import("./js/core/state.js");
      for (const id of ["mashiro", "mukai", "kuze", "steve", "volk", "naru", "pakki"]) {
        state.met[id] = true; state.flags[`_intro_${id}`] = true;
      }
    });
    let meetings = 0, dates = 0, restGain = 0;
    const ordered = await page.evaluate(async () => (await import("./js/chapters/ch3-progress.js")).CH3_INTRO_SCENES.map(scene => scene.id));
    for (const id of ordered) {
      await page.locator(`${t("ch3-intro-scene")}[data-scene="${id}"]`).waitFor();
      await page.locator(t("ch3-intro-continue")).click();
      if (id === "ch3_opening") {
        await page.locator(`${t("ch3-intro-scene")}[data-scene="ch3_registration"]`).waitFor();
        assert.match(await page.locator(t("ch3-intro-scene")).innerText(), /参加登録/);
        await page.locator(t("ch3-intro-continue")).click();
        await page.locator(`${t("rule-sheet")}[data-chapter="3"]`).waitFor();
        await assertFits(page, t("rule-sheet-close"));
        await page.locator(t("rule-sheet-close")).click();
      }
      await page.waitForFunction(() => !!document.querySelector('[data-test="ch3-intro-free"], [data-test="ch3-intro-scene"], [data-test="ch3-intro-ready"]'));
      if (id === "ch3_opening") assert.equal((await get(page)).flags._ch3_rules_read, true);
      while (await page.locator(t("ch3-intro-free")).count()) {
        // 予約のない空き時間（#1655）は休んで進む。休養の回復分だけ体力の比較から除く。
        if (!await page.locator(t("ch3-intro-visit")).count()) {
          const rested = (await get(page)).stamina;
          const card = await page.locator(t("ch3-intro-free")).elementHandle();
          await page.locator(t("ch3-intro-visit-rest")).click();
          await card.waitForElementState("hidden");
          await page.waitForFunction(() => !!document.querySelector('[data-test="ch3-intro-free"], [data-test="ch3-intro-scene"], [data-test="ch3-intro-ready"]'));
          restGain += (await get(page)).stamina - rested;
          continue;
        }
        const current = await get(page);
        const plan = current.tokyoVisits.plans.find(plan => plan.status !== "returned");
        assert(plan);
        if (plan.met) dates++; else meetings++;
        await assertFits(page, `${t("ch3-intro-free")} button`);
        // Before a rendezvous, save and LOAD from the actual chapter MENU and slot picker.
        if (meetings === 1 && dates === 0) {
          await page.locator(t("ch3-intro-menu")).click();
          await page.locator(t("ch3-intro-save")).click();
          await page.locator(t("slot-1")).click();
          await page.locator(t("ch3-intro-menu")).click();
          await page.locator(t("ch3-intro-load")).click();
          await page.locator(t("slot-1")).click();
          await page.locator(t("confirm-load")).click();
          await page.locator(t("ch3-intro-free")).waitFor();
          assert.deepEqual((await get(page)).tokyoVisits, current.tokyoVisits);
          await page.evaluate(async () => {
            const { vnTest } = await import("./js/vn/engine.js"); vnTest.turbo = true; vnTest.choose = () => 0;
          });
        }
        await page.locator(t("ch3-intro-visit")).click();
        await page.waitForFunction(() => !document.querySelector('#vn.active')
          && !!document.querySelector('[data-test="ch3-intro-free"], [data-test="ch3-intro-scene"], [data-test="ch3-intro-ready"]'));
      }
    }
    await page.locator(t("ch3-intro-ready")).waitFor();
    value = await get(page);
    assert.equal(meetings, 2); assert.equal(dates, 2);
    assert(value.tokyoVisits.plans.every(plan => plan.met && plan.dateDone && plan.status === "returned"));
    for (const key of ["stats", "statXp", "lovePts", "loveLevel", "money", "guilt"]) assert.deepEqual(value[key], before[key], key);
    assert.equal(value.stamina, before.stamina + restGain, "Only resting may change stamina");
    await page.locator(t("ch3-intro-lime")).click();
    await page.locator(t("lime-contact-tsumugi")).click();
    assert.match(await page.locator(".lime-chat").innerText(), /帰郷済み/);
    await close(page);
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : {});
  await check("interrupted-rendezvous-and-date", async page => {
    await seed(page, { lovers: ["tsumugi"] });
    await page.locator(t("lime-contact-tsumugi")).click();
    await page.locator(t("lime-travel-offer")).click();
    await page.locator(t("lime-travel-book")).click();
    await close(page);
    // Reach the first rendezvous through production progress functions, without claiming a full New Game run.
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      while (!progress.chapterThreeFreeTime(core.state)) {
        const scene = progress.CH3_INTRO_SCENES[core.state.flags._ch3_intro.stage];
        if (!scene || !progress.completeChapterThreeScene(core.state, scene.id)) throw new Error("Missing visit window");
      }
      core.save(); core.requestResumeOnBoot();
    });
    await page.reload();
    await page.locator(t("ch3-intro-free")).waitFor();
    for (const kind of ["meetup", "date"]) {
      const before = await get(page);
      await page.locator(t("ch3-intro-visit")).click();
      await page.locator("#vn.active .vn-text").waitFor();
      assert.deepEqual((await get(page)).tokyoVisits, before.tokyoVisits, "An unfinished conversation committed a visit action");
      await page.reload();
      await page.locator(t("title-load")).click();
      await page.locator(t("slot-0")).click();
      await page.locator(t("ch3-intro-free")).waitFor();
      assert.deepEqual((await get(page)).tokyoVisits, before.tokyoVisits);
      await page.evaluate(async () => { const {vnTest} = await import("./js/vn/engine.js"); vnTest.turbo = true; });
      await page.locator(t("ch3-intro-visit")).click();
      await page.waitForFunction(kind => window.__remake.state.tokyoVisits.plans[0][kind === "meetup" ? "met" : "dateDone"], kind);
      if (kind === "meetup") {
        await page.evaluate(async () => {
          const core = await import("./js/core/state.js");
          const progress = await import("./js/chapters/ch3-progress.js");
          while (!progress.chapterThreeFreeTime(core.state)) {
            const scene = progress.CH3_INTRO_SCENES[core.state.flags._ch3_intro.stage];
            if (!scene || !progress.completeChapterThreeScene(core.state, scene.id)) throw new Error("Missing date window");
          }
          core.save(); core.requestResumeOnBoot();
        });
        await page.reload();
        await page.locator(t("ch3-intro-free")).waitFor();
      }
    }
    const value = await get(page);
    assert(value.tokyoVisits.plans[0].met && value.tokyoVisits.plans[0].dateDone);
    assert.equal(value.tokyoVisits.closedSlots.length, 2);
  });
  await check("friend-and-legacy-save", async page => {
    await seed(page, { lovers: [], schema: 19 });
    await page.locator(t("phone-close")).waitFor();
    assert.equal(await page.locator(".lime-chat-row").count(), 0);
    const value = await get(page);
    assert.deepEqual(value.tokyoVisits.plans, []);
    assert.equal(value.schema, 24);
    await page.locator(t("phone-close")).click();
  });
});
