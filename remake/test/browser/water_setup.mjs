// Follow the real water chooser after confirmAppearanceSetup; keep manual input.
export async function confirmWaterSetup(page, { touch = false } = {}) {
  // Pin the visible element: a cancelled view must not rebind to a new chooser.
  const confirm = await page.waitForSelector('[data-test="water-confirm"]', { state: "visible" });
  if (!confirm) throw new Error("Water confirmation is missing");
  try {
    await confirm.scrollIntoViewIfNeeded();
    if (touch) await confirm.tap(); else await confirm.click();
  } finally { await confirm.dispose(); }
}
