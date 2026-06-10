// スクリーンショット撮影 + 敗北→再挑戦ルートの確認
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const OUT = process.env.OUT_DIR || "/tmp/shots";
const log = (...a) => console.log("[shot]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");
await page.screenshot({ path: `${OUT}/01_title.png` });

await page.click("#btn-new");
for (let i = 0; i < 6; i++) { await page.click("#vn-click-layer"); await page.waitForTimeout(60); }
await page.screenshot({ path: `${OUT}/02_opening.png` });

// 選択肢が出るところまで進める
for (let i = 0; i < 80; i++) {
  if (await page.locator("#vn-choices .choice-btn").count()) break;
  await page.click("#vn-click-layer");
  await page.waitForTimeout(20);
}
await page.screenshot({ path: `${OUT}/03_choice.png` });

// マップまで進める
async function active() { return page.evaluate(() => document.querySelector(".screen.active")?.id); }
for (let i = 0; i < 300; i++) {
  if ((await active()) === "screen-map") break;
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) await c.click(); else await page.click("#vn-click-layer");
  await page.waitForTimeout(15);
}
await page.screenshot({ path: `${OUT}/04_map.png` });

// 練習画面
await page.locator(".spot-btn", { hasText: "シーシャの練習" }).click();
await page.waitForSelector("#practice-menu .spot-btn");
await page.locator("#practice-menu .spot-btn").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05_practice_gauge.png` });

// ステータス画面
await page.click("#gauge-stop");
await page.waitForTimeout(100);
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
for (let i = 0; i < 400; i++) {
  const s = await active();
  if (s === "screen-tournament") break;
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) await c.click(); else await page.click("#vn-click-layer");
  await page.waitForTimeout(15);
}
await page.screenshot({ path: `${OUT}/07_tournament_theme.png` });

// わざと噛み合わない選択をして敗北させる
async function title() { return page.locator("#tn-title").textContent(); }
for (let i = 0; i < 400; i++) {
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
    if (t.includes("テーマ選択")) await page.locator(".spot-btn", { hasText: "高火力" }).click();
    else if (t.includes("ミックス")) {
      const plus = page.locator(".mix-row", { hasText: "バニラ" }).locator("button", { hasText: "＋" });
      for (let k = 0; k < 12; k++) await plus.click();
      await page.screenshot({ path: `${OUT}/08_mix.png` });
      await page.locator("button", { hasText: "この配合でいく" }).click();
    } else if (t.includes("パッキング")) await page.locator(".spot-btn", { hasText: "ふんわり" }).click();
    else if (t.includes("炭の配置")) await page.locator(".spot-btn", { hasText: "炭4個" }).click();
    else if (t.includes("蒸らし時間")) await page.locator(".spot-btn", { hasText: "せっかち" }).click();
    else if (t.includes("引き")) {
      await page.waitForTimeout(150);
      await page.click("#tn-gauge-stop");
      await page.waitForTimeout(40);
      await page.locator("button", { hasText: "提供する" }).click();
    } else if (t.includes("プレゼン")) await page.locator(".spot-btn", { hasText: "味で語る" }).click();
    else if (t.includes("審査結果")) {
      await page.screenshot({ path: `${OUT}/09_result.png` });
      await page.locator("#tn-body .primary-btn").click();
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
await page.locator("button", { hasText: "もう一度挑戦する" }).click();
await page.waitForTimeout(100);
const t2 = await page.locator("#tn-title").textContent();
if (!t2.includes("テーマ選択")) throw new Error("retry did not restart tournament");
log("defeat → retry OK");

if (errors.length) { console.error("ERRORS:\n" + errors.join("\n")); process.exit(1); }
log("DONE ✅");
await browser.close();
