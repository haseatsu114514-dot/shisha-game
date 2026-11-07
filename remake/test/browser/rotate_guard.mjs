// #2789（#2794）: スマホの縦持ち（タッチ・幅760px以下）では、DS風を含む本編の画面を全面の回転ガードで覆い、操作を通さない。
// 縦持ちの配置を測る代わりに、その画面でガードが全面を覆うこと・押そうとした部品へ実際の入力が届かないこと・
// 横持ちへ戻すとガードが消えて同じ状態から続けられることを確かめる。
// #2941: ticking を渡すと、時間で進む工程（吸い出しの針など）がガードの間は止まり、横へ戻すと再開することも確かめる。
import assert from "node:assert/strict";

// ページ内で ms の間、毎フレーム値を読み、見えた値を順に返す（外からの取りこぼしを避ける）。
const sample = (page, { selector, attr }, ms) => page.evaluate(({ selector, attr, ms }) => new Promise(resolve => {
  const seen = [], end = performance.now() + ms;
  const read = () => {
    seen.push(document.querySelector(selector)?.getAttribute(attr) ?? null);
    if (performance.now() < end) requestAnimationFrame(read); else resolve(seen);
  };
  read();
}), { selector, attr, ms });

const settled = async (page, { width, height }) => {
  await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

/**
 * 縦持ちへ回して回転ガードを確かめ、横持ちへ戻す。
 * targets: 縦持ちで押してみる部品。中心がガードに当たり、実際に押しても下へ届かないこと。
 * state: 進行・表示の状態。押す前・縦持ちで押した後・横持ちへ戻した後で同じであること。
 * ticking: { selector, attr } 時間で進む工程の値。ガードの間は1.5秒見ても変わらず、横へ戻すと再び動くこと（#2941）。
 */
export async function rotateThroughGuard(page, { portrait, landscape, targets, state, label, touch = true, ticking = null }) {
  assert(targets.length > 0, `${label}: 押してみる部品がない`);
  const before = await state();
  await page.setViewportSize(portrait);
  await settled(page, portrait);
  const guard = page.locator("#rotate-hint");
  await guard.waitFor({ state: "visible" });
  assert.match(await guard.innerText(), /スマホは横向きでお楽しみください/, `${label}: 回転ガードの案内`);
  if (ticking) {
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    const seen = await sample(page, ticking, 1500);
    assert.equal(new Set(seen).size, 1, `${label}: 回転ガードの間も時間で進む工程が進んだ ${JSON.stringify(seen.slice(0, 5))}…`);
  }
  for (const target of targets) {
    // ガードの下でも部品は画面内にある（スクロールで見える位置に出す）。そのうえで中心を押しても届かないこと。
    await target.scrollIntoViewIfNeeded();
    const probe = await target.evaluate(node => {
      const guard = document.getElementById("rotate-hint");
      const g = guard.getBoundingClientRect(), r = node.getBoundingClientRect();
      const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2, hit = document.elementFromPoint(x, y);
      return { target: node.dataset.test || node.className, x, y,
        laidOut: r.width > 0 && r.height > 0, onScreen: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        covers: g.left <= 0 && g.top <= 0 && g.right >= innerWidth && g.bottom >= innerHeight,
        intercepts: !!hit && guard.contains(hit) };
    });
    const { target: name, x, y, ...seen } = probe;
    assert.deepEqual(seen, { laidOut: true, onScreen: true, covers: true, intercepts: true },
      `${label}: 回転ガードが ${name} を覆わない ${JSON.stringify(probe)}`);
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  }
  assert.deepEqual(await state(), before, `${label}: 縦持ちの入力が回転ガードの下へ届いた`);
  await page.setViewportSize(landscape);
  await settled(page, landscape);
  await guard.waitFor({ state: "hidden" });
  assert.deepEqual(await state(), before, `${label}: 横持ちへ戻すと同じ状態から続く`);
  if (ticking) {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.rotateGuard ?? null), null, `${label}: 回転ガードの印が残った`);
    const paused = await page.evaluate(({ selector, attr }) => document.querySelector(selector)?.getAttribute(attr) ?? null, ticking);
    await page.waitForFunction(({ selector, attr, paused }) => (document.querySelector(selector)?.getAttribute(attr) ?? null) !== paused,
      { ...ticking, paused }, { timeout: 15000 });
  }
}
