// 提供成功/失敗、同じ調整セルへの2回の実プレイ、単工程のヘッダー。
import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot } from "./support.mjs";
import { assertCraftProgress } from "./craft_progress_assertions.mjs";

const labels = ["パッキング", "炭焼き", "蒸らし", "吸い出し", "提供", "調整"];
async function init(page, steps = null, craftVersion = null) {
  await page.evaluate(async ({ steps, craftVersion }) => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core, session: await import("./js/craft/session.js"),
      pull: await import("./js/craft/pull.js"), practice: await import("./js/craft/practice.js"),
      score: await import("./js/craft/score.js") };
    window.cs = T.session.newSession("tournament");
    if (craftVersion) cs.craftVersion = craftVersion;
    Object.assign(cs, { water: 0.5, place: "triangle", heat: { score: 100, heatPower: 70, heatStability: 80, burnRisk: 10, aromaRetention: 80 },
      steam: { temp: .54, score: 100, seconds: 480 }, steamSeconds: 480,
      holes: { score: 95, total: 24, outerEven: .95, innerExcess: 0, outer: 24, middle: 0, inner: 0 },
      mix: { blueberry: 9, mint: 3 }, mixInfo: { score: 90, total: 12, intensity: 5 }, pack: "normal" });
    T.session.openBench(cs, { steps: steps || T.practice.CRAFT_STEPS });
    await T.session.waitBenchReady(cs);
  }, { steps, craftVersion });
}
const active = page => page.locator('.bench-phase[aria-current="step"]').getAttribute("data-step");
const headerLabels = page => page.locator(".bench-phase-copy b").allTextContents();
const fits = page => assertCraftProgress(page);

await suite("craft-progress", async check => {
  for (const [size, viewport, touch] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["phone", { width: 844, height: 390 }, true],
    ["short", { width: 740, height: 320 }, true],
  ]) await check(`sakurai-equipment-fit-${size}`, async page => {
    await page.evaluate(async () => {
      const model = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const session = await import("./js/craft/session.js");
      const { stepSetup } = await import("./js/craft/steps.js");
      model.newGame(); model.state.chapter = 1; model.state.day = 14;
      const bowls = Object.values(DB.equipById).filter(item => item.type === "bowl").map(item => item.id);
      model.state.owned = [...new Set([...model.state.owned, ...bowls, "tanukish_lid"])];
      window.gearCS = session.newSession("tournament");
      gearCS.craftVersion = "sakurai";
      const { CRAFT_STEPS } = await import("./js/craft/practice.js");
      await session.openBench(gearCS, { steps: CRAFT_STEPS }).ready;
      window.gearRun = stepSetup(gearCS);
    });
    const panel = page.locator(".bench[data-step='setup'] .bench-panel");
    const compare = page.locator('[data-test="setup-compare"]');
    await compare.waitFor();
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    const geometry = await panel.evaluate(async node => {
      const { DB } = await import("./js/core/data.js");
      const { equipmentUse } = await import("./js/craft/flavor-guide.js");
      const pr = node.getBoundingClientRect();
      const inside = (r, bounds) => r.left >= bounds.left - 1 && r.right <= bounds.right + 1;
      const cards = [...node.querySelectorAll(".opt-grid > .opt")].map(card => {
        const id = card.dataset.test.slice(4);
        const equipment = DB.equipById[id], reference = equipmentUse(equipment);
        const rect = card.getBoundingClientRect();
        const title = card.querySelector("b"), desc = card.querySelector("small");
        const copy = [title, desc, card.querySelector(".opt-badge")].filter(Boolean).every(line => {
          const r = document.createRange(); r.selectNodeContents(line);
          return [...r.getClientRects()].every(bounds => inside(bounds, rect) && inside(bounds, pr)
            && bounds.top >= rect.top - 1 && bounds.bottom <= rect.bottom + 1);
        });
        return {
          id, fit: inside(rect, pr) && copy, complete: title.textContent === equipment.name
            && desc.textContent === (reference.use + (reference.caution ? ` ／ 注意：${reference.caution}` : "")),
        };
      });
      const preview = node.querySelector('[data-test="setup-preview"]');
      return { cards, width: [node.clientWidth, node.scrollWidth], expected: Object.values(DB.equipById).filter(item => item.type === "bowl").length,
        preview: preview.querySelectorAll("dd").length, scrollablePreview: preview.scrollHeight > preview.clientHeight };
    });
    assert(geometry.cards.length > 12, "The regression requires the long, unlocked bowl inventory");
    assert.equal(geometry.cards.length, geometry.expected);
    assert(geometry.cards.every(card => card.fit && card.complete), JSON.stringify(geometry.cards.filter(card => !card.fit || !card.complete)));
    assert(geometry.width[1] <= geometry.width[0] + 1, "Equipment choices must not require horizontal scrolling");
    assert.equal(geometry.preview, 6, "Every equipment preview value is retained");
    const choose = async option => { if (touch) await option.tap(); else await option.click(); };
    // 横持ち（PHN）: 一式の札は名前だけに畳み、6つの値の表は「性能を見比べる」の中で読む。札の中で送る以前の配置でもよい。
    if (touch && !geometry.scrollablePreview) {
      await choose(compare);
      const values = page.locator("#modal .equipment-compare-set dd");
      await values.first().waitFor();
      assert.equal(await values.count(), 6, "Every equipment preview value stays readable from the compare dialog");
      await choose(page.locator('[data-test="setup-compare-close"]'));
    }
    const selected = panel.locator('[data-test="opt-silicone_bowl"]');
    assert.match(await selected.textContent(), /装備中/);
    await panel.locator('[data-test="opt-hagal_80beat"]').focus();
    assert.match(await panel.locator('[data-test="setup-preview"]').textContent(), /この候補で組む一式.*最大15g/);
    await choose(compare);
    const close = page.locator('[data-test="setup-compare-close"]');
    await close.waitFor();
    assert.equal(await page.locator(".equipment-compare-list > section").count(), geometry.cards.length);
    assert.match(await page.locator(".equipment-compare-list").textContent(), /80beatハガル/);
    await choose(close);
    const last = panel.locator(".opt-grid > .opt").last();
    const lastGear = (await last.getAttribute("data-test")).slice(4);
    await last.scrollIntoViewIfNeeded();
    assert(await panel.evaluate(node => node.scrollTop > 0 && node.scrollLeft === 0), "Late equipment is reached by vertical scrolling only");
    await choose(last);
    await page.waitForFunction(id => gearCS.equip.bowl === id, lastGear);
    assert.equal(await page.locator(".bench").getAttribute("data-step"), "setup");
  }, { viewport, isMobile: touch, hasTouch: touch });

  for (const [name, viewport, mobile, reducedMotion] of [
    ["desktop", { width: 1280, height: 720 }, false, "no-preference"],
    ["touch", { width: 844, height: 390 }, true, "reduce"],
    ["compact-touch", { width: 740, height: 320 }, true, "reduce"],
  ]) {
    await check(`${name}-steam-guide`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        const steam = await import("./js/craft/steam.js");
        window.guideSession = session;
        window.guideCS = session.newSession("tutorial"); guideCS.steamSeconds = 600;
        session.openBench(guideCS); await session.waitBenchReady(guideCS);
        window.guideStarts = 0;
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes)
            if (node.classList?.contains("countdown")) guideStarts++;
        }).observe(document.body, { childList: true, subtree: true });
        window.guideRun = steam.runSteamDodge(guideCS);
      });
      const close = page.getByRole("button", { name: "説明を閉じて進む" });
      const summary = page.locator(".bench-guide summary");
      const clock = page.locator('[data-test="steam-clock"]');
      await close.waitFor();
      await page.waitForFunction(() => document.activeElement?.dataset.test === "bench-guide-close");
      await assertFits(page, '.bench-guide-tip, [data-test="bench-guide-close"]');
      const size = await close.boundingBox(); assert(size.height >= 43, "Touch target remains 44px after stage scaling");
      const before = await clock.textContent();
      await page.waitForTimeout(250);
      assert.equal(await clock.textContent(), before);
      assert.equal(await page.evaluate(() => guideStarts), 0, "Initial explanation must hold the countdown");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), true);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-steam-guide-open.png` });
      if (mobile) await close.tap(); else await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.activeElement?.matches(".bench-guide summary"));
      await page.waitForFunction(() => guideStarts === 1);
      // #3815: 「リフレッシュ」「アタック」「精密 オフ」の名前は、札の下の銅の縁に乗らずガラスの内側に収まる（PC・横持ちとも）。
      const copies = await page.locator(".dodge-controls").evaluate(controls => {
        const stage = document.getElementById("stage"), k = stage.getBoundingClientRect().width / stage.offsetWidth;
        return [...controls.querySelectorAll(".dodge-action")].map(button => {
          const b = button.getBoundingClientRect(), copy = button.querySelector(".precision-copy") || button.querySelector(".refresh-copy");
          const c = copy.getBoundingClientRect();
          return { name: copy.textContent, bottom: +((b.bottom - c.bottom) / k).toFixed(1), left: +((c.left - b.left) / k).toFixed(1), right: +((b.right - c.right) / k).toFixed(1) };
        });
      });
      assert.equal(copies.length, 3);
      assert(copies.every(copy => copy.bottom >= 16 && copy.left >= 6 && copy.right >= 6), `Action names stay inside the glass: ${JSON.stringify(copies)}`);
      await page.waitForFunction(() => !document.querySelector('[data-test="dodge-precision"]')?.disabled);
      if (mobile) {
        await assertFits(page, '.dodge-action, .precision-state');
        assert(await page.locator('[data-test="dodge-slash"]').isDisabled(), "Locked attack stays disabled");
        const precision = page.locator('[data-test="dodge-precision"]');
        await precision.tap();
        assert.equal(await precision.getAttribute('aria-pressed'), 'true');
        await assertFits(page, '.dodge-action, .precision-state');
      }
      await page.waitForFunction(() => document.querySelector('[data-test="steam-clock"]').textContent !== "10:00");
      // Reopen through the native summary, then dismiss through the same real button.
      if (mobile) await summary.tap(); else await page.keyboard.press("Enter");
      await close.waitFor();
      const paused = await clock.textContent();
      await page.waitForTimeout(250);
      assert.equal(await clock.textContent(), paused, "Reopened guide pauses the active steam clock");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), true);
      if (mobile) await close.tap(); else await page.keyboard.press("Space");
      await page.waitForFunction(() => document.activeElement?.matches(".bench-guide summary"));
      await page.waitForFunction(value => document.querySelector('[data-test="steam-clock"]').textContent !== value, paused);
      assert.equal(await page.evaluate(() => guideStarts), 1, "Reopening must not start a second countdown");
      assert.equal(await page.locator('.bench-panel').evaluate(n => n.inert), false);
      assert.equal(await page.evaluate(() => guideSession.explainTutorialStep(guideCS, "steam")), true);
      assert.equal(await page.locator('.bench-guide').evaluate(n => n.open), false, "Acknowledged lesson is not repeated");
    }, { viewport, isMobile: mobile, hasTouch: mobile, reducedMotion });
  }
  for (const [name, viewport, mobile] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["mobile-landscape", { width: 844, height: 390 }, true],
  ]) {
    await check(`${name}-serve-and-two-care`, async page => {
      await init(page);
      assert.deepEqual(await headerLabels(page), labels);
      const before = await storageSnapshot(page);
      await page.evaluate(() => { window.run = T.pull.runPull(cs); });
      await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]')?.disabled);
      assert.equal(await active(page), "pull");
      await fits(page);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-pull.png` });
      // 本番の吸う/提供ボタンを操作する。自動解決は提供確認まで使わない。
      for (let i = 0; i < 2; i++) {
        await page.waitForFunction(() => {
          const n = document.querySelector('[data-test="pull-needle"]');
          return !document.querySelector('[data-test="pull-stop"]').disabled && Number(n.dataset.pos) > 44 && Number(n.dataset.pos) < 56;
        });
        const stop = page.locator('[data-test="pull-stop"]');
        if (mobile) await stop.tap(); else await stop.click();
        await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]').disabled);
      }
      assert.equal(await active(page), "pull", "Ready to serve is still inhalation");
      const serve = page.locator('[data-test="pull-serve"]');
      if (mobile) await serve.tap(); else await serve.click();
      await page.locator('.bench-phase[data-step="serve"][aria-current="step"]').waitFor();
      assert.equal(await page.locator('.bench-title').textContent(), "提供");
      assert.match(await page.locator('.bench-hint').textContent(), /提供した/);
      assert.equal(await page.locator('.bench').getAttribute("data-step"), "serve");
      assert.equal(await page.locator('.bench-progress-count').textContent(), "5 / 6");
      assert.equal(await page.evaluate(() => cs.pullDone && !cs.pull.failed), true);
      await fits(page);
      await assertFits(page, '.rc-summary, .rc-title, [data-test="step-next"]');
      assert.match(await page.locator('.rc-summary').textContent(), /提供した.*吸ってもらおう/);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-serve.png` });
      await page.locator('[data-test="step-next"]').click();
      await page.evaluate(() => window.run);
      for (const round of [1, 2]) {
        await page.evaluate(round => { T.session.craftTest.auto = null; window.run = T.pull.runCare(cs, { round }); }, round);
        await page.locator('[data-test="care-coals"]').waitFor();
        assert.equal(await active(page), "care");
        assert.deepEqual(await headerLabels(page), labels);
        assert.equal(await page.locator('.bench-phase[data-step="care"]').count(), 1);
        assert.equal(await page.locator('.bench-progress-count').textContent(), "6 / 6");
        assert(!/回目/.test(await page.locator('.bench-progress').getAttribute("aria-label")));
        const lead = await page.locator('.care-coals-lead').textContent();
        assert.match(lead, round === 1 ? /提供して約20分.*温度が下が/ : /再び.*温度が下が/);
        await fits(page);
        await assertFits(page, '.care-coals-lead, .care-coals-ask, .care-coal');
        await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/${name}-care${round}.png` });
        // 既存の炭の交換・吸引を自動操作して結果を取得。実時間20分の待ちはない。
        await page.evaluate(() => { T.session.craftTest.auto = "good"; });
        await page.locator('[data-test="care-coal-1"]').click();
        await page.evaluate(() => window.run);
        assert.equal(await active(page), "care");
        assert.deepEqual(await headerLabels(page), labels);
        assert(!/調整.*回目/.test(await page.locator('.bench-top').textContent()), "Care count leaked into the header score popup");
        if (round === 1) await page.evaluate(() => { window.firstCare = JSON.stringify(cs.careHistory[0]); });
      }
      const data = await page.evaluate(() => {
        T.score.finalize(cs);
        return { history: cs.careHistory, first: firstCare, parts: cs.parts, weights: T.score.WEIGHTS,
          bonus: T.score.bonusOf(cs).bonus, total: cs.total, arcade: cs.arcade.parts, failed: cs.failed };
      });
      assert.equal(data.history.length, 2);
      assert.equal(JSON.stringify(data.history[0]), data.first);
      assert.equal(data.history[1].startTemp, Math.max(.14, data.history[0].temp - .075));
      assert(data.history.every(h => h.coals === 1 && h.coalsDetail.count === 1 && h.coalsDetail.picks.length === 0), "the fixture has no first-burn record, so the swap uses standard coals");
      assert.equal(data.parts.care1, data.history[0].score);
      assert.equal(data.parts.care2, data.history[1].score);
      assert.deepEqual(data.weights, { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 });
      assert.equal(data.total, Math.round(Math.min(100, Object.values(data.parts).reduce((sum, n) => sum + n * .2, data.bonus)) * 10) / 10);
      assert.equal(data.arcade.care1, Math.round(data.history[0].score * 200));
      assert.equal(data.arcade.care2, Math.round(data.history[1].score * 200));
      assert(!data.failed);
      assert.deepEqual(await storageSnapshot(page), before, "Transient craft display wrote to the save");
    }, { viewport, isMobile: mobile, hasTouch: mobile });
  }

  for (const [size, viewport, touch] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["phone", { width: 844, height: 390 }, true],
    ["short", { width: 740, height: 320 }, true],
  ]) await check(`sakurai-route-and-record-${size}`, async page => {
    await init(page);
    await page.evaluate(async () => {
      cs.craftVersion = "sakurai"; // 第1章大会の実在する別方式。新しい台で入口を作り直す。
      window.iconCS = { ...cs };
      T.session.openBench(iconCS, { steps: T.practice.CRAFT_STEPS });
      await T.session.waitBenchReady(iconCS);
    });
    for (const [id, title, lessonStep] of [
      ["setup", "水入れ"], ["mix", "配合"], ["pack", "パッキング"], ["holes", "アルミ穴あけ"],
      ["place", "炭の配置"], ["heat", "炭焼き"], ["steam", "蒸らし", "timer"],
      ["steam", "蒸らし"], ["pull", "吸い出し"], ["serve", "提供"], ["care", "熱管理"],
    ]) {
      await page.evaluate(([id,title,lessonStep]) => T.session.stepPanel(id,title,"作業の説明", {lessonStep}), [id,title,lessonStep]);
      await assertCraftProgress(page);
      if (lessonStep === "timer" || id === "place") assert.equal(await page.locator(".craft-route-stop.now .bench-phase-step").innerText(), lessonStep === "timer" ? "蒸らし時間" : "炭の配置");
    }
    const guide = page.locator(".bench-guide"), ledger = guide.locator(".rig-record");
    assert(!await ledger.isVisible());
    await guide.locator("summary").first().click();
    assert(await ledger.isVisible());
    assert.match(await ledger.getAttribute("aria-label"), /穴あけ.*炭焼き/);
    // 横持ちでは上の帯用の丸い灯の固定寸法に負けず、工程名が札に入り、隣の札と重ならない（#3924）。
    await assertFits(page, ".craft-record-review .rig-lamp");
    const record = await guide.locator(".craft-record-review").evaluate(review => {
      const stage = document.getElementById("stage"), k = stage.getBoundingClientRect().width / stage.offsetWidth;
      const lamps = [...review.querySelectorAll(".rig-lamp")].map(lamp => lamp.getBoundingClientRect());
      return { heading: parseFloat(getComputedStyle(review.querySelector("strong")).fontSize) * k,
        label: parseFloat(getComputedStyle(review.querySelector(".rig-lamp"), "::before").fontSize) * k,
        overlap: lamps.some((a, i) => lamps.slice(i + 1).some(b => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)) };
    });
    assert(record.heading >= 11 && record.label >= 11, `Record text is readable at real size: ${JSON.stringify(record)}`);
    assert(!record.overlap, "Phase lamps in the guide must not overlap");
    await page.getByRole("button", {name:"説明を閉じて進む"}).click();
    assert(!await ledger.isVisible());
    assert(await guide.locator("summary").first().evaluate(el => el === document.activeElement));
  }, {viewport, isMobile: touch, hasTouch: touch, reducedMotion: "reduce"});

  // 穴の配置（2種類）: 横持ちでも配置・説明の開閉・開始は実寸44px、任意の説明の本文は実寸11px以上。
  // 説明を開いて一覧の最後まで送っても、開始の札は画面内に残る（#3924）。
  for (const [size, viewport] of [["phone", { width: 844, height: 390 }], ["short", { width: 740, height: 320 }]]) await check(`sakurai-hole-chooser-${size}`, async page => {
    await page.evaluate(async () => {
      const model = await import("./js/core/state.js");
      const session = await import("./js/craft/session.js"), holes = await import("./js/craft/holes.js");
      const { CRAFT_STEPS } = await import("./js/craft/practice.js");
      model.newGame(); model.state.chapter = 2; model.state.day = 3;
      window.holeCS = session.newSession("tournament");
      Object.assign(holeCS, { craftVersion: "sakurai", availableHoleTemplateIds: ["outer24", "outer12-middle12"],
        mix: { double_apple: 9, mint: 3 }, pack: "normal", equip: { ...holeCS.equip, hms: "tanukish_lid" } });
      await session.openBench(holeCS, { steps: CRAFT_STEPS }).ready;
      window.holeRun = holes.runHoles(holeCS);
    });
    const start = page.locator('[data-test="hole-start"]');
    await start.waitFor();
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    const measure = () => page.evaluate(() => {
      const stage = document.getElementById("stage"), k = stage.getBoundingClientRect().width / stage.offsetWidth;
      const begin = document.querySelector('[data-test="hole-start"]').getBoundingClientRect();
      return { targets: [...document.querySelectorAll('.hole-chooser :is(.ht-option, .ht-help summary, [data-test="hole-start"])')]
        .map(node => node.getBoundingClientRect()).map(r => +Math.min(r.width, r.height).toFixed(1)),
        startVisible: begin.top >= 0 && begin.bottom <= innerHeight + 1,
        help: [...document.querySelectorAll(".hole-chooser .ht-help p")].filter(node => node.getClientRects().length)
          .map(node => +(parseFloat(getComputedStyle(node).fontSize) * k).toFixed(1)) };
    });
    const closed = await measure();
    assert.equal(closed.targets.length, 4, "Two layouts, the optional explanation and the start control");
    assert(closed.startVisible && closed.targets.every(size => size >= 43.5), JSON.stringify(closed));
    const outer = page.locator('[data-test="hole-template-outer24"]');
    await outer.tap();
    assert.equal(await outer.getAttribute("aria-pressed"), "true");
    await page.locator(".hole-chooser .ht-help summary").tap();
    await page.locator(".hole-chooser-scroll").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const opened = await measure();
    assert(opened.help.length >= 2 && opened.help.every(size => size >= 11), `Optional explanation is readable: ${JSON.stringify(opened)}`);
    assert(opened.startVisible && opened.targets.every(size => size >= 43.5), JSON.stringify(opened));
    await start.tap();
    await page.locator('[data-test="hole-punch"]').waitFor();
  }, { viewport, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

  // #3815 初回レッスンの穴あけ: お手本動画は開かない。スミさんの顔は顔の枠どおりに切り取られ、板の絵のガラスの座の中心に入る。
  // 「温度帯」の札は温度計の中心。「穴を開ける」の中の目盛りは、押している間だけ浅い→深いへ伸び、離すと空に戻る（判定は変えない）。
  for (const [size, viewport, touch] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["phone", { width: 844, height: 390 }, true],
    ["short", { width: 740, height: 320 }, true],
  ]) await check(`sakurai-lesson-face-label-and-press-meter-${size}`, async page => {
    await page.evaluate(async () => {
      const model = await import("./js/core/state.js"); model.newGame();
      const session = await import("./js/craft/session.js"), holes = await import("./js/craft/holes.js");
      const { CRAFT_STEPS } = await import("./js/craft/practice.js");
      window.lessonCS = session.newSession("tutorial");
      Object.assign(lessonCS, { mix: { double_apple: 9, mint: 3 }, pack: "normal",
        holeTemplateId: "outer12-middle12", availableHoleTemplateIds: ["outer12-middle12"] });
      await session.openBench(lessonCS, { steps: CRAFT_STEPS.filter(([id]) => !["setup", "care1", "care2"].includes(id)) }).ready;
      window.lessonRun = holes.runHoles(lessonCS);
    });
    const start = page.locator('[data-test="hole-start"]');
    await start.waitFor();
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".bench-demo-sheet").count(), 0, "穴あけのお手本動画は廃止");
    await page.waitForFunction(() => { const img = document.querySelector(".audience-face img"); return img?.complete && img.naturalWidth > 0; });
    const look = await page.evaluate(async () => {
      const { portraitInfo, faceFrame } = await import("./js/core/data.js");
      const stage = document.getElementById("stage"), k = stage.getBoundingClientRect().width / stage.offsetWidth;
      const plate = document.querySelector(".bench-audience"), seat = plate.querySelector(".audience-face"), img = seat.querySelector("img");
      const portrait = portraitInfo(plate.querySelector(".audience-person").dataset.person, "normal");
      const box = faceFrame(portrait.folder, portrait.style || "classic").box.map(v => v / 896);
      const ir = img.getBoundingClientRect(), sr = seat.getBoundingClientRect(), pr = plate.getBoundingClientRect();
      const meter = document.querySelector(".bench:not(.done) .thermo.mix-temperature"), tube = meter.querySelector(".thermo-tube").getBoundingClientRect();
      const label = getComputedStyle(meter, "::before"), mr = meter.getBoundingClientRect();
      const shift = new DOMMatrixReadOnly(label.transform).m41;
      return { k, crop: [ir.left + box[0] * ir.width - sr.left, ir.top + box[1] * ir.width - sr.top, box[2] * ir.width - sr.width],
        seat: (sr.left + sr.width / 2 - pr.left) / k, text: (plate.querySelector(".audience-name").getBoundingClientRect().left - pr.left) / k,
        label: label.content, labelOffset: mr.left + (parseFloat(label.left) + shift + parseFloat(label.width) / 2) * k - (tube.left + tube.right) / 2 };
    });
    assert(look.crop.every(px => Math.abs(px) < 1), `The face frame fills the face seat: ${JSON.stringify(look)}`);
    // 板の絵（voice-plate.webp）のガラスの座の中心は、板の左端から約58px（舞台の座標）。
    assert(Math.abs(look.seat - 57.9) < 1.5, `The face sits in the plate's glass seat: ${JSON.stringify(look)}`);
    assert(Math.abs(look.text - 91.6) < 1.5, `The name and line keep their position: ${JSON.stringify(look)}`);
    assert.equal(look.label, '"温度帯"');
    assert(Math.abs(look.labelOffset) < 1, `The thermometer label is centred on the tube: ${JSON.stringify(look)}`);
    if (touch) await start.tap(); else await start.click();
    await page.locator('[data-test="hole-punch"]').waitFor();
    await page.waitForFunction(() => !document.querySelector(".countdown"));
    const meter = await page.locator('[data-test="hole-punch"]').evaluate(async button => {
      const stage = document.getElementById("stage"), k = stage.getBoundingClientRect().width / stage.offsetWidth;
      const meter = button.querySelector('[data-test="hole-press-meter"]'), fill = () => meter.querySelector(".hr-press-fill").getBoundingClientRect().width;
      const b = button.getBoundingClientRect(), m = meter.getBoundingClientRect();
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const read = () => ({ fill: fill(), press: Number(button.style.getPropertyValue("--press")), depth: button.dataset.depth || "" });
      const rest = read();
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      await wait(150); const early = read();
      await wait(250); const late = read();
      button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      return { rest, early, late, after: read(), width: m.width, height: m.height,
        // 両端の小さな穴・大きな穴の印（左16px・右27px外側）まで札の中
        inside: (m.left - b.left) / k >= 16 && (b.right - m.right) / k >= 27 && m.top >= b.top && m.bottom <= b.bottom,
        punched: document.querySelectorAll(".foil-holes .foil-hole").length };
    });
    assert.deepEqual(meter.rest, { fill: 0, press: 0, depth: "" }, JSON.stringify(meter));
    assert(meter.early.fill > 0 && meter.late.fill > meter.early.fill && meter.late.press > meter.early.press, `The meter grows while held: ${JSON.stringify(meter)}`);
    assert(meter.late.depth, "The held button exposes the current depth");
    assert(Math.abs(meter.late.fill - meter.width * meter.late.press) < 1.5, JSON.stringify(meter));
    assert.deepEqual(meter.after, { fill: 0, press: 0, depth: "" }, "Releasing empties the meter");
    assert.equal(meter.punched, 1, "The hold still punches exactly one hole");
    assert(meter.inside && meter.height >= 4, `The meter and its hole marks stay inside the button: ${JSON.stringify(meter)}`);
    await assertFits(page, '[data-test="hole-punch"]');
  }, { viewport, isMobile: touch, hasTouch: touch, reducedMotion: "reduce" });

  // #3815 吸い出しの状態の札（ぬるい・適温…）は温度計の中心にそろう（右端そろえで左へずれない）。
  for (const [size, viewport, touch] of [
    ["desktop", { width: 1280, height: 720 }, false],
    ["phone", { width: 844, height: 390 }, true],
    ["short", { width: 740, height: 320 }, true],
  ]) await check(`sakurai-pull-label-centered-${size}`, async page => {
    await init(page, null, "sakurai");
    await page.evaluate(() => { window.run = T.pull.runPull(cs); });
    await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]')?.disabled && document.querySelector(".pull-read .pull-state")?.textContent);
    const label = await page.evaluate(() => {
      const read = document.querySelector(".pull > .thermo .pull-read"), tube = read.closest(".thermo").querySelector(".thermo-tube");
      const r = read.getBoundingClientRect(), t = tube.getBoundingClientRect();
      return { text: read.textContent, offset: (r.left + r.right) / 2 - (t.left + t.right) / 2, width: r.width };
    });
    assert(Math.abs(label.offset) < 1, `The state label is centred on the thermometer: ${JSON.stringify(label)}`);
    await assertFits(page, ".pull > .thermo .pull-read");
  }, { viewport, isMobile: touch, hasTouch: touch, reducedMotion: "reduce" });

  await check("failed-pull-stays-on-pull", async page => {
    await init(page);
    await page.evaluate(async () => { T.session.craftTest.auto = "burn"; await T.pull.runPull(cs); });
    assert.equal(await page.evaluate(() => cs.pull.failed), "burnt");
    assert.equal(await page.evaluate(() => cs.pullDone), true);
    assert.equal(await active(page), "pull");
    assert.equal(await page.locator('.bench').getAttribute("data-step"), "pull");
    assert.equal(await page.locator('.bench-title').textContent(), "吸い出し");
  });

  await check("single-steps-and-care-aliases", async page => {
    await init(page);
    for (const [id, expected] of [["holes", ["パッキング"]], ["heat", ["炭焼き"]], ["steam", ["蒸らし"]],
      ["pull", ["吸い出し", "提供"]], ["care", ["調整"]], ["care1", ["調整"]], ["care2", ["調整"]]]) {
      await page.evaluate(id => {
        window.cs = T.session.newSession("drill");
        T.session.openBench(cs, { steps: [[id, id]] });
      }, id);
      await page.evaluate(() => T.session.waitBenchReady(cs));
      assert.deepEqual(await headerLabels(page), expected, id);
    }
    const aliases = await page.evaluate(async () => {
      const { buildCraftProgress } = await import("./js/craft/progress.js");
      const progress = buildCraftProgress(T.practice.CRAFT_STEPS);
      return ["care", "care1", "care2"].map(id => {
        progress.update(id, id === "care" ? "熱管理" : `調整 ${id.at(-1)}回目`);
        const cell = progress.root.querySelector('[aria-current="step"]');
        return { step: cell.dataset.step, label: cell.querySelector("b").textContent, count: progress.count.textContent,
          description: progress.root.getAttribute("aria-label") };
      });
    });
    for (const a of aliases) {
      assert.equal(a.step, "care"); assert.equal(a.label, "調整"); assert.equal(a.count, "6 / 6");
      assert.equal(a.description, "制作の工程：調整。6 / 6");
    }
    const phases = await page.evaluate(async () => {
      const { buildCraftProgress } = await import("./js/craft/progress.js");
      const progress = buildCraftProgress(T.practice.CRAFT_STEPS);
      return [["setup", "機材", "pack"], ["mix", "配合", "pack"], ["holes", "アルミ穴あけ", "pack"],
        ["place", "炭配置", "heat"], ["heat", "炭焼き", "heat"], ["steam", "蒸らし中", "steam"],
        ["pull", "吸い出し", "pull"], ["serve", "提供", "serve"]].map(([id, title, expected]) => {
          progress.update(id, title);
          return { expected, active: progress.root.querySelector('[aria-current="step"]').dataset.step,
            labels: [...progress.root.querySelectorAll('.bench-phase-copy b')].map(n => n.textContent) };
        });
    });
    for (const phase of phases) {
      assert.equal(phase.active, phase.expected);
      assert.deepEqual(phase.labels, labels, "Substep titles must keep the six phase labels");
    }
  });

  await check("compact-sakurai-timer-and-result-actions", async page => {
    await init(page, null, "sakurai");
    await page.evaluate(async () => {
      const timer = await import("./js/craft/timer.js");
      window.timerRun = timer.runSteamTimer(cs);
    });
    const reset = page.locator('[data-test="timer-reset"]');
    const timerStart = page.locator('[data-test="timer-start"]');
    await reset.waitFor();
    await assertFits(page, '.timer-button');
    const resetLines = await reset.evaluate(button => {
      const text = document.createRange();
      text.selectNodeContents(button);
      return new Set([...text.getClientRects()].map(rect => rect.top)).size;
    });
    assert(resetLines <= 2, "Reset must fit the illustrated key in no more than two lines");
    await reset.tap();
    assert(await timerStart.isDisabled());
    await assertFits(page, '.timer-button');
    await page.locator('[data-test="timer-minute-up"]').tap();
    assert(await timerStart.isEnabled());
    await timerStart.tap();
    await page.evaluate(async () => {
      await timerRun;
      const result = await import("./js/craft/result.js");
      window.finalRun = result.resultTable(cs, 3);
    });
    const save = page.locator('[data-test="result-save"]');
    const next = page.locator('[data-test="result-next"]');
    await save.waitFor();
    await assertFits(page, '[data-test="result-save"], [data-test="result-next"]');
    const resultDetails = page.locator('.rt-detail-scroll');
    assert(await resultDetails.evaluate(n => n.scrollHeight > n.clientHeight), "Long result remains independently scrollable");
    await resultDetails.evaluate(n => { n.scrollTop = n.scrollHeight; });
    await assertFits(page, '[data-test="result-save"], [data-test="result-next"]');
    const download = page.waitForEvent("download");
    await save.tap();
    assert.match((await download).suggestedFilename(), /\.png$/);
    await next.tap();
    await page.evaluate(() => finalRun);
  }, { viewport: { width: 740, height: 320 }, hasTouch: true, isMobile: true });

  await check("tutorial-progress-includes-pull-and-serve", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      const session = await import("./js/craft/session.js");
      const ch1 = await import("./js/chapters/ch1.js");
      window.Q = { session };
      window.qcs = session.newSession("tutorial");
      session.openBench(qcs, { steps: ch1.TUTORIAL_STEPS });
      await session.waitBenchReady(qcs);
    });
    assert.deepEqual(await headerLabels(page), ["パッキング", "炭焼き", "蒸らし", "吸い出し", "提供"],
      "Tutorial header lists every phase the lesson actually plays");
    await page.evaluate(() => { Q.session.stepPanel("pull", "吸い出し"); });
    assert.equal(await active(page), "pull");
    assert.equal(await page.locator(".bench-progress-count").textContent(), "4 / 5");
    await page.evaluate(() => { qcs.pullDone = true; qcs.pull = { failed: false }; Q.session.refreshBench(); });
    assert.equal(await active(page), "serve");
    assert.equal(await page.locator(".bench-progress-count").textContent(), "5 / 5");
  });
});
