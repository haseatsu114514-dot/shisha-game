// 第3章の出発前の準備3日（VOL02・2026-11-02 オーナー「遠出する章は3日前に準備期間をあげたい」）。
// 第2章クリア後に第3章へ入った保存で、準備1日目の朝のtonari → 地元・柚ヶ谷の日常ループ3日
// （3日目の昼に耳鼻科、夜に出発前夜）→ 出発の朝の新幹線 → 東京DAY1の場面カード、を実UIで通す。
// 途中で保存→リロードし、同じ日・同じ時間帯から再開することも確認する。章頭の回想と章題は ch2_tournament が見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
// 再開時に章の側が hooks を差し替えるので、地図が出てから仕掛ける（以後に読んだ会話を記録）。
const recordEntered = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  window.__entered ||= [];
  const previous = vn.hooks.onEnter;
  vn.hooks.onEnter = (id, dialogue) => { window.__entered.push(id); previous?.(id, dialogue); };
});
const entered = page => page.evaluate(() => window.__entered || []);
const mapReady = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector(".map:not(.done) [data-test=pin-rest]") && !document.querySelector("#modal.show");
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

async function seed(page, { regulars = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async regulars => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5,
      contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    for (const who of ["ageha", "kumicho", "rei", "hajime", "sumi"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { ageha: true, kumicho: true, rei: true });
    // 地元の常連（N3a）: 第1章でEDENに一度通った保存（初対面の固有会話の後。LIMEの交換前なので誘いは来ない）。
    // 好感度は2本目の段階会話（♥1）に届かない値にし、地図の「！」が送り出しの会話だけから付くようにする。
    if (regulars) {
      Object.assign(value.met, { adam: true });
      Object.assign(value.story, { adam: 1 });
      Object.assign(value.visits, { adam: 1 });
      value.affinity.adam = 4;
      value.flags._spot_guide_adam = true;
    }
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、この章の出現は済んだことにする。
    const fortune = await import("./js/daily/fortune-schedule.js");
    const fortunePlan = fortune.fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    // 章頭の回想・調べもの・章題は ch2_tournament が見る。ここは準備1日目の朝のtonariから。
    value.flags._ch3_prep.step = 3;
    value.flags._ch3_intro.titleSeen = true;
    // 出発の朝までを確かめる。東京の日常ループ（版3）の始まりは ch3_tokyo_daily が見るので、ここは東京DAY1の場面カードで止める。
    value.flags._ch3_intro.routeVersion = 2;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  }, regulars);
}

await suite("ch3-departure-prep", async check => {
  await check("three-prep-days-at-home-then-shinkansen-to-tokyo-day-one", async page => {
    await seed(page);
    await loadSlot(page, 0);
    // 準備1日目の朝: スミさんの段取りの後、地元の地図（日常ループ）。
    await mapReady(page, { day: 29, slot: 0 });
    let state = await get(page);
    assert.deepEqual([state.chapter, state.phase, state.flags._ch3_prep.step, state.flags._ch3_prep.departed], [3, "daily", 4, false]);
    await recordEntered(page);
    let hud = await page.locator(".hud").innerText();
    assert.match(hud, /出発まで/);
    assert.match(hud, /あと3日/);
    assert.match(hud, /1\s*\/\s*3/);
    assert.equal(await page.locator(dt("pin-tonari")).count(), 1, "The home map is the hometown");
    // 1日目: 家で二度休む → 夜 → 翌朝。
    await go(page, "rest");
    await mapReady(page, { day: 29, slot: 1 });
    await go(page, "rest");
    await mapReady(page, { day: 30, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch3_prep.departed, false);
    assert.match(await page.locator(".hud").innerText(), /あと2日/);
    // 2日目の昼で保存→リロード→同じ日・時間帯から再開（準備の地図のまま）。
    await loadSlot(page, 0);
    await mapReady(page, { day: 30, slot: 0 });
    assert.equal((await get(page)).flags._ch3_prep.step, 4);
    await recordEntered(page);
    await go(page, "rest");
    await mapReady(page, { day: 30, slot: 1 });
    await go(page, "rest");
    // 3日目（東京へ発つ前の日）: 朝に耳鼻科で昼の行動を使い、夜の行動が一つ残る。
    await mapReady(page, { day: 31, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch3_prep_clinic, true, "The clinic uses the last day's noon");
    assert((await entered(page)).includes("ch3_prep_clinic"));
    assert.match(await page.locator(".hud").innerText(), /あと1日/);
    await go(page, "rest");
    // 出発前夜のtonari → 出発の朝の新幹線 → 東京DAY1の場面カード。
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_opening"]').waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.flags._ch3_prep_farewell, true);
    for (const id of ["ch3_prep_farewell", "ch3_train_departure", "ch3_train_arrival"]) assert((await entered(page)).includes(id), id);
    assert.equal((await entered(page)).filter(id => id === "ch3_childhood_opening").length, 0, "The childhood memory does not replay at departure");
    assert.deepEqual([state.day, state.slot, state.phase], [32, 0, "opening"]);
    assert.equal(state.flags._ch3_prep.departed, true);
    assert.equal(state.flags._ch3_intro.startDay, 32, "Tokyo DAY1 is the departure morning");
    assert.equal(state.flags._ch3_intro.stage, 0);
    assert.equal(state.flags._ch2_region, "home");
    assert.match(await page.locator('[data-test="ch3-intro-scene"]').innerText(), /DAY 1/);
  });

  // N3a: 準備期間の来店で、地元の常連が一度だけ送り出しの会話をする（2回目はいつもの来店）。
  await check("hometown-regular-send-off-talk-once", async page => {
    await seed(page, { regulars: true });
    await loadSlot(page, 0);
    await mapReady(page, { day: 29, slot: 0 });
    await recordEntered(page);
    assert.equal(await page.locator(`${dt("pin-adam")} .evt-badge.story`).count(), 1, "EDEN shows that there is something new");
    await go(page, "adam");
    await mapReady(page, { day: 29, slot: 1 });
    let state = await get(page);
    assert.equal(state.flags._talk_seen_ch3_prep_adam, true);
    assert((await entered(page)).includes("ch3_prep_adam"), "EDEN: the send-off talk");
    assert(!(await entered(page)).includes("venue_adam_day"), "The talk has its own arrival, so no shop greeting first");
    assert.equal(state.visits.adam, 2, "an ordinary paid visit");
    assert.equal(state.money, 30000 - 3000);
    // 一店に一日一回。次の日にもう一度通うと、送り出しの会話は読み直さない（段階会話などいつもの来店）。
    await go(page, "rest");
    await mapReady(page, { day: 30, slot: 0 });
    await go(page, "adam");
    await mapReady(page, { day: 30, slot: 1 });
    state = await get(page);
    assert.equal((await entered(page)).filter(id => id === "ch3_prep_adam").length, 1, "read once");
    assert.equal(state.visits.adam, 3);
  });
});
