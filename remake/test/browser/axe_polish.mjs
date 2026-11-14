import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";
import { KILLS } from "../../js/minigames/axe-model.js";
import { TARGET } from "../../js/minigames/axe-flight.js";

const root = page => page.locator('[data-test="axe-game"]');
const phase = (page, expected) => page.waitForFunction(expected =>
  document.querySelector('[data-test="axe-game"]')?.dataset.phase === expected, expected);
const output = process.env.COMPARISON_DIR;
const sizes = [];

async function capture(page, name) {
  if (!output) return;
  await fs.mkdir(output, { recursive: true });
  // CSS arrival animation uses the browser animation timeline, not the controlled game clock.
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/polish-${name}.png` });
}
async function start(page, options = {}) {
  await page.goto(new URL("axe-throw.html?input=gauges", page.url()).href);
  await page.evaluate(async options => {
    // This context is disposable. No game save is created or edited by the fixture.
    localStorage.setItem("axe-polish-fixture", "unchanged");
    sessionStorage.setItem("axe-polish-fixture", "unchanged");
    const { runAxeThrow } = await import("./js/minigames/axe.js");
    window.axePolishPromise = runAxeThrow({ inputMode: "gauges",  host: document.getElementById("axe-app"), ...options });
  }, options);
  await phase(page, "choice");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  return storageSnapshot(page);
}
async function hit(page, selector, touch = false) {
  if (touch) await page.locator(selector).tap(); else await page.locator(selector).click();
}
async function action(page, touch = false) {
  await page.clock.runFor(300);
  await hit(page, '[data-test="axe-action"]:not([disabled])', touch);
}
async function gauge(page, value, cycle) {
  await page.clock.runFor(20);
  const current = Number(await root(page).getAttribute("data-timing"));
  assert(current < value, "Read the rising gauge before its stop point");
  await page.clock.runFor(Math.ceil((value - current) * cycle / 2));
}
async function gauge_(page, value) {
  const current = Number(await root(page).getAttribute("data-timing"));
  assert(current < value, "Read the rising gauge before its stop point");
  await page.clock.runFor(Math.ceil((value - current) * 2400 / 2));
}
async function boardStop(page, value, cycle, next, touch) {
  await gauge(page, value, cycle);
  assert.equal(await page.locator(".axe-target").getAttribute("aria-disabled"), "false");
  await hit(page, ".axe-target", touch);
  await phase(page, next);
}
async function throwWithBoard(page, { touch = false, power = .62, focus = true, finish = 1320 } = {}) {
  await action(page, touch); await phase(page, "horizontal");
  await boardStop(page, .5, 3600, "vertical", touch);
  await boardStop(page, .5, 3600, "power", touch);
  if (focus) {
    await gauge(page, .4, 2400);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(await root(page).getAttribute("data-focused"), "true");
  }
  await boardStop(page, power, 2400, "flight", touch);
  await page.clock.runFor(finish); await phase(page, "result");
}
async function fits(page) {
  const checks = await root(page).locator(".axe-header, .axe-panel, .axe-button, .axe-total, .axe-result-card, .axe-result-tip, .axe-comment").evaluateAll(nodes =>
    nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent, box: { width: r.width, height: r.height },
        scroll: { width: node.scrollWidth, height: node.scrollHeight }, client: { width: node.clientWidth, height: node.clientHeight },
        visible: r.width > 0 && r.height > 0,
        fits: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
          && node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 };
    }));
  for (const check of checks) if (check.visible) assert(check.fits, JSON.stringify(check));
}
async function cancel(page, before) {
  await root(page).focus(); await page.keyboard.press("Escape");
  const result = await page.evaluate(() => window.axePolishPromise);
  assert(result.cancelled && !result.completed);
  assert.deepEqual(await storageSnapshot(page), before);
  return result;
}

await suite("axe-polish", async check => {
  for (const [label, context, touch, minimum] of [
    ["pc", { viewport: { width: 1280, height: 800 } }, false, 300],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true, 145],
  ]) await check(`${label}-board-input-results-and-total`, async page => {
    const before = await start(page);
    const shown = [];
    for (let i = 0; i < 3; i++) {
      await throwWithBoard(page, { touch, power: i === 0 ? .93 : .62, focus: i !== 0 });
      await fits(page);
      const result = await page.locator('[data-test="axe-result"]').innerText();
      if (i === 0) { assert.match(result, /DROP/); assert.match(result, /54〜70%/); }
      else { assert.match(result, /BULL'S EYE/); assert.match(result, /赤い中心に命中/); }
      shown.push(Number(await page.locator(".axe-result-value > span").textContent()));
      assert.equal(Number(await page.locator(".axe-total strong").textContent()), shown.reduce((a, b) => a + b, 0));
      if (i === 1) {
        const board = await page.locator(".axe-target-art .axe-plank image").boundingBox();
        assert(board.width > minimum, `Usable wood target width: ${board.width}`);
        sizes.push({ label, viewport: page.viewportSize(), phase: "result", woodWidth: board.width, woodHeight: board.height });
        await capture(page, `${label}-bull-result`);
        // #3423: the throw result sits on the painted chalkboard window.
        assert.match(await page.locator(".axe-result-card").evaluate(node => getComputedStyle(node, "::before").borderImageSource), /chalk-window\.webp/);
      }
      await action(page, touch);
      if (i < 2) await phase(page, "choice");
      if (i === 1) {
        // #3423: the LAST THROW cue is the painted orange lane sign, and its words stay inside the sign.
        const cue = page.locator('[data-test="axe-last-cue"]');
        await cue.waitFor();
        assert.match(await cue.evaluate(node => getComputedStyle(node, "::before").borderImageSource), /banner-orange\.webp/);
        const words = await cue.evaluate(node => [...node.children].map(child => child.scrollWidth <= child.clientWidth + 1));
        assert.deepEqual(words, [true, true]);
        await capture(page, `${label}-last-throw`);
      }
    }
    await phase(page, "summary"); await fits(page);
    // #3423: the summary is the large chalkboard window and the rank letter is branded on the pine medallion.
    assert.match(await page.locator(".axe-panel").evaluate(node => getComputedStyle(node, "::before").borderImageSource), /chalk-window\.webp/);
    assert.match(await page.locator(".axe-rank strong").evaluate(node => getComputedStyle(node).backgroundImage), /rank-medallion\.webp/);
    assert.match(await page.locator(".axe-result-tip").textContent(), /平均 4\.00点\/投 · ブル 2 · キル 0\/0 · 落下 1/);
    const displayedTotal = Number(await page.locator(".axe-total strong").textContent());
    await capture(page, `${label}-summary`); await action(page, touch);
    const completed = await page.evaluate(() => window.axePolishPromise);
    assert(completed.completed && !completed.cancelled);
    assert.deepEqual(completed.throws.map(s => s.score), shown);
    assert.equal(completed.total, displayedTotal);
    assert.equal(completed.total, completed.throws.reduce((sum, shot) => sum + shot.score, 0));
    assert.deepEqual(await storageSnapshot(page), before);
  }, context);

  await check("keyboard-focus-is-once-and-reaim-keeps-use", async page => {
    const before = await start(page);
    await action(page); await phase(page, "horizontal"); await page.clock.runFor(300);
    await root(page).focus();
    for (const modifier of ["Control", "Meta", "Alt"]) {
      await page.keyboard.press(`${modifier}+f`);
      assert.equal(Number(await root(page).getAttribute("data-focus-remaining")), 0, `${modifier}+F must preserve focus`);
      assert(!await page.locator('[data-test="axe-focus"]').isDisabled());
    }
    await root(page).focus(); await page.keyboard.press("f");
    const first = Number(await root(page).getAttribute("data-focus-remaining"));
    assert(first > 1100);
    await page.clock.runFor(400); await page.keyboard.press("F");
    const second = Number(await root(page).getAttribute("data-focus-remaining"));
    assert(second < first - 300, "Repeated F must not refill focus");
    await page.locator('[data-test="axe-reaim"]').click(); await phase(page, "choice");
    await action(page); await phase(page, "horizontal"); await page.clock.runFor(300);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(Number(await root(page).getAttribute("data-focus-remaining")), 0);
    assert(await page.locator('[data-test="axe-focus"]').isDisabled());
    const result = await cancel(page, before); assert.equal(result.throws.length, 0);
  });

  await check("impact-pauses-in-rules-and-opponent-rejects-shortcuts", async page => {
    const before = await start(page, { mode: "versus", autoAdvance: false, difficulty: "hard", seed: 9 });
    await throwWithBoard(page, { finish: 960 });
    const effect = page.locator(".axe-impact-fx");
    assert(Number(await effect.getAttribute("opacity")) > 0, "Scoring impact starts visibly");
    await page.locator('[data-test="axe-rules"]').click();
    const frozen = await effect.evaluate(n => n.outerHTML);
    await page.clock.runFor(1000);
    assert.equal(await effect.evaluate(n => n.outerHTML), frozen, "Rules pause the complete impact effect");
    await page.locator('[data-test="axe-rules-close"]').click();
    await capture(page, "pc-impact");
    await page.clock.runFor(1250); assert.equal(Number(await effect.getAttribute("opacity")), 0);
    await action(page); await phase(page, "opponent-ready");
    const actorBefore = await root(page).evaluate(n => ({ actor: n.dataset.actor, held: n.dataset.held,
      player: n.dataset.playerThrows, opponent: n.dataset.opponentThrows, focus: n.dataset.focusRemaining }));
    const board = await page.locator(".axe-target").boundingBox();
    // Physical input on a disabled board exercises its event guard; locator.click would refuse the test input.
    await page.mouse.click(board.x + board.width / 2, board.y + board.height / 2);
    await root(page).focus(); await page.keyboard.press("f");
    assert.equal(await root(page).getAttribute("data-phase"), "opponent-ready");
    assert.equal(await page.locator(".axe-target").getAttribute("aria-disabled"), "true");
    assert.deepEqual(await root(page).evaluate(n => ({ actor: n.dataset.actor, held: n.dataset.held,
      player: n.dataset.playerThrows, opponent: n.dataset.opponentThrows, focus: n.dataset.focusRemaining })), actorBefore);
    const result = await cancel(page, before); assert.equal(result.match.player.length, 1); assert.equal(result.match.opponent.length, 0);
  });

  await check("reduced-motion-keeps-result-without-impact-animation", async page => {
    const before = await start(page, { reducedMotion: true });
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .5, 3600, "vertical", false);
    await boardStop(page, .5, 3600, "power", false);
    await gauge(page, .4, 2400); await root(page).focus(); await page.keyboard.press("f");
    await gauge(page, .62, 2400); await page.locator(".axe-target").click();
    await page.clock.runFor(40); await phase(page, "result");
    assert.match(await page.locator(".axe-result-label").textContent(), /BULL'S EYE/);
    assert.equal(Number(await page.locator(".axe-impact-fx").getAttribute("opacity")), 0);
    assert.equal(await page.locator(".axe-result-card").evaluate(n => getComputedStyle(n).animationName), "none");
    const result = await cancel(page, before); assert.equal(result.throws[0].score, 6);
  }, { reducedMotion: "reduce" });

  await check("green-power-cue-and-zero-point-wood-contact-never-celebrate", async page => {
    const before = await start(page, { opponent: null });
    await page.evaluate(() => {
      window.axeSoundStarts = 0;
      for (const type of [OscillatorNode, AudioBufferSourceNode]) {
        const start = type.prototype.start;
        type.prototype.start = function (...args) {
          window.axeSoundStarts++;
          return start.apply(this, args);
        };
      }
    });
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .995, 3600, "vertical", false);
    await boardStop(page, .995, 3600, "power", false);
    await gauge(page, .62, 2400);
    assert.equal(await page.locator(".axe-timing").getAttribute("data-quality"), "sweet");
    assert.match(await page.locator('[data-test="axe-power-cue"]').textContent(), /いま放す/);
    assert.equal(await root(page).getAttribute("data-preview-score"), "0");
    await capture(page, "pc-green-power");
    await page.locator(".axe-target").click();
    const beforeImpact = await page.evaluate(() => window.axeSoundStarts);
    assert(beforeImpact > 0, "the throw must schedule sound layers");
    const predicted = await root(page).evaluate(n => ({ x: Number(n.dataset.landingX), y: Number(n.dataset.landingY) }));
    // 2026-11-13 手応えレビュー指摘6: 木に刺さった事実には物理の反応（木片・暗い閃光・揺れ）だけを返し、祝福（色の輪・+N・歓声）は出さない
    await page.clock.runFor(700); await phase(page, "result");
    assert.equal(await root(page).getAttribute("data-impact"), "physical");
    assert(Number(await page.locator(".axe-impact-fx").getAttribute("opacity")) > 0, "the wood reacts to the bite");
    assert.equal(await page.locator(".axe-score-burst").textContent(), "MISS");
    assert.equal(Number(await page.locator(".axe-impact-fx circle[stroke-width='3']").getAttribute("opacity")), 0, "no coloured celebration ring");
    await page.clock.runFor(620);
    assert.equal(await page.locator(".axe-total strong").textContent(), "0");
    assert.equal(Number(await page.locator(".axe-impact-fx").getAttribute("opacity")), 0);
    // 2026-11-11 効果音の作り直し（AXQ01）: 刺さる音は読めていればファイル1つ（読めるまでは合成の7層）。失敗音は合成の1層。歓声は鳴らさない。
    const played = await page.evaluate(async () => (await import("./js/core/audio.js")).axeSePlayed());
    assert.equal((played.stick?.recorded || 0) + (played.stick?.synth || 0), 1, "the zero-point axe thuds into the wood once");
    assert.equal(played.miss?.synth, 1, "and the failure tone follows");
    assert.equal(played.cheer, undefined, "no cheer for zero points");
    assert.equal((await page.evaluate(() => window.axeSoundStarts)) - beforeImpact, (played.stick.recorded ? 1 : 7) + 1,
      "zero-point wood contact schedules the impact and miss layers, without the cheer");
    await capture(page, "pc-zero-point-wood");
    // The five planks are wider than the sweep, so the corner is wood: the axe sticks for zero without any celebration.
    assert.equal(await page.locator(".axe-impacts > g").count(), 1);
    assert.equal(await page.locator(".axe-impacts > g").getAttribute("data-scored"), "false");
    const result = await cancel(page, before), shot = result.throws[0];
    assert(shot.stuck && shot.score === 0 && shot.outcome === "miss" && shot.dropReason === null);
    assert.deepEqual(shot.landing, predicted, "A zero score uses exactly the displayed landing too");
  });
  await check("halo-afterimages-slow-motion-quiver-and-close-up", async page => {
    const before = await start(page, { opponent: null, mode: "league" });
    // Aiming at the centre: the halo outlines the bull the blade would touch.
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .5, 3600, "vertical", false);
    await boardStop(page, .5, 3600, "power", false);
    await gauge(page, .4, 2400); await root(page).focus(); await page.keyboard.press("f");
    await gauge(page, .62, 2400);
    const halo = page.locator(".axe-zone-halo");
    assert.equal(Number(await halo.getAttribute("opacity")) > 0, true);
    assert.equal(await halo.getAttribute("data-kind"), "bull");
    await page.locator(".axe-target").click(); await phase(page, "flight");
    assert.equal(await root(page).getAttribute("data-slow-motion"), "false");
    await page.clock.runFor(240);
    assert(Number(await page.locator(".axe-ghost").first().getAttribute("opacity")) > 0, "afterimages follow the axe mid-flight");
    assert(Number(await page.locator(".axe-contact-shadow").getAttribute("opacity")) > 0, "the contact shadow is on the wood");
    // 2026-11-13 手応えレビュー指摘1: 赤に刺さった瞬間は接触の姿で一拍止める（6点は80ms）。残像はその間に消える
    await page.clock.runFor(400);
    assert.equal(await root(page).getAttribute("data-phase"), "flight", "the bull holds its contact for a beat");
    assert.equal(await root(page).getAttribute("data-hitstop"), "true");
    assert.equal(Number(await page.locator(".axe-ghost").first().getAttribute("opacity")), 0);
    await page.clock.runFor(100); await phase(page, "result");
    assert.equal(Number(await page.locator(".axe-ghost").first().getAttribute("opacity")), 0);
    const zoom = page.locator('[data-test="axe-zoom"]');
    await zoom.waitFor();
    assert.match(await zoom.innerText(), /6点[\s\S]*中央の赤に触れた/);
    assert.equal(await zoom.getAttribute("data-scored"), "true");
    assert.equal(await zoom.locator("use").count(), 1, "the close-up shows the same painted board");
    const quiver = page.locator(".axe-impacts .axe-quiver");
    assert.notEqual(await quiver.getAttribute("transform") || "", "", "the handle quivers right after the thunk");
    await page.clock.runFor(600);
    assert.equal(await quiver.getAttribute("transform"), "", "the quiver settles to the exact embedded pose");
    await capture(page, "pc-close-up");
    // A called throw slows its approach and still lands within 0.9s.
    await action(page); await phase(page, "choice"); assert(await zoom.isHidden());
    await page.clock.runFor(300); await page.locator('[data-call="upper-left"]').click();
    await action(page); await phase(page, "horizontal");
    await boardStop(page, .5, 3600, "vertical", false); await boardStop(page, .5, 3600, "power", false);
    await boardStop(page, .62, 2400, "flight", false);
    assert.equal(await root(page).getAttribute("data-slow-motion"), "true");
    await page.clock.runFor(700); assert.equal(await root(page).getAttribute("data-phase"), "flight", "slow motion stretches the approach");
    // 板に届くのは0.84秒（飛ぶ時計は最初のフレームの分だけ遅れて始まる）。結果はそこから接触の止め（0点で刺されば50ms）の後
    await page.clock.runFor(180); assert.equal(await root(page).getAttribute("data-hitstop"), "true", "the slow throw meets the board within 0.9s");
    await page.clock.runFor(100); await phase(page, "result");
    const result = await cancel(page, before);
    assert.equal(result.throws.length, 2); assert.equal(result.throws[0].score, 6); assert.equal(result.throws[1].called, "upper-left");
  });

  await check("tap-a-blue-on-the-board-to-call-and-the-centre-to-cancel", async page => {
    const before = await start(page, { opponent: null, mode: "league" });
    await page.clock.runFor(300);
    const target = page.locator(".axe-target");
    const at = async (x, y) => {
      const [px, py] = await target.evaluate((svg, [x, y]) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [x, y]);
      await page.mouse.click(px, py);
    };
    // Tap the painted blue itself (its centre in board units, from the model the board is drawn from).
    const blue = id => { const k = KILLS.find(k => k.id === id); return [TARGET.x + k.x * TARGET.radius, TARGET.y + k.y * TARGET.radius]; };
    await at(...blue("upper-left"));
    assert.equal(await root(page).getAttribute("data-called"), "upper-left");
    assert.match(await page.locator('[data-test="axe-call-status"]').textContent(), /左上の青/);
    assert.equal(await page.locator('[data-call="upper-left"]').getAttribute("aria-pressed"), "true");
    await page.clock.runFor(300); await at(TARGET.x, TARGET.y);
    assert.equal(await root(page).getAttribute("data-called"), "");
    await page.clock.runFor(300); await at(...blue("lower-right"));
    assert.equal(await root(page).getAttribute("data-called"), "lower-right");
    await throwWithBoard(page, { focus: false });
    assert.match(await page.locator('[data-test="axe-result"]').innerText(), /MISS/);
    await action(page); await phase(page, "choice");
    assert.match(await page.locator('[data-test="axe-call-status"]').textContent(), /残り1回/);
    const result = await cancel(page, before); assert.equal(result.throws[0].called, "lower-right"); assert.equal(result.division, "rec");
  });

  await check("drop-earns-a-bonus-call-and-the-half-switch-flips-the-lane", async page => {
    const before = await start(page, { opponent: null, mode: "league", division: "pro" });
    assert.equal(await root(page).getAttribute("data-division"), "pro");
    await throwWithBoard(page, { power: .93, focus: false });
    assert.match(await page.locator('[data-test="axe-result"]').innerText(), /追加の宣言/);
    await action(page); await phase(page, "choice");
    assert.match(await page.locator('[data-test="axe-call-status"]').textContent(), /残り3回.*落下で\+1/);
    for (let i = 1; i < 5; i++) { await throwWithBoard(page); await action(page); await phase(page, "choice"); }
    assert.equal(await root(page).getAttribute("data-half"), "1");
    assert.equal(await page.locator(".axe-target").getAttribute("data-half"), "1");
    assert.match(await page.locator('[data-test="axe-note"]').textContent(), /後半5投/);
    assert.equal(await page.locator(".axe-cuts > g").count(), 0, "cuts of the first half are gone with the lane switch");
    assert.equal(await page.locator('[data-test="axe-round"]').textContent(), "6 / 10 投 · 後半");
    const result = await cancel(page, before);
    assert.equal(result.throws.length, 5); assert.equal(result.throws[1].score, 6, "Pro: the first centre bull scores");
    assert.equal(result.throws[2].score, 0, "Pro: the centre five ring is closed for the half");
    assert.equal(result.throws[2].zone.kind, "closed");
  });

  await check("best-of-three-series-opens-a-second-game", async page => {
    const before = await start(page, { mode: "versus", autoAdvance: false, difficulty: "hard", seed: 0, bestOf: 3 });
    for (let i = 0; i < 10; i++) {
      await throwWithBoard(page, { power: .93, focus: false });
      await action(page); await phase(page, "opponent-ready"); await page.clock.runFor(2200); await phase(page, "result"); await action(page);
    }
    await phase(page, "summary");
    assert.match(await page.locator(".axe-result-label").textContent(), /GAME 1 · GOOD MATCH/);
    assert.match(await page.locator('[data-test="axe-match-score"]').textContent(), /0勝1敗/);
    assert.equal(await page.locator('[data-test="axe-action"]').textContent(), "第2ゲームへ");
    assert(await page.locator('[data-test="axe-retry"]').isHidden(), "no retry while the match is open");
    await action(page); await phase(page, "choice");
    assert.equal(await root(page).getAttribute("data-game"), "2");
    assert.equal(await root(page).getAttribute("data-player-throws"), "0");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "0");
    assert.match(await page.locator('[data-test="axe-round"]').textContent(), /G2/);
    const result = await cancel(page, before);
    assert.equal(result.series.bestOf, 3); assert.equal(result.series.games.length, 1);
    assert.deepEqual(result.series.wins, { player: 0, opponent: 1 }); assert.equal(result.series.winner, null);
    assert.equal(result.series.games[0].winner, "opponent");
  });
  // 的に集中する配置（2026-11-10 オーナー指摘）: 的は中央で動かない／狙いの札は的の上に投げる前だけ／回転ゲージは的の右に縦／
  // 見守りとチャレンジは構えたら消える／動かない的と動く照準は別の層で、filter を使わない。
  for (const [label, context, touch] of [
    ["pc", { viewport: { width: 1280, height: 720 } }, false],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-focus-layout`, async page => {
    const parts = new Set();
    page.on("response", response => { const name = response.url().match(/ui\/axe_throw\/((?:gauge|button-throw|tag|hud|score|chalk|rank|banner|wood|cut)-[a-z-]+\.webp)$/)?.[1]; if (name && response.ok()) parts.add(name); });
    const before = await start(page, { mode: "league", opponent: "hiyori", seed: 11, division: "am" });
    const box = selector => page.locator(selector).first().evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
    const shown = selector => page.locator(selector).first().evaluate(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
    const close = (a, b, message) => assert(Math.abs(a - b) <= 1.5, `${message}: ${a} / ${b}`);
    const game = await box('[data-test="axe-game"]'), pane = await box(".axe-board-pane");
    close(pane.width, pane.height, "the board pane is square");
    assert(pane.height >= game.height * .78, `the board uses the body height: ${pane.height} of ${game.height}`);
    assert(Math.abs((pane.left + pane.right) / 2 - (game.left + game.right) / 2) <= game.width * .03, "the board sits in the middle of the stage");
    // Before the throw: the five aim tags sit on the board, and no tag hides a blue killshot.
    const calls = await page.locator(".axe-calls .axe-button").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { id: node.dataset.call, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
    assert.deepEqual(calls.map(c => c.id).sort(), ["lower-left", "lower-right", "normal", "upper-left", "upper-right"]);
    for (const c of calls) assert(c.left >= pane.left - 1 && c.right <= pane.right + 1 && c.top >= pane.top - 1 && c.bottom <= pane.bottom + 1, `the ${c.id} tag is on the board`);
    for (const kill of KILLS) {
      const x = pane.left + (.5 + kill.x * TARGET.radius / 400) * pane.width, y = pane.top + (.5 + kill.y * TARGET.radius / 400) * pane.height;
      assert(!calls.some(c => x >= c.left - 4 && x <= c.right + 4 && y >= c.top - 4 && y <= c.bottom + 4), `no tag covers the ${kill.id} blue`);
    }
    assert.equal(await shown(".axe-companion"), true); assert.equal(await shown(".axe-challenges"), true);
    assert.equal(await shown(".axe-timing"), false, "no gauge before the stance");
    // Two layers: the wood and paint never move; sights, axe and effects are drawn above them. No filter anywhere on the board.
    assert.equal(await page.locator(".axe-target-art .axe-plank image").count(), 1);
    // 動く層には板の絵を置かない。そこにある image は刺さった時に飛ぶ木片の絵（#3423）だけ。
    assert.equal(await page.locator(".axe-target image:not(.axe-chip image)").count(), 0);
    assert.deepEqual(await page.locator(".axe-target .axe-chip image").evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute("href").split("/").pop()))]), ["wood-chips.webp"]);
    assert.equal(await page.locator(".axe-target-art .axe-crosshair, .axe-target-art .axe-flight").count(), 0);
    const filtered = () => page.locator(".axe-board-pane :is(.axe-target-art, .axe-target), .axe-board-pane :is(.axe-target-art, .axe-target) *").evaluateAll(nodes =>
      nodes.filter(node => getComputedStyle(node).filter !== "none" || node.style.filter).map(node => node.getAttribute("class") || node.tagName));
    assert.deepEqual(await filtered(), []);
    // The chosen tag itself shows the choice: a check mark, a bright outline and a larger tag. No "宣言中" caption on screen (kept for screen readers).
    const tag = id => page.locator(`[data-call="${id}"]`).evaluate(node => { const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { pressed: node.getAttribute("aria-pressed"), width: r.width, mark: getComputedStyle(node, "::before").content, outline: parseFloat(style.outlineWidth) || 0, opacity: Number(style.opacity) }; });
    const chosen = async (id, others) => {
      await page.waitForTimeout(250); // the tag's own 0.12s CSS transition runs on the browser timeline, not the controlled game clock
      const on = await tag(id);
      assert.equal(on.pressed, "true"); assert.match(on.mark, /✓/); assert(on.outline >= 1, "the chosen tag has an outline"); assert.equal(on.opacity, 1);
      for (const other of others) {
        const off = await tag(other);
        assert.equal(off.pressed, "false"); assert.doesNotMatch(off.mark, /✓/); assert(off.opacity < 1, other + " steps back");
        if (other !== "normal" && id !== "normal") assert(on.width > off.width * 1.05, `the chosen tag is larger: ${on.width} / ${off.width}`);
      }
    };
    await chosen("normal", ["upper-left", "lower-right"]);
    // Painted parts (#3207): every tag, the throw plate and the gauge frame are drawn from the generated art, not flat CSS boxes.
    const art = (selector, pseudo) => page.locator(selector).first().evaluate((node, pseudo) => {
      const style = getComputedStyle(node, pseudo); return { image: style.borderImageSource, opacity: Number(style.opacity) }; }, pseudo);
    assert.match((await art('[data-call="normal"]', "::after")).image, /tag-selected-amber\.webp/);
    assert.match((await art('[data-call="upper-left"]', "::after")).image, /tag-slate-blue\.webp/);
    assert.match((await art('[data-test="axe-throw"] .axe-throw-button', "::before")).image, /button-throw-orange\.webp/);
    assert.equal((await art('[data-test="axe-throw"] .axe-throw-button', "::after")).opacity, 0);
    assert.deepEqual([...parts].sort(), ["banner-green.webp", "banner-orange.webp", "button-throw-green.webp", "button-throw-orange.webp", "chalk-window.webp", "cut-mark.webp", "gauge-frame.webp", "gauge-needle.webp",
      "hud-plate.webp", "rank-medallion.webp", "score-slot.webp", "tag-selected-amber.webp", "tag-selected.webp", "tag-slate-blue.webp", "tag-slate.webp", "wood-chips.webp"], "all parts are loaded before the first throw");
    // #3423: the header plate, the score slots, the total and the companion's chalkboard are drawn from the generated art, not flat CSS boxes.
    assert.match((await art(".axe-header", "::before")).image, /hud-plate\.webp/);
    assert.match((await art(".axe-tile", "::after")).image, /score-slot\.webp/);
    assert.match((await art(".axe-total", "::before")).image, /score-slot\.webp/);
    assert.match((await art(".axe-side .axe-companion", "::before")).image, /chalk-window\.webp/);
    for (const selector of [".axe-header", ".axe-tile", ".axe-side .axe-companion"]) {
      const flat = await page.locator(selector).first().evaluate(node => getComputedStyle(node).backgroundColor);
      assert.equal(flat, "rgba(0, 0, 0, 0)", selector + " has no flat CSS fill behind the art");
    }
    await hit(page, '[data-call="upper-left"]', touch); await page.clock.runFor(300);
    assert.equal(Number(await page.locator(".axe-called-ring").getAttribute("opacity")), 1);
    await chosen("upper-left", ["normal", "upper-right", "lower-left"]);
    assert.match((await art('[data-call="upper-left"]', "::after")).image, /\/tag-selected\.webp/);
    assert.match((await art('[data-call="normal"]', "::after")).image, /\/tag-slate\.webp/);
    assert.match(await page.locator(".axe-call-status").textContent(), /宣言中：左上の青/);
    const caption = await box(".axe-call-status");
    assert(caption.width <= 2 && caption.height <= 2, "the declared caption is not drawn on the board");
    assert.deepEqual(await filtered(), []);
    await hit(page, '[data-call="normal"]', touch); await page.clock.runFor(300);
    assert.equal(Number(await page.locator(".axe-called-ring").getAttribute("opacity")), 0);
    await chosen("normal", ["upper-left"]);
    // Once the stance is taken, only the board, the gauge and the stop buttons remain.
    await action(page, touch); await phase(page, "horizontal");
    for (const selector of [".axe-calls", ".axe-companion", ".axe-challenges", ".axe-call-status", ".axe-result-card"]) assert.equal(await shown(selector), false, selector + " is gone while aiming");
    const aiming = await box(".axe-board-pane");
    close(aiming.left, pane.left, "the board does not move"); close(aiming.width, pane.width, "the board keeps its size");
    const gauge = await box(".axe-gauge");
    assert(gauge.left >= aiming.right - 1 && gauge.left - aiming.right <= game.width * .03, "the gauge stands right next to the board");
    assert(gauge.height >= aiming.height * .9 && gauge.width * 5 < gauge.height, "the gauge is a tall bar almost as high as the board");
    for (const selector of ['[data-test="axe-action"]', '[data-test="axe-focus"]', '[data-test="axe-reaim"]']) {
      const control = await box(selector);
      assert(control.left >= gauge.right - 1 && control.right <= game.right + 1 && control.bottom <= game.bottom + 1, selector + " stays in the right column");
    }
    await boardStop(page, .5, 3600, "vertical", touch); await boardStop(page, .5, 3600, "power", touch);
    // The needle rises with the rotation (bottom = 0%), moved by transform only.
    const needleAt = () => page.locator('[data-test="axe-needle"]').evaluate(node => ({ transform: node.style.transform, left: node.style.left, y: node.getBoundingClientRect().top }));
    await gauge_(page, .3); const low = await needleAt();
    await gauge_(page, .6); const high = await needleAt();
    assert.equal(low.left, ""); assert.match(low.transform, /^translateY\(/);
    assert(high.y < low.y - gauge.height * .2, `the needle climbs: ${low.y} -> ${high.y}`);
    const sweet = await box(".axe-sweet"), stick = await box(".axe-stick");
    assert(sweet.top > stick.top && sweet.bottom < stick.bottom && sweet.width >= gauge.width * .9, "the green band lies inside the sticking band");
    assert(high.y >= sweet.top - 2 && high.y <= sweet.bottom + 2, "60% is inside the green band");
    assert.match((await art(".axe-body > .axe-timing", "::before")).image, /gauge-frame\.webp/);
    assert.match((await art(".axe-needle", "::before")).image, /gauge-needle\.webp/);
    assert.equal((await art('[data-test="axe-throw"] .axe-throw-button', "::after")).opacity, 1, "the green plate shows while the release is in the green band");
    const slot = await box(".axe-body > .axe-timing");
    assert(gauge.left > slot.left && gauge.right < slot.right && gauge.top > slot.top && gauge.bottom < slot.bottom, "the colour bands sit inside the frame's slot");
    await hit(page, ".axe-target", touch); await phase(page, "flight");
    close((await box(".axe-board-pane")).left, pane.left, "the board does not move in flight");
    assert.equal(await shown(".axe-companion"), false);
    await page.clock.runFor(1320); await phase(page, "result");
    close((await box(".axe-board-pane")).left, pane.left, "the board does not move on the result");
    assert.equal(await shown(".axe-companion"), true); assert.equal(await shown(".axe-result-card"), true);
    assert.deepEqual(await filtered(), []);
    await fits(page); await capture(page, `${label}-focus-result`);
    await cancel(page, before);
  }, context);
await check("touch-portrait-rotate-hint", async page => {
    // 縦持ちスマホは本編と同じく横向き案内で止める（2026-11-09 オーナー決定・#3035／試遊ページ共通化 #3076）
    await page.goto(new URL("axe-throw.html?input=gauges", page.url()).href);
    await page.locator(".axe-menu").waitFor();
    assert.equal(await page.locator("#rotate-hint").isVisible(), true);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});

if (output && sizes.length) await fs.writeFile(`${output}/polish-target-sizes.json`, JSON.stringify(sizes, null, 2) + "\n");
