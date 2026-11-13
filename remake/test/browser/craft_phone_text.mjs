import assert from 'node:assert/strict';
import { suite } from './support.mjs';

// 横持ちスマホ（#3517・#3518）: 一枚の舞台は --k（0.47〜0.54）で縮むので、ステージ寸法の px のままだと実効 6〜10px になる。
// 工程の上のレール・見守る人の札・結果カード・結果表の文字は実効 11.4px 以上、結果の根拠を開く「詳しく見る」は実効の高さ 30px 以上。
const MIN_FONT = 11.4;
const MIN_TAP = 30;
const scan = minFont => {
  const stage = document.querySelector('#stage');
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const small = [];
  for (const node of stage.querySelectorAll('*')) {
    if (![...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim())) continue;
    // 画面の外へ流れる弾幕コメント（.nico）は読ませる文ではない。
    if (node.closest('.nico')) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = node.getBoundingClientRect();
    const effective = parseFloat(style.fontSize) * k;
    // font-size: 0 は済んだ工程の番号など、意図して消した文字。
    if (!box.width || !box.height || effective === 0 || effective >= minFont) continue;
    small.push(`${node.tagName.toLowerCase()}.${String(node.className).replace(/ /g, '.')} "${node.textContent.trim().slice(0, 6)}" ${effective.toFixed(1)}px`);
  }
  return small;
};

await suite('craft-phone-text', async check => {
  for (const [name, options] of [
    ['phone-844x390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ['phone-low-844x340', { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true }],
  ]) await check(name, async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      window.S = await import('./js/craft/session.js');
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      const bench = S.openBench(S.newSession('tournament'), { steps: CRAFT_STEPS });
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      await bench.ready;
    });
    for (const [step, label] of [['setup', '機材'], ['pack', '詰め方'], ['heat', '炭焼き'], ['steam', '蒸らし'], ['pull', '吸い出し'], ['serve', '提供'], ['care', '調整']]) {
      await page.evaluate(([id, text]) => S.stepPanel(id, text, text), [step, label]);
      await page.waitForTimeout(250);
      assert.deepEqual(await page.evaluate(scan, MIN_FONT), [], `${step}: small text`);
    }
    await page.evaluate(async () => {
      const { resultCard } = await import('./js/craft/common.js');
      window.card = resultCard(document.querySelector('.bench-panel'), { title: '炭焼き', lines: ['炭1 PERFECT 3 GOOD 1 誤差 +0.4秒'], summary: ['炭は良い'], advice: 'もう少し' });
    });
    await page.locator('[data-test="step-details"]').waitFor();
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(scan, MIN_FONT), [], 'result card: small text');
    const details = await page.evaluate(() => {
      const stage = document.querySelector('#stage');
      const k = stage.getBoundingClientRect().width / stage.offsetWidth;
      const box = document.querySelector('[data-test="step-details"]').getBoundingClientRect();
      return { height: box.height, width: box.width, k };
    });
    assert(details.height >= MIN_TAP, `「詳しく見る」の高さ ${details.height}px`);
    await page.locator('[data-test="step-details"]').click({ trial: true });
    await page.locator('[data-test="step-next"]').click();
    await page.evaluate(() => window.card);

    await page.evaluate(async () => {
      const { resultTable } = await import('./js/craft/result.js');
      window.table = resultTable({ mode: 'tournament', chapter: 1, total: 72, parts: { holes: 72, heat: 72, shisha: 72, care1: 72, care2: 72 } }, 3);
    });
    await page.locator('[data-test="result-next"]').waitFor();
    await page.waitForTimeout(1200);
    assert.deepEqual(await page.evaluate(scan, MIN_FONT), [], 'result table: small text');
  }, options);
});
