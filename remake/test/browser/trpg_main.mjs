import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, storageSnapshot, assertFits, baseURL } from "./support.mjs";

const book = name => JSON.parse(fs.readFileSync(new URL("../../../data/dialogue/" + name + ".json", import.meta.url), "utf8"));
const ordinary = book("trpg_ordinary"), shark = book("trpg_shark");

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
    for (const id of ["hiyori", "samechan", "tsumugi", "adam"]) {
      s.met[id] = true; s.affinity[id] = 66; s.flags[`_trpg_topic_${id}`] = true;
    }
    if (club) s.trpg.club = { founded: { chapter: 2, day: 1 }, members: Object.fromEntries(
      ["hiyori", "samechan", "tsumugi", "adam"].map(id => [id, { chapter: 2, day: 2 }])) };
    s.flags._rei_trpg_introduced = true; s.flags._qa_preserved = true; s.flavorStock.double_apple = 37; s.reel.count = 3;
    core.config.textSpeed = 4; core.config.bgmVolume = 0; core.saveConfig(); core.saveToSlot("suien_remake_slot1");
    localStorage.setItem("qa_unrelated", "keep"); sessionStorage.setItem("qa_unrelated", "keep");
  }, options);
}
// 初回入店ではサイの紹介前に主人公の VN 1 行を読み進める。
// 実際の入店経路を検査するため、既読フラグを立てて省略しない。
async function advanceSaiIntro(page) {
  if (await page.evaluate(() => __remake.state.flags._intro_sai)) return;
  await page.waitForFunction(() => document.querySelector("#vn.active .vn-text")?.textContent === "こんばんは。遊べる卓を探していて");
  // VN 開始から 320ms は入力が無視される。表示だけで直ちに押すと会話が進まない。
  await page.waitForTimeout(350);
  await page.locator("#vn.active .vn-box").click();
  await page.locator('.cutin.in[data-char="sai"]').waitFor();
  await page.locator(".cutin").waitFor({ state: "detached" });
}
// 本編の設立は本棚の操作ではなく、入店時の通常会話で最後まで読む。
async function finishClubFounding(page, choice = 0) {
  await page.evaluate(async choice => {
    const { vnTest } = await import("./js/vn/engine.js");
    vnTest.choose = () => choice; vnTest.turbo = true;
    const auto = document.querySelector('[data-test="vn-auto"]');
    if (auto?.getAttribute("aria-pressed") !== "true") auto?.click();
  }, choice);
  await button(page, "trpg-campaign-notice").waitFor();
  await page.evaluate(async () => { const { vnTest } = await import("./js/vn/engine.js"); vnTest.turbo = false; vnTest.choose = null;
    const auto = document.querySelector('[data-test="vn-auto"]');
    if (auto?.getAttribute("aria-pressed") === "true") auto.click();
  });
}
async function open(page, { nightBusy = false } = {}) {
  await page.evaluate(async nightBusy => {
    const { openTrpgBar } = await import("./js/daily/trpg.js");
    window.__trpgBarResult = null;
    openTrpgBar({ nightBusy: () => nightBusy }).then(result => { window.__trpgBarResult = result; });
  }, nightBusy);
  await advanceSaiIntro(page);
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
  await check("low-affinity-topic-before-invite", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      delete state.flags._trpg_topic_hiyori; state.affinity.hiyori = 0;
      delete state.trpg.club.members.hiyori;
      const { maybeRecruitTrpgMember } = await import("./js/daily/trpg.js");
      window.__topicRecruit = null;
      maybeRecruitTrpgMember("hiyori").then(result => { window.__topicRecruit = result; });
    });
    await button(page, "trpg-topic-hear").waitFor();
    assert.equal(await button(page, "trpg-recruit-invite").count(), 0);
    await hit(page, "trpg-topic-hear");
    assert((await snapshot(page)).flags._trpg_topic_hiyori);
    await hit(page, "trpg-recruit-invite");
    await hit(page, "trpg-recruit-next"); await hit(page, "trpg-recruit-next");
    await page.waitForFunction(() => window.__topicRecruit === true);
    assert((await snapshot(page)).trpg.club.members.hiyori);
  });
  await check("zero-members-regular-table", async page => {
    await prepare(page);
    await page.evaluate(() => { __remake.state.trpg.club.members = {}; });
    await open(page);
    assert.deepEqual((await snapshot(page)).trpg.club.members, {});
    assert.equal(await button(page, "trpg-book-regular-harbor").getAttribute("data-locked"), "false");
    await hit(page, "trpg-buy-regular-harbor");
    assert(await button(page, "trpg-play-regular-harbor").isEnabled());
    await play(page, "regular-harbor", { expectTutorial: true });
    const done = await snapshot(page);
    assert(done.trpg.cleared["regular-harbor"]);
    assert.deepEqual(new Set(done.trpg.cleared["regular-harbor"].participants), new Set(["sai", "hajime", "regulara", "regularb"]));
    assert.deepEqual(done.trpg.club.members, {});
  });
  await check("nine-books-and-sai-finale", async page => {
    await prepare(page);
    const catalog = JSON.parse(fs.readFileSync(new URL("../../../data/trpg_catalog.json", import.meta.url), "utf8"));
    const finale = catalog.scenarios.find(b => b.finale);
    const memories = Object.fromEntries(catalog.scenarios.filter(b => b.member).map(b => {
      const story = book(b.file.split("/").at(-1).replace(/\.json$/, ""));
      const ending = Object.keys(story.endings)[0];
      return [b.id, { chapter: 2, day: 2, participants: ["hajime", b.member], gm: story.cast[0].id,
        ending, endingTitle: story.endings[ending].title }];
    }));
    const last = finale.clearRequires.at(-1);
    await page.evaluate(({ memories, last }) => {
      __remake.state.trpg.cleared = structuredClone(memories);
      delete __remake.state.trpg.cleared[last];
    }, { memories, last });
    await open(page);
    assert.equal(await page.locator(".trpg-campaign-book").count(), 9);
    assert.match(await button(page, "trpg-book-" + finale.id).innerText(), /5／6/);
    assert.equal(await button(page, "trpg-buy-" + finale.id).count(), 0);
    await hit(page, "trpg-campaign-close");
    await page.evaluate(({ memories, last }) => { __remake.state.trpg.cleared[last] = memories[last]; }, { memories, last });
    await open(page);
    await hit(page, "trpg-buy-" + finale.id);
    assert(await button(page, "trpg-play-" + finale.id).isEnabled());
    await hit(page, "trpg-play-" + finale.id);
    await lines(page);
    assert.match(await page.locator(".trpg-table-person").first().textContent(), /六角サイ/);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
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
    const locked = button(page, "trpg-book-shark-last-order");
    assert.equal(await locked.getAttribute("data-locked"), "true");
    assert.equal(await locked.locator("h2").textContent(), "？？？？？");
    assert.equal(await button(page, "trpg-play-shark-last-order").count(), 0);
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-locked-" + label + ".png" });
    await hit(page, "trpg-demo-meet-samechan"); await assertFits(page, ".trpg-club-dialog button");
    await hit(page, "trpg-recruit-later");
    assert.deepEqual(await page.evaluate(() => __trpgCampaignPreview.snapshot().trpg.club.members), {});
    await hit(page, "trpg-demo-meet-samechan"); await hit(page, "trpg-recruit-invite");
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-club-invite-" + label + ".png" });
    await hit(page, "trpg-recruit-next");
    assert.deepEqual(await page.evaluate(() => __trpgCampaignPreview.snapshot().trpg.club.members), {}, "Read the whole acceptance first");
    await hit(page, "trpg-recruit-next"); await button(page, "trpg-buy-shark-last-order").waitFor();
    assert.equal(await locked.getAttribute("data-locked"), "false");
    assert.notEqual(await locked.locator("h2").textContent(), "？？？？？");
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
  for (const [label, options, slot, choice] of [
    ["entry-founding-pc-day", { viewport: { width: 1280, height: 720 } }, 0, 0],
    ["entry-founding-touch-night", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, 1, 1],
  ]) await check(label, async page => {
    await prepare(page, { club: false, slot });
    const before = await snapshot(page);
    await page.evaluate(async () => { const { openTrpgBar } = await import("./js/daily/trpg.js"); openTrpgBar(); });
    await advanceSaiIntro(page);
    await page.locator("#vn.active .vn-box").waitFor();
    assert.equal(await page.locator(".trpg-campaign").count(), 0, "The shelf waits for the ordinary conversation");
    assert.equal((await snapshot(page)).trpg.club.founded, null);
    // Read the proposal using the same tap/click box as every other daily conversation.
    for (let i = 0; i < 12 && !await button(page, "choice-0").isVisible(); i++) {
      await page.waitForTimeout(360);
      const box = page.locator("#vn.active .vn-box");
      if (options.hasTouch) await box.tap(); else await box.click();
    }
    await button(page, "choice-0").waitFor();
    assert.match(await button(page, "choice-0").textContent(), /店の仕事/);
    assert.match(await button(page, "choice-1").textContent(), /知り合い/);
    assert.equal((await snapshot(page)).trpg.club.founded, null, "Merely reaching the choice does not found");
    await hit(page, "choice-" + choice);
    assert.equal((await snapshot(page)).trpg.club.founded, null, "The chosen branch must also finish first");
    await finishClubFounding(page, choice);
    const after = await snapshot(page);
    assert.deepEqual(after.trpg.club.founded, { chapter: 2, day: before.day });
    assert.deepEqual(after.trpg.club.members, {});
    assert.equal(after.slot, before.slot); assert.equal(after.money, before.money); assert.equal(after.stamina, before.stamina);
    assert.equal(await button(page, "trpg-club-choice-time").count(), 0, "No founding card remains in the real shelf");
    await hit(page, "trpg-campaign-close");
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); });
    assert.deepEqual((await snapshot(page)).trpg.club.founded, after.trpg.club.founded);
    await open(page);
    assert.equal(await page.locator("#vn.active").count(), 0, "Founded saves do not repeat the visit event");
    await hit(page, "trpg-campaign-close");
  }, options);
  await check("entry-founding-cancel-and-retry", async page => {
    await prepare(page, { club: false });
    await page.evaluate(async () => {
      __remake.state.flags._intro_sai = true;
      const { openTrpgBar } = await import("./js/daily/trpg.js");
      window.__trpgBarResult = null;
      openTrpgBar().then(result => { window.__trpgBarResult = result; });
    });
    await page.locator("#vn.active .vn-box").waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForFunction(() => window.__trpgBarResult !== null);
    assert.equal((await snapshot(page)).trpg.club.founded, null);
    assert.equal(await page.locator(".trpg-campaign").count(), 0);
    await page.evaluate(async () => { const { openTrpgBar } = await import("./js/daily/trpg.js"); openTrpgBar(); });
    await finishClubFounding(page);
    assert((await snapshot(page)).trpg.club.founded);
    await hit(page, "trpg-campaign-close");
  });
  await check("actual-visits-recruit-and-save-members", async page => {
    await prepare(page, { club: false, money: 30000 });
    await page.evaluate(async () => {
      const { openTrpgBar } = await import("./js/daily/trpg.js"); openTrpgBar();
    });
    await advanceSaiIntro(page);
    await finishClubFounding(page, 1); await hit(page, "trpg-campaign-close");
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
    // TRF13: a new club starts at rank 1 with no growth point yet.
    assert.equal(await button(page, "trpg-club-rank").getAttribute("data-rank"), "1");
    assert.equal(await button(page, "trpg-club-growth").count(), 0);
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
    // TRF13: the ending tells what the night added to the club (a first clear is 2 + 1 ending + 0-3 stars), and the shelf shows it.
    assert.match(await button(page, "trpg-ending-club").textContent(), /部の実績 ＋[3-6]/);
    await hit(page, "trpg-finish");
    assert.match(await button(page, "trpg-club-rank").getAttribute("aria-label"), /実績 [3-6]。/);
    await assertFits(page, '[data-test="trpg-club-rank"]');
    await hit(page, "trpg-reflect-hard"); await hit(page, "trpg-campaign-close");
    await page.waitForFunction(() => window.__trpgBarResult?.completed);
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.load(); core.state.day = 5; core.state.slot = 1; });
    // TMX14 (owner 2026-11-11): a finished book can be played again on a later night.
    await open(page); assert.equal(await button(page, "trpg-play-" + id).textContent(), "もう一度遊ぶ");
    assert((await button(page, "trpg-memory-" + id).textContent()).length > 0);
    assert.match(await button(page, "trpg-memory-pc").textContent(), /演じた役/);
    await assertShelfControls(page);
    await page.screenshot({ path: (process.env.ARTIFACT_DIR || ".codex/artifacts/trpg") + "/trpg-campaign-memory-" + label + ".png" });
    await hit(page, "trpg-campaign-close");
  }, options);
  // TRF13: the rank is counted from the shelf (no new save field), and its growth point reaches the player's first role.
  await check("club-rank-growth-on-the-sheet", async page => {
    await prepare(page);
    await page.evaluate(({ version, endings }) => {
      const s = __remake.state; s.flags._trpg_tutorial_seen = true;
      s.trpg.stock = ["ordinary-cup", "shark-last-order"]; s.trpg.owned = ["ordinary-cup", "shark-last-order"];
      // 2 (cleared) + 2 (endings seen) + 2 (stars) = 6 points: rank 2, growth +1.
      s.trpg.cleared["shark-last-order"] = { chapter: 2, day: 2, gm: "samechan", participants: ["hajime", "hiyori", "samechan"],
        ending: endings[0], endingTitle: "", variant: "smooth", plan: {}, version, stars: 2, heat: 6, night: "盛り上がった夜", endingsSeen: endings, plays: 2 };
    }, { version: shark.version, endings: Object.keys(shark.endings).slice(0, 2) });
    await open(page);
    const banner = button(page, "trpg-club-rank");
    assert.equal(await banner.getAttribute("data-rank"), "2");
    assert.equal(await banner.getAttribute("aria-label"), "部のランク 2、なじみの部。実績 6。次のランクまで あと10。はじめの役の成長点 ＋1");
    assert.match(await button(page, "trpg-club-growth").textContent(), /能力＋1/);
    await banner.scrollIntoViewIfNeeded(); await assertFits(page, '[data-test="trpg-club-rank"]');
    await hit(page, "trpg-play-ordinary-cup"); await lines(page);
    assert.match(await page.locator('[data-test="trpg-cover-pc"] [data-test="trpg-growth"]').textContent(), /成長点 ＋1/);
    await hit(page, "trpg-build"); await hit(page, "trpg-builder-advanced");
    assert.match(await button(page, "trpg-stat-points").textContent(), new RegExp("残り 0 点 · 合計 " + (ordinary.builder.points + 1) + " 点"),
      "the recommended sheet already spends the growth point");
    await hit(page, "trpg-build-back"); await hit(page, "trpg-start"); await lines(page); await roll(page);
    // A bookmark keeps the growth the table started with, so "continue" replays to the same numbers.
    assert.equal((await snapshot(page)).trpg.bookmark.growth, 1);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await check("purchase-cancel-and-regular-fill", async page => {
    await prepare(page); await open(page); await hit(page, "trpg-buy-ordinary-cup");
    await page.evaluate(() => {
      delete __remake.state.trpg.club.members.tsumugi;
      delete __remake.state.trpg.club.members.adam;
    });
    await hit(page, "trpg-campaign-close"); await open(page);
    const before = await snapshot(page);
    await hit(page, "trpg-play-ordinary-cup");
    assert.equal(await page.locator(".trpg-table-person").count(), 4);
    await lines(page); await hit(page, "trpg-start"); await lines(page); await roll(page);
    assert.equal(await page.locator('[data-test^="trpg-consult-"]').count(), 2);
    assert.equal(await button(page, "trpg-consult-regulara").count(), 1);
    assert.equal(await button(page, "trpg-consult-regularb").count(), 1);
    await hit(page, "trpg-exit"); await hit(page, "trpg-exit-confirm"); await button(page, "trpg-play-ordinary-cup").waitFor();
    // Leaving keeps a bookmark (TMX13) and nothing else: no night, money or clear is spent.
    const left = await snapshot(page);
    assert.equal(left.trpg.bookmark?.id, "ordinary-cup"); delete left.trpg.bookmark;
    // Saving the bookmark refreshes only the save's own clock.
    for (const key of ["savedAt", "playMs"]) { delete left[key]; delete before[key]; }
    assert.deepEqual(left, before);
    await play(page, "ordinary-cup"); assert((await snapshot(page)).trpg.cleared["ordinary-cup"]);
  });
  await check("bookmark-resume-and-replay", async page => {
    await prepare(page); await page.evaluate(() => { __remake.state.flags._trpg_tutorial_seen = true; }); await open(page); await hit(page, "trpg-buy-ordinary-cup");
    await hit(page, "trpg-play-ordinary-cup");
    await lines(page); await hit(page, "trpg-start"); await lines(page); await roll(page); await interviewStep(page);
    await hit(page, "trpg-spot-menu"); await lines(page);
    const table = await page.evaluate(() => structuredClone(__remake.state.trpg.bookmark));
    assert.equal(table.phase, "explore"); assert(table.actions.some(([key, id]) => key === "inspect" && id === "menu"));
    await hit(page, "trpg-exit"); await hit(page, "trpg-exit-confirm");
    const left = await snapshot(page);
    assert.equal(left.slot, 1, "a bookmark does not spend the night"); assert.deepEqual(left.trpg.cleared, {});
    assert.match(await button(page, "trpg-bookmark-ordinary-cup").textContent(), /しおり/);
    // Continue: the same room with the same clue already found, then finish the story as usual.
    await hit(page, "trpg-resume-ordinary-cup");
    await button(page, "trpg-spot-window").waitFor();
    assert(await button(page, "trpg-spot-menu").evaluate(n => n.classList.contains("checked")), "the bookmarked clue is still found");
    for (const spot of ["window", "bag"]) { await hit(page, "trpg-spot-" + spot); await lines(page); }
    await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-quiet"); await lines(page);
    await twistStep(page);
    for (const [field, value] of [["aroma", "tea"], ["seat", "window"]]) await hit(page, "trpg-plan-" + field + "-" + value);
    await hit(page, "trpg-prepare-open"); await roll(page);
    await hit(page, "trpg-plan-approach-quiet"); await hit(page, "trpg-serve-open"); await roll(page);
    await button(page, "trpg-ending-title").waitFor();
    const done = await snapshot(page);
    assert.equal(done.slot, 2); assert(done.trpg.cleared["ordinary-cup"]); assert.equal(done.trpg.bookmark, undefined);
    assert.equal(done.trpg.cleared["ordinary-cup"].plays, 1);
    await hit(page, "trpg-finish"); await hit(page, "trpg-reflect-hard"); await hit(page, "trpg-campaign-close");
    // TMX14: a finished book shows the endings seen and can be played again on another night.
    await page.evaluate(() => { Object.assign(__remake.state, { day: 4, slot: 1 }); });
    await open(page);
    assert.match(await button(page, "trpg-memory-endings").textContent(), /見た結末 1 \/ 4/);
    assert.equal(await button(page, "trpg-play-ordinary-cup").textContent(), "もう一度遊ぶ");
    assert(await button(page, "trpg-play-ordinary-cup").isEnabled());
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
    await advanceSaiIntro(page);
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
    await advanceSaiIntro(page);
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

