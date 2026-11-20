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
  await check("stale-tab-auto", async page => {
    await page.evaluate(() => {
      qa.fail = false;
      Object.assign(qa.player, { day: 5, money: 1000 });
      if (!qa.core.save()) throw new Error("初期AUTO保存に失敗");
    });
    await page.reload();
    await page.locator("#menu[data-ready]").waitFor();
    await page.evaluate(() => { qa.fail = false; });
    const newer = await page.context().newPage();
    await newer.goto(fixture.href);
    await newer.locator("#menu[data-ready]").waitFor();
    const latest = await newer.evaluate(() => {
      qa.fail = false;
      Object.assign(qa.player, { day: 6, money: 2500 });
      if (!qa.core.save()) throw new Error("新しいタブで保存に失敗");
      return localStorage.getItem(qa.core.SAVE_KEY);
    });
    const result = await page.evaluate(() => {
      const visible = qa.core.peekSave();
      const saved = qa.core.save();
      const persisted = qa.core.peekSave();
      return { visible: [visible.day, visible.money], saved, persisted: [persisted.day, persisted.money] };
    });
    assert.deepEqual(result, { visible: [6, 2500], saved: false, persisted: [6, 2500] });
    await button(page, "このタブに残る").click();
    assert.deepEqual(await page.evaluate(() => [qa.core.state.day, qa.core.state.money]), [5, 1000]);
    const manual = await page.evaluate(() => {
      const key = qa.core.SAVE_SLOTS[1].key;
      const saved = qa.core.saveToSlot(key);
      const slot = qa.core.readSlot(key);
      return [saved, slot.day, slot.money, localStorage.getItem(qa.core.SAVE_KEY)];
    });
    assert.deepEqual(manual, [true, 5, 1000, latest]);
    await openTitle(page);
    await button(page, "新しい進行を読む").click();
    await page.waitForFunction(() => performance.getEntriesByType("navigation")[0].type === "reload" && window.qa);
    assert.deepEqual(await page.evaluate(() => [qa.core.consumeResumeOnBoot(), qa.player.day, qa.player.money]),
      [true, 6, 2500]);
    assert.equal(await page.evaluate(() => localStorage.getItem(qa.core.SAVE_KEY)), latest);

    // もう一度競合した時にも、明示して選んだ手動LOADからはAUTOを続けられる。
    await newer.evaluate(() => { qa.player.day++; if (!qa.core.save()) throw new Error("DAY7の保存に失敗"); });
    assert.deepEqual(await page.evaluate(() => {
      qa.fail = false;
      const restored = qa.core.loadFromSlot(qa.core.SAVE_SLOTS[1].key);
      return [restored.day, restored.money, qa.core.save(), qa.core.peekSave().day];
    }), [5, 1000, true, 5]);
  });
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
