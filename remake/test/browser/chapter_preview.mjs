// 予告を廃止した章末導線（第2〜4章末→次章のタイトルコールだけ）を検証する。旧予告の既読フラグは無視して保全する。
// 章タイトル自体の描画・入力・画像遅延/失敗は chapter_titles.mjs が担う。
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";
const preview = '[data-test="chapter-preview"]';
await suite("chapter-preview", async check => {
  for (const seen of [undefined,false,true]) await check("ch2-clear-title-only-"+String(seen), async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 23456, stamina: 100,
        flavorStock: { double_apple: 40, mint: 12 }, lovers: ["minto"], contacts: ["sumi", "minto"] });
      s.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true,
        _ch2_day1: { startDay: 15, stage: "complete" }, _ch2_eve_done: true, _ch2_taste_distant: true,
        _ch2_read_ch2_tournament_ageha_heart: true };
      s.stats = { technique: 42, sense: 42, guts: 42, charm: 42, insight: 42 };
      s.tournament.lastRank = 1; s.tournament.lastTotal = 88;
      for (const who of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "sui", "hajime", "sumi"])
        s.flags[`_intro_${who}`] = true;
      (await import("./js/chapters/ch2-tournament-state.js")).tournamentProgress(s).stage = "complete";
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
      const vn = await import("./js/vn/engine.js");
      (await import("./js/chapters/ch1.js")).setupHooks();
      vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
    });
    await page.locator('[data-test="ch2-tournament-complete"]').waitFor();
    await page.evaluate(async seen => {
      const core=await import('./js/core/state.js');
      if (seen===undefined) delete core.state.flags._ch2_preview_seen;
      else core.state.flags._ch2_preview_seen=seen;
      core.save();
    },seen);
    // 保存した未視聴／視聴済みの旧セーブを同じ章末へ戻す。
    await page.evaluate(async () => {
      void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
    });
    await page.locator('[data-test="ch2-tournament-complete"]').waitFor();
    const before=await storageSnapshot(page);
    await page.waitForTimeout(400);
    assert.equal(await page.locator(preview).count(),0);
    assert.equal(await page.locator('[data-test="ch2-tournament-complete-preview"]').count(),0);
    assert(!(await page.locator('[data-test="ch2-tournament-chapter-three"]').isDisabled()),'旧予告の既読で次章をロックしない');
    assert.equal(await page.evaluate(() => __remake.state.flags._ch2_preview_seen),seen);
    assert.deepEqual(await storageSnapshot(page),before,'章末の表示で予告既読を保存しない');
    await assertFits(page,'[data-test="ch2-tournament-chapter-three"]');
  });
  for (const seen of [undefined,false,true]) await check("ch3-clear-title-only-"+String(seen), async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 3, day: 128, slot: 1, phase: "cleared", money: 23456, stamina: 100,
        flavorStock: { double_apple: 40, mint: 12 }, lovers: ["minto"], contacts: ["sumi", "minto"] });
      s.flags._elapsed_calendar = true; s.flags._ageha_mastery = true;
      s.flags._ch2_cleared = true; s.flags._ch3_cleared = true;
      s.flags._friend_ageha = true; // あげはの告白（#1930）は着地済み
      s.flags._ch3_tournament_won = true;
      s.flags._ch3_tournament = { startDay: 113, stage: "complete", result: { rank: 1, win: true } };
      s.flags._ch3_aftermath = { version: 2, winDay: 125, stage: 6 };
      s.stats = { technique: 42, sense: 42, guts: 42, charm: 42, insight: 42 };
      core.save();
    });
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    await page.locator('[data-test="ch3-aftermath-complete"]').waitFor();
    await page.evaluate(async seen => {
      const core=await import('./js/core/state.js');
      if (seen===undefined) delete core.state.flags._ch3_preview_seen;
      else core.state.flags._ch3_preview_seen=seen;
      core.save();
    },seen);
    // 保存した未視聴／視聴済みの旧セーブを同じ章末へ戻す。
    await page.evaluate(async () => {
      void (await import('./js/chapters/ch3.js')).resumeChapterThree();
    });
    await page.locator('[data-test="ch3-aftermath-complete"]').waitFor();
    const before=await storageSnapshot(page);
    await page.waitForTimeout(400);
    assert.equal(await page.locator(preview).count(),0);
    assert.equal(await page.locator('[data-test="ch3-aftermath-complete-preview"]').count(),0);
    assert(!(await page.locator('[data-test="ch3-aftermath-chapter-four"]').isDisabled()),'旧予告の既読で次章をロックしない');
    assert.equal(await page.evaluate(() => __remake.state.flags._ch3_preview_seen),seen);
    assert.deepEqual(await storageSnapshot(page),before,'章末の表示で予告既読を保存しない');
    await assertFits(page,'[data-test="ch3-aftermath-chapter-four"]');
    if (seen===false) {
      await page.locator('[data-test="ch3-aftermath-chapter-four"]').click();
      const title=page.locator('.chapter-card.show[data-chapter="第四章"]');
      await title.waitFor({timeout:30000});
      assert.equal(await page.locator(preview).count(),0);
      await page.locator('.chapter-title-shield').waitFor({state:'detached',timeout:12000});
      assert.equal(await page.evaluate(()=>__remake.state.chapter),4);
      assert(await page.evaluate(()=>__remake.state.flags._ch4.titleSeen));
    }
  });
  for (const seen of [undefined,false,true]) await check("ch4-clear-title-only-"+String(seen), async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 4, day: 50, slot: 1, phase: "cleared", money: 50000, stamina: 100,
        weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      s.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
        _ch4_cleared: true, _ch4_sheikh_revealed: true,
        _ch4: { startDay: 46, day: 5, stage: 4, part: "cleared", titleSeen: true, read: {},
          firstDay: 1, resolution: 5, attempts: 1 } };
      s.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
    });
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    await page.locator('[data-test="ch4-complete"]').waitFor();
    await page.evaluate(async seen => {
      const core=await import('./js/core/state.js');
      if (seen===undefined) delete core.state.flags._ch4_preview_seen;
      else core.state.flags._ch4_preview_seen=seen;
      core.save();
    },seen);
    // 保存した未視聴／視聴済みの旧セーブを同じ章末へ戻す。
    await page.evaluate(async () => {
      void (await import('./js/chapters/ch4.js')).resumeChapterFour();
    });
    await page.locator('[data-test="ch4-complete"]').waitFor();
    const before=await storageSnapshot(page);
    await page.waitForTimeout(400);
    assert.equal(await page.locator(preview).count(),0);
    assert.equal(await page.locator('[data-test="ch4-complete-preview"]').count(),0);
    assert(!(await page.locator('[data-test="ch4-chapter-five"]').isDisabled()),'旧予告の既読で次章をロックしない');
    assert.equal(await page.evaluate(() => __remake.state.flags._ch4_preview_seen),seen);
    assert.deepEqual(await storageSnapshot(page),before,'章末の表示で予告既読を保存しない');
    await assertFits(page,'[data-test="ch4-chapter-five"]');
    if (seen===false) {
      await page.locator('[data-test="ch4-chapter-five"]').click();
      const title=page.locator('.chapter-card.show[data-chapter="第五章"]');
      await title.waitFor({timeout:30000});
      assert.equal(await page.locator(preview).count(),0);
      await page.locator('.chapter-title-shield').waitFor({state:'detached',timeout:12000});
      assert.equal(await page.evaluate(()=>__remake.state.chapter),5);
      assert(await page.evaluate(()=>__remake.state.flags._ch5.titleSeen));
    }
  });
});
