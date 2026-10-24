// 冒頭の実セーブを途中で読み直し、選んだ練習と必須の接客を完了してから日常へ進む。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, { load = false, choice = "skip", auto = "good", pauseAt = null, pauseText = null } = {}) {
  page.setDefaultTimeout(60000);
  await page.evaluate(async options => {
    const core = await import("./js/core/state.js");
    const ch1 = await import("./js/chapters/ch1.js");
    const vn = await import("./js/vn/engine.js");
    const craft = await import("./js/craft/session.js");
    if (options.load) core.load(); else core.newGame();
    vn.vnTest.turbo = true;
    craft.craftTest.auto = options.auto;
    window.O = { core, ch1, vn, craft, entries: [], choices: [], error: null, paused: false };
    vn.vnTest.choose = (id, labels) => {
      if (id !== "remake_tutorial_offer") return 0;
      O.choices.push(labels);
      return labels.indexOf("一台作る");
    };
    vn.hooks.onLine = (id, line) => {
      if (O.entries.at(-1) !== id) O.entries.push(id);
      if (!O.paused && id === options.pauseAt && (!options.pauseText || line.text?.includes(options.pauseText))) {
        O.paused = true;
        vn.vnTest.turbo = false;
      }
    };
    O.run = kind => {
      (kind === "new" ? ch1.startNewGame() : ch1.resumeGame()).catch(error => O.error = error.stack);
    };
    O.snapshot = () => ({ state: JSON.parse(JSON.stringify(core.state)), entries: O.entries,
      choices: O.choices, error: O.error,
      saved: JSON.parse(localStorage.getItem(core.SAVE_KEY)) });
  }, { load, choice, auto, pauseAt, pauseText });
}

async function reloadAndResume(page, options = {}) {
  await page.reload();
  await page.locator('[data-test="title-new"]').waitFor();
  await setup(page, { ...options, load: true });
  await page.evaluate(() => O.run("resume"));
}

async function daily(page) {
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 90000 });
  const result = await page.evaluate(() => O.snapshot());
  assert.equal(result.error, null);
  assert.equal(result.state.phase, "daily");
  assert.equal(result.state.flags._ch1_opening.oneesanDone, true);
  assert.equal(result.saved.phase, "daily");
  assert.equal(result.saved.flags._ch1_opening.oneesanDone, true);
  return result;
}

function practiceCount(state) {
  return (state.flags._craft_practice_runs || []).filter(run => run.kind === "tutorial").length;
}

function resources(state) {
  return { day: state.day, slot: state.slot, money: state.money, stamina: state.stamina,
    stats: state.stats, statXp: state.statXp, flavorStock: state.flavorStock, owned: state.owned };
}

await suite("ch1-opening-resume", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();

  await check("new-game-first-scene-save-replays-opening", async page => {
    await setup(page, { pauseAt: "ch1_cold_open" });
    await page.evaluate(() => O.run("new"));
    await page.waitForFunction(() => O.paused);
    const interrupted = await page.evaluate(() => O.snapshot());
    assert.equal(interrupted.saved.phase, "opening");
    assert.deepEqual(interrupted.saved.flags._ch1_opening, {});
    await reloadAndResume(page);
    const result = await daily(page);
    assert(result.entries.includes("ch1_cold_open"));
    assert(result.entries.includes("ch1_opening"));
    assert(result.entries.includes("ch1_tutorial_oneesan"));
    assert.equal(result.state.flags._ch1_opening.introDone, true);
    assert.equal(practiceCount(result.state), 1);
  });

  await check("new-game-mandatory-craft-and-daily-reload", async page => {
    await setup(page);
    await page.evaluate(() => O.run("new"));
    const finished = await daily(page);
    const entries = finished.entries;
    for (const id of ["ch1_cold_open", "ch1_opening", "ch1_tsumugi_research", "ch1_tsumugi_departure",
      "remake_tutorial_offer", "ch1_tutorial_oneesan"]) assert(entries.includes(id), id);
    assert(entries.indexOf("ch1_tsumugi_research") < entries.indexOf("ch1_tutorial_oneesan"));
    assert(entries.includes("remake_tutorial_intro"));
    assert(!finished.state.flags._tutorial_skipped);
    assert.equal(practiceCount(finished.state), 1);
    await reloadAndResume(page);
    const reloaded = await daily(page);
    assert(!reloaded.entries.includes("ch1_tutorial_oneesan"));
    assert(!reloaded.entries.includes("remake_tutorial_offer"));
    assert.deepEqual(resources(reloaded.state), resources(finished.state));
  });

  await check("legacy-opening-before-tutorial-choice", async page => {
    await setup(page);
    await page.evaluate(() => {
      O.core.state.schema = 5;
      O.core.state.flags._qa_preserved = true;
      O.core.saveToSlot("suien_remake_slot1");
      O.core.loadFromSlot("suien_remake_slot1");
      O.run("resume");
    });
    const result = await daily(page);
    assert(result.state.flags._qa_preserved);
    assert(!result.entries.includes("ch1_cold_open") && !result.entries.includes("ch1_opening"));
    assert(result.entries.includes("ch1_tsumugi_research"));
    assert(result.entries.includes("remake_tutorial_offer"));
    assert(result.entries.includes("ch1_tutorial_oneesan"));
    assert.equal(result.choices.length, 0, "旧セーブの再開も一択メニューを挟まない");
    assert(!result.state.flags._tutorial_skipped);
    assert.equal(practiceCount(result.state), 1);
  });

  await check("legacy-unfinished-skip-resumes-required-lesson", async page => {
    await setup(page);
    await page.evaluate(() => {
      Object.assign(O.core.state.flags, { _tutorial_skipped: true, _tsumugi_contest_research: true,
        _ch1_opening: { introDone: true, departureDone: true, firstOrderDone: true,
          offerDone: true, tutorialChoice: "skip" } });
      O.core.save(); O.run("resume");
    });
    const result = await daily(page);
    assert(!result.state.flags._tutorial_skipped);
    assert.equal(result.state.flags._ch1_opening.tutorialChoice, "practice");
    assert.equal(practiceCount(result.state), 1);
    assert.deepEqual(result.choices, [], "手順のおさらいへ一択メニューを挟まず進む");
    assert(result.state.flags._ch1_opening.firstBrew.guided);
  });

  for (const choice of ["practice"]) {
    await check(`interrupted-offer-${choice}-replays-before-lesson`, async page => {
      await setup(page, { choice, pauseAt: "remake_tutorial_offer",
        pauseText: choice === "practice" ? "お願いします" : "今日はこのまま" });
      await page.evaluate(() => O.run("new"));
      await page.waitForFunction(() => O.paused);
      const interrupted = await page.evaluate(() => O.snapshot());
      assert.equal(interrupted.saved.phase, "opening");
      assert(!interrupted.saved.flags._ch1_opening.firstBrew, "おさらい未完の保存から再開する");
      assert(!interrupted.saved.flags._ch1_opening.offerDone);
      // 再開後の自動選択を反対にしても、保存した方針を守る。
      await reloadAndResume(page, { choice: choice === "skip" ? "practice" : "skip" });
      const result = await daily(page);
      assert.equal(result.choices.length, 0);
      assert.equal(result.state.flags._ch1_opening.tutorialChoice, choice);
      assert.equal(practiceCount(result.state), 1);
      assert.equal(result.entries.filter(id => id === "ch1_tutorial_oneesan").length, 1);
      assert.equal(result.entries.includes("remake_tutorial_result"), choice === "practice");
      assert.deepEqual(resources(result.state), resources(interrupted.saved));
    });
  }

  await check("interrupted-first-craft-restarts-and-completes", async page => {
    await setup(page, { choice: "practice", auto: null });
    await page.evaluate(() => O.run("new"));
    await page.locator('[data-test="mix-ok"]').waitFor();
    const interrupted = await page.evaluate(() => O.snapshot());
    assert.equal(interrupted.saved.phase, "opening");
    assert.equal(interrupted.saved.flags._ch1_opening.tutorialChoice, "practice");
    assert.equal(interrupted.saved.flags._ch1_opening.offerDone, true);
    assert(!interrupted.saved.flags._tutorial_done);
    assert.equal(practiceCount(interrupted.saved), 0);
    await reloadAndResume(page);
    const result = await daily(page);
    assert.equal(result.choices.length, 0);
    assert(result.entries.includes("remake_tutorial_intro"));
    assert(result.entries.includes("remake_tutorial_result"));
    assert(result.entries.includes("ch1_tutorial_oneesan"));
    assert.equal(practiceCount(result.state), 1);
    assert.deepEqual(resources(result.state), resources(interrupted.saved));
  });

  for (const [device, options] of [["pc", {}], ["touch", {
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  }]]) {
    await check(`interrupted-heat-after-one-pick-${device}`, async page => {
      await setup(page, { choice: "practice" });
      // 前工程は既存autoで通し、炭のカウントダウンから実入力へ切り替える。
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('.bench[data-step="heat"]')) {
            O.craft.craftTest.auto = null;
            observer.disconnect();
          }
        });
        observer.observe(document.getElementById("screen"), { subtree: true, attributes: true, childList: true });
        O.run("new");
      });
      await page.waitForFunction(() => document.querySelector('.heat')?.getAttribute('aria-busy') === "false",
        null, { timeout: 90000 });
      const first = page.locator('[data-test="coal-0"]');
      if (device === "touch") await first.tap(); else await first.click();
      assert.equal(await page.locator('[data-test="coal-count"]').textContent(), "1 / 3");
      const interrupted = await page.evaluate(() => O.snapshot());
      assert.equal(interrupted.saved.phase, "opening");
      assert.equal(interrupted.saved.flags._ch1_opening.tutorialChoice, "practice");
      assert(!interrupted.saved.flags._tutorial_done);
      assert.equal(practiceCount(interrupted.saved), 0);
      await reloadAndResume(page);
      const result = await daily(page);
      assert.equal(result.choices.length, 0);
      assert.equal(result.entries.filter(id => id === "remake_tutorial_result").length, 1);
      assert.equal(practiceCount(result.state), 1);
      assert.deepEqual(resources(result.state), resources(interrupted.saved));
      assert.equal(await page.locator(".stove, .craft-loading").count(), 0);
    }, options);
  }

  await check("completed-craft-unread-result-is-resumed-once", async page => {
    await setup(page, { choice: "practice", pauseAt: "remake_tutorial_result" });
    await page.evaluate(() => O.run("new"));
    await page.waitForFunction(() => O.paused, null, { timeout: 90000 });
    const interrupted = await page.evaluate(() => O.snapshot());
    assert.equal(interrupted.saved.flags._tutorial_done, true);
    assert.equal(practiceCount(interrupted.saved), 1);
    assert(!interrupted.saved.flags._ch1_opening.tutorialResultRead);
    // 自動制作を無効にする。制作を再び開いていたら接客まで到達しない。
    await reloadAndResume(page, { auto: null });
    const result = await daily(page);
    assert(!result.entries.includes("remake_tutorial_intro"));
    assert.equal(result.entries.filter(id => id === "remake_tutorial_result").length, 1);
    assert.equal(result.state.flags._ch1_opening.tutorialResultRead, true);
    assert.equal(practiceCount(result.state), 1);
    assert.deepEqual(resources(result.state), resources(interrupted.saved));
  });

  await check("interrupted-service-is-required-after-lesson", async page => {
    await setup(page, { pauseAt: "ch1_tutorial_oneesan" });
    await page.evaluate(() => O.run("new"));
    await page.waitForFunction(() => O.paused);
    const interrupted = await page.evaluate(() => O.snapshot());
    assert.equal(interrupted.saved.phase, "opening");
    assert.equal(interrupted.saved.flags._tutorial_done, true);
    assert(!interrupted.saved.flags._ch1_opening.oneesanDone);
    await reloadAndResume(page, { choice: "practice", auto: null });
    const result = await daily(page);
    assert.deepEqual(result.entries.filter(id => /tutorial|tsumugi_departure/.test(id)), ["ch1_tutorial_oneesan"]);
    assert.equal(result.choices.length, 0);
    assert.equal(practiceCount(result.state), 1);
    assert.equal(result.state.flags._oneesan_id_checked, true);
    assert.deepEqual(resources(result.state), resources(interrupted.saved));
  });

  await check("legacy-completed-lesson-preserves-practice-record", async page => {
    await setup(page, { auto: null });
    await page.evaluate(() => {
      Object.assign(O.core.state.flags, { _tutorial_requested: true, _tutorial_done: true,
        _tsumugi_contest_research: true,
        _craft_practice_runs: [{ day: 1, kind: "tutorial", success: true, mix: { double_apple: 10, mint: 2 }, adjustments: 0 }] });
      O.core.save();
    });
    await reloadAndResume(page, { auto: null });
    const result = await daily(page);
    assert(!result.entries.includes("remake_tutorial_intro"));
    assert(result.entries.includes("remake_tutorial_result"));
    assert(result.entries.includes("ch1_tutorial_oneesan"));
    assert.equal(practiceCount(result.state), 1);
    assert.equal(result.choices.length, 0);
  });
});
