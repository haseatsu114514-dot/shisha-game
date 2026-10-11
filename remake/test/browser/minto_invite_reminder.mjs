// #368: 来店先と一致する有効な未対応LIMEだけ、移動の直前に思い出す。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("venue-invite-reminder", async (check) => {
  for (const [label, options, read] of [
    ["pc-unread", {}, false],
    ["touch-waiting", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(label, async (page) => {
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
    await page.locator('[data-test="pin-minto"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="venue-invite-check"]').waitFor();
    const before = await page.evaluate(() => ({
      slot: QA.core.state.slot,
      money: QA.core.state.money,
      read: QA.core.state.inbox[0].read,
      done: QA.core.state.inbox[0].done,
    }));
    assert.deepEqual(before, { slot: 0, money: 30000, read, done: false });
    await page.locator('[data-test="venue-invite-check"]').click();
    // 送信者指定のLIMEはトーク一覧ではなく本文へ直行する（一覧行は表示されない）。
    await page.locator('[data-test="reply-2"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.slot), 0, "Opening LIME must not spend an action");
    await page.locator('[data-test="reply-2"]').click(); // 返事を保留し、一覧へ戻る
    await page.locator('[data-test="phone-close"]').click();
    assert.deepEqual(await page.evaluate(() => ({
      slot: QA.core.state.slot, money: QA.core.state.money, read: QA.core.state.inbox[0].read,
      done: QA.core.state.inbox[0].done,
    })), { slot: 0, money: 30000, read: true, done: false });
    await page.locator('[data-test="map-go"]').click();
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
      const expired = s.inbox[0];
      expired.done = true;
      const cleared = lime.venueInviteNeedingReply("minto");
      window.QAReminder = { active: !!active, cleared: !!cleared, unread: lime.unreadCount() };
    });
    assert.deepEqual(await page.evaluate(() => window.QAReminder), { active: true, cleared: false, unread: 1 });
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
});
