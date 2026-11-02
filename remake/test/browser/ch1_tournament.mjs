// 一章改修の回帰: 素材待ち、初期/解放済み炭、調整2回、準備・保存、発表画面。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
import { prepareAppearanceCatalog } from "./appearance_setup.mjs";
prepareAppearanceCatalog();
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core,
      data: await import("./js/core/data.js"),
      session: await import("./js/craft/session.js"),
      steps: await import("./js/craft/steps.js"),
      heat: await import("./js/craft/heat.js"),
      pull: await import("./js/craft/pull.js"),
      score: await import("./js/craft/score.js"),
      result: await import("./js/craft/result.js"),
      broadcast: await import("./js/craft/broadcast.js"),
      preparation: await import("./js/daily/preparation.js"),
      practice: await import("./js/craft/practice.js"),
      chapter: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"),
      intro: await import("./js/vn/intro.js"),
      story: await import("./js/chapters/tsumugi-story.js"),
    };
    T.open = async (cs) => {
      const b = T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await T.session.waitBenchReady(cs);
    };
  });
}

await suite("ch1-tournament", async check => {
  for (const touch of [false, true]) await check(`completion-comments-${touch ? "touch" : "pc"}`, async page => {
    await init(page);
    await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament");
      await T.open(cs);
      T.broadcast.block(cs, "foil");
      T.session.stepPanel("holes", "穴あけ");
    });
    await page.waitForTimeout(2900);
    assert.equal(await page.locator('.nico').count(), 0, "Comments appeared during play");
    await page.evaluate(async () => {
      cs.holes = { score: 95 };
      const { resultCard } = await import("./js/craft/common.js");
      window.confirmResult = resultCard(document.querySelector(".bench-panel"), { title: "穴あけ 結果" });
    });
    await page.locator('.nico').first().waitFor();
    // 機械的な工程ラベルは廃止。先頭コメントは穴あけ工程の視聴者コメント（専用プール）から出る。
    const holesPerfect = await page.evaluate(() => T.data.DB.broadcast.completion.holes.perfect);
    assert(holesPerfect.includes(await page.locator('.nico').first().textContent()), "first comment is not a holes reaction");
    await page.locator('[data-test="step-next"]').click();
    await page.evaluate(async () => {
      await window.confirmResult;
      T.session.stepPanel("place", "炭の配置");
    });
    assert.equal(await page.locator('.nico').count(), 0, "Visible comments survived next step");
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.nico').count(), 0, "Pending comments survived next step");
    // Result reactions still match a lower score; fast AUTO-style transitions cancel all timers.
    await page.evaluate(() => {
      T.session.stepPanel("holes", "穴あけ");
      cs.holes.score = 20;
      T.session.presentBenchResult(document.querySelector(".bench-panel"), "穴あけ 結果");
    });
    const holesMiss = await page.evaluate(() => T.data.DB.broadcast.completion.holes.miss);
    assert(holesMiss.includes(await page.locator('.nico.miss').first().textContent()), "first miss comment is not a holes reaction");
    assert.equal(await page.locator('.nico:not(.miss)').count(), 0);
    await page.evaluate(() => T.session.stepPanel("heat", "炭焼き"));
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.nico').count(), 0);
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

  await check("completion-comment-variety", async page => {
    await init(page);
    const groups = await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament");
      await T.open(cs);
      const before = JSON.stringify(cs), groups = [];
      for (const step of ["holes", "heat", "steam", "pull", "care"]) {
        for (const [kind, score] of [["perfect", 95], ["great", 80], ["good", 65], ["miss", 20]]) {
          const pool = T.data.DB.broadcast.completion[step][kind];
          const seen = [];
          for (let i = 0; i < 5; i++) {
            T.broadcast.completed(cs, step, score);
            // 工程ラベルは廃止したので、先頭コメントはそのまま専用プールの一文になる。
            seen.push(document.querySelector('.nico').textContent);
          }
          groups.push({ step, kind, seen, pool });
        }
      }
      return { groups, before, after: JSON.stringify(cs) };
    });
    assert.equal(groups.after, groups.before, "Comment history changed saved craft state");
    for (const { step, kind, seen, pool } of groups.groups) {
      assert.equal(pool.length, 10, `${step}/${kind}: missing variants`);
      assert.equal(new Set(pool).size, pool.length);
      assert(seen.every(text => pool.includes(text)), `${step}/${kind}: wrong reaction`);
      assert.equal(new Set(seen).size, 5, `${step}/${kind}: recent reaction repeated`);
    }
    await page.waitForTimeout(2800);
    const visible = await page.locator('.nico').allTextContents();
    assert.equal(visible.length, 5);
    assert.equal(new Set(visible).size, 5, "Duplicate comments within one result");
    await page.evaluate(() => T.session.stepPanel("heat", "炭焼き"));
    assert.equal(await page.locator('.nico').count(), 0);
  });

  await check("delayed-assets-gate", async page => {
    await init(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/heat_flat_lit.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => {
        T.session.craftTest.auto = "good";
        window.cs = T.session.newSession("tournament");
        T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
        window.running = T.heat.runHeat(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.bench').evaluate(n => n.inert), true);
      assert.equal(await page.locator('[data-test="coal-0"]').count(), 0, "Game started before its images decoded");
      assert.equal(await page.evaluate(() => cs.heat), null);
    } finally { release(); }
    await page.evaluate(() => window.running);
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
    assert.equal(await page.locator('.bench').evaluate(n => n.inert), false);
    assert.equal(await page.evaluate(() => cs.heat.picks.length), 3);
  });

  await check("failed-image-fallback", async page => {
    await init(page);
    // 読み込み自体は成功、画像デコードは失敗。必須操作はDOMなので先に進める。
    await page.route("**/img/ui/making/heat_flat_lit.webp", route => route.fulfill({ status: 200, contentType: "image/png", body: "broken image" }));
    await page.evaluate(async () => {
      T.session.craftTest.auto = "good";
      window.cs = T.session.newSession("tournament");
      await T.open(cs); await T.heat.runHeat(cs);
    });
    assert.equal(await page.evaluate(() => cs.heat.score), 100);
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
  });

  for (const variant of ["current-unread", "current-read", "baseline-unread"]) await check(`real-vn-skip-with-delayed-tournament-art-${variant}`, async page => {
    await init(page);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/ui_craft_panel.webp", async route => { await held; await route.continue(); });
    try {
      // module初期化は画像を保留する前に完了し、本番の開始は同期で呼ぶ。
      const baselineArrival = variant === "baseline-unread" ? JSON.parse(fs.readFileSync(new URL("../../../docs/qa/issue508-theme/baseline-scenes.json", import.meta.url))).scenes.ch1_tournament_arrival : null;
      await page.evaluate(({ variant, baselineArrival }) => {
        const { chapter, vn, intro } = T;
        const { TSUMUGI_STORY } = T.story;
        const { state } = T.core;
        Object.assign(state, { phase: "tournament", day: 14, flavors: ["double_apple", "mint", "blueberry"], flavorStock: { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 } });
        for (const step of TSUMUGI_STORY) state.flags[step.flag] = true;
        if (variant === "current-read") state.flags._ev_first_practice = true;
        if (baselineArrival) T.data.DB.dialogues.ch1_tournament_arrival = baselineArrival;
        // 初登場カットインは3.6秒固定。既読セーブを想定し、会話のSKIPだけを検証する。
        for (const id of ["sumi", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"]) intro.markIntroSeen(id);
        vn.vnTest.turbo = false;
        window.openingRead = false;
        window.skipTrace = [];
        window.skipStarted = performance.now();
        vn.hooks.onLine = (id, line) => {
          skipTrace.push({ id, text: line.text, ms: Math.round(performance.now() - skipStarted) });
          if (id === "ch1_tournament_opening") openingRead = true;
        };
        window.tournamentRun = chapter.devTournament();
      }, { variant, baselineArrival });
      // 本番のSKIPボタンで各会話を送る。制作のテスト自動操作は使わない。
      const deadline = Date.now() + 15000;
      while (!(await page.evaluate(() => openingRead && !document.querySelector('#vn.active')))) {
        assert(Date.now() < deadline, `Tournament opening did not finish under SKIP: ${JSON.stringify(await page.evaluate(() => ({ elapsedMs: Math.round(performance.now() - skipStarted), trace: skipTrace })))}`);
        const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
        if (await skip.count()) await skip.click();
        await page.waitForTimeout(60);
      }
      const timing = await page.evaluate(() => ({ elapsedMs: Math.round(performance.now() - skipStarted), trace: skipTrace }));
      if (process.env.ARTIFACT_DIR) fs.writeFileSync(`${process.env.ARTIFACT_DIR}/tournament-skip-${variant}.json`, JSON.stringify(timing, null, 2) + "\n");
      console.log("Tournament SKIP measurement:", JSON.stringify({ variant, elapsedMs: timing.elapsedMs, lines: timing.trace.length }));
      // 15秒を超えると入場演出は代替表示で続行できるが、作業台の時計はまだ開始しない。
      assert.equal(await page.locator('.foil-cursor, [data-test="coal-0"], [data-test="dodge"]').count(), 0, "SKIP started a minigame before preparation");
      if (await page.locator('.bench').count()) assert.equal(await page.locator('.bench').evaluate(n => n.inert), true);
    } finally { release(); }
    const deadline = Date.now() + 15000;
    while (!(await page.locator('.bench .opt-grid, [data-test="mix-ok"]').count())) {
      assert(Date.now() < deadline, "Tournament did not resume after the image arrived");
      // 漫画の読書ホールドと水入れを本番入力で進め、機材/配合への到達を検査する。
      if (await page.locator('.loading-gate.is-ready').isVisible()) {
        await page.keyboard.press("Enter");
      }
      const water = page.locator('.bench [data-test="water-confirm"]');
      if (await water.isVisible()) {
        await water.click({ timeout: Math.max(1, deadline - Date.now()) });
      }
      const skip = page.locator('#vn.active [data-test="vn-skip"]:not(.on)');
      if (await skip.count()) await skip.click();
      await page.waitForTimeout(60);
    }
    assert.equal(await page.locator('.loading-gate').count(), 0);
    assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
    assert.equal(await page.locator('.bench').evaluate(n => n.inert), false);
  });

  await check("coals-two-care-and-comments", async page => {
    await init(page);
    await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament"); await T.open(cs);
      await T.steps.stepPlace(cs);
    });
    assert.equal(await page.locator('[data-test="opt-triangle"]').count(), 0);
    assert.equal(await page.locator('[data-test="opt-four"]').count(), 0);
    assert.equal(await page.locator('[data-test="opt-mixed"]').count(), 0);
    assert.deepEqual(await page.evaluate(() => cs.coalTypes), Array(3).fill("flat_charcoal"));
    await page.evaluate(() => {
      Object.assign(T.core.state.flags, { _coal_cube_learned: true, _coal_four_unlocked: true, _coal_mix_unlocked: true });
      T.core.state.owned.push("cube_charcoal");
      window.placement = T.steps.stepPlace(cs);
    });
    await page.locator('[data-test="opt-four"]').click();
    await page.locator('[data-test="opt-mixed"]').click();
    await page.evaluate(() => window.placement);
    assert.deepEqual(await page.evaluate(() => cs.coalTypes), ["cube_charcoal", "flat_charcoal", "flat_charcoal", "flat_charcoal"]);
    await page.evaluate(async () => {
      T.session.craftTest.auto = "good";
      await T.heat.runHeat(cs);
      cs.mix = { blueberry: 9, mint: 3 }; cs.mixInfo = T.steps.evaluateMix(cs); cs.pack = "normal"; cs.water = 0.5;
      cs.holes = { score: 95, outerEven: .95, innerExcess: 0, outer: 24, middle: 0, inner: 0 };
      cs.steam = { score: 100, seconds: 480, temp: .54 }; cs.steamSeconds = 480;
      await T.pull.runPull(cs);
      await T.pull.runCare(cs, { round: 1 });
      window.firstCare = JSON.stringify(cs.careHistory[0]);
      await T.pull.runCare(cs, { round: 2 });
      T.session.craftTest.auto = null;
      T.score.finalize(cs);
      T.broadcast.clearComments();
      T.broadcast.burst(cs, "perfect", 4);
    });
    const data = await page.evaluate(() => ({ picks: cs.heat.picks.length, history: cs.careHistory, first: firstCare,
      parts: cs.parts, arcade: cs.arcade.parts, failed: cs.failed }));
    assert.equal(data.picks, 4);
    assert.equal(data.history.length, 2);
    assert.equal(JSON.stringify(data.history[0]), data.first, "Second care overwrote first care");
    assert(Math.abs(data.history[1].startTemp - Math.max(.14, data.history[0].temp - .075)) < 1e-9);
    assert.equal(data.parts.care1, data.history[0].score);
    assert.equal(data.parts.care2, data.history[1].score);
    assert(data.arcade.care1 && data.arcade.care2);
    assert(!data.failed);
    await page.waitForTimeout(800);
    const lane = await page.locator('.bc-lane').evaluate(n => {
      const r = n.getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
      return { width: r.width / stage.width, pointer: getComputedStyle(n).pointerEvents, count: n.children.length };
    });
    assert(lane.width > .95 && lane.count > 0 && lane.count <= 4);
    assert.equal(lane.pointer, "none");
    // 工程間の矢印はセル外へ描く。ラベル自体とヘッダー全体の収まりを確認する。
    await assertFits(page, '.bench-progress, .bench-phase-copy b');
    await page.evaluate(() => { T.broadcast.clearComments(); T.broadcast.burst(cs, "perfect", 4); T.broadcast.clearComments(); });
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.nico').count(), 0, "Old comments leaked after fast transition");
  });

  await check("preparation-low-money-stock-and-save", async page => {
    await init(page);
    await page.evaluate(() => {
      T.core.state.money = 0; T.core.state.day = 7;
      T.core.state.flavorStock.lemon = 1;
      T.core.state.flavors.push("lemon");
      window.preparing = T.preparation.prepareFlavorStock();
    });
    await page.locator('[data-test="shop-leave"]').click();
    assert.equal(await page.locator('.shop').count(), 1, "Insufficient stock could leave preparation");
    await page.locator('.shop-row.errand [data-test="buy-lemon"]').click();
    await page.locator('[data-test="shop-checkout"]').click();
    await page.locator('[data-test="shop-leave"]').click();
    await page.evaluate(() => window.preparing);
    const prepared = await page.evaluate(() => ({ money: T.core.state.money, stock: T.core.state.flavorStock.lemon, flavor: T.core.state.flags._prep_flavor }));
    assert.deepEqual(prepared, { money: 0, stock: 51, flavor: "lemon" });
    await page.evaluate(async () => {
      window.cs = T.session.newSession("rehearsal"); await T.open(cs);
      window.mixing = T.steps.stepMix(cs);
    });
    await page.locator('[data-test="mix-ok"]').click();
    await page.evaluate(() => window.mixing);
    assert.deepEqual(await page.evaluate(() => cs.mix), { lemon: 10, mint: 2 });
    assert.equal(await page.evaluate(() => T.core.state.flavorStock.lemon), 51);
    await page.evaluate(async () => {
      T.session.craftTest.auto = "good";
      await T.practice.runCarePractice({ kind: "midweek" }); T.core.save();
    });
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor();
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); });
    const record = await page.evaluate(() => __remake.state.flags._craft_practice_runs.at(-1));
    assert.equal(record.day, 7); assert.equal(record.kind, "midweek");
    assert.equal(record.scope, "care"); assert.equal(record.success, true); assert.equal(record.served, false);
    assert.deepEqual(record.mix, { lemon: 10, mint: 2 }); assert.equal(record.adjustments, 2);
    assert.deepEqual(record.scores, {}); assert.equal(record.careScores.length, 2);
  });

  for (const [label, viewport, mobile] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["landscape", { width: 844, height: 390 }, true],
    ["portrait", { width: 390, height: 844 }, true],
  ]) await check(`results-${label}`, async page => {
    await init(page);
    await page.evaluate(() => {
      ["naru", "adam", "minto", "nagumo", "maezono", "dr_kemuri"].forEach(T.core.markMet);
      window.cs = { mix: { blueberry: 10, mint: 2 }, total: 84.4, parts: { holes: 95, heat: 100, shisha: 78, care1: 86, care2: 91 }, arcade: { total: 92340 }, bonusNotes: ["前日リハーサルの手応え"] };
    });
    if (label === "desktop") {
      await page.evaluate(() => { window.countdown = T.result.resultCountdown(cs, "premium"); });
      await page.locator('[data-test="result-count"]').waitFor();
      await assertFits(page, '.count-screen .tournament-heading, .rc-ring, .rc-pray, .rc-card');
      await capture(page, "result-count");
      await page.evaluate(async () => { await countdown; (await import("./js/core/ui.js")).retireScreen(); });
    }
    await page.evaluate(() => {
      window.standingsDone = false;
      window.standings = T.result.showStandings(3, 88).then(() => { window.standingsDone = true; });
    });
    await page.locator('[data-test="standings"].show').waitFor();
    await assertFits(page, '.standings, .sd-row, .sd-status, [data-test="standings-next"]');
    const interim = await page.locator('[data-test="standings"]').evaluate(board => ({
      judges: Object.fromEntries([...board.querySelectorAll('.judge-chip')].map(chip =>
        [chip.dataset.judge, {spent:Number(chip.dataset.spent),left:chip.querySelector('.judge-left').textContent}])),
      points: Object.fromEntries([...board.querySelectorAll('.sd-row')].map(row =>
        [row.dataset.id, parseInt(row.querySelector('.sd-points').textContent,10)])),
    }));
    assert.deepEqual(interim.judges, {
      maezono:{spent:7,left:'投入 7 ／ 残り 3'},
      dr_kemuri:{spent:6,left:'投入 6 ／ 残り 4'},
      nagumo:{spent:0,left:'10点を保留中'},
    });
    assert.deepEqual(interim.points,{adam:5,naru:3,minto:2,hajime:3});
    // The second feed line starts after a 0.5s delay and slides in for 0.5s.
    // Measure its settled layout, not its temporarily translated overflow.
    await page.waitForTimeout(1100);
    await assertFits(page,'.standings .judge-panel, .standings .judge-chip, .standings .judge-left, .standings .sd-feed-lines');
    if (label !== "portrait") {
      await page.waitForTimeout(3100); // Past the former 3.6s automatic dismissal.
      assert.equal(await page.evaluate(() => window.standingsDone), false);
      assert(await page.locator('[data-test="standings"].show:not(.out)').isVisible());
      assert.equal(await page.locator('.sd-feed-lines > div').count(), 2);
    }
    await capture(page, `standings-${label}`);
    if (label === "portrait") {
      // Keep the portrait layout checks, then follow the guide to rotate before tapping.
      assert(await page.locator("#rotate-hint").isVisible());
      await page.setViewportSize({ width: 844, height: 390 });
      await page.locator("#rotate-hint").waitFor({ state: "hidden" });
    }
    if (mobile) await page.locator('[data-test="standings-next"]').tap();
    else await page.locator('[data-test="standings-next"]').click();
    await page.evaluate(() => window.standings);
    assert.equal(await page.locator('[data-test="standings"], .fx-dim').count(), 0);
    if (label === "portrait") await page.setViewportSize(viewport);
    await page.evaluate(() => { window.cut = T.result.nagumoCutin(1); });
    await page.locator('.nc-cut.show').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.nagumo-cut, .nc-row, .nc-cut');
    await capture(page, `nagumo-${label}`);
    await page.evaluate(() => window.cut);
    await page.evaluate(() => { window.finalResult = T.result.resultTable(cs, 1); });
    await page.locator('[data-test="result-next"]').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.result-table, .rt-layout, .rt-row, .rt-detail, [data-test="result-next"]');
    const labels = await page.locator('.rt-part > span').allTextContents();
    assert.deepEqual(labels, ["穴あけ", "炭焼き", "完成品", "調整1回目", "調整2回目", "総合"]);
    assert.match(await page.locator('.rt-judge-comment').innerText(), /上園「.+」/);
    assert.equal(await page.locator('.arcade-score, [data-test="result-score"], .rt-meter').count(), 0);
    assert.equal(await page.locator('.rt-row.me .rt-rank').textContent(), "1位");
    const finalVotes = await page.locator('.rt-row').evaluateAll(rows => Object.fromEntries(rows.map(row =>
      [row.dataset.id,{points:parseInt(row.querySelector('.rt-pt').textContent,10),votes:row.querySelector('.rt-votes').textContent}])));
    assert.deepEqual(finalVotes,{
      naru:{points:5,votes:'上園 2 · 博士 3 · 南雲 0'},
      adam:{points:5,votes:'上園 2 · 博士 3 · 南雲 0'},
      minto:{points:3,votes:'上園 2 · 博士 1 · 南雲 0'},
      hajime:{points:17,votes:'上園 4 · 博士 3 · 南雲 10'},
    });
    for(const [id,points] of Object.entries(interim.points))assert(finalVotes[id].points>=points,`${id}: displayed allocated points returned`);
    await assertFits(page,'.rt-name, .rt-votes, .rt-pt');
  }, { viewport, isMobile: mobile, hasTouch: mobile });

  for (const [round, key] of [[1, "Enter"], [2, "Space"]]) await check(`standings-round${round}-${key}`, async page => {
    await init(page);
    await page.evaluate(async round => {
      T.core.markMet("maezono");
      // Build the real VN controls without starting a scene, then use their
      // normal handlers to leave AUTO/SKIP enabled while reading the board.
      await T.vn.play({ dialogue_id: "__standings_controls", lines: [] }, { signal: AbortSignal.abort() });
      T.core.config.autoSpeed = 3;
      T.standingsMode = round === 1 ? "vn-auto" : "vn-skip";
      document.querySelector(`[data-test="${T.standingsMode}"]`).click();
      T.beforeStandings = JSON.stringify(T.core.state);
      T.standingsDone = false;
      T.standings = T.result.showStandings(round, 60).then(() => { T.standingsDone = true; });
    }, round);
    const next = page.locator('[data-test="standings-next"]');
    await next.waitFor({ state: "visible" });
    await page.waitForTimeout(4200);
    assert.equal(await page.evaluate(() => T.standingsDone), false, "VN AUTO/SKIP cannot dismiss standings");
    assert.equal(await page.evaluate(() => document.querySelector(`[data-test="${T.standingsMode}"]`).getAttribute("aria-pressed")), "true");
    assert.equal(await next.evaluate(button => document.activeElement === button), true);
    assert.equal(await next.evaluate(button => getComputedStyle(button).pointerEvents), "auto");
    await assertFits(page, '[data-test="standings"], .sd-feed-lines, [data-test="standings-next"]');
    await page.keyboard.press(key);
    await page.evaluate(() => T.standings);
    assert.equal(await page.locator('[data-test="standings"], .fx-dim').count(), 0);
    assert(await page.evaluate(() => JSON.stringify(T.core.state) === T.beforeStandings));
    await page.evaluate(() => document.querySelector(`[data-test="${T.standingsMode}"]`).click());
  });

  await check("standings-load-cancels-old-tournament", async page => {
    await init(page);
    await page.evaluate(() => {
      T.standingsContinued = false;
      T.standings = T.result.showStandings(1, 60).then(() => { T.standingsContinued = true; return null; }, error => error.name);
    });
    await page.locator('[data-test="standings-next"]').waitFor({ state: "visible" });
    await page.evaluate(() => T.core.setState(T.core.newState()));
    assert.equal(await page.evaluate(() => T.standings), "AbortError");
    assert.equal(await page.evaluate(() => T.standingsContinued), false);
    assert.equal(await page.locator('[data-test="standings"], .fx-dim').count(), 0);
  });
});
