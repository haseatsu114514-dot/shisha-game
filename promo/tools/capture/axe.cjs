// 斧投げ（remake/axe-throw.html・3投で練習）。横→縦→回転のゲージを実際のボタンで止めて投げる。
const { open, shot, sleep, BASE } = require('./common.cjs');
const tmp = process.argv[2] === 'tmp';
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
// 見えているゲージが目標に来たフレームで、本物の決定ボタンを押す
const stopOnFrame = (page, value, tol = 0.008) => page.evaluate(({ value, tol }) => new Promise((resolve, reject) => {
  const deadline = performance.now() + 15000;
  const seek = () => {
    const root = document.querySelector('[data-test="axe-game"]');
    const button = root?.querySelector('[data-test="axe-action"]');
    const n = Number(root?.dataset.timing);
    if (button && !button.disabled && n >= value - tol && n <= value + tol) { button.click(); resolve(n); }
    else if (performance.now() < deadline) requestAnimationFrame(seek);
    else reject(new Error(`gauge never reached ${value}`));
  };
  requestAnimationFrame(seek);
}), { value, tol });
// 回転（力）: 予測着地点が狙いの点になった瞬間に放す
const releaseWhen = (page, want) => page.evaluate((want) => new Promise((resolve) => {
  const deadline = performance.now() + 9000;
  const seek = () => {
    const root = document.querySelector('[data-test="axe-game"]');
    const button = root?.querySelector('[data-test="axe-action"]');
    const d = root?.dataset || {};
    if (button && !button.disabled && d.previewOutcome === 'hit' && Number(d.previewScore) >= want) { button.click(); resolve({ score: d.previewScore, power: d.power }); }
    else if (performance.now() < deadline) requestAnimationFrame(seek);
    else { button?.click(); resolve({ timeout: true, score: d.previewScore }); }
  };
  requestAnimationFrame(seek);
}), want);
(async () => {
  const { browser, page, report } = await open(BASE + 'axe-throw.html', { ready: '[data-test="axe-start"]' });
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
  await sleep(1500);
  await shot(page, 'axe_throw_menu', { tmp });
  await page.locator('[data-test="axe-start"]').click();
  await phase(page, 'choice');
  await sleep(2500); // 入場の幕（MINI GAME / AXE THROW）が上がるまで
  for (let n = 1; n <= 3; n++) {
    await page.locator('[data-test="axe-action"]:not([disabled])').click();
    await phase(page, 'horizontal');
    await stopOnFrame(page, 0.5);
    await phase(page, 'vertical');
    if (n === 2) { await sleep(420); await shot(page, 'axe_throw_aim', { tmp }); }
    await stopOnFrame(page, 0.5);
    await phase(page, 'power');
    if (n === 3) { await sleep(300); await shot(page, 'axe_throw_power', { tmp: true }); }
    console.log(n, await releaseWhen(page, 6));
    await phase(page, 'result');
    await sleep(1600);
    console.log(n, await page.evaluate(() => ({ total: document.querySelector('[data-test="axe-total"]')?.textContent, comment: document.querySelector('[data-test="axe-comment"]')?.textContent })));
    await shot(page, `axe_throw_hit_${n}`, { tmp: true });
    if (n < 3) { await page.locator('[data-test="axe-action"]:not([disabled])').click(); await phase(page, 'choice'); await sleep(500); }
  }
  await sleep(1500);
  await shot(page, 'axe_throw_summary', { tmp: true });
  report();
  await browser.close();
})();
