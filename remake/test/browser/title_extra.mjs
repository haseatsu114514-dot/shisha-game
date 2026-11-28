// タイトルの EXTRA（あそびば・要望台帳 EXT01〜EXT07）と、「つづきから」の行の「セーブを選ぶ」（EXT02）。
// 2026-11-27 オーナー「エクストラにしよう　斧投げを初めて体験したら解禁　それまでは？？？」
// 「ミニゲームがいくつかあるのがわかるようにまだやってないのはロックしといたり」
// 「店番とてつこと一台勝負はミニゲーム扱いにしない　あとエクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも
//  あとミニゲームにも進行度が関係するのはセーブデータから」。
//   1. 斧投げを遊ぶまでは「？？？／ひみつ」で開かない。押すと開き方を短く知らせ、↑↓のカーソルは乗らない。
//   2. 選ぶ画面は全画面で、ミニゲームを1つずつ横にスライドして選ぶ（2026-11-28「実際のミニゲームのスクショ使いたい　枠でイメージ画像
//      何個か見せて　ミニゲームタイトルと　横スライド式でミニゲーム選択」）。各スライドは枠に実際の画面の写真3枚（小さな絵で選べる）と題。
//      遊んでいない遊びは「？？？」と鍵で、説明だけ（あそぶは押せない）。斧投げを開いて「やめる」で画面へ戻り、とじるとタイトルのまま。
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
const chips = (page, id) => page.locator(`${t(`extra-chips-${id}`)} .xs-chip`).evaluateAll((ns) => ns.map((n) =>
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
    // スライドは5枚。遊んでいない遊びは「？？？」と鍵。下の並びも同じ数
    const slides = await page.locator(".xs-slide").evaluateAll((ns) => ns.map((n) => [n.dataset.game, n.querySelector(".xs-name").textContent, n.classList.contains("is-locked"),
      n.querySelectorAll(".xs-shot").length, n.querySelectorAll(".xs-thumb").length]));
    assert.deepEqual(slides, GAMES.map((id) => ["axe", "dj"].includes(id) ? [id, { axe: "斧投げ", dj: "DJ" }[id], false, 3, 3] : [id, "？？？", true, 3, 0]));
    assert.deepEqual(await page.locator(`${t("extra-pager")} .xs-dot`).evaluateAll((ns) => ns.map((n) => n.textContent)), ["斧投げ", "？？？", "DJ", "？？？", "？？？"]);
    // 遊んだ遊びには題字のロゴ（EXT06）。題字・枠の絵などの部品（EXT07）とロゴの絵が読めている
    assert.deepEqual(await page.locator(".xs-slide:not(.is-locked) .xs-logo").evaluateAll((ns) => ns.map((n) => n.getAttribute("src"))),
      ["img/ui/axe_throw/logo.webp", "img/ui/dj/logo.webp"]);
    await page.waitForFunction(() => [...document.querySelectorAll(".xs-slide:not(.is-locked) .xs-logo, .xs-frame-art, .xs-wordmark")]
      .every((n) => n.complete && n.naturalWidth > 0));
    // 最初は遊んだ中の先頭（斧投げ）。枠の写真が読めていて、小さな絵で切り替わる
    assert.equal(await page.locator(".xs-slide.is-current").getAttribute("data-game"), "axe");
    await page.waitForFunction(() => [...document.querySelectorAll(".xs-slide.is-current .xs-shot")].every((n) => n.complete && n.naturalWidth >= 768));
    await page.locator(t("extra-thumb-axe-2")).click();
    assert.deepEqual(await page.locator(`${t("extra-frame-axe")} .xs-shot`).evaluateAll((ns) => ns.map((n) => n.classList.contains("on"))), [false, true, false]);
    // セーブが無いので段は初級だけが開き、いちばん上の開いた段を選んでおく
    assert.deepEqual(await chips(page, "axe"), [["練習", "pick"], ["初級", "on"], ["中級", "lock"], ["上級", "lock"]]);
    // 次の矢印で、まだ遊んでいない遊び（ボドゲカフェ）のスライドへ。説明だけで、あそぶは押せない
    await page.locator(t("extra-next")).click();
    await page.waitForFunction(() => document.querySelector(".xs-slide.is-current")?.dataset.game === "trpg");
    assert.equal(await page.locator(t("extra-name-trpg")).textContent(), "？？？");
    assert(await page.locator(t("extra-play-trpg")).isDisabled());
    // 斧投げ（練習）を開いて、「やめる」で画面へ戻る
    await page.locator(t("extra-axe")).click();
    await page.waitForFunction(() => document.querySelector(".xs-slide.is-current")?.dataset.game === "axe");
    await page.locator(t("extra-chip-axe-practice")).click();
    await page.locator(t("extra-play-axe")).click();
    await page.locator(t("extra-host-axe")).waitFor();
    assert(await page.locator(t("extra-screen")).isHidden());
    await page.locator(t("axe-cancel")).waitFor({ timeout: 20000 });
    await page.locator(t("axe-cancel")).click();
    await page.locator(t("extra-host-axe")).waitFor({ state: "detached" });
    await page.locator(`${t("extra-screen")}:not([hidden])`).waitFor();
    assert.equal(await page.locator(".xs-slide.is-current").getAttribute("data-game"), "axe");
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
    assert.deepEqual(await chips(page, "axe"), [["練習", "pick"], ["初級", "pick"], ["中級", "pick"], ["上級", "on"]]);
    // クリアした段には印
    assert.equal(await page.locator(`${t("extra-chips-axe")} .xs-chip.is-cleared`).count(), 2);
    await page.locator(t("extra-dj")).click();
    assert.deepEqual(await chips(page, "dj"), [["SET 1", "pick"], ["SET 2", "on"], ["SET 3", "lock"]]);
    // キーでも選べる: ← で斧投げへ、↑ で段をひとつ下へ、Esc でとじる
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => document.querySelector(".xs-slide.is-current")?.dataset.game === "axe");
    await page.keyboard.press("ArrowUp");
    assert.deepEqual((await chips(page, "axe")).find(([, state]) => state === "on"), ["中級", "on"]);
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
    await page.waitForFunction(() => document.querySelector(".xs-slide.is-current")?.dataset.game === "trpg");
    assert.deepEqual(await chips(page, "trpg"), [[`本 ${owned}冊`, "info"], ["物語 0", "info"]]);
    const before = await storageSnapshot(page);
    await page.locator(t("extra-play-trpg")).click();
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
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      return { frame: box(".xs-slide.is-current .xs-frame"), info: box(".xs-slide.is-current .xs-info"), play: box(".xs-slide.is-current .xs-play"),
        pager: box(".xs-pager"), w: innerWidth, h: innerHeight };
    });
    // 縦の並べ方: 枠を上、題と札を下に。「あそぶ」は横いっぱいに近く、下の並びより上
    assert(m.frame.left >= 0 && m.frame.right <= m.w && m.info.top >= m.frame.bottom - 1, JSON.stringify(m));
    assert(m.play.width >= m.w * 0.7 && m.play.bottom <= m.pager.top + 1 && m.pager.bottom <= m.h, JSON.stringify(m));
    // 指で横に流すと、止まった所のスライドが今のスライドになる
    await page.locator(t("extra-track")).evaluate((n) => n.scrollTo({ left: n.clientWidth * 4, behavior: "auto" }));
    await page.waitForFunction(() => document.querySelector(".xs-slide.is-current")?.dataset.game === "desert");
    assert.equal(await page.locator(t("extra-name-desert")).textContent(), "？？？");
    assert.equal(await page.locator(".xs-dot.is-current").getAttribute("data-test"), "extra-desert");
    await page.locator(t("extra-close")).tap();
    await page.locator(t("extra-screen")).waitFor({ state: "detached" });
  }, { pageEntry: `${baseURL}?look=vertical`, pageReadySelector: '[data-test="vt-title"]', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
