// 一章改修の回帰: 素材待ち、初期/解放済み炭、調整2回、準備・保存、発表画面。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
import { assertCraftProgress } from "./craft_progress_assertions.mjs";
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
        for (const id of ["sumi", "pakki", "sensu", "uezono", "dr_charcoal", "naru", "adam", "minto"]) intro.markIntroSeen(id);
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
        const accept = page.locator('[data-test="water-empty-accept"]');
        if (await accept.isVisible()) await accept.click();
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
    await assertCraftProgress(page);
    await page.evaluate(() => { T.broadcast.clearComments(); T.broadcast.burst(cs, "perfect", 4); T.broadcast.clearComments(); });
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.nico').count(), 0, "Old comments leaked after fast transition");
  });

  // #3558 項目3: 吸い出しの結果確認で流れるコメントが、ゾーンラベル（上げ吸い／下げ吸い）に重ならない。
  // コメントは .bc-lane の clip-path で切り取られるので、ラベル矩形（帯座標）が多角形の外にあることを幾何で確かめる。
  await check("pull-label-comment-clearance", async page => {
    await init(page);
    await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament");
      await T.open(cs);
      cs.mix = { blueberry: 9, mint: 3 }; cs.mixInfo = T.steps.evaluateMix(cs); cs.pack = "normal"; cs.water = 0.5;
      cs.holes = { score: 95, outerEven: .95, innerExcess: 0, outer: 24, middle: 0, inner: 0 };
      cs.steam = { score: 100, seconds: 480, temp: .54 }; cs.steamSeconds = 480;
      window.pullPromise = T.pull.runPull(cs); // 入力待ちのままにしてラベルを表示させ続ける
    });
    await page.locator(".pull-zone-label.l-up").waitFor();
    await page.evaluate(() => T.broadcast.completed(cs, "pull", 95));
    await page.locator(".nico").first().waitFor();
    const geo = await page.evaluate(() => {
      const lane = document.querySelector(".bc-lane");
      const lr = lane.getBoundingClientRect();
      const rel = (r) => ({ x: r.x - lr.x, y: r.y - lr.y, w: r.width, h: r.height });
      return {
        lane: { w: lr.width, h: lr.height },
        clip: getComputedStyle(lane).clipPath,
        up: rel(document.querySelector(".pull-zone-label.l-up").getBoundingClientRect()),
        down: rel(document.querySelector(".pull-zone-label.l-down").getBoundingClientRect()),
        row0: rel(document.querySelector('.nico[data-row="0"]').getBoundingClientRect()),
      };
    });
    assert(geo.clip.startsWith("polygon("), `bc-lane has no clip polygon: ${geo.clip}`);
    const coord = (token, dim) => {
      const calc = token.match(/^calc\(100% - ([\d.]+)px\)$/);
      if (calc) return dim - Number(calc[1]);
      if (token.endsWith("%")) return dim * Number(token.slice(0, -1)) / 100;
      return Number(token.replace("px", ""));
    };
    const poly = geo.clip.slice("polygon(".length, -1).split(",").map((point) => {
      const tokens = point.trim().match(/calc\([^)]*\)|\S+/g);
      return [coord(tokens[0], geo.lane.w), coord(tokens[1], geo.lane.h)];
    });
    const inside = (x, y) => {
      let isIn = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) isIn = !isIn;
      }
      return isIn;
    };
    // 前提: 1行目のコメント帯はラベルの高さ帯と重なっている（重ならないなら検査自体が無意味）
    assert(geo.row0.y < geo.up.y + geo.up.h && geo.row0.y + geo.row0.h > geo.up.y, "row0 does not cross the label band");
    for (const [name, r] of [["l-up", geo.up], ["l-down", geo.down]]) {
      const samples = [
        [r.x + 1, r.y + 1], [r.x + r.w - 1, r.y + 1], [r.x + 1, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1],
        [r.x + r.w / 2, r.y + r.h / 2], [r.x + r.w / 2, r.y + 1], [r.x + r.w / 2, r.y + r.h - 1],
      ];
      for (const [x, y] of samples) assert(!inside(x, y), `${name} label point (${x}, ${y}) is inside the comment lane clip`);
    }
  });

  await check("preparation-reserves-price-and-practices-announced-mix", async page => {
    await init(page);
    await page.evaluate(() => {
      T.core.state.money = 1550; T.core.state.day = 7;
      window.preparing = T.preparation.prepareFlavorStock();
    });
    const button = id => page.locator(`[data-test="${id}"]`);
    await button("prep-flavor-blueberry").click();
    await page.locator('[data-tab="kuji"]').click();
    assert(await button("kuji-g1000").isDisabled(), "くじで指定品代を使わない");
    await page.locator('[data-tab="flavor"]').click();
    await button("buy-mint").click();
    assert(await button("shop-checkout").isDisabled(), "ほかの葉で指定品代を使わない");
    await button("minus-mint").click();
    await button("buy-blueberry").click(); await button("shop-checkout").click(); await button("shop-leave").click();
    await page.evaluate(() => window.preparing);
    assert.equal(await page.evaluate(() => T.core.state.money), 0, "所持金で足りるときは経費にしない");
    await page.evaluate(async () => {
      window.cs = T.session.newSession("rehearsal"); cs.practiceKind = "midcheck"; await T.open(cs);
      window.mixing = T.steps.stepMix(cs);
    });
    await button("mix-ok").click(); await page.evaluate(() => window.mixing);
    assert.deepEqual(await page.evaluate(() => cs.mix), { blueberry: 10, mint: 2 });
  });

  await check("preparation-low-money-stock-and-save", async page => {
    await init(page);
    await page.evaluate(() => {
      T.core.state.money = 0; T.core.state.day = 7;
      T.core.state.flavorStock.lemon = 1;
      T.core.state.flavors.push("lemon");
      window.preparing = T.preparation.prepareFlavorStock();
    });
    // #2213 B08: レモンの立て替えは無くなった。練習用の香りとして自分で選んで仕入れる。
    await page.locator('[data-test="prep-flavor-lemon"]').click();
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
      ["naru", "adam", "minto", "sensu", "uezono", "dr_charcoal"].forEach(T.core.markMet);
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
      uezono:{spent:7,left:'投入 7 ／ 残り 3'},
      dr_charcoal:{spent:6,left:'投入 6 ／ 残り 4'},
      sensu:{spent:0,left:'10点を保留中'},
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
    const paint = await page.locator('.standings .rank-medal').evaluateAll(nodes => nodes.map(n => {
      const s = getComputedStyle(n); return { image: s.backgroundImage, size: s.backgroundSize,
        position: s.backgroundPosition, repeat: s.backgroundRepeat, clip: s.clipPath };
    }));
    assert(paint.length > 0);
    for (const medal of paint) {
      assert.match(medal.image, /medal-(gold|silver|bronze|plain)\.webp/);
      assert.equal(medal.size, 'contain'); assert.equal(medal.position, '50% 50%');
      assert.equal(medal.repeat, 'no-repeat'); assert.equal(medal.clip, 'none');
    }
    assert.equal(await page.locator('.standings .sd-board').evaluate(n => getComputedStyle(n).backgroundImage), 'none');
    const decorations = await page.locator('.standings .sd-row').evaluateAll(nodes => nodes.map(n => {
      const s = getComputedStyle(n); return [s.borderTopColor, s.boxShadow];
    }));
    assert(decorations.every(([border, shadow]) => border === 'rgba(0, 0, 0, 0)' && shadow === 'none'));
    assert(await page.locator('.standings .sd-board').evaluate(n => {
      const legend = n.querySelector('.judge-legend').getBoundingClientRect();
      return legend.bottom <= n.querySelector('.sd-rows').getBoundingClientRect().top;
    }), 'Judge legend overlaps the ranking rows');
    await capture(page, `standings-${label}`);
    await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/night-standings-${viewport.width}x${viewport.height}.png` });
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
    await page.evaluate(() => { window.cut = T.result.sensuCutin(1); });
    await page.locator('.nc-cut.show').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.sui-cut, .nc-row, .nc-cut');
    await capture(page, `sensu-${label}`);
    await page.evaluate(() => window.cut);
    await page.evaluate(() => { window.finalResult = T.result.resultTable(cs, 1); });
    await page.locator('[data-test="result-next"]').waitFor();
    await page.waitForTimeout(550);
    await assertFits(page, '.result-table, .rt-layout, .rt-row, .rt-detail, [data-test="result-next"]');
    await capture(page, `result-${label}-top`);
    const scroll = page.locator('.rt-detail-scroll');
    assert.equal(await scroll.getAttribute("tabindex"), "0");
    const deductions = page.locator('.rt-judge-deduction');
    assert.equal(await deductions.count(), 3);
    for (const line of await deductions.all()) {
      await line.scrollIntoViewIfNeeded();
      await assertFits(page, `.rt-judge-deduction[data-judge="${await line.getAttribute("data-judge")}"]`);
      assert(await line.evaluate(node => {
        const card = node.closest('.rt-detail-scroll').getBoundingClientRect();
        const text = node.getBoundingClientRect();
        return text.top >= card.top - 1 && text.bottom <= card.bottom + 1;
      }), "Each deduction must be readable inside the scroll area");
    }
    await page.locator('.rt-detail-scroll button').last().scrollIntoViewIfNeeded();
    await assertFits(page, '.rt-detail, .rt-detail-scroll button');
    await capture(page, `result-${label}-bottom`);
    const labels = await page.locator('.rt-part > span').allTextContents();
    assert.deepEqual(labels, ["穴あけ", "炭焼き", "完成品", "調整1回目", "調整2回目", "総合"]);
    assert.match(await page.locator('.rt-judge-comment').innerText(), /上園「.+」/);
    assert.equal(await page.locator('.arcade-score, [data-test="result-score"], .rt-meter').count(), 0);
    assert.equal(await page.locator('.rt-row.me .rt-rank').textContent(), "1位");
    const finalVotes = await page.locator('.rt-row').evaluateAll(rows => Object.fromEntries(rows.map(row =>
      [row.dataset.id,{points:parseInt(row.querySelector('.rt-pt').textContent,10),votes:row.querySelector('.rt-votes').textContent}])));
    assert.deepEqual(finalVotes,{
      naru:{points:5,votes:'上園 2 · 博士 3 · 千須 0'},
      adam:{points:5,votes:'上園 2 · 博士 3 · 千須 0'},
      minto:{points:3,votes:'上園 2 · 博士 1 · 千須 0'},
      hajime:{points:17,votes:'上園 4 · 博士 3 · 千須 10'},
    });
    for(const [id,points] of Object.entries(interim.points))assert(finalVotes[id].points>=points,`${id}: displayed allocated points returned`);
    await assertFits(page,'.rt-name, .rt-votes, .rt-pt');
  }, { viewport, isMobile: mobile, hasTouch: mobile });

  for (const [round, key] of [[1, "Enter"], [2, "Space"]]) await check(`standings-round${round}-${key}`, async page => {
    await init(page);
    await page.evaluate(async round => {
      T.core.markMet("uezono");
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
    // 票が入る演出（TSH02）の間は「次へ」を押せない。会話の AUTO/SKIP は演出も板も飛ばさない。
    assert.equal(await next.isDisabled(), true, "次へ is locked while the votes are being cast");
    await page.locator('[data-test="standings"][data-ceremony="done"]').waitFor();
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

  // 票が入る演出（TSH02）: 入れる前の値から始まり、審査員ごとに票が入って、入れた後の値で終わる。板を押すと早送り。
  const startVoteBoard = page => page.evaluate(async () => {
    const votes = await import("./js/craft/ch1-votes.js");
    ["naru", "adam", "minto", "sensu", "uezono", "dr_charcoal"].forEach(T.core.markMet);
    window.cs = { mix: { lemon: 8, mint: 4 }, holes: { score: 93 }, heat: { score: 95 },
      stats: { aroma: 88, taste: 86, heatStability: 84, burnRisk: 14, draw: 82, smoke: 85, craftQuality: 88, duration: 80 },
      pull: { score: 92, attack: true }, careHistory: [{ score: 99, attack: true }, { score: 104, attack: true }], care: { score: 99 },
      parts: { holes: 93, heat: 95, shisha: 88, care1: 99, care2: 96 }, total: 92 };
    window.attempt = { rulesVersion: 2 };
    votes.beginCh1Votes(attempt, { style: "sakurai" });
    votes.castCh1Votes(attempt, 0, cs);
    const sum = table => Object.fromEntries(votes.CH1_CONTESTANTS.map(id =>
      [id, attempt.voteAttempt.baseVotes[id] + votes.CH1_JUDGES.reduce((n, judge) => n + table[judge][id], 0)]));
    const before = sum(attempt.voteAttempt.votes);
    window.standingsDone = false;
    // 票は showStandings の先頭で同期して確定する。
    window.standings = T.result.showStandings(2, 90, cs, attempt).then(() => { window.standingsDone = true; });
    return { before, after: sum(attempt.voteAttempt.votes) };
  });
  const boardPoints = page => page.locator('[data-test="standings"] .sd-row').evaluateAll(rows =>
    Object.fromEntries(rows.map(row => [row.dataset.id, parseInt(row.querySelector('.sd-points').textContent, 10)])));
  const boardSpent = page => page.locator('[data-test="standings"] .judge-chip').evaluateAll(chips =>
    Object.fromEntries(chips.map(chip => [chip.dataset.judge, [Number(chip.dataset.spent), chip.querySelectorAll('.judge-pips .on').length, chip.querySelector('.judge-left').textContent]])));
  const settled = { uezono: [5, 5, '投入 5 ／ 残り 5'], dr_charcoal: [5, 5, '投入 5 ／ 残り 5'], sensu: [5, 5, '投入 5 ／ 残り 5'] };
  for (const mode of ["plays-through", "tap-skips", "key-skips", "reduced-motion"]) await check(`vote-ceremony-${mode}`, async page => {
    await init(page);
    const expected = await startVoteBoard(page);
    assert.notDeepEqual(expected.before, expected.after, "The round must move points");
    const board = page.locator('[data-test="standings"]');
    const next = page.locator('[data-test="standings-next"]');
    await board.and(page.locator('.show')).waitFor();
    if (mode === "reduced-motion") {
      // 動きを減らす設定では、票の動き・見出しの帯を出さず、最後の値をすぐ出す。
      await board.and(page.locator('[data-ceremony="done"]')).waitFor({ timeout: 1000 });
      assert.equal(await page.locator('.ts-sting, .ts-token, .ts-plus').count(), 0);
    } else {
      assert.equal(await board.getAttribute("data-ceremony"), "running");
      assert.deepEqual(await boardPoints(page), expected.before, "The board starts from the points before this round");
      assert.deepEqual(await boardSpent(page), { uezono: [2, 2, '投入 2 ／ 残り 8'], dr_charcoal: [2, 2, '投入 2 ／ 残り 8'], sensu: [2, 2, '投入 2 ／ 残り 8'] });
      assert.equal(await next.isDisabled(), true);
      assert.equal(await page.locator('.ts-sting').count(), 1, "The vote opens with the heading band");
      if (mode === "plays-through") {
        // 審査員の番が来ると札が前に出て、票の粒が飛ぶ。
        await page.locator('.judge-chip.ts-casting').first().waitFor();
        await page.locator('.ts-token').first().waitFor({ state: "attached" });
      } else {
        await page.waitForTimeout(1500);
        assert.equal(await board.getAttribute("data-ceremony"), "running");
        if (mode === "tap-skips") await board.locator('.tournament-heading h1').click();
        else await page.keyboard.press("Enter");
      }
      await board.and(page.locator('[data-ceremony="done"]')).waitFor({ timeout: mode === "plays-through" ? 12000 : 1000 });
      assert.equal(await page.evaluate(() => window.standingsDone), false, "Skipping the ceremony does not dismiss the board");
    }
    assert.deepEqual(await boardPoints(page), expected.after);
    assert.deepEqual(await boardSpent(page), settled);
    assert.equal(await page.locator('.ts-token, .judge-chip.ts-casting, .ts-wait').count(), 0, "No ceremony leftovers");
    // 並びは点の多い順。「次へ」は出そろってから押せる。
    const order = await board.locator('.sd-row').evaluateAll(rows => rows
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(row => parseInt(row.querySelector('.sd-points').textContent, 10)));
    assert.deepEqual(order, order.slice().sort((a, b) => b - a));
    await next.and(page.locator(':enabled')).waitFor();
    assert.equal(await next.evaluate(button => document.activeElement === button), true);
    await assertFits(page, '.standings, .sd-row, .sd-status, [data-test="standings-next"], .standings .judge-chip');
    await capture(page, `vote-ceremony-${mode}`);
    await page.keyboard.press("Enter");
    await page.evaluate(() => window.standings);
    assert.equal(await page.locator('[data-test="standings"], .fx-dim, .ts-token').count(), 0);
  }, mode === "reduced-motion" ? { reducedMotion: "reduce" } : {});

  // 結果発表（TSH03）: カウントは出場者4人に光が巡り、最後の投票は3人の票 → 千須の最後の1点、順位表の前に大見出し。
  for (const touch of [false, true]) await check(`final-vote-and-splash-${touch ? "touch" : "pc"}`, async page => {
    await init(page);
    await startVoteBoard(page);
    await page.locator('[data-test="standings"][data-ceremony="running"]').locator('.tournament-heading h1').click();
    await page.locator('[data-test="standings-next"]:enabled').click();
    const { result, lastRound } = await page.evaluate(async () => {
      await window.standings;
      const votes = await import("./js/craft/ch1-votes.js");
      for (const round of [2, 3]) votes.castCh1Votes(attempt, round, cs);
      window.countdown = T.result.resultCountdown(cs, "win", attempt);
      return { result: attempt.voteAttempt.result, lastRound: attempt.voteAttempt.finalVotes };
    });
    assert.equal(result.rank, 1);
    await page.locator('[data-test="result-count"]').waitFor();
    assert.equal(await page.locator('.rc-card').count(), 4);
    assert.equal(await page.locator('.rc-card .ts-bust img').count(), 4, "Each finalist stands as a portrait");
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('.rc-card.spot').count(), 1, "The spotlight visits one finalist per count");
    await assertFits(page, '.count-screen .tournament-heading, .rc-ring, .rc-pray, .rc-card');
    await capture(page, `count-finalists-${touch ? "touch" : "pc"}`);
    await page.locator('[data-test="result-count"]').locator('.tournament-heading h1').click();
    await page.locator('[data-test="result-count"].puchun').waitFor({ timeout: 2000 });
    assert.notEqual(await page.locator('[data-test="result-count"]').getAttribute("data-count"), "0");
    await page.evaluate(async () => { await countdown; (await import("./js/core/ui.js")).retireScreen(); window.cut = T.result.sensuCutin(1, attempt); });
    const final = page.locator('[data-test="final-vote"]');
    await final.and(page.locator('.show')).waitFor();
    const finalPoints = () => final.locator('.nc-row').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.dataset.id, parseInt(row.querySelector('.nc-pt').textContent, 10)])));
    const before4 = Object.fromEntries(result.rows.map(row => [row.id, row.points
      - ["uezono", "dr_charcoal", "sensu"].reduce((n, judge) => n + (lastRound[judge]?.[row.id] || 0), 0)]));
    assert.deepEqual(await finalPoints(), before4, "The final board starts before the last round's votes");
    assert.equal(await final.locator('.nc-caller').count(), 3);
    // 押すと、残りの間を詰めて最後まで進む。
    await page.waitForTimeout(1200);
    const area = await final.boundingBox(), at = { x: area.x + area.width * 0.25, y: area.y + area.height * 0.85 };
    if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
    await page.evaluate(() => window.cut);
    assert.equal(await page.locator('[data-test="final-vote"], .ts-token').count(), 0);
    await page.evaluate(() => { window.finalResult = T.result.resultTable(cs, 1, attempt); });
    const splash = page.locator('[data-test="result-splash"]');
    await splash.and(page.locator('.show')).waitFor();
    assert.equal(await splash.locator('h2').textContent(), "CHAMPION");
    assert.equal(await splash.locator('.ts-crest img').count(), 1);
    assert.equal(await splash.locator('.ts-splash-bust img').count(), 1);
    await page.waitForTimeout(900);
    await assertFits(page, '[data-test="result-splash"] h2, [data-test="result-splash"] p, .ts-splash-tap');
    await capture(page, `champion-splash-${touch ? "touch" : "pc"}`);
    if (touch) await splash.tap(); else await splash.click();
    await splash.waitFor({ state: "detached" });
    await page.locator('.result-table.ts-revealed').waitFor();
    assert.deepEqual(await page.locator('.rt-row').evaluateAll(rows => rows.map(row => [row.dataset.id, parseInt(row.querySelector('.rt-pt').textContent, 10)])),
      result.rows.map(row => [row.id, row.points]));
    await assertFits(page, '.result-table, .rt-layout, .rt-row, .rt-detail, [data-test="result-next"]');
    await page.locator('[data-test="result-next"]').click();
    await page.evaluate(() => window.finalResult);
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

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
