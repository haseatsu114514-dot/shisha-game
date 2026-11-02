// 第3章の東京14日を日常ループで遊ぶ（VOL03・版3）。出発の朝（東京DAY1）から、
// DAY1の受付→mukaiの扉（昼・夜の行動を使う本筋）→ DAY2の初出勤（昼）→ 夜の行動で mukai へ（手伝い→帰りに裏口のてつこ）
// → 夜の本筋（肩に残る勝利）→ 奥の部屋で寝る → DAY3 の朝、を実UIで通す。途中で保存→リロードし、同じ時間帯から再開する。
// HUD は TOKYO、地図は東京。帰り道の地元向けの一言は出ない。
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

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5,
      contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    for (const who of ["hajime", "sumi", "pakki", "maezono", "dr_kemuri", "nagumo"]) value.flags[`_intro_${who}`] = true;
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    // 準備3日（ch3_departure_prep が見る）を過ごした出発の朝。新幹線で着いた後から。
    value.day += 3;
    if (!progress.departChapterThree(value)) throw new Error("Departure failed");
    value.flags._ch3_intro.titleSeen = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  });
}

await suite("ch3-tokyo-daily", async check => {
  await check("tokyo-days-run-on-the-daily-loop-with-story-slots-and-mukai", async page => {
    await seed(page);
    await loadSlot(page, 0);
    // DAY1 昼: 東京駅から受付へ（規則を受け取る）→ 夜: mukaiの扉。どちらも行動を使う本筋。
    await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
    await page.locator(dt("rule-sheet-close")).click();
    // DAY2 の朝: 初出勤（配達）で昼を使い、夜の行動の地図が出る。
    await tokyoMap(page, { day: 33, slot: 1 });
    let state = await get(page);
    assert.equal(state.flags._ch3_intro.routeVersion, 3);
    assert.equal(state.flags._ch3_intro.stage, 3, "DAY1 opening, DAY1 arrival and DAY2 work are read");
    for (const flag of ["_ch3_opening_read", "_ch3_registration_read", "_ch3_rules_read", "_ch3_mukai_work_intro_read", "_ch3_delivery_return"])
      assert.equal(state.flags[flag], true, flag);
    assert.equal(state.flags._ch2_region, "tokyo");
    assert.equal(state.phase, "daily");
    const hud = await page.locator(".hud").innerText();
    assert.match(hud, /TOKYO|東京/);
    assert.match(hud, /2\s*\/\s*14/, "Tokyo DAY2 of 14");
    for (const pin of ["ch3_tokyo_park", "ch3_tokyo_shop", "ch3_tokyo_room", "ch3_tokyo_lime"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Tokyo map`);
    assert.equal(await page.locator(dt("pin-tonari")).count(), 0, "The hometown is not on the Tokyo map");

    // 保存→リロード→同じ時間帯（DAY2の夜）の東京の地図から再開。
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 33, slot: 1 });

    // 夜: mukai で手伝う（日当）→ 帰りに裏口のてつこ（行動を使わない）。
    const before = await get(page);
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "店を手伝う" });
    await help.waitFor();
    await help.click();
    await page.locator(dt("tokyo-tetsuko-yes")).waitFor({ timeout: 60000 });
    await page.locator(dt("tokyo-tetsuko-yes")).click();
    // 夜の本筋（肩に残る勝利）→ 奥の部屋で寝る → DAY3 の朝は店の違いの場面（昼の行動を使う）→ 夜の地図。
    await tokyoMap(page, { day: 34, slot: 1 });
    state = await get(page);
    assert.equal(state.money, before.money + 6000, "The day's pay from helping at mukai");
    assert.equal(state.flags._ch3_outings.mukai_help, 1);
    assert.equal(state.flags._ch3_outings.tetsuko, 1, "Tetsuko is met on the way out of mukai");
    assert(state.flags._ch3_intro.stage >= 5, "The night scene and the DAY3 noon scene are read");
    assert.equal(state.flags._ch2_region, "tokyo", "The night is spent in Tokyo");
  });

  await check("tournament-eve-then-the-national-morning-card", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      // DAY13 の朝。作戦の場面（昼）の直前まで読んだ保存。鉄の煙の初来店（DAY12夜）も済み。
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { kuze: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      core.save();
    });
    await loadSlot(page, 0);
    // DAY13 昼: 残したいもの（作戦）→ 夜の行動の地図。鉄の煙の二度目の来店が地図にある。
    await tokyoMap(page, { day: 44, slot: 1 });
    let state = await get(page);
    assert.equal(typeof state.flags._ch3_strategy, "string", "The strategy choice is saved");
    assert.equal(await page.locator(dt("pin-ch3_tokyo_volk")).count(), 1, "Volk's shop holds the second visit");
    await go(page, "ch3_tokyo_room");
    // 夜: 全国大会の前夜 → 過ごし方（約束が無いので休む）→ 寝て DAY14 → 全国大会の朝のカード。
    await page.locator('[data-test="ch3-intro-ready"]').waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.day, 45);
    assert.equal(state.flags._ch3_intro.stage, 20, "Every Tokyo scene is read before the national match");
    assert.equal(state.flags._ch3_evening?.kind, "rest");
    assert.equal(await page.locator('[data-test="ch3-intro-tournament"]').count(), 1);
  });
});
