// 飛行機の機窓（#2688 A4・Issue #2733）。電車・新幹線と同じ器で、往路/復路の行先表示・入力の遮蔽・
// 覆っている間の背景替え・後片付け・保存不変、SKIP の短い版、動きを減らす設定のフェード、高速送りの省略を確認する。
// CHROME_EXECUTABLE_PATH=... SHOTS=/tmp/flight node remake/test/flight_motion_2733.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];

async function open(name, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]', { timeout: 60000 });
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const motions = await import("./js/core/scene-motions.js");
    const transitions = await import("./js/core/transitions.js");
    window.T = { core, ui, data, motions, transitions };
    document.getElementById("screen").replaceChildren();
    await ui.setBg(data.bgUrl("bg_tonari_inside", "day"), { instant: true });
    window.keys = 0;
    window.addEventListener("keydown", (e) => { if (e.key === "Enter") window.keys++; });
  });
  return { page, context };
}

async function ride(page, options, mode) {
  return page.evaluate(([options, mode]) => {
    if (mode === "skip") document.body.classList.add("vn-skip");
    if (mode === "turbo") window.__remake.vnTest.turbo = true;
    window.flt = { mid: 0, opacity: null, covering: null, fades: [], done: false, before: JSON.stringify(T.core.state), start: performance.now() };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, timing) {
      if (this.matches(".mo-flight")) flt.fades.push({ from: frames[0].opacity, to: frames.at(-1).opacity, duration: timing.duration });
      return animate.call(this, frames, timing);
    };
    window.fltRun = T.motions.flightRide(async () => {
      flt.mid++;
      const node = document.querySelector(".mo-flight");
      flt.opacity = node ? Number(getComputedStyle(node).opacity) : null;
      flt.covering = T.transitions.isCovering();
      flt.mode = node?.dataset.mode ?? null;
      await T.ui.setBg(T.data.bgUrl("bg_dubai_airport_day"), { instant: true });
    }, options).then(() => {
      flt.elapsed = performance.now() - flt.start;
      flt.unchanged = flt.before === JSON.stringify(T.core.state);
      flt.done = true;
    });
  }, [options, mode]);
}

const cases = [
  ["outbound", { from: "home", to: "dubai" }, "FLIGHT ▶ ドバイ"],
  ["inbound", { from: "dubai", to: "home" }, "FLIGHT ▶ 地元"],
];
try {
  for (const [name, options, label] of cases) {
    const { page, context } = await open(`flight-${name}`);
    try {
      await ride(page, options, "full");
      await page.waitForFunction(() => window.flt.opacity === 1);
      await page.waitForTimeout(1200); // 夜→朝焼けの途中
      await page.keyboard.press("Enter");
      const visible = await page.evaluate(() => ({
        sign: document.querySelector(".mo-flight text")?.textContent,
        mode: document.querySelector(".mo-flight")?.dataset.mode,
        backdrop: document.querySelector(".mo-flight .mo-back").style.backgroundColor,
        keys: window.keys,
      }));
      assert.deepEqual(visible, { sign: label, mode: "full", backdrop: "rgb(21, 14, 48)", keys: 0 });
      if (shots) await page.screenshot({ path: `${shots}/flight-${name}-mid.png` });
      await page.waitForTimeout(700); // 地平線が昇ったあと（幕が開く前）
      if (shots) await page.screenshot({ path: `${shots}/flight-${name}-horizon.png` });
      await page.waitForFunction(() => flt.done, null, { timeout: 8000 });
      const result = await page.evaluate(() => ({ ...flt,
        overlays: document.querySelectorAll(".mo-flight").length, coveringAfter: T.transitions.isCovering() }));
      assert.equal(result.mid, 1); assert.equal(result.opacity, 1); assert.equal(result.covering, true);
      assert.equal(result.unchanged, true); assert.equal(result.overlays, 0); assert.equal(result.coveringAfter, false);
      assert.deepEqual(result.fades.map(f => [f.from, f.to, f.duration]), [[0, 1, 280], [1, 0, 320]]);
      assert(result.elapsed > 2600 && result.elapsed < 6000, `${name}: ${result.elapsed}ms は約2.8秒ではない`);
      await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => window.keys), 1);
      console.log(`PASS flight ${name}: ${Math.round(result.elapsed)}ms, sign/fade/cover/cleanup/save`);
    } finally { await context.close(); }
  }
  // SKIP 中は短い版、動きを減らす設定では動かない窓のフェードだけ、高速送りでは省く。どれも mid は1回。
  // 長さはフェードの指定値で厳密に見る。経過時間の上限は混んだ端末でも誤って落ちないよう緩めにする。
  const expected = {
    skip: { mode: "brief", fades: [[0, 1, 160], [1, 0, 200]], max: 3500 },
    reduced: { mode: "still", fades: [[0, 1, 220], [1, 0, 300]], max: 3000 },
    turbo: { mode: null, fades: [], max: 1500 },
  };
  for (const [mode, want] of Object.entries(expected)) {
    const { page, context } = await open(`flight-${mode}`, mode === "reduced" ? "reduce" : "no-preference");
    try {
      await ride(page, { from: "home", to: "dubai" }, mode);
      await page.waitForFunction(() => flt.done, null, { timeout: 8000 });
      const result = await page.evaluate(() => ({ ...flt, overlays: document.querySelectorAll(".mo-flight").length, coveringAfter: T.transitions.isCovering() }));
      assert.equal(result.mid, 1); assert.equal(result.mode, want.mode);
      assert.deepEqual(result.fades.map(f => [f.from, f.to, f.duration]), want.fades);
      assert.equal(result.overlays, 0); assert.equal(result.coveringAfter, false); assert.equal(result.unchanged, true);
      assert(result.elapsed < want.max, `${mode}: ${result.elapsed}ms`);
      console.log(`PASS flight ${mode}: ${Math.round(result.elapsed)}ms`);
    } finally { await context.close(); }
  }
  // mid が失敗しても幕と入力の遮蔽を残さない。
  {
    const { page, context } = await open("flight-exception");
    try {
      const result = await page.evaluate(async () => {
        let mid = 0, rejected = false;
        try { await T.motions.flightRide(() => { mid++; throw Error("expected flight failure"); }, { to: "dubai" }); }
        catch (e) { if (e.message !== "expected flight failure") throw e; rejected = true; }
        return { mid, rejected, overlays: document.querySelectorAll(".mo-flight").length, covering: T.transitions.isCovering() };
      });
      assert.deepEqual(result, { mid: 1, rejected: true, overlays: 0, covering: false });
      console.log("PASS flight exception");
    } finally { await context.close(); }
  }
  // 緑を使わない（#2688 の基準）。描いた色の色相が緑（約80〜170度）に入らない。
  {
    const { page, context } = await open("flight-colors");
    try {
      const greens = await page.evaluate(async () => {
        const run = T.motions.flightRide(() => {}, { to: "dubai" });
        await new Promise(r => setTimeout(r, 400));
        const colors = new Set();
        for (const n of document.querySelectorAll(".mo-flight *")) for (const a of ["fill", "stroke", "stop-color"]) {
          const v = n.getAttribute(a); if (v && v.startsWith("#")) colors.add(v);
        }
        await run;
        const hue = (hex) => {
          const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
          const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
          if (d < 0.08) return null; // ほぼ無彩色
          const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
          return (h * 60 + 360) % 360;
        };
        return [...colors].filter(c => { const h = hue(c); return h !== null && h > 80 && h < 170; });
      });
      assert.deepEqual(greens, []);
      console.log("PASS flight colors: no green");
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  console.log("PASS flight_motion_2733");
} finally { await browser.close(); }
