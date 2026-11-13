// 見た目の様式の既定（LK09）: プレイヤーの端末は新版、自動操作のブラウザ（この検査を含むブラウザテスト）は旧版。
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
    assert.deepEqual(await page.locator(`${t("cfg-look")} button`).allTextContents(), ["新版", "旧版", "DS風"]);
    assert.equal(await checkedLook(page), "classic");
  });

  await check("player-default-is-neo-and-choice-persists", async (page) => {
    await asPlayer(page, undefined);
    let state = await look(page);
    assert.deepEqual([state.look, state.choice], ["neo", "neo"], "プレイヤーの端末の既定は新版");
    await page.locator(t("title-config")).click();
    assert.equal(await checkedLook(page), "neo", "設定でも新版が選ばれている");
    // 旧版へ戻せる。選んだ旧版は、次に開いても旧版のまま。
    await page.locator(`${t("cfg-look")} button[value="classic"]`).click();
    state = await look(page);
    assert.deepEqual([state.look, state.choice, state.saved.look, state.saved.lookVersion], ["classic", "classic", "classic", 1]);
    await page.reload(); await titleReady(page);
    state = await look(page);
    assert.deepEqual([state.look, state.choice], ["classic", "classic"], "選び直した旧版は保たれる");
    // 新版へ戻しても保たれる。
    await page.locator(t("title-config")).click();
    await page.locator(`${t("cfg-look")} button[value="neo"]`).click();
    await page.reload(); await titleReady(page);
    assert.deepEqual([(await look(page)).look, (await look(page)).choice], ["neo", "neo"]);
  });

  await check("saved-look-migrates-once", async (page) => {
    await asPlayer(page, { look: "classic" });
    assert.equal((await look(page)).look, "neo", "#3256 の頃に当時の既定として保存された旧版は、一度だけ新版へ");
    await reopenWith(page, { look: "classic", lookVersion: 1 });
    assert.equal((await look(page)).look, "classic", "選び直した旧版はそのまま");
    await reopenWith(page, { look: "retro" });
    assert.equal((await look(page)).choice, "retro", "DS風を選んでいた端末は変えない");
    await reopenWith(page, { look: "neo", bgmVolume: 0.2 });
    const state = await look(page);
    assert.equal(state.look, "neo");
    // ほかの設定は移行で変えない
    assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.bgmVolume), 0.2);
  });

  await check("player-default-applies-to-every-chapter", async (page) => {
    await asPlayer(page, undefined);
    // 新版はすべての章で効く（LK13）。第2章へ進んでも旧版の表示に変わらない。
    for (const chapter of [2, 3, 4, 5, 1]) {
      await page.evaluate(async (chapter) => {
        const core = await import("./js/core/state.js");
        if (!core.state) core.newGame();
        core.state.chapter = chapter; document.body.dataset.screen = "daily";
      }, chapter);
      await page.waitForTimeout(650);
      const state = await look(page);
      assert.deepEqual([state.look, state.choice], ["neo", "neo"], `第${chapter}章でも新版`);
    }
  });
});
