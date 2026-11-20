// Isolated saves, then the normal title LOAD UI. No tournament or player save is replayed.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const contexts = [
  [0, "bg_c_station_lobby", false],
  [1, "bg_c_station_lobby", true],
  [2, "bg_tonari_inside_night", false],
  [5, "bg_tonari_inside_night", true],
  [6, "bg_home_day", false],
  [8, "kemurikusa", false],
  [10, "bg_tonari_inside_night", false],
];

await suite("ch1-victory-resume-2190", async check => {
  for (const [step, background, phone] of contexts) {
    await check(`load-step-${step}`, async page => {
      const before = await page.evaluate(async step => {
        const core = await import("./js/core/state.js");
        const intro = await import("./js/vn/intro.js");
        const s = core.newGame();
        Object.assign(s, { phase: "tournament", day: 14, slot: 0, money: 75813,
          flavorStock: { lemon: 24, mint: 18 } });
        s.tournament.victory = { step, revealed: true, paid: true };
        for (const id of ["sumi", "tsumugi", "naru", "adam", "sui", "dr_kemuri", "pakki"]) intro.markIntroSeen(id);
        core.config.textSpeed = 4; core.saveConfig(); core.save();
        return JSON.stringify([s.day, s.slot, s.money, s.flavorStock, s.affinity]);
      }, step);
      await page.reload();
      await page.locator('[data-test="title-load"]').click();
      await page.locator('[data-test="slot-0"]').click();
      await page.locator(phone ? ".phone-overlay.show" : "#vn.active").waitFor();
      await page.waitForFunction(expected => [...document.querySelectorAll("#bg > .bg-img.show")]
        .some(n => `${n.dataset.sceneBg || ""} ${n.style.backgroundImage}`.includes(expected)), background);
      assert.equal(await page.locator("#screen .title").count(), 0, "LOAD title is removed before the resumed scene/phone");
      assert.doesNotMatch(await page.locator("#stage").ariaSnapshot(), /NEW GAME|GALLERY|CONFIG|LOAD/,
        "Title actions must also be absent from the accessibility tree");
      assert.equal(await page.evaluate(async () => {
        const { state: s } = await import("./js/core/state.js");
        return JSON.stringify([s.day, s.slot, s.money, s.flavorStock, s.affinity]);
      }), before, "Restoring a scene does not alter saved resources or the calendar");
    }, { viewport: { width: 1180, height: 757 } });
  }

  // #3938: in uninterrupted play the tournament HUD is already subscribed when the
  // final scene awards chapter EXP. Exercise the real aftermath and its lazy FX queue.
  for (const [width, height, motion] of [[844, 390, "no-preference"], [740, 320, "no-preference"], [740, 320, "reduce"]]) {
    await check(`clear-reward-${width}-${motion}`, async page => {
      const before = await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), g = await import("./js/core/growth.js");
        const { initHud } = await import("./js/daily/hud.js"), { setBg } = await import("./js/core/ui.js");
        const { bgUrl } = await import("./js/core/data.js"), { resumeGame } = await import("./js/chapters/ch1.js");
        const s = core.newGame();
        Object.assign(s, { day: 14, slot: 0, phase: "aftermath", weatherSeed: 7 });
        g.setGrowthPreview(true); s.flags._hidane_stock_notice = true;
        const board = g.ensureGrowth(), xp = g.totalExpFor(6) - 1;
        Object.assign(board, { xp, settledXp: xp, level: 5 });
        initHud({}); // as in tournamentDay, before the final scene
        await setBg(bgUrl("bg_tonari_inside", "night"), { instant: true, tint: "dim" });
        const white = board.hidane.any;
        void resumeGame();
        return { xp, white };
      });
      const clear = page.locator(".end-screen.clear");
      await clear.waitFor();
      const level = page.locator('.lvup.show[data-kind="level"]');
      await level.waitFor();
      assert.match(await level.getAttribute("aria-label"), /Lv\.6.*白火.*2/);
      assert.equal(await level.locator(".lvup-fire b").textContent(), "×2");
      // Check the actual plate and hit targets, not just pointer-events or its anchor.
      async function unobscured(notice) {
        const geometry = await notice.evaluate(n => {
          const r = n.querySelector(".lvup-plate").getBoundingClientRect();
          const stage = document.querySelector("#stage").getBoundingClientRect();
          const overflows = [...n.querySelectorAll(".lvup-head,.lvup-lv,.lvup-fire,.lvup-none")].some(e => {
            const b = e.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1;
          });
          const intersects = e => { const b = e.getBoundingClientRect();
            return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; };
          return {
            outside: r.left < stage.left || r.top < stage.top || r.right > stage.right || r.bottom > stage.bottom,
            overflows, overlaps: [...document.querySelectorAll(".end-title,.end-sub,.end-radar,.end-notes,.clear-last-line,.end-actions")].filter(intersects).map(e => e.className),
            buttons: [...document.querySelectorAll(".end-actions button")].map(e => {
              const b = e.getBoundingClientRect();
              return !e.disabled && e.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
            }),
            pointer: getComputedStyle(n).pointerEvents,
          };
        });
        assert.deepEqual(geometry, { outside: false, overflows: false, overlaps: [], buttons: [true, true], pointer: "none" });
      }
      await unobscured(level);
      assert.deepEqual(await page.evaluate(async () => {
        const { state } = await import("./js/core/state.js");
        return [state.phase, state.growth.level, state.growth.xp, state.growth.hidane.any, state.growth.cleared];
      }), ["cleared", 6, before.xp + 150, before.white + 2, [1]]);
      if (motion === "reduce") {
        assert.equal(await level.evaluate(n => n.classList.contains("still") && getComputedStyle(n).animationName === "none"), true);
        // A later notification must use the same safe space even if all four kinds wrap.
        await page.evaluate(async () => (await import("./js/daily/levelup.js")).showHidaneGift({
          label: "大会で優勝", parts: ["any", "body", "sense", "wisdom"].map(kind => ({ kind, n: 2 })),
        }));
        const gift = page.locator('.lvup.show[data-kind="gift"]'); await gift.waitFor();
        assert.equal(await gift.locator(".lvup-fire").count(), 4);
        await unobscured(gift);
        await page.evaluate(async () => (await import("./js/daily/levelup.js")).showLevelUp({
          from: 88, to: 90, milestone: true, capped: true,
        }));
        const cap = page.locator('.lvup.show[data-to="90"]'); await cap.waitFor();
        assert.equal(await cap.locator(".lvup-none").textContent(), "火種は受け取り済み");
        await unobscured(cap);
      } else if (width === 844) {
        await clear.locator('[data-test="end-chapter2"]').tap();
        await page.waitForFunction(async () => (await import("./js/core/state.js")).state.chapter === 2);
      }
    }, { viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: motion });
  }

  await check("sentence-pages", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const ui = await import("./js/core/ui.js");
      const vn = await import("./js/vn/engine.js");
      core.newGame(); ui.clearScreen(); core.config.textSpeed = 4;
      void vn.play({ dialogue_id: "sentence_page_fixture", lines: [{ speaker: "", text: "文章の表示幅を確かめる。" }] });
    });
    await page.locator("#vn.active .vn-text").waitFor();
    const rows = await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      const { paginateForBox } = await import("./js/vn/layout.js");
      return [
        ["ch1_tournament_judging", "チャコール博士の評価も、"],
        ["interval_day2_adam_lime", "アダムからはそれきりで、"],
      ].map(([id, prefix]) => {
        const lines = DB.dialogues[id].lines;
        const at = lines.findIndex(l => l.text?.startsWith(prefix));
        return lines.slice(at, at + 2).map(l => ({ text: l.text,
          pages: paginateForBox(l.text, document.querySelector(".vn-text")) }));
      });
    });
    for (const row of rows.flat()) {
      assert.equal(row.pages.length, 1, `Sentence stays on one page: ${row.text}`);
      assert.equal(row.pages[0].replaceAll("\n", ""), row.text);
    }
  }, { viewport: { width: 1180, height: 757 } });
});
