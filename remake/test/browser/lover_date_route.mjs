// #382: saved-lover UI routes, NOT new-game reachability of later-chapter characters.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function prepare(page, id = "mashiro", legacy = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ id, legacy }) => {
    window.D = { core: await import("./js/core/state.js"), ch1: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), phone: await import("./js/daily/phone.js"),
      romance: await import("./js/daily/romance.js"), stats: await import("./js/core/stats.js") };
    const s = D.core.newGame();
    Object.assign(s, { phase: "daily", day: 4, slot: 0 });
    s.lovers = [id]; s.met[id] = true; s.contacts.push(id);
    s.loveLevel[id] = 1; s.lovePts[id] = 9; s.loverSince[id] = 3;
    s.limeRead.push(`_lover_private_account_${id}`);
    Object.assign(s.flags, { _lime_tut: 1, _errand_scout_done: true,
      _delivery_adam_done: true, _delivery_minto_done: true });
    if (id === "minto") Object.assign(s.flags, { _minto_name_known: true, _minto_identity_revealed: true });
    if (legacy) {
      s.schema = 5;
      delete s.lastDate; delete s.loveCarry; delete s.loverEventsSeen;
    }
    D.core.save(); D.core.newGame(); D.core.load();
    D.ch1.setupHooks(); D.vn.vnTest.turbo = true; D.core.config.textSpeed = 4;
    window.__remake.craftTest.auto = "good";
    D.events = []; D.choices = []; D.lines = []; D.before = structuredClone(D.core.state);
  }, { id, legacy });
}

const modes = [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]];
await suite("lover-date-route", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [mode, options] of modes) {
    const press = (page, selector) => options.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    for (const id of ["mashiro", "tsumugi", "minto", "rin", "ageha", "hiyori"]) {
      await check(`${mode}-${id}-saved-lover-ui`, async page => {
        await prepare(page, id, id === "mashiro");
        await page.evaluate(() => {
          // resumeGame installs production hooks synchronously; instrument AFTER that.
          D.ch1.resumeGame();
          const enter = D.vn.hooks.onEnter, choose = D.vn.hooks.onChoice, line = D.vn.hooks.onLine;
          D.vn.hooks.onEnter = (id, dlg) => {
            enter?.(id, dlg); D.events.push(id);
            D.vn.vnTest.turbo = !id.startsWith("remake_date_");
          };
          D.vn.hooks.onChoice = (...args) => { choose?.(...args); D.choices.push({ scene: args[0], text: args[4]?.text }); };
          D.vn.hooks.onLine = (id, item) => { line?.(id, item); if (id.startsWith("remake_date_") && item.speaker === "mashiro") D.lines.push(item.text); };
        });
        await page.locator(".map:not(.done)").waitFor();
        const received = await page.evaluate(id => {
          D.phone.deliverMorning(); D.phone.deliverMorning(); // same morning must not send twice
          return D.core.state.inbox.filter(i => i.msg.accept_event === `date_${id}`).map(i => ({ read: i.read, done: i.done }));
        }, id);
        assert.deepEqual(received, [{ read: false, done: false }]);
        await press(page, '[data-test="hud-phone"]');
        await press(page, `[data-test="lime-chat-${id === "minto" ? "minto_private" : id}"]`);
        await page.locator('[data-test="reply-0"]:not([disabled])').waitFor();
        await assertFits(page, ".lime-actions .lime-reply");
        if (id === "mashiro") await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${mode}-mashiro-invitation.png` });
        await press(page, '[data-test="reply-0"]');
        await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
        const booked = await page.evaluate(() => structuredClone(D.core.state.pendingInvite));
        assert.equal(booked.event, `date_${id}`); assert.equal(booked.sender, id);
        assert.equal(booked.day, 4); assert.equal(booked.slot, 1); assert(booked.afterClose);
        await page.locator('.map:not(.done) [data-test="pin-rest"]').waitFor();
        await press(page, '[data-test="pin-rest"]'); await press(page, '[data-test="map-go"]');
        await page.waitForFunction(id => D.events.includes(`remake_date_${id}`) && document.querySelector("#vn.active"), id);
        const choice = mode === "touch" ? 1 : 0;
        let chosen = false;
        for (let n = 0; n < 100; n++) {
          if (await page.locator(".vn-choice").count()) {
            await assertFits(page, ".vn-choice");
            await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${mode}-${id}-date-choice.png` });
            await press(page, `.vn-choice:nth-child(${choice + 1})`); chosen = true;
          } else if (await page.evaluate(() => !document.querySelector("#vn.active"))) break;
          else await press(page, ".vn-box");
          await page.waitForTimeout(120);
        }
        assert(chosen, "Date choice was not operated through the UI");
        await page.waitForFunction(() => D.core.state.day === 5 && !!document.querySelector(".map:not(.done)"));
        const result = await page.evaluate(id => {
          const s = D.core.state, saved = JSON.parse(localStorage.getItem(D.core.SAVE_KEY));
          const before = D.before;
          const lines = D.lines;
          const repeated = D.phone.deliverMorning({ fixedNight: () => true });
          return { dateCount: D.events.filter(x => x === `remake_date_${id}`).length,
            choices: D.choices.filter(c => c.scene === `remake_date_${id}`),
            lastDate: s.lastDate[id], savedLastDate: saved.lastDate[id], pending: s.pendingInvite,
            pts: s.lovePts[id], beforePts: before.lovePts[id], stats: s.stats, beforeStats: before.stats,
            lines, repeated, inboxCount: s.inbox.filter(i => i.id === `_date_inv_${id}_d4`).length };
        }, id);
        assert.equal(result.dateCount, 1); assert.equal(result.choices.length, 1);
        assert.equal(result.lastDate, 4); assert.equal(result.savedLastDate, 4);
        assert.equal(result.pending, null); assert(result.pts > result.beforePts); assert.equal(result.inboxCount, 1);
        // Current paidAction policy: invitations award one primary ability, 2P.
        // The date choice supplies the candidate when the character has no primary.
        const stat = await page.evaluate(async ({ id, choice }) => (await import("./js/daily/spots.js")).CHAR_STAT[id]
          || window.__remake.DB.lover.dates[id][choice ? "optB" : "optA"].stat, { id, choice });
        assert(result.stats[stat] >= result.beforeStats[stat] + 2, "Paid date reward missing");
        if (id === "mashiro") {
          assert(result.lines.some(t => t.includes("僕"))); assert(result.lines.some(t => t.includes("はじめくん")));
          assert(!result.lines.some(t => /はじめさん|蒸野くん/.test(t)));
          await page.reload();
          await page.locator('[data-test="title-load"]:not([disabled])').waitFor();
          await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
          await press(page, '[data-test="title-load"]'); await press(page, '[data-test="slot-0"]');
          await page.locator(".map:not(.done)").waitFor();
          const loaded = await page.evaluate(() => ({ day: window.__remake.state.day, date: window.__remake.state.lastDate.mashiro,
            pts: window.__remake.state.lovePts.mashiro, pending: window.__remake.state.pendingInvite }));
          assert.deepEqual(loaded, { day: 5, date: 4, pts: result.pts, pending: null });
        }
      }, { ...options, reducedMotion: "reduce" });
    }

    await check(`${mode}-decline-defer-expiry-and-boundaries`, async page => {
      await prepare(page);
      await page.evaluate(() => { D.phone.deliverMorning(); D.phone.openLime({ sender: "mashiro" }); });
      await page.locator('[data-test="reply-2"]').waitFor();
      await press(page, '[data-test="reply-2"]');
      await press(page, '[data-test="lime-chat-mashiro"]');
      await page.locator('[data-test="reply-1"]').waitFor();
      await press(page, '[data-test="reply-1"]');
      await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
      const result = await page.evaluate(async () => {
        const s = D.core.state, declined = s.inbox.find(i => i.msg.accept_event === "date_mashiro");
        const refusal = { result: declined.result, pending: s.pendingInvite, last: s.lastDate.mashiro ?? null, pts: s.lovePts.mashiro };
        // 恋人の誘いは恋人全員あわせて4日に1回（LM02）。DAY4に断った誘いの次はDAY8に届く
        s.day = 7; s.slot = 0;
        const early = D.romance.loverMessages().some(m => m.accept_event === "date_mashiro");
        s.day = 8; D.phone.deliverMorning();
        const fresh = s.inbox.find(i => i.id === "_date_inv_mashiro_d8");
        s.slot = 2; D.phone.expireInvitations();
        const expiry = { result: fresh.result, read: fresh.read, last: s.lastDate.mashiro ?? null, pending: s.pendingInvite };
        // Representative old accepted reservation without originId/inbox metadata.
        s.pendingInvite = { event: "date_mashiro", sender: "mashiro", day: 5, slot: 1 };
        D.phone.expireInvitations();
        const old = { pending: s.pendingInvite, history: s.inbox.some(i => i.msg.accept_event === "date_mashiro" && i.result === "expired" && i.log.some(l => l.note)) };
        const before = JSON.stringify(s), backlog = D.vn.backlog().length, errors = [];
        const log = console.error; console.error = t => errors.push(t);
        try { await D.romance.playDate("unknown_date"); } finally { console.error = log; }
        const missing = { unchanged: before === JSON.stringify(s), lines: D.vn.backlog().length - backlog, errors };
        // ここからは同じ恋人の間隔（絆MAXで5日）だけを見る。共有の4日枠は上で確認済みなので、届いた誘いの履歴を外す
        s.inbox = s.inbox.filter(i => !(i.msg?.lover && i.msg.type === "invitation"));
        s.day = 8; s.slot = 0; s.lastDate.mashiro = 4; s.loveLevel.mashiro = 5;
        const maxBefore = D.romance.loverMessages().some(m => m.accept_event === "date_mashiro");
        s.day = 9;
        const maxAfter = D.romance.loverMessages().some(m => m.accept_event === "date_mashiro");
        const fixed = D.romance.loverMessages({ fixedNight: () => true }).some(m => m.accept_event === "date_mashiro");
        s.lovers = ["minto"]; s.day = 6; s.lastDate.minto = 0; s.limeRead.push("_lover_private_account_minto");
        const holiday = D.romance.loverMessages().find(m => m.accept_event === "date_minto");
        D.core.save(); D.core.newGame(); D.core.load();
        return { refusal, early, expiry, old, missing, maxBefore, maxAfter, fixed,
          holiday: { time: holiday.time_slot, after: holiday.after_close ?? false }, savedLovers: D.core.state.lovers };
      });
      assert.deepEqual(result.refusal, { result: "declined", pending: null, last: null, pts: 9 });
      assert.equal(result.early, false, "断った誘いの3日後には、まだ次の誘いは来ない");
      assert.deepEqual(result.expiry, { result: "expired", read: false, last: null, pending: null });
      assert.equal(result.old.pending, null); assert(result.old.history);
      assert(result.missing.unchanged); assert.equal(result.missing.lines, 0); assert.equal(result.missing.errors.length, 1);
      assert(!result.maxBefore && result.maxAfter && !result.fixed);
      assert.deepEqual(result.holiday, { time: "noon", after: false });
      assert.deepEqual(result.savedLovers, ["minto"]);
    }, { ...options, reducedMotion: "reduce" });
  }
});
