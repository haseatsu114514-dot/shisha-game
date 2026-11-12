import assert from 'node:assert/strict';
import { suite } from './support.mjs';

await suite('mobile-craft-layout', async check => {
  for (const viewport of [{ width: 852, height: 393 }, { width: 1280, height: 591 }, { width: 1280, height: 720 }]) {
    await check(`pack-and-impact-${viewport.width}x${viewport.height}`, async page => {
      await page.evaluate(async () => {
        (await import('./js/core/state.js')).newGame();
        const session = await import('./js/craft/session.js');
        window.mobileCS = session.newSession('rehearsal');
        mobileCS.equip.hms = 'tanukish_lid';
        mobileCS.mix = { double_apple: 10, mint: 2 };
        await session.openBench(mobileCS).ready;
        void (await import('./js/craft/steps.js')).stepPack(mobileCS);
      });
      await page.locator('.pack-confirm').waitFor();
      const boxes = await page.evaluate(() => {
        const box = s => document.querySelector(s).getBoundingClientRect().toJSON();
        return { panel: box('.bench-panel'), parts: ['.pack-aroma','.pack-vessel','.pack-caption','.pack-choices','.pack-footer'].map(box),
          caption: (()=>{const n=document.querySelector('.pack-caption'); return [n.scrollHeight,n.clientHeight];})() };
      });
      const { panel, parts } = boxes;
      for (const r of parts) assert(r.left >= panel.left - 1 && r.right <= panel.right + 1 && r.top >= panel.top - 1 && r.bottom <= panel.bottom + 1, JSON.stringify(boxes));
      for (let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++) {
        const a=parts[i], b=parts[j];
        assert(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1, `overlap ${i}/${j}: ${JSON.stringify(boxes)}`);
      }
      assert(boxes.caption[0] <= boxes.caption[1] + 1, 'selected explanation must be visible');
      await page.locator('[data-test="opt-fluffy"]').click();
      assert.match(await page.locator('.pack-caption').textContent(), /ふんわり/);
      await page.locator('.pack-confirm').click();
      for (const [step, selector] of [['holes','.foil'],['heat','.stove']]) {
        await page.evaluate(async step => {
          const session = await import('./js/craft/session.js');
          await session.openBench(mobileCS).ready;
          if(step === 'holes') void (await import('./js/craft/holes.js')).runHoles(mobileCS);
          else void (await import('./js/craft/heat.js')).runHeat(mobileCS);
        }, step);
        if(step === 'holes') await page.locator('[data-test="hole-start"]').click();
        await page.locator(selector).waitFor();
        const impact = await page.locator(selector).evaluate(async node => {
          const fx = await import('./js/craft/fx.js');
          const base = getComputedStyle(node).transform;
          const width = node.getBoundingClientRect().width;
          fx.hitStop(node);
          const animation = node.getAnimations().find(a => a.effect.getKeyframes().some(f => f.scale));
          animation.pause(); animation.currentTime = 40;
          const during = getComputedStyle(node).transform, ratio = node.getBoundingClientRect().width / width;
          animation.finish();
          return { base, during, after: getComputedStyle(node).transform, ratio };
        });
        assert.equal(impact.during, impact.base, `${step} must retain layout transform during impact`);
        assert.equal(impact.after, impact.base);
        assert(impact.ratio >= 1 && impact.ratio <= 1.05, JSON.stringify(impact));
      }
    }, { viewport, hasTouch: true, isMobile: true });
  }
});
