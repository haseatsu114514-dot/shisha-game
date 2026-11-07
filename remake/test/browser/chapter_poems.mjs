// 巻頭ポエム: 序詩はタイトルから「はじめから」の直後（コールドオープンの前）、各章の詩は章タイトルの直後に出る。
// 台本・文書との一致と接続点の静的な検査は ../chapter_poems.mjs。ここでは実際の再生順と再開時の挙動を見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const POEMS = {
  poem_prologue: ["煙は 形を 持たぬ　ゆえに 人は 器を 与え", "その名を 人は　水煙と 呼ぶ"],
  poem_ch1: ["路地には 音がある　シャッターの 上がる音", "今夜 最初の 一人に 渡すまで"],
  poem_ch2: ["壁は 高さで 壁になるのではない", "何を 入れて 歩けばいい"],
};

/** 会話の行を順に記録する（既存のフックは保ったまま） */
async function recordLines(page) {
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    window.POEM_LOG = { ids: [], lines: {}, titleSeenAtPoem: null };
    const previous = vn.hooks.onLine;
    vn.hooks.onLine = (id, line) => {
      const log = window.POEM_LOG;
      if (log.ids.at(-1) !== id) log.ids.push(id);
      (log.lines[id] ||= []).push(line.text);
      if (id === "poem_ch2" && log.titleSeenAtPoem === null) log.titleSeenAtPoem = !!window.__remake.state.flags._ch2_day1?.titleSeen;
      return previous?.(id, line);
    };
    vn.vnTest.turbo = true;
  });
}

await suite("chapter-poems", async check => {
  await check("new-game-prologue-then-title-then-ch1-poem", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame();
    });
    await recordLines(page);
    await page.evaluate(async () => {
      const ch1 = await import("./js/chapters/ch1.js");
      ch1.startNewGame().catch(error => { window.POEM_ERROR = error.stack; });
    });
    await page.waitForFunction(() => window.POEM_LOG.ids.includes("ch1_opening") || window.POEM_ERROR, null, { timeout: 90000 });
    const log = await page.evaluate(() => ({ ...window.POEM_LOG, error: window.POEM_ERROR || null }));
    assert.equal(log.error, null);
    // 序詩 → コールドオープン → （章タイトル）→ 第1章の詩 → スミさんの場面
    assert.deepEqual(log.ids.slice(0, 4), ["poem_prologue", "ch1_cold_open", "poem_ch1", "ch1_opening"]);
    for (const id of ["poem_prologue", "poem_ch1"]) {
      assert.equal(log.lines[id][0], POEMS[id][0], `${id}: 最初のページ`);
      assert.equal(log.lines[id].at(-1), POEMS[id][1], `${id}: 最後のページ`);
    }
  });

  // 第3章は新しく入る標準の経路（出発前の準備つき）。章頭の調べもの → 章タイトル → 詩 → 準備1日目のtonari。
  await check("ch3-poem-after-title-before-prep-opening", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch3-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5, contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
        _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
      for (const who of ["ageha", "kumicho", "rei", "hajime", "sumi"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { ageha: true, kumicho: true, rei: true });
      if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig();
      Object.assign(core.state, value);
      core.save();
    });
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    // 章の側が再開時に hooks を差し替えるので、代入を横取りして読んだ会話を記録する。
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      window.ENTERED = [];
      let current = vn.hooks.onEnter;
      const wrapped = (id, dialogue) => {
        window.ENTERED.push([id, !!window.__remake.state.flags._ch3_intro?.titleSeen]);
        return current?.(id, dialogue);
      };
      Object.defineProperty(vn.hooks, "onEnter", { configurable: true, get: () => wrapped, set: fn => { current = fn; } });
      vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    });
    await page.locator('[data-test="slot-0"]').click();
    await page.waitForFunction(() => window.ENTERED.some(([id]) => id === "ch3_prep_opening"), null, { timeout: 90000 });
    const entered = await page.evaluate(() => window.ENTERED);
    const ids = entered.map(([id]) => id);
    assert.equal(ids.filter(id => id === "poem_ch3").length, 1, "第3章の詩は一度だけ");
    assert.ok(ids.indexOf("ch3_saku_research") < ids.indexOf("poem_ch3"), "調べものの後（章タイトルの後）に詩");
    assert.ok(ids.indexOf("poem_ch3") < ids.indexOf("ch3_prep_opening"), "詩の後に準備の場面");
    assert.equal(entered.find(([id]) => id === "poem_ch3")[1], false, "詩を読み終えるまで titleSeen は立たない");
    assert.equal(entered.find(([id]) => id === "ch3_prep_opening")[1], true, "詩の後は titleSeen が立っている");
  });

  await check("ch2-poem-after-title-then-departure-and-not-repeated-on-resume", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      const c = await import("./js/core/state.js");
      c.newGame(); c.state.phase = "cleared"; c.save();
    });
    await recordLines(page);
    await page.evaluate(async () => { await (await import("./js/chapters/ch1.js")).showClear(); });
    await page.locator('[data-test="end-chapter2"]').click();
    await page.locator('.chapter-card.show[data-chapter="第二章"]').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.POEM_LOG.ids.includes("remake_ch2_departure"), null, { timeout: 90000 });
    const log = await page.evaluate(() => window.POEM_LOG);
    // 章タイトルの後に詩、その後に出発の場面。詩を読み終えるまで titleSeen は立たない。
    assert.deepEqual(log.ids.slice(0, 2), ["poem_ch2", "remake_ch2_departure"]);
    assert.equal(log.titleSeenAtPoem, false);
    assert.equal(log.lines.poem_ch2[0], POEMS.poem_ch2[0]);
    assert.equal(log.lines.poem_ch2.at(-1), POEMS.poem_ch2[1]);
    await page.waitForFunction(() => window.__remake.state.flags._ch2_day1.titleSeen);

    // 読了済みの章の再開では、章タイトルも詩も繰り返さない。
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    await recordLines(page);
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".chapter-card").count(), 0, "章タイトルを繰り返さない");
    assert.ok(!(await page.evaluate(() => window.POEM_LOG.ids)).includes("poem_ch2"), "詩を繰り返さない");
  });
});
