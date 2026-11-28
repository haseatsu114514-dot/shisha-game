// タイトルの EXTRA（あそびば・要望台帳 EXT01〜EXT04）と、「つづきから」の行の「セーブを選ぶ」（EXT02）。
// 2026-11-27 オーナー「エクストラにしよう　斧投げを初めて体験したら解禁　それまでは？？？」
// 「ミニゲームがいくつかあるのがわかるようにまだやってないのはロックしといたり」
// 「店番とてつこと一台勝負はミニゲーム扱いにしない　あとエクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも
//  あとミニゲームにも進行度が関係するのはセーブデータから」。
//   1. 斧投げを遊ぶまでは「？？？／ひみつ」で開かない。押すと開き方を短く知らせ、↑↓のカーソルは乗らない。
//   2. 選ぶ画面は全画面。カード5枚（絵つき）。遊んでいないカードは「？？？」と鍵で、選ぶと説明だけ（あそぶは押せない）。
//      斧投げを開いて「やめる」で画面へ戻り、とじるとタイトルのまま（本編のセーブは変わらない）。
//   3. 段（初級・中級・上級）は、セーブ枠のうちいちばん進んだものから開く。DJ のセットも同じ。
//   4. ボドゲカフェは、セーブの本棚のまま開き、「EXTRAへ戻る」で画面へ戻る。
//   5. この機能より前のセーブ（斧投げの体験済み）からも拾って開く。セーブがあれば「セーブを選ぶ」で枠選び。
//   6. 縦持ち（縦画面）でも同じ画面が縦の並べ方で出る。
import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const KEY = "suien_remake_extra_played";
const GAMES = ["axe", "trpg", "dj", "camel", "desert"]; // 店番・てつこ・一台勝負はミニゲームとして扱わない
const ready = (page) => page.locator("#boot").waitFor({ state: "detached", timeout: 30000 });
const openExtra = async (page) => {
  await page.locator(t("title-extra")).click();
  await page.locator(`${t("extra-screen")}:not([hidden])`).waitFor();
};
const chips = (page) => page.locator(`${t("extra-chips")} .xs-chip`).evaluateAll((ns) => ns.map((n) =>
  [n.querySelector("b").textContent, n.classList.contains("is-locked") ? "lock" : n.classList.contains("is-on") ? "on" : n.classList.contains("is-pick") ? "pick" : "info"]));
/** セーブ枠に state の形を書く（key は "auto" か手動の枠）。fill は value に中身を足す文。 */
const seedSave = (page, key, fill) => page.evaluate(async ({ key, fill }) => {
  const core = await import("./js/core/state.js");
  const value = core.newState();
  Object.assign(value, { chapter: 2, phase: "daily", day: 5, slot: 1 });
  value.growth ||= {};
  new Function("value", fill)(value);
  localStorage.setItem(key === "auto" ? core.SAVE_KEY : key, JSON.stringify(value));
}, { key, fill });

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
    // 押すと開き方を知らせるだけで、画面は開かない
    await row.evaluate((n) => n.click());
    await page.locator(".toast, [class*=toast]").filter({ hasText: "本編を進めると開きます" }).first().waitFor();
    assert.equal(await page.locator(t("extra-screen")).count(), 0);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), KEY), null);
  });

  await check("screen-locks-and-axe-round-trip", async (page) => {
    await ready(page);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe", "dj"])), KEY);
    await page.reload(); await ready(page);
    const before = await storageSnapshot(page);
    assert.deepEqual(await page.locator(t("title-extra")).evaluate((n) => [n.querySelector(".ti-en").textContent, n.querySelector(".ti-ja").textContent, n.classList.contains("is-locked")]),
      ["EXTRA", "あそびば", false]);
    await openExtra(page);
    assert.equal(await page.locator(`${t("extra-count")} b`).textContent(), "2");
    const cards = await page.locator(".xs-card").evaluateAll((ns) => ns.map((n) => [n.dataset.test, n.querySelector(".xs-card-name").textContent, n.classList.contains("is-locked"),
      n.querySelector(".xs-art").getAttribute("src")]));
    assert.deepEqual(cards, GAMES.map((id) => ["axe", "dj"].includes(id)
      ? [`extra-${id}`, { axe: "斧投げ", dj: "DJ" }[id], false, `img/ui/extra/card-${id}.webp`]
      : [`extra-${id}`, "？？？", true, `img/ui/extra/card-${id}.webp`]));
    // カードの絵が読めている
    await page.waitForFunction(() => [...document.querySelectorAll(".xs-card .xs-art")].every((n) => n.complete && n.naturalWidth >= 640));
    // 最初は遊んだ中の先頭（斧投げ）。セーブが無いので段は初級だけが開き、いちばん上の開いた段を選んでおく
    assert.equal(await page.locator(t("extra-detail-name")).textContent(), "斧投げ");
    assert.deepEqual(await chips(page), [["練習", "pick"], ["初級", "on"], ["中級", "lock"], ["上級", "lock"]]);
    // 遊んでいないカードは説明だけで、あそぶは押せない
    await page.locator(t("extra-camel")).click();
    assert.equal(await page.locator(t("extra-detail-name")).textContent(), "？？？");
    assert(await page.locator(t("extra-play")).isDisabled());
    // 斧投げ（練習）を開いて、「やめる」で画面へ戻る
    await page.locator(t("extra-axe")).click();
    await page.locator(t("extra-chip-practice")).click();
    await page.locator(t("extra-play")).click();
    await page.locator(t("extra-host-axe")).waitFor();
    assert(await page.locator(t("extra-screen")).isHidden());
    await page.locator(t("axe-cancel")).waitFor({ timeout: 20000 });
    await page.locator(t("axe-cancel")).click();
    await page.locator(t("extra-host-axe")).waitFor({ state: "detached" });
    await page.locator(`${t("extra-screen")}:not([hidden])`).waitFor();
    await page.locator(t("extra-close")).click();
    await page.locator(t("extra-screen")).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.body.dataset.screen), "title");
    // 本編のセーブ・設定は変わらない
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("progress-comes-from-the-furthest-save", async (page) => {
    await ready(page);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe", "dj"])), KEY);
    // オートセーブは斧投げの初級クリアまで。手動の枠1は中級クリアまで（こちらがいちばん進んでいる）。DJ は初級クリア
    await seedSave(page, "auto", 'value.flags._axe_lesson_done = true; value.growth.playTiers = { axe: { cleared: ["easy"] }, dj: { cleared: ["easy"] } };');
    await seedSave(page, "suien_remake_slot1", 'value.growth.playTiers = { axe: { cleared: ["easy", "normal"] } };');
    await page.reload(); await ready(page);
    await openExtra(page);
    assert.deepEqual(await chips(page), [["練習", "pick"], ["初級", "pick"], ["中級", "pick"], ["上級", "on"]]);
    // カードの印は、クリアした段の数
    assert.equal(await page.locator(`${t("extra-axe")} .xs-pips i.on`).count(), 2);
    await page.locator(t("extra-dj")).click();
    assert.deepEqual(await chips(page), [["SET 1", "pick"], ["SET 2", "on"], ["SET 3", "lock"]]);
    // キーでも選べる: ← で斧投げへ、↑ で段をひとつ下へ、Esc でとじる
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator(t("extra-detail-name")).textContent(), "斧投げ");
    await page.keyboard.press("ArrowUp");
    assert.deepEqual((await chips(page)).find(([, state]) => state === "on"), ["中級", "on"]);
    await page.keyboard.press("Escape");
    await page.locator(t("extra-screen")).waitFor({ state: "detached" });
  });

  await check("board-game-cafe-opens-the-saved-shelf", async (page) => {
    await ready(page);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe", "trpg"])), KEY);
    const owned = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { loadTrpgClubResources } = await import("./js/trpg/index.js");
      const { trpgTrialState } = await import("./js/trpg/trial-state.js");
      const { catalog } = await loadTrpgClubResources();
      const value = trpgTrialState(core.newState(), catalog, "ready");
      value.trpg.owned = value.trpg.owned.slice(0, 2);
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(value));
      return value.trpg.owned.length;
    });
    await page.reload(); await ready(page);
    await openExtra(page);
    await page.locator(t("extra-trpg")).click();
    assert.deepEqual(await chips(page), [[`本 ${owned}冊`, "info"], ["物語 0", "info"]]);
    const before = await storageSnapshot(page);
    await page.locator(t("extra-play")).click();
    await page.locator(t("extra-host-trpg")).waitFor();
    const close = page.locator(t("trpg-campaign-close")).first();
    await close.waitFor({ timeout: 30000 });
    assert.equal((await close.textContent()).trim(), "EXTRAへ戻る");
    await close.click();
    await page.locator(`${t("extra-screen")}:not([hidden])`).waitFor();
    assert.deepEqual(await storageSnapshot(page), before);
  });

  await check("older-save-opens-extra", async (page) => {
    await ready(page);
    await seedSave(page, "auto", "value.chapter = 1; value.day = 6; value.flags._axe_lesson_done = true;");
    await page.reload(); await ready(page);
    assert.equal(await page.locator(`${t("title-extra")} .ti-en`).textContent(), "EXTRA");
    // 拾った分は端末の記録にも残す（後でセーブを消しても開いたまま）
    assert.deepEqual(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY)), ["axe"]);
    // セーブがあれば「つづきから」の行に「セーブを選ぶ」が出て、枠選びが開く
    await page.locator(t("title-load")).click();
    await page.locator(t("slot-cancel")).waitFor();
  });

  await check("portrait-vertical-look", async (page) => {
    await page.locator(t("vt-title-extra")).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(`${t("vt-title-extra")}.is-locked`).count(), 1);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["axe"])), KEY);
    await page.reload();
    await page.locator(`${t("vt-title-extra")}:not(.is-locked)`).waitFor({ timeout: 30000 });
    await page.locator(t("vt-title-extra")).tap();
    await page.locator(`${t("extra-screen")}:not([hidden])`).waitFor();
    await page.waitForTimeout(700); // カードの出る動きが済んでから測る
    const m = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      return { cards: box(".xs-cards"), detail: box(".xs-detail"), play: box(".xs-play"), w: innerWidth, h: innerHeight,
        scroll: getComputedStyle(document.querySelector(".xs-cards")).overflowX, card: box(".xs-card.is-current") };
    });
    // 縦の並べ方: カードの列（横に流せる）の下に詳しい欄、「あそぶ」は下の方で横いっぱいに近い
    assert(m.detail.top >= m.cards.bottom - 1 && m.play.bottom <= m.h && m.play.width >= m.w * 0.7, JSON.stringify(m));
    assert.equal(m.scroll, "auto");
    assert(m.card.left >= 0 && m.card.right <= m.w, `選んだカードは画面の中 ${JSON.stringify(m.card)}`);
    await page.locator(t("extra-desert")).tap();
    assert.equal(await page.locator(t("extra-detail-name")).textContent(), "？？？");
    await page.locator(t("extra-close")).tap();
    await page.locator(t("extra-screen")).waitFor({ state: "detached" });
  }, { pageEntry: `${baseURL}?look=vertical`, pageReadySelector: '[data-test="vt-title"]', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
