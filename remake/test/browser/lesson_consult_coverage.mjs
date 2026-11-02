// 心得の盤の授業を「会える所で相談できる」（SPEC 2.6・SBD61）の、第3章の大会後・第5章の東京と通い店を実DOMで確かめる。
// 第3章の大会後は場面カードの「寄り道」から無料で相談し、日時・stageを進めない。スティーブの授業はその夜のピザの夜につながる。
// 第5章は鉄の煙（ヴォルク）と通い店（なる・あげは）で、来店のあとに相談する。スティーブは第5章では相談しない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;

/** 全国優勝の翌日以降の第3章の後日談。stage まで読み進めた保存を作り、後日談の画面を開く。 */
async function openAftermath(page, { stage, lit, extra = "" }) {
  await page.evaluate(async ({ stage, lit, extra }) => {
    const core = await import("./js/core/state.js"), p = await import("./js/chapters/ch3-aftermath-progress.js");
    const growth = await import("./js/core/growth.js"), vn = await import("./js/vn/engine.js");
    const s = core.newGame();
    Object.assign(s, { chapter: 3, phase: "tournament", day: 42, slot: 0, money: 20000, stamina: 80 });
    Object.assign(s.flags, { _ch3_tournament_won: true, _ch3_preview_seen: true,
      _ch3_intro: { startDay: 29, stage: 18, titleSeen: true },
      _ch3_tournament: { stage: "complete", result: { rank: 1, win: true } } });
    Object.assign(s.met, { steve: true, volk: true, kuze: true, mashiro: true, mukai_master: true, emil: true });
    Object.assign(s.affinity, { steve: 66, volk: 66, kuze: 66, mashiro: 66 });
    p.beginChapterThreeAftermath(s);
    for (const scene of p.CH3_AFTERMATH_SCENES.slice(0, stage)) if (!p.completeChapterThreeAftermathScene(s, scene.id)) throw new Error(scene.id);
    if (extra === "all-detours-read") for (const scene of p.CH3_AFTERMATH_DETOURS) s.flags[`_ch3_read_${scene.id}`] = true;
    // 久世の締めくくりの前提（LIME交換の寄り道・答えを返しに行く外出）を大会前に済ませた保存（IR22）
    if (extra === "kuze-finale") Object.assign(s.flags, { _lime_contact_kuze: true, _ch3_read_ch3_kuze_lime: true, _ch3_outings: { enmaku_answer: 1 } });
    if (extra === "volk-low") s.affinity.volk = 0;
    growth.setGrowthPreview(true);
    Object.assign(growth.ensureGrowth(), { nodes: [...lit], learned: [] });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    core.save();
    window.aftermathBefore = { day: s.day, slot: s.slot, stage: s.flags._ch3_aftermath.stage, money: s.money, stamina: s.stamina };
    void (await import("./js/chapters/ch3-aftermath.js")).runChapterThreeAftermath();
  }, { stage, lit, extra });
  await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
}

const unchanged = (page) => page.evaluate(() => {
  const s = window.__remake.state;
  return { day: s.day, slot: s.slot, stage: s.flags._ch3_aftermath.stage, money: s.money, stamina: s.stamina };
});

/** 第5章の自由行動（地元）の保存を作り、HUD つきの日常の画面に置く。 */
async function chapterFive(page, { region = "home", met = {}, affinity = {}, lit }) {
  await page.evaluate(async ({ region, met, affinity, lit }) => {
    const core = await import("./js/core/state.js"), growth = await import("./js/core/growth.js"), vn = await import("./js/vn/engine.js");
    const s = core.newGame();
    Object.assign(s, { chapter: 5, phase: "daily", day: 52, slot: 0, money: 60000, stamina: 100 });
    Object.assign(s.flags, { _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true, _ch4_sheikh_revealed: true,
      _ch2_region: region, _ch5_tokyo_attic: region === "tokyo" });
    Object.assign(s.met, met);
    Object.assign(s.affinity, affinity);
    growth.setGrowthPreview(true);
    Object.assign(growth.ensureGrowth(), { nodes: [...lit], learned: [] });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    vn.clearLog();
    const ui = await import("./js/core/ui.js");
    ui.showScreen("map", document.createElement("div"));
    core.save();
  }, { region, met, affinity, lit });
}

await suite("lesson-consult-coverage", async (check) => {
  // (a) 大会の翌日、Smoke & Glory でスティーブに相談 → 日時もstageも進まず習得 → なるへの報告のあと、その夜にピザの夜を開ける
  await check("ch3-aftermath-steve-lesson-opens-the-party-night", async (page) => {
    await openAftermath(page, { stage: 1, lit: ["M-S5"] });
    const before = await unchanged(page);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.match(await page.locator(t("ch3-aftermath-lesson-steve")).innerText(), /Smoke & Glory.*ピザとシーシャの夜/);
    assert.equal(await page.locator(t("ch3-aftermath-lesson-mashiro")).count(), 0, "mashiro waits for the after-hours counter (that night)");
    await page.locator(t("ch3-aftermath-lesson-steve")).click();
    await page.waitForFunction(() => window.__remake.state.growth.learned.includes("M-S5"), null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    assert.deepEqual(await unchanged(page), before, "a lesson does not spend time, money or stamina, nor advance the aftermath");
    // 習得は保存済み。灯した授業が残っていないので、寄り道（大会後の三つ）だけが残る
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")).growth.learned.includes("M-S5")), true);
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map((row) => row.text).join("\n"));
    assert.match(backlog, /ちょうど今夜が、東京にいる最後の夜だ/, "after the tournament, Steve's night is tonight");
    assert.doesNotMatch(backlog, /大会が終わって、東京にいる最後の夜にしよう/);
    // いつもの席 → なるへの報告 → その夜がピザとシーシャの夜
    await page.locator(t("ch3-aftermath-continue")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_aftermath.stage === 2, null, { timeout: 30000 });
    await page.locator(`${t("ch3-aftermath-scene")}[data-scene="ch3_naru_reconcile"]`).waitFor({ timeout: 30000 });
    await page.locator(t("ch3-aftermath-continue")).click();
    await page.locator(t("ch3-aftermath-party-night")).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch3_naru_party_ready), true);
  }, { viewport: { width: 1331, height: 760 } });

  // 寄り道を全部読んだ後でも、授業だけで入口が開く。帰郷の日の朝はヴォルクだけ（久世は店を畳んでいる）
  await check("ch3-aftermath-cleanup-morning-lists-only-volk", async (page) => {
    await openAftermath(page, { stage: 3, lit: ["M-W5", "M-B3", "M-B5"], extra: "all-detours-read" });
    const before = await unchanged(page);
    assert.match(await page.locator(t("ch3-aftermath-detour-open")).innerText(), /（1）/);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-lesson-kuze")).count(), 0, "Kuze is packing up Enmaku on this morning");
    assert.equal(await page.locator(t("ch3-aftermath-lesson-mashiro")).count(), 0);
    assert.equal(await page.locator('[data-test^="ch3-aftermath-detour-ch3_"]').count(), 0, "every detour was read");
    await page.locator(t("ch3-aftermath-lesson-volk")).click();
    await page.waitForFunction(() => window.__remake.state.growth.learned.includes("M-W5"), null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    assert.deepEqual(await unchanged(page), before);
    assert.equal(await page.locator(t("ch3-aftermath-detour-open")).count(), 0, "nothing left to consult or read");
    assert.deepEqual(await page.evaluate(() => window.__remake.state.growth.learned), ["M-W5"]);
  }, { viewport: { width: 1331, height: 760 } });

  // 相談の途中でページを離れた（LOAD・タイトルへ）時は、習得しない
  await check("ch3-aftermath-lesson-aborted-midway-is-not-learned", async (page) => {
    await openAftermath(page, { stage: 2, lit: ["M-B5"] });
    await page.evaluate(async () => { window.vnEngine = await import("./js/vn/engine.js"); window.vnEngine.vnTest.turbo = false; });
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-lesson-mashiro")).click();
    await page.locator(".vn-box").waitFor({ state: "visible", timeout: 30000 });
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForFunction(() => !window.vnEngine.isPlaying(), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__remake.state.growth.learned.includes("M-B5")), false);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")).growth.learned.includes("M-B5")), false);
  }, { viewport: { width: 1331, height: 760 } });

  // (b) 第5章の東京: 鉄の煙でヴォルクに相談して習う。スティーブの店では相談しない（ピザの夜は第3章の大会の翌夜だけ）
  await check("ch5-tokyo-volk-teaches-and-steve-does-not", async (page) => {
    await chapterFive(page, { region: "tokyo", met: { steve: true, volk: true, mukai_master: true }, affinity: { steve: 66, volk: 66 }, lit: ["M-W5", "M-S5"] });
    const result = await page.evaluate(async () => {
      const tokyo = await import("./js/chapters/ch5-tokyo.js"), s = window.__remake.state;
      const spot = (id) => tokyo.TOKYO_SPOTS.find((entry) => entry.id === id);
      const steve = await tokyo.performTokyoSpot(spot("ch5_tokyo_steve"));
      const afterSteve = [...s.growth.learned];
      const volk = await tokyo.performTokyoSpot(spot("ch5_tokyo_volk"));
      return { steve, volk, afterSteve, learned: [...s.growth.learned],
        saved: JSON.parse(localStorage.getItem("suien_remake_save")).growth.learned };
    });
    assert.deepEqual(result.steve, { used: true, exerted: true });
    assert.deepEqual(result.afterSteve, [], "Steve's lesson is not consulted in chapter 5");
    assert.deepEqual(result.volk, { used: true, exerted: true });
    assert.deepEqual(result.learned, ["M-W5"], "Volk teaches after the visit to Iron Smoke");
    assert.deepEqual(result.saved, ["M-W5"]);
  });

  // (c) 第5章の通い店: KEMURIKUSA でなるに、MELTY PUFF であげはさんに相談する。大会後なので、はじめはため口
  await check("ch5-regular-shops-teach-naru-and-ageha-in-casual-speech", async (page) => {
    await chapterFive(page, { met: { naru: true, ageha: true, minto: true }, affinity: { naru: 66, ageha: 66, minto: 66 }, lit: ["M-W3", "M-S4", "M-B1"] });
    const result = await page.evaluate(async () => {
      const shops = await import("./js/chapters/ch5-shops.js"), vn = await import("./js/vn/engine.js"), s = window.__remake.state;
      const texts = () => vn.backlog().map((row) => row.text);
      const naru = await shops.performChapterFiveShop(shops.chapterFiveShopById("naru"));
      const naruLines = texts(); vn.clearLog();
      const ageha = await shops.performChapterFiveShop(shops.chapterFiveCityShops(s)[0]);
      const agehaLines = texts(); vn.clearLog();
      const minto = await shops.performChapterFiveShop(shops.chapterFiveShopById("minto"));
      return { naru, ageha, minto, naruLines, agehaLines, learned: [...s.growth.learned] };
    });
    for (const key of ["naru", "ageha", "minto"]) assert.deepEqual(result[key], { used: true, exerted: true }, key);
    assert.deepEqual([...result.learned].sort(), ["M-B1", "M-S4", "M-W3"]);
    const naru = result.naruLines.join("\n"), ageha = result.agehaLines.join("\n");
    assert.match(naru, /なるって、前より見てる所が増えたよね。どうやってるの？/);
    assert.doesNotMatch(naru, /なるさん/, "after chapter 3 Hajime drops the honorific");
    assert(result.agehaLines.includes("ちょっと相談いい？ 吸い出しのことで"), "Hajime opens the consult without a name");
    assert.doesNotMatch(ageha, /あげはさん/, "after the tournament the lesson reads like the ch5 shop talk (lover route calls her あげは)");
    assert.doesNotMatch(ageha, /相談いいですか|ズボー……ですか|数えてみます/, "after the tournament Hajime speaks casually to Ageha");
  });

  // (d) IR22: 大会前の来店で読めなかった久世の締めくくり（♥5）を、大会後の寄り道から一度だけ。日時・stage・お金は進めない
  await check("ch3-aftermath-kuze-heart5-finale-once-before-the-cleanup", async (page) => {
    await openAftermath(page, { stage: 1, lit: [], extra: "kuze-finale" });
    const before = await unchanged(page);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.match(await page.locator(t("ch3-aftermath-finale-kuze")).innerText(), /久世に呼ばれる（煙幕）/);
    await page.locator(t("ch3-aftermath-finale-kuze")).click();
    await page.waitForFunction(() => !!window.__remake.state.finales?.kuze, null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    assert.deepEqual(await unchanged(page), before, "the finale does not spend time or money, nor advance the aftermath");
    const s = await page.evaluate(() => structuredClone(window.__remake.state));
    assert.equal(s.finales.kuze.route, "friend");
    assert.equal(s.owned.filter((id) => id === "suyaki_kuze").length, 1);
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map((row) => row.text).join("\n"));
    assert.match(backlog, /今夜の議題は、勝ち負けとは別の話/, "read after the tournament: the after-tournament branch");
    assert.doesNotMatch(backlog, /勝負の話は、今夜はなし/);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-finale-kuze")).count(), 0, "the finale is read once");
  }, { viewport: { width: 1331, height: 760 } });

  // (e) IR23: 大会前に読めなかった鉄の煙の再訪を、大会後に順に読める。任意の場面なので台本の報酬で好感度が上がる
  await check("ch3-aftermath-volk-visits-in-order-raise-affinity", async (page) => {
    await openAftermath(page, { stage: 1, lit: [], extra: "volk-low" });
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-detour-ch3_volk_third")).count(), 0, "the visits keep their order");
    await page.locator(t("ch3-aftermath-detour-ch3_volk_second")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_read_ch3_volk_second === true, null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    const volk = await page.evaluate(() => window.__remake.state.affinity.volk);
    assert(volk >= 10, `an optional visit raises Volk's affinity (${volk})`);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour-ch3_volk_third")).waitFor();
  }, { viewport: { width: 1331, height: 760 } });

  // (f) IR23: 第5章のドバイの屋敷で会うたびにシェイク・太陽の好感度が上がり（1回目は段階会話、2回目から小会話の値）、
  // ♥5で授業の錠が開く。灯した後に会うと相談して習う（授業の♥5は下げない）
  await check("ch5-dubai-visits-raise-sheikh-and-taiyo-to-heart5-and-teach", async (page) => {
    // 太陽は第4章の FESTA に5回（+8ずつ）通った分を持って来る
    await chapterFive(page, { region: "dubai", met: { sheikh: true, da_silva: true }, affinity: { da_silva: 34 }, lit: [] });
    const result = await page.evaluate(async () => {
      const dubai = await import("./js/chapters/ch5-dubai.js"), stats = await import("./js/core/stats.js");
      const board = await import("./js/core/growth-board.js"), growth = await import("./js/core/growth.js"), s = window.__remake.state;
      const spot = (id) => dubai.DUBAI_SPOTS.find((entry) => entry.id === id);
      const locked = (id) => !!board.lessonLock(board.NODE_BY_ID[id], new Set(), s)?.heart;
      const out = { gains: {}, visits: {}, lockedBefore: [locked("M-W8"), locked("M-B6")] };
      for (const [id, who] of [["ch5_dubai_sheikh", "sheikh"], ["ch5_dubai_taiyo", "da_silva"]]) {
        out.gains[who] = [];
        let n = 0;
        while (stats.affinityLevel(who) < 5 && n < 30) {
          const before = s.affinity[who] || 0;
          const visit = await dubai.performDubaiSpot(spot(id));
          if (!visit?.used) throw new Error(`${who}: visit ${n} was not used`);
          s.stamina = 100; n++;
          if (out.gains[who].length < 2) out.gains[who].push(s.affinity[who] - before);
        }
        out.visits[who] = n;
      }
      out.lockedAfter = [locked("M-W8"), locked("M-B6")];
      growth.ensureGrowth().nodes.push("M-W8", "M-B6");
      await dubai.performDubaiSpot(spot("ch5_dubai_sheikh")); s.stamina = 100;
      await dubai.performDubaiSpot(spot("ch5_dubai_taiyo"));
      out.learned = [...s.growth.learned];
      return out;
    });
    assert.deepEqual(result.lockedBefore, [true, true], "the ♥5 lessons are locked below ♥5");
    for (const who of ["sheikh", "da_silva"]) {
      const [first, second] = result.gains[who];
      assert(first > second && second > 0, `${who}: the first visit is a stage talk, then small talks (${result.gains[who]})`);
    }
    assert(result.visits.sheikh <= 15, `the Sheikh reaches ♥5 from zero in ${result.visits.sheikh} visits`);
    assert(result.visits.da_silva <= 7, `Taiyo reaches ♥5 in ${result.visits.da_silva} visits after chapter 4`);
    assert.deepEqual(result.lockedAfter, [false, false], "♥5 opens both lessons");
    assert.deepEqual([...result.learned].sort(), ["M-B6", "M-W8"], "both teach at the residence once lit");
  });
});
