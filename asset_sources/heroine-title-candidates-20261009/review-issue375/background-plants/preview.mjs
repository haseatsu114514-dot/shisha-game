// 候補PNGを使い捨てブラウザ内で仮表示。公開manifestと保存データは変更しない。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, baseURL, storageSnapshot, assertFits } from "../../../../remake/test/browser/support.mjs";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const candidates = JSON.parse(fs.readFileSync(new URL("./candidates.json", import.meta.url))).items;
assert.equal(candidates.length, 2);
const devices = [
  ["pc", { viewport: { width: 1280, height: 720 } }],
  ["mobile", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
];

await suite("issue375-background-plants", async check => {
  for (const candidate of candidates) {
    assert.equal(candidate.approved, false);
    assert.deepEqual(candidate.runtime_paths, []);
    const buffer = fs.readFileSync(path.join(root, candidate.path));
    const file = path.basename(candidate.path);
    for (const [device, options] of devices) {
      await check(`${candidate.id}-${device}`, async page => {
        const saved = await storageSnapshot(page);
        const manifest = await page.evaluate(() => JSON.stringify(__remake.DB.manifest));
        const url = new URL(`__issue375_review/${file}`, baseURL).href;
        await page.route(url, route => route.fulfill({ status: 200, contentType: "image/png", body: buffer }));
        const rendered = await page.evaluate(async ({ file, url }) => {
          const loader = await import("./js/scenes/title-art.js");
          const title = await import("./js/scenes/title.js");
          const prepared = await loader.prepareTitleArt({ character: "minto", file, url });
          title.showTitle(prepared);
          const image = new Image();
          image.src = url;
          await image.decode();
          return { file: prepared.file, width: image.naturalWidth, height: image.naturalHeight };
        }, { file, url });
        assert.equal(rendered.file, file, "The candidate fell back instead of decoding");
        assert.deepEqual([rendered.width, rendered.height], [1024, 1536]);
        await page.locator(".title-art.ready").waitFor();
        assert.equal(await page.locator(".title-art").getAttribute("data-art"), file);
        await assertFits(page, ".title-item");
        await page.locator(".title").evaluate(node => {
          for (const animation of node.getAnimations({ subtree: true })) {
            if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
          }
        });
        assert.equal(await page.evaluate(() => JSON.stringify(__remake.DB.manifest)), manifest);
        assert.equal(await page.evaluate(() => __remake.DB.manifest.titleArts.length), JSON.parse(manifest).titleArts.length);
        assert.equal(await page.evaluate(file => __remake.DB.manifest.titleArts.some(art => art.file === file), file), false);
        assert.deepEqual(await storageSnapshot(page), saved);
      }, options);
    }
  }
});
