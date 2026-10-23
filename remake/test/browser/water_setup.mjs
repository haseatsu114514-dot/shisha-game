// Follow the real water chooser after confirmAppearanceSetup; keep manual input.
export async function confirmWaterSetup(page, { touch = false } = {}) {
  const confirm = page.locator('[data-test="water-confirm"]');
  await confirm.waitFor({ state: "visible" });
  await confirm.scrollIntoViewIfNeeded();
  if (touch) await confirm.tap(); else await confirm.click();
}
