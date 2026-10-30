// #431 / old #337: chapter-2 fixtures exercise the live VN and saves, not chapter reachability.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, { restore = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator("#boot").waitFor({ state: "detached" });
  await page.evaluate(async restore => {
    window.K = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      samechan: await import("./js/daily/samechan.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), data: await import("./js/core/data.js"),
      romance: await import("./js/daily/romance.js"), phone: await import("./js/daily/phone.js"),
    };
    if (restore) K.core.load();
    else {
      const s = K.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 1, slot: 0, money: 100000 });
      Object.assign(s.flags, { _intro_samechan: true, _samechan_first_encounter: true, _samechan_nickname_known: true });
    }
    K.ch1.setupHooks(); K.vn.vnTest.turbo = true;
    K.vn.vnTest.choose = () => 0;
    K.snapshot = () => structuredClone(K.core.state);
    K.visit = async (slot = 0) => {
      const s = K.core.state;
      s.day++; s.slot = slot; s.stamina = 100;
      return (await K.stats.paidAction(() => K.samechan.visitSamechan(K.samechan.samechanSpot()))).value;
    };
  }, restore);
}

await suite("samechan-entry", async check => {
  for (const [mode, options] of [["pc", {}], ["touch", {
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  }]]) {
    for (const value of [1, 0]) {
      await check(`${mode}-${value ? "romance" : "friend"}-sequence`, async page => {
        await setup(page);
        const r = await page.evaluate(async value => {
          const s = K.core.state, events = []; s.affinity.samechan = 32;
          const enter = K.vn.hooks.onEnter;
          K.vn.hooks.onEnter = (id, scene) => { events.push(id); enter?.(id, scene); };
          K.vn.vnTest.choose = id => id === "samechan_shop_bond_question" ? 1 - value : value;
          for (let i = 0; i < 4; i++) await K.visit();
          const afterSeat = K.snapshot();
          await K.visit(); // an afternoon cannot play the closing scene
          const beforeClosing = K.snapshot();
          await K.visit(1);
          const afterClosing = K.snapshot();
          K.stats.gainAffinity("samechan", 100);
          const capped = K.snapshot();
          await K.visit();
          const afterQuestion = K.snapshot();
          const replay = await K.samechan.visitSamechan(K.samechan.samechanSpot());
          const repeated = K.snapshot();
          K.core.save(); K.core.newGame(); K.core.load();
          const loaded = K.snapshot();
          const log = K.vn.backlog().map(x => x.text).join(" ");
          const confession = K.romance.romanceRouteOpen("samechan");
          return { events, afterSeat, beforeClosing, afterClosing, capped, afterQuestion,
            replay, repeated, loaded, log, confession, name: K.data.displayName("samechan", K.core.state) };
        }, value);
        assert.deepEqual(r.events.slice(0, 4), ["samechan_shop_first", "samechan_shop_repeat_0",
          "samechan_shop_repeat_1", "samechan_shop_quiet_seat"]);
        assert(r.afterSeat.flags._samechan_quiet_seat_done);
        assert(!r.beforeClosing.flags._samechan_closing_check_done);
        assert(r.afterClosing.flags._samechan_closing_check_done);
        assert.equal(r.capped.affinity.samechan, r.afterClosing.affinity.samechan + 85);
        assert.equal(r.capped.flags._samechan_affinity_waiting_pts || 0,0);
        assert(r.afterQuestion.flags._samechan_bond_question_done);
        assert.equal(r.afterQuestion.romanceChoices.bond_q1_samechan.value, value);
        assert.equal(r.afterQuestion.romance.samechan || 0, value);
        assert.equal(r.afterQuestion.flags._samechan_affinity_stage_released_pts || 0,0);
        assert(r.afterQuestion.affinity.samechan >= 48);
        assert.equal(r.afterQuestion.money, 100000 - 7 * 3000);
        assert(r.replay); assert.deepEqual(r.repeated, r.afterQuestion);
        assert.equal(r.loaded.affinity.samechan, r.afterQuestion.affinity.samechan);
        assert.deepEqual(r.loaded.romanceChoices, r.afterQuestion.romanceChoices);
        assert(!r.afterQuestion.flags._samechan_name_known && !r.afterQuestion.flags._friend_samechan);
        assert.equal(r.name, "サメちゃん"); assert(!/波多野|泳ぐのは苦手|泳げ/.test(r.log)); // 本名と泳ぎが苦手な話は後の私的会話まで出さない（サメ映画の「サメが泳ぎ出す」は可）
        assert(!r.confession); assert.deepEqual(r.afterQuestion.lovers, []);
        assert(!r.afterQuestion.flags._confession_due);
      }, options);
    }

    await check(`${mode}-legacy-progress-is-not-new-reading`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const saved = K.snapshot(); saved.schema = 5; saved.story.samechan = 40;
        saved.affinity.samechan = 66; saved.lovers = ["rin"]; saved.lovePts.rin = 40;
        delete saved.romanceChoices;
        localStorage.setItem(K.core.SAVE_KEY, JSON.stringify(saved)); K.core.load();
        const before = K.snapshot(), first = K.samechan.samechanVisitDialogue();
        await K.visit(); const afterSeat = K.snapshot();
        await K.visit(1); await K.visit(); const after = K.snapshot();
        return { before, first, afterSeat, after };
      });
      assert.equal(r.first, "samechan_shop_quiet_seat");
      assert.deepEqual(r.before.romanceChoices, {});
      assert(!r.before.flags._samechan_quiet_seat_done && !r.before.flags._samechan_closing_check_done);
      assert(!r.afterSeat.flags._samechan_closing_check_done && !r.afterSeat.flags._samechan_name_known);
      assert(r.after.affinity.samechan >= 66); assert.equal(r.after.lovePts.rin, 40);
      assert.deepEqual(r.after.lovers, ["rin"]);
      assert.equal(r.after.romanceChoices.bond_q1_samechan.value, 1);
      assert(!r.after.flags._confession_due);
    }, options);

    await check(`${mode}-interrupted-visit-is-billed-once`, async page => {
      await setup(page);
      const before = await page.evaluate(() => {
        const s = K.core.state; s.story.samechan = 3; s.affinity.samechan = 32; s.money = 3000; s.stamina = 12; K.core.save();
        K.vn.vnTest.turbo = false;
        K.running = K.samechan.visitSamechan(K.samechan.samechanSpot());
        return { money: s.money, affinity: s.affinity.samechan || 0, carry: s.affinityCarry.samechan || 0 };
      });
      await page.waitForFunction(() => K.vn.isPlaying());
      const concurrent = await page.evaluate(() => K.samechan.visitSamechan(K.samechan.samechanSpot()));
      assert.equal(concurrent, false);
      await page.reload({ waitUntil: "load" });
      await setup(page, { restore: true });
      const r = await page.evaluate(async () => {
        const before = K.snapshot();
        await K.samechan.visitSamechan(K.samechan.samechanSpot());
        const after = K.snapshot();
        await K.samechan.visitSamechan(K.samechan.samechanSpot());
        return { before, after, repeated: K.snapshot() };
      });
      assert.equal(r.before.money, before.money);
      assert(!r.before.flags._samechan_quiet_seat_done);
      assert.equal(r.after.money, before.money - 3000); assert.equal(r.after.stamina, 0);
      assert(r.after.flags._samechan_quiet_seat_done);
      assert.equal(r.after.story.samechan, 4);
      // A 1-point visit keeps its 85% growth as fractional carry, even before a visible point.
      const gain = (r.after.affinity.samechan || 0) + (r.after.affinityCarry.samechan || 0)
        - before.affinity - before.carry;
      assert(Math.abs(gain - 0.85) < 1e-9, `Visit reward applied ${gain} times`);
      assert.deepEqual(r.repeated, r.after);
    }, options);

    await check(`${mode}-saved-answer-finishes-without-changing-relationship`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state;
        s.story.samechan = 5; s.affinity.samechan = 33;
        s.flags._samechan_quiet_seat_done = s.flags._samechan_closing_check_done = true;
        s.flags._samechan_affinity_waiting_pts = 40;
        // A choice really made before an interrupted question; completion is still unread.
        s.romanceChoices.bond_q1_samechan = { char: "samechan", value: 0, day: s.day };
        s.flags._samechan_visit = { stamp: `${s.chapter}:${s.day}:${s.slot}`,
          dialogue: "samechan_shop_bond_question", complete: false };
        K.core.save(); K.core.load();
        K.vn.vnTest.choose = () => { throw Error("A saved answer must not be asked again"); };
        await K.samechan.visitSamechan(K.samechan.samechanSpot());
        return { state: K.snapshot(), log: K.vn.backlog().map(x => x.text).join(" ") };
      });
      assert.equal(r.state.romanceChoices.bond_q1_samechan.value, 0);
      assert.equal(r.state.romance.samechan || 0, 0); assert(r.log.includes("友として"));
      assert(r.state.flags._samechan_bond_question_done);
      assert.equal(r.state.flags._samechan_affinity_stage_released_pts, 40);
      assert.deepEqual(r.state.lovers, []); assert(!r.state.flags._friend_samechan);
    }, options);

    await check(`${mode}-chapter-missing-script-and-existing-relationship-boundaries`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state, spot = K.samechan.samechanSpot(); s.chapter = 1;
        const before = K.snapshot(), chapter1 = await K.samechan.visitSamechan(spot);
        const after = K.snapshot(); s.chapter = 2; s.story.samechan = 3;
        s.affinity.samechan = 32; const scene = K.data.DB.dialogues.samechan_shop_quiet_seat;
        delete K.data.DB.dialogues.samechan_shop_quiet_seat;
        const missingBefore = K.snapshot(), missing = await K.samechan.visitSamechan(spot);
        const missingAfter = K.snapshot(); K.data.DB.dialogues.samechan_shop_quiet_seat = scene;
        s.flags._samechan_quiet_seat_done = s.flags._samechan_closing_check_done = true;
        s.affinity.samechan = 66; s.flags._friend_samechan = true;
        const friend = K.samechan.samechanVisitDialogue(); delete s.flags._friend_samechan;
        s.lovers.push("samechan"); const lover = K.samechan.samechanVisitDialogue();
        return { before, after, chapter1, missingBefore, missingAfter, missing, friend, lover };
      });
      assert.equal(r.chapter1, false); assert.deepEqual(r.after, r.before);
      assert.equal(r.missing, false); assert.deepEqual(r.missingAfter, r.missingBefore);
      assert.notEqual(r.friend, "samechan_shop_bond_question");
      assert.notEqual(r.lover, "samechan_shop_bond_question");
    }, options);
  }
});
