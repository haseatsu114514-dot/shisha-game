import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot } from "./support.mjs";
const root = page => page.locator('[data-test="axe-game"]');
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
const captureDir = process.env.COMPARISON_DIR;
async function capture(page, name) {
  if (captureDir) { await fs.mkdir(captureDir, { recursive: true }); await page.screenshot({ path: `${captureDir}/${name}.png` }); }
}
async function fit(page) {
  const checks = await page.locator('.axe-header, .axe-panel, .axe-button, .axe-comment, .axe-note, .axe-match-score, .axe-match-records').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect();
    return { text: n.textContent, visible: r.width > 0 && r.height > 0,
      fits: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1
        && n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1 };
  }));
  for (const c of checks) if (c.visible) assert(c.fits, JSON.stringify(c));
  if (await root(page).count()) {
    const board = await page.locator('.axe-target').boundingBox(); assert(board?.height > 100);
  }
}
async function press(page, { touch = false, keyboard = false } = {}) {
  const button = page.locator('[data-test="axe-action"]:not([disabled])'); await button.waitFor();
  if (keyboard) { await root(page).focus(); await page.keyboard.press("Space"); }
  else if (touch) await button.tap(); else await button.click();
}
async function stop(page, value, options) {
  if (options?.precise) await root(page).focus();
  // The press lands on the first frame inside the window, so a precise stop opens its window just before the value.
  await page.waitForFunction(([value, precise]) => {
    const game = document.querySelector('[data-test="axe-game"]'), t = Number(game.dataset.timing);
    return !game.querySelector('[data-test="axe-action"]').disabled && t >= value - (precise ? .008 : .02) && t <= value + .015;
  }, [value, Boolean(options?.precise)]);
  if (options?.precise) await page.keyboard.press("Space");
  else await press(page, options);
}
async function shoot(page, options = {}) {
  await phase(page, "choice"); await press(page, options); await phase(page, "horizontal");
  await stop(page, .5, options); await phase(page, "vertical");
  await stop(page, .5, options); await phase(page, "power");
  if (options.focus) {
    const [x, y] = await root(page).evaluate(game => [Number(game.dataset.aimX), Number(game.dataset.aimY)]);
    if (Math.abs(x) > .03 || Math.abs(y) > .15) {
      // The 1.5in bull (radius .051) forgives vertical error through the 4in blade; horizontal error must leave room for focused sway.
      assert((options.attempt || 0) < 5, `Visible center aiming failed: ${x},${y}`);
      await page.locator('[data-test="axe-reaim"]:not([disabled])').click();
      return shoot(page, { ...options, attempt: (options.attempt || 0) + 1 });
    }
    await page.waitForFunction(() => {
      const game = document.querySelector('[data-test="axe-game"]');
      return Number(game.dataset.timing) >= .4 && Number(game.dataset.timing) <= .5;
    });
    await page.locator('[data-test="axe-focus"]').click();
  }
  await stop(page, options.power ?? .62, options); await phase(page, "result");
  assert.equal(await root(page).getAttribute("data-actor"), "player");
}
/** A tie after ten throws goes to sudden death: alternate killshot throws until the game declares a winner. */
async function finishSuddenDeath(page, options = {}, shootInput = { x: 0, y: 0 }) {
  for (let round = 0; round < 12 && await root(page).getAttribute("data-phase") !== "summary"; round++) {
    await phase(page, "choice");
    assert.equal(await root(page).getAttribute("data-sudden-death"), "true");
    assert.equal(await page.locator(".axe-calls").count() && await page.locator(".axe-calls").isHidden(), true, "no call buttons in sudden death");
    await shoot(page, { ...options, ...shootInput });
    assert.equal(await root(page).getAttribute("data-player-throws"), "10", "sudden death adds no game throws");
    await press(page, options); await phase(page, "opponent-ready"); await phase(page, "result");
    assert.match(await page.locator('[data-test="axe-call-status"]').textContent(), /サドンデス/);
    await press(page, options);
    await page.waitForFunction(() => ["choice", "summary"].includes(document.querySelector('[data-test="axe-game"]')?.dataset.phase));
  }
  await phase(page, "summary");
}
async function start(page, difficulty = "normal", options = {}) {
  await page.goto(new URL("axe-throw.html", page.url()).href);
  await page.evaluate(() => {
    localStorage.setItem("suien_remake_save", JSON.stringify({ schema: 5, money: 45678, stamina: 71,
      lovers: ["rin"], flags: { _friend_hiyori: true }, inbox: [{ id: "keep", read: true }],
      pendingInvite: { sender: "hiyori", day: 10, slot: 1 }, affinity: { hiyori: 66 } }));
    sessionStorage.setItem("keep", "unchanged");
  });
  assert.equal(await page.locator('[data-difficulty="normal"]').getAttribute("aria-pressed"), "true");
  await page.locator(`[data-difficulty="${difficulty}"]`).click();
  await fit(page);
  const button = page.locator('[data-test="axe-versus"]');
  if (options.keyboard) { await button.focus(); await page.keyboard.press("Enter"); }
  else if (options.touch) await button.tap(); else await button.click();
  // A second same-host call observes the existing Promise; no state or outcomes are injected.
  await page.evaluate(() => { window.matchPromise = import("./js/minigames/axe.js").then(m => m.runAxeThrow({host:document.getElementById("axe-app")})); });
  await phase(page, "choice"); await fit(page);
}
await suite("axe-versus", async check => {
  for (const [label, options, context, difficulty] of [
    ["pc", {}, {}, "normal"],
    ["touch-landscape", { touch: true }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, "easy"],
    ["touch-portrait", { touch: true }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "normal"],
    ["keyboard-reduced", { keyboard: true }, { reducedMotion: "reduce" }, "hard"],
  ]) await check(label + "-twenty-throws", async page => {
    await start(page, difficulty, options); const before = await storageSnapshot(page);
    for (let i = 1; i <= 10; i++) {
      await shoot(page, options);
      assert.equal(await root(page).getAttribute("data-player-throws"), String(i));
      assert.equal(await root(page).getAttribute("data-opponent-throws"), String(i - 1));
      if (i === 1) { await fit(page); await capture(page, label + "-player-result"); }
      await press(page, options); await phase(page, "opponent-ready");
      assert.equal(await root(page).getAttribute("data-actor"), "opponent");
      if (i === 5 || i === 10) {
        // Throw five calls the upper-left blue. Throw ten calls lower-left, unless a bonus call earned by a drop was spent on throw eight at that height, which sends the last call to the opposite row.
        if (i === 5) assert.equal(await root(page).getAttribute("data-called"), "upper-left");
        else assert.match(await root(page).getAttribute("data-called"), /^(upper|lower)-left$/);
        assert.match(await page.locator('.axe-comment').textContent(), /キルショット/);
      }
      await phase(page, "result");
      assert.equal(await root(page).getAttribute("data-opponent-throws"), String(i));
      if (i === 1) { await fit(page); await capture(page, label + "-opponent-result"); }
      await press(page, options);
    }
    if (await root(page).getAttribute("data-phase") !== "summary") await finishSuddenDeath(page, options);
    await phase(page, "summary"); await fit(page); await capture(page, label + "-summary");
    assert.match(await page.locator('.axe-note').textContent(), /勝ち/);
    assert.equal(await page.locator('.axe-match-records > div').count(), 2);
    await press(page, options);
    const result = await page.evaluate(() => window.matchPromise);
    assert(result.completed && !result.cancelled);
    assert.equal(result.mode, "versus"); assert.equal(result.match.difficulty, difficulty);
    assert.equal(result.throws.length, 10); assert.equal(result.match.opponent.length, 10);
    assert.deepEqual(result.throws, result.match.player);
    assert.equal(result.total, result.match.playerTotal);
    assert.equal(result.match.playerTotal, result.match.player.reduce((sum, s) => sum + s.score, 0));
    assert.equal(result.match.opponentTotal, result.match.opponent.reduce((sum, s) => sum + s.score, 0));
    assert.equal(result.match.winner, result.match.playerTotal === result.match.opponentTotal ? result.match.suddenDeath.winner
      : result.match.playerTotal > result.match.opponentTotal ? "player" : "opponent");
    if (result.match.playerTotal === result.match.opponentTotal) assert(result.match.suddenDeath.rounds >= 1 && ["player", "opponent"].includes(result.match.winner));
    const scoring = await page.evaluate(async result => {
      const model = await import("./js/minigames/axe-model.js");
      return [result.match.player, result.match.opponent].every(history => history.every((s, i) =>
        JSON.stringify(model.resolveThrow({ ...s.aim, power: s.power, called: s.called }, history.slice(0, i), { division: result.match.division, throws: 10 })) ===
        JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !["baseAim", "sway"].includes(k))))));
    }, result);
    assert(scoring, "every rendered shot uses resolveThrow and its own history");
    assert.deepEqual(await storageSnapshot(page), before);
  }, context);

  await check("seeded-tie-goes-to-sudden-death-and-retry-clears-both-histories", async page => {
    await page.goto(new URL("axe-throw.html", page.url()).href);
    await page.evaluate(async () => {
      const mini = await import("./js/minigames/axe.js");
      window.matchPromise = mini.runAxeThrow({ host: document.getElementById("axe-app"), mode: "versus", difficulty: "hard", seed: 0 });
    });
    await phase(page, "choice");
    const before = await storageSnapshot(page);
    for (let i = 1; i <= 10; i++) {
      await shoot(page, { focus: true, precise: true });
      assert.match(await page.locator('.axe-note').textContent(), /6点/, "real focused bull must score six");
      await press(page); await phase(page, "opponent-ready"); await phase(page, "result"); await press(page);
    }
    await phase(page, "choice");
    assert.equal(await root(page).getAttribute("data-player-throws"), "10");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "10");
    assert.match(await page.locator('.axe-match-score').textContent(), /あなた 60 — 60 ひより/);
    assert.equal(await root(page).getAttribute("data-sudden-death"), "true");
    assert.equal(await root(page).getAttribute("data-called"), "upper-left", "sudden death starts at the upper-left blue");
    assert.match(await page.locator('.axe-comment').textContent(), /同点|決着/);
    await capture(page, "seeded-tie-sudden-death");
    // The player throws at the centre (zero on a called blue); the hard opponent decides the round on the blue or by distance.
    await finishSuddenDeath(page, { focus: true, precise: true });
    assert.match(await page.locator('.axe-match-score').textContent(), /あなた 60 — 60 ひより/);
    assert.match(await page.locator('.axe-note').textContent(), /勝ち.*サドンデス/);
    assert.equal(await page.locator('.axe-tile-sd').count() >= 2, true, "sudden-death tiles join both scoreboard rows");
    await capture(page, "seeded-tie-summary");
    const finished = await page.evaluate(() => JSON.parse(document.querySelector('[data-test="axe-game"]').dataset.suddenDeathRounds));
    assert(finished >= 1);
    await page.locator('[data-test="axe-retry"]:not([disabled])').click(); await phase(page, "choice");
    assert.equal(await root(page).getAttribute("data-player-throws"), "0");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "0");
    assert.match(await page.locator('.axe-call-status').textContent(), /残り2回/);
    await page.keyboard.press("Escape");
    const result = await page.evaluate(() => window.matchPromise);
    assert.equal(result.match.seed, 0); assert.equal(result.match.winner, null);
    assert.deepEqual(result.match.player, []); assert.deepEqual(result.match.opponent, []);
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("opponent-lock-pause-double-input-and-cancel", async page => {
    await start(page); const before = await storageSnapshot(page);
    await shoot(page); await press(page); await phase(page, "opponent-ready");
    await page.waitForTimeout(300);
    await root(page).evaluate(game => {
      for (let i = 0; i < 8; i++) game.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      for (const selector of ['[data-call="upper-left"]', '[data-test="axe-reaim"]', '[data-test="axe-focus"]'])
        game.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(await root(page).getAttribute("data-phase"), "opponent-ready");
    assert.equal(await root(page).getAttribute("data-player-throws"), "1");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "0");
    await page.evaluate(() => {
      window.testHidden = true;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => window.testHidden });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(1200);
    assert.equal(await root(page).getAttribute("data-phase"), "opponent-ready");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "0");
    assert.equal(await root(page).getAttribute("data-called"), "");
    await page.evaluate(() => { window.testHidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    await page.locator('[data-test="axe-rules"]').click();
    await page.waitForTimeout(1200);
    assert.equal(await root(page).getAttribute("data-phase"), "opponent-ready");
    assert.equal(await root(page).getAttribute("data-opponent-throws"), "0");
    await page.keyboard.press("Escape");
    await phase(page, "flight");
    await page.locator('[data-test="axe-cancel"]').click();
    const cancelled = await page.evaluate(() => window.matchPromise);
    assert(cancelled.cancelled && !cancelled.completed);
    assert.equal(cancelled.match.winner, null); assert.equal(cancelled.match.player.length, 1); assert.equal(cancelled.match.opponent.length, 0);
    assert.deepEqual(await storageSnapshot(page), before);
    await page.locator('[data-test="axe-versus"]').click(); await phase(page, "choice");
    assert.equal(await root(page).getAttribute("data-player-throws"), "0");
    await page.keyboard.press("Escape");
  });

  await check("abort-detach-load-and-same-host-lifecycle", async page => {
    const setup = async () => page.evaluate(async () => {
      window.core = await import("./js/core/state.js"); window.mini = await import("./js/minigames/axe.js");
      const s = core.newGame(); s.money = 12345; s.flags._friend_hiyori = true;
      core.save(); window.beforeState = JSON.stringify(core.state);
      window.abort = new AbortController();
      window.gamePromise = mini.runAxeThrow({ host: document.getElementById("stage"), mode: "versus", seed: 489, signal: abort.signal });
      window.duplicate = window.gamePromise === mini.runAxeThrow({host:document.getElementById("stage")});
    });
    for (const reason of ["abort", "detach", "load", "pagehide", "screen"]) {
      await setup(); await phase(page, "choice"); assert(await page.evaluate(() => window.duplicate));
      await shoot(page); await press(page); await phase(page, "opponent-ready");
      const before = await storageSnapshot(page);
      if (reason === "abort") await page.evaluate(() => window.abort.abort());
      if (reason === "detach") await page.evaluate(() => document.querySelector('[data-test="axe-game"]').remove());
      if (reason === "pagehide") await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      if (reason === "screen") await page.evaluate(async () => (await import("./js/core/ui.js")).showScreen("test", document.createElement("div")));
      if (reason === "load") await page.evaluate(async () => {
        // A real state LOAD followed by its caller's AbortSignal cancels the old game.
        core.load(); abort.abort();
      });
      const cancelled = await page.evaluate(() => Promise.race([
        window.gamePromise, new Promise((_, reject) => setTimeout(() => reject(new Error("Match cleanup did not settle")), 2000)),
      ]));
      assert(cancelled.cancelled && !cancelled.completed && cancelled.match.winner === null);
      assert.equal(cancelled.match.opponent.length, 0); assert.equal(await root(page).count(), 0);
      assert.deepEqual(await storageSnapshot(page), before);
      assert(await page.evaluate(() => JSON.stringify(core.state) === beforeState), "game must preserve the live state too");
    }
    const invalid = await page.evaluate(async () => {
      const signal = new AbortController(); signal.abort();
      const result = await mini.runAxeThrow({mode:"versus", signal:signal.signal});
      const rejected = await Promise.all([
        mini.runAxeThrow({mode:"versus", opponent:null}), mini.runAxeThrow({mode:"versus", difficulty:"fake"}),
      ].map(p => p.then(() => false, e => e instanceof RangeError)));
      return { result, rejected };
    });
    assert(invalid.result.cancelled && invalid.result.match.player.length === 0); assert(invalid.rejected.every(Boolean));
  });
});
