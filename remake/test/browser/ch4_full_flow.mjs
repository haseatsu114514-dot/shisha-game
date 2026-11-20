// 第4章の通しプレイ検証（#1176 GAP 4-T1）。
// 第3章クリア済みセーブから、aftermath完了カード→「第4章へ進む」→プロローグ→自由行動（スーク・FESTA・路地裏）→
// 前夜→大会→勝ち側の本線→完了カードまでを、1本のセーブで実UI・実saveだけで通す。
// 自由行動の途中で実セーブ→リロード→再開し、進行が壊れないことも確認する。
import assert from "node:assert/strict";
import path from "node:path";
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
    // 結果発表の10カウント（TSH10）。その場で結果が決まった時だけ出る。
    if (document.querySelector('[data-test="result-count"]')) window.__ch4Observed.count = true;
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
      _lime_tut: 1, _lime_opened: true, // 第3章クリア済みなら初回LIME案内は済んでいる（ch5_full_flow と同じ）
      _ch3_tournament_won: true, _ch3_japan_first_representative: true,
      _ch3_intro: { startDay: 29, stage: 18, titleSeen: true, routeVersion: 2 },
      _ch3_tournament: { stage: "complete", attempts: 1, voted: 4, history: [{ rank: 1, total: 88 }],
        result: { rank: 1, win: true, votes: {} } },
      _ch3_aftermath: { version: 2, winDay: 42, stage: 6 } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    for (const who of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "sui", "hajime", "sumi", "naru"])
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
  // #3938: 出発カードの表示名だけ。恋人・応援の判定や保存のIDは元のまま。
  for (const [label, known, selected, partnered = true] of [
    ["companion-picker-private-name-unknown", false, "mashiro"],
    ["companion-picker-private-name-known", true, null],
    ["companion-picker-no-lover", false, null, false],
  ]) {
    await check(label, async page => {
      await seed(page);
      if (partnered) await page.evaluate(async known => {
        const core = await import("./js/core/state.js");
        Object.assign(core.state, { lovers: ["mashiro", "minto"], loverSince: { mashiro: 35, minto: 8 } });
        Object.assign(core.state.met, { mashiro: true, minto: true });
        Object.assign(core.state.affinity, { mashiro: 400, minto: 380 });
        // 正体を知ることと、本人から私的な呼び名を聞いたことは別。
        core.state.flags._minto_identity_revealed = true;
        if (known) core.state.flags._minto_name_known = true;
        core.save();
      }, known);
      await loadSlot(page, 0);
      await page.locator(dt("ch3-aftermath-complete")).waitFor({ timeout: 60000 });
      await page.locator(dt("ch3-aftermath-chapter-four")).tap();
      await page.locator(dt("ch4-companion")).waitFor({ timeout: 60000 });
      const before = await get(page);
      const mashiro = page.locator(dt("ch4-companion-mashiro"));
      const minto = page.locator(dt("ch4-companion-minto"));
      const none = page.locator(dt("ch4-companion-none"));
      const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
      await page.screenshot({ path: path.join(artifacts, `${label}-landscape.png`) });
      if (partnered) {
        assert.equal(await mashiro.innerText(), "ましろ");
        assert.equal(await minto.innerText(), known ? "栞" : "みんと");
      } else {
        assert.equal(await mashiro.count(), 0);
        assert.equal(await minto.count(), 0);
      }
      assert.equal(await none.innerText(), "同行なし");
      assert.equal(before.flags._overseas_companion, undefined, "表示だけでは選択・保存しない");
      await (selected ? mashiro : none).tap();
      await page.waitForFunction(id => window.__remake.state.flags._overseas_companion?.companion === id, selected);
      const after = await get(page);
      assert.deepEqual(after.flags._overseas_companion,
        { decided: true, companion: selected, supports: !partnered ? ["tsumugi", "mashiro"] : selected ? ["tsumugi", "minto"] : ["tsumugi", "minto", "mashiro"], guests: [] });
      assert.deepEqual(after.lovers, before.lovers);
      assert.deepEqual(after.affinity, before.affinity);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")).flags._overseas_companion),
        after.flags._overseas_companion);
    }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  }

  await check("chapter-four-prologue-dubai-eve-tournament-and-resolution-on-one-save", async page => {
    await seed(page);
    // 1. タイトルからロード → 第3章の完了カード → 第4章へ
    await loadSlot(page, 0);
    await page.locator(dt("ch3-aftermath-complete")).waitFor({ timeout: 60000 });
    let state = await get(page);
    assert.equal(state.chapter, 3);
    assert.equal(state.flags._ch4, undefined);
    await page.locator(dt("ch3-aftermath-chapter-four")).click();

    // 1b. 出発前の同行選択（恋人がいないので「同行なし」だけ。つむぎは tonari の常連としていつも、ましろは第3章クリアで別便応援・SPC17）
    await page.locator(dt("ch4-companion")).waitFor({ timeout: 60000 });
    await page.locator(dt("ch4-companion-none")).click();
    assert.deepEqual((await get(page)).flags._overseas_companion,
      { decided: true, companion: null, supports: ["tsumugi", "mashiro"], guests: [] });

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

    // 5. DAY4 の宿で前夜へ。別便で来たつむぎ・ましろちゃん（友人版）の到着を1人ずつ → 砂浜（水着回・強制）→ 前夜祭（繋ぎ→本編）→ stranger_third を強制消化して大会日へ。
    await page.locator(dt("ch4-go-inn")).click();
    await freeDay(page, 4);
    await page.locator(dt("ch4-go-inn")).click();
    const tsumugiArrival = `${dt("ch4-arrival")}[data-scene="ch4_tsumugi_dubai_friend"]`;
    await page.locator(tsumugiArrival).waitFor();
    assert.match(await page.locator(tsumugiArrival).innerText(), /DAY 4・前夜祭の日/);
    assert.equal((await get(page)).flags._ch4.read.ch4_tsumugi_dubai_friend, undefined, "The arrival commits only after it is read");
    await page.locator(dt("ch4-continue")).click();
    const arrival = `${dt("ch4-arrival")}[data-scene="ch4_mashiro_dubai_friend"]`;
    await page.locator(arrival).waitFor();
    assert.match(await page.locator(arrival).innerText(), /DAY 4・前夜祭の日/);
    state = await get(page);
    assert.equal(state.flags._ch4.part, "eve");
    assert.equal(state.flags._ch4.read.ch4_mashiro_dubai_friend, undefined, "The arrival commits only after it is read");
    await page.locator(dt("ch4-continue")).click();
    // 到着の後は、必ず砂浜へ（水着回は強制イベント・SPC25）。つむぎ・ましろちゃん・なる（同じ宿の第二代表）の3人と遊ぶ。
    await page.locator(dt("ch4-beach")).waitFor({ timeout: 60000 });
    assert.match(await page.locator(dt("ch4-beach")).innerText(), /あと3か所、遊べる/);
    for (const [i, id] of ["tsumugi", "mashiro", "naru"].entries()) {
      await page.locator(dt("ch4-beach")).filter({ hasText: `あと${3 - i}か所` }).waitFor({ timeout: 60000 });
      await page.locator(dt(`ch4-beach-${id}`)).click();
    }
    await page.locator(`${dt("ch4-eve")}[data-scene="ch4_wang_reception"]`).waitFor();
    assert.deepEqual((await get(page)).flags._ch4_beach, { picks: ["tsumugi", "mashiro", "naru"] });
    state = await get(page);
    assert.equal(state.flags._ch4.read.ch4_tsumugi_dubai_friend, true);
    assert.equal(state.flags._ch4.read.ch4_mashiro_dubai_friend, true);
    // 友人として来たつむぎ・ましろは、前夜の「その場にいる」人にも、恋人の数にも入らない。
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
    assert.equal(await page.evaluate(() => window.__ch4Observed.count === true), true, "The world final opens with the result countdown");
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
    const resolution = ["ch4_result", "ch4_sui_old_rival", "ch4_ending", "ch4_sumi_return", "ch4_two_tables"];
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
    for (const id of ["ch4_stranger_first", "ch4_stranger_second", "ch4_tsumugi_dubai_friend", "ch4_mashiro_dubai_friend", "ch4_wang_reception",
      "ch4_stranger_third", ...prologue, ...resolution]) assert.equal(state.flags._ch4.read[id], true, `${id} must be read`);
    assert.equal(state.flags._ch4_morning_done, true, "The tournament morning (4-4) was read before the tournament");
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

  // 世界大会の持ち点（TSH05・TSH06）: モーダルは夜紫の板（紙の小窓では白い点数が読めず、票の帯が潰れていた）。
  // 票は入れる前の値から始まり、板を押すと早送り。出そろうまで「続きを作る」は押せない。
  await check("standings-modal-is-a-readable-board-and-votes-arrive", async page => {
    const expected = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
      const model = await import("./js/chapters/ch4-tournament-state.js");
      const view = await import("./js/chapters/ch4-standings.js");
      const empty = () => Object.fromEntries(model.CH4_JUDGES.map(judge => [judge, Object.fromEntries(model.CH4_CONTESTANTS.map(id => [id, 0]))]));
      const before = empty(), votes = empty(), [a, b, c] = model.CH4_JUDGES;
      Object.assign(before[a], { hajime: 1, sheikh: 1 }); Object.assign(before[b], { sheikh: 1, naru: 1 }); Object.assign(before[c], { master_hookah: 1, hajime: 1 });
      for (const judge of model.CH4_JUDGES) Object.assign(votes[judge], before[judge]);
      votes[a].hajime += 2; votes[a].naru += 1; votes[b].hajime += 2; votes[b].sheikh += 1; votes[c].sheikh += 2; votes[c].hajime += 1;
      const p = { votes, baseVotes: Object.fromEntries(model.CH4_CONTESTANTS.map(id => [id, 1])), voted: 2, quality: { hajime: 90, naru: 80, master_hookah: 78, sheikh: 88 } };
      const sum = table => Object.fromEntries(model.CH4_CONTESTANTS.map(id => [id, 1 + model.CH4_JUDGES.reduce((n, judge) => n + table[judge][id], 0)]));
      window.boardClosed = false;
      view.showChapterFourStandings(p, { before }).then(() => { window.boardClosed = true; });
      return { before: sum(before), after: sum(votes) };
    });
    const board = page.locator(dt("ch4-standings")), next = page.locator(dt("ch4-standings-continue"));
    await board.waitFor();
    const points = () => board.locator("li[data-contestant]").evaluateAll(rows => Object.fromEntries(rows.map(row => [row.dataset.contestant, parseInt(row.querySelector("strong").textContent, 10)])));
    assert.equal(await board.getAttribute("data-ceremony"), "running");
    assert.deepEqual(await points(), expected.before);
    assert.equal(await next.isDisabled(), true);
    const look = await board.evaluate(node => {
      const box = node.closest(".modal-box"), rgb = value => (value.match(/\d+/g) || []).slice(0, 3).reduce((n, v) => n + Number(v), 0);
      const strong = node.querySelector('li[data-contestant]:not([data-rank="1"]) strong');
      return { width: box.getBoundingClientRect().width / (document.getElementById("stage").getBoundingClientRect().width / 1280),
        ground: rgb(getComputedStyle(box).backgroundColor), ink: rgb(getComputedStyle(strong).color),
        bar: node.querySelector(".vote-stack").getBoundingClientRect().width, columns: getComputedStyle(node).gridTemplateColumns.split(" ").length };
    });
    assert(look.width > 900, `The board uses the stage width: ${look.width}`);
    assert(look.ground < 120 && look.ink > 600, `Light points on a dark board: ${JSON.stringify(look)}`);
    assert(look.bar > 150 && look.columns === 2, `The vote bars and the judges column have room: ${JSON.stringify(look)}`);
    await page.locator(".judge-chip.ts-casting").first().waitFor();
    await board.locator(".judge-legend").click();
    await board.and(page.locator('[data-ceremony="done"]')).waitFor({ timeout: 1000 });
    assert.deepEqual(await points(), expected.after);
    assert.equal(await page.evaluate(() => window.boardClosed), false, "Skipping the ceremony does not close the board");
    await next.and(page.locator(":enabled")).waitFor();
    await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/ch4-standings-board.png` });
    await next.click();
    await page.waitForFunction(() => window.boardClosed === true);
  });

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
    // 蒸らしの揺らぎ（steamVariation）が冷たい側だと、吸う工程の5回では焦げきらず、調整の工程で焦げる。
    // そのときは調整前の問い（吸い心地を聞くか）に、温度を見る方で答えて進める。
    const ask = dt("ch4-customer-temperature");
    const verdictOrStandings = page.locator(`${dt("ch4-verdict-continue")}, ${dt("ch4-standings-continue")}, ${ask}`);
    for (let i = 0; i < 6; i++) {
      await verdictOrStandings.first().waitFor({ timeout: 180000 });
      if (await page.locator(ask).count()) { await page.locator(ask).click(); continue; }
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
    assert.equal((await get(page)).money, before.money + 500000);
    await loadSlot(page, 0);
    await page.locator(scene("ch4_result")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).money, before.money + 500000, "LOAD must not pay the prize twice");
  }, { reducedMotion: "reduce" });
});

// ドバイ14日ルートの必須の仕事も、同じCI入口から確認する。
await import("./ch4_staff_work.mjs");
