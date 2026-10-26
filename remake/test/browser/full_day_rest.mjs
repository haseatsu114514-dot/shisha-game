// #367: production calendar, actual chapter scenes, save/load and PC/touch input.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits } from "./support.mjs";
const artifacts = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)), process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");

async function setup(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    window.R = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      ch1: await import("./js/chapters/ch1.js"), calendar: await import("./js/daily/calendar.js"),
      nights: await import("./js/daily/night-events.js"), vn: await import("./js/vn/engine.js"),
      session: await import("./js/craft/session.js"), condition: await import("./js/core/condition.js") };
    R.ch1.setupHooks(); R.vn.vnTest.turbo = true; R.vn.vnTest.choose = () => 0;
    R.fresh = (day, slot, stamina) => {
      const s = R.core.newGame(); Object.assign(s, { phase: "daily", day, slot, stamina });
      for (const ev of Object.values(R.ch1.NIGHT_EVENTS)) for (const key of ev.doneKeys || []) s.flags[key] = true;
      Object.assign(s.flags, { _tsumugi_contest_research: true, _errand_scout_done: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _lime_opened: true, _lime_tut: 1,
        [`_morning_${day}`]: true });
      R.vn.backlog().length = 0;
      return s;
    };
    R.run = (events = R.ch1.NIGHT_EVENTS) => {
      R.finished = false; R.failure = null;
      R.promise = R.calendar.runDaily({ nightEvents: events }).then(() => R.finished = true).catch(e => R.failure = e.stack);
    };
  });
}

async function mapAt(page, day, slot) {
  await page.waitForFunction(([day, slot]) => window.__remake?.state?.day === day && window.__remake.state.slot === slot
    && document.querySelector(".map:not(.done) [data-test=pin-rest]") && !document.querySelector("#modal.show"), [day, slot]);
  const failure = await page.evaluate(() => window.R?.failure);
  assert(!failure, failure);
}
async function goHome(page, touch) {
  const select = selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
  await select('[data-test="pin-rest"]'); await select('[data-test="map-go"]');
}

await suite("full-day-rest", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [label, options, touch] of [["pc", {}, false], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true]]) {
    await check(`${label}-rest-save-defer`, async page => {
      await setup(page);
      await page.evaluate(() => { const s = R.fresh(2, 0, 10); delete s.flags._ev_salaryman; R.run(); });
      await mapAt(page, 2, 0); await goHome(page, touch);
      await page.locator('[data-test="rest-full"]').waitFor();
      await page.getByText(/今は昼。残り2枠/).waitFor();
      await assertFits(page, ".rest-modal, .rest-modal .btn");
      await page.screenshot({ path: path.join(artifacts, `full-day-rest-${label}-rest-dialog.png`), animations: "disabled" });
      const before = await page.evaluate(() => ({ day: R.core.state.day, slot: R.core.state.slot, stamina: R.core.state.stamina }));
      assert.deepEqual(before, { day: 2, slot: 0, stamina: 10 });
      await page.locator('[data-test="rest-cancel"]').click(); await mapAt(page, 2, 0);
      await goHome(page, touch); await page.locator('[data-test="rest-full"]').click();
      await mapAt(page, 3, 0);
      const delayed = await page.evaluate(() => {
        const s = R.core.state; R.core.save();
        return { stamina: s.stamina, done: !!s.flags._ev_salaryman, queue: s.deferredNightEvents, stats: s.stats,
          lines: R.vn.backlog().map(line => line.text) };
      });
      assert.equal(delayed.stamina, 100); assert(!delayed.done);
      assert.equal(delayed.queue.length, 1); assert.equal(delayed.queue[0].id, "_ev_salaryman");
      assert.equal(delayed.queue[0].originalDay, 2); assert.equal(delayed.queue[0].reason, "rest");
      assert(!delayed.lines.some(line => line.includes("カウンター頼めるか")), "休養日に通常イベントを実行しない");
      assert.deepEqual(delayed.stats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
      // Resume through the actual boot/Chapter-1 route, not a fresh test-only queue.
      await page.evaluate(() => R.core.requestResumeOnBoot()); await page.reload({ waitUntil: "load" });
      await mapAt(page, 3, 0); await setup(page);
      assert.equal(await page.evaluate(() => R.core.state.deferredNightEvents.length), 1);
      await goHome(page, touch);
      // The resumed day has Sumi's unanswered daytime invitation. Dismiss the
      // deadline reminder explicitly before checking the original rest flow.
      await page.locator('[data-test="venue-invite-go"]').click();
      await mapAt(page, 3, 1);
      assert.equal(await page.locator('[data-test="rest-full"]').count(), 0, "健康時の休養は既存1行動");
      await goHome(page, touch); await mapAt(page, 4, 0);
      const completed = await page.evaluate(() => ({ done: R.core.state.flags._ev_salaryman,
        queue: R.core.state.deferredNightEvents, lines: R.vn.backlog().map(line => line.text) }));
      assert(completed.done); assert.equal(completed.queue.length, 0);
      assert.equal(completed.lines.filter(line => line.includes("カウンター頼めるか")).length, 1);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-night-rest-and-fixed-notice`, async page => {
      await setup(page);
      await page.evaluate(() => { const s = R.fresh(9, 1, 10); delete s.flags._ev_meet_rivals; R.run(); });
      await mapAt(page, 9, 1); await goHome(page, touch);
      await page.locator('[data-test="rest-full"]').waitFor();
      await page.getByText(/今は夜。残り1枠/).waitFor();
      await page.getByText(/今日の予定：出場者説明会には参加/).waitFor();
      await assertFits(page, ".rest-modal, .rest-modal .btn");
      await page.locator('[data-test="rest-full"]').click(); await mapAt(page, 10, 0);
      const result = await page.evaluate(() => ({ stamina: R.core.state.stamina, done: R.core.state.flags._ev_meet_rivals,
        lines: R.vn.backlog().map(line => line.text), rest: R.core.state.restDay }));
      assert.equal(result.stamina, 79, "夜の1枠+55と既存就寝+14。昼へ巻き戻さない");
      assert(result.done); assert(result.lines.some(line => line.includes("残りの時間を休養")));
      assert.equal(result.rest, null);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-illness-fixed-and-tournament-condition`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = R.fresh(8, 2, 0); Object.assign(s.flags, { _cold_pending: true, _sick_once: true });
        delete s.flags._ev_meet_rivals;
        const fixed = R.ch1.NIGHT_EVENTS[9];
        R.run({ ...R.ch1.NIGHT_EVENTS, 9: { ...fixed, run: async () => {
          R.atMeeting = { day: s.day, slot: s.slot, stamina: s.stamina, condition: R.stats.currentCondition(),
            craft: R.condition.craftCondition(R.session.newSession("tournament")) };
          await fixed.run();
        } } });
      });
      await mapAt(page, 10, 0);
      const result = await page.evaluate(() => ({ atMeeting: R.atMeeting, done: R.core.state.flags._ev_meet_rivals,
        now: R.stats.currentCondition().health, lines: R.vn.backlog().map(line => line.text) }));
      assert(result.done); assert.equal(result.atMeeting.day, 9); assert.equal(result.atMeeting.slot, 2);
      assert.equal(result.atMeeting.stamina, 80); assert.equal(result.atMeeting.condition.health, "red");
      assert.deepEqual(result.atMeeting.craft, result.atMeeting.condition); assert.equal(result.now, "green");
      assert(result.lines.some(line => line.includes("一日、ゆっくり眠った")));
      // A separate fresh page stops the running daily loop before testing tournament dawn.
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-tournament-dawn`, async page => {
      await setup(page);
      await page.evaluate(() => { const s = R.fresh(13, 2, 0); s.flags._cold_pending = true; R.run(); });
      await page.waitForFunction(() => R.finished || R.failure);
      const result = await page.evaluate(() => ({ failure: R.failure, day: R.core.state.day, slot: R.core.state.slot,
        stamina: R.core.state.stamina, condition: R.session.newSession("tournament").condition,
        tutorial: R.condition.craftCondition(R.session.newSession("tutorial")).health,
        lines: R.vn.backlog().map(line => line.text) }));
      assert.equal(result.failure, null); assert.equal(result.day, 14); assert.equal(result.slot, 0); assert.equal(result.stamina, 0);
      assert.equal(result.condition.health, "red"); assert.equal(result.condition.window, .65); assert.equal(result.tutorial, "yellow");
      assert(result.lines.some(line => line.includes("大会の朝")));
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-accepted-night-appointment`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = R.fresh(4, 0, 10);
        const msg = { id: "rest-booked", sender: "sumi", type: "invitation", time_slot: "night", accept_event: "__sumi_baito__", messages: [] };
        s.inbox = [{ id: msg.id, originId: msg.id, day: 4, msg, read: true, done: true, result: "accepted", replyState: "replied", log: [] }];
        s.pendingInvite = { sender: "sumi", event: msg.accept_event, originId: msg.id, day: 4, slot: 1 };
        R.run();
      });
      await mapAt(page, 4, 0); await goHome(page, touch);
      await page.getByText(/スミさんとの今夜のLIMEの約束には参加/).waitFor();
      await page.locator('[data-test="rest-full"]').click();
      await page.locator('[data-test="shift-order-0"]').click();
      await page.locator('[data-test="after-none"]').waitFor();
      const before = await page.evaluate(() => ({ shifts: R.core.state.baitoCount, money: R.core.state.money,
        expired: R.core.state.inbox.some(item => item.originId === "rest-booked" && item.result === "expired") }));
      assert.equal(before.shifts, 1); assert(before.money > 30000); assert(!before.expired);
      await page.locator('[data-test="after-none"]').click(); await mapAt(page, 5, 0);
      assert.equal(await page.evaluate(() => R.core.state.pendingInvite), null);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-old-save-and-aftermath`, async page => {
      await setup(page);
      const legacy = await page.evaluate(() => {
        const s = R.fresh(14, 2, 10); s.schema = 11; delete s.restDay; delete s.deferredNightEvents;
        R.core.save(); R.core.load();
        const plain = { schema: R.core.state.schema, currentSchema: R.core.SCHEMA, rest: R.core.state.restDay, queue: R.core.state.deferredNightEvents };
        Object.assign(R.core.state, { phase: "aftermath", money: 52000 });
        for (const key of ["_ev_salaryman", "_ev_day5", "_ev_salaryman_change"]) delete R.core.state.flags[key];
        R.core.state.deferredNightEvents = [2, 5, 10].map(day => ({ id: R.ch1.NIGHT_EVENTS[day].id, chapter: 1,
          originalDay: day, deferredOn: 13, reason: "rest", doneKeys: R.ch1.NIGHT_EVENTS[day].doneKeys }));
        R.core.state.deferredNightEvents.push({ ...R.core.state.deferredNightEvents[0] });
        R.core.save(); R.core.load();
        R.before = JSON.stringify({ stats: R.core.state.stats, owned: R.core.state.owned });
        R.queueCount = R.core.state.deferredNightEvents.length;
        R.ch1.resumeGame().catch(e => R.failure = e.stack);
        return plain;
      });
      assert.equal(legacy.schema, legacy.currentSchema); assert.equal(legacy.rest, null); assert.deepEqual(legacy.queue, []);
      await page.locator('[data-test="end-title"]').waitFor();
      const result = await page.evaluate(() => ({ failure: R.failure, phase: R.core.state.phase, money: R.core.state.money,
        queueCount: R.queueCount, queue: R.core.state.deferredNightEvents,
        stable: JSON.stringify({ stats: R.core.state.stats, owned: R.core.state.owned }) === R.before,
        lines: R.vn.backlog().map(line => line.text) }));
      assert(!result.failure, result.failure); assert.equal(result.phase, "cleared"); assert.equal(result.money, 52000);
      assert.equal(result.queueCount, 3); assert.equal(result.queue.length, 0); assert(result.stable);
      assert(result.lines.some(line => line.includes("大会は終わったが")));
      assert(!result.lines.some(line => line.includes("大会まであと0日")));
      const first = result.lines.findIndex(line => line.includes("カウンター頼めるか"));
      const second = result.lines.findIndex(line => line.includes("見せたいものがある"));
      const third = result.lines.findIndex(line => line.includes("今日は少し違う"));
      assert(first >= 0 && first < second && second < third);
      await page.evaluate(async () => { R.core.save(); R.core.load(); await R.ch1.resumeGame(); });
      assert.equal(await page.evaluate(() => R.core.state.money), 52000);
    }, { ...options, reducedMotion: "reduce" });
  }
});
