// 6人34表情を実際の会話画面で切り替える。PC／スマホでWebPの読み込み、
// 頭の見切れ、画像端の欠け、表情変更時の配置枠の移動を確認する。
// CHROME_BIN=/usr/bin/chromium SHOTS=/tmp/portrait-qa node remake/test/portrait_unify.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const SHOTS = process.env.SHOTS;
const characters = {
  tsumugi: ["normal", "smile", "serious", "surprise", "sad", "evil", "bow"],
  kafuka: ["normal", "smile", "serious", "surprise", "excited", "ventriloquism"],
  maezono: ["normal", "smile", "serious", "surprise", "excited"],
  sumi: ["normal", "smile", "serious", "surprise", "thinking"],
  mashiro: ["normal", "smile", "serious", "surprise", "sad", "sleep"],
  nagumo: ["normal", "smile", "serious", "surprise", "thinking"],
};
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
});
const errors = [], records = [];
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 591, height: 1280 }]) {
    for (const [character, faces] of Object.entries(characters)) {
      const page = await browser.newPage({ viewport });
      page.on("pageerror", e => errors.push(e.message));
      page.on("response", r => { if (r.status() >= 400) errors.push(r.status() + " " + r.url()); });
      await page.goto(BASE);
      await page.waitForSelector('[data-test="title-new"]');
      await page.evaluate(async ({ character, faces }) => {
        const state = await import(new URL("js/core/state.js", location.href));
        const vn = await import(new URL("js/vn/engine.js", location.href));
        state.newGame(); state.state.met[character] = true; vn.vnTest.turbo = false;
        window.__portraitUnifyTest = vn.play({
          dialogue_id: "__portrait_unify_test",
          metadata: { bg: "bg_tonari_inside" },
          lines: faces.map(face => ({ speaker: character, face, text: "確認。" })),
        });
      }, { character, faces });
      const frames = [];
      for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        await page.waitForFunction(({ character, face }) => {
          const im = document.querySelector('#vn img[data-speaker="' + character + '"]');
          return im && im.src.endsWith("chr_" + character + "_" + face + ".webp") &&
            im.complete && im.naturalWidth > 0;
        }, { character, face });
        await page.waitForTimeout(1300);
        const measurement = await page.evaluate(character => {
          const im = document.querySelector('#vn img[data-speaker="' + character + '"]');
          const frame = im.getBoundingClientRect(), stage = document.querySelector("#stage").getBoundingClientRect();
          const canvas = document.createElement("canvas");
          const width = canvas.width = im.naturalWidth, height = canvas.height = im.naturalHeight;
          const ctx = canvas.getContext("2d"); ctx.drawImage(im, 0, 0);
          const pixels = ctx.getImageData(0, 0, width, height).data;
          let top = height, bottom = 0, edges = 0;
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (pixels[(y * width + x) * 4 + 3] < 24) continue;
            top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
            if (!x || x === width - 1 || !y || y === height - 1) edges++;
          }
          return { width, height, position: im.dataset.pos, frame: frame.toJSON(), edges,
            headTop: frame.top + top * frame.height / height, stageTop: stage.top,
            figureHeight: bottom - top };
        }, character);
        if (measurement.width !== 896 || measurement.height !== 1200 ||
            measurement.position !== "center" || measurement.edges || !measurement.figureHeight ||
            measurement.headTop < measurement.stageTop - .5)
          throw Error("Portrait clipping/loading: " + JSON.stringify({ character, face, viewport, ...measurement }));
        frames.push(JSON.stringify(measurement.frame));
        records.push({ viewport, character, face, ...measurement });
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${character}-${viewport.width}-${face}.png` });
        if (i < faces.length - 1) {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(150);
          const src = await page.locator('#vn img[data-speaker="' + character + '"]').getAttribute("src");
          if (!src.endsWith("chr_" + character + "_" + faces[i + 1] + ".webp")) await page.keyboard.press("Enter");
        }
      }
      if (new Set(frames).size !== 1) throw Error("Portrait frame moves between expressions: " + character);
      console.log(`${character}: ${faces.length} expressions passed at ${viewport.width}px`);
      await page.close();
    }
  }
  if (errors.length) throw Error(JSON.stringify(errors));
  if (SHOTS) fs.writeFileSync(SHOTS + "/measurements.json", JSON.stringify(records, null, 2) + "\n");
  console.log("portrait_unify: all green — 34 expressions × PC/phone, stable frames, no clipping or missing images");
} finally { await browser.close(); }
