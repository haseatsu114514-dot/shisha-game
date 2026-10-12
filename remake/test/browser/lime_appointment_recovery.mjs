// #485: 本番LIME・買い物・日常行動・営業後・旧セーブで約束の消失を検証する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, day = 5, slot = 0) {
  page.setDefaultTimeout(60000);
  await page.evaluate(async ({ day, slot }) => {
    window.QA = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      stats: await import("./js/core/stats.js"), phone: await import("./js/daily/phone.js"),
      calendar: await import("./js/daily/calendar.js"), ch1: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), ui: await import("./js/core/ui.js") };
    const s = QA.core.newGame(); Object.assign(s, { phase: "daily", day, slot, stamina: 100, money: 30000 });
    Object.assign(s.flags, { _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, [`_morning_${day}`]: true, _intro_minto: true, known_name_minto: true });
    s.contacts.push("minto"); s.met.minto = true; s.story.minto = 5;
    s.affinity.minto = 20;
    const msg = structuredClone(QA.data.DB.lime.find(m => m.id === "lime_minto_first_holiday"));
    s.inbox.push({ id: msg.id, originId: msg.id, day, msg, read: false, done: false, replyState: "waiting", log: [] });
    QA.ch1.setupHooks(); QA.vn.vnTest.turbo = true; QA.vn.vnTest.choose = () => 0;
    QA.played = [];
    const onEnter = QA.vn.hooks.onEnter;
    QA.vn.hooks.onEnter = (id, scene) => { QA.played.push(id); onEnter?.(id, scene); };
    QA.vn.backlog().length = 0; QA.ui.clearScreen();
    QA.error = null;
    QA.run = (nightEvents = {}) => QA.calendar.runDaily({ nightEvents }).catch(e => QA.error = e.stack);
    QA.auto = setInterval(() => document.querySelector('[data-test="after-none"]')?.click(), 20);
  }, { day, slot });
}

async function mapAt(page, day, slot) {
  await page.waitForFunction(([day, slot]) => QA.error || QA.core.state.day === day && QA.core.state.slot === slot
    && document.querySelector('.map:not(.done) [data-test="pin-rest"]') && !document.querySelector("#modal.show"), [day, slot]);
  assert.equal(await page.evaluate(() => QA.error), null);
}
async function go(page, id) {
  await page.locator(`.map:not(.done) [data-test="pin-${id}"]`).click();
  await page.locator('[data-test="map-go"]').click();
}

await suite("lime-appointment-recovery", async check => {
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${platform}-accepted-shopping-shortfall`, async page => {
      await setup(page);
      await page.evaluate(() => { QA.core.state.money = QA.data.DB.flavorById.blueberry.price + 700; QA.run(); });
      await mapAt(page, 5, 0);
      await page.locator('[data-test="hud-phone"]').click();
      await page.locator('[data-test="lime-chat-minto"]').click();
      await page.locator('[data-test="reply-0"]').click();
      await page.locator('[data-test="phone-next"]').click(); await page.locator('[data-test="phone-close"]').click();
      await mapAt(page, 5, 0);
      assert.equal(await page.evaluate(() => QA.core.state.pendingInvite.event), "ch1_minto_fifth");
      await go(page, "shop"); await page.locator('[data-test="buy-blueberry"]').click();
      await page.locator('[data-test="shop-leave"]').click(); await mapAt(page, 5, 0);
      assert.equal(await page.evaluate(() => QA.core.state.money), 700);
      await go(page, "rest"); await mapAt(page, 5, 1);
      const missed = await page.evaluate(() => {
        QA.core.save(); QA.core.load();
        const s = QA.core.state, item = s.inbox[0];
        return { pending: s.pendingInvite, day: s.day, slot: s.slot, money: s.money,
          result: item.result, resend: item.needsResend, read: item.read, invited: !!s.flags._invited_lime_minto_first_holiday,
          limeRead: s.limeRead.includes(item.id), complete: !!item.completed, logs: item.log,
          scene: QA.played.includes("ch1_minto_fifth") };
      });
      assert.equal(missed.pending, null); assert.equal(missed.day, 5); assert.equal(missed.slot, 1); assert.equal(missed.money, 700);
      assert.equal(missed.result, "expired"); assert(missed.resend && missed.read && missed.limeRead);
      assert(!missed.invited && !missed.complete && !missed.scene); assert(missed.logs.some(l => /所持金/.test(l.note || "")));
      await go(page, "rest"); await mapAt(page, 6, 0);
      const retries = await page.evaluate(() => QA.core.state.inbox.filter(i => i.originId === "lime_minto_first_holiday"));
      assert.equal(retries.length, 2); assert.equal(retries[1].day, 6); assert(!retries[1].done);
      await page.evaluate(() => QA.phone.deliverMorning());
      assert.equal(await page.evaluate(() => QA.core.state.inbox.filter(i => i.originId === "lime_minto_first_holiday").length), 2);
    }, { ...options, reducedMotion: "reduce" });
  }

  await check("shortfall-after-fixed-night", async page => {
    await setup(page, 5, 2);
    await page.evaluate(() => {
      const s = QA.core.state, item = s.inbox[0];
      Object.assign(item, { read: true, done: true, result: "accepted", replyState: "replied" });
      s.limeRead.push(item.id); s.flags._invited_lime_minto_first_holiday = true; s.money = 800;
      s.pendingInvite = { originId: item.id, sender: "minto", event: "ch1_minto_fifth", day: 5, slot: 1,
        afterClose: true, queuedAfterClose: true };
      QA.run({ 5: { done: () => !!s.flags._qaNightDone, run: async () => { QA.stats.addMoney(-100); s.flags._qaNightDone = true; } } });
    });
    await mapAt(page, 6, 0);
    const result = await page.evaluate(() => {
      const s = QA.core.state;
      return { pending: s.pendingInvite, money: s.money, original: s.inbox[0], privateNight: s.flags._private_night_day,
        fifth: !!s.flags._minto_fifth_done, scene: QA.played.includes("ch1_minto_fifth"),
        retry: s.inbox.filter(i => i.originId === "lime_minto_first_holiday").length };
    });
    assert.equal(result.pending, null); assert.equal(result.money, 700); assert.equal(result.original.result, "expired");
    assert(result.original.needsResend); assert(!result.original.completed && !result.fifth && !result.scene); assert.equal(result.privateNight, undefined);
    assert.equal(result.retry, 2);
  }, { reducedMotion: "reduce" });

  for (const completed of [false, true]) await check(`legacy-${completed ? "completed" : "lost"}`, async page => {
    await setup(page, 6, 1);
    await page.evaluate(completed => {
      const s = QA.core.state, item = s.inbox[0]; item.day = 5;
      Object.assign(item, { read: true, done: true, result: "accepted", replyState: "replied" });
      s.flags._invited_lime_minto_first_holiday = true; s.limeRead.push(item.id);
      if (completed) s.flags._minto_fifth_done = true;
      QA.core.saveToSlot("suien_remake_slot1"); QA.core.loadFromSlot("suien_remake_slot1"); QA.run();
    }, completed);
    await mapAt(page, 6, 1);
    const result = await page.evaluate(() => ({ item: QA.core.state.inbox[0], invited: !!QA.core.state.flags._invited_lime_minto_first_holiday,
      read: QA.core.state.limeRead.includes("lime_minto_first_holiday"), pending: QA.core.state.pendingInvite }));
    assert.equal(result.item.result, completed ? "accepted" : "expired"); assert.equal(!!result.item.needsResend, !completed);
    assert.equal(result.invited, completed); assert(result.read && result.item.read); assert.equal(result.pending, null);
  }, { reducedMotion: "reduce" });

  await check("legacy-persisted-retry-origin", async page => {
    await setup(page, 6, 1);
    const loadedOrigin = await page.evaluate(() => {
      const s = QA.core.state, item = s.inbox[0], canonical = item.id;
      const retryId = `${canonical}_retry_c1_d5`;
      Object.assign(item, { id: retryId, originId: retryId, day: 5, read: true, done: true,
        result: "accepted", replyState: "replied" });
      item.msg.id = retryId; item.msg.origin_id = canonical;
      s.limeRead.push(canonical, retryId); s.flags[`_invited_${canonical}`] = true;
      // 以前のロード処理が誤ったoriginIdを書き込んだまま保存した状態を再現する。
      s.schema = 12;
      localStorage.setItem("suien_remake_slot2", JSON.stringify(s));
      QA.core.loadFromSlot("suien_remake_slot2");
      const origin = QA.core.state.inbox[0].originId; QA.run(); return origin;
    });
    assert.equal(loadedOrigin, "lime_minto_first_holiday");
    await mapAt(page, 6, 1);
    const repaired = await page.evaluate(() => {
      const s = QA.core.state;
      return { item: s.inbox[0], pending: s.pendingInvite, invited: !!s.flags._invited_lime_minto_first_holiday,
        read: s.limeRead.includes("lime_minto_first_holiday_retry_c1_d5") };
    });
    assert.equal(repaired.item.result, "expired"); assert(repaired.item.needsResend && repaired.item.read && repaired.read);
    assert(!repaired.invited); assert.equal(repaired.pending, null);
    await go(page, "rest"); await mapAt(page, 7, 0);
    const retries = await page.evaluate(() => QA.core.state.inbox.filter(i => i.originId === "lime_minto_first_holiday"));
    assert.equal(retries.length, 2); assert.equal(retries[1].day, 7); assert.equal(retries[1].msg.origin_id, "lime_minto_first_holiday");
    assert(!retries[1].read && !retries[1].done);
    await page.evaluate(() => QA.phone.deliverMorning());
    assert.equal(await page.evaluate(() => QA.core.state.inbox.filter(i => i.originId === "lime_minto_first_holiday").length), 2);
  }, { reducedMotion: "reduce" });

  await check("successful-meeting-survives-load", async page => {
    await setup(page, 6, 0);
    await page.evaluate(() => {
      const s = QA.core.state, item = s.inbox[0];
      item.msg.time_slot = "noon";
      Object.assign(item, { read: true, done: true, result: "accepted", replyState: "replied" });
      s.flags._invited_lime_minto_first_holiday = true; s.limeRead.push(item.id); s.money = 900;
      s.pendingInvite = { originId: item.id, sender: "minto", event: "ch1_minto_fifth", day: 6, slot: 0 };
      QA.run();
    });
    await mapAt(page, 6, 1);
    const result = await page.evaluate(() => {
      QA.core.saveToSlot("suien_remake_slot1"); QA.core.loadFromSlot("suien_remake_slot1"); QA.phone.expireInvitations();
      const s = QA.core.state;
      return { money: s.money, fifth: !!s.flags._minto_fifth_done, completed: s.inbox[0].completed,
        result: s.inbox[0].result, resend: !!s.inbox[0].needsResend, invited: !!s.flags._invited_lime_minto_first_holiday };
    });
    assert.equal(result.money, 100); assert(result.fifth && result.completed && result.invited);
    assert.equal(result.result, "accepted"); assert(!result.resend);
  }, { reducedMotion: "reduce" });
});
