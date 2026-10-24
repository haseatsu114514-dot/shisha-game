// 実際のみんとの買い物イベント＋訪問報酬が、加算を保ったまま一枚になることを検証。
// プレビューサーバーを8123で起動してから: node remake/test/affinity_notifications.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    window.T = {
      core: await import("./js/core/state.js"),
      stats: await import("./js/core/stats.js"),
      bus: await import("./js/core/bus.js"),
      vn: await import("./js/vn/engine.js"),
      ui: await import("./js/core/ui.js"),
      events: [],
    };
    T.core.newGame();
    T.core.state.met.minto = true;
    T.core.state.met.naru = true;
    T.core.state.story.minto = 3; // notification arithmetic is tested after the preceding conversations
    T.core.state.story.naru = 1;
    T.bus.on("affinity-gain", (event) => T.events.push(event));
    T.vn.vnTest.turbo = true;
    T.vn.hooks.contextChar = "minto";
    // calendar.js の meetInvitation と同じ順番。イベントのmetadataで6pt、終了後に10pt。
    await T.vn.play("outing_minto_1");
    T.stats.gainAffinity("minto", 10);
  });
  await page.waitForTimeout(900);
  await page.waitForFunction(() => document.querySelector(".gain-card.affinity .gc-hearts i")?.style.getPropertyValue("--fill") === "100%");
  let result = await page.evaluate(() => ({
    events: T.events,
    pts: T.core.state.affinity.minto,
    carry: T.core.state.affinityCarry.minto,
    cards: document.querySelectorAll(".gain-card.affinity").length,
    hearts: [...document.querySelectorAll(".gain-card.affinity .gc-hearts i")].map((i) => i.style.getPropertyValue("--fill")),
  }));
  assert.equal(result.events.length, 1, "みんとの一回の外出で好感度通知が二枚出た");
  assert.equal(result.cards, 1);
  assert.equal(result.pts, 13, "既存の加算量を変えない（6×.85＋10×.85）");
  assert(Math.abs(result.carry - 0.6) < 1e-8);
  assert.deepEqual(result.events[0], { id: "minto", prevPts: 0, pts: 13, level: 1, levelUp: true });
  assert.deepEqual(result.hearts, ["100%", "36%", "0%", "0%", "0%"]);
  console.log("[affinity notifications] actual minto outing: one card, original points/carry, final hearts");

  await page.evaluate(() => T.ui.bannersIdle());
  await page.evaluate(() => {
    T.events.length = 0;
    T.stats.gainAffinity("minto", 1); // 段階アップ後の小さな加算も、最初のfromとUP表示を保つ
    T.stats.gainAffinity("minto", 10);
    T.stats.gainAffinity("minto", 1);
    T.stats.gainAffinity("naru", 10); // 別の相手の通知は消さない
  });
  await page.waitForTimeout(1000);
  result = await page.evaluate(() => ({ events: T.events, cards: document.querySelectorAll(".gain-card.affinity").length }));
  assert.equal(result.events.length, 2);
  assert.equal(result.cards, 2);
  const minto = result.events.find((e) => e.id === "minto");
  assert.equal(minto.prevPts, 13);
  assert.equal(minto.pts, 23);
  assert.equal(minto.levelUp, true);

  await page.evaluate(() => T.ui.bannersIdle());
  await page.evaluate(() => {
    T.events.length = 0;
    T.core.state.lovers = ["minto"];
    T.core.state.loveLevel.minto = 1;
    T.stats.bond.private = false;
    T.stats.gainAffinity("minto", 10); // 店では恋人の絆を深めない
    T.stats.bond.private = true;
    T.stats.gainAffinity("minto", 6);
    T.stats.gainAffinity("minto", 10);
    T.stats.bond.private = false;
  });
  await page.waitForTimeout(1000);
  result = await page.evaluate(() => ({ events: T.events, lovePts: T.core.state.lovePts.minto }));
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].bond, true);
  assert.equal(result.events[0].prevPts, 0);
  assert.equal(result.lovePts, 8);

  await page.evaluate(() => T.ui.bannersIdle());
  await page.evaluate(() => {
    T.events.length = 0;
    T.stats.gainAffinity("naru", 10);
    T.core.newGame(); // 別のセーブへ移る前の未表示通知を持ち越さない
    T.core.state.met.minto = true;
    T.stats.gainAffinity("minto", 10);
  });
  await page.waitForTimeout(1000);
  result = await page.evaluate(() => T.events);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "minto");
  assert.deepEqual(errors, []);
  console.log("[affinity notifications] PASS: multiple people, rank crossing, private lover bond, state changes");
} finally {
  await browser.close();
}
