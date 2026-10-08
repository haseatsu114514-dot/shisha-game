// 実際の成長量と通知、イベント/スロットの差、上限時の振替、HUDへ飛ぶ光を確認。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), stats = await import("./js/core/stats.js");
    const ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js");
    const reel = await import("./js/daily/reel.js"), { on } = await import("./js/core/bus.js");
    core.newGame(); core.state.phase = "daily";
    ui.showScreen("map", document.createElement("div"));
    hud.initHud({}); hud.showHud();
    window.T = { core, stats, ui, hud, reel, events: [], flights: [], impacts: 0 };
    on("stat-gain", e => T.events.push(e));
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.classList?.contains("stat-flight")) T.flights.push(node.dataset.stat);
        if (node.classList?.contains("hr-gain")) T.impacts++;
      }
    }).observe(document.querySelector("#stage"), { childList: true, subtree: true });
    T.stats.gainStat("technique", 2); T.stats.gainStat("technique", 1);
  });
  await page.waitForSelector(".gain-card.st-technique .gc-points");
  assert.equal(await page.locator(".gc-points").textContent(), "+3P");
  assert.equal(await page.locator(".gain-card").count(), 1);
  assert.equal(await page.locator(".gc-top").textContent(), "STATUS UP");
  assert.equal(await page.locator(".gc-sub").count(), 0);
  assert.equal(await page.locator(".gain-card.stat").evaluate(e => e.clientHeight), 68);
  await page.waitForFunction(() => T.impacts > 0);
  assert.deepEqual(await page.evaluate(() => ({ points: T.core.state.stats.technique, total: T.events[0].total,
    count: T.events.length, flown: [...new Set(T.flights)] })), { points: 13, total: 3, count: 1, flown: ["technique"] });
  await page.evaluate(() => T.ui.bannersIdle());

  // 上限の技術に経験値12を足しても、空いているセンスの実増加2だけを表示する。
  await page.evaluate(() => {
    for (const key of T.core.STAT_KEYS) T.core.state.stats[key] = 48;
    T.core.state.stats.sense = 46; T.core.state.statXp = {}; T.events = [];
    T.stats.gainStat("technique", 12);
  });
  await page.waitForSelector(".gain-card.st-sense .gc-points");
  assert.equal(await page.locator(".gc-main").textContent(), "センス");
  assert.equal(await page.locator(".gc-points").textContent(), "+2P");
  assert.deepEqual(await page.evaluate(() => [T.core.state.stats.sense, T.events[0].key, T.events[0].total]), [48, "sense", 2]);
  await page.evaluate(() => T.ui.bannersIdle());

  // 実スロットの抽選/コミット/演出を通す。上限適用後の実増加だけを表示し二重加算しない。
  const reward = await page.evaluate(() => {
    T.core.state.phase = "tournament"; T.reel.onAction({ spent: 10 }); // 前の行動の対象記録を区切る
    T.core.state.phase = "daily";
    for (const key of T.core.STAT_KEYS) T.core.state.stats[key] = 48;
    T.core.state.stats.technique = 47;
    T.core.state.statXp = {};
    T.core.state.reel = T.core.newState().reel;
    Object.assign(T.core.state.reel, { introDone: true, lastChapter: 1 });
    for (let seed = 1; seed < 10000; seed++) {
      const sample = T.reel.core.spinSeries({ ...T.core.state.reel, seed }, { chapterFirst: false });
      if (sample.length === 1 && sample[0].exp >= 2 && !sample[0].overlap && !T.reel.core.PEKA.includes(sample[0].role)) {
        T.core.state.reel.seed = seed; break;
      }
    }
    const before = { ...T.core.state.stats };
    T.reel.onAction({ spent: 10 });
    const q = T.core.state.reel.pending[0];
    const actual = T.core.state.stats[q.target] - before[q.target];
    window.presenting = T.reel.presentNow();
    return { key: q.target, xp: q.exp, got: q.got, actual, after: { ...T.core.state.stats } };
  });
  assert(reward.got > 0 && reward.got < reward.xp);
  assert.equal(reward.got, reward.actual);
  await page.waitForSelector(".gain-card .gc-points", { timeout: 15000 });
  assert.equal(await page.locator(".gc-points").textContent(), `+${reward.got}P`);
  assert.equal(await page.locator(".gc-top").textContent(), "PAKKI SLOT");
  await page.evaluate(() => window.presenting);
  assert.deepEqual(await page.evaluate(() => ({ ...T.core.state.stats })), reward.after);
  await page.evaluate(() => T.ui.bannersIdle());

  // 前のセーブの合算待ちは捨てる。縮小画面と動きを減らす設定でもポイントを読める。
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    T.stats.gainStat("technique", 3);
    T.core.newGame(); T.core.state.phase = "daily"; T.events = []; T.flights = [];
    T.stats.gainStat("insight", 3);
  });
  await page.waitForSelector(".gain-card.st-insight .gc-points");
  assert.equal(await page.locator(".gc-points").textContent(), "+3P");
  assert.deepEqual(await page.evaluate(() => T.events.map(e => e.key)), ["insight"]);
  await page.waitForTimeout(900);
  assert.deepEqual(await page.evaluate(() => T.flights), []);
  assert.deepEqual(errors, []);
  console.log("[stat rewards] PASS: actual/batched points, redirected cap, real slot reward, flight/impact, state change, small screen, reduced motion");
} finally { await browser.close(); }
