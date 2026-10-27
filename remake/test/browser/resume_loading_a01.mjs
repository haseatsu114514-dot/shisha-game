// #1081 A01 / A-1: SAVEからの再開で次章モジュールの取得が失敗しても、画面が無反応・
// 例外停止にならず「もう一度試す／タイトルへ戻る」で操作でき、再試行で復帰することを確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("resume-loading-a01", async check => {
  await check("resume-chapter-two-import-failure-recovers", async page => {
    // ch2.js の取得を最初だけ失敗させる（通信断・デプロイ直後のキャッシュ不整合の模擬）。
    // abort は "aborted"（ERR_ABORTED）で返す。support.mjs はこれを失敗リソースに数えない。
    let blockCh2 = true;
    let ch2Requests = 0;
    await page.route("**/js/chapters/ch2.js", route => {
      ch2Requests++;
      if (blockCh2) route.abort("aborted"); else route.continue();
    });

    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const ch1 = await import("./js/chapters/ch1.js");
      core.newGame();
      core.state.chapter = 2;
      core.state.phase = "daily";
      core.save();
      window.R = { ch1, core, resolved: false, threw: null };
      // resumeGame 自体が例外で止まらないことを確かめる（失敗時は画面を出して待つ）。
      R.run = () => { R.promise = ch1.resumeGame().then(() => { R.resolved = true; }, error => { R.threw = String(error); }); };
    });
    await page.evaluate(() => R.run());

    // 取得失敗でも無反応にならず、復帰画面が出てフォーカスが載る。
    const retry = page.locator('[data-test="resume-retry"]');
    await retry.waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "resume-retry",
      "復帰ボタンにフォーカスが戻っていない");
    assert.equal(await page.locator('[data-test="resume-title"]').count(), 1, "タイトルへ戻る導線がない");
    assert.equal(await page.evaluate(() => R.threw), null, "resumeGame が例外で停止した");
    assert.equal(await page.evaluate(() => R.resolved), false, "まだ再開は完了していないはず");
    assert.equal(ch2Requests, 1, "最初の再開で ch2.js を1回だけ取得した");

    // 取得を通してから「もう一度試す」を押すと、第2章へ復帰する。
    blockCh2 = false;
    await retry.click();
    await page.waitForFunction(() => document.body.classList.contains("ch2-city"), null, { timeout: 15000 });
    assert.equal(await page.locator('[data-test="resume-retry"]').count(), 0, "復帰後も失敗画面が残っている");
    assert(ch2Requests >= 2, "再試行で ch2.js を取得し直していない");
  });
});
