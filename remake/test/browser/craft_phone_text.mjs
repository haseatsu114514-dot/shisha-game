import assert from 'node:assert/strict';
import { suite } from './support.mjs';

// 横持ちスマホ（#3517）: 一枚の舞台は --k（0.47〜0.54）で縮むので、ステージ寸法の px のままだと実効 6〜10px になる。
// 工程の上のレール・見守る人の札・結果カード・結果表の文字は実効 11.4px 以上。
const MIN_FONT = 11.4;
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

  // #3558: 配合の在庫行・課題行と、大会の中間投票も同じ実効 11.4px 下限で見る（項目4・5）。
  for (const [name, options] of [
    ['phone-844x390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ['phone-low-844x340', { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true }],
  ]) await check(`${name}-mix-standings`, async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      Object.assign(core.state, {
        chapter: 1, flavors: ['double_apple', 'mint', 'blueberry', 'lemon'],
        flavorStock: { double_apple: 50, mint: 50, blueberry: 10, lemon: 50 },
      });
      window.S = await import('./js/craft/session.js');
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      window.cs = window.S.newSession('tournament');
      const bench = window.S.openBench(window.cs, { steps: CRAFT_STEPS });
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      await bench.ready;
      const steps = await import('./js/craft/steps.js');
      window.__mixP = steps.stepMix(window.cs);
    });
    await page.locator('.flavor-row[data-flavor="blueberry"]').waitFor();
    await page.waitForTimeout(250);
    const mix = await page.evaluate(() => {
      const row = document.querySelector('.flavor-row[data-flavor="blueberry"]');
      const boxes = [...row.querySelectorAll('.fr-feature, .fr-stock, .fr-mastery')].map(n => n.getBoundingClientRect());
      const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const mastery = row.querySelector('.fr-mastery');
      return {
        featureHitsStock: hit(boxes[0], boxes[1]),
        masteryVisible: !!(mastery && mastery.getBoundingClientRect().width > 1 && mastery.textContent.includes('熟練度')),
      };
    });
    assert.equal(mix.featureHitsStock, false, '配合の「特徴」が在庫行に重なる');
    assert.equal(mix.masteryVisible, true, '熟練度が見えない');
    assert.deepEqual(await page.evaluate(scan, MIN_FONT), [], 'mix: small text');

    // Scroll the last pair fully into view and hit both centers above the fixed footer.
    const last = page.locator('.flavor-row').last();
    await last.scrollIntoViewIfNeeded();
    for (const button of await last.locator('.fr-btn').all()) {
      const target = await button.evaluate(node => {
        const box = node.getBoundingClientRect();
        const list = node.closest('.mix-list').getBoundingClientRect();
        const footer = document.querySelector('.mix-footer').getBoundingClientRect();
        return { width: box.width, height: box.height, inList: box.top >= list.top - 1 && box.bottom <= list.bottom + 1,
          aboveFooter: box.bottom <= footer.top, hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
      });
      assert(target.width >= 44 && target.height >= 44 && target.inList && target.aboveFooter && target.hit, JSON.stringify(target));
    }

    await page.evaluate(async () => {
      const { showStandings } = await import('./js/craft/result.js');
      window.__standP = showStandings(1, 80, window.cs, { rulesVersion: 2, voteAttempt: { votes: {}, views: [], picks: [], attacks: [] } });
    });
    await page.locator('[data-test="standings"]').waitFor();
    await page.waitForTimeout(250);
    // 顔写真が LFS 未展開だと .face-fallback の一字が見える。22px は 844×340 で実効 10.4px になるが、
    // CI では絵が読めて fallback は hidden。項目5の指摘は LIVE・見出し・速報・投入行なので、ここは除外する。
    assert.deepEqual((await page.evaluate(scan, MIN_FONT)).filter((line) => !line.includes('face-fallback')), [], 'standings: small text');
  }, options);
});
