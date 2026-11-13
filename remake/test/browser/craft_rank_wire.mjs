import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite, assertFits } from './support.mjs';
import { assertCraftProgress } from './craft_progress_assertions.mjs';

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

async function assertHeaderControls(page, checkClicks) {
  const boxes = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return {
      top: rect('.bench-top'), rank: rect('.craft-rank'),
      appearance: rect('.bench-appearance-button'), help: rect('.bench-guide summary'),
      // 新しい配置（一枚の舞台・既定）では「外観を選ぶ」は機材を選ぶ工程だけに出す（CSL）
      appearanceExpected: !document.body.matches('.craft-stage:not(.game-ds)') || document.querySelector('.bench')?.dataset.step === 'setup',
      progress: rect('.bench-progress'),
      phases: [...document.querySelectorAll('.bench-phase')].map(node => node.getBoundingClientRect().toJSON()),
    };
  });
  assert.equal(boxes.phases.length, 6);
  for (const phase of boxes.phases) {
    assert(phase.width > 0 && phase.height > 0);
    for (const container of [boxes.top, boxes.progress]) {
      assert(phase.left >= container.left && phase.right <= container.right + .1
        && phase.top >= container.top && phase.bottom <= container.bottom + .1,
      `Phase clipped: ${JSON.stringify(boxes)}`);
    }
    for (const control of [boxes.rank, boxes.appearance]) {
      assert(!overlaps(phase, control), `Phase covered: ${JSON.stringify(boxes)}`);
    }
  }
  assert(boxes.rank.width > 0 && boxes.rank.height > 0);
  assert(boxes.help.width > 0);
  assert.equal(boxes.appearance.width > 0, boxes.appearanceExpected, `Appearance visibility: ${JSON.stringify(boxes)}`);
  assert(!overlaps(boxes.appearance, boxes.help), `Appearance covered: ${JSON.stringify(boxes)}`);
  if (!checkClicks) return;
  if (boxes.appearanceExpected) await page.locator('.bench-appearance-button').click({ trial: true });
  await page.locator('.bench-guide summary').click({ trial: true });
}

await suite('craft-rank-wire', async check => {
  // DS風（session-ds）は廃止（横画面一本化）。工程の札の検査は横持ちタッチ（session-touch）にも掛ける。
  for (const [name, options] of [
    ['session-pc', {}],
    ['session-pc-1180', { viewport: { width: 1180, height: 740 } }],
    ['session-touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) await check(name, async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      window.T = { session: await import('./js/craft/session.js'), heat: await import('./js/craft/heat.js'),
        score: await import('./js/craft/score.js'), ui: await import('./js/core/ui.js') };
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      T.cs = T.session.newSession('rehearsal');
      T.bench = T.session.openBench(T.cs, { steps: CRAFT_STEPS });
      while (!T.bench.root.isConnected) await new Promise(requestAnimationFrame);
      await T.bench.ready;
      T.session.stepPanel('heat', '炭焼き', '黒い面が消えて全面が赤くなった炭を、タップして取り上げる');
    });
    // どの工程が今でも（いちばん長い名前でも）、残りの工程が全部見えること
    {
      const phases = await page.locator('.bench-phase').evaluateAll(nodes => nodes.map(node => ({ step: node.dataset.step, label: node.getAttribute('aria-label') })));
      for (const { step, label } of phases) {
        await page.evaluate(({ step, label }) => T.session.stepPanel(step, label, label), { step, label });
        await assertHeaderControls(page, step === 'heat');
      }
      await page.evaluate(() => T.session.stepPanel('heat', '炭焼き', '黒い面が消えて全面が赤くなった炭を、タップして取り上げる'));
    }
    assert.equal(await page.locator('body.game-ds').count(), 0);
    assert.equal(await page.locator('.craft-rank').count(), 1);
    assert.equal(await page.locator('.bench-mode').count(), 1);
    await assertFits(page, '.bench-mode');
    assert.equal(await page.locator('.craft-rank-wide .craft-rank-grade').textContent(), '—');
    await page.evaluate(() => { T.session.craftTest.auto = 'good'; window.heatRun = T.heat.runHeat(T.cs); });
    await page.evaluate(() => window.heatRun);
    assert.notEqual(await page.locator('.craft-rank').getAttribute('data-grade'), 'unavailable');
    // Use the actual session fields and refresh path; no production score override hook.
    for (const [grade, score, progress] of [['B', 70, '33'], ['S', 92.5, '50'], ['SS', 96, '33'], ['SSS', 99, '100'], ['B', 70, '33']]) {
      await page.evaluate(score => {
        T.cs.heat.score = score;
        T.session.refreshBench();
      }, score);
      assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), grade);
      assert(['enter', 'up', 'down'].includes(await page.locator('.craft-rank').getAttribute('data-change')));
      assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), progress);
      await assertFits(page, '.craft-rank, .craft-rank-meter');
      {
        await assertFits(page, '.bench-mode');
        const separated = await page.evaluate(() => {
          const a = document.querySelector('.bench-mode').getBoundingClientRect();
          const b = document.querySelector('.craft-rank').getBoundingClientRect();
          return a.right <= b.left;
        });
        assert(separated, 'Mode context must stay beside the rank');
      }
      await assertCraftProgress(page);
      const overlaps = await page.evaluate(() => {
        const a = document.querySelector('.craft-rank').getBoundingClientRect();
        const b = document.querySelector('.bench-progress').getBoundingClientRect();
        return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      });
      assert.equal(overlaps, false);
      if (process.env.SHOTS && ['session-pc', 'session-touch'].includes(name)) {
        fs.mkdirSync(process.env.SHOTS, { recursive: true });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${process.env.SHOTS}/U6-${name === 'session-touch' ? 'touch' : 'PC'}-${grade}.png` });
      }
    }

    await page.evaluate(() => {
      T.cs.stats = { craftQuality: 99 };
      T.cs.careHistory = [{ score: 99 }, { score: 99 }];
      T.score.finalize(T.cs);
    });
    const expected = await page.evaluate(async () => {
      const { CRAFT_RANK_THRESHOLDS } = await import('./js/craft/common.js');
      const { craftRankProgress } = await import('./js/craft/rank-hud.js');
      return craftRankProgress(T.cs.total, CRAFT_RANK_THRESHOLDS).grade;
    });
    assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), expected);
    assert.equal(await page.locator('.craft-rank').getAttribute('data-provisional'), 'false');
    await page.evaluate(async () => {
      const { resultTable } = await import('./js/craft/result.js');
      T.session.craftTest.auto = null;
      window.resultRun = resultTable(T.cs, 3);
    });
    await page.locator('[data-test="craft-final-rank"]').waitFor();
    assert.equal(await page.locator('[data-test="craft-final-rank"]').textContent(), expected);
    // 総合タイルの評価マークとランク文字は同じ位置に重ならない（#3515）
    const totalMarks = await page.evaluate(() => {
      const tile = document.querySelector('.rt-part.total');
      const rect = node => node.getBoundingClientRect().toJSON();
      return { mark: rect(tile.querySelector('b.craft-evaluation')), rank: rect(tile.querySelector('[data-test="craft-final-rank"]')) };
    });
    assert(totalMarks.mark.width > 0 && totalMarks.rank.width > 0);
    assert(!overlaps(totalMarks.mark, totalMarks.rank), `Total tile marks overlap: ${JSON.stringify(totalMarks)}`);
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
    await page.locator('[data-test="result-next"]').click();
    await page.evaluate(() => window.resultRun);
    await page.evaluate(async () => {
      const b = T.session.openBench(T.session.newSession('rehearsal'));
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await b.ready;
    });
    assert.equal(await page.locator('.craft-rank').count(), 1);
    await page.evaluate(() => T.ui.retireScreen());
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
    // Reopening and aborting through a screen replacement also cleans up.
    await page.evaluate(async () => {
      const cs = T.session.newSession('rehearsal');
      const b = T.session.openBench(cs);
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await b.ready;
      T.ui.clearScreen();
    });
    await page.waitForFunction(() => !document.querySelector('.craft-rank'));
  }, options);

  // 大会の水入れ（機材を選ぶ工程）でも「外観を選ぶ」が「?」の手前に全文見える（#3516）
  for (const [name, options] of [
    ['tournament-setup-pc', {}],
    ['tournament-setup-touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ['tournament-setup-touch-low', { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true }],
  ]) await check(name, async page => {
    const boxes = await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      const S = await import('./js/craft/session.js');
      const { CRAFT_STEPS } = await import('./js/craft/practice.js');
      const b = S.openBench(S.newSession('tournament'), { steps: CRAFT_STEPS });
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await b.ready;
      S.stepPanel('setup', '機材', '機材を選ぶ');
      await new Promise(requestAnimationFrame);
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return { appearance: rect('.bench-appearance-button'), help: rect('.bench-guide summary'), rank: rect('.craft-rank'), vw: innerWidth };
    });
    assert(boxes.appearance.width > 0 && boxes.appearance.right <= boxes.vw, `Appearance clipped: ${JSON.stringify(boxes)}`);
    assert(boxes.appearance.right <= boxes.help.left + .5, `Appearance behind help: ${JSON.stringify(boxes)}`);
    assert(!overlaps(boxes.appearance, boxes.rank), `Appearance covered by rank: ${JSON.stringify(boxes)}`);
    await page.locator('.bench-appearance-button').click({ trial: true });
  }, options);
});
