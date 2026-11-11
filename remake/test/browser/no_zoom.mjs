// #2826: 縦画面の廃止（タイトルから回転案内のみ）とダブルタップ拡大の抑止（ピンチ拡大は止めない）。
// iOS Safari 実機のダブルタップ拡大そのものはここでは再現できない（イベント経路と CSS の確認まで）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 同じ要素へ touchend を続けて送り、各回の defaultPrevented と、生成された click の数を返す。
const taps = (page, gaps) => page.evaluate(async gaps => {
  const el = document.createElement("button");
  el.id = "nz-probe"; el.textContent = "probe";
  Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: "300px", height: "300px", zIndex: "1500" });
  document.body.append(el);
  let clicks = 0; el.addEventListener("click", () => clicks++);
  const out = [];
  for (const gap of gaps) {
    await new Promise(r => setTimeout(r, gap));
    const touch = new Touch({ identifier: 1, target: el, clientX: 100, clientY: 100 });
    const ev = new TouchEvent("touchend", { bubbles: true, cancelable: true, changedTouches: [touch], touches: [] });
    el.dispatchEvent(ev);
    out.push(ev.defaultPrevented);
  }
  el.remove();
  return { prevented: out, clicks };
}, gaps);

// no-zoom は WebKit だけに自動で入るため、Chromium の検査では force で同じモジュールを入れて判定を確かめる
// （double-tap-guard の検査と同じ形）。
const armNoZoom = page => page.evaluate(async () => {
  const m = await import("/remake/js/core/no-zoom.js");
  m.installNoZoom(document, { force: true });
});

await suite("no-zoom-and-landscape-only", async check => {
  await check("double-tap-is-stopped-but-single-and-slow-taps-pass", async page => {
    await armNoZoom(page);
    // 速い2回目だけ止め、click は自前で1回送る。ゆっくりした2回目・1回目は触らない。
    assert.deepEqual(await taps(page, [0, 120]), { prevented: [false, true], clicks: 1 });
    assert.deepEqual(await taps(page, [0, 600]), { prevented: [false, false], clicks: 0 });
    // 3連打目は新しい1回目として数える。
    assert.deepEqual((await taps(page, [500, 100, 100])).prevented, [false, true, false]);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("dblclick-is-cancelled-but-pinch-gestures-pass", async page => {
    await armNoZoom(page);
    const result = await page.evaluate(() => {
      const fire = type => { const e = new Event(type, { bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; };
      return [fire("gesturestart"), fire("gesturechange"), fire("gestureend"), fire("dblclick")];
    });
    // ピンチ拡大は禁止しない: gesture 系は止めず、dblclick だけ止める。
    assert.deepEqual(result, [false, false, false, true]);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("css-keeps-scroll-and-viewport-allows-pinch", async page => {
    const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
    assert.doesNotMatch(meta, /user-scalable|maximum-scale/);
    const actions = await page.evaluate(() => ["html", "body", "#viewport", "#stage"].map(s => getComputedStyle(document.querySelector(s)).touchAction));
    assert(actions.every(a => a === "manipulation"), `touch-action: ${actions}`);
    // 全面 none にしていない: 縦スクロールを要るパネルは none/pinch-zoom 無しでパンできる。
    assert(actions.every(a => !a.includes("none")));
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("portrait-title-shows-only-the-rotate-guard", async page => {
    await page.locator("#rotate-hint").waitFor({ state: "visible" });
    const r = await page.evaluate(() => {
      const g = document.querySelector("#rotate-hint"), b = g.getBoundingClientRect();
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { covers: b.left <= 0 && b.top <= 0 && b.right >= innerWidth && b.bottom >= innerHeight, hit: g === hit || g.contains(hit) };
    });
    assert.deepEqual(r, { covers: true, hit: true });
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await check("portrait-tablet-title-is-guarded", async page => {
    await page.locator("#rotate-hint").waitFor({ state: "visible" });
  }, { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });

  await check("desktop-never-shows-guard", async page => {
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
  }, { viewport: { width: 700, height: 900 } });
  // DS風の廃止（横画面一本化）: 以前に DS風を選んでいた端末でも、縦持ちは同じ回転ガードだけを出す。
  await check("legacy-ds-preference-portrait-is-guarded", async page => {
    await page.evaluate(() => localStorage.setItem("suien_title_layout", "ds"));
    await page.reload();
    await page.locator("#rotate-hint").waitFor({ state: "visible" });
    await page.waitForFunction(() => localStorage.getItem("suien_title_layout") === null);
    assert.equal(await page.locator("body.game-ds, .title-ds-panel, .game-ds-panel").count(), 0);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
