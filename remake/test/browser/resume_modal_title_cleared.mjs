// #3514: LOAD直後、会話より先にモーダルが出る再開でも、タイトル画面がモーダルの背後に残らない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("resume-modal-title-cleared", async (check) => {
  await check("LOAD直後の最初のモーダルの背後にタイトルが無い", async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const ch1 = await import("./js/chapters/ch1.js");
      core.newGame();
      Object.assign(core.state, { phase: "daily", day: 2, slot: 0 });
      core.state.flags._ch1_opening = { introDone: true, oneesanDone: true };
      core.save();
      core.load();
      window.__resume = ch1.resumeGame().catch((error) => { window.__resumeError = error.stack; });
    });
    // 日常へ入る前のモーダル（今日の注文・パッキー初回・受け取り）は、地図を描く前に出ることがある。
    // 再開の入口で同期的に片付けるので、呼んだ直後からタイトルは無い。
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => ({
      screen: document.body.dataset.screen,
      title: !!document.querySelector("#screen [data-test='title-new']"),
      modal: !!document.querySelector(".modal-backdrop"),
      map: !!document.querySelector("#screen .map"),
      error: window.__resumeError || null,
    }));
    assert.equal(seen.error, null);
    assert.equal(seen.title, false, JSON.stringify(seen));
    assert.notEqual(seen.screen, "title", JSON.stringify(seen));
  });
});
