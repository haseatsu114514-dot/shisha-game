// #327 gates and #381 friend STATUS: production events, old saves and existing lovers.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    window.G = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      bonds: await import("./js/daily/bonds.js"), romance: await import("./js/daily/romance.js"),
      spots: await import("./js/daily/spots.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), status: await import("./js/daily/status.js") };
    G.ch1.setupHooks(); G.vn.vnTest.turbo = true;
    G.fresh = () => {
      const s = G.core.newGame(); Object.assign(s, { phase: "daily", day: 8, slot: 1 });
      for (const id of ["tsumugi", "minto", "rin"]) {
        s.met[id] = true; s.flags[`_intro_${id}`] = true;
      }
      s.flags._minto_identity_revealed = true;
      // #814: 固有会話を読み終えた状態から始め、♥3の質問ゲートだけを確かめる（最古未読/ハート解放は別のテスト）。
      Object.assign(s.story, { tsumugi: 6, minto: 5, rin: 3 }); // みんとは最後の1本を残し、早すぎる締めくくりを確かめる
      return s;
    };
    G.readGate = async id => {
      if (id === "tsumugi") {
        G.core.state.story.tsumugi = 3;
        await G.spots.visitChar(id); // fourth story + its question
      } else if (id === "minto") {
        await G.vn.play("ch1_minto_private_1");
        await G.bonds.afterStory("ch1_minto_private_1");
      } else {
        await G.spots.visitChar(id); // the fixture has read the third story; question completes here
      }
    };
  });
}

await suite("affinity-gates", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-lime-fraction-feedback-and-load`, async page => {
      await setup(page);
      await page.evaluate(async () => {
        const s = G.core.newGame(); s.met.naru = true; s.contacts.push("naru");
        s.story.naru = 1; s.affinity.naru = 9;
        s.inbox = [{ id: "qa814", day: s.day, read: true, done: false, log: [],
          msg: { id: "qa814", sender: "naru", type: "chat", replies: [{ text: "また話そう", affinity: 1, response: "またね" }] } }];
        G.phone = await import("./js/daily/phone.js");
        G.phoneDone = G.phone.openLime({ sender: "naru" });
      });
      const act = async selector => {
        const target = page.locator(selector);
        await target[options.hasTouch ? "tap" : "click"]();
      };
      await act('[data-test="reply-0"]');
      const feedback = page.locator(".lime-note").filter({ hasText: "♡ ほんの少し仲良くなった" });
      await feedback.waitFor(); assert.equal(await feedback.count(),1);
      await assertFits(page,".lime-note");
      await page.locator('[data-test="phone-next"]').waitFor();
      assert.equal(await page.locator(".gain-card.affinity").count(),0);
      const read = () => page.evaluate(() => ({ pts:G.core.state.affinity.naru, carry:G.core.state.affinityCarry.naru }));
      const after = await read(); assert.equal(after.pts,9); assert(Math.abs(after.carry-.2125)<1e-9);
      await act('[data-test="lime-back"]'); await act('[data-test="phone-close"]');
      await page.evaluate(async () => { await G.phoneDone; G.core.saveToSlot("suien_remake_slot1"); G.core.newGame(); G.core.loadFromSlot("suien_remake_slot1"); G.phoneDone=G.phone.openLime({sender:"naru"}); });
      await page.locator('[data-test="phone-next"]').waitFor();
      assert.equal(await feedback.count(),0,"history/LOAD must not replay a gain");
      assert.deepEqual(await read(),after);
      await act('[data-test="lime-back"]'); await act('[data-test="phone-close"]');
      await page.evaluate(async () => {
        await G.phoneDone;
        G.core.state.affinity.naru=19;
        const item=G.core.state.inbox[0]; item.done=false; item.log=[];
        G.phoneDone=G.phone.openLime({sender:"naru"});
      });
      await act('[data-test="reply-0"]');
      await page.locator('[data-test="phone-next"]').waitFor();
      assert.equal(await feedback.count(),1,"an unread story cannot suppress real fractional reply progress");
      assert.equal((await read()).pts,19);
      await act('[data-test="lime-back"]'); await act('[data-test="phone-close"]');
      await page.evaluate(() => G.phoneDone);
    }, options);

    await check(`${label}-questions-and-finales`, async page => {
      await setup(page);
      const rows = await page.evaluate(async () => {
        const out = [];
        for (const id of ["tsumugi", "minto", "rin"]) for (const value of [0, 1]) {
          let s = G.fresh(); s.story[id] = id === "minto" ? 4 : 3;
          s.affinity[id] = 30; s.fortune = { char: id };
          for (let i = 0; i < 20; i++) G.stats.gainAffinity(id, 10);
          const locked = { points: s.affinity[id], level: G.stats.affinityLevel(id),
            waiting: G.stats.affinityGateWaiting(id), fortune: s.fortune ?? null,
            held: s.flags[`_${id}_affinity_waiting_pts`] || 0, early: G.stats.releaseAffinity(id) };
          G.core.save(); G.core.newGame(); G.core.load(); s = G.core.state;
          G.vn.vnTest.choose = scene => scene.includes("bond_question") ? 1 - value : 0;
          await G.readGate(id);
          const opened = { points: s.affinity[id], level: G.stats.affinityLevel(id),
            waiting: G.stats.affinityGateWaiting(id), rescued: s.flags[`_${id}_affinity_stage_released_pts`] || 0,
            answer: s.romanceChoices[G.stats.AFFINITY_GATE_CHOICES[id]], due: s.flags._confession_due ?? null };
          const pts = s.affinity[id], romance = G.bonds.romanceValue(id);
          if (id === "rin") await G.bonds.playQuestionVisit(id);
          else await G.bonds.afterStory(G.bonds.BOND_QUESTIONS[id].host);
          const duplicate = { points: s.affinity[id], romance: G.bonds.romanceValue(id),
            release: G.stats.releaseAffinity(id) };
          G.core.save(); G.core.load(); s = G.core.state;
          const saved = { points: s.affinity[id], again: G.stats.releaseAffinity(id) };
          const earlyFinale = G.bonds.finaleDue(id);
          const earlyWhy = { story: s.story[id], level: G.stats.affinityLevel(id), question: G.bonds.questionVisitDue?.(id),
            finale: s.finales?.[id] ?? null, chapter: s.chapter, day: s.day, slot: s.slot, answer: s.romanceChoices[G.stats.AFFINITY_GATE_CHOICES[id]] ?? null };
          s.story[id] = G.spots.VISIT_SEQ[id].length; // explicit completed-history fixture for the finale
          G.stats.releaseAffinity(id); // no numeric credit is held behind these read flags
          G.stats.gainAffinity(id, 22);

          if (id === "tsumugi") s.flags._tsumugi_contest_submitted = true; // DAY11 fixed story is the chapter-1 relationship beat
          const ready = G.bonds.finaleDue(id);
          await G.bonds.playFinale(id);
          const gift = G.bonds.BOND_FINALES[id].gift;
          const finale = { route: s.finales[id].route, due: s.flags._confession_due ?? null,
            giftCount: s.owned.filter(x => x === gift).length, open: G.romance.romanceRouteOpen(id) };
          const seen = JSON.stringify(s.finales[id]);
          const replay = await G.bonds.playFinale(id);
          out.push({ id, value, locked, opened, duplicate, saved, pts, romance, earlyFinale, ready, finale,
            replay, stable: seen === JSON.stringify(s.finales[id]), held: s.flags[`_${id}_affinity_waiting_pts`] || 0, earlyWhy });
        }
        return out;
      });
      for (const r of rows) {
        assert.equal(r.locked.points, 204); assert.equal(r.locked.level, 5); assert(r.locked.waiting);
        assert.equal(r.locked.held, 0); assert.equal(r.locked.early, 0); assert.equal(r.locked.fortune, null);
        // Numeric hearts are independent; completion/finale prerequisites are still separate.
        assert.equal(r.opened.level, 5); assert(!r.opened.waiting);
        assert.equal(r.opened.rescued, 0);
        assert.equal(r.opened.answer.value, r.value); assert.equal(r.opened.due, null);
        assert.equal(r.duplicate.points, r.pts); assert.equal(r.duplicate.romance, r.romance);
        assert.equal(r.duplicate.release, 0); assert.equal(r.saved.points, r.pts); assert.equal(r.saved.again, 0);
        // 質問の直後はどの相手も締めくくりにならない。凛も #1752 で4つ目の固有会話が質問の後に入った。
        assert.equal(r.earlyFinale, false, JSON.stringify({ id: r.id, value: r.value, ...r.earlyWhy })); assert(r.ready); assert.equal(r.finale.route, r.value ? "romance" : "friend");
        assert.equal(r.finale.due, r.value ? r.id : null); assert.equal(r.finale.open, !!r.value);
        assert.equal(r.finale.giftCount, 1); assert(!r.replay && r.stable); assert.equal(r.held,0);
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-early-host-and-next-meeting`, async page => {
      await setup(page);
      const rows = await page.evaluate(async () => {
        const out = [];
        for (const id of ["tsumugi", "minto", "rin"]) {
          const s = G.fresh(); s.affinity[id] = 20;
          s.story[id] = id === "rin" ? 3 : 4;

          if (id === "minto") Object.assign(s.flags, { _minto_private_done: true, _minto_name_known: true });
          await G.bonds.afterStory(G.bonds.BOND_QUESTIONS[id].host);
          const early = !!s.romanceChoices[G.stats.AFFINITY_GATE_CHOICES[id]], pendingEarly = G.bonds.questionVisitDue(id);
          G.stats.gainAffinity(id, 16); // reach exactly ♥3 after the host story
          const pending = G.bonds.questionVisitDue(id), count = s.story[id];
          G.stats.gainAffinity(id, 100); G.vn.vnTest.choose = () => 0;
          await G.spots.visitChar(id);
          out.push({ id, early, pendingEarly, pending, count, afterCount: s.story[id],
            answer: s.romanceChoices[G.stats.AFFINITY_GATE_CHOICES[id]], rescued: s.flags[`_${id}_affinity_stage_released_pts`] || 0,
            level: G.stats.affinityLevel(id) });
        }
        return out;
      });
      for (const r of rows) {
        assert(!r.early && !r.pendingEarly && r.pending); assert.equal(r.afterCount, r.count);
        assert.equal(r.answer.value, 1); assert.equal(r.rescued,0);
        assert.equal(r.level,5);
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-legacy-pace-and-held-confession`, async page => {
      await setup(page);
      const result = await page.evaluate(async () => {
        const legacy = [];
        for (const id of ["tsumugi", "minto", "rin"]) for (const points of [33, 47, 66]) {
          let s = G.fresh(); s.affinity[id] = points; s.affinityCarry[id] = 0.7; s.stats.charm = 100;
          G.stats.gainAffinity(id, 10);
          const held = s.flags[`_${id}_affinity_waiting_pts`] || 0;
          G.core.save(); G.core.load(); s = G.core.state;
          const unchanged = s.affinity[id] === points + 10, carry = s.affinityCarry[id];
          // A saved choice alone is not completed reaction dialogue. Preserve it without synthesizing completion.
          s.romanceChoices[G.stats.AFFINITY_GATE_CHOICES[id]] = { char: id, value: 0, day: 7 };
          const rescued = G.stats.releaseAffinity(id);
          legacy.push({ id, points, unchanged, carry, held, rescued, after: s.affinity[id], level: G.stats.affinityLevel(id) });
        }
        let s = G.fresh(); s.story.rin = 0; s.affinity.rin = 66; s.flags._friend_rin = true;
        G.stats.gainAffinity("rin", 10); G.core.save(); G.core.load();
        const oldFriend = { points: G.core.state.affinity.rin, friend: G.core.state.flags._friend_rin,
          waiting: G.stats.affinityGateWaiting("rin"), answer: G.core.state.romanceChoices.bond_q1_rin ?? null };
        s = G.fresh(); s.story.minto = 0; G.stats.ensureAffinityLevel("minto", 5);
        const guarantee = s.flags._minto_affinity_waiting_pts || 0;
        G.stats.ensureAffinityLevel("minto", 5);
        const guaranteed = { points: s.affinity.minto, guarantee, second: s.flags._minto_affinity_waiting_pts || 0 };
        s.lovers = ["tsumugi", "rin"]; s.lovePts = { tsumugi: 9, rin: 20 }; s.loveLevel = { tsumugi: 1, rin: 2 };
        G.stats.gainAffinity("tsumugi", 10); const publicBond = s.lovePts.tsumugi;
        G.stats.bond.private = true; G.stats.gainAffinity("tsumugi", 10); G.stats.bond.private = false;
        s.affinity.minto = 66; s.flags._minto_name_known = true;
        s.finales.minto = { route: "romance", day: 7, chapter: 1 };
        s.romanceChoices.bond_q2_minto = { char: "minto", value: 1, day: 7 };
        s.flags._confession_due = "minto"; s.flags._confession_wait = 11; s.slot = 2;
        G.core.save(); G.core.load();
        const skipped = await G.romance.maybeConfession(() => { throw Error("Held confession played early"); });
        const saved = structuredClone(G.core.state);
        G.core.state.day = 11; G.vn.vnTest.choose = () => 0;
        const confessed = await G.romance.maybeConfession(async () => {});
        return { legacy, oldFriend, guaranteed, publicBond, skipped, saved, confessed,
          accepted: G.core.state.lovers, pending: G.core.state.flags._confession_due ?? null };
      });
      for (const r of result.legacy) {
        assert(r.unchanged); assert(r.carry >= 0 && r.carry < 1); assert.equal(r.held,0);
        assert.equal(r.rescued, 0); assert(r.level <= (r.points === 66 ? 5 : 4));
        assert.equal(r.after, r.points + 10);
      }
      assert.deepEqual(result.guaranteed, { points: 66, guarantee: 0, second: 0 });
      assert.deepEqual(result.oldFriend, { points: 74, friend: true, waiting: false, answer: null });
      assert.equal(result.publicBond, 9); assert.equal(result.saved.lovePts.tsumugi, 14);
      assert.deepEqual(result.saved.lovers, ["tsumugi", "rin"]); assert.equal(result.saved.lovePts.rin, 20);
      assert.equal(result.saved.flags._confession_due, "minto"); assert.equal(result.saved.flags._confession_wait, 11);
      assert(!result.skipped); assert(!result.saved.romanceChoices.bond_q1_minto);
      assert(result.confessed); assert.deepEqual(result.accepted, ["tsumugi", "rin", "minto"]);
      assert.equal(result.pending, null);
      await page.evaluate(() => {
        G.fresh().affinity.minto = 33; G.stats.gainAffinity("minto", 10); G.status.openStatus();
      });
      await page.locator('[data-tab="people"]').click();
      await page.getByText("関係を考える会話待ち", { exact: true }).waitFor();
      await assertFits(page, ".st-people, .pp-row, .pp-relation");
    }, { ...options, reducedMotion: "reduce" });
    await check(`${label}-friend-status`, async page => {
      await setup(page);
      const ids = ["sumi", "naru", "adam", "tsumugi", "minto", "rin", "hiyori"];
      await page.evaluate(ids => {
        const s = G.fresh();
        for (const id of ids) {
          s.met[id] = true; s.affinity[id] = 66;
          s.finales[id] = { route: "friend", day: 7, chapter: 1 };
        }
        // A pre-schema-8 save keeps recorded finales, legacy flags and acquired rewards.
        s.schema = 7; s.flags._friend_rin = true;
        s.flags._hiyori_tonari_return_done = true;
        s.owned.push("suyaki_sumi", "suyaki_naru", "suyaki_adam");
        G.core.save(); G.core.load();
        G.beforeStatus = JSON.stringify(G.core.state);
        G.beforeSave = localStorage.getItem(G.core.SAVE_KEY);
        G.status.openStatus();
      }, ids);
      await page.locator('[data-tab="people"]').click();
      const friends = await page.locator(".pp-row").evaluateAll(rows => rows.map(row => ({
        name: row.querySelector(".pp-name").textContent,
        friend: [...row.querySelectorAll(".pp-relation")].some(n => n.textContent === "友達"),
      })));
      assert.equal(friends.length, ids.length);
      assert(friends.every(row => row.friend), JSON.stringify(friends));
      // 一覧はモーダル本文内でスクロールする。各行を表示して欠けずに読めることを確認する。
      for (const [index] of friends.entries()) {
        const selector = `.pp-row:nth-of-type(${index + 1})`;
        await page.locator(selector).scrollIntoViewIfNeeded();
        await assertFits(page, `${selector}, ${selector} .pp-relation`);
      }
      await page.locator('[data-test="status-close"]').click();
      const preserved = await page.evaluate(() => ({
        state: JSON.stringify(G.core.state) === G.beforeStatus,
        save: localStorage.getItem(G.core.SAVE_KEY) === G.beforeSave,
        legacy: G.core.state.flags._friend_rin,
        gifts: G.core.state.owned.filter(id => ["suyaki_sumi", "suyaki_naru", "suyaki_adam"].includes(id)),
      }));
      assert(preserved.state && preserved.save && preserved.legacy);
      assert.deepEqual(preserved.gifts, ["suyaki_sumi", "suyaki_naru", "suyaki_adam"]);

      for (const [label, route, flag, lover, registered, expected] of [
        ["pending-romance", "romance", false, false, true, false],
        ["rejected-confession", "romance", true, false, true, true],
        ["existing-lover", "friend", true, true, true, false],
        ["unread-finale", null, false, false, true, false],
        ["legacy-flag-without-finale", null, true, false, true, false],
        ["unregistered-character", "friend", true, false, false, false],
      ]) {
        await page.evaluate(({ route, flag, lover, registered }) => {
          const s = G.fresh();
          s.affinity.rin = 66;
          if (route) s.finales.rin = { route, day: 7, chapter: 1 };
          if (flag) s.flags._friend_rin = true;
          if (lover) { s.lovers = ["rin"]; s.loveLevel.rin = 2; s.lovePts.rin = 20; }
          G.friendData = window.__remake.DB.friends.friends.rin;
          if (!registered) delete window.__remake.DB.friends.friends.rin;
          G.beforeStatus = JSON.stringify(s);
          G.status.openStatus();
        }, { route, flag, lover, registered });
        await page.locator('[data-tab="people"]').click();
        const result = await page.evaluate(() => {
          const row = [...document.querySelectorAll(".pp-row")].find(n => n.querySelector(".pp-name").textContent === "凛");
          return {
            friend: [...row.querySelectorAll(".pp-relation")].some(n => n.textContent === "友達"),
            settled: G.bonds.settledFriend("rin"),
            lover: row.classList.contains("lover"),
            unchanged: JSON.stringify(G.core.state) === G.beforeStatus,
          };
        });
        assert.equal(result.friend, expected, label);
        assert.equal(result.settled, expected, label);
        assert.equal(result.lover, lover, label);
        assert(result.unchanged, label);
        await page.locator('[data-test="status-close"]').click();
        await page.evaluate(() => { window.__remake.DB.friends.friends.rin = G.friendData; });
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${label}-male-finales-and-status`, async page => {
      await setup(page);
      for (const id of ["sumi", "naru", "adam"]) {
        const event = await page.evaluate(async id => {
          const s = G.fresh();
          s.met[id] = true; s.flags[`_intro_${id}`] = true;
          s.story[id] = (G.spots.VISIT_SEQ[id] || []).length;
          s.affinity[id] = 66;
          await G.spots.visitChar(id); // actual finale/gift path, not an injected route
          const gift = G.bonds.BOND_FINALES[id].gift;
          const before = JSON.stringify(s);
          const replay = await G.bonds.playFinale(id);
          G.status.openStatus();
          return { route: s.finales[id]?.route, gift, count: s.owned.filter(x => x === gift).length,
            replay, unchanged: JSON.stringify(s) === before };
        }, id);
        assert.equal(event.route, "friend", id); assert.equal(event.count, 1, id);
        assert(!event.replay && event.unchanged, id);
        await page.locator('[data-tab="people"]').click();
        const shown = await page.evaluate(id => {
          const expected = id === "sumi" ? "スミさん" : id === "naru" ? "なる" : "アダム";
          const row = [...document.querySelectorAll(".pp-row")].find(n => n.querySelector(".pp-name").textContent === expected);
          return !!row && [...row.querySelectorAll(".pp-relation")].some(n => n.textContent === "友達");
        }, id);
        assert(shown, `${id}: actual finale is missing friend STATUS`);
        await assertFits(page, ".pp-row, .pp-relation");
        await page.locator('[data-test="status-close"]').click();
      }
    }, { ...options, reducedMotion: "reduce" });
  }
});
