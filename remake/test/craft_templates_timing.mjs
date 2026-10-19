// 配置図の選択・実ゲームへの接続・炭の即時/最終表示をPCとスマートフォンで確認。
// CHROME_EXECUTABLE_PATH=... node remake/test/craft_templates_timing.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const errors = [];
const capture = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};
async function open(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const session = await import("./js/craft/session.js");
    const holes = await import("./js/craft/holes.js");
    const heat = await import("./js/craft/heat.js");
    const common = await import("./js/craft/common.js");
    window.T = { core, session, holes, heat, common };
  });
  return { context, page };
}
async function insidePanel(page, selectors) {
  const escaped = await page.evaluate((selectors) => {
    const p = document.querySelector(".bench-panel").getBoundingClientRect();
    return selectors.filter((selector) => {
      const b = document.querySelector(selector).getBoundingClientRect();
      return b.left < p.left - 2 || b.right > p.right + 2 || b.top < p.top - 2 || b.bottom > p.bottom + 2;
    });
  }, selectors);
  assert.deepEqual(escaped, [], "Added UI escaped the existing work panel");
}
try {
  for (const [name, viewport, mobile] of [["desktop", { width: 1280, height: 720 }, false],
    ["mobile", { width: 844, height: 390 }, true], ["portrait", { width: 390, height: 844 }, false]]) {
    const { context, page } = await open(viewport, mobile);
    await page.evaluate(() => {
      window.cs = T.session.newSession("drill"); T.session.openBench(cs);
      window.holesRun = T.holes.runHoles(cs);
    });
    await page.waitForSelector('[data-test="hole-start"]');
    assert.equal(await page.locator(".countdown, .foil-cursor").count(), 0);
    assert.equal(await page.locator('.ht-option').count(), 1);
    assert.equal(await page.locator('[data-test="hole-template-counts"]').textContent(), "外周12・中周12・内周0");
    await capture(page, `templates-initial-${name}`);
    // A serialized old session retains its previously available layouts.
    await page.evaluate(() => {
      const saved = JSON.stringify({...cs, availableHoleTemplateIds:['outer24','outer12-middle12'], holeTemplateId:'outer24'});
      window.cs = JSON.parse(saved); window.holesRun = T.holes.runHoles(cs);
    });
    await page.locator('[data-test="hole-template-outer24"]').waitFor();
    assert.equal(await page.locator('[data-test="hole-preview"] [data-ring="outer"]').count(), 24);
    assert.equal(await page.locator('[data-test="hole-preview"] [data-ring="middle"]').count(), 0);
    assert.equal(await page.locator('[data-test="hole-template-counts"]').textContent(), "外周24・中周0・内周0");
    await insidePanel(page, [".ht-preview", ".ht-side"]); await capture(page, `templates-outer-${name}`);
    // ネイティブのボタン操作で配置を切り替え、Spaceでも開始できる。
    await page.locator('[data-test="hole-template-outer12-middle12"]').click();
    assert.equal(await page.locator('[data-test="hole-template-outer12-middle12"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-test="hole-preview"] [data-ring="outer"]').count(), 12);
    assert.equal(await page.locator('[data-test="hole-preview"] [data-ring="middle"]').count(), 12);
    assert.equal(await page.locator('[data-test="hole-preview"] [data-ring="inner"]').count(), 0);
    assert.equal(await page.locator('[data-test="hole-template-counts"]').textContent(), "外周12・中周12・内周0");
    await capture(page, `templates-mixed-${name}`);
    await page.locator(".ht-help summary").click();
    assert.match(await page.locator(".ht-help").textContent(), /安定.*ズレる/);
    await insidePanel(page, [".ht-preview", ".ht-side"]);
    await page.locator(".ht-help summary").click();
    await page.evaluate(() => { __remake.craftTest.auto = "good"; });
    await page.locator('[data-test="hole-start"]').focus(); await page.keyboard.press("Space");
    // 自動操作は結果カードも自動で閉じる。全体の完了を待ってから手動の炭焼きへ戻す。
    await page.evaluate(() => window.holesRun);
    await page.evaluate(() => { __remake.craftTest.auto = null; });
    const result = await page.evaluate(() => ({ template: cs.holes.templateId, outer: cs.holes.outer,
      middle: cs.holes.middle, inner: cs.holes.inner, score: cs.holes.score }));
    assert.deepEqual(result, { template: "outer12-middle12", outer: 12, middle: 12, inner: 0, score: 99 });

    // 取り出す入力だけ仮想時計で固定。炭の判定・演出・DOMは実装そのものを使う。
    await page.evaluate(() => {
      window.coalClock = 1000;
      Object.defineProperty(performance, "now", { configurable: true, value: () => window.coalClock });
      const nativeRaf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => nativeRaf(() => callback(window.coalClock));
      window.originalRandom = Math.random; Math.random = () => .5;
      // runHeatは素材の準備を待ってから炭ごとの時刻を抽選する。
      // 抽選が終わるまで固定し、非同期の準備中に元へ戻さない。
      window.heatRun = T.heat.runHeat(cs);
      window.coalIdeal = 5.8 + (.5 * T.common.skill.window(cs)) / 2;
    });
    await page.waitForFunction(() => document.querySelector('[data-test="coal-0"]')?.dataset.phase === "raw");
    await page.evaluate(() => { Math.random = window.originalRandom; });
    await page.evaluate(() => { window.coalClock = 1000 + (window.coalIdeal - .35) * 1000; });
    await page.locator('[data-test="coal-2"]').click();
    const heatFeedback = page.locator('[data-test="heat-feedback"]');
    assert.equal(await heatFeedback.locator(".stamp").count(), 1, "Each rating uses the feedback strip");
    assert.equal(await page.locator(".bench-panel > .stamp").count(), 0, "Ratings must not float over the stove");
    assert(await page.evaluate(() => {
      const carrier = document.querySelector(".heat-info").getBoundingClientRect();
      const feedback = document.querySelector(".heat-feedback").getBoundingClientRect();
      return feedback.left >= carrier.left && feedback.right <= carrier.right && feedback.bottom <= carrier.bottom;
    }), "The feedback must stay inside the separate carrier card");
    assert.match(await page.locator('[data-test="coal-timing-2"]').textContent(), /GOOD.*0\.35秒早い/);
    await page.evaluate(() => { window.coalClock = 1000 + (window.coalIdeal - .08) * 1000; });
    await page.locator('[data-test="coal-0"]').click();
    assert.equal(await heatFeedback.locator(".stamp").count(), 1, "Consecutive ratings must not stack");
    assert.match(await page.locator('[data-test="coal-timing-0"]').textContent(), /PERFECT.*0\.08秒早い/);
    const first = await page.locator('[data-test="coal-timing-0"]').textContent();
    await insidePanel(page, [".heat-info", ".heat-feedback"]); await capture(page, `coal-live-${name}`);
    await page.evaluate(() => { window.coalClock = 1000 + (window.coalIdeal + .35) * 1000; });
    await page.locator('[data-test="coal-1"]').click();
    await page.waitForSelector('[data-test="step-summary"]');
    const summary = await page.locator('[data-test="step-summary"]').textContent();
    assert.match(summary, /奥 PERFECT：0\.08秒早い/);
    assert.match(summary, /手前左 GOOD：0\.35秒遅い/);
    assert.match(summary, /手前右 GOOD：0\.35秒早い/);
    assert.match(summary, /全体のタイミング精度 80%.*平均誤差 0\.26秒/);
    assert.equal(await page.locator('[data-test="coal-timing-0"]').textContent(), first);
    assert.equal(await page.evaluate(() => cs.heat.timingAccuracy === cs.heat.score), true);
    // DOM出現直後は結果カードが下から入場中。実際の完了を待って最終配置を測る。
    await page.locator(".result-card.show").evaluate(async card => {
      await Promise.all(card.getAnimations().map(animation => animation.finished));
    });
    await insidePanel(page, ['[data-test="step-summary"]', ".result-card", '[data-test="step-next"]']);
    await page.waitForTimeout(200); await capture(page, `coal-results-${name}`);
    await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.heatRun);
    console.log(`[craft templates/timing] PASS: ${name} preview, keyboard start, selected game, live early/late grades, visible final timing summary and panel bounds`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
