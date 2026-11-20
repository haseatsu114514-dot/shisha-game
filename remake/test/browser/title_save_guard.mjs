// #4026 現在DAY7・AUTOはDAY5。各ケースは独立したブラウザーコンテキストで実行する。
import assert from "node:assert/strict";
import { baseURL, suite } from "./support.mjs";

const fixture = new URL("test/browser/fixtures/title_save.html", baseURL);
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function openTitle(page) {
  await button(page, "MENU").click();
  await button(page, "タイトルへ戻る").click();
}

async function assertStillPlaying(page) {
  await page.locator("#menu[data-ready]").waitFor();
  assert.deepEqual(await page.evaluate(() => ({
    navigation: performance.getEntriesByType("navigation")[0].type,
    samePlayer: qa.player === qa.core.state,
    day: qa.core.state.day, saved: qa.core.peekSave().day,
    active: qa.owner.active, aborted: qa.owner.controller.signal.aborted,
    left: sessionStorage.getItem("left"),
  })), { navigation: "navigate", samePlayer: true, day: 7, saved: 5, active: true, aborted: false, left: null });
}

async function assertLeft(page, day, attempts) {
  await page.waitForFunction(() => performance.getEntriesByType("navigation")[0].type === "reload" && window.qa);
  assert.deepEqual(await page.evaluate(() =>
    [qa.core.state.day, qa.core.peekSave().day, Number(sessionStorage.getItem("attempts")), sessionStorage.getItem("left")]),
  [day, day, attempts, "yes"]);
}

await suite("title-save-guard", async check => {
  for (const menu of ["daily", "chapter"]) {
    const options = { pageEntry: fixture.href + "?" + menu };
    await check(menu + "-stay-and-retry", async page => {
      await openTitle(page);
      await assertStillPlaying(page);
      await button(page, "残る").click();
      await page.evaluate(() => qa.done);
      await assertStillPlaying(page);

      await openTitle(page);
      await button(page, "残る").waitFor();
      await page.keyboard.press("Escape");
      await page.evaluate(() => qa.done);
      await assertStillPlaying(page);

      await openTitle(page);
      await button(page, "再試行").click();
      await assertStillPlaying(page);
      await page.evaluate(() => { qa.fail = false; });
      await button(page, "再試行").click();
      await assertLeft(page, 7, 5);
    }, options);

    await check(menu + "-discard", async page => {
      await openTitle(page);
      await button(page, "保存せず離れる").click();
      await assertLeft(page, 5, 1);
    }, options);

    await check(menu + "-success", async page => {
      await page.evaluate(() => { qa.fail = false; });
      await openTitle(page);
      await assertLeft(page, 7, 1);
    }, options);

    await check(menu + "-session-changed", async page => {
      await openTitle(page);
      await button(page, "再試行").waitFor();
      await page.evaluate(() => { qa.core.newGame(); qa.fail = false; });
      await button(page, "再試行").click();
      await page.evaluate(() => qa.done);
      assert.deepEqual(await page.evaluate(() =>
        [qa.core.peekSave().day, sessionStorage.getItem("attempts"), sessionStorage.getItem("left")]), [5, "1", null]);
    }, options);
  }
  await check("daily-save-unavailable", async page => {
    await page.evaluate(() => { qa.canSave = false; });
    await openTitle(page);
    await assertLeft(page, 5, 0);
  });
  await check("daily-retry-after-save-became-unavailable", async page => {
    await openTitle(page);
    await button(page, "再試行").waitFor();
    await page.evaluate(() => { qa.canSave = false; qa.fail = false; });
    await button(page, "再試行").click();
    await page.evaluate(() => qa.done);
    await assertStillPlaying(page);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("attempts")), "1");
  });
}, { entry: fixture.href, readySelector: "#menu[data-ready]", readLoadingComics: false,
  acknowledgeGrowth: false, readShopGreeting: false });
