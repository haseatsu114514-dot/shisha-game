// 東京の地図と、会員資格を引き継ぐ一度きりの自由行動を本番LOADから確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
async function seed(page, { member = false, at = "initial" } = {}) {
  await page.evaluate(async ({ member, at }) => {
    const core = await import("./js/core/state.js");
    const p = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 20000, stamina: 80 });
    value.stats = { technique: 20, sense: 20, guts: 20, charm: 20, insight: 20 };
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" },
      ...(member ? { _gym_member: true } : {}) };
    if (!p.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    Object.assign(value.flags._ch3_intro, { titleSeen: true, prologueStep: 4 });
    if (at === "free") {
      while (!p.chapterThreeFreeTime(value)) {
        const scene = p.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
        if (!scene || !p.completeChapterThreeScene(value, scene.id)) throw new Error("No gym window");
      }
    }
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save(); core.requestResumeOnBoot();
  }, { member, at });
  await page.reload();
  await page.locator(t(at === "free" ? "ch3-intro-free" : "ch3-intro-scene")).waitFor();
}
async function visibleInViewport(page, selector) {
  const rectangles = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const b = node.getBoundingClientRect();
    return { text: node.textContent, width: b.width, height: b.height,
      fits: b.x >= -1 && b.y >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 };
  }));
  assert(rectangles.length);
  for (const rect of rectangles) assert(rect.width > 0 && rect.height > 0 && rect.fits, JSON.stringify(rect));
}
async function readGym(page) {
  await page.locator("#vn.active").waitFor();
  for (let i = 0; i < 100; i++) {
    if (!await page.locator("#vn.active").count()) return;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(70);
  }
  throw new Error("Gym did not finish through normal text input");
}
const resources = value => ({ money: value.money, stamina: value.stamina, stats: value.stats,
  visitedDay: value.visitedDay, spotVisits: value.spotVisits,
  fit: value.flags._fit_since, closed: value.tokyoVisits.closedSlots });

await suite("ch3-map-activities", async check => {
  for (const touch of [false, true]) await check(touch ? "map-and-gym-touch" : "map-and-gym-pc", async page => {
    await seed(page);
    const before = await get(page);
    await page.locator(t("ch3-map-open")).click();
    await page.locator(`${t("ch3-map")} [data-place="gym"]`).first().click();
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-test="ch3-map-image"]');
      return image?.complete && image.naturalWidth > 0;
    });
    assert.doesNotMatch(await page.locator(t("ch3-map")).innerText(), /煙幕|Smoke & Glory|鉄の煙|久世|ヴォルク/);
    assert.match(await page.locator(t("ch3-map-details")).innerText(), /会員登録が必要/);
    assert.equal(await page.locator(t("ch3-map-gym")).count(), 0);
    await visibleInViewport(page, '.ch3-map-dialog, .ch3-map-canvas, .ch3-map-pin, .ch3-map-close');
    await page.keyboard.press("Escape");
    await page.locator(t("ch3-map")).waitFor({ state: "detached" });
    assert(await page.locator(t("ch3-map-open")).evaluate(node => node === document.activeElement));
    assert.deepEqual(await get(page), before, "Viewing a map changed the save");

    await seed(page, { member: true, at: "free" });
    const freeBefore = await get(page);
    await page.locator(t("ch3-intro-map")).click();
    await page.locator(t("ch3-map-gym")).waitFor();
    assert.match(await page.locator(t("ch3-map-details")).innerText(), /追加の入会費はかかりません/);
    await page.keyboard.press("Escape");
    await page.locator(t("ch3-map")).waitFor({ state: "detached" });
    assert(await page.locator(t("ch3-intro-map")).evaluate(node => node === document.activeElement));
    assert.deepEqual(await get(page), freeBefore, "Closing a free-time map changed the card or save");
    await page.locator(t("ch3-intro-map")).click();
    await page.locator(t("ch3-map-gym")).click();
    await readGym(page);
    await page.locator(t("ch3-intro-scene")).waitFor();
    const after = await get(page);
    assert.equal(after.money, freeBefore.money, "A member was charged again");
    assert.equal(after.stamina, freeBefore.stamina - 8);
    assert.equal(after.stats.charm, freeBefore.stats.charm + 2);
    assert.equal(after.flags._ch3_intro.stage, freeBefore.flags._ch3_intro.stage, "Gym skipped a story scene");
    assert.deepEqual(after.flags._fit_since, { chapter: 3, day: freeBefore.day });
    assert.equal(after.visitedDay.choizap, freeBefore.day);
    assert.equal(after.tokyoVisits.closedSlots.length, freeBefore.tokyoVisits.closedSlots.length + 1);
    const settled = resources(after);
    assert.equal(await page.evaluate(async () => (await import("./js/chapters/ch3-activities.js"))
      .visitChapterThreeGym("d5-noon")), false);
    assert.deepEqual(resources(await get(page)), settled);
    await page.evaluate(async () => { (await import("./js/core/state.js")).requestResumeOnBoot(); });
    await page.reload();
    await page.locator(t("ch3-intro-scene")).waitFor();
    assert.deepEqual(resources(await get(page)), settled, "LOAD repeated gym rewards");
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

  await check("gym-interruption-and-rest", async page => {
    await seed(page, { member: true, at: "free" });
    const before = await get(page);
    await page.locator(t("ch3-intro-gym")).click();
    await page.locator("#vn.active").waitFor();
    await page.evaluate(async () => { (await import("./js/core/state.js")).requestResumeOnBoot(); });
    await page.reload();
    await page.locator(t("ch3-intro-free")).waitFor();
    assert.deepEqual(resources(await get(page)), resources(before), "Interrupted training changed resources");
    await page.locator(t("ch3-intro-visit-rest")).click();
    await page.locator(t("ch3-intro-scene")).waitFor();
    const after = await get(page);
    assert.equal(after.flags._ch3_intro.stage, before.flags._ch3_intro.stage);
    assert(after.stamina > before.stamina);
    assert.deepEqual(after.stats, before.stats);
    assert.equal(after.money, before.money);
    const settled = resources(after);
    assert.equal(await page.evaluate(async () => (await import("./js/chapters/ch3-activities.js"))
      .restChapterThreeFreeTime("d5-noon")), false);
    assert.deepEqual(resources(await get(page)), settled);
  });

  await check("map-image-failure-is-closable", async page => {
    await seed(page);
    await page.route("**/bg_tokyo_map_day.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "invalid-image" }));
    const before = await get(page);
    await page.locator(t("ch3-map-open")).click();
    await page.locator(t("ch3-map-image-error")).waitFor({ state: "visible" });
    await page.locator(t("ch3-map-close")).click();
    await page.locator(t("ch3-map")).waitFor({ state: "detached" });
    assert.deepEqual(await get(page), before);
  });
});
