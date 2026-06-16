// Dr.fookah 入店・物販・凛ブース・所持金不足・戻りのUIテスト。
// 使い方: リポジトリルートで python3 -m http.server 8123 を起動してから
//        node web/test/fookah.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); } })();
const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[fookah]", ...a);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

// New Game → 本編へ
await page.click("#btn-new");
await page.waitForSelector("#disclaimer-overlay.visible");
await page.keyboard.press("Enter");

// チュートリアル＋対話を進める（マップに辿り着くまで）
let guard = 0;
while (guard++ < 2000) {
  if (await page.locator("#phone-overlay.show").count()) {
    const reply = page.locator("#phone-overlay .lime-reply").first();
    if (await reply.count()) await reply.click();
    await page.waitForTimeout(200);
    continue;
  }
  if (await page.locator("#map-beat").count()) {
    await page.locator("#map-beat").click().catch(() => {});
    await page.waitForTimeout(80);
    continue;
  }
  const screen = await page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
  if (screen === "screen-map") break;
  if (screen === "screen-tournament") {
    // チュートリアル: tournament画面のボタンを順次クリック
    const { playTnStep } = await import("./steps.mjs");
    await playTnStep(page);
    continue;
  }
  if (screen === "screen-dialogue") {
    const choice = page.locator("#vn-choices .choice-btn").first();
    if (await choice.count()) await choice.click();
    else await page.click("#vn-click-layer");
    await page.waitForTimeout(15);
    continue;
  }
  await page.waitForTimeout(50);
}
log("reached map");

// ---- テスト1: マップからDr.fookahピン → サブメニュー表示 ----
const fookahPin = page.locator("#map-pins .spot-pin", { hasText: "Dr.fookah" }).first();
if (!(await fookahPin.count())) throw new Error("Dr.fookah pin not found on map");
await fookahPin.click();
await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
log("fookah menu opened OK");

// メニューの物販ボタンが有効、凛ボタンの状態を確認
const shopBtn = page.locator("#fookah-shop");
const rinBtn = page.locator("#fookah-rin");
if (!(await shopBtn.count())) throw new Error("fookah-shop button not found");
if (!(await rinBtn.count())) throw new Error("fookah-rin button not found");

// 物販は常に有効
if (await shopBtn.isDisabled()) throw new Error("shop button should be enabled");
log("shop button enabled OK");

// ---- テスト2: 「← マップに戻る」で閉じる ----
await page.locator("#fookah-close").click();
await page.waitForTimeout(200);
const menuAfterClose = await page.locator("#fookah-menu").count();
if (menuAfterClose > 0) throw new Error("fookah menu should be removed after close");
log("back to map OK");

// ---- テスト3: 物販 → ショップ画面 → 閉じてマップに戻る ----
await fookahPin.click();
await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
await page.locator("#fookah-shop").click();
await page.waitForSelector("#screen-shop.active", { timeout: 3000 });
log("shop screen opened OK");

// ショップから戻る
await page.locator("#shop-close").click();
await page.waitForSelector("#screen-map.active", { timeout: 3000 });
log("shop → map return OK");

// ---- テスト4: 凛ブース → 対話 → マップに戻る（2,500円・1コマ消費） ----
const moneyBefore = await page.evaluate(() => state.money);
await fookahPin.click();
await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
const rinDisabled = await page.locator("#fookah-rin").isDisabled();
if (rinDisabled) {
  log("rin button disabled (insufficient funds or already visited) — testing broke path");
  await page.locator("#fookah-close").click();
  await page.waitForTimeout(200);
} else {
  await page.locator("#fookah-rin").click();
  // 対話を進める
  let dGuard = 0;
  while (dGuard++ < 500) {
    const sc = await page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
    if (sc === "screen-map") break;
    if (sc === "screen-shop") {
      // ショップ画面に飛ばされた場合（shishaGuard失敗等）
      await page.locator("#shop-close").click();
      await page.waitForTimeout(200);
      break;
    }
    if (sc === "screen-dialogue") {
      const choice = page.locator("#vn-choices .choice-btn").first();
      if (await choice.count()) await choice.click();
      else await page.click("#vn-click-layer");
      await page.waitForTimeout(15);
      continue;
    }
    await page.waitForTimeout(50);
  }
  const moneyAfter = await page.evaluate(() => state.money);
  const spent = moneyBefore - moneyAfter;
  log(`rin visit: spent ${spent}円 (expected 2500)`);
  if (spent !== 2500) throw new Error(`Rin booth fee mismatch: spent ${spent}, expected 2500`);
  log("rin booth fee 2500円 OK");
}

// ---- テスト5: 所持金不足時に凛ボタンが無効化される ----
const origMoney = await page.evaluate(() => state.money);
await page.evaluate(() => { state.money = 100; });
// 日付を変えてrin日次フラグをリセット
await page.evaluate(() => { state.day += 1; });
await fookahPin.click();
await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
const rinDisabledBroke = await page.locator("#fookah-rin").isDisabled();
if (!rinDisabledBroke) throw new Error("rin button should be disabled when broke");
const costText = await page.locator("#fookah-rin .spot-cost").textContent();
if (!costText.includes("足りない")) throw new Error(`Expected '足りない' in cost text, got: ${costText}`);
log(`broke state: rin disabled, text="${costText}" OK`);
await page.locator("#fookah-close").click();
await page.waitForTimeout(200);

// 所持金を復元、日付も戻す（テスト4で訪問した日に合わせる）
await page.evaluate((m) => { state.money = m; state.day -= 1; }, origMoney);

// ---- テスト6: 同日2回目の凛訪問が無効化される ----
// (テスト4で訪問済みなら当日フラグが立っている)
const rinDayFlag = await page.evaluate(() => !!state.flags[`_rin_d${state.day}`]);
if (rinDayFlag) {
  await fookahPin.click();
  await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
  const rinDisabledRepeat = await page.locator("#fookah-rin").isDisabled();
  if (!rinDisabledRepeat) throw new Error("rin button should be disabled after daily visit");
  const repeatText = await page.locator("#fookah-rin .spot-cost").textContent();
  if (!repeatText.includes("もう行った")) throw new Error(`Expected 'もう行った', got: ${repeatText}`);
  log(`daily limit: rin disabled, text="${repeatText}" OK`);
  await page.locator("#fookah-close").click();
  await page.waitForTimeout(200);
} else {
  log("rin not visited today (skipping daily limit test)");
}

// ---- 結果 ----
if (errors.length) {
  console.error("Page errors:", errors);
  throw new Error(`${errors.length} page errors during test`);
}
log("FOOKAH PASSED ✅");
await browser.close();
process.exit(0);
