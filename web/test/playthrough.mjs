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

import { playTnStep } from "./steps.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[test]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

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
// キャラ訪問でスポットが解禁される順序も兼ねて検証する
const plan = [
  "tonariでバイト", "スミさんと話す",
  "なるの店へ行く", "アダムの店へ行く",
  "みんとの店へ行く", "カフェ",
  "観音堂", "チョイザップ",
  "シーシャの練習", "つむぎと話す",
  "tonariでバイト", "C.STATION",
  "シーシャの練習", "家で休む",
];
let planIdx = 0;
let guard = 0;

async function activeScreen() {
  return page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
}

let tutorialSeen = false;
while (guard++ < 5000) {
  const screen = await activeScreen();
  if (screen === "screen-tournament") {
    const phase = await page.evaluate(() => state.phase);
    if (phase === "tournament") break; // 本番大会へ到達
    // 日常フェーズの tournament 画面＝チュートリアル
    if (!tutorialSeen) { tutorialSeen = true; log("tutorial making started"); }
    await playTnStep(page);
    continue;
  }
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

if (!tutorialSeen) throw new Error("tutorial making was not shown before tournament");
log("tutorial OK");
log("reached tournament, day check:", await page.locator("#hud-day").textContent());

// 検証しやすいようにステータスを底上げ（勝利ルートを確認する）
await page.evaluate(() => {
  state.stats = { technique: 80, sense: 80, guts: 80, charm: 80, insight: 80 };
});

// 大会: 機材 → テーマ → ミックス → パック → 穴あけ → 炭起こし → 配置 →
//       蒸らし → 会話 → 集中 → 引き → プレゼン → 結果
guard = 0;
while (guard++ < 3000) {
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
    await playTnStep(page, { onResult: (rows) => log("result:", rows.join(" / ")) });
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
