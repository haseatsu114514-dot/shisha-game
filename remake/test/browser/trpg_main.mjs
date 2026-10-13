import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits, baseURL } from "./support.mjs";
const button = (page, id) => page.locator('[data-test="' + id + '"]');
async function hit(page, id) {
  const target = button(page, id);
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await target.tap(); else await target.click();
}
async function lines(page) { for (let i = 0; i < 35 && await button(page, "trpg-next").isVisible(); i++) await hit(page, "trpg-next"); }
async function roll(page) { await hit(page, "trpg-roll"); await button(page, "trpg-settle").waitFor(); await hit(page, "trpg-settle"); await lines(page); }
async function prepare(page, options = {}) {
  await page.evaluate(async options => {
    const core = await import("./js/core/state.js"), s = core.newGame();
    Object.assign(s, { chapter: 2, phase: "daily", day: 3, slot: 1, money: 3000, stamina: 52 }, options);
    for (const id of ["hiyori", "samechan", "tsumugi", "adam"]) { s.met[id] = true; s.affinity[id] = 66; }
    s.flags._qa_preserved = true; s.flavorStock.double_apple = 37; s.reel.count = 3;
    core.config.textSpeed = 4; core.config.bgmVolume = 0; core.saveConfig(); core.saveToSlot("suien_remake_slot1");
    localStorage.setItem("qa_unrelated", "keep"); sessionStorage.setItem("qa_unrelated", "keep");
  }, options);
}
async function open(page, { nightBusy = false } = {}) {
  await page.evaluate(async nightBusy => {
    const { openTrpgBar } = await import("./js/daily/trpg.js");
    window.__trpgBarResult = null;
    openTrpgBar({ nightBusy: () => nightBusy }).then(result => { window.__trpgBarResult = result; });
  }, nightBusy);
  await button(page, "trpg-buy-ordinary-cup").or(button(page, "trpg-play-ordinary-cup")).or(button(page, "trpg-memory-ordinary-cup")).waitFor();
}
async function snapshot(page) { return page.evaluate(() => structuredClone(__remake.state)); }
async function play(page, id) {
  await hit(page, "trpg-play-" + id); await hit(page, "trpg-start"); await lines(page); await roll(page);
  const shark = id === "shark-last-order";
  for (const spot of shark ? ["radio", "leaves", "fan"] : ["menu", "window", "bag"]) { await hit(page, "trpg-spot-" + spot); await lines(page); }
  await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-" + (shark ? "scent" : "quiet")); await lines(page);
  for (const [field, value] of shark ? [["tool", "citrus"], ["route", "pier"]] : [["aroma", "tea"], ["seat", "window"]]) await hit(page, "trpg-plan-" + field + "-" + value);
  await hit(page, "trpg-prepare-open"); await roll(page);
  await hit(page, "trpg-plan-" + (shark ? "finale-lure" : "approach-quiet")); await hit(page, "trpg-serve-open"); await roll(page);
  await button(page, "trpg-ending-title").waitFor();
}
await suite("trpg-main", async check => {
  for (const [label, id, options] of [
    ["ordinary-pc", "ordinary-cup", { viewport: { width: 1280, height: 720 } }],
    ["shark-touch", "shark-last-order", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label, async page => {
    await prepare(page); const baseline = await storageSnapshot(page);
    await open(page); await assertFits(page, ".trpg-campaign button");
    await hit(page, "trpg-buy-ordinary-cup"); await hit(page, "trpg-buy-shark-last-order");
    const bought = await snapshot(page); assert.equal(bought.money, 1700); assert.equal(bought.slot, 1);
    assert.equal(bought.stamina, 52); assert.equal(bought.reel.count, 3); assert.equal(bought.flavorStock.double_apple, 37);
    await play(page, id);
    const ending = await snapshot(page);
    assert.equal(ending.slot, 2); assert(ending.trpg.cleared[id]);
    assert(!ending.trpg.cleared[id].participants.some(id => ["naru", "sumi"].includes(id)));
    assert.equal(await button(page, "trpg-replay").count(), 0);
    const storage = await storageSnapshot(page);
    assert.equal(storage.local.suien_remake_slot1, baseline.local.suien_remake_slot1);
    assert.equal(storage.local.qa_unrelated, "keep"); assert.equal(storage.session.qa_unrelated, "keep");
    assert(JSON.parse(storage.local.suien_remake_save).trpg.cleared[id], "Ending must save before the finish button");
    await hit(page, "trpg-finish"); await page.waitForFunction(() => window.__trpgBarResult?.completed);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); core.state.day = 5; core.state.slot = 1; });
    await open(page); assert.equal(await button(page, "trpg-play-" + id).count(), 0);
    assert((await button(page, "trpg-memory-" + id).textContent()).length > 0);
    await assertFits(page, ".trpg-campaign button");
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-campaign-memory-" + label + ".png" });
    await hit(page, "trpg-campaign-close");
  }, options);
  await check("purchase-cancel-and-small-table", async page => {
    await prepare(page); await open(page); await hit(page, "trpg-buy-ordinary-cup");
    await page.evaluate(() => { __remake.state.affinity.tsumugi = 0; });
    await hit(page, "trpg-campaign-close"); await open(page);
    const before = await snapshot(page);
    await hit(page, "trpg-play-ordinary-cup");
    assert.equal(await page.locator(".trpg-table-person").count(), 2);
    await hit(page, "trpg-start"); await lines(page); await roll(page);
    assert.equal(await page.locator('[data-test^="trpg-consult-"]').count(), 0);
    await hit(page, "trpg-exit"); await hit(page, "trpg-exit-confirm"); await button(page, "trpg-play-ordinary-cup").waitFor();
    assert.deepEqual(await snapshot(page), before);
    await play(page, "ordinary-cup"); assert((await snapshot(page)).trpg.cleared["ordinary-cup"]);
  });
  await check("authored-replacement-on-a-free-shift", async page => {
    await prepare(page, { day: 5 });
    await page.evaluate(() => { __remake.state.trpg.shifts = [{ id: "hiyori", chapter: 2, day: 5, slot: 1, busy: true, reason: "残業中" }]; });
    await open(page); await hit(page, "trpg-buy-shark-last-order");
    assert((await button(page, "trpg-person-hiyori").textContent()).includes("残業中"));
    await hit(page, "trpg-play-shark-last-order");
    assert(await page.locator('.trpg-table-person[data-speaker="adam"]').count());
    assert.equal(await page.locator('.trpg-table-person[data-speaker="hiyori"]').count(), 0);
    await hit(page, "trpg-start"); await lines(page); await roll(page);
    await hit(page, "trpg-consult-adam"); assert((await page.locator(".trpg-speech p").textContent()).includes("狙いを定めよう"));
    await lines(page); await hit(page, "trpg-exit"); await hit(page, "trpg-exit-confirm");
    assert.deepEqual((await snapshot(page)).trpg.cleared, {});
  });
  await check("required-gm-and-prior-appointment", async page => {
    await prepare(page, { day: 4 }); await open(page); await hit(page, "trpg-buy-shark-last-order");
    assert(await button(page, "trpg-play-shark-last-order").isDisabled());
    await hit(page, "trpg-campaign-close"); await open(page, { nightBusy: true });
    assert((await button(page, "trpg-campaign-notice").textContent()).includes("予定"));
    await hit(page, "trpg-buy-ordinary-cup"); assert(await button(page, "trpg-play-ordinary-cup").isDisabled());
  });
  await check("title-shelf-is-read-only-and-restores-focus", async page => {
    await prepare(page);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.state.trpg.stock = ["ordinary-cup"]; core.save(); const { showTitle } = await import("./js/scenes/title.js"); showTitle(); });
    const before = await storageSnapshot(page), stateBefore = await snapshot(page);
    await hit(page, "title-trpg"); await button(page, "trpg-buy-ordinary-cup").waitFor();
    assert(await button(page, "trpg-buy-ordinary-cup").isDisabled());
    assert.equal(await page.locator('[data-test^="trpg-play-"]:enabled').count(), 0);
    await hit(page, "trpg-campaign-close"); await button(page, "title-trpg").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "title-trpg");
    assert.deepEqual(await storageSnapshot(page), before); assert.deepEqual(await snapshot(page), stateBefore);
  });
  await check("load-retry-cancel-and-owner-cleanup", async page => {
    await prepare(page); let broken = true;
    await page.route("**/data/trpg_catalog.json", route => broken ? route.fulfill({ status: 200, contentType: "application/json", body: "{broken" }) : route.continue());
    await page.evaluate(async () => { const { openTrpgBar } = await import("./js/daily/trpg.js"); openTrpgBar(); });
    await button(page, "trpg-campaign-retry").waitFor(); const before = await storageSnapshot(page);
    broken = false; await hit(page, "trpg-campaign-retry"); await button(page, "trpg-buy-ordinary-cup").waitFor();
    await hit(page, "trpg-campaign-close");
    await open(page); await hit(page, "trpg-buy-ordinary-cup"); await hit(page, "trpg-play-ordinary-cup");
    const bought = await storageSnapshot(page);
    await page.evaluate(async () => { const { showTitle } = await import("./js/scenes/title.js"); showTitle(); });
    await page.waitForFunction(() => window.__trpgBarResult != null);
    assert.equal(await page.locator(".trpg-root").count(), 0); assert.deepEqual(await storageSnapshot(page), bought);
    assert.equal(before.local.suien_remake_slot1, bought.local.suien_remake_slot1);
  });
  await check("daily-map-facility-and-free-shopping", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.state.flags._morning_3 = true;
      const { runDaily } = await import("./js/daily/calendar.js");
      runDaily({ nightEvents: {}, onQuit: () => {} });
    });
    await button(page, "pin-trpg_bar").waitFor();
    await hit(page, "pin-trpg_bar"); await hit(page, "map-go");
    await button(page, "trpg-buy-ordinary-cup").waitFor();
    await hit(page, "trpg-buy-ordinary-cup"); await hit(page, "trpg-campaign-close");
    await button(page, "pin-trpg_bar").waitFor();
    assert.equal((await snapshot(page)).slot, 1); assert.equal((await snapshot(page)).money, 2500);
    await hit(page, "pin-trpg_bar"); await hit(page, "map-go");
    await button(page, "trpg-play-ordinary-cup").waitFor();
    await assertFits(page, ".trpg-campaign button");
  });
  await check("isolated-demo-and-chapter-gate", async page => {
    await prepare(page); const before = await storageSnapshot(page);
    await page.goto(new URL("trpg-campaign-preview.html", baseURL).href);
    await hit(page, "trpg-buy-shark-last-order"); await hit(page, "trpg-campaign-close");
    await hit(page, "trpg-demo-ch1");
    assert((await button(page, "trpg-campaign-notice").textContent()).includes("第2章"));
    assert(await button(page, "trpg-play-shark-last-order").isDisabled());
    assert.deepEqual(await storageSnapshot(page), before);
  });
});
