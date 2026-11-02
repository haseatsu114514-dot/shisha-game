import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits, baseURL } from "./support.mjs";

// 店長の案内を加えた本棚はスクロール可能。各操作へ実際に到達できることを調べる。
async function assertShelfControls(page) {
  for (const control of await page.locator(".trpg-campaign button").all()) {
    await control.scrollIntoViewIfNeeded();
    const id = await control.getAttribute("data-test");
    await assertFits(page, `[data-test="${id}"]`);
  }
}
const button = (page, id) => page.locator('[data-test="' + id + '"]');
async function hit(page, id) {
  const target = button(page, id);
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await target.tap(); else await target.click();
}
async function lines(page) { for (let i = 0; i < 35 && await button(page, "trpg-next").isVisible(); i++) await hit(page, "trpg-next"); }

// New scenes: two questions for the story's character after the first roll, a twist after the guess.
async function interviewStep(page) {
  const snap = () => page.evaluate(() => window.__trpg?.snapshot?.() ?? null);
  if ((await snap())?.phase !== "interview" && !(await page.locator('[data-test="trpg-interview-done"], [data-test^="trpg-topic-"]').count())) return;
  for (let n = 0; n < 2; n++) {
    const topic = page.locator('[data-test^="trpg-topic-"]:not([disabled]):not(.selected)').first();
    if (!await topic.count()) break;
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await topic.tap(); else await topic.click();
    for (let i = 0; i < 40 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
  }
  const done = page.locator('[data-test="trpg-interview-done"]');
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await done.tap(); else await done.click();
}
async function twistStep(page) {
  const option = page.locator('[data-test^="trpg-plan-tactic-"]').first();
  if (!await option.count()) return;
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await option.tap(); else await option.click();
  const open = page.locator('[data-test="trpg-twist-open"]');
  if (touch) await open.tap(); else await open.click();
  const card = page.locator('[data-test^="trpg-approach-"]').first();
  if (touch) await card.tap(); else await card.click();
  for (let i = 0; i < 40 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
  const roll = page.locator('[data-test="trpg-roll"]');
  if (touch) await roll.tap(); else await roll.click();
  await page.locator('[data-test="trpg-settle"]').waitFor();
  const settle = page.locator('[data-test="trpg-settle"]');
  if (touch) await settle.tap(); else await settle.click();
  for (let i = 0; i < 60 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
}
async function declare(page) {
  const card = page.locator('[data-test^="trpg-approach-"]').first();
  if (await card.count() && await card.isVisible()) { await card.click(); await lines(page); }
}
async function roll(page) { await declare(page); await hit(page, "trpg-roll"); await button(page, "trpg-settle").waitFor(); await hit(page, "trpg-settle"); await lines(page); }
async function prepare(page, options = {}) {
  await page.evaluate(async options => {
    const core = await import("./js/core/state.js"), s = core.newGame();
    const { club = true, ...settings } = options;
    Object.assign(s, { chapter: 2, phase: "daily", day: 3, slot: 1, money: 3000, stamina: 52 }, settings);
    for (const id of ["hiyori", "samechan", "tsumugi", "adam"]) { s.met[id] = true; s.affinity[id] = 66; }
    if (club) s.trpg.club = { founded: { chapter: 2, day: 1 }, members: Object.fromEntries(
      ["hiyori", "samechan", "tsumugi", "adam"].map(id => [id, { chapter: 2, day: 2 }])) };
    s.flags._rei_trpg_introduced = true; s.flags._qa_preserved = true; s.flavorStock.double_apple = 37; s.reel.count = 3;
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
  await button(page, "trpg-campaign-notice").waitFor();
}
async function snapshot(page) { return page.evaluate(() => structuredClone(__remake.state)); }
async function play(page, id, { expectTutorial = false } = {}) {
  await hit(page, "trpg-play-" + id);
  if (expectTutorial) {
    // The shopkeeper explains the first table on the cover, with a diagram for each idea.
    await button(page, "trpg-tutorial-panel").waitFor();
    assert.match(await page.locator(".trpg-speaker-label strong").textContent(), /六角サイ/);
    assert(!await button(page, "trpg-start").isVisible(), "the cover waits until the shopkeeper finishes");
  }
  await lines(page); await hit(page, "trpg-start"); await lines(page); await roll(page);
  const shark = id === "shark-last-order";
  await interviewStep(page);
  for (const spot of shark ? ["radio", "leaves", "fan"] : ["menu", "window", "bag"]) { await hit(page, "trpg-spot-" + spot); await lines(page); }
  await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-" + (shark ? "scent" : "quiet")); await lines(page);
  await twistStep(page);
  for (const [field, value] of shark ? [["tool", "citrus"], ["route", "pier"]] : [["aroma", "tea"], ["seat", "window"]]) await hit(page, "trpg-plan-" + field + "-" + value);
  await hit(page, "trpg-prepare-open"); await roll(page);
  await hit(page, "trpg-plan-" + (shark ? "finale-lure" : "approach-quiet")); await hit(page, "trpg-serve-open"); await roll(page);
  await button(page, "trpg-ending-title").waitFor();
}
await suite("trpg-main", async check => {
  for (const [label, options] of [
    ["club-recruit-pc", { viewport: { width: 1280, height: 720 } }],
    ["club-recruit-touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label, async page => {
    await prepare(page, { club: false }); const before = await storageSnapshot(page);
    await page.goto(new URL("trpg-campaign-preview.html", baseURL).href);
    await button(page, "trpg-club-choice-time").waitFor();
    assert.equal(await button(page, "trpg-club-choice-people").count(), 1);
    assert.equal(await button(page, "trpg-buy-shark-last-order").count(), 0);
    await assertShelfControls(page);
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-club-proposal-" + label + ".png" });
    await hit(page, label === "club-recruit-pc" ? "trpg-club-choice-time" : "trpg-club-choice-people");
    assert((await button(page, "trpg-club-founded").textContent()).includes(label === "club-recruit-pc" ? "営業が終わるまで" : "声をかけるところから"));
    assert.equal(await button(page, "trpg-buy-shark-last-order").count(), 0, "MAX alone must not stock a book");
    await hit(page, "trpg-demo-meet-samechan"); await assertFits(page, ".trpg-club-dialog button");
    await hit(page, "trpg-recruit-later");
    assert.deepEqual(await page.evaluate(() => __trpgCampaignPreview.snapshot().trpg.club.members), {});
    await hit(page, "trpg-demo-meet-samechan"); await hit(page, "trpg-recruit-invite");
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-club-invite-" + label + ".png" });
    await hit(page, "trpg-recruit-next");
    assert.deepEqual(await page.evaluate(() => __trpgCampaignPreview.snapshot().trpg.club.members), {}, "Read the whole acceptance first");
    await hit(page, "trpg-recruit-next"); await button(page, "trpg-buy-shark-last-order").waitFor();
    assert.equal(await button(page, "trpg-demo-meet-samechan").count(), 0);
    for (const id of ["hiyori", "adam", "tsumugi"]) {
      await hit(page, "trpg-demo-meet-" + id); await hit(page, "trpg-recruit-invite");
      await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
    }
    const joined = await page.evaluate(() => __trpgCampaignPreview.snapshot());
    assert.equal(Object.keys(joined.trpg.club.members).length, 4); assert.equal(joined.slot, 1); assert.equal(joined.money, 3000);
    await hit(page, "trpg-buy-shark-last-order"); assert(await button(page, "trpg-play-shark-last-order").isEnabled());
    assert.equal(await button(page, "trpg-person-adam").getAttribute("data-available"), "true");
    await assertShelfControls(page); assert.deepEqual(await storageSnapshot(page), before);
  }, options);
  await check("actual-visits-recruit-and-save-members", async page => {
    await prepare(page, { club: false, money: 30000 });
    await page.evaluate(async () => {
      const { openTrpgBar } = await import("./js/daily/trpg.js"); openTrpgBar();
    });
    await hit(page, "trpg-club-choice-people"); await hit(page, "trpg-campaign-close");
    assert.equal(await button(page, "trpg-demo-meet-samechan").count(), 0, "Real bar has no remote recruitment");
    await page.evaluate(async () => {
      const { vnTest } = await import("./js/vn/engine.js"); vnTest.turbo = true;
      const { visitChar } = await import("./js/daily/spots.js");
      window.__visit = null; visitChar("adam").then(() => { window.__visit = true; });
    });
    await button(page, "trpg-recruit-invite").waitFor(); await hit(page, "trpg-recruit-invite");
    assert((await button(page, "trpg-recruit-line").textContent()).includes("俺"));
    await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
    await page.waitForFunction(() => __visit); assert((await snapshot(page)).trpg.club.members.adam);
    await page.evaluate(async () => {
      const { visitSamechan } = await import("./js/daily/samechan.js");
      window.__visit = null; visitSamechan({ id: "shishark", cost: 3000 }).then(result => { window.__visit = result; });
    });
    await hit(page, "trpg-recruit-invite"); await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
    await page.waitForFunction(() => __visit);
    for (const id of ["tsumugi", "hiyori"]) {
      await page.evaluate(async id => {
        window.__visit = null;
        if (id === "hiyori") {
          const { playHiyoriHangout } = await import("./js/daily/hiyori.js");
          playHiyoriHangout().then(result => { window.__visit = result; });
        } else {
          const { visitChar } = await import("./js/daily/spots.js");
          visitChar(id).then(() => { window.__visit = true; });
        }
      }, id);
      await hit(page, "trpg-recruit-invite"); await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
      await page.waitForFunction(() => __visit);
    }
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.save(); core.load(); });
    const loaded = await snapshot(page); assert(loaded.trpg.club.members.samechan); assert(loaded.trpg.club.members.adam);
    assert(loaded.trpg.club.members.hiyori); assert(loaded.trpg.club.members.tsumugi);
    await open(page); await hit(page, "trpg-buy-shark-last-order");
    assert(await button(page, "trpg-play-shark-last-order").isEnabled());
  });
  await check("cancelled-recruitment-and-replaced-save-do-not-join", async page => {
    await prepare(page, { club: false });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.state.trpg.club.founded = { chapter: 2, day: 3 };
      const { maybeRecruitTrpgMember } = await import("./js/daily/trpg.js");
      window.__recruit = null; maybeRecruitTrpgMember("hiyori").then(result => { window.__recruit = result; });
    });
    await hit(page, "trpg-recruit-invite"); await page.keyboard.press("Escape");
    await page.waitForFunction(() => __recruit === false); assert.deepEqual((await snapshot(page)).trpg.club.members, {});
    // A later visit may offer again. Replacing the active save aborts the pending conversation.
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.state.slot = 0;
      const { maybeRecruitTrpgMember } = await import("./js/daily/trpg.js");
      window.__recruit = null; maybeRecruitTrpgMember("hiyori").then(result => { window.__recruit = result; });
    });
    await hit(page, "trpg-recruit-invite");
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.newGame(); });
    await page.waitForFunction(() => __recruit === false);
    assert.equal(await page.locator(".trpg-club-dialog").count(), 0); assert.deepEqual((await snapshot(page)).trpg.club.members, {});
  });
  for (const [label, id, options] of [
    ["ordinary-pc", "ordinary-cup", { viewport: { width: 1280, height: 720 } }],
    ["shark-touch", "shark-last-order", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label, async page => {
    await prepare(page); const baseline = await storageSnapshot(page);
    await open(page); await assertShelfControls(page);
    await hit(page, "trpg-buy-ordinary-cup"); await hit(page, "trpg-buy-shark-last-order");
    const bought = await snapshot(page); assert.equal(bought.money, 1700); assert.equal(bought.slot, 1);
    assert.equal(bought.stamina, 52); assert.equal(bought.reel.count, 3); assert.equal(bought.flavorStock.double_apple, 37);
    assert(!bought.flags._trpg_tutorial_seen);
    await play(page, id, { expectTutorial: true });
    const ending = await snapshot(page);
    assert.equal(ending.slot, 2); assert(ending.trpg.cleared[id]);
    assert.equal(ending.flags._trpg_tutorial_seen, true, "finishing the first story retires the automatic tutorial");
    assert.equal(ending.trpg.cleared[id].pc.name, id === "ordinary-cup" ? "フィン" : "レン", "the default character is kept in the memory");
    assert(!ending.trpg.cleared[id].participants.some(id => ["naru", "sumi"].includes(id)));
    assert.equal(await button(page, "trpg-replay").count(), 0);
    const storage = await storageSnapshot(page);
    assert.equal(storage.local.suien_remake_slot1, baseline.local.suien_remake_slot1);
    assert.equal(storage.local.qa_unrelated, "keep"); assert.equal(storage.session.qa_unrelated, "keep");
    assert(JSON.parse(storage.local.suien_remake_save).trpg.cleared[id], "Ending must save before the finish button");
    await hit(page, "trpg-finish"); await hit(page, "trpg-reflect-hard"); await hit(page, "trpg-campaign-close");
    await page.waitForFunction(() => window.__trpgBarResult?.completed);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); core.state.day = 5; core.state.slot = 1; });
    await open(page); assert.equal(await button(page, "trpg-play-" + id).count(), 0);
    assert((await button(page, "trpg-memory-" + id).textContent()).length > 0);
    assert.match(await button(page, "trpg-memory-pc").textContent(), /演じた役/);
    await assertShelfControls(page);
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-campaign-memory-" + label + ".png" });
    await hit(page, "trpg-campaign-close");
  }, options);
  await check("purchase-cancel-and-small-table", async page => {
    await prepare(page); await open(page); await hit(page, "trpg-buy-ordinary-cup");
    await page.evaluate(() => {
      delete __remake.state.trpg.club.members.tsumugi;
      delete __remake.state.trpg.club.members.adam;
    });
    await hit(page, "trpg-campaign-close"); await open(page);
    const before = await snapshot(page);
    await hit(page, "trpg-play-ordinary-cup");
    assert.equal(await page.locator(".trpg-table-person").count(), 2);
    await lines(page); await hit(page, "trpg-start"); await lines(page); await roll(page);
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
    await lines(page); await hit(page, "trpg-start"); await lines(page); await roll(page); await interviewStep(page);
    await hit(page, "trpg-consult-adam"); assert((await page.locator(".trpg-speech p").textContent()).includes("狙いを定めよう"));
    await lines(page); await hit(page, "trpg-exit"); await hit(page, "trpg-exit-confirm");
    assert.deepEqual((await snapshot(page)).trpg.cleared, {});
  });
  await check("required-gm-and-prior-appointment", async page => {
    await prepare(page, { day: 4 }); await open(page); await hit(page, "trpg-buy-shark-last-order");
    assert(await button(page, "trpg-play-shark-last-order").isEnabled());
    await page.evaluate(() => { __remake.state.trpg.shifts.push({ id: "samechan", chapter: 2, day: 4, slot: 1, busy: true, reason: "別の約束" }); });
    await hit(page, "trpg-campaign-close"); await open(page);
    assert(await button(page, "trpg-play-shark-last-order").isDisabled());
    await hit(page, "trpg-campaign-close"); await open(page, { nightBusy: true });
    assert((await button(page, "trpg-campaign-notice").textContent()).includes("予定"));
    await hit(page, "trpg-buy-ordinary-cup"); assert(await button(page, "trpg-play-ordinary-cup").isDisabled());
  });
  await check("retained-shelf-module-is-read-only-without-title-entry", async page => {
    await prepare(page);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.state.trpg.stock = ["ordinary-cup"]; core.save(); const { showTitle } = await import("./js/scenes/title.js"); showTitle(); });
    const before = await storageSnapshot(page), stateBefore = await snapshot(page);
    assert.equal(await button(page, "title-trpg").count(), 0);
    // Exercise the retained module directly; it is no longer a player-facing title route.
    await page.evaluate(async () => {
      const { openTrpgRoom } = await import("./js/scenes/trpg-room.js");
      const { showTitle } = await import("./js/scenes/title.js");
      openTrpgRoom(() => showTitle());
    });
    await button(page, "trpg-buy-ordinary-cup").waitFor();
    assert(await button(page, "trpg-buy-ordinary-cup").isDisabled());
    assert.equal(await page.locator('[data-test^="trpg-play-"]:enabled').count(), 0);
    await hit(page, "trpg-campaign-close"); await button(page, "title-new").waitFor();
    assert.equal(await button(page, "title-trpg").count(), 0);
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
    await assertShelfControls(page);
  });
  await check("isolated-demo-and-chapter-gate", async page => {
    await prepare(page); const before = await storageSnapshot(page);
    await page.goto(new URL("trpg-campaign-preview.html", baseURL).href);
    await hit(page, "trpg-club-choice-time"); await hit(page, "trpg-demo-meet-samechan");
    await hit(page, "trpg-recruit-invite"); await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
    await hit(page, "trpg-buy-shark-last-order"); await hit(page, "trpg-campaign-close");
    await hit(page, "trpg-demo-ch1");
    assert((await button(page, "trpg-campaign-notice").textContent()).includes("第2章"));
    assert(await button(page, "trpg-play-shark-last-order").isDisabled());
    assert.deepEqual(await storageSnapshot(page), before);
  });
});
