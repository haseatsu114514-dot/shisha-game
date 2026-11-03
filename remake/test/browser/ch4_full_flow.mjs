// 第4章の通しプレイ検証（#1176 GAP 4-T1）。
// 第3章クリア済みセーブから、aftermath完了カード→「第4章へ進む」→プロローグ→自由行動（スーク・FESTA・路地裏）→
// 前夜→大会→勝ち側の本線→完了カードまでを、1本のセーブで実UI・実saveだけで通す。
// 自由行動の途中で実セーブ→リロード→再開し、進行が壊れないことも確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
// #2031: 票が動いた後の途中順位（制作後・提供後・調整1回目の後）と、調整前の問いを順に送る。
async function craftThroughStandings(page) {
  for (const target of ["ch4-standings-continue", "ch4-standings-continue", "ch4-customer-ask", "ch4-standings-continue", "ch4-customer-ask"]) {
    await page.locator(`[data-test="${target}"]`).click({ timeout: 180000 });
  }
}
const scene = id => `[data-test="ch4-scene"][data-scene="${id}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
const committed = (page, id) => page.waitForFunction(sceneId => window.__remake.state.flags._ch4.read[sceneId] === true, id);
// 日が進んだ直後は古い自由行動カードが残りうる。見出しの DAY で新しいカードの描画を待つ。
const freeDay = (page, day) => page.locator(dt("ch4-free")).getByRole("heading", { name: new RegExp(`^DAY ${day}・`) }).waitFor();
const observeTournament = page => page.evaluate(() => {
  window.__ch4Observed = { text: new Set(), comments: new Set() };
  window.__ch4Observer = new MutationObserver(() => {
    const text = [...document.querySelectorAll(".vn-text, .audience-note")].map(node => node.dataset.raw || node.textContent).join("\n");
    for (const phrase of ["出発前の方針：桜", "出発前の方針：茶", "出発前に選んだ桜の方針", "出発前に選んだ茶の方針", "桜の香りが、まっすぐ立つ", "葉が焦げた",
      // #2031: 制作中の掛け合い（開幕・提供後・調整1の後）
      "誰のための一台か", "客の呼吸は、まだ続いている", "直した跡が、煙に出ている"])
      if (text.includes(phrase)) window.__ch4Observed.text.add(phrase);
    document.querySelectorAll(".nico").forEach(node => window.__ch4Observed.comments.add(node.textContent));
  });
  window.__ch4Observer.observe(document.body, { subtree: true, childList: true, characterData: true });
});

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
    // 辻占のオババ（章で1〜2回・現れる時間帯は保存の種しだい）が地図の演出を挟まないよう、第4章（出発前の準備）の出現は済んだことにする。
    const fortune = await import("./js/daily/fortune-schedule.js");
    const fortunePlan = fortune.fortunePlan({ seed: value.seed, chapter: 4 });
    value.flags._fortune_wander = { chapter: 4, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
  });
}

// 出発前の準備期間（日常ループ）の地図が開いて、指定の日・時間帯で行き先を選べる状態か。
const prepMap = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector(".map:not(.done) [data-test=pin-rest]") && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
async function goMap(page, pin) {
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
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

    // 2. 出発前の準備3日（VOL02）: 1日目の昼にスミさんとの特訓、夜に持っていく配合 → 2・3日目は自由 → 出発の朝にドバイ。
    await prepMap(page, { day: 46, slot: 1 });
    // このスイートは旧行程（ドバイ5日・場面カード）を確かめる。ドバイの日常（版2）は ch4_dubai_daily。
    await page.evaluate(() => { delete window.__remake.state.flags._ch4.routeVersion; });
    state = await get(page);
    assert.equal(state.chapter, 4);
    assert.equal(state.flags._ch4.day, 1);
    assert.equal(state.flags._ch4.titleSeen, true);
    assert.equal(state.flags._ch4_sheikh_revealed, false);
    assert.equal(state.flags._ch3_cleared, true, "The Chapter 3 clear record must stay");
    assert.equal(state.flags._ch4.read.ch4_sumi_training, true, "The training uses the first prep day's noon");
    assert.deepEqual([state.flags._ch4_prep.step, state.flags._ch4_prep.departed, state.phase], [0, false, "daily"]);
    assert.match(await page.locator(".hud").innerText(), /出発まで/);
    await goMap(page, "rest");
    await prepMap(page, { day: 47, slot: 0 });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_strategy, true, "The blend is decided on the first prep night");
    assert.equal(state.flags._ch4_strategy, "sakura", "The chosen strategy must be saved from ch4_strategy");
    for (const [day, slot] of [[47, 1], [48, 0], [48, 1]]) {
      await goMap(page, "rest");
      await prepMap(page, { day, slot });
    }
    await goMap(page, "rest");

    // 3. ドバイ到着と宿（プロローグの残り2場面）。ドバイDAY1は出発の朝。
    const prologue = ["ch4_opening", "ch4_arrival_inn"];
    await page.locator(scene(prologue[0])).waitFor({ timeout: 60000 });
    state = await get(page);
    assert.equal(state.flags._ch4_prep.departed, true);
    const startDay = state.flags._ch4.startDay;
    assert.equal(startDay, 49);
    assert.equal(state.day, 49);
    for (const [index, id] of prologue.entries()) {
      await page.locator(scene(id)).waitFor();
      assert.equal((await get(page)).flags._ch4.stage, index + 2);
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-free")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.part, "free");
    assert.equal(state.flags._ch4.day, 1);
    assert.equal(state.day, startDay, "The prologue must not advance the calendar");
    assert.equal(state.flags._ch4_strategy, "sakura", "The chosen strategy must be saved from ch4_strategy");
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
    assert.equal(resumed.flags._ch4.stage, 4, "Reload must not replay the prologue (two prep scenes + arrival + inn)");
    assert.equal(resumed.flags._ch4_strategy, "sakura", "The chosen strategy survives SAVE/LOAD");

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

    // 5. DAY4 の宿で前夜へ。別便で来たましろちゃん（友人版）の到着 → 前夜祭（繋ぎ→本編）→ stranger_third を強制消化して大会日へ。
    await page.locator(dt("ch4-go-inn")).click();
    await freeDay(page, 4);
    await page.locator(dt("ch4-go-inn")).click();
    const arrival = `${dt("ch4-arrival")}[data-scene="ch4_mashiro_dubai_friend"]`;
    await page.locator(arrival).waitFor();
    assert.match(await page.locator(arrival).innerText(), /DAY 4・前夜祭の日/);
    state = await get(page);
    assert.equal(state.flags._ch4.part, "eve");
    assert.equal(state.flags._ch4.read.ch4_mashiro_dubai_friend, undefined, "The arrival commits only after it is read");
    await page.locator(dt("ch4-continue")).click();
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_mashiro_dubai_friend, true);
    // 友人として来たましろは視察の別行動。前夜の「その場にいる」人にも、恋人の数にも入らない。
    assert.deepEqual(await page.evaluate(async () => {
      const routes = await (await import("./js/core/chapter-data.js")).loadStoryRoutes();
      return (await import("./js/chapters/ch4-story-wiring.js")).chapterFourEveningContext(routes, window.__remake.state).present;
    }), []);
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
    await observeTournament(page);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-start")).click();
    await craftThroughStandings(page);
    await page.locator(dt("ch4-verdict-continue")).waitFor({ timeout: 180000 });
    state = await get(page);
    assert.equal(state.flags._ch4.match.step, 11);
    assert.equal(state.flags._ch4.match.result.win, true);
    assert.equal(state.flags._ch4.match.craft.careHistory.length, 2);
    assert.equal(state.flags._ch4.match.craft.mix.sakura, 12, "The saved plan supplies the Sakura leaf");
    assert.deepEqual(state.flags._ch4.match.craft.customerChecks, [true, true]);
    assert.equal(state.flags._ch4.read.ch4_final, undefined, "No victory scene before the verdict is acknowledged");
    for (const row of Object.values(state.flags._ch4.match.result.votes))
      assert.equal(Object.values(row).reduce((a, b) => a + b, 0), 10);
    // #2031: 最終結果は文字だけでなく持ち点の盤（4人の順位）で出る。
    assert.equal(await page.locator(`${dt("ch4-result")} li[data-contestant]`).count(), 4);
    assert.equal(await page.locator(`${dt("ch4-result")} li[data-contestant="hajime"]`).getAttribute("data-rank"), "1");
    await page.locator(dt("ch4-verdict-continue")).click();
    await page.locator(scene("ch4_result")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4_sheikh_revealed, true);
    assert.equal(state.met.sheikh, true);
    assert.equal(state.flags._ch4.read.ch4_tournament_start, true);
    assert.equal(state.flags._ch4.read.ch4_final, true);
    const observed = await page.evaluate(async () => ({ text: [...window.__ch4Observed.text], comments: [...window.__ch4Observed.comments],
      chapter4: structuredClone((await import("./js/core/data.js")).DB.broadcast.chapter4) }));
    assert(observed.text.includes("出発前の方針：桜"), "ch4_craft_advice_1 must reflect the strategy");
    assert(observed.text.includes("出発前に選んだ桜の方針"), "The live broadcast must reflect the strategy");
    assert(observed.text.includes("桜の香りが、まっすぐ立つ"), "ch4_final must state the actual blend's taste");
    // #2031: 第1〜3章と同じく、制作の合間に審査員とライバルの掛け合いが入る。
    for (const phrase of ["誰のための一台か", "客の呼吸は、まだ続いている", "直した跡が、煙に出ている"])
      assert(observed.text.includes(phrase), `The world tournament craft must play its banter: ${phrase}`);
    const localComments = Object.values(observed.chapter4.completion).flatMap(step => Object.values(step).flat());
    assert(observed.comments.some(comment => localComments.includes(comment)), "The broadcast must use chapter4 audience comments");
    await page.evaluate(() => window.__ch4Observer.disconnect());
    assert.equal(state.flags._ch4.part, "resolution");
    assert.equal(state.flags._ch4_cleared, undefined);
    const resolution = ["ch4_result", "ch4_nagumo_old_rival", "ch4_ending", "ch4_sumi_return", "ch4_two_tables"];
    for (const id of resolution) {
      await page.locator(scene(id)).waitFor();
      await page.locator(dt("ch4-continue")).click();
    }
    await page.locator(dt("ch4-complete")).waitFor();
    assert.match(await page.locator(dt("ch4-complete")).innerText(), /出発前に選んだ桜は12g、配合の100%/,
      "chapterFourRecap must show the chosen plan and actual blend");

    // 章開始時と現在の実能力を、第1章と同じ二面のレーダーで比較する。
    assert.equal(await page.locator(`${dt("ch4-growth")} .radar-base`).count(), 1);
    assert.equal(await page.locator(`${dt("ch4-growth")} .radar-now`).count(), 1);
    // 旧しくみ（?growth=0）は行動で5能力が伸びるので面が広がる。心得の盤（通常プレイの既定・SBD97）は盤の三角で、
    // この通しでは盤に灯していないので面は章のはじめと同じ（灯した時の広がりは growth_levelup.mjs が確かめる）
    if (await page.evaluate(async () => (await import("./js/core/growth-mode.js")).growthEnabled())) {
      assert.equal(await page.locator(`${dt("ch4-growth")} [data-test="board-radar"]`).count(), 1, "The chapter end shows the board triangle");
    } else assert.notEqual(await page.locator(`${dt("ch4-growth")} .radar-base`).getAttribute("points"),
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
    for (const id of ["ch4_stranger_first", "ch4_stranger_second", "ch4_mashiro_dubai_friend", "ch4_wang_reception",
      "ch4_stranger_third", ...prologue, ...resolution]) assert.equal(state.flags._ch4.read[id], true, `${id} must be read`);
    assert.deepEqual(state.flags._ch4_evening, { kind: "rest", participants: [] }, "No lover is present on the eve");
    // 完了後に保存データを読み直しても、完了カードに戻り場面は再演されない。
    assert.equal(await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      if (!core.loadFromSlot(core.SAVE_KEY)) return false;
      await (await import("./js/chapters/ch4.js")).resumeChapterFour();
      return true;
    }), true);
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
    await observeTournament(page);
    await page.locator(dt("ch4-start")).click();
    // 焦げる工程より前に票が動いた場合だけ、途中順位を送る（#2031）。
    const verdictOrStandings = page.locator(`${dt("ch4-verdict-continue")}, ${dt("ch4-standings-continue")}`);
    for (let i = 0; i < 4; i++) {
      await verdictOrStandings.first().waitFor({ timeout: 180000 });
      if (!await page.locator(dt("ch4-standings-continue")).count()) break;
      await page.locator(dt("ch4-standings-continue")).click();
    }
    await page.locator(dt("ch4-verdict-continue")).waitFor({ timeout: 180000 });
    let value = await get(page);
    assert.equal(value.flags._ch4.match.result.win, false);
    assert(value.flags._ch4.match.result.failure);
    assert.equal(value.flags._ch4.read.ch4_final, undefined);
    assert((await page.evaluate(() => [...window.__ch4Observed.text])).includes("出発前に選んだ茶の方針"),
      "The retry route must keep the Tea broadcast plan");
    assert.equal(value.money, before.money);
    await page.locator(dt("ch4-verdict-continue")).click();
    // 敗北の場面の後は第1〜3章と同じCONTINUE画面（2026-11-02 オーナー決定）。選ぶまで結果は残る。
    await page.locator(dt("ch4-defeat")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.flags._ch4.attempts, 0);
    assert.equal(value.flags._ch4.read.ch4_defeat, true);
    assert.equal(value.flags._ch4.match.result.win, false);
    // 再挑戦を選ぶ前の保存から再開しても、同じCONTINUE画面に戻る（敗北の場面は読み直さない）。
    await page.evaluate(async () => { await (await import("./js/chapters/ch4.js")).resumeChapterFour(); });
    await page.locator(dt("ch4-defeat")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch4.attempts, 0);
    await page.locator(dt("ch4-continue-retry")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4.attempts === 1);
    await page.locator(dt("ch4-tournament")).waitFor();
    value = await get(page);
    assert.equal(value.flags._ch4.match.result, null);
    assert.equal(value.flags._ch4.match.history.length, 1);
    assert((await page.evaluate(() => [...window.__ch4Observed.text])).includes("葉が焦げた"),
      "ch4_defeat must describe the failed craft before retry");
    assert.deepEqual(value.flavorStock, before.flavorStock);
    assert.equal(value.stamina, before.stamina);
    assert.equal(value.money, before.money);
    await page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
    await page.locator(dt("ch4-start")).click();
    await craftThroughStandings(page);
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
