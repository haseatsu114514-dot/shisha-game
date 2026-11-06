// 「てつこといっしょ」（#2454）の画面を直接開いて操作する短い検査。mukai の帰りからの到達は ch3_tokyo_daily.mjs。
// PC と横持ちタッチ・動きを減らす設定で、猫・操作・帰るが見切れず、触った反応が出て、通販の注文はお金と一緒に保存される。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function open(page, { visits = 0, money = 20000, orders = [] } = {}) {
  await page.evaluate(async ({ visits, money, orders }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(core.state, value, { chapter: 3, day: 34, slot: 0, money, stamina: 60 });
    core.state.met = { ...core.state.met, mukai_master: true, mashiro: true };
    if (visits) core.state.flags._ch3_outings = { tetsuko: visits };
    if (orders.length) core.state.flags._tetsuko_time = { orders };
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    await ui.setBg(data.bgUrl("bg_street", "day"), { instant: true });
    const game = await import("./js/minigames/tetsuko-time.js");
    window.__ttResult = undefined;
    game.openTetsukoTime({ value: core.state, key: "3:34:0", dayLabel: "東京 6日目" }).then(result => { window.__ttResult = result; });
  }, { visits, money, orders });
  await page.locator(t("tetsuko-time-screen")).waitFor();
}
const result = page => page.waitForFunction(() => window.__ttResult !== undefined).then(() => page.evaluate(() => window.__ttResult));
const line = page => page.locator(t("tt-line")).innerText();

await suite("tetsuko-time", async check => {
  await check("first-meeting-plays-and-returns-a-result", async page => {
    await open(page);
    for (const target of ["tt-pet", "tt-play", "tt-brush", "tt-treat", "tt-watch", "tt-arrange", "tt-shop", "tt-book", "tt-photo", "tetsuko-time-back", "tt-line"])
      await assertFits(page, t(target));
    assert.equal(await page.locator(t("tt-brush")).isDisabled(), true, "No brush on the first meeting");
    assert.equal(await page.locator(t("tt-treat")).isDisabled(), true, "No treats until they are ordered");
    await page.locator(t("tt-pet")).click();
    assert.match(await line(page), /撫で/);
    for (let i = 0; i < 3; i++) await page.locator(t("tt-play")).click();
    assert.match(await page.locator(t("tt-play")).innerText(), /じゃらしを止める/);
    await page.locator(t("tt-found")).filter({ hasText: "はじめて前足が出た" }).waitFor();
    await page.locator(t("tt-play")).click();
    // 図鑑: 見つけたしぐさは名前、未発見はヒント。
    await page.locator(t("tt-book")).click();
    await page.locator(t("tt-moment-first_paw")).filter({ hasText: "はじめて前足が出た" }).waitFor();
    assert.match(await page.locator(t("tt-moment-box_peek")).innerText(), /？？？[\s\S]*段ボール箱/);
    await page.locator(t("tt-panel-close")).click();
    // 帰る（二度押しても一度だけ）。保存はまだ書かない（確定は呼び出し側）。
    await page.locator(t("tetsuko-time-back")).dblclick();
    const out = await result(page);
    assert.equal(out.meaningful, true);
    assert.equal(out.key, "3:34:0");
    assert(out.found.includes("first_paw"));
    assert.equal(await page.locator(t("tetsuko-time-screen")).count(), 0, "The screen is gone");
    const flags = await page.evaluate(() => window.__remake.state.flags);
    assert.equal(flags._ch3_outings, undefined, "The screen itself does not count a visit");
  });

  await check("mail-order-takes-money-and-saves-at-once", async page => {
    await open(page, { visits: 4, money: 3000 });
    await page.locator(t("tt-shop")).click();
    await page.locator(t("tt-panel-shop")).waitFor();
    await assertFits(page, t("tt-panel-shop"));
    assert.equal(await page.locator(t("tt-order-bed")).isDisabled(), true, "Not enough money for the bed");
    await page.locator(t("tt-order-treat")).click();
    await page.locator(t("tt-order-treat")).filter({ hasText: "明日届く" }).waitFor();
    assert.match(await line(page), /注文した。明日、mukaiに届く/);
    const saved = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      return { money: core.state.money, orders: core.state.flags._tetsuko_time.orders, stored: core.peekSave()?.flags?._tetsuko_time?.orders, storedMoney: core.peekSave()?.money };
    });
    assert.equal(saved.money, 2400);
    assert.deepEqual(saved.orders, [{ id: "treat", day: 34 }]);
    assert.deepEqual(saved.stored, saved.orders, "The order is saved together with the money");
    assert.equal(saved.storedMoney, 2400);
    await page.locator(t("tt-panel-close")).click();
    assert.equal(await page.locator(t("tt-treat")).isDisabled(), true, "Ordered treats arrive tomorrow");
    await page.locator(t("tetsuko-time-back")).click();
    assert.equal((await result(page)).meaningful, false, "Ordering alone is not a visit");
  });

  await check("next-day-parcel-arrange-and-watch", async page => {
    await open(page, { visits: 4, orders: [{ id: "bed", day: 33 }, { id: "treat", day: 33 }] });
    await page.locator(t("tt-line")).filter({ hasText: "荷物" }).waitFor();
    await page.locator(t("tt-arrange")).click();
    assert.equal(await page.locator(t("tt-place-bed-bed")).getAttribute("aria-pressed"), "true", "The bed is set out on arrival");
    await page.locator(t("tt-place-floor-box")).click();
    await page.locator(t("tt-panel-close")).click();
    await page.locator(t("tt-found")).filter({ hasText: "ベッドより箱" }).waitFor({ timeout: 15000 });
    await page.locator(t("tt-treat")).click();
    assert.match(await line(page), /おやつ/);
    await page.locator(t("tt-watch")).click();
    await page.locator(t("tt-watch")).click();
    await page.locator(t("tt-found")).filter({ hasText: "膝で寝る" }).waitFor();
    await page.locator(t("tt-photo")).click();
    await page.locator(t("tetsuko-time-back")).click();
    const out = await result(page);
    assert.deepEqual(out.layout, { bench: null, floor: "box", bed: "bed" });
    assert.equal(out.treatsUsed, 1);
    assert.equal(out.seeOff, true, "A trusting cat sees him off");
    assert.equal(out.album[0].id, "lap_nap");
  });

  await check("landscape-touch-tap-and-reduced-motion", async page => {
    await open(page, { visits: 2 });
    for (const target of ["tt-pet", "tt-watch", "tetsuko-time-back", "tt-cat", "tt-line"]) await assertFits(page, t(target));
    await page.locator(t("tt-cat")).tap();
    assert.match(await line(page), /撫で|頭を寄せ|目を細め/);
    await page.locator(t("tt-arrange")).tap();
    await assertFits(page, t("tt-panel-arrange"));
    await page.locator(t("tt-panel-close")).tap();
    await page.locator(t("tetsuko-time-back")).tap();
    assert.equal((await result(page)).meaningful, true);
  }, { ...touch, reducedMotion: "reduce" });
});
