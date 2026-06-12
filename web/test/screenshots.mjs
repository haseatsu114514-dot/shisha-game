// スクリーンショット撮影 + 敗北→再挑戦ルートの確認
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

import { playTnStep } from "./steps.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const OUT = process.env.OUT_DIR || "/tmp/shots";
const log = (...a) => console.log("[shot]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");
await page.screenshot({ path: `${OUT}/01_title.png` });

await page.click("#btn-new");
for (let i = 0; i < 6; i++) { await page.click("#vn-click-layer"); await page.waitForTimeout(60); }
await page.screenshot({ path: `${OUT}/02_opening.png` });

// 選択肢が出るところまで進める
for (let i = 0; i < 200; i++) {
  if (await page.locator("#vn-choices .choice-btn").count()) break;
  await page.click("#vn-click-layer");
  await page.waitForTimeout(20);
}
await page.screenshot({ path: `${OUT}/03_choice.png` });

// マップまで進める（途中のチュートリアル・シーシャ作りも通す）
async function active() { return page.evaluate(() => document.querySelector(".screen.active")?.id); }
let tutorialShot = false;
for (let i = 0; i < 2000; i++) {
  const s = await active();
  if (s === "screen-map") break;
  if (s === "screen-tournament") {
    if (!tutorialShot) {
      tutorialShot = true;
      await page.screenshot({ path: `${OUT}/03b_tutorial.png` });
    }
    await playTnStep(page);
    continue;
  }
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) await c.click(); else await page.click("#vn-click-layer");
  await page.waitForTimeout(15);
}
await page.screenshot({ path: `${OUT}/04_map.png` });

// 練習画面（ドリル選択 → 本番と同じミニゲーム）
await page.locator(".spot-btn", { hasText: "シーシャの練習" }).click();
await page.waitForSelector("#practice-menu .spot-btn");
await page.screenshot({ path: `${OUT}/05_practice_menu.png` });
await page.locator("#practice-menu .spot-btn").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05b_practice_drill.png` });

// ステータス画面
await page.click("#btn-status");
await page.waitForTimeout(100);
await page.screenshot({ path: `${OUT}/06_status.png` });
await page.click("#status-close");

// 敗北ルート確認: 大会に低ステータスで突入する
await page.evaluate(() => {
  state.day = 7;
  state.ap = 0;
  state.flags._ev_day7 = true;
  state.stats = { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 };
  startTournament();
});
for (let i = 0; i < 2500; i++) {
  const s = await active();
  if (s === "screen-tournament") break;
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) await c.click(); else await page.click("#vn-click-layer");
  await page.waitForTimeout(15);
}
await page.screenshot({ path: `${OUT}/07_tournament_theme.png` });

// わざと噛み合わない選択をして敗北させる
async function title() { return page.locator("#tn-title").textContent(); }
for (let i = 0; i < 2500; i++) {
  const s = await active();
  if (s === "screen-end") break;
  if (s === "screen-dialogue") {
    const c = page.locator("#vn-choices .choice-btn").first();
    if (await c.count()) await c.click(); else await page.click("#vn-click-layer");
    await page.waitForTimeout(12);
    continue;
  }
  if (s === "screen-tournament") {
    const t = await title();
    if (t.includes("機材選択")) {
      if (t.includes("ボウル")) await page.screenshot({ path: `${OUT}/07b_setup.png` });
      await page.locator("#tn-body .spot-btn:not([disabled])").first().click();
    }
    else if (t.includes("アルミ穴あけ")) {
      await page.screenshot({ path: `${OUT}/08b_foil.png` });
      for (let k = 0; k < 6; k++) await page.locator("#tn-body button", { hasText: "穴を開ける" }).click();
      await page.locator("#tn-body button", { hasText: "次へ" }).click();
    }
    else if (t.includes("炭起こし")) {
      await page.locator("#tn-body button", { hasText: "乗せる" }).click();
      await page.locator("#tn-body button", { hasText: "次へ" }).click();
    }
    else if (t.includes("集中")) {
      // わざと雑念を払わない（敗北ルート用）
      let shot = false;
      for (let k = 0; k < 90; k++) {
        if (!shot && (await page.locator(".focus-word").count())) {
          await page.screenshot({ path: `${OUT}/08c_focus.png` });
          shot = true;
        }
        const fin = page.locator("#tn-body button", { hasText: "仕上げに入る" });
        if (await fin.count()) { await fin.click(); break; }
        await page.waitForTimeout(200);
      }
    }
    else if (t.includes("炭替え・調整")) await page.locator(".spot-btn", { hasText: "このままでいく" }).click();
    else if (t.includes("テーマ選択")) await page.locator(".spot-btn", { hasText: "高火力" }).click();
    else if (t.includes("ミックス")) {
      const plusOf = (name) => page.locator(".mix-row", { hasText: name }).locator("button", { hasText: "＋" });
      for (let k = 0; k < 2; k++) await plusOf("ミント").click();
      for (let k = 0; k < 10; k++) await plusOf("バニラ").click();
      await page.screenshot({ path: `${OUT}/08_mix.png` });
      await page.locator("#tn-body button", { hasText: "この配合でいく" }).click();
    } else if (t.includes("パッキング")) await page.locator(".spot-btn", { hasText: "ふんわり" }).click();
    else if (t.includes("炭の配置")) await page.locator(".spot-btn", { hasText: "炭4個" }).click();
    else if (t.includes("蒸らし時間")) await page.locator(".spot-btn", { hasText: "せっかち" }).click();
    else if (t.includes("蒸らし中")) {
      // 弾幕はわざと避けない（敗北ルート用）。1枚だけスクショを残す
      let shot = false;
      for (let k = 0; k < 200; k++) {
        if (!shot && (await page.locator(".dodge-bullet").count())) {
          await page.screenshot({ path: `${OUT}/08d_dodge.png` });
          shot = true;
        }
        const next = page.locator("#tn-body button", { hasText: "次へ" });
        if (await next.count()) { await next.click(); break; }
        await page.waitForTimeout(150);
      }
    }
    else if (t.includes("吸い出し")) {
      // 敗北ルート: 温度を合わせず、最低回数だけ吸ってすぐ出す
      await page.locator("#tn-pull-go").click();
      await page.waitForTimeout(120);
      await page.locator("#tn-pull-go").click();
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${OUT}/08e_pull.png` });
      await page.locator("#tn-pull-serve").click();
      await page.waitForTimeout(60);
      await page.locator("#tn-body button", { hasText: "次へ" }).click();
    }
    else if (t.includes("審査結果")) {
      await page.screenshot({ path: `${OUT}/09_result.png` });
      await page.locator("#tn-body .primary-btn").click();
    }
    else if (await page.locator("#tn-body .primary-btn:not([disabled])").count()) {
      // 中間発表など、ボタンひとつのパネル
      await page.locator("#tn-body .primary-btn:not([disabled])").first().click();
    }
    await page.waitForTimeout(30);
    continue;
  }
  await page.waitForTimeout(40);
}
const endTitle = await page.locator("#end-title").textContent();
log("end:", endTitle);
await page.screenshot({ path: `${OUT}/10_end.png` });
if (!endTitle.includes("敗北")) throw new Error("expected defeat, got " + endTitle);

// 再挑戦でテーマ選択に戻ること
await page.locator("#screen-end button", { hasText: "もう一度挑戦する" }).click();
await page.waitForTimeout(100);
const t2 = await page.locator("#tn-title").textContent();
if (!t2.includes("機材選択")) throw new Error("retry did not restart tournament");
log("defeat → retry OK");

if (errors.length) { console.error("ERRORS:\n" + errors.join("\n")); process.exit(1); }
log("DONE ✅");
await browser.close();
