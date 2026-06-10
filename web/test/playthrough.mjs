// 第1章ブラウザ版の自動通しプレイテスト。
// 使い方: リポジトリルートで `npx http-server -p 8123 &` を起動してから
//        `node web/test/playthrough.mjs`
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// グローバルインストールの playwright も拾えるようにする
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[test]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");
log("title OK");
await page.click("#btn-new");

// 行動計画（マップで上から順に消費する）
const plan = [
  "tonariでバイト", "スミさんと話す",
  "シーシャの練習", "つむぎと話す",
  "なるの店へ行く", "カフェ",
  "観音堂", "C.STATION",
  "チョイザップ", "みんとの店へ行く",
  "tonariでバイト", "シーシャの練習",
  "チョイザップ", "家で休む",
];
let planIdx = 0;
let guard = 0;

async function activeScreen() {
  return page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
}

while (guard++ < 800) {
  const screen = await activeScreen();
  if (screen === "screen-tournament") break;
  if (screen === "screen-gameover") throw new Error("unexpected game over");
  if (screen === "screen-dialogue") {
    const choice = page.locator("#vn-choices .choice-btn").first();
    if (await choice.count()) await choice.click();
    else await page.click("#vn-click-layer");
    await page.waitForTimeout(15);
    continue;
  }
  if (screen === "screen-map") {
    const label = plan[planIdx % plan.length];
    planIdx++;
    const btn = page.locator(".spot-btn", { hasText: label }).first();
    if (await btn.isDisabled()) {
      await page.locator(".spot-btn", { hasText: "家で休む" }).click();
    } else {
      await btn.click();
    }
    await page.waitForTimeout(30);
    continue;
  }
  if (screen === "screen-practice") {
    if (await page.locator("#practice-menu:not(.hidden) .spot-btn").count()) {
      await page.locator("#practice-menu .spot-btn").first().click();
      await page.waitForTimeout(400);
      await page.click("#gauge-stop");
      await page.waitForTimeout(50);
      await page.locator("button", { hasText: "練習を終える" }).click();
    }
    await page.waitForTimeout(30);
    continue;
  }
  await page.waitForTimeout(50);
}

log("reached tournament, day check:", await page.locator("#hud-day").textContent());

// 検証しやすいようにステータスを底上げ（勝利ルートを確認する）
await page.evaluate(() => {
  state.stats = { technique: 80, sense: 80, guts: 80, charm: 80, insight: 80 };
});

// 大会: テーマ → ミックス → パック → 炭 → 蒸らし → 会話 → 引き → プレゼン → 結果
async function tnStep() {
  return page.locator("#tn-title").textContent();
}

guard = 0;
while (guard++ < 600) {
  const screen = await activeScreen();
  if (screen === "screen-end") break;
  if (screen === "screen-dialogue") {
    const choice = page.locator("#vn-choices .choice-btn").first();
    if (await choice.count()) await choice.click();
    else await page.click("#vn-click-layer");
    await page.waitForTimeout(15);
    continue;
  }
  if (screen === "screen-tournament") {
    const title = await tnStep();
    if (title.includes("テーマ選択")) {
      await page.locator(".spot-btn", { hasText: "フルーティ" }).click();
    } else if (title.includes("ミックス")) {
      // ブルーベリー8g + バニラ4g（fruit + sweet でテーマ一致）
      const rows = page.locator(".mix-row");
      const plusOf = (name) => rows.filter({ hasText: name }).locator("button", { hasText: "＋" });
      for (let i = 0; i < 8; i++) await plusOf("ブルーベリー").click();
      for (let i = 0; i < 4; i++) await plusOf("バニラ").click();
      await page.locator("button", { hasText: "この配合でいく" }).click();
    } else if (title.includes("パッキング")) {
      await page.locator(".spot-btn", { hasText: "ノーマル" }).click();
    } else if (title.includes("炭の配置")) {
      await page.locator(".spot-btn", { hasText: "トライアングル" }).click();
    } else if (title.includes("蒸らし時間")) {
      await page.locator(".spot-btn", { hasText: "8分" }).click();
    } else if (title.includes("引き")) {
      await page.waitForTimeout(300);
      await page.click("#tn-gauge-stop");
      await page.waitForTimeout(50);
      await page.locator("button", { hasText: "提供する" }).click();
    } else if (title.includes("プレゼン")) {
      await page.locator(".spot-btn", { hasText: "味で語る" }).click();
    } else if (title.includes("審査結果")) {
      const rows = await page.locator(".result-row").allTextContents();
      log("result:", rows.join(" / "));
      await page.locator("#tn-body .primary-btn").click();
    }
    await page.waitForTimeout(40);
    continue;
  }
  await page.waitForTimeout(50);
}

const endTitle = await page.locator("#end-title").textContent();
log("end screen:", endTitle);
if (!endTitle.includes("第1章クリア")) throw new Error("expected clear, got: " + endTitle);

// ステータス画面の確認
await page.click("#btn-status");
const statusText = await page.locator("#status-body").textContent();
if (!statusText.includes("技術") || !statusText.includes("★")) throw new Error("status screen broken");
log("status screen OK");

if (errors.length) {
  console.error("PAGE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
log("PLAYTHROUGH PASSED ✅");
await browser.close();
