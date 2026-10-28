// 凛の腰・中央配置修正の回帰。manifest の数値だけでなく、実際に描画した
// WebP の頭部中心と画面中央、全5表情の配置枠と見切れをPC／スマホで確認する。
import { createRequire } from "module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();
const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const SHOTS = process.env.SHOTS;
const faces = ["normal", "smile", "serious", "surprise", "sad"];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
});
const errors = [], records = [];
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 591, height: 1280 }]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (r.status() >= 400) errors.push(r.status() + " " + r.url()); });
    await page.goto(BASE);
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async faces => {
      const source = await (await fetch(new URL("../data/dialogue/lover_events.json", location.href))).json();
      function find(node) {
        if (node && typeof node === "object") {
          if (node.dialogue_id === "lover_rin_lv3") return node;
          for (const value of Object.values(node)) { const found = find(value); if (found) return found; }
        }
      }
      const scene = find(source);
      if (!scene) throw Error("Rin scene missing");
      const state = await import(new URL("js/core/state.js", location.href));
      const vn = await import(new URL("js/vn/engine.js", location.href));
      state.newGame(); state.state.met.rin = true; vn.vnTest.turbo = false;
      window.__rinPortraitTest = vn.play({
        dialogue_id: "__rin_portrait_test", metadata: scene.metadata,
        lines: faces.map(face => ({ ...scene.lines.find((l) => l.speaker === "rin"), face })),
      });
    }, faces);
    const frames = [];
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      await page.waitForFunction(face => {
        const im = document.querySelector('#vn img[data-speaker="rin"]');
        return im && im.src.endsWith("chr_rin_" + face + ".webp") && im.complete && im.naturalWidth > 0;
      }, face);
      await page.waitForTimeout(1300);
      const m = await page.evaluate(() => {
        const im = document.querySelector('#vn img[data-speaker="rin"]');
        const b = im.getBoundingClientRect(), s = document.querySelector("#stage").getBoundingClientRect();
        const canvas = document.createElement("canvas");
        const w = canvas.width = im.naturalWidth, h = canvas.height = im.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(im, 0, 0);
        const pixels = ctx.getImageData(0, 0, w, h).data;
        let top = h, bottom = 0, edges = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (pixels[(y * w + x) * 4 + 3] < 24) continue;
          top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
          if (!x || x === w - 1 || !y || y === h - 1) edges++;
        }
        let sum = 0, count = 0;
        for (let y = top; y < top + Math.floor((bottom - top) * .2); y++)
          for (let x = 0; x < w; x++) if (pixels[(y * w + x) * 4 + 3] >= 24) { sum += x; count++; }
        const offset = b.left + sum / count * b.width / w - (s.left + s.width / 2);
        return {
          width: w, height: h, position: im.dataset.pos, frame: b.toJSON(), edges,
          offset, fraction: offset / s.width, headTop: b.top + top * b.height / h, stageTop: s.top,
        };
      });
      if (m.width !== 896 || m.height !== 1200 || m.position !== "center" || m.edges ||
          !Number.isFinite(m.offset) || Math.abs(m.fraction) > .015 || m.headTop < m.stageTop - .5)
        throw Error("Rin portrait alignment/clipping: " + JSON.stringify({ face, viewport, ...m }));
      frames.push(JSON.stringify(m.frame));
      records.push({ viewport: viewport.width, face, offsetPx: Number(m.offset.toFixed(2)) });
      if (SHOTS) await page.screenshot({ path: SHOTS + "/rin-" + viewport.width + "-" + face + ".png" });
      if (i < faces.length - 1) {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(150);
        const src = await page.locator('#vn img[data-speaker="rin"]').getAttribute("src");
        if (!src.endsWith("chr_rin_" + faces[i + 1] + ".webp")) await page.keyboard.press("Enter");
      }
    }
    if (new Set(frames).size !== 1) throw Error("Rin frame moves between expressions");
    await page.close();
  }
  if (errors.length) throw Error(JSON.stringify(errors));
  console.log("rin_portraits: all green — 5 expressions × PC/phone, centered, stable, no clipping");
  console.log(JSON.stringify(records));
} finally {
  await browser.close();
}
