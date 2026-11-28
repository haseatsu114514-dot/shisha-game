// 本編は旧設定を縦版へ移す。自動操作の印を外し、プレイヤーの起動経路も検査する。
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
  await page.evaluate(() => localStorage.setItem("suien_loading_comics", "wait"));
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

await suite("look-default", async (check) => {
  await check("automation-default-is-classic", async (page) => {
    assert.equal(await page.evaluate(() => navigator.webdriver), true, "この検査は自動操作のブラウザで動く");
    const state = await look(page);
    assert.deepEqual([state.look, state.choice], ["classic", "classic"], "自動操作のブラウザの既定は旧版");
    await page.locator(t("title-config")).click();
    assert.equal(await page.locator(t("cfg-look")).count(), 0);
  });

  await check("player-uses-portrait-even-with-classic-url", async (page) => {
    await asPlayer(page, { look: "classic", lookVersion: 3, bgmVolume: 0.2 });
    await page.goto(new URL("?look=classic", page.url()).href);
    await titleReady(page);
    const state = await look(page);
    assert.deepEqual([state.choice, state.saved.look, state.saved.lookVersion, state.saved.bgmVolume], ["vertical", "vertical", 4, 0.2]);
    await page.locator("#rotate-hint .portrait-required").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(t("vt-title-config")).click();
    await page.locator('.vt-shell[data-scene="sheet"]').waitFor();
    assert.equal(await page.locator(t("cfg-look")).count(), 0);
    assert.equal(await page.locator(t("sheet-cfg-look")).count(), 0);
  });

  await check("saved-look-migrates-once", async (page) => {
    await asPlayer(page, { look: "classic" });
    assert.equal((await look(page)).choice, "vertical", "既定のまま旧版だった端末は一度だけ縦画面へ（LK24）");
    await reopenWith(page, { look: "classic", lookVersion: 2 });
    assert.equal((await look(page)).choice, "vertical", "LK23 の既定だった旧版も一度だけ縦画面へ（LK24）");
    await reopenWith(page, { look: "classic", lookVersion: 3 });
    assert.equal((await look(page)).look, "vertical", "以前に旧版を選んだ端末も縦に移る");
    await reopenWith(page, { look: "retro" });
    assert.equal((await look(page)).choice, "vertical", "廃止した DS風のセーブは既定へ戻す");
    await reopenWith(page, { look: "neo", bgmVolume: 0.2 });
    const state = await look(page);
    assert.equal(state.choice, "vertical", "新版を選んでいた端末は既定（縦画面）へ移す（LK24）");
    // ほかの設定は移行で変えない
    assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.bgmVolume), 0.2);
  });

  await check("player-default-vertical-applies-to-every-chapter", async (page) => {
    await asPlayer(page, undefined);
    // 既定の縦画面は、どの章でも縦画面で表示する（VPN17。第1章から作り、第2章以降の日常パートへ広げた）。
    for (const chapter of [2, 3, 4, 5, 1]) {
      await page.evaluate(async (chapter) => {
        const core = await import("./js/core/state.js");
        if (!core.state) core.newGame();
        core.state.chapter = chapter; document.body.dataset.screen = "daily";
      }, chapter);
      await page.waitForTimeout(650);
      const state = await look(page);
      assert.deepEqual([state.look, state.choice], ["vertical", "vertical"], `第${chapter}章も縦画面`);
    }
  });
});
