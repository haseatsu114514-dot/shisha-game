// 全国大会の一台・四回投票・勝敗境界を本番UIで確認する。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const t = name => `[data-test="ch3-tournament-${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));

async function seed(page, auto = "good", overrides = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ auto, overrides }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    const { CH3_INTRO_SCENES } = await import("./js/chapters/ch3-progress.js");
    Object.assign(value, { chapter: 3, day: 42, slot: 0, phase: "tournament", stamina: 100,
      money: 35000, flavorStock: { double_apple: 100, mint: 100, chocolate: 100 }, weatherSeed: 5 }, overrides);
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] },
      _ch3_intro: { startDay: 29, stage: CH3_INTRO_SCENES.length, titleSeen: true, routeVersion: 2 } };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["hajime", "pakki", "kuze", "steve", "volk", "dr_kemuri", "nagumo"])
      value.met[who] = true;
    for (const who of Object.keys(value.met)) value.flags[`_intro_${who}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    const craft = await import("./js/craft/session.js"); craft.craftTest.auto = auto;
    void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
  }, { auto, overrides });
}

await suite("ch3-tournament", async check => {
  await check("abandoned-pull-keeps-the-vote-and-recovers-the-step", async page => {
    await seed(page);
    await page.locator(t("entry")).waitFor();
    await page.locator(t("start")).click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    await page.locator(t("votes")).waitFor();
    const before = await get(page);
    assert.equal(before.flags._ch3_tournament.step, 8);
    assert.equal(before.flags._ch3_tournament.voted, 1);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = null; });
    await page.locator(t("continue")).click();
    await page.locator(".pull-play").waitFor();
    await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      state.stamina -= 7;
      state.flavorStock.double_apple -= 1;
      document.querySelector(".pull-play").remove();
    });
    await page.locator(t("error")).waitFor();
    const after = await get(page), p = after.flags._ch3_tournament;
    assert.equal(p.stage, "craft");
    assert.equal(p.step, 8);
    assert.equal(p.voted, 1);
    assert.equal(p.attempts, before.flags._ch3_tournament.attempts);
    assert.equal(after.day, before.day);
    assert.equal(after.slot, before.slot);
    assert.deepEqual(p.votes, before.flags._ch3_tournament.votes);
    assert.deepEqual(p.craft, before.flags._ch3_tournament.craft);
    assert.equal(p.rollback, null);
    assert.equal(after.stamina, before.stamina);
    assert.deepEqual(after.flavorStock, before.flavorStock);
    assert.equal(p.result, null);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.flags._ch3_tournament.step, 8);
    assert.equal(saved.flags._ch3_tournament.voted, 1);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(t("reload")).click();
    await page.locator(t("votes")).waitFor();
    const retried = await get(page);
    assert.equal(retried.flags._ch3_tournament.step, 9);
    assert.equal(retried.flags._ch3_tournament.voted, 2);
    assert.equal(retried.flags._ch3_tournament.attempts, before.flags._ch3_tournament.attempts);
    assert.deepEqual(retried.flavorStock, before.flavorStock);
  }, { reducedMotion: "reduce" });
  await check("arriving-with-no-chocolate-is-supplied-during-the-tournament", async page => {
    // 課題のチョコレートを一度も買わずに来ても、大会が本番中だけ無制限に支給するので、
    // ミックスで課題（4g以上）を満たして一台を仕上げられる（#1052）。支給分は在庫に足さず持ち越さない。
    await seed(page, "good", { flavorStock: { double_apple: 100, mint: 100 } });
    await page.locator(t("entry")).waitFor();
    const arrived = await get(page);
    assert.equal(arrived.flavorStock.chocolate ?? 0, 0,
      "Supply does not top up or add to the private stock before the craft");
    await page.locator(t("start")).click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    // 0gでも支給で課題量を満たし votes まで到達できる（決定ボタンが押せないまま詰まない）。
    await page.locator(t("votes")).waitFor();
    const after = await get(page);
    assert.equal(after.flags._ch3_tournament.voted, 1,
      "The craft reaches the first vote instead of dead-ending at the mix step");
    assert.equal(after.flavorStock.chocolate ?? 0, 0,
      "The supplied challenge leaf never lands in the private stock (no carry-over)");
  }, { reducedMotion: "reduce" });
  await check("burned-pull-still-counts-as-a-loss", async page => {
    await seed(page, "burn");
    await page.locator(t("entry")).waitFor();
    await page.locator(t("start")).click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    for (let round = 0; round < 4; round++) {
      await page.locator(`${t("votes")}, ${t("defeat")}, ${t("result")}`).first().waitFor();
      if (await page.locator(t("defeat")).count()) break;
      assert.equal(await page.locator(t("result")).count(), 0);
      await page.locator(t("continue")).click();
    }
    await page.locator(t("defeat")).waitFor();
    const p = (await get(page)).flags._ch3_tournament;
    assert(p.failure, "A failed shisha must take the defeat path");
    assert.equal(p.losses, 1);
    assert.equal(p.history.length, 0);
    assert.equal(p.rollback, null);
  }, { reducedMotion: "reduce" });
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
      const explanation = await page.locator(t("vote-reason")).innerText();
      if (round === 1) assert.doesNotMatch(explanation, /鋭い苦みの余韻/, "No tasting effect before service");
      if (round === 2) assert.match(explanation, /南雲は水を飲んだ.*久世の直後にはじめを試喫.*比較-2/s,
        "Show the actual palate trap that affected Hajime");
      if (round === 3) assert.match(explanation, /鋭い苦みは直後の比較に残らなかった/,
        "Show when the same tactic failed because of order and water");
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
    assert.equal(result.rank, 1, "A Chapter 2 level character should be able to win with a well-made craft");
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
    assert.equal(state.money, before.money + 100000, "Chapter 3 prize is paid once on the win");
    assert.deepEqual(state.lovers, before.lovers);
    await page.locator(t("aftermath")).click();
    const aftermath = scene => `[data-test="ch3-aftermath-scene"][data-scene="${scene}"]`;
    const scenes = ["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile", "ch3_enmaku_cleanup",
      "ch3_home_customer", "ch3_tsumugi_result", "ch3_ageha_reunion"];
    for (const [index, scene] of scenes.entries()) {
      await page.locator(aftermath(scene)).waitFor();
      if (index === 0) assert(await page.locator('#bg > .bg-img').last().evaluate(node =>
        node.style.backgroundImage.includes('bg_ch3_hotel_night')),
      'The victory-night hotel must have its own room background');
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
    assert.match(await page.locator('[data-test="slot-0"]').innerText(), /第3章\s*DAY 17[\s\S]*第3章クリア/);
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
  await check("third-loss-assist-sets-starting-craft-condition", async page => {
    await seed(page);
    await page.locator(t("entry")).waitFor();
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const model = await import("./js/chapters/ch3-tournament-state.js");
      const p = model.tournamentProgress(core.state);
      p.stage = "defeat"; p.attempts = 3; p.losses = 2; p.lastLossAttempt = 2; p.failure = "burnt";
      p.entry = model.resources(core.state); p.entry.stamina = 25; core.state.stamina = 25;
      (await import("./js/craft/session.js")).craftTest.auto = null;
      core.save();
      void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
    });
    await page.locator(t("defeat")).waitFor();
    await page.locator(t("retry")).click();
    await page.locator('[data-test="retry-assist-yes"]').click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_tournament.attempts === 4);
    const value = await get(page), p = value.flags._ch3_tournament;
    const maximum = await page.evaluate(async () => (await import("./js/core/stats.js")).maxStamina());
    assert.equal(value.stamina, maximum);
    assert.equal(p.entry.stamina, 25);
    assert.equal(p.craft.retryAssist, true);
    assert.equal(p.craft.condition.health, "green", "Recovery must precede the craft condition snapshot");
  }, { reducedMotion: "reduce" });
});
