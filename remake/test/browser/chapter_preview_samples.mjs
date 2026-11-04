// 旧比較URLは保管したUIを実行せず、現行の章タイトルだけへ誘導する。
import assert from "node:assert/strict";
import { suite, storageSnapshot } from "./support.mjs";
await suite("chapter-preview-samples",async check=>{
  for(const sample of ['tv','rush','quiet'])await check('legacy-'+sample,async page=>{
    const before=await storageSnapshot(page);
    const old=[];page.on('request',r=>{if(/chapter_previews|cgs\/ch2_preview/.test(r.url()))old.push(r.url());});
    await page.goto(new URL(`chapter-preview-samples.html?sample=${sample}`,page.url()).href);
    await page.waitForURL('**/chapter-preview.html?ch=ch2');
    await page.locator('.chapter-card.show[data-chapter="第二章"]').waitFor();
    await page.locator('[data-test="preview-ended"]').waitFor({timeout:12000});
    assert.equal(await page.locator('.chapter-preview,.sample-intro').count(),0);
    assert.deepEqual(old,[]);assert.deepEqual(await storageSnapshot(page),before);
  });
});
