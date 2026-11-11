// 第5章の通しプレイ検証（#1176）。
// 第4章クリア済みセーブから、完了カード→「第5章へ進む」→プロローグ→自由行動→連絡（決める）→
// 会場確認（まだ行かない→先送り→再度連絡→決める→向かう）→試合→後日談→フィナーレ→完了カード
// →真エンドを確定するスタッフロール→タイトル復帰までを、
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
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      const previous = vn.hooks.onEnter;
      window.__unrecordedLines = [];
      vn.hooks.onEnter = (id, dialogue) => {
        if (id === "ch5_unrecorded_day") window.__unrecordedLines = dialogue.lines;
        previous?.(id, dialogue);
      };
    });
    await go(page, "ch5_call");
    await committed(page, "ch5_unrecorded_day");
    await committed(page, "ch5_schedule_contact");
    await page.locator(dt("ch5-scheduled")).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.flags._ch5.part, "scheduled");
    assert.equal(state.flags._ch5_match_scheduled, true);
    assert.equal(state.day, 54);
    assert.equal(state.flags._ch5.matchDay, 54);
    const ordinaryWork = await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      const source = DB.dialogues.ch5_unrecorded_day;
      return { actual: window.__unrecordedLines.map(line => line.text || "").join("\n"),
        expected: ["mashiro_seen", "visitor_seen", "practice_seen"].flatMap(key => source.branches[key]).map(line => line.text),
        choices: window.__unrecordedLines.filter(line => line.type === "choice").map(line => line.id) };
    });
    for (const remembered of ordinaryWork.expected) assert(ordinaryWork.actual.includes(remembered), remembered);
    assert.deepEqual(ordinaryWork.choices, ["ch5_unrecorded_task"], "The required scene keeps one ordinary work choice");
    assert.match(ordinaryWork.actual, /日を決めるかどうかは、まだこれから/);

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

    // 9. 後日談（勝負のあと・前半→後半→tonariへ戻る）→フィナーレ（開始→賄い→日常。鉄仮面さんの名乗りは日常に続けて読む）。
    await page.locator(dt("ch5-continue")).click();
    // 前半の末尾に千須への返事（ch5_sui_after_match）を続けて読み、後半は別の場面として読む。
    await page.locator(scene("ch5_doctor_cocreation")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.read.ch5_doctor_after_match, true);
    assert.equal(state.flags._ch5.aftermath, 1);
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_return_to_tonari")).waitFor();
    await page.locator(dt("ch5-continue")).click();
    for (const id of ["ending_start", "ending_normal", "ending_daily_smoke"]) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch5-continue")).click();
    }
    // 日常の場面の次の名乗りは、カードを挟まずに続けて読み、そのまま完了カードへ（終幕を何度も閉じない）。
    // 名乗りのカードが挟まると、ここで完了カードが出ずに止まる。
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
      "ch5_second_cup_result", "ch5_second_cup_result_afterglow", "ch5_doctor_after_match", "ch5_doctor_cocreation",
      "ch5_return_to_tonari", "ending_start", "ending_normal", "ending_daily_smoke", "ending_salaryman_name"])
      assert.equal(state.flags._ch5.read[id], true, `${id} must be read`);
    assert.deepEqual(state.flags._ch5.finaleScenes, ["ending_start", "ending_normal", "ending_daily_smoke", "ending_salaryman_name"]);
    assert.equal(state.flags._ch5.aftermath, 3);
    // 完了後に再開しても、完了カードに戻り場面は再演されない。
    await loadSlot(page, 0);
    await page.locator(dt("ch5-complete")).waitFor({ timeout: 60000 });
    assert.equal(await page.locator(dt("ch5-complete-title")).count(), 0, "初回のスタッフロールは飛ばせない");
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll")).waitFor();
    assert.equal(await page.locator(dt("staff-roll")).getAttribute("data-skippable"), "no");
    await page.locator(dt("result-next")).click({ timeout: 30000 }); // スタッフロールの後のリザルト（#2902）からタイトルへ
    await page.locator(dt("title-next-cycle")).waitFor({ timeout: 30000 });
    const trueEnd = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null"));
    assert.equal(trueEnd.flags._ch5_staff_roll_done, true);
    assert.equal(trueEnd.flags._ch5.won, true);
    assert.equal(trueEnd.flags._ch5.part, "cleared");
    const cycle = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_cycle") || "null"));
    assert.equal(cycle.unlocked, true);
    assert.deepEqual(cycle.trueEnds.map(end => end.cycleId), [trueEnd.cycleId]);
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
    // #3022 の配送便アイコンは、行きも帰りも店のロゴではなくシール風のトラックを使う。
    const assertVanSticker = async id => {
      const pin = page.locator(dt(`pin-${id}`));
      const sticker = pin.locator('.facility-icon.sticker[data-facility="delivery_truck"]');
      assert.equal(await sticker.count(), 1, `${id} uses the delivery-truck sticker`);
      assert.equal(await pin.locator('.store-logo').count(), 0, `${id} does not use a store logo`);
      const image = sticker.locator('.facility-icon-crop > img');
      await image.evaluate(img => img.decode());
      assert.match(await image.getAttribute('src'), /\/assets\/ui\/map-facilities-delivery-truck\.webp$/);
      assert.match(await sticker.locator('.facility-icon-crop').evaluate(crop => getComputedStyle(crop).filter), /facility-sticker-outline/);
    };
    const toTokyo = dt("pin-ch5_to_tokyo");
    await assertVanSticker("ch5_to_tokyo");
    await page.locator(toTokyo).click();
    assert.equal(await page.locator(".map-info .mi-desc").count(), 0);
    assert(await page.locator(dt("map-go")).isVisible());
    // 昼: 配送便で東京へ → 最初は Dr.fookah の店員に乗せてもらう話 → 夜に着いてムカイさんに屋根裏を借りる → 屋根裏で寝る。
    await page.locator(dt("map-go")).click();
    const tokyoMap = (day, slot) => page.waitForFunction(([day, slot]) => {
      const s = window.__remake?.state;
      return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="tokyo"] [data-test=pin-ch5_tokyo_mukai]')
        && !document.querySelector("#modal.show");
    }, [day, slot], { timeout: 60000 });
    await tokyoMap(52, 0);
    await assertVanSticker("ch5_tokyo_home");
    let state = await get(page);
    assert.equal(state.flags._ch2_region, "tokyo", "The night of the ride is spent in the attic");
    assert.equal(state.flags._ch5_tokyo_van, true, "A Dr.fookah clerk offers the ride the first time");
    assert.equal(state.flags._ch5_tokyo_attic, true, "Mukai lends the attic on the first arrival");
    assert.equal(state.money, 60000, "The delivery van is free");
    assert.equal(state.visitedDay?.ch5_to_tokyo, 51, "The van used the whole day 51 (day and night)");
    for (const pin of ["ch5_tokyo_steve", "ch5_tokyo_volk", "ch5_tokyo_park", "ch5_tokyo_attic", "ch5_tokyo_home", "ch5_tokyo_shop"])
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), 1, `${pin} is on the Chapter 5 Tokyo map`);
    assert.equal(await page.locator(dt("pin-ch5_call")).count(), 0, "The doctor is called from home");
    assert.equal(await page.locator(dt("pin-ch5_tokyo_club")).count(), 0, "Club SEAM opens only at night");
    assert.equal(await page.locator(dt("pin-ch5_tokyo_gym")).count(), 0, "The Tokyo CHOI-ZAP is for members only");
    assert.match(await page.locator(".hud").innerText(), /TOKYO|東京/);
    // 昼: スティーブの店（東京のシーシャ屋は4,000円。帰りの分は取り置かない）。
    await go(page, "ch5_tokyo_steve");
    await tokyoMap(52, 1);
    state = await get(page);
    assert.equal(state.money, 60000 - 4000, "A Tokyo shisha shop is 4,000 yen (TKP01)");
    assert.equal(state.flags._ch5_tokyo_talks?.ch5_tokyo_steve, 1);
    // 夜は路地の地下のクラブも出る。店主の針間ヨルに会うまでは名前を伏せた「地下の店」。
    const club = page.locator(dt("pin-ch5_tokyo_club"));
    assert.equal(await club.count(), 1, "Club SEAM is on the night map");
    assert.match(await club.innerText(), /地下の店/); assert.doesNotMatch(await club.innerText(), /SEAM/);
    // 夜: 帰りの配送便は昼だけ（押せない）→ 屋根裏で休んで、翌朝も東京。
    await page.locator(dt("pin-ch5_tokyo_home")).click();
    assert.match(await page.locator(".map-info").getAttribute("aria-label"), /配送便は昼に出る/);
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

  // #2033: 東京に泊まっている間も、第3章の東京と同じ CHOI-ZAP（会員なら・3日間風邪をひきにくい）とクラブSEAM（夜・時間は使わない）。
  await check("chapter-five-tokyo-choizap-and-club-seam", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 30000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1, _gym_member: true,
        _ch5_region_started: true, _ch2_region: "tokyo", _ch5_tokyo_van: true, _ch5_tokyo_attic: true,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true };
      Object.assign(value.met, { mukai_master: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    const tokyoMap = (day, slot) => page.waitForFunction(([day, slot]) => {
      const s = window.__remake?.state;
      return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="tokyo"] [data-test=pin-ch5_tokyo_mukai]')
        && !document.querySelector("#modal.show");
    }, [day, slot], { timeout: 60000 });
    await tokyoMap(51, 0);
    // 昼: 会員なので東京の CHOI-ZAP に入れる（行動を一つ・体力を使う）。3日間は風邪をひきにくい。
    const before = await get(page);
    await go(page, "ch5_tokyo_gym");
    await tokyoMap(51, 1);
    let state = await get(page);
    assert.ok(state.stamina < before.stamina, "The gym uses stamina");
    assert.deepEqual(state.flags._fit_since, { chapter: 5, day: 51 }, "The Tokyo CHOI-ZAP grants the FIT days in Chapter 5 too");
    assert.equal(state.visitedDay?.ch5_tokyo_gym, 51);
    assert.equal(state.money, before.money, "Members pay nothing more");
    if (await page.evaluate(async () => (await import("./js/core/growth-mode.js")).growthEnabled()))
      assert.ok((state.growth?.xp || 0) > (before.growth?.xp || 0), "A tiring visit earns EXP");
    // 夜: 地下の店（クラブSEAM）。初めての夜は第5章の出会い（第3章の場面は流さない・2026-11-07 オーナー）で針間ヨルに会い、
    // メニューから戻っても時間・お金・体力は変わらない。
    const club = page.locator(dt("pin-ch5_tokyo_club"));
    assert.match(await club.innerText(), /地下の店/);
    const night = await get(page);
    await page.evaluate(async () => (await import("./js/vn/engine.js")).clearLog());
    await go(page, "ch5_tokyo_club");
    await page.locator(dt("dj-club-menu")).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.met.yoru, true, "Yoru names herself on the first night");
    assert.equal(state.flags._club_yoru_first_done, true);
    const rows = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(({ name, text }) => ({ name, text })));
    const said = text => rows.find(row => row.text.includes(text));
    assert.ok(said("mukaiの屋根裏の子だ"), "The chapter 5 first meeting plays");
    assert.equal(said("mukaiの屋根裏の子だ").name, "？？？", "Nobody names her before she does");
    assert.equal(said("今夜の選曲は")?.name, "？？？", "Her own naming line comes before the cut-in");
    assert.ok(!said("mukaiの新しい子"), "The chapter 3 first meeting does not play in chapter 5");
    assert.ok(said("逢縁はじめです"), "After her cut-in, the shared second half (how to DJ) follows");
    assert.equal(said("踊ってもいいし")?.name, "針間ヨル", "The shared second half comes after the cut-in");
    assert.equal(state.flags._intro_yoru, true, "Her intro cut-in was shown");
    // ヨルは好感度の対象外（state.js AFFINITY_CHARACTERS・プロフィール「好感度・恋愛・LIMEの対象にしない」）。第3章と同じく出会いでも変わらない。
    assert.deepEqual(state.affinity, night.affinity, "Meeting Yoru changes no affinity, as in chapter 3");
    await page.locator(dt("dj-club-back")).click();
    await tokyoMap(51, 1);
    state = await get(page);
    for (const key of ["day", "slot", "money", "stamina", "chapter", "phase"]) assert.deepEqual(state[key], night[key], key);
    assert.equal(state.flags._ch2_region, "tokyo");
    assert.equal(state.flags._ch5.part, "free", "The club does not move the Chapter 5 story");
    await page.waitForFunction(() => /TOKYO|東京/.test(document.querySelector("#hud.show")?.textContent || ""), null, { timeout: 10000 });
    assert.match(await page.locator(dt("pin-ch5_tokyo_club")).innerText(), /クラブSEAM/, "Named once Yoru is met");
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
    assert.match(await page.locator(".map-info").getAttribute("aria-label"), /今夜はLIMEの約束/);
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
    assert.deepEqual(state.flags._ch5_party_conflict, ["tsumugi", "minto"], "Those who reacted at the party are recorded (#2815)");
    assert.equal(state.slot, 0, "The party does not use a free action");
    // もう一度入っても打ち上げは繰り返さない。
    await loadSlot(page, 0);
    await mapReady(page, { day: 51, slot: 0 });
    assert.equal(await page.locator('[data-test^="party-seat-"]').count(), 0, "The party happens once");
  });

  // #2815: ドバイのヌール（テレビ電話）と地元の恋人の修羅場。ヌールは席に座らず、席を選ぶ前に着信がつながってから打ち明け→反応。
  await check("chapter-five-after-party-noor-call-before-shuraba", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 30000, stamina: 100,
        weatherSeed: 5, lovers: ["noor", "tsumugi"], loveLevel: { noor: 1, tsumugi: 1 }, contacts: ["sumi", "tsumugi", "noor"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false };
      Object.assign(value.met, { tsumugi: true, noor: true, naru: true });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    const texts = () => page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text));
    await page.locator(dt("party-seat-tsumugi")).waitFor({ timeout: 60000 });
    assert.equal(await page.locator('[data-test^="party-seat-"]').count(), 2, "Noor has no seat: Tsumugi and Sumi");
    let read = await texts();
    assert(read.some(text => text.includes("ドバイの夕方と、ヌールさんの顔")), "The call connects before the seat");
    assert(!read.some(text => text.includes("聞こえてた")), "No reaction before the confession");
    await page.locator(dt("party-seat-tsumugi")).click();
    await mapReady(page, { day: 51, slot: 0 });
    const state = await get(page);
    assert.equal(state.flags._story_shuraba_unresolved, true);
    assert.deepEqual(state.flags._ch5_party_conflict, ["noor", "tsumugi"]);
    read = await texts();
    const at = needle => read.findIndex(text => text.includes(needle));
    assert(at("ドバイの夕方と、ヌールさんの顔") < at("一人だけじゃ、ありません"), "Call before the confession");
    assert(at("一人だけじゃ、ありません") < at("聞こえてたよ"), "Noor reacts to what she heard on the call");
    assert.equal(read.filter(text => text.includes("ドバイの夕方と、ヌールさんの顔")).length, 1, "The call is read once");
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
    assert.match(await page.locator(".map-info").getAttribute("aria-label"), /シェイクの次の手紙は、まだ届いていない（あと2日）/);
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

  // 第5章のドバイで、第4章のラクダレース場・カフェ・オアシス・砂丘の続きに入る（2026-11-07 オーナー決定「第4章を飛ばしたプレイヤーも、
  // 第5章側で前提を補ってルートに入れる」で、#2708 の「第4章で遊んだ人だけ」をやめた）。第4章で知り合っただけなら、店先とカフェで会い直す。
  // 最初の日だけ再会の場面を読む。記録・1日1回・昼の枠・ツアー代は第4章と同じ。なる（地元にいる）は砂丘に来ない。
  await check("chapter-five-dubai-camel-track-and-dunes-reunions-for-chapter-four-players", async page => {
    page.setDefaultTimeout(30000);
    const seedDubai = (camel, desert) => page.evaluate(async ([camel, desert]) => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 60, slot: 0, phase: "daily", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch4_sheikh_revealed: true, _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true,
        // ドバイの屋敷に着いた後（最初の到着の場面は読んだ）
        _ch5_region_started: true, _ch2_region: "dubai", _ch5_dubai_guest: true, _ch5_dubai_letter: true, _ch5_dubai_letters: 1,
        _ch5_dubai_flights: 1, _ch5_dubai_ticket: false,
        _ch4_camel: camel, _ch4_desert: desert };
      // 第4章の砂丘でヌールに一度勝った（第4章なら次の外出でなるが来る）が、なるはまだ来ていない
      value.desert = { runs: 1, bestRank: "B", firstClear: { chapter: 4, day: 5 }, rewarded: true, wins: 1, naruMet: false, naruWins: 0 };
      Object.assign(value.met, { sheikh: true, faris: true, khalil: true, noor: true, naru: true });
      value.affinity = { ...(value.affinity || {}), noor: 33 };
      for (const who of ["noor", "naru", "faris", "khalil", "sheikh"]) value.flags[`_intro_${who}`] = true;
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    }, [camel, desert]);
    const dubaiMap = (day, slot) => page.waitForFunction(([day, slot]) => {
      const s = window.__remake?.state;
      return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"] [data-test=pin-ch5_dubai_sheikh]')
        && !document.querySelector("#modal.show");
    }, [day, slot], { timeout: 60000 });
    // 新しく現れた行き先は地図の登場演出の間は選べないので、「ここへ行く」が出るまで選び直す
    const visit = async pin => {
      for (let i = 0; i < 40 && !(await page.locator(dt("map-go")).isVisible().catch(() => false)); i++) {
        await page.locator(dt(`pin-${pin}`)).click();
        await page.waitForTimeout(250);
      }
      await page.locator(dt("map-go")).click();
    };
    const pins = async () => Object.fromEntries(await Promise.all(["ch4_dubai_camel", "ch4_dubai_dunes", "ch4_dubai_tour_desk"]
      .map(async id => [id, await page.locator(dt(`pin-${id}`)).count()])));
    // 読んだ会話と、吹き出しに出た言い回しを集める（どの分岐を読んだか）
    const listen = phrases => page.evaluate(async phrases => {
      const vn = await import("./js/vn/engine.js");
      window.__ch5Entered = [];
      const previous = vn.hooks.onEnter;
      vn.hooks.onEnter = (id, dlg) => { window.__ch5Entered.push(id); previous?.(id, dlg); };
      window.__ch5Text = new Set();
      new MutationObserver(() => {
        const text = [...document.querySelectorAll(".vn-text")].map(node => node.dataset.raw || node.textContent).join("\n");
        for (const phrase of phrases) if (text.includes(phrase)) window.__ch5Text.add(phrase);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
      window.__remake.camelTest = { pilot: "perfect", timeScale: 8 };
    }, phrases);
    const entered = () => page.evaluate(() => window.__ch5Entered.slice());
    const said = () => page.evaluate(() => [...window.__ch5Text]);

    // 第4章で誘われただけ（本番は見た・砂丘は約束だけ・カフェの段階は途中）: 第5章でも続きに入れる。
    // カフェ・オアシスは再会だけを今日の来店にし、Dr.fookah の店先でファーリスと会い直す（本番を見た人の言い方・時間は使わない）
    await seedDubai({ stage: 2, meetDay: 47, inviteDay: 48, watched: true, plays: 0, lastPlayDay: null, best: null },
      { v: 2, talks: 4, chats: 0, lastTalkDay: 9, outings: 0, lastOutingDay: null });
    await loadSlot(page, 0);
    await dubaiMap(60, 0);
    assert.deepEqual(await pins(), { ch4_dubai_camel: 1, ch4_dubai_dunes: 1, ch4_dubai_tour_desk: 1 }, "Chapter 4 acquaintances get a way back in");
    const camelLabel = await page.evaluate(async () => (await import("./js/chapters/ch5-dubai.js")).chapterFiveDubaiLeisureSpots()
      .find(spot => spot.id === "ch4_dubai_camel")?.label);
    assert.equal(camelLabel, "Dr.fookah の店先", "They meet Faris at the shop front again before the track");
    await listen(["理解の早い子", "見せたいもの", "日本に帰ったんじゃ"]);
    let before = await get(page);
    await visit("ch4_dubai_tour_desk");
    await dubaiMap(60, 1);
    let state = await get(page);
    let ids = await entered();
    assert(ids.includes("ch5_noor_cafe_again"), ids.join(","));
    assert(!ids.includes("ch4_noor_bond_question"), "The stage talk waits for the next visit");
    assert.deepEqual([state.flags._ch4_desert.talks, state.flags._ch4_desert.lastTalkDay], [4, 60], "The reunion is today's café visit");
    assert.equal(state.money, before.money - 3000, "One shisha at the café");
    assert(state.affinity.noor > before.affinity.noor);
    assert.equal(state.flags._ch5_dubai_dunes_again, true, "Meeting her at the café replaces the reunion before the dunes");
    // 夜でも店先には顔を出せる（時間は使わない）。本番を見た記録は残し、誘われ直す
    await visit("ch4_dubai_camel");
    await page.waitForFunction(() => window.__remake.state.flags._ch5_dubai_camel_meet === true, null, { timeout: 60000 });
    await dubaiMap(60, 1);
    state = await get(page);
    ids = await entered();
    assert(ids.includes("ch5_dubai_camel_meet"), ids.join(","));
    for (const id of ["ch4_camel_meet", "ch4_camel_invite", "ch4_camel_watch"]) assert(!ids.includes(id), `${id} is not read in Chapter 5`);
    assert.deepEqual([state.flags._ch4_camel.stage, state.flags._ch4_camel.inviteDay, state.flags._ch4_camel.watched], [2, 60, true]);
    assert.equal(state.flags._ch5_dubai_camel_again, true, "No second reunion at the track");
    assert.equal(state.flags._ch5_camel_known, undefined, "The stage mark only lives while the scene is read");
    assert.equal(state.slot, 1, "The shop front uses no time");
    const shopLines = await said();
    assert(shopLines.includes("理解の早い子") && shopLines.includes("日本に帰ったんじゃ") && !shopLines.includes("見せたいもの"),
      `the reunion for players who saw the race: ${shopLines.join(" / ")}`);

    // 第4章で一度走った・砂丘へ一度出かけた: 両方出る（最初の再会まで新着の印）。カフェ・オアシスは締めくくりまで出る
    await seedDubai({ stage: 3, meetDay: 47, inviteDay: 48, watched: true, plays: 1, lastPlayDay: 49,
      best: { total: 61, rank: 3, grade: "B", time: 53.2, chapter: 4, day: 49 } },
    { v: 2, talks: 4, chats: 0, lastTalkDay: 9, outings: 1, lastOutingDay: 5 });
    await loadSlot(page, 0);
    await dubaiMap(60, 0);
    assert.deepEqual(await pins(), { ch4_dubai_camel: 1, ch4_dubai_dunes: 1, ch4_dubai_tour_desk: 1 });
    for (const pin of ["ch4_dubai_camel", "ch4_dubai_dunes"]) assert.equal(await page.locator(`${dt(`pin-${pin}`)} .evt-badge`).count(), 1, `${pin} is new`);
    await listen([]);
    before = await get(page);
    // 昼: ラクダレース場 → 再会の場面 → 練習レース → 結果 → 同じ日の夜（昼の枠を一度だけ使う）
    await visit("ch4_dubai_camel");
    await page.locator(`[data-test="camel-cup"][data-cup="practice"]`).click({ timeout: 60000 });
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    await page.locator(dt("camel-finish")).click();
    await dubaiMap(60, 1);
    state = await get(page);
    assert.equal(state.flags._ch5_dubai_camel_again, true, "The reunion at the track is read once");
    assert.equal(state.flags._ch4_camel.plays, 2);
    assert.equal(state.flags._ch4_camel.lastPlayDay, 60);
    assert.deepEqual([state.money, state.stamina], [before.money, before.stamina], "The race costs no money or stamina");
    assert.equal(state.visitedDay.ch4_dubai_camel, 60);
    ids = await entered();
    assert(ids.includes("ch5_dubai_camel_again"), ids.join(","));
    assert(ids.includes("ch4_camel_replay_best") || ids.includes("ch4_camel_replay_usual"), ids.join(","));
    for (const id of ["ch4_camel_replay", "ch4_camel_meet", "ch4_camel_invite", "ch4_camel_watch", "ch4_camel_result_win", "ch4_camel_result_place", "ch4_camel_result_last"])
      assert(!ids.includes(id), `${id} is not read in Chapter 5`);
    assert(await page.locator(".hud").isVisible(), "The daily HUD comes back after the race");
    // 夜は走れない（理由を出して押せない）。客間で寝て翌朝もドバイ
    await page.locator(dt("pin-ch4_dubai_camel")).click();
    await page.locator('.map-info[aria-label*="今日はもう走った"], .map-info[aria-label*="レースは朝"]').waitFor();
    assert.equal(await page.locator(dt("map-go")).count(), 0, "No race at night");
    await visit("ch5_dubai_guest");
    await dubaiMap(61, 0);
    assert.equal(await page.locator(`${dt("pin-ch4_dubai_camel")} .evt-badge`).count(), 0, "The track is not new after the reunion");
    // 昼: ヌールと砂丘へ → 再会の場面（デスク）→ 2回目からのツアー代 → 滑って夕日 → 同じ日の夜
    before = await get(page);
    await visit("ch4_dubai_dunes");
    // 2回目からは練習なしでメニューから。なるとの勝負（裏）は出さない
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "menu", null, { timeout: 90000 });
    assert.equal(await page.locator(dt("desert-start-naru")).count(), 0, "No race against Naru in Chapter 5");
    await page.locator(dt("desert-start")).click();
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "result", null, { timeout: 90000 });
    await page.locator(dt("desert-leave")).click();
    await dubaiMap(61, 1);
    state = await get(page);
    assert.equal(state.flags._ch5_dubai_dunes_again, true, "The reunion at the desk is read once");
    assert.equal(state.flags._ch4_desert.outings, 2);
    assert.equal(state.flags._ch4_desert.lastOutingDay, 61, "Chapter 5 records the absolute day");
    assert.equal(state.money, before.money - 6000, "The usual tour fee from the second trip");
    assert.equal(state.stamina, before.stamina, "The trip uses no stamina");
    assert.equal(state.desert.naruMet, false, "Naru is back home and never comes to the Chapter 5 dunes");
    ids = await entered();
    for (const id of ["ch5_dubai_dunes_again", "ch4_desert_again", "ch4_desert_sunset_again"]) assert(ids.includes(id), `${id}: ${ids.join(",")}`);
    for (const id of ["ch4_desert_arrive", "ch4_desert_sunset_first", "ch4_desert_naru_arrive", "ch4_noor_meet", "ch4_noor_invite"])
      assert(!ids.includes(id), `${id} is not read in Chapter 5`);
    assert(await page.locator(".hud").isVisible(), "The daily HUD comes back after the dunes");
    assert.match(await page.locator(dt("pin-ch4_dubai_dunes")).getAttribute("class"), /\boff\b/, "No second trip tonight");
    assert.equal(state.flags._ch5.part, "free", "The Dubai outings do not move the Chapter 5 story");
  });

  // 第4章のヌールの締めくくりで「二人で見たい」と答えたまま、砂丘へ行けずに帰国した（告白を待たれている）。
  // 第5章の最初の砂丘が約束の日: 再会は約束の続き、ツアー代なし、滑ったあとの夕日で告白（帰国した後の言い方）。
  await check("chapter-five-dubai-dunes-keep-noor-s-chapter-four-promise", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 60, slot: 0, phase: "daily", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch4_sheikh_revealed: true, _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
          read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
          finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true,
        _ch5_region_started: true, _ch2_region: "dubai", _ch5_dubai_guest: true, _ch5_dubai_letter: true, _ch5_dubai_letters: 1,
        _ch5_dubai_flights: 1, _ch5_dubai_ticket: false,
        _ch4_desert: { v: 2, talks: 6, chats: 0, lastTalkDay: 12, outings: 1, lastOutingDay: 5 } };
      value.desert = { runs: 1, bestRank: "B", firstClear: { chapter: 4, day: 5 }, rewarded: true, wins: 0, naruMet: false, naruWins: 0 };
      Object.assign(value.met, { sheikh: true, noor: true, naru: true });
      value.affinity = { ...(value.affinity || {}), noor: 70 };
      value.finales = { ...(value.finales || {}), noor: { route: "romance", chapter: 4, day: 12 } };
      value.romanceChoices = { ...(value.romanceChoices || {}),
        bond_q1_noor: { char: "noor", value: 1 }, bond_q2_noor: { char: "noor", value: 1 } };
      value.flags[(await import("./js/core/affinity-stages.js")).questionDoneKey("noor")] = true;
      for (const who of ["noor", "naru", "sheikh"]) value.flags[`_intro_${who}`] = true;
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
      value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0); // 選択肢は先頭（告白には「好きです」と答える）
    await page.waitForFunction(() => document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"] [data-test=pin-ch5_dubai_sheikh]')
      && !document.querySelector("#modal.show"), null, { timeout: 60000 });
    const promise = await page.evaluate(async () => {
      const ch5 = await import("./js/chapters/ch5-dubai.js");
      return ch5.chapterFiveDubaiLeisureSpots().find(spot => spot.id === "ch4_dubai_dunes")?.desc || "";
    });
    assert.match(promise, /ヌールとの約束.*ツアー代はいらない/, promise);
    // 読んだ会話と、吹き出しに出た言い回しを集める（どの分岐を読んだか）
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      window.__ch5Entered = [];
      const previous = vn.hooks.onEnter;
      vn.hooks.onEnter = (id, dlg) => { window.__ch5Entered.push(id); previous?.(id, dlg); };
      window.__ch5Text = new Set();
      const phrases = ["予定表につけた丸", "久しぶり", "画面の外", "ハジメが日本に帰ってから", "いつか日本に帰る", "言わないまま見送ったら", "また日本に帰る"];
      new MutationObserver(() => {
        const text = [...document.querySelectorAll(".vn-text")].map(node => node.dataset.raw || node.textContent).join("\n");
        for (const phrase of phrases) if (text.includes(phrase)) window.__ch5Text.add(phrase);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const before = await get(page);
    for (let i = 0; i < 40 && !(await page.locator(dt("map-go")).isVisible().catch(() => false)); i++) {
      await page.locator(dt("pin-ch4_dubai_dunes")).click();
      await page.waitForTimeout(250);
    }
    await page.locator(dt("map-go")).click();
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "menu", null, { timeout: 90000 });
    await page.locator(dt("desert-start")).click();
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "result", null, { timeout: 90000 });
    await page.locator(dt("desert-leave")).click();
    await page.waitForFunction(() => {
      const s = window.__remake?.state;
      return s && s.day === 60 && s.slot === 1 && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"] [data-test=pin-ch5_dubai_sheikh]')
        && !document.querySelector("#modal.show");
    }, null, { timeout: 90000 });
    const state = await get(page);
    const ids = await page.evaluate(() => window.__ch5Entered.slice());
    const said = await page.evaluate(() => [...window.__ch5Text]);
    for (const id of ["ch5_dubai_dunes_again", "ch4_desert_again", "confession_noor", "confession_noor_accept"]) assert(ids.includes(id), `${id}: ${ids.join(",")}`);
    assert(!ids.includes("ch4_desert_sunset_again"), "The confession takes the place of the usual sunset");
    assert.deepEqual(said.sort(), ["ハジメが日本に帰ってから", "予定表につけた丸"].sort(),
      `the promise reunion and the after-returning confession lines, not the Chapter 4 ones: ${said.join(" / ")}`);
    assert.deepEqual(state.lovers, ["noor"], "Accepting makes Noor a lover");
    assert(state.contacts.includes("noor"), "They swap LIME at the confession");
    assert.equal(state.money, before.money, "The promised trip is free");
    assert.equal(state.flags._ch4_desert.outings, 2);
    assert.equal(state.flags._ch5_dubai_dunes_again, true);
    assert.equal(state.flags._noor_ch5_promise, undefined, "The promise mark only lives while the reunion is read");
    assert.equal(state.desert.naruMet, false, "Naru never comes to the Chapter 5 dunes");
  });

  // 第5章のドバイの屋敷に着いた後（day 60・昼）の保存。flags・met・affinity・romanceChoices は足し、desert は置き換える。
  // questionDone に挙げた相手は♥3の問いに答えた印を立てる。
  const seedChapterFiveDubai = (page, extra = {}) => page.evaluate(async extra => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day: 60, slot: 0, phase: "daily", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch4_sheikh_revealed: true, _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
        read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
        finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true,
      _ch5_region_started: true, _ch2_region: "dubai", _ch5_dubai_guest: true, _ch5_dubai_letter: true, _ch5_dubai_letters: 1,
      _ch5_dubai_flights: 1, _ch5_dubai_ticket: false, _intro_sheikh: true };
    Object.assign(value.met, { sheikh: true }, extra.met || {});
    Object.assign(value.flags, extra.flags || {});
    for (const key of ["affinity", "romanceChoices"]) if (extra[key]) value[key] = { ...(value[key] || {}), ...extra[key] };
    if (extra.desert) value.desert = extra.desert;
    const { questionDoneKey } = await import("./js/core/affinity-stages.js");
    for (const id of extra.questionDone || []) value.flags[questionDoneKey(id)] = true;
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  }, extra);
  const chapterFiveDubaiMap = (page, day, slot) => page.waitForFunction(([day, slot]) => {
    const s = window.__remake?.state;
    return s && s.day === day && s.slot === slot && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="dubai"] [data-test=pin-ch5_dubai_sheikh]')
      && !document.querySelector("#modal.show");
  }, [day, slot], { timeout: 90000 });
  // 新しく現れた行き先は地図の登場演出の間は選べないので、「ここへ行く」が出るまで選び直す
  const visitPin = async (page, pin) => {
    for (let i = 0; i < 40 && !(await page.locator(dt("map-go")).isVisible().catch(() => false)); i++) {
      await page.locator(dt(`pin-${pin}`)).click();
      await page.waitForTimeout(250);
    }
    await page.locator(dt("map-go")).click();
  };
  // 読んだ会話と、吹き出しに出た言い回しを集める（どの分岐を読んだか）
  const listenScenes = (page, phrases) => page.evaluate(async phrases => {
    const vn = await import("./js/vn/engine.js");
    window.__ch5Entered = [];
    const previous = vn.hooks.onEnter;
    vn.hooks.onEnter = (id, dlg) => { window.__ch5Entered.push(id); previous?.(id, dlg); };
    window.__ch5Text = new Set();
    new MutationObserver(() => {
      const text = [...document.querySelectorAll(".vn-text")].map(node => node.dataset.raw || node.textContent).join("\n");
      for (const phrase of phrases) if (text.includes(phrase)) window.__ch5Text.add(phrase);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, phrases);
  const heard = page => page.evaluate(() => ({ ids: window.__ch5Entered.slice(), said: [...window.__ch5Text] }));

  // 2026-11-07 オーナー決定「第4章のラクダレース／砂丘を飛ばしたプレイヤーも、第5章側で前提を補ってルートに入れる」:
  // 第4章でファーリス・ヌールに会っていない人も、第5章のドバイで出会いから入れる。Dr.fookah の店先でファーリスと出会い（時間は使わない）、
  // 翌日の昼にレース場（本番の見学 → 初めてのレース）。カフェ・オアシスでヌールと出会い（♥1ちょうど）、次の来店で♥1の会話（大会後の分岐）。
  await check("chapter-five-dubai-first-meetings-with-faris-and-noor-without-chapter-four-history", async page => {
    page.setDefaultTimeout(30000);
    await seedChapterFiveDubai(page);
    await loadSlot(page, 0);
    await chapterFiveDubaiMap(page, 60, 0);
    for (const [pin, count] of [["ch4_dubai_camel", 1], ["ch4_dubai_tour_desk", 1], ["ch4_dubai_dunes", 0]]) {
      assert.equal(await page.locator(dt(`pin-${pin}`)).count(), count, pin);
      if (count) assert.equal(await page.locator(`${dt(`pin-${pin}`)} .evt-badge`).count(), 1, `${pin} is new`);
    }
    const spots = await page.evaluate(async () => (await import("./js/chapters/ch5-dubai.js")).chapterFiveDubaiLeisureSpots()
      .map(spot => ({ id: spot.id, label: spot.label, area: spot.area, desc: spot.desc })));
    const desk = spots.find(spot => spot.id === "ch4_dubai_tour_desk");
    assert.equal(desk.label, "砂漠ツアーのカフェ");
    assert.doesNotMatch(`${desk.label}${desk.area}${desk.desc}`, /宿/, "Hajime stays at the Sheikh's residence, not the inn");
    assert.equal(spots.find(spot => spot.id === "ch4_dubai_camel").label, "Dr.fookah の店先");
    await listenScenes(page, ["いらっしゃいませ", "日本に帰ったんじゃ", "日本の子", "大会の準備"]);
    await page.evaluate(() => { window.__remake.camelTest = { pilot: "perfect", timeScale: 8 }; });
    const start = await get(page);
    // 昼: 店先でファーリスと出会い、翌朝のレースに誘われる（時間・お金は使わない）
    await visitPin(page, "ch4_dubai_camel");
    await page.waitForFunction(() => window.__remake.state.flags._ch5_dubai_camel_meet === true, null, { timeout: 60000 });
    await chapterFiveDubaiMap(page, 60, 0);
    let state = await get(page);
    let { ids, said } = await heard(page);
    assert(ids.includes("ch5_dubai_camel_meet"), ids.join(","));
    for (const id of ["ch4_camel_meet", "ch4_camel_invite", "ch4_camel_watch"]) assert(!ids.includes(id), `${id} is not read in Chapter 5`);
    assert.deepEqual([state.flags._ch4_camel.stage, state.flags._ch4_camel.meetDay, state.flags._ch4_camel.inviteDay], [2, 60, 60]);
    assert.equal(state.flags._ch5_dubai_camel_again, true, "Met in Chapter 5: no reunion at the track");
    assert.equal(state.met.faris, true);
    assert.equal(state.money, start.money);
    assert(said.includes("いらっしゃいませ") && !said.includes("日本に帰ったんじゃ"), `a first meeting, not a reunion: ${said.join(" / ")}`);
    await page.locator(dt("pin-ch4_dubai_camel")).click();
    assert.match(await page.locator(".map-info").getAttribute("aria-label"), /六時に店の前で待ち合わせ/);
    assert.equal(await page.locator(dt("map-go")).count(), 0, "The race is tomorrow morning");
    // 昼: カフェ・オアシスでヌールと出会う（第5章の書き出し・♥1ちょうど・一台の代金）
    await visitPin(page, "ch4_dubai_tour_desk");
    await chapterFiveDubaiMap(page, 60, 1);
    state = await get(page);
    ({ ids } = await heard(page));
    assert(ids.includes("ch5_noor_meet") && !ids.includes("ch4_noor_meet"), ids.join(","));
    assert.deepEqual([state.flags._ch4_desert.talks, state.flags._ch4_desert.lastTalkDay], [1, 60]);
    assert.equal(state.affinity.noor, 9, "The first meeting is exactly ♥1");
    assert.equal(state.met.noor, true);
    assert.equal(state.money, start.money - 3000);
    assert.equal(state.flags._ch5_dubai_dunes_again, true, "Met in Chapter 5: no reunion before the dunes");
    // 夜: 客間で休む → 翌日の昼にレース場（本番の見学 → 初めてのレース → 結果）
    await visitPin(page, "ch5_dubai_guest");
    await chapterFiveDubaiMap(page, 61, 0);
    await visitPin(page, "ch4_dubai_camel");
    await page.locator(dt("camel-tutorial")).waitFor({ timeout: 90000 });
    await page.locator(dt("camel-tutorial-skip")).click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    await page.locator(dt("camel-finish")).click();
    await chapterFiveDubaiMap(page, 61, 1);
    state = await get(page);
    ({ ids } = await heard(page));
    assert(ids.includes("ch4_camel_watch"), ids.join(","));
    assert(["ch4_camel_result_win", "ch4_camel_result_place", "ch4_camel_result_last"].some(id => ids.includes(id)), ids.join(","));
    assert(!ids.includes("ch5_dubai_camel_again"), "No reunion after meeting in Chapter 5");
    assert.deepEqual([state.flags._ch4_camel.stage, state.flags._ch4_camel.plays, state.flags._ch4_camel.lastPlayDay], [3, 1, 61]);
    assert.equal(state.met.khalil, true);
    assert(await page.locator(".hud").isVisible(), "The daily HUD comes back after the race");
    // 夜: カフェ・オアシスで♥1の会話（第5章は大会の後: 父の噂の分岐。大会前の言い方は読まない）
    await visitPin(page, "ch4_dubai_tour_desk");
    await chapterFiveDubaiMap(page, 62, 0);
    state = await get(page);
    ({ ids, said } = await heard(page));
    assert(ids.includes("ch4_noor_talk2"), ids.join(","));
    assert.equal(state.flags._ch4_desert.talks, 2);
    assert(state.affinity.noor > 9);
    assert(said.includes("日本の子") && !said.includes("大会の準備"), `the late-read branch: ${said.join(" / ")}`);
  });

  // 2026-11-07 オーナー決定「ノールの告白は第5章でも可能にする」: 第5章のカフェ・オアシスで♥5の締めくくりを迎え、「二人で見たい」と答えると、
  // 次の砂丘（ツアー代なし）の夕日で告白（また日本に帰る前の言い方 visiting）→ 恋人・LIME・ギャラリーの恋人成立。夜の帰り道の予約は入れない。
  await check("chapter-five-dubai-noor-finale-and-sunset-confession-reached-in-chapter-five", async page => {
    page.setDefaultTimeout(30000);
    // 第5章で出会って通い、段階の会話を全部読み、♥3の問いで恋愛を選び、砂丘へ一度出かけた（♥5）。締めくくりはまだ
    await seedChapterFiveDubai(page, {
      flags: { _ch4_desert: { v: 2, talks: 6, chats: 0, lastTalkDay: 59, outings: 1, lastOutingDay: 58 }, _ch5_dubai_dunes_again: true, _intro_noor: true },
      desert: { runs: 1, bestRank: "B", firstClear: { chapter: 5, day: 58 }, rewarded: true, wins: 0, naruMet: false, naruWins: 0 },
      affinity: { noor: 66 }, romanceChoices: { bond_q1_noor: { char: "noor", value: 1 } }, met: { noor: true }, questionDone: ["noor"],
    });
    await loadSlot(page, 0); // 選択肢は先頭（最後の問いは「二人で見たい」、告白には「好きです」と答える）
    await chapterFiveDubaiMap(page, 60, 0);
    assert.equal(await page.locator(`${dt("pin-ch4_dubai_tour_desk")} .evt-badge`).count(), 1, "The finale is waiting at the café");
    await listenScenes(page, ["また日本に帰る", "ハジメが日本に帰ってから", "いつか日本に帰る", "予定表につけた丸", "久しぶり"]);
    let before = await get(page);
    await visitPin(page, "ch4_dubai_tour_desk");
    await chapterFiveDubaiMap(page, 60, 1);
    let state = await get(page);
    let { ids } = await heard(page);
    assert(ids.includes("ch4_noor_bond_finale"), ids.join(","));
    assert.deepEqual([state.finales?.noor?.chapter, state.finales?.noor?.route, state.finales?.noor?.day], [5, "romance", 60]);
    assert.equal(state.owned.filter(id => id === "suyaki_noor").length, 1, "Her hagal is given once");
    assert.equal(state.money, before.money - 3000);
    assert.equal(state.flags._confession_due, undefined, "Noor's confession is her own sunset scene, never the night walk");
    const after = await page.evaluate(async () => {
      const { relationshipStatus } = await import("./js/daily/relationship-status.js");
      const spots = (await import("./js/chapters/ch5-dubai.js")).chapterFiveDubaiLeisureSpots();
      return { status: relationshipStatus("noor").label, ids: spots.map(spot => spot.id), dunes: spots.find(spot => spot.id === "ch4_dubai_dunes")?.desc || "" };
    });
    assert.equal(after.status, "告白を選べる");
    assert(!after.ids.includes("ch4_dubai_tour_desk"), "After the finale the café leaves the map (the dunes stay)");
    assert.match(after.dunes, /ヌールとの約束.*ツアー代はいらない/, after.dunes);
    // 夜は客間で休み、翌日の昼に砂丘へ（滑ったあとの夕日で告白）
    await visitPin(page, "ch5_dubai_guest");
    await chapterFiveDubaiMap(page, 61, 0);
    before = await get(page);
    await visitPin(page, "ch4_dubai_dunes");
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "menu", null, { timeout: 90000 });
    await page.locator(dt("desert-start")).click();
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === "result", null, { timeout: 90000 });
    await page.locator(dt("desert-leave")).click();
    await chapterFiveDubaiMap(page, 61, 1);
    state = await get(page);
    let said;
    ({ ids, said } = await heard(page));
    for (const id of ["ch4_desert_again", "confession_noor", "confession_noor_accept"]) assert(ids.includes(id), `${id}: ${ids.join(",")}`);
    for (const id of ["ch5_dubai_dunes_again", "ch4_desert_sunset_again", "ch5_noor_sunset_first"]) assert(!ids.includes(id), `${id}: ${ids.join(",")}`);
    assert.deepEqual(said, ["また日本に帰る"], `the visiting confession, not the Chapter 4 or the came-back lines: ${said.join(" / ")}`);
    assert.deepEqual(state.lovers, ["noor"], "Accepting makes Noor a lover");
    assert(state.contacts.includes("noor"), "They swap LIME at the confession");
    assert.equal(state.loverSince.noor, 61);
    assert.equal(state.loveLevel.noor, 1);
    assert.equal(state.money, before.money, "The promised trip is free");
    assert.equal(state.flags._noor_confession_visit, undefined, "The confession mark only lives while the scene is read");
    const gallery = await page.evaluate(async () => (await import("./js/core/gallery-progress.js")).readGalleryProgress().routeRecords.noor?.becameLover);
    assert.equal(gallery, true, "The gallery records the route as 恋人成立");
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
    // 「下手に作る」自動操作（craftTest.auto = "bad"）は吸う位置を乱数で選び、温度を見ない。蒸らしの揺らぎ（session.js の
    // steamVariation）も乱数なので、冷たい側に振れると適温に入って二台目が勝つことがあった（CI で 22対18・合計41対39）。
    // 乱数を高い側に固定して、蒸らしは熱く・吸いは強くし、仕上がった弱い一台にする（総合67前後・17票）。
    await page.evaluate(async () => {
      (await import("./js/craft/session.js")).craftTest.auto = "bad";
      window.__realRandom = Math.random; Math.random = () => .9;
      // 読んだ行を、台本IDつきで記録する（制作のあとの行と、勝負のあとの台本の出し分けを確かめる）。
      window.__ch5Lines = [];
      (await import("./js/vn/engine.js")).hooks.onLine = (id, line) => window.__ch5Lines.push([id, line.speaker || "", line.text]);
    });
    const readLines = () => page.evaluate(() => window.__ch5Lines.splice(0));
    await page.locator(dt("ch5-second-cup-start")).click();
    await page.locator(matchScene("ch5_second_cup_defeat")).waitFor({ timeout: 180000 });
    let state = await get(page);
    const cup = state.flags._ch5.secondCup;
    assert.notEqual(cup.category, "failed", `The weak cup is finished, not failed: ${JSON.stringify(cup)}`);
    assert(19 + cup.votes.hajime < 21 + cup.votes.machine, `A weak cup loses on the votes: ${JSON.stringify(cup)}`);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = null; Math.random = window.__realRandom; });
    // 制作のあと: 調整の地の文に続けて、初めて会う客に尋ね、先に吸ってもらう4行を読む（STK02。提供できた一台だけ）。
    const afterCraft = (await readLines()).filter(([id]) => id === "ch5_second_cup_adjust");
    assert.equal(afterCraft.length, 5, JSON.stringify(afterCraft));
    assert.equal(afterCraft[0][1], "", "The adjustment line is narration");
    assert.deepEqual(afterCraft.slice(1), [
      ["ch5_second_cup_adjust", "", "隣の席は、初めて見る顔だった。ホースを持つ手が、まだ硬い。"],
      ["ch5_second_cup_adjust", "hajime", "初めてですよね。今日は、どのくらいゆっくりできますか"],
      ["ch5_second_cup_adjust", "customer", "……三十分くらい。このあと、人と会うので"],
      ["ch5_second_cup_adjust", "hajime", "なら、先にどうぞ。いちばん香るのは、今なので"],
    ]);
    await page.locator(dt("ch5-continue")).click();
    // 負けたあとは、勝った博士が折れない専用の前半を読む。博士の一言は実際の挙手に合う台本
    // （二台目の9000の挙手が一台目の21より減っていれば「票が減りました」、減っていなければ「票が割れました」）。
    const opening = cup.votes.machine < 21 ? "ch5_doctor_after_match_loss_close" : "ch5_doctor_after_match_loss";
    await page.locator(scene(opening)).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch5.won, false);
    assert.equal(state.flags._ch5.part, "aftermath");
    assert.equal(state.flags._ch5.read.ch5_second_cup_result, undefined);
    assert.equal(state.flags._ch5.read.ch5_second_cup_result_afterglow, undefined);
    // 前半→後半（勝敗共通）→tonariへ戻る。勝ちの前半は読まない。
    await readLines(); // 敗北の場面（ch5_second_cup_defeat）の行は数えない
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_doctor_cocreation")).waitFor();
    // 前半: 博士の一言は挙手に合う。折れる台詞（正解の味）は出ない。末尾に、千須への返事が同じ場面として続く（STK05）。
    const first = await readLines();
    assert(first.every(([id]) => id === opening), JSON.stringify(first.map(([id]) => id)));
    const said = first.map(([, , text]) => text);
    assert.equal(said[1], cup.votes.machine < 21 ? "合計は、9000です。……なのに、二台目の票が減りました"
      : "合計は、9000です。……なのに、二台目も票が割れました");
    assert(said.includes("記録にない項目です。次回から、先に尋ねます"));
    assert(!said.some(text => /正解の味/.test(text)), "The winning doctor does not concede");
    assert.deepEqual(first.slice(-4).map(([, speaker, text]) => [speaker, text]).slice(0, 3), [
      ["sui", "一つだけ聞く。君が作れない夜に来た客は、どうする"],
      ["hajime", "俺が作れない日は、つむぎが作ります。つむぎが作れない日は、俺が"],
      ["sui", "……それを、店と呼ぶんだろうな"],
    ]);
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_return_to_tonari")).waitFor();
    // 後半: 検品札で始まり、博士の最後の一言で終わる。温度計の一言は、第2章で借りていない保存では出ない。
    const second = (await readLines()).map(([, , text]) => text);
    assert.equal(second[1], "博士はケースを開けた。配線に、小さな検品札が付いている。");
    assert(second.includes("私は三つの大会で、君に点を入れました。味は、分からないまま"));
    assert(!second.some(text => /温度計/.test(text)), "No thermometer line without the Chapter 2 loan");
    assert.equal(second.at(-1), "……味は、まだ遠いです。でも、手は覚えていました");
    state = await get(page);
    assert.equal(state.flags._ch5.read[opening], true);
    assert.equal(state.flags._ch5.read.ch5_doctor_cocreation, true);
    assert.equal(state.flags._ch5.read.ch5_doctor_after_match, undefined, "The winner's first half is not read after a loss");
  }, { reducedMotion: "reduce" });

  // 勝負のあと・後半の温度計の一言（第2章で借りた保存だけ）と、恋人が一人のフィナーレの順（賄い→その人の後日談。STK11）。
  await check("chapter-five-thermometer-line-and-shared-meal-before-single-lover-epilogue", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 52, slot: 0, phase: "aftermath", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: ["minto"], contacts: ["sumi", "minto"] });
      value.met.minto = true;
      const read = Object.fromEntries(["ch5_bridge_after_return", "ch5_opening", "ch5_unrecorded_day",
        "ch5_schedule_contact", "ch5_match_day_arrival", "ch5_copy_first_cup", "ch5_relationship_before_second_cup",
        "ch5_second_cup_result", "ch5_second_cup_result_afterglow"].map(id => [id, true]));
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
        _ch4_preview_seen: true, _ch4_cleared: true, _ch5_after_party: true, _ch5_match_scheduled: true, _ch5_match_started: true,
        _stk_kemuri_thermo_borrowed: true,
        _ch5: { startDay: 51, stage: 2, part: "aftermath", titleSeen: true, read, scheduleDecision: "decide",
          aftermath: 0, finale: 0, finaleScenes: null, won: true,
          secondCup: { total: 90, category: "steady", votes: { hajime: 26, machine: 14 } } } };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await loadSlot(page, 0);
    await page.locator(scene("ch5_doctor_after_match")).waitFor({ timeout: 60000 });
    await page.evaluate(async () => {
      window.__ch5Lines = [];
      (await import("./js/vn/engine.js")).hooks.onLine = (id, line) => window.__ch5Lines.push(line.text);
    });
    const readLines = () => page.evaluate(() => window.__ch5Lines.splice(0));
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_doctor_cocreation")).waitFor();
    const first = await readLines();
    assert(first.includes("……正解の味を、一つだけ探していたのかもしれません"), "The winner's first half keeps the doctor's own words");
    assert.equal(first.at(-3), "俺が作れない日は、つむぎが作ります。つむぎが作れない日は、俺が");
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene("ch5_return_to_tonari")).waitFor();
    const second = await readLines();
    const judged = second.indexOf("熱と、煙と、吸った人の顔。それで、採点はできてしまった");
    assert(judged > 0, JSON.stringify(second));
    assert.deepEqual(second.slice(judged + 1, judged + 3), ["県大会の前に貸した温度計。あれが、9000のいちばん古い部品です",
      "だから、舌が利かなくても作れる一台が欲しかった。私のような作り手のためにも"]);
    await page.locator(dt("ch5-continue")).click();
    // フィナーレ: 賄い（ending_normal）を読んでから、その人の後日談。名乗りは日常の場面に続けて読む。
    for (const id of ["ending_start", "ending_normal", "epilogue_minto", "ending_daily_smoke"]) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch5-continue")).click();
    }
    await page.locator(dt("ch5-complete")).waitFor();
    const state = await get(page);
    assert.deepEqual(state.flags._ch5.finaleScenes,
      ["ending_start", "ending_normal", "epilogue_minto", "ending_daily_smoke", "ending_salaryman_name"]);
    for (const id of state.flags._ch5.finaleScenes) assert.equal(state.flags._ch5.read[id], true, `${id} must be read`);
    assert.equal(state.flags._ch5_cleared, true);
    const lines = await readLines();
    const order = ["三ヶ月目に決めた名前は、もう書けなかった。あれは、俺ひとりの城の名前だった。",
      "スミさん。tonariって、どうしてこの名前なんですか", "客の隣に座れる店にしたかった、……それだけだ",
      "別の日。閉店後、ミントさんの部屋で遅い夕飯を作った。", "返事を聞きながら、もう一つボウルを出す。",
      "閉店の少し前。奥まった席に、いつもの鉄仮面さんが座った。",
      "客が帰ったあと、カウンターの一番古いトロフィーを拭いた。"].map(text => lines.indexOf(text));
    assert(order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1])), `finale order: ${order}`);
    assert.equal(order.at(-1), lines.length - 1, "The last picture is the oldest trophy");
    assert.equal(order[5], order[4] + 1, "The name scene follows the daily scene without a break");
  });
});
