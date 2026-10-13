import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";
const t = id => `[data-test="${id}"]`;
const map = '[data-destination-selection]:not(.done)';
async function hit(page, id) {
  const button = page.locator(t(id));
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await button.tap(); else await button.click();
}
async function setup(page, { chapter = 1, slot = chapter === 1 ? 1 : 0, money = 12000, club = false, run = true } = {}) {
  page.setDefaultTimeout(20000);
  await page.evaluate(async ({ chapter, slot, money, club, run }) => {
    const core = await import("./js/core/state.js"), s = core.newGame();
    Object.assign(s, { chapter, day: chapter === 1 ? 5 : 16, slot, money, phase: "daily", stamina: 80 });
    Object.assign(s.flags, { ["_morning_" + s.day]: true, _errand_scout_done: true, _delivery_adam_done: true,
      _delivery_minto_done: true, _lime_tut: true, _lime_opened: true,
      _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
      _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true } });
    // DAY5までに読んだ必須会話。LOAD時の旧保存救済とは切り分けて店の消費を比べる。
    s.met.tsumugi = true; s.affinity.tsumugi = 21; s.contacts.push("tsumugi");
    if (club) {
      s.met.hiyori = true; s.affinity.hiyori = 100;
      s.trpg.club = { founded: { chapter: 2, day: 15 }, members: { hiyori: { chapter: 2, day: 15 } } };
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
  }, { chapter, slot, money, club, run });
  if (run) await page.locator(map).waitFor();
}
async function value(page) {
  return page.evaluate(() => {
    const s = spotCore.state;
    return structuredClone({ money: s.money, stamina: s.stamina, day: s.day, slot: s.slot, stats: s.stats, affinity: s.affinity,
      story: s.story, met: s.met, reel: s.reel, records: s.flags._axe_bar_records || null,
      axeVisited: s.visitedDay.axe_bar || null, trpg: s.trpg });
  });
}
async function go(page, id) {
  await hit(page, "pin-" + id); await hit(page, "map-go");
  await page.locator(t(id === "axe_bar" ? "axe-bar-practice" : "trpg-campaign-notice")).waitFor();
}
async function phase(page, phase) { await page.waitForFunction(p => document.querySelector('[data-test="axe-game"]')?.dataset.phase === p, phase); }
async function finishAxe(page, count) {
  for (let i = 0; i < count; i++) for (const p of ["choice", "horizontal", "vertical", "power", "result"]) {
    await phase(page, p); await hit(page, "axe-action");
  }
  await phase(page, "summary");
  assert(!await page.locator(t("axe-retry")).isVisible());
  await hit(page, "axe-action");
}
async function lines(page) { for (let i = 0; i < 35 && await page.locator(t("trpg-next")).isVisible(); i++) await hit(page, "trpg-next"); }
async function roll(page) { await hit(page, "trpg-roll"); await page.locator(t("trpg-settle")).waitFor(); await hit(page, "trpg-settle"); await lines(page); }

await suite("play-spots", async runCheck => {
  const check = (name, ...args) => !process.env.CASE_FILTER || name.includes(process.env.CASE_FILTER) ? runCheck(name, ...args) : Promise.resolve();
  for (const [label, mode, count, options] of [
    ["pc", "league", 10, {}], ["touch", "practice", 3, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(label + "-map-solo-record-save", async page => {
    await setup(page); const before = await value(page);
    assert.equal(await page.locator(t("pin-trpg_bar")).count(), 0);
    // ピンの装飾はボタン枠から出るため、文字そのものの収まりを検査する。
    await assertFits(page, ".spot-pin .sub-label");
    await go(page, "axe_bar"); await assertFits(page, ".axe-bar-menu button");
    assert.deepEqual(await value(page), before);
    await hit(page, "axe-bar-" + mode); await phase(page, "choice");
    assert.equal(await page.locator(".axe-companion").count(), 0, "Solo must not reveal an unmet character");
    await assertFits(page, ".axe-game button:visible");
    await finishAxe(page, count); await page.locator(map).waitFor();
    const after = await value(page);
    assert.equal(after.money, before.money - 3000); assert.equal(after.stamina, before.stamina - 10 + 14, "Night play is followed by one sleep recovery");
    assert.equal(after.day, 6); assert.equal(after.slot, 0); assert.equal(after.axeVisited, 5); assert.equal(after.stats.guts, before.stats.guts + 1);
    assert.equal(after.records[mode].plays, 1); assert.equal(after.records[mode].last.throws.length, count);
    assert.deepEqual(after.affinity, before.affinity); assert.deepEqual(after.met, before.met); assert.deepEqual(after.story, before.story);
    await hit(page, "pin-axe_bar"); assert.equal(await page.locator(t("map-go")).count(), 0, "The bar is closed next morning");
    // 次の営業中の記録閲覧は無料。別日に再プレイできることも確認する。
    await page.evaluate(() => { spotCore.state.slot = 1; });
    const nextNight = await value(page);
    await go(page, "axe_bar"); assert(!await page.locator(t("axe-bar-" + mode)).isDisabled());
    assert((await page.locator(".axe-bar-records").textContent()).includes("各投"));
    await hit(page, "axe-bar-back"); await page.locator(map).waitFor(); assert.deepEqual(await value(page), nextNight);
    await page.evaluate(() => spotCore.saveToSlot("suien_remake_slot1"));
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

  for (const where of ["menu", "game", "pagehide", "screen"]) await check("axe-abort-" + where, async page => {
    await setup(page, { run: false });
    await page.evaluate(async () => { window.axeResult = null; (await import("./js/daily/axe-bar.js")).visitAxeBar().then(v => { window.axeResult = v; }); });
    await page.locator(t("axe-bar-practice")).waitFor();
    assert.equal(await page.evaluate(async () => (await import("./js/daily/axe-bar.js")).visitAxeBar()), false);
    if (where !== "menu") { await hit(page, "axe-bar-practice"); await phase(page, "choice"); }
    await page.evaluate(async where => {
      window.oldOwner = spotCore.state;
      if (where === "pagehide") window.dispatchEvent(new Event("pagehide"));
      else if (where === "screen") (await import("./js/core/ui.js")).showScreen("test", document.createElement("div"));
      else spotCore.newGame();
    }, where);
    await page.waitForFunction(() => window.axeResult === false);
    assert.equal(await page.locator(t("axe-game")).count(), 0);
    assert(await page.evaluate(() => oldOwner.money === 12000 && oldOwner.stamina === 80 && !oldOwner.flags._axe_bar_records));
  });

  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(label + "-ch2-city-club-and-return", async page => {
      await setup(page, { chapter: 2 }); const before = await value(page);
      assert.equal(await page.locator(t("pin-trpg_bar")).count(), 0);
      await hit(page, "map-region-widehanga"); await page.locator(t("pin-trpg_bar")).waitFor();
      assert.equal(await page.locator(t("pin-axe_bar")).count(), 0);
      await assertFits(page, ".spot-pin, .map-regions button");
      assert.deepEqual(await value(page), before);
      await go(page, "trpg_bar"); await page.locator(t("trpg-club-found")).waitFor();
      assert.match(await page.locator(".trpg-campaign-meta").textContent(), /CH\.2 · DAY 2/);
      assert((await page.locator(".trpg-kicker").first().textContent()).includes("ボドゲカフェ"));
      await hit(page, "trpg-club-found"); await hit(page, "trpg-campaign-close");
      await page.locator(t("pin-trpg_bar")).waitFor();
      const after = await value(page); assert(after.trpg.club.founded);
      for (const key of ["money", "stamina", "slot", "stats", "reel"]) assert.deepEqual(after[key], before[key]);
      await go(page, "trpg_bar"); assert.equal(await page.locator(t("trpg-club-found")).count(), 0);
      await hit(page, "trpg-campaign-close"); await page.locator(t("pin-trpg_bar")).waitFor();
    }, options);
  }

  await check("ch2-table-purchase-completion-and-save", async page => {
    await setup(page, { chapter: 2, slot: 1, club: true }); const before = await value(page);
    await hit(page, "map-region-widehanga"); await go(page, "trpg_bar");
    await hit(page, "trpg-buy-ordinary-cup");
    assert.equal((await value(page)).money, before.money - 500); assert.equal((await value(page)).slot, 1);
    await hit(page, "trpg-play-ordinary-cup"); await hit(page, "trpg-start"); await lines(page); await roll(page);
    for (const id of ["menu", "window", "bag"]) { await hit(page, "trpg-spot-" + id); await lines(page); }
    await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-quiet"); await lines(page);
    await hit(page, "trpg-plan-aroma-tea"); await hit(page, "trpg-plan-seat-window");
    await hit(page, "trpg-prepare-open"); await roll(page);
    await hit(page, "trpg-plan-approach-quiet"); await hit(page, "trpg-serve-open"); await roll(page);
    await page.locator(t("trpg-ending-title")).waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(saved.slot, 2); assert.equal(saved.day, 16); assert(saved.trpg.cleared["ordinary-cup"]);
    assert.equal(saved.money, before.money - 500); assert.equal(saved.stamina, before.stamina); assert.deepEqual(saved.stats, before.stats);
    await hit(page, "trpg-finish"); await hit(page, "trpg-reflect-good");
    await hit(page, "trpg-campaign-close"); await page.locator(map).waitFor();
    const after = await value(page); assert.equal(after.day, 17); assert.equal(after.slot, 0, "Table must consume exactly one night");
    assert(after.trpg.cleared["ordinary-cup"]);
  });

  await check("cafe-chapter-gate-and-load-cancel", async page => {
    await setup(page, { run: false });
    assert.equal(await page.evaluate(async () => (await (await import("./js/daily/trpg.js")).openTrpgBar()).completed), false);
    await page.evaluate(async () => {
      spotCore.state.chapter = 2;
      window.cafeResult = null;
      (await import("./js/daily/trpg.js")).openTrpgBar().then(result => { window.cafeResult = result; });
    });
    await page.locator(t("trpg-club-found")).waitFor();
    await page.evaluate(() => { spotCore.newGame(); });
    await page.waitForFunction(() => window.cafeResult?.completed === false);
    assert.equal(await page.locator(t("trpg-club-found")).count(), 0);
    assert.equal((await value(page)).trpg.club.founded, null);
  });
});
