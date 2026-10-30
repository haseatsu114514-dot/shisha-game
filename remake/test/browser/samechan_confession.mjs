// #442 / old #338. Real chapter-2 modules/VN/save fixtures; later-chapter reachability is not implemented.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page, restore = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async restore => {
    window.K = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      samechan: await import("./js/daily/samechan.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), data: await import("./js/core/data.js"),
      romance: await import("./js/daily/romance.js"), bonds: await import("./js/daily/bonds.js"),
      phone: await import("./js/daily/phone.js"), shop: await import("./js/daily/shop.js"),
      score: await import("./js/craft/score.js"),
    };
    if (restore) K.core.load();
    else {
      const s = K.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 1, slot: 0, money: 100000 });
      s.flags._intro_samechan = s.flags._samechan_nickname_known = true;
      s.met.samechan = true; s.contacts.push("samechan");
    }
    K.ch1.setupHooks(); K.vn.vnTest.turbo = true; K.vn.vnTest.choose = () => 0;
    K.snap = () => structuredClone(K.core.state);
    K.visit = async slot => {
      const s = K.core.state; s.day++; s.slot = slot; s.stamina = 100;
      const result = await K.stats.paidAction(() => K.samechan.visitSamechan(K.samechan.samechanSpot()));
      K.core.save(); return result.value;
    };
    // Focused fixtures model a genuinely recorded earlier answer, never derived from affinity/story.
    K.ready = (value = 1) => {
      const s = K.core.state; s.story.samechan = 6; s.affinity.samechan = 66; s.slot = 1;
      Object.assign(s.flags, { _samechan_quiet_seat_done: true, _samechan_closing_check_done: true,
        _samechan_bond_question_done: true });
      s.romanceChoices.bond_q1_samechan = { char: "samechan", value, day: s.day };
      s.romance.samechan = value; return s;
    };
  }, restore);
}

await suite("samechan-confession", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  const modes = [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]];
  for (const [mode, opts] of modes) {
    const options = { ...opts, reducedMotion: "reduce" };
    for (const [label, q1, q2, reply] of [["early-friend", 0, 0, 0], ["final-friend", 1, 0, 0],
      ["accept", 1, 1, 0], ["reject", 1, 1, 1]]) {
      await check(`${mode}-${label}-sequence`, async page => {
        await setup(page);
        const r = await page.evaluate(async ({ q1, q2, reply }) => {
          const s = K.core.state; s.story.samechan = 3; s.affinity.samechan = 66;
          const events = [], original = K.vn.hooks.onEnter;
          K.vn.hooks.onEnter = (id, scene) => { events.push(id); original?.(id, scene); };
          K.vn.vnTest.choose = id => id === "samechan_shop_bond_question" ? 1 - q1
            : id === "samechan_bond_finale" ? 1 - q2 : id === "confession_samechan" ? reply : 0;
          const start = K.samechan.samechanVisitDialogue();
          await K.visit(0); await K.visit(1); await K.visit(0);
          const beforeFinale = K.snap();
          const noon = K.samechan.samechanVisitDialogue(); await K.visit(1);
          const finale = K.snap(), sameVisit = await K.samechan.visitSamechan(K.samechan.samechanSpot());
          const repeated = K.snap(); s.slot = 2;
          const confessed = await K.romance.maybeConfession(async () => {}, { busyNight: true, companion: "samechan" });
          const again = await K.romance.maybeConfession(async () => {});
          const final = K.snap(); K.core.save(); K.core.newGame(); K.core.load();
          return { start, noon, beforeFinale, finale, sameVisit, repeated, confessed, again,
            final, loaded: K.snap(), events, log: K.vn.backlog().map(x => x.text).join(" ") };
        }, { q1, q2, reply });
        assert.equal(r.start, "samechan_shop_quiet_seat");
        assert.deepEqual(r.events.slice(0, 5), ["samechan_shop_quiet_seat", "samechan_shop_closing_check",
          "samechan_cinema_introduction", "samechan_shop_bond_question", "samechan_bond_finale"]);
        assert.equal(r.beforeFinale.romanceChoices.bond_q1_samechan.value, q1);
        assert(!r.beforeFinale.finales.samechan); assert.notEqual(r.noon, "samechan_bond_finale");
        assert.equal(r.finale.finales.samechan.route, q1 && q2 ? "romance" : "friend");
        assert.equal(r.finale.romanceChoices.bond_q2_samechan?.value ?? null, q1 ? q2 : null);
        assert(r.sameVisit); assert.deepEqual(r.repeated, r.finale);
        assert.equal(r.finale.money, 100000 - 4 * 3000);
        assert.equal(r.final.owned.filter(x => x === "suyaki_samechan").length, 1);
        assert.equal(r.confessed, !!(q1 && q2)); assert.equal(r.again, false);
        const lover = !!(q1 && q2 && !reply);
        assert.equal(r.final.lovers.includes("samechan"), lover);
        assert.equal(!!r.final.flags._friend_samechan, !!(q1 && q2 && reply));
        if (lover) {
          assert.equal(r.final.loveLevel.samechan, 1); assert.equal(r.final.lovePts.samechan, 12);
          assert(r.final.loverEventsSeen.includes("lover_samechan_lv1"));
          assert.equal(r.final.loverSince.samechan, 19);
        }
        assert.deepEqual(r.loaded.lovers, r.final.lovers);
        assert.deepEqual(r.loaded.finales, r.final.finales);
        assert.deepEqual(r.loaded.romanceChoices, r.final.romanceChoices);
        assert(!/波多野|泳/.test(r.log)); assert(!r.final.flags._samechan_name_known);
      }, options);
    }

    await check(`${mode}-defer-busy-night-and-multiple-relationships`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.ready(); await K.visit(1); s.slot = 2;
        const busy = await K.romance.maybeConfession(async () => {}, { busyNight: true, companion: "minto" });
        K.vn.vnTest.choose = () => 1;
        const defer = await K.romance.maybeConfession(async () => {}), deferred = K.snap();
        s.day++; const wait = await K.romance.maybeConfession(async () => {});
        s.day++; s.lovers.push("rin"); s.loveLevel.rin = 3; s.lovePts.rin = 34;
        s.loverSince.rin = 4; s.loveCarry.rin = 0.5;
        const stay = await K.romance.maybeConfession(async () => {}), stayed = K.snap();
        s.day += 3; K.vn.vnTest.choose = () => 0;
        const accept = await K.romance.maybeConfession(async () => {}), accepted = K.snap();
        const shuraba = await K.romance.maybeShuraba();
        const afterShuraba = K.snap();
        // Existing chapter-1 participating pair still has its original scene; shark alone never supplies a pair.
        s.lovers.push("tsumugi"); const ch1Pair = await K.romance.maybeShuraba();
        const ch1Guilt = s.guilt, repeat = await K.romance.maybeShuraba();
        K.core.save(); K.core.load();
        return { busy, defer, deferred, wait, stay, stayed, accept, accepted, shuraba, afterShuraba,
          ch1Pair, ch1Guilt, repeat, loaded: K.snap() };
      });
      assert(!r.busy && r.defer && !r.wait && r.stay && r.accept);
      assert.equal(r.deferred.flags._confession_due, "samechan"); assert.deepEqual(r.deferred.lovers, []);
      assert.equal(r.stayed.guilt, 0); assert.deepEqual(r.stayed.lovers, ["rin"]);
      assert.deepEqual(r.accepted.lovers, ["rin", "samechan"]); assert.equal(r.accepted.guilt, 3);
      assert.equal(r.accepted.loveLevel.rin, 3); assert.equal(r.accepted.lovePts.rin, 34);
      assert.equal(r.accepted.loveCarry.rin, 0.5); assert.equal(r.accepted.loverSince.rin, 4);
      assert(!r.shuraba); assert.deepEqual(r.afterShuraba, r.accepted);
      assert(r.ch1Pair && !r.repeat); assert.equal(r.ch1Guilt, 4);
      assert.deepEqual(r.loaded.lovers, ["rin", "samechan", "tsumugi"]);
    }, options);

    await check(`${mode}-legacy-and-existing-relationship-preservation`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const out = [];
        for (const kind of ["unanswered", "friend", "lover"]) {
          const saved = K.core.newState(); Object.assign(saved, { schema: 5, chapter: 2, phase: "daily", day: 1, slot: 1 });
          saved.story.samechan = 40; saved.affinity.samechan = 72; saved.affinityCarry.samechan = 0.6;
          saved.flags._intro_samechan = saved.flags._samechan_nickname_known = true;
          if (kind === "friend") saved.flags._friend_samechan = true;
          if (kind === "lover") {
            saved.lovers = ["samechan"]; saved.lovePts.samechan = 49; saved.loveLevel.samechan = 4;
            saved.loverSince.samechan = 9; saved.loveCarry.samechan = 0.5;
          }
          delete saved.romanceChoices; delete saved.finales;
          localStorage.setItem(K.core.SAVE_KEY, JSON.stringify(saved)); K.core.load();
          const before = K.snap(), first = K.samechan.samechanVisitDialogue();
          await K.visit(0); await K.visit(1); const next = K.samechan.samechanVisitDialogue();
          if (kind === "unanswered") await K.visit(0);
          await K.visit(1); out.push({ kind, before, first, next, after: K.snap() });
        }
        return out;
      });
      for (const x of r) {
        assert.deepEqual(x.before.romanceChoices, {}); assert.deepEqual(x.before.finales, {});
        assert.equal(x.first, "samechan_shop_quiet_seat"); assert(x.after.affinity.samechan >= 72);
        assert.equal(x.next, x.kind === "unanswered" ? "samechan_shop_bond_question" : "samechan_bond_finale");
        assert.equal(x.after.owned.filter(x => x === "suyaki_samechan").length, 1);
        assert.equal(x.after.finales.samechan.route, x.kind === "unanswered" ? "romance" : x.kind);
        if (x.kind !== "unanswered") assert.deepEqual(x.after.romanceChoices, {});
        if (x.kind === "friend") assert(x.after.flags._friend_samechan && !x.after.lovers.length);
        if (x.kind === "lover") {
          assert.deepEqual(x.after.lovers, ["samechan"]); assert.equal(x.after.lovePts.samechan, 49);
          assert.equal(x.after.loveLevel.samechan, 4); assert.equal(x.after.loveCarry.samechan, 0.5);
          assert.equal(x.after.loverSince.samechan, 9); assert.equal(x.after.affinityCarry.samechan, 0.6);
        }
      }
    }, options);

    await check(`${mode}-saved-final-answer-payment-and-gift-once`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.ready(); s.money = 3000; s.stamina = 12;
        s.romanceChoices.bond_q2_samechan = { char: "samechan", value: 1, day: s.day }; s.romance.samechan = 2;
        s.flags._samechan_visit = { stamp: `${s.chapter}:${s.day}:${s.slot}`, dialogue: "samechan_bond_finale", complete: false };
        K.core.save(); K.core.load(); K.vn.vnTest.choose = () => { throw Error("A saved final answer was asked again"); };
        await K.samechan.visitSamechan(K.samechan.samechanSpot());
        const after = K.snap(), persistedBeforeAction = JSON.parse(localStorage.getItem(K.core.SAVE_KEY));
        await K.samechan.visitSamechan(K.samechan.samechanSpot()); const repeated = K.snap();
        K.core.save(); K.core.load(); const loaded = K.snap();
        // Further encounters never give a duplicate gift.
        const finaleAgain = await K.bonds.playFinale("samechan");
        return { after, persistedBeforeAction, repeated, loaded, finaleAgain,
          sellable: K.shop.sellable(K.data.DB.equipById.suyaki_samechan),
          bonus: K.score.giftBowlEffect({ equip: { bowl: "suyaki_samechan" }, mix: { mint: 12 } }) };
      });
      assert.equal(r.after.money, 0); assert.equal(r.after.stamina, 0); assert.equal(r.after.story.samechan, 7);
      assert.equal(r.after.romance.samechan, 2); assert.equal(r.after.finales.samechan.route, "romance");
      assert.equal(r.after.flags._confession_due, "samechan");
      assert.equal(r.persistedBeforeAction.money, 3000); assert(!r.persistedBeforeAction.finales.samechan);
      assert(!r.persistedBeforeAction.owned.includes("suyaki_samechan"));
      assert.deepEqual(r.repeated, r.after); assert.equal(r.loaded.money, 0);
      assert.equal(r.loaded.owned.filter(x => x === "suyaki_samechan").length, 1);
      assert(!r.finaleAgain && !r.sellable); assert.equal(r.bonus, null);
    }, options);

    await check(`${mode}-chapter-data-lime-and-friend-boundaries`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.ready(); const scene = K.data.DB.dialogues.samechan_bond_finale;
        s.chapter = 1; const chapter1 = K.bonds.finaleDue("samechan"); s.chapter = 2;
        s.flags._samechan_bond_question_done = false; const unread = K.bonds.finaleDue("samechan");
        s.flags._samechan_bond_question_done = true;
        delete K.data.DB.dialogues.samechan_bond_finale; const missing = K.bonds.finaleDue("samechan");
        K.data.DB.dialogues.samechan_bond_finale = scene;
        await K.visit(1); s.slot = 2; await K.romance.maybeConfession(async () => {});
        const before = K.snap(); s.day = 8; s.slot = 0;
        const sharkLime = K.romance.loverMessages().filter(m => m.sender === "samechan");
        s.lovers.push("mashiro"); s.loveLevel.mashiro = 1; s.lovePts.mashiro = 9;
        s.loverSince.mashiro = 18; s.limeRead.push("_lover_private_account_mashiro");
        const otherLime = K.romance.loverMessages().filter(m => m.sender === "mashiro");
        s.lovers = []; s.flags._friend_samechan = true;
        K.romance.onDialogueEnter("confession_samechan_accept", K.data.DB.dialogues.confession_samechan_accept);
        const friend = K.snap(); delete s.flags._friend_samechan;
        s.chapter = 4; const tooLate = K.romance.romanceRouteOpen("samechan");
        s.chapter = 2; delete s.romanceChoices.bond_q1_samechan;
        const fabricated = K.romance.romanceRouteOpen("samechan");
        return { chapter1, unread, missing, before, sharkLime, otherLime, friend, tooLate, fabricated };
      });
      assert(!r.chapter1 && !r.unread && !r.missing && !r.tooLate && !r.fabricated);
      assert.deepEqual(r.before.lovers, ["samechan"]);
      assert.equal(r.sharkLime.length, 1); assert.equal(r.sharkLime[0].id, "_lover_private_account_samechan");
      assert(r.otherLime.some(m => m.accept_event === "date_mashiro"));
      assert.deepEqual(r.friend.lovers, []); assert(r.friend.flags._friend_samechan);
    }, options);

    await check(`${mode}-interrupted-final-choice-reloads-without-reasking`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = K.ready(); s.money = 3000; s.stamina = 12;
        K.vn.vnTest.turbo = false; K.running = K.samechan.visitSamechan(K.samechan.samechanSpot());
      });
      const press = selector => opts.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
      await page.waitForFunction(() => K.vn.isPlaying());
      for (let i = 0; i < 80 && !await page.locator(".vn-choice").count(); i++) {
        await press(".vn-box"); await page.waitForTimeout(90);
      }
      await assertFits(page, ".vn-choice"); await press(".vn-choice:nth-child(2)");
      const interrupted = await page.evaluate(() => {
        K.core.save(); return K.snap(); // actual manual save after selecting friendship, before reading its reply
      });
      assert.equal(interrupted.romanceChoices.bond_q2_samechan.value, 0);
      assert.equal(interrupted.money, 3000); assert(!interrupted.finales.samechan);
      await page.reload({ waitUntil: "load" });
      await page.locator('[data-test="title-new"]').waitFor();
      await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page, true);
      const r = await page.evaluate(async () => {
        K.vn.vnTest.choose = () => { throw Error("The interrupted real choice was asked again"); };
        await K.samechan.visitSamechan(K.samechan.samechanSpot());
        K.core.save(); K.core.load(); return { state: K.snap(), log: K.vn.backlog().map(x => x.text).join(" ") };
      });
      assert.equal(r.state.money, 0); assert.equal(r.state.stamina, 0);
      assert.equal(r.state.romanceChoices.bond_q2_samechan.value, 0); assert.equal(r.state.romance.samechan, 1);
      assert.equal(r.state.finales.samechan.route, "friend"); assert(!r.state.flags._confession_due);
      assert.equal(r.state.owned.filter(x => x === "suyaki_samechan").length, 1);
      assert(r.log.includes("友として")); assert.deepEqual(r.state.lovers, []);
    }, options);

    await check(`${mode}-actual-final-choice-and-confession-controls`, async page => {
      await setup(page);
      await page.evaluate(() => {
        K.ready(); K.vn.vnTest.turbo = false;
        K.flowDone = false;
        K.running = K.samechan.visitSamechan(K.samechan.samechanSpot()).finally(() => { K.flowDone = true; });
      });
      const press = selector => opts.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
      // 会話が一瞬止まっても（CGの読み込みや次の場面への切り替え）、流れ全体が終わるまで進める。
      // 告白の後には恋人イベントが続くため、isPlaying だけで終わりと見なすと続きを誰も進めず止まる。
      async function finishChoices(selected) {
        let choices = 0;
        for (let i = 0; i < 200; i++) {
          if (await page.locator(".vn-choice").count()) {
            await assertFits(page, ".vn-choice");
            await press(`.vn-choice:nth-child(${selected + 1})`); choices++;
          } else if (await page.evaluate(() => !K.vn.isPlaying() && K.flowDone !== false)) break;
          else await press(".vn-box");
          await page.waitForTimeout(90);
        }
        return choices;
      }
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.equal(await finishChoices(0), 1);
      await page.evaluate(async () => { await K.running; K.core.save(); K.core.state.slot = 2;
        K.flowDone = false;
        K.confessing = K.romance.maybeConfession(async () => {}).finally(() => { K.flowDone = true; }); });
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.equal(await finishChoices(0), 2); // intention gate, then accept/reject
      const r = await page.evaluate(async () => { await K.confessing; return K.snap(); });
      assert.deepEqual(r.lovers, ["samechan"]); assert.equal(r.lovePts.samechan, 12);
      assert(r.loverEventsSeen.includes("lover_samechan_lv1"));
    }, options);
  }
});
