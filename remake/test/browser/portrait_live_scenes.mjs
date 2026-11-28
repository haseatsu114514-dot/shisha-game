// 縦試作の入口を経由せず、本編の操作・回転・終了コールバックを確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { stanceAt, flickFromHandle } from "./axe_flick_input.mjs";

const tall = { width: 390, height: 844 }, wide = { width: 844, height: 390 };
const button = (page, id) => page.locator(`[data-test="${id}"]`);
const native = (page, name) => page.waitForFunction(name =>
  document.getElementById("stage").dataset.portraitScene === name &&
  getComputedStyle(document.getElementById("rotate-hint")).display === "none", name);
const options = { viewport: tall, hasTouch: true, isMobile: true, reducedMotion: "reduce" };
async function start(page) {
  await page.waitForFunction(() => window.__verticalLook?.scene() === "title");
  await page.evaluate(async () => {
    const { newGame } = await import("./js/core/state.js");
    const { clearScreen } = await import("./js/core/ui.js");
    Object.assign(newGame(), { chapter: 2, phase: "daily", day: 18, slot: 1 });
    clearScreen();
  });
}
async function rotate(page, name) {
  await page.setViewportSize(wide);
  await page.waitForFunction(() => !document.getElementById("stage").dataset.portraitScene);
  await page.setViewportSize(tall);
  await native(page, name);
}

await suite("portrait_live_scenes", async check => {
  await check("steam-tutorial-help-fits-and-closes", async page => {
    await start(page);
    await page.evaluate(async () => {
      localStorage.removeItem("suien_step_intro");
      const { openBench, newSession } = await import("./js/craft/session.js");
      const { runSteamDodge } = await import("./js/craft/steam.js");
      const cs = newSession("tutorial");
      cs.onboarding = true;
      openBench(cs, {});
      window.dodgeDone = runSteamDodge(cs).then(() => cs.steam);
    });
    const field = page.locator(".vtc-dodge-arena .dodge");
    await field.waitFor();
    const guide = button(page, "vt-craft-tut");
    await guide.waitFor();
    const box = await guide.boundingBox();
    assert(box.width >= tall.width * .95 && box.x >= 0 && box.x + box.width <= tall.width + 1);
    const count = Number(await guide.getAttribute("data-count"));
    for (let index = 1; index < count; index++) {
      await guide.tap({ position: { x: 24, y: 24 } });
      await page.waitForFunction(i => document.querySelector(".vtc-tut").dataset.index === String(i + 1), index);
    }
    await button(page, "vt-craft-tut-go").tap();
    await guide.waitFor({ state: "hidden" });
    const pad = button(page, "dodge-pad");
    const arena = await field.boundingBox(), stick = await pad.boundingBox();
    assert(arena.width >= tall.width * .98 && arena.height > arena.width * .8);
    assert(stick.y >= arena.y + arena.height && stick.width > tall.width * .45);
    const warmup = button(page, "steam-warmup-start");
    await warmup.waitFor();
    await page.setViewportSize(wide);
    await page.locator("#screen .steam-play .dodge .steam-warmup").waitFor();
    await page.setViewportSize(tall);
    await field.waitFor();
    await warmup.tap();
    await button(page, "steam-clock").waitFor();
    const clock = await button(page, "steam-clock").boundingBox();
    assert(Math.abs((clock.y + clock.height / 2) - (arena.y + arena.height / 2)) < 4);
    await button(page, "dodge-precision").tap();
    assert.equal(await button(page, "dodge-precision").getAttribute("aria-pressed"), "true");
    await button(page, "dodge-refresh").tap();
    assert.equal(await button(page, "dodge-refresh").getAttribute("data-remaining"), "0");
    const result = button(page, "vt-craft-result-next");
    await result.waitFor({ timeout: 30000 });
    await result.tap();
    assert.equal(await page.evaluate(async () => (await window.dodgeDone).refreshesUsed), 1);
  }, options);

  await check("short-screen-learned-dodge-actions", async page => {
    await start(page);
    await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const { newSession, openBench } = await import("./js/craft/session.js");
      const { runSteamDodge } = await import("./js/craft/steam.js");
      state.flags._sumi_attack_learned = true;
      const cs = newSession("practice");
      openBench(cs, {});
      void runSteamDodge(cs);
    });
    const attack = button(page, "dodge-slash"), swap = page.locator(".vtc-dodge-swap");
    await attack.tap();
    assert.equal(await attack.getAttribute("data-uses"), "1");
    await swap.tap();
    await button(page, "dodge-precision").tap();
    assert.equal(await button(page, "dodge-precision").getAttribute("aria-pressed"), "true");
    await swap.tap();
    assert(await attack.isVisible());
  }, { ...options, viewport: { width: 320, height: 568 } });

  await check("vent-and-charcoal-commit-the-tapped-choices", async page => {
    await start(page);
    await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const { openBench, newSession } = await import("./js/craft/session.js");
      const { stepVent, stepPlace } = await import("./js/craft/steps.js");
      Object.assign(state.flags, { _coal_cube_learned: true, _coal_four_unlocked: true });
      const cs = newSession("practice");
      openBench(cs, {});
      window.craftChoices = (async () => {
        await stepVent(cs);
        await stepPlace(cs);
        return [cs.vent, cs.place];
      })();
    });
    await native(page, "equipment");
    await page.evaluate(async () => {
      const { eyecatch } = await import("./js/craft/tournament-show.js");
      void eyecatch(document.getElementById("fx"), { title: "ROUND 1", ms: 30000 });
    });
    await page.waitForFunction(() => window.__verticalLook.scene() === "tournament");
    await page.locator(".ts-eyecatch.in").tap();
    await native(page, "equipment");
    await button(page, "opt-closed").tap();
    await button(page, "opt-four").tap();
    assert.deepEqual(await page.evaluate(() => window.craftChoices), ["closed", "four"]);
  }, { ...options, reducedMotion: "no-preference" });

  for (const venue of ["tonari", "mukai", "dubai"]) await check(`floor-${venue}-settles-shift`, async page => {
    await start(page);
    await page.evaluate(async venue => {
      const { runTonariFloor } = await import("./js/daily/tonari-floor-view.js");
      window.shiftResult = runTonariFloor({ venue, seed: 4, chapter: 4 });
    }, venue);
    await native(page, "floor");
    assert.equal(await page.locator(".tonari-floor").getAttribute("data-venue"), venue);
    const tap = key => button(page, `tonari-floor-${key}`).tap();
    await tap("option-start");
    if (venue === "tonari") await rotate(page, "floor");
    await tap("pause");
    await tap("option-close");
    await tap("option-confirm-close");
    await tap("option-continue");
    assert.ok(await page.evaluate(() => window.shiftResult));
  }, options);

  await check("axe-aim-and-release", async page => {
    await start(page);
    await page.evaluate(async () => {
      const { runAxeThrow } = await import("./js/minigames/axe.js");
      void runAxeThrow({ autoAdvance: false });
    });
    await native(page, "axe");
    const phase = value => page.waitForFunction(v => document.querySelector(".axe-game")?.dataset.phase === v, value);
    await phase("choice");
    const cameras = await page.locator(".axe-target-art, .axe-target, .axe-hand-front").evaluateAll(nodes =>
      nodes.map(svg => {
        const { a, b, c, d, e, f } = svg.getScreenCTM();
        return [a, b, c, d, e, f];
      }));
    assert.equal(cameras.length, 3);
    for (const camera of cameras.slice(1)) assert.deepEqual(camera, cameras[0]);
    await stanceAt(page, { touch: true });
    await phase("power");
    await flickFromHandle(page, { touch: true });
    await phase("result");
  }, options);

  await check("desert-help-rotate-and-return", async page => {
    await start(page);
    await page.evaluate(async () => {
      const { runDesertRide } = await import("./js/minigames/desert-ride.js");
      window.ride = runDesertRide();
    });
    await native(page, "desert");
    await button(page, "desert-help").tap();
    await rotate(page, "desert");
    await button(page, "desert-help-close").tap();
    await button(page, "desert-leave").tap();
    assert.ok(await page.evaluate(() => window.ride));
  }, options);

  await check("camel-starts-its-live-race", async page => {
    await start(page);
    await page.evaluate(async () => { void (await import("./js/minigames/camel-race.js")).runCamelRace(); });
    await native(page, "camel");
    await button(page, "camel-tutorial-skip").tap();
    await page.waitForFunction(() => ["countdown", "racing", "race"].includes(document.querySelector(".camel-game")?.dataset.phase));
  }, options);

  await check("dj-rotates-the-running-set", async page => {
    await start(page);
    await page.evaluate(async () => {
      void (await import("./js/minigames/dj.js")).runDjSet({ host: document.getElementById("stage") });
    });
    await native(page, "dj");
    const frame = page.frameLocator(".dj-frame");
    await frame.locator('html[data-layout="portrait"]').waitFor();
    await frame.locator("#help").tap();
    await rotate(page, "dj");
    await frame.locator('html[data-layout="portrait"]').waitFor();
    assert.equal(await page.locator(".dj-frame").count(), 1);
  }, options);

  await check("trpg-turn-the-page", async page => {
    await start(page);
    await page.evaluate(async () => {
      (await import("./js/scenes/trpg-room.js")).openTrpgRoom(() => {});
    });
    await native(page, "trpg");
    const tab = button(page, "trpg-tab-ordinary-cup");
    await tab.tap();
    await page.waitForFunction(() => document.querySelector('[data-test="trpg-tab-ordinary-cup"]')?.getAttribute("aria-current") === "true");
    await rotate(page, "trpg");
    assert.equal(await tab.getAttribute("aria-current"), "true");
  }, options);

  await check("tetsuko-open-and-close-notebook", async page => {
    await start(page);
    await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      Object.assign(state, { chapter: 3, day: 33 });
      void (await import("./js/minigames/tetsuko-time.js")).openTetsukoTime({ value: state, visitKey: "visit" });
    });
    await native(page, "tetsuko");
    await button(page, "tetsuko-book").tap();
    await rotate(page, "tetsuko");
    await button(page, "tetsuko-panel-close").tap();
    await button(page, "tetsuko-time-back").tap();
    await button(page, "tetsuko-quit-confirm").tap();
    await page.locator(".tetsuko-time").waitFor({ state: "detached" });
  }, options);
}, { entry: new URL("?look=vertical", baseURL).href, floorGame: true });
