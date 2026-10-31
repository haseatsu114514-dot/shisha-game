// #368: 会場一致と最後の返信機会を、未読・保留・旧セーブ・実操作で確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("venue-invite-reminder", async (check) => {
  for (const [label, options, read] of [
    ["pc-unread", {}, false],
    ["touch-waiting", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(label, async (page) => {
    const activate = (locator) => options.hasTouch ? locator.tap() : locator.click();
    page.setDefaultTimeout(30000);
    await page.evaluate(async (read) => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const vn = await import("./js/vn/engine.js");
      const daily = await import("./js/daily/calendar.js");
      const ui = await import("./js/core/ui.js");
      const lime = await import("./js/daily/phone.js");
      window.QA = { core, data, vn, daily, ui, lime };
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 0, money: 30000, stamina: 100 });
      Object.assign(s.flags, {
        _morning_4: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true,
        _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true,
      });
      s.met.minto = true;
      s.contacts.push("minto");
      const m = data.DB.lime.find((entry) => entry.id === "lime_minto_day4");
      if (!m) throw new Error("The scheduled PEPPERMINT invite must exist");
      s.inbox.push({
        id: m.id, originId: m.id, day: 4, msg: structuredClone(m),
        read, done: false, replyState: "waiting", log: [],
      });
      if (read) s.limeRead.push(m.id);
      const ch1 = await import("./js/chapters/ch1.js");
      ch1.setupHooks();
      vn.vnTest.turbo = true;
      vn.vnTest.choose = () => 0;
      ui.clearScreen();
      QA.run = daily.runDaily({ nightEvents: {} });
    }, read);

    await page.locator('[data-test="pin-minto"]').waitFor();
    assert.equal(await page.locator(".hud-lime .badge").textContent(), read ? "" : "1");
    assert.equal(await page.evaluate(() => QA.lime.venueInviteNeedingReply("minto")?.msg?.sender), "minto");
    await activate(page.locator('[data-test="pin-minto"]'));
    const enter = () => activate(page.locator('[data-test="map-go"]'));
    await enter();
    await page.locator('[data-test="venue-invite-check"]').waitFor();
    const before = await page.evaluate(() => ({
      slot: QA.core.state.slot,
      money: QA.core.state.money,
      read: QA.core.state.inbox[0].read,
      done: QA.core.state.inbox[0].done,
    }));
    assert.deepEqual(before, { slot: 0, money: 30000, read, done: false });
    await activate(page.locator('[data-test="venue-invite-check"]'));
    // 送信者指定のLIMEはトーク一覧ではなく本文へ直行する（一覧行は表示されない）。
    await page.locator('[data-test="reply-2"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.slot), 0, "Opening LIME must not spend an action");
    await activate(page.locator('[data-test="reply-2"]')); // 返事を保留し、一覧へ戻る
    await activate(page.locator('[data-test="phone-close"]'));
    assert.deepEqual(await page.evaluate(() => ({
      slot: QA.core.state.slot, money: QA.core.state.money, read: QA.core.state.inbox[0].read,
      done: QA.core.state.inbox[0].done,
    })), { slot: 0, money: 30000, read: true, done: false });
    await page.evaluate(() => { QA.core.save(); QA.core.load(); });
    await enter();
    assert.equal(await page.locator('[data-test="venue-invite-check"]').count(), 0, "The same invite must not nag twice");
  }, options);

  await check("other-store-no-reminder", async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 0 });
      const m = data.DB.lime.find((entry) => entry.id === "lime_minto_day4");
      s.inbox.push({ id: m.id, day: 4, msg: structuredClone(m), read: false, done: false, replyState: "waiting" });
      const lime = await import("./js/daily/phone.js");
      const active = lime.venueInviteNeedingReply("minto");
      const unrelated = lime.actionInviteNeedingReply("naru");
      const expired = s.inbox[0];
      expired.done = true;
      const cleared = lime.venueInviteNeedingReply("minto");
      window.QAReminder = { active: !!active, unrelated: !!unrelated, cleared: !!cleared, unread: lime.unreadCount() };
    });
    assert.deepEqual(await page.evaluate(() => window.QAReminder), { active: true, unrelated: false, cleared: false, unread: 1 });
  });

  for (const [label, source, spot, expectedSender] of [
    ["sumi-work-at-tonari", "sumi-work", "tonari", "sumi"],
    ["hiyori-visit-at-tonari", "hiyori-tonari", "tonari", "sumi"],
    ["hiyori-date-at-peppermint", "hiyori-shop", "minto", "hiyori"],
  ]) await check(label, async (page) => {
    await page.evaluate(async ({ source, spot }) => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const phone = await import("./js/daily/phone.js");
      const { state, newGame } = core;
      const s = newGame();
      Object.assign(s, { chapter: 1, phase: "daily", day: 4,
        slot: source === "hiyori-shop" ? 1 : 0, money: 30000, stamina: 100 });
      const base = source === "sumi-work"
        ? { id: "_sumi_baito_inv_d4", sender: "sumi", type: "invitation",
            time_slot: "noon", accept_event: "__sumi_baito__" }
        : source === "hiyori-tonari"
        ? structuredClone(data.DB.lime.find((m) => m.id === "hiyori_sumi_tonari_report"))
        : { id: "_hiyori_shop_test", sender: "hiyori", type: "invitation",
            time_slot: "night", accept_event: "__hiyori_shop__", visit_spot: "minto" };
      s.inbox.push({ id: base.id, day: s.day, msg: base,
        read: false, done: false, replyState: "waiting", log: [] });
      s.met.minto = true; s.contacts.push("minto");
      const valid = phone.venueInviteNeedingReply(spot);
      const unrelated = phone.venueInviteNeedingReply(spot === "tonari" ? "minto" : "naru");
      const read = s.inbox[0]; read.read = true;
      const waiting = phone.venueInviteNeedingReply(spot);
      read.done = true; read.result = "accepted";
      const accepted = phone.venueInviteNeedingReply(spot);
      read.done = false; delete read.result;
      read.read = false; s.slot = 1;
      const evening = phone.venueInviteNeedingReply(spot);
      window.QAInviteCases = { valid: valid?.msg?.sender, unrelated: !!unrelated,
        waiting: waiting?.msg?.sender, accepted: !!accepted, evening: !!evening };
    }, { source, spot });
    assert.deepEqual(await page.evaluate(() => window.QAInviteCases), {
      valid: expectedSender, unrelated: false, waiting: expectedSender,
      accepted: false, evening: source === "hiyori-shop",
    });
  });

  // 「店舗への訪問」ではなく「今日の返事の締切」が迫るなる・アダムの約束を守る。
  for (const [label, messageId, sender, options] of [
    ["naru-after-close-night", "lime_naru_day3", "naru", {}],
    ["adam-arcade-night-touch", "lime_adam_arcade_after_close", "adam",
      { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label, async (page) => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async ({ messageId, sender }) => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const vn = await import("./js/vn/engine.js");
      const daily = await import("./js/daily/calendar.js");
      const ui = await import("./js/core/ui.js");
      const phone = await import("./js/daily/phone.js");
      const ch1 = await import("./js/chapters/ch1.js");
      window.QA = { core, phone };
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 1, money: 30000, stamina: 100 });
      Object.assign(s.flags, { _morning_4: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1,
        _lime_opened: true, _intro_minto: true });
      s.met[sender] = true;
      s.contacts.push(sender);
      const m = data.DB.lime.find((entry) => entry.id === messageId);
      s.inbox.push({ id: m.id, day: 4, msg: structuredClone(m), read: false,
        done: false, replyState: "waiting", log: [] });
      ch1.setupHooks(); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      ui.clearScreen();
      QA.run = daily.runDaily({ nightEvents: {} });
    }, { messageId, sender });
    await page.locator('[data-test="pin-rest"]').waitFor();
    // 別の場所へ向かう際、夜の最終行動でだけ期限を知らせる。
    assert.deepEqual(await page.evaluate(() => ({
      venue: QA.phone.venueInviteNeedingReply("rest"),
      deadline: QA.phone.actionInviteNeedingReply("rest")?.kind,
    })), { venue: null, deadline: "deadline" });
    await page.locator('[data-test="pin-rest"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="venue-invite-check"]').waitFor();
    assert.match(await page.locator(".modal-body").innerText(), /今日のお誘い/);
    assert.equal(await page.evaluate(() => QA.core.state.slot), 1);
    assert.equal(await page.evaluate(() => QA.core.state.money), 30000);
    await page.locator('[data-test="venue-invite-check"]').click();
    await page.locator('[data-test="reply-2"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.inbox[0].read), true);
    await page.locator('[data-test="reply-2"]').click();
    await page.locator('[data-test="phone-close"]').click();
    await page.locator('[data-test="map-go"]').click();
    assert.equal(await page.locator('[data-test="venue-invite-check"]').count(), 0);
  }, options);

  await check("deadline-and-unrelated-cases", async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const phone = await import("./js/daily/phone.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 0 });
      const naru = data.DB.lime.find(m => m.id === "lime_naru_day3");
      const adam = data.DB.lime.find(m => m.id === "lime_adam_arcade_after_close");
      const outing = data.DB.lime.find(m => m.id === "lime_outing_naru_1");
      const put = (m, read = false) => {
        const item = { id: m.id, day: 4, msg: structuredClone(m), read,
          done: false, replyState: "waiting", log: [] };
        s.inbox = [item];
        return item;
      };
      put(naru);
      const naruNoon = phone.actionInviteNeedingReply("rest")?.kind ?? null;
      s.slot = 1;
      const naruNight = phone.actionInviteNeedingReply("rest")?.kind ?? null;
      s.slot = 0;
      put(adam);
      const adamNoon = phone.actionInviteNeedingReply("rest")?.kind ?? null;
      s.slot = 1;
      const adamNight = phone.actionInviteNeedingReply("rest")?.kind ?? null;
      s.slot = 0;
      // 休日・臨時休暇の外出LIMEは配信時に当日用へ解決される。
      const outingToday = structuredClone(outing);
      delete outingToday.closed_on;
      outingToday.temporary_closed = true;
      const busy = put(outingToday, true);
      const naruOutingNoon = phone.actionInviteNeedingReply("rest")?.kind ?? null;
      busy.done = true; busy.result = "accepted";
      const accepted = phone.actionInviteNeedingReply("rest");
      busy.done = false; delete busy.result;
      s.day = 5;
      const expired = phone.actionInviteNeedingReply("rest");
      window.QADeadlines = { naruNoon, naruNight, adamNoon, adamNight,
        naruOutingNoon, accepted: !!accepted, expired: !!expired };
    });
    assert.deepEqual(await page.evaluate(() => window.QADeadlines), {
      naruNoon: null, naruNight: "deadline", adamNoon: null,
      adamNight: "deadline", naruOutingNoon: "deadline", accepted: false, expired: false,
    });
  });

  await check("non-venue-and-after-close-invites-ignored", async (page) => {
    await page.evaluate(async () => {
      const { visitReminderSpot } = await import("./js/daily/invitations.js");
      const data = await import("./js/core/data.js");
      const naru = data.DB.lime.find(m => m.id === "lime_naru_day3");
      const outing = data.DB.lime.find(m => m.id === "lime_outing_minto_1");
      const chat = { sender: "minto", type: "message", visit_spot: "minto" };
      window.QANonVenue = [visitReminderSpot(naru), visitReminderSpot(outing), visitReminderSpot(chat)];
    });
    assert.deepEqual(await page.evaluate(() => window.QANonVenue), [null, null, null]);
  });
  const startReminderDay = async (page, { slot = 1, stamina = 100, night = "" } = {}) => {
    await page.evaluate(async ({ slot, stamina, night }) => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const vn = await import("./js/vn/engine.js");
      const daily = await import("./js/daily/calendar.js");
      const phone = await import("./js/daily/phone.js");
      const ui = await import("./js/core/ui.js");
      const ch1 = await import("./js/chapters/ch1.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot, stamina, money: 30000 });
      Object.assign(s.flags, { _morning_4: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1, _lime_opened: true });
      s.met.naru = true; s.contacts.push("naru");
      const m = data.DB.lime.find((m) => m.id === "lime_naru_day3");
      s.inbox.push({ id: m.id, day: 4, msg: structuredClone(m), read: false,
        done: false, replyState: "waiting", log: [] });
      const nightEvents = night === "completed" ? { 4: { id: "completed", done: () => true } }
        : night === "deferred" ? { 3: { id: "deferred", schedule: "regular", run: async () => {} } } : {};
      if (night === "deferred") s.deferredNightEvents = [{ id: "deferred", chapter: 1, originalDay: 3, deferredOn: 3 }];
      ch1.setupHooks(); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      ui.clearScreen(); window.QA = { core, phone };
      void daily.runDaily({ nightEvents });
    }, { slot, stamina, night });
    await page.locator('[data-test="pin-rest"]').waitFor();
  };

  await check("private-account-reminder-opens-received-thread", async (page) => {
    await startReminderDay(page);
    await page.evaluate(async () => {
      const data = await import("./js/core/data.js");
      const s = QA.core.state;
      s.met.minto = true; s.contacts.push("minto"); s.lovers.push("minto");
      s.flags._minto_name_known = true;
      const m = data.DB.lime.find(m => m.id === "lime_minto_day4");
      s.inbox = [
        { id: "business-chat", day: 4, msg: { sender: "minto", type: "message", messages: ["お店のご案内"] }, read: false, done: false, log: [] },
        { id: m.id, day: 4, account: "minto_private", msg: structuredClone(m), read: false, done: false, replyState: "waiting", log: [] },
      ];
    });
    await page.locator('[data-test="pin-minto"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="venue-invite-check"]').click();
    await page.locator('[data-test="reply-2"]').waitFor();
    assert.deepEqual(await page.evaluate(() => QA.core.state.inbox.map(item => item.read)), [false, true]);
    assert.equal(await page.evaluate(() => QA.core.state.slot), 1);
  });

  await check("free-shopping-before-rin-action", async (page) => {
    await startReminderDay(page);
    await page.locator('[data-test="pin-shop"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="shop-upstairs"]').waitFor();
    assert.equal(await page.locator('[data-test="venue-invite-check"]').count(), 0);
    assert.equal(await page.evaluate(() => QA.core.state.slot), 1);
    await page.locator('[data-test="shop-upstairs"]').click();
    await page.locator('[data-test="venue-invite-check"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.slot), 1);
    await page.locator('[data-test="venue-invite-check"]').click();
    await page.locator('[data-test="reply-2"]').waitFor();
    await page.locator('[data-test="reply-2"]').click();
    await page.locator('[data-test="phone-close"]').click();
    await page.locator('[data-test="pin-rest"]').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ slot: QA.core.state.slot, money: QA.core.state.money,
      rinVisited: QA.core.state.visitedDay.rin || null })), { slot: 1, money: 30000, rinVisited: null });
  });

  await check("full-day-rest-last-reply-before-two-slots", async (page) => {
    await startReminderDay(page, { slot: 0, stamina: 0 });
    await page.locator('[data-test="pin-rest"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="rest-full"]').waitFor();
    assert.equal(await page.locator('[data-test="venue-invite-check"]').count(), 0);
    await page.locator('[data-test="rest-full"]').click();
    await page.locator('[data-test="venue-invite-check"]').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ slot: QA.core.state.slot, read: QA.core.state.inbox[0].read,
      resting: !!QA.core.state.restDay?.fullDay })), { slot: 0, read: false, resting: false });
    await page.locator('[data-test="venue-invite-check"]').click();
    await page.locator('[data-test="reply-2"]').waitFor();
    await page.locator('[data-test="reply-2"]').click();
    await page.locator('[data-test="phone-close"]').click();
    await page.locator('[data-test="pin-rest"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.slot), 0);
  });

  for (const night of ["completed", "deferred"]) await check(`${night}-night-plan`, async (page) => {
    await startReminderDay(page, { night });
    await page.locator('[data-test="pin-rest"]').click();
    await page.locator('[data-test="map-go"]').click();
    if (night === "completed") {
      await page.locator('[data-test="venue-invite-check"]').waitFor();
      assert.equal(await page.evaluate(() => QA.core.state.slot), 1);
    } else {
      assert.equal(await page.locator('[data-test="venue-invite-check"]').count(), 0);
      assert.equal(await page.evaluate(() => QA.core.state.inbox[0].result), "expired");
    }
  });

  await check("multiple-invites-free-actions-and-legacy-reminder-save", async (page) => {
    const actual = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const data = await import("./js/core/data.js");
      const phone = await import("./js/daily/phone.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 1 });
      s.inbox = ["lime_naru_day3", "lime_adam_arcade_after_close"].map(id => ({ id, day: 4,
        msg: structuredClone(data.DB.lime.find(m => m.id === id)), read: false, done: false, replyState: "waiting" }));
      const first = phone.actionInviteNeedingReply("rest").item.id;
      const second = phone.actionInviteNeedingReply("rest", {}, [first]).item.id;
      const none = phone.actionInviteNeedingReply("rest", {}, [first, second]);
      const free = phone.actionInviteNeedingReply("fortune", { spendsAction: false });
      s.flags._venue_lime_reminders = [`1:4:${first}`];
      core.save();
      const saved = JSON.parse(localStorage.getItem(core.SAVE_KEY)); saved.schema = 11;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(saved)); core.load();
      return { first, second, none: !!none, free: !!free,
        remembered: core.state.flags._venue_lime_reminders, unread: phone.unreadCount() };
    });
    assert.deepEqual(actual, { first: "lime_naru_day3", second: "lime_adam_arcade_after_close",
      none: false, free: false, remembered: ["1:4:lime_naru_day3"], unread: 2 });
  });

});
