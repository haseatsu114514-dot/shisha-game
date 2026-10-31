// Approved scene additions: compare actual VN state effects with saved main scenes.
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
const baseline = JSON.parse(fs.readFileSync(new URL("../../../docs/qa/issue508-theme/baseline-scenes.json", import.meta.url)));
const shotDir = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
async function prepare(page) {
  await page.evaluate(async () => {
    window.T = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), ch1: await import("./js/chapters/ch1.js"),
      night: await import("./js/daily/night-events.js") };
    T.ch1.setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    // The production chapter-two loader registers its lazily loaded scenes.
    await (await import("./js/chapters/ch2-city-data.js")).loadPreparationDialogues();
    T.fresh = (opts = {}) => {
      T.core.newGame(); const s = T.core.state;
      Object.assign(s, { day: 10, slot: 2, phase: "daily" });
      s.story.naru = opts.naru || 0;
      if (opts.practice) s.flags._ev_first_practice = true;
      if (opts.met) s.flags._met_tsumugi = true;
      if (opts.art) s.flags._tsumugi_contest_art_seen = true;
      if (opts.legacy) {
        const old = structuredClone(s); old.schema = 13;
        localStorage.setItem("suien_remake_slot1", JSON.stringify(old));
        T.core.loadFromSlot("suien_remake_slot1");
      }
      T.vn.backlog().length = 0;
      return T.core.state;
    };
    T.lines = () => T.vn.backlog().map(l => l.text);
  });
}
const scenarios = [
  ...[0, 1].map(choice => ({ id: "ch1_tsumugi_work_in_progress", choice })),
  ...[0, 2, 3, 4].map(naru => ({ id: "ch1_naru_fourth", naru, legacy: true })),
  ...[false, true].map(practice => ({ id: "ch1_tournament_arrival", practice, legacy: true })),
  ...[0, 1, 2].flatMap(choice => [false, true].map(met => ({ id: "ch1_tournament_after", choice, met }))),
  ...[false, true].map(art => ({ id: "ch1_tsumugi_sketch", art })),
  ...[0, 1].map(choice => ({ id: "ch1_salaryman_regular", choice })), { id: "ch1_salaryman_change" },
];
async function advanceTo(page, text, touch) {
  await page.waitForFunction(() => document.querySelector("#vn.active") && T.vn.backlog().length > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(400); // Production opening input guard is 320ms.
  for (let i = 0; i < 220; i++) {
    if (await page.evaluate(t => T.vn.backlog().at(-1)?.text === t, text)) return;
    const choice = page.locator(".vn-choices button").first();
    if (await choice.isVisible()) {
      if (touch) await choice.tap(); else await choice.click();
      await page.waitForTimeout(100); continue;
    }
    const box = page.locator(".vn-box");
    const before = await page.evaluate(() => ({ n: T.vn.backlog().length,
      text: document.querySelector(".vn-text")?.textContent }));
    if (!await page.evaluate(() => T.vn.isPlaying())) throw new Error(`Scene ended before ${text}: ${JSON.stringify(await page.evaluate(() => T.lines()))}`);
    if (await box.isVisible()) {
      if (touch) await box.tap(); else await box.click();
      await page.waitForFunction(before => T.vn.backlog().length > before.n
        || document.querySelector(".vn-text")?.textContent !== before.text
        || !T.vn.isPlaying() || document.querySelector(".vn-choices button"), before, { timeout: 20000 });
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Scene did not reach ${text}: ${JSON.stringify(await page.evaluate(() => T.lines()))}`);
}
async function snapshotPortrait(page, face) {
  const info = await page.locator('img[data-speaker="salaryman"]').evaluate(im => {
    const r = im.getBoundingClientRect();
    return { src: im.currentSrc, decoded: im.complete && im.naturalWidth === 896 && im.naturalHeight === 1200,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      frame: { height: im.style.height, bottom: im.style.bottom, anchor: im.style.getPropertyValue("--ax"), pos: im.dataset.pos } };
  });
  assert(info.decoded && info.src.endsWith(`chr_salaryman_${face}.webp`), JSON.stringify(info));
  return info.frame;
}
await suite("issue508-theme", async checkAll => {
  const check = (...args) => !process.env.CASE_FILTER || args[0] === process.env.CASE_FILTER
    ? checkAll(...args) : Promise.resolve();
  await check("six-scenes-branches-old-save-and-state-effects", async page => {
    await prepare(page);
    for (const opts of scenarios) {
      const result = await page.evaluate(async ({ opts, previous }) => {
        T.vn.vnTest.turbo = true;
        T.vn.vnTest.choose = (_, labels) => Math.min(opts.choice || 0, labels.length - 1);
        T.fresh(opts); const initial = structuredClone(T.core.state);
        await T.vn.play(previous);
        const before = structuredClone(T.core.state);
        T.core.setState(structuredClone(initial)); T.vn.backlog().length = 0;
        await T.vn.play(opts.id);
        const current = structuredClone(T.core.state), lines = T.lines();
        let afterReplay = null;
        if (opts.id === "ch1_naru_fourth") {
          await T.vn.play(opts.id);
          afterReplay = {
            flavorMastery: structuredClone(T.core.state.flavorMastery),
            flavorLessons: structuredClone(T.core.state.flavorLessons),
          };
        }
        return { before, current, lines, afterReplay };
      }, { opts, previous: baseline.scenes[opts.id] });
      if (opts.id === "ch1_salaryman_regular") {
        // #452 adds only the actual service answer and its immediate save.
        const { savedAt: beforeAt, ...beforeGame } = result.before;
        const { savedAt: currentAt, ...currentGame } = result.current;
        assert(Number.isFinite(currentAt));
        assert.equal(currentGame.flags._salaryman_service_order, opts.choice === 0);
        assert.equal(currentGame.flags._salaryman_service_water, opts.choice === 1);
        delete currentGame.flags._salaryman_service_order;
        delete currentGame.flags._salaryman_service_water;
        assert.deepEqual(currentGame, beforeGame, `Changed state effect: ${JSON.stringify(opts)}`);
      } else if (opts.id === "ch1_tsumugi_work_in_progress") {
        // #452 saves the actual answer immediately. Compare every game field,
        // and check the refreshed save timestamp separately.
        const { savedAt: beforeAt, ...beforeGame } = result.before;
        const { savedAt: currentAt, ...currentGame } = result.current;
        assert(Number.isFinite(beforeAt) && currentAt >= beforeAt);
        assert.deepEqual(currentGame, beforeGame, `Changed state effect: ${JSON.stringify(opts)}`);
      } else if (opts.id === "ch1_naru_fourth") {
        // #1108: the fourth visit now teaches vanilla. Every other game effect stays identical.
        const { flavorMastery: beforeMastery, flavorLessons: beforeLessons, ...beforeGame } = result.before;
        const { flavorMastery: currentMastery, flavorLessons: currentLessons, ...currentGame } = result.current;
        assert.deepEqual(beforeLessons, []);
        assert.deepEqual(currentMastery, { ...beforeMastery, vanilla: 24 });
        assert.deepEqual(currentLessons, ["ch1_naru_fourth"]);
        assert.deepEqual(result.afterReplay, { flavorMastery: currentMastery, flavorLessons: currentLessons });
        assert.deepEqual(currentGame, beforeGame, `Changed state effect: ${JSON.stringify(opts)}`);
      } else assert.deepEqual(result.current, result.before, `Changed state effect: ${JSON.stringify(opts)}`);
      const ls = result.lines;
      if (opts.id === "ch1_naru_fourth") {
        assert.equal(ls.includes("なるは台に目を落とし、炭をひとつ、少し動かした。"), opts.naru >= 3);
        assert(ls.includes("（──多分、気のせいだ）"));
      }
      if (opts.id === "ch1_tournament_arrival") {
        assert.equal(ls.includes("スミさんの「１つずつ手を動かして覚えろ」が浮かんだ。"), opts.practice);
        assert.equal(ls.filter(t => t === "（……今の俺にできることを、やるしかない）").length, 1);
      }
      if (opts.id === "ch1_tsumugi_work_in_progress") {
        assert(ls.includes("……こっちの方が、描いていられます"));
        assert.equal(ls.filter(t => t.includes("大会の一台は、ちゃんと手を止めて吸います")).length, 1);
      }
      if (opts.id === "ch1_tournament_after") {
        assert(ls.includes("（次も、これくらいのを出さないとな）"));
        assert.equal(!!result.current.flags.interview_pride, opts.choice === 0);
        assert.equal(!!result.current.flags.interview_honest, opts.choice === 1);
        assert.equal(!!result.current.flags.interview_sumi, opts.choice === 2);
      }
      if (opts.id === "ch1_tsumugi_sketch") assert(ls.includes("……はい。葉っぱを描かない日もあるけど、いつも、この子です"));
      if (opts.id === "ch1_salaryman_change") assert(ls.includes("え、まだ決まってないの。……じゃあ、着いてから一緒に選ぼう"));
    }
    console.log(`Compared ${scenarios.length} current/baseline scene paths: unchanged state except intentional vanilla lesson`);
  });
  for (const [label, options, touch] of [
    ["pc", { viewport: { width: 1280, height: 720 } }, false],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) {
    await check(`${label}-opening-keeps-faceless-cuts`, async page => {
      await prepare(page);
      await page.evaluate(async () => {
        T.fresh(); T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4;
        T.core.state.flags._intro_hajime = T.core.state.flags._intro_sumi = true;
        window.finished = false;
        (await import("./js/scenes/tonari-opening.js")).playTonariOpening()
          .then(() => { window.finished = true; });
      });
      await advanceTo(page, "……今日の、良かったよ", touch);
      assert.equal(await page.locator(".tonari-opening").count(), 1);
      assert.equal(await page.locator('img[data-speaker="salaryman"]').count(), 0);
      assert.equal(await page.locator(".vn-name").textContent(), "サラリーマン");
      await page.screenshot({ path: `${shotDir}/${label}-opening-faceless.png` });
      const skip = page.getByRole("button", { name: "SKIP", exact: true });
      if (touch) await skip.tap(); else await skip.click();
      // SKIP preserves native choice interaction.
      for (let i = 0; i < 100 && !await page.evaluate(() => window.finished); i++) {
        const choice = page.locator(".vn-choices button").first();
        if (await choice.isVisible()) { if (touch) await choice.tap(); else await choice.click(); }
        await page.waitForTimeout(100);
      }
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      assert.equal(await page.locator(".tonari-opening").count(), 0);
    }, options);
    await check(`${label}-four-portrait-scenes-and-skip`, async page => {
      await prepare(page);
      await page.evaluate(() => { T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4; T.fresh(); window.finished = false;
        T.vn.play("ch1_salaryman_regular").then(() => { window.finished = true; }); });
      await advanceTo(page, "いつものサラリーマンが、いつもの席に座る。襟元に指を入れて、無言でメニューを指差した。", touch);
      await snapshotPortrait(page, "normal");
      await page.screenshot({ path: `${shotDir}/${label}-salaryman-regular.png` });
      const skip = page.getByRole("button", { name: "SKIP", exact: true });
      if (touch) await skip.tap(); else await skip.click();
      const service = page.locator(".vn-choices button");
      await service.first().waitFor();
      await page.waitForTimeout(200);
      assert.deepEqual(await service.allTextContents(), ["注文を先に聞く", "水を出して少し待つ"]);
      assert.equal(await page.evaluate(() => window.finished), false, "SKIP passed an unanswered service choice");
      assert.deepEqual(await page.evaluate(() => [T.core.state.flags._salaryman_service_order ?? null,
        T.core.state.flags._salaryman_service_water ?? null]), [null, null]);
      if (touch) await service.nth(1).tap(); else await service.first().click();
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      assert.deepEqual(await page.evaluate(() => [T.core.state.flags._salaryman_service_order,
        T.core.state.flags._salaryman_service_water]), [!touch, touch]);
      assert.equal(await page.locator('img[data-speaker="salaryman"]').count(), 0);
      await page.evaluate(() => { T.fresh(); window.finished = false;
        T.vn.play("ch1_salaryman_change").then(() => { window.finished = true; }); });
      await advanceTo(page, "夜のtonari。いつもの時間に、いつものサラリーマンが来た。……でも、今日は少し違う。", touch);
      const normal = await snapshotPortrait(page, "normal");
      await page.screenshot({ path: `${shotDir}/${label}-salaryman-change-normal.png` });
      await advanceTo(page, "小さく笑って電話を切り、スマホをしまった。肩がほんの少しだけ下がっていた。", touch);
      const smile = await snapshotPortrait(page, "smile");
      assert.deepEqual(smile, normal, "Portrait frame moved on expression change");
      await assertFits(page, ".vn-box");
      await page.screenshot({ path: `${shotDir}/${label}-salaryman-change-smile.png` });
      await advanceTo(page, "奥の席で、つむぎが画面から顔を上げていた。", touch);
      assert.equal(await page.locator('img[data-speaker="salaryman"]').count(), 0, "Salaryman remained after departure");
      await page.screenshot({ path: `${shotDir}/${label}-salaryman-departed.png` });
      if (touch) await skip.tap(); else await skip.click();
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      for (const [id, text, face] of [
        ["ch2_sofa_burn", "……気にしないで", "smile"],
        ["ch2_sumi_silence", "はじめくん、県大会に出るんでしょう。すごいことですよ", "normal"],
      ]) {
        await page.evaluate(id => { T.fresh(); T.core.state.chapter = 2; window.finished = false;
          T.vn.play(id).then(() => { window.finished = true; }); }, id);
        await advanceTo(page, text, touch); await snapshotPortrait(page, face);
        await assertFits(page, ".vn-box");
        await page.screenshot({ path: `${shotDir}/${label}-${id}.png` });
        if (touch) await skip.tap(); else await skip.click();
        await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      }
    }, options);
  }
  await check("interrupted-night-save-reload-once", async page => {
    await prepare(page);
    await page.evaluate(() => {
      T.fresh(); T.core.state.flags._ev_salaryman = true;
      T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4;
      T.night.syncNightQueue(T.ch1.NIGHT_EVENTS);
      T.night.runNightPlan(T.ch1.NIGHT_EVENTS).then(() => { window.finished = true; });
    });
    await advanceTo(page, "小さく笑って電話を切り、スマホをしまった。肩がほんの少しだけ下がっていた。", false);
    const saved = await page.evaluate(() => { T.core.saveToSlot("suien_remake_slot1"); return structuredClone(T.core.state); });
    assert.equal(!!saved.flags._ev_salaryman_change, false);
    await page.reload(); await page.locator(process.env.READY_SELECTOR || '[data-test="title-new"]').waitFor(); await prepare(page);
    const result = await page.evaluate(async () => {
      T.core.loadFromSlot("suien_remake_slot1"); T.vn.vnTest.turbo = true;
      T.night.syncNightQueue(T.ch1.NIGHT_EVENTS);
      await T.night.runNightPlan(T.ch1.NIGHT_EVENTS);
      const lines = T.lines();
      T.core.saveToSlot("suien_remake_slot1");
      const once = structuredClone(T.core.state);
      T.core.loadFromSlot("suien_remake_slot1");
      const reloaded = structuredClone(T.core.state);
      T.vn.backlog().length = 0; await T.night.runNightPlan(T.ch1.NIGHT_EVENTS);
      return { once, reloaded, twice: structuredClone(T.core.state), lines, reread: T.lines() };
    });
    assert(result.once.flags._ev_salaryman_change);
    // Production manual LOAD refreshes savedAt; every game field must be equal.
    const { savedAt: onceAt, ...onceGame } = result.once;
    const { savedAt: loadAt, ...loadedGame } = result.reloaded;
    assert(loadAt >= onceAt);
    assert.deepEqual(loadedGame, onceGame, "Manual LOAD changed game state");
    assert.deepEqual(result.twice, result.reloaded, "Repeated night duplicated rewards");
    assert.deepEqual(result.reread, []);
    assert.equal(result.lines.filter(t => t === "小さく笑って電話を切り、スマホをしまった。肩がほんの少しだけ下がっていた。").length, 1);
  });
});
