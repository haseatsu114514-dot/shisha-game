// 第5章の通しプレイ検証（#1176）。
// 第4章クリア済みセーブから、完了カード→「第5章へ進む」→プロローグ→自由行動→連絡（決める）→
// 会場確認（まだ行かない→先送り→再度連絡→決める→向かう）→試合→後日談→フィナーレ→完了カードまでを、
// 1本のセーブで実UI・実saveだけで通す。自由行動の途中で実セーブ→リロード→再開し、進行が壊れないことも確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
import { travelToCity, stationFares } from "./station_helpers.mjs";

const dt = name => `[data-test="${name}"]`;
const scene = id => `[data-test="ch5-scene"][data-scene="${id}"]`;
// 試合当日のカードは renderMatch が data-test="ch5-match" で出す（ch4 の eve と同じく段階ごとに寄せる）。
const matchScene = id => `${dt("ch5-match")}[data-scene="${id}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  // 選択肢は常に先頭（schedule_contact では「日を決めて連絡する」= decide）。
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const committed = (page, id) => page.waitForFunction(sceneId => window.__remake.state.flags._ch5.read[sceneId] === true, id);
// 日常ループ（#2033）の地図が開いて、指定の日・時間帯で行き先を選べる状態か。
const mapReady = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    // 新しく出た行き先（占い師など）の演出中は選べないので、終わるまで待つ
    && document.querySelector('.map:not(.done):not([data-revealing="true"]) [data-test=pin-tonari]') && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
async function go(page, pin) {
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
}

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    // 第4章の勝ち側の本線まで終えた保存（ch4 の完了状態）を直接組む。
    Object.assign(value, { chapter: 4, day: 50, slot: 1, phase: "cleared", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    // 予告3の自動再生は chapter_preview.mjs が専任で検証する。ここでは既読にして第5章本体に集中する。
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
      _ch4_preview_seen: true, _lime_opened: true, _lime_tut: 1,
      _ch4_cleared: true, _ch4_sheikh_revealed: true, _ch5_after_party: true, // 打ち上げは ch5-after-party の検査で見る
      _ch4: { startDay: 46, day: 5, stage: 4, part: "cleared", titleSeen: true, read: {},
        firstDay: 1, resolution: 5, attempts: 1 } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、第5章の出現は済んだことにする（第3・4章の検査と同じ）。
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  });
}

async function loadSlot(page, slot) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page);
  await page.locator(dt(`slot-${slot}`)).click();
}

await suite("ch5-full-flow", async check => {
  await check("r10-scene-comments-stay-out-of-vn-and-log", async page => {
    const cases = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const ui = await import("./js/core/ui.js");
      const vn = await import("./js/vn/engine.js");
      const data = await (await fetch("../data/dialogue/ch5_main.json")).json();
      core.newGame(); ui.clearScreen(); vn.clearLog();
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      vn.vnTest.turbo = false;
      const selected = [
        ["ch5_second_cup_defeat", "after_match"],
        ["ch5_return_to_tonari", "ending_start"],
      ].map(([id, marker]) => {
        const dialogue = data.dialogues.find(item => item.dialogue_id === id);
        DB.dialogues[id] = dialogue;
        const lineIndex = dialogue.lines.findIndex(line => !line.type && typeof line.text === "string");
        return { id, marker, comment: dialogue.comment, lineIndex, firstLine: dialogue.lines[lineIndex].text };
      });
      window.r10Vn = vn;
      return selected;
    });
    for (const item of cases) {
      assert(item.comment.includes(item.marker), `${item.id} has the audited comment`);
      await page.evaluate(({ id, lineIndex }) => {
        window.r10Started = performance.now();
        window.r10Play = window.r10Vn.play(id, { fromLine: lineIndex, toLine: lineIndex + 1 });
      }, item);
      await page.waitForFunction(text => document.querySelector("#vn.active .vn-text")?.textContent === text,
        item.firstLine);
      assert.equal(await page.locator("#vn.active .vn-text").textContent(), item.firstLine);
      const displayed = await page.locator("#vn.active").textContent();
      assert(!displayed.includes(item.comment) && !displayed.includes(item.marker));
      await page.locator('[data-test="vn-log"]').click();
      assert.equal(await page.locator(".vn-log.show .log-row span").last().textContent(), item.firstLine);
      const logged = await page.locator(".vn-log.show").textContent();
      assert(!logged.includes(item.comment) && !logged.includes(item.marker));
      await page.locator(".vn-log.show .log-head button").click();
      await page.waitForFunction(() => performance.now() - window.r10Started > 400);
      await page.locator("#vn.active .vn-box").click();
      await page.evaluate(() => window.r10Play);
    }
  }, { reducedMotion: "reduce" });

  await check("chapter-five-prologue-free-contact-match-and-finale-on-one-save", async page => {
    await seed(page);
    // 1. タイトルからロード → 第4章の完了カード → 第5章へ
    await loadSlot(page, 0);
    await page.locator(dt("ch4-complete")).waitFor({ timeout: 60000 });
    let state = await get(page);
    assert.equal(state.chapter, 4);
    assert.equal(state.flags._ch5, undefined);
    await page.locator(dt("ch4-chapter-five")).click();

    // 2. プロローグ2場面（章タイトル→橋渡し→帰郷）
    await page.locator(scene("ch5_bridge_after_return")).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.chapter, 5);
    assert.equal(state.day, 51);
    assert.equal(state.flags._ch5.titleSeen, true);
    assert.equal(state.flags._ch4_cleared, true, "The Chapter 4 clear record must stay");
    for (const id of ["ch5_bridge_after_return", "ch5_opening"]) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch5-continue")).click();
    }
    // 3. 自由行動は日常ループ（#2033）: 地図・日付・昼夜。勝負の日はまだ無い。
    await mapReady(page, { day: 51, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch5.part, "free");
    assert.equal(state.flags._ch5.stage, 2);
    assert.equal(state.flags._ch5.matchDay, undefined);
    assert.match(await page.locator(".hud").innerText(), /勝負の日まで[\s\S]*未定/);
    // ヒロインの店は、会ったことがあれば第5章の通いの小会話で出る（#2033 F）。この保存では会っていない。
    for (const unmet of ["minto", "shishark"])
      assert.equal(await page.locator(dt(`pin-${unmet}`)).count(), 0, `${unmet} only after meeting her`);
    // KEMURIKUSA は第5章の通いの小会話で出る（第2章の決裂の臨時休業に掛からない・#2033 F）
    assert.equal(await page.locator(dt("pin-naru")).count(), 1, "KEMURIKUSA reopened for Chapter 5");
    // 昼の tonari: ましろの訪問 → 実セーブ → リロード → 再開しても読了と日付が保たれる。
    await go(page, "tonari");
    await committed(page, "ch5_free_mashiro_visit");
    await mapReady(page, { day: 51, slot: 1 });
    await page.locator(dt("hud-menu")).click();
    await page.locator(dt("menu-tab-system")).click();
    await page.locator(dt("menu-save")).click();
    await page.locator(dt("slot-1")).click();
    await loadSlot(page, 1);
    await mapReady(page, { day: 51, slot: 1 });
    const resumed = await get(page);
    assert.equal(resumed.flags._ch5.part, "free");
    assert.equal(resumed.flags._ch5.read.ch5_free_mashiro_visit, true);
    assert.equal(resumed.flags._ch5.stage, 2, "Reload must not replay the prologue");

    // 4. 夜の tonari: 初めての客 → 寝て翌日（DAY2）。閉店後の練習は夜だけ。
    await go(page, "tonari");
    await committed(page, "ch5_free_first_visitor");
    await mapReady(page, { day: 52, slot: 0 });
    // 昼は家で休む（練習の場面は夜だけなので、昼の tonari ではいつものメニューになる）。
    await go(page, "rest");
    await mapReady(page, { day: 52, slot: 1 });
    const beforePrep = await get(page);
    await go(page, "tonari");
    await committed(page, "ch5_free_tonari_practice");
    // 閉店後の試作（#1666）: 試す→スミさんの返答→直す。能力・所持金は動かない。
    await page.locator(dt("ch5-prep-heat")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5.prep?.trial === "heat");
    await page.locator(dt("ch5-prep-adjust")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5.prep?.adjusted === true);
    await mapReady(page, { day: 53, slot: 0 });
    state = await get(page);
    for (const key of ["money", "stats"])
      assert.deepEqual(state[key], beforePrep[key], `${key} must not change by the prep`);
    for (const id of ["ch5_free_mashiro_visit", "ch5_free_first_visitor", "ch5_free_tonari_practice"])
      assert.equal(state.flags._ch5.read[id], true);

    // 5. 博士に連絡（1回目）: 「記録に残らない一日」を先に読み、日を決める → その夜を越えて翌朝が勝負の日。
    await go(page, "ch5_call");
    await committed(page, "ch5_unrecorded_day");
    await committed(page, "ch5_schedule_contact");
    await page.locator(dt("ch5-scheduled")).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.flags._ch5.part, "scheduled");
    assert.equal(state.flags._ch5_match_scheduled, true);
    assert.equal(state.day, 54);
    assert.equal(state.flags._ch5.matchDay, 54);

    // 6. 会場確認で「まだ行かない」→ 日程を取り消す: 先送りの場面を読んで、自由行動（同じ日）へ戻る。
    await page.locator(dt("ch5-go-venue")).click();
    await page.locator(dt("ch5-venue-stay")).click();
    // 「まだ行かない」は保留だけ。日程は残り、カードに留まる。
    await page.locator(dt("ch5-scheduled")).waitFor();
    assert.equal((await get(page)).flags._ch5_match_scheduled, true);
    await page.locator(dt("ch5-cancel-schedule")).click();
    await committed(page, "ch5_timeout");
    await mapReady(page, { day: 54, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch5.part, "free");
    assert.equal(state.flags._ch5_match_scheduled, false);
    assert.equal(state.flags._ch5.scheduleDecision, null);
    assert.equal(state.flags._ch5.matchDay, undefined);

    // 7. 連絡（2回目）→ 日程確定 → 翌朝（DAY5）に「向かう」で試合へ。
    await go(page, "ch5_call");
    await page.locator(dt("ch5-scheduled")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).day, 55);
    await page.locator(dt("ch5-go-venue")).click();
    await page.locator(dt("ch5-venue-go")).click();
    await page.locator(matchScene("ch5_match_day_arrival")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.part, "match");
    assert.equal(state.flags._ch5_match_started, true);

    // 8. 試合: 到着→一杯目→二本目の前→二本目の制作→挙手の合計（勝ち＋余韻）。
    // 到着→一杯目→二杯目の前は1回の「続きを読む」で連続再生される。
    await page.locator(dt("ch5-continue")).click();
    // 二本目: 同じダブルアップル12gを実際に制作し、調整2回の出来で観客の挙手が決まる（#1665）。
    await page.locator(dt("ch5-second-cup")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.secondCup ?? null, null, "The second cup is not decided before it is made");
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch5-second-cup-start")).click();
    await page.locator(matchScene("ch5_second_cup_result")).waitFor({ timeout: 180000 });
    state = await get(page);
    const cup = state.flags._ch5.secondCup;
    assert(cup && cup.total > 0, "The made cup is recorded");
    assert.equal(cup.votes.hajime + cup.votes.machine, 40);
    assert(19 + cup.votes.hajime > 21 + cup.votes.machine, `A good cup wins on the vote total: ${JSON.stringify(cup)}`);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = null; });
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_doctor_after_match")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.read.ch5_second_cup_result, true);
    assert.equal(state.flags._ch5.read.ch5_second_cup_result_afterglow, true);
    assert.equal(state.flags._ch5.part, "aftermath");
    assert.equal(state.flags._ch5.won, true);

    // 9. 後日談→フィナーレ（開始→通常→日常→鉄仮面さんの名乗り）。
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_return_to_tonari")).waitFor();
    await page.locator(dt("ch5-continue")).click();
    for (const id of ["ending_start", "ending_normal", "ending_daily_smoke", "ending_salaryman_name"]) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch5-continue")).click();
    }
    await page.locator(dt("ch5-complete")).waitFor();

    // 10. 最終state
    state = await get(page);
    assert.equal(state.chapter, 5);
    assert.equal(state.flags._ch5_cleared, true);
    assert.equal(state.phase, "cleared");
    assert.equal(state.flags._ch4_cleared, true);
    assert.deepEqual(state.flags._ch5.prep, { trial: "heat", adjusted: true }, "The prep record must survive to the end");
    for (const id of ["ch5_bridge_after_return", "ch5_opening", "ch5_free_mashiro_visit", "ch5_free_first_visitor",
      "ch5_free_tonari_practice", "ch5_unrecorded_day", "ch5_schedule_contact", "ch5_timeout",
      "ch5_match_day_arrival", "ch5_copy_first_cup", "ch5_relationship_before_second_cup",
      "ch5_second_cup_result", "ch5_second_cup_result_afterglow", "ch5_doctor_after_match",
      "ch5_return_to_tonari", "ending_start", "ending_normal", "ending_daily_smoke", "ending_salaryman_name"])
      assert.equal(state.flags._ch5.read[id], true, `${id} must be read`);
    // 完了後に再開しても、完了カードに戻り場面は再演されない。
    await loadSlot(page, 0);
    await page.locator(dt("ch5-complete")).waitFor({ timeout: 60000 });
  }, { reducedMotion: "reduce" });

  // 二本目の出来が足りなければ、挙手の合計で負け（同数含む）→ 敗北の場面 → 後日談へ続く（#1665）。
  // #2033: 第5章も柚ヶ谷へ電車で行ける。神崎の店は通い訪問の小会話だけ。夜は電車で地元へ帰る。
  // 第5章の最初の来店で一度だけ読む会話（神崎・レヰ。chapters/ch5-first-talks.js）は読み終えた保存にする（ch5_home_talks が確かめる）。
  await check("chapter-five-train-to-yuzugaya-regular-visit-and-home-at-night", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _ch2_region: "widehanga", _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true,
        ch2_kumicho_after_ch2_done: true, _talk_seen_ch5_rei_shop: true };
      Object.assign(value.met, { kumicho: true, rei: true, ageha: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、第5章の出現は済んだことにする（第3・4章の検査と同じ）。
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    // 第2章の保存に残っていた柚ヶ谷ではなく、地元から始まる。
    await mapReady(page, { day: 51, slot: 0 });
    let state = await get(page);
    assert.equal(state.flags._ch2_region, "home");
    await travelToCity(page, "widehanga");
    for (const pin of ["ch2_kumicho", "ch2_rei", "ch2_shop"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Chapter 5 Yuzugaya map`);
    assert.equal(await page.locator(dt("pin-ch2_ageha")).count(), 1, "Ageha's shop is a Chapter 5 regular after meeting her");
    assert.match(await page.locator(".hud").innerText(), /柚ヶ谷|YUZUGAYA/i);
    const before = await get(page);
    await page.locator(dt("pin-ch2_kumicho")).click();
    await page.locator(dt("map-go")).click();
    await page.waitForFunction(() => window.__remake.state.slot === 1 && !document.querySelector("#modal.show"), null, { timeout: 60000 });
    state = await get(page);
    assert.equal(state.flags._ch2_talks?.kumicho, (before.flags._ch2_talks?.kumicho || 0) + 1, "A regular visit is counted");
    assert.equal(state.money, before.money - 3000, "The visit costs the usual 3,000 yen");
    assert.equal(state.flags._ch5.part, "free", "Visiting Yuzugaya does not move the Chapter 5 story");
    // 夜の行き先（柚ヶ谷の支店は時間を使わないので、家で休む代わりに神崎の店へもう一度）→ 帰りの電車 → 翌朝は地元。
    await page.locator(".map:not(.done)[data-region=\"widehanga\"]").waitFor({ timeout: 60000 });
    await page.locator(dt("pin-ch2_rei")).click();
    await page.locator(dt("map-go")).click();
    await mapReady(page, { day: 52, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch2_region, "home", "The night ends at home");
    assert.equal(state.money, before.money - 3000 * 2 - 200, "Two visits and the train home");
    assert.equal(state.flags._ch2_talks?.rei, (before.flags._ch2_talks?.rei || 0) + 1);
    assert.equal(stationFares(page), 200, "One fare out, paid by the station UI");
  });

  // #2033 D・FIN13: Dr.fookah の配送便で東京へ（運賃はかからない・昼に出て夜に着く＝昼と夜の2行動。新幹線の1行動より1つ多い）。
  // 最初は店員に乗せてもらう話、最初の到着でムカイさんに屋根裏を借りる。好きなだけ泊まれて、帰りも配送便（昼だけ）。
  await check("chapter-five-tokyo-van-attic-stay-and-van-home", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 60000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true };
      Object.assign(value.met, { steve: true, volk: true, mukai_master: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、第5章の出現は済んだことにする（第3・4章の検査と同じ）。
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    // 地元の地図の「東京へ（配送便）」: 文字の盾（新幹線の駅の絵・店のロゴは付けない）。説明に決まりを書く。
    const toTokyo = dt("pin-ch5_to_tokyo");
    assert.equal(await page.locator(`${toTokyo} .facility-icon, ${toTokyo} .store-logo`).count(), 0, "The van pin is a plain shield");
    await page.locator(toTokyo).click();
    assert.match(await page.locator(".mi-desc").innerText(), /運賃はかからない.*昼と夜の2行動/);
    assert.equal(await page.locator(`${dt("map-go")} .mi-note`).innerText(), "無料");
    // 昼: 配送便で東京へ → 最初は Dr.fookah の店員に乗せてもらう話 → 夜に着いてムカイさんに屋根裏を借りる → 屋根裏で寝る。
    await page.locator(dt("map-go")).click();
    const tokyoMap = (day, slot) => page.waitForFunction(([day, slot]) => {
      const s = window.__remake?.state;
      return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="tokyo"] [data-test=pin-ch5_tokyo_mukai]')
        && !document.querySelector("#modal.show");
    }, [day, slot], { timeout: 60000 });
    await tokyoMap(52, 0);
    let state = await get(page);
    assert.equal(state.flags._ch2_region, "tokyo", "The night of the ride is spent in the attic");
    assert.equal(state.flags._ch5_tokyo_van, true, "A Dr.fookah clerk offers the ride the first time");
    assert.equal(state.flags._ch5_tokyo_attic, true, "Mukai lends the attic on the first arrival");
    assert.equal(state.money, 60000, "The delivery van is free");
    assert.equal(state.visitedDay?.ch5_to_tokyo, 51, "The van used the whole day 51 (day and night)");
    for (const pin of ["ch5_tokyo_steve", "ch5_tokyo_volk", "ch5_tokyo_park", "ch5_tokyo_attic", "ch5_tokyo_home", "ch5_tokyo_shop"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Chapter 5 Tokyo map`);
    assert.equal(await page.locator(dt("pin-ch5_call")).count(), 0, "The doctor is called from home");
    assert.match(await page.locator(".hud").innerText(), /TOKYO|東京/);
    // 昼: スティーブの店（東京のシーシャ屋は4,000円。帰りの分は取り置かない）。
    await go(page, "ch5_tokyo_steve");
    await tokyoMap(52, 1);
    state = await get(page);
    assert.equal(state.money, 60000 - 4000, "A Tokyo shisha shop is 4,000 yen (TKP01)");
    assert.equal(state.flags._ch5_tokyo_talks?.ch5_tokyo_steve, 1);
    // 夜: 帰りの配送便は昼だけ（押せない）→ 屋根裏で休んで、翌朝も東京。
    await page.locator(dt("pin-ch5_tokyo_home")).click();
    assert.match(await page.locator(".mi-no").innerText(), /配送便は昼に出る/);
    assert.equal(await page.locator(dt("map-go")).count(), 0, "No van at night");
    await go(page, "ch5_tokyo_attic");
    await tokyoMap(53, 0);
    state = await get(page);
    assert.equal(state.flags._ch2_region, "tokyo", "The night is spent in the attic");
    // 昼: 帰りの配送便 → 夜に地元へ着いて寝る → 翌朝は地元。
    await go(page, "ch5_tokyo_home");
    await mapReady(page, { day: 54, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch2_region, "home");
    assert.equal(state.visitedDay?.ch5_tokyo_home, 53, "The van home used the whole day 53");
    assert.equal(state.money, 60000 - 4000, "The van home is free too");
    assert.equal(state.flags._ch5.part, "free", "The Tokyo stay does not move the Chapter 5 story");
  });

  // IR16・IR17: 第5章は帰郷後なので、第1・2章と同じく恋人のLIMEの誘い→デート（絆が深まる）→節目（lover_events）。
  // FIN13: 今夜の約束がある日は東京配送便に乗れない。ドバイ出発の確認では取消・再案内も検証する。
  await check("chapter-five-lover-invitation-date-and-milestone", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 60000, stamina: 100,
        weatherSeed: 5, lovers: ["tsumugi"], loveLevel: { tsumugi: 1 }, lovePts: { tsumugi: 9 }, loverSince: { tsumugi: 44 },
        contacts: ["sumi", "tsumugi"], limeRead: ["_lover_private_account_tsumugi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true };
      Object.assign(value.met, { tsumugi: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    let state = await get(page);
    const invite = state.inbox.find(item => item.msg?.accept_event === "date_tsumugi");
    assert(invite && !invite.read, "The morning LIME brings a date invitation in Chapter 5");
    await page.locator(dt("hud-phone")).click();
    await page.locator(dt("lime-chat-tsumugi")).click();
    await page.locator('[data-test="reply-0"]:not([disabled])').click();
    await page.locator(dt("phone-next")).click();
    await page.locator(dt("phone-close")).click();
    await mapReady(page, { day: 51, slot: 0 });
    state = await get(page);
    assert.equal(state.pendingInvite?.event, "date_tsumugi");
    assert.equal(state.pendingInvite.slot, 1);
    const beforeTravel = state;
    const unchangedAppointment = value => ({
      day: value.day, slot: value.slot, money: value.money, region: value.flags._ch2_region ?? "home",
      pendingInvite: value.pendingInvite, inbox: value.inbox,
    });
    // 配送便は今夜の約束を優先し、出発ボタン自体を出さない。約束・行動・お金も保持。
    await page.locator(dt("pin-ch5_to_tokyo")).click();
    assert.match(await page.locator(".mi-no").innerText(), /今夜はLIMEの約束/);
    assert.equal(await page.locator(dt("map-go")).count(), 0, "Tonight's appointment blocks the Tokyo van");
    assert.deepEqual(unchangedAppointment(await get(page)), unchangedAppointment(beforeTravel));
    // ドバイは出発前に約束を確認する。「やめる」なら手紙・切符も消費せず地元に残る。
    await go(page, "ch5_to_dubai");
    await page.locator(dt("ch5-date-stay")).click();
    await mapReady(page, { day: 51, slot: 0 });
    state = await get(page);
    assert.deepEqual(unchangedAppointment(state), unchangedAppointment(beforeTravel));
    for (const flag of ["_ch5_dubai_letter", "_ch5_dubai_ticket", "_ch5_dubai_flights"])
      assert.equal(state.flags[flag], beforeTravel.flags[flag], `Cancel preserves ${flag}`);
    // 昼は家で休む → 仕事のあと約束の場所へ → デート → 節目 → 翌朝。
    await go(page, "rest");
    const settle = async (day, slot) => {
      for (let n = 0; n < 180; n++) {
        for (const name of ["levelup-ok", "board-close"]) {
          const button = page.locator(dt(name));
          if (await button.count() && await button.first().isVisible()) await button.first().click().catch(() => {});
        }
        if (await page.evaluate(([day, slot]) => {
          const s = window.__remake?.state;
          return s && s.day === day && s.slot === slot && !!document.querySelector('.map:not(.done):not([data-revealing="true"]) [data-test=pin-tonari]')
            && !document.querySelector("#modal.show");
        }, [day, slot])) return;
        await page.waitForTimeout(500);
      }
      throw new Error(`The map of day ${day} did not open`);
    };
    await settle(52, 0);
    state = await get(page);
    assert.equal(state.lastDate.tsumugi, 51, "The date happened on the promised night");
    assert(state.lovePts.tsumugi > 9, "The date deepens the private bond (lovePts)");
    assert(state.loverEventsSeen.includes("lover_tsumugi_lv1"), "The first milestone follows the date");
    assert.equal(state.pendingInvite, null);
    assert(state.inbox.find(item => item.id === invite.id)?.completed, "The appointment is completed once");
    // 約束を改めてドバイへ行くと、その日の約束は流れ、また誘ってもらえる。切符で無料・1行動。
    await page.evaluate(() => {
      const s = window.__remake.state;
      s.inbox.push({ id: "_date_inv_tsumugi_test_d52", originId: "_date_inv_tsumugi_test_d52", day: 52, chapter: 5, read: true, done: true, result: "accepted", log: [],
        msg: { id: "_date_inv_tsumugi_test_d52", sender: "tsumugi", type: "invitation", lover: true, accept_event: "date_tsumugi",
          time_slot: "night", after_close: true, messages: ["今日は仕事を終えてから、少し会える？"] } });
      s.pendingInvite = { event: "date_tsumugi", sender: "tsumugi", slot: 1, day: 52, originId: "_date_inv_tsumugi_test_d52", afterClose: true };
    });
    const beforeFlight = await get(page);
    await go(page, "ch5_to_dubai");
    await page.locator(dt("ch5-date-leave")).click();
    await page.locator(dt("ch5-dubai-go")).click({ timeout: 60000 });
    await page.waitForFunction(() => {
      const s = window.__remake.state;
      return s.flags._ch2_region === "dubai" && s.day === 52 && s.slot === 1
        && !!document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"]');
    }, null, { timeout: 60000 });
    state = await get(page);
    assert.equal(state.pendingInvite, null, "The date is moved to another day");
    const moved = state.inbox.find(item => item.id === "_date_inv_tsumugi_test_d52");
    assert.equal(moved.result, "expired");
    assert.equal(moved.needsResend, true);
    assert.equal(state.lastDate.tsumugi, 51, "No date in Dubai");
    assert.equal(state.money, beforeFlight.money, "The letter covers the fare");
    assert.equal(state.flags._ch5_dubai_letters, 1);
    assert.equal(state.flags._ch5_dubai_flights, 1);
    assert.equal(state.flags._ch5_dubai_ticket, false, "The ticket funds one round trip");
  });

  // 帰国後の tonari の打ち上げ（オーナー指定 2026-11-02）: 自由行動の始めに一度だけ、誰の隣に座るかを選ぶ。
  // その場にいる恋人が2人以上なら、どの席でも浮気がばれて修羅場（恋人ごとの反応→謝罪＝未解決の印）。
  await check("chapter-five-after-party-seat-and-two-lovers-shuraba", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 30000, stamina: 100,
        weatherSeed: 5, lovers: ["tsumugi", "minto"], loveLevel: { tsumugi: 1, minto: 1 }, contacts: ["sumi", "tsumugi", "minto"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false };
      Object.assign(value.met, { tsumugi: true, minto: true, naru: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    // 打ち上げの始まり → 席の選択（会ったことのあるヒロイン2人とスミさん）。
    await page.locator(dt("party-seat-minto")).waitFor({ timeout: 60000 });
    assert.equal(await page.locator('[data-test^="party-seat-"]').count(), 3, "Two met heroines and Sumi");
    await page.locator(dt("party-seat-minto")).click();
    await mapReady(page, { day: 51, slot: 0 });
    const state = await get(page);
    assert.equal(state.flags._ch5_after_party, true);
    assert.equal(state.flags._ch5_party_seat, "minto");
    assert.equal(state.flags._story_shuraba_unresolved, true, "Two lovers at the party: the affair comes out and stays unresolved");
    assert.equal(state.slot, 0, "The party does not use a free action");
    // もう一度入っても打ち上げは繰り返さない。
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    assert.equal(await page.locator('[data-test^="party-seat-"]').count(), 0, "The party happens once");
  });

  // #2033 F: KEMURIKUSA（なる）と C.STATION は第5章の通いの小会話。代金・体力・好感度（なるだけ +5）が付き、会話は巡回する。
  await check("chapter-five-kemurikusa-and-c-station-regular-talks", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 30000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1, _ch2_read_ch2_naru_confrontation: true,
        _spot_guide_naru: true, // 第1章でなるに案内された（C.STATION の解放条件）
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true };
      Object.assign(value.met, { naru: true, minto: true });
      value.affinity = { naru: 40 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    assert.equal(await page.locator(dt("pin-c_station")).count(), 1, "C.STATION after meeting Naru");
    // 昼: KEMURIKUSA（第2章で決裂していても、第5章は再開した店）。
    await go(page, "naru");
    await mapReady(page, { day: 51, slot: 1 });
    let state = await get(page);
    assert.equal(state.flags._ch5_shop_talks?.naru, 1);
    assert.equal(state.money, 30000 - 3000);
    assert(state.affinity.naru > 40, "A Chapter 5 talk with Naru raises affinity a little");
    // 夜: C.STATION → 寝て翌朝。
    await go(page, "c_station");
    await mapReady(page, { day: 52, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch5_shop_talks?.c_station, 1);
    assert.equal(state.money, 30000 - 3000 - 2500);
    // 昼: PEPPERMINT（みんとに会っていれば。恋人でも友人でも同じ店での会話）。
    await go(page, "minto");
    await mapReady(page, { day: 52, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch5_shop_talks?.minto, 1);
    assert.equal(state.flags._ch5.part, "free", "Regular talks do not move the Chapter 5 story");
  });

  // #2033 E・FIN14: シェイクの招待でドバイへ。手紙に毎回、往復の切符が同封されている（運賃はかからない）。
  // 最初の手紙は「ドバイへ」を選んだ時に読み、2通目からは帰ってから2日後の朝に届く。屋敷の客間に泊まれる。
  await check("chapter-five-dubai-letters-tickets-guest-room-and-flight-home", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 150000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch4_sheikh_revealed: true, _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true };
      Object.assign(value.met, { sheikh: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、第5章の出現は済んだことにする（第3・4章の検査と同じ）。
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    assert.equal(await page.locator(`${dt("pin-ch5_to_dubai")} .evt-badge`).count(), 1, "The Sheikh's letter is waiting");
    // 昼: ドバイへ → 最初はシェイクの手紙 → 往復の確認 → 着いたら屋敷の客間へ。
    await go(page, "ch5_to_dubai");
    await page.locator(dt("ch5-dubai-go")).click({ timeout: 60000 });
    const dubaiMap = (day, slot) => page.waitForFunction(([day, slot]) => {
      const s = window.__remake?.state;
      return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"] [data-test=pin-ch5_dubai_sheikh]')
        && !document.querySelector("#modal.show");
    }, [day, slot], { timeout: 60000 });
    await dubaiMap(51, 1);
    let state = await get(page);
    assert.equal(state.flags._ch2_region, "dubai");
    assert.equal(state.flags._ch5_dubai_letter, true, "The Sheikh's letter is read before the first flight");
    assert.equal(state.flags._ch5_dubai_guest, true, "The Sheikh prepares the guest room on the first arrival");
    assert.equal(state.money, 150000, "The Sheikh's ticket makes the first flight free");
    assert.equal(state.flags._ch5_dubai_flights, 1);
    assert.equal(state.flags._ch5_dubai_letters, 1);
    assert.equal(state.flags._ch5_dubai_ticket, false, "The ticket is used for this round trip");
    for (const pin of ["ch5_dubai_taiyo", "ch5_dubai_souq", "ch5_dubai_alley", "ch5_dubai_creek", "ch5_dubai_shop", "ch5_dubai_guest", "ch5_dubai_home"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Chapter 5 Dubai map`);
    assert.equal(await page.locator(dt("pin-ch5_call")).count(), 0, "The doctor is called from home");
    assert.equal(await page.locator(dt("pin-fortune")).count(), 0, "The fortune teller never appears in Dubai");
    assert.match(await page.locator(".hud").innerText(), /DUBAI|ドバイ/);
    const before = state.affinity?.sheikh || 0;
    // 夜: シェイクと話す → 客間で寝て、翌朝もドバイ。
    await go(page, "ch5_dubai_sheikh");
    await dubaiMap(52, 0);
    state = await get(page);
    assert.equal(state.flags._ch2_region, "dubai", "The night is spent in the guest room");
    assert.equal(state.flags._ch5_dubai_talks?.ch5_dubai_sheikh, 1);
    assert((state.affinity?.sheikh || 0) > before, "Talking with the Sheikh raises affinity a little");
    assert.equal(state.money, 150000, "The guest room is free");
    // 昼: 空港から帰る（帰りの便は往復に入っている）→ 夜は地元。
    await go(page, "ch5_dubai_home");
    await mapReady(page, { day: 52, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch2_region, "home");
    assert.equal(state.money, 150000, "The flight home is already in the round trip");
    assert.equal(state.flags._ch5_dubai_back_day, 52);
    assert.equal(state.flags._ch5.part, "free", "The Dubai stay does not move the Chapter 5 story");
    // 夜: 次の手紙はまだ（帰ってから2日後の朝に届く）。「ドバイへ」は理由を出して押せない。
    await page.locator(dt("pin-ch5_to_dubai")).click();
    assert.match(await page.locator(".mi-no").innerText(), /シェイクの次の手紙は、まだ届いていない（あと2日）/);
    assert.equal(await page.locator(dt("map-go")).count(), 0, "No flight without a ticket");
    // 家で休んで2日を過ごす（夜→翌日の昼→夜）。
    for (const [day, slot] of [[53, 0], [53, 1], [54, 0]]) {
      await go(page, "rest");
      await mapReady(page, { day, slot });
    }
    // 2日後の朝: 2通目の手紙（切符入り）が届いている → 読んで、また無料で飛ぶ → 客間の夜。
    assert.equal(await page.locator(`${dt("pin-ch5_to_dubai")} .evt-badge`).count(), 1, "The second letter has arrived");
    await go(page, "ch5_to_dubai");
    await page.locator(dt("ch5-dubai-go")).click({ timeout: 60000 });
    await dubaiMap(54, 1);
    state = await get(page);
    assert.equal(state.money, 150000, "The second flight is free too: the Sheikh sent another ticket");
    assert.equal(state.flags._ch5_dubai_letters, 2, "The second letter was read");
    assert.equal(state.flags._ch5_dubai_flights, 2);
    assert.equal(state.flags._ch5_dubai_ticket, false);
  });

  await check("chapter-five-weak-second-cup-loses-on-votes-and-continues", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 52, slot: 0, phase: "tournament", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      const read = Object.fromEntries(["ch5_bridge_after_return", "ch5_opening", "ch5_unrecorded_day",
        "ch5_schedule_contact", "ch5_match_day_arrival", "ch5_copy_first_cup",
        "ch5_relationship_before_second_cup"].map(id => [id, true]));
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
        _ch4_preview_seen: true, _ch4_cleared: true, _ch5_match_scheduled: true, _ch5_match_started: true,
        _ch5: { startDay: 51, stage: 2, part: "match", titleSeen: true, read, scheduleDecision: "decide",
          aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null } };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await page.locator(dt("ch5-second-cup")).waitFor({ timeout: 60000 });
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "bad"; });
    await page.locator(dt("ch5-second-cup-start")).click();
    await page.locator(matchScene("ch5_second_cup_defeat")).waitFor({ timeout: 180000 });
    let state = await get(page);
    const cup = state.flags._ch5.secondCup;
    assert(19 + cup.votes.hajime <= 21 + cup.votes.machine, `A weak cup does not win: ${JSON.stringify(cup)}`);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = null; });
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_doctor_after_match")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.won, false);
    assert.equal(state.flags._ch5.part, "aftermath");
    assert.equal(state.flags._ch5.read.ch5_second_cup_result, undefined);
    assert.equal(state.flags._ch5.read.ch5_second_cup_result_afterglow, undefined);
  }, { reducedMotion: "reduce" });
});
