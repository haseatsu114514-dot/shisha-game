import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
import { travelToCity as travel } from "./station_helpers.mjs";
const shots = process.env.COMPARISON_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const t = id => `[data-test="${id}"]`;
const map = '[data-destination-selection]:not(.done)';
async function hit(page, id) {
  const button = page.locator(t(id));
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await button.tap(); else await button.click();
}
async function setup(page, { chapter = 1, day = chapter === 1 ? 5 : 16, slot = chapter === 1 ? 1 : 0, money = 12000, club = false, clubIds = ["hiyori"], run = true } = {}) {
  page.setDefaultTimeout(20000);
  await page.evaluate(async ({ chapter, day, slot, money, club, clubIds, run }) => {
    const core = await import("./js/core/state.js"), s = core.newGame();
    s.flags._rei_trpg_introduced = true; s.flags._axe_bar_legacy_access = true; // #577: 既存店舗の精算・取消回帰は互換保存として維持
    Object.assign(s.flags, { _axe_bar_sighting_done: true, _axe_bar_sighting_day: day - 1, _axe_bar_sighting_chapter: chapter }); // 目撃後の既存店舗回帰
    Object.assign(s, { chapter, day, slot, money, phase: "daily", stamina: 80 });
    Object.assign(s.flags, { ["_morning_" + s.day]: true, _errand_scout_done: true, _delivery_adam_done: true,
      _delivery_minto_done: true, _lime_tut: true, _lime_opened: true,
      _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
      _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true } });
    // DAY5までに読んだ必須会話。LOAD時の旧保存救済とは切り分けて店の消費を比べる。
    s.met.tsumugi = true; s.affinity.tsumugi = 21; s.contacts.push("tsumugi");
    if (club) {
      for (const id of clubIds) { s.met[id] = true; s.affinity[id] = 100; }
      s.trpg.club = { founded: { chapter: 2, day: 15 }, members: Object.fromEntries(clubIds.map(id => [id, { chapter: 2, day: 15 }])) };
    }
    core.config.bgmVolume = 0; core.config.textSpeed = 4;
    __remake.vnTest.turbo = true;
    (await import("./js/chapters/ch1.js")).setupHooks(); core.save();
    window.spotCore = core;
    if (!run) return;
    if (chapter === 2) {
      await (await import("./js/chapters/ch2-city-data.js")).loadPreparationDialogues();
      void (await import("./js/chapters/ch2-preparation.js")).runChapterTwoPreparation();
    } else void (await import("./js/daily/calendar.js")).runDaily({ nightEvents: {}, onQuit() {} });
  }, { chapter, day, slot, money, club, clubIds, run });
  if (run) await page.locator(map).waitFor();
}
async function value(page) {
  return page.evaluate(() => {
    const s = spotCore.state;
    return structuredClone({ money: s.money, stamina: s.stamina, day: s.day, slot: s.slot, stats: s.stats, affinity: s.affinity,
      story: s.story, met: s.met, reel: s.reel, records: s.flags._axe_bar_records || null,
      axeVisited: s.visitedDay.axe_bar || null, trpg: s.trpg,
      hiyoriFlags: Object.fromEntries(Object.entries(s.flags).filter(([key]) => key.includes("hiyori"))),
      lovers: s.lovers, relationshipMemories: s.relationshipMemories });
  });
}
async function go(page, id) {
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]')); // #796: 新ピンの解錠演出中は選択を受け付けない
  await hit(page, "pin-" + id); await hit(page, "map-go");
  await page.locator(t(id === "axe_bar" ? "axe-bar-practice" : "trpg-campaign-notice")).waitFor();
}
async function phase(page, phase) { await page.waitForFunction(p => document.querySelector('[data-test="axe-game"]')?.dataset.phase === p, phase); }
async function finishAxe(page, count, confirm = true, aimed = false) {
  for (let i = 0; i < count; i++) for (const p of ["choice", "horizontal", "vertical", "power", "result"]) {
    await phase(page, p);
    if (aimed && ["horizontal", "vertical", "power"].includes(p)) {
      // 既存axe_throw.mjsと同じ、画面に描かれている針を読んで止める操作。
      await page.waitForFunction(target => {
        const root = document.querySelector('[data-test="axe-game"]'), n = Number(root.dataset.timing);
        return !root.querySelector('[data-test="axe-action"]').disabled && n >= target - .02 && n <= target + .005;
      }, p === "power" ? .62 : .5);
    }
    await hit(page, "axe-action");
  }
  await phase(page, "summary");
  assert(!await page.locator(t("axe-retry")).isVisible());
  if (confirm) {
    await page.evaluate(() => { window.oldAxeFinish = document.querySelector('[data-test="axe-action"]'); });
    await hit(page, "axe-action");
  }
}
async function lines(page) { for (let i = 0; i < 35 && await page.locator(t("trpg-next")).isVisible(); i++) await hit(page, "trpg-next"); }
async function roll(page) { await hit(page, "trpg-roll"); await page.locator(t("trpg-settle")).waitFor(); await hit(page, "trpg-settle"); await lines(page); }
async function manualSave(page) {
  await hit(page, "hud-menu"); await hit(page, "menu-save"); await hit(page, "slot-1");
  await page.waitForFunction(() => localStorage.getItem("suien_remake_slot1") !== null);
}

await suite("play-spots", async runCheck => {
  const check = (name, ...args) => !process.env.CASE_FILTER || name.includes(process.env.CASE_FILTER) ? runCheck(name, ...args) : Promise.resolve();
  for (const [label, mode, count, options, aimed] of [
    ["pc", "league", 10, {}], ["touch", "practice", 3, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["pc-practice", "practice", 3, {}, true], ["touch-league", "league", 10, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(label + "-map-solo-record-save", async page => {
    await setup(page); const before = await value(page);
    assert.equal(await page.locator(t("pin-trpg_bar")).count(), 0);
    // ピンの装飾はボタン枠から出るため、文字そのものの収まりを検査する。
    await assertFits(page, ".spot-pin .sub-label");
    await go(page, "axe_bar"); await assertFits(page, ".axe-bar-menu button");
    await page.locator('[data-test="venue-host-maki"] img').evaluate(img => img.decode());
    await capture(page, label + "-axe-entry");
    assert.deepEqual(await value(page), before);
    await hit(page, "axe-bar-" + mode); await phase(page, "choice");
    assert.equal(await page.locator(".axe-companion").count(), 0, "Solo must not reveal an unmet character");
    await assertFits(page, ".axe-game button:visible");
    await finishAxe(page, count, false, aimed);
    await capture(page, label + "-axe-result");
    await page.evaluate(() => { window.oldAxeFinish = document.querySelector('[data-test="axe-action"]'); });
    await hit(page, "axe-action"); await page.locator(map).waitFor();
    const after = await value(page);
    assert.equal(after.money, before.money - 3000); assert.equal(after.stamina, before.stamina - 10 + 14, "Night play is followed by one sleep recovery");
    assert.equal(after.day, 6); assert.equal(after.slot, 0); assert.equal(after.axeVisited, 5); assert.equal(after.stats.guts, before.stats.guts + 2, "#784: the axe bar grows guts by 2P like other facilities");
    assert.equal(after.records[mode].plays, 1); assert.equal(after.records[mode].last.throws.length, count);
    assert.equal(after.records[mode].last.total, after.records[mode].last.throws.reduce((sum, shot) => sum + shot.score, 0));
    assert.deepEqual(after.records[mode].best, after.records[mode].last);
    if (aimed) assert(after.records[mode].best.total > 0, "Real aimed throws must produce a nonzero best");
    await capture(page, label + "-axe-return");
    assert.deepEqual(after.affinity, before.affinity); assert.deepEqual(after.met, before.met); assert.deepEqual(after.story, before.story);
    for (const key of ["hiyoriFlags", "lovers", "relationshipMemories"]) assert.deepEqual(after[key], before[key]);
    await page.evaluate(() => { oldAxeFinish.click(); oldAxeFinish.click(); });
    assert.deepEqual(await value(page), after, "A stale finish button must not charge or record twice");
    await hit(page, "pin-axe_bar"); assert.equal(await page.locator(t("map-go")).count(), 0, "The bar is closed next morning");
    // 次の営業中の記録閲覧は無料。別日に再プレイできることも確認する。
    await page.evaluate(() => { spotCore.state.slot = 1; });
    const nextNight = await value(page);
    await go(page, "axe_bar"); assert(!await page.locator(t("axe-bar-" + mode)).isDisabled());
    assert((await page.locator(".axe-bar-records").textContent()).includes("各投"));
    await hit(page, "axe-bar-back"); await page.locator(map).waitFor(); assert.deepEqual(await value(page), nextNight);
    await manualSave(page);
    await page.reload(); await hit(page, "title-load"); await hit(page, "slot-1"); await page.locator(map).waitFor();
    await page.evaluate(async () => { window.spotCore = await import("./js/core/state.js"); });
    assert.deepEqual(await value(page), nextNight);
    await go(page, "axe_bar"); await assertFits(page, ".axe-bar-menu button");
  }, options);

  await check("cancel-poor-and-zero-stamina", async page => {
    await setup(page); const before = await value(page);
    await go(page, "axe_bar"); await hit(page, "axe-bar-back"); await page.locator(map).waitFor();
    assert.deepEqual(await value(page), before);
    await go(page, "axe_bar"); await hit(page, "axe-bar-practice"); await phase(page, "choice");
    await hit(page, "axe-action"); await hit(page, "axe-cancel"); await page.locator(map).waitFor();
    assert.deepEqual(await value(page), before);
    await page.evaluate(() => { spotCore.state.money = 2999; });
    await go(page, "axe_bar"); assert(await page.locator(t("axe-bar-practice")).isDisabled());
    await hit(page, "axe-bar-back"); await page.locator(map).waitFor();
    await page.evaluate(() => { spotCore.state.money = 12000; spotCore.state.stamina = 0; });
    await go(page, "axe_bar"); assert(await page.locator(t("axe-bar-league")).isDisabled());
    await hit(page, "axe-bar-back"); await page.locator(map).waitFor();
    await page.evaluate(() => { spotCore.state.stamina = 80; spotCore.state.visitedDay.axe_bar = spotCore.state.day; });
    await go(page, "axe_bar"); assert(await page.locator(t("axe-bar-practice")).isDisabled());
  });

  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(label + "-axe-summary-cancel-is-uncommitted", async page => {
      await setup(page); const before = await value(page);
      await go(page, "axe_bar"); await hit(page, "axe-bar-practice");
      await finishAxe(page, 3, false);
      assert.deepEqual(await value(page), before, "Scored throws are not a committed venue result before confirmation");
      await hit(page, "axe-cancel"); await page.locator(map).waitFor();
      assert.deepEqual(await value(page), before);
    }, options);
  }

  await check("axe-real-navigation-keeps-unfinished-save", async page => {
    // pagehide後もcalendarは取消を自動保存する。日時だけ固定し、保存全文の比較を保つ。
    await page.clock.setFixedTime(new Date("2026-10-14T10:00:00Z"));
    await setup(page);
    const before = await page.evaluate(() => localStorage.getItem("suien_remake_save"));
    await go(page, "axe_bar");
    const introduced = JSON.parse(before); introduced.flags._intro_maki = true;
    assert.equal(await page.evaluate(() => spotCore.state.flags._intro_maki), true, "Completed introduction is read in the live state");
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), before, "The introduction itself does not settle the venue action");
    await hit(page, "axe-bar-practice");
    await phase(page, "choice"); await hit(page, "axe-action"); await phase(page, "horizontal");
    await page.reload(); await page.locator(t("title-new")).waitFor();
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem("suien_remake_save"))), introduced,
      "Cancellation saves only the completed introduction, without committing the unfinished throws");
  });

  for (const where of ["menu", "game", "load", "pagehide", "screen"]) await check("axe-abort-" + where, async page => {
    await setup(page, { run: false });
    if (where === "load") await page.evaluate(() => {
      localStorage.setItem("suien_remake_slot2", JSON.stringify({ ...spotCore.state, money: 7654 }));
    });
    await page.evaluate(async () => { window.axeResult = null; (await import("./js/daily/axe-bar.js")).visitAxeBar().then(v => { window.axeResult = v; }); });
    await page.locator(t("axe-bar-practice")).waitFor();
    assert.equal(await page.evaluate(async () => (await import("./js/daily/axe-bar.js")).visitAxeBar()), false);
    if (where !== "menu") { await hit(page, "axe-bar-practice"); await phase(page, "choice"); }
    await page.evaluate(async where => {
      window.oldOwner = spotCore.state;
      if (where === "pagehide") window.dispatchEvent(new Event("pagehide"));
      else if (where === "screen") (await import("./js/core/ui.js")).showScreen("test", document.createElement("div"));
      else if (where === "load") spotCore.loadFromSlot("suien_remake_slot2");
      else spotCore.newGame();
    }, where);
    await page.waitForFunction(() => window.axeResult === false);
    assert.equal(await page.locator(t("axe-game")).count(), 0);
    assert(await page.evaluate(() => oldOwner.money === 12000 && oldOwner.stamina === 80 && !oldOwner.flags._axe_bar_records));
    if (where === "load") assert.equal((await value(page)).money, 7654);
  });

  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(label + "-ch2-city-club-and-return", async page => {
      await setup(page, { chapter: 2 });
      assert.equal(await page.locator(t("pin-trpg_bar")).count(), 0);
      await travel(page, "widehanga"); const before = await value(page);
      await page.locator(t("pin-trpg_bar")).waitFor();
      assert.equal(await page.locator(t("pin-axe_bar")).count(), 0);
      await assertFits(page, ".spot-pin");
      assert.deepEqual(await value(page), before);
      await go(page, "trpg_bar"); await page.locator(t("trpg-club-choice-time")).waitFor();
      assert.match(await page.locator(".trpg-campaign-meta").textContent(), /CH\.2 · DAY 2/);
      assert((await page.locator(".trpg-kicker").first().textContent()).includes("ボドゲカフェ"));
      await hit(page, "trpg-club-choice-time"); await hit(page, "trpg-campaign-close");
      await page.locator(t("pin-trpg_bar")).waitFor();
      const after = await value(page); assert(after.trpg.club.founded);
      for (const key of ["money", "stamina", "slot", "stats", "reel"]) assert.deepEqual(after[key], before[key]);
      await go(page, "trpg_bar"); assert.equal(await page.locator(t("trpg-club-proposal")).count(), 0);
      await hit(page, "trpg-campaign-close"); await page.locator(t("pin-trpg_bar")).waitFor();
    }, options);
  }

  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) await check((label === "pc" ? "" : "touch-") + "ch2-table-purchase-completion-and-save", async page => {
    await setup(page, { chapter: 2, slot: 1, club: true });
    await travel(page, "widehanga"); const before = await value(page);
    await go(page, "trpg_bar");
    await capture(page, label + "-ordinary-entry");
    await hit(page, "trpg-buy-ordinary-cup");
    assert.equal((await value(page)).money, before.money - 500); assert.equal((await value(page)).slot, 1);
    assert(await page.locator(t("trpg-play-ordinary-cup")).isEnabled(), "DAY2 is a free night after #639, not an Ageha fixed night");
    // 購入済みオートセーブを実際に読み直し、二重購入・夜の消費なしで再入店できる。
    await page.reload(); await hit(page, "title-load"); await hit(page, "slot-0"); await page.locator(map).waitFor();
    await page.evaluate(async () => { window.spotCore = await import("./js/core/state.js"); __remake.vnTest.turbo = true; });
    const restored = await value(page);
    assert.equal(restored.money, before.money - 500); assert.equal(restored.day, 16); assert.equal(restored.slot, 1);
    assert.deepEqual(restored.trpg.owned, ["ordinary-cup"]);
    for (const key of ["stats", "stamina", "affinity", "story", "lovers", "relationshipMemories"]) assert.deepEqual(restored[key], before[key]);
    await travel(page, "widehanga"); await go(page, "trpg_bar");
    assert.equal(await page.locator(t("trpg-buy-ordinary-cup")).count(), 0);
    assert(await page.locator(t("trpg-play-ordinary-cup")).isEnabled());
    await hit(page, "trpg-play-ordinary-cup"); await hit(page, "trpg-start"); await lines(page); await roll(page);
    for (const id of ["menu", "window", "bag"]) { await hit(page, "trpg-spot-" + id); await lines(page); }
    await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-quiet"); await lines(page);
    await hit(page, "trpg-plan-aroma-tea"); await hit(page, "trpg-plan-seat-window");
    await hit(page, "trpg-prepare-open"); await roll(page);
    await hit(page, "trpg-plan-approach-quiet"); await hit(page, "trpg-serve-open"); await roll(page);
    await page.locator(t("trpg-ending-title")).waitFor();
    await capture(page, label + "-ordinary-result");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.slot, 2); assert.equal(saved.day, 16); assert(saved.trpg.cleared["ordinary-cup"]);
    assert.equal(saved.money, before.money - 500); assert.equal(saved.stamina, before.stamina); assert.deepEqual(saved.stats, before.stats);
    await hit(page, "trpg-finish"); await hit(page, "trpg-reflect-good");
    await hit(page, "trpg-campaign-close"); await hit(page, "ch2-morning-home"); await page.locator(map).waitFor();
    assert.equal(await page.locator(map).getAttribute("data-region"), "home");
    const after = await value(page); assert.equal(after.money, before.money - 500 - 200, "One return ticket after the night table"); assert.equal(after.day, 17); assert.equal(after.slot, 0, "Table must consume exactly one night");
    assert(after.trpg.cleared["ordinary-cup"]);
    await manualSave(page);
    await page.reload(); await hit(page, "title-load"); await hit(page, "slot-1"); await page.locator(map).waitFor();
    await page.evaluate(async () => { window.spotCore = await import("./js/core/state.js"); __remake.vnTest.turbo = true; });
    assert.deepEqual(await value(page), after, "Completed table and one-night cost survive SAVE/LOAD");
    await capture(page, label + "-ordinary-return");
  }, options);

  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(label + "-ch2-day8-shark-from-town-and-load", async page => {
      // 本編の日程と地図を使う。入部済み保存から再開し、夜予定の判定を迂回しない。
      await setup(page, { chapter: 2, day: 22, slot: 1, club: true, clubIds: ["hiyori", "samechan"] });
      // 卓は営業後に集まる。旧保存互換の空き枠が登録されても、参加を塞ぐ予定はない。
      assert((await value(page)).trpg.shifts.every(s => s.id !== "samechan" || !s.busy));
      await travel(page, "widehanga"); const before = await value(page);
      await page.locator(t("pin-trpg_bar")).waitFor();
      await capture(page, label + "-cafe-map"); await go(page, "trpg_bar");
      await page.locator('[data-test="venue-host-sai"] img').evaluate(img => img.decode());
      assert.match(await page.locator(".trpg-campaign-meta").textContent(), /CH\.2 · DAY 8/);
      assert.equal(await page.locator(t("trpg-person-samechan")).getAttribute("data-available"), "true");
      await capture(page, label + "-cafe-entry");
      await page.evaluate(() => { window.oldBookBuy = document.querySelector('[data-test="trpg-buy-shark-last-order"]'); });
      await hit(page, "trpg-buy-shark-last-order");
      await page.evaluate(() => { oldBookBuy.click(); oldBookBuy.click(); });
      const bought = await value(page);
      assert.equal(bought.money, before.money - 800); assert.equal(bought.slot, 1); assert.equal(bought.stamina, before.stamina);
      assert.deepEqual(bought.trpg.owned, ["shark-last-order"]);
      await hit(page, "trpg-play-shark-last-order"); await hit(page, "trpg-start"); await lines(page); await roll(page);
      assert.deepEqual(await value(page), bought, "An unfinished table must not commit its ending or night action");
      for (const id of ["radio", "leaves", "fan"]) { await hit(page, "trpg-spot-" + id); await lines(page); }
      await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-scent"); await lines(page);
      await hit(page, "trpg-plan-tool-citrus"); await hit(page, "trpg-plan-route-pier");
      await hit(page, "trpg-prepare-open"); await roll(page);
      await hit(page, "trpg-plan-finale-lure"); await hit(page, "trpg-serve-open"); await roll(page);
      await page.locator(t("trpg-ending-title")).waitFor(); await capture(page, label + "-cafe-result");
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
      assert.equal(saved.day, 22); assert.equal(saved.slot, 2); assert.equal(saved.money, before.money - 800);
      assert.equal(saved.trpg.cleared["shark-last-order"].gm, "samechan");
      assert.deepEqual([...saved.trpg.cleared["shark-last-order"].participants].sort(), ["hajime", "hiyori", "samechan"]);
      assert.equal(saved.stamina, before.stamina); assert.deepEqual(saved.stats, before.stats);
      for (const key of ["met", "affinity", "story", "lovers", "relationshipMemories"]) assert.deepEqual(saved[key], before[key]);
      await hit(page, "trpg-finish"); await hit(page, "trpg-reflect-good");
      await hit(page, "trpg-campaign-close"); await hit(page, "ch2-morning-home"); await page.locator(map).waitFor();
      assert.equal(await page.locator(map).getAttribute("data-region"), "home");
      const after = await value(page); assert.equal(after.day, 23); assert.equal(after.slot, 0);
      assert.equal(after.money, before.money - 800 - 200); assert.equal(after.stamina, before.stamina + 14);
      assert.deepEqual(after.trpg.cleared["shark-last-order"], saved.trpg.cleared["shark-last-order"]);
      await capture(page, label + "-cafe-return");
      await manualSave(page);
      await page.reload(); await hit(page, "title-load"); await hit(page, "slot-1"); await page.locator(map).waitFor();
      await page.evaluate(async () => { window.spotCore = await import("./js/core/state.js"); });
      assert.deepEqual(await value(page), after);
      await travel(page, "widehanga");
      const revisit = await value(page); assert.deepEqual(revisit, { ...after, money: after.money - 200 }, "Revisit charges only one outbound ticket");
      await go(page, "trpg_bar");
      assert.equal(await page.locator(t("trpg-play-shark-last-order")).count(), 0);
      assert((await page.locator(t("trpg-memory-shark-last-order")).textContent()).length > 0);
      await hit(page, "trpg-campaign-close"); await page.locator(map).waitFor();
      assert.deepEqual(await value(page), revisit);
    }, options);
  }

  await check("cafe-chapter-gate-and-load-cancel", async page => {
    await setup(page, { run: false });
    assert.equal(await page.evaluate(async () => (await (await import("./js/daily/trpg.js")).openTrpgBar()).completed), false);
    await page.evaluate(async () => {
      spotCore.state.chapter = 2;
      window.cafeResult = null;
      (await import("./js/daily/trpg.js")).openTrpgBar().then(result => { window.cafeResult = result; });
    });
    await page.locator(t("trpg-club-choice-time")).waitFor();
    await page.evaluate(() => { spotCore.newGame(); });
    await page.waitForFunction(() => window.cafeResult?.completed === false);
    assert.equal(await page.locator(t("trpg-club-choice-time")).count(), 0);
    assert.equal((await value(page)).trpg.club.founded, null);
  });
});
