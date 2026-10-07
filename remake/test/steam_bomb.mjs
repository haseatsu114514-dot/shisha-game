// 蒸らし（雑念弾幕）の深呼吸＝ボム: 画面の雑念を一度に消す・ストックは1・根性★4/★5で増える。
// サーバーを8123で起動後: node remake/test/steam_bomb.mjs   （SHOTS=<フォルダ> で画面を保存）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');

  // 1) ストック数: 基本1、根性★4で2、★5で3（第1章の上限48＝★3では1のまま）
  const stocks = await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), steam = await import("./js/craft/steam.js");
    core.newGame();
    return [10, 48, 61, 81].map((v) => { core.state.stats.guts = v; return steam.bombStock(); });
  });
  assert.deepEqual(stocks, [1, 1, 2, 3], `ストック数が想定と違う ${stocks}`);

  // 2) 自主練の蒸らしで、カウントダウン中は押せない → 始まったら押せる → Xで雑念が全部消える → 2回目は効かない
  await page.evaluate(() => { window.__drill = window.__remake.dev.drill("steam"); });
  const btn = page.locator('[data-test="dodge-bomb"]');
  await btn.waitFor();
  assert(await btn.isDisabled(), "カウントダウン中に深呼吸が押せる");
  assert.match(await btn.textContent(), /深呼吸 ●$/);
  await page.waitForFunction(() => !document.querySelector('[data-test="dodge-bomb"]').disabled, null, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll(".dodge-word:not(.blown)").length >= 2, null, { timeout: 8000 });
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/steam_bomb_before.png` });
  // 押した時刻と、そのあと最初に雑念が湧いた時刻をページ内で記録する（スクショの時間に左右されない）
  await page.evaluate(() => {
    const T = window.__bombT = { at: 0, next: 0 };
    window.addEventListener("keydown", () => { T.at ||= performance.now(); }, { capture: true, once: true });
    new MutationObserver((list) => {
      if (T.at && !T.next && list.some((m) => [...m.addedNodes].some((n) => n.classList?.contains("dodge-word")))) T.next = performance.now();
    }).observe(document.querySelector('[data-test="dodge"]'), { childList: true });
  });
  await page.keyboard.press("x");
  assert.equal(await page.locator(".dodge-word:not(.blown)").count(), 0, "深呼吸で雑念が消えない");
  assert.equal(await page.locator(".dodge-wave").count(), 1, "息の輪が出ない");
  assert(await btn.isDisabled(), "ストック0なのに押せる");
  assert.match(await btn.textContent(), /深呼吸 ○$/);
  await page.waitForTimeout(150);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/steam_bomb_after.png` });
  // 吹き払った直後は少しのあいだ（約1秒）湧かない
  await page.waitForFunction(() => window.__bombT.next, null, { timeout: 6000 });
  const calm = await page.evaluate(() => window.__bombT.next - window.__bombT.at);
  assert(calm >= 850, `深呼吸の直後に雑念が湧いた（${Math.round(calm)}ms）`);
  await page.keyboard.press("x");
  assert(await page.locator(".dodge-word:not(.blown)").count() >= 1, "ストック0の2回目でも雑念が消えた");

  // 3) 結果カードに使った回数が出る
  const card = page.locator(".result-card .rc-lines");
  await card.waitFor({ timeout: 15000 });
  assert.match(await card.textContent(), /深呼吸で1回、雑念を吹き払った/);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/steam_bomb_result.png` });
  await page.locator('[data-test="step-next"]').click();
  await page.evaluate(() => window.__drill);
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log("steam_bomb: OK");
} finally {
  await browser.close();
}
