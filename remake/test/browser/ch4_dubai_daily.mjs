// 第4章のドバイを日常ループで遊ぶ（VOL04・版2）。出発の朝（ドバイDAY1）の到着・宿の場面から、ドバイの地図へ。
// スークの初訪問（市場→最初の出会い）→ FESTA（代金3,000円）→ 夜 → 翌朝、宿で休むと道具の手入れ、を実UIで通す。
// もう一件は、DAY12の夜を越えると前夜祭の日（DAY13）の前夜の流れへ入り、必須の場面が並ぶこと。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const dubaiMap = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show")
    // 新しく出た行き先（心得の盤の火種があるとモスク）のお披露目の間はピンを押せないので、終わるのを待つ
    && !document.querySelector(".map[data-revealing]");
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

/** 第3章クリアから第4章へ入り、準備3日と出発前の2場面を済ませた、出発の朝の保存。 */
async function seed(page, adjust = null) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async adjustSource => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5,
      lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "nagumo", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { naru: true });
    if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("Departure failed");
    if (adjustSource) (0, eval)(adjustSource)(value, progress);
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  }, adjust ? adjust.toString() : null);
}

await suite("ch4-dubai-daily", async check => {
  await check("dubai-days-run-on-the-daily-loop", async page => {
    await seed(page);
    await loadSlot(page, 0);
    // 到着と宿（プロローグの残り2場面）は今までどおりのカード。
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) {
      await page.locator(`[data-test="ch4-scene"][data-scene="${id}"]`).waitFor({ timeout: 60000 });
      await page.locator(dt("ch4-continue")).click();
    }
    await dubaiMap(page, { day: 49, slot: 0 });
    let state = await get(page);
    assert.equal(state.flags._ch4.routeVersion, 2);
    assert.equal(state.flags._ch4.part, "free");
    assert.equal(state.flags._ch2_region, "dubai");
    const hud = await page.locator(".hud").innerText();
    assert.match(hud, /DUBAI|ドバイ/);
    assert.match(hud, /1\s*\/\s*14/, "Dubai DAY1 of 14");
    for (const pin of ["ch4_dubai_souq", "ch4_dubai_festa", "ch4_dubai_cafe", "ch4_dubai_practice", "ch4_dubai_creek", "ch4_dubai_shop", "ch4_dubai_naru"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Dubai map`);
    assert.equal(await page.locator(dt("pin-ch4_dubai_alley")).count(), 0, "The alley appears after the market meeting");
    // 昼: スーク（市場→最初の出会い）。夜: FESTA（3,000円）。
    await go(page, "ch4_dubai_souq");
    await dubaiMap(page, { day: 49, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_dubai_souq, true);
    assert.equal(state.flags._ch4.read.ch4_stranger_first, true);
    assert.equal(state.flags._ch4.firstDay, 1);
    const money = state.money;
    await go(page, "ch4_dubai_festa");
    await dubaiMap(page, { day: 50, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_festa, true);
    assert.equal(state.money, money - 3000, "FESTA charges for the cup");
    assert.equal(state.flags._ch4.day, 2, "The chapter day follows the calendar");
    assert.equal(state.flags._ch2_region, "dubai", "The night is spent at the inn in Dubai");
    // 2日目の昼: 宿で休むと、最初の一回は道具の手入れ（本筋）。
    await go(page, "ch4_dubai_inn");
    await dubaiMap(page, { day: 50, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_inn_tool_care, true);
    // 保存→リロード→同じ時間帯のドバイの地図から再開。路地裏はまだ（出会いの2日後から）。
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 50, slot: 1 });
    assert.equal(await page.locator(dt("pin-ch4_dubai_alley")).count(), 0);
  });

  // FESTA（審査員の太陽と会う場面）に寄らないまま DAY6 の夜を迎えると、その夜に会場の出張ブースで読む。
  await check("festa-is-read-on-its-deadline-night-if-skipped", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      p.read.ch4_inn_tool_care = true;
      value.day = p.startDay + 5; value.slot = 1; p.day = 6;
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 54, slot: 1 });
    let state = await get(page);
    assert.notEqual(state.flags._ch4.read.ch4_festa, true);
    await go(page, "ch4_dubai_creek");
    await dubaiMap(page, { day: 55, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_festa, true, "FESTA is read on the deadline night");
    assert.notEqual(state.flags._ch4.read.ch4_stranger_first, true, "The market meeting waits for its own deadline");
  });

  await check("the-night-of-day-twelve-leads-to-the-eve-of-the-world-tournament", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 11; value.slot = 1; p.day = 12;
      p.read.ch4_stranger_second = true;
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 60, slot: 1 });
    assert.equal(await page.locator(dt("pin-ch4_dubai_alley")).count(), 1, "The alley is open after the promise");
    await go(page, "ch4_dubai_inn");
    // DAY12 の夜を越えると DAY13（前夜祭の日）の前夜の流れ。前夜祭の繋ぎ場面から。
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor({ timeout: 60000 });
    const state = await get(page);
    assert.equal(state.flags._ch4.part, "eve");
    assert.equal(state.flags._ch4.day, 13);
    assert.equal(state.day, 61);
    assert.match(await page.locator(dt("ch4-eve")).innerText(), /DAY 13・前夜/);
  });
});
