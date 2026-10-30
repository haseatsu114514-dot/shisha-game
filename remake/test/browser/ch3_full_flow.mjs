// 第3章の通しプレイ検証（#1176 GAP 3-A）。
// 第2章クリア済みセーブから、第3章プロローグ→導入シーン群→全国大会優勝→帰郷・aftermath場面群までを
// 1本のセーブで実UI・実saveだけで通す。導入の途中・大会の投票中・aftermathの途中でセーブ→リロードを挟み、
// 跨ぎで場面や投票が再演されず進行が壊れないことも確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const intro = id => `[data-test="ch3-intro-scene"][data-scene="${id}"]`;
const t = name => `[data-test="ch3-tournament-${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
  (await import("./js/craft/session.js")).craftTest.auto = "good";
});

// 次に再生される会話のIDを記録する。前夜が訪問デート(ch3_visit_*_date)と二重に再生されないことの確認に使う。
const recordEntered = page => page.evaluate(async () => {
  const { hooks } = await import("./js/vn/engine.js");
  const previous = hooks.onEnter;
  window.__entered = [];
  hooks.onEnter = (id, dialogue) => { window.__entered.push(id); previous?.(id, dialogue); };
});
const entered = page => page.evaluate(() => window.__entered);

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 35000, stamina: 100,
      flavorStock: { double_apple: 100, mint: 100, chocolate: 100 }, weatherSeed: 5,
      lovers: ["minto"], contacts: ["sumi", "minto"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true,
      _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    for (const who of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "nagumo", "hajime", "sumi"])
      value.flags[`_intro_${who}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    core.save();
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    (await import("./js/craft/session.js")).craftTest.auto = "good";
    void (await import("./js/chapters/ch3.js")).resumeChapterThree();
  });
}

await suite("ch3-full-flow", async check => {
  await check("chapter-three-intro-tournament-win-and-aftermath-on-one-save", async page => {
    await seed(page);
    // 1. プロローグ完了
    await page.locator(intro("ch3_opening")).waitFor({ timeout: 60000 });
    let state = await get(page);
    assert.equal(state.chapter, 3);
    assert.equal(state.flags._ch3_intro.prologueStep, 4);
    assert.equal(state.flags._ch3_intro.titleSeen, true);
    assert.equal(state.met.kuze, undefined, "The anonymous prologue must not reveal Kuze");
    const startDay = state.flags._ch3_intro.startDay;
    assert.equal(startDay, 29);
    const scenes = await page.evaluate(async () =>
      (await import("./js/chapters/ch3-progress.js")).CH3_INTRO_SCENES.map(({ id, day, slot }) => ({ id, day, slot })));
    assert.equal(scenes[0].id, "ch3_opening");
    assert.equal(scenes[1].id, "ch3_mukai_arrival");

    // 2. 導入シーン群（開幕→登録→ルールシート→むかい到着）
    const next = dt("ch3-intro-continue");
    await page.locator(next).click();
    await page.locator(intro("ch3_registration")).waitFor();
    await page.locator(next).click();
    await page.locator(dt("rule-sheet")).waitFor();
    await page.locator(dt("rule-sheet-close")).click();
    await page.locator(intro("ch3_mukai_arrival")).waitFor();
    assert.equal((await get(page)).flags._ch3_intro.stage, 1);

    // リロード跨ぎ(1): 導入の途中。むかい到着までは再演されない。
    await page.reload();
    await page.locator(dt("title-load")).click();
    await arm(page);
    await page.locator(dt("slot-0")).click();
    await page.locator(intro("ch3_mukai_arrival")).waitFor();
    assert.equal((await get(page)).flags._ch3_intro.stage, 1, "Reload must resume at the Mukai arrival");

    for (const { id, day, slot } of scenes.slice(1)) {
      // 東京の空き時間（#1655）は会員でなくても開く。この通しでは休んで次の場面へ進む。
      await page.locator(`${intro(id)}, ${dt("ch3-intro-free")}`).first().waitFor();
      while (await page.locator(dt("ch3-intro-free")).count() && !await page.locator(dt("ch3-intro-visit")).count()) {
        const card = await page.locator(dt("ch3-intro-free")).elementHandle();
        await page.locator(dt("ch3-intro-visit-rest")).click();
        await card.waitForElementState("hidden");
        await page.locator(`${intro(id)}, ${dt("ch3-intro-free")}`).first().waitFor();
      }
      await page.locator(intro(id)).waitFor();
      state = await get(page);
      assert.equal(state.day, startDay + day - 1, `Wrong elapsed day before ${id}`);
      assert.equal(state.slot, slot, `Wrong time slot before ${id}`);
      if (id === "ch3_rest_before_recovery") {
        // 任意場面(#1176 GAP 3-B): 場面カードの「寄り道」から読める。必須の進行・日付・時間帯は動かない。
        const optional = name => dt(`ch3-intro-optional-${name}`);
        await page.locator(dt("ch3-intro-optional-open")).click();
        for (const name of ["ch3_minto_small_lies", "ch3_cigarman_rumor", "ch3_mashiro_play_1", "ch3_mashiro_practice"]) {
          await page.locator(optional(name)).waitFor();
        }
        for (const name of ["ch3_mashiro_play_2", "ch3_emil_workshop", "ch3_cigarman_trace"]) {
          assert.equal(await page.locator(optional(name)).count(), 0, `${name} must not be offered yet`);
        }
        await page.locator(optional("ch3_minto_small_lies")).click();
        await page.locator(intro(id)).waitFor();
        let read = await get(page);
        assert.equal(read.flags._ch3_read_ch3_minto_small_lies, true);
        assert.equal(read.flags._ch3_intro.stage, state.flags._ch3_intro.stage);
        assert.equal(read.day, state.day); assert.equal(read.slot, state.slot); assert.equal(read.phase, state.phase);
        assert.deepEqual(read.tokyoVisits.closedSlots, state.tokyoVisits.closedSlots, "Optional reads must not use a free-time window");
        // 一つ読むと、続きの場面(ましろ2)は読んだ後にだけ現れる。
        await page.locator(dt("ch3-intro-optional-open")).click();
        assert.equal(await page.locator(optional("ch3_minto_small_lies")).count(), 0, "A read scene must not be offered again");
        await page.locator(optional("ch3_mashiro_play_1")).click();
        await page.locator(intro(id)).waitFor();
        await page.locator(dt("ch3-intro-optional-open")).click();
        await page.locator(optional("ch3_mashiro_play_2")).waitFor();
        await page.locator(dt("ch3-intro-optional-back")).click();
        await page.locator(intro(id)).waitFor();
        // リロード跨ぎ: 読了は保存され、再演されず再び提示されない。
        await page.reload();
        await page.locator(dt("title-load")).click();
        await arm(page);
        await page.locator(dt("slot-0")).click();
        await page.locator(intro(id)).waitFor();
        read = await get(page);
        assert.equal(read.flags._ch3_read_ch3_minto_small_lies, true);
        assert.equal(read.flags._ch3_read_ch3_mashiro_play_1, true);
        assert.equal(read.flags._ch3_intro.stage, state.flags._ch3_intro.stage);
        await page.locator(dt("ch3-intro-optional-open")).click();
        assert.equal(await page.locator(optional("ch3_minto_small_lies")).count(), 0, "Reload must not offer a read scene");
        assert.equal(await page.locator(optional("ch3_mashiro_play_1")).count(), 0);
        await page.locator(dt("ch3-intro-optional-back")).click();
        await page.locator(intro(id)).waitFor();
      }
      if (id === "ch3_tournament_eve") {
        // 前夜に会う約束が成立した恋人(みんと)。滞在は大会前日まで、会う時間は前夜の自由時間。
        await page.evaluate(async () => {
          const core = await import("./js/core/state.js");
          const first = core.state.flags._ch3_intro.startDay + 11;
          core.state.tokyoVisits.plans.push({ id: `tokyo.minto.${first}`, characterId: "minto", status: "staying",
            met: true, dateDone: false, arrivalDay: first, returnDay: first + 2,
            meetup: { id: "d12-noon", day: first, slot: 0 }, date: { id: "d13-night", day: first + 1, slot: 1 } });
          core.state.tokyoVisits.closedSlots.push("d12-noon");
          core.save();
        });
      }
      await page.locator(next).click();
    }
    // 前夜(#1176 GAP 3-B): 訪問デートの代わりに前夜の場面を、一度だけ再生する。
    await page.locator(dt("ch3-intro-free")).waitFor();
    state = await get(page);
    assert.equal(state.day, startDay + 12);
    assert.equal(state.slot, 1);
    assert.equal(state.flags._ch3_evening, undefined);
    await recordEntered(page);
    await page.locator(dt("ch3-intro-visit")).click();
    await page.locator(dt("ch3-intro-ready")).waitFor();
    const played = await entered(page);
    assert(played.includes("tournament_date_minto"), `Eve date was not played: ${played}`);
    assert(!played.some(name => name.startsWith("ch3_visit_")), `Eve date played twice: ${played}`);
    state = await get(page);
    assert.deepEqual(state.flags._ch3_evening, { kind: "date", participants: ["minto"], deferred: [] });
    assert.equal(state.flags._story_shuraba_unresolved, undefined);
    assert(state.tokyoVisits.plans[0].dateDone);
    assert(state.tokyoVisits.closedSlots.includes("d13-night"));
    await page.locator(dt("ch3-intro-ready")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch3_intro.stage, scenes.length);
    assert.equal(state.chapter, 3);
    assert.equal(state.day, 42);
    assert.equal(state.phase, "tournament");
    assert.equal(state.flags._ch3_cleared, undefined);
    assert(state.met.kuze && state.met.steve && state.met.volk, "Rivals must be known after the introduction");
    assert.equal(state.flags._ch3_strategy, "aroma");

    // 3. 全国大会
    await page.locator(dt("ch3-intro-tournament")).click();
    await page.locator(t("entry")).waitFor();
    await page.locator(t("start")).click();
    await page.locator(t("ready")).waitFor();
    await page.locator(t("craft-start")).click();
    for (let round = 1; round <= 3; round++) {
      await page.locator(t("votes")).waitFor();
      state = await get(page);
      assert.equal(state.flags._ch3_tournament.voted, round);
      assert.equal(state.flags._ch3_tournament.history.length, 0);
      if (round === 1) {
        // リロード跨ぎ(2): 大会の投票中に実セーブ→ロード。投票が二重に進まない。
        const first = structuredClone(state.flags._ch3_tournament.votes);
        await page.locator(t("menu")).click();
        await page.locator(t("save")).click();
        await page.locator(dt("slot-1")).click();
        await page.reload();
        await page.locator(dt("title-load")).click();
        await arm(page);
        await page.locator(dt("slot-1")).click();
        await page.locator(t("votes")).waitFor();
        const resumed = await get(page);
        assert.equal(resumed.flags._ch3_tournament.voted, 1, "The first poll must not run twice after LOAD");
        assert.deepEqual(resumed.flags._ch3_tournament.votes, first);
      }
      await page.locator(t("continue")).click();
    }
    await page.locator(t("result")).waitFor();
    state = await get(page);
    const result = state.flags._ch3_tournament.result;
    assert.equal(state.flags._ch3_tournament.voted, 4);
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert.equal(result.rank, 1, "A Chapter 2 level character should be able to win with a well-made craft");
    assert.equal(result.win, true);
    assert.equal(state.flags._ch3_tournament_won, undefined, "Win cannot be committed before the result scene");
    assert.deepEqual(Object.values(result.votes).map(row => Object.values(row).reduce((sum, points) => sum + points, 0)),
      [10, 10, 10], "Each judge must spend exactly ten points");
    await page.locator(t("continue")).click();
    await page.locator(t("complete")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch3_tournament_won, true);
    assert.equal(state.flags._ch3_japan_first_representative, true);
    assert.equal(state.phase, "aftermath");
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert.equal(state.flags._ch3_cleared, undefined, "Post-win Tokyo scenes still remain");

    // 4. 帰郷・aftermath
    await page.locator(t("aftermath")).click();
    const aftermath = id => `[data-test="ch3-aftermath-scene"][data-scene="${id}"]`;
    const after = ["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile", "ch3_enmaku_cleanup",
      "ch3_home_customer", "ch3_tsumugi_result", "ch3_ageha_reunion"];
    for (const [index, id] of after.entries()) {
      await page.locator(aftermath(id)).waitFor();
      await page.locator(dt("ch3-aftermath-continue")).click();
      if (index === 0) {
        // リロード跨ぎ(3): aftermath 1場面目の後。優勝が再演されず次の場面から続く。
        await page.locator(aftermath(after[1])).waitFor();
        await page.reload();
        await page.locator(dt("title-load")).click();
        await arm(page);
        await page.locator(dt("slot-0")).click();
        await page.locator(aftermath(after[1])).waitFor();
        assert.equal((await get(page)).flags._ch3_aftermath.stage, 1,
          "Reload must resume after the hotel scene without replaying the win");
      }
    }
    await page.locator(dt("ch3-aftermath-complete")).waitFor();

    // 5. 最終state
    state = await get(page);
    assert.equal(state.chapter, 3, "No Chapter 4 exit exists yet; the save stays in Chapter 3");
    assert.equal(state.flags._ch4_intro, undefined);
    assert.equal(state.flags._ch3_cleared, true);
    assert.equal(state.phase, "cleared");
    assert.equal(state.flags._ch3_tournament_won, true);
    assert.equal(state.flags._ch3_japan_first_representative, true);
    assert.equal(state.flags._ch3_intro.stage, scenes.length);
    assert.equal(state.flags._ch3_evening.kind, "date", "The eve is resolved once and kept");
    assert.equal(state.flags._ch3_read_ch3_minto_small_lies, true);
    assert.equal(state.flags._ch3_aftermath.stage, after.length);
    assert.equal(state.flags._ch3_tournament.history.length, 1);
    assert(state.day > 42, "Aftermath must advance the calendar past the tournament day");
    await page.reload();
    await page.locator(dt("title-load")).click();
    assert.match(await page.locator(dt("slot-0")).innerText(), /第3章クリア/);
  }, { reducedMotion: "reduce" });

  await check("chapter-three-eve-near-conflict-is-deferred-not-settled", async page => {
    // 前夜に恋人二人が実際に東京にいて、スティーブとも面識がある。茶化しで保留にし、謝罪・破局・和解を確定しない。
    await seed(page);
    await page.locator(intro("ch3_opening")).waitFor({ timeout: 60000 });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state;
      Object.assign(value, { lovers: ["minto", "tsumugi"], contacts: ["sumi", "minto", "tsumugi"] });
      value.flags._ch3_intro.titleSeen = true; value.flags._ch3_intro.prologueStep = 4;
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      value.met.steve = true;
      while (progress.chapterThreeScenes(value)[value.flags._ch3_intro.stage]?.id !== "ch3_tournament_eve") {
        const free = progress.chapterThreeFreeTime(value);
        if (free) { if (!progress.completeChapterThreeFreeTime(value, free.id)) throw new Error("Free time stuck"); continue; }
        const scene = progress.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
        if (!scene || !progress.completeChapterThreeScene(value, scene.id)) throw new Error("Cannot reach the eve");
      }
      const first = value.flags._ch3_intro.startDay + 11;
      for (const id of ["minto", "tsumugi"]) {
        value.tokyoVisits.plans.push({ id: `tokyo.${id}.${first}`, characterId: id, status: "staying", met: true,
          dateDone: false, arrivalDay: first, returnDay: first + 2, meetup: { id: "d12-noon", day: first, slot: 0 },
          date: { id: "d13-night", day: first + 1, slot: 1 } });
      }
      value.tokyoVisits.closedSlots.push("d12-noon");
      if (!progress.completeChapterThreeScene(value, "ch3_tournament_eve")) throw new Error("Eve scene was not completed");
      core.save(); core.requestResumeOnBoot();
    });
    await page.reload();
    await page.locator(dt("ch3-intro-free")).waitFor({ timeout: 60000 });
    await arm(page);
    await recordEntered(page);
    const before = await get(page);
    assert.equal(before.slot, 1);
    await page.locator(dt("ch3-intro-visit")).click();
    await page.locator(dt("ch3-intro-ready")).waitFor();
    const played = await entered(page);
    for (const id of ["ch3_shuraba_open", "ch3_shuraba_minto", "ch3_shuraba_tsumugi", "ch3_shuraba_steve"]) {
      assert(played.includes(id), `${id} was not played: ${played}`);
    }
    assert(!played.some(id => id.startsWith("tournament_date_") || id.startsWith("ch3_visit_") || id.startsWith("shuraba_")),
      `Only the near-conflict is played on the eve: ${played}`);
    let state = await get(page);
    assert.deepEqual(state.flags._ch3_evening, { kind: "near_conflict", participants: ["minto", "tsumugi"],
      deferred: ["minto", "tsumugi"] });
    assert.equal(state.flags._ch3_shuraba_deferred, true);
    assert.equal(state.flags._story_shuraba_unresolved, undefined, "The joke must not record a real unresolved dispute");
    assert.deepEqual(state.lovers, ["minto", "tsumugi"], "Nobody is dumped or reconciled on the eve");
    assert(state.tokyoVisits.plans.every(plan => !plan.dateDone), "Nobody had the eve date");
    assert(state.tokyoVisits.closedSlots.includes("d13-night"));
    assert.equal(state.day, 42); assert.equal(state.phase, "tournament");
    // リロードしても前夜は再演されない。
    await page.reload();
    await page.locator(dt("title-load")).click();
    await arm(page);
    await page.locator(dt("slot-0")).click();
    await page.locator(dt("ch3-intro-ready")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch3_evening.kind, "near_conflict");
  }, { reducedMotion: "reduce" });
});
