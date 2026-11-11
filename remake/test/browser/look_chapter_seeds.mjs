// 見た目の様式の検査（look_neo_portrait.mjs・look_retro.mjs）で共有する、第2〜5章の保存の用意。
// 新版の縦持ちも DS風も同じ外枠（js/looks/retro.js）で全章を写すので、同じ場面から確かめる（LK13・LK21）。
const t = (id) => `[data-test="${id}"]`;

/** 会話を速送りにし、選択肢は先頭を選ぶ。 */
export const arm = (page) => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});

/** 第1章をクリアした直後から、第2章の初日（配達の地図）へ。 */
export async function seedChapterTwoFirstDay(page) {
  await arm(page);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 1, phase: "cleared", day: 14, slot: 2, money: 45678, stamina: 67 });
    value.owned.push("home_rig_set");
    Object.assign(value.flags, { _ev_midcheck: true, _ch1_preview_seen: true, _minto_name_known: true, _minto_identity_known: true,
      _lime_tut: 1, _lime_opened: true, _intro_dr_kemuri: true });
    value.met = { hajime: true, sumi: true, minto: true, tsumugi: true, dr_kemuri: true };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    (await import("./js/chapters/ch1.js")).setupHooks();
    await (await import("./js/chapters/ch1.js")).showClear();
  });
  // 第1章のクリアの画面（成長のグラフ・次の章へ）も縦長のシートで写り、写しのボタンから第2章へ進む
  await page.locator('.retro-sheet[data-kind="end"] svg').waitFor({ timeout: 20000 });
  await page.locator(t("sheet-end-chapter2")).tap();
}

/** 第2章の DAY2（配達を終えた後の日常）の朝から。 */
export async function seedChapterTwoDaily(page) {
  await arm(page);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: "daily", day: 15, slot: 2, money: 36000, stamina: 100, weatherSeed: 7, lastBaitoDay: 15 });
    value.flags = { _rei_trpg_introduced: true, _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
      _ch2_city_visit_c_station: true, _lime_tut: 1, _lime_opened: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    value.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    value.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true, ageha: true, kumicho: true, rei: true, volk: true };
    value.contacts = ["sumi", "naru"];
    for (const id of ["ageha", "kumicho", "rei"]) value.flags[`_intro_${id}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    (await import("./js/chapters/ch1.js")).setupHooks();
    void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
  });
}

/** 第3章: 第2章をクリアして東京へ出発した朝の保存（ch3_tokyo_daily.mjs と同じ）。cards は旧い行程（場面カード）の自由時間の前。 */
export async function seedChapterThree(page, { cards = false } = {}) {
  await page.evaluate(async (cards) => {
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
    if (cards) Object.assign(value.flags._ch3_intro, { routeVersion: 2, prologueStep: 4 });
    const plan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: plan.map(() => null), used: plan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    Object.assign(core.state, value); core.save();
    if (cards) core.requestResumeOnBoot();
  }, cards);
}

/** 第4章: ドバイに着いた朝の保存（ch4_dubai_daily.mjs と同じ。到着と宿の場面は読んだ後）。 */
export async function seedChapterFour(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { naru: true });
    if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("Departure failed");
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    Object.assign(core.state, value); core.save();
  });
}

/** 第5章: 地元の自由行動の日の保存。 */
export async function seedChapterFive(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: "home", _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true, read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null,
        aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    const plan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: plan.map(() => null), used: plan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig(); core.save();
  });
}
