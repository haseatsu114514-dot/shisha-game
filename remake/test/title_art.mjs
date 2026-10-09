// タイトルの15枚・実画像の読み込み・一周の切替・失敗時の保持・離脱・低減設定を確認。
// python3 remake/tools/serve_preview.py --port 8123
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/title_art.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const manifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url)));
const daily = manifest.titleArts.filter((name) => name !== "title_art_keyvisual_01.png");
assert.equal(daily.length, 15);
for (const id of ["tsumugi", "mashiro", "minto", "ageha", "rin"])
  assert.equal(daily.filter((name) => name.startsWith(`title_art_${id}_`)).length, 3, id);
for (const name of daily) assert(manifest.webp.includes(`ui/title_arts/${name}`), `${name}: WebP missing`);

const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.waitForFunction(() => document.querySelector(".title-art-image")?.naturalWidth > 0);
  await page.evaluate(async (names) => {
    const { assetUrl } = await import("./js/core/data.js");
    for (const name of names) {
      const image = new Image(); image.src = assetUrl(`assets/ui/title_arts/${name}`);
      await image.decode();
      if (image.naturalWidth !== 1024 || image.naturalHeight !== 1536)
        throw new Error(`${name}: unexpected artwork dimensions`);
    }
  }, daily);
  await page.clock.install();
  await page.evaluate(async () => (await import("./js/scenes/title.js")).showTitle());
  const artwork = () => page.locator(".title-art").getAttribute("data-art");
  const seen = [await artwork()];
  assert.equal(seen[0], "title_art_mashiro_heavy_smoke.png");
  let elapsedAfterSwitch = 0;
  for (let i = 0; i < daily.length - 1; i++) {
    const previous = await artwork();
    await page.clock.runFor(12000 - elapsedAfterSwitch);
    await page.waitForFunction((old) => document.querySelector(".title-art").dataset.art !== old, previous);
    const next = await artwork();
    assert(!seen.includes(next), `Artwork repeated before all 15 were shown: ${next}`);
    seen.push(next);
    assert.equal(await page.locator(".title-art-image.visible").count(), 1);
    assert.equal(await page.locator(".title-art-image.visible").evaluate((image) => image.naturalWidth), 1024);
    if (shots) {
      await page.clock.runFor(1800);
      await page.screenshot({ path: `${shots}/${next.replace(/\.png$/, "")}-desktop.png` });
    }
    elapsedAfterSwitch = shots ? 1800 : 0;
  }
  assert.deepEqual([...seen].sort(), [...daily].sort());
  await page.clock.runFor(1800);
  assert.equal(await page.locator(".title-art-image").count(), 1, "Faded picture should be released");

  // モーダルを読んでいる間は背後を切り替えず、閉じればまた進む。
  await page.locator('[data-test="title-config"]').click();
  const paused = await artwork();
  await page.clock.runFor(24000);
  assert.equal(await artwork(), paused);
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.clock.runFor(12000);
  await page.waitForFunction((old) => document.querySelector(".title-art").dataset.art !== old, paused);

  // 壊れた一枚へ切り替えず、現在の絵を維持する。
  await page.route("**/title_art_missing.png", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.evaluate(async () => {
    const { DB } = await import("./js/core/data.js");
    window.realTitleArts = DB.manifest.titleArts;
    DB.manifest.titleArts = ["title_art_mashiro_heavy_smoke.png", "title_art_missing.png"];
    (await import("./js/scenes/title.js")).showTitle();
  });
  await page.clock.runFor(12000);
  await page.waitForTimeout(100);
  assert.equal(await artwork(), "title_art_mashiro_heavy_smoke.png");
  assert.equal(await page.locator(".title-art-image.visible").evaluate((image) => image.naturalWidth), 1024);

  // 離脱した画面を更新しない。低減設定では一枚を静止表示し、メニューは操作できる。
  await page.evaluate(async () => {
    window.oldTitleArt = document.querySelector(".title-art");
    window.oldArtName = oldTitleArt.dataset.art;
    const { showScreen } = await import("./js/core/ui.js");
    showScreen("test", document.createElement("div"));
  });
  await page.clock.runFor(60000);
  assert(await page.evaluate(() => oldTitleArt.dataset.art === oldArtName && !oldTitleArt.isConnected));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    const { DB } = await import("./js/core/data.js");
    DB.manifest.titleArts = realTitleArts;
    (await import("./js/scenes/title.js")).showTitle();
  });
  const still = await artwork();
  await page.clock.runFor(30000);
  assert.equal(await artwork(), still);
  await page.locator('[data-test="title-gallery"]').click();
  await page.locator('[data-test="gallery-close"]').click();
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    assert(await page.locator('[data-test="title-new"]').isVisible());
    if (shots) await page.screenshot({ path: `${shots}/title-${viewport.width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log("[title art] PASS: 5 heroines × 3 images, decoded WebPs, no repeats/blank switches, modal pause, screen cleanup and reduced motion");
} finally { await browser.close(); }
