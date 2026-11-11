// 第3章以降の「新しい一台を発見する」連鎖（#2020 G・daily/recipe-finds.js）。
// 1) 第3章の東京の日常ループで、実際の地図から Smoke & Glory に通う → 一服の後にスティーブがヒントを教える（メモ）
//    → レシピ帳に載った後の来店で、名前を付けた一台を返す。代金・体力・好感度は来店のぶんだけ。
// 2) 6件すべての台本が本物の会話の画面で読め、ヒント→返すが一度ずつ。資源は増えない。
// 3) 会話の途中でLOADしたら、何も残さない。
// 店を訪ねるほかの検査では support.mjs が居合わせる人と一緒に止めているので、この検査だけ "suien_recipe_finds" を "on" にする。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const tokyoMap = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector('.map:not(.done) [data-test="pin-ch3_tokyo_mukai"]') && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
async function go(page, pin) {
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
}
async function loadSlot(page, slot = 0) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page);
  await page.locator(dt(`slot-${slot}`)).click();
}
const backlog = page => page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));

/** 第3章の東京DAY13の朝（作戦の場面の前）。スティーブの店の寄り道は読み終え、通いの一服だけが残る。♥2。 */
async function seedTokyo(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5, contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    for (const who of ["hajime", "sumi", "pakki", "maezono", "dr_kemuri", "sui"]) value.flags[`_intro_${who}`] = true;
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    value.day += 3;
    if (!progress.departChapterThree(value)) throw new Error("Departure failed");
    value.flags._ch3_intro.titleSeen = true;
    const fortune = await import("./js/daily/fortune-schedule.js");
    const fortunePlan = fortune.fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    const intro = value.flags._ch3_intro;
    intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
    value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
    Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
    value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
    Object.assign(value.flags, { _lime_contact_steve: true, _ch3_read_ch3_steve_lime: true,
      _ch3_read_ch3_steve_two_timers: true, _ch3_read_ch3_steve_empty_seat: true, _ch3_read_ch3_steve_tongs: true, _ch3_read_ch3_steve_watch: true,
      _ch3_outings: { mukai_steve: 2, steve_timer: 1, steve_visit: 2 } });
    value.affinity.steve = 24; value.money = 10000;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  });
}

/** 店で一服を終えた後の呼び出しを、地図を通さずに確かめる下ごしらえ。 */
async function prepareDirect(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), finds = await import("./js/daily/recipe-finds.js");
    const engine = await import("./js/vn/engine.js"), data = await import("./js/core/data.js");
    const stats = await import("./js/core/stats.js");
    window.R = { core, finds, engine, data, stats, trace: [] };
    engine.vnTest.turbo = true;
    engine.hooks.onLine = (scene, line) => R.trace.push({ scene, speaker: line.speaker, text: line.text });
  });
}

await suite("recipe-finds", async check => {
  await check("steve-hint-then-return-on-the-tokyo-daily-loop", async page => {
    await seedTokyo(page);
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    const before = await get(page);
    // ヒントの会話の最初の行で、来店の精算（代金・好感度）が済んでいることと、その値を記録する
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      window.__findStart = null;
      vn.hooks.onLine = scene => {
        if (scene === "recipe_find_lime_second_puff_hint" && !window.__findStart) {
          const s = window.__remake.state;
          window.__findStart = { money: s.money, steve: s.affinity.steve, stamina: s.stamina };
        }
      };
    });
    await go(page, "ch3_tokyo_steve");
    // メモは一服（代金・好感度の精算）の後に読む会話の中で付く
    await page.waitForFunction(() => window.__remake?.state?.flags?._note_recipe_hint_lime_second_puff === true, null, { timeout: 60000 });
    const after = await get(page);
    const start = await page.evaluate(() => window.__findStart);
    const log = await backlog(page);
    assert.match(log, /マウンテンミストが切れた日の、俺の逃げ道だ/, "Steve tells the mix after the visit");
    assert.equal(start.money, before.money - 4000, "the shop fee is settled before the talk");
    assert.ok(start.steve > before.affinity.steve, "the visit's affinity is settled before the talk");
    assert.deepEqual([after.money, after.affinity.steve, after.stamina], [start.money, start.steve, start.stamina],
      "the talk itself adds no money, affinity or stamina");
    assert.ok(!after.flags._recipe_return_lime_second_puff, "nothing to return yet");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.flags._note_recipe_hint_lime_second_puff, true, "the note is saved");

    // 作ってレシピ帳に載った（配合の確定・家シーシャが書くのと同じ形）。同じ時間帯からやり直して、もう一度通う
    await page.evaluate(async before => {
      const core = await import("./js/core/state.js");
      Object.assign(core.state, { day: before.day, slot: 0, visitedDay: before.visitedDay });
      core.state.recipes.lime_second_puff = { day: before.day, home: true };
      core.state.flags._ch3_intro.stage = before.flags._ch3_intro.stage;
      core.save();
    }, before);
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 0 }); // 作戦の場面は読み終えているので、昼の地図から
    await go(page, "ch3_tokyo_steve");
    await page.waitForFunction(() => window.__remake?.state?.flags?._recipe_return_lime_second_puff === true, null, { timeout: 60000 });
    assert.match(await backlog(page), /名前も付けました。「二口目のライム」です/, "the named recipe goes back to Steve");
  });

  await check("every-chain-reads-hint-then-return-once-without-resources", async page => {
    await prepareDirect(page);
    const result = await page.evaluate(async () => {
      const chains = R.data.DB.recipes.filter(recipe => recipe.find);
      const rows = [];
      for (const recipe of chains) {
        const value = R.core.newGame();
        const chapter = recipe.find.chapters[0];
        Object.assign(value, { chapter, phase: "daily", day: 40, slot: 0, money: 5000, stamina: 80 });
        value.met[recipe.find.person] = true;
        value.affinity[recipe.find.person] = 24;
        R.core.setState(value);
        const resources = () => JSON.stringify([R.core.state.money, R.core.state.stamina, R.core.state.slot, R.core.state.stats, R.core.state.affinity]);
        const start = resources();
        const hintAt = (recipe.find.hint_at || recipe.find.at)[0];
        R.trace = [];
        const hint = await R.finds.recipeFindAfterVisit({ id: hintAt });
        const hintScenes = [...new Set(R.trace.map(x => x.scene))];
        const noted = R.core.state.flags[`_note_${recipe.hint_note}`] === true;
        const early = await R.finds.recipeFindAfterVisit({ id: hintAt }); // 作る前にもう一度来ても何も無い
        R.core.state.recipes[recipe.id] = { day: 41 };
        const backAt = recipe.find.at[recipe.find.at.length - 1];
        R.core.state.chapter = recipe.find.chapters[recipe.find.chapters.length - 1];
        R.trace = [];
        const back = await R.finds.recipeFindAfterVisit({ id: backAt });
        const backScenes = [...new Set(R.trace.map(x => x.scene))];
        const again = await R.finds.recipeFindAfterVisit({ id: backAt });
        const saved = R.core.peekSave();
        rows.push({ id: recipe.id, hint, hintScenes, noted, early, back, backScenes, again,
          returned: saved.flags[`_recipe_return_${recipe.id}`] === true, unchanged: start === resources(),
          named: R.trace.some(x => x.speaker === "hajime" && x.text?.includes(`「${recipe.name}」`)) });
      }
      return rows;
    });
    assert.equal(result.length, 6);
    for (const row of result) {
      assert.equal(row.hint, true, `${row.id}: hint`);
      assert.deepEqual(row.hintScenes, [`recipe_find_${row.id}_hint`], row.id);
      assert.equal(row.noted, true, `${row.id}: noted`);
      assert.equal(row.early, false, `${row.id}: nothing before the recipe is made`);
      assert.equal(row.back, true, `${row.id}: return`);
      assert.deepEqual(row.backScenes, [`recipe_find_${row.id}_return`], row.id);
      assert.equal(row.named, true, `${row.id}: the name is said`);
      assert.equal(row.again, false, `${row.id}: once`);
      assert.equal(row.returned, true, `${row.id}: saved`);
      assert.equal(row.unchanged, true, `${row.id}: no money, stamina, slot, stats or affinity`);
    }
  });

  await check("load-during-the-talk-leaves-no-record", async page => {
    await prepareDirect(page);
    await page.evaluate(() => {
      const value = R.core.newGame();
      Object.assign(value, { chapter: 4, phase: "daily", day: 40, slot: 0 });
      value.met.master_hookah = true; value.affinity.master_hookah = 24;
      R.core.setState(value);
      R.engine.vnTest.turbo = false; R.result = null; R.owner = R.core.state;
      R.pending = R.finds.recipeFindAfterVisit({ id: "ch4_dubai_longlong" }).then(result => { R.result = result; });
    });
    await page.waitForFunction(() => R.engine.isPlaying());
    await page.evaluate(() => R.core.setState(R.core.newState()));
    await page.waitForFunction(() => R.result === false);
    assert.deepEqual(await page.evaluate(() => ({ now: R.core.state.flags._note_recipe_hint_lychee_jasmine_tea,
      returned: R.core.state.flags._recipe_return_lychee_jasmine_tea, playing: R.engine.isPlaying() })),
      { now: undefined, returned: undefined, playing: false });
  });
}, { initScript: () => { try { localStorage.setItem("suien_recipe_finds", "on"); } catch {} } });
