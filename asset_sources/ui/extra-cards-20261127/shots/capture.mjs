// タイトルの EXTRA の選ぶ画面（EXT05）に出す、ミニゲームの実際の画面を撮る（DJ・ラクダ・ボドゲカフェ）。1280×720・2倍で撮る。
// 斧投げと砂丘は、遊び方の写真（remake/img/ui/axe_throw/howto/・desert_ride_howto/。実際の画面から撮ったもの）をそのまま使う。
// 使い方（リポジトリの直下で。プレビューを python3 remake/tools/serve_preview.py --port 8123 で起動しておく。DJ の SET 1 の2曲・
// remake/img/ui/dj・camel_race・trpg の画像が要る）:
//   node asset_sources/ui/extra-cards-20261127/shots/capture.mjs <出力先のフォルダ> [dj,camel,trpg]
// 撮った中から3枚ずつ選び、1280×720 の WebP（quality 80）に縮めて remake/img/ui/extra/shots/<遊び>-<1〜3>.webp へ置く。
// 採用: dj-2・dj-3・dj-4 → dj-1〜3、camel-1〜3、trpg-1（本棚）・trpg-roll の1枚目（ダイス）と2枚目（成功の演出） → trpg-1〜3
import { createRequire } from "node:module";
import fs from "node:fs";
import { turnToTrpgBook, startTrpgStory } from "../../../../remake/test/browser/trpg_start.mjs";
const { chromium } = createRequire(new URL("../../../../remake/", import.meta.url))("playwright");
const OUT = process.argv[2] || "extra-shots";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://127.0.0.1:8123/remake/";
const only = (process.argv[3] || "dj,camel,trpg").split(",");
const browser = await chromium.launch();
const newPage = async () => { const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage(); p.on("pageerror", e => console.log("pageerror", e.message)); return p; };

if (only.includes("dj")) {
  const p = await newPage();
  await p.goto(`${BASE}previews/dj/index.html?set=1&mute=1`); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/dj-1.png` });
  await p.click("#play-a");
  for (const i of [2, 3, 4, 5, 6]) { await p.waitForTimeout(4000); await p.screenshot({ path: `${OUT}/dj-${i}.png` });
    if (i === 3) await p.click("#play-b").catch(() => {}); }
  await p.context().close();
}
if (only.includes("camel")) {
  const p = await newPage();
  await p.goto(`${BASE}camel-race.html`); await p.locator('[data-test="camel-menu-demo"]').click();
  for (const [i, ms] of [[1, 4500], [2, 5000], [3, 6000]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/camel-${i}.png` }); }
  await p.context().close();
}
if (only.includes("trpg")) {
  const p = await newPage();
  const hit = async (id) => { await p.locator(`[data-test="${id}"]`).first().click(); };
  const lines = async () => { for (let i = 0; i < 40 && await p.locator('[data-test="trpg-next"]').isVisible(); i++) await hit("trpg-next"); };
  await p.goto(`${BASE}index.html?trial=trpg`);
  await p.locator('[data-test="trpg-campaign-notice"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/trpg-1.png` });
  const play = p.locator('[data-test^="trpg-play-"]:not([disabled])').first();
  const id = await play.getAttribute("data-test");
  await turnToTrpgBook(p, play);
  await hit(id);
  await p.locator(".trpg-root.trpg-cinematic").waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/trpg-2.png` });
  await lines(); await startTrpgStory(p); await lines();
  const card = p.locator('[data-test^="trpg-approach-"]').first();
  if (await card.count() && await card.isVisible()) { await card.click(); await lines(); }
  await p.locator('[data-test="trpg-roll"]').waitFor({ timeout: 20000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/trpg-3.png` });
  await hit("trpg-roll");
  for (const ms of [700, 600, 700]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/trpg-roll-${ms}-${Date.now() % 1000}.png` }); }
  console.log("trpg book", id);
  await p.context().close();
}
await browser.close();
