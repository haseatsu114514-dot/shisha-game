// マップピンのホバー回帰テスト: ピンがカーソルから「逃げ」たらFAIL（2026-06-12のバグ）
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

// チュートリアルを飛ばして即マップへ
await page.evaluate(() => {
  state = newState();
  state.flags._tutorial_done = true;
  state.flags._map_tutorial_done = true; // 初回マップ案内の点滅(#36)を出さない＝ホバー静止の純粋確認
  showMap();
});
await page.waitForSelector("#screen-map.active");
await page.waitForTimeout(300);

const mapBox0 = await page.locator("#map-image").boundingBox();
const pins = page.locator(".spot-pin:not([disabled])");
const n = await pins.count();
console.log("pins:", n, "map:", JSON.stringify(mapBox0));

for (let i = 0; i < n; i++) {
  const pin = pins.nth(i);
  const label = (await pin.textContent())?.trim().slice(0, 12);
  const b0 = await pin.boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.waitForTimeout(120);
  // ホバー静止中に位置が揺れるかを 6 サンプル観測
  let moved = false;
  let prev = await pin.boundingBox();
  for (let s = 0; s < 6; s++) {
    await page.waitForTimeout(80);
    const b = await pin.boundingBox();
    if (Math.abs(b.x - prev.x) > 0.5 || Math.abs(b.y - prev.y) > 0.5 ||
        Math.abs(b.width - prev.width) > 1.5 || Math.abs(b.height - prev.height) > 1.5) moved = true;
    prev = b;
  }
  const mapBox = await page.locator("#map-image").boundingBox();
  const mapMoved = Math.abs(mapBox.x - mapBox0.x) > 0.5 || Math.abs(mapBox.y - mapBox0.y) > 0.5;
  const b1 = await pin.boundingBox();
  const dx = Math.abs(b1.x - b0.x), dy = Math.abs(b1.y - b0.y);
  console.log(`${label}: jitter=${moved} mapMoved=${mapMoved} dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
  if (moved || mapMoved || dx > 4 || dy > 4) { console.error("PIN MOVED ON HOVER ❌"); process.exit(1); }
}

// マップの何もない場所でも確認
await page.mouse.move(640, 600);
await page.waitForTimeout(200);
const mapBox1 = await page.locator("#map-image").boundingBox();
console.log("map after idle hover:", JSON.stringify(mapBox1));
await browser.close();
console.log("MAP HOVER PASSED ✅");
