// 東京の自由時間（#1655）: 会員でなくても地図から行き先を選び、読了後に一枠だけ使う。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));

async function seed(page, windowId) {
  await page.evaluate(async windowId => {
    const core = await import("./js/core/state.js");
    const p = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 20000, stamina: 80 });
    value.stats = { technique: 20, sense: 20, guts: 20, charm: 20, insight: 20 };
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
    if (!p.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    Object.assign(value.flags._ch3_intro, { titleSeen: true, prologueStep: 4 });
    for (let guard = 0; guard < 60; guard++) {
      const window = p.chapterThreeFreeTime(value);
      if (window?.id === windowId) break;
      if (window) { if (!p.completeChapterThreeFreeTime(value, window.id)) throw new Error("window"); continue; }
      const scene = p.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
      if (!scene || !p.completeChapterThreeScene(value, scene.id)) throw new Error(`Blocked before ${windowId}`);
    }
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save(); core.requestResumeOnBoot();
  }, windowId);
  await page.reload();
  await page.locator(t("ch3-intro-free")).waitFor();
}

async function readUntilCard(page) {
  await page.locator(t("ch3-intro-free")).waitFor({ state: "detached" });
  for (let i = 0; i < 300; i++) {
    if (await page.locator(`${t("ch3-intro-free")}, ${t("ch3-intro-scene")}`).count()) return;
    if (await page.locator("#vn.active").count()) await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
  }
  throw new Error("Outing did not return to a card");
}

async function choose(page, place, action) {
  await page.locator(t("ch3-intro-map")).click();
  await page.locator(t("ch3-map")).waitFor();
  await page.locator(t(`ch3-map-place-${place}`)).click();
  await page.locator(t(`ch3-map-action-${action}`)).click();
}

await suite("ch3-outings", async check => {
  await check("nonmember-visits-kuze-from-the-map", async page => {
    await seed(page, "d8-night");
    assert.match(await page.locator(t("ch3-intro-map")).innerText(), /行き先を選ぶ/);
    assert.match(await page.locator(".ch2-contest-note").innerText(), /煙幕/);
    const before = await get(page);
    // 地図を開いて閉じるだけでは何も変わらない。
    await page.locator(t("ch3-intro-map")).click();
    await page.locator(t("ch3-map")).waitFor();
    assert.equal(await page.locator(t("ch3-map-place-steve")).count(), 0, "Unvisited rival shop on the map");
    await page.keyboard.press("Escape");
    await page.locator(t("ch3-map")).waitFor({ state: "detached" });
    assert.deepEqual(await get(page), before);

    await choose(page, "enmaku", "enmaku_notes");
    await readUntilCard(page);
    const after = await get(page);
    assert.equal(after.stamina, before.stamina - 10);
    assert.deepEqual(after.flags._ch3_outings, { enmaku_notes: 1 });
    assert(after.tokyoVisits.closedSlots.includes("d8-night"));
    assert.equal(after.flags._ch3_intro.stage, before.flags._ch3_intro.stage);
    assert(after.stats.insight > before.stats.insight, "A chosen, tiring visit should grow its stat");
  });

  await check("mukai-help-pays-and-park-rests", async page => {
    await seed(page, "d5-noon");
    const before = await get(page);
    await choose(page, "mukai", "mukai_help");
    await readUntilCard(page);
    const mid = await get(page);
    assert.equal(mid.money, before.money + 6000);
    assert.equal(mid.stamina, before.stamina - 14);
    assert.deepEqual(mid.flags._ch3_outings, { mukai_help: 1 });
    // 次の自由時間で公園を歩くと、能力は増やさず体力だけ戻る。
    for (let i = 0; i < 20 && !await page.locator(t("ch3-intro-free")).count(); i++) {
      await page.locator(t("ch3-intro-continue")).click();
      await readUntilCard(page).catch(() => {});
    }
    await page.locator(t("ch3-intro-free")).waitFor();
    const rested = await get(page);
    await choose(page, "park", "park_walk");
    await readUntilCard(page);
    const after = await get(page);
    assert.equal(after.stamina, Math.min(100, rested.stamina + 20));
    assert.deepEqual(after.stats, rested.stats);
    assert.equal(after.flags._ch3_outings.park_walk, 1);
  });
});
