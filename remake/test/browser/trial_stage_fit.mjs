// 試遊ページの画面の当て方（#3076）: 本編と同じく 1280×720 の固定ステージを
// 画面（craft はナビの下の #viewport）に収まる倍率で拡大縮小し、余白は場面背景のぼかしで埋める。
// 当て方は共通部品 core/stage-fit.js。ワイド拡張（#2861）は使わない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const PAGES = [
  { file: "camel-race.html", ready: '[data-test="camel-menu-quick"]', bg: /bg_dubai_camel_track/ },
  { file: "axe-throw.html", ready: ".axe-menu", bg: /bg_axe_lounge/ },
  { file: "desert-ride.html", ready: '[data-test="desert-page-start"]', bg: /gradient/ },
  { file: "craft-preview.html", ready: null, bg: /url\(/ },
];

function measure() {
  const stage = document.getElementById("stage"), bd = document.getElementById("backdrop");
  const vp = document.getElementById("viewport");
  const sr = stage.getBoundingClientRect(), br = bd.getBoundingClientRect(), vr = vp.getBoundingClientRect();
  const cs = getComputedStyle(bd);
  return {
    wide: stage.hasAttribute("data-wide"),
    stage: { left: sr.left, right: sr.right, top: sr.top, bottom: sr.bottom, width: sr.width, height: sr.height },
    viewport: { left: vr.left, right: vr.right, top: vr.top, bottom: vr.bottom, width: vr.width, height: vr.height },
    backdrop: { left: br.left, right: br.right, top: br.top, bottom: br.bottom },
    backdropBg: cs.backgroundImage, backdropFilter: cs.filter,
    vw: innerWidth, vh: innerHeight,
  };
}

async function openTrial(page, spec) {
  await page.goto(new URL(spec.file, page.url()).href);
  if (spec.ready) await page.locator(spec.ready).waitFor({ timeout: 30000 });
  else await page.waitForFunction(() => document.getElementById("craft-preview-loading")?.hidden === true, null, { timeout: 30000 });
  // craft は場面背景（setBg）が backdrop へ届くまで少し待つ
  await page.waitForFunction(() => getComputedStyle(document.getElementById("backdrop")).backgroundImage !== "none", null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}

function assertFit(m, spec) {
  assert.equal(m.wide, false, "ワイド拡張は使わない");
  const k = Math.min(m.viewport.width / 1280, m.viewport.height / 720);
  assert(Math.abs(m.stage.width - 1280 * k) < 2.5, `ステージ幅 ${m.stage.width} != ${1280 * k} (${spec.file})`);
  assert(Math.abs(m.stage.height - 720 * k) < 2.5, `ステージ高さ ${m.stage.height} != ${720 * k} (${spec.file})`);
  const cx = (m.stage.left + m.stage.right) / 2, vx = (m.viewport.left + m.viewport.right) / 2;
  const cy = (m.stage.top + m.stage.bottom) / 2, vy = (m.viewport.top + m.viewport.bottom) / 2;
  assert(Math.abs(cx - vx) < 2.5, `ステージが左右中央でない (${spec.file})`);
  assert(Math.abs(cy - vy) < 2.5, `ステージが上下中央でない (${spec.file})`);
  assert.match(m.backdropFilter, /blur\(/, `backdrop にぼかしが無い (${spec.file})`);
  assert.match(m.backdropBg, spec.bg, `backdrop の絵が場面と違う (${spec.file}): ${m.backdropBg}`);
  assert(m.backdrop.left <= m.vw - m.vw + 1 && m.backdrop.right >= m.vw - 1 && m.backdrop.top <= 1 && m.backdrop.bottom >= m.vh - 1,
    `backdrop が画面全体を覆っていない (${spec.file}): ${JSON.stringify(m.backdrop)}`);
}

await suite("trial-stage-fit", async check => {
  for (const spec of PAGES) {
    await check(`${spec.file}-pc-1280x720`, async page => {
      await openTrial(page, spec);
      assertFit(await page.evaluate(measure), spec);
    });
    await check(`${spec.file}-phone-932x430`, async page => {
      await openTrial(page, spec);
      const m = await page.evaluate(measure);
      assertFit(m, spec);
      // 大きいスマホ横持ちでは高さに合わせて縮み、左右にぼかしの余白ができる
      assert(Math.abs(m.stage.height - m.viewport.height) < 2.5, JSON.stringify(m.stage));
      assert(m.stage.left > m.viewport.left + 30, `余白ができていない (${spec.file})`);
    }, { viewport: { width: 932, height: 430 }, isMobile: true, hasTouch: true });
  }
});
