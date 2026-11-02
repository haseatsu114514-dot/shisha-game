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
// 日常ループ（#2033）の地図が開いて、指定の日・時間帯で行き先を選べる状態か。
const mapReady = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector(".map:not(.done) [data-test=pin-tonari]") && !document.querySelector("#modal.show");
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
    for (const hidden of ["naru", "minto", "shishark", "c_station"])
      assert.equal(await page.locator(dt(`pin-${hidden}`)).count(), 0, `${hidden} is not on the Chapter 5 map yet`);
    // 昼の tonari: ましろの訪問 → 実セーブ → リロード → 再開しても読了と日付が保たれる。
    await go(page, "tonari");
    await committed(page, "ch5_free_mashiro_visit");
    await mapReady(page, { day: 51, slot: 1 });
    await page.locator(dt("hud-menu")).click();
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
