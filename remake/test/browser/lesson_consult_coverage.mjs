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
    Object.assign(s.met, { steve: true, volk: true, saku: true, mashiro: true, mukai_master: true, emil: true });
    Object.assign(s.affinity, { steve: 66, volk: 66, saku: 66, mashiro: 66 });
    p.beginChapterThreeAftermath(s);
    for (const scene of p.CH3_AFTERMATH_SCENES.slice(0, stage)) if (!p.completeChapterThreeAftermathScene(s, scene.id)) throw new Error(scene.id);
    if (extra === "all-detours-read") for (const scene of p.CH3_AFTERMATH_DETOURS) s.flags[`_ch3_read_${scene.id}`] = true;
    // 綾取の締めくくりの前提（LIME交換の寄り道・答えを返しに行く外出）を大会前に済ませた保存（IR22）
    if (extra === "saku-finale") Object.assign(s.flags, { _lime_contact_saku: true, _ch3_read_ch3_saku_lime: true, _ch3_read_ch3_saku_missed: true, _ch3_read_ch3_saku_cleanup: true, _ch3_read_ch3_saku_liar: true, _ch3_read_ch3_saku_first_reply: true, _ch3_outings: { enmaku_answer: 1 } });
    if (extra === "volk-low") s.affinity.volk = 0;
    // ヴォルクの締めくくりの前提（鉄の煙の再訪三つとLIME交換の寄り道）と、大会後に初めて鉄の煙へ寄る場面を済ませた保存（#2028）
    if (extra === "volk-finale") for (const id of ["ch3_volk_second", "ch3_volk_third", "ch3_volk_fourth", "ch3_volk_lime", "ch3_volk_fifth", "ch3_volk_revisit", "ch3_volk_after_ch3"]) {
      s.flags[`_ch3_read_${id}`] = true; s.flags._lime_contact_volk = true;
    }
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
async function chapterFive(page, { region = "home", met = {}, affinity = {}, lit, finales = {}, money = 60000, flags = {} }) {
  await page.evaluate(async ({ region, met, affinity, lit, finales, money, flags }) => {
    const core = await import("./js/core/state.js"), growth = await import("./js/core/growth.js"), vn = await import("./js/vn/engine.js");
    const s = core.newGame();
    Object.assign(s, { chapter: 5, phase: "daily", day: 52, slot: 0, money, stamina: 100 });
    Object.assign(s.flags, { _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true, _ch4_sheikh_revealed: true,
      _ch2_region: region, _ch5_tokyo_attic: region === "tokyo", ...flags });
    Object.assign(s.met, met);
    Object.assign(s.affinity, affinity);
    Object.assign(s.finales ||= {}, finales);
    growth.setGrowthPreview(true);
    Object.assign(growth.ensureGrowth(), { nodes: [...lit], learned: [] });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    vn.clearLog();
    const ui = await import("./js/core/ui.js");
    ui.showScreen("map", document.createElement("div"));
    core.save();
  }, { region, met, affinity, lit, finales, money, flags });
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

  // 寄り道を全部読んだ後でも、授業だけで入口が開く。帰郷の日の朝はヴォルクだけ（綾取は店を畳んでいる）
  await check("ch3-aftermath-cleanup-morning-lists-only-volk", async (page) => {
    await openAftermath(page, { stage: 3, lit: ["M-W5", "M-B3", "M-B5"], extra: "all-detours-read" });
    const before = await unchanged(page);
    assert.match(await page.locator(t("ch3-aftermath-detour-open")).innerText(), /（1）/);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-lesson-saku")).count(), 0, "Ayatori is packing up Enmaku on this morning");
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
    // 締めくくりは第3章で見た保存（第5章の東京の締めくくりは次の検査）
    const seenInChapterThree = { day: 40, chapter: 3, route: "friend" };
    await chapterFive(page, { region: "tokyo", met: { steve: true, volk: true, mukai_master: true }, affinity: { steve: 66, volk: 66 }, lit: ["M-W5", "M-S5"],
      finales: { steve: seenInChapterThree, volk: seenInChapterThree } });
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

  // (b2) 第5章の東京: 第3章で締めくくりを見ていない♥5のスティーブ・ヴォルクは、来店で締めくくり（#2705・2026-11-07 オーナー指示
  // 「ヴォルク♥5エンディングも第5章東京『鉄の煙』で出す（スティーブと揃える）」）。締めくくりの来店では小会話の巡回・代金・授業の相談を
  // 重ねず、ヴォルクの授業は次の来店で相談する。台詞は第5章用（第3章の布の包みではない）で、一度だけ。
  await check("ch5-tokyo-rival-heart5-finales-first-then-the-lesson", async (page) => {
    await chapterFive(page, { region: "tokyo", met: { steve: true, volk: true, mukai_master: true }, affinity: { steve: 66, volk: 66 }, lit: ["M-W5"] });
    const visits = await page.evaluate(async () => {
      const tokyo = await import("./js/chapters/ch5-tokyo.js"), vn = await import("./js/vn/engine.js"), s = window.__remake.state;
      const count = (gear) => s.owned.filter((id) => id === gear).length;
      const visit = async (id) => {
        vn.clearLog();
        const money = s.money;
        const result = await tokyo.performTokyoSpot(tokyo.TOKYO_SPOTS.find((entry) => entry.id === id));
        return { result, spent: money - s.money, text: vn.backlog().map((row) => row.text).join("\n"),
          talks: s.flags._ch5_tokyo_talks?.[id] ?? 0, learned: [...s.growth.learned],
          finales: JSON.parse(JSON.stringify(s.finales || {})), steveHagal: count("suyaki_steve"), volkHagal: count("suyaki_volk"),
          mint: s.flavorStock?.nightside_blast_mint || 0, steveLime: !!s.flags._lime_contact_steve, volkLime: !!s.flags._lime_contact_volk };
      };
      const steve = await visit("ch5_tokyo_steve");
      const volk = await visit("ch5_tokyo_volk");
      const volkAgain = await visit("ch5_tokyo_volk");
      const saved = JSON.parse(localStorage.getItem("suien_remake_save")).finales;
      // その場で交換した二人から、日を置いた第5章の朝に友人のLIME（雑談）が届く候補になる
      s.day += 10;
      const friendLime = (await import("./js/daily/bonds.js")).friendMessages().map((m) => [m.sender, m.type]).sort();
      return { steve, volk, volkAgain, saved, friendLime };
    });
    const { steve, volk, volkAgain, saved, friendLime } = visits;
    assert.deepEqual(steve.result, { used: true, exerted: true });
    assert.equal(steve.spent, 0, "the finale is not a paid cup");
    assert.equal(steve.talks, 0, "the small-talk rotation does not advance");
    assert.deepEqual([steve.finales.steve?.chapter, steve.finales.steve?.route], [5, "friend"]);
    assert.equal(steve.steveHagal, 1);
    assert.match(steve.text, /ずっと練習に使ってきた、俺のハガルだ/, "Steve's chapter 5 text");
    // 第3章でLIMEを交換していない人: 「顔の知らせ」を頼まれたその場で交換してから「送ります」と言い、友人のLIMEが届くようになる
    assert.match(steve.text, /LIMEを交換しておきませんか[\s\S]*連絡先を交換した。[\s\S]*送ります。気づいた日だけ/, "no LIME yet: exchange it before promising to send");
    assert.equal(steve.steveLime, true, "the exchange is recorded");
    assert.deepEqual(volk.result, { used: true, exerted: true });
    assert.equal(volk.spent, 0, "the finale is not a paid cup");
    assert.equal(volk.talks, 0, "the small-talk rotation does not advance");
    assert.deepEqual(volk.learned, [], "the finale visit does not also hold the lesson");
    assert.deepEqual([volk.finales.volk?.chapter, volk.finales.volk?.route], [5, "friend"]);
    assert.equal(volk.volkHagal, 1);
    assert(volk.mint >= 50, `the blast mint leaves come with the hagal (${volk.mint}g)`);
    assert.match(volk.text, /祖母に言われたこと/, "Volk's chapter 5 text");
    assert.doesNotMatch(volk.text, /布の包み/, "not the chapter 3 text");
    // ヴォルクも、第3章でLIMEを交換していない人とは「書いたら、送れ」と頼まれたその場で交換し、「また来い」で着地する
    // （2026-11-07 オーナー判断「ヴォルクの第5章♥5エンディングでの LIME 即時交換は付与する」）
    assert.match(volk.text, /書いたら、送れ[\s\S]*LIMEを交換してもらえますか[\s\S]*連絡先を登録し[\s\S]*また来い/, "no LIME yet: Volk exchanges it on the spot");
    assert.equal(volk.volkLime, true, "the exchange is recorded");
    assert.deepEqual(friendLime, [["steve", "chat"], ["volk", "chat"]], "friend LIMEs can arrive from both afterwards");
    assert.deepEqual(volkAgain.result, { used: true, exerted: true });
    assert.equal(volkAgain.spent, 4000, "the next visit is an ordinary paid visit");
    assert.equal(volkAgain.talks, 1);
    assert.deepEqual(volkAgain.learned, ["M-W5"], "the lesson comes on the next visit");
    assert.doesNotMatch(volkAgain.text, /祖母に言われたこと|連絡先を登録し/, "the finale and the exchange play once");
    assert.equal(volkAgain.volkHagal, 1);
    assert.deepEqual([saved.steve?.chapter, saved.volk?.chapter], [5, 5]);
  });

  // (b3) 締めくくりの来店は代金を取らないので、所持金が4,000円に足りなくても地図の行き先は選べて（利用料は0円）、締めくくりを迎えられる。
  // 締めくくりの後のふだんの来店は4,000円で、足りなければ断る。第3章でLIMEを交換済みのスティーブ・ヴォルクは、締めくくりで交換し直さない。
  await check("ch5-tokyo-rival-finales-are-free-even-short-of-money", async (page) => {
    await chapterFive(page, { region: "tokyo", met: { steve: true, volk: true, mukai_master: true }, affinity: { steve: 66, volk: 66 }, lit: [],
      money: 3000, flags: { _lime_contact_steve: true, _lime_contact_volk: true } });
    const result = await page.evaluate(async () => {
      const tokyo = await import("./js/chapters/ch5-tokyo.js"), access = await import("./js/daily/spot-access.js");
      const vn = await import("./js/vn/engine.js"), s = window.__remake.state;
      const spot = (id) => tokyo.TOKYO_SPOTS.find((entry) => entry.id === id);
      const pin = (id) => ({ cost: spot(id).cost, ok: access.spotAvailability(spot(id)).ok });
      const visit = async (id) => {
        vn.clearLog();
        const money = s.money;
        const result = await tokyo.performTokyoSpot(spot(id));
        return { result, spent: money - s.money, text: vn.backlog().map((row) => row.text).join("\n"),
          talks: s.flags._ch5_tokyo_talks?.[id] ?? 0, finale: s.finales?.[spot(id).charId]?.chapter ?? null };
      };
      // 地図を見る時点で第5章の東京の台詞は読み込まれている（再開・LOAD 直後の地図は ch5_home_talks.mjs が実際に確かめる）
      const { DB } = await import("./js/core/data.js");
      for (const d of (await (await fetch("../data/dialogue/ch5_tokyo.json")).json()).dialogues) DB.dialogues[d.dialogue_id] ||= d;
      const before = { steve: pin("ch5_tokyo_steve"), volk: pin("ch5_tokyo_volk") };
      const steve = await visit("ch5_tokyo_steve"), volk = await visit("ch5_tokyo_volk");
      const after = { steve: pin("ch5_tokyo_steve"), volk: pin("ch5_tokyo_volk") };
      const steveAgain = await visit("ch5_tokyo_steve");
      return { before, steve, volk, after, steveAgain, money: s.money };
    });
    const { before, steve, volk, after, steveAgain } = result;
    assert.deepEqual(before, { steve: { cost: 0, ok: true }, volk: { cost: 0, ok: true } }, "the finale pin has no fee, so 3,000 yen is enough");
    for (const [name, row] of [["Steve", steve], ["Volk", volk]]) {
      assert.deepEqual(row.result, { used: true, exerted: true }, `${name}: the finale plays with 3,000 yen`);
      assert.equal(row.spent, 0, `${name}: the finale is free`);
      assert.equal(row.finale, 5, `${name}: the chapter 5 finale is recorded`);
    }
    assert.match(steve.text, /送ります。気づいた日だけ/);
    assert.doesNotMatch(steve.text, /LIMEを交換しておきませんか|連絡先を交換した/, "already on LIME since chapter 3: no second exchange");
    assert.match(volk.text, /順番は違っても、両方を書くなら構わない[\s\S]*また来い/, "Volk's chapter 5 text");
    assert.doesNotMatch(volk.text, /書いたら、送れ|LIMEを交換してもらえますか|連絡先を登録し/, "Volk: already on LIME since chapter 3: no second exchange");
    assert.deepEqual(after, { steve: { cost: 4000, ok: false }, volk: { cost: 4000, ok: false } }, "after the finale the usual 4,000 yen fee is back");
    assert.deepEqual(steveAgain.result, { used: false, exerted: false }, "an ordinary visit with 3,000 yen is still refused");
    assert.equal(steveAgain.spent, 0);
    assert.equal(steveAgain.talks, 0);
    assert.equal(result.money, 3000);
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
    assert.match(naru, /なるって、少し高めの温度で止めるよね/);
    assert.match(naru, /隠すほどのことじゃないだろ。俺はこう作ってるってだけ/, "Naru shares the technique without becoming a master");
    assert.match(naru, /印に合わせて提供すると、仕上げの評価が少し上がる/, "the adopted finish lesson is explained");
    assert.doesNotMatch(naru, /なるさん/, "after chapter 3 Hajime drops the honorific");
    assert(result.agehaLines.includes("ちょっと相談いい？ 吸い出しのことで"), "Hajime opens the consult without a name");
    assert.doesNotMatch(ageha, /あげはさん/, "after the tournament the lesson reads like the ch5 shop talk (lover route calls her あげは)");
    assert.doesNotMatch(ageha, /相談いいですか|ズボー……ですか|数えてみます/, "after the tournament Hajime speaks casually to Ageha");
  });

  // (d) IR22: 大会前の来店で読めなかった綾取の締めくくり（♥5）を、大会後の寄り道から一度だけ。日時・stage・お金は進めない
  await check("ch3-aftermath-saku-heart5-finale-once-before-the-cleanup", async (page) => {
    await openAftermath(page, { stage: 1, lit: [], extra: "saku-finale" });
    const before = await unchanged(page);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.match(await page.locator(t("ch3-aftermath-finale-saku")).innerText(), /綾取に呼ばれる（煙幕）/);
    await page.locator(t("ch3-aftermath-finale-saku")).click();
    await page.waitForFunction(() => !!window.__remake.state.finales?.saku, null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    assert.deepEqual(await unchanged(page), before, "the finale does not spend time or money, nor advance the aftermath");
    const s = await page.evaluate(() => structuredClone(window.__remake.state));
    assert.equal(s.finales.saku.route, "friend");
    assert.equal(s.owned.filter((id) => id === "suyaki_saku").length, 1);
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map((row) => row.text).join("\n"));
    assert.match(backlog, /今日の議題は、勝ち負けとは別の話/, "read after the tournament: the after-tournament branch");
    assert.doesNotMatch(backlog, /勝負の話は、今日はなし/);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-finale-saku")).count(), 0, "the finale is read once");
  }, { viewport: { width: 1331, height: 760 } });

  // (d2) #2028: ヴォルクの締めくくり（♥5）は、鉄の煙の寄り道と同じく煙幕の片づけの朝まで（綾取・スティーブの窓は閉じた後）
  await check("ch3-aftermath-volk-heart5-finale-on-the-cleanup-morning", async (page) => {
    await openAftermath(page, { stage: 3, lit: [], extra: "volk-finale" });
    const before = await unchanged(page);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.match(await page.locator(t("ch3-aftermath-finale-volk")).innerText(), /ヴォルクに呼ばれる（鉄の煙）/);
    await page.locator(t("ch3-aftermath-finale-volk")).click();
    await page.waitForFunction(() => !!window.__remake.state.finales?.volk, null, { timeout: 30000 });
    await page.locator(t("ch3-aftermath-scene")).waitFor({ timeout: 30000 });
    assert.deepEqual(await unchanged(page), before, "the finale does not spend time or money, nor advance the aftermath");
    const s = await page.evaluate(() => structuredClone(window.__remake.state));
    assert.equal(s.finales.volk.route, "friend");
    assert.equal(s.owned.filter((id) => id === "suyaki_volk").length, 1);
    const backlog = await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map((row) => row.text).join("\n"));
    assert.match(backlog, /温度計は、今も先に見る。……その隣で、客の息の間も聞くようにした/, "read after the tournament: the after-tournament branch");
    assert.match(backlog, /友人と過ごした時間は、書かなくても覚えている/);
    await page.locator(t("ch3-aftermath-detour-open")).click();
    await page.locator(t("ch3-aftermath-detour")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-finale-volk")).count(), 0, "the finale is read once");
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
          out.gains[who].push(s.affinity[who] - before);
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
    // 最初の来店と屋敷の段階の会話（RVE03・chapters/dubai-bonds.js）は段階の値、小会話はそれより小さい値（端数の繰り越しで±1揺れる）
    for (const who of ["sheikh", "da_silva"]) {
      const gains = result.gains[who];
      assert(gains.every(gain => gain > 0) && gains[0] > Math.min(...gains), `${who}: the first visit is a stage talk, small talks are lighter (${gains})`);
    }
    assert(result.visits.sheikh <= 15, `the Sheikh reaches ♥5 from zero in ${result.visits.sheikh} visits`);
    assert(result.visits.da_silva <= 7, `Taiyo reaches ♥5 in ${result.visits.da_silva} visits after chapter 4`);
    assert.deepEqual(result.lockedAfter, [false, false], "♥5 opens both lessons");
    assert.deepEqual([...result.learned].sort(), ["M-B6", "M-W8"], "both teach at the residence once lit");
  });
});
