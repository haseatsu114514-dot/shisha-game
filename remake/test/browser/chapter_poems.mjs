// 巻頭ポエム: 序詩はタイトルから「はじめから」の直後（コールドオープンの前）、各章の詩は章タイトルの直前に、
// 会話ウインドウではなく専用の読ませる画面（縦書き・行ごとに浮かぶ・ふりがな）で出る。
// 台本・文書との一致と接続点の静的な検査は ../chapter_poems.mjs。ここでは実際の表示順・操作・再開を見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const POEM = '[data-test="chapter-poem"]';

/**
 * 表示の順序を記録する。会話の行（hooks）・章タイトルのカード・詩のカードを同じ時間軸に並べる。
 * 章の側が再開時に hooks を差し替えるので、代入を横取りして記録する。
 */
async function watch(page, { turbo = true } = {}) {
  await page.evaluate(async turbo => {
    const vn = await import("./js/vn/engine.js");
    const poem = await import("./js/scenes/chapter-poem.js");
    window.TL = [];
    const stamp = (kind, id, extra = {}) => window.TL.push({ kind, id, t: performance.now(), ...extra });
    const wrap = name => {
      let current = vn.hooks[name];
      const wrapped = (id, ...rest) => { stamp("vn", id); return current?.(id, ...rest); };
      Object.defineProperty(vn.hooks, name, { configurable: true, get: () => wrapped, set: fn => { current = fn; } });
    };
    // 同じ会話の連続した行・入場は1つにまとめる（onEnter と onLine のどちらでも拾う）
    wrap("onEnter");
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches('[data-test="chapter-poem"]')) {
          const s = window.__remake.state?.flags || {};
          stamp("poem", node.dataset.poem, { seen: !!(s._ch2_day1?.titleSeen || s._ch3_intro?.titleSeen) });
        } else if (node.matches(".ch1-title-motion")) stamp("title", "第一章");
        else if (node.matches(".chapter-card")) stamp("title", node.dataset.chapter);
        for (const found of node.querySelectorAll?.(".chapter-card") || []) stamp("title", found.dataset.chapter);
      }
    }).observe(document.getElementById("fx"), { childList: true, subtree: true });
    vn.vnTest.turbo = turbo; vn.vnTest.choose = () => 0;
    window.POEM_MODULE = poem;
  }, turbo);
}
const timeline = async page => (await page.evaluate(() => window.TL.slice().sort((a, b) => a.t - b.t)))
  .map(({ kind, id, seen }) => ({ token: `${kind}:${id}`, seen }));
const tokens = async page => (await timeline(page)).map(entry => entry.token).filter((token, i, all) => token !== all[i - 1]);

await suite("chapter-poems", async check => {
  await check("new-game-prologue-then-cold-open-then-ch1-poem-then-title", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => { (await import("./js/core/state.js")).newGame(); });
    await watch(page);
    await page.evaluate(async () => {
      (await import("./js/chapters/ch1.js")).startNewGame().catch(error => { window.POEM_ERROR = error.stack; });
    });
    await page.waitForFunction(() => window.TL.some(entry => entry.id === "ch1_opening") || window.POEM_ERROR, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.POEM_ERROR || null), null);
    // 序詩 → コールドオープン → 第1章の詩 → 章タイトル → スミさんの場面
    const seq = await tokens(page);
    assert.deepEqual(seq.filter(token => !token.startsWith("vn:") || ["vn:ch1_cold_open", "vn:ch1_opening"].includes(token)).slice(0, 5),
      ["poem:poem_prologue", "vn:ch1_cold_open", "poem:poem_ch1", "title:第一章", "vn:ch1_opening"]);
  });

  // 第3章は新しく入る標準の経路（出発前の準備つき）。章頭の調べもの → 第3章の詩 → 章タイトル → 準備1日目のtonari。
  await check("ch3-poem-before-title-and-prep-opening", async page => {
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
    await watch(page);
    await page.locator('[data-test="slot-0"]').click();
    await page.waitForFunction(() => window.TL.some(entry => entry.id === "ch3_prep_opening"), null, { timeout: 90000 });
    const entries = await timeline(page);
    const seq = entries.map(entry => entry.token).filter((token, i, all) => token !== all[i - 1]);
    const at = token => seq.indexOf(token);
    assert.equal(seq.filter(token => token === "poem:poem_ch3").length, 1, "第3章の詩は一度だけ");
    assert.ok(at("vn:ch3_saku_research") < at("poem:poem_ch3"), "章頭の調べものの後に詩");
    assert.ok(at("poem:poem_ch3") < at("title:第三章"), "詩は章タイトルの前");
    assert.ok(at("title:第三章") < at("vn:ch3_prep_opening"), "章タイトルの後に準備の場面");
    assert.equal(entries.find(entry => entry.token === "poem:poem_ch3").seen, false, "詩を読んでいる間は titleSeen が立たない");
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch3_intro.titleSeen), true);
  });

  await check("ch2-poem-before-title-then-departure-and-not-repeated-on-resume", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      const c = await import("./js/core/state.js");
      c.newGame(); c.state.phase = "cleared"; c.save();
    });
    await watch(page);
    await page.evaluate(async () => { await (await import("./js/chapters/ch1.js")).showClear(); });
    await page.locator('[data-test="end-chapter2"]').click();
    await page.waitForFunction(() => window.TL.some(entry => entry.id === "remake_ch2_departure"), null, { timeout: 90000 });
    // 詩 → 章タイトル → 出発の場面。詩を読んでいる間は titleSeen が立たず、章タイトルの後に立つ。
    const entries = await timeline(page);
    const seq = entries.map(entry => entry.token).filter((token, i, all) => token !== all[i - 1]);
    assert.deepEqual(seq.slice(0, 3), ["poem:poem_ch2", "title:第二章", "vn:remake_ch2_departure"]);
    assert.equal(entries[0].seen, false);
    await page.waitForFunction(() => window.__remake.state.flags._ch2_day1.titleSeen);

    // 読了済みの章の再開では、詩も章タイトルも繰り返さない。
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    await watch(page);
    await page.locator('[data-test="slot-0"]').click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".chapter-card").count(), 0, "章タイトルを繰り返さない");
    assert.equal(await page.locator(POEM).count(), 0, "詩を繰り返さない");
    assert.ok(!(await tokens(page)).some(token => token.startsWith("poem:")), "詩を繰り返さない");
  });

  // 読ませる画面そのもの: 縦書き・ふりがな・行ごとに浮かぶ・操作（タップ／Enter／Ctrl／中断）
  await check("poem-card-vertical-ruby-and-reading-controls", async page => {
    page.setDefaultTimeout(30000);
    await watch(page, { turbo: false });
    const start = (key, withOwner = false) => page.evaluate(async ([key, withOwner]) => {
      const poem = window.POEM_MODULE;
      window.OWNER = withOwner ? { controller: null } : null;
      window.RESULT = undefined;
      poem.playChapterPoem(key, withOwner ? { owner: window.OWNER, current: () => true } : {}).then(result => { window.RESULT = result; });
    }, [key, withOwner]);
    const closed = () => page.waitForFunction(() => window.RESULT !== undefined, null, { timeout: 8000 });

    // 1) 見た目: 縦書き・ふりがな（空洞《ホロウ》）・行ごとに浮かぶ
    await start(2);
    await page.locator(`${POEM}[data-poem="poem_ch2"]`).waitFor();
    assert.equal(await page.locator(`${POEM} .cp-body`).evaluate(node => getComputedStyle(node).writingMode), "vertical-rl");
    assert.equal(await page.locator(`${POEM} .cp-line`).count(), 5);
    assert.deepEqual(await page.locator(`${POEM} .cp-line rt`).allTextContents(), ["ホロウ"]);
    assert.equal(await page.locator(`${POEM} .cp-line.gap`).count(), 1, "連の切れ目は1つ（2連）");
    assert.ok(await page.locator(`${POEM} .cp-line.on`).count() < 5, "最初から全行は出ていない（行ごとに浮かぶ）");
    // タップ: まだ読み終えていなければ全行を出す（閉じない）
    await page.waitForTimeout(900);
    await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.querySelectorAll('[data-test="chapter-poem"] .cp-line.on').length === 5);
    assert.equal(await page.evaluate(() => window.RESULT), undefined, "全行を出しても閉じない");
    // 読み終えた段（holding）で、もう一度タップすると閉じる。直後の誤タップでは閉じない。
    await page.waitForFunction(() => document.querySelector('[data-test="chapter-poem"]')?.dataset.phase === "holding");
    await page.mouse.click(640, 360);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.RESULT), undefined, "切り替え直後のタップは無視する");
    await page.waitForTimeout(300);
    await page.mouse.click(640, 360);
    await closed();
    assert.equal(await page.evaluate(() => window.RESULT), true);
    assert.equal(await page.locator(POEM).count(), 0, "閉じたらカードを残さない");

    // 2) Enter で同じ（全行 → 閉じる）
    await start("prologue");
    await page.locator(`${POEM}[data-poem="poem_prologue"]`).waitFor();
    await page.waitForTimeout(900);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector('[data-test="chapter-poem"]')?.dataset.phase === "holding");
    await page.waitForTimeout(400);
    await page.keyboard.press("Enter");
    await closed();
    assert.equal(await page.evaluate(() => window.RESULT), true);

    // 3) Control（SKIP）で一気に閉じる
    await start(4);
    await page.locator(`${POEM}[data-poem="poem_ch4"]`).waitFor();
    await page.keyboard.press("Control");
    await closed();
    assert.equal(await page.evaluate(() => window.RESULT), true);
    assert.equal(await page.locator(POEM).count(), 0);

    // 4) 章の離脱（owner.controller の abort）で止まり、読了にしない
    await start(5, true);
    await page.locator(`${POEM}[data-poem="poem_ch5"]`).waitFor();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.OWNER.controller.abort());
    await closed();
    assert.equal(await page.evaluate(() => window.RESULT), false, "中断は読了にしない");
    assert.equal(await page.locator(POEM).count(), 0);
    assert.equal(await page.evaluate(() => window.OWNER.controller), null, "controller を残さない");

    // 5) 自動で閉じる（放置でも詰まらない）: 読み終えた後、字数に応じた時間で閉じる
    await start(1);
    await page.locator(`${POEM}[data-poem="poem_ch1"]`).waitFor();
    await page.waitForFunction(() => window.RESULT !== undefined, null, { timeout: 25000 });
    assert.equal(await page.evaluate(() => window.RESULT), true);
  });

  await check("poem-card-reduced-motion-shows-all-lines-at-once", async page => {
    page.setDefaultTimeout(30000);
    await watch(page, { turbo: false });
    await page.evaluate(async () => { window.POEM_MODULE.playChapterPoem(3).then(result => { window.RESULT = result; }); });
    await page.locator(`${POEM}[data-poem="poem_ch3"]`).waitFor();
    // 動き軽減では行ごとの演出をせず、全行を最初から出す（フェードだけ）
    await page.waitForFunction(() => document.querySelectorAll('[data-test="chapter-poem"] .cp-line.on').length === 6, null, { timeout: 3000 });
    assert.deepEqual(await page.locator(`${POEM} .cp-line rt`).allTextContents(), ["スモーク", "ミラー"]);
    await page.keyboard.press("Control");
    await page.waitForFunction(() => window.RESULT === true);
  }, { reducedMotion: "reduce" });
});
