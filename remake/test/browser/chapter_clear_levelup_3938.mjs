// #3938: the chapter 2-5 completion cards (「第N章・完」) keep the chapter-clear level-up / hidane plate off
// their text, growth radar and buttons, like the chapter 1 clear screen (#3945). Each case keeps the HUD
// subscribed as in uninterrupted play and awards the real chapter-clear EXP; later notices must use the same space.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const PREFIX = { 2: "ch2-tournament", 3: "ch3-aftermath", 4: "ch4", 5: "ch5" };
// 150 EXP times the chapter multiplier (growth.js CHAPTER_MULT: 1.25 / 1.5 / 1.75 / 2).
const CLEAR_EXP = { 2: 188, 3: 225, 4: 263, 5: 300 };
const PEOPLE = ["ageha", "kumicho", "kuraudo", "pakki", "uezono", "dr_charcoal", "sensu", "hajime", "sumi", "naru"];

// A save just before the chapter's last scene (chapter 2: its completion card, see below), resumed in place.
async function openLastStep(page, chapter, level) {
  return page.evaluate(async ({ chapter, level, people }) => {
    const core = await import("./js/core/state.js"), g = await import("./js/core/growth.js");
    const { initHud } = await import("./js/daily/hud.js"), vn = await import("./js/vn/engine.js");
    const s = core.newGame();
    Object.assign(s, { money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    if (chapter === 2) {
      Object.assign(s, { chapter: 2, day: 28, slot: 1, phase: "cleared" });
      s.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_tokyo_invitation: true,
        _ch2_taste_distant: true, _ch2_read_ch2_tournament_ageha_heart: true, _lime_opened: true, _lime_tut: 1,
        _ch2_tournament: { version: 1, step: 11, stage: "complete", attempts: 1, votes: {}, voted: 4,
          result: { rank: 1, win: true }, history: [{ rank: 1, total: 88 }], prizePaid: true, prizeReceived: 100000 } };
    } else if (chapter === 3) {
      Object.assign(s, { chapter: 3, day: 44, slot: 1, phase: "aftermath" });
      s.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _lime_tut: 1, _lime_opened: true, _ch3_tournament_won: true, _ch3_japan_first_representative: true,
        _ch3_intro: { startDay: 29, stage: 18, titleSeen: true, routeVersion: 2 },
        _ch3_tournament: { stage: "complete", attempts: 1, voted: 4, history: [{ rank: 1, total: 88 }], result: { rank: 1, win: true, votes: {} } },
        _ch3_aftermath: { version: 4, winDay: 42, stage: 6 } }; // the last scene: the homecoming customer
    } else if (chapter === 4) {
      Object.assign(s, { chapter: 4, day: 50, slot: 1, phase: "resolution" });
      s.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
        _ch4_preview_seen: true, _lime_opened: true, _lime_tut: 1, _ch4_sheikh_revealed: true,
        _ch4: { startDay: 46, day: 5, stage: 4, part: "resolution", titleSeen: true, read: {}, firstDay: 1, resolution: 4, attempts: 1 } };
    } else {
      const p = await import("./js/chapters/ch5-progress.js");
      Object.assign(s, { chapter: 4, phase: "cleared", day: 60 }); s.flags._ch4_cleared = true;
      if (!p.advanceToChapterFive(s)) throw new Error("chapter five");
      for (const scene of p.CH5_PROLOGUE) p.completeChapterFiveScene(s, scene.id);
      p.completeChapterFiveScene(s, "ch5_unrecorded_day"); p.recordChapterFiveScheduleDecision(s, "decide");
      p.completeChapterFiveScene(s, "ch5_schedule_contact"); p.beginChapterFiveMatch(s);
      for (const key of ["arrival", "firstCup", "beforeSecond"]) p.completeChapterFiveScene(s, p.CH5_MATCH_SCENES[key]);
      p.recordChapterFiveSecondCup(s, { total: 100, category: "steady" });
      for (const key of ["win", "afterglow"]) p.completeChapterFiveScene(s, p.CH5_MATCH_SCENES[key]);
      for (const scene of p.CH5_AFTERMATH) p.completeChapterFiveScene(s, scene.id);
      p.beginChapterFiveFinale(s, ["ending_start", "ending_normal", "ending_daily_smoke"]);
      p.completeChapterFiveScene(s, "ending_start"); p.completeChapterFiveScene(s, "ending_normal");
    }
    s.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of people) s.flags[`_intro_${who}`] = true;
    s.flags._hidane_stock_notice = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    g.setGrowthPreview(true);
    const board = g.ensureGrowth(), xp = g.totalExpFor(level) - 1;
    Object.assign(board, { xp, settledXp: xp, level: level - 1 });
    for (let c = 1; c < chapter; c++) board.cleared.push(c);
    core.save();
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    initHud({}); // as in uninterrupted play, the daily HUD is still subscribed to level-ups
    const before = { xp, white: board.hidane.any, red: board.hidane.body };
    if (chapter === 2) void (await import("./js/chapters/ch2-tournament.js")).runChapterTwoTournament();
    else if (chapter === 3) void (await import("./js/chapters/ch3-aftermath.js")).runChapterThreeAftermath();
    else if (chapter === 4) void (await import("./js/chapters/ch4.js")).resumeChapterFour();
    else void (await import("./js/chapters/ch5.js")).resumeChapterFive();
    return before;
  }, { chapter, level, people: PEOPLE });
}

// The real plate against the card's text lines, radar, MENU and action buttons (in 1280x720 stage px).
async function unobscured(notice) {
  const geometry = await notice.evaluate(n => {
    const stage = document.querySelector("#stage").getBoundingClientRect(), k = stage.width / 1280;
    const card = document.querySelector("#screen > .chapter-clear"), c = card.getBoundingClientRect();
    const r = n.querySelector(".lvup-plate").getBoundingClientRect();
    const overflows = [...n.querySelectorAll(".lvup-head,.lvup-lv,.lvup-fire,.lvup-none")].some(e => {
      const b = e.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1;
    });
    const lines = e => { const range = document.createRange(); range.selectNodeContents(e); return [...range.getClientRects()]; };
    const name = e => e.dataset.test || `${e.tagName.toLowerCase()}「${e.textContent.slice(0, 12)}」`;
    const parts = [
      ...[...card.querySelectorAll("h1, p")].flatMap(e => lines(e).map(b => [name(e), b])),
      ...[...card.querySelectorAll("svg, button")].map(e => [name(e), e.getBoundingClientRect()]),
    ];
    // Keep at least 8 stage px of space: separated on either axis.
    const near = b => Math.max(b.left - r.right, r.left - b.right, b.top - r.bottom, r.top - b.bottom) < 8 * k;
    return {
      outside: r.left < stage.left || r.top < stage.top || r.right > stage.right || r.bottom > stage.bottom,
      inCard: r.left >= c.left && r.top >= c.top && r.right <= c.right && r.bottom <= c.bottom,
      overflows, near: [...new Set(parts.filter(([, b]) => near(b)).map(([label]) => label))],
      buttons: [...card.querySelectorAll(".ch2-contest-actions button")].map(e => {
        const b = e.getBoundingClientRect();
        return !e.disabled && e.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
      }).every(Boolean),
      pointer: getComputedStyle(n).pointerEvents,
    };
  });
  assert.deepEqual(geometry, { outside: false, inCard: true, overflows: false, near: [], buttons: true, pointer: "none" });
}

const VIEWS = [
  // [label, context options, the save is one EXP short of this level, later notices]
  ["844", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, 16, false],
  ["740", { viewport: { width: 740, height: 320 }, hasTouch: true, isMobile: true }, 20, true],
  ["pc-reduce", { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" }, 20, false],
];
// What the clear EXP gives from there: a plain level (chapter 5's 300 EXP crosses two, shown as one
// "Lv.15 →" plate), or the Lv.20 milestone with its colored fire.
const REWARD = (chapter, short) => short === 20 ? { to: 20, label: /Lv\.20　白火 ＋3　紅火 ＋1$/, fires: ["×3", "×1"], white: 3, red: 1 }
  : chapter === 5 ? { to: 17, label: /Lv\.17　白火 ＋4$/, fires: ["×4"], white: 4, red: 0 }
  : { to: 16, label: /Lv\.16　白火 ＋2$/, fires: ["×2"], white: 2, red: 0 };

await suite("chapter-clear-levelup-3938", async check => {
  for (const chapter of [2, 3, 4, 5]) for (const [label, options, short, later] of VIEWS) {
    await check(`ch${chapter}-${label}`, async page => {
      page.setDefaultTimeout(60000);
      const before = await openLastStep(page, chapter, short), reward = REWARD(chapter, short);
      const card = page.locator(dt(`${PREFIX[chapter]}-complete`));
      if (chapter === 2) {
        // Chapter 2 awards the EXP at the night LIME, before the closed-shop scene. Read quickly (or on an old
        // save that already read it), the notice is still up when this card arrives.
        await card.waitFor();
        await page.evaluate(async () => (await import("./js/core/growth.js")).awardChapterClearExp());
      } else {
        const next = page.locator(dt(`${PREFIX[chapter]}-continue`));
        await (options.hasTouch ? next.tap() : next.click());
        await card.waitFor();
      }
      assert.equal(await card.evaluate(n => n.matches(".ch2-contest.chapter-clear")), true);
      const level = page.locator(`.lvup.show[data-kind="level"][data-from="${short - 1}"][data-to="${reward.to}"]`);
      await level.waitFor();
      assert.match(await level.getAttribute("aria-label"), reward.label);
      assert.deepEqual(await level.locator(".lvup-fire b").allTextContents(), reward.fires);
      await unobscured(level);
      if (options.reducedMotion === "reduce") {
        assert.equal(await level.evaluate(n => n.classList.contains("still") && getComputedStyle(n).animationName === "none"), true);
      }
      // The reward itself is unchanged: the chapter-clear 150 EXP (these saves log no breadth) and the level's hidane.
      const after = await page.evaluate(async chapter => {
        const { state } = await import("./js/core/state.js");
        return { phase: state.phase, level: state.growth.level, cleared: state.growth.cleared.includes(chapter),
          xp: state.growth.xp, white: state.growth.hidane.any, red: state.growth.hidane.body };
      }, chapter);
      assert.deepEqual(after, { phase: "cleared", level: reward.to, cleared: true, xp: before.xp + CLEAR_EXP[chapter],
        white: before.white + reward.white, red: before.red + reward.red });
      if (later) {
        // A later notification uses the same space even if all four kinds wrap, or the plate says why there is none.
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
        // Only the plate's own light and particles (direct children of #fx) are hidden here; the growth board
        // opened over this card from MENU (or chapter 5's Kannon-do) keeps the light in its own layer.
        assert.deepEqual(await page.evaluate(() => {
          const make = (tag, className) => Object.assign(document.createElement(tag), { className });
          const own = make("i", "gfx-ring"), board = make("div", "gb-fx"), inBoard = make("i", "gfx-ring");
          board.append(inBoard); document.querySelector("#fx").append(own, board);
          const shown = [own, inBoard].map(n => getComputedStyle(n).display !== "none");
          own.remove(); board.remove();
          return shown;
        }), [false, true]);
      }
    }, options);
  }
});
