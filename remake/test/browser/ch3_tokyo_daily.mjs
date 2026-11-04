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
    // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、この章の出現は済んだことにする。
    const fortune = await import("./js/daily/fortune-schedule.js");
    const fortunePlan = fortune.fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
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
    for (const pin of ["ch3_tokyo_park", "ch3_tokyo_shop", "ch3_tokyo_room"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Tokyo map`);
    assert.equal(await page.locator(dt("pin-tonari")).count(), 0, "The hometown is not on the Tokyo map");
    // 地元との連絡は地図の行き先ではなく、右上の LIME のトーク一覧の一番上の行（オーナー決定 2026-11-02）。
    assert.equal(await page.locator(dt("pin-ch3_tokyo_lime")).count(), 0, "No map pin for hometown contacts");
    const slotBefore = (await get(page)).slot;
    await page.locator(dt("hud-phone")).click();
    await page.locator(dt("lime-shortcut-tokyo_contacts")).click();
    await page.locator(".lime-title", { hasText: "地元との連絡" }).waitFor({ timeout: 30000 });
    await page.locator(dt("phone-close")).last().click();
    await tokyoMap(page, { day: 33 });
    assert.equal((await get(page)).slot, slotBefore, "Opening hometown contacts uses no time");

    // 保存→リロード→同じ時間帯（DAY2の夜）の東京の地図から再開。
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 33, slot: 1 });

    // 夜: mukai で手伝う（日当）→ 帰りに裏口のてつこ（行動を使わない）。
    const before = await get(page);
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    await help.click();
    // mukai のシフト（VOL09）: 今日の注文に合う配合を二つから選ぶ → 客の反応 → 日当。
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-yes")).waitFor({ timeout: 60000 });
    await page.locator(dt("tokyo-tetsuko-yes")).click();
    // 夜の本筋（肩に残る勝利）→ 奥の部屋で寝る → DAY3 の朝は店の違いの場面（昼の行動を使う）→ 夜の地図。
    await tokyoMap(page, { day: 34, slot: 1 });
    state = await get(page);
    assert.equal(state.money, before.money + 6000, "The day's pay from the mukai shift");
    assert.equal(state.flags._mukai_shift_day, 33, "The shift day is kept for Mukai's invitations");
    assert(state.contacts.includes("mukai_master") || state.flags._lime_contact_mukai_master, "Mukai's LIME was exchanged on the first work day");
    assert.equal(state.flags._ch3_outings.mukai_help, 1);
    assert.equal(state.flags._ch3_outings.tetsuko, 1, "Tetsuko is met on the way out of mukai");
    assert(state.flags._ch3_intro.stage >= 5, "The night scene and the DAY3 noon scene are read");
    assert.equal(state.flags._ch2_region, "tokyo", "The night is spent in Tokyo");
  });

  // #2454: 裏口の選択に「てつこといっしょ」がある。選ぶと準備中の画面が出て、「帰る」で日常ループへ戻る。
  // 入口の土台なので何も確定しない: 回復・来訪・好感度・フラグ・時間は動かず、既存の「少し構っていく」
  // （回復+12・来訪加算）とは別物。シフトの報酬だけが残る（二重回復・二重来訪は起きない）。
  await check("tetsuko-time-entry-opens-a-placeholder-and-grants-nothing", async page => {
    await seed(page);
    await loadSlot(page, 0);
    await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
    await page.locator(dt("rule-sheet-close")).click();
    await tokyoMap(page, { day: 33, slot: 1 });
    const before = await get(page);
    // 夜: mukai で手伝う → 帰りの裏口で「てつこといっしょ」を選ぶ。
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    await help.click();
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-game")).waitFor({ timeout: 60000 });
    // 選択肢のラベルにも準備中であることを出す（オーナー判断 2026-11-04）。
    assert.equal((await page.locator(dt("tokyo-tetsuko-game")).innerText()).trim(), "てつこといっしょ（準備中）",
      "The choice label says the game is in preparation");
    await page.locator(dt("tokyo-tetsuko-game")).click();
    // 準備中の画面（タイトル・準備中の表示・帰るボタン）。
    const screen = page.locator(dt("tetsuko-time-screen"));
    await screen.waitFor({ timeout: 60000 });
    const text = await screen.innerText();
    assert.match(text, /てつこといっしょ/, "The placeholder shows the title");
    assert.match(text, /準備中/, "The placeholder tells the player it is in preparation");
    assert.equal(await page.locator(dt("tetsuko-time-back")).count(), 1, "There is a back button");
    // 帰る → 日常ループに戻り、夜の本筋 → DAY3 → 夜の地図へ、普段どおり続く。
    await page.locator(dt("tetsuko-time-back")).click();
    await tokyoMap(page, { day: 34, slot: 1 });
    const after = await get(page);
    assert.equal(after.flags._ch3_outings.tetsuko, undefined, "The game option counts no tetsuko visit");
    assert.equal(after.flags._ch3_outings.mukai_help, 1, "The shift still counted exactly once");
    assert.equal(after.money, before.money + 6000, "Only the shift pay changed money; the game adds nothing");
    assert.equal(await page.locator(dt("tetsuko-time-screen")).count(), 0, "The placeholder is gone after returning");
    assert.equal(await page.locator('.map:not(.done) [data-test="pin-ch3_tokyo_mukai"]').count(), 1, "The Tokyo map is back");
  });

  // VOL10: 東京にいる間、LIMEを交換したムカイさんから、最後のシフトから3日あいた日にシフトの誘いが届く。
  await check("mukai-invites-a-shift-by-lime-in-tokyo", async page => {
    await seed(page);
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      if (!DB.limeTemplates?.mukai_baito) throw new Error("LIME templates are not loaded");
      const phone = await import("./js/daily/phone.js");
      const inv = await import("./js/daily/invitations.js");
      const value = core.state;
      value.flags._ch2_region = "tokyo";
      value.flags._lime_contact_mukai_master = true;
      const pick = () => phone.morningMessages({}).find(m => m.accept_event === "__mukai_baito__") || null;
      const out = {};
      value.day = 37; value.weatherSeed = 5; value.flags._mukai_shift_day = 33;
      const m = pick();
      out.invite = m && { sender: m.sender, spot: m.visit_spot, slot: m.time_slot, reasons: m.messages.length };
      out.visit = m && inv.invitationVisitSpot({ event: m.accept_event, visitSpot: m.visit_spot }, m);
      value.flags._mukai_shift_day = 35; out.tooSoon = !!pick();
      value.flags._mukai_shift_day = 33; value.flags._ch2_region = "home"; out.atHome = !!pick();
      value.flags._ch2_region = "tokyo"; delete value.flags._lime_contact_mukai_master;
      value.contacts = value.contacts.filter(id => id !== "mukai_master"); out.noContact = !!pick();
      return out;
    });
    assert.deepEqual(result.invite, { sender: "mukai_master", spot: "ch3_tokyo_mukai", slot: "noon", reasons: 3 });
    assert.equal(result.visit, "ch3_tokyo_mukai");
    assert.equal(result.tooSoon, false, "Not within three days of the last shift");
    assert.equal(result.atHome, false, "Only while in Tokyo");
    assert.equal(result.noContact, false, "Only after exchanging LIME with Mukai");
  });

  // TKP01: 東京のシーシャ屋は一台4,000円。寄り道・通いを読み終えた時だけ払い、足りなければ入れない（行動も使わない）。
  await check("tokyo-shisha-shops-cost-four-thousand-yen", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { kuze: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      value.money = 3999;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await page.locator(dt("pin-ch3_tokyo_enmaku")).click();
    await page.locator(".mi-no", { hasText: "お金が足りない" }).waitFor();
    assert.equal(await page.locator(dt("map-go")).count(), 0, "Without 4,000 yen Kuze's shop can't be entered");
    let state = await get(page);
    assert.equal(state.slot, 1);
    assert.equal(state.money, 3999);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.state.money = 10000; });
    await page.locator(dt("pin-ch3_tokyo_mukai")).click();
    await page.locator(dt("pin-ch3_tokyo_enmaku")).click();
    await page.locator(dt("spot-note"), { hasText: "4,000" }).waitFor();
    await page.locator(dt("map-go")).click();
    const pick = page.locator(dt("tokyo-enmaku-0"));
    await pick.or(page.locator(".vn")).first().waitFor();
    if (await pick.count()) await pick.click();
    await page.waitForFunction(() => window.__remake?.state?.money === 6000, null, { timeout: 60000 });
    state = await get(page);
    assert.equal(state.money, 6000, "One visit to Kuze's shop in Tokyo is 4,000 yen");
  });

  // IR22: 久世の締めくくり（♥5・LIME交換の寄り道と「答えを返しに行く」の後）を、日常ループの煙幕の来店から読める。
  // 閉店後に呼ばれるので代金は払わず、行動を一つ使う。専用ハガルは一度だけ。
  await check("kuze-heart5-finale-is-reached-from-enmaku-on-the-daily-loop", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { kuze: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      Object.assign(value.flags, { _lime_contact_kuze: true, _ch3_read_ch3_kuze_lime: true, _ch3_outings: { enmaku_answer: 1, enmaku_visit: 3 } });
      value.affinity.kuze = 66; value.money = 10000;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await go(page, "ch3_tokyo_enmaku");
    const finale = page.locator(dt("tokyo-enmaku-0"));
    await finale.waitFor();
    assert.equal((await finale.innerText()).trim(), "久世に呼ばれる", "the finale comes first at Enmaku");
    await finale.click();
    await page.waitForFunction(() => !!window.__remake?.state?.finales?.kuze, null, { timeout: 60000 });
    const state = await get(page);
    assert.equal(state.finales.kuze.route, "friend");
    assert.equal(state.owned.filter(id => id === "suyaki_kuze").length, 1);
    assert.equal(state.money, 10000, "being called after closing costs nothing");
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
    assert.match(backlog, /勝負の話は、今夜はなし/, "read before the tournament: the before-tournament branch");
    assert.doesNotMatch(backlog, /今夜の議題は、勝ち負けとは別の話/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.finales?.kuze?.route, "friend", "the finale is saved");
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

  // VOL15: 辻占のオババは東京にも現れる（理由は語らない）。地図の行き先になり、時間を使わずに3,000円で占う。
  await check("the-street-fortune-teller-appears-in-tokyo-too", async page => {
    await seed(page);
    const day = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const fortune = await import("./js/daily/fortune-schedule.js");
      const value = core.state, intro = value.flags._ch3_intro;
      // 東京DAY6の昼（本筋の予定が無い時間帯）。占い師とは地元で会ったことがある。
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_naru_contact_before_tournament");
      value.day = intro.startDay + 5; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { mashiro: true, mukai_master: true, naru: true, uranaishi: true });
      value.affinity.naru = 20; value.flags._fortune_met = true;
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      delete value.flags._fortune_wander;
      if (!fortune.placeFortuneNow(value, "tokyo")) throw new Error("Fortune teller placement failed");
      core.save();
      return value.day;
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day, slot: 0 });
    assert.equal(await page.locator(dt("pin-fortune")).count(), 1, "The fortune teller is on the Tokyo map");
    const before = await get(page);
    await go(page, "fortune");
    await page.waitForFunction(() => !!window.__remake?.state?.fortune, null, { timeout: 60000 });
    await tokyoMap(page, { day, slot: 0 });
    const state = await get(page);
    assert.equal(state.money, before.money - 3000, "The reading costs 3,000 yen");
    assert.equal(state.fortune.char, "naru");
    assert.equal(state.slot, 0, "No time is used");
    assert.equal(await page.locator(dt("pin-fortune")).count(), 0, "She is gone after the reading");
    const lines = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(entry => entry.text));
    assert(lines.includes("……ヒヒ。ずいぶん遠くまで来たね"), "The Tokyo greeting is read");
  });

  // MPI09: 地元の恋人のほうから「東京へ行ってもいい？」が朝の LIME で届き、返事で約束が決まる（オーナー「連絡はあっちからくるように」）。
  await check("a-hometown-lover-asks-to-visit-tokyo-by-lime", async page => {
    await seed(page);
    const day = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      // 東京DAY6の昼。地元の恋人つむぎと連絡先を交換済みで、東京への訪問はまだ無い。
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_naru_contact_before_tournament");
      value.day = intro.startDay + 5; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { mashiro: true, mukai_master: true, tsumugi: true });
      value.lovers = ["tsumugi"]; value.contacts = [...new Set([...(value.contacts || []), "tsumugi"])];
      value.flags._intro_tsumugi = true;
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      core.save();
      return value.day;
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day, slot: 0 });
    let state = await get(page);
    const offer = state.tokyoVisits.offers.tsumugi;
    assert(offer, "Tsumugi proposes a visit by the morning LIME");
    assert(state.inbox.some(item => item.msg?.tokyoProposal && item.msg.sender === "tsumugi" && !item.read), "The proposal arrives as an unread LIME");
    await page.locator(dt("hud-phone")).click();
    await page.locator(dt("lime-chat-tsumugi")).click();
    await page.locator(".lime-actions .lime-reply", { hasText: "その日に会おう" }).click();
    await page.locator(".lime-chat", { hasText: "約束した" }).waitFor({ timeout: 30000 });
    await page.locator(dt("phone-next")).click();
    await page.locator(dt("phone-close")).last().click();
    await tokyoMap(page, { day, slot: 0 });
    state = await get(page);
    const plan = state.tokyoVisits.plans.find(entry => entry.characterId === "tsumugi");
    assert(plan, "The reply books the visit");
    assert.equal(plan.arrivalDay, offer.arrivalDay, "The proposed dates are booked");
    assert.equal(state.tokyoVisits.offers.tsumugi, undefined, "The answered proposal is closed");
    assert.equal(state.slot, 0, "Answering the LIME uses no time");
  });
});
