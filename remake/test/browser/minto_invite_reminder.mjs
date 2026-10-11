// #368: みんとの当日来店誘いだけ、PEPPERMINTへ移動する直前に思い出す。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("minto-invite-reminder", async (check) => {
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
    assert.equal(await page.evaluate(() => QA.lime.mintoStoreInviteNeedingReply()?.msg?.sender), "minto");
    await page.locator('[data-test="pin-minto"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="minto-invite-check"]').waitFor();
    const before = await page.evaluate(() => ({
      slot: QA.core.state.slot,
      money: QA.core.state.money,
      read: QA.core.state.inbox[0].read,
      done: QA.core.state.inbox[0].done,
    }));
    assert.deepEqual(before, { slot: 0, money: 30000, read, done: false });
    await page.locator('[data-test="minto-invite-check"]').click();
    await page.locator('[data-test="lime-chat-minto"]').waitFor();
    assert.equal(await page.evaluate(() => QA.core.state.slot), 0, "Opening LIME must not spend an action");
    await page.locator('[data-test="phone-close"]').click();
    await page.locator('[data-test="map-go"]').click();
    assert.equal(await page.locator('[data-test="minto-invite-check"]').count(), 0, "The same invite must not nag twice");
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
      const active = lime.mintoStoreInviteNeedingReply();
      const expired = s.inbox[0];
      expired.done = true;
      const cleared = lime.mintoStoreInviteNeedingReply();
      window.QAReminder = { active: !!active, cleared: !!cleared, unread: lime.unreadCount() };
    });
    assert.deepEqual(await page.evaluate(() => window.QAReminder), { active: true, cleared: false, unread: 1 });
  });
});
