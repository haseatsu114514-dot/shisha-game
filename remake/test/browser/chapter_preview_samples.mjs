import assert from "node:assert/strict";
import { suite, assertFits, storageSnapshot, baseURL } from "./support.mjs";

await suite("chapter-preview-samples", async check => {
  for (const sample of ["rush", "quiet"]) {
    for (const touch of [false, true]) {
      await check(`${sample}-${touch ? "touch" : "desktop"}`, async page => {
        await page.goto(`${baseURL}chapter-preview-samples.html?sample=${sample}`, { waitUntil: "networkidle" });
        await assertFits(page, '.sample-tab, [data-test="preview-start"]');
        const before = await storageSnapshot(page);
        await page.locator('[data-test="preview-start"]').click();
        await page.locator('[data-test="chapter-preview"][data-phase="playing"]').waitFor();
        await page.locator('.preview-art').waitFor({ timeout: 15000 });
        const root = page.locator('[data-test="chapter-preview"]');
        assert.equal(await root.getAttribute("data-sample"), sample);
        await assertFits(page, '.preview-screen, .preview-caption, .preview-control, .preview-art');
        await page.locator('[data-test="preview-pause"]').click();
        const elapsed = Number(await root.getAttribute("data-elapsed"));
        await page.waitForTimeout(400);
        assert.equal(Number(await root.getAttribute("data-elapsed")), elapsed, "Paused sample consumed subtitle time");
        await page.locator('[data-test="preview-pause"]').click();
        await page.locator('[data-test="chapter-preview"][data-phase="playing"]').waitFor();
        await page.locator('[data-test="preview-skip"]').click();
        await page.locator('[data-test="preview-ended"]').waitFor();
        assert.deepEqual(await storageSnapshot(page), before, "Sample changed game saves or configuration");
        await assertFits(page, '[data-test="preview-start"]');
      }, touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : {});
    }
  }
});
