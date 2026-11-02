import assert from "node:assert/strict";
import { assertFits } from "./support.mjs";

// 全工程のDOM名を残しながら、CUI09の「今だけ名前・済み✓・先は番号」を検査する。
export async function assertCraftProgress(page) {
  assert.equal(await page.locator('.bench-phase[aria-current="step"]').count(), 1);
  await assertFits(page, '.bench-progress, .bench-phase[aria-current="step"] .bench-phase-copy b');
  const phases = await page.locator('.bench-phase').evaluateAll(nodes => nodes.map(node => {
    const b = node.querySelector('b'), small = node.querySelector('small');
    const rect = b.getBoundingClientRect();
    return { label: b.textContent, accessible: node.getAttribute('aria-label'), title: node.title,
      now: node.getAttribute('aria-current') === 'step', seen: node.classList.contains('seen'),
      visible: rect.width > 0 && rect.height > 0, number: small.textContent,
      smallDisplay: getComputedStyle(small).display, size: getComputedStyle(small).fontSize,
      after: getComputedStyle(small, '::after').content };
  }));
  phases.forEach((phase, i) => {
    assert.equal(phase.accessible, phase.label);
    assert.equal(phase.title, phase.label);
    assert.equal(phase.visible, phase.now, `Only the current phase name is painted: ${phase.label}`);
    assert.equal(phase.number, String(i + 1).padStart(2, '0'));
    if (phase.now) assert.equal(phase.smallDisplay, 'none');
    else if (phase.seen) {
      assert.equal(phase.size, '0px');
      assert.match(phase.after, /✓/);
    } else {
      assert.notEqual(phase.smallDisplay, 'none');
      assert(parseFloat(phase.size) > 0);
    }
  });
}
