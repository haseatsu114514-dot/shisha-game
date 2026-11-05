import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    window.H = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      ui: await import("./js/core/ui.js"), status: await import("./js/daily/status.js"),
      romance: await import("./js/daily/romance.js"), bonds: await import("./js/daily/bonds.js"),
      vn: await import("./js/vn/engine.js"), ch1: await import("./js/chapters/ch1.js") };
    H.ch1.setupHooks(); H.vn.vnTest.turbo = true;
    H.fresh = () => {
      const s = H.core.newGame(); Object.assign(s, { phase: "daily", day: 8, slot: 1 });
      for (const id of ["tsumugi", "minto", "kuyuri", "hiyori", "naru"]) s.met[id] = true;
      s.flags._minto_name_known = true; return s;
    };
  });
}

await suite("lover-hidden-growth", async check => {
  await check("tsumugi-finale-waits-for-chapter1-submission", async page => {
    await setup(page);
    const result = await page.evaluate(() => {
      const s = H.fresh();
      s.affinity.tsumugi = 66;
      s.story.tsumugi = 99;
      s.romanceChoices.bond_q1_tsumugi = { char: "tsumugi", value: 1, day: 4 };
      s.flags._tsumugi_affinity_question_done = true;
      const day8 = H.bonds.finaleDue("tsumugi");
      s.day = 11;
      const day11BeforeStory = H.bonds.finaleDue("tsumugi");
      s.flags._tsumugi_contest_submitted = true;
      const day11AfterStory = H.bonds.finaleDue("tsumugi");
      delete s.flags._tsumugi_contest_submitted;
      s.day = 12;
      const legacyDay12Fallback = H.bonds.finaleDue("tsumugi");
      s.chapter = 2; s.day = 3;
      const laterChapter = H.bonds.finaleDue("tsumugi");
      return { day8, day11BeforeStory, day11AfterStory, legacyDay12Fallback, laterChapter };
    });
    assert.deepEqual(result, {
      day8: false,
      day11BeforeStory: false,
      day11AfterStory: true,
      legacyDay12Fallback: true,
      laterChapter: true,
    });
  });

  for (const [mode, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${mode}-status-and-legacy-save`, async page => {
      await setup(page);
      for (const level of [1, 2, 3, 4, 5]) {
        await page.evaluate(level => {
          const s = H.fresh(); s.lovers = ["tsumugi", "kuyuri"];
          s.loveLevel = { tsumugi: level, kuyuri: 6 - level }; s.lovePts = { tsumugi: level * 12, kuyuri: 74 };
          s.loveCarry = { tsumugi: .5, kuyuri: .25 }; s.loverSince = { tsumugi: 3, kuyuri: 6 };
          s.loverEventsSeen = ["lover_tsumugi_lv2"]; s.owned.push("suyaki_tsumugi");
          s.finales.tsumugi = { route: "lover", day: 3, chapter: 1 };
          s.finales.minto = { route: "romance", day: 7, chapter: 1 }; // pending is not a lover
          s.flags._confession_due = "minto"; s.flags._confession_wait = 10;
          s.finales.naru = { route: "friend", day: 7, chapter: 1 }; s.affinity.naru = 66;
          s.schema = 7; H.core.save(); H.core.newGame(); H.core.load();
          H.before = JSON.stringify(H.core.state); H.beforeSave = localStorage.getItem(H.core.SAVE_KEY);
          H.status.openStatus();
        }, level);
        await page.locator('[data-tab="people"]').click();
        const rows = await page.locator(".pp-row").evaluateAll(rows => rows.map(row => ({
          lover: row.classList.contains("lover"), text: row.textContent,
          hearts: [...row.querySelectorAll(".ui-heart")].map(n => n.style.getPropertyValue("--fill")),
          label: row.querySelector(".heart-row")?.getAttribute("aria-label"),
        })));
        const lovers = rows.filter(r => r.lover);
        assert.equal(lovers.length, 2);
        for (const row of lovers) {
          assert.deepEqual(row.hearts, Array(5).fill("100%")); assert.equal(row.label, "恋人（♥5）");
          assert(!/Lv\.|絆|74/.test(row.text));
        }
        assert(!rows.find(r => r.text.includes("みんと")).lover);
        assert(rows.find(r => r.text.includes("なる")).text.includes("友達"));
        await assertFits(page, ".st-people, .pp-row, .pp-relation");
        if (level === 1) await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${mode}-status-hearts.png` });
        await page.locator('[data-test="status-close"]').click();
        assert(await page.evaluate(() => H.before === JSON.stringify(H.core.state)
          && H.beforeSave === localStorage.getItem(H.core.SAVE_KEY)), "STATUS changed saved private growth or rewards");
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${mode}-growth-notifications-and-max`, async page => {
      await setup(page);
      for (const [points, level] of [[9, 1], [19, 1], [66, 5]]) {
        const before = await page.evaluate(({ points, level }) => {
          const s = H.fresh(); s.lovers = ["kuyuri"]; s.lovePts.kuyuri = points; s.loveLevel.kuyuri = level;
          s.loveCarry.kuyuri = .5; s.loverSince.kuyuri = 3;
          // 成長通知の対象レベルより前の恋人会話は実際に読了済み。
          s.loverEventsSeen = Array.from({ length: points === 19 ? 1 : points === 66 ? 4 : 0 }, (_, i) => i + 1)
            .flatMap(n => [`lover_kuyuri_lv${n}`, `lover_kuyuri_lv${n}_b`]);
          H.stats.bond.private = false; H.stats.gainAffinity("kuyuri", 10);
          const publicPts = s.lovePts.kuyuri;
          H.stats.bond.private = true; H.stats.gainAffinity("kuyuri", 10); H.stats.bond.private = false;
          H.core.save();
          return { publicPts, privatePts: s.lovePts.kuyuri, privateLevel: s.loveLevel.kuyuri, carry: s.loveCarry.kuyuri };
        }, { points, level });
        await page.locator(".gain-card.bond").waitFor();
        // Entrance begins outside the stage; check the settled position.
        await page.waitForFunction(() => {
          const n = document.querySelector(".gain-card.bond"), stage = document.querySelector("#stage");
          if (!n?.classList.contains("show")) return false;
          const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect();
          return r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
        });
        const card = await page.locator(".gain-card.bond").evaluate(card => ({
          text: card.textContent, fills: [...card.querySelectorAll(".ui-heart")].map(n => n.style.getPropertyValue("--fill")),
          label: card.querySelector(".gc-hearts")?.getAttribute("aria-label"),
        }));
        assert.equal(before.publicPts, points); assert.equal(before.privatePts, points + 5); assert.equal(before.carry, .5);
        assert.equal(before.privateLevel, points === 19 ? 2 : level);
        assert.deepEqual(card.fills, Array(5).fill("100%")); assert.equal(card.label, "恋人（♥5）");
        assert(!/Lv\.|\d|P/.test(card.text.replaceAll("BOND UP", "").replaceAll("BOND", "")), card.text);
        if (points === 19) assert(card.text.includes("恋人との絆が深まった"));
        await assertFits(page, ".gain-card.bond");
        await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${mode}-bond-${points}.png` });
        const loaded = await page.evaluate(async () => {
          await H.ui.bannersIdle(); H.core.newGame(); H.core.load();
          return { pts: H.core.state.lovePts.kuyuri, level: H.core.state.loveLevel.kuyuri, carry: H.core.state.loveCarry.kuyuri,
            since: H.core.state.loverSince.kuyuri, lovers: H.core.state.lovers };
        });
        assert.deepEqual(loaded, { pts: before.privatePts, level: before.privateLevel, carry: .5, since: 3, lovers: ["kuyuri"] });
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${mode}-milestone-rewards-and-multiple-lovers`, async page => {
      await setup(page);
      const result = await page.evaluate(async () => {
        const s = H.fresh(); s.lovers = ["minto", "kuyuri"]; s.loveLevel.minto = 1; s.lovePts.minto = 19;
        s.loverEventsSeen = ["lover_minto_lv1"]; s.loverSince = { minto: 2, kuyuri: 5 }; s.guilt = 3;
        const played = [], enter = H.vn.hooks.onEnter;
        H.vn.hooks.onEnter = (id, dlg) => { enter?.(id, dlg); played.push(id); };
        const before = s.stats.charm, xpBefore = s.growth?.xp || 0;
        const board = (await import("./js/core/growth-mode.js")).growthEnabled();
        await H.stats.paidAction(() => H.romance.playDate("minto"), { budget: 1, points: 2, primary: "charm", exp: { key: "minto", person: "minto" } });
        const first = await H.romance.maybeShuraba(); const guilt = s.guilt;
        const repeated = await H.romance.maybeShuraba();
        H.core.save(); H.core.newGame(); H.core.load();
        return { s: H.core.state, played, before, xpBefore, board, first, guilt, repeated };
      });
      assert(result.s.lovePts.minto > 19); assert(result.s.loveLevel.minto >= 2);
      assert.equal(result.played.filter(id => id === "lover_minto_lv2").length, 1);
      assert.equal(result.s.loverEventsSeen.filter(id => id === "lover_minto_lv2").length, 1);
      // デートの成長: 旧しくみ（?growth=0）は魅力に2P、心得の盤（通常プレイの既定・SBD97）は経験値（能力は書き換えない）
      if (result.board) { assert.equal(result.s.stats.charm, result.before); assert((result.s.growth?.xp || 0) > result.xpBefore, "date earns EXP"); }
      else assert(result.s.stats.charm >= result.before + 2);
      assert.equal(result.s.lastDate.minto, 8);
      assert(result.first && !result.repeated); assert.equal(result.guilt, 4); assert.equal(result.s.guilt, 4);
      assert.deepEqual(result.s.lovers, ["minto", "kuyuri"]); assert.deepEqual(result.s.loverSince, { minto: 2, kuyuri: 5 });
    }, { ...options, reducedMotion: "reduce" });
  }
});
