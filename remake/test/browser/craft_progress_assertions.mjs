import assert from "node:assert/strict";
import { assertFits } from "./support.mjs";

// 全工程のDOM名を残しながら、CUI09の「今だけ名前・済み✓・先は番号」を検査する。
export async function assertCraftProgress(page) {
  assert.equal(await page.locator('.bench-phase[aria-current="step"]').count(), 1);
  await assertFits(page, '.bench-progress, .bench-phase[aria-current="step"] .bench-phase-copy b, .bench-phase:not(.now) .bench-phase-copy small');
  const craftStage = await page.evaluate(() => document.body.classList.contains('craft-stage') && !document.body.classList.contains('game-ds'));
  if (craftStage) await assertFits(page, '.bench-phase[aria-current="step"] .bench-phase-copy small');
  const phases = await page.locator('.bench-phase').evaluateAll(nodes => nodes.map(node => {
    const b = node.querySelector('b'), small = node.querySelector('small');
    const rect = b.getBoundingClientRect();
    return { label: b.textContent, accessible: node.getAttribute('aria-label'), title: node.title,
      now: node.getAttribute('aria-current') === 'step', seen: node.classList.contains('seen'),
      visible: rect.width > 0 && rect.height > 0, number: small.textContent,
      smallDisplay: getComputedStyle(small).display, size: getComputedStyle(small).fontSize,
      after: getComputedStyle(small, '::after').content,
      afterSize: getComputedStyle(small, '::after').fontSize, afterOpacity: getComputedStyle(small, '::after').opacity,
      visibility: getComputedStyle(small).visibility, opacity: getComputedStyle(small).opacity };
  }));
  phases.forEach((phase, i) => {
    assert.equal(phase.accessible, phase.label);
    assert.equal(phase.title, phase.label);
    assert.equal(phase.visible, phase.now, `Only the current phase name is painted: ${phase.label}`);
    assert.equal(phase.number, String(i + 1).padStart(2, '0'));
    // 新しい配置（既定）は今の工程の札（rail-now）の左の白い丸に番号を置く（CSL16）。旧配置は名前だけ。
    if (phase.now) assert.equal(phase.smallDisplay === 'none', !craftStage, `current phase number: ${phase.smallDisplay}`);
    else if (phase.seen) {
      assert.equal(phase.visibility, 'visible'); assert(Number(phase.opacity) > 0);
      assert(parseFloat(phase.afterSize) > 0); assert(Number(phase.afterOpacity) > 0);
      assert.equal(phase.size, '0px');
      assert.match(phase.after, /✓/);
    } else {
      assert.equal(phase.visibility, 'visible'); assert(Number(phase.opacity) > 0);
      assert.notEqual(phase.smallDisplay, 'none');
      assert(parseFloat(phase.size) > 0);
    }
  });
}
