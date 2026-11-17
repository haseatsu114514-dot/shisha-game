// #1081 A01 / A-1: SAVEからの再開で次章モジュールの取得が失敗しても、画面が無反応・
// 例外停止にならず「もう一度試す／タイトルへ戻る」で操作でき、再試行で復帰することを確かめる。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { suite } from "./support.mjs";

await suite("resume-loading-a01", async check => {
  await check("chapter-three-aftermath-recovers-after-versioned-js-is-removed", async page => {
    let published = "old";
    const requests = [];
    // Use real production modules under two version directories, just as the
    // deployment does. The next page load receives the newly published entry.
    await page.route(/\/remake\/(?:index\.html)?(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      const html = await response.text();
      assert(html.includes('import("./js/main.js")'));
      await route.fulfill({ response, body: html.replace('import("./js/main.js")', `import("./js-deploy-${published}/main.js")`) });
    });
    await page.route(/\/remake\/js-deploy-(old|new)\//, async route => {
      const [, version, relative] = new URL(route.request().url()).pathname.match(/\/js-deploy-(old|new)\/(.+)$/);
      requests.push({ version, relative, status: version === "old" && published === "new" ? 404 : 200 });
      if (version === "old" && published === "new") {
        await route.fulfill({ status: 404, contentType: "text/plain", body: "Previous deployment removed" });
      } else {
        const source = await fs.readFile(fileURLToPath(new URL(`../../js/${relative}`, import.meta.url)));
        await route.fulfill({ contentType: "text/javascript", body: source });
      }
    });
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor();
    await page.locator("#boot").waitFor({ state: "detached" });
    const before = await page.evaluate(async () => {
      const core = await import("./js-deploy-old/core/state.js");
      const progress = await import("./js-deploy-old/chapters/ch3-aftermath-progress.js");
      const aftermath = await import("./js-deploy-old/chapters/ch3-aftermath.js");
      const growth = await import("./js-deploy-old/core/growth.js");
      const s = core.newGame();
      Object.assign(s, { chapter: 3, day: 60, slot: 1, phase: "cleared", money: 23456 });
      Object.assign(s.flags, {
        _ch3_tournament_won: true,
        _ch3_tournament: { stage: "complete", result: { rank: 1, win: true } },
        _ch3_aftermath: { version: 4, winDay: 57, stage: progress.CH3_AFTERMATH_SCENES.length },
        _ch3_cleared: true,
      });
      // Credit the actual chapter-clear reward before taking the checkpoint.
      const reward = growth.awardChapterClearExp();
      core.save();
      const saved = localStorage.getItem(core.SAVE_KEY);
      await aftermath.runChapterThreeAftermath();
      return { saved, reward, timeOrigin: performance.timeOrigin };
    });
    assert(before.reward > 0, "Fixture must include a real, already granted clear reward");
    const next = page.locator('[data-test="ch3-aftermath-chapter-four"]');
    await next.waitFor();
    assert(!requests.some(r => r.version === "old" && r.relative === "chapters/ch4.js"), "Chapter four must remain lazy until the button is used");

    published = "new";
    await next.click();
    const retry = page.locator('[data-test="ch3-aftermath-retry"]');
    await retry.waitFor();
    assert.match(await page.locator('[data-test="ch3-aftermath-error"]').innerText(), /後日談を再開できませんでした/);
    assert.deepEqual(requests.filter(r => r.status === 404), [{ version: "old", relative: "chapters/ch4.js", status: 404 }]);
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), before.saved, "Failed import must preserve the saved checkpoint byte for byte");
    // A partially changed in-memory state must not overwrite the saved checkpoint
    // while the recovery button changes document/module identity.
    await page.evaluate(async () => { (await import("./js-deploy-old/core/state.js")).state.money = 1; });
    await Promise.all([page.waitForEvent("load"), retry.click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await next.waitFor();
    assert.notEqual(await page.evaluate(() => performance.timeOrigin), before.timeOrigin);
    assert.equal(await page.locator('[data-test="ch3-aftermath-error"]').count(), 0);
    const checkpoint = JSON.parse(before.saved);
    assert.deepEqual(await page.evaluate(async () => {
      const { state, consumeResumeOnBoot } = await import("./js-deploy-new/core/state.js");
      return { chapter: state.chapter, money: state.money, xp: state.growth.xp,
        cleared: state.growth.cleared, progress: state.flags._ch3_aftermath, resume: consumeResumeOnBoot() };
    }), { chapter: 3, money: checkpoint.money, xp: checkpoint.growth.xp, cleared: checkpoint.growth.cleared,
      progress: checkpoint.flags._ch3_aftermath, resume: false });
    await next.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save"))?.chapter === 4);
    const advanced = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
    assert.equal(advanced.day, checkpoint.day + 1, "Chapter transition advances the day once");
    assert.equal(advanced.money, checkpoint.money, "Tournament prize must not be paid again");
    assert.equal(advanced.growth.xp, checkpoint.growth.xp, "Clear XP must not be granted again");
    assert.deepEqual(advanced.growth.cleared, checkpoint.growth.cleared);
    assert.deepEqual(advanced.flags._ch3_aftermath, checkpoint.flags._ch3_aftermath, "Read progress must not replay");
    assert.equal(requests.filter(r => r.version === "new" && r.relative === "chapters/ch4.js" && r.status === 200).length, 1);
  }, { ignoreFailedResource: failure => /^404 .*\/js-deploy-old\/chapters\/ch4\.js$/.test(failure) });

  await check("resume-chapter-two-import-failure-recovers", async page => {
    // ch2.js の取得を失敗させる（通信断・デプロイ直後のキャッシュ不整合の模擬）。
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
      core.state.money = 23456;
      core.state.flags._resume_loading_a01 = true;
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

    const saved = await page.evaluate(() => localStorage.getItem(R.core.SAVE_KEY));

    // 通信断が続く場合も、再読込後に復帰画面とフォーカスが戻り、再び操作できる。
    await Promise.all([page.waitForEvent("load"), retry.click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await retry.waitFor();
    assert.equal(await retry.isEnabled(), true, "再失敗後に再試行できない");
    assert.equal(await page.locator('[data-test="resume-title"]').isEnabled(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "resume-retry");
    assert.equal(ch2Requests, 2, "再試行で ch2.js を取得し直していない");
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), saved,
      "再開失敗で保存済み進行を書き換えた");

    // 取得を通してから「もう一度試す」を押すと、タイトルを経由せず第2章へ復帰する。
    blockCh2 = false;
    await Promise.all([page.waitForEvent("load"), retry.click()]);
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.body.classList.contains("ch2-city"), null, { timeout: 15000 });
    assert.equal(await page.locator('[data-test="resume-retry"]').count(), 0, "復帰後も失敗画面が残っている");
    assert.equal(ch2Requests, 3, "再試行で ch2.js を1回だけ取得し直す");
    assert.deepEqual(await page.evaluate(async () => {
      const { state, consumeResumeOnBoot } = await import("./js/core/state.js");
      return [state.chapter, state.money, state.flags._resume_loading_a01, consumeResumeOnBoot()];
    }), [2, 23456, true, false], "保存済み進行の再開・起動時リクエストの消費に失敗した");
  });
});
