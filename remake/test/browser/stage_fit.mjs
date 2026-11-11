// 画面方針（2026-11-09 オーナー決定・#3035）: ブラウザアドベンチャー式。
// ステージは常に 1280×720 の固定構図をそのまま拡大縮小し、画面に余った分は余白として扱う。
// 余白は場面の背景をぼかして埋める（#backdrop）。ワイド拡張（#2861）は廃止した。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

function measure() {
  const stage = document.getElementById("stage"), bd = document.getElementById("backdrop");
  const sr = stage.getBoundingClientRect(), br = bd.getBoundingClientRect();
  const cs = getComputedStyle(bd);
  return {
    wide: stage.hasAttribute("data-wide"),
    stage: { left: sr.left, right: sr.right, top: sr.top, bottom: sr.bottom, width: sr.width, height: sr.height },
    backdrop: { left: br.left, right: br.right, top: br.top, bottom: br.bottom },
    backdropBg: cs.backgroundImage, backdropFilter: cs.filter,
    vw: innerWidth, vh: innerHeight,
  };
}

await suite("stage-fit", async check => {
  await check("ultrawide-fixed-stage", async page => {
    const m = await page.evaluate(measure);
    assert.equal(m.wide, false);
    // 2560×1080: k = 1080/720 = 1.5 → ステージは 1920×1080 で中央、左右に 320px ずつの余白
    assert(Math.abs(m.stage.width - 1920) < 2, JSON.stringify(m.stage));
    assert(Math.abs(m.stage.left - (m.vw - m.stage.right)) < 2, `左右の余白が均等でない: ${JSON.stringify(m.stage)}`);
    // 余白のぼかし: タイトルの背景と同じ絵が入り、blur が掛かり、画面全体を覆う
    assert.match(m.backdropBg, /bg_title/, m.backdropBg);
    assert.match(m.backdropFilter, /blur\(/);
    assert(m.backdrop.left <= 0 && m.backdrop.right >= m.vw && m.backdrop.top <= 0 && m.backdrop.bottom >= m.vh, JSON.stringify(m.backdrop));
  }, { viewport: { width: 2560, height: 1080 } });

  await check("phone-landscape-fixed-stage", async page => {
    const m = await page.evaluate(measure);
    assert.equal(m.wide, false);
    // 844×390: k = 390/720 → ステージは高さに合わせて縮み、左右に均等の余白ができる
    assert(Math.abs(m.stage.height - 390) < 2, JSON.stringify(m.stage));
    assert(Math.abs(m.stage.left - (m.vw - m.stage.right)) < 2, `左右の余白が均等でない: ${JSON.stringify(m.stage)}`);
    assert(m.stage.left > 30, `余白ができていない: ${JSON.stringify(m.stage)}`);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("tall-window-fixed-stage", async page => {
    const m = await page.evaluate(measure);
    assert.equal(m.wide, false);
    // 1280×960: k = 1 → ステージは 1280×720 で中央、上下に 120px ずつの余白
    assert(Math.abs(m.stage.width - 1280) < 2 && Math.abs(m.stage.height - 720) < 2, JSON.stringify(m.stage));
    assert(Math.abs(m.stage.top - (m.vh - m.stage.bottom)) < 2, `上下の余白が均等でない: ${JSON.stringify(m.stage)}`);
    assert.match(m.backdropBg, /bg_title/, m.backdropBg);
  }, { viewport: { width: 1280, height: 960 } });
});
