// 第5章の通しプレイ検証（#1176）。
// 第4章クリア済みセーブから、完了カード→「第5章へ進む」→プロローグ→自由行動→連絡（決める）→
// 会場確認（まだ行かない→先送り→再度連絡→決める→向かう）→試合→後日談→フィナーレ→完了カードまでを、
// 1本のセーブで実UI・実saveだけで通す。自由行動の途中で実セーブ→リロード→再開し、進行が壊れないことも確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

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
      _ch4_preview_seen: true,
      _ch4_cleared: true, _ch4_sheikh_revealed: true,
      _ch4: { startDay: 46, day: 5, stage: 4, part: "cleared", titleSeen: true, read: {},
        firstDay: 1, resolution: 5, attempts: 1 } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
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
    await page.locator(dt("ch5-free")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.part, "free");
    assert.equal(state.flags._ch5.stage, 2);

    // 3. 自由行動: 最初の自由場面→実セーブ→リロード→再開しても読了が保たれる。
    await page.locator(dt("ch5-spend-tonari")).click();
    await committed(page, "ch5_free_mashiro_visit");
    await page.locator(dt("ch5-free")).waitFor();
    await page.locator(dt("ch5-menu")).click();
    await page.locator(dt("ch5-save")).click();
    await page.locator(dt("slot-1")).click();
    await loadSlot(page, 1);
    await page.locator(dt("ch5-free")).waitFor({ timeout: 60000 });
    const resumed = await get(page);
    assert.equal(resumed.flags._ch5.part, "free");
    assert.equal(resumed.flags._ch5.read.ch5_free_mashiro_visit, true);
    assert.equal(resumed.flags._ch5.stage, 2, "Reload must not replay the prologue");
    assert.equal(resumed.day, 51);

    // 4. 残りの自由場面を読み切ると「tonari で過ごす」が消える。
    await page.locator(dt("ch5-spend-tonari")).click();
    await committed(page, "ch5_free_first_visitor");
    await page.locator(dt("ch5-free")).waitFor();
    await page.locator(dt("ch5-spend-tonari")).click();
    await committed(page, "ch5_free_tonari_practice");
    // 閉店後の試作（#1666）: 試す→スミさんの返答→直す。能力・日・所持金は動かない。
    await page.locator(dt("ch5-prep")).waitFor();
    const beforePrep = await get(page);
    await page.locator(dt("ch5-prep-heat")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5.prep?.trial === "heat");
    await page.locator(dt("ch5-prep-adjust")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch5.prep?.adjusted === true);
    await page.locator(dt("ch5-free")).waitFor();
    state = await get(page);
    for (const key of ["day", "slot", "money", "stamina", "stats"])
      assert.deepEqual(state[key], beforePrep[key], `${key} must not change by the prep`);
    assert.equal(await page.locator(dt("ch5-spend-tonari")).count(), 0);

    // 5. 連絡（1回目）: 「記録に残らない一日」を先に読み、選択肢で日程が決まる。
    await page.locator(dt("ch5-contact")).click();
    await committed(page, "ch5_unrecorded_day");
    await committed(page, "ch5_schedule_contact");
    await page.locator(dt("ch5-scheduled")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.part, "scheduled");
    assert.equal(state.flags._ch5_match_scheduled, true);

    // 6. 会場確認で「まだ行かない」: 先送りの場面を読んで自由行動へ戻る。
    await page.locator(dt("ch5-go-venue")).click();
    await page.locator(dt("ch5-venue-stay")).click();
    // 「まだ行かない」は保留だけ。日程は残り、カードに留まる。
    await page.locator(dt("ch5-scheduled")).waitFor();
    assert.equal((await get(page)).flags._ch5_match_scheduled, true);
    await page.locator(dt("ch5-cancel-schedule")).click();
    await committed(page, "ch5_timeout");
    await page.locator(dt("ch5-free")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.part, "free");
    assert.equal(state.flags._ch5_match_scheduled, false);
    assert.equal(state.flags._ch5.scheduleDecision, null);

    // 7. 連絡（2回目）→ 日程確定 → 「向かう」で試合へ。
    await page.locator(dt("ch5-contact")).click();
    await page.locator(dt("ch5-scheduled")).waitFor();
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

    // 9. 後日談→フィナーレ（開始→通常→日常）。
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_return_to_tonari")).waitFor();
    await page.locator(dt("ch5-continue")).click();
    for (const id of ["ending_start", "ending_normal", "ending_daily_smoke"]) {
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
      "ch5_return_to_tonari", "ending_start", "ending_normal", "ending_daily_smoke"])
      assert.equal(state.flags._ch5.read[id], true, `${id} must be read`);
    // 完了後に再開しても、完了カードに戻り場面は再演されない。
    await loadSlot(page, 0);
    await page.locator(dt("ch5-complete")).waitFor({ timeout: 60000 });
  }, { reducedMotion: "reduce" });

  // 二本目の出来が足りなければ、挙手の合計で負け（同数含む）→ 敗北の場面 → 後日談へ続く（#1665）。
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
