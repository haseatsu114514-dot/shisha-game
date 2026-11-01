// #465 / old #340: saved-lover chapter-2 UI fixtures, not full chapter-2 reachability.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page, restore = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async restore => {
    window.K = { core: await import("./js/core/state.js"), ch1: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), phone: await import("./js/daily/phone.js"),
      romance: await import("./js/daily/romance.js"), dates: await import("./js/daily/samechan-date.js"),
      bonds: await import("./js/daily/samechan-bonds.js"),
      calendar: await import("./js/daily/calendar.js"),
      stats: await import("./js/core/stats.js"), data: await import("./js/core/data.js") };
    if (restore) K.core.load();
    else {
      const s = K.core.newGame(); Object.assign(s, { chapter: 2, phase: "daily", day: 4, slot: 0, money: 100000 });
      s.lovers = ["samechan"]; s.loveLevel.samechan = 1; s.lovePts.samechan = 12; s.loverSince.samechan = 17;
      s.loverEventsSeen = ["lover_samechan_lv1"]; s.met.samechan = true; s.contacts.push("samechan");
      s.limeRead.push("_lover_private_account_samechan", "lime_samechan_opening");
      Object.assign(s.flags, { _intro_samechan: true, _samechan_nickname_known: true, _lime_tut: true,
        _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true, _morning_4: true });
    }
    K.ch1.setupHooks(); K.vn.vnTest.turbo = true; K.vn.vnTest.choose = () => 0;
    K.snap = () => structuredClone(K.core.state); K.events = [];
    const enter = K.vn.hooks.onEnter;
    K.vn.hooks.onEnter = (id, scene) => { K.events.push(id); enter?.(id, scene); };
  }, restore);
}

await suite("samechan-dates", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [mode, opts] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    const options = { ...opts, reducedMotion: "reduce" };
    const press = (page, selector) => opts.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    await check(`${mode}-real-lime-booking-date-choice-and-save`, async page => {
      await setup(page);
      await page.evaluate(() => {
        K.ch1.setupHooks(); // resumeGame used to reset the test observer before installing it below.
        // This suite exercises a legacy saved-lover UI fixture. The real chapter
        // entry now runs DAY1; chapter-two reachability is covered by ch2_daily.
        void K.calendar.runDaily({ nightEvents: {} });
        const enter = K.vn.hooks.onEnter;
        K.vn.hooks.onEnter = (id, scene) => { K.events.push(id); enter?.(id, scene); K.vn.vnTest.turbo = id !== "remake_date_samechan"; };
      });
      await page.locator(".map:not(.done)").waitFor();
      const before = await page.evaluate(() => {
        K.phone.deliverMorning(); K.phone.deliverMorning(); return { s: K.snap(), n: K.core.state.inbox.filter(i => i.msg.accept_event === "date_samechan").length };
      });
      assert.equal(before.n, 1);
      await press(page, '[data-test="hud-phone"]'); await press(page, '[data-test="lime-chat-samechan"]');
      await page.locator('[data-test="reply-0"]:not([disabled])').waitFor();
      await assertFits(page, ".lime-actions .lime-reply"); await press(page, '[data-test="reply-0"]');
      await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
      const inv = await page.evaluate(() => structuredClone(K.core.state.pendingInvite));
      assert.equal(inv.event, "date_samechan"); assert.equal(inv.slot, 1); assert(inv.afterClose);
      assert.equal(inv.originId, "_date_inv_samechan_c2_d4");
      await press(page, '[data-test="pin-rest"]'); await press(page, '[data-test="map-go"]');
      await page.waitForFunction(() => K.events.includes("remake_date_samechan") && K.vn.isPlaying());
      let selected = false;
      const choice = mode === "touch" ? 1 : 0;
      for (let n = 0; n < 100; n++) {
        if (await page.locator(".vn-choice").count()) {
          await assertFits(page, ".vn-choice"); await press(page, `.vn-choice:nth-child(${choice + 1})`); selected = true;
        } else if (await page.evaluate(() => !K.vn.isPlaying())) break;
        else await press(page, ".vn-box");
        await page.waitForTimeout(100);
      }
      assert(selected); await page.waitForFunction(() => K.core.state.day === 5 && !!document.querySelector(".map:not(.done)"));
      const r = await page.evaluate(() => {
        const s = K.snap(), saved = JSON.parse(localStorage.getItem(K.core.SAVE_KEY));
        return { s, saved, events: K.events, log: K.vn.backlog().map(x => x.text).join(" ") };
      });
      assert.equal(r.events.filter(id => id === "remake_date_samechan").length, 1);
      assert.equal(r.s.money, before.s.money - 3000); assert.equal(r.s.pendingInvite, null);
      assert.equal(r.s.lastDate.samechan, 4); assert.equal(r.s.flags._samechan_last_date_chapter, 2);
      assert(r.s.flags._samechan_date.complete); assert.equal(r.saved.lastDate.samechan, 4);
      assert.equal(r.s.stats[choice ? "sense" : "insight"], before.s.stats[choice ? "sense" : "insight"] + 2);
      assert.equal(r.s.lovePts.samechan, before.s.lovePts.samechan + 5); assert.equal(r.s.loverSince.samechan, 17);
      assert(r.log.includes("わし") && r.log.includes("のじゃ")); assert(!/波多野|泳/.test(r.log));
      await page.reload({ waitUntil: "load" }); await page.locator('[data-test="title-new"]').waitFor();
      await page.locator("#boot").waitFor({ state: "detached" }); await setup(page, true);
      const loaded = await page.evaluate(() => K.snap());
      assert.equal(loaded.money, r.s.money); assert.deepEqual(loaded.stats, r.s.stats);
      assert.equal(loaded.lastDate.samechan, 4); assert.equal(loaded.lovePts.samechan, r.s.lovePts.samechan);
    }, options);

    await check(`${mode}-intro-anniversary-gameday-real-replies-once`, async page => {
      await setup(page);
      const before = await page.evaluate(() => {
        const s = K.core.state; s.limeRead = s.limeRead.filter(id => id !== "_lover_private_account_samechan");
        K.phone.deliverMorning(); K.session = K.phone.openLime({ sender: "samechan" }); return K.snap();
      });
      await page.locator('[data-test="reply-0"]:not([disabled])').waitFor();
      await press(page, '[data-test="reply-0"]'); await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
      const intro = await page.evaluate(async () => { await K.session; return K.snap(); });
      assert(intro.lovePts.samechan + (intro.loveCarry.samechan || 0) > before.lovePts.samechan);
      assert(intro.limeRead.includes("_lover_private_account_samechan"));
      await page.evaluate(() => { K.session = K.phone.openLime({ sender: "samechan" }); });
      await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
      const reread = await page.evaluate(async () => { await K.session; return K.snap(); });
      assert.equal(reread.lovePts.samechan, intro.lovePts.samechan); assert.equal(reread.loveCarry.samechan, intro.loveCarry.samechan);
      for (const tournament of [false, true]) {
        const msg = await page.evaluate(tournament => {
          const s = K.core.state; s.day = 13; s.slot = 0;
          K.phone.deliverMorning({ tournamentDay: tournament });
          const id = tournament ? "_lover_gameday_samechan_c2" : "_lover_anniv_samechan_n10";
          K.session = K.phone.openLime({ sender: "samechan", tournamentDay: tournament });
          return s.inbox.find(i => i.id === id)?.msg;
        }, tournament);
        assert(msg); if (!tournament) assert(msg.messages.some(t => t.includes("10日")));
        await page.locator('[data-test="reply-0"]:not([disabled])').waitFor();
        await press(page, '[data-test="reply-0"]'); await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
        await page.evaluate(async () => { await K.session; });
      }
      const r = await page.evaluate(() => K.snap());
      assert(r.limeRead.includes("_lover_anniv_samechan_n10") && r.limeRead.includes("_lover_gameday_samechan_c2"));
      assert.equal(r.lastDate.samechan, undefined); assert.deepEqual(r.lovers, ["samechan"]);
    }, options);

    await check(`${mode}-defer-decline-expire-and-fixed-night`, async page => {
      await setup(page);
      await page.evaluate(() => { K.phone.deliverMorning(); K.session = K.phone.openLime({ sender: "samechan" }); });
      await page.locator('[data-test="reply-2"]').waitFor(); await press(page, '[data-test="reply-2"]');
      await press(page, '[data-test="lime-chat-samechan"]'); await page.locator('[data-test="reply-1"]').waitFor();
      await press(page, '[data-test="reply-1"]'); await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
      const r = await page.evaluate(async () => {
        // 恋人の誘いは恋人全員あわせて4日に1回（LM02）。DAY4に断った誘いの次はDAY8に届く
        await K.session; const s = K.core.state, declined = K.snap(); s.day = 8; s.slot = 0;
        K.phone.deliverMorning(); s.slot = 2; K.phone.expireInvitations();
        const expired = s.inbox.find(i => i.id === "_date_inv_samechan_c2_d8");
        s.day = 12; s.slot = 0;
        return { declined, expired, fixed: K.romance.loverMessages({ fixedNight: () => true }).filter(m => m.accept_event === "date_samechan"), after: K.snap() };
      });
      assert.equal(r.declined.pendingInvite, null); assert.equal(r.declined.lastDate.samechan, undefined);
      assert.equal(r.expired.result, "expired"); assert.equal(r.after.money, 100000); assert.equal(r.after.lovePts.samechan, 12);
      assert.deepEqual(r.fixed, []);
    }, options);

    await check(`${mode}-chapter-gap-legacy-and-max-frequency`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state; s.day = 14; s.slot = 2;
        await K.dates.playSamechanDate(); s.chapter = 3; s.day = 1; s.slot = 0;
        const early = K.romance.loverMessages().filter(m => m.accept_event === "date_samechan");
        s.day = 3; s.limeRead.push("_date_inv_samechan_c2_d3");
        const next = K.romance.loverMessages().find(m => m.accept_event === "date_samechan");
        s.loveLevel.samechan = 5; s.lastDate.samechan = 1; s.flags._samechan_last_date_chapter = 3; s.day = 5;
        const maxEarly = K.romance.loverMessages().filter(m => m.accept_event === "date_samechan");
        s.day = 6; const maxNext = K.romance.loverMessages().find(m => m.accept_event === "date_samechan");
        delete s.flags._samechan_last_date_chapter; s.lastDate.samechan = 14; s.day = 5;
        const legacyNext = K.romance.loverMessages().find(m => m.accept_event === "date_samechan");
        s.lastDate.samechan = s.day; const morning = K.romance.loverMessages().find(m => m.id.startsWith("_lover_morning_samechan"));
        return { early, next, maxEarly, maxNext, legacyNext, morning, s: K.snap() };
      });
      assert.deepEqual(r.early, []); assert.equal(r.next.id, "_date_inv_samechan_c3_d3");
      assert.deepEqual(r.maxEarly, []); assert.equal(r.maxNext.id, "_date_inv_samechan_c3_d6");
      assert(r.legacyNext); assert.equal(r.s.lastDate.samechan, 5); assert(!r.s.flags._samechan_last_date_chapter);
      assert.equal(r.morning.id, "_lover_morning_samechan_c3_d5");
    }, options);

    await check(`${mode}-actual-choice-interruption-and-single-payment`, async page => {
      await setup(page);
      const inv = await page.evaluate(() => {
        const s = K.core.state; s.slot = 2; s.money = 3000; s.stamina = 10;
        const inv = { event: "date_samechan", sender: "samechan", day: 4, slot: 1, afterClose: true, queuedAfterClose: true };
        K.vn.vnTest.turbo = false; K.running = K.dates.playSamechanDate({ invite: inv, cost: 3000 }); return inv;
      });
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.deepEqual(await page.evaluate(inv => K.dates.playSamechanDate({ invite: inv, cost: 3000 }), inv), { done: false, spent: 0 });
      for (let n = 0; n < 80 && !await page.locator(".vn-choice").count(); n++) { await press(page, ".vn-box"); await page.waitForTimeout(100); }
      await assertFits(page, ".vn-choice"); await press(page, `.vn-choice:nth-child(${mode === "touch" ? 2 : 1})`);
      const interrupted = await page.evaluate(() => { K.core.save(); return K.snap(); });
      assert.equal(interrupted.money, 3000); assert.equal(interrupted.stamina, 10); assert(!interrupted.flags._samechan_date.complete);
      assert.equal(interrupted.lovePts.samechan, 12); assert(interrupted.pendingInvite);
      await page.reload({ waitUntil: "load" }); await page.locator('[data-test="title-new"]').waitFor();
      await page.locator("#boot").waitFor({ state: "detached" }); await setup(page, true);
      const r = await page.evaluate(async () => {
        K.vn.vnTest.choose = () => { throw Error("The actual saved date answer was asked again"); };
        const before = K.snap(); await K.dates.playSamechanDate({ invite: K.core.state.pendingInvite, cost: 3000 });
        const after = K.snap(); await K.dates.playSamechanDate({ invite: before.pendingInvite, cost: 3000 });
        K.core.save(); K.core.load(); return { before, after, loaded: K.snap() };
      });
      assert.equal(r.after.money, 0); assert.equal(r.after.stamina, 0); assert.equal(r.after.pendingInvite, null);
      assert.equal(r.after.lovePts.samechan, 17); assert.equal(r.after.lastDate.samechan, 4);
      assert.equal(r.after.stats[mode === "touch" ? "sense" : "insight"], r.before.stats[mode === "touch" ? "sense" : "insight"] + 2);
      assert.equal(r.loaded.money, 0); assert.deepEqual(r.loaded.stats, r.after.stats); assert.equal(r.loaded.lovePts.samechan, 17);
    }, options);

    await check(`${mode}-friend-stale-booking-chapter-and-missing-scene`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state; s.lovers = []; s.flags._friend_samechan = true;
        const before = K.snap(), friend = await K.dates.playSamechanDate(), friendAfter = K.snap();
        s.lovers = ["samechan"]; s.chapter = 1; const chapter = await K.dates.playSamechanDate(); s.chapter = 2;
        const sc = K.data.DB.lover.dates.samechan; delete K.data.DB.lover.dates.samechan;
        const missing = await K.dates.playSamechanDate(), noInvite = K.romance.loverMessages().filter(m => m.accept_event === "date_samechan");
        K.data.DB.lover.dates.samechan = sc;
        s.lovers = []; s.pendingInvite = { event: "date_samechan", sender: "samechan", day: 4, slot: 0 };
        s.inbox = [{ id: "unrelated", day: 4, msg: { sender: "minto", type: "chat", messages: ["hello"] }, read: true, done: true, log: [] }];
        void K.calendar.runDaily({ nightEvents: {} }); return { before, friend, friendAfter, chapter, missing, noInvite };
      });
      assert(!r.friend.done && !r.chapter.done && !r.missing.done); assert.deepEqual(r.friendAfter, r.before); assert.deepEqual(r.noInvite, []);
      await page.locator(".map:not(.done)").waitFor();
      const after = await page.evaluate(() => K.snap());
      assert.equal(after.pendingInvite, null); assert.equal(after.slot, 0); assert.equal(after.money, 100000);
      assert.equal(after.lovePts.samechan, 12); assert.deepEqual(after.inbox[0].log, []);
      assert.deepEqual(await page.evaluate(() => K.romance.loverMessages().filter(m => m.sender === "samechan")), []);
    }, options);

    await check(`${mode}-date-committed-before-interrupted-name-milestone`, async page => {
      await setup(page);
      const inv = await page.evaluate(() => {
        const s = K.core.state; s.slot = 2; s.money = 3000; s.stamina = 10;
        s.loveLevel.samechan = 3; s.lovePts.samechan = 47;
        s.loverEventsSeen = [1, 2, 3].map(n => `lover_samechan_lv${n}`); s.flags._samechan_swimming_known = true;
        const enter = K.vn.hooks.onEnter;
        K.vn.hooks.onEnter = (id, scene) => { enter?.(id, scene); K.vn.vnTest.turbo = !id.startsWith("lover_samechan") && !id.startsWith("samechan_future"); };
        const inv = { event: "date_samechan", sender: "samechan", day: 4, slot: 1, afterClose: true, queuedAfterClose: true };
        K.running = K.dates.playSamechanDate({ invite: inv, cost: 3000 }); return inv;
      });
      await page.waitForFunction(() => K.core.state.flags._samechan_date?.complete && K.vn.isPlaying());
      for (let n = 0; n < 80 && !await page.evaluate(() => K.core.state.flags._samechan_name_known); n++) {
        await press(page, ".vn-box"); await page.waitForTimeout(100);
      }
      const interrupted = await page.evaluate(() => { K.core.save(); return K.snap(); });
      assert.equal(interrupted.money, 0); assert.equal(interrupted.stamina, 0); assert.equal(interrupted.pendingInvite, null);
      assert.equal(interrupted.lovePts.samechan, 52); assert(interrupted.flags._samechan_name_known);
      assert(!interrupted.loverEventsSeen.includes("lover_samechan_lv4"));
      await page.reload({ waitUntil: "load" }); await page.locator('[data-test="title-new"]').waitFor();
      await page.locator("#boot").waitFor({ state: "detached" }); await setup(page, true);
      const r = await page.evaluate(async inv => {
        const before = K.snap(); await K.dates.playSamechanDate({ invite: inv, cost: 3000 });
        const repeated = K.snap(); await K.bonds.playSamechanMilestone(); K.core.load();
        return { before, repeated, after: K.snap(), log: K.vn.backlog().map(x => x.text).join(" ") };
      }, inv);
      assert.equal(r.repeated.money, r.before.money); assert.equal(r.repeated.lovePts.samechan, 52);
      assert.deepEqual(r.repeated.stats, r.before.stats); assert.equal(r.repeated.slot, 2);
      assert.equal(r.after.lovePts.samechan, 55); assert.deepEqual(r.after.stats, r.before.stats);
      assert(r.after.loverEventsSeen.includes("lover_samechan_lv4")); assert(!r.log.includes("本当のお名前"));
    }, options);

    await check(`${mode}-legacy-schema5-reservation-round-trip`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const saved = K.snap(); saved.schema = 5; saved.slot = 2; saved.money = 3000;
        saved.pendingInvite = { event: "date_samechan", sender: "samechan", day: 4, slot: 1, afterClose: true, queuedAfterClose: true };
        delete saved.lastDate; delete saved.loveCarry;
        localStorage.setItem(K.core.SAVE_KEY, JSON.stringify(saved)); K.core.load(); const before = K.snap();
        await K.dates.playSamechanDate({ invite: K.core.state.pendingInvite, cost: 3000 }); K.core.load();
        return { before, after: K.snap() };
      });
      assert.equal(r.before.pendingInvite.event, "date_samechan"); assert.equal(r.before.pendingInvite.originId, null);
      assert.equal(r.after.pendingInvite, null); assert.equal(r.after.money, 0); assert.equal(r.after.lastDate.samechan, 4);
      assert.equal(r.after.lovePts.samechan, 17); assert.deepEqual(r.after.lovers, ["samechan"]); assert.equal(r.after.loverSince.samechan, 17);
    }, options);
  }
});
