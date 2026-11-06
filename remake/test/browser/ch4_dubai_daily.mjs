// 第4章のドバイを日常ループで遊ぶ（VOL04・版2）。出発の朝（ドバイDAY1）の到着・宿の場面から、ドバイの地図へ。
// スークの初訪問（市場→最初の出会い）→ FESTA（一台6,000円）→ 夜 → 翌朝、宿で休むと道具の手入れ、を実UIで通す。
// もう一件は、DAY12の夜を越えると前夜祭の日（DAY13）の前夜の流れへ入り、必須の場面が並ぶこと。
// 別便の応援（恋人・ましろ）がいれば、前夜祭より先に到着の場面を読み、到着した恋人を前夜に誘えること。
// 到着したサメちゃん・ひよりとは、前夜祭の前に夕方を任意で一度過ごせること（IR18）。
// カフェでは現地のメニューから一台頼んで味わい、吸いながら現地の文化の話を聞く（2026-11-02 オーナー「カフェで吸えたりとかにしよう」）。
// 龍龍水煙所（王煙楼の店）は最初から地図にあり、通うと段階の会話が進む。先に店で会っていれば前夜祭は顔見知りの分岐。
// 街の手触り（2026-11-02 オーナー「2以外は採用」）: 昼の屋外は暑さで体力を多めに使い、カフェ・専門店は夜がにぎわう（夜の一行・
// 初めての夜は短い場面）。スークの後は屋台で軽く買える（体力が少し戻る）。値段には約何ディルハムかを添える。
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
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
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
  for (const [device, options] of [
    ["pc", {}],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(`revisit-new-markers-${device}`, async page => {
    const spots = ["ch4_dubai_souq", "ch4_dubai_festa", "ch4_dubai_cafe", "ch4_dubai_alley"];
    const prepare = completed => seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_stranger_second", "ch4_dubai_cafe", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1; p.secondDay = 3;
      value.day = p.startDay + 4; value.slot = 0; p.day = 5;
      value.met.da_silva = true;
    }).then(async () => {
      if (completed) await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        core.state.flags._ch4_dubai_talks = { souq: 4, festa: 4, center_cafe: 6, alley_cafe: 5 };
        core.save();
      });
    });
    await prepare(false);
    await loadSlot(page, 0);
    await dubaiMap(page);
    for (const id of spots)
      assert.equal(await page.locator(`${dt(`pin-${id}`)} .evt-badge.story`).count(), 1, `${id}: new revisit after first scene`);
    await prepare(true);
    await loadSlot(page, 0);
    await dubaiMap(page);
    for (const id of spots)
      assert.equal(await page.locator(`${dt(`pin-${id}`)} .evt-badge.story`).count(), 0, `${id}: no marker after all revisits`);
  }, options);

  await check("day-three-inn-trial", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 2; value.slot = 0; p.day = 3; value.stamina = 80;
      value.stats.guts = 10; // 根性の軽減なしで、試作の基本消費16を確かめる。
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 51, slot: 0 });
    const before = await get(page);
    await go(page, "ch4_dubai_inn");
    await page.locator(dt("ch4-inn-trial")).waitFor();
    assert.equal((await get(page)).flags._ch4_inn_trial, undefined);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-inn-trial")).click();
    await dubaiMap(page, { day: 51, slot: 1 });
    const after = await get(page);
    assert.equal(after.flags._ch4_inn_trial?.feedbackRead, true);
    assert(["good", "rough"].includes(after.flags._ch4_inn_trial.result));
    assert.equal(after.flags._craft_practice_runs.at(-1).kind, "ch4_inn_trial");
    assert.equal(after.stamina, before.stamina - 16);
    assert.equal(after.money, before.money);
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 51, slot: 1 });
    const due = await page.evaluate(async () => {
      const { innTrialDue } = await import("./js/chapters/ch4-inn-trial.js");
      return innTrialDue(window.__remake.state);
    });
    assert.equal(due, false);
  });

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
    // 昼: スーク（市場→最初の出会い）。夜: FESTA（ドバイの専門店の一台6,000円）。
    await go(page, "ch4_dubai_souq");
    // スークの後は屋台（買わなくてもよい）
    await page.locator(dt("stall-none")).click();
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
    assert.equal(state.money, money - 6000, "FESTA charges the Dubai lounge price of one shisha");
    assert.deepEqual(state.flags._ch4_dubai_nights, { festa: 1 }, "The first night at FESTA reads its night scene before the meeting");
    assert((await backlog(page)).some(text => text.startsWith("夜のFESTAは、人でいっぱいだった。")));
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
  // カフェはどちらも一台3,000円（同じ行き先は一日一度）。
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
    assert.equal(state.money, money - 3000, "One shisha at the central cafe is 3,000 yen");
    // 夜: 路地裏のカフェ。文化の話（素焼きのボウル）は、先に一台頼んでから読む。
    await go(page, "ch4_dubai_alley");
    await page.locator(dt("cafe-order-mint")).click();
    await dubaiMap(page, { day: 52, slot: 0 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_cafe_orders, { grape_mint: 1, mint: 1 });
    assert.equal(state.flags._ch4_dubai_talks.alley_cafe, 3, "The clay bowl talk was read");
    assert.equal(state.money, money - 6000, "One shisha at the alley cafe is 3,000 yen too");
    // 翌日の昼: もう一度中心地のカフェ。再訪の会話（窓際の席）の後に、おまかせ → まだ頼んでいないダブルアップル。
    await go(page, "ch4_dubai_cafe");
    await page.locator(dt("cafe-order-omakase")).click();
    await dubaiMap(page, { day: 52, slot: 1 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_cafe_orders, { grape_mint: 1, mint: 1, double_apple: 1 }, "Omakase serves one not yet tried");
    assert.equal(state.flags._ch4.read.ch4_dubai_cafe_revisit, true);
    assert.equal(state.flags._ch4_dubai_talks.center_cafe, 1);
    assert.equal(state.money, money - 9000, "Three cafe visits at 3,000 yen");
  });

  // 昼のスーク: 暑さで体力を多めに使い（-15）、屋台でシャワルマ（500円・体力+12）。夜の中心地のカフェ: 初めての夜は短い場面
  // （スポット固有の場面の経験値）→ 店員の「マルハバ」→ 一台。翌日の昼のクリーク沿いは夜ほど休まらず（+12）、二度目の夜は一行だけ。
  await check("daytime-heat-souq-stall-and-lively-cafe-nights", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care", "ch4_dubai_cafe"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 2; value.slot = 0; p.day = 3;
      value.money = 50000; value.stamina = 60;
      value.stats.guts = 10; // 根性の軽減なし（体力の増減をそのまま確かめる）
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 51, slot: 0 });
    const desc = async pin => { await page.locator(dt(`pin-${pin}`)).click(); return page.locator(".mi-desc").first().innerText(); };
    assert.match(await desc("ch4_dubai_souq"), /屋台で軽いものも買える。昼は暑く、いつもより体力を使う。/);
    assert.match(await desc("ch4_dubai_creek"), /昼は日差しが強く、夜ほどは休まらない。/);
    assert.match(await desc("ch4_dubai_festa"), /一台6,000円（約140ディルハム）。夜がにぎわう。/);
    assert.match(await desc("ch4_dubai_cafe"), /一台3,000円（約70ディルハム）。夜がにぎわう。/);
    let state = await get(page);
    const money = state.money;
    // 昼のスーク → 屋台
    await go(page, "ch4_dubai_souq");
    await page.locator(dt("stall-shawarma")).waitFor();
    assert.deepEqual(await page.locator(".ch4-souq-stall .modal-actions button").allInnerTexts(),
      ["カラクチャイ 100円（約2ディルハム）", "シャワルマ 500円（約10ディルハム）", "ルカイマット 500円（約10ディルハム）", "何も買わない"]);
    assert.match(await page.locator(".ch4-souq-stall .modal-body").innerText(), /「マルハバ」/);
    assert.equal(await page.locator(".toast", { hasText: "昼の暑さで、いつもより体力を使った" }).count(), 1, "The heat is shown");
    await page.locator(dt("stall-shawarma")).click();
    await dubaiMap(page, { day: 51, slot: 1 });
    state = await get(page);
    assert.equal(state.money, money - 500, "A shawarma is 500 yen");
    assert.equal(state.stamina, 60 - 15 + 12, "The midday souq takes 15, the shawarma gives back 12");
    assert((await backlog(page)).some(text => text.startsWith("回る肉の塊を")));
    // 夜の中心地のカフェ（初めての夜）
    await go(page, "ch4_dubai_cafe");
    await page.locator(dt("cafe-order-grape_mint")).click();
    await dubaiMap(page, { day: 52, slot: 0 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_dubai_nights, { center_cafe: 1 });
    assert.equal(state.money, money - 500 - 3000);
    let lines = await backlog(page);
    const nightLine = "夜の中心地のカフェは、テラスの席までほとんど埋まっていた。";
    const nightMore = "客の入りは、日付が変わるころまで途切れないらしい。店員が、空いた席を探して回っている。";
    assert(lines.includes(nightLine) && lines.includes(nightMore), "The first night is the short night scene");
    assert(lines.includes("マルハバ。前と同じ、窓際のお席でよろしいですか"), "The staff greets with marhaba");
    assert(state.growth?.read?.includes("ch4_dubai_night_center_cafe"), "The first night counts as a spot scene (growth board)");
    // 翌日の昼のクリーク沿い（夜ほど休まらない）
    const max = await page.evaluate(async () => (await import("./js/core/stats.js")).maxStamina());
    const before = state.stamina;
    await go(page, "ch4_dubai_creek");
    await dubaiMap(page, { day: 52, slot: 1 });
    state = await get(page);
    assert.equal(state.stamina, Math.min(max, before + 12), "The midday creek walk restores 12");
    // 二度目の夜は一行だけ
    await go(page, "ch4_dubai_cafe");
    await page.locator(dt("cafe-order-mint")).click();
    await dubaiMap(page, { day: 53, slot: 0 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_dubai_nights, { center_cafe: 2 });
    lines = await backlog(page);
    assert.equal(lines.filter(text => text === nightLine).length, 2, "The night line is read on every night visit");
    assert.equal(lines.filter(text => text === nightMore).length, 1, "The rest of the night scene only on the first night");
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
    // DAY12 の宿では前日リハーサルの申し出が先に出る。このケースは受けずに「いつもの宿」を選び、従来どおり前夜へ進む。
    await page.locator(dt("ch4-rehearsal-rest")).waitFor();
    await page.locator(dt("ch4-rehearsal-rest")).click();
    // DAY12 の夜を越えると DAY13（前夜祭の日）の前夜の流れ。前夜祭の繋ぎ場面から。
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor({ timeout: 60000 });
    const state = await get(page);
    assert.equal(state.flags._ch4_rehearsal, undefined, "Skipping the rehearsal leaves no rehearsal record");
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
    // 初対面は♥1ちょうど（786fb334）。受付の場面そのものは、それ以上の好感度を足さない。
    assert.equal(after.affinity.master_hookah || 0, 9, "The reception gives only the first-meeting heart");
  });

  // DAY12 の宿の前日リハーサルを受ける側: 本番と同じ一台（調整2回）を作って講評まで読むと記録が残り、
  // 1行動・体力16を使う。お金は減らない。宿は一日一度きりなので、夜は別の行き先で一日を終えて前夜祭へ進む。
  await check("day-twelve-inn-rehearsal-runs-a-full-practice-into-the-eve", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 11; value.slot = 0; p.day = 12;
      p.read.ch4_stranger_second = true;
      value.stats.guts = 10; // 根性の軽減なしで、リハーサルの基本消費16を確かめる。
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 60, slot: 0 });
    const before = await get(page);
    await go(page, "ch4_dubai_inn");
    await page.locator(dt("ch4-rehearsal")).waitFor();
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-rehearsal")).click();
    await dubaiMap(page, { day: 60, slot: 1 });
    const state = await get(page);
    assert.equal(state.flags._ch4_rehearsal?.feedbackRead, true, "The rehearsal feedback was read");
    assert(["great", "good", "rough", "burnt"].includes(state.flags._ch4_rehearsal?.result), "The rehearsal result is recorded");
    assert.equal(state.flags._craft_practice_runs.at(-1).kind, "rehearsal");
    assert.equal(state.stamina, before.stamina - 16, "The rehearsal costs 16 stamina");
    assert.equal(state.money, before.money, "The rehearsal is free");
    // 宿は一日一度きり（リハーサルで使ったので夜は「今日はもう行った」）。別の行き先で一日を終えると前夜祭の流れへ。
    await go(page, "ch4_dubai_creek");
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor({ timeout: 60000 });
    const eve = await get(page);
    assert.equal(eve.flags._ch4.part, "eve");
    assert.equal(eve.flags._ch4.day, 13);
  });

  // 龍龍水煙所: 最初から地図にあり、初来店で王煙楼が名乗る（面識・一台6,000円・好感度）。SAVE/LOAD をはさんでも
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
    assert.equal(state.money, money - 6000, "One shisha at the Longlong shop is 6,000 yen (Dubai lounge price)");
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
    // 前日リハーサルは受けずに「いつもの宿」で前夜へ進む（DAY12 の宿の申し出）。
    await page.locator(dt("ch4-rehearsal-rest")).waitFor();
    await page.locator(dt("ch4-rehearsal-rest")).click();
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

  // 同行なしで、凛想（恋人）とましろ（第3章クリア）が別便で応援に来る。前夜祭の日に凛想→ましろちゃんの到着を読み、
  // 前夜祭の後、到着した凛想を前夜に誘える。到着の場面を読む途中でロードしても、同じ到着から読み直し二重に確定しない。
  // 2人目の到着カードは「もう一人」の文になる。
  await check("a-separate-flight-lover-arrives-on-the-festival-day-and-can-be-invited", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care", "ch4_stranger_second"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 11; value.slot = 1; p.day = 12;
      value.lovers = ["rio"]; value.met.rio = true; value.contacts.push("rio");
      value.flags._overseas_companion = { decided: true, companion: null, supports: ["rio", "mashiro"] };
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 60, slot: 1 });
    await go(page, "ch4_dubai_inn");
    // 前日リハーサルは受けずに「いつもの宿」で前夜へ進む（DAY12 の宿の申し出）。
    await page.locator(dt("ch4-rehearsal-rest")).waitFor();
    await page.locator(dt("ch4-rehearsal-rest")).click();
    const arrival = id => `${dt("ch4-arrival")}[data-scene="${id}"]`;
    await page.locator(arrival("ch4_rio_dubai_girlfriend")).waitFor({ timeout: 60000 });
    assert.match(await page.locator(dt("ch4-arrival")).innerText(), /DAY 13・前夜祭の日/);
    assert.match(await page.locator(dt("ch4-arrival")).innerText(), /ドバイに着いたらしい/);
    assert.equal((await get(page)).flags._ch4.part, "eve");
    // 到着の場面を読んでいる途中（自動送りを止めて会話が開いた所）でロードする。
    await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = false; });
    await page.locator(dt("ch4-continue")).click();
    await page.locator("#vn.active").waitFor();
    await loadSlot(page, 0);
    await page.locator(arrival("ch4_rio_dubai_girlfriend")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch4.read.ch4_rio_dubai_girlfriend, undefined, "A read cut off by LOAD commits nothing");
    await page.locator(dt("ch4-continue")).click();
    await page.locator(arrival("ch4_mashiro_dubai_friend")).waitFor();
    assert.equal((await get(page)).flags._ch4.read.ch4_rio_dubai_girlfriend, true);
    assert.match(await page.locator(dt("ch4-arrival")).innerText(), /もう一人着いたらしい/);
    await page.locator(dt("ch4-continue")).click();
    for (const id of ["ch4_wang_reception", "ch4_stranger_third"]) {
      await page.locator(`${dt("ch4-eve")}[data-scene="${id}"]`).waitFor();
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-evening")).waitFor();
    assert.match(await page.locator(dt("ch4-evening")).innerText(), /と過ごす時間がある/);
    await page.locator(dt("ch4-evening-date")).click();
    await page.waitForFunction(() => !!window.__remake.state.flags._ch4_evening, null, { timeout: 60000 });
    const state = await get(page);
    assert.deepEqual(state.flags._ch4_evening, { kind: "date", participants: ["rio"] });
    assert.equal(state.flags._ch4.read.ch4_mashiro_dubai_friend, true);
  });

  // IR18: 別便で着いたサメちゃん（恋人）とは、到着の後、前夜祭の前に夕方を任意で一度過ごせる。読むと同じカードに戻り、
  // 前夜祭へ進める。読んだ後は出ない。前夜は到着した恋人として誘える。
  await check("an-arrived-lover-can-spend-the-festival-day-evening-once", async page => {
    await seed(page, (value, progress) => {
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_dubai_souq", "ch4_stranger_first", "ch4_festa", "ch4_inn_tool_care", "ch4_stranger_second"]) p.read[id] = true;
      p.firstDay = 1;
      value.day = p.startDay + 11; value.slot = 1; p.day = 12;
      value.lovers = ["samechan"]; value.met.samechan = true; value.contacts.push("samechan");
      value.flags._overseas_companion = { decided: true, companion: null, supports: ["samechan"] };
    });
    await loadSlot(page, 0);
    await dubaiMap(page, { day: 60, slot: 1 });
    await go(page, "ch4_dubai_inn");
    // 前日リハーサルは受けずに「いつもの宿」で前夜へ進む（DAY12 の宿の申し出）。
    await page.locator(dt("ch4-rehearsal-rest")).waitFor();
    await page.locator(dt("ch4-rehearsal-rest")).click();
    await page.locator(`${dt("ch4-arrival")}[data-scene="ch4_samechan_dubai_girlfriend"]`).waitFor({ timeout: 60000 });
    const evening = dt("ch4-arrival-evening-samechan");
    assert.equal(await page.locator(evening).count(), 0, "The arrival comes first");
    await page.locator(dt("ch4-continue")).click();
    const eveCard = `${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`;
    await page.locator(eveCard).waitFor({ timeout: 60000 });
    assert.match(await page.locator(dt("ch4-eve")).innerText(), /前夜祭の日/);
    assert.match(await page.locator(dt("ch4-eve")).innerText(), /夕方になった/);
    await page.locator(evening).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4.read.ch4_samechan_dubai_evening === true, null, { timeout: 60000 });
    await page.locator(eveCard).waitFor({ timeout: 60000 });
    assert.equal(await page.locator(evening).count(), 0, "The evening is read once");
    assert.match(await page.locator(dt("ch4-eve")).innerText(), /夜になった/);
    assert((await backlog(page)).some(text => text.includes("印をつけておいたのじゃ")), "The evening scene was played");
    let state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_wang_reception, undefined, "The evening does not move the eve");
    assert.equal(state.flags._ch4.part, "eve");
    for (const id of ["ch4_wang_reception", "ch4_stranger_third"]) {
      await page.locator(`${dt("ch4-eve")}[data-scene="${id}"]`).waitFor();
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-evening")).waitFor();
    await page.locator(dt("ch4-evening-date")).click();
    await page.waitForFunction(() => !!window.__remake.state.flags._ch4_evening, null, { timeout: 60000 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4_evening, { kind: "date", participants: ["samechan"] });
  });
});
