// 実際の起動・再表示、採用した7人21枚、PC/スマホのメニューとセーブ不変を確認。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, storageSnapshot, assertFits } from "./browser/support.mjs";

await suite("title-arts", async (check) => {
  await check("boot-and-random", async page => {
    await page.locator(".title-art.ready").waitFor();
    const bootImages = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /\/title_arts\/title_art_/.test(entry.name)).map(entry => entry.name));
    assert.equal(bootImages.length, 1, "Boot downloaded more than the selected title image");
    const before = await storageSnapshot(page);
    let previous = await page.locator(".title-art").getAttribute("data-character");
    for (let i = 0; i < 24; i++) {
      await page.evaluate(async () => (await import("./js/scenes/title.js")).showTitle());
      await page.locator(".title-art.ready").waitFor();
      const character = await page.locator(".title-art").getAttribute("data-character");
      assert.notEqual(character, previous, "The same character appeared on consecutive title visits");
      previous = character;
    }
    // 追加されたひよりを確実に抽選・表示する。偶然24回で出ないことを失敗にしない。
    const selected = await page.evaluate(async previous => {
      const data = await import("./js/core/data.js");
      const loader = await import("./js/scenes/title-art.js");
      const title = await import("./js/scenes/title.js");
      const characters = [...new Set(data.DB.manifest.titleArts.map(art => art.character))];
      let last = previous;
      const displayed = [];
      for (const character of characters) {
        if (character === last) continue;
        const fresh = characters.filter(id => id !== last);
        const random = Math.random;
        let calls = 0;
        let art;
        try {
          Math.random = () => calls++ === 0 ? (fresh.indexOf(character) + 0.5) / fresh.length : 0;
          art = loader.pickTitleArt();
        } finally {
          Math.random = random;
        }
        if (art.character !== character || art.character === last) throw Error("Character selection changed");
        title.showTitle(await loader.prepareTitleArt(art));
        displayed.push(art.character);
        last = art.character;
      }
      return displayed;
    }, previous);
    assert.ok(selected.includes("hiyori"), "Hiyori was not selected by the production title picker");
    assert.deepEqual(await storageSnapshot(page), before, "Title selection changed saved progress");
  });

  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      const arts = await page.evaluate(() => __remake.DB.manifest.titleArts);
      assert.equal(arts.length, 21);
      assert.deepEqual([...new Set(arts.map(art => art.character))].sort(), ["ageha", "hiyori", "kafuka", "mashiro", "minto", "rin", "tsumugi"]);
      assert.deepEqual(arts.filter(art => art.character === "hiyori").map(art => art.file).sort(), [
        "title_art_hiyori_01_twilight_walk.png", "title_art_hiyori_02_window_pause.png", "title_art_hiyori_03_after_rain.png",
      ]);
      assert.ok(!arts.some(art => art.file.includes("rin_02")), "The refinement-pending Rin image was adopted");
      const before = await storageSnapshot(page);
      const output = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser", "title-variants");
      fs.mkdirSync(output, { recursive: true });
      for (const art of arts) {
        await page.evaluate(async art => {
          const data = await import("./js/core/data.js");
          const title = await import("./js/scenes/title.js");
          const loader = await import("./js/scenes/title-art.js");
          const loaded = await loader.prepareTitleArt({ ...art, url: data.assetUrl(`ui/title_arts/${art.file}`) });
          title.showTitle(loaded);
        }, art);
        assert.equal(await page.locator(".title-art.ready").getAttribute("data-art"), art.file, "The image fell back instead of decoding");
        await assertFits(page, ".title-item");
        await page.locator(".title").evaluate(node => {
          for (const animation of node.getAnimations({ subtree: true })) {
            if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
          }
        });
        await page.screenshot({ path: path.join(output, `${label}-${art.file}`) });
      }
      assert.deepEqual(await storageSnapshot(page), before);
    }, { viewport });
  }
});
