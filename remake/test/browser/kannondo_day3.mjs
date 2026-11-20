import assert from "node:assert/strict";
import path from "node:path";
import { assertFits, suite } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const map = ".map:not(.done):not([data-revealing='true'])";
const intro = "#vn.active .vn-text";
const board = `${t("growth-board")}[data-mode="light"]`;
const testScene = /bg_kannon_day\.(?:png|webp)/;
const overcastScene = /bg_kannon_overcast_day\.(?:png|webp)/;
const nightScene = /bg_kannon_night\.(?:png|webp)/;
const proof = process.env.EVIDENCE_DIR;
const click = (page, touch) => async (sel) => touch ? page.locator(sel).first().tap() : page.locator(sel).first().click();

async function screenshot(page, file) {
  if (proof) await page.screenshot({ path: path.join(proof, file), animations: "disabled" });
}

async function fixture(page, { day = 3, slot = 0, weatherSeed = 4, earned = 0, finished = false } = {}) {
  await page.evaluate(async ({ day, slot, weatherSeed, earned, finished }) => {
    const core = await import("./js/core/state.js");
    const growth = await import("./js/core/growth.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day, slot, money: 26000, stamina: 75, seed: 123, weatherSeed });
    Object.assign(s.flags, { [`_morning_${day}`]: true, _errand_scout_done: true,
      _c_station_registered: true, _ch1_day2_shift_done: true, _delivery_schedule_v2: true,
      _delivery_batch_started: true, _delivery_report_done: true,
      _delivery_adam_done: true, _delivery_minto_done: true, _ev_salaryman: true,
      _tsumugi_contest_research: true, _met_tsumugi: true, _lime_contact_tsumugi: true,
      _lime_tut: 1, _lime_opened: true });
    s.met.sumi = s.met.adam = s.met.naru = s.met.tsumugi = true;
    Object.assign(s.affinity, { tsumugi: 9 });
    s.contacts.push("tsumugi");
    if (finished) {
      Object.assign(s.flags, { _board_starter_given: true, _board_tutorial_done: true, _kannon_growth_intro_done: true });
      (s.visitedDay ||= {}).kannon = day; // 旧式の訪問を終えていても盤専用の入口は開く
    }
    if (day >= 4) Object.assign(s.flags, { _tsumugi_contest_progress: true, _ev_first_practice: true });
    Object.assign(growth.ensureGrowth(), { earned, starterAccounted: finished });
    Object.assign(core.config, { textSpeed: 4, seVolume: 0, bgmVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
    (await import("./js/scenes/title.js")).showTitle();
  }, { day, slot, weatherSeed, earned, finished });
}

async function load(page, press) {
  await press(t("title-load"));
  await press(t("slot-0"));
}

async function readLinesToBoard(page, press) {
  await page.locator(intro).filter({ hasText: /観音堂/ }).waitFor();
  for (const line of [/観音堂/, /三つの盤/]) {
    await page.locator(intro).filter({ hasText: line }).waitFor();
    // Skip/turbo is not used for the two new lines or the board.
    await page.locator("#vn.active .vn-next.show").waitFor();
    await press("#vn.active .vn-box");
  }
  await page.locator(board).waitFor();
}

async function snapshot(page, saved = false) {
  return page.evaluate(async (saved) => {
    const core = await import("./js/core/state.js");
    const s = saved ? core.peekSave() : core.state;
    return { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina, xp: s.growth.xp,
      fire: s.growth.hidane.any, earned: s.growth.earned, nodes: [...s.growth.nodes], stats: s.stats, reel: s.reel,
      ordinaryVisit: s.spotVisits?.kannon || 0, starter: !!s.flags._board_starter_given, taught: !!s.flags._board_tutorial_done,
      intro: !!s.flags._kannon_growth_intro_done, done: !!s.flags._ch1_day3_kannon_done };
  }, saved);
}

async function displayedTemple(page, expectation) {
  // The exact rendered layer—not just the resolver or requested asset.
  await page.waitForFunction((pattern) => {
    const layer = [...document.querySelectorAll("#bg .bg-img.show")].at(-1);
    return new RegExp(pattern).test(layer?.dataset.sceneBg || "");
  }, expectation.source);
}

async function useTutorial(page, press, label) {
  const lesson = page.locator(t("board-tutorial"));
  await lesson.waitFor();
  await page.locator(`${board}[data-art]`).waitFor();
  await assertFits(page, ".gb-tutorial-bubble, " + t("board-tutorial-next"));
  await screenshot(page, `day3-${label}-tutorial.png`);
  for (let i = 0; i < 4; i++) await press(t("board-tutorial-next"));
  assert.match(await lesson.textContent(), /光っているマスを押す/);
  const eligible = await page.locator(".gb-node.s-available").first().getAttribute("data-test");
  await press(t(eligible));
  await page.locator(".gb-tutorial-bubble h3").filter({ hasText: /^灯す$/ }).waitFor();
  await assertFits(page, ".gb-tutorial-bubble, .gb-light");
  await screenshot(page, `day3-${label}-light.png`);
  await press(t("board-light"));
  await page.locator(`${t(eligible)}[data-status="pending"]`).waitFor();
  for (let i = 0; i < 3; i++) await press(t("board-tutorial-next"));
  await press(t("board-tutorial-done"));
  await press(t("board-decide"));
  // The actual close boundary saves both the node and the visit.
  await page.locator(map).waitFor();
  return eligible.replace(/^board-node-/, "");
}

async function openVisit(page, press) {
  await press(t("pin-kannon"));
  await press(t("map-go"));
  await page.locator(t("kannon-reflect")).waitFor();
  assert.deepEqual(await page.locator("#modal.show .modal-actions button").allTextContents(), ["盤を開く", "戻る"]);
}

await suite("kannondo-day3", async (check) => {
  for (const [label, options] of [
    ["pc", { viewport: { width: 1280, height: 720 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`day3-interactive-${label}`, async (page) => {
      const press = click(page, options.hasTouch);
      await fixture(page);
      const start = await snapshot(page, true);
      await load(page, press);
      await page.locator(intro).filter({ hasText: /観音堂/ }).waitFor();
      assert.equal(await page.locator(map).count(), 0, "No free-action map before the first visit");
      await displayedTemple(page, testScene);
      await screenshot(page, `day3-${label}-day-arrival.png`);
      await readLinesToBoard(page, press);
      const grant = await snapshot(page, true);
      assert.equal(grant.intro, true);
      assert.equal(grant.starter, true);
      assert.equal(grant.taught, false);
      assert.equal(grant.done, false);
      assert.equal(grant.earned, 6);
      assert.equal(grant.fire, 6);

      // Real document reload during the board instructions: grant is checkpointed,
      // the lesson remains pending, and no second trip/second reward is finalized.
      await page.reload();
      await load(page, press);
      await page.locator(board).waitFor();
      await displayedTemple(page, testScene);
      assert.equal(await page.locator(intro).count(), 0, "Completed introduction is not replayed");
      assert.deepEqual(await snapshot(page, true), grant);
      const node = await useTutorial(page, press, label);
      const after = await snapshot(page, true);
      assert.deepEqual(after, { ...start, fire: 5, earned: 6, nodes: [node], starter: true, taught: true, intro: true, done: true });

      await press(t("hud-menu"));
      await page.locator(t("menu-close")).waitFor();
      await press(t("menu-close"));
      await press(t("hud-phone"));
      await page.locator(t("phone-close")).waitFor();
      await press(t("phone-close"));
      await openVisit(page, press);
      await displayedTemple(page, testScene);
      await assertFits(page, ".modal-box, " + t("kannon-reflect") + ", " + t("kannon-back"));
      await screenshot(page, `day3-${label}-return-choices.png`);
      if (options.hasTouch) await press(t("kannon-back")); else await page.keyboard.press("Escape");
      await page.locator(map).waitFor();
      assert.deepEqual(await snapshot(page), after, "Back leaves the entire action untouched");

      await page.reload();
      await load(page, press);
      await page.locator(map).waitFor();
      assert.equal(await page.locator(board).count(), 0);
      assert.deepEqual(await snapshot(page, true), after);
    }, options);
  }

  await check("old-night-save-can-open-an-empty-board-and-return", async (page) => {
    const press = click(page, false);
    await fixture(page, { slot: 1, earned: 6, finished: true });
    const old = await snapshot(page, true);
    await load(page, press);
    await page.locator(map).waitFor();
    await openVisit(page, press);
    await displayedTemple(page, nightScene);
    await screenshot(page, "old-save-pc-night-arrival.png");
    await press(t("kannon-reflect"));
    await page.locator(board).waitFor();
    assert.equal(await page.locator(t("board-tutorial")).count(), 0);
    await page.keyboard.press("Escape");
    await page.locator(map).waitFor();
    assert.deepEqual(await snapshot(page, true), old);
    assert.equal(await page.locator(t("pin-tonari")).count(), 1);
    assert.equal(await page.locator(t("pin-shop")).count(), 1);
  });

  await check("day3-rain-and-escape-offer-unfinished-tutorial-on-revisit", async (page) => {
    const press = click(page, false);
    await fixture(page, { weatherSeed: 5 });
    await load(page, press);
    await displayedTemple(page, overcastScene);
    await readLinesToBoard(page, press);
    await page.keyboard.press("Escape");
    await page.locator(map).waitFor();
    const left = await snapshot(page, true);
    assert(left.done && left.starter && !left.taught);
    assert.equal(left.fire, 6);
    await openVisit(page, press);
    await displayedTemple(page, overcastScene);
    await press(t("kannon-reflect"));
    await page.locator(t("board-tutorial")).waitFor();
    await press(t("board-tutorial-next"));
    assert.doesNotMatch(await page.locator(t("board-tutorial")).textContent(), /渡しておく/);
    await press(t("board-tutorial-skip"));
    await press(t("board-close"));
    await page.locator(map).waitFor();
    assert.deepEqual(await snapshot(page, true), { ...left, taught: true });
  });

  await check("day4-old-save-goes-straight-to-normal-map", async (page) => {
    const press = click(page, false);
    await fixture(page, { day: 4, earned: 6, finished: true });
    await load(page, press);
    await page.locator(map).waitFor();
    assert.equal(await page.locator(board).count(), 0);
    assert.equal((await snapshot(page, true)).done, false, "Older saves are not backfilled as completed");
    await press(t("pin-shop"));
    assert.equal(await page.locator(t("map-go")).isVisible(), true);
    assert.equal(await page.locator(t("kannon-reflect")).count(), 0);
  });

  await check("day2-rest-leads-to-day3-board-and-keeps-day3-night-story", async (page) => {
    const press = click(page, false);
    await fixture(page, { day: 2, slot: 1 });
    // Within a real game loop: the existing VN helper reads the neighboring
    // rest/night story. It does not choose map or board controls for this test.
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      window.sceneTrace = [];
      vn.vnTest.turbo = true;
      window.rememberScene = () => {
        const orig = vn.hooks.onEnter;
        vn.hooks.onEnter = (id, info) => { sceneTrace.push(id); orig?.(id, info); };
      };
    });
    await load(page, press);
    await page.locator(map).waitFor();
    await page.evaluate(() => rememberScene());
    assert.equal(await page.locator(t("pin-kannon")).count(), 0, "DAY2 still starts on its normal map");
    await press(t("pin-rest")); await press(t("map-go"));
    const home = page.locator(t("home-shisha-skip"));
    await home.or(page.locator(board)).first().waitFor();
    if (await home.isVisible()) await home.click();
    await page.locator(board).waitFor();
    await displayedTemple(page, testScene);
    assert.equal((await snapshot(page)).day, 3);
    assert.equal((await snapshot(page)).slot, 0);
    await press(t("board-tutorial-skip"));
    await press(t("board-close"));
    await page.locator(map).waitFor();
    assert.equal((await snapshot(page, true)).done, true);
    assert.equal((await snapshot(page, true)).slot, 0);
    await press(t("pin-rest")); await press(t("map-go"));
    await page.waitForFunction(() => __remake.state.day === 3 && __remake.state.slot === 1
      && document.querySelector(".map:not(.done)"));
    await press(t("pin-rest")); await press(t("map-go"));
    await page.waitForFunction(() => sceneTrace.includes("ch1_tsumugi_work_in_progress"));
  });
}, { boardTutorial: true, acknowledgeGrowth: false });
