// 章末予告の一般化テスト（DESIGN 7-5）。登録表 PREVIEWS の全項目へ同じ確認を回す。
// 第1章予告の詳細検証（サンプル比較・旧セーブ復帰・中断の後片付け）は ch1_preview.mjs が担い、
// ここでは「登録された予告はどれも同じ品質で再生でき、本編の保存を変えない」ことを保証する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// 登録表は台本チェック（remake/test/chapter_preview_scripts.mjs）と同じ読み方で解析する。
const playerSource = fs.readFileSync(path.join(ROOT, "remake/js/chapters/chapter-preview.js"), "utf8");
const previewsBlock = playerSource.slice(playerSource.indexOf("export const PREVIEWS"));
const entries = [...previewsBlock.matchAll(/\n {2}(\w+): \{([\s\S]*?)\n {2}\},/g)].map(([, key, block]) => ({
  key,
  scriptUrl: block.match(/scriptUrl: "([^"]+)"/)[1],
  aria: block.match(/aria: "([^"]+)"/)[1],
  cue: /kind: "cue"/.test(block),
}));
assert(entries.length >= 2, "PREVIEWS に複数件の登録が要る");
for (const entry of entries) {
  const scriptPath = path.posix.normalize(path.posix.join("remake", entry.scriptUrl));
  entry.script = JSON.parse(fs.readFileSync(path.join(ROOT, scriptPath), "utf8"));
  entry.frameIds = entry.script.frames.map(f => f.id);
  entry.arts = entry.script.frames.filter(f => f.art).map(f => `${f.art}.webp`);
}

const preview = '[data-test="chapter-preview"]';
const playing = page => page.locator(`${preview}[data-phase="playing"]`).waitFor({ timeout: 30000 });

async function setupSave(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { phase: "daily", day: 14, money: 54321 });
    state.flags._preview_save_sentinel = "keep";
    core.save();
    localStorage.setItem("suien_remake_slot1", JSON.stringify({ chapter: 1, day: 7, marker: "untouched manual slot" }));
  });
}

function confirmPageCheck(entry) {
  return async page => {
    await setupSave(page);
    const before = await storageSnapshot(page);
    await page.goto(new URL(`chapter-preview.html?ch=${entry.key}`, page.url()).href);
    await page.locator('[data-test="preview-start"]').click();
    await playing(page);
    assert.equal(await page.locator(preview).getAttribute("aria-label"), entry.aria,
      "確認ページが別の予告を再生した");
    await assertFits(page, '[data-test="preview-screen"], [data-test="preview-skip"], [data-test="preview-pause"], [data-test="preview-sound"]');
    // 最初の画像カットは、その章の素材が採用寸法（1664×936）のまま表示される。
    const art = page.locator(`${preview} .preview-art`);
    await art.waitFor({ timeout: 30000 });
    const visual = await art.evaluate(node => ({ file: node.src.split("/").at(-1),
      width: node.naturalWidth, height: node.naturalHeight, complete: node.complete }));
    assert(visual.complete && entry.arts.includes(visual.file), `Unexpected preview art: ${JSON.stringify(visual)}`);
    assert.equal(visual.width, 1664);
    assert.equal(visual.height, 936);
    // 一時停止で時計が止まり、音ボタンが切り替わる。
    await page.locator('[data-test="preview-pause"]').click();
    await page.locator(`${preview}[data-phase="paused"]`).waitFor();
    const stopped = await page.locator(preview).getAttribute("data-elapsed");
    await page.waitForTimeout(250);
    assert.equal(await page.locator(preview).getAttribute("data-elapsed"), stopped);
    const sound = page.locator('[data-test="preview-sound"]');
    const soundBefore = await sound.getAttribute("aria-pressed");
    await sound.click();
    assert.notEqual(await sound.getAttribute("aria-pressed"), soundBefore, "Sound control did not toggle");
    await page.locator('[data-test="preview-pause"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    await page.locator('[data-test="preview-ended"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), before, "確認ページの再生が本編の保存を変えた");
  };
}

await suite("chapter-preview", async check => {
  for (const entry of entries) await check(`confirm-page-${entry.key}`, confirmPageCheck(entry));
  const firstCue = entries.find(entry => entry.cue);
  if (firstCue) await check(`confirm-page-${firstCue.key}-touch`, confirmPageCheck(firstCue),
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  // cue 駆動の予告は、仮想時計で最後まで進めても台本のカット順どおりに完走する。
  for (const entry of entries.filter(entry => entry.cue)) {
    await check(`runs-to-completion-${entry.key}`, async page => {
      await setupSave(page);
      const before = await storageSnapshot(page);
      await page.clock.install();
      await page.evaluate(async key => {
        window.P = { preview: await import("./js/chapters/chapter-preview.js") };
        P.cuts = [];
        P.observer = new MutationObserver(() => {
          const root = document.querySelector('[data-test="chapter-preview"]');
          const cut = root?.dataset.cut;
          if (cut && cut !== P.cuts.at(-1)) P.cuts.push(cut);
        });
        P.observer.observe(document.getElementById("stage"), { subtree: true, attributes: true, childList: true });
        P.done = false; P.result = null;
        P.running = P.preview.playChapterPreview(key)
          .then(result => { P.result = result; P.done = true; });
      }, entry.key);
      await playing(page);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
      await page.clock.runFor(entry.script.duration + 5000);
      await page.waitForFunction(() => P.done);
      assert.equal(await page.evaluate(() => P.result), "completed");
      assert.deepEqual(await page.evaluate(() => P.cuts), entry.frameIds, "完走時のカット順が台本と違う");
      assert.deepEqual(await storageSnapshot(page), before, "予告の完走が本編の保存を変えた");
    });
  }

  // 第2章の完了カード（予告1の接続点）: 未視聴なら自動再生、再生中は次章ボタンが押せず、
  // スキップで既読が保存され、再開時は自動再生しない。再視聴はボタンからのみ。
  if (entries.some(entry => entry.key === "ch3")) await check("ch2-complete-card-autoplay-flag-and-rewatch", async page => {
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
      for (const who of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "nagumo", "hajime", "sumi"])
        s.flags[`_intro_${who}`] = true;
      (await import("./js/chapters/ch2-tournament-state.js")).tournamentProgress(s).stage = "complete";
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save();
      const vn = await import("./js/vn/engine.js");
      (await import("./js/chapters/ch1.js")).setupHooks();
      vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
    });
    const complete = page.locator('[data-test="ch2-tournament-complete"]');
    await complete.waitFor();
    await playing(page);
    assert.equal(await page.locator(preview).getAttribute("aria-label"), "第2章の終わりと第3章の次回予告");
    assert(await page.locator('[data-test="ch2-tournament-chapter-three"]').isDisabled(),
      "再生中に「第三章・東京へ」が押せてしまう");
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_preview_seen), true,
      "スキップしても既読が保存されない");
    assert.equal(await page.evaluate(async () =>
      (await import("./js/core/state.js")).peekSave().flags._ch2_preview_seen), true,
      "既読がセーブへ保存されない");
    assert(!(await page.locator('[data-test="ch2-tournament-chapter-three"]').isDisabled()));
    await page.locator('[data-test="ch2-tournament-complete-preview"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    await page.evaluate(async () => { void (await import("./js/chapters/ch2.js")).resumeChapterTwo(); });
    await complete.waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(preview).count(), 0, "既読の予告が自動再生した");
  });

  // 第3章の完了カード（予告2の接続点）: 後日談を終えたセーブを読み込むと自動再生し、
  // 再生中は第4章ボタンが押せず、スキップで既読が保存され、再視聴できる。
  if (entries.some(entry => entry.key === "ch4")) await check("ch3-complete-card-autoplay-flag-and-rewatch", async page => {
    page.setDefaultTimeout(60000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 3, day: 128, slot: 1, phase: "cleared", money: 23456, stamina: 100,
        flavorStock: { double_apple: 40, mint: 12 }, lovers: ["minto"], contacts: ["sumi", "minto"] });
      s.flags._elapsed_calendar = true; s.flags._ageha_mastery = true;
      s.flags._ch2_cleared = true; s.flags._ch3_cleared = true;
      s.flags._ch3_tournament_won = true;
      s.flags._ch3_tournament = { startDay: 113, stage: "complete", result: { rank: 1, win: true } };
      s.flags._ch3_aftermath = { version: 2, winDay: 125, stage: 6 };
      s.stats = { technique: 42, sense: 42, guts: 42, charm: 42, insight: 42 };
      core.save();
    });
    await page.reload();
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    const complete = page.locator('[data-test="ch3-aftermath-complete"]');
    await complete.waitFor();
    await playing(page);
    assert.equal(await page.locator(preview).getAttribute("aria-label"), "第3章の終わりと第4章の次回予告");
    assert(await page.locator('[data-test="ch3-aftermath-chapter-four"]').isDisabled(),
      "再生中に「第4章へ進む」が押せてしまう");
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch3_preview_seen), true,
      "スキップしても既読が保存されない");
    assert.equal(await page.evaluate(async () =>
      (await import("./js/core/state.js")).peekSave().flags._ch3_preview_seen), true,
      "既読がセーブへ保存されない");
    await page.locator('[data-test="ch3-aftermath-complete-preview"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
  });

  // 第4章の完了カード（予告3の接続点）: 設計 7-4 のとおり「第5章へ進む」は予告の終了後にだけ押せる。
  // スキップで既読が保存され、再視聴の後で第5章へ進めることも確認する。
  if (entries.some(entry => entry.key === "ch5")) await check("ch4-complete-card-autoplay-flag-and-rewatch", async page => {
    page.setDefaultTimeout(60000);
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
    const complete = page.locator('[data-test="ch4-complete"]');
    await complete.waitFor();
    await playing(page);
    assert.equal(await page.locator(preview).getAttribute("aria-label"), "第4章の終わりと第5章の次回予告");
    assert(await page.locator('[data-test="ch4-chapter-five"]').isDisabled(),
      "再生中に「第5章へ進む」が押せてしまう");
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch4_preview_seen), true,
      "スキップしても既読が保存されない");
    assert.equal(await page.evaluate(async () =>
      (await import("./js/core/state.js")).peekSave().flags._ch4_preview_seen), true,
      "既読がセーブへ保存されない");
    assert(!(await page.locator('[data-test="ch4-chapter-five"]').isDisabled()),
      "予告の終了後も「第5章へ進む」が押せない");
    await page.locator('[data-test="ch4-complete-preview"]').click();
    await playing(page);
    await page.locator('[data-test="preview-skip"]').click();
    await page.locator(preview).waitFor({ state: "detached" });
  });
});
