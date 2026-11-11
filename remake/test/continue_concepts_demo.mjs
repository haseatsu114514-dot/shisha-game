// ゲームオーバー画面の見た目の案（見比べデモ・#2524）。4案が本編のCONTINUEを着せ替えて最後まで動き、
// PCとスマホ横持ちで2択・台詞・「進む」が実寸44px以上で画面内に収まり、本編の保存に触れないことを確かめる。
// サーバーを8123で起動後: node remake/test/continue_concepts_demo.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = (process.env.BASE_URL || "http://127.0.0.1:8123/remake/").replace(/\/?$/, "/");
const CONCEPTS = ["ember", "versus", "manga", "sign"];
const VIEWPORTS = [{ width: 1280, height: 720 }, { width: 844, height: 390 }];
const errors = [];

async function open(viewport, query) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", error => errors.push(`${query}: ${error.message}`));
  await page.addInitScript(() => {
    window.__writes = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.__writes++; return set.apply(this, args); };
  });
  await page.goto(`${base}continue-concepts-demo.html?tools=0&${query}`);
  await page.waitForFunction(() => window.__continueConceptsDemo?.ready());
  await page.clock.install();
  await page.evaluate(() => { window.__continueConceptsDemo.show(); });
  await page.clock.runFor(1200);
  return page;
}
// 画面内の実寸（CSS px）。見えない要素は null。
const box = (page, selector) => page.evaluate(sel => {
  const node = document.querySelector(sel);
  if (!node || !node.checkVisibility({ visibilityProperty: true })) return null;
  const r = node.getBoundingClientRect(), s = document.querySelector(".gameover").getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { w: r.width, h: r.height, left: r.left - s.left, top: r.top - s.top, right: s.right - r.right, bottom: s.bottom - r.bottom };
}, selector);
function assertTouch(rect, label) {
  assert.ok(rect, `${label}: 見えている`);
  assert.ok(rect.w >= 44 && rect.h >= 44, `${label}: 実寸44px以上（${rect.w.toFixed(1)}×${rect.h.toFixed(1)}）`);
  for (const side of ["left", "top", "right", "bottom"]) assert.ok(rect[side] >= -0.5, `${label}: 画面内（${side} ${rect[side].toFixed(1)}）`);
}

try {
  // 現行はそのまま（着せ替えない）
  {
    const page = await open(VIEWPORTS[0], "concept=current&loss=2");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#concept option")].map(o => o.value)),
      ["current", ...CONCEPTS], "現行＋4案を選べる");
    assert.equal(await page.getAttribute(".gameover", "data-layout"), "neon", "現行は本編の配置のまま");
    assert.equal(await page.locator(".gc-back, .gc-fore, .gc-name").count(), 0, "現行に案の部品を足さない");
    await page.close();
  }

  for (const concept of CONCEPTS) for (const viewport of VIEWPORTS) {
    const tag = `${concept} ${viewport.width}x${viewport.height}`;
    const page = await open(viewport, `concept=${concept}&loss=2`);
    assert.equal(await page.getAttribute(".gameover", "data-concept"), concept, `${tag}: 案が当たる`);
    assert.equal(await page.getAttribute(".gameover", "data-layout"), "concept", `${tag}: 現行の配置を外す`);
    const retry = await box(page, '[data-test="retry"]'), quit = await box(page, '[data-test="game-over-title"]');
    assertTouch(retry, `${tag} 再挑戦`); assertTouch(quit, `${tag} 諦める`);
    assertTouch(await box(page, ".go-dialogue"), `${tag} 台詞`);
    const apart = retry.left + retry.w <= quit.left + 0.5 || retry.top + retry.h <= quit.top + 0.5;
    assert.ok(apart, `${tag}: 2択が重ならない`);
    const count = await box(page, ".go-count");
    assert.ok(count && count.left >= 0 && count.right >= 0 && count.top >= 0, `${tag}: 残り秒数が画面内`);
    assert.match(await page.textContent(".go-count"), /^\d+$/, `${tag}: 残り秒数は本編の時計`);

    // 再挑戦 → 反応と「進む」 → 本編と同じ onRetry
    await page.click('[data-test="retry"]');
    assert.equal(await page.getAttribute(".gameover", "data-choice"), "retry", `${tag}: 選択が本編の処理に届く`);
    await page.clock.runFor(300); // 選んだ枠を180ms残してから「進む」に替わる
    assertTouch(await box(page, ".go-proceed"), `${tag} 進む`);
    await page.clock.runFor(6000); // 反応の台詞を読み終えると本編の処理が自動で抜ける
    assert.match(await page.textContent("#demo-note"), /再挑戦/, `${tag}: 再挑戦の流れが最後まで進む`);
    assert.equal(await page.evaluate(() => window.__writes), 0, `${tag}: 保存に書き込まない`);
    await page.close();
  }

  // 時間切れ（2敗目）: 4案とも GAME OVER まで進み、2択が消える
  for (const concept of CONCEPTS) {
    const page = await open(VIEWPORTS[0], `concept=${concept}&loss=2`);
    await page.clock.runFor(21000);
    assert.equal(await page.getAttribute(".gameover", "data-timed-out"), "true", `${concept}: 20秒で時間切れ`);
    assert.equal(await box(page, '[data-test="retry"]'), null, `${concept}: 時間切れ後は2択を出さない`);
    const over = await page.evaluate(() => [".go-title-art", ".go-title-label"].some(sel => {
      const node = document.querySelector(sel); if (!node) return false;
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      return style.display !== "none" && r.width > 200 && r.height > 40;
    }));
    assert.ok(over, `${concept}: GAME OVER が大きく見える`);
    await page.close();
  }
  assert.deepEqual(errors, [], "ページエラーなし");
  console.log("continue_concepts_demo: ok（4案 × PC/スマホ横、再挑戦と時間切れ）");
} finally {
  await browser.close();
}
