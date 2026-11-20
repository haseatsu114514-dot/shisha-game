// シーシャ作りの版（CRN16）: 桜井版はリニューアル前の作業台、リニューアルは新しい作業台で動くこと。
// 試遊ページ（craft-preview.html）の ?craft= で版を選ぶ。本編の設定の切替と大会の審査は ch1_vote_style.mjs。
import assert from "node:assert/strict";
import path from "node:path";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const preview = (query) => new URL(`craft-preview.html?${query}`, baseURL).href;
const LONG = 120000;

/** カウントダウンの文字と、版で分かれる部品が一度でも出たかを記録する（自動操作の速い工程でも取りこぼさない） */
function watchCraft() {
  window.__seen = { countdown: [], destination: false, arc: false, focus: false, readyCue: false, callout: false, attack: false, grades: [], attackResults: [] };
  const look = () => {
    const seen = window.__seen, cd = document.querySelector(".countdown");
    if (cd && seen.countdown[seen.countdown.length - 1] !== cd.textContent) seen.countdown.push(cd.textContent);
    if (!cd && seen.countdown.length && seen.countdown[seen.countdown.length - 1] !== "|") seen.countdown.push("|");
    seen.destination ||= !!document.querySelector('[data-test="pull-destination"]');
    seen.arc ||= !!document.querySelector(".pg-draw-arc");
    seen.focus ||= !!document.querySelector('[data-test="pull-focus"]');
    seen.readyCue ||= !!document.querySelector(".coal.ready-cue");
    seen.callout ||= !!document.querySelector(".foil-target-plane > .stamp");
    seen.attack ||= !!document.querySelector('[data-test="attack-band"]');
    const grade = document.querySelector(".craft-rank")?.dataset.grade;
    if (grade && seen.grades.at(-1) !== grade) seen.grades.push(grade);
    const result = document.querySelector(".rc-summary")?.textContent;
    if (result?.includes("攻めの帯") && seen.attackResults.at(-1) !== result) seen.attackResults.push(result);
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
}
const autoGood = (page) => page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
const seen = (page) => page.evaluate(() => structuredClone(window.__seen));
const rankText = (page) => page.locator(".bench-top > .craft-rank").textContent();
/** 同じ作業台でもう一度カウントダウンを回し、出た文字を返す（2回目の短縮はリニューアルだけ） */
const secondCountdown = (page) => page.evaluate(async () => {
  window.__seen.countdown = [];
  await (await import("./js/core/ui.js")).countdown();
  return window.__seen.countdown.filter((text) => text !== "|").join(" ");
});

await suite("craft-version", async (check) => {
  await check("all-game-session-entries-and-old-save", async (page) => {
    const evidence = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), sessions = await import("./js/craft/session.js");
      const { newCarePracticeSession } = await import("./js/craft/practice.js");
      const { attackGuide } = await import("./js/craft/attack-band.js");
      core.newGame(); core.config.craftVersion = "renewal"; core.saveConfig(); core.save(); core.load();
      const rows = [], before = JSON.stringify(core.state.flags);
      for (const chapter of [1, 2, 3, 4, 5]) {
        core.state.chapter = chapter;
        for (const mode of ["tutorial", "drill", "rehearsal", "tournament"]) {
          const cs = sessions.newSession(mode);
          rows.push({ chapter, mode, version: cs.craftVersion, attack: attackGuide(cs) });
          core.config.craftVersion = "sakurai";
          if (cs.craftVersion !== rows.at(-1).version) throw new Error("Running session changed with config");
          core.config.craftVersion = "renewal";
        }
      }
      return { rows, care: newCarePracticeSession().craftVersion, flagsUnchanged: before === JSON.stringify(core.state.flags),
        config: core.config.craftVersion, schema: core.SCHEMA };
    });
    for (const { chapter, mode, version, attack } of evidence.rows) {
      const protectedMatch = chapter === 1 && mode === "tournament";
      assert.equal(version, protectedMatch ? "renewal" : "sakurai", `${chapter}/${mode}`);
      assert.equal(attack, !protectedMatch, `${chapter}/${mode} attack`);
    }
    assert.equal(evidence.care, "sakurai");
    assert.equal(evidence.flagsUnchanged, true);
    assert.equal(evidence.config, "renewal", "旧設定は保存したまま、通常制作にだけ桜井版を使う");
    assert.equal(evidence.schema, 29);
  }, { pageEntry: `${baseURL}?craft=renewal&vote=classic` });

  await check("resume-serialized-bench-keeps-recorded-scores", async (page) => {
    const rows = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { newSession, openBench, waitBenchReady } = await import("./js/craft/session.js");
      core.newGame();
      const rows = [];
      for (const chapter of [1, 2, 3, 4]) for (const version of [null, "renewal", "sakurai"]) {
        core.state.chapter = chapter;
        const cs = newSession("tournament");
        if (version) cs.craftVersion = version;
        else delete cs.craftVersion;
        cs.holes = { score: 73 }; cs.heat = { score: 81 };
        cs.careHistory = [{ score: 67, temp: .6 }];
        const resumed = JSON.parse(JSON.stringify(cs));
        const before = JSON.stringify(resumed);
        openBench(resumed);
        await waitBenchReady(resumed);
        const expected = JSON.parse(before);
        if (chapter !== 1) expected.craftVersion = "sakurai";
        rows.push({ chapter, version, saved: resumed, expected,
          benchVersion: document.querySelector(".bench:not(.done)").dataset.craftVersion });
      }
      return rows;
    });
    for (const row of rows) {
      assert.deepEqual(row.saved, row.expected, `saved scores: ${row.chapter}/${row.version}`);
      assert.equal(row.benchVersion, row.chapter === 1 ? row.version || "renewal" : "sakurai");
    }
  });

  for (const touch of [false, true]) await check(`tutorial-unified-${touch ? "touch" : "pc"}`, async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), chapter = await import("./js/chapters/ch1.js");
      core.newGame(); core.config.craftVersion = "renewal";
      window.__remake.vnTest.turbo = true;
      window.__remake.craftTest.auto = "good";
      window.__remake.craftTest.aim = "attack";
      window.tutorialRun = chapter.devTutorial();
    });
    await page.locator(t("attack-band")).waitFor({ timeout: LONG });
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    assert.notEqual(await page.locator(".craft-rank").getAttribute("data-grade"), "unavailable");
    const fits = await page.locator(".craft-rank").evaluate(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    });
    assert(fits, "大会と同じランクがPC・横持ち画面内に収まる");
    await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser", `3795-tutorial-${touch ? "touch" : "pc"}.png`) });
    await page.evaluate(() => window.tutorialRun);
    assert.equal(await page.evaluate(() => window.__remake.state.flags._tutorial_done), true);
    const s = await seen(page);
    assert.equal(s.grades[0], "unavailable");
    assert(s.grades.some(grade => grade !== "unavailable"));
    assert(s.attack);
    assert(s.attackResults.length > 0, "攻めの帯で完了した結果を表示する");
    assert(s.attackResults.every(text => !text.includes("審査 +") && text.includes("温度の評価は満点")), "大会以外で投票加点を約束しない");
    assert(!s.destination && !s.arc && !s.focus && !s.readyCue);
    assert.equal(await page.locator(".craft-rank").count(), 0, "レッスン後はランクも片付く");
  }, { pageEntry: `${baseURL}?craft=renewal`, ...(touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {}) });

  await check("sakurai-holes-before-renewal", async (page) => {
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    assert.match(await rankText(page), /未計測/, "桜井版の暫定ランクは、はじめ「—」（工程を終えた平均）");
    await page.locator(t("hole-start")).click();
    await page.locator(t("hole-punch")).waitFor();
    // リニューアル前の「次のリングへ」「穴あけを終えて結果へ」のボタンがあり、はじめは押せない
    assert.equal(await page.locator(t("hole-next")).isDisabled(), true);
    assert.equal(await page.locator(t("hole-done")).isDisabled(), true);
    await page.waitForFunction(() => !document.querySelector(".countdown"));
    assert.deepEqual((await seen(page)).countdown.slice(0, 4), ["3", "2", "1", "GO!"]);
    assert.equal(await secondCountdown(page), "3 2 1 GO!", "同じ作業台の2回目も 3・2・1（リニューアルは GO! だけ）");
  }, { pageEntry: preview("step=holes&mode=rehearsal&craft=sakurai"), pageReadySelector: t("hole-start") });

  await check("renewal-holes", async (page) => {
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "renewal");
    assert.match(await rankText(page), /制作ランク D/, "リニューアルの暫定ランクは、はじめD");
    await page.locator(t("hole-start")).click();
    await page.locator(t("hole-punch")).waitFor();
    assert.equal(await page.locator(t("hole-next")).count(), 0, "リングが埋まると自動で次へ進む（ボタンは無い）");
    assert.equal(await page.locator(t("hole-done")).count(), 0);
    await page.waitForFunction(() => !document.querySelector(".countdown"));
    assert.equal(await secondCountdown(page), "GO!", "同じ作業台の2回目は GO! だけ");
  }, { pageEntry: preview("step=holes&mode=rehearsal&craft=renewal"), pageReadySelector: t("hole-start") });

  await check("sakurai-lesson-demo-is-the-old-recording", async (page) => {
    const src = await page.locator(".bench-demo-sheet video").getAttribute("src");
    assert.match(src, /demo-holes-classic\.mp4$/, "桜井版のお手本は「次のリングへ」を押す前の画面の映像");
    await page.locator(".bench-demo-skip").click();
    await page.locator(t("hole-start")).waitFor();
  }, { pageEntry: preview("step=holes&mode=tutorial&craft=sakurai"), pageReadySelector: ".bench-demo-sheet",
    ignoreFailedResource: (failure) => /\.mp4/.test(failure) });

  await check("sakurai-steam-and-pull-before-renewal", async (page) => {
    await autoGood(page);
    await page.waitForFunction(() => globalThis.__craftPreview?.done, null, { timeout: LONG, polling: 250 });
    const s = await seen(page);
    assert.equal(s.destination, false, "針の札の「止めると →」はリニューアルだけ");
    assert.equal(s.arc, false, "吸っている間の弧はリニューアルだけ");
    assert.equal(s.focus, false, "集中の札はリニューアルだけ");
  }, { pageEntry: preview("step=pull&mode=rehearsal&craft=sakurai"), pageReadySelector: ".bench" });

  await check("renewal-steam-and-pull", async (page) => {
    await autoGood(page);
    await page.waitForFunction(() => globalThis.__craftPreview?.done, null, { timeout: LONG, polling: 250 });
    const s = await seen(page);
    assert.equal(s.destination, true, "針の札に行き先が出る");
    assert.equal(s.arc, true, "吸っている間の弧がある");
  }, { pageEntry: preview("step=pull&mode=rehearsal&craft=renewal"), pageReadySelector: ".bench" });
}, { initScript: watchCraft });
