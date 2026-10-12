// #442 / old #338. Real chapter-2 modules/VN/save fixtures; later-chapter reachability is not implemented.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page, restore = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async restore => {
    window.K = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      kafuka: await import("./js/daily/kafuka.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), data: await import("./js/core/data.js"),
      romance: await import("./js/daily/romance.js"), bonds: await import("./js/daily/bonds.js"),
      phone: await import("./js/daily/phone.js"), shop: await import("./js/daily/shop.js"),
      score: await import("./js/craft/score.js"),
    };
    if (restore) K.core.load();
    else {
      const s = K.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 1, slot: 0, money: 100000 });
      s.flags._intro_kafuka = s.flags._kafuka_nickname_known = true;
      s.met.kafuka = true; s.contacts.push("kafuka");
    }
    K.ch1.setupHooks(); K.vn.vnTest.turbo = true; K.vn.vnTest.choose = () => 0;
    K.snap = () => structuredClone(K.core.state);
    K.visit = async slot => {
      const s = K.core.state; s.day++; s.slot = slot; s.stamina = 100;
      const result = await K.stats.paidAction(() => K.kafuka.visitKafuka(K.kafuka.kafukaSpot()));
      K.core.save(); return result.value;
    };
    // Focused fixtures model a genuinely recorded earlier answer, never derived from affinity/story.
    K.ready = (value = 1) => {
      const s = K.core.state; s.story.kafuka = 6; s.affinity.kafuka = 66; s.slot = 1;
      Object.assign(s.flags, { _kafuka_quiet_seat_done: true, _kafuka_closing_check_done: true,
        _kafuka_bond_question_done: true });
      s.romanceChoices.bond_q1_kafuka = { char: "kafuka", value, day: s.day };
      s.romance.kafuka = value; return s;
    };
  }, restore);
}

await suite("kafuka-confession", async check => {
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
          const s = K.core.state; s.story.kafuka = 3; s.affinity.kafuka = 66;
          const events = [], original = K.vn.hooks.onEnter;
          K.vn.hooks.onEnter = (id, scene) => { events.push(id); original?.(id, scene); };
          K.vn.vnTest.choose = id => id === "kafuka_shop_bond_question" ? 1 - q1
            : id === "kafuka_bond_finale" ? 1 - q2 : id === "confession_kafuka" ? reply : 0;
          const start = K.kafuka.kafukaVisitDialogue();
          await K.visit(0); await K.visit(1); await K.visit(0);
          const beforeFinale = K.snap();
          const noon = K.kafuka.kafukaVisitDialogue(); await K.visit(1);
          const finale = K.snap(), sameVisit = await K.kafuka.visitKafuka(K.kafuka.kafukaSpot());
          const repeated = K.snap(); s.slot = 2;
          const confessed = await K.romance.maybeConfession(async () => {}, { busyNight: true, companion: "kafuka" });
          const again = await K.romance.maybeConfession(async () => {});
          const final = K.snap(); K.core.save(); K.core.newGame(); K.core.load();
          return { start, noon, beforeFinale, finale, sameVisit, repeated, confessed, again,
            final, loaded: K.snap(), events, log: K.vn.backlog().map(x => x.text).join(" ") };
        }, { q1, q2, reply });
        assert.equal(r.start, "kafuka_shop_quiet_seat");
        assert.deepEqual(r.events.slice(0, 4), ["kafuka_shop_quiet_seat", "kafuka_shop_closing_check",
          "kafuka_shop_bond_question", "kafuka_bond_finale"]);
        assert.equal(r.beforeFinale.romanceChoices.bond_q1_kafuka.value, q1);
        assert(!r.beforeFinale.finales.kafuka); assert.notEqual(r.noon, "kafuka_bond_finale");
        assert.equal(r.finale.finales.kafuka.route, q1 && q2 ? "romance" : "friend");
        assert.equal(r.finale.romanceChoices.bond_q2_kafuka?.value ?? null, q1 ? q2 : null);
        assert(r.sameVisit); assert.deepEqual(r.repeated, r.finale);
        assert.equal(r.finale.money, 100000 - 4 * 3000);
        assert.equal(r.final.owned.filter(x => x === "suyaki_kafuka").length, 1);
        assert.equal(r.confessed, !!(q1 && q2)); assert.equal(r.again, false);
        const lover = !!(q1 && q2 && !reply);
        assert.equal(r.final.lovers.includes("kafuka"), lover);
        assert.equal(!!r.final.flags._friend_kafuka, !!(q1 && q2 && reply));
        if (lover) {
          assert.equal(r.final.loveLevel.kafuka, 1); assert.equal(r.final.lovePts.kafuka, 12);
          assert(r.final.loverEventsSeen.includes("lover_kafuka_lv1"));
          assert.equal(r.final.loverSince.kafuka, 19);
        }
        assert.deepEqual(r.loaded.lovers, r.final.lovers);
        assert.deepEqual(r.loaded.finales, r.final.finales);
        assert.deepEqual(r.loaded.romanceChoices, r.final.romanceChoices);
        assert(!/波多野|泳/.test(r.log)); assert(!r.final.flags._kafuka_name_known);
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
      assert.equal(r.deferred.flags._confession_due, "kafuka"); assert.deepEqual(r.deferred.lovers, []);
      assert.equal(r.stayed.guilt, 0); assert.deepEqual(r.stayed.lovers, ["rin"]);
      assert.deepEqual(r.accepted.lovers, ["rin", "kafuka"]); assert.equal(r.accepted.guilt, 3);
      assert.equal(r.accepted.loveLevel.rin, 3); assert.equal(r.accepted.lovePts.rin, 34);
      assert.equal(r.accepted.loveCarry.rin, 0.5); assert.equal(r.accepted.loverSince.rin, 4);
      assert(!r.shuraba); assert.deepEqual(r.afterShuraba, r.accepted);
      assert(r.ch1Pair && !r.repeat); assert.equal(r.ch1Guilt, 4);
      assert.deepEqual(r.loaded.lovers, ["rin", "kafuka", "tsumugi"]);
    }, options);

    await check(`${mode}-legacy-and-existing-relationship-preservation`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const out = [];
        for (const kind of ["unanswered", "friend", "lover"]) {
          const saved = K.core.newState(); Object.assign(saved, { schema: 5, chapter: 2, phase: "daily", day: 1, slot: 1 });
          saved.story.kafuka = 40; saved.affinity.kafuka = 72; saved.affinityCarry.kafuka = 0.6;
          saved.flags._intro_kafuka = saved.flags._kafuka_nickname_known = true;
          if (kind === "friend") saved.flags._friend_kafuka = true;
          if (kind === "lover") {
            saved.lovers = ["kafuka"]; saved.lovePts.kafuka = 49; saved.loveLevel.kafuka = 4;
            saved.loverSince.kafuka = 9; saved.loveCarry.kafuka = 0.5;
          }
          delete saved.romanceChoices; delete saved.finales;
          localStorage.setItem(K.core.SAVE_KEY, JSON.stringify(saved)); K.core.load();
          const before = K.snap(), first = K.kafuka.kafukaVisitDialogue();
          await K.visit(0); await K.visit(1); const next = K.kafuka.kafukaVisitDialogue();
          if (kind === "unanswered") await K.visit(0);
          await K.visit(1); out.push({ kind, before, first, next, after: K.snap() });
        }
        return out;
      });
      for (const x of r) {
        assert.deepEqual(x.before.romanceChoices, {}); assert.deepEqual(x.before.finales, {});
        assert.equal(x.first, "kafuka_shop_quiet_seat"); assert(x.after.affinity.kafuka >= 72);
        assert.equal(x.next, x.kind === "unanswered" ? "kafuka_shop_bond_question" : "kafuka_bond_finale");
        assert.equal(x.after.owned.filter(x => x === "suyaki_kafuka").length, 1);
        assert.equal(x.after.finales.kafuka.route, x.kind === "unanswered" ? "romance" : x.kind);
        if (x.kind !== "unanswered") assert.deepEqual(x.after.romanceChoices, {});
        if (x.kind === "friend") assert(x.after.flags._friend_kafuka && !x.after.lovers.length);
        if (x.kind === "lover") {
          assert.deepEqual(x.after.lovers, ["kafuka"]); assert.equal(x.after.lovePts.kafuka, 49);
          assert.equal(x.after.loveLevel.kafuka, 4); assert.equal(x.after.loveCarry.kafuka, 0.5);
          assert.equal(x.after.loverSince.kafuka, 9); assert.equal(x.after.affinityCarry.kafuka, 0.6);
        }
      }
    }, options);

    await check(`${mode}-saved-final-answer-payment-and-gift-once`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.ready(); s.money = 3000; s.stamina = 12;
        s.romanceChoices.bond_q2_kafuka = { char: "kafuka", value: 1, day: s.day }; s.romance.kafuka = 2;
        s.flags._kafuka_visit = { stamp: `${s.chapter}:${s.day}:${s.slot}`, dialogue: "kafuka_bond_finale", complete: false };
        K.core.save(); K.core.load(); K.vn.vnTest.choose = () => { throw Error("A saved final answer was asked again"); };
        await K.kafuka.visitKafuka(K.kafuka.kafukaSpot());
        const after = K.snap(), persistedBeforeAction = JSON.parse(localStorage.getItem(K.core.SAVE_KEY));
        await K.kafuka.visitKafuka(K.kafuka.kafukaSpot()); const repeated = K.snap();
        K.core.save(); K.core.load(); const loaded = K.snap();
        // Further encounters never give a duplicate gift.
        const finaleAgain = await K.bonds.playFinale("kafuka");
        return { after, persistedBeforeAction, repeated, loaded, finaleAgain,
          sellable: K.shop.sellable(K.data.DB.equipById.suyaki_kafuka),
          bonus: K.score.giftBowlEffect({ equip: { bowl: "suyaki_kafuka" }, mix: { mint: 12 } }) };
      });
      assert.equal(r.after.money, 0); assert.equal(r.after.stamina, 0); assert.equal(r.after.story.kafuka, 7);
      assert.equal(r.after.romance.kafuka, 2); assert.equal(r.after.finales.kafuka.route, "romance");
      assert.equal(r.after.flags._confession_due, "kafuka");
      assert.equal(r.persistedBeforeAction.money, 3000); assert(!r.persistedBeforeAction.finales.kafuka);
      assert(!r.persistedBeforeAction.owned.includes("suyaki_kafuka"));
      assert.deepEqual(r.repeated, r.after); assert.equal(r.loaded.money, 0);
      assert.equal(r.loaded.owned.filter(x => x === "suyaki_kafuka").length, 1);
      assert(!r.finaleAgain && !r.sellable); assert.equal(r.bonus, null);
    }, options);

    await check(`${mode}-chapter-data-lime-and-friend-boundaries`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.ready(); const scene = K.data.DB.dialogues.kafuka_bond_finale;
        s.chapter = 1; const chapter1 = K.bonds.finaleDue("kafuka"); s.chapter = 2;
        s.flags._kafuka_bond_question_done = false; const unread = K.bonds.finaleDue("kafuka");
        s.flags._kafuka_bond_question_done = true;
        delete K.data.DB.dialogues.kafuka_bond_finale; const missing = K.bonds.finaleDue("kafuka");
        K.data.DB.dialogues.kafuka_bond_finale = scene;
        await K.visit(1); s.slot = 2; await K.romance.maybeConfession(async () => {});
        const before = K.snap(); s.day = 8; s.slot = 0;
        const sharkLime = K.romance.loverMessages().filter(m => m.sender === "kafuka");
        s.lovers.push("mashiro"); s.loveLevel.mashiro = 1; s.lovePts.mashiro = 9;
        s.loverSince.mashiro = 18; s.limeRead.push("_lover_private_account_mashiro");
        const otherLime = K.romance.loverMessages().filter(m => m.sender === "mashiro");
        s.lovers = []; s.flags._friend_kafuka = true;
        K.romance.onDialogueEnter("confession_kafuka_accept", K.data.DB.dialogues.confession_kafuka_accept);
        const friend = K.snap(); delete s.flags._friend_kafuka;
        s.chapter = 4; const tooLate = K.romance.romanceRouteOpen("kafuka");
        s.chapter = 2; delete s.romanceChoices.bond_q1_kafuka;
        const fabricated = K.romance.romanceRouteOpen("kafuka");
        return { chapter1, unread, missing, before, sharkLime, otherLime, friend, tooLate, fabricated };
      });
      assert(!r.chapter1 && !r.unread && !r.missing && !r.tooLate && !r.fabricated);
      assert.deepEqual(r.before.lovers, ["kafuka"]); assert.deepEqual(r.sharkLime, []);
      assert(r.otherLime.some(m => m.accept_event === "date_mashiro"));
      assert.deepEqual(r.friend.lovers, []); assert(r.friend.flags._friend_kafuka);
    }, options);

    await check(`${mode}-interrupted-final-choice-reloads-without-reasking`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = K.ready(); s.money = 3000; s.stamina = 12;
        K.vn.vnTest.turbo = false; K.running = K.kafuka.visitKafuka(K.kafuka.kafukaSpot());
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
      assert.equal(interrupted.romanceChoices.bond_q2_kafuka.value, 0);
      assert.equal(interrupted.money, 3000); assert(!interrupted.finales.kafuka);
      await page.reload({ waitUntil: "load" });
      await page.locator('[data-test="title-new"]').waitFor();
      await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page, true);
      const r = await page.evaluate(async () => {
        K.vn.vnTest.choose = () => { throw Error("The interrupted real choice was asked again"); };
        await K.kafuka.visitKafuka(K.kafuka.kafukaSpot());
        K.core.save(); K.core.load(); return { state: K.snap(), log: K.vn.backlog().map(x => x.text).join(" ") };
      });
      assert.equal(r.state.money, 0); assert.equal(r.state.stamina, 0);
      assert.equal(r.state.romanceChoices.bond_q2_kafuka.value, 0); assert.equal(r.state.romance.kafuka, 1);
      assert.equal(r.state.finales.kafuka.route, "friend"); assert(!r.state.flags._confession_due);
      assert.equal(r.state.owned.filter(x => x === "suyaki_kafuka").length, 1);
      assert(r.log.includes("友として")); assert.deepEqual(r.state.lovers, []);
    }, options);

    await check(`${mode}-actual-final-choice-and-confession-controls`, async page => {
      await setup(page);
      await page.evaluate(() => {
        K.ready(); K.vn.vnTest.turbo = false;
        K.running = K.kafuka.visitKafuka(K.kafuka.kafukaSpot());
      });
      const press = selector => opts.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
      async function finishChoices(selected) {
        let choices = 0;
        for (let i = 0; i < 100; i++) {
          if (await page.locator(".vn-choice").count()) {
            await assertFits(page, ".vn-choice");
            await press(`.vn-choice:nth-child(${selected + 1})`); choices++;
          } else if (await page.evaluate(() => !K.vn.isPlaying())) break;
          else await press(".vn-box");
          await page.waitForTimeout(90);
        }
        return choices;
      }
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.equal(await finishChoices(0), 1);
      await page.evaluate(async () => { await K.running; K.core.save(); K.core.state.slot = 2;
        K.confessing = K.romance.maybeConfession(async () => {}); });
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.equal(await finishChoices(0), 2); // intention gate, then accept/reject
      const r = await page.evaluate(async () => { await K.confessing; return K.snap(); });
      assert.deepEqual(r.lovers, ["kafuka"]); assert.equal(r.lovePts.kafuka, 12);
      assert(r.loverEventsSeen.includes("lover_kafuka_lv1"));
    }, options);
  }
});
