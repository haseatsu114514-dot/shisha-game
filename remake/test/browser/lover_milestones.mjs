// LIME先行の絆Lvと旧セーブでも、未読の恋愛場面を実対面の後に順番に読む。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, restore = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async restore => {
    window.M = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      romance: await import("./js/daily/romance.js"), phone: await import("./js/daily/phone.js"),
      data: await import("./js/core/data.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"),
    };
    M.fresh = id => {
      const s = M.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 5, slot: 2 });
      s.lovers = [id]; s.loveLevel[id] = 1; s.lovePts[id] = 9; s.loverSince[id] = 16;
      s.met[id] = true; s.contacts.push(id);
      if (id === "minto") s.flags._minto_name_known = s.flags._minto_identity_revealed = true;
      M.vn.backlog().length = 0;
      return s;
    };
    if (restore) M.core.load();
    else M.fresh("minto");
    M.ch1.setupHooks(); M.vn.vnTest.turbo = true; M.vn.vnTest.choose = () => 0;
    M.events = []; M.snap = () => structuredClone(M.core.state);
    const enter = M.vn.hooks.onEnter;
    M.vn.hooks.onEnter = (id, scene) => { M.events.push(id); enter?.(id, scene); };
  }, restore);
}

await suite("lover-milestones", async check => {
  await check("normal-play-exp-notice-without-board", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const growth = await import("./js/core/growth.js"), hud = await import("./js/daily/hud.js"), ui = await import("./js/core/ui.js");
      growth.setGrowthPreview(false); const s = M.fresh("rin"), before = { ...s.stats };
      ui.showScreen("map", document.createElement("div")); hud.initHud({}); hud.showHud(true);
      await M.romance.playLoverMilestone("rin");
      return { before, after: s.stats, xp: s.growth.xp, level: s.growth.level, hidane: growth.hidaneTotal(),
        menu: growth.growthMenuItems(), board: await growth.openGrowthBoard(), night: growth.settleGrowth() };
    });
    const notice = page.locator(".toast").filter({ hasText: "EXP +25（累計 25）" });
    await notice.waitFor();
    assert.deepEqual(result.after, result.before); assert.equal(result.xp, 25);
    assert.equal(result.level, 1); assert.equal(result.hidane, 0);
    assert.deepEqual(result.menu, []); assert.equal(result.board, null); assert.equal(result.night, null);
    assert.equal(await page.locator('[data-test="hud-exp"]').isVisible(), false);
    assert.equal(await page.locator('[data-test="hud-hidane"]').isVisible(), false);
    assert.equal(await page.locator(".gain-card.stat").count(), 0);
  }, { reducedMotion: "reduce" });

  await check("milestone-exp-notice", async page => {
    await setup(page);
    await page.evaluate(async () => {
      const growth = await import("./js/core/growth.js");
      growth.setGrowthPreview(true); M.fresh("rin");
      const hud = await import("./js/daily/hud.js"), ui = await import("./js/core/ui.js");
      ui.showScreen("map", document.createElement("div"));
      hud.initHud({}); hud.showHud(true);
      await M.romance.playLoverMilestone("rin");
    });
    const chip = page.locator('[data-test="exp-chip"]');
    await chip.waitFor();
    assert.match(await chip.textContent(), /EXP\s*\+25/);
    assert.equal(await page.locator(".gain-card.stat").count(), 0);
    assert.doesNotMatch(await page.evaluate(() => M.vn.backlog().map(line => line.text).join(" ")), /【(?:技術|センス|根性|魅力|洞察)】.*上が/);
  }, { reducedMotion: "reduce" });

  await check("exp-only-all-milestones", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const growth = await import("./js/core/growth.js"), bus = await import("./js/core/bus.js");
      const records = [], gains = [];
      bus.on("stat-gain", payload => gains.push(payload));
      for (const enabled of [false, true]) {
        growth.setGrowthPreview(enabled);
        for (const id of ["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan", "hiyori"]) {
          let s = M.fresh(id); s.loveLevel[id] = 5; s.lovePts[id] = 72;
          s.flags._intro_samechan = s.flags._samechan_nickname_known = true;
          const before = { ...s.stats }, xp = { ...s.statXp };
          for (let level = 1; level <= 5; level++) {
            // 能力候補が精算される消耗ありの行動内でも、節目は経験値のみ。
            await M.stats.paidAction(async () => {
              await M.romance.playLoverMilestone(id); M.stats.addStamina(-1);
            });
            M.core.save(); M.core.load(); s = M.core.state;
          }
          const earned = s.growth?.xp || 0;
          await M.vn.play(`lover_${id}_lv1`); // 開発口で直接再読しても付け直さない。
          records.push({ enabled, id, before, after: { ...s.stats }, xp, afterXp: { ...s.statXp },
            earned, repeated: s.growth?.xp || 0, seen: s.loverEventsSeen.length });
        }
        // ひよりはLv1〜5に加え、Lv2以降の専用場面もデート後に一度読む。
        const hiyori = await import("./js/daily/hiyori.js");
        const s = M.fresh("hiyori"); s.loveLevel.hiyori = 2; s.flags._hiyori_work_talk_done = true;
        const before = { ...s.stats }, xp = { ...s.statXp };
        await hiyori.playHiyoriEvent("feelings_spoken");
        const earned = s.growth?.xp || 0;
        await M.vn.play("hiyori_feelings_spoken");
        records.push({ enabled, id: "hiyori_feelings_spoken", before, after: { ...s.stats }, xp, afterXp: { ...s.statXp },
          earned, repeated: s.growth?.xp || 0, seen: Number(!!s.flags._hiyori_feelings_spoken) });
      }
      return { records, gains };
    });
    assert.equal(result.records.length, 16);
    for (const r of result.records) {
      assert.deepEqual(r.after, r.before, `${r.id}: ability changed`);
      assert.deepEqual(r.afterXp, r.xp, `${r.id}: ability progress changed`);
      assert.equal(r.earned, r.id === "hiyori_feelings_spoken" ? 25 : 125, `${r.id}: chapter-2 initial reads (preview=${r.enabled})`);
      assert.equal(r.repeated, r.earned, `${r.id}: replay reward`);
      assert.equal(r.seen, r.id === "hiyori_feelings_spoken" ? 1 : 5);
    }
    assert.deepEqual(result.gains, []);
  }, { reducedMotion: "reduce" });

  for (const enabled of [false, true]) await check(`exp-cancel-load-and-legacy-${enabled}`, async page => {
    await setup(page);
    const result = await page.evaluate(async enabled => {
      const growth = await import("./js/core/growth.js");
      growth.setGrowthPreview(enabled);
      let s = M.fresh("rin");
      const abort = new AbortController();
      M.vn.vnTest.turbo = false;
      const pending = M.romance.playLoverMilestone("rin", { signal: abort.signal });
      abort.abort(); await pending;
      const cancelled = { xp: s.growth?.xp || 0, seen: [...s.loverEventsSeen], stats: { ...s.stats } };
      M.vn.vnTest.turbo = true;
      await M.romance.playLoverMilestone("rin");
      const completed = s.growth.xp;
      M.core.save(); M.core.load();
      await M.vn.play("lover_rin_lv1");
      const loaded = M.core.state.growth.xp;
      s = M.fresh("rin"); s.loverEventsSeen = ["lover_rin_lv1"];
      M.core.save(); M.core.load(); await M.vn.play("lover_rin_lv1");
      const legacy = M.core.state.growth?.xp || 0;
      s = M.fresh("rin"); M.vn.vnTest.turbo = false;
      const old = M.vn.play("lover_rin_lv1");
      M.fresh("rin"); M.vn.vnTest.turbo = true;
      // 消滅したownerの会話を最後まで送っても新しいセーブへ付けない。
      while (M.vn.isPlaying()) { document.querySelector('[data-test="vn-auto"]')?.click(); await new Promise(r => setTimeout(r, 20)); }
      await old;
      return { cancelled, completed, loaded, legacy, stale: M.core.state.growth?.xp || 0 };
    }, enabled);
    assert.equal(result.cancelled.xp, 0); assert.deepEqual(result.cancelled.seen, []);
    assert.equal(result.completed, 25); assert.equal(result.loaded, 25);
    assert.equal(result.legacy, 0); assert.equal(result.stale, 0);
  }, { reducedMotion: "reduce" });

  for (const [mode, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    const opts = { ...options, reducedMotion: "reduce" };
    const press = (page, selector) => options.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();

    for (const id of ["tsumugi", "minto", "rin"]) {
      await check(`${mode}-${id}-lime-level-before-date`, async page => {
        await setup(page);
        await page.evaluate(id => {
          const s = M.fresh(id), account = id === "minto" ? "minto_private" : id;
          s.lovePts[id] = 19; s.loverEventsSeen = [`lover_${id}_lv1`];
          const msg = { id: `qa_lime_${id}`, sender: id, lover: true, type: "chat", messages: ["明日も会える？"],
            replies: [{ text: "うん、会おう", response: "楽しみだね", affinity: 1 }] };
          s.inbox.push({ id: msg.id, originId: msg.id, day: s.day, account, msg,
            read: false, done: false, replyState: "waiting", log: [] });
          M.session = M.phone.openLime({ sender: account });
        }, id);
        await page.locator('[data-test="reply-0"]').waitFor();
        await press(page, '[data-test="reply-0"]');
        await press(page, '[data-test="phone-next"]'); await press(page, '[data-test="phone-close"]');
        const result = await page.evaluate(async id => {
          await M.session;
          const before = M.snap();
          await M.stats.paidAction(() => M.romance.playDate(id), { budget: 1, points: 2 });
          const after = M.snap(); M.core.load();
          const again = await M.romance.playLoverMilestone(id);
          return { before, after, loaded: M.snap(), again, events: M.events, privateAfter: M.stats.bond.private };
        }, id);
        assert.equal(result.before.loveLevel[id], 2, "LIME must cross the actual bond threshold");
        assert.deepEqual(result.before.loverEventsSeen, [`lover_${id}_lv1`]);
        assert.equal(result.after.loveLevel[id], 2, "Date must recover the event without another level-up");
        assert.deepEqual(result.after.loverEventsSeen, [`lover_${id}_lv1`, `lover_${id}_lv2`]);
        assert.equal(result.events.filter(event => event === `lover_${id}_lv2`).length, 1);
        assert(!result.again && !result.privateAfter);
        assert.deepEqual(result.loaded.loverEventsSeen, result.after.loverEventsSeen);
        assert.equal(result.loaded.lovePts[id], result.after.lovePts[id]);
      }, opts);
    }

    await check(`${mode}-legacy-high-level-all-common-routes`, async page => {
      await setup(page);
      const records = await page.evaluate(async () => {
        const records = [];
        for (const id of ["tsumugi", "minto", "rin", "ageha", "mashiro"]) {
          const s = M.fresh(id); s.schema = 5; s.loveLevel[id] = 5; s.lovePts[id] = 72;
          s.loveCarry[id] = .5; s.guilt = 3;
          s.inbox.push({ id: "preserved", msg: { sender: id, type: "chat", messages: ["記録"] }, read: true, done: true, log: [] });
          M.core.save(); M.core.load();
          const before = M.snap(), due = [], reads = [], counts = [];
          M.events.length = 0;
          for (let n = 1; n <= 5; n++) {
            due.push(M.romance.loverMilestoneDue(id));
            reads.push(await M.romance.playLoverMilestone(id));
            M.core.load(); counts.push(M.core.state.loverEventsSeen.length);
          }
          const after = M.snap(), again = await M.romance.playLoverMilestone(id);
          records.push({ id, before, after, due, reads, counts, again, events: M.events.slice(), privateAfter: M.stats.bond.private });
        }
        return records;
      });
      for (const r of records) {
        const expected = [1, 2, 3, 4, 5].map(n => `lover_${r.id}_lv${n}`);
        assert.deepEqual(r.due, expected); assert.deepEqual(r.events, expected);
        assert.deepEqual(r.counts, [1, 2, 3, 4, 5]); assert(r.reads.every(Boolean));
        assert.deepEqual(r.after.loverEventsSeen, expected); assert(!r.again && !r.privateAfter);
        assert.equal(r.after.lovePts[r.id], 72); assert.equal(r.after.loveCarry[r.id], .5);
        assert.deepEqual(r.after.stats, r.before.stats); assert.deepEqual(r.after.inbox, r.before.inbox);
        assert.deepEqual(r.after.lovers, r.before.lovers); assert.deepEqual(r.after.loverSince, r.before.loverSince);
        assert.equal(r.after.guilt, 3);
      }
    }, opts);

    await check(`${mode}-additional-scene-known-scenes-and-boundaries`, async page => {
      await setup(page);
      const result = await page.evaluate(async () => {
        let s = M.fresh("rin"); s.loveLevel.rin = 2;
        M.data.DB.dialogues.lover_rin_lv1_b = { dialogue_id: "lover_rin_lv1_b", metadata: { private_scene: true },
          lines: [{ speaker: "rin", text: "もう少し、話していこう" }] };
        const order = [];
        for (let n = 0; n < 3; n++) { order.push(M.romance.loverMilestoneDue("rin")); await M.romance.playLoverMilestone("rin"); }
        const noNext = await M.romance.playLoverMilestone("rin");
        s.loverEventsSeen = ["lover_rin_lv1", "lover_rin_lv1_b", "lover_rin_lv3"]; s.loveLevel.rin = 5;
        const gap = M.romance.loverMilestoneDue("rin"); await M.romance.playLoverMilestone("rin");
        const next = M.romance.loverMilestoneDue("rin");
        const checks = [];
        for (const kind of ["friend", "low-level", "missing-scene", "empty-additional-scene", "future-chapter"]) {
          s = M.fresh("rin"); s.loveLevel.rin = 2;
          if (kind === "friend") { s.lovers = []; s.flags._friend_rin = true; }
          if (kind === "low-level") s.loveLevel.rin = 0;
          const base = M.data.DB.dialogues.lover_rin_lv1, extra = M.data.DB.dialogues.lover_rin_lv1_b;
          if (kind === "missing-scene") delete M.data.DB.dialogues.lover_rin_lv1;
          if (kind === "empty-additional-scene") { s.loverEventsSeen = ["lover_rin_lv1"]; M.data.DB.dialogues.lover_rin_lv1_b = { lines: [] }; }
          if (kind === "future-chapter") M.data.DB.dialogues.lover_rin_lv1 = { ...base, metadata: { min_chapter: 3 } };
          const before = M.snap(), played = await M.romance.playLoverMilestone("rin");
          checks.push({ kind, before, played, after: M.snap() });
          M.data.DB.dialogues.lover_rin_lv1 = base; M.data.DB.dialogues.lover_rin_lv1_b = extra;
        }
        delete M.data.DB.dialogues.lover_rin_lv1_b;
        M.fresh("rin"); M.stats.bond.private = true;
        const played = await M.romance.playLoverMilestone("rin"), restoredPrivate = M.stats.bond.private;
        M.stats.bond.private = false;
        return { order, noNext, gap, next, checks, played, restoredPrivate };
      });
      assert.deepEqual(result.order, ["lover_rin_lv1", "lover_rin_lv1_b", "lover_rin_lv2"]);
      assert(!result.noNext); assert.equal(result.gap, "lover_rin_lv2"); assert.equal(result.next, "lover_rin_lv4");
      for (const r of result.checks) { assert(!r.played, r.kind); assert.deepEqual(r.after, r.before, r.kind); }
      assert(result.played && result.restoredPrivate);
    }, opts);

    await check(`${mode}-interrupted-milestone-remains-unread`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = M.fresh("minto"); s.loveLevel.minto = 2; s.lovePts.minto = 24;
        s.loverEventsSeen = ["lover_minto_lv1"]; M.core.save(); M.vn.vnTest.turbo = false;
        M.running = M.romance.playLoverMilestone("minto");
      });
      await page.waitForFunction(() => M.vn.isPlaying());
      const interrupted = await page.evaluate(async () => {
        const concurrent = await M.romance.playLoverMilestone("minto");
        M.core.save(); return { concurrent, saved: M.snap() };
      });
      assert(!interrupted.concurrent); assert.deepEqual(interrupted.saved.loverEventsSeen, ["lover_minto_lv1"]);
      await page.reload({ waitUntil: "load" });
      await page.locator('[data-test="title-new"]').waitFor(); await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page, true);
      const result = await page.evaluate(async () => {
        const before = M.snap(), played = await M.romance.playLoverMilestone("minto");
        M.core.load(); const after = M.snap(), again = await M.romance.playLoverMilestone("minto");
        return { before, played, after, again, events: M.events, privateAfter: M.stats.bond.private };
      });
      assert(result.played && !result.again && !result.privateAfter);
      assert.deepEqual(result.events, ["lover_minto_lv2"]);
      assert.deepEqual(result.after.loverEventsSeen, ["lover_minto_lv1", "lover_minto_lv2"]);
      assert.equal(result.after.lovePts.minto, result.before.lovePts.minto);
      assert.deepEqual(result.after.stats, result.before.stats); assert.equal(result.after.money, result.before.money);
    }, opts);
  }
});
