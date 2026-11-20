import assert from "node:assert/strict";
import { assertFits } from "./support.mjs";

// #3914: 加熱前の現在温度の針は、配合の温度帯が変わっても下端に止まる。
export async function assertParkedThermometer(page, { selected } = {}) {
  const meter = page.locator('.bench:not(.done) .thermo:visible');
  assert.equal(await meter.count(), 1, "Only one thermometer is visible");
  assert.match(await meter.getAttribute("aria-label"), /加熱前/);
  assert.equal(await meter.getAttribute("aria-valuenow"), null, "No measured heat before steaming");
  if (selected !== undefined) {
    assert.equal(await meter.getAttribute("data-selected"), String(selected));
    assert.match(await meter.getAttribute("aria-label"), selected ? /配合の温度帯/ : /フレーバー未選択/);
    assert.equal(await meter.locator(".thermo-zone").isVisible(), selected);
  }
  const pointer = meter.locator('[data-test="thermo-pointer"]');
  assert(await pointer.isVisible(), "The current-temperature needle remains visible");
  const position = await pointer.evaluate(p => {
    const needle = p.getBoundingClientRect();
    const tube = p.closest(".thermo").querySelector(".thermo-tube").getBoundingClientRect();
    return { gap: Math.abs(needle.top + needle.height / 2 - tube.bottom), animation: getComputedStyle(p).animationName };
  });
  assert(position.gap < 3, `The needle must align with the bottom of the tube: ${position.gap}px`);
  assert.equal(position.animation, "none", "The inactive needle does not move");
  const bench = page.locator(".bench:not(.done)");
  assert.doesNotMatch(await bench.innerText(), /温度計はお休み/);
  assert.doesNotMatch(await bench.locator(".bench-right").evaluate(n => getComputedStyle(n, "::before").content), /お休み/);
  await assertFits(page, '.bench:not(.done) .thermo:visible, .bench:not(.done) .thermo [data-test="thermo-pointer"]:visible');
}
