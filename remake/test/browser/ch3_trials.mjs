// 第3章の回復後の試作（#1654）を本番の場面カードから通す。制作→講評→カードへ戻り、本筋の予定は進めない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));

async function seed(page, sceneId) {
  await page.evaluate(async sceneId => {
    const core = await import("./js/core/state.js");
    const p = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 20000, stamina: 80 });
    value.stats = { technique: 20, sense: 20, guts: 20, charm: 20, insight: 20 };
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
    if (!p.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    Object.assign(value.flags._ch3_intro, { titleSeen: true, prologueStep: 4 });
    for (;;) {
      const free = p.chapterThreeFreeTime(value);
      if (free) { p.completeChapterThreeFreeTime(value, free.id); continue; }
      const scene = p.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
      if (scene.id === sceneId) break;
      if (!p.completeChapterThreeScene(value, scene.id)) throw new Error(`Blocked at ${scene.id}`);
    }
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save(); core.requestResumeOnBoot();
  }, sceneId);
  await page.reload();
  await page.locator(t("ch3-intro-scene")).waitFor();
}

/** 会話は通常の文字送りで読み、制作は自動操作に任せる。カードへ戻るまで続ける。 */
async function finishTrial(page) {
  await page.locator(t("ch3-intro-trial")).waitFor({ state: "detached" });
  for (let i = 0; i < 600; i++) {
    if (await page.locator(t("ch3-intro-scene")).count()) return;
    if (await page.locator("#vn.active").count()) await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
  }
  throw new Error("Trial did not return to the scene card");
}

await suite("ch3-trials", async check => {
  await check("before-recovery-has-no-trial", async page => {
    await seed(page, "ch3_kuze_advice");
    assert.equal(await page.locator(t("ch3-intro-trial-open")).count(), 0);
  });

  for (const [id, auto] of [["steve", "good"], ["kuze", "good"]]) await check(`trial-${id}-${auto}`, async page => {
    await seed(page, "ch3_volk_first");
    const before = await get(page);
    assert.match(await page.locator(t("ch3-intro-trial-open")).innerText(), /（2）/);
    await page.locator(t("ch3-intro-trial-open")).click();
    await page.locator(t(`ch3-intro-trial-${id}`)).waitFor();
    assert.deepEqual(await get(page), before, "Opening the workbench changed the save");
    await page.evaluate(async auto => { (await import("./js/craft/session.js")).craftTest.auto = auto; }, auto);
    await page.locator(t(`ch3-intro-trial-${id}`)).click();
    await finishTrial(page);
    const after = await get(page);
    const record = after.flags[`_ch3_trial_${id}`];
    assert.equal(record.practiceDone, true);
    assert.equal(record.feedbackRead, true);
    assert(["good", "rough", "failed"].includes(record.result));
    assert.equal(after.flags._ch3_intro.stage, before.flags._ch3_intro.stage, "A trial advanced the story");
    assert.equal(after.day, before.day); assert.equal(after.slot, before.slot);
    assert.equal(after.flags._craft_practice_runs.at(-1).kind, id === "steve" ? "ch3_trial_care" : "ch3_trial");
    assert.match(await page.locator(t("ch3-intro-trial-open")).innerText(), /（1）/, "A finished trial stayed on the card");
    await page.locator(t("ch3-intro-trial-open")).click();
    await page.locator(t(`ch3-intro-trial-${id === "kuze" ? "steve" : "kuze"}`)).waitFor();
    assert.equal(await page.locator(t(`ch3-intro-trial-${id}`)).count(), 0);
    await page.locator(t("ch3-intro-trial-back")).click();
    await page.locator(t("ch3-intro-scene")).waitFor();
  });
});
