// 全体配置、タイトルの整理、イベントと実スロットのレベル進化通知。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1331, height: 760 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), stats = await import("./js/core/stats.js");
    const ui = await import("./js/core/ui.js"), title = await import("./js/scenes/title.js");
    const reel = await import("./js/daily/reel.js"), steam = await import("./js/craft/steam.js");
    window.T = { core, stats, ui, title, reel, steam };
    core.newGame(); core.save(); title.showTitle();
  });
  for (const size of [{ width: 1331, height: 760 }, { width: 844, height: 390 }, { width: 591, height: 1280 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(1800);
    assert.equal(await page.locator(".title-item").count(), 5);
    assert.equal(await page.locator('[data-test="title-glossary"], .title-save').count(), 0);
    assert(await page.locator('[data-test="title-continue"]').isEnabled());
    const layout = await page.evaluate(() => {
      const logo = document.querySelector(".title-logo"), menu = document.querySelector(".title-menu");
      const a = logo.getBoundingClientRect(), b = menu.getBoundingClientRect(), s = document.querySelector("#stage").getBoundingClientRect();
      return { loaded: logo.complete && logo.naturalWidth > 0, gap: b.top - a.bottom, bottom: s.bottom - b.bottom };
    });
    assert(layout.loaded && layout.gap > 0 && layout.bottom > 0, JSON.stringify(layout));
    if (size.width === 1331) {
      const smoke = page.locator(".title-logo-smoke i").first();
      const before = await smoke.evaluate(e => getComputedStyle(e).transform);
      await page.waitForTimeout(450);
      assert.notEqual(await smoke.evaluate(e => getComputedStyle(e).transform), before, "タイトルの煙が動いていない");
    }
    if (shots) await page.screenshot({ path: `${shots}/title-${size.width}.png` });
    await page.locator('[data-test="title-new"]').click();
    await page.waitForTimeout(350);
    const offset = await page.evaluate(() => {
      const box = document.querySelector(".modal-box").getBoundingClientRect();
      const buttons = [...document.querySelectorAll(".modal-actions > button")].map(e => e.getBoundingClientRect());
      return Math.abs((buttons[0].left + buttons.at(-1).right) / 2 - (box.left + box.right) / 2);
    });
    assert(offset < 1, `確認ボタンが中央から${offset}pxずれる`);
    if (shots) await page.screenshot({ path: `${shots}/confirm-${size.width}.png` });
    await page.getByRole("button", { name: "やめる", exact: true }).click();
  }
  await page.setViewportSize({ width: 1331, height: 760 });
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    T.core.config.textSpeed = 4;
    vn.play({ dialogue_id: "__ui_polish", metadata: { bg: "bg_tonari_inside_day" },
      lines: [{ speaker: "", text: "名前も知らない、たまに来る綺麗なお姉さん。\nそれだけの認識だった。" },
        { type: "choice", choices: [{ text: "この反応。やっぱ俺、才能あるかも" }, { text: "スミさんに報告したら褒めてくれるかな" }] }] });
  });
  await page.waitForSelector("#vn.active .vn-text");
  await page.waitForTimeout(1800);
  await page.keyboard.press("Enter");
  await page.waitForSelector(".vn-choices.show .vn-choice");
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".vn-choices").evaluate(e => getComputedStyle(e).bottom), "306px");
  if (shots) await page.screenshot({ path: `${shots}/choices.png` });
  await page.locator(".vn-choice").first().click();
  await page.evaluate(() => {
    T.core.newGame(); T.core.state.phase = "daily";
    T.ui.showScreen("map", document.createElement("div"));
    T.core.state.stats.technique = 20;
    T.stats.gainStat("technique", 3);
  });
  await page.waitForSelector(".gc-evolution");
  assert.equal(await page.locator(".gc-evolution").textContent(), "レベル2に進化！");
  assert.match(await page.locator(".gc-fx").textContent(), /ゲージ.*ゆっくり/);
  if (shots) await page.screenshot({ path: `${shots}/level-event.png` });
  await page.evaluate(() => T.ui.bannersIdle());
  // 内部値0→1は表示レベル1のまま。偽のレベルアップを出さない。
  await page.evaluate(() => { T.core.state.stats.insight = 0; T.stats.gainStat("insight", 1); });
  await page.waitForSelector(".gain-card.st-insight");
  assert.equal(await page.locator(".gc-evolution, .gc-fx").count(), 0);
  await page.evaluate(() => T.ui.bannersIdle());
  // 実際に効く根性レベル4の恩恵とボム回数を一致させる。
  await page.evaluate(() => {
    T.core.state.chapter = 5; T.core.state.stats.guts = 60; T.stats.gainStat("guts", 4);
  });
  await page.waitForSelector(".gain-card.st-guts .gc-evolution");
  assert.equal(await page.locator(".gc-evolution").textContent(), "レベル4に進化！");
  assert.match(await page.locator(".gc-fx").textContent(), /深呼吸が2回/);
  assert.equal(await page.evaluate(() => T.steam.bombStock()), 2);
  await page.evaluate(() => T.ui.bannersIdle());
  const reward = await page.evaluate(() => {
    T.core.state.phase = "tournament"; T.reel.onAction();
    T.core.newGame(); T.core.state.phase = "daily";
    for (const key of T.core.STAT_KEYS) T.core.state.stats[key] = 20;
    Object.assign(T.core.state.reel, { introDone: true, lastChapter: 1 });
    for (let seed = 1; seed < 10000; seed++) {
      const sample = T.reel.core.spinSeries({ ...T.core.state.reel, seed }, { chapterFirst: false });
      if (sample.length === 1 && sample[0].exp >= 2 && !T.reel.core.PEKA.includes(sample[0].role)) {
        T.core.state.reel.seed = seed; break;
      }
    }
    T.reel.onAction(); const r = T.core.state.reel.pending[0];
    window.presenting = T.reel.presentNow();
    return { starTo: r.starTo, stats: { ...T.core.state.stats } };
  });
  assert.equal(reward.starTo, 2);
  await page.waitForSelector(".gain-card .gc-evolution", { timeout: 15000 });
  assert.equal(await page.locator(".gc-evolution").textContent(), "レベル2に進化！");
  assert.equal(await page.locator(".gc-top").textContent(), "PAKKI SLOT");
  assert((await page.locator(".gc-fx").textContent()).length > 0);
  if (shots) await page.screenshot({ path: `${shots}/level-slot.png` });
  await page.evaluate(() => window.presenting);
  assert.deepEqual(await page.evaluate(() => ({ ...T.core.state.stats })), reward.stats);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => T.title.showTitle());
  assert.equal(await page.locator(".title-logo-smoke i").first().evaluate(e => getComputedStyle(e).animationName), "none");
  assert.deepEqual(errors, []);
  console.log("[UI polish] PASS: title/continue, three viewport sizes, centered dialogs, choices, event and real slot evolution, bomb benefit, no false level-up, reduced motion");
} finally { await browser.close(); }
