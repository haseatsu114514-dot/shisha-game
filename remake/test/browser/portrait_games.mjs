// 縦画面の試作: ミニゲームの縦用ページ（remake/previews/portrait-stage/frame/）。
// 本編のゲームを layout: "portrait" で動かした時に、絵・HUD・押す所が縦の画面に収まり、タッチで動くこと。既定（横）には印が付かないこと。
import assert from "node:assert/strict";
import { baseURL, suite } from "./support.mjs";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHORT = { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true };
const frame = name => `${baseURL}previews/portrait-stage/frame/${name}`;
/** 見えていて、画面の内側にあり、押す所は実寸 44px 以上。 */
async function boxesInside(page, selectors, { tap = 0 } = {}) {
  const view = page.viewportSize();
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox();
    assert(box, `${selector} is laid out`);
    assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, `${selector} stays inside the portrait screen: ${JSON.stringify(box)}`);
    if (tap) assert(box.width >= tap && box.height >= tap, `${selector} is at least ${tap}px: ${JSON.stringify(box)}`);
  }
}
/** 指で押し続ける（本物のタッチ。離すまでの間に probe を読む）。 */
async function hold(page, selector, ms, probe) {
  const box = await page.locator(selector).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  await page.waitForTimeout(ms);
  const value = await page.evaluate(probe);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return value;
}

await suite("portrait-games", async check => {
  for (const [suffix, options] of [["phone", PHONE], ["short", SHORT]]) {
    await check(`desert-ride-portrait-layout-${suffix}`, async page => {
      const root = page.locator('[data-test="desert-ride"]');
      assert.equal(await root.getAttribute("data-layout"), "portrait");
      assert.equal(await page.evaluate(() => document.documentElement.dataset.rotateGuard ?? null), null, "no rotate guard in the portrait frame");
      await boxesInside(page, ['[data-test="desert-start"]', '[data-test="desert-practice"]', '[data-test="desert-leave"]', '[data-test="desert-help"]', '[data-test="desert-tier"]'], { tap: 44 });
      await page.evaluate(() => window.__desertRide.start("run", "noor"));
      await page.waitForFunction(() => window.__desertRide.mode === "run" && window.__desertRide.game, null, { timeout: 30000 });
      await page.evaluate(() => window.__desertRide.skipCountdown());
      // 絵は横長のまま、左右を切って置く（画面より広い）。押す所は絵の下の板に並ぶ
      const view = page.viewportSize(), canvas = await page.locator(".dr-canvas").boundingBox();
      assert(canvas.width > view.width * 1.5 && canvas.x < 0, `the 16:9 picture is cropped at both sides: ${JSON.stringify(canvas)}`);
      assert(Math.abs(canvas.x + canvas.width / 2 - view.width / 2) < 2, "the picture is centered");
      await boxesInside(page, ['[data-test="desert-left"]', '[data-test="desert-right"]', '[data-test="desert-jump"]', '[data-test="desert-boost"]', '[data-test="desert-quit"]'], { tap: 44 });
      await boxesInside(page, [".dr-progress", ".dr-clock", ".dr-score", '[data-test="desert-speedo"]', '[data-test="desert-gauge"]']);
      const left = await page.locator('[data-test="desert-left"]').boundingBox(), jump = await page.locator('[data-test="desert-jump"]').boundingBox();
      assert(left.y + left.height / 2 > canvas.y + canvas.height - 1, "steer buttons sit on the deck below the picture");
      assert(left.x + left.width <= jump.x, "steer on the left thumb, jump on the right thumb");
      for (const hidden of [".dr-hud-left > small", ".dr-clock > small", ".dr-speedo-read > small", '[data-test="desert-course"]']) {
        assert.equal(await page.locator(hidden).first().isVisible(), false, `${hidden} is not shown in portrait`);
      }
      // 指で左を押し続けると左へ、ジャンプで宙へ
      const x0 = await page.evaluate(() => window.__desertRide.game.x);
      const x1 = await hold(page, '[data-test="desert-left"]', 500, () => window.__desertRide.game.x);
      assert(x1 < x0 - 0.05, `holding left steers left: ${x0} -> ${x1}`);
      const air = await hold(page, '[data-test="desert-jump"]', 150, () => window.__desertRide.game.air);
      assert(air > 0, "tapping jump lifts off");
      // 結果: 6つの記録だけ出し、ボタンが画面に収まる
      await page.evaluate(() => { const r = window.__desertRide; r.autoplay("expert"); r.setSpeedUp(16); });
      await page.locator('[data-test="desert-result"]').waitFor({ timeout: 60000 });
      await page.evaluate(() => window.__desertRide?.setSpeedUp(1));
      await boxesInside(page, ['[data-test="desert-retry"]', '[data-test="desert-choose-tier"]', '[data-test="desert-result"] [data-test="desert-leave"]'], { tap: 44 });
      await boxesInside(page, ['[data-test="desert-rank"]', '[data-test="desert-total"]', '[data-test="desert-time"]', '[data-test="desert-tricks"]', '[data-test="desert-boosts"]']);
      assert.equal(await page.locator('[data-test="desert-result"] .dr-row:visible').count(), 6, "six stat cells in portrait");
    }, { ...options, pageEntry: frame("desert.html?course=ridge"), pageReadySelector: '[data-test="desert-start"]' });

    await check(`camel-race-portrait-layout-${suffix}`, async page => {
      assert.equal(await page.locator('[data-test="camel-game"]').getAttribute("data-layout"), "portrait");
      await boxesInside(page, ['[data-test="camel-cup"][data-cup="practice"]', '[data-test="camel-cup"][data-cup="rookie"]', '[data-test="camel-cup"][data-cup="standard"]', '[data-test="camel-cup"][data-cup="expert"]'], { tap: 44 });
      await page.locator('[data-test="camel-cup"][data-cup="practice"]').tap();
      await page.waitForFunction(() => window.__camelRace?.fx.phase === "race", null, { timeout: 30000 });
      await boxesInside(page, ['[data-test="camel-voice"]', '[data-test="camel-signal"]', '[data-test="camel-pause"]', '[data-test="camel-close"]'], { tap: 44 });
      await boxesInside(page, [".camel-progress", ".camel-clock", ".camel-standings li[data-pos='1']", ".camel-standings li[data-pos='2']", ".camel-standings li[data-pos='3']", ".camel-standings li[data-pos='4']"]);
      // コースは左右を切って置く。順位は2列×2段、声は左・ムチは右で、どちらもコースの下
      const view = page.viewportSize(), canvas = await page.locator(".camel-canvas").boundingBox();
      assert(canvas.width > view.width * 1.3 && canvas.x < 0 && canvas.x + canvas.width > view.width, `the course is cropped at both sides: ${JSON.stringify(canvas)}`);
      const [first, second, third] = await Promise.all([1, 2, 3].map(pos => page.locator(`.camel-standings li[data-pos='${pos}']`).boundingBox()));
      assert(Math.abs(first.y - second.y) < 2 && second.x > first.x + first.width - 2 && third.y > first.y + first.height - 2, "standings form a 2x2 grid");
      const voice = await page.locator('[data-test="camel-voice"]').boundingBox(), whip = await page.locator('[data-test="camel-signal"]').boundingBox();
      assert(voice.x + voice.width <= whip.x && voice.y >= canvas.y + canvas.height - 1 && whip.y >= canvas.y + canvas.height - 1, "voice (left) and whip (right) sit below the course");
      for (const hidden of [".camel-title", ".camel-clock-sub", ".camel-speed-read small", ".camel-signal-note", ".camel-rhythm small"]) {
        assert.equal(await page.locator(hidden).first().isVisible(), false, `${hidden} is not shown in portrait`);
      }
      // ムチは押している間だけ。一時停止の札はボタンが収まる
      assert.equal(await hold(page, '[data-test="camel-signal"]', 400, () => window.__camelRace.fx.whipHeld), true, "holding the whip button whips");
      assert.equal(await page.evaluate(() => window.__camelRace.fx.whipHeld), false, "releasing stops the whip");
      await page.locator('[data-test="camel-pause"]').tap();
      await page.locator('[data-test="camel-paused"]').waitFor();
      await boxesInside(page, ['[data-test="camel-resume"]', '[data-test="camel-restart"]', '[data-test="camel-pause-quit"]'], { tap: 44 });
    }, { ...options, pageEntry: frame("camel.html?skip=1"), pageReadySelector: '[data-test="camel-cups"]' });
  }

  await check("prototype-hosts-the-game-frames", async page => {
    for (const [scene, ready] of [["desert", '[data-test="desert-start"]'], ["camel", '[data-test="camel-tutorial"]']]) {
      await page.goto(`${baseURL}previews/portrait-stage/index.html?view=play&scene=${scene}&bare`, { waitUntil: "load" });
      const host = page.locator(".phone .gm-frame");
      await host.waitFor();
      await page.frameLocator(".phone .gm-frame").locator(ready).waitFor({ timeout: 30000 });
      const phone = await page.locator(".phone").boundingBox(), box = await host.boundingBox();
      assert(Math.abs(box.width - phone.width) < 2 && Math.abs(box.height - phone.height) < 2, `${scene} fills the phone`);
    }
  }, { ...PHONE, pageEntry: `${baseURL}previews/portrait-stage/index.html?view=play&scene=desert&bare`, pageReadySelector: ".phone .gm-frame" });

  await check("landscape-default-has-no-portrait-mark", async page => {
    await page.locator('[data-test="desert-page-start"]').click();
    assert.equal(await page.locator('[data-test="desert-ride"]').getAttribute("data-layout"), null);
  }, { pageEntry: `${baseURL}desert-ride.html`, pageReadySelector: '[data-test="desert-page-start"]' });
}, { readShopGreeting: false }); // 店の挨拶を読む部品は本編のページ用（縦試作の枠のページには本編の会話が無い）
