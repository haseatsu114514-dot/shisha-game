import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const map = '[data-destination-selection]:not(.done)';
const t = id => `[data-test="${id}"]`;
const shots = process.env.COMPARISON_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
async function setup(page, { introduced = false, run = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ introduced, run }) => {
    window.C = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      samechan: await import("./js/daily/samechan.js"), cinema: await import("./js/daily/cinema.js"),
      spots: await import("./js/daily/spots.js"), map: await import("./js/daily/map.js"),
      vn: await import("./js/vn/engine.js"), data: await import("./js/core/data.js"),
    };
    const s = C.core.newGame();
    Object.assign(s, { chapter: 2, day: 16, slot: 0, phase: "daily", money: 12000, stamina: 80, weatherSeed: 7 });
    Object.assign(s.flags, { _morning_16: true, _intro_samechan: true, _samechan_quiet_seat_done: true,
      _lime_opened: true, _lime_tut: true });
    if (introduced) s.flags._samechan_cinema_introduced = true;
    s.story.samechan = 4; s.met.samechan = true; s.affinity.samechan = 20;
    s.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    C.core.config.bgmVolume = 0;
    C.vn.vnTest.turbo = true; C.vn.vnTest.choose = () => 0;
    (await import("./js/chapters/ch1.js")).setupHooks();
    C.events = [];
    const enter = C.vn.hooks.onEnter;
    C.vn.hooks.onEnter = (id, scene) => { C.events.push(id); enter?.(id, scene); };
    C.snapshot = () => structuredClone(C.core.state);
    window.reopenCinemaMap = async () => {
      if (C.flow) { C.map.interruptMap(null); await C.flow; }
      C.flow = C.map.chooseSpot();
    };
    if (run) void (await import("./js/daily/calendar.js")).runDaily({ nightEvents: {}, untilDay: 30 });
  }, { introduced, run });
  if (run) await page.locator(map).waitFor();
}
async function settled(page) {
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
}
await suite("cinema", async check => {
  for (const [mode, options] of [["pc", {}], ["touch", {
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  }]]) {
    const hit = async (page, selector) => options.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    await check(`${mode}-introduction-map-and-load`, async page => {
      await setup(page);
      await page.evaluate(() => reopenCinemaMap());
      await page.locator(map).waitFor();
      assert.equal(await page.locator(t("pin-rojiura_cinema")).count(), 0);
      const result = await page.evaluate(async () => {
        C.map.interruptMap(null); await C.flow; C.flow = null;
        const before = C.snapshot();
        const used = (await C.stats.paidAction(() => C.samechan.visitSamechan(C.samechan.samechanSpot()))).value;
        const after = C.snapshot();
        C.core.state.slot++; C.core.save();
        await reopenCinemaMap();
        return { before, after, used, events: C.events };
      });
      assert(result.used);
      assert(result.events.includes("samechan_cinema_introduction"));
      assert(result.after.flags._samechan_cinema_introduced);
      assert.equal(result.after.money, result.before.money - 3000);
      assert.equal(result.after.story.samechan, result.before.story.samechan + 1);
      await page.locator(t("pin-rojiura_cinema")).waitFor();
      await page.locator('.map-unlock-notice').filter({ hasText: "サメちゃん" }).waitFor();
      await settled(page);
      await hit(page, t("pin-rojiura_cinema"));
      await assertFits(page, t("map-go"));
      const art = await page.locator(t("pin-rojiura_cinema") + " img").evaluate(img => ({
        complete: img.complete, width: img.naturalWidth, src: img.src,
      }));
      assert(art.complete && art.width === 512 && art.src.endsWith("map-rojiura-cinema.webp"));
      await capture(page, mode + "-map");
      const loaded = await page.evaluate(async () => {
        C.map.interruptMap(null); await C.flow; C.flow = null;
        C.core.load(); await reopenCinemaMap();
        return C.snapshot();
      });
      assert(loaded.flags._samechan_cinema_introduced);
      assert.equal(await page.locator('.newly-revealed').count(), 0, "LOAD does not celebrate old unlocks");
      assert.equal(await page.locator(t("pin-rojiura_cinema") + " .pin-people").count(), 0, "no automatic companion");
    }, options);

    await check(`${mode}-calendar-screening-and-poor`, async page => {
      await setup(page, { introduced: true, run: true });
      await settled(page);
      const before = await page.evaluate(() => ({ ...C.snapshot(), expectedStamina: C.stats.staminaAfter(-8) }));
      await hit(page, t("pin-rojiura_cinema"));
      await hit(page, t("map-go"));
      await page.waitForFunction(() => C.core.state.slot === 1);
      await page.locator(map).waitFor();
      const after = await page.evaluate(() => C.snapshot());
      assert.equal(after.money, before.money - 1000);
      assert.equal(after.stamina, before.expectedStamina, "existing condition adjustment applies to base cost 8");
      assert.equal(after.stats.insight, before.stats.insight + 2);
      for (const stat of ["technique", "sense", "guts", "charm"]) assert.equal(after.stats[stat], before.stats[stat]);
      assert.equal(after.spotVisits.rojiura_cinema, 1);
      assert.equal(after.visitedDay.rojiura_cinema, 16);
      assert.deepEqual(after.affinity, before.affinity);
      assert.equal(after.slot, 1); assert.equal(after.day, 16);
      await hit(page, t("pin-rojiura_cinema"));
      assert.equal(await page.locator(t("map-go")).count(), 0, "same day re-entry unavailable");
      await page.evaluate(async () => {
        C.core.state.money = 999; C.core.state.visitedDay = {};
        C.map.interruptMap("__lime__");
      });
      await page.locator(map).waitFor();
      await hit(page, t("pin-rojiura_cinema"));
      assert.equal(await page.locator(t("map-go")).count(), 0, "insufficient funds cannot enter");
      assert.equal(await page.evaluate(() => C.core.state.money), 999);
    }, options);

    await check(`${mode}-screening-art-cancel-and-missing`, async page => {
      await setup(page, { introduced: true });
      await page.evaluate(() => {
        C.vn.vnTest.turbo = false;
        C.abort = new AbortController();
        C.before = C.snapshot();
        C.screening = C.cinema.visitCinema({ signal: C.abort.signal });
      });
      await page.locator("#vn.active").waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll("#bg .bg-img")]
        .some(node => node.style.backgroundImage.includes("bg_rojiura_cinema")));
      await page.waitForFunction(() => document.querySelector("#vn .vn-text")?.textContent.includes("座った。")
        && Number(getComputedStyle(document.querySelector("#vn .vn-box")).opacity) >= 0.99);
      await assertFits(page, "#vn .vn-controls button");
      await capture(page, mode + "-screening");
      const cancelled = await page.evaluate(async () => {
        C.abort.abort(); return { used: await C.screening, before: C.before, after: C.snapshot() };
      });
      assert.equal(cancelled.used, false); assert.deepEqual(cancelled.after, cancelled.before);
      await page.evaluate(async () => {
        const { createMapFacilityIcon } = await import("./js/daily/facility-icons.js");
        const icon = createMapFacilityIcon("rojiura_cinema");
        document.getElementById("screen").append(icon);
        icon.querySelector("img").dispatchEvent(new Event("error"));
      });
      assert.equal(await page.locator('.facility-icon-crop').textContent(), "映");
    }, options);

    await check(`${mode}-first-eligible-visit-and-interruption`, async page => {
      await setup(page);
      const sequence = await page.evaluate(async () => {
        const s = C.core.state;
        delete s.flags._samechan_quiet_seat_done; s.story.samechan = 3;
        const first = await C.samechan.visitSamechan(C.samechan.samechanSpot());
        const afterSeat = C.snapshot();
        s.day++; const beforeCancel = C.snapshot();
        const enter = C.vn.hooks.onEnter;
        C.abort = new AbortController();
        C.vn.hooks.onEnter = (id, scene) => {
          enter?.(id, scene);
          if (id === "samechan_cinema_introduction") C.abort.abort();
        };
        const canceled = await C.samechan.visitSamechan(C.samechan.samechanSpot(), { signal: C.abort.signal });
        const afterCancel = C.snapshot();
        C.vn.hooks.onEnter = enter;
        const retried = await C.samechan.visitSamechan(C.samechan.samechanSpot());
        const afterRetry = C.snapshot();
        const repeated = await C.samechan.visitSamechan(C.samechan.samechanSpot());
        return { first, afterSeat, beforeCancel, canceled, afterCancel, retried, afterRetry, repeated, final: C.snapshot() };
      });
      assert(sequence.first && sequence.afterSeat.flags._samechan_quiet_seat_done);
      assert(!sequence.afterSeat.flags._samechan_cinema_introduced, "quiet-seat completion does not introduce early");
      assert.equal(sequence.canceled, false);
      for (const key of ["money", "stamina", "story"]) assert.deepEqual(sequence.afterCancel[key], sequence.beforeCancel[key]);
      assert(!sequence.afterCancel.flags._samechan_cinema_introduced);
      assert.equal(sequence.afterCancel.flags._samechan_visit.complete, false);
      assert(sequence.retried && sequence.afterRetry.flags._samechan_cinema_introduced);
      assert.equal(sequence.afterRetry.money, sequence.beforeCancel.money - 3000);
      assert(sequence.repeated); assert.deepEqual(sequence.final, sequence.afterRetry);
    }, options);

    await check(`${mode}-introduction-load-and-missing-art`, async page => {
      await setup(page);
      const interrupted = await page.evaluate(async () => {
        const before = C.snapshot(), enter = C.vn.hooks.onEnter;
        C.abort = new AbortController();
        C.vn.hooks.onEnter = (id, scene) => {
          enter?.(id, scene);
          if (id === "samechan_cinema_introduction") { C.core.load(); C.abort.abort(); }
        };
        const used = await C.samechan.visitSamechan(C.samechan.samechanSpot(), { signal: C.abort.signal });
        C.vn.hooks.onEnter = enter;
        return { before, used, after: C.snapshot() };
      });
      assert.equal(interrupted.used, false);
      assert(!interrupted.after.flags._samechan_cinema_introduced);
      assert.equal(interrupted.after.money, interrupted.before.money);
      assert.equal(interrupted.after.flags._samechan_visit.complete, false);
      await page.route("**/img/backgrounds/bg_rojiura_cinema.webp", route => route.fulfill({
        status: 200, contentType: "image/webp", body: "invalid-image-fixture",
      }));
      const missing = await page.evaluate(async () => {
        C.core.state.flags._samechan_cinema_introduced = true;
        const before = C.snapshot();
        const used = await C.cinema.visitCinema();
        return { used, before, after: C.snapshot() };
      });
      assert.equal(missing.used, false); assert.deepEqual(missing.after, missing.before);
    }, options);

    await check(`${mode}-matching-film-backgrounds`, async page => {
      await setup(page, { introduced: true });
      for (const [genre, id] of [
        ["space", "cinema_cardboard_planet"], ["monster", "cinema_rubber_monster"],
        ["detective", "cinema_detective_shadow"],
      ]) {
        await page.evaluate(async id => {
          const { CINEMA } = await import("./js/core/cinema-discovery.js");
          const s = C.core.state; s.day++; s.slot = 1;
          s.spotVisits = { rojiura_cinema: CINEMA.pool.indexOf(id) + 1 };
          C.vn.vnTest.turbo = false;
          C.abort = new AbortController(); C.before = C.snapshot();
          C.screening = C.cinema.visitCinema({ signal: C.abort.signal });
        }, id);
        await page.locator("#vn.active").waitFor();
        await page.waitForFunction(genre => [...document.querySelectorAll("#bg .bg-img")].some(node =>
          node.style.backgroundImage.includes(`bg_rojiura_cinema_${genre}.webp`) && !node.dataset.tint), genre);
        await page.waitForFunction(() => document.querySelector("#vn .vn-next.show"));
        await capture(page, `${mode}-${genre}-screening`);
        const result = await page.evaluate(async () => {
          C.abort.abort(); return { used: await C.screening, before: C.before, after: C.snapshot() };
        });
        assert.equal(result.used, false); assert.deepEqual(result.after, result.before);
      }
    }, options);
  }
});
