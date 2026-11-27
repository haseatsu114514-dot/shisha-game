// タイトルの EXTRA（あそびば・要望台帳 EXT01）と、「つづきから」の行の「セーブを選ぶ」（EXT02）。
// 2026-11-27 オーナー「エクストラにしよう　斧投げを初めて体験したら解禁　それまでは？？？」
// 「ミニゲームがいくつかあるのがわかるようにまだやってないのはロックしといたり」。
//   1. 斧投げを遊ぶまでは「？？？／ひみつ」で開かない。押すと開き方を短く知らせ、↑↓のカーソルは乗らない。
//   2. 遊んだ記録があれば EXTRA が開き、一覧は7つ。遊んでいないものは「？？？」で押せない。題に遊んだ数。
//   3. 一覧から斧投げを開き、「やめる」で一覧へ戻る。とじるとタイトルのまま（本編のセーブは変わらない）。
//   4. この機能より前のセーブ（斧投げの体験済み）からも拾って開く。
//   5. 縦画面（スマホ縦）でも同じ一覧がシートで出る。
import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const KEY = "suien_remake_extra_played";
const GAMES = ["axe", "floor", "trpg", "dj", "tetsuko", "camel", "desert"];
const ready = (page) => page.locator("#boot").waitFor({ state: "detached", timeout: 30000 });

await suite("title_extra", async (check) => {
  await check("locked-until-the-axe", async (page) => {
    await ready(page);
    const row = page.locator(t("title-extra"));
    assert.deepEqual(await row.evaluate((n) => [n.querySelector(".ti-en").textContent, n.querySelector(".ti-ja").textContent,
      n.classList.contains("is-locked"), n.getAttribute("aria-disabled"), n.disabled]), ["？？？", "ひみつ", true, "true", false]);
    // ↑↓は押せない「つづきから」と、まだ開いていない「？？？」を飛ばす
    await page.locator(t("title-new")).hover(); await page.mouse.move(1200, 40);
    await page.keyboard.press("ArrowDown");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".title-item.is-current")].map((n) => n.dataset.test)), ["title-gallery"]);
    // 押すと開き方を知らせるだけで、一覧は開かない
    await row.evaluate((n) => n.click());
    await page.locator(".toast, [class*=toast]").filter({ hasText: "本編を進めると開きます" }).first().waitFor();
    assert.equal(await page.locator("#modal.show").count(), 0);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), null);
  });

  await check("list-locks-and-axe-round-trip", async (page) => {
    await ready(page);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe", "dj"])), KEY);
    await page.reload(); await ready(page);
    const before = await storageSnapshot(page);
    const row = page.locator(t("title-extra"));
    assert.deepEqual(await row.evaluate((n) => [n.querySelector(".ti-en").textContent, n.querySelector(".ti-ja").textContent, n.classList.contains("is-locked")]),
      ["EXTRA", "あそびば", false]);
    await row.click();
    await page.locator("#modal.show .extra-box").waitFor();
    assert.equal((await page.locator("#modal.show .extra-box > h3").textContent()).trim(), "EXTRA 2/7");
    const list = await page.locator("#modal.show .modal-actions button").evaluateAll((ns) => ns.map((n) => [n.dataset.test, n.textContent.trim(), n.disabled]));
    assert.deepEqual(list, [
      ...GAMES.map((id) => ["axe", "dj"].includes(id)
        ? [`extra-${id}`, { axe: "斧投げ", dj: "DJ" }[id], false]
        : [`extra-${id}`, "？？？", true]),
      ["extra-close", "とじる", false],
    ]);
    // 2列に並ぶ（とじるは横いっぱい）
    const boxes = await page.locator("#modal.show .modal-actions button").evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.width)]));
    assert.equal(boxes[0][0], boxes[2][0]); assert.notEqual(boxes[0][0], boxes[1][0]);
    assert(boxes.at(-1)[1] > boxes[0][1] * 1.8, `とじるは横いっぱい ${JSON.stringify(boxes)}`);
    // 斧投げを開いて、「やめる」で一覧へ戻る
    await page.locator(t("extra-axe")).click();
    await page.locator(t("extra-host-axe")).waitFor();
    await page.locator(t("axe-cancel")).waitFor({ timeout: 20000 });
    await page.locator(t("axe-cancel")).click();
    await page.locator(t("extra-host-axe")).waitFor({ state: "detached" });
    await page.locator("#modal.show .extra-box").waitFor();
    await page.locator(t("extra-close")).click();
    await page.waitForFunction(() => !document.querySelector("#modal.show") && document.body.dataset.screen === "title");
    // 本編のセーブ・設定は変わらない（記録は遊んだ一覧だけ）
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("older-save-opens-extra", async (page) => {
    await ready(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newState();
      Object.assign(value, { chapter: 1, phase: "daily", day: 6, slot: 1 });
      value.flags._axe_lesson_done = true;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(value));
    });
    await page.reload(); await ready(page);
    assert.equal(await page.locator(`${t("title-extra")} .ti-en`).textContent(), "EXTRA");
    // 拾った分は端末の記録にも残す（後でセーブを消しても開いたまま）
    assert.deepEqual(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY)), ["axe"]);
    // セーブがあれば「つづきから」の行に「セーブを選ぶ」が出て、枠選びが開く
    await page.locator(t("title-load")).click();
    await page.locator(t("slot-cancel")).waitFor();
  });

  await check("vertical-sheet", async (page) => {
    await page.locator(t("vt-title-extra")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(`${t("vt-title-extra")}.is-locked`).count(), 1);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe"])), KEY);
    await page.reload();
    await page.locator(`${t("vt-title-extra")}:not(.is-locked)`).waitFor({ timeout: 30000 });
    await page.locator(t("vt-title-extra")).tap();
    const items = page.locator(`.vt-sheet-host [data-test$="extra-axe"]`);
    await items.waitFor();
    const sheet = await page.locator(".vt-sheet-host .rs-foot").evaluate((foot) => [...foot.children].map((n) => [n.dataset.test.replace(/^.*?extra-/, "extra-"), n.disabled, getComputedStyle(n).gridColumnEnd]));
    assert.deepEqual(sheet.map(([id, disabled]) => [id, disabled]), [...GAMES.map((id) => [`extra-${id}`, id !== "axe"]), ["extra-close", false]]);
    assert.equal(sheet.at(-1)[2], "-1", "とじるは横いっぱい");
    await page.locator(`.vt-sheet-host [data-test$="extra-close"]`).tap();
    await page.waitForFunction(() => !document.querySelector("#modal.show"));
  }, { pageEntry: `${baseURL}?look=vertical`, pageReadySelector: '[data-test="vt-title"]', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
