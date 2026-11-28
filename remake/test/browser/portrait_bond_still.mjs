// 縦専用CGの区間で端末を回す。元の台詞・既読位置と横版のギャラリーを保つ。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const tall = { width: 390, height: 844 };
const wide = { width: 1280, height: 720 };
const sceneId = "ch1_tsumugi_bond_finale";
const cgId = "cg_bond_tsumugi";

await suite("portrait-bond-still", async check => {
  await check("rotate-and-read", async page => {
    const images = [];
    page.on("request", request => {
      if (request.url().endsWith(`/${cgId}.webp`)) images.push(request.url());
    });
    const originalLine = await page.evaluate(async ({ sceneId, cgId }) => {
      const { newGame, config } = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const { play } = await import("./js/vn/engine.js");
      const state = newGame();
      state.met.tsumugi = true;
      state.flags._intro_tsumugi = true;
      config.textSpeed = 4;
      (await import("./js/core/ui.js")).clearScreen();
      const lines = DB.dialogues[sceneId].lines;
      const fromLine = lines.findIndex(line => line.cg_id === cgId);
      const hide = lines.findIndex((line, i) => i > fromLine && line.type === "hide_cg");
      // 絵を閉じた後の最初の台詞まで、同じ本編台本を読む。
      window.stillRun = play(sceneId, { fromLine, toLine: hide + 2 });
      return lines.slice(0, fromLine).filter(line => !line.portrait_only).length;
    }, { sceneId, cgId });

    await page.locator(`.vn-cg[data-portrait-cg="${cgId}"]`).waitFor({ state: "attached" });
    await page.locator(".vn-next.show").waitFor();
    assert.equal(await page.locator(".vn-cg.show").count(), 0);
    assert.deepEqual(images, []);

    await page.setViewportSize(tall);
    const still = page.locator(".vt-cg.tall:not([hidden])");
    await still.waitFor();
    assert((await still.getAttribute("data-url")).endsWith(`/portrait/${cgId}.webp`));
    await page.setViewportSize(wide);
    await still.waitFor({ state: "detached" });
    assert.equal(await page.locator(".vn-cg.show").count(), 0);

    await page.setViewportSize(tall);
    await still.waitFor();
    const advance = page.locator('[data-test="vt-a"]');
    const activeStill = page.locator(`.vn-cg[data-portrait-cg="${cgId}"]`);
    for (let pageIndex = 0; pageIndex < 8 && await activeStill.count(); pageIndex++) {
      await page.locator(".vn-next.show").waitFor();
      await advance.click();
    }
    await activeStill.waitFor({ state: "detached" });
    await still.waitFor({ state: "hidden" });
    const conversation = page.locator("#vn.active");
    for (let pageIndex = 0; pageIndex < 4 && await conversation.count(); pageIndex++) {
      await page.locator(".vn-next.show").waitFor();
      await advance.click();
    }
    await conversation.waitFor({ state: "detached" });
    await page.evaluate(() => window.stillRun);
    const { seen, gallery } = await page.evaluate(() => ({
      seen: JSON.parse(localStorage.getItem("suien_remake_seen_dialogue_lines") || "[]").map(JSON.parse),
      gallery: JSON.parse(localStorage.getItem("suien_remake_gallery") || "[]"),
    }));
    assert.deepEqual(seen.filter(([id]) => id === sceneId).map(([, , i]) => i),
      [originalLine, originalLine + 1, originalLine + 2]);
    assert(!gallery.includes(cgId));
    assert(images.length > 0 && images.every(url => url.endsWith(`/portrait/${cgId}.webp`)));
  }, { viewport: wide, reducedMotion: "reduce", pageEntry: `${baseURL}?look=vertical` });
});
