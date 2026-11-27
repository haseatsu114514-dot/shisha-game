// 砂丘の遊び方の6枚を、実際の滑走の画面から撮る（DSR101・2026-11-27 オーナー「操作の見本は生成というよりはスクショを使いたい　実際の画面の」）。
// 上手なボットに走らせ、各アクションの瞬間に止めて、画面（HUD も含む実際の表示）の人物のまわりを 3:2 で切り出す。
//
// 使い方（リポジトリの直下で。プレビューを python3 remake/tools/serve_preview.py --port 8123 で起動しておく）:
//   NODE_PATH=$(npm root -g) node asset_sources/ui/minigame-visuals-20261127/desert/howto-screenshots/capture.mjs <出力先のフォルダ>
// 出力: how_dodge.png … how_flow.png（1440×960）。ゲーム用は 768×512 の WebP に縮めて remake/img/ui/desert_ride_howto/ へ置く。
import { createRequire } from "node:module";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = (process.argv[2] || "howto-shots").replace(/\/?$/, "/");
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.DESERT_URL || "http://127.0.0.1:8123/remake/desert-ride.html";
// 切り出す範囲（舞台 1280×720 の上で）。大ジャンプとスピンは人物が高いので上へ寄せる
// 左上の得点の札（右端 275）と右上の速さの札（左端 1000）が入らない幅にしてある
const CLIP = { low: { x: 280, y: 205, width: 720, height: 480 }, high: { x: 280, y: 115, width: 720, height: 480 } };
const SHOTS = {
  // よける: 岩がすぐ先に見えていて、鋭く切っている（カーブの砂の波が残っていない）
  dodge: { clip: "low", when: "g.air <= 0 && g.fallT <= 0 && g.boostT <= 0 && !g.carving && fx.carveShow < 0.05 && Math.abs(g.vx) > 0.7 && g.course.features.some(f => f.kind === 'rock' && f.z > g.z + 4 && f.z < g.z + 26 && Math.abs(f.x - g.x) < 1.6)" },
  jump: { clip: "high", noSpin: true, when: "g.air > 0 && g.airKind === 'big' && !g.spinDir && Math.abs(g.rot) < 0.02 && (1 - g.air / g.airTotal) > 0.2 && (1 - g.air / g.airTotal) < 0.32" },
  spin: { clip: "high", when: "g.air > 0 && g.airKind === 'big' && g.spinDir !== 0 && Math.abs(g.rot) > 0.42 && Math.abs(g.rot) < 0.6 && fx.grains > 6" },
  boost: { clip: "low", when: "g.boostT > 0 && g.air <= 0 && boostAge > 0.14 && boostAge < 0.34 && !g.carving" },
  carve: { clip: "low", when: "g.carving && fx.carveHeat > 0.9 && g.air <= 0 && g.boostT <= 0" },
  // 砂流れ: 帯は人物の真下に来ると体に隠れるので、この1枚だけ、帯の入口の手前で人物を帯の横へ置いて撮る（stage）。描いているのは実際の画面のまま
  flow: { clip: "low", stage: true, when: "g.air <= 0 && g.boostT <= 0 && !g.carving && fx.carveShow < 0.05 && (g.landedAt == null || g.t - g.landedAt > 1) && (g.course.flows || []).some(f => f.z - g.z > 5 && f.z - g.z < 9)" },
};
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
page.on("pageerror", error => console.log("pageerror", error.message));
const only = process.env.ONLY ? process.env.ONLY.split(",") : null; // 撮り直す札だけを指定できる（ONLY=dodge,flow）
if (only) for (const name of Object.keys(SHOTS)) if (!only.includes(name)) delete SHOTS[name];
const got = new Set();
for (const course of ["switchback", "left-bowl", "right-crest", "ridge", "switchback", "left-bowl"]) {
  if (got.size === Object.keys(SHOTS).length) break;
  await page.goto(`${BASE}?course=${course}`, { waitUntil: "load" });
  await page.locator('[data-test="desert-page-start"]').click();
  await page.locator('[data-test="desert-start"]').click();
  await page.waitForFunction(() => window.__desertRide?.mode === "run" && window.__desertRide.game, null, { timeout: 60000 });
  await page.evaluate(() => { const r = window.__desertRide; r.skipCountdown(); r.autoplay("expert"); window.__boostFrom = null; });
  const started = Date.now();
  while (Date.now() - started < 150000 && got.size < Object.keys(SHOTS).length) {
    const wanted = Object.entries(SHOTS).filter(([name]) => !got.has(name)).map(([name, shot]) => [name, shot.when, !!shot.noSpin]);
    const hit = await page.evaluate(wanted => {
      const r = window.__desertRide, g = r.game;
      if (!g || g.finished || r.mode !== "run") return "finished";
      if (g.boostT > 0) window.__boostFrom ??= g.t; else window.__boostFrom = null;
      const boostAge = window.__boostFrom == null ? 0 : g.t - window.__boostFrom, fx = r.fx;
      // 大ジャンプの札: 踏み切った直後にボットを外して、回らずに跳ぶ（撮ったら戻す）
      if (wanted.some(([, , noSpin]) => noSpin) && g.air > 0 && g.airKind === "big" && (1 - g.air / g.airTotal) < 0.06) { r.autoplay(null); r.setInput(false, false); window.__botOff = true; }
      for (const [name, when] of wanted) {
        if (new Function("g", "fx", "boostAge", `return (${when});`)(g, fx, boostAge)) { r.pause(true); return name; }
      }
      if (window.__botOff && g.air <= 0) { r.autoplay("expert"); window.__botOff = false; }
      return null;
    }, wanted);
    if (hit === "finished") break;
    if (!hit) { await page.waitForTimeout(8); continue; }
    if (SHOTS[hit].stage) await page.evaluate(() => {
      const r = window.__desertRide, g = r.game, flow = g.course.flows.find(f => f.z - g.z > 5 && f.z - g.z < 9);
      r.autoplay(null); r.setInput(false, false);
      g.x = flow.x + (flow.x > 0 ? -1.35 : 1.35); g.vx = 0;
      r.advance(0.35); g.x = flow.x + (flow.x > 0 ? -1.35 : 1.35); g.vx = 0; r.redraw();
    });
    if (SHOTS[hit].stage) { await page.waitForTimeout(1500); await page.evaluate(() => window.__desertRide.redraw()); } // 直前の得点の字・光の粒が消えるのを待つ
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${out}how_${hit}.png`, clip: CLIP[SHOTS[hit].clip] });
    got.add(hit);
    console.log("shot", hit, "on", course);
    await page.evaluate(() => { const r = window.__desertRide; r.autoplay("expert"); window.__botOff = false; r.pause(false); });
  }
}
console.log("missing:", Object.keys(SHOTS).filter(name => !got.has(name)));
await browser.close();
