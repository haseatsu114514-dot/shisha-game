import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits } from "./support.mjs";

const button = (page, id) => page.locator('[data-test="' + id + '"]');
async function hit(page, id) {
  const target = button(page, id);
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await target.tap();
  else await target.click();
}
async function lines(page) {
  for (let i = 0; i < 30 && await button(page, "trpg-next").isVisible(); i++) await hit(page, "trpg-next");
}
async function roll(page) {
  await hit(page, "trpg-roll");
  await button(page, "trpg-settle").waitFor();
  await hit(page, "trpg-settle"); await lines(page);
}
async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { phase: "daily", day: 7, slot: 1, money: 34567, stamina: 52 });
    Object.assign(state.flags, { _qa_preserved: true, _morning_7: true });
    state.flavorStock.double_apple = 37; state.reel.count = 3;
    core.config.textSpeed = 4; core.config.bgmVolume = 0; core.saveConfig();
    core.saveToSlot("suien_remake_slot1"); core.saveToSlot("suien_remake_slot2");
    localStorage.setItem("qa_unrelated", "keep"); sessionStorage.setItem("qa_unrelated", "keep");
    window.__tabletopOwner = state; window.__tabletopBefore = JSON.stringify(state);
    const { showTitle } = await import("./js/scenes/title.js"); showTitle();
  });
  await page.locator(".title-art.ready").waitFor();
  return storageSnapshot(page);
}
async function preserved(page, before) {
  assert.deepEqual(await storageSnapshot(page), before, "Tabletop play changed browser storage");
  assert(await page.evaluate(() => __remake.state === __tabletopOwner
    && JSON.stringify(__remake.state) === __tabletopBefore), "Campaign state changed");
}
async function completed(page, id) {
  await hit(page, "trpg-select-" + id); await hit(page, "trpg-start"); await lines(page); await roll(page);
  const shark = id === "shark-last-order";
  for (const spot of shark ? ["radio", "leaves", "fan"] : ["menu", "window", "bag"]) {
    await hit(page, "trpg-spot-" + spot); await lines(page);
  }
  await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-" + (shark ? "scent" : "quiet")); await lines(page);
  for (const [field, value] of shark ? [["tool", "citrus"], ["route", "pier"]] : [["aroma", "tea"], ["seat", "window"]])
    await hit(page, "trpg-plan-" + field + "-" + value);
  await hit(page, "trpg-prepare-open"); await roll(page);
  await hit(page, "trpg-plan-" + (shark ? "finale-lure" : "approach-quiet"));
  await hit(page, "trpg-serve-open"); await roll(page);
  assert((await button(page, "trpg-ending-title").textContent()).length > 0);
}

await suite("trpg-main", async check => {
  for (const [label, id, options] of [
    ["ordinary-pc", "ordinary-cup", { viewport: { width: 1280, height: 720 } }],
    ["shark-touch", "shark-last-order", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label, async page => {
    const before = await prepare(page);
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").filter(e => /trpg_(catalog|ordinary|shark)\.json/.test(e.name)).length), 0);
    const art = await page.locator(".title-art").getAttribute("data-art");
    await assertFits(page, ".title-item");
    await hit(page, "title-trpg"); await button(page, "trpg-select-ordinary-cup").waitFor();
    assert.equal(await page.locator(".trpg-library-book").count(), 2);
    await assertFits(page, ".trpg-library button");
    await completed(page, id);
    await hit(page, "trpg-replay"); await button(page, "trpg-start").waitFor();
    await hit(page, "trpg-exit"); await button(page, "trpg-collection-close").waitFor();
    await hit(page, "trpg-select-" + (id === "ordinary-cup" ? "shark-last-order" : "ordinary-cup"));
    await button(page, "trpg-start").waitFor(); await hit(page, "trpg-exit");
    await button(page, "trpg-collection-close").waitFor(); await hit(page, "trpg-collection-close");
    await button(page, "title-trpg").waitFor();
    assert.equal(await page.locator(".title-art").getAttribute("data-art"), art);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "title-trpg");
    assert.equal(await page.locator(".trpg-root, .trpg-screen").count(), 0);
    await preserved(page, before);
    await hit(page, "title-load");
    assert(await button(page, "slot-0").isEnabled()); assert(await button(page, "slot-1").isEnabled());
    await hit(page, "slot-cancel"); await preserved(page, before);
  }, options);

  await check("loading-retry-and-return", async page => {
    const before = await prepare(page); let broken = true;
    await page.route("**/data/trpg_catalog.json", route => broken
      ? route.fulfill({ status: 200, contentType: "application/json", body: "{broken" }) : route.continue());
    await hit(page, "title-trpg"); await button(page, "trpg-retry-load").waitFor();
    await hit(page, "trpg-collection-close"); await button(page, "title-trpg").waitFor();
    await hit(page, "title-trpg"); await button(page, "trpg-retry-load").waitFor();
    broken = false; await hit(page, "trpg-retry-load");
    await button(page, "trpg-select-shark-last-order").waitFor();
    await hit(page, "trpg-collection-close"); await button(page, "title-trpg").waitFor();
    await preserved(page, before);
  });

  await check("cancel-pending-load", async page => {
    const before = await prepare(page);
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    await page.route("**/data/trpg_catalog.json", async route => {
      entered(); await gate; await route.continue();
    });
    await hit(page, "title-trpg"); await started;
    await hit(page, "trpg-collection-close"); await button(page, "title-trpg").waitFor();
    release(); await page.unrouteAll({ behavior: "wait" });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator(".trpg-root, .trpg-screen").count(), 0);
    await preserved(page, before);
  });

  await check("screen-owner-disposal", async page => {
    const before = await prepare(page);
    await page.evaluate(async () => {
      const { openTrpgRoom } = await import("./js/scenes/trpg-room.js");
      window.__roomReturns = 0; window.__ownedRoom = openTrpgRoom(() => { __roomReturns++; });
    });
    await button(page, "trpg-select-shark-last-order").waitFor();
    await hit(page, "trpg-audio"); await hit(page, "trpg-select-shark-last-order");
    await hit(page, "trpg-start"); await lines(page); await hit(page, "trpg-roll");
    await page.evaluate(async () => {
      const { showScreen } = await import("./js/core/ui.js");
      const replacement = document.createElement("div"); replacement.textContent = "replacement";
      showScreen("qa-replacement", replacement);
    });
    await page.waitForFunction(() => __ownedRoom.disposed && __ownedRoom.audioSnapshot().state === "closed");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#screen").textContent(), "replacement");
    assert.equal(await page.evaluate(() => __roomReturns), 0);
    assert.equal(await page.locator(".trpg-root").count(), 0);
    await preserved(page, before);
  });

  await check("pre-aborted-collection", async page => {
    const before = await prepare(page);
    const result = await page.evaluate(async () => {
      const { mountTrpgCollection } = await import("./js/trpg/collection.js");
      const host = document.createElement("div"), abort = new AbortController(); abort.abort();
      const table = mountTrpgCollection(host, { signal: abort.signal });
      await table.ready; await table.finished;
      return { children: host.childElementCount, disposed: table.disposed,
        requests: performance.getEntriesByType("resource").filter(e => /trpg_catalog\.json/.test(e.name)).length };
    });
    assert.deepEqual(result, { children: 0, disposed: true, requests: 0 }); await preserved(page, before);
  });

  await check("history-return", async page => {
    const before = await prepare(page);
    await hit(page, "title-trpg"); await button(page, "trpg-select-shark-last-order").waitFor();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    assert.equal(await page.locator(".trpg-root").count(), 0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await button(page, "title-trpg").waitFor(); await preserved(page, before);
  });
});
