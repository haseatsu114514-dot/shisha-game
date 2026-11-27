// 見た目の様式の既定（LK24）: プレイヤーの既定は縦画面（2026-11-27 オーナー「縦画面をメインにする」）、自動操作のブラウザは旧版。
// 旧版へは設定でいつでも戻せる。新版は設定で選べない（コードは残す）。
// 自動操作の印（navigator.webdriver）を外した「プレイヤーの端末」で、既定・選び直しの保存・起動時の移行・章による制限を確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const CONFIG_KEY = "suien_remake_config";
const t = (id) => `[data-test="${id}"]`;
const look = (page) => page.evaluate(() => ({
  look: document.documentElement.dataset.look, choice: document.documentElement.dataset.lookChoice,
  saved: JSON.parse(localStorage.getItem("suien_remake_config") || "null"),
}));
const titleReady = (page) => page.locator(t("title-new")).waitFor({ timeout: 40000 });
/** 以後の読み込みを「プレイヤーの端末」にする（自動操作の印を外す）。 */
async function asPlayer(page, saved) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false, configurable: true }));
  await page.evaluate(([key, value]) => {
    if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  }, [CONFIG_KEY, saved]);
  await page.reload();
  await titleReady(page);
}
async function reopenWith(page, saved) {
  await page.evaluate(([key, value]) => {
    if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  }, [CONFIG_KEY, saved]);
  await page.reload();
  await titleReady(page);
}
const checkedLook = (page) => page.locator(`${t("cfg-look")} button[aria-checked="true"]`).getAttribute("value");

await suite("look-default", async (check) => {
  await check("automation-default-is-classic", async (page) => {
    assert.equal(await page.evaluate(() => navigator.webdriver), true, "この検査は自動操作のブラウザで動く");
    const state = await look(page);
    assert.deepEqual([state.look, state.choice], ["classic", "classic"], "自動操作のブラウザの既定は旧版");
    await page.locator(t("title-config")).click();
    assert.deepEqual(await page.locator(`${t("cfg-look")} button`).allTextContents(), ["旧版", "DS風", "縦画面"], "新版は設定に出ない（LK23）。縦画面（VPN01）は選べる");
    assert.equal(await checkedLook(page), "classic");
  });

  await check("player-default-is-vertical-and-choice-persists", async (page) => {
    await asPlayer(page, undefined);
    let state = await look(page);
    assert.deepEqual([state.look, state.choice], ["vertical", "vertical"], "プレイヤーの端末の既定は縦画面（LK24）");
    // 横持ち（この検査の画面）では縦の外枠は出ず、今の画面のタイトルから設定を開ける
    await page.locator(t("title-config")).click();
    assert.equal(await checkedLook(page), "vertical", "設定でも縦画面が選ばれている");
    assert.deepEqual(await page.locator(`${t("cfg-look")} button`).allTextContents(), ["旧版", "DS風", "縦画面"], "新版は設定に出ない（LK23）。縦画面（VPN01）は選べる");
    // DS風へ切り替えられる。選んだDS風は、次に開いてもDS風のまま。
    await page.locator(`${t("cfg-look")} button[value="retro"]`).click();
    state = await look(page);
    assert.deepEqual([state.look, state.choice, state.saved.look, state.saved.lookVersion], ["retro", "retro", "retro", 3]);
    await page.reload(); await titleReady(page);
    state = await look(page);
    assert.deepEqual([state.look, state.choice], ["retro", "retro"], "選び直したDS風は保たれる");
    // 旧版（前の仕様）へ戻しても保たれる（LK24 の移行は一度だけ）。
    // DS風では、外枠のタイトルと設定シートに表示されているボタンを使う。
    await page.locator(t("retro-title-config")).click();
    await page.locator(`${t("sheet-cfg-look")} button[value="classic"]`).click();
    await page.reload(); await titleReady(page);
    assert.deepEqual([(await look(page)).look, (await look(page)).choice], ["classic", "classic"]);
  });

  await check("saved-look-migrates-once", async (page) => {
    await asPlayer(page, { look: "classic" });
    assert.equal((await look(page)).choice, "vertical", "既定のまま旧版だった端末は一度だけ縦画面へ（LK24）");
    await reopenWith(page, { look: "classic", lookVersion: 2 });
    assert.equal((await look(page)).choice, "vertical", "LK23 の既定だった旧版も一度だけ縦画面へ（LK24）");
    await reopenWith(page, { look: "classic", lookVersion: 3 });
    assert.equal((await look(page)).look, "classic", "縦画面にした後で旧版へ戻した端末は、旧版のまま");
    await reopenWith(page, { look: "retro" });
    assert.equal((await look(page)).choice, "retro", "DS風を選んでいた端末は変えない");
    await reopenWith(page, { look: "neo", bgmVolume: 0.2 });
    const state = await look(page);
    assert.equal(state.choice, "vertical", "新版を選んでいた端末は既定（縦画面）へ移す（LK24）");
    // ほかの設定は移行で変えない
    assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.bgmVolume), 0.2);
  });

  await check("player-default-vertical-is-chapter-1-for-now", async (page) => {
    await asPlayer(page, undefined);
    // 既定の縦画面は、縦にしてある第1章で効く。まだ縦にしていない第2章からは旧版で表示する（選んだ様式は縦画面のまま）。
    for (const chapter of [2, 3, 4, 5, 1]) {
      await page.evaluate(async (chapter) => {
        const core = await import("./js/core/state.js");
        if (!core.state) core.newGame();
        core.state.chapter = chapter; document.body.dataset.screen = "daily";
      }, chapter);
      await page.waitForTimeout(650);
      const state = await look(page);
      assert.deepEqual([state.look, state.choice], [chapter === 1 ? "vertical" : "classic", "vertical"], `第${chapter}章: ${chapter === 1 ? "縦画面" : "旧版で表示"}`);
    }
  });
});
