// 全国大会の一台・四回投票・勝敗境界を本番UIで確認する。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const t = name => `[data-test="ch3-tournament-${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));

async function seed(page, auto = "good") {
  page.setDefaultTimeout(30000);
  await page.evaluate(async auto => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    const { CH3_INTRO_SCENES } = await import("./js/chapters/ch3-progress.js");
    Object.assign(value, { chapter: 3, day: 42, slot: 0, phase: "tournament", stamina: 100,
      money: 35000, flavorStock: { double_apple: 100, mint: 100 }, weatherSeed: 5 });
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] },
      _ch3_intro: { startDay: 29, stage: CH3_INTRO_SCENES.length, titleSeen: true } };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    value.stats = { technique: 100, sense: 100, guts: 100, charm: 100, insight: 100 };
    for (const who of ["hajime", "pakki", "kuze", "steve", "volk", "dr_kemuri", "nagumo"])
      value.met[who] = true;
    for (const who of Object.keys(value.met)) value.flags[`_intro_${who}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    const craft = await import("./js/craft/session.js"); craft.craftTest.auto = auto;
    void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
  }, auto);
}

await suite("ch3-tournament", async check => {
  await check("four-person-craft-votes-and-win-boundary", async page => {
    await seed(page);
    await page.locator(t("entry")).waitFor();
    const before = await get(page);
    assert.equal(before.flags._ch3_tournament.stage, "entry");
    assert.equal(before.flags._ch3_tournament.history.length, 0);
    assert.equal(before.tournament.lastRank, 1);
    await page.locator(t("start")).click();
    await page.locator(t("ready")).waitFor();
    let state = await get(page);
    assert(state.met.emil, "Emil must be known after the announced judge scene");
    await page.locator(t("craft-start")).click();
    for (let round = 1; round <= 3; round++) {
      await page.locator(t("votes")).waitFor();
      state = await get(page);
      assert.equal(state.flags._ch3_tournament.voted, round);
      assert.equal(state.flags._ch3_tournament.history.length, 0);
      assert.deepEqual(await page.locator("[data-contestant]").evaluateAll(nodes =>
        nodes.map(node => node.dataset.contestant).sort()), ["hajime", "kuze", "steve", "volk"]);
      assert.deepEqual(await page.locator(".judge-chip").evaluateAll(nodes =>
        nodes.map(node => node.dataset.judge).sort()), ["dr_kemuri", "emil", "nagumo"]);
      assert.match(await page.locator(".ch2-contest-judges").textContent(), /エミル|Emil/);
      await assertFits(page, ".ch2-contest .btn, .ch2-contest-rival, .judge-chip");
      if (round === 1) {
        const first = structuredClone(state.flags._ch3_tournament.votes);
        await page.locator(t("menu")).click();
        await page.locator(t("save")).click();
        await page.locator('[data-test="slot-1"]').click();
        await page.reload();
        await page.locator('[data-test="title-load"]').click();
        await page.evaluate(async () => {
          const vn = await import("./js/vn/engine.js");
          vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
          (await import("./js/craft/session.js")).craftTest.auto = "good";
        });
        await page.locator('[data-test="slot-1"]').click();
        await page.locator(t("votes")).waitFor();
        const resumed = await get(page);
        assert.equal(resumed.flags._ch3_tournament.voted, 1, "The first poll must not run twice after LOAD");
        assert.deepEqual(resumed.flags._ch3_tournament.votes, first);
        assert.equal(resumed.flags._ch3_tournament.history.length, 0);
      }
      await page.locator(t("continue")).click();
    }
    await page.locator(t("result")).waitFor();
    state = await get(page);
    const result = state.flags._ch3_tournament.result;
    assert.equal(state.flags._ch3_tournament.voted, 4);
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert.equal(result.careHistory.length, 2);
    assert.equal(result.win, result.rank === 1);
    assert.equal(result.rank, 1, "The high-skill good craft fixture should win on its actual votes");
    assert.equal(state.flags._ch3_tournament_won, undefined,
      "Winning result cannot clear the match before reading its result scene");
    const voteSum = Object.values(result.votes).map(row => Object.values(row).reduce((sum, points) => sum + points, 0));
    assert.deepEqual(voteSum, [10, 10, 10], "Each judge must spend exactly ten points");
    const ch2 = structuredClone(state.flags._ch2_tournament);
    await page.locator(t("continue")).click();
    await page.locator(t("complete")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch3_tournament_won, true);
    assert.equal(state.flags._ch3_japan_first_representative, true);
    assert.match(await page.locator(t("complete")).textContent(), /日本第一代表/);
    assert.equal(state.phase, "aftermath");
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert.deepEqual(state.flags._ch2_tournament, ch2);
    assert.equal(state.tournament.lastRank, before.tournament.lastRank);
    assert.equal(state.tournament.lastTotal, before.tournament.lastTotal);
    assert.equal(state.flags._ch3_cleared, undefined, "Post-win Tokyo scenes still remain");
    assert.equal(state.money, before.money);
    assert.deepEqual(state.lovers, before.lovers);
    await page.locator(t("aftermath")).click();
    const aftermath = scene => `[data-test="ch3-aftermath-scene"][data-scene="${scene}"]`;
    const scenes = ["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile",
      "ch3_home_customer", "ch3_ageha_reunion"];
    for (const [index, scene] of scenes.entries()) {
      await page.locator(aftermath(scene)).waitFor();
      await page.locator('[data-test="ch3-aftermath-continue"]').click();
      if (index === 0) {
        await page.locator(aftermath(scenes[1])).waitFor();
        await page.reload();
        await page.locator('[data-test="title-load"]').click();
        await page.evaluate(async () => {
          const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true;
        });
        await page.locator('[data-test="slot-0"]').click();
        await page.locator(aftermath(scenes[1])).waitFor();
        assert.equal((await get(page)).flags._ch3_aftermath.stage, 1,
          "Reload must resume after the hotel scene without replaying the win");
      }
    }
    await page.locator('[data-test="ch3-aftermath-complete"]').waitFor();
    state = await get(page);
    assert.equal(state.flags._ch3_cleared, true);
    assert.equal(state.phase, "cleared");
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    assert.match(await page.locator('[data-test="slot-0"]').innerText(), /第3章・DAY 17.*第3章クリア/);
  }, { reducedMotion: "reduce" });
  await check("actual-losing-rank-reads-defeat-and-retries-without-win", async page => {
    await seed(page);
    await page.locator(t("entry")).waitFor();
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const model = await import("./js/chapters/ch3-tournament-state.js");
      const p = model.tournamentProgress(core.state);
      p.stage = "result"; p.step = 11; p.voted = 4; p.attempts = 1;
      p.votes = Object.fromEntries(model.JUDGES.map(judge => [judge,
        { hajime: 0, kuze: 3, steve: 2, volk: 5 }]));
      p.quality = { hajime: 40, kuze: 82, steve: 80, volk: 84 };
      const rows = model.standings(p);
      p.result = { attempt: 1, total: 40, rank: rows.find(row => row.id === "hajime").rank,
        win: false, rows, votes: structuredClone(p.votes), careHistory: [{ score: 40 }, { score: 40 }] };
      p.history = [structuredClone(p.result)];
      core.state.met.emil = true;
      core.save();
      void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
    });
    await page.locator(t("result")).waitFor();
    assert.equal((await get(page)).flags._ch3_tournament.result.rank, 4);
    await page.locator(t("continue")).click();
    await page.locator(t("defeat")).waitFor();
    let state = await get(page);
    assert.equal(state.flags._ch3_tournament.defeatRead, true);
    assert.equal(state.flags._ch3_tournament_won, undefined);
    assert.equal(state.flags._ch3_japan_first_representative, undefined);
    assert.equal(state.flags._ch3_tournament.losses, 1);
    await page.locator(t("retry")).click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_tournament.attempts === 2);
    state = await get(page);
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert.equal(state.flags._ch3_tournament.voted, 0);
    assert.equal(state.flags._ch3_tournament_won, undefined);
  }, { reducedMotion: "reduce" });
});
