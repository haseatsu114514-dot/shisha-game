// 第4章の通しプレイ検証（#1176 GAP 4-T1）。
// 第3章クリア済みセーブから、aftermath完了カード→「第4章へ進む」→プロローグ→自由行動（スーク・FESTA・路地裏）→
// 前夜→大会→勝ち側の本線→完了カードまでを、1本のセーブで実UI・実saveだけで通す。
// 自由行動の途中で実セーブ→リロード→再開し、進行が壊れないことも確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const scene = id => `[data-test="ch4-scene"][data-scene="${id}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const committed = (page, id) => page.waitForFunction(sceneId => window.__remake.state.flags._ch4.read[sceneId] === true, id);
// 日が進んだ直後は古い自由行動カードが残りうる。見出しの DAY で新しいカードの描画を待つ。
const freeDay = (page, day) => page.locator(dt("ch4-free")).getByRole("heading", { name: new RegExp(`^DAY ${day}・`) }).waitFor();

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    // 第3章の後日談まで終えた保存（ch3-aftermath の完了状態）を直接組む。
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    // 予告2の自動再生は chapter_preview.mjs が専任で検証する。ここでは既読にして第4章本体に集中する。
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
      _ch3_preview_seen: true, _friend_ageha: true, // あげはの告白（#1930）は友達のままで着地済み
      _ch3_tournament_won: true, _ch3_japan_first_representative: true,
      _ch3_intro: { startDay: 29, stage: 18, titleSeen: true, routeVersion: 2 },
      _ch3_tournament: { stage: "complete", attempts: 1, voted: 4, history: [{ rank: 1, total: 88 }],
        result: { rank: 1, win: true, votes: {} } },
      _ch3_aftermath: { version: 2, winDay: 42, stage: 6 } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    for (const who of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "nagumo", "hajime", "sumi", "naru"])
      value.flags[`_intro_${who}`] = true;
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

await suite("ch4-full-flow", async check => {
  await check("chapter-four-prologue-dubai-eve-tournament-and-resolution-on-one-save", async page => {
    await seed(page);
    // 1. タイトルからロード → 第3章の完了カード → 第4章へ
    await loadSlot(page, 0);
    await page.locator(dt("ch3-aftermath-complete")).waitFor({ timeout: 60000 });
    let state = await get(page);
    assert.equal(state.chapter, 3);
    assert.equal(state.flags._ch4, undefined);
    await page.locator(dt("ch3-aftermath-chapter-four")).click();

    // 1b. 出発前の同行選択（恋人がいないので「同行なし」だけ。ましろは第3章クリアで別便応援）
    await page.locator(dt("ch4-companion")).waitFor({ timeout: 60000 });
    await page.locator(dt("ch4-companion-none")).click();
    assert.deepEqual((await get(page)).flags._overseas_companion,
      { decided: true, companion: null, supports: ["mashiro"] });

    // 2. プロローグ4場面（章タイトル→出発前2場面→到着→宿）
    const prologue = ["ch4_sumi_training", "ch4_strategy", "ch4_opening", "ch4_arrival_inn"];
    await page.locator(scene(prologue[0])).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.chapter, 4);
    assert.equal(state.day, 46);
    assert.equal(state.flags._ch4.day, 1);
    assert.equal(state.flags._ch4.titleSeen, true);
    assert.equal(state.flags._ch4_sheikh_revealed, false);
    assert.equal(state.flags._ch3_cleared, true, "The Chapter 3 clear record must stay");
    const startDay = state.flags._ch4.startDay;
    assert.equal(startDay, 46);
    for (const [index, id] of prologue.entries()) {
      await page.locator(scene(id)).waitFor();
      assert.equal((await get(page)).flags._ch4.stage, index);
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-free")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.part, "free");
    assert.equal(state.flags._ch4.day, 1);
    assert.equal(state.day, startDay, "The prologue must not advance the calendar");
    assert(["sakura", "peach", "tea"].includes(state.flags._ch4_strategy), "The strategy choice must be saved");
    assert.equal(await page.locator(dt("ch4-go-alley_cafe")).count(), 0, "The alley hides before the second unlocks");

    // 3. 自由行動: スーク（初回は stranger_first まで続く）→ FESTA。訪問では日が進まない。
    await page.locator(dt("ch4-go-souq")).click();
    await committed(page, "ch4_stranger_first");
    await page.locator(dt("ch4-free")).waitFor();
    await page.locator(dt("ch4-go-festa")).click();
    await committed(page, "ch4_festa");
    await page.locator(dt("ch4-free")).waitFor();
    state = await get(page);
    assert(state.flags._ch4.read.ch4_dubai_souq);
    assert.equal(state.flags._ch4.firstDay, 1);
    assert.equal(state.flags._ch4.day, 1, "Visiting places must not advance the day");
    assert.equal(state.day, startDay);
    assert.equal(state.met.da_silva, true);
    assert.equal(state.met.sheikh, undefined, "変装中はシェイクの正体を明かさない");

    // リロード跨ぎ: 自由行動の途中に実セーブ→ロード。読了済みの場面は再演されず、日付も保たれる。
    await page.locator(dt("ch4-menu")).click();
    await page.locator(dt("ch4-save")).click();
    await page.locator(dt("slot-1")).click();
    await loadSlot(page, 1);
    await page.locator(dt("ch4-free")).waitFor({ timeout: 60000 });
    const resumed = await get(page);
    assert.equal(resumed.flags._ch4.part, "free");
    assert.equal(resumed.flags._ch4.day, 1);
    assert.equal(resumed.flags._ch4.firstDay, 1);
    assert.equal(resumed.flags._ch4.read.ch4_stranger_first, true);
    assert.equal(resumed.day, startDay);
    assert.equal(resumed.flags._ch4.stage, prologue.length, "Reload must not replay the prologue");

    // 4. 宿で日を進める。DAY2の宿は道具の手入れを先に読む。stranger_second は first の2日後（DAY3）に解放。
    await page.locator(dt("ch4-go-inn")).click();
    await freeDay(page, 2);
    assert.equal(await page.locator(dt("ch4-go-alley_cafe")).count(), 0, "DAY 2 is too early for the second meeting");
    assert.equal((await get(page)).day, startDay + 1);
    await page.locator(dt("ch4-go-inn")).click();
    await freeDay(page, 3);
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_inn_tool_care, true);
    assert.equal(state.day, startDay + 2);
    await page.locator(dt("ch4-go-alley_cafe")).click();
    await committed(page, "ch4_stranger_second");
    await freeDay(page, 3);
    assert.equal((await get(page)).flags._ch4.day, 3);
    await page.getByText("路地裏のカフェに再訪できるようになった", { exact: true }).waitFor();
    assert.match(await page.locator(dt("ch4-free")).innerText(), /再訪できるようになった。/);
    const beforeRevisit = await get(page);
    await page.locator(dt("ch4-go-alley_cafe")).click();
    await committed(page, "ch4_alley_cafe_quiet");
    await freeDay(page, 3);
    assert.deepEqual((await get(page)).stats, beforeRevisit.stats, "Revisit must not add stat growth");
    assert.equal((await get(page)).money, beforeRevisit.money);

    // 5. DAY4 の宿で前夜へ。前夜祭（繋ぎ→本編）→ stranger_third を強制消化して大会日へ。
    await page.locator(dt("ch4-go-inn")).click();
    await freeDay(page, 4);
    await page.locator(dt("ch4-go-inn")).click();
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.part, "eve");
    assert.equal(state.flags._ch4.day, 4);
    assert.equal(state.flags._ch4.read.ch4_wang_reception, undefined, "The reception is forced, not yet read");
    assert.equal(state.flags._ch4_sheikh_revealed, false);
    await page.locator(dt("ch4-continue")).click();
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_stranger_third"]`).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_wang_reception_forced_in, true);
    assert.equal(state.flags._ch4.read.ch4_wang_reception, true);
    assert.equal(state.met.master_hookah, true);
    assert.equal(state.met.sheikh, undefined);
    await page.locator(dt("ch4-continue")).click();
    await page.locator(dt("ch4-tournament")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.part, "tournament");
    assert.equal(state.flags._ch4.day, 5);
    assert.equal(state.day, startDay + 4);
    assert.equal(state.flags._ch4_sheikh_revealed, false, "The sheikh stays hidden until the tournament starts");

    // 6. 大会: 正体公開 → 共通の実制作・提供・二度調整 → 実審査 → final → 後日談
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-start")).click();
    for (const round of [1, 2]) {
      await page.locator(dt("ch4-customer-ask")).click({ timeout: 180000 });
    }
    await page.locator(dt("ch4-verdict-continue")).waitFor({ timeout: 180000 });
    state = await get(page);
    assert.equal(state.flags._ch4.match.step, 11);
    assert.equal(state.flags._ch4.match.result.win, true);
    assert.equal(state.flags._ch4.match.craft.careHistory.length, 2);
    assert.deepEqual(state.flags._ch4.match.craft.customerChecks, [true, true]);
    assert.equal(state.flags._ch4.read.ch4_final, undefined, "No victory scene before the verdict is acknowledged");
    for (const row of Object.values(state.flags._ch4.match.result.votes))
      assert.equal(Object.values(row).reduce((a, b) => a + b, 0), 10);
    await page.locator(dt("ch4-verdict-continue")).click();
    await page.locator(scene("ch4_result")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4_sheikh_revealed, true);
    assert.equal(state.met.sheikh, true);
    assert.equal(state.flags._ch4.read.ch4_tournament_start, true);
    assert.equal(state.flags._ch4.read.ch4_final, true);
    assert.equal(state.flags._ch4.part, "resolution");
    assert.equal(state.flags._ch4_cleared, undefined);
    const resolution = ["ch4_result", "ch4_nagumo_old_rival", "ch4_ending", "ch4_sumi_return", "ch4_two_tables"];
    for (const id of resolution) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-complete")).waitFor();

    // 章開始時と現在の実能力を、第1章と同じ二面のレーダーで比較する。
    assert.equal(await page.locator(`${dt("ch4-growth")} .radar-base`).count(), 1);
    assert.equal(await page.locator(`${dt("ch4-growth")} .radar-now`).count(), 1);
    assert.notEqual(await page.locator(`${dt("ch4-growth")} .radar-base`).getAttribute("points"),
      await page.locator(`${dt("ch4-growth")} .radar-now`).getAttribute("points"));
    assert.match(await page.locator(dt("ch4-growth")).innerText(), /章のはじめ/);

    // 7. 最終state
    state = await get(page);
    assert.equal(state.chapter, 4);
    assert.equal(state.flags._ch4_cleared, true);
    assert.equal(state.phase, "cleared");
    assert.equal(state.flags._ch3_cleared, true);
    assert(["sakura", "peach", "tea"].includes(state.flags._ch4_strategy));
    assert.equal(state.flags._ch4_sheikh_revealed, true);
    assert.equal(state.day, startDay + 4);
    for (const id of ["ch4_stranger_first", "ch4_stranger_second", "ch4_wang_reception", "ch4_stranger_third",
      ...prologue, ...resolution]) assert.equal(state.flags._ch4.read[id], true, `${id} must be read`);
    // 完了後に再開しても、完了カードに戻り場面は再演されない。
    await loadSlot(page, 0);
    await page.locator(dt("ch4-complete")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch4.resolution, resolution.length);
  }, { reducedMotion: "reduce" });

  await check("real-craft-burnt-defeat-restores-resources-and-retry-wins", async page => {
    await seed(page);
    await arm(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.state;
      value.chapter = 4; value.phase = "tournament";
      value.flags._ch4_strategy = "tea";
      value.flags._overseas_companion = { decided: true, companion: null, supports: ["mashiro"] };
      value.flags._ch4 = { startDay: 41, day: 5, stage: 4, part: "tournament", titleSeen: true,
        read: { ch4_stranger_second: true, ch4_stranger_third: true }, firstDay: null, resolution: 0, attempts: 0 };
      (await import("./js/craft/session.js")).craftTest.auto = "burn";
      await (await import("./js/chapters/ch4.js")).resumeChapterFour();
    });
    const before = await get(page);
    await page.locator(dt("ch4-start")).click();
    await page.locator(dt("ch4-verdict-continue")).waitFor({ timeout: 180000 });
    let value = await get(page);
    assert.equal(value.flags._ch4.match.result.win, false);
    assert(value.flags._ch4.match.result.failure);
    assert.equal(value.flags._ch4.read.ch4_final, undefined);
    assert.equal(value.money, before.money);
    await page.locator(dt("ch4-verdict-continue")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4.attempts === 1);
    await page.locator(dt("ch4-tournament")).waitFor();
    value = await get(page);
    assert.equal(value.flags._ch4.match.result, null);
    assert.equal(value.flags._ch4.match.history.length, 1);
    assert.deepEqual(value.flavorStock, before.flavorStock);
    assert.equal(value.stamina, before.stamina);
    assert.equal(value.money, before.money);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-start")).click();
    for (const round of [1, 2]) await page.locator(dt("ch4-customer-ask")).click({ timeout: 180000 });
    await page.locator(dt("ch4-verdict-continue")).waitFor({ timeout: 180000 });
    value = await get(page);
    assert.equal(value.flags._ch4.match.result.win, true);
    assert.equal(value.flags._ch4.match.history.length, 2);
    assert.equal(value.flags._ch4.match.craft.mix.black_tea, 12);
    await page.locator(dt("ch4-verdict-continue")).click();
    await page.locator(scene("ch4_result")).waitFor();
    assert.equal((await get(page)).money, before.money + 200000);
    await loadSlot(page, 0);
    await page.locator(scene("ch4_result")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).money, before.money + 200000, "LOAD must not pay the prize twice");
  }, { reducedMotion: "reduce" });
});
