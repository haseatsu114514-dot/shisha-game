// 実際のGAME OVER入口。素材待ちで20秒を減らさず、BGMを準備してから画面を始める。
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";

await suite("continue-readiness", async check => {
  await check("bundled-bgm", async page => {
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    const decoded = await page.evaluate(async () => {
      const { bgmUrl } = await import("./js/core/data.js");
      const url = new URL(bgmUrl("bgm_continue_urgent"), location.href);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`BGM HTTP ${response.status}`);
      const context = new AudioContext();
      try {
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return { url: url.href, origin: url.origin, duration: buffer.duration };
      } finally { await context.close(); }
    });
    assert.equal(decoded.origin, new URL(page.url()).origin);
    assert(decoded.url.endsWith("/assets/audio/bgm/bgm_continue_urgent.mp3"));
    assert(decoded.duration > 106 && decoded.duration < 107, "Complete EMGコール must decode");
    assert.equal(requests.some(url => new URL(url).hostname === "bgmer.net"), false);
  });
  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      // 同梱曲のデコード失敗でも専用合成BGMで始め、期限や入力を固めない。
      await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.fulfill({ status: 200, contentType: "audio/mpeg", body: "invalid-audio" }));
      await page.route("**/ui/continue/neon_title.webp", async route => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        await route.continue();
      });
      await page.mouse.click(4, 4);
      await page.evaluate(() => { window.opening = __remake.dev.gameOver("rank", 0); });
      await page.waitForTimeout(180);
      assert.equal(await page.locator(".gameover").count(), 0, "Countdown appeared while its art was still loading");
      await page.locator(".gameover").waitFor();
      assert.equal(await page.locator(".go-count").textContent(), "20");
      assert.equal(await page.locator(".gameover img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
      assert.equal(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm()), "bgm_continue_urgent");
      await page.waitForTimeout(1100);
      assert.equal(await page.locator(".go-count").textContent(), "19");
      await page.locator('[data-test="retry"]').click();
      assert.equal(await page.locator(".gameover").getAttribute("data-phase"), "reaction");
    }, { viewport });
  }

  await check("warm-premium", async page => {
    await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.fulfill({ status: 200, contentType: "audio/mpeg", body: "invalid-audio" }));
    await page.evaluate(async () => {
      // 新しい本編モジュールで既定250件を超える。先読みを欠落した計測で判定しない。
      performance.setResourceTimingBufferSize(2000);
      const state = await import("./js/core/state.js"); state.newGame(); state.state.lovers = ["ageha"];
      const screen = await import("./js/chapters/gameover.js");
      window.preparedContinue = await screen.warmGameOver();
    });
    assert(await page.evaluate(() => preparedContinue.slice(1).every(Boolean)), "Continue images must actually decode before the timer starts");
    const before = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /chr_ageha_/.test(entry.name)).length);
    assert.ok(before >= 3, "Premium expressions were not prepared during the tournament");
    await page.evaluate(() => { window.opening = __remake.dev.gameOver("rank", "premium:ageha"); });
    await page.locator(".gameover").waitFor();
    assert.equal(await page.locator(".gameover").getAttribute("data-speaker"), "ageha");
    assert.equal(await page.locator(".go-count").textContent(), "20");
    await page.locator('[data-test="retry"]').click();
    await page.waitForTimeout(520);
    const after = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /chr_ageha_/.test(entry.name)).length);
    assert.equal(after, before, "Changing the prepared reaction face fetched another portrait");
  });
});
