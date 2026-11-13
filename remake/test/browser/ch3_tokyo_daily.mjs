// 第3章の東京14日を日常ループで遊ぶ（VOL03・版3）。出発の朝（東京DAY1）から、
// DAY1の受付→mukaiの扉（昼・夜の行動を使う本筋）→ DAY2の初出勤（昼）→ 夜の行動で mukai へ（手伝い→帰りに裏口のてつこ。
// てつこといっしょ（#2454）の画面と、短い「少し構っていく」の両方）
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

async function seed(page, extraFlags = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async extraFlags => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5,
      contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    for (const who of ["hajime", "sumi", "pakki", "maezono", "dr_kemuri", "sui"]) value.flags[`_intro_${who}`] = true;
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    // 準備3日（ch3_departure_prep が見る）を過ごした出発の朝。新幹線で着いた後から。
    value.day += 3;
    if (!progress.departChapterThree(value)) throw new Error("Departure failed");
    value.flags._ch3_intro.titleSeen = true;
    Object.assign(value.flags, extraFlags);
    // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、この章の出現は済んだことにする。
    const fortune = await import("./js/daily/fortune-schedule.js");
    const fortunePlan = fortune.fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  }, extraFlags);
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
    const parity = await page.evaluate(async () => {
      const { mukaiShiftPay } = await import("./js/chapters/tokyo-mukai.js");
      const { shiftBasePay } = await import("./js/core/shift-pay.js");
      const world = structuredClone(window.__remake.state);
      world.flags._ch4_cleared = true;
      return [mukaiShiftPay(world), shiftBasePay(world), mukaiShiftPay(world, true)];
    });
    assert.deepEqual(parity, [12000, 12000, 17000], "world champion wages and called bonus match tonari");
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    assert.match(await help.innerText(), /10,000/, "mukai shows the same chapter 3 base pay as tonari");
    await help.click();
    // mukai のシフト（VOL09）: 今日の注文に合う配合を二つから選ぶ → 客の反応 → 日当。
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-yes")).waitFor({ timeout: 60000 });
    await page.locator(dt("tokyo-tetsuko-yes")).click();
    // 夜の本筋（肩に残る勝利）→ 奥の部屋で寝る → DAY3 の朝は店の違いの場面（昼の行動を使う）→ 夜の地図。
    await tokyoMap(page, { day: 34, slot: 1 });
    state = await get(page);
    assert.equal(state.money, before.money + 10000, "The day's pay from the mukai shift");
    assert.equal(state.flags._mukai_shift_day, 33, "The shift day is kept for Mukai's invitations");
    assert(state.contacts.includes("mukai_master") || state.flags._lime_contact_mukai_master, "Mukai's LIME was exchanged on the first work day");
    assert.equal(state.flags._ch3_outings.mukai_help, 1);
    assert.equal(state.flags._ch3_outings.tetsuko, 1, "Tetsuko is met on the way out of mukai");
    assert(state.flags._ch3_intro.stage >= 5, "The night scene and the DAY3 noon scene are read");
    assert.equal(state.flags._ch2_region, "tokyo", "The night is spent in Tokyo");
  });

  // #2454 てつこといっしょ: 裏口の選択の先頭。初めてなら既存の段階会話（初回）を読んでから、ふれあいの画面へ。
  // なでる・じゃらしをして「帰る」と、同じ処理の中で回復12・来訪1回・_tetsuko_time を確定する（二重にならない）。
  // 好感度・能力・お金・時間は動かさない（お金はシフトの日当だけ）。
  await check("tetsuko-time-first-visit-reads-the-stage-scene-and-settles-once", async page => {
    await seed(page);
    await loadSlot(page, 0);
    await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
    await page.locator(dt("rule-sheet-close")).click();
    await tokyoMap(page, { day: 33, slot: 1 });
    const before = await get(page);
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    await help.click();
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-game")).waitFor({ timeout: 60000 });
    assert.equal((await page.locator(dt("tokyo-tetsuko-game")).innerText()).trim(), "てつこといっしょ", "The game is no longer marked as in preparation");
    assert.equal((await page.locator(dt("tokyo-tetsuko-yes")).innerText()).trim(), "少し構っていく（短く）", "The short care path stays");
    const mid = await get(page);
    await page.locator(dt("tokyo-tetsuko-game")).click();
    // 初回の段階会話（撫でる／餌の選択は先頭を選ぶ）→ ふれあいの画面。
    const screen = page.locator(dt("tetsuko-time-screen"));
    await screen.waitFor({ timeout: 60000 });
    assert.equal(await screen.getAttribute("data-stage"), "0", "First visit: still keeping her distance");
    assert.match(await page.locator(dt("tetsuko-mood")).getAttribute("aria-label"), /今日は/);
    assert((await page.locator(dt("tetsuko-caption")).innerText()).trim().length > 0, "She reacts as soon as the screen opens");
    assert.equal(await page.locator(dt("tetsuko-brush")).isDisabled(), true, "The brush waits until Mukai's brush scene");
    assert.equal((await get(page)).flags._ch3_outings.tetsuko, undefined, "Nothing is settled while the screen is open");
    await page.locator(dt("tetsuko-pet")).click();
    // じゃらしを3回振ると前足が出る（様子見の段階は飛びつかない）。
    for (let i = 0; i < 3; i += 1) await page.locator(dt("tetsuko-play")).click();
    await page.locator(dt("tetsuko-note")).filter({ hasText: "はじめて前足が出た" }).waitFor();
    // 二重押ししても確定は一度だけ。
    await page.locator(dt("tetsuko-time-back")).click();
    await page.locator(dt("tetsuko-time-back")).click({ timeout: 500 }).catch(() => {});
    await page.waitForFunction(() => window.__remake.state.flags._ch3_outings?.tetsuko === 1, null, { timeout: 30000 });
    const settled = await get(page);
    const maximum = await page.evaluate(async () => (await import("./js/core/stats.js")).maxStamina());
    assert.equal(settled.stamina, Math.min(maximum, mid.stamina + 12), "Stamina comes back by 12 (within the cap)");
    const record = settled.flags._tetsuko_time;
    assert(record.found.includes("first_paw"), "The moment is kept in the book without a photo");
    assert.equal(record.peaks, 0, "No happy peak yet on such a short visit");
    assert.equal(record.sessions, 1);
    assert.equal(record.lastKey, `3:33:1:0`, "The visit key comes from the mukai visit");
    assert.deepEqual(settled.affinity, mid.affinity, "No affinity from the cat");
    assert.deepEqual(settled.stats, mid.stats, "No stats from the cat");
    assert.equal(settled.money, mid.money, "No money from the cat");
    await tokyoMap(page, { day: 34, slot: 1 });
    const after = await get(page);
    assert.equal(after.flags._ch3_outings.tetsuko, 1, "Counted once");
    assert.equal(after.flags._ch3_outings.mukai_help, 1, "The shift still counted exactly once");
    assert.equal(after.money, before.money + 10000, "Only the shift pay changed money");
    assert.equal(await page.locator(dt("tetsuko-time-screen")).count(), 0, "The screen is gone after returning");
  });

  // 懐いた後（来訪4回以上）は会話を挟まずに画面へ。何もせず「帰る」と、何も確定しない（回復・来訪・記録なし）。
  await check("tetsuko-time-leaving-without-touching-commits-nothing", async page => {
    await seed(page, { _ch3_outings: { tetsuko: 4 } });
    await loadSlot(page, 0);
    await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
    await page.locator(dt("rule-sheet-close")).click();
    await tokyoMap(page, { day: 33, slot: 1 });
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    await help.click();
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-game")).click({ timeout: 60000 });
    const screen = page.locator(dt("tetsuko-time-screen"));
    await screen.waitFor({ timeout: 60000 });
    assert.equal(await page.locator("#vn.show, body.vn-open").count(), 0, "No stage scene after she already trusts you");
    assert.equal(await screen.getAttribute("data-stage"), "3", "An old save that reached her lap starts close");
    const mid = await get(page);
    await page.locator(dt("tetsuko-time-back")).click();
    await tokyoMap(page, { day: 34, slot: 1 });
    const after = await get(page);
    assert.equal(after.flags._ch3_outings.tetsuko, 4, "No visit is counted");
    assert.equal(after.flags._tetsuko_time, undefined, "Nothing is written");
    assert.equal(mid.flags._ch3_outings.tetsuko, 4);
  });

  // #2454 UI v2: 道具箱から箱を選んで床に置く／猫じゃらしを指で動かすと前足が出る／てつこ手帳に残る。
  // 帰ると配置と発見が _tetsuko_time に残り、回復・来訪は一度だけ。
  await check("tetsuko-time-toolbox-toy-drag-and-notebook", async page => {
    await seed(page, { _ch3_outings: { tetsuko: 5 } });
    await loadSlot(page, 0);
    await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
    await page.locator(dt("rule-sheet-close")).click();
    await tokyoMap(page, { day: 33, slot: 1 });
    await go(page, "ch3_tokyo_mukai");
    const help = page.locator(`#modal.show button`, { hasText: "シフトに入る" });
    await help.waitFor();
    await help.click();
    await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
    await page.locator(dt("mukai-order-0")).click();
    await page.locator(dt("tokyo-tetsuko-game")).click({ timeout: 60000 });
    const screen = page.locator(dt("tetsuko-time-screen"));
    await screen.waitFor({ timeout: 60000 });
    // もようがえ: 箱を選ぶと置ける場所が光り、床をタップすると置ける。
    await page.locator(dt("tetsuko-decor")).click();
    await page.locator(dt("tetsuko-decor-panel")).waitFor();
    await page.locator(dt("tetsuko-item-box")).click();
    assert.equal(await page.locator(dt("tetsuko-slot-floor")).getAttribute("data-allowed"), "true", "The floor lights up for the box");
    await page.locator(dt("tetsuko-slot-floor")).click();
    assert.equal(await page.locator('.tt-slot[data-slot="floor"]').getAttribute("data-prop"), "box", "The box is on the floor");
    await page.locator(dt("tetsuko-panel-close")).click();
    // 猫じゃらし: 持ち替えて、先を指（マウス）で動かす。動かすたびに振ったことになり、3回目で前足が出る（その次で飛びつく）。
    await page.locator(dt("tetsuko-play")).click();
    assert.equal(await screen.getAttribute("data-tool"), "toy");
    const box = await screen.boundingBox();
    const at = (x, y) => [box.x + x * box.width / 1280, box.y + y * box.height / 720];
    for (const [x, y] of [[700, 380], [880, 300], [620, 280], [860, 420], [600, 360], [820, 300]]) {
      await page.mouse.move(...at(x, y), { steps: 5 });
      await page.waitForTimeout(520);
    }
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-caption"]')?.textContent.length > 0);
    // てつこ手帳: 見つけたしぐさが記録されている。
    await page.locator(dt("tetsuko-book")).click();
    await page.locator(dt("tetsuko-book-panel")).waitFor();
    assert.equal(await page.locator(dt("tetsuko-book-first_paw")).getAttribute("data-found"), "true", "The first paw is in the notebook");
    await page.locator(dt("tetsuko-panel-close")).click();
    await page.locator(dt("tetsuko-time-back")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_outings?.tetsuko === 6, null, { timeout: 30000 });
    const after = await get(page);
    assert.equal(after.flags._tetsuko_time.props.floor, "box", "The box stays where it was put");
    assert(after.flags._tetsuko_time.found.includes("first_paw"), "Dragging the toy found the first paw");
    await tokyoMap(page, { day: 34, slot: 1 });
    assert.equal((await get(page)).flags._ch3_outings.tetsuko, 6, "Counted once");
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
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      value.money = 3999;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await page.locator(dt("pin-ch3_tokyo_enmaku")).click();
    await page.locator('.map-info[aria-label*="お金が足りない"]').waitFor();
    assert.equal(await page.locator(dt("map-go")).count(), 0, "Without 4,000 yen Ayatori's shop can't be entered");
    let state = await get(page);
    assert.equal(state.slot, 1);
    assert.equal(state.money, 3999);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.state.money = 10000; });
    await page.locator(dt("pin-ch3_tokyo_mukai")).click();
    await page.locator(dt("pin-ch3_tokyo_enmaku")).click();
    await page.locator(dt("pin-ch3_tokyo_enmaku")).locator(".pin-cost", { hasText: "4,000" }).waitFor();
    await page.locator(dt("map-go")).click();
    const pick = page.locator(dt("tokyo-enmaku-0"));
    await pick.or(page.locator(".vn")).first().waitFor();
    if (await pick.count()) await pick.click();
    await page.waitForFunction(() => window.__remake?.state?.money === 6000, null, { timeout: 60000 });
    state = await get(page);
    assert.equal(state.money, 6000, "One visit to Ayatori's shop in Tokyo is 4,000 yen");
  });

  // IR22: 綾取の締めくくり（♥5・LIME交換の寄り道と「答えを返しに行く」の後）を、日常ループの煙幕の来店から読める。
  // 閉店後に呼ばれるので代金は払わず、行動を一つ使う。専用ハガルは一度だけ。
  await check("saku-heart5-finale-is-reached-from-enmaku-on-the-daily-loop", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      Object.assign(value.flags, { _lime_contact_saku: true, _ch3_read_ch3_saku_lime: true, _ch3_read_ch3_saku_missed: true, _ch3_read_ch3_saku_cleanup: true, _ch3_read_ch3_saku_liar: true, _ch3_read_ch3_saku_first_reply: true, _ch3_outings: { enmaku_answer: 1, enmaku_visit: 3 } });
      value.affinity.saku = 66; value.money = 10000;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await go(page, "ch3_tokyo_enmaku");
    const finale = page.locator(dt("tokyo-enmaku-0"));
    await finale.waitFor();
    assert.equal((await finale.innerText()).trim(), "綾取に呼ばれる", "the finale comes first at Enmaku");
    await finale.click();
    await page.waitForFunction(() => !!window.__remake?.state?.finales?.saku, null, { timeout: 60000 });
    const state = await get(page);
    assert.equal(state.finales.saku.route, "friend");
    assert.equal(state.owned.filter(id => id === "suyaki_saku").length, 1);
    assert.equal(state.money, 10000, "being called after closing costs nothing");
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
    assert.match(backlog, /勝負の話は、今日はなし/, "read before the tournament: the before-tournament branch");
    assert.doesNotMatch(backlog, /今日の議題は、勝ち負けとは別の話/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.finales?.saku?.route, "friend", "the finale is saved");
  });

  // #2028: スティーブの締めくくり（♥5・LIME交換の寄り道と予備のタイマーを借りる外出の後）も、日常ループの
  // Smoke & Glory の来店から読める。綾取と同じく代金は払わず、行動を一つ使う。専用ハガルは一度だけ。
  await check("steve-heart5-finale-is-reached-from-smoke-and-glory-on-the-daily-loop", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      Object.assign(value.flags, { _lime_contact_steve: true, _ch3_read_ch3_steve_lime: true,
        _ch3_read_ch3_steve_two_timers: true, _ch3_read_ch3_steve_empty_seat: true, _ch3_read_ch3_steve_tongs: true, _ch3_read_ch3_steve_watch: true,
        _ch3_outings: { mukai_steve: 2, steve_timer: 1, steve_visit: 2 } });
      value.affinity.steve = 66; value.money = 10000;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await go(page, "ch3_tokyo_steve");
    const finale = page.locator(dt("tokyo-steve-0"));
    await finale.waitFor();
    assert.equal((await finale.innerText()).trim(), "スティーブに呼ばれる", "the finale comes first at Smoke & Glory");
    await page.locator(dt("tokyo-visit-cancel")).click();
    // 締めくくりは代金がかからないので、4,000円に足りない日でも利用料なしで入って呼ばれる（客の一台の外出は出さない）。
    await tokyoMap(page, { day: 44, slot: 1 });
    await page.evaluate(() => { window.__remake.state.money = 1000; });
    await page.locator(dt("pin-ch3_tokyo_mukai")).click();
    await page.locator(dt("pin-ch3_tokyo_steve")).click();
    assert.equal(await page.locator('.map-info[aria-label*="お金が足りない"]').count(), 0, "the finale is not blocked by the shop fee");
    await page.locator(dt("map-go")).click();
    await page.waitForFunction(() => !!window.__remake?.state?.finales?.steve, null, { timeout: 60000 });
    const state = await get(page);
    assert.equal(state.finales.steve.route, "friend");
    assert.equal(state.owned.filter(id => id === "suyaki_steve").length, 1);
    assert.equal(state.flavorStock.mountain_mist, 50, "a box of Mountain Mist comes with the hagal");
    assert.equal(state.money, 1000, "being called by Steve costs nothing, even short of the shop fee");
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
    assert.match(backlog, /今日は客でも偵察でもなくていい/, "read before the tournament: the before-tournament branch");
    assert.doesNotMatch(backlog, /大会の日から/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.finales?.steve?.route, "friend", "the finale is saved");
  });

  // #2028: ヴォルクの締めくくり（♥5・鉄の煙の再訪三つとLIME交換の後）も、日常ループの鉄の煙の来店から読める。
  // 寄り道を読み終えた後も、締めくくりが来ていれば地図に鉄の煙が出る。代金は払わず（4,000円に足りなくても入れる）、行動を一つ使う。
  await check("volk-heart5-finale-is-reached-from-iron-smoke-on-the-daily-loop", async page => {
    await seed(page);
    const before = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      for (const id of ["ch3_volk_second", "ch3_volk_third", "ch3_volk_fourth", "ch3_volk_lime", "ch3_volk_fifth", "ch3_volk_revisit"]) value.flags[`_ch3_read_${id}`] = true;
      value.flags._lime_contact_volk = true;
      value.affinity.volk = 66; value.money = 1000;
      core.save();
      return value.flavorStock?.nightside_blast_mint || 0;
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    await page.locator(dt("pin-ch3_tokyo_mukai")).click();
    await page.locator(dt("pin-ch3_tokyo_volk")).click();
    assert.equal(await page.locator('.map-info[aria-label*="お金が足りない"]').count(), 0, "the finale is not blocked by the shop fee");
    await page.locator(dt("map-go")).click();
    await page.waitForFunction(() => !!window.__remake?.state?.finales?.volk, null, { timeout: 60000 });
    const state = await get(page);
    assert.equal(state.finales.volk.route, "friend");
    assert.equal(state.owned.filter(id => id === "suyaki_volk").length, 1);
    assert.equal(state.flavorStock.nightside_blast_mint, before + 50, "a box of Blast Mint comes with the hagal");
    assert.equal(state.money, 1000, "being called by Volk costs nothing, even short of the shop fee");
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
    assert.match(backlog, /この時間は、測らない/);
    assert.doesNotMatch(backlog, /客の息の間も聞くようにした/, "read before the tournament: the before-tournament branch");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.finales?.volk?.route, "friend", "the finale is saved");
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
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
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
      // この検査は1回の出現と退場。2回分の未消化予定が同時に来る種は別の条件なので除く。
      while (fortune.fortunePlan(value).length !== 1) value.seed++;
      delete value.flags._fortune_wander;
      if (!fortune.placeFortuneNow(value, "tokyo")) throw new Error("Fortune teller placement failed");
      core.save();
      return value.day;
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day, slot: 0 });
    // #2765 からスミさん・つむぎも最初から占いの相手に並ぶ。この検査は東京で会ったなるを占う
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      const { displayName } = await import("./js/core/data.js");
      const naru = displayName("naru", window.__remake.state);
      vn.vnTest.choose = (_id, texts) => Math.max(0, texts.indexOf(naru));
    });
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

  // 恋人のましろと mukai で過ごす時間（BLC03・chapters/mashiro-time.js）。一日に一度、行動1回・体力10で短い場面を読み、
  // デート1回と同じ絆が入る。同じ日の二度目は、mukai の選択肢に出ない。
  await check("a-lover-spends-time-with-mashiro-at-mukai-once-a-day", async page => {
    await seed(page);
    const day = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      // 東京DAY6の昼。ましろと交際していて、最初の節目（Lv1）は読んである。
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_naru_contact_before_tournament");
      value.day = intro.startDay + 5; value.slot = 0; value.phase = "daily"; value.stamina = 100;
      Object.assign(value.met, { mashiro: true, mukai_master: true });
      value.lovers = ["mashiro"]; value.contacts = [...new Set([...(value.contacts || []), "mashiro"])];
      value.loveLevel.mashiro = 1; value.lovePts.mashiro = 9; value.loverSince.mashiro = value.day;
      value.loverEventsSeen = ["lover_mashiro_lv1"];
      for (const id of ["mashiro", "mukai_master"]) value.flags[`_intro_${id}`] = true;
      value.limeRead = [...(value.limeRead || []), "_lover_private_account_mashiro"];
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      core.save();
      return value.day;
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day, slot: 0 });
    const before = await get(page);
    await go(page, "ch3_tokyo_mukai");
    const first = page.locator(dt("tokyo-mukai-0"));
    await first.waitFor({ timeout: 30000 });
    assert.match(await first.textContent(), /ましろちゃんと過ごす（恋人）/, "The lover option leads the mukai choices");
    await first.click();
    // mukai で行動を使った帰りは、裏口のてつこに会うかを聞かれる（ほかの mukai の行動と同じ）。
    await page.locator(dt("tokyo-tetsuko-no")).waitFor({ timeout: 60000 });
    await page.locator(dt("tokyo-tetsuko-no")).click();
    await tokyoMap(page, { day, slot: 1 });
    const state = await get(page);
    assert.deepEqual(state.flags._mashiro_time, { count: 1, day }, "One short scene was read today");
    assert.equal(state.lovePts.mashiro, before.lovePts.mashiro + 5, "A date-sized bond (10, halved for lovers)");
    assert.equal(state.stamina, before.stamina - 10);
    assert.deepEqual(state.loverEventsSeen, ["lover_mashiro_lv1"], "No milestone is due yet");
    // 同じ日はもう選べない（mukai も「今日はもう行った」になる）。翌日にまた選べる。
    const open = await page.evaluate(async () => {
      const time = await import("./js/chapters/mashiro-time.js");
      const value = structuredClone(window.__remake.state);
      const today = time.mashiroTimeOpen(window.__remake.state);
      value.day++;
      return { today, spent: time.mashiroTimeSpentToday(window.__remake.state), nextScene: time.mashiroTimeScene(value) };
    });
    assert.equal(open.today, false, "Once a day");
    assert.equal(open.spent, true);
    assert.equal(open.nextScene, "mashiro_time_train", "The next day reads the next short scene");
  });

  // 日常ループの東京の CHOI-ZAP も、旧行程（ch3-activity-progress.js）と同じく3日間「風邪をひきにくい」を付ける（spot.gym・daily/calendar.js）。
  await check("the-tokyo-choizap-grants-the-fit-days", async page => {
    await seed(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.state, intro = value.flags._ch3_intro;
      intro.stage = progress.CH3_INTRO_SCENES.findIndex(scene => scene.id === "ch3_strategy");
      value.day = intro.startDay + 12; value.slot = 0; value.phase = "daily";
      Object.assign(value.met, { saku: true, steve: true, volk: true, mashiro: true, mukai_master: true });
      value.flags._ch3_opening_read = value.flags._ch3_registration_read = value.flags._ch3_rules_read = true;
      value.flags._gym_member = true;
      core.save();
    });
    await loadSlot(page, 0);
    await tokyoMap(page, { day: 44, slot: 1 });
    const before = await get(page);
    assert.equal(before.flags._fit_since, undefined);
    await go(page, "ch3_tokyo_gym");
    await page.waitForFunction(() => !!window.__remake?.state?.flags?._fit_since, null, { timeout: 60000 });
    const state = await get(page);
    assert.deepEqual(state.flags._fit_since, { chapter: 3, day: 44 });
    assert.equal(state.visitedDay?.ch3_tokyo_gym, 44);
  });
});

