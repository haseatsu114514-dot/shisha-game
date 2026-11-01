// DJ を本編から開く（DJS10）: 東京の夜の自由時間で DJ ナイトの画面を開き、DJ を同じ画面に重ねて回し、
// 結果を state.dj に記録して保存し、「戻る」で閉じる。時間・お金・体力・好感度は変えない。
// 地図からの入口（chapters/ch3.js）は PR #2166 の完了後に接続するので、ここでは visitDjClub を直接呼ぶ。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));

async function seedNight(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const p = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 20000, stamina: 80 });
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
    if (!p.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    Object.assign(value.flags._ch3_intro, { titleSeen: true, prologueStep: 4 });
    for (let guard = 0; guard < 60; guard++) {
      const window = p.chapterThreeFreeTime(value);
      if (window?.slot === 1) break;
      if (window) { if (!p.completeChapterThreeFreeTime(value, window.id)) throw new Error("window"); continue; }
      const scene = p.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
      if (!scene || !p.completeChapterThreeScene(value, scene.id)) throw new Error("Blocked before a night free time");
    }
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save(); core.requestResumeOnBoot();
  });
  await page.reload();
  await page.locator(t("ch3-intro-free")).waitFor();
}

const djFrame = async page => {
  await page.locator(t("dj-frame")).waitFor();
  for (let i = 0; i < 100; i++) {
    const frame = page.frames().find(f => /previews\/dj\/index\.html/.test(f.url()));
    if (frame && await frame.locator("#exit").count()) return frame;
    await page.waitForTimeout(50);
  }
  throw new Error("DJ frame did not load");
};
const snap = frame => frame.evaluate(async () => (await import("./app.mjs")).snapshot());

await suite("dj-club", async check => {
  await check("dj-night-records-a-set-and-returns", async page => {
    await seedNight(page);
    const before = await get(page);
    const choice = await page.evaluate(async () => {
      const dj = await import("./js/minigames/dj.js"), p = await import("./js/chapters/ch3-progress.js");
      const value = window.__remake.state;
      return dj.djNightChoices(value, p.chapterThreeFreeTime(value));
    });
    assert.equal(choice.length, 1); assert.equal(choice[0].place, "livehouse"); assert.equal(choice[0].consumes, false);
    await page.evaluate(async () => {
      const club = await import("./js/daily/dj-club.js");
      window.__djVisit = club.visitDjClub().then(value => { window.__djVisitDone = value; });
    });
    await page.locator(t("dj-club-menu")).waitFor();
    assert.match(await page.locator(t("dj-club-menu")).innerText(), /DJナイト/);
    assert(!(await page.locator(t("dj-set-1")).isDisabled())); assert(await page.locator(t("dj-set-2")).isDisabled()); assert(await page.locator(t("dj-set-3")).isDisabled());
    assert.match(await page.locator(t("dj-set-2")).innerText(), /SET 1を回しきると開く/);

    await page.locator(t("dj-set-1")).click();
    const frame = await djFrame(page);
    assert(await frame.locator("#exit").isVisible(), "← 戻る is shown when opened from the game");
    let s = await snap(frame);
    assert.equal(s.embedded, true); assert.equal(s.set, 0); assert.equal(s.volume, 0, "follows the game's BGM volume (0 in this test)"); assert.equal(s.muted, false);
    const box = await page.locator(t("dj-frame")).boundingBox(), stage = await page.locator("#stage").boundingBox();
    assert(Math.abs(box.width - stage.width) < 2 && Math.abs(box.height - stage.height) < 2, "DJ covers the game stage");
    // The DJ really runs inside the game: ▶ A starts the set.
    await frame.locator("#play-a").click();
    for (let i = 0; i < 100 && !(s = await snap(frame)).running; i++) await page.waitForTimeout(50);
    assert(s.running); assert.deepEqual(s.playing, [true, false]);

    // A finished set posts its result. Only results from this frame for this set are recorded.
    await page.evaluate(() => window.postMessage({ type: "dj-result", set: 1, rank: "S", total: 99, floor: 99 }, location.origin));
    await frame.evaluate(() => window.parent.postMessage({ type: "dj-result", set: 2, rank: "S", total: 99, floor: 99 }, location.origin));
    await frame.evaluate(() => window.parent.postMessage({ type: "dj-result", set: 1, rank: "A", total: 84, floor: 90 }, location.origin));
    await page.locator(".toast", { hasText: "SET 1 自己ベスト A・84点" }).waitFor();
    let value = await get(page);
    assert.deepEqual(value.dj.sets[1].best, { rank: "A", total: 84, floor: 90, chapter: 3, day: before.day }); assert.equal(value.dj.sets[1].plays, 1); assert.equal(value.dj.bestRank, "A");
    assert.equal(value.dj.sets[2].plays, 0, "a result for another set is ignored");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.dj?.bestRank);
    assert.equal(saved, "A", "recorded to the autosave");

    await frame.locator("#exit").click();
    await page.locator(t("dj-frame")).waitFor({ state: "detached" });
    await page.locator(t("dj-club-menu")).waitFor();
    assert(!(await page.locator(t("dj-set-2")).isDisabled()), "SET 2 opens after SET 1");
    assert.match(await page.locator(t("dj-set-1")).innerText(), /自己ベスト A・84点 · 1回/);

    await page.locator(t("dj-club-back")).click();
    await page.waitForFunction(() => window.__djVisitDone === false);
    value = await get(page);
    for (const key of ["day", "slot", "money", "stamina", "chapter", "phase"]) assert.deepEqual(value[key], before[key], key);
    assert.deepEqual(value.affinity, before.affinity); assert.deepEqual(value.flags._ch3_intro, before.flags._ch3_intro, "no free time used");
  });
});
