// 第4章のドバイを日常ループで遊ぶ（VOL04・版2）。出発の朝（ドバイDAY1）の到着・宿の場面から、ドバイの地図へ。
// スークの初訪問（市場→最初の出会い）→ FESTA（一台5,500円）→ 夜 → 翌朝、宿で休むと道具の手入れ、を実UIで通す。
// もう一件は、DAY12の夜を越えると前夜祭の日（DAY13）の前夜の流れへ入り、必須の場面が並ぶこと。
// カフェでは現地のメニューから一台頼んで味わい、吸いながら現地の文化の話を聞く（2026-11-02 オーナー「カフェで吸えたりとかにしよう」）。
// 龍龍水煙所（王煙楼の店）は最初から地図にあり、通うと段階の会話が進む。先に店で会っていれば前夜祭は顔見知りの分岐。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const backlog = page => page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(entry => entry.text));
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
    for (const pin of ["ch4_dubai_souq", "ch4_dubai_festa", "ch4_dubai_cafe", "ch4_dubai_longlong", "ch4_dubai_practice", "ch4_dubai_creek", "ch4_dubai_shop", "ch4_dubai_naru"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Dubai map`);
    assert.equal(await page.locator(dt("pin-ch4_dubai_alley")).count(), 0, "The alley appears after the market meeting");
    // 昼: スーク（市場→最初の出会い）。夜: FESTA（ドバイの専門店の相場の一台5,500円）。
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
    assert.equal(state.money, money - 5500, "FESTA charges the Dubai lounge price of one shisha");
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

  // 中心地のカフェ: 最初の場面の後に現地のメニューから一台（グレープミント）。路地裏のカフェ: 吸いながら聞く文化の話は、
  // 先に一台（ミント）頼んでから。翌日の中心地のカフェ: 再訪の会話の後におまかせ（まだ頼んでいないダブルアップル）。
  // 中心地のカフェは一台3,500円、路地裏のカフェは一台2,000円（同じ行き先は一日一度）。
  await check("cafes-serve-a-local-shisha-and-talk-about-local-culture", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care", "ch4_stranger_second", "ch4_alley_cafe_quiet"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 2; value.slot = 0; p.day = 3;
      value.money = 50000;
      value.flags._ch4_dubai_talks = { alley_cafe: 2 }; // 次の路地裏の再訪は、素焼きのボウルの話（吸いながら聞く）
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 51, slot: 0 });
    let state = await get(page);
    const money = state.money;
    // 昼: 中心地のカフェ（初めて）。最初の場面 → メニュー → グレープミント。
    await go(page, "ch4_dubai_cafe");
    await page.locator(dt("cafe-order-grape_mint")).click();
    await dubaiMap(page, { day: 51, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_dubai_cafe, true);
    assert.deepEqual(state.flags._ch4_cafe_orders, { grape_mint: 1 });
    assert(state.flavorLessons.includes("ch4_dubai_taste_grape_mint"), "The first grape mint teaches the leaves a little");
    assert.equal(state.money, money - 3500, "One shisha at the central cafe is 3,500 yen");
    // 夜: 路地裏のカフェ。文化の話（素焼きのボウル）は、先に一台頼んでから読む。
    await go(page, "ch4_dubai_alley");
    await page.locator(dt("cafe-order-mint")).click();
    await dubaiMap(page, { day: 52, slot: 0 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_cafe_orders, { grape_mint: 1, mint: 1 });
    assert.equal(state.flags._ch4_dubai_talks.alley_cafe, 3, "The clay bowl talk was read");
    assert.equal(state.money, money - 5500, "One shisha at the alley cafe is 2,000 yen");
    // 翌日の昼: もう一度中心地のカフェ。再訪の会話（窓際の席）の後に、おまかせ → まだ頼んでいないダブルアップル。
    await go(page, "ch4_dubai_cafe");
    await page.locator(dt("cafe-order-omakase")).click();
    await dubaiMap(page, { day: 52, slot: 1 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_cafe_orders, { grape_mint: 1, mint: 1, double_apple: 1 }, "Omakase serves one not yet tried");
    assert.equal(state.flags._ch4.read.ch4_dubai_cafe_revisit, true);
    assert.equal(state.flags._ch4_dubai_talks.center_cafe, 1);
    assert.equal(state.money, money - 9000, "3,500 + 2,000 + 3,500 yen");
    // Dr.fookah ドバイ店: 日本の葉に加えて、ドバイで定番の葉が並ぶ（時間は使わない）。
    await go(page, "ch4_dubai_shop");
    await page.locator(".shop-paper").waitFor();
    for (const id of ["absal_double_apple", "dobaj_mint"]) assert.equal(await page.locator(`[data-test="detail-${id}"]`).count(), 1, `${id} is on the shelf`);
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
    // 龍龍水煙所で会っていなければ、前夜祭は今までどおりの初登場（名前だけ聞いていた）。
    await page.locator(dt("ch4-continue")).click();
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_stranger_third"]`).waitFor({ timeout: 60000 });
    const lines = await backlog(page);
    assert(lines.some(text => text.includes("名前だけは、聞いたことがあった")), "first sight at the reception");
    assert(!lines.some(text => text.includes("店の時より")), "No shop acquaintance without a visit");
    const after = await get(page);
    assert.equal(after.met.master_hookah, true);
    assert.equal(after.affinity.master_hookah || 0, 0, "The reception itself gives no affection");
  });

  // 龍龍水煙所: 最初から地図にあり、初来店で王煙楼が名乗る（面識・一台5,500円・好感度）。SAVE/LOAD をはさんでも
  // 段階は増えも減りもせず、翌日の来店で次の段階（水烟袋）へ進む（同じ行き先は一日一度）。
  await check("longlong-shop-is-open-from-the-start-and-advances-like-a-rival-shop", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      p.read.ch4_inn_tool_care = true;
      value.day = p.startDay + 1; value.slot = 0; p.day = 2;
      value.money = 50000;
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 50, slot: 0 });
    let state = await get(page);
    const money = state.money;
    assert.equal(state.met.master_hookah, undefined, "Not met before the shop");
    await go(page, "ch4_dubai_longlong");
    await dubaiMap(page, { day: 50, slot: 1 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_longlong, { read: { ch4_longlong_first: true }, talks: 0 });
    assert.equal(state.met.master_hookah, true, "Wang introduces himself at his shop");
    assert.equal(state.flags._intro_master_hookah, true, "The intro cut-in was shown at the shop");
    assert(state.flavorLessons.includes("ch4_longlong_first"));
    assert.equal(state.money, money - 5500, "One shisha at the Longlong shop is 5,500 yen (Dubai lounge price)");
    const firstHeart = state.affinity.master_hookah;
    assert(firstHeart >= 9, `The first visit reaches one heart (${firstHeart})`);
    assert((await backlog(page)).some(text => text.includes("王煙楼だ。この店の主をしている")));
    // SAVE/LOAD: 同じ時間帯から再開しても、記録・好感度は増えない。次の来店は水烟袋の段階。
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 50, slot: 1 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_longlong, { read: { ch4_longlong_first: true }, talks: 0 });
    assert.equal(state.affinity.master_hookah, firstHeart);
    assert(await page.locator(`${dt("pin-ch4_dubai_longlong")}.off`).count(), "Once a day, like the other shops");
    await go(page, "ch4_dubai_creek");
    await dubaiMap(page, { day: 51, slot: 0 });
    await go(page, "ch4_dubai_longlong");
    await dubaiMap(page, { day: 51, slot: 1 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_longlong.read, { ch4_longlong_first: true, ch4_longlong_second: true });
    assert(state.affinity.master_hookah >= 20, "Two stage talks reach two hearts");
    assert(!(await backlog(page)).filter(text => text.includes("王煙楼だ。")).slice(1).length, "No second self-introduction");
  });

  // 先に龍龍水煙所で会っていれば（面識）、前夜祭の王煙楼は顔見知りとして迎え、初対面の地の文・名乗りを繰り返さない。
  await check("eve-reception-greets-wang-as-an-acquaintance-after-the-shop", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care", "ch4_stranger_second"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 11; value.slot = 1; p.day = 12;
      // 龍龍水煙所に一度通った（初来店で名乗った）保存
      value.flags._ch4_longlong = { read: { ch4_longlong_first: true }, talks: 0 };
      value.flags._met_master_hookah = true; value.flags._intro_master_hookah = true;
      value.met.master_hookah = true;
      value.affinity.master_hookah = 13;
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 60, slot: 1 });
    await go(page, "ch4_dubai_inn");
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor({ timeout: 60000 });
    await page.locator(dt("ch4-continue")).click();
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_stranger_third"]`).waitFor({ timeout: 60000 });
    const lines = await backlog(page);
    assert(lines.some(text => text.includes("店の時より、客が多いだろう")), "Wang greets a familiar face");
    assert(!lines.some(text => text.includes("名前だけは、聞いたことがあった") || text.includes("県大会のモニターで見た技")), "No first-sight narration");
    const state = await get(page);
    assert.equal(state.affinity.master_hookah, 13, "The reception does not add affection");
    assert.equal(state.flags._ch4.read.ch4_wang_reception, true);
  });
});
