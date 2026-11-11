// #2020 F 第5章の決戦前の実制作練習: 閉店後の試作の会話を終えた夜の tonari で「閉店後の作業台」が出る。
// 実際にダブルアップルを提供まで作り（自動操作）、スミさんの講評を読んで記録する。断ればいつもの tonari、
// 戻れば行動を使わない。講評だけ中断した保存は、次の tonari で講評から読む（作り直さない）。
// BASE_URL=http://127.0.0.1:8151/remake/ node remake/test/browser/ch5_sumi_trial.mjs
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const mapReady = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector('.map:not(.done):not([data-revealing="true"]) [data-test=pin-tonari]') && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
async function go(page, pin) {
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
}
const RESULTS = ["great", "holes", "heat", "steam", "pull", "failed"];

/** 第5章の自由行動。閉店後の練習と試作の会話（熱→直す）を終えた夜の保存。 */
async function seed(page, { slot = 1, trial = undefined } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ slot, trial }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day: 53, slot, phase: "daily", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: "home", _ch5_region_started: true, _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
        read: { ch5_bridge_after_return: true, ch5_opening: true, ch5_free_mashiro_visit: true,
          ch5_free_first_visitor: true, ch5_free_tonari_practice: true },
        scheduleDecision: null, aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null,
        prep: { trial: "heat", adjusted: true } },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true,
      ...(trial ? { _ch5_sumi_trial: trial } : {}) };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  }, { slot, trial });
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page);
  await page.locator(dt("slot-0")).click();
}

await suite("ch5-sumi-trial", async check => {
  await check("night-tonari-offers-one-real-cup-and-sumi-answers", async page => {
    await seed(page);
    await mapReady(page, { day: 53, slot: 1 });
    const before = await get(page);
    // 戻る: 行動を使わず地図へ
    await go(page, "tonari");
    await page.locator(dt("ch5-sumi-trial")).waitFor();
    await page.locator(dt("ch5-sumi-trial-cancel")).click();
    await mapReady(page, { day: 53, slot: 1 });
    assert.equal((await get(page)).flags._ch5_sumi_trial, undefined);
    // 一台作る: 導入 → 実制作（自動・上手）→ スミさんの講評 → 夜が明ける
    await go(page, "tonari");
    await page.locator(dt("ch5-sumi-trial")).waitFor();
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    const seen = page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      window.__trialScenes = [];
      const previous = vn.hooks.onEnter;
      vn.hooks.onEnter = (id, dialogue) => { window.__trialScenes.push(id); previous?.(id, dialogue); };
    });
    await seen;
    await page.locator(dt("ch5-sumi-trial")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5_sumi_trial?.feedbackRead === true, null, { timeout: 180000 });
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = null; });
    await mapReady(page, { day: 54, slot: 0 });
    let state = await get(page);
    const trial = state.flags._ch5_sumi_trial;
    assert(RESULTS.includes(trial.result), `result ${trial.result}`);
    const scenes = await page.evaluate(() => window.__trialScenes);
    assert.deepEqual(scenes.filter(id => /^ch5_sumi_trial/.test(id)), ["ch5_sumi_trial_intro", `ch5_sumi_trial_${trial.result}`]);
    assert.deepEqual(state.flags._ch5.prep, { trial: "heat", adjusted: true }, "試作の会話の記録はそのまま");
    assert.equal(state.flags._ch5.part, "free", "進行は止めない・進めない");
    assert.equal(state.money, before.money, "葉は店のもの。お金は使わない");
    assert.deepEqual(state.stats, before.stats);
    // 一度だけ: 次の夜の tonari では作業台を出さず、いつもの tonari の場面（つむぎの接客）へ
    await go(page, "rest");
    await mapReady(page, { day: 54, slot: 1 });
    await go(page, "tonari");
    await page.waitForFunction(() => window.__remake.state.flags._ch5.read.ch5_tsumugi_serving === true, null, { timeout: 60000 });
    assert.equal(await page.locator(dt("ch5-sumi-trial")).count(), 0);
    state = await get(page);
    assert.deepEqual(state.flags._ch5_sumi_trial, trial, "作り直さない");
  }, { reducedMotion: "reduce" });

  await check("declining-goes-to-the-usual-tonari-and-asks-again-another-night", async page => {
    await seed(page);
    await mapReady(page, { day: 53, slot: 1 });
    await go(page, "tonari");
    await page.locator(dt("ch5-sumi-trial-usual")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5.read.ch5_tsumugi_serving === true, null, { timeout: 60000 });
    await mapReady(page, { day: 54, slot: 0 });
    const state = await get(page);
    assert.equal(state.flags._ch5_sumi_trial, undefined, "断っても権利は残る");
    assert.equal(state.visitedDay.ch5_sumi_trial, 53);
    // 昼の tonari では出さない
    await go(page, "tonari");
    await page.waitForFunction(() => window.__remake.state.slot === 1 || !!document.querySelector('[data-test="tonari-customer"]'), null, { timeout: 60000 });
    assert.equal(await page.locator(dt("ch5-sumi-trial")).count(), 0, "昼は閉店後の作業台を出さない");
  }, { reducedMotion: "reduce" });

  await check("interrupted-feedback-resumes-without-crafting-again", async page => {
    await seed(page, { slot: 0, trial: { result: "pull", feedbackRead: false } });
    await mapReady(page, { day: 53, slot: 0 });
    await go(page, "tonari");
    await page.waitForFunction(() => window.__remake.state.flags._ch5_sumi_trial?.feedbackRead === true, null, { timeout: 60000 });
    await mapReady(page, { day: 53, slot: 1 });
    const state = await get(page);
    assert.deepEqual(state.flags._ch5_sumi_trial, { result: "pull", feedbackRead: true });
    assert.equal(state.flags._ch5.read.ch5_tsumugi_serving, undefined, "この訪問は講評だけ");
  }, { reducedMotion: "reduce" });
});
